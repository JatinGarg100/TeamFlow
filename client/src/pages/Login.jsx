import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { loginUser } from '../services/api';
import { useAuth } from '../context/AuthContext';
import GoogleAuthButton from '../components/GoogleAuthButton';
import ThemeToggle from '../components/ThemeToggle';

/**
 * Login Page
 * ──────────
 * Redesigned with Mixed Theme: Dark Navy branding + Electric Blue (#2563EB) accents.
 * Includes password visibility toggle, demo credentials auto-fill, error states, and responsive layout.
 */
function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated, loading: authLoading } = useAuth();

  const searchParams = new URLSearchParams(location.search);
  const redirectParam = searchParams.get('redirect');
  const emailParam = searchParams.get('email');

  const [form, setForm] = useState({
    email: emailParam || 'admin@teamflow.io',
    password: emailParam ? '' : 'Password123!',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // If already authenticated, redirect to destination or dashboard
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      const destination = redirectParam || location.state?.from?.pathname || '/dashboard';
      navigate(destination, { replace: true });
    }
  }, [isAuthenticated, authLoading, navigate, location.state, redirectParam]);

  const handleChange = (e) => {
    setError('');
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const data = await loginUser({
        email: form.email,
        password: form.password,
      });

      login(data);
      setSuccess(`Welcome back, ${data.user.name}! Redirecting...`);
      const destination = redirectParam || location.state?.from?.pathname || '/dashboard';
      setTimeout(() => {
        navigate(destination, { replace: true });
      }, 600);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoFill = () => {
    setForm({ email: 'admin@teamflow.io', password: 'Password123!' });
    setError('');
  };

  const handleGoogleSuccess = (authData) => {
    setError('');
    setSuccess(`Welcome, ${authData.user.name}! Redirecting...`);
    const destination = redirectParam || location.state?.from?.pathname || '/dashboard';
    setTimeout(() => {
      navigate(destination, { replace: true });
    }, 500);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] dark:bg-[#0B1120] px-4 py-12 font-sans relative">
      {/* Floating Theme Toggle */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-8 shadow-sm">
        {/* Brand Header */}
        <div className="mb-6 text-center">
          <Link to="/" className="inline-flex items-center justify-center gap-2 group">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#111827] dark:bg-[#1E293B] text-[#2563EB] dark:text-[#3B82F6] shadow-md border border-slate-800 dark:border-slate-700 group-hover:scale-105 transition-transform">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m0 0L8.41 9.63m0 0A14.926 14.926 0 019.63 8.41" />
              </svg>
            </div>
          </Link>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">Welcome to TeamFlow</h1>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sign in to manage your company projects and team</p>
        </div>

        {/* Demo banner */}
        <div className="mb-5 flex items-center justify-between rounded-xl border border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/40 px-3.5 py-2.5 text-xs text-blue-700 dark:text-blue-300">
          <span className="font-medium">Demo account credentials</span>
          <button
            type="button"
            onClick={handleDemoFill}
            className="font-semibold underline hover:text-blue-900 dark:hover:text-blue-200 cursor-pointer"
          >
            Auto-fill
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300 animate-in fade-in duration-150">
            <svg className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Success message */}
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-700 dark:text-emerald-300 animate-in fade-in duration-150">
            <svg className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>{success}</span>
          </div>
        )}

        {/* Google One-Click Sign-In */}
        <div className="mb-5">
          <GoogleAuthButton
            mode="login"
            onSuccess={handleGoogleSuccess}
            onError={(msg) => setError(msg)}
          />
        </div>

        {/* Divider */}
        <div className="relative mb-5 flex items-center justify-center">
          <div className="w-full border-t border-slate-200 dark:border-slate-800" />
          <span className="absolute bg-white dark:bg-[#111827] px-3 text-[11px] font-medium text-slate-400 dark:text-slate-500">
            or continue with email
          </span>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Email Address
            </label>
            <input
              type="email"
              name="email"
              required
              value={form.email}
              onChange={handleChange}
              placeholder="you@company.com"
              className="input-field"
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                required
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                className="input-field pr-10"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer focus:outline-hidden"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                  </svg>
                ) : (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5 text-xs font-semibold shadow-sm mt-2"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                Signing In...
              </span>
            ) : (
              'Sign In to Dashboard'
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-4 text-center text-xs text-slate-500 dark:text-slate-400">
          Don't have an organization workspace?{' '}
          <Link
            to={
              redirectParam
                ? `/register?redirect=${encodeURIComponent(redirectParam)}${emailParam ? `&email=${encodeURIComponent(emailParam)}` : ''}`
                : '/register'
            }
            className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
          >
            Create an Account
          </Link>
        </div>
      </div>
    </div>
  );
}

export default Login;
