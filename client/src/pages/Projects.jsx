import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchProjectsApi,
  createProjectApi,
  deleteProjectApi,
  fetchOrgMembers,
  getStoredAuth,
} from '../services/api';
import PaginationControls from '../components/PaginationControls';
import { useDebounce } from '../hooks/useDebounce';

/**
 * Projects Page — Premium SaaS Mixed Theme
 * ─────────────────────────────────────────
 * - Debounced search & server-side filtering
 * - Sorting controls & pagination
 * - Project quota warning for Free tier
 * - Electric Blue accents & crisp slate cards
 * - Manager project deletion & creation modal
 */
function Projects() {
  const [projects, setProjects] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  // Filter, search & pagination state
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 6,
  });

  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    deadline: '',
    status: 'Planning',
    teamMembers: [],
  });

  // Project Deletion State
  const [projectToDelete, setProjectToDelete] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const location = useLocation();
  const auth = getStoredAuth();
  const { organisation: contextOrg, activeOrgId, isManager: contextIsManager, isAuthenticated } = useAuth() || {};
  const currentOrg = contextOrg || auth?.organisation;
  const orgId = activeOrgId || currentOrg?.id || currentOrg?._id;
  const isLoggedIn = isAuthenticated || Boolean(auth?.token && auth?.user);
  const userRole = currentOrg?.role || 'member';
  const isManager = contextIsManager || ['owner', 'admin', 'manager'].includes(userRole);
  const isFreePlan = (currentOrg?.plan || 'free') === 'free';
  const isProjectLimitReached = isFreePlan && (pagination.totalItems >= 3 || projects.length >= 3);

  // Auto-open create modal if navigated from Dashboard with openCreate state
  useEffect(() => {
    if (location.state?.openCreate) {
      setModalError('');
      setShowModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Check if routed back from ProjectDetails with deletedMessage
  useEffect(() => {
    if (location.state?.deletedMessage) {
      setFeedback({ type: 'success', message: location.state.deletedMessage });
      window.history.replaceState({}, document.title);
      setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
    }
  }, [location.state]);

  // Load projects from backend with filters & pagination
  const loadProjects = useCallback(async (pageToLoad = currentPage) => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetchProjectsApi(orgId, {
        page: pageToLoad,
        limit: 6,
        status: statusFilter,
        search: debouncedSearch,
        sortBy,
        sortOrder,
      });

      setProjects(res.projects || []);
      setPagination(
        res.pagination || {
          currentPage: pageToLoad,
          totalPages: 1,
          totalItems: res.projects?.length || 0,
          limit: 6,
        }
      );
    } catch (err) {
      console.error('Failed to load projects:', err);
      setLoadError(err.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [orgId, currentPage, statusFilter, debouncedSearch, sortBy, sortOrder]);

  // Trigger reload when search, filter, or sorting changes
  useEffect(() => {
    setCurrentPage(1);
    loadProjects(1);
  }, [statusFilter, debouncedSearch, sortBy, sortOrder]);

  // Trigger reload on page change
  useEffect(() => {
    loadProjects(currentPage);
  }, [currentPage]);

  // Load available employees to assign in the modal
  const loadEmployees = useCallback(async () => {
    if (!orgId) {
      setEmployees([]);
      return;
    }
    try {
      const res = await fetchOrgMembers(orgId, { limit: 100 });
      const memberList = Array.isArray(res) ? res : (res?.members || res?.data || []);
      setEmployees(Array.isArray(memberList) ? memberList : []);
    } catch (err) {
      console.error('Failed to load organisation employees:', err);
      setEmployees([]);
    }
  }, [orgId]);

  useEffect(() => {
    loadProjects();
    loadEmployees();
  }, [loadProjects, loadEmployees]);

  const handleChange = (e) => {
    setModalError('');
    setNewProject({ ...newProject, [e.target.name]: e.target.value });
  };

  const handleMemberToggle = (userId) => {
    setModalError('');
    setNewProject((prev) => {
      const currentList = Array.isArray(prev.teamMembers) ? prev.teamMembers : [];
      const exists = currentList.includes(userId);
      return {
        ...prev,
        teamMembers: exists
          ? currentList.filter((id) => id !== userId)
          : [...currentList, userId],
      };
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setModalError('');

    const trimmedName = (newProject.name || '').trim();
    if (!trimmedName) {
      setModalError('Project title is required.');
      return;
    }

    if (trimmedName.length < 2) {
      setModalError('Project title must be at least 2 characters long.');
      return;
    }

    if (trimmedName.length > 120) {
      setModalError('Project title cannot exceed 120 characters.');
      return;
    }

    if (isProjectLimitReached) {
      setModalError('Free plan project limit of 3 reached. Please upgrade to Pro on the Plans page to create more projects.');
      return;
    }

    setSubmitting(true);

    try {
      await createProjectApi({
        name: trimmedName,
        description: (newProject.description || '').trim(),
        deadline: newProject.deadline || undefined,
        status: newProject.status || 'Planning',
        teamMembers: Array.isArray(newProject.teamMembers) ? newProject.teamMembers : [],
        orgId,
      });

      setFeedback({
        type: 'success',
        message: `Project "${trimmedName}" created successfully!`,
      });

      // Reset form & close modal only upon successful creation
      setNewProject({
        name: '',
        description: '',
        deadline: '',
        status: 'Planning',
        teamMembers: [],
      });
      setShowModal(false);

      // Refresh project list immediately from page 1
      setCurrentPage(1);
      await loadProjects(1);

      setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
    } catch (err) {
      setModalError(err.message || 'Failed to create project.');
    } finally {
      setSubmitting(false);
    }
  };

  // Confirm delete project
  const handleConfirmDeleteProject = async () => {
    if (!projectToDelete) return;
    setDeleteError('');
    setDeleteSubmitting(true);
    try {
      const pId = projectToDelete._id || projectToDelete.id;
      await deleteProjectApi(pId);
      setProjectToDelete(null);
      setFeedback({
        type: 'success',
        message: `Project "${projectToDelete.name}" and associated tasks were deleted successfully.`,
      });
      setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
      await loadProjects(currentPage);
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete project.');
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Guest Banner if not signed in */}
      {!isLoggedIn && (
        <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50/80 to-white p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xs">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Authentication Required</h2>
            <p className="text-xs text-slate-500 mt-0.5">Please sign in or create an account to view and create projects.</p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Link to="/login" className="btn-secondary text-xs py-2 px-3.5">
              Sign In
            </Link>
            <Link to="/register" className="btn-primary text-xs py-2 px-4">
              Register
            </Link>
          </div>
        </div>
      )}

      {/* Free Plan Quota Warning Banner (3 projects max) */}
      {isLoggedIn && isProjectLimitReached && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span>
              <strong className="font-semibold text-amber-950">Free Plan Project Limit (3/3) Reached.</strong> Your organisation has reached the maximum of 3 projects allowed on the Free tier.
            </span>
          </div>
          <Link to="/plans" className="shrink-0 font-semibold text-blue-600 hover:text-blue-700 hover:underline ml-3">
            View Plans & Upgrade →
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Projects
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {currentOrg
              ? `Active projects for ${currentOrg.name} (${pagination.totalItems} total / ${isFreePlan ? '3 limit' : 'Unlimited'})`
              : 'All active company projects, deadlines, and milestone progress.'}
          </p>
        </div>

        {isLoggedIn && (
          <button
            onClick={() => {
              setModalError('');
              setShowModal(true);
            }}
            className="btn-primary shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>Create Project</span>
          </button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <svg className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search projects by name or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800 focus:bg-white dark:focus:bg-slate-900 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 text-slate-800 dark:text-slate-100 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              ✕
            </button>
          )}
        </div>

        {/* Status Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 cursor-pointer transition-colors"
          >
            <option value="">All Statuses</option>
            <option value="Planning">Planning</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>

          {/* Sort By */}
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [field, order] = e.target.value.split('-');
              setSortBy(field);
              setSortOrder(order);
            }}
            className="text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-200 focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 cursor-pointer transition-colors"
          >
            <option value="createdAt-desc">Newest First</option>
            <option value="createdAt-asc">Oldest First</option>
            <option value="name-asc">Name (A-Z)</option>
            <option value="name-desc">Name (Z-A)</option>
            <option value="deadline-asc">Deadline (Soonest)</option>
          </select>

          {/* Reset Filters */}
          {(searchTerm || statusFilter || sortBy !== 'createdAt' || sortOrder !== 'desc') && (
            <button
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('');
                setSortBy('createdAt');
                setSortOrder('desc');
              }}
              className="text-xs px-2.5 py-2 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition font-medium cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Global Success Feedback */}
      {feedback.message && (
        <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-800 animate-in fade-in duration-200 shadow-xs">
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

      {/* Error state */}
      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center shadow-xs">
          <p className="text-sm font-medium text-red-700">Error loading projects: {loadError}</p>
          <button
            onClick={loadProjects}
            className="mt-3 btn-danger text-xs py-1.5 px-3.5"
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-12 text-sm text-slate-500 dark:text-slate-400 shadow-xs">
          <svg className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400 mr-2.5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          <span>Loading projects from database...</span>
        </div>
      ) : projects.length === 0 ? (
        /* Empty state */
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-12 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </div>
          <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-slate-100">No projects found</h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Get started by creating your organisation&apos;s first project to organize tasks, milestones and team members.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 btn-primary text-xs"
          >
            + Create First Project
          </button>
        </div>
      ) : (
        /* Projects Grid */
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(Array.isArray(projects) ? projects : []).map((project) => {
            const projectId = project._id || project.id;
            const progress =
              project.progress !== undefined
                ? project.progress
                : project.status === 'Completed'
                ? 100
                : project.status === 'In Progress'
                ? 50
                : 10;

            const memberCount = Array.isArray(project.teamMembers) ? project.teamMembers.length : 0;
            const formattedDeadline = project.deadline
              ? new Date(project.deadline).toISOString().split('T')[0]
              : 'No deadline';

            return (
              <Link
                key={projectId}
                to={`/projects/${projectId}`}
                className="group flex flex-col justify-between card-interactive p-5"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-snug">
                      {project.name}
                    </h2>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <StatusBadge status={project.status} />
                      {isManager && (
                        <button
                          type="button"
                          title="Delete project"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDeleteError('');
                            setProjectToDelete(project);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                        >
                          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>

                  <p className="line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                    {project.description || 'No description provided.'}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
                  {/* Team Members counter */}
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-400">Team Members</span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {memberCount} assigned
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>Due: {formattedDeadline}</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400 group-hover:underline">
                      View details →
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && !loadError && projects.length > 0 && (
        <PaginationControls
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          totalItems={pagination.totalItems}
          limit={pagination.limit}
          onPageChange={(p) => setCurrentPage(p)}
          itemName="projects"
        />
      )}

      {/* ── Create Project Modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] p-6 shadow-xl animate-in fade-in zoom-in-95 duration-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Create New Project</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Add a project and assign members from your organisation</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Error Banner */}
            {modalError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 p-3 text-xs text-red-700 dark:text-red-300 animate-in fade-in duration-150">
                <svg className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Project Name</label>
                <input
                  type="text"
                  name="name"
                  value={newProject.name}
                  onChange={handleChange}
                  placeholder="e.g. Website Overhaul"
                  required
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Description</label>
                <textarea
                  name="description"
                  value={newProject.description}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Brief overview of the project objectives..."
                  className="input-field text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Target Deadline</label>
                  <input
                    type="date"
                    name="deadline"
                    value={newProject.deadline}
                    onChange={handleChange}
                    className="input-field text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Initial Status</label>
                  <select
                    name="status"
                    value={newProject.status}
                    onChange={handleChange}
                    className="input-field text-sm cursor-pointer"
                  >
                    <option value="Planning">Planning</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="On Hold">On Hold</option>
                  </select>
                </div>
              </div>

              {/* Employee Selection Control */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-300">
                  Assign Team Members ({Array.isArray(newProject.teamMembers) ? newProject.teamMembers.length : 0} selected)
                </label>
                {(!Array.isArray(employees) || employees.length === 0) ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-2">No employees available in this organisation.</p>
                ) : (
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 p-2 space-y-1.5 bg-slate-50/50 dark:bg-slate-900/60">
                    {employees.map((emp) => {
                      const empUserId = emp.userId || emp._id || emp.id;
                      const isSelected = Array.isArray(newProject.teamMembers) && newProject.teamMembers.includes(empUserId);
                      return (
                        <label
                          key={empUserId || emp.email}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-200 border border-blue-200/60 dark:border-blue-800'
                              : 'hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleMemberToggle(empUserId)}
                              className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <div>
                              <p className="text-xs font-semibold leading-tight">{emp.name}</p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight">{emp.email}</p>
                            </div>
                          </div>
                          <span className="text-[11px] uppercase tracking-wide font-medium text-slate-500 dark:text-slate-400">
                            {emp.role || 'Member'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`btn-primary text-xs ${submitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {submitting ? 'Creating Project...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Project Confirmation Modal ── */}
      {projectToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-100 dark:border-slate-700 bg-white dark:bg-[#1E293B] p-6 shadow-xl animate-in fade-in zoom-in-95 duration-100">
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

            {deleteError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 p-3 text-xs text-red-700 dark:text-red-300 animate-in fade-in duration-150">
                <svg className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{deleteError}</span>
              </div>
            )}

            <div className="mt-4 rounded-xl border border-red-100 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/30 p-3.5 text-xs text-red-900 dark:text-red-300 leading-relaxed">
              <p>
                Are you sure you want to delete project <strong className="font-semibold text-red-950 dark:text-red-200">"{projectToDelete.name}"</strong>?
              </p>
              <p className="mt-2 text-[11px] text-red-700 dark:text-red-400">
                All associated tasks and file attachments for this project will be permanently deleted from the database and storage.
              </p>
            </div>

            <div className="mt-6 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setProjectToDelete(null)}
                disabled={deleteSubmitting}
                className="btn-secondary text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteProject}
                disabled={deleteSubmitting}
                className="btn-danger text-xs"
              >
                {deleteSubmitting ? 'Deleting Project...' : 'Delete Project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  const styles = {
    Completed: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
    'In Progress': 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
    Planning: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium shrink-0 ${
        styles[status] || 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700'
      }`}
    >
      {status}
    </span>
  );
}

export default Projects;
