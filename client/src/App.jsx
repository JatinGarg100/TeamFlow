import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import AcceptInvitation from './pages/AcceptInvitation';
import Dashboard from './pages/Dashboard';
import MyTasks from './pages/MyTasks';
import Employees from './pages/Employees';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import Plans from './pages/Plans';
import Settings from './pages/Settings';
import Calendar from './pages/Calendar';

function App() {
  const location = useLocation();

  return (
    <ErrorBoundary locationKey={location.pathname}>
      <Routes>
        {/* 1. Public Landing Page */}
        <Route path="/" element={<Landing />} />

        {/* 2. Public auth entry routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/invite/:token" element={<AcceptInvitation />} />

        {/* 3. Protected SaaS Shell & Application Routes */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/my-tasks" element={<MyTasks />} />
          <Route path="/calendar" element={<Calendar />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId" element={<ProjectDetails />} />
          <Route path="/plans" element={<Plans />} />
          <Route path="/settings" element={<Settings />} />
        </Route>

        {/* 4. Catch-all redirect to /dashboard (guarded by ProtectedRoute) */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}

export default App;
