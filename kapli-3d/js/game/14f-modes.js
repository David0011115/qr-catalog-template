  // ================= 2.5: livelier solo modes =================
  // «Классика»: milestones inside the round and an arena that heats up every 3 minutes.
  // «На время»: one random rule per round, a final rush in the last 30 s, a reward for every place and for climbing.
  // «Выживание»: bosses grow gentler, melt while they live (so they can be eaten late), every 5th wave is special and a break follows.
  const ModeX = (() => {
    const MILES = [[1000, 30], [3000, 60], [6000, 100], [10000, 160]];
    const ESC_S = 180, ESC_MAX = 4, RUSH_S = 30;
    const RULES = [
      { id: 'bonus2', name: 'Двойные бонусы', about: 'бонусы появляются вдвое чаще' },
      { id: 'fastbots', name: 'Быстрые боты', about: 'боты на 15% быстрее' },
      { id: 'spikes', name: 'Шипы повсюду', about: 'вдвое больше шипов' },
      { id: 'feast', name: 'Пир', about: 'крошки дают в полтора раза больше' },
    ];
    let rule = null, mile = 0, esc = 0, rushOn = false, breakAt = 0;
    const solo = () => !stats.ranked && !stats.tutorial && !stats.chaos && !DuoM.on;

    function start() {
      rule = null; mile = 0; esc = 0; rushOn = false; breakAt = 0;
      stats.modeXCoins = 0;
      if (mode === 'timed' && solo()) {
        rule = RULES[(Math.random() * RULES.length) | 0]; stats.timedRule = rule.id;
        if (rule.id === 'spikes') for (let k = 0; k < VIRUS_COUNT; k++) spawnVirus();
        setTimeout(() => { if (running && mode === 'timed') toast(`Правило раунда: «${rule.name}» — ${rule.about}`); }, 1800);
      }
    }
    function tick(dt) {
      if (dying || !running) return;
      if (mode === 'classic' && solo()) {
        const m = total(player);
        while (mile < MILES.length && m >= MILES[mile][0]) {
          const [goal, coins] = MILES[mile++]; stats.modeXCoins += coins;
          toast(`Веха ${goal.toLocaleString('ru-RU')}! +${coins} ◆`); Sound.play('level');
          if (player.cells.length) { const [x, z] = centerOf(player), r = cellR(mainOf(player)); for (let k = 0; k < 5; k++) emit(x, r + 1, z, k % 2 ? '#ffd23f' : '#22e6ff', 18, 12 + k * 2, .9); wave(x, z, '#ffd23f', r, r + 26, .8); }
        }
        const e = Math.min(ESC_MAX, Math.floor(stats.time / ESC_S));
        if (e > esc) { esc = e; stats.modeXCoins += 20 * esc; toast(`Арена накаляется: уровень ${esc + 1}. Боты быстрее, боссы чаще, награда выше (+${20 * esc} ◆)`); Sound.play('boss'); }
      }
      if (mode === 'timed' && !rushOn && stats.time >= TIMED_LEN - RUSH_S) { rushOn = true; toast('Финальный рывок! 30 секунд, крошки вдвое сытнее'); Sound.play('level'); }
      if (mode === 'timed' && stats.midRank === undefined && stats.time >= TIMED_LEN / 2) stats.midRank = rankOf();
      if (mode === 'survival') {
        for (const o of bossOwners) for (const c of o.cells) c.mass = Math.max(20, c.mass * (1 - .01 * dt));   // they melt: late in their life you can eat them
        if (breakAt && stats.time >= breakAt) {
          breakAt = 0; toast('Передышка: вокруг еда, следующая волна чуть позже');
          if (player.cells.length) { const [x, z] = centerOf(player); burstFood(x, z, 80, 120, cellR(mainOf(player)) + 4); }
          spawnBonus(); spawnBonus();
        }
      }
    }
    const rankOf = () => owners.filter(o => o.cells.length && o.kind !== 'minion').sort((a, b) => total(b) - total(a)).indexOf(player) + 1;
    // «Выживание»: called when a new wave comes; returns the seconds until the next one
    function survWave() {
      if (stats.wave % 5 === 0) {
        const o = bossOwners.find(b => b.cells.length && b.wave === stats.wave);
        if (o) { o.cells.forEach(c => c.mass *= 1.5); toast(`Особая волна ${stats.wave}: ${o.name} в полтора раза крупнее`); }
        breakAt = stats.time + 15; return 25;
      }
      return 15;
    }
    const survGrow = w => Math.pow(1.12, w - 1);
    // «На время»: a reward for every place, plus 5 ◆ for each place won since the middle of the round
    function placeBonus(r) {
      const base = [40, 25, 15, 12, 10, 8, 7, 6][r - 1] || 5;
      const climb = stats.midRank ? Math.min(25, Math.max(0, stats.midRank - r) * 5) : 0;
      if (climb) stats.climbBonus = climb;
      return base + climb;
    }
    return {
      start, tick, survWave, survGrow, placeBonus,
      gainK: () => (mode === 'timed' ? (rushOn ? 2 : 1) * (rule && rule.id === 'feast' ? 1.5 : 1) : 1),
      bonusK: () => (rule && rule.id === 'bonus2' ? .5 : 1),
      botSpeedK: o => (o.kind === 'bot' ? (mode === 'classic' ? 1 + .04 * esc : rule && rule.id === 'fastbots' ? 1.15 : 1) : 1),
      bossK: () => (mode === 'classic' ? Math.max(.5, 1 - .125 * esc) : 1),
      quitLabel: () => (mode === 'classic' && stats.time >= 300 ? 'Забрать награду и выйти' : 'Завершить раунд'),
      chip() {
        if (mode === 'classic' && solo()) { const nx = MILES[mile]; return nx ? `Веха ${nx[0].toLocaleString('ru-RU')} · осталось ${Math.max(0, Math.ceil(nx[0] - total(player))).toLocaleString('ru-RU')}${esc ? ` · арена ур. ${esc + 1}` : ''}` : `Все вехи взяты${esc ? ` · арена ур. ${esc + 1}` : ''}`; }
        if (mode === 'timed') {
          const parts = []; if (rule) parts.push(rule.name);
          if (rushOn) {
            const ranked = owners.filter(o => o.cells.length && o.kind !== 'minion').sort((a, b) => total(b) - total(a)), r = ranked.indexOf(player);
            parts.push(r > 0 ? `рывок · до ${r}-го места ${Math.ceil(total(ranked[r - 1]) - total(player))}` : 'рывок · ты первый!');
          }
          return parts.join(' · ');
        }
        if (mode === 'survival' && breakAt) return 'особая волна';
        return '';
      },
    };
  })();
