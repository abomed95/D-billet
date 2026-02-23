import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, MapPin, Calendar, ChevronRight, Train, Ship, Film, Trophy, Mic2, Music, Star, AlertTriangle, Newspaper, Quote } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORIES = [
  { id: 'cinema', label: 'Cinéma', icon: Film, color: '#FF0055' },
  { id: 'football', label: 'Football', icon: Trophy, color: '#00FF94' },
  { id: 'concerts', label: 'Concerts', icon: Music, color: '#7000FF' },
  { id: 'conferences', label: 'Conférences', icon: Mic2, color: '#FF5C00' },
];

const HomePage = () => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [testimonials, setTestimonials] = useState([]);
  const [news, setNews] = useState([]);
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

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-DJ').format(price) + ' DJF';
  };

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Hero Section */}
      <section className="relative h-[50vh] overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ 
            backgroundImage: 'url(https://images.unsplash.com/photo-1639323252699-23cd48cccea6?crop=entropy&cs=srgb&fm=jpg&q=85)',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-[#050505]" />
        </div>
        
        <div className="relative z-10 h-full flex flex-col items-center justify-center px-4 text-center">
          <h1 className="font-unbounded font-bold text-4xl md:text-5xl text-white mb-4">
            Bienvenue sur<br />
            <span className="text-green-400">D-BILLET</span>
          </h1>
          
          <p className="text-gray-300 text-lg max-w-xl mb-6">
            Billetterie officielle de Djibouti - Événements, Train, Ferry
          </p>
          
          {/* Search Bar */}
          <form onSubmit={handleSearch} className="w-full max-w-lg">
            <div className="relative glass rounded-full p-2">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <Input
                type="text"
                placeholder="Rechercher un événement..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 bg-transparent border-0 text-white placeholder:text-gray-500 rounded-full"
                data-testid="search-input"
              />
              <Button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-green-500 hover:bg-green-600 text-black">
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
              className="glass p-6 rounded-2xl flex items-center gap-4 hover:border-train/50 transition-all group"
              data-testid="train-link"
            >
              <div className="w-16 h-16 rounded-xl bg-train/20 flex items-center justify-center group-hover:scale-110 transition-transform">
                <Train className="text-train" size={32} />
              </div>
              <div className="flex-1">
                <h3 className="font-unbounded text-lg text-white mb-1">Train</h3>
                <p className="text-gray-400 text-sm">Djibouti - Éthiopie</p>
                <p className="text-train text-sm mt-1">À partir de 400 DJF</p>
              </div>
              <ChevronRight className="text-gray-500 group-hover:text-train transition-colors" size={24} />
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
                className="glass p-4 flex flex-col items-center gap-2 hover:border-white/30 transition-all group rounded-xl"
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
              className="text-gray-400 hover:text-white"
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
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Testimonials Section - Desktop/Tablet Only */}
      <section className="hidden md:block py-12 px-4 bg-gradient-to-b from-transparent via-green-500/5 to-transparent">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8">
            <h2 className="font-unbounded text-2xl text-white mb-2">Ce que disent nos clients</h2>
            <p className="text-gray-400">Des milliers de Djiboutiens nous font confiance</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <div key={testimonial.id || index} className="glass p-6 rounded-2xl">
                <Quote className="text-green-500/50 mb-4" size={32} />
                <p className="text-gray-300 mb-4 italic">"{testimonial.content}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center">
                    <span className="text-green-400 font-bold text-lg">
                      {testimonial.author_name?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <div>
                    <p className="text-white font-semibold">{testimonial.author_name}</p>
                    <p className="text-gray-500 text-sm">{testimonial.author_role}</p>
                  </div>
                </div>
                <div className="flex gap-1 mt-3">
                  {Array(testimonial.rating || 5).fill(0).map((_, i) => (
                    <Star key={i} className="text-yellow-500 fill-yellow-500" size={16} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* News Section - Desktop/Tablet Only */}
      <section className="hidden md:block py-12 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Newspaper className="text-green-400" size={28} />
            <h2 className="font-unbounded text-2xl text-white">Actualités</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {news.map((item, index) => (
              <div key={item.id || index} className="glass rounded-2xl overflow-hidden flex group cursor-pointer hover:border-green-500/30 transition-all">
                <div className="w-1/3 h-40">
                  <img 
                    src={item.image_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400'} 
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <div className="flex-1 p-5">
                  <h3 className="font-unbounded font-semibold text-white mb-2 group-hover:text-green-400 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-gray-400 text-sm line-clamp-2">{item.excerpt}</p>
                  <p className="text-gray-500 text-xs mt-3">
                    {new Date(item.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/10">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="font-unbounded font-bold text-xl text-green-400 mb-4">D-BILLET</h3>
              <p className="text-gray-400 text-sm">La billetterie de Djibouti</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Navigation</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><Link to="/" className="hover:text-white">Accueil</Link></li>
                <li><Link to="/train" className="hover:text-white">Train</Link></li>
                <li><Link to="/ferry" className="hover:text-white">Ferry</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Contact</h4>
              <p className="text-gray-400 text-sm">WhatsApp: +253 77 00 00 01</p>
              <p className="text-gray-400 text-sm">support@dbillet.dj</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Légal</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><Link to="/terms" className="hover:text-white">Conditions d'utilisation</Link></li>
              </ul>
            </div>
          </div>
          <div className="text-center text-gray-500 text-sm pt-8 border-t border-white/10">
            © 2025 D-Billet. Djibouti.
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
      football: '#00FF94',
      concerts: '#7000FF',
      conferences: '#FF5C00',
    };
    return colors[category] || '#7000FF';
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
        hover:border-green-500/30 transition-all duration-300 cursor-pointer h-64"
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
        style={{ backgroundColor: categoryColor, color: '#fff' }}
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
          <span className="font-mono font-bold text-green-400 text-lg">
            {minPrice > 0 ? `À partir de ${formatPrice(minPrice)}` : 'Gratuit'}
          </span>
          <span className="text-xs text-gray-400">
            {event.available_tickets || 0} places
          </span>
        </div>
      </div>

      {/* Hover Arrow */}
      <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="text-white" size={20} />
      </div>
    </div>
  );
};

export default HomePage;
