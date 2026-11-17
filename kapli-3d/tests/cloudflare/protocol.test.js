import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROOM_CODE_ALPHABET, createRoomCode, getBearerToken, normalizeRoomCode,
  parseClientMessage, parseMode, sanitizeNickname,
} from '../../server/cloudflare/protocol.js';

test('room codes normalize only the five-character game alphabet', () => {
  assert.equal(normalizeRoomCode(' ab2cd '), 'AB2CD');
  assert.equal(normalizeRoomCode('AB0CD'), null);
  assert.equal(normalizeRoomCode('AB-CD'), null);
  assert.equal(normalizeRoomCode('ABCD'), null);
});

test('room code generation uses injectable cryptographic bytes', () => {
  const bytes = Uint8Array.from([0, 1, 2, 3, 4]);
  const code = createRoomCode(length => {
    assert.equal(length, 5);
    return bytes;
  });
  assert.equal(code, [...bytes].map(n => ROOM_CODE_ALPHABET[n]).join(''));
});

test('nickname is plain bounded text', () => {
  assert.equal(sanitizeNickname('  <Игрок>\nA  '), 'ИгрокA');
  assert.equal(sanitizeNickname(''), 'Игрок');
  assert.equal(sanitizeNickname('x'.repeat(40)).length, 20);
});

test('input commands accept normalized direction but never client coordinates', () => {
  assert.deepEqual(parseClientMessage(JSON.stringify({ type: 'input', seq: 3, x: 0.6, z: 0.8 })), {
    ok: true, command: { type: 'input', seq: 3, x: 0.6, z: 0.8 },
  });
  assert.equal(parseClientMessage(JSON.stringify({ type: 'input', seq: 3, x: 2, z: 0 })).reason, 'invalid-input');
  assert.equal(parseClientMessage(JSON.stringify({ type: 'input', seq: 3, x: 0, z: 0, px: 100 })).command.px, undefined);
});

test('ability commands contain only a slot, never an ability ID', () => {
  assert.deepEqual(parseClientMessage(JSON.stringify({ type: 'ability', seq: 1, slot: 2, id: 'x_over' })), {
    ok: true, command: { type: 'ability', seq: 1, slot: 2 },
  });
  assert.equal(parseClientMessage(JSON.stringify({ type: 'ability', seq: 1, slot: 3 })).reason, 'invalid-ability');
});

test('message size, JSON, type and ping are validated', () => {
  assert.equal(parseClientMessage('x').reason, 'invalid-json');
  assert.equal(parseClientMessage(' '.repeat(30), 10).reason, 'message-too-large');
  assert.equal(parseClientMessage(JSON.stringify({ type: 'teleport', x: 1 })).reason, 'unsupported-message-type');
  assert.deepEqual(parseClientMessage(JSON.stringify({ type: 'ping', sentAt: 123 })), {
    ok: true, command: { type: 'ping', sentAt: 123 },
  });
});

test('mode and bearer parsing are strict', () => {
  assert.equal(parseMode('territory'), 'territory');
  assert.equal(parseMode('classic'), null);
  assert.equal(getBearerToken('Bearer abc.def'), 'abc.def');
  assert.equal(getBearerToken('Basic abc'), null);
});


test('DuoBack boost commands accept only a stable offered boost identifier and sequence', () => {
  assert.deepEqual(parseClientMessage(JSON.stringify({ type: 'boost', seq: 7, id: 'mass' })), {
    ok: true, command: { type: 'boost', seq: 7, id: 'mass' },
  });
  assert.equal(parseClientMessage(JSON.stringify({ type: 'boost', seq: 0, id: 'mass' })).reason, 'invalid-boost');
  assert.equal(parseClientMessage(JSON.stringify({ type: 'boost', seq: 7, id: 'not valid' })).reason, 'invalid-boost');
});
