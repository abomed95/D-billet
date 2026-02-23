import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Download, Calendar, Clock, MapPin, User, ArrowLeft, CheckCircle, XCircle, Train, Ship, Share2, MessageCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TicketViewPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, getAuthHeaders } = useAuth();
  
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetchTicket();
  }, [id]);

  const fetchTicket = async () => {
    try {
      const response = await axios.get(`${API}/tickets/${id}/view`);
      setTicket(response.data);
    } catch (error) {
      console.error('Failed to fetch ticket:', error);
      toast.error('Billet non trouvé');
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-DJ').format(price) + ' DJF';
  };

  const downloadPDF = async () => {
    if (!token) {
      toast.error('Connectez-vous pour télécharger le PDF');
      return;
    }
    setDownloading(true);
    try {
      const response = await axios.get(`${API}/tickets/${id}/pdf`, {
        headers: getAuthHeaders(),
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `billet-${id.slice(0, 8)}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('PDF téléchargé');
    } catch (error) {
      toast.error('Erreur lors du téléchargement');
    } finally {
      setDownloading(false);
    }
  };

  const shareOnWhatsApp = () => {
    if (ticket?.whatsapp_url) {
      window.open(ticket.whatsapp_url, '_blank');
    } else {
      const shareUrl = `${window.location.origin}/ticket/${id}`;
      const text = `🎫 Mon billet D-Billet\n\n${ticket?.event_title}\n📅 ${ticket?.event_date} à ${ticket?.event_time}\n📍 ${ticket?.event_venue}\n\n${shareUrl}`;
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(whatsappUrl, '_blank');
    }
    toast.success('Ouverture de WhatsApp...');
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Billet - ${ticket?.event_title}`,
          text: `Mon billet pour ${ticket?.event_title} le ${ticket?.event_date}`,
          url: window.location.href
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          toast.error('Erreur de partage');
        }
      }
    } else {
      // Fallback: copy link
      navigator.clipboard.writeText(window.location.href);
      toast.success('Lien copié!');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen py-8 px-4">
        <div className="max-w-lg mx-auto">
          <Skeleton className="h-[600px] rounded-3xl" />
        </div>
      </div>
    );
  }

  if (!ticket) return null;

  const getTicketColor = () => {
    if (ticket.type === 'train') return 'from-train to-yellow-600';
    if (ticket.type === 'ferry') return 'from-ferry to-cyan-600';
    return 'from-green-500 to-green-700';
  };

  const TicketIcon = ticket.type === 'train' ? Train : ticket.type === 'ferry' ? Ship : null;

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 glass rounded-full"
            data-testid="back-btn"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="font-unbounded font-bold text-xl text-white">Votre Billet</h1>
          <div className="flex gap-2">
            <button
              onClick={shareNative}
              className="p-2 glass rounded-full hover:bg-white/10"
              title="Partager"
            >
              <Share2 size={20} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* Ticket Card */}
        <div className="bg-[#0F0F12] rounded-3xl overflow-hidden border border-white/10">
          {/* Header */}
          <div className={`bg-gradient-to-r ${getTicketColor()} p-6 text-white`}>
            <div className="flex items-center justify-between mb-4">
              <span className="font-unbounded font-bold text-2xl">D-BILLET</span>
              <span className={`px-3 py-1 rounded-full text-xs font-bold
                ${ticket.status === 'used' ? 'bg-gray-600 text-gray-300' : 'bg-white/20 text-white'}`}>
                {ticket.status === 'used' ? 'Utilisé' : 'Valide'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {TicketIcon && <TicketIcon size={24} />}
              <h2 className="font-unbounded font-bold text-xl" data-testid="ticket-title">
                {ticket.event_title}
              </h2>
            </div>
            {ticket.ticket_type && (
              <span className="inline-block mt-2 px-3 py-1 bg-white/20 rounded-full text-sm">
                {ticket.ticket_type}
              </span>
            )}
          </div>

          {/* Perforated line */}
          <div className="relative h-6 bg-[#0F0F12]">
            <div className="absolute left-0 w-6 h-6 bg-[#050505] rounded-full -translate-x-1/2 top-0" />
            <div className="absolute right-0 w-6 h-6 bg-[#050505] rounded-full translate-x-1/2 top-0" />
            <div className="border-t-2 border-dashed border-white/20 absolute w-full top-3 mx-6" style={{ width: 'calc(100% - 48px)', left: '24px' }} />
          </div>

          {/* Details */}
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="text-green-400" size={20} />
                <div>
                  <p className="text-xs text-gray-500">Date</p>
                  <p className="font-medium text-white">{ticket.event_date}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="text-green-400" size={20} />
                <div>
                  <p className="text-xs text-gray-500">Heure</p>
                  <p className="font-medium text-white">{ticket.event_time}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <MapPin className="text-green-400" size={20} />
              <div>
                <p className="text-xs text-gray-500">Lieu</p>
                <p className="font-medium text-white">{ticket.event_venue}</p>
              </div>
            </div>

            {(ticket.passenger_name || ticket.holder_name) && (
              <div className="flex items-center gap-3">
                <User className="text-green-400" size={20} />
                <div>
                  <p className="text-xs text-gray-500">{ticket.type ? 'Passager' : 'Titulaire'}</p>
                  <p className="font-medium text-white">{ticket.passenger_name || ticket.holder_name}</p>
                </div>
              </div>
            )}

            {ticket.passenger_id && (
              <div className="text-sm text-gray-400">
                ID: {ticket.passenger_id}
              </div>
            )}

            {/* Price */}
            <div className="pt-4 border-t border-white/10">
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Prix</span>
                <span className="font-mono font-bold text-xl text-green-400">
                  {formatPrice(ticket.price)}
                </span>
              </div>
            </div>
          </div>

          {/* Perforated line */}
          <div className="relative h-6 bg-[#0F0F12]">
            <div className="absolute left-0 w-6 h-6 bg-[#050505] rounded-full -translate-x-1/2 top-0" />
            <div className="absolute right-0 w-6 h-6 bg-[#050505] rounded-full translate-x-1/2 top-0" />
            <div className="border-t-2 border-dashed border-white/20 absolute w-full top-3 mx-6" style={{ width: 'calc(100% - 48px)', left: '24px' }} />
          </div>

          {/* QR Code */}
          <div className="p-8 flex flex-col items-center bg-white">
            {ticket.qr_code_image ? (
              <img src={ticket.qr_code_image} alt="QR Code" className="w-48 h-48" data-testid="qr-code" />
            ) : (
              <div 
                className="w-48 h-48 bg-gray-200 flex items-center justify-center rounded-xl"
                data-testid="qr-code"
              >
                <p className="text-gray-500 text-sm text-center px-4">
                  QR Code: {ticket.qr_code_data}
                </p>
              </div>
            )}
            <p className="text-xs text-gray-600 mt-4 text-center">
              Présentez ce QR code à l'entrée
            </p>
            <p className="text-xs text-gray-400 font-mono mt-1">
              {ticket.qr_code_data}
            </p>
          </div>
        </div>

        {/* Status Indicator */}
        {ticket.status !== 'used' ? (
          <div className="flex items-center gap-3 mt-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
            <CheckCircle className="text-green-500" size={24} />
            <div>
              <p className="font-semibold text-white">Billet valide</p>
              <p className="text-sm text-gray-400">
                Présentez ce billet à l'entrée
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 mt-6 p-4 rounded-xl bg-gray-500/10 border border-gray-500/20">
            <XCircle className="text-gray-500" size={24} />
            <div>
              <p className="font-semibold text-white">Billet utilisé</p>
              <p className="text-sm text-gray-400">
                Ce billet a déjà été scanné
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 space-y-3">
          {/* WhatsApp Share Button */}
          <Button
            onClick={shareOnWhatsApp}
            className="w-full h-14 text-lg gap-2 bg-[#25D366] hover:bg-[#20BD5C] text-white"
            data-testid="whatsapp-share-btn"
          >
            <MessageCircle size={20} />
            Partager sur WhatsApp
          </Button>

          {/* Download PDF */}
          {token && (
            <Button
              onClick={downloadPDF}
              disabled={downloading}
              className="w-full h-14 text-lg gap-2 border-green-500 text-green-400 hover:bg-green-500/20"
              variant="outline"
              data-testid="download-pdf-btn"
            >
              <Download size={20} />
              {downloading ? 'Téléchargement...' : 'Télécharger en PDF'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TicketViewPage;
