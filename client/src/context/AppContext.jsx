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
  SET_ACTIVE_TAB: 'SET_ACTIVE_TAB'
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
  activeTab: 'Firewall'
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

    case ACTIONS.SET_ACTIVE_TAB:
      return { ...state, activeTab: action.payload };

    default:
      return state;
  }
}

export const AppContext = createContext(null);

export function AppProvider({ children, initialValue = {} }) {
  const [state, dispatch] = useReducer(appReducer, {
    ...initialState,
    ...initialValue
  });

  useEffect(() => {
    let isMounted = true;

    async function initUser() {
      const res = await api.authMe();
      if (isMounted && res.ok && res.data) {
        if (res.data.user) {
          dispatch({ type: ACTIONS.SET_USER, payload: res.data.user });
        }
        if (res.data.auth) {
          dispatch({ type: ACTIONS.SET_AUTH, payload: res.data.auth });
        }
      }
    }

    async function fetchHealth() {
      const res = await api.getHealth();
      if (isMounted && res.ok && res.data) {
        dispatch({ type: ACTIONS.SET_HEALTH, payload: res.data });
      }
    }

    async function fetchAccount() {
      const res = await api.getAccount();
      if (isMounted && res.ok && res.data) {
        dispatch({ type: ACTIONS.SET_ACCOUNT, payload: res.data });
      }
    }

    initUser();
    fetchHealth();
    fetchAccount();

    const interval = setInterval(fetchHealth, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await api.authMe();
    if (res.ok && res.data) {
      if (res.data.user) dispatch({ type: ACTIONS.SET_USER, payload: res.data.user });
      if (res.data.auth) dispatch({ type: ACTIONS.SET_AUTH, payload: res.data.auth });
      return res.data;
    }
    return null;
  }, []);

  const refreshAccount = useCallback(async () => {
    const res = await api.getAccount();
    if (res.ok && res.data) {
      dispatch({ type: ACTIONS.SET_ACCOUNT, payload: res.data });
      return res.data;
    }
    return null;
  }, []);

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
    setActiveTab: (tab) => dispatch({ type: ACTIONS.SET_ACTIVE_TAB, payload: tab })
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
  const { dispatch } = useApp();

  const runAnalyze = useCallback(
    async (instruction, memo = '') => {
      dispatch({ type: ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: ACTIONS.SET_ERROR, payload: null });

      try {
        const res = await api.analyze({ instruction, memo });
        let finalVerdict = null;

        if (res.ok && res.data && res.data.decision) {
          finalVerdict = res.data;
        } else if (res.data && res.data.decision) {
          // Even on 400 Bad Request or handled policy rejections, server sends a verdict object
          finalVerdict = res.data;
        } else {
          // Network failure, timeout, or server unavailable -> fail-closed
          const errorMsg = res.error || 'Network error or service unavailable';
          finalVerdict = createServiceDegradedVerdict(errorMsg);
          dispatch({ type: ACTIONS.SET_ERROR, payload: errorMsg });
        }

        dispatch({ type: ACTIONS.SET_VERDICT, payload: finalVerdict });
        return finalVerdict;
      } catch (err) {
        const errorMsg = err?.message || 'Unexpected analysis failure';
        const fallback = createServiceDegradedVerdict(errorMsg);
        dispatch({ type: ACTIONS.SET_ERROR, payload: errorMsg });
        dispatch({ type: ACTIONS.SET_VERDICT, payload: fallback });
        return fallback;
      } finally {
        dispatch({ type: ACTIONS.SET_LOADING, payload: false });
      }
    },
    [dispatch]
  );

  return { runAnalyze };
}
