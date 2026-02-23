import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Edit, Trash2, Loader2, Search } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Skeleton } from '../../components/ui/skeleton';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
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

const CATEGORIES = [
  { id: 'cinema', label: 'Cinéma', color: '#FF0055' },
  { id: 'football', label: 'Football', color: '#00FF94' },
  { id: 'concerts', label: 'Concerts', color: '#7000FF' },
  { id: 'conferences', label: 'Conférences', color: '#FF5C00' },
];

const AdminEvents = () => {
  const { getAuthHeaders } = useAuth();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'concerts',
    date: '',
    time: '',
    venue: '',
    price: '',
    available_tickets: '',
    image_url: '',
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await axios.get(`${API}/events`);
      setEvents(response.data);
    } catch (error) {
      console.error('Failed to fetch events:', error);
      toast.error('Erreur lors du chargement');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-DJ').format(price) + ' DJF';
  };

  const openModal = (event = null) => {
    if (event) {
      setEditingEvent(event);
      setFormData({
        title: event.title,
        description: event.description,
        category: event.category,
        date: event.date,
        time: event.time,
        venue: event.venue,
        price: event.price.toString(),
        available_tickets: event.available_tickets.toString(),
        image_url: event.image_url || '',
      });
    } else {
      setEditingEvent(null);
      setFormData({
        title: '',
        description: '',
        category: 'concerts',
        date: '',
        time: '',
        venue: '',
        price: '',
        available_tickets: '',
        image_url: '',
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        ...formData,
        price: parseInt(formData.price),
        available_tickets: parseInt(formData.available_tickets),
      };

      if (editingEvent) {
        await axios.put(`${API}/events/${editingEvent.id}`, payload, {
          headers: getAuthHeaders()
        });
        toast.success('Événement modifié');
      } else {
        await axios.post(`${API}/events`, payload, {
          headers: getAuthHeaders()
        });
        toast.success('Événement créé');
      }

      setIsModalOpen(false);
      fetchEvents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId) => {
    setDeleting(true);
    try {
      await axios.delete(`${API}/events/${eventId}`, {
        headers: getAuthHeaders()
      });
      toast.success('Événement supprimé');
      fetchEvents();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const filteredEvents = events.filter(event => 
    event.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-48" />
        <div className="grid gap-4">
          {Array(5).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-unbounded font-bold text-2xl md:text-3xl text-white">
            Gestion des Événements
          </h1>
          <p className="text-gray-400">{events.length} événement(s)</p>
        </div>
        <Button onClick={() => openModal()} className="bg-green-500 hover:bg-green-600 text-black gap-2" data-testid="add-event-btn">
          <Plus size={20} />
          Nouvel événement
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <Input
          type="text"
          placeholder="Rechercher..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-11 bg-white/5 border-white/10"
          data-testid="search-events"
        />
      </div>

      {/* Events List */}
      <div className="space-y-3">
        {filteredEvents.length === 0 ? (
          <div className="glass p-12 rounded-xl text-center">
            <p className="text-gray-400">Aucun événement trouvé</p>
          </div>
        ) : (
          filteredEvents.map(event => (
            <div
              key={event.id}
              className="glass p-4 rounded-xl flex items-center gap-4"
              data-testid={`event-row-${event.id}`}
            >
              {/* Image */}
              <img
                src={event.image_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?crop=entropy&cs=srgb&fm=jpg&q=85'}
                alt={event.title}
                className="w-20 h-20 rounded-lg object-cover hidden sm:block"
              />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-unbounded font-semibold text-white truncate">
                    {event.title}
                  </h3>
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-bold"
                    style={{ 
                      backgroundColor: CATEGORIES.find(c => c.id === event.category)?.color + '20',
                      color: CATEGORIES.find(c => c.id === event.category)?.color
                    }}
                  >
                    {CATEGORIES.find(c => c.id === event.category)?.label || event.category}
                  </span>
                </div>
                <p className="text-sm text-gray-400">
                  {event.date} {event.time} • {event.venue}
                </p>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-white font-mono font-medium">{formatPrice(event.price)}</span>
                  <span className="text-gray-500 text-sm">
                    {event.available_tickets} places
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openModal(event)}
                  data-testid={`edit-event-${event.id}`}
                >
                  <Edit size={18} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setDeleteConfirm(event)}
                  className="text-red-400 hover:text-red-300"
                  data-testid={`delete-event-${event.id}`}
                >
                  <Trash2 size={18} />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-unbounded">
              {editingEvent ? 'Modifier l\'événement' : 'Nouvel événement'}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Titre</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Nom de l'événement"
                  required
                  data-testid="event-title-input"
                />
              </div>

              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger data-testid="event-category-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Prix (DJF)</Label>
                <Input
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="2500"
                  required
                  min="0"
                  data-testid="event-price-input"
                />
              </div>

              <div className="space-y-2">
                <Label>Date</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                  data-testid="event-date-input"
                />
              </div>

              <div className="space-y-2">
                <Label>Heure</Label>
                <Input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  required
                  data-testid="event-time-input"
                />
              </div>

              <div className="space-y-2">
                <Label>Billets disponibles</Label>
                <Input
                  type="number"
                  value={formData.available_tickets}
                  onChange={(e) => setFormData({ ...formData, available_tickets: e.target.value })}
                  placeholder="100"
                  required
                  min="1"
                  data-testid="event-tickets-input"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Lieu</Label>
                <Input
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  placeholder="Ex: Kempinski Palace Djibouti"
                  required
                  data-testid="event-venue-input"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>URL de l'image</Label>
                <Input
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://..."
                  data-testid="event-image-input"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description de l'événement..."
                  rows={3}
                  required
                  data-testid="event-description-input"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving} className="bg-green-500 hover:bg-green-600 text-black" data-testid="save-event-btn">
                {saving ? <Loader2 className="animate-spin" size={20} /> : editingEvent ? 'Modifier' : 'Créer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'événement ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. L'événement "{deleteConfirm?.title}" sera définitivement supprimé.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete(deleteConfirm?.id)}
              disabled={deleting}
              className="bg-red-500 text-white hover:bg-red-600"
              data-testid="confirm-delete-btn"
            >
              {deleting ? <Loader2 className="animate-spin" size={16} /> : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminEvents;
