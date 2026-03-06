import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { Home, Ticket, ShoppingCart, User, Train, Ship } from 'lucide-react';

const MainLayout = () => {
  const { user, isAdmin, isOrganizer } = useAuth();
  const { cartCount } = useCart();
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: 'Accueil' },
    { path: '/train', icon: Train, label: 'Train' },
    { path: '/ferry', icon: Ship, label: 'Ferry' },
    { path: '/my-tickets', icon: Ticket, label: 'Billets', auth: true },
    { path: '/cart', icon: ShoppingCart, label: 'Panier', auth: true, badge: cartCount },
  ];

  return (
    <div className="min-h-screen bg-[#050505]">
      {/* Main Content */}
      <main className="pb-24">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-4 left-4 right-4 h-16 bg-black/80 backdrop-blur-lg border border-gold/20 rounded-full flex items-center justify-around z-50 shadow-2xl">
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
                ${isActive ? 'text-gold' : 'text-gray-500 hover:text-white'}`}
              data-testid={`nav-${item.label.toLowerCase()}`}
            >
              <item.icon size={22} className={isActive ? 'drop-shadow-[0_0_8px_rgba(212,175,55,0.8)]' : ''} />
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
                ? 'text-gold' : 'text-gray-500 hover:text-white'}`}
            data-testid="nav-profile"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-gold to-gold-dark flex items-center justify-center text-black font-bold text-xs">
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
              ${location.pathname === '/auth' ? 'text-gold' : 'text-gray-500 hover:text-white'}`}
            data-testid="nav-login"
          >
            <User size={22} />
            <span className="text-[10px] mt-1">Connexion</span>
          </Link>
        )}
      </nav>
    </div>
  );
};

export default MainLayout;
