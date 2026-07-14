import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Ship,
  Train,
  DollarSign,
  Users,
  Car,
  TrendingUp,
  Calendar,
  Settings,
  FileText,
  Save,
  RefreshCw,
  AlertCircle,
  Megaphone,
  Building2,
  Shield,
  Trash2,
  TicketPercent,
  Copy,
  CheckCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Switch } from '../../components/ui/switch';
import { toast } from 'sonner';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const EMPTY_ANNOUNCEMENT = {
  title: '',
  message: '',
  announcement_type: 'cancellation',
  travel_date: '',
  destination: '',
  active: true,
};

const EMPTY_AGENCY = {
  name: '',
  contact_name: '',
  phone: '',
  email: '',
  target_bookings: 0,
  notes: '',
  active: true,
};

const EMPTY_STAFF = {
  username: '',
  full_name: '',
  role: 'transport_agent',
  agency_id: '',
  phone: '',
  email: '',
  active: true,
};

const EMPTY_PROMO = {
  code: '',
  title: '',
  discount_type: 'percentage',
  discount_value: 10,
  max_uses: 100,
  valid_until: '',
  agency_id: '',
  staff_id: '',
  active: true,
};

const formatMoney = (value) => `${new Intl.NumberFormat('fr-DJ').format(Number(value || 0))} DJF`;

