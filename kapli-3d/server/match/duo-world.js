// Authoritative initial world for the two server-backed modes.
// Arena scale, food density, player spawn offsets and bot rosters are sourced
// from 01-config.js, 03-scene.js, 04-arena.js, 14c-duo-match.js and 14d/14e.
import { DeterministicRandom } from '../core/random.js';
import { createVirus } from '../core/viruses.js';
import { createTerritoryState } from '../modes/territory.js';
import { createDuobackState } from '../modes/duoback.js';
import { createBotRoster, spawnBotOwner } from '../modes/bots.js';

export const DUO_WORLD_SOURCE = Object.freeze({
  baseArenaRadius: 237.5,
  baseFoodCount: 5250,
  maxFoodCount: 12000,
  startMass: 10,
  virusCount: 8,
  playerParts: 10,
});

export const DUO_BUILD_POOL = Object.freeze([
  'dash', 'split', 'eject', 'shield', 'pulse', 'blink',
  'slow', 'cloak', 'push', 'shrink', 'decoy', 'trap',
]);

function drawBuild(rng) {
  const pool = [...DUO_BUILD_POOL], result = [];
  while (result.length < 3) result.push(pool.splice(rng.int(pool.length), 1)[0]);
  return result;
}

function pointInArena(rng, arenaRadius, margin) {
  const angle = rng.next() * Math.PI * 2;
  const distance = Math.sqrt(rng.next()) * (arenaRadius - margin);
  return { x: Math.cos(angle) * distance, z: Math.sin(angle) * distance };
}

function createPlayerOwner(player, role, mode, arenaRadius, build) {
  const upgrades = player.upgrades && typeof player.upgrades === 'object' ? player.upgrades : {};
  const abilityLevels = player.abilityLevels && typeof player.abilityLevels === 'object' ? player.abilityLevels : {};
  const startMass = DUO_WORLD_SOURCE.startMass + Math.max(0, Math.min(10, Number(upgrades.big) || 0));
  const home = role === 'host' ? -1 : 1;
  const spawnFactor = mode === 'territory' ? 0.6 : 0.18;
  const x = home * arenaRadius * spawnFactor;
  const cell = {
    id: `player:${player.id}:cell:0`, slotId: `player:${player.id}:slot:0`, x, z: 0, mass: startMass,
    vx: 0, vz: 0, hx: x > 0 ? -1 : 1, hz: 0, mergeT: 0, gone: false,
  };
  const owner = {
    id: player.id, name: player.nickname || (role === 'host' ? 'Игрок 1' : 'Игрок 2'),
    kind: 'player', isPlayer: true, role, team: mode === 'territory' ? role : 'duo',
    cells: [cell], free: Array.from({ length: DUO_WORLD_SOURCE.playerParts - 1 }, (_, i) => `player:${player.id}:slot:${i + 1}`),
    freeCount: DUO_WORLD_SOURCE.playerParts - 1,
    spawnSh: 3, dashT: 0, dashCd: 0, splitCd: 0, abCd: {}, abT: {}, rs: 1,
    slowT: 0, iceT: 0, freezeT: 0, phase2: 0, build: [...build],
    skin: typeof player.skin === 'string' ? player.skin : 'coral',
    upgrades: { ...upgrades }, abilityLevels: { ...abilityLevels }, startMass,
    splitMaxParts: Math.min(10, 4 + Math.max(0, Number(upgrades.splitmax) || 0)),
    mergeSeconds: 14 * (1 - 0.03 * Math.max(0, Number(upgrades.merge) || 0)),
    dashCooldown: 4 * (1 - 0.03 * Math.max(0, Number(upgrades.dash) || 0)),
    dashDuration: 0.35 + 0.035 * Math.max(0, Number(upgrades.light) || 0),
    dashMassCost: 0.03 * (1 - 0.08 * Math.max(0, Number(upgrades.light) || 0)),
    ejectSpeed: 60 * (1 + 0.065 * Math.max(0, Number(abilityLevels.eject) || 0)), ejectCooldown: 0.12, ejectCd: 0,
    eff: { speed: 0, shield: 3, double: 0, magnet: 0 },
    db: mode === 'duoback' ? { mass: 0, speed: 0, armor: 0, absorb: 0, cd: 0 } : null,
    dbAbs: mode === 'duoback' ? 1 : null,
  };
  cell.owner = owner;
  return owner;
}

