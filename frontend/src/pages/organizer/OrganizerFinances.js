import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Wallet, DollarSign, ArrowUpRight, Clock, CheckCircle, XCircle, Loader2, CreditCard, Building2, Smartphone } from 'lucide-react';
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PAYMENT_METHODS = [
  {
    id: 'dmoney',
    name: 'D-Money',
    icon: '/images/dmoney-logo.png',
    placeholder: 'Numéro D-Money (ex: +25377123456)',
    color: 'bg-green-500/20 border-green-500/50'
  },
  {
    id: 'waafi',
    name: 'Waafi',
    icon: '/images/waafi-logo.png',
    placeholder: 'Numéro Waafi (ex: +25377123456)',
    color: 'bg-orange-500/20 border-orange-500/50'
  },
  {
    id: 'bank_transfer',
    name: 'Virement Bancaire',
    icon: null,
    placeholder: 'IBAN ou numéro de compte',
    color: 'bg-blue-500/20 border-blue-500/50'
  }
];

const OrganizerFinances = () => {
  const { getAuthHeaders } = useAuth();
  const [finances, setFinances] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [withdrawalForm, setWithdrawalForm] = useState({
    amount: '',
    payment_method: 'dmoney',
    account_info: ''
  });

  const fetchFinances = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/organizer/finances`, {
        headers: getAuthHeaders()
      });
      setFinances(response.data);
    } catch (error) {
      console.error('Failed to fetch finances:', error);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchFinances();
  }, [fetchFinances]);

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-DJ').format(price) + ' DJF';
  };

  const handleWithdrawal = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await axios.post(`${API}/organizer/withdrawals`, {
        amount: parseInt(withdrawalForm.amount),
        payment_method: withdrawalForm.payment_method,
        account_info: withdrawalForm.account_info
      }, {
        headers: getAuthHeaders()
      });

      toast.success('Demande de retrait soumise!');
      setIsModalOpen(false);
      setWithdrawalForm({ amount: '', payment_method: 'dmoney', account_info: '' });
      fetchFinances();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la demande');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return (
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-400 text-xs">
            <CheckCircle size={12} />
            Complété
          </span>
        );
      case 'pending':
        return (
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs">
            <Clock size={12} />
            En attente
          </span>
        );
      case 'processing':
        return (
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs">
            <Loader2 size={12} className="animate-spin" />
            En cours
          </span>
        );
      case 'rejected':
        return (
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 text-red-400 text-xs">
            <XCircle size={12} />
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
        return <img src="/images/dmoney-logo.png" alt="D-Money" className="w-6 h-6 object-contain" />;
      case 'waafi':
        return <img src="/images/waafi-logo.png" alt="Waafi" className="w-6 h-6 object-contain" />;
      case 'bank_transfer':
        return <Building2 size={18} className="text-blue-400" />;
      default:
        return <CreditCard size={18} />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!finances) return null;

  const selectedMethod = PAYMENT_METHODS.find(m => m.id === withdrawalForm.payment_method);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-unbounded font-bold text-2xl text-white">Finances & Retraits</h1>
          <p className="text-gray-400">Gérez vos revenus et demandes de retrait</p>
        </div>
        <Button 
          onClick={() => setIsModalOpen(true)}
          disabled={finances.available_balance < 1000}
          className="bg-green-500 hover:bg-green-600 text-black gap-2"
          data-testid="request-withdrawal-btn"
        >
          <ArrowUpRight size={18} />
          Demander un retrait
        </Button>
      </div>

      {/* Finance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass p-5 rounded-xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <DollarSign className="text-green-400" size={20} />
            </div>
          </div>
          <p className="text-gray-400 text-sm">Revenus Totaux</p>
          <p className="font-mono font-bold text-xl text-white">{formatPrice(finances.total_revenue)}</p>
        </div>

        <div className="glass p-5 rounded-xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <span className="text-yellow-400 font-bold text-sm">8%</span>
            </div>
          </div>
          <p className="text-gray-400 text-sm">Commission D-Billet</p>
          <p className="font-mono font-bold text-xl text-yellow-400">-{formatPrice(finances.commission)}</p>
        </div>

        <div className="glass p-5 rounded-xl">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
              <ArrowUpRight className="text-cyan-400" size={20} />
            </div>
          </div>
          <p className="text-gray-400 text-sm">Déjà Retiré</p>
          <p className="font-mono font-bold text-xl text-white">{formatPrice(finances.total_withdrawn)}</p>
        </div>

        <div className="glass p-5 rounded-xl border-2 border-green-500/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
              <Wallet className="text-green-400" size={20} />
            </div>
          </div>
          <p className="text-gray-400 text-sm">Solde Disponible</p>
          <p className="font-mono font-bold text-2xl text-green-400">{formatPrice(finances.available_balance)}</p>
          {finances.pending_withdrawals > 0 && (
            <p className="text-yellow-400 text-xs mt-1">
              ({formatPrice(finances.pending_withdrawals)} en attente)
            </p>
          )}
        </div>
      </div>

      {/* Withdrawal History */}
      <div className="glass p-6 rounded-xl">
        <h3 className="font-unbounded font-semibold text-lg text-white mb-6">
          Historique des Retraits
        </h3>

        {finances.withdrawals?.length > 0 ? (
          <div className="space-y-4">
            {finances.withdrawals.map((withdrawal) => (
              <div 
                key={withdrawal.id} 
                className="flex items-center justify-between p-4 rounded-xl bg-white/5"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    {getPaymentMethodIcon(withdrawal.payment_method)}
                  </div>
                  <div>
                    <p className="text-white font-medium">{formatPrice(withdrawal.amount)}</p>
                    <p className="text-gray-500 text-sm">
                      {withdrawal.account_info} • {new Date(withdrawal.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
                {getStatusBadge(withdrawal.status)}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            <Wallet className="mx-auto mb-4 opacity-50" size={48} />
            <p>Aucun retrait effectué</p>
            <p className="text-sm mt-1">Vos demandes de retrait apparaîtront ici</p>
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="glass p-4 rounded-xl border border-green-500/30">
        <h4 className="text-green-400 font-semibold mb-2">Informations sur les retraits</h4>
        <ul className="text-gray-400 text-sm space-y-1">
          <li>• Retrait minimum: <span className="text-white">1 000 DJF</span></li>
          <li>• Délai de traitement: <span className="text-white">24-48h ouvrées</span></li>
          <li>• Commission D-Billet: <span className="text-yellow-400">8%</span> sur chaque vente</li>
          <li>• Modes de paiement: D-Money, Waafi, Virement bancaire</li>
        </ul>
      </div>

      {/* Withdrawal Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-unbounded">Demander un retrait</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleWithdrawal} className="space-y-6 mt-4">
            {/* Available Balance Display */}
            <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
              <p className="text-gray-400 text-sm">Solde disponible</p>
              <p className="font-mono font-bold text-2xl text-green-400">
                {formatPrice(finances.available_balance)}
              </p>
            </div>

            {/* Amount */}
            <div>
              <Label>Montant à retirer (DJF)</Label>
              <Input
                type="number"
                value={withdrawalForm.amount}
                onChange={(e) => setWithdrawalForm({ ...withdrawalForm, amount: e.target.value })}
                placeholder="Ex: 50000"
                min="1000"
                max={finances.available_balance}
                required
              />
              <p className="text-xs text-gray-500 mt-1">Minimum: 1 000 DJF</p>
            </div>

            {/* Payment Method Selection */}
            <div>
              <Label>Mode de paiement</Label>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setWithdrawalForm({ ...withdrawalForm, payment_method: method.id })}
                    className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-2
                      ${withdrawalForm.payment_method === method.id 
                        ? method.color 
                        : 'border-white/10 bg-white/5 hover:border-white/20'}`}
                  >
                    {method.icon ? (
                      <img src={method.icon} alt={method.name} className="w-8 h-8 object-contain" />
                    ) : (
                      <Building2 size={24} className="text-blue-400" />
                    )}
                    <span className="text-xs text-white">{method.name}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Account Info */}
            <div>
              <Label>
                {withdrawalForm.payment_method === 'bank_transfer' 
                  ? 'Numéro de compte / IBAN' 
                  : 'Numéro de téléphone'}
              </Label>
              <Input
                value={withdrawalForm.account_info}
                onChange={(e) => setWithdrawalForm({ ...withdrawalForm, account_info: e.target.value })}
                placeholder={selectedMethod?.placeholder}
                required
              />
            </div>

            {/* Summary */}
            {withdrawalForm.amount && (
              <div className="p-4 rounded-xl bg-white/5 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Montant demandé</span>
                  <span className="text-white font-mono">{formatPrice(parseInt(withdrawalForm.amount) || 0)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Mode de paiement</span>
                  <span className="text-white">{selectedMethod?.name}</span>
                </div>
                <div className="flex justify-between border-t border-white/10 pt-2 mt-2">
                  <span className="text-gray-400">Délai estimé</span>
                  <span className="text-green-400">24-48h</span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Annuler
              </Button>
              <Button 
                type="submit" 
                disabled={submitting || !withdrawalForm.amount || !withdrawalForm.account_info}
                className="bg-green-500 hover:bg-green-600 text-black"
              >
                {submitting ? <Loader2 className="animate-spin" size={20} /> : 'Confirmer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrganizerFinances;
