import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { AppProvider, useApp, useAnalyze } from '../context/AppContext.jsx';
import * as api from '../api/client.js';

// Mock api client
vi.mock('../api/client.js', () => ({
  analyze: vi.fn(),
  authMe: vi.fn().mockResolvedValue({ ok: true, data: null }),
  getHealth: vi.fn().mockResolvedValue({ ok: true, data: null }),
  getAccount: vi.fn().mockResolvedValue({ ok: true, data: null }),
  execute: vi.fn()
}));

function ConsumerComponent() {
  const { verdict, error, loading, toasts } = useApp();
  const { runAnalyze } = useAnalyze();

  return (
    <div>
      <button
        data-testid="trigger-analyze"
        onClick={() => runAnalyze('Send 500 to Alice', 'coffee')}
      >
        Run Analyze
      </button>
      <div data-testid="verdict-decision">{verdict?.decision || 'NO_VERDICT'}</div>
      <div data-testid="verdict-category">{verdict?.threat_category || 'NO_CATEGORY'}</div>
      <div data-testid="verdict-degraded">{verdict?.degraded ? 'DEGRADED' : 'NORMAL'}</div>
      <div data-testid="verdict-rationale">{verdict?.rationale || 'NO_RATIONALE'}</div>
      <div data-testid="app-error">{error || 'NO_ERROR'}</div>
      <div data-testid="app-loading">{loading ? 'LOADING' : 'IDLE'}</div>
      <div data-testid="toast-count">{toasts.length}</div>
    </div>
  );
}

describe('useAnalyze hook tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('synthesizes a BLOCKED verdict on fetch rejection / network error', async () => {
    api.analyze.mockRejectedValueOnce(new Error('Network connection failed'));

    render(
      <AppProvider>
        <ConsumerComponent />
      </AppProvider>
    );

    expect(screen.getByTestId('verdict-decision')).toHaveTextContent('NO_VERDICT');
    expect(screen.getByTestId('app-loading')).toHaveTextContent('IDLE');

    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-analyze'));
    });

    // Synthesized fail-closed BLOCKED verdict
    expect(screen.getByTestId('verdict-decision')).toHaveTextContent('BLOCKED');
    expect(screen.getByTestId('verdict-category')).toHaveTextContent('SERVICE_DEGRADED');
    expect(screen.getByTestId('verdict-degraded')).toHaveTextContent('DEGRADED');
    expect(screen.getByTestId('verdict-rationale')).toHaveTextContent('Network connection failed');
    expect(screen.getByTestId('app-error')).toHaveTextContent('Network connection failed');
    expect(screen.getByTestId('app-loading')).toHaveTextContent('IDLE');
    expect(screen.getByTestId('toast-count')).toHaveTextContent('1');
  });

  it('synthesizes a BLOCKED verdict on non-ok API failure without verdict data', async () => {
    api.analyze.mockResolvedValueOnce({
      ok: false,
      status: 503,
      data: null,
      error: 'Backend gateway timeout'
    });

    render(
      <AppProvider>
        <ConsumerComponent />
      </AppProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-analyze'));
    });

    expect(screen.getByTestId('verdict-decision')).toHaveTextContent('BLOCKED');
    expect(screen.getByTestId('verdict-category')).toHaveTextContent('SERVICE_DEGRADED');
    expect(screen.getByTestId('verdict-degraded')).toHaveTextContent('DEGRADED');
    expect(screen.getByTestId('verdict-rationale')).toHaveTextContent('Backend gateway timeout');
    expect(screen.getByTestId('app-error')).toHaveTextContent('Backend gateway timeout');
    expect(screen.getByTestId('app-loading')).toHaveTextContent('IDLE');
  });

  it('synthesizes a BLOCKED verdict on rate limiting (HTTP 429)', async () => {
    api.analyze.mockResolvedValueOnce({
      ok: false,
      status: 429,
      data: null,
      error: 'Too many requests, wait a moment'
    });

    render(
      <AppProvider>
        <ConsumerComponent />
      </AppProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-analyze'));
    });

    expect(screen.getByTestId('verdict-decision')).toHaveTextContent('BLOCKED');
    expect(screen.getByTestId('verdict-category')).toHaveTextContent('SERVICE_DEGRADED');
    expect(screen.getByTestId('verdict-rationale')).toHaveTextContent('Too many requests, wait a moment');
    expect(screen.getByTestId('app-error')).toHaveTextContent('Too many requests, wait a moment');
  });

  it('updates state with server verdict on successful analyze call', async () => {
    const successVerdict = {
      request_id: 'req_normal_123',
      decision: 'APPROVED',
      threat_category: 'BENIGN',
      risk_score: 10,
      risk_level: 'LOW',
      rationale: 'Legitimate payment request'
    };

    api.analyze.mockResolvedValueOnce({
      ok: true,
      status: 200,
      data: successVerdict,
      error: null
    });

    render(
      <AppProvider>
        <ConsumerComponent />
      </AppProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByTestId('trigger-analyze'));
    });

    expect(screen.getByTestId('verdict-decision')).toHaveTextContent('APPROVED');
    expect(screen.getByTestId('verdict-category')).toHaveTextContent('BENIGN');
    expect(screen.getByTestId('verdict-degraded')).toHaveTextContent('NORMAL');
    expect(screen.getByTestId('verdict-rationale')).toHaveTextContent('Legitimate payment request');
    expect(screen.getByTestId('app-error')).toHaveTextContent('NO_ERROR');
    expect(screen.getByTestId('app-loading')).toHaveTextContent('IDLE');
  });
});