function spawnInitialViruses(world, rng) {
  for (let i = 0; i < DUO_WORLD_SOURCE.virusCount; i++) {
    let point = null;
    for (let attempt = 0; attempt < 30; attempt++) {
      const candidate = pointInArena(rng, world.arenaRadius, 12);
      if (world.cells.every(cell =>
        Math.hypot(cell.x - candidate.x, cell.z - candidate.z) > 0.38 * Math.sqrt(cell.mass) + 8)) {
        point = candidate; break;
      }
    }
    point ||= pointInArena(rng, world.arenaRadius, 12);
    world.viruses.push(createVirus(point.x, point.z));
  }
}

export function createDuoWorld({ mode, players, seed, difficultyIndex = 0 }) {
  if (mode !== 'territory' && mode !== 'duoback') throw new TypeError('mode must be territory or duoback');
  if (!Array.isArray(players) || players.length !== 2 ||
      players.some(player => !player || typeof player.id !== 'string' || !player.id.trim()) ||
      new Set(players.map(player => player.id)).size !== 2) {
    throw new TypeError('two unique authenticated players are required');
  }
  if (!Number.isInteger(seed)) throw new TypeError('integer world seed is required');
  const byRole = Object.fromEntries(players.map(player => [player.role, player]));
  if (!byRole.host || !byRole.guest) throw new TypeError('players must have host and guest roles');

  const scale = mode === 'territory' ? 1.5 : 0.8;
  const arenaRadius = DUO_WORLD_SOURCE.baseArenaRadius * scale;
  const foodCount = Math.min(
    DUO_WORLD_SOURCE.maxFoodCount,
    Math.round(DUO_WORLD_SOURCE.baseFoodCount * scale * scale),
  );
  const rng = new DeterministicRandom(seed);
  const fallbackBuild = drawBuild(rng);
  const hostBuild = Array.isArray(byRole.host.build) && byRole.host.build.length === 3 ? byRole.host.build : fallbackBuild;
  const guestBuild = Array.isArray(byRole.guest.build) && byRole.guest.build.length === 3 ? byRole.guest.build : fallbackBuild;
  const host = createPlayerOwner(byRole.host, 'host', mode, arenaRadius, hostBuild);
  const guest = createPlayerOwner(byRole.guest, 'guest', mode, arenaRadius, guestBuild);
  const modeState = mode === 'territory'
    ? createTerritoryState(arenaRadius, { role: 'host' })
    : createDuobackState(difficultyIndex);

  const world = {
    id: `world:${byRole.host.id}:${byRole.guest.id}`,
    mode, arenaScale: scale, arenaRadius,
    owners: [host, guest], cells: [...host.cells, ...guest.cells],
    food: [], viruses: [], ejects: [], bonuses: [],
    bonusTimer: 0, pendingFoodChanges: [],
    modeState, time: 0, tick: 0, nextEntitySequence: 1,
    build: [...fallbackBuild], randomState: rng.snapshot(),
  };

  for (let i = 0; i < foodCount; i++) {
    const point = pointInArena(rng, arenaRadius, 1.5);
    world.food.push({ id: `food:${i}`, x: point.x, z: point.z });
  }

  const bots = createBotRoster(mode, rng);
  world.owners.push(...bots);
  for (const bot of bots) spawnBotOwner(bot, world, rng, { running: false });
  spawnInitialViruses(world, rng);
  world.randomState = rng.snapshot();

  return { world, players: { host, guest }, build: [...fallbackBuild], rng };
}
