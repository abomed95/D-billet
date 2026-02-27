import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Settings, Percent, Wallet, Tag, FileText, Megaphone, 
  Plus, Trash2, Loader2, Save, Palette
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminSettings = () => {
  const { getAuthHeaders } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('general');
  const [categoryModal, setCategoryModal] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', color: '#00FF94' });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await axios.get(`${API}/admin/settings`, {
        headers: getAuthHeaders()
      });
      setSettings(response.data);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (field, value) => {
    setSaving(true);
    try {
      await axios.put(
        `${API}/admin/settings?${field}=${encodeURIComponent(value)}`,
        {},
        { headers: getAuthHeaders() }
      );
      toast.success('Paramètre mis à jour');
      fetchSettings();
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const addCategory = async () => {
    if (!newCategory.name) return;
    setSaving(true);
    try {
      await axios.post(
        `${API}/admin/settings/categories?name=${encodeURIComponent(newCategory.name)}&color=${encodeURIComponent(newCategory.color)}`,
        {},
        { headers: getAuthHeaders() }
      );
      toast.success('Catégorie ajoutée');
      setCategoryModal(false);
      setNewCategory({ name: '', color: '#00FF94' });
      fetchSettings();
    } catch (error) {
      toast.error('Erreur');
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (catId) => {
    if (!confirm('Supprimer cette catégorie?')) return;
    try {
      await axios.delete(`${API}/admin/settings/categories/${catId}`, {
        headers: getAuthHeaders()
      });
      toast.success('Catégorie supprimée');
      fetchSettings();
    } catch (error) {
      toast.error('Erreur');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!settings) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-unbounded font-bold text-2xl md:text-3xl text-white mb-2">
          Configuration
        </h1>
        <p className="text-gray-400">Paramètres généraux de la plateforme</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="glass flex-wrap">
          <TabsTrigger value="general" className="data-[state=active]:bg-green-500 data-[state=active]:text-black">
            <Settings size={16} className="mr-2" />
            Général
          </TabsTrigger>
          <TabsTrigger value="categories" className="data-[state=active]:bg-purple-500 data-[state=active]:text-black">
            <Tag size={16} className="mr-2" />
            Catégories
          </TabsTrigger>
          <TabsTrigger value="content" className="data-[state=active]:bg-cyan-500 data-[state=active]:text-black">
            <FileText size={16} className="mr-2" />
            Contenu
          </TabsTrigger>
          <TabsTrigger value="banner" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black">
            <Megaphone size={16} className="mr-2" />
            Bannière
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6 mt-6">
          <div className="glass p-6 rounded-xl space-y-6">
            <h3 className="font-semibold text-lg text-white flex items-center gap-2">
              <Percent className="text-yellow-400" size={20} />
              Commission Plateforme
            </h3>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <Label>Taux de commission global (%)</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="number"
                    defaultValue={settings.commission_rate}
                    min="0"
                    max="50"
                    step="0.5"
                    className="bg-white/5 border-white/10"
                    id="commission_rate"
                  />
                  <Button 
                    onClick={() => {
                      const val = document.getElementById('commission_rate').value;
                      saveSettings('commission_rate', val);
                    }}
                    disabled={saving}
                    className="bg-green-500 hover:bg-green-600 text-black"
                  >
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Commission prélevée sur chaque vente de billet
                </p>
              </div>

              <div>
                <Label>Retrait minimum (DJF)</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="number"
                    defaultValue={settings.min_withdrawal}
                    min="100"
                    step="100"
                    className="bg-white/5 border-white/10"
                    id="min_withdrawal"
                  />
                  <Button 
                    onClick={() => {
                      const val = document.getElementById('min_withdrawal').value;
                      saveSettings('min_withdrawal', val);
                    }}
                    disabled={saving}
                    className="bg-green-500 hover:bg-green-600 text-black"
                  >
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Montant minimum pour une demande de retrait
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="glass p-6 rounded-xl">
            <h3 className="font-semibold text-lg text-white mb-4">Aperçu des Paramètres</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-white/5">
                <p className="text-gray-400 text-sm">Commission</p>
                <p className="font-mono font-bold text-xl text-yellow-400">{settings.commission_rate}%</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5">
                <p className="text-gray-400 text-sm">Retrait Min.</p>
                <p className="font-mono font-bold text-xl text-green-400">{settings.min_withdrawal} DJF</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5">
                <p className="text-gray-400 text-sm">Catégories</p>
                <p className="font-mono font-bold text-xl text-purple-400">{settings.categories?.length || 0}</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5">
                <p className="text-gray-400 text-sm">Bannière</p>
                <p className={`font-bold text-xl ${settings.banner_active ? 'text-green-400' : 'text-gray-500'}`}>
                  {settings.banner_active ? 'Active' : 'Inactive'}
                </p>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Categories */}
        <TabsContent value="categories" className="space-y-6 mt-6">
          <div className="glass p-6 rounded-xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-semibold text-lg text-white">Catégories d'Événements</h3>
              <Button 
                onClick={() => setCategoryModal(true)}
                className="bg-purple-500 hover:bg-purple-600 text-black gap-2"
              >
                <Plus size={18} />
                Ajouter
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {settings.categories?.map((cat) => (
                <div 
                  key={cat.id} 
                  className="flex items-center justify-between p-4 rounded-xl bg-white/5 group"
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${cat.color}20` }}
                    >
                      <Tag size={18} style={{ color: cat.color }} />
                    </div>
                    <div>
                      <p className="text-white font-medium">{cat.name}</p>
                      <p className="text-gray-500 text-xs">{cat.id}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteCategory(cat.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Content */}
        <TabsContent value="content" className="space-y-6 mt-6">
          <div className="glass p-6 rounded-xl">
            <h3 className="font-semibold text-lg text-white mb-4">Conditions Générales de Vente</h3>
            <Textarea
              defaultValue={settings.terms_content}
              placeholder="Rédigez vos conditions générales de vente..."
              rows={8}
              className="bg-white/5 border-white/10"
              id="terms_content"
            />
            <Button 
              onClick={() => {
                const val = document.getElementById('terms_content').value;
                saveSettings('terms_content', val);
              }}
              disabled={saving}
              className="mt-4 bg-green-500 hover:bg-green-600 text-black"
            >
              {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save size={16} className="mr-2" />}
              Enregistrer
            </Button>
          </div>

          <div className="glass p-6 rounded-xl">
            <h3 className="font-semibold text-lg text-white mb-4">Mentions Légales</h3>
            <Textarea
              defaultValue={settings.legal_content}
              placeholder="Rédigez vos mentions légales..."
              rows={8}
              className="bg-white/5 border-white/10"
              id="legal_content"
            />
            <Button 
              onClick={() => {
                const val = document.getElementById('legal_content').value;
                saveSettings('legal_content', val);
              }}
              disabled={saving}
              className="mt-4 bg-green-500 hover:bg-green-600 text-black"
            >
              {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save size={16} className="mr-2" />}
              Enregistrer
            </Button>
          </div>
        </TabsContent>

        {/* Banner */}
        <TabsContent value="banner" className="space-y-6 mt-6">
          <div className="glass p-6 rounded-xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-semibold text-lg text-white">Bannière d'Annonce</h3>
                <p className="text-gray-400 text-sm">Afficher un message sur toutes les pages</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-gray-400 text-sm">{settings.banner_active ? 'Active' : 'Inactive'}</span>
                <Switch
                  checked={settings.banner_active}
                  onCheckedChange={(checked) => saveSettings('banner_active', checked)}
                />
              </div>
            </div>

            <div>
              <Label>Texte de la bannière</Label>
              <Input
                defaultValue={settings.banner_text}
                placeholder="Ex: Nouveaux événements disponibles ! Profitez de -20% avec le code PROMO20"
                className="bg-white/5 border-white/10 mt-2"
                id="banner_text"
              />
              <Button 
                onClick={() => {
                  const val = document.getElementById('banner_text').value;
                  saveSettings('banner_text', val);
                }}
                disabled={saving}
                className="mt-4 bg-green-500 hover:bg-green-600 text-black"
              >
                {saving ? <Loader2 className="animate-spin mr-2" size={16} /> : <Save size={16} className="mr-2" />}
                Enregistrer
              </Button>
            </div>

            {settings.banner_active && settings.banner_text && (
              <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-green-500/20 to-cyan-500/20 border border-green-500/30">
                <p className="text-sm text-white">
                  <strong>Aperçu:</strong> {settings.banner_text}
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Add Category Modal */}
      <Dialog open={categoryModal} onOpenChange={setCategoryModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-unbounded">Nouvelle Catégorie</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Nom de la catégorie</Label>
              <Input
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                placeholder="Ex: Théâtre"
              />
            </div>
            <div>
              <Label>Couleur</Label>
              <div className="flex items-center gap-3 mt-2">
                <input
                  type="color"
                  value={newCategory.color}
                  onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                  className="w-12 h-12 rounded-lg cursor-pointer border-0"
                />
                <Input
                  value={newCategory.color}
                  onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                  placeholder="#00FF94"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setCategoryModal(false)}>
                Annuler
              </Button>
              <Button 
                onClick={addCategory}
                disabled={saving || !newCategory.name}
                className="bg-purple-500 hover:bg-purple-600 text-black"
              >
                {saving ? <Loader2 className="animate-spin" size={16} /> : 'Ajouter'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminSettings;
