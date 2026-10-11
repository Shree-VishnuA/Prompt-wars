import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import VerdictPanel from '../components/VerdictPanel.jsx';
import { AppProvider } from '../context/AppContext.jsx';

// Mock api client
vi.mock('../api/client.js', () => ({
  analyze: vi.fn(),
  authMe: vi.fn().mockResolvedValue({ ok: true, data: null }),
  getHealth: vi.fn().mockResolvedValue({ ok: true, data: null }),
  getAccount: vi.fn().mockResolvedValue({ ok: true, data: null }),
  execute: vi.fn(),
  getAudit: vi.fn()
}));

describe('VerdictPanel Component Tests', () => {
  const approvedFixture = {
    request_id: 'req_app_001',
    decision: 'APPROVED',
    requires_confirmation: true,
    risk_score: 15,
    risk_level: 'LOW',
    threat_category: 'BENIGN',
    rationale: 'Clean peer transfer under daily limit.',
    simulated_result: {
      action: 'TRANSFER_INTENT_LOCKED',
      amount_paise: 75000,
      recipient: 'Priya'
    },
    trace: []
  };

  const blockedFixture = {
    request_id: 'req_blk_002',
    decision: 'BLOCKED',
    requires_confirmation: false,
    risk_score: 95,
    risk_level: 'CRITICAL',
    threat_category: 'DIRECT_PROMPT_INJECTION',
    rationale: 'Prompt injection instruction detected attempting policy bypass.',
    trace: []
  };

  it('renders APPROVED fixture with emerald styling and details', () => {
    render(
      <AppProvider>
        <VerdictPanel verdict={approvedFixture} />
      </AppProvider>
    );

    const banner = screen.getByTestId('verdict-decision');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('APPROVED');
    expect(banner.className).toContain('emerald');

    const riskBadge = screen.getByTestId('verdict-risk');
    expect(riskBadge).toHaveTextContent('15');
    expect(riskBadge).toHaveTextContent('LOW');

    const categoryChip = screen.getByTestId('verdict-category');
    expect(categoryChip).toHaveTextContent('Benign Request');

    const rationale = screen.getByTestId('verdict-rationale');
    expect(rationale).toHaveTextContent('Clean peer transfer under daily limit.');
  });

  it('renders BLOCKED fixture with rose styling, risk level, and category', () => {
    render(
      <AppProvider>
        <VerdictPanel verdict={blockedFixture} />
      </AppProvider>
    );

    const banner = screen.getByTestId('verdict-decision');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent('BLOCKED');
    expect(banner.className).toContain('rose');

    const riskBadge = screen.getByTestId('verdict-risk');
    expect(riskBadge).toHaveTextContent('95');
    expect(riskBadge).toHaveTextContent('CRITICAL');

    const categoryChip = screen.getByTestId('verdict-category');
    expect(categoryChip).toHaveTextContent('Direct Prompt Injection');

    const rationale = screen.getByTestId('verdict-rationale');
    expect(rationale).toHaveTextContent(
      'Prompt injection instruction detected attempting policy bypass.'
    );
  });

  it('does not render HTML from rationale such as "<img src=x onerror=alert(1)>" as markup', () => {
    const maliciousPayload = '<img src=x onerror=alert(1)>';
    const xssFixture = {
      request_id: 'req_xss_test',
      decision: 'BLOCKED',
      threat_category: 'DIRECT_PROMPT_INJECTION',
      risk_score: 99,
      risk_level: 'CRITICAL',
      rationale: `Injection caught: ${maliciousPayload} and <script>alert("hack")</script>`,
      trace: []
    };

    const { container } = render(
      <AppProvider>
        <VerdictPanel verdict={xssFixture} />
      </AppProvider>
    );

    const rationaleEl = screen.getByTestId('verdict-rationale');
    // The raw string must appear as text
    expect(rationaleEl.textContent).toContain(maliciousPayload);
    expect(rationaleEl.textContent).toContain('<script>alert("hack")</script>');

    // Crucial security check: NO <img> element or <script> element was inserted into the DOM
    const imgElement = container.querySelector('img[src="x"]');
    expect(imgElement).toBeNull();

    const anyImg = container.querySelector('img');
    expect(anyImg).toBeNull();

    const scriptElement = container.querySelector('script');
    expect(scriptElement).toBeNull();
  });
});
