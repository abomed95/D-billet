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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

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
    answer: 'Contactez-nous par email à support@dbilleh.dj ou par téléphone au +253 77 XX XX XX. Notre équipe répond sous 24h.'
  },
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
      await axios.post(`${API}/seed`).catch(() => {});
      const [eventsRes, testimonialsRes, newsRes] = await Promise.all([
        axios.get(`${API}/events`),
        axios.get(`${API}/testimonials`),
        axios.get(`${API}/news`)
      ]);
      setEvents(eventsRes.data);
      setTestimonials(testimonialsRes.data);
      setNews(newsRes.data);
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

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Hero Section */}
      <section className="relative h-[55vh] md:h-[60vh] overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ 
            backgroundImage: 'url(https://images.unsplash.com/photo-1639323252699-23cd48cccea6?crop=entropy&cs=srgb&fm=jpg&q=85)',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-black/60 to-[#050505]" />
        </div>
        
        {/* User Menu - Top Right */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-3">
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Link 
                to="/my-tickets"
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-gold/20 border border-gold/30 text-gold hover:bg-gold/30 transition-all"
              >
                <Ticket size={18} />
                <span className="hidden sm:inline">Mes Billets</span>
              </Link>
              <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/10 border border-white/20">
                <div className="w-8 h-8 rounded-full bg-gold/30 flex items-center justify-center">
                  <User className="text-gold" size={18} />
                </div>
                <span className="text-white text-sm hidden sm:inline">{user?.full_name?.split(' ')[0]}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-gray-400 hover:text-red-400 hover:bg-red-500/10"
                data-testid="logout-btn"
              >
                <LogOut size={18} />
              </Button>
            </div>
          ) : (
            <Link 
              to="/auth"
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-gold text-black font-semibold hover:bg-gold-light transition-all"
              data-testid="login-btn"
            >
              <User size={18} />
              Connexion
            </Link>
          )}
        </div>
        
        <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 text-center">
          {/* Logo */}
          <img 
            src="/images/dbilleh-logo.png" 
            alt="D-BILLEH" 
            className="h-32 md:h-40 mb-4 drop-shadow-2xl"
          />
          
          <p className="text-gray-300 text-lg max-w-xl mb-6">
            Un clic, et vous y êtes - Billetterie officielle de Djibouti
          </p>
          
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="w-full max-w-lg">
            <div className="relative glass rounded-full p-2 border border-gold/30">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gold" size={20} />
              <Input
                type="text"
                placeholder="Rechercher un événement..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 bg-transparent border-0 text-white placeholder:text-gray-500 rounded-full"
                data-testid="search-input"
              />
              <Button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-gold hover:bg-gold-light text-black font-semibold">
                Rechercher
              </Button>
            </div>
          </form>
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
                <p className="text-ferry text-sm mt-1">700 DJF</p>
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

      {/* Footer - Mobile */}
      <footer className="lg:hidden py-8 px-4 border-t border-white/10">
        <div className="max-w-6xl mx-auto text-center">
          <img src="/images/dbilleh-logo.png" alt="D-BILLEH" className="h-16 mx-auto mb-4" />
          <p className="text-gray-400 text-sm mb-4">Un clic, et vous y êtes</p>
          <div className="flex justify-center gap-4 mb-6">
            <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-gold/20 transition-colors">
              <Facebook className="text-gray-400 hover:text-gold" size={20} />
            </a>
            <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-gold/20 transition-colors">
              <Instagram className="text-gray-400 hover:text-gold" size={20} />
            </a>
            <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-gold/20 transition-colors">
              <Twitter className="text-gray-400 hover:text-gold" size={20} />
            </a>
          </div>
          <div className="text-gray-500 text-xs">
            © 2025 D-BILLEH. Djibouti. Tous droits réservés.
          </div>
        </div>
      </footer>

      {/* Footer - Desktop (Two sections) */}
      <footer className="hidden lg:block border-t border-white/10">
        {/* Upper Footer */}
        <div className="py-12 px-4 bg-gradient-to-b from-transparent to-gold/5">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-4 gap-8">
              {/* Brand */}
              <div className="col-span-1">
                <img src="/images/dbilleh-logo.png" alt="D-BILLEH" className="h-20 mb-4" />
                <p className="text-gray-400 text-sm mb-4">
                  La billetterie officielle de Djibouti pour tous vos événements, transports en train et ferry.
                </p>
                <div className="flex gap-3">
                  <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-gold/30 transition-colors">
                    <Facebook className="text-gray-400 hover:text-gold" size={18} />
                  </a>
                  <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-gold/30 transition-colors">
                    <Instagram className="text-gray-400 hover:text-gold" size={18} />
                  </a>
                  <a href="#" className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-gold/30 transition-colors">
                    <Twitter className="text-gray-400 hover:text-gold" size={18} />
                  </a>
                </div>
              </div>
              
              {/* Navigation */}
              <div>
                <h4 className="font-unbounded text-gold mb-4">Navigation</h4>
                <ul className="space-y-2 text-gray-400 text-sm">
                  <li><Link to="/" className="hover:text-gold transition-colors">Accueil</Link></li>
                  <li><Link to="/train" className="hover:text-gold transition-colors">Train</Link></li>
                  <li><Link to="/ferry" className="hover:text-gold transition-colors">Ferry</Link></li>
                  <li><Link to="/my-tickets" className="hover:text-gold transition-colors">Mes Billets</Link></li>
                </ul>
              </div>
              
              {/* Services */}
              <div>
                <h4 className="font-unbounded text-gold mb-4">Services</h4>
                <ul className="space-y-2 text-gray-400 text-sm">
                  <li><span className="hover:text-gold cursor-pointer transition-colors">Événements</span></li>
                  <li><span className="hover:text-gold cursor-pointer transition-colors">Organisateurs</span></li>
                  <li><span className="hover:text-gold cursor-pointer transition-colors">API Partenaires</span></li>
                </ul>
              </div>
              
              {/* Contact */}
              <div>
                <h4 className="font-unbounded text-gold mb-4">Contact</h4>
                <ul className="space-y-3 text-gray-400 text-sm">
                  <li className="flex items-center gap-2">
                    <Mail size={16} className="text-gold" />
                    support@dbilleh.dj
                  </li>
                  <li className="flex items-center gap-2">
                    <Phone size={16} className="text-gold" />
                    +253 77 XX XX XX
                  </li>
                  <li className="flex items-center gap-2">
                    <MapPin size={16} className="text-gold" />
                    Djibouti Ville
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        
        {/* Lower Footer */}
        <div className="py-6 px-4 bg-black/50">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-gray-500 text-sm">
              © 2025 D-BILLEH. Tous droits réservés. République de Djibouti.
            </div>
            <div className="flex items-center gap-6 text-gray-500 text-sm">
              <Link to="/terms" className="hover:text-gold transition-colors">Conditions d'utilisation</Link>
              <span className="text-gray-700">|</span>
              <span className="hover:text-gold cursor-pointer transition-colors">Politique de confidentialité</span>
              <span className="text-gray-700">|</span>
              <span className="hover:text-gold cursor-pointer transition-colors">Mentions légales</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

const EventCard = ({ event }) => {
  const navigate = useNavigate();
  
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
    <div
      onClick={() => navigate(`/event/${event.id}`)}
      className="group relative overflow-hidden rounded-2xl bg-card border border-white/5 
        hover:border-gold/30 transition-all duration-300 cursor-pointer h-64"
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
    </div>
  );
};

export default HomePage;
