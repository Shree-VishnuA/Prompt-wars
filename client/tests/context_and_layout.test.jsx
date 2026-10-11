import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import * as api from '../src/api/client.js';
import {
  AppProvider,
  useApp,
  useAnalyze,
  appReducer,
  ACTIONS,
  initialState,
  createServiceDegradedVerdict
} from '../src/context/AppContext.jsx';
import Layout from '../src/components/Layout.jsx';

describe('AppContext & useAnalyze', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reducer handles all action types correctly', () => {
    let state = initialState;

    // SET_USER
    state = appReducer(state, { type: ACTIONS.SET_USER, payload: { id: 'usr_test', name: 'Test' } });
    expect(state.user).toEqual({ id: 'usr_test', name: 'Test' });

    // SET_HEALTH
    state = appReducer(state, {
      type: ACTIONS.SET_HEALTH,
      payload: { status: 'ok', llm: 'online', policy_version: '1.0.0' }
    });
    expect(state.health.llm).toBe('online');

    // SET_ACCOUNT
    state = appReducer(state, {
      type: ACTIONS.SET_ACCOUNT,
      payload: { account_id: 'ACC-1001', balance_paise: 5000000 }
    });
    expect(state.account.balance_paise).toBe(5000000);

    // SET_LOADING & SET_ERROR
    state = appReducer(state, { type: ACTIONS.SET_LOADING, payload: true });
    expect(state.loading).toBe(true);
    state = appReducer(state, { type: ACTIONS.SET_ERROR, payload: 'Test Error' });
    expect(state.error).toBe('Test Error');

    // SET_ACTIVE_TAB
    state = appReducer(state, { type: ACTIONS.SET_ACTIVE_TAB, payload: 'Benchmark' });
    expect(state.activeTab).toBe('Benchmark');

    // SET_VERDICT & history capping at 20
    for (let i = 1; i <= 25; i++) {
      state = appReducer(state, {
        type: ACTIONS.SET_VERDICT,
        payload: {
          request_id: `req_${i}`,
          decision: i % 2 === 0 ? 'APPROVED' : 'BLOCKED',
          threat_category: 'BENIGN'
        }
      });
    }

    expect(state.verdict.request_id).toBe('req_25');
    expect(state.history.length).toBe(20);
    expect(state.history[0].request_id).toBe('req_25');
    expect(state.history[19].request_id).toBe('req_6');
  });

  it('createServiceDegradedVerdict returns fail-closed blocked verdict', () => {
    const fallback = createServiceDegradedVerdict('Connection timed out');
    expect(fallback.decision).toBe('BLOCKED');
    expect(fallback.threat_category).toBe('SERVICE_DEGRADED');
    expect(fallback.degraded).toBe(true);
    expect(fallback.rationale).toContain('Connection timed out');
    expect(fallback.intent_token).toBeNull();
    expect(fallback.simulated_result).toBeNull();
  });

  it('AppProvider calls authMe, getHealth and getAccount on mount', async () => {
    vi.spyOn(api, 'authMe').mockResolvedValue({
      ok: true,
      status: 200,
      data: { user: { id: 'usr_demo', name: 'Demo User' } },
      error: null
    });
    vi.spyOn(api, 'getHealth').mockResolvedValue({
      ok: true,
      status: 200,
      data: { status: 'ok', llm: 'online', policy_version: '1.0.0' },
      error: null
    });
    vi.spyOn(api, 'getAccount').mockResolvedValue({
      ok: true,
      status: 200,
      data: { account_id: 'ACC-1001', balance_paise: 5000000 },
      error: null
    });

    function Consumer() {
      const { user, health, account } = useApp();
      return (
        <div>
          <span data-testid="user-name">{user?.name || 'none'}</span>
          <span data-testid="health-llm">{health?.llm || 'none'}</span>
          <span data-testid="account-id">{account?.account_id || 'none'}</span>
        </div>
      );
    }

    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-name')).toHaveTextContent('Demo User');
      expect(screen.getByTestId('health-llm')).toHaveTextContent('online');
      expect(screen.getByTestId('account-id')).toHaveTextContent('ACC-1001');
    });

    expect(api.authMe).toHaveBeenCalled();
    expect(api.getHealth).toHaveBeenCalled();
    expect(api.getAccount).toHaveBeenCalled();
  });

  it('useAnalyze sets loading and stores verdict on successful analyze', async () => {
    const mockVerdict = {
      request_id: 'req_success',
      decision: 'APPROVED',
      risk_score: 10,
      risk_level: 'LOW',
      threat_category: 'BENIGN',
      rationale: 'Clean transfer'
    };

    vi.spyOn(api, 'analyze').mockResolvedValue({
      ok: true,
      status: 200,
      data: mockVerdict,
      error: null
    });

    function TestAnalyzeComponent() {
      const { verdict, loading, history } = useApp();
      const { runAnalyze } = useAnalyze();

      return (
        <div>
          <button onClick={() => runAnalyze('Send 500 to Rahul', 'groceries')}>
            Run
          </button>
          <span data-testid="loading-status">{loading ? 'loading' : 'idle'}</span>
          <span data-testid="verdict-decision">{verdict?.decision || 'no-verdict'}</span>
          <span data-testid="history-count">{history.length}</span>
        </div>
      );
    }

    render(
      <AppProvider>
        <TestAnalyzeComponent />
      </AppProvider>
    );

    expect(screen.getByTestId('verdict-decision')).toHaveTextContent('no-verdict');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Run' }));
    });

    expect(screen.getByTestId('verdict-decision')).toHaveTextContent('APPROVED');
    expect(screen.getByTestId('loading-status')).toHaveTextContent('idle');
    expect(screen.getByTestId('history-count')).toHaveTextContent('1');
  });

  it('useAnalyze synthesizes BLOCKED SERVICE_DEGRADED on network failure', async () => {
    vi.spyOn(api, 'analyze').mockResolvedValue({
      ok: false,
      status: 0,
      data: null,
      error: 'Network connection aborted'
    });

    function TestAnalyzeFailure() {
      const { verdict, error } = useApp();
      const { runAnalyze } = useAnalyze();

      return (
        <div>
          <button onClick={() => runAnalyze('Send 500 to Rahul')}>Run Failure</button>
          <span data-testid="verdict-decision">{verdict?.decision || 'no-verdict'}</span>
          <span data-testid="threat-cat">{verdict?.threat_category || 'none'}</span>
          <span data-testid="err-msg">{error || 'no-error'}</span>
        </div>
      );
    }

    render(
      <AppProvider>
        <TestAnalyzeFailure />
      </AppProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Run Failure' }));
    });

    expect(screen.getByTestId('verdict-decision')).toHaveTextContent('BLOCKED');
    expect(screen.getByTestId('threat-cat')).toHaveTextContent('SERVICE_DEGRADED');
    expect(screen.getByTestId('err-msg')).toHaveTextContent('Network connection aborted');
  });
});

