import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, Calendar, Users, DollarSign, Settings, 
  ArrowLeft, LogOut, QrCode, Wallet, Train, Ship
} from 'lucide-react';
import { Button } from '../components/ui/button';

const AdminLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/admin', icon: LayoutDashboard, label: 'Dashboard', exact: true },
    { path: '/admin/events', icon: Calendar, label: 'Événements' },
    { path: '/admin/users', icon: Users, label: 'Utilisateurs' },
    { path: '/admin/transactions', icon: DollarSign, label: 'Transactions' },
    { path: '/admin/payouts', icon: Wallet, label: 'Payouts' },
    { path: '/admin/transport', icon: Train, label: 'Transport' },
    { path: '/admin/settings', icon: Settings, label: 'Configuration' },
    { path: '/admin/scanner', icon: QrCode, label: 'Scanner' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (item) => {
    if (item.exact) {
      return location.pathname === item.path;
    }
    return location.pathname.startsWith(item.path);
  };

  return (
    <div className="min-h-screen bg-[#050505] flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 glass border-r border-white/10">
        <div className="p-6 border-b border-white/10">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-cyan-500 flex items-center justify-center">
              <span className="text-black font-bold text-lg">D</span>
            </div>
            <div>
              <span className="font-unbounded font-bold text-xl text-white">D-BILLET</span>
              <p className="text-xs text-red-400">Administration</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                  ${active 
                    ? 'bg-gradient-to-r from-green-500/20 to-cyan-500/20 text-green-400 border border-green-500/30' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                data-testid={`admin-nav-${item.label.toLowerCase()}`}
              >
                <item.icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          <div className="px-4 py-3 rounded-xl bg-white/5">
            <p className="text-xs text-gray-500">Connecté en tant que</p>
            <p className="text-sm text-white font-medium truncate">{user?.full_name}</p>
            <p className="text-xs text-red-400">Administrateur</p>
          </div>
          <Link
            to="/"
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all"
          >
            <ArrowLeft size={20} />
            <span>Retour au site</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 w-full transition-all"
          >
            <LogOut size={20} />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden sticky top-0 z-50 glass border-b border-white/10 p-4">
          <div className="flex items-center justify-between">
            <Link to="/admin" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-cyan-500 flex items-center justify-center">
                <span className="text-black font-bold">D</span>
              </div>
              <span className="font-unbounded font-bold text-green-400">Admin</span>
            </Link>
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft size={20} />
            </Button>
          </div>
        </header>

        {/* Mobile Bottom Nav */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 glass border-t border-white/10 z-50">
          <div className="flex items-center justify-around py-2">
            {navItems.slice(0, 5).map((item) => {
              const active = isActive(item);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center gap-1 p-2 min-w-[56px]
                    ${active ? 'text-green-400' : 'text-gray-500'}`}
                >
                  <item.icon size={22} />
                  <span className="text-[10px]">{item.label.slice(0, 6)}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-6 lg:p-8 pb-24 lg:pb-8 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
