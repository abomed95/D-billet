import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Train, Ship, Clock, DollarSign, MapPin, Save, Loader2, 
  Plus, Trash2, Edit2, X, Check
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Skeleton } from '../../components/ui/skeleton';
import { Switch } from '../../components/ui/switch';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../components/ui/tabs';
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

const AdminTransport = () => {
  const { getAuthHeaders } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('train');
  
  // Modal states
  const [routeModal, setRouteModal] = useState({ open: false, type: null, mode: 'add', index: null });
  const [deleteModal, setDeleteModal] = useState({ open: false, type: null, index: null, route: null });
  
  // Form state
  const [routeForm, setRouteForm] = useState({
    from_station: '',
    to_station: '',
    price: '',
    duration: ''
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/admin/transport/settings`, {
        headers: getAuthHeaders()
      });
      setSettings(response.data);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveTrainSettings = async (updates) => {
    setSaving(true);
    try {
      const params = new URLSearchParams();
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value);
        }
      });
      
      await axios.put(
        `${API}/admin/transport/train?${params.toString()}`,
        {},
        { headers: getAuthHeaders() }
      );
      toast.success('Paramètres Train mis à jour');
      fetchSettings();
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const saveFerrySettings = async (updates) => {
    setSaving(true);
    try {
      const params = new URLSearchParams();
      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value);
        }
      });
      
      await axios.put(
        `${API}/admin/transport/ferry?${params.toString()}`,
        {},
        { headers: getAuthHeaders() }
      );
      toast.success('Paramètres Ferry mis à jour');
      fetchSettings();
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const openAddRouteModal = (type) => {
    setRouteForm({ from_station: '', to_station: '', price: '', duration: '' });
    setRouteModal({ open: true, type, mode: 'add', index: null });
  };

  const openEditRouteModal = (type, index, route) => {
    setRouteForm({
      from_station: route.from,
      to_station: route.to,
      price: route.price.toString(),
      duration: route.duration
    });
    setRouteModal({ open: true, type, mode: 'edit', index });
  };

  const handleSaveRoute = async () => {
    if (!routeForm.from_station || !routeForm.to_station || !routeForm.price || !routeForm.duration) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    setSaving(true);
    try {
      const endpoint = routeModal.type === 'train' 
        ? '/admin/transport/train/routes' 
        : '/admin/transport/ferry/routes';
      
      const data = {
        from_station: routeForm.from_station,
        to_station: routeForm.to_station,
        price: parseInt(routeForm.price),
        duration: routeForm.duration
      };

      if (routeModal.mode === 'add') {
        await axios.post(`${API}${endpoint}`, data, { headers: getAuthHeaders() });
        toast.success('Trajet ajouté!');
      } else {
        await axios.put(`${API}${endpoint}/${routeModal.index}`, data, { headers: getAuthHeaders() });
        toast.success('Trajet modifié!');
      }
      
      setRouteModal({ open: false, type: null, mode: 'add', index: null });
      fetchSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRoute = async () => {
    setSaving(true);
    try {
      const endpoint = deleteModal.type === 'train' 
        ? '/admin/transport/train/routes' 
        : '/admin/transport/ferry/routes';
      
      await axios.delete(`${API}${endpoint}/${deleteModal.index}`, { headers: getAuthHeaders() });
      toast.success('Trajet supprimé!');
      setDeleteModal({ open: false, type: null, index: null, route: null });
      fetchSettings();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-DJ').format(price) + ' DJF';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-unbounded font-bold text-2xl md:text-3xl text-white mb-2">
          Gestion Transport
        </h1>
        <p className="text-gray-400">Paramètres exclusifs Train & Ferry (géré par l'admin)</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="glass">
          <TabsTrigger value="train" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black gap-2">
            <Train size={18} />
            Train
          </TabsTrigger>
          <TabsTrigger value="ferry" className="data-[state=active]:bg-blue-500 data-[state=active]:text-black gap-2">
            <Ship size={18} />
            Ferry
          </TabsTrigger>
        </TabsList>

        {/* Train Settings */}
        <TabsContent value="train" className="space-y-6 mt-6">
          {/* Status Card */}
          <div className={`glass p-6 rounded-xl border-2 ${settings.train.active ? 'border-green-500/30' : 'border-red-500/30'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${settings.train.active ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                  <Train className={settings.train.active ? 'text-green-400' : 'text-red-400'} size={28} />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">Service Train</h3>
                  <p className="text-gray-400 text-sm">Djibouti ↔ Éthiopie</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-medium ${settings.train.active ? 'text-green-400' : 'text-red-400'}`}>
                  {settings.train.active ? 'Actif' : 'Suspendu'}
                </span>
                <Switch
                  checked={settings.train.active}
                  onCheckedChange={(checked) => saveTrainSettings({ active: checked })}
                />
              </div>
            </div>
          </div>

          {/* Train Schedule Info */}
          <div className="glass p-6 rounded-xl">
            <h3 className="font-semibold text-lg text-white mb-4 flex items-center gap-2">
              <Clock className="text-yellow-400" size={20} />
              Horaires & Planning
            </h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label>Heure de départ</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="time"
                    defaultValue={settings.train.departure_time}
                    className="bg-white/5 border-white/10"
                    id="train_departure"
                  />
                  <Button 
                    onClick={() => {
                      const val = document.getElementById('train_departure').value;
                      saveTrainSettings({ departure_time: val });
                    }}
                    disabled={saving}
                    className="bg-yellow-500 hover:bg-yellow-600 text-black"
                  >
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  </Button>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-white/5">
                <p className="text-gray-400 text-sm mb-2">Règles de circulation</p>
                <ul className="text-white text-sm space-y-1">
                  <li>• <span className="text-yellow-400">Jours pairs:</span> Départ de Nagad</li>
                  <li>• <span className="text-yellow-400">Jours impairs:</span> Départ d'Ali-Sabieh</li>
                  <li>• <span className="text-red-400">1er du mois:</span> Jour férié</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Train Routes */}
          <div className="glass p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg text-white flex items-center gap-2">
                <MapPin className="text-yellow-400" size={20} />
                Tarifs par Trajet
              </h3>
              <Button 
                onClick={() => openAddRouteModal('train')}
                className="bg-yellow-500 hover:bg-yellow-600 text-black gap-2"
              >
                <Plus size={18} />
                Ajouter Trajet
              </Button>
            </div>
            
            <div className="space-y-3">
              {settings.train.routes?.map((route, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-yellow-500/20 flex items-center justify-center">
                      <Train className="text-yellow-400" size={18} />
                    </div>
                    <div>
                      <p className="text-white font-medium">{route.from} → {route.to}</p>
                      <p className="text-gray-500 text-sm">{route.duration}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-mono font-bold text-green-400 text-lg">{formatPrice(route.price)}</p>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditRouteModal('train', index, route)}
                        className="h-8 w-8 p-0 text-cyan-400 hover:text-cyan-300"
                      >
                        <Edit2 size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteModal({ open: true, type: 'train', index, route })}
                        className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {(!settings.train.routes || settings.train.routes.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  Aucun trajet configuré. Cliquez sur "Ajouter Trajet" pour commencer.
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Ferry Settings */}
        <TabsContent value="ferry" className="space-y-6 mt-6">
          {/* Status Card */}
          <div className={`glass p-6 rounded-xl border-2 ${settings.ferry.active ? 'border-green-500/30' : 'border-red-500/30'}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${settings.ferry.active ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                  <Ship className={settings.ferry.active ? 'text-green-400' : 'text-red-400'} size={28} />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">Service Ferry</h3>
                  <p className="text-gray-400 text-sm">Djibouti ↔ Tadjoura / Obock</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`font-medium ${settings.ferry.active ? 'text-green-400' : 'text-red-400'}`}>
                  {settings.ferry.active ? 'Actif' : 'Suspendu'}
                </span>
                <Switch
                  checked={settings.ferry.active}
                  onCheckedChange={(checked) => saveFerrySettings({ active: checked })}
                />
              </div>
            </div>
          </div>

          {/* Ferry Schedule */}
          <div className="glass p-6 rounded-xl">
            <h3 className="font-semibold text-lg text-white mb-4 flex items-center gap-2">
              <Clock className="text-blue-400" size={20} />
              Horaires
            </h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label>Heure de départ (Aller)</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="time"
                    defaultValue={settings.ferry.departure_time}
                    className="bg-white/5 border-white/10"
                    id="ferry_departure"
                  />
                  <Button 
                    onClick={() => {
                      const val = document.getElementById('ferry_departure').value;
                      saveFerrySettings({ departure_time: val });
                    }}
                    disabled={saving}
                    className="bg-blue-500 hover:bg-blue-600 text-black"
                  >
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  </Button>
                </div>
              </div>

              <div>
                <Label>Heure de retour</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="time"
                    defaultValue={settings.ferry.return_time}
                    className="bg-white/5 border-white/10"
                    id="ferry_return"
                  />
                  <Button 
                    onClick={() => {
                      const val = document.getElementById('ferry_return').value;
                      saveFerrySettings({ return_time: val });
                    }}
                    disabled={saving}
                    className="bg-blue-500 hover:bg-blue-600 text-black"
                  >
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Ferry Schedule by Day */}
          <div className="glass p-6 rounded-xl">
            <h3 className="font-semibold text-lg text-white mb-4">Planning Hebdomadaire</h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {[
                { day: 'Lundi', key: 'monday' },
                { day: 'Mardi', key: 'tuesday' },
                { day: 'Mercredi', key: 'wednesday' },
                { day: 'Jeudi', key: 'thursday' },
                { day: 'Vendredi', key: 'friday' },
                { day: 'Samedi', key: 'saturday' },
                { day: 'Dimanche', key: 'sunday' },
              ].map(({ day, key }) => {
                const destination = settings.ferry.schedule?.[key];
                const isClosed = destination === 'closed';
                
                return (
                  <div 
                    key={key}
                    className={`p-4 rounded-xl text-center ${
                      isClosed 
                        ? 'bg-red-500/10 border border-red-500/30' 
                        : 'bg-white/5 border border-white/10'
                    }`}
                  >
                    <p className="text-gray-400 text-xs mb-2">{day}</p>
                    {isClosed ? (
                      <p className="text-red-400 text-sm font-medium">Fermé</p>
                    ) : (
                      <p className="text-blue-400 text-sm font-medium">{destination}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Ferry Routes */}
          <div className="glass p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg text-white flex items-center gap-2">
                <MapPin className="text-blue-400" size={20} />
                Tarifs par Trajet
              </h3>
              <Button 
                onClick={() => openAddRouteModal('ferry')}
                className="bg-blue-500 hover:bg-blue-600 text-black gap-2"
              >
                <Plus size={18} />
                Ajouter Trajet
              </Button>
            </div>
            
            <div className="space-y-3">
              {settings.ferry.routes?.map((route, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                      <Ship className="text-blue-400" size={18} />
                    </div>
                    <div>
                      <p className="text-white font-medium">{route.from} → {route.to}</p>
                      <p className="text-gray-500 text-sm">{route.duration}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-mono font-bold text-green-400 text-lg">{formatPrice(route.price)}</p>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditRouteModal('ferry', index, route)}
                        className="h-8 w-8 p-0 text-cyan-400 hover:text-cyan-300"
                      >
                        <Edit2 size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteModal({ open: true, type: 'ferry', index, route })}
                        className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {(!settings.ferry.routes || settings.ferry.routes.length === 0) && (
                <div className="text-center py-8 text-gray-500">
                  Aucun trajet configuré. Cliquez sur "Ajouter Trajet" pour commencer.
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Add/Edit Route Modal */}
      <Dialog open={routeModal.open} onOpenChange={(open) => !open && setRouteModal({ ...routeModal, open: false })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-unbounded flex items-center gap-2">
              {routeModal.type === 'train' ? (
                <Train className="text-yellow-400" size={24} />
              ) : (
                <Ship className="text-blue-400" size={24} />
              )}
              {routeModal.mode === 'add' ? 'Ajouter un trajet' : 'Modifier le trajet'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Départ</Label>
                <Input
                  value={routeForm.from_station}
                  onChange={(e) => setRouteForm({ ...routeForm, from_station: e.target.value })}
                  placeholder="Ex: Djibouti"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Arrivée</Label>
                <Input
                  value={routeForm.to_station}
                  onChange={(e) => setRouteForm({ ...routeForm, to_station: e.target.value })}
                  placeholder="Ex: Tadjoura"
                  className="mt-1"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Prix (DJF)</Label>
                <Input
                  type="number"
                  value={routeForm.price}
                  onChange={(e) => setRouteForm({ ...routeForm, price: e.target.value })}
                  placeholder="Ex: 700"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Durée</Label>
                <Input
                  value={routeForm.duration}
                  onChange={(e) => setRouteForm({ ...routeForm, duration: e.target.value })}
                  placeholder="Ex: 2h30"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setRouteModal({ ...routeModal, open: false })}>
                Annuler
              </Button>
              <Button 
                onClick={handleSaveRoute}
                disabled={saving}
                className={routeModal.type === 'train' 
                  ? 'bg-yellow-500 hover:bg-yellow-600 text-black' 
                  : 'bg-blue-500 hover:bg-blue-600 text-black'}
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : (
                  <>
                    <Check size={16} className="mr-2" />
                    {routeModal.mode === 'add' ? 'Ajouter' : 'Enregistrer'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteModal.open} onOpenChange={(open) => !open && setDeleteModal({ ...deleteModal, open: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400 flex items-center gap-2">
              <Trash2 size={20} />
              Supprimer le trajet
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le trajet <strong className="text-white">{deleteModal.route?.from} → {deleteModal.route?.to}</strong> ?
              <br />Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteRoute}
              disabled={saving}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {saving ? <Loader2 className="animate-spin" size={16} /> : 'Supprimer'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminTransport;
