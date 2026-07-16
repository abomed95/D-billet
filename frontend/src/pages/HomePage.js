import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  ArrowRight,
  Calendar,
  ChevronRight,
  Clock,
  CreditCard,
  Film,
  HelpCircle,
  MapPin,
  Mic2,
  Minus,
  Music,
  Plus,
  Quote,
  Search,
  Shield,
  Ship,
  Sparkles,
  Star,
  Ticket,
  Train,
  Trophy,
  Zap,
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

const METRICS = [
  { value: '500+', label: 'Événements & trajets' },
  { value: '10K+', label: 'Réservations' },
  { value: '24/7', label: 'Accès sécurisé' },
];

const ADVANTAGES = [
  {
    icon: Ticket,
    title: 'Billetterie événementielle',
    text: 'Réservez vos places pour concerts, matchs, conférences et spectacles depuis une seule plateforme officielle à Djibouti.',
  },
  {
    icon: Shield,
    title: 'Paiement sécurisé',
    text: 'Réglez avec Waafi, D-Money et CAC Bank dans un parcours clair et rassurant.',
  },
  {
    icon: Zap,
    title: 'Billet QR code',
    text: "Recevez immédiatement votre billet numérique, prêt à être présenté à l'entrée ou au contrôle.",
  },
  {
    icon: Clock,
    title: 'Disponible à tout moment',
    text: 'Retrouvez vos réservations en ligne 24h/24, directement depuis votre téléphone.',
  },
];

const HOW_IT_WORKS = [
  {
    icon: Search,
    label: 'ÉTAPE 1',
    title: 'Choisissez votre billet',
    text: 'Recherchez un événement, un trajet train ou une liaison ferry selon votre besoin.',
  },
  {
    icon: CreditCard,
    label: 'ÉTAPE 2',
    title: 'Payez simplement',
    text: 'Finalisez votre réservation avec le moyen de paiement local disponible sur la plateforme.',
  },
  {
    icon: Ticket,
    label: 'ÉTAPE 3',
    title: 'Recevez votre QR code',
    text: 'Votre billet numérique est généré après confirmation et reste accessible en ligne.',
  },
];

const FAQ_DATA = [
  {
    question: 'Comment acheter un billet sur D-BILLET ?',
    answer:
      'Sélectionnez un service (événement, train ou ferry), confirmez votre choix, payez en ligne avec Waafi, D-Money ou CAC Bank, puis récupérez votre billet avec QR code immédiatement.',
  },
  {
    question: 'Quels moyens de paiement sont acceptés à Djibouti ?',
    answer: 'D-BILLET prend en charge Waafi, D-Money et CAC Bank selon le service disponible.',
  },
  {
    question: 'Comment fonctionne le billet électronique ?',
    answer: 'Le billet est généré avec un QR code unique à présenter depuis votre téléphone, sans impression nécessaire.',
  },
  {
    question: 'Comment réserver un billet de train ou de ferry à Djibouti ?',
    answer:
      "Choisissez le trajet train (Djibouti - Éthiopie) ou la liaison ferry (Djibouti - Tadjoura - Obock), sélectionnez la date, payez en ligne et recevez votre billet QR code.",
  },
  {
    question: 'Comment installer D-BILLET sur mon téléphone ?',
    answer: "Ajoutez simplement l'application à votre écran d'accueil depuis votre navigateur mobile : D-BILLET fonctionne comme une application (PWA).",
  },
];

const HOME_LINKS = [
  { to: '/train', label: 'Billet train Djibouti' },
  { to: '/ferry', label: 'Réservation ferry Djibouti - Obock' },
  { to: '/legal/privacy', label: 'Politique de confidentialité' },
  { to: '/terms', label: "Conditions d'utilisation" },
];

const TESTIMONIALS_FALLBACK = [
  {
    author: 'Amina H.',
    role: 'Cliente D-BILLET',
    content: "J'ai réservé mon billet en quelques minutes et tout s'est déroulé sans attente à l'entrée.",
    rating: 5,
  },
  {
    author: 'Moussa A.',
    role: 'Voyageur ferry',
    content: "La réservation en ligne m'a permis d'organiser mon départ plus sereinement, avec mon billet déjà prêt.",
    rating: 5,
  },
  {
    author: 'Noura S.',
    role: 'Participante événement',
    content: 'Le paiement était simple, les informations étaient claires et le QR code a été reçu immédiatement.',
    rating: 5,
  },
];

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

