import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Train, Ship, Clock, DollarSign, MapPin, Save, Loader2, 
  Plus, Trash2, Power, PowerOff
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Skeleton } from '../../components/ui/skeleton';
import { Switch } from '../../components/ui/switch';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'sonner';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../components/ui/tabs';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminTransport = () => {
  const { getAuthHeaders } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('train');

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
            <h3 className="font-semibold text-lg text-white mb-4 flex items-center gap-2">
              <MapPin className="text-yellow-400" size={20} />
              Tarifs par Trajet
            </h3>
            
            <div className="space-y-4">
              {settings.train.routes?.map((route, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
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
                  <div className="flex items-center gap-4">
                    <p className="font-mono font-bold text-green-400 text-lg">{formatPrice(route.price)}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-gray-500 text-xs mt-4">
              * Pour modifier les tarifs, contactez le support technique
            </p>
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
            <h3 className="font-semibold text-lg text-white mb-4 flex items-center gap-2">
              <MapPin className="text-blue-400" size={20} />
              Tarifs par Trajet
            </h3>
            
            <div className="space-y-4">
              {settings.ferry.routes?.map((route, index) => (
                <div 
                  key={index} 
                  className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
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
                  <div className="flex items-center gap-4">
                    <p className="font-mono font-bold text-green-400 text-lg">{formatPrice(route.price)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminTransport;
