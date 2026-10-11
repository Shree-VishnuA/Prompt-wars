import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext.jsx';
import * as api from '../api/client.js';

let gsiScriptLoadedPromise = null;

/**
 * Dynamically loads Google Identity Services script once.
 */
function loadGsiScript() {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.google?.accounts?.id) return Promise.resolve(true);

  if (!gsiScriptLoadedPromise) {
    gsiScriptLoadedPromise = new Promise((resolve) => {
      const existing = document.querySelector(
        'script[src="https://accounts.google.com/gsi/client"]'
      );
      if (existing) {
        if (window.google?.accounts?.id) {
          resolve(true);
        } else {
          existing.addEventListener('load', () => resolve(Boolean(window.google?.accounts?.id)));
          existing.addEventListener('error', () => resolve(false));
        }
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(Boolean(window.google?.accounts?.id));
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  return gsiScriptLoadedPromise;
}

export default function AuthButton() {
  const { user, auth, refreshUser, refreshAccount } = useApp();
  const googleBtnContainerRef = useRef(null);
  const [signingOut, setSigningOut] = useState(false);

  const googleClientId =
    typeof import.meta !== 'undefined' && import.meta.env
      ? import.meta.env.VITE_GOOGLE_CLIENT_ID
      : undefined;

  const isGoogleEnabled =
    Boolean(googleClientId) && auth?.google_enabled !== false;

  const isGoogleUser = user?.kind === 'google';

  // Handle Google Sign-in initialization & button render
  useEffect(() => {
    let isMounted = true;

    if (!isGoogleEnabled || isGoogleUser || !googleBtnContainerRef.current) {
      return;
    }

    loadGsiScript().then((loaded) => {
      if (!isMounted || !loaded || !window.google?.accounts?.id) return;

      try {
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: async (response) => {
            if (response?.credential) {
              const res = await api.authGoogle(response.credential);
              if (res.ok) {
                if (refreshUser) await refreshUser();
                if (refreshAccount) await refreshAccount();
              }
            }
          }
        });

        if (googleBtnContainerRef.current) {
          googleBtnContainerRef.current.innerHTML = '';
          window.google.accounts.id.renderButton(googleBtnContainerRef.current, {
            theme: 'filled_black',
            size: 'medium',
            shape: 'pill'
          });
        }
      } catch {
        // Fallback gracefully if initialization fails
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isGoogleEnabled, isGoogleUser, googleClientId, refreshUser, refreshAccount]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await api.authLogout();
      // Establish clean guest session
      await api.authGuest();
      if (refreshUser) await refreshUser();
      if (refreshAccount) await refreshAccount();
    } finally {
      setSigningOut(false);
    }
  };

  // Case 1: Signed-in with Google
  if (isGoogleUser) {
    return (
      <div className="flex items-center gap-2.5 bg-slate-900/80 border border-slate-800 rounded-full py-1 pl-1.5 pr-3 shadow-sm">
        {user.picture ? (
          <img
            src={user.picture}
            alt={user.name || 'User avatar'}
            className="w-5 h-5 rounded-full border border-slate-700 object-cover shrink-0"
          />
        ) : (
          <div className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
            {(user.name || user.email || 'G')[0]}
          </div>
        )}

        <span className="text-xs text-slate-200 font-medium truncate max-w-[120px]">
          {user.name || user.email || 'Google User'}
        </span>

        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          aria-label="Sign out of Google session"
          className="text-[11px] font-mono text-slate-400 hover:text-rose-300 transition-colors ml-1 border-l border-slate-800 pl-2"
        >
          {signingOut ? 'Signing out...' : 'Sign out'}
        </button>
      </div>
    );
  }

  // Case 2: Missing VITE_GOOGLE_CLIENT_ID or Google Auth disabled -> render only Guest badge
  if (!isGoogleEnabled) {
    return (
      <div
        data-testid="guest-badge"
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono bg-slate-900/80 border border-slate-800 text-slate-300 shadow-sm"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
        <span>Guest session</span>
      </div>
    );
  }

  // Case 3: Google enabled but not signed in -> render Google gsi button container
  return (
    <div className="flex items-center gap-2">
      <div
        ref={googleBtnContainerRef}
        data-testid="google-signin-btn"
        className="min-h-[32px] flex items-center"
      />
    </div>
  );
}
