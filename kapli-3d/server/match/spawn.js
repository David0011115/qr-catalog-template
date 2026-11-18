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
export function findTerritoryBotSpawn(state, index, world, rng, minDistance = 14) {
  if (!state || !world || !Array.isArray(world.cells) ||
      !Number.isFinite(state.arenaRadius) || typeof rng !== 'function' || !Number.isFinite(minDistance) || minDistance < 0) {
    throw new TypeError('territory state, world and rng are required');
  }
  const home = territoryBotHome(index);
  for (let attempt = 0; attempt < 80; attempt++) {
    const point = pointInArena(rng, state.arenaRadius, 6);
    if (territorySideAt(state, point.x) === home && isSafe(world, point, minDistance)) {
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


// Mirrors DuoM.place() for a player returning after respawn.
export function respawnDuoPlayerOwner(player, world) {
  if (!player?.isPlayer || !world || !Array.isArray(world.cells) ||
      !Array.isArray(player.cells) || !Array.isArray(player.free) || player.cells.length) return false;
  const home = player.homeSide ?? (player.role === 'host' ? -1 : 1);
  let x;
  if (world.mode === 'territory') {
    const border = Number.isFinite(world.modeState?.border) ? world.modeState.border : 0;
    x = border + (home * world.arenaRadius - border) * 0.6;
  } else {
    x = home * world.arenaRadius * 0.18;
  }
  const slotId = player.free.pop();
  if (slotId == null) return false;
  const sequence = Number.isSafeInteger(world.nextEntitySequence) && world.nextEntitySequence > 0
    ? world.nextEntitySequence++ : (world.nextEntitySequence = 2, 1);
  const cell = {
    id: `player:${player.id}:cell:${sequence}`,
    slotId,
    x, z: 0, mass: 10,
    vx: 0, vz: 0, hx: x > 0 ? -1 : 1, hz: 0,
    mergeT: 0, gone: false, owner: player,
  };
  player.cells.push(cell);
  world.cells.push(cell);
  player.freeCount = player.free.length;
  player.spawnSh = 3;
  player.eff ||= { speed: 0, shield: 0, double: 0, magnet: 0 };
  player.eff.shield = Math.max(0, Number(player.eff.shield) || 0, 3);
  player.target = null;
  delete player.respawnAt;
  return cell;
}
