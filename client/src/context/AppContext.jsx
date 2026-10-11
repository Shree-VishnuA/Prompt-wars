import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import * as api from '../api/client.js';

export const ACTIONS = {
  SET_USER: 'SET_USER',
  SET_AUTH: 'SET_AUTH',
  SET_HEALTH: 'SET_HEALTH',
  SET_ACCOUNT: 'SET_ACCOUNT',
  SET_VERDICT: 'SET_VERDICT',
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  SET_HISTORY: 'SET_HISTORY',
  ADD_HISTORY: 'ADD_HISTORY',
  SET_ACTIVE_TAB: 'SET_ACTIVE_TAB',
  SET_DRAFT_INPUT: 'SET_DRAFT_INPUT',
  SET_SERVER_OFFLINE: 'SET_SERVER_OFFLINE',
  ADD_TOAST: 'ADD_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
  SET_THEME: 'SET_THEME'
};

export const initialState = {
  user: null,
  auth: null,
  health: null,
  account: null,
  verdict: null,
  loading: false,
  error: null,
  history: [],
  activeTab: 'Firewall',
  draftInput: null,
  serverOffline: false,
  toasts: [],
  theme: 'light'
};

export function createServiceDegradedVerdict(errorMsg = 'Service unavailable or network failure') {
  const reqId =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return {
    request_id: reqId,
    decision: 'BLOCKED',
    requires_confirmation: false,
    risk_level: 'CRITICAL',
    risk_score: 80,
    threat_category: 'SERVICE_DEGRADED',
    rationale: (errorMsg || 'Service unavailable. Request blocked for safety.').slice(0, 300),
    extracted_intent: null,
    trace: [
      {
        layer: 'validation',
        status: 'pass',
        summary: 'Client fail-closed defensive synthesis',
        findings: [],
        duration_ms: 0
      },
      {
        layer: 'policy',
        status: 'block',
        summary: 'Service degraded / Network failure. Fail-closed defense triggered.',
        findings: [String(errorMsg)],
        duration_ms: 0
      }
    ],
    policy_version: '1.0.0',
    degraded: true,
    simulated_result: null,
    intent_token: null,
    latency_ms: 0
  };
}

export function appReducer(state, action) {
  switch (action.type) {
    case ACTIONS.SET_USER:
      return { ...state, user: action.payload };

    case ACTIONS.SET_AUTH:
      return { ...state, auth: action.payload };

    case ACTIONS.SET_HEALTH:
      return { ...state, health: action.payload };

    case ACTIONS.SET_ACCOUNT:
      return { ...state, account: action.payload };

    case ACTIONS.SET_VERDICT: {
      const newVerdict = action.payload;
      if (!newVerdict) {
        return { ...state, verdict: null };
      }
      const timedVerdict = {
        ...newVerdict,
        timestamp: newVerdict.timestamp || Date.now()
      };
      // Prepend verdict into history, keeping the last 20 entries
      const updatedHistory = [
        timedVerdict,
        ...state.history.filter((h) => h.request_id !== timedVerdict.request_id)
      ].slice(0, 20);

      return {
        ...state,
        verdict: timedVerdict,
        history: updatedHistory
      };
    }

    case ACTIONS.SET_LOADING:
      return { ...state, loading: Boolean(action.payload) };

    case ACTIONS.SET_ERROR:
      return { ...state, error: action.payload };

    case ACTIONS.SET_HISTORY:
      return {
        ...state,
        history: Array.isArray(action.payload) ? action.payload.slice(0, 20) : []
      };

    case ACTIONS.ADD_HISTORY: {
      const item = action.payload;
      if (!item) return state;
      const updated = [
        item,
        ...state.history.filter((h) => h.request_id !== item.request_id)
      ].slice(0, 20);
      return {
        ...state,
        history: updated
      };
    }

    case ACTIONS.SET_ACTIVE_TAB: {
      const nextTab = action.payload || 'Firewall';
      if (typeof window !== 'undefined' && !(typeof process !== 'undefined' && process.env?.NODE_ENV === 'test')) {
        try {
          localStorage.setItem('bankism_active_tab', nextTab);
          const slug = nextTab.toLowerCase().replace(/\s+/g, '-');
          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', `#${slug}`);
          }
        } catch {
          // ignore
        }
      }
      return { ...state, activeTab: nextTab };
    }

    case ACTIONS.SET_DRAFT_INPUT:
      return { ...state, draftInput: action.payload };

    case ACTIONS.SET_SERVER_OFFLINE:
      return { ...state, serverOffline: Boolean(action.payload) };

    case ACTIONS.ADD_TOAST: {
      const newToast = action.payload;
      if (!newToast || !newToast.id) return state;
      return {
        ...state,
        toasts: [...state.toasts, newToast]
      };
    }

    case ACTIONS.REMOVE_TOAST:
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.payload)
      };

    case ACTIONS.SET_THEME: {
      const nextTheme = action.payload === 'dark' ? 'dark' : 'light';
      if (typeof window !== 'undefined' && !(typeof process !== 'undefined' && process.env?.NODE_ENV === 'test')) {
        try {
          localStorage.setItem('bankism_theme', nextTheme);
          if (nextTheme === 'dark') {
            document.documentElement.classList.add('dark');
            document.documentElement.setAttribute('data-theme', 'dark');
          } else {
            document.documentElement.classList.remove('dark');
            document.documentElement.setAttribute('data-theme', 'light');
          }
        } catch {
          // ignore
        }
      }
      return { ...state, theme: nextTheme };
    }

    default:
      return state;
  }
}

