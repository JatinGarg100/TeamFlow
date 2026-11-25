import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * ProtectedRoute
 * --------------
 * Guards private SaaS application routes against unauthenticated access.
 * 
 * Rules:
 * 1. While AuthContext is validating the session with the backend (loading === true),
 *    renders a centered brand loader to prevent premature redirects to /login.
 * 2. If unauthenticated (!isAuthenticated), redirects to /login and saves the
 *    attempted destination in React Router location state.
 * 3. If authenticated, renders the protected route hierarchy via Outlet (or children).
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-[#0B1120] transition-colors">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-3 border-blue-600 dark:border-blue-500 border-t-transparent" />
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Verifying session...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children ? children : <Outlet />;
}

export default ProtectedRoute;
