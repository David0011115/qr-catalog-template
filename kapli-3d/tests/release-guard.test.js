// Release guard: the main game must never ship in test mode (999 999 coins, everything unlocked, the test panel).
// Runs with every «node --test» and in GitHub Actions before a release.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const read = p => readFileSync(new URL(p, root), 'utf8');

test('the test flag is off in the main game', () => {
  const cfg = read('js/game/01-config.js');
  assert.equal((cfg.match(/const TEST_FLAG = false;/g) || []).length, 1, 'js/game/01-config.js must say exactly «const TEST_FLAG = false;»');
  assert.ok(!/const TEST_FLAG = true/.test(cfg), 'the test flag is switched on');
  assert.ok(/const TEST_MODE = TEST_FLAG && !\/\\\/kapli-3d\\\/\/\.test\(location\.pathname\);/.test(cfg), 'the second lock (no test mode at …/kapli-3d/) is missing');
});

test('the main game does not load the test panel', () => {
  const files = JSON.parse(read('js/loader.js').match(/const FILES = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
  assert.ok(!files.includes('14-tpanel.js'), 'js/loader.js must not list 14-tpanel.js (only the test copy adds it)');
  assert.ok(!read('sw.js').includes('14-tpanel.js'), 'sw.js must not cache 14-tpanel.js');
});

test('the test copy (with the test panel) still parses', () => {
  const files = JSON.parse(read('js/loader.js').match(/const FILES = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
  const withTest = files.flatMap(f => f === '14-net.js' ? [f, '14-tpanel.js'] : [f]);
  const src = '(function () {\n' + withTest.map(f => read('js/game/' + f)).join('') + '})();\n';
  assert.doesNotThrow(() => new vm.Script(src, { filename: 'kapli-game-test.js' }));
});
