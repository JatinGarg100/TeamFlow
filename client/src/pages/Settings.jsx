import { useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  fetchOrganisationApi,
  updateOrganisationApi,
  fetchOrgMembers,
  updateMemberRoleApi,
  removeOrgMemberApi,
  uploadAvatarApi,
  updateUserProfileApi,
} from '../services/api';

/**
 * Settings Page — Premium SaaS Mixed Theme
 * ─────────────────────────────────────────
 * Comprehensive organisation administration:
 * - View workspace profile, subscription tier, and owner info
 * - Edit organisation name (Owners and Admins)
 * - Workspace members & role administration with last-owner protection
 * - Multi-organisation switcher with zero-leakage context updates
 */
function Settings() {
  const { theme, setTheme } = useTheme();
  const {
    organisation,
    activeOrgId,
    organisations,
    isOwner,
    isAdmin,
    user,
    reloadUser,
    switchOrganisation,
    updateActiveOrganisationProfile,
  } = useAuth();

  // Personal profile state
  const [userName, setUserName] = useState(user?.name || '');
  const [userAvatar, setUserAvatar] = useState(user?.avatar || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState('');
  const [profileError, setProfileError] = useState('');
  const avatarInputRef = useRef(null);

  useEffect(() => {
    if (user?.name) setUserName(user.name);
    if (user?.avatar) setUserAvatar(user.avatar);
  }, [user]);

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      setProfileError('Image file must be under 3 MB.');
      return;
    }

    setProfileError('');
    setProfileSuccess('');
    setUploadingAvatar(true);
    try {
      const res = await uploadAvatarApi(file);
      setUserAvatar(res.avatar);
      setProfileSuccess('Profile picture updated successfully!');
      if (typeof reloadUser === 'function') {
        await reloadUser();
      }
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (err) {
      setProfileError(err.message || 'Failed to upload profile picture.');
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) {
        avatarInputRef.current.value = '';
      }
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!userName.trim() || userName.trim().length < 2) {
      setProfileError('Name must be at least 2 characters.');
      return;
    }
    setProfileError('');
    setProfileSuccess('');
    setSavingProfile(true);
    try {
      await updateUserProfileApi({ name: userName.trim() });
      setProfileSuccess('Personal profile updated successfully!');
      if (typeof reloadUser === 'function') {
        await reloadUser();
      }
      setTimeout(() => setProfileSuccess(''), 4000);
    } catch (err) {
      setProfileError(err.message || 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const [orgDetails, setOrgDetails] = useState(null);
  const [loadingOrg, setLoadingOrg] = useState(true);
  const [orgName, setOrgName] = useState('');
  const [savingOrg, setSavingOrg] = useState(false);
  const [orgError, setOrgError] = useState('');
  const [orgSuccess, setOrgSuccess] = useState('');

  // Members list in settings
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [updatingRoleId, setUpdatingRoleId] = useState(null);
  const [memberToRemove, setMemberToRemove] = useState(null);
  const [removingMember, setRemovingMember] = useState(false);
  const [memberActionError, setMemberActionError] = useState('');
  const [memberActionSuccess, setMemberActionSuccess] = useState('');

  const currentUserId = user?.id || user?._id;

  const loadOrgData = useCallback(async () => {
    if (!activeOrgId) return;
    setLoadingOrg(true);
    setOrgError('');
    try {
      const data = await fetchOrganisationApi(activeOrgId);
      setOrgDetails(data);
      setOrgName(data.name || '');
    } catch (err) {
      setOrgError(err.message || 'Failed to load organisation settings.');
    } finally {
      setLoadingOrg(false);
    }
  }, [activeOrgId]);

  const loadMembersData = useCallback(async () => {
    if (!activeOrgId) return;
    setLoadingMembers(true);
    try {
      const res = await fetchOrgMembers(activeOrgId, { limit: 100 });
      setMembers(res.members || []);
    } catch (err) {
      console.error('Failed to load members in settings:', err);
    } finally {
      setLoadingMembers(false);
    }
  }, [activeOrgId]);

  useEffect(() => {
    loadOrgData();
    loadMembersData();
  }, [loadOrgData, loadMembersData]);

  // Handle Save Organisation Name
  const handleSaveOrgName = async (e) => {
    e.preventDefault();
    setOrgError('');
    setOrgSuccess('');

    if (!orgName.trim() || orgName.trim().length < 2) {
      setOrgError('Organisation name must be at least 2 characters.');
      return;
    }

    setSavingOrg(true);
    try {
      const updated = await updateOrganisationApi(activeOrgId, { name: orgName.trim() });
      setOrgSuccess('Organisation details saved successfully.');
      updateActiveOrganisationProfile(updated);
      await loadOrgData();
      setTimeout(() => setOrgSuccess(''), 4000);
    } catch (err) {
      setOrgError(err.message || 'Failed to update organisation.');
    } finally {
      setSavingOrg(false);
    }
  };

  // Handle Change Member Role
  const handleRoleChange = async (memberId, newRole, memberName) => {
    setMemberActionError('');
    setMemberActionSuccess('');
    try {
      setUpdatingRoleId(memberId);
      await updateMemberRoleApi(activeOrgId, memberId, newRole);
      setMemberActionSuccess(`Role for ${memberName} was updated to ${newRole}.`);
      setMembers((prev) =>
        prev.map((m) => ((m.id || m.userId) === memberId ? { ...m, role: newRole } : m))
      );
      setTimeout(() => setMemberActionSuccess(''), 4000);
    } catch (err) {
      setMemberActionError(err.message || 'Failed to change role.');
    } finally {
      setUpdatingRoleId(null);
    }
  };

  // Handle Confirm Member Removal
  const handleConfirmRemove = async () => {
    if (!memberToRemove || !activeOrgId) return;

    setRemovingMember(true);
    setMemberActionError('');
    try {
      const targetId = memberToRemove.id || memberToRemove.userId;
      const res = await removeOrgMemberApi(activeOrgId, targetId);
      setMemberActionSuccess(res.message || `Member was removed from organisation.`);
      setMemberToRemove(null);
      await loadMembersData();
      setTimeout(() => setMemberActionSuccess(''), 4000);
    } catch (err) {
      setMemberActionError(err.message || 'Failed to remove member.');
    } finally {
      setRemovingMember(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-12">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">
          Organisation Settings
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Manage company profile, access permissions, subscription tiers, and appearance.
        </p>
      </div>

      {/* ── Section: Appearance & Theme ── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-xs transition-colors">
        <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Appearance &amp; Theme</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Customize the look and feel of TeamFlow across your device. Preferences persist across browser sessions.
          </p>
        </div>

        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Light Mode Option */}
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-all cursor-pointer ${
              theme === 'light'
                ? 'border-blue-600 bg-blue-50/40 dark:bg-blue-950/20 ring-2 ring-blue-600/20 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 border border-amber-200">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Light Mode</h3>
                {theme === 'light' && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                    ✓
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Crisp soft-grey surfaces with Dark Navy navigation and high-contrast typography.
              </p>
            </div>
          </button>

          {/* Dark Mode Option */}
          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-all cursor-pointer ${
              theme === 'dark'
                ? 'border-blue-500 bg-blue-950/20 dark:bg-blue-950/40 ring-2 ring-blue-500/20 shadow-xs'
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-blue-400 border border-slate-700">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"
                />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Dark Mode</h3>
                {theme === 'dark' && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white text-xs font-bold">
                    ✓
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Deep navy backgrounds with reduced eye strain, premium cards, and luminous accents.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* ── Section 1: Personal Account Profile ── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-xs transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Personal Profile</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Manage your profile picture, display name, and credentials</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-300 capitalize self-start sm:self-auto">
            {user?.authProvider === 'google' ? 'Google Account' : 'Standard Account'}
          </span>
        </div>

        {profileError && (
          <div className="mt-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 p-3 text-xs text-red-700 dark:text-red-300">
            {profileError}
          </div>
        )}
        {profileSuccess && (
          <div className="mt-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/50 p-3 text-xs text-emerald-700 dark:text-emerald-300">
            {profileSuccess}
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="mt-5 space-y-5">
          {/* Avatar Picture Row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/70 border border-blue-200/50 dark:border-blue-800 text-xl font-bold text-blue-600 dark:text-blue-400 overflow-hidden shadow-xs">
              {userAvatar ? (
                <img src={userAvatar} alt={userName} className="h-full w-full object-cover" />
              ) : (
                <span>{userName ? userName.charAt(0).toUpperCase() : 'U'}</span>
              )}
            </div>

            <div className="space-y-1">
              <input
                type="file"
                ref={avatarInputRef}
                onChange={handleAvatarUpload}
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
              />
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={() => avatarInputRef.current?.click()}
                  className="btn-secondary text-xs py-1.5 px-3 rounded-lg cursor-pointer"
                >
                  {uploadingAvatar ? 'Uploading Image...' : 'Upload New Picture'}
                </button>
                {userAvatar && (
                  <button
                    type="button"
                    onClick={async () => {
                      setUserAvatar('');
                      await updateUserProfileApi({ avatar: '' });
                      if (typeof reloadUser === 'function') await reloadUser();
                    }}
                    className="text-xs text-red-600 dark:text-red-400 hover:underline cursor-pointer"
                  >
                    Remove Photo
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                Supports PNG, JPG, or WEBP under 3MB. Displayed across projects, task assignments, and member directories.
              </p>
            </div>
          </div>

          {/* Name & Email Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="input-field text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 px-3.5 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 outline-none cursor-not-allowed"
              />
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                Email is tied to your account login and organisation invites.
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingProfile || userName === user?.name}
              className="btn-primary text-xs py-2 px-4 shadow-sm"
            >
              {savingProfile ? 'Saving Changes...' : 'Save Profile Details'}
            </button>
          </div>
        </form>
      </div>

      {/* ── Section 2: Organisation Profile & Name ── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-xs transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Workspace Profile</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">General information and company identity</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200/50 dark:border-blue-800 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:text-blue-300 capitalize self-start sm:self-auto">
            {organisation?.plan || 'Free'} Plan
          </span>
        </div>

        {orgError && (
          <div className="mt-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 p-3 text-xs text-red-700 dark:text-red-300">
            {orgError}
          </div>
        )}
        {orgSuccess && (
          <div className="mt-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/50 p-3 text-xs text-emerald-700 dark:text-emerald-300">
            {orgSuccess}
          </div>
        )}

        {loadingOrg ? (
          <div className="py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-blue-600 dark:border-blue-500 border-t-transparent mb-1" />
            <p>Loading workspace details...</p>
          </div>
        ) : (
          <form onSubmit={handleSaveOrgName} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Organisation Name
                </label>
                <input
                  type="text"
                  disabled={!isAdmin}
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="input-field text-sm"
                />
                {!isAdmin && (
                  <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                    Only owners and admins can update the organisation name.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Workspace Slug (URL Identifier)
                </label>
                <input
                  type="text"
                  disabled
                  value={orgDetails?.slug || ''}
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-xs font-mono text-slate-500 dark:text-slate-400 outline-none cursor-not-allowed"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-xs">
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/50 p-3">
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">Owner</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100 truncate mt-0.5">
                  {orgDetails?.owner?.name || 'Administrator'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/50 p-3">
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">Active Members</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {orgDetails?.memberCount || members.length}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/50 p-3">
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">Total Projects</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {orgDetails?.projectCount ?? 0}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/50 p-3">
                <p className="text-slate-500 dark:text-slate-400 text-[11px]">Created Date</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                  {orgDetails?.createdAt ? new Date(orgDetails.createdAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>

            {isAdmin && (
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingOrg || orgName === orgDetails?.name}
                  className="btn-primary text-xs py-2 px-4 rounded-lg cursor-pointer disabled:opacity-50"
                >
                  {savingOrg ? 'Saving changes...' : 'Save Profile Changes'}
                </button>
              </div>
            )}
          </form>
        )}
      </div>

      {/* ── Section 2: Multi-Organisation Switcher ── */}
      {organisations.length > 1 && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] p-6 shadow-xs transition-colors">
          <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Your Workspaces</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              You belong to multiple organisations. Switch the active workspace to view its projects and tasks.
            </p>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            {organisations.map((org) => {
              const orgIdentifier = org.id || org._id;
              const isCurrent = orgIdentifier?.toString() === activeOrgId?.toString();

              return (
                <div
                  key={orgIdentifier}
                  className={`rounded-xl border p-4 transition-all flex items-center justify-between ${
                    isCurrent
                      ? 'border-blue-600 dark:border-blue-500 bg-blue-50/30 dark:bg-blue-950/30 shadow-xs'
                      : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{org.name}</span>
                      {isCurrent && (
                        <span className="rounded-full bg-blue-600 text-white px-2 py-0.2 text-[10px] font-bold">
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 capitalize">
                      Your Role: <strong>{org.role || 'Member'}</strong> • Plan: {org.plan || 'Free'}
                    </p>
                  </div>

                  {!isCurrent && (
                    <button
                      type="button"
                      onClick={() => {
                        switchOrganisation(orgIdentifier);
                      }}
                      className="btn-secondary text-xs py-1.5 px-3 rounded-lg cursor-pointer"
                    >
                      Switch
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Section 3: Members & Roles Management ── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] shadow-xs overflow-hidden transition-colors">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Team Members &amp; Role Management</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Configure access roles, permissions, and remove inactive members
            </p>
          </div>
          <Link
            to="/employees"
            className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline"
          >
            Go to Full Directory &amp; Invitations →
          </Link>
        </div>

        {memberActionError && (
          <div className="mx-6 mt-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/50 p-3 text-xs text-red-700 dark:text-red-300">
            {memberActionError}
          </div>
        )}
        {memberActionSuccess && (
          <div className="mx-6 mt-4 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50 dark:bg-emerald-950/50 p-3 text-xs text-emerald-700 dark:text-emerald-300">
            {memberActionSuccess}
          </div>
        )}

        {loadingMembers ? (
          <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400">
            <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-blue-600 dark:border-blue-500 border-t-transparent mb-1" />
            <p>Loading members...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/70 dark:bg-slate-800/50 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Member Name</th>
                  <th className="px-6 py-3.5">Email</th>
                  <th className="px-6 py-3.5">Assigned Role</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {members.map((m) => {
                  const mUserId = (m.userId || m.id)?.toString();
                  const isSelf = mUserId === currentUserId?.toString();
                  const isMemberOwner = m.role === 'owner';
                  const canEditRole = isAdmin && !isMemberOwner && !isSelf && (isOwner || m.role !== 'admin');
                  const canRemove = isAdmin && !isMemberOwner && !isSelf && (isOwner || m.role !== 'admin');

                  return (
                    <tr key={m.id || m.userId} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-900 dark:text-slate-100 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{m.name}</span>
                          {isSelf && (
                            <span className="rounded-md bg-blue-50 dark:bg-blue-900/60 border border-blue-200/50 dark:border-blue-800 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300">
                              You
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {m.email}
                      </td>
                      <td className="px-6 py-4 text-xs whitespace-nowrap">
                        {canEditRole ? (
                          <select
                            value={m.role}
                            disabled={updatingRoleId === (m.id || m.userId)}
                            onChange={(e) =>
                              handleRoleChange(m.id || m.userId, e.target.value, m.name)
                            }
                            className="text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1E293B] px-2.5 py-1 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-600 dark:focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:focus:ring-blue-950/50 disabled:opacity-50 cursor-pointer"
                          >
                            {isOwner && <option value="admin">Admin</option>}
                            <option value="manager">Manager</option>
                            <option value="member">Member</option>
                          </select>
                        ) : (
                          <span className="capitalize font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md text-[11px]">
                            {m.role || 'Member'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {isMemberOwner ? (
                          <span className="text-xs text-slate-400 dark:text-slate-500 italic font-medium">Owner</span>
                        ) : isSelf ? (
                          <span className="text-xs text-slate-400 dark:text-slate-500 italic">You</span>
                        ) : canRemove ? (
                          <button
                            type="button"
                            onClick={() => {
                              setMemberActionError('');
                              setMemberToRemove(m);
                            }}
                            className="btn-danger text-xs py-1 px-2.5"
                          >
                            Remove
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Remove Member Confirmation Modal ── */}
      {memberToRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-black/75 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-red-100 dark:border-slate-700 bg-white dark:bg-[#1E293B] p-6 shadow-xl animate-in fade-in zoom-in-95 duration-100">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 mb-3">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Confirm Member Removal</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Are you sure you want to remove <strong className="font-semibold text-slate-800 dark:text-slate-200">{memberToRemove.name}</strong> from this workspace?
            </p>

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
    </div>
  );
}

export default Settings;
