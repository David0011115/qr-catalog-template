// Deterministic world side effects shared by bosses and abilities.
import { canSpawnVirus, createVirus } from '../core/viruses.js';
import { BONUS_EFFECT_SECONDS, BONUS_TYPES } from '../core/bonuses.js';
import { cellRadius } from '../core/physics.js';

export function spawnBossVirus(world, event) {
  if (!world || !Array.isArray(world.viruses) ||
      !Number.isFinite(event?.x) || !Number.isFinite(event?.z) ||
      !canSpawnVirus(world.viruses.length)) return null;
  const virus = createVirus(event.x, event.z);
  world.viruses.push(virus);
  return virus;
}

// Source-matched burstFood(): relocate existing food slots into a ring. The
// stable food IDs remain unchanged so both clients can update instanced meshes.
export function burstFoodInWorld(world, random, x, z, radius, count, inner = 0) {
  if (!world || !Array.isArray(world.food) || typeof random?.next !== 'function' ||
      ![x, z, radius, count, inner, world.arenaRadius].every(Number.isFinite) ||
      radius < 0 || count < 0 || inner < 0 || inner > radius) {
    throw new TypeError('world, deterministic random source and valid burst geometry are required');
  }
  if (!world.food.length || count === 0) return 0;
  world.pendingFoodChanges ||= [];
  let moved = 0;
  const total = Math.floor(count);
  for (let i = 0; i < total; i++) {
    const index = Math.floor(random.next() * world.food.length);
    const angle = random.next() * Math.PI * 2;
    const distance = inner + Math.sqrt(random.next()) * (radius - inner);
    const fx = x + Math.cos(angle) * distance;
    const fz = z + Math.sin(angle) * distance;
    if (Math.hypot(fx, fz) > world.arenaRadius - 1.5) continue;
    const food = world.food[index];
    food.x = fx;
    food.z = fz;
    world.pendingFoodChanges.push({ id: food.id, x: fx, z: fz });
    moved++;
  }
  return moved;
}


export function applyBonusPickup(world, owner, bonus, random) {
  if (!world || !owner || !bonus || !BONUS_TYPES.includes(bonus.type)) return false;
  if (bonus.type === 'fountain') {
    const cells = owner.cells || [];
    if (!cells.length) return false;
    const total = cells.reduce((sum, cell) => sum + cell.mass, 0);
    const main = cells.reduce((largest, cell) => !largest || cell.mass > largest.mass ? cell : largest, null);
    const x = cells.reduce((sum, cell) => sum + cell.x * cell.mass, 0) / Math.max(1, total);
    const z = cells.reduce((sum, cell) => sum + cell.z * cell.mass, 0) / Math.max(1, total);
    const radius = cellRadius(main);
    const count = Math.round(Math.min(160, 60 + total / 40));
    burstFoodInWorld(world, random, x, z, radius * 1.8 + 12, count, radius + 1.5);
    return true;
  }
  owner.eff ||= { speed: 0, shield: 0, double: 0, magnet: 0 };
  const duration = BONUS_EFFECT_SECONDS[bonus.type];
  const cap = bonus.type === 'shield' ? 10 : 30;
  owner.eff[bonus.type] = Math.min(cap, Math.max(0, Number(owner.eff[bonus.type]) || 0) + duration);
  return true;
}
