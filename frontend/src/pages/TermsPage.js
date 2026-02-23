import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const TermsPage = () => {
  const navigate = useNavigate();
  const [terms, setTerms] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTerms();
  }, []);

  const fetchTerms = async () => {
    try {
      const response = await axios.get(`${API}/terms`);
      setTerms(response.data);
    } catch (error) {
      console.error('Failed to fetch terms:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="animate-pulse text-green-400">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft size={20} />
          Retour
        </button>

        {/* Header */}
        <div className="mb-8">
          <h1 className="font-unbounded font-bold text-2xl md:text-3xl text-white mb-2">
            {terms?.title || 'Conditions d\'utilisation'}
          </h1>
          {terms?.last_updated && (
            <p className="text-gray-400 text-sm">
              Dernière mise à jour: {terms.last_updated}
            </p>
          )}
        </div>

        {/* Content */}
        <div className="glass p-6 md:p-8 rounded-2xl prose prose-invert max-w-none">
          <div 
            className="text-gray-300 leading-relaxed whitespace-pre-wrap"
            style={{ fontFamily: 'inherit' }}
          >
            {terms?.content?.split('\n').map((line, index) => {
              if (line.startsWith('# ')) {
                return <h1 key={index} className="text-2xl font-unbounded font-bold text-white mt-8 mb-4">{line.replace('# ', '')}</h1>;
              }
              if (line.startsWith('## ')) {
                return <h2 key={index} className="text-xl font-unbounded font-semibold text-green-400 mt-6 mb-3">{line.replace('## ', '')}</h2>;
              }
              if (line.startsWith('- ')) {
                return <li key={index} className="ml-4 text-gray-300">{line.replace('- ', '')}</li>;
              }
              if (line.trim() === '') {
                return <br key={index} />;
              }
              return <p key={index} className="mb-2 text-gray-300">{line}</p>;
            })}
          </div>
        </div>

        {/* Contact */}
        <div className="mt-8 glass p-6 rounded-xl text-center">
          <p className="text-gray-400 mb-2">Des questions?</p>
          <p className="text-white">support@dbillet.dj</p>
          <p className="text-white">WhatsApp: +253 77 00 00 01</p>
        </div>
      </div>
    </div>
  );
};

export default TermsPage;
