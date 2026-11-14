  // ================= 2.5: livelier solo modes =================
  // «Классика»: milestones inside the round and an arena that heats up every 3 minutes.
  // «На время»: one random rule per round, a final rush in the last 30 s, a reward for every place and for climbing.
  // «Выживание»: bosses grow gentler, melt while they live (so they can be eaten late), every 5th wave is special and a break follows.
  // «Босс-рейд» perks earned by beating the weekly twins (like skin stars: small, never game-breaking)
  //  every win: +2% damage to the twins (up to +10%) · 1 win («Аура рейдера»): +3% coins in the raid · 3 wins («Шлем рейдера»): one more try a week
  function raidPerk() { const w = save.raidWins || 0; return { dmg: 1 + .02 * Math.min(5, w), coins: w >= 1, tries: w >= 3 }; }
  // «Режим дня»: one solo mode a day pays ×1,25 coins (the badge moves to another mode every day)
  const DAY_POOL = ['classic', 'timed', 'survival', 'crown', 'rbuild', 'hardcore'];
  const dayMode = () => { let h = 7; for (const ch of today) h = (h * 31 + ch.charCodeAt(0)) % 100003; return DAY_POOL[h % DAY_POOL.length]; };
  const DAY_MARK = '<span class="day-mark">🔥 режим дня · ◆ ×1,25</span>';
  const ModeX = (() => {
    const MILES = [[1000, 30], [3000, 60], [6000, 100], [10000, 160], [15000, 220], [20000, 300], [25000, 400], [30000, 600]];   // 2.7: up to 30 000, the last gives «Вершина»
    const ESC_S = 180, ESC_MAX = 4, RUSH_S = 45;
    const RULES = [
      { id: 'bonus2', name: 'Двойные бонусы', about: 'бонусы появляются вдвое чаще' },
      { id: 'fastbots', name: 'Быстрые боты', about: 'боты на 15% быстрее' },
      { id: 'spikes', name: 'Шипы повсюду', about: 'вдвое больше шипов' },
      { id: 'feast', name: 'Пир', about: 'крошки дают в полтора раза больше' },
    ];
    let rule = null, mile = 0, esc = 0, rushOn = false, breakAt = 0;
    // «Захват короны»: the crown lies in the middle until someone takes it, then passes only to whoever eats its holder
    let crownGround = null, crownLast = { x: 0, z: 0 };
    // «Хардкор»: small boosts at 2 000 … 25 000 mass (pick one of two), no shields and no second lives (2.7: three more steps and «Таяние −10%»)
    // 2.7: 11 milestones up to 50 000; each card's rarity is never below the step's floor and may roll one step higher;
    // values by rarity (common / rare / epic / legendary); one boost at most HC_CAP times a round
    const HC_MILES = [2000, 5000, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000];
    const HC_TIER = [[0, .25], [0, .25], [1, .25], [1, .25], [2, .15], [2, .15], [2, .3], [2, .45], [2, .6], [2, .75], [3, 0]];   // [floor, chance of one step higher]
    // 2.7 after the owner's test (best 18–20k): «Хардкор» melts 25% slower than before (0.003), still twice the other modes
    const HC_DECAY = .00225;
    const HC_CAP = 3, HC_R = ['common', 'rare', 'epic', 'legendary'], HC_RN = ['Обычное', 'Редкое', 'Эпическое', 'Легендарное'];
    const HC_BOOST = {   // [icon, name, values, kind: '+' adds a percent, '-' multiplies by (1 − percent)]
      speed: ['⚡', 'Скорость', [4, 6, 8, 10], '+'], absorb: ['🍽', 'Поглощение', [4, 6, 8, 10], '+'], cd: ['⏱', 'Перезарядка способностей', [8, 12, 16, 20], '-'],
      melt: ['🧊', 'Таяние', [8, 12, 16, 20], '-'], skin: ['🛡', 'Толстая кожа', [3, 5, 7, 9], '+'], magnet: ['🧲', 'Притяжение крошек', [10, 15, 20, 25], '+'],
      dash: ['💨', 'Короткий рывок', [10, 15, 20, 25], '-'], merge: ['🔗', 'Быстрое слияние', [10, 15, 20, 25], '-'], predator: ['🩸', 'Хищник', [8, 10, 12, 15], '+'], coins: ['💰', 'Добытчик', [4, 6, 8, 10], '+'] };
    const HC_ABOUT = { speed: 'быстрее', absorb: 'еда сытнее', cd: 'способности перезаряжаются быстрее', melt: 'масса тает медленнее', skin: 'боту надо быть крупнее, чтобы съесть тебя', magnet: 'крошки притягиваются издалека',
      dash: 'рывок перезаряжается быстрее', merge: 'части сливаются быстрее', predator: 'после съеденного бота 2 с ты быстрее', coins: 'монеты за раунд' };
    let hc = {}, hcN = {}, hcMile = 0, hcOffer = null, hcT = 0, hcPredT = 0, hcDbg = { m: 0, t: 0, gain: 0 };
    const hcReset = () => { hc = {}; hcN = {}; Object.entries(HC_BOOST).forEach(([k, b]) => { hc[k] = b[3] === '+' ? 0 : 1; hcN[k] = 0; }); };
    hcReset();
    const hcK = k => (mode !== 'hardcore' ? 1 : HC_BOOST[k][3] === '+' ? 1 + hc[k] / 100 : hc[k]);
    const hcLabel = (k, r) => { const b = HC_BOOST[k], v = b[2][r]; return `${b[1]} ${b[3] === '+' ? '+' : '−'}${v}%`; };
    // «Босс-рейд»: a glowing tether between the twins while they are close — then only half of the damage gets through
    const tether = new THREE.Mesh(new THREE.BoxGeometry(1, .35, .35), new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false }));
    tether.visible = false; scene.add(tether);
    const LINK_D = 150;
    // «Королевская битва»: the zone holds 25 s, then shrinks for 10 s toward a new circle somewhere inside the old one (shown in advance);
    // crates with bonuses fall into the next circle; the storm hurts more with every step
    const Z_HOLD = 25, Z_SHRINK = 10, Z_STEPS = [1, .75, .55, .4, .28, .18, .1];
    let zc = { x: 0, z: 0 }, zst = 0, zph = 'hold', zt = 20, zfrom = null, zto = null;
    const nextRing = new THREE.Mesh(new THREE.RingGeometry(.99, 1, 160), decal(new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .45, depthWrite: false, side: THREE.DoubleSide })));
    nextRing.rotation.x = -Math.PI / 2; nextRing.position.y = .07; nextRing.visible = false; scene.add(nextRing);
    function zPlan() {
      const r2 = Math.max(18, (Z_STEPS[zst + 1] ?? Z_STEPS[Z_STEPS.length - 1]) * R), a = Math.random() * 6.283, d = Math.max(0, zoneR - r2) * Math.sqrt(Math.random()) * .9;
      let x = zc.x + Math.cos(a) * d, z = zc.z + Math.sin(a) * d; const L = Math.hypot(x, z); if (L + r2 > R) { x *= (R - r2) / L; z *= (R - r2) / L; }
      zto = { x, z, r: r2 };
      for (let k = 0; k < 2 && bonuses.length < MAX_BONUS; k++) { const b = Math.random() * 6.283, q = Math.sqrt(Math.random()) * r2 * .8; owlNext = [x + Math.cos(b) * q, z + Math.sin(b) * q]; spawnBonus(); }
    }
    function zoneTick(dt) {
      zt -= dt;
      if (zph === 'hold' && zt <= 0) { zph = 'shrink'; zt = Z_SHRINK; zfrom = { x: zc.x, z: zc.z, r: zoneR }; if (zto && zto.r < zoneR) toast('Зона сужается!'); }
      if (zph === 'shrink') {
        const k = 1 - Math.max(0, zt) / Z_SHRINK;
        if (zto) { zc = { x: zfrom.x + (zto.x - zfrom.x) * k, z: zfrom.z + (zto.z - zfrom.z) * k }; zoneR = zfrom.r + (zto.r - zfrom.r) * k; }
        if (zt <= 0) { zst++; zph = 'hold'; zt = Z_HOLD; zPlan(); }
      }
      nextRing.visible = running && mode === 'royale' && !!zto && zto.r < zoneR - .5;
      if (nextRing.visible) { nextRing.position.set(zto.x, .07, zto.z); nextRing.scale.setScalar(zto.r); nextRing.material.opacity = .3 + .25 * Math.abs(Math.sin(stats.time * 3)); }
    }
    const twinsLinked = () => { if (!colossus.cells.length || !colossus2.cells.length) return false; const a = mainOf(colossus), b = mainOf(colossus2); return Math.hypot(a.x - b.x, a.z - b.z) < LINK_D + cellR(a) + cellR(b); };
    const solo = () => !stats.ranked && !stats.tutorial && !stats.chaos && !DuoM.on;

    function start() {
      rule = null; mile = 0; esc = 0; rushOn = false; breakAt = 0; comboOrder = [];
      document.body.classList.toggle('q-low', save.settings.quality === 'low');
      stats.modeXCoins = 0; tether.visible = false;
      crownGround = null; hcReset(); hcMile = 0; hcOffer = null; hcPredT = 0; hcDbg = { m: 0, t: 0, gain: 0 }; hcPanel(null);
      nextRing.visible = false;
      if (mode === 'royale') { zc = { x: 0, z: 0 }; zst = 0; zph = 'hold'; zt = 20; zoneR = R; zPlan(); }
      if (mode === 'crown') { crownHolder = null; { const an = Math.random() * 6.283; crownGround = { x: Math.cos(an) * R * .4, z: Math.sin(an) * R * .4 }; } [player, ...bots].forEach(o => o.crownT = 0); setTimeout(() => { if (running && mode === 'crown') toast('Корона лежит на поле (♛ на мини-карте) — хватай! Дальше она переходит только к тому, кто съест владельца'); }, 1500); }
      // 2.7: in «Захват короны» bosses do not wear their crowns — the only crown on the field is the one to fight for
      bossOwners.forEach(o => [...o.free, ...o.cells.map(c => c.vis)].forEach(v => { if (v && v.crown) v.crown.visible = mode !== 'crown'; }));
      if (mode === 'hardcore') effects.shield = Math.max(effects.shield, 7);   // a longer safe start: one life only
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
          if (goal === 30000) {   // the top: a title once, a legendary chest every time
            save.special.push({ kind: 'challenge', rar: 'legendary', title: 'Вершина' });
            if (!save.decor.includes('tt_summit')) { save.decor.push('tt_summit'); setTimeout(() => toast('Вершина «Классики»: титул «Вершина» и легендарный сундук!'), 1400); }
            else setTimeout(() => toast('Вершина «Классики»: легендарный сундук!'), 1400);
            persist();
          }
          if (player.cells.length) { const [x, z] = centerOf(player), r = cellR(mainOf(player)); for (let k = 0; k < 5; k++) emit(x, r + 1, z, k % 2 ? '#ffd23f' : '#22e6ff', 18, 12 + k * 2, .9); wave(x, z, '#ffd23f', r, r + 26, .8); }
        }
        const e = Math.min(ESC_MAX, Math.floor(stats.time / ESC_S));
        if (e > esc) { esc = e; stats.modeXCoins += 20 * esc; toast(`Арена накаляется: уровень ${esc + 1}. Боты быстрее, боссы чаще, награда выше (+${20 * esc} ◆)`); Sound.play('boss'); }
      }
      if (mode === 'timed' && !rushOn && stats.time >= TIMED_LEN - RUSH_S) { rushOn = true; toast(`Финальный рывок! ${RUSH_S} секунд, крошки вдвое сытнее`); Sound.play('level'); }
      if (mode === 'timed' && stats.midRank === undefined && stats.time >= TIMED_LEN / 2) stats.midRank = rankOf();
      if (mode === 'crown') for (const o of bossOwners) for (const c of o.cells) c.mass = Math.max(20, c.mass * (1 - .008 * dt));   // the crown's bosses melt too
      if (mode === 'hardcore' && !stats.ranked) {
        if (hcMile < HC_MILES.length && total(player) >= HC_MILES[hcMile] && !hcOffer) {
          const [floor, up] = HC_TIER[hcMile]; hcMile++;
          const ids = Object.keys(HC_BOOST).filter(k => hcN[k] < HC_CAP).sort(() => Math.random() - .5).slice(0, 2);
          if (ids.length) { hcOffer = ids.map(k => ({ k, r: Math.min(3, floor + (Math.random() < up ? 1 : 0)) })); hcT = 12; hcPanel(hcOffer);
            toast(`Масса ${HC_MILES[hcMile - 1].toLocaleString('ru-RU')}: выбери улучшение`); Sound.play('level'); }
        }
        if (hcOffer) { hcT -= dt; if (hcT <= 0) hcPick(0); }
        hcPredT = Math.max(0, hcPredT - dt);
        if (TEST_MODE) hcDebug(dt);
      }
      if (mode === 'raid') {
        const on = twinsLinked(); tether.visible = on && running;
        if (on) { const a = mainOf(colossus), b = mainOf(colossus2), dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
          tether.position.set((a.x + b.x) / 2, 2, (a.z + b.z) / 2); tether.scale.set(d, 1 + Math.sin(stats.time * 8) * .3, 1); tether.rotation.set(0, -Math.atan2(dz, dx), 0); tether.material.opacity = .45 + .3 * Math.abs(Math.sin(stats.time * 5)); }
      }
      if (mode === 'survival') {
        for (const o of bossOwners) for (const c of o.cells) c.mass = Math.max(20, c.mass * (1 - .01 * dt));   // they melt: late in their life you can eat them
        if (breakAt && stats.time >= breakAt) {
          breakAt = 0; toast('Передышка: вокруг еда, следующая волна чуть позже');
          if (player.cells.length) { const [x, z] = centerOf(player); burstFood(x, z, 80, 120, cellR(mainOf(player)) + 4); }
          spawnBonus(); spawnBonus();
        }
      }
    }
    function hcPanel(offer) {
      let el = document.getElementById('hcPick');
      if (!el) {
        el = document.createElement('div'); el.id = 'hcPick'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Выбери улучшение'); document.body.appendChild(el);
        el.addEventListener('pointerdown', e => e.stopPropagation());
        el.addEventListener('click', e => { const b = e.target.closest('[data-hi]'); if (b) hcPick(+b.dataset.hi); });
      }
      if (!offer) { el.hidden = true; return; }
      el.innerHTML = `<p>Хардкор: веха ${HC_MILES[hcMile - 1].toLocaleString('ru-RU')} — выбери улучшение</p><div class="db-opts two">${offer.map((o, i) => { const b = HC_BOOST[o.k];
        return `<button type="button" data-hi="${i}" class="hc-card r${o.r}" style="--rc:${RARITY[HC_R[o.r]].color}"><span class="hc-rar">${HC_RN[o.r]}</span><span class="ic">${b[0]}</span><b>${hcLabel(o.k, o.r)}</b><small>${HC_ABOUT[o.k]} · до конца раунда${hcN[o.k] ? ` · уже ${hcN[o.k]} из ${HC_CAP}` : ''}</small></button>`; }).join('')}</div>`;
      el.hidden = false;
    }
    function hcPick(i) {
      if (!hcOffer) return; const o = hcOffer[i] || hcOffer[0], b = HC_BOOST[o.k], v = b[2][o.r];
      if (b[3] === '+') hc[o.k] += v; else hc[o.k] *= 1 - v / 100; hcN[o.k]++;
      hcOffer = null; hcPanel(null); toast(`${HC_RN[o.r]}: ${hcLabel(o.k, o.r)} до конца раунда`);
    }
    // test build only: what the boosts give and how fast you eat vs how fast you melt
    function hcDebug(dt) {
      let el = document.getElementById('hcDbg'); if (!el) { el = document.createElement('div'); el.id = 'hcDbg'; document.body.appendChild(el); }
      const m = total(player); let melt = 0; for (const c of player.cells) if (c.mass > 100) melt += c.mass * HC_DECAY * Math.pow(c.mass / 100, .25) * (1 - .04 * U.guard) * hcK('melt');
      hcDbg.t += dt; if (hcDbg.t >= 1) { hcDbg.gain = hcDbg.gain * .7 + .3 * ((m - hcDbg.m) / hcDbg.t + melt); hcDbg.m = m; hcDbg.t = 0; }
      const list = Object.keys(HC_BOOST).filter(k => hcN[k]).map(k => `${HC_BOOST[k][0]}${HC_BOOST[k][3] === '+' ? '+' + hc[k] : '−' + Math.round((1 - hc[k]) * 100)}%`).join(' ');
      el.textContent = `ТЕСТ · ${Math.round(m)} · тает ${Math.round(melt)}/с · ешь ≈${Math.max(0, Math.round(hcDbg.gain))}/с · ${list || 'улучшений нет'}`;
    }
    // the end of a round: the hardcore series reward
    function end() {
      hcPanel(null); tether.visible = false; nextRing.visible = false; { const d = document.getElementById('hcDbg'); if (d) d.remove(); }
      if (mode !== 'hardcore' || stats.ranked || stats.tutorial) return;
      save.hcStreak = stats.maxMass >= 3000 ? (save.hcStreak || 0) + 1 : 0;
      const give = (id, name, n) => { if (save.hcStreak >= n && !save.decor.includes(id)) { save.decor.push(id); stats.hcReward = name; setTimeout(() => toast(`Серия хардкора ×${n}: награда «${name}»!`), 1200); } };
      give('tt_hardened', 'Несгибаемый', 3); give('fr_tempered', 'Закалка', 5);
    }
    // ---- crown ----
    function crownRules(dt, contenders) {
      if (crownHolder && !crownHolder.cells.length) { crownGround = { ...crownLast }; crownHolder = null; toast('Корона упала на поле!'); }
      if (crownHolder) { const m = mainOf(crownHolder); crownLast = { x: m.x, z: m.z }; }
      if (crownGround) for (const o of contenders) if (o.cells.some(c => Math.hypot(c.x - crownGround.x, c.z - crownGround.z) < cellR(c) + 1.5)) { crownHolder = o; crownGround = null; toast(o.isPlayer ? 'Корона твоя! Теперь на тебя охотятся' : `Корону подобрал ${o.name}`); Sound.play(o.isPlayer ? 'level' : 'bonus'); break; }
    }
    function crownBite(a, b, victim, lastMass) {   // the holder lost a big part (or the last one): the crown goes to the eater
      if (victim !== crownHolder || !(lastMass >= .4 * total(victim) || victim.cells.length <= 1)) return;
      if (a.owner.kind === 'boss' || a.owner.kind === 'minion' || a.owner.kind === 'rival') { crownGround = { x: b.x, z: b.z }; crownHolder = null; toast('Босс выбил корону — она на поле!'); return; }
      crownHolder = a.owner; toast(a.owner.isPlayer ? `Ты отнял корону у ${victim.name}!` : victim.isPlayer ? `${a.owner.name} отнял у тебя корону!` : `Корона перешла к ${a.owner.name}`); Sound.play(a.owner.isPlayer ? 'level' : 'eaten');
    }
    const crownWave = () => stats.wave || 0;
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
    // 2.7: «связки» — pairs of the bosses that already exist, chosen so that one helps the other
    const COMBOS = [
      { name: 'Ловушка', a: 'frost', b: 'hunter', how: 'Морозец замедляет — Шустрик догоняет' },
      { name: 'Засада', a: 'chameleon', b: 'hunter', how: 'Шустрик гонит тебя прямо к невидимому Мимику' },
      { name: 'Рой', a: 'queen', b: 'splitter', how: 'прислужники и осколки со всех сторон' },
      { name: 'Стена', a: 'giant', b: 'splitter', how: 'Громила перекрывает путь, осколки Делителя окружают' },
      { name: 'Ледяной рой', a: 'frost', b: 'queen', how: 'прислужники в ледяном облаке' },
      { name: 'Тень великана', a: 'giant', b: 'chameleon', how: 'за Громилой прячется Мимик' },
    ];
    let comboOrder = [];
    function survCombo() {
      if (stats.wave < 3 || stats.wave % 3) return null;
      if (!comboOrder.length) comboOrder = COMBOS.map((c, i) => [Math.random(), c]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
      return comboOrder.pop();
    }
    // «На время»: a reward for every place, plus 5 ◆ for each place won since the middle of the round
    function placeBonus(r) {
      const base = [40, 25, 15, 12, 10, 8, 7, 6][r - 1] || 5;
      const climb = stats.midRank ? Math.min(25, Math.max(0, stats.midRank - r) * 5) : 0;
      if (climb) stats.climbBonus = climb;
      return base + climb;
    }
    return {
      zoneTick, get zoneC() { return zc; }, zoneDmgK: () => 1 + .35 * zst,
      zoneChip: () => `Зона ${zst + 1} · ${zph === 'hold' ? `сужение через ${Math.ceil(Math.max(0, zt))} с` : 'сужается!'}`,
      zoneMini(g, P, s) {
        const [x, y] = P(zc.x, zc.z); g.strokeStyle = '#ff3d6e'; g.lineWidth = 1.5; g.beginPath(); g.arc(x, y, zoneR * s, 0, 6.29); g.stroke();
        if (zto && zto.r < zoneR - .5) { const [x2, y2] = P(zto.x, zto.z); g.save(); g.setLineDash([3, 3]); g.strokeStyle = '#ffffff'; g.beginPath(); g.arc(x2, y2, zto.r * s, 0, 6.29); g.stroke(); g.restore(); }
      },
      dayMode, dayMark: id => (id === dayMode() ? DAY_MARK : ''),
      dayK: () => (mode === dayMode() && !stats.ranked && !stats.chaos && !stats.tutorial ? 1.25 : 1),
      // 2.7: what the ⓘ window of «Режимы» tells about each mode
      info: () => ({ MILES, ESC_S, ESC_MAX, RUSH_S, RULES, HC_MILES, HC_BOOST, HC_TIER, HC_RN, HC_CAP, HC_ABOUT, COMBOS, PLACE: [40, 25, 15, 12, 10, 8, 7, 6] }),
      HC_DECAY, meltK: () => hcK('melt'), hcK, hcKill: () => { if (mode === 'hardcore' && hc.predator) hcPredT = 2; },
      start, tick, end, survWave, survGrow, survCombo, placeBonus, crownRules, crownBite,
      get crownGround() { return crownGround; },
      crownBossMass(b, mass) {   // a new wave of the crown: each a bit stronger, sized against the holder
        stats.wave = crownWave() + 1;
        const h = crownHolder && crownHolder.cells.length ? total(crownHolder) : total(player);
        return Math.min(BOSS_MASS_CAP, Math.max(mass, h * 1.25) * Math.pow(1.08, stats.wave - 1));
      },
      crownMaxBosses: () => (crownWave() >= 6 ? 3 : 2),
      crownChip: () => `${crownGround ? '♛ корона лежит на поле' : `♛ ${crownHolder ? (crownHolder.isPlayer ? 'у тебя' : crownHolder.name) : '–'}`} · твоё время ${fmtTime(player.crownT)}${crownWave() ? ` · волна ${crownWave()}` : ''}`,
      crownMini(g, P) {
        const at = crownGround || (crownHolder && crownHolder.cells.length ? (m => ({ x: m.x, z: m.z }))(mainOf(crownHolder)) : null); if (!at) return;
        const [x, y] = P(at.x, at.z); g.fillStyle = '#ffd23f'; g.font = 'bold 12px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('♛', x, y - 8);
      },
      raidDmgK: () => (twinsLinked() ? .5 : 1) * raidPerk().dmg,
      cdK: o => (o === player ? hcK('cd') : 1),
      gainK: () => (mode === 'timed' ? (rushOn ? 2 : 1) * (rule && rule.id === 'feast' ? 1.5 : 1) : mode === 'hardcore' ? hcK('absorb') : 1),
      bonusK: () => (rule && rule.id === 'bonus2' ? .5 : 1),
      botSpeedK: o => (mode === 'crown' && o === crownHolder ? .85 : 1) * (o.mate && o.mate.cells.length && o.cells.length && Math.hypot(o.cells[0].x - o.mate.cells[0].x, o.cells[0].z - o.mate.cells[0].z) < 40 ? 1.1 : 1) * (o.isPlayer && mode === 'hardcore' ? hcK('speed') * (hcPredT > 0 ? hcK('predator') : 1) : 1) *
        (o.kind === 'bot' ? (mode === 'classic' ? 1 + .04 * esc : rule && rule.id === 'fastbots' ? 1.15 : 1) : 1),
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
        if (mode === 'raid' && running) return twinsLinked() ? '🔗 связь −50%' : '✂ разведены';
        if (mode === 'hardcore' && Object.values(hcN).some(n => n)) return Object.keys(HC_BOOST).filter(k => hcN[k]).map(k => HC_BOOST[k][0] + (hcN[k] > 1 ? '×' + hcN[k] : '')).join(' ');
        return '';
      },
    };
  })();
  // «Хардкор»: «Перезарядка −10%» shortens a fresh cooldown of an ability
  { const cast1 = castAbility; castAbility = (id, o = player) => { const before = o.abCd ? o.abCd[id] || 0 : 0, r = cast1(id, o); const k = ModeX.cdK(o); if (k < 1 && o.abCd && (o.abCd[id] || 0) > before) o.abCd[id] *= k; return r; }; }
