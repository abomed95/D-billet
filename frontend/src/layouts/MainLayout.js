import { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { Home, Ticket, User, Train, Ship, LogOut } from 'lucide-react';
import Footer from '../components/Footer';

const MainLayout = () => {
  const { user, isAdmin, isOrganizer, logout } = useAuth();
  const { cartCount } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const isTransportOrganizer = ['ferry_organizer', 'train_organizer'].includes(user?.role);
  const dashboardPath = isAdmin
    ? '/admin'
    : isTransportOrganizer
      ? '/transport-organizer'
      : '/organizer';
  const isDashboardActive =
    location.pathname.includes('/admin') ||
    location.pathname.includes('/organizer') ||
    location.pathname.includes('/transport-organizer');

  const navItems = [
    { path: '/', icon: Home, label: 'Accueil' },
    { path: '/train', icon: Train, label: 'Train' },
    { path: '/ferry', icon: Ship, label: 'Ferry' },
  ];

  const handleLogout = () => {
    logout();
    setShowUserMenu(false);
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col">
      {/* Main Content */}
      <main className="flex-1 pb-24">
        <Outlet />
      </main>

      {/* Footer - Always visible */}
      <Footer />

      {/* User Menu Popup */}
      {showUserMenu && user && (
        <div className="fixed inset-0 z-[60]" onClick={() => setShowUserMenu(false)}>
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div 
            className="absolute bottom-24 left-1/2 -translate-x-1/2 w-72 glass rounded-2xl border border-gold/30 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            {/* User Info */}
            <div className="flex items-center gap-3 pb-4 border-b border-white/10">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center text-black font-bold text-lg">
                {user.full_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div>
                <p className="text-white font-semibold">{user.full_name}</p>
                <p className="text-gray-400 text-sm">{user.email || user.phone}</p>
              </div>
            </div>
            
            {/* Menu Options */}
            <div className="py-2 space-y-1">
              <Link
                to="/my-tickets"
                onClick={() => setShowUserMenu(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white transition-all"
              >
                <Ticket size={20} />
                <span>Mes Billets</span>
              </Link>
              
              {(isAdmin || isOrganizer) && (
                <Link
                  to={dashboardPath}
                  onClick={() => setShowUserMenu(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 text-gray-300 hover:text-white transition-all"
                >
                  <User size={20} />
                  <span>
                    {isAdmin
                      ? 'Tableau de bord Admin'
                      : isTransportOrganizer
                        ? 'Dashboard Transport'
                        : 'Espace Organisateur'}
                  </span>
                </Link>
              )}
            </div>
            
            {/* Logout Button */}
            <div className="pt-2 border-t border-white/10">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-red-500/10 text-red-400 hover:text-red-300 transition-all"
                data-testid="logout-btn"
              >
                <LogOut size={20} />
                <span>Déconnexion</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-4 left-1/2 z-50 grid h-16 w-[min(92vw,720px)] -translate-x-1/2 grid-cols-4 items-center rounded-full border border-gold/20 bg-black/80 px-3 shadow-[0_18px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`relative flex h-full flex-col items-center justify-center rounded-full transition-all
                ${isActive ? 'text-gold' : 'text-gray-500 hover:text-white'}`}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <item.icon size={22} className={isActive ? 'drop-shadow-[0_0_8px_rgba(212,175,55,0.8)]' : ''} />
              <span className="text-[10px] mt-1">{item.label}</span>
            </Link>
          );
        })}
        
        {/* Auth/Profile */}
        {user ? (
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className={`flex flex-col items-center justify-center w-14 h-full transition-all
              ${showUserMenu || isDashboardActive
                ? 'text-gold' : 'text-gray-500 hover:text-white'}`}
            data-testid="nav-profile"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center text-black font-bold text-xs">
              {user.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span className="text-[10px] mt-1">
              {isAdmin ? 'Admin' : isOrganizer ? 'Espace' : 'Profil'}
            </span>
          </button>
        ) : (
          <Link
            to="/auth"
            className={`flex h-full flex-col items-center justify-center rounded-full transition-all
              ${location.pathname === '/auth' ? 'text-gold' : 'text-gray-500 hover:text-white'}`}
            data-testid="nav-login"
          >
            <User size={22} />
            <span className="text-[10px] mt-1">Compte</span>
          </Link>
        )}
      </nav>
    </div>
  );
};

export default MainLayout;
