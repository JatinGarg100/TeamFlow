import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser, logoutUser, googleLoginApi, getStoredAuth, setStoredAuth, clearStoredAuth } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [organisation, setOrganisation] = useState(null);
  const [membership, setMembership] = useState(null);
  const [organisations, setOrganisations] = useState([]);
  const [loading, setLoading] = useState(true);

  // Helper to resolve preferred organisation from list
  const resolveActiveOrg = (orgList, preferredOrgId, fallbackOrg) => {
    if (!Array.isArray(orgList) || orgList.length === 0) {
      return fallbackOrg || null;
    }
    if (preferredOrgId) {
      const match = orgList.find(
        (o) => (o.id || o._id)?.toString() === preferredOrgId.toString()
      );
      if (match) return match;
    }
    return orgList[0] || fallbackOrg || null;
  };

  // Restore & verify session on mount
  useEffect(() => {
    let isMounted = true;

    const initializeAuth = async () => {
      try {
        const savedOrgId = localStorage.getItem('teamflow_active_org_id');

        // Strictly validate session with backend /api/auth/me (HttpOnly cookie check)
        const meData = await getCurrentUser();
        if (!isMounted) return;

        if (meData?.user) {
          const orgList = Array.isArray(meData.organisations) ? meData.organisations : [];
          const preferredOrgId = savedOrgId || meData.organisation?.id || meData.organisation?._id;
          const restoredOrg = resolveActiveOrg(orgList, preferredOrgId, meData.organisation);

          const restoredMembership =
            (restoredOrg?.role ? { role: restoredOrg.role } : null) ||
            meData.membership ||
            null;

          setUser(meData.user);
          setOrganisation(restoredOrg);
          setMembership(restoredMembership);
          setOrganisations(orgList);

          if (restoredOrg?.id || restoredOrg?._id) {
            localStorage.setItem('teamflow_active_org_id', restoredOrg.id || restoredOrg._id);
          }

          const existingStored = getStoredAuth();
          setStoredAuth({
            user: meData.user,
            organisation: restoredOrg,
            membership: restoredMembership,
            organisations: orgList,
            token: existingStored?.token,
          });
        } else {
          throw new Error('Unauthenticated session');
        }
      } catch {
        if (!isMounted) return;
        // If server says 401 or invalid session, clear state and avoid stale authentication
        clearStoredAuth();
        localStorage.removeItem('teamflow_active_org_id');
        setUser(null);
        setOrganisation(null);
        setMembership(null);
        setOrganisations([]);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = (authData) => {
    const orgList = Array.isArray(authData.organisations)
      ? authData.organisations
      : authData.organisation
      ? [authData.organisation]
      : [];

    setOrganisations(orgList);

    const savedOrgId = localStorage.getItem('teamflow_active_org_id');
    const activeOrg = resolveActiveOrg(orgList, savedOrgId, authData.organisation);
    const activeMembership =
      authData.membership ||
      (activeOrg?.role ? { role: activeOrg.role } : null);

    setUser(authData.user);
    setOrganisation(activeOrg);
    setMembership(activeMembership);

    if (activeOrg?.id || activeOrg?._id) {
      localStorage.setItem('teamflow_active_org_id', activeOrg.id || activeOrg._id);
    }

    setStoredAuth({
      ...authData,
      organisation: activeOrg,
      membership: activeMembership,
      organisations: orgList,
    });
  };

  const loginWithGoogle = async ({ idToken, credential, organisationName }) => {
    const authData = await googleLoginApi({ idToken, credential, organisationName });
    login(authData);
    return authData;
  };

  const reloadUser = async () => {
    try {
      const meData = await getCurrentUser();
      if (meData?.user) {
        const orgList = Array.isArray(meData.organisations) ? meData.organisations : [];
        const savedOrgId = localStorage.getItem('teamflow_active_org_id');
        const activeOrg = resolveActiveOrg(orgList, savedOrgId, meData.organisation);
        setUser(meData.user);
        setOrganisation(activeOrg);
        setMembership(activeOrg?.role ? { role: activeOrg.role } : meData.membership || null);
        setOrganisations(orgList);
      }
    } catch (e) {
      console.error('Failed to reload user session:', e);
    }
  };

  const switchOrganisation = (targetOrgId) => {
    if (!targetOrgId) return;

    const target = organisations.find(
      (o) => (o.id || o._id)?.toString() === targetOrgId.toString()
    );

    if (target) {
      setOrganisation(target);
      const newMembership = { role: target.role };
      setMembership(newMembership);
      localStorage.setItem('teamflow_active_org_id', target.id || target._id);

      const stored = getStoredAuth() || {};
      setStoredAuth({
        ...stored,
        organisation: target,
        membership: newMembership,
        organisations,
      });

      return target;
    }
  };

  const updateActiveOrganisationProfile = (updatedDetails) => {
    setOrganisation((prev) => {
      const merged = { ...prev, ...updatedDetails };
      const stored = getStoredAuth() || {};
      setStoredAuth({
        ...stored,
        organisation: merged,
      });
      return merged;
    });

    setOrganisations((prev) =>
      prev.map((o) =>
        (o.id || o._id)?.toString() === (updatedDetails.id || updatedDetails._id || organisation?.id || organisation?._id)?.toString()
          ? { ...o, ...updatedDetails }
          : o
      )
    );
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch {
      // Ignore network errors on logout
    } finally {
      clearStoredAuth();
      localStorage.removeItem('teamflow_active_org_id');
      setUser(null);
      setOrganisation(null);
      setMembership(null);
      setOrganisations([]);
    }
  };

  const activeOrgId = organisation?.id || organisation?._id;
  const currentRole = membership?.role || organisation?.role || 'member';
  const isOwner = currentRole === 'owner';
  const isAdmin = currentRole === 'admin' || isOwner;
  const isManager = ['owner', 'admin', 'manager'].includes(currentRole);

  const value = {
    user,
    organisation,
    membership,
    organisations,
    activeOrgId,
    currentRole,
    isOwner,
    isAdmin,
    isManager,
    isAuthenticated: Boolean(!loading && user),
    loading,
    login,
    loginWithGoogle,
    reloadUser,
    logout,
    switchOrganisation,
    updateActiveOrganisationProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
