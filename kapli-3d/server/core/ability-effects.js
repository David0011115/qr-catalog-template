// Deterministic, rendering-free ability world effects extracted from js/game/06-abilities.js.
// Entity creation/removal, food-grid updates, mode hooks and presentation are callbacks.
import { cellRadius } from './physics.js';
import { ABILITY_DATA, abilityOn } from './abilities.js';

const n = (v, d = 0) => Number.isFinite(v) ? v : d;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const unit = (dx, dz) => { const d = Math.hypot(dx, dz) || 1; return { x: dx / d, z: dz / d, d }; };
const clampPoint = (x, z, arenaRadius, margin = 4) => {
  const d = Math.hypot(x, z), r = arenaRadius - margin;
  return d > r && d > 0 ? { x: x * r / d, z: z * r / d } : { x, z };
};

export function createWorldAbilityEffects() {
  return { effects: [], iceDropByOwner: {}, ghostWasOn: {}, };
}

export function castWorldAbility(id, owner, world, state, options = {}) {
  if (!owner?.cells?.length) return { ok: false, reason: 'no-cells' };
  const a = ABILITY_DATA[id];
  if (!a) return { ok: false, reason: 'unknown-ability' };
  const main = world.mainOf(owner), center = world.centerOf(owner);
  const px = center.x, pz = center.z;
  const power = options.player ? 1 + 0.065 * Math.max(0, n(options.level)) : 1;
  const foes = world.foesOf(owner);
  const events = [];
  if (id === 'slow') {
    const rad = a.radius * power;
    for (const foe of foes) if (world.nearOf(owner, foe, rad)) foe.slowT = Math.max(foe.slowT || 0, a.dur * power);
    return { ok: true, events };
  }
  if (id === 'push') {
    const rad = a.radius * power;
    for (const foe of foes) for (const c of foe.cells) {
      const dx = c.x - px, dz = c.z - pz, u = unit(dx, dz), edge = u.d - cellRadius(c);
      if (edge < rad + Math.sqrt(world.totalMass(owner)) * 0.4) {
        const massBoost = Math.min(1.6, Math.pow(Math.max(1, c.mass / 25), 0.12));
        const force = a.force * power * massBoost * Math.max(0.35, 1 - edge / (rad * 1.5));
        c.vx += u.x * force; c.vz += u.z * force;
        if (foe.kind !== 'boss') foe.freezeT = Math.max(foe.freezeT || 0, a.stun);
      }
    }
    return { ok: true, events };
  }
  if (id === 'blink' || id === 'x_phase') {
    const distance = id === 'blink' ? a.dist * power : a.dist;
    for (const c of owner.cells) {
      const p = clampPoint(c.x + main.hx * distance, c.z + main.hz * distance, world.arenaRadius);
      c.x = p.x; c.z = p.z;
    }
    if (id === 'blink') events.push({ type: 'blink-shadow', x: px, z: pz, radius: cellRadius(main), ttl: 1, ownerId: owner.id });
    return { ok: true, events };
  }
  if (id === 'x_over') {
    for (const key of Object.keys(owner.abCd || {})) if (key !== id) owner.abCd[key] = 0;
    if (options.player) {
      if (world.playerState) { world.playerState.dashCd = 0; world.playerState.splitCd = 0; }
      if (world.effects) world.effects.speed = Math.max(world.effects.speed || 0, a.dur);
    } else owner.dashT = Math.max(owner.dashT || 0, 0.6);
    return { ok: true, events };
  }
  if (id === 'x_meteor') {
    const angle = Math.atan2(main.hz, main.hx);
    for (const [da, distanceFactor, delay] of [[-0.35, 0.8, 1], [0, 1.15, 1.3], [0.35, 0.8, 1.6]]) {
      const p = clampPoint(px + Math.cos(angle + da) * a.dist * distanceFactor, pz + Math.sin(angle + da) * a.dist * distanceFactor, world.arenaRadius);
      state.effects.push({ id, x: p.x, z: p.z, t: delay, ownerId: owner.id, radius: a.radius, force: a.force });
    }
    return { ok: true, events };
  }
  if (id === 'x_hole' || id === 'x_anchor') {
    const p = id === 'x_anchor' ? { x: px, z: pz } : clampPoint(px + main.hx * a.dist, pz + main.hz * a.dist, world.arenaRadius);
    state.effects.push({ id, x: p.x, z: p.z, t: a.dur, ownerId: owner.id, radius: a.radius });
    return { ok: true, events };
  }
  if (id === 'x_hunt') {
    let best = null, bestDistance = a.radius;
    for (const foe of foes) for (const c of foe.cells) {
      const d = Math.hypot(c.x - main.x, c.z - main.z);
      if (d < bestDistance && world.canEat(main, c)) { bestDistance = d; best = c; }
    }
    if (!best) return { ok: false, reason: 'no-prey' };
    for (const c of owner.cells) {
      const u = unit(best.x - c.x, best.z - c.z);
      c.vx += u.x * a.force; c.vz += u.z * a.force; c.hx = u.x; c.hz = u.z;
    }
    owner.dashT = Math.max(owner.dashT || 0, 0.3); owner.huntT = 1.5;
    return { ok: true, targetId: best.id, events };
  }
  if (id === 'cr_swap') {
    let best = null, bestDistance = a.radius + cellRadius(main);
    for (const foe of foes) {
      if (foe.kind === 'boss' || foe.kind === 'minion') continue;
      for (const c of foe.cells) {
        const dx = c.x - main.x, dz = c.z - main.z, d = Math.hypot(dx, dz);
        if (d < bestDistance && d > 0.1 && (dx * main.hx + dz * main.hz) / d > 0.2) { bestDistance = d; best = c; }
      }
    }
    if (!best) return { ok: false, reason: 'no-target' };
    const dx = best.x - main.x, dz = best.z - main.z, oldX = main.x, oldZ = main.z;
    for (const c of owner.cells) { const p = clampPoint(c.x + dx, c.z + dz, world.arenaRadius, cellRadius(c) * 0.6); c.x = p.x; c.z = p.z; }
    best.x = oldX; best.z = oldZ; best.vx = best.vz = 0;
    return { ok: true, targetId: best.id, events };
  }
  if (id === 'cr_rewind') {
    if (!options.player || !state.history?.length) return { ok: false, reason: 'history-unavailable' };
    const targetTime = state.clock - a.back;
    let entry = null; for (const h of state.history) if (h.t <= targetTime) entry = h;
    if (!entry) return { ok: false, reason: 'history-too-short' };
    const dx = entry.x - px, dz = entry.z - pz, currentMass = world.totalMass(owner);
    for (const c of owner.cells) {
      const p = clampPoint(c.x + dx, c.z + dz, world.arenaRadius, cellRadius(c) * 0.6);
      c.x = p.x; c.z = p.z; c.vx = c.vz = 0;
      if (entry.mass > currentMass) c.mass *= entry.mass / currentMass;
    }
    return { ok: true, events: [{ type: 'rewind', from: { x: px, z: pz }, to: { x: entry.x, z: entry.z } }] };
  }
  return { ok: false, reason: 'requires-special-handler' };
}