export const AppContext = createContext(null);

export function getInitialTheme() {
  if (typeof window === 'undefined') return 'light';
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return 'light';
  }
  try {
    const saved = localStorage.getItem('bankism_theme');
    if (saved === 'dark' || saved === 'light') return saved;
  } catch {
    // ignore
  }
  return 'light';
}

export function getSavedActiveTab(defaultTab = 'Firewall') {
  if (typeof window === 'undefined') return defaultTab;
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return defaultTab;
  }
  const VALID_TABS = ['Firewall', 'Replay Lab', 'Benchmark', 'Audit'];
  try {
    const hash = (window.location.hash || '').replace(/^#/, '').trim();
    if (hash) {
      const match = VALID_TABS.find(
        (t) =>
          t.toLowerCase().replace(/\s+/g, '-') === hash.toLowerCase() ||
          t.toLowerCase() === hash.toLowerCase()
      );
      if (match) return match;
    }
    const saved = localStorage.getItem('bankism_active_tab');
    if (saved) {
      const match = VALID_TABS.find(
        (t) =>
          t.toLowerCase().replace(/\s+/g, '-') === saved.toLowerCase().replace(/\s+/g, '-') ||
          t.toLowerCase() === saved.toLowerCase() ||
          t === saved
      );
      if (match) return match;
    }
  } catch {
    // ignore storage restrictions
  }
  return defaultTab;
}

