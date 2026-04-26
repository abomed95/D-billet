import { Ship, Train, Phone, Mail, Instagram, Facebook, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="border-t border-white/5 bg-[#0A0A0F]">
      <div className="mx-auto max-w-7xl px-4 py-12">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <Link to="/" className="mb-4 flex items-center gap-2">
              <img src="/images/dbillet-mark.svg" alt="D-Billet" className="h-10 w-10 object-contain" />
              <span className="font-unbounded text-xl font-bold text-gold">D-BILLET</span>
            </Link>
            <p className="mb-4 text-sm leading-6 text-gray-400">
              Réservez vos événements, vos trajets en train et vos traversées en ferry sur la plateforme officielle D-BILLET à Djibouti.
            </p>
            <div className="flex items-center gap-3">
              <a
                href="https://facebook.com/dbillet"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 transition-colors hover:bg-gold/20"
              >
                <Facebook size={18} className="text-gray-400 hover:text-gold" />
              </a>
              <a
                href="https://instagram.com/dbillet"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 transition-colors hover:bg-gold/20"
              >
                <Instagram size={18} className="text-gray-400 hover:text-gold" />
              </a>
            </div>
          </div>

          <div>
            <h3 className="mb-4 font-semibold text-white">Navigation</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-sm text-gray-400 transition-colors hover:text-gold">
                  Accueil
                </Link>
              </li>
              <li>
                <Link to="/train" className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-gold">
                  <Train size={14} /> Train
                </Link>
              </li>
              <li>
                <Link to="/ferry" className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-gold">
                  <Ship size={14} /> Ferry
                </Link>
              </li>
              <li>
                <Link to="/my-tickets" className="text-sm text-gray-400 transition-colors hover:text-gold">
                  Mes billets
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold text-white">Services</h3>
            <ul className="space-y-2">
              <li className="text-sm text-gray-400">Billetterie événementielle</li>
              <li className="text-sm text-gray-400">Réservation train</li>
              <li className="text-sm text-gray-400">Réservation ferry</li>
              <li className="text-sm text-gray-400">Billet numérique avec QR code</li>
              <li className="text-sm text-gray-400">Paiement local sécurisé</li>
            </ul>
          </div>

          <div>
            <h3 className="mb-4 font-semibold text-white">Contact</h3>
            <ul className="space-y-3">
              <li>
                <a
                  href="tel:+25377694812"
                  className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-gold"
                >
                  <Phone size={14} className="text-gold" />
                  +253 77 69 48 12
                </a>
              </li>
              <li>
                <a
                  href="mailto:contact@d-billet.com"
                  className="flex items-center gap-2 text-sm text-gray-400 transition-colors hover:text-gold"
                >
                  <Mail size={14} className="text-gold" />
                  contact@d-billet.com
                </a>
              </li>
              <li className="flex items-start gap-2 text-sm text-gray-400">
                <MapPin size={14} className="mt-0.5 text-gold" />
                <span>Djibouti-Ville, République de Djibouti</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t border-white/5 py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 md:flex-row">
          <p className="text-center text-sm text-gray-500 md:text-left">
            © {new Date().getFullYear()} D-BILLET. Plateforme officielle de réservation à Djibouti.
          </p>
          <div className="flex items-center gap-6 text-sm">
            <Link to="/terms" className="text-gray-500 transition-colors hover:text-gold">
              Conditions d'utilisation
            </Link>
            <Link to="/legal/privacy" className="text-gray-500 transition-colors hover:text-gold">
              Politique de confidentialité
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
