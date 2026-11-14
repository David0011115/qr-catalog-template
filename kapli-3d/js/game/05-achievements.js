  // ================= achievements =================
  // ================= 2.2: achievement emblems =================
  // a rosette medal per achievement: own icon and colour, the metal shows the stage (I bronze · II silver · III gold; holidays: 6 steps)
  const ACH_ART = {
    ln_hunter:  ['#ff3d6e', '<path d="M18.5 8.5A8 8 0 1 0 19 16l-4.5-2 4.5-1.5z"/><circle cx="10" cy="9.6" r="1.2" fill="currentColor"/>'],
    ln_boss:    ['#ff9a3d', '<path d="M5 11a7 7 0 0 1 14 0v3l-2 2v3.5H7V16l-2-2z"/><circle cx="9.3" cy="12" r="1.7"/><circle cx="14.7" cy="12" r="1.7"/><path d="M6.6 6.2L4.2 2.8M17.4 6.2l2.4-3.4"/>'],
    ln_duo:     ['#3dffa2', '<circle cx="8" cy="12" r="4.5"/><circle cx="16" cy="12" r="4.5"/><path d="M12 4.5v15" stroke-dasharray="2 2"/>'],
    ln_star:    ['#ffd23f', '<path d="M12 3l2.6 5.6 6.1.7-4.5 4.1 1.2 6L12 16.4 6.6 19.4l1.2-6-4.5-4.1 6.1-.7z"/>'],
    ln_giant:   ['#3dffa2', '<circle cx="13.5" cy="14.5" r="6.5"/><circle cx="5" cy="19" r="2"/><path d="M13.5 8V2.5M11 5l2.5-2.5L16 5"/>'],
    ln_combo:   ['#22e6ff', '<path d="M13.5 2.5L5 13.5h6l-1.5 8 8.5-11h-6z"/>'],
    ln_surv:    ['#b26bff', '<path d="M7 3h10M7 21h10M8 3c0 5.5 8 5.5 8 9s-8 3.5-8 9M16 3c0 5.5-8 5.5-8 9s8 3.5 8 9"/>'],
    ln_league:  ['#4d7cff', '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20.5h7M9.5 17h5"/>'],
    ln_season:  ['#9fe8ff', '<path d="M6 21V3.5M6 4h11l-2.5 4L17 12H6"/>'],
    ln_chaos:   ['#ff2d55', '<path d="M12 12a1.5 1.5 0 1 1 1.5-1.5 3.5 3.5 0 0 1-3.5 3.5 5 5 0 0 1-5-5 6.5 6.5 0 0 1 6.5-6.5 8 8 0 0 1 8 8 9.5 9.5 0 0 1-9.5 9.5"/>'],
    ln_arsenal: ['#ff6ad5', '<path d="M7 2.5l3.5 3.5L7 9.5 3.5 6zM17 2.5l3.5 3.5-3.5 3.5L13.5 6zM7 14.5l3.5 3.5L7 21.5 3.5 18zM17 14.5l3.5 3.5-3.5 3.5-3.5-3.5z"/>'],
    ny:         ['#9fe8ff', '<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9.5 4.5L12 7l2.5-2.5M9.5 19.5L12 17l2.5 2.5"/>'],
    vd:         ['#ff4fd8', '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>'],
    hw:         ['#ff9a3d', '<path d="M12 7.5c-5 0-8 3-8 6.5s3 6 8 6 8-2.5 8-6-3-6.5-8-6.5z"/><path d="M12 7.5c-2 2.5-2 10 0 12.5M12 7.5c2 2.5 2 10 0 12.5M12 7.5V4.5l2-1.5"/>'],
  };
  const METAL = { 0: ['#5a557a', '#3a3560', '#211d3c'], 1: ['#ffd2a8', '#cd7f32', '#6e3a12'], 2: ['#ffffff', '#b9c2e0', '#5b6488'], 3: ['#fff6b0', '#ffc93a', '#a8650a'] };
  const METAL_NAME = ['', 'Бронза', 'Серебро', 'Золото'];
  const ROM3 = ['', 'I', 'II', 'III'];
  const achById = id => ACH.find(a => a.id === id);
  const achTier = a => !a || !a.steps ? 0 : save.ach.includes(a.id) ? a.steps.length :   // one-off achievements (a gift box) have no steps
    Math.min(a.steps.length, (save.achT || {})[a.id] || 0);
  // stage → metal: lines map 1:1; holidays (6 steps): 1–2 bronze, 3–4 silver, 5–6 gold
  const achMetal = (a, t) => !t ? 0 : a.steps.length <= 3 ? t : t <= 2 ? 1 : t <= 4 ? 2 : 3;
  const achArtOf = a => ACH_ART[a.id] || ACH_ART[a.id.split('_')[0]] || ['#22e6ff', '<circle cx="12" cy="12" r="7"/>'];
  let emUid = 0;
  function achEmblem(a, t, size = 64) {
    const [ac, ic] = achArtOf(a), m = achMetal(a, t), [m1, m2, m3] = METAL[m], id = 'em' + (++emUid), top = t && t >= a.steps.length;
    let ros = ''; for (let i = 0; i < 32; i++) { const r = i % 2 ? 27.2 : 30.5, g = (i / 32) * Math.PI * 2 - Math.PI / 2; ros += `${i ? 'L' : 'M'}${(32 + Math.cos(g) * r).toFixed(2)} ${(32 + Math.sin(g) * r).toFixed(2)}`; }
    const label = !t ? '' : a.steps.length <= 3 ? ROM3[t] : `${t}/${a.steps.length}`;
    return `<svg class="ach-em${top ? ' top' : ''}${t ? '' : ' off'}" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true" style="--ac:${ac}">` +
      `<defs><linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${m1}"/><stop offset=".5" stop-color="${m2}"/><stop offset="1" stop-color="${m3}"/></linearGradient>` +
      `<radialGradient id="${id}i" cx=".5" cy=".35" r=".75"><stop offset="0" stop-color="${t ? ac : '#2a2550'}" stop-opacity="${t ? .55 : 1}"/><stop offset="1" stop-color="#0b0624"/></radialGradient></defs>` +
      `<path d="${ros}Z" fill="url(#${id}m)"/><circle cx="32" cy="32" r="22.5" fill="#0b0624" opacity=".55"/><circle cx="32" cy="32" r="21" fill="url(#${id}i)" stroke="${m2}" stroke-width="1.2"/>` +
      `<g transform="translate(18.5 17.5) scale(1.125)" fill="none" stroke="${t ? '#fff' : '#8f89b8'}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" color="${t ? '#fff' : '#8f89b8'}" opacity="${t ? 1 : .55}">${ic}</g>` +
      (label ? `<rect x="${32 - (label.length > 2 ? 11 : 8.5)}" y="49" width="${label.length > 2 ? 22 : 17}" height="11" rx="5.5" fill="${m3}" stroke="${m1}" stroke-width="1"/><text x="32" y="57.4" text-anchor="middle" font-size="8" font-weight="800" font-family="Golos Text, sans-serif" fill="#fff">${label}</text>` : '') +
      (top ? '<path d="M8 12l1.2 2.8L12 16l-2.8 1.2L8 20l-1.2-2.8L4 16l2.8-1.2zM56 6l1 2.2 2.2 1-2.2 1-1 2.2-1-2.2-2.2-1 2.2-1z" fill="#fff6b0"/>' : '') + '</svg>';
  }
  // numeric progress where a line counts one number; the rest show only the next step
  const ACH_VAL = { ln_hunter: [T => T.kills, [50, 500, 5000]], ln_boss: [T => T.bosses, [1, 50, 500]], ln_star: [T => T.starKills, [1, 25, 250]],
    ln_giant: [(T, B) => B.mass || 0, [1500, 5000, 12000]], ln_combo: [T => T.bestCombo, [5, 10, 15]], ln_season: [() => save.seasonLog.length, [1, 6, 26]], ln_duo: [() => duoBestWave(), [10, 20, 30]] };
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
    const c2 = '#' + new THREE.Color(color).offsetHSL(.5, 0, 0).getHexString();   // the twin: the opposite colour of the week
    colossus.name = name; colossus2.name = `${name}-близнец`; BOSS_TYPES_EXTRA.colossus2.color = c2;
    for (const [o, col] of [[colossus, color], [colossus2, c2]]) for (const v of [...o.free, ...o.cells.map(c => c.vis)]) { v.mesh.material.color.set(col); v.mesh.material.emissive.set(col); v.glow.material.color.set(col); }
  }
  function spawnRaidChunk() {
    const r = raidState(), dealt = stats.raidDmg || 0, left = Math.min(RAID_HP - r.dmg - dealt, RAID_ATTEMPT_CAP - dealt);
    if (left <= 0) return false;
    const [x, z] = safeSpot(45), a = Math.random() * 6.283;
    raidTwins.forEach((o, k) => {   // the twins come together, side by side
      [...o.cells].forEach(removeCell);
      const c = addCell(o, x + Math.cos(a + k * Math.PI) * 30, z + Math.sin(a + k * Math.PI) * 30, Math.min(9000, Math.max(200, left / 2)), o.free.pop());
      c.mergeT = 1e9; o.think = 0; o.target = null; o.splitCd = 0;
    });
    rebuildCells(); stats.raidSpawned = true;
    return true;
  }
  function startRound() {
    fixModeForLeague();
    if (!pendingRanked && !pendingTut && MODES[save.mode].lvl && playerLevel() < MODES[save.mode].lvl) { toast(`«${MODES[save.mode].name}» откроется на ${MODES[save.mode].lvl} уровне`); return; }
    if (!pendingRanked && !pendingTut && save.mode === 'raid') {
      const r = raidState();
      if (r.done) { toast('Босс этой недели уже повержен. Новый — в понедельник'); return; }
      const extra = raidPerk().tries && r.bonusWeek !== r.week ? 1 : 0;   // «Шлем рейдера»: one more try a week
      if (r.tries >= RAID_TRIES + extra) { toast('Попытки на сегодня закончились. Приходи завтра'); return; }
      r.tries++; if (r.tries > RAID_TRIES) { r.bonusWeek = r.week; toast('Использована недельная попытка «Шлема рейдера»'); } persist();
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
    [...bossOwners, ...raidTwins, ...minions].forEach(o => [...o.cells].forEach(removeCell));
    rebuildCells();
    effects = { speed: 0, shield: 3, double: 0, magnet: 0 };   // short spawn protection
    addCell(player, 0, 0, (TEST_MODE && testStartMass) || START_MASS + (U.big || 0), freeVis.pop());
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
    bossTimer = mode === 'survival' ? 5 : dailyIs('bosses') ? 10 : 20; bonusTimer = 0; crPetReset();
    bonuses.forEach(b => scene.remove(b.mesh)); bonuses = [];
    running = true; paused = false; dying = false;
    // teams: you + 5 allies (blue) vs 6 rivals (red); the 12th bot sits out
    player.team = mode === 'team' ? 'A' : null;
    const extraOff = mode === 'team' || mode === 'raid' || mode === 'royale' || ranked;
    bots.forEach((o, i) => { o.team = mode === 'team' ? (i < 5 ? 'A' : 'B') : null; o.disabled = (mode === 'team' && i >= 11) || (extraOff && i >= 12) || isTut || (o.tExtra && mode !== 'territory'); o.crownT = 0;
      o.jit = .9 + Math.random() * .2; o.spikeBlind = false; o.spikeMemT = 0; });
    player.crownT = 0;
    pickStarBot();
    bots.forEach(spawnBot);
    { const sb = bots.find(o => o.star && o.cells.length); if (sb) setTimeout(() => { if (running) toast(`На арене звезда «${sb.name}»: съешь её за +${STAR_COINS} ◆`); }, 1500); }
    if (mode === 'raid') {
      const b = raidBoss(raidWeek()); setColossusLook(b.name, b.color);
      stats.raidDmg = 0; spawnRaidChunk();
      const pk = raidPerk();
      toast(`Рейд: ${b.name} и близнец. Разведи их — пока они рядом, связь гасит половину урона${pk.dmg > 1 ? `. Твой бонус: урон +${Math.round((pk.dmg - 1) * 100)}%` : ''}`);
    }
    if (!isTut) { spawnBonus(); spawnBonus(); }
    ModeX.start();
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
