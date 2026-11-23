  // ================= menus, part: icons, back arrows, empty states, 3D and drawn previews, «Достижения» tabs (was in 08-menus.js; the files are joined in order by js/loader.js) =================
  // ---- 2.0.7: icons, header back arrows, goals fade, empty states, «new in the shop», the menu blob ----
  const ICON_SVG = {
    chat: '<path d="M4 5h16v11H10l-5 4v-4H4z"/><path d="M8 9.5h8M8 12.5h5"/>',
    friends: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19.5c0-3.3 2.7-5.6 6-5.6s6 2.3 6 5.6"/><circle cx="17" cy="9" r="2.5"/><path d="M15.8 13.7c2.9.3 5.2 2.3 5.2 5.3"/>',
    clan: '<path d="M12 3l7.5 3v5.3c0 4.5-3.1 8-7.5 9.9-4.4-1.9-7.5-5.4-7.5-9.9V6z"/><path d="M12 7.5v9M8.5 11h7"/>',
    rating: '<path d="M3 20.5h18M5 20.5v-6h4v6M10 20.5V10h4v10.5M15 20.5v-8h4v8"/><path d="M12 2.8l1 2.1 2.2.3-1.6 1.6.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.6 2.2-.3z"/>',
    news: '<path d="M4 10v4h3l7 4.5v-13L7 10z"/><path d="M17.5 9a4 4 0 0 1 0 6M20 6.5a7.5 7.5 0 0 1 0 11"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.7" r=".6" fill="currentColor"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 3.5l1.5 2.2 2.6-.6.6 2.6 2.2 1.5-1.4 2.3 1.4 2.3-2.2 1.5-.6 2.6-2.6-.6L12 20.5l-1.5-2.2-2.6.6-.6-2.6-2.2-1.5 1.4-2.3-1.4-2.3 2.2-1.5.6-2.6 2.6.6z"/>',
    trophy: '<path d="M8 4h8v5.5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4.2M16 6h3a3 3 0 0 1-3 4.2M12 13.5v3.5M9 20.5h6M10 17h4v3.5h-4z"/>',
    collection: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.6-1-2.6 0-.9.7-1.4 1.6-1.4H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11.5" r="1.3"/><circle cx="10" cy="7.3" r="1.3"/><circle cx="15" cy="7.6" r="1.3"/>',
    gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8.5h14V12M12 8v12.5M12 8c-1.8-4.2-6.3-4-6-1.3.2 1.3 2.5 1.3 6 1.3zM12 8c1.8-4.2 6.3-4 6-1.3-.2 1.3-2.5 1.3-6 1.3z"/>',
    shop: '<path d="M5 8h14l-1.2 12.5H6.2z"/><path d="M9 10.5V7a3 3 0 0 1 6 0v3.5"/>',
    workshop: '<circle cx="9" cy="14" r="4.2"/><circle cx="9" cy="14" r="1.4"/><path d="M9 8.3v1.5M9 18.2v1.5M3.3 14h1.5M13.2 14h1.5M5 10l1 1M12 17l1 1M5 18l1-1M12 11l1-1"/><path d="M14.5 3.5l6 6-2 2-6-6zM15.5 8.5l-3.2 3.2"/>',
    back: '<path d="M15 5l-7 7 7 7"/>'
  };
  const icon = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON_SVG[k]}</svg>`;
  document.querySelectorAll('.ic[data-ic]').forEach(el => { el.innerHTML = icon(el.dataset.ic); });
  // every window gets ← in its header (landscape); it does what its own back button does, or closes an open section first
  [['accountCard', 'acctBack'], ['chatCard', 'chatBack'], ['clanCard', 'clanBack'], ['friendsCard', 'frBack'], ['dmCard', 'dmBack'], ['rankCard', 'rankBack'],
   ['shopCard', 'backBtn'], ['chestCard', 'chestBack'], ['modesCard', 'modesBack'], ['chaosCard', 'chaosBack'], ['leagueCard', 'leagueBack'], ['profileCard', 'profBack'],
   ['infoCard', 'infoBack'], ['settingsCard', 'setBack'], ['wsCard', 'wsBack'], ['duoCard', 'duoBack'], ['hubLeague', null], ['hubCol', null], ['hubRew', null]].forEach(([cid, bid]) => {
    const card = $(cid), own = bid ? $(bid) : card.querySelector(':scope > [data-hubback]'); if (!card || !own) return;
    own.classList.add('card-foot-back');
    const b = document.createElement('button'); b.type = 'button'; b.className = 'card-back'; b.setAttribute('aria-label', 'Назад'); b.innerHTML = icon('back');
    b.addEventListener('click', () => { const g = [...card.querySelectorAll('[data-grpback]')].find(x => x.offsetParent); (g || own).click(); });
    card.prepend(b);
  });
  // goals: fade the bottom and say how many are below when the list scrolls
  function goalFade() {
    const l = $('menuQuests'), box = l.closest('.goals'); let m = box.querySelector('.goal-more');
    const below = [...l.children].filter(li => li.offsetTop + li.offsetHeight / 2 > l.scrollTop + l.clientHeight).length;
    l.classList.toggle('more', below > 0);
    if (below) { if (!m) { m = document.createElement('span'); m.className = 'goal-more'; m.setAttribute('aria-hidden', 'true'); box.appendChild(m); } m.textContent = `ещё ${below} ↓`; } else if (m) m.remove();
  }
  $('menuQuests').addEventListener('scroll', goalFade, { passive: true }); addEventListener('resize', () => requestAnimationFrame(goalFade));
  // a little drop for empty lists
  function emptyHTML(text, mood = 'sad') {
    const eyes = mood === 'sleep' ? '<path d="M37 47q4 3 8 0M55 47q4 3 8 0" stroke="#0b0624" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
      : '<circle cx="41" cy="47" r="4.2" fill="#0b0624"/><circle cx="59" cy="47" r="4.2" fill="#0b0624"/><circle cx="42.3" cy="45.6" r="1.4" fill="#fff"/><circle cx="60.3" cy="45.6" r="1.4" fill="#fff"/>';
    const mouth = mood === 'sad' ? '<path d="M44 62q6-5 12 0" stroke="#0b0624" stroke-width="2.6" fill="none" stroke-linecap="round"/>' : mood === 'search' ? '<circle cx="50" cy="61" r="3" fill="#0b0624"/>' : '';
    return `<div class="empty-box"><svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="emg" cx=".35" cy=".3"><stop offset="0" stop-color="#bff8ff"/><stop offset=".55" stop-color="#22e6ff"/><stop offset="1" stop-color="#0a6e8a"/></radialGradient></defs>` +
      `<path d="M50 10 C66 32 78 44 78 60 a28 28 0 0 1 -56 0 C22 44 34 32 50 10 Z" fill="url(#emg)"/><ellipse cx="40" cy="36" rx="6" ry="9" fill="#fff" opacity=".45" transform="rotate(25 40 36)"/>${eyes}${mouth}` +
      (mood === 'sleep' ? '<text x="74" y="26" font-size="13" fill="#bff8ff" font-family="sans-serif" font-weight="700">z</text><text x="82" y="16" font-size="9" fill="#bff8ff" font-family="sans-serif" font-weight="700">z</text>' : '') +
      (mood === 'search' ? '<circle cx="76" cy="74" r="9" fill="none" stroke="#ffd23f" stroke-width="3"/><path d="M82.5 80.5l7 7" stroke="#ffd23f" stroke-width="3.5" stroke-linecap="round"/>' : '') +
      `</svg><p class="empty-note">${text}</p></div>`;
  }
  // «new» in the shop: items your level has just opened that you have not looked at yet
  function shopNewCount() {
    try {
      const lv = playerLevel(); if (save.shopSeenLvl === undefined) { save.shopSeenLvl = lv; return 0; }
      const fresh = x => x.price > 0 && (x.lvl || 1) <= lv && (x.lvl || 1) > save.shopSeenLvl;
      return SKINS.filter(k => buyable(k) && fresh(k) && !save.skins.includes(k.id)).length + FX.filter(f => buyable(f) && fresh(f) && !save.fxOwned.includes(f.id)).length + ARENAS.filter(a => fresh(a) && !save.arenas.includes(a.id)).length;
    } catch (e) { return 0; }
  }
  // your blob in the menu: the chosen skin, hat and aura, slowly turning; tap → wardrobe
  const MB = { r: null, scene: null, cam: null, vis: null, key: '', w: 0, on: true };
  function mbBuild() {
    if (!MB.r) {
      MB.r = new THREE.WebGLRenderer({ canvas: $('mbCanvas'), antialias: true, alpha: true }); MB.r.setClearColor(0x000000, 0);
      MB.scene = new THREE.Scene(); MB.scene.add(new THREE.HemisphereLight(0xc8c0ff, 0x10082a, 1.1));
      const d = new THREE.DirectionalLight(0xffffff, .8); d.position.set(2, 3, 4); MB.scene.add(d);
      MB.cam = new THREE.PerspectiveCamera(35, 1, .1, 80); MB.cam.position.set(0, 2.3, 6.6); MB.cam.lookAt(0, .45, 0);
    }
    if (MB.vis) MB.scene.remove(MB.vis.mesh);
    const k = skin(); MB.vis = previewBlob(k, starsOf(k), save.hat); MB.vis.look = k;
    const au = save.fx && save.fx.aura; if (au && !evoOn()) setAura(MB.vis, au, k.color);
    MB.scene.add(MB.vis.mesh); $('mbName').textContent = k.name;
  }
  function mbRefresh() { try { const k = JSON.stringify([save.skin, save.hat, save.fx && save.fx.aura, starsOf(skin()), EVO[save.skin] ? evoForm(save.skin) : 0]); if (k !== MB.key) { MB.key = k; mbBuild(); } } catch (e) { try { MB.key = ''; } catch (e2) {} } }   // too early at start-up: try again on the next render
  (function mbLoop(now) {
    requestAnimationFrame(mbLoop);
    const el = $('menuBlob'); if (!MB.on || !MB.vis || running || $('overlay').hidden || $('menuCard').hidden || document.hidden || !el.offsetParent) return;
    const c = $('mbCanvas'), w = Math.round(c.clientWidth * Math.min(2, devicePixelRatio || 1)); if (!w) return;
    if (w !== MB.w) { MB.w = w; MB.r.setPixelRatio(1); MB.r.setSize(w, w, false); }
    const v = MB.vis, m = v.mesh.material, lk = v.look;
    v.mesh.rotation.y = .4 + Math.sin(now / 1900) * .7; v.mesh.position.y = Math.sin(now / 700) * .08;
    animateHead(v, now); if (v.aura) animateAura(v, now);
    if (lk.pulse) { const q = .5 + .5 * Math.sin(now / 280); m.emissiveIntensity = .25 + .8 * q; v.glow.material.opacity = .5 + .5 * q; }
    if (lk.holo) { const h = ((lk.holoBase ?? .5) + (lk.holoSpan ?? .17) * (1 + Math.sin(now / 900))) % 1; m.color.setHSL(h, 1, .62); m.emissive.setHSL(h, 1, .5); v.glow.material.color.setHSL(h, 1, .6); }
    if (lk.rainbow) { const h = (now / 4000) % 1; m.color.setHSL(h, 1, .6); m.emissive.setHSL(h, 1, .5); v.glow.material.color.setHSL(h, 1, .6); }
    animateLook(v, now, null);
    alphaSafe(MB.scene); MB.r.render(MB.scene, MB.cam);
  })(performance.now());
  $('menuBlob').addEventListener('click', () => openView('wardrobe', 'wskin'));
  function checkSpecialBadges() {
    save.badges = save.badges || {};
    for (const b of SPECIAL) { if (save.badges[b.id]) continue; const [v, n] = b.prog(); if (v >= n) { save.badges[b.id] = today; toast(`Новый особый значок «${b.name}»! Он в профиле.`); persist(); } }
  }
  function renderAll() {
    checkSpecialBadges(); renderChaosBtn(); mbRefresh(); try { $('wardBtn').classList.toggle('evo-new', Object.keys(save.evoNew || {}).length > 0); setTimeout(evoShowQueue, 400); } catch (e) {} try { prestigeCheck(); } catch (e) {} requestAnimationFrame(goalFade);
    // menu chip = a mini profile: your avatar with its frame and the emblem of your league
    { const av = $('acctChip').querySelector('.ac-ava'), sc = myShowcase(), li = leagueOf(save.season.pts), k = JSON.stringify([sc.skin, sc.frame, li]);
      if (av.dataset.k !== k) { av.dataset.k = k; av.innerHTML = pcAvatar({ ...sc, badge: '' }, 36); av.classList.add('has-av'); $('acctRank').innerHTML = rankEmblem(li, 18, { still: true }); } }
    const li = levelInfo(save.xp);
    const pst = li.max ? prestigeOf(save.xp) : null;
    $('lvlName').innerHTML = `Уровень ${li.level}${li.max ? '' : ` из ${MAX_LEVEL}`}` + (pst && (pst.s || pst.n) ? `<span class="ps-badge${pst.tier === 2 ? ' nova' : ''}">${pst.label}</span>` : '');
    $('lvlXp').textContent = !li.max ? `${li.into} / ${li.need} опыта` : !pst ? 'максимальный уровень' : pst.top ? 'вершина престижа' : `${pst.into.toLocaleString('ru-RU')} / ${pst.need.toLocaleString('ru-RU')} до ${pst.next}`;
    $('lvlFill').style.width = (pst ? (pst.top ? 100 : pst.into / pst.need * 100) : li.into / li.need * 100) + '%';
    $('lvlFill').classList.toggle('ps', !!pst && pst.tier === 1); $('lvlFill').classList.toggle('nova', !!pst && pst.tier === 2);
    { // «Цели»: two compact tabs — today's 3 round goals and this week's 3 tasks
      const TIER = { easy: 'Лёгкое', mid: 'Среднее', hard: 'Сложное' };
      const W = weeklyState(), days = Math.max(1, Math.ceil(((W.week + 1) * 7 - 3) - Date.now() / 864e5)), tab = save.settings.goalTab === 'week' ? 'week' : 'day';
      $('gtDay').textContent = `${save.quests.length}`; $('gtWeek').textContent = `${W.done.length}/3`;
      $('gtabDay').setAttribute('aria-selected', tab === 'day'); $('gtabWeek').setAttribute('aria-selected', tab === 'week');
      $('menuQuests').innerHTML = tab === 'day'
        ? (sw => save.quests.map(id => QUESTS.find(q => q.id === id)).map(q => `<li><span class="g-txt">${q.text}</span>` +
            (sw ? `<button type="button" class="g-swap" data-qswap="${q.id}" title="Заменить эту цель (раз в день)" aria-label="Заменить цель «${q.text}»">↻</button>` : '') +
            `<span class="g-rw"><b>+${qCoins(q)} ◆</b><small>+${qXp(q)} оп.</small></span></li>`).join('') +
          `<li class="g-note">За один раунд · ${sw ? 'неудобную цель можно заменить ↻ раз в день' : 'замена цели уже использована сегодня'}</li>` +
          `<li class="g-note">${(q => q && q.sh ? 'Сундук осколков за три цели сегодня получен' : `Три цели за день — сундук осколков: ${q ? Math.min(3, q.n) : 0}/3`)(save.qDay && save.qDay.d === today ? save.qDay : null)}</li>`)(save.qSwapDay !== today)
        : weeklyTasks(W.week).map(t => { const v = Math.min(t.n, W.prog[t.id] || 0), ok = W.done.includes(t.id), R = RARITY[WEEK_RAR[t.tier]];
            return `<li class="${ok ? 'done' : ''}"><span class="g-txt">${ok ? '✓ ' : ''}${t.text(t.n)}<span class="g-bar"><i style="width:${(v / t.n * 100).toFixed(0)}%;background:${R.color}"></i></span></span>` +
              `<span class="g-rw"><b style="color:${R.color}">${TIER[t.tier]}</b><small>${v.toLocaleString('ru-RU')}/${t.n.toLocaleString('ru-RU')}</small></span></li>`; }).join('') +
          `<li class="g-note">Ещё ${days} дн. · ${W.bonus ? 'награда за неделю получена' : `за все три: сундук «${RARITY[WEEK_CHEST].name}», 2 сундука осколков, +${WEEK_BONUS} ◆ и 🎟`}</li>`;
    }
    ['menuCoins', 'resCoins', 'shopCoins'].forEach(id => $(id).textContent = `${save.coins} ◆`);
    $('coins').textContent = save.coins;
    $('best').textContent = fmtBest(save.mode, save.bests[save.mode] || 0);
    { const id = save.mode, a = modeArt(id), ms = modeMastery(id), mb = $('modeBtn');
      mb.classList.add('mt'); mb.style.setProperty('--mc', a.c); mb.style.setProperty('--mc2', a.c2);
      mb.classList.toggle('duo', isDuoMode(id)); mb.innerHTML = `<span class="art">${modeIcon(id)}</span><span class="hd"><span class="k">${isDuoMode(id) ? '👥 Вдвоём · локально' : id === ModeX.dayMode() ? '🔥 Режим дня · ×1,25' : 'Режим'}</span><b class="n">${MODES[id].name}</b></span><span class="more">все ▸</span>` +
        (isDuoMode(id) ? `<span class="ln">${duoLine(id)}</span>` : `<span class="ln"><span>Рекорд <b>${fmtBest(id, save.bests[id] || 0)}</b></span><span>Мастерство <b style="color:#ffd23f">${ms.name ? `«${ms.name}»` : '—'}</b></span></span>`) + `<span class="tg">${a.tags.map(t => `<i>${t}</i>`).join('')}</span>`; }
    { const plv = playerLevel(), tab = modesTab();
      const ids = MODE_IDS.filter(id => !!MODES[id].duo === (tab === 'duo'));
      $('mtSolo').textContent = MODE_IDS.filter(id => !MODES[id].duo).length; $('mtDuo').textContent = MODE_IDS.filter(id => MODES[id].duo).length;
      document.querySelectorAll('#modesTabs [data-mtab]').forEach(b => b.setAttribute('aria-selected', b.dataset.mtab === tab));
      $('modesDuoNote').hidden = tab !== 'duo';
      // 2.7: compact tiles — one line of what the mode is; the full text, the league season and the mastery points are under ⓘ
      $('modes').innerHTML = ids.map(id => [id, MODES[id]]).map(([id, m]) => {
        const a = modeArt(id), ms = modeMastery(id), on = save.mode === id;
        const lock = id === 'royale' && !TEST_MODE ? `<span>🔒</span>Только в лиге<small>сезон ${nextSeasonOf('royale')}</small>` : m.lvl && plv < m.lvl ? `<span>🔒</span>С ${m.lvl} уровня<small>сейчас ${plv}</small>` : '';
        const chips = (id === leagueMode() ? '<span class="mchip lg">🏆 режим лиги</span>' : '') + (id === ModeX.dayMode() ? '<span class="mchip day">🔥 режим дня · ◆×1,25</span>' : '') + (a.isNew && !lock ? '<span class="mchip fresh">новый</span>' : '');
        const raid = id === 'raid' ? (() => { const rs = raidState(), b = raidBoss(rs.week); return `<span class="m-raid">${b.name} · ступени ${rs.cleared.length}/5${rs.cleared.length >= 5 ? ' — всё пройдено, новый босс в понедельник' : ''}</span>`; })() : '';
        const soon = m.duo && DUO_SOON;
        return `<button class="mode mcard m27${m.duo ? ' duo' : ''}${soon ? ' soon' : ''}" id="mode-${id}" data-mode="${id}"${soon ? ' data-soon="1"' : ''} role="radio" aria-checked="${on}" style="--mc:${a.c};--mc2:${a.c2}" ${lock ? 'disabled' : ''}>` +
          `<span class="art">${modeIcon(id)}<span class="minf" data-minfo="${id}" role="button" tabindex="0" aria-label="Подробнее о режиме «${m.name}»">i</span>${on ? '<span class="sel" aria-hidden="true">✓</span>' : ''}</span>` +
          `<span class="tx">${chips || soon ? `<span class="mchips">${soon ? '<span class="mchip soon">⏳ скоро</span>' : ''}${chips}</span>` : ''}<b>${m.name}</b><small>${MODE_SHORT[id] || m.desc}</small><span class="tg">${a.tags.map(t => `<i>${t}</i>`).join('')}</span>${raid}</span>` +
          (m.duo ? `<span class="ft">${duoLine(id, 'rec')}</span>` : `<span class="ft"><span class="rec">Рекорд <b>${fmtBest(id, save.bests[id] || 0)}</b></span><span class="ms">Мастерство${ms.name ? ` · ${ms.name}` : ''}<i><s style="width:${(ms.pct * 100).toFixed(0)}%"></s></i></span></span>`) +
          (lock ? `<span class="lk">${lock}</span>` : '') + `</button>`; }).join(''); }
    $('abilCount').textContent = `${save.abil.owned.length}/${ABILITIES.length}`;
    $('achCount').textContent = `${save.ach.length + save.chDone.length}/${ACH.length + CHALLENGES.length}`;
    { const lg = lgView(leagueOf(save.season.pts), seasonStarted ? holidayOf(save.season.id) : null), ct = CHAOS_TIERS[chaosOf(save.chaos.pts)];
      $('hubLeagueSub').innerHTML = ''; void ct;   // 2.2: the tile shows the two season clocks instead of the rank line
      seasonTimerTick();
      const ready = COLLECTIONS.filter(c => !save.colDone.includes(c.id) && colOwned(c) === colItems(c).length).length;
      $('hubColSub').textContent = ready ? `можно забрать: ${ready}` : `коллекций ${save.colDone.length}/${COLLECTIONS.length}`;
      const ch = chestTotal() + (save.dailyChestDay !== today ? 1 : 0);
      $('hubRewSub').textContent = ch ? `сундуков: ${ch}` : `достижений ${save.ach.length}/${ACH.length}`;
      { const sh = RAR_KEYS.reduce((a, k) => a + (save.shards[k] || 0), 0), can = Object.keys(CR_PRICE).filter(id => canPay(id) && !wsOwned(id)).length;
        const goal = save.wsPin && CR_PRICE[save.wsPin] && !wsOwned(save.wsPin) ? save.wsPin : null;
        $('wsSub').textContent = can ? `можно создать: ${can}` : goal ? `цель: ${Math.round(wsProg(goal) * 100)}%` : `осколков: ${sh}`; $('wsX').textContent = can ? '●' : ''; }
      // live tiles: league emblem + progress to the next league, collection progress, chests waiting, new in the shop
      const li = leagueOf(save.season.pts), nx = LEAGUES[li + 1];
      if ($('hubLeagueX').dataset.li !== String(li)) { $('hubLeagueX').dataset.li = li; $('hubLeagueX').innerHTML = rankEmblem(li, 34); }
      $('hubLeagueBar').style.width = (nx ? Math.max(3, (save.season.pts - LEAGUES[li].pts) / (nx.pts - LEAGUES[li].pts) * 100) : 100).toFixed(0) + '%';
      $('hubColBar').style.width = Math.max(3, save.colDone.length / COLLECTIONS.length * 100).toFixed(0) + '%';
      $('hubColBtn').classList.toggle('pulse', ready > 0); $('hubColX').innerHTML = ready ? `<b class="hb-cnt">${ready}</b>` : '';
      $('hubRewBtn').classList.toggle('pulse', ch > 0); $('hubRewX').innerHTML = ch ? `<b class="hb-cnt">${ch}</b>` : '';
      const nw = shopNewCount(); $('hubShopX').innerHTML = nw ? `<b class="hb-new">новое · ${nw}</b>` : ''; }
    $('chestCountBtn').textContent = chestTotal() + (save.dailyChestDay !== today ? ' +1' : '');
    $('petCount').textContent = `${save.pets.length}/${PETS.length}`;
    try { hubCardsInfo(); } catch (e) {}
    { const ready = COLLECTIONS.filter(c => !save.colDone.includes(c.id) && colOwned(c) === colItems(c).length).length;
      $('colCount').textContent = `${save.colDone.length}/${COLLECTIONS.length}` + (ready ? ` · забрать ${ready}` : ''); }
    { const L = lgView(leagueOf(save.season.pts), seasonStarted ? holidayOf(save.season.id) : null);
      $('leagueBtn').innerHTML = `<span class="lg-logo">${leagueLogoSVG(56)}</span><span class="lg-tx"><b class="lg-ttl">Лига</b>` +
        `<small class="lg-me"><b class="rk-name" style="color:${L.color}">${rankEmblem(leagueOf(save.season.pts), 22)}${L.name}</b> · ${save.season.pts} очков${curHoliday ? ` · ${HOLIDAYS[curHoliday].name}` : ''}</small>` +
        `<small class="lg-when">${seasonStarted ? `сезон ${save.season.id} · до ${fmtDate(seasonEnd(save.season.id))}` : `первый сезон — с ${fmtDate(SEASON_EPOCH)}`} · 14 дней</small></span>`; }
  }
  const OLD_PAT = ['stripes', 'dots', 'stars', 'gradient', 'grid', 'zigzag', 'rings'];
  const MAT_CSS = { skeleton: 'radial-gradient(circle at 36% 42%, transparent 0 18%, #ffd27a 19% 25%, transparent 26%), radial-gradient(circle at 66% 64%, transparent 0 10%, #ffd27a 11% 16%, transparent 17%), radial-gradient(circle at 64% 30%, #ffd27a 0 6%, transparent 7%), ', sandglass: 'radial-gradient(ellipse at 50% 12%, #ffd27a 0 28%, transparent 30%), radial-gradient(circle, #ffd27a 0 1.5px, transparent 2px) 0 0/8px 8px, ', chrome: 'linear-gradient(160deg, rgba(255,255,255,.75), transparent 38%, rgba(255,255,255,.35) 58%, transparent 70%), ',
    glass: 'radial-gradient(circle at 32% 28%, rgba(255,255,255,.8) 0 8%, transparent 22%), ', jelly: 'radial-gradient(circle at 32% 28%, rgba(255,255,255,.7) 0 9%, transparent 25%), ',
    crystal: 'conic-gradient(from 30deg, rgba(255,255,255,.45), transparent 15%, rgba(255,255,255,.25) 30%, transparent 45%, rgba(255,255,255,.4) 60%, transparent 75%, rgba(255,255,255,.2) 90%), ',
    rim: '', magma: '', matte: '' };
  function swatch(s) {
    if (EVO_SW[s.id]) return EVO_SW[s.id];
    if ((s.pattern && !OLD_PAT.includes(s.pattern)) || s.mat) {
      const base = s.pattern ? `url(${swatchUrl(s)}) center/cover` : s.color;
      const rim = s.mat === 'rim' ? `box-shadow:inset 0 0 8px 3px ${s.accent || s.color}, 0 0 14px ${s.accent || s.color};` : s.glow ? `box-shadow:0 0 14px ${s.color};` : '';
      return `background:${MAT_CSS[s.mat] || ''}${base};${rim}${s.mat === 'glass' || s.mat === 'jelly' ? 'opacity:.92;' : ''}`;
    }
    let bg = s.color;
    if (s.pattern === 'stripes') bg = `repeating-linear-gradient(90deg, ${s.color} 0 8px, ${s.accent} 8px 12px)`;
    if (s.pattern === 'dots') bg = `radial-gradient(circle, ${s.accent} 0 2.5px, transparent 3px) 0 0/11px 11px, ${s.color}`;
    if (s.pattern === 'stars') bg = `radial-gradient(circle, ${s.accent} 0 1px, transparent 1.5px) 0 0/9px 11px, ${s.color}`;
    if (s.pattern === 'gradient') bg = `linear-gradient(180deg, ${s.color}, ${s.accent})`;
    if (s.pattern === 'grid') bg = `linear-gradient(${s.accent} 1px, transparent 1px) 0 0/8px 8px, linear-gradient(90deg, ${s.accent} 1px, transparent 1px) 0 0/8px 8px, ${s.color}`;
    if (s.pattern === 'zigzag') bg = `repeating-linear-gradient(45deg, ${s.color} 0 5px, ${s.accent} 5px 8px)`;
    if (s.pattern === 'rings') bg = `repeating-linear-gradient(180deg, ${s.color} 0 6px, ${s.accent} 6px 9px)`;
    if (s.pulse) bg = `radial-gradient(circle, #ffffff 0 10%, ${s.color} 45%, #1a0840 100%)`;
    const over = s.pattern === 'stars' || s.pattern === 'dots' ? `radial-gradient(circle, #ffffff 0 1.5px, transparent 2px) 0 0/10px 10px, ` : s.pattern ? `repeating-linear-gradient(90deg, rgba(255,255,255,.35) 0 3px, transparent 3px 10px), ` : '';
    if (s.holo) bg = s.holoBase ? `radial-gradient(circle, #ffffff 0 1px, transparent 1.5px) 0 0/9px 11px, linear-gradient(135deg, #ffd23f, #ff4fd8, #ffd23f)` : 'linear-gradient(135deg, #22e6ff, #ff4fd8, #22e6ff)';
    if (s.holo && s.holoBase) { const h1 = Math.round(s.holoBase * 360), h2 = Math.round((s.holoBase + 2 * (s.holoSpan ?? .17)) * 360);   // the swatch shows the skin's own colour range
      bg = over + `linear-gradient(135deg, hsl(${h1} 100% 62%), hsl(${h2} 100% 62%), hsl(${h1} 100% 62%))`; }
    if (s.rainbow) bg = (s.pattern ? over : '') + 'conic-gradient(#ff4fd8, #ffd23f, #3dffa2, #22e6ff, #7b3dff, #ff4fd8)';
    return `background:${bg};${s.glow ? `box-shadow:0 0 14px ${s.color};` : ''}`;
  }
  // the shop sells what you don't own yet; the wardrobe holds everything you own
  const SHOP_VIEWS = {
    shop:     { title: 'Магазин', groups: [['Для боя', ['up', 'abil']], ['Внешний вид', ['wshow', 'skin', 'fx', 'arena']], ['Архив', ['archive']]], tabs: [['up', 'Улучшения'], ['abil', 'Способности'], ['wshow', 'Витрина недели'], ['skin', 'Скины'], ['fx', 'Эффекты'], ['arena', 'Арены'], ['archive', 'Архив']] },
    wardrobe: { title: 'Гардероб', tabs: [['wskin', 'Скины'], ['wfx', 'Эффекты'], ['wdeco', 'Украшения'], ['warena', 'Арены']] },
    collections: { title: 'Коллекции', tabs: [['wcol', 'Коллекции']] },
    abilities: { title: 'Способности', tabs: [['mab', 'Мои способности']] },
    pets:     { title: 'Питомцы', tabs: [['wpet', 'Мои питомцы'], ['pcat', 'Где получить']] },
    goals:    { title: 'Достижения', tabs: [['ach', 'Достижения'], ['ch', 'Испытания'], ['skill', 'Мастерские'], ['legend', 'Легендарные']] },
  };
  let shopView = 'shop';
  const FX_ICON = { trail: '〰', aura: '◎', eat: '✦' };
  // ---- previews: 3D thumbnails for pets and auras, drawn previews for trails and eat effects ----
  let thumbR = null, thumbScene, thumbCam;
  const thumbCache = {};
  function thumbInit() {
    thumbR = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    thumbR.setPixelRatio(1); thumbR.setSize(112, 112, false); thumbR.setClearColor('#160c36', 1);
    thumbScene = new THREE.Scene();
    thumbScene.add(new THREE.HemisphereLight(0xc8c0ff, 0x10082a, 1.1));
    const d = new THREE.DirectionalLight(0xffffff, .8); d.position.set(2, 3, 4); thumbScene.add(d);
    thumbCam = new THREE.PerspectiveCamera(35, 1, .1, 60);
  }
  function render3D(key, obj, dist, y) {
    if (!thumbR) thumbInit();
    thumbScene.add(obj);
    thumbCam.position.set(0, y + dist * .3, dist); thumbCam.lookAt(0, y, 0);
    thumbR.render(thumbScene, thumbCam);
    thumbScene.remove(obj);
    return (thumbCache[key] = thumbR.domElement.toDataURL());
  }
  function petThumb(pt) {
    const key = 'pet_' + pt.id; if (thumbCache[key]) return thumbCache[key];
    const g = buildPet(pt); scene.remove(g); g.visible = true; g.rotation.y = .45;
    return render3D(key, g, 3.3, .05);
  }
  function auraThumb(f) {
    const key = 'aura_' + f.id + '_' + save.skin; if (thumbCache[key]) return thumbCache[key];
    const holder = new THREE.Group(), sc = new THREE.Color(skin().color);
    const sph = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), new THREE.MeshStandardMaterial({ color: sc, emissive: sc, emissiveIntensity: .4, roughness: .3 }));
    holder.add(sph); const aura = buildAura(f.id); sph.add(aura);
    animateAura({ aura, mesh: sph }, 1700);
    return render3D(key, holder, 6.2, .35);
  }
  const RAINBOW = ['#ff4fd8', '#ffd23f', '#3dffa2', '#22e6ff', '#7b3dff'];
  const FX_COLS = { sparksTrail: null, bubbleTrail: ['#7fe8ff', '#ffffff'], starTrail: ['#ffd23f', '#fff6a0'], fireTrail: ['#ff3d00', '#ff9a3d', '#ffd23f'],
    rainbowTrail: RAINBOW, voidTrail: ['#7b3dff', '#3a0a8e'], snowTrail: ['#ffffff', '#bfefff'], sparkTrail: ['#ffffff', '#22e6ff'], heartTrail: ['#ff4f9a', '#ff9ec4'],
    leafTrail: ['#3dffa2', '#ffd23f', '#9be15d'], inkTrail: ['#7b3dff', '#ff4fd8'], goldTrail: ['#ffd23f', '#fff6a0'], plasmaTrail: ['#22e6ff', '#ff4fd8'], auroraTrail: ['#3dffa2', '#22e6ff', '#7b3dff'],
    heartEat: ['#ff4f9a', '#ff9ec4'], shockEat: null, boltEat: ['#ffd23f', '#ffffff'], starfall: ['#ffd23f', '#fff6a0'], supernova: ['#ff4fd8', '#22e6ff', '#ffffff'],
    prismEat: RAINBOW, goldEat: ['#ffd23f', '#fff6a0', '#ffffff'], confettiEat: RAINBOW, vortexEat: ['#7b3dff', '#ff4fd8'], popEat: RAINBOW, iceEat: ['#ffffff', '#9fe8ff'], miniholeEat: ['#7b3dff', '#ff4fd8'], rainbowEat: RAINBOW };
  const FX_ICONS2D = { heartTrail: 'heart', heartEat: 'heart', boltEat: 'bolt', starfall: 'star', goldEat: 'star' };
  const FX_RINGS = { shockEat: 1, supernova: 2, iceEat: 1, vortexEat: 2, miniholeEat: 2, rainbowEat: 2, prismEat: 3, goldEat: 1 };
  function draw2DIcon(x, kind, cx, cy, s, col) {
    x.save(); x.translate(cx, cy); x.scale(s / 32, s / 32); x.translate(-32, -32); x.fillStyle = col; x.beginPath();
    if (kind === 'heart') { x.moveTo(32, 54); x.bezierCurveTo(2, 32, 10, 4, 32, 20); x.bezierCurveTo(54, 4, 62, 32, 32, 54); }
    if (kind === 'star') for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 11 : 26; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); }
    if (kind === 'bolt') [[36, 4], [14, 36], [30, 36], [24, 60], [50, 26], [34, 26], [42, 4]].forEach(([a, b]) => x.lineTo(a, b));
    x.fill(); x.restore();
  }
  function fxThumb2D(f) {
    const key = 'fx_' + f.id + '_' + save.skin; if (thumbCache[key]) return thumbCache[key];
    const cv = document.createElement('canvas'); cv.width = cv.height = 112;
    const x = cv.getContext('2d'), sc = skin().color;
    const cols = (FX_COLS[f.id] !== undefined ? FX_COLS[f.id] : f.colors) || [sc];
    x.fillStyle = '#160c36'; x.fillRect(0, 0, 112, 112);
    x.shadowBlur = 8;
    const icon = FX_ICONS2D[f.id];
    if (f.slot === 'trail') {
      const st = f.style || 'sparks';
      if (st === 'ribbon') {
        cols.forEach((c, k) => { x.strokeStyle = c; x.shadowColor = c; x.lineWidth = 5 - k * 1.5; x.globalAlpha = .9; x.beginPath();
          for (let i = 0; i <= 30; i++) { const t = i / 30, px = 8 + t * 66, py = 58 + k * 4 + Math.sin(t * 7) * 9 * (1 - t); i ? x.lineTo(px, py) : x.moveTo(px, py); } x.stroke(); });
      } else for (let i = 0; i < 22; i++) {
        const t = i / 21, amp = st === 'spiral' ? 16 : 8, px = 10 + t * 64, py = 60 + Math.sin(i * (st === 'spiral' ? 1.3 : .8)) * amp * (1 - t * .6);
        const c = cols[i % cols.length]; x.globalAlpha = .25 + .75 * t; x.fillStyle = c; x.strokeStyle = c; x.shadowColor = c;
        if ((icon && i % 4 === 1) || (st === 'stars' && i % 3 === 0)) draw2DIcon(x, icon || 'star', px, py, 7 + t * 5, c);
        else if (st === 'bubbles') { x.lineWidth = 1.6; x.beginPath(); x.arc(px, py - t * 8, 2.5 + t * 4, 0, Math.PI * 2); x.stroke(); }
        else if (st === 'rings' && i % 5 === 0) { x.lineWidth = 2; x.beginPath(); x.ellipse(px, py, 4 + t * 8, 2 + t * 4, 0, 0, Math.PI * 2); x.stroke(); }
        else if (st === 'smoke') { x.globalAlpha = .12 + .3 * t; x.beginPath(); x.arc(px, py, 4 + t * 7, 0, Math.PI * 2); x.fill(); }
        else { x.beginPath(); x.arc(px, py, 1.5 + t * 3.5, 0, Math.PI * 2); x.fill(); }
      }
      x.globalAlpha = 1;
      const gr = x.createRadialGradient(80, 52, 3, 86, 58, 20); gr.addColorStop(0, '#ffffff'); gr.addColorStop(.25, sc); gr.addColorStop(1, sc);
      x.fillStyle = gr; x.shadowColor = sc; x.shadowBlur = 14; x.beginPath(); x.arc(86, 58, 18, 0, Math.PI * 2); x.fill();
      x.shadowBlur = 0; x.fillStyle = '#fff'; [[92, 53], [99, 56]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 3.2, 0, Math.PI * 2); x.fill(); });
      x.fillStyle = '#14102a'; [[93, 54], [100, 57]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 1.6, 0, Math.PI * 2); x.fill(); });
    } else {
      const rings = FX_RINGS[f.id] || 0;
      for (let k = 0; k < rings; k++) { x.strokeStyle = cols[k % cols.length]; x.shadowColor = x.strokeStyle; x.lineWidth = 3 - k; x.beginPath(); x.arc(56, 56, 40 - k * 13, 0, Math.PI * 2); x.stroke(); }
      let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 34; i++) {
        const a = rnd() * Math.PI * 2, r = 8 + rnd() * 38, c = cols[i % cols.length];
        x.fillStyle = c; x.shadowColor = c; x.globalAlpha = .5 + rnd() * .5;
        if (icon && i % 3 === 0) draw2DIcon(x, icon, 56 + Math.cos(a) * r, 56 + Math.sin(a) * r, 9 + rnd() * 6, c);
        else { x.beginPath(); x.arc(56 + Math.cos(a) * r, 56 + Math.sin(a) * r, 1.5 + rnd() * 2.5, 0, Math.PI * 2); x.fill(); }
      }
      x.globalAlpha = 1; x.fillStyle = '#ffffff'; x.shadowColor = cols[0]; x.shadowBlur = 18; x.beginPath(); x.arc(56, 56, 6, 0, Math.PI * 2); x.fill();
    }
    return (thumbCache[key] = cv.toDataURL());
  }
  // ---- 3D previews of trails and eat effects (item window and list thumbnails), drawn by the same effect code as in battle ----
  let fxTarget = null;   // when set, emit / emitIcons / wave / trailIcon draw into a preview scene instead of the arena
  function makePreviewFx(sc, pSize = .4) {
    const N = 600, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), data = Array.from({ length: N }, () => ({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, r: 0, g: 0, b: 0 }));
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: pSize, map: dotTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); pts.frustumCulled = false; sc.add(pts);
    const icons = Array.from({ length: 40 }, () => { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sp.visible = false; sc.add(sp); return { sp, life: 0, max: 1, vx: 0, vy: 0, vz: 0, size: 1 }; });
    const wv = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(.86, 1, 64), new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.rotation.x = -Math.PI / 2; m.visible = false; sc.add(m); return { m, life: 0, max: 1, r0: 1, r1: 3 }; });
    let pn = 0, inx = 0, wn = 0;
    const T = { scale: 1, yOff: -1, eatY: 1.4,
      emit(x, y, z, color, n, speed, life) { tmpCol.set(color); for (let i = 0; i < n; i++) { const d = data[pn], k = pn * 3; pn = (pn + 1) % N; const a = Math.random() * 6.283, sp = speed * (.35 + Math.random() * .8) * T.scale;
        d.vx = Math.cos(a) * sp; d.vz = Math.sin(a) * sp; d.vy = (Math.random() * .8 + .2) * sp * .5; pos[k] = x; pos[k + 1] = y + T.yOff; pos[k + 2] = z; d.r = tmpCol.r; d.g = tmpCol.g; d.b = tmpCol.b; d.life = d.max = life * (.6 + Math.random() * .6); } },
      icons(x, y, z, icon, color, n, size, gentle) { for (let i = 0; i < n; i++) { const d = icons[inx]; inx = (inx + 1) % icons.length; const a = Math.random() * 6.283, sp = (gentle ? .6 : 4 + Math.random() * 6) * T.scale;
        d.sp.material.map = ICONS[icon]; d.sp.material.color.set(color); d.sp.material.needsUpdate = true; d.sp.position.set(x, y + T.yOff, z); d.vx = Math.cos(a) * sp; d.vz = Math.sin(a) * sp;
        d.vy = (gentle ? 1.2 : 6 + Math.random() * 6) * T.scale; d.size = size * Math.max(.35, T.scale) * (.7 + Math.random() * .6); d.life = d.max = .9 + Math.random() * .4; d.sp.visible = true; } },
      wave(x, z, color, r0, r1, life) { const w = wv[wn]; wn = (wn + 1) % wv.length; w.m.position.set(x, T.yOff + .02, z); w.m.material.color.set(color); w.r0 = r0 * T.scale; w.r1 = r1 * T.scale; w.life = w.max = life; w.m.visible = true; },
      update(dt) {
        const drag = Math.exp(-3 * dt);
        for (let i = 0; i < N; i++) { const d = data[i], k = i * 3; if (d.life <= 0) { col[k] = col[k + 1] = col[k + 2] = 0; continue; }
          d.life -= dt; pos[k] += d.vx * dt; pos[k + 1] += d.vy * dt; pos[k + 2] += d.vz * dt; d.vx *= drag; d.vy = d.vy * drag - 6 * T.scale * dt; d.vz *= drag;
          if (pos[k + 1] < T.yOff + .05) { pos[k + 1] = T.yOff + .05; d.vy = 0; } const f = Math.max(0, d.life / d.max); col[k] = d.r * f; col[k + 1] = d.g * f; col[k + 2] = d.b * f; }
        geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
        for (const d of icons) { if (!d.sp.visible) continue; d.life -= dt; if (d.life <= 0) { d.sp.visible = false; continue; }
          d.sp.position.x += d.vx * dt; d.sp.position.y += d.vy * dt; d.sp.position.z += d.vz * dt; d.vy -= 9 * T.scale * dt; const f = d.life / d.max; d.sp.material.opacity = Math.min(1, f * 1.6); d.sp.scale.setScalar(d.size * (.6 + .4 * f)); }
        for (const w of wv) { if (!w.m.visible) continue; w.life -= dt; if (w.life <= 0) { w.m.visible = false; continue; } const f = w.life / w.max; w.m.scale.setScalar(w.r0 + (w.r1 - w.r0) * (1 - f)); w.m.material.opacity = f; } },
      clear() { data.forEach(d => d.life = 0); col.fill(0); geo.attributes.color.needsUpdate = true; icons.forEach(d => { d.sp.visible = false; d.life = 0; }); wv.forEach(w => { w.m.visible = false; w.life = 0; }); },
      dispose() { sc.remove(pts); icons.forEach(d => sc.remove(d.sp)); wv.forEach(w => sc.remove(w.m)); } };
    return T;
  }
  // a fake one-cell owner so the trail code can run in a preview
  const pvOwner = (id, vis) => ({ isPlayer: true, trailDef: fxById(id), cells: [{ x: 0, z: 0, hx: 1, hz: 0, mass: 7, vis }] });
  function pvTrailStep(T, id, o, x, z, hx, hz, now) { const c = o.cells[0]; c.x = x; c.z = z; c.hx = hx; c.hz = hz; T.scale = 1; fxTarget = T; try { trailOwner(o, id, now); } finally { fxTarget = null; } }
  function pvEat(T, id, x, z, color) { T.scale = .3; fxTarget = T; try { eatFx(x, z, .8, color, id); } finally { fxTarget = null; } }
  let thumbFx = null;
  function fxThumb3D(f) {
    const key = 'fx3_' + f.id + '_' + save.skin; if (thumbCache[key]) return thumbCache[key];
    if (!thumbR) thumbInit();
    if (!thumbFx) thumbFx = makePreviewFx(thumbScene, .75);
    thumbFx.clear();
    const holder = new THREE.Group(), sc = new THREE.Color(skin().color);
    const sph = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), new THREE.MeshStandardMaterial({ color: sc, emissive: sc, emissiveIntensity: .4, roughness: .3 })); holder.add(sph);
    const vis = { glow: { material: { color: sc } } };
    if (f.slot === 'trail') { const o = pvOwner(f.id, vis); let now = 1000;
      for (let t = 0; t < 1.3; t += .02) { const x = -3.2 + t * 3.4; pvTrailStep(thumbFx, f.id, o, x, 0, 1, 0, now += 20); thumbFx.update(.02); }
      sph.position.x = .2; }
    else { pvEat(thumbFx, f.id, 0, 1.2, '#' + sc.getHexString()); for (let t = 0; t < .32; t += .02) thumbFx.update(.02); }
    const url = render3D(key, holder, f.slot === 'trail' ? 6.4 : 5.6, .2);
    thumbFx.clear();
    return url;
  }
  const fxThumb = f => f.slot === 'aura' ? auraThumb(f) : fxThumb3D(f);
  // previews are filled in a few per frame so long lists open instantly
  const thumbImg = (kind, id) => `<img class="thumb-img" data-th="${kind}:${id}" alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">`;
  function fillThumbs() {
    const imgs = [...document.querySelectorAll('img[data-th]')];
    let i = 0;
    const step = () => {
      const t0 = performance.now();
      while (i < imgs.length && performance.now() - t0 < 12) {
        const el = imgs[i++], [kind, id] = el.dataset.th.split(':');
        if (!el.isConnected) continue;
        el.src = kind === 'pet' ? petThumb(petById(id)) : fxThumb(FX.find(f => f.id === id));
        el.removeAttribute('data-th');
      }
      if (i < imgs.length) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  const buyable = x => !x.craft && !x.prestige && !x.raid && x.price > 0 && !x.tut && !x.chaos && !x.ex && !x.chest && !x.season && !x.lchest && !x.special && !x.legend && !x.skill;
  function sourceBadge(x) {
    if (save.archived && save.archived.includes(x.id)) return '<span class="badge-ex" style="color:#9fd8ff">из архива</span>';
    if (x.craft) return `<span class="badge-r" style="color:${RARITY[x.craft].color}">Мастерская · ${RARITY[x.craft].name}</span>`;
    if (x.lchest) return `<span class="badge-r" style="color:${RARITY[x.lchest].color}">Сундук лиги · ${RARITY[x.lchest].name}</span>`;
    if (x.chest) return `<span class="badge-r" style="color:${RARITY[x.chest].color}">${RARITY[x.chest].name}</span>`;
    if (x.ex) return '<span class="badge-ex">испытание</span>';
    if (x.legend) return '<span class="badge-ex badge-legend">легенда</span>';
    if (x.skill) return '<span class="badge-ex" style="color:var(--food)">мастерство</span>';
    if (x.raid || x.special === 'raid') return '<span class="badge-ex" style="color:var(--boss)">рейд</span>';
    if (x.special === 'league') return '<span class="badge-ex">лига</span>';
    if (x.holiday) return `<span class="badge-ex">${HOLIDAYS[x.holiday].name}</span>`;
    if (x.season) return '<span class="badge-ex">сезон</span>';
    return '';
  }
  function skinTile(s, mode) {
    const sel = save.skin === s.id, lv = playerLevel();
    let label, cls = 'buy', dis = '';
    if (mode === 'own') { if (sel) { label = 'Выбран'; cls += ' sel'; dis = 'disabled'; } else label = 'Выбрать'; }
    else if (lv < (s.lvl || 1)) { label = `С ур. ${s.lvl}`; dis = 'disabled'; }
    else { label = `${s.price} ◆`; if (save.coins < s.price) dis = 'disabled'; }
    const inf = ` data-info="skin:${s.id}" tabindex="0" role="button" aria-label="Предпросмотр: ${s.name}"`;
    const dna = EVO[s.id] ? `${(save.evoNew || {})[s.id] ? '<span class="evo-newmark">новое</span>' : ''}<span class="evo-dna" title="Скин с эволюцией${save.skins.includes(s.id) && evoForm(s.id) ? ` · форма ${['', 'I', 'II', 'III'][evoForm(s.id)]}` : ''}"><svg viewBox="0 0 24 24" aria-hidden="true">${DI.dna}</svg>${save.skins.includes(s.id) && evoForm(s.id) ? ['', 'I', 'II', 'III'][evoForm(s.id)] : ''}</span>` : '';
    return `<div class="skin ${dis && mode !== 'own' ? 'locked' : ''}"${inf}>${dna}<div class="${swClass(s)}" style="${swatch(s)}">${headIcon(s)}</div>
      ${starsOf(s) ? `<span class="stars-on" title="Звёзды скина: ${STAR_TEXT[starsOf(s)]}; ${starBonusOf(s) ? starBonusOf(s).text(starsOf(s)) : ''}">${'★'.repeat(starsOf(s))}</span>` : ''}<span class="name">${s.name}</span>${starRow(s)}${sourceBadge(s)}<button class="${cls}" id="skin-${s.id}" data-skin="${s.id}" ${dis}>${label}</button></div>`;
  }
  function fxRow(f, mode) {
    const sel = save.fx[f.slot] === f.id, lv = playerLevel();
    let label, cls = 'buy', dis = '';
    if (mode === 'own') { if (sel) { label = 'Снять'; cls += ' sel'; } else label = 'Выбрать'; }
    else if (lv < f.lvl) { label = `С ур. ${f.lvl}`; dis = 'disabled'; }
    else { label = `${f.price} ◆`; if (save.coins < f.price) dis = 'disabled'; }
    const inf = ` data-info="fx:${f.id}" tabindex="0" role="button" aria-label="Предпросмотр: ${f.name}"`;
    return `<div class="fxrow ${f.ex || f.chest || f.season || f.craft ? 'ex' : ''}"${inf}><span class="ico thumb">${thumbImg('fx', f.id)}</span><span class="name">${f.name} ${sourceBadge(f)}</span>` +
      `<span class="desc">${f.desc}.</span><button class="${cls}" id="fx-${f.id}" data-fx="${f.id}" ${dis}>${label}</button></div>`;
  }
  // ---- 2.7: «Достижения» — counts on the tabs, «почти готово» first, the done ones folded, 👁 on rewards ----
  function goalCount(id) {
    if (id === 'ach') { const L = ACH.filter(a => a.line); return [L.reduce((t, a) => t + achTier(a), 0), L.reduce((t, a) => t + a.steps.length, 0)]; }
    if (id === 'ch') return [save.chDone.length, CHALLENGES.length];
    if (id === 'skill') return [save.skillDone.length, SKILL.length];
    return [LEGEND.filter(L => save.legendDone.includes(L.id)).length, LEGEND.length];
  }
  // items: [{ pct 0..1, done, html }]; «near» = at least 60% of the way
  function goalGroups(items, near = 'Почти готово', rest = 'В процессе', doneName = 'Выполнено') {
    const open = items.filter(x => !x.done).sort((a, b) => b.pct - a.pct), done = items.filter(x => x.done);
    const hot = open.filter(x => x.pct >= .6), mid = open.filter(x => x.pct < .6);
    const grid = l => `<div class="g-grid">${l.map(x => x.html).join('')}</div>`;
    return (hot.length ? `<h3 class="g-h">🔥 ${near}</h3>${grid(hot)}` : '') + (mid.length ? `<h3 class="g-h">${rest}</h3>${grid(mid)}` : '') +
      (done.length ? `<details class="res-drawer g-done"><summary>✓ ${doneName} <small class="cnt">${done.length}</small></summary>${grid(done)}</details>` : '');
  }
  // a reward you can look at: tapping it opens the item window (the same as in the wardrobe)
  const rewardChip = (r, label) => { const [t, id] = r || []; const kind = t === 'fx' ? 'fx' : t === 'skin' ? 'skin' : t === 'deco' ? 'deco' : t === 'pet' ? 'pet' : t === 'arena' ? 'arena' : null;
    return kind ? `<span class="rwb" data-info="${kind}:${id}" tabindex="0" role="button" aria-label="Посмотреть награду">${label}<em aria-hidden="true">👁</em></span>` : `<span class="rw">${label}</span>`; };
  $('shop').addEventListener('click', e => { const t = e.target.closest('[data-coltab]'); if (!t) return; save.settings.colTab = t.dataset.coltab; persist(); renderShop(); const b = document.querySelector(`[data-coltab="${t.dataset.coltab}"]`); if (b) b.focus(); });
