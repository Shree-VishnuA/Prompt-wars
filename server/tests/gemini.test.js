import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { callGemini, getLlmStatus, resetCircuitBreaker } from '../src/lib/gemini.js';
import { config } from '../src/config.js';

describe('Gemini Client & Circuit Breaker (gemini.js)', () => {
  const originalApiKey = config.geminiApiKey;

  beforeEach(() => {
    resetCircuitBreaker();
    config.geminiApiKey = 'test-api-key-123';
    config.GEMINI_API_KEY = 'test-api-key-123';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    config.geminiApiKey = originalApiKey;
    config.GEMINI_API_KEY = originalApiKey;
  });

  it('1. returns NO_KEY when API key is missing, and status is "disabled"', async () => {
    config.geminiApiKey = '';
    config.GEMINI_API_KEY = '';

    expect(getLlmStatus()).toBe('disabled');
    const res = await callGemini({ system: 'system', user: 'user' });
    expect(res).toEqual({ ok: false, reason: 'NO_KEY' });
  });

  it('2. successfully parses raw JSON response and status is "online"', async () => {
    const mockPayload = { action: 'TRANSFER', amount_text: '500', confidence: 0.99 };

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(mockPayload) }]
            }
          }
        ]
      })
    }));

    const res = await callGemini({ system: 'system', user: 'user' });
    expect(res).toEqual({ ok: true, json: mockPayload });
    expect(getLlmStatus()).toBe('online');
  });

  it('3. strips markdown code fences (```json ... ```) before parsing', async () => {
    const mockPayload = { threat_category: 'BENIGN', is_malicious: false };
    const fencedText = `\`\`\`json\n${JSON.stringify(mockPayload)}\n\`\`\``;

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: fencedText }]
            }
          }
        ]
      })
    }));

    const res = await callGemini({ system: 'system', user: 'user' });
    expect(res).toEqual({ ok: true, json: mockPayload });
  });

  it('4. returns BAD_JSON when response is unparseable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: 'This is not valid json at all!' }]
            }
          }
        ]
      })
    }));

    const res = await callGemini({ system: 'system', user: 'user' });
    expect(res).toEqual({ ok: false, reason: 'BAD_JSON' });
  });

  it('5. retries on 429 and succeeds on second attempt', async () => {
    const mockPayload = { action: 'BALANCE_INQUIRY' };

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({ error: 'Rate limit' })
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(mockPayload) }]
              }
            }
          ]
        })
      });

    vi.stubGlobal('fetch', fetchMock);

    const res = await callGemini({ system: 'system', user: 'user' });
    expect(res).toEqual({ ok: true, json: mockPayload });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('6. returns TIMEOUT on request abort', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      return Promise.reject(err);
    }));

    const res = await callGemini({ system: 'system', user: 'user', timeoutMs: 50 });
    expect(res).toEqual({ ok: false, reason: 'TIMEOUT' });
  });

  it('7. returns SAFETY_BLOCK on promptFeedback block or finishReason SAFETY', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        candidates: [
          {
            finishReason: 'SAFETY',
            content: { parts: [{ text: '' }] }
          }
        ]
      })
    }));

    const res = await callGemini({ system: 'system', user: 'user' });
    expect(res).toEqual({ ok: false, reason: 'SAFETY_BLOCK' });
  });

  it('8. opens circuit breaker after 3 consecutive failures, returning CIRCUIT_OPEN immediately', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Server Error' })
    }));

    // Failures 1, 2, 3
    const res1 = await callGemini({ system: 's', user: 'u' });
    expect(res1.ok).toBe(false);

    const res2 = await callGemini({ system: 's', user: 'u' });
    expect(res2.ok).toBe(false);

    const res3 = await callGemini({ system: 's', user: 'u' });
    expect(res3.ok).toBe(false);

    // 4th call: Circuit is open!
    expect(getLlmStatus()).toBe('degraded');
    const res4 = await callGemini({ system: 's', user: 'u' });
    expect(res4).toEqual({ ok: false, reason: 'CIRCUIT_OPEN' });
  });
});
