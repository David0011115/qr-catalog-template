// 2.7: the game files are joined into one script by js/loader.js — a broken bracket in any of them stops the whole game
// (a comment pasted into the middle of a line did exactly that). This parses the joined script the same way.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../', import.meta.url);
const loader = readFileSync(new URL('js/loader.js', root), 'utf8');

test('the joined game script parses without syntax errors', () => {
  const files = JSON.parse(loader.match(/const FILES = (\[[^\]]*\])/)[1].replace(/'/g, '"'));
  assert.ok(files.length > 10);
  const src = '(function () {\n' + files.map(f => readFileSync(new URL('js/game/' + f, root), 'utf8')).join('') + '})();\n';
  assert.doesNotThrow(() => new vm.Script(src, { filename: 'kapli-game.js' }));
});
