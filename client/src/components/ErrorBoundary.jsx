import React from 'react';

/**
 * ErrorBoundary wraps component trees (such as tab panels) to catch rendering errors,
 * display a friendly minimal fallback, and provide a "Reload panel" recovery action.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      resetKey: 0
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error
    };
  }

  componentDidCatch(error, errorInfo) {
    // Preserve documentation and audit logging of uncaught exceptions
    console.error('ErrorBoundary caught rendering error:', error, errorInfo);
  }

  handleReload = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      resetKey: prev.resetKey + 1
    }));
  };

  render() {
    if (this.state.hasError) {
      const panelName = this.props.panelName || 'Panel';
      const errorMessage = this.state.error?.message || 'An unexpected rendering error occurred.';

      return (
        <div
          data-testid="error-boundary-fallback"
          className="rounded-lg border border-slate-200 bg-white p-6 sm:p-8 text-center space-y-4 max-w-xl mx-auto my-8"
        >
          <div className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-rose-50 text-rose-600 border border-rose-200 mb-1">
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900 font-sans">
              Something went wrong in the {panelName} panel
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              The {panelName} tab encountered an unhandled exception. Click below to reload and restore this panel.
            </p>
          </div>

          <div className="bg-slate-50 p-3 rounded-md border border-slate-200 text-left font-mono text-xs text-rose-800 break-words max-h-32 overflow-y-auto">
            {errorMessage}
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md text-xs font-mono font-medium uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Reload panel</span>
            </button>
          </div>
        </div>
      );
    }

    return (
      <React.Fragment key={this.state.resetKey}>
        {this.props.children}
      </React.Fragment>
    );
  }
}
