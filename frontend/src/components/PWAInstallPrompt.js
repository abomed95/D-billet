import { useCallback, useEffect, useState } from 'react';
import { Download, Share, Plus, X } from 'lucide-react';

const DISMISS_KEY = 'dbillet-pwa-install-dismissed';
const DISMISS_DAYS = 14;

const isStandalone = () =>
  (typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(display-mode: standalone)').matches) ||
  (typeof navigator !== 'undefined' && navigator.standalone === true);

const isIos = () =>
  typeof navigator !== 'undefined' &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !/crios|fxios|edgios/i.test(navigator.userAgent);

const recentlyDismissed = () => {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    if (!ts) return false;
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
};

const PWAInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [visible, setVisible] = useState(false);
  const [iosMode, setIosMode] = useState(false);

  const dismiss = useCallback(() => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore storage errors */
    }
  }, []);

  useEffect(() => {
    // Prerender / already installed / recently dismissed -> never show
    if (
      (typeof navigator !== 'undefined' && navigator.userAgent === 'ReactSnap') ||
      isStandalone() ||
      recentlyDismissed()
    ) {
      return undefined;
    }

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
      setVisible(true);
    };

    const handleAppInstalled = () => {
      setVisible(false);
      setDeferredPrompt(null);
      try {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // iOS Safari never fires beforeinstallprompt: show manual instructions.
    let iosTimer;
    if (isIos()) {
      iosTimer = setTimeout(() => {
        setIosMode(true);
        setVisible(true);
      }, 2500);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (iosTimer) clearTimeout(iosTimer);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } catch {
      /* ignore */
    }
    setDeferredPrompt(null);
    setVisible(false);
  }, [deferredPrompt]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-24 left-1/2 z-[55] w-[min(94vw,460px)] -translate-x-1/2 px-1">
      <div className="relative overflow-hidden rounded-3xl border border-gold/30 bg-black/90 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(212,175,55,0.18),transparent_55%)]" />
        <button
          onClick={dismiss}
          className="absolute right-3 top-3 z-10 text-gray-500 transition-colors hover:text-white"
          aria-label="Fermer"
          data-testid="pwa-dismiss"
        >
          <X size={18} />
        </button>

        <div className="relative flex items-start gap-3 pr-6">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-gold/15">
            <img src="/images/dbillet-icon.png" alt="D-Billet" className="h-8 w-8 rounded-xl object-cover" />
          </div>
          <div className="flex-1">
            <p className="font-unbounded text-sm text-white">Installer D-BILLET</p>
            {iosMode ? (
              <p className="mt-1 text-xs leading-5 text-gray-300">
                Appuyez sur{' '}
                <Share size={13} className="mx-0.5 inline align-text-bottom text-gold" />
                puis sur <span className="text-white">« Sur l'écran d'accueil »</span>{' '}
                <Plus size={13} className="mx-0.5 inline align-text-bottom text-gold" />
                pour installer l'application.
              </p>
            ) : (
              <p className="mt-1 text-xs leading-5 text-gray-400">
                Accédez à vos billets plus vite : ajoutez l'application à votre écran d'accueil.
              </p>
            )}
          </div>
        </div>

        {!iosMode && (
          <div className="relative mt-4 flex gap-2">
            <button
              onClick={handleInstall}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gold px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-gold-light"
              data-testid="pwa-install-btn"
            >
              <Download size={16} />
              Installer l'application
            </button>
            <button
              onClick={dismiss}
              className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm text-gray-300 transition-colors hover:text-white"
            >
              Plus tard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
