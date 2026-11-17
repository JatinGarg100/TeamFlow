import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  fetchOrgMembers,
  addOrgMember,
  removeOrgMemberApi,
  getStoredAuth,
} from '../services/api';
import PaginationControls from '../components/PaginationControls';
import { useDebounce } from '../hooks/useDebounce';

/**
 * Employees page
 * ──────────────
 * Connected to GET /api/orgs/:orgId/members with:
 * - Debounced search by employee name or email
 * - Role filtering (owner, admin, member, manager)
 * - Pagination (previous / next controls)
 * - Directly creates employee accounts with email & password
 */
function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Search, filter & pagination state
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [roleFilter, setRoleFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    limit: 8,
  });

  // Add Employee Modal State
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'member',
  });

  // Remove Employee Modal / Confirmation State
  const [memberToRemove, setMemberToRemove] = useState(null);
  const [removingMember, setRemovingMember] = useState(false);
  const [removeError, setRemoveError] = useState('');

  const auth = getStoredAuth();
  const isLoggedIn = Boolean(auth?.token && auth?.user);
  const currentUserId = auth?.user?.id || auth?.user?._id;
  const currentOrg = auth?.organisation;
  const orgId = currentOrg?.id;
  const userRole = currentOrg?.role || 'member';
  const isAdminOrOwner = ['owner', 'admin'].includes(userRole);

  const isFreePlan = (currentOrg?.plan || 'free') === 'free';
  const isMemberLimitReached = isFreePlan && (pagination.totalItems >= 5 || employees.length >= 5);

  // Fetch organisation members from backend
  const loadData = useCallback(async (pageToLoad = currentPage) => {
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

  // When filters or search change, reset to page 1
  useEffect(() => {
    setCurrentPage(1);
    loadData(1);
  }, [debouncedSearch, roleFilter]);

  // When page changes, load data for that page
  useEffect(() => {
    loadData(currentPage);
  }, [currentPage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleChange = (e) => {
    setModalError('');
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  // Handle Create Employee Submission
  const handleAddEmployee = async (e) => {
    e.preventDefault();
    setModalError('');

    if (!formData.name.trim() || formData.name.trim().length < 2) {
      setModalError('Please enter a valid employee name (at least 2 characters).');
      return;
    }

    if (!formData.email.trim()) {
      setModalError('Please enter a valid email address.');
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      setModalError('Password must be at least 6 characters long.');
      return;
    }

    if (!orgId) {
      setModalError('No active organisation found. Please sign in again.');
      return;
    }

    if (isMemberLimitReached) {
      setModalError('Free plan member limit of 5 reached. Please upgrade to Pro on the Plans page to add more members.');
      return;
    }

    setSubmitting(true);
    try {
      const added = await addOrgMember(orgId, {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
      });

      setFeedback({
        type: 'success',
        message: `Account created for "${added.name}"! The employee can now log in using ${added.email} and complete tasks.`,
      });

      setFormData({ name: '', email: '', password: '', role: 'member' });
      setShowModal(false);
      await loadData();
      setTimeout(() => setFeedback({ type: '', message: '' }), 6000);
    } catch (err) {
      setModalError(err.message || 'Failed to add employee.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Remove Employee from Organisation
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
      await loadData();
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
        <div className="rounded-2xl border border-[#DCD9FA] bg-gradient-to-r from-[#EEEDFD]/80 to-white p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-[#1E202A]">Authentication Required</h2>
            <p className="text-xs text-[#64748B] mt-0.5">Please sign in or create an account to view and manage company employees.</p>
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

      {/* Free Plan Quota Warning Banner (5 members max) */}
      {isLoggedIn && isMemberLimitReached && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            <span>
              <strong>Free Plan Member Limit (5/5) Reached.</strong> Your organisation has reached the maximum of 5 members allowed on the Free tier.
            </span>
          </div>
          <Link to="/plans" className="shrink-0 font-semibold text-[#5B4BDB] hover:underline ml-3">
            View Plans & Upgrade →
          </Link>
        </div>
      )}

      {/* Global Feedback Banner */}
      {feedback.message && (
        <div
          className={`flex items-center justify-between rounded-xl border px-4 py-3 text-xs animate-in fade-in duration-200 ${feedback.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-emerald-200 bg-emerald-50 text-emerald-800'
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

      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1E202A] sm:text-3xl">
            Employees &amp; Team
          </h1>
          <p className="mt-1 text-sm text-[#64748B]">
            {currentOrg
              ? `Team directory for ${currentOrg.name} (${pagination.totalItems} active / ${isFreePlan ? '5' : '∞'} seats)`
              : 'Manage all company members, assigned roles, and activity status.'}
          </p>
        </div>

        {isLoggedIn && isAdminOrOwner && (
          <button
            onClick={() => {
              setModalError('');
              setFormData({ name: '', email: '', password: '', role: 'member' });
              setShowModal(true);
            }}
            className="btn-primary shrink-0 self-start sm:self-auto cursor-pointer"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            <span>+ Add Employee</span>
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
            placeholder="Search employees by name or email..."
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

        {/* Role Filter */}
        <div className="flex items-center gap-2">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-[#5B4BDB] cursor-pointer"
          >
            <option value="">All Roles</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="member">Member</option>
          </select>

          {(searchTerm || roleFilter) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setRoleFilter('');
              }}
              className="text-xs px-2.5 py-2 text-rose-600 hover:bg-rose-50 rounded-lg transition font-medium cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Employees Table Card */}
      <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-xs overflow-hidden">
        {loadError ? (
          <div className="p-8 text-center text-sm text-red-600 bg-red-50/50">
            <p className="font-medium">Error loading employees: {loadError}</p>
            <button
              onClick={loadData}
              className="mt-3 inline-flex items-center rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : loading ? (
          <div className="flex items-center justify-center p-12 text-sm text-[#64748B]">
            <svg className="h-5 w-5 animate-spin text-[#5B4BDB] mr-2" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
            </svg>
            <span>Loading employee directory from database...</span>
          </div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center text-sm text-[#64748B]">
            <p>No employees found in this organisation.</p>
            {isAdminOrOwner && (
              <button
                onClick={() => setShowModal(true)}
                className="mt-3 btn-primary text-xs"
              >
                + Add First Employee
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F8FAFC] text-[11px] font-semibold uppercase tracking-wider text-[#64748B] border-b border-[#E2E8F0]">
                <tr>
                  <th className="px-6 py-3.5">Employee Name</th>
                  <th className="px-6 py-3.5">Email Address</th>
                  <th className="px-6 py-3.5">Access Role</th>
                  <th className="px-6 py-3.5">Status</th>
                  {isAdminOrOwner && <th className="px-6 py-3.5 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {employees.map((emp) => {
                  const empUserId = emp.userId?.toString() || emp.id?.toString();
                  const isSelf = empUserId === currentUserId?.toString();
                  const isOwner = emp.role === 'owner';

                  return (
                    <tr key={emp.id || emp.userId || emp.email} className="hover:bg-[#F8FAFC]/80 transition-colors">
                      <td className="px-6 py-4 font-medium text-[#1E202A] whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#EEEDFD] text-xs font-semibold text-[#5B4BDB]">
                            {emp.name ? emp.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                          <div>
                            <span className="font-semibold">{emp.name}</span>
                            {isSelf && (
                              <span className="ml-2 rounded-md bg-[#EEEDFD] px-1.5 py-0.5 text-[10px] font-medium text-[#5B4BDB]">
                                You
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-[#64748B] whitespace-nowrap">
                        {emp.email}
                      </td>
                      <td className="px-6 py-4 text-xs whitespace-nowrap">
                        <span className="capitalize font-medium text-[#1E202A] bg-gray-100 px-2 py-0.5 rounded text-[11px]">
                          {emp.role || 'Member'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${(emp.status || 'Active') === 'Active'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                            }`}
                        >
                          {emp.status || 'Active'}
                        </span>
                      </td>
                      {isAdminOrOwner && (
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          {isOwner ? (
                            <span className="text-[11px] text-gray-400 italic">Owner</span>
                          ) : isSelf ? (
                            <span className="text-[11px] text-gray-400 italic">Current User</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setRemoveError('');
                                setMemberToRemove(emp);
                              }}
                              className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors cursor-pointer"
                              title={`Remove ${emp.name} from organisation`}
                            >
                              Remove
                            </button>
                          )}
                        </td>
                      )}
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

      {/* ── Add Employee Modal (Name, Email, Password, Role) ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div>
                <h2 className="text-base font-semibold text-[#1E202A]">Add New Employee</h2>
                <p className="text-xs text-[#64748B]">Create employee account with email &amp; login password</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Error Banner */}
            {modalError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                <svg className="h-4 w-4 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleAddEmployee} className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-[#1E202A]">Full Name</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Alice Smith"
                  required
                  className="w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2 text-sm text-[#1E202A] outline-none transition-all focus:border-[#5B4BDB] focus:ring-2 focus:ring-[#EEEDFD]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#1E202A]">Email Address</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="e.g. alice@company.com"
                  required
                  className="w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2 text-sm text-[#1E202A] outline-none transition-all focus:border-[#5B4BDB] focus:ring-2 focus:ring-[#EEEDFD]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#1E202A]">Login Password</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Minimum 6 characters"
                  required
                  minLength={6}
                  className="w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2 text-sm text-[#1E202A] outline-none transition-all focus:border-[#5B4BDB] focus:ring-2 focus:ring-[#EEEDFD]"
                />
                <p className="mt-1 text-[11px] text-[#64748B]">
                  The employee will sign in with this email and password to view and complete tasks.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-[#1E202A]">Access Role</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-[#E2E8F0] px-3.5 py-2 text-sm text-[#1E202A] outline-none transition-all focus:border-[#5B4BDB] focus:ring-2 focus:ring-[#EEEDFD]"
                >
                  <option value="member">Member — Standard employee (updates task status)</option>
                  <option value="manager">Manager — Can create projects and assign tasks</option>
                  {userRole === 'owner' && <option value="admin">Admin — Full workspace administrative rights</option>}
                </select>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-gray-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary text-xs py-2 px-4 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Creating Employee...' : 'Create Employee Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Remove Employee Confirmation Modal ── */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center gap-3 text-red-600">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-bold text-[#1E202A]">Remove Employee</h3>
                <p className="text-xs text-[#64748B]">Action cannot be undone</p>
              </div>
            </div>

            {removeError && (
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 animate-in fade-in duration-150">
                <svg className="h-4 w-4 shrink-0 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{removeError}</span>
              </div>
            )}

            <p className="mt-4 text-xs text-[#64748B] leading-relaxed">
              Are you sure you want to remove <strong>{memberToRemove.name}</strong> ({memberToRemove.email}) from <strong>{currentOrg?.name}</strong>?
            </p>
            <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 rounded-lg p-2.5 border border-amber-200">
              Note: If this employee has active, incomplete tasks assigned in any project, removal will be blocked until those tasks are completed or reassigned.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => {
                  setMemberToRemove(null);
                  setRemoveError('');
                }}
                disabled={removingMember}
                className="rounded-lg px-4 py-2 text-xs font-semibold text-[#64748B] hover:bg-gray-100 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmRemove}
                disabled={removingMember}
                className="rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {removingMember ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Employees;
