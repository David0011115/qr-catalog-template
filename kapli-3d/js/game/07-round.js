  // ================= bonuses =================
  const bonusCore = new THREE.OctahedronGeometry(0.7);
  const bonusRing = new THREE.TorusGeometry(1.1, 0.08, 8, 32);
  // the mass limit of an ordinary boss (per drop) in this mode; 2.7: «Спина к спине» sets its own one that follows the pair (it used to stop at 12 000)
  const bossMassCap = () => mode === 'survival' ? SURV_BOSS_CAP : mode === 'raid' ? RAID_BOSS_CAP : mode === 'hardcore' ? HC_BOSS_MASS_CAP : mode === 'classic' ? CL_BOSS_MASS_CAP : (DuoM.bossCap && DuoM.bossCap()) || BOSS_MASS_CAP;
  function spawnBonus() {
    if (mode === 'hardcore') return;
    if (bonuses.length >= MAX_BONUS) return;
    const types = Object.keys(BONUS), type = (TEST_MODE && testOnlyBonus) || types[Math.floor(Math.random() * types.length)];
    const col = new THREE.Color(BONUS[type].color);
    const mesh = new THREE.Group();
    mesh.add(new THREE.Mesh(bonusCore, new THREE.MeshBasicMaterial({ color: col })));
    mesh.add(new THREE.Mesh(bonusRing, new THREE.MeshBasicMaterial({ color: col })));
    mesh.add(glowSprite(col, 5, .7));
    const near = TEST_MODE && testOnlyBonus && player.cells.length ? (() => { const [cx, cz] = centerOf(player), a = Math.random() * 6.283, d = cellR(mainOf(player)) * .5; return [cx + Math.cos(a) * d, cz + Math.sin(a) * d]; })() : null;   // test: under the drop, picked up at once
    const [x, z] = near || owlNext || randInArena(8); owlNext = null; owlMark.visible = false;
    mesh.position.set(x, 1.2, z);
    scene.add(mesh);
    bonuses.push({ x, z, type, mesh });
  }

  // ================= input =================
  const keys = {};
  const pointer = new THREE.Vector2(); let pointerActive = false, pointerTouch = false;
  const overlayOpen = () => !$('overlay').hidden;
  addEventListener('keydown', e => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;   // typing (chat, account, promo) never triggers game keys
    keys[e.code] = true;
    const onButton = document.activeElement && document.activeElement.tagName === 'BUTTON';
    if (e.code === 'Space') {
      e.preventDefault();
      if (running) useSlot(0);
      else if (overlayOpen() && $('shopCard').hidden && !onButton) startRound();
    }
    if (e.code === 'KeyE' && running) useSlot(1);
    if (e.code === 'KeyQ' && running) useSlot(2);
    if (e.code === 'KeyP' && running && !dying) setPause(!paused);
    if (e.code === 'Enter' && !running && $('shopCard').hidden && !onButton) startRound();
    if (e.code === 'Escape' && !$('shopCard').hidden) closeShop();
  });
  addEventListener('keyup', e => { keys[e.code] = false; });
  const setPointer = e => pointer.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  // touch: a floating joystick appears wherever the finger lands; mouse: blob follows the cursor
  let JOY_R = 60;
  const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0, mag: 0 };
  function joyMove(e) {
    let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
    const d = Math.hypot(dx, dy), k = d > JOY_R ? JOY_R / d : 1;
    dx *= k; dy *= k;
    joy.mag = Math.min(1, d / JOY_R);
    if (d > 0) { joy.x = dx / Math.max(d * k, 0.001); joy.y = dy / Math.max(d * k, 0.001); }
    $('knob').style.transform = `translate(${dx}px, ${dy}px)`;
  }
  function joyEnd(e) {
    if (e.pointerId !== joy.id) return;
    joy.id = null; joy.mag = 0; $('joy').hidden = true;
  }
  stage.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') { setPointer(e); pointerActive = true; return; }
    if (joy.id !== null) return;
    pointerTouch = true;
    joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.mag = 0;
    const el = $('joy'); el.style.left = e.clientX + 'px'; el.style.top = e.clientY + 'px'; el.hidden = false;
    $('knob').style.transform = 'translate(0, 0)';
    try { stage.setPointerCapture(e.pointerId); } catch (err) {}
  });
  stage.addEventListener('pointermove', e => {
    if (e.pointerType === 'mouse') { setPointer(e); pointerActive = true; return; }
    if (e.pointerId === joy.id) joyMove(e);
  });
  stage.addEventListener('pointerup', joyEnd);
  stage.addEventListener('pointercancel', joyEnd);
  ABIL_CFG.slotBtn.forEach((bid, i) => $(bid).addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); useSlot(i); }));

  function dash() {
    if (DuoM.server || DuoM.guest) { DuoM.act('dash'); return; }
    if (splitRules() || !running || !player.cells.length || player.dashCd > 0 || paused) return;
    if (ModeX.hcNoDash()) { toast('⛓ Оковы: рывок недоступен'); return; }
    player.dashT = (0.35 + 0.035 * U.light) * ModeX.hcDashLenK(); player.dashCd = dashCdBase * ModeX.hcK('dash'); stats.dashes = (stats.dashes || 0) + 1; abUsed('dash');
    { const [x, z] = pCenterXZ(); abFlash('dash', x, z, null, 'dash'); }
    const cost = 0.03 * (1 - 0.08 * U.light);
    player.cells.forEach(c => c.mass = Math.max(START_MASS * 0.5, c.mass * (1 - cost)));
  }
  function splitOwner(o, max, mergeTime) {
    let did = false;
    for (const c of [...o.cells].sort((a, b) => b.mass - a.mass)) {
      if (o.cells.length >= max || !o.free.length) break;
      if (c.mass < 20) continue;
      c.mass /= 2;
      const r = cellR(c);
      const n = addCell(o, c.x + c.hx * r, c.z + c.hz * r, c.mass, o.free.pop());
      n.hx = c.hx; n.hz = c.hz;
      if (o.isPlayer && c.hcHalf !== undefined) n.hcHalf = c.hcHalf;
      n.vx = c.hx * 75; n.vz = c.hz * 75;
      c.mergeT = n.mergeT = mergeTime * (o.isPlayer ? ModeX.hcK('merge') : 1);
      c.vis.jig = n.vis.jig = 1;
      emit(n.x, r, n.z, cellColor(c), 14, 14, .5);
      did = true;
    }
    if (did) o.splitCd = SPLIT_CD;
    return did;
  }
  function split() {
    if (DuoM.server || DuoM.guest) { DuoM.act('split'); return; }
    if (dailyIs('dashonly')) return;
    if (!running || paused || !player.cells.length || player.splitCd > 0) return;
    if (splitOwner(player, playerMaxParts(), playerMergeTime())) { player.splitCd = playerSplitCd(); stats.splits++; abUsed('split'); rebuildCells(); buzz(20); { const [x, z] = pCenterXZ(); abFlash('split', x, z, null, 'split'); } }
  }

  // ================= bot brain =================
  // Одинаковая обычная сложность ботов во всех режимах и для всех игроков.
  const BOT_SKILL = { normal: { sense: 1, lead: .4, careful: 1, speed: .92 } };
  const botSkill = () => BOT_SKILL.normal;
  const botLead = o => botSkill().lead * (o.persona === 'hunter' || o.star ? 1.5 : 1);
  function think(o) {
    const c = o.cells.reduce((a, b) => a.mass >= b.mass ? a : b), p0 = PERSONA[o.persona] || PERSONA.normal, p = mode === 'hardcore' && o.kind === 'bot' ? { ...p0, chase: Math.min(1, p0.chase * 1.5 + .2), flee: p0.flee * .6 } : ModeX.clAngry() && o.kind === 'bot' ? { ...p0, chase: Math.min(1, p0.chase * 1.3 + .1), flee: p0.flee * .75 } : p0;   // «Классика» after 20 000: bolder bots
    const r = cellR(c), sense = (ev.active === 'eclipse' ? .5 : ev.active === 'bounty' && ev.target === player ? 1.6 : 1) * (14 + r * 3) * p.sense * (o.star ? 1.35 : 1) * 1.3 * (o.jit || 1) * botSkill().sense * (o.kind === 'boss' ? ModeX.hcBossSenseK() : 1) * (o.kind === 'bot' || o.kind === 'boss' ? ModeX.hcSenseK() : 1);
    if (o.hcPack && ModeX.splitMode()) { const p = ModeX.hcPackTarget(o); if (p) { o.target = p.t; o.tx = p.x; o.tz = p.z; return; } }
    if (mode === 'crown' && running && crownHolder && crownHolder !== o && crownHolder.cells.length && (o.kind === 'bot' || o.kind === 'boss')) {   // everyone hunts the crown
      // 2.7: bosses go for the holder wherever it is; a bot bigger than the holder hunts it across the whole arena;
      // a smaller bot goes for any piece of the holder it can swallow (after a split) within a wide range
      const t = mainOf(crownHolder), d = Math.hypot(t.x - c.x, t.z - c.z);
      if (o.kind === 'boss' || canEat(c, t)) { o.target = t; o.tx = t.x; o.tz = t.z; return; }
      let bit = null, bd = sense * 3;
      for (const h of crownHolder.cells) { const dh = Math.hypot(h.x - c.x, h.z - c.z); if (dh < bd && canEat(c, h)) { bd = dh; bit = h; } }
      if (bit) { o.target = bit; o.tx = bit.x; o.tz = bit.z; return; }
    }
    if (mode === 'royale' && running) { const Z = ModeX.zoneC; if (Math.hypot(c.x - Z.x, c.z - Z.z) > zoneR * .8) { o.tx = Z.x + (c.x - Z.x) * .3; o.tz = Z.z + (c.z - Z.z) * .3; o.target = null; return; } }   // run from the storm
    if (o.kind === 'boss' && mode === 'hardcore' && ModeX.hcBossPressure() >= .2 && player.cells.length) {
      const t = ModeX.hcBossTarget(o);
      if (t) {
        const pressure = ModeX.hcBossPressure(), dx = t.x - c.x, dz = t.z - c.z, d = Math.hypot(dx, dz) || 1;
        // Predict movement only a little: the boss aims ahead, but never tracks a perfect future position.
        const lead = .25 + pressure * .85;
        let tx = t.x + Math.max(-14, Math.min(14, t.vx || 0)) * lead;
        let tz = t.z + Math.max(-14, Math.min(14, t.vz || 0)) * lead;
        // One of two bosses pressures the target directly; the other tries to cut off its escape line.
        if (o.hcRole === 'intercept' && pressure >= .4) {
          const side = 10 + pressure * 12;
          tx += -dz / d * side; tz += dx / d * side;
        }
        // Громила tries to push the player away from the safer outer edge.
        if (o.bossType === 'giant' && pressure >= .3) {
          const edge = Math.hypot(t.x, t.z) || 1, block = 4 + pressure * 9;
          tx -= t.x / edge * block; tz -= t.z / edge * block;
        }
        o.target = t; o.tx = tx; o.tz = tz;
        // Шустрик announces a dash before accelerating, leaving a readable dodge window.
        if (o.bossType === 'hunter' && o.dashCd <= 0 && !o.hcDashWarn && d < 38 + pressure * 18) {
          o.hcDashWarn = .48; o.hcDashTarget = t;
          wave(c.x, c.z, '#ff6b3d', cellR(c), cellR(c) + 18 + pressure * 8, .5);
        }
        // Мимик сохраняет маскировку, но на поздних этапах готовит короткую засаду.
        if (o.bossType === 'chameleon' && pressure >= .65 && o.dashCd <= 0 && !o.hcDashWarn && d < 28 + pressure * 12) {
          o.hcDashWarn = .62; o.hcDashTarget = t;
          wave(c.x, c.z, '#3dffa2', cellR(c), cellR(c) + 14, .62);
        }
        // Делитель deliberately opens a second angle after the player has grown.
        if (o.bossType === 'splitter' && pressure >= .35 && o.splitCd <= 0 && o.cells.length < 6 && c.mass / 2 > t.mass * 1.25) {
          o.cells.forEach(k => { k.hx = dx / d; k.hz = dz / d; });
          if (splitOwner(o, 6, 10)) { o.splitCd = 6; rebuildCells(); }
        }
        return;
      }
    }
    if (o.bossType === 'hunter' && player.cells.length) {
      let best = null, bd = Infinity;
      if (!abOn('cloak')) for (const t of player.cells) { const d = Math.hypot(t.x - c.x, t.z - c.z); if (canEat(c, t) && d < bd) { bd = d; best = t; } }
      if (best) {
        o.target = best; o.tx = best.x; o.tz = best.z;
        if (o.dashCd <= 0 && bd < 35) { o.dashT = 0.5; o.dashCd = 5; }
        return;
      }
    }
    let fx = 0, fz = 0, prey = null, preyScore = Infinity;
    for (const t of cells) {
      if (t.owner === o || abOn('cloak', t.owner)) continue;
      const d = Math.hypot(t.x - c.x, t.z - c.z);
      if (d > sense || (t.owner === player && d > sense * .5 && charIs('ghost'))) continue;   // «Призрак»: seen at half the distance
      if (p.flee > 0 && canEat(t, c) && d < sense * Math.min(1, p.flee)) {
        const w = p.flee / Math.max(d, 1); fx -= (t.x - c.x) * w; fz -= (t.z - c.z) * w;
      } else if (p.chase > 0 && c.mass > t.mass * 1.25 * p.preyK && canEat(c, t)) {
        const score = d * (p.likesPlayer && t.owner.isPlayer ? 0.6 : 1) / Math.pow(Math.max(4, t.mass), .35);   // worth = mass / distance
        if (score < preyScore) { prey = t; preyScore = score; }
      }
    }
    // bots don't always notice spikes: cowards are careful, aggressive bots blunder into them
    const careful = o.kind === 'boss' ? .35 : o.star ? .85 : ({ coward: .7, farmer: .5, normal: .4, hunter: .3, aggressive: .2 })[o.persona] ?? .4;
    if ((o.spikeMemT = (o.spikeMemT || 0) - .35) <= 0) { o.spikeMemT = 3 + Math.random() * 2; o.spikeBlind = Math.random() >= careful * botSkill().careful; }   // a decision kept for 3–5 s
    if (c.mass > VIRUS_MASS * 1.3 && !o.spikeBlind) for (const v of viruses) {
      const d = Math.hypot(v.x - c.x, v.z - c.z);
      if (d < cellR(c) + 4) { const w = 1.4 / Math.max(d, 1); fx -= (v.x - c.x) * w; fz -= (v.z - c.z) * w; }
    }
    if (fx || fz) {   // fleeing: never into the wall
      const dc = Math.hypot(c.x, c.z); if (dc > R - 25 - r) { const l = Math.hypot(fx, fz) || 1, k = (dc - (R - 25 - r)) / 25 + .5; fx = fx / l - c.x / dc * k; fz = fz / l - c.z / dc * k; }
      o.tx = c.x + fx * 20; o.tz = c.z + fz * 20; o.target = null; return; }
    // hunters share a target with their partner
    if (o.persona === 'hunter' && o.partner && o.partner.target && !o.partner.target.gone) {
      const t = o.partner.target;
      if (canEat(c, t) && Math.hypot(t.x - c.x, t.z - c.z) < sense * 1.6) prey = t;
    }
    if (prey && Math.random() < p.chase) {
      o.target = prey; o.tx = prey.x; o.tz = prey.z;
      // bold bots split to snatch prey that is close and small enough for a half
      const isSplitter = o.bossType === 'splitter', maxParts = isSplitter ? 6 : BOT_PARTS;
      if (running && ((o.kind === 'bot' && (!o.build || o.build.includes('split'))) || isSplitter) && p.chase >= .85 && o.splitCd <= 0 && o.cells.length < maxParts) {
        const d = Math.hypot(prey.x - c.x, prey.z - c.z), rc = cellR(c);
        if (c.mass / 2 > prey.mass * eatRatio(prey) && d > rc * 0.8 && d < 6 + rc * 4) {
          o.cells.forEach(k => { k.hx = (prey.x - k.x) / (Math.hypot(prey.x - k.x, prey.z - k.z) || 1); k.hz = (prey.z - k.z) / (Math.hypot(prey.x - k.x, prey.z - k.z) || 1); });
          if (splitOwner(o, maxParts, isSplitter ? 10 : 14)) { if (isSplitter) o.splitCd = 6; rebuildCells(); }
        }
      }
      return;
    }
    o.target = null;
    if (Math.hypot(c.x, c.z) > R - 12 - r && Math.random() < .5) { o.tx = c.x * .6; o.tz = c.z * .6; return; }
    let best = null, bd = Infinity;
    for (let i = (Math.random() * 3) | 0; i < FOOD; i += 3) {
      const f = foods[i], d = (f.x - c.x) ** 2 + (f.z - c.z) ** 2;
      if (d < bd) { bd = d; best = f; }
    }
    for (const e of ejects) {                     // ejected blobs are tasty bait
      const d = ((e.x - c.x) ** 2 + (e.z - c.z) ** 2) * 0.3;
      if (d < bd && cellR(c) > 1.3) { bd = d; best = e; }
    }
    if (best) { o.tx = best.x; o.tz = best.z; }
  }

  // ================= simulation =================
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit = new THREE.Vector3();
  function clampArena(c) {
    const rr = R - cellR(c) * 0.6, dc = Math.hypot(c.x, c.z);
    if (dc > rr) { c.x *= rr / dc; c.z *= rr / dc; }
  }
  function steer(c, tx, tz, dt) {
    let dx = tx - c.x, dz = tz - c.z;
    const d = Math.hypot(dx, dz);
    if (d > 0.05) {
      dx /= d; dz /= d;
      const turnK = c.owner.kind === 'boss' && mode === 'hardcore' ? ModeX.hcBossTurnK() : 1;
      const k = Math.min(1, dt * (c.owner.iceT > 0 ? 1.2 : arenaIs('ice') ? 3 : 8) * turnK);
      c.hx += (dx - c.hx) * k; c.hz += (dz - c.hz) * k;
      const hl = Math.hypot(c.hx, c.hz) || 1; c.hx /= hl; c.hz /= hl;
      const v = speedOf(c) * Math.min(1, d / 1.5 + (c.owner.isPlayer || c.owner.kind === 'rival' ? 0.35 : 1));
      c.x += c.hx * v * dt; c.z += c.hz * v * dt;
    }
    if (c.vx || c.vz) {
      c.x += c.vx * dt; c.z += c.vz * dt;
      const k = Math.exp(-5 * dt); c.vx *= k; c.vz *= k;
      if (Math.abs(c.vx) + Math.abs(c.vz) < 0.05) c.vx = c.vz = 0;
    }
    clampArena(c);
  }

  // results: numbers count up, tiles slide in one by one (instant with reduced motion)
  document.addEventListener('pointerdown', e => { const b = e.target.closest && e.target.closest('#boardMore'); if (!b) return; e.stopPropagation(); e.preventDefault(); boardOpen = !boardOpen; hudT = 0; }, true);
  // skeleton rows for lists that load from the server
  const skelHTML = (n = 6) => Array.from({ length: n }, (_, i) => `<li class="skel" aria-hidden="true"><i class="sk-a"></i><span class="sk-t"><i style="width:${55 + (i * 23) % 35}%"></i><i></i></span><i></i></li>`).join('') + '<li class="sr-only">Загрузка…</li>';
  function resCountUp() {
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches, t0 = performance.now(), D = 900;
    const els = [...document.querySelectorAll('#resultCard [data-to]')];
    const fmt = (el, v) => { el.textContent = (el.classList.contains('rw-c') ? '+' : '') + Math.round(v).toLocaleString('ru-RU') + (el.classList.contains('rw-c') ? ' ◆' : ''); };
    if (still) { els.forEach(el => fmt(el, +el.dataset.to)); return; }
    const step = now => { const k = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - k, 3); els.forEach(el => fmt(el, +el.dataset.to * e)); if (k < 1 && !$('resultCard').hidden) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  function finishRound(title, bonus, win) {
    if (dying) return;
    stats.endTitle = title; stats.modeBonus = bonus || 0; stats.win = !!win;
    dying = true; setTimeout(endRound, 500);
  }
  const teamTotal = t => owners.filter(o => o.team === t).reduce((s, o) => s + total(o), 0);
  let crownHolder = null, zoneR = R;
  const zoneLine = new THREE.Mesh(new THREE.RingGeometry(.985, 1, 180), decal(new THREE.MeshBasicMaterial({ color: '#ff3d6e', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  const zoneOut = new THREE.Mesh(new THREE.RingGeometry(1, 4, 180), decal(new THREE.MeshBasicMaterial({ color: '#ff3d6e', transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide })));
  [zoneLine, zoneOut].forEach(m => { m.rotation.x = -Math.PI / 2; m.position.y = .06; m.visible = false; scene.add(m); });
  function modeRules(dt) {
    if (dying) return false;
    const contenders = [player, ...bots].filter(o => o.cells.length);
    if (mode === 'royale') {
      ModeX.zoneTick(dt);   // 2.5: the zone moves in steps (see 14f-modes.js)
      const Z = ModeX.zoneC, zk = ModeX.zoneDmgK();
      for (const c of [...cells]) {
        if (c.gone || c.owner.kind === 'boss' || c.owner.kind === 'minion' || Math.hypot(c.x - Z.x, c.z - Z.z) <= zoneR) continue;
        c.mass -= (c.mass * .06 + 2) * zk * dt;          // the storm outside the zone eats mass
        if (c.mass < 6) { const o = c.owner; removeCell(c); rebuildCells(); lostCell(o, 6, { name: 'Зона', cells: [] }); }
      }
      const aliveBots = bots.filter(o => o.cells.length).length;
      if (player.cells.length && aliveBots === 0) { stats.finalRank = 1; finishRound('Победа в королевской битве!', 60, true); return true; }
    }
    if (mode === 'timed' && stats.time >= TIMED_LEN) {
      const ranked = owners.filter(o => o.cells.length && o.kind !== 'minion').sort((a, b) => total(b) - total(a));
      const r = ranked.indexOf(player) + 1;
      stats.finalRank = r; stats.timedWin = r === 1;
      finishRound(`Время вышло: ${r} место`, ModeX.placeBonus(r), r === 1);
      return true;
    }
    if (mode === 'crown') {
      ModeX.crownRules(dt, contenders);   // 2.5: the crown passes only by eating its holder (it starts in the middle of the field)
      if (crownHolder && !abOn('x_ghost', crownHolder)) crownHolder.crownT += dt;   // no crown time while a ghost
      
    }
    if (mode === 'team' && stats.time >= TEAM_LEN) {
      const a = Math.round(teamTotal('A')), b = Math.round(teamTotal('B')); stats.teamA = a; stats.teamB = b;
      finishRound(a >= b ? `Победа синих ${a} : ${b}` : `Победа красных ${b} : ${a}`, a >= b ? 50 : 0, a >= b);
      return true;
    }
    if (mode === 'raid') {
      if (stats.raidSpawned && !colossus.cells.length && !colossus2.cells.length) {
        if (spawnRaidChunk()) toast('Босс собирается снова!');
        else { finishRound(`Ступень ${['I', 'II', 'III', 'IV', 'V'][RaidX.tierI()]} пройдена!`, 0, true); return true; }
      }
      if (stats.raidDmg >= RaidX.tier().hp) { finishRound(`Ступень ${['I', 'II', 'III', 'IV', 'V'][RaidX.tierI()]} пройдена!`, 0, true); return true; }
      if (stats.time >= RAID_LEN + raidPerk().time) { finishRound('Время рейда вышло', 0, false); return true; }
    }
    if (mode === 'raid') {
      // the colossus splits a part off whenever the player swims close
      for (const colossus of raidTwins) if (colossus.cells.length && colossus.splitCd <= 0 && colossus.cells.length < 12) {
        for (const c of colossus.cells) {
          if (c.mass < 120) continue;
          const rc = cellR(c);
          const att = player.cells.find(pc => Math.hypot(pc.x - c.x, pc.z - c.z) < rc + cellR(pc) + 6);
          if (!att) continue;
          const dx = c.x - att.x, dz = c.z - att.z, d = Math.hypot(dx, dz) || 1, side = Math.random() < .5 ? 1 : -1;
          c.mass /= 2;
          const n = addCell(colossus, c.x + dx / d * rc * 0.5, c.z + dz / d * rc * 0.5, c.mass, colossus.free.pop());
          n.vx = (dx / d * 0.5 - dz / d * side) * 40; n.vz = (dz / d * 0.5 + dx / d * side) * 40;
          c.mergeT = n.mergeT = 1e9;
          colossus.splitCd = 1.2;
          rebuildCells();
          break;
        }
      }
    }
    return false;
  }
  let historyT = 0;
  // Spatial broad phase for eating: only inspect cells in the eater's reachable area.
  const EAT_GRID_SIZE = 48, eatGrid = new Map(), eatCandidates = [];
  const eatGridKey = (x, z) => ((x & 65535) << 16) | (z & 65535);
  function update(dt) {
    if (DuoM.server) { DuoM.serverTick(dt); return; }
    if (DuoM.paused) return;   // a match for two waits while the link to the other phone is silent
    if (DuoM.guest) { DuoM.guestTick(dt); return; }   // the second phone of a match for two only draws what the host sends
    stats.time += dt;
    player.ejectCd = Math.max(0, (player.ejectCd || 0) - dt);
    if (modeRules(dt)) return;
    ModeX.tick(dt);
    if (dying) return;
    for (const o of owners) { o.splitCd = Math.max(0, o.splitCd - dt); if (o.stunT) o.stunT = Math.max(0, o.stunT - dt); for (const c of o.cells) c.mergeT = Math.max(0, c.mergeT - dt); }
    for (const k in effects) effects[k] = Math.max(0, effects[k] - dt);
    player.dashT -= dt; player.dashCd = Math.max(0, player.dashCd - dt);
    abTick(dt);
    trailFx(dt, performance.now());
    if (player.dashT > 0) { const lk = lookFor('dash'); for (const c of player.cells) { const r = cellR(c); emit(c.x - c.hx * r, r * .8, c.z - c.hz * r, lk ? lk.c : cellColor(c), 4, 4, .45); } }
    if (!stats.tutorial) { bonusTimer -= dt; owlTick(performance.now()); if (bonusTimer <= 0) { spawnBonus(); bonusTimer = (arenaIs('ocean') ? 5.4 : 9) * ModeX.bonusK(); } }
    else if (tutTick(dt)) return;
    if (bossesOn()) bossTimer -= dt;
    if (bossTimer <= 0) {
      // survival: a new wave every 15 s, even if the arena is full of bosses
      if (mode === 'survival') { stats.wave++; const cb = ModeX.survCombo(); if (cb) spawnCombo(cb); else spawnBoss(); bossTimer = ModeX.survWave(); }
      else bossTimer = (spawnBoss() ? (dailyIs('bosses') ? 20 : mode === 'hardcore' ? ModeX.hcBossSpawnInterval() : 40 * ModeX.bossK()) : 5);
    }
    for (const o of bossOwners) {
      if (!o.cells.length) continue;
      o.dashT -= dt; o.dashCd = Math.max(0, o.dashCd - dt);
      if (o.hcDashWarn > 0) {
        o.hcDashWarn -= dt;
        if (o.hcDashWarn <= 0) {
          const target = o.hcDashTarget;
          if (target && !target.gone && mode === 'hardcore') { o.dashT = .48 + .12 * ModeX.hcBossPressure(); o.dashCd = Math.max(2.5, 5 - ModeX.hcBossPressure() * 2.5); }
          o.hcDashTarget = null; o.hcDashWarn = 0;
        }
      }
      if (o.bossType === 'queen') { o.spawnT -= dt; if (o.spawnT <= 0) { spawnMinion(o); o.spawnT = mode === 'hardcore' ? Math.max(3.2, 5 - 1.5 * ModeX.hcBossPressure()) : 5; } }
      if (o.bossType === 'frost') {   // a cold cloud around it: everyone close is slowed (players and the second player of a match for two)
        const c = o.cells[0], rc = cellR(c), reach = rc + 26 + (mode === 'hardcore' ? 10 * ModeX.hcBossPressure() : 0);
        for (const p of [player, DuoM.rival]) for (const pc of p.cells) if (Math.hypot(pc.x - c.x, pc.z - c.z) < reach + cellR(pc)) { ccAura(p, dt); break; }
        o.frT = (o.frT ?? 0) - dt; if (o.frT <= 0) { o.frT = mode === 'hardcore' ? Math.max(1.0, 1.4 - .3 * ModeX.hcBossPressure()) : 1.4; if (nearView(c.x, c.z)) wave(c.x, c.z, '#9ff0ff', rc, reach, .9); }
      }
      o.life -= dt;
      if (o.life <= 0) { [...o.cells].forEach(removeCell); rebuildCells(); toast(`${o.name} ушёл с арены`); }
    }

    // player
    let kx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    let kz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
    let aim = null;
    if (!kx && !kz && pointerActive) { ray.setFromCamera(pointer, camera); if (ray.ray.intersectPlane(plane, hit)) aim = hit; }
    const twin = xfx.find(f => f.id === 'x_twin' && f.o === player && !f.cb.gone && !f.ca.gone);
    for (const c of player.cells) {
      if (twin && c === twin.cb) {   // «Зеркальный двойник»: moves as the mirror image (left ↔ right) of the main part
        const m = twin.ca, [ax, az] = kx || kz ? [kx, kz] : joy.id !== null && joy.mag > 0.15 ? [joy.x, joy.y] : aim ? [aim.x - m.x, aim.z - m.z] : [m.hx, m.hz];
        const l = Math.hypot(ax, az) || 1; steer(c, c.x - ax / l * 10, c.z + az / l * 10, dt); continue; }
      if (kx || kz) steer(c, c.x + kx * 10, c.z + kz * 10, dt);
      else if (joy.id !== null && joy.mag > 0.15) steer(c, c.x + joy.x * 1.5 * joy.mag, c.z + joy.y * 1.5 * joy.mag, dt);
      else if (aim) steer(c, aim.x, aim.z, dt);
      else steer(c, c.x + c.hx * 10, c.z + c.hz * 10, pointerTouch ? dt : 0);
    }
    // own cells: push apart while cooling down, merge afterwards
    for (const o of owners) {
    const pc = o.cells;
    for (let i = 0; i < pc.length; i++) for (let j = i + 1; j < pc.length; j++) {
      const a = pc[i], b = pc[j];
      if (a.gone || b.gone) continue;
      const ra = cellR(a), rb = cellR(b);
      let dx = b.x - a.x, dz = b.z - a.z; const d = Math.hypot(dx, dz) || 0.001;
      const mergeCap = o.isPlayer ? Infinity : o.kind === 'bot' ? BOT_MASS_CAP : o.kind === 'boss' ? bossMassCap() : MAX_MASS;
      const hcDifferentHalves = ModeX.splitMode() && o.isPlayer && a.hcHalf !== undefined && b.hcHalf !== undefined && a.hcHalf !== b.hcHalf && !ModeX.hcFusing();
      if (hcDifferentHalves || a.mergeT > 0 || b.mergeT > 0 || a.mass + b.mass > mergeCap) {   // parts that would exceed this owner's cap stay apart
        if (d < ra + rb) {
          const push = (ra + rb - d) / 2 * Math.min(1, dt * 10); dx /= d; dz /= d;
          a.x -= dx * push; a.z -= dz * push; b.x += dx * push; b.z += dz * push;
        }
      } else {
        const pull = Math.min(1, dt * 1.5);
        a.x += dx * pull * 0.5; a.z += dz * pull * 0.5; b.x -= dx * pull * 0.5; b.z -= dz * pull * 0.5;
        if (d < Math.max(ra, rb) * 0.7) { a.mass += b.mass; a.hx = (a.hx + b.hx) / 2; removeCell(b); }
      }
    }
    }

    // bots
    for (const o of owners) {
      if (o.isPlayer) continue;
      if (o.kind === 'rival') { DuoM.steerRival(o, dt); continue; }   // steered by the other phone
      if (!o.cells.length) { if (o.kind === 'bot') { o.respawn -= dt; if (o.respawn <= 0) spawnBot(o); } continue; }
      if (o.spawnSh > 0) o.spawnSh -= dt;
      o.think -= dt;
      if (o.kind === 'bot' && o.dashT) o.dashT = Math.max(0, o.dashT - dt);
      if (o.think <= 0) {
        think(o); o.think = o.kind === 'boss' && mode === 'hardcore' ? (0.25 + Math.random() * 0.25) / (1 + .75 * ModeX.hcBossPressure()) : 0.25 + Math.random() * 0.25;
        if (o.target && o.target.owner) { const dc = o.target.owner === player ? decoy : botDecoys.find(d => d.src === o.target.owner); if (dc) o.target = dc; }
        botAI(o);
      }
      if (o.target && !o.target.gone) {   // 1.7.0: aim where the prey will be, not where it is
        const t = o.target, lead = o.target.owner && o.target.owner.decoy ? 0 : botLead(o), v = t.owner && t.owner.cells ? speedOf(t) : 0;
        o.tx = t.x + (t.hx || 0) * v * lead; o.tz = t.z + (t.hz || 0) * v * lead; }
      o.cells.forEach(k => steer(k, o.tx, o.tz, dt));
    }
    rebuildCells();

    // food + decay
    const pMagnet = starBonus('magnet') + 0.8 * U.magnet + (effects.magnet > 0 ? 6 : 0) + petLv('magnet') + (charIs('gatherer') ? 3 : 0);
    const pGain = (1 + 0.015 * (U.digest || 0)) * (effects.double > 0 ? 2 : 1) * (dailyIs('feast') ? 2 : 1) * ModeX.gainK() * (charIs('gatherer') ? 1.3 : charIs('ghost') ? .9 : 1);
    for (const c of cells) {
      const isP = c.owner.isPlayer;
      const fx2 = c.owner.eff;   // the second player of a match for two keeps their bonuses here
      const r = cellR(c) + (isP ? (pMagnet + (ModeX.hcK('magnet') - 1) * (cellR(c) * .5 + 4)) * ModeX.hcMagnetK() : fx2 && fx2.magnet > 0 ? 6 : 0);
      const gain = (isP ? pGain : fx2 && fx2.double > 0 ? 2 : 1) * (abOn('pulse', c.owner) ? 2 : 1) * (c.owner.dbAbs || 1);
      const gx0 = fgCell(c.x - r), gx1 = fgCell(c.x + r), gz0 = fgCell(c.z - r), gz1 = fgCell(c.z + r);
      for (let gx = gx0; gx <= gx1; gx++) for (let gz = gz0; gz <= gz1; gz++) { const bucket = fgrid[gx * FGN + gz];
      for (let j = bucket.length - 1; j >= 0; j--) {
        const i = bucket[j], f = foods[i];
        if (i === undefined) continue;
        if ((f.x - c.x) ** 2 + (f.z - c.z) ** 2 < r * r) {
          if (isP && Math.random() < .5) emit(f.x, .4, f.z, foodPalette[i % 5], 2, 5, .35);
          if (isP) Sound.play('crumb');
          c.mass += gain; placeFood(i);
          if (isP) stats.crumbs++;
        }
      } }
      // decay grows with size, so mass can't snowball forever
      // 2.7: half as fast and only from 500 mass (a small drop does not melt); «Хардкор» keeps the old, harsh one
      if (c.mass > (mode === 'hardcore' ? 100 : 500) && c.owner.kind !== 'boss' && !abOn('pulse', c.owner)) c.mass -= c.mass * (mode === 'hardcore' ? ModeX.HC_DECAY : 0.0015) * Math.pow(c.mass / 100, 0.25) * (isP ? (1 - 0.04 * U.guard) * ModeX.meltK() * (charIs('predator') ? 1.1 : 1) : 1) * dt;
    }

    // bonuses (player only)
    for (let i = bonuses.length - 1; i >= 0; i--) {
      const b = bonuses[i];
      if (DuoM.rivalPick(b)) { scene.remove(b.mesh); bonuses.splice(i, 1); continue; }
      if (player.cells.some(c => Math.hypot(c.x - b.x, c.z - b.z) < cellR(c) + 1)) {
        // same bonus stacks its time, capped at 30 s
        const stacked = !BONUS[b.type].instant && effects[b.type] > 0;
        if (BONUS[b.type].instant) fountainBurst();
        else effects[b.type] = Math.min(b.type === 'shield' ? 10 : 30, effects[b.type] + effectDur(b.type));   // 1.7.0: invulnerability stacks only to 10 s
        emit(b.x, 1.2, b.z, BONUS[b.type].color, 36, 16, .7);
        stats.bonuses++;
        save.bonusHint = save.bonusHint || {}; const hint = (save.bonusHint[b.type] || 0) < 3;
        if (hint) save.bonusHint[b.type] = (save.bonusHint[b.type] || 0) + 1;
        toast(`${BONUS[b.type].name}${stacked ? ` ×стак: ${Math.ceil(effects[b.type])} с` : '!'}${hint ? ` — ${BONUS_HINT[b.type]}` : ''}`); Sound.play('bonus');
        scene.remove(b.mesh); bonuses.splice(i, 1);
      }
    }

    // eating — keep one stable cell snapshot for the entire collision pass.
    // lostCell() may rebuild the global cells array (for example on an extra life),
    // but candidate indices must continue to refer to the array used to build eatGrid.
    const eatCells = cells;
    eatGrid.clear();
    let eatMassTotal = 0;
    for (let i = 0; i < eatCells.length; i++) {
      const c = eatCells[i]; if (c.gone) continue;
      eatMassTotal += c.mass;
      const gx = Math.floor(c.x / EAT_GRID_SIZE), gz = Math.floor(c.z / EAT_GRID_SIZE), key = eatGridKey(gx, gz);
      let bucket = eatGrid.get(key); if (!bucket) eatGrid.set(key, bucket = []);
      bucket.push(i);
    }
    for (const a of eatCells) {
      if (dying || a.gone) continue;
      // Upper bound includes all current mass and the maximum temporary hunt/cloak eating bonus.
      const searchR = 0.38 * Math.sqrt(Math.max(0, eatMassTotal * 1.27)) * (a.owner.rs || 1);
      const gx0 = Math.floor((a.x - searchR) / EAT_GRID_SIZE), gx1 = Math.floor((a.x + searchR) / EAT_GRID_SIZE);
      const gz0 = Math.floor((a.z - searchR) / EAT_GRID_SIZE), gz1 = Math.floor((a.z + searchR) / EAT_GRID_SIZE);
      eatCandidates.length = 0;
      for (let gx = gx0; gx <= gx1; gx++) for (let gz = gz0; gz <= gz1; gz++) {
        const bucket = eatGrid.get(eatGridKey(gx, gz));
        if (bucket) for (let j = 0; j < bucket.length; j++) eatCandidates.push(bucket[j]);
      }
      eatCandidates.sort((x, y) => x - y);
      for (let ci = 0; ci < eatCandidates.length; ci++) {
      const b = eatCells[eatCandidates[ci]];
      if (dying || a.gone || b.gone || a.owner === b.owner) continue;
      const pairMate = !canEat(a, b) && !ModeX.hcPackMerge(a, b) ? ModeX.hcPairBite(a, b) : null;
      if (!(canEat(a, b) || ModeX.hcPackMerge(a, b) || pairMate)) continue;
      // 2.7: after a pack bites the player, the whole pack waits 2.5 s before the next bite (4 bites in a second felt unfair)
      if (a.owner.hcPack && b.owner.isPlayer && stats.time < (stats.packBiteUntil || 0)) continue;
      // 2.7: above 20 000 the radius grows slowly, so a far heavier eater barely looks bigger — the more it outweighs the player, the less of them it must cover (×2 and more: the centre inside is enough)
      const coverK = b.owner.isPlayer && !a.owner.isPlayer ? Math.max(0, .35 * (2 - a.mass / b.mass) / .75) : .35;
      if (pairMate || Math.hypot(a.x - b.x, a.z - b.z) < cellR(a) - cellR(b) * coverK) {
        if (a.owner.isPlayer) { stats.biggestPrey = Math.max(stats.biggestPrey || 0, b.mass); if (b.owner.kind === 'boss') stats.biggestBoss = Math.max(stats.biggestBoss || 0, b.mass); if (mode === 'raid' && raidTwins.includes(b.owner)) {
          stats.raidDmg = (stats.raidDmg || 0) + Math.round(b.mass * ModeX.raidDmgK());
        } }
        const gain = b.mass * 0.8 * (mode === 'hardcore' && b.owner.kind === 'boss' ? (pairMate || ModeX.hcFusing() ? .22 : total(player) >= 30000 ? .35 : .5) : 1) * (mode === 'hardcore' && a.owner.isPlayer && b.owner.kind !== 'boss' ? (b.owner.hcPack ? .2 : total(player) >= 50000 ? .5 : 1) : 1) * (a.owner.isPlayer && b.owner.kind !== 'boss' ? ModeX.clGainK() * (b.owner.hcPack && mode === 'classic' ? .25 : 1) : 1) * (a.owner.isPlayer && b.owner.kind === 'boss' ? ModeX.clBossGainK(pairMate) : 1) * (a.owner.huntT > 0 && b.owner.kind !== 'boss' ? 1.1 : 1) * (a.owner.cloakBonus && abOn('cloak', a.owner) && b.owner.kind !== 'minion' ? (a.owner.cloakBonus = false, 1.2) : 1) * (abOn('pulse', a.owner) && b.owner.kind === 'bot' ? 1.3 : 1) * (a.owner.isPlayer ? (b.owner.kind === 'bot' || b.owner.kind === 'boss' ? (charIs('predator') ? 1.15 : charIs('gatherer') ? .85 : 1) : 1) * (charIs('ghost') ? .9 : 1) : 1);
        const ordinaryBoss = a.owner.kind === 'boss' && !['colossus', 'colossus2'].includes(a.owner.bossType);
        const bossCap = bossMassCap();
        a.mass += ordinaryBoss ? Math.min(gain, Math.max(0, bossCap - total(a.owner))) : gain;
        if (TEST_MODE && a.owner.isPlayer && gain >= 1500) TLog.ev('съел', (b.owner.kind === 'boss' ? 'босс ' + b.owner.bossType : b.owner.hcPack ? 'стая' : b.owner.kind) + ' ' + Math.round(b.mass) + ' → +' + Math.round(gain));   // 2.7: where the big jumps of mass come from
        if (pairMate) { const share = gain * pairMate.mass / (a.mass - gain + pairMate.mass); a.mass -= share; pairMate.mass += share; pairMate.vis.jig = 1; toast('🔗 Двойной укус! Половины съели босса вместе'); }
        const victim = b.owner, lastMass = b.mass;
        if (mode === 'crown') ModeX.crownBite(a, b, victim, lastMass);
        if (victim.isPlayer && a.owner.hcPack) stats.packBiteUntil = stats.time + 2.5;
        if (victim.isPlayer) { buzz(60); Sound.play('eaten'); stats.partsLost = (stats.partsLost || 0) + 1; (stats.bites = stats.bites || []).push([Math.round(stats.time), a.owner.kind === 'boss' ? 'boss:' + a.owner.bossType : a.owner.hcPack ? 'pack' : a.owner.kind || '?', Math.round(a.mass), Math.round(lastMass)]); if (stats.bites.length > 12) stats.bites.shift(); } else if (a.owner.isPlayer) { Sound.play('eat'); stats.eatenCells = (stats.eatenCells || 0) + 1; }
        { const rb = cellR(b); emit(b.x, rb, b.z, cellColor(b), Math.min(70, 16 + Math.round(b.mass / 12)), 10 + rb * 2.5, .8); a.vis.jig = Math.max(a.vis.jig, .6); if (a.owner.isPlayer) { if (skin().id === 'cr_sandup') { const tn = performance.now() / 1000; if (tn - (liveState.sandFlip ?? -99) > 1.4) liveState.sandFlip = tn; }   // 2.7 «Время вспять»: the hourglass turns over
          if (evoOn()) evoEat(b.x, b.z, rb); else eatFx(b.x, b.z, rb, cellColor(b)); } else if (a.owner.fx && a.owner.fx.eat && nearView(b.x, b.z)) eatFx(b.x, b.z, rb, cellColor(a), a.owner.fx.eat); }
        removeCell(b);
        if (a.owner.isPlayer) {
          if (victim.kind === 'boss') {
            if (!victim.cells.length) {
              const bt = bossInfo(victim);
              const wb = mode === 'survival' ? 1 + 0.1 * ((victim.wave || 1) - 1) : 1;
              stats.bosses++; stats.bossCoins += Math.round(bt.coins * wb); stats.bossXp += Math.round(bt.xp * wb);
              if (!stats.bossTypes.includes(victim.bossType)) stats.bossTypes.push(victim.bossType);
              toast(`${bt.name} повержен! +${bt.coins} ◆`); Sound.play('bossDown');
              if (total(player) - lastMass * .8 < 400) stats.smallBoss = true;   // your mass before this bite
            }
          } else if (victim.kind === 'minion') { if (!victim.cells.length) stats.minions++; }
          else if (!victim.cells.length) {
            stats.kills++; ModeX.hcKill(); if (player.dashT > 0) stats.dashKills = (stats.dashKills || 0) + 1;
            if (victim.star) {   // a star bot: bonus coins and experience
              stats.starKills = (stats.starKills || 0) + 1; stats.bossCoins += STAR_COINS; stats.bossXp += 40; if (stats.firstStarT === undefined) stats.firstStarT = stats.time;
              toast(`Звезда «${victim.name}» повержена! +${STAR_COINS} ◆`); Sound.play('star');
            } else toast(`Съедено: ${victim.name}`);
          }
          // combo: several drops eaten within 3 seconds of each other
          stats.combo = stats.time - (stats.comboT ?? -9) < 3 ? (stats.combo || 1) + 1 : 1; stats.comboT = stats.time;
          if (stats.combo >= 2) {
            const bonus = 2 * (stats.combo - 1);
            stats.comboCoins = (stats.comboCoins || 0) + bonus * (arenaIs('retro') ? 2 : 1); stats.bestCombo = Math.max(stats.bestCombo || 0, stats.combo);
            showCombo(stats.combo, bonus); Sound.play('combo', stats.combo);
          }
        }
        lostCell(victim, lastMass, a.owner);
      }
      }
    }
    rebuildCells();

    for (const c of cells) {
      const cap = c.owner.kind === 'bot' ? ModeX.botCap(c.owner)
        : c.owner.kind === 'boss' ? bossMassCap()
        : MAX_MASS;
      if (!c.owner.isPlayer && c.mass > cap && !((mode === 'hardcore' || mode === 'classic') && c.owner.kind === 'boss')) c.mass = cap;
    }
    // The regular bot limit is shared by all of its parts, not repeated per part.
    if (mode === 'hardcore' || mode === 'classic') for (const o of bossOwners) {
      const mass = total(o), cap = mode === 'classic' ? CL_BOSS_MASS_CAP : HC_BOSS_MASS_CAP;
      if (mode === 'classic' && mass > cap * 1.5) { const k = cap * 1.5 / mass; for (const c of o.cells) c.mass *= k; }   // 2.7: never far above the cap
      if (mass > cap) { const k = Math.max(cap / mass, 1 - .01 * dt); for (const c of o.cells) c.mass *= k; }   // 2.7: melts down 1%/s, a comeback stays possible
    }
    for (const o of bots) {
      const mass = total(o), bcap = ModeX.botCap(o);
      if (mass > bcap) {
        const scale = bcap / mass;
        for (const c of o.cells) c.mass *= scale;
      }
    }
    updateEjects(dt);
    updateViruses(dt);
    if (mode !== 'territory' && mode !== 'raid') updateEvent(dt);   // no random arena events in «Захват территории» and «Босс-рейд» (2.7)
    for (const c of player.cells) stats.maxPart = Math.max(stats.maxPart, c.mass);
    stats.maxParts = Math.max(stats.maxParts, player.cells.length);
    const tm = total(player);
    if (player.cells.length) { stats.maxMass = Math.max(stats.maxMass, tm); if (stats.t1000 === undefined && tm >= 1000) stats.t1000 = stats.time; }
    historyT += dt;
    if (historyT >= 1) { historyT = 0; history.push(Math.round(tm)); }
  }

  // ================= HUD =================
  let comboTimer = 0;
  function showCombo(n, bonus) {
    const el = $('combo');
    el.innerHTML = `Комбо ×${n}!<small>+${bonus} ◆</small>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
    clearTimeout(comboTimer); comboTimer = setTimeout(() => el.classList.remove('show'), 1200);
  }
  let toastTimer;
  function toast(text) {
    const t = $('toast'); t.textContent = text; t.classList.toggle('show', !!text);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 1500);
  }
  let hudT = 0, leadersLast = '';
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const setText = (id, t) => { const el = $(id); if (el.textContent !== t) el.textContent = t; };
  let boardOpen = false;   // in-battle leaderboard: top 3 + you, «ещё N» shows the top 6
  const meName = () => DuoM.on && Net.nick ? escHtml(Net.nick) : 'Ты';   // matches for two: your nickname, like the other player sees it
  function updateHud(now) {
    setText('mass', String(Math.round(total(player))));   // 2.7 FPS: the HUD is written only when it changes (it was rewritten every frame)
    if (player.cells.length) {
      let m = 0, v = 0;
      for (const c of player.cells) { m += c.mass; v += speedOf(c) * c.mass; }
      const sp = $('speed');
      setText('speed', `${Math.round(v / m / BASE_SPEED * 100)}%`);
      sp.classList.toggle('boost', player.dashT > 0 || effects.speed > 0);
      const parts = [];
      if (U.speed) parts.push(`+${U.speed}% улучш.`);
      if (effects.speed > 0) parts.push('+45% бонус');
      if (player.dashT > 0) parts.push('рывок');
      const mult = speedBuffK();   // 2.7: the real effect of every buff and slow (the dash is shown on its own; it used to read «бафы +680%»)
      // 2.7: what slows you down right now, with the seconds left (stun from «Отражение», the frost boss and slowing abilities, ice)
      const slowTxt = player.freezeT > 0 ? `💫 оглушение ${player.freezeT.toFixed(1)} с` : player.slowT > 0 ? `❄ замедление −${Math.round((1 - ABIL_CFG.slowFactor) * 100)}% · ${Math.ceil(player.slowT)} с` : player.iceT > 0 ? `❄ лёд · ${Math.ceil(player.iceT)} с` : '';
      setText('buff', slowTxt || (player.dashT > 0 ? 'рывок' : mult > 1.005 ? `бафы +${Math.round((mult - 1) * 100)}%` : mult < .995 ? `бафы −${Math.round((1 - mult) * 100)}%` : ''));
      $('buff').classList.toggle('debuff', !!slowTxt);
      { const t = parts.join(', ') || 'Без бафов'; if (sp.title !== t) sp.title = t; }
    } else setText('speed', '–');
    if (player.abCd) runBuild.forEach((id, i) => {
      if (!id) return;
      const v = slotView(id), b = $(ABIL_CFG.slotBtn[i]);
      { const r = Math.max(0, Math.min(1, v.ready)).toFixed(2); if (b._rd !== r) { b._rd = r; b.style.setProperty('--ready', r); } } if (b._off !== !!v.off) { b._off = !!v.off; b.classList.toggle('off', !!v.off); }
      setText('slotSub' + i, v.sub || (finePointer ? ABIL_CFG.slotKeyName[i] : 'готов'));
    });
    if (now - hudT < 250) return;
    hudT = now;
    const ranked = owners.filter(o => o.cells.length && o.kind !== 'minion').sort((a, b) => total(b) - total(a));
    const rank = ranked.indexOf(player) + 1;
    $('rank').textContent = rank > 0 ? rank : '–';
    if (running && rank > 0) {
      stats.bestRank = Math.min(stats.bestRank, rank); if (rank <= 3) stats.top3T = (stats.top3T || 0) + .25;
      if (rank === 1 && !stats.leader) { stats.leader = 1; toast('Ты лидер арены!'); }
    }
    const leadersHtml = ranked.slice(0, boardOpen ? 6 : 3).map((o, i) => {
      const me = o === player;   // 2.7: online the other player is «isPlayer» too — it showed your nickname and frame
      const tag = me ? '' : o.team ? (o.team === player.team ? 'союзник' : 'соперник') : mode === 'crown' && o.crownT > 0 ? `♛ ${fmtTime(o.crownT)}` : o.persona ? PERSONA[o.persona].tag : '';
      const fr = me ? save.frame : o.frame, lvl = me ? playerLevel() : o.lvl;
      return `<li class="${me ? 'me' : o.kind === 'boss' ? 'boss' : o.star ? 'star' : ''}"><span>${i + 1}. ${o.kind === 'boss' ? '<b class="boss-tag">☠</b>' : ''}${o.star ? '<b class="star-tag">★</b>' : ''}${lvl ? `<b class="lv-tag">${lvl}</b>` : ''}<span ${frameAttr(fr)}>${me ? meName() : o.name}</span>${o.isPlayer ? ' ' + titleTag(save.title) + (starsOf(skin()) ? ` <b class="star-tag" title="Звёзды скина">${'★'.repeat(starsOf(skin()))}</b>` : '') : ''}${tag ? ` <em>${tag}</em>` : ''}</span><span>${Math.round(total(o))}</span></li>`;
    }).join('') + (rank > (boardOpen ? 6 : 3) ? `<li class="me"><span>${rank}. <span ${frameAttr(save.frame)}>${meName()}</span> ${titleTag(save.title)}</span><span>${Math.round(total(player))}</span></li>` : '') +
      (ranked.length > 3 ? `<li class="bd-more"><button type="button" id="boardMore" aria-expanded="${boardOpen}">${boardOpen ? '▴ свернуть' : `▾ ещё ${Math.min(ranked.length, 6) - 3}`}</button></li>` : '');
    if (leadersHtml !== leadersLast) { leadersLast = leadersHtml; $('leaders').innerHTML = leadersHtml; }   // 2.7: rebuild the board only when it changed (fewer layouts)
    // ---- in-battle HUD: one short mode line, a separate mode timer with a clock, and round icon badges with a countdown ring ----
    let modeChip = '', timer = '';
    const T = (left, total) => ({ left: Math.max(0, left), total });
    if (running) {
      const lim = { timed: TIMED_LEN, team: TEAM_LEN, raid: RAID_LEN }[mode];
      if (lim) timer = `⏱ ${fmtTime(Math.max(0, lim - stats.time))}`;
      else if (['survival', 'classic', 'rbuild', 'hardcore', 'royale', 'crown'].includes(mode)) timer = `⏱ ${fmtTime(stats.time)}`;
      if (mode === 'royale') modeChip = `${ModeX.zoneChip()} · в живых ${bots.filter(b => b.cells.length).length + (player.cells.length ? 1 : 0)}/13`;
      if (mode === 'crown') modeChip = ModeX.crownChip();
      if (mode === 'team') modeChip = `Синие ${Math.round(teamTotal('A'))} : ${Math.round(teamTotal('B'))} Красные`;
      if (mode === 'raid') { const hp = RaidX.tier().hp, left = Math.max(0, hp - (stats.raidDmg || 0)); modeChip = `Ступень ${['I', 'II', 'III', 'IV', 'V'][RaidX.tierI()]} · близнецы ${Math.ceil(left / hp * 100)}% · фаза ${RaidX.phase()}`; }
      if (mode === 'survival') modeChip = `Волна ${stats.wave}`;
      if (mode === 'territory') { modeChip = DuoM.chip(); if (DuoM.on) timer = DuoM.rules.territory.timer(); }
      if (mode === 'duoback') { modeChip = DuoM.chip(); timer = `⏱ ${fmtTime(stats.time)}`; }
      { const mx = ModeX.chip(); if (mx) modeChip = modeChip ? `${modeChip} · ${mx}` : mx; }
    }
    const badges = [];
    const badge = (icon, color, left, total, title) => badges.push(`<div class="eb${left !== null && total && left <= 3 ? ' low' : ''}" title="${title}" aria-label="${title}" style="--c:${color};--f:${total ? Math.max(0, Math.min(1, left / total)).toFixed(3) : 1}"><span class="eb-in"><b>${String(icon).startsWith('<') ? icon : icon + '\uFE0E'}</b><small>${left === null ? '' : Math.ceil(left)}</small></span></div>`);
    if (running) {
      { const ch = charById(charNow()); if (ch) stats.charUsed = ch.id; if (ch) badge(ch.icon, ch.color, null, 0, `Характер «${ch.name}»: ${ch.plus}; ${ch.minus}`); }   // 2.7
      const SV = d => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
      const BICON = { speed: SV('M13.5 2 4 13.5h6.5L9 22l11-12.5h-6.8z'), shield: SV('M12 2 4 5.2v6.1c0 5 3.4 9 8 10.7 4.6-1.7 8-5.7 8-10.7V5.2z'), double: '×2',
        magnet: SV('M5 3h4v8.5a3 3 0 0 0 6 0V3h4v8.5a7 7 0 0 1-14 0zM5 3v3h4V3zm10 0v3h4V3z') };
      for (const k of Object.keys(effects || {})) if (effects[k] > 0) badge(BICON[k] || '•', BONUS[k].color, effects[k], k === 'shield' && stats.time < 6 ? 5 : effectDur(k), `${BONUS[k].name} ${Math.ceil(effects[k])} с`);
      for (const id of ['shrink', 'cloak', 'x_ice', 'x_refl', 'x_ghost', 'x_vamp', 'x_typhoon']) if (abOn(id)) { const a = abilById(id); badge(a.icon, a.color, player.abT[id], a.dur * (id.startsWith('x_') ? 1 : abPow(id)), `${a.name} ${Math.ceil(player.abT[id])} с`); }
      if (decoy) badge(abilById('decoy').icon, abilById('decoy').color, decoy.ttl, abilById('decoy').dur * abPow('decoy'), `Клон ${Math.ceil(decoy.ttl)} с`);
      const traps = viruses.filter(v => v.trap && v.trap.owner === player); if (traps.length) badge(abilById('trap').icon, abilById('trap').color, Math.max(...traps.map(v => v.trap.ttl)), abilById('trap').dur, `Ловушки: ${traps.length}`);
      if (player.cells.length > 1) { const full = playerMergeTime(), left = Math.max(...player.cells.map(c => c.mergeT)); if (left > 0) badge('⧉', skin().color, left, full, `Слияние через ${Math.ceil(left)} с`); }
      if (bossesOn() && player.cells.length) {
        const left = Math.max(0, bossTimer);
        if (mode === 'survival') badge('☠', 'var(--boss)', left, 15, `Волна ${stats.wave + 1} через ${Math.ceil(left)} с`);
        else if (bossOwners.filter(o => o.cells.length).length < maxBosses()) badge('☠', 'var(--boss)', left, dailyIs('bosses') ? 20 : 40, `Босс через ${Math.ceil(left)} с`);
      }
      if (ev.active) badge('✦', evInfo(ev.active).color, ev.left, 20, `${evInfo(ev.active).name} ${Math.ceil(ev.left)} с`);
      else if (ev.warn) badge('!', evInfo(ev.warn).color, null, 0, `Скоро: ${evInfo(ev.warn).name}`);
    }
    $('modeTimer').hidden = !timer; if (timer) $('modeTimer').textContent = timer;
    $('effects').innerHTML = (running && stats.ranked ? `<div class="chip"><i style="background:${stats.chaos ? '#ff4fd8' : 'var(--gold)'}"></i>${stats.chaos ? 'Хаос-лига' : 'Рейтинг'} · монеты ×1,5</div>` : '') +
      (modeChip ? `<div class="chip"><i style="background:var(--gold)"></i>${modeChip}</div>` : '') +
      (badges.length ? `<div class="eb-row">${badges.join('')}</div>` : '');
    if (running) {
      for (const id of save.quests) {
        const q = QUESTS.find(x => x.id === id);
        if (!doneQuests.has(id) && (stats[q.stat] || 0) >= q.goal) { doneQuests.add(id); toast(`Задание выполнено: ${q.text}`); }
      }
      stats.achGot.push(...checkAch());
    }
    drawMinimap();
  }

  function mergeChip() {
    if (player.cells.length < 2) return '';
    const full = playerMergeTime();
    const left = Math.max(...player.cells.map(c => c.mergeT));
    const pct = left > 0 ? (1 - left / full) * 100 : 100;
    return `<div class="chip" title="Слияние частей" aria-label="Слияние частей ${pct.toFixed(0)}%"><i style="background:${skin().color}"></i>` +
      `<span class="bar wide"><span style="width:${pct.toFixed(0)}%"></span></span></div>`;
  }
  const mini = $('minimap'), mctx = mini.getContext('2d');
  function drawMinimap() {
    const size = mini.clientWidth || 140, dpr = Math.min(devicePixelRatio, 2);
    if (mini.width !== size * dpr) { mini.width = mini.height = size * dpr; }
    const s = size / (2 * R + 4);
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mctx.clearRect(0, 0, size, size);
    mctx.fillStyle = 'rgba(12, 8, 34, .92)';
    mctx.beginPath(); mctx.arc(size / 2, size / 2, R * s, 0, Math.PI * 2); mctx.fill();
    mctx.strokeStyle = tok('--line'); mctx.lineWidth = 1; mctx.stroke();
    const P = (x, z) => [size / 2 + x * s, size / 2 + z * s];
    if (mode === 'territory' && DuoM.on) DuoM.rules.territory.mini(mctx, size, s);
    if (mode === 'crown' && running) ModeX.crownMini(mctx, P);
    if (mode === 'royale' && running) ModeX.zoneMini(mctx, P, s);
    mctx.fillStyle = VIRUS_COLOR; for (const v of viruses) { const [x, y] = P(v.x, v.z); mctx.beginPath(); mctx.arc(x, y, 2.2, 0, Math.PI * 2); mctx.fill(); }
    if (ev.active === 'starfall' || ev.warn === 'starfall') { const [x, y] = P(ev.x, ev.z); mctx.strokeStyle = '#ffd23f'; mctx.lineWidth = 1.5; mctx.beginPath(); mctx.arc(x, y, 40 * s, 0, Math.PI * 2); mctx.stroke(); }
    if (ev.active === 'rift') { const [x, y] = P(ev.x, ev.z); mctx.strokeStyle = '#b26bff'; mctx.lineWidth = 1.5; mctx.beginPath(); mctx.arc(x, y, RIFT_R * s, 0, Math.PI * 2); mctx.stroke(); mctx.fillStyle = '#000'; mctx.beginPath(); mctx.arc(x, y, 3, 0, Math.PI * 2); mctx.fill(); }
    if (ev.active === 'quake') { mctx.strokeStyle = '#ff6a00'; mctx.lineWidth = 1.5; mctx.beginPath(); mctx.arc(size / 2, size / 2, R * QUAKE_K * s, 0, Math.PI * 2); mctx.stroke(); }
    if (ev.active === 'golden' && ev.gold) { const [x, y] = P(ev.gold.x, ev.gold.z); mctx.fillStyle = '#ffd23f'; mctx.beginPath(); mctx.arc(x, y, 4, 0, Math.PI * 2); mctx.fill(); }
    if (ev.active === 'bounty' && ev.target && ev.target.cells.length && ev.target !== player) { const t = mainOf(ev.target), [x, y] = P(t.x, t.z); mctx.strokeStyle = '#ff2d55'; mctx.lineWidth = 2; mctx.beginPath(); mctx.arc(x, y, Math.max(5, cellR(t) * s + 3), 0, Math.PI * 2); mctx.stroke(); }
    for (const b of bonuses) { const [x, y] = P(b.x, b.z); mctx.fillStyle = BONUS[b.type].color; mctx.fillRect(x - 2, y - 2, 4, 4); }
    for (const c of cells) {
      if (c.owner.isPlayer || (c.owner.bossType === 'chameleon' && !c.seen)) continue;
      const [x, y] = P(c.x, c.z);
      const danger = player.cells.some(p => canEat(c, p)), food = player.cells.some(p => canEat(p, c));
      mctx.fillStyle = c.owner.kind === 'boss' ? bossInfo(c.owner).color : c.owner.kind === 'minion' ? MINION_COLOR : c.owner.team && c.owner.team === player.team ? ALLY_COLOR : danger ? tok('--threat') : food ? tok('--prey') : '#8088c0';
      mctx.beginPath(); mctx.arc(x, y, Math.max(2, cellR(c) * s), 0, Math.PI * 2); mctx.fill();
      if (c.owner.kind === 'boss') { const rr = Math.max(5, cellR(c) * s); mctx.strokeStyle = '#ffffff'; mctx.lineWidth = 1.2; mctx.stroke();
        mctx.fillStyle = '#ffffff'; mctx.font = `${Math.round(rr * 1.3)}px sans-serif`; mctx.textAlign = 'center'; mctx.textBaseline = 'middle'; mctx.fillText('☠', x, y + .5); }
    }
    for (const c of player.cells) {
      const [x, y] = P(c.x, c.z);
      mctx.fillStyle = skin().color; mctx.strokeStyle = '#ffffff'; mctx.lineWidth = 1.5;
      mctx.beginPath(); mctx.arc(x, y, Math.max(2.5, visualCellR(c) * s), 0, Math.PI * 2); mctx.fill(); mctx.stroke();
    }
  }

  function drawGraph() {
    const cv = $('graph'), w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(devicePixelRatio, 2);
    if (!w) return;
    cv.width = w * dpr; cv.height = h * dpr;
    const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0);
    const data = history.length > 1 ? history : [history[0] || 0, history[0] || 0];
    const max = Math.max(...data, 10), padT = 18, padB = 18;
    const X = i => i / (data.length - 1) * (w - 8) + 4, Y = v => padT + (1 - v / max) * (h - padT - padB);
    x.strokeStyle = tok('--line'); x.lineWidth = 1;
    [0, .5, 1].forEach(f => { const y = padT + f * (h - padT - padB); x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); });
    const accent = skin().color;
    x.beginPath(); x.moveTo(X(0), Y(0));
    data.forEach((v, i) => x.lineTo(X(i), Y(v)));
    x.lineTo(X(data.length - 1), Y(0)); x.closePath();
    x.globalAlpha = .22; x.fillStyle = accent; x.fill(); x.globalAlpha = 1;
    x.beginPath(); data.forEach((v, i) => i ? x.lineTo(X(i), Y(v)) : x.moveTo(X(i), Y(v)));
    x.strokeStyle = accent; x.lineWidth = 2; x.lineJoin = 'round'; x.stroke();
    const pi = data.indexOf(max);
    x.fillStyle = accent; x.beginPath(); x.arc(X(pi), Y(max), 4, 0, Math.PI * 2); x.fill();
    x.fillStyle = tok('--muted'); x.font = `600 11px ${tok('--body')}`;
    x.textAlign = pi > data.length / 2 ? 'right' : 'left';
    x.fillText(`пик ${max}`, X(pi) + (pi > data.length / 2 ? -8 : 8), Y(max) + 4);
    x.textAlign = 'left'; x.fillText('0:00', 2, h - 4);
    x.textAlign = 'right'; x.fillText(fmtTime(stats.time), w - 2, h - 4);
  }

