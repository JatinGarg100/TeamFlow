import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Navbar
 * ──────
 * Top horizontal bar with workspace identification on the left.
 * Reactively subscribes to AuthContext for live user, organisation, and sign-out state.
 * If signed in: displays user name, email, initials avatar, and sign-out controls.
 * If guest: displays clear "Sign In" and "Register" actions.
 */
function Navbar({ onMenuClick }) {
  const navigate = useNavigate();
  const [showDropdown, setShowDropdown] = useState(false);
  const { user, organisation, isAuthenticated, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isLoggedIn = isAuthenticated;

  // Initials for avatar
  const initials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'TF';

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-[#E2E8F0] bg-white px-4 sm:px-6 lg:px-8">
      {/* Left: Mobile hamburger + Workspace details */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 md:hidden focus:outline-hidden"
          aria-label="Open navigation menu"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        {/* Workspace pill */}
        <div className="flex items-center gap-2 truncate">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#EEEDFD] text-xs font-bold text-[#5B4BDB]">
            {isLoggedIn && organisation?.name ? organisation.name.charAt(0).toUpperCase() : '🚀'}
          </span>
          <div className="truncate">
            <span className="text-xs font-semibold text-[#1E202A] sm:text-sm">
              {isLoggedIn && organisation?.name ? organisation.name : 'TeamFlow Workspace'}
            </span>
            <span className="hidden text-xs text-[#64748B] sm:inline">
              {isLoggedIn ? ' • Active Workspace' : ' • Guest Preview'}
            </span>
          </div>
        </div>
      </div>

      {/* Right side: Authenticated user controls OR Guest login/register actions */}
      <div className="flex items-center gap-2.5">
        {!isLoggedIn ? (
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="rounded-xl border border-[#E2E8F0] px-3.5 py-1.5 text-xs font-semibold text-[#1E202A] hover:bg-gray-50 transition-colors"
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="btn-primary text-xs py-1.5 px-3.5"
            >
              Register
            </Link>
          </div>
        ) : (
          <div className="relative shrink-0">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-3 rounded-xl p-1.5 transition-colors hover:bg-gray-50 focus:outline-hidden cursor-pointer"
              aria-haspopup="true"
              aria-expanded={showDropdown}
            >
              <div className="hidden text-right sm:block">
                <p className="text-xs font-semibold text-[#1E202A] leading-tight">{user.name}</p>
                <p className="text-[11px] text-[#64748B] leading-tight">{user.email}</p>
              </div>

              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#5B4BDB] text-xs font-semibold text-white shadow-xs">
                {initials}
              </div>

              <svg className="h-4 w-4 text-[#64748B] hidden sm:block" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {/* Profile menu dropdown */}
            {showDropdown && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowDropdown(false)}
                />
                <div className="absolute right-0 mt-2 w-52 rounded-xl border border-[#E2E8F0] bg-white py-1.5 shadow-lg z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="border-b border-[#E2E8F0] px-4 py-2 sm:hidden">
                    <p className="text-xs font-semibold text-[#1E202A]">{user.name}</p>
                    <p className="text-[11px] text-[#64748B]">{user.email}</p>
                  </div>

                  <div className="px-3 py-1.5 text-[11px] font-medium text-[#64748B] capitalize">
                    Role: {organisation?.role || 'Member'}
                  </div>

                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 px-4 py-2 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 cursor-pointer"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                    </svg>
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}

export default Navbar;
