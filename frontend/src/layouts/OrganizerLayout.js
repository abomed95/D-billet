import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { LayoutDashboard, Calendar, Tag, ArrowLeft, LogOut, Users, Wallet, Shield } from 'lucide-react';
import { Button } from '../components/ui/button';

const OrganizerLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { path: '/organizer', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/organizer/events', icon: Calendar, label: 'Événements' },
    { path: '/organizer/participants', icon: Users, label: 'Participants' },
    { path: '/organizer/staff', icon: Shield, label: 'Mon Staff' },
    { path: '/organizer/promo-codes', icon: Tag, label: 'Codes Promo' },
    { path: '/organizer/finances', icon: Wallet, label: 'Finances' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#050505] flex">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-64 glass border-r border-white/10">
        <div className="p-6 border-b border-white/10">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-unbounded font-bold text-xl text-green-400">D-BILLET</span>
          </Link>
          <p className="text-xs text-gray-500 mt-1">Espace Organisateur</p>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all
                  ${isActive 
                    ? 'bg-green-500 text-black' 
                    : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
              >
                <item.icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-2">
          <div className="px-4 py-2">
            <p className="text-xs text-gray-500">Connecté en tant que</p>
            <p className="text-sm text-white truncate">{user?.full_name}</p>
            <p className="text-xs text-gray-500">{user?.company_name}</p>
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
      <div className="flex-1 flex flex-col">
        {/* Mobile Header */}
        <header className="md:hidden sticky top-0 z-50 glass border-b border-white/10 p-4">
          <div className="flex items-center justify-between">
            <Link to="/organizer" className="font-unbounded font-bold text-lg text-green-400">
              D-BILLET Org
            </Link>
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft size={20} />
            </Button>
          </div>
        </header>

        {/* Mobile Bottom Nav */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-white/10 z-50">
          <div className="flex items-center justify-around py-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex flex-col items-center gap-1 p-2 min-w-[56px]
                    ${isActive ? 'text-green-400' : 'text-gray-500'}`}
                >
                  <item.icon size={22} />
                  <span className="text-[10px]">{item.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default OrganizerLayout;
