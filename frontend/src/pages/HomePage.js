import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Search, MapPin, Calendar, ChevronRight, Train, Ship, Film, Trophy, Mic2, Music, 
  Star, AlertTriangle, Newspaper, Quote, LogOut, User, Ticket, Shield, Zap, 
  Clock, CreditCard, ChevronDown, Phone, Mail, Instagram, Facebook, Twitter,
  CheckCircle, HelpCircle, Plus, Minus
} from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';
import { useAuth } from '../context/AuthContext';
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

const ADVANTAGES = [
  { 
    icon: Ticket, 
    title: 'Billetterie 100% Numérique',
    description: 'Achetez vos billets en ligne et recevez-les instantanément sur votre téléphone. Plus besoin de faire la queue!'
  },
  { 
    icon: Shield, 
    title: 'Paiement Sécurisé',
    description: 'Transactions sécurisées via D-Money, Waafi ou CAC Bank. Vos données sont protégées.'
  },
  { 
    icon: Zap, 
    title: 'Accès Instantané',
    description: 'QR Code unique pour chaque billet. Scannez et entrez en quelques secondes.'
  },
  { 
    icon: Clock, 
    title: 'Disponible 24/7',
    description: 'Réservez à tout moment, de n\'importe où. Notre plateforme est toujours accessible.'
  },
];

const FAQ_DATA = [
  {
    question: 'Comment acheter un billet sur D-BILLEH?',
    answer: 'Sélectionnez l\'événement, choisissez votre type de billet, procédez au paiement via D-Money, Waafi ou CAC Bank, et recevez instantanément votre billet avec QR code par email ou dans l\'application.'
  },
  {
    question: 'Puis-je annuler ou rembourser mon billet?',
    answer: 'Les conditions de remboursement varient selon l\'organisateur. Consultez les conditions spécifiques de chaque événement avant l\'achat. En général, les remboursements sont possibles jusqu\'à 48h avant l\'événement.'
  },
  {
    question: 'Comment fonctionne le billet électronique?',
    answer: 'Après l\'achat, vous recevez un billet PDF avec un QR code unique. Présentez ce QR code sur votre téléphone à l\'entrée de l\'événement pour validation.'
  },
  {
    question: 'Quels moyens de paiement sont acceptés?',
    answer: 'Nous acceptons D-Money, Waafi et CAC Bank. Le paiement est sécurisé et instantané.'
  },
  {
    question: 'Comment installer D-BILLEH sur mon téléphone?',
    answer: 'D-BILLEH est une PWA (Progressive Web App). Sur votre navigateur, cliquez sur "Ajouter à l\'écran d\'accueil" dans le menu pour installer l\'application comme une app native.'
  },
  {
    question: 'Comment contacter le support?',
    answer: 'Contactez-nous par email à contact@d-billet.com ou par téléphone au +253 77 69 48 12. Notre équipe répond sous 24h.'
  },
];

const HOW_IT_WORKS = [
  {
    title: 'Choisissez votre sortie',
    description: 'Recherchez un evenement, un trajet ferry ou une reservation train depuis une seule plateforme.',
  },
  {
    title: 'Payez en ligne',
    description: 'Finalisez votre commande avec Waafi, D-Money ou CAC Bank selon le service disponible.',
  },
  {
    title: 'Recevez votre billet',
    description: 'Votre QR code est disponible en ligne pour un acces rapide le jour du depart ou de l evenement.',
  },
];

const HOME_LINKS = [
  { to: '/train', label: 'Billet train Djibouti' },
  { to: '/ferry', label: 'Reservation ferry Djibouti Obock' },
  { to: '/legal/privacy', label: 'Politique de confidentialite' },
  { to: '/terms', label: "Conditions d'utilisation D-Billet" },
];

