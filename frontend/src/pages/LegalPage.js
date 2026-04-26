import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, FileText, Headphones, ShieldCheck } from 'lucide-react';
import { Skeleton } from '../components/ui/skeleton';
import Seo from '../components/Seo';
import { API_BASE, isPrerender } from '../lib/api';
import { loadPrerenderLegalPage } from '../lib/prerender';

const API = API_BASE;

const LEGAL_PAGES = {
  mentions: {
    title: 'Mentions légales',
    icon: FileText,
    endpoint: '/legal/mentions',
    eyebrow: 'INFORMATIONS LÉGALES',
    description:
      "Retrouvez les informations d'édition, de responsabilité et de contact liées à la plateforme officielle D-BILLET.",
  },
  cgv: {
    title: 'Conditions générales de vente',
    icon: FileText,
    endpoint: '/legal/cgv',
    eyebrow: 'VENTE ET RÉSERVATION',
    description:
      'Consultez les règles applicables aux commandes, aux tarifs, à la validation des paiements et à la délivrance des billets D-BILLET.',
  },
  privacy: {
    title: 'Politique de confidentialité',
    icon: ShieldCheck,
    endpoint: '/legal/privacy',
    eyebrow: 'DONNÉES PERSONNELLES',
    description:
      'Prenez connaissance de la manière dont D-BILLET collecte, utilise et protège les données nécessaires à vos réservations.',
  },
  support: {
    title: 'Support client',
    icon: Headphones,
    endpoint: '/legal/support',
    eyebrow: 'ACCOMPAGNEMENT',
    description:
      "Accédez aux informations de support pour vos billets, paiements, réservations et demandes d'assistance.",
  },
};

const LegalPage = () => {
  const { page } = useParams();
  const navigate = useNavigate();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);

  const pageConfig = LEGAL_PAGES[page];

  const fetchContent = useCallback(async () => {
    if (!pageConfig) return;

    setLoading(true);
    try {
      const legalData = isPrerender
        ? await loadPrerenderLegalPage(page)
        : (await axios.get(`${API}${pageConfig.endpoint}`)).data;

      setContent(legalData);
    } catch (error) {
      console.error('Failed to fetch legal content:', error);
    } finally {
      setLoading(false);
    }
  }, [page, pageConfig]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const renderLine = (line, index) => {
    if (line.startsWith('# ')) {
      return (
        <h1 key={index} className="mb-4 mt-8 font-unbounded text-2xl font-bold text-white first:mt-0">
          {line.replace('# ', '')}
        </h1>
      );
    }

    if (line.startsWith('## ')) {
      return (
        <h2 key={index} className="mb-3 mt-8 font-unbounded text-xl font-semibold text-gold">
          {line.replace('## ', '')}
        </h2>
      );
    }

    if (line.startsWith('- ')) {
      return (
        <li key={index} className="ml-5 list-disc text-gray-300">
          {line.replace('- ', '')}
        </li>
      );
    }

    if (!line.trim()) {
      return <div key={index} className="h-2" />;
    }

    return (
      <p key={index} className="mb-2 leading-7 text-gray-300">
        {line}
      </p>
    );
  };

  if (!pageConfig) {
    return (
      <div className="min-h-screen bg-[#050505] px-4 py-12">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="mb-4 font-unbounded text-2xl font-bold text-white">Page non trouvée</h1>
          <Link to="/" className="text-gold hover:underline">
            Retour à l'accueil
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] px-4 py-12">
        <div className="mx-auto max-w-4xl space-y-4">
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-5/6" />
          <Skeleton className="h-80 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] px-4 py-8">
      <Seo
        title={content?.title || pageConfig.title}
        description={`D-BILLET - ${content?.title || pageConfig.title}.`}
        path={`/legal/${page}`}
      />

      <div className="mx-auto max-w-4xl">
        <button
          onClick={() => navigate(-1)}
          className="mb-8 flex items-center gap-2 text-gray-400 transition-colors hover:text-white"
        >
          <ArrowLeft size={20} />
          Retour
        </button>

        <div className="mb-8 rounded-[32px] border border-white/10 bg-[#0B0B10] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] md:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/15">
              <pageConfig.icon className="text-gold" size={24} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-gold">{pageConfig.eyebrow}</p>
              <h1 className="mt-2 font-unbounded text-3xl text-white">{content?.title || pageConfig.title}</h1>
              <p className="mt-4 max-w-2xl leading-7 text-gray-300">{pageConfig.description}</p>
              {content?.last_updated && (
                <p className="mt-3 text-sm text-gray-500">Dernière mise à jour : {content.last_updated}</p>
              )}
            </div>
          </div>
        </div>

        <div className="glass rounded-[28px] p-6 md:p-8">
          {(content?.content || '').split('\n').map((line, index) => renderLine(line, index))}
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-gold">ASSISTANCE</p>
            <h2 className="mt-2 font-unbounded text-lg text-white">Une question sur vos réservations ?</h2>
            <p className="mt-3 text-sm leading-6 text-gray-400">
              Notre équipe vous accompagne pour les billets, paiements, commandes et accès aux services D-BILLET.
            </p>
          </div>
          <div className="rounded-2xl border border-gold/15 bg-gold/10 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-gold">LIENS RAPIDES</p>
            <div className="mt-3 flex flex-wrap gap-3">
              {Object.entries(LEGAL_PAGES).map(([key, config]) => (
                <Link
                  key={key}
                  to={`/legal/${key}`}
                  className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                    page === key
                      ? 'border-gold bg-black/20 text-white'
                      : 'border-white/10 bg-white/[0.04] text-gray-200 hover:border-gold/30 hover:text-white'
                  }`}
                >
                  {config.title}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegalPage;
