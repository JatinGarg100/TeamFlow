import { useState, useEffect, useCallback } from 'react';
import { fetchActivityLogsApi } from '../services/api';

/**
 * ActivityFeed Component
 * ----------------------
 * Reusable activity timeline displaying user actions, milestones, and collaboration events.
 * Supports filtering by organisation and/or project.
 */
export default function ActivityFeed({
  projectId = null,
  orgId = null,
  title = 'Project Activity Timeline',
  subtitle = 'Audit trail of recent updates, task completions, and team collaboration',
  refreshTrigger = 0,
}) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadActivities = useCallback(
    async (targetPage = 1, append = false) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError('');

      try {
        const res = await fetchActivityLogsApi({
          projectId,
          orgId,
          page: targetPage,
          limit: 15,
        });

        const list = res.activities || [];
        setActivities((prev) => (append ? [...prev, ...list] : list));
        setHasMore(res.pagination?.hasNextPage || false);
        setPage(targetPage);
      } catch (err) {
        setError(err.message || 'Failed to load activity logs.');
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [projectId, orgId]
  );

  useEffect(() => {
    loadActivities(1, false);
  }, [loadActivities, refreshTrigger]);

  // Relative time helper
  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const seconds = Math.floor((now - date) / 1000);

      if (seconds < 60) return 'Just now';
      const minutes = Math.floor(seconds / 60);
      if (minutes < 60) return `${minutes}m ago`;
      const hours = Math.floor(minutes / 60);
      if (hours < 24) return `${hours}h ago`;
      const days = Math.floor(hours / 24);
      if (days < 7) return `${days}d ago`;

      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  // Activity Icon & Color Mapper
  const getActivityStyle = (action) => {
    switch (action) {
      case 'TASK_COMPLETED':
        return {
          icon: (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M5 13l4 4L19 7" />
            </svg>
          ),
          bg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
        };
      case 'TASK_STATUS_CHANGED':
        return {
          icon: (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          ),
          bg: 'bg-blue-50 text-blue-600 border-blue-200',
        };
      case 'TASK_CREATED':
      case 'PROJECT_CREATED':
        return {
          icon: (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
            </svg>
          ),
          bg: 'bg-blue-50 text-blue-600 border-blue-200',
        };
      case 'TASK_ASSIGNED':
      case 'MEMBER_ADDED_TO_PROJECT':
        return {
          icon: (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          ),
          bg: 'bg-purple-50 text-purple-600 border-purple-200',
        };
      case 'COMMENT_ADDED':
        return {
          icon: (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          ),
          bg: 'bg-amber-50 text-amber-600 border-amber-200',
        };
      case 'TASK_DELETED':
      case 'PROJECT_DELETED':
        return {
          icon: (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          ),
          bg: 'bg-red-50 text-red-600 border-red-200',
        };
      default:
        return {
          icon: (
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ),
          bg: 'bg-gray-100 text-gray-600 border-gray-200',
        };
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-xs">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
          {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={() => loadActivities(1, false)}
          disabled={loading}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-500 dark:text-slate-400 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer disabled:opacity-50"
          title="Refresh activity logs"
        >
          <svg
            className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/50 p-3 text-xs text-red-700 dark:text-red-300">
          <span>{error}</span>
          <button
            onClick={() => loadActivities(1, false)}
            className="font-semibold underline ml-2 cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* Timeline List */}
      <div className="mt-5">
        {loading && activities.length === 0 ? (
          <div className="flex items-center justify-center py-10 text-xs text-slate-500 dark:text-slate-400">
            <svg className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400 mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <span>Loading recent activity...</span>
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-10">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="mt-2 text-xs font-semibold text-slate-900 dark:text-slate-100">No activity recorded yet</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Activities will appear here automatically when tasks are updated, created, or commented on.
            </p>
          </div>
        ) : (
          <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            {activities.map((act) => {
              const { icon, bg } = getActivityStyle(act.action);
              const userInitial = (act.userName || 'U').charAt(0).toUpperCase();

              return (
                <div key={act._id} className="relative flex items-start gap-3">
                  {/* Timeline Node Badge */}
                  <div
                    className={`absolute -left-6 flex h-5 w-5 items-center justify-center rounded-full border shadow-2xs ${bg}`}
                  >
                    {icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline justify-between gap-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-900/60 text-[9px] font-bold text-blue-600 dark:text-blue-300">
                          {userInitial}
                        </span>
                        <p className="text-xs text-slate-900 dark:text-slate-100 leading-snug">
                          {act.description}
                        </p>
                      </div>
                      <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {formatTimeAgo(act.createdAt)}
                      </span>
                    </div>

                    {/* Metadata tags */}
                    {(act.taskTitle || act.projectName) && (
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px]">
                        {act.projectName && (
                          <span className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-1.5 py-0.5 text-slate-600 dark:text-slate-300">
                            📁 {act.projectName}
                          </span>
                        )}
                        {act.taskTitle && (
                          <span className="inline-flex items-center rounded-md border border-blue-100 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 text-blue-600 dark:text-blue-400 font-medium">
                            ✓ {act.taskTitle}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load More Button */}
        {hasMore && (
          <div className="mt-6 text-center pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => loadActivities(page + 1, true)}
              className="btn-secondary text-xs py-1.5 px-4 cursor-pointer disabled:opacity-50"
            >
              {loadingMore ? 'Loading more...' : 'Load older activities'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
