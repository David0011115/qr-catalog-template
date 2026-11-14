  // ================= «Спина к спине»: two players together against waves of bosses =================
  // The host runs it (like every mode for two). A wv is a group of bosses made only for this mode; they melt while
  // they hunt you, so by the end of their time you can eat them. Every 5th wv is a special boss with a health bar:
  // it sheds pieces when you come close, eating them is the damage. Between waves — a break with extra food and, every
  // 3rd wv, a choice of a boost. A player who was eaten comes back on a timer; each bot the partner eats meanwhile
  // takes a second off. Both eaten at once — the run is over.
  (() => {
    const DIFF = [
      { id: 'normal', name: 'Обычный', hp: 1,   brk: 15, resp: 15, coins: 1 },
      { id: 'hard',   name: 'Сложный', hp: 1.4, brk: 12, resp: 20, coins: 1.4 },
      { id: 'mad',    name: 'Безумие', hp: 2,   brk: 10, resp: 25, coins: 1.8 },
    ];
    // regular bosses of this mode (and nowhere else)
    const REG = {
      twins:  { name: 'Близнец',   color: '#ff7ad9', speed: .95, coins: 12, xp: 14, about: 'приходят парой, каждый охотится на своего; съешь одного — второй злится' },
      leech:  { name: 'Прилипала', color: '#7dff6a', speed: 1.1, coins: 12, xp: 14, about: 'цепляется к тому, кто легче, и тянет из него массу; напарник может его съесть' },
      wedge:  { name: 'Клин',      color: '#ffb02e', speed: .8,  coins: 14, xp: 16, about: 'таранит пару посередине, чтобы разлучить вас' },
      weaver: { name: 'Ткач',      color: '#a98bff', speed: .85, coins: 14, xp: 16, about: 'оставляет за собой шипы' },
    };
    // a special boss every 5th wv, in turn
    const SPEC = [
      { id: 'vortex',   name: 'Вихрь',      color: '#22e6ff', speed: .55, about: 'время от времени затягивает к себе' },
      { id: 'split',    name: 'Раскол',     color: '#ff3d6e', speed: .6,  about: 'на половине здоровья распадается на четыре части: съешьте их за 10 с' },
      { id: 'meteor',   name: 'Метеор',     color: '#ff9a3d', speed: .5,  about: 'бьёт с неба по красному кругу — уходите из него' },
      { id: 'devourer', name: 'Пожиратель', color: '#c2416b', speed: .75, about: 'гонится за тем, кто тяжелее, и делает рывки' },
    ];
    // boosts: every 3rd wv each player picks one of three; «обоим» ones work for both
    const BOOST = {
      mass:   { name: 'Масса +15%',       ic: '💪', about: 'сразу' },
      speed:  { name: 'Скорость +8%',     ic: '⚡', about: 'до конца забега' },
      armor:  { name: 'Броня',            ic: '🛡', about: 'боссу нужно быть заметно больше, чтобы съесть тебя' },
      absorb: { name: 'Поглощение +25%',  ic: '🍽', about: 'крошки дают больше' },
      cd:     { name: 'Перезарядка −15%', ic: '⏱', about: 'способности' },
      sh_shield: { name: 'Щит паре', ic: '👥', about: '4 с неуязвимости обоим в начале каждой волны', both: true },
      sh_feast:  { name: 'Пир',      ic: '👥', about: 'вдвое больше еды в перерывах', both: true },
      sh_link:   { name: 'Связь',    ic: '👥', about: 'оба возвращаются на 4 с быстрее', both: true },
    };
    const OWN = ['mass', 'speed', 'armor', 'absorb', 'cd'], SHARED = ['sh_shield', 'sh_feast', 'sh_link'];
    const REG_LIFE = 34, MELT = .014, SPEC_LIFE = 80, SHED_S = 2, CHUNK_LIFE = 12;
    // the run has an end: wave 50 is the final, clearing it wins the run. From wave 30 the late game: every 5 waves the bosses
    // are 3% faster and the break 1 s shorter, special bosses come in a stronger version
    const MAX_WAVE = 50, LATE = 30;
    const lateStep = () => (wv >= LATE ? Math.floor((wv - LATE) / 5) + 1 : 0);

    const bossVis = (color, n) => Array.from({ length: n }, () => { const v = makeVis(new THREE.Color(color)); v.crown.visible = true; v.mesh.material.emissiveIntensity = .65; v.glow.material.opacity = .8; return v; });
    const regOwners = [];
    for (const [type, d] of Object.entries(REG)) {
      BOSS_TYPES_EXTRA['db_' + type] = { name: d.name, color: d.color, speed: d.speed, life: 1e9, parts: 3, coins: d.coins, xp: d.xp, about: d.about };
      for (let k = 0; k < 2; k++) { const o = makeOwner(d.name, 'boss', 'boss'); o.bossType = 'db_' + type; o.dbType = type; o.life = 0; o.free = bossVis(d.color, 3); owners.push(o); regOwners.push(o); }
    }
    const specOwners = SPEC.map(d => {
      BOSS_TYPES_EXTRA['db_' + d.id] = { name: d.name, color: d.color, speed: d.speed, life: 1e9, parts: 14, coins: 60, xp: 80, about: d.about };
      const o = makeOwner(d.name, 'boss', 'boss'); o.bossType = 'db_' + d.id; o.dbType = d.id; o.dbSpec = true; o.life = 0; o.free = bossVis(d.color, 14); owners.push(o); return o;
    });
    const allBoss = [...regOwners, ...specOwners];

    // meteor warnings: red circles on the floor
    const rings = Array.from({ length: 3 }, () => {
      const m = new THREE.Mesh(new THREE.RingGeometry(.86, 1, 48), decal(new THREE.MeshBasicMaterial({ color: '#ff3d6e', transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
      m.rotation.x = -Math.PI / 2; m.position.y = .09; m.visible = false; scene.add(m); return m;
    });

    let D = DIFF[0], Di = 0, pHome = -1, wv = 0, ph = 1, bt = 6, team = null, spec = null, meteors = [], offers = {}, picked = {}, shared = null;
    let co = null, prevCo = null;   // what both phones show: [phase, wv, break left, bosses, special hp %, special kind, host player's return, rival's return]
    const rival = () => DuoM.rival;
    const active = () => DuoM.mode === 'duoback';
    const pl = () => [player, rival()].filter(o => o.cells.length);
    const big = o => o.cells.reduce((a, b) => !a || b.mass > a.mass ? b : a, null);
    const homeOf = o => o === player ? pHome : -pHome;
    const baseMass = () => Math.max(80, total(player), total(rival()));
    const isPl = o => o === player || o === rival();
    const shieldOf = o => o === player ? effects.shield > 0 : (o.eff && o.eff.shield > 0);

    function sign(title, sub, color) {
      let el = document.getElementById('terrSign');
      if (!el) { el = document.createElement('div'); el.id = 'terrSign'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
      el.className = ''; el.style.setProperty('--tc', color);
      el.innerHTML = `<b>${title}</b>${sub ? `<small>${sub}</small>` : ''}`;
      void el.offsetWidth; el.classList.add('show');
      clearTimeout(sign.t); sign.t = setTimeout(() => el.classList.remove('show'), 2200);
    }

    // ---- boosts ----
    function draw3() {
      const own = OWN.slice().sort(() => Math.random() - .5).slice(0, 3);
      if (Math.random() < .3) own[2] = SHARED[(Math.random() * SHARED.length) | 0];
      return own;
    }
    function applyBoost(o, id) {   // host
      const b = BOOST[id]; if (!b) return;
      if (b.both) { shared[id] = (shared[id] || 0) + 1; toast(`${o === player ? 'Ты выбрал' : rival().name + ' выбрал'}: «${b.name}» — для обоих`); return; }
      o.db[id] = (o.db[id] || 0) + 1;
      if (id === 'mass') o.cells.forEach(c => c.mass *= 1.15);
      if (id === 'absorb') o.dbAbs = 1 + .25 * o.db.absorb;
    }
    function panel(ids) {   // your choice, on your phone; the round does not stop
      let el = document.getElementById('dbPick');
      if (!el) {
        el = document.createElement('div'); el.id = 'dbPick'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Выбери усиление'); document.body.appendChild(el);
        el.addEventListener('pointerdown', e => e.stopPropagation());
        el.addEventListener('click', e => { const b = e.target.closest('[data-b]'); if (!b) return; choose(b.dataset.b); });
      }
      if (!ids) { el.hidden = true; return; }
      el.innerHTML = `<p>Выбери усиление</p><div class="db-opts">${ids.map(id => `<button type="button" data-b="${id}" class="${BOOST[id].both ? 'both' : ''}"><span class="ic">${BOOST[id].ic}</span><b>${BOOST[id].name}</b><small>${BOOST[id].both ? 'обоим · ' : ''}${BOOST[id].about}</small></button>`).join('')}</div>`;
      el.hidden = false;
    }
    function choose(id) {
      panel(null);
      if (DuoM.role === 'host') { if (picked.p) return; picked.p = id; applyBoost(player, id); }
      else Duo.send({ t: 'bp', id });
      Sound.play('level');
    }

    // ---- waves ----
    function startWave() {
      wv++; ph = 0;
      if (offers.p && !picked.p) { picked.p = offers.p[0]; applyBoost(player, offers.p[0]); }
      if (offers.r && !picked.r) { picked.r = offers.r[0]; applyBoost(rival(), offers.r[0]); }
      offers = {}; panel(null);
      if (shared.sh_shield) { effects.shield = Math.max(effects.shield, 4); rival().eff.shield = Math.max(rival().eff.shield, 4); }
      const base = baseMass(), grow = Math.min(6, 1 + .07 * (wv - 1));
      if (wv % 5 === 0) {
        const d = SPEC[(wv / 5 - 1) % SPEC.length], o = specOwners[(wv / 5 - 1) % SPEC.length];
        [...o.cells].forEach(removeCell);
        const [x, z] = safeSpot(40);
        const main = addCell(o, x, z, Math.min(30000, base * 1.9 * grow), o.free.pop()); main.mergeT = 1e9;
        spec = { o, d, enh: wv >= LATE, final: wv >= MAX_WAVE, max: base * 2.4 * D.hp * Math.min(3.3, 1 + .05 * (wv - 5)) * (wv >= MAX_WAVE ? 1.3 : 1), dmg: 0, life: SPEC_LIFE, shed: 2, atk: 4, pull: 0, cells: new Map(), split: null, base };
        o.think = 0; o.target = null; o.dashT = 0; o.dashCd = 3;
        Sound.play('boss');
        if (wv >= 10) spawnReg(['twins', 'leech', 'wedge', 'weaver'][(Math.random() * 4) | 0], base * grow);
        if (wv >= MAX_WAVE) spawnReg(['leech', 'wedge', 'weaver'][(Math.random() * 3) | 0], base * grow);   // the final: one more
      } else {
        const n = Math.min(4, 1 + Math.floor((wv - 1) / 2) + (Di === 2 && wv >= 3 ? 1 : 0));
        const types = Object.keys(REG);
        for (let k = 0; k < n;) {
          const t = types[(Math.random() * types.length) | 0];
          if (t === 'twins') { if (k + 2 > n && n > 1) continue; spawnReg('twins', base * grow); spawnReg('twins', base * grow); k += 2; }
          else { spawnReg(t, base * grow); k++; }
        }
        Sound.play('boss');
      }
      rebuildCells();
    }
    function spawnReg(type, m) {
      const o = regOwners.find(x => x.dbType === type && !x.cells.length); if (!o) return;
      const [x, z] = safeSpot(40);
      addCell(o, x, z, Math.min(30000, m * (type === 'leech' ? .9 : 1.25) * Math.sqrt(D.hp)), o.free.pop());
      o.life = REG_LIFE; o.think = 0; o.target = null; o.dashT = 0; o.dashCd = 3; o.enr = 0; o.spikeT = 3; o.k = regOwners.filter(x => x.dbType === type && x.cells.length).length - 1;
    }
    function startBreak() {
      ph = 1; bt = Math.max(6, D.brk - lateStep());
      const n = shared.sh_feast ? 180 : 90;
      for (const o of pl()) { const [x, z] = centerOf(o); burstFood(x, z, 70, n, cellR(big(o)) + 4); }
      burstFood(0, 0, R * .6, n);
      spawnBonus(); spawnBonus();
      if (wv % 3 === 0) {
        offers = { p: draw3(), r: draw3() }; picked = {};
        panel(offers.p); Duo.send({ t: 'bo', ids: offers.r });
      }
    }
    // a boss of the wv picks where to go (the core moves it there)
    function steerBoss(o, dt) {
      const c = big(o); if (!c) return;
      const ps = pl(); o.think = 1;
      if (!ps.length) return;
      const near = ps.map(p => big(p)).sort((a, b) => Math.hypot(a.x - c.x, a.z - c.z) - Math.hypot(b.x - c.x, b.z - c.z));
      const light = ps.slice().sort((a, b) => total(a) - total(b))[0], heavy = ps.slice().sort((a, b) => total(b) - total(a))[0];
      let t = near[0];
      if (o.dbType === 'twins') t = big(ps[o.k % ps.length]);
      if (o.dbType === 'leech') t = big(light);
      if (o.dbType === 'devourer') t = big(heavy);
      if (o.dbType === 'wedge' && ps.length === 2) {
        const a = big(ps[0]), b = big(ps[1]); o.target = null; o.tx = (a.x + b.x) / 2; o.tz = (a.z + b.z) / 2;
        if (o.dashCd <= 0 && Math.hypot(o.tx - c.x, o.tz - c.z) < 70) { o.dashT = .7; o.dashCd = 5; }
        return;
      }
      o.target = t; o.tx = t.x; o.tz = t.z;
      if ((o.dbType === 'devourer' || o.dbType === 'wedge') && o.dashCd <= 0 && Math.hypot(t.x - c.x, t.z - c.z) < 60) { o.dashT = .6; o.dashCd = o.dbType === 'devourer' ? (spec && spec.enh ? 4 : 6) : 5; }
    }
    function tickReg(o, dt) {
      o.dashT -= dt; o.dashCd = Math.max(0, o.dashCd - dt); o.life -= dt;
      for (const c of o.cells) c.mass = Math.max(8, c.mass * (1 - MELT * dt));
      steerBoss(o, dt);
      if (o.dbType === 'weaver') { o.spikeT -= dt; if (o.spikeT <= 0) { const c = big(o), r = cellR(c); spawnVirus(c.x - c.hx * (r + 5), c.z - c.hz * (r + 5)); o.spikeT = 3.5; } }
      if (o.dbType === 'leech') {
        for (const c of o.cells) for (const p of pl()) for (const pc of p.cells) {
          if (Math.hypot(pc.x - c.x, pc.z - c.z) > cellR(c) + cellR(pc) * .6 || canEat(c, pc) || shieldOf(p)) continue;
          const take = pc.mass * .07 * dt; if (pc.mass - take < 10) continue;
          pc.mass -= take; c.mass += take * .5; if (Math.random() < .2) emit(pc.x, cellR(pc), pc.z, '#7dff6a', 3, 6, .4);
        }
      }
      if (o.dbType === 'twins' && o.enr === 0 && regOwners.some(x => x !== o && x.dbType === 'twins' && x.wasOn && !x.cells.length)) { o.enr = 1; toast('Второй Близнец разозлился!'); }
      if (o.life <= 0) { [...o.cells].forEach(removeCell); rebuildCells(); toast(`${o.name} уходит`); }
    }
    function tickSpec(dt) {
      const s = spec, o = s.o, main = big(o);
      // damage: pieces of the boss that were eaten
      for (const [c, m] of s.cells) {
        if (c.gone) { if (!c.exp) { s.dmg += Math.min(m, s.max * .3); emit(c.x, 2, c.z, s.d.color, 20, 10, .5); } s.cells.delete(c); continue; }
        s.cells.set(c, c.mass); c.life = (c.life ?? CHUNK_LIFE) - dt;
        if (c !== main && c.life <= 0 && !(s.split && s.split.has(c))) { c.exp = true; removeCell(c); rebuildCells(); }
      }
      if (!main || s.dmg >= s.max) { winSpec(); return; }
      s.cells.set(main, main.mass); main.mergeT = 1e9;
      s.life -= dt; o.dashT -= dt; o.dashCd = Math.max(0, o.dashCd - dt);
      steerBoss(o, dt);
      // it sheds a piece toward a player who came close
      s.shed -= dt;
      const ps = pl(), rM = cellR(main);
      const close = ps.map(p => big(p)).find(pc => Math.hypot(pc.x - main.x, pc.z - main.z) < rM + cellR(pc) + 45);
      if (close && s.shed <= 0 && o.free.length > 2 && s.cells.size < 7) {
        const a = Math.atan2(close.z - main.z, close.x - main.x) + (Math.random() - .5), cm = Math.max(12, s.base * .28 * Math.min(1.6, D.hp));
        const c = addCell(o, main.x + Math.cos(a) * (rM + 3), main.z + Math.sin(a) * (rM + 3), cm, o.free.pop());
        c.vx = Math.cos(a) * 30; c.vz = Math.sin(a) * 30; c.mergeT = 1e9; c.life = CHUNK_LIFE; s.cells.set(c, cm); s.shed = SHED_S; rebuildCells();
      }
      // its own attack
      s.atk -= dt;
      if (s.d.id === 'vortex') {
        if (s.atk <= 0 && s.pull <= 0) { s.pull = s.enh ? 4 : 3; s.atk = s.enh ? 6 : 8; toast('Вихрь затягивает!'); }
        if (s.pull > 0) {
          s.pull -= dt; if (Math.random() < dt * 3) wave(main.x, main.z, '#22e6ff', rM + 70, rM, .5);
          for (const p of ps) for (const pc of p.cells) { const dx = main.x - pc.x, dz = main.z - pc.z, d = Math.hypot(dx, dz); if (d < rM + 80 && d > 1) { const f = s.enh ? 24 : 16; pc.x += dx / d * f * dt; pc.z += dz / d * f * dt; } }
        }
      }
      if (s.d.id === 'meteor' && s.atk <= 0 && ps.length) {
        const t = big(ps[(Math.random() * ps.length) | 0]); meteors.push({ x: t.x, z: t.z, r: 14 + cellR(t), t: 1.6 });
        if (s.enh) for (const p of ps) { const q = big(p); if (q !== t) meteors.push({ x: q.x + (Math.random() - .5) * 20, z: q.z + (Math.random() - .5) * 20, r: 14 + cellR(q), t: 1.9 }); else meteors.push({ x: q.x + q.hx * 30, z: q.z + q.hz * 30, r: 16, t: 2 }); }   // stronger: one for each player, and ahead of you s.atk = Math.max(3, 5.5 - wv * .05);
      }
      if (s.d.id === 'split' && s.enh && s.split && !s.split2 && s.splitT <= 0 && s.dmg >= s.max * .75) { s.split = null; s.split2 = true; }   // stronger: it breaks apart a second time at a quarter
      if (s.d.id === 'split' && !s.split && s.dmg >= s.max * (s.split2 ? .75 : .5)) {
        s.split = new Map(); toast('Раскол распался! Съешьте четыре части за 10 секунд');
        for (let k = 0; k < 4 && o.free.length; k++) { const a = k * Math.PI / 2, c = addCell(o, main.x + Math.cos(a) * (rM + 8), main.z + Math.sin(a) * (rM + 8), Math.max(14, s.base * .35), o.free.pop()); c.vx = Math.cos(a) * 34; c.vz = Math.sin(a) * 34; c.mergeT = 1e9; c.life = 99; s.cells.set(c, c.mass); s.split.set(c, 1); }
        s.splitT = 10; rebuildCells();
      }
      if (s.split && s.splitT > 0) {
        s.splitT -= dt;
        if (s.splitT <= 0) {
          const left = [...s.split.keys()].filter(c => !c.gone);
          if (left.length) { left.forEach(c => { c.exp = true; removeCell(c); }); s.dmg = Math.max(0, s.dmg - s.max * .2); rebuildCells(); toast('Части срослись: Раскол восстановил силы'); }
        }
      }
      if (s.life <= 0) { [...o.cells].forEach(c => { c.exp = true; removeCell(c); }); rebuildCells(); toast(`${s.d.name} уходит. Волна пройдена без победы над ним`); spec = null; }
    }
    function winSpec() {
      const s = spec, o = s.o, main = big(o);
      if (main) burstFood(main.x, main.z, cellR(main) + 30, 160);
      [...o.cells].forEach(c => { c.exp = true; removeCell(c); }); rebuildCells();
      team.specials++; if (wv === 5 && !team.s5) team.s5 = Math.round(stats.time);
      toast(`${s.d.name} повержен! Награда обоим`); Sound.play('bossDown');
      spec = null;
    }
    function tickMeteors(dt) {
      for (const m of meteors) {
        m.t -= dt;
        if (m.t <= 0) {
          wave(m.x, m.z, '#ff9a3d', 2, m.r + 6, .6); emit(m.x, 3, m.z, '#ff9a3d', 50, 20, .8);
          for (const p of pl()) if (!shieldOf(p)) for (const pc of p.cells) if (Math.hypot(pc.x - m.x, pc.z - m.z) < m.r) pc.mass = Math.max(10, pc.mass * .7);
        }
      }
      meteors = meteors.filter(m => m.t > 0);
    }

    // ---- what the HUD and the signs show (both phones read the same numbers) ----
    function makeCo() {
      const rp = player.cells.length ? 0 : Math.max(0, (player.respawnAt ?? stats.time) - stats.time), rr = rival().cells.length ? 0 : Math.max(0, (rival().respawnAt ?? stats.time) - stats.time);
      return [ph, wv, Math.max(0, bt), regOwners.filter(o => o.cells.length).length, spec ? Math.max(0, Math.ceil((1 - spec.dmg / spec.max) * 100)) : -1, spec ? SPEC.indexOf(spec.d) : -1, rp, rr];
    }

    DuoM.rules.duoback = {
      arena: .8,   // a smaller field: the pair stays close and the bosses find them
      goExtra: () => ({ diff: save.duoDiff || 0 }),
      pre(role, g) {
        Di = Math.max(0, Math.min(2, +g.diff || 0)); D = DIFF[Di]; pHome = role === 'host' ? -1 : 1;
        wv = 0; ph = 1; bt = 6; spec = null; meteors = []; offers = {}; picked = {}; shared = {}; co = prevCo = null;
        team = { bosses: 0, specials: 0, bots: 0, resp: 0, s5: 0 };
        for (const o of [player, rival()]) { o.db = { mass: 0, speed: 0, armor: 0, absorb: 0, cd: 0 }; o.dbAbs = 1; }
        allBoss.forEach(o => { [...o.cells].forEach(removeCell); o.wasOn = false; });
      },
      begin(role) {
        setTimeout(() => { if (active()) sign(`«Спина к спине» · ${D.name}`, 'Первая волна через несколько секунд. Держитесь рядом!', '#3dffa2'); }, 600);
      },
      end() {
        allBoss.forEach(o => [...o.cells].forEach(removeCell)); rebuildCells();
        rings.forEach(m => m.visible = false); panel(null);
        for (const o of [player, rival()]) { o.db = null; o.dbAbs = 1; }
        const el = document.getElementById('terrSign'); if (el) el.classList.remove('show');
      },
      spawnX: o => homeOf(o) * R * .18,
      respawnS: () => Math.max(5, D.resp - 4 * (shared.sh_link || 0)),
      tick(dt) {   // host
        if (dying) return;
        for (const o of regOwners) { if (o.cells.length) { o.wasOn = true; tickReg(o, dt); } else if (o.wasOn && ph === 1) o.wasOn = false; }
        if (spec) tickSpec(dt);
        tickMeteors(dt);
        if (ph === 1) { bt -= dt; if (bt <= 0) startWave(); }
        else if (!spec && !regOwners.some(o => o.cells.length)) {
          if (wv >= MAX_WAVE && running) { DuoM.result('coop', 0, 'win', { w: MAX_WAVE, t: Math.round(stats.time), b: team.bosses, s: team.specials, k: team.bots, r: team.resp, df: Di, s5: team.s5, won: 1 }); return; }
          startBreak();
        }
        co = makeCo();
        if (!player.cells.length && !rival().cells.length && running) {
          const passed = ph === 1 ? wv : wv - 1;
          DuoM.result('coop', 0, 'dead', { w: Math.max(0, passed), t: Math.round(stats.time), b: team.bosses, s: team.specials, k: team.bots, r: team.resp, df: Di, s5: team.s5 });
        }
      },
      lost(o) { team.resp++; },
      anyLost(o, eater) {
        if (!eater || !isPl(eater)) return;
        if (o.kind === 'bot') {
          team.bots++;
          const other = eater === player ? rival() : player;
          if (!other.cells.length && other.respawnAt !== undefined) { other.respawnAt = Math.max(stats.time + .5, other.respawnAt - 1); if (other === player) toast('Напарник ускорил твоё возвращение: −1 с'); }
        } else if (o.kind === 'boss' && o.dbType && !o.dbSpec) {
          team.bosses++; if (eater !== player) { toast(`${o.name} повержен — его съел ${eater.name}!`); Sound.play('bossDown'); }
          if (o.dbType === 'twins') regOwners.forEach(x => { if (x !== o && x.dbType === 'twins' && x.cells.length) x.enr = 1; });
        }
      },
      eatBlock(a, b) {   // «Броня»: a boss must be clearly bigger to eat a player who took it
        const n = b.owner.db && b.owner.db.armor;
        return !!n && !!a.owner.dbType && a.mass < b.mass * (1.25 + .15 * n);
      },
      speedK(c) {
        const o = c.owner;
        if (o.db && o.db.speed) return 1 + .08 * o.db.speed;
        if (o.dbType) return (o.dbType === 'twins' && o.enr ? 1.35 : 1) * (1 + .03 * lateStep());
        return 1;
      },
      snap(s) {
        s.co = co ? co.map(v => Math.round(v * 10) / 10) : null;
        s.ds = rival().db ? rival().db.speed : 0;
        s.mt = meteors.flatMap(m => [Math.round(m.x), Math.round(m.z), Math.round(m.r), Math.round(m.t * 10) / 10]);
      },
      apply(s) {
        if (s.co) co = s.co;
        if (player.db && s.ds !== undefined) player.db.speed = s.ds;
        if (s.mt) { meteors = []; for (let j = 0; j < s.mt.length; j += 4) meteors.push({ x: s.mt[j], z: s.mt[j + 1], r: s.mt[j + 2], t: s.mt[j + 3] }); }
      },
      msg(m) {
        if (m.t === 'bo' && DuoM.role === 'guest') { panel(m.ids); return true; }
        if (m.t === 'bp' && DuoM.role === 'host') { if (offers.r && !picked.r && offers.r.includes(m.id)) { picked.r = m.id; applyBoost(rival(), m.id); } return true; }
        return false;
      },
      view(dt) {
        rings.forEach((g, k) => { const m = meteors[k]; g.visible = !!m; if (m) { g.position.set(m.x, .09, m.z); g.scale.setScalar(m.r); g.material.opacity = .45 + .45 * Math.abs(Math.sin(stats.time * 12)); } });
        if (!co) return;
        const p = prevCo; prevCo = co;
        if (!p) return;
        if (co[1] !== p[1] && co[0] === 0) {
          if (co[1] >= MAX_WAVE) { const d = SPEC[co[5]] || SPEC[0]; sign(`Финальная волна ${MAX_WAVE}: ${d.name}`, 'Сильнейшая версия и ещё два босса. Пройдите её — и забег выигран!', '#ffd23f'); }
          else if (co[1] === LATE) sign(`Волна ${LATE}: поздняя игра`, 'Боссы быстрее, перерывы короче, особые боссы — в усиленной версии', '#ff9a3d');
          else if (co[5] >= 0) { const d = SPEC[co[5]]; sign(`Волна ${co[1]}: ${d.name}`, d.about, d.color); }
          else sign(`Волна ${co[1]}`, co[3] === 1 ? 'Один босс' : `Боссов: ${co[3]}`, '#ff3d6e');
        }
        if (co[0] === 1 && p[0] === 0) sign('Волна пройдена!', `Перерыв ${Math.round(co[2])} с: ешьте, пока можно`, '#3dffa2');
        if (co[0] === 0 && p[0] === 1) panel(null);
      },
      chip() {
        if (!co) return '';
        const [cph, w, cbt, nb, sp, st, rp, rr] = co, guest = DuoM.role === 'guest';
        const me = guest ? rr : rp, mate = guest ? rp : rr;
        let t = cph === 1 ? `${w ? 'Перерыв' : 'Старт через'} ${Math.ceil(cbt)} с · далее волна ${w + 1}/${MAX_WAVE}`
          : sp >= 0 ? `Волна ${w}/${MAX_WAVE} · ${w >= MAX_WAVE ? 'Финал: ' : ''}${SPEC[st].name} ${sp}%<span class="bar wide"><span style="width:${sp}%"></span></span>` : `Волна ${w}/${MAX_WAVE} · боссов: ${nb}`;
        if (me > 0) t += ` · ты вернёшься через ${Math.ceil(me)} с`;
        else if (mate > 0) t += ` · напарник вернётся через ${Math.ceil(mate)} с — ешь ботов: −1 с`;
        return t;
      },
      finish(me, sh, why, x) {   // both phones: the run is over
        x = x || {}; const w = x.w || 0, df = DIFF[x.df || 0] || D;
        save.duo = save.duo || {};
        const t = save.duo.duoback = Object.assign({ games: 0, best: {}, top: {} }, save.duo.duoback);
        t.games++; t.best[df.id] = Math.max(t.best[df.id] || 0, w);
        const list = t.top[df.id] = t.top[df.id] || [];
        list.push({ w, t: x.t || 0, b: x.b || 0, s: x.s || 0, k: x.k || 0, r: x.r || 0, n: String(rival().name || '').slice(0, 24), d: Date.now() });
        list.sort((a, b) => b.w - a.w || a.t - b.t); list.length = Math.min(5, list.length);
        persist();
        if (!DuoM.practice && DuoM.role === 'host') Net.duoCoop(x.df || 0, rival().pid, w, x.t || 0, (x.b || 0) + (x.s || 0), x.k || 0, x.r || 0);   // the room's creator sends the pair's run
        stats.duoHero = { v: w, l: 'волн пройдено' }; stats.duoWave = w; stats.duoSpecial5T = x.s5 || 0;
        stats.bossCoins = 0; stats.bossXp = Math.round((w * 8 + (x.s || 0) * 30) * df.coins);   // the same reward for both players
        const won = !!x.won;
        if (won) { t.wins = (t.wins || 0) + 1; persist(); }
        return { win: won, bonus: Math.round((w * 12 + (x.b || 0) * 6 + (x.s || 0) * 60 + (won ? 300 : 0)) * df.coins),
          title: won ? `Все ${MAX_WAVE} волн пройдены! · ${df.name}` : w ? `Пройдено волн: ${w} · ${df.name}` : `Первая волна оказалась сильнее · ${df.name}` };
      },
      dbg(cmd, v) {   // test build only
        if (!TEST_MODE) return;
        if (cmd === 'next') bt = 0;
        if (cmd === 'wave') { wv = v - 1; ph = 1; bt = 0; }
        if (cmd === 'eat') for (const o of regOwners) if (o.cells.length) { [...o.cells].forEach(removeCell); rebuildCells(); lostCell(o, 50, v === 'r' ? rival() : player); }
        if (cmd === 'hit' && spec) spec.dmg += spec.max * v;
        if (cmd === 'state') return { wv, ph, bt: Math.round(bt * 10) / 10, regs: regOwners.filter(o => o.cells.length).map(o => o.dbType + ':' + Math.round(total(o))), spec: spec ? spec.d.id + ' ' + Math.round(spec.dmg) + '/' + Math.round(spec.max) + ' cells ' + spec.cells.size : null, team, shared, offers, picked, pdb: player.db, rdb: rival().db, met: meteors.length };
      },
      lobbyHtml(role) {
        if (role !== 'host') return '<p class="hint" style="margin:0">Сложность выбирает создатель комнаты.</p>';
        const cur = save.duoDiff || 0;
        return `<div class="db-diff" role="group" aria-label="Сложность">${DIFF.map((d, i) => `<button type="button" class="db-df${i === cur ? ' on' : ''}" data-df="${i}" aria-pressed="${i === cur}">${d.name}</button>`).join('')}</div>`;
      },
      lobbyClick(e) {
        const b = e.target.closest('[data-df]'); if (!b) return false;
        save.duoDiff = +b.dataset.df; persist();
        document.querySelectorAll('.db-df').forEach(x => { const on = +x.dataset.df === save.duoDiff; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
        return true;
      },
      statsHtml() {
        const t = (save.duo || {}).duoback;
        if (!t || !t.games) return '<p class="hint duo-stats" style="margin:0">Здесь появятся ваши рекорды: волны на каждой сложности и лучшие пары.</p>';
        const rows = DIFF.map(d => `<span>${d.name} <b>${t.best[d.id] || 0}</b></span>`).join('');
        const all = DIFF.flatMap(d => (t.top[d.id] || []).map(m => ({ ...m, dn: d.name }))).sort((a, b) => b.w - a.w || a.t - b.t).slice(0, 5);
        return `<div class="duo-stats"><div class="duo-st-row"><span>Забегов <b>${t.games}</b></span>${rows}</div>` +
          `<ol class="duo-top">${all.map(m => `<li><b>${m.w} волн</b> · ${m.dn} · с ${escHtml(m.n)} · ${fmtTime(m.t)} · боссов ${m.b + m.s} · ботов ${m.k} · возвращений ${m.r}</li>`).join('')}</ol></div>`;
      },
    };

    // «Перезарядка −15%»: a fresh cooldown of the player who took it is shorter
    const cast0 = castAbility;
    castAbility = (id, o = player) => {
      const before = o.abCd ? o.abCd[id] || 0 : 0, r = cast0(id, o);
      if (active() && o.db && o.db.cd && o.abCd && (o.abCd[id] || 0) > before) o.abCd[id] *= Math.pow(.85, o.db.cd);
      return r;
    };
  })();
