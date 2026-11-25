/**
 * api.js
 * ──────
 * Central API Service Layer for TeamFlow.
 * Handles HTTP requests with credentials (cookies) and token headers.
 * Connects directly to the Express + MongoDB backend with zero mock data.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

/* ── Auth Helpers ────────────────────────── */
export const getStoredAuth = () => {
  try {
    const raw = localStorage.getItem('teamflow_auth');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setStoredAuth = (data) => {
  try {
    localStorage.setItem('teamflow_auth', JSON.stringify(data));
  } catch (e) {
    console.error('Failed to save auth to localStorage:', e);
  }
};

export const clearStoredAuth = () => {
  try {
    localStorage.removeItem('teamflow_auth');
  } catch (e) {
    console.error('Failed to clear auth from localStorage:', e);
  }
};

// Helper for fetch options including cookies and Authorization header
const getHeaders = (extraHeaders = {}) => {
  const auth = getStoredAuth();
  const headers = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  if (auth?.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }
  const orgId =
    extraHeaders['x-org-id'] ||
    localStorage.getItem('teamflow_active_org_id') ||
    auth?.organisation?.id ||
    auth?.organisation?._id;
  if (orgId) {
    headers['x-org-id'] = orgId;
  }
  return headers;
};

/* ── Authentication Endpoints ────────────── */
export const registerUser = async ({ name, email, password, organisationName }) => {
  const res = await fetch(`${API_BASE_URL}/auth/register`, {
    method: 'POST',
    headers: getHeaders(),
    credentials: 'include',
    body: JSON.stringify({ name, email, password, organisationName }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Registration failed');
  }

  setStoredAuth({
    user: data.user,
    organisation: data.organisation,
    token: data.token,
  });

  return data;
};

export const loginUser = async ({ email, password }) => {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: getHeaders(),
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Login failed');
  }

  setStoredAuth({
    user: data.user,
    organisation: data.organisation,
    token: data.token,
  });

  return data;
};

export const googleLoginApi = async ({ idToken, credential, organisationName }) => {
  const res = await fetch(`${API_BASE_URL}/auth/google`, {
    method: 'POST',
    headers: getHeaders(),
    credentials: 'include',
    body: JSON.stringify({ idToken, credential, organisationName }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Google authentication failed');
  }

  setStoredAuth({
    user: data.user,
    organisation: data.organisation,
    token: data.token,
  });

  return data;
};

export const getCurrentUser = async () => {
  const res = await fetch(`${API_BASE_URL}/auth/me`, {
    method: 'GET',
    headers: getHeaders(),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to fetch current user profile');
  }

  return data;
};

export const logoutUser = async () => {
  try {
    await fetch(`${API_BASE_URL}/auth/logout`, {
      method: 'POST',
      headers: getHeaders(),
      credentials: 'include',
    });
  } catch {
    // Ignore network error on logout
  } finally {
    clearStoredAuth();
  }
};

export const uploadAvatarApi = async (file) => {
  const formData = new FormData();
  formData.append('avatar', file);

  const auth = getStoredAuth();
  const headers = {};
  if (auth?.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }

  const res = await fetch(`${API_BASE_URL}/auth/avatar`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to upload profile picture');
  }

  if (auth?.user) {
    const updatedUser = { ...auth.user, avatar: data.avatar };
    setStoredAuth({ ...auth, user: updatedUser });
  }

  return data;
};

export const updateUserProfileApi = async (updates) => {
  const res = await fetch(`${API_BASE_URL}/auth/profile`, {
    method: 'PATCH',
    headers: getHeaders(),
    credentials: 'include',
    body: JSON.stringify(updates),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to update profile');
  }

  const auth = getStoredAuth();
  if (auth?.user) {
    setStoredAuth({ ...auth, user: { ...auth.user, ...data.user } });
  }

  return data.user;
};

/* ── Organisation Members (Employees) ────── */
export const fetchOrgMembers = async (orgId, params = {}) => {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page);
  if (params.limit) searchParams.set('limit', params.limit);
  if (params.role) searchParams.set('role', params.role);
  if (params.search) searchParams.set('search', params.search);

  const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const url = orgId ? `${API_BASE_URL}/orgs/${orgId}/members${qs}` : `${API_BASE_URL}/orgs/current/members${qs}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: getHeaders(),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to fetch members from backend');
  }

  // Return both array and metadata when paginated
  return {
    members: data.members || data.data || [],
    pagination: data.pagination || {
      currentPage: data.currentPage || 1,
      totalPages: data.totalPages || 1,
      totalItems: data.totalItems || (data.members ? data.members.length : 0),
      limit: data.limit || 10,
    },
  };
};

export const fetchMemberProfileApi = async (orgId, memberId) => {
  const res = await fetch(`${API_BASE_URL}/orgs/${orgId}/members/${memberId}`, {
    method: 'GET',
    headers: getHeaders(),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to fetch member profile');
  }

  return {
    member: data.member,
    projects: data.projects || [],
    tasks: data.tasks || [],
  };
};

export const addOrgMember = async (orgId, { name, email, password, role }) => {
  const res = await fetch(`${API_BASE_URL}/orgs/${orgId}/members`, {
    method: 'POST',
    headers: getHeaders(),
    credentials: 'include',
    body: JSON.stringify({ name, email, password, role }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to add member');
  }

  return data.member;
};

export const removeOrgMemberApi = async (orgId, memberId) => {
  const res = await fetch(`${API_BASE_URL}/orgs/${orgId}/members/${memberId}`, {
    method: 'DELETE',
    headers: getHeaders(),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to remove member from organisation');
  }

  return data;
};

export const updateMemberRoleApi = async (orgId, memberId, role) => {
  const res = await fetch(`${API_BASE_URL}/orgs/${orgId}/members/${memberId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    credentials: 'include',
    body: JSON.stringify({ role }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to update member role');
  }

  return data.member;
};

/* ── Organisation Details & Profile ───────── */
export const fetchOrganisationApi = async (orgId) => {
  const res = await fetch(`${API_BASE_URL}/orgs/${orgId}`, {
    method: 'GET',
    headers: getHeaders(),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to fetch organisation details');
  }

  return data.organisation;
};

export const updateOrganisationApi = async (orgId, { name }) => {
  const res = await fetch(`${API_BASE_URL}/orgs/${orgId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    credentials: 'include',
    body: JSON.stringify({ name }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to update organisation details');
  }

  return data.organisation;
};

/* ── Organisation Invitations ─────────────── */
export const fetchOrgInvitationsApi = async (orgId, status) => {
  const qs = status ? `?status=${encodeURIComponent(status)}` : '';
  const res = await fetch(`${API_BASE_URL}/orgs/${orgId}/invitations${qs}`, {
    method: 'GET',
    headers: getHeaders(),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to fetch pending invitations');
  }

  return data.invitations || [];
};

export const createInvitationApi = async (orgId, { email, role }) => {
  const res = await fetch(`${API_BASE_URL}/orgs/${orgId}/invitations`, {
    method: 'POST',
    headers: getHeaders(),
    credentials: 'include',
    body: JSON.stringify({ email, role }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to send invitation');
  }

  return data;
};

export const resendInvitationApi = async (orgId, invitationId) => {
  const res = await fetch(`${API_BASE_URL}/orgs/${orgId}/invitations/${invitationId}/resend`, {
    method: 'POST',
    headers: getHeaders(),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to resend invitation');
  }

  return data;
};

export const revokeInvitationApi = async (orgId, invitationId) => {
  const res = await fetch(`${API_BASE_URL}/orgs/${orgId}/invitations/${invitationId}`, {
    method: 'DELETE',
    headers: getHeaders(),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to cancel invitation');
  }

  return data;
};

export const verifyInvitationTokenApi = async (token) => {
  const res = await fetch(`${API_BASE_URL}/invitations/${token}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to verify invitation token');
  }

  return data;
};

export const acceptInvitationApi = async (token, { name, password } = {}) => {
  const res = await fetch(`${API_BASE_URL}/invitations/${token}/accept`, {
    method: 'POST',
    headers: getHeaders(),
    credentials: 'include',
    body: JSON.stringify({ name, password }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to accept invitation');
  }

  setStoredAuth({
    user: data.user,
    organisation: data.organisation,
    token: data.token,
  });

  return data;
};

/* ── Projects Endpoints ─────────────────── */
export const fetchProjectsApi = async (orgId, params = {}) => {
  const searchParams = new URLSearchParams();
  if (orgId) searchParams.set('orgId', orgId);
  if (params.page) searchParams.set('page', params.page);
  if (params.limit) searchParams.set('limit', params.limit);
  if (params.status) searchParams.set('status', params.status);
  if (params.search) searchParams.set('search', params.search);
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

  const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const res = await fetch(`${API_BASE_URL}/projects${qs}`, {
    method: 'GET',
    headers: getHeaders(),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to fetch projects from backend');
  }

  return {
    projects: data.projects || data.data || [],
    pagination: data.pagination || {
      currentPage: data.currentPage || 1,
      totalPages: data.totalPages || 1,
      totalItems: data.totalItems || (data.projects ? data.projects.length : 0),
      limit: data.limit || 10,
    },
  };
};

export const createProjectApi = async ({ name, description, deadline, status, teamMembers, orgId }) => {
  const auth = getStoredAuth();
  const targetOrgId = orgId || auth?.organisation?.id || auth?.organisation?._id;

  const payload = {
    name,
    description: description || '',
    status: status || 'Planning',
    teamMembers: Array.isArray(teamMembers) ? teamMembers : [],
    orgId: targetOrgId,
  };

  if (deadline) {
    payload.deadline = deadline;
  }

  const res = await fetch(`${API_BASE_URL}/projects`, {
    method: 'POST',
    headers: getHeaders(targetOrgId ? { 'x-org-id': targetOrgId } : {}),
    credentials: 'include',
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) {
    const errorMsg = data.error?.message || data.message || 'Failed to create project';
    throw new Error(errorMsg);
  }

  return data.project || data;
};

export const fetchProjectByIdApi = async (projectId) => {
  const res = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
    method: 'GET',
    headers: getHeaders(),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to fetch project details');
  }

  return data.project;
};

export const updateProjectApi = async (projectId, updates) => {
  const res = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    credentials: 'include',
    body: JSON.stringify(updates),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to update project');
  }

  return data.project;
};

export const deleteProjectApi = async (projectId) => {
  const res = await fetch(`${API_BASE_URL}/projects/${projectId}`, {
    method: 'DELETE',
    headers: getHeaders(),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to delete project');
  }

  return data;
};

export const addProjectMembersApi = async (projectId, userIds) => {
  const res = await fetch(`${API_BASE_URL}/projects/${projectId}/members`, {
    method: 'POST',
    headers: getHeaders(),
    credentials: 'include',
    body: JSON.stringify({ userIds: Array.isArray(userIds) ? userIds : [userIds] }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to add project members');
  }

  return data.project;
};

export const removeProjectMemberApi = async (projectId, userId) => {
  const res = await fetch(`${API_BASE_URL}/projects/${projectId}/members/${userId}`, {
    method: 'DELETE',
    headers: getHeaders(),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to remove project member');
  }

  return data.project;
};

/* ── Tasks & Progress Endpoints ─────────── */
export const fetchProjectTasksApi = async (projectId, params = {}) => {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page);
  if (params.limit) searchParams.set('limit', params.limit);
  if (params.status && params.status !== 'ALL') searchParams.set('status', params.status);
  if (params.priority && params.priority !== 'ALL') searchParams.set('priority', params.priority);
  if (params.search && params.search.trim()) searchParams.set('search', params.search.trim());
  if (params.assignedTo && params.assignedTo !== 'ALL' && params.assignedTo !== 'all') {
    searchParams.set('assignedTo', params.assignedTo);
  }
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
  if (params.dueDateFilter && params.dueDateFilter !== 'ALL') {
    searchParams.set('dueDateFilter', params.dueDateFilter);
  }
  if (params.overdue) searchParams.set('overdue', params.overdue);
  if (params.dueBefore) searchParams.set('dueBefore', params.dueBefore);
  if (params.dueAfter) searchParams.set('dueAfter', params.dueAfter);

  const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const res = await fetch(`${API_BASE_URL}/projects/${projectId}/tasks${qs}`, {
    method: 'GET',
    headers: getHeaders(),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to fetch tasks from backend');
  }

  return {
    tasks: data.tasks || data.data || [],
    pagination: data.pagination || {
      currentPage: data.currentPage || 1,
      totalPages: data.totalPages || 1,
      totalItems: data.totalItems || (data.tasks ? data.tasks.length : 0),
      limit: data.limit || 10,
    },
  };
};

export const createTaskApi = async (projectId, taskData) => {
  const res = await fetch(`${API_BASE_URL}/projects/${projectId}/tasks`, {
    method: 'POST',
    headers: getHeaders(),
    credentials: 'include',
    body: JSON.stringify(taskData),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to create task');
  }

  return data.task;
};

export const updateTaskStatusApi = async (taskId, status) => {
  const res = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    credentials: 'include',
    body: JSON.stringify({ status }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to update task status');
  }

  return data.task;
};

export const updateTaskApi = async (taskId, updates) => {
  const res = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
    method: 'PATCH',
    headers: getHeaders(),
    credentials: 'include',
    body: JSON.stringify(updates),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to update task');
  }

  return data.task;
};

export const fetchOrgTasksApi = async (params = {}) => {
  const searchParams = new URLSearchParams();
  if (params.orgId) searchParams.set('orgId', params.orgId);
  if (params.projectId && params.projectId !== 'ALL') searchParams.set('projectId', params.projectId);
  if (params.hasDueDate !== undefined) searchParams.set('hasDueDate', params.hasDueDate);
  if (params.startDate) searchParams.set('startDate', params.startDate);
  if (params.endDate) searchParams.set('endDate', params.endDate);
  if (params.status && params.status !== 'ALL') searchParams.set('status', params.status);
  if (params.priority && params.priority !== 'ALL') searchParams.set('priority', params.priority);
  if (params.assignedTo && params.assignedTo !== 'ALL') searchParams.set('assignedTo', params.assignedTo);

  const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const res = await fetch(`${API_BASE_URL}/tasks${qs}`, {
    method: 'GET',
    headers: getHeaders(params.orgId ? { 'x-org-id': params.orgId } : {}),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to fetch tasks');
  }

  return data.tasks || [];
};

export const fetchTaskByIdApi = async (taskId) => {
  const res = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
    method: 'GET',
    headers: getHeaders(),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to fetch task details');
  }

  return data.task;
};

/* ── Task Attachments Endpoints (Phase 4) ──────── */
export const uploadTaskAttachmentsApi = async (taskId, formData) => {
  const auth = getStoredAuth();
  const headers = {};
  if (auth?.token) {
    headers['Authorization'] = `Bearer ${auth.token}`;
  }
  // Note: Do NOT set Content-Type header when sending FormData; browser sets multipart/form-data with boundary

  const res = await fetch(`${API_BASE_URL}/tasks/${taskId}/attachments`, {
    method: 'POST',
    headers,
    credentials: 'include',
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to upload attachments');
  }

  return data.attachments || [];
};

export const getTaskAttachmentDownloadUrl = (taskId, attachmentId, download = false) => {
  return `${API_BASE_URL}/tasks/${taskId}/attachments/${attachmentId}${download ? '?download=true' : ''}`;
};

export const deleteTaskAttachmentApi = async (taskId, attachmentId) => {
  const res = await fetch(`${API_BASE_URL}/tasks/${taskId}/attachments/${attachmentId}`, {
    method: 'DELETE',
    headers: getHeaders(),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to delete attachment');
  }

  return data;
};

export const deleteTaskApi = async (taskId) => {
  const res = await fetch(`${API_BASE_URL}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: getHeaders(),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to delete task');
  }

  return data;
};

export const fetchMyTasksApi = async (params = {}) => {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page);
  if (params.limit) searchParams.set('limit', params.limit);
  if (params.status && params.status !== 'ALL') searchParams.set('status', params.status);
  if (params.priority && params.priority !== 'ALL') searchParams.set('priority', params.priority);
  if (params.search && params.search.trim()) searchParams.set('search', params.search.trim());
  if (params.assignedTo && params.assignedTo !== 'me') searchParams.set('assignedTo', params.assignedTo);
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
  if (params.dueDateFilter && params.dueDateFilter !== 'ALL') {
    searchParams.set('dueDateFilter', params.dueDateFilter);
  }
  if (params.overdue) searchParams.set('overdue', params.overdue);
  if (params.dueBefore) searchParams.set('dueBefore', params.dueBefore);
  if (params.dueAfter) searchParams.set('dueAfter', params.dueAfter);
  if (params.orgId) searchParams.set('orgId', params.orgId);

  const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const res = await fetch(`${API_BASE_URL}/tasks/my${qs}`, {
    method: 'GET',
    headers: getHeaders(params.orgId ? { 'x-org-id': params.orgId } : {}),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to fetch personal assigned tasks');
  }

  return {
    tasks: data.tasks || data.data || [],
    pagination: data.pagination || {
      currentPage: data.currentPage || 1,
      totalPages: data.totalPages || 1,
      totalItems: data.totalItems || (data.tasks ? data.tasks.length : 0),
      limit: data.limit || 10,
    },
  };
};

/* ── Project Progress ────────────────────── */
export const fetchProjectProgressApi = async (projectId) => {
  const res = await fetch(`${API_BASE_URL}/projects/${projectId}/progress`, {
    method: 'GET',
    headers: getHeaders(),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to fetch progress');
  }

  return data;
};

/* ── Dashboard & Subscription Endpoints ── */
export const fetchDashboardApi = async (orgId) => {
  const query = orgId ? `?orgId=${orgId}` : '';
  const res = await fetch(`${API_BASE_URL}/dashboard${query}`, {
    method: 'GET',
    headers: getHeaders(),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to fetch dashboard metrics');
  }

  return data;
};

export const fetchPlansApi = async () => {
  const res = await fetch(`${API_BASE_URL}/plans`, {
    method: 'GET',
    headers: getHeaders(),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to fetch subscription plans');
  }

  return data;
};

export const fetchUsageApi = async () => {
  const res = await fetch(`${API_BASE_URL}/usage`, {
    method: 'GET',
    headers: getHeaders(),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to fetch usage statistics');
  }

  return data;
};

/* ── Task Comments Endpoints (Phase 3) ──────────── */
export const fetchTaskCommentsApi = async (taskId, params = {}) => {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page);
  if (params.limit) searchParams.set('limit', params.limit);

  const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const res = await fetch(`${API_BASE_URL}/tasks/${taskId}/comments${qs}`, {
    method: 'GET',
    headers: getHeaders(),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to fetch task comments');
  }

  return {
    comments: data.comments || data.data || [],
    pagination: data.pagination || {
      currentPage: data.currentPage || 1,
      totalPages: data.totalPages || 1,
      totalItems: data.totalItems || (data.comments ? data.comments.length : 0),
      limit: data.limit || 50,
    },
  };
};

export const createTaskCommentApi = async (taskId, text) => {
  const res = await fetch(`${API_BASE_URL}/tasks/${taskId}/comments`, {
    method: 'POST',
    headers: getHeaders(),
    credentials: 'include',
    body: JSON.stringify({ text }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to post comment');
  }

  return data.comment;
};

/* ── Activity History Endpoints (Phase 3) ──────── */
export const fetchActivityLogsApi = async (params = {}) => {
  const searchParams = new URLSearchParams();
  if (params.orgId) searchParams.set('orgId', params.orgId);
  if (params.projectId) searchParams.set('projectId', params.projectId);
  if (params.taskId) searchParams.set('taskId', params.taskId);
  if (params.page) searchParams.set('page', params.page);
  if (params.limit) searchParams.set('limit', params.limit);

  const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const res = await fetch(`${API_BASE_URL}/activity${qs}`, {
    method: 'GET',
    headers: getHeaders(),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to fetch activity logs');
  }

  return {
    activities: data.activities || data.data || [],
    pagination: data.pagination || {
      currentPage: data.currentPage || 1,
      totalPages: data.totalPages || 1,
      totalItems: data.totalItems || (data.activities ? data.activities.length : 0),
      limit: data.limit || 20,
    },
  };
};

/* ── Notifications Endpoints ──────────────── */
export const fetchNotificationsApi = async (params = {}) => {
  const searchParams = new URLSearchParams();
  if (params.orgId) searchParams.set('orgId', params.orgId);
  if (params.read !== undefined) searchParams.set('read', params.read);
  if (params.page) searchParams.set('page', params.page);
  if (params.limit) searchParams.set('limit', params.limit);

  const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const res = await fetch(`${API_BASE_URL}/notifications${qs}`, {
    method: 'GET',
    headers: getHeaders(params.orgId ? { 'x-org-id': params.orgId } : {}),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to fetch notifications');
  }

  return {
    notifications: data.notifications || data.data || [],
    unreadCount: data.unreadCount || 0,
    pagination: data.pagination || {
      currentPage: 1,
      totalPages: 1,
      totalItems: data.notifications ? data.notifications.length : 0,
    },
  };
};

export const markNotificationReadApi = async (notificationId) => {
  const res = await fetch(`${API_BASE_URL}/notifications/${notificationId}/read`, {
    method: 'PATCH',
    headers: getHeaders(),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to mark notification as read');
  }

  return data;
};

export const markAllNotificationsReadApi = async (orgId) => {
  const res = await fetch(`${API_BASE_URL}/notifications/read-all`, {
    method: 'PATCH',
    headers: getHeaders(orgId ? { 'x-org-id': orgId } : {}),
    credentials: 'include',
    body: JSON.stringify({ orgId }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to mark all notifications as read');
  }

  return data;
};
