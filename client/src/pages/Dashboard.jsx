import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import StatCard from '../components/StatCard';
import ActivityFeed from '../components/ActivityFeed';
import { fetchDashboardApi, getStoredAuth } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * Dashboard Component
 * ───────────────────
 * Redesigned with Mixed Theme: Dark Navy branding + Electric Blue (#2563EB) accents.
 * Connected directly to GET /api/dashboard. Displays live employee counts,
 * projects, task breakdowns, completion meters, and real-time audit logs.
 */
function Dashboard() {
  const { user, organisation, activeOrgId, isAuthenticated } = useAuth();
  const auth = getStoredAuth();
  const isLoggedIn = isAuthenticated || Boolean(user && (auth?.token || auth?.user));
  const orgId = activeOrgId || organisation?.id || organisation?._id || auth?.organisation?.id || auth?.organisation?._id;

  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalProjects: 0,
    activeProjects: 0,
    totalTasks: 0,
    completedTasks: 0,
    inProgressTasks: 0,
    todoTasks: 0,
    pendingTasks: 0,
    overdueTasks: 0,
    completionPercentage: 0,
  });
  const [recentProjects, setRecentProjects] = useState([]);
  const [loading, setLoading] = useState(isLoggedIn);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadDashboardData = async () => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await fetchDashboardApi(orgId);
      if (data?.stats) {
        setStats(data.stats);
      }
      if (Array.isArray(data?.recentProjects)) {
        setRecentProjects(data.recentProjects);
      }
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error('[Dashboard] Error fetching live metrics:', err);
      setError(err.message || 'Unable to connect to the backend server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [orgId, isLoggedIn]);

  const completionRate = stats.totalTasks > 0
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : (stats.completionPercentage || 0);

  return (
    <div className="space-y-6 sm:space-y-8 font-sans">
      {/* ── Page Heading ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {isLoggedIn
              ? `Real-time analytics for ${auth?.organisation?.name || 'your organisation'} computed live from database.`
              : 'Overview of company metrics, project progress, and task completion.'}
          </p>
        </div>

        {isLoggedIn && (
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={loadDashboardData}
              title="Refresh statistics"
              disabled={loading}
              className="btn-secondary text-xs py-2 px-3 disabled:opacity-50"
            >
              <svg
                className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
              </svg>
              <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
            </button>

            <Link
              to="/projects"
              className="btn-primary text-xs py-2 px-3.5"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>New Project</span>
            </Link>
          </div>
        )}
      </div>

      {/* ── Error Banner ── */}
      {isLoggedIn && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm text-red-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-red-500 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span>{error}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {error.toLowerCase().includes('authentication') || error.toLowerCase().includes('sign in') ? (
              <Link
                to="/login"
                className="btn-primary py-1.5 px-3 text-xs"
              >
                Sign In
              </Link>
            ) : null}
            <button
              onClick={loadDashboardData}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ── 6 KPI Cards Grid ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* 1. Total Projects */}
        <StatCard
          title="Total Projects"
          value={loading ? '...' : stats.totalProjects}
          colorTheme="blue"
          subtitle={`${stats.activeProjects || 0} active`}
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          }
        />

        {/* 2. Total Tasks */}
        <StatCard
          title="Total Tasks"
          value={loading ? '...' : stats.totalTasks}
          colorTheme="indigo"
          subtitle="Work items"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          }
        />

        {/* 3. To Do Tasks */}
        <StatCard
          title="To Do"
          value={loading ? '...' : stats.todoTasks}
          colorTheme="slate"
          subtitle="Pending start"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        {/* 4. In Progress Tasks */}
        <StatCard
          title="In Progress"
          value={loading ? '...' : stats.inProgressTasks}
          colorTheme="amber"
          subtitle="In flight"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          }
        />

        {/* 5. Completed Tasks */}
        <StatCard
          title="Completed"
          value={loading ? '...' : stats.completedTasks}
          colorTheme="emerald"
          subtitle="Delivered"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        {/* 6. Overdue Tasks */}
        <StatCard
          title="Overdue"
          value={loading ? '...' : stats.overdueTasks}
          colorTheme="rose"
          subtitle="Needs attention"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          }
        />
      </div>

      {/* ── Task Progress Breakdown Card ── */}
      <div className="card-base p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Task Progress &amp; Completion Breakdown</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Aggregate status of all tasks across company projects</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">{completionRate}%</span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold">Completed</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="h-2.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
            {stats.totalTasks > 0 ? (
              <>
                <div
                  style={{ width: `${(stats.completedTasks / stats.totalTasks) * 100}%` }}
                  className="bg-emerald-500 transition-all duration-300"
                  title={`Completed: ${stats.completedTasks}`}
                />
                <div
                  style={{ width: `${(stats.inProgressTasks / stats.totalTasks) * 100}%` }}
                  className="bg-blue-600 transition-all duration-300"
                  title={`In Progress: ${stats.inProgressTasks}`}
                />
                <div
                  style={{ width: `${(stats.todoTasks / stats.totalTasks) * 100}%` }}
                  className="bg-slate-300 dark:bg-slate-600 transition-all duration-300"
                  title={`To Do: ${stats.todoTasks}`}
                />
              </>
            ) : (
              <div className="w-full bg-slate-200 dark:bg-slate-700" />
            )}
          </div>
        </div>

        {/* Breakdown Badges */}
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/60">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0"></span>
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] font-medium">Completed</p>
              <p className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">{stats.completedTasks}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 dark:bg-blue-500 shrink-0"></span>
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] font-medium">In Progress</p>
              <p className="font-bold text-blue-700 dark:text-blue-400 text-sm">{stats.inProgressTasks}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0"></span>
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] font-medium">To Do</p>
              <p className="font-bold text-slate-700 dark:text-slate-300 text-sm">{stats.todoTasks}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200/80 dark:border-rose-800/60">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0"></span>
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-[11px] font-medium">Overdue</p>
              <p className="font-bold text-rose-700 dark:text-rose-400 text-sm">{stats.overdueTasks}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content Grid: Recent Projects (Left) & Activity Feed (Right) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Recent Projects (7 cols on lg) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="card-base overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-6 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Recent Projects</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Milestones and automated completion metrics</p>
              </div>
              {isLoggedIn && (
                <Link
                  to="/projects"
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline transition-colors"
                >
                  View all projects →
                </Link>
              )}
            </div>

            {/* Scrollable table container */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5">Project Name</th>
                    <th className="px-6 py-3.5">Deadline</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Progress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading && recentProjects.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
                        <div className="inline-flex items-center gap-2">
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 dark:border-blue-500 border-t-transparent" />
                          <span>Loading real-time project metrics...</span>
                        </div>
                      </td>
                    </tr>
                  ) : recentProjects.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center">
                        <div className="mx-auto max-w-sm">
                          <svg className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                          </svg>
                          <p className="mt-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {isLoggedIn ? 'No projects created yet' : 'No active projects in preview'}
                          </p>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {isLoggedIn
                              ? 'Create your first project to automatically track progress and team tasks here.'
                              : 'Sign in to your organisation account or register to start creating projects.'}
                          </p>
                          <div className="mt-4">
                            <Link
                              to={isLoggedIn ? '/projects' : '/login'}
                              state={isLoggedIn ? { openCreate: true } : undefined}
                              className="btn-primary inline-flex text-xs py-2 px-4"
                            >
                              {isLoggedIn ? 'Create Project' : 'Sign In to Get Started'}
                            </Link>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    recentProjects.map((project) => {
                      const projectId = project.id || project._id;
                      const progress = Number(project.progress ?? 0);
                      const formattedDeadline = project.deadline
                        ? new Date(project.deadline).toISOString().split('T')[0]
                        : 'No deadline';

                      return (
                        <tr key={projectId} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="px-6 py-4 font-semibold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            <Link
                              to={`/projects/${projectId}`}
                              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            >
                              {project.name}
                            </Link>
                          </td>
                          <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {formattedDeadline}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <StatusBadge status={project.status} />
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                                <div
                                  className="h-full rounded-full bg-blue-600 transition-all duration-300"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                              <span className="w-8 text-right text-xs font-bold text-slate-800 dark:text-slate-200">
                                {progress}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column: Recent Activity Feed (5 cols on lg) */}
        <div className="lg:col-span-5">
          {isLoggedIn ? (
            <ActivityFeed
              orgId={orgId}
              title="Recent Activity"
              subtitle="Live company actions, milestones, and audit events"
              refreshTrigger={refreshKey}
            />
          ) : (
            <div className="card-base p-6 text-center py-12">
              <p className="text-sm font-semibold text-slate-900">Activity Feed</p>
              <p className="text-xs text-slate-500 mt-1">Sign in to view live team activities.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    Completed: 'badge-green',
    'In Progress': 'badge-blue',
    Planning: 'badge-amber',
    Pending: 'bg-slate-100 text-slate-600 border border-slate-200',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
        styles[status] || 'bg-slate-100 text-slate-600 border border-slate-200'
      }`}
    >
      {status}
    </span>
  );
}

export default Dashboard;
