export const BONUS_TYPES = Object.freeze(['speed', 'shield', 'double', 'magnet', 'fountain']);
export const BONUS_MAX = 6;
export const BONUS_SPAWN_SECONDS = 9;
export const BONUS_EFFECT_SECONDS = Object.freeze({ speed: 7, shield: 5, double: 8, magnet: 8 });

export function spawnBonuses(world, random, count = 1) {
  if (!world || !Array.isArray(world.bonuses) || typeof random?.next !== 'function' ||
      !Number.isFinite(world.arenaRadius) || !Number.isFinite(count) || count < 0) {
    throw new TypeError('world, deterministic random source and valid bonus count are required');
  }
  let spawned = 0;
  for (let i = 0; i < Math.floor(count) && world.bonuses.length < BONUS_MAX; i++) {
    const type = BONUS_TYPES[Math.floor(random.next() * BONUS_TYPES.length)];
    const angle = random.next() * Math.PI * 2;
    const distance = Math.sqrt(random.next()) * Math.max(0, world.arenaRadius - 8);
    const id = `bonus:${world.nextEntitySequence++}`;
    world.bonuses.push({ id, type, x: Math.cos(angle) * distance, z: Math.sin(angle) * distance });
    spawned++;
  }
  return spawned;
}

export function tickBonusEffects(world, dt) {
  if (!world || !Array.isArray(world.owners) || !Number.isFinite(dt) || dt < 0) {
    throw new TypeError('world and non-negative delta time are required');
  }
  for (const owner of world.owners) {
    if (!owner?.eff || typeof owner.eff !== 'object') continue;
    for (const type of ['speed', 'shield', 'double', 'magnet']) {
      owner.eff[type] = Math.max(0, (Number(owner.eff[type]) || 0) - dt);
    }
  }
}
