  // ================= spikes (viruses) =================
  const VIRUS_MASS = 100, VIRUS_COUNT = 8, VIRUS_MAX = 16, VIRUS_COLOR = '#3dff6e';
  const virusCore = new THREE.SphereGeometry(1, 20, 14), virusSpike = new THREE.ConeGeometry(.2, .55, 6);
  const virusMat = new THREE.MeshStandardMaterial({ color: VIRUS_COLOR, emissive: VIRUS_COLOR, emissiveIntensity: .5, roughness: .3, transparent: true, opacity: .85 });
  const virusSpikeMat = new THREE.MeshBasicMaterial({ color: '#b6ffcb' });
  let viruses = [];
  function makeVirusMesh() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(virusCore, virusMat));
    const n = 16;
    for (let i = 0; i < n; i++) {   // spikes on a fibonacci sphere
      const y = 1 - (i + .5) / n * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996;
      const dir = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
      const sp = new THREE.Mesh(virusSpike, virusSpikeMat);
      sp.position.copy(dir).multiplyScalar(1.12);
      sp.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      g.add(sp);
    }
    g.add(glowSprite(VIRUS_COLOR, 3, .5));
    scene.add(g);
    return g;
  }
  function spawnVirus(x, z, vx, vz) {
    if (viruses.length >= VIRUS_MAX) return null;
    if (x === undefined) {
      for (let t = 0; t < 30; t++) { [x, z] = randInArena(12); if (cells.every(c => Math.hypot(c.x - x, c.z - z) > cellR(c) + 8)) break; }
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
    const k = Math.exp(-2 * dt);
    for (const v of [...viruses]) {
      if (v.trap) { v.trap.ttl -= dt; if (v.trap.ttl <= 0) { removeVirus(v); continue; } }
      if (v.vx || v.vz) {
        v.x += v.vx * dt; v.z += v.vz * dt; v.vx *= k; v.vz *= k;
        if (Math.abs(v.vx) + Math.abs(v.vz) < .2) v.vx = v.vz = 0;
        const dc = Math.hypot(v.x, v.z); if (dc > R - 5) { v.x *= (R - 5) / dc; v.z *= (R - 5) / dc; v.vx = v.vz = 0; }
      }
      const rv = radius(v.mass);
      for (const c of cells) {
        if (c.gone || c.mass < v.mass * 1.3) continue;   // small blobs hide behind spikes; bosses get popped too
        if (v.trap && (c.owner === v.trap.owner || (v.trap.owner.team && c.owner.team === v.trap.owner.team))) continue;   // a trap spares its owner and allies
        if (abOn('x_ghost', c.owner) || abOn('shrink', c.owner) || c.owner.spawnSh > 0) continue;   // «Фантом» and «Сжатие» pass spikes
        if (Math.hypot(c.x - v.x, c.z - v.z) < cellR(c) - rv * .3) {
          popCell(c, v); removeVirus(v); if (!v.trap) virusRespawn.push(10); rebuildCells(); break;
        }
      }
    }
    virusRespawn = virusRespawn.map(t => t - dt).filter(t => { if (t <= 0) { spawnVirus(); return false; } return true; });
  }
  // ejected blobs feed a spike; every 5th shot fires a new spike in that direction
  function feedVirus(e) {
    for (const v of viruses) {
      if (Math.hypot(e.x - v.x, e.z - v.z) > radius(v.mass) + .5) continue;
      v.feed++; v.mass += 6;
      if (v.feed >= 5) {
        v.feed = 0; v.mass = VIRUS_MASS;
        const d = Math.hypot(e.vx, e.vz) || 1, dx = e.vx / d || 1, dz = e.vz / d;
        spawnVirus(v.x + dx * radius(VIRUS_MASS) * 2.2, v.z + dz * radius(VIRUS_MASS) * 2.2, dx * 60, dz * 60);
        emit(v.x, 3, v.z, VIRUS_COLOR, 16, 12, .5);
      }
      return true;
    }
    return false;
  }

  // ================= arena events =================
  const EVENTS = [
    { id: 'meteor',    name: 'Метеоритный дождь',     desc: 'в отмеченную зону падает много еды', color: '#ffd23f' },
    { id: 'blackhole', name: 'Чёрная дыра',           desc: 'центр арены затягивает всех к себе', color: '#b26bff' },
    { id: 'storm',     name: 'Гравитационный шторм',  desc: 'все капли на 40% быстрее',          color: '#22e6ff' },
    { id: 'eclipse',   name: 'Затмение',              desc: 'темнота, видно только ближайших',   color: '#ff3d6e' },
  ];
  const ev = { timer: 45, active: null, warn: null, left: 0, x: 0, z: 0, tick: 0 };
  const evInfo = id => EVENTS.find(e => e.id === id);
  const meteorRing = new THREE.Mesh(new THREE.RingGeometry(.95, 1, 96), decal(new THREE.MeshBasicMaterial({ color: '#ffd23f', transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  meteorRing.rotation.x = -Math.PI / 2; meteorRing.position.y = .1; meteorRing.visible = false; scene.add(meteorRing);
  const hole = new THREE.Group();
  hole.add(new THREE.Mesh(new THREE.SphereGeometry(5, 24, 16), new THREE.MeshBasicMaterial({ color: '#000000' })));
  const holeRing = new THREE.Mesh(new THREE.TorusGeometry(7.5, .5, 8, 64), new THREE.MeshBasicMaterial({ color: '#b26bff', transparent: true, blending: THREE.AdditiveBlending }));
  holeRing.rotation.x = Math.PI / 2 - .3; hole.add(holeRing); hole.add(glowSprite('#7b3dff', 34, .7));
  hole.position.y = 5; hole.visible = false; scene.add(hole);
  function resetEvents() { ev.timer = 45; ev.active = ev.warn = null; meteorRing.visible = hole.visible = false; }
  function updateEvent(dt) {
    if (!ev.active) {
      ev.timer -= dt;
      if (ev.timer <= 5 && !ev.warn) {
        ev.warn = EVENTS[Math.floor(Math.random() * EVENTS.length)].id;
        toast(`Через 5 с: ${evInfo(ev.warn).name}`);
        if (ev.warn === 'meteor') { [ev.x, ev.z] = randInArena(40); meteorRing.position.x = ev.x; meteorRing.position.z = ev.z; meteorRing.visible = true; }
      }
      if (ev.timer <= 0) {
        ev.active = ev.warn; ev.warn = null; ev.left = 20; ev.tick = 0;
        toast(`${evInfo(ev.active).name}: ${evInfo(ev.active).desc}`);
        hole.visible = ev.active === 'blackhole';
      }
      return;
    }
    ev.left -= dt; ev.tick -= dt;
    if (ev.active === 'meteor' && ev.tick <= 0) {
      ev.tick = .4; burstFood(ev.x, ev.z, 22, 22);
      for (let i = 0; i < 3; i++) emit(ev.x + (Math.random() - .5) * 40, 28, ev.z + (Math.random() - .5) * 40, '#ffd23f', 2, 3, 1);
    }
    if (ev.active === 'blackhole') {
      for (const c of cells) {
        const d = Math.hypot(c.x, c.z) || 1, pull = (2 + 10 * Math.max(0, 1 - d / (R * .9))) * dt;
        c.x -= c.x / d * pull; c.z -= c.z / d * pull;
      }
      if (Math.random() < .6) { const a = Math.random() * 6.283, r = 10 + Math.random() * 20; emit(Math.cos(a) * r, 2, Math.sin(a) * r, '#b26bff', 1, 2, .8); }
    }
    if (ev.left <= 0) { ev.active = null; ev.timer = 60; meteorRing.visible = hole.visible = false; }
  }

  // ================= owners & cells =================
  function makeOwner(name, kind, persona) {
    return { name, kind, persona, isPlayer: kind === 'player', cells: [], respawn: 0, think: 0, tx: 0, tz: 0, target: null, partner: null, dashT: 0, dashCd: 0, splitCd: 0, free: [] };
  }
  const player = makeOwner('Ты', 'player', null);
  const playerVis = Array.from({ length: 10 }, () => makeVis(C('--me')));
  player.free = playerVis.slice();
  const freeVis = player.free;
  const refreshSkin = () => { playerVis.forEach(v => applySkin(v)); if (typeof applyAura === 'function') applyAura(); };   // forEach would pass the index as the skin
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
    giant:    { name: 'Громила',   color: '#c2416b', speed: .78, life: 90, parts: 1, coins: 20, xp: 30, mass: p => Math.min(BOSS_MASS_CAP, Math.max(220, p * 1.4)), about: 'огромный и медленный' },
    hunter:   { name: 'Шустрик',   color: '#ff6b3d', speed: 1.2, life: 70, parts: 1, coins: 15, xp: 25, mass: p => Math.min(BOSS_MASS_CAP, Math.max(90, p * 1.5)),  about: 'быстрый, охотится на тебя и делает рывки' },
    queen:    { name: 'Матка роя', color: '#9b5de5', speed: .7,  life: 90, parts: 1, coins: 15, xp: 25, mass: p => Math.min(BOSS_MASS_CAP, Math.max(180, p * 1.35)), about: 'выпускает прислужников, при гибели рассыпает еду' },
    teleport: { name: 'Телепорт',  color: '#22e6ff', speed: .9,  life: 80, parts: 1, coins: 20, xp: 30, mass: p => Math.min(BOSS_MASS_CAP, Math.max(150, p * 1.4)), about: 'исчезает и появляется рядом с тобой' },
    chameleon:{ name: 'Мимик',     color: '#3dffa2', speed: .95, life: 80, parts: 1, coins: 25, xp: 35, mass: p => Math.min(BOSS_MASS_CAP, Math.max(150, p * 1.4)), about: 'невидим, пока не подплывёшь близко' },
    splitter: { name: 'Делитель',  color: '#2ec4b6', speed: .85, life: 90, parts: 6, coins: 25, xp: 35, mass: p => Math.min(BOSS_MASS_CAP, Math.max(240, p * 1.5)), about: 'делится на части, чтобы ловить добычу' },
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
  const MINION_COLOR = '#c9a7ff';
  const minions = Array.from({ length: 6 }, () => {
    const o = makeOwner('Прислужник', 'minion', 'aggressive');
    o.free = [makeVis(new THREE.Color(MINION_COLOR))];
    return o;
  });
  const owners = [player, ...bots, ...bossOwners, colossus, ...minions];
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
    c.gone = true;
    o.cells.splice(o.cells.indexOf(c), 1);
    c.vis.mesh.visible = c.vis.ring.visible = false;
    c.vis.shield.visible = false;
    o.free.push(c.vis);
  }
  function safeSpot(minDist) {
    for (let t = 0; t < 50; t++) {
      const [x, z] = randInArena(6);
      if (cells.every(c => Math.hypot(c.x - x, c.z - z) > minDist + cellR(c))) return [x, z];
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
    if (mode !== 'survival') return 2;
    return stats.wave >= 10 ? 4 : stats.wave >= 5 ? 3 : 2;
  }
  function spawnBoss() {
    const active = bossOwners.filter(o => o.cells.length);
    if (active.length >= maxBosses()) return false;
    const surv = mode === 'survival';
    const dupesOk = surv && stats.wave >= 5;
    let pool = bossOwners.filter(o => !o.cells.length && (dupesOk || !active.some(a => a.bossType === o.bossType)));
    // one owner per kind unless duplicates are allowed
    if (!dupesOk) pool = pool.filter((o, i, arr) => arr.findIndex(x => x.bossType === o.bossType) === i);
    if (pool.length > 1) pool = pool.filter(o => o.bossType !== lastBoss);
    if (!pool.length) return false;
    const o = pool[Math.floor(Math.random() * pool.length)], b = BOSS_TYPES[o.bossType];
    let mass = b.mass(total(player));
    if (surv) {
      // 2.5: every wave is 12% heavier (was 25%: a wall after wave 10), and always clearly bigger than the player's largest part
      const biggest = Math.max(0, ...player.cells.map(c => c.mass));
      mass = Math.min(SURV_BOSS_CAP, Math.max(mass, biggest * 1.4) * ModeX.survGrow(stats.wave));
    }
    const [x, z] = safeSpot(30);
    addCell(o, x, z, mass, o.free.pop());
    o.wave = stats.wave || 1;
    o.tpT = 5;
    o.life = b.life * (surv ? 1.5 : 1); o.think = 0; o.target = null; o.dashT = 0; o.dashCd = 3; o.spawnT = 4;
    lastBoss = o.bossType;
    rebuildCells();
    toast(surv ? `Волна ${stats.wave}: ${b.name}` : `Босс ${b.name}: ${b.about}`); Sound.play('boss');
    return true;
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
      if (Math.hypot(fx, fz) > R - 1.5) continue;
      foods[i] = { x: fx, z: fz }; fgSet(i); foodHook(i);
      dummy.position.set(fx, 0.35, fz); dummy.updateMatrix(); foodMesh.setMatrixAt(i, dummy.matrix);
    }
    foodMesh.instanceMatrix.needsUpdate = true;
  }

  // ================= round state =================
  let running = false, paused = false, dying = false, lives = 0, dashCdBase = 4;
  let bossTimer = 20, bonusTimer = 0;
  let stats, history, doneQuests, effects, bonuses = [];
  const effectDur = t => BONUS[t].dur * (1 + 0.05 * (U.bonus || 0)) * (arenaIs('sakura') ? 1.25 : 1) * (1 + starBonus('bonus') / 100);

  function speedOf(c) {
    const o = c.owner;
    let v = BASE_SPEED * Math.pow(c.mass / START_MASS, -0.15);
    if (o.isPlayer || o.kind === 'rival') {   // the second player of a match for two moves exactly like you (no upgrades: they are off in modes for two)
      // during a dash the mass slowdown is ignored: always 3.2x the starting speed
      if (o.dashT > 0) v = BASE_SPEED * DASH_MULT * Math.pow(Math.max(1, c.mass / START_MASS), -0.1);   // 1.7.0: a big blob's dash is weaker
      if (o.isPlayer) v *= (1 + 0.01 * U.speed) * (effects.speed > 0 ? 1.45 : 1) * (1 + 0.02 * petLv('speed')) * (abOn('shrink') ? ABIL_CFG.shrinkSpeed : 1);
      else v *= abOn('shrink', o) ? ABIL_CFG.shrinkSpeed : 1;
      v *= (o.freezeT > 0 ? .05 : 1) * (o.slowT > 0 ? ABIL_CFG.slowFactor : 1) * (DuoM.speedK ? DuoM.speedK(c) : 1);   // bots' «Ледяная волна», «Метеорный удар», «Замедляющая волна», «Якорь»
    }
    else if (o.freezeT > 0) v *= .05;
    else if (o.slowT > 0) v *= ABIL_CFG.slowFactor * (o.kind === 'boss' ? bossInfo(o).speed : 1);
    else if (o.kind === 'boss') v *= bossInfo(o).speed * (o.dashT > 0 ? 2 : 1) * (o.stunT > 0 ? .4 : 1);
    else if (o.kind === 'minion') v *= 1.05;
    else v *= (o.star ? 1 : botSkill().speed) * (o.dashT > 0 ? 1.9 : 1) * (abOn('shrink', o) ? ABIL_CFG.shrinkSpeed : 1);
    return v * (dailyIs('speedy') ? 1.3 : 1) * (arenaIs('cyber') ? 1.1 : 1) * (ev.active === 'storm' ? 1.4 : 1) * ModeX.botSpeedK(o);
  }
  const eatRatio = c => c.owner.isPlayer ? 1.25 + 0.01 * U.guard : 1.25;
  const canEat = (a, b) => !(b.owner.spawnSh > 0) && !(abOn('shrink', a.owner) || abOn('x_ghost', a.owner)) && !((b.owner.isPlayer && effects.shield > 0) || abOn('shield', b.owner) || abOn('x_ghost', b.owner)) && !(a.owner.team && a.owner.team === b.owner.team) && a.mass > b.mass * eatRatio(b) && !DuoM.eatBlock(a, b);

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
    if (DuoM.guest) { DuoM.act('eject'); return; }
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
      const dc = Math.hypot(e.x, e.z); if (dc > R - 1.5) { e.x *= (R - 1.5) / dc; e.z *= (R - 1.5) / dc; }
      for (const c of cells) {
        if (c.gone || (c.owner.isPlayer && e.age < 0.6)) continue;
        const r = cellR(c);
        if (r > 1.3 && Math.hypot(c.x - e.x, c.z - e.z) < r) {
          c.mass += e.mass * (c.owner.isPlayer ? 1 + 0.015 * (U.digest || 0) : 1);
          scene.remove(e.mesh); ejects.splice(i, 1);
          break;
        }
      }
    }
  }

