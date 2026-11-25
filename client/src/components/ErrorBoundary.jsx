import React from 'react';
import { Link } from 'react-router-dom';

/**
 * ErrorBoundary Component
 * ───────────────────────
 * Prevents uncaught runtime JavaScript/React errors from crashing the entire app
 * or causing a blank white screen.
 *
 * Catches errors, displays a graceful recovery interface with "Try Again" and
 * "Go to Dashboard" actions, and preserves application navigation.
 */
class ErrorBoundaryInner extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught runtime error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  componentDidUpdate(prevProps) {
    // Automatically reset error when user navigates to a different route
    if (this.state.hasError && prevProps.locationKey !== this.props.locationKey) {
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50vh] flex-col items-center justify-center p-6 text-center">
          <div className="w-full max-w-md rounded-2xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-[#111827] p-6 shadow-sm transition-colors">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 mb-4">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">An unexpected error occurred</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              The application encountered a problem in this view. Your session and data are safe.
            </p>

            {this.state.error?.message && (
              <div className="mt-3 rounded-xl bg-slate-50 dark:bg-slate-900 p-2.5 text-left font-mono text-[11px] text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-800 break-words max-h-24 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}

            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={this.handleReset}
                className="btn-primary text-xs py-2 px-4 cursor-pointer"
              >
                Try Again
              </button>
              <Link
                to="/dashboard"
                onClick={this.handleReset}
                className="btn-secondary text-xs py-2 px-4"
              >
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundaryInner;
