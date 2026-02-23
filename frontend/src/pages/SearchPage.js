import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Search, Filter, Calendar, MapPin, ChevronRight, X } from 'lucide-react';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Skeleton } from '../components/ui/skeleton';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORIES = [
  { id: 'concert', label: 'Concert' },
  { id: 'sport', label: 'Sport' },
  { id: 'conference', label: 'Conférence' },
  { id: 'cinema', label: 'Cinéma' },
  { id: 'theatre', label: 'Théâtre' },
  { id: 'festival', label: 'Festival' },
];

const DATE_FILTERS = [
  { id: 'today', label: "Aujourd'hui" },
  { id: 'tomorrow', label: 'Demain' },
  { id: 'weekend', label: 'Ce week-end' },
];

const SearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  
  const category = searchParams.get('category');
  const dateFilter = searchParams.get('date');
  const featured = searchParams.get('featured');

  useEffect(() => {
    fetchEvents();
  }, [searchParams]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchParams.get('q')) params.append('search', searchParams.get('q'));
      if (category) params.append('category', category);
      if (dateFilter) params.append('date_filter', dateFilter);
      if (featured) params.append('featured', 'true');

      const response = await axios.get(`${API}/events?${params.toString()}`);
      setEvents(response.data);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (searchQuery.trim()) {
      newParams.set('q', searchQuery);
    } else {
      newParams.delete('q');
    }
    setSearchParams(newParams);
  };

  const toggleFilter = (type, value) => {
    const newParams = new URLSearchParams(searchParams);
    if (newParams.get(type) === value) {
      newParams.delete(type);
    } else {
      newParams.set(type, value);
    }
    setSearchParams(newParams);
  };

  const clearFilters = () => {
    setSearchParams({});
    setSearchQuery('');
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-DJ').format(price) + ' DJF';
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const hasActiveFilters = category || dateFilter || featured || searchParams.get('q');

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Search Bar */}
        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <Input
              type="text"
              placeholder="Rechercher un événement..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 text-lg"
              data-testid="search-input"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  const newParams = new URLSearchParams(searchParams);
                  newParams.delete('q');
                  setSearchParams(newParams);
                }}
                className="absolute right-16 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <X size={20} />
              </button>
            )}
            <Button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2">
              Rechercher
            </Button>
          </div>
        </form>

        {/* Filters */}
        <div className="mb-6 space-y-4">
          {/* Date Filters */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {DATE_FILTERS.map((filter) => (
              <button
                key={filter.id}
                onClick={() => toggleFilter('date', filter.id)}
                className={`px-4 py-2 rounded-full whitespace-nowrap transition-all text-sm
                  ${dateFilter === filter.id 
                    ? 'bg-primary text-white neon-glow' 
                    : 'glass text-gray-300 hover:text-white'}`}
                data-testid={`filter-date-${filter.id}`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Category Filters */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => toggleFilter('category', cat.id)}
                className={`px-4 py-2 rounded-full whitespace-nowrap transition-all text-sm
                  ${category === cat.id 
                    ? 'bg-accent-pink text-white neon-glow-pink' 
                    : 'glass text-gray-300 hover:text-white'}`}
                data-testid={`filter-category-${cat.id}`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="text-sm text-gray-400 hover:text-white flex items-center gap-1"
            >
              <X size={16} />
              Effacer les filtres
            </button>
          )}
        </div>

        {/* Results Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-unbounded font-semibold text-xl text-white">
            {searchParams.get('q') ? `Résultats pour "${searchParams.get('q')}"` : 'Tous les événements'}
          </h2>
          <span className="text-gray-400">{events.length} événement(s)</span>
        </div>

        {/* Results Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(6).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Search className="mx-auto text-gray-500 mb-4" size={48} />
            <h3 className="font-unbounded font-bold text-xl text-white mb-2">Aucun résultat</h3>
            <p className="text-gray-400 mb-4">
              Essayez de modifier vos critères de recherche
            </p>
            <Button onClick={clearFilters} variant="outline">
              Réinitialiser les filtres
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <div
                key={event.id}
                onClick={() => navigate(`/event/${event.id}`)}
                className="group relative overflow-hidden rounded-2xl h-72 bg-card border border-white/5 hover:border-primary/30 transition-all duration-300 cursor-pointer"
                data-testid={`search-result-${event.id}`}
              >
                <div className="absolute inset-0">
                  <img
                    src={event.image_url}
                    alt={event.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <h3 className="font-unbounded font-semibold text-lg text-white mb-2 line-clamp-2">
                    {event.title}
                  </h3>
                  <div className="flex items-center gap-4 text-gray-300 text-sm mb-3">
                    <span className="flex items-center gap-1">
                      <Calendar size={14} />
                      {formatDate(event.date_start)}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin size={14} />
                      {event.location_name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-white">{formatPrice(event.price_djf)}</span>
                    <span className="text-xs text-gray-400">{event.available_capacity} places</span>
                  </div>
                </div>

                <div className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight className="text-white" size={20} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
