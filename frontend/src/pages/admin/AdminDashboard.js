import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { DollarSign, Ticket, Calendar, TrendingUp } from 'lucide-react';
import { Skeleton } from '../../components/ui/skeleton';
import { useAuth } from '../../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AdminDashboard = () => {
  const { getAuthHeaders } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/admin/stats`, {
        headers: getAuthHeaders()
      });
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-DJ').format(price) + ' DJF';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array(4).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    {
      title: 'Chiffre d\'Affaires',
      value: formatPrice(stats.total_revenue),
      icon: DollarSign,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
    },
    {
      title: 'Commission (8%)',
      value: formatPrice(stats.commission),
      icon: TrendingUp,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
    },
    {
      title: 'Billets Vendus',
      value: stats.total_tickets_sold,
      icon: Ticket,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/20',
    },
    {
      title: 'Événements',
      value: stats.total_events,
      icon: Calendar,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-unbounded font-bold text-2xl md:text-3xl text-white mb-2">
          Dashboard
        </h1>
        <p className="text-gray-400">Vue d'ensemble de votre activité</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <div
            key={index}
            className="glass p-6 rounded-xl"
            data-testid={`stat-card-${index}`}
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={stat.color} size={24} />
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-1">{stat.title}</p>
            <p className="font-mono font-bold text-2xl text-white">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue by Event */}
      <div className="glass p-6 rounded-xl">
        <h3 className="font-unbounded font-semibold text-lg text-white mb-6">
          Revenus par Événement
        </h3>
        {stats.revenue_by_event && stats.revenue_by_event.length > 0 ? (
          <div className="space-y-4">
            {stats.revenue_by_event.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-4 rounded-xl bg-white/5">
                <div>
                  <p className="text-white font-medium">{item._id}</p>
                  <p className="text-sm text-gray-400">{item.count} billet(s)</p>
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

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          to="/admin/events"
          className="glass p-6 rounded-xl flex items-center gap-4 hover:border-green-500/30 transition-all border border-white/10"
        >
          <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
            <Calendar className="text-green-400" size={24} />
          </div>
          <div>
            <p className="text-white font-semibold">Gérer les événements</p>
            <p className="text-gray-400 text-sm">Créer, modifier, supprimer</p>
          </div>
        </Link>
        <Link
          to="/admin/scanner"
          className="glass p-6 rounded-xl flex items-center gap-4 hover:border-cyan-500/30 transition-all border border-white/10"
        >
          <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
            <Ticket className="text-cyan-400" size={24} />
          </div>
          <div>
            <p className="text-white font-semibold">Scanner des billets</p>
            <p className="text-gray-400 text-sm">Valider les entrées</p>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default AdminDashboard;
