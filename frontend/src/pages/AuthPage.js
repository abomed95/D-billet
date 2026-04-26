import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Chrome,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Phone,
  Shield,
  Ticket,
  User,
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../context/AuthContext';
import Seo from '../components/Seo';
import { toast } from 'sonner';

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH

const TRUST_POINTS = [
  {
    icon: Ticket,
    title: 'Billets centralisés',
    text: 'Retrouvez vos réservations événements, train et ferry dans un seul espace officiel.',
  },
  {
    icon: Shield,
    title: 'Accès sécurisé',
    text: 'Connectez-vous avec Google ou email dans un parcours clair, rassurant et rapide.',
  },
  {
    icon: CheckCircle2,
    title: 'Assistance disponible',
    text: 'Une aide de contact reste accessible pour accompagner les utilisateurs en cas de besoin.',
  },
];

const AuthPage = () => {
  const [authMethod, setAuthMethod] = useState('email');
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { login, register, googleLogin, user } = useAuth();
  const navigate = useNavigate();
  const hasProcessed = useRef(false);

  const redirectByRole = useCallback(
    (userData) => {
      if (userData.role === 'admin') {
        navigate('/admin');
      } else if (
        ['organizer', 'ferry_organizer', 'train_organizer'].includes(userData.role)
      ) {
        navigate('/organizer');
      } else {
        navigate('/');
      }
    },
    [navigate]
  );

  const handleGoogleCallback = useCallback(
    async (sessionId) => {
      setLoading(true);
      try {
        const userData = await googleLogin(sessionId);
        toast.success('Connexion Google réussie !');
        window.history.replaceState(null, '', window.location.pathname);
        redirectByRole(userData);
      } catch (error) {
        console.error('Google login error:', error);
        toast.error('Erreur de connexion Google');
        window.history.replaceState(null, '', window.location.pathname);
      } finally {
        setLoading(false);
      }
    },
    [googleLogin, redirectByRole]
  );

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

  useEffect(() => {
    if (user) {
      redirectByRole(user);
    }
  }, [redirectByRole, user]);

  const handleGoogleLogin = () => {
    const redirectUrl = `${window.location.origin}/auth`;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  const handleEmailSubmit = async (event) => {
    event.preventDefault();

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
      const userData = isLogin
        ? await login(email, password)
        : await register(email, password, fullName);

      toast.success(isLogin ? 'Connexion réussie !' : 'Compte créé avec succès !');
      redirectByRole(userData);
    } catch (error) {
      toast.error(error.response?.data?.detail || "Erreur d'authentification");
    } finally {
      setLoading(false);
    }
  };

  if (loading && window.location.hash?.includes('session_id=')) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center">
        <div className="text-center">
          <img
            src="/images/dbillet-mark.svg"
            alt="D-Billet"
            className="mx-auto mb-4 h-20 w-20 object-contain"
          />
          <div className="animate-pulse text-gray-400">Connexion en cours...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505]">
      <Seo
        title="Connexion et inscription"
        description="Connectez-vous à D-Billet avec Google ou email. La connexion par téléphone sera bientôt disponible."
        path="/auth"
        robots="noindex, nofollow, noarchive"
      />

      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.18),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_24%)]" />

        <div className="relative mx-auto max-w-6xl px-4 py-6 sm:py-8 lg:py-14">
          <button
            onClick={() => navigate('/')}
            className="mb-8 hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-gray-300 transition-colors hover:border-gold/30 hover:text-white lg:inline-flex"
          >
            <ArrowLeft size={18} />
            Retour à l'accueil
          </button>

          <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
            <section className="hidden rounded-[32px] border border-white/10 bg-[#0B0B10] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.32)] md:p-8 lg:block">
              <div className="flex items-center gap-4">
                <img
                  src="/images/dbillet-mark.svg"
                  alt="D-Billet"
                  className="h-14 w-14 object-contain"
                />
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-gold">
                    ACCÈS COMPTE
                  </p>
                  <h1 className="mt-2 font-unbounded text-3xl leading-tight text-white">
                    Accédez à votre espace D-BILLET
                  </h1>
                </div>
              </div>

              <p className="mt-6 text-base leading-7 text-gray-300">
                Retrouvez vos billets, vos réservations et vos espaces de gestion
                depuis une interface officielle, pensée pour une connexion simple et en toute confiance.
              </p>

              <div className="mt-8 space-y-4">
                {TRUST_POINTS.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                  >
                    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-gold/15">
                      <item.icon className="text-gold" size={20} />
                    </div>
                    <h2 className="font-medium text-white">{item.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-gray-400">{item.text}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 rounded-2xl border border-gold/15 bg-gold/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 text-gold" size={18} />
                  <div>
                    <p className="font-medium text-white">
                      Connexion ou inscription par téléphone bientôt disponible
                    </p>
                    <p className="mt-2 text-sm leading-6 text-gray-300">
                      Pour le moment, utilisez Google ou votre adresse email. L'accès par téléphone
                      n'est pas encore disponible sur la plateforme.
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-400">
                <p className="text-white">Besoin d'aide ?</p>
                <p className="mt-2">+253 77 69 48 12</p>
                <p>contact@d-billet.com</p>
              </div>
            </section>

            <section className="mx-auto w-full max-w-xl rounded-[28px] border border-white/10 bg-black/45 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.36)] backdrop-blur-xl sm:p-6 md:max-w-2xl md:rounded-[32px] md:p-8 lg:mx-0 lg:max-w-none">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-gold">
                    Authentification
                  </p>
                  <h2 className="mt-2 font-unbounded text-2xl text-white">
                    Choisissez votre accès
                  </h2>
                </div>
                <img
                  src="/images/dbillet-logo.png"
                  alt="D-Billet"
                  className="hidden h-12 object-contain md:block"
                />
              </div>

              <Button
                onClick={handleGoogleLogin}
                disabled={loading}
                variant="outline"
                className="mb-6 h-14 w-full rounded-2xl border-0 bg-white text-black hover:bg-gray-100"
                data-testid="google-login-btn"
              >
                <Chrome className="mr-2" size={18} />
                Continuer avec Google
              </Button>

              <div className="relative mb-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-[#050505] px-4 text-sm text-gray-500">ou</span>
                </div>
              </div>

              <div className="mb-6 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAuthMethod('email')}
                  className={`rounded-2xl px-4 py-3 text-sm font-medium transition-all ${
                    authMethod === 'email'
                      ? 'bg-gold text-black'
                      : 'bg-white/[0.04] text-gray-300 hover:bg-white/[0.08]'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Mail size={16} />
                    Email
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setAuthMethod('phone')}
                  className={`rounded-2xl border px-4 py-3 text-sm font-medium transition-all ${
                    authMethod === 'phone'
                      ? 'border-gold/30 bg-gold/10 text-white'
                      : 'border-white/10 bg-white/[0.04] text-gray-300 hover:bg-white/[0.08]'
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <Phone size={16} />
                    Téléphone
                  </span>
                </button>
              </div>

              {authMethod === 'phone' ? (
                <div className="rounded-[28px] border border-white/10 bg-white/[0.03] p-6">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-gold">
                    <AlertCircle size={14} />
                    Bientôt disponible
                  </div>
                  <h3 className="font-unbounded text-xl text-white">
                    L'accès par téléphone n'est pas encore actif
                  </h3>
                  <p className="mt-4 text-sm leading-6 text-gray-400">
                    La connexion et l'inscription par numéro de téléphone seront proposées
                    prochainement. Pour l'instant, veuillez utiliser
                    Google ou votre adresse email.
                  </p>
                  <div className="mt-6 space-y-3">
                    <Button
                      type="button"
                      onClick={handleGoogleLogin}
                      className="h-12 w-full rounded-2xl bg-gold text-black hover:bg-gold-light"
                    >
                      Continuer avec Google
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAuthMethod('email')}
                      className="h-12 w-full rounded-2xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                    >
                      Utiliser mon email
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleEmailSubmit} className="space-y-5">
                  {!isLogin && (
                    <div>
                      <Label className="mb-2 block text-gray-300">Nom complet</Label>
                      <div className="relative">
                        <User
                          className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                          size={18}
                        />
                        <Input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Mohamed Ali"
                          className="h-12 rounded-2xl border-white/10 bg-white/[0.04] pl-11 text-white"
                          data-testid="register-fullname"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="mb-2 block text-gray-300">Email</Label>
                    <div className="relative">
                      <Mail
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                        size={18}
                      />
                      <Input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="votre@email.com"
                        className="h-12 rounded-2xl border-white/10 bg-white/[0.04] pl-11 text-white"
                        data-testid="auth-email"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="mb-2 block text-gray-300">Mot de passe</Label>
                    <div className="relative">
                      <Lock
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"
                        size={18}
                      />
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="********"
                        className="h-12 rounded-2xl border-white/10 bg-white/[0.04] pl-11 pr-11 text-white"
                        data-testid="auth-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-white"
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-12 w-full rounded-2xl bg-gold text-black hover:bg-gold-light"
                    data-testid="auth-submit"
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-black border-t-transparent" />
                        {isLogin ? 'Connexion...' : 'Création...'}
                      </span>
                    ) : isLogin ? (
                      'Se connecter'
                    ) : (
                      'Créer un compte'
                    )}
                  </Button>

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-gray-400">
                    <p className="text-white">Comptes demo</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-gray-500">Admin</p>
                        <p className="font-mono text-white">admin@dbillet.dj</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Organisateur</p>
                        <p className="font-mono text-white">organizer@dbillet.dj</p>
                      </div>
                    </div>
                  </div>

                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setIsLogin(!isLogin)}
                      className="text-sm text-gray-400 transition-colors hover:text-white"
                    >
                      {isLogin ? (
                        <>
                          Pas de compte ?{' '}
                          <span className="text-gold">Créer un compte</span>
                        </>
                      ) : (
                        <>
                          Déjà un compte ?{' '}
                          <span className="text-gold">Se connecter</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}

              <p className="mt-6 text-center text-xs text-gray-500">
                En continuant, vous acceptez nos{' '}
                <Link to="/terms" className="text-gold hover:underline">
                  Conditions d'utilisation
                </Link>
                .
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;

