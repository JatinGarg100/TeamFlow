import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
} from '../services/api';
import { ThemeToggle, ThemeSegmentedControl } from './ThemeToggle';

/**
 * Navbar Component
 * ────────────────
 * Top horizontal app header with page breadcrumbs, workspace identifier,
 * and user profile menu.
 */
function Navbar({ onMenuClick }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [showDropdown, setShowDropdown] = useState(false);
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const { user, organisation, organisations, activeOrgId, switchOrganisation, currentRole, isAuthenticated, logout } = useAuth();

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      setLoadingNotifications(true);
      const res = await fetchNotificationsApi({ orgId: activeOrgId, limit: 15 });
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (err) {
      console.warn('Failed to load notifications:', err.message);
    } finally {
      setLoadingNotifications(false);
    }
  }, [isAuthenticated, activeOrgId]);

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 30000);
    return () => clearInterval(timer);
  }, [loadNotifications]);

  const handleMarkAsRead = async (notification) => {
    try {
      if (!notification.read) {
        await markNotificationReadApi(notification._id);
        setNotifications((prev) =>
          prev.map((n) => (n._id === notification._id ? { ...n, read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      }
      if (notification.link) {
        setShowNotifications(false);
        navigate(notification.link);
      }
    } catch (err) {
      console.warn('Failed to mark notification as read:', err.message);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await markAllNotificationsReadApi(activeOrgId);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Failed to mark all notifications as read:', err.message);
    }
  };

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return 'Just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  // Resolve human-readable page title
  const getPageTitle = (pathname) => {
    if (pathname.startsWith('/dashboard')) return 'Dashboard Overview';
    if (pathname.startsWith('/projects/')) return 'Project Details';
    if (pathname.startsWith('/projects')) return 'Projects';
    if (pathname.startsWith('/my-tasks')) return 'My Tasks';
    if (pathname.startsWith('/employees')) return 'Team & Employees';
    if (pathname.startsWith('/plans')) return 'Subscription Plans & Quotas';
    if (pathname.startsWith('/settings')) return 'Organisation Settings';
    return 'TeamFlow Workspace';
  };

  const userInitials = user?.name
    ? user.name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'TF';

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#111827]/95 px-4 sm:px-6 lg:px-8 backdrop-blur-xs transition-colors duration-150">
      {/* Left: Mobile Toggle + Page Title / Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuClick}
          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden focus:outline-hidden cursor-pointer"
          aria-label="Open navigation menu"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
          </svg>
        </button>

        <div className="flex items-center gap-2 truncate">
          {organisations?.length > 1 ? (
            <div className="relative hidden sm:block">
              <button
                type="button"
                onClick={() => setShowOrgDropdown(!showOrgDropdown)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/80 px-2.5 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                title="Switch Workspace"
              >
                <span className="flex h-4 w-4 items-center justify-center rounded bg-blue-600 text-[10px] font-bold text-white">
                  {organisation?.name ? organisation.name.charAt(0).toUpperCase() : 'W'}
                </span>
                <span className="truncate max-w-[130px]">{organisation?.name || 'Workspace'}</span>
                <svg className="h-3 w-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>

              {showOrgDropdown && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowOrgDropdown(false)} />
                  <div className="absolute left-0 mt-1.5 w-56 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] py-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Switch Workspace
                    </div>
                    {organisations.map((org) => {
                      const oId = org.id || org._id;
                      const isCurrent = oId?.toString() === activeOrgId?.toString();
                      return (
                        <button
                          key={oId}
                          type="button"
                          onClick={() => {
                            switchOrganisation(oId);
                            setShowOrgDropdown(false);
                          }}
                          className={`flex w-full items-center justify-between px-3 py-2 text-xs text-left transition-colors cursor-pointer ${
                            isCurrent
                              ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                          }`}
                        >
                          <span className="truncate">{org.name}</span>
                          {isCurrent && <span className="text-[11px] font-bold text-blue-600 dark:text-blue-400">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          ) : (
            <span className="hidden sm:inline-block text-xs font-medium text-slate-600 dark:text-slate-400">
              {organisation?.name || 'Workspace'}
            </span>
          )}
          <span className="hidden sm:inline-block text-slate-400 dark:text-slate-600">/</span>
          <h1 className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
            {getPageTitle(location.pathname)}
          </h1>
        </div>
      </div>

      {/* Right: User Context & Dropdown */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Workspace Plan Badge */}
        {organisation?.plan && (
          <span className="hidden sm:inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 uppercase">
            {organisation.plan} Plan
          </span>
        )}

        {/* Quick Theme Toggle Button */}
        <ThemeToggle />

        {isAuthenticated && (
          <>
            {/* Notification Bell */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer focus:outline-hidden"
                aria-label="Notifications"
                title="Notifications"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                  />
                </svg>

                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold text-white shadow-xs animate-pulse">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Popover Dropdown */}
              {showNotifications && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                  <div className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-xs sm:max-w-none sm:w-96 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                    <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 px-4 py-3 bg-slate-50/70 dark:bg-slate-800/50">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">Notifications</h3>
                        {unreadCount > 0 && (
                          <span className="rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-1.5 py-0.2 text-[10px] font-bold">
                            {unreadCount} new
                          </span>
                        )}
                      </div>
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllAsRead}
                          className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors cursor-pointer"
                        >
                          Mark all as read
                        </button>
                      )}
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                      {loadingNotifications && notifications.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-500">
                          <div className="mx-auto h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2" />
                          Loading notifications...
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="p-8 text-center">
                          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 mb-2">
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                            </svg>
                          </div>
                          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">No notifications yet</p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            You're all caught up with your workspace activities.
                          </p>
                        </div>
                      ) : (
                        notifications.map((n) => {
                          const isUnread = !n.read;
                          return (
                            <div
                              key={n._id}
                              onClick={() => handleMarkAsRead(n)}
                              className={`p-3.5 flex items-start gap-3 transition-colors cursor-pointer border-b border-slate-100 dark:border-slate-800/80 last:border-0 ${
                                isUnread
                                  ? 'bg-blue-50/40 dark:bg-blue-950/30 hover:bg-blue-50/70 dark:hover:bg-blue-900/40'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/60'
                              }`}
                            >
                              <div className="shrink-0 mt-0.5">
                                {n.type === 'TASK_ASSIGNED' ? (
                                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                  </span>
                                ) : n.type === 'TASK_STATUS_CHANGED' ? (
                                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                                    </svg>
                                  </span>
                                ) : n.type === 'PROJECT_UPDATED' ? (
                                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300">
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                                    </svg>
                                  </span>
                                ) : (
                                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.765z" />
                                    </svg>
                                  </span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1">
                                  <p className={`text-xs ${isUnread ? 'font-bold text-slate-900 dark:text-slate-100' : 'font-medium text-slate-700 dark:text-slate-300'}`}>
                                    {n.title}
                                  </p>
                                  <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                    {formatTimeAgo(n.createdAt)}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                                  {n.message}
                                </p>
                              </div>
                              {isUnread && (
                                <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600 dark:bg-blue-500 mt-1" />
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Profile Menu */}
            <div className="relative">
            <button
              type="button"
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center gap-2.5 rounded-xl p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer focus:outline-hidden"
              aria-label="User profile options"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white shadow-xs">
                {userInitials}
              </span>
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100 leading-tight">
                  {user?.name || 'User'}
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">
                  {currentRole}
                </span>
              </div>
              <svg className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 hidden sm:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </button>

            {/* Profile Dropdown */}
            {showDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
                <div className="absolute right-0 mt-2 w-60 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] py-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                  <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">{user?.name}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{user?.email}</p>
                    <span className="mt-1.5 inline-block text-[10px] uppercase font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/40 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                      Role: {currentRole}
                    </span>
                  </div>

                  {/* Theme Mode Switcher in Profile Menu */}
                  <div className="px-3.5 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Theme
                    </span>
                    <ThemeSegmentedControl />
                  </div>

                  <div className="py-1">
                    {organisations?.length > 1 && (
                      <div className="border-b border-slate-100 dark:border-slate-800 pb-1 mb-1">
                        <div className="px-3.5 py-1 text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500">
                          Workspaces ({organisations.length})
                        </div>
                        {organisations.map((org) => {
                          const oId = org.id || org._id;
                          const isCurrent = oId?.toString() === activeOrgId?.toString();
                          return (
                            <button
                              key={oId}
                              type="button"
                              onClick={() => {
                                switchOrganisation(oId);
                                setShowDropdown(false);
                              }}
                              className={`flex w-full items-center justify-between px-3.5 py-1.5 text-xs text-left cursor-pointer transition-colors ${
                                isCurrent
                                  ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-semibold'
                                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                              }`}
                            >
                              <span className="truncate">{org.name}</span>
                              {isCurrent && <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">Active</span>}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <Link
                      to="/"
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-2 px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      <svg className="h-4 w-4 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                      </svg>
                      <span>Public Landing Page</span>
                    </Link>

                    <Link
                      to="/settings"
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-2 px-3.5 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      <svg className="h-4 w-4 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>Organisation Settings</span>
                    </Link>
                  </div>

                  <div className="border-t border-slate-100 dark:border-slate-800 pt-1">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-3.5 py-2 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                      </svg>
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          </>
        )}
      </div>
    </header>
  );
}

export default Navbar;
