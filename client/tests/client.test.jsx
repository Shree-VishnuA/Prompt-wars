import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import App from '../src/App.jsx';
import * as api from '../src/api/client.js';

describe('Client API wrappers and App heading', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders placeholder Bankism heading', () => {
    render(<App />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bankism');
  });

  it('handles successful API calls returning { ok: true, status: 200, data, error: null }', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (h) => (h.toLowerCase() === 'content-type' ? 'application/json' : null)
      },
      json: async () => ({ status: 'ok', service: 'bankism' })
    });

    const res = await api.getHealth();
    expect(res).toEqual({
      ok: true,
      status: 200,
      data: { status: 'ok', service: 'bankism' },
      error: null
    });
  });

  it('handles API errors without throwing, returning { ok: false, status, data, error }', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      headers: {
        get: (h) => (h.toLowerCase() === 'content-type' ? 'application/json' : null)
      },
      json: async () => ({ error: 'MALFORMED_INPUT' })
    });

    const res = await api.analyze({ instruction: '' });
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
    expect(res.data).toEqual({ error: 'MALFORMED_INPUT' });
    expect(res.error).toBe('MALFORMED_INPUT');
  });

  it('handles network failure without throwing', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    const res = await api.getAccount();
    expect(res.ok).toBe(false);
    expect(res.status).toBe(0);
    expect(res.data).toBeNull();
    expect(res.error).toBe('Failed to fetch');
  });

  it('provides all required wrappers', () => {
    expect(typeof api.analyze).toBe('function');
    expect(typeof api.execute).toBe('function');
    expect(typeof api.getAccount).toBe('function');
    expect(typeof api.getHealth).toBe('function');
    expect(typeof api.getAudit).toBe('function');
    expect(typeof api.labMutate).toBe('function');
    expect(typeof api.labCases).toBe('function');
    expect(typeof api.labBenchmark).toBe('function');
    expect(typeof api.authGuest).toBe('function');
    expect(typeof api.authMe).toBe('function');
    expect(typeof api.authGoogle).toBe('function');
    expect(typeof api.authLogout).toBe('function');
  });
});
