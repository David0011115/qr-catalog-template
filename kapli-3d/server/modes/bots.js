// Source-derived bot roster, target selection and steering from 01-config.js,
// 04-arena.js and 07-round.js. Rendering and cosmetic bot ability effects stay client-side.
import { canEat, cellRadius, speedOf, steerCell } from '../core/physics.js';
import { findSafeSpawn, findTerritoryBotSpawn } from '../match/spawn.js';

export const BOT_SKILL = Object.freeze({ sense: 1, lead: 0.4, careful: 1, speed: 0.92 });
export const BOT_PERSONAS = Object.freeze({
  normal: { sense: 1, chase: 0.85, flee: 1, preyK: 1 },
  coward: { sense: 1.4, chase: 0.5, flee: 1.6, preyK: 2 },
  aggressive: { sense: 1.5, chase: 1, flee: 0.6, preyK: 1, likesPlayer: true },
  farmer: { sense: 1, chase: 0, flee: 1.3, preyK: 1 },
  hunter: { sense: 1.3, chase: 1, flee: 1, preyK: 1 },
});

export const BASE_BOT_DEFS = Object.freeze([
  ['Пухлик', 'normal'], ['Зефир', 'coward'], ['Икринка', 'coward'], ['Лава', 'aggressive'],
  ['Кварк', 'aggressive'], ['Пончик', 'farmer'], ['Мармелад', 'farmer'], ['Комета', 'hunter'],
  ['Орбита', 'hunter'], ['Нейтрон', 'normal'], ['Туман', 'coward'], ['Спутник', 'aggressive'],
  ['Бублик', 'farmer'], ['Сполох', 'normal'], ['Ирис', 'coward'], ['Шквал', 'aggressive'],
]);
export const TERRITORY_EXTRA_BOT_DEFS = Object.freeze([
  ['Капелька', 'coward'], ['Росинка', 'farmer'], ['Брызг', 'coward'], ['Ириска', 'farmer'],
  ['Пузырь', 'normal'], ['Мятка', 'coward'], ['Искорка', 'farmer'], ['Шарик', 'normal'],
]);

const totalMass = owner => (owner?.cells || []).reduce((sum, cell) => sum + cell.mass, 0);
const mainCell = owner => (owner?.cells || []).reduce((best, cell) => !best || cell.mass > best.mass ? cell : best, null);
const rand = rng => typeof rng === 'function' ? rng() : rng.next();

export function createBotRoster(mode = 'duoback') {
  if (mode !== 'territory' && mode !== 'duoback') throw new TypeError('unsupported duo bot mode');
  const defs = mode === 'territory' ? [...BASE_BOT_DEFS, ...TERRITORY_EXTRA_BOT_DEFS] : [...BASE_BOT_DEFS];
  const owners = defs.map(([name, persona], index) => ({
    id: `bot:${index}`, name, kind: 'bot', persona, botIndex: index,
    homeSide: mode === 'territory' ? (index % 2 ? 1 : -1) : 0,
    cells: [], free: Array.from({ length: 4 }, (_, slot) => `bot:${index}:slot:${slot}`),
    respawn: 0, think: 0, tx: 0, tz: 0, target: null, partner: null,
    dashT: 0, dashCd: 0, splitCd: 0, spawnSh: 0, abCd: {}, abT: {}, rs: 1,
  }));
  owners[7].partner = owners[8];
  owners[8].partner = owners[7];
  return owners;
}

export function spawnBotOwner(owner, world, rng, options = {}) {
  if (!owner || owner.kind !== 'bot' || owner.cells.length || !owner.free.length) return null;
  const players = world.owners.filter(item => item.isPlayer);
  const primaryPlayer = players.find(item => item.role === 'host') || players[0];
  const playerMass = totalMass(primaryPlayer);
  const top = Math.min(10000, Math.max(30, playerMass * 0.6));
  const aliveMasses = world.owners.filter(item => item !== owner && item.kind === 'bot' && item.cells.length)
    .map(totalMass).sort((a, b) => a - b);
  const median = aliveMasses.length ? aliveMasses[aliveMasses.length >> 1] : 0;
  const running = !!options.running;
  const base = 6 + rand(rng) ** 2 * top;
  const catchUp = running ? Math.min(300, median * (0.3 + rand(rng) * 0.2)) : 0;
  const mass = Math.min(10000, Math.max(base, catchUp));
  const position = owner.homeSide && world.mode === 'territory'
    ? findTerritoryBotSpawn(world.modeState, owner.botIndex, world, () => rand(rng), running ? 22 : 14)
    : findSafeSpawn(world, () => rand(rng), running ? 22 : 14);
  const slot = owner.free.pop();
  const cell = {
    id: `${owner.id}:cell:${slot.split(':').at(-1)}`, slotId: slot,
    x: position.x, z: position.z, mass, vx: 0, vz: 0,
    hx: 1, hz: 0, mergeT: 0, gone: false, owner,
  };
  owner.cells.push(cell); world.cells.push(cell);
  owner.tx = cell.x; owner.tz = cell.z; owner.think = 0; owner.target = null;
  owner.spawnSh = running ? 3 : 0; owner.respawn = 0;
  return cell;
}

