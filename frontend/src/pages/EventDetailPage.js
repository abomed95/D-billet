import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Calendar, Clock, MapPin, Users, Minus, Plus, ShoppingCart, ArrowLeft, Ticket, AlertTriangle, Tag, Check } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Skeleton } from '../components/ui/skeleton';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { toast } from 'sonner';
import Seo from '../components/Seo';
import { API_BASE, isPrerender } from '../lib/api';
import { loadPrerenderEventData } from '../lib/prerender';
import { absoluteUrl, slugify } from '../lib/seo';

const API = API_BASE;

const CATEGORY_COLORS = {
  cinema: '#FF0055',
  football: '#00FF94',
  concerts: '#7000FF',
  conferences: '#FF5C00',
};

const EventDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { addToCart } = useCart();
  
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTicketType, setSelectedTicketType] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const [promoCode, setPromoCode] = useState('');
  const [promoValid, setPromoValid] = useState(null);

  const fetchEvent = useCallback(async () => {
    try {
      const eventData = isPrerender
        ? await loadPrerenderEventData(id)
        : (await axios.get(`${API}/events/${id}`)).data;

      setEvent(eventData);
      // Select first available ticket type
      const availableTypes = eventData.ticket_types?.filter(
        (tt) => tt.quantity - (tt.sold || 0) > 0
      );
      if (availableTypes?.length > 0) {
        setSelectedTicketType(availableTypes[0]);
      }
    } catch (error) {
      console.error('Failed to fetch event:', error);
      toast.error('Événement non trouvé');
      navigate('/');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-DJ').format(price) + ' DJF';
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'long',
      year: 'numeric'
    });
  };

  const validatePromoCode = async () => {
    if (!promoCode.trim()) return;
    
    try {
      const response = await axios.get(`${API}/promo-codes/${promoCode}/validate?event_id=${id}`);
      setPromoValid(response.data);
      toast.success(`Code promo valide! -${response.data.discount_value}${response.data.discount_type === 'percentage' ? '%' : ' DJF'}`);
    } catch (error) {
      setPromoValid(null);
      toast.error(error.response?.data?.detail || 'Code promo invalide');
    }
  };

  const calculateTotal = () => {
    if (!selectedTicketType) return 0;
    let total = selectedTicketType.price * quantity;
    
    if (promoValid) {
      if (promoValid.discount_type === 'percentage') {
        total = total - (total * promoValid.discount_value / 100);
      } else {
        total = Math.max(0, total - promoValid.discount_value);
      }
    }
    
    return Math.round(total);
  };

  const handleAddToCart = async () => {
    if (!user) {
      toast.error('Veuillez vous connecter');
      navigate('/auth');
      return;
    }

    if (!selectedTicketType) {
      toast.error('Veuillez sélectionner un type de billet');
      return;
    }

    const available = selectedTicketType.quantity - (selectedTicketType.sold || 0);
    if (quantity > available) {
      toast.error('Pas assez de places disponibles');
      return;
    }

    setAdding(true);
    try {
      await addToCart(event.id, selectedTicketType.id, quantity, promoValid?.code);
      toast.success(`${quantity} billet(s) ${selectedTicketType.name} ajouté(s)`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    } finally {
      setAdding(false);
    }
  };

  const handleBuyNow = async () => {
    if (!user) {
      toast.error('Veuillez vous connecter');
      navigate('/auth');
      return;
    }

    setAdding(true);
    try {
      await addToCart(event.id, selectedTicketType.id, quantity, promoValid?.code);
      navigate('/cart');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    } finally {
      setAdding(false);
    }
  };

  const eventSlug = event ? (event.slug || slugify(event.title)) : '';
  const canonicalPath = event ? `/events/${event.id}/${eventSlug}` : location.pathname;

  useEffect(() => {
    if (!event) {
      return;
    }

    const currentPath = location.pathname.replace(/\/+$/, '');
    const desiredPath = canonicalPath.replace(/\/+$/, '');
    if (currentPath !== desiredPath) {
      navigate(desiredPath, { replace: true });
    }
  }, [canonicalPath, event, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen">
        <Skeleton className="h-[50vh] w-full" />
        <div className="max-w-4xl mx-auto p-6 space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!event) return null;

  const categoryColor = CATEGORY_COLORS[event.category] || '#7000FF';
  const eventDateTime = event.time ? `${event.date}T${event.time}` : event.date;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description,
    startDate: eventDateTime,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    image: [event.image_url || absoluteUrl('/images/dbillet-logo.png')],
    location: {
      '@type': 'Place',
      name: event.venue || 'Djibouti',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Djibouti',
        addressCountry: 'DJ',
      },
    },
    organizer: {
      '@type': 'Organization',
      name: 'D-Billet',
      url: absoluteUrl('/'),
    },
    offers: (event.ticket_types || []).map((ticketType) => ({
      '@type': 'Offer',
      priceCurrency: 'DJF',
      price: ticketType.price,
      availability:
        (ticketType.quantity - (ticketType.sold || 0)) > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/SoldOut',
      url: absoluteUrl(canonicalPath),
      category: ticketType.name,
    })),
  };

  return (
    <div className="min-h-screen pb-40">
      <Seo
        title={`${event.title} a Djibouti`}
        description={event.description || `Reservez vos billets pour ${event.title} sur D-Billet.`}
        path={canonicalPath}
        image={event.image_url || '/images/dbillet-logo.png'}
        type="event"
        structuredData={structuredData}
      />
      {/* Hero Image */}
      <div className="relative h-[50vh] md:h-[60vh]">
        <img
          src={event.image_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?crop=entropy&cs=srgb&fm=jpg&q=85'}
          alt={event.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/50 to-transparent" />
        
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-10 h-10 rounded-full glass flex items-center justify-center"
          data-testid="back-btn"
        >
          <ArrowLeft size={20} />
        </button>

        {/* Category Badge */}
        <div
          className="absolute top-4 right-4 px-4 py-2 rounded-full font-bold uppercase tracking-wider text-sm"
          style={{ backgroundColor: categoryColor, color: '#fff' }}
        >
          {event.category}
        </div>

        {/* Low Stock Warning */}
        {event.low_stock && (
          <div className="absolute bottom-4 right-4 px-4 py-2 rounded-full bg-red-500 text-white text-sm font-bold flex items-center gap-2 animate-pulse">
            <AlertTriangle size={16} />
            Plus que {event.low_stock_count} places!
          </div>
        )}
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 -mt-20 relative z-10">
        <div className="glass p-6 md:p-8 rounded-2xl space-y-6">
          {/* Title */}
          <div>
            <h1 className="font-unbounded font-bold text-2xl md:text-3xl text-white mb-2" data-testid="event-title">
              {event.title}
            </h1>
            <div 
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm"
              style={{ backgroundColor: `${categoryColor}20`, color: categoryColor }}
            >
              <Users size={16} />
              <span>{event.available_tickets} places disponibles</span>
            </div>
          </div>

          {/* Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass p-4 rounded-xl">
              <Calendar className="text-green-400 mb-2" size={20} />
              <p className="text-xs text-gray-400">Date</p>
              <p className="font-medium text-white">{formatDate(event.date)}</p>
            </div>
            <div className="glass p-4 rounded-xl">
              <Clock className="text-green-400 mb-2" size={20} />
              <p className="text-xs text-gray-400">Heure</p>
              <p className="font-medium text-white">{event.time}</p>
            </div>
            <div className="glass p-4 rounded-xl">
              <MapPin className="text-green-400 mb-2" size={20} />
              <p className="text-xs text-gray-400">Lieu</p>
              <p className="font-medium text-white">{event.venue}</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="font-unbounded font-semibold text-lg text-white mb-3">Description</h3>
            <p className="text-gray-300 leading-relaxed">{event.description}</p>
          </div>

          {/* Ticket Types */}
          <div>
            <h3 className="font-unbounded font-semibold text-lg text-white mb-4">Types de billets</h3>
            <div className="grid gap-3">
              {event.ticket_types?.map((tt) => {
                const available = tt.quantity - (tt.sold || 0);
                const isSelected = selectedTicketType?.id === tt.id;
                const isSoldOut = available <= 0;
                const lowStock = available > 0 && available <= tt.quantity * 0.1;
                
                return (
                  <button
                    key={tt.id}
                    onClick={() => !isSoldOut && setSelectedTicketType(tt)}
                    disabled={isSoldOut}
                    className={`glass p-4 rounded-xl text-left transition-all ${
                      isSelected 
                        ? 'border-2 border-green-500 bg-green-500/10' 
                        : isSoldOut 
                          ? 'opacity-50 cursor-not-allowed' 
                          : 'hover:border-white/30'
                    }`}
                    data-testid={`ticket-type-${tt.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-white">{tt.name}</h4>
                          {tt.group_size > 1 && (
                            <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">
                              {tt.group_size} pers.
                            </span>
                          )}
                          {lowStock && (
                            <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs rounded-full animate-pulse">
                              Plus que {available}!
                            </span>
                          )}
                          {isSoldOut && (
                            <span className="px-2 py-0.5 bg-gray-500/20 text-gray-400 text-xs rounded-full">
                              Épuisé
                            </span>
                          )}
                        </div>
                        {tt.description && (
                          <p className="text-gray-400 text-sm mt-1">{tt.description}</p>
                        )}
                        <p className="text-gray-500 text-xs mt-1">
                          {available} / {tt.quantity} disponibles • Max {tt.max_per_order}/commande
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="font-mono font-bold text-xl text-green-400">
                          {formatPrice(tt.price)}
                        </p>
                        {tt.group_size > 1 && (
                          <p className="text-xs text-gray-500">
                            soit {formatPrice(Math.round(tt.price / tt.group_size))}/pers.
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        <Check className="text-green-500 ml-3" size={24} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Promo Code */}
          <div className="glass p-4 rounded-xl">
            <label className="text-sm text-gray-400 mb-2 block flex items-center gap-2">
              <Tag size={16} />
              Code promo (optionnel)
            </label>
            <div className="flex gap-2">
              <Input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="Ex: DJIB20"
                className="bg-white/5 border-white/10 text-white uppercase"
                data-testid="promo-input"
              />
              <Button 
                onClick={validatePromoCode}
                variant="outline"
                className="border-green-500 text-green-400"
              >
                Appliquer
              </Button>
            </div>
            {promoValid && (
              <p className="text-green-400 text-sm mt-2 flex items-center gap-1">
                <Check size={14} />
                {promoValid.discount_type === 'percentage' 
                  ? `-${promoValid.discount_value}%` 
                  : `-${promoValid.discount_value} DJF`} appliqué!
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Fixed Bottom Bar */}
      {selectedTicketType && (
        <div className="fixed bottom-24 left-0 right-0 glass border-t border-white/10 p-4 z-30">
          <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
            {/* Quantity Selector */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10"
                disabled={quantity <= 1}
                data-testid="decrease-qty"
              >
                <Minus size={18} />
              </button>
              <span className="font-mono font-bold text-xl w-8 text-center" data-testid="quantity">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(Math.min(selectedTicketType.max_per_order, selectedTicketType.quantity - (selectedTicketType.sold || 0), quantity + 1))}
                className="w-10 h-10 rounded-full glass flex items-center justify-center hover:bg-white/10"
                data-testid="increase-qty"
              >
                <Plus size={18} />
              </button>
            </div>

            {/* Total */}
            <div className="text-center hidden sm:block">
              <p className="text-gray-400 text-xs">Total</p>
              <p className="font-mono font-bold text-lg text-white">
                {formatPrice(calculateTotal())}
              </p>
              {promoValid && (
                <p className="text-green-400 text-xs">Promo appliquée</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={handleAddToCart}
                disabled={adding}
                className="gap-2 border-green-500 text-green-400 hover:bg-green-500/20"
                data-testid="add-to-cart-btn"
              >
                <ShoppingCart size={18} />
                <span className="hidden sm:inline">Panier</span>
              </Button>
              <Button
                size="lg"
                onClick={handleBuyNow}
                disabled={adding}
                className="bg-green-500 hover:bg-green-600 text-black gap-2"
                data-testid="buy-now-btn"
              >
                <Ticket size={18} />
                Réserver
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventDetailPage;
