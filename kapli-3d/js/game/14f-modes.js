  // ================= 2.5: livelier solo modes =================
  // «Классика»: milestones inside the round and an arena that heats up every 3 minutes.
  // «На время»: one random rule per round, a final rush in the last 30 s, a reward for every place and for climbing.
  // «Выживание»: bosses grow gentler, melt while they live (so they can be eaten late), every 5th wave is special and a break follows.
  // «Босс-рейд» perks earned by beating the weekly twins (like skin stars: small, never game-breaking)
  //  every win: +2% damage to the twins (up to +10%) · 1 win («Аура рейдера»): +3% coins in the raid · 3 wins («Шлем рейдера»): +20 s to a raid fight
  function raidPerk() { const w = save.raidWins || 0; return { dmg: 1 + .02 * Math.min(5, w), coins: w >= 1, time: w >= 3 ? 20 : 0 }; }   // 2.7: «Шлем рейдера» — +20 s to every raid fight (there are no daily tries any more)
  // «Режим дня»: one solo mode a day pays ×1,25 coins (the badge moves to another mode every day)
  const DAY_POOL = ['classic', 'timed', 'survival', 'crown', 'rbuild', 'hardcore'];
  const dayMode = () => { let h = 7; for (const ch of today) h = (h * 31 + ch.charCodeAt(0)) % 100003; return DAY_POOL[h % DAY_POOL.length]; };
  const DAY_MARK = '<span class="day-mark">🔥 режим дня · ◆ ×1,25</span>';
  const ModeX = (() => {
    const MILES = [[1000, 30], [3000, 60], [6000, 100], [10000, 160], [15000, 220], [20000, 300], [25000, 400], [30000, 600], [40000, 800], [50000, 1000]];   // 2.7: 30 000 gives «Вершина»; at 50 000 the drop splits in two (like «Хардкор»)
    const CL_GOAL = 50000, CL_GOAL_COINS = 2000;   // the last step of «Классика»: both halves at 50 000 — a big reward, then claim and leave or play on
    const ESC_S = 180, ESC_MAX = 4, RUSH_S = 45;
    const RULES = [
      { id: 'bonus2', name: 'Двойные бонусы', about: 'бонусы появляются вдвое чаще' },
      { id: 'fastbots', name: 'Быстрые боты', about: 'боты на 15% быстрее' },
      { id: 'spikes', name: 'Шипы повсюду', about: 'вдвое больше шипов' },
      { id: 'feast', name: 'Пир', about: 'крошки дают в полтора раза больше' },
    ];
    let rule = null, mile = 0, esc = 0, rushOn = false, breakAt = 0;
    // 2.7 «Случайный билд»: at 5 mass milestones the game pauses and offers 2 new abilities; pick one, then the slot it replaces (or keep the build).
    // The later the milestone, the more levels the new ability gets for this round.
    const RB_MILES = [3000, 8000, 15000, 25000, 40000], RB_LV = [1, 1, 2, 2, 3];
    let rbMile = 0, rbOffer = null, rbT = 0;
    const rbPool = () => ABILITIES.filter(a => !a.xa && !a.cr && !runBuild.includes(a.id)).map(a => a.id);
    const rbLvText = (id, add) => { const a = abilById(id); if (a.branches) return 'улучшения как у тебя'; const base = save.abil.lv[id] || 0, lv = Math.min(ABIL_CFG.levels, base + add); return `уровень ${lv}/${ABIL_CFG.levels}${lv > base ? ` · +${lv - base} в раунде` : ''}`; };
    function rbPanel() {
      let el = document.getElementById('rbPick');
      if (!el) {
        el = document.createElement('div'); el.id = 'rbPick'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Замена способности'); document.body.appendChild(el);
        el.addEventListener('pointerdown', e => e.stopPropagation());
        el.addEventListener('click', e => { const b = e.target.closest('[data-rb]'); if (b) rbChoose(b.dataset.rb); });
      }
      if (!rbOffer || !running) { el.hidden = true; return; }
      const card = (key, id, sub) => { const a = abilById(id); return `<button type="button" data-rb="${key}" style="--ac:${a.color}"><span class="ic" style="color:${a.color}">${a.icon}</span><b>${a.name}</b><small>${sub}</small></button>`; };
      const head = `<p>Случайный билд · веха ${RB_MILES[rbMile - 1].toLocaleString('ru-RU')} · игра на паузе · <b id="rbPickT">${Math.max(0, Math.ceil(rbT))}</b> с</p>`;
      el.innerHTML = rbOffer.pick === null
        ? head + `<small class="rb-step">1. Выбери новую способность</small><div class="db-opts two">${rbOffer.ids.map((id, i) => card('n' + i, id, rbLvText(id, rbOffer.lv))).join('')}</div><button type="button" class="rb-keep" data-rb="keep">Оставить свои способности</button>`
        : head + `<small class="rb-step">2. Какую заменить на «${abilById(rbOffer.ids[rbOffer.pick]).name}»?</small><div class="db-opts">${runBuild.map((id, i) => id ? card('s' + i, id, 'заменить · ' + ABIL_CFG.slotKeyName[i]) : '').join('')}</div><button type="button" class="rb-keep" data-rb="back">← назад</button>`;
      el.hidden = false;
    }
    function rbChoose(k) {
      if (!rbOffer) return;
      if (k === 'keep') { rbOffer = null; rbPanel(); toast('Билд не изменился'); return; }
      if (k === 'back') { rbOffer.pick = null; rbPanel(); return; }
      if (k[0] === 'n') { rbOffer.pick = +k.slice(1); rbPanel(); return; }
      const slot = +k.slice(1), id = rbOffer.ids[rbOffer.pick], old = runBuild[slot]; if (!id || old === undefined) return;
      runBuild[slot] = id; if (!abilById(id).branches) rbLvUp[id] = (rbLvUp[id] || 0) + rbOffer.lv;
      if (player.abT) delete player.abT[old]; if (player.abCd) player.abCd[id] = 0;
      (stats.rbSwaps = stats.rbSwaps || []).push([Math.round(stats.time), old, id]);
      if (TEST_MODE) try { TLog.ev('замена', old + '→' + id); } catch (e) {}
      rbOffer = null; rbPanel(); renderSlots(); toast(`«${abilById(old).name}» → «${abilById(id).name}»`); Sound.play('level');
    }
    function rbTick() {
      if (rbOffer || rbMile >= RB_MILES.length || total(player) < RB_MILES[rbMile]) return;
      const pool = rbPool(), ids = []; while (pool.length && ids.length < 2) ids.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      const lv = RB_LV[rbMile]; rbMile++; if (ids.length < 2) return;
      rbOffer = { ids, lv, pick: null }; rbT = 15; rbPanel(); toast(`Масса ${RB_MILES[rbMile - 1].toLocaleString('ru-RU')}: можно заменить способность`); Sound.play('level');
    }
    // «Захват короны»: the crown lies in the middle until someone takes it, then passes only to whoever eats its holder
    let crownGround = null, crownLast = { x: 0, z: 0 };
    // «Хардкор»: small boosts at 2 000 … 25 000 mass (pick one of two), no shields and no second lives (2.7: three more steps and «Таяние −10%»)
    // 2.7: 11 milestones up to 50 000; each card's rarity is never below the step's floor and may roll one step higher;
    // values by rarity (common / rare / epic / legendary); one boost at most HC_CAP times a round
    const HC_MILES = [2000, 5000, 10000, 15000, 20000, 25000, 30000, 35000, 40000, 45000, 50000];
    const HC_TIER = [[0, .25], [0, .25], [1, .25], [1, .25], [2, .15], [2, .15], [2, .3], [2, .45], [2, .6], [2, .75], [3, 0]];   // [floor, chance of one step higher]
    // 2.7 after the owner's test (best 18–20k): «Хардкор» melts 25% slower than before (0.003), still twice the other modes
    const HC_DECAY = .00225;
    const HC_CAP = 3, HC_R = ['common', 'rare', 'epic', 'legendary'], HC_RN = ['Обычное', 'Редкое', 'Эпическое', 'Легендарное'];
    const HC_BOOST = {   // [icon, name, values, kind: '+' adds a percent, '-' multiplies by (1 − percent)]
      speed: ['⚡', 'Скорость', [4, 6, 8, 10], '+'], absorb: ['🍽', 'Поглощение', [4, 6, 8, 10], '+'], cd: ['⏱', 'Перезарядка способностей', [8, 12, 16, 20], '-'],
      melt: ['🧊', 'Таяние', [8, 12, 16, 20], '-'], skin: ['🛡', 'Толстая кожа', [3, 5, 7, 9], '+'], magnet: ['🧲', 'Притяжение крошек', [10, 15, 20, 25], '+'],
      dash: ['💨', 'Короткий рывок', [10, 15, 20, 25], '-'], merge: ['🔗', 'Быстрое слияние', [10, 15, 20, 25], '-'], predator: ['🩸', 'Хищник', [8, 10, 12, 15], '+'], coins: ['💰', 'Добытчик', [4, 6, 8, 10], '+'] };
    const HC_ABOUT = { speed: 'быстрее', absorb: 'еда сытнее', cd: 'способности перезаряжаются быстрее', melt: 'масса тает медленнее', skin: 'боту надо быть крупнее, чтобы съесть тебя', magnet: 'крошки притягиваются издалека',
      dash: 'рывок перезаряжается быстрее', merge: 'части сливаются быстрее, а после деления короче перезарядка «Слить половины»', predator: 'после съеденного бота 2 с ты быстрее', coins: 'монеты за раунд' };
    let hcD = {}, hcCurse = null, hcCurseT = 75;
    let hc = {}, hcN = {}, hcMile = 0, hcOffer = null, hcT = 0, hcPredT = 0, hcSpikesOff = false, hcDbg = { m: 0, t: 0, gain: 0 }, hcLog = null;
    const splitMode = () => mode === 'hardcore' || (mode === 'classic' && solo());   // 2.7: «Классика» splits at 50 000 too
    let clGoalDone = false;
    let hcBossStage = 0, hcSplitDone = false, hcRevive = null, hcPackT = 0, hcFreezeT = 0, hcLastOffer = -99, hcFuseT = 0, hcFuseCd = 0, hcWinT = 0, hcFuseHold = 0;
    // 2.7: the player's smaller half (or main part before the split) — what bosses and packs measure themselves against
    const hcRef = () => { if (!player.cells.length) return 0; if (hcSplitDone && hcFuseT > 0) return total(player) / 2;   // 2.7 fix: while fused, a «half» is half of the drop (it was the whole drop — bosses grew to 160 000)
      if (hcSplitDone) { const hm = hcHalfMass().filter(v => v > 0); return hm.length ? Math.min(...hm) : 0; } return mainOf(player).mass; };
    // melt is ×1 up to 20 000 and rises smoothly to ×1.45 at 30 000 total mass
    const hcMeltUp = () => { const m = total(player); if (mode === 'classic' && solo()) return 1 + .3 * Math.max(0, Math.min(1, (m - 15000) / 15000)) + .25 * Math.max(0, Math.min(1, (m - 50000) / 20000));   // «Классика»: ×1.3 at 30 000, ×1.55 at 70 000
      if (mode !== 'hardcore') return 1; return 1 + .45 * Math.max(0, Math.min(1, (m - 15000) / 10000)) + .35 * Math.max(0, Math.min(1, (m - 50000) / 10000)) + .6 * Math.max(0, Math.min(1, (m - 80000) / 20000)); };   // ×1.45 at 30 000, ×1.8 at 60 000, ×2.4 at 100 000
    // packs: after 30 000, three bots hunt the smaller half together and can swallow each other to become a real threat
    const hcPackBots = () => bots.filter(o => o.hcPack && o.cells.length);
    function hcPackTick(dt) {
      for (const o of bots) if (o.hcPack && !o.cells.length) o.hcPack = 0;
      if (total(player) < 20000) return;
      if ((hcPackT -= dt) > 0 || hcPackBots().length >= 2) return;
      hcPackT = mode === 'classic' ? 30 : 20; const t = hcPackTarget(); if (!t) return;
      const pick = bots.filter(o => o.kind === 'bot' && o.cells.length && !o.hcPack).sort((a, b) => Math.hypot(mainOf(a).x - t.x, mainOf(a).z - t.z) - Math.hypot(mainOf(b).x - t.x, mainOf(b).z - t.z)).slice(0, 3);
      if (pick.length < 3) return;
      const ref = hcRef();
      const k = mode === 'classic' ? .4 : .5; pick.forEach((o, i) => { o.hcPack = 1; o.hcPackI = i; const m = mainOf(o); if (m.mass < ref * k) m.mass = ref * k; m.vis.jig = 1; });
      toast('🐺 Стая из трёх ботов вышла на охоту — не дай им слиться'); Sound.play('boss');
    }
    function hcPackTarget(o) {
      if (!player.cells.length) return null;
      let L = player.cells; if (hcSplitDone) { const hm = hcHalfMass(), h = hm[0] > 0 && (hm[0] <= hm[1] || hm[1] <= 0) ? 0 : 1; const P = player.cells.filter(c => c.hcHalf === h); if (P.length) L = P; }
      const t = L.reduce((a, b) => a.mass >= b.mass ? a : b); if (!o) return t;
      const a = (o.hcPackI || 0) * 2.1 + stats.time * .15, d = cellR(t) * 1.8;   // members come from three sides
      const m = mainOf(o); return Math.hypot(m.x - t.x, m.z - t.z) < d * 1.4 ? { t, x: t.x, z: t.z } : { t, x: t.x + Math.cos(a) * d, z: t.z + Math.sin(a) * d };
    }
    // «Классика»: crumbs and bots feed less from 15 000 (×0.75 at 30 000, ×0.6 at 60 000)
    const clGainK = () => { const m = total(player); return 1 - .25 * Math.max(0, Math.min(1, (m - 15000) / 15000)) - .15 * Math.max(0, Math.min(1, (m - 30000) / 30000)); };
    const HC_BOSS_MILESTONES = [10000, 20000, 30000, 40000, 50000, 60000, 70000, 80000, 90000];
    const hcBossPressure = () => mode === 'hardcore' ? Math.min(1, hcBossStage / HC_BOSS_MILESTONES.length) : 0;
    const hcHalfMass = () => [0, 1].map(h => player.cells.reduce((s, c) => s + (c.hcHalf === h ? c.mass : 0), 0));
    function hcAutoSplit(again) {
      const mass = total(player), old = [...player.cells]; if (!old.length || (!again && mass < 50000) || player.free.length + old.length < 2) return false;
      const [cx, cz] = centerOf(player), lead = mainOf(player), hl = Math.hypot(lead.hx || 0, lead.hz || 0) || 1, hx = (lead.hx || 1) / hl, hz = (lead.hz || 0) / hl;
      old.forEach(removeCell);
      const half = mass / 2, a = addCell(player, cx, cz, half, player.free.pop()), b = addCell(player, cx, cz, half, player.free.pop());
      a.hcHalf = 0; b.hcHalf = 1;
      const sep = Math.min(80, Math.max(12, cellR(a) * .95));
      a.x -= hx * sep; a.z -= hz * sep; b.x += hx * sep; b.z += hz * sep;
      a.hx = -hx; a.hz = -hz; b.hx = hx; b.hz = hz; a.vx = -hx * 18; a.vz = -hz * 18; b.vx = hx * 18; b.vz = hz * 18;
      a.mergeT = b.mergeT = 2; rebuildCells(); hcSplitDone = true;
      player.splitCd = Math.max(player.splitCd || 0, 2); stats.splits = (stats.splits || 0) + 1; stats.hcSplitAt = stats.time; stats.hcHalfPeak = [half, half];
      if (again) toast(`Слияние закончилось — снова две половины по ${Math.round(half).toLocaleString('ru-RU')}`); else toast(mode === 'classic' ? '50 000 массы! Ты разделился на две половины по 25 000 — вырасти обе до 50 000' : '50 000 массы! Игрок разделился на две равные половины по 25 000');
      if (TEST_MODE) try { TLog.ev('деление', Math.round(mass)); } catch (e) {} Sound.play('level'); return true;
    }
    // В: «Слияние» — a button after the split: for 10 s the halves may merge into one drop (to eat a boss neither half can), then they split again
    function hcFuseUi() {
      let b = document.getElementById('hcFuse');
      const show = running && splitMode() && hcSplitDone && !stats.ranked;
      if (!show) { if (b) b.hidden = true; return; }
      if (!b) { b = document.createElement('button'); b.id = 'hcFuse'; b.type = 'button'; document.body.appendChild(b);
        b.addEventListener('pointerdown', e => e.stopPropagation()); b.addEventListener('click', e => { e.stopPropagation(); hcFuseStart(); }); }
      b.hidden = false; b.disabled = hcFuseCd > 0 && !(hcFuseT > 0);
      b.innerHTML = hcFuseT > 0 ? (hcFuseHold > 0 ? `⚠ Опасно — деление отложено<small>✂ нажми, чтобы разделиться сейчас</small>` : `✂ Разделить сейчас<small>само через ${Math.ceil(hcFuseT)} с</small>`) : hcFuseCd > 0 ? `🔗 Слияние · ${Math.ceil(hcFuseCd)} с` : '🔗 Слить половины<small>на 6 с · −10% массы</small>';
    }
    // the victory bar: both halves at 50 000 and held for 15 s
    function hcWinUi(hm) {
      let el = document.getElementById('hcWin');
      if (mode === 'classic') { if (!hm || clGoalDone || !running) { if (el) el.hidden = true; return; }
        if (!el) { el = document.createElement('div'); el.id = 'hcWin'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
        const lo = Math.min(hm[0], hm[1]); el.hidden = false; el.innerHTML = `🏆 Цель: обе половины по 50 000 · <b>${Math.round(hm[0] / 1000)}K + ${Math.round(hm[1] / 1000)}K</b><i style="--p:${Math.min(100, lo / CL_GOAL * 100).toFixed(0)}%"></i>`; return; }
      if (!hm || !(hm[0] >= 50000 && hm[1] >= 50000)) { if (el) el.hidden = true; return; }
      if (!el) { el = document.createElement('div'); el.id = 'hcWin'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
      el.hidden = false; el.innerHTML = `🏆 Удержи обе половины ≥ 50 000: <b>${Math.max(0, Math.ceil(15 - hcWinT))} с</b><i style="--p:${Math.min(100, hcWinT / 15 * 100).toFixed(0)}%"></i>`;
    }
    function hcFuseEnd() { hcFuseT = 0; hcFuseHold = 0; hcFuseCd = 90 * hcK('merge'); hcAutoSplit(true); }   // «Быстрое слияние» shortens the cooldown
    // would a half (half of the fused drop) be eaten by a boss nearby?
    function hcFuseDanger() {
      if (!player.cells.length) return false; const c = mainOf(player), half = total(player) / 2, rH = .38 * Math.sqrt(half);
      return bossOwners.some(o => o.cells.some(b => b.mass > half * 1.25 && Math.hypot(b.x - c.x, b.z - c.z) < cellR(b) + rH + 40));
    }
    function hcFuseStart() {
      if (hcFuseT > 0) { hcFuseEnd(); toast('✂ Половины разделены'); return; }
      if (!hcSplitDone || hcFuseT > 0 || hcFuseCd > 0 || !player.cells.length) return;
      hcFuseT = 6; player.cells.forEach(c => { c.mergeT = 0; c.mass *= .9; }); toast('🔗 Слияние на 6 секунд (−10% массы) — веди половины друг к другу'); Sound.play('level'); hcFuseUi();
    }
    let hcFuseUiT = 0;
    function hcFuseTick(dt) {
      if (hcFuseT > 0 && (hcFuseT -= dt) <= 0) {
        if (hcFuseDanger() && hcFuseHold < 5) { hcFuseHold += dt; hcFuseT = .001; }   // a boss could swallow a half right now: wait (5 s at most)
        else hcFuseEnd();
      }
      else if (hcFuseCd > 0) hcFuseCd = Math.max(0, hcFuseCd - dt);
      if ((hcFuseUiT -= dt) <= 0) { hcFuseUiT = .25; hcFuseUi(); }
    }
    // А: «Двойной укус» — both halves touching a boss together, and together 1.25× bigger than it, eat it; the mass is shared between them
    function hcPairBite(a, b) {
      if (!splitMode() || !hcSplitDone || hcFuseT > 0 || !a.owner.isPlayer || b.owner.kind !== 'boss' || a.hcHalf === undefined) return null;
      const near = c => Math.hypot(c.x - b.x, c.z - b.z) < cellR(c) + cellR(b) * .55;
      if (!near(a)) return null;
      const p = player.cells.filter(c => c.hcHalf !== undefined && c.hcHalf !== a.hcHalf && near(c)).sort((x, y) => y.mass - x.mass)[0];
      if (!p || a.mass < p.mass || a.mass + p.mass < b.mass * eatRatio(b) || b.owner.spawnSh > 0) return null;
      return p;
    }
    function hcBossTarget(o) {
      if (mode !== 'hardcore' || !player.cells.length) return null;
      const active = bossOwners.filter(b => b.cells.length), ix = Math.max(0, active.indexOf(o));
      o.hcRole = active.length > 1 && ix % 2 === 1 ? 'intercept' : 'pursue';
      let preferred = null;
      if (hcSplitDone) { const hm = hcHalfMass(), half = active.length > 1 ? ix % 2 : hm[0] <= hm[1] ? 0 : 1; preferred = player.cells.filter(c => c.hcHalf === half); }
      const candidates = preferred && preferred.length ? preferred : player.cells, origin = o.cells.reduce((a, b) => a.mass >= b.mass ? a : b);
      return candidates.reduce((best, c) => !best || Math.hypot(c.x - origin.x, c.z - origin.z) < Math.hypot(best.x - origin.x, best.z - origin.z) ? c : best, null);
    }
    // 2.7: in every mode (it was «Хардкор» only) the spikes leave the field for good once you — or the other player of a match for two — reach 10 000
    const hcSpikesDisabled = () => {
      if (!hcSpikesOff && running && (total(player) >= 10000 || (DuoM.on && DuoM.rival && total(DuoM.rival) >= 10000))) {
        hcSpikesOff = true;
        toast('10 000 массы! Все шипы исчезли до конца раунда');
      }
      return hcSpikesOff;
    };
    const hcReset = () => { hc = {}; hcN = {}; Object.entries(HC_BOOST).forEach(([k, b]) => { hc[k] = b[3] === '+' ? 0 : 1; hcN[k] = 0; }); hcD = { melt: 0, slow: 0, absorb: 0, magnet: 0, dashLen: 0, sense: 0 }; hcCurse = null; hcCurseT = 75; hcCurseUi(); };
    // 2.7: one of the two cards at a milestone is «risky» — its bonus is ×1.5, with a minus; the minus is smaller for a rarer card
    const HC_DEBUFF = { speed: ['melt', 'таешь быстрее'], absorb: ['slow', 'медленнее'], cd: ['absorb', 'еда менее сытная'], melt: ['slow', 'медленнее'], skin: ['magnet', 'крошки притягиваются слабее'],
      magnet: ['melt', 'таешь быстрее'], dash: ['dashLen', 'рывок короче'], merge: ['sense', 'боты замечают тебя издалека'], predator: ['slow', 'медленнее'], coins: ['absorb', 'еда менее сытная'] };
    const HC_RISK_FRAC = [.5, .33, .25, .2];
    const hcRiskV = (k, r) => Math.round(HC_BOOST[k][2][r] * 1.5), hcRiskD = (k, r) => Math.max(1, Math.round(hcRiskV(k, r) * HC_RISK_FRAC[r]));
    // timed curses: from 10 000 mass, every 60–90 s, a random curse for 15 s
    const HC_CURSES = { slow: ['🐌', 'Вязкость', 'скорость −20%'], hunger: ['🔥', 'Голод', 'таяние ×1,5'], blind: ['🌫', 'Туман', 'мини-карта погасла'], nodash: ['⛓', 'Оковы', 'рывок недоступен'], hunted: ['🎯', 'Метка', 'боты видят тебя в 1,5 раза дальше'] };
    const curseOn = id => mode === 'hardcore' && hcCurse && hcCurse.id === id;
    const hcDK = k => 1 + (hcD[k] || 0) / 100, hcDM = k => Math.max(.3, 1 - (hcD[k] || 0) / 100);
    function hcCurseUi() {
      let el = document.getElementById('hcCurse'); const mm = document.getElementById('miniWrap'); if (mm) mm.classList.toggle('fog', curseOn('blind'));
      if (!hcCurse || !running) { if (el) el.hidden = true; return; }
      if (!el) { el = document.createElement('div'); el.id = 'hcCurse'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
      const c = HC_CURSES[hcCurse.id]; el.hidden = false; el.innerHTML = `<span>${c[0]}</span><b>${c[1]}</b><small>${c[2]} · ${Math.ceil(hcCurse.t)} с</small>`;
    }
    let hcCurseUiT = 0;
    function hcCurseTick(dt) {
      if (hcCurse) { if ((hcCurse.t -= dt) <= 0) { toast(`${HC_CURSES[hcCurse.id][1]} прошла`); hcCurse = null; hcCurseUi(); } }
      else if ((total(player) >= 10000 || hcCurseT <= 3) && (hcCurseT -= dt) <= 0) {
        const ids = Object.keys(HC_CURSES), id = ids[Math.floor(Math.random() * ids.length)], c = HC_CURSES[id];
        hcCurse = { id, t: 15 }; hcCurseT = 60 + Math.random() * 30; toast(`${c[0]} Проклятие «${c[1]}»: ${c[2]} на 15 с`); Sound.play('boss');
        if (hcLog) (hcLog.curses = hcLog.curses || []).push([Math.round(stats.time), id]);
        if (TEST_MODE) TLog.ev('проклятие', id);
      }
      if ((hcCurseUiT -= dt) <= 0) { hcCurseUiT = .25; hcCurseUi(); }
    }
    hcReset();
    const hcK = k => (mode !== 'hardcore' ? 1 : HC_BOOST[k][3] === '+' ? 1 + hc[k] / 100 : hc[k]);
    const hcLabel = (k, r, risk) => { const b = HC_BOOST[k], v = risk ? Math.round(b[2][r] * 1.5) : b[2][r]; return `${b[1]} ${b[3] === '+' ? '+' : '−'}${v}%`; };
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
      rule = null; mile = 0; esc = 0; rushOn = false; breakAt = 0; comboOrder = []; rbMile = 0; rbOffer = null; rbLvUp = {}; rbPanel();
      hcBossStage = 0; hcSplitDone = false; hcRevive = null; hcPackT = 0; hcFreezeT = 0; hcLastOffer = -99; hcFuseT = 0; hcFuseCd = 0; hcWinT = 0; hcFuseHold = 0; hcFuseUi(); hcWinUi(null); HC_BOSS_MASS_CAP = 23000; bots.forEach(o => o.hcPack = 0); stats.hcSplitAt = null; stats.hcHalfPeak = [0, 0]; stats.hcVictory = false; clGoalDone = false; CL_BOSS_MASS_CAP = BOSS_MASS_CAP;
      document.body.classList.toggle('q-low', save.settings.quality === 'low');
      stats.modeXCoins = 0; tether.visible = false;
      crownGround = null; hcSpikesOff = false; hcReset(); hcMile = 0; hcOffer = null; hcPredT = 0; hcDbg = { m: 0, t: 0, gain: 0 }; hcPanel(null);
      hcLog = TEST_MODE && mode === 'hardcore' ? { at: Date.now(), ver: 'v2.7b-test', decay: HC_DECAY, picks: [], samples: [], next: 0 } : null;
      nextRing.visible = false;
      if (mode === 'royale') { zc = { x: 0, z: 0 }; zst = 0; zph = 'hold'; zt = 20; zoneR = R; zPlan(); }
      if (mode === 'crown') { crownHolder = null; { const an = Math.random() * 6.283; crownGround = { x: Math.cos(an) * R * .4, z: Math.sin(an) * R * .4 }; } [player, ...bots].forEach(o => o.crownT = 0); setTimeout(() => { if (running && mode === 'crown') toast('Корона лежит на поле (♛ на мини-карте) — хватай! Дальше она переходит только к тому, кто съест владельца'); }, 1500); }
      // 2.7: in «Захват короны» bosses do not wear their crowns — the only crown on the field is the one to fight for
      bossOwners.forEach(o => [...o.free, ...o.cells.map(c => c.vis)].forEach(v => { if (v && v.crown) v.crown.visible = mode !== 'crown'; }));
      if (mode === 'hardcore') effects.shield = Math.max(effects.shield, 7);   // a longer safe start: one life only
      if (mode === 'timed' && solo()) {
        rule = RULES[(Math.random() * RULES.length) | 0]; stats.timedRule = rule.id;
        if (rule.id === 'spikes') for (let k = 0; k < VIRUS_COUNT; k++) spawnVirus();
        setTimeout(() => { if (running && mode === 'timed') toast(`Правило раунда: «${rule.name}» — ${rule.about}`); }, 1800);
      }
    }
    function tick(dt) {
      if (dying || !running) return;
      try { evoLiveTick(dt); } catch (e) {}
      if (mode === 'hardcore' && solo()) {
        const m = total(player);
        while (hcBossStage < HC_BOSS_MILESTONES.length && m >= HC_BOSS_MILESTONES[hcBossStage]) {
          const reached = HC_BOSS_MILESTONES[hcBossStage++]; toast(`Угроза боссов повышена: ${reached.toLocaleString('ru-RU')} массы`); Sound.play('boss');
        }
        if (!hcSplitDone && m >= 50000) hcAutoSplit();
        { const ref = hcRef(); HC_BOSS_MASS_CAP = ref >= 20000 || hcSplitDone ? Math.max(23000, ref * 1.4) : 23000; }   // follows the smaller half both ways; bosses above it melt 1%/s (07-round)
        hcPackTick(dt); hcCurseTick(dt);
        if (m >= 10000 && bossTimer > 10) bossTimer = 10;   // from 10 000 the second boss does not keep you waiting
        if (hcSplitDone) hcFuseTick(dt);
        if (hcSplitDone && !hcFuseT) {
          let hm = hcHalfMass();
          for (const c of player.cells) if (c.hcHalf !== 0 && c.hcHalf !== 1) { c.hcHalf = hm[0] <= hm[1] ? 0 : 1; hm = hcHalfMass(); }
          stats.hcHalfPeak = [Math.max(stats.hcHalfPeak[0] || 0, hm[0]), Math.max(stats.hcHalfPeak[1] || 0, hm[1])];
          if (player.cells.length && (hm[0] <= 0 || hm[1] <= 0) && !hcRevive) { const h = hm[0] <= 0 ? 0 : 1; stats.hcHalfLost = (stats.hcHalfLost || 0) + 1; hcRevive = { h, t: 20 }; toast('Половина съедена! Через 20 с она возродится с 5 000 массы — береги вторую'); Sound.play('boss'); }
          if (hcRevive && (hcRevive.t -= dt) <= 0) { const h = hcRevive.h; hcRevive = null;
            if (player.cells.length && player.free.length) { let x = 0, z = 0; for (let k = 0; k < 30; k++) { [x, z] = randInArena(30); if (cells.every(c => c.owner === player || Math.hypot(c.x - x, c.z - z) > cellR(c) + 40)) break; }
              const c = addCell(player, x, z, 5000, player.free.pop()); c.hcHalf = h; c.mergeT = 2; player.spawnSh = 3; rebuildCells(); toast('Половина возродилась — 5 000 массы, 3 с защиты'); Sound.play('level'); } }
          if (hm[0] >= 50000 && hm[1] >= 50000) hcWinT += dt; else hcWinT = 0;
          hcWinUi(hm);
          if (hcWinT >= 15) { stats.hcVictory = true; stats.maxMass = Math.max(stats.maxMass || 0, m); stats.hcHalfMass = hm; finishRound('Победа в «Хардкоре»! Обе половины удержали 50 000', 0, true); return; }
        }
      }
      if (mode === 'classic' && solo()) {
        const m = total(player);
        // 2.7 harder «Классика»: bosses keep up with you (softer than «Хардкор»), packs after 20 000, the split at 50 000
        { const ref = hcRef(); CL_BOSS_MASS_CAP = ref >= 10000 || hcSplitDone ? Math.max(BOSS_MASS_CAP, ref * 1.2) : BOSS_MASS_CAP; }
        hcPackTick(dt);
        if (!hcSplitDone && m >= 50000) hcAutoSplit();
        if (hcSplitDone) hcFuseTick(dt);
        if (hcSplitDone && !hcFuseT) {
          let hm = hcHalfMass();
          for (const c of player.cells) if (c.hcHalf !== 0 && c.hcHalf !== 1) { c.hcHalf = hm[0] <= hm[1] ? 0 : 1; hm = hcHalfMass(); }
          stats.hcHalfPeak = [Math.max(stats.hcHalfPeak[0] || 0, hm[0]), Math.max(stats.hcHalfPeak[1] || 0, hm[1])];
          if (player.cells.length && (hm[0] <= 0 || hm[1] <= 0) && !hcRevive) { const h = hm[0] <= 0 ? 0 : 1; stats.hcHalfLost = (stats.hcHalfLost || 0) + 1; hcRevive = { h, t: 20 }; toast('Половина съедена! Через 20 с она возродится с 5 000 массы'); Sound.play('boss'); }
          if (hcRevive && (hcRevive.t -= dt) <= 0) { const h = hcRevive.h; hcRevive = null;
            if (player.cells.length && player.free.length) { let x = 0, z = 0; for (let k = 0; k < 30; k++) { [x, z] = randInArena(30); if (cells.every(c => c.owner === player || Math.hypot(c.x - x, c.z - z) > cellR(c) + 40)) break; }
              const c = addCell(player, x, z, 5000, player.free.pop()); c.hcHalf = h; c.mergeT = 2; player.spawnSh = 3; rebuildCells(); toast('Половина возродилась — 5 000 массы, 3 с защиты'); Sound.play('level'); } }
          if (!clGoalDone && hm[0] >= CL_GOAL && hm[1] >= CL_GOAL) {
            clGoalDone = true; stats.clGoal = true; stats.modeXCoins += CL_GOAL_COINS; stats.maxMass = Math.max(stats.maxMass || 0, m);
            save.special.push({ kind: 'challenge', rar: 'legendary', title: 'Две вершины' });
            if (!save.decor.includes('tt_twinpeak')) save.decor.push('tt_twinpeak');
            persist(); toast(`🏆 Обе половины по 50 000! +${CL_GOAL_COINS} ◆, легендарный сундук и титул «Две вершины». Можно забрать награду и выйти — или играть дальше`); Sound.play('level');
            if (TEST_MODE) try { TLog.ev('цель', 'обе по 50K'); } catch (e) {}
            if (player.cells.length) { const [x, z] = centerOf(player), r = cellR(mainOf(player)); for (let k = 0; k < 8; k++) emit(x, r + 1, z, k % 2 ? '#ffd23f' : '#3dffa2', 22, 14 + k * 2, 1); wave(x, z, '#ffd23f', r, r + 40, 1); }
          }
          hcWinUi(hm);
        }
        while (mile < MILES.length && m >= MILES[mile][0]) {
          const [goal, coins] = MILES[mile++]; stats.modeXCoins += coins;
          toast(`Веха ${goal.toLocaleString('ru-RU')}! +${coins} ◆`); Sound.play('level');
          if (goal === 30000) {   // the top: a title once, a legendary chest every time
            save.special.push({ kind: 'challenge', rar: 'legendary', title: 'Вершина' });
            if (!save.decor.includes('tt_summit')) { save.decor.push('tt_summit'); setTimeout(() => toast('Вершина «Классики»: титул «Вершина» и легендарный сундук!'), 1400); }
            else setTimeout(() => toast('Вершина «Классики»: легендарный сундук!'), 1400);
            persist();
          }
          if (player.cells.length) { const [x, z] = centerOf(player), r = cellR(mainOf(player)); for (let k = 0; k < 5; k++) emit(x, r + 1, z, k % 2 ? '#ffd23f' : '#22e6ff', 18, 12 + k * 2, .9); wave(x, z, '#ffd23f', r, r + 26, .8); }
        }
        const e = Math.min(ESC_MAX, Math.floor(stats.time / ESC_S));
        if (e > esc) { esc = e; stats.modeXCoins += 20 * esc; toast(`Арена накаляется: уровень ${esc + 1}. Боты быстрее, боссы чаще, награда выше (+${20 * esc} ◆)`); Sound.play('boss'); }
      }
      if (mode === 'rbuild' && solo()) rbTick();
      if (mode === 'raid') RaidX.tick(dt);
      if (mode === 'timed' && !rushOn && stats.time >= TIMED_LEN - RUSH_S) { rushOn = true; toast(`Финальный рывок! ${RUSH_S} секунд, крошки вдвое сытнее`); Sound.play('level'); }
      if (mode === 'timed' && stats.midRank === undefined && stats.time >= TIMED_LEN / 2) stats.midRank = rankOf();
      if (mode === 'crown') for (const o of bossOwners) for (const c of o.cells) c.mass = Math.max(20, c.mass * (1 - .008 * dt));   // the crown's bosses melt too
      if (mode === 'hardcore' && !stats.ranked) {
        if (hcMile < HC_MILES.length && total(player) >= HC_MILES[hcMile] && !hcOffer && (HC_MILES[hcMile] <= 20000 || stats.time - hcLastOffer >= 20)) {   // 2.7: no burst of cards — after 20 000 one per 20 s
          hcLastOffer = stats.time;
          const [floor, up] = HC_TIER[hcMile]; hcMile++;
          const pool = Object.keys(HC_BOOST).filter(k => hcN[k] < HC_CAP), ids = [];
          while (pool.length && ids.length < 2) ids.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
          if (ids.length) { const ri = ids.length > 1 ? Math.floor(Math.random() * 2) : -1; hcOffer = ids.map((k, i) => ({ k, r: Math.min(3, floor + (Math.random() < up ? 1 : 0)), risk: i === ri })); hcT = 15; hcPanel(hcOffer);
            toast(`Масса ${HC_MILES[hcMile - 1].toLocaleString('ru-RU')}: выбери улучшение`); Sound.play('level'); }
        }

        hcPredT = Math.max(0, hcPredT - dt);
        if (TEST_MODE) hcDebug(dt);
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
    function hcPanel(offer) {
      let el = document.getElementById('hcPick');
      if (!el) {
        el = document.createElement('div'); el.id = 'hcPick'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Выбери улучшение'); document.body.appendChild(el);
        el.addEventListener('pointerdown', e => e.stopPropagation());
        el.addEventListener('click', e => { const b = e.target.closest('[data-hi]'); if (b) hcPick(+b.dataset.hi); });
      }
      if (!offer) { el.hidden = true; return; }
      el.innerHTML = `<p>Хардкор: веха ${HC_MILES[hcMile - 1].toLocaleString('ru-RU')} — выбери улучшение · игра на паузе · <b id="hcPickT">15</b> с</p><div class="db-opts two">${offer.map((o, i) => { const b = HC_BOOST[o.k];
        return `<button type="button" data-hi="${i}" class="hc-card r${o.r}${o.risk ? ' risk' : ''}" style="--rc:${RARITY[HC_R[o.r]].color}"><span class="hc-rar">${HC_RN[o.r]}</span>${o.risk ? '<span class="hc-risk">⚠ риск</span>' : ''}<span class="ic">${b[0]}</span><b>${hcLabel(o.k, o.r, o.risk)}</b>${o.risk ? `<span class="hc-debuff">🔻 ${HC_DEBUFF[o.k][1]} ${hcRiskD(o.k, o.r)}%</span>` : ''}<small>${HC_ABOUT[o.k]} · до конца раунда${hcN[o.k] ? ` · уже ${hcN[o.k]} из ${HC_CAP}` : ''}</small></button>`; }).join('')}</div>`;
      el.hidden = false;
    }
    function hcPick(i) {
      if (!hcOffer) return; const o = hcOffer[i] || hcOffer[0], b = HC_BOOST[o.k], v = o.risk ? hcRiskV(o.k, o.r) : b[2][o.r];
      if (b[3] === '+') hc[o.k] += v; else hc[o.k] *= 1 - v / 100; hcN[o.k]++;
      if (o.risk) { const [t] = HC_DEBUFF[o.k]; hcD[t] = (hcD[t] || 0) + hcRiskD(o.k, o.r); }
      if (hcLog) hcLog.picks.push({ mile: HC_MILES[hcMile - 1], t: Math.round(stats.time), boost: o.k, rar: HC_RN[o.r], v, risk: o.risk ? HC_DEBUFF[o.k][0] + '+' + hcRiskD(o.k, o.r) : '', other: hcOffer.filter(x => x !== o).map(x => x.k + ':' + HC_RN[x.r]).join() });
      hcOffer = null; hcPanel(null); toast(`${HC_RN[o.r]}: ${o.risk ? hcLabel(o.k, o.r, true) + ` · 🔻 ${HC_DEBUFF[o.k][1]} ${hcRiskD(o.k, o.r)}%` : hcLabel(o.k, o.r)} до конца раунда`);
    }
    // test build only: what the boosts give and how fast you eat vs how fast you melt
    function hcDebug(dt) {
      let el = document.getElementById('hcDbg'); if (!el) { el = document.createElement('div'); el.id = 'hcDbg'; document.body.appendChild(el); }
      const m = total(player); let melt = 0; for (const c of player.cells) if (c.mass > 100) melt += c.mass * HC_DECAY * Math.pow(c.mass / 100, .25) * (1 - .04 * U.guard) * Math.max(.6, hcK('melt')) * hcDK('melt') * (curseOn('hunger') ? 1.5 : 1) * hcMeltUp();
      hcDbg.t += dt; if (hcDbg.t >= 1) { hcDbg.gain = hcDbg.gain * .7 + .3 * ((m - hcDbg.m) / hcDbg.t + melt); hcDbg.m = m; hcDbg.t = 0; }
      if (hcLog && stats.time >= hcLog.next && hcLog.samples.length < 400) { hcLog.next = stats.time + 5; const hm = hcHalfMass(); hcLog.samples.push([Math.round(stats.time), Math.round(m), Math.round(melt), Math.max(0, Math.round(hcDbg.gain)), player.cells.length, Math.round(hm[0]), Math.round(hm[1]), hcBossStage]); }
      const list = Object.keys(HC_BOOST).filter(k => hcN[k]).map(k => `${HC_BOOST[k][0]}${HC_BOOST[k][3] === '+' ? '+' + hc[k] : '−' + Math.round((1 - hc[k]) * 100)}%`).join(' ');
      el.textContent = `ТЕСТ · ${Math.round(m)} · тает ${Math.round(melt)}/с · ешь ≈${Math.max(0, Math.round(hcDbg.gain))}/с · ${list || 'улучшений нет'} · ● запись`;
    }
    // the end of a round: the hardcore series reward
    function end() {
      rbOffer = null; rbPanel(); RaidX.end(); hcPanel(null); { const b = document.getElementById('hcFuse'); if (b) b.hidden = true; } { const w = document.getElementById('hcWin'); if (w) w.hidden = true; } hcWinUi(null); hcCurse = null; hcCurseUi(); tether.visible = false; nextRing.visible = false; { const d = document.getElementById('hcDbg'); if (d) d.remove(); }
      if (hcLog) { const rec = { ...hcLog, peak: Math.round(stats.maxMass), time: Math.round(stats.time), miles: hcMile, kills: stats.kills, bosses: stats.bosses || 0, splitAt: stats.hcSplitAt ?? null, halfPeak: stats.hcHalfPeak || [0, 0], victory: !!stats.hcVictory, end: stats.endTitle || '', bites: stats.bites || [] }; delete rec.next; hcLog = null; if (TEST_MODE) TLog.extra('hardcore', rec);   // bites: [time, who, its mass, the part it ate]
        try { const L = JSON.parse(localStorage.getItem('kapli3d-hcstats') || '[]'); L.push(rec); localStorage.setItem('kapli3d-hcstats', JSON.stringify(L.slice(-30))); } catch (e) {}
        (async () => { try { const db = window.claude && window.claude.use && await window.claude.use('db'); if (db) { await db.collection('hcstats').add(rec); toast('Статистика «Хардкора» сохранена'); } } catch (e) {} })(); }
      if (mode !== 'hardcore' || stats.ranked || stats.tutorial) return;
      save.hcStreak = stats.maxMass >= 3000 ? (save.hcStreak || 0) + 1 : 0;
      save.hcPeak = Math.max(save.hcPeak || 0, Math.round(stats.maxMass));
      if (stats.hcVictory) {
        save.hc100k = true; save.hc100kAt = save.hc100kAt || Date.now();
        save.badges = save.badges || {}; save.badges.hc100k = save.badges.hc100k || save.hc100kAt;
        pbgCheck(false); persist(); stats.hcReward = 'Предел двух миров';
        setTimeout(() => toast('Эксклюзивные награды получены: значок «Предел двух миров» и фон «Сингулярный трон»'), 900);
      }
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
    // 2.7: «связки» — pairs of the bosses that already exist, chosen so that one helps the other
    const COMBOS = [
      { name: 'Ловушка', a: 'frost', b: 'hunter', how: 'Морозец замедляет — Шустрик догоняет' },
      { name: 'Засада', a: 'chameleon', b: 'hunter', how: 'Шустрик гонит тебя прямо к невидимому Мимику' },
      { name: 'Рой', a: 'queen', b: 'splitter', how: 'прислужники и осколки со всех сторон' },
      { name: 'Стена', a: 'giant', b: 'splitter', how: 'Громила перекрывает путь, осколки Делителя окружают' },
      { name: 'Ледяной рой', a: 'frost', b: 'queen', how: 'прислужники в ледяном облаке' },
      { name: 'Тень великана', a: 'giant', b: 'chameleon', how: 'за Громилой прячется Мимик' },
    ];
    let comboOrder = [];
    function survCombo() {
      if (stats.wave < 3 || stats.wave % 3) return null;
      if (!comboOrder.length) comboOrder = COMBOS.map((c, i) => [Math.random(), c]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
      return comboOrder.pop();
    }
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
      // 2.7: what the ⓘ window of «Режимы» tells about each mode
      info: () => ({ RB_MILES, RB_LV, CL_GOAL, CL_GOAL_COINS, MILES, ESC_S, ESC_MAX, RUSH_S, RULES, HC_MILES, HC_BOOST, HC_TIER, HC_RN, HC_CAP, HC_ABOUT, HC_BOSS_MASS_CAP, HC_BOSS_MILESTONES, HC_SPLIT_AT: 50000, HC_HALF_WIN: 50000, COMBOS, PLACE: [40, 25, 15, 12, 10, 8, 7, 6] }),
      HC_DECAY, meltK: () => (mode === 'hardcore' ? Math.max(.6, hcK("melt")) * hcDK("melt") * (curseOn("hunger") ? 1.5 : 1) : hcK("melt")) * hcMeltUp(), hcK,
      hcCurseSoon: () => { hcCurse = null; hcCurseT = 3; },
      hcCurseId: () => mode === 'hardcore' && hcCurse ? hcCurse.id : null,   // 2.7 test journal
      hcMagnetK: () => (mode === 'hardcore' ? hcDM("magnet") : 1), hcDashLenK: () => (mode === 'hardcore' ? hcDM("dashLen") : 1), hcNoDash: () => curseOn("nodash"),
      hcSenseK: () => (mode === 'hardcore' ? hcDK("sense") * (curseOn("hunted") ? 1.5 : 1) : 1),
      hcBossMass: mass => { const ref = hcRef(); return hcSplitDone || ref >= 20000 ? Math.min(HC_BOSS_MASS_CAP, Math.max(3000, ref * (.85 + .35 * hcBossPressure()))) : mass; },   // after 20 000: 85–120% of the smaller half (more with the threat stage)
      clBossGainK: pair => (mode === 'classic' && solo() && total(player) >= 15000 ? (pair || hcFuseT > 0 ? .4 : .5) : 1),   // «Классика» from 15 000: a boss feeds half (like «Хардкор»)
      clGainK: () => (mode === 'classic' && solo() ? clGainK() : 1), clAngry: () => mode === 'classic' && solo() && total(player) >= 20000, splitMode,
      hcPackTarget, botCap: o => (splitMode() && o.hcPack ? Math.max(BOT_MASS_CAP, hcRef() * 1.4) : BOT_MASS_CAP),
      hcPackMerge: (a, b) => splitMode() && a.owner.hcPack && b.owner.hcPack && a.owner !== b.owner && a.mass >= b.mass,
      // the choice of a hardcore card stops the world; the 15 s countdown runs in real time
      hcFrozen: () => (mode === 'hardcore' && !!hcOffer) || (mode === 'rbuild' && !!rbOffer), hcFusing: () => splitMode() && hcFuseT > 0, hcPairBite,
      hcFreezeTick(dt) { if (rbOffer) { rbT -= dt; const t = document.getElementById('rbPickT'); if (t) t.textContent = Math.max(0, Math.ceil(rbT)); if (rbT <= 0) { rbOffer = null; rbPanel(); toast('Время вышло — билд не изменился'); } return; } hcT -= dt; const el = document.getElementById('hcPickT'); if (el) el.textContent = Math.max(0, Math.ceil(hcT)); if (hcT <= 0) hcPick(0); }, hcSpikesDisabled, hcKill: () => { if (mode === 'hardcore' && hc.predator) hcPredT = 2; },
      hcBossPressure, hcBossSenseK: () => (hcSplitDone ? 2 : 1 + .5 * hcBossPressure()), hcBossTurnK: () => (hcSplitDone ? 1.8 : 1 + .55 * hcBossPressure()), hcPackSpeedK: o => (splitMode() && o.hcPack ? (mode === 'classic' ? 1.1 : 1.15) : 1),
      hcBossSpawnInterval: () => (hcSplitDone ? 6 : total(player) >= 10000 ? 10 : 40 - 16 * hcBossPressure()), hcBossTarget,
      start, tick, end, survWave, survGrow, survCombo, placeBonus, crownRules, crownBite,
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
      cdK: o => (o === player ? hcK('cd') : 1),
      gainK: () => (mode === 'classic' && solo() ? clGainK() : mode === 'timed' ? (rushOn ? 2 : 1) * (rule && rule.id === 'feast' ? 1.5 : 1) : mode === 'hardcore' ? hcK('absorb') * (total(player) >= 50000 ? .5 : .75) * hcDM('absorb') : 1),
      bonusK: () => (rule && rule.id === 'bonus2' ? .5 : 1),
      botSpeedK: o => (mode === 'crown' && o === crownHolder ? .85 : 1) * (o.mate && o.mate.cells.length && o.cells.length && Math.hypot(o.cells[0].x - o.mate.cells[0].x, o.cells[0].z - o.mate.cells[0].z) < 40 ? 1.1 : 1) * (o.isPlayer && mode === 'hardcore' ? hcK('speed') * (hcPredT > 0 ? hcK('predator') : 1) * hcDM('slow') * (curseOn('slow') ? .8 : 1) : 1) *
        (o.kind === 'bot' ? (mode === 'classic' ? 1 + .04 * esc : rule && rule.id === 'fastbots' ? 1.15 : 1) : 1),
      bossK: () => (mode === 'classic' ? Math.max(.5, 1 - .125 * esc) : 1),
      quitLabel: () => (mode === 'classic' && (stats.time >= 300 || clGoalDone) ? 'Забрать награду и выйти' : 'Завершить раунд'),
      chip() {
        if (mode === 'classic' && solo()) { const nx = MILES[mile]; return nx ? `Веха ${nx[0].toLocaleString('ru-RU')} · осталось ${Math.max(0, Math.ceil(nx[0] - total(player))).toLocaleString('ru-RU')}${esc ? ` · арена ур. ${esc + 1}` : ''}` : clGoalDone ? `Все вехи взяты${esc ? ` · арена ур. ${esc + 1}` : ''}` : `Цель: обе половины по 50 000${esc ? ` · арена ур. ${esc + 1}` : ''}`; }
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
        if (mode === 'hardcore' && Object.values(hcN).some(n => n)) return Object.keys(HC_BOOST).filter(k => hcN[k]).map(k => HC_BOOST[k][0] + (hcN[k] > 1 ? '×' + hcN[k] : '')).join(' ');
        return '';
      },
    };
  })();
  // «Хардкор»: «Перезарядка −10%» shortens a fresh cooldown of an ability
  { const cast1 = castAbility; castAbility = (id, o = player) => { const before = o.abCd ? o.abCd[id] || 0 : 0, r = cast1(id, o); const k = ModeX.cdK(o); if (k < 1 && o.abCd && (o.abCd[id] || 0) > before) o.abCd[id] *= k; return r; }; }
  // ================= 2.7 «Босс-рейд»: a ladder of 5 steps + a colossus that fights back =================
  // Each week: steps I–V, each one fight of 4 minutes, as many tries as you like; the reward of a step — once a week.
  // The twins have 3 phases (from ⅓ and ⅔ of the damage) with telegraphed attacks, weak cores (×3 damage) and one special attack of the week's boss.
  const RAID_TIERS = [
    { hp: 12000, spd: 1,    atk: 1,    coins: 300 },
    { hp: 20000, spd: 1.05, atk: 1.15, coins: 500 },
    { hp: 30000, spd: 1.1,  atk: 1.3,  coins: 800 },    // step III: the weekly trophy and the raid wins (as the old weekly victory)
    { hp: 42000, spd: 1.15, atk: 1.5,  coins: 1200 },
    { hp: 55000, spd: 1.2,  atk: 1.75, coins: 2000 },   // step V: a legendary chest, the title «Гроза колоссов» once
  ];
  const RAID_ROMAN = ['I', 'II', 'III', 'IV', 'V'];
  // the special attack of each weekly boss (same order as RAID_NAMES)
  const RAID_SPECIAL = [
    ['pull', 'Притяжение', 'затягивает капли к себе'], ['ink', 'Чернила', 'гасит мини-карту и затемняет поле'], ['crystal', 'Кристаллы', 'кристаллы на полу оглушают'],
    ['tentacles', 'Щупальца', 'вокруг тебя вырастают щупальца-прислужники'], ['blink', 'Прыжок', 'исчезает и появляется рядом с тобой'], ['ice', 'Лёд', 'ледяные поля замедляют'],
    ['lava', 'Лава', 'лужи лавы сжигают массу'], ['ghost', 'Призрак', 'на 3 с становится неуязвимым и быстрым'],
  ];
  const RaidX = (() => {
    let tierI = 0, phase = 1, atkT = 6, coreT = 10, zones = [], cores = [], inkT = 0, pullT = 0, ghostT = 0;
    const zoneGeo = new THREE.CircleGeometry(1, 48), ringGeo = new THREE.RingGeometry(.94, 1, 64), coreGeo = new THREE.OctahedronGeometry(1);
    const ZC = { burst: '#ff3d6e', lava: '#ff6a00', ice: '#9ff0ff', crystal: '#c58bff', blink: '#ffffff', ring: '#ffd23f' };
    const tier = () => RAID_TIERS[tierI], special = () => RAID_SPECIAL[raidWeek() % RAID_SPECIAL.length];
    const twinsAlive = () => raidTwins.filter(o => o.cells.length);
    const bigPart = () => { let b = null; for (const o of raidTwins) for (const c of o.cells) if (!b || c.mass > b.mass) b = c; return b; };
    const pMain = () => player.cells.length ? mainOf(player) : null;
    function addZone(x, z, r, kind, delay, dur) {
      const m = new THREE.Mesh(zoneGeo, decal(new THREE.MeshBasicMaterial({ color: ZC[kind], transparent: true, opacity: .12, depthWrite: false })));
      const ring = new THREE.Mesh(ringGeo, decal(new THREE.MeshBasicMaterial({ color: ZC[kind], transparent: true, opacity: .8, depthWrite: false, side: THREE.DoubleSide })));
      [m, ring].forEach(o => { o.rotation.x = -Math.PI / 2; o.position.set(x, .09, z); o.scale.setScalar(r); scene.add(o); });
      zones.push({ x, z, r, kind, t: delay, dur, m, ring, on: false });
    }
    function dropZone(zn) { scene.remove(zn.m); scene.remove(zn.ring); zn.m.material.dispose(); zn.ring.material.dispose(); }
    const inZone = (zn, c) => Math.hypot(c.x - zn.x, c.z - zn.z) < zn.r + cellR(c) * .3;
    function aroundPlayer(n, r, kind, delay, dur) {
      const m = pMain(); if (!m) return;
      for (let k = 0; k < n; k++) { const a = Math.random() * 6.283, d = k === 0 ? 0 : 30 + Math.random() * 50; let x = m.x + Math.cos(a) * d, z = m.z + Math.sin(a) * d; const L = Math.hypot(x, z); if (L > R - r) { x *= (R - r) / L; z *= (R - r) / L; } addZone(x, z, r, kind, delay, dur); }
    }
    function attack() {
      const b = bigPart(), m = pMain(); if (!b || !m) return;
      const sp = special(), list = ['ring', 'charge', 'burst', ...(phase >= 2 ? ['minions'] : [])];
      const pick = Math.random() < .45 ? sp[0] : list[Math.floor(Math.random() * list.length)];
      const r0 = Math.max(18, cellR(m) * 1.2);
      if (pick === 'ring') { addZone(b.x, b.z, cellR(b) + 110, 'ring', 1, 0); wave(b.x, b.z, ZC.ring, cellR(b), cellR(b) + 110, 1); }
      else if (pick === 'charge') { const o = b.owner; o.dashT = 1.1 + .2 * phase; o.target = m; o.think = 1.5; emit(b.x, cellR(b), b.z, '#ff3d6e', 16, 10, .6); toast('⚠ Колосс несётся на тебя!'); }
      else if (pick === 'burst') aroundPlayer(1 + phase, r0, 'burst', 1.3, 0);
      else if (pick === 'minions' || pick === 'tentacles') { const n = pick === 'tentacles' ? 4 : 2 + phase; for (let k = 0; k < n; k++) { spawnMinion(b.owner); const mi = minions.filter(o => o.cells.length).pop(); if (mi) { const c = mi.cells[0]; c.mass = Math.max(c.mass, Math.min(2500, m.mass * .3)); if (pick === 'tentacles') { const a = k / n * 6.283; c.x = m.x + Math.cos(a) * (cellR(m) + 40); c.z = m.z + Math.sin(a) * (cellR(m) + 40); } } } }
      else if (pick === 'pull') { pullT = 2.5; wave(b.x, b.z, '#c2416b', cellR(b) + 140, cellR(b), 1); }
      else if (pick === 'ink') { inkT = 6; }
      else if (pick === 'crystal') aroundPlayer(2 + phase, r0 * .8, 'crystal', 1.2, 0);
      else if (pick === 'blink') { const a = Math.random() * 6.283, d = cellR(m) + cellR(b) + 40; addZone(m.x + Math.cos(a) * d, m.z + Math.sin(a) * d, cellR(b), 'blink', 1.1, 0); zones[zones.length - 1].part = b; }
      else if (pick === 'ice') aroundPlayer(2 + phase, r0 * 1.3, 'ice', 1.2, 5);
      else if (pick === 'lava') aroundPlayer(2 + phase, r0, 'lava', 1.2, 5);
      else if (pick === 'ghost') { ghostT = 3; raidTwins.forEach(o => { if (o.cells.length) { o.spawnSh = 3; o.dashT = 3; } }); wave(b.x, b.z, '#ffffff', cellR(b), cellR(b) + 30, .8); toast('👻 Колоссы неуязвимы 3 с'); }
      if (TEST_MODE) try { TLog.ev('атака', pick); } catch (e) {}
    }
    function zoneFire(zn) {
      const P = player.cells;
      if (zn.kind === 'ring') { const b = bigPart(); if (b) for (const c of P) { const d = Math.hypot(c.x - zn.x, c.z - zn.z); if (d < zn.r && d > cellR(b) * .6) { ccSlow(player, 1.5); const k = 30 / (d || 1); c.vx = (c.vx || 0) + (c.x - zn.x) * k; c.vz = (c.vz || 0) + (c.z - zn.z) * k; } } }
      else if (zn.kind === 'burst') { let hit = false; for (const c of P) if (inZone(zn, c)) { c.mass = Math.max(20, c.mass * .9); hit = true; } emit(zn.x, 1, zn.z, ZC.burst, 14, 12, .6); if (hit) { buzz(40); toast('💥 Взрыв: −10% массы'); } }
      else if (zn.kind === 'crystal') { let hit = false; for (const c of P) if (inZone(zn, c)) hit = true; if (hit) ccFreeze(player, 1.4); emit(zn.x, 1, zn.z, ZC.crystal, 12, 10, .6); }
      else if (zn.kind === 'blink' && zn.part && !zn.part.gone) { zn.part.x = zn.x; zn.part.z = zn.z; zn.part.vx = zn.part.vz = 0; emit(zn.x, 1, zn.z, '#ffffff', 18, 12, .7); }
    }
    function coreSpawn() {
      const b = bigPart(); if (!b || cores.length >= 2) return;
      const a = Math.random() * 6.283, d = cellR(b) + 25 + Math.random() * 40;
      let x = b.x + Math.cos(a) * d, z = b.z + Math.sin(a) * d; const L = Math.hypot(x, z); if (L > R - 10) { x *= (R - 10) / L; z *= (R - 10) / L; }
      const m = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ color: '#ffd23f' })); m.scale.setScalar(5); m.position.set(x, 4, z); scene.add(m);
      cores.push({ x, z, t: 10, m }); toast('✦ Слабое ядро! Съешь его — урон ×3');
    }
    function coreHit(k) {
      const cr = cores[k]; scene.remove(cr.m); cr.m.material.dispose(); cores.splice(k, 1);
      const parts = raidTwins.flatMap(o => o.cells), tw = parts.reduce((s, c) => s + c.mass, 0); if (!tw) return;
      const dmg = Math.min(tw * .9, Math.round(tier().hp * .06 * raidPerk().dmg));
      for (const c of parts) c.mass = Math.max(20, c.mass * (1 - dmg / tw));
      stats.raidDmg = (stats.raidDmg || 0) + dmg; stats.raidCores = (stats.raidCores || 0) + 1;
      emit(cr.x, 4, cr.z, '#ffd23f', 24, 14, .8); wave(cr.x, cr.z, '#ffd23f', 4, 40, .6); Sound.play('level'); toast(`✦ Ядро: ${dmg.toLocaleString('ru-RU')} урона`);
      if (TEST_MODE) try { TLog.ev('ядро', dmg); } catch (e) {}
    }
    function clear() { zones.forEach(dropZone); zones = []; cores.forEach(c => { scene.remove(c.m); c.m.material.dispose(); }); cores = []; inkT = 0; pullT = 0; ghostT = 0; document.body.classList.remove('raid-ink'); const mm = document.getElementById('miniWrap'); if (mm) mm.classList.remove('fog'); }
    function start(t) {
      clear(); tierI = Math.max(0, Math.min(4, t | 0)); phase = 1; atkT = 7; coreT = 12; stats.raidTier = tierI + 1; stats.raidCores = 0;
      setTimeout(() => { if (running && mode === 'raid') { const s = special(); toast(`Ступень ${RAID_ROMAN[tierI]} · ${tier().hp.toLocaleString('ru-RU')} урона · особая атака босса: «${s[1]}» — ${s[2]}`); } }, 3200);
    }
    function tick(dt) {
      if (mode !== 'raid' || !running) return;
      const dealt = stats.raidDmg || 0, ph = dealt >= tier().hp * 2 / 3 ? 3 : dealt >= tier().hp / 3 ? 2 : 1;
      if (ph > phase) { phase = ph; atkT = Math.min(atkT, 2); toast(phase === 2 ? 'Фаза 2: колоссы злятся — атаки чаще, появляются прислужники' : 'Фаза 3: последний рывок — атаки ещё чаще, ядра появляются быстрее'); Sound.play('boss'); if (TEST_MODE) try { TLog.ev('фаза', phase); } catch (e) {} }
      for (const o of raidTwins) if (o.cells.length && o.dashT > 0) o.dashT -= dt;
      if (twinsAlive().length && (atkT -= dt) <= 0) { atkT = (9 - 2 * (phase - 1)) / tier().atk * (.85 + Math.random() * .3); attack(); }
      if ((coreT -= dt) <= 0) { coreT = phase === 3 ? 10 : 14; coreSpawn(); }
      for (let k = zones.length - 1; k >= 0; k--) {
        const zn = zones[k]; zn.t -= dt;
        if (!zn.on) { const f = Math.max(0, zn.t); zn.ring.material.opacity = .5 + .4 * Math.abs(Math.sin(f * 9)); zn.m.material.opacity = .1 + .25 * (1 - Math.min(1, f)); if (zn.t <= 0) { zn.on = true; zoneFire(zn); zn.t = zn.dur; zn.m.material.opacity = zn.dur ? .38 : 0; } }
        else {
          if (zn.kind === 'lava') for (const c of player.cells) if (inZone(zn, c)) c.mass = Math.max(20, c.mass * (1 - .05 * dt));
          if (zn.kind === 'ice') for (const c of player.cells) if (inZone(zn, c)) player.slowT = Math.max(player.slowT || 0, .25);
        }
        if (zn.on && zn.t <= 0) { dropZone(zn); zones.splice(k, 1); }
      }
      for (let k = cores.length - 1; k >= 0; k--) {
        const cr = cores[k]; cr.t -= dt; cr.m.rotation.y += dt * 2; cr.m.position.y = 4 + Math.sin(stats.time * 4) * .8;
        if (cr.t <= 0) { scene.remove(cr.m); cr.m.material.dispose(); cores.splice(k, 1); continue; }
        if (player.cells.some(c => Math.hypot(c.x - cr.x, c.z - cr.z) < cellR(c) + 4)) coreHit(k);
      }
      if (pullT > 0) { pullT -= dt; const b = bigPart(); if (b) for (const c of player.cells) { const dx = b.x - c.x, dz = b.z - c.z, d = Math.hypot(dx, dz) || 1; c.x += dx / d * 22 * dt; c.z += dz / d * 22 * dt; } }
      if (inkT > 0) { inkT -= dt; document.body.classList.toggle('raid-ink', inkT > 0); const mm = document.getElementById('miniWrap'); if (mm) mm.classList.toggle('fog', inkT > 0); }
      if (ghostT > 0) ghostT -= dt;
      if (dealt >= tier().hp) { finishRound(`Ступень ${RAID_ROMAN[tierI]} пройдена!`, 0, true); }
    }
    // the step picker before a raid round
    function picker(go) {
      let el = document.getElementById('raidTiers');
      if (!el) { el = document.createElement('div'); el.id = 'raidTiers'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Выбор ступени рейда'); document.body.appendChild(el);
        el.addEventListener('click', e => { if (e.target === el || e.target.closest('[data-rt-x]')) { el.hidden = true; return; } const b = e.target.closest('[data-rt]'); if (b && !b.disabled) { el.hidden = true; go(+b.dataset.rt); } }); }
      const rs = raidState(), bs = raidBoss(rs.week), sp = special();
      el.innerHTML = `<div class="rt-box"><button type="button" class="rt-x" data-rt-x aria-label="Закрыть">✕</button><h3>${bs.name} и близнец</h3><p>Особая атака недели: <b>«${sp[1]}»</b> — ${sp[2]}. Попыток сколько угодно, награда за ступень — раз в неделю.</p><div class="rt-list">` +
        RAID_TIERS.map((t, i) => { const done = rs.cleared.includes(i + 1), open = TEST_MODE || i === 0 || rs.cleared.includes(i);
          const extra = i === 2 ? ' + трофей недели' : i === 4 ? ' + легендарный сундук' : '';
          return `<button type="button" data-rt="${i}" class="${done ? 'done' : ''}" ${open ? '' : 'disabled'}><b>${RAID_ROMAN[i]}</b><span>${t.hp.toLocaleString('ru-RU')} урона за 4 мин<small>${done ? '✓ пройдена на этой неделе' : open ? `награда: ${t.coins.toLocaleString('ru-RU')} ◆${extra}` : '🔒 сначала пройди ступень ' + RAID_ROMAN[i - 1]}</small></span></button>`; }).join('') + '</div></div>';
      el.hidden = false;
    }
    return { start, tick, end: clear, picker, phase: () => phase, tier, tierI: () => tierI, special };
  })();
