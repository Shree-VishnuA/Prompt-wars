import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TraceTimeline, { LAYER_NAMES } from '../src/components/TraceTimeline.jsx';
import JsonInspector, { tokenizeLine } from '../src/components/JsonInspector.jsx';
import { AppProvider } from '../src/context/AppContext.jsx';
import * as api from '../src/api/client.js';

describe('TraceTimeline component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'authMe').mockResolvedValue({ ok: true, data: null });
    vi.spyOn(api, 'getHealth').mockResolvedValue({ ok: true, data: { status: 'ok', llm: 'online', policy_version: '1.0.0' } });
    vi.spyOn(api, 'getAccount').mockResolvedValue({ ok: true, data: null });
  });

  it('renders empty state when there is no verdict or trace is empty', async () => {
    render(
      <AppProvider initialValue={{ verdict: null }}>
        <TraceTimeline />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('trace-list')).toBeInTheDocument();
      expect(screen.getByText(/No defense layers evaluated yet/i)).toBeInTheDocument();
    });
  });

  it('renders all layers with plain English names, summaries, and duration', async () => {
    const verdict = {
      request_id: 'req_trace_01',
      decision: 'APPROVED',
      latency_ms: 120,
      trace: [
        {
          layer: 'validation',
          status: 'pass',
          summary: 'Payload matched AnalyzeRequestSchema',
          findings: [],
          duration_ms: 2
        },
        {
          layer: 'normalization',
          status: 'pass',
          summary: 'NFKC and zero-width normalization applied',
          findings: [],
          duration_ms: 3
        },
        {
          layer: 'deterministic',
          status: 'pass',
          summary: 'Heuristic detectors found 0 anomalies',
          findings: [],
          duration_ms: 5
        },
        {
          layer: 'llm_extractor',
          status: 'pass',
          summary: 'Extracted TRANSFER to Rahul for ₹500',
          findings: [],
          duration_ms: 50
        },
        {
          layer: 'llm_judge',
          status: 'pass',
          summary: 'Judge classified request as BENIGN',
          findings: [],
          duration_ms: 45
        },
        {
          layer: 'grounding',
          status: 'pass',
          summary: 'Recipient matched contact c_rahul',
          findings: [],
          duration_ms: 2
        },
        {
          layer: 'policy',
          status: 'pass',
          summary: 'Policy Rule R7 passed',
          findings: [],
          duration_ms: 1
        }
      ]
    };

    render(
      <AppProvider initialValue={{ verdict }}>
        <TraceTimeline />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Input validation')).toBeInTheDocument();
      expect(screen.getByText('Normalization')).toBeInTheDocument();
      expect(screen.getByText('Deterministic rules')).toBeInTheDocument();
      expect(screen.getByText('AI extractor')).toBeInTheDocument();
      expect(screen.getByText('AI judge')).toBeInTheDocument();
      expect(screen.getByText('Intent grounding')).toBeInTheDocument();
      expect(screen.getByText('Policy engine')).toBeInTheDocument();
    });

    expect(screen.getByText('Extracted TRANSFER to Rahul for ₹500')).toBeInTheDocument();
    expect(screen.getByText('50 ms')).toBeInTheDocument();
    // Since all passed, "Caught here" should not be present
    expect(screen.queryByText(/Caught here/i)).not.toBeInTheDocument();
  });

  it('highlights the FIRST blocking layer with "Caught here" label', async () => {
    const verdict = {
      request_id: 'req_trace_block',
      decision: 'BLOCKED',
      trace: [
        {
          layer: 'validation',
          status: 'pass',
          summary: 'Input schema valid',
          findings: [],
          duration_ms: 1
        },
        {
          layer: 'deterministic',
          status: 'block',
          summary: 'Zero-width character obfuscation detected',
          findings: ['Zero-width space at index 2', 'Invisible unicode sequence'],
          duration_ms: 4
        },
        {
          layer: 'policy',
          status: 'block',
          summary: 'Hard block enforced by R2',
          findings: [],
          duration_ms: 1
        }
      ]
    };

    render(
      <AppProvider initialValue={{ verdict }}>
        <TraceTimeline />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Deterministic rules')).toBeInTheDocument();
    });

    const caughtHereBadges = screen.getAllByText(/Caught here/i);
    // Should be on the FIRST blocking layer ONLY
    expect(caughtHereBadges.length).toBe(1);

    // Verify findings expandable toggle
    expect(screen.getByText('Findings (2)')).toBeInTheDocument();
    expect(screen.getByText(/Zero-width space at index 2/i)).toBeInTheDocument();
  });
});

describe('JsonInspector component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders syntax-highlighted verdict JSON', async () => {
    const verdict = {
      request_id: 'req_json_01',
      decision: 'APPROVED',
      risk_score: 10,
      degraded: false,
      intent_token: 'tok_secret_jwt_signature'
    };

    render(
      <AppProvider initialValue={{ verdict }}>
        <JsonInspector />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('json-inspector')).toBeInTheDocument();
    });

    // Check key and value syntax elements
    expect(screen.getByText('"decision"')).toBeInTheDocument();
    expect(screen.getByText('"APPROVED"')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('false')).toBeInTheDocument();
  });

  it('toggles collapsible state', async () => {
    const verdict = { decision: 'APPROVED' };

    render(
      <AppProvider initialValue={{ verdict }}>
        <JsonInspector />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('"decision"')).toBeInTheDocument();
    });

    // Click collapse button
    fireEvent.click(screen.getByRole('button', { name: /JSON Verdict Inspector/i }));
    expect(screen.queryByText('"decision"')).not.toBeInTheDocument();
    expect(screen.getByText(/Verdict JSON is collapsed/i)).toBeInTheDocument();

    // Click again to expand
    fireEvent.click(screen.getByRole('button', { name: /JSON Verdict Inspector/i }));
    expect(screen.getByText('"decision"')).toBeInTheDocument();
  });

  it('masks intent_token when "Hide intent_token" is checked', async () => {
    const verdict = {
      request_id: 'req_tok_01',
      intent_token: 'secret_token_12345'
    };

    render(
      <AppProvider initialValue={{ verdict }}>
        <JsonInspector />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('"secret_token_12345"')).toBeInTheDocument();
    });

    const hideCheckbox = screen.getByRole('checkbox', { name: /Hide intent_token/i });
    fireEvent.click(hideCheckbox);

    expect(screen.queryByText('"secret_token_12345"')).not.toBeInTheDocument();
    expect(screen.getByText('"[REDACTED]"')).toBeInTheDocument();
  });

  it('copies JSON to clipboard on button click', async () => {
    const verdict = { decision: 'APPROVED' };
    const writeTextMock = vi.fn().mockResolvedValue();

    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock
      }
    });

    render(
      <AppProvider initialValue={{ verdict }}>
        <JsonInspector />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Copy JSON/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Copy JSON/i }));

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalled();
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('tokenizeLine correctly handles null and numbers', () => {
    const spans = tokenizeLine('  "test": null,', 0);
    expect(spans.length).toBeGreaterThan(0);
  });
});
