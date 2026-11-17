// Authoritative, rendering-free game physics.
// The numeric rules below mirror kapli-3d/js/game/{01-config,03-scene,06-abilities,07-round}.js.
// Keep this module independent from Three.js, the DOM, and client networking.

export const PHYSICS = Object.freeze({
  START_MASS: 10,
  BASE_SPEED: 33, // OLD_SPEED (11) * 3
  DASH_MULT: 3.2,
  SLOW_FACTOR: 0.5,
  SHRINK_SPEED: 1.25,
  BOT_SPEED: 0.92,
  VIRUS_MASS: 100,
  EJECT_MASS: 8,
  EJECT_COST: 10,
  EJECT_MIN: 25,
});

const finiteOr = (value, fallback) => Number.isFinite(value) ? value : fallback;
const positive = value => Math.max(0, finiteOr(value, 0));

export function radius(mass) {
  return 0.38 * Math.sqrt(positive(mass));
}

export function cellRadius(cell) {
  return radius(cell.mass) * (cell.owner?.rs || 1);
}

export function eatRatio(target, rules = {}) {
  return target.owner?.isPlayer
    ? 1.25 + 0.01 * positive(rules.guardLevelFor?.(target.owner))
    : 1.25;
}

export function canEat(attacker, target, rules = {}) {
  const ao = attacker?.owner;
  const to = target?.owner;
  if (!attacker || !target || !ao || !to || attacker === target) return false;
  if (positive(to.spawnSh) > 0) return false;
  if (rules.abilityOn?.('shrink', ao) || rules.abilityOn?.('x_ghost', ao)) return false;
  if ((to.isPlayer && rules.playerShieldActive?.(to)) ||
      rules.abilityOn?.('shield', to) ||
      rules.abilityOn?.('x_ghost', to) ||
      rules.shieldActive?.(to)) return false;
  if (ao.team && ao.team === to.team) return false;
  if (!(attacker.mass > target.mass * eatRatio(target, rules))) return false;
  if (rules.eatBlock?.(attacker, target)) return false;
  return true;
}

export function canEatAtDistance(attacker, target, rules = {}) {
  return canEat(attacker, target, rules) &&
    Math.hypot(attacker.x - target.x, attacker.z - target.z) <
      cellRadius(attacker) - cellRadius(target) * 0.35;
}

// Returns the mass added by a successful bite. The caller removes the target
// and consumes cloakBonus only when this function reports consumeCloakBonus.
export function eatingGain(attacker, target) {
  const owner = attacker.owner;
  const hunt = positive(owner.huntT) > 0 && target.owner?.kind !== 'boss' ? 1.1 : 1;
  const cloak = owner.cloakBonus && positive(owner.abT?.cloak) > 0 &&
    target.owner?.kind !== 'minion';
  return {
    gain: target.mass * 0.8 * hunt * (cloak ? 1.15 : 1),
    consumeCloakBonus: !!cloak,
  };
}

export function massDecay(cell, dt, rules = {}) {
  if (cell.mass <= 100 || cell.owner?.kind === 'boss' || dt <= 0) return 0;
  const playerGuard = cell.owner?.isPlayer
    ? 1 - 0.04 * positive(rules.guardLevelFor?.(cell.owner))
    : 1;
  return cell.mass * 0.003 * Math.pow(cell.mass / 100, 0.25) * playerGuard * dt;
}

export function clampCellToArena(cell, arenaRadius) {
  const maxRadius = Math.max(0, arenaRadius - cellRadius(cell) * 0.6);
  const distance = Math.hypot(cell.x, cell.z);
  if (distance > maxRadius && distance > 0) {
    const scale = maxRadius / distance;
    cell.x *= scale;
    cell.z *= scale;
  }
  return cell;
}

