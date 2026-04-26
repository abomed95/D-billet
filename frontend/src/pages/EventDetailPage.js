import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  Check,
  Clock,
  MapPin,
  Minus,
  Plus,
  ShoppingCart,
  Tag,
  Ticket,
  Users,
} from 'lucide-react';
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

const CATEGORY_LABELS = {
  cinema: 'Cinéma',
  football: 'Football',
  concerts: 'Concerts',
  conferences: 'Conférences',
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

      const availableTypes = eventData.ticket_types?.filter(
        (ticketType) => ticketType.quantity - (ticketType.sold || 0) > 0
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

  const formatPrice = (price) => `${new Intl.NumberFormat('fr-DJ').format(price)} DJF`;

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

  const validatePromoCode = async () => {
    if (!promoCode.trim()) return;

    try {
      const response = await axios.get(`${API}/promo-codes/${promoCode}/validate?event_id=${id}`);
      setPromoValid(response.data);
      toast.success(
        `Code avantage appliqué : -${response.data.discount_value}${
          response.data.discount_type === 'percentage' ? '%' : ' DJF'
        }`
      );
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
        total -= (total * promoValid.discount_value) / 100;
      } else {
        total = Math.max(0, total - promoValid.discount_value);
      }
    }

    return Math.round(total);
  };

  const handleAddToCart = async () => {
    if (!user) {
      toast.error('Veuillez vous connecter pour continuer');
      navigate('/auth');
      return;
    }

    if (!selectedTicketType) {
      toast.error('Veuillez choisir un billet');
      return;
    }

    const available = selectedTicketType.quantity - (selectedTicketType.sold || 0);
    if (quantity > available) {
      toast.error('Le nombre de places disponibles est insuffisant');
      return;
    }

    setAdding(true);
    try {
      await addToCart(event.id, selectedTicketType.id, quantity, promoValid?.code);
      toast.success(`${quantity} billet(s) ${selectedTicketType.name} ajouté(s) au panier`);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Une erreur est survenue');
    } finally {
      setAdding(false);
    }
  };

  const handleBuyNow = async () => {
    if (!user) {
      toast.error('Veuillez vous connecter pour continuer');
      navigate('/auth');
      return;
    }

    if (!selectedTicketType) {
      toast.error('Veuillez choisir un billet');
      return;
    }

    setAdding(true);
    try {
      await addToCart(event.id, selectedTicketType.id, quantity, promoValid?.code);
      navigate('/cart');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Une erreur est survenue');
    } finally {
      setAdding(false);
    }
  };

  const eventSlug = event ? event.slug || slugify(event.title) : '';
  const canonicalPath = event ? `/events/${event.id}/${eventSlug}` : location.pathname;

  useEffect(() => {
    if (!event) return;

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
        <div className="mx-auto max-w-4xl space-y-4 p-6">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!event) return null;

  const categoryColor = CATEGORY_COLORS[event.category] || '#7000FF';
  const categoryLabel = CATEGORY_LABELS[event.category] || 'Événement';
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
        ticketType.quantity - (ticketType.sold || 0) > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/SoldOut',
      url: absoluteUrl(canonicalPath),
      category: ticketType.name,
    })),
  };

  return (
    <div className="min-h-screen pb-40">
      <Seo
        title={`${event.title} | D-BILLET`}
        description={event.description || `Réservez vos billets officiels pour ${event.title} sur D-BILLET.`}
        path={canonicalPath}
        image={event.image_url || '/images/dbillet-logo.png'}
        type="event"
        structuredData={structuredData}
      />

      <div className="relative h-[50vh] md:h-[60vh]">
        <img
          src={event.image_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?crop=entropy&cs=srgb&fm=jpg&q=85'}
          alt={event.title}
          className="h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/50 to-transparent" />

        <button
          onClick={() => navigate(-1)}
          className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full glass"
          data-testid="back-btn"
        >
          <ArrowLeft size={20} />
        </button>

        <div
          className="absolute right-4 top-4 rounded-full px-4 py-2 text-sm font-bold uppercase tracking-wider text-white"
          style={{ backgroundColor: categoryColor }}
        >
          {categoryLabel}
        </div>

        {event.low_stock && (
          <div className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-red-500 px-4 py-2 text-sm font-bold text-white animate-pulse">
            <AlertTriangle size={16} />
            Dernières places : plus que {event.low_stock_count} disponibles
          </div>
        )}
      </div>

      <div className="relative z-10 mx-auto -mt-20 max-w-4xl px-4">
        <div className="glass space-y-6 rounded-2xl p-6 md:p-8">
          <div>
            <h1 className="mb-2 font-unbounded text-2xl font-bold text-white md:text-3xl" data-testid="event-title">
              {event.title}
            </h1>
            <div
              className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm"
              style={{ backgroundColor: `${categoryColor}20`, color: categoryColor }}
            >
              <Users size={16} />
              <span>{event.available_tickets} places encore disponibles</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="glass rounded-xl p-4">
              <Calendar className="mb-2 text-green-400" size={20} />
              <p className="text-xs text-gray-400">Date</p>
              <p className="font-medium text-white">{formatDate(event.date)}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <Clock className="mb-2 text-green-400" size={20} />
              <p className="text-xs text-gray-400">Heure</p>
              <p className="font-medium text-white">{event.time}</p>
            </div>
            <div className="glass rounded-xl p-4">
              <MapPin className="mb-2 text-green-400" size={20} />
              <p className="text-xs text-gray-400">Lieu</p>
              <p className="font-medium text-white">{event.venue}</p>
            </div>
          </div>

          <div>
            <h3 className="mb-3 font-unbounded text-lg font-semibold text-white">À propos de cet événement</h3>
            <p className="leading-relaxed text-gray-300">{event.description}</p>
          </div>

          <div>
            <h3 className="mb-4 font-unbounded text-lg font-semibold text-white">Choisissez votre billet</h3>
            <div className="grid gap-3">
              {event.ticket_types?.map((ticketType) => {
                const available = ticketType.quantity - (ticketType.sold || 0);
                const isSelected = selectedTicketType?.id === ticketType.id;
                const isSoldOut = available <= 0;
                const lowStock = available > 0 && available <= ticketType.quantity * 0.1;

                return (
                  <button
                    key={ticketType.id}
                    onClick={() => !isSoldOut && setSelectedTicketType(ticketType)}
                    disabled={isSoldOut}
                    className={`glass rounded-xl p-4 text-left transition-all ${
                      isSelected
                        ? 'border-2 border-green-500 bg-green-500/10'
                        : isSoldOut
                          ? 'cursor-not-allowed opacity-50'
                          : 'hover:border-white/30'
                    }`}
                    data-testid={`ticket-type-${ticketType.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-white">{ticketType.name}</h4>
                          {ticketType.group_size > 1 && (
                            <span className="rounded-full bg-purple-500/20 px-2 py-0.5 text-xs text-purple-400">
                              Pack {ticketType.group_size} pers.
                            </span>
                          )}
                          {lowStock && (
                            <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs text-red-400 animate-pulse">
                              Dernières places
                            </span>
                          )}
                          {isSoldOut && (
                            <span className="rounded-full bg-gray-500/20 px-2 py-0.5 text-xs text-gray-400">
                              Épuisé
                            </span>
                          )}
                        </div>
                        {ticketType.description && (
                          <p className="mt-1 text-sm text-gray-400">{ticketType.description}</p>
                        )}
                        <p className="mt-1 text-xs text-gray-500">
                          {available} / {ticketType.quantity} disponibles • Max {ticketType.max_per_order} par commande
                        </p>
                      </div>
                      <div className="ml-4 text-right">
                        <p className="font-mono text-xl font-bold text-green-400">{formatPrice(ticketType.price)}</p>
                        {ticketType.group_size > 1 && (
                          <p className="text-xs text-gray-500">
                            soit {formatPrice(Math.round(ticketType.price / ticketType.group_size))}/pers.
                          </p>
                        )}
                      </div>
                      {isSelected && <Check className="ml-3 text-green-500" size={24} />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="glass rounded-xl p-4">
            <label className="mb-2 flex items-center gap-2 text-sm text-gray-400">
              <Tag size={16} />
              Code avantage (optionnel)
            </label>
            <div className="flex gap-2">
              <Input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                placeholder="Ex : DJIB20"
                className="border-white/10 bg-white/5 uppercase text-white"
                data-testid="promo-input"
              />
              <Button onClick={validatePromoCode} variant="outline" className="border-green-500 text-green-400">
                Appliquer
              </Button>
            </div>
            {promoValid && (
              <p className="mt-2 flex items-center gap-1 text-sm text-green-400">
                <Check size={14} />
                {promoValid.discount_type === 'percentage'
                  ? `-${promoValid.discount_value}%`
                  : `-${promoValid.discount_value} DJF`}{' '}
                appliqué !
              </p>
            )}
          </div>
        </div>
      </div>

      {selectedTicketType && (
        <div className="fixed bottom-24 left-0 right-0 z-30 border-t border-white/10 glass p-4">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="flex h-10 w-10 items-center justify-center rounded-full glass hover:bg-white/10"
                disabled={quantity <= 1}
                data-testid="decrease-qty"
              >
                <Minus size={18} />
              </button>
              <span className="w-8 text-center font-mono text-xl font-bold" data-testid="quantity">
                {quantity}
              </span>
              <button
                onClick={() =>
                  setQuantity(
                    Math.min(
                      selectedTicketType.max_per_order,
                      selectedTicketType.quantity - (selectedTicketType.sold || 0),
                      quantity + 1
                    )
                  )
                }
                className="flex h-10 w-10 items-center justify-center rounded-full glass hover:bg-white/10"
                data-testid="increase-qty"
              >
                <Plus size={18} />
              </button>
            </div>

            <div className="hidden text-center sm:block">
              <p className="text-xs text-gray-400">Total</p>
              <p className="font-mono text-lg font-bold text-white">{formatPrice(calculateTotal())}</p>
              {promoValid && <p className="text-xs text-green-400">Offre appliquée</p>}
            </div>

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
                className="gap-2 bg-green-500 text-black hover:bg-green-600"
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
