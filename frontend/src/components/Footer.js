import { Ship, Train, Phone, Mail, Instagram, Facebook, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-[#0A0A0F] border-t border-white/5">
      {/* Main Footer Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand Section */}
          <div className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <img 
                src="/images/dbillet-icon.png" 
                alt="D-Billet" 
                className="w-10 h-10 rounded-lg object-cover"
              />
              <span className="font-unbounded text-xl font-bold text-gold">D-BILLET</span>
            </Link>
            <p className="text-gray-400 text-sm mb-4">
              La plateforme officielle de billetterie de Djibouti pour vos événements, train et ferry.
            </p>
            <div className="flex items-center gap-3">
              <a 
                href="https://facebook.com/dbillet" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-gold/20 transition-colors"
              >
                <Facebook size={18} className="text-gray-400 hover:text-gold" />
              </a>
              <a 
                href="https://instagram.com/dbillet" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-gold/20 transition-colors"
              >
                <Instagram size={18} className="text-gray-400 hover:text-gold" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="text-white font-semibold mb-4">Navigation</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-gray-400 hover:text-gold transition-colors text-sm">
                  Accueil
                </Link>
              </li>
              <li>
                <Link to="/train" className="text-gray-400 hover:text-gold transition-colors text-sm flex items-center gap-2">
                  <Train size={14} /> Train
                </Link>
              </li>
              <li>
                <Link to="/ferry" className="text-gray-400 hover:text-gold transition-colors text-sm flex items-center gap-2">
                  <Ship size={14} /> Ferry
                </Link>
              </li>
              <li>
                <Link to="/my-tickets" className="text-gray-400 hover:text-gold transition-colors text-sm">
                  Mes Billets
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h3 className="text-white font-semibold mb-4">Services</h3>
            <ul className="space-y-2">
              <li className="text-gray-400 text-sm">Billetterie Événements</li>
              <li className="text-gray-400 text-sm">Réservation Train</li>
              <li className="text-gray-400 text-sm">Réservation Ferry</li>
              <li className="text-gray-400 text-sm">Billets PDF avec QR Code</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h3 className="text-white font-semibold mb-4">Contact</h3>
            <ul className="space-y-3">
              <li>
                <a 
                  href="tel:+25377694812" 
                  className="text-gray-400 hover:text-gold transition-colors text-sm flex items-center gap-2"
                >
                  <Phone size={14} className="text-gold" />
                  +253 77 69 48 12
                </a>
              </li>
              <li>
                <a 
                  href="mailto:contact@d-billet.com" 
                  className="text-gray-400 hover:text-gold transition-colors text-sm flex items-center gap-2"
                >
                  <Mail size={14} className="text-gold" />
                  contact@d-billet.com
                </a>
              </li>
              <li className="text-gray-400 text-sm flex items-start gap-2">
                <MapPin size={14} className="text-gold mt-0.5" />
                <span>Djibouti-Ville, République de Djibouti</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/5 py-6">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-gray-500 text-sm text-center md:text-left">
            © {new Date().getFullYear()} D-Billet. Tous droits réservés.
          </p>
          <div className="flex items-center gap-6 text-sm">
            <Link to="/terms" className="text-gray-500 hover:text-gold transition-colors">
              Conditions d'utilisation
            </Link>
            <Link to="/legal/privacy" className="text-gray-500 hover:text-gold transition-colors">
              Confidentialité
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
