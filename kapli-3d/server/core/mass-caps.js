// Mass and merge caps extracted from js/game/01-config.js, js/game/04-arena.js and js/game/07-round.js.
export const MASS_CAPS = Object.freeze({
  fallback: 15000,
  regularBot: 10000,
  ordinaryBoss: 12000,
  survivalBoss: 30000,
  raidBoss: 20000,
});

export function mergeMassCap(owner, mode = 'classic', caps = MASS_CAPS) {
  if (owner?.isPlayer) return Infinity;
  if (owner?.kind === 'bot') return caps.regularBot;
  if (owner?.kind === 'boss') {
    if (mode === 'survival') return caps.survivalBoss;
    if (mode === 'raid') return caps.raidBoss;
    return caps.ordinaryBoss;
  }
  return caps.fallback;
}

export function canMergeCells(a, b, mode = 'classic', caps = MASS_CAPS) {
  if (!a || !b || a.owner !== b.owner) return false;
  if (a.mergeT > 0 || b.mergeT > 0) return false;
  return a.mass + b.mass <= mergeMassCap(a.owner, mode, caps);
}

// Mirrors the source update order: per-cell caps first, then a shared total cap
// across every regular bot's cells. Player cells intentionally have no cap.
export function applyMassCaps(cells, bots = [], mode = 'classic', caps = MASS_CAPS) {
  const cappedCells = [];
  for (const cell of cells) {
    if (!cell?.owner?.isPlayer) {
      const cap = mergeMassCap(cell.owner, mode, caps);
      if (cell.mass > cap) { cell.mass = cap; cappedCells.push(cell); }
    }
  }
  const scaledBots = [];
  for (const bot of bots) {
    const total = (bot.cells || []).reduce((sum, cell) => sum + cell.mass, 0);
    if (total > caps.regularBot) {
      const scale = caps.regularBot / total;
      for (const cell of bot.cells) cell.mass *= scale;
      scaledBots.push({ ownerId: bot.id ?? null, scale, totalBefore: total, totalAfter: caps.regularBot });
    }
  }
  return { cappedCells, scaledBots };
}
