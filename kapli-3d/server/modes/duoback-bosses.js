// Source-derived movement/attack rules for regular «Спина к спине» bosses.
import { cellRadius } from '../core/physics.js';

const total = o => (o?.cells || []).reduce((s, c) => s + c.mass, 0);
const big = o => (o?.cells || []).reduce((a, b) => !a || b.mass > a.mass ? b : a, null);
const unit = (dx, dz) => { const d = Math.hypot(dx, dz) || 1; return { x: dx / d, z: dz / d, d }; };

export function steerDuobackRegularBoss(boss, players, options = {}) {
  boss.think = 1;
  const ps = players.filter(p => p.cells?.length);
  const c = big(boss);
  if (!c || !ps.length) return { target: null, tx: boss.tx ?? c?.x ?? 0, tz: boss.tz ?? c?.z ?? 0, dashStarted: false };
  const nearest = ps.map(p => big(p)).sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z));
  const light = ps.slice().sort((a, b) => total(a) - total(b))[0];
  const heavy = ps.slice().sort((a, b) => total(b) - total(a))[0];
  let target = nearest[0], tx, tz, dashStarted = false;
  if (boss.dbType === 'twins') target = big(ps[(boss.k || 0) % ps.length]);
  if (boss.dbType === 'leech') target = big(light);
  if (boss.dbType === 'devourer') target = big(heavy);
  if (boss.dbType === 'wedge' && ps.length === 2) {
    const a = big(ps[0]), b = big(ps[1]);
    target = null; tx = (a.x + b.x) / 2; tz = (a.z + b.z) / 2;
    if (boss.dashCd <= 0 && Math.hypot(tx - c.x, tz - c.z) < 70) { boss.dashT = 0.7; boss.dashCd = 5; dashStarted = true; }
    boss.target = null; boss.tx = tx; boss.tz = tz;
    return { target, tx, tz, dashStarted };
  }
  tx = target.x; tz = target.z; boss.target = target; boss.tx = tx; boss.tz = tz;
  if ((boss.dbType === 'devourer' || boss.dbType === 'wedge') && boss.dashCd <= 0 && Math.hypot(tx - c.x, tz - c.z) < 60) {
    boss.dashT = 0.6;
    boss.dashCd = boss.dbType === 'devourer' ? (options.specialEnhanced ? 4 : 6) : 5;
    dashStarted = true;
  }
  return { target, tx, tz, dashStarted };
}

export function tickDuobackRegularBoss(boss, dt, players, options = {}) {
  const events = [];
  if (!(dt > 0) || !boss.cells?.length) return { events, expired: false };
  boss.dashT -= dt;
  boss.dashCd = Math.max(0, boss.dashCd - dt);
  boss.life -= dt;
  for (const c of boss.cells) c.mass = Math.max(8, c.mass * (1 - 0.014 * dt));
  const steering = steerDuobackRegularBoss(boss, players, options);
  if (boss.dbType === 'weaver') {
    boss.spikeT -= dt;
    if (boss.spikeT <= 0) {
      const c = big(boss), r = cellRadius(c);
      events.push({ type: 'spawn-virus', x: c.x - c.hx * (r + 5), z: c.z - c.hz * (r + 5), ownerId: boss.id });
      boss.spikeT = 3.5;
    }
  }
  if (boss.dbType === 'leech') {
    for (const c of boss.cells) for (const p of players) for (const pc of p.cells || []) {
      if (Math.hypot(pc.x - c.x, pc.z - c.z) > cellRadius(c) + cellRadius(pc) * 0.6 ||
          options.canEat?.(c, pc) || options.isShielded?.(p)) continue;
      const take = pc.mass * 0.07 * dt;
      if (pc.mass - take < 10) continue;
      pc.mass -= take; c.mass += take * 0.5;
      events.push({ type: 'leech-drain', playerRole: p.role, bossId: boss.id, amount: take });
    }
  }
  if (boss.dbType === 'twins' && boss.enr === 0 && options.otherTwinWasOnAndGone) {
    boss.enr = 1; events.push({ type: 'twin-enraged', bossId: boss.id });
  }
  if (boss.life <= 0) {
    for (const c of [...boss.cells]) options.removeCell?.(c);
    events.push({ type: 'boss-expired', bossId: boss.id });
    return { events, expired: true, steering };
  }
  return { events, expired: false, steering };
}

export function tickDuobackPlayerRespawn(player, matchTime, spawnPlayer) {
  if (player.cells?.length || player.respawnAt === undefined || matchTime < player.respawnAt) return false;
  delete player.respawnAt;
  spawnPlayer(player);
  return true;
}