function pullFood(food, x, z, radius, speed, dt, onMove) {
  for (const item of food) {
    const dx = x - item.x, dz = z - item.z, d = Math.hypot(dx, dz);
    if (d < radius && d > 0.3) {
      const step = Math.min(d, speed * dt); item.x += dx / d * step; item.z += dz / d * step;
      onMove?.(item);
    }
  }
}

export function tickWorldAbilityEffects(state, world, dt) {
  if (!(dt > 0)) return { events: [], removed: [] };
  const events = [], removed = [], spawned = [];
  const owners = world.owners.filter(o => o.cells?.length);
  for (const owner of owners) {
    if (owner.freezeT) owner.freezeT = Math.max(0, owner.freezeT - dt);
    if (owner.huntT > 0) owner.huntT -= dt;
    const ghostOn = abilityOn(owner, 'x_ghost');
    if (state.ghostWasOn[owner.id] && !ghostOn) {
      const center = world.centerOf(owner), a = ABILITY_DATA.x_ghost;
      for (const foe of world.foesOf(owner)) for (const c of foe.cells) {
        const u = unit(c.x - center.x, c.z - center.z);
        if (u.d < a.radius + cellRadius(c)) { c.vx += u.x * a.force; c.vz += u.z * a.force; }
      }
      events.push({ type: 'ghost-expire-wave', ownerId: owner.id, x: center.x, z: center.z });
    }
    state.ghostWasOn[owner.id] = ghostOn;
    if (abilityOn(owner, 'x_ice')) {
      state.iceDropByOwner[owner.id] = (state.iceDropByOwner[owner.id] ?? 0) - dt;
      if (state.iceDropByOwner[owner.id] <= 0) {
        state.iceDropByOwner[owner.id] = 0.15;
        const main = world.mainOf(owner), r = ABILITY_DATA.x_ice.radius + cellRadius(main) * 0.6;
        state.effects.push({ id: 'icepatch', x: main.x, z: main.z, r, t: 4, ownerId: owner.id });
      }
    }
    const refl = abilityOn(owner, 'x_refl'), typhoon = abilityOn(owner, 'x_typhoon');
    const pulse = abilityOn(owner, 'pulse'), shield = abilityOn(owner, 'shieldB'), vamp = abilityOn(owner, 'x_vamp');
    if (!refl && !typhoon && !pulse && !shield && !vamp) continue;
    const center = world.centerOf(owner), main = world.mainOf(owner), foes = world.foesOf(owner);
    if (pulse) {
      if (!owner.isPlayer) pullFood(world.food, main.x, main.z, 8 + cellRadius(main), 18, dt, world.onFoodMove);
      const rad = 14 + cellRadius(main);
      for (const e of world.ejects) { const u = unit(main.x - e.x, main.z - e.z); if (u.d < rad) { e.vx += (u.x * 70 - u.z * 25) * dt; e.vz += (u.z * 70 + u.x * 25) * dt; } }
    }
    if (refl || shield) {
      const hitSet = refl ? (owner.spHit ||= new Set()) : (owner.shHit ||= new Set());
      for (const foe of foes) for (const c of foe.cells) for (const ownCell of owner.cells) {
        const dx = c.x - ownCell.x, dz = c.z - ownCell.z, u = unit(dx, dz);
        if (u.d >= cellRadius(c) + cellRadius(ownCell) + 0.5 || c.mass <= ownCell.mass || foe.kind === 'minion') continue;
        if (!hitSet.has(foe)) { hitSet.add(foe); c.mass *= refl ? 0.85 : 0.95; events.push({ type: 'defensive-hit', ownerId: owner.id, targetId: foe.id, lostFraction: refl ? 0.15 : 0.05 }); }
        const force = refl ? ABILITY_DATA.x_refl.force : 40;
        c.vx = u.x * force; c.vz = u.z * force;
        c.x = ownCell.x + u.x * (cellRadius(c) + cellRadius(ownCell) + 0.6);
        c.z = ownCell.z + u.z * (cellRadius(c) + cellRadius(ownCell) + 0.6);
        world.clampCell?.(c);
      }
    }
    if (vamp) {
      const rad = ABILITY_DATA.x_vamp.radius + cellRadius(main);
      for (const foe of foes) if (foe.kind !== 'boss') for (const c of foe.cells) {
        if (c.mass >= main.mass || c.mass < 12) continue;
        if (dist(c, main) < rad + cellRadius(c)) { const amount = c.mass * 0.07 * dt; c.mass -= amount; main.mass += amount; }
      }
    }
    if (typhoon) {
      const rad = ABILITY_DATA.x_typhoon.radius + cellRadius(main);
      for (const e of world.ejects) { const u = unit(e.x - center.x, e.z - center.z); if (u.d < rad) { e.vx += u.x * 120 * dt; e.vz += u.z * 120 * dt; } }
      for (const foe of foes) for (const c of foe.cells) {
        const u = unit(c.x - center.x, c.z - center.z);
        if (u.d < rad + cellRadius(c) && c.mass < main.mass * 0.6) {
          c.vx += u.x * 90 * dt; c.vz += u.z * 90 * dt; c.hx = u.x; c.hz = u.z;
          if (foe.kind === 'bot') { foe.target = null; foe.tx = c.x + u.x * 30; foe.tz = c.z + u.z * 30; foe.think = 0.6; }
        }
      }
    }
  }
  for (const effect of [...state.effects]) {
    effect.t -= dt;
    const owner = world.ownersById.get(effect.ownerId);
    const foes = owner ? world.foesOf(owner) : [];
    if (effect.id === 'x_hole') {
      pullFood(world.food, effect.x, effect.z, effect.radius, 26, dt, world.onFoodMove);
      for (const e of world.ejects) { const u = unit(effect.x - e.x, effect.z - e.z); if (u.d < effect.radius) { e.vx += u.x * 80 * dt; e.vz += u.z * 80 * dt; } }
    } else if (effect.id === 'x_anchor') {
      for (const foe of foes) for (const c of foe.cells) {
        const u = unit(effect.x - c.x, effect.z - c.z);
        if (u.d < effect.radius + cellRadius(c) && u.d > 1) { const k = 38 * dt * (foe.kind === 'boss' ? 0.3 : 1) * 6; c.vx += u.x * k; c.vz += u.z * k; }
      }
    } else if (effect.id === 'icepatch') {
      for (const foe of foes) if (foe.cells.some(c => dist(c, effect) < effect.r + cellRadius(c) * 0.5)) foe.iceT = 0.35;
    } else if (effect.id === 'x_meteor' && effect.t <= 0) {
      let popped = false;
      for (const foe of foes) for (const c of [...foe.cells]) {
        const u = unit(c.x - effect.x, c.z - effect.z);
        if (u.d >= effect.radius + cellRadius(c)) continue;
        if (c.mass >= 120 && foe.kind !== 'minion') { world.popCell?.(c, { x: effect.x, z: effect.z, mass: 0 }); popped = true; }
        else { c.vx += u.x * effect.force; c.vz += u.z * effect.force; }
      }
      if (popped) world.rebuildCells?.();
      events.push({ type: 'meteor-impact', x: effect.x, z: effect.z, ownerId: effect.ownerId });
    }
    if (effect.t <= 0) { removed.push(effect); state.effects.splice(state.effects.indexOf(effect), 1); }
  }
  return { events, removed, spawned };
}

export function recordChronosHistory(state, owner, world, dt) {
  state.clock = (state.clock || 0) + dt;
  state.historyTimer = (state.historyTimer || 0) - dt;
  if (state.historyTimer <= 0 && owner?.cells?.length) {
    state.historyTimer = 0.1;
    const center = world.centerOf(owner);
    state.history ||= [];
    state.history.push({ t: state.clock, x: center.x, z: center.z, mass: world.totalMass(owner) });
    while (state.history.length && state.history[0].t < state.clock - 6) state.history.shift();
  }
}
