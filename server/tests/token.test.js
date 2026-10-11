import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  mintIntentToken,
  verifyIntentToken,
  consumeNonce,
  clearUsedNonces
} from '../src/lib/token.js';

describe('token.js - mintIntentToken & verifyIntentToken & consumeNonce', () => {
  beforeEach(() => {
    clearUsedNonces();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('valid flow: mints and verifies valid token with correct payload fields', () => {
    const token = mintIntentToken({
      userId: 'usr_demo',
      action: 'TRANSFER',
      recipient_id: 'c_rahul',
      amount_paise: 50000,
      memo_hash: 'abc123hash'
    });

    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(2);

    const result = verifyIntentToken(token);
    expect(result.valid).toBe(true);
    expect(result.payload).toBeDefined();
    expect(result.payload.uid).toBe('usr_demo');
    expect(result.payload.act).toBe('TRANSFER');
    expect(result.payload.rid).toBe('c_rahul');
    expect(result.payload.amt).toBe(50000);
    expect(result.payload.mh).toBe('abc123hash');
    expect(typeof result.payload.nonce).toBe('string');
    expect(result.payload.nonce).toHaveLength(32); // 16 random bytes in hex
    expect(typeof result.payload.exp).toBe('number');
  });

  it('rejects tampered payload', () => {
    const token = mintIntentToken({
      userId: 'usr_demo',
      recipient_id: 'c_rahul',
      amount_paise: 50000
    });

    const [payloadB64, sig] = token.split('.');
    const decodedPayload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    // Attacker modifies amount from 50000 to 5000000
    decodedPayload.amt = 5000000;
    const tamperedPayloadB64 = Buffer.from(JSON.stringify(decodedPayload)).toString('base64url');
    const tamperedToken = `${tamperedPayloadB64}.${sig}`;

    const result = verifyIntentToken(tamperedToken);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE');
  });

  it('rejects tampered signature', () => {
    const token = mintIntentToken({
      userId: 'usr_demo',
      recipient_id: 'c_rahul',
      amount_paise: 50000
    });

    const [payloadB64, sig] = token.split('.');
    // Modify one character in signature
    const tamperedSig = sig.slice(0, -1) + (sig.slice(-1) === 'a' ? 'b' : 'a');
    const tamperedToken = `${payloadB64}.${tamperedSig}`;

    const result = verifyIntentToken(tamperedToken);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('INVALID_SIGNATURE');
  });

  it('rejects expired token using vi.useFakeTimers', () => {
    vi.useFakeTimers();
    const token = mintIntentToken({
      userId: 'usr_demo',
      recipient_id: 'c_rahul',
      amount_paise: 50000
    });

    // Advance 60 seconds -> still valid
    vi.advanceTimersByTime(60 * 1000);
    let result = verifyIntentToken(token);
    expect(result.valid).toBe(true);

    // Advance another 61 seconds (total 121 seconds -> expired)
    vi.advanceTimersByTime(61 * 1000);
    result = verifyIntentToken(token);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('TOKEN_EXPIRED');
  });

  it('rejects malformed token strings and types', () => {
    expect(verifyIntentToken(null).valid).toBe(false);
    expect(verifyIntentToken(null).reason).toBe('MALFORMED_TOKEN');
    expect(verifyIntentToken('').valid).toBe(false);
    expect(verifyIntentToken('not-a-token').valid).toBe(false);
    expect(verifyIntentToken('one.two.three').valid).toBe(false);
    expect(verifyIntentToken('invalid_base64.signature').valid).toBe(false);
  });

  it('handles nonce tracking and detects replays', () => {
    const nonce = 'abcd1234efgh5678';
    // First consume -> returns true
    expect(consumeNonce(nonce)).toBe(true);

    // Second consume (replay) -> returns false
    expect(consumeNonce(nonce)).toBe(false);

    // Another distinct nonce works
    expect(consumeNonce('different-nonce-9999')).toBe(true);
  });

  it('cleans expired nonces on expiry', () => {
    vi.useFakeTimers();
    const nonce = 'expiring-nonce-1234';
    expect(consumeNonce(nonce)).toBe(true);
    expect(consumeNonce(nonce)).toBe(false);

    // Fast-forward 125 seconds past expiry
    vi.advanceTimersByTime(125 * 1000);

    // Now previous entry was cleaned, so consuming it again is accepted
    expect(consumeNonce(nonce)).toBe(true);
  });
});
