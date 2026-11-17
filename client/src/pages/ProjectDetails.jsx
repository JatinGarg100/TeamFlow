import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  fetchProjectByIdApi,
  updateProjectApi,
  fetchProjectTasksApi,
  createTaskApi,
  updateTaskStatusApi,
  updateTaskApi,
  fetchProjectProgressApi,
  addProjectMembersApi,
  removeProjectMemberApi,
  fetchOrgMembers,
  getStoredAuth,
} from '../services/api';

/**
 * ProjectDetails page
 * ───────────────────
 * Connected to:
 * - GET /api/projects/:projectId
 * - PATCH /api/projects/:projectId
 * - POST /api/projects/:projectId/members
 * - DELETE /api/projects/:projectId/members/:userId
 * - GET /api/projects/:projectId/tasks
 * - POST /api/projects/:projectId/tasks
 * - PATCH /api/tasks/:taskId
 * - GET /api/projects/:projectId/progress
 */
function ProjectDetails() {
  const { projectId } = useParams();
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

  const auth = getStoredAuth();
  const currentUserId = auth?.user?.id || auth?.user?._id;
  const userRole = auth?.organisation?.role || 'member';
  const isManager = ['owner', 'admin', 'manager'].includes(userRole);

  // Load Organisation Employees so all company members appear in task assignees
  const loadOrgEmployees = useCallback(async (targetOrgId) => {
    try {
      const orgId = targetOrgId || project?.orgId?._id || project?.orgId || auth?.organisation?.id;
      if (orgId) {
        const members = await fetchOrgMembers(orgId);
        setOrgEmployees(members || []);
      }
    } catch (err) {
      console.warn('Failed to load org employees:', err);
    }
  }, [project?.orgId, auth?.organisation?.id]);

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

  // 2. Load Tasks and Calculate Live Progress
  const loadTasksAndProgress = useCallback(async () => {
    setTasksLoading(true);
    try {
      const [tasksData, progressData] = await Promise.all([
        fetchProjectTasksApi(projectId),
        fetchProjectProgressApi(projectId),
      ]);
      setTasks(tasksData);
      setProgress(progressData);
    } catch (err) {
      console.warn('Tasks/progress loading error:', err);
    } finally {
      setTasksLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadProject();
    loadTasksAndProgress();
    loadOrgEmployees();
  }, [loadProject, loadTasksAndProgress, loadOrgEmployees]);

  // Handle project status update (Planning, In Progress, Completed)
  const handleProjectStatusChange = async (newStatus) => {
    if (!project) return;
    setUpdatingStatus(true);
    setFeedback({ type: '', message: '' });

    try {
      const targetId = project._id || project.id;
      const updated = await updateProjectApi(targetId, { status: newStatus });
      setProject(updated);
      setFeedback({
        type: 'success',
        message: `Project status updated to "${newStatus}"!`,
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
      const orgId = project?.orgId?._id || project?.orgId || auth?.organisation?.id;
      const members = await fetchOrgMembers(orgId);
      setOrgEmployees(members || []);
    } catch (err) {
      setTeamModalError(err.message || 'Failed to fetch organisation members.');
    } finally {
      setTeamLoading(false);
    }
  };

  // Add members to project
  const handleAddMembers = async () => {
    if (selectedToAdd.length === 0) return;
    setTeamModalError('');
    setTeamModalSuccess('');
    setTeamLoading(true);
    try {
      const updated = await addProjectMembersApi(projectId, selectedToAdd);
      setProject(updated);
      setSelectedToAdd([]);
      setTeamModalSuccess('Team members added to project successfully!');
      setTimeout(() => setTeamModalSuccess(''), 3000);
      await loadProject();
    } catch (err) {
      setTeamModalError(err.message || 'Failed to add members to project.');
    } finally {
      setTeamLoading(false);
    }
  };

  // Remove member from project with active task safety validation
  const handleRemoveMember = async (userId) => {
    setTeamModalError('');
    setTeamModalSuccess('');
    setTeamLoading(true);
    try {
      const updated = await removeProjectMemberApi(projectId, userId);
      setProject(updated);
      setTeamModalSuccess('Member removed from project.');
      setTimeout(() => setTeamModalSuccess(''), 3000);
    } catch (err) {
      setTeamModalError(err.message || 'Cannot remove member.');
    } finally {
      setTeamLoading(false);
    }
  };

  // Handle Create Task multi-assignee selection
  const handleToggleAssignee = (userId) => {
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

  // Handle Edit Task multi-assignee selection
  const handleToggleEditAssignee = (userId) => {
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

  // Handle Create Task submission
  const handleCreateTask = async (e) => {
    e.preventDefault();
    setTaskModalError('');

    if (!newTask.title.trim()) {
      setTaskModalError('Please enter a task title.');
      return;
    }

    setTaskSubmitting(true);
    try {
      await createTaskApi(projectId, {
        title: newTask.title,
        description: newTask.description,
        assignedTo: newTask.assignedTo,
        priority: newTask.priority,
        dueDate: newTask.dueDate || null,
        status: newTask.status,
      });

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
      setFeedback({
        type: 'success',
        message: 'Task created and assignees notified via email! Progress recalculated.',
      });
      setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
    } catch (err) {
      setTaskModalError(err.message || 'Failed to create task.');
    } finally {
      setTaskSubmitting(false);
    }
  };

  // Open Edit Task modal
  const handleOpenEditTask = (task) => {
    setEditModalError('');
    // Normalize assignedTo to array of string IDs
    const assignees = Array.isArray(task.assignedTo)
      ? task.assignedTo.map((u) => (typeof u === 'object' ? u._id || u.id : u))
      : task.assignedTo
      ? [typeof task.assignedTo === 'object' ? task.assignedTo._id || task.assignedTo.id : task.assignedTo]
      : [];

    setEditingTask({
      _id: task._id || task.id,
      title: task.title || '',
      description: task.description || '',
      assignedTo: assignees,
      priority: task.priority || 'Medium',
      dueDate: task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '',
      status: task.status || 'To Do',
    });
    setShowEditModal(true);
  };

  // Handle Save Edit Task
  const handleSaveEditTask = async (e) => {
    e.preventDefault();
    setEditModalError('');

    if (!editingTask.title.trim()) {
      setEditModalError('Please enter a task title.');
      return;
    }

    setEditTaskSubmitting(true);
    try {
      await updateTaskApi(editingTask._id, {
        title: editingTask.title,
        description: editingTask.description,
        assignedTo: editingTask.assignedTo,
        priority: editingTask.priority,
        dueDate: editingTask.dueDate || null,
        status: editingTask.status,
      });

      setShowEditModal(false);
      await Promise.all([loadTasksAndProgress(), loadProject()]);
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
      <div className="flex items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white p-12 text-sm text-[#64748B]">
        <svg className="h-5 w-5 animate-spin text-[#5B4BDB] mr-2" fill="none" viewBox="0 0 24 24">
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
      <div className="flex flex-col items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center shadow-xs">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="mt-4 text-base font-semibold text-[#1E202A]">Unable to access project</h2>
        <p className="mt-1 text-xs text-[#64748B] max-w-md">
          {error || 'The requested project could not be found or you do not have permission to view it.'}
        </p>
        <Link to="/projects" className="mt-4 btn-primary">
          ← Back to Projects
        </Link>
      </div>
    );
  }

  const assignedTeam = Array.isArray(project.teamMembers) ? project.teamMembers : [];
  const assignedTeamIds = assignedTeam.map((m) =>
    (typeof m === 'object' ? m._id || m.id || m.userId : m)?.toString()
  );
  const availableOrgEmployees = orgEmployees.filter((emp) => {
    const empId = (emp.userId || emp._id || emp.id)?.toString();
    return !assignedTeamIds.includes(empId);
  });

  // Combine organisation employees and project members so ALL employees are immediately assignable
  const assignableMembersMap = new Map();

  // 1. Add all organisation employees
  orgEmployees.forEach((emp) => {
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

  // 2. Add any project team members
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
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#5B4BDB] hover:text-[#4A3ABF] transition-colors"
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
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-xs animate-in fade-in duration-200 ${
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
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight text-[#1E202A]">
                {project.name}
              </h1>
              <StatusBadge status={project.status} />
            </div>
            <p className="mt-1 text-sm text-[#64748B] leading-relaxed max-w-3xl">
              {project.description || 'No detailed description provided.'}
            </p>
          </div>

          {/* Project Status Updater for Managers */}
          <div className="shrink-0 flex items-center gap-2">
            <label className="text-xs font-medium text-[#64748B]">Project Status:</label>
            <select
              value={project.status}
              disabled={!isManager || updatingStatus}
              onChange={(e) => handleProjectStatusChange(e.target.value)}
              className="rounded-lg border border-[#E2E8F0] bg-white px-3 py-1.5 text-xs font-semibold text-[#1E202A] outline-none transition-all focus:border-[#5B4BDB] focus:ring-2 focus:ring-[#EEEDFD] cursor-pointer"
            >
              <option value="Planning">Planning</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>

        {/* Milestone & Live Calculated Progress Metrics */}
        <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[#F1F5F9] text-xs">
          <div>
            <span className="block text-[11px] uppercase font-semibold text-[#64748B]">Calculated Progress</span>
            <span className="mt-0.5 text-lg font-bold text-[#5B4BDB]">{progress.percentage}%</span>
          </div>
          <div>
            <span className="block text-[11px] uppercase font-semibold text-[#64748B]">Total Tasks</span>
            <span className="mt-0.5 text-lg font-bold text-[#1E202A]">{progress.totalTasks}</span>
          </div>
          <div>
            <span className="block text-[11px] uppercase font-semibold text-[#64748B]">Completed Tasks</span>
            <span className="mt-0.5 text-lg font-bold text-emerald-600">{progress.completedTasks}</span>
          </div>
          <div>
            <span className="block text-[11px] uppercase font-semibold text-[#64748B]">Pending Tasks</span>
            <span className="mt-0.5 text-lg font-bold text-amber-600">{progress.pendingTasks}</span>
          </div>
        </div>

        {/* Live Dynamic Progress Bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-[#64748B] mb-1.5">
            <span>Progress = {progress.completedTasks} / {progress.totalTasks} tasks completed</span>
            <span className="font-semibold text-[#1E202A]">{progress.percentage}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-[#5B4BDB] transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* ── Assigned Team Members Card ── */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#1E202A] uppercase tracking-wider">
              Assigned Project Team ({assignedTeam.length})
            </h2>
            <p className="text-xs text-[#64748B] mt-0.5">
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
          <p className="mt-4 text-xs text-[#64748B]">No members assigned to this project yet.</p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-3">
            {assignedTeam.map((member) => {
              const name = typeof member === 'object' ? member.name : 'Team Member';
              const email = typeof member === 'object' ? member.email : '';
              const id = typeof member === 'object' ? member._id || member.id : member;

              return (
                <div
                  key={id}
                  className="flex items-center gap-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-2"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEEDFD] text-xs font-bold text-[#5B4BDB]">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-[#1E202A] leading-tight">{name}</p>
                    {email && <p className="text-[11px] text-[#64748B] leading-tight">{email}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Task Backlog & Live Task Table ── */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[#E2E8F0] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#1E202A]">Project Tasks &amp; Milestones</h2>
            <p className="text-xs text-[#64748B]">
              Any assigned member can update status (To Do ➔ In Progress ➔ Completed). Progress updates automatically.
            </p>
          </div>
          {isManager && (
            <button
              onClick={() => {
                setTaskModalError('');
                setShowTaskModal(true);
              }}
              className="btn-primary shrink-0 self-start sm:self-auto"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              <span>Create Task</span>
            </button>
          )}
        </div>

        {tasksLoading ? (
          <div className="flex items-center justify-center p-12 text-sm text-[#64748B]">
            <svg className="h-5 w-5 animate-spin text-[#5B4BDB] mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <span>Loading tasks from database...</span>
          </div>
        ) : tasks.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-[#64748B]">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="mt-3 text-sm font-semibold text-[#1E202A]">No tasks created yet</p>
            <p className="mt-1 text-xs text-[#64748B]">Create tasks and assign them to one or more team members to start tracking progress.</p>
            {isManager && (
              <button
                onClick={() => setShowTaskModal(true)}
                className="mt-4 btn-primary text-xs"
              >
                + Add First Task
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-wider text-[#64748B] border-b border-[#E2E8F0]">
                <tr>
                  <th className="px-6 py-3.5">Task Title</th>
                  <th className="px-6 py-3.5">Assigned Members</th>
                  <th className="px-6 py-3.5">Priority</th>
                  <th className="px-6 py-3.5">Due Date</th>
                  <th className="px-6 py-3.5">Status (Click to cycle)</th>
                  {isManager && <th className="px-6 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {tasks.map((task) => {
                  const taskId = task._id || task.id;
                  const assignees = getTaskAssignees(task);
                  const formattedDue = task.dueDate
                    ? new Date(task.dueDate).toISOString().split('T')[0]
                    : 'No due date';

                  return (
                    <tr key={taskId} className="hover:bg-[#F8FAFC]/80 transition-colors">
                      <td className="px-6 py-4 font-medium text-[#1E202A]">
                        <div>
                          <span>{task.title}</span>
                          {task.description && (
                            <p className="text-[11px] font-normal text-[#64748B] line-clamp-1">{task.description}</p>
                          )}
                        </div>
                      </td>

                      {/* Multiple assignees badge & avatar list */}
                      <td className="px-6 py-4 text-xs text-[#64748B] whitespace-nowrap">
                        {assignees.length === 0 ? (
                          <span className="text-gray-400 italic">Unassigned</span>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {assignees.map((assignee) => {
                              const aId = assignee._id || assignee.id;
                              const aName = assignee.name || 'Member';
                              return (
                                <div
                                  key={aId}
                                  className="inline-flex items-center gap-1 rounded-md border border-[#E2E8F0] bg-[#EEEDFD]/50 px-2 py-0.5 text-[11px] font-medium text-[#5B4BDB]"
                                  title={assignee.email || aName}
                                >
                                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#5B4BDB] text-[9px] font-bold text-white">
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
                      <td className="px-6 py-4 text-xs text-[#64748B] whitespace-nowrap">
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
                      {isManager && (
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenEditTask(task)}
                            className="rounded-lg border border-[#E2E8F0] px-2.5 py-1 text-xs font-medium text-[#64748B] hover:border-[#5B4BDB] hover:text-[#5B4BDB] transition-colors"
                          >
                            Edit
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Manage Team Modal ── */}
      {showTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div>
                <h2 className="text-base font-semibold text-[#1E202A]">Manage Project Team</h2>
                <p className="text-xs text-[#64748B]">Add or remove verified organisation members for this project</p>
              </div>
              <button
                onClick={() => setShowTeamModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Team Error Banner */}
            {teamModalError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 animate-in fade-in duration-150">
                <svg className="h-4 w-4 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{teamModalError}</span>
              </div>
            )}

            {/* Team Success Banner */}
            {teamModalSuccess && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700 animate-in fade-in duration-150">
                <svg className="h-4 w-4 shrink-0 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{teamModalSuccess}</span>
              </div>
            )}

            {/* Current Members Section */}
            <div className="mt-4 space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                Current Project Members ({assignedTeam.length})
              </h3>
              <div className="divide-y divide-[#E2E8F0] rounded-xl border border-[#E2E8F0] max-h-48 overflow-y-auto">
                {assignedTeam.length === 0 ? (
                  <p className="p-3 text-xs text-gray-500">No members currently in this project.</p>
                ) : (
                  assignedTeam.map((member) => {
                    const id = typeof member === 'object' ? member._id || member.id : member;
                    const name = typeof member === 'object' ? member.name : 'Team Member';
                    const email = typeof member === 'object' ? member.email : '';
                    return (
                      <div key={id} className="flex items-center justify-between p-3 hover:bg-[#F8FAFC]">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EEEDFD] text-xs font-bold text-[#5B4BDB]">
                            {name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-[#1E202A]">{name}</p>
                            <p className="text-[11px] text-[#64748B]">{email}</p>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={teamLoading}
                          onClick={() => handleRemoveMember(id)}
                          className="rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
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
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#64748B]">
                Add Organisation Members
              </h3>
              {availableOrgEmployees.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#E2E8F0] p-4 text-center text-xs text-[#64748B]">
                  All organisation members are already in this project team.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="divide-y divide-[#E2E8F0] rounded-xl border border-[#E2E8F0] max-h-40 overflow-y-auto">
                    {availableOrgEmployees.map((emp) => {
                      const id = emp.userId || emp._id || emp.id;
                      const isSelected = selectedToAdd.includes(id);
                      return (
                        <label
                          key={id}
                          className="flex items-center justify-between p-2.5 hover:bg-[#F8FAFC] cursor-pointer"
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
                              className="rounded border-[#CBD5E1] text-[#5B4BDB] focus:ring-[#5B4BDB]"
                            />
                            <div>
                              <p className="text-xs font-medium text-[#1E202A]">{emp.name}</p>
                              <p className="text-[10px] text-[#64748B]">{emp.email}</p>
                            </div>
                          </div>
                          <span className="text-[10px] uppercase font-semibold text-[#64748B] bg-gray-100 px-2 py-0.5 rounded">
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

            <div className="flex justify-end pt-4 mt-5 border-t border-[#E2E8F0]">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div>
                <h2 className="text-base font-semibold text-[#1E202A]">Create New Task</h2>
                <p className="text-xs text-[#64748B]">Assign milestone to one or multiple project team members</p>
              </div>
              <button
                onClick={() => setShowTaskModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Error Banner */}
            {taskModalError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 animate-in fade-in duration-150">
                <svg className="h-4 w-4 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{taskModalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateTask} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#1E202A]">Task Title</label>
                <input
                  type="text"
                  name="title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="e.g. Implement payment gateway"
                  required
                  className="w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2 text-sm text-[#1E202A] outline-none transition-all focus:border-[#5B4BDB] focus:ring-2 focus:ring-[#EEEDFD]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#1E202A]">Description (Optional)</label>
                <textarea
                  name="description"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  rows={2}
                  placeholder="Brief details or acceptance criteria..."
                  className="w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2 text-sm text-[#1E202A] outline-none transition-all focus:border-[#5B4BDB] focus:ring-2 focus:ring-[#EEEDFD]"
                />
              </div>

              {/* Multi-Assignee Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-[#1E202A]">
                    Assign Team Members ({newTask.assignedTo.length} selected)
                  </label>
                  <span className="text-[11px] text-[#64748B]">Multi-select</span>
                </div>

                {allAssignableMembers.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-amber-200 bg-amber-50 p-2.5 text-center text-xs text-amber-700">
                    No employees found in this organisation yet. Add employees on the Employees page.
                  </p>
                ) : (
                  <div className="max-h-36 overflow-y-auto rounded-lg border border-[#E2E8F0] p-2 space-y-1">
                    {allAssignableMembers.map((emp) => {
                      const id = emp._id || emp.id;
                      const name = emp.name;
                      const email = emp.email;
                      const isSelected = newTask.assignedTo.includes(id);

                      return (
                        <label
                          key={id}
                          className={`flex items-center gap-2 rounded-lg p-2 text-xs transition-colors cursor-pointer ${
                            isSelected ? 'bg-[#EEEDFD] text-[#5B4BDB] font-medium' : 'hover:bg-gray-50 text-[#1E202A]'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleAssignee(id)}
                            className="rounded border-[#CBD5E1] text-[#5B4BDB] focus:ring-[#5B4BDB]"
                          />
                          <div className="flex-1 min-w-0">
                            <span className="truncate">{name}</span>
                            {email && <span className="ml-1 text-[10px] text-gray-400">({email})</span>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#1E202A]">Priority</label>
                  <select
                    name="priority"
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    className="w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2 text-sm text-[#1E202A] outline-none transition-all focus:border-[#5B4BDB] focus:ring-2 focus:ring-[#EEEDFD]"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#1E202A]">Initial Status</label>
                  <select
                    name="status"
                    value={newTask.status}
                    onChange={(e) => setNewTask({ ...newTask, status: e.target.value })}
                    className="w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2 text-sm text-[#1E202A] outline-none transition-all focus:border-[#5B4BDB] focus:ring-2 focus:ring-[#EEEDFD]"
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#1E202A]">Due Date</label>
                <input
                  type="date"
                  name="dueDate"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  className="w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2 text-sm text-[#1E202A] outline-none transition-all focus:border-[#5B4BDB] focus:ring-2 focus:ring-[#EEEDFD]"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E2E8F0]">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div>
                <h2 className="text-base font-semibold text-[#1E202A]">Edit Task</h2>
                <p className="text-xs text-[#64748B]">Update task details, assignees and milestones</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Error Banner */}
            {editModalError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 animate-in fade-in duration-150">
                <svg className="h-4 w-4 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{editModalError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEditTask} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#1E202A]">Task Title</label>
                <input
                  type="text"
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  required
                  className="w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2 text-sm text-[#1E202A] outline-none transition-all focus:border-[#5B4BDB] focus:ring-2 focus:ring-[#EEEDFD]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#1E202A]">Description</label>
                <textarea
                  value={editingTask.description}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                  rows={2}
                  className="w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2 text-sm text-[#1E202A] outline-none transition-all focus:border-[#5B4BDB] focus:ring-2 focus:ring-[#EEEDFD]"
                />
              </div>

              {/* Multi-Assignee Selection */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium text-[#1E202A]">
                    Assigned Team Members ({editingTask.assignedTo.length} selected)
                  </label>
                  <span className="text-[11px] text-[#64748B]">Multi-select</span>
                </div>

                <div className="max-h-36 overflow-y-auto rounded-lg border border-[#E2E8F0] p-2 space-y-1">
                  {allAssignableMembers.map((emp) => {
                    const id = emp._id || emp.id;
                    const name = emp.name;
                    const email = emp.email;
                    const isSelected = editingTask.assignedTo.includes(id);

                    return (
                      <label
                        key={id}
                        className={`flex items-center gap-2 rounded-lg p-2 text-xs transition-colors cursor-pointer ${
                          isSelected ? 'bg-[#EEEDFD] text-[#5B4BDB] font-medium' : 'hover:bg-gray-50 text-[#1E202A]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleEditAssignee(id)}
                          className="rounded border-[#CBD5E1] text-[#5B4BDB] focus:ring-[#5B4BDB]"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="truncate">{name}</span>
                          {email && <span className="ml-1 text-[10px] text-gray-400">({email})</span>}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#1E202A]">Priority</label>
                  <select
                    value={editingTask.priority}
                    onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value })}
                    className="w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2 text-sm text-[#1E202A] outline-none transition-all focus:border-[#5B4BDB] focus:ring-2 focus:ring-[#EEEDFD]"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#1E202A]">Status</label>
                  <select
                    value={editingTask.status}
                    onChange={(e) => setEditingTask({ ...editingTask, status: e.target.value })}
                    className="w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2 text-sm text-[#1E202A] outline-none transition-all focus:border-[#5B4BDB] focus:ring-2 focus:ring-[#EEEDFD]"
                  >
                    <option value="To Do">To Do</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#1E202A]">Due Date</label>
                <input
                  type="date"
                  value={editingTask.dueDate}
                  onChange={(e) => setEditingTask({ ...editingTask, dueDate: e.target.value })}
                  className="w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2 text-sm text-[#1E202A] outline-none transition-all focus:border-[#5B4BDB] focus:ring-2 focus:ring-[#EEEDFD]"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E2E8F0]">
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
    </div>
  );
}

/* ── Badges ── */
function StatusBadge({ status }) {
  const styles = {
    Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'In Progress': 'bg-[#EEEDFD] text-[#5B4BDB] border-[#DCD9FA]',
    Planning: 'bg-amber-50 text-amber-700 border-amber-200',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium shrink-0 ${
        styles[status] || 'bg-gray-100 text-gray-600 border-gray-200'
      }`}
    >
      {status}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const styles = {
    High: 'bg-red-50 text-red-700 border-red-200',
    Medium: 'bg-amber-50 text-amber-700 border-amber-200',
    Low: 'bg-blue-50 text-blue-700 border-blue-200',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
        styles[priority] || 'bg-gray-100 text-gray-600 border-gray-200'
      }`}
    >
      {priority}
    </span>
  );
}

function TaskStatusBadge({ status }) {
  const styles = {
    Completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'In Progress': 'bg-[#EEEDFD] text-[#5B4BDB] border-[#DCD9FA]',
    'To Do': 'bg-gray-100 text-gray-700 border-gray-200',
    Pending: 'bg-gray-100 text-gray-700 border-gray-200',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
        styles[status] || 'bg-gray-100 text-gray-600 border-gray-200'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          status === 'Completed'
            ? 'bg-emerald-500'
            : status === 'In Progress'
            ? 'bg-[#5B4BDB]'
            : 'bg-gray-400'
        }`}
      />
      {status}
    </span>
  );
}

export default ProjectDetails;
