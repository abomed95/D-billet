import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  Wallet, Check, X, Clock, Loader2, Building, 
  AlertCircle, CheckCircle, XCircle, Filter
} from 'lucide-react';
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

const AdminPayouts = () => {
  const { getAuthHeaders } = useAuth();
  const [payouts, setPayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedPayout, setSelectedPayout] = useState(null);
  const [actionType, setActionType] = useState(null); // 'approve' | 'reject'
  const [notes, setNotes] = useState('');
  const [processing, setProcessing] = useState(false);

  const fetchPayouts = useCallback(async () => {
    setLoading(true);
    try {
      let url = `${API}/admin/payouts`;
      if (statusFilter !== 'all') {
        url += `?status=${statusFilter}`;
      }
      const response = await axios.get(url, { headers: getAuthHeaders() });
      setPayouts(response.data);
    } catch (error) {
      console.error('Failed to fetch payouts:', error);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders, statusFilter]);

  useEffect(() => {
    fetchPayouts();
  }, [fetchPayouts]);

  const handleAction = async (status) => {
    setProcessing(true);
    try {
      let url = `${API}/admin/payouts/${selectedPayout.id}/status?status=${status}`;
      if (notes) {
        url += `&notes=${encodeURIComponent(notes)}`;
      }
      await axios.put(url, {}, { headers: getAuthHeaders() });
      toast.success(status === 'completed' ? 'Paiement validé!' : 'Demande rejetée');
      setSelectedPayout(null);
      setActionType(null);
      setNotes('');
      fetchPayouts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur');
    } finally {
      setProcessing(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-DJ').format(price) + ' DJF';
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return (
          <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-sm font-medium">
            <CheckCircle size={14} />
            Complété
          </span>
        );
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-sm font-medium">
            <Clock size={14} />
            En attente
          </span>
        );
      case 'processing':
        return (
          <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-sm font-medium">
            <Loader2 size={14} className="animate-spin" />
            En cours
          </span>
        );
      case 'rejected':
        return (
          <span className="flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/20 text-red-400 text-sm font-medium">
            <XCircle size={14} />
            Rejeté
          </span>
        );
      default:
        return null;
    }
  };

  const getPaymentMethodIcon = (method) => {
    switch (method) {
      case 'dmoney':
        return <img src="/images/dmoney-logo.png" alt="D-Money" className="w-8 h-8 object-contain" />;
      case 'waafi':
        return <img src="/images/waafi-logo.png" alt="Waafi" className="w-8 h-8 object-contain" />;
      default:
        return <Building size={20} className="text-blue-400" />;
    }
  };

  const getPaymentMethodName = (method) => {
    switch (method) {
      case 'dmoney': return 'D-Money';
      case 'waafi': return 'Waafi';
      case 'bank_transfer': return 'Virement Bancaire';
      default: return method;
    }
  };

  const pendingPayouts = payouts.filter(p => p.status === 'pending');
  const pendingTotal = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-unbounded font-bold text-2xl md:text-3xl text-white mb-2">
            Gestion des Payouts
          </h1>
          <p className="text-gray-400">Valider les demandes de retrait des organisateurs</p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass p-5 rounded-xl border-2 border-yellow-500/30">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <Clock className="text-yellow-400" size={24} />
            </div>
          </div>
          <p className="text-gray-400 text-sm">En Attente</p>
          <p className="font-mono font-bold text-2xl text-yellow-400">{formatPrice(pendingTotal)}</p>
          <p className="text-gray-500 text-xs mt-1">{pendingPayouts.length} demande(s)</p>
        </div>

        <div className="glass p-5 rounded-xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
              <CheckCircle className="text-green-400" size={24} />
            </div>
          </div>
          <p className="text-gray-400 text-sm">Complétés</p>
          <p className="font-mono font-bold text-2xl text-green-400">
            {formatPrice(payouts.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0))}
          </p>
          <p className="text-gray-500 text-xs mt-1">
            {payouts.filter(p => p.status === 'completed').length} paiement(s)
          </p>
        </div>

        <div className="glass p-5 rounded-xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
              <XCircle className="text-red-400" size={24} />
            </div>
          </div>
          <p className="text-gray-400 text-sm">Rejetés</p>
          <p className="font-mono font-bold text-2xl text-red-400">
            {formatPrice(payouts.filter(p => p.status === 'rejected').reduce((sum, p) => sum + p.amount, 0))}
          </p>
          <p className="text-gray-500 text-xs mt-1">
            {payouts.filter(p => p.status === 'rejected').length} demande(s)
          </p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex justify-end">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48 bg-white/5 border-white/10">
            <Filter size={16} className="mr-2 text-gray-400" />
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="processing">En cours</SelectItem>
            <SelectItem value="completed">Complétés</SelectItem>
            <SelectItem value="rejected">Rejetés</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Payouts List */}
      {loading ? (
        <div className="space-y-3">
          {Array(4).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : payouts.length === 0 ? (
        <div className="glass p-12 rounded-xl text-center">
          <Wallet className="mx-auto text-gray-500 mb-4" size={48} />
          <p className="text-gray-400">Aucune demande de retrait</p>
        </div>
      ) : (
        <div className="space-y-4">
          {payouts.map((payout) => (
            <div 
              key={payout.id} 
              className={`glass p-5 rounded-xl ${payout.status === 'pending' ? 'border-2 border-yellow-500/30' : ''}`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center">
                    {getPaymentMethodIcon(payout.payment_method)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <p className="font-mono font-bold text-xl text-white">{formatPrice(payout.amount)}</p>
                      {getStatusBadge(payout.status)}
                    </div>
                    <p className="text-gray-400 text-sm">
                      {payout.organizer?.full_name || payout.organizer_name} • {payout.organizer?.company_name}
                    </p>
                    <div className="flex items-center gap-4 mt-1 text-gray-500 text-xs">
                      <span>{getPaymentMethodName(payout.payment_method)}</span>
                      <span>→ {payout.account_info}</span>
                      <span>{formatDate(payout.created_at)}</span>
                    </div>
                  </div>
                </div>

                {payout.status === 'pending' && (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setSelectedPayout(payout);
                        setActionType('reject');
                      }}
                      variant="outline"
                      className="border-red-500/50 text-red-400 hover:bg-red-500/10"
                    >
                      <X size={18} className="mr-2" />
                      Rejeter
                    </Button>
                    <Button
                      onClick={() => {
                        setSelectedPayout(payout);
                        setActionType('approve');
                      }}
                      className="bg-green-500 hover:bg-green-600 text-black"
                    >
                      <Check size={18} className="mr-2" />
                      Valider
                    </Button>
                  </div>
                )}

                {payout.admin_notes && (
                  <div className="mt-2 p-2 rounded-lg bg-white/5 text-gray-400 text-sm">
                    Note: {payout.admin_notes}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Approve Dialog */}
      <AlertDialog open={actionType === 'approve'} onOpenChange={() => setActionType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-green-400">
              <CheckCircle size={24} />
              Confirmer le paiement
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vous confirmez avoir effectué le virement de <strong className="text-green-400">{formatPrice(selectedPayout?.amount || 0)}</strong> via {getPaymentMethodName(selectedPayout?.payment_method)} vers <strong>{selectedPayout?.account_info}</strong> pour <strong>{selectedPayout?.organizer?.full_name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            <Label>Note (optionnelle)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Référence de transaction, commentaire..."
              rows={2}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setActionType(null); setNotes(''); }}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleAction('completed')}
              disabled={processing}
              className="bg-green-500 text-black hover:bg-green-600"
            >
              {processing ? <Loader2 className="animate-spin" size={16} /> : 'Confirmer le paiement'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <AlertDialog open={actionType === 'reject'} onOpenChange={() => setActionType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-400">
              <AlertCircle size={24} />
              Rejeter la demande
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir rejeter la demande de retrait de <strong className="text-white">{formatPrice(selectedPayout?.amount || 0)}</strong> de <strong>{selectedPayout?.organizer?.full_name}</strong> ?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            <Label>Raison du rejet</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Expliquez la raison du rejet..."
              rows={2}
              required
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setActionType(null); setNotes(''); }}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleAction('rejected')}
              disabled={processing || !notes}
              className="bg-red-500 text-white hover:bg-red-600"
            >
              {processing ? <Loader2 className="animate-spin" size={16} /> : 'Rejeter'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPayouts;
