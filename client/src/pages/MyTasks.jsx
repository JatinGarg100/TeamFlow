import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchMyTasksApi, updateTaskStatusApi, getStoredAuth } from '../services/api';
import PaginationControls from '../components/PaginationControls';
import { useDebounce } from '../hooks/useDebounce';

/**
 * MyTasks
 * ───────
 * Personal task board displaying all tasks assigned to the current employee with:
 * - Server-side pagination & filtering
 * - Debounced keyword search
 * - Live task status updates (To Do -> In Progress -> Completed)
 * - Priority badges and due date indicators
 */
function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 6,
  });

  const [updatingTaskId, setUpdatingTaskId] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const auth = getStoredAuth();
  const user = auth?.user;

  const loadMyTasks = useCallback(async (pageToLoad = currentPage) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetchMyTasksApi({
        page: pageToLoad,
        limit: 6,
        status: statusFilter,
        priority: priorityFilter,
        search: debouncedSearch,
      });

      setTasks(res.tasks || []);
      setPagination(
        res.pagination || {
          currentPage: pageToLoad,
          totalPages: 1,
          totalItems: res.tasks?.length || 0,
          limit: 6,
        }
      );
    } catch (err) {
      console.error('Failed to load personal tasks:', err);
      setError(err.message || 'Failed to load your assigned tasks.');
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, priorityFilter, debouncedSearch]);

  useEffect(() => {
    setCurrentPage(1);
    loadMyTasks(1);
  }, [statusFilter, priorityFilter, debouncedSearch]);

  useEffect(() => {
    loadMyTasks(currentPage);
  }, [currentPage]);

  const handleStatusChange = async (taskId, newStatus) => {
    setUpdatingTaskId(taskId);
    try {
      await updateTaskStatusApi(taskId, newStatus);
      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t))
      );
      setFeedback({
        type: 'success',
        message: `Task marked as "${newStatus}". Project progress has been recalculated.`,
      });
      setTimeout(() => setFeedback({ type: '', message: '' }), 3500);
    } catch (err) {
      alert(`Could not update task: ${err.message}`);
    } finally {
      setUpdatingTaskId(null);
    }
  };

  const getPriorityStyle = (priority) => {
    switch (priority) {
      case 'High':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'Medium':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'Low':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8 max-w-6xl mx-auto">
      {/* ── Page Heading ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E202A] sm:text-3xl">
            My Tasks
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            All active project assignments assigned to {user?.name || 'you'}.
          </p>
        </div>

        <button
          onClick={loadMyTasks}
          title="Refresh task backlog"
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-xs font-semibold text-[#64748B] hover:bg-gray-50 hover:text-[#1E202A] transition-colors self-start sm:self-auto cursor-pointer"
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
          <span>{loading ? 'Refreshing...' : 'Refresh Tasks'}</span>
        </button>
      </div>

      {/* ── Status Feedback Banner ── */}
      {feedback.message && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-emerald-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback({ type: '', message: '' })}
            className="text-emerald-600 hover:text-emerald-900 font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Error Banner ── */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadMyTasks} className="btn-primary text-xs py-1 px-3">
            Retry
          </button>
        </div>
      )}

      {/* ── Search and Filter Controls ── */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <svg className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search my tasks by title or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:border-[#5B4BDB] text-slate-800"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Priority Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-[#5B4BDB] cursor-pointer"
          >
            <option value="">All Priorities</option>
            <option value="High">High Priority</option>
            <option value="Medium">Medium Priority</option>
            <option value="Low">Low Priority</option>
          </select>

          {(searchTerm || statusFilter || priorityFilter) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
                setPriorityFilter('');
              }}
              className="text-xs px-2.5 py-2 text-rose-600 hover:bg-rose-50 rounded-lg transition font-medium cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Status Filter Tabs ── */}
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] pb-3 text-xs">
        {[
          { label: 'All', value: '' },
          { label: 'To Do', value: 'To Do' },
          { label: 'In Progress', value: 'In Progress' },
          { label: 'Completed', value: 'Completed' },
        ].map((tab) => (
          <button
            key={tab.label}
            onClick={() => setStatusFilter(tab.value)}
            className={`rounded-lg px-3 py-1.5 font-semibold transition-all cursor-pointer ${
              statusFilter === tab.value
                ? 'bg-[#EEEDFD] text-[#5B4BDB]'
                : 'text-[#64748B] hover:bg-gray-100 hover:text-[#1E202A]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tasks List ── */}
      {loading && tasks.length === 0 ? (
        <div className="flex items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white p-12 text-sm text-[#64748B]">
          <div className="inline-flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#5B4BDB] border-t-transparent" />
            <span>Loading your assigned tasks...</span>
          </div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEEDFD] text-[#5B4BDB]">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="mt-3 text-base font-semibold text-[#1E202A]">No tasks found</h2>
          <p className="mt-1 text-xs text-[#64748B]">
            {statusFilter
              ? `You have no tasks matching status "${statusFilter}".`
              : searchTerm
              ? `No tasks matching "${searchTerm}".`
              : 'You currently have no tasks assigned to you. When a manager assigns you to a task, it will appear here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {tasks.map((task) => {
            const isUpdating = updatingTaskId === task._id;
            const project = task.projectId;
            const formattedDate = task.dueDate
              ? new Date(task.dueDate).toISOString().split('T')[0]
              : 'No due date';

            return (
              <div
                key={task._id}
                className="rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs hover:border-[#CBD5E1] transition-all flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${getPriorityStyle(
                        task.priority
                      )}`}
                    >
                      {task.priority} Priority
                    </span>

                    {project && (
                      <Link
                        to={`/projects/${project._id || project}`}
                        className="text-xs font-semibold text-[#5B4BDB] hover:underline"
                      >
                        📁 {project.name || 'Project'}
                      </Link>
                    )}
                  </div>

                  <h3 className="text-base font-bold text-[#1E202A] truncate">{task.title}</h3>

                  {task.description && (
                    <p className="text-xs text-[#64748B] line-clamp-2">{task.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-4 text-xs text-[#64748B] pt-1">
                    <span>📅 Due: {formattedDate}</span>
                    <span>
                      👥 Assignees: {Array.isArray(task.assignedTo) ? task.assignedTo.map((a) => a.name || 'Team member').join(', ') : 'You'}
                    </span>
                  </div>
                </div>

                {/* Status Switcher Buttons */}
                <div className="flex flex-col sm:items-end gap-2 shrink-0">
                  <span className="text-[11px] font-medium text-[#64748B]">Update Status:</span>
                  <div className="inline-flex rounded-lg border border-[#E2E8F0] p-0.5 bg-gray-50/80">
                    {['To Do', 'In Progress', 'Completed'].map((s) => {
                      const isActive = task.status === s;
                      return (
                        <button
                          key={s}
                          type="button"
                          disabled={isUpdating}
                          onClick={() => handleStatusChange(task._id, s)}
                          className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                            isActive
                              ? s === 'Completed'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : s === 'In Progress'
                                ? 'bg-[#5B4BDB] text-white shadow-xs'
                                : 'bg-gray-800 text-white shadow-xs'
                              : 'text-[#64748B] hover:text-[#1E202A]'
                          }`}
                        >
                          {s}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Pagination Controls ── */}
      {!loading && tasks.length > 0 && (
        <PaginationControls
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          limit={pagination.limit}
          onPageChange={(p) => setCurrentPage(p)}
          itemName="tasks"
        />
      )}
    </div>
  );
}

export default MyTasks;
