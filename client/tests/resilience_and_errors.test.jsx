import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import * as api from '../src/api/client.js';
import { AppProvider, useApp, useAnalyze } from '../src/context/AppContext.jsx';
import ErrorBoundary from '../src/components/ErrorBoundary.jsx';
import Layout from '../src/components/Layout.jsx';
import Toast from '../src/components/Toast.jsx';
import VerdictPanel from '../src/components/VerdictPanel.jsx';
import TraceTimeline from '../src/components/TraceTimeline.jsx';
import JsonInspector from '../src/components/JsonInspector.jsx';
import ConfirmTransfer from '../src/components/ConfirmTransfer.jsx';

describe('ErrorBoundary Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function CrashingChild({ shouldCrash }) {
    if (shouldCrash) {
      throw new Error('Simulated panel render explosion');
    }
    return <div data-testid="healthy-child">Healthy Child Panel Content</div>;
  }

  function ErrorBoundaryHarness() {
    const [crash, setCrash] = useState(true);
    return (
      <div>
        <button onClick={() => setCrash(false)}>Fix Child</button>
        <ErrorBoundary panelName="Firewall">
          <CrashingChild shouldCrash={crash} />
        </ErrorBoundary>
      </div>
    );
  }

  it('catches rendering errors, renders friendly fallback, and reloads on "Reload panel" click', () => {
    render(<ErrorBoundaryHarness />);

    // Expect fallback UI
    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();
    expect(
      screen.getByText(/Something went wrong in the Firewall panel/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Simulated panel render explosion/i)).toBeInTheDocument();

    const reloadBtn = screen.getByRole('button', { name: /Reload panel/i });
    expect(reloadBtn).toBeInTheDocument();

    // Fix the error condition first
    fireEvent.click(screen.getByText('Fix Child'));

    // Now click Reload panel
    fireEvent.click(reloadBtn);

    // Expect healthy content restored
    expect(screen.getByTestId('healthy-child')).toBeInTheDocument();
    expect(screen.queryByTestId('error-boundary-fallback')).not.toBeInTheDocument();
  });
});

describe('Global offline / server-unreachable banner', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders global offline banner with role="alert" when health poll fails or serverOffline is true', async () => {
    vi.spyOn(api, 'authMe').mockResolvedValue({ ok: true, data: null });
    vi.spyOn(api, 'getHealth').mockResolvedValue({
      ok: false,
      status: 503,
      error: 'Service Unavailable'
    });
    vi.spyOn(api, 'getAccount').mockResolvedValue({ ok: true, data: null });

    render(
      <AppProvider>
        <Layout />
      </AppProvider>
    );

    await waitFor(() => {
      const banner = screen.getByTestId('offline-banner');
      expect(banner).toBeInTheDocument();
      expect(banner).toHaveAttribute('role', 'alert');
      expect(banner).toHaveTextContent(/Server Unreachable \/ Offline/i);
      expect(screen.getByRole('button', { name: /Retry connection/i })).toBeInTheDocument();
    });
  });

  it('does not render offline banner when health poll succeeds', async () => {
    vi.spyOn(api, 'authMe').mockResolvedValue({ ok: true, data: null });
    vi.spyOn(api, 'getHealth').mockResolvedValue({
      ok: true,
      status: 200,
      data: { status: 'ok', llm: 'online', policy_version: '1.0.0' }
    });
    vi.spyOn(api, 'getAccount').mockResolvedValue({ ok: true, data: null });

    render(
      <AppProvider>
        <Layout />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('offline-banner')).not.toBeInTheDocument();
    });
  });
});