// The server receives normalized direction commands and computes movement itself.
// targetX/targetZ are a steering point, not client-supplied authoritative coordinates.
export function steerCell(cell, targetX, targetZ, dt, rules = {}) {
  if (!(dt > 0)) return cell;
  let dx = targetX - cell.x;
  let dz = targetZ - cell.z;
  const distance = Math.hypot(dx, dz);

  if (distance > 0.05) {
    dx /= distance;
    dz /= distance;
    const turnRate = positive(cell.owner?.iceT) > 0
      ? 1.2
      : rules.iceArena ? 3 : 8;
    const k = Math.min(1, dt * turnRate);
    cell.hx += (dx - cell.hx) * k;
    cell.hz += (dz - cell.hz) * k;
    const headingLength = Math.hypot(cell.hx, cell.hz) || 1;
    cell.hx /= headingLength;
    cell.hz /= headingLength;

    const owner = cell.owner || {};
    const playerControlled = !!(owner.isPlayer || owner.kind === 'rival');
    const distanceFactor = Math.min(1, distance / 1.5 + (playerControlled ? 0.35 : 1));
    const velocity = speedOf(cell, rules) * distanceFactor;
    cell.x += cell.hx * velocity * dt;
    cell.z += cell.hz * velocity * dt;
  }

  if (cell.vx || cell.vz) {
    cell.x += cell.vx * dt;
    cell.z += cell.vz * dt;
    const drag = Math.exp(-5 * dt);
    cell.vx *= drag;
    cell.vz *= drag;
    if (Math.abs(cell.vx) + Math.abs(cell.vz) < 0.05) {
      cell.vx = 0;
      cell.vz = 0;
    }
  }

  if (Number.isFinite(rules.arenaRadius)) clampCellToArena(cell, rules.arenaRadius);
  return cell;
}

export function speedOf(cell, rules = {}) {
  const owner = cell.owner || {};
  const massRatio = Math.max(1, cell.mass / PHYSICS.START_MASS);
  let velocity = PHYSICS.BASE_SPEED *
    Math.pow(Math.max(0, cell.mass) / PHYSICS.START_MASS, -0.15);

  if (owner.isPlayer || owner.kind === 'rival') {
    if (positive(owner.dashT) > 0) {
      velocity = PHYSICS.BASE_SPEED * PHYSICS.DASH_MULT * Math.pow(massRatio, -0.1);
    }
    if (owner.isPlayer) {
      velocity *= 1 + 0.01 * positive(rules.speedUpgradeFor?.(owner));
      velocity *= positive(rules.playerSpeedEffect) > 0 ? 1.45 : 1;
      velocity *= 1 + 0.02 * positive(rules.speedPetLevelFor?.(owner));
      if (rules.abilityOn?.('shrink', owner)) velocity *= PHYSICS.SHRINK_SPEED;
    } else if (rules.abilityOn?.('shrink', owner)) {
      velocity *= PHYSICS.SHRINK_SPEED;
    }
    velocity *= positive(owner.freezeT) > 0 ? 0.05 : 1;
    velocity *= positive(owner.slowT) > 0 ? PHYSICS.SLOW_FACTOR : 1;
    velocity *= finiteOr(rules.duoSpeedK?.(cell), 1);
  } else if (positive(owner.freezeT) > 0) {
    velocity *= 0.05;
  } else if (positive(owner.slowT) > 0) {
    velocity *= PHYSICS.SLOW_FACTOR * (owner.kind === 'boss' ? finiteOr(owner.bossSpeed, 1) : 1);
  } else if (owner.kind === 'boss') {
    velocity *= finiteOr(owner.bossSpeed, 1) *
      (positive(owner.dashT) > 0 ? 2 : 1) *
      (positive(owner.stunT) > 0 ? 0.4 : 1);
  } else if (owner.kind === 'minion') {
    velocity *= 1.05;
  } else {
    velocity *= owner.star ? 1 : finiteOr(rules.botSpeed, PHYSICS.BOT_SPEED);
    velocity *= positive(owner.dashT) > 0 ? 1.9 : 1;
    if (rules.abilityOn?.('shrink', owner)) velocity *= PHYSICS.SHRINK_SPEED;
  }

  velocity *= rules.dailySpeed ? 1.3 : 1;
  velocity *= rules.cyberArena ? 1.1 : 1;
  velocity *= rules.stormEvent ? 1.4 : 1;
  velocity *= finiteOr(rules.modeBotSpeedK?.(owner), 1);
  return velocity;
}
