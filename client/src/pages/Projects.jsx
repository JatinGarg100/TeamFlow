import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchProjectsApi,
  createProjectApi,
  fetchOrgMembers,
  getStoredAuth,
} from '../services/api';
import PaginationControls from '../components/PaginationControls';
import { useDebounce } from '../hooks/useDebounce';

/**
 * Projects page
 * ─────────────
 * End-to-end connected to GET /api/projects with:
 * - Debounced keyword search
 * - Status filtering
 * - Sorting controls
 * - Pagination (previous / next / page counts)
 * - Empty states & loading spinners
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

  const auth = getStoredAuth();
  const isLoggedIn = Boolean(auth?.token && auth?.user);
  const currentOrg = auth?.organisation;
  const orgId = currentOrg?.id;
  const isFreePlan = (currentOrg?.plan || 'free') === 'free';
  const isProjectLimitReached = isFreePlan && (pagination.totalItems >= 3 || projects.length >= 3);

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
    if (!orgId) return;
    try {
      const data = await fetchOrgMembers(orgId);
      setEmployees(data);
    } catch (err) {
      console.error('Failed to load organisation employees:', err);
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
      const exists = prev.teamMembers.includes(userId);
      return {
        ...prev,
        teamMembers: exists
          ? prev.teamMembers.filter((id) => id !== userId)
          : [...prev.teamMembers, userId],
      };
    });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setModalError('');

    if (!newProject.name.trim()) {
      setModalError('Please enter a project name.');
      return;
    }

    if (isProjectLimitReached) {
      setModalError('Free plan project limit of 3 reached. Please upgrade to Pro on the Plans page to create more projects.');
      return;
    }

    setSubmitting(true);

    try {
      await createProjectApi({
        name: newProject.name,
        description: newProject.description,
        deadline: newProject.deadline,
        status: newProject.status,
        teamMembers: newProject.teamMembers,
        orgId,
      });

      setFeedback({
        type: 'success',
        message: `Project "${newProject.name}" created successfully!`,
      });

      // Reset form & close modal
      setNewProject({
        name: '',
        description: '',
        deadline: '',
        status: 'Planning',
        teamMembers: [],
      });
      setShowModal(false);

      // Refresh project list from backend
      await loadProjects();

      setTimeout(() => setFeedback({ type: '', message: '' }), 4000);
    } catch (err) {
      setModalError(err.message || 'Failed to create project.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Guest Banner if not signed in */}
      {!isLoggedIn && (
        <div className="rounded-2xl border border-[#DCD9FA] bg-gradient-to-r from-[#EEEDFD]/80 to-white p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-[#1E202A]">Authentication Required</h2>
            <p className="text-xs text-[#64748B] mt-0.5">Please sign in or create an account to view and create projects.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/login" className="rounded-xl border border-[#5B4BDB] bg-white px-4 py-2 text-xs font-semibold text-[#5B4BDB] hover:bg-[#EEEDFD]">
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
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span>
              <strong>Free Plan Project Limit (3/3) Reached.</strong> Your organisation has reached the maximum of 3 projects allowed on the Free tier.
            </span>
          </div>
          <Link to="/plans" className="shrink-0 font-semibold text-[#5B4BDB] hover:underline ml-3">
            View Plans & Upgrade →
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E202A] sm:text-3xl">
            Projects
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            {currentOrg
              ? `Active projects for ${currentOrg.name} (${pagination.totalItems} total / ${isFreePlan ? '3 limit' : '∞'})`
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
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
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

        {/* Status Filter */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-[#5B4BDB] cursor-pointer"
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
            className="text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-[#5B4BDB] cursor-pointer"
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
              className="text-xs px-2.5 py-2 text-rose-600 hover:bg-rose-50 rounded-lg transition font-medium cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Global Success Feedback */}
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
            className="text-emerald-600 hover:text-emerald-900 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error state */}
      {loadError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center shadow-xs">
          <p className="text-sm font-medium text-red-700">Error loading projects: {loadError}</p>
          <button
            onClick={loadProjects}
            className="mt-3 rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-[#E2E8F0] bg-white p-12 text-sm text-[#64748B]">
          <svg className="h-5 w-5 animate-spin text-[#5B4BDB] mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
          </svg>
          <span>Loading projects from database...</span>
        </div>
      ) : projects.length === 0 ? (
        /* Empty state */
        <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center shadow-xs">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#EEEDFD] text-[#5B4BDB]">
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </div>
          <h2 className="mt-3 text-base font-semibold text-[#1E202A]">No projects found</h2>
          <p className="mt-1 text-xs text-[#64748B]">
            Get started by creating your organisation&apos;s first project.
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
          {projects.map((project) => {
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
                className="group flex flex-col justify-between rounded-xl border border-[#E2E8F0] bg-white p-5 shadow-xs transition-all duration-150 hover:border-[#CBD5E1] hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-2.5">
                    <h2 className="text-base font-semibold text-[#1E202A] group-hover:text-[#5B4BDB] transition-colors leading-snug">
                      {project.name}
                    </h2>
                    <StatusBadge status={project.status} />
                  </div>

                  <p className="line-clamp-2 text-xs leading-relaxed text-[#64748B]">
                    {project.description || 'No description provided.'}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-[#F1F5F9]">
                  {/* Team Members counter */}
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-[#64748B]">Team Members</span>
                    <span className="font-medium text-[#1E202A]">
                      {memberCount} assigned
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-[#5B4BDB] transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="mt-3 flex items-center justify-between text-[11px] text-[#64748B]">
                    <span>Due: {formattedDeadline}</span>
                    <span className="font-medium text-[#5B4BDB] group-hover:underline">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div>
                <h2 className="text-base font-semibold text-[#1E202A]">Create New Project</h2>
                <p className="text-xs text-[#64748B]">Add a project and assign members from your organisation</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Error Banner */}
            {modalError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 animate-in fade-in duration-150">
                <svg className="h-4 w-4 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#1E202A]">Project Name</label>
                <input
                  type="text"
                  name="name"
                  value={newProject.name}
                  onChange={handleChange}
                  placeholder="e.g. Company Website"
                  required
                  className="w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2 text-sm text-[#1E202A] outline-none transition-all focus:border-[#5B4BDB] focus:ring-2 focus:ring-[#EEEDFD]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#1E202A]">Description</label>
                <textarea
                  name="description"
                  value={newProject.description}
                  onChange={handleChange}
                  rows={2}
                  placeholder="Brief overview of the project objectives..."
                  className="w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2 text-sm text-[#1E202A] outline-none transition-all focus:border-[#5B4BDB] focus:ring-2 focus:ring-[#EEEDFD]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#1E202A]">Target Deadline</label>
                  <input
                    type="date"
                    name="deadline"
                    value={newProject.deadline}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2 text-sm text-[#1E202A] outline-none transition-all focus:border-[#5B4BDB] focus:ring-2 focus:ring-[#EEEDFD]"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-[#1E202A]">Initial Status</label>
                  <select
                    name="status"
                    value={newProject.status}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2 text-sm text-[#1E202A] outline-none transition-all focus:border-[#5B4BDB] focus:ring-2 focus:ring-[#EEEDFD]"
                  >
                    <option value="Planning">Planning</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>
              </div>

              {/* Employee Selection Control */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#1E202A]">
                  Assign Team Members ({newProject.teamMembers.length} selected)
                </label>
                {employees.length === 0 ? (
                  <p className="text-xs text-[#64748B]">No employees available in this organisation.</p>
                ) : (
                  <div className="max-h-36 overflow-y-auto rounded-lg border border-[#E2E8F0] p-2 space-y-1.5 bg-[#F8FAFC]">
                    {employees.map((emp) => {
                      const empUserId = emp.userId || emp.id;
                      const isSelected = newProject.teamMembers.includes(empUserId);
                      return (
                        <label
                          key={empUserId}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                            isSelected ? 'bg-[#EEEDFD] text-[#5B4BDB]' : 'hover:bg-white text-[#1E202A]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleMemberToggle(empUserId)}
                              className="rounded border-[#CBD5E1] text-[#5B4BDB] focus:ring-[#5B4BDB]"
                            />
                            <div>
                              <p className="text-xs font-semibold leading-tight">{emp.name}</p>
                              <p className="text-[11px] text-[#64748B] leading-tight">{emp.email}</p>
                            </div>
                          </div>
                          <span className="text-[11px] uppercase tracking-wide font-medium text-[#64748B]">
                            {emp.role || 'Member'}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  disabled={submitting}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`btn-primary ${submitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {submitting ? 'Creating Project...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

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

export default Projects;
