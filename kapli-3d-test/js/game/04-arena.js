  // ================= spikes (viruses) =================
  const VIRUS_MASS = 100, VIRUS_COUNT = 8, VIRUS_MAX = 16, VIRUS_COLOR = '#3dff6e';
  const virusCore = new THREE.SphereGeometry(1, 20, 14), virusSpike = new THREE.ConeGeometry(.2, .55, 6);
  const virusMat = new THREE.MeshStandardMaterial({ color: VIRUS_COLOR, emissive: VIRUS_COLOR, emissiveIntensity: .5, roughness: .3, transparent: true, opacity: .85 });
  const virusSpikeMat = new THREE.MeshBasicMaterial({ color: '#b6ffcb' });
  const virusSpikesGeo = mergeGeo(Array.from({ length: 16 }, (_, i) => {   // spikes on a fibonacci sphere
    const n = 16, y = 1 - (i + .5) / n * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996, dir = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return [virusSpike, new THREE.Matrix4().compose(dir.clone().multiplyScalar(1.12), q, new THREE.Vector3(1, 1, 1))];
  }));
  let viruses = [];
  function makeVirusMesh() {
    const g = new THREE.Group(); g.name = 'вирус';
    g.add(new THREE.Mesh(virusCore, virusMat));
    g.add(new THREE.Mesh(virusSpikesGeo, virusSpikeMat));   // 2.7 FPS: the 16 spikes are one mesh (were 16 draw calls per spike ball)
    g.add(glowSprite(VIRUS_COLOR, 3, .5));
    scene.add(g);
    return g;
  }
  function spawnVirus(x, z, vx, vz) {
    if (viruses.length >= VIRUS_MAX) return null;
    if (x === undefined) {
      let ok = false;
      for (let t = 0; t < 30 && !ok; t++) { [x, z] = randInArena(12); ok = cells.every(c => hyp(c.x - x, c.z - z) > cellR(c) + 8); }
      if (!ok) { virusRespawn.push(4); return null; }   // 2.7: no free spot (a huge drop covers it) — never put a spike inside a drop, try again in 4 s
    }
    const v = { x, z, vx: vx || 0, vz: vz || 0, mass: VIRUS_MASS, feed: 0, mesh: makeVirusMesh() };
    viruses.push(v);
    return v;
  }
  function removeVirus(v) { scene.remove(v.mesh); viruses.splice(viruses.indexOf(v), 1); }
  function resetViruses() { [...viruses].forEach(removeVirus); const n = arenaIs('inferno') ? VIRUS_COUNT * 2 : arenaIs('lava') ? VIRUS_COUNT + 3 : VIRUS_COUNT; for (let i = 0; i < n; i++) spawnVirus(); }
  let virusRespawn = [];
  function popCell(c, v) {
    const o = c.owner;
    // a boss that has no spare parts to split into loses 30% of its mass as food and is stunned for a moment
    if (o.kind === 'boss' && !o.free.length) {
      const lost = c.mass * .3; c.mass -= lost; c.vis.jig = 1; o.stunT = 2.5; if (nearView(c.x, c.z)) Sound.play('spike');
      burstFood(c.x, c.z, cellR(c) + 8, Math.min(160, Math.round(lost / 4)));
      emit(v.x, radius(v.mass), v.z, VIRUS_COLOR, 40, 18, .8);
      if (stats) stats.bossPops = (stats.bossPops || 0) + 1;
      if (nearView(c.x, c.z)) toast(`Шип ранил босса «${o.name}»!`);
      return;
    }
    const maxP = o.isPlayer ? playerMaxParts() : o.kind === 'bot' ? BOT_PARTS : o.kind === 'boss' ? o.cells.length + o.free.length : 1;
    c.mass += v.mass * 0.5;
    const pieces = Math.min(o.isPlayer ? 8 - (U.spike || 0) : 8, maxP - o.cells.length + 1, o.free.length + 1);   // «Шипостойкость»: fewer pieces
    emit(v.x, radius(v.mass), v.z, VIRUS_COLOR, 30, 16, .7);
    if (pieces <= 1) return;
    const each = c.mass / pieces, mt = o.isPlayer ? playerMergeTime() : 14;
    c.mass = each; c.mergeT = mt; c.vis.jig = 1;
    for (let i = 1; i < pieces; i++) {
      const a = i / (pieces - 1) * Math.PI * 2 + Math.random() * .4, r = radius(each);
      const n = addCell(o, c.x + Math.cos(a) * r * .5, c.z + Math.sin(a) * r * .5, each, o.free.pop());
      n.vx = Math.cos(a) * 40; n.vz = Math.sin(a) * 40; n.hx = Math.cos(a); n.hz = Math.sin(a); n.mergeT = mt; n.vis.jig = 1;
    }
    if (o.isPlayer || nearView(c.x, c.z)) Sound.play('spike');
    if (o.isPlayer) { toast('Шип разорвал тебя на части!'); buzz(80); }
    else if (stats) {
      if (o.kind === 'boss') { stats.bossPops = (stats.bossPops || 0) + 1; if (nearView(c.x, c.z)) toast(`Шип разорвал босса «${o.name}»!`); }
      else { stats.botPops = (stats.botPops || 0) + 1; if (o.kind === 'bot' && nearView(c.x, c.z)) toast(`Шип разорвал ${o.name}!`); }
    }
  }
  function updateViruses(dt) {
    const hcNoSpikes = typeof ModeX.hcSpikesDisabled === 'function' && ModeX.hcSpikesDisabled();
    if (hcNoSpikes) {
      // Hardcore отключает только обычные шипы; ловушки способности должны продолжать работать.
      [...viruses].filter(v => !v.trap).forEach(removeVirus);
      virusRespawn = [];
    }
    const k = Math.exp(-2 * dt);
    for (const v of [...viruses]) {
      if (v.trap) { v.trap.ttl -= dt; if (v.trap.ttl <= 0) { removeVirus(v); continue; } }
      if (v.vx || v.vz) {
        v.x += v.vx * dt; v.z += v.vz * dt; v.vx *= k; v.vz *= k;
        if (Math.abs(v.vx) + Math.abs(v.vz) < .2) v.vx = v.vz = 0;
        const dc = hyp(v.x, v.z); if (dc > R - 5) { v.x *= (R - 5) / dc; v.z *= (R - 5) / dc; v.vx = v.vz = 0; }
      }
      const rv = radius(v.mass);
      for (const c of cells) {
        if (c.gone || c.mass < v.mass * 1.3) continue;   // small blobs hide behind spikes; bosses get popped too
        if (v.dodge && v.dodge.has(c) && hyp(c.x - v.x, c.z - v.z) >= cellR(c) + rv) v.dodge.delete(c);
        if (v.trap && (c.owner === v.trap.owner || (v.trap.owner.team && c.owner.team === v.trap.owner.team))) continue;   // a trap spares its owner and allies
        if (abOn('x_ghost', c.owner) || abOn('shrink', c.owner) || c.owner.spawnSh > 0) continue;   // «Фантом» and «Сжатие» pass spikes
        if (hyp(c.x - v.x, c.z - v.z) < cellR(c) - rv * .3) {
          popCell(c, v); removeVirus(v); if (!v.trap) virusRespawn.push(10); rebuildCells(); break;
        }
      }
    }
    { let due = 0; virusRespawn = virusRespawn.map(t => t - dt).filter(t => { if (t <= 0) { due++; return false; } return true; }); while (due-- > 0) spawnVirus(); }
  }
  // ejected blobs feed a spike; every 5th shot fires a new spike in that direction
  function feedVirus(e) {
    for (const v of viruses) {
      if (hyp(e.x - v.x, e.z - v.z) > radius(v.mass) + .5) continue;
      v.feed++; v.mass += 6;
      if (v.feed >= 5) {
        v.feed = 0; v.mass = VIRUS_MASS;
        const d = hyp(e.vx, e.vz) || 1, dx = e.vx / d || 1, dz = e.vz / d;
        spawnVirus(v.x + dx * radius(VIRUS_MASS) * 2.2, v.z + dz * radius(VIRUS_MASS) * 2.2, dx * 60, dz * 60);
        emit(v.x, 3, v.z, VIRUS_COLOR, 16, 12, .5);
      }
      return true;
    }
    return false;
  }

  // ================= arena events =================
  // 2.7 audit: every event is now a choice — risk for a reward, or a chance to hunt — and works at any mass.
  // First at 0:45, then one a minute, 20 s each; not in «Захват территории» and «Босс-рейд».
  const EVENTS = [
    { id: 'starfall', name: 'Звездопад',        desc: 'в отмеченную зону падают метеоры (−5% массы при попадании), между ними — золотые капли', color: '#ffd23f' },
    { id: 'rift',     name: 'Разлом',           desc: 'тянет тех, кто рядом; кто коснётся центра — теряет 10% массы', color: '#b26bff' },
    { id: 'wind',     name: 'Ветер',            desc: 'всех сносит в одну сторону: по ветру быстрее, против — медленнее', color: '#22e6ff' },
    { id: 'eclipse',  name: 'Затмение',         desc: 'темно, мини-карта гаснет, боты видят вдвое ближе — время охоты', color: '#ff3d6e' },
    { id: 'golden',   name: 'Золотая капля',    desc: 'по полю убегает золотая капля — поймай за монеты', color: '#ffd23f' },
    { id: 'coinrain', name: 'Монетный дождь',   desc: 'за каждого съеденного бота и босса — монеты сразу', color: '#3dffa2' },
    { id: 'quake',    name: 'Землетрясение',    desc: 'край арены горит: снаружи кольца масса тает 4% в секунду', color: '#ff6a00' },
    { id: 'bounty',   name: 'Награда за голову', desc: 'самая крупная капля помечена: съешь её — +50% её массы и монеты; если это ты — продержись', color: '#ff2d55' },
  ];
  const ev = { timer: 45, active: null, warn: null, left: 0, x: 0, z: 0, tick: 0, wx: 0, wz: 0, gold: null, target: null, golds: [], hitT: {} };
  const evInfo = id => EVENTS.find(e => e.id === id);
  const evOn = id => ev.active === id;
  const decalRing = (c, op) => { const m = new THREE.Mesh(new THREE.RingGeometry(.95, 1, 96), decal(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }))); m.rotation.x = -Math.PI / 2; m.position.y = .1; m.visible = false; scene.add(m); return m; };
  const meteorRing = decalRing('#ffd23f', .8), quakeRing = decalRing('#ff6a00', .9), bountyRing = decalRing('#ff2d55', .9);
  const quakeOut = new THREE.Mesh(new THREE.RingGeometry(1, 1.35, 96), decal(new THREE.MeshBasicMaterial({ color: '#ff3d00', transparent: true, opacity: .22, depthWrite: false, side: THREE.DoubleSide })));
  quakeOut.rotation.x = -Math.PI / 2; quakeOut.position.y = .08; quakeOut.visible = false; scene.add(quakeOut);
  const hole = new THREE.Group();
  hole.add(new THREE.Mesh(new THREE.SphereGeometry(5, 24, 16), new THREE.MeshBasicMaterial({ color: '#000000' })));
  const holeRing = new THREE.Mesh(new THREE.TorusGeometry(7.5, .5, 8, 64), new THREE.MeshBasicMaterial({ color: '#b26bff', transparent: true, blending: THREE.AdditiveBlending }));
  holeRing.rotation.x = Math.PI / 2 - .3; hole.add(holeRing); hole.add(glowSprite('#7b3dff', 34, .7));
  hole.position.y = 5; hole.visible = false; scene.add(hole);
  const goldGeo = new THREE.OctahedronGeometry(1), goldMat = new THREE.MeshBasicMaterial({ color: '#ffd23f' });
  const goldRunner = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshStandardMaterial({ color: '#ffd23f', emissive: '#ffb000', emissiveIntensity: .9, metalness: .6, roughness: .2 }));
  goldRunner.add(glowSprite('#ffd23f', 3.4, .9)); goldRunner.visible = false; scene.add(goldRunner);
  const RIFT_R = 60, QUAKE_K = .78;
  function evClear() {
    meteorRing.visible = quakeRing.visible = quakeOut.visible = bountyRing.visible = hole.visible = goldRunner.visible = false;
    ev.golds.forEach(g => scene.remove(g.mesh)); ev.golds = []; ev.gold = null; ev.target = null; ev.hitT = {};
    const mm = document.getElementById('miniWrap'); if (mm) mm.classList.remove('fog');
  }
  function resetEvents() { ev.timer = 45; ev.active = ev.warn = null; evClear(); }
  const evMain = () => player.cells.length ? mainOf(player) : null;
  function evStart() {
    const id = ev.active, m = evMain();
    if (id === 'rift') { let x = 0, z = 0; for (let k = 0; k < 20; k++) { [x, z] = randInArena(RIFT_R); if (!m || hyp(x - m.x, z - m.z) > RIFT_R + 40) break; } ev.x = x; ev.z = z; hole.position.set(x, 5, z); hole.visible = true; }
    if (id === 'wind') { const a = Math.random() * 6.283; ev.wx = Math.cos(a); ev.wz = Math.sin(a); }
    if (id === 'eclipse') { const mm = document.getElementById('miniWrap'); if (mm) mm.classList.add('fog'); }
    if (id === 'golden') { let x = 0, z = 0; for (let k = 0; k < 20; k++) { [x, z] = randInArena(30); if (!m || hyp(x - m.x, z - m.z) > 60) break; } ev.gold = { x, z, r: 4 }; goldRunner.position.set(x, 4, z); goldRunner.scale.setScalar(4); goldRunner.visible = true; }
    if (id === 'quake') { quakeRing.scale.setScalar(R * QUAKE_K); quakeOut.scale.setScalar(R * QUAKE_K); quakeRing.position.set(0, .1, 0); quakeOut.position.set(0, .08, 0); quakeRing.visible = quakeOut.visible = true; }
    if (id === 'bounty') {
      const all = [player, ...bots].filter(o => o.cells.length && !o.disabled); ev.target = all.reduce((a, b) => total(b) > total(a) ? b : a, all[0]) || null;
      if (ev.target === player) toast('🎯 Награда назначена за ТЕБЯ: боты охотятся 20 с — продержись и получи монеты');
    }
  }
  function updateEvent(dt) {
    if (!ev.active) {
      ev.timer -= dt;
      if (ev.timer <= 5 && !ev.warn) {
        ev.warn = EVENTS[Math.floor(Math.random() * EVENTS.length)].id;
        toast(`Через 5 с: ${evInfo(ev.warn).name}`);
        if (ev.warn === 'starfall') { [ev.x, ev.z] = randInArena(40); meteorRing.position.x = ev.x; meteorRing.position.z = ev.z; meteorRing.scale.setScalar(40); meteorRing.visible = true; }
      }
      if (ev.timer <= 0) {
        ev.active = ev.warn; ev.warn = null; ev.left = 20; ev.tick = 0;
        toast(`${evInfo(ev.active).name}: ${evInfo(ev.active).desc}`);
        evStart();
        if (TEST_MODE) try { TLog.ev('событие', ev.active); } catch (e) {}
      }
      return;
    }
    ev.left -= dt; ev.tick -= dt;
    const m = evMain(), pm = total(player);
    if (evOn('starfall')) {
      if (ev.tick <= 0) {   // one meteor and one golden drop every 0.6 s
        ev.tick = .6;
        const a = Math.random() * 6.283, q = Math.sqrt(Math.random()) * 36, x = ev.x + Math.cos(a) * q, z = ev.z + Math.sin(a) * q;
        wave(x, z, '#ff6a00', 1, 9, .5); emit(x, 20, z, '#ffb000', 6, 6, .6);
        for (const c of cells) if (hyp(c.x - x, c.z - z) < 6 + cellR(c) * .5 && c.owner.kind !== 'boss') { c.mass = Math.max(10, c.mass * .95); if (c.owner === player) { buzz(25); emit(c.x, cellR(c), c.z, '#ff3d00', 10, 8, .5); } }
        const b2 = Math.random() * 6.283, q2 = Math.sqrt(Math.random()) * 36, g = { x: ev.x + Math.cos(b2) * q2, z: ev.z + Math.sin(b2) * q2, v: Math.max(30, pm * .01), mesh: new THREE.Mesh(goldGeo, goldMat) };
        g.mesh.scale.setScalar(1.6); g.mesh.position.set(g.x, 1.6, g.z); scene.add(g.mesh); ev.golds.push(g);
      }
      for (let i = ev.golds.length - 1; i >= 0; i--) {
        const g = ev.golds[i]; g.mesh.rotation.y += dt * 3;
        const c = cells.find(c => hyp(c.x - g.x, c.z - g.z) < cellR(c) + 1.5); if (!c) continue;
        c.mass += g.v; scene.remove(g.mesh); ev.golds.splice(i, 1);
        if (c.owner === player) { emit(g.x, 2, g.z, '#ffd23f', 10, 6, .5); Sound.play('crumb'); }
      }
    }
    if (evOn('rift')) {
      hole.rotation.y += dt * 1.5;
      for (const c of cells) {
        const dx = ev.x - c.x, dz = ev.z - c.z, d = hyp(dx, dz) || 1; if (d > RIFT_R + cellR(c)) continue;
        const pull = (4 + 10 * (1 - d / (RIFT_R + cellR(c)))) * dt; c.x += dx / d * pull; c.z += dz / d * pull;
        const o = c.owner; if (d < 6 + cellR(c) * .3 && o.kind !== 'boss' && !((ev.hitT[o.name] || 0) > stats.time)) {
          ev.hitT[o.name] = stats.time + 2; for (const k of o.cells) k.mass = Math.max(10, k.mass * .9);
          c.vx = -dx / d * 60; c.vz = -dz / d * 60; if (o === player) { toast('Разлом: −10% массы'); buzz(50); }
        }
      }
      if (Math.random() < .6) { const a = Math.random() * 6.283, r = 10 + Math.random() * 30; emit(ev.x + Math.cos(a) * r, 2, ev.z + Math.sin(a) * r, '#b26bff', 1, 2, .8); }
    }
    if (evOn('wind')) {
      for (const c of cells) { c.x += ev.wx * 7 * dt; c.z += ev.wz * 7 * dt; clampArena(c); }
      if (m && Math.random() < .5) emit(m.x - ev.wx * 30 + (Math.random() - .5) * 60, 3, m.z - ev.wz * 30 + (Math.random() - .5) * 60, '#cfefff', 1, 2, .7);
    }
    if (evOn('golden') && ev.gold) {
      const g = ev.gold, mv = m ? speedOf(m) * .85 : 20;   // a little slower than you, whatever your mass
      if (m) { const dx = g.x - m.x, dz = g.z - m.z, d = hyp(dx, dz) || 1; if (d < 90) { g.x += dx / d * mv * dt; g.z += dz / d * mv * dt; } else { g.x += Math.sin(stats.time) * 6 * dt; } }
      { const L = hyp(g.x, g.z), lim = R - 8; if (L > lim) { g.x *= lim / L; g.z *= lim / L; } }
      goldRunner.position.set(g.x, 4 + Math.sin(stats.time * 6) * .6, g.z);
      if (m && player.cells.some(c => hyp(c.x - g.x, c.z - g.z) < cellR(c) + g.r)) {
        const coins = 60; stats.modeXCoins = (stats.modeXCoins || 0) + coins; ev.gold = null; goldRunner.visible = false;
        emit(g.x, 4, g.z, '#ffd23f', 30, 12, .8); wave(g.x, g.z, '#ffd23f', 2, 30, .6); Sound.play('level'); toast(`Золотая капля поймана! +${coins} ◆`);
      }
    }
    if (evOn('quake')) {
      const lim = R * QUAKE_K; quakeRing.material.opacity = .6 + .3 * Math.abs(Math.sin(stats.time * 5));
      for (const c of cells) if (hyp(c.x, c.z) > lim && c.owner.kind !== 'boss') { c.mass = Math.max(10, c.mass * (1 - .04 * dt)); if (c.owner === player && Math.random() < .3) emit(c.x, cellR(c), c.z, '#ff6a00', 2, 4, .4); }
    }
    if (evOn('bounty')) {
      const t = ev.target;
      if (!t || !t.cells.length) {
        if (t && t !== player) { /* eaten by someone else or gone */ }
        bountyRing.visible = false;
        if (t === player) { ev.target = null; }
      } else { const tm = mainOf(t); bountyRing.visible = true; bountyRing.position.set(tm.x, .12, tm.z); bountyRing.scale.setScalar(cellR(tm) + 6 + Math.sin(stats.time * 6)); }
    }
    if (ev.left <= 0) {
      if (evOn('bounty') && ev.target === player && player.cells.length) { stats.modeXCoins = (stats.modeXCoins || 0) + 80; toast('🎯 Ты продержался с наградой за голову: +80 ◆'); Sound.play('level'); }
      if (evOn('golden') && ev.gold) toast('Золотая капля убежала');
      ev.active = null; ev.timer = 60; evClear();
    }
  }
  // the bounty is eaten (07-round calls this when a whole owner is gone)
  function evOwnerEaten(victim, eater, lastMass) {
    if (!evOn('bounty') || ev.target !== victim || victim === player) return;
    if (eater === player) { const bonus = Math.round((lastMass || 0) * .5); if (player.cells.length) mainOf(player).mass += bonus; stats.modeXCoins = (stats.modeXCoins || 0) + 50; toast(`🎯 Награда за голову: +${bonus.toLocaleString('ru-RU')} массы и +50 ◆`); Sound.play('level'); }
    ev.target = null; bountyRing.visible = false;
  }
  // «Монетный дождь»: coins right away for every bot and boss you eat
  function evKillCoins(victim) { if (!evOn('coinrain')) return; const c = victim.kind === 'boss' ? 25 : victim.kind === 'bot' ? 5 : 0; if (!c) return; stats.modeXCoins = (stats.modeXCoins || 0) + c; if (player.cells.length) { const m = mainOf(player); emitIcons(m.x, cellR(m) + 3, m.z, 'star', '#ffd23f', 2, 1.2); } }

  // ================= owners & cells =================
  function makeOwner(name, kind, persona) {
    return { name, kind, persona, isPlayer: kind === 'player', cells: [], respawn: 0, think: 0, tx: 0, tz: 0, target: null, partner: null, dashT: 0, dashCd: 0, splitCd: 0, free: [] };
  }
  const player = makeOwner('Ты', 'player', null);
  const playerVis = Array.from({ length: 10 }, () => makeVis(C('--me')));
  player.free = playerVis.slice();
  const freeVis = player.free;
  const refreshSkin = () => { playerVis.forEach(v => { v.mine = true; applySkin(v); }); if (typeof applyAura === 'function') applyAura(); };   // forEach would pass the index as the skin
  refreshSkin();

  const BOT_DEFS = [
    ['Пухлик', 'normal'], ['Зефир', 'coward'], ['Икринка', 'coward'], ['Лава', 'aggressive'], ['Кварк', 'aggressive'],
    ['Пончик', 'farmer'], ['Мармелад', 'farmer'], ['Комета', 'hunter'], ['Орбита', 'hunter'],
    ['Нейтрон', 'normal'], ['Туман', 'coward'], ['Спутник', 'aggressive'],
    // 1.7.0: four more for the bigger arena (casual modes only; leagues, team and raid keep 12)
    ['Бублик', 'farmer'], ['Сполох', 'normal'], ['Ирис', 'coward'], ['Шквал', 'aggressive'],
  ];
  // star bots: one per round, named, in a legendary look, smarter and bigger than the rest
  const STAR_COINS = 50;
  const STAR_BOTS = [
    { name: 'Аврора',  skin: 'c_starborn',  aura: 'binaryAura',    trail: 'rainbowTrail', persona: 'hunter' },
    { name: 'Атлант',  skin: 'c_crystal',   aura: 'raysAura',      trail: 'goldTrail',    persona: 'aggressive' },
    { name: 'Вспышка', skin: 'phoenix',     aura: 'electricAura',  trail: 'sparksTrail',  persona: 'aggressive' },
    { name: 'Спектр',  skin: 'lc_absolute', aura: 'ringAura',      trail: 'rainbowTrail', persona: 'normal' },
    { name: 'Мираж',   skin: 'c_chameleon', aura: 'moonAura',      trail: 'pixelTrail',   persona: 'normal' },
    { name: 'Вулкан',  skin: 'c_lavalamp',  aura: 'snowglobeAura', trail: 'leafTrail',    persona: 'aggressive' },
  ];
  function pickStarBot() {
    bots.forEach(o => { if (o.star) { o.name = o.baseName; o.persona = o.basePersona; o.star = null; } });
    const pool = bots.filter((o, i) => !o.disabled && !o.partner && (mode !== 'team' || o.team !== player.team));
    if (!pool.length) return;
    const o = pool[(Math.random() * pool.length) | 0], def = STAR_BOTS[(Math.random() * STAR_BOTS.length) | 0];
    o.baseName = o.name; o.basePersona = o.persona; o.star = def; o.name = def.name; o.persona = def.persona;
  }
  const BOT_COLORS = ['#22e6ff', '#b26bff', '#3dffa2', '#ff6ad5', '#ff3d6e', '#ffd23f', '#c6ff3d', '#4d7cff', '#8f9bff', '#5ef2ff', '#e08cff', '#ff9a3d', '#7cffd8', '#ffb3f0', '#b8ff6a', '#ff7a5c'];
  const bots = BOT_DEFS.map(([n, p], i) => { const o = makeOwner(n, 'bot', p); o.baseColor = BOT_COLORS[i]; o.free = Array.from({ length: BOT_PARTS }, () => makeVis(new THREE.Color(BOT_COLORS[i]))); return o; });
  bots[7].partner = bots[8]; bots[8].partner = bots[7];
  // bosses: up to two on the arena at once, never two of the same kind
  const BOSS_TYPES = {
    giant:    { name: 'Громила',   color: '#c2416b', speed: .78, life: 90, parts: 1, coins: 20, xp: 30, mass: p => Math.min(mode === 'hardcore' ? HC_BOSS_MASS_CAP : mode === 'classic' ? CL_BOSS_MASS_CAP : BOSS_MASS_CAP, Math.max(220, p * 1.4)), about: 'огромный и медленный' },
    hunter:   { name: 'Шустрик',   color: '#ff6b3d', speed: 1.2, life: 70, parts: 1, coins: 15, xp: 25, mass: p => Math.min(mode === 'hardcore' ? HC_BOSS_MASS_CAP : mode === 'classic' ? CL_BOSS_MASS_CAP : BOSS_MASS_CAP, Math.max(90, p * 1.5)),  about: 'быстрый, охотится на тебя и делает рывки' },
    queen:    { name: 'Матка роя', color: '#9b5de5', speed: .7,  life: 90, parts: 1, coins: 15, xp: 25, mass: p => Math.min(mode === 'hardcore' ? HC_BOSS_MASS_CAP : mode === 'classic' ? CL_BOSS_MASS_CAP : BOSS_MASS_CAP, Math.max(180, p * 1.35)), about: 'выпускает прислужников, при гибели рассыпает еду' },
    frost:    { name: 'Морозец',   color: '#9ff0ff', speed: .9,  life: 80, parts: 1, coins: 20, xp: 30, mass: p => Math.min(mode === 'hardcore' ? HC_BOSS_MASS_CAP : mode === 'classic' ? CL_BOSS_MASS_CAP : BOSS_MASS_CAP, Math.max(150, p * 1.4)), about: 'ледяное облако вокруг замедляет всех, кто подплыл близко (до 3 с подряд, потом 10 с облако тебя не берёт)' },   // 2.5: replaces «Телепорт»
    chameleon:{ name: 'Мимик',     color: '#3dffa2', speed: .95, life: 80, parts: 1, coins: 25, xp: 35, mass: p => Math.min(mode === 'hardcore' ? HC_BOSS_MASS_CAP : mode === 'classic' ? CL_BOSS_MASS_CAP : BOSS_MASS_CAP, Math.max(150, p * 1.4)), about: 'невидим, пока не подплывёшь близко' },
    splitter: { name: 'Делитель',  color: '#2ec4b6', speed: .85, life: 90, parts: 6, coins: 25, xp: 35, mass: p => Math.min(mode === 'hardcore' ? HC_BOSS_MASS_CAP : mode === 'classic' ? CL_BOSS_MASS_CAP : BOSS_MASS_CAP, Math.max(240, p * 1.5)), about: 'делится на части, чтобы ловить добычу' },
  };
  // two of each kind, so survival can field duplicates in later waves
  let BOSS_TYPES_EXTRA = {};
  const bossOwners = [0, 1].flatMap(() => Object.entries(BOSS_TYPES)).map(([type, b]) => {
    const o = makeOwner(b.name, 'boss', 'boss');
    o.bossType = type; o.life = 0;
    o.free = Array.from({ length: b.parts }, () => {
      const v = makeVis(new THREE.Color(b.color));
      v.crown.visible = true;
      v.mesh.material.emissiveIntensity = .65; v.glow.material.opacity = .8;
      return v;
    });
    return o;
  });
  const colossus = makeOwner('Колосс', 'boss', 'boss');
  colossus.bossType = 'colossus'; colossus.life = 1e9;
  BOSS_TYPES_EXTRA = { colossus: { name: 'Колосс', color: '#e76f51', speed: .6, life: 1e9, parts: 12, coins: 60, xp: 80, about: 'делится при атаке' } };
  colossus.free = Array.from({ length: 12 }, () => {
    const v = makeVis(new THREE.Color('#e76f51'));
    v.crown.visible = true;
    v.mesh.material.emissiveIntensity = .65; v.glow.material.opacity = .8;
    return v;
  });
  // 2.5: the raid boss comes as a pair — the second twin of the week
  const colossus2 = makeOwner('Колосс-близнец', 'boss', 'boss');
  colossus2.bossType = 'colossus2'; colossus2.life = 1e9;
  BOSS_TYPES_EXTRA.colossus2 = { name: 'Колосс-близнец', color: '#7b3dff', speed: .66, life: 1e9, parts: 12, coins: 60, xp: 80, about: 'второй из пары: пока близнецы рядом, их связь гасит половину урона' };
  colossus2.free = Array.from({ length: 12 }, () => { const v = makeVis(new THREE.Color('#7b3dff')); v.crown.visible = true; v.mesh.material.emissiveIntensity = .65; v.glow.material.opacity = .8; return v; });
  const raidTwins = [colossus, colossus2];
  const MINION_COLOR = '#c9a7ff';
  const minions = Array.from({ length: 6 }, () => {
    const o = makeOwner('Прислужник', 'minion', 'aggressive');
    o.free = [makeVis(new THREE.Color(MINION_COLOR))];
    return o;
  });
  const owners = [player, ...bots, ...bossOwners, colossus, colossus2, ...minions];
  const bossInfo = o => BOSS_TYPES[o.bossType] || BOSS_TYPES_EXTRA[o.bossType];
  let cells = [];
  const rebuildCells = () => { cells = owners.flatMap(o => o.cells); };
  const total = o => o.cells.reduce((s, c) => s + c.mass, 0);

  function addCell(owner, x, z, mass, vis) {
    const c = { owner, x, z, vx: 0, vz: 0, hx: 0, hz: 1, mass, mergeT: 0, vis, gone: false };
    vis.mesh.visible = vis.ring.visible = true;
    owner.cells.push(c);
    return c;
  }
  function removeCell(c) {
    const o = c.owner;
    if (c.gone) return;
    c.gone = true; o.lastAt = { x: c.x, z: c.z };   // where its last part was (2.7: «Спина к спине» checks if a boss died next to the partner)
    o.cells.splice(o.cells.indexOf(c), 1);
    c.vis.mesh.visible = c.vis.ring.visible = false;
    c.vis.shield.visible = false;
    o.free.push(c.vis);
  }
  function safeSpot(minDist) {
    for (let t = 0; t < 50; t++) {
      const [x, z] = randInArena(6);
      if (cells.every(c => hyp(c.x - x, c.z - z) > minDist + cellR(c))) return [x, z];
    }
    return randInArena(6);
  }
  function spawnBot(o) {
    if (o.disabled) return;
    if (!o.cells.length) dressBot(o);
    // bot size no longer follows the player (that fed an endless growth loop)
    const top = Math.min(BOT_MASS_CAP, Math.max(30, total(player) * 0.6));
    const [x, z] = safeSpot(running ? 22 : 14);
    // 1.7.0: a respawned bot is not just food — it starts at 30–50% of the median bot and is protected for 3 s
    const alive = bots.filter(b => b !== o && b.cells.length).map(b => total(b)).sort((a, b) => a - b), med = alive.length ? alive[alive.length >> 1] : 0;
    const base = 6 + Math.pow(Math.random(), 2) * top, catchUp = running ? Math.min(300, med * (.3 + Math.random() * .2)) : 0;
    addCell(o, x, z, Math.min(BOT_MASS_CAP, o.star ? Math.max(60, top * 1.1) : Math.max(base, catchUp)), o.free.pop());
    o.tx = x; o.tz = z; o.think = 0; o.target = null; o.spawnSh = running ? 3 : 0;
    rebuildCells();
  }
  let lastBoss = null;
  const SURV_BOSS_CAP = 30000;
  const RAID_BOSS_CAP = 20000;   // unchanged: preserve the weekly Colossus raid cap
  function maxBosses() {
    if (dailyIs('bosses')) return 3;
    if (mode === 'crown') return ModeX.crownMaxBosses();
    if (mode !== 'survival') return 2;
    return stats.wave >= 10 ? 4 : stats.wave >= 5 ? 3 : 2;
  }
  // want: a kind asked for by a «связка» of «Выживание» (one boss over the usual cap is allowed for it); near: spawn next to it
  function spawnBoss(want = null, near = null) {
    const active = bossOwners.filter(o => o.cells.length);
    if (active.length >= maxBosses() + (want ? 1 : 0)) return false;
    const surv = mode === 'survival';
    const dupesOk = surv && stats.wave >= 5;
    let pool = want ? bossOwners.filter(o => !o.cells.length && o.bossType === want)
      : bossOwners.filter(o => !o.cells.length && (dupesOk || !active.some(a => a.bossType === o.bossType)));
    // one owner per kind unless duplicates are allowed
    if (!dupesOk && !want) pool = pool.filter((o, i, arr) => arr.findIndex(x => x.bossType === o.bossType) === i);
    if (pool.length > 1 && !want) pool = pool.filter(o => o.bossType !== lastBoss);
    if (!pool.length) return false;
    const o = pool[Math.floor(Math.random() * pool.length)], b = BOSS_TYPES[o.bossType];
    let mass = b.mass(total(player));
    if (mode === 'crown') mass = ModeX.crownBossMass(b, mass);
    if (mode === 'hardcore') mass = ModeX.hcBossMass(mass);
    if (surv) {
      // 2.5: every wave is 12% heavier (was 25%: a wall after wave 10), and always clearly bigger than the player's largest part
      const biggest = Math.max(0, ...player.cells.map(c => c.mass));
      mass = Math.min(SURV_BOSS_CAP, Math.max(mass, biggest * 1.4) * ModeX.survGrow(stats.wave));
    }
    const [x, z] = near ? [Math.max(-R * .8, Math.min(R * .8, near.x + 9)), Math.max(-R * .8, Math.min(R * .8, near.z + 9))] : safeSpot(30);
    addCell(o, x, z, mass, o.free.pop());
    o.wave = stats.wave || 1; o.mate = null;
    o.tpT = 5;
    o.life = b.life * (surv ? 1.5 : 1); o.think = 0; o.target = null; o.dashT = 0; o.dashCd = 3; o.hcDashWarn = 0; o.hcDashTarget = null; o.hcRole = 'pursue'; o.spawnT = 4;
    lastBoss = o.bossType;
    rebuildCells();
    if (!want) toast(surv ? `Волна ${stats.wave}: ${b.name}` : `Босс ${b.name}: ${b.about}`); Sound.play('boss');
    return o;
  }
  // 2.7 «Выживание»: every 3rd wave is a «связка» — two bosses that help each other come together;
  // while both are alive and close, they are 10% faster
  function spawnCombo(cb) {
    const a = spawnBoss(cb.a); if (!a) return spawnBoss();
    const b = spawnBoss(cb.b, a.cells[0]);
    if (b) { a.mate = b; b.mate = a; }
    toast(`Волна ${stats.wave} — связка «${cb.name}»: ${BOSS_TYPES[cb.a].name} + ${BOSS_TYPES[cb.b].name}. ${cb.how}`);
    stats.combos = (stats.combos || 0) + 1;
    return a;
  }
  function spawnMinion(queen) {
    const m = minions.find(o => !o.cells.length);
    if (!m) return;
    const q = queen.cells[0], a = Math.random() * Math.PI * 2, r = cellR(q) + 1.5;
    const c = addCell(m, q.x + Math.cos(a) * r, q.z + Math.sin(a) * r, 8 + Math.random() * 6, m.free.pop());
    c.vx = Math.cos(a) * 25; c.vz = Math.sin(a) * 25;
    m.think = 0; m.target = null;
    rebuildCells();
  }
  // 2.3 «Фонтан»: crumbs spray out in a ring around the player (more for a bigger drop), with a fountain of particles
  function fountainBurst(o = player) {
    if (!o.cells.length) return;
    const [x, z] = centerOf(o), r = cellR(mainOf(o)), n = Math.round(Math.min(160, 60 + total(o) / 40));
    burstFood(x, z, r * 1.8 + 12, n, r + 1.5);
    for (let k = 0; k < 6; k++) emit(x, r + 1, z, k % 2 ? '#4d8dff' : '#bff8ff', 14, 10 + k * 2, .9);
    wave(x, z, '#4d8dff', r, r + 16 + r, .8); wave(x, z, '#bff8ff', r * .6, r + 10 + r * .6, .6);
  }
  let foodHook = () => {};   // matches for two: the host notes crumbs that moved, to send them to the other phone
  function burstFood(x, z, rad, n, inner = 0) {   // inner: crumbs land in a ring outside this radius (not under the drop)
    for (let k = 0; k < n; k++) {
      const i = Math.floor(Math.random() * FOOD), a = Math.random() * Math.PI * 2, d = inner + Math.sqrt(Math.random()) * (rad - inner);
      const fx = x + Math.cos(a) * d, fz = z + Math.sin(a) * d;
      if (hyp(fx, fz) > R - 1.5) continue;
      foods[i] = { x: fx, z: fz }; fgSet(i); foodHook(i);
      dummy.position.set(fx, 0.35, fz); dummy.updateMatrix(); foodMesh.setMatrixAt(i, dummy.matrix);
    }
    foodMesh.instanceMatrix.needsUpdate = true;
  }

  // ================= round state =================
  let running = false, paused = false, dying = false, lives = 0, dashCdBase = 4;
  let bossTimer = 20, bonusTimer = 0;
  let stats, history, doneQuests, effects, bonuses = [];
  const effectDur = t => (charIs('berserk') ? .75 : 1) * BONUS[t].dur * (1 + 0.05 * (U.bonus || 0)) * (arenaIs('sakura') ? 1.25 : 1) * (1 + starBonus('bonus') / 100);

  function speedOf(c) {
    const o = c.owner;
    const speedMass = o.isPlayer || (o.kind === 'boss' && mode === 'classic') ? Math.min(c.mass, PLAYER_SPEED_MASS_CAP) : c.mass;   // 2.7 «Классика»: a huge boss is no slower than a 20 000 drop
    let v = BASE_SPEED * Math.pow(speedMass / START_MASS, -0.15);
    if (o.isPlayer || o.kind === 'rival') {   // the second player of a match for two moves exactly like you (no upgrades: they are off in modes for two)
      // during a dash the mass slowdown is ignored: always 3.2x the starting speed
      if (o.dashT > 0) v = BASE_SPEED * DASH_MULT * Math.pow(Math.max(1, speedMass / START_MASS), -0.1);   // 1.7.0: a big blob's dash is weaker
      if (o.isPlayer && charIs('tank')) v *= .92;   // «Танк»
      if (o.isPlayer) v *= (1 + 0.01 * U.speed) * (effects.speed > 0 ? 1.45 : 1) * (1 + 0.02 * petLv('speed')) * (abOn('shrink') ? ABIL_CFG.shrinkSpeed : 1);
      else v *= abOn('shrink', o) ? ABIL_CFG.shrinkSpeed : 1;
      v *= (o.freezeT > 0 ? .05 : 1) * (o.slowT > 0 ? (o.isPlayer ? 1 - (1 - ABIL_CFG.slowFactor) * (1 - ModeX.hcSlowRes()) : ABIL_CFG.slowFactor) : 1) * (DuoM.speedK ? DuoM.speedK(c) : 1);   // 2.7 «Ледяное сердце» halves the slow   // bots' «Ледяная волна», «Метеорный удар», «Замедляющая волна», «Якорь»
    }
    else if (o.freezeT > 0) v *= .05;
    if (o.hcPack) v *= ModeX.hcPackSpeedK(o);   // 2.7: a pack hunts 15% faster («Классика»: 10%)
    else if (o.slowT > 0) v *= ABIL_CFG.slowFactor * (o.kind === 'boss' ? bossInfo(o).speed : 1);
    else if (o.kind === 'boss') v *= bossInfo(o).speed * (o.dashT > 0 ? 2 : 1) * (o.stunT > 0 ? .4 : 1);
    else if (o.kind === 'minion') v *= 1.05;
    else v *= (o.star ? 1 : botSkill().speed) * (o.dashT > 0 ? 1.9 : 1) * (abOn('shrink', o) ? ABIL_CFG.shrinkSpeed : 1);
    return v * (dailyIs('speedy') ? 1.3 : 1) * (arenaIs('cyber') ? 1.1 : 1) * 1 * ModeX.botSpeedK(o);
  }
  // the character that works right now (none in the league, Chaos League, tutorial and matches for two)
  const charNow = () => { try { return running && stats && !stats.ranked && !stats.chaos && !stats.tutorial && !DuoM.on && charById(save.char) && playerLevel() >= charById(save.char).lvl ? save.char : null; } catch (e) { return null; } };
  const charIs = id => charNow() === id;
  const eatRatio = c => c.owner.isPlayer ? (1.25 + 0.01 * U.guard) * ModeX.hcK('skin') * (charIs('tank') ? 1.12 : 1) : 1.25;
  const canEat = (a, b) => !(b.owner.spawnSh > 0) && !(abOn('shrink', a.owner) || abOn('x_ghost', a.owner)) && !((b.owner.isPlayer && effects.shield > 0) || abOn('shield', b.owner) || abOn('x_ghost', b.owner)) && !(a.owner.team && a.owner.team === b.owner.team) && a.mass > b.mass * (a.owner.cloakBonus && abOn('cloak', a.owner) ? 1.1 : eatRatio(b)) && !DuoM.eatBlock(a, b);   // 2.7 «Засада»: the first bite needs only ×1.1

  let mode = save.mode;
  const splitRules = () => dailyIs('splitonly');
  const playerMaxParts = () => splitRules() ? 10 : Math.min(10, 4 + U.splitmax);
  const playerMergeTime = () => (splitRules() ? 8 : 14) * (1 - 0.03 * U.merge);
  const playerSplitCd = () => splitRules() ? 3 : SPLIT_CD;
  const fmtBest = (m, v) => {
    if (!v) return LOWER_BETTER[m] ? '–' : m === 'team' ? '0 побед' : m === 'survival' || m === 'crown' ? '0:00' : '0';
    if (m === 'team') return `${v} побед`;
    return ['survival', 'crown'].includes(m) ? fmtTime(v) : m === 'raid' ? `${v} урона` : String(v);
  };
  const dailyIs = id => mode === 'daily' && dailyMod.id === id;
  const bossesOn = () => !(stats && stats.tutorial) && !['team', 'royale', 'raid', 'territory', 'duoback'].includes(mode);

  // ================= mass ejection =================
  const ejectGeo = new THREE.SphereGeometry(1, 16, 12);
  const ejectMat = new THREE.MeshStandardMaterial({ roughness: .25, emissiveIntensity: .6 });
  let ejects = [];
  function eject() {
    if (DuoM.server || DuoM.guest) { DuoM.act('eject'); return; }
    if (!running || paused || !player.cells.length || player.ejectCd > 0) return;
    let did = false;
    for (const c of player.cells) {
      if (c.mass < EJECT_MIN) continue;
      if (ejects.length >= MAX_EJECTS) { const old = ejects.shift(); scene.remove(old.mesh); }
      c.mass -= EJECT_COST;
      const r = cellR(c) + 1.2;
      const mesh = new THREE.Mesh(ejectGeo, ejectMat);
      mesh.scale.setScalar(radius(EJECT_MASS)); mesh.add(glowSprite((lookFor('eject') || { c: skin().color }).c, 3, .5));
      scene.add(mesh);
      const ev0 = 60 * abPow('eject');
      ejects.push({ x: c.x + c.hx * r, z: c.z + c.hz * r, vx: c.hx * ev0 + c.vx, vz: c.hz * ev0 + c.vz, mass: EJECT_MASS, age: 0, mesh });
      did = true;
    }
    if (did) { player.ejectCd = 0.12; stats.ejects++; abUsed('eject'); Sound.play('eject'); }
  }
  function clearEjects() { ejects.forEach(e => scene.remove(e.mesh)); ejects = []; }
  function updateEjects(dt) {
    const k = Math.exp(-4 * dt);
    for (let i = ejects.length - 1; i >= 0; i--) {
      const e = ejects[i];
      if (feedVirus(e)) { scene.remove(e.mesh); ejects.splice(i, 1); continue; }
      e.x += e.vx * dt; e.z += e.vz * dt; e.vx *= k; e.vz *= k; e.age += dt;
      const dc = hyp(e.x, e.z); if (dc > R - 1.5) { e.x *= (R - 1.5) / dc; e.z *= (R - 1.5) / dc; }
      for (const c of cells) {
        if (c.gone || (c.owner.isPlayer && e.age < 0.6)) continue;
        const r = cellR(c);
        if (r > 1.3 && hyp(c.x - e.x, c.z - e.z) < r) {
          c.mass += e.mass * (c.owner.isPlayer ? 1 + 0.015 * (U.digest || 0) : 1);
          scene.remove(e.mesh); ejects.splice(i, 1);
          break;
        }
      }
    }
  }

