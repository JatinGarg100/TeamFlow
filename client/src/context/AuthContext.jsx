import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentUser, logoutUser, getStoredAuth, setStoredAuth, clearStoredAuth } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [organisation, setOrganisation] = useState(null);
  const [membership, setMembership] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const stored = getStoredAuth();
        if (stored?.user) {
          setUser(stored.user);
          setOrganisation(stored.organisation || null);
          setMembership(stored.membership || null);
        }

        // Validate session with backend /api/auth/me (HttpOnly cookie check)
        const meData = await getCurrentUser();
        if (meData?.user) {
          setUser(meData.user);
          setOrganisation(meData.organisation || null);
          setMembership(meData.membership || null);
          setStoredAuth({
            user: meData.user,
            organisation: meData.organisation,
            membership: meData.membership,
            token: stored?.token,
          });
        }
      } catch (err) {
        // If server says 401, clear stored state
        clearStoredAuth();
        setUser(null);
        setOrganisation(null);
        setMembership(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = (authData) => {
    setUser(authData.user);
    setOrganisation(authData.organisation);
    setMembership(authData.membership || null);
    setStoredAuth(authData);
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch (e) {
      // Ignore network errors on logout
    } finally {
      clearStoredAuth();
      setUser(null);
      setOrganisation(null);
      setMembership(null);
    }
  };

  const value = {
    user,
    organisation,
    membership,
    isAuthenticated: !!user,
    loading,
    login,
    logout,
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
