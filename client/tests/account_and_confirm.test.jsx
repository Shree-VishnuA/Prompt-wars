import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AccountCard from '../src/components/AccountCard.jsx';
import ConfirmTransfer from '../src/components/ConfirmTransfer.jsx';
import { AppProvider } from '../src/context/AppContext.jsx';
import * as api from '../src/api/client.js';

describe('AccountCard component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders user name, account id, balance, and recent transactions', async () => {
    const mockAccount = {
      account_id: 'ACC-1001',
      balance_paise: 4500000,
      history: [
        {
          id: 'tx_1',
          date: '2026-10-10T10:00:00Z',
          counterparty: 'Rahul Sharma',
          type: 'DEBIT',
          amount_paise: 50000,
          memo: 'Lunch split'
        },
        {
          id: 'tx_2',
          date: '2026-10-09T10:00:00Z',
          counterparty: 'Salary Corp',
          type: 'CREDIT',
          amount_paise: 5000000,
          memo: 'Monthly salary'
        }
      ]
    };

    const mockUser = {
      id: 'usr_demo',
      name: 'Demo Account'
    };

    render(
      <AppProvider initialValue={{ account: mockAccount, user: mockUser }}>
        <AccountCard />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Demo Account')).toBeInTheDocument();
      expect(screen.getByText('ACC-1001')).toBeInTheDocument();
      expect(screen.getByText('₹45,000.00')).toBeInTheDocument();
      expect(screen.getByText('Rahul Sharma')).toBeInTheDocument();
      expect(screen.getByText('Lunch split')).toBeInTheDocument();
    });
  });

  it('refresh button calls getAccount and updates balance', async () => {
    const getAccountSpy = vi.spyOn(api, 'getAccount').mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        account_id: 'ACC-1001',
        balance_paise: 6000000,
        history: []
      },
      error: null
    });

    render(
      <AppProvider initialValue={{ account: { account_id: 'ACC-1001', balance_paise: 5000000 } }}>
        <AccountCard />
      </AppProvider>
    );

    const refreshBtn = screen.getByTitle('Refresh account data');
    fireEvent.click(refreshBtn);

    await waitFor(() => {
      expect(getAccountSpy).toHaveBeenCalled();
    });
  });
});

describe('ConfirmTransfer component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('does not render if verdict is not APPROVED or intent_token is null', () => {
    const { container: c1 } = render(
      <AppProvider initialValue={{ verdict: null }}>
        <ConfirmTransfer />
      </AppProvider>
    );
    expect(c1.firstChild).toBeNull();

    const { container: c2 } = render(
      <AppProvider
        initialValue={{
          verdict: {
            decision: 'BLOCKED',
            intent_token: 'tok_blocked'
          }
        }}
      >
        <ConfirmTransfer />
      </AppProvider>
    );
    expect(c2.firstChild).toBeNull();

    const { container: c3 } = render(
      <AppProvider
        initialValue={{
          verdict: {
            decision: 'APPROVED',
            intent_token: null
          }
        }}
      >
        <ConfirmTransfer />
      </AppProvider>
    );
    expect(c3.firstChild).toBeNull();
  });

  it('renders locked intent details, countdown, and calls execute with token only', async () => {
    const executeSpy = vi.spyOn(api, 'execute').mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        status: 'executed',
        receipt: { id: 'rcpt_789', amount_paise: 50000 },
        balance_paise: 4500000
      },
      error: null
    });

    const getAccountSpy = vi.spyOn(api, 'getAccount').mockResolvedValue({
      ok: true,
      data: { account_id: 'ACC-1001', balance_paise: 4500000, history: [] }
    });

    const verdict = {
      decision: 'APPROVED',
      intent_token: 'test_token_signature_abc',
      timestamp: Date.now(),
      extracted_intent: {
        action: 'TRANSFER',
        recipient_name: 'Rahul Sharma',
        amount_paise: 50000
      }
    };

    render(
      <AppProvider initialValue={{ verdict }}>
        <ConfirmTransfer />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Intent locked')).toBeInTheDocument();
      expect(screen.getByText('Rahul Sharma')).toBeInTheDocument();
      expect(screen.getByText('₹500.00')).toBeInTheDocument();
      expect(screen.getByText(/120s remaining/i)).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /Confirm & send/i });
    expect(confirmButton).toBeEnabled();

    fireEvent.click(confirmButton);

    await waitFor(() => {
      // Must call execute with the intent_token only!
      expect(executeSpy).toHaveBeenCalledWith('test_token_signature_abc');
      expect(screen.getByText(/Transfer Executed Successfully/i)).toBeInTheDocument();
      expect(screen.getByText(/Receipt ID: rcpt_789/i)).toBeInTheDocument();
      expect(getAccountSpy).toHaveBeenCalled();
    });

    // Button should be disabled after execution
    expect(confirmButton).toBeDisabled();
  });

  it('handles rejected transfer response and displays reason', async () => {
    vi.spyOn(api, 'execute').mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        status: 'rejected',
        reason: 'TOKEN_REPLAYED'
      },
      error: null
    });

    vi.spyOn(api, 'getAccount').mockResolvedValue({ ok: true, data: null });

    const verdict = {
      decision: 'APPROVED',
      intent_token: 'token_replay_attack',
      timestamp: Date.now(),
      extracted_intent: {
        recipient_name: 'Amit Verma',
        amount_paise: 200000
      }
    };

    render(
      <AppProvider initialValue={{ verdict }}>
        <ConfirmTransfer />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Amit Verma')).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /Confirm & send/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(/Transfer Rejected/i)).toBeInTheDocument();
      expect(screen.getByText(/Reason: TOKEN_REPLAYED/i)).toBeInTheDocument();
    });

    expect(confirmButton).toBeDisabled();
  });

  it('dismisses card when Cancel is clicked', async () => {
    const verdict = {
      decision: 'APPROVED',
      intent_token: 'token_to_cancel',
      timestamp: Date.now(),
      extracted_intent: { recipient_name: 'Priya', amount_paise: 10000 }
    };

    render(
      <AppProvider initialValue={{ verdict }}>
        <ConfirmTransfer />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Intent locked')).toBeInTheDocument();
    });

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelBtn);

    await waitFor(() => {
      expect(screen.queryByText('Intent locked')).not.toBeInTheDocument();
    });
  });

  it('disables button when token has expired', async () => {
    const expiredVerdict = {
      decision: 'APPROVED',
      intent_token: 'expired_token',
      timestamp: Date.now() - 130000, // 130 seconds ago (>120s)
      extracted_intent: { recipient_name: 'Priya', amount_paise: 10000 }
    };

    render(
      <AppProvider initialValue={{ verdict: expiredVerdict }}>
        <ConfirmTransfer />
      </AppProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Token Expired')).toBeInTheDocument();
    });

    const confirmButton = screen.getByRole('button', { name: /Confirm & send/i });
    expect(confirmButton).toBeDisabled();
    expect(screen.getByText(/Intent token has expired/i)).toBeInTheDocument();
  });
});
