import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchOrgMembers,
  addOrgMember,
  removeOrgMemberApi,
  updateMemberRoleApi,
  fetchOrgInvitationsApi,
  createInvitationApi,
  resendInvitationApi,
  revokeInvitationApi,
  getStoredAuth,
} from '../services/api';
import PaginationControls from '../components/PaginationControls';
import MemberProfileModal from '../components/MemberProfileModal';
import { useDebounce } from '../hooks/useDebounce';

/**
 * Employees Page — Premium SaaS Mixed Theme
 * ──────────────────────────────────────────
 * - Active members list with debounced search and role filtering
 * - Direct employee account creation
 * - Workspace invitation workflow (send invite, view pending, resend, cancel, copy link)
 * - Member role update for owners and admins
 * - Member removal with safety validations
 */
function Employees() {
  const [activeTab, setActiveTab] = useState('members'); // 'members' | 'invitations'

  // Employees state
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Invitations state
  const [invitations, setInvitations] = useState([]);
  const [invitationFilter, setInvitationFilter] = useState('all');
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [inviteActionLoading, setInviteActionLoading] = useState(null);

  // Search, filter & pagination state
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [roleFilter, setRoleFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProfileMemberId, setSelectedProfileMemberId] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 8,
  });

  // Direct Add Employee Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [addModalError, setAddModalError] = useState('');
  const [addFormData, setAddFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'member',
  });

  // Send Invitation Modal State
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [submittingInvite, setSubmittingInvite] = useState(false);
  const [inviteModalError, setInviteModalError] = useState('');
  const [inviteFormData, setInviteFormData] = useState({
    email: '',
    role: 'member',
  });
  const [lastCreatedInvite, setLastCreatedInvite] = useState(null);

  // Remove Employee Modal / Confirmation State
  const [memberToRemove, setMemberToRemove] = useState(null);
  const [removingMember, setRemovingMember] = useState(false);
  const [removeError, setRemoveError] = useState('');

  // Role Edit State
  const [updatingRoleId, setUpdatingRoleId] = useState(null);

  // Global Feedback state
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const { user, organisation: contextOrg, activeOrgId, isManager: contextIsManager, isOwner: contextIsOwner, isAdmin: contextIsAdmin, isAuthenticated } = useAuth() || {};
  const auth = getStoredAuth();
  const isLoggedIn = isAuthenticated || Boolean(auth?.token && auth?.user);
  const currentUserId = user?.id || user?._id || auth?.user?.id || auth?.user?._id;
  const currentOrg = contextOrg || auth?.organisation;
  const orgId = activeOrgId || currentOrg?.id || currentOrg?._id;
  const userRole = currentOrg?.role || 'member';
  const isOwner = contextIsOwner || userRole === 'owner';
  const isAdminOrOwner = contextIsAdmin || ['owner', 'admin'].includes(userRole);
  const isManager = contextIsManager || ['owner', 'admin', 'manager'].includes(userRole);

  const isFreePlan = (currentOrg?.plan || 'free') === 'free';
  const isMemberLimitReached = isFreePlan && (pagination.totalItems >= 5 || employees.length >= 5);

  // Fetch organisation members
  const loadMembers = useCallback(async (pageToLoad = currentPage) => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError('');
    try {
      const res = await fetchOrgMembers(orgId, {
        page: pageToLoad,
        limit: 8,
        search: debouncedSearch,
        role: roleFilter,
      });

      setEmployees(res.members || []);
      setPagination(
        res.pagination || {
          currentPage: pageToLoad,
          totalPages: 1,
          totalItems: res.members?.length || 0,
          limit: 8,
        }
      );
    } catch (err) {
      console.error('Failed to load employee data:', err);
      setLoadError(err.message || 'Failed to load employee directory');
    } finally {
      setLoading(false);
    }
  }, [orgId, currentPage, debouncedSearch, roleFilter]);

  // Fetch invitations with optional status filter
  const loadInvitations = useCallback(async (statusToLoad = invitationFilter) => {
    if (!orgId || !isManager) return;
    setLoadingInvites(true);
    try {
      const list = await fetchOrgInvitationsApi(orgId, statusToLoad === 'all' ? undefined : statusToLoad);
      setInvitations(list);
    } catch (err) {
      console.error('Failed to load invitations:', err);
    } finally {
      setLoadingInvites(false);
    }
  }, [orgId, isManager, invitationFilter]);

  const getInviteStatusBadge = (status) => {
    switch (status) {
      case 'accepted':
        return (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            Accepted
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60">
            Expired
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
            Pending
          </span>
        );
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    loadMembers(1);
  }, [debouncedSearch, roleFilter]);

  useEffect(() => {
    loadMembers(currentPage);
  }, [currentPage]);

  useEffect(() => {
    loadMembers();
    if (isManager) {
      loadInvitations();
    }
  }, [loadMembers, loadInvitations, isManager]);

  // Handle Direct Add Employee
  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setAddModalError('');

    if (!addFormData.name.trim() || addFormData.name.trim().length < 2) {
      setAddModalError('Please enter a valid employee name (at least 2 characters).');
      return;
    }

    if (!addFormData.email.trim()) {
      setAddModalError('Please enter a valid email address.');
      return;
    }

    if (!addFormData.password || addFormData.password.length < 6) {
      setAddModalError('Password must be at least 6 characters long.');
      return;
    }

    if (isMemberLimitReached) {
      setAddModalError('Free plan member limit of 5 reached. Please upgrade to Pro on the Plans page to add more members.');
      return;
    }

    setSubmittingAdd(true);
    try {
      const added = await addOrgMember(orgId, {
        name: addFormData.name.trim(),
        email: addFormData.email.trim(),
        password: addFormData.password,
        role: addFormData.role,
      });

      setFeedback({
        type: 'success',
        message: `Account created for "${added.name}"! The employee can now log in using ${added.email}.`,
      });

      setAddFormData({ name: '', email: '', password: '', role: 'member' });
      setShowAddModal(false);
      await loadMembers();
      setTimeout(() => setFeedback({ type: '', message: '' }), 6000);
    } catch (err) {
      setAddModalError(err.message || 'Failed to add employee.');
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Handle Send Invitation
  const handleSendInvitation = async (e) => {
    e.preventDefault();
    setInviteModalError('');
    setLastCreatedInvite(null);

    if (!inviteFormData.email.trim()) {
      setInviteModalError('Please enter a valid recipient email address.');
      return;
    }

    setSubmittingInvite(true);
    try {
      const res = await createInvitationApi(orgId, {
        email: inviteFormData.email.trim(),
        role: inviteFormData.role,
      });

      setLastCreatedInvite(res);
      setFeedback({
        type: 'success',
        message: res.message || `Invitation successfully created for ${inviteFormData.email}.`,
      });

      setInviteFormData({ email: '', role: 'member' });
      await loadInvitations();
    } catch (err) {
      setInviteModalError(err.message || 'Failed to send invitation.');
    } finally {
      setSubmittingInvite(false);
    }
  };

  // Handle Resend Invitation
  const handleResendInvitation = async (invitationId, email) => {
    try {
      setInviteActionLoading(invitationId);
      const res = await resendInvitationApi(orgId, invitationId);
      setFeedback({
        type: 'success',
        message: res.message || `Invitation resent to ${email}.`,
      });
      await loadInvitations();
      setTimeout(() => setFeedback({ type: '', message: '' }), 5000);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to resend invitation.',
      });
    } finally {
      setInviteActionLoading(null);
    }
  };

  // Handle Revoke Invitation
  const handleRevokeInvitation = async (invitationId, email) => {
    try {
      setInviteActionLoading(invitationId);
      const res = await revokeInvitationApi(orgId, invitationId);
      setFeedback({
        type: 'success',
        message: res.message || `Invitation for ${email} cancelled.`,
      });
      await loadInvitations();
      setTimeout(() => setFeedback({ type: '', message: '' }), 5000);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to cancel invitation.',
      });
    } finally {
      setInviteActionLoading(null);
    }
  };

  // Handle Copy Invite Link to Clipboard
  const handleCopyInviteLink = (inviteUrlOrToken) => {
    const link = inviteUrlOrToken?.startsWith('http')
      ? inviteUrlOrToken
      : `${window.location.origin}/invite/${inviteUrlOrToken}`;
    navigator.clipboard.writeText(link);
    setFeedback({
      type: 'success',
      message: 'Invitation link copied to clipboard!',
    });
    setTimeout(() => setFeedback({ type: '', message: '' }), 3000);
  };

  // Handle Update Member Role
  const handleRoleChange = async (memberId, newRole, memberName) => {
    try {
      setUpdatingRoleId(memberId);
      await updateMemberRoleApi(orgId, memberId, newRole);
      setFeedback({
        type: 'success',
        message: `Role for ${memberName} updated to ${newRole}.`,
      });
      setEmployees((prev) =>
        prev.map((e) => ((e.id || e.userId) === memberId ? { ...e, role: newRole } : e))
      );
      setTimeout(() => setFeedback({ type: '', message: '' }), 5000);
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to update member role.',
      });
    } finally {
      setUpdatingRoleId(null);
    }
  };

  // Handle Remove Employee
  const handleConfirmRemove = async () => {
    if (!memberToRemove || !orgId) return;

    setRemovingMember(true);
    setRemoveError('');
    try {
      const targetId = memberToRemove.id || memberToRemove.userId;
      const res = await removeOrgMemberApi(orgId, targetId);

      setFeedback({
        type: 'success',
        message: res.message || `Employee "${memberToRemove.name}" was removed from the organisation.`,
      });

      setMemberToRemove(null);
      await loadMembers();
      setTimeout(() => setFeedback({ type: '', message: '' }), 5000);
    } catch (err) {
      setRemoveError(err.message || 'Failed to remove employee.');
    } finally {
      setRemovingMember(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Guest Banner if not signed in */}
      {!isLoggedIn && (
        <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-gradient-to-r from-blue-50/80 to-white dark:from-blue-950/40 dark:to-[#111827] p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-xs">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Authentication Required</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Please sign in or create an account to view and manage company employees.</p>
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

      {/* Free Plan Quota Warning Banner (5 members max) */}
      {isLoggedIn && isMemberLimitReached && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-xs text-amber-900 dark:text-amber-200 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span>
              <strong className="font-semibold text-amber-950 dark:text-amber-100">Free Plan Member Limit (5/5) Reached.</strong> Your organisation has reached the maximum of 5 members allowed on the Free tier.
            </span>
          </div>
          <Link to="/plans" className="shrink-0 font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline ml-3">
            View Plans &amp; Upgrade →
          </Link>
        </div>
      )}

      {/* Global Feedback Banner */}
      {feedback.message && (
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-xs animate-in fade-in duration-200 shadow-xs ${
            feedback.type === 'error'
              ? 'border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200'
              : 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200'
          }`}
        >
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {feedback.type === 'error' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              )}
            </svg>
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback({ type: '', message: '' })}
            className="font-bold ml-2 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
            Employees &amp; Team
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {currentOrg
              ? `Workspace directory for ${currentOrg.name} (${pagination.totalItems} active / ${isFreePlan ? '5' : 'Unlimited'} seats)`
              : 'Manage all company members, assigned roles, and invitations.'}
          </p>
        </div>

        {isLoggedIn && isManager && (
          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
            {/* Invite button */}
            <button
              onClick={() => {
                setInviteModalError('');
                setLastCreatedInvite(null);
                setInviteFormData({ email: '', role: 'member' });
                setShowInviteModal(true);
              }}
              className="btn-primary flex items-center gap-1.5 text-xs py-2 px-3.5 rounded-lg cursor-pointer"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              <span>Invite Member</span>
            </button>

            {/* Direct Add Account button (Admin/Owner) */}
            {isAdminOrOwner && (
              <button
                onClick={() => {
                  setAddModalError('');
                  setAddFormData({ name: '', email: '', password: '', role: 'member' });
                  setShowAddModal(true);
                }}
                className="btn-secondary flex items-center gap-1.5 text-xs py-2 px-3.5 rounded-lg cursor-pointer"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                <span>Add Account Directly</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tabs Switcher: Active Members vs. Pending Invitations */}
      {isLoggedIn && isManager && (
        <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800">
          <button
            onClick={() => setActiveTab('members')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'members'
                ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>Active Team Members</span>
            <span className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 text-[10px] font-medium">
              {pagination.totalItems}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('invitations')}
            className={`pb-3 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-colors cursor-pointer ${
              activeTab === 'invitations'
                ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <span>Pending Invitations</span>
            {invitations.length > 0 && (
              <span className="rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-bold px-2 py-0.5 text-[10px] border border-blue-200/50 dark:border-blue-800/60">
                {invitations.length}
              </span>
            )}
          </button>
        </div>
      )}

      {/* TAB 1: ACTIVE MEMBERS */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-4 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            {/* Search */}
            <div className="relative flex-1">
              <svg className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search employees by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-8 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900 focus:bg-white dark:focus:bg-[#0B1120] focus:outline-hidden focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 text-slate-800 dark:text-slate-200 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-2.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Controls: Role Filter & View Mode Toggle */}
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 cursor-pointer"
              >
                <option value="">All Roles</option>
                <option value="owner">Owner</option>
                <option value="admin">Admin</option>
                <option value="manager">Manager</option>
                <option value="member">Member</option>
              </select>

              {(searchTerm || roleFilter) && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setRoleFilter('');
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold cursor-pointer"
                >
                  Reset
                </button>
              )}

              {/* View Switcher: Table vs Cards */}
              <div className="inline-flex items-center rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100/80 dark:bg-slate-800/80 p-0.5 ml-1">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    viewMode === 'table'
                      ? 'bg-white dark:bg-[#1E293B] text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Table View"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                  <span className="hidden sm:inline">Table</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                    viewMode === 'cards'
                      ? 'bg-white dark:bg-[#1E293B] text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                  title="Profile Cards View"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                  <span className="hidden sm:inline">Cards</span>
                </button>
              </div>
            </div>
          </div>

          {/* Members Container */}
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs overflow-hidden">
            {loading ? (
              <div className="py-16 text-center text-xs text-slate-500 dark:text-slate-400">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2" />
                <p>Loading employee directory...</p>
              </div>
            ) : loadError ? (
              <div className="p-8 text-center text-xs text-red-600 dark:text-red-400">
                <p>{loadError}</p>
                <button onClick={() => loadMembers()} className="mt-2 text-blue-600 dark:text-blue-400 underline font-medium cursor-pointer">
                  Retry loading
                </button>
              </div>
            ) : employees.length === 0 ? (
              <div className="p-12 text-center text-slate-500 dark:text-slate-400">
                <p className="font-semibold text-sm text-slate-800 dark:text-slate-200">No employees found</p>
                <p className="text-xs mt-1">Try adjusting your search or filters.</p>
              </div>
            ) : viewMode === 'cards' ? (
              /* ── CARDS VIEW ── */
              <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {employees.map((emp) => {
                  const empUserId = emp.userId?.toString() || emp.id?.toString();
                  const isSelf = empUserId === currentUserId?.toString();
                  const isEmpOwner = emp.role === 'owner';
                  const canChangeRole = isAdminOrOwner && !isEmpOwner && !isSelf && (isOwner || emp.role !== 'admin');

                  return (
                    <div
                      key={emp.id || emp.userId || emp.email}
                      className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] p-4 shadow-xs hover:border-blue-400 dark:hover:border-blue-500/60 transition-all flex flex-col justify-between"
                    >
                      <div>
                        {/* Card Header: Avatar & Info */}
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            onClick={() => setSelectedProfileMemberId(emp.id || emp.userId)}
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/80 text-sm font-bold text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/60 overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-400 transition-all"
                            title="View member profile"
                          >
                            {emp.avatar ? (
                              <img src={emp.avatar} alt={emp.name} className="h-full w-full object-cover" />
                            ) : (
                              <span>{emp.name ? emp.name.charAt(0).toUpperCase() : 'U'}</span>
                            )}
                          </button>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                type="button"
                                onClick={() => setSelectedProfileMemberId(emp.id || emp.userId)}
                                className="font-bold text-xs text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 truncate text-left cursor-pointer"
                              >
                                {emp.name}
                              </button>
                              {isSelf && (
                                <span className="rounded-md bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 text-[10px] font-semibold text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/60">
                                  You
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{emp.email}</p>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="capitalize font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[10px]">
                                {emp.role || 'Member'}
                              </span>
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-0.2 text-[10px] font-medium ${(emp.status || 'Active') === 'Active'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300'
                                }`}
                              >
                                {emp.status || 'Active'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Real Work Statistics */}
                        <div className="mt-4 grid grid-cols-3 gap-2 text-center border-y border-slate-100 dark:border-slate-800/60 py-2.5">
                          <div>
                            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase">Projects</p>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                              {emp.assignedProjectsCount || 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase">Completed</p>
                            <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                              {emp.completedTasksCount || 0}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase">Pending</p>
                            <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                              {emp.pendingTasksCount || 0}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Card Footer: Profile Button & Actions */}
                      <div className="mt-3 flex items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setSelectedProfileMemberId(emp.id || emp.userId)}
                          className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 cursor-pointer flex items-center gap-1"
                        >
                          <span>View Profile</span>
                          <span>→</span>
                        </button>

                        <div className="flex items-center gap-2">
                          {canChangeRole && (
                            <select
                              value={emp.role}
                              disabled={updatingRoleId === (emp.id || emp.userId)}
                              onChange={(e) =>
                                handleRoleChange(emp.id || emp.userId, e.target.value, emp.name)
                              }
                              className="text-[11px] font-medium rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-1.5 py-0.5 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600 cursor-pointer"
                            >
                              {isOwner && <option value="admin">Admin</option>}
                              <option value="manager">Manager</option>
                              <option value="member">Member</option>
                            </select>
                          )}

                          {isAdminOrOwner && !isEmpOwner && !isSelf && (
                            <button
                              type="button"
                              onClick={() => {
                                setRemoveError('');
                                setMemberToRemove(emp);
                              }}
                              className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 text-xs p-1 cursor-pointer"
                              title={`Remove ${emp.name}`}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* ── TABLE VIEW ── */
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50/70 dark:bg-slate-900/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                    <tr>
                      <th className="px-6 py-3.5">Team Member</th>
                      <th className="px-4 py-3.5">Access Role</th>
                      <th className="px-4 py-3.5 text-center">Assigned Projects</th>
                      <th className="px-4 py-3.5 text-center">Completed Tasks</th>
                      <th className="px-4 py-3.5 text-center">Pending Tasks</th>
                      <th className="px-4 py-3.5">Status</th>
                      <th className="px-6 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {employees.map((emp) => {
                      const empUserId = emp.userId?.toString() || emp.id?.toString();
                      const isSelf = empUserId === currentUserId?.toString();
                      const isEmpOwner = emp.role === 'owner';
                      const canChangeRole = isAdminOrOwner && !isEmpOwner && !isSelf && (isOwner || emp.role !== 'admin');

                      return (
                        <tr key={emp.id || emp.userId || emp.email} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                          {/* Member info with avatar */}
                          <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setSelectedProfileMemberId(emp.id || emp.userId)}
                                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-xs font-semibold text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/60 overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
                                title="View profile"
                              >
                                {emp.avatar ? (
                                  <img src={emp.avatar} alt={emp.name} className="h-full w-full object-cover" />
                                ) : (
                                  <span>{emp.name ? emp.name.charAt(0).toUpperCase() : 'U'}</span>
                                )}
                              </button>
                              <div>
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedProfileMemberId(emp.id || emp.userId)}
                                    className="font-semibold text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer text-left"
                                  >
                                    {emp.name}
                                  </button>
                                  {isSelf && (
                                    <span className="rounded-md bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/60">
                                      You
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-400 dark:text-slate-500">{emp.email}</p>
                              </div>
                            </div>
                          </td>

                          {/* Access role */}
                          <td className="px-4 py-4 text-xs whitespace-nowrap">
                            {canChangeRole ? (
                              <select
                                value={emp.role}
                                disabled={updatingRoleId === (emp.id || emp.userId)}
                                onChange={(e) =>
                                  handleRoleChange(emp.id || emp.userId, e.target.value, emp.name)
                                }
                                className="text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-900/40 disabled:opacity-50 cursor-pointer"
                              >
                                {isOwner && <option value="admin">Admin</option>}
                                <option value="manager">Manager</option>
                                <option value="member">Member</option>
                              </select>
                            ) : (
                              <span className="capitalize font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded text-[11px]">
                                {emp.role || 'Member'}
                              </span>
                            )}
                          </td>

                          {/* Assigned Projects count */}
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                              <span>📁</span>
                              <span>{emp.assignedProjectsCount || 0}</span>
                            </span>
                          </td>

                          {/* Completed tasks count */}
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/50 dark:border-emerald-800/60 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                              <span>✓</span>
                              <span>{emp.completedTasksCount || 0}</span>
                            </span>
                          </td>

                          {/* Pending tasks count */}
                          <td className="px-4 py-4 whitespace-nowrap text-center">
                            <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 dark:bg-amber-950/50 border border-amber-200/50 dark:border-amber-800/60 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
                              <span>⏳</span>
                              <span>{emp.pendingTasksCount || 0}</span>
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-4 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${(emp.status || 'Active') === 'Active'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/60'
                                }`}
                            >
                              {emp.status || 'Active'}
                            </span>
                          </td>

                          {/* Actions: View Profile & Remove */}
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setSelectedProfileMemberId(emp.id || emp.userId)}
                                className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline cursor-pointer"
                              >
                                View Profile
                              </button>

                              {isAdminOrOwner && !isEmpOwner && !isSelf && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setRemoveError('');
                                    setMemberToRemove(emp);
                                  }}
                                  className="btn-danger text-xs py-1 px-2.5"
                                  title={`Remove ${emp.name} from organisation`}
                                >
                                  Remove
                                </button>
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

            {/* Pagination Controls */}
            {!loading && !loadError && employees.length > 0 && (
              <PaginationControls
                currentPage={pagination.currentPage}
                totalPages={pagination.totalPages}
                totalItems={pagination.totalItems}
                limit={pagination.limit}
                onPageChange={(p) => setCurrentPage(p)}
                itemName="employees"
              />
            )}
          </div>
        </div>
      )}

      {/* TAB 2: INVITATIONS */}
      {activeTab === 'invitations' && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Invitations Management</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Track and manage workspace email invitation links</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
                {['all', 'pending', 'accepted', 'expired'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => {
                      setInvitationFilter(st);
                      loadInvitations(st);
                    }}
                    className={`px-2.5 py-1 text-xs rounded-md capitalize transition-colors cursor-pointer ${
                      invitationFilter === st
                        ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 font-medium'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
              <button
                onClick={() => loadInvitations(invitationFilter)}
                disabled={loadingInvites}
                className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-semibold cursor-pointer ml-1"
              >
                {loadingInvites ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          {loadingInvites ? (
            <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2" />
              <p>Loading invitations...</p>
            </div>
          ) : invitations.length === 0 ? (
            <div className="p-12 text-center text-slate-500 dark:text-slate-400">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 mb-3">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <p className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                {invitationFilter === 'all'
                  ? 'No invitations found'
                  : `No ${invitationFilter} invitations`}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Invite team members to collaborate on projects and tasks.
              </p>
              <button
                onClick={() => {
                  setInviteModalError('');
                  setLastCreatedInvite(null);
                  setShowInviteModal(true);
                }}
                className="btn-primary mt-4 inline-flex text-xs py-2 px-4 rounded-lg cursor-pointer"
              >
                Send Workspace Invitation
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50/70 dark:bg-slate-900/70 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3.5">Invited Email</th>
                    <th className="px-6 py-3.5">Assigned Role</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Invited By</th>
                    <th className="px-6 py-3.5">Expires</th>
                    <th className="px-6 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {invitations.map((inv) => (
                    <tr key={inv._id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        {inv.email}
                      </td>
                      <td className="px-6 py-4 text-xs whitespace-nowrap">
                        <span className="capitalize font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200/50 dark:border-blue-800/60 px-2 py-0.5 rounded text-[11px]">
                          {inv.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs whitespace-nowrap">
                        {getInviteStatusBadge(inv.status)}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {inv.invitedBy?.name || 'Administrator'}
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {inv.status === 'accepted' ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">Joined Workspace</span>
                        ) : inv.expiresAt ? (
                          new Date(inv.expiresAt).toLocaleDateString()
                        ) : (
                          '7 days'
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right space-x-2">
                        {inv.status === 'accepted' ? (
                          <span className="text-xs text-slate-400 dark:text-slate-500 italic">No action needed</span>
                        ) : (
                          <>
                            {/* Resend button */}
                            <button
                              type="button"
                              disabled={inviteActionLoading === inv._id}
                              onClick={() => handleResendInvitation(inv._id, inv.email)}
                              className="btn-secondary text-xs py-1 px-2.5 disabled:opacity-50 cursor-pointer"
                            >
                              {inviteActionLoading === inv._id ? 'Resending...' : 'Resend'}
                            </button>

                            {/* Cancel button */}
                            {inv.status !== 'expired' && (
                              <button
                                type="button"
                                disabled={inviteActionLoading === inv._id}
                                onClick={() => handleRevokeInvitation(inv._id, inv.email)}
                                className="btn-danger text-xs py-1 px-2.5 disabled:opacity-50 cursor-pointer"
                              >
                                Cancel
                              </button>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Invite Member Modal ── */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-xl animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Invite Team Member</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Send a secure workspace invitation link by email</p>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {inviteModalError && (
              <div className="mt-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300">
                {inviteModalError}
              </div>
            )}

            {lastCreatedInvite ? (
              <div className="mt-4 space-y-4">
                {lastCreatedInvite.emailSent || lastCreatedInvite.emailDelivery?.sent ? (
                  <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/40 p-3.5 text-xs text-emerald-800 dark:text-emerald-300">
                    <div className="flex items-center gap-1.5 font-semibold text-emerald-900 dark:text-emerald-100">
                      <svg className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Invitation Email Sent via Resend</span>
                    </div>
                    <p className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-300">
                      The recipient will receive an invitation email with a secure join link (valid for 7 days).
                      {lastCreatedInvite.emailDelivery?.messageId && (
                        <span className="block mt-0.5 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                          Resend ID: {lastCreatedInvite.emailDelivery.messageId}
                        </span>
                      )}
                    </p>
                  </div>
                ) : lastCreatedInvite.emailDelivery?.deliveryStatus === 'simulated_dev_log' ? (
                  <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 p-3.5 text-xs text-blue-800 dark:text-blue-300">
                    <div className="flex items-center gap-1.5 font-semibold text-blue-900 dark:text-blue-100">
                      <svg className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Development Simulation Mode</span>
                    </div>
                    <p className="mt-1 text-[11px] text-blue-700 dark:text-blue-300">
                      Resend is not configured or in development simulation. The token was generated and logged to the server console.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/40 p-3.5 text-xs text-amber-800 dark:text-amber-300">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-100">
                      <svg className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span>Email Delivery Notice</span>
                    </div>
                    <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                      {lastCreatedInvite.emailDelivery?.reason
                        ? `Delivery could not be confirmed: ${lastCreatedInvite.emailDelivery.reason}.`
                        : 'Email delivery could not be completed.'}
                      {' '}You can copy and send the link manually below.
                    </p>
                  </div>
                )}

                {/* Direct Invitation Link Box */}
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-3 text-xs space-y-1.5">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 text-[11px] uppercase tracking-wider">
                    Direct Invitation Link
                  </span>
                  <div className="mt-1 flex items-center gap-2 bg-white dark:bg-slate-950 rounded-lg border border-slate-200 dark:border-slate-800 p-2 font-mono text-[11px] text-slate-800 dark:text-slate-200 break-all">
                    <span className="flex-1 truncate">{lastCreatedInvite.inviteUrl}</span>
                    <button
                      type="button"
                      onClick={() => handleCopyInviteLink(lastCreatedInvite.inviteUrl)}
                      className="shrink-0 font-sans font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
                    >
                      Copy Link
                    </button>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLastCreatedInvite(null);
                      setShowInviteModal(false);
                    }}
                    className="btn-primary text-xs py-2 px-4 rounded-lg cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendInvitation} className="mt-4 space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                  <input
                    type="email"
                    required
                    value={inviteFormData.email}
                    onChange={(e) => setInviteFormData({ ...inviteFormData, email: e.target.value })}
                    placeholder="colleague@example.com"
                    className="input-field text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Workspace Role</label>
                  <select
                    value={inviteFormData.role}
                    onChange={(e) => setInviteFormData({ ...inviteFormData, role: e.target.value })}
                    className="input-field text-sm cursor-pointer"
                  >
                    {isOwner && <option value="admin">Admin</option>}
                    <option value="manager">Manager</option>
                    <option value="member">Member</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="btn-secondary text-xs py-2 px-4 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingInvite}
                    className="btn-primary text-xs py-2 px-4 cursor-pointer disabled:opacity-50"
                  >
                    {submittingInvite ? 'Sending...' : 'Send Invitation'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ── Add Employee Account Directly Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-xl animate-in fade-in zoom-in-95 duration-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Add New Employee</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Directly create an employee account with a password</p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {addModalError && (
              <div className="mt-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-3 text-xs text-red-700 dark:text-red-300">
                {addModalError}
              </div>
            )}

            <form onSubmit={handleAddEmployee} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={addFormData.name}
                  onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
                  placeholder="e.g. Alice Smith"
                  required
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={addFormData.email}
                  onChange={(e) => setAddFormData({ ...addFormData, email: e.target.value })}
                  placeholder="alice@company.com"
                  required
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Initial Login Password</label>
                <input
                  type="password"
                  name="password"
                  value={addFormData.password}
                  onChange={(e) => setAddFormData({ ...addFormData, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="input-field text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700 dark:text-slate-300">Workspace Role</label>
                <select
                  name="role"
                  value={addFormData.role}
                  onChange={(e) => setAddFormData({ ...addFormData, role: e.target.value })}
                  className="input-field text-sm cursor-pointer"
                >
                  {isOwner && <option value="admin">Admin</option>}
                  <option value="manager">Manager</option>
                  <option value="member">Member</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="btn-secondary text-xs py-2 px-4 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="btn-primary text-xs py-2 px-4 cursor-pointer disabled:opacity-50"
                >
                  {submittingAdd ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Remove Employee Confirmation Modal ── */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-red-100 dark:border-red-950/60 bg-white dark:bg-[#111827] p-6 shadow-xl animate-in fade-in zoom-in-95 duration-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 mb-3">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Confirm Member Removal</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Are you sure you want to remove <strong className="font-semibold text-slate-800 dark:text-slate-200">{memberToRemove.name}</strong> from this workspace?
            </p>

            {removeError && (
              <div className="mt-3 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 p-2 text-xs text-red-700 dark:text-red-300">
                {removeError}
              </div>
            )}

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setMemberToRemove(null)}
                className="btn-secondary text-xs py-1.5 px-3 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removingMember}
                onClick={handleConfirmRemove}
                className="btn-danger text-xs py-1.5 px-3"
              >
                {removingMember ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Member Profile Details Modal ── */}
      {selectedProfileMemberId && (
        <MemberProfileModal
          memberId={selectedProfileMemberId}
          orgId={orgId}
          onClose={() => setSelectedProfileMemberId(null)}
          onAvatarUpdated={() => loadMembers(currentPage)}
        />
      )}
    </div>
  );
}

export default Employees;
