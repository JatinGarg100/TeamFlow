import { NavLink, useNavigate, Link } from 'react-router-dom';
import { logoutUser, getStoredAuth } from '../services/api';

/**
 * Sidebar
 * ───────
 * Left navigation bar for desktop (256px wide) and collapsible drawer on mobile.
 * Uses a clean purple theme with consistent SVG iconography and spacing.
 */

// Consistent navigation items with clean SVG icons
const navItems = [
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
    to: '/employees',
    label: 'Employees',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
  },
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
    to: '/plans',
    label: 'Subscription Plans',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
      </svg>
    ),
  },
];

function Sidebar({ isOpen, onClose }) {
  const navigate = useNavigate();

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-gray-900/40 backdrop-blur-xs transition-opacity md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar surface */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[#E2E8F0] bg-white
          transition-transform duration-200 ease-in-out
          md:static md:translate-x-0
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Brand header */}
        <div className="flex h-16 items-center justify-between border-b border-[#E2E8F0] px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#5B4BDB] text-white shadow-sm">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m0 0L8.41 9.63m0 0A14.926 14.926 0 019.63 8.41" />
              </svg>
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-[#1E202A]">TeamFlow</span>
              <span className="block text-[10px] font-medium tracking-wide text-[#64748B] uppercase">SaaS Suite</span>
            </div>
          </div>

          {/* Close button for mobile */}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 md:hidden"
            aria-label="Close sidebar"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 overflow-y-auto px-3 py-6">
          <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-[#64748B]">
            Navigation
          </p>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-[#EEEDFD] text-[#5B4BDB] font-semibold'
                      : 'text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#1E202A]'
                  }`
                }
              >
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Authentication controls: User session OR Guest sign-in prompt */}
        <div className="border-t border-[#E2E8F0] p-4 space-y-3">
          {getStoredAuth()?.token ? (
            <>
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F7F8FC] p-3 text-xs">
                <div className="flex items-center gap-2 font-medium text-[#1E202A]">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                  <span>TeamFlow SaaS Active</span>
                </div>
                <p className="mt-1 text-[11px] text-[#64748B]">
                  MongoDB Atlas &amp; Express API connected.
                </p>
              </div>

              <button
                onClick={async () => {
                  onClose?.();
                  await logoutUser();
                  navigate('/login');
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2 text-sm font-medium text-[#64748B] transition-colors hover:bg-red-50 hover:text-red-600 cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                <span>Sign Out</span>
              </button>
            </>
          ) : (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F7F8FC] p-3.5 text-xs text-center space-y-2.5">
              <p className="font-semibold text-[#1E202A]">Welcome to TeamFlow</p>
              <p className="text-[11px] text-[#64748B]">
                Sign in to manage projects, or register a new workspace.
              </p>
              <div className="flex flex-col gap-1.5 pt-1">
                <Link
                  to="/login"
                  onClick={onClose}
                  className="rounded-lg bg-[#5B4BDB] py-2 text-xs font-semibold text-white hover:bg-[#4A3ABF] transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  to="/register"
                  onClick={onClose}
                  className="rounded-lg border border-[#E2E8F0] bg-white py-1.5 text-[11px] font-semibold text-[#1E202A] hover:bg-gray-50 transition-colors"
                >
                  Create New Account
                </Link>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
