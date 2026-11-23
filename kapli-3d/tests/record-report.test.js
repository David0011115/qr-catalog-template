// 2.7.9: the record's report must reach the server — the Net bridge once passed on only (mode, score) and dropped it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('the end of a round sends the record with its report', () => {
  assert.match(read('js/game/06-abilities.js'), /Net\.submitRecord\(mode, score, recReport\(score, coins\)\)/);
});

test('the Net bridge passes the report on to the sender', () => {
  const net = read('js/game/14-net.js');
  assert.match(net, /submitRecord: \(m, v, det\) => \{ submitRecord\(m, v, det\); \}/, 'Net.submitRecord must hand «det» to submitRecord');
  assert.match(net, /async function submitRecord\(m, score, det\)/);
});
