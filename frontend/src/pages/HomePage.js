import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import {
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  Film,
  HelpCircle,
  Mic2,
  Minus,
  Music,
  Plus,
  Quote,
  Search,
  Shield,
  Ship,
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
  { value: '500+', label: 'Événements et trajets disponibles' },
  { value: '10K+', label: 'Réservations traitées' },
  { value: '24/7', label: 'Accès sécurisé en ligne' },
];

const ADVANTAGES = [
  {
    icon: Ticket,
    title: 'Billetterie événementielle',
    text: 'Réservez vos places pour concerts, matchs, conférences et spectacles depuis une seule plateforme officielle.',
  },
  {
    icon: Shield,
    title: 'Paiement sécurisé',
    text: 'Réglez votre commande avec les moyens de paiement locaux disponibles, dans un parcours clair et rassurant.',
  },
  {
    icon: Zap,
    title: 'Billet QR code',
    text: "Recevez immédiatement votre billet numérique, prêt à être présenté à l'entrée ou au contrôle.",
  },
  {
    icon: Clock,
    title: 'Disponible à tout moment',
    text: 'Retrouvez vos réservations en ligne à tout moment, directement depuis votre téléphone.',
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
    text: 'Finalisez votre réservation avec le moyen de paiement disponible sur la plateforme.',
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
    answer: 'Sélectionnez un service, confirmez votre choix, payez en ligne puis récupérez votre billet avec QR code.',
  },
  {
    question: 'Quels moyens de paiement sont acceptés ?',
    answer: 'D-BILLET prend en charge Waafi, D-Money et CAC Bank selon le service disponible.',
  },
  {
    question: 'Comment fonctionne le billet électronique ?',
    answer: 'Le billet est généré avec un QR code unique à présenter depuis votre téléphone.',
  },
  {
    question: 'Comment installer D-BILLET sur mon téléphone ?',
    answer: "Ajoutez simplement l'application à votre écran d'accueil depuis votre navigateur mobile.",
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
  const [openFaq, setOpenFaq] = useState(null);

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
    const filtered = allEvents.filter((item) => item.category === categoryId);
    setEvents(filtered.length ? filtered : allEvents);
  };

  const structuredData = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Organization',
          name: 'D-Billet',
          url: absoluteUrl('/'),
          logo: absoluteUrl('/images/dbillet-logo.png'),
        },
        {
          '@type': 'WebSite',
          name: 'D-Billet',
          url: absoluteUrl('/'),
          inLanguage: 'fr-DJ',
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
        title="Billetterie Djibouti, Train et Ferry"
        description="D-BILLET est la plateforme officielle de billetterie à Djibouti pour les événements, les réservations train et ferry."
        path="/"
        structuredData={structuredData}
      />

      <section className="relative overflow-hidden border-b border-white/5">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: 'url(https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1800&q=80)' }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.24),transparent_32%),linear-gradient(135deg,rgba(5,5,5,0.9),rgba(5,5,5,0.72)_45%,rgba(5,5,5,0.96))]" />

        <div className="relative mx-auto grid min-h-[78vh] max-w-6xl gap-10 px-4 pb-16 pt-24 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-7">
            <div className="inline-flex items-center gap-3 rounded-full border border-gold/25 bg-black/35 px-4 py-2 backdrop-blur-xl">
              <img src="/images/dbillet-icon.png" alt="D-Billet" className="h-9 w-9 rounded-xl object-cover" />
              <span className="text-xs uppercase tracking-[0.24em] text-gold">Billetterie officielle de Djibouti</span>
            </div>

            <div className="space-y-4">
              <p className="text-sm uppercase tracking-[0.24em] text-white/55">ÉVÉNEMENTS, TRAIN ET FERRY</p>
              <h1 className="max-w-4xl font-unbounded text-4xl leading-[1.05] text-white sm:text-5xl lg:text-6xl">
                Réservez en toute confiance avec D-BILLET.
              </h1>
              <p className="max-w-2xl text-base leading-7 text-gray-300 sm:text-lg">
                La plateforme officielle pour vos événements, trajets train et traversées ferry à Djibouti. Paiement local sécurisé, confirmation immédiate et billet numérique avec QR code.
              </p>
            </div>

            <form onSubmit={handleSearch} className="max-w-2xl">
              <div className="rounded-[28px] border border-gold/20 bg-black/45 p-2 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                <div className="flex flex-col gap-2 md:flex-row md:items-center">
                  <div className="relative flex-1">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gold" size={20} />
                    <Input
                      type="text"
                      placeholder="Rechercher un événement, un trajet ou une réservation..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-14 rounded-2xl border-0 bg-transparent pl-14 text-white placeholder:text-gray-500"
                      data-testid="search-input"
                    />
                  </div>
                  <Button type="submit" className="h-12 rounded-2xl bg-gold px-6 text-black hover:bg-gold-light">
                    Rechercher
                  </Button>
                </div>
              </div>
            </form>

            <div className="grid gap-3 sm:grid-cols-3">
              {METRICS.map((metric) => (
                <div key={metric.label} className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-4 backdrop-blur-xl">
                  <p className="font-unbounded text-2xl text-gold">{metric.value}</p>
                  <p className="mt-2 text-sm text-gray-400">{metric.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[30px] border border-white/10 bg-black/45 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.36)] backdrop-blur-xl">
              <p className="text-xs uppercase tracking-[0.24em] text-gold">PLATEFORME D-BILLET</p>
              <h2 className="mt-2 font-unbounded text-2xl text-white">Une plateforme de confiance, pensée pour réserver vite</h2>
              <div className="mt-5 space-y-3">
                {[
                  'Événements, train et ferry réunis sur une seule plateforme officielle',
                  'Paiement local avec Waafi, D-Money et CAC Bank',
                  'Billet numérique disponible immédiatement après confirmation',
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-gray-300">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[28px] border border-gold/15 bg-gradient-to-br from-gold/12 to-transparent p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-gold">PAIEMENT</p>
                <h3 className="mt-2 font-unbounded text-xl text-white">Waafi, D-Money, CAC Bank</h3>
              </div>
              <div className="rounded-[28px] border border-white/10 bg-white/[0.04] p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-gold">ACCÈS RAPIDE</p>
                <h3 className="mt-2 font-unbounded text-xl text-white">Événements, train et ferry</h3>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 animate-bounce lg:flex">
          <ChevronDown className="text-gold" size={26} />
        </div>
      </section>

      <section className="relative z-10 -mt-8 px-4 pb-2">
        <div className="mx-auto grid max-w-6xl gap-4 md:grid-cols-2">
          <TransportCard to="/train" title="Train" subtitle="Djibouti - Éthiopie" icon={Train} color="text-train" border="hover:border-train/40" />
          <TransportCard to="/ferry" title="Ferry" subtitle="Djibouti - Tadjoura - Obock" icon={Ship} color="text-ferry" border="hover:border-ferry/40" />
        </div>
      </section>

      <section className="px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-unbounded text-xl text-white">Catégories</h2>
            <button onClick={() => setEvents(allEvents)} className="text-sm text-gold hover:text-gold-light">
              Réinitialiser
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                onClick={() => handleCategoryFilter(category.id)}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-all hover:border-gold/30 hover:bg-white/[0.05]"
                data-testid={`category-${category.id}`}
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl" style={{ backgroundColor: `${category.color}20` }}>
                  <category.icon size={24} style={{ color: category.color }} />
                </div>
                <span className="mt-3 block text-sm text-gray-300 group-hover:text-white">{category.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-unbounded text-xl text-white">Événements</h2>
            <Link
              to="/events"
              className="inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-gold transition-colors hover:bg-gold/10 hover:text-gold-light"
            >
              Voir tout
              <ChevronRight size={16} />
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-72 rounded-[28px]" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-6 py-16 text-center text-gray-400">
              Aucun événement ne correspond à cette recherche.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {events.slice(0, 6).map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="border-y border-white/5 px-4 py-14">
        <div className="mx-auto max-w-6xl rounded-[32px] border border-white/10 bg-[#0B0B10] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:p-8">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="space-y-5">
              <div className="inline-flex rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-gold">
                PLATEFORME CENTRALE
              </div>
              <h2 className="font-unbounded text-3xl leading-tight text-white">Tout réserver depuis une seule plateforme.</h2>
              <p className="text-base leading-7 text-gray-300">
                D-BILLET simplifie l'achat de billets à Djibouti. Pour un événement, un trajet en train ou une traversée en ferry, l'utilisateur bénéficie d'un service officiel, fluide et fiable, pensé pour réserver en toute confiance.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {ADVANTAGES.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-gold/15">
                      <item.icon className="text-gold" size={20} />
                    </div>
                    <h3 className="font-medium text-white">{item.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-gray-400">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {HOW_IT_WORKS.map((item) => (
                <div key={item.title} className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
                  <div className="mb-4 flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/15">
                      <item.icon className="text-gold" size={20} />
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-gold">{item.label}</p>
                      <h3 className="mt-1 font-unbounded text-xl text-white">{item.title}</h3>
                    </div>
                  </div>
                  <p className="text-sm leading-6 text-gray-400">{item.text}</p>
                </div>
              ))}
              <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-gold">LIENS UTILES</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {HOME_LINKS.map((link) => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-gray-200 transition-colors hover:border-gold/30 hover:text-white"
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

      <section className="px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 text-center">
            <div className="inline-flex rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-gold">
              TÉMOIGNAGES
            </div>
            <h2 className="mt-4 font-unbounded text-3xl text-white">Ils réservent avec confiance sur D-BILLET</h2>
            <p className="mx-auto mt-3 max-w-2xl text-gray-400">
              Des utilisateurs choisissent déjà D-BILLET pour réserver plus vite, payer sereinement et présenter leur billet sans friction.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {testimonials.slice(0, 3).map((testimonial, index) => (
              <div key={`${testimonial.author}-${index}`} className="rounded-[28px] border border-white/10 bg-[#0B0B10] p-6 shadow-[0_14px_40px_rgba(0,0,0,0.22)]">
                <div className="mb-4 flex items-center justify-between">
                  <Quote className="text-gold" size={22} />
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.max(1, Math.min(5, Number(testimonial.rating) || 5)) }).map((_, starIndex) => (
                      <Star key={starIndex} size={14} className="fill-gold text-gold" />
                    ))}
                  </div>
                </div>
                <p className="text-sm leading-7 text-gray-300">{testimonial.content}</p>
                <div className="mt-6 border-t border-white/10 pt-4">
                  <p className="font-medium text-white">{testimonial.author}</p>
                  <p className="text-xs uppercase tracking-[0.18em] text-gold">{testimonial.role || 'Client D-BILLET'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <h2 className="flex items-center justify-center gap-2 font-unbounded text-2xl text-white">
              <HelpCircle className="text-gold" size={26} />
              Questions fréquentes
            </h2>
            <p className="mt-2 text-gray-400">Tout ce que vous devez savoir avant de réserver sur D-BILLET.</p>
          </div>
          <div className="space-y-3">
            {FAQ_DATA.map((faq, index) => (
              <div key={faq.question} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-white/[0.03]"
                >
                  <span className="pr-4 font-medium text-white">{faq.question}</span>
                  {openFaq === index ? (
                    <Minus className="flex-shrink-0 text-gold" size={18} />
                  ) : (
                    <Plus className="flex-shrink-0 text-gold" size={18} />
                  )}
                </button>
                {openFaq === index && (
                  <div className="border-t border-white/10 px-5 pb-5 pt-4 text-gray-400">{faq.answer}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

const TransportCard = ({ to, title, subtitle, icon: Icon, color, border }) => (
  <Link
    to={to}
    className={`group flex items-center gap-4 rounded-[28px] border border-white/10 bg-[#0B0B10] p-6 shadow-[0_14px_40px_rgba(0,0,0,0.28)] transition-all ${border}`}
  >
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/[0.04]">
      <Icon className={`${color} transition-transform group-hover:scale-110`} size={32} />
    </div>
    <div className="flex-1">
      <p className={`text-xs uppercase tracking-[0.22em] ${color}`}>Transport</p>
      <h2 className="mt-2 font-unbounded text-xl text-white">{title}</h2>
      <p className="mt-1 text-sm text-gray-400">{subtitle}</p>
    </div>
    <ChevronRight className="text-gray-500 transition-colors group-hover:text-white" size={22} />
  </Link>
);

const EventCard = ({ event }) => {
  const eventPath = `/events/${event.id}/${event.slug || slugify(event.title)}`;
  const minPrice = event.min_price || event.price || 0;

  return (
    <Link to={eventPath} className="group block overflow-hidden rounded-[30px] border border-white/10 bg-[#0B0B10] transition-all hover:-translate-y-1 hover:border-gold/30">
      <div className="relative h-56 overflow-hidden">
        <img src={event.image_url || '/images/dbillet-logo.png'} alt={event.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />
        <div className="absolute left-4 top-4 rounded-full px-3 py-1 text-xs font-semibold text-black" style={{ backgroundColor: getCategoryColor(event.category) }}>
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

export default HomePage;
