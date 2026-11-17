// Seeded PRNG used by authoritative simulation.
// Algorithm matches the deterministic generator already used in 14c-duo-match.js.
export class DeterministicRandom {
  constructor(seed, counter = 0) {
    this.seed = Number(seed) | 0;
    this.counter = Math.max(0, Number(counter) | 0);
  }

  next() {
    this.seed = (this.seed + 0x6D2B79F5) | 0;
    let t = Math.imul(this.seed ^ (this.seed >>> 15), 1 | this.seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    this.counter++;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  int(maxExclusive) {
    if (!Number.isSafeInteger(maxExclusive) || maxExclusive <= 0) {
      throw new RangeError('maxExclusive must be a positive safe integer');
    }
    return Math.floor(this.next() * maxExclusive);
  }

  range(min, max) {
    if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) {
      throw new RangeError('range requires finite min <= max');
    }
    return min + (max - min) * this.next();
  }

  snapshot() {
    return { seed: this.seed, counter: this.counter };
  }

  static restore(snapshot) {
    if (!snapshot || !Number.isInteger(snapshot.seed) || !Number.isSafeInteger(snapshot.counter) || snapshot.counter < 0) {
      throw new TypeError('Invalid PRNG snapshot');
    }
    return new DeterministicRandom(snapshot.seed, snapshot.counter);
  }
}
