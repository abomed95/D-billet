import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowLeft, FileText, Phone, Mail } from 'lucide-react';
import { Skeleton } from '../components/ui/skeleton';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const LEGAL_PAGES = {
  mentions: { title: 'Mentions Légales', icon: FileText, endpoint: '/legal/mentions' },
  cgv: { title: 'Conditions Générales de Vente', icon: FileText, endpoint: '/legal/cgv' },
  privacy: { title: 'Politique de Confidentialité', icon: FileText, endpoint: '/legal/privacy' },
  support: { title: 'Support Client', icon: Phone, endpoint: '/legal/support' },
};

const LegalPage = () => {
  const { page } = useParams();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);

  const pageConfig = LEGAL_PAGES[page];

  useEffect(() => {
    if (pageConfig) {
      fetchContent();
    }
  }, [page]);

  const fetchContent = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}${pageConfig.endpoint}`);
      setContent(response.data);
    } catch (error) {
      console.error('Failed to fetch legal content:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!pageConfig) {
    return (
      <div className="min-h-screen py-12 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="font-unbounded font-bold text-2xl text-white mb-4">Page non trouvée</h1>
          <Link to="/" className="text-primary hover:underline">Retour à l'accueil</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen py-12 px-4">
        <div className="max-w-3xl mx-auto space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-3/4" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-4"
          >
            <ArrowLeft size={20} />
            Retour
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <pageConfig.icon className="text-primary" size={24} />
            </div>
            <h1 className="font-unbounded font-bold text-2xl md:text-3xl text-white">
              {content?.title || pageConfig.title}
            </h1>
          </div>
        </div>

        {/* Content */}
        <div className="glass-card p-6 md:p-8">
          <div className="prose prose-invert prose-lg max-w-none">
            {content?.content && (
              <div 
                className="text-gray-300 leading-relaxed space-y-4"
                style={{ whiteSpace: 'pre-wrap' }}
              >
                {content.content.split('\n').map((line, index) => {
                  if (line.startsWith('# ')) {
                    return <h1 key={index} className="font-unbounded font-bold text-2xl text-white mt-6 mb-4">{line.slice(2)}</h1>;
                  }
                  if (line.startsWith('## ')) {
                    return <h2 key={index} className="font-unbounded font-semibold text-xl text-white mt-6 mb-3">{line.slice(3)}</h2>;
                  }
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return <p key={index} className="font-semibold text-white">{line.slice(2, -2)}</p>;
                  }
                  if (line.trim() === '') {
                    return <br key={index} />;
                  }
                  return <p key={index} className="text-gray-300">{line}</p>;
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(LEGAL_PAGES).map(([key, config]) => (
            <Link
              key={key}
              to={`/legal/${key}`}
              className={`glass-card p-4 text-center transition-all hover:border-primary/30
                ${page === key ? 'border-primary/50' : ''}`}
            >
              <config.icon className="mx-auto mb-2 text-gray-400" size={20} />
              <span className="text-sm text-gray-300">{config.title}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LegalPage;
