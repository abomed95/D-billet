import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { Home, Ticket, ShoppingCart, User, Train, Ship, LogOut, Settings } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu';

const MainLayout = () => {
  const { user, logout, isAdmin, isOrganizer } = useAuth();
  const { cartCount } = useCart();
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/', icon: Home, label: 'Accueil' },
    { path: '/train', icon: Train, label: 'Train' },
    { path: '/ferry', icon: Ship, label: 'Ferry' },
    { path: '/my-tickets', icon: Ticket, label: 'Billets', auth: true },
    { path: '/cart', icon: ShoppingCart, label: 'Panier', auth: true, badge: cartCount },
  ];

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleProfileClick = () => {
    if (!user) {
      navigate('/auth');
    } else if (isAdmin) {
      navigate('/admin');
    } else if (isOrganizer) {
      navigate('/organizer');
    } else {
      navigate('/profile');
    }
  };

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Main Content */}
      <main className="pb-24">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-4 left-4 right-4 h-16 bg-black/80 backdrop-blur-lg border border-white/10 rounded-full flex items-center justify-around z-50 shadow-2xl">
        {navItems.map((item) => {
          if (item.auth && !user) {
            if (item.path === '/cart' || item.path === '/my-tickets') return null;
          }
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`relative flex flex-col items-center justify-center w-14 h-full transition-all
                ${isActive ? 'text-green-400' : 'text-gray-500 hover:text-white'}`}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <item.icon size={22} className={isActive ? 'drop-shadow-[0_0_8px_rgba(0,255,148,0.8)]' : ''} />
              <span className="text-[10px] mt-1">{item.label}</span>
              {item.badge > 0 && (
                <span className="absolute top-0 right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
        
        {/* Auth/Profile */}
        {user ? (
          <Link
            to={isAdmin ? '/admin' : isOrganizer ? '/organizer' : '/my-tickets'}
            className={`flex flex-col items-center justify-center w-14 h-full transition-all
              ${location.pathname === '/profile' || location.pathname.includes('/admin') || location.pathname.includes('/organizer') 
                ? 'text-green-400' : 'text-gray-500 hover:text-white'}`}
            data-testid="nav-profile"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-green-500 to-cyan-500 flex items-center justify-center text-black font-bold text-xs">
              {user.full_name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <span className="text-[10px] mt-1">
              {isAdmin ? 'Admin' : isOrganizer ? 'Espace' : 'Profil'}
            </span>
          </Link>
        ) : (
          <Link
            to="/auth"
            className={`flex flex-col items-center justify-center w-14 h-full transition-all
              ${location.pathname === '/auth' ? 'text-green-400' : 'text-gray-500 hover:text-white'}`}
            data-testid="nav-login"
          >
            <User size={22} />
            <span className="text-[10px] mt-1">Connexion</span>
          </Link>
        )}
      </nav>

      {/* Footer - Desktop only */}
      <footer className="hidden md:block border-t border-white/10 bg-black/50 mt-12">
        <div className="max-w-6xl mx-auto px-8 py-8">
          <div className="grid grid-cols-4 gap-8">
            <div>
              <h3 className="font-unbounded font-bold text-xl text-green-400 mb-4">D-BILLET</h3>
              <p className="text-gray-400 text-sm">La billetterie de Djibouti</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Navigation</h4>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><Link to="/" className="hover:text-white">Accueil</Link></li>
                <li><Link to="/train" className="hover:text-white">Train</Link></li>
                <li><Link to="/ferry" className="hover:text-white">Ferry</Link></li>
                <li><Link to="/my-tickets" className="hover:text-white">Mes Billets</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Contact</h4>
              <p className="text-gray-400 text-sm">WhatsApp: +253 77 00 00 01</p>
              <p className="text-gray-400 text-sm">support@dbillet.dj</p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-3">Paiements</h4>
              <p className="text-gray-400 text-sm">Waafi • D-Money • CAC Bank</p>
            </div>
          </div>
          <div className="border-t border-white/10 mt-8 pt-6 text-center text-gray-500 text-sm">
            © 2025 D-Billet. Djibouti.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default MainLayout;
