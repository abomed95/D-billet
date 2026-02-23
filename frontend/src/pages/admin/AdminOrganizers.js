import { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, Trash2, Loader2, Users, Building, Mail, Phone } from 'lucide-react';
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

const AdminOrganizers = () => {
  const { getAuthHeaders } = useAuth();
  const [organizers, setOrganizers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    password: '',
    full_name: '',
    company_name: ''
  });

  useEffect(() => {
    fetchOrganizers();
  }, []);

  const fetchOrganizers = async () => {
    try {
      const response = await axios.get(`${API}/admin/organizers`, {
        headers: getAuthHeaders()
      });
      setOrganizers(response.data);
    } catch (error) {
      console.error('Failed to fetch organizers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      await axios.post(`${API}/admin/organizers`, formData, {
        headers: getAuthHeaders()
      });
      toast.success('Organisateur créé! Identifiants envoyés.');
      setIsModalOpen(false);
      setFormData({ email: '', phone: '', password: '', full_name: '', company_name: '' });
      fetchOrganizers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (orgId) => {
    try {
      await axios.delete(`${API}/admin/organizers/${orgId}`, {
        headers: getAuthHeaders()
      });
      toast.success('Organisateur supprimé');
      fetchOrganizers();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    } finally {
      setDeleteConfirm(null);
    }
  };

  const generatePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData({ ...formData, password });
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
          <h1 className="font-unbounded font-bold text-2xl text-white">Organisateurs</h1>
          <p className="text-gray-400">Gérez les comptes organisateurs</p>
        </div>
        <Button onClick={() => setIsModalOpen(true)} className="bg-green-500 hover:bg-green-600 text-black gap-2">
          <Plus size={20} />
          Ajouter
        </Button>
      </div>

      {/* Organizers List */}
      <div className="space-y-4">
        {organizers.length === 0 ? (
          <div className="glass p-12 rounded-xl text-center">
            <Users className="mx-auto text-gray-500 mb-4" size={48} />
            <p className="text-gray-400">Aucun organisateur. Créez le premier!</p>
          </div>
        ) : (
          organizers.map(org => (
            <div key={org.id} className="glass p-5 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-purple-500/20 flex items-center justify-center">
                  <Building className="text-purple-400" size={28} />
                </div>
                <div>
                  <h3 className="font-semibold text-white">{org.full_name}</h3>
                  <p className="text-purple-400 text-sm">{org.company_name}</p>
                  <div className="flex items-center gap-4 mt-1 text-gray-500 text-sm">
                    <span className="flex items-center gap-1">
                      <Mail size={12} />
                      {org.email}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone size={12} />
                      {org.phone}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteConfirm(org)}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 size={18} />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-unbounded">Créer un organisateur</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div>
              <Label>Nom complet</Label>
              <Input
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                placeholder="Mohamed Ali"
                required
              />
            </div>

            <div>
              <Label>Entreprise / Organisation</Label>
              <Input
                value={formData.company_name}
                onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                placeholder="Events Djibouti SARL"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="contact@example.dj"
                  required
                />
              </div>
              <div>
                <Label>Téléphone</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+253 77 XX XX XX"
                  required
                />
              </div>
            </div>

            <div>
              <Label>Mot de passe</Label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mot de passe initial"
                  required
                />
                <Button type="button" variant="outline" onClick={generatePassword}>
                  Générer
                </Button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                L'organisateur pourra changer ce mot de passe
              </p>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mt-4">
              <p className="text-yellow-400 text-sm">
                Les identifiants seront communiqués à l'organisateur. 
                Notez le mot de passe car il ne sera plus visible.
              </p>
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

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'organisateur?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action supprimera le compte de "{deleteConfirm?.full_name}". 
              Les événements associés seront conservés.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleDelete(deleteConfirm?.id)}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminOrganizers;