const HomePage = () => {
  const { user, logout, isAuthenticated } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [testimonials, setTestimonials] = useState([]);
  const [news, setNews] = useState([]);
  const [openFaq, setOpenFaq] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      if (isPrerender) {
        const prerenderData = await loadPrerenderHomeData();
        setEvents(prerenderData.events || []);
        setTestimonials(prerenderData.testimonials || []);
        setNews(prerenderData.news || []);
        return;
      }

      const [eventsRes, testimonialsRes, newsRes] = await Promise.allSettled([
        axios.get(`${API}/events`),
        axios.get(`${API}/testimonials`),
        axios.get(`${API}/news`),
      ]);

      setEvents(eventsRes.status === 'fulfilled' ? eventsRes.value.data : []);
      setTestimonials(
        testimonialsRes.status === 'fulfilled' ? testimonialsRes.value.data : []
      );
      setNews(newsRes.status === 'fulfilled' ? newsRes.value.data : []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      const filtered = events.filter(ev => 
        ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ev.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setEvents(filtered);
    } else {
      fetchData();
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-DJ').format(price) + ' DJF';
  };

  const featuredEvents = events.slice(0, 6).map((event) => ({
    '@type': 'Event',
    name: event.title,
    startDate: event.date,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    location: {
      '@type': 'Place',
      name: event.venue || 'Djibouti',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Djibouti',
        addressCountry: 'DJ',
      },
    },
    image: event.image_url ? [event.image_url] : [absoluteUrl('/images/dbillet-logo.png')],
    description: event.description,
    offers: {
      '@type': 'Offer',
      priceCurrency: 'DJF',
      price: event.min_price || event.price || 0,
      availability:
        (event.available_tickets || 0) > 0
          ? 'https://schema.org/InStock'
          : 'https://schema.org/SoldOut',
      url: absoluteUrl(`/events/${event.id}/${slugify(event.title)}`),
    },
    organizer: {
      '@type': 'Organization',
      name: 'D-Billet',
      url: absoluteUrl('/'),
    },
  }));

  const faqStructuredData = {
    '@type': 'FAQPage',
    mainEntity: FAQ_DATA.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  const organizationStructuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'D-Billet',
        url: absoluteUrl('/'),
        logo: absoluteUrl('/images/dbillet-logo.png'),
        contactPoint: {
          '@type': 'ContactPoint',
          contactType: 'customer support',
          telephone: '+25377694812',
          email: 'contact@d-billet.com',
          areaServed: 'DJ',
          availableLanguage: ['fr', 'ar'],
        },
      },
      {
        '@type': 'WebSite',
        name: 'D-Billet',
        url: absoluteUrl('/'),
        inLanguage: 'fr-DJ',
      },
      faqStructuredData,
      ...featuredEvents,
    ],
  };

  return (
    <div className="min-h-screen bg-[#050505]">
      <Seo
        title="Billetterie Djibouti, Train et Ferry"
        description="D-Billet est la plateforme de billetterie de Djibouti pour les evenements, les reservations train et ferry. Achetez vos billets en ligne."
        path="/"
        structuredData={organizationStructuredData}
      />
      {/* Hero Section - Modern Presentation */}
      <section className="relative h-[70vh] md:h-[75vh] overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ 
            backgroundImage: 'url(https://images.unsplash.com/photo-1492684223066-81342ee5ff30?crop=entropy&cs=srgb&fm=jpg&q=85)',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-[#050505]" />
        </div>
        
        {/* Floating particles effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-2 h-2 bg-gold rounded-full animate-pulse opacity-60"></div>
          <div className="absolute top-40 right-20 w-3 h-3 bg-gold rounded-full animate-pulse opacity-40"></div>
          <div className="absolute bottom-40 left-1/4 w-2 h-2 bg-gold rounded-full animate-pulse opacity-50"></div>
          <div className="absolute top-1/3 right-1/4 w-1 h-1 bg-gold rounded-full animate-pulse opacity-70"></div>
        </div>
        
        <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 text-center">
          {/* Main Title with gradient */}
          <div className="mb-6">
            <h1 className="font-unbounded text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-4 tracking-tight">
              <span className="bg-gradient-to-r from-gold via-yellow-300 to-gold bg-clip-text text-transparent drop-shadow-2xl">
                D-BILLEH
              </span>
            </h1>
            <div className="w-24 h-1 bg-gradient-to-r from-transparent via-gold to-transparent mx-auto mb-4"></div>
          </div>
          
          {/* Tagline */}
          <p className="text-xl md:text-2xl text-white/90 font-light max-w-2xl mb-2">
            Un clic, et vous y êtes
          </p>
          <p className="text-gray-400 text-base md:text-lg max-w-xl mb-8">
            La billetterie officielle de Djibouti pour vos événements, train et ferry
          </p>
          
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="w-full max-w-xl mb-8">
            <div className="relative glass rounded-2xl p-2 border border-gold/30 backdrop-blur-xl">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gold" size={22} />
              <Input
                type="text"
                placeholder="Rechercher un événement, concert, match..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-14 h-14 bg-transparent border-0 text-white placeholder:text-gray-500 rounded-xl text-base"
                data-testid="search-input"
              />
              <Button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-xl bg-gold hover:bg-gold-light text-black font-semibold px-6 h-10">
                Rechercher
              </Button>
            </div>
          </form>
          
          {/* Quick Stats */}
          <div className="flex items-center gap-8 text-center">
            <div>
              <p className="text-3xl md:text-4xl font-bold text-gold">500+</p>
              <p className="text-gray-400 text-sm">Événements</p>
            </div>
            <div className="w-px h-12 bg-white/20"></div>
            <div>
              <p className="text-3xl md:text-4xl font-bold text-gold">10K+</p>
              <p className="text-gray-400 text-sm">Utilisateurs</p>
            </div>
            <div className="w-px h-12 bg-white/20"></div>
            <div>
              <p className="text-3xl md:text-4xl font-bold text-gold">100%</p>
              <p className="text-gray-400 text-sm">Sécurisé</p>
            </div>
          </div>
        </div>
        
        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce">
          <ChevronDown className="text-gold" size={28} />
        </div>
      </section>

      {/* Transport Section */}
      <section className="py-8 px-4 -mt-8 relative z-20">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-unbounded text-xl text-white mb-4">Transport</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link 
              to="/train" 
              className="glass p-6 rounded-2xl flex items-center gap-4 hover:border-gold/50 transition-all group"
              data-testid="train-link"
            >
              <div className="w-16 h-16 rounded-xl bg-gold/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Train className="text-gold" size={32} />
              </div>
              <div className="flex-1">
                <h3 className="font-unbounded text-lg text-white mb-1">Train</h3>
                <p className="text-gray-400 text-sm">Djibouti - Éthiopie</p>
                <p className="text-gold text-sm mt-1">À partir de 400 DJF</p>
              </div>
              <ChevronRight className="text-gray-500 group-hover:text-gold transition-colors" size={24} />
            </Link>

            <Link 
              to="/ferry" 
              className="glass p-6 rounded-2xl flex items-center gap-4 hover:border-ferry/50 transition-all group"
              data-testid="ferry-link"
            >
              <div className="w-16 h-16 rounded-xl bg-ferry/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Ship className="text-ferry" size={32} />
              </div>
              <div className="flex-1">
                <h3 className="font-unbounded text-lg text-white mb-1">Ferry</h3>
                <p className="text-gray-400 text-sm">Djibouti - Tadjoura - Obock</p>
                <p className="text-ferry text-sm mt-1">1100 FDJ</p>
              </div>
              <ChevronRight className="text-gray-500 group-hover:text-ferry transition-colors" size={24} />
            </Link>
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-6 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="font-unbounded text-xl text-white mb-4">Catégories</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  const filtered = events.filter(ev => ev.category === cat.id);
                  if (filtered.length > 0) {
                    setEvents(filtered);
                  }
                }}
                className="glass p-4 flex flex-col items-center gap-2 hover:border-gold/30 transition-all group rounded-xl"
                data-testid={`category-${cat.id}`}
              >
                <div 
                  className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ backgroundColor: `${cat.color}20` }}
                >
                  <cat.icon size={24} style={{ color: cat.color }} />
                </div>
                <span className="text-sm text-gray-300 group-hover:text-white">{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Events List */}
      <section className="py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-unbounded text-xl text-white">Événements</h2>
            <Button 
              variant="ghost" 
              onClick={fetchData}
              className="text-gold hover:text-gold-light hover:bg-gold/10"
            >
              Voir tout
            </Button>
          </div>
          
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array(6).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-2xl" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-16 glass rounded-xl">
              <p className="text-gray-400">Aucun événement disponible</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.slice(0, 6).map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="py-12 px-4 border-t border-white/5">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 items-start">
          <div>
            <h2 className="font-unbounded text-2xl text-white mb-4">Billetterie en ligne a Djibouti</h2>
            <div className="space-y-4 text-gray-300 leading-7">
              <p>
                D-Billet centralise la reservation de billets pour les concerts, matchs, conferences,
                trajets ferry et trajets train au depart de Djibouti. L objectif est simple: permettre
                aux voyageurs, spectateurs et organisateurs de retrouver les informations utiles sur une
                seule plateforme.
              </p>
              <p>
                Cette page d accueil presente les evenements a venir, les services de transport
                disponibles, les moyens de paiement acceptes et les informations pratiques pour acheter
                un billet en ligne sans se deplacer. Les pages evenement contiennent ensuite la date,
                le lieu, la description, le prix et la disponibilite en temps reel.
              </p>
              <p>
                Pour les recherches de type <strong className="text-white">billetterie Djibouti</strong>,
                <strong className="text-white"> billet ferry Djibouti</strong> ou
                <strong className="text-white"> reservation train Djibouti</strong>, D-Billet sert de point
                d entree unique vers les principaux services publics et prives de reservation.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {HOW_IT_WORKS.map((item) => (
              <div key={item.title} className="glass p-5 rounded-2xl">
                <p className="text-gold text-xs uppercase tracking-[0.18em] mb-2">Parcours</p>
                <h3 className="font-unbounded text-white text-lg mb-2">{item.title}</h3>
                <p className="text-gray-400 text-sm leading-6">{item.description}</p>
              </div>
            ))}
            <div className="glass p-5 rounded-2xl sm:col-span-2">
              <p className="text-gold text-xs uppercase tracking-[0.18em] mb-2">Liens utiles</p>
              <div className="flex flex-wrap gap-3">
                {HOME_LINKS.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-sm text-gray-200 hover:text-white hover:border-gold/40 transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Advantages Section - Desktop Only */}
      <section className="hidden lg:block py-16 px-4 bg-gradient-to-b from-transparent via-gold/5 to-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-unbounded text-3xl text-white mb-4">Pourquoi choisir D-BILLEH?</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              La première plateforme de billetterie 100% djiboutienne, conçue pour simplifier votre accès aux événements
            </p>
          </div>
          
          <div className="grid grid-cols-4 gap-6">
            {ADVANTAGES.map((adv, idx) => (
              <div 
                key={idx}
                className="glass p-6 rounded-2xl text-center hover:border-gold/30 transition-all group"
              >
                <div className="w-16 h-16 rounded-2xl bg-gold/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <adv.icon className="text-gold" size={32} />
                </div>
                <h3 className="font-unbounded text-white text-lg mb-2">{adv.title}</h3>
                <p className="text-gray-400 text-sm">{adv.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      {testimonials.length > 0 && (
        <section className="py-12 px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="font-unbounded text-xl text-white mb-6 flex items-center gap-2">
              <Star className="text-gold" size={24} />
              Témoignages
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {testimonials.slice(0, 3).map((test, idx) => (
                <div key={idx} className="glass p-6 rounded-2xl">
                  <Quote className="text-gold/30 mb-4" size={32} />
                  <p className="text-gray-300 mb-4 italic">"{test.content}"</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
                      <User className="text-gold" size={20} />
                    </div>
                    <div>
                      <p className="text-white font-semibold">{test.author}</p>
                      <p className="text-gray-500 text-sm">{test.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* News */}
      {news.length > 0 && (
        <section className="py-12 px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="font-unbounded text-xl text-white mb-6 flex items-center gap-2">
              <Newspaper className="text-gold" size={24} />
              Actualités
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {news.slice(0, 2).map((item, idx) => (
                <div key={idx} className="glass p-6 rounded-2xl flex gap-4 hover:border-gold/30 transition-all">
                  {item.image_url && (
                    <img src={item.image_url} alt={item.title} className="w-24 h-24 rounded-xl object-cover" />
                  )}
                  <div>
                    <h3 className="font-unbounded text-white mb-2">{item.title}</h3>
                    <p className="text-gray-400 text-sm line-clamp-2">{item.excerpt}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {events.length > 0 && (
        <section className="py-12 px-4 border-t border-white/5">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-end justify-between gap-4 mb-6">
              <div>
                <h2 className="font-unbounded text-2xl text-white mb-2">Agenda complet des evenements</h2>
                <p className="text-gray-400 max-w-3xl">
                  Cette section regroupe les pages evenement publiques pour faciliter la navigation,
                  la decouverte des sorties a Djibouti et le pre-rendu des fiches importantes.
                </p>
              </div>
              <span className="text-xs uppercase tracking-[0.18em] text-gold">
                {events.length} pages publiques
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {events.map((event) => {
                const eventPath = `/events/${event.id}/${event.slug || slugify(event.title)}`;

                return (
                  <Link
                    key={event.id}
                    to={eventPath}
                    className="glass rounded-2xl p-4 border border-white/5 hover:border-gold/30 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-medium text-white line-clamp-2">{event.title}</h3>
                        <p className="text-sm text-gray-400 mt-1 line-clamp-1">{event.venue}</p>
                      </div>
                      <ChevronRight className="text-gold flex-shrink-0" size={18} />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                      <span>{event.date}</span>
                      <span>{event.min_price > 0 ? `${event.min_price} DJF` : 'Gratuit'}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* FAQ Section */}
      <section className="py-12 px-4">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="font-unbounded text-2xl text-white mb-2 flex items-center justify-center gap-2">
              <HelpCircle className="text-gold" size={28} />
              Questions Fréquentes
            </h2>
            <p className="text-gray-400">Tout ce que vous devez savoir sur D-BILLEH</p>
          </div>
          
          <div className="space-y-3">
            {FAQ_DATA.map((faq, idx) => (
              <div 
                key={idx}
                className="glass rounded-xl overflow-hidden"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full p-5 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                >
                  <span className="text-white font-medium pr-4">{faq.question}</span>
                  {openFaq === idx ? (
                    <Minus className="text-gold flex-shrink-0" size={20} />
                  ) : (
                    <Plus className="text-gold flex-shrink-0" size={20} />
                  )}
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-5 text-gray-400 border-t border-white/10 pt-4">
                    {faq.answer}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

const EventCard = ({ event }) => {
  const eventPath = `/events/${event.id}/${event.slug || slugify(event.title)}`;
  
  const getCategoryColor = (category) => {
    const colors = {
      cinema: '#FF0055',
      football: '#D4AF37',
      concerts: '#7000FF',
      conferences: '#FF5C00',
    };
    return colors[category] || '#D4AF37';
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-DJ').format(price) + ' DJF';
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const categoryColor = getCategoryColor(event.category);
  const minPrice = event.min_price || event.price || 0;

  return (
    <Link
      to={eventPath}
      className="group relative overflow-hidden rounded-2xl bg-card border border-white/5 
        hover:border-gold/30 transition-all duration-300 cursor-pointer h-64 block"
      data-testid={`event-card-${event.id}`}
    >
      {/* Image */}
      <div className="absolute inset-0">
        <img
          src={event.image_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?crop=entropy&cs=srgb&fm=jpg&q=85'}
          alt={event.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
      </div>

      {/* Low Stock Badge */}
      {event.low_stock && (
        <div className="absolute top-4 right-4 px-3 py-1 rounded-full bg-red-500 text-white text-xs font-bold flex items-center gap-1 animate-pulse">
          <AlertTriangle size={12} />
          Plus que {event.low_stock_count} places!
        </div>
      )}

      {/* Category Badge */}
      <div 
        className="absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold uppercase"
        style={{ backgroundColor: categoryColor, color: '#000' }}
      >
        {event.category}
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <h3 className="font-unbounded font-semibold text-white mb-2 line-clamp-2 text-lg group-hover:-translate-y-1 transition-transform">
          {event.title}
        </h3>
        <div className="flex items-center gap-4 text-gray-300 text-sm mb-3">
          <span className="flex items-center gap-1">
            <Calendar size={14} />
            {formatDate(event.date)}
          </span>
          <span className="flex items-center gap-1">
            <MapPin size={14} />
            {event.venue?.split(' - ')[0]}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="font-mono font-bold text-gold text-lg">
            {minPrice > 0 ? `À partir de ${formatPrice(minPrice)}` : 'Gratuit'}
          </span>
          <span className="text-xs text-gray-400">
            {event.available_tickets || 0} places
          </span>
        </div>
      </div>

      {/* Hover Arrow */}
      <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-gold/20 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="text-gold" size={20} />
      </div>
    </Link>
  );
};

export default HomePage;
