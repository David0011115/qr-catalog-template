  // ================= duo match: a round for two phones (shared by «Захват территории» and «Спина к спине») =================
  // The room's host runs the whole round. The second player is one more owner of drops on the host («rival»), steered by the
  // controls the other phone sends. The other phone does not simulate: it moves its own drop at once (so steering never feels
  // late) and draws everything else from the host's snapshots, smoothing between them. Crumbs are laid out from one shared
  // seed; after that the host sends only the crumbs that moved. Abilities: the same three random ones for both, no upgrades.
  const DuoM = (() => {
    const SNAP_MS = 66, INPUT_MS = 50, RESPAWN_S = 2.5;
    const rival = makeOwner('Соперник', 'rival', null);
    // 2.6: the drops and bosses of the modes for two are built at the first match, not at the start of the game
    // (less memory and a faster start for everyone who never plays them). The order is always the same on both phones,
    // so the owners keep the same numbers in the snapshots.
    const lazy = []; let built = false;
    lazy.push(() => { rival.free = Array.from({ length: 10 }, () => makeVis(new THREE.Color('#ff4fd8'))); });
    function ensureBuilt() { if (built) return; built = true; for (const f of lazy) f(); }
    owners.push(rival);
    const RIVAL_I = owners.indexOf(rival), PLAYER_I = owners.indexOf(player);
    const rules = {};   // each mode for two adds its own rules here (see 14d-territory.js)
    let modeIdLast = '', botMate = false, botT = 0, botGoal = null;   // test build: the second player can be a bot on this phone
    let rl = null, bonSig = '', on = false, role = '', modeId = '', serverMode = false, inp = { x: 0, z: 0 }, snapAt = 0, inAt = 0, virAt = 0, foodDirty = new Set(), sideX = { p: 0, r: 0 };
    const rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const r1 = v => Math.round(v * 10) / 10;

    // crumbs: the host remembers which ones moved, the other phone puts them where the host says
    const placeFood0 = placeFood;
    placeFood = i => { placeFood0(i); if (on && role === 'host') foodDirty.add(i); };
    foodHook = i => { if (on && role === 'host') foodDirty.add(i); };
    function layout(seed) { const mr = Math.random; Math.random = rng(seed); try { for (let i = 0; i < FOOD; i++) placeFood0(i); } finally { Math.random = mr; } foodDirty.clear(); }
    function setFood(i, x, z) {
      foods[i] = { x, z }; fgSet(i);
      dummy.position.set(x, 0.35, z); dummy.rotation.set((i * 1.7) % 3, (i * 2.3) % 3, 0); dummy.updateMatrix(); foodMesh.setMatrixAt(i, dummy.matrix); foodMesh.instanceMatrix.needsUpdate = true;
    }
    const homeX = o => rl && rl.spawnX ? rl.spawnX(o) : o === player ? sideX.p : sideX.r;
    const eff0 = () => ({ speed: 0, shield: 0, double: 0, magnet: 0 });
    rival.eff = eff0();
    function place(o, x) { [...o.cells].forEach(removeCell); const c = addCell(o, x, 0, START_MASS, o.free.pop()); c.hx = x > 0 ? -1 : 1; c.hz = 0; o.spawnSh = 3; rebuildCells(); return c; }
    // the other player's nickname floats above their drop
    const tagCv = document.createElement('canvas'); tagCv.width = 512; tagCv.height = 96;
    const tagTex = new THREE.CanvasTexture(tagCv);
    const tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTex, transparent: true, depthWrite: false, depthTest: false, fog: false }));
    tag.renderOrder = 20; tag.visible = false; scene.add(tag);
    function drawTag(name) {
      const g = tagCv.getContext('2d'); g.clearRect(0, 0, 512, 96);
      g.font = '800 56px Manrope, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 10; g.strokeStyle = 'rgba(14, 8, 36, .9)'; g.strokeText(name, 256, 50, 500);
      g.fillStyle = '#ff8ae6'; g.fillText(name, 256, 50, 500); tagTex.needsUpdate = true;
    }
    function tagTick() {
      let c = null; for (const k of rival.cells) if (!c || k.mass > c.mass) c = k;
      if (!on || !c) { tag.visible = false; return; }
      const r = cellR(c), w = Math.max(14, r * 3.2);
      tag.position.set(c.x, r * 2 + 2.2, c.z); tag.scale.set(w, w * 96 / 512, 1); tag.visible = true;
    }
    function dress(o, skinId, name) {
      o.name = String(name || 'Соперник').replace(/[<>&"'`]/g, '').trim().slice(0, 20) || 'Соперник';   // a nickname from the network goes into the page: no markup
      if (o === rival) drawTag(o.name);
      const s = SKINS.find(k => k.id === skinId);
      if (s) o.free.concat(o.cells.map(c => c.vis)).forEach(v => { try { applySkin(v, s, 0, null); } catch (e) {} });
    }

    // bots change their look at every respawn: the host sends each new look, so both phones see the same bot (name, star, skin, effects)
    const dressBot0 = dressBot;
    dressBot = o => {
      dressBot0(o);
      if (on && role === 'host') Duo.send({ t: 'dr', i: owners.indexOf(o), n: o.name, st: o.star ? STAR_BOTS.indexOf(o.star) : -1, sk: o.lookSkin, sl: o.lookSt, fx: o.fx, lv: o.lvl, fr: o.frame, p: o.persona });
    };
    function redress(m) {
      const o = owners[m.i]; if (!o || o.kind !== 'bot') return;
      o.name = m.n; o.lookSkin = m.sk; o.lookSt = m.sl; o.star = m.st >= 0 ? STAR_BOTS[m.st] : null; o.fx = m.fx || {}; o.trailDef = o.fx.trail ? fxById(o.fx.trail) : null; o.lvl = m.lv; o.frame = m.fr; if (m.p) o.persona = m.p;
      const sk = SKINS.find(k => k.id === m.sk) || { id: 'bot_' + o.name, color: o.baseColor };
      o.free.concat(o.cells.map(c => c.vis)).forEach(v => { try { applySkin(v, sk, m.sl || 0, null); setAura(v, o.fx.aura, sk.color); } catch (e) {} });
    }

    // ---- start: the host draws the build and the seed and tells the other phone ----
    // test build only: a match with a bot as the second player, no second phone and no network
    function practice(id) {
      if (!TEST_MODE) return;
      const sk = SKINS.filter(k => k.id !== 'default' && !k.legend && !k.skill && !k.tut && !k.craft);
      const g = { t: 'go', m: id, seed: (Math.random() * 2 ** 31) | 0, build: rbuildDraw(), name: Net.nick || 'Игрок', skin: save.skin, peerName: id === 'duoback' ? 'Бот-напарник' : 'Бот-соперник', peerSkin: sk[(Math.random() * sk.length) | 0].id };
      if (rules[id] && rules[id].goExtra) Object.assign(g, rules[id].goExtra());
      botMate = true; botGoal = null; begin('host', g);
    }
    // the bot: run from what can eat it, chase what it can eat, otherwise crumbs; in «Спина к спине» it keeps near you
    function botInput(o, dt) {
      const m = o.cells.reduce((a, b) => !a || b.mass > a.mass ? b : a, null); if (!m) return;
      botT -= dt; if (botT > 0 && botGoal) { aim(m, botGoal); return; }
      botT = .25; let fx = 0, fz = 0, prey = null, pd = 1e9;
      for (const c of cells) {
        if (c.owner === o) continue;
        const d = Math.hypot(c.x - m.x, c.z - m.z);
        if (canEat(c, m) && d < cellR(c) + cellR(m) + 45) { fx -= (c.x - m.x) / (d || 1); fz -= (c.z - m.z) / (d || 1); }
        else if (c.owner !== player || modeId === 'territory') { if (canEat(m, c) && d < 160 && d < pd) { pd = d; prey = c; } }
      }
      if (fx || fz) { botGoal = { x: m.x + fx * 40, z: m.z + fz * 40 }; aim(m, botGoal); return; }
      if (prey) { botGoal = prey; if (pd < 30 && o.dashCd <= 0 && Math.random() < .3) act('dash'); aim(m, botGoal); return; }
      if (modeId === 'duoback' && player.cells.length) { const [px, pz] = centerOf(player); if (Math.hypot(px - m.x, pz - m.z) > 110) { botGoal = { x: px, z: pz }; aim(m, botGoal); return; } }
      if (modeId === 'territory' && rl && rl.homeSide && !rl.homeSide(o, m.x)) { botGoal = { x: homeX(o), z: m.z * .5 }; aim(m, botGoal); return; }
      let best = null, bd = 1e9;
      for (let k = 0; k < 60; k++) { const i = (Math.random() * FOOD) | 0, f = foods[i]; if (!f) continue; const d = Math.hypot(f.x - m.x, f.z - m.z); if (d < bd && (modeId !== 'territory' || !rl.homeSide || rl.homeSide(o, f.x))) { bd = d; best = f; } }
      botGoal = best ? { x: best.x, z: best.z } : { x: 0, z: 0 }; aim(m, botGoal);
    }
    function aim(m, g) { const dx = g.x - m.x, dz = g.z - m.z, l = Math.hypot(dx, dz) || 1; inp = { x: dx / l, z: dz / l }; }
    function startAsHost(id) {
      if (Duo.state !== 'ready' || Duo.role !== 'host') { toast('Сначала дождитесь второго игрока'); return; }
      const g = { t: 'go', m: id, seed: (Math.random() * 2 ** 31) | 0, build: rbuildDraw(), name: Net.nick || 'Игрок', skin: save.skin };
      if (rules[id] && rules[id].goExtra) Object.assign(g, rules[id].goExtra());
      Duo.send(g); begin('host', g);
    }
    function begin(r, g) {
      const t0 = performance.now(); ensureBuilt();
      role = r; modeId = g.m; on = true; inp = { x: 0, z: 0 }; rl = rules[modeId] || null; bonSig = ''; rival.eff = eff0();
      rival.pid = null;
      if (rl && rl.pre) rl.pre(r, g);
      save.mode = modeId; persist();
      setArenaSize(rl && rl.arena ? rl.arena : 2);
      pendingRanked = false;
      startRound();
      if (!running) { cleanup(); return; }
      U = ZERO_UP; lives = 0; stats.duo = true; effects.shield = 3; runBuild = g.build.slice(); abReset(); renderSlots();
      layout(g.seed);
      sideX = { p: (r === 'host' ? -1 : 1) * R * .55, r: (r === 'host' ? 1 : -1) * R * .55 };
      if (rl && rl.begin) rl.begin(r, g);
      place(player, homeX(player));
      dress(rival, g.peerSkin || g.skin, g.peerName || g.name);
      if (serverMode) {
        rival.isPlayer = true; rival.team = g.peerTeam || (modeId === 'duoback' ? 'duo' : (r === 'host' ? 'guest' : 'host'));
        rival.abT = {}; rival.abCd = {}; rival.dashT = 0; rival.dashCd = 0; rival.splitCd = 0;
        dress(rival, g.peerSkin || g.skin, g.peerName || g.name);
        place(rival, homeX(rival));
      }
      else if (r === 'host') { place(rival, homeX(rival)); rival.abT = {}; rival.abCd = {}; rival.dashT = 0; rival.dashCd = 0; rival.splitCd = 0; }
      else {   // the other phone draws, it does not run: no local bonuses, spikes come from the host
        bonuses.forEach(b => scene.remove(b.mesh)); bonuses = [];
        [...rival.cells].forEach(removeCell);
        Duo.send({ t: 'hi', name: Net.nick || 'Игрок', skin: save.skin, pid: Net.shortId ? +Net.shortId : null });
      }
      if (!serverMode) Duo.touch(); if (TEST_MODE) console.log('duo begin ms', Math.round(performance.now() - t0));
      toast(r === 'host' ? 'Матч начался! Ты слева' : 'Матч начался! Ты справа');
    }
    function cleanup() {
      if (rl && rl.end) rl.end();
      if (serverMode) {
        for (const o of owners) if (o !== player && o !== rival && o.serverId) [...o.cells].forEach(removeCell);
        rival.isPlayer = false; rival.team = null;
      }
      serverMode = false;
      botMate = false; on = false; role = ''; rl = null; if (stallEl) { stallEl.hidden = true; clearInterval(stallT); } tag.visible = false; [...rival.cells].forEach(removeCell); rebuildCells();
      setTimeout(() => { if (!running) setArenaSize(1); }, 1200);
    }
    function endMatch(title, win, notify, bonus = 0) {
      if (!on) return;
      if (notify) Duo.send({ t: 'end' });
      const wasRunning = running && !dying;
      cleanup();
      if (wasRunning) finishRound(title, bonus, win);
    }
    // the host ends the match for both phones. w: 'host' | 'guest' | 'draw'; sh: the host's result (share of the field); why: 'early' | 'time'
    function result(w, sh, why, x) {   // x: extra numbers of the mode (waves, bosses…), the same for both
      if (!on || dying) return;
      if (role === 'host' && !serverMode) Duo.send({ t: 'res', w, sh, why, x });
      modeIdLast = modeId;
      const me = w === 'coop' ? 'coop' : w === 'draw' ? 'draw' : w === role ? 'win' : 'loss';
      const out = rl && rl.finish ? rl.finish(me, role === 'host' ? sh : 1 - sh, why, x) : { title: me === 'win' ? 'Победа!' : me === 'draw' ? 'Ничья' : 'Поражение', bonus: 0 };
      endMatch(out.title, me === 'win' || !!out.win, false, out.bonus);
      // rewards for playing the mode: a chat scene at 20 games (a profile background at 30 comes with the other backgrounds)
      for (const b of CHAT_BG_MODE) if (b.mode === modeIdLast && !chatBgOwned(b.id) && ((((save.duo || {})[b.mode]) || {}).games || 0) >= b.need) {
        save.chatBg = save.chatBg || []; save.chatBg.push(b.id); persist(); setTimeout(() => toast(`Новый фон чата: «${b.name}»`), 1500);
      }
    }

    // ---- host: the second player's drops follow the other phone's controls; snapshots go out 15 times a second ----
    function steerRival(o, dt) {
      if (role !== 'host') return;
      o.dashT = Math.max(0, (o.dashT || 0) - dt); o.dashCd = Math.max(0, (o.dashCd || 0) - dt);
      for (const k in o.eff) o.eff[k] = Math.max(0, o.eff[k] - dt);
      if (!o.cells.length && o.respawnAt !== undefined && stats.time >= o.respawnAt) { delete o.respawnAt; place(o, homeX(o)); o.eff.shield = 3; toast(`${o.name} вернулся`); }
      if (botMate && o.cells.length) botInput(o, dt);
      const l = Math.hypot(inp.x, inp.z);
      for (const c of o.cells) { if (l > .1) steer(c, c.x + inp.x / l * 10 * Math.min(1, l), c.z + inp.z / l * 10 * Math.min(1, l), dt); else steer(c, c.x + c.hx * 10, c.z + c.hz * 10, 0); }
      if (!player.cells.length && player.respawnAt !== undefined && stats.time >= player.respawnAt) { delete player.respawnAt; place(player, homeX(player)); effects.shield = Math.max(effects.shield, 3); toast('Ты снова в игре'); }
      tagTick();
      if (rl && rl.tick) rl.tick(dt);
      if (rl && rl.view) rl.view(dt);
      hostSend();
    }
    function hostSend() {
      const now = performance.now(); if (now - snapAt < SNAP_MS) return; snapAt = now;
      const o = [];
      owners.forEach((w, i) => { if (!w.cells.length) return; const row = [i]; for (const c of w.cells) row.push(r1(c.x), r1(c.z), r1(c.mass)); o.push(row); });
      const s = { t: 's', tm: r1(stats.time), o };
      if (foodDirty.size) { const f = []; for (const i of foodDirty) { const fd = foods[i]; f.push(i, r1(fd.x), r1(fd.z)); if (f.length > 1500) break; } s.f = f; foodDirty.clear(); }
      if (now - virAt > 1000) { virAt = now; s.v = viruses.flatMap(v => [r1(v.x), r1(v.z), r1(v.mass)]); }
      const bs = bonuses.map(b => b.type[0] + Math.round(b.x) + ',' + Math.round(b.z)).join(';');
      if (bs !== bonSig || s.v) { bonSig = bs; s.b = bonuses.flatMap(b => [BONUS_IDS.indexOf(b.type), r1(b.x), r1(b.z)]); }
      s.e = [r1(rival.eff.speed), r1(rival.eff.shield), r1(rival.eff.double), r1(rival.eff.magnet)];
      if (rl && rl.snap) rl.snap(s);
      s.cd = { d: r1(rival.dashCd || 0), s: r1(rival.splitCd || 0), a: rival.abCd ? Object.fromEntries(Object.entries(rival.abCd).map(([k, v]) => [k, r1(v)])) : {} };
      Duo.send(s, true);
    }
    // bonuses: the second player picks them up too, with the same effects (kept on the host for their drop, shown on their phone)
    const BONUS_IDS = Object.keys(BONUS);
    function rivalPick(b) {
      if (!on || role !== 'host' || !rival.cells.some(c => Math.hypot(c.x - b.x, c.z - b.z) < cellR(c) + 1)) return false;
      if (BONUS[b.type].instant) fountainBurst(rival);
      else rival.eff[b.type] = Math.min(b.type === 'shield' ? 10 : 30, rival.eff[b.type] + effectDur(b.type));
      emit(b.x, 1.2, b.z, BONUS[b.type].color, 24, 12, .6);
      return true;
    }
    function bonusMesh(type, x, z) {
      const col = new THREE.Color(BONUS[type].color), mesh = new THREE.Group();
      mesh.add(new THREE.Mesh(bonusCore, new THREE.MeshBasicMaterial({ color: col })));
      mesh.add(new THREE.Mesh(bonusRing, new THREE.MeshBasicMaterial({ color: col })));
      mesh.add(glowSprite(col, 5, .7)); mesh.position.set(x, 1.2, z); scene.add(mesh);
      return { x, z, type, mesh };
    }
    function act(k, i) {   // host: an action from the other phone
      if (serverMode) { if (k === 'slot') window.KapliOnlineServer?.useAbility(k, i); else window.KapliOnlineServer?.useAction(k); return; }
      const o = rival; if (!o.cells.length || role !== 'host') return;
      const id = k === 'slot' ? runBuild[i] : k;
      if (id === 'split') { if (o.splitCd <= 0 && splitOwner(o, playerMaxParts(), playerMergeTime())) rebuildCells(); }
      else if (id === 'dash') { if (o.dashCd <= 0) { o.dashT = .35; o.dashCd = 4; o.cells.forEach(c => c.mass = Math.max(START_MASS * .5, c.mass * .97)); } }
      else if (id && id !== 'eject') castAbility(id, o);
    }
    // a player who was eaten comes back at their own side after a short wait (the rules of each mode may change it)
    function lost(o, lastMass, eater) {
      if (o !== player && o !== rival) { if (role === 'host' && rl && rl.anyLost) rl.anyLost(o, eater); return false; }
      if (role !== 'host') return true;
      if (rl && rl.lost) rl.lost(o, eater);
      const rs = rl && rl.respawnS ? rl.respawnS(o) : RESPAWN_S;
      o.respawnAt = stats.time + rs;
      toast(o === player ? `Тебя съел ${eater.name}! Возвращение через ${Math.round(rs)} с` : `${o.name} съеден!`);
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
      if (serverMode) { applyServer(s); return; }
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
      if (s.b) {
        const want = []; for (let j = 0; j < s.b.length; j += 3) want.push([BONUS_IDS[s.b[j]], s.b[j + 1], s.b[j + 2]]);
        const keep = [];
        for (const b of bonuses) { const k = want.findIndex(w => w && w[0] === b.type && Math.abs(w[1] - b.x) < .2 && Math.abs(w[2] - b.z) < .2); if (k >= 0) { want[k] = null; keep.push(b); } else { emit(b.x, 1.2, b.z, BONUS[b.type].color, 20, 10, .5); scene.remove(b.mesh); } }
        for (const w of want) if (w && w[0]) keep.push(bonusMesh(w[0], w[1], w[2]));
        bonuses = keep;
      }
      if (s.e) { const was = effects.shield; effects.speed = s.e[0]; effects.shield = s.e[1]; effects.double = s.e[2]; effects.magnet = s.e[3]; if (s.e[1] > was + 1 && stats.time > 4) Sound.play('bonus'); }
      if (rl && rl.apply) rl.apply(s);
      if (s.cd) { player.dashCd = s.cd.d; player.splitCd = s.cd.s; player.abCd = s.cd.a; }
      rebuildCells();
    }
    function serverBegin(r, g) {
      cleanup();
      serverMode = true;
      begin(r, { ...g, seed: g.seed ?? 1, build: Array.isArray(g.build) ? g.build : [] });
      return on;
    }
    function serverIndex(data) {
      if (data.isPlayer) {
        const o = data.role === role ? player : rival;
        o.serverId = data.id; o.isPlayer = true; o.role = data.role;
        o.team = data.team || null; o.name = data.name || o.name;
        if (Array.isArray(data.build)) o.build = data.build;
        if (data.db) o.db = data.db; if (data.eff) o.eff = data.eff;
        if (data.abT) o.abT = data.abT; if (data.abCd) o.abCd = data.abCd;
        o.rs = data.rs || o.rs || 1;
        o.dashCd = data.dashCd || 0; o.splitCd = data.splitCd || 0;
        o.upgrades = data.upgrades || {}; o.abilityLevels = data.abilityLevels || {}; o.skin = data.skin || o.skin;
        o.splitMaxParts = data.splitMaxParts || 4; o.mergeSeconds = data.mergeSeconds || 14;
        o.dashCooldown = data.dashCooldown || 4; o.dashDuration = data.dashDuration || .35;
        o.dashMassCost = data.dashMassCost || .03; o.ejectSpeed = data.ejectSpeed || 60;
        return owners.indexOf(o);
      }
      let o = owners.find(item => item.serverId === data.id);
      if (!o && data.kind === 'bot') o = owners.find(item => item.kind === 'bot' && item.name === data.name && !item.serverId);
      if (!o && data.kind === 'boss') o = owners.find(item =>
        item.kind === 'boss' && item.dbType === data.dbType &&
        !!item.dbSpec === !!data.dbSpec &&
        (item.dbSlot ?? item.slot ?? null) === (data.dbSlot ?? null) && !item.serverId);
      if (!o) {
        o = makeOwner(data.name || 'Объект', data.kind || 'bot', data.persona || null);
        owners.push(o);
        if (data.kind === 'boss' && Array.isArray(bossOwners) && !bossOwners.includes(o)) bossOwners.push(o);
      }
      o.serverId = data.id; o.kind = data.kind || o.kind; o.name = data.name || o.name;
      o.team = data.team || null; o.homeSide = data.homeSide || 0; o.persona = data.persona || o.persona;
      if (Array.isArray(data.build)) o.build = data.build;
      if (data.db) o.db = data.db; if (data.eff) o.eff = data.eff;
      if (data.abT) o.abT = data.abT; if (data.abCd) o.abCd = data.abCd;
      o.dashCd = data.dashCd || 0; o.splitCd = data.splitCd || 0;
      o.dbType = data.dbType || null; o.dbSpec = !!data.dbSpec; o.dbSlot = data.dbSlot ?? null; o.dbId = data.dbId || null;
      o.rs = data.rs || o.rs || 1; o.skin = data.skin || o.skin;
      o.upgrades = data.upgrades || o.upgrades || {}; o.abilityLevels = data.abilityLevels || o.abilityLevels || {};
      o.splitMaxParts = data.splitMaxParts || o.splitMaxParts || 4; o.mergeSeconds = data.mergeSeconds || o.mergeSeconds || 14;
      o.dashCooldown = data.dashCooldown || o.dashCooldown || 4; o.dashDuration = data.dashDuration || o.dashDuration || .35;
      o.dashMassCost = data.dashMassCost || o.dashMassCost || .03; o.ejectSpeed = data.ejectSpeed || o.ejectSpeed || 60;
      const poolSize = Math.max(1, data.poolSize || 1);
      while (o.free.length + o.cells.length < poolSize) o.free.push(makeVis(new THREE.Color(data.kind === 'boss' ? '#ff9f43' : '#65d6ff')));
      return owners.indexOf(o);
    }
    function applyServer(s) {
      stats.serverClock = s.tm || 0;
      stats.time = Math.max(stats.time, stats.serverClock);
      const seen = new Set();
      for (const row of s.o || []) {
        const index = row[0];
        const o = index === PLAYER_I ? player : index === RIVAL_I ? rival : owners[index];
        if (!o) continue;
        seen.add(o);
        const meta = s.cm?.[index] || [];
        const n = (row.length - 1) / 3;
        while (o.cells.length > n) removeCell(o.cells[o.cells.length - 1]);
        for (let k = 0; k < n; k++) {
          const x = row[1 + k * 3], z = row[2 + k * 3], m = row[3 + k * 3];
          let cell = o.cells[k];
          if (!cell) {
            if (!o.free.length) o.free.push(makeVis(new THREE.Color('#65d6ff')));
            cell = addCell(o, x, z, m, o.free.pop());
          }
          const info = meta[k] || {};
          cell.tx = x; cell.tz = z; cell.mass = m;
          cell.serverId = info.id || null; cell.serverSlotId = info.slotId || null;
          cell.thx = info.hx; cell.thz = info.hz;
          cell.tvx = info.vx; cell.tvz = info.vz;
          cell.mergeT = info.mergeT || 0;
          o.rs = info.rs || o.rs || 1;
          o.spawnSh = info.spawnShield || 0; o.dashT = info.dashT || 0;
        }
      }
      for (const o of owners) if (!seen.has(o) && o.cells.length) [...o.cells].forEach(removeCell);
      if (s.f) for (let j = 0; j < s.f.length; j += 3) setFood(s.f[j], s.f[j + 1], s.f[j + 2]);
      if (s.v) {
        const n = s.v.length / 3;
        while (viruses.length > n) removeVirus(viruses[viruses.length - 1]);
        while (viruses.length < n) spawnVirus(0, 0);
        viruses.forEach((v, k) => {
          v.x = s.v[k * 3]; v.z = s.v[k * 3 + 1]; v.mass = s.v[k * 3 + 2];
          const meta = s.vm?.[k] || {};
          v.id = meta.id || v.id; v.vx = meta.vx || 0; v.vz = meta.vz || 0;
          v.feed = meta.feed || 0; v.trap = meta.trap || null;
          if (v.mesh) v.mesh.position.set(v.x, radius(v.mass), v.z);
        });
      }
      if (s.ej) {
        while (ejects.length > s.ej.length) { const old = ejects.pop(); if (old.mesh) scene.remove(old.mesh); }
        while (ejects.length < s.ej.length) {
          const mesh = new THREE.Mesh(ejectGeo, ejectMat); scene.add(mesh);
          ejects.push({ x: 0, z: 0, vx: 0, vz: 0, mass: EJECT_MASS, age: 0, mesh });
        }
        s.ej.forEach((item, index) => {
          const e = ejects[index]; e.tx = item.x; e.tz = item.z; e.vx = item.vx || 0; e.vz = item.vz || 0;
          e.mass = item.mass || EJECT_MASS; e.age = item.age || 0;
          e.mesh.scale.setScalar(radius(e.mass));
        });
      }
      if (s.cd) {
        player.dashCd = s.cd.d || 0; player.splitCd = s.cd.s || 0; player.abCd = s.cd.a || {};
      }
      if (rl && rl.applyServer && s.ms) rl.applyServer(s.ms, s.rt || {});
      rebuildCells();
    }
    function serverTick(dt) {
      if (!serverMode || !on || window.KapliOnlineServer?.paused) return;
      stats.time = Math.max(stats.time, stats.serverClock || 0);
      const [dx, dz] = localDir(), now = performance.now();
      if (now - inAt > INPUT_MS) {
        inAt = now;
        window.KapliOnlineServer?.sendInput(dx, dz);
      }
      const k = Math.min(1, dt * 12);
      for (const cell of cells) {
        if (cell.tx === undefined) continue;
        const ex = cell.tx - cell.x, ez = cell.tz - cell.z, distance = Math.hypot(ex, ez);
        if (distance > 40) { cell.x = cell.tx; cell.z = cell.tz; }
        else if (distance > 0.02) { cell.x += ex * k; cell.z += ez * k; }
        if (Number.isFinite(cell.thx) && Number.isFinite(cell.thz)) {
          cell.hx += (cell.thx - cell.hx) * k; cell.hz += (cell.thz - cell.hz) * k;
          const length = Math.hypot(cell.hx, cell.hz) || 1; cell.hx /= length; cell.hz /= length;
        }
      }
      for (const virus of viruses) if (virus.mesh) virus.mesh.position.set(virus.x, radius(virus.mass), virus.z);
      for (const e of ejects) if (e.tx !== undefined) {
        e.x += (e.tx - e.x) * k; e.z += (e.tz - e.z) * k;
        if (e.mesh) e.mesh.position.set(e.x, radius(e.mass), e.z);
      }
      if (rl && rl.view) rl.view(dt);
      tagTick();
    }
    function serverEnd(w, sh, why, extra) {
      if (!serverMode || !on) return;
      result(w, sh, why, extra);
    }
    function serverAbort() {
      if (!serverMode || !on) return;
      endMatch('Онлайн-матч приостановлен', false, false, 0);
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
      if (rl && rl.view) rl.view(dt);
      tagTick();
    }

    // ---- messages and the link state ----
    function msg(m) {
      if (m.t === 'go') { if (Duo.role === 'guest') begin('guest', m); return true; }
      if (!on) return false;
      if (m.t === 's') { if (role === 'guest') apply(m); return true; }
      if (m.t === 'i') { inp = { x: +m.x || 0, z: +m.z || 0 }; return true; }
      if (m.t === 'a') { act(m.k, m.i); return true; }
      if (m.t === 'hi') { dress(rival, m.skin, m.name); rival.pid = Number.isFinite(+m.pid) && +m.pid > 0 ? +m.pid : null; return true; }
      if (m.t === 'dr') { if (role === 'guest') redress(m); return true; }
      if (m.t === 'res') { if (role === 'guest') result(m.w, +m.sh || 0, m.why, m.x); return true; }
      if (rl && rl.msg && rl.msg(m)) return true;
      if (m.t === 'end') { endMatch(`${rival.name} вышел из матча`, true, false); return true; }
      return false;
    }
    // 2.6: a short loss of the link pauses the match on both phones instead of ending it
    let stallEl = null, stallT = 0;
    function stallView() {
      const show = on && !botMate && Duo.stalled;
      if (!stallEl) { stallEl = document.createElement('div'); stallEl.id = 'duoStall'; stallEl.setAttribute('role', 'status'); document.body.appendChild(stallEl); }
      stallEl.hidden = !show; clearInterval(stallT);
      if (show) { const draw = () => { stallEl.innerHTML = `<b>Связь прервалась</b><small>Матч на паузе — ждём второй телефон… ${Math.max(0, 25 - Duo.silent)} с</small>`; }; draw(); stallT = setInterval(draw, 500); }
    }
    function linkState() { stallView(); if (on && !botMate && Duo.state !== 'ready') endMatch('Связь со вторым телефоном потеряна', false, false); }
    // the match cannot stop: the pause button opens the menu while the round goes on; «Завершить» leaves the match for both
    function menu() { renderPauseInfo(); showCard('pauseCard'); $('overlay').hidden = false; setGameUi(false); $('resumeBtn').focus(); }
    $('quitBtn').addEventListener('click', () => { if (on) { Duo.send({ t: 'end' }); cleanup(); } }, true);
    window.duoStartMatch = startAsHost; window.duoPractice = practice;

    return { get on() { return on; }, get server() { return serverMode; }, get serverRole() { return role; }, serverBegin, serverIndex, serverApply: applyServer, serverTick, serverEnd, serverAbort, get serverInput() { return localDir(); }, get guest() { return on && role === 'guest'; }, get host() { return on && role === 'host'; }, rival,
      later: f => { if (built) f(); else lazy.push(f); },
      get paused() { return on && !botMate && Duo.stalled; }, get mode() { return on ? modeId : ''; }, get role() { return on ? role : ''; }, get practice() { return botMate; }, rules, rivalPick, result,
      steerRival, act: (k, i) => { if (serverMode) window.KapliOnlineServer?.useAbility(k, i); else if (role === 'guest') Duo.send({ t: 'a', k, i }); }, lost, guestTick, msg, linkState, menu,
      // a hook in canEat: the rules of the mode may forbid a bite; the second player's shield bonus counts like yours
      eatBlock: (a, b) => on && ((b.owner === rival && role === 'host' && rival.eff.shield > 0) || !!(rl && rl.eatBlock && rl.eatBlock(a, b))),
      speedK: c => { if (!on) return 1; let k = c.owner === rival && role === 'host' && rival.eff.speed > 0 ? 1.45 : 1; if (rl && rl.speedK) k *= rl.speedK(c); return k; },
      chip: () => on && rl && rl.chip ? rl.chip() : '' };
  })();
