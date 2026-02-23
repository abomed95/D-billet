import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Loader2, Tag, Copy, Check } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
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

const OrganizerPromoCodes = () => {
  const { getAuthHeaders } = useAuth();
  const [promoCodes, setPromoCodes] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  
  const [formData, setFormData] = useState({
    code: '',
    discount_type: 'percentage',
    discount_value: 10,
    max_uses: 100,
    event_id: '',
    valid_until: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [codesRes, eventsRes] = await Promise.all([
        axios.get(`${API}/promo-codes`, { headers: getAuthHeaders() }),
        axios.get(`${API}/organizer/events`, { headers: getAuthHeaders() })
      ]);
      setPromoCodes(codesRes.data);
      setEvents(eventsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-DJ').format(price) + ' DJF';
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success('Code copié!');
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await axios.post(`${API}/promo-codes`, {
        ...formData,
        event_id: formData.event_id || null
      }, {
        headers: getAuthHeaders()
      });
      toast.success('Code promo créé!');
      setIsModalOpen(false);
      setFormData({
        code: '',
        discount_type: 'percentage',
        discount_value: 10,
        max_uses: 100,
        event_id: '',
        valid_until: ''
      });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (promoId) => {
    if (!confirm('Supprimer ce code promo?')) return;
    
    try {
      await axios.delete(`${API}/promo-codes/${promoId}`, {
        headers: getAuthHeaders()
      });
      toast.success('Code supprimé');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const generateCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = 'DJIB';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, code });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {Array(3).fill(0).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-unbounded font-bold text-2xl text-white">Codes Promo</h1>
          <p className="text-gray-400">Créez des codes pour vos affiliés et influenceurs</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="bg-green-500 hover:bg-green-600 text-black gap-2">
          <Plus size={20} />
          Créer
        </Button>
      </div>

      {/* Promo Codes List */}
      <div className="space-y-4">
        {promoCodes.length === 0 ? (
          <div className="glass p-12 rounded-xl text-center">
            <Tag className="mx-auto text-gray-500 mb-4" size={48} />
            <p className="text-gray-400">Aucun code promo. Créez-en un pour vos influenceurs!</p>
          </div>
        ) : (
          promoCodes.map(promo => (
            <div key={promo.id} className="glass p-4 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => copyCode(promo.code)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500/20 rounded-lg hover:bg-green-500/30 transition-colors"
                >
                  <span className="font-mono font-bold text-green-400 text-lg">{promo.code}</span>
                  {copiedCode === promo.code ? (
                    <Check size={16} className="text-green-400" />
                  ) : (
                    <Copy size={16} className="text-green-400" />
                  )}
                </button>
                <div>
                  <p className="text-white">
                    {promo.discount_type === 'percentage' 
                      ? `-${promo.discount_value}%` 
                      : `-${formatPrice(promo.discount_value)}`}
                  </p>
                  <p className="text-gray-500 text-sm">
                    {promo.uses} / {promo.max_uses} utilisations
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-gray-400 text-sm">Ventes générées</p>
                  <p className="font-mono font-bold text-white">{formatPrice(promo.total_sales || 0)}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(promo.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 size={18} />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-unbounded">Créer un code promo</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <Label>Code</Label>
              <div className="flex gap-2">
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="DJIB20"
                  className="font-mono uppercase"
                  required
                />
                <Button type="button" variant="outline" onClick={generateCode}>
                  Générer
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type de réduction</Label>
                <Select 
                  value={formData.discount_type} 
                  onValueChange={(v) => setFormData({ ...formData, discount_type: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Pourcentage (%)</SelectItem>
                    <SelectItem value="fixed">Montant fixe (DJF)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valeur</Label>
                <Input
                  type="number"
                  value={formData.discount_value}
                  onChange={(e) => setFormData({ ...formData, discount_value: parseInt(e.target.value) || 0 })}
                  min="1"
                  max={formData.discount_type === 'percentage' ? 100 : 100000}
                  required
                />
              </div>
            </div>

            <div>
              <Label>Utilisations max</Label>
              <Input
                type="number"
                value={formData.max_uses}
                onChange={(e) => setFormData({ ...formData, max_uses: parseInt(e.target.value) || 1 })}
                min="1"
              />
            </div>

            <div>
              <Label>Limiter à un événement (optionnel)</Label>
              <Select 
                value={formData.event_id} 
                onValueChange={(v) => setFormData({ ...formData, event_id: v })}
              >
                <SelectTrigger><SelectValue placeholder="Tous les événements" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tous les événements</SelectItem>
                  {events.map(event => (
                    <SelectItem key={event.id} value={event.id}>{event.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Date d'expiration (optionnel)</Label>
              <Input
                type="date"
                value={formData.valid_until}
                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
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

export default OrganizerPromoCodes;
