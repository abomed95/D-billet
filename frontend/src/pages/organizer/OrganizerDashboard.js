import { useState, useEffect } from 'react';
import axios from 'axios';
import { DollarSign, Ticket, Calendar, TrendingUp, Users } from 'lucide-react';
import { Skeleton } from '../../components/ui/skeleton';
import { useAuth } from '../../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const OrganizerDashboard = () => {
  const { getAuthHeaders } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/organizer/stats`, {
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
      </div>
    );
  }

  if (!stats) return null;

  const statCards = [
    {
      title: 'Ventes Totales',
      value: formatPrice(stats.total_revenue),
      icon: DollarSign,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
    },
    {
      title: 'Commission D-Billet (8%)',
      value: formatPrice(stats.commission),
      icon: TrendingUp,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
    },
    {
      title: 'Billets Vendus',
      value: `${stats.total_tickets_sold} / ${stats.total_tickets_available}`,
      icon: Ticket,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/20',
    },
    {
      title: 'Mes Événements',
      value: stats.events_count,
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
          Tableau de Bord
        </h1>
        <p className="text-gray-400">Vos statistiques en temps réel</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <div key={index} className="glass p-6 rounded-xl">
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

      {/* Events Progress */}
      <div className="glass p-6 rounded-xl">
        <h3 className="font-unbounded font-semibold text-lg text-white mb-6">
          Progression des Ventes par Événement
        </h3>
        <div className="space-y-4">
          {stats.events?.map((event) => (
            <div key={event.id} className="p-4 rounded-xl bg-white/5">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-white font-medium">{event.title}</p>
                  <p className="text-gray-500 text-sm">{event.date}</p>
                </div>
                <div className="text-right">
                  <p className="font-mono font-bold text-green-400">{formatPrice(event.revenue)}</p>
                  <p className="text-gray-500 text-sm">{event.sold} / {event.total} vendus</p>
                </div>
              </div>
              <div className="w-full bg-white/10 rounded-full h-3">
                <div 
                  className="bg-green-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${event.percentage}%` }}
                />
              </div>
              <p className="text-right text-xs text-gray-500 mt-1">{event.percentage}%</p>
            </div>
          ))}
        </div>
      </div>

      {/* Promo Codes Stats */}
      {stats.promo_codes?.length > 0 && (
        <div className="glass p-6 rounded-xl">
          <h3 className="font-unbounded font-semibold text-lg text-white mb-6">
            Performance des Codes Promo
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-gray-500 text-sm">
                  <th className="pb-3">Code</th>
                  <th className="pb-3">Utilisations</th>
                  <th className="pb-3">Ventes Générées</th>
                </tr>
              </thead>
              <tbody className="text-white">
                {stats.promo_codes.map((promo, index) => (
                  <tr key={index} className="border-t border-white/10">
                    <td className="py-3 font-mono text-green-400">{promo.code}</td>
                    <td className="py-3">{promo.uses} / {promo.max_uses}</td>
                    <td className="py-3 font-mono">{formatPrice(promo.total_sales)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizerDashboard;
