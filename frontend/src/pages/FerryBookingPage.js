import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Ship, Calendar, Users, Plus, Minus, AlertCircle, CheckCircle, ArrowRight, User, Phone, CreditCard, Anchor, MapPin, X as XIcon, Car, Info, Baby } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';
import Seo from '../components/Seo';
import { API_BASE, isPrerender } from '../lib/api';
import { loadPrerenderFerrySchedule } from '../lib/prerender';
import { absoluteUrl } from '../lib/seo';

const API = API_BASE;

const FerryBookingPage = () => {
  const { user, token, createGuestSession } = useAuth();
  const navigate = useNavigate();
  
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedDestination, setSelectedDestination] = useState('');
  const [trips, setTrips] = useState([]);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tripInfo, setTripInfo] = useState(null);
  
  // Schedule and pricing
  const [weeklySchedule, setWeeklySchedule] = useState([]);
  const [passengerPrice, setPassengerPrice] = useState(1100);
  const [childFreeAge, setChildFreeAge] = useState(10);
  const [vehicleTypes, setVehicleTypes] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  
  // Passengers
  const [passengers, setPassengers] = useState([
    { full_name: '', phone: '', passport_or_cni: '', age: null }
  ]);
  
  // Vehicles
  const [vehicles, setVehicles] = useState([]);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  
  // Guest checkout
  const [isGuestCheckout, setIsGuestCheckout] = useState(false);
  const [guestPhone, setGuestPhone] = useState('');
  const [guestName, setGuestName] = useState('');
  
  const [paymentMethod, setPaymentMethod] = useState('waafi');
  const [booking, setBooking] = useState(false);
  const [publicAnnouncements, setPublicAnnouncements] = useState([]);
  const [promoCode, setPromoCode] = useState('');
  const [promoDetails, setPromoDetails] = useState(null);
  const [validatingPromo, setValidatingPromo] = useState(false);

  useEffect(() => {
    fetchWeeklySchedule();
  }, []);

  const fetchWeeklySchedule = async () => {
    try {
      const scheduleData = isPrerender
        ? await loadPrerenderFerrySchedule()
        : (await axios.get(`${API}/ferry/schedule`)).data;

      setWeeklySchedule(scheduleData.schedule || []);
      setPassengerPrice(scheduleData.passenger_price || 1100);
      setChildFreeAge(scheduleData.child_free_age || 10);
      setVehicleTypes(scheduleData.vehicle_types || []);
    } catch (error) {
      console.error('Failed to fetch schedule:', error);
    } finally {
      setLoadingSchedule(false);
    }
  };

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const fetchTrips = async (date, destination = '') => {
    if (!date) return;
    setLoading(true);
    try {
      let url = `${API}/ferry/trips?date=${date}`;
      if (destination) url += `&destination=${destination}`;
      const response = await axios.get(url);
      setTripInfo(response.data);
      setTrips(response.data.trips || []);
      setPublicAnnouncements(response.data.announcements || (response.data.announcement ? [response.data.announcement] : []));
      setSelectedTrip(null);
      if (response.data.vehicle_types) {
        setVehicleTypes(response.data.vehicle_types);
      }
    } catch (error) {
      console.error('Failed to fetch trips:', error);
      toast.error("Impossible de charger les traversées pour le moment");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedDate) {
      fetchTrips(selectedDate, selectedDestination);
    }
  }, [selectedDate, selectedDestination]);

  // Passenger management
  const addPassenger = () => {
    if (passengers.length < 10) {
      setPassengers([...passengers, { full_name: '', phone: '', passport_or_cni: '', age: null }]);
    }
  };

  const removePassenger = (index) => {
    if (passengers.length > 1) {
      setPassengers(passengers.filter((_, i) => i !== index));
    }
  };

  const updatePassenger = (index, field, value) => {
    const updated = [...passengers];
    updated[index][field] = field === 'age' ? (value ? parseInt(value) : null) : value;
    setPassengers(updated);
  };

  // Vehicle management
  const addVehicle = () => {
    setVehicles([...vehicles, { vehicle_type: '', plate_number: '', passenger_names: [] }]);
    setShowVehicleForm(true);
  };

  const removeVehicle = (index) => {
    setVehicles(vehicles.filter((_, i) => i !== index));
  };

  const updateVehicle = (index, field, value) => {
    const updated = [...vehicles];
    updated[index][field] = value;
    setVehicles(updated);
  };

  // Calculate totals
  const calculatePassengerTotal = () => {
    if (!selectedTrip) return 0;
    return passengers.reduce((total, p) => {
      if (p.age && p.age < childFreeAge) return total; // Free for children
      return total + passengerPrice;
    }, 0);
  };

  const calculateVehicleTotal = () => {
    return vehicles.reduce((total, v) => {
      const vt = vehicleTypes.find(t => t.type === v.vehicle_type);
      return total + (vt?.price || 0);
    }, 0);
  };

  const calculateTotal = () => {
    return calculatePassengerTotal() + calculateVehicleTotal();
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
        `${API}/transport/promo-codes/${promoCode.trim().toUpperCase()}/validate?transport_type=ferry`
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
    let authToken = token;
    
    // Handle guest checkout
    if (!user && isGuestCheckout) {
      if (!guestPhone || !guestName) {
        toast.error('Veuillez entrer votre nom et numéro de téléphone');
        return;
      }
      try {
        const guestData = await createGuestSession(guestPhone, guestName);
        authToken = guestData.token;
      } catch (error) {
        toast.error('Erreur lors de la création de session');
        return;
      }
    } else if (!user) {
      toast.error('Veuillez vous connecter ou continuer en tant qu\'invité');
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

    // Validate vehicles
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      if (!v.vehicle_type || !v.plate_number) {
        toast.error(`Veuillez remplir les informations du véhicule ${i + 1}`);
        return;
      }
    }

    setBooking(true);
    try {
      const response = await axios.post(
        `${API}/ferry/book`,
        {
          date: selectedDate,
          destination: selectedTrip.destination || selectedTrip.arrival,
          trip_type: selectedTrip.trip_type,
          passengers: passengers,
          vehicles: vehicles,
          payment_method: paymentMethod
          ,
          promo_code: promoDetails?.code || null
        },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      // Real payment gateway (WaafiPay): redirect to the hosted payment page.
      if (response.data?.requires_payment && response.data?.payment_url) {
        toast.info('Redirection vers WaafiPay...');
        window.location.href = response.data.payment_url;
        return;
      }

      toast.success('Réservation confirmée !');

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

  const getDayName = (dateStr) => {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const date = new Date(dateStr);
    return days[date.getDay()];
  };

  // Get unique destinations for the selected date
  const getAvailableDESTINATIONS = () => {
    const destinations = new Set();
    trips.forEach(trip => {
      if (trip.destination) destinations.add(trip.destination);
      else if (trip.arrival && trip.arrival !== 'Djibouti') destinations.add(trip.arrival);
    });
    return Array.from(destinations);
  };

  return (
    <div className="min-h-screen bg-[#050505] py-8 px-4">
      <Seo
        title="Réservation Ferry Djibouti"
        description="Réservez votre ferry Djibouti, Tadjoura et Obock en ligne sur la plateforme officielle D-Billet. Horaires, tarifs et disponibilités."
        path="/ferry"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: 'Réservation Ferry D-Billet',
          serviceType: 'Billetterie ferry',
          provider: {
            '@type': 'Organization',
            name: 'D-Billet',
            url: absoluteUrl('/'),
          },
          areaServed: {
            '@type': 'Country',
            name: 'Djibouti',
          },
          url: absoluteUrl('/ferry'),
        }}
      />
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-ferry/20 mb-4">
            <Ship className="text-ferry" size={32} />
          </div>
          <h1 className="font-unbounded text-3xl font-bold text-white mb-2">
            Réservation Ferry
          </h1>
          <p className="text-gray-400">Service officiel de réservation ferry au départ de Djibouti</p>
        </div>

        {/* Price Info Banner */}
        <div className="glass p-4 rounded-xl mb-6 border border-ferry/30">
          <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <User size={16} className="text-ferry" />
              <span className="text-white">Voyageur adulte : <strong className="text-ferry">{passengerPrice} FDJ</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <Baby size={16} className="text-green-400" />
              <span className="text-white">Enfant &lt;{childFreeAge} ans: <strong className="text-green-400">Gratuit</strong></span>
            </div>
          </div>
        </div>

        {/* Date Selection */}
        <div className="glass p-6 rounded-2xl mb-6">
          <Label className="text-white mb-2 block">Choisissez votre date de traversée</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gold" size={20} />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              min={getMinDate()}
              className="input-date-gold pl-10 bg-white/5 border-white/10 text-white"
              data-testid="ferry-date-input"
            />
          </div>
          {selectedDate && (
            <p className="text-gray-400 text-sm mt-2">{getDayName(selectedDate)}</p>
          )}
        </div>

        {/* Trip Info with Capacity */}
        {tripInfo && (
          <div className={`p-4 rounded-xl mb-6 ${!tripInfo.has_service ? 'bg-red-500/20 border border-red-500/50' : 'bg-ferry/20 border border-ferry/50'}`}>
            {!tripInfo.has_service ? (
              <div className="flex items-center gap-3">
                <AlertCircle className="text-red-400" size={24} />
                <div>
                  <p className="text-red-400 font-semibold">Traversée indisponible</p>
                  <p className="text-red-300 text-sm">{tripInfo.message}</p>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle className="text-ferry" size={24} />
                  <div>
                    <p className="text-ferry font-semibold">{tripInfo.day} - Traversée disponible</p>
                  </div>
                </div>
                {tripInfo.capacity && (
                  <div className="flex flex-wrap gap-4 mt-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Users size={16} className="text-white" />
                      <span className="text-gray-300">Places passagers : <strong className="text-white">{tripInfo.capacity.passengers_remaining}</strong>/{tripInfo.capacity.max_passengers}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Car size={16} className="text-white" />
                      <span className="text-gray-300">Places véhicules : <strong className="text-white">{tripInfo.capacity.vehicles_remaining}</strong>/{tripInfo.capacity.max_vehicles}</span>
                    </div>
                  </div>
                )}
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
                <p className="text-gray-500 text-xs mt-2">
                  {announcement.travel_date || 'Annonce generale'}
                  {announcement.destination ? ` • ${announcement.destination}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Available Trips */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-ferry border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-400">Chargement des traversées disponibles...</p>
          </div>
        ) : trips.length > 0 ? (
          <div className="space-y-4 mb-8">
            <h2 className="font-unbounded text-xl text-white">Traversées disponibles</h2>
            {trips.map((trip, index) => (
              <div
                key={index}
                onClick={() => setSelectedTrip(trip)}
                className={`glass p-5 rounded-xl cursor-pointer transition-all ${
                  selectedTrip === trip 
                    ? 'border-2 border-ferry neon-glow-green' 
                    : 'border border-white/10 hover:border-ferry/50'
                }`}
                data-testid={`ferry-trip-${index}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-center">
                      <p className="text-white font-bold">{trip.departure}</p>
                      <p className="text-gray-400 text-sm">{trip.departure_time}</p>
                    </div>
                    <div className="flex flex-col items-center">
                      <ArrowRight className="text-ferry" size={24} />
                      <span className="text-xs text-ferry uppercase">{trip.trip_type}</span>
                    </div>
                    <div className="text-center">
                      <p className="text-white font-bold">{trip.arrival}</p>
                      {trip.destination && <p className="text-ferry text-xs">{trip.destination}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-ferry font-mono font-bold text-xl">{trip.price} FDJ</p>
                    <p className="text-gray-400 text-sm">tarif par adulte</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : selectedDate && tripInfo?.has_service ? (
          <div className="text-center py-12 glass rounded-xl">
            <p className="text-gray-400">Aucune traversée n'est disponible pour cette date.</p>
          </div>
        ) : null}

        {/* Booking Form */}
        {selectedTrip && (
          <div className="space-y-6">
            {/* Guest Checkout Option */}
            {!user && (
              <div className="glass p-5 rounded-xl border border-yellow-500/30 bg-yellow-500/10">
                <div className="flex items-start gap-3">
                  <Info className="text-yellow-400 mt-1" size={20} />
                  <div className="flex-1">
                    <p className="text-white font-semibold mb-2">Continuer sans compte</p>
                    <p className="text-gray-400 text-sm mb-4">Renseignez vos coordonnées pour recevoir votre billet numérique en toute simplicité.</p>
                    
                    <div className="flex items-center gap-3 mb-4">
                      <Button
                        variant={isGuestCheckout ? "default" : "outline"}
                        onClick={() => setIsGuestCheckout(true)}
                        className={isGuestCheckout ? "bg-ferry text-black" : "border-white/20 text-white"}
                        size="sm"
                      >
                        Continuer en invité
                      </Button>
                      <Button
                        variant={!isGuestCheckout ? "default" : "outline"}
                        onClick={() => navigate('/auth')}
                        className={!isGuestCheckout ? "bg-green-500 text-black" : "border-white/20 text-white"}
                        size="sm"
                      >
                        Se connecter
                      </Button>
                    </div>

                    {isGuestCheckout && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-gray-400 mb-1 block">Votre nom</Label>
                          <Input
                            value={guestName}
                            onChange={(e) => setGuestName(e.target.value)}
                            placeholder="Mohamed Ali"
                            className="bg-white/5 border-white/10 text-white"
                          />
                        </div>
                        <div>
                          <Label className="text-gray-400 mb-1 block">Votre téléphone</Label>
                          <Input
                            value={guestPhone}
                            onChange={(e) => setGuestPhone(e.target.value)}
                            placeholder="+253 77 XX XX XX"
                            className="bg-white/5 border-white/10 text-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Passengers */}
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
                className="border-ferry text-ferry hover:bg-ferry/20"
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
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400 mb-1 block">
                      <Baby size={14} className="inline mr-1" />
                      Âge (optionnel)
                    </Label>
                    <Input
                      type="number"
                      value={passenger.age || ''}
                      onChange={(e) => updatePassenger(index, 'age', e.target.value)}
                      placeholder="Age"
                      min="0"
                      max="120"
                      className="bg-white/5 border-white/10 text-white"
                    />
                    {passenger.age && passenger.age < childFreeAge && (
                      <p className="text-green-400 text-xs mt-1">Billet offert (enfant)</p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Vehicles Section */}
            <div className="flex items-center justify-between">
              <h2 className="font-unbounded text-xl text-white flex items-center gap-2">
                <Car size={24} />
                Véhicules ({vehicles.length})
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={addVehicle}
                className="border-ferry text-ferry hover:bg-ferry/20"
              >
                <Plus size={16} className="mr-1" /> Ajouter un véhicule
              </Button>
            </div>

            {vehicles.length === 0 ? (
              <div className="glass p-4 rounded-xl text-center text-gray-400">
                <Car size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">Aucun véhicule ajouté</p>
                <p className="text-xs text-gray-500">Ajoutez un véhicule uniquement si vous voyagez avec un véhicule à bord.</p>
              </div>
            ) : (
              vehicles.map((vehicle, index) => (
                <div key={index} className="glass p-5 rounded-xl">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white font-semibold">Véhicule {index + 1}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeVehicle(index)}
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                    >
                      <Minus size={16} />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-400 mb-1 block">Type de véhicule</Label>
                      <select
                        value={vehicle.vehicle_type}
                        onChange={(e) => updateVehicle(index, 'vehicle_type', e.target.value)}
                        className="w-full bg-white/5 border border-white/10 text-white rounded-md p-2"
                      >
                        <option value="">Sélectionnez un type</option>
                        {vehicleTypes.map((vt) => (
                          <option key={vt.type} value={vt.type}>
                            {vt.name} {vt.price > 0 ? `- ${vt.price} FDJ` : '(Tarif à confirmer)'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-gray-400 mb-1 block">Immatriculation</Label>
                      <Input
                        value={vehicle.plate_number}
                        onChange={(e) => updateVehicle(index, 'plate_number', e.target.value)}
                        placeholder="XX 1234 DJ"
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                  </div>
                </div>
              ))
            )}

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
                    placeholder="FERRY10"
                    className="bg-white/5 border-white/10 text-white font-mono uppercase"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={validatePromoCode}
                    disabled={validatingPromo}
                    className="border-ferry text-ferry hover:bg-ferry/20"
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
                  { id: 'waafi', name: 'WaafiPay', hint: 'Sécurisé', logo: '/images/waafi-logo.png' },
                  { id: 'dmoney', name: 'D-Money', logo: '/images/dmoney-logo.png' },
                  { id: 'cacbank', name: 'CAC Bank', logo: '/images/cac-bank-logo.webp' }
                ].map((method) => (
                  <button
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`p-3 rounded-xl border transition-all flex flex-col items-center gap-1 ${
                      paymentMethod === method.id
                        ? 'border-ferry bg-ferry/20'
                        : 'border-white/10 bg-white/5 hover:border-ferry/50'
                    }`}
                  >
                    <div className="w-12 h-12 rounded-lg bg-white flex items-center justify-center p-1.5 overflow-hidden">
                      <img src={method.logo} alt={method.name} className="w-full h-full object-contain" />
                    </div>
                    <span className="text-white font-semibold text-xs">{method.name}</span>
                    {method.hint && (
                      <span className="text-[9px] font-medium text-green-400">{method.hint}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Total & Book */}
            <div className="glass p-5 rounded-xl">
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-gray-400">
                  <span>Voyageurs ({passengers.filter(p => !p.age || p.age >= childFreeAge).length} adultes)</span>
                  <span>{calculatePassengerTotal()} FDJ</span>
                </div>
                {passengers.some(p => p.age && p.age < childFreeAge) && (
                  <div className="flex justify-between text-green-400">
                    <span>Enfants gratuits ({passengers.filter(p => p.age && p.age < childFreeAge).length})</span>
                    <span>0 FDJ</span>
                  </div>
                )}
                {vehicles.length > 0 && (
                  <div className="flex justify-between text-gray-400">
                    <span>Véhicules ({vehicles.length})</span>
                    <span>{calculateVehicleTotal()} FDJ</span>
                  </div>
                )}
                {promoDetails && (
                  <div className="flex justify-between text-green-400">
                    <span>Reduction ({promoDetails.code})</span>
                    <span>-{calculatePromoDiscount()} FDJ</span>
                  </div>
                )}
                <div className="border-t border-white/10 pt-2 flex justify-between">
                  <span className="text-white font-semibold">Total</span>
                  <span className="text-ferry font-mono font-bold text-2xl">{finalTotal} FDJ</span>
                </div>
              </div>
              <Button
                onClick={handleBooking}
                disabled={booking || (!user && !isGuestCheckout)}
                className="w-full bg-ferry hover:bg-ferry/90 text-black font-bold py-6 text-lg"
                data-testid="ferry-book-button"
              >
                {booking ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin w-5 h-5 border-2 border-black border-t-transparent rounded-full"></div>
                    Réservation en cours...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Anchor size={20} />
                    Valider ma réservation
                  </span>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Weekly Schedule */}
        <div className="mt-8 glass p-6 rounded-2xl border border-ferry/30">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-ferry/20 flex items-center justify-center">
              <Calendar className="text-ferry" size={20} />
            </div>
            <div>
              <h3 className="text-ferry font-semibold text-lg">Planning hebdomadaire</h3>
              <p className="text-gray-500 text-sm">Horaires officiels et destinations disponibles</p>
            </div>
          </div>
          
          {loadingSchedule ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-6 h-6 border-2 border-ferry border-t-transparent rounded-full"></div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-2 text-gray-400">Jour</th>
                    <th className="text-left py-2 text-gray-400">Destination</th>
                    <th className="text-center py-2 text-gray-400">Départ</th>
                    <th className="text-center py-2 text-gray-400">Retour</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklySchedule.map((day) => (
                    day.routes && day.routes.length > 0 ? (
                      // Multiple routes for this day
                      day.routes.map((route, idx) => (
                        <tr key={`${day.day}-${idx}`} className="border-b border-white/5">
                          <td className={`py-3 font-medium text-white ${idx > 0 ? 'pt-0' : ''}`}>
                            {idx === 0 ? day.day_label : ''}
                          </td>
                          <td className="py-3">
                            <span className="text-ferry">{route.destination}</span>
                          </td>
                          <td className="py-3 text-center text-gray-300">{route.departure_time}</td>
                          <td className="py-3 text-center text-gray-300">{route.return_time}</td>
                        </tr>
                      ))
                    ) : (
                      // Single route or closed day
                      <tr key={day.day} className="border-b border-white/5">
                        <td className={`py-3 font-medium ${day.active ? 'text-white' : 'text-gray-500'}`}>
                          {day.day_label}
                        </td>
                        <td className="py-3">
                          {day.active ? (
                            <span className="text-ferry">{day.destination}</span>
                          ) : (
                            <span className="text-red-400 flex items-center gap-1">
                              <XIcon size={14} /> Fermé
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-center text-gray-300">
                          {day.active ? day.departure_time : '-'}
                        </td>
                        <td className="py-3 text-center text-gray-300">
                          {day.active ? day.return_time : '-'}
                        </td>
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Rules */}
          <div className="mt-4 pt-4 border-t border-white/10 text-xs text-gray-500 space-y-1">
            <p>- Présentez-vous <strong>1 heure avant le départ</strong> à l'escale</p>
            <p>- Les tickets ne sont <strong>ni remboursables ni échangeables</strong></p>
            <p>- Enfants de moins de {childFreeAge} ans : <strong className="text-green-400">Gratuit</strong> (accompagnés d'un adulte)</p>
          </div>
        </div>

        <section className="mt-8 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-6">
          <div className="glass p-6 rounded-2xl">
            <h2 className="font-unbounded text-2xl text-white mb-4">Voyagez en ferry avec D-BILLET</h2>
            <div className="space-y-4 text-gray-300 leading-7">
              <p>
                D-BILLET rassemble les informations essentielles pour réserver votre billet ferry au départ de
                Djibouti, consulter le planning hebdomadaire et préparer votre traversée vers Tadjoura ou Obock.
              </p>
              <p>
                Le service affiche les horaires, les capacités passagers, les véhicules acceptés et les tarifs
                avant validation, afin de réserver dans un cadre clair, fiable et adapté aux familles.
                
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4">
            <div className="glass p-5 rounded-2xl">
              <p className="text-xs uppercase tracking-[0.18em] text-ferry mb-2">DESTINATIONS</p>
              <h3 className="font-unbounded text-white text-lg mb-2">Rotations hebdomadaires</h3>
              <p className="text-gray-400 text-sm leading-6">
                Le planning vous permet d'identifier rapidement les jours de service et les rotations
                disponibles selon la destination choisie.
              </p>
            </div>
            <div className="glass p-5 rounded-2xl">
              <p className="text-xs uppercase tracking-[0.18em] text-ferry mb-2">RÉSERVATION</p>
              <h3 className="font-unbounded text-white text-lg mb-2">Passagers et véhicules</h3>
              <p className="text-gray-400 text-sm leading-6">
                La réservation peut inclure les passagers, les véhicules et les informations d'identité
                utiles au contrôle avant l'embarquement.
              </p>
            </div>
            <div className="glass p-5 rounded-2xl">
              <p className="text-xs uppercase tracking-[0.18em] text-ferry mb-2">EMBARQUEMENT</p>
              <h3 className="font-unbounded text-white text-lg mb-2">Arrivée à l'escale</h3>
              <p className="text-gray-400 text-sm leading-6">
                Les voyageurs sont invités à se présenter en avance avec leur billet numérique afin de
                faciliter l'accès à bord.
              </p>
            </div>
          </div>
        </section>

        {/* Contact Info */}
        <div className="mt-6 text-center text-gray-500 text-sm">
          <p>Notre équipe vous accompagne pour vos traversées et réservations :</p>
          <p className="text-ferry font-medium">+253 77 69 48 12 | contact@d-billet.com</p>
        </div>
      </div>
    </div>
  );
};

export default FerryBookingPage;

