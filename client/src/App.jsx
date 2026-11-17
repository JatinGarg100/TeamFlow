import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import MyTasks from './pages/MyTasks';
import Employees from './pages/Employees';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import Plans from './pages/Plans';

function App() {
  return (
    <Routes>
      {/* Auth entry routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* Main SaaS Shell */}
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/my-tasks" element={<MyTasks />} />
        <Route path="/employees" element={<Employees />} />
        <Route path="/projects" element={<Projects />} />
        <Route path="/projects/:projectId" element={<ProjectDetails />} />
        <Route path="/plans" element={<Plans />} />
      </Route>

      {/* Root opens dashboard directly */}
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
