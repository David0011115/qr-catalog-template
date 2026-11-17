// Rendering-free world interactions, following the update order in js/game/07-round.js.
import { canEatAtDistance, cellRadius, eatingGain, massDecay, radius } from './physics.js';
import { DeterministicRandom } from './random.js';

const finite = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const alive = cell => cell && !cell.gone;

function removeWorldCell(world, cell) {
  if (!cell || cell.gone) return false;
  cell.gone = true;
  const ownerCells = cell.owner?.cells;
  if (Array.isArray(ownerCells)) {
    const index = ownerCells.indexOf(cell);
    if (index >= 0) ownerCells.splice(index, 1);
  }
  const index = world.cells.indexOf(cell);
  if (index >= 0) world.cells.splice(index, 1);
  return true;
}

function mergeCap(owner, rules) {
  if (typeof rules.massCapForOwner === 'function') return rules.massCapForOwner(owner);
  if (owner.isPlayer) return Infinity;
  if (owner.kind === 'bot') return 10000;
  if (owner.kind === 'boss') return 12000;
  return 15000;
}

// Exact pairwise push-apart / pull-together / merge ordering from 07-round.js.
export function stepOwnerCellCollisions(world, dt, rules = {}) {
  const merged = [];
  const separated = [];
  for (const owner of world.owners) {
    const cells = owner.cells;
    for (let i = 0; i < cells.length; i++) {
      for (let j = i + 1; j < cells.length; j++) {
        const a = cells[i], b = cells[j];
        if (!alive(a) || !alive(b)) continue;
        const ra = cellRadius(a), rb = cellRadius(b);
        let dx = b.x - a.x, dz = b.z - a.z;
        const d = Math.hypot(dx, dz) || 0.001;
        const cap = mergeCap(owner, rules);
        if (a.mergeT > 0 || b.mergeT > 0 || a.mass + b.mass > cap) {
          if (d < ra + rb) {
            const push = (ra + rb - d) / 2 * Math.min(1, dt * 10);
            dx /= d; dz /= d;
            a.x -= dx * push; a.z -= dz * push;
            b.x += dx * push; b.z += dz * push;
            separated.push([a, b]);
          }
        } else {
          const pull = Math.min(1, dt * 1.5);
          a.x += dx * pull * 0.5; a.z += dz * pull * 0.5;
          b.x -= dx * pull * 0.5; b.z -= dz * pull * 0.5;
          if (d < Math.max(ra, rb) * 0.7) {
            a.mass += b.mass;
            a.hx = (a.hx + b.hx) / 2;
            a.hz = (a.hz + b.hz) / 2;
            removeWorldCell(world, b);
            merged.push({ survivor: a, removed: b });
          }
        }
      }
    }
  }
  return { merged, separated };
}

function foodCellIndex(value, arenaRadius, gridSize, gridCount) {
  return Math.max(0, Math.min(gridCount - 1, Math.floor((value + arenaRadius) / gridSize)));
}

function foodRespawn(world, food, rules) {
  if (typeof rules.placeFood === 'function') {
    const point = rules.placeFood(world, food);
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.z)) {
      throw new TypeError('placeFood must return finite x and z');
    }
    food.x = point.x; food.z = point.z;
    return;
  }
  if (!world.randomState) {
    throw new TypeError('world.randomState is required for deterministic food respawn');
  }
  const random = DeterministicRandom.restore(world.randomState);
  const angle = random.next() * Math.PI * 2;
  const distance = Math.sqrt(random.next()) * Math.max(0, world.arenaRadius - 1.5);
  food.x = Math.cos(angle) * distance;
  food.z = Math.sin(angle) * distance;
  world.randomState = random.snapshot();
}

