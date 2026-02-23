import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CreditCard, CheckCircle, Loader2, ArrowLeft, Shield } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PAYMENT_METHODS = [
  {
    id: 'waafi',
    name: 'Waafi',
    description: 'Paiement mobile',
    color: '#FF6B00',
    logo: '/images/waafi-logo.png',
  },
  {
    id: 'dmoney',
    name: 'D-Money',
    description: 'Paiement mobile',
    color: '#00A651',
    logo: '/images/dmoney-logo.png',
  },
  {
    id: 'cacbank',
    name: 'CAC Bank',
    description: 'Virement bancaire',
    color: '#1E40AF',
    logo: '/images/cac-bank-logo.webp',
  },
];

const CheckoutPage = () => {
  const navigate = useNavigate();
  const { cart, clearCart } = useCart();
  const { getAuthHeaders } = useAuth();
  
  const [step, setStep] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-DJ').format(price) + ' DJF';
  };

  const handlePayment = async () => {
    if (!paymentMethod) {
      toast.error('Veuillez choisir un mode de paiement');
      return;
    }

    setStep(2);
    setProcessing(true);

    try {
      // Simulate payment delay
      await new Promise(resolve => setTimeout(resolve, 2000));

      const response = await axios.post(
        `${API}/checkout`,
        { payment_method: paymentMethod },
        { headers: getAuthHeaders() }
      );

      setResult(response.data);
      setStep(3);
      toast.success('Paiement réussi !');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur de paiement');
      setStep(1);
    } finally {
      setProcessing(false);
    }
  };

  if (cart.items.length === 0 && !result) {
    navigate('/cart');
    return null;
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          {step < 3 && (
            <button
              onClick={() => step > 1 ? setStep(1) : navigate('/cart')}
              className="p-2 glass rounded-full"
              data-testid="back-btn"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <h1 className="font-unbounded font-bold text-2xl text-white">
            {step === 3 ? 'Paiement confirmé' : 'Paiement'}
          </h1>
        </div>

        {/* Step 1: Payment Method */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="font-unbounded font-semibold text-lg text-white">
              Choisissez votre mode de paiement
            </h2>
            
            <div className="grid gap-4">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method.id}
                  onClick={() => setPaymentMethod(method.id)}
                  className={`glass p-5 rounded-xl flex items-center gap-4 transition-all border
                    ${paymentMethod === method.id ? 'border-green-500 bg-green-500/10' : 'border-white/10 hover:border-white/20'}`}
                  data-testid={`payment-${method.id}`}
                >
                  <div 
                    className="w-16 h-16 rounded-xl flex items-center justify-center bg-white overflow-hidden p-2"
                  >
                    <img 
                      src={method.logo} 
                      alt={method.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="text-left flex-1">
                    <h3 className="font-unbounded font-bold text-white text-lg">{method.name}</h3>
                    <p className="text-gray-400 text-sm">{method.description}</p>
                  </div>
                  {paymentMethod === method.id && (
                    <CheckCircle className="text-green-400" size={24} />
                  )}
                </button>
              ))}
            </div>

            {/* Order Summary */}
            <div className="glass p-6 rounded-xl">
              <h3 className="font-unbounded font-semibold text-white mb-4">Récapitulatif</h3>
              {cart.items.map((item) => (
                <div key={item.event_id} className="flex justify-between py-2 border-b border-white/10">
                  <span className="text-gray-300">{item.quantity}× {item.event?.title}</span>
                  <span className="text-white font-mono">{formatPrice(item.subtotal)}</span>
                </div>
              ))}
              <div className="flex justify-between pt-4">
                <span className="font-unbounded font-bold text-white">Total</span>
                <span className="font-mono font-bold text-xl text-green-400">{formatPrice(cart.total)}</span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
              <Shield className="text-green-400 mt-0.5" size={20} />
              <p className="text-sm text-gray-300">
                Paiement sécurisé. Vos billets seront générés immédiatement après confirmation.
              </p>
            </div>

            <Button
              onClick={handlePayment}
              disabled={!paymentMethod}
              className="w-full h-14 text-lg bg-green-500 hover:bg-green-600 text-black"
              data-testid="confirm-payment-btn"
            >
              Payer {formatPrice(cart.total)}
            </Button>
          </div>
        )}

        {/* Step 2: Processing */}
        {step === 2 && (
          <div className="glass p-12 rounded-xl text-center animate-fade-in">
            <Loader2 className="w-16 h-16 mx-auto text-green-400 animate-spin mb-6" />
            <h2 className="font-unbounded font-bold text-2xl text-white mb-3">
              Traitement en cours...
            </h2>
            <p className="text-gray-400">
              Veuillez patienter pendant la validation de votre paiement
            </p>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && result && (
          <div className="space-y-6 animate-fade-in">
            <div className="glass p-12 rounded-xl text-center">
              <div className="w-20 h-20 rounded-full bg-green-500/20 mx-auto mb-6 flex items-center justify-center">
                <CheckCircle className="text-green-500" size={48} />
              </div>
              <h2 className="font-unbounded font-bold text-2xl text-white mb-3">
                Paiement réussi !
              </h2>
              <p className="text-gray-400 mb-6">
                Vos billets ont été générés avec succès
              </p>
              <div className="glass rounded-xl p-4 inline-block">
                <p className="text-sm text-gray-400">Montant payé</p>
                <p className="font-mono font-bold text-2xl text-green-400">
                  {formatPrice(result.total)}
                </p>
              </div>
            </div>

            <div className="glass p-6 rounded-xl">
              <h3 className="font-unbounded font-semibold text-white mb-4">Vos billets</h3>
              <div className="space-y-3">
                {result.tickets.map((ticket, index) => (
                  <button
                    key={ticket.id}
                    onClick={() => navigate(`/ticket/${ticket.id}`)}
                    className="w-full glass p-4 rounded-xl flex items-center justify-between hover:border-green-500/50 transition-colors border border-white/10"
                    data-testid={`view-ticket-${index}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <CreditCard className="text-green-400" size={20} />
                      </div>
                      <span className="text-white font-medium">{ticket.event_title}</span>
                    </div>
                    <span className="text-green-400">Voir →</span>
                  </button>
                ))}
              </div>
            </div>

            <Button
              onClick={() => navigate('/my-tickets')}
              className="w-full h-14 text-lg bg-green-500 hover:bg-green-600 text-black"
              data-testid="view-all-tickets-btn"
            >
              Voir tous mes billets
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckoutPage;
