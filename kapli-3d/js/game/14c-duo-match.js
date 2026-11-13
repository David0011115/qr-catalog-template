  // ================= duo match: a round for two phones (shared by «Захват территории» and «Спина к спине») =================
  // The room's host runs the whole round. The second player is one more owner of drops on the host («rival»), steered by the
  // controls the other phone sends. The other phone does not simulate: it moves its own drop at once (so steering never feels
  // late) and draws everything else from the host's snapshots, smoothing between them. Crumbs are laid out from one shared
  // seed; after that the host sends only the crumbs that moved. Abilities: the same three random ones for both, no upgrades.
  const DuoM = (() => {
    const SNAP_MS = 66, INPUT_MS = 50, RESPAWN_S = 2.5;
    const rival = makeOwner('Соперник', 'rival', null);
    rival.free = Array.from({ length: 10 }, () => makeVis(new THREE.Color('#ff4fd8')));
    owners.push(rival);
    const RIVAL_I = owners.indexOf(rival), PLAYER_I = owners.indexOf(player);
    let on = false, role = '', modeId = '', inp = { x: 0, z: 0 }, snapAt = 0, inAt = 0, virAt = 0, foodDirty = new Set(), sideX = { p: 0, r: 0 };
    const rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const r1 = v => Math.round(v * 10) / 10;

    // crumbs: the host remembers which ones moved, the other phone puts them where the host says
    const placeFood0 = placeFood;
    placeFood = i => { placeFood0(i); if (on && role === 'host') foodDirty.add(i); };
    function layout(seed) { const mr = Math.random; Math.random = rng(seed); try { for (let i = 0; i < FOOD; i++) placeFood0(i); } finally { Math.random = mr; } foodDirty.clear(); }
    function setFood(i, x, z) {
      foods[i] = { x, z }; fgSet(i);
      dummy.position.set(x, 0.35, z); dummy.rotation.set((i * 1.7) % 3, (i * 2.3) % 3, 0); dummy.updateMatrix(); foodMesh.setMatrixAt(i, dummy.matrix); foodMesh.instanceMatrix.needsUpdate = true;
    }
    function place(o, x) { [...o.cells].forEach(removeCell); const c = addCell(o, x, 0, START_MASS, o.free.pop()); c.hx = x > 0 ? -1 : 1; c.hz = 0; o.spawnSh = 3; rebuildCells(); return c; }
    function dress(o, skinId, name) {
      o.name = name || 'Соперник';
      const s = SKINS.find(k => k.id === skinId);
      if (s) o.free.concat(o.cells.map(c => c.vis)).forEach(v => { try { applySkin(v, s, 0, null); } catch (e) {} });
    }

    // bots change their look at every respawn: the host sends each new look, so both phones see the same bot (name, star, skin, effects)
    const dressBot0 = dressBot;
    dressBot = o => {
      dressBot0(o);
      if (on && role === 'host') Duo.send({ t: 'dr', i: owners.indexOf(o), n: o.name, st: o.star ? STAR_BOTS.indexOf(o.star) : -1, sk: o.lookSkin, sl: o.lookSt, fx: o.fx, lv: o.lvl, fr: o.frame });
    };
    function redress(m) {
      const o = owners[m.i]; if (!o || o.kind !== 'bot') return;
      o.name = m.n; o.lookSkin = m.sk; o.lookSt = m.sl; o.star = m.st >= 0 ? STAR_BOTS[m.st] : null; o.fx = m.fx || {}; o.trailDef = o.fx.trail ? fxById(o.fx.trail) : null; o.lvl = m.lv; o.frame = m.fr;
      const sk = SKINS.find(k => k.id === m.sk) || { id: 'bot_' + o.name, color: o.baseColor };
      o.free.concat(o.cells.map(c => c.vis)).forEach(v => { try { applySkin(v, sk, m.sl || 0, null); setAura(v, o.fx.aura, sk.color); } catch (e) {} });
    }

    // ---- start: the host draws the build and the seed and tells the other phone ----
    function startAsHost(id) {
      if (Duo.state !== 'ready' || Duo.role !== 'host') { toast('Сначала дождитесь второго игрока'); return; }
      const g = { t: 'go', m: id, seed: (Math.random() * 2 ** 31) | 0, build: rbuildDraw(), name: Net.nick || 'Игрок', skin: save.skin };
      Duo.send(g); begin('host', g);
    }
    function begin(r, g) {
      const t0 = performance.now();
      role = r; modeId = g.m; on = true; inp = { x: 0, z: 0 };
      save.mode = modeId; persist();
      setArenaSize(2);
      pendingRanked = false;
      startRound();
      if (!running) { cleanup(); return; }
      U = ZERO_UP; lives = 0; runBuild = g.build.slice(); abReset(); renderSlots();
      layout(g.seed);
      sideX = { p: (r === 'host' ? -1 : 1) * R * .55, r: (r === 'host' ? 1 : -1) * R * .55 };
      place(player, sideX.p);
      dress(rival, g.peerSkin || g.skin, g.peerName || g.name);
      if (r === 'host') { place(rival, sideX.r); rival.abT = {}; rival.abCd = {}; rival.dashT = 0; rival.dashCd = 0; rival.splitCd = 0; }
      else {   // the other phone draws, it does not run: no local bonuses, spikes come from the host
        bonuses.forEach(b => scene.remove(b.mesh)); bonuses = [];
        [...rival.cells].forEach(removeCell);
        Duo.send({ t: 'hi', name: Net.nick || 'Игрок', skin: save.skin });
      }
      Duo.touch(); if (TEST_MODE) console.log('duo begin ms', Math.round(performance.now() - t0));
      toast(r === 'host' ? 'Матч начался! Ты слева' : 'Матч начался! Ты справа');
    }
    function cleanup() {
      on = false; role = ''; [...rival.cells].forEach(removeCell); rebuildCells();
      setTimeout(() => { if (!running) setArenaSize(1); }, 1200);
    }
    function endMatch(title, win, notify) {
      if (!on) return;
      if (notify) Duo.send({ t: 'end' });
      const wasRunning = running && !dying;
      cleanup();
      if (wasRunning) finishRound(title, 0, win);
    }

    // ---- host: the second player's drops follow the other phone's controls; snapshots go out 15 times a second ----
    function steerRival(o, dt) {
      if (role !== 'host') return;
      o.dashT = Math.max(0, (o.dashT || 0) - dt); o.dashCd = Math.max(0, (o.dashCd || 0) - dt);
      if (!o.cells.length && o.respawnAt !== undefined && stats.time >= o.respawnAt) { delete o.respawnAt; place(o, sideX.r); toast(`${o.name} вернулся`); }
      const l = Math.hypot(inp.x, inp.z);
      for (const c of o.cells) { if (l > .1) steer(c, c.x + inp.x / l * 10 * Math.min(1, l), c.z + inp.z / l * 10 * Math.min(1, l), dt); else steer(c, c.x + c.hx * 10, c.z + c.hz * 10, 0); }
      if (!player.cells.length && player.respawnAt !== undefined && stats.time >= player.respawnAt) { delete player.respawnAt; place(player, sideX.p); effects.shield = Math.max(effects.shield, 3); toast('Ты снова в игре'); }
      hostSend();
    }
    function hostSend() {
      const now = performance.now(); if (now - snapAt < SNAP_MS) return; snapAt = now;
      const o = [];
      owners.forEach((w, i) => { if (!w.cells.length) return; const row = [i]; for (const c of w.cells) row.push(r1(c.x), r1(c.z), r1(c.mass)); o.push(row); });
      const s = { t: 's', tm: r1(stats.time), o };
      if (foodDirty.size) { const f = []; for (const i of foodDirty) { const fd = foods[i]; f.push(i, r1(fd.x), r1(fd.z)); if (f.length > 1500) break; } s.f = f; foodDirty.clear(); }
      if (now - virAt > 1000) { virAt = now; s.v = viruses.flatMap(v => [r1(v.x), r1(v.z), r1(v.mass)]); }
      s.cd = { d: r1(rival.dashCd || 0), s: r1(rival.splitCd || 0), a: rival.abCd ? Object.fromEntries(Object.entries(rival.abCd).map(([k, v]) => [k, r1(v)])) : {} };
      Duo.send(s, true);
    }
    function act(k, i) {   // host: an action from the other phone
      const o = rival; if (!o.cells.length || role !== 'host') return;
      const id = k === 'slot' ? runBuild[i] : k;
      if (id === 'split') { if (o.splitCd <= 0 && splitOwner(o, playerMaxParts(), playerMergeTime())) rebuildCells(); }
      else if (id === 'dash') { if (o.dashCd <= 0) { o.dashT = .35; o.dashCd = 4; o.cells.forEach(c => c.mass = Math.max(START_MASS * .5, c.mass * .97)); } }
      else if (id && id !== 'eject') castAbility(id, o);
    }
    // a player who was eaten comes back at their own side after a short wait (the rules of each mode may change it)
    function lost(o, lastMass, eater) {
      if (o !== player && o !== rival) return false;
      if (role !== 'host') return true;
      o.respawnAt = stats.time + RESPAWN_S;
      toast(o === player ? `Тебя съел ${eater.name}! Возвращение через ${RESPAWN_S} с` : `${o.name} съеден!`);
      return true;
    }

    // ---- the other phone: controls out, the world in ----
    function localDir() {
      const kx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0), kz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
      if (kx || kz) { const l = Math.hypot(kx, kz); return [kx / l, kz / l]; }
      if (joy.id !== null && joy.mag > 0.15) { const l = Math.hypot(joy.x, joy.y) || 1, m = Math.min(1, joy.mag); return [joy.x / l * m, joy.y / l * m]; }
      if (pointerActive && player.cells.length) { ray.setFromCamera(pointer, camera); if (ray.ray.intersectPlane(plane, hit)) { const [cx, cz] = pCenterXZ(), ex = hit.x - cx, ez = hit.z - cz, l = Math.hypot(ex, ez); if (l > 1) return [ex / l, ez / l]; } }
      return [0, 0];
    }
    function apply(s) {
      stats.time = Math.max(stats.time, s.tm);
      const seen = new Set();
      for (const row of s.o) {
        let o = owners[row[0]]; if (row[0] === PLAYER_I) o = rival; else if (row[0] === RIVAL_I) o = player;   // the host's own drop is the rival here, and the other way round
        if (!o) continue; seen.add(o);
        const n = (row.length - 1) / 3;
        while (o.cells.length > n) removeCell(o.cells[o.cells.length - 1]);
        for (let k = 0; k < n; k++) {
          const x = row[1 + k * 3], z = row[2 + k * 3], m = row[3 + k * 3];
          let c = o.cells[k]; if (!c) { if (!o.free.length) break; c = addCell(o, x, z, m, o.free.pop()); }
          c.tx = x; c.tz = z; c.mass = m;
        }
      }
      for (const o of owners) if (!seen.has(o) && o.cells.length) [...o.cells].forEach(removeCell);
      if (s.f) for (let j = 0; j < s.f.length; j += 3) setFood(s.f[j], s.f[j + 1], s.f[j + 2]);
      if (s.v) {
        const n = s.v.length / 3;
        while (viruses.length > n) removeVirus(viruses[viruses.length - 1]);
        while (viruses.length < n) spawnVirus(0, 0);
        viruses.forEach((v, k) => { v.x = s.v[k * 3]; v.z = s.v[k * 3 + 1]; v.mass = s.v[k * 3 + 2]; v.vx = v.vz = 0; });
      }
      if (s.cd) { player.dashCd = s.cd.d; player.splitCd = s.cd.s; player.abCd = s.cd.a; }
      rebuildCells();
    }
    function guestTick(dt) {
      stats.time += dt;
      const [dx, dz] = localDir(), now = performance.now();
      if (now - inAt > INPUT_MS) { inAt = now; Duo.send({ t: 'i', x: r1(dx * 10) / 10, z: r1(dz * 10) / 10 }, true); }
      for (const c of player.cells) {   // your own drop moves at once and leans toward where the host has it
        if (dx || dz) steer(c, c.x + dx * 10, c.z + dz * 10, dt);
        if (c.tx !== undefined) { const ex = c.tx - c.x, ez = c.tz - c.z, d = Math.hypot(ex, ez); if (d > 25) { c.x = c.tx; c.z = c.tz; } else { const k = Math.min(1, dt * 5); c.x += ex * k; c.z += ez * k; } }
      }
      const k = Math.min(1, dt * 12);
      for (const c of cells) {
        if (c.owner === player || c.tx === undefined) continue;
        const ex = c.tx - c.x, ez = c.tz - c.z, d = Math.hypot(ex, ez);
        if (d > 40) { c.x = c.tx; c.z = c.tz; continue; }
        if (d > .02) { c.hx += (ex / d - c.hx) * k; c.hz += (ez / d - c.hz) * k; const hl = Math.hypot(c.hx, c.hz) || 1; c.hx /= hl; c.hz /= hl; }
        c.x += ex * k; c.z += ez * k;
      }
      for (const v of viruses) if (v.mesh) v.mesh.position.set(v.x, radius(v.mass) * .9, v.z);
    }

    // ---- messages and the link state ----
    function msg(m) {
      if (m.t === 'go') { if (Duo.role === 'guest') begin('guest', m); return true; }
      if (!on) return false;
      if (m.t === 's') { if (role === 'guest') apply(m); return true; }
      if (m.t === 'i') { inp = { x: +m.x || 0, z: +m.z || 0 }; return true; }
      if (m.t === 'a') { act(m.k, m.i); return true; }
      if (m.t === 'hi') { dress(rival, m.skin, m.name); return true; }
      if (m.t === 'dr') { if (role === 'guest') redress(m); return true; }
      if (m.t === 'end') { endMatch(`${rival.name} вышел из матча`, true, false); return true; }
      return false;
    }
    function linkState() { if (on && Duo.state !== 'ready') endMatch('Связь со вторым телефоном потеряна', false, false); }
    // the match cannot stop: the pause button opens the menu while the round goes on; «Завершить» leaves the match for both
    function menu() { renderPauseInfo(); showCard('pauseCard'); $('overlay').hidden = false; setGameUi(false); $('resumeBtn').focus(); }
    $('quitBtn').addEventListener('click', () => { if (on) { Duo.send({ t: 'end' }); cleanup(); } }, true);
    window.duoStartMatch = startAsHost;

    return { get on() { return on; }, get guest() { return on && role === 'guest'; }, get host() { return on && role === 'host'; }, rival,
      steerRival, act: (k, i) => { if (role === 'guest') Duo.send({ t: 'a', k, i }); }, lost, guestTick, msg, linkState, menu, speedK: null };
  })();
