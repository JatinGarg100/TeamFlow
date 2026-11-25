import { useState } from 'react';
import { NavLink, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Sidebar Component
 * ─────────────────
 * Dark Navy (#111827) enterprise sidebar with Electric Blue (#2563EB) accents.
 * Provides grouped navigation, active workspace switching, user session summary,
 * and responsive mobile drawer capabilities.
 */

// Logically grouped navigation structure
const navGroups = [
  {
    title: 'Overview',
    items: [
      {
        to: '/dashboard',
        label: 'Dashboard',
        icon: (
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
          </svg>
        ),
      },
      {
        to: '/my-tasks',
        label: 'My Tasks',
        icon: (
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        ),
      },
      {
        to: '/calendar',
        label: 'Calendar',
        icon: (
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12v-.008zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75v-.008zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5v-.008zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008v-.008zm2.25-2.25h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5v-.008z" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Workspace Management',
    items: [
      {
        to: '/projects',
        label: 'Projects',
        icon: (
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
          </svg>
        ),
      },
      {
        to: '/employees',
        label: 'Employees & Team',
        icon: (
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'Administration',
    items: [
      {
        to: '/plans',
        label: 'Subscription Plans',
        icon: (
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
          </svg>
        ),
      },
      {
        to: '/settings',
        label: 'Settings',
        icon: (
          <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        ),
      },
    ],
  },
];

function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, organisation, organisations, activeOrgId, switchOrganisation, currentRole, isAuthenticated, logout } = useAuth();
  const [showOrgPicker, setShowOrgPicker] = useState(false);

  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'TF';

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs transition-opacity md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[#1F2937] dark:border-[#1E293B] bg-[#111827] dark:bg-[#080D19] text-slate-300
          transition-transform duration-200 ease-in-out
          md:static md:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Top Branding */}
        <div className="flex h-16 items-center justify-between border-b border-[#1F2937] dark:border-[#1E293B] px-5">
          <Link
            to="/"
            className="flex items-center gap-2.5 group transition-opacity"
            title="Visit Public Landing Page"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2563EB] text-white shadow-md shadow-blue-500/20 group-hover:bg-[#1D4ED8] transition-colors">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m0 0L8.41 9.63m0 0A14.926 14.926 0 019.63 8.41" />
              </svg>
            </div>
            <div>
              <span className="text-base font-bold tracking-tight text-white">TeamFlow</span>
              <span className="block text-[10px] font-semibold tracking-wider text-blue-400 uppercase">
                Enterprise SaaS
              </span>
            </div>
          </Link>

          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-[#1F2937] hover:text-white md:hidden"
            aria-label="Close sidebar"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Workspace Switcher Card */}
        <div className="p-3 border-b border-[#1F2937] dark:border-[#1E293B]">
          <div className="relative">
            <button
              type="button"
              onClick={() => organisations?.length > 1 && setShowOrgPicker(!showOrgPicker)}
              className={`w-full flex items-center justify-between p-2 rounded-lg bg-[#1F2937]/70 dark:bg-[#111827]/80 border border-[#374151] dark:border-slate-800 hover:bg-[#1F2937] dark:hover:bg-[#111827] transition-all text-left ${
                organisations?.length > 1 ? 'cursor-pointer' : ''
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#2563EB] text-xs font-bold text-white shadow-xs">
                  {organisation?.name ? organisation.name.charAt(0).toUpperCase() : 'W'}
                </span>
                <div className="truncate">
                  <div className="text-xs font-semibold text-white truncate">
                    {organisation?.name || 'Active Workspace'}
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <span className="capitalize text-blue-400 font-medium">
                      {currentRole}
                    </span>
                    <span>•</span>
                    <span className="uppercase text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-300">
                      {organisation?.plan || 'Free'}
                    </span>
                  </div>
                </div>
              </div>
              {organisations?.length > 1 && (
                <svg className="h-4 w-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9" />
                </svg>
              )}
            </button>

            {/* Dropdown if multiple orgs */}
            {showOrgPicker && organisations?.length > 1 && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowOrgPicker(false)} />
                <div className="absolute left-0 right-0 top-full mt-1.5 rounded-lg border border-[#374151] bg-[#1F2937] p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Switch Workspace
                  </div>
                  {organisations.map((org) => {
                    const orgId = org.id || org._id;
                    const isCurrent = orgId?.toString() === activeOrgId?.toString();
                    return (
                      <button
                        key={orgId}
                        type="button"
                        onClick={() => {
                          switchOrganisation(orgId);
                          setShowOrgPicker(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md text-left transition-colors cursor-pointer ${
                          isCurrent
                            ? 'bg-[#2563EB] text-white font-semibold'
                            : 'text-slate-300 hover:bg-[#374151] hover:text-white'
                        }`}
                      >
                        <span className="truncate">{org.name}</span>
                        {isCurrent && <span className="text-[10px] ml-1">✓</span>}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Grouped Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {group.title}
              </p>
              <nav className="space-y-0.5 pt-1">
                {group.items.map((item) => {
                  const isActive = location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={onClose}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-[#2563EB] text-white font-semibold shadow-xs shadow-blue-600/30'
                          : 'text-slate-400 hover:bg-[#1F2937] hover:text-white'
                      }`}
                    >
                      <span className={isActive ? 'text-white' : 'text-slate-400'}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          ))}
        </div>

        {/* User Session Footer */}
        <div className="border-t border-[#1F2937] dark:border-[#1E293B] p-3">
          {isAuthenticated ? (
            <div className="flex items-center justify-between rounded-lg bg-[#1F2937]/50 dark:bg-[#111827]/60 p-2 border border-[#374151] dark:border-slate-800">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#2563EB]/20 text-xs font-bold text-blue-400 border border-blue-500/30">
                  {userInitials}
                </span>
                <div className="truncate">
                  <div className="text-xs font-medium text-white truncate">
                    {user?.name || 'User'}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {user?.email}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  onClose?.();
                  await logout();
                  navigate('/');
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-500/20 hover:text-rose-400 transition-colors cursor-pointer"
                title="Sign Out"
                aria-label="Sign Out"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="space-y-2 text-center">
              <Link
                to="/login"
                onClick={onClose}
                className="btn-primary w-full py-2 text-xs"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
