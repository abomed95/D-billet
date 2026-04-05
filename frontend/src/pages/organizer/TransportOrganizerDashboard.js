import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import axios from 'axios';
import { 
  Ship, Train, DollarSign, Users, Car, TrendingUp, 
  Calendar, Settings, FileText, Save, RefreshCw,
  ChevronRight, AlertCircle, CheckCircle
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TransportOrganizerDashboard = () => {
  const { user, token } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [vehiclePrices, setVehiclePrices] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Settings form
  const [passengerPrice, setPassengerPrice] = useState(1100);
  const [childFreeAge, setChildFreeAge] = useState(10);
  const [maxPassengers, setMaxPassengers] = useState(150);
  const [maxVehicles, setMaxVehicles] = useState(20);

  const isFerryOrganizer = user?.role === 'ferry_organizer' || user?.role === 'admin';
  const isTrainOrganizer = user?.role === 'train_organizer' || user?.role === 'admin';
  const transportType = user?.role === 'train_organizer' ? 'train' : 'ferry';

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const endpoint = transportType === 'train' 
        ? `${API}/transport-organizer/train/dashboard`
        : `${API}/transport-organizer/ferry/dashboard`;
      
      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setDashboardData(response.data);
      
      if (transportType === 'ferry') {
        setPassengerPrice(response.data.settings.passenger_price || 1100);
        setChildFreeAge(response.data.settings.child_free_age || 10);
        setMaxPassengers(response.data.settings.max_passengers_per_trip || 150);
        setMaxVehicles(response.data.settings.max_vehicles_per_trip || 20);
        setVehiclePrices(response.data.settings.vehicle_types || []);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
      toast.error('Erreur lors du chargement du dashboard');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    try {
      await axios.put(
        `${API}/transport-organizer/ferry/settings`,
        {
          passenger_price: passengerPrice,
          child_free_age: childFreeAge,
          max_passengers_per_trip: maxPassengers,
          max_vehicles_per_trip: maxVehicles
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Parametres sauvegardes');
      fetchDashboard();
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const saveVehiclePrices = async () => {
    setSaving(true);
    try {
      const prices = vehiclePrices.map(vt => ({
        vehicle_type: vt.type,
        price: vt.price
      }));
      
      await axios.put(
        `${API}/transport-organizer/ferry/vehicle-prices`,
        prices,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      toast.success('Prix des vehicules mis a jour');
      fetchDashboard();
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde des prix');
    } finally {
      setSaving(false);
    }
  };

  const updateVehiclePrice = (index, newPrice) => {
    const updated = [...vehiclePrices];
    updated[index].price = parseInt(newPrice) || 0;
    setVehiclePrices(updated);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-2 border-ferry border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400">Chargement du dashboard...</p>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center text-gray-400">
          <AlertCircle size={48} className="mx-auto mb-4" />
          <p>Impossible de charger le dashboard</p>
          <Button onClick={fetchDashboard} className="mt-4">
            <RefreshCw size={16} className="mr-2" /> Reessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-unbounded text-2xl text-white flex items-center gap-3">
              {transportType === 'ferry' ? (
                <Ship className="text-ferry" size={28} />
              ) : (
                <Train className="text-blue-400" size={28} />
              )}
              Dashboard {transportType === 'ferry' ? 'Ferry' : 'Train'}
            </h1>
            <p className="text-gray-400 mt-1">
              Bienvenue, {dashboardData.organizer.name}
            </p>
          </div>
          <Button 
            onClick={fetchDashboard} 
            variant="outline" 
            className="border-white/20 text-white"
          >
            <RefreshCw size={16} className="mr-2" /> Actualiser
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="glass p-5 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-sm">Aujourd'hui</span>
              <Users className="text-ferry" size={20} />
            </div>
            <p className="text-3xl font-bold text-white">
              {transportType === 'ferry' 
                ? dashboardData.stats.today.passengers 
                : dashboardData.stats.today}
            </p>
            <p className="text-gray-500 text-sm">passagers</p>
            {transportType === 'ferry' && (
              <p className="text-ferry text-sm mt-1">
                + {dashboardData.stats.today.vehicles} vehicules
              </p>
            )}
          </div>

          <div className="glass p-5 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-sm">Cette semaine</span>
              <Calendar className="text-green-400" size={20} />
            </div>
            <p className="text-3xl font-bold text-white">
              {transportType === 'ferry' 
                ? dashboardData.stats.this_week.passengers 
                : dashboardData.stats.this_week}
            </p>
            <p className="text-gray-500 text-sm">passagers</p>
          </div>

          <div className="glass p-5 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-sm">Revenu Total</span>
              <DollarSign className="text-gold" size={20} />
            </div>
            <p className="text-3xl font-bold text-gold">
              {dashboardData.revenue.total.toLocaleString()}
            </p>
            <p className="text-gray-500 text-sm">FDJ</p>
          </div>

          <div className="glass p-5 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-sm">Revenu Net</span>
              <TrendingUp className="text-green-400" size={20} />
            </div>
            <p className="text-3xl font-bold text-green-400">
              {dashboardData.revenue.net_revenue.toLocaleString()}
            </p>
            <p className="text-gray-500 text-sm">
              FDJ (apres {dashboardData.revenue.commission_rate}% commission)
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { id: 'overview', label: 'Apercu', icon: Calendar },
            { id: 'settings', label: 'Tarification', icon: Settings },
            ...(transportType === 'ferry' ? [{ id: 'vehicles', label: 'Prix Vehicules', icon: Car }] : []),
            { id: 'bookings', label: 'Reservations', icon: FileText },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap
                ${activeTab === tab.id 
                  ? 'bg-ferry text-black' 
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="glass p-6 rounded-xl">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">
                Voyages a venir (7 prochains jours)
              </h2>
              <div className="space-y-3">
                {dashboardData.upcoming_trips.map((trip, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-colors"
                  >
                    <div>
                      <p className="text-white font-medium">{trip.day_name}</p>
                      <p className="text-gray-400 text-sm">{trip.date}</p>
                      {trip.direction && (
                        <p className="text-blue-400 text-sm">{trip.direction}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold">{trip.passengers_booked}</p>
                      <p className="text-gray-500 text-sm">passagers</p>
                      {trip.vehicles_booked !== undefined && (
                        <p className="text-ferry text-sm">{trip.vehicles_booked} vehicules</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settings Tab */}
          {activeTab === 'settings' && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">
                Parametres de tarification
              </h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-gray-300 mb-2 block">Prix passager (FDJ)</Label>
                  <Input
                    type="number"
                    value={passengerPrice}
                    onChange={(e) => setPassengerPrice(parseInt(e.target.value) || 0)}
                    className="bg-white/5 border-white/10 text-white"
                  />
                </div>
                
                {transportType === 'ferry' && (
                  <>
                    <div>
                      <Label className="text-gray-300 mb-2 block">Age gratuit (enfants)</Label>
                      <Input
                        type="number"
                        value={childFreeAge}
                        onChange={(e) => setChildFreeAge(parseInt(e.target.value) || 0)}
                        className="bg-white/5 border-white/10 text-white"
                      />
                      <p className="text-gray-500 text-xs mt-1">Enfants de moins de {childFreeAge} ans voyagent gratuitement</p>
                    </div>
                    
                    <div>
                      <Label className="text-gray-300 mb-2 block">Capacite max passagers</Label>
                      <Input
                        type="number"
                        value={maxPassengers}
                        onChange={(e) => setMaxPassengers(parseInt(e.target.value) || 0)}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-gray-300 mb-2 block">Capacite max vehicules</Label>
                      <Input
                        type="number"
                        value={maxVehicles}
                        onChange={(e) => setMaxVehicles(parseInt(e.target.value) || 0)}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                  </>
                )}
              </div>
              
              <Button 
                onClick={saveSettings}
                disabled={saving}
                className="mt-6 bg-ferry hover:bg-ferry/90 text-black"
              >
                {saving ? (
                  <RefreshCw size={16} className="mr-2 animate-spin" />
                ) : (
                  <Save size={16} className="mr-2" />
                )}
                Sauvegarder
              </Button>
            </div>
          )}

          {/* Vehicle Prices Tab (Ferry only) */}
          {activeTab === 'vehicles' && transportType === 'ferry' && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">
                Prix des vehicules
              </h2>
              
              <div className="space-y-4">
                {vehiclePrices.map((vehicle, index) => (
                  <div 
                    key={vehicle.type}
                    className="flex items-center justify-between p-4 bg-white/5 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <Car className="text-ferry" size={20} />
                      <span className="text-white">{vehicle.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={vehicle.price}
                        onChange={(e) => updateVehiclePrice(index, e.target.value)}
                        className="w-32 bg-white/5 border-white/10 text-white text-right"
                      />
                      <span className="text-gray-400">FDJ</span>
                    </div>
                  </div>
                ))}
              </div>
              
              <Button 
                onClick={saveVehiclePrices}
                disabled={saving}
                className="mt-6 bg-ferry hover:bg-ferry/90 text-black"
              >
                {saving ? (
                  <RefreshCw size={16} className="mr-2 animate-spin" />
                ) : (
                  <Save size={16} className="mr-2" />
                )}
                Sauvegarder les prix
              </Button>
            </div>
          )}

          {/* Bookings Tab */}
          {activeTab === 'bookings' && (
            <div>
              <h2 className="text-xl font-semibold text-white mb-4">
                Reservations recentes
              </h2>
              <p className="text-gray-400">
                Fonctionnalite en cours de developpement...
              </p>
            </div>
          )}
        </div>

        {/* Revenue Breakdown */}
        {transportType === 'ferry' && dashboardData.revenue.vehicle_revenue > 0 && (
          <div className="mt-6 glass p-6 rounded-xl">
            <h3 className="text-lg font-semibold text-white mb-4">Repartition des revenus</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-gray-400 text-sm">Passagers</p>
                <p className="text-2xl font-bold text-white">
                  {dashboardData.revenue.passenger_revenue.toLocaleString()} FDJ
                </p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-gray-400 text-sm">Vehicules</p>
                <p className="text-2xl font-bold text-ferry">
                  {dashboardData.revenue.vehicle_revenue.toLocaleString()} FDJ
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TransportOrganizerDashboard;
