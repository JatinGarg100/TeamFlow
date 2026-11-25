import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import ErrorBoundary from './ErrorBoundary';

/**
 * Layout Component
 * ────────────────
 * Master SaaS application shell:
 * - Left: Dark Navy Sidebar (fixed desktop, drawer mobile)
 * - Center/Right: Clean Navbar + Soft Grey (#F8FAFC) main content viewport
 * - Error Boundary: Guards main viewports against unhandled rendering errors
 */
function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-screen bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-900 dark:text-slate-100 overflow-hidden font-sans transition-colors duration-150">
      {/* Dark Navy Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">
            <ErrorBoundary locationKey={location.pathname}>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}

export default Layout;
