import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Train, Calendar, Users, Plus, Minus, AlertCircle, CheckCircle, ArrowRight, User, Phone, CreditCard } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import Seo from '../components/Seo';
import { API_BASE } from '../lib/api';
import { absoluteUrl } from '../lib/seo';

const API = API_BASE;

const TrainBookingPage = () => {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  
  const [selectedDate, setSelectedDate] = useState('');
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tripInfo, setTripInfo] = useState(null);
  
  const [passengers, setPassengers] = useState([
    { full_name: '', phone: '', passport_or_cni: '' }
  ]);
  
  const [paymentMethod, setPaymentMethod] = useState('waafi');
  const [booking, setBooking] = useState(false);
  const [publicAnnouncements, setPublicAnnouncements] = useState([]);
  const [promoCode, setPromoCode] = useState('');
  const [promoDetails, setPromoDetails] = useState(null);
  const [validatingPromo, setValidatingPromo] = useState(false);

  // Get min date (today)
  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const fetchTrips = async (date) => {
    if (!date) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API}/train/trips?date=${date}`);
      setTripInfo(response.data);
      setTrips(response.data.trips || []);
      setPublicAnnouncements(response.data.announcements || (response.data.announcement ? [response.data.announcement] : []));
      setSelectedTrip(null);
    } catch (error) {
      console.error('Failed to fetch trips:', error);
      toast.error("Impossible de charger les départs pour le moment");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDate) {
      fetchTrips(selectedDate);
    }
  }, [selectedDate]);

  const addPassenger = () => {
    if (passengers.length < 10) {
      setPassengers([...passengers, { full_name: '', phone: '', passport_or_cni: '' }]);
    }
  };

  const removePassenger = (index) => {
    if (passengers.length > 1) {
      setPassengers(passengers.filter((_, i) => i !== index));
    }
  };

  const updatePassenger = (index, field, value) => {
    const updated = [...passengers];
    updated[index][field] = value;
    setPassengers(updated);
  };

  const calculateTotal = () => {
    if (!selectedTrip) return 0;
    return selectedTrip.price * passengers.length;
  };

  const calculatePromoDiscount = () => {
    if (!promoDetails) return 0;
    const total = calculateTotal();
    if (promoDetails.discount_type === 'percentage') {
      return Math.floor(total * promoDetails.discount_value / 100);
    }
    return Math.min(total, promoDetails.discount_value || 0);
  };

  const finalTotal = Math.max(0, calculateTotal() - calculatePromoDiscount());

  const validatePromoCode = async () => {
    if (!promoCode.trim()) {
      setPromoDetails(null);
      return;
    }

    setValidatingPromo(true);
    try {
      const response = await axios.get(
        `${API}/transport/promo-codes/${promoCode.trim().toUpperCase()}/validate?transport_type=train`
      );
      setPromoDetails(response.data);
      setPromoCode(response.data.code);
      toast.success('Code promo applique');
    } catch (error) {
      setPromoDetails(null);
      toast.error(error.response?.data?.detail || 'Code promo invalide');
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleBooking = async () => {
    if (!user) {
      toast.error('Veuillez vous connecter pour réserver');
      navigate('/auth');
      return;
    }

    // Validate passengers
    for (let i = 0; i < passengers.length; i++) {
      const p = passengers[i];
      if (!p.full_name || !p.phone || !p.passport_or_cni) {
        toast.error(`Veuillez remplir toutes les informations du voyageur ${i + 1}`);
        return;
      }
    }

    setBooking(true);
    try {
      const response = await axios.post(
        `${API}/train/book`,
        {
          date: selectedDate,
          departure: selectedTrip.departure,
          arrival: selectedTrip.arrival,
          passengers: passengers,
          payment_method: paymentMethod,
          promo_code: promoDetails?.code || null
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // Real payment gateway (WaafiPay): redirect to the hosted payment page.
      if (response.data?.requires_payment && response.data?.payment_url) {
        toast.info('Redirection vers WaafiPay...');
        window.location.href = response.data.payment_url;
        return;
      }

      toast.success('Réservation confirmée !');

      // Navigate to first ticket
      if (response.data.tickets && response.data.tickets.length > 0) {
        navigate(`/ticket/${response.data.tickets[0].id}`);
      } else {
        navigate('/my-tickets');
      }
    } catch (error) {
      console.error('Booking failed:', error);
      toast.error(error.response?.data?.detail || 'Erreur lors de la réservation');
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] py-8 px-4">
      <Seo
        title="Réservation Train Djibouti"
        description="Consultez les trajets ferroviaires et réservez votre billet de train depuis Djibouti sur la plateforme officielle D-Billet."
        path="/train"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: 'Réservation Train D-Billet',
          serviceType: 'Billetterie train',
          provider: {
            '@type': 'Organization',
            name: 'D-Billet',
            url: absoluteUrl('/'),
          },
          areaServed: {
            '@type': 'Country',
            name: 'Djibouti',
          },
          url: absoluteUrl('/train'),
        }}
      />
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-train/20 mb-4">
            <Train className="text-train" size={32} />
          </div>
          <h1 className="font-unbounded text-3xl font-bold text-white mb-2">
            Réservation Train
          </h1>
          <p className="text-gray-400">Service officiel de réservation train au départ de Djibouti</p>
        </div>

        {/* Date Selection */}
        <div className="glass p-6 rounded-2xl mb-6">
          <Label className="text-white mb-2 block">Sélectionnez votre date de voyage</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gold" size={20} />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={getMinDate()}
              className="input-date-gold pl-10 bg-white/5 border-white/10 text-white"
              data-testid="train-date-input"
            />
          </div>
        </div>

        {/* Trip Info */}
        {tripInfo && (
          <div className={`p-4 rounded-xl mb-6 ${tripInfo.is_holiday ? 'bg-red-500/20 border border-red-500/50' : 'bg-train/20 border border-train/50'}`}>
            {tripInfo.is_holiday ? (
              <div className="flex items-center gap-3">
                <AlertCircle className="text-red-400" size={24} />
                <div>
                  <p className="text-red-400 font-semibold">Service indisponible</p>
                  <p className="text-red-300 text-sm">{tripInfo.message}</p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <CheckCircle className="text-train" size={24} />
                <div>
                  <p className="text-train font-semibold">Direction du jour : {tripInfo.direction}</p>
                  <p className="text-yellow-200 text-sm">
                    {tripInfo.is_even_day ? "Jour pair - départs au départ de Nagad" : "Jour impair - départs au départ d'Ali-Sabieh"}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {publicAnnouncements.length > 0 && (
          <div className="space-y-3 mb-6">
            {publicAnnouncements.map((announcement) => (
              <div key={announcement.id} className="p-4 rounded-xl border border-yellow-500/40 bg-yellow-500/10">
                <p className="text-yellow-300 font-semibold">{announcement.title}</p>
                <p className="text-gray-300 text-sm mt-1">{announcement.message}</p>
                <p className="text-gray-500 text-xs mt-2">{announcement.travel_date || 'Annonce generale'}</p>
              </div>
            ))}
          </div>
        )}

        {/* Available Trips */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-train border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Chargement des départs disponibles...</p>
          </div>
        ) : trips.length > 0 ? (
          <div className="space-y-4 mb-8">
            <h2 className="font-unbounded text-xl text-white">Départs disponibles</h2>
            {trips.map((trip, index) => (
              <div
                key={index}
                onClick={() => setSelectedTrip(trip)}
                className={`glass p-5 rounded-xl cursor-pointer transition-all ${
                  selectedTrip === trip 
                    ? 'border-2 border-train neon-glow' 
                    : 'border border-white/10 hover:border-train/50'
                }`}
                data-testid={`train-trip-${index}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-white font-bold">{trip.departure}</p>
                      <p className="text-gray-400 text-sm">{trip.departure_time}</p>
                    </div>
                    <ArrowRight className="text-train" size={24} />
                    <div className="text-center">
                      <p className="text-white font-bold">{trip.arrival}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-train font-mono font-bold text-xl">{trip.price} DJF</p>
                    <p className="text-gray-400 text-sm">tarif par voyageur</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : selectedDate && !tripInfo?.is_holiday ? (
          <div className="text-center py-12 glass rounded-xl">
            <p className="text-gray-400">Aucun départ n'est disponible pour cette date.</p>
          </div>
        ) : null}

        {/* Passenger Form */}
        {selectedTrip && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="font-unbounded text-xl text-white flex items-center gap-2">
                <Users size={24} />
                Voyageurs ({passengers.length})
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={addPassenger}
                disabled={passengers.length >= 10}
                className="border-train text-train hover:bg-train/20"
              >
                <Plus size={16} className="mr-1" /> Ajouter
              </Button>
            </div>

            {passengers.map((passenger, index) => (
              <div key={index} className="glass p-5 rounded-xl">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-white font-semibold">Voyageur {index + 1}</span>
                  {passengers.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removePassenger(index)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                    >
                      <Minus size={16} />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-gray-400 mb-1 block">
                      <User size={14} className="inline mr-1" />
                      Nom complet
                    </Label>
                    <Input
                      value={passenger.full_name}
                      onChange={(e) => updatePassenger(index, 'full_name', e.target.value)}
                      placeholder="Mohamed Ali"
                      className="bg-white/5 border-white/10 text-white"
                      data-testid={`passenger-${index}-name`}
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400 mb-1 block">
                      <Phone size={14} className="inline mr-1" />
                      Téléphone
                    </Label>
                    <Input
                      value={passenger.phone}
                      onChange={(e) => updatePassenger(index, 'phone', e.target.value)}
                      placeholder="+253 77 XX XX XX"
                      className="bg-white/5 border-white/10 text-white"
                      data-testid={`passenger-${index}-phone`}
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400 mb-1 block">
                      <CreditCard size={14} className="inline mr-1" />
                      Pièce d'identité
                    </Label>
                    <Input
                      value={passenger.passport_or_cni}
                      onChange={(e) => updatePassenger(index, 'passport_or_cni', e.target.value)}
                      placeholder="Numéro de document"
                      className="bg-white/5 border-white/10 text-white"
                      data-testid={`passenger-${index}-id`}
                    />
                  </div>
                </div>
              </div>
            ))}

            {/* Payment Method */}
            <div className="glass p-5 rounded-xl">
              <div className="mb-5">
                <Label className="text-gray-400 mb-2 block">Code promo (optionnel)</Label>
                <div className="flex flex-col md:flex-row gap-3">
                  <Input
                    value={promoCode}
                    onChange={(e) => {
                      setPromoCode(e.target.value.toUpperCase());
                      setPromoDetails(null);
                    }}
                    placeholder="TRAIN10"
                    className="bg-white/5 border-white/10 text-white font-mono uppercase"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={validatePromoCode}
                    disabled={validatingPromo}
                    className="border-train text-train hover:bg-train/20"
                  >
                    {validatingPromo ? 'Verification...' : 'Appliquer'}
                  </Button>
                </div>
                {promoDetails && (
                  <p className="text-green-400 text-sm mt-2">
                    Code {promoDetails.code} actif: {promoDetails.discount_type === 'percentage'
                      ? `-${promoDetails.discount_value}%`
                      : `-${promoDetails.discount_value} DJF`}
                  </p>
                )}
              </div>

              <h3 className="text-white font-semibold mb-4">Sélectionnez votre moyen de paiement</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { id: 'waafi', name: 'Waafi', logo: '/images/waafi-logo.png' },
                  { id: 'dmoney', name: 'D-Money', logo: '/images/dmoney-logo.png' },
                  { id: 'cacbank', name: 'CAC Bank', logo: '/images/cac-bank-logo.webp' }
                ].map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-2 ${
                      paymentMethod === method.id
                        ? 'border-train bg-train/20'
                        : 'border-white/10 bg-white/5 hover:border-train/50'
                    }`}
                    data-testid={`payment-${method.id}`}
                  >
                    <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center p-1.5 overflow-hidden">
                      <img src={method.logo} alt={method.name} className="w-full h-full object-contain" />
                    </div>
                    <span className="text-white font-semibold text-xs">
                      {method.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Total & Book Button */}
            <div className="glass p-5 rounded-xl">
              <div className="space-y-2 mb-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Sous-total ({passengers.length} voyageur{passengers.length > 1 ? 's' : ''})</span>
                  <span className="text-white font-mono font-bold">{calculateTotal()} DJF</span>
                </div>
                {promoDetails && (
                  <div className="flex items-center justify-between text-green-400">
                    <span>Reduction ({promoDetails.code})</span>
                    <span>-{calculatePromoDiscount()} DJF</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-t border-white/10 pt-2">
                  <span className="text-gray-300">Total a payer</span>
                  <span className="text-train font-mono font-bold text-2xl">{finalTotal} DJF</span>
                </div>
              </div>
              <Button
                onClick={handleBooking}
                disabled={booking}
                className="w-full bg-train hover:bg-train/90 text-black font-bold py-6 text-lg"
                data-testid="train-book-button"
              >
                {booking ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin w-5 h-5 border-2 border-black border-t-transparent rounded-full"></div>
                    Réservation en cours...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Train size={20} />
                    Valider ma réservation
                  </span>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 glass p-5 rounded-xl border border-train/30">
          <h3 className="text-train font-semibold mb-3">Avant votre départ</h3>
          <ul className="text-gray-400 text-sm space-y-2">
            <li>• <strong className="text-white">Jours pairs :</strong> départs de Nagad vers l'Est (Holl-Holl, Ali-Sabieh, Dire-Dawa)</li>
            <li>• <strong className="text-white">Jours impairs :</strong> départs d'Ali-Sabieh vers l'Ouest (Holl-Holl, Nagad)</li>
            <li>• <strong className="text-white">1er du mois :</strong> jour férié, service indisponible</li>
            <li>• Présentez votre billet avec QR code et votre pièce d'identité lors de l'embarquement</li>
          </ul>
        </div>

        <section className="mt-8 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
          <div className="glass p-6 rounded-2xl">
            <h2 className="font-unbounded text-2xl text-white mb-4">Voyagez en train avec D-BILLET</h2>
            <div className="space-y-4 text-gray-300 leading-7">
              <p>
                D-BILLET centralise les informations utiles pour réserver votre billet de train depuis Djibouti,
                consulter le sens de circulation du jour et préparer votre départ en toute sérénité.
              </p>
              <p>
                La circulation alterne selon le jour du mois. Vous visualisez rapidement la direction du service,
                les étapes du trajet et le tarif applicable avant de confirmer
                votre réservation.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
            <div className="glass p-5 rounded-2xl">
              <p className="text-xs uppercase tracking-[0.18em] text-train mb-2">SERVICE</p>
              <h3 className="font-unbounded text-white text-lg mb-2">Direction du service</h3>
              <p className="text-gray-400 text-sm leading-6">
                La page affiche clairement le sens de circulation du train à partir de la date choisie, avec
                un départ et une arrivée faciles à identifier.
              </p>
            </div>
            <div className="glass p-5 rounded-2xl">
              <p className="text-xs uppercase tracking-[0.18em] text-train mb-2">RÉSERVATION</p>
              <h3 className="font-unbounded text-white text-lg mb-2">Billet immédiat</h3>
              <p className="text-gray-400 text-sm leading-6">
                Le voyageur renseigne ses informations, choisit son mode de paiement puis reçoit son billet
                numérique avec QR code après confirmation.
              </p>
            </div>
            <div className="glass p-5 rounded-2xl">
              <p className="text-xs uppercase tracking-[0.18em] text-train mb-2">EMBARQUEMENT</p>
              <h3 className="font-unbounded text-white text-lg mb-2">Contrôle rapide</h3>
              <p className="text-gray-400 text-sm leading-6">
                Le QR code du billet et une pièce d'identité facilitent l'accès à
                l'embarquement le jour du départ.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default TrainBookingPage;

