import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import StatCard from '../components/StatCard';
import { fetchDashboardApi, getStoredAuth } from '../services/api';

/**
 * Dashboard
 * ─────────
 * Fully dynamic dashboard connected to MongoDB via GET /api/dashboard.
 * Displays live employee counts, projects, and task milestones.
 */
function Dashboard() {
  const navigate = useNavigate();
  const auth = getStoredAuth();
  const isLoggedIn = Boolean(auth?.token && auth?.user);
  const orgId = auth?.organisation?.id;

  const [stats, setStats] = useState({
    totalEmployees: 0,
    totalProjects: 0,
    activeProjects: 0,
    pendingTasks: 0,
    completedTasks: 0,
    totalTasks: 0,
  });
  const [recentProjects, setRecentProjects] = useState([]);
  const [loading, setLoading] = useState(isLoggedIn);
  const [error, setError] = useState(null);

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

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* ── Page Heading ── */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E202A] sm:text-3xl">
            Dashboard
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            {isLoggedIn
              ? `Real-time metrics for ${auth?.organisation?.name || 'your organisation'} computed directly from MongoDB.`
              : 'Overview of company metrics, project progress, and task completion.'}
          </p>
        </div>

        {isLoggedIn && (
          <div className="mt-2 sm:mt-0 flex items-center gap-3">
            <button
              onClick={loadDashboardData}
              title="Refresh statistics"
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#64748B] hover:bg-gray-50 hover:text-[#1E202A] transition-colors disabled:opacity-50 cursor-pointer"
            >
              <svg
                className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`}
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
              className="btn-primary"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>New Project</span>
            </Link>
          </div>
        )}
      </div>

      {/* ── Error Banner (shown only on network/server errors for logged-in users) ── */}
      {isLoggedIn && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
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
                className="rounded-lg bg-[#5B4BDB] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#4A3ABF] transition-colors"
              >
                Sign In
              </Link>
            ) : null}
            <button
              onClick={loadDashboardData}
              className="rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* ── Statistic Cards Grid (1 col mobile, 2 col tablet, 4 col desktop) ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-5">
        <StatCard
          title="Total Employees"
          value={loading ? '...' : stats.totalEmployees}
          colorTheme="blue"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
            </svg>
          }
        />

        <StatCard
          title="Total Projects"
          value={loading ? '...' : stats.totalProjects}
          colorTheme="purple"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          }
        />

        <StatCard
          title="Pending Tasks"
          value={loading ? '...' : stats.pendingTasks}
          colorTheme="amber"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />

        <StatCard
          title="Completed Tasks"
          value={loading ? '...' : stats.completedTasks}
          colorTheme="emerald"
          icon={
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      </div>

      {/* ── Recent Projects Table Card ── */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#E2E8F0] px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-[#1E202A]">Recent Projects</h2>
            <p className="text-xs text-[#64748B]">Live milestones and automated task-derived progress</p>
          </div>
          {isLoggedIn && (
            <Link
              to="/projects"
              className="text-xs font-semibold text-[#5B4BDB] hover:text-[#4A3ABF] transition-colors"
            >
              View all projects →
            </Link>
          )}
        </div>

        {/* Scrollable table container */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-wider text-[#64748B] border-b border-[#E2E8F0]">
              <tr>
                <th className="px-6 py-3.5">Project Name</th>
                <th className="px-6 py-3.5">Deadline</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Progress</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2E8F0]">
              {loading && recentProjects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-[#64748B]">
                    <div className="inline-flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#5B4BDB] border-t-transparent" />
                      <span>Loading real-time project metrics...</span>
                    </div>
                  </td>
                </tr>
              ) : recentProjects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="mx-auto max-w-sm">
                      <svg className="mx-auto h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <p className="mt-2 text-sm font-medium text-[#1E202A]">
                        {isLoggedIn ? 'No projects created yet' : 'No active projects in preview'}
                      </p>
                      <p className="mt-1 text-xs text-[#64748B]">
                        {isLoggedIn
                          ? 'Create your first project to automatically track progress and team tasks here.'
                          : 'Sign in to your organisation account or register to start creating projects.'}
                      </p>
                      <div className="mt-4">
                        <Link
                          to={isLoggedIn ? '/projects' : '/login'}
                          className="btn-primary inline-flex text-xs"
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
                    <tr key={projectId} className="hover:bg-[#F8FAFC]/80 transition-colors">
                      <td className="px-6 py-4 font-medium text-[#1E202A] whitespace-nowrap">
                        <Link
                          to={`/projects/${projectId}`}
                          className="hover:text-[#5B4BDB] transition-colors"
                        >
                          {project.name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-xs text-[#64748B] whitespace-nowrap">
                        {formattedDeadline}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={project.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="h-2 w-28 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="h-full rounded-full bg-[#5B4BDB] transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="w-8 text-right text-xs font-medium text-[#1E202A]">
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
  );
}

function StatusBadge({ status }) {
  const styles = {
    Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'In Progress': 'bg-[#EEEDFD] text-[#5B4BDB] border-[#DCD9FA]',
    Planning: 'bg-amber-50 text-amber-700 border-amber-200',
    Pending: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
        styles[status] || 'bg-gray-100 text-gray-600 border-gray-200'
      }`}
    >
      {status}
    </span>
  );
}

export default Dashboard;
