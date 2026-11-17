import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * Register page
 * ─────────────
 * Connected to POST /api/auth/register.
 * Creates User + Organisation + Owner Membership with feedback states.
 */
function Register() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    organisationName: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setError('');
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Client-side validations
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);

    try {
      const data = await registerUser({
        name: form.name,
        email: form.email,
        password: form.password,
        organisationName: form.organisationName,
      });

      login(data);
      setSuccess(`Account & Workspace "${data.organisation.name}" created! Redirecting...`);
      setTimeout(() => {
        navigate('/dashboard');
      }, 700);
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F7F8FC] px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-8 shadow-sm">
        {/* Brand */}
        <div className="mb-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#5B4BDB] text-white shadow-xs">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m0 0L8.41 9.63m0 0A14.926 14.926 0 019.63 8.41" />
            </svg>
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-[#1E202A]">Create an Account</h1>
          <p className="mt-1 text-xs text-[#64748B]">Set up your company workspace and start managing projects</p>
        </div>

        {/* Error notification */}
        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 animate-in fade-in duration-150">
            <svg className="h-4 w-4 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Success notification */}
        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 animate-in fade-in duration-150">
            <svg className="h-4 w-4 shrink-0 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="mb-1 block text-xs font-medium text-[#1E202A]">
              Your Full Name
            </label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Alex Johnson"
              required
              className="w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2 text-sm text-[#1E202A] outline-none transition-all focus:border-[#5B4BDB] focus:ring-2 focus:ring-[#EEEDFD]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#1E202A]">
              Work Email Address
            </label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              placeholder="alex@company.com"
              required
              className="w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2 text-sm text-[#1E202A] outline-none transition-all focus:border-[#5B4BDB] focus:ring-2 focus:ring-[#EEEDFD]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-[#1E202A]">
              Company / Organisation Name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              name="organisationName"
              value={form.organisationName}
              onChange={handleChange}
              placeholder="e.g. Acme Innovations"
              className="w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2 text-sm text-[#1E202A] outline-none transition-all focus:border-[#5B4BDB] focus:ring-2 focus:ring-[#EEEDFD]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-[#1E202A]">
                Password
              </label>
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                placeholder="••••••••"
                required
                className="w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2 text-sm text-[#1E202A] outline-none transition-all focus:border-[#5B4BDB] focus:ring-2 focus:ring-[#EEEDFD]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-[#1E202A]">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={form.confirmPassword}
                onChange={handleChange}
                placeholder="••••••••"
                required
                className="w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2 text-sm text-[#1E202A] outline-none transition-all focus:border-[#5B4BDB] focus:ring-2 focus:ring-[#EEEDFD]"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className={`w-full btn-primary py-2.5 mt-2 ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span>Creating Workspace...</span>
              </span>
            ) : (
              'Create Account & Workspace →'
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-[#64748B]">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-[#5B4BDB] hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default Register;
