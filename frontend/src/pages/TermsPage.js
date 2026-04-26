import { useState, useEffect } from 'react';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Seo from '../components/Seo';
import { API_BASE, isPrerender } from '../lib/api';
import { loadPrerenderTerms } from '../lib/prerender';

const API = API_BASE;

const TermsPage = () => {
  const navigate = useNavigate();
  const [terms, setTerms] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTerms();
  }, []);

  const fetchTerms = async () => {
    try {
      const termsData = isPrerender
        ? await loadPrerenderTerms()
        : (await axios.get(`${API}/terms`)).data;

      setTerms(termsData);
    } catch (error) {
      console.error('Failed to fetch terms:', error);
    } finally {
      setLoading(false);
    }
  };

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050505]">
        <div className="animate-pulse text-gold">Chargement des conditions...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] px-4 py-8">
      <Seo
        title={terms?.title || "Conditions d'utilisation"}
        description="Consultez les conditions d'utilisation de D-BILLET pour les réservations, paiements et billets numériques."
        path="/terms"
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
              <ShieldCheck className="text-gold" size={24} />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-gold">INFORMATIONS LÉGALES</p>
              <h1 className="mt-2 font-unbounded text-3xl text-white">
                {terms?.title || "Conditions d'utilisation"}
              </h1>
              <p className="mt-4 max-w-2xl leading-7 text-gray-300">
                Consultez les règles d'utilisation de la plateforme officielle D-BILLET pour vos réservations, paiements, billets numériques et accès aux services.
              </p>
              {terms?.last_updated && (
                <p className="mt-3 text-sm text-gray-500">Dernière mise à jour : {terms.last_updated}</p>
              )}
            </div>
          </div>
        </div>

        <div className="glass rounded-[28px] p-6 md:p-8">
          <div className="max-w-none">
            {(terms?.content || '').split('\n').map((line, index) => renderLine(line, index))}
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-gold">ASSISTANCE</p>
            <h2 className="mt-2 font-unbounded text-lg text-white">Besoin d'un accompagnement ?</h2>
            <p className="mt-3 text-sm leading-6 text-gray-400">
              Notre équipe reste disponible pour vous aider sur les réservations, les paiements et l'accès à vos billets.
            </p>
          </div>
          <div className="rounded-2xl border border-gold/15 bg-gold/10 p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-gold">CONTACT</p>
            <p className="mt-3 text-white">contact@d-billet.com</p>
            <p className="mt-1 text-white">+253 77 69 48 12</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
