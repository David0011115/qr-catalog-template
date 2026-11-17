// Rendering-free virus (spike) and ejected-mass rules extracted from 04-arena.js.
// Functions mutate only plain simulation state. Rendering/audio/UI remain client-side.

import { radius, cellRadius } from './physics.js';

export const VIRUS_RULES = Object.freeze({
  MASS: 100,
  MAX_COUNT: 16,
  FEED_MASS: 6,
  FEEDS_TO_FIRE: 5,
  MOVE_DRAG: 2,
  EJECT_DRAG: 4,
  EJECT_SPEED: 60,
  EJECT_RADIUS_OFFSET: 1.2,
  EJECT_MIN_MASS: 25,
  EJECT_COST: 10,
  EJECT_MASS: 8,
  EJECT_COOLDOWN: 0.12,
});

const n = (v, fallback = 0) => Number.isFinite(v) ? v : fallback;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createVirus(x, z, vx = 0, vz = 0, options = {}) {
  return {
    x: n(x), z: n(z), vx: n(vx), vz: n(vz),
    mass: n(options.mass, VIRUS_RULES.MASS),
    feed: Math.max(0, Math.trunc(n(options.feed))),
    trap: options.trap ? { ...options.trap } : null,
  };
}

export function moveVirus(virus, dt, arenaRadius) {
  if (!(dt > 0)) return virus;
  if (virus.vx || virus.vz) {
    virus.x += virus.vx * dt;
    virus.z += virus.vz * dt;
    const drag = Math.exp(-VIRUS_RULES.MOVE_DRAG * dt);
    virus.vx *= drag;
    virus.vz *= drag;
    if (Math.abs(virus.vx) + Math.abs(virus.vz) < 0.2) virus.vx = virus.vz = 0;
    if (Number.isFinite(arenaRadius)) {
      const d = Math.hypot(virus.x, virus.z);
      const limit = Math.max(0, arenaRadius - 5);
      if (d > limit && d > 0) {
        virus.x *= limit / d;
        virus.z *= limit / d;
        virus.vx = virus.vz = 0;
      }
    }
  }
  return virus;
}

export function tickVirusTrap(virus, dt) {
  if (!virus.trap) return false;
  virus.trap.ttl -= dt;
  return virus.trap.ttl <= 0;
}

export function trapProtectsOwner(virus, owner) {
  if (!virus.trap) return false;
  const trapOwner = virus.trap.ownerId;
  return trapOwner != null && (trapOwner === owner?.id ||
    (virus.trap.team != null && virus.trap.team === owner?.team));
}

export function canPopOnVirus(cell, virus, rules = {}) {
  if (!cell || cell.gone || !cell.owner) return false;
  if (!(cell.mass >= virus.mass * 1.3)) return false;
  if (trapProtectsOwner(virus, cell.owner)) return false;
  if (rules.abilityOn?.('x_ghost', cell.owner) ||
      rules.abilityOn?.('shrink', cell.owner) || n(cell.owner.spawnSh) > 0) return false;
  return Math.hypot(cell.x - virus.x, cell.z - virus.z) <
    cellRadius(cell) - radius(virus.mass) * 0.3;
}

