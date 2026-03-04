import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, User, Lock, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useStaffAuth } from '../../context/StaffAuthContext';

const StaffLoginPage = () => {
  const navigate = useNavigate();
  const { login } = useStaffAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!username || !password) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    
    setLoading(true);
    try {
      await login(username, password);
      navigate('/staff/scanner');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.response?.data?.detail || 'Identifiants incorrects');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-red-600 p-4 safe-area-top">
        <div className="flex items-center justify-center gap-3">
          <Shield className="text-white" size={28} />
          <span className="font-unbounded font-bold text-xl text-white">D-BILLET STAFF</span>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-500 to-red-500 mb-4">
              <Shield className="text-white" size={40} />
            </div>
            <h1 className="font-unbounded text-2xl font-bold text-white mb-2">
              Connexion Staff
            </h1>
            <p className="text-gray-400 text-sm">
              Accès réservé aux agents de sécurité
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/20 border border-red-500/50 text-red-400 text-sm">
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <div>
              <Label className="text-gray-300 mb-2 flex items-center gap-2">
                <User size={16} />
                Identifiant
              </Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Votre identifiant staff"
                className="bg-white/5 border-white/10 text-white h-14 text-lg"
                autoCapitalize="off"
                autoCorrect="off"
                data-testid="staff-username"
              />
            </div>

            <div>
              <Label className="text-gray-300 mb-2 flex items-center gap-2">
                <Lock size={16} />
                Mot de passe
              </Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Votre mot de passe"
                className="bg-white/5 border-white/10 text-white h-14 text-lg"
                data-testid="staff-password"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white font-bold text-lg"
              data-testid="staff-login-btn"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={24} />
              ) : (
                'Se connecter'
              )}
            </Button>
          </form>

          {/* Footer Info */}
          <div className="mt-8 text-center text-gray-500 text-xs">
            <p>Session sécurisée de 24 heures</p>
            <p className="mt-1">Contactez votre organisateur si vous avez oublié vos identifiants</p>
          </div>
        </div>
      </div>

      {/* Bottom Safe Area */}
      <div className="h-8 safe-area-bottom"></div>
    </div>
  );
};

export default StaffLoginPage;
