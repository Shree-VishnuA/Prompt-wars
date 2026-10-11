import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import * as api from '../src/api/client.js';
import { AppProvider } from '../src/context/AppContext.jsx';
import Layout from '../src/components/Layout.jsx';
import VerdictPanel from '../src/components/VerdictPanel.jsx';
import AccountCard from '../src/components/AccountCard.jsx';
import AuditLog from '../src/components/AuditLog.jsx';
import JsonInspector from '../src/components/JsonInspector.jsx';

describe('Accessibility, WAI-ARIA, and Keyboard Navigation', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, 'authMe').mockResolvedValue({ ok: true, data: null });
    vi.spyOn(api, 'getHealth').mockResolvedValue({
      ok: true,
      data: { status: 'ok', llm: 'online', policy_version: '1.0.0' }
    });
    vi.spyOn(api, 'getAccount').mockResolvedValue({ ok: true, data: null });
    vi.spyOn(api, 'getAudit').mockResolvedValue({ ok: true, data: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders tab bar with role="tablist" and supports keyboard navigation with Arrow keys, Home, and End', () => {
    render(
      <AppProvider>
        <Layout />
      </AppProvider>
    );

    const tablist = screen.getByRole('tablist', { name: /Security Console Sections/i });
    expect(tablist).toBeInTheDocument();

    const firewallBtn = screen.getByRole('button', { name: 'Firewall' });
    const replayBtn = screen.getByRole('button', { name: 'Replay Lab' });
    const benchBtn = screen.getByRole('button', { name: 'Benchmark' });
    const auditBtn = screen.getByRole('button', { name: 'Audit' });

    // Initial tab: Firewall
    expect(firewallBtn).toHaveAttribute('aria-selected', 'true');
    expect(replayBtn).toHaveAttribute('aria-selected', 'false');

    // Tabpanel associated
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveAttribute('id', 'panel-firewall');
    expect(panel).toHaveAttribute('aria-labelledby', 'tab-firewall');

    // Press ArrowRight on tablist -> switches to Replay Lab
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(replayBtn).toHaveAttribute('aria-selected', 'true');

    // Press ArrowRight again -> switches to Benchmark
    fireEvent.keyDown(tablist, { key: 'ArrowRight' });
    expect(benchBtn).toHaveAttribute('aria-selected', 'true');

    // Press End -> switches to Audit (last tab)
    fireEvent.keyDown(tablist, { key: 'End' });
    expect(auditBtn).toHaveAttribute('aria-selected', 'true');

    // Press Home -> switches back to Firewall (first tab)
    fireEvent.keyDown(tablist, { key: 'Home' });
    expect(firewallBtn).toHaveAttribute('aria-selected', 'true');

    // Press ArrowLeft -> wraps to last tab (Audit)
    fireEvent.keyDown(tablist, { key: 'ArrowLeft' });
    expect(auditBtn).toHaveAttribute('aria-selected', 'true');
  });

  it('verdict region in VerdictPanel has aria-live="polite"', () => {
    const mockVerdict = {
      decision: 'APPROVED',
      threat_category: 'BENIGN',
      risk_score: 10,
      risk_level: 'LOW',
      rationale: 'Clean request'
    };

    render(
      <AppProvider initialValue={{ verdict: mockVerdict }}>
        <VerdictPanel />
      </AppProvider>
    );

    const verdictContainer = screen.getByTestId('verdict-decision').closest('[aria-live="polite"]');
    expect(verdictContainer).toBeInTheDocument();
    expect(verdictContainer).toHaveAttribute('aria-live', 'polite');
    expect(verdictContainer).toHaveAttribute('aria-atomic', 'true');
  });

  it('icon buttons have explicit aria-labels across components', () => {
    // 1. AccountCard refresh
    const { unmount: unmountAccount } = render(
      <AppProvider>
        <AccountCard />
      </AppProvider>
    );
    expect(
      screen.getByRole('button', { name: /Refresh account ledger balance and transactions/i })
    ).toBeInTheDocument();
    unmountAccount();

    // 2. AuditLog refresh
    const { unmount: unmountAudit } = render(
      <AppProvider initialValue={{ activeTab: 'Audit' }}>
        <AuditLog />
      </AppProvider>
    );
    expect(
      screen.getByRole('button', { name: /Refresh security audit log/i })
    ).toBeInTheDocument();
    unmountAudit();

    // 3. JsonInspector buttons
    render(
      <AppProvider initialValue={{ verdict: { decision: 'APPROVED' } }}>
        <JsonInspector />
      </AppProvider>
    );
    expect(
      screen.getByRole('button', { name: /JSON Verdict Inspector/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Copy JSON/i })
    ).toBeInTheDocument();
  });
});
