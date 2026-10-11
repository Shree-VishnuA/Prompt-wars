import crypto from 'node:crypto';

export const SESSION_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
export const MAX_SESSIONS = 500;

const sessions = new Map();

function evictOldestIfNeeded() {
  const now = Date.now();
  // Evict expired sessions first
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }

  // If still at or over limit, evict oldest by insertion order
  while (sessions.size >= MAX_SESSIONS) {
    const oldestKey = sessions.keys().next().value;
    if (oldestKey !== undefined) {
      sessions.delete(oldestKey);
    } else {
      break;
    }
  }
}

export function createSession(userData) {
  evictOldestIfNeeded();

  const sid = crypto.randomBytes(24).toString('hex');
  const user = {
    id: userData.id,
    name: userData.name || (userData.kind === 'guest' ? 'Guest User' : 'User'),
    email: userData.email ?? null,
    picture: userData.picture ?? null,
    kind: userData.kind === 'google' ? 'google' : 'guest'
  };

  const session = {
    user,
    createdAt: Date.now()
  };

  sessions.set(sid, session);
  return sid;
}

export function getSession(sid) {
  if (!sid || typeof sid !== 'string') return null;

  const session = sessions.get(sid);
  if (!session) return null;

  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessions.delete(sid);
    return null;
  }

  return session;
}

export function destroySession(sid) {
  if (!sid || typeof sid !== 'string') return false;
  return sessions.delete(sid);
}

export function createGuestSession() {
  const guestId = `guest_${crypto.randomBytes(6).toString('hex')}`;
  const user = {
    id: guestId,
    name: 'Guest User',
    email: null,
    picture: null,
    kind: 'guest'
  };

  const sid = createSession(user);
  return { sid, user };
}

export function clearSessions() {
  sessions.clear();
}

export function getSessionsCount() {
  return sessions.size;
}
