import { Link } from 'react-router-dom';
import { SearchX, ChevronRight, Home, Train, Ship } from 'lucide-react';
import Seo from '../components/Seo';

const quickLinks = [
  { to: '/', label: 'Retour a l accueil', icon: Home },
  { to: '/train', label: 'Billet train Djibouti', icon: Train },
  { to: '/ferry', label: 'Reservation ferry Djibouti', icon: Ship },
];

const NotFoundPage = () => {
  return (
    <div className="min-h-screen bg-[#050505] px-4 py-16">
      <Seo
        title="404 | Page non trouvee"
        description="La page demandee est introuvable sur D-Billet. Retrouvez l accueil, le train, le ferry et les evenements publics."
        path="/404"
        robots="noindex, nofollow"
      />

      <div className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-[0.95fr_1.05fr] gap-8 items-start">
        <section className="glass rounded-2xl p-8">
          <div className="w-14 h-14 rounded-2xl bg-red-500/15 flex items-center justify-center mb-6">
            <SearchX className="text-red-400" size={30} />
          </div>
          <p className="text-red-400 text-sm uppercase tracking-[0.18em] mb-3">Erreur 404</p>
          <h1 className="font-unbounded text-3xl md:text-4xl text-white mb-4">Page non trouvee</h1>
          <p className="text-gray-300 leading-7">
            Le lien demande n existe pas ou n est plus disponible. Vous pouvez revenir vers les pages
            publiques principales de D-Billet pour retrouver les reservations train, ferry ou les
            evenements en ligne a Djibouti.
          </p>
        </section>

        <section className="space-y-4">
          <div className="glass rounded-2xl p-6">
            <h2 className="font-unbounded text-xl text-white mb-3">Liens utiles</h2>
            <div className="space-y-3">
              {quickLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/5 px-4 py-3 hover:border-gold/40 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
                      <link.icon className="text-gold" size={18} />
                    </div>
                    <span className="text-white truncate">{link.label}</span>
                  </div>
                  <ChevronRight className="text-gray-500 flex-shrink-0" size={18} />
                </Link>
              ))}
            </div>
          </div>

          <div className="glass rounded-2xl p-6">
            <h2 className="font-unbounded text-xl text-white mb-3">Pourquoi cette page est en noindex</h2>
            <p className="text-gray-300 leading-7">
              Cette page sert uniquement a gerer les erreurs de navigation. Elle aide les visiteurs a
              retrouver les bonnes sections du site sans polluer l index Google avec une URL sans valeur
              de recherche.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
};

export default NotFoundPage;
