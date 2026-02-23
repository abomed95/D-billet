import { useState, useRef, useEffect } from 'react';
import { QrCode, Camera, CheckCircle, XCircle, RotateCcw, Flashlight, Keyboard } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ScannerPage = () => {
  const [mode, setMode] = useState('camera'); // camera, manual
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [manualCode, setManualCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (mode === 'camera' && scanning) {
      startCamera();
    }
    return () => stopCamera();
  }, [mode, scanning]);

  const startCamera = async () => {
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
      setCameraError('Impossible d\'accéder à la caméra. Vérifiez les permissions.');
      setMode('manual');
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const validateTicket = async (qrData) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/scanner/validate?qr_data=${encodeURIComponent(qrData)}`);
      setResult(response.data);
      
      // Play sound based on result
      if (response.data.valid) {
        // Success sound (beep)
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleRMCD3+T3dmceQ0AA4CT4eGfaw4AAH+T4d6fbA8AAX+R39mbcRIAA3+O3NWYdRUABH+K2dGVeBkABn+G1c2SfB0ACH+D0smPgCIACn+A0MWMhCcADYB9zcGJiCwAEIB6y76GjDEAE4B3ybuDkDYAFoB1x7eAkzsAGYBzxbR9lz8AHIB1w7F6m0MAHYB3wa53n0gAHoBsybmAokcAH4BdvKyMnT8AH4BQsZ+WlzUAHoBHqJOemiwAHoBBn4ilnSIAHoA7loSslhkAHoA2jXq0jxAAHoAyhnS7iQkAHoAuf264gwMAHoAqd2m+fv4AHoAlb2TDePgAHoAgaF/HcvMAH4AaYVrLbO4AH4AUWlXPZuoAIIAOVFHTYOYAIIAITU3XWuIAIIADRkjbVN0AIoD+PkTfTtkAI4D4OEDjSNQAJID0Mjzn');
        audio.play().catch(() => {});
      }
      
      // Reset after delay
      setTimeout(() => {
        if (!result?.valid) {
          setResult(null);
        }
      }, 5000);
      
    } catch (error) {
      setResult({
        valid: false,
        status: 'error',
        message: error.response?.data?.detail || 'Erreur de validation',
        color: 'red'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (manualCode.trim()) {
      validateTicket(manualCode.trim());
    }
  };

  const resetScanner = () => {
    setResult(null);
    setManualCode('');
    if (mode === 'camera') {
      setScanning(true);
    }
  };

  // Simple QR detection simulation (in real app, use a QR library like jsQR or html5-qrcode)
  const handleVideoClick = () => {
    // For demo: prompt for manual entry
    const code = prompt('Entrez le code QR (ou ID du billet):');
    if (code) {
      validateTicket(code);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col">
      {/* Header */}
      <header className="glass border-b border-white/10 p-4 sticky top-0 z-50">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-unbounded font-bold text-xl text-green-400">D-BILLET</h1>
            <p className="text-xs text-gray-400">Scanner de Sécurité</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('camera')}
              className={`p-2 rounded-lg transition-all ${mode === 'camera' ? 'bg-green-500 text-black' : 'bg-white/10 text-white'}`}
            >
              <Camera size={20} />
            </button>
            <button
              onClick={() => setMode('manual')}
              className={`p-2 rounded-lg transition-all ${mode === 'manual' ? 'bg-green-500 text-black' : 'bg-white/10 text-white'}`}
            >
              <Keyboard size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-lg">
          {/* Result Display */}
          {result && (
            <div 
              className={`mb-6 p-6 rounded-2xl border-2 animate-fade-in ${
                result.valid 
                  ? 'bg-green-500/20 border-green-500' 
                  : 'bg-red-500/20 border-red-500'
              }`}
            >
              <div className="flex items-center gap-4 mb-4">
                {result.valid ? (
                  <CheckCircle className="text-green-500" size={48} />
                ) : (
                  <XCircle className="text-red-500" size={48} />
                )}
                <div>
                  <h2 className={`font-unbounded font-bold text-xl ${result.valid ? 'text-green-400' : 'text-red-400'}`}>
                    {result.valid ? 'VALIDÉ' : 'REFUSÉ'}
                  </h2>
                  <p className="text-gray-300">{result.message}</p>
                </div>
              </div>
              
              {result.ticket && (
                <div className="space-y-2 pt-4 border-t border-white/10">
                  <p className="text-white font-semibold">{result.ticket.event_title}</p>
                  {result.ticket.ticket_type && (
                    <p className="text-gray-400 text-sm">Type: {result.ticket.ticket_type}</p>
                  )}
                  {result.ticket.passenger_name && (
                    <p className="text-gray-400 text-sm">Passager: {result.ticket.passenger_name}</p>
                  )}
                  {result.ticket.event_date && (
                    <p className="text-gray-400 text-sm">Date: {result.ticket.event_date}</p>
                  )}
                  {result.ticket.price && (
                    <p className="text-green-400 font-mono">{result.ticket.price} DJF</p>
                  )}
                </div>
              )}

              <Button
                onClick={resetScanner}
                className="w-full mt-4 bg-white/10 hover:bg-white/20 text-white"
              >
                <RotateCcw size={18} className="mr-2" />
                Scanner un autre billet
              </Button>
            </div>
          )}

          {/* Camera View */}
          {mode === 'camera' && !result && (
            <div className="space-y-4">
              <div 
                className="relative aspect-square rounded-2xl overflow-hidden bg-black border-2 border-green-500/50 cursor-pointer"
                onClick={handleVideoClick}
              >
                {cameraError ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center">
                    <Camera className="text-gray-500 mb-4" size={48} />
                    <p className="text-gray-400">{cameraError}</p>
                    <Button 
                      onClick={() => { setMode('manual'); }}
                      className="mt-4"
                      variant="outline"
                    >
                      Mode manuel
                    </Button>
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
                    
                    {/* Scanner Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-64 h-64 border-2 border-green-500 rounded-xl relative">
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-500 rounded-tl-lg"></div>
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-500 rounded-tr-lg"></div>
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-500 rounded-bl-lg"></div>
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-500 rounded-br-lg"></div>
                        
                        {/* Scanning Line Animation */}
                        <div className="absolute left-2 right-2 h-0.5 bg-green-500 animate-pulse top-1/2"></div>
                      </div>
                    </div>
                    
                    {/* Tap Instruction */}
                    <div className="absolute bottom-4 left-0 right-0 text-center">
                      <p className="text-white text-sm bg-black/50 py-2 px-4 rounded-full inline-block">
                        Tapez pour entrer le code manuellement
                      </p>
                    </div>
                  </>
                )}
              </div>
              
              {!scanning && !cameraError && (
                <Button 
                  onClick={() => setScanning(true)}
                  className="w-full bg-green-500 hover:bg-green-600 text-black"
                >
                  <Camera size={20} className="mr-2" />
                  Démarrer le scanner
                </Button>
              )}
            </div>
          )}

          {/* Manual Entry */}
          {mode === 'manual' && !result && (
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="glass p-6 rounded-2xl">
                <div className="flex justify-center mb-6">
                  <div className="w-20 h-20 rounded-2xl bg-green-500/20 flex items-center justify-center">
                    <QrCode className="text-green-400" size={40} />
                  </div>
                </div>
                
                <label className="block text-gray-400 text-sm mb-2">
                  Code du billet ou données QR
                </label>
                <Input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder="DBILLET-xxxxxxxx-xxxx-xxxx..."
                  className="bg-white/5 border-white/10 text-white font-mono text-center"
                  data-testid="manual-code-input"
                />
                
                <p className="text-gray-500 text-xs mt-2 text-center">
                  Entrez le code affiché sous le QR code du billet
                </p>
              </div>

              <Button
                type="submit"
                disabled={loading || !manualCode.trim()}
                className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-6"
                data-testid="validate-btn"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin w-5 h-5 border-2 border-black border-t-transparent rounded-full"></div>
                    Validation...
                  </span>
                ) : (
                  <>
                    <CheckCircle size={20} className="mr-2" />
                    Valider le billet
                  </>
                )}
              </Button>
            </form>
          )}

          {/* Instructions */}
          {!result && (
            <div className="mt-8 glass p-4 rounded-xl">
              <h3 className="text-white font-semibold mb-2">Instructions</h3>
              <ul className="text-gray-400 text-sm space-y-1">
                <li>• Scannez le QR code du billet</li>
                <li>• <span className="text-green-400">Vert</span> = Billet valide, accès autorisé</li>
                <li>• <span className="text-red-400">Rouge</span> = Billet invalide ou déjà utilisé</li>
                <li>• En cas de problème, utilisez le mode manuel</li>
              </ul>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="glass border-t border-white/10 p-4 text-center">
        <p className="text-gray-500 text-sm">D-Billet Scanner v1.0</p>
      </footer>
    </div>
  );
};

export default ScannerPage;
