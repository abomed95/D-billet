import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Search, Users, Building, Mail, Phone, Ticket, DollarSign, 
  Percent, ChevronRight, X, Loader2, History, User
} from 'lucide-react';
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '../../components/ui/tabs';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminUsers = () => {
  const { getAuthHeaders } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetail, setUserDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [commissionModal, setCommissionModal] = useState(null);
  const [newCommission, setNewCommission] = useState('');
  const [savingCommission, setSavingCommission] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [activeTab]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let url = `${API}/admin/users`;
      if (activeTab !== 'all') {
        url += `?role=${activeTab}`;
      }
      const response = await axios.get(url, { headers: getAuthHeaders() });
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserDetail = async (userId) => {
    setLoadingDetail(true);
    try {
      const response = await axios.get(`${API}/admin/users/${userId}`, {
        headers: getAuthHeaders()
      });
      setUserDetail(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleUserClick = (user) => {
    setSelectedUser(user);
    fetchUserDetail(user.id);
  };

  const saveCommission = async () => {
    setSavingCommission(true);
    try {
      await axios.put(
        `${API}/admin/users/${commissionModal.id}/commission?commission_rate=${parseFloat(newCommission)}`,
        {},
        { headers: getAuthHeaders() }
      );
      toast.success('Commission mise à jour');
      setCommissionModal(null);
      fetchUsers();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    } finally {
      setSavingCommission(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-DJ').format(price) + ' DJF';
  };

  const filteredUsers = users.filter(user => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      user.full_name?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.phone?.includes(search) ||
      user.company_name?.toLowerCase().includes(searchLower)
    );
  });

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return <span className="px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs font-medium">Admin</span>;
      case 'organizer':
        return <span className="px-2 py-1 rounded-full bg-purple-500/20 text-purple-400 text-xs font-medium">Organisateur</span>;
      default:
        return <span className="px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-medium">Client</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-unbounded font-bold text-2xl md:text-3xl text-white mb-2">
          Gestion des Utilisateurs
        </h1>
        <p className="text-gray-400">Organisateurs et acheteurs de la plateforme</p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="glass">
          <TabsTrigger value="all" className="data-[state=active]:bg-green-500 data-[state=active]:text-black">
            Tous
          </TabsTrigger>
          <TabsTrigger value="organizer" className="data-[state=active]:bg-purple-500 data-[state=active]:text-black">
            <Building size={16} className="mr-2" />
            Organisateurs
          </TabsTrigger>
          <TabsTrigger value="user" className="data-[state=active]:bg-cyan-500 data-[state=active]:text-black">
            <User size={16} className="mr-2" />
            Clients
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, email, téléphone..."
          className="pl-12 bg-white/5 border-white/10"
          data-testid="search-users"
        />
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass p-4 rounded-xl">
          <p className="text-gray-400 text-sm">Total Utilisateurs</p>
          <p className="font-mono font-bold text-xl text-white">{users.length}</p>
        </div>
        <div className="glass p-4 rounded-xl">
          <p className="text-gray-400 text-sm">Organisateurs</p>
          <p className="font-mono font-bold text-xl text-purple-400">
            {users.filter(u => u.role === 'organizer').length}
          </p>
        </div>
        <div className="glass p-4 rounded-xl">
          <p className="text-gray-400 text-sm">Clients</p>
          <p className="font-mono font-bold text-xl text-cyan-400">
            {users.filter(u => u.role === 'user').length}
          </p>
        </div>
        <div className="glass p-4 rounded-xl">
          <p className="text-gray-400 text-sm">Achats Totaux</p>
          <p className="font-mono font-bold text-xl text-green-400">
            {formatPrice(users.reduce((sum, u) => sum + (u.total_spent || 0), 0))}
          </p>
        </div>
      </div>

      {/* Users List */}
      {loading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="glass p-12 rounded-xl text-center">
          <Users className="mx-auto text-gray-500 mb-4" size={48} />
          <p className="text-gray-400">Aucun utilisateur trouvé</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => (
            <div
              key={user.id}
              onClick={() => handleUserClick(user)}
              className="glass p-4 rounded-xl flex items-center gap-4 cursor-pointer hover:border-white/20 transition-all"
              data-testid={`user-row-${user.id}`}
            >
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                user.role === 'organizer' 
                  ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20' 
                  : 'bg-gradient-to-br from-cyan-500/20 to-blue-500/20'
              }`}>
                {user.role === 'organizer' ? (
                  <Building className="text-purple-400" size={24} />
                ) : (
                  <User className="text-cyan-400" size={24} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-white truncate">{user.full_name}</h3>
                  {getRoleBadge(user.role)}
                  {user.custom_commission !== undefined && (
                    <span className="px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 text-xs">
                      {user.custom_commission}% commission
                    </span>
                  )}
                </div>
                {user.company_name && (
                  <p className="text-purple-400 text-sm">{user.company_name}</p>
                )}
                <div className="flex items-center gap-4 text-gray-500 text-sm">
                  {user.email && (
                    <span className="flex items-center gap-1">
                      <Mail size={12} />
                      {user.email}
                    </span>
                  )}
                  {user.phone && (
                    <span className="flex items-center gap-1">
                      <Phone size={12} />
                      {user.phone}
                    </span>
                  )}
                </div>
              </div>

              <div className="hidden md:flex items-center gap-6">
                <div className="text-center">
                  <p className="text-gray-500 text-xs">Achats</p>
                  <p className="font-mono text-white">{user.tickets_purchased || 0}</p>
                </div>
                <div className="text-center">
                  <p className="text-gray-500 text-xs">Dépensé</p>
                  <p className="font-mono text-green-400">{formatPrice(user.total_spent || 0)}</p>
                </div>
              </div>

              <ChevronRight className="text-gray-500" size={20} />
            </div>
          ))}
        </div>
      )}

      {/* User Detail Modal */}
      <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-unbounded flex items-center gap-3">
              {selectedUser?.role === 'organizer' ? (
                <Building className="text-purple-400" size={24} />
              ) : (
                <User className="text-cyan-400" size={24} />
              )}
              {selectedUser?.full_name}
            </DialogTitle>
          </DialogHeader>

          {loadingDetail ? (
            <div className="space-y-4 py-8">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-40 rounded-xl" />
            </div>
          ) : userDetail && (
            <div className="space-y-6 mt-4">
              {/* User Info */}
              <div className="glass p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Rôle</span>
                  {getRoleBadge(userDetail.role)}
                </div>
                {userDetail.email && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Email</span>
                    <a href={`mailto:${userDetail.email}`} className="text-green-400 hover:underline">
                      {userDetail.email}
                    </a>
                  </div>
                )}
                {userDetail.phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Téléphone</span>
                    <a href={`tel:${userDetail.phone}`} className="text-green-400 hover:underline">
                      {userDetail.phone}
                    </a>
                  </div>
                )}
                {userDetail.company_name && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Entreprise</span>
                    <span className="text-white">{userDetail.company_name}</span>
                  </div>
                )}
                {userDetail.role === 'organizer' && (
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Commission</span>
                    <div className="flex items-center gap-2">
                      <span className="text-yellow-400 font-mono">
                        {userDetail.custom_commission ?? 8}%
                      </span>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          setCommissionModal(userDetail);
                          setNewCommission(userDetail.custom_commission?.toString() || '8');
                        }}
                      >
                        <Percent size={14} className="mr-1" />
                        Modifier
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Purchase History */}
              {userDetail.purchase_history?.length > 0 && (
                <div>
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <History size={18} />
                    Historique des Achats ({userDetail.purchase_history.length})
                  </h4>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {userDetail.purchase_history.map((ticket) => (
                      <div key={ticket.id} className="glass p-3 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="text-white text-sm">{ticket.event_title}</p>
                          <p className="text-gray-500 text-xs">{ticket.event_date} • {ticket.ticket_type}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono text-green-400 text-sm">{formatPrice(ticket.price)}</p>
                          <p className={`text-xs ${ticket.status === 'used' ? 'text-gray-500' : 'text-cyan-400'}`}>
                            {ticket.status === 'used' ? 'Utilisé' : 'Valide'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Events (for organizers) */}
              {userDetail.events?.length > 0 && (
                <div>
                  <h4 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Ticket size={18} />
                    Événements Créés ({userDetail.events.length})
                  </h4>
                  <div className="space-y-2">
                    {userDetail.events.map((event) => (
                      <div key={event.id} className="glass p-3 rounded-lg flex items-center justify-between">
                        <div>
                          <p className="text-white text-sm">{event.title}</p>
                          <p className="text-gray-500 text-xs">{event.date} • {event.venue}</p>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          event.status === 'approved' ? 'bg-green-500/20 text-green-400' :
                          event.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-red-500/20 text-red-400'
                        }`}>
                          {event.status || 'approved'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                {userDetail.email && (
                  <Button variant="outline" asChild>
                    <a href={`mailto:${userDetail.email}`}>
                      <Mail size={16} className="mr-2" />
                      Contacter
                    </a>
                  </Button>
                )}
                {userDetail.phone && (
                  <Button variant="outline" asChild>
                    <a href={`tel:${userDetail.phone}`}>
                      <Phone size={16} className="mr-2" />
                      Appeler
                    </a>
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Commission Modal */}
      <Dialog open={!!commissionModal} onOpenChange={() => setCommissionModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-unbounded">Commission Personnalisée</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-gray-400 text-sm">
              Définir un taux de commission spécial pour <span className="text-white">{commissionModal?.full_name}</span>
            </p>
            <div>
              <Label>Taux de commission (%)</Label>
              <Input
                type="number"
                value={newCommission}
                onChange={(e) => setNewCommission(e.target.value)}
                min="0"
                max="50"
                step="0.5"
              />
              <p className="text-xs text-gray-500 mt-1">Taux standard: 8%</p>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setCommissionModal(null)}>
                Annuler
              </Button>
              <Button 
                onClick={saveCommission} 
                disabled={savingCommission}
                className="bg-green-500 hover:bg-green-600 text-black"
              >
                {savingCommission ? <Loader2 className="animate-spin" size={16} /> : 'Enregistrer'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUsers;