const HomePage = () => {
  const [allEvents, setAllEvents] = useState([]);
  const [events, setEvents] = useState([]);
  const [testimonials, setTestimonials] = useState(TESTIMONIALS_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [openFaq, setOpenFaq] = useState(0);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      if (isPrerender) {
        const data = await loadPrerenderHomeData();
        setAllEvents(data.events || []);
        setEvents(data.events || []);
        setTestimonials(data.testimonials?.length ? data.testimonials : TESTIMONIALS_FALLBACK);
        return;
      }

      const [eventsResponse, testimonialsResponse] = await Promise.all([
        axios.get(`${API}/events`),
        axios.get(`${API}/testimonials`).catch(() => ({ data: TESTIMONIALS_FALLBACK })),
      ]);

      setAllEvents(eventsResponse.data || []);
      setEvents(eventsResponse.data || []);
      setTestimonials(
        Array.isArray(testimonialsResponse.data) && testimonialsResponse.data.length
          ? testimonialsResponse.data
          : TESTIMONIALS_FALLBACK
      );
    } catch (error) {
      console.error('Failed to fetch data:', error);
      setTestimonials(TESTIMONIALS_FALLBACK);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (event) => {
    event.preventDefault();
    setActiveCategory('all');
    if (!searchQuery.trim()) {
      setEvents(allEvents);
      return;
    }

    const query = searchQuery.toLowerCase();
    setEvents(
      allEvents.filter(
        (item) =>
          item.title?.toLowerCase().includes(query) ||
          item.description?.toLowerCase().includes(query) ||
          item.venue?.toLowerCase().includes(query)
      )
    );
  };

  const handleCategoryFilter = (categoryId) => {
    if (categoryId === 'all') {
      setActiveCategory('all');
      setEvents(allEvents);
      return;
    }
    setActiveCategory(categoryId);
    const filtered = allEvents.filter((item) => item.category === categoryId);
    setEvents(filtered.length ? filtered : allEvents);
  };

  const structuredData = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          '@id': absoluteUrl('/#organization'),
          name: 'D-Billet',
          alternateName: 'D-BILLET Djibouti',
          url: absoluteUrl('/'),
          logo: absoluteUrl('/images/dbillet-logo.png'),
          areaServed: { '@type': 'Country', name: 'Djibouti' },
          sameAs: ['https://facebook.com/dbillet', 'https://instagram.com/dbillet'],
        },
        {
          '@type': 'WebSite',
          '@id': absoluteUrl('/#website'),
          name: 'D-Billet',
          url: absoluteUrl('/'),
          inLanguage: 'fr-DJ',
          publisher: { '@id': absoluteUrl('/#organization') },
          potentialAction: {
            '@type': 'SearchAction',
            target: { '@type': 'EntryPoint', urlTemplate: absoluteUrl('/events?q={search_term_string}') },
            'query-input': 'required name=search_term_string',
          },
        },
        {
          '@type': 'WebPage',
          '@id': absoluteUrl('/#webpage'),
          url: absoluteUrl('/'),
          name: 'Billetterie en ligne à Djibouti — Événements, Train et Ferry | D-Billet',
          isPartOf: { '@id': absoluteUrl('/#website') },
          about: { '@id': absoluteUrl('/#organization') },
          inLanguage: 'fr-DJ',
          description:
            "D-BILLET est la plateforme officielle de billetterie en ligne à Djibouti : réservez vos billets d'événements, vos trajets en train et vos traversées en ferry avec paiement local sécurisé et billet QR code immédiat.",
        },
        {
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Accueil', item: absoluteUrl('/') },
          ],
        },
        {
          '@type': 'FAQPage',
          mainEntity: FAQ_DATA.map((faq) => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: { '@type': 'Answer', text: faq.answer },
          })),
        },
        ...allEvents.slice(0, 6).map((event) => ({
          '@type': 'Event',
          name: event.title,
          startDate: event.date,
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
        title="Billetterie en ligne à Djibouti — Événements, Train & Ferry"
        description="D-BILLET, la plateforme officielle de billetterie en ligne à Djibouti : réservez vos billets d'événements, de train et de ferry. Paiement local (Waafi, D-Money, CAC Bank), confirmation immédiate et billet QR code."
        keywords="billetterie Djibouti, billet en ligne Djibouti, réservation train Djibouti, ferry Djibouti Obock, acheter billet concert Djibouti, D-Billet, billet QR code Djibouti"
        path="/"
        structuredData={structuredData}
      />

      {/* ============ HERO — App-style ============ */}
      <header className="relative overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1800&q=80)' }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(212,175,55,0.22),transparent_40%),linear-gradient(180deg,rgba(5,5,5,0.82),rgba(5,5,5,0.92)_55%,#050505)]" aria-hidden="true" />

        <div className="relative mx-auto w-full max-w-2xl px-4 pt-8 lg:max-w-6xl lg:pt-14">
          {/* Top bar — app header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src="/images/dbillet-icon.png" alt="Logo D-Billet" className="h-10 w-10 rounded-2xl object-cover ring-1 ring-gold/30" />
              <div className="leading-tight">
                <p className="font-display text-lg font-extrabold text-white">D-BILLET</p>
                <p className="flex items-center gap-1 text-[11px] text-gold">
                  <MapPin size={11} /> Djibouti
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/25 bg-black/40 px-3 py-1.5 text-[11px] font-medium text-gold backdrop-blur-xl">
              <Sparkles size={12} /> Officiel
            </span>
          </div>

          {/* Headline */}
          <div className="mt-10 lg:mt-16 lg:max-w-3xl">
            <h1 className="font-display text-[2rem] font-extrabold leading-[1.08] text-white sm:text-5xl lg:text-6xl">
              Billetterie en ligne à Djibouti.{' '}
              <span className="gold-text-gradient">Événements, Train & Ferry.</span>
            </h1>
            <p className="mt-4 max-w-xl text-[15px] leading-6 text-gray-300 sm:text-lg sm:leading-7">
              La plateforme officielle pour réserver vos billets à Djibouti. Paiement local sécurisé, confirmation immédiate et billet numérique avec QR code.
            </p>
          </div>

          {/* Search — app pill */}
          <form onSubmit={handleSearch} className="mt-6 lg:max-w-2xl">
            <div className="flex items-center gap-2 rounded-2xl border border-gold/25 bg-black/55 p-2 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gold" size={19} />
                <Input
                  type="text"
                  placeholder="Rechercher un événement, un trajet..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-12 rounded-xl border-0 bg-transparent pl-12 text-[15px] text-white placeholder:text-gray-500 focus-visible:ring-0"
                  data-testid="search-input"
                  aria-label="Rechercher un billet"
                />
              </div>
              <Button type="submit" className="h-12 rounded-xl bg-gold px-5 font-semibold text-black hover:bg-gold-light">
                <span className="hidden sm:inline">Rechercher</span>
                <ArrowRight className="sm:hidden" size={20} />
              </Button>
            </div>
          </form>

          {/* Metrics — compact app row */}
          <div className="mt-5 grid grid-cols-3 gap-2.5 lg:max-w-2xl">
            {METRICS.map((metric) => (
              <div key={metric.label} className="rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-3 text-center backdrop-blur-xl">
                <p className="font-display text-lg font-bold text-gold sm:text-2xl">{metric.value}</p>
                <p className="mt-0.5 text-[11px] leading-tight text-gray-400 sm:text-xs">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ============ Quick access — Train / Ferry ============ */}
      <section className="mx-auto w-full max-w-2xl px-4 pt-6 lg:max-w-6xl" aria-label="Accès rapide transport">
        <div className="grid grid-cols-2 gap-3 lg:gap-4">
          <QuickAction to="/train" title="Train" subtitle="Djibouti — Éthiopie" icon={Train} accent="#FFD600" />
          <QuickAction to="/ferry" title="Ferry" subtitle="Djibouti — Obock" icon={Ship} accent="#00F0FF" />
        </div>
      </section>

      {/* ============ Categories — scrollable chips ============ */}
      <section className="mx-auto w-full max-w-2xl px-4 pt-8 lg:max-w-6xl" aria-labelledby="cat-title">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="cat-title" className="font-display text-lg font-bold text-white">Catégories</h2>
        </div>
        <div className="no-scrollbar snap-x-mandatory -mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1">
          <CategoryChip
            active={activeCategory === 'all'}
            onClick={() => handleCategoryFilter('all')}
            label="Tout"
            icon={Ticket}
            color="#D4AF37"
          />
          {CATEGORIES.map((category) => (
            <CategoryChip
              key={category.id}
              active={activeCategory === category.id}
              onClick={() => handleCategoryFilter(category.id)}
              label={category.label}
              icon={category.icon}
              color={category.color}
              testId={`category-${category.id}`}
            />
          ))}
        </div>
      </section>

      {/* ============ Events ============ */}
      <section className="mx-auto w-full max-w-2xl px-4 pt-8 lg:max-w-6xl" aria-labelledby="events-title">
        <div className="mb-4 flex items-center justify-between">
          <h2 id="events-title" className="font-display text-lg font-bold text-white">Événements à venir</h2>
          <Link
            to="/events"
            className="inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-medium text-gold transition-colors hover:bg-gold/10"
          >
            Voir tout <ChevronRight size={15} />
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-72 rounded-3xl" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-16 text-center text-gray-400">
            Aucun événement ne correspond à cette recherche.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {events.slice(0, 6).map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>

      {/* ============ Why D-BILLET ============ */}
      <section className="mx-auto w-full max-w-2xl px-4 pt-12 lg:max-w-6xl" aria-labelledby="why-title">
        <div className="rounded-3xl border border-white/10 bg-[#0B0B10] p-5 app-shadow sm:p-7">
          <div className="grid gap-7 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-4">
              <div className="inline-flex rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
                Plateforme centrale
              </div>
              <h2 id="why-title" className="font-display text-2xl font-bold leading-tight text-white sm:text-3xl">
                Tout réserver depuis une seule application.
              </h2>
              <p className="text-[15px] leading-7 text-gray-300">
                D-BILLET simplifie l'achat de billets à Djibouti. Pour un événement, un trajet en train ou une traversée en ferry, vous bénéficiez d'un service officiel, fluide et fiable, pensé pour réserver en toute confiance.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {ADVANTAGES.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-gold/15">
                      <item.icon className="text-gold" size={20} />
                    </div>
                    <h3 className="font-semibold text-white">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-6 text-gray-400">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              {HOW_IT_WORKS.map((item) => (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                  <div className="flex items-center gap-4">
                    <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-gold/15">
                      <item.icon className="text-gold" size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">{item.label}</p>
                      <h3 className="mt-0.5 font-display text-lg font-bold text-white">{item.title}</h3>
                    </div>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-gray-400">{item.text}</p>
                </div>
              ))}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">Liens utiles</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {HOME_LINKS.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-[13px] text-gray-200 transition-colors hover:border-gold/30 hover:text-white"
                    >
                      {link.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ Testimonials ============ */}
      <section className="mx-auto w-full max-w-2xl px-4 pt-12 lg:max-w-6xl" aria-labelledby="testi-title">
        <div className="mb-6 text-center">
          <div className="inline-flex rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-gold">
            Témoignages
          </div>
          <h2 id="testi-title" className="mt-3 font-display text-2xl font-bold text-white sm:text-3xl">
            Ils réservent avec confiance
          </h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.slice(0, 3).map((testimonial, index) => (
            <figure key={`${testimonial.author}-${index}`} className="rounded-3xl border border-white/10 bg-[#0B0B10] p-6 app-shadow">
              <div className="mb-4 flex items-center justify-between">
                <Quote className="text-gold" size={22} />
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: Math.max(1, Math.min(5, Number(testimonial.rating) || 5)) }).map((_, starIndex) => (
                    <Star key={starIndex} size={14} className="fill-gold text-gold" />
                  ))}
                </div>
              </div>
              <blockquote className="text-sm leading-7 text-gray-300">{testimonial.content}</blockquote>
              <figcaption className="mt-5 border-t border-white/10 pt-4">
                <p className="font-semibold text-white">{testimonial.author}</p>
                <p className="text-[11px] uppercase tracking-[0.14em] text-gold">{testimonial.role || 'Client D-BILLET'}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ============ FAQ ============ */}
      <section className="mx-auto w-full max-w-2xl px-4 py-12 lg:max-w-3xl" aria-labelledby="faq-title">
        <div className="mb-6 text-center">
          <h2 id="faq-title" className="flex items-center justify-center gap-2 font-display text-xl font-bold text-white sm:text-2xl">
            <HelpCircle className="text-gold" size={24} />
            Questions fréquentes
          </h2>
          <p className="mt-2 text-sm text-gray-400">Tout ce que vous devez savoir avant de réserver sur D-BILLET.</p>
        </div>
        <div className="space-y-2.5">
          {FAQ_DATA.map((faq, index) => (
            <div key={faq.question} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
              <button
                onClick={() => setOpenFaq(openFaq === index ? null : index)}
                className="flex w-full items-center justify-between gap-4 p-4 text-left transition-colors hover:bg-white/[0.03] sm:p-5"
                aria-expanded={openFaq === index}
              >
                <span className="font-medium text-white">{faq.question}</span>
                {openFaq === index ? (
                  <Minus className="flex-shrink-0 text-gold" size={18} />
                ) : (
                  <Plus className="flex-shrink-0 text-gold" size={18} />
                )}
              </button>
              {openFaq === index && (
                <div className="border-t border-white/10 px-4 pb-4 pt-3 text-sm leading-6 text-gray-400 sm:px-5">{faq.answer}</div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const QuickAction = ({ to, title, subtitle, icon: Icon, accent }) => (
  <Link
    to={to}
    className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-[#0B0B10] p-4 transition-all active:scale-[0.98] sm:p-5"
    style={{ boxShadow: `0 20px 50px -30px ${accent}` }}
  >
    <div
      className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl sm:mb-8"
      style={{ backgroundColor: `${accent}1f` }}
    >
      <Icon size={24} style={{ color: accent }} className="transition-transform group-hover:scale-110" />
    </div>
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-white sm:text-xl">{title}</h2>
        <ChevronRight className="text-gray-500 transition-colors group-hover:text-white" size={18} />
      </div>
      <p className="mt-0.5 text-[13px] text-gray-400">{subtitle}</p>
    </div>
  </Link>
);

const CategoryChip = ({ active, onClick, label, icon: Icon, color, testId }) => (
  <button
    onClick={onClick}
    data-testid={testId}
    className={`snap-start flex flex-shrink-0 items-center gap-2 rounded-full border px-4 py-2.5 text-sm font-medium transition-all ${
      active
        ? 'border-gold/50 bg-gold/15 text-white'
        : 'border-white/10 bg-white/[0.03] text-gray-300 hover:border-white/20 hover:text-white'
    }`}
  >
    <span className="flex h-6 w-6 items-center justify-center rounded-full" style={{ backgroundColor: `${color}26` }}>
      <Icon size={14} style={{ color }} />
    </span>
    {label}
  </button>
);

const EventCard = ({ event }) => {
  const eventPath = `/events/${event.id}/${event.slug || slugify(event.title)}`;
  const minPrice = event.min_price || event.price || 0;

  return (
    <Link
      to={eventPath}
      className="group block overflow-hidden rounded-3xl border border-white/10 bg-[#0B0B10] transition-all hover:-translate-y-1 hover:border-gold/30 active:scale-[0.99]"
    >
      <div className="relative h-48 overflow-hidden sm:h-52">
        <img
          src={event.image_url || '/images/dbillet-logo.png'}
          alt={`Billet ${event.title} à Djibouti`}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        <div className="absolute left-3 top-3 rounded-full px-3 py-1 text-[11px] font-semibold text-black" style={{ backgroundColor: getCategoryColor(event.category) }}>
          {getCategoryLabel(event.category)}
        </div>
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        <h3 className="line-clamp-2 font-display text-base font-bold leading-6 text-white">{event.title}</h3>
        <p className="line-clamp-2 text-[13px] leading-6 text-gray-400">{event.description}</p>
        <div className="flex items-center justify-between border-t border-white/10 pt-3">
          <div className="flex items-center gap-1.5 text-[13px] text-gray-400">
            <Calendar size={15} className="text-gold" />
            <span>{formatDate(event.date)}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[13px] font-semibold text-white">
            <Ticket size={15} className="text-gold" />
            <span>{minPrice > 0 ? formatPrice(minPrice) : 'Gratuit'}</span>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default HomePage;
