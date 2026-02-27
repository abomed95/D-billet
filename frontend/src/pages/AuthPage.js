import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, ArrowLeft, Phone, KeyRound } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const AuthPage = () => {
  const [authMethod, setAuthMethod] = useState('phone'); // phone, email
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [simulatedOtp, setSimulatedOtp] = useState('');
  
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  const { login, register, sendOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();

  const handleSendOtp = async () => {
    if (!phone || phone.length < 8) {
      toast.error('Veuillez entrer un numéro de téléphone valide');
      return;
    }
    
    setLoading(true);
    try {
      const result = await sendOtp(phone);
      setOtpSent(true);
      // Show simulated OTP (remove in production)
      if (result.otp_simulation) {
        setSimulatedOtp(result.otp_simulation);
        toast.success(`Code OTP envoyé! (Simulation: ${result.otp_simulation})`);
      } else {
        toast.success('Code OTP envoyé par SMS');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'envoi du code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      toast.error('Veuillez entrer le code à 6 chiffres');
      return;
    }
    
    setLoading(true);
    try {
      const userData = await verifyOtp(phone, otpCode);
      toast.success('Connexion réussie!');
      // Redirect based on role
      if (userData.role === 'admin') {
        navigate('/admin');
      } else if (userData.role === 'organizer') {
        navigate('/organizer');
      } else {
        navigate('/');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Code OTP invalide');
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
        toast.success('Connexion réussie!');
      } else {
        userData = await register(email, password, fullName);
        toast.success('Compte créé avec succès!');
      }
      // Redirect based on role
      if (userData.role === 'admin') {
        navigate('/admin');
      } else if (userData.role === 'organizer') {
        navigate('/organizer');
      } else {
        navigate('/');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur d\'authentification');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Back Button */}
        <button
          onClick={() => otpSent ? setOtpSent(false) : navigate('/')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
        >
          <ArrowLeft size={20} />
          {otpSent ? 'Changer de numéro' : 'Retour'}
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="font-unbounded text-3xl font-bold text-green-400 mb-2">D-BILLET</h1>
          <p className="text-gray-400">
            {otpSent ? 'Entrez le code reçu' : 'Connectez-vous ou créez un compte'}
          </p>
        </div>

        {/* Auth Method Tabs */}
        {!otpSent && (
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setAuthMethod('phone')}
              className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all flex items-center justify-center gap-2
                ${authMethod === 'phone' 
                  ? 'bg-green-500 text-black' 
                  : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
            >
              <Phone size={18} />
              Téléphone
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
        )}

        {/* Form Card */}
        <div className="glass p-8 rounded-2xl">
          {/* Phone OTP Flow */}
          {authMethod === 'phone' && !otpSent && (
            <div className="space-y-6">
              <div>
                <Label className="text-gray-300 mb-2 block">Numéro de téléphone</Label>
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

              <Button
                onClick={handleSendOtp}
                disabled={loading}
                className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-6"
                data-testid="send-otp-btn"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin w-5 h-5 border-2 border-black border-t-transparent rounded-full"></div>
                    Envoi en cours...
                  </span>
                ) : (
                  'Recevoir le code OTP'
                )}
              </Button>
            </div>
          )}

          {/* OTP Verification */}
          {authMethod === 'phone' && otpSent && (
            <div className="space-y-6">
              {/* Simulated OTP Display */}
              {simulatedOtp && (
                <div className="p-4 rounded-xl bg-yellow-500/20 border border-yellow-500/50 text-center">
                  <p className="text-yellow-400 text-sm mb-1">Code de simulation (dev)</p>
                  <p className="text-yellow-300 font-mono text-2xl font-bold">{simulatedOtp}</p>
                </div>
              )}

              <div>
                <Label className="text-gray-300 mb-2 block">Code de vérification</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                  <Input
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="pl-10 bg-white/5 border-white/10 text-white text-center font-mono text-2xl tracking-widest"
                    maxLength={6}
                    data-testid="otp-input"
                  />
                </div>
                <p className="text-gray-500 text-sm mt-2 text-center">
                  Code envoyé au {phone}
                </p>
              </div>

              <Button
                onClick={handleVerifyOtp}
                disabled={loading || otpCode.length !== 6}
                className="w-full bg-green-500 hover:bg-green-600 text-black font-bold py-6"
                data-testid="verify-otp-btn"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin w-5 h-5 border-2 border-black border-t-transparent rounded-full"></div>
                    Vérification...
                  </span>
                ) : (
                  'Vérifier et Continuer'
                )}
              </Button>

              <button
                onClick={handleSendOtp}
                disabled={loading}
                className="w-full text-gray-400 hover:text-white text-sm"
              >
                Renvoyer le code
              </button>
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
                    placeholder="••••••••"
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
                    {isLogin ? 'Connexion...' : 'Création...'}
                  </span>
                ) : (
                  isLogin ? 'Se connecter' : 'Créer un compte'
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
                    <>Déjà un compte? <span className="text-green-400">Se connecter</span></>
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
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Admin:</p>
                <p className="text-white font-mono">admin@dbillet.dj</p>
                <p className="text-white font-mono">admin123</p>
              </div>
              <div>
                <p className="text-gray-500">Organisateur:</p>
                <p className="text-white font-mono">organizer@dbillet.dj</p>
                <p className="text-white font-mono">organizer123</p>
              </div>
            </div>
          </div>
        )}

        {/* Terms Link */}
        <p className="text-center text-gray-500 text-xs mt-6">
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
