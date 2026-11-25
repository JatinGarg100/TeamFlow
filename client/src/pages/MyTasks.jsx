import { useState, useEffect, useCallback, useTransition } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchMyTasksApi, updateTaskStatusApi, fetchOrgMembers } from '../services/api';
import TaskAttachmentsModal from '../components/TaskAttachmentsModal';
import TaskCommentsModal from '../components/TaskCommentsModal';
import { Link } from 'react-router-dom';

/**
 * MyTasks Page — Premium SaaS Mixed Theme
 * ───────────────────────────────────────
 * - Real-time filtering by status, priority, due date & assignees
 * - Overdue task alerts with pulsating warning badges
 * - Instant status transitions (To Do ➔ In Progress ➔ Completed)
 * - Modal overlays for comments and attachments
 * - Clean Electric Blue and crisp slate cards
 */
const MyTasks = () => {
  const { activeOrgId, isManager } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [, startTransition] = useTransition();

  // Filters state
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedPriority, setSelectedPriority] = useState('ALL');
  const [selectedDueDate, setSelectedDueDate] = useState('ALL'); // 'ALL' | 'upcoming' | 'past_due' | 'overdue'
  const [selectedAssignee, setSelectedAssignee] = useState('me'); // 'me' | 'all' | memberId
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalTasks, setTotalTasks] = useState(0);

  // Org members for manager assignee filter
  const [orgMembers, setOrgMembers] = useState([]);

  // Modals
  const [attachmentTask, setAttachmentTask] = useState(null);
  const [commentTask, setCommentTask] = useState(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load org members if manager
  useEffect(() => {
    const loadMembers = async () => {
      if (!isManager || !activeOrgId) return;
      try {
        const res = await fetchOrgMembers(activeOrgId, { limit: 100 });
        if (res && res.members) {
          setOrgMembers(res.members);
        } else if (Array.isArray(res)) {
          setOrgMembers(res);
        }
      } catch (err) {
        console.error('Failed to load org members for task filtering', err);
      }
    };
    loadMembers();
  }, [isManager, activeOrgId]);

  const loadTasks = useCallback(async () => {
    if (!activeOrgId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const params = {
        page,
        limit: 10,
        search: debouncedSearch.trim() || undefined,
        orgId: activeOrgId,
      };

      if (selectedStatus !== 'ALL') {
        params.status = selectedStatus;
      }

      if (selectedPriority !== 'ALL') {
        params.priority = selectedPriority;
      }

      if (selectedDueDate !== 'ALL') {
        if (selectedDueDate === 'overdue') {
          params.overdue = 'true';
        } else {
          params.dueDateFilter = selectedDueDate;
        }
      }

      if (isManager) {
        if (selectedAssignee !== 'me') {
          params.assignedTo = selectedAssignee;
        }
      }

      const data = await fetchMyTasksApi(params);
      startTransition(() => {
        setTasks(data.tasks || []);
        setTotalPages(data.pagination?.totalPages || 1);
        setTotalTasks(data.pagination?.totalItems ?? data.pagination?.total ?? (data.tasks ? data.tasks.length : 0));
      });
    } catch (err) {
      setError(err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, page, debouncedSearch, selectedStatus, selectedPriority, selectedDueDate, selectedAssignee, isManager]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleStatusUpdate = async (taskId, newStatus) => {
    try {
      setUpdatingId(taskId);
      await updateTaskStatusApi(taskId, newStatus);
      // Optimistic / fast update in local state
      setTasks((prev) =>
        prev.map((t) => ((t._id || t.id) === taskId ? { ...t, status: newStatus } : t))
      );
    } catch (err) {
      alert(err.message || 'Failed to update task status');
    } finally {
      setUpdatingId(null);
    }
  };

  const handleResetFilters = () => {
    setSelectedStatus('ALL');
    setSelectedPriority('ALL');
    setSelectedDueDate('ALL');
    setSelectedAssignee('me');
    setSearchQuery('');
    setDebouncedSearch('');
    setPage(1);
  };

  const hasActiveFilters =
    selectedStatus !== 'ALL' ||
    selectedPriority !== 'ALL' ||
    selectedDueDate !== 'ALL' ||
    selectedAssignee !== 'me' ||
    searchQuery.trim() !== '';

  const isTaskOverdue = (task) => {
    if (!task.dueDate) return false;
    return task.status !== 'Completed' && new Date(task.dueDate) < new Date();
  };

  const getPriorityBadgeClass = (priority) => {
    switch (priority) {
      case 'High':
        return 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60';
      case 'Medium':
        return 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60';
      case 'Low':
        return 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'Completed':
        return 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60';
      case 'In Progress':
        return 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60';
      case 'To Do':
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">Tasks</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {isManager
              ? 'Manage, filter, and monitor tasks across your organisation'
              : 'Tasks assigned to you across projects'}
          </p>
        </div>
        <div className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 px-3.5 py-2 rounded-xl shadow-xs flex items-center gap-2 self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-500"></span>
          <span>Total Tasks: <strong className="font-semibold text-slate-900 dark:text-slate-100">{totalTasks}</strong></span>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white dark:bg-[#111827] p-4 sm:p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <svg
              className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search tasks by title or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900 rounded-lg text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:bg-white dark:focus:bg-[#0B1120] focus:outline-hidden focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 focus:border-blue-600 transition-all"
            />
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={selectedPriority}
              onChange={(e) => {
                setSelectedPriority(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 focus:border-blue-600 cursor-pointer"
            >
              <option value="ALL">All Priorities</option>
              <option value="High">High Priority</option>
              <option value="Medium">Medium Priority</option>
              <option value="Low">Low Priority</option>
            </select>
          </div>

          {/* Due Date / Overdue Filter */}
          <div>
            <select
              value={selectedDueDate}
              onChange={(e) => {
                setSelectedDueDate(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 focus:border-blue-600 cursor-pointer"
            >
              <option value="ALL">All Due Dates</option>
              <option value="upcoming">Upcoming</option>
              <option value="past_due">Past Due</option>
              <option value="overdue">⚠️ Overdue Only</option>
            </select>
          </div>

          {/* Assignee Filter (Managers only) or Reset */}
          {isManager ? (
            <div>
              <select
                value={selectedAssignee}
                onChange={(e) => {
                  setSelectedAssignee(e.target.value);
                  setPage(1);
                }}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 focus:border-blue-600 cursor-pointer"
              >
                <option value="me">Assigned to Me</option>
                <option value="all">All Team Members</option>
                {orgMembers.map((m) => {
                  const u = m.user || m;
                  return (
                    <option key={u._id || m._id} value={u._id || m._id}>
                      {u.name || u.email}
                    </option>
                  );
                })}
              </select>
            </div>
          ) : (
            <div className="flex items-center justify-end">
              {hasActiveFilters && (
                <button
                  onClick={handleResetFilters}
                  className="w-full py-2 px-3 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg font-medium transition-colors cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          )}
        </div>

        {/* Status Tabs and Quick Reset */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {['ALL', 'To Do', 'In Progress', 'Completed'].map((status) => (
              <button
                key={status}
                onClick={() => {
                  setSelectedStatus(status);
                  setPage(1);
                }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  selectedStatus === status
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {status === 'ALL' ? 'All Status' : status}
              </button>
            ))}
          </div>

          {isManager && hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold cursor-pointer"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center justify-between shadow-xs">
          <span>{error}</span>
          <button
            onClick={loadTasks}
            className="btn-danger text-xs py-1 px-3"
          >
            Retry
          </button>
        </div>
      )}

      {/* Tasks List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs">
          <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-[#111827] rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mx-auto flex items-center justify-center mb-3">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">No tasks found</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
            {hasActiveFilters
              ? 'Try adjusting your filters or search terms to find what you are looking for.'
              : 'There are currently no tasks assigned.'}
          </p>
          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="mt-4 btn-secondary text-xs"
            >
              Reset all filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => {
            const taskId = task._id || task.id;
            const overdue = isTaskOverdue(task);
            const attachmentsCount = task.attachments ? task.attachments.length : 0;

            return (
              <div
                key={taskId}
                className={`bg-white dark:bg-[#111827] rounded-xl border p-4 sm:p-5 transition-shadow hover:shadow-xs ${
                  overdue ? 'border-red-300 dark:border-red-900/80 bg-red-50/20 dark:bg-red-950/20' : 'border-slate-200 dark:border-slate-800'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${getStatusBadgeClass(task.status)}`}>
                        {task.status}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${getPriorityBadgeClass(task.priority)}`}>
                        {task.priority || 'Medium'}
                      </span>
                      {overdue && (
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-600 text-white animate-pulse">
                          Overdue
                        </span>
                      )}
                      {task.project && (
                        <Link
                          to={`/projects/${task.project._id || task.project}`}
                          className="text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full transition-colors border border-blue-200/50 dark:border-blue-800/60"
                        >
                          📁 {task.project.name || 'View Project'}
                        </Link>
                      )}
                    </div>

                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 pt-0.5 break-words">
                      {task.title}
                    </h3>

                    {task.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                        {task.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 dark:text-slate-400 pt-1">
                      {task.dueDate && (
                        <div className={`flex items-center gap-1 ${overdue ? 'text-red-600 dark:text-red-400 font-semibold' : ''}`}>
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                        </div>
                      )}

                      {task.assignedTo && task.assignedTo.length > 0 && (
                        <div className="flex items-center gap-1">
                          <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span>
                            {task.assignedTo.map((u) => u.name || u.email).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center sm:flex-col sm:items-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1.5">
                      {/* Files Button */}
                      <button
                        onClick={() => setAttachmentTask(task)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                        title="View or upload attachments"
                      >
                        <svg className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        <span>Files</span>
                        {attachmentsCount > 0 && (
                          <span className="px-1.5 py-0.2 bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-bold rounded-full text-[10px]">
                            {attachmentsCount}
                          </span>
                        )}
                      </button>

                      {/* Comments Button */}
                      <button
                        onClick={() => setCommentTask(task)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
                        title="View or add comments"
                      >
                        <svg className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                        </svg>
                        <span>Comments</span>
                      </button>
                    </div>

                    {/* Status Switcher */}
                    <div className="flex items-center gap-1">
                      {task.status !== 'To Do' && (
                        <button
                          disabled={updatingId === taskId}
                          onClick={() => handleStatusUpdate(taskId, 'To Do')}
                          className="px-2 py-1 text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800/70 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          To Do
                        </button>
                      )}
                      {task.status !== 'In Progress' && (
                        <button
                          disabled={updatingId === taskId}
                          onClick={() => handleStatusUpdate(taskId, 'In Progress')}
                          className="px-2 py-1 text-xs text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-md border border-blue-200 dark:border-blue-800/60 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          In Progress
                        </button>
                      )}
                      {task.status !== 'Completed' && (
                        <button
                          disabled={updatingId === taskId}
                          onClick={() => handleStatusUpdate(taskId, 'Completed')}
                          className="px-2 py-1 text-xs text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-md border border-emerald-200 dark:border-emerald-800/60 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          Done ✓
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Page <span className="font-semibold text-slate-900 dark:text-slate-100">{page}</span> of <span className="font-semibold text-slate-900 dark:text-slate-100">{totalPages}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Attachments Modal */}
      {attachmentTask && (
        <TaskAttachmentsModal
          task={attachmentTask}
          canDelete={isManager}
          onClose={() => setAttachmentTask(null)}
          onAttachmentsUpdated={(tId, updatedAttachments) => {
            setTasks((prev) =>
              prev.map((t) => ((t._id || t.id) === tId ? { ...t, attachments: updatedAttachments } : t))
            );
            setAttachmentTask((prev) => (prev ? { ...prev, attachments: updatedAttachments } : null));
          }}
        />
      )}

      {/* Comments Modal */}
      {commentTask && (
        <TaskCommentsModal
          task={commentTask}
          onClose={() => setCommentTask(null)}
          onCommentAdded={() => {
            // Keep task alive
          }}
        />
      )}
    </div>
  );
};

export default MyTasks;
