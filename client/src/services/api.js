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
  const res = await fetch(`${API_BASE_URL}/projects`, {
    method: 'POST',
    headers: getHeaders(),
    credentials: 'include',
    body: JSON.stringify({ name, description, deadline, status, teamMembers, orgId }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to create project');
  }

  return data.project;
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
  if (params.status) searchParams.set('status', params.status);
  if (params.priority) searchParams.set('priority', params.priority);
  if (params.search) searchParams.set('search', params.search);
  if (params.assignedTo) searchParams.set('assignedTo', params.assignedTo);
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

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

export const fetchMyTasksApi = async (params = {}) => {
  const searchParams = new URLSearchParams();
  if (params.page) searchParams.set('page', params.page);
  if (params.limit) searchParams.set('limit', params.limit);
  if (params.status) searchParams.set('status', params.status);
  if (params.priority) searchParams.set('priority', params.priority);
  if (params.search) searchParams.set('search', params.search);
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);

  const qs = searchParams.toString() ? `?${searchParams.toString()}` : '';
  const res = await fetch(`${API_BASE_URL}/tasks/my${qs}`, {
    method: 'GET',
    headers: getHeaders(),
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

/* ── Workspace Invitations Endpoints ─────── */
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

export const fetchOrgInvitationsApi = async (orgId) => {
  const res = await fetch(`${API_BASE_URL}/orgs/${orgId}/invitations`, {
    method: 'GET',
    headers: getHeaders(),
    credentials: 'include',
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Failed to fetch invitations');
  }

  return data.invitations || [];
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

export const verifyInvitationApi = async (token) => {
  const res = await fetch(`${API_BASE_URL}/invitations/${token}`, {
    method: 'GET',
    headers: getHeaders(),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error?.message || 'Invalid or expired invitation link');
  }

  return data;
};

export const acceptInvitationApi = async (token, { name, password }) => {
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
