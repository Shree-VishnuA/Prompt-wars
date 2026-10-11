import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config.js';
import { createSession, createGuestSession, destroySession } from '../lib/sessions.js';
import { COOKIE_NAME, getCookieOptions, getClearCookieOptions } from '../middleware/session.js';

export const authRouter = Router();

// POST /api/auth/guest
authRouter.post('/guest', (req, res) => {
  const { sid, user } = createGuestSession();
  res.cookie(COOKIE_NAME, sid, getCookieOptions());
  return res.status(200).json({ user, ...user });
});

// POST /api/auth/google
authRouter.post('/google', async (req, res) => {
  const googleClientId = config.googleClientId || config.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  if (!googleClientId) {
    return res.status(503).json({ error: 'GOOGLE_AUTH_DISABLED' });
  }

  const credential = req.body?.credential;
  if (!credential || typeof credential !== 'string') {
    return res.status(400).json({ error: 'MALFORMED_INPUT', message: 'credential is required' });
  }

  try {
    const client = new OAuth2Client(googleClientId);
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: googleClientId
    });

    const payload = ticket?.getPayload?.();
    if (!payload) {
      return res.status(401).json({ error: 'INVALID_TOKEN' });
    }

    if (!payload.email_verified) {
      return res.status(401).json({ error: 'EMAIL_NOT_VERIFIED', message: 'Email is not verified' });
    }

    const user = {
      id: `g_${payload.sub}`,
      name: payload.name || payload.email || 'Google User',
      email: payload.email || null,
      picture: payload.picture || null,
      kind: 'google'
    };

    const sid = createSession(user);
    res.cookie(COOKIE_NAME, sid, getCookieOptions());
    return res.status(200).json({ user, ...user });
  } catch (err) {
    return res.status(401).json({ error: 'INVALID_TOKEN', message: err.message });
  }
});

// GET /api/auth/me
authRouter.get('/me', (req, res) => {
  let user;
  if (req.session?.user) {
    user = req.session.user;
  } else {
    // If there is no session, create a guest session
    const guest = createGuestSession();
    res.cookie(COOKIE_NAME, guest.sid, getCookieOptions());
    req.session = { user: guest.user, createdAt: Date.now() };
    req.sessionId = guest.sid;
    user = guest.user;
  }

  const googleClientId = config.googleClientId || config.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  return res.status(200).json({
    user,
    auth: {
      google_enabled: Boolean(googleClientId)
    }
  });
});

// POST /api/auth/logout
authRouter.post('/logout', (req, res) => {
  const sid = req.sessionId || req.signedCookies?.[COOKIE_NAME];
  if (sid) {
    destroySession(sid);
  }
  res.clearCookie(COOKIE_NAME, getClearCookieOptions());
  req.session = null;
  req.sessionId = null;
  return res.status(200).json({ ok: true });
});
