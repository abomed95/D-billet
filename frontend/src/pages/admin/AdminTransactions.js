import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  DollarSign, Search, Filter, Download, CreditCard, 
  Smartphone, Building2, TrendingUp, Calendar
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Skeleton } from '../../components/ui/skeleton';
import { useAuth } from '../../context/AuthContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminTransactions = () => {
  const { getAuthHeaders } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [daysFilter, setDaysFilter] = useState(30);

  useEffect(() => {
    fetchTransactions();
  }, [paymentFilter, daysFilter]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      let url = `${API}/admin/transactions?days=${daysFilter}`;
      if (paymentFilter !== 'all') {
        url += `&payment_method=${paymentFilter}`;
      }
      const response = await axios.get(url, { headers: getAuthHeaders() });
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setLoading(false);
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

  const getPaymentIcon = (method) => {
    switch (method) {
      case 'waafi':
        return <img src="/images/waafi-logo.png" alt="Waafi" className="w-6 h-6 object-contain" />;
      case 'dmoney':
        return <img src="/images/dmoney-logo.png" alt="D-Money" className="w-6 h-6 object-contain" />;
      case 'cacbank':
        return <img src="/images/cac-bank-logo.webp" alt="CAC Bank" className="w-6 h-6 object-contain" />;
      default:
        return <CreditCard size={18} className="text-gray-400" />;
    }
  };

  const getPaymentLabel = (method) => {
    switch (method) {
      case 'waafi': return 'Waafi';
      case 'dmoney': return 'D-Money';
      case 'cacbank': return 'CAC Bank';
      default: return method;
    }
  };

  const filteredTransactions = data?.transactions?.filter(t => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      t.event_title?.toLowerCase().includes(searchLower) ||
      t.buyer_name?.toLowerCase().includes(searchLower) ||
      t.buyer_email?.toLowerCase().includes(searchLower)
    );
  }) || [];

  const exportCSV = () => {
    if (!filteredTransactions.length) return;
    
    const headers = ['Date', 'Événement', 'Type', 'Acheteur', 'Montant', 'Méthode', 'Statut'];
    const rows = filteredTransactions.map(t => [
      t.created_at?.slice(0, 10),
      t.event_title,
      t.ticket_type,
      t.buyer_name,
      t.amount,
      getPaymentLabel(t.payment_method),
      t.status
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-unbounded font-bold text-2xl md:text-3xl text-white mb-2">
            Finances & Transactions
          </h1>
          <p className="text-gray-400">Historique de tous les paiements de la plateforme</p>
        </div>
        <Button onClick={exportCSV} className="bg-green-500 hover:bg-green-600 text-black gap-2">
          <Download size={18} />
          Exporter CSV
        </Button>
      </div>

      {/* Summary Cards */}
      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass p-5 rounded-xl">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center">
                <TrendingUp className="text-green-400" size={20} />
              </div>
            </div>
            <p className="text-gray-400 text-sm">Total Période</p>
            <p className="font-mono font-bold text-2xl text-green-400">{formatPrice(data.total_amount)}</p>
            <p className="text-gray-500 text-xs mt-1">{data.total_count} transactions</p>
          </div>

          {Object.entries(data.totals_by_method || {}).map(([method, stats]) => (
            <div key={method} className="glass p-5 rounded-xl">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  {getPaymentIcon(method)}
                </div>
              </div>
              <p className="text-gray-400 text-sm">{getPaymentLabel(method)}</p>
              <p className="font-mono font-bold text-xl text-white">{formatPrice(stats.amount)}</p>
              <p className="text-gray-500 text-xs mt-1">{stats.count} transactions</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="glass p-4 rounded-xl">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher par événement, acheteur..."
              className="pl-10 bg-white/5 border-white/10"
            />
          </div>
          
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="w-full md:w-48 bg-white/5 border-white/10">
              <Filter size={16} className="mr-2 text-gray-400" />
              <SelectValue placeholder="Méthode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les méthodes</SelectItem>
              <SelectItem value="waafi">Waafi</SelectItem>
              <SelectItem value="dmoney">D-Money</SelectItem>
              <SelectItem value="cacbank">CAC Bank</SelectItem>
            </SelectContent>
          </Select>

          <Select value={daysFilter.toString()} onValueChange={(v) => setDaysFilter(parseInt(v))}>
            <SelectTrigger className="w-full md:w-40 bg-white/5 border-white/10">
              <Calendar size={16} className="mr-2 text-gray-400" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 derniers jours</SelectItem>
              <SelectItem value="30">30 derniers jours</SelectItem>
              <SelectItem value="90">90 derniers jours</SelectItem>
              <SelectItem value="365">Cette année</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Transactions List */}
      {loading ? (
        <div className="space-y-3">
          {Array(5).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="glass p-12 rounded-xl text-center">
          <DollarSign className="mx-auto text-gray-500 mb-4" size={48} />
          <p className="text-gray-400">Aucune transaction trouvée</p>
        </div>
      ) : (
        <div className="glass rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 p-4 bg-white/5 text-gray-400 text-sm font-medium">
            <div className="col-span-3">Événement</div>
            <div className="col-span-2">Acheteur</div>
            <div className="col-span-2">Montant</div>
            <div className="col-span-2">Méthode</div>
            <div className="col-span-2">Date</div>
            <div className="col-span-1">Statut</div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-white/5">
            {filteredTransactions.map((transaction) => (
              <div 
                key={transaction.id} 
                className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-4 p-4 hover:bg-white/5 transition-colors"
              >
                <div className="col-span-3">
                  <p className="text-white font-medium">{transaction.event_title}</p>
                  <p className="text-gray-500 text-sm md:hidden">{transaction.buyer_name}</p>
                  <p className="text-gray-500 text-xs">{transaction.ticket_type}</p>
                </div>
                <div className="col-span-2 hidden md:block">
                  <p className="text-white text-sm">{transaction.buyer_name}</p>
                  {transaction.buyer_email && (
                    <p className="text-gray-500 text-xs truncate">{transaction.buyer_email}</p>
                  )}
                </div>
                <div className="col-span-2">
                  <p className="font-mono font-bold text-green-400">{formatPrice(transaction.amount)}</p>
                </div>
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                      {getPaymentIcon(transaction.payment_method)}
                    </div>
                    <span className="text-gray-300 text-sm">{getPaymentLabel(transaction.payment_method)}</span>
                  </div>
                </div>
                <div className="col-span-2 hidden md:block">
                  <p className="text-gray-400 text-sm">{formatDate(transaction.created_at)}</p>
                </div>
                <div className="col-span-1">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    transaction.status === 'valid' ? 'bg-green-500/20 text-green-400' :
                    transaction.status === 'used' ? 'bg-gray-500/20 text-gray-400' :
                    transaction.status === 'refunded' ? 'bg-red-500/20 text-red-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    {transaction.status === 'valid' ? 'Valide' :
                     transaction.status === 'used' ? 'Utilisé' :
                     transaction.status === 'refunded' ? 'Remboursé' : transaction.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTransactions;
