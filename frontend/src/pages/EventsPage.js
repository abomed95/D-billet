import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import {
  Calendar,
  ChevronRight,
  Film,
  Mic2,
  Music,
  Search,
  Ticket,
  Trophy,
  X,
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import Seo from '../components/Seo';
import { API_BASE, isPrerender } from '../lib/api';
import { loadPrerenderHomeData } from '../lib/prerender';
import { absoluteUrl, slugify } from '../lib/seo';

const API = API_BASE;

const CATEGORIES = [
  { id: 'cinema', label: 'Cinéma', icon: Film, color: '#FF0055' },
  { id: 'football', label: 'Football', icon: Trophy, color: '#D4AF37' },
  { id: 'concerts', label: 'Concerts', icon: Music, color: '#7000FF' },
  { id: 'conferences', label: 'Conférences', icon: Mic2, color: '#FF5C00' },
];

const CATEGORY_LABELS = {
  cinema: 'Cinéma',
  football: 'Football',
  concerts: 'Concerts',
  conferences: 'Conférences',
};

const getCategoryColor = (category) =>
  ({
    cinema: '#FF0055',
    football: '#D4AF37',
    concerts: '#7000FF',
    conferences: '#FF5C00',
  }[category] || '#D4AF37');

const getCategoryLabel = (category) => CATEGORY_LABELS[category] || 'Événement';

const formatPrice = (price) => `${new Intl.NumberFormat('fr-DJ').format(price || 0)} DJF`;

const formatDate = (dateStr) =>
  new Date(dateStr).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

const EventCard = ({ event }) => {
  const eventPath = `/events/${event.id}/${event.slug || slugify(event.title)}`;
  const minPrice = event.min_price || event.price || 0;

  return (
    <Link
      to={eventPath}
      className="group block overflow-hidden rounded-[30px] border border-white/10 bg-[#0B0B10] transition-all hover:-translate-y-1 hover:border-gold/30"
    >
      <div className="relative h-56 overflow-hidden">
        <img
          src={event.image_url || '/images/dbillet-logo.png'}
          alt={event.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        <div
          className="absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold text-black"
          style={{ backgroundColor: getCategoryColor(event.category) }}
        >
          {getCategoryLabel(event.category)}
        </div>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="line-clamp-2 font-unbounded text-lg leading-6 text-white">{event.title}</h3>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-gray-400">{event.description}</p>
          </div>
          <ChevronRight className="mt-1 flex-shrink-0 text-gold" size={18} />
        </div>
        <div className="grid gap-2 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-gold" />
            <span>{formatDate(event.date)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Ticket size={16} className="text-gold" />
            <span>{minPrice > 0 ? formatPrice(minPrice) : 'Gratuit'}</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

const EventsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [activeCategory, setActiveCategory] = useState('all');

  const updateSearch = (value) => {
    setSearchQuery(value);
    const next = new URLSearchParams(searchParams);
    if (value.trim()) {
      next.set('q', value);
    } else {
      next.delete('q');
    }
    setSearchParams(next, { replace: true });
  };

  useEffect(() => {
    let isMounted = true;

    const fetchEvents = async () => {
      try {
        if (isPrerender) {
          const data = await loadPrerenderHomeData();
          if (isMounted) setAllEvents(data.events || []);
          return;
        }

        const response = await axios.get(`${API}/events`);
        if (isMounted) setAllEvents(response.data || []);
      } catch (error) {
        console.error('Failed to fetch events:', error);
        if (isMounted) setAllEvents([]);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchEvents();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return allEvents.filter((item) => {
      const matchesCategory = activeCategory === 'all' || item.category === activeCategory;
      const matchesQuery =
        !query ||
        item.title?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.venue?.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });
  }, [allEvents, searchQuery, activeCategory]);

  const structuredData = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: absoluteUrl('/') },
            { '@type': 'ListItem', position: 2, name: 'Événements', item: absoluteUrl('/events') },
          ],
        },
        {
          '@type': 'ItemList',
          name: 'Événements à Djibouti',
          itemListElement: allEvents.slice(0, 20).map((event, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: absoluteUrl(`/events/${event.id}/${event.slug || slugify(event.title)}`),
            name: event.title,
          })),
        },
        ...allEvents.slice(0, 12).map((event) => ({
          '@type': 'Event',
          name: event.title,
          startDate: event.date,
          eventStatus: 'https://schema.org/EventScheduled',
          eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
          location: {
            '@type': 'Place',
            name: event.venue || 'Djibouti',
            address: { '@type': 'PostalAddress', addressLocality: 'Djibouti', addressCountry: 'DJ' },
          },
          image: [event.image_url || absoluteUrl('/images/dbillet-logo.png')],
          description: event.description,
          offers: {
            '@type': 'Offer',
            priceCurrency: 'DJF',
            price: event.min_price || event.price || 0,
            availability: 'https://schema.org/InStock',
            url: absoluteUrl(`/events/${event.id}/${event.slug || slugify(event.title)}`),
          },
        })),
      ],
    }),
    [allEvents]
  );

  return (
    <div className="min-h-screen bg-[#050505]">
      <Seo
        title="Tous les événements à Djibouti"
        description="Découvrez et réservez tous les événements disponibles à Djibouti sur D-BILLET : concerts, cinéma, football, conférences et spectacles. Paiement local sécurisé et billet numérique avec QR code."
        path="/events"
        structuredData={structuredData}
      />

      {/* Header */}
      <section className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.2),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.06),transparent_26%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-8 pt-24">
          <div className="inline-flex items-center gap-2 rounded-full border border-gold/25 bg-black/35 px-4 py-2 backdrop-blur-xl">
            <Ticket className="text-gold" size={16} />
            <span className="text-xs uppercase tracking-[0.24em] text-gold">Billetterie événementielle</span>
          </div>
          <h1 className="mt-5 max-w-3xl font-unbounded text-4xl leading-[1.05] text-white sm:text-5xl">
            Tous les événements à Djibouti
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-gray-300">
            Concerts, cinéma, football, conférences et spectacles. Réservez vos places sur la plateforme
            officielle de billetterie de Djibouti et recevez votre billet numérique immédiatement.
          </p>

          {/* Search */}
          <div className="mt-8 max-w-2xl">
            <div className="rounded-[28px] border border-gold/20 bg-black/45 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
              <div className="relative">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gold" size={20} />
                <Input
                  type="text"
                  placeholder="Rechercher un événement, un artiste, un lieu..."
                  value={searchQuery}
                  onChange={(e) => updateSearch(e.target.value)}
                  className="h-14 rounded-2xl border-0 bg-transparent pl-14 pr-12 text-white placeholder:text-gray-500"
                  data-testid="events-search-input"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => updateSearch('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-white"
                    aria-label="Effacer la recherche"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Category filters */}
      <section className="px-4 pt-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveCategory('all')}
              className={`rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                activeCategory === 'all'
                  ? 'border-gold/40 bg-gold text-black'
                  : 'border-white/10 bg-white/[0.03] text-gray-300 hover:border-gold/30 hover:text-white'
              }`}
              data-testid="events-category-all"
            >
              Tous
            </button>
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                  activeCategory === category.id
                    ? 'border-gold/40 bg-gold text-black'
                    : 'border-white/10 bg-white/[0.03] text-gray-300 hover:border-gold/30 hover:text-white'
                }`}
                data-testid={`events-category-${category.id}`}
              >
                <category.icon size={16} style={{ color: activeCategory === category.id ? '#000' : category.color }} />
                {category.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Events grid */}
      <section className="px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              {loading
                ? 'Chargement des événements...'
                : `${filteredEvents.length} événement${filteredEvents.length > 1 ? 's' : ''} disponible${
                    filteredEvents.length > 1 ? 's' : ''
                  }`}
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-72 rounded-[28px]" />
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-6 py-16 text-center">
              <p className="text-gray-300">Aucun événement ne correspond à votre recherche.</p>
              <p className="mt-2 text-sm text-gray-500">
                Essayez une autre catégorie ou revenez bientôt : de nouveaux événements sont ajoutés régulièrement.
              </p>
              {(searchQuery || activeCategory !== 'all') && (
                <Button
                  onClick={() => {
                    updateSearch('');
                    setActiveCategory('all');
                  }}
                  className="mt-6 rounded-2xl bg-gold text-black hover:bg-gold-light"
                >
                  Réinitialiser les filtres
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default EventsPage;
