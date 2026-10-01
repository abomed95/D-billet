import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Shield, Camera, CheckCircle, XCircle, AlertTriangle, 
  LogOut, ChevronDown, User, Ticket, Clock, RefreshCw,
  X, QrCode
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useStaffAuth } from '../../context/StaffAuthContext';
import { startQrScanner, warmUpDecoder } from '../../lib/qrScanner';
import {
  countQueue, getDeviceId, getManifest, listQueue, queueScan,
  removeFromQueue, saveManifest,
} from '../../lib/offlineStore';
import { verifyOffline, warmUpVerifier } from '../../lib/qrVerify';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Vibration patterns
const VIBRATION_PATTERNS = {
  success: [100],           // 1 short vibration
  error: [200, 100, 200, 100, 200],   // 3 long vibrations
  warning: [150, 100, 150]  // 2 medium vibrations
};

const vibrate = (pattern) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(VIBRATION_PATTERNS[pattern] || [100]);
  }
};

const StaffScannerPage = () => {
  const navigate = useNavigate();
  const { staff, logout, getAuthHeaders, isAuthenticated, loading } = useStaffAuth();
  
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventSelector, setShowEventSelector] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [stats, setStats] = useState({ entries: 0, total: 0 });
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [cameraError, setCameraError] = useState(null);

  // Offline control. The manifest is downloaded before departure; scans taken
  // without network are queued and synced when a connection returns.
  const [online, setOnline] = useState(
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [manifest, setManifest] = useState(null);
  const [queued, setQueued] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncReport, setSyncReport] = useState(null);
  const [downloadingManifest, setDownloadingManifest] = useState(false);
  
  const videoRef = useRef(null);
  // Working surface for the jsQR fallback, where BarcodeDetector is missing.
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const lastScannedRef = useRef(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      navigate('/staff/login');
    }
  }, [loading, isAuthenticated, navigate]);

  const startCamera = useCallback(async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (error) {
      console.error('Camera error:', error);
      setCameraError('Impossible d\'accéder à la caméra');
      setShowManual(true);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Placed after startCamera/stopCamera on purpose: the dependency array below
  // reads them during render, so declaring them further down would leave them in
  // their temporal dead zone and throw before the screen ever painted.
  useEffect(() => {
    if (!scanning || showManual) {
      return undefined;
    }
    startCamera();
    // Decode straight from the video feed instead of waiting for the
    // controller to read the code and type it in.
    const stopScanner = startQrScanner({
      video: videoRef.current,
      canvas: canvasRef.current,
      onDecode: (text) => {
        setScanning(false);
        handleScan(text);
      },
    });
    return () => {
      stopScanner();
      stopCamera();
    };
    // handleScan only reads the selected event, so it does not need to retrigger
    // the camera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scanning, showManual, startCamera, stopCamera]);


  const fetchEvents = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/staff/events`, {
        headers: getAuthHeaders()
      });
      setEvents(response.data);
      if (response.data.length === 1) {
        setSelectedEvent(response.data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoadingEvents(false);
    }
  }, [getAuthHeaders]);

  const fetchStats = useCallback(async () => {
    if (!selectedEvent) return;
    try {
      const response = await axios.get(`${API}/staff/events`, {
        headers: getAuthHeaders()
      });
      const event = response.data.find(e => e.id === selectedEvent.id);
      if (event) {
        setStats({ entries: event.scanned_tickets, total: event.total_tickets });
      }
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  }, [getAuthHeaders, selectedEvent]);

  // Same reason as the camera effect below: these dependency arrays are read
  // during render, so they must sit after the callbacks they name.
  useEffect(() => {
    if (isAuthenticated) {
      fetchEvents();
    }
  }, [fetchEvents, isAuthenticated]);

  useEffect(() => {
    if (selectedEvent) {
      fetchStats();
      const interval = setInterval(fetchStats, 10000);
      return () => clearInterval(interval);
    }
  }, [fetchStats, selectedEvent]);


  // --- Offline control ---------------------------------------------------

  const deviceId = getDeviceId();

  const refreshQueueCount = useCallback(async () => {
    setQueued(await countQueue());
  }, []);

  // Track connectivity. navigator.onLine only reports the link, not whether the
  // server answers, so a failed request also flips us to offline below.
  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // Load whatever manifest is already stored for the selected event.
  useEffect(() => {
    if (!selectedEvent) {
      setManifest(null);
      return;
    }
    let active = true;
    getManifest(selectedEvent.id, selectedEvent.date).then((stored) => {
      if (active) setManifest(stored || null);
    });
    refreshQueueCount();
    return () => { active = false; };
  }, [selectedEvent, refreshQueueCount]);

  const downloadManifest = async () => {
    if (!selectedEvent) return;
    setDownloadingManifest(true);
    try {
      const response = await axios.get(
        `${API}/staff/manifest/${selectedEvent.id}`,
        { params: selectedEvent.date ? { date: selectedEvent.date } : {},
          headers: getAuthHeaders() }
      );
      await saveManifest(response.data);
      setManifest(response.data);
      setOnline(true);
      // Pull the decoder and the signature verifier down now: both arrive via
      // dynamic import, which cannot run once the device is offline.
      await Promise.all([warmUpDecoder(), warmUpVerifier()]);
    } catch (error) {
      setSyncReport({ error: "Telechargement du manifeste impossible" });
    } finally {
      setDownloadingManifest(false);
    }
  };

  const syncQueue = useCallback(async () => {
    const pending = await listQueue();
    if (!pending.length) {
      setQueued(0);
      return;
    }
    setSyncing(true);
    try {
      const response = await axios.post(
        `${API}/staff/scans/batch`,
        { scans: pending.map(({ scan_id, ticket_id, event_id, scanned_at, device_id }) =>
            ({ scan_id, ticket_id, event_id, scanned_at, device_id })) },
        { headers: getAuthHeaders() }
      );
      // Every outcome is final on the server side, conflicts included, so the
      // queue is cleared either way; the report tells the controller what the
      // server made of it.
      await removeFromQueue(response.data.results.map((r) => r.scan_id));
      setSyncReport({
        synced: response.data.synced,
        counts: response.data.counts,
        conflicts: response.data.results.filter((r) => r.status === 'conflict'),
      });
      setOnline(true);
    } catch (error) {
      setSyncReport({ error: 'Synchronisation impossible, file conservee' });
      setOnline(false);
    } finally {
      setSyncing(false);
      await refreshQueueCount();
    }
  }, [getAuthHeaders, refreshQueueCount]);

  // Sync as soon as the network comes back.
  useEffect(() => {
    if (online && queued > 0 && !syncing) {
      syncQueue();
    }
    // Only react to the connection returning, not to every queue change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online]);

  const scanOffline = async (qrCode) => {
    const pending = await listQueue();
    const scannedHere = pending
      .filter((entry) => entry.event_id === selectedEvent.id)
      .map((entry) => entry.ticket_id);

    const verdict = await verifyOffline({
      qrData: qrCode,
      manifest,
      alreadyScannedIds: scannedHere,
    });

    if (verdict.ok) {
      await queueScan({
        scan_id: (crypto.randomUUID && crypto.randomUUID()) ||
          `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ticket_id: verdict.ticketId,
        event_id: selectedEvent.id,
        scanned_at: new Date().toISOString(),
        device_id: deviceId,
      });
      await refreshQueueCount();
    }

    return {
      status: verdict.ok ? 'valid' : (
        verdict.status === 'already_used' || verdict.status === 'already_scanned_here'
          ? 'already_scanned' : 'invalid'
      ),
      message: verdict.message,
      details: 'Hors ligne - sera synchronise au retour du reseau',
      client_name: verdict.holder || 'Client',
      ticket_type: verdict.ticketType || 'Standard',
      vibration: verdict.ok ? 'success' : 'error',
      offline: true,
    };
  };

  const handleScan = async (qrCode) => {
    if (!qrCode || processing) return;
    if (lastScannedRef.current === qrCode) return;
    lastScannedRef.current = qrCode;
    
    setProcessing(true);
    setScanResult(null);

    try {
      if (!online) {
        const offlineResult = await scanOffline(qrCode);
        setScanResult(offlineResult);
        vibrate(offlineResult.vibration);
        if (offlineResult.status === 'valid') {
          setStats((prev) => ({ ...prev, entries: prev.entries + 1 }));
        }
        setTimeout(() => {
          setScanResult(null);
          lastScannedRef.current = null;
        }, 3000);
        return;
      }

      const response = await axios.post(
        `${API}/staff/scan`,
        { qr_code: qrCode, event_id: selectedEvent.id },
        { headers: getAuthHeaders() }
      );
      
      setScanResult(response.data);
      vibrate(response.data.vibration || 'success');
      
      if (response.data.status === 'valid') {
        setStats(prev => ({ ...prev, entries: prev.entries + 1 }));
      }
      
      setTimeout(() => {
        setScanResult(null);
        lastScannedRef.current = null;
      }, 3000);
      
    } catch (error) {
      console.error('Scan error:', error);
      // No response at all means the link died mid-check: fall back to the
      // offline path rather than turning the controller away.
      if (!error.response && manifest) {
        setOnline(false);
        const offlineResult = await scanOffline(qrCode);
        setScanResult(offlineResult);
        vibrate(offlineResult.vibration);
        setTimeout(() => {
          setScanResult(null);
          lastScannedRef.current = null;
        }, 3000);
        return;
      }
      vibrate('error');
      setScanResult({
        status: 'error',
        message: error.response ? 'Erreur de connexion' : 'Hors ligne sans manifeste',
        details: error.response?.data?.detail
          || 'Telechargez le manifeste avant le depart pour scanner hors ligne'
      });
      setTimeout(() => {
        setScanResult(null);
        lastScannedRef.current = null;
      }, 3000);
    } finally {
      setProcessing(false);
      setManualCode('');
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualCode.trim()) {
      handleScan(manualCode.trim());
    }
  };

  const handleLogout = () => {
    stopCamera();
    logout();
    navigate('/staff/login');
  };

  const getResultStyle = () => {
    if (!scanResult) return {};
    switch (scanResult.status) {
      case 'valid':
        return { bg: 'bg-green-500', icon: CheckCircle };
      case 'invalid':
        return { bg: 'bg-red-500', icon: XCircle };
      case 'already_scanned':
        return { bg: 'bg-orange-500', icon: AlertTriangle };
      default:
        return { bg: 'bg-red-500', icon: XCircle };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <Shield className="text-orange-500 mx-auto mb-4 animate-pulse" size={48} />
          <p className="text-gray-400">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 p-4 safe-area-top">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="text-white" size={24} />
            <div>
              <p className="text-white font-semibold text-sm">{staff?.full_name}</p>
              <p className="text-white/70 text-xs">Staff Scanner</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-white hover:bg-white/20"
          >
            <LogOut size={20} />
          </Button>
        </div>
      </div>

      {/* Event Selector */}
      {events.length > 1 && (
        <div className="p-4 border-b border-white/10">
          <button
            onClick={() => setShowEventSelector(!showEventSelector)}
            className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10"
          >
            <div className="flex items-center gap-3">
              <Ticket className="text-orange-400" size={20} />
              <span className="text-white font-medium">
                {selectedEvent ? selectedEvent.title : 'Sélectionner un événement'}
              </span>
            </div>
            <ChevronDown className={`text-gray-400 transition-transform ${showEventSelector ? 'rotate-180' : ''}`} size={20} />
          </button>
          
          {showEventSelector && (
            <div className="mt-2 space-y-2">
              {events.map(event => (
                <button
                  key={event.id}
                  onClick={() => {
                    setSelectedEvent(event);
                    setShowEventSelector(false);
                    setScanning(false);
                    setScanResult(null);
                  }}
                  className={`w-full p-3 rounded-xl text-left transition-all ${
                    selectedEvent?.id === event.id 
                      ? 'bg-orange-500/20 border border-orange-500' 
                      : 'bg-white/5 border border-white/10'
                  }`}
                >
                  <p className="text-white font-medium">{event.title}</p>
                  <p className="text-gray-400 text-sm">{event.date} • {event.venue}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Single event display */}
      {events.length === 1 && selectedEvent && (
        <div className="p-4 border-b border-white/10">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/30">
            <Ticket className="text-orange-400" size={20} />
            <div>
              <p className="text-white font-medium">{selectedEvent.title}</p>
              <p className="text-gray-400 text-sm">{selectedEvent.date}</p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Bar */}
      {selectedEvent && (
        <div className="flex items-center justify-center gap-6 p-4 bg-white/5">
          <div className="text-center">
            <p className="text-2xl font-bold text-green-400">{stats.entries}</p>
            <p className="text-gray-400 text-xs">Entrées</p>
          </div>
          <div className="w-px h-10 bg-white/20"></div>
          <div className="text-center">
            <p className="text-2xl font-bold text-white">{stats.total}</p>
            <p className="text-gray-400 text-xs">Billets</p>
          </div>
          <div className="w-px h-10 bg-white/20"></div>
          <div className="text-center">
            <p className="text-2xl font-bold text-orange-400">
              {stats.total > 0 ? Math.round((stats.entries / stats.total) * 100) : 0}%
            </p>
            <p className="text-gray-400 text-xs">Taux</p>
          </div>
        </div>
      )}

      {/* Offline control: manifest, connection state, pending queue */}
      {selectedEvent && (
        <div className="px-4 py-3 border-b border-white/10 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${online ? 'bg-green-400' : 'bg-orange-400'}`}
                aria-hidden="true"
              />
              <span className="text-sm text-gray-300">
                {online ? 'En ligne' : 'Hors ligne'}
              </span>
              {queued > 0 && (
                <span className="text-xs text-orange-300" data-testid="queue-count">
                  · {queued} scan{queued > 1 ? 's' : ''} en attente
                </span>
              )}
            </div>

            {online && queued > 0 ? (
              <Button
                onClick={syncQueue}
                disabled={syncing}
                size="sm"
                className="bg-green-500 hover:bg-green-600 text-black"
                data-testid="sync-btn"
              >
                <RefreshCw size={14} className={`mr-1 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Synchronisation' : 'Synchroniser'}
              </Button>
            ) : (
              <Button
                onClick={downloadManifest}
                disabled={!online || downloadingManifest}
                size="sm"
                variant="outline"
                data-testid="manifest-btn"
              >
                {downloadingManifest ? 'Téléchargement' : 'Manifeste'}
              </Button>
            )}
          </div>

          <p className="text-xs text-gray-400">
            {manifest
              ? `Manifeste : ${manifest.count} billet${manifest.count > 1 ? 's' : ''}, chargé le ${new Date(manifest.generated_at).toLocaleString('fr-FR')}`
              : 'Aucun manifeste sur cet appareil. Téléchargez-le avant le départ pour pouvoir contrôler sans réseau.'}
          </p>

          {syncReport && (
            <div
              className={`rounded-lg p-2 text-xs ${
                syncReport.error || (syncReport.conflicts && syncReport.conflicts.length)
                  ? 'bg-red-500/10 border border-red-500/30 text-red-300'
                  : 'bg-green-500/10 border border-green-500/30 text-green-300'
              }`}
              data-testid="sync-report"
            >
              {syncReport.error ? (
                syncReport.error
              ) : (
                <>
                  <p>{syncReport.synced} scan(s) synchronisé(s).</p>
                  {syncReport.conflicts && syncReport.conflicts.length > 0 && (
                    <p className="mt-1">
                      ALERTE : {syncReport.conflicts.length} billet(s) déjà scanné(s)
                      sur un autre appareil —{' '}
                      {syncReport.conflicts
                        .map((c) => `${c.ticket_id} (${c.first_scanned_by || 'agent inconnu'})`)
                        .join(', ')}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {!selectedEvent ? (
          <div className="text-center">
            <Ticket className="text-gray-600 mx-auto mb-4" size={64} />
            <p className="text-gray-400">Sélectionnez un événement pour commencer</p>
          </div>
        ) : !scanning ? (
          <div className="text-center w-full max-w-xs">
            <Button
              onClick={() => setScanning(true)}
              className="w-full h-40 bg-gradient-to-br from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 rounded-3xl flex flex-col items-center justify-center gap-4"
              data-testid="start-scan-btn"
            >
              <Camera size={64} className="text-white" />
              <span className="text-xl font-bold text-white">SCANNER</span>
            </Button>
            <p className="text-gray-500 text-sm mt-4">
              Appuyez pour ouvrir la caméra
            </p>
          </div>
        ) : (
          <div className="w-full max-w-md">
            {/* Mode Toggle */}
            <div className="flex gap-2 mb-4">
              <Button
                variant={showManual ? "outline" : "default"}
                onClick={() => setShowManual(false)}
                className={!showManual ? "bg-orange-500 text-black" : ""}
              >
                <Camera size={18} className="mr-2" />
                Caméra
              </Button>
              <Button
                variant={showManual ? "default" : "outline"}
                onClick={() => {
                  setShowManual(true);
                  stopCamera();
                }}
                className={showManual ? "bg-orange-500 text-black" : ""}
              >
                <QrCode size={18} className="mr-2" />
                Manuel
              </Button>
            </div>

            {showManual ? (
              /* Manual Input */
              <form onSubmit={handleManualSubmit} className="space-y-4">
                <div className="glass p-6 rounded-2xl">
                  <p className="text-gray-400 text-sm mb-4">Entrez le code QR manuellement:</p>
                  <Input
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    placeholder="Ex: EVT-abc123..."
                    className="bg-white/5 border-white/10 text-white text-lg h-14"
                    autoFocus
                    data-testid="manual-qr-input"
                  />
                  <Button
                    type="submit"
                    disabled={processing || !manualCode.trim()}
                    className="w-full mt-4 h-14 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold"
                  >
                    {processing ? <RefreshCw className="animate-spin" size={24} /> : 'Valider'}
                  </Button>
                </div>
              </form>
            ) : (
              /* Camera Scanner */
              <div className="relative rounded-2xl overflow-hidden bg-black aspect-square">
                {cameraError ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center p-4">
                      <XCircle className="text-red-500 mx-auto mb-2" size={48} />
                      <p className="text-red-400">{cameraError}</p>
                      <Button
                        onClick={() => setShowManual(true)}
                        className="mt-4 bg-orange-500"
                      >
                        Saisie manuelle
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      className="w-full h-full object-cover"
                      playsInline
                      muted
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    
                    {/* Scan overlay */}
                    <div className="absolute inset-0 pointer-events-none">
                      <div className="absolute inset-8 border-2 border-orange-500/50 rounded-xl">
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-orange-500 rounded-tl-xl"></div>
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-orange-500 rounded-tr-xl"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-orange-500 rounded-bl-xl"></div>
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-orange-500 rounded-br-xl"></div>
                      </div>
                    </div>
                    
                    {/* Instructions */}
                    <div className="absolute bottom-4 left-0 right-0 text-center">
                      <p className="text-white text-sm bg-black/50 px-4 py-2 rounded-lg inline-block">
                        Placez le QR code dans le cadre
                      </p>
                    </div>
                  </>
                )}
              </div>
            )}
            
            {/* Close button */}
            <Button
              onClick={() => {
                setScanning(false);
                setScanResult(null);
                stopCamera();
              }}
              variant="outline"
              className="w-full mt-4"
            >
              <X size={18} className="mr-2" />
              Fermer le scanner
            </Button>
            
            {/* Processing indicator */}
            {processing && (
              <div className="mt-4 text-center">
                <RefreshCw className="animate-spin text-orange-500 mx-auto" size={32} />
                <p className="text-gray-400 mt-2">Vérification...</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Scan Result Modal */}
      {scanResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className={`w-full max-w-sm p-6 rounded-3xl ${getResultStyle().bg} transform transition-all animate-in zoom-in duration-200`}>
            <div className="text-center text-white">
              {(() => {
                const Icon = getResultStyle().icon;
                return <Icon size={80} className="mx-auto mb-4" />;
              })()}
              
              <h2 className="text-2xl font-bold mb-2">
                {scanResult.message}
              </h2>
              
              {scanResult.client_name && (
                <div className="flex items-center justify-center gap-2 mb-2">
                  <User size={20} />
                  <span className="text-xl">{scanResult.client_name}</span>
                </div>
              )}
              
              {scanResult.ticket_type && (
                <div className="inline-block px-4 py-1 rounded-full bg-white/20 text-sm font-medium mb-2">
                  {scanResult.ticket_type}
                </div>
              )}
              
              {scanResult.details && (
                <p className="text-white/80 text-sm mt-2">{scanResult.details}</p>
              )}
              
              {scanResult.scanned_by && (
                <p className="text-white/60 text-xs mt-2">
                  Par: {scanResult.scanned_by}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bottom Safe Area */}
      <div className="h-4 safe-area-bottom"></div>
    </div>
  );
};

export default StaffScannerPage;
