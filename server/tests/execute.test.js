import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { mintIntentToken, clearUsedNonces } from '../src/lib/token.js';
import { resetBank, getBank, getBalance } from '../src/lib/mockBank.js';

describe('POST /api/execute endpoint', () => {
  const app = createApp();

  beforeEach(() => {
    resetBank();
    clearUsedNonces();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('valid flow: executes transfer successfully with valid intent token', async () => {
    const initialBalance = getBalance('usr_demo');
    const token = mintIntentToken({
      userId: 'usr_demo',
      action: 'TRANSFER',
      recipient_id: 'c_rahul',
      amount_paise: 50000
    });

    const res = await request(app)
      .post('/api/execute')
      .send({ intent_token: token });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('executed');
    expect(res.body.receipt).toBeDefined();
    expect(res.body.receipt.recipient_id).toBe('c_rahul');
    expect(res.body.receipt.amount_paise).toBe(50000);
    expect(res.body.balance_paise).toBe(initialBalance - 50000);
    expect(getBalance('usr_demo')).toBe(initialBalance - 50000);
  });

  it('rejects tampered payload', async () => {
    const token = mintIntentToken({
      userId: 'usr_demo',
      recipient_id: 'c_rahul',
      amount_paise: 50000
    });

    const [payloadB64, sig] = token.split('.');
    const decoded = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    decoded.amt = 100000;
    const tamperedPayloadB64 = Buffer.from(JSON.stringify(decoded)).toString('base64url');
    const tamperedToken = `${tamperedPayloadB64}.${sig}`;

    const res = await request(app)
      .post('/api/execute')
      .send({ intent_token: tamperedToken });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
    expect(res.body.reason).toBe('INVALID_SIGNATURE');
  });

  it('rejects tampered signature', async () => {
    const token = mintIntentToken({
      userId: 'usr_demo',
      recipient_id: 'c_rahul',
      amount_paise: 50000
    });

    const [payloadB64] = token.split('.');
    // Replace signature with a completely different fixed string (wrong HMAC)
    const tamperedToken = `${payloadB64}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;

    const res = await request(app)
      .post('/api/execute')
      .send({ intent_token: tamperedToken });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
    expect(res.body.reason).toBe('INVALID_SIGNATURE');
  });


  it('rejects expired token using vi.useFakeTimers', async () => {
    vi.useFakeTimers();
    const token = mintIntentToken({
      userId: 'usr_demo',
      recipient_id: 'c_rahul',
      amount_paise: 50000
    });

    // Advance 125 seconds past expiry
    vi.advanceTimersByTime(125 * 1000);

    const res = await request(app)
      .post('/api/execute')
      .send({ intent_token: token });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
    expect(res.body.reason).toBe('TOKEN_EXPIRED');
  });

  it('rejects replayed token on second execution', async () => {
    const token = mintIntentToken({
      userId: 'usr_demo',
      recipient_id: 'c_rahul',
      amount_paise: 50000
    });

    // First call -> executed
    const res1 = await request(app)
      .post('/api/execute')
      .send({ intent_token: token });

    expect(res1.status).toBe(200);
    expect(res1.body.status).toBe('executed');

    // Second call -> replayed
    const res2 = await request(app)
      .post('/api/execute')
      .send({ intent_token: token });

    expect(res2.status).toBe(200);
    expect(res2.body.status).toBe('rejected');
    expect(res2.body.reason).toBe('TOKEN_REPLAYED');
  });

  it('rejects transfer when balance is insufficient', async () => {
    const bank = getBank('usr_poor');
    bank.balance_paise = 1000; // Rs 10

    const token = mintIntentToken({
      userId: 'usr_poor',
      recipient_id: 'c_rahul',
      amount_paise: 5000 // Rs 50 > Rs 10
    });

    const res = await request(app)
      .post('/api/execute')
      .send({ intent_token: token });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
    expect(res.body.reason).toBe('INSUFFICIENT_FUNDS');
  });

  it('ignores body fields other than intent_token and uses ONLY token values', async () => {
    const initialBalance = getBalance('usr_demo');
    const token = mintIntentToken({
      userId: 'usr_demo',
      recipient_id: 'c_priya',
      amount_paise: 25000
    });

    // Malicious body attempts to override amount, recipient, and user
    const res = await request(app)
      .post('/api/execute')
      .send({
        intent_token: token,
        amount_paise: 999999999,
        recipient_id: 'c_hacker',
        userId: 'usr_attacker'
      });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('executed');
    expect(res.body.receipt.recipient_id).toBe('c_priya');
    expect(res.body.receipt.amount_paise).toBe(25000);
    expect(res.body.balance_paise).toBe(initialBalance - 25000);
  });

  it('returns HTTP 400 on malformed request bodies', async () => {
    // Missing intent_token
    const resEmpty = await request(app)
      .post('/api/execute')
      .send({});
    expect(resEmpty.status).toBe(400);

    // Empty string intent_token
    const resEmptyToken = await request(app)
      .post('/api/execute')
      .send({ intent_token: '' });
    expect(resEmptyToken.status).toBe(400);

    // Wrong type for intent_token
    const resWrongType = await request(app)
      .post('/api/execute')
      .send({ intent_token: 12345 });
    expect(resWrongType.status).toBe(400);
  });
});
