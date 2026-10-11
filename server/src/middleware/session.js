import { getSession } from '../lib/sessions.js';

export const COOKIE_NAME = 'bk_sid';

export function getCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    signed: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: 6 * 60 * 60 * 1000, // 6 hours
    path: '/'
  };
}

export function getClearCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    signed: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/'
  };
}

export function sessionMiddleware(req, res, next) {
  const sid = req.signedCookies?.[COOKIE_NAME];
  if (sid) {
    const session = getSession(sid);
    if (session) {
      req.session = session;
      req.sessionId = sid;
      return next();
    }
  }

  req.session = null;
  req.sessionId = null;
  next();
}

export function getUserId(req) {
  return req?.session?.user?.id || 'usr_demo';
}
