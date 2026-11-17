export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const ROOM_CODE_LENGTH = 5;
export const MAX_CLIENT_MESSAGE_BYTES = 2048;

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function normalizeRoomCode(value) {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  if (code.length !== ROOM_CODE_LENGTH ||
      [...code].some(char => !ROOM_CODE_ALPHABET.includes(char))) return null;
  return code;
}

export function createRoomCode(randomBytes) {
  if (typeof randomBytes !== 'function') throw new TypeError('randomBytes(length) is required');
  const bytes = randomBytes(ROOM_CODE_LENGTH);
  if (!bytes || bytes.length < ROOM_CODE_LENGTH) throw new TypeError('randomBytes returned too few bytes');
  let code = '';
  // Rejection sampling avoids modulo bias and keeps the code alphabet uniform.
  const limit = Math.floor(256 / ROOM_CODE_ALPHABET.length) * ROOM_CODE_ALPHABET.length;
  for (let i = 0; code.length < ROOM_CODE_LENGTH; i++) {
    if (i >= bytes.length) throw new TypeError('randomBytes must return at least five unbiased bytes');
    const value = bytes[i];
    if (!Number.isInteger(value) || value < 0 || value > 255) throw new TypeError('randomBytes must return byte values');
    if (value >= limit) continue;
    code += ROOM_CODE_ALPHABET[value % ROOM_CODE_ALPHABET.length];
  }
  return code;
}

export function sanitizeNickname(value, fallback = 'Игрок') {
  if (typeof value !== 'string') return fallback;
  const clean = value.replace(/[<>\u0000-\u001f\u007f]/g, '').trim().slice(0, 20);
  return clean || fallback;
}

export function parseClientMessage(raw, maxBytes = MAX_CLIENT_MESSAGE_BYTES) {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).byteLength > maxBytes) {
    return { ok: false, reason: 'message-too-large' };
  }
  let message;
  try { message = JSON.parse(raw); } catch { return { ok: false, reason: 'invalid-json' }; }
  if (!isRecord(message) || typeof message.type !== 'string') {
    return { ok: false, reason: 'invalid-message' };
  }
  if (message.type === 'input') {
    if (!Number.isSafeInteger(message.seq) || message.seq < 1 ||
        !Number.isFinite(message.x) || !Number.isFinite(message.z) ||
        Math.abs(message.x) > 1 || Math.abs(message.z) > 1 ||
        Math.hypot(message.x, message.z) > 1.000001) {
      return { ok: false, reason: 'invalid-input' };
    }
    return { ok: true, command: { type: 'input', seq: message.seq, x: message.x, z: message.z } };
  }
  if (message.type === 'ability') {
    if (!Number.isSafeInteger(message.seq) || message.seq < 1 ||
        !Number.isInteger(message.slot) || message.slot < 0 || message.slot > 2) {
      return { ok: false, reason: 'invalid-ability' };
    }
    return { ok: true, command: { type: 'ability', seq: message.seq, slot: message.slot } };
  }
  if (message.type === 'action') {
    if (!Number.isSafeInteger(message.seq) || message.seq < 1 || !['dash', 'split', 'eject'].includes(message.action)) return { ok: false, reason: 'invalid-action' };
    return { ok: true, command: { type: 'action', seq: message.seq, action: message.action } };
  }
  if (message.type === 'boost') {
    if (!Number.isSafeInteger(message.seq) || message.seq < 1 ||
        typeof message.id !== 'string' || !/^[a-z0-9_]{1,32}$/.test(message.id)) {
      return { ok: false, reason: 'invalid-boost' };
    }
    return { ok: true, command: { type: 'boost', seq: message.seq, id: message.id } };
  }
  if (message.type === 'ping') {
    if (!Number.isFinite(message.sentAt)) return { ok: false, reason: 'invalid-ping' };
    return { ok: true, command: { type: 'ping', sentAt: message.sentAt } };
  }
  return { ok: false, reason: 'unsupported-message-type' };
}

export function parseMode(value) {
  return value === 'territory' || value === 'duoback' ? value : null;
}

export function getBearerToken(header) {
  if (typeof header !== 'string') return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(header.trim());
  return match ? match[1] : null;
}
