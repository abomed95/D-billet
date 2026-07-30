import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { CheckCircle, XCircle, Loader2, Ticket, ArrowRight, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatPrice = (price) =>
  new Intl.NumberFormat('fr-DJ').format(price || 0) + ' DJF';

const PaymentResultPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getAuthHeaders, authState } = useAuth();

  const reference = searchParams.get('ref');
  const initialStatus = searchParams.get('status') || 'unknown';

  // paid | cancelled | pending | unknown | loading | error
  const [status, setStatus] = useState('loading');
  const [payment, setPayment] = useState(null);

  const loadPayment = useCallback(async () => {
    if (!reference) {
      setStatus('error');
      return;
    }
    try {
      // If not yet resolved, ask the backend to (re)verify against WaafiPay.
      if (initialStatus === 'pending' || initialStatus === 'unknown') {
        try {
          await axios.post(
            `${API}/payments/waafi/verify?reference_id=${encodeURIComponent(reference)}`,
            {},
            { headers: getAuthHeaders() }
          );
        } catch (_) {
          /* fall through to fetching the current state */
        }
      }
      const { data } = await axios.get(
        `${API}/payments/${encodeURIComponent(reference)}`,
        { headers: getAuthHeaders() }
      );
      setPayment(data);
      setStatus(data.status || 'unknown');
    } catch (error) {
      // Fall back to whatever WaafiPay told us in the redirect.
      setStatus(['paid', 'cancelled', 'pending'].includes(initialStatus) ? initialStatus : 'error');
    }
  }, [reference, initialStatus, getAuthHeaders]);

  useEffect(() => {
    loadPayment();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isPaid = status === 'paid';
  const isPending = status === 'pending' || status === 'loading';
  const paidTickets = (payment?.tickets || []).filter((t) => t.status === 'valid');

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <h1 className="font-unbounded font-bold text-2xl text-white mb-6">
          {isPaid ? 'Paiement confirmé' : isPending ? 'Vérification du paiement' : 'Paiement non abouti'}
        </h1>

        {status === 'loading' && (
          <div className="glass p-12 rounded-xl text-center">
            <Loader2 className="w-16 h-16 mx-auto text-green-400 animate-spin mb-6" />
            <p className="text-gray-300">Vérification de votre paiement WaafiPay...</p>
          </div>
        )}

        {isPaid && (
          <div className="space-y-6 animate-fade-in">
            <div className="glass p-12 rounded-xl text-center">
              <div className="w-20 h-20 rounded-full bg-green-500/20 mx-auto mb-6 flex items-center justify-center">
                <CheckCircle className="text-green-500" size={48} />
              </div>
              <h2 className="font-unbounded font-bold text-2xl text-white mb-3">Paiement réussi !</h2>
              <p className="text-gray-400 mb-6">Vos billets ont été générés avec succès</p>
              {payment?.amount != null && (
                <div className="glass rounded-xl p-4 inline-block">
                  <p className="text-sm text-gray-400">Montant payé</p>
                  <p className="font-mono font-bold text-2xl text-green-400">{formatPrice(payment.amount)}</p>
                </div>
              )}
            </div>

            {paidTickets.length > 0 && (
              <div className="glass p-6 rounded-xl">
                <h3 className="font-unbounded font-semibold text-white mb-4">Vos billets</h3>
                <div className="space-y-3">
                  {paidTickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      onClick={() => navigate(`/ticket/${ticket.id}`)}
                      className="w-full glass p-4 rounded-xl flex items-center justify-between hover:border-green-500/50 transition-colors border border-white/10"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                          <Ticket className="text-green-400" size={20} />
                        </div>
                        <span className="text-white font-medium">{ticket.event_title}</span>
                      </div>
                      <span className="text-green-400">Voir →</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={() => navigate('/my-tickets')}
              className="w-full h-14 text-lg bg-green-500 hover:bg-green-600 text-black gap-2"
            >
              <Ticket size={20} /> Voir tous mes billets <ArrowRight size={20} />
            </Button>
          </div>
        )}

        {isPending && status !== 'loading' && (
          <div className="glass p-12 rounded-xl text-center space-y-6 animate-fade-in">
            <Loader2 className="w-16 h-16 mx-auto text-yellow-400 animate-spin" />
            <div>
              <h2 className="font-unbounded font-bold text-xl text-white mb-2">Paiement en attente</h2>
              <p className="text-gray-400">
                Votre paiement n'est pas encore confirmé. Cela peut prendre quelques instants.
              </p>
            </div>
            <Button onClick={loadPayment} className="bg-green-500 hover:bg-green-600 text-black gap-2">
              <RefreshCw size={18} /> Actualiser
            </Button>
          </div>
        )}

        {(status === 'cancelled' || status === 'error' || status === 'unknown') && !isPending && (
          <div className="glass p-12 rounded-xl text-center space-y-6 animate-fade-in">
            <div className="w-20 h-20 rounded-full bg-red-500/20 mx-auto flex items-center justify-center">
              <XCircle className="text-red-500" size={48} />
            </div>
            <div>
              <h2 className="font-unbounded font-bold text-2xl text-white mb-3">Paiement non abouti</h2>
              <p className="text-gray-400">
                Votre paiement a été annulé ou n'a pas pu être confirmé. Aucun montant n'a été débité.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate('/cart')} className="bg-green-500 hover:bg-green-600 text-black">
                Réessayer le paiement
              </Button>
              <Button onClick={() => navigate('/')} variant="outline" className="border-white/20">
                Retour à l'accueil
              </Button>
            </div>
          </div>
        )}

        {!authState?.isAuthenticated && (
          <p className="text-center text-gray-500 text-sm mt-6">
            Connectez-vous pour retrouver vos billets dans « Mes billets ».
          </p>
        )}
      </div>
    </div>
  );
};

export default PaymentResultPage;
