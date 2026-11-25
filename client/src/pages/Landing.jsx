import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

/**
 * Landing Page Component
 * ──────────────────────
 * Clean, professional SaaS landing page following the Mixed Theme:
 * Dark Navy (#111827) accents + Electric Blue (#2563EB) primary branding.
 *
 * 7 Core Sections (No fake claims, verified auth state handling):
 * 1. Top Navigation Bar (Header)
 * 2. Hero Section (2-column layout)
 * 3. Product Preview (Realistic sample workspace)
 * 4. Core Features (4 core capabilities)
 * 5. How It Works (3 clear steps)
 * 6. Pricing Preview (Free & Pro tiers)
 * 7. Final Call to Action & Footer
 */
function Landing() {
  const { user, organisation, isAuthenticated, loading, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleSignOut = async () => {
    try {
      setLoggingOut(true);
      await logout();
    } catch (err) {
      console.error('Sign out failed:', err);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-blue-500 selection:text-white">
      {/* ── 1. Top Navigation Bar ───────────────────────────────────── */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#080D19]/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2.5 group">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2563EB] text-white shadow-md shadow-blue-500/20 transition-transform group-hover:scale-105">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m0 0L8.41 9.63m0 0A14.926 14.926 0 019.63 8.41" />
              </svg>
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100">TeamFlow</span>
              <span className="hidden sm:inline-block ml-1.5 rounded-md bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-wide border border-blue-200 dark:border-blue-800/60">
                SaaS
              </span>
            </div>
          </Link>

          {/* Desktop Anchor Navigation */}
          <nav className="hidden md:flex items-center gap-7 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Features</a>
            <a href="#preview" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Product Preview</a>
            <a href="#how-it-works" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Pricing</a>
          </nav>

          {/* Right Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            <ThemeToggle />

            {loading ? (
              // Neutral Loading Skeleton to prevent flicker of guest buttons
              <div className="flex items-center gap-2 animate-pulse">
                <div className="h-8 w-16 rounded-xl bg-slate-200 dark:bg-slate-800" />
                <div className="h-8 w-24 rounded-xl bg-slate-200 dark:bg-slate-800" />
              </div>
            ) : isAuthenticated ? (
              // Authenticated user state
              <div className="flex items-center gap-3">
                <div className="hidden lg:flex flex-col text-right">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">{user?.name}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                    {organisation?.name || 'Workspace'}
                  </span>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-xs font-bold">
                  {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <Link
                  to="/dashboard"
                  className="btn-primary text-xs py-2 px-3.5 shadow-sm inline-flex items-center gap-1.5"
                >
                  <span>Go to Dashboard</span>
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <button
                  type="button"
                  onClick={handleSignOut}
                  disabled={loggingOut}
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
                >
                  {loggingOut ? 'Signing out...' : 'Sign Out'}
                </button>
              </div>
            ) : (
              // Guest state
              <>
                <Link
                  to="/login"
                  className="rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="btn-primary text-xs py-2 px-4 shadow-sm"
                >
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="flex md:hidden items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="rounded-lg p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-hidden cursor-pointer"
              aria-label="Toggle navigation menu"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#080D19] px-4 py-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
            <nav className="flex flex-col gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="py-1.5 hover:text-blue-600 dark:hover:text-blue-400">Features</a>
              <a href="#preview" onClick={() => setMobileMenuOpen(false)} className="py-1.5 hover:text-blue-600 dark:hover:text-blue-400">Product Preview</a>
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="py-1.5 hover:text-blue-600 dark:hover:text-blue-400">How It Works</a>
              <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="py-1.5 hover:text-blue-600 dark:hover:text-blue-400">Pricing</a>
            </nav>
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-col gap-2">
              {loading ? (
                <div className="h-10 w-full rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
              ) : isAuthenticated ? (
                <>
                  <div className="px-1 py-1 text-xs text-slate-500 dark:text-slate-400">
                    Signed in as <strong className="text-slate-800 dark:text-slate-200">{user?.name}</strong>
                  </div>
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn-primary w-full text-center py-2.5 text-xs font-semibold"
                  >
                    Go to Dashboard →
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleSignOut();
                    }}
                    className="w-full text-center py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/60 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full text-center py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMobileMenuOpen(false)}
                    className="btn-primary w-full text-center py-2.5 text-xs font-semibold"
                  >
                    Get Started Free
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ── 2. Hero Section (2-Column Layout) ────────────────────────── */}
      <section className="relative overflow-hidden pt-12 pb-16 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(45rem_50rem_at_top,theme(colors.blue.100),theme(colors.slate.50))] dark:bg-[radial-gradient(45rem_50rem_at_top,theme(colors.blue.950),theme(colors.slate.950))] opacity-40 dark:opacity-20" />

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            {/* Left Column: Heading, description, actions, trust points */}
            <div className="lg:col-span-7 space-y-6 text-left">
              {/* Tagline Pill */}
              <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/60 px-3.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 shadow-xs">
                <span className="flex h-2 w-2 rounded-full bg-blue-600 dark:bg-blue-500" />
                <span>Company, Project &amp; Task Coordination</span>
              </div>

              {/* Exact Main Headline */}
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-5xl leading-[1.15]">
                Bring Your Team, Projects and Tasks{' '}
                <span className="bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
                  Together.
                </span>
              </h1>

              {/* Exact Description */}
              <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 leading-relaxed max-w-xl">
                Plan projects, coordinate teams, assign tasks and track progress from one simple workspace.
              </p>

              {/* Dynamic CTA Actions */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                {loading ? (
                  <div className="h-12 w-48 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" />
                ) : isAuthenticated ? (
                  <>
                    <Link
                      to="/dashboard"
                      className="btn-primary py-3 px-6 text-sm font-semibold shadow-md hover:shadow-lg transition-all inline-flex items-center justify-center gap-2"
                    >
                      <span>Open Your Dashboard</span>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </Link>
                    <Link
                      to="/my-tasks"
                      className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] py-3 px-6 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs text-center"
                    >
                      View Assigned Tasks
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      to="/register"
                      className="btn-primary py-3 px-6 text-sm font-semibold shadow-md hover:shadow-lg transition-all inline-flex items-center justify-center gap-2"
                    >
                      <span>Get Started Free</span>
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                      </svg>
                    </Link>
                    <Link
                      to="/login"
                      className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#111827] py-3 px-6 text-sm font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs text-center"
                    >
                      Sign In to Workspace
                    </Link>
                  </>
                )}
              </div>

              {/* Neutral Assurance Points */}
              <div className="pt-3 flex flex-wrap items-center gap-4 sm:gap-6 text-xs text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Free tier for small teams
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  No credit card required
                </span>
                <span className="flex items-center gap-1.5">
                  <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  Instant workspace setup
                </span>
              </div>
            </div>

            {/* Right Column: Hero Quick Snapshot Card */}
            <div className="lg:col-span-5">
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-5 shadow-xl shadow-slate-200/50 dark:shadow-none space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-lg bg-blue-600 dark:bg-blue-500 flex items-center justify-center text-white text-xs font-bold">
                      TF
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-900 dark:text-slate-100 block">Acme Studio</span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400">Active Workspace</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                    Live Status
                  </span>
                </div>

                {/* Quick Task Highlight */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>Current Sprint Deliverables</span>
                    <span className="text-blue-600 dark:text-blue-400 font-bold">75% Done</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-600 dark:bg-blue-500 rounded-full" style={{ width: '75%' }} />
                  </div>
                </div>

                {/* Sample items */}
                <div className="space-y-2 pt-1 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="font-medium text-slate-800 dark:text-slate-200">Client Portal Launch</span>
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Completed</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      <span className="font-medium text-slate-800 dark:text-slate-200">Security Audit Review</span>
                    </div>
                    <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">In Progress</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      <span className="font-medium text-slate-800 dark:text-slate-200">Q3 Milestone Planning</span>
                    </div>
                    <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">Pending</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Product Preview (Realistic Sample Workspace) ─────────── */}
      <section id="preview" className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#080D19] py-16 sm:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="rounded-md bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
              Interactive Dashboard Preview
            </span>
            <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              A Unified Workspace for All Project Operations
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              The preview below illustrates a typical company workspace with realistic sample projects and task workflows.
            </p>
          </div>

          {/* Interactive-feeling Dashboard Mockup */}
          <div className="max-w-5xl mx-auto rounded-2xl border border-slate-300 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-2xl shadow-blue-100/50 dark:shadow-none overflow-hidden">
            {/* Window Chrome Header */}
            <div className="flex items-center justify-between bg-slate-900 dark:bg-[#040711] px-4 py-3 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-rose-500 inline-block" />
                <span className="h-3 w-3 rounded-full bg-amber-500 inline-block" />
                <span className="h-3 w-3 rounded-full bg-emerald-500 inline-block" />
                <span className="ml-2 text-[11px] text-slate-400 font-mono hidden sm:inline">teamflow.app/dashboard</span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-emerald-400 font-medium">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Realistic Sample Data
                </span>
                <span className="text-slate-400 hidden sm:inline">Acme Corporation Workspace</span>
              </div>
            </div>

            {/* Mock Dashboard Body */}
            <div className="p-4 sm:p-6 bg-slate-50 dark:bg-[#0B1120] border-t border-slate-200 dark:border-slate-800 space-y-6">
              {/* Stat Counters Row */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-3.5 shadow-2xs">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Active Projects</span>
                  <div className="mt-1 text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">8</div>
                  <span className="mt-1 inline-block text-[10px] text-blue-600 dark:text-blue-400 font-medium">3 in development</span>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-3.5 shadow-2xs">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Tasks in Progress</span>
                  <div className="mt-1 text-xl sm:text-2xl font-extrabold text-blue-600 dark:text-blue-400">24</div>
                  <span className="mt-1 inline-block text-[10px] text-slate-500 dark:text-slate-400">Assigned across team</span>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-3.5 shadow-2xs">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Completed This Week</span>
                  <div className="mt-1 text-xl sm:text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">19</div>
                  <span className="mt-1 inline-block text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">On track</span>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-3.5 shadow-2xs">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Workspace Members</span>
                  <div className="mt-1 text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-slate-100">5</div>
                  <span className="mt-1 inline-block text-[10px] text-slate-500 dark:text-slate-400">Owner, Admin, Members</span>
                </div>
              </div>

              {/* Mock Project & Task Preview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Sample Project 1 */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                      In Progress
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">Due in 5 days</span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Client Portal Redesign</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                      Modernize dashboard navigation, responsive views, and user settings.
                    </p>
                  </div>
                  <div>
                    <div className="flex justify-between text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                      <span>Progress</span>
                      <span className="text-blue-600 dark:text-blue-400 font-bold">75%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 dark:bg-blue-500 rounded-full" style={{ width: '75%' }} />
                    </div>
                  </div>
                </div>

                {/* Sample Task 1 */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
                      High Priority
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">Completed</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Email Invitation Integration</h4>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="flex items-center gap-1.5">
                      <span className="h-4 w-4 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 text-[9px] font-bold flex items-center justify-center">
                        JD
                      </span>
                      Jane Doe
                    </span>
                    <span>2 attachments</span>
                  </div>
                </div>

                {/* Sample Task 2 */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 shadow-2xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
                      Medium Priority
                    </span>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold">In Progress</span>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">Role Permissions Verification</h4>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                    <span className="flex items-center gap-1.5">
                      <span className="h-4 w-4 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold flex items-center justify-center">
                        AM
                      </span>
                      Alex Miller
                    </span>
                    <span>4 comments</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      {/* ── 4. Core Features (Only 4 Core Capabilities) ─────────────── */}
      <section id="features" className="py-20 sm:py-28 bg-[#F8FAFC] dark:bg-[#0B1120]">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <span className="rounded-md bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
              Core Capabilities
            </span>
            <h2 className="mt-3 text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Essential Tools for Modern Team Execution
            </h2>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              TeamFlow provides focused capabilities designed to keep projects organized without unnecessary complexity.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {/* Feature 1: Project Management */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/60">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>
              </div>
              <h3 className="mt-5 text-sm font-bold text-slate-900 dark:text-slate-100">1. Project Management</h3>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Organize projects through structured lifecycles. Set deadlines, monitor progress calculations, and coordinate milestone deliverables.
              </p>
            </div>

            {/* Feature 2: Task Assignment and Tracking */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/60">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="mt-5 text-sm font-bold text-slate-900 dark:text-slate-100">2. Task Assignment &amp; Tracking</h3>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Assign tasks to specific team members with priorities, due dates, detailed descriptions, and instantaneous status transitions.
              </p>
            </div>

            {/* Feature 3: Team Collaboration */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/60">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <h3 className="mt-5 text-sm font-bold text-slate-900 dark:text-slate-100">3. Team Collaboration</h3>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Centralize discussions inside tasks with comments and secure file attachments. Avoid fragmented communication across emails.
              </p>
            </div>

            {/* Feature 4: Role-Based Access Control */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-xs hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/60">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-2.18-4.99a4.5 4.5 0 00-6.364 0m10.607 10.607a4.5 4.5 0 000-6.364M12 21a9 9 0 100-18 9 9 0 000 18z" />
                </svg>
              </div>
              <h3 className="mt-5 text-sm font-bold text-slate-900 dark:text-slate-100">4. Role-Based Access Control</h3>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Safeguard workspace actions with clear roles: Owner, Admin, Manager, and Member. Maintain tenant isolation for each organisation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. How It Works (3 Clear Steps) ─────────────────────────── */}
      <section id="how-it-works" className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#080D19] py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <span className="rounded-md bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
              Simple Workflow
            </span>
            <h2 className="mt-3 text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Get Started in Three Straightforward Steps
            </h2>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              No complex setup or lengthy configuration. Start coordinating your projects immediately.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-3">
            {/* Step 1 */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-7 shadow-xs relative">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB] text-white text-base font-extrabold mb-5 shadow-sm">
                1
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Create Workspace</h3>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Sign up with your email or Google account to establish your organisation workspace. As the creator, you are assigned the Owner role.
              </p>
            </div>

            {/* Step 2 */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-7 shadow-xs relative">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB] text-white text-base font-extrabold mb-5 shadow-sm">
                2
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Invite Your Team</h3>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Send secure email invitations with cryptographic one-time tokens. Invite colleagues as Admins, Managers, or Contributors.
              </p>
            </div>

            {/* Step 3 */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-7 shadow-xs relative">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#2563EB] text-white text-base font-extrabold mb-5 shadow-sm">
                3
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Manage Projects &amp; Track Tasks</h3>
              <p className="mt-2 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Create projects, assign tasks, collaborate with comments and attachments, and track real-time milestone completion.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── 6. Pricing Preview (Free & Pro Tiers) ────────────────────── */}
      <section id="pricing" className="border-t border-slate-200 dark:border-slate-800 bg-[#F8FAFC] dark:bg-[#0B1120] py-20 sm:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto">
            <span className="rounded-md bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
              Clear Pricing
            </span>
            <h2 className="mt-3 text-2xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              Transparent Plans for Growing Teams
            </h2>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
              Start free with core capabilities, or upgrade to Pro when your organization needs unlimited project capacity.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-8 md:grid-cols-2 max-w-4xl mx-auto">
            {/* Free Plan */}
            <div className="flex flex-col justify-between rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-8 shadow-xs">
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Free Tier</h3>
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 px-3 py-1 text-[11px] font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    Starter
                  </span>
                </div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">$0</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">/ forever</span>
                </div>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                  Essential project and task management for small teams and initial evaluation.
                </p>

                <ul className="mt-6 space-y-3 text-xs text-slate-700 dark:text-slate-300">
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Up to <strong>5 team members</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Up to <strong>3 active projects</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Standard task status tracking</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Milestone progress calculation</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Standard community &amp; email support</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8">
                <Link
                  to={isAuthenticated ? '/dashboard' : '/register'}
                  className="w-full text-center block rounded-xl border border-blue-600 dark:border-blue-500 py-2.5 px-4 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all cursor-pointer"
                >
                  {isAuthenticated ? 'Active Workspace' : 'Get Started Free'}
                </Link>
              </div>
            </div>

            {/* Pro Plan */}
            <div className="relative flex flex-col justify-between rounded-2xl border-2 border-blue-600 dark:border-blue-500 bg-white dark:bg-[#111827] p-8 shadow-lg shadow-blue-500/5">
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 dark:bg-blue-500 px-3.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white shadow-xs">
                Recommended
              </span>

              <div>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Pro Tier</h3>
                  <span className="rounded-full bg-slate-900 dark:bg-slate-700 px-3 py-1 text-[11px] font-semibold text-white">
                    Growing Teams
                  </span>
                </div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">$29</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">/ month</span>
                </div>
                <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                  Full-featured collaboration platform for growing companies needing expanded capacity.
                </p>

                <ul className="mt-6 space-y-3 text-xs text-slate-700 dark:text-slate-300">
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Unlimited</strong> team members</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span><strong>Unlimited</strong> active projects</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Role-based access control (Owner, Admin, Manager, Member)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>In-context comments and secure file attachments</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <span>Direct email invitations with Resend</span>
                  </li>
                </ul>
              </div>

              <div className="mt-8">
                <Link
                  to={isAuthenticated ? '/plans' : '/register'}
                  className="btn-primary w-full text-center block py-2.5 px-4 text-xs font-semibold shadow-xs"
                >
                  {isAuthenticated ? 'View Subscription Options' : 'Get Started with Pro'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 7. Final Call to Action & Footer ─────────────────────────── */}
      <section className="bg-gradient-to-r from-slate-900 via-[#111827] to-blue-950 dark:from-[#040711] dark:via-[#080D19] dark:to-[#0B1120] py-16 sm:py-20 text-white border-t border-slate-800 dark:border-slate-800/80">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight">
            Ready to streamline your team's workflow?
          </h2>
          <p className="mt-4 text-sm sm:text-base text-slate-300 max-w-2xl mx-auto">
            Get started with TeamFlow today and bring clarity to your projects, assignments, and team collaboration.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            {loading ? (
              <div className="h-10 w-40 rounded-xl bg-slate-800 animate-pulse" />
            ) : isAuthenticated ? (
              <Link
                to="/dashboard"
                className="w-full sm:w-auto rounded-xl bg-[#2563EB] py-3 px-6 text-xs font-bold text-white hover:bg-[#1D4ED8] transition-all shadow-md shadow-blue-500/20 inline-flex items-center justify-center gap-2"
              >
                <span>Go to Dashboard</span>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="w-full sm:w-auto rounded-xl bg-[#2563EB] py-3 px-6 text-xs font-bold text-white hover:bg-[#1D4ED8] transition-all shadow-md shadow-blue-500/20"
                >
                  Create Free Account
                </Link>
                <Link
                  to="/login"
                  className="w-full sm:w-auto rounded-xl border border-slate-700 bg-slate-800/80 dark:bg-slate-800/60 py-3 px-6 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-all"
                >
                  Sign In to Workspace
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#080D19] py-12 text-slate-500 dark:text-slate-400 text-xs">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-slate-100 dark:border-slate-800">
            {/* Brand column */}
            <div className="space-y-3 md:col-span-1">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2563EB] text-white">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m0 0L8.41 9.63m0 0A14.926 14.926 0 019.63 8.41" />
                  </svg>
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">TeamFlow</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                Company, project, and task coordination SaaS. Built for modern agile teams.
              </p>
            </div>

            {/* Links Column 1: Navigation */}
            <div>
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs mb-3">Product</h4>
              <ul className="space-y-2">
                <li><a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Features</a></li>
                <li><a href="#preview" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Product Preview</a></li>
                <li><a href="#how-it-works" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">How It Works</a></li>
                <li><a href="#pricing" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Pricing</a></li>
              </ul>
            </div>

            {/* Links Column 2: Account */}
            <div>
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs mb-3">Account</h4>
              <ul className="space-y-2">
                <li><Link to="/login" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Sign In</Link></li>
                <li><Link to="/register" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Create Account</Link></li>
                <li><Link to="/dashboard" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Workspace Dashboard</Link></li>
                <li><Link to="/plans" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Subscription Tiers</Link></li>
              </ul>
            </div>

            {/* Links Column 3: Stack info */}
            <div>
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-xs mb-3">Architecture</h4>
              <ul className="space-y-2 text-[11px]">
                <li>React 19 &amp; Vite 8 Frontend</li>
                <li>Node.js &amp; Express 4 API</li>
                <li>MongoDB &amp; Mongoose 8</li>
                <li>Multi-Tenant Isolation &amp; RBAC</li>
              </ul>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400 dark:text-slate-500">
            <p>&copy; {new Date().getFullYear()} TeamFlow SaaS. All rights reserved.</p>
            <p>Designed and built for modern agile organisations.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Landing;