export function thinkBot(owner, world, rng, options = {}) {
  const cell = mainCell(owner);
  if (!cell) return { action: 'idle' };
  const persona = BOT_PERSONAS[owner.persona] || BOT_PERSONAS.normal;
  const radius = cellRadius(cell);
  const sense = (14 + radius * 3) * persona.sense * 1.3 * (owner.jit || 1) * BOT_SKILL.sense;
  const canBite = options.canEat || ((a, b) => canEat(a, b, options.physicsRules || {}));
  let fleeX = 0, fleeZ = 0, prey = null, preyScore = Infinity;
  for (const target of world.cells) {
    if (target.owner === owner || options.isCloaked?.(target.owner)) continue;
    const distance = Math.hypot(target.x - cell.x, target.z - cell.z);
    if (distance > sense) continue;
    if (persona.flee > 0 && canBite(target, cell) && distance < sense * Math.min(1, persona.flee)) {
      const weight = persona.flee / Math.max(distance, 1);
      fleeX -= (target.x - cell.x) * weight;
      fleeZ -= (target.z - cell.z) * weight;
    } else if (persona.chase > 0 &&
      cell.mass > target.mass * 1.25 * persona.preyK && canBite(cell, target)) {
      const score = distance * (persona.likesPlayer && target.owner.isPlayer ? 0.6 : 1) /
        Math.pow(Math.max(4, target.mass), 0.35);
      if (score < preyScore) { prey = target; preyScore = score; }
    }
  }

  const careful = ({ coward: 0.7, farmer: 0.5, normal: 0.4, hunter: 0.3, aggressive: 0.2 })[owner.persona] ?? 0.4;
  owner.spikeMemT = (owner.spikeMemT || 0) - 0.35;
  if (owner.spikeMemT <= 0) {
    owner.spikeMemT = 3 + rand(rng) * 2;
    owner.spikeBlind = rand(rng) >= careful * BOT_SKILL.careful;
  }
  if (cell.mass > 130 && !owner.spikeBlind) for (const virus of world.viruses || []) {
    const distance = Math.hypot(virus.x - cell.x, virus.z - cell.z);
    if (distance < radius + 4) {
      const weight = 1.4 / Math.max(distance, 1);
      fleeX -= (virus.x - cell.x) * weight;
      fleeZ -= (virus.z - cell.z) * weight;
    }
  }
  if (fleeX || fleeZ) {
    const distanceFromCenter = Math.hypot(cell.x, cell.z);
    if (distanceFromCenter > world.arenaRadius - 25 - radius) {
      const length = Math.hypot(fleeX, fleeZ) || 1;
      const weight = (distanceFromCenter - (world.arenaRadius - 25 - radius)) / 25 + 0.5;
      fleeX = fleeX / length - cell.x / distanceFromCenter * weight;
      fleeZ = fleeZ / length - cell.z / distanceFromCenter * weight;
    }
    owner.tx = cell.x + fleeX * 20;
    owner.tz = cell.z + fleeZ * 20;
    owner.target = null;
    return { action: 'flee' };
  }

  if (owner.persona === 'hunter' && owner.partner?.target && !owner.partner.target.gone) {
    const shared = owner.partner.target;
    if (canBite(cell, shared) && Math.hypot(shared.x - cell.x, shared.z - cell.z) < sense * 1.6) prey = shared;
  }
  if (prey && rand(rng) < persona.chase) {
    owner.target = prey;
    owner.tx = prey.x; owner.tz = prey.z;
    return { action: 'chase', targetId: prey.id };
  }

  owner.target = null;
  if (Math.hypot(cell.x, cell.z) > world.arenaRadius - 12 - radius && rand(rng) < 0.5) {
    owner.tx = cell.x * 0.6; owner.tz = cell.z * 0.6;
    return { action: 'return-to-center' };
  }
  const food = world.food || [];
  let best = null, bestDistance = Infinity;
  const start = Math.floor(rand(rng) * 3);
  for (let i = start; i < food.length; i += 3) {
    const item = food[i];
    if (!item || options.foodAllowed && !options.foodAllowed(owner, item)) continue;
    const distance = (item.x - cell.x) ** 2 + (item.z - cell.z) ** 2;
    if (distance < bestDistance) { bestDistance = distance; best = item; }
  }
  for (const item of world.ejects || []) {
    const distance = ((item.x - cell.x) ** 2 + (item.z - cell.z) ** 2) * 0.3;
    if (distance < bestDistance && radius > 1.3) { bestDistance = distance; best = item; }
  }
  if (best) { owner.tx = best.x; owner.tz = best.z; return { action: 'farm' }; }
  return { action: 'idle' };
}

export function tickBotOwner(owner, world, dt, rng, options = {}) {
  if (!(dt > 0) || owner.kind !== 'bot') return { action: 'idle' };
  if (!owner.cells.length) {
    owner.respawn = Math.max(0, (owner.respawn || 0) - dt);
    if (owner.respawn <= 0) spawnBotOwner(owner, world, rng, options);
    return { action: 'respawn' };
  }
  owner.spawnSh = Math.max(0, (owner.spawnSh || 0) - dt);
  owner.think = (owner.think || 0) - dt;
  if (owner.think <= 0) {
    const decision = thinkBot(owner, world, rng, options);
    owner.think = 0.25 + rand(rng) * 0.25;
    if (owner.target && owner.target.owner && owner.target.owner.decoy) owner.target = null;
    owner.lastDecision = decision;
  }
  if (owner.target && !owner.target.gone) {
    const target = owner.target;
    const lead = BOT_SKILL.lead * (owner.persona === 'hunter' || owner.star ? 1.5 : 1);
    const targetSpeed = target.owner?.cells ? speedOf(target, options.physicsRules || {}) : 0;
    owner.tx = target.x + (target.hx || 0) * targetSpeed * lead;
    owner.tz = target.z + (target.hz || 0) * targetSpeed * lead;
  }
  for (const cell of owner.cells) steerCell(cell, owner.tx, owner.tz, dt, {
    ...(options.physicsRules || {}), arenaRadius: world.arenaRadius,
  });
  return owner.lastDecision || { action: 'idle' };
}
