// Special-boss mechanics for «Спина к спине», ported from js/game/14e-duoback.js.
import { cellRadius } from '../core/physics.js';
import { steerDuobackRegularBoss } from './duoback-bosses.js';

const total = p => (p?.cells || []).reduce((s, c) => s + c.mass, 0);
const big = p => (p?.cells || []).reduce((a, b) => !a || b.mass > a.mass ? b : a, null);
const unit = (dx, dz) => { const d = Math.hypot(dx, dz) || 1; return { x: dx / d, z: dz / d, d }; };

export function tickDuobackSpecialBoss(state, owner, players, dt, world, rng = Math.random) {
  const s = state.special;
  if (!s || !(dt > 0)) return { events: [], result: null };
  const events = [], activePlayers = players.filter(p => p.cells?.length);
  const main = big(owner);
  const chunks = s.chunks || (s.chunks = []);
  for (const chunk of [...chunks]) {
    const c = world.findCell(chunk.cellId);
    if (!c || c.gone) {
      if (!chunk.exp) { s.damage += Math.min(chunk.mass, s.max * 0.3); events.push({ type: 'special-chunk-eaten', cellId: chunk.cellId, damage: Math.min(chunk.mass, s.max * 0.3) }); }
      s.chunks.splice(s.chunks.indexOf(chunk), 1);
      continue;
    }
    chunk.mass = c.mass;
    c.life = (c.life ?? 12) - dt;
    const inSplit = s.split?.includes(chunk.cellId);
    if (c !== main && c.life <= 0 && !inSplit) {
      c.exp = true; chunk.exp = true; world.removeCell(c); world.rebuildCells?.();
      events.push({ type: 'special-chunk-expired', cellId: chunk.cellId });
    }
  }
  if (!main || s.damage >= s.max) {
    if (main) world.burstFood?.(main.x, main.z, cellRadius(main) + 30, 160);
    for (const c of [...owner.cells]) { c.exp = true; world.removeCell(c); }
    world.rebuildCells?.();
    state.team.specials += 1;
    if (state.wave === 5 && !state.team.specialWave5Time) state.team.specialWave5Time = Math.round(world.matchTime || 0);
    state.special = null;
    events.push({ type: 'special-boss-defeated', bossId: owner.id });
    return { events, result: 'defeated' };
  }
  if (!chunks.some(c => c.cellId === main.id)) chunks.push({ cellId: main.id, mass: main.mass });
  main.mergeT = 1e9;
  s.life -= dt; owner.dashT = (owner.dashT || 0) - dt; owner.dashCd = Math.max(0, (owner.dashCd || 0) - dt);
  const steering = steerDuobackRegularBoss(owner, activePlayers, { specialEnhanced: s.enhanced });

  s.shed -= dt;
  const mainRadius = cellRadius(main);
  const close = activePlayers.map(p => big(p)).find(pc => Math.hypot(pc.x - main.x, pc.z - main.z) < mainRadius + cellRadius(pc) + 45);
  if (close && s.shed <= 0 && (owner.free?.length || 0) > 2 && chunks.length < 7) {
    const angle = Math.atan2(close.z - main.z, close.x - main.x) + (rng() - 0.5);
    const mass = Math.max(12, s.base * 0.28 * Math.min(1.6, state.difficulty.hp));
    const descriptor = {
      x: main.x + Math.cos(angle) * (mainRadius + 3), z: main.z + Math.sin(angle) * (mainRadius + 3),
      mass, vx: Math.cos(angle) * 30, vz: Math.sin(angle) * 30, mergeT: 1e9, life: 12,
    };
    const c = world.spawnChunk(owner, descriptor, owner.free?.pop());
    if (c) { chunks.push({ cellId: c.id, mass: c.mass }); world.rebuildCells?.(); events.push({ type: 'special-shed', cellId: c.id, mass }); }
    s.shed = 2;
  }

  s.attack -= dt;
  if (s.id === 'vortex') {
    if (s.attack <= 0 && s.pull <= 0) { s.pull = s.enhanced ? 4 : 3; s.attack = s.enhanced ? 6 : 8; events.push({ type: 'vortex-pull-start', seconds: s.pull }); }
    if (s.pull > 0) {
      s.pull -= dt;
      const force = s.enhanced ? 24 : 16;
      for (const p of activePlayers) for (const c of p.cells) {
        const u = unit(main.x - c.x, main.z - c.z);
        if (u.d < mainRadius + 80 && u.d > 1) { c.x += u.x * force * dt; c.z += u.z * force * dt; }
      }
    }
  }
  if (s.id === 'meteor' && s.attack <= 0 && activePlayers.length) {
    const target = big(activePlayers[Math.floor(rng() * activePlayers.length)]);
    state.meteors.push({ x: target.x, z: target.z, radius: 14 + cellRadius(target), t: 1.6 });
    if (s.enhanced) for (const p of activePlayers) {
      const q = big(p);
      if (q !== target) state.meteors.push({ x: q.x + (rng() - 0.5) * 20, z: q.z + (rng() - 0.5) * 20, radius: 14 + cellRadius(q), t: 1.9 });
      else state.meteors.push({ x: q.x + q.hx * 30, z: q.z + q.hz * 30, radius: 16, t: 2 });
    }
    s.attack = Math.max(3, 5.5 - state.wave * 0.05) * (state.difficulty.attack ?? 1);   // 2.7: harder difficulties attack more often
    events.push({ type: 'meteor-warning', count: s.enhanced ? activePlayers.length + 1 : 1 });
  }
  if (s.id === 'split' && s.enhanced && s.split && !s.splitAgain && s.splitTimer <= 0 && s.damage >= s.max * 0.75) {
    s.split = null; s.splitAgain = true;
  }
  if (s.id === 'split' && !s.split && s.damage >= s.max * (s.splitAgain ? 0.75 : 0.5)) {
    s.split = [];
    for (let k = 0; k < 4 && (owner.free?.length || 0) > 0; k++) {
      const angle = k * Math.PI / 2;
      const descriptor = {
        x: main.x + Math.cos(angle) * (mainRadius + 8), z: main.z + Math.sin(angle) * (mainRadius + 8),
        mass: Math.max(14, s.base * 0.35), vx: Math.cos(angle) * 34, vz: Math.sin(angle) * 34, mergeT: 1e9, life: 99,
      };
      const c = world.spawnChunk(owner, descriptor, owner.free?.pop());
      if (c) { chunks.push({ cellId: c.id, mass: c.mass }); s.split.push(c.id); }
    }
    s.splitTimer = 10; world.rebuildCells?.();
    events.push({ type: 'special-split', pieces: s.split.length, seconds: 10, stage: s.splitAgain ? 2 : 1 });
  }
  if (s.split && s.splitTimer > 0) {
    s.splitTimer -= dt;
    if (s.splitTimer <= 0) {
      const left = s.split.filter(id => { const c = world.findCell(id); return c && !c.gone; });
      if (left.length) {
        for (const id of left) { const c = world.findCell(id); const chunk = chunks.find(x => x.cellId === id); if (chunk) chunk.exp = true; if (c) { c.exp = true; world.removeCell(c); } }
        s.damage = Math.max(0, s.damage - s.max * 0.2); world.rebuildCells?.();
        events.push({ type: 'special-split-regenerated', removed: left.length, damageRestored: s.max * 0.2 });
      }
    }
  }
  if (s.life <= 0) {
    for (const c of [...owner.cells]) { c.exp = true; world.removeCell(c); }
    world.rebuildCells?.(); state.special = null;
    events.push({ type: 'special-boss-escaped', bossId: owner.id });
    return { events, result: 'escaped', steering };
  }
  return { events, result: null, steering };
}

export function damageDuobackSpecialBoss(state, amount) {
  if (!state.special || !(amount > 0)) return 0;
  const before = state.special.damage;
  state.special.damage = Math.min(state.special.max, before + amount);
  return state.special.damage - before;
}

export function duobackSpecialChunkEaten(state, cellId, mass) {
  const s = state.special; if (!s) return 0;
  const chunk = s.chunks.find(c => c.cellId === cellId);
  if (!chunk || chunk.exp) return 0;
  chunk.exp = true;
  const damage = Math.min(mass ?? chunk.mass, s.max * 0.3);
  s.damage += damage;
  return damage;
}
