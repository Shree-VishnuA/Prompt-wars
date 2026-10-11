import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import VerdictPanel from '../src/components/VerdictPanel.jsx';
import { formatPaise } from '../src/lib/format.js';
import { AppProvider } from '../src/context/AppContext.jsx';
import * as api from '../src/api/client.js';

describe('formatPaise utility', () => {
  it('formats paise with Indian numbering grouping and ₹ symbol', () => {
    expect(formatPaise(12345678)).toBe('₹1,23,456.78');
    expect(formatPaise(5000000)).toBe('₹50,000.00');
    expect(formatPaise(75000)).toBe('₹750.00');
    expect(formatPaise(0)).toBe('₹0.00');
  });

  it('safely handles null, undefined, and non-numeric inputs', () => {
    expect(formatPaise(null)).toBe('₹0.00');
    expect(formatPaise(undefined)).toBe('₹0.00');
    expect(formatPaise('abc')).toBe('₹0.00');
  });
});

describe('VerdictPanel component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'authMe').mockResolvedValue({ ok: true, data: null });
    vi.spyOn(api, 'getHealth').mockResolvedValue({
      ok: true,
      data: { status: 'ok', llm: 'online', policy_version: '1.0.0' }
    });
    vi.spyOn(api, 'getAccount').mockResolvedValue({ ok: true, data: null });
  });

  it('renders empty state when there is no verdict', async () => {
    render(
      <AppProvider initialValue={{ verdict: null }}>
        <VerdictPanel />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Awaiting Transaction Input/i)).toBeInTheDocument();
    });
    expect(screen.queryByTestId('verdict-decision')).not.toBeInTheDocument();
  });

  it('renders APPROVED decision banner, risk badge, threat chip, and rationale', async () => {
    const approvedVerdict = {
      request_id: 'req_app_001',
      decision: 'APPROVED',
      requires_confirmation: false,
      risk_level: 'LOW',
      risk_score: 15,
      threat_category: 'BENIGN',
      rationale: 'Legitimate request with verified recipient and benign memo.',
      policy_version: '1.0.0',
      degraded: false,
      simulated_result: null,
      latency_ms: 42
    };

    render(
      <AppProvider initialValue={{ verdict: approvedVerdict }}>
        <VerdictPanel />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('verdict-decision')).toHaveTextContent('APPROVED');
    });

    // Check risk badge
    const riskBadge = screen.getByTestId('verdict-risk');
    expect(riskBadge).toHaveTextContent(/LOW/i);
    expect(riskBadge).toHaveTextContent(/15\/100/);

    // Check category chip
    const categoryChip = screen.getByTestId('verdict-category');
    expect(categoryChip).toHaveTextContent('Benign Request');

    // Check rationale
    const rationale = screen.getByTestId('verdict-rationale');
    expect(rationale).toHaveTextContent(
      'Legitimate request with verified recipient and benign memo.'
    );

    expect(screen.queryByText(/Degraded Defense Mode Active/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Explicit Confirmation Required/i)).not.toBeInTheDocument();
  });

  it('renders BLOCKED decision banner with high risk gauge and human-readable threat category', async () => {
    const blockedVerdict = {
      request_id: 'req_blk_001',
      decision: 'BLOCKED',
      requires_confirmation: false,
      risk_level: 'CRITICAL',
      risk_score: 95,
      threat_category: 'MEMO_INJECTION',
      rationale:
        'Detected adversarial instructions in transaction memo attempting to override payment recipient.',
      policy_version: '1.0.0',
      degraded: false,
      simulated_result: null,
      latency_ms: 18
    };

    render(
      <AppProvider initialValue={{ verdict: blockedVerdict }}>
        <VerdictPanel />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('verdict-decision')).toHaveTextContent('BLOCKED');
    });

    const categoryChip = screen.getByTestId('verdict-category');
    expect(categoryChip).toHaveTextContent('Memo Injection');

    const riskBadge = screen.getByTestId('verdict-risk');
    expect(riskBadge).toHaveTextContent(/CRITICAL/i);
    expect(riskBadge).toHaveTextContent(/95\/100/);

    const rationale = screen.getByTestId('verdict-rationale');
    expect(rationale).toHaveTextContent(/Detected adversarial instructions in transaction memo/i);
  });

  it('truncates rationale to 300 characters and renders as plain text without dangerous HTML', async () => {
    const longMaliciousRationale =
      '<img src="x" onerror="alert(1)"> ' + 'A'.repeat(350);

    const verdict = {
      request_id: 'req_xss_001',
      decision: 'BLOCKED',
      requires_confirmation: false,
      risk_level: 'HIGH',
      risk_score: 80,
      threat_category: 'DIRECT_PROMPT_INJECTION',
      rationale: longMaliciousRationale,
      policy_version: '1.0.0',
      degraded: false,
      simulated_result: null
    };

    render(
      <AppProvider initialValue={{ verdict }}>
        <VerdictPanel />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('verdict-rationale')).toBeInTheDocument();
    });

    const rationaleElem = screen.getByTestId('verdict-rationale');
    // Ensure rendered length <= 300
    expect(rationaleElem.textContent.length).toBeLessThanOrEqual(300);
    // Ensure raw text contains <img literally as text, NOT parsed as an HTML element
    expect(rationaleElem.textContent).toContain('<img src="x"');
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });

  it('displays degraded warning and requires_confirmation notice when flags are true', async () => {
    const verdict = {
      request_id: 'req_flags_001',
      decision: 'APPROVED',
      requires_confirmation: true,
      risk_level: 'MEDIUM',
      risk_score: 40,
      threat_category: 'BENIGN',
      rationale: 'Transfer approved under degraded fallback.',
      policy_version: '1.0.0',
      degraded: true,
      simulated_result: null
    };

    render(
      <AppProvider initialValue={{ verdict }}>
        <VerdictPanel />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Degraded Defense Mode Active/i)).toBeInTheDocument();
      expect(screen.getByText(/Explicit Confirmation Required/i)).toBeInTheDocument();
    });
  });

  it('renders simulated_result balance formatted as INR currency', async () => {
    const verdict = {
      request_id: 'req_sim_bal',
      decision: 'APPROVED',
      requires_confirmation: false,
      risk_level: 'LOW',
      risk_score: 5,
      threat_category: 'BENIGN',
      rationale: 'Balance check approved.',
      simulated_result: { balance_paise: 5000000 }
    };

    render(
      <AppProvider initialValue={{ verdict }}>
        <VerdictPanel />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Account Balance Result')).toBeInTheDocument();
      expect(screen.getByText('₹50,000.00')).toBeInTheDocument();
    });
  });

  it('renders simulated_result transaction table for history read', async () => {
    const verdict = {
      request_id: 'req_sim_tx',
      decision: 'APPROVED',
      requires_confirmation: false,
      risk_level: 'LOW',
      risk_score: 5,
      threat_category: 'BENIGN',
      rationale: 'Transaction history query approved.',
      simulated_result: {
        transactions: [
          {
            id: 'tx_1',
            date: '2026-10-01T10:00:00Z',
            counterparty: 'Salary Corp',
            type: 'CREDIT',
            amount_paise: 15000000,
            memo: 'Monthly salary'
          },
          {
            id: 'tx_2',
            date: '2026-10-02T14:30:00Z',
            counterparty: 'Supermart',
            type: 'DEBIT',
            amount_paise: 250000,
            memo: 'Groceries'
          }
        ]
      }
    };

    render(
      <AppProvider initialValue={{ verdict }}>
        <VerdictPanel />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText(/Simulated Ledger Transactions \(2\)/i)).toBeInTheDocument();
      expect(screen.getByText('Salary Corp')).toBeInTheDocument();
      expect(screen.getByText('+₹1,50,000.00')).toBeInTheDocument();
      expect(screen.getByText('Supermart')).toBeInTheDocument();
      expect(screen.getByText('-₹2,500.00')).toBeInTheDocument();
    });
  });
});
