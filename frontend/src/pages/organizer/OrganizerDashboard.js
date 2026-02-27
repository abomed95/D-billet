import { useState, useEffect } from 'react';
import axios from 'axios';
import { DollarSign, Ticket, Calendar, TrendingUp, Wallet, Users } from 'lucide-react';
import { Skeleton } from '../../components/ui/skeleton';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const OrganizerDashboard = () => {
  const { getAuthHeaders } = useAuth();
  const [stats, setStats] = useState(null);
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chartPeriod, setChartPeriod] = useState(7);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchChartData();
  }, [chartPeriod]);

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

  const fetchChartData = async () => {
    try {
      const response = await axios.get(`${API}/organizer/sales-chart?days=${chartPeriod}`, {
        headers: getAuthHeaders()
      });
      setChartData(response.data);
    } catch (error) {
      console.error('Failed to fetch chart data:', error);
    }
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('fr-DJ').format(price) + ' DJF';
  };

  const formatShortPrice = (price) => {
    if (price >= 1000000) return (price / 1000000).toFixed(1) + 'M';
    if (price >= 1000) return (price / 1000).toFixed(0) + 'K';
    return price.toString();
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

  const ticketsRemaining = stats.total_tickets_available - stats.total_tickets_sold;

  const statCards = [
    {
      title: 'Billets Vendus',
      value: stats.total_tickets_sold,
      subtitle: `sur ${stats.total_tickets_available} disponibles`,
      icon: Ticket,
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/20',
    },
    {
      title: 'Chiffre d\'Affaires',
      value: formatPrice(stats.total_revenue),
      subtitle: 'Total généré',
      icon: DollarSign,
      color: 'text-green-400',
      bgColor: 'bg-green-500/20',
    },
    {
      title: 'Billets Restants',
      value: ticketsRemaining,
      subtitle: 'À vendre',
      icon: Calendar,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/20',
    },
    {
      title: 'Solde Net',
      value: formatPrice(stats.net_revenue),
      subtitle: 'Après commission 8%',
      icon: Wallet,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/20',
    },
  ];

  const maxRevenue = chartData ? Math.max(...chartData.data.map(d => d.revenue), 1) : 1;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-unbounded font-bold text-2xl md:text-3xl text-white mb-2">
          Tableau de Bord
        </h1>
        <p className="text-gray-400">Vue d'ensemble de vos ventes en temps réel</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, index) => (
          <div key={index} className="glass p-5 rounded-xl" data-testid={`stat-card-${index}`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-11 h-11 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={stat.color} size={22} />
              </div>
            </div>
            <p className="text-gray-400 text-sm mb-1">{stat.title}</p>
            <p className="font-mono font-bold text-xl text-white">{stat.value}</p>
            <p className="text-gray-500 text-xs mt-1">{stat.subtitle}</p>
          </div>
        ))}
      </div>

      {/* Sales Chart */}
      <div className="glass p-6 rounded-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-unbounded font-semibold text-lg text-white">
              Courbe des Ventes
            </h3>
            <p className="text-gray-500 text-sm">Évolution sur les {chartPeriod} derniers jours</p>
          </div>
          <div className="flex gap-2">
            <Button
              variant={chartPeriod === 7 ? "default" : "outline"}
              size="sm"
              onClick={() => setChartPeriod(7)}
              className={chartPeriod === 7 ? "bg-green-500 text-black" : ""}
            >
              7 jours
            </Button>
            <Button
              variant={chartPeriod === 30 ? "default" : "outline"}
              size="sm"
              onClick={() => setChartPeriod(30)}
              className={chartPeriod === 30 ? "bg-green-500 text-black" : ""}
            >
              30 jours
            </Button>
          </div>
        </div>

        {chartData && chartData.data.length > 0 ? (
          <div className="relative">
            {/* Chart Container */}
            <div className="h-[220px] border-b border-l border-white/10 pl-12 pb-8 relative">
              {/* Y-axis labels */}
              <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-xs text-gray-500">
                <span>{formatShortPrice(maxRevenue)}</span>
                <span>{formatShortPrice(maxRevenue / 2)}</span>
                <span>0</span>
              </div>

              {/* SVG Chart */}
              <svg 
                className="absolute left-12 top-0 right-0 bottom-8" 
                viewBox="0 0 800 180"
                preserveAspectRatio="none"
              >
                {/* Gradient definitions */}
                <defs>
                  <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#00FF94" />
                    <stop offset="100%" stopColor="#22D3EE" />
                  </linearGradient>
                  <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#00FF94" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="#00FF94" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {/* Area fill */}
                <path
                  d={`M 0 180 ${chartData.data.map((d, i) => {
                    const x = chartData.data.length === 1 ? 400 : (i / (chartData.data.length - 1)) * 800;
                    const y = 180 - (d.revenue / maxRevenue) * 160;
                    return `L ${x} ${y}`;
                  }).join(' ')} L 800 180 Z`}
                  fill="url(#areaGradient)"
                />

                {/* Line */}
                <path
                  d={chartData.data.map((d, i) => {
                    const x = chartData.data.length === 1 ? 400 : (i / (chartData.data.length - 1)) * 800;
                    const y = 180 - (d.revenue / maxRevenue) * 160;
                    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
                  }).join(' ')}
                  fill="none"
                  stroke="url(#lineGradient)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />

                {/* Data points */}
                {chartData.data.map((d, i) => {
                  const x = chartData.data.length === 1 ? 400 : (i / (chartData.data.length - 1)) * 800;
                  const y = 180 - (d.revenue / maxRevenue) * 160;
                  return (
                    <g key={i}>
                      <circle
                        cx={x}
                        cy={y}
                        r="6"
                        fill="#0A0A0F"
                        stroke="#00FF94"
                        strokeWidth="2"
                        vectorEffect="non-scaling-stroke"
                      />
                      <title>{`${d.date}: ${formatPrice(d.revenue)} (${d.tickets} billets)`}</title>
                    </g>
                  );
                })}
              </svg>

              {/* X-axis labels */}
              <div className="absolute bottom-0 left-12 right-0 flex justify-between text-xs text-gray-500 transform translate-y-6">
                {chartData.data.filter((_, i) => {
                  const step = chartPeriod === 7 ? 1 : Math.ceil(chartData.data.length / 6);
                  return i % step === 0 || i === chartData.data.length - 1;
                }).map((d, i) => (
                  <span key={i}>{d.date.slice(5)}</span>
                ))}
              </div>
            </div>

            {/* Chart Legend */}
            <div className="flex items-center justify-center gap-6 mt-8 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
                <span className="text-gray-400">Revenus</span>
              </div>
              <div className="flex items-center gap-2">
                <Users size={14} className="text-cyan-400" />
                <span className="text-gray-400">
                  {chartData.data.reduce((sum, d) => sum + d.tickets, 0)} billets cette période
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-[200px] flex items-center justify-center text-gray-500">
            Aucune donnée de ventes pour cette période
          </div>
        )}
      </div>

      {/* Events Progress */}
      <div className="glass p-6 rounded-xl">
        <h3 className="font-unbounded font-semibold text-lg text-white mb-6">
          Progression des Ventes par Événement
        </h3>
        <div className="space-y-4">
          {stats.events?.length > 0 ? (
            stats.events.map((event) => (
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
                    className="bg-gradient-to-r from-green-500 to-cyan-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${event.percentage}%` }}
                  />
                </div>
                <p className="text-right text-xs text-gray-500 mt-1">{event.percentage}%</p>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-500">
              Aucun événement. Créez votre premier événement!
            </div>
          )}
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
