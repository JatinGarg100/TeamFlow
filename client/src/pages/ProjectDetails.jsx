import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  fetchProjectByIdApi,
  updateProjectApi,
  deleteProjectApi,
  fetchProjectTasksApi,
  createTaskApi,
  updateTaskStatusApi,
  updateTaskApi,
  deleteTaskApi,
  fetchProjectProgressApi,
  addProjectMembersApi,
  removeProjectMemberApi,
  fetchOrgMembers,
  getStoredAuth,
} from '../services/api';
import TaskAttachmentsModal from '../components/TaskAttachmentsModal';
import TaskCommentsModal from '../components/TaskCommentsModal';
import ActivityFeed from '../components/ActivityFeed';

/**
 * ProjectDetails Page — Premium SaaS Mixed Theme
 * ───────────────────────────────────────────────
 * - Live dynamic milestone calculation & progress bar
 * - Multi-assignee task distribution & direct status cycling
 * - Task attachments & comments integration
 * - Manage team membership with role badges
 * - Full Project and Task CRUD with Electric Blue accents
 */
function ProjectDetails() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [progress, setProgress] = useState({
    totalTasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    percentage: 0,
  });

  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Task Search and Filtering State
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [debouncedTaskSearch, setDebouncedTaskSearch] = useState('');
  const [taskStatusFilter, setTaskStatusFilter] = useState('ALL');
  const [taskPriorityFilter, setTaskPriorityFilter] = useState('ALL');
  const [taskAssigneeFilter, setTaskAssigneeFilter] = useState('ALL');
  const [taskDueDateFilter, setTaskDueDateFilter] = useState('ALL'); // 'ALL' | 'upcoming' | 'past_due' | 'overdue'
  const [taskPage, setTaskPage] = useState(1);
  const [taskTotalPages, setTaskTotalPages] = useState(1);
  const [taskTotalItems, setTaskTotalItems] = useState(0);

  // Edit Project Modal State
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [editProjectSubmitting, setEditProjectSubmitting] = useState(false);
  const [editProjectError, setEditProjectError] = useState('');
  const [editProjectData, setEditProjectData] = useState({
    name: '',
    description: '',
    deadline: '',
    status: 'Planning',
  });

  // Delete Project Modal State
  const [showDeleteProjectModal, setShowDeleteProjectModal] = useState(false);
  const [deleteProjectSubmitting, setDeleteProjectSubmitting] = useState(false);
  const [deleteProjectError, setDeleteProjectError] = useState('');

  // Delete Task Modal State
  const [taskToDelete, setTaskToDelete] = useState(null);
  const [deleteTaskSubmitting, setDeleteTaskSubmitting] = useState(false);
  const [deleteTaskError, setDeleteTaskError] = useState('');

  // Manage Team Modal State
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [orgEmployees, setOrgEmployees] = useState([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamModalError, setTeamModalError] = useState('');
  const [teamModalSuccess, setTeamModalSuccess] = useState('');
  const [selectedToAdd, setSelectedToAdd] = useState([]);

  // Create Task Modal State
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [taskModalError, setTaskModalError] = useState('');
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assignedTo: [],
    priority: 'Medium',
    dueDate: '',
    status: 'To Do',
  });

  // Edit Task Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTaskSubmitting, setEditTaskSubmitting] = useState(false);
  const [editModalError, setEditModalError] = useState('');
  const [editingTask, setEditingTask] = useState({
    _id: '',
    title: '',
    description: '',
    assignedTo: [],
    priority: 'Medium',
    dueDate: '',
    status: 'To Do',
  });

  // Task Attachments Modal State (Phase 4)
  const [attachmentModalTask, setAttachmentModalTask] = useState(null);

  // Task Comments Modal State (Phase 3)
  const [commentModalTask, setCommentModalTask] = useState(null);

  // Activity Feed Refresh Trigger (Phase 3)
  const [activityRefreshTrigger, setActivityRefreshTrigger] = useState(0);

  const auth = getStoredAuth();
  const userRole = auth?.organisation?.role || 'member';
  const isManager = ['owner', 'admin', 'manager'].includes(userRole);

  // Load Organisation Employees so all company members appear in task assignees
  const loadOrgEmployees = useCallback(async (targetOrgId) => {
    try {
      const orgId = targetOrgId || project?.orgId?._id || project?.orgId || auth?.organisation?.id || auth?.organisation?._id;
      if (orgId) {
        const res = await fetchOrgMembers(orgId, { limit: 100 });
        const memberList = Array.isArray(res) ? res : (res?.members || res?.data || []);
        setOrgEmployees(memberList);
      }
    } catch (err) {
      console.warn('Failed to load org employees:', err);
    }
  }, [project?.orgId, auth?.organisation?.id, auth?.organisation?._id]);

  // 1. Load Project Details
  const loadProject = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchProjectByIdApi(projectId);
      setProject(data);
      const currentOrgId = data?.orgId?._id || data?.orgId || auth?.organisation?.id;
      if (currentOrgId) {
        loadOrgEmployees(currentOrgId);
      }
    } catch (err) {
      setError(err.message || 'Failed to load project details.');
    } finally {
      setLoading(false);
    }
  }, [projectId, auth?.organisation?.id, loadOrgEmployees]);

  // Debounce task search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTaskSearch(taskSearchQuery);
      setTaskPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [taskSearchQuery]);

  // Load project overall milestone progress independently
  const loadProgress = useCallback(async () => {
    if (!projectId) return;
    try {
      const progressData = await fetchProjectProgressApi(projectId);
      if (progressData) {
        setProgress(progressData);
      }
    } catch (err) {
      console.warn('Failed to load project progress metrics:', err);
    }
  }, [projectId]);

  // Load project tasks with full search, status, priority, assignee, due date and pagination
  const loadTasks = useCallback(async () => {
    if (!projectId) return;
    setTasksLoading(true);
    try {
      const params = {
        page: taskPage,
        limit: 10,
        search: debouncedTaskSearch.trim() || undefined,
      };

      if (taskStatusFilter !== 'ALL') {
        params.status = taskStatusFilter;
      }
      if (taskPriorityFilter !== 'ALL') {
        params.priority = taskPriorityFilter;
      }
      if (taskAssigneeFilter !== 'ALL') {
        params.assignedTo = taskAssigneeFilter;
      }
      if (taskDueDateFilter !== 'ALL') {
        if (taskDueDateFilter === 'overdue') {
          params.overdue = 'true';
        } else {
          params.dueDateFilter = taskDueDateFilter;
        }
      }

      const tasksData = await fetchProjectTasksApi(projectId, params);
      const tasksList = Array.isArray(tasksData) ? tasksData : (tasksData?.tasks || []);
      setTasks(tasksList);
      setTaskTotalPages(tasksData?.pagination?.totalPages || 1);
      setTaskTotalItems(
        tasksData?.pagination?.totalItems ??
        tasksData?.pagination?.total ??
        tasksData?.totalItems ??
        tasksList.length
      );
    } catch (err) {
      console.error('Failed to load project tasks:', err);
    } finally {
      setTasksLoading(false);
    }
  }, [
    projectId,
    taskPage,
    debouncedTaskSearch,
    taskStatusFilter,
    taskPriorityFilter,
    taskAssigneeFilter,
    taskDueDateFilter,
  ]);

  // Load Tasks and Progress metrics simultaneously
  const loadTasksAndProgress = useCallback(async () => {
    await Promise.all([loadTasks(), loadProgress()]);
  }, [loadTasks, loadProgress]);

  useEffect(() => {
    loadProject();
  }, [loadProject]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    loadProgress();
  }, [loadProgress]);

  const hasActiveTaskFilters =
    taskStatusFilter !== 'ALL' ||
    taskPriorityFilter !== 'ALL' ||
    taskAssigneeFilter !== 'ALL' ||
    taskDueDateFilter !== 'ALL' ||
    taskSearchQuery.trim() !== '';

  const handleResetTaskFilters = () => {
    setTaskSearchQuery('');
    setDebouncedTaskSearch('');
    setTaskStatusFilter('ALL');
    setTaskPriorityFilter('ALL');
    setTaskAssigneeFilter('ALL');
    setTaskDueDateFilter('ALL');
    setTaskPage(1);
  };

  // Handle Project Status dropdown change
  const handleProjectStatusChange = async (newStatus) => {
    if (!project || project.status === newStatus) return;
    setUpdatingStatus(true);
    try {
      const updated = await updateProjectApi(projectId, { status: newStatus });
      setProject(updated);
      setActivityRefreshTrigger((prev) => prev + 1);
      setFeedback({
        type: 'success',
        message: `Project status updated to "${newStatus}"`,
      });
      setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to update project status.',
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Open Edit Project Modal
  const handleOpenEditProject = () => {
    if (!project) return;
    setEditProjectError('');
    setEditProjectData({
      name: project.name || '',
      description: project.description || '',
      deadline: project.deadline ? new Date(project.deadline).toISOString().split('T')[0] : '',
      status: project.status || 'Planning',
    });
    setShowEditProjectModal(true);
  };

  // Handle Save Edit Project
  const handleSaveProject = async (e) => {
    e.preventDefault();
    setEditProjectError('');

    if (!editProjectData.name.trim()) {
      setEditProjectError('Project name cannot be empty.');
      return;
    }

    setEditProjectSubmitting(true);
    try {
      const targetId = project._id || project.id;
      const updated = await updateProjectApi(targetId, {
        name: editProjectData.name.trim(),
        description: editProjectData.description.trim(),
        deadline: editProjectData.deadline || null,
        status: editProjectData.status,
      });

      setProject(updated);
      setShowEditProjectModal(false);
      setActivityRefreshTrigger((prev) => prev + 1);
      setFeedback({
        type: 'success',
        message: 'Project updated successfully!',
      });
      setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
    } catch (err) {
      setEditProjectError(err.message || 'Failed to update project.');
    } finally {
      setEditProjectSubmitting(false);
    }
  };

  // Open Delete Project Modal
  const handleOpenDeleteProject = () => {
    setDeleteProjectError('');
    setShowDeleteProjectModal(true);
  };

  // Handle Confirm Delete Project
  const handleConfirmDeleteProject = async () => {
    setDeleteProjectError('');
    setDeleteProjectSubmitting(true);
    try {
      const targetId = project._id || project.id;
      await deleteProjectApi(targetId);
      setShowDeleteProjectModal(false);
      navigate('/projects', {
        state: { deletedMessage: `Project "${project.name}" was deleted successfully.` },
      });
    } catch (err) {
      setDeleteProjectError(err.message || 'Failed to delete project.');
      setDeleteProjectSubmitting(false);
    }
  };

  // Open Delete Task Modal
  const handleOpenDeleteTask = (task) => {
    setDeleteTaskError('');
    setTaskToDelete(task);
  };

  // Handle Confirm Delete Task
  const handleConfirmDeleteTask = async () => {
    if (!taskToDelete) return;
    setDeleteTaskError('');
    setDeleteTaskSubmitting(true);
    try {
      const targetId = taskToDelete._id || taskToDelete.id;
      await deleteTaskApi(targetId);
      setTasks((prev) => prev.filter((t) => (t._id || t.id) !== targetId));
      setTaskToDelete(null);
      await loadTasksAndProgress();
      setActivityRefreshTrigger((prev) => prev + 1);
      setFeedback({
        type: 'success',
        message: `Task "${taskToDelete.title}" deleted successfully. Progress recalculated!`,
      });
      setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
    } catch (err) {
      setDeleteTaskError(err.message || 'Failed to delete task.');
    } finally {
      setDeleteTaskSubmitting(false);
    }
  };

  // Handle task status cycle
  const handleTaskStatusCycle = async (taskId, currentStatus) => {
    const nextStatus =
      currentStatus === 'To Do' || currentStatus === 'Pending'
        ? 'In Progress'
        : currentStatus === 'In Progress'
        ? 'Completed'
        : 'To Do';

    try {
      await updateTaskStatusApi(taskId, nextStatus);
      await loadTasksAndProgress();
      setActivityRefreshTrigger((prev) => prev + 1);
      setFeedback({
        type: 'success',
        message: `Task updated to "${nextStatus}". Project progress recalculated!`,
      });
      setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to update task status.',
      });
    }
  };

  // Open Manage Team Modal
  const handleOpenTeamModal = async () => {
    setTeamModalError('');
    setTeamModalSuccess('');
    setSelectedToAdd([]);
    setShowTeamModal(true);
    setTeamLoading(true);
    try {
      const orgId = project?.orgId?._id || project?.orgId || auth?.organisation?.id || auth?.organisation?._id;
      const res = await fetchOrgMembers(orgId, { limit: 100 });
      const memberList = Array.isArray(res) ? res : (res?.members || res?.data || []);
      setOrgEmployees(memberList);
    } catch (err) {
      setTeamModalError(err.message || 'Failed to fetch organisation members.');
    } finally {
      setTeamLoading(false);
    }
  };

  // Add members to project
  const handleAddMembers = async () => {
    if (selectedToAdd.length === 0) return;
    setTeamLoading(true);
    setTeamModalError('');
    setTeamModalSuccess('');
    try {
      const updated = await addProjectMembersApi(projectId, selectedToAdd);
      setProject(updated);
      setSelectedToAdd([]);
      setTeamModalSuccess('Selected team members added to project!');
      setActivityRefreshTrigger((prev) => prev + 1);
      loadOrgEmployees();
    } catch (err) {
      setTeamModalError(err.message || 'Failed to add members.');
    } finally {
      setTeamLoading(false);
    }
  };

  // Remove member from project
  const handleRemoveMember = async (userId) => {
    setTeamLoading(true);
    setTeamModalError('');
    setTeamModalSuccess('');
    try {
      const updated = await removeProjectMemberApi(projectId, userId);
      setProject(updated);
      setTeamModalSuccess('Member removed from project.');
      setActivityRefreshTrigger((prev) => prev + 1);
      loadOrgEmployees();
    } catch (err) {
      setTeamModalError(err.message || 'Failed to remove member.');
    } finally {
      setTeamLoading(false);
    }
  };

  // Toggle assignee checkbox in Create Task modal
  const handleToggleAssignee = (userId) => {
    setTaskModalError('');
    setNewTask((prev) => {
      const exists = prev.assignedTo.includes(userId);
      return {
        ...prev,
        assignedTo: exists
          ? prev.assignedTo.filter((id) => id !== userId)
          : [...prev.assignedTo, userId],
      };
    });
  };

  // Handle Create Task Form Submit
  const handleCreateTask = async (e) => {
    e.preventDefault();
    setTaskModalError('');

    if (!newTask.title.trim()) {
      setTaskModalError('Task title is required.');
      return;
    }

    setTaskSubmitting(true);
    try {
      await createTaskApi(projectId, {
        title: newTask.title.trim(),
        description: newTask.description.trim(),
        assignedTo: newTask.assignedTo,
        priority: newTask.priority,
        dueDate: newTask.dueDate || null,
        status: newTask.status,
      });

      // Reset and close
      setNewTask({
        title: '',
        description: '',
        assignedTo: [],
        priority: 'Medium',
        dueDate: '',
        status: 'To Do',
      });
      setShowTaskModal(false);

      await Promise.all([loadTasksAndProgress(), loadProject()]);
      setActivityRefreshTrigger((prev) => prev + 1);
      setFeedback({
        type: 'success',
        message: 'Task created successfully! Project progress recalculated.',
      });
      setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
    } catch (err) {
      setTaskModalError(err.message || 'Failed to create task.');
    } finally {
      setTaskSubmitting(false);
    }
  };

  // Open Edit Task Modal
  const handleOpenEditTask = (task) => {
    setEditModalError('');
    const rawAssignees = Array.isArray(task.assignedTo)
      ? task.assignedTo.map((a) => (typeof a === 'object' ? a._id || a.id : a))
      : task.assignedTo
      ? [typeof task.assignedTo === 'object' ? task.assignedTo._id || task.assignedTo.id : task.assignedTo]
      : [];

    setEditingTask({
      _id: task._id || task.id,
      title: task.title || '',
      description: task.description || '',
      assignedTo: rawAssignees,
      priority: task.priority || 'Medium',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      status: task.status || 'To Do',
    });
    setShowEditModal(true);
  };

  // Toggle assignee checkbox in Edit Task modal
  const handleToggleEditAssignee = (userId) => {
    setEditModalError('');
    setEditingTask((prev) => {
      const exists = prev.assignedTo.includes(userId);
      return {
        ...prev,
        assignedTo: exists
          ? prev.assignedTo.filter((id) => id !== userId)
          : [...prev.assignedTo, userId],
      };
    });
  };

  // Handle Save Edit Task
  const handleSaveEditTask = async (e) => {
    e.preventDefault();
    setEditModalError('');

    if (!editingTask.title.trim()) {
      setEditModalError('Task title cannot be empty.');
      return;
    }

    setEditTaskSubmitting(true);
    try {
      await updateTaskApi(editingTask._id, {
        title: editingTask.title.trim(),
        description: editingTask.description.trim(),
        assignedTo: editingTask.assignedTo,
        priority: editingTask.priority,
        dueDate: editingTask.dueDate || null,
        status: editingTask.status,
      });

      setShowEditModal(false);
      await Promise.all([loadTasksAndProgress(), loadProject()]);
      setActivityRefreshTrigger((prev) => prev + 1);
      setFeedback({
        type: 'success',
        message: 'Task updated successfully! Newly assigned members notified.',
      });
      setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
    } catch (err) {
      setEditModalError(err.message || 'Failed to update task.');
    } finally {
      setEditTaskSubmitting(false);
    }
  };

  // Extract assignees list safely
  const getTaskAssignees = (task) => {
    if (Array.isArray(task.assignedTo)) {
      return task.assignedTo.filter(Boolean);
    }
    if (task.assignedTo && typeof task.assignedTo === 'object') {
      return [task.assignedTo];
    }
    return [];
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-12 text-sm text-slate-500 shadow-xs">
        <svg className="h-5 w-5 animate-spin text-blue-600 mr-2.5" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
        </svg>
        <span>Loading project details...</span>
      </div>
    );
  }

  // Error state
  if (error || !project) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-12 text-center shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="mt-4 text-base font-semibold text-slate-900">Unable to access project</h2>
        <p className="mt-1 text-xs text-slate-500 max-w-md">
          {error || 'The requested project could not be found or you do not have permission to view it.'}
        </p>
        <Link to="/projects" className="mt-4 btn-primary text-xs">
          ← Back to Projects
        </Link>
      </div>
    );
  }

  const assignedTeam = Array.isArray(project.teamMembers) ? project.teamMembers : [];
  const assignedTeamIds = assignedTeam.map((m) =>
    (typeof m === 'object' ? m._id || m.id || m.userId : m)?.toString()
  );
  const safeOrgEmployees = Array.isArray(orgEmployees) ? orgEmployees : [];
  const availableOrgEmployees = safeOrgEmployees.filter((emp) => {
    const empId = (emp.userId || emp._id || emp.id)?.toString();
    return !assignedTeamIds.includes(empId);
  });

  // Combine organisation employees and project members so ALL employees are immediately assignable
  const assignableMembersMap = new Map();

  safeOrgEmployees.forEach((emp) => {
    const id = (emp.userId || emp.id || emp._id)?.toString();
    if (id) {
      assignableMembersMap.set(id, {
        id,
        _id: id,
        name: emp.name || 'Employee',
        email: emp.email || '',
        role: emp.role || 'member',
      });
    }
  });

  assignedTeam.forEach((emp) => {
    const id = (typeof emp === 'object' ? emp._id || emp.id : emp)?.toString();
    if (id && !assignableMembersMap.has(id)) {
      assignableMembersMap.set(id, {
        id,
        _id: id,
        name: typeof emp === 'object' ? emp.name || 'Team Member' : 'Team Member',
        email: typeof emp === 'object' ? emp.email || '' : '',
        role: typeof emp === 'object' ? emp.role || 'member' : 'member',
      });
    }
  });

  const allAssignableMembers = Array.from(assignableMembersMap.values());

  return (
    <div className="space-y-6">
      {/* Back button */}
      <div>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          <span>Back to Projects</span>
        </Link>
      </div>

      {/* Global feedback toast */}
      {feedback.message && (
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-xs animate-in fade-in duration-200 shadow-xs ${
            feedback.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback({ type: '', message: '' })}
            className="font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* ── Project Header & Live Progress Card ── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-xs transition-colors">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                {project.name}
              </h1>
              <StatusBadge status={project.status} />
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-3xl">
              {project.description || 'No detailed description provided.'}
            </p>
            {project.deadline && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <svg className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Deadline: <strong className="font-semibold text-slate-800 dark:text-slate-200">{new Date(project.deadline).toISOString().split('T')[0]}</strong></span>
              </div>
            )}
          </div>

          {/* Project Controls for Managers */}
          <div className="shrink-0 flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Status:</label>
              <select
                value={project.status}
                disabled={!isManager || updatingStatus}
                onChange={(e) => handleProjectStatusChange(e.target.value)}
                className="input-field text-xs py-1.5 px-3 cursor-pointer"
              >
                <option value="Planning">Planning</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            {isManager && (
              <>
                <button
                  type="button"
                  onClick={handleOpenEditProject}
                  className="btn-secondary text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                  title="Edit project details"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  <span>Edit</span>
                </button>

                <button
                  type="button"
                  onClick={handleOpenDeleteProject}
                  className="btn-danger text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
                  title="Delete project"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <span>Delete</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Milestone & Live Calculated Progress Metrics */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <span className="block text-[11px] uppercase font-semibold text-slate-500 dark:text-slate-400">Calculated Progress</span>
            <span className="mt-0.5 text-lg font-bold text-blue-600 dark:text-blue-400">{progress.percentage}%</span>
          </div>
          <div>
            <span className="block text-[11px] uppercase font-semibold text-slate-500 dark:text-slate-400">Total Tasks</span>
            <span className="mt-0.5 text-lg font-bold text-slate-900 dark:text-slate-100">{progress.totalTasks}</span>
          </div>
          <div>
            <span className="block text-[11px] uppercase font-semibold text-slate-500 dark:text-slate-400">Completed Tasks</span>
            <span className="mt-0.5 text-lg font-bold text-emerald-600 dark:text-emerald-400">{progress.completedTasks}</span>
          </div>
          <div>
            <span className="block text-[11px] uppercase font-semibold text-slate-500 dark:text-slate-400">Pending Tasks</span>
            <span className="mt-0.5 text-lg font-bold text-amber-600 dark:text-amber-400">{progress.pendingTasks}</span>
          </div>
        </div>

        {/* Live Dynamic Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            <span>Progress = {progress.completedTasks} / {progress.totalTasks} tasks completed</span>
            <span className="font-semibold text-slate-900 dark:text-slate-100">{progress.percentage}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Assigned Team Members Card ── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-xs transition-colors">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
              Assigned Project Team ({assignedTeam.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Only team members assigned to this project can be assigned project tasks.
            </p>
          </div>
          {isManager && (
            <button
              onClick={handleOpenTeamModal}
              className="btn-secondary text-xs"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
              <span>Manage Team</span>
            </button>
          )}
        </div>

        {assignedTeam.length === 0 ? (
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">No members assigned to this project yet.</p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-3">
            {assignedTeam.map((member) => {
              const name = typeof member === 'object' ? member.name : 'Team Member';
              const email = typeof member === 'object' ? member.email : '';
              const id = typeof member === 'object' ? member._id || member.id : member;

              return (
                <div
                  key={id}
                  className="flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/60 px-3.5 py-2"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-900/60 text-xs font-bold text-blue-600 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 leading-tight">{name}</p>
                    {email && <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">{email}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Task Backlog & Live Task Table ── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs overflow-hidden transition-colors">
        <div className="flex flex-col gap-3 border-b border-slate-100 dark:border-slate-800 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Project Tasks &amp; Milestones</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Any assigned member can update status (To Do ➔ In Progress ➔ Completed). Progress updates automatically.
            </p>
          </div>
          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <div className="text-xs font-medium text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-600 dark:bg-blue-500"></span>
              <span>Tasks: <strong className="font-semibold text-slate-900 dark:text-slate-100">{taskTotalItems}</strong></span>
            </div>
            {isManager && (
              <button
                onClick={() => {
                  setTaskModalError('');
                  setShowTaskModal(true);
                }}
                className="btn-primary shrink-0"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>Create Task</span>
              </button>
            )}
          </div>
        </div>

        {/* Task Search & Filter Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
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
                value={taskSearchQuery}
                onChange={(e) => setTaskSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] rounded-lg text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-hidden focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-950/50 focus:border-blue-600 dark:focus:border-blue-500 transition-all"
              />
            </div>

            {/* Priority Filter */}
            <div>
              <select
                value={taskPriorityFilter}
                onChange={(e) => {
                  setTaskPriorityFilter(e.target.value);
                  setTaskPage(1);
                }}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-[#1E293B] focus:outline-hidden focus:ring-2 focus:ring-blue-100 focus:border-blue-600 cursor-pointer"
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
                value={taskDueDateFilter}
                onChange={(e) => {
                  setTaskDueDateFilter(e.target.value);
                  setTaskPage(1);
                }}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-[#1E293B] focus:outline-hidden focus:ring-2 focus:ring-blue-100 focus:border-blue-600 cursor-pointer"
              >
                <option value="ALL">All Due Dates</option>
                <option value="upcoming">Upcoming</option>
                <option value="past_due">Past Due</option>
                <option value="overdue">⚠️ Overdue Only</option>
              </select>
            </div>

            {/* Assignee Filter */}
            <div>
              <select
                value={taskAssigneeFilter}
                onChange={(e) => {
                  setTaskAssigneeFilter(e.target.value);
                  setTaskPage(1);
                }}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-[#1E293B] focus:outline-hidden focus:ring-2 focus:ring-blue-100 focus:border-blue-600 cursor-pointer"
              >
                <option value="ALL">All Assignees</option>
                {Array.from(assignableMembersMap.values()).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Tabs and Quick Reset */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {['ALL', 'To Do', 'In Progress', 'Completed'].map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => {
                    setTaskStatusFilter(status);
                    setTaskPage(1);
                  }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                    taskStatusFilter === status
                      ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-xs'
                      : 'bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {status === 'ALL' ? 'All Status' : status}
                </button>
              ))}
            </div>

            {hasActiveTaskFilters && (
              <button
                type="button"
                onClick={handleResetTaskFilters}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold cursor-pointer"
              >
                Clear all filters
              </button>
            )}
          </div>
        </div>

        {tasksLoading ? (
          <div className="flex items-center justify-center p-12 text-sm text-slate-500 dark:text-slate-400">
            <svg className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400 mr-2.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <span>Loading tasks from database...</span>
          </div>
        ) : tasks.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            {hasActiveTaskFilters ? (
              <>
                <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">No tasks match your filters</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                  Try adjusting your search terms, status, priority, due date or assignee filters.
                </p>
                <button
                  type="button"
                  onClick={handleResetTaskFilters}
                  className="mt-4 btn-secondary text-xs"
                >
                  Reset all filters
                </button>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm font-semibold text-slate-900 dark:text-slate-100">No tasks created yet</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Create tasks and assign them to one or more team members to start tracking progress.</p>
                {isManager && (
                  <button
                    onClick={() => setShowTaskModal(true)}
                    className="mt-4 btn-primary text-xs"
                  >
                    + Add First Task
                  </button>
                )}
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/70 dark:bg-slate-800/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Task Title</th>
                  <th className="px-6 py-3.5">Assigned Members</th>
                  <th className="px-6 py-3.5">Priority</th>
                  <th className="px-6 py-3.5">Due Date</th>
                  <th className="px-6 py-3.5">Status (Click to cycle)</th>
                  {isManager && <th className="px-6 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {tasks.map((task) => {
                  const taskId = task._id || task.id;
                  const assignees = getTaskAssignees(task);
                  const formattedDue = task.dueDate
                    ? new Date(task.dueDate).toISOString().split('T')[0]
                    : 'No due date';

                  return (
                    <tr key={taskId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100">
                        <div>
                          <span>{task.title}</span>
                          {task.description && (
                            <p className="text-[11px] font-normal text-slate-500 dark:text-slate-400 line-clamp-1">{task.description}</p>
                          )}
                        </div>
                      </td>

                      {/* Multiple assignees badge & avatar list */}
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {assignees.length === 0 ? (
                          <span className="text-slate-400 dark:text-slate-500 italic">Unassigned</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {assignees.map((assignee) => {
                              const aId = assignee._id || assignee.id;
                              const aName = assignee.name || 'Member';
                              return (
                                <div
                                  key={aId}
                                  className="inline-flex items-center gap-1 rounded-md border border-blue-200/60 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:text-blue-300"
                                  title={assignee.email || aName}
                                >
                                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">
                                    {aName.charAt(0).toUpperCase()}
                                  </span>
                                  <span>{aName}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        <PriorityBadge priority={task.priority} />
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formattedDue}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => handleTaskStatusCycle(taskId, task.status)}
                          className="cursor-pointer transition-transform active:scale-95"
                          title="Click to cycle status"
                        >
                          <TaskStatusBadge status={task.status} />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          {/* File Attachments Button */}
                          <button
                            type="button"
                            onClick={() => setAttachmentModalTask(task)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:border-blue-200 dark:hover:border-blue-800 transition-colors cursor-pointer"
                            title="Manage task attachments"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                            </svg>
                            <span>
                              Files {task.attachments?.length > 0 && `(${task.attachments.length})`}
                            </span>
                          </button>

                          {/* Task Comments Button */}
                          <button
                            type="button"
                            onClick={() => setCommentModalTask(task)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50 hover:border-blue-200 dark:hover:border-blue-800 transition-colors cursor-pointer"
                            title="Discuss and view task comments"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <span>Comments</span>
                          </button>

                          {isManager && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenEditTask(task)}
                                className="rounded-lg border border-slate-200 dark:border-slate-700 px-2.5 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-blue-600 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => handleOpenDeleteTask(task)}
                                className="rounded-lg border border-red-200 bg-red-50/50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors cursor-pointer"
                                title="Delete task"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Task Pagination Bar */}
        {taskTotalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800 px-6 py-3.5 bg-slate-50/50 dark:bg-slate-900/50">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Showing page <strong className="font-semibold text-slate-900 dark:text-slate-100">{taskPage}</strong> of{' '}
              <strong className="font-semibold text-slate-900 dark:text-slate-100">{taskTotalPages}</strong> ({taskTotalItems} total)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={taskPage <= 1}
                onClick={() => setTaskPage((p) => Math.max(1, p - 1))}
                className="btn-secondary text-xs py-1 px-3 disabled:opacity-50 cursor-pointer"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={taskPage >= taskTotalPages}
                onClick={() => setTaskPage((p) => p + 1)}
                className="btn-secondary text-xs py-1 px-3 disabled:opacity-50 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Project Activity Timeline (Phase 3) ── */}
      <ActivityFeed
        projectId={projectId}
        orgId={project?.orgId?._id || project?.orgId}
        refreshTrigger={activityRefreshTrigger}
      />

      {/* ── Manage Team Modal ── */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-xl animate-in fade-in zoom-in-95 duration-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Manage Project Team</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Add or remove verified organisation members for this project</p>
              </div>
              <button
                onClick={() => setShowTeamModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Team Error Banner */}
            {teamModalError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300 animate-in fade-in duration-150">
                <svg className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{teamModalError}</span>
              </div>
            )}

            {/* Team Success Banner */}
            {teamModalSuccess && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-700 dark:text-emerald-300 animate-in fade-in duration-150">
                <svg className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{teamModalSuccess}</span>
              </div>
            )}

            {/* Current Members Section */}
            <div className="mt-4 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Current Project Members ({assignedTeam.length})
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 max-h-48 overflow-y-auto">
                {assignedTeam.length === 0 ? (
                  <p className="p-3 text-xs text-slate-400 dark:text-slate-500">No members currently in this project.</p>
                ) : (
                  assignedTeam.map((member) => {
                    const id = typeof member === 'object' ? member._id || member.id : member;
                    const name = typeof member === 'object' ? member.name : 'Team Member';
                    const email = typeof member === 'object' ? member.email : '';
                    return (
                      <div key={id} className="flex items-center justify-between p-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/50">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/60 text-xs font-bold text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/60">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{name}</p>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400">{email}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={teamLoading}
                          onClick={() => handleRemoveMember(id)}
                          className="rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 px-2 py-1 text-[11px] font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          Remove
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Add New Members Section */}
            <div className="mt-5 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Add Organisation Members
              </h3>
              {availableOrgEmployees.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-4 text-center text-xs text-slate-500 dark:text-slate-400">
                  All organisation members are already in this project team.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800 max-h-40 overflow-y-auto">
                    {availableOrgEmployees.map((emp) => {
                      const id = emp.userId || emp._id || emp.id;
                      const isSelected = selectedToAdd.includes(id);
                      return (
                        <label
                          key={id}
                          className="flex items-center justify-between p-2.5 hover:bg-slate-50/70 dark:hover:bg-slate-800/50 cursor-pointer"
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {
                                setSelectedToAdd((prev) =>
                                  isSelected ? prev.filter((i) => i !== id) : [...prev, id]
                                );
                              }}
                              className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-900"
                            />
                            <div>
                              <p className="text-xs font-medium text-slate-900 dark:text-slate-100">{emp.name}</p>
                              <p className="text-[10px] text-slate-500 dark:text-slate-400">{emp.email}</p>
                            </div>
                          </div>
                          <span className="text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                            {emp.role || 'Member'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMembers}
                    disabled={selectedToAdd.length === 0 || teamLoading}
                    className="w-full btn-primary text-xs justify-center disabled:opacity-50"
                  >
                    {teamLoading ? 'Updating Team...' : `Add Selected (${selectedToAdd.length}) to Project`}
                  </button>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-4 mt-5 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setShowTeamModal(false)}
                className="btn-secondary text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Task Modal (Multi-Assignee Support) ── */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-xl animate-in fade-in zoom-in-95 duration-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Create New Task</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Assign milestone to one or multiple project team members</p>
              </div>
              <button
                onClick={() => setShowTaskModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Error Banner */}
            {taskModalError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300 animate-in fade-in duration-150">
                <svg className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{taskModalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTask} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Task Title</label>
                <input
                  type="text"
                  name="title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="e.g. Implement payment gateway"
                  required
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Description (Optional)</label>
                <textarea
                  name="description"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  rows={2}
                  placeholder="Brief details or acceptance criteria..."
                  className="input-field text-sm"
                />
              </div>

              {/* Multi-Assignee Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Assign Team Members ({newTask.assignedTo.length} selected)
                  </label>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">Multi-select</span>
                </div>

                {allAssignableMembers.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 p-2.5 text-center text-xs text-amber-700 dark:text-amber-300">
                    No employees found in this organisation yet. Add employees on the Employees page.
                  </p>
                ) : (
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 p-2 space-y-1 bg-slate-50/50 dark:bg-slate-900/50">
                    {allAssignableMembers.map((emp) => {
                      const id = emp._id || emp.id;
                      const name = emp.name;
                      const email = emp.email;
                      const isSelected = newTask.assignedTo.includes(id);

                      return (
                        <label
                          key={id}
                          className={`flex items-center gap-2 rounded-lg p-2 text-xs transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 font-medium border border-blue-200/60 dark:border-blue-800/60'
                              : 'hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleAssignee(id)}
                            className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-900"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="truncate">{name}</span>
                            {email && <span className="ml-1 text-[10px] text-slate-400 dark:text-slate-500">({email})</span>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Priority</label>
                  <select
                    name="priority"
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    className="input-field text-sm cursor-pointer"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Initial Status</label>
                  <select
                    name="status"
                    value={newTask.status}
                    onChange={(e) => setNewTask({ ...newTask, status: e.target.value })}
                    className="input-field text-sm cursor-pointer"
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Due Date</label>
                <input
                  type="date"
                  name="dueDate"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  className="input-field text-sm cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  disabled={taskSubmitting}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={taskSubmitting}
                  className={`btn-primary text-xs ${taskSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {taskSubmitting ? 'Creating Task...' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit Task Modal (Multi-Assignee & Field Updates) ── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-xl animate-in fade-in zoom-in-95 duration-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Edit Task</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Update task details, assignees and milestones</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Error Banner */}
            {editModalError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300 animate-in fade-in duration-150">
                <svg className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{editModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditTask} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Task Title</label>
                <input
                  type="text"
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  required
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Description</label>
                <textarea
                  value={editingTask.description}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                  rows={2}
                  className="input-field text-sm"
                />
              </div>

              {/* Multi-Assignee Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                    Assigned Team Members ({editingTask.assignedTo.length} selected)
                  </label>
                  <span className="text-[11px] text-slate-400 dark:text-slate-500">Multi-select</span>
                </div>

                <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 p-2 space-y-1 bg-slate-50/50 dark:bg-slate-900/50">
                  {allAssignableMembers.map((emp) => {
                    const id = emp._id || emp.id;
                    const name = emp.name;
                    const email = emp.email;
                    const isSelected = editingTask.assignedTo.includes(id);

                    return (
                      <label
                        key={id}
                        className={`flex items-center gap-2 rounded-lg p-2 text-xs transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 font-medium border border-blue-200/60 dark:border-blue-800/60'
                            : 'hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleEditAssignee(id)}
                          className="rounded border-slate-300 dark:border-slate-700 text-blue-600 focus:ring-blue-500 bg-white dark:bg-slate-900"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="truncate">{name}</span>
                          {email && <span className="ml-1 text-[10px] text-slate-400 dark:text-slate-500">({email})</span>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Priority</label>
                  <select
                    value={editingTask.priority}
                    onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value })}
                    className="input-field text-sm cursor-pointer"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Status</label>
                  <select
                    value={editingTask.status}
                    onChange={(e) => setEditingTask({ ...editingTask, status: e.target.value })}
                    className="input-field text-sm cursor-pointer"
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Due Date</label>
                <input
                  type="date"
                  value={editingTask.dueDate}
                  onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                  className="input-field text-sm cursor-pointer"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  disabled={editTaskSubmitting}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editTaskSubmitting}
                  className={`btn-primary text-xs ${editTaskSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {editTaskSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Task File Attachments Modal (Phase 4) ── */}
      {attachmentModalTask && (
        <TaskAttachmentsModal
          task={attachmentModalTask}
          canDelete={isManager}
          onClose={() => setAttachmentModalTask(null)}
          onAttachmentsUpdated={(taskId, updatedAttachments) => {
            setTasks((prev) =>
              prev.map((t) => ((t._id || t.id) === taskId ? { ...t, attachments: updatedAttachments } : t))
            );
            setAttachmentModalTask((prev) => (prev ? { ...prev, attachments: updatedAttachments } : null));
          }}
        />
      )}

      {/* ── Edit Project Modal ── */}
      {showEditProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-xl animate-in fade-in zoom-in-95 duration-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Edit Project</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Update project information and status</p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditProjectModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Error Banner */}
            {editProjectError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300 animate-in fade-in duration-150">
                <svg className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{editProjectError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProject} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Project Name</label>
                <input
                  type="text"
                  value={editProjectData.name}
                  onChange={(e) => setEditProjectData({ ...editProjectData, name: e.target.value })}
                  placeholder="e.g. Website Redesign"
                  required
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Description (Optional)</label>
                <textarea
                  value={editProjectData.description}
                  onChange={(e) => setEditProjectData({ ...editProjectData, description: e.target.value })}
                  rows={3}
                  placeholder="Brief project summary or objectives..."
                  className="input-field text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Status</label>
                  <select
                    value={editProjectData.status}
                    onChange={(e) => setEditProjectData({ ...editProjectData, status: e.target.value })}
                    className="input-field text-sm cursor-pointer"
                  >
                    <option value="Planning">Planning</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Deadline</label>
                  <input
                    type="date"
                    value={editProjectData.deadline}
                    onChange={(e) => setEditProjectData({ ...editProjectData, deadline: e.target.value })}
                    className="input-field text-sm cursor-pointer"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditProjectModal(false)}
                  disabled={editProjectSubmitting}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editProjectSubmitting}
                  className={`btn-primary text-xs ${editProjectSubmitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {editProjectSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Project Confirmation Modal ── */}
      {showDeleteProjectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-100 dark:border-red-950/60 bg-white dark:bg-[#111827] p-6 shadow-xl animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Delete Project</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">This action is permanent and cannot be undone</p>
              </div>
            </div>

            {deleteProjectError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300 animate-in fade-in duration-150">
                <svg className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{deleteProjectError}</span>
              </div>
            )}

            <div className="mt-4 rounded-xl border border-red-100 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/30 p-3.5 text-xs text-red-900 dark:text-red-300 leading-relaxed">
              <p>
                Are you sure you want to delete project <strong className="font-semibold text-red-950 dark:text-red-200">"{project.name}"</strong>?
              </p>
              <p className="mt-2 text-[11px] text-red-700 dark:text-red-400">
                All associated tasks ({tasks.length}) and uploaded task attachments will be permanently removed from the system.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteProjectModal(false)}
                disabled={deleteProjectSubmitting}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteProject}
                disabled={deleteProjectSubmitting}
                className="btn-danger text-xs"
              >
                {deleteProjectSubmitting ? 'Deleting Project...' : 'Delete Project'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Task Confirmation Modal ── */}
      {taskToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-100 dark:border-red-950/60 bg-white dark:bg-[#111827] p-6 shadow-xl animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Delete Task</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Confirm task removal from project backlog</p>
              </div>
            </div>

            {deleteTaskError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300 animate-in fade-in duration-150">
                <svg className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{deleteTaskError}</span>
              </div>
            )}

            <div className="mt-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/60 p-3.5 text-xs text-slate-900 dark:text-slate-100 leading-relaxed">
              <p>
                Are you sure you want to delete <strong className="font-semibold text-slate-900 dark:text-slate-100">"{taskToDelete.title}"</strong>?
              </p>
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                This will remove the task and any attached files. Project progress metrics will be recalculated automatically.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setTaskToDelete(null)}
                disabled={deleteTaskSubmitting}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteTask}
                disabled={deleteTaskSubmitting}
                className="btn-danger text-xs"
              >
                {deleteTaskSubmitting ? 'Deleting Task...' : 'Delete Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Task Comments Modal (Phase 3) ── */}
      {commentModalTask && (
        <TaskCommentsModal
          task={commentModalTask}
          onClose={() => setCommentModalTask(null)}
          onCommentAdded={() => setActivityRefreshTrigger((prev) => prev + 1)}
        />
      )}
    </div>
  );
}

/* ── Badges ── */
function StatusBadge({ status }) {
  const styles = {
    Completed: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
    'In Progress': 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
    Planning: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium shrink-0 ${
        styles[status] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
      }`}
    >
      {status}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const styles = {
    High: 'bg-red-50 dark:bg-red-950/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60',
    Medium: 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60',
    Low: 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
        styles[priority] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
      }`}
    >
      {priority}
    </span>
  );
}

function TaskStatusBadge({ status }) {
  const styles = {
    Completed: 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60',
    'In Progress': 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/60',
    'To Do': 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    Pending: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
        styles[status] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === 'Completed'
            ? 'bg-emerald-500'
            : status === 'In Progress'
            ? 'bg-blue-600 dark:bg-blue-400'
            : 'bg-slate-400 dark:bg-slate-500'
        }`}
      />
      {status}
    </span>
  );
}

export default ProjectDetails;
