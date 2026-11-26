import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { fetchOrgTasksApi, fetchProjectsApi, updateTaskStatusApi } from '../services/api';
import TaskCommentsModal from '../components/TaskCommentsModal';
import TaskAttachmentsModal from '../components/TaskAttachmentsModal';

/**
 * Calendar Page Component
 * ───────────────────────
 * Route: /calendar
 * 
 * Provides interactive Monthly and Weekly task scheduling views:
 * - Tasks positioned on their due dates
 * - Priority badges (High, Medium, Low)
 * - Overdue task highlights (red indicator for incomplete tasks past due date)
 * - Completed task indicators (green checkmark styling; never marked overdue)
 * - Navigation: Previous / Next, Today button, View toggle (Month / Week)
 * - Project Filter dropdown (All Projects vs Individual Projects in active org)
 * - Task click opens rich details modal with quick status toggle, comments, & attachments
 * - Responsive design supporting Light Mode and Dark Mode
 */

// Helper to convert date to YYYY-MM-DD in local time
const formatDateKey = (d) => {
  if (!d) return '';
  const dateObj = new Date(d);
  if (isNaN(dateObj.getTime())) return '';
  const year = dateObj.getFullYear();
  const month= String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function Calendar() {
  const { activeOrgId, organisation } = useAuth() || {};

  // Current view reference date (defaults to today)
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState('month'); // 'month' | 'week'
  const [selectedProjectId, setSelectedProjectId] = useState('ALL');

  // Data states
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected Task Details Modal state
  const [selectedTask, setSelectedTask] = useState(null);
  const [updatingTaskStatus, setUpdatingTaskStatus] = useState(false);

  // Day overflow modal state (when multiple tasks on one day in monthly view)
  const [dayOverflowData, setDayOverflowData] = useState(null); // { dateStr, tasks: [] }

  // Child Modals for selected task
  const [commentTask, setCommentTask] = useState(null);
  const [attachmentTask, setAttachmentTask] = useState(null);

  const todayKey = formatDateKey(new Date());

  // 1. Fetch projects in organisation for the filter dropdown
  const loadProjects = useCallback(async () => {
    if (!activeOrgId) return;
    try {
      const res = await fetchProjectsApi(activeOrgId, { limit: 100 });
      setProjects(res.projects || []);
    } catch (err) {
      console.error('Failed to load projects for calendar:', err);
    }
  }, [activeOrgId]);

  // 2. Fetch tasks for the calendar
  const loadTasks = useCallback(async () => {
    if (!activeOrgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const params = {
        orgId: activeOrgId,
        hasDueDate: 'true', // Only tasks with due dates belong on calendar
      };
      if (selectedProjectId && selectedProjectId !== 'ALL') {
        params.projectId = selectedProjectId;
      }
      const data = await fetchOrgTasksApi(params);
      setTasks(data || []);
    } catch (err) {
      console.error('Failed to load calendar tasks:', err);
      setError(err.message || 'Failed to load tasks for calendar.');
    } finally {
      setLoading(false);
    }
  }, [activeOrgId, selectedProjectId]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Handle task status update from inside details modal
  const handleStatusChange = async (taskId, newStatus) => {
    setUpdatingTaskStatus(true);
    try {
      await updateTaskStatusApi(taskId, newStatus);
      // Update local task state
      setTasks((prev) =>
        prev.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t))
      );
      if (selectedTask && selectedTask._id === taskId) {
        setSelectedTask((prev) => ({ ...prev, status: newStatus }));
      }
      if (dayOverflowData) {
        setDayOverflowData((prev) => ({
          ...prev,
          tasks: prev.tasks.map((t) => (t._id === taskId ? { ...t, status: newStatus } : t)),
        }));
      }
    } catch (err) {
      console.error('Failed to update task status:', err);
    } finally {
      setUpdatingTaskStatus(false);
    }
  };

  // Group tasks by local YYYY-MM-DD
  const tasksByDate = useMemo(() => {
    const map = {};
    tasks.forEach((task) => {
      if (!task.dueDate) return;
      const key = formatDateKey(task.dueDate);
      if (!key) return;
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(task);
    });
    return map;
  }, [tasks]);

  // Check if a task is overdue
  const isOverdue = useCallback((task) => {
    if (!task.dueDate || task.status === 'Completed') return false;
    const taskKey = formatDateKey(task.dueDate);
    return taskKey < todayKey;
  }, [todayKey]);

  // ── Navigation Controls ──
  const handlePrev = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewMode === 'month') {
        next.setMonth(next.getMonth() - 1);
      } else {
        next.setDate(next.getDate() - 7);
      }
      return next;
    });
  };

  const handleNext = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewMode === 'month') {
        next.setMonth(next.getMonth() + 1);
      } else {
        next.setDate(next.getDate() + 7);
      }
      return next;
    });
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Calendar title string
  const calendarTitle = useMemo(() => {
    if (viewMode === 'month') {
      return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    } else {
      // Weekly date range
      const curr = new Date(currentDate);
      const day = curr.getDay();
      const firstDay = new Date(curr);
      firstDay.setDate(curr.getDate() - day);
      const lastDay = new Date(firstDay);
      lastDay.setDate(firstDay.getDate() + 6);

      const firstMonth = MONTH_NAMES[firstDay.getMonth()].substring(0, 3);
      const lastMonth = MONTH_NAMES[lastDay.getMonth()].substring(0, 3);

      if (firstDay.getFullYear() !== lastDay.getFullYear()) {
        return `${firstMonth} ${firstDay.getDate()}, ${firstDay.getFullYear()} – ${lastMonth} ${lastDay.getDate()}, ${lastDay.getFullYear()}`;
      } else if (firstMonth !== lastMonth) {
        return `${firstMonth} ${firstDay.getDate()} – ${lastMonth} ${lastDay.getDate()}, ${firstDay.getFullYear()}`;
      }
      return `${firstMonth} ${firstDay.getDate()} – ${lastDay.getDate()}, ${firstDay.getFullYear()}`;
    }
  }, [currentDate, viewMode]);

  // ── Monthly Grid Calculation ──
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    const startingDayOfWeek = firstDayOfMonth.getDay(); // 0 (Sun) to 6 (Sat)
    const totalDaysInMonth = lastDayOfMonth.getDate();

    const days = [];

    // Leading days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        date,
        dateKey: formatDateKey(date),
        dayNum: date.getDate(),
        isCurrentMonth: false,
      });
    }

    // Days in current month
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const date = new Date(year, month, d);
      days.push({
        date,
        dateKey: formatDateKey(date),
        dayNum: d,
        isCurrentMonth: true,
      });
    }

    // Trailing days from next month to complete 35 or 42 grid cells
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const date = new Date(year, month + 1, i);
      days.push({
        date,
        dateKey: formatDateKey(date),
        dayNum: i,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentDate]);

  // ── Weekly Days Calculation ──
  const weekDays = useMemo(() => {
    const curr = new Date(currentDate);
    const day = curr.getDay();
    const startOfWeek = new Date(curr);
    startOfWeek.setDate(curr.getDate() - day);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      days.push({
        date,
        dateKey: formatDateKey(date),
        dayName: DAYS_OF_WEEK[date.getDay()],
        dayNum: date.getDate(),
      });
    }
    return days;
  }, [currentDate]);

  // Quick stats computed for header pills
  const stats = useMemo(() => {
    const total = tasks.length;
    let completed = 0;
    let overdueCount = 0;
    let pending = 0;

    tasks.forEach((t) => {
      if (t.status === 'Completed') {
        completed++;
      } else {
        pending++;
        if (isOverdue(t)) {
          overdueCount++;
        }
      }
    });

    return { total, completed, pending, overdueCount };
  }, [tasks, isOverdue]);

  // Priority indicator dot
  const getPriorityDot = (priority) => {
    switch (priority) {
      case 'High':
        return 'bg-rose-500';
      case 'Medium':
        return 'bg-amber-500';
      default:
        return 'bg-blue-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Top Header & Stats ── */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Task Calendar
            </h1>
            <span className="rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200/50 dark:border-blue-800/60 px-2.5 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
              {organisation?.name || 'Workspace'}
            </span>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Track scheduled deadlines, milestones, and task deliverables across your organisation
          </p>
        </div>

        {/* Quick KPI summary badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] px-3 py-1.5 text-xs shadow-xs">
            <span className="font-semibold text-slate-500 dark:text-slate-400">Scheduled:</span>
            <span className="font-bold text-slate-900 dark:text-slate-100">{stats.total}</span>
          </div>

          <div className="flex items-center gap-1.5 rounded-lg border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/30 px-3 py-1.5 text-xs text-emerald-700 dark:text-emerald-300">
            <span className="font-semibold">Completed:</span>
            <span className="font-bold">{stats.completed}</span>
          </div>

          {stats.overdueCount > 0 && (
            <div className="flex items-center gap-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50/70 dark:bg-rose-950/40 px-3 py-1.5 text-xs text-rose-700 dark:text-rose-300 font-semibold animate-pulse">
              <span>⚠️ Overdue:</span>
              <span className="font-bold">{stats.overdueCount}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50/60 dark:bg-blue-950/30 px-3 py-1.5 text-xs text-blue-700 dark:text-blue-300">
            <span className="font-semibold">Pending:</span>
            <span className="font-bold">{stats.pending}</span>
          </div>
        </div>
      </div>

      {/* ── Toolbar: Navigation, Project Filter, View Switcher ── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 shadow-xs flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between">
        {/* Navigation & Title */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleToday}
            className="btn-secondary text-xs py-1.5 px-3 rounded-lg font-semibold cursor-pointer"
          >
            Today
          </button>

          <div className="flex items-center border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-50 dark:bg-slate-800/80">
            <button
              type="button"
              onClick={handlePrev}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Previous"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />
            <button
              type="button"
              onClick={handleNext}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              title="Next"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 ml-2">
            {calendarTitle}
          </h2>
        </div>

        {/* Filter and View Toggles */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Project Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 hidden sm:inline">
              Project:
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 cursor-pointer max-w-[200px] truncate"
            >
              <option value="ALL">All Projects ({projects.length})</option>
              {projects.map((proj) => (
                <option key={proj._id} value={proj._id}>
                  {proj.name}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle: Month vs Week */}
          <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                viewMode === 'month'
                  ? 'bg-white dark:bg-[#1E293B] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                viewMode === 'week'
                  ? 'bg-white dark:bg-[#1E293B] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              Week
            </button>
          </div>
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div className="rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 p-4 text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
          <p>{error}</p>
          <button
            type="button"
            onClick={loadTasks}
            className="text-blue-600 dark:text-blue-400 font-semibold underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {/* ── Calendar Surface ── */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-24 text-center text-xs text-slate-500 dark:text-slate-400">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-blue-600 border-t-transparent mb-3" />
            <p className="font-medium">Loading scheduled tasks...</p>
          </div>
        ) : viewMode === 'month' ? (
          /* ═══════════════════════════════════════════════════════
             MONTHLY CALENDAR VIEW
             ═══════════════════════════════════════════════════════ */
          <div>
            {/* Weekday Header */}
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 text-center">
              {DAYS_OF_WEEK.map((day) => (
                <div
                  key={day}
                  className="py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Monthly Grid */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800/80 bg-slate-100/50 dark:bg-slate-800/40">
              {monthDays.map((cell) => {
                const dayTasks = tasksByDate[cell.dateKey] || [];
                const isToday = cell.dateKey === todayKey;
                const visibleTasks = dayTasks.slice(0, 3);
                const overflowCount = dayTasks.length - visibleTasks.length;

                return (
                  <div
                    key={cell.dateKey}
                    className={`min-h-[115px] p-2 flex flex-col justify-between transition-colors ${
                      cell.isCurrentMonth
                        ? 'bg-white dark:bg-[#111827]'
                        : 'bg-slate-50/50 dark:bg-slate-900/40 text-slate-400 dark:text-slate-600'
                    } ${isToday ? 'ring-2 ring-inset ring-blue-500/80 bg-blue-50/20 dark:bg-blue-950/20' : ''}`}
                  >
                    {/* Date Number Header */}
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                          isToday
                            ? 'bg-blue-600 text-white font-bold shadow-xs'
                            : cell.isCurrentMonth
                            ? 'text-slate-700 dark:text-slate-300'
                            : 'text-slate-400 dark:text-slate-600'
                        }`}
                      >
                        {cell.dayNum}
                      </span>

                      {dayTasks.length > 0 && (
                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                          {dayTasks.length} {dayTasks.length === 1 ? 'task' : 'tasks'}
                        </span>
                      )}
                    </div>

                    {/* Task Chips */}
                    <div className="space-y-1 flex-1 min-h-[50px]">
                      {visibleTasks.map((task) => {
                        const overdue = isOverdue(task);
                        const isCompleted = task.status === 'Completed';

                        return (
                          <button
                            key={task._id}
                            type="button"
                            onClick={() => setSelectedTask(task)}
                            className={`w-full text-left px-2 py-1 rounded-md text-[11px] font-medium border truncate transition-all cursor-pointer flex items-center gap-1.5 ${
                              isCompleted
                                ? 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 line-through opacity-85'
                                : overdue
                                ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-semibold'
                                : 'bg-slate-50 dark:bg-slate-800/70 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:border-blue-500'
                            }`}
                            title={`${task.title} (${task.priority} Priority, ${task.status})`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                              isCompleted
                                ? 'bg-emerald-500'
                                : overdue
                                ? 'bg-rose-600'
                                : getPriorityDot(task.priority)
                            }`} />
                            <span className="truncate flex-1">{task.title}</span>
                          </button>
                        );
                      })}

                      {/* "+X more" Popover trigger */}
                      {overflowCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setDayOverflowData({ dateStr: cell.dateKey, tasks: dayTasks })}
                          className="w-full text-left text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline px-1 py-0.5 cursor-pointer"
                        >
                          +{overflowCount} more...
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* ═══════════════════════════════════════════════════════
             WEEKLY CALENDAR VIEW
             ═══════════════════════════════════════════════════════ */
          <div>
            {/* Week Columns Header */}
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/70 divide-x divide-slate-200 dark:divide-slate-800">
              {weekDays.map((col) => {
                const isToday = col.dateKey === todayKey;
                return (
                  <div
                    key={col.dateKey}
                    className={`py-3 text-center transition-colors ${
                      isToday ? 'bg-blue-50/60 dark:bg-blue-950/30' : ''
                    }`}
                  >
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {col.dayName}
                    </p>
                    <p
                      className={`inline-flex mt-1 h-7 w-7 items-center justify-center rounded-full text-sm font-bold ${
                        isToday
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {col.dayNum}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Weekly Columns Body */}
            <div className="grid grid-cols-7 divide-x divide-slate-100 dark:divide-slate-800/80 min-h-[420px]">
              {weekDays.map((col) => {
                const colTasks = tasksByDate[col.dateKey] || [];
                const isToday = col.dateKey === todayKey;

                return (
                  <div
                    key={col.dateKey}
                    className={`p-2.5 space-y-2 flex flex-col justify-start transition-colors ${
                      isToday ? 'bg-blue-50/15 dark:bg-blue-950/10' : 'bg-white dark:bg-[#111827]'
                    }`}
                  >
                    {colTasks.length === 0 ? (
                      <div className="py-10 text-center text-[11px] text-slate-300 dark:text-slate-700 italic">
                        No tasks
                      </div>
                    ) : (
                      colTasks.map((task) => {
                        const overdue = isOverdue(task);
                        const isCompleted = task.status === 'Completed';

                        return (
                          <div
                            key={task._id}
                            onClick={() => setSelectedTask(task)}
                            className={`p-2.5 rounded-xl border text-xs shadow-xs cursor-pointer hover:shadow-md transition-all ${
                              isCompleted
                                ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200/60 dark:border-emerald-800/50'
                                : overdue
                                ? 'bg-rose-50/70 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800/70 ring-1 ring-rose-400/30'
                                : 'bg-white dark:bg-[#1E293B] border-slate-200 dark:border-slate-800 hover:border-blue-400 dark:hover:border-blue-500'
                            }`}
                          >
                            {/* Project Tag */}
                            {task.projectId?.name && (
                              <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 truncate mb-1">
                                {task.projectId.name}
                              </p>
                            )}

                            {/* Task Title */}
                            <h4 className={`font-semibold text-xs leading-snug line-clamp-2 ${
                              isCompleted
                                ? 'text-emerald-800 dark:text-emerald-300 line-through'
                                : overdue
                                ? 'text-rose-800 dark:text-rose-200 font-bold'
                                : 'text-slate-900 dark:text-slate-100'
                            }`}>
                              {task.title}
                            </h4>

                            {/* Badges footer */}
                            <div className="mt-2.5 flex items-center justify-between gap-1 flex-wrap text-[10px]">
                              <span
                                className={`rounded px-1.5 py-0.2 font-semibold ${
                                  task.priority === 'High'
                                    ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300'
                                    : task.priority === 'Medium'
                                    ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {task.priority}
                              </span>

                              <span
                                className={`rounded px-1.5 py-0.2 font-semibold ${
                                  isCompleted
                                    ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300'
                                    : overdue
                                    ? 'bg-rose-100 dark:bg-rose-900/60 text-rose-800 dark:text-rose-200 font-bold'
                                    : 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                                }`}
                              >
                                {overdue ? 'Overdue' : task.status}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════
         TASK DETAILS MODAL (Task Interaction)
         ═══════════════════════════════════════════════════════ */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-6">
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  {selectedTask.projectId && (
                    <Link
                      to={`/projects/${selectedTask.projectId._id || selectedTask.projectId.id || selectedTask.projectId}`}
                      className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      📁 {selectedTask.projectId.name || 'Project'}
                    </Link>
                  )}

                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      selectedTask.priority === 'High'
                        ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                        : selectedTask.priority === 'Medium'
                        ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {selectedTask.priority} Priority
                  </span>

                  {isOverdue(selectedTask) && (
                    <span className="rounded-full bg-rose-600 text-white px-2 py-0.5 text-[10px] font-bold">
                      ⚠️ Overdue
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {selectedTask.title}
                </h3>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 text-xs">
              {/* Description */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                  Description
                </label>
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-50 dark:bg-slate-900/60 p-3 rounded-xl border border-slate-100 dark:border-slate-800">
                  {selectedTask.description || 'No description provided.'}
                </p>
              </div>

              {/* Due Date & Status Switcher */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                    Scheduled Due Date
                  </label>
                  <div className={`p-2.5 rounded-xl border font-semibold flex items-center gap-2 ${
                    isOverdue(selectedTask)
                      ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200'
                  }`}>
                    <span>📅</span>
                    <span>
                      {selectedTask.dueDate
                        ? new Date(selectedTask.dueDate).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : 'No due date'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">
                    Task Status
                  </label>
                  <select
                    disabled={updatingTaskStatus}
                    value={selectedTask.status}
                    onChange={(e) => handleStatusChange(selectedTask._id, e.target.value)}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200 font-semibold outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 cursor-pointer disabled:opacity-50"
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              {/* Assignees List */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">
                  Assigned Team Members
                </label>
                {Array.isArray(selectedTask.assignedTo) && selectedTask.assignedTo.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {selectedTask.assignedTo.map((assignee) => (
                      <div
                        key={assignee._id || assignee.id || assignee}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 text-xs text-slate-800 dark:text-slate-200"
                      >
                        <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950 text-[10px] font-bold text-blue-600 dark:text-blue-400 overflow-hidden">
                          {assignee.avatar ? (
                            <img src={assignee.avatar} alt={assignee.name} className="h-full w-full object-cover" />
                          ) : (
                            <span>{assignee.name ? assignee.name.charAt(0).toUpperCase() : 'U'}</span>
                          )}
                        </div>
                        <span className="font-medium">{assignee.name || 'Member'}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-slate-400 dark:text-slate-500 italic">Unassigned</p>
                )}
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 bg-slate-50/70 dark:bg-slate-900/70 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                {/* Comments Trigger */}
                <button
                  type="button"
                  onClick={() => setCommentTask(selectedTask)}
                  className="btn-secondary text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <span>💬</span>
                  <span>Comments</span>
                </button>

                {/* Attachments Trigger */}
                <button
                  type="button"
                  onClick={() => setAttachmentTask(selectedTask)}
                  className="btn-secondary text-xs py-1.5 px-3 rounded-lg flex items-center gap-1.5 cursor-pointer"
                >
                  <span>📎</span>
                  <span>Attachments</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTask(null)}
                className="btn-primary text-xs py-1.5 px-4 rounded-lg cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════
         DAY TASKS OVERFLOW MODAL (Month View "+X more")
         ═══════════════════════════════════════════════════════ */}
      {dayOverflowData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xl p-5 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800 mb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Tasks for {dayOverflowData.dateStr}
              </h3>
              <button
                type="button"
                onClick={() => setDayOverflowData(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto space-y-2">
              {dayOverflowData.tasks.map((t) => {
                const overdue = isOverdue(t);
                const isCompleted = t.status === 'Completed';

                return (
                  <div
                    key={t._id}
                    onClick={() => {
                      setDayOverflowData(null);
                      setSelectedTask(t);
                    }}
                    className={`p-3 rounded-xl border text-xs cursor-pointer hover:border-blue-500 transition-colors ${
                      isCompleted
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/60'
                        : overdue
                        ? 'bg-rose-50/60 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
                        : 'bg-white dark:bg-[#1E293B] border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-semibold truncate ${isCompleted ? 'line-through text-slate-400' : ''}`}>
                        {t.title}
                      </span>
                      <span className="text-[10px] font-semibold shrink-0">{t.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Sub-Modals: Comments & Attachments ── */}
      {commentTask && (
        <TaskCommentsModal
          task={commentTask}
          onClose={() => setCommentTask(null)}
        />
      )}

      {attachmentTask && (
        <TaskAttachmentsModal
          task={attachmentTask}
          onClose={() => setAttachmentTask(null)}
          onAttachmentsUpdated={() => loadTasks()}
        />
      )}
    </div>
  );
}

export default Calendar;
