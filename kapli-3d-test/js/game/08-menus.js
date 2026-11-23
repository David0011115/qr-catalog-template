  // ================= menus =================
  let shopTab = 'up', shopReturn = 'menuCard';
  function showCard(id) {
    ['menuCard', 'resultCard', 'shopCard', 'chestCard', 'profileCard', 'settingsCard', 'leagueCard', 'chaosCard', 'modesCard', 'hubLeague', 'hubCol', 'hubRew', 'infoCard', 'pauseCard', 'accountCard', 'chatCard', 'rankCard', 'friendsCard', 'dmCard', 'clanCard', 'wsCard', 'duoCard'].forEach(c => $(c).hidden = c !== id);
    $('overlay').scrollTop = 0;
  }
  function openShop() { shopReturn = $('resultCard').hidden ? 'menuCard' : 'resultCard'; showCard('shopCard'); renderShop(); $('backBtn').focus(); }
  function closeShop() { showCard(shopReturn); if (shopReturn === 'resultCard') requestAnimationFrame(drawGraph); }
  function openView(view, tab) { shopView = view; shopTab = tab || SHOP_VIEWS[view].tabs[0][0]; if (view === 'shop') { save.shopSeenLvl = playerLevel(); persist(); } openShop(); }
  $('shopBtn').addEventListener('click', () => openView('shop'));
  $('shopBtn2').addEventListener('click', () => openView('shop'));
  $('wardBtn').addEventListener('click', () => openView('wardrobe'));
  $('petBtn').addEventListener('click', () => openView('pets'));
  $('colBtn').addEventListener('click', () => openView('collections'));
  $('myAbilBtn').addEventListener('click', () => openView('abilities'));
  $('backBtn').addEventListener('click', closeShop);
  $('startBtn').addEventListener('click', () => { pendingRanked = false; if (isDuoMode(save.mode)) { openDuoLobby(save.mode); return; } startRound(); });
  // ================= tutorial for new players =================
  const TUT_COINS = 500;
  const MODE_SHORT = {
    classic: 'Вехи до 50 000, на 50 000 — две половины; цель — обе по 50 000', timed: '5 минут, случайное правило раунда', survival: 'Волна боссов каждые 15 секунд, связки боссов',
    crown: 'Держи корону как можно дольше — на тебя охотятся все', rbuild: '3 случайные способности, замена на 5 вехах, опыт ×1,2', hardcore: 'Без бонусов; на 50 000 — две половины, проклятия, монеты ×1,6',
    raid: 'Колоссы недели: 5 ступеней, фазы и атаки', royale: 'Зона сужается, побеждает последний', territory: 'Двигай границу поля к сопернику, 4 минуты',
    duoback: 'Вдвоём против 50 волн боссов',
  };
  let modesTabPick = null;
  const modesTab = () => modesTabPick || (isDuoMode(save.mode) ? 'duo' : 'solo');
  const GUEST_WARN = 'Режим гостя: прогресс хранится только на этом телефоне. Если удалить игру, очистить данные браузера или потерять телефон, восстановить его мы не сможем. Войди в аккаунт — и прогресс, монеты и покупки сохранятся на сервере.';
  const pCenter = () => { const m = total(player) || 1; return player.cells.reduce((a, c) => [a[0] + c.x * c.mass / m, a[1] + c.z * c.mass / m], [0, 0]); };
  function tutBot(i, mass, dist, still) {
    const o = bots[i]; if (!o) return null;
    [...o.cells].forEach(removeCell); dressBot(o);
    const [px, pz] = pCenter(), a = Math.random() * Math.PI * 2;
    addCell(o, px + Math.cos(a) * dist, pz + Math.sin(a) * dist, mass, o.free.pop());
    o.tx = o.cells[0].x; o.tz = o.cells[0].z; o.target = null; o.think = still ? 1e9 : 0;
    rebuildCells(); return o;
  }
  const TUT_STEPS = [
    { title: 'Движение', text: () => finePointer ? 'Веди мышью — капля плывёт за курсором. Можно и клавишами WASD или стрелками. Проплыви немного.' : 'Коснись экрана и веди пальцем — появится джойстик. Проплыви немного.',
      init: t => { t.p0 = pCenter(); }, prog: t => { const [x, z] = pCenter(); return hyp(x - t.p0[0], z - t.p0[1]) / 25; } },
    { title: 'Крошки', text: () => 'Светящиеся точки на полу — крошки. Каждая делает тебя чуть тяжелее. Съешь 15 крошек.',
      init: t => { t.c0 = stats.crumbs; }, prog: t => (stats.crumbs - t.c0) / 15 },
    { title: 'Съешь каплю', text: () => 'Рядом появились маленькие капли. Съесть можно того, кто хотя бы на 25% легче тебя: подплыви и накрой её.',
      init: t => { t.k0 = stats.kills; const m = Math.max(3, total(player) * .45); tutBot(0, m, 12, true); tutBot(1, m, 16, true); tutBot(2, m, 20, true); }, prog: t => stats.kills - t.k0 },
    { title: 'Рывок', text: () => `Рывок даёт короткое ускорение — чтобы догнать или убежать. Нажми ${finePointer ? 'Пробел' : 'кнопку «Рывок»'}.`,
      init: t => { t.d0 = stats.dashes || 0; }, prog: t => (stats.dashes || 0) - t.d0 },
    { title: 'Деление', text: () => `Деление разбивает каплю на две и бросает половину вперёд — так ловят убегающих. Части потом сольются обратно. Нажми ${finePointer ? 'E' : 'кнопку «Деление»'}.`,
      init: t => { t.s0 = stats.splits; }, prog: t => stats.splits - t.s0 },
    { title: 'Выброс массы', text: () => `Выброс отдаёт кусочек массы: так можно стать легче или покормить союзника. Нажми ${finePointer ? 'Q' : 'кнопку «Выброс»'}. Выброс и другие способности покупаются в магазине и ставятся в билд.`,
      init: t => { t.e0 = stats.ejects; }, prog: t => stats.ejects - t.e0 },
    { title: 'Опасность!', text: t => `Красноватая на мини-карте капля больше тебя и охотится. Не дай себя съесть: убегай и используй рывок. Продержись ${Math.max(0, Math.ceil(15 - (t.surv || 0)))} с.`,
      init: t => { t.surv = 0; t.lives0 = lives; const m = Math.max(40, total(player) * 2.5); tutBot(3, m, 30, false); }, prog: t => (t.surv || 0) / 15,
      tick: (t, dt) => { t.surv += dt; if (lives < t.lives0) { t.lives0 = lives; t.surv = 0; toast('Тебя съели! Крупных капель нужно избегать. Ещё раз'); } } },
  ];
  function tutShow() {
    const st = TUT_STEPS[tut.i];
    $('tutStep').textContent = `Обучение · шаг ${tut.i + 1} из ${TUT_STEPS.length}`;
    $('tutTitle').textContent = st.title; $('tutText').textContent = st.text(tut);
    $('tutFill').style.width = Math.min(100, Math.max(0, st.prog(tut)) * 100).toFixed(0) + '%';
  }
  function tutBegin() {
    tut = { i: 0, wait: 0 }; TUT_STEPS[0].init(tut);
    $('tutBox').hidden = false; $('tutBox').classList.remove('done'); $('board').hidden = true; tutShow();
  }
  function tutTick(dt) {
    if (!tut) return false;
    if (tut.wait > 0) { tut.wait -= dt; if (tut.wait <= 0) { tut.i++; if (tut.i >= TUT_STEPS.length) { tutExit(true); return true; } $('tutBox').classList.remove('done'); TUT_STEPS[tut.i].init(tut); } else return false; }
    const st = TUT_STEPS[tut.i]; if (st.tick) st.tick(tut, dt);
    tutShow();
    if (st.prog(tut) >= 1) { tut.wait = 1.2; $('tutBox').classList.add('done'); $('tutText').textContent = 'Отлично! ✓'; Sound.play('level'); }
    return false;
  }
  function tutExit(done) {
    running = false; dying = false; tut = null; $('tutBox').hidden = true;
    [...player.cells].forEach(removeCell); bots.forEach(o => { [...o.cells].forEach(removeCell); o.disabled = false; }); rebuildCells();
    setGameUi(false); $('overlay').hidden = false; showCard('menuCard');
    save.tutSeen = true;
    let body = '', title;
    if (done) {
      title = 'Обучение пройдено!';
      const first = !save.tutDone;
      if (first) { save.tutDone = today; coinsAdd(TUT_COINS, 'tut'); save.legend.coins = (save.legend.coins || 0) + TUT_COINS; if (!save.skins.includes('tut_student')) save.skins.push('tut_student'); }
      const k = SKINS.find(x => x.id === 'tut_student');
      body = (first ? `<div class="tut-reward"><span class="${swClass(k)}" style="${swatch(k)};width:56px;height:56px">${headIcon(k)}</span><div><b>Награда: +${TUT_COINS} ◆ и скин «Ученик»</b><small>Скин уже в гардеробе.</small></div></div>` : '<p>Награда уже была получена раньше.</p>') +
        '<ul><li>Монеты трать в «Магазине» на улучшения и способности: щит, скачок, маскировку и другие. Выброс массы из обучения тоже покупается там.</li><li>Задания под кнопкой «Играть» и задания недели дают монеты и сундуки.</li><li>С «Лиги» начинаются рейтинговые бои и сезонные награды.</li><li>Всё об игре — в «Информации», а в каждой вкладке есть кнопка ⓘ.</li></ul>';
    } else { title = 'Обучение прервано'; body = '<p>Его можно пройти в любой момент: «Информация» → «Пройти обучение». За прохождение — монеты и скин «Ученик».</p>'; }
    persist(); renderAll();
    tutModal(title, body, done && !save.tourSeen ? [['tourGo', 'Дальше: тур по меню', 'btn'], ['tutOk', 'Пропустить тур', 'btn ghost']] : [['tutOk', 'В меню', 'btn']]);
  }
  // 2.7 release: the modes for two are closed while they move to the full online
  function duoSoon() {
    tutModal('👥 Режимы вдвоём — скоро', '<p>«Захват территории» и «Спина к спине» переезжают в полноценный онлайн: играть с другом можно будет из любого города, матч будет считать сервер игры.</p>' +
      '<p>Пока идёт перенос, режимы закрыты. Рекорды пар сохранены — их видно в «Рейтинге». Как только откроем — напишем в «Обновлениях».</p>', [['tutOk', 'Понятно', 'btn']]);
  }
  if (DUO_SOON) { const n = document.getElementById('modesDuoNote'); if (n) n.innerHTML = '⏳ Режимы для двоих переезжают в полноценный онлайн и скоро вернутся. Рекорды пар сохранены в «Рейтинге».'; }
  function tutModal(title, body, btns) {
    $('tutMName').textContent = title; $('tutMBody').innerHTML = body; $('tutModal').classList.remove('nw-wide');
    $('tutMActs').innerHTML = btns.map(([id, t, cls]) => `<button class="${cls}" id="${id}">${t}</button>`).join('');
    $('tutModal').hidden = false; $(btns[0][0]).focus({ preventScroll: true }); $('tutModal').querySelector('.modal-card').scrollTop = 0;   // the title stays in view (a long text on a landscape phone)
  }
  // ---- menu tour: shown once after the first finished tutorial, repeatable from «Информация» ----
  const TOUR = [
    ['startBtn', 'Играть', 'Начни раунд в выбранном режиме. Режим и рекорд меняются в кнопке «Режим».'],
    ['hubLeagueBtn', 'Лиги', 'Рейтинговые бои: очки, ступени и награды сезона. С 25-го уровня открывается Хаос-лига.'],
    ['hubColBtn', 'Коллекция', 'Гардероб, питомцы, коллекции и твой билд способностей.'],
    ['hubRewBtn', 'Награды', 'Сундуки и достижения — здесь забираешь всё заработанное.'],
    ['shopBtn', 'Магазин', 'Монеты тратятся на скины, эффекты, арены, улучшения и способности.'],
    ['wsBtn', 'Мастерская', 'Предметы, которых нет ни в магазине, ни в сундуках: они создаются из осколков. Осколки дают сундуки осколков — их приносит каждый 2-й сундук за раунды, три цели за день и все задания недели. Предметы разбиты на серии, у каждой своя тема.'],
    ['infoBtn', 'Информация', 'Справка по всем темам. Здесь же можно повторить обучение и этот тур.'],
    ['newsBtn', 'Обновления', 'Что изменилось в игре. Красная точка — есть новое.'],
    ['chatBtn', 'Чат', 'Общий чат игроков. Писать можно с аккаунтом, читать — всем.'],
    ['rankBtn', 'Рейтинг', 'Лучшие рекорды игроков по каждому режиму и твоё место.'],
    ['setBtn', 'Настройки', 'Графика, звук, управление, промокоды и прогресс.'],
    ['acctChip', 'Профиль', 'Твой профиль: статистика, рекорды, значки и оформление. Там же — вход в аккаунт, облачные сохранения и перенос прогресса.'],
  ];
  let tourI = -1;
  function tourPlace() {
    if (tourI < 0) return;
    const el = $(TOUR[tourI][0]), r = el.getBoundingClientRect(), pad = 6, hole = $('tourHole'), tip = $('tourTip');
    Object.assign(hole.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    const tw = tip.offsetWidth, th = tip.offsetHeight, W = innerWidth, H = innerHeight;
    let x = r.left + r.width / 2 - tw / 2, y = r.bottom + 14;
    if (y + th > H - 8) y = r.top - th - 14;                       // no room below: above
    if (y < 8) { y = Math.max(8, Math.min(H - th - 8, r.top + r.height / 2 - th / 2)); x = r.right + 14 > W - tw - 8 ? r.left - tw - 14 : r.right + 14; }   // no room above either: to the side
    tip.style.left = Math.max(8, Math.min(W - tw - 8, x)) + 'px'; tip.style.top = y + 'px';
  }
  function tourShow(i) {
    tourI = i; const [id, t, txt] = TOUR[i];
    $('tourStep').textContent = `${i + 1} из ${TOUR.length}`; $('tourTitle').textContent = t; $('tourText').textContent = txt;
    $('tourNext').textContent = i === TOUR.length - 1 ? 'Готово' : 'Далее';
    $(id).scrollIntoView({ block: 'nearest' }); requestAnimationFrame(tourPlace); $('tourNext').focus();
  }
  function startTour() { $('tutModal').hidden = true; $('overlay').hidden = false; showCard('menuCard'); $('tour').hidden = false; tourShow(0); }
  function endTour() { $('tour').hidden = true; tourI = -1; save.tourSeen = true; persist(); $('startBtn').focus(); }
  $('tourNext').addEventListener('click', () => { if (tourI < TOUR.length - 1) tourShow(tourI + 1); else endTour(); });
  $('tourSkip').addEventListener('click', endTour);
  addEventListener('resize', () => requestAnimationFrame(tourPlace));
  document.addEventListener('keydown', e => { if (tourI >= 0 && e.key === 'Escape') endTour(); });
  $('tourStartBtn').addEventListener('click', startTour);
  function startTutorial() { $('tutModal').hidden = true; pendingRanked = false; pendingTut = true; startRound(); }
  $('tutModal').addEventListener('click', e => {
    const id = e.target.id;
    if (id === 'tutGo') startTutorial();
    else if (id === 'tourGo') startTour();
    else if (id === 'tutOk') { $('tutModal').hidden = true; $('startBtn').focus(); }
    else if (id === 'tutNo') { save.tutSeen = true; persist(); $('tutModal').hidden = true; $('startBtn').focus(); }
  });
  $('tutStartBtn').addEventListener('click', () => { showCard('menuCard'); startTutorial(); });
  $('tutSkip').addEventListener('click', () => { if (running && stats.tutorial) tutExit(false); });
  // 2.6: a guest's coins and purchases live only on this phone — said once before the first purchase (the next tap buys)
  function guestBuyWarn(b) {
    if (Net.uid || save.guestBuyWarned || !['abuy', 'arch', 'aup', 'up', 'skin', 'fx', 'arena', 'wsh'].some(k => k in b.dataset) || !b.textContent.includes('◆')) return false;
    save.guestBuyWarned = true; persist();
    tutModal('Покупка без аккаунта', `<p class="guest-warn">⚠ ${GUEST_WARN}</p><p>Чтобы купить, нажми на кнопку ещё раз.</p>`, [['guestAcct', 'Войти в аккаунт', 'btn'], ['guestOk', 'Понятно', 'btn ghost']]);
    return true;
  }
  $('tutModal').addEventListener('click', e => { if (e.target.id === 'guestAcct') { $('tutModal').hidden = true; Net.openAccount(null, 'shopCard'); } else if (e.target.id === 'guestOk') $('tutModal').hidden = true; });
  // first launch: offer the tutorial to a new player
  if (!save.tutSeen && !save.totals.rounds) setTimeout(() => tutModal('Добро пожаловать в «Капли 3D»!',
    `<p>Ты — неоновая капля. Ешь тех, кто меньше, и убегай от тех, кто больше. Короткое обучение покажет всё за пару минут.</p><p>За прохождение: <b>+${TUT_COINS} ◆ и скин «Ученик»</b>.</p><p class="guest-warn">⚠ ${GUEST_WARN}</p>`,
    [['tutGo', 'Пройти обучение', 'btn'], ['tutNo', 'Пропустить', 'btn ghost']]), 600);
