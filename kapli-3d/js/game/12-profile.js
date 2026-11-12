  // ================= profile =================
  // ===== 1.7.0: profile showcase — background, avatar frame, title and badge, freely combined =====
  // backgrounds are drawn in code (canvas), animated; the rarest ones come from the top tiers of both leagues
  const PBG = [
    { id: 'bg_base',     name: 'Ночная сетка',        rar: 'common',    src: 'есть у всех',                                   test: () => true },
    { id: 'bg_nebula',   name: 'Туманность',          rar: 'rare',      src: '10-й уровень',                                  test: () => playerLevel() >= 10 },
    { id: 'bg_synth',    name: 'Синтвейв',            rar: 'rare',      src: '25-й уровень',                                  test: () => playerLevel() >= 25 },
    { id: 'bg_crystal',  name: 'Кристальный грот',    rar: 'epic',      src: '50-й уровень',                                  test: () => playerLevel() >= 50 },
    { id: 'bg_hunter',   name: 'Охотничий радар',     rar: 'epic',      src: 'линейка «Охотник», III ступень',                test: () => save.ach.includes('ln_hunter') },
    { id: 'bg_storm',    name: 'Электрошторм',        rar: 'epic',      src: 'линейка «Комбо», III ступень',                  test: () => save.ach.includes('ln_combo') },
    { id: 'bg_abyss',    name: 'Бездна гиганта',      rar: 'epic',      src: 'линейка «Исполин», III ступень',                test: () => save.ach.includes('ln_giant') },
    { id: 'bg_starfall', name: 'Звездопад',           rar: 'legendary', src: 'легендарное «Гроза звёзд I»',                   test: () => save.legendDone.includes('stars1') },
    { id: 'bg_sakura',   name: 'Неоновая сакура',     rar: 'epic',      src: 'коллекция «Первое полугодие»',                  test: () => save.colDone.includes('col_q1') },
    { id: 'bg_city',     name: 'Неоновый город',      rar: 'epic',      src: 'коллекция «Второе полугодие»',                  test: () => save.colDone.includes('col_q2') },
    { id: 'bg_blueprint', name: 'Чертёж',             rar: 'epic',      src: 'коллекция «Арсенал»',                           test: () => save.colDone.includes('col_arsenal') },
    { id: 'bg_aurora',   name: 'Северное сияние',     rar: 'epic',      src: 'праздничная коллекция «Новый год»',             test: () => save.colDone.includes('col_hol_newyear') },
    { id: 'bg_wisteria', name: 'Глициния',            rar: 'epic',      src: 'праздничная коллекция «День влюблённых»',       test: () => save.colDone.includes('col_hol_valentine') },
    { id: 'bg_maple',    name: 'Неоновый клён',       rar: 'epic',      src: 'праздничная коллекция «Хэллоуин»',              test: () => save.colDone.includes('col_hol_halloween') },
    { id: 'bg_lotus',    name: 'Ночной лотос',        rar: 'epic',      src: 'линейка «Выживший», III ступень',               test: () => save.ach.includes('ln_surv') },
    { id: 'bg_fireflies', name: 'Светлячковый лес',   rar: 'epic',      src: 'линейка «Сезоны», III ступень (26 значков)',     test: () => save.ach.includes('ln_season') },
    { id: 'bg_bamboo',   name: 'Бамбуковая роща',     rar: 'legendary', src: 'мастерство «Легенда» во всех режимах',          test: () => MODE_IDS.every(id => masteryLv((save.mastery || {})[id] || 0) >= MASTERY_LV.length) },
    { id: 'bg_colossus', name: 'Логово колосса',      rar: 'epic',      src: 'победа над боссом рейда',                       test: () => (save.raidWins || 0) >= 1 },
    { id: 'bg_neon',     name: 'Неоновый трон',       rar: 'legendary', top: 'league', src: 'лига: дойди до «Неона»',          test: () => (save.totals.maxLeague || 0) >= 5 },
    { id: 'bg_champion', name: 'Зал чемпионов',       rar: 'legendary', top: 'league', src: 'особый значок «Чемпион Неона» (6 сезонов в «Неоне»)', test: () => !!(save.badges || {}).neonchamp },
    { id: 'bg_sing',     name: 'Сингулярность',       rar: 'legendary', top: 'chaos',  src: 'Хаос-лига: дойди до «Сингулярности»', test: () => (save.totals.chaosMax || 0) >= 5 },
    { id: 'bg_rift',     name: 'Разлом времени',      rar: 'legendary', top: 'chaos',  src: 'Хаос-лига: 10 сезонов в «Сингулярности»', test: () => (save.chaosTop || 0) >= 10 },
    { id: 'bg_creator',  name: 'Мастерская создателя', rar: 'legendary', promo: true, src: 'промокод «Создатель»',            test: () => !!(save.badges || {}).creator },
    { id: 'bg_beta',     name: 'Голограмма',          rar: 'legendary', promo: true, src: 'промокод «Бета-тестер»',           test: () => !!(save.badges || {}).beta },
    { id: 'bg_ps_const', name: 'Созвездие',           rar: 'legendary', src: 'престиж ★18',  test: () => psReached(prestigeOf(save.xp), 1, 18) },
    { id: 'bg_ps_nova',  name: 'Вспышка сверхновой',  rar: 'legendary', src: 'престиж ✦20',  test: () => psReached(prestigeOf(save.xp), 2, 20) },
    { id: 'bg_ps_gal',   name: 'Галактика',           rar: 'legendary', src: 'престиж ✦25',  test: () => psReached(prestigeOf(save.xp), 2, 25) },
    { id: 'bg_vet',      name: 'Пульс жизни',         rar: 'legendary', promo: true, src: 'промокод «Ветврач»',               test: () => !!(save.badges || {}).vet },
    { id: 'bg_goat27',   name: 'Год Огненной Козы',   rar: 'legendary', promo: true, src: 'праздничная коробка «Новый год 2027»', test: () => (save.gifts || []).includes('ny2027') },
    { id: 'bg_horse26',  name: 'Год Огненной Лошади', rar: 'legendary', promo: true, src: 'особый праздничный подарок', test: () => false },   // drawn and kept for a later gift
  ];
  const pbgById = id => PBG.find(b => b.id === id) || PBG[0];
  // ---- drawing: every background is a function of (ctx, w, h, t seconds); random layouts are seeded, so a scene is the same every frame ----
  const pbgSeeds = {};
  const pbgPts = (key, n, seed) => pbgSeeds[key] || (pbgSeeds[key] = (() => { let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; return Array.from({ length: n }, () => ({ x: r(), y: r(), s: r(), p: r() * 6.28, q: r() })); })());
  const pbgHorse = {};
  // «Год Огненной Козы» (丁未, 6 Feb 2027 – 25 Jan 2028): New Year 2027 gift box background; stateless, drawn by pbgDraw
  const drawGoatBg = (() => {
  const seeded = (n, seed) => { let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; return Array.from({ length: n }, () => ({ x: r(), y: r(), s: r(), p: r() * 6.28, q: r() })); };
  const STARS = seeded(70, 211), PETALS = seeded(34, 307), EMB = seeded(24, 401);
  let BODY, HEAD, HORN, BEARD;
  const paths = () => {
    if (BODY) return;
    // the goat: 400×260 box, facing right, standing on a rock; the head is drawn apart so it can nod
    BODY = new Path2D('M122 118 C134 98 178 92 216 95 C238 97 254 99 266 94 C272 92 278 94 282 100 C286 112 284 128 278 142 C272 158 262 166 248 168 C214 172 170 172 140 166 C120 162 108 150 110 136 C111 128 115 122 122 118 Z');
    HEAD = new Path2D('M266 96 C268 80 274 66 286 58 C298 52 312 56 318 68 C324 80 322 92 314 98 C306 104 296 104 288 108 C280 110 270 106 266 96 Z');
    HORN = new Path2D('M286 60 C280 36 258 26 244 38 C232 48 238 66 252 66 C262 66 266 56 260 50');
    BEARD = new Path2D('M308 98 C312 108 314 118 310 128 C304 118 300 108 300 100 Z');
  };
  const glowDot = (x, cx, cy, r, col, a = 1) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = a; x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); x.globalAlpha = 1; };
  return function draw(x, w, h, t) {
    paths();
    const W = w, H = h, U = Math.min(w, h);
    // night sky warming to crimson at the horizon
    const sky = x.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#0b0418'); sky.addColorStop(.55, '#2a0a24'); sky.addColorStop(.78, '#4a1020'); sky.addColorStop(1, '#12040c');
    x.fillStyle = sky; x.fillRect(0, 0, W, H);
    for (const s of STARS) { x.globalAlpha = .25 + .65 * Math.abs(Math.sin(t * (.5 + s.s) + s.p)); x.fillStyle = '#fff1e0'; const r = s.s > .9 ? 1.8 : 1; x.fillRect(s.x * W, s.y * H * .5, r, r); } x.globalAlpha = 1;
    // a big warm moon behind the goat
    glowDot(x, W * .66, H * .3, U * .42, 'rgba(255,170,90,.18)');
    const mg = x.createRadialGradient(W * .66 - U * .04, H * .27, U * .02, W * .66, H * .3, U * .17); mg.addColorStop(0, '#fff3d6'); mg.addColorStop(.7, '#ffcf8a'); mg.addColorStop(1, '#ff9a4a');
    x.fillStyle = mg; x.beginPath(); x.arc(W * .66, H * .3, U * .17, 0, 6.3); x.fill();
    // fireworks: one burst every 3.2 s, place and colour fixed by the burst number
    { const n = Math.floor(t / 3.2), tau = t - n * 3.2; if (tau < 1.4) { const hs = k => { const v = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
      const cx = W * (.3 + hs(1) * .65), cy = H * (.08 + hs(2) * .22), col = ['#ffd23f', '#ff4f6a', '#ff9a3d', '#ffe6a8'][Math.floor(hs(3) * 4)], r = H * .26 * (1 - Math.exp(-1.8 * tau)) / 1.8, dy = H * .05 * tau * tau;
      x.globalAlpha = 1 - tau / 1.4; x.fillStyle = col; for (let i = 0; i < 40; i++) { const a = i / 40 * 6.283; x.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r + dy, 2.2, 2.2); } x.globalAlpha = 1; } }
    // lanterns on a string
    x.strokeStyle = 'rgba(255,210,63,.35)'; x.lineWidth = 1; x.beginPath(); x.moveTo(0, H * .05); x.quadraticCurveTo(W * .5, H * .16, W, H * .04); x.stroke();
    for (let i = 0; i < 6; i++) { const u = (i + .5) / 6, ax = u * W, ay = H * .05 + Math.sin(u * Math.PI) * H * .1 * (1 - Math.abs(u - .5) * .2), sw = Math.sin(t * 1.3 + i) * .12, L = H * .06, lx = ax + Math.sin(sw) * L, ly = ay + Math.cos(sw) * L, R = H * .045;
      x.strokeStyle = 'rgba(255,210,63,.5)'; x.beginPath(); x.moveTo(ax, ay); x.lineTo(lx, ly - R); x.stroke(); glowDot(x, lx, ly, R * 2.6, 'rgba(255,60,40,.45)');
      x.fillStyle = '#d4182c'; x.beginPath(); x.ellipse(lx, ly, R * .85, R, 0, 0, 6.3); x.fill(); x.fillStyle = '#ffd23f'; x.fillRect(lx - R * .45, ly - R * 1.05, R * .9, R * .18); x.fillRect(lx - R * .45, ly + R * .88, R * .9, R * .18);
      x.strokeStyle = 'rgba(255,190,90,.6)'; x.beginPath(); x.moveTo(lx, ly - R); x.lineTo(lx, ly + R); x.stroke(); x.beginPath(); x.moveTo(lx, ly + R * 1.1); x.lineTo(lx, ly + R * 1.6); x.stroke(); }
    // mountains: two layers with neon snow rims
    const ridge = (base, amp, seed, col, rim) => { x.beginPath(); x.moveTo(0, H); for (let i = 0; i <= 24; i++) { const u = i / 24, v = Math.sin(u * 9.1 + seed) * .5 + Math.sin(u * 23.7 + seed * 2) * .25; x.lineTo(u * W, H * (base - amp * (.5 + v))); } x.lineTo(W, H); x.closePath(); x.fillStyle = col; x.fill();
      x.save(); x.clip(); x.strokeStyle = rim; x.lineWidth = 1.5; x.shadowColor = rim; x.shadowBlur = 8; x.beginPath(); for (let i = 0; i <= 24; i++) { const u = i / 24, v = Math.sin(u * 9.1 + seed) * .5 + Math.sin(u * 23.7 + seed * 2) * .25; const yy = H * (base - amp * (.5 + v)); i ? x.lineTo(u * W, yy) : x.moveTo(u * W, yy); } x.stroke(); x.restore(); };
    ridge(.74, .16, 1.3, '#2a0b2c', 'rgba(255,160,200,.55)');
    ridge(.86, .1, 4.1, '#16061a', 'rgba(255,120,80,.5)');
    // year glyphs on the left
    x.save(); x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `700 ${H * .42}px "Noto Serif SC", "SimSun", serif`; x.fillStyle = 'rgba(255,210,63,.13)'; x.shadowColor = '#ffd23f'; x.shadowBlur = 30; x.fillText('未', W * .17, H * .4);
    x.font = `700 ${H * .07}px "Noto Serif SC", "SimSun", serif`; x.fillStyle = 'rgba(255,210,63,.78)'; x.shadowBlur = 12; x.fillText('丁 未', W * .17, H * .72); x.restore();
    // the rock the goat stands on
    const S = Math.min(W * .48, H * .9), gx = W * .62, gy = H * .74, k = S / 400;
    x.save(); x.translate(gx, gy); x.scale(k, k); x.translate(-200, -230);
    const rock = new Path2D('M78 236 C96 220 122 210 148 212 C176 214 196 222 226 220 C256 218 292 208 322 216 C340 222 352 232 358 246 L372 262 L366 286 L390 320 L402 360 L30 360 L48 318 L40 292 L62 268 Z');
    const rg = x.createLinearGradient(0, 205, 0, 360); rg.addColorStop(0, '#3a1430'); rg.addColorStop(1, '#0c0310'); x.fillStyle = rg; x.fill(rock);
    x.strokeStyle = '#ff7a3d'; x.lineWidth = 3; x.shadowColor = '#ff7a3d'; x.shadowBlur = 14; x.stroke(rock); x.shadowBlur = 0;
    x.strokeStyle = 'rgba(255,122,61,.35)'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(120, 240); x.lineTo(132, 270); x.lineTo(124, 300); x.moveTo(262, 236); x.lineTo(250, 266); x.lineTo(268, 296); x.lineTo(258, 330); x.moveTo(330, 250); x.lineTo(338, 280); x.stroke();
    // legs (behind) — slight weight shift
    const shift = Math.sin(t * 1.4) * 1.5;
    const leg = (lx, top, near) => { x.save(); x.lineCap = 'round'; x.strokeStyle = near ? '#3a0c18' : '#24060e'; x.lineWidth = 13; x.beginPath(); x.moveTo(lx, top); x.lineTo(lx + shift * .3, 214); x.stroke();
      x.strokeStyle = near ? '#ffb347' : 'rgba(255,179,71,.5)'; x.lineWidth = 2.5; x.shadowColor = '#ffb347'; x.shadowBlur = near ? 10 : 4; x.beginPath(); x.moveTo(lx - 5, top); x.lineTo(lx - 4 + shift * .3, 212); x.moveTo(lx + 5, top); x.lineTo(lx + 4 + shift * .3, 212); x.stroke();
      x.fillStyle = near ? '#ffd23f' : 'rgba(255,210,63,.5)'; x.shadowColor = '#ffd23f'; x.beginPath(); x.ellipse(lx + shift * .3, 216, 7, 4, 0, 0, 6.3); x.fill(); x.restore(); };
    leg(140, 158, false); leg(238, 160, false);
    // body with a soft breath
    const br = 1 + Math.sin(t * 1.8) * .012;
    x.save(); x.translate(190, 150); x.scale(1, br); x.translate(-190, -150);
    const bg = x.createLinearGradient(110, 90, 290, 170); bg.addColorStop(0, '#4a0c1c'); bg.addColorStop(.6, '#250610'); bg.addColorStop(1, '#3a0a18');
    x.fillStyle = bg; x.fill(BODY);
    x.save(); x.clip(BODY); const ig = x.createRadialGradient(210, 120, 10, 210, 120, 140); ig.addColorStop(0, 'rgba(255,120,50,.3)'); ig.addColorStop(1, 'rgba(255,120,50,0)'); x.fillStyle = ig; x.fillRect(100, 80, 200, 100); x.restore();
    // woolly curls on the body
    x.strokeStyle = 'rgba(255,170,130,.35)'; x.lineWidth = 2; for (let i = 0; i < 9; i++) { const cx = 135 + i * 16, cy = 118 + (i % 2) * 14; x.beginPath(); x.arc(cx, cy, 6, Math.PI * .2, Math.PI * 1.6); x.stroke(); }
    x.strokeStyle = '#ff8a3d'; x.lineWidth = 4.5; x.lineJoin = 'round'; x.shadowColor = '#ff6a2a'; x.shadowBlur = 20; x.stroke(BODY); x.strokeStyle = '#ffe2c8'; x.lineWidth = 1.5; x.shadowBlur = 5; x.stroke(BODY); x.shadowBlur = 0;
    x.restore();
    // tail: a small flame that flicks
    x.save(); x.globalCompositeOperation = 'lighter'; const fl = Math.sin(t * 7) * 6;
    const tg = x.createLinearGradient(118, 120, 92, 100); tg.addColorStop(0, 'rgba(255,230,120,.95)'); tg.addColorStop(1, 'rgba(255,60,40,0)');
    x.fillStyle = tg; for (let j = 0; j < 3; j++) { const f2 = Math.sin(t * 8 + j * 2) * 5; x.beginPath(); x.moveTo(124, 124 + j * 3); x.quadraticCurveTo(100 - j * 4, 110 + fl + f2, 86 - j * 6, 92 + fl + j * 6); x.quadraticCurveTo(106, 108 + j * 2, 120, 118 + j * 3); x.fill(); } x.restore();
    leg(170, 162, true); leg(268, 156, true);
    // head: grazes calmly — every 7 s it lowers and lifts again
    const cyc = (t % 7) / 7, nod = cyc < .55 ? 0 : Math.sin((cyc - .55) / .45 * Math.PI) * .32, ear = Math.sin(t * 3.1) > .96 ? .3 : 0;
    x.save(); x.translate(270, 100); x.rotate(nod); x.translate(-270, -100);
    const hg = x.createLinearGradient(266, 56, 322, 108); hg.addColorStop(0, '#4a0c1c'); hg.addColorStop(1, '#250610'); x.fillStyle = hg; x.fill(HEAD);
    x.strokeStyle = '#ff8a3d'; x.lineWidth = 4; x.shadowColor = '#ff6a2a'; x.shadowBlur = 18; x.stroke(HEAD); x.shadowBlur = 0;
    x.fillStyle = 'rgba(255,200,170,.25)'; x.fill(BEARD); x.strokeStyle = '#ffd6a8'; x.lineWidth = 2; x.stroke(BEARD);
    // ear
    x.save(); x.translate(282, 66); x.rotate(-.5 - ear); x.fillStyle = '#3a0a18'; x.strokeStyle = '#ff8a3d'; x.lineWidth = 2.5; x.beginPath(); x.ellipse(-10, 0, 13, 5, 0, 0, 6.3); x.fill(); x.stroke(); x.restore();
    // golden horns, glowing
    x.lineCap = 'round'; x.strokeStyle = '#7a4a12'; x.lineWidth = 10; x.stroke(HORN);
    x.strokeStyle = '#ffd23f'; x.lineWidth = 4; x.shadowColor = '#ffd23f'; x.shadowBlur = 16; x.stroke(HORN); x.shadowBlur = 0;
    x.strokeStyle = 'rgba(255,246,200,.8)'; x.lineWidth = 1.2; x.setLineDash([3, 5]); x.stroke(HORN); x.setLineDash([]);
    // eye and nostril
    x.fillStyle = '#ffd23f'; x.shadowColor = '#ffd23f'; x.shadowBlur = 10; x.beginPath(); x.ellipse(300, 72, 4.5, 3, .3, 0, 6.3); x.fill();
    x.fillStyle = '#ff4f6a'; x.shadowBlur = 5; x.beginPath(); x.ellipse(318, 86, 2.4, 1.6, .5, 0, 6.3); x.fill(); x.shadowBlur = 0;
    x.restore();
    x.restore();
    // plum blossom petals drifting down
    for (const p of PETALS) { const per = 7 + p.s * 6, ph = ((t + p.p * 2) % per) / per, px = (p.x * 1.2 - .1) * W + Math.sin(t * 1.1 + p.p) * 16 + ph * 50, py = ph * (H + 20) - 10, rot = t * (1 + p.q) + p.p;
      x.save(); x.translate(px, py); x.rotate(rot); x.globalAlpha = .55 + p.q * .4; x.fillStyle = p.q > .5 ? '#ffb3cf' : '#ff7aa8'; x.beginPath(); x.ellipse(0, 0, 3.5, 2, 0, 0, 6.3); x.fill(); x.restore(); }
    x.globalAlpha = 1;
    // embers rising from the ground
    for (const e of EMB) { const yy = H - ((t * (20 + e.s * 30) + e.p * 60) % (H * .7)), xx = e.x * W + Math.sin(t + e.p) * 6; glowDot(x, xx, yy, 2.5 + e.q * 2, 'rgba(255,140,50,.9)', .6); }
  };
})();
  function pbgDraw(x, w, h, id, t) {
    const lin = (stops, x0 = 0, y0 = 0, x1 = 0, y1 = h) => { const g = x.createLinearGradient(x0, y0, x1, y1); stops.forEach(([o, c]) => g.addColorStop(o, c)); return g; };
    const glow = (cx, cy, r, col, a = 1) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = a; x.fillStyle = g; x.fillRect(cx - r, cy - r, r * 2, r * 2); x.globalAlpha = 1; };
    const stars = (n, seed, tw = 1, col = '#ffffff') => { for (const p of pbgPts('st' + seed, n, seed)) { x.globalAlpha = .25 + .75 * Math.abs(Math.sin(t * tw * (.5 + p.q) + p.p)); x.fillStyle = col; const r = p.s < .9 ? .8 : 1.7; x.fillRect(p.x * w, p.y * h, r, r); } x.globalAlpha = 1; };
    const U = Math.min(w, h);
    x.save(); x.globalCompositeOperation = 'source-over';
    switch (id) {
      case 'bg_synth': {
        x.fillStyle = lin([[0, '#0b0224'], [.55, '#3a0a5e'], [.56, '#12001f'], [1, '#07000f']]); x.fillRect(0, 0, w, h);
        stars(40, 12); const hz = h * .56, sr = U * .42, sx = w * .62;
        const sg = x.createLinearGradient(0, hz - sr, 0, hz); sg.addColorStop(0, '#ffd23f'); sg.addColorStop(.6, '#ff6a3d'); sg.addColorStop(1, '#ff2d95');
        x.save(); x.beginPath(); x.arc(sx, hz, sr, Math.PI, 0); x.clip(); x.fillStyle = sg; x.fillRect(sx - sr, hz - sr, sr * 2, sr);
        x.fillStyle = '#3a0a5e'; for (let i = 0; i < 6; i++) { const yy = hz - sr * .45 + i * sr * .09 + ((t * 6) % (sr * .09)); x.fillRect(sx - sr, yy, sr * 2, 1.5 + i * .9); } x.restore();
        glow(sx, hz, sr * 1.8, 'rgba(255,79,216,.35)');
        x.strokeStyle = 'rgba(255,79,216,.75)'; x.lineWidth = 1.2;
        for (let i = -12; i <= 12; i++) { x.beginPath(); x.moveTo(w / 2 + i * w * .04, hz); x.lineTo(w / 2 + i * w * .3, h); x.stroke(); }
        for (let i = 0; i < 9; i++) { const k = ((i + (t * .6) % 1) / 9) ** 2, yy = hz + k * (h - hz); x.globalAlpha = .3 + k; x.beginPath(); x.moveTo(0, yy); x.lineTo(w, yy); x.stroke(); } x.globalAlpha = 1; break; }
      case 'bg_hunter': {
        x.fillStyle = lin([[0, '#14020c'], [1, '#2a0420']]); x.fillRect(0, 0, w, h);
        const cx = w * .74, cy = h * .5, R = U * .62; x.strokeStyle = 'rgba(255,61,110,.35)'; x.lineWidth = 1;
        for (let i = 1; i <= 4; i++) { x.beginPath(); x.arc(cx, cy, R * i / 4, 0, 6.29); x.stroke(); }
        x.beginPath(); x.moveTo(cx - R, cy); x.lineTo(cx + R, cy); x.moveTo(cx, cy - R); x.lineTo(cx, cy + R); x.stroke();
        const a = t * 1.4; x.globalCompositeOperation = 'lighter';
        for (let k = 0; k < 24; k++) { x.globalAlpha = .4 * (1 - k / 24); x.fillStyle = '#ff3d6e'; x.beginPath(); x.moveTo(cx, cy); x.arc(cx, cy, R, a - k * .03 - .03, a - k * .03); x.closePath(); x.fill(); }
        x.globalAlpha = 1;
        for (const p of pbgPts('hb', 4, 19)) { const ang = p.p, dd = (.3 + p.q * .6) * R, bx = cx + Math.cos(ang) * dd, by = cy + Math.sin(ang) * dd, hit = ((a - ang) % 6.283 + 6.283) % 6.283; if (hit < 1.2) glow(bx, by, 10 + (1.2 - hit) * 6, `rgba(255,120,150,${(1.2 - hit) / 1.2})`); }
        for (const p of pbgPts('he', 40, 21)) { const yy = h - ((t * (14 + p.s * 20) + p.y * h) % (h + 20)); glow(p.x * w * .7, yy, 3 + p.s * 3, 'rgba(255,106,0,.9)', .7); } break; }
      case 'bg_storm': {
        x.fillStyle = lin([[0, '#020818'], [1, '#081a3a']]); x.fillRect(0, 0, w, h);
        x.globalCompositeOperation = 'lighter';
        for (const p of pbgPts('sc', 7, 23)) glow((p.x + Math.sin(t * .1 + p.p) * .05) * w, p.y * h * .5, U * (.35 + p.s * .3), 'rgba(77,124,255,.22)');
        const k = Math.floor(t / 1.7), ph = t / 1.7 - k, a = Math.max(0, 1 - ph * 4);
        if (a > 0) { let s = k * 7919 + 13; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
          x.fillStyle = `rgba(160,200,255,${a * .15})`; x.fillRect(0, 0, w, h);
          const bolt = (bx, by, len, ang, width) => { x.beginPath(); x.moveTo(bx, by); let cx = bx, cy = by; for (let i = 0; i < 9; i++) { cx += Math.cos(ang) * len / 9 + (r() - .5) * 18; cy += Math.sin(ang) * len / 9; x.lineTo(cx, cy); if (r() < .25 && width > 1) { x.stroke(); bolt(cx, cy, len * .4, ang + (r() - .5) * 1.2, width * .5); x.beginPath(); x.moveTo(cx, cy); } } x.lineWidth = width; x.stroke(); };
          x.strokeStyle = `rgba(200,230,255,${a})`; x.shadowColor = '#22e6ff'; x.shadowBlur = 14; bolt(w * (.3 + r() * .5), 0, h * 1.05, Math.PI / 2 + (r() - .5) * .4, 2.4); x.shadowBlur = 0; }
        for (const p of pbgPts('sr', 50, 29)) { const yy = (p.y * h + t * 220 * (.7 + p.s * .5)) % h; x.strokeStyle = 'rgba(140,180,255,.25)'; x.lineWidth = 1; x.beginPath(); x.moveTo(p.x * w, yy); x.lineTo(p.x * w - 4, yy + 12); x.stroke(); } break; }
      case 'bg_abyss': {
        x.fillStyle = lin([[0, '#021a33'], [1, '#00050f']]); x.fillRect(0, 0, w, h);
        const cx = w * .78, cy = h * .9, R = U * .95; x.fillStyle = lin([[0, '#0a3a6e'], [1, '#010812']], 0, cy - R, 0, cy + R); x.beginPath(); x.arc(cx, cy, R, 0, 6.29); x.fill();
        x.strokeStyle = 'rgba(34,230,255,.6)'; x.lineWidth = 2; x.shadowColor = '#22e6ff'; x.shadowBlur = 16; x.beginPath(); x.arc(cx, cy, R, Math.PI * 1.05, Math.PI * 1.7); x.stroke(); x.shadowBlur = 0;
        x.globalCompositeOperation = 'lighter'; x.lineWidth = 1.2;
        for (let i = 0; i < 7; i++) { x.strokeStyle = `rgba(120,230,255,${.12 + .05 * (i % 3)})`; x.beginPath(); for (let xx = 0; xx <= w; xx += 8) x.lineTo(xx, h * (.1 + i * .12) + Math.sin(xx / 40 + t * (.8 + i * .1) + i) * 6); x.stroke(); }
        for (const p of pbgPts('ab', 26, 31)) { const yy = h - ((t * (10 + p.s * 18) + p.y * h) % (h + 10)); x.strokeStyle = 'rgba(160,240,255,.6)'; x.beginPath(); x.arc(p.x * w + Math.sin(t + p.p) * 4, yy, 1.5 + p.s * 2.5, 0, 6.29); x.stroke(); } break; }
      case 'bg_starfall': {
        x.fillStyle = lin([[0, '#04011a'], [1, '#160636']]); x.fillRect(0, 0, w, h); stars(90, 37, 1.5);
        x.globalCompositeOperation = 'lighter';
        for (const p of pbgPts('mf', 9, 41)) { const per = 2.2 + p.s * 2, ph = ((t + p.p) % per) / per, sx = (p.x * 1.4 - .2) * w + ph * w * .6, sy = (p.y * .4 - .2) * h + ph * h * .9, L = 70 + p.q * 60;
          const g = x.createLinearGradient(sx, sy, sx - L, sy - L * .8); g.addColorStop(0, `rgba(255,246,200,${1 - ph})`); g.addColorStop(1, 'rgba(255,79,216,0)'); x.strokeStyle = g; x.lineWidth = 2; x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx - L, sy - L * .8); x.stroke(); glow(sx, sy, 6, `rgba(255,255,255,${1 - ph})`); }
        glow(w * .15, h * .2, U * .7, 'rgba(178,107,255,.25)'); break; }
      case 'bg_sakura': {
        x.fillStyle = lin([[0, '#1f0a17'], [1, '#0d0310']]); x.fillRect(0, 0, w, h);
        x.globalCompositeOperation = 'lighter'; glow(w * .8, h * .3, U * .9, 'rgba(255,158,196,.25)'); x.globalCompositeOperation = 'source-over';
        x.strokeStyle = '#2a0f1e'; x.lineCap = 'round'; const br = (bx, by, len, ang, wd, d) => { if (d > 5) return; const ex = bx + Math.cos(ang) * len, ey = by + Math.sin(ang) * len; x.lineWidth = wd; x.beginPath(); x.moveTo(bx, by); x.lineTo(ex, ey); x.stroke();
          if (d >= 3) { x.globalCompositeOperation = 'lighter'; glow(ex, ey, 9 + d * 2, 'rgba(255,140,190,.55)'); x.globalCompositeOperation = 'source-over'; }
          br(ex, ey, len * .72, ang - .45, wd * .7, d + 1); br(ex, ey, len * .65, ang + .4, wd * .65, d + 1); };
        br(-10, -10, U * .35, .55, 7, 0);
        for (const p of pbgPts('sk', 34, 43)) { const per = 6 + p.s * 5, ph = ((t + p.p * 2) % per) / per, px = (p.x * 1.2 - .1) * w + Math.sin(t * 1.3 + p.p) * 14 + ph * 40, py = ph * (h + 20) - 10;
          x.save(); x.translate(px, py); x.rotate(t * (1 + p.q) + p.p); x.fillStyle = p.q > .5 ? 'rgba(255,170,210,.9)' : 'rgba(255,209,232,.8)'; x.beginPath(); x.ellipse(0, 0, 4.5, 2.4, 0, 0, 6.29); x.fill(); x.restore(); } break; }
      case 'bg_city': {
        x.fillStyle = lin([[0, '#0a0018'], [.7, '#2a0a4e'], [1, '#12001f']]); x.fillRect(0, 0, w, h);
        x.globalCompositeOperation = 'lighter'; glow(w * .5, h, U, 'rgba(255,79,216,.3)'); x.globalCompositeOperation = 'source-over';
        for (const [layer, col, hk] of [[0, '#140630', .65], [1, '#08001a', .45]]) for (const p of pbgPts('cb' + layer, 18, 47 + layer)) {
          const bw = w * (.05 + p.s * .06), bh = h * (.2 + p.q * hk), bx = p.x * w, by = h - bh; x.fillStyle = col; x.fillRect(bx, by, bw, bh);
          if (layer) { for (let yy = by + 6; yy < h - 4; yy += 7) for (let xx = bx + 3; xx < bx + bw - 3; xx += 6) { const on = Math.sin(xx * 13.1 + yy * 7.7 + Math.floor(t * .5 + p.p) * 3.3) > .35; if (on) { x.fillStyle = (xx + yy) % 3 < 1.5 ? 'rgba(34,230,255,.8)' : 'rgba(255,79,216,.75)'; x.fillRect(xx, yy, 2.5, 3); } } } }
        for (const p of pbgPts('cr', 60, 53)) { const yy = (p.y * h + t * 180 * (.7 + p.s * .6)) % h; x.strokeStyle = 'rgba(160,140,255,.25)'; x.beginPath(); x.moveTo(p.x * w, yy); x.lineTo(p.x * w - 2, yy + 9); x.stroke(); } break; }
      case 'bg_blueprint': {
        x.fillStyle = '#04163a'; x.fillRect(0, 0, w, h);
        x.strokeStyle = 'rgba(120,180,255,.12)'; x.lineWidth = 1; for (let xx = 0; xx < w; xx += 12) { x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx, h); x.stroke(); } for (let yy = 0; yy < h; yy += 12) { x.beginPath(); x.moveTo(0, yy); x.lineTo(w, yy); x.stroke(); }
        x.strokeStyle = 'rgba(120,180,255,.25)'; for (let xx = 0; xx < w; xx += 60) { x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx, h); x.stroke(); }
        const cx = w * .75, cy = h * .5, R = U * .4; x.strokeStyle = 'rgba(180,220,255,.8)'; x.lineWidth = 1.2;
        [[1, 1, 0], [.78, -1.5, 1], [.55, 2, 0], [.32, -3, 1]].forEach(([k, sp, dash]) => { x.setLineDash(dash ? [6, 6] : []); x.save(); x.translate(cx, cy); x.rotate(t * sp * .15); x.beginPath(); x.arc(0, 0, R * k, 0, 6.29); x.stroke();
          for (let i = 0; i < 24; i++) { const a = i / 24 * 6.283; x.beginPath(); x.moveTo(Math.cos(a) * R * k, Math.sin(a) * R * k); x.lineTo(Math.cos(a) * R * k * (i % 6 ? .96 : .9), Math.sin(a) * R * k * (i % 6 ? .96 : .9)); x.stroke(); } x.restore(); });
        x.setLineDash([]); x.strokeStyle = 'rgba(34,230,255,.9)'; x.shadowColor = '#22e6ff'; x.shadowBlur = 8; x.beginPath(); x.moveTo(cx, cy - R * .26); x.bezierCurveTo(cx + R * .22, cy, cx + R * .2, cy + R * .22, cx, cy + R * .22); x.bezierCurveTo(cx - R * .2, cy + R * .22, cx - R * .22, cy, cx, cy - R * .26); x.stroke(); x.shadowBlur = 0;
        const sy = (t * 40) % h; x.fillStyle = lin([[0, 'rgba(34,230,255,0)'], [1, 'rgba(34,230,255,.18)']], 0, sy - 30, 0, sy); x.fillRect(0, sy - 30, w, 30); break; }
      case 'bg_aurora': {
        x.fillStyle = lin([[0, '#010812'], [1, '#04121c']]); x.fillRect(0, 0, w, h); stars(70, 59, .8);
        x.globalCompositeOperation = 'lighter';
        for (let b = 0; b < 4; b++) { for (let xx = 0; xx <= w; xx += 3) { const yy = h * (.25 + b * .08) + Math.sin(xx / (60 + b * 20) + t * (.4 + b * .1) + b) * h * .08 + Math.sin(xx / 23 + t * .9) * 4, len = h * (.25 + .1 * Math.sin(xx / 50 + t + b));
          const g = x.createLinearGradient(0, yy, 0, yy + len); g.addColorStop(0, b % 2 ? 'rgba(178,107,255,.0)' : 'rgba(61,255,162,0)'); g.addColorStop(.2, b % 2 ? 'rgba(178,107,255,.13)' : 'rgba(61,255,162,.16)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(xx, yy, 3, len); } }
        x.globalCompositeOperation = 'source-over'; x.fillStyle = '#020a10'; x.beginPath(); x.moveTo(0, h); for (let xx = 0; xx <= w; xx += 20) x.lineTo(xx, h - 12 - Math.abs(Math.sin(xx * .05)) * 22); x.lineTo(w, h); x.fill(); break; }
      case 'bg_colossus': {
        x.fillStyle = lin([[0, '#1a0006'], [1, '#050002']]); x.fillRect(0, 0, w, h);
        x.strokeStyle = 'rgba(255,45,85,.16)'; x.lineWidth = 1; const s = 16; for (let yy = 0, r = 0; yy < h + s; yy += s * .86, r++) for (let xx = (r % 2) * s * .75; xx < w + s; xx += s * 1.5) { x.beginPath(); for (let k = 0; k < 6; k++) x.lineTo(xx + Math.cos(k * 1.047) * s * .5, yy + Math.sin(k * 1.047) * s * .5); x.closePath(); x.stroke(); }
        const cx = w * .72, cy = h * .5, pul = .5 + .5 * Math.sin(t * 2.2); x.globalCompositeOperation = 'lighter'; glow(cx, cy, U * (.6 + .1 * pul), 'rgba(255,45,85,.35)');
        x.globalCompositeOperation = 'source-over'; x.fillStyle = '#2a0008'; x.beginPath(); x.ellipse(cx, cy, U * .32, U * .16, 0, 0, 6.29); x.fill();
        const ix = cx + Math.sin(t * .7) * U * .1; x.fillStyle = lin([[0, '#ffd23f'], [1, '#ff2d55']], 0, cy - U * .12, 0, cy + U * .12); x.beginPath(); x.ellipse(ix, cy, U * .1, U * .13, 0, 0, 6.29); x.fill();
        x.fillStyle = '#0a0002'; x.beginPath(); x.ellipse(ix, cy, U * .025 * (1 + pul * .4), U * .11, 0, 0, 6.29); x.fill(); break; }
      case 'bg_neon': {   // league top: spotlights, a crown emblem, hex floor
        x.fillStyle = lin([[0, '#07001a'], [1, '#1a0530']]); x.fillRect(0, 0, w, h);
        x.save(); x.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 4; i++) { const bx = w * (.15 + i * .23), a = -Math.PI / 2 + Math.sin(t * .6 + i * 1.7) * .45, L = h * 1.5, col = i % 2 ? '34,230,255' : '255,79,216';
          const g = x.createLinearGradient(bx, h, bx + Math.cos(a) * L, h + Math.sin(a) * L); g.addColorStop(0, `rgba(${col},.45)`); g.addColorStop(1, `rgba(${col},0)`); x.fillStyle = g;
          x.beginPath(); x.moveTo(bx, h); x.lineTo(bx + Math.cos(a - .13) * L, h + Math.sin(a - .13) * L); x.lineTo(bx + Math.cos(a + .13) * L, h + Math.sin(a + .13) * L); x.closePath(); x.fill(); }
        x.restore();
        x.strokeStyle = 'rgba(255,79,216,.25)'; for (let i = 0; i < 6; i++) { const k = ((i + (t * .3) % 1) / 6) ** 1.6, yy = h * .72 + k * h * .3; x.globalAlpha = k; x.beginPath(); x.moveTo(0, yy); x.lineTo(w, yy); x.stroke(); } x.globalAlpha = 1;
        const cx = w * .8, cy = h * .42, cs = U * .26, pul = .6 + .4 * Math.sin(t * 2);
        x.globalCompositeOperation = 'lighter'; glow(cx, cy, cs * 2.4, `rgba(255,79,216,${.35 * pul})`); x.globalCompositeOperation = 'source-over';
        x.save(); x.translate(cx, cy); x.strokeStyle = '#ff9bf0'; x.lineWidth = 2.2; x.shadowColor = '#ff4fd8'; x.shadowBlur = 16 * pul;
        x.beginPath(); x.moveTo(-cs, cs * .45); x.lineTo(-cs, -cs * .35); x.lineTo(-cs * .5, cs * .05); x.lineTo(0, -cs * .6); x.lineTo(cs * .5, cs * .05); x.lineTo(cs, -cs * .35); x.lineTo(cs, cs * .45); x.closePath(); x.stroke();
        x.strokeStyle = '#7cf3ff'; x.beginPath(); x.moveTo(-cs, cs * .62); x.lineTo(cs, cs * .62); x.stroke(); x.restore();
        for (const p of pbgPts('nn', 30, 61)) { const a = Math.max(0, Math.sin(t * 1.6 + p.p * 3)); x.globalAlpha = a; x.fillStyle = p.q > .5 ? '#ff9bf0' : '#9ff4ff'; x.fillRect(p.x * w, p.y * h * .8, 1.6, 1.6); } x.globalAlpha = 1; break; }
      case 'bg_champion': {
        x.fillStyle = lin([[0, '#1a0a00'], [1, '#2a0420']]); x.fillRect(0, 0, w, h);
        const cx = w * .72, cy = h * .45; x.save(); x.translate(cx, cy); x.rotate(t * .08); x.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 14; i++) { x.rotate(6.283 / 14); const g = x.createLinearGradient(0, 0, U * 1.2, 0); g.addColorStop(0, 'rgba(255,210,63,.3)'); g.addColorStop(1, 'rgba(255,210,63,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(0, 0); x.lineTo(U * 1.2, -U * .09); x.lineTo(U * 1.2, U * .09); x.closePath(); x.fill(); }
        x.restore(); x.globalCompositeOperation = 'lighter'; glow(cx, cy, U * .45, 'rgba(255,230,140,.5)');
        for (const p of pbgPts('ch', 5, 67)) { const px = p.x * w, a = .25 + .2 * Math.sin(t * 1.5 + p.p); x.fillStyle = lin([[0, `rgba(255,79,216,${a})`], [1, 'rgba(255,79,216,0)']], px - 14, 0, px + 14, 0); x.fillRect(px - 14, 0, 28, h); }
        x.globalCompositeOperation = 'source-over';
        for (const p of pbgPts('cf', 40, 71)) { const yy = (p.y * h + t * (30 + p.s * 40)) % (h + 10) - 5, xx = p.x * w + Math.sin(t * 2 + p.p) * 8; x.save(); x.translate(xx, yy); x.rotate(t * 3 + p.p); x.fillStyle = ['#ffd23f', '#ff4fd8', '#fff6c8', '#22e6ff'][(p.q * 4) | 0]; x.fillRect(-3, -1.5, 6, 3); x.restore(); } break; }
      case 'bg_sing': {   // chaos top: a black hole with a spinning accretion disk
        x.fillStyle = '#020008'; x.fillRect(0, 0, w, h);
        const cx = w * .74, cy = h * .5, R = U * .22;
        x.globalCompositeOperation = 'lighter'; glow(cx, cy, U * .9, 'rgba(178,107,255,.28)'); x.globalCompositeOperation = 'source-over';
        for (const p of pbgPts('ss', 90, 73)) { const dx = p.x * w - cx, dy = p.y * h - cy, d = Math.hypot(dx, dy) || 1, k = 1 + (R * R * 2.2) / (d * d); x.globalAlpha = .3 + .6 * Math.abs(Math.sin(t + p.p)); x.fillStyle = '#d8d0ff'; x.fillRect(cx + dx * k, cy + dy * k, 1.2, 1.2); } x.globalAlpha = 1;
        x.save(); x.translate(cx, cy); x.scale(1, .32); x.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 90; i++) { const a = i / 90 * 6.283 + t * .9, r1 = R * 1.3, r2 = R * 3.1, hue = (290 + 50 * Math.sin(a * 2 + t)) % 360;
          x.strokeStyle = `hsla(${hue},100%,${58 + 15 * Math.sin(a * 3 - t * 2)}%,${.55 + .3 * Math.sin(a + t)})`; x.lineWidth = 4; x.beginPath(); x.arc(0, 0, r1 + (r2 - r1) * ((i * 7) % 13) / 13, a, a + .12); x.stroke(); }
        x.restore(); x.globalCompositeOperation = 'source-over';
        x.fillStyle = '#000'; x.beginPath(); x.arc(cx, cy, R, 0, 6.29); x.fill();
        x.strokeStyle = `rgba(255,190,255,${.7 + .3 * Math.sin(t * 3)})`; x.lineWidth = 2; x.shadowColor = '#ff4fd8'; x.shadowBlur = 18; x.beginPath(); x.arc(cx, cy, R * 1.08, 0, 6.29); x.stroke(); x.shadowBlur = 0;
        x.save(); x.beginPath(); x.rect(0, 0, w, cy); x.clip(); x.translate(cx, cy); x.scale(1, .32); x.globalCompositeOperation = 'lighter'; x.strokeStyle = 'rgba(255,170,240,.5)'; x.lineWidth = 3; x.beginPath(); x.arc(0, 0, R * 1.5, Math.PI, 0); x.stroke(); x.restore();
        for (const p of pbgPts('sp', 24, 79)) { const ph = ((t * (.15 + p.s * .15) + p.q) % 1), a = p.p + ph * 9, d = R * (4 - ph * 2.9); x.globalAlpha = ph; x.fillStyle = '#22e6ff'; x.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d * .45, 1.8, 1.8); } x.globalAlpha = 1; break; }
      case 'bg_rift': {
        x.fillStyle = lin([[0, '#0a0020'], [1, '#1a0030']]); x.fillRect(0, 0, w, h);
        const k = Math.floor(t * 9); let s = k * 31 + 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
        const crack = (dx, col) => { x.strokeStyle = col; x.beginPath(); let yy = -5; x.moveTo(w * .55 + dx, yy); for (const p of pbgPts('rk', 12, 83)) { yy += h / 11; x.lineTo(w * (.45 + p.x * .25) + dx, yy); } x.stroke(); };
        const pul = .6 + .4 * Math.sin(t * 3); x.lineWidth = 3; x.globalCompositeOperation = 'lighter';
        crack(-3, `rgba(255,0,80,${.6 * pul})`); crack(3, `rgba(0,220,255,${.6 * pul})`); x.lineWidth = 1.4; crack(0, '#ffffff');
        glow(w * .55, h * .5, U * .7 * pul, 'rgba(178,107,255,.35)');
        x.globalCompositeOperation = 'source-over';
        if (r() < .55) for (let i = 0; i < 4; i++) { const yy = r() * h, hh = 3 + r() * 10, off = (r() - .5) * 30; x.drawImage(x.canvas, 0, yy * (x.canvas.height / h), x.canvas.width, hh * (x.canvas.height / h), off, yy, w, hh); }
        for (const p of pbgPts('rf', 18, 89)) { const a = (t * .5 + p.p) % 6.283, d = (p.q * .5 + .2) * U; x.fillStyle = p.s > .5 ? 'rgba(255,79,216,.7)' : 'rgba(34,230,255,.7)'; x.save(); x.translate(w * .55 + Math.cos(a) * d * 1.6, h * .5 + Math.sin(a) * d * .5); x.rotate(a); x.fillRect(-3, -3, 6, 6); x.restore(); } break; }
      case 'bg_creator': {
        x.fillStyle = lin([[0, '#120800'], [1, '#2a1400']]); x.fillRect(0, 0, w, h);
        x.font = '10px monospace'; const cols = Math.ceil(w / 11);
        for (let c = 0; c < cols; c++) { const p = pbgPts('cc', cols, 97)[c], sp = 30 + p.s * 50, head = (t * sp + p.y * h * 3) % (h + 120);
          for (let i = 0; i < 12; i++) { const yy = head - i * 11; if (yy < 0 || yy > h) continue; x.fillStyle = i ? `rgba(255,210,63,${.45 - i * .035})` : '#fff6c8'; x.fillText('01ΣΔ◆✦λ{}<>'[(c * 7 + i * 3 + Math.floor(t * 4)) % 11], c * 11, yy); } }
        const cx = w * .76, cy = h * .5, R = U * .3; x.globalCompositeOperation = 'lighter'; glow(cx, cy, R * 1.6, 'rgba(255,210,63,.4)');
        x.save(); x.translate(cx, cy); x.rotate(t * .4); x.strokeStyle = '#ffd23f'; x.lineWidth = 2; x.setLineDash([R * .3, R * .12]); x.beginPath(); x.arc(0, 0, R, 0, 6.29); x.stroke(); x.rotate(-t * .9); x.setLineDash([4, 6]); x.beginPath(); x.arc(0, 0, R * .75, 0, 6.29); x.stroke(); x.restore(); x.setLineDash([]); break; }
      case 'bg_beta': {
        x.fillStyle = lin([[0, '#001a24'], [1, '#04061e']]); x.fillRect(0, 0, w, h);
        x.strokeStyle = 'rgba(34,230,255,.14)'; const s = 18; for (let yy = 0, r = 0; yy < h + s; yy += s * .86, r++) for (let xx = (r % 2) * s * .75; xx < w + s; xx += s * 1.5) { x.beginPath(); for (let k = 0; k < 6; k++) x.lineTo(xx + Math.cos(k * 1.047) * s * .5, yy + Math.sin(k * 1.047) * s * .5); x.closePath(); x.stroke(); }
        x.globalCompositeOperation = 'lighter'; const fl = Math.sin(t * 23) > .92 ? .4 : 1;
        x.font = `${Math.round(U * .7)}px "Russo One", sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = `rgba(34,230,255,${.18 * fl})`; x.fillText('β', w * .78 + 2, h * .52); x.fillStyle = `rgba(255,79,216,${.14 * fl})`; x.fillText('β', w * .78 - 2, h * .52);
        for (let yy = (t * 30) % 4; yy < h; yy += 4) { x.fillStyle = 'rgba(124,243,255,.05)'; x.fillRect(0, yy, w, 1); }
        const sy = (t * 60) % (h + 40) - 20; x.fillStyle = lin([[0, 'rgba(124,243,255,0)'], [.5, 'rgba(124,243,255,.25)'], [1, 'rgba(124,243,255,0)']], 0, sy - 20, 0, sy + 20); x.fillRect(0, sy - 20, w, 40); break; }
      case 'bg_ps_const': {   // prestige ★18: a night sky, two constellations fade in and out
        x.fillStyle = lin([[0, '#0a0f33'], [1, '#05061a']]); x.fillRect(0, 0, w, h);
        glow(w * .3, h * .2, U * .9, 'rgba(40,60,160,.35)'); glow(w * .82, h * .9, U * .8, 'rgba(90,30,150,.35)'); stars(90, 61, .8);
        const C = [[[.08, .7], [.2, .45], [.33, .55], [.45, .28], [.57, .4]], [[.64, .78], [.76, .6], [.88, .68], [.82, .3], [.94, .2]]];
        C.forEach((pts, k) => { const a = .25 + .55 * Math.max(0, Math.sin(t * .45 + k * 2.1)); x.globalAlpha = a; x.strokeStyle = '#a8c4ff'; x.lineWidth = 1.2; x.beginPath(); pts.forEach(([px, py], i) => i ? x.lineTo(px * w, py * h) : x.moveTo(px * w, py * h)); x.stroke();
          x.globalAlpha = 1; pts.forEach(([px, py]) => glow(px * w, py * h, 7, `rgba(220,235,255,${.5 + a * .5})`)); });
        x.globalAlpha = 1; break; }
      case 'bg_ps_nova': {   // prestige ✦20: a star pulses in the centre, rings of light spread and fade
        x.fillStyle = '#05030f'; x.fillRect(0, 0, w, h); const cx = w * .5, cy = h * .5, pu = .85 + .15 * Math.sin(t * 2.2);
        glow(cx, cy, U * 1.1, 'rgba(120,40,200,.45)'); stars(70, 67, .9);
        x.save(); x.translate(cx, cy); x.rotate(t * .05); x.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 24; i++) { x.rotate(Math.PI / 12); const g = x.createLinearGradient(0, 0, U * 1.2, 0); g.addColorStop(0, 'rgba(255,200,245,.32)'); g.addColorStop(1, 'rgba(255,200,245,0)'); x.fillStyle = g; x.beginPath(); x.moveTo(0, 0); x.lineTo(U * 1.2, -U * .025); x.lineTo(U * 1.2, U * .025); x.closePath(); x.fill(); }
        x.restore();
        for (let k = 0; k < 3; k++) { const ph = (t * .22 + k / 3) % 1, r = U * (.1 + ph * 1.1); x.globalAlpha = (1 - ph) * .9; x.strokeStyle = k % 2 ? '#9ff0ff' : '#ff8ae6'; x.lineWidth = 2; x.shadowColor = '#ff4fd8'; x.shadowBlur = 10; x.beginPath(); x.arc(cx, cy, r, 0, 6.29); x.stroke(); }
        x.shadowBlur = 0; x.globalAlpha = 1; glow(cx, cy, U * .32 * pu, 'rgba(255,138,230,.9)'); glow(cx, cy, U * .12 * pu, '#ffffff'); break; }
      case 'bg_ps_gal': {   // prestige ✦25: a galaxy band slowly turns among the stars
        x.fillStyle = lin([[0, '#0b0420'], [1, '#03020a']]); x.fillRect(0, 0, w, h); stars(110, 71, .7);
        x.save(); x.translate(w * .55, h * .5); x.rotate(-.35 + Math.sin(t * .08) * .05); x.scale(1, .32); x.globalCompositeOperation = 'lighter';
        glow(0, 0, U * 1.05, 'rgba(178,107,255,.45)'); glow(0, 0, U * .55, 'rgba(255,170,235,.55)'); glow(0, 0, U * .18, 'rgba(255,255,255,.9)');
        for (const q of pbgPts('gx', 160, 73)) { const a = q.p * 6.283 + t * .06 * (1.2 - q.s), rr = (q.x * .9 + .08) * U; x.globalAlpha = .35 + .5 * q.q; x.fillStyle = q.s > .6 ? '#9ff0ff' : '#ffd1f4'; x.fillRect(Math.cos(a) * rr, Math.sin(a) * rr, 1.6, 1.6); }
        x.restore(); x.globalAlpha = 1; break; }
      case 'bg_goat27': drawGoatBg(x, w, h, t); break;
      case 'bg_horse26': {   // New Year 2027 gift box: the Year of the Fire Horse (丙午, 17 Feb 2026 – 5 Feb 2027) — a neon horse at full gallop
        const W = w, H = h;
        x.fillStyle = lin([[0, '#0c0210'], [.62, '#2a0616'], [.63, '#16030b'], [1, '#0a0206']]); x.fillRect(0, 0, W, H);
        stars(70, 97, 1, '#fff3e6');
        glow(W * .64, H * .64, W * .45, 'rgba(255,45,85,.22)');
        x.save(); x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `700 ${H * .42}px "Noto Serif SC", "SimSun", serif`; x.fillStyle = 'rgba(255,210,63,.13)'; x.shadowColor = '#ffd23f'; x.shadowBlur = 30; x.fillText('午', W * .17, H * .4);
        x.font = `700 ${H * .07}px "Noto Serif SC", "SimSun", serif`; x.fillStyle = 'rgba(255,210,63,.75)'; x.shadowBlur = 12; x.fillText('丙 午', W * .17, H * .72); x.restore();
        // fireworks: one burst every 3 s, place and colour fixed by the burst number
        { const n = Math.floor(t / 3), tau = t - n * 3; if (tau < 1.3) { const hs = k => { const v = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453; return v - Math.floor(v); };
          const cx = W * (.35 + hs(1) * .55), cy = H * (.12 + hs(2) * .25), col = ['#ffd23f', '#ff2d55', '#ff7a1a'][Math.floor(hs(3) * 3)], r = H * .28 * (1 - Math.exp(-1.8 * tau)) / 1.8, dy = H * .05 * tau * tau;
          x.globalAlpha = 1 - tau / 1.3; x.fillStyle = col; for (let i = 0; i < 36; i++) { const a = i / 36 * 6.283; x.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r + dy, 2.2, 2.2); } x.globalAlpha = 1; } }
        // lanterns on a string
        x.strokeStyle = 'rgba(255,210,63,.35)'; x.lineWidth = 1; x.beginPath(); x.moveTo(0, H * .05); x.quadraticCurveTo(W * .5, H * .16, W, H * .04); x.stroke();
        for (let i = 0; i < 6; i++) { const u = (i + .5) / 6, ax = u * W, ay = H * .05 + Math.sin(u * Math.PI) * H * .1 * (1 - Math.abs(u - .5) * .2), sw = Math.sin(t * 1.4 + i) * .12, L = H * .06, lx = ax + Math.sin(sw) * L, ly = ay + Math.cos(sw) * L, R = H * .045;
          x.strokeStyle = 'rgba(255,210,63,.5)'; x.beginPath(); x.moveTo(ax, ay); x.lineTo(lx, ly - R); x.stroke(); glow(lx, ly, R * 2.6, 'rgba(255,60,40,.45)');
          x.fillStyle = '#d4182c'; x.beginPath(); x.ellipse(lx, ly, R * .85, R, 0, 0, 6.3); x.fill(); x.fillStyle = '#ffd23f'; x.fillRect(lx - R * .45, ly - R * 1.05, R * .9, R * .18); x.fillRect(lx - R * .45, ly + R * .88, R * .9, R * .18);
          x.strokeStyle = 'rgba(255,190,90,.6)'; x.beginPath(); x.moveTo(lx, ly - R); x.lineTo(lx, ly + R); x.stroke(); x.beginPath(); x.moveTo(lx, ly + R * 1.1); x.lineTo(lx, ly + R * 1.6); x.stroke(); }
        // ground: perspective lines and speed streaks running back
        const gy = H * .63; x.strokeStyle = 'rgba(255,45,85,.45)'; x.lineWidth = 1;
        for (let i = 0; i < 8; i++) { const k = ((i + (t * 1.6) % 1) / 8) ** 2, yy = gy + k * (H - gy); x.globalAlpha = .25 + k * .6; x.beginPath(); x.moveTo(0, yy); x.lineTo(W, yy); x.stroke(); } x.globalAlpha = 1;
        for (let i = 0; i < 14; i++) { const yy = gy + 6 + (i * 37 % 100) / 100 * (H - gy - 10), len = W * (.06 + (i % 4) * .03), xx = W - ((t * W * (.9 + (i % 3) * .3) + i * 173) % (W + len)); x.strokeStyle = i % 2 ? 'rgba(255,122,26,.55)' : 'rgba(255,210,63,.4)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(xx, yy); x.lineTo(xx + len, yy); x.stroke(); }
        // the horse: silhouette 400×260 facing right, jointed legs in a rotary gallop, flame mane and tail
        const S = Math.min(W * .5, H * .95), hcx = W * .6, hcy = gy - S * .14, k = S / 400, ph = t * 7.5, bob = Math.sin(ph * 2) * 4, pitch = Math.sin(ph * 2 + 1) * .025;
        const BODY = pbgHorse.body || (pbgHorse.body = new Path2D('M110 95 C150 90 190 98 222 90 C246 84 260 60 274 40 L279 20 L289 37 C302 40 326 58 346 77 C353 84 353 94 345 99 C337 102 326 99 317 97 C305 95 297 91 291 87 C282 101 272 118 264 134 C259 148 252 158 240 163 C210 168 172 167 141 161 C120 157 104 148 96 133 C89 119 95 103 110 95 Z'));
        const MUSCLE = pbgHorse.mus || (pbgHorse.mus = new Path2D('M222 92 C232 112 236 132 230 150 M130 100 C150 112 156 134 146 156 M262 64 C252 80 246 92 238 104 M300 52 C296 62 294 74 291 86'));
        x.save(); x.translate(hcx, hcy + bob * k); x.rotate(pitch); x.scale(k, k); x.translate(-200, -130);
        const leg = (hx, hy, a1, a2, l1, l2, front, near) => {
          const kx = hx + Math.sin(a1) * l1, ky = hy + Math.cos(a1) * l1, fx = kx + Math.sin(a2) * l2, fy = ky + Math.cos(a2) * l2;
          x.save(); x.lineCap = 'round'; x.lineJoin = 'round';
          x.strokeStyle = near ? '#4a0a1c' : '#2a0610'; x.lineWidth = front ? 24 : 30; x.beginPath(); x.moveTo(hx, hy - 6); x.lineTo(kx, ky); x.stroke();
          x.lineWidth = 13; x.beginPath(); x.moveTo(kx, ky); x.lineTo(fx, fy); x.stroke();
          x.strokeStyle = near ? '#ff2d55' : 'rgba(255,45,85,.5)'; x.shadowColor = '#ff2d55'; x.shadowBlur = near ? 14 : 6; x.lineWidth = 3;
          const w1 = front ? 11 : 14; x.beginPath(); x.moveTo(hx - w1, hy - 4); x.lineTo(kx - 6, ky); x.lineTo(fx - 4, fy); x.moveTo(hx + w1, hy - 4); x.lineTo(kx + 6, ky); x.lineTo(fx + 4, fy); x.stroke();
          x.fillStyle = near ? '#ffd23f' : 'rgba(255,210,63,.5)'; x.shadowColor = '#ffd23f'; x.beginPath(); x.ellipse(fx + Math.sin(a2) * 3, fy + 3, 8, 5.5, a2, 0, 6.3); x.fill(); x.restore(); };
        const LG = [[118, 140, 0, 0, false], [128, 142, .35, 1, false], [236, 150, .55, 0, true], [246, 152, .85, 1, true]].map(([hx, hy, o, near, front]) => {
          const c = ph - o * 6.283, sw = Math.sin(c), lift = Math.max(0, Math.cos(c));
          return front ? [hx, hy, .15 + .6 * sw, .15 + .6 * sw - 1.5 * lift, 46, 52, true, near] : [hx, hy, -.25 + .55 * sw, -.25 + .55 * sw + 1.1 * lift - .2, 48, 56, false, near]; });
        LG.filter(l => !l[7]).forEach(l => leg(...l));
        x.save(); x.globalCompositeOperation = 'lighter'; x.lineCap = 'round';
        for (let i = 0; i < 7; i++) { const wv = Math.sin(t * 6 + i * .9), len = 95 + i * 9, g = x.createLinearGradient(100, 100, 100 - len, 120); g.addColorStop(0, 'rgba(255,230,120,.95)'); g.addColorStop(.5, 'rgba(255,110,30,.7)'); g.addColorStop(1, 'rgba(255,45,85,0)');
          x.strokeStyle = g; x.lineWidth = 11 - i; x.beginPath(); x.moveTo(104, 100); x.bezierCurveTo(70, 92 + wv * 10, 40, 112 + wv * 18 + i * 3, 104 - len, 104 + wv * 22 + i * 4); x.stroke(); }
        x.restore();
        x.fillStyle = lin([[0, '#4a0818'], [.6, '#22040e'], [1, '#3a0614']], 100, 40, 330, 170); x.fill(BODY);
        x.save(); x.clip(BODY); const ig = x.createRadialGradient(230, 110, 10, 230, 110, 150); ig.addColorStop(0, 'rgba(255,90,40,.28)'); ig.addColorStop(1, 'rgba(255,90,40,0)'); x.fillStyle = ig; x.fillRect(80, 10, 280, 170); x.restore();
        x.save(); x.strokeStyle = 'rgba(255,140,120,.35)'; x.lineWidth = 2; x.stroke(MUSCLE); x.restore();
        x.save(); x.strokeStyle = '#ff2d55'; x.lineWidth = 4.5; x.lineJoin = 'round'; x.shadowColor = '#ff2d55'; x.shadowBlur = 22; x.stroke(BODY); x.strokeStyle = '#ffe0e6'; x.lineWidth = 1.5; x.shadowBlur = 5; x.stroke(BODY); x.restore();
        LG.filter(l => l[7]).forEach(l => leg(...l));
        x.save(); x.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 9; i++) { const u = i / 8, bx = 222 + u * 56, by = 90 - u * 62, hh = 30 + Math.sin(t * 9 + i * 1.3) * 8 + (1 - Math.abs(u - .5) * 2) * 12;
          const g = x.createLinearGradient(bx, by, bx - hh, by - hh * .8); g.addColorStop(0, 'rgba(255,230,120,.95)'); g.addColorStop(.6, 'rgba(255,100,30,.6)'); g.addColorStop(1, 'rgba(255,45,85,0)');
          x.fillStyle = g; x.beginPath(); x.moveTo(bx + 8, by + 4); x.quadraticCurveTo(bx - hh * .3, by - hh * .2, bx - hh, by - hh * .75 + Math.sin(t * 7 + i) * 6); x.quadraticCurveTo(bx - hh * .2, by - hh * .05, bx - 8, by + 8); x.fill(); }
        x.restore();
        x.save(); x.fillStyle = '#ffd23f'; x.shadowColor = '#ffd23f'; x.shadowBlur = 12; x.beginPath(); x.ellipse(306, 58, 5, 3.5, .5, 0, 6.3); x.fill();
        x.fillStyle = '#ff2d55'; x.shadowBlur = 6; x.beginPath(); x.ellipse(340, 86, 3, 2, .6, 0, 6.3); x.fill(); x.restore();
        x.restore();
        // sparks blown back from the mane and the tail (each spark loops on its own period)
        const toS = (px, py) => { const dx = (px - 200) * k, dy = (py - 130) * k; return [hcx + dx * Math.cos(pitch) - dy * Math.sin(pitch), hcy + bob * k + dx * Math.sin(pitch) + dy * Math.cos(pitch)]; };
        x.save(); x.globalCompositeOperation = 'lighter';
        for (const p of pbgPts('hs', 46, 131)) { const tail = p.q < .35, life = .4 + p.s * .4, ph2 = ((t + p.p) % life) / life, f = 1 - ph2;
          const [sx, sy] = tail ? toS(20 - p.x * 20, 110 + p.y * 20) : toS(222 + p.x * 56 - 20, 90 - p.x * 62 - 20);
          const vx = -(tail ? 60 + p.y * 60 : 30 + p.y * 40) * S / 400, vy = (tail ? (p.s - .3) * 20 : -(10 + p.s * 30)) * S / 400, el = ph2 * life * 2.4;
          glow(sx + vx * el, sy + vy * el, S * (.006 + p.q * .008) * (1 + f), f > .5 ? 'rgba(255,210,63,.9)' : 'rgba(255,90,30,.8)', f); }
        x.restore();
        for (let i = 0; i < 26; i++) { const yy = H - ((t * (25 + i % 5 * 9) + i * 47) % (H * .7)), xx = (i * 97 % 100) / 100 * W + Math.sin(t + i) * 6; glow(xx, yy, 3 + (i % 3), 'rgba(255,122,26,.9)', .7); }
        break; }
      case 'bg_vet': {
        x.fillStyle = lin([[0, '#001a0e'], [1, '#00100a']]); x.fillRect(0, 0, w, h);
        x.strokeStyle = 'rgba(61,255,162,.1)'; for (let xx = 0; xx < w; xx += 16) { x.beginPath(); x.moveTo(xx, 0); x.lineTo(xx, h); x.stroke(); } for (let yy = 0; yy < h; yy += 16) { x.beginPath(); x.moveTo(0, yy); x.lineTo(w, yy); x.stroke(); }
        const cy = h * .55, head = (t * w * .35) % (w + 80);
        x.lineWidth = 2.2; x.strokeStyle = '#3dffa2'; x.shadowColor = '#3dffa2'; x.shadowBlur = 10; x.beginPath();
        for (let xx = 0; xx <= w; xx += 2) { const ph = (xx % 140) / 140; let yy = cy; if (ph > .4 && ph < .45) yy = cy - (ph - .4) * 20 * h * .1; else if (ph >= .45 && ph < .5) yy = cy - h * .1 + (ph - .45) * 20 * h * .28; else if (ph >= .5 && ph < .55) yy = cy + h * .18 - (ph - .5) * 20 * h * .18; else if (ph > .65 && ph < .75) yy = cy - Math.sin((ph - .65) * 31.4) * h * .05;
          const age = (head - xx + w + 80) % (w + 80); x.globalAlpha = Math.max(.08, 1 - age / w); x.lineTo(xx, yy); x.stroke(); x.beginPath(); x.moveTo(xx, yy); }
        x.globalAlpha = 1; x.shadowBlur = 0; x.globalCompositeOperation = 'lighter'; glow(head, cy, 24, 'rgba(61,255,162,.6)');
        const cx = w * .82, cs = U * .14; x.fillStyle = 'rgba(61,255,162,.12)'; x.fillRect(cx - cs * .3, h * .3 - cs, cs * .6, cs * 2); x.fillRect(cx - cs, h * .3 - cs * .3, cs * 2, cs * .6); break; }
      case 'bg_nebula': {   // volumetric clouds, a ringed planet drifting past, dust
        x.fillStyle = lin([[0, '#06021a'], [1, '#12052c']]); x.fillRect(0, 0, w, h); stars(80, 11, 1.1);
        x.globalCompositeOperation = 'lighter';
        for (const p of pbgPts('nc', 26, 113)) { const cx = (p.x + Math.sin(t * .05 + p.p) * .04) * w, cy = (.15 + p.y * .8) * h + Math.cos(t * .07 + p.p) * 6;
          glow(cx, cy, U * (.18 + p.s * .3), ['rgba(255,79,216,.16)', 'rgba(34,230,255,.12)', 'rgba(123,61,255,.18)'][(p.q * 3) | 0]); }
        x.globalCompositeOperation = 'source-over';
        const px = w * (.78 - ((t * .006) % .2)), py = h * .42, pr = U * .2;
        x.fillStyle = lin([[0, '#3a1a7e'], [1, '#0a0420']], px - pr, py - pr, px + pr, py + pr); x.beginPath(); x.arc(px, py, pr, 0, 6.29); x.fill();
        x.globalCompositeOperation = 'lighter'; x.strokeStyle = 'rgba(255,170,240,.55)'; x.lineWidth = 1.5; x.beginPath(); x.arc(px, py, pr, Math.PI * 1.1, Math.PI * 1.6); x.stroke();
        x.save(); x.translate(px, py); x.rotate(-.35); x.scale(1, .26); x.strokeStyle = 'rgba(160,220,255,.5)'; x.lineWidth = 5; x.beginPath(); x.arc(0, 0, pr * 1.75, 0, 6.29); x.stroke(); x.strokeStyle = 'rgba(255,79,216,.35)'; x.lineWidth = 2; x.beginPath(); x.arc(0, 0, pr * 2.05, 0, 6.29); x.stroke(); x.restore();
        for (const p of pbgPts('nd', 30, 117)) { const xx = ((p.x * w + t * (6 + p.s * 10)) % (w + 10)) - 5, yy = p.y * h + Math.sin(t * .8 + p.p) * 5; glow(xx, yy, 2 + p.s * 2.5, 'rgba(200,220,255,.8)', .5 + .5 * Math.sin(t * 2 + p.p)); }
        break; }
      case 'bg_crystal': {   // a cave: stalactites above, glowing crystal clusters below, light shafts and dust
        x.fillStyle = lin([[0, '#03010d'], [.6, '#0c0428'], [1, '#160636']]); x.fillRect(0, 0, w, h);
        x.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) { const sx = w * (.3 + i * .22) + Math.sin(t * .2 + i) * 10; x.fillStyle = lin([[0, 'rgba(160,220,255,.13)'], [1, 'rgba(160,220,255,0)']], sx, 0, sx + 40, h);
          x.beginPath(); x.moveTo(sx - 8, 0); x.lineTo(sx + 14, 0); x.lineTo(sx + 70, h); x.lineTo(sx + 20, h); x.closePath(); x.fill(); }
        x.globalCompositeOperation = 'source-over'; x.fillStyle = '#05020f';
        x.beginPath(); x.moveTo(0, 0); for (const p of pbgPts('ct', 16, 121)) { const xx = p.x * w; x.lineTo(xx - 8 - p.s * 8, 0); x.lineTo(xx, h * (.08 + p.q * .22)); x.lineTo(xx + 8 + p.s * 8, 0); } x.lineTo(w, 0); x.fill();
        const cluster = (bx, by, sc, c1, c2, ph) => { const pul = .65 + .35 * Math.sin(t * 1.4 + ph);
          x.globalCompositeOperation = 'lighter'; glow(bx, by - sc * .4, sc * 1.6, c2.replace('A', (.35 * pul).toFixed(2))); x.globalCompositeOperation = 'source-over';
          [[-.5, .55, -.35], [-.2, .9, -.12], [.05, 1.2, .02], [.3, .75, .25], [.55, .5, .4]].forEach(([dx, hk, lean]) => { const cx = bx + dx * sc, ch = sc * hk, cw = sc * .18;
            x.save(); x.translate(cx, by); x.rotate(lean); x.beginPath(); x.moveTo(-cw, 0); x.lineTo(-cw * .8, -ch * .78); x.lineTo(0, -ch); x.lineTo(cw * .8, -ch * .78); x.lineTo(cw, 0); x.closePath();
            x.fillStyle = lin([[0, c1], [1, 'rgba(20,6,50,.85)']], 0, -ch, 0, 0); x.fill(); x.strokeStyle = `rgba(230,245,255,${.5 + .4 * pul})`; x.lineWidth = 1; x.stroke();
            x.beginPath(); x.moveTo(0, -ch); x.lineTo(0, 0); x.strokeStyle = 'rgba(255,255,255,.25)'; x.stroke(); x.restore(); }); };
        cluster(w * .12, h + 2, U * .34, 'rgba(34,230,255,.95)', 'rgba(34,230,255,A)', 0); cluster(w * .86, h + 2, U * .42, 'rgba(178,107,255,.95)', 'rgba(178,107,255,A)', 2); cluster(w * .6, h + 2, U * .22, 'rgba(255,79,216,.9)', 'rgba(255,79,216,A)', 4);
        x.globalCompositeOperation = 'lighter';
        for (const p of pbgPts('cd', 34, 127)) { const yy = h - ((t * (5 + p.s * 8) + p.y * h) % h), xx = p.x * w + Math.sin(t * .6 + p.p) * 8; glow(xx, yy, 1.5 + p.s * 2.5, p.q > .5 ? 'rgba(160,240,255,.9)' : 'rgba(220,180,255,.9)', .4 + .6 * Math.abs(Math.sin(t + p.p))); }
        break; }
      case 'bg_wisteria': {   // hanging violet clusters, petals
        x.fillStyle = lin([[0, '#12041f'], [1, '#07020f']]); x.fillRect(0, 0, w, h);
        x.globalCompositeOperation = 'lighter'; glow(w * .7, h * .6, U, 'rgba(178,107,255,.2)'); x.globalCompositeOperation = 'source-over';
        x.strokeStyle = '#1e0a2a'; x.lineWidth = 5; x.beginPath(); x.moveTo(-10, h * .06); x.bezierCurveTo(w * .3, h * .16, w * .6, -h * .02, w + 10, h * .1); x.stroke();
        for (const p of pbgPts('ws', 16, 131)) { const bx = (.05 + p.x * .9) * w, by = h * (.06 + .05 * Math.sin(p.x * 6)), len = h * (.3 + p.q * .45), sway = Math.sin(t * .9 + p.p) * 6;
          x.globalCompositeOperation = 'lighter'; glow(bx + sway * .5, by + len * .45, len * .55, 'rgba(178,107,255,.16)'); x.globalCompositeOperation = 'source-over';
          for (let i = 0; i < 70; i++) { const k = i / 69, spread = (1 - k * .8) * U * .07, yy = by + k * len + Math.sin(i * 12.9) * 2, xx = bx + sway * k + Math.sin(i * 7.3 + p.p) * spread;
            const c = k < .45 ? [150, 110, 255] : k < .8 ? [200, 130, 255] : [255, 170, 235];
            x.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${.55 + .4 * Math.sin(i * 3.1 + t * 1.2) ** 2})`; x.beginPath(); x.ellipse(xx, yy, 3.4 * (1 - k * .4), 2.2 * (1 - k * .4), Math.sin(i) * .8, 0, 6.29); x.fill(); } }
        for (const p of pbgPts('wp', 28, 137)) { const per = 7 + p.s * 5, ph = ((t + p.p * 2) % per) / per, px = p.x * w + Math.sin(t * 1.1 + p.p) * 16, py = ph * (h + 20) - 10;
          x.save(); x.translate(px, py); x.rotate(t * (1 + p.q) + p.p); x.fillStyle = p.q > .5 ? 'rgba(220,170,255,.85)' : 'rgba(255,190,240,.75)'; x.beginPath(); x.ellipse(0, 0, 3.6, 2, 0, 0, 6.29); x.fill(); x.restore(); }
        break; }
      case 'bg_maple': {   // glowing maple leaves falling over a dusk sky
        x.fillStyle = lin([[0, '#1a0620'], [.7, '#3a0c1a'], [1, '#120208']]); x.fillRect(0, 0, w, h);
        x.globalCompositeOperation = 'lighter'; glow(w * .75, h * .95, U * 1.1, 'rgba(255,106,0,.28)'); glow(w * .2, h * .2, U * .7, 'rgba(255,79,216,.15)'); x.globalCompositeOperation = 'source-over';
        x.fillStyle = '#0d0206'; x.beginPath(); x.moveTo(0, h); for (let xx = 0; xx <= w; xx += 14) x.lineTo(xx, h - 10 - Math.abs(Math.sin(xx * .021)) * 26 - Math.abs(Math.sin(xx * .07)) * 8); x.lineTo(w, h); x.fill();
        const LOBES = [[0, 1], [.35, .42], [.62, .92], [.95, .38], [1.25, .75], [1.6, .3]];   // angle from the top, radius
        const leaf = (s) => { x.beginPath(); x.moveTo(0, s * .25);
          for (const sg of [-1, 1]) for (const [a, r] of (sg < 0 ? LOBES : [...LOBES].reverse())) { const ang = -Math.PI / 2 + sg * a; x.lineTo(Math.cos(ang) * s * r, Math.sin(ang) * s * r + s * .1); }
          x.closePath(); };
        for (const p of pbgPts('ml', 30, 139)) { const per = 7 + p.s * 6, ph = ((t + p.p * 3) % per) / per, px = (p.x * 1.2 - .1) * w + Math.sin(t * .9 + p.p) * 22 - ph * 30, py = ph * (h + 30) - 15, sz = 7 + p.q * 7;
          const col = ['#ff6a00', '#ff3d6e', '#ffd23f', '#ff4fd8'][(p.s * 4) | 0];
          x.save(); x.translate(px, py); x.rotate(Math.sin(t * 1.5 + p.p) * .9 + p.p); x.shadowColor = col; x.shadowBlur = 12; x.fillStyle = col; x.globalAlpha = .92; leaf(sz); x.fill();
          x.shadowBlur = 0; x.strokeStyle = 'rgba(40,0,10,.55)'; x.lineWidth = .8; x.beginPath(); x.moveTo(0, sz * .5); x.lineTo(0, -sz * .8); x.moveTo(0, 0); x.lineTo(sz * .6, -sz * .45); x.moveTo(0, 0); x.lineTo(-sz * .6, -sz * .45); x.stroke(); x.restore(); }
        x.globalAlpha = 1; break; }
      case 'bg_lotus': {   // still water, lotuses, rings spreading
        x.fillStyle = lin([[0, '#020a18'], [.5, '#06152a'], [1, '#020611']]); x.fillRect(0, 0, w, h); stars(40, 141, .6);
        x.globalCompositeOperation = 'lighter'; glow(w * .8, h * .18, U * .25, 'rgba(220,240,255,.6)'); glow(w * .8, h * .18, U * .7, 'rgba(120,180,255,.15)');
        for (let i = 0; i < 6; i++) { const yy = h * (.55 + i * .08); x.fillStyle = `rgba(200,230,255,${.06 + .04 * Math.sin(t * 1.3 + i)})`; x.fillRect(w * .8 - 20 - i * 6 + Math.sin(t + i) * 4, yy, 40 + i * 12, 1.5); }
        for (const p of pbgPts('lr', 6, 149)) { const per = 3.5 + p.s * 2, ph = ((t + p.p) % per) / per, cx = (.35 + p.x * .6) * w, cy = (.6 + p.y * .35) * h;
          x.strokeStyle = `rgba(120,230,255,${.5 * (1 - ph)})`; x.lineWidth = 1.2; x.beginPath(); x.ellipse(cx, cy, 6 + ph * 40, (6 + ph * 40) * .28, 0, 0, 6.29); x.stroke(); }
        x.globalCompositeOperation = 'source-over';
        const lotus = (cx, cy, s, c, ph) => { const pul = .7 + .3 * Math.sin(t * 1.2 + ph);
          x.fillStyle = '#062a22'; x.beginPath(); x.ellipse(cx, cy + s * .25, s * 1.5, s * .38, 0, 0, 6.29); x.fill();
          x.globalCompositeOperation = 'lighter'; glow(cx, cy - s * .2, s * 2.2, c.replace('A', (.35 * pul).toFixed(2))); x.globalCompositeOperation = 'source-over';
          for (let i = -3; i <= 3; i++) { x.save(); x.translate(cx, cy); x.rotate(i * .32); x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(s * .38, -s * .55, 0, -s * (1.05 - Math.abs(i) * .1)); x.quadraticCurveTo(-s * .38, -s * .55, 0, 0);
            x.fillStyle = lin([[0, 'rgba(255,230,250,.95)'], [1, c.replace('A', '.9')]], 0, -s, 0, 0); x.fill(); x.restore(); } };
        lotus(w * .62, h * .84, U * .26, 'rgba(255,79,216,A)', 0); lotus(w * .88, h * .74, U * .18, 'rgba(178,107,255,A)', 2); lotus(w * .4, h * .93, U * .14, 'rgba(255,140,200,A)', 4);
        x.globalCompositeOperation = 'lighter'; for (const p of pbgPts('lf', 14, 151)) { const xx = p.x * w + Math.sin(t * .7 + p.p) * 10, yy = h * (.35 + p.y * .4) + Math.cos(t * .9 + p.p) * 6; glow(xx, yy, 3, 'rgba(190,255,120,.9)', .3 + .7 * Math.abs(Math.sin(t * 1.5 + p.p))); }
        break; }
      case 'bg_fireflies': {   // a forest of silhouettes, fireflies, fog
        x.fillStyle = lin([[0, '#020d10'], [1, '#04140e']]); x.fillRect(0, 0, w, h);
        x.globalCompositeOperation = 'lighter'; glow(w * .5, h * .9, U * 1.1, 'rgba(61,255,162,.12)'); x.globalCompositeOperation = 'source-over';
        for (const [layer, col] of [[0, '#0d3a2a'], [1, '#05190f']]) for (const p of pbgPts('ft' + layer, 11, 157 + layer)) {
          const tx = p.x * w, th = h * (.75 + p.q * .4) * (layer ? 1 : .85), tw = 4 + p.s * 5 + layer * 3; x.fillStyle = col; x.fillRect(tx - tw / 2, h - th * .5, tw, th * .5); x.shadowColor = layer ? 'rgba(61,255,162,.35)' : 'rgba(0,0,0,0)'; x.shadowBlur = layer ? 6 : 0;
          for (let k = 0; k < 6; k++) { const yy = h - th + k * th * .1, ww = (th * .07) * (1 + k * .55); x.beginPath(); x.moveTo(tx, yy - th * .08); x.lineTo(tx + ww, yy + th * .1); x.lineTo(tx - ww, yy + th * .1); x.closePath(); x.fill(); } x.shadowBlur = 0; }
        x.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 3; i++) { x.fillStyle = lin([[0, 'rgba(140,255,200,0)'], [.5, 'rgba(140,255,200,.06)'], [1, 'rgba(140,255,200,0)']], 0, h * (.6 + i * .12) - 16, 0, h * (.6 + i * .12) + 16); x.fillRect(0, h * (.6 + i * .12) - 16, w, 32); }
        for (const p of pbgPts('ff', 46, 163)) { const xx = p.x * w + Math.sin(t * (.4 + p.s * .5) + p.p) * 24, yy = p.y * h + Math.cos(t * (.3 + p.q * .4) + p.p * 2) * 16, a = Math.max(0, Math.sin(t * (1 + p.s) + p.p * 3));
          glow(xx, yy, 5 + p.s * 4, 'rgba(198,255,61,.9)', a); x.fillStyle = `rgba(240,255,200,${a})`; x.fillRect(xx - .8, yy - .8, 1.6, 1.6); }
        break; }
      case 'bg_bamboo': {   // swaying bamboo stalks, leaves and a misty moon
        x.fillStyle = lin([[0, '#03140f'], [1, '#010806']]); x.fillRect(0, 0, w, h);
        x.globalCompositeOperation = 'lighter'; glow(w * .72, h * .3, U * .3, 'rgba(220,255,230,.45)'); glow(w * .72, h * .3, U * .9, 'rgba(61,255,162,.12)'); x.globalCompositeOperation = 'source-over';
        for (const [layer, col, joint] of [[0, '#0b3326', '#1a5a40'], [1, '#05190f', '#0e3a24']]) for (const p of pbgPts('bb' + layer, 8, 167 + layer)) {
          const bx = p.x * w, sw = Math.sin(t * .7 + p.p) * (6 + layer * 4), bw = 5 + p.s * 4 + layer * 3;
          x.strokeStyle = col; x.lineWidth = bw; x.lineCap = 'butt'; x.beginPath(); x.moveTo(bx, h + 5); x.quadraticCurveTo(bx + sw * .4, h * .5, bx + sw, -5); x.stroke();
          x.strokeStyle = joint; x.lineWidth = 2.2; for (let k = 1; k < 7; k++) { const u = k / 7, jx = 2 * (1 - u) * u * (bx + sw * .4) + u * u * (bx + sw) + (1 - u) * (1 - u) * bx, jy = (1 - u) * (1 - u) * (h + 5) + 2 * (1 - u) * u * h * .5 + u * u * -5; x.beginPath(); x.moveTo(jx - bw / 2 - 1, jy); x.lineTo(jx + bw / 2 + 1, jy); x.stroke(); }
          if (layer) for (let k = 0; k < 3; k++) { const jy = h * (.2 + k * .25 + p.q * .1), jx = bx + sw * (1 - jy / h); x.save(); x.translate(jx, jy); x.rotate((k % 2 ? .6 : -.6) + Math.sin(t + p.p + k) * .1); x.fillStyle = '#0e3a24'; x.beginPath(); x.ellipse(k % 2 ? 14 : -14, 0, 16, 3.2, 0, 0, 6.29); x.fill(); x.restore(); } }
        x.globalCompositeOperation = 'lighter';
        for (const p of pbgPts('bl', 20, 173)) { const per = 8 + p.s * 5, ph = ((t + p.p * 2) % per) / per, px = p.x * w + Math.sin(t + p.p) * 18 + ph * 30, py = ph * (h + 20) - 10;
          x.save(); x.translate(px, py); x.rotate(t * (.8 + p.q) + p.p); x.fillStyle = 'rgba(120,255,180,.7)'; x.beginPath(); x.ellipse(0, 0, 6, 1.6, 0, 0, 6.29); x.fill(); x.restore(); }
        break; }
      default: {   // bg_base «Ночная сетка»: neon mountains on the horizon, a grid floor, falling sparks
        x.fillStyle = lin([[0, '#07041a'], [.45, '#1a0838'], [.46, '#0b0824'], [1, '#05040f']]); x.fillRect(0, 0, w, h); stars(50, 5, .7, '#c9d8ff');
        const hz = h * .46; x.globalCompositeOperation = 'lighter'; glow(w * .55, hz, U * 1.1, 'rgba(255,79,216,.22)'); glow(w * .3, h * .2, U * .4, 'rgba(34,230,255,.12)'); x.globalCompositeOperation = 'source-over';
        for (const [k, col, line] of [[0, '#140a33', 'rgba(178,107,255,.7)'], [1, '#0c0626', 'rgba(255,79,216,.85)']]) {
          x.beginPath(); x.moveTo(0, hz); let i = 0; for (let xx = 0; xx <= w + 30; xx += 30 + k * 12, i++) x.lineTo(xx, hz - (k ? 10 : 22) - Math.abs(Math.sin(xx * (.013 + k * .01) + k * 2)) * (k ? 26 : 44)); x.lineTo(w, hz); x.closePath();
          x.fillStyle = col; x.fill(); x.strokeStyle = line; x.lineWidth = 1.2; x.shadowColor = line; x.shadowBlur = 8; x.stroke(); x.shadowBlur = 0; }
        x.strokeStyle = 'rgba(140,100,255,.35)'; x.lineWidth = 1;
        for (let i = -16; i <= 16; i++) { x.beginPath(); x.moveTo(w / 2 + i * w * .025, hz); x.lineTo(w / 2 + i * w * .2, h); x.stroke(); }
        for (let i = 0; i < 9; i++) { const k = ((i + (t * .22) % 1) / 9) ** 2, yy = hz + k * (h - hz); x.globalAlpha = k * .9; x.strokeStyle = 'rgba(34,230,255,.8)'; x.beginPath(); x.moveTo(0, yy); x.lineTo(w, yy); x.stroke(); } x.globalAlpha = 1;
        x.globalCompositeOperation = 'lighter';
        for (const p of pbgPts('bs', 24, 179)) { const per = 6 + p.s * 6, ph = ((t + p.p * 2) % per) / per, px = p.x * w + Math.sin(t * .8 + p.p) * 12, py = ph * (h + 10) - 5; glow(px, py, 2.5 + p.q * 2, p.q > .5 ? 'rgba(255,140,230,.9)' : 'rgba(120,230,255,.9)', 1 - ph * .6); }
      }
    }
    x.restore();
    // vignette keeps the text readable on any background
    const v = x.createLinearGradient(0, 0, w, 0); v.addColorStop(0, 'rgba(5,4,15,.55)'); v.addColorStop(.55, 'rgba(5,4,15,.15)'); v.addColorStop(1, 'rgba(5,4,15,0)'); x.fillStyle = v; x.fillRect(0, 0, w, h);
  }
  // static thumbnails (lists, mini cards): rendered once per size and cached
  const pbgThumbCache = {};
  function pbgThumb(id, w = 160, h = 90) {
    const k = id + w + 'x' + h; if (pbgThumbCache[k]) return pbgThumbCache[k];
    const cv = document.createElement('canvas'); cv.width = w * 2; cv.height = h * 2; const x = cv.getContext('2d'); x.scale(2, 2);
    pbgDraw(x, w, h, id, 3.3); return (pbgThumbCache[k] = cv.toDataURL('image/jpeg', .82));
  }
  // live canvases: one loop for all visible cards, ~30 fps, stops by itself when none is visible
  const pbgLive = new Set(); let pbgRaf = 0, pbgLast = 0;
  function pbgLoop(now) {
    pbgRaf = 0;
    for (const cv of [...pbgLive]) if (!cv.isConnected) pbgLive.delete(cv);
    const vis = [...pbgLive].filter(cv => cv.offsetParent !== null);
    if (!pbgLive.size) return;
    pbgRaf = requestAnimationFrame(pbgLoop);
    if (now - pbgLast < 33 || !vis.length) return; pbgLast = now;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    for (const cv of vis) {
      const w = cv.clientWidth, h = cv.clientHeight; if (!w || !h) continue;
      if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); pbgDraw(x, w, h, cv.dataset.pbg, (save.settings.quality === 'low' ? 3.3 : now / 1000));
    }
  }
  function pbgMount(root) { root.querySelectorAll('canvas[data-pbg]').forEach(cv => pbgLive.add(cv)); if (!pbgRaf) pbgRaf = requestAnimationFrame(pbgLoop); }
  // ---- what a player shows to others ----
  const PB_BADGES = () => [{ id: 'legend', name: 'Легенда Капель', got: !!save.legendBadge }, { id: 'millionaire', name: 'Миллионер', got: !!(save.badges || {}).millionaire },
    ...PROMO_BADGES.map(b => ({ id: b.id, name: b.name, got: !!(save.badges || {})[b.id], promo: true })), ...SPECIAL.map(b => ({ id: b.id, name: b.name, got: !!(save.badges || {})[b.id], src: b.src }))];
  function pbBadgeSVG(id) {
    if (!id) return '';
    if (id === 'legend') return legendBadgeSVG(true); if (id === 'millionaire') return millionBadgeSVG(true);
    const pb = PROMO_BADGES.find(b => b.id === id); if (pb) return promoBadgeSVG(pb);
    const sb = SPECIAL.find(b => b.id === id); return sb ? specialBadgeSVG(sb, true) : '';
  }
  function myShowcase() {
    const pc = save.pc || {};
    return { bg: pc.bg || 'bg_base', frame: save.frame || '', title: save.title || '', badge: pc.badge || '', skin: save.skin, lvl: playerLevel(),
      ps: (p => p && (p.s || p.n) ? { s: p.s, n: p.n } : undefined)(prestigeOf(save.xp)), league: save.totals.maxLeague || 0, chaos: save.totals.chaosMax || 0, wins: (save.legend && save.legend.wins) || 0, best: save.bests.classic || 0, ach: save.ach.length };
  }
  const LG_NAMES = ['Бронза', 'Серебро', 'Золото', 'Платина', 'Алмаз', 'Неон'], LG_COLS = ['#cd7f32', '#c0c8e0', '#ffd23f', '#7fe8ff', '#b26bff', '#ff4fd8'];
  // the avatar: the player's drop (skin) inside the avatar frame, the showcased badge at the corner
  function pcAvatar(d, size = 84) {
    const k = SKINS.find(s => s.id === d.skin) || SKINS[0], fr = decorById(d.frame);
    return `<span class="pc-av" style="--sz:${size}px"><span class="pc-ring ${fr ? 'pc-ring1' : 'pc-ring0'}"${fr ? ` style="--a:${fr.a};--b:${fr.b}"` : ''}><span class="${swClass(k)} pc-skin" style="${swatch(k)}"></span><span class="pc-eyes"><i></i><i></i></span></span>` +
      `${fr ? frameOrnSVG(fr) : ''}${d.badge ? `<span class="pc-badge">${pbBadgeSVG(d.badge)}</span>` : ''}</span>`;
  }
  // a full card: animated background + avatar, nickname, title, league, level and three numbers
  // ===== 1.7.0: avatar frames — every frame has its own ornament (SVG, drawn around the avatar; 50 units = the avatar's radius) =====
  const FRAME_STYLE = { fr_cyan: 'line', fr_glow: 'dots', fr_lv20: 'tech', fr_calendar: 'segments', fr_fire: 'flame', fr_lg3: 'shield', fr_sh1: 'petal', fr_sh2: 'petal',
    fr_cq1: 'shards', fr_cq2: 'shards', fr_cq3: 'shards', fr_cq4: 'shards', fr_q1: 'stars', fr_q2: 'stars', fr_arsenal: 'gear', fr_finish: 'checker', fr_dark: 'thorns',
    fr_ps_orbit: 'psorbit', fr_rainbow: 'prism', fr_lg4: 'crystal', fr_lg5: 'crown', fr_cvet: 'void', fr_sing: 'orbit', fr_lv40: 'star', fr_legend: 'laurel', fr_star: 'starburst',
    fr_platinum: 'ornate', fr_modes: 'medal', fr_master: 'wings', fr_xarsenal: 'horizon', fr_beta: 'holo', fr_creator: 'creator', fr_vet: 'pulse', fr_bday2026: 'bday' };
  const FRAME_GLYPH = { flame: '♨', shield: '◆', petal: '✿', shards: '◈', stars: '✦', gear: '⚙', checker: '⚑', thorns: '✶', prism: '✧', crystal: '◆', crown: '♛', void: '◉', orbit: '◌',
    star: '✦', laurel: '❦', starburst: '✺', ornate: '❖', medal: '✪', wings: '❮❯', horizon: '◎', holo: 'β', creator: '♛', pulse: '✚', bday: '✦' };
  let foUid = 0;
  function frameOrnSVG(d) {
    if (!d) return '';
    const st = FRAME_STYLE[d.id] || 'line', a = d.a || '#22e6ff', b = d.b || '#ffffff', id = 'fo' + (++foUid), G = `url(#${id}g)`, R = Math.PI / 180;
    const P = (r, deg) => [(r * Math.cos((deg - 90) * R)).toFixed(2), (r * Math.sin((deg - 90) * R)).toFixed(2)];
    const ring = (r, w, s = G, o = 1, x = '') => `<circle r="${r}" fill="none" stroke="${s}" stroke-width="${w}" opacity="${o}" ${x}/>`;
    const arc = (r, d0, d1, w, s = G, o = 1) => { const [x0, y0] = P(r, d0), [x1, y1] = P(r, d1); return `<path d="M${x0},${y0} A${r},${r} 0 ${d1 - d0 > 180 ? 1 : 0},1 ${x1},${y1}" fill="none" stroke="${s}" stroke-width="${w}" stroke-linecap="round" opacity="${o}"/>`; };
    const spin = (dur, inner, rev) => `<g>${inner}<animateTransform attributeName="transform" type="rotate" from="${rev ? 360 : 0}" to="${rev ? 0 : 360}" dur="${dur}s" repeatCount="indefinite"/></g>`;
    const blink = (dur, begin = 0, vals = '.25;1;.25') => `<animate attributeName="opacity" values="${vals}" dur="${dur}s" begin="${begin}s" repeatCount="indefinite"/>`;
    const at = (deg, r, inner, rot = true) => { const [x, y] = P(r, deg); return `<g transform="translate(${x},${y})${rot ? ` rotate(${deg})` : ''}">${inner}</g>`; };
    const star4 = (s, fill) => `<path d="M0,${-s} L${s * .22},${-s * .22} L${s},0 L${s * .22},${s * .22} L0,${s} L${-s * .22},${s * .22} L${-s},0 L${-s * .22},${-s * .22} Z" fill="${fill}"/>`;
    const gem = (w, h, fill = G) => `<path d="M0,${-h} L${w},0 L0,${h * .55} L${-w},0 Z" fill="${fill}" stroke="#fff" stroke-width=".8" stroke-opacity=".8"/><path d="M0,${-h} L0,${h * .55}" stroke="#fff" stroke-width=".6" opacity=".45"/>`;
    const n = (k, f) => Array.from({ length: k }, (_, i) => f(i, i * 360 / k)).join('');
    let o = '';
    switch (st) {
      case 'line': o = ring(52, 2.6) + ring(57, 1, a, .35) + n(4, (i, g) => at(g, 55, `<path d="M0,-3 L0,3" stroke="${b}" stroke-width="1.6" stroke-linecap="round"/>`)); break;
      case 'dots': o = ring(52, 2.4) + n(24, (i, g) => { const [x, y] = P(57, g); return `<circle cx="${x}" cy="${y}" r="${i % 3 ? 1.3 : 2}" fill="${i % 2 ? a : b}">${blink(2.4, (i * .1).toFixed(1))}</circle>`; }); break;
      case 'tech': o = ring(51, 1.2, a, .7) + spin(24, n(6, (i, g) => arc(56, g + 4, g + 46, 3.2))) + n(36, (i, g) => at(g, 52.5, `<path d="M0,0 L0,${i % 3 ? -1.6 : -3.4}" stroke="${b}" stroke-width=".9"/>`)); break;
      case 'segments': o = ring(51, 1.2, a, .6) + n(12, (i, g) => arc(56, g + 3, g + 27, 4.2, i % 2 ? a : b, i % 3 ? .85 : 1)); break;
      case 'flame': o = spin(30, n(14, (i, g) => at(g, 50, `<path d="M-5,0 C-5,-7 -1,-9 0,${-(13 + (i % 3) * 4)} C1,-9 5,-7 5,0 Z" fill="url(#${id}f)">${blink(.8 + (i % 4) * .15, (i * .07).toFixed(2), '.55;1;.7;1;.55')}</path>`))) + ring(52, 3); break;
      case 'shield': o = ring(53, 4.4) + ring(49.5, .8, '#fff', .45) + ring(57.5, .8, a, .5) + n(4, (i, g) => at(g, 55, gem(4.2, 7, `url(#${id}w)`))); break;
      case 'petal': o = ring(52, 2.4) + spin(40, n(8, (i, g) => at(g, 58, `<ellipse rx="3.6" ry="7" fill="${i % 2 ? a : b}" opacity=".9"/><circle r="1.1" cy="-1" fill="#fff" opacity=".8"/>`))) + n(16, (i, g) => { const [x, y] = P(55, g + 11); return `<circle cx="${x}" cy="${y}" r=".9" fill="#fff" opacity=".6"/>`; }); break;
      case 'shards': o = ring(51, 1.2, a, .6) + spin(16, n(7, (i, g) => arc(56 + (i % 2) * 2.5, g, g + 28 + (i % 3) * 7, 3, i % 2 ? a : b))) + spin(11, n(5, (i, g) => arc(61, g + 20, g + 34, 1.6, b, .7)), true); break;
      case 'stars': o = ring(52.5, 2.6) + ring(57, .8, a, .4) + n(5, (i, g) => at(g, 57, `<g>${star4(4.5 + (i % 2) * 1.5, i % 2 ? a : '#fff')}${blink(1.8, (i * .35).toFixed(2), '.4;1;.4')}</g>`, false)); break;
      case 'gear': o = spin(20, `<path d="${n(16, (i, g) => { const pts = [[g - 6, 52], [g - 4, 59], [g + 4, 59], [g + 6, 52]].map(([dg, r]) => P(r, dg).join(',')); return (i ? 'L' : 'M') + pts.join(' L'); })} Z" fill="none" stroke="${G}" stroke-width="2.2" stroke-linejoin="round"/>`) + ring(49.5, 1, b, .6); break;
      case 'checker': o = spin(18, ring(54.3, 3, '#ffffff', 1, 'stroke-dasharray="5.69 5.69"') + ring(54.3, 3, '#14102a', 1, 'stroke-dasharray="5.69 5.69" stroke-dashoffset="5.69"') + ring(57.7, 3, '#14102a', 1, 'stroke-dasharray="6.04 6.04"') + ring(57.7, 3, '#ffffff', 1, 'stroke-dasharray="6.04 6.04" stroke-dashoffset="6.04"')) + ring(52, 1.4, b) + ring(60, 1.4, b) + at(0, 63, `<path d="M0,-2 L0,-12 L9,-9 L0,-6" fill="${b}" stroke="#fff" stroke-width=".6"/>`, false); break;
      case 'thorns': o = n(18, (i, g) => at(g, 51, `<path d="M-3.4,0 L0,${-(9 + (i % 2) * 5)} L3.4,0 Z" fill="#14002a" stroke="${a}" stroke-width="1"/>`)) + ring(52, 3, '#14002a') + ring(52, 1.2, a); break;
      case 'prism': o = spin(6, n(12, (i, g) => arc(54, g, g + 30, 5, `hsl(${i * 30},100%,62%)`))) + n(4, (i, g) => at(g + 45, 61, `<g>${star4(3.4, '#fff')}${blink(1.4, (i * .35).toFixed(2), '0;1;0')}</g>`, false)); break;
      case 'crystal': o = ring(53, 3.4) + ring(49.5, .8, '#fff', .4) + at(0, 55, gem(5, 17) + `<g transform="translate(-8,3) rotate(-18)">${gem(3.6, 11)}</g><g transform="translate(8,3) rotate(18)">${gem(3.6, 11)}</g>`, false)
        + n(2, (i, g) => at(90 + i * 180, 55, gem(3.8, 11), true)) + at(180, 55, gem(3, 7), true) + `<g>${at(0, 60, star4(3, '#fff'), false)}${blink(2.2, 0, '0;1;0')}</g>`; break;
      case 'crown': o = ring(53, 3.6) + ring(49, .9, '#fff', .45)
        + at(0, 57, `<path d="M-14,4 L-14,-8 L-7,-2 L0,-14 L7,-2 L14,-8 L14,4 Z" fill="${G}" stroke="#fff" stroke-width="1.1" stroke-linejoin="round"/><circle cy="-15.5" r="2.2" fill="#fff"/><circle cx="-14" cy="-9.5" r="1.6" fill="${b}"/><circle cx="14" cy="-9.5" r="1.6" fill="${b}"/>`, false)
        + [270, 90].map(c => [-14, 0, 14].map(k => at(c + k, 54, gem(k ? 2.6 : 3.6, k ? 9 : 14), true)).join('')).join('')
        + `<g>${at(30, 60, star4(2.6, '#fff'), false)}${at(-40, 61, star4(2, b), false)}${blink(1.6, 0, '.2;1;.2')}</g>`; break;
      case 'void': o = ring(53, 3) + [0, 1].map(k => `<circle r="53" fill="none" stroke="${b}" stroke-width="1.6"><animate attributeName="r" values="53;68" dur="2.4s" begin="${k * 1.2}s" repeatCount="indefinite"/><animate attributeName="opacity" values=".9;0" dur="2.4s" begin="${k * 1.2}s" repeatCount="indefinite"/></circle>`).join(''); break;
      case 'psorbit': o = ring(52, 2.4) + ring(57, .8, a, .45) + spin(14, n(8, (i, g) => at(g, 57, `<g>${star4(i % 2 ? 3 : 4.6, i % 2 ? b : '#fff')}${blink(1.6, (i * .2).toFixed(1), '.45;1;.45')}</g>`, false))) + spin(26, n(4, (i, g) => at(g + 22, 62, `<circle r="1.4" fill="${b}"/>`)), true); break;
      case 'orbit': o = ring(52, 2.6) + `<g transform="rotate(-22)"><ellipse rx="66" ry="17" fill="none" stroke="${G}" stroke-width="1.6" opacity=".85"/>` +
        [0, 1].map(k => `<circle r="${k ? 2 : 3}" fill="${k ? a : '#fff'}"><animateMotion dur="${k ? 5 : 3.4}s" begin="-${k * 1.7}s" repeatCount="indefinite" path="M66,0 A66,17 0 1,1 -66,0 A66,17 0 1,1 66,0"/></circle>`).join('') + '</g>'; break;
      case 'star': o = ring(52.5, 3) + spin(26, n(4, (i, g) => at(g + 45, 58, star4(i % 2 ? 6 : 8, i % 2 ? a : '#fff'), false))) + n(12, (i, g) => { const [x, y] = P(57.5, g); return `<circle cx="${x}" cy="${y}" r=".8" fill="${b}"/>`; }); break;
      case 'laurel': o = ring(52, 2.4) + n(2, (i) => { const sg = i ? 1 : -1; return Array.from({ length: 9 }, (_, k) => { const g = 180 + sg * (20 + k * 17); return at(g, 57, `<ellipse rx="2.6" ry="6" transform="rotate(${sg * 35})" fill="${G}" stroke="#fff" stroke-width=".4" stroke-opacity=".6"/>`); }).join(''); })
        + at(0, 57, `<path d="M-9,3 L-9,-5 L-4.5,-1 L0,-9 L4.5,-1 L9,-5 L9,3 Z" fill="${G}" stroke="#fff" stroke-width=".8"/>`, false); break;
      case 'starburst': o = spin(30, n(16, (i, g) => at(g, 52, `<path d="M-2.2,0 L0,${-(i % 2 ? 8 : 13)} L2.2,0 Z" fill="${i % 2 ? b : a}"/>`))) + ring(52, 2.8); break;
      case 'ornate': o = ring(51.5, 2.2) + ring(58, 1.6) + n(8, (i, g) => at(g, 54.8, `<path d="M0,-3.6 L2.4,0 L0,3.6 L-2.4,0 Z" fill="#fff"/>`)) + n(8, (i, g) => at(g + 22.5, 54.8, `<circle r="1" fill="${b}"/>`)) + `<g>${at(0, 62, star4(3, '#fff'), false)}${blink(2, 0, '.2;1;.2')}</g>`; break;
      case 'medal': o = `<path d="M-14,44 L-22,68 L-14,63 L-9,70 L-4,48 Z M14,44 L22,68 L14,63 L9,70 L4,48 Z" fill="${G}" stroke="#fff" stroke-width=".6" stroke-opacity=".6"/>` + ring(53.5, 4.5) + n(10, (i, g) => at(g, 53.5, `<circle r="1.5" fill="#fff"/>`)); break;
      case 'wings': o = ring(52.5, 2.8) + n(2, (i) => { const sg = i ? 1 : -1; return `<g transform="scale(${sg * 1.25},1.35) translate(-10,0)">` + [0, 1, 2, 3].map(k => `<path d="M52,${-6 + k * 5} C${62 + k * 2},${-18 + k * 7} ${70 - k * 3},${-10 + k * 6} ${68 - k * 4},${-2 + k * 6} C${62},${-1 + k * 5} 58,${1 + k * 4} 52,${2 + k * 5} Z" fill="${G}" opacity="${1 - k * .15}" stroke="#fff" stroke-width=".4" stroke-opacity=".5"/>`).join('') + '</g>'; }); break;
      case 'horizon': o = ring(53, 5, `url(#${id}h)`) + spin(9, arc(58, 200, 330, 1.6, b, .9)) + spin(14, arc(62, 20, 120, 1.2, a, .7), true) + spin(6, arc(56, 90, 150, 2, '#fff', .8)); break;
      case 'holo': o = ring(51, 1, a, .7) + n(18, (i, g) => at(g, 57, `<path d="M0,-3.4 L2.9,-1.7 L2.9,1.7 L0,3.4 L-2.9,1.7 L-2.9,-1.7 Z" fill="none" stroke="${i % 3 ? a : b}" stroke-width=".9">${blink(1.2 + (i % 4) * .3, (i * .09).toFixed(2), '.3;1;.3')}</path>`)); break;
      case 'bday': o = ring(52.5, 3) + spin(30, n(14, (i, g) => { const [x, y] = P(58, g); const c = ['#22e6ff', '#ffd23f', '#3dffa2', '#ff4fd8', '#b26bff'][i % 5];
          return i % 2 ? `<rect x="${(+x - 1.8).toFixed(2)}" y="${(+y - .9).toFixed(2)}" width="3.6" height="1.8" rx=".8" fill="${c}" transform="rotate(${g + 30} ${x} ${y})"/>` : `<circle cx="${x}" cy="${y}" r="1.5" fill="${c}">${blink(1.8, (i * .12).toFixed(2))}</circle>`; }))
          + at(0, 59, `<g transform="translate(0,-3)"><rect x="-8.5" y="-3" width="17" height="7" rx="1.6" fill="#ff9ad5" stroke="#fff" stroke-width=".8"/><path d="M-8.5,-1 Q-6,1.5 -4,-1 Q-2,1.5 0,-1 Q2,1.5 4,-1 Q6,1.5 8.5,-1 V-2 Q8.5,-3 7,-3 H-7 Q-8.5,-3 -8.5,-2 Z" fill="#fff"/><rect x="-5.5" y="-10" width="2" height="7" rx=".6" fill="#22e6ff"/><rect x="-1" y="-11.5" width="2" height="8.5" rx=".6" fill="#ffd23f"/><rect x="3.5" y="-10" width="2" height="7" rx=".6" fill="#3dffa2"/><g fill="#ffb020">${blink(1, 0, '1;.55;1')}<ellipse cx="-4.5" cy="-12" rx="1.3" ry="2"/><ellipse cx="0" cy="-13.6" rx="1.3" ry="2"/><ellipse cx="4.5" cy="-12" rx="1.3" ry="2"/></g></g>`, false); break;
      case 'creator': o = spin(14, ring(57, 1.6, b, .9, 'stroke-dasharray="7 4"')) + ring(52.5, 3.6) + at(0, 58, `<path d="M-15,4 L-15,-9 L-7.5,-2 L0,-15 L7.5,-2 L15,-9 L15,4 Z" fill="${G}" stroke="#fff6c8" stroke-width="1.1" stroke-linejoin="round"/><circle cy="-16.5" r="2.4" fill="#fff"/>`, false)
        + `<g>${at(110, 60, star4(3, '#fff'), false)}${at(250, 60, star4(2.4, '#fff6c8'), false)}${blink(1.4, 0, '.1;1;.1')}</g>`; break;
      case 'pulse': { let d2 = ''; for (let g = 0; g <= 360; g += 3) { const k = g % 60, r = k > 20 && k < 24 ? 52 + 8 : k >= 24 && k < 27 ? 52 - 5 : k >= 27 && k < 30 ? 52 + 3 : 52; const [x, y] = P(r, g); d2 += (g ? 'L' : 'M') + x + ',' + y; }
        o = `<path d="${d2}Z" fill="none" stroke="${G}" stroke-width="1.8" stroke-linejoin="round"><animate attributeName="opacity" values=".55;1;.55" dur="1.3s" repeatCount="indefinite"/></path>` + at(0, 62, `<path d="M-2,-6 h4 v4 h4 v4 h-4 v4 h-4 v-4 h-4 v-4 h4 Z" fill="#fff"/>`, false); break; }
    }
    return `<svg class="pc-orn" viewBox="-72 -72 144 144" aria-hidden="true"><defs><linearGradient id="${id}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></linearGradient>` +
      `<linearGradient id="${id}f" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${a}"/><stop offset=".6" stop-color="${b}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
      `<linearGradient id="${id}w" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="${a}"/></linearGradient>` +
      `<radialGradient id="${id}h"><stop offset=".85" stop-color="${b}"/><stop offset="1" stop-color="${a}"/></radialGradient></defs>` +
      `<g style="filter:drop-shadow(0 0 2.5px ${a})">${o}</g></svg>`;
  }
  let pcUid = 0;
  function pcardHTML(d, nick, opt = {}) {
    const lv = Math.max(1, Math.min(50, d.lvl || 1)), li = Math.max(0, Math.min(5, d.league || 0)), ci = Math.max(0, Math.min(5, d.chaos || 0)), bg = pbgById(d.bg);
    const lvInfo = opt.me ? levelInfo(save.xp) : null, pct = lvInfo ? (lvInfo.max ? 100 : lvInfo.into / lvInfo.need * 100) : 100;
    return `<div class="pcard r-${bg.rar}${bg.top ? ' top' : ''}" data-bgid="${bg.id}"><canvas class="pc-bg" data-pbg="${bg.id}"></canvas><div class="pc-edge"></div>` +
      `<div class="pc-main">${pcAvatar(d, opt.mini ? 64 : 88)}<div class="pc-info"><b class="pc-nick">${escHtml(nick || 'Ты')}</b>${d.title && decorById(d.title) ? `<span class="pc-title">${titleTag(d.title)}</span>` : ''}` +
      `<small class="pc-lg">${rankEmblem(li, 22)}<span style="color:${LG_COLS[li]}">${LG_NAMES[li]}</span>${ci ? ` · ${chaosEmblem(ci, 22)}${ctTag(ci)}` : ''}</small></div>` +
      `<div class="pc-lvl"><svg viewBox="0 0 60 66" aria-hidden="true"><path d="M30 2 L57 17 V49 L30 64 L3 49 V17 Z" fill="rgba(20,10,50,.75)" stroke="url(#pcLvG${++pcUid})" stroke-width="${d.ps ? 3.2 : 2.5}"/><defs><linearGradient id="pcLvG${pcUid}" x1="0" y1="0" x2="1" y2="1">${(st => st.map((c, i) => `<stop offset="${(i / (st.length - 1)).toFixed(2)}" stop-color="${c}"/>`).join(''))(psStops(d.ps))}</linearGradient></defs></svg><small>Уровень</small><b>${lv}</b>${d.ps ? `<span class="ps-mark${d.ps.n ? ' nova' : ''}">${psLabel(d.ps)}</span>` : ''}${lvInfo ? `<i style="--p:${pct.toFixed(0)}%"></i>` : ''}</div></div>` +
      `<div class="pc-stats"><span><b>${(d.wins || 0).toLocaleString('ru-RU')}</b><small>побед</small></span><span><b>${(d.best || 0).toLocaleString('ru-RU')}</b><small>рекорд «Классики»</small></span><span><b>${d.ach || 0}</b><small>достижений</small></span></div></div>`;
  }
  // unlocks: backgrounds and the Singularity avatar frame are checked against progress; new ones are announced once
  // prestige rewards: granted the moment a step is reached (and at once for players who already have the experience)
  function prestigeCheck() {
    const p = prestigeOf(save.xp); if (!p) return;
    const first = save.psSeen === undefined, got = [];
    for (const [t, n, kind, id] of PS_REWARDS) {
      if (!psReached(p, t, n)) continue;
      if (kind === 'deco' && !save.decor.includes(id)) { save.decor.push(id); got.push(`${decorById(id).kind === 'frame' ? 'рамка' : 'титул'} «${decorById(id).name}»`); }
      if (kind === 'fx' && !save.fxOwned.includes(id)) { save.fxOwned.push(id); got.push(`эффект «${FX.find(f => f.id === id).name}»`); }
    }
    const lbl = p.label;
    if (save.psSeen !== lbl) {
      if (!first && (p.s > 0 || p.n > 0)) toast(`Престиж ${lbl}!${got.length ? ' Новая награда: ' + got.join(', ') : ''}`);
      save.psSeen = lbl; persist();
    } else if (got.length) persist();
    pbgCheck(first);
  }
  function pbgCheck(quiet) {
    save.pbg = save.pbg || []; const got = [];
    for (const b of PBG) if (!save.pbg.includes(b.id) && b.test()) { save.pbg.push(b.id); got.push(b); }
    if ((save.totals.chaosMax || 0) >= 5 && !save.decor.includes('fr_sing')) { save.decor.push('fr_sing'); if (!quiet) toast('Новая рамка: «Горизонт сингулярности»'); }
    if (!quiet) got.forEach(b => toast(`Новый фон профиля: «${b.name}»`));
    return got;
  }

  // ---- profile appearance editor: tap anything (even locked) to preview it on the live card ----
  let pdTab = 'bg', pdDraft = null;
  const PD_TABS = [['bg', 'Фон'], ['frame', 'Рамка'], ['title', 'Титул'], ['badge', 'Значок']];
  const pdOwned = (k, id) => !id ? true : k === 'bg' ? (save.pbg || []).includes(id) : k === 'badge' ? PB_BADGES().some(b => b.id === id && b.got) : save.decor.includes(id);
  const pdSrc = (k, id) => k === 'bg' ? pbgById(id).src : k === 'badge' ? ((PB_BADGES().find(b => b.id === id) || {}).src || 'особая цель') : decoSource(decorById(id));
  const pdName = (k, id) => !id ? 'нет' : k === 'bg' ? pbgById(id).name : k === 'badge' ? (PB_BADGES().find(b => b.id === id) || {}).name : decorById(id).name;
  function openDecorEditor() { pdDraft = myShowcase(); pdTab = 'bg'; renderDecorEditor(); }
  function renderDecorEditor() {
    if (!pdDraft) pdDraft = myShowcase();
    $('pdPreview').innerHTML = pcardHTML(pdDraft, Net.nick || 'Ты', { me: true }); pbgMount($('pdPreview'));
    const locked = ['bg', 'frame', 'title', 'badge'].filter(k => !pdOwned(k, pdDraft[k]));
    $('pdNote').innerHTML = locked.length ? locked.map(k => `🔒 ${PD_TABS.find(t => t[0] === k)[1]} «${escHtml(pdName(k, pdDraft[k]))}» — ${escHtml(pdSrc(k, pdDraft[k]))}`).join('<br>') : 'Всё выбранное у тебя есть — можно применить.';
    $('pdApply').disabled = !!locked.length;
    $('pdTabs').innerHTML = PD_TABS.map(([k, n]) => `<button class="tab" role="tab" data-pd="${k}" aria-selected="${pdTab === k}">${n}</button>`).join('');
    const cur = myShowcase(), tag = (k, id) => (cur[k] || '') === (id || '') ? '<span class="pd-cur">сейчас</span>' : '';
    const item = (k, id, body, name, rar) => { const own = pdOwned(k, id);
      return `<button class="pd-it${own ? '' : ' lock'}" data-pk="${k}" data-pid="${id || ''}" aria-pressed="${(pdDraft[k] || '') === (id || '')}">${body}<b>${escHtml(name)}</b>${rar ? `<span class="rr" style="color:${RARITY[rar].color}">${RARITY[rar].name}</span>` : ''}${own ? tag(k, id) : `<small>${escHtml(pdSrc(k, id))}</small>`}</button>`; };
    const order = arr => arr.sort((a, b) => (pdOwned(pdTab, b.id) - pdOwned(pdTab, a.id)) || (RAR_ORDER[a.rar] - RAR_ORDER[b.rar]));
    let html = '';
    if (pdTab === 'bg') html = order(PBG.filter(b => !b.promo || (save.pbg || []).includes(b.id)).map(b => ({ ...b }))).map(b => item('bg', b.id, `<img src="${pbgThumb(b.id)}" alt="">`, b.name, b.rar)).join('');
    else if (pdTab === 'frame') html = item('frame', '', pcAvatar({ ...pdDraft, frame: '', badge: '' }, 58), 'Без рамки') +
      order(DECOR.filter(d => d.kind === 'frame' && (!d.promo || save.decor.includes(d.id))).map(d => ({ ...d, rar: decoRarity(d) }))).map(d => item('frame', d.id, pcAvatar({ ...pdDraft, frame: d.id, badge: '' }, 58), d.name, d.rar)).join('');
    else if (pdTab === 'title') html = item('title', '', '<span class="pd-tt">—</span>', 'Без титула') +
      order(DECOR.filter(d => d.kind === 'title' && (!d.promo || save.decor.includes(d.id))).map(d => ({ ...d, rar: decoRarity(d) }))).map(d => item('title', d.id, `<span class="pd-tt">${titleTag(d.id)}</span>`, d.name, d.rar)).join('');
    else html = item('badge', '', '<span class="badge-mini pd-none">—</span>', 'Без значка') +
      PB_BADGES().filter(b => b.got || !b.promo).sort((a, b) => b.got - a.got).map(b => item('badge', b.id, `<span class="badge-mini">${pbBadgeSVG(b.id)}</span>`, b.name)).join('');
    $('pdGrid').innerHTML = html;
  }
  function applyDecor() {
    if (!pdDraft || ['bg', 'frame', 'title', 'badge'].some(k => !pdOwned(k, pdDraft[k]))) return;
    save.pc = { ...(save.pc || {}), bg: pdDraft.bg, badge: pdDraft.badge || '' }; save.frame = pdDraft.frame || null; save.title = pdDraft.title || null;
    persist(); Net.pushShowcase(); toast('Оформление профиля сохранено'); renderProfile(); renderDecorEditor();
  }
  // someone else's card (from the ranking or the chat)
  let pcReturn = null;
  async function openPlayerCard(nick) {
    pcReturn = document.activeElement; $('pcModal').hidden = false; $('pcClose').focus();
    const me = Net.nick && nick === Net.nick;
    $('pcBody').innerHTML = '<p class="empty-note">Загрузка…</p>';
    let d = me ? myShowcase() : null;
    if (!me) { const m = await Net.getShowcases([nick]); d = m.get(nick); }
    if ($('pcModal').hidden) return;
    $('pcBody').innerHTML = pcardHTML(d || { bg: 'bg_base', skin: 'coral', lvl: 1 }, nick, { me }) + (d ? '' : '<p class="info-note">Игрок ещё не оформил профиль.</p>') + (me ? '' : '<div class="pc-social" id="pcSocial"></div>');
    pbgMount($('pcBody'));
    if (!me) Net.pcSocial(nick, $('pcSocial'));
  }
  pbgCheck(true);   // what the player already has gets unlocked silently
  const closePlayerCard = () => { $('pcModal').hidden = true; if (pcReturn && pcReturn.isConnected) pcReturn.focus(); };
  function renderProfile() {
    const T = save.totals, li = leagueOf(save.season.pts), L = lgView(li, seasonStarted ? holidayOf(save.season.id) : null), lvl = levelInfo(save.xp);
    const mr = T.modeRounds || {}, fav = Object.keys(mr).sort((a, b) => mr[b] - mr[a])[0];
    const hours = Math.floor(T.time / 3600), mins = Math.floor(T.time % 3600 / 60);
    { const k = skin();
      pbgCheck(); void k;
      $('profId').innerHTML = pcardHTML({ ...myShowcase(), league: li, chaos: chaosOpen() ? chaosOf(save.chaos.pts) : 0 }, Net.nick || 'Ты', { me: true }) +
        `<div class="prof-acct2"><span>${Net.uid ? `ID игрока: <code>${Net.shortId}</code>` : 'Гость · войди в аккаунт, чтобы получить ник и ID и показывать профиль другим'}</span>` +
        `<span>Уровень ${lvl.level}${lvl.max ? ' · максимум' : ` · ${lvl.into} / ${lvl.need} опыта`} · сейчас лига <span style="color:${L.color}">${L.name}</span></span></div>`;
      pbgMount($('profId')); Net.pushShowcase();
      $('profAcct').textContent = Net.uid ? '☁ Аккаунт и сохранения' : '👤 Войти или создать аккаунт'; $('profAcct').className = 'btn g-hide prof-acct-btn' + (Net.uid ? ' ghost' : ''); }
    { const p = prestigeOf(save.xp), box = $('profPs'); box.hidden = !p;
      if (p) {
        const step = ([t, n, kind, id]) => { const got = psReached(p, t, n), nm = kind === 'deco' ? `${decorById(id).kind === 'frame' ? 'рамка' : 'титул'} «${decorById(id).name}»` : kind === 'fx' ? `${FX.find(f => f.id === id).slot === 'trail' ? 'след' : 'эффект'} «${FX.find(f => f.id === id).name}»` : kind === 'pbg' ? `фон «${pbgById(id).name}»` : id;
          return `<li class="${got ? 'got' : ''}"><b>${t === 1 ? '★' : '✦'}${n}</b><span>${nm}</span></li>`; };
        const tier = t => PS_REWARDS.filter(r => r[0] === t);
        box.innerHTML = `<div class="ps-head"><span class="ps-big${p.tier === 2 ? ' nova' : ''}">${p.label}</span><div><b>Престиж</b><small>Опыт после 50-го уровня копит звёзды: ★ — каждые 10 000, после ★25 — сверхновые ✦ по 20 000. Награды — только внешний вид.</small></div></div>` +
          `<div class="ps-bar${p.tier === 2 ? ' nova' : ''}"><i style="width:${(p.top ? 100 : p.into / p.need * 100).toFixed(1)}%"></i></div><small class="ps-note">${p.top ? 'Вершина престижа — все награды получены' : `${p.into.toLocaleString('ru-RU')} / ${p.need.toLocaleString('ru-RU')} опыта до ${p.next}`}</small>` +
          `<div class="ps-tiers"><div><small>Ступень I · ★ Звёзды</small><ul>${tier(1).map(step).join('')}</ul></div><div class="t2"><small>Ступень II · ✦ Сверхновая</small><ul>${tier(2).map(step).join('')}</ul></div></div>`;
      } }
    $('profHead').innerHTML = [
      ['Скины', `${save.skins.length} / ${SKINS.length}`], ['Эффекты', `${save.fxOwned.length} / ${FX.length}`], ['Питомцы', `${save.pets.length} / ${PETS.length}`],
      ['Способности', `${save.abil.owned.length} / ${ABILITIES.length}`], ['Коллекции', `${save.colDone.length} / ${COLLECTIONS.length}`], ['Достижения', `${save.ach.length + save.chDone.length} / ${ACH.length + CHALLENGES.length}`],
    ].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');
    $('profStats').innerHTML = [
      ['В игре', `${hours} ч ${mins} мин`], ['Раундов', T.rounds], ['Любимый режим', fav ? MODES[fav].name : '–'],
      ['Съедено капель', T.kills], ['Боссов', T.bosses], ['Прислужников', T.minions],
      ['Крошек', T.crumbs], ['Делений', T.splits], ['Выбросов', T.ejects],
      ['Лучшая волна', T.bestWave], ['Капель за раунд', T.bestKills], ['Не открыто сундуков', chestTotal()],
    ].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('');
    renderProfChests();
    $('psStats').textContent = `· раундов: ${T.rounds}`;
    $('psChests').textContent = `· открыто ${save.chestStats.total}`;
    $('psMastery').textContent = `· с уровнем ${MODE_IDS.filter(id => masteryLv(save.mastery[id] || 0)).length} из ${MODE_IDS.length}`;
    $('psSpecial').textContent = `· ${(save.legendBadge ? 1 : 0) + (save.badges && save.badges.millionaire ? 1 : 0) + SPECIAL.filter(b => save.badges && save.badges[b.id]).length + PROMO_BADGES.filter(b => save.badges && save.badges[b.id]).length} из ${2 + SPECIAL.length + PROMO_BADGES.filter(b => save.badges && save.badges[b.id]).length}`;
    $('psSeasons').textContent = `· ${save.seasonLog.length + (seasonStarted ? 1 : 0)}`;
    $('profMastery').innerHTML = '<p class="info-note" style="margin:0">Очки за каждый раунд: больше за победу и рекорд. Бронза +600 ◆, Золото +1 500 ◆, Легенда +2 500 ◆; «Легенда» во всех режимах — рамка «Мастер режимов».</p>' +
      MODE_IDS.map(id => [id, MODES[id]]).map(([id, m]) => {
        const pts = save.mastery[id] || 0, lv = masteryLv(pts), prev = lv ? MASTERY_LV[lv - 1].pts : 0, nx = MASTERY_LV[lv];
        const pct = nx ? (pts - prev) / (nx.pts - prev) * 100 : 100;
        return `<div class="m-row"><div class="m-top"><b>${m.name}</b><span class="m-lv l${lv}">${lv ? MASTERY_LV[lv - 1].name : 'нет'}</span></div>` +
          `<div class="track"><div class="fill" style="width:${pct.toFixed(0)}%"></div></div><small>${nx ? `${pts} / ${nx.pts} до «${nx.name}» · ${nx.coins ? `+${nx.coins} ◆` : nx.frame ? 'рамка' : 'титул'}` : `${pts} очков · максимум`}</small></div>`;
      }).join('');
    $('profBests').innerHTML = MODE_IDS.map(id => [id, MODES[id]]).map(([id, m]) => `<dt>${m.name}</dt><dd>${fmtBest(id, save.bests[id] || 0)}</dd>`).join('');
    { // one wall: legendary-achievement badges (a mark of the achievement) + status badges; locked ones only say where they come from
      const tile = (svg, name, got, src) => `<div class="badge-tile ${got ? '' : 'off'}" title="${name}">${svg}<b>${name}</b><small>${got ? 'получен ' + new Date(got).toLocaleDateString('ru-RU') : src}</small></div>`;
      const B = save.badges || {};
      $('profSpecial').innerHTML = tile(legendBadgeSVG(!!save.legendBadge), 'Легенда Капель', save.legendBadge, 'за все легендарные достижения') +
        tile(millionBadgeSVG(!!B.millionaire), 'Миллионер', B.millionaire, 'награда «Золотого магната II»') +
        PROMO_BADGES.filter(b => B[b.id]).map(b => tile(specialBadgeSVG(b, true), b.name, B[b.id], b.src)).join('') +
        SPECIAL.map(b => tile(specialBadgeSVG(b, !!B[b.id]), b.name, B[b.id], b.src)).join(''); }
    $('badgeTitle').textContent = `Значки сезонов · ${save.seasonLog.length} из ${SEASON_YEAR}`;
    { const live = chaosStarted ? [{ id: save.chaos.id, tier: chaosOf(save.chaos.pts), live: true }] : [], all = [...live, ...save.chaosLog.slice().reverse()];
      $('chaosBadgeTitle').textContent = `Значки Хаос-лиги · ${save.chaosLog.length}`;
      $('profChaosBadges').innerHTML = all.length ? all.map(x => `<div class="badge-tile ${x.live ? 'live' : ''}" style="--bc:${CHAOS_TIERS[x.tier].color}" title="Хаос-сезон ${x.id}: ${CHAOS_TIERS[x.tier].name}">${chaosBadgeSVG(x)}<b>Хаос-сезон ${x.id}</b><small>${x.live ? 'идёт' : CHAOS_TIERS[x.tier].name}</small></div>`).join('')
        : '<p class="empty-note" style="grid-column:1/-1">Значок выдаётся в конце каждого Хаос-сезона, в котором ты набрал хотя бы одно очко. Форма, цвет и знак — по ступени: Искра, Помеха, Сбой, Шторм, Разлом, Сингулярность.</p>'; }
    const liveSd = seasonData(save.season.id);
    const live = seasonStarted ? { id: save.season.id, league: leagueOf(save.season.pts), pts: save.season.pts, name: liveSd.name, holiday: liveSd.holiday, live: true } : null;
    const all = [...save.seasonLog.slice().reverse(), ...(live ? [live] : [])].sort((p, q) => q.id - p.id);
    badgeList = all;
    $('profBadges').innerHTML = all.length ? all.map((x, i) => { const L = lgView(x.league, x.holiday);
      return `<button class="badge-tile ${x.live ? 'live' : ''}" data-b="${i}" aria-pressed="false" style="--bc:${L.color}">${badgeSVG(x)}<b>${x.name || 'Сезон ' + x.id}</b><small>${x.live ? 'идёт' : L.name}</small></button>`; }).join('')
      : '<p class="empty-note" style="grid-column:1/-1">Значок выдаётся в конце каждого сезона, в котором ты набрал хотя бы одно очко. Форма значка зависит от лиги: медаль, щит, шестиугольник, восьмиугольник, ромб или звезда.</p>';
    $('badgeInfo').hidden = true;
    $('profSeasons').innerHTML = [`<li><span>Сезон ${save.season.id} (идёт)</span><span class="rw" style="color:${L.color}">${L.name} · ${save.season.pts}</span></li>`,
      ...save.seasonLog.slice().reverse().map(x => `<li><span>Сезон ${x.id}${x.name ? ` «${x.name}»` : ''}</span><span class="rw" style="color:${lgView(x.league, x.holiday).color}">${lgView(x.league, x.holiday).name} · ${x.pts}</span></li>`)].join('');
    requestAnimationFrame(drawProfChart);
    $('ptStats').textContent = `${hours} ч в игре · раундов ${T.rounds}`;
    $('ptMastery').textContent = $('psMastery').textContent.replace(/^· /, '');
    $('ptBadges').textContent = `особых ${$('psSpecial').textContent.replace(/^· /, '')} · сезонов ${save.seasonLog.length + save.chaosLog.length}`;
    $('ptSeasons').textContent = `лига: ${save.seasonLog.length} · Хаос: ${save.chaosLog.length}`;
  }
  function renderProfChests() {
    const S = save.chestStats, sum = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
    const wk = k => save.chestDays.reduce((a, d) => a.map((v, i) => v + d[k][i]), [0, 0, 0]);
    const n = wk('n'), r = wk('r');
    const perH = a => a[0] >= 60 ? (a[2] / (a[0] / 3600)).toFixed(1).replace('.', ',') : '–';
    const hrs = a => a[0] < 3600 ? `${Math.round(a[0] / 60)} мин` : `${(a[0] / 3600).toFixed(1).replace('.', ',')} ч`;
    $('profChests').innerHTML = [
      ['Открыто всего', S.total], ['Не открыто', chestTotal()],
      ['В час · обычные бои', perH(n)], ['В час · рейтинг', perH(r)],
    ].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('') +
      `<p class="info-note" style="grid-column:1/-1;margin:0">Сундуки за раунды за последние 7 дней: обычные бои — ${n[2]} за ${hrs(n)} (раундов: ${n[1]}), рейтинг — ${r[2]} за ${hrs(r)} (боёв: ${r[1]}). Ожидается около 3 в час в обычных боях и около 4,3 в рейтинге.</p>`;
    $('chestDrawerCnt').textContent = `· с ${new Date(S.since).toLocaleDateString('ru-RU')}`;
    const rarCell = (o, k) => `<span style="color:${RARITY[k].color}">${o[k] || 0}</span>`;
    const tot = {}; Object.values(S.src).forEach(o => Object.entries(o).forEach(([k, v]) => tot[k] = (tot[k] || 0) + v));
    $('chestDrawerBody').innerHTML = !S.total ? '<p class="empty-note">Пока не открыто ни одного сундука. Счёт идёт с обновления 33.</p>' :
      '<table class="lg-odds ch-tab"><tr><th>Откуда</th><th>Всего</th>' + RAR_KEYS.map(k => `<th style="color:${RARITY[k].color}" title="${RARITY[k].name}">${{ common: 'Об.', rare: 'Ред.', epic: 'Эп.', legendary: 'Лег.' }[k]}</th>`).join('') + '</tr>' +
      Object.keys(CHEST_SRC).filter(k => sum(S.src[k])).map(k => `<tr><td>${CHEST_SRC[k]}</td><td>${sum(S.src[k])}</td>${RAR_KEYS.map(rk => `<td>${rarCell(S.src[k], rk)}</td>`).join('')}</tr>`).join('') +
      `<tr><td><b>Итого</b></td><td><b>${S.total}</b></td>${RAR_KEYS.map(rk => `<td><b>${rarCell(tot, rk)}</b></td>`).join('')}</tr></table>` +
      `<p class="info-note" style="margin:0">Гарантия легендарного: подряд без легендарного ${save.legPity || 0} из ${LEG_PITY}.</p>`;
  }
  $('chartDrawer').addEventListener('toggle', () => { if ($('chartDrawer').open) requestAnimationFrame(drawProfChart); });
  let badgeList = [];
  $('profBadges').addEventListener('click', e => {
    const b = e.target.closest('.badge-tile'); if (!b) return;
    const x = badgeList[+b.dataset.b], L = lgView(x.league, x.holiday);
    document.querySelectorAll('#profBadges .badge-tile').forEach(t => t.setAttribute('aria-pressed', t === b));
    const info = $('badgeInfo'); info.style.setProperty('--bc', L.color); info.innerHTML = badgeDesc(x, x.live); info.hidden = false;
  });
  function drawProfChart() {
    const cv = $('profChart'), w = cv.clientWidth, h = cv.clientHeight, dpr = Math.min(devicePixelRatio, 2);
    if (!w) return;
    cv.width = w * dpr; cv.height = h * dpr;
    const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h);
    const data = save.history, padB = 16, padT = 16;
    x.fillStyle = tok('--muted'); x.font = `600 11px ${tok('--body')}`;
    if (!data.length) { x.textAlign = 'center'; x.fillText('Сыграй раунд, и здесь появится график', w / 2, h / 2); return; }
    const max = Math.max(...data.map(d => d.m), 10), bw = (w - 4) / 30;
    x.strokeStyle = tok('--line'); x.lineWidth = 1;
    [0, .5, 1].forEach(f => { const y = padT + f * (h - padT - padB); x.beginPath(); x.moveTo(0, y); x.lineTo(w, y); x.stroke(); });
    data.forEach((d, i) => {
      const bh = d.m / max * (h - padT - padB), bx = 2 + i * bw;
      x.fillStyle = d.m === max ? tok('--gold') : tok('--food');
      x.globalAlpha = .85; x.fillRect(bx + 1, h - padB - bh, Math.max(2, bw - 3), bh); x.globalAlpha = 1;
    });
    x.fillStyle = tok('--muted'); x.textAlign = 'left'; x.fillText(`макс. ${max}`, 2, 11);
    x.textAlign = 'right'; x.fillText(`${data.length} раунд(ов)`, w - 2, h - 3);
  }
  // grouped cards (Profile, Information): tiles open a group; «←» returns to the tiles
  function resetGroups(card) { card.querySelectorAll('.g-tiles, .g-hide').forEach(x => x.hidden = false); card.querySelectorAll('[data-grpid]').forEach(g => g.hidden = true); }
  document.addEventListener('click', e => {
    const t = e.target.closest('[data-grp]');
    if (t) { const card = t.closest('.card'); card.querySelectorAll('.g-tiles, .g-hide').forEach(x => x.hidden = true);
      card.querySelectorAll('[data-grpid]').forEach(g => g.hidden = g.dataset.grpid !== t.dataset.grp);
      $('overlay').scrollTop = 0; if (t.dataset.grp === 'pStats') requestAnimationFrame(drawProfChart);
      const f = card.querySelector(`[data-grpid="${t.dataset.grp}"] summary`); if (f) f.focus(); return; }
    const bk = e.target.closest('[data-grpback]');
    if (bk) { const card = bk.closest('.card'), from = bk.closest('[data-grpid]').dataset.grpid; resetGroups(card); $('overlay').scrollTop = 0; const tl = card.querySelector(`[data-grp="${from}"]`); if (tl) tl.focus(); }
  });
  // the account chip at the top of the menu opens the profile; the account window is one tap further (button in the profile)
  function openProfile() { resetGroups($('profileCard')); showCard('profileCard'); renderProfile(); $('profBack').focus(); }
  $('acctChip').addEventListener('click', openProfile);
  $('profBack').addEventListener('click', () => { showCard('menuCard'); $('acctChip').focus(); });
  $('profAcct').addEventListener('click', () => Net.openAccount(undefined, 'profileCard'));
  document.querySelector('[data-grp="pDecor"]').addEventListener('click', () => setTimeout(openDecorEditor, 0));
  $('pdTabs').addEventListener('click', e => { const b = e.target.closest('[data-pd]'); if (b) { pdTab = b.dataset.pd; renderDecorEditor(); } });
  $('pdGrid').addEventListener('click', e => { const b = e.target.closest('[data-pk]'); if (!b) return; pdDraft = { ...pdDraft, [b.dataset.pk]: b.dataset.pid }; renderDecorEditor(); const again = document.querySelector(`[data-pk="${b.dataset.pk}"][data-pid="${b.dataset.pid}"]`); if (again) again.focus({ preventScroll: true }); });
  $('pdApply').addEventListener('click', applyDecor);
  $('pcClose').addEventListener('click', closePlayerCard);
  $('pcBody').addEventListener('click', e => { const box = $('pcSocial'); if (box && box.contains(e.target)) Net.pcSocialClick(e, box); });
  $('pcModal').addEventListener('click', e => { if (e.target === $('pcModal')) closePlayerCard(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('pcModal').hidden) { e.stopPropagation(); closePlayerCard(); } }, true);

  // menus scroll by script on touch screens: some app viewers swallow native vertical swipes.
  // A swipe first scrolls the nearest inner scrollable list (e.g. the profile decor grid),
  // and hands the rest to the overlay once that list reaches its edge.
  (function menuScroll() {
    const ov = $('overlay');
    // chain: inner scrollable lists under the finger, then the overlay; pos is tracked as
    // absolute offsets from the touch start, so browsers that round scrollTop lose nothing
    let y0 = null, lastY = 0, lastT = 0, vel = 0, raf = 0, chain = [], base = [], total = 0;
    const scrollable = el => { if (el.scrollHeight <= el.clientHeight + 1) return false; const o = getComputedStyle(el).overflowY; return o === 'auto' || o === 'scroll'; };
    const apply = () => {
      let rest = total;
      chain.forEach((el, i) => {
        const max = Math.max(0, el.scrollHeight - el.clientHeight);
        const to = Math.min(max, Math.max(0, base[i] + rest));
        if (Math.round(el.scrollTop) !== Math.round(to)) el.scrollTop = to;
        rest -= to - base[i];
      });
      return rest;
    };
    ov.addEventListener('touchstart', e => {
      if (e.touches.length !== 1 || e.target.closest('input[type="range"]')) { y0 = null; return; }
      cancelAnimationFrame(raf);
      chain = [];
      for (let el = e.target; el && el !== ov; el = el.parentElement) if (scrollable(el)) chain.push(el);
      chain.push(ov);
      base = chain.map(el => el.scrollTop); total = 0;
      y0 = lastY = e.touches[0].clientY; lastT = performance.now(); vel = 0;
    }, { passive: true });
    ov.addEventListener('touchmove', e => {
      if (y0 === null) return;
      const y = e.touches[0].clientY, t = performance.now();
      total = y0 - y; apply();
      vel = (lastY - y) / Math.max(1, t - lastT); lastY = y; lastT = t;
      e.preventDefault();
    }, { passive: false });
    const end = () => {
      if (y0 === null) return;
      y0 = null;
      let v = vel * 16, rest = apply();
      const step = () => {
        if (Math.abs(v) < 0.5) return;
        total += v;
        const r = apply();
        if (Math.abs(r - rest - v) < 0.01) return;   // nothing moved: every list hit its edge
        rest = r; v *= 0.94; raf = requestAnimationFrame(step);
      };
      step();
    };
    ov.addEventListener('touchend', end);
    ov.addEventListener('touchcancel', end);
  })();

