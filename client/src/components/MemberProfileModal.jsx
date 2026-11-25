import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { fetchMemberProfileApi, uploadAvatarApi } from '../services/api';
import { useAuth } from '../context/AuthContext';

/**
 * MemberProfileModal Component
 * ────────────────────────────
 * Displays comprehensive member profile details:
 * - Profile picture (with instant upload for current logged-in user)
 * - Personal info (name, email, role badge, joined date)
 * - Work statistics (assigned projects, completed/pending/total tasks, completion rate)
 * - Assigned Projects list with status badges and links
 * - Assigned Tasks list with project name, priority, status, and due dates
 * - Dark Mode and Light Mode support
 */
function MemberProfileModal({ memberId, orgId, onClose, onAvatarUpdated }) {
  const { user: currentUser, reloadUser } = useAuth() || {};
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'projects' | 'tasks'

  // Avatar upload state (when viewing own profile)
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const fileInputRef = useRef(null);

  const currentUserId = (currentUser?.id || currentUser?._id)?.toString();
  const isSelf = profileData?.member && ((profileData.member.id || profileData.member.userId || profileData.member._id)?.toString() === currentUserId);

  useEffect(() => {
    let isMounted = true;

    const loadProfile = async () => {
      if (!orgId || !memberId) return;
      setLoading(true);
      setError('');
      try {
        const data = await fetchMemberProfileApi(orgId, memberId);
        if (isMounted) {
          setProfileData(data);
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load member profile');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadProfile();

    return () => {
      isMounted = false;
    };
  }, [orgId, memberId]);

  // Handle avatar upload
  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (3MB limit)
    if (file.size > 3 * 1024 * 1024) {
      setAvatarError('Image must be under 3 MB.');
      return;
    }

    setAvatarError('');
    setUploadingAvatar(true);
    try {
      const res = await uploadAvatarApi(file);
      if (profileData?.member) {
        setProfileData((prev) => ({
          ...prev,
          member: {
            ...prev.member,
            avatar: res.avatar,
          },
        }));
      }
      if (typeof reloadUser === 'function') {
        await reloadUser();
      }
      if (typeof onAvatarUpdated === 'function') {
        onAvatarUpdated(res.avatar);
      }
    } catch (err) {
      setAvatarError(err.message || 'Failed to upload profile picture.');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const member = profileData?.member;
  const stats = member?.stats || {
    assignedProjectsCount: 0,
    completedTasksCount: 0,
    pendingTasksCount: 0,
    totalTasksCount: 0,
  };
  const projects = profileData?.projects || [];
  const tasks = profileData?.tasks || [];

  const completionRate = stats.totalTasksCount > 0
    ? Math.round((stats.completedTasksCount / stats.totalTasksCount) * 100)
    : 0;

  // Format joined date
  const joinedDateStr = member?.joinedAt
    ? new Date(member.joinedAt).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
    : '';

  // Role styling helper
  const getRoleBadge = (role) => {
    switch (role?.toLowerCase()) {
      case 'owner':
        return 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200/60 dark:border-purple-800/60';
      case 'admin':
        return 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/60 dark:border-blue-800/60';
      case 'manager':
        return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'High':
        return 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200/60 dark:border-rose-800/60';
      case 'Medium':
        return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Completed':
        return 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200/60 dark:border-emerald-800/60';
      case 'In Progress':
        return 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-200/60 dark:border-blue-800/60';
      case 'On Hold':
        return 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200/60 dark:border-amber-800/60';
      default:
        return 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
    }
  };

  // Check if task is overdue
  const isTaskOverdue = (task) => {
    if (!task.dueDate || task.status === 'Completed') return false;
    return new Date(task.dueDate) < new Date();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-8">
        {/* Header background band */}
        <div className="h-28 bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-blue-700 dark:to-slate-900 relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3.5 right-3.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/20 text-white hover:bg-black/40 transition-colors cursor-pointer"
            aria-label="Close profile modal"
          >
            ✕
          </button>
        </div>

        {/* Modal Content */}
        <div className="px-6 pb-6 pt-0">
          {/* Avatar and Info Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 -mt-14 mb-5">
            <div className="flex items-end gap-4">
              {/* Avatar with optional upload button */}
              <div className="relative group">
                <div className="flex h-24 w-24 items-center justify-center rounded-2xl border-4 border-white dark:border-[#111827] bg-blue-100 dark:bg-blue-950/80 text-2xl font-bold text-blue-600 dark:text-blue-400 shadow-md overflow-hidden shrink-0">
                  {member?.avatar ? (
                    <img
                      src={member.avatar}
                      alt={member.name || 'Member'}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                      }}
                    />
                  ) : (
                    <span>{member?.name ? member.name.charAt(0).toUpperCase() : 'U'}</span>
                  )}
                </div>

                {/* Upload button for own profile */}
                {isSelf && (
                  <>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleAvatarChange}
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                    />
                    <button
                      type="button"
                      disabled={uploadingAvatar}
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-1 right-1 flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white shadow-md hover:bg-blue-700 transition-all cursor-pointer disabled:opacity-50"
                      title="Update Profile Picture"
                    >
                      {uploadingAvatar ? (
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      ) : (
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                        </svg>
                      )}
                    </button>
                  </>
                )}
              </div>

              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                    {member?.name || 'Team Member'}
                  </h3>
                  {isSelf && (
                    <span className="rounded-md bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/60">
                      You
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{member?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold capitalize ${getRoleBadge(
                  member?.role
                )}`}
              >
                {member?.role || 'Member'}
              </span>
              {joinedDateStr && (
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  Joined {joinedDateStr}
                </span>
              )}
            </div>
          </div>

          {avatarError && (
            <div className="mb-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 p-2.5 text-xs text-red-700 dark:text-red-300">
              {avatarError}
            </div>
          )}

          {loading ? (
            <div className="py-16 text-center text-xs text-slate-500 dark:text-slate-400">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mb-2" />
              <p>Loading member profile details...</p>
            </div>
          ) : error ? (
            <div className="py-8 text-center text-xs text-red-600 dark:text-red-400">
              <p>{error}</p>
              <button
                type="button"
                onClick={onClose}
                className="mt-3 btn-secondary text-xs py-1.5 px-3 rounded-lg cursor-pointer"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              {/* Work Statistics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-3.5">
                  <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    Assigned Projects
                  </p>
                  <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
                    {stats.assignedProjectsCount}
                  </p>
                </div>

                <div className="rounded-xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5">
                  <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                    Completed Tasks
                  </p>
                  <p className="mt-1 text-xl font-bold text-emerald-700 dark:text-emerald-300">
                    {stats.completedTasksCount}
                  </p>
                </div>

                <div className="rounded-xl border border-amber-100 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 p-3.5">
                  <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                    Pending Tasks
                  </p>
                  <p className="mt-1 text-xl font-bold text-amber-700 dark:text-amber-300">
                    {stats.pendingTasksCount}
                  </p>
                </div>

                <div className="rounded-xl border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/20 p-3.5">
                  <p className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wider">
                    Completion Rate
                  </p>
                  <p className="mt-1 text-xl font-bold text-blue-700 dark:text-blue-300">
                    {completionRate}%
                  </p>
                </div>
              </div>

              {/* Navigation Tabs inside modal */}
              <div className="flex items-center gap-1 border-b border-slate-200 dark:border-slate-800 mb-4">
                <button
                  type="button"
                  onClick={() => setActiveTab('overview')}
                  className={`pb-2.5 px-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'overview'
                      ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Overview
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('projects')}
                  className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'projects'
                      ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <span>Assigned Projects</span>
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.2 text-[10px]">
                    {projects.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('tasks')}
                  className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-1.5 border-b-2 transition-colors cursor-pointer ${
                    activeTab === 'tasks'
                      ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  <span>Assigned Tasks</span>
                  <span className="rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.2 text-[10px]">
                    {tasks.length}
                  </span>
                </button>
              </div>

              {/* Tab Content */}
              <div className="max-h-72 overflow-y-auto pr-1">
                {/* 1. OVERVIEW TAB */}
                {activeTab === 'overview' && (
                  <div className="space-y-4">
                    {/* Completion Progress Bar */}
                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/40 p-4">
                      <div className="flex items-center justify-between text-xs font-semibold mb-2">
                        <span className="text-slate-700 dark:text-slate-300">Task Completion Progress</span>
                        <span className="text-blue-600 dark:text-blue-400">
                          {stats.completedTasksCount} of {stats.totalTasksCount} completed ({completionRate}%)
                        </span>
                      </div>
                      <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-600 dark:bg-blue-500 transition-all duration-300"
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                    </div>

                    {/* Quick Summaries */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-[#111827]">
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                          Recent Projects ({projects.slice(0, 3).length})
                        </h4>
                        {projects.length === 0 ? (
                          <p className="text-slate-400 dark:text-slate-500 italic">No assigned projects</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {projects.slice(0, 3).map((p) => (
                              <li key={p._id} className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                                <span className="truncate pr-2 font-medium">{p.name}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getStatusBadge(p.status)}`}>
                                  {p.status}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 bg-white dark:bg-[#111827]">
                        <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-2">
                          Pending Tasks ({tasks.filter((t) => t.status !== 'Completed').slice(0, 3).length})
                        </h4>
                        {tasks.filter((t) => t.status !== 'Completed').length === 0 ? (
                          <p className="text-slate-400 dark:text-slate-500 italic">All tasks completed 🎉</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {tasks
                              .filter((t) => t.status !== 'Completed')
                              .slice(0, 3)
                              .map((t) => (
                                <li key={t._id} className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                                  <span className="truncate pr-2 font-medium">{t.title}</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${getPriorityBadge(t.priority)}`}>
                                    {t.priority}
                                  </span>
                                </li>
                              ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. PROJECTS TAB */}
                {activeTab === 'projects' && (
                  <div>
                    {projects.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                        This member is not assigned to any projects in this organisation yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {projects.map((proj) => (
                          <div
                            key={proj._id}
                            className="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B] hover:border-blue-400 dark:hover:border-blue-500 transition-colors"
                          >
                            <div className="min-w-0 flex-1 pr-3">
                              <Link
                                to={`/projects/${proj._id}`}
                                onClick={onClose}
                                className="font-semibold text-xs text-slate-900 dark:text-slate-100 hover:text-blue-600 dark:hover:text-blue-400 hover:underline flex items-center gap-1.5"
                              >
                                <span className="truncate">{proj.name}</span>
                                <span className="text-slate-400">→</span>
                              </Link>
                              {proj.description && (
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                  {proj.description}
                                </p>
                              )}
                              {proj.deadline && (
                                <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                                  Deadline: {new Date(proj.deadline).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <span
                              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getStatusBadge(
                                proj.status
                              )}`}
                            >
                              {proj.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. TASKS TAB */}
                {activeTab === 'tasks' && (
                  <div>
                    {tasks.length === 0 ? (
                      <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                        This member has no assigned tasks in this organisation.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {tasks.map((task) => {
                          const overdue = isTaskOverdue(task);
                          return (
                            <div
                              key={task._id}
                              className={`p-3 rounded-xl border transition-colors ${
                                overdue
                                  ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/10'
                                  : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1E293B]'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-xs text-slate-900 dark:text-slate-100">
                                      {task.title}
                                    </span>
                                    {task.projectId?.name && (
                                      <span className="rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-1.5 py-0.5 text-[10px] font-medium">
                                        📁 {task.projectId.name}
                                      </span>
                                    )}
                                  </div>
                                  {task.dueDate && (
                                    <p
                                      className={`text-[10px] mt-1 font-medium ${
                                        overdue
                                          ? 'text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1'
                                          : 'text-slate-400 dark:text-slate-500'
                                      }`}
                                    >
                                      {overdue && <span>⚠️ Overdue:</span>}
                                      <span>Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span
                                    className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${getPriorityBadge(
                                      task.priority
                                    )}`}
                                  >
                                    {task.priority}
                                  </span>
                                  <span
                                    className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${getStatusBadge(
                                      task.status
                                    )}`}
                                  >
                                    {task.status}
                                  </span>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Modal Footer */}
          <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary text-xs py-2 px-4 rounded-lg cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MemberProfileModal;
