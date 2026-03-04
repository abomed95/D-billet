import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Activity, Users, Ticket, Clock, AlertTriangle, 
  RefreshCw, ArrowLeft, TrendingUp, User, Shield,
  CheckCircle, XCircle, Zap, BarChart3
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { useAuth } from '../../context/AuthContext';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const OrganizerLiveDashboard = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { getAuthHeaders } = useAuth();
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await axios.get(
        `${API}/organizer/events/${eventId}/live-dashboard`,
        { headers: getAuthHeaders() }
      );
      setData(response.data);
      setLastRefresh(new Date());
      setError(null);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
      setError(err.response?.data?.detail || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  }, [eventId, getAuthHeaders]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchDashboard, 5000); // Refresh every 5s
    return () => clearInterval(interval);
  }, [autoRefresh, fetchDashboard]);

  const formatTime = (isoString) => {
    return new Date(isoString).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <Activity className="text-green-500 mx-auto mb-4 animate-pulse" size={48} />
          <p className="text-gray-400">Chargement du tableau de bord...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4">
        <div className="text-center">
          <XCircle className="text-red-500 mx-auto mb-4" size={48} />
          <p className="text-red-400 mb-4">{error}</p>
          <Button onClick={() => navigate('/organizer')} variant="outline">
            <ArrowLeft size={18} className="mr-2" />
            Retour
          </Button>
        </div>
      </div>
    );
  }

  const maxHourlyEntries = Math.max(...data.hourly_entries.map(h => h.entries), 1);

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Header */}
      <div className="bg-gradient-to-r from-green-600 to-emerald-600 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/organizer')}
                className="text-white hover:bg-white/20"
              >
                <ArrowLeft size={20} />
              </Button>
              <div>
                <h1 className="font-unbounded font-bold text-xl text-white flex items-center gap-2">
                  <Activity className="animate-pulse" size={24} />
                  Dashboard Live
                </h1>
                <p className="text-white/70 text-sm">{data.event.title}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right text-white/70 text-xs hidden sm:block">
                <p>Dernière MAJ</p>
                <p className="text-white">{lastRefresh?.toLocaleTimeString('fr-FR')}</p>
              </div>
              <Button
                variant={autoRefresh ? "default" : "outline"}
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={autoRefresh ? "bg-white/20 text-white" : "text-white border-white/30"}
              >
                <RefreshCw size={16} className={autoRefresh ? "animate-spin" : ""} />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Main Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Entries */}
          <div className="glass p-5 rounded-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-transparent"></div>
            <div className="relative">
              <div className="flex items-center justify-between mb-2">
                <Users className="text-green-400" size={24} />
                <span className="text-green-400 text-xs font-medium animate-pulse">LIVE</span>
              </div>
              <p className="text-4xl font-bold text-white">{data.stats.entries}</p>
              <p className="text-gray-400 text-sm">Entrées</p>
            </div>
          </div>
          
          {/* Remaining */}
          <div className="glass p-5 rounded-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 to-transparent"></div>
            <div className="relative">
              <Ticket className="text-cyan-400 mb-2" size={24} />
              <p className="text-4xl font-bold text-white">{data.stats.remaining}</p>
              <p className="text-gray-400 text-sm">Restants</p>
            </div>
          </div>
          
          {/* Entry Rate */}
          <div className="glass p-5 rounded-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-transparent"></div>
            <div className="relative">
              <TrendingUp className="text-purple-400 mb-2" size={24} />
              <p className="text-4xl font-bold text-white">{data.stats.entry_rate_percent}%</p>
              <p className="text-gray-400 text-sm">Taux d'entrée</p>
            </div>
          </div>
          
          {/* Entry Speed */}
          <div className="glass p-5 rounded-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-transparent"></div>
            <div className="relative">
              <Zap className="text-orange-400 mb-2" size={24} />
              <p className="text-4xl font-bold text-white">{data.stats.entry_rate_per_min}</p>
              <p className="text-gray-400 text-sm">Entrées/min</p>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="glass p-5 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-gray-400">Progression des entrées</span>
            <span className="text-white font-medium">
              {data.stats.entries} / {data.stats.total_tickets}
            </span>
          </div>
          <Progress 
            value={data.stats.entry_rate_percent} 
            className="h-4 bg-white/10"
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Hourly Chart */}
          <div className="glass p-5 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="text-purple-400" size={20} />
              <h3 className="font-semibold text-white">Affluence par heure</h3>
            </div>
            <div className="flex items-end gap-2 h-40">
              {data.hourly_entries.map((hour, idx) => (
                <div key={idx} className="flex-1 flex flex-col items-center">
                  <div 
                    className="w-full bg-gradient-to-t from-purple-500 to-purple-400 rounded-t transition-all duration-500"
                    style={{ 
                      height: `${(hour.entries / maxHourlyEntries) * 100}%`,
                      minHeight: hour.entries > 0 ? '4px' : '0'
                    }}
                  ></div>
                  <p className="text-gray-500 text-[10px] mt-2 rotate-0">{hour.hour}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Ticket Type Breakdown */}
          <div className="glass p-5 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Ticket className="text-cyan-400" size={20} />
              <h3 className="font-semibold text-white">Par type de billet</h3>
            </div>
            <div className="space-y-4">
              {data.type_breakdown.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Aucun billet vendu</p>
              ) : (
                data.type_breakdown.map((type, idx) => (
                  <div key={idx}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-white font-medium">{type.type}</span>
                      <span className="text-gray-400">{type.scanned}/{type.total}</span>
                    </div>
                    <Progress 
                      value={(type.scanned / type.total) * 100}
                      className="h-2 bg-white/10"
                    />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Recent Entries */}
          <div className="glass p-5 rounded-2xl lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="text-green-400" size={20} />
              <h3 className="font-semibold text-white">Entrées récentes</h3>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data.recent_entries.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Aucune entrée pour le moment</p>
              ) : (
                data.recent_entries.map((entry, idx) => (
                  <div 
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-xl bg-white/5 ${
                      idx === 0 ? 'animate-pulse bg-green-500/10 border border-green-500/30' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <User className="text-gray-400" size={18} />
                      <div>
                        <p className="text-white text-sm">{entry.client_name || 'Client'}</p>
                        <p className="text-gray-500 text-xs">{entry.ticket_type || 'Standard'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-green-400 text-sm">{formatTime(entry.scanned_at)}</p>
                      <p className="text-gray-500 text-xs">{entry.staff_name}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Staff Performance */}
          <div className="glass p-5 rounded-2xl">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="text-orange-400" size={20} />
              <h3 className="font-semibold text-white">Performance Staff</h3>
            </div>
            <div className="space-y-3">
              {data.staff_performance.length === 0 ? (
                <p className="text-gray-500 text-center py-8">Aucun scan enregistré</p>
              ) : (
                data.staff_performance.map((staff, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-white/5"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        idx === 0 ? 'bg-yellow-500 text-black' :
                        idx === 1 ? 'bg-gray-400 text-black' :
                        idx === 2 ? 'bg-orange-600 text-black' :
                        'bg-white/10 text-white'
                      }`}>
                        {idx + 1}
                      </span>
                      <span className="text-white text-sm">{staff.staff_name}</span>
                    </div>
                    <span className="text-green-400 font-medium">{staff.scans}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Duplicate Alerts */}
        {data.duplicate_alerts.length > 0 && (
          <div className="glass p-5 rounded-2xl border border-orange-500/50">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="text-orange-400" size={20} />
              <h3 className="font-semibold text-orange-400">
                Alertes Doublons ({data.alert_count})
              </h3>
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {data.duplicate_alerts.map((alert, idx) => (
                <div 
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-orange-500/10 border border-orange-500/30"
                >
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="text-orange-400" size={18} />
                    <div>
                      <p className="text-white text-sm">{alert.client_name || 'Tentative'}</p>
                      <p className="text-orange-400 text-xs">{alert.message}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-orange-400 text-sm">{formatTime(alert.scanned_at)}</p>
                    <p className="text-gray-500 text-xs">Par: {alert.staff_name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Event Info */}
        <div className="glass p-4 rounded-xl text-center">
          <p className="text-gray-500 text-sm">
            {data.event.title} • {data.event.date} à {data.event.time} • {data.event.venue}
          </p>
        </div>
      </div>
    </div>
  );
};

export default OrganizerLiveDashboard;
