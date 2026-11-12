  // ================= abilities: runtime =================
  let runBuild = [...ABIL_CFG.oldBuild], decoy = null;
  const abLv = id => stats && stats.ranked ? 0 : save.abil.lv[id] || 0;
  const abCdOf = id => abilById(id).cd * (1 - ABIL_CFG.cdPerLv * abLv(id));
  const abPow = id => 1 + ABIL_CFG.powPerLv * abLv(id);
  const abOn = (id, o = player) => !!(o && o.abT && o.abT[id] > 0);
  const abUsed = id => { if (stats && stats.abUsed) { stats.abUsed[id] = 1; stats.abilUses = (stats.abilUses || 0) + 1; } };
  // a slot is unusable in modes that forbid that action
  const slotBlocked = id => (id === 'dash' && splitRules()) || (id === 'split' && dailyIs('dashonly'));
  // the player's look for an ability: only where abilities work (normal modes and the Chaos League), never in the main league
  function lookFor(id) {
    if (stats && stats.ranked && !stats.chaos) return null;
    const lid = save.abil.lookOn[id]; return lid && save.abil.looks.includes(lid) ? lookById(lid) : null;
  }
  function abFlash(id, x, z, color, snd) {
    const lk = lookFor(id);
    if (!lk) { if (color) emit(x, 2, z, color, 24, 6, .5); Sound.play(snd); return; }
    if (lk.burst === 'ring') emit(x, 2, z, lk.c, 40, 11, .6);
    else if (lk.burst === 'spark') { emit(x, 2, z, lk.c, 55, 6, .45); emit(x, 3, z, '#ffffff', 12, 4, .3); }
    else { emit(x, 2, z, lk.c, 30, 4, .5); emit(x, 2, z, lk.c, 30, 13, .8); }
    Sound.play(lk.sfx);
  }
  function abReset() {
    owners.forEach(o => { o.freezeT = 0; o.slowT = 0; o.abCd = o.isPlayer || o.kind === 'bot' ? {} : null; o.abT = {}; o.rs = 1; o.phase2 = 0; });
    xfx.forEach(f => { if (f.mesh) scene.remove(f.mesh); }); xfx = [];
    botDecoys.forEach(d => scene.remove(d.mesh)); botDecoys = [];
    if (decoy) { scene.remove(decoy.mesh); decoy = null; }
  }
  function renderSlots() {
    runBuild.forEach((id, i) => {
      const b = $(ABIL_CFG.slotBtn[i]), a = id && abilById(id), hide = id && slotBlocked(id);
      b.hidden = !!hide;
      b.classList.toggle('empty', !a);
      b.style.setProperty('--ring', a ? a.color : 'var(--line)');
      b.setAttribute('aria-label', a ? a.name : 'Пустой слот');
      b.querySelector('.in').innerHTML = a ? `<i class="ab-ico" style="color:${a.color}">${a.icon}</i><b>${a.sh}</b><small id="slotSub${i}"></small>` : '<b>Пусто</b><small>—</small>';
    });
  }
  function useSlot(i) {
    const id = runBuild[i];
    if (!id || !running || paused || dying || slotBlocked(id)) return;
    if (id === 'dash') dash(); else if (id === 'split') split(); else if (id === 'eject') eject(); else castAbility(id);
  }
  function pCenterXZ() { const m = total(player) || 1; return player.cells.reduce((a, c) => [a[0] + c.x * c.mass / m, a[1] + c.z * c.mass / m], [0, 0]); }
  // ===== abilities engine: the same code for the player and for bots (o = caster) =====
  const mainOf = o => o.cells.reduce((x, y) => x.mass >= y.mass ? x : y);
  const centerOf = o => { const m = total(o) || 1; return o.cells.reduce((a, c) => [a[0] + c.x * c.mass / m, a[1] + c.z * c.mass / m], [0, 0]); };
  const foesOf = o => owners.filter(x => x !== o && x.cells.length && !(o.team && x.team === o.team));
  const nearOf = (o, x, rad) => x.cells.some(c => o.cells.some(pc => Math.hypot(pc.x - c.x, pc.z - c.z) < rad + cellR(pc) + cellR(c)));
  let botDecoys = [];
  // a clone grabbed by a bigger foe crumbles into food and slows the one who grabbed it (the blink shadow just vanishes)
  function decoyCaught(d) {
    for (const x of foesOf(d.src)) for (const c of x.cells) if (cellR(c) > d.r * .9 && Math.hypot(c.x - d.x, c.z - d.z) < cellR(c)) {
      scene.remove(d.mesh); d.gone = true; emit(d.x, d.r, d.z, '#ffffff', 26, 9, .5);
      if (!d.still) { burstFood(d.x, d.z, d.r + 4, 18); if (x.kind !== 'boss') x.slowT = Math.max(x.slowT || 0, 2); }
      owners.forEach(o => { if (o.target === d) o.target = null; }); return true; }
    return false;
  }
  function makeDecoy(o, a, ttl) {
    const main = mainOf(o), r = cellR(main), col = o === player ? skin().color : (o.cells[0].vis.mesh.material.color ? '#' + o.cells[0].vis.mesh.material.color.getHexString() : a.color);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .5, transparent: true, opacity: .55 }));
    mesh.scale.setScalar(r); mesh.add(glowSprite(col, 3, .5)); scene.add(mesh); mesh.position.set(main.x, r, main.z);
    return { src: o, x: main.x, z: main.z, hx: main.hx, hz: main.hz, r, ttl, gone: false, mesh, owner: { decoy: true } };
  }
  function castAbility(id, o = player) {
    if (!o.cells.length || !o.abCd || (o.abCd[id] || 0) > 0) return false;
    const me = o === player, a = abilById(id), pw = me ? abPow(id) : 1, [px, pz] = centerOf(o);
    if (id === 'shield') { if (me) effects.shield = Math.max(effects.shield, a.dur * pw); else o.abT.shield = a.dur; o.abT.shieldB = a.dur * pw; o.shHit = new Set(); }
    else if (id === 'pulse') { o.abT.pulse = a.dur * pw; }
    else if (id === 'blink') { const sh = makeDecoy(o, a, 1); sh.still = true; sh.mesh.material.opacity = .35;
      if (me) { if (decoy) scene.remove(decoy.mesh); decoy = sh; } else botDecoys.push(sh);
      owners.forEach(x => { if (x.target && x.target.owner === o) x.target = sh; }); blinkBy(o, a.dist * pw, a.color); }
    else if (id === 'slow') {
      const rad = a.radius * pw;
      for (const x of foesOf(o)) {
        if (!nearOf(o, x, rad)) continue;
        // The wave suppresses movement and dash acceleration; it does not push targets physically.
        x.slowT = Math.max(x.slowT || 0, a.dur * pw);
      }
      // Clearly visible expanding ground rings; particle bursts alone were too subtle.
      [1, .78, .56].forEach((k, i) => {
        const life = 1.05 + i * .12;
        const mesh = new THREE.Mesh(
          new THREE.RingGeometry(.94, 1, 72),
          new THREE.MeshBasicMaterial({ color: a.color, transparent: true, opacity: .95, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })
        );
        mesh.rotation.x = -Math.PI / 2;
        mesh.position.set(px, .16 + i * .025, pz);
        mesh.scale.setScalar(rad * k * .08);
        scene.add(mesh);
        xfx.push({ id: 'slowwave', x: px, z: pz, t: life, life, rad: rad * k, mesh, o });
      });
      emit(px, 2, pz, a.color, 70, rad * .45, .65);
    }
    else if (id === 'push') {
      const rad = a.radius * pw;
      for (const x of foesOf(o)) for (const c of x.cells) {
        const dx = c.x - px, dz = c.z - pz, d = Math.hypot(dx, dz) || 1, edge = d - cellR(c);
        if (edge < rad + Math.sqrt(total(o)) * .4) { const massBoost = Math.min(1.6, Math.pow(Math.max(1, c.mass / 25), .12)); const f = a.force * pw * massBoost * Math.max(.35, 1 - edge / (rad * 1.5)); c.vx += dx / d * f; c.vz += dz / d * f; if (x.kind !== 'boss') x.freezeT = Math.max(x.freezeT || 0, a.stun); }
      }
      emit(px, 2, pz, a.color, 70, rad, .7);
    } else if (id === 'shrink' || id === 'cloak') { o.abT[id] = a.dur * pw; if (id === 'cloak') { o.cloakBonus = true; owners.forEach(x => { if (x.target && x.target.owner === o) x.target = null; }); } }
    else if (id === 'decoy') {
      if (me) { if (decoy) scene.remove(decoy.mesh); decoy = makeDecoy(o, a, a.dur * pw); }
      else { botDecoys.filter(d => d.src === o).forEach(d => { scene.remove(d.mesh); d.gone = true; }); botDecoys = botDecoys.filter(d => !d.gone); botDecoys.push(makeDecoy(o, a, a.dur)); }
    } else if (a.xa) { if (!castXa(id, a, px, pz, o)) return false; if (id === 'x_phase') { if (me) abUsed(id); return true; } }
    else if (id === 'trap') {
      const mine = viruses.filter(v => v.trap && v.trap.owner === o);
      if (mine.length >= ABIL_CFG.maxTraps) removeVirus(mine[0]);
      const v = { x: px, z: pz, vx: 0, vz: 0, mass: VIRUS_MASS, feed: 0, mesh: makeVirusMesh(), trap: { ttl: a.dur, owner: o } };
      v.mesh.add(glowSprite(a.color, 4, .7)); viruses.push(v);
    } else return false;
    o.abCd[id] = me ? abCdOf(id) : a.cd;
    if (me) { abUsed(id); abFlash(id, px, pz, a.color, 'bonus'); buzz(15); }
    else if (nearView(px, pz)) emit(px, 2, pz, a.color, 20, 6, .5);
    return true;
  }
  // ---- Chaos League exclusives ----
  let xfx = [];   // timed world effects: hole, meteor, anchor, twin (each remembers its caster)
  function blinkBy(o, d, color) {
    const main = mainOf(o);
    for (const c of o.cells) { emit(c.x, cellR(c), c.z, color, 18, 10, .5); c.x += main.hx * d; c.z += main.hz * d; clampArena(c); emit(c.x, cellR(c), c.z, color, 18, 10, .5); }
  }
  function castXa(id, a, px, pz, o) {
    const me = o === player, main = mainOf(o);
    const ahead = d => { let x = px + main.hx * d, z = pz + main.hz * d; const dc = Math.hypot(x, z), rr = R - 4; if (dc > rr) { x *= rr / dc; z *= rr / dc; } return [x, z]; };
    if (['x_refl', 'x_ghost', 'x_vamp', 'x_typhoon'].includes(id)) { o.abT[id] = a.dur; if (id === 'x_refl') o.spHit = new Set(); return true; }
    if (id === 'x_over') { for (const k in o.abCd) if (k !== 'x_over') o.abCd[k] = 0; if (me) { player.dashCd = 0; player.splitCd = 0; effects.speed = Math.max(effects.speed, a.dur); } else o.dashT = Math.max(o.dashT || 0, .6); return true; }
    if (id === 'x_ice') { o.abT.x_ice = a.dur; o.iceDrop = 0; return true; }
    if (id === 'x_meteor') {   // three meteors in a fan ahead
      const ang = Math.atan2(main.hz, main.hx);
      [[-.35, .8, 1], [0, 1.15, 1.3], [.35, .8, 1.6]].forEach(([da, dk, t]) => { let x = px + Math.cos(ang + da) * a.dist * dk, z = pz + Math.sin(ang + da) * a.dist * dk; const dc = Math.hypot(x, z), rr = R - 4; if (dc > rr) { x *= rr / dc; z *= rr / dc; }
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(1.1, 12, 10), new THREE.MeshBasicMaterial({ color: a.color })); mesh.add(glowSprite(a.color, 4, .8)); mesh.position.set(x, 1 + t * 12, z); scene.add(mesh);
        xfx.push({ id, x, z, t, a, mesh, o }); });
      return true;
    }
    if (id === 'x_hole' || id === 'x_anchor') {
      const [x, z] = id === 'x_anchor' ? [px, pz] : ahead(a.dist);
      const mesh = id === 'x_anchor' ? new THREE.Mesh(new THREE.TorusGeometry(a.radius, .25, 8, 48), new THREE.MeshBasicMaterial({ color: a.color, transparent: true, opacity: .7 }))
        : new THREE.Mesh(new THREE.SphereGeometry(id === 'x_hole' ? 1.6 : 1.1, 16, 12), new THREE.MeshBasicMaterial({ color: id === 'x_hole' ? '#05010f' : a.color }));
      if (id === 'x_anchor') mesh.rotation.x = Math.PI / 2;
      mesh.position.set(x, id === 'x_anchor' ? .4 : 1.6, z); mesh.add(glowSprite(a.color, id === 'x_hole' ? 6 : 3, .7)); scene.add(mesh);
      xfx.push({ id, x, z, t: id === 'x_meteor' ? 1 : a.dur, a, mesh, o }); return true;
    }
    if (id === 'x_twin') {
      const maxP = me ? playerMaxParts() : BOT_PARTS;
      if (o.cells.length >= maxP || main.mass < 20) { if (me) toast('Двойник: нужна масса 20 и место для ещё одной части'); return false; }
      if (!splitOwner(o, o.cells.length + 1, a.dur)) return false;
      const nb = o.cells[o.cells.length - 1]; rebuildCells();
      xfx.push({ id, t: a.dur, ca: main, cb: nb, a, o }); return true;
    }
    if (id === 'x_hunt') {
      let best = null, bd = a.radius;
      for (const x of foesOf(o)) for (const c of x.cells) { const d = Math.hypot(c.x - main.x, c.z - main.z); if (d < bd && canEat(main, c)) { bd = d; best = c; } }
      if (!best) { if (me) toast('Охотничий рывок: рядом нет добычи меньше тебя'); return false; }
      for (const c of o.cells) { const dx = best.x - c.x, dz = best.z - c.z, d = Math.hypot(dx, dz) || 1; c.vx += dx / d * a.force; c.vz += dz / d * a.force; c.hx = dx / d; c.hz = dz / d; }
      o.dashT = Math.max(o.dashT || 0, .3); o.huntT = 1.5; return true;
    }
    if (id === 'x_phase') {
      blinkBy(o, a.dist, a.color);
      if (o.phase2 > 0) { o.phase2 = 0; o.abCd[id] = me ? abCdOf(id) : a.cd; }   // second jump: now the cooldown starts
      else o.phase2 = CHAOS_CFG.phase2Sec;
      if (me) Sound.play('dash'); return true;
    }
    return false;
  }
  function xaTick(dt) {
    let foodMoved = false;
    const pullFood = (x, z, rad, sp) => { for (let i = 0; i < FOOD; i++) { const fd = foods[i], dx = x - fd.x, dz = z - fd.z, d = Math.hypot(dx, dz);
      if (d < rad && d > .3) { const st = Math.min(d, sp * dt); fd.x += dx / d * st; fd.z += dz / d * st; fgSet(i); dummy.position.set(fd.x, .35, fd.z); dummy.updateMatrix(); foodMesh.setMatrixAt(i, dummy.matrix); foodMoved = true; } } };
    for (const o of owners) {
      if (o.freezeT) o.freezeT = Math.max(0, o.freezeT - dt);
      if (!o.abT || !o.cells.length) continue;
      if (o.huntT > 0) o.huntT -= dt;
      // «Фантом»: a shock wave when it ends
      if (o.ghostOn && !abOn('x_ghost', o)) { const a = abilById('x_ghost'), [gx, gz] = centerOf(o);
        for (const x of foesOf(o)) for (const c of x.cells) { const dx = c.x - gx, dz = c.z - gz, d = Math.hypot(dx, dz) || 1; if (d < a.radius + cellR(c)) { c.vx += dx / d * a.force; c.vz += dz / d * a.force; } }
        if (nearView(gx, gz)) { emit(gx, 2, gz, a.color, 60, a.radius, .7); if (o === player) Sound.play('spike'); } }
      o.ghostOn = abOn('x_ghost', o);
      // «Ледяной след»: drops ice patches behind
      if (abOn('x_ice', o) && (o.iceDrop = (o.iceDrop || 0) - dt) <= 0) { o.iceDrop = .15; const m = mainOf(o), a = abilById('x_ice');
        const mesh = new THREE.Mesh(new THREE.CircleGeometry(a.radius + cellR(m) * .6, 18), decal(new THREE.MeshBasicMaterial({ color: '#cff6ff', transparent: true, opacity: .45, depthWrite: false })));
        mesh.rotation.x = -Math.PI / 2; mesh.position.set(m.x, .06, m.z); scene.add(mesh); xfx.push({ id: 'icepatch', x: m.x, z: m.z, r: a.radius + cellR(m) * .6, t: 4, a, mesh, o }); }
      if (o.phase2 > 0) { o.phase2 -= dt; if (o.phase2 <= 0) { o.phase2 = 0; o.abCd.x_phase = o === player ? abCdOf('x_phase') : abilById('x_phase').cd; } }
      const refl = abOn('x_refl', o), typh = abOn('x_typhoon', o), pul = abOn('pulse', o), shb = abOn('shieldB', o), vamp = abOn('x_vamp', o);
      if (!refl && !typh && !pul && !shb && !vamp) continue;
      const [px, pz] = centerOf(o), main = mainOf(o), foes = foesOf(o);
      if (pul) { if (o !== player) pullFood(main.x, main.z, 8 + cellR(main), 18);
        const rad = 14 + cellR(main); for (const e of ejects) { const dx = main.x - e.x, dz = main.z - e.z, d = Math.hypot(dx, dz) || 1; if (d < rad) { e.vx += (dx / d * 70 - dz / d * 25) * dt; e.vz += (dz / d * 70 + dx / d * 25) * dt; } } }
      // «Щит» and «Шипастая броня»: a bigger foe that touches you bounces off and loses mass (once per foe)
      if (refl || shb) for (const x of foes) for (const c of x.cells) for (const pc of o.cells) {
        const dx = c.x - pc.x, dz = c.z - pc.z, d = Math.hypot(dx, dz) || 1;
        if (d < cellR(c) + cellR(pc) + .5 && c.mass > pc.mass && x.kind !== 'minion') { const set = refl ? o.spHit : o.shHit, f = refl ? abilById('x_refl').force : 40;
          if (set && !set.has(x)) { set.add(x); c.mass *= refl ? .85 : .95; if (nearView(c.x, c.z)) { emit(pc.x, cellR(pc), pc.z, refl ? '#c0c8e0' : '#9fe8ff', 26, 8, .5); if (o === player || x === player) Sound.play('spike'); } }
          c.vx = dx / d * f; c.vz = dz / d * f; c.x = pc.x + dx / d * (cellR(c) + cellR(pc) + .6); c.z = pc.z + dz / d * (cellR(c) + cellR(pc) + .6); clampArena(c); }
      }
      // «Кровопийца»: smaller neighbours slowly lose mass to you
      if (vamp) { const rad = abilById('x_vamp').radius + cellR(main);
        for (const x of foes) if (x.kind !== 'boss') for (const c of x.cells) { if (c.mass >= main.mass || c.mass < 12) continue; const d = Math.hypot(c.x - main.x, c.z - main.z);
          if (d < rad + cellR(c)) { const k = c.mass * .07 * dt; c.mass -= k; main.mass += k; if (Math.random() < .25 && nearView(c.x, c.z)) emit(c.x, cellR(c), c.z, '#c2185b', 1, 2, .5); } } }
      if (typh) {
        const a = abilById('x_typhoon'), rad = a.radius + cellR(main);
        for (const e of ejects) { const dx = e.x - px, dz = e.z - pz, d = Math.hypot(dx, dz) || 1; if (d < rad) { e.vx += dx / d * 120 * dt; e.vz += dz / d * 120 * dt; } }
        for (const x of foes) for (const c of x.cells) { const dx = c.x - px, dz = c.z - pz, d = Math.hypot(dx, dz) || 1;
          if (d < rad + cellR(c) && c.mass < main.mass * .6) { c.vx += dx / d * 90 * dt; c.vz += dz / d * 90 * dt; c.hx = dx / d; c.hz = dz / d; if (x.kind === 'bot') { x.target = null; x.tx = c.x + dx / d * 30; x.tz = c.z + dz / d * 30; x.think = .6; } } }
        if (Math.random() < .5 && nearView(px, pz)) { const ang = Math.random() * Math.PI * 2; emit(px + Math.cos(ang) * rad, 1, pz + Math.sin(ang) * rad, a.color, 2, 3, .4); }
      }
    }
    for (const f of [...xfx]) {
      f.t -= dt;
      const foes = foesOf(f.o), main = f.o.cells.length ? mainOf(f.o) : null;
      if (f.id === 'slowwave') {
        const progress = Math.min(1, Math.max(0, 1 - f.t / f.life));
        f.mesh.scale.setScalar(f.rad * (.08 + .92 * progress));
        f.mesh.material.opacity = .95 * (1 - progress);
      } else if (f.id === 'x_hole') {
        pullFood(f.x, f.z, f.a.radius, 26);
        for (const e of ejects) { const dx = f.x - e.x, dz = f.z - e.z, d = Math.hypot(dx, dz) || 1; if (d < f.a.radius) { e.vx += dx / d * 80 * dt; e.vz += dz / d * 80 * dt; } }
        f.mesh.rotation.y += dt * 4;
      } else if (f.id === 'x_anchor') { for (const x of foes) for (const c of x.cells) { const dx = f.x - c.x, dz = f.z - c.z, d = Math.hypot(dx, dz) || 1; if (d < f.a.radius + cellR(c) && d > 1) { const k = 38 * dt * (x.kind === 'boss' ? .3 : 1); c.vx += dx / d * k * 6; c.vz += dz / d * k * 6; } } f.mesh.rotation.z += dt * 3; }
      else if (f.id === 'icepatch') { for (const x of foes) if (x.cells.some(c => Math.hypot(c.x - f.x, c.z - f.z) < f.r + cellR(c) * .5)) x.iceT = .35; f.mesh.material.opacity = .45 * Math.min(1, f.t); }
      else if (f.id === 'x_twin' && f.o !== player) { if (!f.ca.gone && !f.cb.gone) { f.cb.hx = -f.ca.hx; f.cb.hz = f.ca.hz; } }
      else if (f.id === 'x_meteor') { f.mesh.position.y = .5 + f.t * 12; }
      if (f.t > 0) continue;
      if (f.id === 'x_meteor') {
        let popped = false;
        for (const x of foes) for (const c of [...x.cells]) { const dx = c.x - f.x, dz = c.z - f.z, d = Math.hypot(dx, dz) || 1; if (d >= f.a.radius + cellR(c)) continue;
          if (c.mass >= 120 && x.kind !== 'minion') { popCell(c, { x: f.x, z: f.z, mass: 0 }); popped = true; } else { c.vx += dx / d * f.a.force; c.vz += dz / d * f.a.force; } }
        if (popped) rebuildCells();
        emit(f.x, 1, f.z, f.a.color, 80, f.a.radius, .9); if (nearView(f.x, f.z)) Sound.play('spike');
      }
      if (f.id === 'x_twin') { if (!f.ca.gone && !f.cb.gone && f.ca.owner === f.o && f.cb.owner === f.o) { f.ca.mass += f.cb.mass; emit(f.cb.x, cellR(f.cb), f.cb.z, f.a.color, 20, 8, .5); removeCell(f.cb); f.ca.mergeT = 0; rebuildCells(); } }
      if (f.mesh) scene.remove(f.mesh);
      xfx.splice(xfx.indexOf(f), 1);
    }
    if (foodMoved) foodMesh.instanceMatrix.needsUpdate = true;
  }
  // ===== bots: builds and when to use them, by character =====
  // normal modes: 3 random classic abilities; main league: dash, split, eject (like the player); Chaos League: 3 random of all (like the player)
  function botBuild(chaos, mainRanked) {
    if (chaos) return chaosDraw();
    if (mainRanked) return [...ABIL_CFG.rankedBuild];
    const pool = BASE_ABIL.map(a => a.id), out = [];
    while (out.length < 3) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return out;
  }
  function botEject(o) {
    const c = mainOf(o); if (c.mass < EJECT_MIN || ejects.length >= MAX_EJECTS) return;
    c.mass -= EJECT_COST; const r = cellR(c) + 1.2, mesh = new THREE.Mesh(ejectGeo, ejectMat);
    mesh.scale.setScalar(radius(EJECT_MASS)); scene.add(mesh);
    ejects.push({ x: c.x - c.hx * r, z: c.z - c.hz * r, vx: -c.hx * 60 + c.vx, vz: -c.hz * 60 + c.vz, mass: EJECT_MASS, age: 0, mesh });
  }
  const BOT_DEF = ['shield', 'x_ghost', 'cloak', 'decoy', 'x_refl', 'push', 'x_phase', 'blink', 'shrink', 'x_typhoon', 'x_ice', 'slow', 'trap', 'dash', 'eject'];
  const BOT_OFF = ['x_hunt', 'x_ice', 'slow', 'x_meteor', 'x_anchor', 'x_vamp', 'dash', 'blink', 'x_twin'];
  const BOT_FARM = ['pulse', 'x_hole', 'x_over'];
  function botAI(o) {
    if (!running || o.kind !== 'bot' || !o.build || !o.cells.length || Math.random() > .35) return;
    const c = mainOf(o), p = PERSONA[o.persona] || PERSONA.normal;
    let threat = null, td = Infinity;
    for (const t of cells) { if (t.owner === o || (o.team && t.owner.team === o.team) || !canEat(t, c)) continue; const d = Math.hypot(t.x - c.x, t.z - c.z) - cellR(t); if (d < td) { td = d; threat = t; } }
    const prey = o.target && o.target.owner && !o.target.owner.decoy && !o.target.gone ? o.target : null, pd = prey ? Math.hypot(prey.x - c.x, prey.z - c.z) : Infinity;
    const def = threat && td < 12 + cellR(c) * 2, off = prey && pd < 30;
    const list = def && (p.flee >= 1 || !off) ? BOT_DEF : off ? BOT_OFF : def ? BOT_DEF : BOT_FARM;
    const inRange = id => { const a = abilById(id); if (list !== BOT_OFF || !a) return true; const reach = (a.radius || a.dist || 20) + cellR(c) * 2; return id === 'dash' || id === 'blink' || pd < reach; };
    const pick = list.find(id => o.build.includes(id) && !((o.abCd[id] || 0) > 0) && inRange(id));
    if (!pick || (pick === 'x_over' && !o.build.some(id => (o.abCd[id] || 0) > 0))) return;
    const aim = def ? { x: c.x * 2 - threat.x, z: c.z * 2 - threat.z } : off ? prey : null;   // run away from danger, face the prey
    if (aim) for (const k of o.cells) { const dx = aim.x - k.x, dz = aim.z - k.z, d = Math.hypot(dx, dz) || 1; k.hx = dx / d; k.hz = dz / d; }
    if (pick === 'dash') { o.dashT = .45; o.abCd.dash = 4; if (nearView(c.x, c.z)) emit(c.x, cellR(c), c.z, abilById('dash').color, 10, 5, .4); }
    else if (pick === 'eject') { botEject(o); o.abCd.eject = 1.5; }
    else castAbility(pick, o);
  }
  // «Случайный билд»: 3 random abilities out of the classic ones you own (no Chaos League exclusives); short of 3 → dash, split, eject
  function rbuildDraw() {
    // 2.1.1: any 3 of the 12 regular abilities, bought or not (exclusive ones never drop)
    const pool = ABILITIES.filter(a => !a.xa).map(a => a.id), out = [];
    while (out.length < 3 && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    return out;
  }
  function chaosDraw() {
    const first = Math.random() < .5 ? 'dash' : 'split', pool = ABILITIES.map(a => a.id).filter(id => id !== first), out = [first];
    while (out.length < 3) { const id = pool.splice(Math.floor(Math.random() * pool.length), 1)[0]; out.push(id); }
    return out;
  }
  function chaosBanner(label) {
    const el = $('chaosBanner');
    el.innerHTML = `<small>${label || 'Хаос-лига · твои способности на этот бой'}</small><div>` + runBuild.map((id, i) => { const a = abilById(id); return `<span style="--ac:${a.color}"><i>${a.icon}</i><b>${a.name}</b><small>${ABIL_CFG.slotKeyName[i]}</small></span>`; }).join('') + '</div>';
    el.hidden = false; clearTimeout(chaosBanner.t); chaosBanner.t = setTimeout(() => { el.hidden = true; }, CHAOS_CFG.showSec * 1000);
  }
  function abTick(dt) {
    xaTick(dt);
    for (const o of owners) {
      if (o.slowT) o.slowT = Math.max(0, o.slowT - dt);
      if (o.iceT) o.iceT = Math.max(0, o.iceT - dt);
      if (!o.abCd) continue;
      for (const k in o.abCd) o.abCd[k] = Math.max(0, o.abCd[k] - dt);
      for (const k in o.abT) o.abT[k] = Math.max(0, o.abT[k] - dt);
      // «Сжатие»: the size eases back smoothly
      const want = abOn('shrink', o) ? 1 - abilById('shrink').size : 1;
      if ((o.rs || 1) !== want) { o.rs = (o.rs || 1) + (want - (o.rs || 1)) * Math.min(1, dt * 6); if (Math.abs(o.rs - want) < .005) o.rs = want; }
    }
    for (const d of botDecoys) {
      d.ttl -= dt;
      if (d.ttl <= 0 || !d.src.cells.length) { scene.remove(d.mesh); d.gone = true; continue; }
      if (decoyCaught(d)) continue;
      const sp = d.still ? 0 : BASE_SPEED * ABIL_CFG.decoySpeed; d.x += d.hx * sp * dt; d.z += d.hz * sp * dt;
      const dc = Math.hypot(d.x, d.z), rr = R - d.r; if (dc > rr) { d.x *= rr / dc; d.z *= rr / dc; d.hx = -d.hx; d.hz = -d.hz; }
      d.mesh.position.set(d.x, d.r, d.z);
    }
    if (botDecoys.some(d => d.gone)) { botDecoys = botDecoys.filter(d => !d.gone); owners.forEach(o => { if (o.target && o.target.owner && o.target.owner.decoy && o.target.gone) o.target = null; }); }
    if (decoy) {
      decoy.ttl -= dt;
      if (decoy.ttl <= 0) { scene.remove(decoy.mesh); emit(decoy.x, decoy.r, decoy.z, '#ffffff', 20, 8, .5); decoy.gone = true; decoy = null; owners.forEach(o => { if (o.target && o.target.owner && o.target.owner.decoy) o.target = null; }); }
      else if (decoyCaught(decoy)) decoy = null;
      else {
        const sp = decoy.still ? 0 : BASE_SPEED * ABIL_CFG.decoySpeed;
        decoy.x += decoy.hx * sp * dt; decoy.z += decoy.hz * sp * dt;
        const dc = Math.hypot(decoy.x, decoy.z), rr = R - decoy.r; if (dc > rr) { decoy.x *= rr / dc; decoy.z *= rr / dc; decoy.hx = -decoy.hx; decoy.hz = -decoy.hz; }
        decoy.mesh.position.set(decoy.x, decoy.r, decoy.z);
      }
    }
  }
  function abilChips() {
    if (!running || !player.abT) return '';
    return ['shrink', 'cloak', 'x_ice', 'x_refl', 'x_ghost', 'x_vamp', 'x_typhoon'].filter(id => abOn(id)).map(id => `<div class="chip"><i style="background:${abilById(id).color}"></i>${abilById(id).name} ${Math.ceil(player.abT[id])} с</div>`).join('') +
      (decoy ? `<div class="chip"><i style="background:${abilById('decoy').color}"></i>Клон ${Math.ceil(decoy.ttl)} с</div>` : '') +
      (viruses.some(v => v.trap && v.trap.owner === player) ? `<div class="chip"><i style="background:${abilById('trap').color}"></i>Ловушки: ${viruses.filter(v => v.trap && v.trap.owner === player).length}</div>` : '');
  }
  function slotView(id) {
    if (id === 'dash') return { ready: 1 - player.dashCd / dashCdBase, sub: player.dashCd > 0 ? `${player.dashCd.toFixed(1)} с` : null, off: false };
    if (id === 'eject') { const can = running && player.cells.some(c => c.mass >= EJECT_MIN); return { ready: can ? 1 : 0, sub: can ? null : `нужно ${EJECT_MIN}`, off: !can }; }
    if (id === 'split') {
      const maxParts = playerMaxParts(), n = player.cells.length, cd = player.splitCd, heavy = player.cells.some(c => c.mass >= 20), can = n > 0 && n < maxParts && heavy && cd <= 0;
      return { ready: cd > 0 ? 1 - cd / playerSplitCd() : can ? 1 : 0, off: !can, sub: cd > 0 ? `${cd.toFixed(1)} с` : n >= maxParts ? `${n}/${maxParts} макс.` : !heavy ? 'нужно 20' : n > 1 ? `${n}/${maxParts}` : null };
    }
    if (id === 'x_phase' && player.phase2 > 0) return { ready: 1, off: false, sub: `ещё раз ${player.phase2.toFixed(1)} с` };
    const cd = player.abCd[id] || 0, act = player.abT[id] || 0;
    return { ready: cd > 0 ? 1 - cd / abCdOf(id) : 1, off: false, sub: act > 0 ? `${act.toFixed(1)} с ✓` : cd > 0 ? `${cd.toFixed(1)} с` : null };
  }

  function endRound() {
    if (stats.tutorial) { tutExit(false); return; }
    // «Три в одном»: a won round (not ranked) with 3 different abilities in the build, each used at least once
    if (stats.win && !stats.ranked && runBuild.filter(Boolean).length === 3 && runBuild.every(id => stats.abUsed[id])) stats.threeInOne = true;
    running = false;
    const lvBefore = playerLevel();
    const placeBonus = stats.modeBonus || 0;
    const surviveBonus = mode === 'survival' ? stats.time / 6 : 0;
    // coins for skill: drops eaten and time survived pay more, mass a bit less, Hardcore ×1.6
    const cParts = [['Масса', Math.sqrt(stats.maxMass) * 2.6], ['Съеденные капли', stats.kills * 5], ['Прислужники', stats.minions], ['Боссы и звёзды', stats.bossCoins],
                    ['Комбо', stats.comboCoins || 0], ['Время в игре', stats.time / 10], ['Бонус режима', placeBonus], ['Выживание', surviveBonus]].map(([k, v]) => [k, Math.round(v)]).filter(([, v]) => v > 0);
    const cBase = cParts.reduce((t, [, v]) => t + v, 0), cMul = [];
    if (U.greed) cMul.push([`«Жадность» +${2 * U.greed}%`, 1 + .02 * U.greed]);
    if (mode === 'hardcore') cMul.push(['«Хардкор»', 1.6]);
    if (arenaIs('olympus')) cMul.push(['Арена «Олимп»', 1.05]);
    // П8: every star of the skin you wear gives +1% coins (normal modes only)
    if (starBonus('coins')) cMul.push([`Звёзды скина ${'★'.repeat(starsOf(skin()))}`, 1 + starBonus('coins') / 100]);
    if (stats.ranked) cMul.push(['Рейтинговый бой', 1.5]);
    if (petLv('coins')) cMul.push([`Питомец +${5 * petLv('coins')}%`, 1 + .05 * petLv('coins')]);
    // 2.0.9: all coin multipliers together give at most ×2
    { const m = cMul.reduce((t, [, x]) => t * x, 1); if (m > COIN_MULT_CAP) cMul.push([`Потолок множителей ×${COIN_MULT_CAP}`, COIN_MULT_CAP / m]); }
    let coins = Math.round(cMul.reduce((t, [, m]) => t * m, cBase));
    const cExtra = [];
    let raidLine = '';
    if (mode === 'raid') {
      const rs = raidState(), dmg = stats.raidDmg || 0;
      rs.dmg = Math.min(RAID_HP, rs.dmg + dmg); coins += Math.round(dmg / 25); if (dmg) cExtra.push(['Урон в рейде', Math.round(dmg / 25)]);
      if (rs.dmg >= RAID_HP && !rs.done) {
        rs.done = true; const id = ensureRaidSkin(rs.week), had = save.skins.includes(id);
        if (!had) save.skins.push(id); else { coins += RARITY.epic.dup; cExtra.push(['Трофей уже есть', RARITY.epic.dup]); }
        coins += 1500; cExtra.push(['Победа в рейде', 1500]); save.special.push({ kind: 'challenge', rar: 'epic', title: 'Рейд' });
        raidLine = `<li class="done"><span>Босс недели повержен! Скин «${SKINS.find(k => k.id === id).name}»</span><span class="rw">+1500 ◆ + эпический сундук</span></li>`;
        save.raidWins = (save.raidWins || 0) + 1;
        const extra = save.raidWins >= 1 && !save.fxOwned.includes('raidAura') ? (save.fxOwned.push('raidAura'), 'аура «Аура рейдера»')
          : save.raidWins >= 3 && !save.hats.includes('helm') ? (save.hats.push('helm'), 'предмет «Шлем рейдера»')
          : save.raidWins >= 5 && !save.hats.includes('banner') ? (save.hats.push('banner'), save.pets.includes('raid_p') || save.pets.push('raid_p'), 'предмет «Знамя рейда» и питомец «Рейдер»') : '';
        if (extra) raidLine += `<li class="done"><span>Награда за ${save.raidWins}-ю победу в рейде</span><span class="rw">${extra}</span></li>`;
      }
      stats.raidLeft = RAID_HP - rs.dmg;
    }
    let xp = (arenaIs('galaxy') ? 1.1 : 1) * (mode === 'rbuild' ? 1.2 : 1) * Math.round(Math.sqrt(stats.maxMass) * 4 + stats.kills * 8 + stats.minions * 2 + stats.bossXp + stats.time / 5);
    xp = Math.round(xp * (1 + 0.05 * petLv('xp')) * (1 + starBonus('xp') / 100));
    const questRows = save.quests.map(id => QUESTS.find(q => q.id === id)).map(q => {
      const done = doneQuests.has(q.id);
      if (done) { coins += qCoins(q); xp += qXp(q); cExtra.push([`Задание: ${q.text}`, qCoins(q)]); }
      return `<li class="${done ? 'done' : ''}"><span>${done ? '✓ ' : ''}${q.text}</span><span class="rw">+${qCoins(q)} ◆ · +${qXp(q)} оп.</span></li>`;
    }).join('');
    save.coins += coins; save.xp += xp;
    const t = save.totals;
    t.splits += stats.splits; if (mode === 'timed' && stats.win) t.timedWins++;
    t.time += stats.time; t.bestKills = Math.max(t.bestKills, stats.kills); t.bestWave = Math.max(t.bestWave, stats.wave || 0);
    if (stats.win && mode === 'crown') t.crownWins++;
    if (stats.win && mode === 'race') t.raceWins++;
    t.bestBosses = Math.max(t.bestBosses || 0, stats.bosses); t.bestParts = Math.max(t.bestParts || 0, stats.maxParts || 1);
    t.starKills = (t.starKills || 0) + (stats.starKills || 0); t.bestCombo = Math.max(t.bestCombo || 0, stats.bestCombo || 0);
    t.kills += stats.kills; t.bosses += stats.bosses; t.minions += stats.minions; t.crumbs += stats.crumbs; t.ejects += stats.ejects; t.rounds++;
    save.bossTypes = [...new Set([...save.bossTypes, ...stats.bossTypes])];
    const wasRunning = running; running = false;
    const achNow = checkAch(); running = wasRunning;
    const achAll = [...stats.achGot, ...achNow];
    const best = Math.round(stats.maxMass);
    const prev = save.bests[mode] || 0;
    let score = best;
    if (mode === 'survival') score = Math.floor(stats.time);
    if (mode === 'crown') score = Math.floor(player.crownT);
    if (mode === 'raid') score = stats.raidDmg || 0;
    if (LOWER_BETTER[mode]) score = stats.win ? Math.max(1, Math.floor(stats.time)) : 0;
    if (mode === 'team') score = prev + (stats.win ? 1 : 0);
    const record = mode === 'team' ? stats.win : LOWER_BETTER[mode] ? score > 0 && (!prev || score < prev) : score > prev;
    if (record) { save.bests[mode] = score; Net.submitRecord(mode, score); }
    stats.crownT = player.crownT;
    // weekly tasks
    let weekLine = '';
    { const W = weeklyState();
      if (!W.modes.includes(mode)) W.modes.push(mode);
      for (const t of weeklyTasks(W.week)) {
        if (W.done.includes(t.id)) continue;
        W.prog[t.id] = t.modes ? W.modes.length : (W.prog[t.id] || 0) + t.add(stats);
        if (W.prog[t.id] >= t.n) { W.done.push(t.id);
          weekLine += `<li class="done"><span>📅 Задание недели: ${t.text(t.n)}</span><span class="rw">${W.done.length} / 3</span></li>`; }
      }
      if (W.done.length === 3 && !W.bonus) { W.bonus = true; coins += WEEK_BONUS; save.special.push({ kind: 'challenge', rar: WEEK_CHEST, title: 'Неделя' }); weekLine += `<li class="done"><span>📅 Все задания недели</span><span class="rw">сундук «${RARITY[WEEK_CHEST].name}»</span></li>`; cExtra.push(['Все задания недели', WEEK_BONUS]); save.coins += WEEK_BONUS; const tk = archTokAdd(ARCH_TOK_WEEK); if (tk) weekLine += `<li class="done"><span>🎟 Жетон архива за задания недели</span><span class="rw">+${tk}</span></li>`; weekLine += `<li class="done"><span>📅 Все задания недели выполнены!</span><span class="rw">+${WEEK_BONUS} ◆</span></li>`; } }
    const skillLine = checkSkill(stats).map(k => k.all ? '<li class="done skill"><span>🎯 Все мастерские достижения! Рамка «Мастер» и скин «Виртуоз»</span><span class="rw">в гардеробе</span></li>'
      : k.ms ? `<li class="done skill"><span>🎯 ${decorById(k.ms).skillN} мастерских достижений</span><span class="rw">титул «${decorById(k.ms).name}»</span></li>`
      : `<li class="done skill"><span>🎯 Мастерское достижение «${k.name}»</span><span class="rw">+${k.coins} ◆</span></li>`).join('');
    // legendary achievements
    { const G = save.legend; const add = (k, v) => G[k] = (G[k] || 0) + v;
      add('kills', stats.kills); add('coins', coins); add('bosses', stats.bosses); add('stars', stats.starKills || 0); add('wins', stats.win ? 1 : 0);
      add('time', Math.round(stats.time)); add('crumbs', stats.crumbs); add('lwins', stats.ranked && !stats.chaos && stats.win ? 1 : 0); G.combo = Math.max(G.combo || 0, stats.bestCombo || 0); }
    const legendLine = checkLegend().map(L => L.badge ? '<li class="done legend"><span>👑 Все легендарные достижения! Значок «Легенда Капель»</span><span class="rw">в профиле</span></li>'
      : `<li class="done legend"><span>👑 Легендарное достижение «${L.name}»</span><span class="rw">${legendNames(L)}</span></li>`).join('');
    // mode mastery
    const mBefore = save.mastery[mode] || 0, mGain = 10 + (stats.win ? 25 : 0) + (record ? 15 : 0) + Math.min(20, Math.floor(stats.time / 30));
    save.mastery[mode] = mBefore + mGain;
    let masteryLine = '';
    for (let k = masteryLv(mBefore); k < masteryLv(save.mastery[mode]); k++) {
      const L = MASTERY_LV[k]; let what = '';
      if (L.coins) { save.coins += L.coins; what = `+${L.coins} ◆`; }
      masteryLine += `<li class="done"><span>Мастерство «${MODES[mode].name}»: ${L.name}</span><span class="rw">${what}</span></li>`;
    }
    if (!save.decor.includes('fr_modes') && MODE_IDS.every(id => masteryLv(save.mastery[id] || 0) >= MASTERY_LV.length)) {
      save.decor.push('fr_modes'); masteryLine += '<li class="done"><span>Мастерство «Легенда» во всех режимах</span><span class="rw">рамка «Мастер режимов»</span></li>'; }
    { const lv = masteryLv(save.mastery[mode]), nx = MASTERY_LV[lv];
      masteryLine += `<li><span>Мастерство «${MODES[mode].name}» +${mGain}</span><span class="rw">${nx ? `${save.mastery[mode]}/${nx.pts} до «${nx.name}»` : 'максимум'}</span></li>`; }
    const chNow = checkChallenges();
    const chestChance = roundChestChance(stats.time / 60, stats.maxMass, stats.win, stats.ranked);
    const gotChest = save.pity >= CHEST_RULE[stats.ranked ? 'ranked' : 'normal'].pity - 1 || Math.random() < chestChance;
    if (gotChest) { save.chests++; save.pity = 0; } else save.pity++;
    logRoundChest(stats.ranked, stats.time, gotChest);
    let pts = !seasonStarted ? 0 : Math.round(Math.sqrt(stats.maxMass) * .8 + stats.kills * 3 + stats.bosses * 10 + stats.minions + (stats.win ? 40 : 0) + (stats.finalRank && stats.finalRank <= 3 ? (4 - stats.finalRank) * 10 : 0));
    if (mode === 'hardcore') pts = Math.round(pts * 1.5);
    if (mode === 'royale' && stats.finalRank) pts += (13 - stats.finalRank) * 4;
    if (!stats.ranked) pts = 0;
    let chaosR = null;
    if (stats.chaos) { chaosR = chaosApply(Math.round(Math.sqrt(stats.maxMass) * .8 + stats.kills * 3 + stats.bosses * 10 + stats.minions + (stats.win ? 40 : 0) + (stats.finalRank && stats.finalRank <= 3 ? (4 - stats.finalRank) * 10 : 0)) * (mode === 'hardcore' ? 1.5 : 1) + (mode === 'royale' && stats.finalRank ? (13 - stats.finalRank) * 4 : 0)); pts = 0; }
    const mainRanked = stats.ranked && !stats.chaos;
    const lgBefore = leagueOf(save.season.pts), gain = pts, fee = mainRanked ? LEAGUE_FEE[lgBefore] : 0;
    pts = gain - fee;
    if (mainRanked) {
      const before = save.season.pts, after = Math.max(LEAGUES[lgBefore].pts, before + pts);
      save.season.last = { gain, fee, net: after - before, floor: before + pts < LEAGUES[lgBefore].pts };
      save.season.fees = (save.season.fees || 0) + Math.min(fee, before - after + gain);
      save.season.games = (save.season.games || 0) + 1;
      save.season.pts = after;
    }
    const lgAfter = leagueOf(save.season.pts);
    save.totals.maxLeague = Math.max(save.totals.maxLeague || 0, lgAfter);
    for (let k = lgBefore + 1; k <= lgAfter; k++) save.special.push({ kind: 'league', league: k, title: lgView(k, holidayOf(save.season.id)).name });
    { const hi = holidayInfo(save.season.id); if (seasonStarted && hi && pts > 0) { const ky = hi.k + '_' + hi.y; save.totals.holLeagueY = save.totals.holLeagueY || {}; save.totals.holLeagueY[ky] = Math.max(save.totals.holLeagueY[ky] ?? 0, lgAfter); } }
    { const hk = holidayOf(save.season.id); if (seasonStarted && hk) { save.totals.holLeague = save.totals.holLeague || {}; save.totals.holLeague[hk] = Math.max(save.totals.holLeague[hk] || 0, lgAfter); } }
    { const wr = running; running = false; achAll.push(...checkAch()); running = wr; }
    save.totals.modeRounds[mode] = (save.totals.modeRounds[mode] || 0) + 1;
    save.history.push({ m: Math.round(stats.maxMass), mode }); if (save.history.length > 30) save.history.shift();
    if (mode === 'classic') save.best = Math.max(save.best, best);
    save.quests = save.quests.filter(id => !doneQuests.has(id));
    fillQuests();
    persist();
    const lvAfter = playerLevel();

    const head = stats.endTitle ? stats.endTitle + (record && mode !== 'team' ? ' · рекорд!' : '') : ['race', 'team', 'daily', 'raid'].includes(mode) ? 'Поражение' : record ? 'Новый рекорд!' : 'Раунд окончен';
    $('resTitle').textContent = `${head} · ${MODES[mode].name}`;
    const cellsHtml = [
      ['Время', fmtTime(stats.time)], ['Пик массы', best], ['Лучшее место', stats.bestRank > 50 ? '–' : stats.bestRank],
      ['Съедено капель', stats.kills], ['Крошек', stats.crumbs], ['Бонусов', stats.bonuses],
    ];
    if (stats.bosses) cellsHtml.push(['Боссов', stats.bosses]);
    if (stats.bestCombo) cellsHtml.push(['Лучшее комбо', `×${stats.bestCombo} · +${stats.comboCoins} ◆`]);
    if (stats.starKills) cellsHtml.push(['Звёзд повержено', stats.starKills]);
    if (stats.minions) cellsHtml.push(['Прислужников', stats.minions]);
    if (mode === 'survival') cellsHtml.push(['Волна', stats.wave]);
    if (stats.ejects) cellsHtml.push(['Выбросов', stats.ejects]);
    if (placeBonus) cellsHtml.push(['Бонус режима', `+${placeBonus} ◆`]);
    if (mode === 'crown') cellsHtml.push(['С короной', fmtTime(player.crownT)]);
    if (mode === 'raid') cellsHtml.push(['Урон боссу', stats.raidDmg || 0], ['Здоровье босса', `${Math.ceil(stats.raidLeft / RAID_HP * 100)}%`], ['Попыток сегодня', `${RAID_TRIES - raidState().tries} из ${RAID_TRIES}`]);
    if (mode === 'hardcore') cellsHtml.push(['Хардкор', 'монеты ×1,6']);
    if (mode === 'daily') cellsHtml.push(['Испытание', stats.dailyDone ? 'пройдено' : `нужно ${DAILY_GOAL}`]);
    $('resGrid').innerHTML = cellsHtml.map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');
    // tap the coins to see what they were made of
    $('coinBreak').innerHTML = cParts.map(([k, v]) => `<li><span>${k}</span><span class="rw">+${v}</span></li>`).join('') +
      `<li class="cb-sum"><span>Итого за игру</span><span class="rw">${cBase}</span></li>` +
      cMul.map(([k, m]) => `<li><span>${k}</span><span class="rw">×${m.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')}</span></li>`).join('') +
      cExtra.map(([k, v]) => `<li><span>${k}</span><span class="rw">+${v}</span></li>`).join('') +
      `<li class="cb-sum"><span>Всего</span><span class="rw">${coins} ◆</span></li>`;
    $('coinBreak').hidden = true;
    const upMain = stats.ranked && !stats.chaos && lgAfter > lgBefore, upChaos = chaosR && chaosOf(save.chaos.pts) > chaosOf(save.chaos.pts - chaosR.net);
    const upHTML = upMain ? (L2 => `<div class="rk-up" style="--rc:${L2.color}">${rankEmblem(lgAfter, 84)}<div class="rk-up-t"><small>Новая лига</small><b>${L2.name}</b><small>+ сундук лиги</small></div></div>`)(lgView(lgAfter, holidayOf(save.season.id)))
      : upChaos ? (ct => `<div class="rk-up" style="--rc:${CHAOS_TIERS[ct].color}">${chaosEmblem(ct, 84)}<div class="rk-up-t"><small>Хаос-лига · новая ступень</small><b>${CHAOS_TIERS[ct].icon} ${CHAOS_TIERS[ct].name}</b></div></div>`)(chaosOf(save.chaos.pts)) : '';
    // 2.0.7 results: a big number on the left, reward tiles sliding in on the right
    const lgHtml = `${chaosR ? ` <span style="color:${CHAOS_TIERS[chaosR.tier].color}">Хаос: ${chaosR.net >= 0 ? '+' : '−'}${Math.abs(chaosR.net)} очков${chaosR.fee ? ` <small>(+${chaosR.gain} − взнос ${chaosR.fee})</small>` : ''}${chaosR.capped ? ` <small>· «${chaosR.capped}» откроется с ${CHAOS_CFG.tierLevel[CHAOS_TIERS.findIndex(t => t.name === chaosR.capped)]} ур.</small>` : ''}</span>` : stats.ranked ? `<span style="color:${lgView(lgAfter, holidayOf(save.season.id)).color}">${pts >= 0 ? '+' : '−'}${Math.abs(pts)} рейтинга${fee ? ` <small>(+${gain} − взнос ${fee})</small>` : ''}</span>` : `<span class="hint">очки лиги — только в рейтинговом бою</span>`}`.trim();
    const lvI = levelInfo(save.xp), lvPct = lvI.max ? 100 : lvI.into / lvI.need * 100;
    const heroVal = mode === 'raid' ? Math.round(stats.raidDmg || 0) : best, heroLbl = mode === 'raid' ? 'урон боссу' : 'пик массы';
    const place = stats.finalRank || (stats.bestRank > 50 ? 0 : stats.bestRank);
    $('resHero').innerHTML = (record && mode !== 'team' ? '<span class="rh-rec">новый рекорд</span>' : '') + `<small>${heroLbl}</small><b class="rh-num" data-to="${heroVal}">0</b>` +
      `<div class="rh-chips">${place ? `<span>🏆 ${place}-е место</span>` : ''}<span>⏱ ${fmtTime(stats.time)}</span>${stats.kills ? `<span>🍴 ${stats.kills}</span>` : ''}</div>`;
    $('rewards').innerHTML = upHTML +
      `<button class="coin-btn rw-tile" id="coinBtn" aria-expanded="false" title="Из чего сложились монеты"><span class="rw-ico" style="color:var(--gold)">◆</span><span class="rw-txt"><b class="rw-c" data-to="${coins}">+0</b><small>монет · нажми, из чего сложились</small></span><span class="rw-go">▾</span></button>` +
      `<div class="rw-tile"><span class="rw-ico" style="color:var(--food)">✦</span><span class="rw-txt"><b style="color:var(--food)">+${xp} опыта</b><small>${lvAfter > lvBefore ? `новый уровень: ${lvAfter}!` : lvI.max ? 'максимальный уровень' : `уровень ${lvI.level} → ${lvI.level + 1} · осталось ${lvI.need - lvI.into}`}</small><i class="rw-bar"><i style="width:${lvPct.toFixed(0)}%"></i></i></span></div>` +
      (gotChest ? '<div class="rw-tile new"><span class="rw-ico">🎁</span><span class="rw-txt"><b>Выпал сундук</b><small>открой в меню «Награды»</small></span><span class="rw-tag">новое</span></div>' : '') +
      (/class="hint"/.test(lgHtml) ? `<p class="rw-note">${lgHtml.replace(/<\/?span[^>]*>/g, '')}</p>` : `<div class="rw-tile"><span class="rw-ico">🏆</span><span class="rw-txt">${lgHtml}</span></div>`);
    resCountUp();
    $('resQuests').innerHTML = questRows + achAll.map(a => `<li class="done"><span>🏆 ${a.name}</span><span class="rw">+${a.coins} ◆</span></li>`).join('') +
      chNow.map(ch => `<li class="done"><span>★ Испытание «${ch.name}»</span><span class="rw">${ch.reward ? rewardName(ch.reward) + ' + ' : ''}сундук «${RARITY[CH_TIER[ch.id] || 'rare'].name}»</span></li>`).join('') +
      weekLine + skillLine + legendLine + raidLine + masteryLine + (gotChest ? '<li class="done"><span>Выпал сундук</span><span class="rw">открой в меню «Сундуки»</span></li>' : '') +
      (lgAfter > lgBefore ? `<li class="done"><span>Новая лига: ${lgView(lgAfter, holidayOf(save.season.id)).name} + сундук лиги</span><span class="rw">сезон ${save.season.id}</span></li>` : '');
    if (lvAfter > lvBefore) {
      $('resQuests').innerHTML += payLevels(lvAfter); persist();
      const opened = [...UPG.filter(u => u.lvl > lvBefore && u.lvl <= lvAfter).map(u => u.name),
                      ...SKINS.filter(s => s.lvl > lvBefore && s.lvl <= lvAfter).map(s => 'скин ' + s.name),
                      ...FX.filter(f => f.lvl > lvBefore && f.lvl <= lvAfter).map(f => 'эффект ' + f.name),
                      ...ARENAS.filter(a => a.lvl > lvBefore && a.lvl <= lvAfter).map(a => 'арена ' + a.name)];
      $('unlock').textContent = `Уровень ${lvAfter}!` + (opened.length ? ` Открыто: ${opened.join(', ')}.` : '');
      $('unlock').hidden = false;
    } else $('unlock').hidden = true;
    { const n = $('resQuests').querySelectorAll('li.done').length;
      $('resDrawerTitle').innerHTML = `Подробности боя <small class="cnt">статистика, график${n ? `, наград: ${n}` : ''}</small>`; }
    $('resDrawer').open = false;
    renderAll();
    Sound.play(stats.win ? 'win' : 'lose'); if (lvAfter > lvBefore) setTimeout(() => Sound.play('level'), 600);
    if (record && mode !== 'team' && !stats.tutorial) setTimeout(() => Sound.play('record'), 1100);
    if ((stats.ranked && !stats.chaos && lgAfter > lgBefore) || (chaosR && chaosOf(save.chaos.pts) > chaosOf(save.chaos.pts - chaosR.net))) setTimeout(() => Sound.play('rankup'), 1600);
    showCard('resultCard');
    $('overlay').hidden = false;
    setGameUi(false);
    requestAnimationFrame(drawGraph);
  }

  function lostCell(o, lastMass, eater) {
    if (o.cells.length) return;
    if (o.isPlayer) {
      if (lives > 0) {
        lives--;
        rebuildCells();
        const [x, z] = safeSpot(14);
        addCell(player, x, z, Math.max(START_MASS, lastMass * 0.4), freeVis.pop());
        toast(`Второй шанс! Тебя съел ${eater.name}`);
        return;
      }
      if (mode === 'royale') { stats.finalRank = bots.filter(b => b.cells.length).length + 1; stats.endTitle = `Место ${stats.finalRank} из 13`; }
      if (mode === 'crown') {
        const r = [player, ...bots].sort((a, b) => b.crownT - a.crownT).indexOf(player) + 1;
        stats.finalRank = r;
        finishRound(`Корона: ${r} место (${fmtTime(player.crownT)})`, PLACE_BONUS[r - 1] || 0, r === 1);
        return;
      }
      dying = true;
      setTimeout(endRound, 800);
    } else if (o.kind === 'boss') {
      if (o.bossType === 'queen') burstFood(eater.cells[0] ? eater.cells[0].x : 0, eater.cells[0] ? eater.cells[0].z : 0, 10, 120);
    } else if (o.kind === 'minion') {
      // minions don't come back on their own
    } else {
      o.respawn = 2 + Math.random() * 3;
      if (mode === 'royale' && running) { o.disabled = true; toast(`${o.name} выбыл · осталось ${bots.filter(b => b.cells.length).length + (player.cells.length ? 1 : 0)}`); }
    }
  }

