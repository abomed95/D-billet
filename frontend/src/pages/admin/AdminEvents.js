import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { 
  Calendar, Search, Filter, Star, Check, X, Trash2, 
  Eye, MoreVertical, Loader2, Building, Clock, CheckCircle, XCircle
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminEvents = () => {
  const { getAuthHeaders } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleteEvent, setDeleteEvent] = useState(null);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await axios.get(`${API}/admin/events`, {
        headers: getAuthHeaders()
      });
      setEvents(response.data);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (eventId, status) => {
    setProcessing(eventId);
    try {
      await axios.put(
        `${API}/admin/events/${eventId}/status?status=${status}`,
        {},
        { headers: getAuthHeaders() }
      );
      toast.success(`Événement ${status === 'approved' ? 'approuvé' : status === 'blocked' ? 'bloqué' : 'mis en attente'}`);
      fetchEvents();
    } catch (error) {
      toast.error('Erreur');
    } finally {
      setProcessing(null);
    }
  };

  const toggleFeatured = async (eventId, featured) => {
    setProcessing(eventId);
    try {
      await axios.put(
        `${API}/admin/events/${eventId}/featured?featured=${featured}`,
        {},
        { headers: getAuthHeaders() }
      );
      toast.success(featured ? 'Événement mis à la une!' : 'Événement retiré de la une');
      fetchEvents();
    } catch (error) {
      toast.error('Erreur');
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteEvent) return;
    setProcessing(deleteEvent.id);
    try {
      await axios.delete(`${API}/events/${deleteEvent.id}`, {
        headers: getAuthHeaders()
      });
      toast.success('Événement supprimé');
      setDeleteEvent(null);
      fetchEvents();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    } finally {
      setProcessing(null);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-DJ').format(price) + ' DJF';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'approved':
        return (
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">
            <CheckCircle size={12} />
            Approuvé
          </span>
        );
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-medium">
            <Clock size={12} />
            En attente
          </span>
        );
      case 'blocked':
        return (
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">
            <XCircle size={12} />
            Bloqué
          </span>
        );
      default:
        return getStatusBadge('approved');
    }
  };

  const filteredEvents = events.filter(event => {
    // Status filter
    if (statusFilter !== 'all' && event.status !== statusFilter) {
      if (statusFilter === 'featured' && !event.featured) return false;
      if (statusFilter !== 'featured' && event.status !== statusFilter) return false;
    }
    
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        event.title?.toLowerCase().includes(searchLower) ||
        event.venue?.toLowerCase().includes(searchLower) ||
        event.organizer?.full_name?.toLowerCase().includes(searchLower) ||
        event.category?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-unbounded font-bold text-2xl md:text-3xl text-white mb-2">
            Gestion des Événements
          </h1>
          <p className="text-gray-400">{events.length} événement(s) sur la plateforme</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass p-4 rounded-xl">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par titre, lieu, organisateur..."
              className="pl-10 bg-white/5 border-white/10"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-48 bg-white/5 border-white/10">
              <Filter size={16} className="mr-2 text-gray-400" />
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="approved">Approuvés</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="blocked">Bloqués</SelectItem>
              <SelectItem value="featured">À la une</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass p-4 rounded-xl">
          <p className="text-gray-400 text-sm">Total</p>
          <p className="font-mono font-bold text-xl text-white">{events.length}</p>
        </div>
        <div className="glass p-4 rounded-xl">
          <p className="text-gray-400 text-sm">Approuvés</p>
          <p className="font-mono font-bold text-xl text-green-400">
            {events.filter(e => e.status === 'approved' || !e.status).length}
          </p>
        </div>
        <div className="glass p-4 rounded-xl">
          <p className="text-gray-400 text-sm">En attente</p>
          <p className="font-mono font-bold text-xl text-yellow-400">
            {events.filter(e => e.status === 'pending').length}
          </p>
        </div>
        <div className="glass p-4 rounded-xl">
          <p className="text-gray-400 text-sm">Bloqués</p>
          <p className="font-mono font-bold text-xl text-red-400">
            {events.filter(e => e.status === 'blocked').length}
          </p>
        </div>
        <div className="glass p-4 rounded-xl">
          <p className="text-gray-400 text-sm">À la une</p>
          <p className="font-mono font-bold text-xl text-yellow-400">
            {events.filter(e => e.featured).length}
          </p>
        </div>
      </div>

      {/* Events List */}
      {loading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : filteredEvents.length === 0 ? (
        <div className="glass p-12 rounded-xl text-center">
          <Calendar className="mx-auto text-gray-500 mb-4" size={48} />
          <p className="text-gray-400">Aucun événement trouvé</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredEvents.map((event) => (
            <div 
              key={event.id} 
              className={`glass p-5 rounded-xl ${event.featured ? 'border-2 border-yellow-500/50' : ''} ${event.status === 'pending' ? 'border-2 border-yellow-500/30' : ''} ${event.status === 'blocked' ? 'opacity-60' : ''}`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                {/* Event Image */}
                <div className="w-full lg:w-32 h-24 lg:h-20 rounded-lg bg-white/5 overflow-hidden flex-shrink-0">
                  {event.image_url ? (
                    <img src={event.image_url} alt={event.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Calendar className="text-gray-600" size={32} />
                    </div>
                  )}
                </div>

                {/* Event Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 mb-2">
                    {event.featured && (
                      <Star className="text-yellow-400 flex-shrink-0" size={18} fill="currentColor" />
                    )}
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white truncate">{event.title}</h3>
                      <p className="text-gray-500 text-sm">{event.date} • {event.venue}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2">
                    {getStatusBadge(event.status)}
                    <span className="px-2 py-1 rounded-full bg-white/10 text-gray-300 text-xs">
                      {event.category}
                    </span>
                    {event.organizer && (
                      <span className="flex items-center gap-1 text-gray-500 text-xs">
                        <Building size={12} />
                        {event.organizer.full_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 lg:gap-8">
                  <div className="text-center">
                    <p className="text-gray-500 text-xs">Vendus</p>
                    <p className="font-mono font-bold text-white">{event.sold_tickets}/{event.total_tickets}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-gray-500 text-xs">Revenus</p>
                    <p className="font-mono font-bold text-green-400">{formatPrice(event.revenue || 0)}</p>
                  </div>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-10 w-10 p-0">
                        {processing === event.id ? (
                          <Loader2 className="animate-spin" size={18} />
                        ) : (
                          <MoreVertical size={18} />
                        )}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link to={`/event/${event.id}`} className="cursor-pointer">
                          <Eye size={16} className="mr-2" />
                          Voir l'événement
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      
                      {/* Featured Toggle */}
                      <DropdownMenuItem 
                        onClick={() => toggleFeatured(event.id, !event.featured)}
                        className={event.featured ? 'text-yellow-400' : ''}
                      >
                        <Star size={16} className="mr-2" fill={event.featured ? 'currentColor' : 'none'} />
                        {event.featured ? 'Retirer de la une' : 'Mettre à la une'}
                      </DropdownMenuItem>
                      
                      <DropdownMenuSeparator />
                      
                      {/* Status Actions */}
                      {event.status !== 'approved' && (
                        <DropdownMenuItem onClick={() => updateStatus(event.id, 'approved')} className="text-green-400">
                          <Check size={16} className="mr-2" />
                          Approuver
                        </DropdownMenuItem>
                      )}
                      {event.status !== 'blocked' && (
                        <DropdownMenuItem onClick={() => updateStatus(event.id, 'blocked')} className="text-red-400">
                          <X size={16} className="mr-2" />
                          Bloquer
                        </DropdownMenuItem>
                      )}
                      {event.status !== 'pending' && (
                        <DropdownMenuItem onClick={() => updateStatus(event.id, 'pending')} className="text-yellow-400">
                          <Clock size={16} className="mr-2" />
                          Mettre en attente
                        </DropdownMenuItem>
                      )}
                      
                      <DropdownMenuSeparator />
                      
                      <DropdownMenuItem 
                        onClick={() => setDeleteEvent(event)} 
                        className="text-red-400"
                      >
                        <Trash2 size={16} className="mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteEvent} onOpenChange={() => setDeleteEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400">Supprimer l'événement</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer <strong className="text-white">{deleteEvent?.title}</strong> ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {processing ? <Loader2 className="animate-spin" size={16} /> : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminEvents;