describe('useAnalyze Fail-Closed Synthesis on Network, Non-JSON, and 429 Errors', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function TestAnalyzeConsumer() {
    const { verdict, error } = useApp();
    const { runAnalyze } = useAnalyze();

    return (
      <div>
        <button onClick={() => runAnalyze('Send 100 to Priya')}>Analyze</button>
        <span data-testid="verdict-decision">{verdict?.decision || 'none'}</span>
        <span data-testid="verdict-cat">{verdict?.threat_category || 'none'}</span>
        <span data-testid="verdict-rationale">{verdict?.rationale || 'none'}</span>
        <span data-testid="error-message">{error || 'none'}</span>
      </div>
    );
  }

  it('synthesizes BLOCKED/SERVICE_DEGRADED on non-JSON response (e.g. 502 HTML text)', async () => {
    vi.spyOn(api, 'analyze').mockResolvedValue({
      ok: false,
      status: 502,
      data: '<html><head><title>502 Bad Gateway</title></head><body>Bad Gateway</body></html>',
      error: 'HTTP 502'
    });

    render(
      <AppProvider>
        <TestAnalyzeConsumer />
      </AppProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));
    });

    expect(screen.getByTestId('verdict-decision')).toHaveTextContent('BLOCKED');
    expect(screen.getByTestId('verdict-cat')).toHaveTextContent('SERVICE_DEGRADED');
  });

  it('synthesizes BLOCKED/SERVICE_DEGRADED and shows "Too many requests, wait a moment" on HTTP 429', async () => {
    vi.spyOn(api, 'analyze').mockResolvedValue({
      ok: false,
      status: 429,
      data: { error: 'Rate limit exceeded' },
      error: 'Too many requests, wait a moment'
    });

    render(
      <AppProvider>
        <TestAnalyzeConsumer />
        <Toast />
      </AppProvider>
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Analyze' }));
    });

    expect(screen.getByTestId('verdict-decision')).toHaveTextContent('BLOCKED');
    expect(screen.getByTestId('verdict-cat')).toHaveTextContent('SERVICE_DEGRADED');
    expect(screen.getByTestId('verdict-rationale')).toHaveTextContent('Too many requests, wait a moment');

    // Toast check
    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent('Too many requests, wait a moment');
  });
});

describe('Toast Notifications', () => {
  function ToastTrigger() {
    const { addToast } = useApp();
    return (
      <div>
        <button onClick={() => addToast('Network connection timed out', 'error')}>
          Trigger Error Toast
        </button>
        <Toast />
      </div>
    );
  }

  it('renders accessible role="status" toast notification and allows dismissing', () => {
    render(
      <AppProvider>
        <ToastTrigger />
      </AppProvider>
    );

    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Trigger Error Toast' }));

    const toast = screen.getByRole('status');
    expect(toast).toBeInTheDocument();
    expect(toast).toHaveTextContent('Network connection timed out');

    // Dismiss
    const dismissBtn = screen.getByRole('button', { name: /Dismiss notification/i });
    fireEvent.click(dismissBtn);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});

describe('Defensive defaults when verdict fields are missing', () => {
  it('VerdictPanel does not crash when passed an empty verdict object {}', () => {
    const { container } = render(
      <AppProvider>
        <VerdictPanel verdict={{}} />
      </AppProvider>
    );
    expect(container).toBeInTheDocument();
    expect(screen.getByTestId('verdict-decision')).toHaveTextContent('BLOCKED');
    expect(screen.getByTestId('verdict-category')).toBeInTheDocument();
    expect(screen.getByTestId('verdict-risk')).toBeInTheDocument();
  });

  it('TraceTimeline does not crash when passed an empty verdict object {}', () => {
    const { container } = render(
      <AppProvider>
        <TraceTimeline verdict={{}} />
      </AppProvider>
    );
    expect(container).toBeInTheDocument();
    expect(screen.getByTestId('trace-list')).toBeInTheDocument();
  });

  it('JsonInspector does not crash when passed an empty verdict object {}', () => {
    const { container } = render(
      <AppProvider>
        <JsonInspector verdict={{}} />
      </AppProvider>
    );
    expect(container).toBeInTheDocument();
    expect(screen.getByTestId('json-inspector')).toBeInTheDocument();
  });

  it('ConfirmTransfer returns null safely when passed an empty verdict object {}', () => {
    const { container } = render(
      <AppProvider>
        <ConfirmTransfer verdict={{}} />
      </AppProvider>
    );
    expect(container.firstChild).toBeNull();
  });
});
