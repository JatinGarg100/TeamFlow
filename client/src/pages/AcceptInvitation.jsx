import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { verifyInvitationTokenApi, acceptInvitationApi } from '../services/api';
import ThemeToggle from '../components/ThemeToggle';

/**
 * AcceptInvitation Page
 * ─────────────────────
 * Redesigned with Mixed Theme: Dark Navy branding + Electric Blue (#2563EB) accents.
 * Public page for invited members navigating to /invite/:token.
 * Verifies token, displays workspace details, and handles both new-user
 * registration and existing-user verification.
 */
function AcceptInvitation() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, login, logout } = useAuth();

  const [loading, setLoading] = useState(true);
  const [verifyingError, setVerifyingError] = useState('');
  const [invitationData, setInvitationData] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  useEffect(() => {
    const verifyToken = async () => {
      if (!token) {
        setVerifyingError('No invitation token provided in the URL.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setVerifyingError('');
        const res = await verifyInvitationTokenApi(token);
        setInvitationData(res);
      } catch (err) {
        setVerifyingError(err.message || 'Invalid or expired invitation link.');
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, [token]);

  const inviteEmail = invitationData?.email || invitationData?.invitation?.email || '';
  const orgName =
    invitationData?.organisation?.name ||
    invitationData?.invitation?.organisation?.name ||
    'TeamFlow Workspace';
  const roleName = invitationData?.role || invitationData?.invitation?.role || 'Member';
  const inviterName =
    invitationData?.invitedBy?.name ||
    invitationData?.invitation?.invitedBy?.name ||
    'An administrator';

  const isMatchingLoggedInUser = Boolean(
    user && inviteEmail && user.email?.toLowerCase() === inviteEmail.toLowerCase()
  );
  const isDifferentLoggedInUser = Boolean(
    user && inviteEmail && user.email?.toLowerCase() !== inviteEmail.toLowerCase()
  );

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    setActionError('');
    setActionSuccess('');

    // If not already logged in as invitee: validate fields
    if (!isMatchingLoggedInUser) {
      if (!invitationData?.hasExistingAccount && (!formData.name.trim() || formData.name.trim().length < 2)) {
        setActionError('Please enter your full name (at least 2 characters).');
        return;
      }

      if (!formData.password || formData.password.length < 6) {
        setActionError('Password must be at least 6 characters.');
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = isMatchingLoggedInUser
        ? {}
        : {
            name: formData.name.trim(),
            password: formData.password,
          };

      const res = await acceptInvitationApi(token, payload);

      const activeOrgId = res.organisation?.id || res.organisation?._id;
      if (activeOrgId) {
        localStorage.setItem('teamflow_active_org_id', activeOrgId);
      }

      setActionSuccess(res.message || 'Welcome to the team! Redirecting to your dashboard...');
      login(res);

      setTimeout(() => {
        navigate('/dashboard');
      }, 1000);
    } catch (err) {
      setActionError(err.message || 'Failed to accept invitation. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchAccount = async () => {
    try {
      await logout();
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 font-sans relative">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>

      {/* Brand Header */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <Link to="/" className="inline-flex items-center justify-center gap-2 group">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#111827] dark:bg-[#1E293B] text-[#2563EB] dark:text-[#3B82F6] shadow-md border border-slate-800 dark:border-slate-700 group-hover:scale-105 transition-transform mb-3">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m0 0L8.41 9.63m0 0A14.926 14.926 0 019.63 8.41" />
            </svg>
          </div>
        </Link>
        <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">TeamFlow</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Workspace Invitation</p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-8 shadow-sm">
          {/* 1. Token Verification Loading */}
          {loading && (
            <div className="py-12 text-center space-y-3">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent" />
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">Verifying your secure invitation token...</p>
            </div>
          )}

          {/* 2. Token Verification Error */}
          {!loading && verifyingError && (
            <div className="space-y-4 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Invitation Unavailable</h3>
                <p className="mt-1 text-xs text-red-600 dark:text-red-400">{verifyingError}</p>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Invitation links expire in 7 days or become invalid after revocation. Please contact your workspace administrator for a fresh invitation.
              </p>
              <div className="pt-2">
                <Link to="/login" className="btn-primary w-full py-2.5 text-xs">
                  Return to Sign In
                </Link>
              </div>
            </div>
          )}

          {/* 3. Valid Invitation Form */}
          {!loading && !verifyingError && invitationData && (
            <div>
              {/* Workspace Badge Box */}
              <div className="mb-6 rounded-xl border border-blue-100 dark:border-blue-900/50 bg-blue-50/70 dark:bg-blue-950/40 p-4">
                <p className="text-xs text-slate-600 dark:text-slate-400">You're invited to join:</p>
                <div className="mt-1 flex items-baseline justify-between">
                  <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {orgName}
                  </span>
                  <span className="rounded-full bg-blue-100 dark:bg-blue-950/70 px-2.5 py-0.5 text-xs font-bold text-blue-700 dark:text-blue-300 capitalize border border-blue-200 dark:border-blue-800/60">
                    {roleName}
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 space-y-0.5 border-t border-blue-100/80 dark:border-blue-900/50 pt-2">
                  <p>Invited by: <strong>{inviterName}</strong></p>
                  <p>Recipient: <strong>{inviteEmail}</strong></p>
                </div>
              </div>

              {/* Action Error alert */}
              {actionError && (
                <div className="mb-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300">
                  {actionError}
                </div>
              )}

              {/* Action Success alert */}
              {actionSuccess && (
                <div className="mb-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                  {actionSuccess}
                </div>
              )}

              {/* Case A: Logged in with different email */}
              {isDifferentLoggedInUser ? (
                <div className="space-y-4">
                  <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 p-4 text-xs text-amber-800 dark:text-amber-200 space-y-2">
                    <p className="font-semibold text-amber-900 dark:text-amber-100">Account Mismatch Notice</p>
                    <p>
                      You are currently logged in as <strong>{user?.email}</strong>, but this invitation is addressed to <strong>{inviteEmail}</strong>.
                    </p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">
                      To accept this invitation, please switch to the invited account.
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSwitchAccount}
                      className="btn-primary w-full py-2.5 text-xs font-semibold cursor-pointer"
                    >
                      Sign Out &amp; Accept as {inviteEmail}
                    </button>
                    <Link
                      to={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(inviteEmail)}`}
                      className="btn-secondary w-full py-2 text-center text-xs"
                    >
                      Switch Account via Sign In
                    </Link>
                    <Link
                      to="/dashboard"
                      className="text-center text-[11px] text-slate-500 dark:text-slate-400 hover:underline pt-1"
                    >
                      Keep Current Account &amp; Go to Dashboard
                    </Link>
                  </div>
                </div>
              ) : isMatchingLoggedInUser ? (
                /* Case B: Already logged in as the invited user -> One-Click Acceptance */
                <div className="space-y-4">
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/80 dark:bg-emerald-950/40 p-4 text-xs text-emerald-800 dark:text-emerald-200 space-y-1">
                    <p className="font-semibold text-emerald-900 dark:text-emerald-100">✓ Verified Active Account</p>
                    <p>
                      You are currently signed in as <strong>{user?.name}</strong> (<strong>{user?.email}</strong>).
                    </p>
                    <p className="text-[11px] text-emerald-700 dark:text-emerald-300">
                      Click below to immediately link your profile and join the workspace.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleSubmit()}
                    className="btn-primary w-full py-2.5 text-xs font-semibold shadow-sm cursor-pointer"
                  >
                    {submitting ? 'Joining Workspace...' : 'Accept Invitation & Enter Workspace'}
                  </button>
                </div>
              ) : (
                /* Case C: Not logged in (Existing account verification OR New account registration) */
                <form onSubmit={handleSubmit} className="space-y-4">
                  {invitationData.hasExistingAccount ? (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3.5 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                      <p className="font-semibold text-slate-900 dark:text-slate-100">Existing TeamFlow Account Found</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        An account exists for <strong>{inviteEmail}</strong>. Enter your existing password to accept and join this workspace.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="e.g. Alex Johnson"
                        className="input-field"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {invitationData.hasExistingAccount ? 'Account Password' : 'Create Password (min. 6 characters)'}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        placeholder="••••••••"
                        className="input-field pr-10"
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
                    disabled={submitting}
                    className="btn-primary w-full py-2.5 text-xs font-semibold shadow-sm mt-3"
                  >
                    {submitting
                      ? 'Accepting Invitation...'
                      : invitationData.hasExistingAccount
                      ? 'Sign In & Join Workspace'
                      : 'Accept Invitation & Create Account'}
                  </button>

                  <div className="pt-2 text-center text-[11px] text-slate-500 dark:text-slate-400">
                    {invitationData.hasExistingAccount ? (
                      <p>
                        Prefer standard login?{' '}
                        <Link
                          to={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(inviteEmail)}`}
                          className="text-[#2563EB] dark:text-[#3B82F6] font-semibold hover:underline"
                        >
                          Sign In Here
                        </Link>
                      </p>
                    ) : (
                      <p>
                        Already have a TeamFlow account?{' '}
                        <Link
                          to={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}&email=${encodeURIComponent(inviteEmail)}`}
                          className="text-[#2563EB] dark:text-[#3B82F6] font-semibold hover:underline"
                        >
                          Sign In
                        </Link>
                      </p>
                    )}
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AcceptInvitation;
