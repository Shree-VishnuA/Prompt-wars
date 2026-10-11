import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import RequestForm, { SAMPLE_PROMPTS } from '../components/RequestForm.jsx';
import { AppProvider } from '../context/AppContext.jsx';
import * as api from '../api/client.js';

// Mock api client
vi.mock('../api/client.js', () => ({
  analyze: vi.fn(),
  authMe: vi.fn(),
  getHealth: vi.fn(),
  getAccount: vi.fn(),
  authGuest: vi.fn(),
  authLogout: vi.fn(),
  authGoogle: vi.fn(),
  execute: vi.fn(),
  getAudit: vi.fn(),
  labCases: vi.fn(),
  labMutate: vi.fn(),
  labBenchmark: vi.fn()
}));

describe('RequestForm Component Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.authMe.mockResolvedValue({ ok: true, data: null });
    api.getHealth.mockResolvedValue({
      ok: true,
      data: { status: 'ok', llm: 'online', policy_version: '1.0.0' }
    });
    api.getAccount.mockResolvedValue({ ok: true, data: null });
    api.analyze.mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        request_id: 'req_test_123',
        decision: 'APPROVED',
        threat_category: 'BENIGN',
        risk_score: 5,
        risk_level: 'LOW',
        rationale: 'Clean test request'
      }
    });
  });

  it('button disabled when empty instruction input', async () => {
    render(
      <AppProvider>
        <RequestForm />
      </AppProvider>
    );

    const instructionInput = screen.getByTestId('instruction-input');
    const analyzeButton = screen.getByTestId('analyze-button');

    // Initially empty
    expect(instructionInput.value).toBe('');
    expect(analyzeButton).toBeDisabled();

    // Whitespace only should remain disabled
    fireEvent.change(instructionInput, { target: { value: '    ' } });
    expect(analyzeButton).toBeDisabled();

    // Non-empty instruction enables button
    fireEvent.change(instructionInput, { target: { value: 'Check account balance' } });
    expect(analyzeButton).toBeEnabled();

    // Clearing instruction disables button again
    fireEvent.change(instructionInput, { target: { value: '' } });
    expect(analyzeButton).toBeDisabled();
  });

  it('chips fill the fields with sample instruction and memo', async () => {
    render(
      <AppProvider>
        <RequestForm />
      </AppProvider>
    );

    const instructionInput = screen.getByTestId('instruction-input');
    const memoInput = screen.getByTestId('memo-input');
    const analyzeButton = screen.getByTestId('analyze-button');

    // Find and click the "Transfer to Priya ₹750" benign sample chip
    const priyaChip = SAMPLE_PROMPTS.find((s) => s.label.includes('Transfer to Priya'));
    expect(priyaChip).toBeDefined();

    const priyaButton = screen.getByRole('button', { name: new RegExp(priyaChip.label, 'i') });
    fireEvent.click(priyaButton);

    // Fields should be populated
    expect(instructionInput.value).toBe(priyaChip.instruction);
    expect(memoInput.value).toBe(priyaChip.memo);
    expect(analyzeButton).toBeEnabled();

    // Find and click the "Memo Injection" attack chip
    const attackChip = SAMPLE_PROMPTS.find((s) => s.label === 'Memo Injection');
    expect(attackChip).toBeDefined();

    const attackButton = screen.getByRole('button', { name: /Memo Injection/i });
    fireEvent.click(attackButton);

    expect(instructionInput.value).toBe(attackChip.instruction);
    expect(memoInput.value).toBe(attackChip.memo);
  });

  it('submit calls analyze via button click', async () => {
    render(
      <AppProvider>
        <RequestForm />
      </AppProvider>
    );

    const instructionInput = screen.getByTestId('instruction-input');
    const memoInput = screen.getByTestId('memo-input');
    const analyzeButton = screen.getByTestId('analyze-button');

    fireEvent.change(instructionInput, { target: { value: 'Transfer 500 to Bob' } });
    fireEvent.change(memoInput, { target: { value: 'lunch payment' } });

    await act(async () => {
      fireEvent.click(analyzeButton);
    });

    expect(api.analyze).toHaveBeenCalledTimes(1);
    expect(api.analyze).toHaveBeenCalledWith({
      instruction: 'Transfer 500 to Bob',
      memo: 'lunch payment'
    });
  });

  it('submit calls analyze via Ctrl+Enter and Cmd+Enter shortcut', async () => {
    render(
      <AppProvider>
        <RequestForm />
      </AppProvider>
    );

    const instructionInput = screen.getByTestId('instruction-input');
    fireEvent.change(instructionInput, { target: { value: 'Show my balance' } });

    // Press Ctrl+Enter
    await act(async () => {
      fireEvent.keyDown(instructionInput, { key: 'Enter', ctrlKey: true });
    });

    expect(api.analyze).toHaveBeenCalledWith({
      instruction: 'Show my balance',
      memo: ''
    });

    // Press Cmd+Enter (metaKey)
    await act(async () => {
      fireEvent.keyDown(instructionInput, { key: 'Enter', metaKey: true });
    });

    expect(api.analyze).toHaveBeenCalledTimes(2);
  });
});
