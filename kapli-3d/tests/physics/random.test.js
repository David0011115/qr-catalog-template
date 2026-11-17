import test from 'node:test';
import assert from 'node:assert/strict';
import { DeterministicRandom } from '../server/core/random.js';

test('same seed produces the same sequence', () => {
  const a = new DeterministicRandom(123456);
  const b = new DeterministicRandom(123456);
  assert.deepEqual(Array.from({ length: 20 }, () => a.next()),
    Array.from({ length: 20 }, () => b.next()));
});

test('snapshot restores the exact next random value', () => {
  const rng = new DeterministicRandom(98765);
  rng.next();
  rng.next();
  const restored = DeterministicRandom.restore(rng.snapshot());
  assert.equal(restored.next(), rng.next());
  assert.deepEqual(restored.snapshot(), rng.snapshot());
});

test('integer and range helpers respect their bounds', () => {
  const rng = new DeterministicRandom(42);
  for (let i = 0; i < 100; i++) {
    const n = rng.int(7);
    assert.ok(Number.isInteger(n) && n >= 0 && n < 7);
    const x = rng.range(-2, 3);
    assert.ok(x >= -2 && x < 3);
  }
});

test('invalid random bounds and snapshots are rejected', () => {
  const rng = new DeterministicRandom(1);
  assert.throws(() => rng.int(0), RangeError);
  assert.throws(() => rng.range(3, 2), RangeError);
  assert.throws(() => DeterministicRandom.restore({ seed: 1, counter: -1 }), TypeError);
});
