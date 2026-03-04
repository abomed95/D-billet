import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus, Edit, Trash2, Loader2, Search, Ticket, Activity } from 'lucide-react';
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORIES = [
  { id: 'cinema', label: 'Cinéma' },
  { id: 'football', label: 'Football' },
  { id: 'concerts', label: 'Concerts' },
  { id: 'conferences', label: 'Conférences' },
];

const OrganizerEvents = () => {
  const { getAuthHeaders } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'concerts',
    date: '',
    time: '',
    venue: '',
    image_url: '',
    ticket_types: [
      { name: 'Standard', price: 1000, quantity: 100, description: '', max_per_order: 10, group_size: 1 }
    ]
  });

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const response = await axios.get(`${API}/organizer/events`, {
        headers: getAuthHeaders()
      });
      setEvents(response.data);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-DJ').format(price) + ' DJF';
  };

  const addTicketType = () => {
    setFormData({
      ...formData,
      ticket_types: [
        ...formData.ticket_types,
        { name: '', price: 0, quantity: 0, description: '', max_per_order: 10, group_size: 1 }
      ]
    });
  };

  const removeTicketType = (index) => {
    if (formData.ticket_types.length > 1) {
      setFormData({
        ...formData,
        ticket_types: formData.ticket_types.filter((_, i) => i !== index)
      });
    }
  };

  const updateTicketType = (index, field, value) => {
    const updated = [...formData.ticket_types];
    updated[index][field] = field === 'name' || field === 'description' ? value : parseInt(value) || 0;
    setFormData({ ...formData, ticket_types: updated });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await axios.post(`${API}/events`, formData, {
        headers: getAuthHeaders()
      });
      toast.success('Événement créé!');
      setIsModalOpen(false);
      setFormData({
        title: '',
        description: '',
        category: 'concerts',
        date: '',
        time: '',
        venue: '',
        image_url: '',
        ticket_types: [{ name: 'Standard', price: 1000, quantity: 100, description: '', max_per_order: 10, group_size: 1 }]
      });
      fetchEvents();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array(3).fill(0).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-unbounded font-bold text-2xl text-white">Mes Événements</h1>
          <p className="text-gray-400">{events.length} événement(s)</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="bg-green-500 hover:bg-green-600 text-black gap-2">
          <Plus size={20} />
          Créer
        </Button>
      </div>

      {/* Events List */}
      <div className="space-y-4">
        {events.length === 0 ? (
          <div className="glass p-12 rounded-xl text-center">
            <Calendar className="mx-auto text-gray-500 mb-4" size={48} />
            <p className="text-gray-400">Aucun événement. Créez votre premier!</p>
          </div>
        ) : (
          events.map(event => (
            <div key={event.id} className="glass p-4 rounded-xl">
              <div className="flex gap-4">
                <img
                  src={event.image_url || 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=200'}
                  alt={event.title}
                  className="w-24 h-24 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <h3 className="font-unbounded font-semibold text-white">{event.title}</h3>
                  <p className="text-gray-400 text-sm">{event.date} • {event.venue}</p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="text-green-400 font-mono">
                      {event.sold_tickets} / {event.total_tickets} vendus
                    </span>
                    <div className="flex-1 bg-white/10 rounded-full h-2 max-w-[200px]">
                      <div 
                        className="bg-green-500 h-2 rounded-full"
                        style={{ width: `${(event.sold_tickets / event.total_tickets) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              {/* Ticket Types */}
              <div className="mt-4 flex flex-wrap gap-2">
                {event.ticket_types?.map((tt, i) => (
                  <span key={i} className="px-3 py-1 bg-white/10 rounded-full text-sm text-gray-300">
                    {tt.name}: {tt.sold || 0}/{tt.quantity} • {formatPrice(tt.price)}
                  </span>
                ))}
              </div>
              {/* Live Dashboard Button */}
              <div className="mt-4 pt-4 border-t border-white/10 flex justify-end">
                <Button
                  onClick={() => navigate(`/organizer/live/${event.id}`)}
                  className="bg-green-500 hover:bg-green-600 text-black gap-2"
                  data-testid={`live-dashboard-btn-${event.id}`}
                >
                  <Activity size={18} />
                  Dashboard Live
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Event Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-unbounded">Créer un événement</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Titre</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Nom de l'événement"
                  required
                />
              </div>

              <div>
                <Label>Catégorie</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Lieu</Label>
                <Input
                  value={formData.venue}
                  onChange={(e) => setFormData({ ...formData, venue: e.target.value })}
                  placeholder="Ex: Kempinski Palace"
                  required
                />
              </div>

              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label>Heure</Label>
                <Input
                  type="time"
                  value={formData.time}
                  onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <Label>URL Image</Label>
                <Input
                  value={formData.image_url}
                  onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div className="md:col-span-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Description..."
                  rows={3}
                  required
                />
              </div>
            </div>

            {/* Ticket Types */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <Label className="text-lg">Types de Billets</Label>
                <Button type="button" variant="outline" size="sm" onClick={addTicketType}>
                  <Plus size={16} className="mr-1" /> Ajouter
                </Button>
              </div>

              <div className="space-y-4">
                {formData.ticket_types.map((tt, index) => (
                  <div key={index} className="glass p-4 rounded-xl">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white font-medium">Type {index + 1}</span>
                      {formData.ticket_types.length > 1 && (
                        <Button type="button" variant="ghost" size="sm" onClick={() => removeTicketType(index)}>
                          <Trash2 size={16} className="text-red-400" />
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <Label className="text-xs">Nom</Label>
                        <Select value={tt.name} onValueChange={(v) => updateTicketType(index, 'name', v)}>
                          <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Early Bird">Early Bird</SelectItem>
                            <SelectItem value="Standard">Standard</SelectItem>
                            <SelectItem value="VIP">VIP</SelectItem>
                            <SelectItem value="Groupe">Groupe (5 pers.)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Prix (DJF)</Label>
                        <Input
                          type="number"
                          value={tt.price}
                          onChange={(e) => updateTicketType(index, 'price', e.target.value)}
                          min="0"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Quantité</Label>
                        <Input
                          type="number"
                          value={tt.quantity}
                          onChange={(e) => updateTicketType(index, 'quantity', e.target.value)}
                          min="1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Max/Commande</Label>
                        <Input
                          type="number"
                          value={tt.max_per_order}
                          onChange={(e) => updateTicketType(index, 'max_per_order', e.target.value)}
                          min="1"
                          max="50"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={saving} className="bg-green-500 hover:bg-green-600 text-black">
                {saving ? <Loader2 className="animate-spin" size={20} /> : 'Créer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

const Calendar = ({ className, size }) => (
  <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
    <line x1="16" y1="2" x2="16" y2="6"></line>
    <line x1="8" y1="2" x2="8" y2="6"></line>
    <line x1="3" y1="10" x2="21" y2="10"></line>
  </svg>
);

export default OrganizerEvents;
