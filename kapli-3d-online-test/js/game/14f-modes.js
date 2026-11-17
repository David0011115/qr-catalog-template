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
    const MILES = [[1000, 30], [3000, 60], [6000, 100], [10000, 160]];
    const ESC_S = 180, ESC_MAX = 4, RUSH_S = 30;
    const RULES = [
      { id: 'bonus2', name: 'Двойные бонусы', about: 'бонусы появляются вдвое чаще' },
      { id: 'fastbots', name: 'Быстрые боты', about: 'боты на 15% быстрее' },
      { id: 'spikes', name: 'Шипы повсюду', about: 'вдвое больше шипов' },
      { id: 'feast', name: 'Пир', about: 'крошки дают в полтора раза больше' },
    ];
    let rule = null, mile = 0, esc = 0, rushOn = false, breakAt = 0;
    // «Захват короны»: the crown lies in the middle until someone takes it, then passes only to whoever eats its holder
    let crownGround = null, crownLast = { x: 0, z: 0 };
    // «Хардкор»: small boosts at 2 000 / 5 000 / 10 000 mass (pick one of two), no shields and no second lives
    const HC_MILES = [2000, 5000, 10000], HC_BOOST = { speed: ['⚡', 'Скорость +5%'], absorb: ['🍽', 'Поглощение +5%'], cd: ['⏱', 'Перезарядка −10%'] };
    let hc = { speed: 0, absorb: 0, cd: 0 }, hcMile = 0, hcOffer = null, hcT = 0;
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
      rule = null; mile = 0; esc = 0; rushOn = false; breakAt = 0;
      document.body.classList.toggle('q-low', save.settings.quality === 'low');
      stats.modeXCoins = 0; tether.visible = false;
      crownGround = null; hc = { speed: 0, absorb: 0, cd: 0 }; hcMile = 0; hcOffer = null; hcPanel(null);
      nextRing.visible = false;
      if (mode === 'royale') { zc = { x: 0, z: 0 }; zst = 0; zph = 'hold'; zt = 20; zoneR = R; zPlan(); }
      if (mode === 'crown') { crownHolder = null; { const an = Math.random() * 6.283; crownGround = { x: Math.cos(an) * R * .4, z: Math.sin(an) * R * .4 }; } [player, ...bots].forEach(o => o.crownT = 0); setTimeout(() => { if (running && mode === 'crown') toast('Корона лежит на поле (♛ на мини-карте) — хватай! Дальше она переходит только к тому, кто съест владельца'); }, 1500); }
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
          if (player.cells.length) { const [x, z] = centerOf(player), r = cellR(mainOf(player)); for (let k = 0; k < 5; k++) emit(x, r + 1, z, k % 2 ? '#ffd23f' : '#22e6ff', 18, 12 + k * 2, .9); wave(x, z, '#ffd23f', r, r + 26, .8); }
        }
        const e = Math.min(ESC_MAX, Math.floor(stats.time / ESC_S));
        if (e > esc) { esc = e; stats.modeXCoins += 20 * esc; toast(`Арена накаляется: уровень ${esc + 1}. Боты быстрее, боссы чаще, награда выше (+${20 * esc} ◆)`); Sound.play('boss'); }
      }
      if (mode === 'timed' && !rushOn && stats.time >= TIMED_LEN - RUSH_S) { rushOn = true; toast('Финальный рывок! 30 секунд, крошки вдвое сытнее'); Sound.play('level'); }
      if (mode === 'timed' && stats.midRank === undefined && stats.time >= TIMED_LEN / 2) stats.midRank = rankOf();
      if (mode === 'crown') for (const o of bossOwners) for (const c of o.cells) c.mass = Math.max(20, c.mass * (1 - .008 * dt));   // the crown's bosses melt too
      if (mode === 'hardcore' && !stats.ranked) {
        if (hcMile < HC_MILES.length && total(player) >= HC_MILES[hcMile] && !hcOffer) {
          hcMile++; const ids = Object.keys(HC_BOOST).sort(() => Math.random() - .5).slice(0, 2); hcOffer = ids; hcT = 12; hcPanel(ids);
          toast(`Масса ${HC_MILES[hcMile - 1].toLocaleString('ru-RU')}: выбери маленькое улучшение`); Sound.play('level');
        }
        if (hcOffer) { hcT -= dt; if (hcT <= 0) hcPick(hcOffer[0]); }
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
    function hcPanel(ids) {
      let el = document.getElementById('hcPick');
      if (!el) {
        el = document.createElement('div'); el.id = 'hcPick'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Выбери улучшение'); document.body.appendChild(el);
        el.addEventListener('pointerdown', e => e.stopPropagation());
        el.addEventListener('click', e => { const b = e.target.closest('[data-h]'); if (b) hcPick(b.dataset.h); });
      }
      if (!ids) { el.hidden = true; return; }
      el.innerHTML = `<p>Хардкор: маленькое улучшение</p><div class="db-opts two">${ids.map(id => `<button type="button" data-h="${id}"><span class="ic">${HC_BOOST[id][0]}</span><b>${HC_BOOST[id][1]}</b><small>до конца раунда</small></button>`).join('')}</div>`;
      el.hidden = false;
    }
    function hcPick(id) { if (!hcOffer) return; hc[id]++; hcOffer = null; hcPanel(null); toast(`${HC_BOOST[id][1]} до конца раунда`); }
    // the end of a round: the hardcore series reward
    function end() {
      hcPanel(null); tether.visible = false; nextRing.visible = false;
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
      start, tick, end, survWave, survGrow, placeBonus, crownRules, crownBite,
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
      cdK: o => (mode === 'hardcore' && o === player && hc.cd ? Math.pow(.9, hc.cd) : 1),
      gainK: () => (mode === 'timed' ? (rushOn ? 2 : 1) * (rule && rule.id === 'feast' ? 1.5 : 1) : mode === 'hardcore' ? 1 + .05 * hc.absorb : 1),
      bonusK: () => (rule && rule.id === 'bonus2' ? .5 : 1),
      botSpeedK: o => (mode === 'crown' && o === crownHolder ? .9 : 1) * (o.isPlayer && mode === 'hardcore' ? 1 + .05 * hc.speed : 1) *
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
        if (mode === 'hardcore' && (hc.speed || hc.absorb || hc.cd)) return Object.entries(hc).filter(([, n]) => n).map(([k, n]) => HC_BOOST[k][0] + (n > 1 ? '×' + n : '')).join(' ');
        return '';
      },
    };
  })();
  // «Хардкор»: «Перезарядка −10%» shortens a fresh cooldown of an ability
  { const cast1 = castAbility; castAbility = (id, o = player) => { const before = o.abCd ? o.abCd[id] || 0 : 0, r = cast1(id, o); const k = ModeX.cdK(o); if (k < 1 && o.abCd && (o.abCd[id] || 0) > before) o.abCd[id] *= k; return r; }; }
