import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * GoogleAuthButton Component
 * ──────────────────────────
 * Official Google Sign-In and Registration button using Google Identity Services (GIS).
 * Handles:
 * 1. Native Google GIS one-tap / popup credential callback.
 * 2. Secure transmission of ID token to /api/auth/google.
 * 3. Clear configuration guide if VITE_GOOGLE_CLIENT_ID is not yet configured.
 *
 * @param {'login' | 'register'} mode - Determines button text and registration flow
 * @param {string} [organisationName] - Optional workspace name for new registrations
 * @param {(authData: any) => void} onSuccess - Callback invoked on successful auth
 * @param {(errorMsg: string) => void} onError - Callback invoked on error
 */
function GoogleAuthButton({
  mode = 'login',
  organisationName = '',
  onSuccess,
  onError,
}) {
  const { loginWithGoogle } = useAuth();
  const btnContainerRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [configMissingNotice, setConfigMissingNotice] = useState(false);

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const isConfigured = Boolean(googleClientId && googleClientId.trim().length > 5);

  useEffect(() => {
    if (!isConfigured) return;

    let isMounted = true;

    // Helper to initialize GIS once the script is loaded
    const initGoogleGsi = () => {
      if (!window.google?.accounts?.id || !btnContainerRef.current) return;

      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            if (!response.credential) {
              if (onError) onError('No credential received from Google authentication.');
              return;
            }

            try {
              setLoading(true);
              const data = await loginWithGoogle({
                credential: response.credential,
                organisationName: mode === 'register' ? organisationName : undefined,
              });
              if (isMounted && onSuccess) {
                onSuccess(data);
              }
            } catch (err) {
              if (isMounted && onError) {
                onError(err.message || 'Google authentication failed.');
              }
            } finally {
              if (isMounted) setLoading(false);
            }
          },
        });

        // Render official Google button into the container ref
        window.google.accounts.id.renderButton(btnContainerRef.current, {
          theme: 'outline',
          size: 'large',
          width: btnContainerRef.current.offsetWidth || 340,
          text: mode === 'register' ? 'signup_with' : 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
        });
      } catch (e) {
        console.warn('Failed to initialize Google Identity Services:', e);
      }
    };

    if (window.google?.accounts?.id) {
      initGoogleGsi();
    } else {
      // Poll briefly if script is loading asynchronously
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          initGoogleGsi();
        }
      }, 150);

      const timeout = setTimeout(() => {
        clearInterval(interval);
      }, 4000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
        isMounted = false;
      };
    }

    return () => {
      isMounted = false;
    };
  }, [isConfigured, googleClientId, mode, organisationName, loginWithGoogle, onSuccess, onError]);

  const handleUnconfiguredClick = () => {
    setConfigMissingNotice((prev) => !prev);
  };

  return (
    <div className="w-full space-y-2.5">
      {/* Official GIS Button Container (when client ID is configured) */}
      {isConfigured ? (
        <div className="relative">
          <div ref={btnContainerRef} className="flex justify-center min-h-[44px]" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl backdrop-blur-xs">
              <svg className="h-5 w-5 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          )}
        </div>
      ) : (
        /* Standalone Google Button (when client ID is not configured yet) */
        <button
          type="button"
          onClick={handleUnconfiguredClick}
          className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 py-2.5 px-4 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80 transition-colors shadow-2xs cursor-pointer"
        >
          {/* Official Google Multicolor 'G' Icon */}
          <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{mode === 'register' ? 'Sign up with Google' : 'Continue with Google'}</span>
        </button>
      )}

      {/* Helpful setup notice when client ID is missing */}
      {configMissingNotice && !isConfigured && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/90 dark:bg-blue-950/60 p-3.5 text-xs text-blue-900 dark:text-blue-200 space-y-1.5 animate-in fade-in duration-150">
          <div className="flex items-center gap-1.5 font-bold text-blue-800 dark:text-blue-300">
            <svg className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Google Sign-In Configuration Required</span>
          </div>
          <p className="text-[11px] text-blue-800/90 dark:text-blue-300/90 leading-relaxed">
            To enable one-click Google Sign-In, add your Google OAuth Client ID to the environment files:
          </p>
          <div className="rounded-lg bg-white/80 dark:bg-slate-900/80 p-2 font-mono text-[10px] text-slate-700 dark:text-slate-300 border border-blue-100 dark:border-blue-900/40 space-y-0.5">
            <div>client/.env &rarr; VITE_GOOGLE_CLIENT_ID=&lt;your-client-id&gt;</div>
            <div>server/.env &rarr; GOOGLE_CLIENT_ID=&lt;your-client-id&gt;</div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GoogleAuthButton;
