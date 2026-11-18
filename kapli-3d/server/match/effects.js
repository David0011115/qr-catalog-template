// Deterministic world side effects shared by bosses and abilities.
import { canSpawnVirus, createVirus } from '../core/viruses.js';

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