// Applies the original spike split. The caller creates visual-free cells from
// returned descriptors and updates owner.cells/free using its own entity store.
export function popCellOnVirus(cell, virus, ownerState, rules = {}) {
  const owner = cell.owner;
  if (owner.kind === 'boss' && ownerState.freeCount === 0) {
    const lostMass = cell.mass * 0.3;
    cell.mass -= lostMass;
    owner.stunT = 2.5;
    return {
      type: 'boss-mass-loss', lostMass,
      foodCount: Math.min(160, Math.round(lostMass / 4)),
      stunSeconds: 2.5,
    };
  }

  cell.mass += virus.mass * 0.5;
  const maxParts = owner.isPlayer
    ? n(rules.playerMaxParts?.(owner), 4)
    : owner.kind === 'bot'
      ? n(rules.botParts, 8)
      : owner.kind === 'boss'
        ? ownerState.cellsCount + ownerState.freeCount
        : 1;
  const partsLimit = owner.isPlayer ? 8 - n(rules.spikeResistanceLevel) : 8;
  const pieces = Math.min(
    partsLimit,
    maxParts - ownerState.cellsCount + 1,
    ownerState.freeCount + 1,
  );
  if (pieces <= 1) return { type: 'mass-gain-no-split', gainedMass: virus.mass * 0.5, pieces: 1 };

  const eachMass = cell.mass / pieces;
  const mergeSeconds = owner.isPlayer
    ? n(rules.playerMergeTime?.(owner), 14)
    : 14;
  cell.mass = eachMass;
  cell.mergeT = mergeSeconds;
  const spawned = [];
  for (let i = 1; i < pieces; i++) {
    const angle = i / (pieces - 1) * Math.PI * 2 + n(rules.random?.(), 0) * 0.4;
    const r = radius(eachMass);
    const hx = Math.cos(angle), hz = Math.sin(angle);
    spawned.push({
      x: cell.x + hx * r * 0.5,
      z: cell.z + hz * r * 0.5,
      mass: eachMass,
      vx: hx * 40, vz: hz * 40,
      hx, hz, mergeT: mergeSeconds,
    });
  }
  return { type: 'split', pieces, eachMass, mergeSeconds, spawned };
}

// Returns the exact new-spike trajectory from the fifth ejected blob.
export function feedVirusWithEject(virus, eject) {
  virus.feed += 1;
  virus.mass += VIRUS_RULES.FEED_MASS;
  if (virus.feed < VIRUS_RULES.FEEDS_TO_FIRE) {
    return { consumed: true, fired: false };
  }
  virus.feed = 0;
  virus.mass = VIRUS_RULES.MASS;
  const speed = Math.hypot(eject.vx, eject.vz) || 1;
  const dx = eject.vx / speed || 1;
  const dz = eject.vz / speed;
  const offset = radius(VIRUS_RULES.MASS) * 2.2;
  return {
    consumed: true, fired: true,
    spawnedVirus: {
      x: virus.x + dx * offset, z: virus.z + dz * offset,
      vx: dx * VIRUS_RULES.EJECT_SPEED, vz: dz * VIRUS_RULES.EJECT_SPEED,
      mass: VIRUS_RULES.MASS, feed: 0, trap: null,
    },
  };
}

export function createEjectedMass(cell, rules = {}) {
  if (cell.mass < VIRUS_RULES.EJECT_MIN_MASS) return null;
  cell.mass -= VIRUS_RULES.EJECT_COST;
  const offset = cellRadius(cell) + VIRUS_RULES.EJECT_RADIUS_OFFSET;
  const speed = 60 * n(rules.ejectPower, 1);
  return {
    x: cell.x + cell.hx * offset, z: cell.z + cell.hz * offset,
    vx: cell.hx * speed + n(cell.vx),
    vz: cell.hz * speed + n(cell.vz),
    mass: VIRUS_RULES.EJECT_MASS, age: 0,
  };
}

export function moveEjectedMass(eject, dt, arenaRadius) {
  if (!(dt > 0)) return eject;
  eject.x += eject.vx * dt;
  eject.z += eject.vz * dt;
  const drag = Math.exp(-VIRUS_RULES.EJECT_DRAG * dt);
  eject.vx *= drag;
  eject.vz *= drag;
  eject.age += dt;
  if (Number.isFinite(arenaRadius)) {
    const d = Math.hypot(eject.x, eject.z);
    const limit = Math.max(0, arenaRadius - 1.5);
    if (d > limit && d > 0) { eject.x *= limit / d; eject.z *= limit / d; }
  }
  return eject;
}

export function tryEjectedMassPickup(eject, cell, rules = {}) {
  if (!cell || cell.gone || !cell.owner) return false;
  if (cell.owner.isPlayer && eject.age < 0.6) return false;
  const r = cellRadius(cell);
  if (r <= 1.3 || Math.hypot(cell.x - eject.x, cell.z - eject.z) >= r) return false;
  const multiplier = cell.owner.isPlayer
    ? 1 + 0.015 * n(rules.digestLevel)
    : 1;
  cell.mass += eject.mass * multiplier;
  return true;
}

