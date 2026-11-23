  // ================= TEST COPY ONLY (tools/build-site-test.py adds this file to js/loader.js): the test panel, stress tests, the round journal =================
  // The main game never loads it; the few places elsewhere that use its names are behind «TEST_MODE &&».
  // ---------- test panel (test build only): quick ways to reach any state; features add their own groups to TEST_GROUPS ----------
  const TEST_GROUPS = [];
  let testStartMass = 0, testEatShow = false, testEatI = 0, testEatT = 1, testOnlyBonus = null;
  function testEatTick(dt) {   // plays every eat effect in turn in front of the player
    testEatT -= dt; if (testEatT > 0 || !player.cells.length) return; testEatT = 1.6;
    const list = FX.filter(f => f.slot === 'eat'), f = list[testEatI++ % list.length], m = mainOf(player), d = cellR(m) + 8;
    eatFx(m.x + m.hx * d, m.z + m.hz * d, radius(14), '#ff8a5c', f.id); toast(`${testEatI}/${list.length} · ${f.name}`);
  }
  // 2.7: the panel is split into sections; one section is shown at a time (no long list to swipe)
  const TEST_TABS = [['reports', '📋 Отчёты'], ['progress', 'Прогресс'], ['collect', 'Коллекции'], ['modes', 'Режимы'], ['tech', 'Графика'], ['reset', 'Сброс']];
  const TEST_TAB_OF = { 'Уровень и престиж': 'progress', 'Всё сразу': 'progress', 'Цели': 'progress', 'Монеты и сундуки': 'progress',
    'Достижения': 'collect', 'Мастерская': 'collect', 'Эволюции': 'collect', 'Старт раунда': 'modes', 'Хардкор': 'modes', 'Графика': 'tech', 'Сохранение': 'reset' };
  let testTab = 'reports', testFilter = 'all';
  function testAdd(title, buttons) { TEST_GROUPS.push({ title, buttons, tab: TEST_TAB_OF[title] || 'modes' }); }

  // ---- 2.7: the round journal (TLog in 01-config.js) ----
  // every frame of a round: starts the record, samples speed and mass, notes what slowed you down, territory share, being eaten
  let tlAlive = false, tlShareT = 0;
  function testLogTick(dt) {
    if (!running || dying) return;
    if (!TLog.on) {
      const how = DuoM.server ? 'сервер' : DuoM.practice ? 'с ботом' : DuoM.on ? 'напрямую' : '';
      TLog.begin({ mode: stressRun ? 'stress' : mode, name: stressRun ? 'Стресс · ' + stressRun.name : (MODES[mode] || {}).name || mode, how, role: DuoM.role || null,
        diff: mode === 'duoback' && DuoM.rules.duoback?.diffNow ? DuoM.rules.duoback.diffNow() : null,
        ranked: !!stats.ranked, chaos: !!stats.chaos, arena: stats.arena || null, quality: save.settings.quality,
        build: runBuild.filter(Boolean), startMass: Math.round(total(player)),
        char: (typeof charNow === 'function' && charNow()) || null, look: { skin: save.skin, form: (save.evo || {})[save.skin] || null, hat: save.hat || null, aura: save.fx.aura || null, trail: save.fx.trail || null, eat: save.fx.eat || null, pet: save.pet || null } });   // 2.7 FPS: what the player wears
      tlAlive = player.cells.length > 0; tlShareT = 0;
    }
    if (paused) return;
    let m = 0, v = 0;
    for (const c of player.cells) { m += c.mass; v += speedOf(c) * c.mass; }
    const pct = m ? v / m / BASE_SPEED * 100 : 100, causes = [];
    if (player.freezeT > 0) causes.push('оглушение'); if (player.slowT > 0) causes.push((player.auraT || 0) > 0 ? 'облако мороза' : 'замедление'); if (player.iceT > 0) causes.push('лёд');
    if (ModeX.hcCurseId?.() === 'slow') causes.push('проклятие «Вязкость»');
    TLog.tick(dt, pct, m, causes);
    const alive = player.cells.length > 0;
    if (tlAlive && !alive) TLog.ev('меня съели');
    tlAlive = alive;
    if (DuoM.mode === 'territory' && (tlShareT -= dt) <= 0) { tlShareT = 10; const sh = DuoM.rules.territory?.shareNow?.(); if (Number.isFinite(sh)) TLog.ev('моя доля поля %', Math.round(sh * 100)); }
  }
  // ---- 2.7: stress tests — the same scripted 60 s on any phone and version, the game drives itself; the result goes to the journal («Стресс-тесты») ----
  let stressRun = null, stressQueue = null;
  const QNAME = { low: 'Низкое', medium: 'Среднее', high: 'Высокое' };
  // each step: [label, action, effects level 0–2]; 2.7: heavier after the first phone run (Mali-G610 kept ~56 FPS)
  // 2.7: one test — the load ladder, then the effects storm at the top mass (12 steps × 10 s), run on every quality preset
  const STRESS = {
    // 2.7: the test that looks like a real round — Hardcore, the autopilot hunts and eats (bots, packs, bosses), a minute per stage, 6 minutes
    real: { name: 'Хардкор с охотой', mode: 'hardcore', stepMs: 60000, hunt: true, steps: [
      ['старт: охота с 1 000', () => {}, 0],
      ['20 000 + звездопад', () => { stressMass(20000); stressEvent('starfall'); }, 0],
      ['40 000 + землетрясение', () => { stressMass(40000); stressEvent('quake'); }, 0],
      ['60 000: две половины', () => { stressMass(60000); }, 0],
      ['80 000 + проклятие, награда за голову', () => { stressMass(80000); try { ModeX.hcCurseSoon(); } catch (e) {} stressEvent('bounty'); }, 0],
      ['100 000 + монетный дождь', () => { stressMass(100000); stressEvent('coinrain'); }, 0]] },
    full: { name: 'Стресс-тест', steps: [
      ['5 000 + 2 босса', () => { stressMass(5000); stressBosses(2); }, 0],
      ['25 000 + 3 босса, боты крупнее', () => { stressMass(25000); stressBosses(3); stressBots(3000, 6000); }, 0],
      ['деление на максимум частей', () => { for (let i = 0; i < 8; i++) { player.splitCd = 0; split(); } }, 1],
      ['60 000 + 4 босса', () => { stressMass(60000); stressBosses(4); }, 1],
      ['толпа: все боты 5–9 тыс. + эффекты', () => { stressBots(5000, 9000); stressBosses(4); }, 2],
      ['100 000 + звездопад', () => { stressMass(100000); stressBosses(4); stressEvent('starfall'); }, 2],
      ...['rift', 'wind', 'eclipse', 'golden', 'coinrain', 'quake'].map(id => ['шторм: «' + evInfo(id).name + '»', () => { stressBosses(4); stressEvent(id); }, 2])] },
    // 2.7 (owner's idea): how much room is left — 20, 30, 40 drops of bots on the field (bots split into parts and stay split), in their own looks;
    // the step's 4th item runs every second and tops the crowd up
    crowd: { name: 'Толпа', mode: 'classic', stepMs: 60000, steps: [
      ['20 мобов', () => { stressMass(5000); }, 0, () => stressCrowd(20)],
      ['30 мобов', () => {}, 0, () => stressCrowd(30)],
      ['40 мобов', () => {}, 0, () => stressCrowd(40)],
      ['40 мобов + 4 босса + 60 000', () => { stressMass(60000); stressBosses(4); }, 0, () => { stressCrowd(40); stressBosses(4); }]] }
  };
  // bots' drops up to n: the bots with the fewest parts split (a part keeps 2 000–5 000 mass), parts stay apart for 30 s
  function stressCrowd(n) {
    const bc = () => bots.reduce((s, o) => s + o.cells.length, 0);
    for (const o of bots) for (const c of o.cells) { if (c.mass < 2000) c.mass = 2000 + stressRnd() * 3000; c.mergeT = Math.max(c.mergeT || 0, 30); }
    for (let guard = 0; guard < 80 && bc() < n; guard++) {
      const o = bots.filter(b => b.cells.length && b.cells.length < BOT_PARTS && b.free.length).sort((a, b) => a.cells.length - b.cells.length)[0]; if (!o) break;
      for (const c of o.cells) c.mass = Math.max(c.mass, 4000);
      if (!splitOwner(o, o.cells.length + 1, 30)) break; rebuildCells();
    }
    return bc();
  }
  let stressSeed = 1;
  const stressRnd = () => { stressSeed = (stressSeed * 16807) % 2147483647; return stressSeed / 2147483647; };
  function stressMass(m) { const sum = total(player); if (!sum) return; if (sum < m) { const c = mainOf(player); c.mass += m - sum; } }
  function stressBots(lo, hi) { bots.forEach(o => o.cells.forEach(c => { c.mass = Math.max(c.mass, lo + stressRnd() * (hi - lo)); })); }
  function stressBosses(n) { const types = Object.keys(BOSS_TYPES); for (let i = 0; i < 12 && bossOwners.filter(o => o.cells.length).length < n; i++) try { spawnBoss(types[i % types.length]); } catch (e) {} }
  function stressEvent(id) { evClear(); ev.warn = null; ev.active = id; ev.left = 10; evStart(); }
  async function stressStart(id, quality) {
    if (running) return 'сначала выйди из раунда';
    const sc = STRESS[id]; let build = '';
    try { build = ((await (await fetch('sw.js', { cache: 'no-store' })).text()).match(/kapli3d[a-z]*-(v\d+)/) || [])[1] || ''; } catch (e) {}
    stressRun = { id, name: sc.name, sc, build, keep: { mode: save.mode, char: save.char, autoQ: save.settings.autoQ, quality: save.settings.quality, startMass: testStartMass, rnd: Math.random } };
    if (quality && quality !== save.settings.quality) { save.settings.quality = quality; applySettings(); }
    stressSeed = 20271; Math.random = stressRnd;   // the same scene every run
    save.mode = sc.mode || 'classic'; save.char = null; save.settings.autoQ = false; testStartMass = 1000; charChosen = true;
    $('testModal').hidden = true;
    $('startBtn').click();
    if (!running) { stressStop(); stressQueue = null; return 'раунд не начался'; }
    const R0 = stressRun; R0.t0 = performance.now(); R0.last = R0.t0; R0.step = -1; R0.secT = R0.t0; R0.secN = 0; R0.all = []; R0.steps = []; R0.fxT = 0; R0.abT = 0; R0.abI = 0; R0.huntT = 0; R0.prey = null; R0.stepMs = sc.stepMs || 10000;
    ev.timer = 999;   // no random arena events: the script decides
    requestAnimationFrame(stressFrame);
    return 'идёт ' + sc.name + ' · ' + (QNAME[save.settings.quality] || save.settings.quality) + ` (${Math.round(sc.steps.length * R0.stepMs / 60000 * 10) / 10} мин)`;
  }
  function stressStop(keepQuality) {
    const R0 = stressRun; if (!R0) return; stressRun = null;
    Math.random = R0.keep.rnd; save.mode = R0.keep.mode; save.char = R0.keep.char; save.settings.autoQ = R0.keep.autoQ; testStartMass = R0.keep.startMass; mode = save.mode;
    if (!keepQuality && save.settings.quality !== R0.keep.quality) { save.settings.quality = R0.keep.quality; applySettings(); }
    joy.id = null; joy.mag = 0; persist();
  }
  // the full run: both scenarios on every quality preset, one after another (~6 min), then one comparison record
  function stressAll() {
    if (running) return 'сначала выйди из раунда';
    stressQueue = { list: ['low', 'medium', 'high'].map(q => ['full', q]), res: [], quality: save.settings.quality };
    stressNext(); return 'стресс-тест: 3 прогона по 2 мин (Низкое, Среднее, Высокое) — телефон не трогай';
  }
  function stressNext() {
    const Q = stressQueue; if (!Q) return;
    const nx = Q.list.shift();
    if (!nx) {
      if (save.settings.quality !== Q.quality) { save.settings.quality = Q.quality; applySettings(); persist(); }
      TLog.begin({ mode: 'stress', name: 'Стресс · сравнение настроек', quality: Q.quality });
      TLog.end({ dur: Q.res.length * 120, end: Q.res.map(r => `${QNAME[r.quality]}: ${r.avg}/${r.low1}`).join(' · '), cmp: Q.res });
      stressQueue = null; toast('Полный прогон готов — сравнение в журнале «Стресс-тесты»'); return;
    }
    stressStart(nx[0], nx[1]).then(m => { if (!running) { stressQueue = null; toast('Полный прогон остановлен: ' + m); } });
  }
  const stressPct = (a, q) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
  function stressSum(ms, secs) {
    const n = ms.length, tot = ms.reduce((a, b) => a + b, 0);
    return { avg: n ? Math.round(n * 1000 / tot) : null, min: secs.length ? Math.min(...secs) : null, low1: n ? Math.round(1000 / stressPct(ms, .99)) : null,
      h50: ms.filter(x => x > 50).length, h100: ms.filter(x => x > 100).length, worst: n ? Math.round(Math.max(...ms)) : 0 };
  }
  function stressFrame(now) {
    const R0 = stressRun; if (!R0) return;
    { const hb = document.querySelector('#hcPick:not([hidden]) [data-hi], #rbPick:not([hidden]) [data-hi]'); if (hb) hb.click(); }   // milestone cards: the first one
    if (!running || dying || paused) { toast('Стресс-тест прерван'); stressQueue = null; stressStop(); return; }
    const el = now - R0.t0, dtm = now - R0.last; R0.last = now;
    if (R0.step >= 0 && dtm > 0) { R0.cur.ms.push(dtm); R0.all.push(dtm); const P = R0.cur.parts = R0.cur.parts || [0, 0, 0, 0]; P[0] += framePrev[0]; P[1] += framePrev[1]; P[2] += framePrev[2]; P[3]++; }
    R0.secN++; if (now - R0.secT >= 1000) { const f = Math.round(R0.secN * 1000 / (now - R0.secT)); if (R0.cur) R0.cur.secs.push(f); R0.secs = R0.secs || []; R0.secs.push(f); R0.secN = 0; R0.secT = now; }
    const step = Math.min(R0.sc.steps.length, Math.floor(el / R0.stepMs));
    if (step !== R0.step) {
      if (R0.cur) stressClose(R0);
      if (step >= R0.sc.steps.length) { stressFinish(R0); return; }
      R0.step = step; const [label, act, fx] = R0.sc.steps[step];
      R0.cur = { label, fx, keep: R0.sc.steps[step][3] || null, ms: [], secs: [], eats0: (stats.kills || 0) + (stats.bosses || 0) + (stats.minions || 0) }; R0.keepT = 0; try { act(); } catch (e) { R0.cur.err = String(e.message).slice(0, 80); }
      toast(`Стресс · ${QNAME[save.settings.quality] || ''} · ${step + 1}/${R0.sc.steps.length}: ${label}`); TLog.ev('стресс: шаг', label);
    }
    if (R0.cur && R0.cur.keep && (R0.keepT -= dtm) <= 0) { R0.keepT = 1000; try { R0.cur.keep(); } catch (e) { R0.cur.err = String(e.message).slice(0, 80); } }
    if (R0.cur && !R0.cur.census && el - R0.step * R0.stepMs > R0.stepMs * .7) { try { R0.cur.census = drawCensus(); } catch (e) {} }   // what is drawn, late in the step
    effects.shield = Math.max(effects.shield || 0, 1);   // nobody eats the autopilot: the run always lasts 60 s
    // autopilot: circles the arena, so the camera passes everything
    if (player.cells.length && R0.sc.hunt && (R0.huntT -= dtm) <= 0) {   // the hunter: the nearest drop it can eat, within reach
      R0.huntT = 250; const m = mainOf(player); let best = null, bd = 220 * 220;
      for (const t of cells) { if (t.owner.isPlayer || t.gone || !canEat(m, t)) continue; const dx = t.x - m.x, dz = t.z - m.z, d = dx * dx + dz * dz; if (d < bd) { bd = d; best = t; } }
      R0.prey = best;
    }
    if (R0.prey && (R0.prey.gone || !player.cells.length)) R0.prey = null;
    if (player.cells.length) { const m = mainOf(player), a = el / 1000 * .22, tx = R0.prey ? R0.prey.x : Math.cos(a) * R * .38, tz = R0.prey ? R0.prey.z : Math.sin(a) * R * .38, d = hyp(tx - m.x, tz - m.z) || 1;
      joy.id = 'stress'; joy.mag = .85; joy.x = (tx - m.x) / d; joy.y = (tz - m.z) / d; }
    const fx = R0.cur ? R0.cur.fx : 0;
    if (fx) {   // effects on top: bursts of particles, eat effects and abilities (level 2: twice as often and bigger)
      R0.fxT -= dtm; R0.abT -= dtm;
      if (R0.fxT <= 0 && player.cells.length) { R0.fxT = fx > 1 ? 120 : 250; const m = mainOf(player), n = fx > 1 ? 5 : 3;
        for (let k = 0; k < n; k++) { const x = m.x + (stressRnd() - .5) * 70, z = m.z + (stressRnd() - .5) * 50; emit(x, 1, z, ['#ff4fd8', '#22e6ff', '#ffd23f', '#3dffa2', '#9b5cff'][k], fx > 1 ? 60 : 40, 14, .8); eatFx(x, z, 2 + stressRnd() * 5, new THREE.Color('#3dffa2')); } }
      if (R0.abT <= 0 && player.cells.length) { R0.abT = fx > 1 ? 800 : 1500; const ids = ABILITIES.filter(a => !a.cr && !['split', 'blink', 'x_twin', 'rewind'].includes(a.id)).map(a => a.id), id = ids[R0.abI++ % ids.length];
        player.abCd[id] = 0; try { castAbility(id); } catch (e) {} }
    }
    requestAnimationFrame(stressFrame);
  }
  function stressClose(R0) {
    const c = R0.cur, ri = renderer.info.render, mem = performance.memory;
    R0.steps.push({ step: c.label, ...stressSum(c.ms, c.secs), calls: ri.calls, tris: Math.round(ri.triangles / 1000) + 'k', cells: cells.length, mobs: bots.reduce((s, o) => s + o.cells.length, 0), logicMs: c.parts ? +(c.parts[0] / c.parts[3]).toFixed(1) : null, drawMs: c.parts ? +(c.parts[1] / c.parts[3]).toFixed(1) : null, hudMs: c.parts ? +(c.parts[2] / c.parts[3]).toFixed(1) : null, mine: player.cells.length,
      bosses: bossOwners.filter(o => o.cells.length).length, mass: Math.round(total(player)), eaten: (stats.kills || 0) + (stats.bosses || 0) + (stats.minions || 0) - (c.eats0 || 0), fx: pActive.length + eActive.length, heap: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null, drawn: c.census || null, err: c.err });
    R0.cur = null;
  }
  function stressFinish(R0) {
    const res = { scenario: R0.id, name: R0.name, build: R0.build, quality: save.settings.quality, px: Math.round(renderer.getPixelRatio() * 100) / 100, ...stressSum(R0.all, R0.secs || []), steps: R0.steps };
    TLog.extra('stress', res);
    const worst = R0.steps.reduce((a, b) => (b.avg ?? 99) < (a.avg ?? 99) ? b : a, R0.steps[0] || {});
    const queued = !!stressQueue;
    stressStop(queued);
    TLog.end({ dur: Math.round(R0.sc.steps.length * R0.stepMs / 1000), peak: Math.round(stats.maxMass), final: Math.round(total(player)), end: `${res.avg} FPS · мин ${res.min} · 1% ${res.low1}`, st: { avg: res.avg, min: res.min, low1: res.low1, h50: res.h50, h100: res.h100, build: res.build } });
    try { endRound(); } catch (e) {}
    if (queued) { stressQueue.res.push({ name: res.name, quality: res.quality, build: res.build, avg: res.avg, min: res.min, low1: res.low1, h50: res.h50, h100: res.h100, worstStep: worst.step,
        steps: R0.steps.map(x => [x.step, x.avg, x.low1, x.h50, x.calls]) });   // [step, average FPS, 1% FPS, hitches, draw calls]
      setTimeout(() => { try { $('menuBtn').click(); } catch (e) {} setTimeout(stressNext, 800); }, 1500); return; }
    toast(`Стресс-тест готов: ${res.avg} FPS, минимум ${res.min}, худший шаг «${worst.step}» — отчёт в журнале «Стресс-тесты»`);
  }
  const tlTime = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  const tlDate = t => new Date(t).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const tlLabel = r => `${r.name || r.mode}${r.how ? ' · ' + r.how : ''}${r.diff ? ' · ' + r.diff : ''}`;
  function tlText(list) {
    const head = `=== Капли 3D · отчёты (${list.length}) · ${new Date().toLocaleString('ru-RU')} ===`;
    return [head, ...list.map((r, i) => `#${i + 1} [${tlLabel(r)}] ${tlDate(r.at)} · ${tlTime(r.dur || 0)} · ${r.end || ''}\n` + JSON.stringify(r))].join('\n');
  }
  function tlCopy(list) {
    if (!list.length) return 'пока нет отчётов — сыграй раунд до конца';
    const txt = tlText(list);
    const fallback = () => { const m = document.createElement('div'); m.className = 'modal'; m.innerHTML = '<div class="modal-card" role="dialog" aria-modal="true"><h2>Отчёты</h2><p>Выдели всё и скопируй вручную:</p><textarea class="tl-area" readonly></textarea><button type="button" class="btn">Закрыть</button></div>';
      m.querySelector('textarea').value = txt; m.querySelector('button').onclick = () => m.remove(); document.body.appendChild(m); m.querySelector('textarea').select(); };
    try { navigator.clipboard.writeText(txt).then(() => toast(`Скопировано отчётов: ${list.length} — вставь в чат`), fallback); } catch (e) { fallback(); }
    return `скопировано: ${list.length}`;
  }
  const tlFiltered = () => TLog.list().filter(r => testFilter === 'all' ? r.mode !== 'stress' : r.mode === testFilter);   // stress tests have their own section
  function tlRow(r, i) {
    if (r.mode === 'stress' && r.cmp) return `<li class="tl-row"><button type="button" data-tlone="${i}" title="Скопировать этот отчёт"><b>Сравнение настроек${r.cmp[0]?.build ? ' · ' + escHtml(r.cmp[0].build) : ''}</b>
      <small>${tlDate(r.at)} · ${escHtml(r.dev?.gpu || r.dev?.os || '')} · средний / 1% худших</small><i>${r.cmp.map(c => `${QNAME[c.quality] || c.quality}: ${c.avg}/${c.low1} · фризы ${c.h50}`).join(' · ')}</i></button></li>`;
    if (r.mode === 'stress' && r.st) return `<li class="tl-row"><button type="button" data-tlone="${i}" title="Скопировать этот отчёт"><b>${escHtml(r.name)}${r.st.build ? ' · ' + escHtml(r.st.build) : ''}</b>
      <small>${tlDate(r.at)} · ${escHtml(r.dev?.gpu || r.dev?.os || '')} · графика ${escHtml(r.quality || '')}</small><i>⌀ ${r.st.avg} FPS · мин ${r.st.min} · 1% ${r.st.low1} · фризы ${r.st.h50}${r.st.h100 ? ' (сильных ' + r.st.h100 + ')' : ''}</i></button></li>`;
    const flags = [r.slow?.length ? `🐢 ${r.slow.length}` : '', r.fps?.lowSec ? `📉 ${r.fps.lowSec} с` : '', r.net ? `📶 ${r.net.pingAvg ?? '—'} мс` : '', r.net?.gap1000 ? `⏸ ${r.net.gap1000}` : ''].filter(Boolean).join(' ');
    return `<li class="tl-row"><button type="button" data-tlone="${i}" title="Скопировать этот отчёт"><b>${escHtml(tlLabel(r))}</b>
      <small>${tlDate(r.at)} · ${tlTime(r.dur || 0)} · пик ${Math.round(r.peak || 0).toLocaleString('ru-RU')} · ${escHtml(r.end || '')}</small>${flags ? `<i>${flags}</i>` : ''}</button></li>`;
  }
  function tlRender() {
    const all = TLog.list(), modes = [...new Set(all.map(r => r.mode))].filter(m => m !== 'stress'), list = tlFiltered(), shown = list.slice(-12).reverse(), nStress = all.filter(r => r.mode === 'stress').length;
    if (testFilter !== 'all' && testFilter !== 'stress' && !modes.includes(testFilter)) testFilter = 'all';
    return `<div class="tl">
      <p class="test-lead">Каждый раунд записывается сам · хранятся последние 40</p>
      <div class="tl-chips" role="group" aria-label="Режим"><button type="button" data-tlf="stress" class="tl-stress${testFilter === 'stress' ? ' on' : ''}">⚡ Стресс-тесты · ${nStress}</button><button type="button" data-tlf="all" class="${testFilter === 'all' ? 'on' : ''}">Все · ${all.length - nStress}</button>${modes.map(m =>
        `<button type="button" data-tlf="${m}" class="${testFilter === m ? 'on' : ''}">${escHtml((MODES[m] || {}).name || m)} · ${all.filter(r => r.mode === m).length}</button>`).join('')}</div>
      ${testFilter === 'stress' ? `<div class="tl-stress-run"><p>Игра сама играет раунд Хардкора 6 минут: охотится, ест, делится. Каждая минута — отдельный шаг отчёта: FPS, фризы, сколько съедено, память. Телефон не трогай.</p>
        <div class="tl-btns one"><button type="button" data-stress="real">▶ Стресс-тест · Хардкор, 6 мин<small>автопилот охотится и ест: боты, стаи, боссы; масса 1к → 100к, деление, события, проклятие · на твоём качестве графики</small></button></div><div class="tl-btns one"><button type="button" data-stress="crowd">▶ Стресс-тест · Толпа, 4 мин<small>запас прочности: 20 → 30 → 40 мобов в своих обликах, потом 40 + 4 босса и 60 000 · FPS, рывки, вызовы отрисовки, логика и отрисовка в мс</small></button></div></small></button></div></div>` : ''}
      <div class="tl-btns"><button type="button" data-tlc="1">📋 Последний</button><button type="button" data-tlc="5">📋 Последние 5</button><button type="button" data-tlc="0">📋 Все${testFilter === 'all' ? '' : ' этого режима'}</button><button type="button" data-tlclear class="warn">Очистить</button></div>
      ${shown.length ? `<ol class="tl-list">${shown.map(r => tlRow(r, list.indexOf(r))).join('')}</ol>` : '<p class="hint">Пока пусто — сыграй любой раунд до конца, отчёт появится здесь.</p>'}
      <p class="hint">🐢 — сколько раз скорость падала ниже 40%, 📉 — секунды с FPS ниже 30, 📶 — средний пинг онлайна, ⏸ — пропуски связи дольше 1 с. Нажми на строку — скопируется один отчёт.</p></div>`;
  }

  const xpForPs = (t, n) => XP_AT_MAX + (t === 1 ? n * PS.star : PS.star * PS.max + n * PS.nova) + 1;
  testAdd('Уровень и престиж', [
    ['Ур. 9', () => { save.xp = xpForLevel(9); }], ['Ур. 30', () => { save.xp = xpForLevel(30); }], ['Ур. 50', () => { save.xp = XP_AT_MAX; }],
    ['★5', () => { save.xp = xpForPs(1, 5); }], ['★18', () => { save.xp = xpForPs(1, 18); }], ['★25', () => { save.xp = xpForPs(1, 25); }],
    ['✦10', () => { save.xp = xpForPs(2, 10); }], ['✦25', () => { save.xp = xpForPs(2, 25); }]]);
  testAdd('Всё сразу', [['Открыть всё сразу', () => {
    testUnlockAll(); save.xp = xpForPs(2, 25); save.coins = Math.max(save.coins, 999999);
    save.totals.maxLeague = 5; save.totals.chaosMax = 5; save.totals.chaosGames = Math.max(save.totals.chaosGames || 0, 1);
    SOLO_MODE_IDS.forEach(id => { save.mastery[id] = Math.max(save.mastery[id] || 0, MASTERY_LV[MASTERY_LV.length - 1].pts); });
    ACH.forEach(a => { save.achT[a.id] = a.steps.length; if (!save.ach.includes(a.id)) save.ach.push(a.id); });
    return 'всё открыто: престиж ✦25, лиги «Неон», мастерство «Легенда», достижения на III';
  }]]);
  testAdd('Цели', [['Вернуть замену цели', () => { delete save.qSwapDay; }]]);
  testAdd('Монеты и сундуки', [['+100 000 ◆', () => { save.coins += 100000; }], ['+10 сундуков', () => { save.chests += 10; }]]);
  testAdd('Графика', [['Сымитировать сбой графики', () => {
    const ext = renderer.getContext().getExtension('WEBGL_lose_context'); if (!ext) return 'браузер не умеет имитировать сбой';
    ext.loseContext(); setTimeout(() => ext.restoreContext(), 1200); return 'графика вернётся через секунду';
  }], ['Показать плашку сбоя', () => { $('gfxBar').hidden = false; }]]);
  testAdd('Достижения', [
    ['Все на I', () => { ACH.forEach(a => { save.achT[a.id] = 1; }); save.ach = save.ach.filter(id => !achById(id)); }],
    ['Вперемешку', () => { save.ach = save.ach.filter(id => !achById(id)); ACH.filter(a => a.line).forEach((a, i) => { save.achT[a.id] = [3, 2, 1, 0, 2, 3, 1, 0, 2, 1][i]; if (save.achT[a.id] >= 3) save.ach.push(a.id); }); ACH.filter(a => a.hol).slice(0, 2).forEach((a, i) => { save.achT[a.id] = i ? 6 : 3; if (i) save.ach.push(a.id); }); }],
    ['Все на III', () => { ACH.forEach(a => { save.achT[a.id] = a.steps.length; if (!save.ach.includes(a.id)) save.ach.push(a.id); }); }],
    ['Сбросить', () => { ACH.forEach(a => { save.achT[a.id] = 0; }); save.ach = save.ach.filter(id => !achById(id)); save.pc = { ...(save.pc || {}), shelf: [] }; }],
    ['Витрина: 3 трофея', () => { const got = ACH.filter(a => achTier(a)).sort((x, y) => achMetal(y, achTier(y)) - achMetal(x, achTier(x))); save.pc = { ...(save.pc || {}), shelf: got.slice(0, 3).map(a => a.id) }; return got.length ? 'открой Профиль' : 'сначала выдай достижения'; }]]);
  testAdd('Мастерская', [
    ['Открыть мастерскую', () => { $('testModal').hidden = true; openWorkshop(); return 'открыта'; }],
    ['+5 сундуков осколков', () => { save.shardChests = (save.shardChests || 0) + 5; return 'Сундуки → «Сундук осколков»'; }],
    ['+300 осколков каждой редкости', () => { RAR_KEYS.forEach(k => { save.shards[k] += 300; }); }],
    ['Обнулить осколки', () => { RAR_KEYS.forEach(k => { save.shards[k] = 0; }); }],
    ['Создать всё', () => { WS_CATS.forEach(([cat]) => wsItems(cat).forEach(x => { if (!x.own) x.give(); })); return 'всё есть в коллекции'; }],
    ['Забрать всё созданное', () => { const crIds = new Set(Object.keys(CR_PRICE)); const drop = l => l.filter(id => !crIds.has(id));
      save.skins = drop(save.skins); save.fxOwned = drop(save.fxOwned); save.pets = drop(save.pets); save.decor = drop(save.decor); save.pbg = drop(save.pbg || []); save.abil.owned = drop(save.abil.owned);
      if (crIds.has(save.skin)) { save.skin = 'coral'; refreshSkin(); } ['trail', 'aura', 'eat'].forEach(sl => { if (crIds.has(save.fx[sl])) save.fx[sl] = null; }); applyAura();
      if (crIds.has(save.pet)) { save.pet = null; applyPet(); } if (crIds.has(save.frame)) save.frame = null; if (save.pc && crIds.has(save.pc.bg)) save.pc.bg = 'bg_base'; save.build = save.build.map(id => crIds.has(id) ? null : id); return 'можно создавать заново'; }]]);
  testAdd('Старт раунда', [
    ['Старт: масса 10', () => { testStartMass = 0; }], ['Старт: масса 1 000', () => { testStartMass = 1000; }], ['Старт: масса 5 000', () => { testStartMass = 5000; }], ['Старт: масса 15 000', () => { testStartMass = 15000; }]]);
  testAdd('Эволюции', [['🧬 Окно: новая форма', () => { const id = 'hc_berserk'; if (!save.skins.includes(id)) save.skins.push(id); (save.evoQ = save.evoQ || []).push({ id, f: 2, from: 1 }); save.evoNew = { ...(save.evoNew || {}), [id]: 2 }; setTimeout(evoShowQueue, 300); return 'после закрытия панели — окно «Эволюция» Берсерка (I → II)'; }],
    ['🧬 Окно: новый скин', () => { const id = 'duo_twin'; if (!save.skins.includes(id)) save.skins.push(id); (save.evoQ = save.evoQ || []).push({ id, f: 1, from: 0, fresh: true }); save.evoNew = { ...(save.evoNew || {}), [id]: 1 }; setTimeout(evoShowQueue, 300); return 'окно «Новый скин с эволюцией» — Близнецы'; }],
    ['🧬 Момент в раунде', () => { evoTestT = 6; return 'запусти раунд: через 6 с капля перейдёт в следующую форму прямо на арене'; }],
    ['🧬 Метки «новое»', () => { save.evoNew = {}; Object.keys(EVO).forEach(id => { if (save.skins.includes(id)) save.evoNew[id] = Math.max(1, evoOpen(id)); }); return 'метки на плитках Гардероба и точка на кнопке Гардероба'; }]]);
  testAdd('Хардкор', [['☠ Проклятие через 3 с', () => { ModeX.hcCurseSoon(); return 'в раунде «Хардкора» через 3 с наложится случайное проклятие'; }]]);
  testAdd('Сохранение', [['Сбросить тестовое сохранение', () => 'reset', 'warn']]);
  function testRender() {
    const tabs = `<div class="test-tabs" role="tablist">${TEST_TABS.map(([id, t]) => `<button type="button" role="tab" data-ttab="${id}" aria-selected="${testTab === id}" class="${testTab === id ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    const body = testTab === 'reports' ? tlRender() : TEST_GROUPS.map((g, gi) => g.tab !== testTab ? '' : `<div class="test-grp"><small>${g.title}</small><div>${g.buttons.map(([t, , cls], bi) => `<button type="button" data-tb="${gi}:${bi}" class="${cls || ''}">${t}</button>`).join('')}</div></div>`).join('');
    $('testGroups').innerHTML = tabs + `<div class="test-body">${body}</div>`;
  }

  let testResetArm = 0;
  // test build: everything collectable is open (profile backgrounds and badges too)
  function testUnlockAll() {
    save.evoAll = true; try { evoCheck(true); refreshSkin(); } catch (e) {}
    save.pbg = [...new Set([...PBG.filter(b => !b.craft).map(b => b.id), ...(save.pbg || [])])]; save.badges = save.badges || {};
    // Test-only preview of the exclusive Hardcore victory rewards.
    save.hc100k = true; save.hc100kAt = save.hc100kAt || today; save.badges.hc100k = save.badges.hc100k || today;
    if (!save.pbg.includes('bg_hc_singularity')) save.pbg.push('bg_hc_singularity');
    [...PROMO_BADGES, ...SPECIAL].forEach(b => { save.badges[b.id] = save.badges[b.id] || today; }); save.badges.millionaire = save.badges.millionaire || today;
    save.legendBadge = save.legendBadge || today;
    // every league season of the first year (all six league shapes take turns) and a dozen Chaos seasons
    if (save.seasonLog.length < SEASON_YEAR) save.seasonLog = Array.from({ length: SEASON_YEAR }, (_, i) => { const id = i + 1, sd = seasonData(id), lg = [5, 4, 3, 2, 1, 0][i % 6];
      return { id, league: lg, pts: LEAGUES[lg].pts + 500, name: sd.name, holiday: sd.holiday, year: sd.year || null }; });
    if (save.chaosLog.length < 12) save.chaosLog = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, tier: (CHAOS_TIERS.length - 1) - (i % CHAOS_TIERS.length), pts: 100 }));
    // workshop «Хронос» items stay out: they are made in the workshop (crafted ones are kept)
    const keep = (all, mine) => [...new Set([...all.filter(x => !x.craft).map(x => x.id), ...(mine || [])])];
    save.skins = keep(SKINS.filter(k => k.id !== 'cyber'), save.skins).filter(id => id !== 'cyber');   /* 2.7: «Кибер-сетка» retired */ save.fxOwned = keep(FX, save.fxOwned); save.pets = keep(PETS, save.pets); save.decor = keep(DECOR.filter(d => !d.old), save.decor).filter(id => !(decorById(id) || {}).old);   /* 2.7: retired frames/titles are not handed out in the test build either */ save.arenas = ARENAS.map(a => a.id); save.hats = Object.keys(HATS);
  }
  if (TEST_MODE) { testUnlockAll(); persist(); }
  if (TEST_MODE) {
    document.addEventListener('click', e => { if (e.target.closest('[data-testopen]')) { e.preventDefault(); e.stopPropagation(); testRender(); $('testState').textContent = ''; $('testModal').hidden = false; $('testClose').focus(); } }, true);
    $('testClose').addEventListener('click', () => { $('testModal').hidden = true; });
    $('testModal').addEventListener('click', e => {
      if (e.target === $('testModal')) { $('testModal').hidden = true; return; }
      // 2.7: sections and the round journal
      const tab = e.target.closest('[data-ttab]'); if (tab) { testTab = tab.dataset.ttab; testRender(); $('testState').textContent = ''; return; }
      const tf = e.target.closest('[data-tlf]'); if (tf) { testFilter = tf.dataset.tlf; testRender(); return; }
      const sr = e.target.closest('[data-stress]'); if (sr) { if (sr.dataset.stress === 'all') toast(stressAll()); else stressStart(sr.dataset.stress).then(m => { if (m) toast(m); }); return; }
      const tc = e.target.closest('[data-tlc]'); if (tc) { const n = +tc.dataset.tlc, L = tlFiltered(); $('testState').textContent = tlCopy(n ? L.slice(-n) : L); return; }
      const t1 = e.target.closest('[data-tlone]'); if (t1) { const r = tlFiltered()[+t1.dataset.tlone]; $('testState').textContent = tlCopy(r ? [r] : []); return; }
      if (e.target.closest('[data-tlclear]')) {
        if (Date.now() - testResetArm > 4000) { testResetArm = Date.now(); $('testState').textContent = 'Нажми «Очистить» ещё раз, чтобы удалить все отчёты'; return; }
        testResetArm = 0; TLog.clear(); testRender(); $('testState').textContent = 'Отчёты удалены'; return;
      }
      const b = e.target.closest('[data-tb]'); if (!b) return;
      const [gi, bi] = b.dataset.tb.split(':').map(Number), [label, fn] = TEST_GROUPS[gi].buttons[bi];
      let r; try { r = fn(); } catch (er) { $('testState').textContent = 'Ошибка: ' + er.message; return; }
      if (r === 'reset') {
        if (Date.now() - testResetArm > 4000) { testResetArm = Date.now(); $('testState').textContent = 'Нажми ещё раз в течение 4 секунд, чтобы сбросить'; return; }
        try { localStorage.removeItem(SAVE_KEY); } catch (er) {} location.reload(); return;
      }
      persist(); renderAll(); $('testState').textContent = `Готово: ${label}${typeof r === 'string' ? ' · ' + r : ''}`;
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('testModal').hidden) { e.stopPropagation(); $('testModal').hidden = true; } }, true);
  }