export function AppProvider({ children, initialValue = {} }) {
  const resolvedTab =
    initialValue && initialValue.activeTab !== undefined
      ? initialValue.activeTab
      : getSavedActiveTab(initialState.activeTab);

  const resolvedTheme =
    initialValue && initialValue.theme !== undefined
      ? initialValue.theme
      : getInitialTheme();

  const [state, dispatch] = useReducer(appReducer, {
    ...initialState,
    ...initialValue,
    activeTab: resolvedTab,
    theme: resolvedTheme
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') return;
    try {
      if (state.theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.setAttribute('data-theme', 'light');
      }
    } catch {
      // ignore
    }
  }, [state.theme]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleHash = () => {
      const fromHash = getSavedActiveTab(state.activeTab);
      if (fromHash && fromHash !== state.activeTab) {
        dispatch({ type: ACTIONS.SET_ACTIVE_TAB, payload: fromHash });
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [state.activeTab]);

  const removeToast = useCallback((id) => {
    dispatch({ type: ACTIONS.REMOVE_TOAST, payload: id });
  }, []);

  const addToast = useCallback(
    (message, type = 'error', duration = 5000) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      let msg = message;
      if (typeof msg !== 'string') {
        msg = (msg && (msg.message || msg.error)) || 'An error occurred';
      }
      dispatch({
        type: ACTIONS.ADD_TOAST,
        payload: { id, message: msg, type }
      });
      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
      return id;
    },
    [removeToast]
  );

  const fetchHealth = useCallback(async () => {
    try {
      const res = await api.getHealth();
      if (res && res.ok && res.data) {
        dispatch({ type: ACTIONS.SET_HEALTH, payload: res.data });
        dispatch({ type: ACTIONS.SET_SERVER_OFFLINE, payload: false });
        return res.data;
      } else {
        dispatch({ type: ACTIONS.SET_SERVER_OFFLINE, payload: true });
        return null;
      }
    } catch {
      dispatch({ type: ACTIONS.SET_SERVER_OFFLINE, payload: true });
      return null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initUser() {
      try {
        const res = await api.authMe();
        if (isMounted && res.ok && res.data) {
          if (res.data.user) {
            dispatch({ type: ACTIONS.SET_USER, payload: res.data.user });
          }
          if (res.data.auth) {
            dispatch({ type: ACTIONS.SET_AUTH, payload: res.data.auth });
          }
        }
      } catch {
        // Handled silently
      }
    }

    async function initHealth() {
      if (isMounted) {
        await fetchHealth();
      }
    }

    async function fetchAccount() {
      try {
        const res = await api.getAccount();
        if (isMounted && res.ok && res.data) {
          dispatch({ type: ACTIONS.SET_ACCOUNT, payload: res.data });
        }
      } catch {
        // Handled silently
      }
    }

    initUser();
    initHealth();
    fetchAccount();

    const interval = setInterval(() => {
      if (isMounted) {
        fetchHealth();
      }
    }, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [fetchHealth]);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.authMe();
      if (res.ok && res.data) {
        if (res.data.user) dispatch({ type: ACTIONS.SET_USER, payload: res.data.user });
        if (res.data.auth) dispatch({ type: ACTIONS.SET_AUTH, payload: res.data.auth });
        return res.data;
      }
    } catch (err) {
      addToast(err.message || 'Failed to refresh user', 'error');
    }
    return null;
  }, [addToast]);

  const refreshAccount = useCallback(async () => {
    try {
      const res = await api.getAccount();
      if (res.ok && res.data) {
        dispatch({ type: ACTIONS.SET_ACCOUNT, payload: res.data });
        return res.data;
      }
    } catch (err) {
      addToast(err.message || 'Failed to refresh account', 'error');
    }
    return null;
  }, [addToast]);

  const value = {
    state,
    dispatch,
    user: state.user,
    auth: state.auth,
    health: state.health,
    account: state.account,
    verdict: state.verdict,
    loading: state.loading,
    error: state.error,
    history: state.history,
    activeTab: state.activeTab,
    draftInput: state.draftInput,
    serverOffline: state.serverOffline,
    toasts: state.toasts,
    theme: state.theme,
    setTheme: (t) => dispatch({ type: ACTIONS.SET_THEME, payload: t }),
    toggleTheme: () =>
      dispatch({
        type: ACTIONS.SET_THEME,
        payload: state.theme === 'dark' ? 'light' : 'dark'
      }),
    addToast,
    removeToast,
    fetchHealth,
    refreshUser,
    refreshAccount,
    setUser: (u) => dispatch({ type: ACTIONS.SET_USER, payload: u }),
    setAuth: (a) => dispatch({ type: ACTIONS.SET_AUTH, payload: a }),
    setHealth: (h) => dispatch({ type: ACTIONS.SET_HEALTH, payload: h }),
    setAccount: (a) => dispatch({ type: ACTIONS.SET_ACCOUNT, payload: a }),
    setVerdict: (v) => dispatch({ type: ACTIONS.SET_VERDICT, payload: v }),
    setLoading: (l) => dispatch({ type: ACTIONS.SET_LOADING, payload: l }),
    setError: (e) => dispatch({ type: ACTIONS.SET_ERROR, payload: e }),
    setHistory: (hist) => dispatch({ type: ACTIONS.SET_HISTORY, payload: hist }),
    setActiveTab: (tab) => dispatch({ type: ACTIONS.SET_ACTIVE_TAB, payload: tab }),
    setDraftInput: (input) => dispatch({ type: ACTIONS.SET_DRAFT_INPUT, payload: input }),
    setServerOffline: (off) => dispatch({ type: ACTIONS.SET_SERVER_OFFLINE, payload: off })
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export function useAnalyze() {
  const { dispatch, addToast } = useApp();

  const runAnalyze = useCallback(
    async (instruction, memo = '') => {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: ACTIONS.SET_ERROR, payload: null });

      try {
        const res = await api.analyze({ instruction, memo });
        let finalVerdict = null;

        if (res.ok && res.data && typeof res.data === 'object' && res.data.decision) {
          finalVerdict = res.data;
        } else if (res.data && typeof res.data === 'object' && res.data.decision) {
          // Even on 400 Bad Request or handled policy rejections, server sends a verdict object
          finalVerdict = res.data;
        } else {
          // Network failure, timeout, non-JSON error, or 429
          const is429 = res?.status === 429;
          const errorMsg = is429
            ? 'Too many requests, wait a moment'
            : res?.error || 'Network error or service unavailable';

          finalVerdict = createServiceDegradedVerdict(errorMsg);
          dispatch({ type: ACTIONS.SET_ERROR, payload: errorMsg });
          if (addToast) {
            addToast(errorMsg, 'error');
          }
        }

        dispatch({ type: ACTIONS.SET_VERDICT, payload: finalVerdict });
        return finalVerdict;
      } catch (err) {
        const errorMsg = err?.message || 'Unexpected analysis failure';
        const fallback = createServiceDegradedVerdict(errorMsg);
        dispatch({ type: ACTIONS.SET_ERROR, payload: errorMsg });
        dispatch({ type: ACTIONS.SET_VERDICT, payload: fallback });
        if (addToast) {
          addToast(errorMsg, 'error');
        }
        return fallback;
      } finally {
        dispatch({ type: ACTIONS.SET_LOADING, payload: false });
      }
    },
    [dispatch, addToast]
  );

  return { runAnalyze };
}
