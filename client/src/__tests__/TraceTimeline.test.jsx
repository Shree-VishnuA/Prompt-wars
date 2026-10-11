import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import TraceTimeline from '../components/TraceTimeline.jsx';
import { AppProvider } from '../context/AppContext.jsx';

// Mock api client
vi.mock('../api/client.js', () => ({
  authMe: vi.fn().mockResolvedValue({ ok: true, data: null }),
  getHealth: vi.fn().mockResolvedValue({ ok: true, data: null }),
  getAccount: vi.fn().mockResolvedValue({ ok: true, data: null })
}));

describe('TraceTimeline Component Tests', () => {
  it('marks only the first blocking layer with "Caught here"', () => {
    const verdictWithBlocks = {
      request_id: 'req_trace_01',
      decision: 'BLOCKED',
      trace: [
        {
          layer: 'validation',
          status: 'pass',
          summary: 'Input passed size and structure checks',
          duration_ms: 1,
          findings: []
        },
        {
          layer: 'normalization',
          status: 'pass',
          summary: 'Unicode normalized',
          duration_ms: 2,
          findings: []
        },
        {
          layer: 'deterministic',
          status: 'block',
          summary: 'Matched known prompt injection signature',
          duration_ms: 3,
          findings: ['Triggered RULE_DAN_OVERRIDE']
        },
        {
          layer: 'llm_judge',
          status: 'block',
          summary: 'AI judge flagged adversarial payload',
          duration_ms: 45,
          findings: ['Confidence 0.98 injection']
        },
        {
          layer: 'policy',
          status: 'skipped',
          summary: 'Skipped due to upstream block',
          duration_ms: 0,
          findings: []
        }
      ]
    };

    render(
      <AppProvider>
        <TraceTimeline verdict={verdictWithBlocks} />
      </AppProvider>
    );

    // Verify exactly one "Caught here" badge in the document
    const caughtHereBadges = screen.getAllByText(/Caught here/i);
    expect(caughtHereBadges).toHaveLength(1);

    // Verify it is located within the first blocking layer ("Deterministic rules")
    const caughtHereBadge = caughtHereBadges[0];
    const deterministicRow = caughtHereBadge.closest('.relative.flex');
    expect(deterministicRow).toBeInTheDocument();
    expect(deterministicRow).toHaveTextContent('Deterministic rules');

    // The second blocking layer ("AI judge") should NOT have "Caught here"
    const aiJudgeRow = screen.getByText('AI judge').closest('.relative.flex');
    expect(aiJudgeRow).not.toHaveTextContent('Caught here');
  });

  it('renders all-pass trace without any "Caught here" badge', () => {
    const cleanVerdict = {
      request_id: 'req_clean_01',
      decision: 'APPROVED',
      trace: [
        {
          layer: 'validation',
          status: 'pass',
          summary: 'Input valid',
          duration_ms: 1,
          findings: []
        },
        {
          layer: 'deterministic',
          status: 'pass',
          summary: 'No heuristic matches',
          duration_ms: 2,
          findings: []
        },
        {
          layer: 'policy',
          status: 'pass',
          summary: 'Policy verified',
          duration_ms: 4,
          findings: []
        }
      ]
    };

    render(
      <AppProvider>
        <TraceTimeline verdict={cleanVerdict} />
      </AppProvider>
    );

    expect(screen.queryByText(/Caught here/i)).toBeNull();
  });
});