describe('Layout component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'authMe').mockResolvedValue({ ok: true, data: null });
    vi.spyOn(api, 'getHealth').mockResolvedValue({
      ok: true,
      data: { status: 'ok', llm: 'online', policy_version: '1.0.0' }
    });
    vi.spyOn(api, 'getAccount').mockResolvedValue({ ok: true, data: null });
  });

  it('renders header with shield logo, title, and tagline', async () => {
    render(
      <AppProvider>
        <Layout />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bankism');
    });
    expect(screen.getAllByText('Transaction Intent Firewall').length).toBeGreaterThanOrEqual(1);
  });

  it('renders StatusPill with data-testid="status-pill" showing LLM state and policy version', async () => {
    render(
      <AppProvider
        initialValue={{
          health: { status: 'ok', llm: 'online', policy_version: '1.0.0' }
        }}
      >
        <Layout />
      </AppProvider>
    );

    await waitFor(() => {
      const pill = screen.getByTestId('status-pill');
      expect(pill).toBeInTheDocument();
      expect(pill).toHaveTextContent(/LLM ONLINE/i);
      expect(pill).toHaveTextContent(/v1\.0\.0/i);
    });
  });

  it('renders all four tabs and switches tab panels on click', async () => {
    render(
      <AppProvider>
        <Layout />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Layer 1-7 Defensive Pipeline/i)).toBeInTheDocument();
    });

    // Click "Replay Lab"
    fireEvent.click(screen.getByRole('button', { name: 'Replay Lab' }));
    expect(screen.getByText(/Adversarial Testing Ground/i)).toBeInTheDocument();

    // Click "Benchmark"
    fireEvent.click(screen.getByRole('button', { name: 'Benchmark' }));
    expect(screen.getByText(/Regression Harness/i)).toBeInTheDocument();

    // Click "Audit"
    fireEvent.click(screen.getByRole('button', { name: 'Audit' }));
    expect(screen.getByText(/Tamper-Evident Ring Buffer/i)).toBeInTheDocument();

    // Click back to "Firewall"
    fireEvent.click(screen.getByRole('button', { name: 'Firewall' }));
    expect(screen.getByText(/Layer 1-7 Defensive Pipeline/i)).toBeInTheDocument();
  });
});
