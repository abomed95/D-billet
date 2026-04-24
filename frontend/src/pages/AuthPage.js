import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft, Phone, Chrome } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

const AuthPage = () => {
  const [authMethod, setAuthMethod] = useState('phone'); // phone, email, google
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  const { login, register, phoneLogin, googleLogin, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const hasProcessed = useRef(false);

  const redirectByRole = useCallback((userData) => {
    if (userData.role === 'admin') {
      navigate('/admin');
    } else if (['organizer', 'ferry_organizer', 'train_organizer'].includes(userData.role)) {
      navigate('/organizer');
    } else {
      navigate('/');
    }
  }, [navigate]);

  const handleGoogleCallback = useCallback(async (sessionId) => {
    setLoading(true);
    try {
      const userData = await googleLogin(sessionId);
      toast.success('Connexion Google reussie!');
      // Clear the hash from URL
      window.history.replaceState(null, '', window.location.pathname);
      redirectByRole(userData);
    } catch (error) {
      console.error('Google login error:', error);
      toast.error('Erreur de connexion Google');
      window.history.replaceState(null, '', window.location.pathname);
    } finally {
      setLoading(false);
    }
  }, [googleLogin, redirectByRole]);

  // Handle Google OAuth callback
  useEffect(() => {
    if (hasProcessed.current) return;
    
    const hash = window.location.hash;
    if (hash && hash.includes('session_id=')) {
      hasProcessed.current = true;
      const sessionId = hash.split('session_id=')[1]?.split('&')[0];
      if (sessionId) {
        handleGoogleCallback(sessionId);
      }
    }
  }, [handleGoogleCallback]);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      redirectByRole(user);
    }
  }, [redirectByRole, user]);

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + '/auth';
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handlePhoneLogin = async () => {
    if (!phone || phone.length < 8) {
      toast.error('Veuillez entrer un numero de telephone valide');
      return;
    }
    
    setLoading(true);
    try {
      const userData = await phoneLogin(phone, fullName || null);
      toast.success('Connexion reussie!');
      redirectByRole(userData);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }
    
    if (!isLogin && !fullName) {
      toast.error('Veuillez entrer votre nom complet');
      return;
    }
    
    setLoading(true);
    try {
      let userData;
      if (isLogin) {
        userData = await login(email, password);
        toast.success('Connexion reussie!');
      } else {
        userData = await register(email, password, fullName);
        toast.success('Compte cree avec succes!');
      }
      redirectByRole(userData);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur d\'authentification');
    } finally {
      setLoading(false);
    }
  };

  // Loading state for Google callback
  if (loading && window.location.hash?.includes('session_id=')) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <img src="/images/dbillet-icon.png" alt="D-Billet" className="w-20 h-20 mx-auto mb-4 rounded-full" />
          <div className="animate-pulse text-gray-400">Connexion en cours...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft size={20} />
          Retour
        </button>

        {/* Header with Logo */}
        <div className="text-center mb-8">
          <img 
            src="/images/dbillet-logo.png" 
            alt="D-Billet" 
            className="h-16 mx-auto mb-4 object-contain"
          />
          <p className="text-gray-400">
            Connectez-vous ou creez un compte
          </p>
        </div>

        {/* Google Login Button */}
        <Button
          onClick={handleGoogleLogin}
          disabled={loading}
          variant="outline"
          className="w-full mb-6 py-6 bg-white hover:bg-gray-100 text-black border-0 font-medium"
          data-testid="google-login-btn"
        >
          <Chrome className="mr-2" size={20} />
          Continuer avec Google
        </Button>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-[#050505] text-gray-500">ou</span>
          </div>
        </div>

        {/* Auth Method Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setAuthMethod('phone')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2
              ${authMethod === 'phone' 
                ? 'bg-green-500 text-black' 
                : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            <Phone size={18} />
            Telephone
          </button>
          <button
            onClick={() => setAuthMethod('email')}
            className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2
              ${authMethod === 'email' 
                ? 'bg-green-500 text-black' 
                : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >
            <Mail size={18} />
            Email
          </button>
        </div>

        {/* Form Card */}
        <div className="glass p-8 rounded-2xl">
          {/* Phone Login Flow (No OTP) */}
          {authMethod === 'phone' && (
            <div className="space-y-6">
              <div>
                <Label className="text-gray-300 mb-2 block">Numero de telephone</Label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+253 77 XX XX XX"
                    className="pl-10 bg-white/5 border-white/10 text-white"
                    data-testid="auth-phone"
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-300 mb-2 block">Nom complet (optionnel)</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <Input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Mohamed Ali"
                    className="pl-10 bg-white/5 border-white/10 text-white"
                    data-testid="auth-fullname"
                  />
                </div>
              </div>

              <Button
                onClick={handlePhoneLogin}
                disabled={loading}
                className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-6"
                data-testid="phone-login-btn"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin w-5 h-5 border-2 border-black border-t-transparent rounded-full"></div>
                    Connexion...
                  </span>
                ) : (
                  'Continuer'
                )}
              </Button>
            </div>
          )}

          {/* Email Flow */}
          {authMethod === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-6">
              {!isLogin && (
                <div>
                  <Label className="text-gray-300 mb-2 block">Nom complet</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                    <Input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Mohamed Ali"
                      className="pl-10 bg-white/5 border-white/10 text-white"
                      data-testid="register-fullname"
                    />
                  </div>
                </div>
              )}

              <div>
                <Label className="text-gray-300 mb-2 block">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="votre@email.com"
                    className="pl-10 bg-white/5 border-white/10 text-white"
                    data-testid="auth-email"
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-300 mb-2 block">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="********"
                    className="pl-10 pr-10 bg-white/5 border-white/10 text-white"
                    data-testid="auth-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-6"
                data-testid="auth-submit"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin w-5 h-5 border-2 border-black border-t-transparent rounded-full"></div>
                    {isLogin ? 'Connexion...' : 'Creation...'}
                  </span>
                ) : (
                  isLogin ? 'Se connecter' : 'Creer un compte'
                )}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  {isLogin ? (
                    <>Pas de compte? <span className="text-green-400">S'inscrire</span></>
                  ) : (
                    <>Deja un compte? <span className="text-green-400">Se connecter</span></>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Demo Credentials */}
        {authMethod === 'email' && (
          <div className="mt-6 glass p-4 rounded-xl">
            <p className="text-gray-400 text-sm mb-2">Comptes demo:</p>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <p className="text-gray-500">Admin:</p>
                <p className="text-white font-mono">admin@dbillet.dj</p>
              </div>
              <div>
                <p className="text-gray-500">Organisateur:</p>
                <p className="text-white font-mono">organizer@dbillet.dj</p>
              </div>
            </div>
          </div>
        )}

        {/* Contact Info */}
        <div className="mt-6 text-center text-gray-500 text-sm">
          <p>Besoin d'aide? Contactez-nous:</p>
          <p className="text-green-400">+253 77 69 48 12 | contact@d-billet.com</p>
        </div>

        {/* Terms Link */}
        <p className="text-center text-gray-500 text-xs mt-4">
          En continuant, vous acceptez nos{' '}
          <a href="/terms" className="text-green-400 hover:underline">
            Conditions d'utilisation
          </a>
        </p>
      </div>
    </div>
  );
};

export default AuthPage;
