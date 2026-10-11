import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import {
  getBank,
  getBalance,
  getHistory,
  findContact,
  transfer,
  resetBank,
  BankError,
  PER_TRANSFER_LIMIT_PAISE
} from '../src/lib/mockBank.js';
import { createApp } from '../src/app.js';

describe('MockBank In-Memory Service', () => {
  beforeEach(() => {
    resetBank('usr_demo');
    resetBank('usr_test');
  });

  describe('Seed values and baseline queries', () => {
    it('initializes bank state with expected seed contract', () => {
      const bank = getBank('usr_demo');

      expect(bank.user).toBe('usr_demo');
      expect(bank.account_id).toBe('ACC-1001');
      expect(bank.balance_paise).toBe(5000000); // Rs 50,000
      expect(bank.contacts).toHaveLength(4);
      expect(bank.history).toHaveLength(8);

      expect(bank.contacts.map((c) => c.alias)).toEqual(['rahul', 'priya', 'amit', 'mom']);
    });

    it('getBalance and getHistory return current balance and limited entries', () => {
      expect(getBalance('usr_demo')).toBe(5000000);

      const history5 = getHistory('usr_demo', 5);
      expect(history5).toHaveLength(5);
      expect(history5[0]).toHaveProperty('id');
      expect(history5[0]).toHaveProperty('type');
      expect(history5[0]).toHaveProperty('amount_paise');
    });
  });

  describe('findContact search and ambiguity resolution', () => {
    it('matches contacts by alias or full name case-insensitively', () => {
      const byAlias = findContact('usr_demo', 'rahul');
      expect(byAlias).not.toBeNull();
      expect(byAlias?.id).toBe('c_rahul');

      const byUpperAlias = findContact('usr_demo', 'PRIYA');
      expect(byUpperAlias?.id).toBe('c_priya');

      const byPartialName = findContact('usr_demo', 'Sharma');
      expect(byPartialName?.id).toBe('c_rahul');

      const byMom = findContact('usr_demo', 'Mom');
      expect(byMom?.id).toBe('c_mom');
    });

    it('returns null when search term matches multiple contacts (ambiguous)', () => {
      // Both "Rahul Sharma" and "Amit Verma" contain "ma"
      const ambiguous = findContact('usr_demo', 'ma');
      expect(ambiguous).toBeNull();
    });

    it('returns null for non-matching or empty queries', () => {
      expect(findContact('usr_demo', 'nonexistent_user')).toBeNull();
      expect(findContact('usr_demo', '')).toBeNull();
      expect(findContact('usr_demo', null)).toBeNull();
    });
  });

  describe('Transfer execution and validation rules', () => {
    it('executes transfer successfully, updates balance, and appends history', () => {
      const initialBalance = getBalance('usr_demo');
      const amount = 50000; // Rs 500

      const receipt = transfer('usr_demo', {
        recipient_id: 'c_rahul',
        amount_paise: amount,
        memo: 'Lunch payment'
      });

      expect(receipt).toHaveProperty('receipt_id');
      expect(receipt.recipient_id).toBe('c_rahul');
      expect(receipt.recipient_name).toBe('Rahul Sharma');
      expect(receipt.amount_paise).toBe(amount);
      expect(receipt.balance_paise).toBe(initialBalance - amount);
      expect(receipt.memo).toBe('Lunch payment');

      expect(getBalance('usr_demo')).toBe(initialBalance - amount);

      const latestHistory = getHistory('usr_demo', 1);
      expect(latestHistory[0].amount_paise).toBe(amount);
      expect(latestHistory[0].type).toBe('DEBIT');
      expect(latestHistory[0].counterparty).toBe('Rahul Sharma');
      expect(latestHistory[0].memo).toBe('Lunch payment');
    });

    it('throws error for non-integer or invalid amounts', () => {
      expect(() => {
        transfer('usr_demo', { recipient_id: 'c_rahul', amount_paise: 0 });
      }).toThrowError(BankError);

      expect(() => {
        transfer('usr_demo', { recipient_id: 'c_rahul', amount_paise: -500 });
      }).toThrowError(BankError);

      expect(() => {
        transfer('usr_demo', { recipient_id: 'c_rahul', amount_paise: 12.5 });
      }).toThrowError(BankError);

      expect(() => {
        transfer('usr_demo', { recipient_id: 'c_rahul', amount_paise: '500' });
      }).toThrowError(BankError);
    });

    it('throws error when amount exceeds maximum per-transfer limit', () => {
      expect(() => {
        transfer('usr_demo', {
          recipient_id: 'c_rahul',
          amount_paise: PER_TRANSFER_LIMIT_PAISE + 1
        });
      }).toThrowError(BankError);

      try {
        transfer('usr_demo', {
          recipient_id: 'c_rahul',
          amount_paise: 2500001
        });
      } catch (err) {
        expect(err).toBeInstanceOf(BankError);
        expect(err.code).toBe('LIMIT_EXCEEDED');
      }
    });

    it('throws error for insufficient funds', () => {
      // First spend down within transfer limit
      transfer('usr_demo', { recipient_id: 'c_rahul', amount_paise: 2500000 });
      transfer('usr_demo', { recipient_id: 'c_rahul', amount_paise: 2400000 });
      // Remaining is 100000 paise

      expect(() => {
        transfer('usr_demo', { recipient_id: 'c_rahul', amount_paise: 150000 });
      }).toThrowError(BankError);

      try {
        transfer('usr_demo', { recipient_id: 'c_rahul', amount_paise: 150000 });
      } catch (err) {
        expect(err).toBeInstanceOf(BankError);
        expect(err.code).toBe('INSUFFICIENT_FUNDS');
      }
    });
  });

  describe('GET /api/bank/account endpoint', () => {
    const app = createApp();

    it('returns 200 with full seeded account structure', async () => {
      const res = await request(app).get('/api/bank/account');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        user: 'usr_demo',
        account_id: 'ACC-1001',
        balance_paise: 5000000,
        contacts: expect.any(Array),
        history: expect.any(Array)
      });
      expect(res.body.contacts).toHaveLength(4);
      expect(res.body.history.length).toBeGreaterThanOrEqual(8);
    });
  });
});
