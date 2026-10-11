import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import {
  clearSessions,
  createSession,
  getSession,
  getSessionsCount,
  SESSION_TTL_MS,
  MAX_SESSIONS
} from '../src/lib/sessions.js';
import { resetBank, getBank } from '../src/lib/mockBank.js';

const mockVerifyIdToken = vi.fn();

vi.mock('google-auth-library', () => {
  return {
    OAuth2Client: class {
      constructor(clientId) {
        this.clientId = clientId;
      }
      verifyIdToken(...args) {
        return mockVerifyIdToken(...args);
      }
    }
  };
});

describe('Authentication & Session Management', () => {
  let app;
  const originalGoogleClientId = config.googleClientId;

  beforeEach(() => {
    clearSessions();
    resetBank();
    app = createApp();
    config.googleClientId = 'mock-google-client-id-123.apps.googleusercontent.com';
    config.GOOGLE_CLIENT_ID = 'mock-google-client-id-123.apps.googleusercontent.com';
    mockVerifyIdToken.mockReset();
  });

  afterEach(() => {
    config.googleClientId = originalGoogleClientId;
    config.GOOGLE_CLIENT_ID = originalGoogleClientId;
    clearSessions();
    resetBank();
  });

  describe('sessions.js unit tests', () => {
    it('creates and retrieves a valid session', () => {
      const sid = createSession({
        id: 'user_1',
        name: 'Test User',
        email: 'test@example.com',
        picture: null,
        kind: 'guest'
      });
      expect(sid).toBeTruthy();

      const session = getSession(sid);
      expect(session).toBeTruthy();
      expect(session.user.id).toBe('user_1');
      expect(session.user.name).toBe('Test User');
      expect(session.user.email).toBe('test@example.com');
      expect(session.user.kind).toBe('guest');
      expect(typeof session.createdAt).toBe('number');
    });

    it('expires sessions after 6 hours TTL', () => {
      vi.useFakeTimers();
      try {
        const sid = createSession({ id: 'u_ttl', name: 'TTL User', kind: 'guest' });
        expect(getSession(sid)).toBeTruthy();

        // Advance past 6 hours (6 hours + 1 minute)
        vi.advanceTimersByTime(SESSION_TTL_MS + 60 * 1000);
        expect(getSession(sid)).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it('enforces maximum 500 sessions and evicts oldest FIFO', () => {
      const firstSid = createSession({ id: 'first_user', kind: 'guest' });
      expect(getSession(firstSid)).toBeTruthy();

      // Create 500 more sessions to push the first one out
      for (let i = 1; i <= MAX_SESSIONS; i++) {
        createSession({ id: `user_${i}`, kind: 'guest' });
      }

      expect(getSessionsCount()).toBe(MAX_SESSIONS);
      expect(getSession(firstSid)).toBeNull(); // Evicted
    });
  });

  describe('Guest Authentication Flow', () => {
    it('POST /api/auth/guest creates guest session and sets httpOnly signed cookie', async () => {
      const res = await request(app)
        .post('/api/auth/guest')
        .expect(200);

      expect(res.body.user).toBeDefined();
      expect(res.body.user.kind).toBe('guest');
      expect(res.body.user.id).toMatch(/^guest_/);
      expect(res.body.user.name).toBe('Guest User');
      expect(res.body.user.email).toBeNull();
      expect(res.body.user.picture).toBeNull();

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.includes('bk_sid='))).toBe(true);
      expect(cookies.some((c) => c.toLowerCase().includes('httponly'))).toBe(true);
      expect(cookies.some((c) => c.toLowerCase().includes('samesite=lax'))).toBe(true);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns current user and auth info when session cookie is provided', async () => {
      const guestRes = await request(app)
        .post('/api/auth/guest')
        .expect(200);

      const cookie = guestRes.headers['set-cookie'];

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie)
        .expect(200);

      expect(meRes.body.user).toBeDefined();
      expect(meRes.body.user.id).toBe(guestRes.body.user.id);
      expect(meRes.body.user.kind).toBe('guest');
      expect(meRes.body.auth).toBeDefined();
      expect(meRes.body.auth.google_enabled).toBe(true);
    });

    it('creates a guest session automatically when no session cookie is provided', async () => {
      const meRes = await request(app)
        .get('/api/auth/me')
        .expect(200);

      expect(meRes.body.user).toBeDefined();
      expect(meRes.body.user.kind).toBe('guest');
      expect(meRes.body.user.id).toMatch(/^guest_/);
      expect(meRes.body.auth.google_enabled).toBe(true);

      const cookies = meRes.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.includes('bk_sid='))).toBe(true);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('clears session in memory and clears cookie', async () => {
      const guestRes = await request(app)
        .post('/api/auth/guest')
        .expect(200);

      const cookie = guestRes.headers['set-cookie'];

      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Cookie', cookie)
        .expect(200);

      expect(logoutRes.body).toEqual({ ok: true });

      // After logout, me request without old cookie creates a new session
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie)
        .expect(200);

      expect(meRes.body.user.id).not.toBe(guestRes.body.user.id);
    });
  });

  describe('Google OAuth Flow', () => {
    it('returns 503 GOOGLE_AUTH_DISABLED when GOOGLE_CLIENT_ID is not configured', async () => {
      config.googleClientId = '';
      config.GOOGLE_CLIENT_ID = '';
      const origEnv = process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_ID;

      try {
        const res = await request(app)
          .post('/api/auth/google')
          .send({ credential: 'mock-google-credential' })
          .expect(503);

        expect(res.body).toEqual({ error: 'GOOGLE_AUTH_DISABLED' });
      } finally {
        if (origEnv !== undefined) {
          process.env.GOOGLE_CLIENT_ID = origEnv;
        }
      }
    });

    it('authenticates successfully with valid mocked Google ID token', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({
          sub: 'google_sub_12345',
          name: 'Jane Doe',
          email: 'jane@example.com',
          email_verified: true,
          picture: 'https://lh3.googleusercontent.com/photo.jpg'
        })
      });

      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'valid-google-id-token' })
        .expect(200);

      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBe('g_google_sub_12345');
      expect(res.body.user.name).toBe('Jane Doe');
      expect(res.body.user.email).toBe('jane@example.com');
      expect(res.body.user.picture).toBe('https://lh3.googleusercontent.com/photo.jpg');
      expect(res.body.user.kind).toBe('google');

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies.some((c) => c.includes('bk_sid='))).toBe(true);

      // Verify session works with /api/auth/me
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookies)
        .expect(200);

      expect(meRes.body.user.id).toBe('g_google_sub_12345');
      expect(meRes.body.user.kind).toBe('google');
    });

    it('returns 401 when Google token verification fails (invalid token)', async () => {
      mockVerifyIdToken.mockRejectedValueOnce(new Error('Invalid token signature'));

      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'forged-token' })
        .expect(401);

      expect(res.body.error).toBe('INVALID_TOKEN');
    });

    it('returns 401 when Google token email is not verified', async () => {
      mockVerifyIdToken.mockResolvedValueOnce({
        getPayload: () => ({
          sub: 'google_sub_unverified',
          email: 'unverified@example.com',
          email_verified: false
        })
      });

      const res = await request(app)
        .post('/api/auth/google')
        .send({ credential: 'unverified-email-token' })
        .expect(401);

      expect(res.body.error).toBe('EMAIL_NOT_VERIFIED');
    });

    it('returns 400 when credential payload is missing or invalid', async () => {
      const res = await request(app)
        .post('/api/auth/google')
        .send({})
        .expect(400);

      expect(res.body.error).toBe('MALFORMED_INPUT');
    });
  });

  describe('Session Isolation between Users', () => {
    it('isolates bank state and balances between distinct user sessions', async () => {
      // 1. Create Guest User A
      const resA = await request(app).post('/api/auth/guest').expect(200);
      const cookieA = resA.headers['set-cookie'];
      const userA = resA.body.user;

      // 2. Create Guest User B
      const resB = await request(app).post('/api/auth/guest').expect(200);
      const cookieB = resB.headers['set-cookie'];
      const userB = resB.body.user;

      expect(userA.id).not.toBe(userB.id);

      // Both start with 5,000,000 paise (50,000 INR)
      const bankA1 = await request(app).get('/api/bank/account').set('Cookie', cookieA).expect(200);
      const bankB1 = await request(app).get('/api/bank/account').set('Cookie', cookieB).expect(200);
      expect(bankA1.body.balance_paise).toBe(5000000);
      expect(bankB1.body.balance_paise).toBe(5000000);

      // User A analyzes a transfer of ₹1,000 (100,000 paise) to Rahul
      const analyzeResA = await request(app)
        .post('/api/analyze')
        .set('Cookie', cookieA)
        .send({ instruction: 'Send Rs 1000 to Rahul', memo: '' })
        .expect(200);

      expect(analyzeResA.body.decision).toBe('APPROVED');
      expect(analyzeResA.body.requires_confirmation).toBe(true);
      expect(analyzeResA.body.intent_token).toBeTruthy();

      // User A executes the transfer
      const executeResA = await request(app)
        .post('/api/execute')
        .set('Cookie', cookieA)
        .send({ intent_token: analyzeResA.body.intent_token })
        .expect(200);

      expect(executeResA.body.status).toBe('executed');
      expect(executeResA.body.balance_paise).toBe(4900000);

      // Verify User A bank reflects 4,900,000
      const bankA2 = await request(app).get('/api/bank/account').set('Cookie', cookieA).expect(200);
      expect(bankA2.body.balance_paise).toBe(4900000);

      // Verify User B bank remains untouched at 5,000,000
      const bankB2 = await request(app).get('/api/bank/account').set('Cookie', cookieB).expect(200);
      expect(bankB2.body.balance_paise).toBe(5000000);

      // Verify default usr_demo remains untouched at 5,000,000
      const defaultBank = getBank('usr_demo');
      expect(defaultBank.balance_paise).toBe(5000000);
    });
  });

  describe('Backward Compatibility: No-cookie requests fallback to usr_demo', () => {
    it('/health endpoint works with no cookie', async () => {
      const res = await request(app).get('/health').expect(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('bankism');
    });

    it('/api/bank/account defaults to usr_demo with no cookie', async () => {
      const res = await request(app).get('/api/bank/account').expect(200);
      expect(res.body.user).toBe('usr_demo');
      expect(res.body.balance_paise).toBe(5000000);
    });

    it('/api/analyze defaults to usr_demo with no cookie', async () => {
      const res = await request(app)
        .post('/api/analyze')
        .send({ instruction: 'What is my balance?' })
        .expect(200);

      expect(res.body.decision).toBe('APPROVED');
      expect(res.body.simulated_result).toEqual({ balance_paise: 5000000 });
    });
  });
});
