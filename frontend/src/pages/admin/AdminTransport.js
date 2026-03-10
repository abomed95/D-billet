import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Train, Ship, Clock, DollarSign, MapPin, Save, Loader2, 
  Plus, Trash2, Edit2, X, Check, Calendar, Shield, User, Eye, EyeOff, Copy, RefreshCw
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
  DialogDescription,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminTransport = () => {
  const { getAuthHeaders } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('train');
  
  // Ferry schedule state
  const [ferrySchedule, setFerrySchedule] = useState([]);
  const [savingSchedule, setSavingSchedule] = useState(false);
  
  // Transport Staff state
  const [transportStaff, setTransportStaff] = useState([]);
  const [staffModal, setStaffModal] = useState({ open: false, mode: 'add' });
  const [staffForm, setStaffForm] = useState({ username: '', full_name: '', transport_type: 'both' });
  const [credentialsModal, setCredentialsModal] = useState({ open: false, username: '', password: '' });
  const [deleteStaffModal, setDeleteStaffModal] = useState({ open: false, staff: null });
  const [showPassword, setShowPassword] = useState(false);
  const [copiedField, setCopiedField] = useState(null);
  
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
    fetchFerrySchedule();
    fetchTransportStaff();
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

  const fetchFerrySchedule = async () => {
    try {
      const response = await axios.get(`${API}/admin/transport/ferry/schedule`, {
        headers: getAuthHeaders()
      });
      setFerrySchedule(response.data.schedule || []);
    } catch (error) {
      console.error('Failed to fetch ferry schedule:', error);
    }
  };

  const fetchTransportStaff = async () => {
    try {
      const response = await axios.get(`${API}/admin/transport/staff`, {
        headers: getAuthHeaders()
      });
      setTransportStaff(response.data);
    } catch (error) {
      console.error('Failed to fetch transport staff:', error);
    }
  };

  const handleCreateStaff = async () => {
    if (!staffForm.username || !staffForm.full_name) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    setSaving(true);
    try {
      const response = await axios.post(`${API}/admin/transport/staff`, staffForm, {
        headers: getAuthHeaders()
      });
      toast.success('Compte staff transport créé!');
      setCredentialsModal({ open: true, username: response.data.username, password: response.data.password });
      setStaffModal({ open: false, mode: 'add' });
      setStaffForm({ username: '', full_name: '', transport_type: 'both' });
      fetchTransportStaff();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStaffActive = async (staffId, currentActive) => {
    try {
      await axios.put(`${API}/admin/transport/staff/${staffId}?active=${!currentActive}`, {}, {
        headers: getAuthHeaders()
      });
      toast.success(currentActive ? 'Compte désactivé' : 'Compte activé');
      fetchTransportStaff();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleResetStaffPassword = async (staffId) => {
    try {
      const response = await axios.post(`${API}/admin/transport/staff/${staffId}/reset-password`, {}, {
        headers: getAuthHeaders()
      });
      setCredentialsModal({ open: true, username: response.data.username, password: response.data.new_password });
    } catch (error) {
      toast.error('Erreur lors de la réinitialisation');
    }
  };

  const handleDeleteStaff = async () => {
    if (!deleteStaffModal.staff) return;
    try {
      await axios.delete(`${API}/admin/transport/staff/${deleteStaffModal.staff.id}`, {
        headers: getAuthHeaders()
      });
      toast.success('Compte supprimé');
      setDeleteStaffModal({ open: false, staff: null });
      fetchTransportStaff();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleScheduleChange = (dayIndex, field, value) => {
    setFerrySchedule(prev => {
      const updated = [...prev];
      updated[dayIndex] = { ...updated[dayIndex], [field]: value };
      return updated;
    });
  };

  const saveFerrySchedule = async () => {
    setSavingSchedule(true);
    try {
      await axios.put(
        `${API}/admin/transport/ferry/schedule`,
        { schedule: ferrySchedule },
        { headers: getAuthHeaders() }
      );
      toast.success('Planning hebdomadaire mis à jour!');
      fetchSettings(); // Refresh main settings to sync
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde du planning');
      console.error('Save schedule error:', error);
    } finally {
      setSavingSchedule(false);
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
          <TabsTrigger value="staff" className="data-[state=active]:bg-orange-500 data-[state=active]:text-black gap-2">
            <Shield size={18} />
            Staff Transport
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

          {/* Ferry Weekly Schedule - Editable */}
          <div className="glass p-6 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-lg text-white flex items-center gap-2">
                <Calendar className="text-blue-400" size={20} />
                Planning Hebdomadaire
              </h3>
              <Button 
                onClick={saveFerrySchedule}
                disabled={savingSchedule}
                className="bg-blue-500 hover:bg-blue-600 text-black gap-2"
                data-testid="save-ferry-schedule-btn"
              >
                {savingSchedule ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                Sauvegarder le planning
              </Button>
            </div>
            
            <div className="space-y-3">
              {ferrySchedule.map((day, index) => (
                <div 
                  key={day.day}
                  data-testid={`ferry-day-${day.day}`}
                  className={`p-4 rounded-xl transition-all ${
                    day.active 
                      ? 'bg-white/5 border border-white/10' 
                      : 'bg-red-500/10 border border-red-500/30'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    {/* Day name + Toggle */}
                    <div className="flex items-center gap-3 min-w-[140px]">
                      <Switch
                        checked={day.active}
                        onCheckedChange={(checked) => handleScheduleChange(index, 'active', checked)}
                        data-testid={`ferry-toggle-${day.day}`}
                      />
                      <span className={`font-medium ${day.active ? 'text-white' : 'text-red-400'}`}>
                        {day.day_label}
                      </span>
                    </div>
                    
                    {day.active ? (
                      <div className="flex flex-wrap items-center gap-4 flex-1">
                        {/* Destination */}
                        <div className="flex items-center gap-2">
                          <Label className="text-gray-400 text-sm whitespace-nowrap">Destination:</Label>
                          <select
                            value={day.destination || ''}
                            onChange={(e) => handleScheduleChange(index, 'destination', e.target.value)}
                            className="bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            data-testid={`ferry-destination-${day.day}`}
                          >
                            <option value="">Sélectionner</option>
                            <option value="Tadjoura">Tadjoura</option>
                            <option value="Obock">Obock</option>
                          </select>
                        </div>
                        
                        {/* Departure Time */}
                        <div className="flex items-center gap-2">
                          <Label className="text-gray-400 text-sm whitespace-nowrap">Départ:</Label>
                          <Input
                            type="time"
                            value={day.departure_time || '08:00'}
                            onChange={(e) => handleScheduleChange(index, 'departure_time', e.target.value)}
                            className="bg-white/10 border-white/20 w-32 text-sm"
                            data-testid={`ferry-departure-${day.day}`}
                          />
                        </div>
                        
                        {/* Return Time */}
                        <div className="flex items-center gap-2">
                          <Label className="text-gray-400 text-sm whitespace-nowrap">Retour:</Label>
                          <Input
                            type="time"
                            value={day.return_time || '12:00'}
                            onChange={(e) => handleScheduleChange(index, 'return_time', e.target.value)}
                            className="bg-white/10 border-white/20 w-32 text-sm"
                            data-testid={`ferry-return-${day.day}`}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-red-400 text-sm italic">Service fermé ce jour</span>
                    )}
                  </div>
                </div>
              ))}
              
              {ferrySchedule.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                  Chargement du planning...
                </div>
              )}
            </div>
            
            {/* Legend */}
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-gray-500 text-xs">
                💡 Activez/désactivez chaque jour, choisissez la destination et définissez les heures de départ et de retour.
              </p>
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

        {/* Staff Transport Tab */}
        <TabsContent value="staff" className="space-y-6 mt-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                <Shield className="text-orange-400" size={24} />
                Staff Contrôle d'Accès Transport
              </h2>
              <p className="text-gray-400 text-sm">Agents de sécurité pour le train et ferry</p>
            </div>
            <Button
              onClick={() => setStaffModal({ open: true, mode: 'add' })}
              className="bg-orange-500 hover:bg-orange-600 text-black gap-2"
            >
              <Plus size={18} />
              Créer un compte
            </Button>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="glass p-4 rounded-xl text-center">
              <p className="text-3xl font-bold text-white">{transportStaff.length}</p>
              <p className="text-gray-400 text-sm">Total Agents</p>
            </div>
            <div className="glass p-4 rounded-xl text-center">
              <p className="text-3xl font-bold text-green-400">{transportStaff.filter(s => s.active).length}</p>
              <p className="text-gray-400 text-sm">Actifs</p>
            </div>
            <div className="glass p-4 rounded-xl text-center">
              <p className="text-3xl font-bold text-red-400">{transportStaff.filter(s => !s.active).length}</p>
              <p className="text-gray-400 text-sm">Inactifs</p>
            </div>
          </div>

          {/* Staff List */}
          <div className="glass rounded-xl overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <h3 className="font-semibold text-white">Liste des agents</h3>
            </div>
            
            {transportStaff.length === 0 ? (
              <div className="p-12 text-center">
                <Shield className="text-gray-600 mx-auto mb-4" size={48} />
                <p className="text-gray-400 mb-4">Aucun agent créé</p>
                <Button onClick={() => setStaffModal({ open: true, mode: 'add' })} className="bg-orange-500 hover:bg-orange-600 text-black">
                  Créer le premier agent
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-white/10">
                {transportStaff.map(staff => (
                  <div key={staff.id} className="p-4 hover:bg-white/5 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                          staff.active ? 'bg-green-500/20' : 'bg-red-500/20'
                        }`}>
                          <Shield className={staff.active ? 'text-green-400' : 'text-red-400'} size={24} />
                        </div>
                        <div>
                          <p className="text-white font-semibold">{staff.full_name}</p>
                          <p className="text-gray-400 text-sm">@{staff.username}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4">
                        {/* Transport Type Badge */}
                        <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                          staff.transport_type === 'both' ? 'bg-purple-500/20 text-purple-400' :
                          staff.transport_type === 'train' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-blue-500/20 text-blue-400'
                        }`}>
                          {staff.transport_type === 'both' ? 'Train & Ferry' :
                           staff.transport_type === 'train' ? 'Train' : 'Ferry'}
                        </div>
                        
                        {/* Active Toggle */}
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${staff.active ? 'text-green-400' : 'text-red-400'}`}>
                            {staff.active ? 'Actif' : 'Inactif'}
                          </span>
                          <Switch
                            checked={staff.active}
                            onCheckedChange={() => handleToggleStaffActive(staff.id, staff.active)}
                          />
                        </div>
                        
                        {/* Actions */}
                        <Button variant="ghost" size="sm" onClick={() => handleResetStaffPassword(staff.id)} className="text-cyan-400">
                          <RefreshCw size={16} />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteStaffModal({ open: true, staff })} className="text-red-400">
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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

      {/* Create Staff Modal */}
      <Dialog open={staffModal.open} onOpenChange={(open) => !open && setStaffModal({ ...staffModal, open: false })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-unbounded flex items-center gap-2">
              <Shield className="text-orange-400" size={24} />
              Créer un agent transport
            </DialogTitle>
            <DialogDescription>
              Cet agent pourra scanner les billets train et/ou ferry
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <Label>Nom complet</Label>
              <Input
                value={staffForm.full_name}
                onChange={(e) => setStaffForm({ ...staffForm, full_name: e.target.value })}
                placeholder="Ex: Mohamed Ali"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>Identifiant de connexion</Label>
              <Input
                value={staffForm.username}
                onChange={(e) => setStaffForm({ ...staffForm, username: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                placeholder="Ex: mohamed_transport"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>Type de transport autorisé</Label>
              <Select value={staffForm.transport_type} onValueChange={(v) => setStaffForm({ ...staffForm, transport_type: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Train & Ferry</SelectItem>
                  <SelectItem value="train">Train uniquement</SelectItem>
                  <SelectItem value="ferry">Ferry uniquement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setStaffModal({ open: false, mode: 'add' })}>
                Annuler
              </Button>
              <Button 
                onClick={handleCreateStaff}
                disabled={saving}
                className="bg-orange-500 hover:bg-orange-600 text-black"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : 'Créer le compte'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Staff Credentials Modal */}
      <Dialog open={credentialsModal.open} onOpenChange={(open) => !open && setCredentialsModal({ ...credentialsModal, open: false })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-unbounded text-green-400 flex items-center gap-2">
              <Check size={24} />
              Identifiants du compte
            </DialogTitle>
            <DialogDescription>
              Notez ces informations, le mot de passe ne sera plus affiché!
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-gray-400 text-sm">Identifiant</p>
                  <p className="text-white font-mono text-lg">{credentialsModal.username}</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(credentialsModal.username, 'username')}>
                  {copiedField === 'username' ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Mot de passe</p>
                  <p className="text-white font-mono text-lg">
                    {showPassword ? credentialsModal.password : '••••••••'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => copyToClipboard(credentialsModal.password, 'password')}>
                    {copiedField === 'password' ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                  </Button>
                </div>
              </div>
            </div>
            
            <p className="text-gray-500 text-sm text-center">
              Connexion sur <span className="text-orange-400">/staff/login</span>
            </p>

            <Button 
              onClick={() => setCredentialsModal({ open: false, username: '', password: '' })}
              className="w-full bg-green-500 hover:bg-green-600 text-black"
            >
              J'ai noté les identifiants
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Staff Confirmation */}
      <AlertDialog open={deleteStaffModal.open} onOpenChange={(open) => !open && setDeleteStaffModal({ ...deleteStaffModal, open: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400 flex items-center gap-2">
              <Trash2 size={20} />
              Supprimer l'agent
            </AlertDialogTitle>
            <AlertDialogDescription>
              Supprimer le compte de <strong className="text-white">{deleteStaffModal.staff?.full_name}</strong>?
              <br />Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteStaff} className="bg-red-500 text-white hover:bg-red-600">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminTransport;