// Mirrors the source's 8-unit food grid, magnet radius, multipliers and decay.
export function stepFoodAndDecay(world, dt, rules = {}) {
  const foods = world.food || [];
  const arenaRadius = world.arenaRadius;
  const gridSize = rules.foodGridSize || 8;
  const gridCount = Math.ceil(2 * arenaRadius / gridSize) + 1;
  const grid = new Map();
  for (let i = 0; i < foods.length; i++) {
    const food = foods[i];
    const gx = foodCellIndex(food.x, arenaRadius, gridSize, gridCount);
    const gz = foodCellIndex(food.z, arenaRadius, gridSize, gridCount);
    const key = gx * gridCount + gz;
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(i);
  }

  let consumed = 0;
  let decayedMass = 0;
  for (const cell of [...world.cells]) {
    if (!alive(cell)) continue;
    const owner = cell.owner;
    const player = !!owner.isPlayer;
    const magnet = player
      ? finite(rules.magnetFor?.(owner), 0)
      : owner.eff?.magnet > 0 ? 6 : 0;
    const pickupRadius = cellRadius(cell) + magnet;
    const gain = (player
      ? finite(rules.playerFoodGainFor?.(owner), 1)
      : owner.eff?.double > 0 ? 2 : 1) *
      (rules.abilityOn?.('pulse', owner) ? 2 : 1) *
      finite(owner.dbAbs, 1);
    const gx0 = foodCellIndex(cell.x - pickupRadius, arenaRadius, gridSize, gridCount);
    const gx1 = foodCellIndex(cell.x + pickupRadius, arenaRadius, gridSize, gridCount);
    const gz0 = foodCellIndex(cell.z - pickupRadius, arenaRadius, gridSize, gridCount);
    const gz1 = foodCellIndex(cell.z + pickupRadius, arenaRadius, gridSize, gridCount);
    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gz = gz0; gz <= gz1; gz++) {
        const bucket = grid.get(gx * gridCount + gz) || [];
        for (const index of bucket) {
          const food = foods[index];
          if ((food.x - cell.x) ** 2 + (food.z - cell.z) ** 2 >= pickupRadius ** 2) continue;
          cell.mass += gain;
          foodRespawn(world, food, rules);
          consumed++;
          if (typeof rules.onFoodEaten === 'function') rules.onFoodEaten({ cell, food, gain, index }, world);
        }
      }
    }
    const decay = massDecay(cell, dt, rules);
    if (decay > 0) {
      cell.mass = Math.max(0, cell.mass - decay);
      decayedMass += decay;
    }
  }
  return { consumed, decayedMass };
}

// Broad-phase eating pass from 07-round.js: stable cell snapshot, 48-unit buckets,
// ascending candidate indexes and the original radius-overlap threshold.
export function stepEating(world, rules = {}) {
  const eatCells = [...world.cells];
  const grid = new Map();
  let totalMass = 0;
  for (let i = 0; i < eatCells.length; i++) {
    const cell = eatCells[i];
    if (!alive(cell)) continue;
    totalMass += cell.mass;
    const gx = Math.floor(cell.x / 48), gz = Math.floor(cell.z / 48);
    const key = ((gx & 65535) << 16) | (gz & 65535);
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(i);
  }

  const eaten = [];
  for (const attacker of eatCells) {
    if (!alive(attacker)) continue;
    const searchRadius = radius(totalMass * 1.27) * (attacker.owner.rs || 1);
    const gx0 = Math.floor((attacker.x - searchRadius) / 48);
    const gx1 = Math.floor((attacker.x + searchRadius) / 48);
    const gz0 = Math.floor((attacker.z - searchRadius) / 48);
    const gz1 = Math.floor((attacker.z + searchRadius) / 48);
    const candidates = [];
    for (let gx = gx0; gx <= gx1; gx++) for (let gz = gz0; gz <= gz1; gz++) {
      const key = ((gx & 65535) << 16) | (gz & 65535);
      const bucket = grid.get(key);
      if (bucket) candidates.push(...bucket);
    }
    candidates.sort((a, b) => a - b);
    for (const index of candidates) {
      const target = eatCells[index];
      if (!alive(attacker) || !alive(target) || attacker.owner === target.owner) continue;
      if (!canEatAtDistance(attacker, target, rules)) continue;
      const victim = target.owner;
      const lastMass = target.mass;
      const result = eatingGain(attacker, target);
      if (typeof rules.onBeforeEat === 'function') rules.onBeforeEat({ attacker, target, victim, lastMass, gain: result.gain }, world);
      attacker.mass += result.gain;
      if (result.consumeCloakBonus) attacker.owner.cloakBonus = false;
      removeWorldCell(world, target);
      const event = { attacker, target, victim, lastMass, gain: result.gain, victimEliminated: victim.cells.length === 0 };
      eaten.push(event);
      if (typeof rules.onCellEaten === 'function') rules.onCellEaten(event, world);
      if (typeof rules.onCellLost === 'function') rules.onCellLost(event, world);
    }
  }
  return { eaten };
}

export function stepWorldInteractions(world, dt, rules = {}) {
  if (!world || !Array.isArray(world.owners) || !Array.isArray(world.cells) ||
      !Number.isFinite(world.arenaRadius) || !(dt > 0)) {
    throw new TypeError('valid world and positive dt are required');
  }
  const collisions = stepOwnerCellCollisions(world, dt, rules);
  const food = stepFoodAndDecay(world, dt, rules);
  const eating = stepEating(world, rules);

  for (const cell of world.cells) {
    const cap = mergeCap(cell.owner, rules);
    if (!cell.owner.isPlayer && cell.mass > cap) cell.mass = cap;
  }
  for (const owner of world.owners) {
    if (owner.kind !== 'bot') continue;
    const cap = finite(rules.botTotalMassCap, 10000);
    const total = owner.cells.reduce((sum, cell) => sum + cell.mass, 0);
    if (total > cap) {
      const scale = cap / total;
      for (const cell of owner.cells) cell.mass *= scale;
    }
  }
  return { collisions, food, eating };
}
