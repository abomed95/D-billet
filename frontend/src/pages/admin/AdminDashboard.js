import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { 
  DollarSign, Ticket, Calendar, TrendingUp, Users, AlertTriangle, 
  Clock, Wallet, ArrowUpRight, ChevronRight, Train, Ship, Star
} from 'lucide-react';
import { Skeleton } from '../../components/ui/skeleton';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminDashboard = () => {
  const { getAuthHeaders } = useAuth();
  const [stats, setStats] = useState(null);
  const [alerts, setAlerts] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, alertsRes] = await Promise.all([
        axios.get(`${API}/admin/stats`, { headers: getAuthHeaders() }),
        axios.get(`${API}/admin/alerts`, { headers: getAuthHeaders() })
      ]);
      setStats(statsRes.data);
      setAlerts(alertsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, [getAuthHeaders]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const toSafeNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-DJ').format(toSafeNumber(price)) + ' DJF';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    );
  }

  if (!stats) return null;

  const platformRevenue = stats.platform_revenue ?? stats.commission ?? 0;
  const commissionRate = toSafeNumber(stats.commission_rate) || 8;

  const mainStats = [
    {
      title: 'Chiffre d\'Affaires Global',
      value: formatPrice(stats.total_revenue),
      subtitle: 'Total des ventes',
      icon: DollarSign,
      color: 'from-green-500 to-emerald-600',
      iconBg: 'bg-green-500/20',
      iconColor: 'text-green-400',
    },
    {
      title: 'Revenus Plateforme',
      value: formatPrice(platformRevenue),
      subtitle: `Commission ${commissionRate}%`,
      icon: TrendingUp,
      color: 'from-yellow-500 to-orange-500',
      iconBg: 'bg-yellow-500/20',
      iconColor: 'text-yellow-400',
    },
    {
      title: 'Utilisateurs Inscrits',
      value: stats.total_users + stats.total_organizers,
      subtitle: `${stats.total_users} clients • ${stats.total_organizers} organisateurs`,
      icon: Users,
      color: 'from-cyan-500 to-blue-500',
      iconBg: 'bg-cyan-500/20',
      iconColor: 'text-cyan-400',
    },
    {
      title: 'Événements Actifs',
      value: stats.total_events,
      subtitle: `${stats.total_tickets_sold} billets vendus`,
      icon: Calendar,
      color: 'from-purple-500 to-pink-500',
      iconBg: 'bg-purple-500/20',
      iconColor: 'text-purple-400',
    },
  ];

  const hasAlerts = alerts && alerts.total_alerts > 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-unbounded font-bold text-2xl md:text-3xl text-white mb-2">
            Tableau de Bord
          </h1>
          <p className="text-gray-400">Vue d'ensemble de la plateforme Ticket Djibouti</p>
        </div>
        <div className="flex gap-3">
          <Link to="/admin/transactions">
            <Button variant="outline" className="gap-2">
              <DollarSign size={18} />
              Transactions
            </Button>
          </Link>
          <Link to="/admin/payouts">
            <Button className="bg-green-500 hover:bg-green-600 text-black gap-2">
              <Wallet size={18} />
              Payouts
            </Button>
          </Link>
        </div>
      </div>

      {/* Alerts Section */}
      {hasAlerts && (
        <div className="glass p-5 rounded-2xl border-2 border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-orange-500/10">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <AlertTriangle className="text-yellow-400" size={22} />
            </div>
            <div>
              <h3 className="text-yellow-400 font-semibold">Alertes Urgentes</h3>
              <p className="text-gray-400 text-sm">{alerts.total_alerts} action(s) requise(s)</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {alerts.pending_events > 0 && (
              <Link to="/admin/events?status=pending" className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                <Clock className="text-orange-400" size={20} />
                <div className="flex-1">
                  <p className="text-white font-medium">{alerts.pending_events} événement(s)</p>
                  <p className="text-gray-500 text-sm">En attente de validation</p>
                </div>
                <ChevronRight size={18} className="text-gray-500" />
              </Link>
            )}
            
            {alerts.pending_withdrawals > 0 && (
              <Link to="/admin/payouts" className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                <Wallet className="text-green-400" size={20} />
                <div className="flex-1">
                  <p className="text-white font-medium">{alerts.pending_withdrawals} retrait(s)</p>
                  <p className="text-gray-500 text-sm">{formatPrice(alerts.pending_withdrawals_amount)}</p>
                </div>
                <ChevronRight size={18} className="text-gray-500" />
              </Link>
            )}
            
            {alerts.pending_refunds > 0 && (
              <Link to="/admin/transactions" className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                <ArrowUpRight className="text-red-400" size={20} />
                <div className="flex-1">
                  <p className="text-white font-medium">{alerts.pending_refunds} remboursement(s)</p>
                  <p className="text-gray-500 text-sm">À traiter</p>
                </div>
                <ChevronRight size={18} className="text-gray-500" />
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Main Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {mainStats.map((stat, index) => (
          <div
            key={index}
            className="glass p-5 rounded-2xl relative overflow-hidden group hover:border-white/20 transition-all"
            data-testid={`admin-stat-${index}`}
          >
            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${stat.color} opacity-10 rounded-full -translate-y-1/2 translate-x-1/2 group-hover:opacity-20 transition-opacity`} />
            
            <div className="relative">
              <div className={`w-12 h-12 rounded-xl ${stat.iconBg} flex items-center justify-center mb-4`}>
                <stat.icon className={stat.iconColor} size={24} />
              </div>
              <p className="text-gray-400 text-sm mb-1">{stat.title}</p>
              <p className="font-mono font-bold text-2xl text-white">{stat.value}</p>
              <p className="text-gray-500 text-xs mt-1">{stat.subtitle}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          to="/admin/events"
          className="glass p-5 rounded-2xl flex items-center gap-4 hover:border-green-500/30 transition-all border border-white/10 group"
        >
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Calendar className="text-green-400" size={28} />
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold">Gestion des Événements</p>
            <p className="text-gray-400 text-sm">Approuver, bloquer, mettre à la une</p>
          </div>
          <ChevronRight className="text-gray-500 group-hover:text-green-400 transition-colors" />
        </Link>

        <Link
          to="/admin/users"
          className="glass p-5 rounded-2xl flex items-center gap-4 hover:border-cyan-500/30 transition-all border border-white/10 group"
        >
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Users className="text-cyan-400" size={28} />
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold">Gestion des Utilisateurs</p>
            <p className="text-gray-400 text-sm">Organisateurs & Acheteurs</p>
          </div>
          <ChevronRight className="text-gray-500 group-hover:text-cyan-400 transition-colors" />
        </Link>

        <Link
          to="/admin/settings"
          className="glass p-5 rounded-2xl flex items-center gap-4 hover:border-purple-500/30 transition-all border border-white/10 group"
        >
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Star className="text-purple-400" size={28} />
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold">Configuration</p>
            <p className="text-gray-400 text-sm">Commission, catégories, CGU</p>
          </div>
          <ChevronRight className="text-gray-500 group-hover:text-purple-400 transition-colors" />
        </Link>

        <Link
          to="/admin/transport"
          className="glass p-5 rounded-2xl flex items-center gap-4 hover:border-yellow-500/30 transition-all border border-white/10 group"
        >
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Train className="text-yellow-400" size={28} />
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold">Transport Train</p>
            <p className="text-gray-400 text-sm">Prix, horaires, trajets</p>
          </div>
          <ChevronRight className="text-gray-500 group-hover:text-yellow-400 transition-colors" />
        </Link>

        <Link
          to="/admin/transport"
          className="glass p-5 rounded-2xl flex items-center gap-4 hover:border-blue-500/30 transition-all border border-white/10 group"
        >
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Ship className="text-blue-400" size={28} />
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold">Transport Ferry</p>
            <p className="text-gray-400 text-sm">Destinations, tarifs</p>
          </div>
          <ChevronRight className="text-gray-500 group-hover:text-blue-400 transition-colors" />
        </Link>

        <Link
          to="/admin/scanner"
          className="glass p-5 rounded-2xl flex items-center gap-4 hover:border-pink-500/30 transition-all border border-white/10 group"
        >
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-pink-500/20 to-red-500/20 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Ticket className="text-pink-400" size={28} />
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold">Scanner de Billets</p>
            <p className="text-gray-400 text-sm">Validation des entrées</p>
          </div>
          <ChevronRight className="text-gray-500 group-hover:text-pink-400 transition-colors" />
        </Link>
      </div>

      {/* Revenue by Event */}
      <div className="glass p-6 rounded-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-unbounded font-semibold text-lg text-white">
            Top Événements par Revenus
          </h3>
          <Link to="/admin/events" className="text-green-400 text-sm hover:underline">
            Voir tous →
          </Link>
        </div>
        
        {stats.revenue_by_event && stats.revenue_by_event.length > 0 ? (
          <div className="space-y-3">
            {stats.revenue_by_event.slice(0, 5).map((item, index) => (
              <div key={index} className="flex items-center justify-between p-4 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-500/20 to-cyan-500/20 flex items-center justify-center text-white font-bold">
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-white font-medium">{item._id}</p>
                    <p className="text-sm text-gray-500">{item.count} billet(s) vendus</p>
                  </div>
                </div>
                <p className="font-mono font-bold text-green-400">{formatPrice(item.revenue)}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-gray-500">
            Aucune donnée disponible
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
