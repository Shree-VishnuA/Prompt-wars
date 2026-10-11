import crypto from 'node:crypto';
import { config } from '../config.js';

// Map of used nonces to their expiration timestamp (in seconds)
export const usedNonces = new Map();

export function clearUsedNonces() {
  usedNonces.clear();
}

export function consumeNonce(nonce, expSeconds) {
  if (!nonce || typeof nonce !== 'string') return false;

  const nowSec = Math.floor(Date.now() / 1000);

  // Clean expired nonces
  for (const [n, exp] of usedNonces.entries()) {
    if (exp <= nowSec) {
      usedNonces.delete(n);
    }
  }

  if (usedNonces.has(nonce)) {
    return false; // Nonce has already been consumed (replay detected)
  }

  const expiry = typeof expSeconds === 'number' ? expSeconds : nowSec + 120;
  usedNonces.set(nonce, expiry);
  return true;
}

export function mintIntentToken({
  userId = 'usr_demo',
  action = 'TRANSFER',
  recipient_id,
  amount_paise,
  memo_hash = ''
} = {}) {
  const secret = config.serverSecret || config.SERVER_SECRET || 'dev-secret-change-me';
  const nowSec = Math.floor(Date.now() / 1000);

  const payload = {
    uid: userId,
    act: action,
    rid: recipient_id || null,
    amt: typeof amount_paise === 'number' ? amount_paise : null,
    mh: memo_hash || '',
    nonce: crypto.randomBytes(16).toString('hex'),
    exp: nowSec + 120 // Valid for 120 seconds
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmacB64 = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${hmacB64}`;
}

export function verifyIntentToken(token) {
  if (!token || typeof token !== 'string') {
    return { valid: false, reason: 'MALFORMED_TOKEN' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, reason: 'MALFORMED_TOKEN' };
  }

  const [payloadB64, hmacB64] = parts;
  const secret = config.serverSecret || config.SERVER_SECRET || 'dev-secret-change-me';

  const expectedHmacBuf = crypto
    .createHmac('sha256', secret)
    .update(payloadB64)
    .digest();

  let actualHmacBuf;
  try {
    actualHmacBuf = Buffer.from(hmacB64, 'base64url');
  } catch {
    return { valid: false, reason: 'MALFORMED_TOKEN' };
  }

  if (
    actualHmacBuf.length !== expectedHmacBuf.length ||
    !crypto.timingSafeEqual(actualHmacBuf, expectedHmacBuf)
  ) {
    return { valid: false, reason: 'INVALID_SIGNATURE' };
  }

  let payload;
  try {
    const jsonStr = Buffer.from(payloadB64, 'base64url').toString('utf8');
    payload = JSON.parse(jsonStr);
  } catch {
    return { valid: false, reason: 'MALFORMED_TOKEN' };
  }

  if (
    !payload ||
    typeof payload !== 'object' ||
    typeof payload.exp !== 'number' ||
    typeof payload.nonce !== 'string'
  ) {
    return { valid: false, reason: 'MALFORMED_TOKEN' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp <= nowSec) {
    return { valid: false, reason: 'TOKEN_EXPIRED' };
  }

  return {
    valid: true,
    payload
  };
}
