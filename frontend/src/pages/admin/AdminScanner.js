import { useState } from 'react';
import axios from 'axios';
import { QrCode, CheckCircle, XCircle, AlertCircle, Loader2, Camera } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminScanner = () => {
  const { getAuthHeaders } = useAuth();
  const [ticketId, setTicketId] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);

  const handleScan = async (e) => {
    e.preventDefault();
    if (!ticketId.trim()) {
      toast.error('Veuillez entrer un ID de billet');
      return;
    }

    setScanning(true);
    setResult(null);

    try {
      const response = await axios.post(
        `${API}/admin/scan?ticket_id=${encodeURIComponent(ticketId.trim())}`,
        {},
        { headers: getAuthHeaders() }
      );
      
      setResult({
        success: true,
        message: response.data.message,
        ticket: response.data.ticket
      });
      toast.success('Billet validé !');
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Billet invalide';
      setResult({
        success: false,
        message: errorMessage
      });
      toast.error(errorMessage);
    } finally {
      setScanning(false);
    }
  };

  const resetScanner = () => {
    setTicketId('');
    setResult(null);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="font-unbounded font-bold text-2xl md:text-3xl text-white mb-2">
          Scanner de Billets
        </h1>
        <p className="text-gray-400">
          Scannez ou entrez l'ID du billet pour le valider
        </p>
      </div>

      {/* Scanner Area */}
      <div className="glass-card p-8">
        {!result ? (
          <>
            {/* Scanner Icon */}
            <div className="w-32 h-32 mx-auto mb-8 rounded-3xl bg-primary/20 flex items-center justify-center animate-pulse-glow">
              <QrCode className="text-primary" size={64} />
            </div>

            {/* Manual Entry Form */}
            <form onSubmit={handleScan} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="ticketId" className="text-white">
                  ID du billet ou code QR
                </Label>
                <Input
                  id="ticketId"
                  type="text"
                  placeholder="DBILLET-xxxxxxxx-xxxx-xxxx..."
                  value={ticketId}
                  onChange={(e) => setTicketId(e.target.value)}
                  className="h-14 text-center font-mono"
                  data-testid="ticket-id-input"
                />
                <p className="text-xs text-gray-500 text-center">
                  Entrez l'ID complet du billet ou le contenu du QR code
                </p>
              </div>

              <Button
                type="submit"
                disabled={scanning || !ticketId.trim()}
                className="w-full h-14 text-lg neon-glow"
                data-testid="scan-btn"
              >
                {scanning ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={20} />
                    Validation...
                  </>
                ) : (
                  <>
                    <Camera className="mr-2" size={20} />
                    Valider le billet
                  </>
                )}
              </Button>
            </form>
          </>
        ) : (
          /* Result Display */
          <div className="text-center animate-fade-in">
            {result.success ? (
              <>
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-green-500/20 flex items-center justify-center">
                  <CheckCircle className="text-green-500" size={48} />
                </div>
                <h2 className="font-unbounded font-bold text-2xl text-white mb-2">
                  Billet Validé !
                </h2>
                <p className="text-green-400 font-medium mb-6">{result.message}</p>
                
                {result.ticket && (
                  <div className="glass-card p-6 text-left mb-6">
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-gray-500">Événement</p>
                        <p className="text-white font-semibold">{result.ticket.event_title}</p>
                      </div>
                      {result.ticket.holder_name && (
                        <div>
                          <p className="text-xs text-gray-500">Titulaire</p>
                          <p className="text-white font-semibold">{result.ticket.holder_name}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-gray-500">Statut</p>
                        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/20 text-green-400 font-bold text-sm">
                          <CheckCircle size={14} />
                          Validé
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-accent-pink/20 flex items-center justify-center">
                  <XCircle className="text-accent-pink" size={48} />
                </div>
                <h2 className="font-unbounded font-bold text-2xl text-white mb-2">
                  Validation Échouée
                </h2>
                <p className="text-accent-pink font-medium mb-6">{result.message}</p>
              </>
            )}

            <Button
              onClick={resetScanner}
              variant="outline"
              className="w-full h-12"
              data-testid="scan-another-btn"
            >
              Scanner un autre billet
            </Button>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="glass-card p-6">
        <h3 className="font-unbounded font-semibold text-lg text-white mb-4 flex items-center gap-2">
          <AlertCircle className="text-primary" size={20} />
          Instructions
        </h3>
        <ul className="space-y-2 text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">1.</span>
            Demandez au participant de présenter son QR code
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">2.</span>
            Scannez le code ou entrez l'ID manuellement
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">3.</span>
            Vérifiez que le nom correspond à la personne
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary font-bold">4.</span>
            Un billet validé ne peut être utilisé qu'une seule fois
          </li>
        </ul>
      </div>
    </div>
  );
};

export default AdminScanner;
