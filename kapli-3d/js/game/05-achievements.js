  // ================= achievements =================
  function achTotals() {
    const t = save.totals;
    return {
      kills: t.kills + (running ? stats.kills : 0), bosses: t.bosses + (running ? stats.bosses : 0),
      minions: t.minions + (running ? stats.minions : 0), crumbs: t.crumbs + (running ? stats.crumbs : 0),
      ejects: t.ejects + (running ? stats.ejects : 0), rounds: t.rounds,
      starKills: (t.starKills || 0) + (running ? stats.starKills || 0 : 0), bestCombo: Math.max(t.bestCombo || 0, running ? stats.bestCombo || 0 : 0),
      bossTypes: [...new Set([...save.bossTypes, ...(running ? stats.bossTypes : [])])],
    };
  }
  // stepped achievements pay every step they reach; the achievement counts as done at the last step
  function checkSteps(T) {
    save.achT = save.achT || {}; const got = [];
    for (const a of ACH) { if (!a.steps || save.ach.includes(a.id)) continue;
      const reach = Math.min(a.steps.length, a.stepOf(T, save.achBest)); let cur = save.achT[a.id] || 0;
      while (cur < reach) { save.coins += a.pay[cur]; toast(`${a.name}${a.line ? ' ' + ['I', 'II', 'III'][cur] : ''}: ${a.steps[cur]} +${a.pay[cur]} ◆`); cur++; }
      save.achT[a.id] = cur; if (cur >= a.steps.length) { save.ach.push(a.id); if (a.title && !save.decor.includes(a.title)) save.decor.push(a.title); got.push({ ...a, coins: 0 }); } }
    return got;
  }
  function checkAch() {
    if (!stats || stats.maxParts === undefined) return [];
    const B = save.achBest = save.achBest || {};
    B.mass = Math.max(B.mass || 0, stats.maxMass || 0);
    if (stats.mode === 'survival') { B.survT = Math.max(B.survT || 0, stats.time || 0); B.wave = Math.max(B.wave || 0, stats.wave || 0); }
    const T = achTotals(), got = checkSteps(T);
    for (const a of ACH) {
      if (a.steps) continue;
      if (save.ach.includes(a.id) || !a.test(T, stats)) continue;
      save.ach.push(a.id); save.coins += a.coins; got.push(a);
      toast(`Достижение: ${a.name} +${a.coins} ◆`);
    }
    if (pbgCheck().length) persist();
    if (got.length) persist();
    return got;
  }

  function setColossusLook(name, color) {
    colossus.name = name;
    for (const v of [...colossus.free, ...colossus.cells.map(c => c.vis)]) { v.mesh.material.color.set(color); v.mesh.material.emissive.set(color); v.glow.material.color.set(color); }
  }
  function spawnRaidChunk() {
    const r = raidState(), dealt = stats.raidDmg || 0, left = Math.min(RAID_HP - r.dmg - dealt, RAID_ATTEMPT_CAP - dealt);
    if (left <= 0) return false;
    const [x, z] = safeSpot(45);
    const c = addCell(colossus, x, z, Math.min(12000, left), colossus.free.pop());
    c.mergeT = 1e9; colossus.think = 0; colossus.target = null; colossus.splitCd = 0;
    rebuildCells(); stats.raidSpawned = true;
    return true;
  }
  function startRound() {
    fixModeForLeague();
    if (!pendingRanked && !pendingTut && MODES[save.mode].lvl && playerLevel() < MODES[save.mode].lvl) { toast(`«${MODES[save.mode].name}» откроется на ${MODES[save.mode].lvl} уровне`); return; }
    if (!pendingRanked && !pendingTut && save.mode === 'raid') {
      const r = raidState();
      if (r.done) { toast('Босс этой недели уже повержен. Новый — в понедельник'); return; }
      if (r.tries >= RAID_TRIES) { toast('Попытки на сегодня закончились. Приходи завтра'); return; }
      r.tries++; persist();
    }
    const isTut = pendingTut; pendingTut = false; tut = null;
    const isChaos = pendingChaos && pendingRanked; pendingChaos = false;
    const isRb = !isTut && !isChaos && !pendingRanked && save.mode === 'rbuild';
    runBuild = isTut ? [...ABIL_CFG.oldBuild] : isChaos ? chaosDraw() : pendingRanked ? [...ABIL_CFG.rankedBuild] : isRb ? rbuildDraw() : [...save.build];
    abReset();
    bots.forEach(o => { o.build = isTut ? [] : botBuild(isChaos, pendingRanked && !isChaos); o.dashT = 0; });
    U = pendingRanked || isTut ? ZERO_UP : save.up;
    [...player.cells].forEach(removeCell);
    bots.forEach(o => [...o.cells].forEach(removeCell));
    [...bossOwners, colossus, ...minions].forEach(o => [...o.cells].forEach(removeCell));
    rebuildCells();
    effects = { speed: 0, shield: 3, double: 0, magnet: 0 };   // short spawn protection
    addCell(player, 0, 0, START_MASS + (U.big || 0), freeVis.pop());
    rebuildCells();
    player.dashCd = 0; player.dashT = 0;
    owners.forEach(o => o.splitCd = 0);
    lives = mode === 'hardcore' ? 0 : U.life;
    dashCdBase = dailyIs('dashonly') ? 1 : 4 * (1 - 0.03 * U.dash);
    mode = isTut ? 'classic' : isChaos ? seasonMode(save.chaos.id) : pendingRanked ? leagueMode() : save.mode;
    if (isTut) lives = 99;
    const ranked = pendingRanked;
    player.ejectCd = 0;
    stats = { mode, ranked, time: 0, maxMass: total(player), kills: 0, bosses: 0, minions: 0, bossCoins: 0, bossXp: 0, bonuses: 0, splits: 0, crumbs: 0, leader: 0, bestRank: 99, wave: 0,
              ejects: 0, maxPart: 0, maxParts: 1, bossTypes: [], finalRank: 0, timedWin: false, achGot: [], tutorial: isTut, abUsed: {}, chaos: isChaos, lvStart: playerLevel() };
    clearEjects();
    stats.arena = ranked || isTut ? null : save.arena;
    resetViruses(); virusRespawn = []; resetEvents();
    history = [Math.round(total(player))];
    doneQuests = new Set();
    effects.shield += 2 * petLv('shield');
    zoneR = R;
    bots.forEach(o => o.disabled = false);
    bossTimer = mode === 'survival' ? 5 : dailyIs('bosses') ? 10 : 20; bonusTimer = 0;
    bonuses.forEach(b => scene.remove(b.mesh)); bonuses = [];
    running = true; paused = false; dying = false;
    // teams: you + 5 allies (blue) vs 6 rivals (red); the 12th bot sits out
    player.team = mode === 'team' ? 'A' : null;
    const extraOff = mode === 'team' || mode === 'raid' || mode === 'royale' || ranked;
    bots.forEach((o, i) => { o.team = mode === 'team' ? (i < 5 ? 'A' : 'B') : null; o.disabled = (mode === 'team' && i >= 11) || (extraOff && i >= 12) || isTut; o.crownT = 0;
      o.jit = .9 + Math.random() * .2; o.spikeBlind = false; o.spikeMemT = 0; });
    player.crownT = 0;
    pickStarBot();
    bots.forEach(spawnBot);
    { const sb = bots.find(o => o.star && o.cells.length); if (sb) setTimeout(() => { if (running) toast(`На арене звезда «${sb.name}»: съешь её за +${STAR_COINS} ◆`); }, 1500); }
    if (mode === 'raid') {
      const b = raidBoss(raidWeek()); setColossusLook(b.name, b.color);
      stats.raidDmg = 0; spawnRaidChunk();
      toast(`Рейд: ${b.name}. Подплывай ближе — он делится. Ешь части, чтобы нанести урон`);
    }
    if (!isTut) { spawnBonus(); spawnBonus(); }
    $('overlay').hidden = true;
    setGameUi(true);
    if (isTut) tutBegin();
    if (isChaos) chaosBanner(); else if (isRb) chaosBanner('Случайный билд · способности на этот раунд');
    if (stats.arena && stats.arena !== 'default') setTimeout(() => { if (running) toast(`Арена «${arenaDef().name}»: ${ARENA_FX[stats.arena]}`); }, 2600);
  }
  function setGameUi(on) {
    $('board').hidden = $('miniWrap').hidden = $('effects').hidden = $('actions').hidden = $('pauseBtn').hidden = !on; if (!on) $('modeTimer').hidden = true;
    if (on) renderSlots();
  }