const formatDate = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const TransportOrganizerDashboard = () => {
  const { user, token } = useAuth();
  const isAdmin = user?.role === 'admin';
  const defaultTransport = user?.role === 'train_organizer' ? 'train' : 'ferry';

  const [transportType, setTransportType] = useState(defaultTransport);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [dashboardData, setDashboardData] = useState(null);
  const [bookingsData, setBookingsData] = useState(null);
  const [announcements, setAnnouncements] = useState([]);
  const [agencies, setAgencies] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [performance, setPerformance] = useState({ agencies: [], staff: [], totals: {} });
  const [promoCodes, setPromoCodes] = useState([]);
  const [credentialsNotice, setCredentialsNotice] = useState(null);

  const [passengerPrice, setPassengerPrice] = useState(1100);
  const [childFreeAge, setChildFreeAge] = useState(10);
  const [maxPassengers, setMaxPassengers] = useState(150);
  const [maxVehicles, setMaxVehicles] = useState(20);
  const [vehiclePrices, setVehiclePrices] = useState([]);

  const [trainPrice, setTrainPrice] = useState(500);
  const [trainDepartureTime, setTrainDepartureTime] = useState('06:00');
  const [trainActive, setTrainActive] = useState(true);

  const [announcementForm, setAnnouncementForm] = useState(EMPTY_ANNOUNCEMENT);
  const [agencyForm, setAgencyForm] = useState(EMPTY_AGENCY);
  const [staffForm, setStaffForm] = useState(EMPTY_STAFF);
  const [promoForm, setPromoForm] = useState(EMPTY_PROMO);

  const getAuthConfig = useCallback(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  useEffect(() => {
    if (user?.role === 'train_organizer') {
      setTransportType('train');
    } else if (user?.role === 'ferry_organizer') {
      setTransportType('ferry');
    }
  }, [user?.role]);

  useEffect(() => {
    setAnnouncementForm((current) => ({
      ...current,
      destination: transportType === 'train' ? '' : current.destination,
    }));
    setPromoForm((current) => ({
      ...EMPTY_PROMO,
      code: current.code || `${transportType.toUpperCase()}10`,
    }));
    setStaffForm(EMPTY_STAFF);
    setAgencyForm(EMPTY_AGENCY);
    setCredentialsNotice(null);
  }, [transportType]);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const dashboardEndpoint =
        transportType === 'train'
          ? `${API}/transport-organizer/train/dashboard`
          : `${API}/transport-organizer/ferry/dashboard`;
      const bookingsEndpoint =
        transportType === 'train'
          ? `${API}/transport-organizer/train/bookings?limit=100`
          : `${API}/transport-organizer/ferry/bookings?limit=100`;

      const [
        dashboardRes,
        bookingsRes,
        announcementsRes,
        agenciesRes,
        staffRes,
        performanceRes,
        promoRes,
      ] = await Promise.all([
        axios.get(dashboardEndpoint, getAuthConfig()),
        axios.get(bookingsEndpoint, getAuthConfig()),
        axios.get(`${API}/transport-organizer/${transportType}/announcements`, getAuthConfig()),
        axios.get(`${API}/transport-organizer/${transportType}/agencies`, getAuthConfig()),
        axios.get(`${API}/transport-organizer/${transportType}/staff`, getAuthConfig()),
        axios.get(`${API}/transport-organizer/${transportType}/performance`, getAuthConfig()),
        axios.get(`${API}/transport-organizer/${transportType}/promo-codes`, getAuthConfig()),
      ]);

      const dashboard = dashboardRes.data;
      setDashboardData(dashboard);
      setBookingsData(bookingsRes.data);
      setAnnouncements(announcementsRes.data);
      setAgencies(agenciesRes.data);
      setStaffList(staffRes.data);
      setPerformance(performanceRes.data);
      setPromoCodes(promoRes.data);

      if (transportType === 'ferry') {
        setPassengerPrice(dashboard.settings.passenger_price || 1100);
        setChildFreeAge(dashboard.settings.child_free_age || 10);
        setMaxPassengers(dashboard.settings.max_passengers_per_trip || 150);
        setMaxVehicles(dashboard.settings.max_vehicles_per_trip || 20);
        setVehiclePrices(dashboard.settings.vehicle_types || []);
      } else {
        setTrainPrice(dashboard.settings.ticket_price || 500);
        setTrainDepartureTime(dashboard.settings.departure_time || '06:00');
        setTrainActive(Boolean(dashboard.settings.active ?? true));
      }
    } catch (error) {
      console.error('Failed to fetch transport dashboard:', error);
      toast.error('Erreur lors du chargement du dashboard transport');
    } finally {
      setLoading(false);
    }
  }, [getAuthConfig, transportType]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const withSave = async (callback, successMessage) => {
    setSaving(true);
    try {
      await callback();
      if (successMessage) {
        toast.success(successMessage);
      }
      await fetchDashboard();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.detail || 'Une erreur est survenue');
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    if (transportType === 'ferry') {
      await withSave(
        () =>
          axios.put(
            `${API}/transport-organizer/ferry/settings`,
            {
              passenger_price: passengerPrice,
              child_free_age: childFreeAge,
              max_passengers_per_trip: maxPassengers,
              max_vehicles_per_trip: maxVehicles,
            },
            getAuthConfig()
          ),
        'Parametres ferry sauvegardes'
      );
      return;
    }

    await withSave(
      () =>
        axios.put(
          `${API}/transport-organizer/train/settings`,
            {
              price: trainPrice,
              departure_time: trainDepartureTime,
              active: trainActive,
            },
            getAuthConfig()
        ),
      'Parametres train sauvegardes'
    );
  };

  const saveVehiclePrices = async () => {
    await withSave(
      () =>
        axios.put(
          `${API}/transport-organizer/ferry/vehicle-prices`,
          vehiclePrices.map((vehicle) => ({
            vehicle_type: vehicle.type,
            price: Number(vehicle.price || 0),
          })),
          getAuthConfig()
        ),
      'Prix des vehicules mis a jour'
    );
  };

  const updateVehiclePrice = (index, nextPrice) => {
    const updated = [...vehiclePrices];
    updated[index] = { ...updated[index], price: Number(nextPrice || 0) };
    setVehiclePrices(updated);
  };

  const createAnnouncement = async () => {
    if (!announcementForm.title || !announcementForm.message) {
      toast.error('Titre et message obligatoires');
      return;
    }

    await withSave(
      () =>
        axios.post(
          `${API}/transport-organizer/${transportType}/announcements`,
          {
            ...announcementForm,
            travel_date: announcementForm.travel_date || null,
            destination:
              transportType === 'ferry' && announcementForm.destination
                ? announcementForm.destination
                : null,
          },
          getAuthConfig()
        ),
      'Annonce publiee'
    );
    setAnnouncementForm(EMPTY_ANNOUNCEMENT);
  };

  const toggleAnnouncement = async (announcement) => {
    await withSave(
      () =>
        axios.put(
          `${API}/transport-organizer/${transportType}/announcements/${announcement.id}`,
          { active: !announcement.active },
          getAuthConfig()
        ),
      announcement.active ? 'Annonce desactivee' : 'Annonce reactivee'
    );
  };

  const deleteAnnouncement = async (announcementId) => {
    if (!window.confirm('Supprimer cette annonce ?')) return;
    await withSave(
      () =>
        axios.delete(`${API}/transport-organizer/${transportType}/announcements/${announcementId}`, getAuthConfig()),
      'Annonce supprimee'
    );
  };

  const createAgency = async () => {
    if (!agencyForm.name) {
      toast.error('Le nom de l agence est obligatoire');
      return;
    }

    await withSave(
      () =>
        axios.post(
          `${API}/transport-organizer/${transportType}/agencies`,
          {
            ...agencyForm,
            target_bookings: Number(agencyForm.target_bookings || 0),
          },
          getAuthConfig()
        ),
      'Agence creee'
    );
    setAgencyForm(EMPTY_AGENCY);
  };

  const toggleAgency = async (agency) => {
    await withSave(
      () =>
        axios.put(
          `${API}/transport-organizer/${transportType}/agencies/${agency.id}`,
          { active: !agency.active },
          getAuthConfig()
        ),
      agency.active ? 'Agence desactivee' : 'Agence reactivee'
    );
  };

  const deleteAgency = async (agencyId) => {
    if (!window.confirm('Supprimer cette agence ?')) return;
    await withSave(
      () =>
        axios.delete(`${API}/transport-organizer/${transportType}/agencies/${agencyId}`, getAuthConfig()),
      'Agence supprimee'
    );
  };

  const createStaff = async () => {
    if (!staffForm.username || !staffForm.full_name) {
      toast.error('Nom complet et identifiant obligatoires');
      return;
    }

    await withSave(
      async () => {
        const response = await axios.post(
          `${API}/transport-organizer/${transportType}/staff`,
          {
            ...staffForm,
            agency_id: staffForm.agency_id || null,
          },
          getAuthConfig()
        );
        setCredentialsNotice({
          username: response.data.username,
          password: response.data.password,
          label: 'Identifiants du nouveau compte staff',
        });
      },
      'Compte staff cree'
    );
    setStaffForm(EMPTY_STAFF);
  };

  const toggleStaff = async (staff) => {
    await withSave(
      () =>
        axios.put(
          `${API}/transport-organizer/${transportType}/staff/${staff.id}`,
          { active: !staff.active },
          getAuthConfig()
        ),
      staff.active ? 'Compte staff desactive' : 'Compte staff reactive'
    );
  };

  const resetStaffPassword = async (staffId) => {
    await withSave(
      async () => {
        const response = await axios.post(
          `${API}/transport-organizer/${transportType}/staff/${staffId}/reset-password`,
          {},
          getAuthConfig()
        );
        setCredentialsNotice({
          username: response.data.username,
          password: response.data.new_password,
          label: 'Mot de passe staff reinitialise',
        });
      },
      'Mot de passe reinitialise'
    );
  };

  const deleteStaff = async (staffId) => {
    if (!window.confirm('Supprimer ce compte staff ?')) return;
    await withSave(
      () =>
        axios.delete(`${API}/transport-organizer/${transportType}/staff/${staffId}`, getAuthConfig()),
      'Compte staff supprime'
    );
  };

  const createPromoCode = async () => {
    if (!promoForm.code || !promoForm.discount_value) {
      toast.error('Code et reduction obligatoires');
      return;
    }

    await withSave(
      () =>
        axios.post(
          `${API}/transport-organizer/${transportType}/promo-codes`,
          {
            ...promoForm,
            agency_id: promoForm.agency_id || null,
            staff_id: promoForm.staff_id || null,
            max_uses: Number(promoForm.max_uses || 1),
            discount_value: Number(promoForm.discount_value || 0),
            valid_until: promoForm.valid_until || null,
          },
          getAuthConfig()
        ),
      'Code promo cree'
    );
    setPromoForm(EMPTY_PROMO);
  };

  const togglePromoCode = async (promo) => {
    await withSave(
      () =>
        axios.put(
          `${API}/transport-organizer/${transportType}/promo-codes/${promo.id}`,
          { active: !promo.active },
          getAuthConfig()
        ),
      promo.active ? 'Code promo desactive' : 'Code promo reactive'
    );
  };

  const deletePromoCode = async (promoId) => {
    if (!window.confirm('Supprimer ce code promo ?')) return;
    await withSave(
      () =>
        axios.delete(`${API}/transport-organizer/${transportType}/promo-codes/${promoId}`, getAuthConfig()),
      'Code promo supprime'
    );
  };

  const copyText = async (value) => {
    await navigator.clipboard.writeText(value);
    toast.success('Copie dans le presse-papiers');
  };

  const combinedBookings =
    transportType === 'ferry'
      ? [
          ...(bookingsData?.passengers || []).map((booking) => ({
            id: booking.id,
            kind: 'passenger',
            title: booking.passenger_name,
            subtitle: `${booking.destination || '-'} • ${booking.trip_type || '-'}`,
            date: booking.event_date,
            amount: booking.price,
            status: booking.status,
            created_at: booking.created_at,
            promo_code: booking.promo_code,
          })),
          ...(bookingsData?.vehicles || []).map((booking) => ({
            id: booking.id,
            kind: 'vehicle',
            title: booking.vehicle_name || booking.vehicle_type,
            subtitle: `${booking.destination || '-'} • ${booking.plate_number || '-'}`,
            date: booking.date,
            amount: booking.price,
            status: booking.status,
            created_at: booking.created_at,
            promo_code: booking.promo_code,
          })),
        ].sort((left, right) => new Date(right.created_at || 0) - new Date(left.created_at || 0))
      : (bookingsData?.bookings || []).map((booking) => ({
          id: booking.id,
          kind: 'passenger',
          title: booking.passenger_name,
          subtitle: `${booking.event_title || '-'} • ${booking.event_time || '-'}`,
          date: booking.event_date,
          amount: booking.price,
          status: booking.status,
          created_at: booking.created_at,
          promo_code: booking.promo_code,
        }));

  const tabs = [
    { id: 'overview', label: 'Apercu', icon: Calendar },
    { id: 'settings', label: 'Tarification', icon: Settings },
    { id: 'bookings', label: 'Reservations', icon: FileText },
    { id: 'announcements', label: 'Annonces', icon: Megaphone },
    { id: 'agencies', label: 'Agences & Staff', icon: Building2 },
    { id: 'promo', label: 'Codes promo', icon: TicketPercent },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-2 border-ferry border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-400">Chargement du dashboard transport...</p>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center text-gray-400">
          <AlertCircle size={48} className="mx-auto mb-4" />
          <p>Impossible de charger le dashboard transport</p>
          <Button onClick={fetchDashboard} className="mt-4">
            <RefreshCw size={16} className="mr-2" /> Reessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
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

          <div className="flex flex-wrap items-center gap-3">
            {isAdmin && (
              <div className="flex bg-white/5 rounded-xl p-1">
                <button
                  onClick={() => setTransportType('ferry')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    transportType === 'ferry' ? 'bg-ferry text-black' : 'text-gray-400'
                  }`}
                >
                  Ferry
                </button>
                <button
                  onClick={() => setTransportType('train')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    transportType === 'train' ? 'bg-blue-400 text-black' : 'text-gray-400'
                  }`}
                >
                  Train
                </button>
              </div>
            )}
            <Button onClick={fetchDashboard} variant="outline" className="border-white/20 text-white">
              <RefreshCw size={16} className="mr-2" /> Actualiser
            </Button>
          </div>
        </div>

        {credentialsNotice && (
          <div className="glass p-4 rounded-xl border border-green-500/30 bg-green-500/10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <p className="text-green-400 font-semibold flex items-center gap-2">
                  <CheckCircle size={18} /> {credentialsNotice.label}
                </p>
                <p className="text-gray-300 text-sm mt-1">
                  Username: <span className="text-white font-mono">{credentialsNotice.username}</span> | Password:{' '}
                  <span className="text-white font-mono">{credentialsNotice.password}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="border-white/20 text-white"
                  onClick={() => copyText(credentialsNotice.username)}
                >
                  <Copy size={16} className="mr-2" /> Copier username
                </Button>
                <Button
                  variant="outline"
                  className="border-white/20 text-white"
                  onClick={() => copyText(credentialsNotice.password)}
                >
                  <Copy size={16} className="mr-2" /> Copier password
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <div className="glass p-5 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-sm">Aujourd hui</span>
              <Users className="text-ferry" size={20} />
            </div>
            <p className="text-3xl font-bold text-white">
              {transportType === 'ferry' ? dashboardData.stats.today.passengers : dashboardData.stats.today}
            </p>
            <p className="text-gray-500 text-sm">passagers</p>
            {transportType === 'ferry' && (
              <p className="text-ferry text-sm mt-1">+ {dashboardData.stats.today.vehicles} vehicules</p>
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
              <span className="text-gray-400 text-sm">Revenu total</span>
              <DollarSign className="text-gold" size={20} />
            </div>
            <p className="text-3xl font-bold text-gold">{dashboardData.revenue.total.toLocaleString()}</p>
            <p className="text-gray-500 text-sm">FDJ</p>
          </div>

          <div className="glass p-5 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-sm">Revenu net</span>
              <TrendingUp className="text-green-400" size={20} />
            </div>
            <p className="text-3xl font-bold text-green-400">
              {dashboardData.revenue.net_revenue.toLocaleString()}
            </p>
            <p className="text-gray-500 text-sm">
              FDJ apres {dashboardData.revenue.commission_rate}% commission
            </p>
          </div>

          <div className="glass p-5 rounded-xl">
            <div className="flex items-center justify-between mb-3">
              <span className="text-gray-400 text-sm">Codes promo</span>
              <TicketPercent className="text-cyan-400" size={20} />
            </div>
            <p className="text-3xl font-bold text-cyan-400">
              {dashboardData.operations?.promo_codes?.uses || 0}
            </p>
            <p className="text-gray-500 text-sm">
              {dashboardData.operations?.promo_codes?.active || 0} codes actifs
            </p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id ? 'bg-ferry text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'
              }`}
            >
              <tab.icon size={18} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="glass p-6 rounded-xl">
          {activeTab === 'overview' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">Voyages a venir</h2>
                <div className="space-y-3">
                  {dashboardData.upcoming_trips.map((trip) => (
                    <div
                      key={`${trip.date}-${trip.direction || trip.day_name}`}
                      className="flex items-center justify-between p-4 bg-white/5 rounded-lg"
                    >
                      <div>
                        <p className="text-white font-medium">{trip.day_name}</p>
                        <p className="text-gray-400 text-sm">{trip.date}</p>
                        {trip.direction && <p className="text-blue-400 text-sm">{trip.direction}</p>}
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

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="p-4 bg-white/5 rounded-xl">
                  <p className="text-gray-400 text-sm mb-1">Annonces actives</p>
                  <p className="text-2xl font-bold text-white">
                    {dashboardData.operations?.announcements?.active || 0}
                  </p>
                </div>
                <div className="p-4 bg-white/5 rounded-xl">
                  <p className="text-gray-400 text-sm mb-1">Agences actives</p>
                  <p className="text-2xl font-bold text-white">
                    {dashboardData.operations?.agencies?.active || 0}
                  </p>
                </div>
                <div className="p-4 bg-white/5 rounded-xl">
                  <p className="text-gray-400 text-sm mb-1">Staff actif</p>
                  <p className="text-2xl font-bold text-white">
                    {dashboardData.operations?.staff?.active || 0}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Dernieres annonces</h3>
                {announcements.length === 0 ? (
                  <p className="text-gray-400">Aucune annonce publiee pour le moment.</p>
                ) : (
                  <div className="space-y-3">
                    {announcements.slice(0, 3).map((announcement) => (
                      <div key={announcement.id} className="p-4 bg-white/5 rounded-xl">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-white font-semibold">{announcement.title}</p>
                            <p className="text-gray-400 text-sm mt-1">{announcement.message}</p>
                            <p className="text-gray-500 text-xs mt-2">
                              {announcement.travel_date ? `Date: ${announcement.travel_date}` : 'Annonce generale'}
                              {announcement.destination ? ` • ${announcement.destination}` : ''}
                            </p>
                          </div>
                          <span
                            className={`px-2 py-1 rounded text-xs ${
                              announcement.active
                                ? 'bg-green-500/20 text-green-400'
                                : 'bg-white/10 text-gray-400'
                            }`}
                          >
                            {announcement.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'settings' && (
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-semibold text-white mb-4">Parametres</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {transportType === 'ferry' ? (
                    <>
                      <div>
                        <Label className="text-gray-300 mb-2 block">Prix passager (FDJ)</Label>
                        <Input
                          type="number"
                          value={passengerPrice}
                          onChange={(event) => setPassengerPrice(Number(event.target.value || 0))}
                          className="bg-white/5 border-white/10 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300 mb-2 block">Age gratuit enfant</Label>
                        <Input
                          type="number"
                          value={childFreeAge}
                          onChange={(event) => setChildFreeAge(Number(event.target.value || 0))}
                          className="bg-white/5 border-white/10 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300 mb-2 block">Capacite max passagers</Label>
                        <Input
                          type="number"
                          value={maxPassengers}
                          onChange={(event) => setMaxPassengers(Number(event.target.value || 0))}
                          className="bg-white/5 border-white/10 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300 mb-2 block">Capacite max vehicules</Label>
                        <Input
                          type="number"
                          value={maxVehicles}
                          onChange={(event) => setMaxVehicles(Number(event.target.value || 0))}
                          className="bg-white/5 border-white/10 text-white"
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <Label className="text-gray-300 mb-2 block">Prix billet (FDJ)</Label>
                        <Input
                          type="number"
                          value={trainPrice}
                          onChange={(event) => setTrainPrice(Number(event.target.value || 0))}
                          className="bg-white/5 border-white/10 text-white"
                        />
                      </div>
                      <div>
                        <Label className="text-gray-300 mb-2 block">Heure de depart</Label>
                        <Input
                          type="time"
                          value={trainDepartureTime}
                          onChange={(event) => setTrainDepartureTime(event.target.value)}
                          className="bg-white/5 border-white/10 text-white"
                        />
                      </div>
                      <div className="md:col-span-2 flex items-center justify-between p-4 bg-white/5 rounded-xl">
                        <div>
                          <p className="text-white font-medium">Service actif</p>
                          <p className="text-gray-500 text-sm">Couper la vente si besoin</p>
                        </div>
                        <Switch checked={trainActive} onCheckedChange={setTrainActive} />
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

              {transportType === 'ferry' && (
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Prix des vehicules</h3>
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
                            onChange={(event) => updateVehiclePrice(index, event.target.value)}
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
            </div>
          )}

          {activeTab === 'bookings' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-white/5 rounded-xl">
                  <p className="text-gray-400 text-sm">Reservations</p>
                  <p className="text-2xl font-bold text-white">{combinedBookings.length}</p>
                </div>
                <div className="p-4 bg-white/5 rounded-xl">
                  <p className="text-gray-400 text-sm">Revenu de la liste</p>
                  <p className="text-2xl font-bold text-white">
                    {formatMoney(bookingsData?.total_revenue || 0)}
                  </p>
                </div>
                <div className="p-4 bg-white/5 rounded-xl">
                  <p className="text-gray-400 text-sm">Codes promo utilises</p>
                  <p className="text-2xl font-bold text-white">
                    {combinedBookings.filter((booking) => booking.promo_code).length}
                  </p>
                </div>
              </div>

              {combinedBookings.length === 0 ? (
                <p className="text-gray-400">Aucune reservation pour le moment.</p>
              ) : (
                <div className="space-y-3">
                  {combinedBookings.slice(0, 50).map((booking) => (
                    <div key={`${booking.kind}-${booking.id}`} className="p-4 bg-white/5 rounded-xl">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <p className="text-white font-semibold">{booking.title}</p>
                          <p className="text-gray-400 text-sm">{booking.subtitle}</p>
                          <p className="text-gray-500 text-xs mt-2">
                            Voyage: {booking.date || '-'} | Cree le {formatDateTime(booking.created_at)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-bold">{formatMoney(booking.amount)}</p>
                          <p className="text-gray-500 text-sm capitalize">{booking.status || 'valid'}</p>
                          {booking.promo_code && (
                            <p className="text-green-400 text-xs mt-1">Promo: {booking.promo_code}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'announcements' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-4 bg-white/5 rounded-xl space-y-4">
                  <div>
                    <Label className="text-gray-300 mb-2 block">Titre</Label>
                    <Input
                      value={announcementForm.title}
                      onChange={(event) =>
                        setAnnouncementForm((current) => ({ ...current, title: event.target.value }))
                      }
                      className="bg-white/5 border-white/10 text-white"
                      placeholder="Annulation de la rotation du samedi"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-300 mb-2 block">Type</Label>
                    <select
                      value={announcementForm.announcement_type}
                      onChange={(event) =>
                        setAnnouncementForm((current) => ({
                          ...current,
                          announcement_type: event.target.value,
                        }))
                      }
                      className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white"
                    >
                      <option value="cancellation">Annulation</option>
                      <option value="delay">Retard</option>
                      <option value="maintenance">Maintenance</option>
                      <option value="info">Information</option>
                    </select>
                  </div>
                  <div>
                    <Label className="text-gray-300 mb-2 block">Message</Label>
                    <Textarea
                      value={announcementForm.message}
                      onChange={(event) =>
                        setAnnouncementForm((current) => ({ ...current, message: event.target.value }))
                      }
                      className="bg-white/5 border-white/10 text-white"
                      placeholder="La traversee est annulee pour cause de meteo..."
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-300 mb-2 block">Date du voyage</Label>
                      <Input
                        type="date"
                        value={announcementForm.travel_date}
                        onChange={(event) =>
                          setAnnouncementForm((current) => ({ ...current, travel_date: event.target.value }))
                        }
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    {transportType === 'ferry' && (
                      <div>
                        <Label className="text-gray-300 mb-2 block">Destination</Label>
                        <Input
                          value={announcementForm.destination}
                          onChange={(event) =>
                            setAnnouncementForm((current) => ({ ...current, destination: event.target.value }))
                          }
                          className="bg-white/5 border-white/10 text-white"
                          placeholder="Obock ou Tadjoura"
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white text-sm">Annonce active</p>
                      <p className="text-gray-500 text-xs">Visible dans le parcours de reservation</p>
                    </div>
                    <Switch
                      checked={announcementForm.active}
                      onCheckedChange={(checked) =>
                        setAnnouncementForm((current) => ({ ...current, active: checked }))
                      }
                    />
                  </div>
                  <Button onClick={createAnnouncement} disabled={saving} className="bg-ferry text-black">
                    <Megaphone size={16} className="mr-2" /> Publier l annonce
                  </Button>
                </div>

                <div className="space-y-3">
                  {announcements.length === 0 ? (
                    <div className="p-6 bg-white/5 rounded-xl text-gray-400">
                      Aucune annonce. Creez une annonce pour gerer les annulations ou retards.
                    </div>
                  ) : (
                    announcements.map((announcement) => (
                      <div key={announcement.id} className="p-4 bg-white/5 rounded-xl">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-white font-semibold">{announcement.title}</p>
                            <p className="text-gray-400 text-sm mt-1">{announcement.message}</p>
                            <p className="text-gray-500 text-xs mt-2">
                              {announcement.announcement_type} • {announcement.travel_date || 'general'}
                              {announcement.destination ? ` • ${announcement.destination}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-white/20 text-white"
                              onClick={() => toggleAnnouncement(announcement)}
                            >
                              {announcement.active ? 'Desactiver' : 'Activer'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300"
                              onClick={() => deleteAnnouncement(announcement.id)}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'agencies' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="p-4 bg-white/5 rounded-xl space-y-4">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <Building2 size={18} className="text-ferry" /> Nouvelle agence
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-300 mb-2 block">Nom</Label>
                      <Input
                        value={agencyForm.name}
                        onChange={(event) => setAgencyForm((current) => ({ ...current, name: event.target.value }))}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 mb-2 block">Contact</Label>
                      <Input
                        value={agencyForm.contact_name}
                        onChange={(event) =>
                          setAgencyForm((current) => ({ ...current, contact_name: event.target.value }))
                        }
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 mb-2 block">Telephone</Label>
                      <Input
                        value={agencyForm.phone}
                        onChange={(event) => setAgencyForm((current) => ({ ...current, phone: event.target.value }))}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 mb-2 block">Objectif reservations</Label>
                      <Input
                        type="number"
                        value={agencyForm.target_bookings}
                        onChange={(event) =>
                          setAgencyForm((current) => ({
                            ...current,
                            target_bookings: Number(event.target.value || 0),
                          }))
                        }
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-gray-300 mb-2 block">Notes</Label>
                    <Textarea
                      value={agencyForm.notes}
                      onChange={(event) => setAgencyForm((current) => ({ ...current, notes: event.target.value }))}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <Button onClick={createAgency} disabled={saving} className="bg-ferry text-black">
                    Creer l agence
                  </Button>
                </div>

                <div className="p-4 bg-white/5 rounded-xl space-y-4">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <Shield size={18} className="text-cyan-400" /> Nouveau staff
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-300 mb-2 block">Nom complet</Label>
                      <Input
                        value={staffForm.full_name}
                        onChange={(event) =>
                          setStaffForm((current) => ({ ...current, full_name: event.target.value }))
                        }
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 mb-2 block">Username</Label>
                      <Input
                        value={staffForm.username}
                        onChange={(event) =>
                          setStaffForm((current) => ({
                            ...current,
                            username: event.target.value.toLowerCase().replace(/\s+/g, '_'),
                          }))
                        }
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 mb-2 block">Role</Label>
                      <Input
                        value={staffForm.role}
                        onChange={(event) => setStaffForm((current) => ({ ...current, role: event.target.value }))}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 mb-2 block">Agence</Label>
                      <select
                        value={staffForm.agency_id}
                        onChange={(event) =>
                          setStaffForm((current) => ({ ...current, agency_id: event.target.value }))
                        }
                        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white"
                      >
                        <option value="">Sans agence</option>
                        {agencies.map((agency) => (
                          <option key={agency.id} value={agency.id}>
                            {agency.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Button onClick={createStaff} disabled={saving} className="bg-cyan-400 text-black hover:bg-cyan-300">
                    Creer le compte staff
                  </Button>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Performance des agences</h3>
                {performance.agencies?.length === 0 ? (
                  <p className="text-gray-400">Aucune agence pour le moment.</p>
                ) : (
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {performance.agencies.map((agency) => (
                      <div key={agency.id} className="p-4 bg-white/5 rounded-xl">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-white font-semibold">{agency.name}</p>
                            <p className="text-gray-400 text-sm">{agency.contact_name || 'Sans contact'}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-white/20 text-white"
                              onClick={() => toggleAgency(agency)}
                            >
                              {agency.active ? 'Desactiver' : 'Activer'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300"
                              onClick={() => deleteAgency(agency.id)}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-gray-400">Reservations</p>
                            <p className="text-white font-bold">{agency.bookings_count || 0}</p>
                          </div>
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-gray-400">Ventes</p>
                            <p className="text-white font-bold">{formatMoney(agency.total_sales || 0)}</p>
                          </div>
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-gray-400">Staff</p>
                            <p className="text-white font-bold">
                              {agency.active_staff || 0}/{agency.staff_count || 0}
                            </p>
                          </div>
                          <div className="p-3 bg-white/5 rounded-lg">
                            <p className="text-gray-400">Objectif atteint</p>
                            <p className="text-white font-bold">{agency.goal_progress || 0}%</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Staff transport</h3>
                {staffList.length === 0 ? (
                  <p className="text-gray-400">Aucun staff cree pour le moment.</p>
                ) : (
                  <div className="space-y-3">
                    {performance.staff.map((staff) => (
                      <div key={staff.id} className="p-4 bg-white/5 rounded-xl">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                          <div>
                            <p className="text-white font-semibold">{staff.full_name}</p>
                            <p className="text-gray-400 text-sm">@{staff.username} • {staff.role}</p>
                            <p className="text-gray-500 text-xs mt-1">
                              {agencies.find((agency) => agency.id === staff.agency_id)?.name || 'Sans agence'}
                            </p>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                            <div>
                              <p className="text-gray-400">Reservations</p>
                              <p className="text-white font-bold">{staff.bookings_count || 0}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Ventes</p>
                              <p className="text-white font-bold">{formatMoney(staff.total_sales || 0)}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Promos</p>
                              <p className="text-white font-bold">{staff.promo_codes_count || 0}</p>
                            </div>
                            <div>
                              <p className="text-gray-400">Etat</p>
                              <p className={staff.active ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                                {staff.active ? 'Actif' : 'Inactif'}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-white/20 text-white"
                              onClick={() => toggleStaff(staff)}
                            >
                              {staff.active ? 'Desactiver' : 'Activer'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="border-white/20 text-white"
                              onClick={() => resetStaffPassword(staff.id)}
                            >
                              Reset password
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-400 hover:text-red-300"
                              onClick={() => deleteStaff(staff.id)}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'promo' && (
            <div className="space-y-8">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="p-4 bg-white/5 rounded-xl space-y-4">
                  <h3 className="text-white font-semibold flex items-center gap-2">
                    <TicketPercent size={18} className="text-green-400" /> Nouveau code promo
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-300 mb-2 block">Code</Label>
                      <Input
                        value={promoForm.code}
                        onChange={(event) =>
                          setPromoForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))
                        }
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 mb-2 block">Titre</Label>
                      <Input
                        value={promoForm.title}
                        onChange={(event) => setPromoForm((current) => ({ ...current, title: event.target.value }))}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 mb-2 block">Type</Label>
                      <select
                        value={promoForm.discount_type}
                        onChange={(event) =>
                          setPromoForm((current) => ({ ...current, discount_type: event.target.value }))
                        }
                        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white"
                      >
                        <option value="percentage">Pourcentage</option>
                        <option value="fixed">Montant fixe</option>
                      </select>
                    </div>
                    <div>
                      <Label className="text-gray-300 mb-2 block">Valeur</Label>
                      <Input
                        type="number"
                        value={promoForm.discount_value}
                        onChange={(event) =>
                          setPromoForm((current) => ({
                            ...current,
                            discount_value: Number(event.target.value || 0),
                          }))
                        }
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 mb-2 block">Utilisations max</Label>
                      <Input
                        type="number"
                        value={promoForm.max_uses}
                        onChange={(event) =>
                          setPromoForm((current) => ({ ...current, max_uses: Number(event.target.value || 1) }))
                        }
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 mb-2 block">Date expiration</Label>
                      <Input
                        type="date"
                        value={promoForm.valid_until}
                        onChange={(event) =>
                          setPromoForm((current) => ({ ...current, valid_until: event.target.value }))
                        }
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <Label className="text-gray-300 mb-2 block">Agence</Label>
                      <select
                        value={promoForm.agency_id}
                        onChange={(event) =>
                          setPromoForm((current) => ({ ...current, agency_id: event.target.value }))
                        }
                        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white"
                      >
                        <option value="">Aucune</option>
                        {agencies.map((agency) => (
                          <option key={agency.id} value={agency.id}>
                            {agency.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label className="text-gray-300 mb-2 block">Staff</Label>
                      <select
                        value={promoForm.staff_id}
                        onChange={(event) =>
                          setPromoForm((current) => ({ ...current, staff_id: event.target.value }))
                        }
                        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-white"
                      >
                        <option value="">Aucun</option>
                        {staffList.map((staff) => (
                          <option key={staff.id} value={staff.id}>
                            {staff.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <Button onClick={createPromoCode} disabled={saving} className="bg-green-500 text-black hover:bg-green-400">
                    Creer le code promo
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-gray-400 text-sm">Codes promo</p>
                    <p className="text-2xl font-bold text-white">{promoCodes.length}</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-gray-400 text-sm">Utilisations</p>
                    <p className="text-2xl font-bold text-white">{performance.totals?.bookings || 0}</p>
                  </div>
                  <div className="p-4 bg-white/5 rounded-xl">
                    <p className="text-gray-400 text-sm">Ventes generees</p>
                    <p className="text-2xl font-bold text-white">{formatMoney(performance.totals?.sales || 0)}</p>
                  </div>
                </div>
              </div>

              {promoCodes.length === 0 ? (
                <p className="text-gray-400">Aucun code promo cree pour le moment.</p>
              ) : (
                <div className="space-y-3">
                  {promoCodes.map((promo) => (
                    <div key={promo.id} className="p-4 bg-white/5 rounded-xl">
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div>
                          <button
                            onClick={() => copyText(promo.code)}
                            className="font-mono text-green-400 font-bold text-lg"
                          >
                            {promo.code}
                          </button>
                          <p className="text-white">{promo.title || promo.code}</p>
                          <p className="text-gray-500 text-sm">
                            {promo.discount_type === 'percentage'
                              ? `-${promo.discount_value}%`
                              : `-${formatMoney(promo.discount_value)}`}
                            {' • '}
                            {promo.uses || 0}/{promo.max_uses || 0} utilisations
                          </p>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <p className="text-gray-400">Ventes</p>
                            <p className="text-white font-bold">{formatMoney(promo.total_sales || 0)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Expire</p>
                            <p className="text-white font-bold">{promo.valid_until ? formatDate(promo.valid_until) : 'Jamais'}</p>
                          </div>
                          <div>
                            <p className="text-gray-400">Agence</p>
                            <p className="text-white font-bold">
                              {agencies.find((agency) => agency.id === promo.agency_id)?.name || '-'}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400">Staff</p>
                            <p className="text-white font-bold">
                              {staffList.find((staff) => staff.id === promo.staff_id)?.full_name || '-'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-white/20 text-white"
                            onClick={() => togglePromoCode(promo)}
                          >
                            {promo.active ? 'Desactiver' : 'Activer'}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-400 hover:text-red-300"
                            onClick={() => deletePromoCode(promo.id)}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {transportType === 'ferry' && dashboardData.revenue.vehicle_revenue > 0 && (
          <div className="glass p-6 rounded-xl">
            <h3 className="text-lg font-semibold text-white mb-4">Repartition des revenus</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-gray-400 text-sm">Passagers</p>
                <p className="text-2xl font-bold text-white">
                  {formatMoney(dashboardData.revenue.passenger_revenue)}
                </p>
              </div>
              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-gray-400 text-sm">Vehicules</p>
                <p className="text-2xl font-bold text-ferry">
                  {formatMoney(dashboardData.revenue.vehicle_revenue)}
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
