import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Shield, Plus, Trash2, Eye, EyeOff, Copy, Check, 
  RefreshCw, Loader2, User, Calendar, Activity,
  ToggleLeft, ToggleRight, Clock, Search
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

const OrganizerStaff = () => {
  const { getAuthHeaders } = useAuth();
  const [staffList, setStaffList] = useState([]);
  const [events, setEvents] = useState([]);
  const [scanLogs, setScanLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Modal states
  const [createModal, setCreateModal] = useState(false);
  const [credentialsModal, setCredentialsModal] = useState({ open: false, username: '', password: '' });
  const [deleteModal, setDeleteModal] = useState({ open: false, staff: null });
  const [logsModal, setLogsModal] = useState({ open: false, staffId: null });
  
  // Form state
  const [newStaff, setNewStaff] = useState({
    username: '',
    full_name: '',
    assigned_events: []
  });
  
  const [showPassword, setShowPassword] = useState({});
  const [copiedField, setCopiedField] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [staffRes, eventsRes, logsRes] = await Promise.all([
        axios.get(`${API}/organizer/staff`, { headers: getAuthHeaders() }),
        axios.get(`${API}/organizer/events`, { headers: getAuthHeaders() }),
        axios.get(`${API}/organizer/staff/scan-logs?limit=50`, { headers: getAuthHeaders() })
      ]);
      setStaffList(staffRes.data);
      setEvents(eventsRes.data);
      setScanLogs(logsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateStaff = async () => {
    if (!newStaff.username || !newStaff.full_name) {
      toast.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    setSaving(true);
    try {
      const response = await axios.post(`${API}/organizer/staff`, newStaff, {
        headers: getAuthHeaders()
      });
      
      toast.success('Compte staff créé!');
      setCreateModal(false);
      setCredentialsModal({
        open: true,
        username: response.data.username,
        password: response.data.password
      });
      setNewStaff({ username: '', full_name: '', assigned_events: [] });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (staffId, currentActive) => {
    try {
      await axios.put(
        `${API}/organizer/staff/${staffId}`,
        { active: !currentActive },
        { headers: getAuthHeaders() }
      );
      toast.success(currentActive ? 'Compte désactivé' : 'Compte activé');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleResetPassword = async (staffId) => {
    try {
      const response = await axios.post(
        `${API}/organizer/staff/${staffId}/reset-password`,
        {},
        { headers: getAuthHeaders() }
      );
      setCredentialsModal({
        open: true,
        username: response.data.username,
        password: response.data.new_password
      });
      toast.success('Mot de passe réinitialisé');
    } catch (error) {
      toast.error('Erreur lors de la réinitialisation');
    }
  };

  const handleDeleteStaff = async () => {
    if (!deleteModal.staff) return;
    
    try {
      await axios.delete(`${API}/organizer/staff/${deleteModal.staff.id}`, {
        headers: getAuthHeaders()
      });
      toast.success('Compte supprimé');
      setDeleteModal({ open: false, staff: null });
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la suppression');
    }
  };

  const handleUpdateEvents = async (staffId, eventIds) => {
    try {
      await axios.put(
        `${API}/organizer/staff/${staffId}`,
        { assigned_events: eventIds },
        { headers: getAuthHeaders() }
      );
      toast.success('Événements mis à jour');
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const formatDate = (isoDate) => {
    return new Date(isoDate).toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-64 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-unbounded font-bold text-2xl md:text-3xl text-white mb-2 flex items-center gap-3">
            <Shield className="text-orange-500" size={32} />
            Mon Staff
          </h1>
          <p className="text-gray-400">Gérez vos agents de sécurité pour le contrôle d'accès</p>
        </div>
        <Button
          onClick={() => setCreateModal(true)}
          className="bg-orange-500 hover:bg-orange-600 text-black gap-2"
          data-testid="create-staff-btn"
        >
          <Plus size={20} />
          Créer un compte staff
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <User className="text-orange-400" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{staffList.length}</p>
              <p className="text-gray-400 text-sm">Agents</p>
            </div>
          </div>
        </div>
        <div className="glass p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
              <Activity className="text-green-400" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {staffList.filter(s => s.active).length}
              </p>
              <p className="text-gray-400 text-sm">Actifs</p>
            </div>
          </div>
        </div>
        <div className="glass p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <Calendar className="text-cyan-400" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{events.length}</p>
              <p className="text-gray-400 text-sm">Événements</p>
            </div>
          </div>
        </div>
        <div className="glass p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <Search className="text-purple-400" size={20} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{scanLogs.length}</p>
              <p className="text-gray-400 text-sm">Scans récents</p>
            </div>
          </div>
        </div>
      </div>

      {/* Staff List */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h2 className="font-semibold text-white">Comptes Staff</h2>
        </div>
        
        {staffList.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="text-gray-600 mx-auto mb-4" size={48} />
            <p className="text-gray-400 mb-4">Aucun compte staff créé</p>
            <Button onClick={() => setCreateModal(true)} className="bg-orange-500 hover:bg-orange-600 text-black">
              Créer le premier compte
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-white/10">
            {staffList.map(staff => (
              <div key={staff.id} className="p-4 hover:bg-white/5 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                  {/* Staff Info */}
                  <div className="flex items-center gap-4 flex-1">
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
                  
                  {/* Assigned Events */}
                  <div className="flex-1">
                    <p className="text-gray-500 text-xs mb-1">Événements assignés:</p>
                    <div className="flex flex-wrap gap-1">
                      {staff.assigned_events.length === 0 ? (
                        <span className="text-gray-500 text-sm italic">Aucun</span>
                      ) : (
                        staff.assigned_events.map(eventId => {
                          const event = events.find(e => e.id === eventId);
                          return (
                            <span key={eventId} className="px-2 py-1 rounded bg-orange-500/20 text-orange-400 text-xs">
                              {event?.title || eventId.slice(0, 8)}
                            </span>
                          );
                        })
                      )}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 mr-4">
                      <span className={`text-sm ${staff.active ? 'text-green-400' : 'text-red-400'}`}>
                        {staff.active ? 'Actif' : 'Inactif'}
                      </span>
                      <Switch
                        checked={staff.active}
                        onCheckedChange={() => handleToggleActive(staff.id, staff.active)}
                      />
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleResetPassword(staff.id)}
                      className="text-cyan-400 hover:text-cyan-300"
                    >
                      <RefreshCw size={16} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteModal({ open: true, staff })}
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
                
                {/* Event Assignment */}
                <div className="mt-4 pt-4 border-t border-white/5">
                  <p className="text-gray-500 text-xs mb-2">Assigner aux événements:</p>
                  <div className="flex flex-wrap gap-2">
                    {events.map(event => {
                      const isAssigned = staff.assigned_events.includes(event.id);
                      return (
                        <button
                          key={event.id}
                          onClick={() => {
                            const newEvents = isAssigned
                              ? staff.assigned_events.filter(id => id !== event.id)
                              : [...staff.assigned_events, event.id];
                            handleUpdateEvents(staff.id, newEvents);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                            isAssigned
                              ? 'bg-orange-500 text-black font-medium'
                              : 'bg-white/5 text-gray-400 hover:bg-white/10'
                          }`}
                        >
                          {event.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Scan Logs */}
      <div className="glass rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="font-semibold text-white flex items-center gap-2">
            <Clock size={18} className="text-purple-400" />
            Journal des scans récents
          </h2>
          <Button variant="ghost" size="sm" onClick={fetchData} className="text-gray-400">
            <RefreshCw size={16} />
          </Button>
        </div>
        
        {scanLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Aucun scan enregistré
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <div className="divide-y divide-white/5">
              {scanLogs.map(log => (
                <div key={log.id} className="p-3 hover:bg-white/5 flex items-center gap-4">
                  <div className={`w-2 h-2 rounded-full ${
                    log.status === 'valid' ? 'bg-green-500' :
                    log.status === 'already_scanned' ? 'bg-orange-500' : 'bg-red-500'
                  }`}></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">
                      <span className="text-gray-400">{log.staff_name}</span> a scanné{' '}
                      <span className="font-medium">{log.client_name || 'Client'}</span>
                    </p>
                    <p className="text-gray-500 text-xs truncate">{log.event_title}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      log.status === 'valid' ? 'bg-green-500/20 text-green-400' :
                      log.status === 'already_scanned' ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'
                    }`}>
                      {log.status === 'valid' ? 'Validé' : 
                       log.status === 'already_scanned' ? 'Doublon' : 'Invalide'}
                    </span>
                    <p className="text-gray-500 text-xs mt-1">{formatDate(log.scanned_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Create Staff Modal */}
      <Dialog open={createModal} onOpenChange={setCreateModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-unbounded flex items-center gap-2">
              <Shield className="text-orange-500" size={24} />
              Créer un compte staff
            </DialogTitle>
            <DialogDescription>
              L'agent pourra scanner les billets sur vos événements
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <Label>Nom complet</Label>
              <Input
                value={newStaff.full_name}
                onChange={(e) => setNewStaff({ ...newStaff, full_name: e.target.value })}
                placeholder="Ex: Ali Mohamed"
                className="mt-1"
              />
            </div>
            
            <div>
              <Label>Identifiant de connexion</Label>
              <Input
                value={newStaff.username}
                onChange={(e) => setNewStaff({ ...newStaff, username: e.target.value.toLowerCase().replace(/\s/g, '_') })}
                placeholder="Ex: ali_security"
                className="mt-1"
              />
              <p className="text-gray-500 text-xs mt-1">Pas d'espaces, lettres minuscules</p>
            </div>
            
            <div>
              <Label>Assigner aux événements (optionnel)</Label>
              <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                {events.map(event => (
                  <label key={event.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 cursor-pointer hover:bg-white/10">
                    <input
                      type="checkbox"
                      checked={newStaff.assigned_events.includes(event.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setNewStaff({ ...newStaff, assigned_events: [...newStaff.assigned_events, event.id] });
                        } else {
                          setNewStaff({ ...newStaff, assigned_events: newStaff.assigned_events.filter(id => id !== event.id) });
                        }
                      }}
                      className="rounded"
                    />
                    <span className="text-white text-sm">{event.title}</span>
                  </label>
                ))}
                {events.length === 0 && (
                  <p className="text-gray-500 text-sm p-2">Aucun événement disponible</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setCreateModal(false)}>
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

      {/* Credentials Modal */}
      <Dialog open={credentialsModal.open} onOpenChange={(open) => !open && setCredentialsModal({ ...credentialsModal, open: false })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-unbounded text-green-400 flex items-center gap-2">
              <Check size={24} />
              Identifiants du compte
            </DialogTitle>
            <DialogDescription>
              Notez bien ces informations, le mot de passe ne sera plus affiché!
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-gray-400 text-sm">Identifiant</p>
                  <p className="text-white font-mono text-lg">{credentialsModal.username}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(credentialsModal.username, 'username')}
                  className="text-gray-400"
                >
                  {copiedField === 'username' ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                </Button>
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Mot de passe</p>
                  <p className="text-white font-mono text-lg">
                    {showPassword.credentials ? credentialsModal.password : '••••••••'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowPassword({ ...showPassword, credentials: !showPassword.credentials })}
                    className="text-gray-400"
                  >
                    {showPassword.credentials ? <EyeOff size={16} /> : <Eye size={16} />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(credentialsModal.password, 'password')}
                    className="text-gray-400"
                  >
                    {copiedField === 'password' ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                  </Button>
                </div>
              </div>
            </div>
            
            <p className="text-gray-500 text-sm text-center">
              L'agent se connecte sur <span className="text-orange-400">/staff/login</span>
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

      {/* Delete Confirmation */}
      <AlertDialog open={deleteModal.open} onOpenChange={(open) => !open && setDeleteModal({ ...deleteModal, open: false })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400 flex items-center gap-2">
              <Trash2 size={20} />
              Supprimer le compte staff
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le compte de <strong className="text-white">{deleteModal.staff?.full_name}</strong>?
              <br />Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteStaff}
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

export default OrganizerStaff;
