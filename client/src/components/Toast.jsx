import React from 'react';
import { useApp } from '../context/AppContext.jsx';

/**
 * Hand-written, accessible Toast notification component.
 * Displays error and status messages with role="status" and dismiss controls in minimal styling.
 */
export default function Toast() {
  const { toasts, removeToast } = useApp();

  if (!toasts || toasts.length === 0) {
    return null;
  }

  return (
    <div
      data-testid="toast-container"
      className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none px-4 sm:px-0"
    >
      {toasts.map((toast) => {
        const isError = toast.type === 'error' || !toast.type;
        const isSuccess = toast.type === 'success';
        const isWarning = toast.type === 'warning';

        let borderClass = 'border-rose-200 bg-white text-rose-900';
        let iconColor = 'text-rose-600';
        let icon = '⚠️';

        if (isSuccess) {
          borderClass = 'border-emerald-200 bg-white text-emerald-900';
          iconColor = 'text-emerald-600';
          icon = '✓';
        } else if (isWarning) {
          borderClass = 'border-amber-200 bg-white text-amber-900';
          iconColor = 'text-amber-600';
          icon = '⚠️';
        }

        return (
          <div
            key={toast.id}
            role="status"
            aria-live="polite"
            data-testid="toast-item"
            className={`pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg border shadow-sm text-xs font-mono transition-colors ${borderClass}`}
          >
            <span className={`text-sm shrink-0 select-none ${iconColor}`}>{icon}</span>

            <div className="flex-1 min-w-0 pr-1">
              <p className="leading-relaxed break-words font-medium">
                {toast.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              aria-label="Dismiss notification"
              className="shrink-0 p-1 rounded-md text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        );
      })}
    </div>
  );
}