export function createVirusRespawnTimer() { return 10; }
export function tickVirusRespawnTimers(timers, dt) {
  const remaining = [];
  let spawnCount = 0;
  for (const timer of timers) {
    const next = timer - dt;
    if (next <= 0) spawnCount++;
    else remaining.push(next);
  }
  return { timers: remaining, spawnCount };
}

export function canSpawnVirus(currentCount) { return currentCount < VIRUS_RULES.MAX_COUNT; }

export function clampEjectedMassToArena(eject, arenaRadius) {
  if (!Number.isFinite(arenaRadius)) return eject;
  const d = Math.hypot(eject.x, eject.z);
  const limit = Math.max(0, arenaRadius - 1.5);
  if (d > limit && d > 0) { eject.x *= limit / d; eject.z *= limit / d; }
  return eject;
}

// Matches feedVirus(e): the first virus within radius(mass)+0.5 consumes the blob.
export function tryFeedEjectIntoViruses(eject, viruses) {
  for (const virus of viruses) {
    if (Math.hypot(eject.x - virus.x, eject.z - virus.z) > radius(virus.mass) + 0.5) continue;
    return { virus, ...feedVirusWithEject(virus, eject) };
  }
  return null;
}

// Mirrors eject(): one blob per eligible player cell, with oldest-first cap at 60.
export function ejectFromCells(cells, ejects, rules = {}) {
  let didEject = false;
  const removed = [];
  const created = [];
  for (const cell of cells) {
    if (cell.mass < VIRUS_RULES.EJECT_MIN_MASS) continue;
    if (ejects.length >= 60) {
      const oldest = ejects.shift();
      if (oldest) removed.push(oldest);
    }
    const eject = createEjectedMass(cell, rules);
    if (!eject) continue;
    ejects.push(eject);
    created.push(eject);
    didEject = true;
  }
  return { didEject, created, removed, cooldown: didEject ? VIRUS_RULES.EJECT_COOLDOWN : 0 };
}
// Complete authoritative virus tick, including collision ordering and the
// same-frame decrement of newly queued 10-second respawn timers.
export function stepViruses(viruses, cells, dt, arenaRadius, respawnTimers = [], rules = {}) {
  const survivors = [];
  const nextTimers = [...respawnTimers];
  const pops = [];
  for (const virus of viruses) {
    if (virus.trap && tickVirusTrap(virus, dt)) continue;
    moveVirus(virus, dt, arenaRadius);
    let popped = false;
    for (const cell of cells) {
      if (!canPopOnVirus(cell, virus, rules)) continue;
      const ownerState = rules.ownerStateFor?.(cell.owner) || { cellsCount: 1, freeCount: 0 };
      const result = popCellOnVirus(cell, virus, ownerState, rules);
      pops.push({ cell, virus, result });
      if (!virus.trap) nextTimers.push(createVirusRespawnTimer());
      popped = true;
      break;
    }
    if (!popped) survivors.push(virus);
  }
  const timerResult = tickVirusRespawnTimers(nextTimers, dt);
  return { viruses: survivors, respawnTimers: timerResult.timers, spawnCount: timerResult.spawnCount, pops };
}

// Complete authoritative ejected-blob tick. Virus feeding happens before
// movement; cell pickup happens after movement, matching updateEjects(dt).
export function stepEjectedMass(ejects, viruses, cells, dt, arenaRadius, rules = {}) {
  const survivors = [...ejects];
  const fed = [];
  const pickups = [];
  const spawnedViruses = [];
  for (let i = survivors.length - 1; i >= 0; i--) {
    const eject = survivors[i];
    const feed = tryFeedEjectIntoViruses(eject, viruses);
    if (feed) {
      if (feed.spawnedVirus && canSpawnVirus(viruses.length)) {
        viruses.push(feed.spawnedVirus);
        spawnedViruses.push(feed.spawnedVirus);
      }
      survivors.splice(i, 1);
      fed.push({ eject, ...feed });
      continue;
    }
    moveEjectedMass(eject, dt, arenaRadius);
    for (const cell of cells) {
      if (!tryEjectedMassPickup(eject, cell, rules)) continue;
      survivors.splice(i, 1);
      pickups.push({ eject, cell });
      break;
    }
  }
  return { ejects: survivors, viruses, fed, pickups, spawnedViruses };
}