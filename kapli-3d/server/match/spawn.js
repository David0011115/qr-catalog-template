// Source-matched safe spawn selection from js/game/04-arena.js and 14d-territory.js.
import { cellRadius } from '../core/physics.js';
import { territoryBotHome, territorySideAt } from '../modes/territory.js';

const pointInArena = (rng, arenaRadius, margin) => {
  const angle = rng() * Math.PI * 2;
  const distance = Math.sqrt(rng()) * Math.max(0, arenaRadius - margin);
  return { x: Math.cos(angle) * distance, z: Math.sin(angle) * distance };
};

function isSafe(world, point, minDistance) {
  return world.cells.every(cell =>
    Math.hypot(cell.x - point.x, cell.z - point.z) > minDistance + cellRadius(cell));
}

// Mirrors safeSpot(): 50 random attempts, then the source's unconstrained fallback.
export function findSafeSpawn(world, rng, minDistance = 40) {
  if (!world || !Array.isArray(world.cells) || !Number.isFinite(world.arenaRadius) ||
      typeof rng !== 'function' || !Number.isFinite(minDistance) || minDistance < 0) {
    throw new TypeError('world, rng and non-negative minDistance are required');
  }
  for (let attempt = 0; attempt < 50; attempt++) {
    const point = pointInArena(rng, world.arenaRadius, 6);
    if (isSafe(world, point, minDistance)) return { ...point, safe: true, attempts: attempt + 1 };
  }
  return { ...pointInArena(rng, world.arenaRadius, 6), safe: false, attempts: 50 };
}

// Mirrors the Territory override: 80 attempts on the bot's home side, then its
// deterministic home-side fallback at the same 50%-toward-home interpolation.
export function findTerritoryBotSpawn(state, index, world, rng) {
  if (!state || !world || !Array.isArray(world.cells) ||
      !Number.isFinite(state.arenaRadius) || typeof rng !== 'function') {
    throw new TypeError('territory state, world and rng are required');
  }
  const home = territoryBotHome(index);
  for (let attempt = 0; attempt < 80; attempt++) {
    const point = pointInArena(rng, state.arenaRadius, 6);
    if (territorySideAt(state, point.x) === home && isSafe(world, point, 6)) {
      return { ...point, homeSide: home, safe: true, attempts: attempt + 1 };
    }
  }
  return {
    x: state.border + (home * state.arenaRadius - state.border) * 0.5,
    z: (rng() - 0.5) * state.arenaRadius * 0.6,
    homeSide: home, safe: false, attempts: 80,
  };
}

export function findDuobackBossSpawn(world, rng) {
  return findSafeSpawn(world, rng, 40);
}
