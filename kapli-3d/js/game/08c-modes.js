  // ================= menus, part: information lists, «Режимы» and their ⓘ windows, special badges (was in 08-menus.js; the files are joined in order by js/loader.js) =================
  // ---- information: the dynamic lists are built from the game data so they stay correct ----
  function renderInfo() {
    const dl = rows => rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    const BONUS_TXT = { speed: '+45% к скорости', shield: 'тебя нельзя съесть', double: 'еда даёт вдвое больше массы', magnet: 'крошки сами летят к тебе', fountain: 'сразу рассыпает вокруг тебя горсть крошек: чем ты больше, тем их больше' };
    $('infoBonus').innerHTML = dl(Object.entries(BONUS).map(([k, b]) => [`<i class="dot" style="background:${b.color}"></i>${b.name}`, b.instant ? `${BONUS_TXT[k] || ''}, сразу` : `${BONUS_TXT[k] || ''}, ${b.dur} с`]));
    if ($('infoChars')) $('infoChars').innerHTML = dl(CHARS.map(c => [`${c.icon} ${c.name} <small>(с ${c.lvl} ур.)</small>`, `＋ ${c.plus}; − ${c.minus}`]));
    $('infoEvents').innerHTML = dl(EVENTS.map(e => [`<i class="dot" style="background:${e.color}"></i>${e.name}`, e.desc]));
    $('infoBosses').innerHTML = dl([...Object.values(BOSS_TYPES), BOSS_TYPES_EXTRA.colossus].map(b => [`<i class="dot" style="background:${b.color}"></i>${b.name}`, `${b.about}. Награда: ${b.coins} ◆, ${b.xp} опыта`]));
    $('infoModes').innerHTML = dl(MODE_IDS.map(id => [id, MODES[id]]).map(([id, m]) => [m.name, m.desc + (id === leagueMode() ? ' <b>· сейчас режим лиги</b>' : '')]));
    const BOT_TXT = { normal: 'ведёт себя по ситуации', coward: 'убегает, далеко замечает опасность, чаще обходит шипы', aggressive: 'гоняется за всеми, особенно за тобой, часто влетает в шипы', farmer: 'спокойно собирает крошки', hunter: 'охотится парой с напарником' };
    $('infoBots').innerHTML = dl(Object.entries(PERSONA).filter(([k]) => k !== 'boss').map(([k, pp]) => [pp.tag || 'обычный', BOT_TXT[k] || '']));
    $('infoLeagues').innerHTML = dl(LEAGUES.map(l => [`<i class="dot" style="background:${l.color}"></i>${l.name}`, `от ${l.pts} очков · ${l.coins} ◆ в конце сезона`]));
    const tot = Object.values(RARITY).reduce((a, r) => a + r.w, 0);
    $('infoOdds').innerHTML = dl(Object.values(RARITY).map(r => [`<i class="dot" style="background:${r.color}"></i>${r.name}`, `${Math.round(r.w / tot * 100)}% в обычном сундуке · повтор (кроме скинов) = ${r.dup} ◆`]));
    $('infoPets').innerHTML = dl(Object.values(PET_BONUS).map(b => [b.name, b.text(1) + ' (сильнее у редких)']));
  }
  $('infoBtn').addEventListener('click', () => { renderInfo(); resetGroups($('infoCard')); showCard('infoCard'); $('infoBack').focus(); });
  $('infoBack').addEventListener('click', () => { showCard('menuCard'); $('infoBtn').focus(); });
  $('achBtn').addEventListener('click', () => openView('goals', 'ach'));

  // the weekly line in the menu opens the «Неделя» tab
  document.querySelector('.goal-tabs').addEventListener('click', e => { const b = e.target.closest('[data-gtab]'); if (!b) return; save.settings.goalTab = b.dataset.gtab; persist(); renderAll(); b.focus(); });
  // menu groups: each opens its own small window; ← back returns to the menu
  document.querySelectorAll('[data-hub]').forEach(b => b.addEventListener('click', () => { showCard(b.dataset.hub); const f = $(b.dataset.hub).querySelector('.hub-list button'); if (f) f.focus(); }));
  document.querySelectorAll('[data-hubback]').forEach(b => b.addEventListener('click', () => { showCard('menuCard'); $('startBtn').focus(); }));
  // ---- 2.7: «Режимы» — two tabs, compact tiles, ⓘ with everything else ----
  $('modesTabs').addEventListener('click', e => { const b = e.target.closest('[data-mtab]'); if (!b) return; modesTabPick = b.dataset.mtab; renderAll(); b.focus(); });
  { const dh = $('modesDuoHow'); if (dh) dh.addEventListener('click', () => Duo.how(save.mode === 'duoback' ? 'duoback' : 'territory')); }   // gone while the modes for two are «скоро»
  // what each «Хардкор» boost does, in plain words (the ⓘ window of «Режимы»)
  const HC_DESC = {
    speed: 'Капля двигается быстрее — легче догнать и легче убежать.',
    absorb: 'Всё съеденное даёт больше массы: крошки, боты, боссы.',
    cd: 'Способности перезаряжаются быстрее.',
    melt: 'Масса тает медленнее — особенно важно на большой массе.',
    skin: 'Чтобы съесть тебя, боту или боссу нужно быть заметно крупнее.',
    magnet: 'Крошки притягиваются к тебе с большего расстояния.',
    dash: 'Рывок перезаряжается быстрее.',
    merge: 'После деления части сливаются обратно быстрее. После деления на половины — ещё и короче перезарядка кнопки «Слить половины».',
    predator: 'После каждого съеденного бота 2 секунды ты быстрее.',
    coins: 'Больше монет за этот раунд (общий потолок множителей ×2).',
  };
  // 2.7: the details of each mode under ⓘ — rewards, steps, rules; the numbers come from the game itself
  function modeDetail(id) {
    const X = ModeX.info(), n = v => v.toLocaleString('ru-RU'), li = a => `<li>${a}</li>`, sec = (t, body) => `<details class="mi-sec"><summary>${t}</summary><div class="mi-body">${body}</div></details>`;   // drawers: closed until tapped
    const tbl = rows => `<div class="mi-tbl">${rows.map(([a, b]) => `<span>${a}</span><span>${b}</span>`).join('')}</div>`;
    if (id === 'classic') return sec('Вехи массы — награда сразу', tbl(X.MILES.map(([m, c]) => [`${n(m)} массы`, `+${c} ◆${m === 30000 ? ' · титул «Вершина» (один раз) · легендарный сундук' : m === 50000 ? ' · деление на две половины' : ''}`]).concat([[`обе половины по ${n(X.CL_GOAL)}`, `+${n(X.CL_GOAL_COINS)} ◆ · титул «Две вершины» · легендарный сундук`]]))) +
      sec('Две половины — с 50 000', `<ul>${li('капля сама делится на две равные половины по 25 000')}${li('«Двойной укус»: обе половины вместе съедают босса, которого не осилит одна')}${li('«Слить половины» — кнопка внизу: на 6 с можно слиться (−10% массы)')}${li('съеденная половина возрождается через 20 с с 5 000')}${li('после цели раунд продолжается — или «Забрать награду и выйти»')}</ul>`) +
      sec('Чем сложнее на большой массе', `<ul>${li('с 10 000 крошки, боты и боссы дают меньше, а таяние сильнее (так во всех одиночных режимах, кроме «Хардкора» и рейда)')}${li('с 10 000 боссы растут вместе с тобой')}${li('с 20 000 боты смелее, а трое из них сбиваются в стаю')}${li('с 10 000 шипы исчезают')}</ul>`) +
      sec('Арена накаляется', `<ul>${li(`каждые ${X.ESC_S / 60} минуты — новый уровень, всего ${X.ESC_MAX + 1}`)}${li('боты быстрее, боссы приходят чаще')}${li('за каждый уровень: +20 ◆ × номер уровня')}${li('после 5 минут можно «Забрать награду и выйти»')}</ul>`);
    if (id === 'timed') return sec('Правило раунда — одно случайное', `<ul>${X.RULES.map(r => li(`<b>${r.name}</b> — ${r.about}`)).join('')}</ul>`) +
      sec('Финальный рывок', `<ul>${li(`последние ${X.RUSH_S} с: крошки дают вдвое больше`)}</ul>`) +
      sec('Награда за место', tbl(X.PLACE.map((c, i) => [`${i + 1}-е место`, `+${c} ◆`]).concat([['дальше', '+5 ◆'], ['за подъём во второй половине', '+5 ◆ за каждое место, до +25']])));
    if (id === 'survival') return sec('Волны', `<ul>${li('новый босс каждые 15 с, каждая волна на 12% тяжелее')}${li('боссы тают: к концу жизни их можно съесть')}${li('каждая 5-я волна особая: босс в полтора раза крупнее, после неё передышка')}${li('со 5-й волны боссы могут повторяться, с 10-й их до 4 сразу')}</ul>`) +
      sec('Связки — каждая 3-я волна', `<ul>${X.COMBOS.map(c => li(`<b>«${c.name}»</b>: ${c.how}`)).join('')}</ul><small>Пока двое из связки держатся рядом, они на 10% быстрее.</small>`);
    if (id === 'crown') return sec('Правила', `<ul>${li('корона лежит на поле — подбери её первым')}${li('дальше она переходит только к тому, кто съест владельца (или большую его часть)')}${li('если владельца съест босс, корона падает на поле')}${li('владелец на 15% медленнее')}</ul>`) +
      sec('Кто охотится на владельца', `<ul>${li('боссы — где бы он ни был')}${li('боты крупнее — через всю арену')}${li('боты мельче — за отколовшимися частями')}</ul>`) + sec('Рекорд', '<ul><li>время с короной за раунд</li></ul>');
    if (id === 'rbuild') {   // 2.7: as detailed as «Хардкор» — rules, milestones with rarity, every ability a card can bring, rewards
      const all = ABILITIES.filter(a => !a.xa && !a.cr), cards = all.filter(a => !a.branches), RN = X.RB_RN;
      const short = d => { const t = String(d || '').split(/(?<=[.!])\s|:\s/)[0]; return t.length > 120 ? t.slice(0, 117) + '…' : t; };
      return sec('Как устроен', `<ul>${li(`в начале раунда — 3 случайные способности из ${all.length} обычных, даже не купленные`)}${li('уровни способностей — как у тебя в «Коллекции»')}${li('опыт за раунд ×1,2')}${li(`на ${X.RB_MILES.length} вехах массы игра встаёт на паузу и предлагает заменить способность`)}${li(`открывается с ${MODES.rbuild.lvl} уровня`)}</ul>`) +
        sec(`Вехи — ${X.RB_MILES.length} замен за раунд`, tbl(X.RB_MILES.map((m, k) => { const [f, up] = X.RB_TIER[k]; return [`${n(m)} массы`, `${RN[f]}, шанс ${Math.round(up * 100)}% на ${['обычную', 'редкую', 'эпическую', 'легендарную'][f + 1]}`]; }))) +
        sec('Как работает замена', `<ul>${li('2 карточки новых способностей, у каждой своя редкость')}${li('выбери карточку, затем — какую из трёх своих способностей она заменит')}${li('«Оставить свои способности» — билд не меняется; «← назад» — вернуться к карточкам')}${li('15 с на выбор, не успел — билд остаётся прежним')}${li('новая способность готова сразу, перезарядки нет')}${li('уровни из карточки действуют до конца раунда, не выше 5-го')}${li('в карточках нет способностей, которые уже стоят в билде, а также «Рывка» и «Деления» — у них нет уровней')}</ul>`) +
        sec(`Способности в карточках — ${cards.length} видов`, `<ul class="mi-boosts">${cards.map(a => `<li><span class="mib-ic" style="color:${a.color}">${a.icon}</span><span class="mib-tx"><b>${a.name}</b><small>${short(a.desc)}</small><span class="mib-v">${[0, 1, 2, 3].map(r => `<i class="r${r}">+${r + 1} ур.</i>`).join('')}</span></span></li>`).join('')}</ul>` +
          `<small>Цвета: обычная · <span style="color:#4d7cff">редкая</span> · <span style="color:#b26bff">эпическая</span> · <span style="color:#ffd23f">легендарная</span>. Каждый уровень: перезарядка −${Math.round(ABIL_CFG.cdPerLv * 100)}%, сила +${String(Math.round(ABIL_CFG.powPerLv * 1000) / 10).replace('.', ',')}%.</small>`) +
        sec('Награды', `<ul>${li('«Импровизатор» — стань лидером арены, применив все три способности, что стоят в билде')}${li('«Мастер импровизации» — 25 раундов в режиме: скин «Бездна»')}</ul>`);
    }
    if (id === 'hardcore') return sec('Без поблажек', `<ul>${li('нет бонусов на поле и второго шанса')}${li('случайные события арены (звездопад, разлом, ветер и другие) действуют и здесь')}${li('боты из стаи сытны только на 20% (их масса набрана искусственно), боссы с 30 000 — на 35%')}${li('укусив тебя, вся стая 2,5 с не может кусать снова')}${li('боты злее, масса тает быстрее, чем в других режимах')}${li('длинная защита на старте')}${li('на 50 000 капля делится на две половины; победа — обе держат по 50 000 одновременно 15 с')}${li('после деления обе половины 3 с неуязвимы')}${li('⇄ половины выравниваются сами: если одна тяжелее больше чем на 10%, масса перетекает к лёгкой (видна светящаяся нить), без потерь')}${li('пока идёт 15-секундный отсчёт победы, таяние вдвое меньше')}${li('🔗 «Двойной укус»: обе половины вместе касаются босса и вместе крупнее его в 1,25 раза — босс съеден')}${li('🔗 кнопка «Слить половины»: на 6 с половины сливаются в одну каплю (−10% массы); та же кнопка делит их раньше, а если рядом опасный босс, деление откладывается до 5 с; перезарядка 90 с, короче с «Быстрым слиянием»')}${li('с боссов 40% массы, «двойным укусом» и слитой каплей — 25%; таяние растёт с 15 000: ×1,45 к 25 000, ×1,8 с 60 000 (выше не растёт) («Таяние» снижает не больше чем на 40%); крошки дают 75% (после 50 000 — половину), боты после 50 000 — половину; с 10 000 на поле два босса; стаи выходят с 20 000; боты охотятся злее; после деления на поле всегда два босса, они видят вдвое дальше и разворачиваются быстрее; боссы крупнее твоей меньшей половины ×1,4 тают на 1% в секунду; слившаяся стая даёт 40%, а не 80%; после 20 000 — не больше одной карточки улучшения в 20 с; на каждой вехе одна из двух карточек «⚠ риск»: бонус ×1,5, но с минусом (у обычной минус — половина бонуса, у легендарной — пятая часть); с 10 000 раз в 60–90 с — проклятие на 15 с: вязкость, голод, туман, оковы или метка')}${li('при достижении 10 000 массы все шипы исчезают до конца раунда')}${li('монеты ×1,6')}</ul>`) +
      sec(`Вехи — ${X.HC_MILES.length} улучшений за раунд`, tbl(X.HC_MILES.map((m, k) => { const [f, up] = X.HC_TIER[k]; return [`${n(m)} массы`, up ? `${X.HC_RN[f]}, шанс ${Math.round(up * 100)}% на ${X.HC_RN[f + 1].toLowerCase()}` : `${X.HC_RN[f]} — гарантированно`]; }))) +
      sec(`Улучшения — ${Object.keys(X.HC_BOOST).length} видов`, `<ul class="mi-boosts">${Object.entries(X.HC_BOOST).map(([k, [ic, nm, v, kd]]) => `<li><span class="mib-ic">${ic}</span><span class="mib-tx"><b>${nm}</b><small>${HC_DESC[k] || X.HC_ABOUT[k]}</small><span class="mib-v">${v.map((x, r) => `<i class="r${r}">${(kd === '+' ? '+' : '−') + x + '%'}</i>`).join('')}</span></span></li>`).join('')}</ul>` +
        `<small>Цвета: обычное · <span style="color:#4d7cff">редкое</span> · <span style="color:#b26bff">эпическое</span> · <span style="color:#ffd23f">легендарное</span>. Каждая веха — 2 карточки на выбор, редкость не ниже указанной в «Вехах». Одно улучшение — не больше ${X.HC_CAP} раз за раунд, одинаковые складываются. Не успел выбрать за 12 с — возьмётся первое.</small>`) +
      sec('Особые карточки — плюс и минус', `<ul>${li('💥 <b>Стеклянная пушка</b>: еда сытнее на 15%, но съесть тебя легче на 5%')}${li('🪨 <b>Тяжеловес</b>: съесть тебя труднее на 10%, но ты медленнее на 8%')}${li('❄ <b>Ледяное сердце</b>: мороз и замедления вдвое слабее, но рывок перезаряжается на 20% дольше')}${li('♊ <b>Близнецы</b>: 30% съеденного одной половиной получает другая, но ты медленнее на 5%')}</ul><small>С вехи 10 000 одна из двух карточек может оказаться особой (шанс 35%). Каждая — один раз за раунд, «Близнецы» — после деления или с 40 000.</small>`) +
      sec('Награды', `<ul>${li('🩸 скин «Берсерк» с эволюцией: формы за 40 000 / 50 000 / 70 000 массы за раунд')}${li('🖼 живой фон профиля «Арена Берсерка» — растёт вместе со скином: те же 40 000 / 50 000 / 70 000')}${li('👑 победа (обе половины по 50 000 15 секунд) — значок «Корона Берсерка» и фон профиля «Трон затмения»')}${li('🏅 значки «Берсерк · 75 000» и «Берсерк · 88 000» — за массу за один раунд')}</ul>`) +
      sec('Серия', `<ul>${li('3 раунда подряд с массой 3 000+ — титул «Несгибаемый»')}${li('5 раундов подряд — рамка «Закалка»')}</ul>`);
    if (id === 'raid') return sec('Ступени недели', `<ul>${li('5 ступеней: каждая — один бой на 4 минуты, попыток сколько угодно')}${li('следующая открывается, когда пройдена предыдущая; награда за ступень — раз в неделю')}${li('монеты за урон — пока ступень не пройдена')}</ul>` + tbl(RAID_TIERS.map((t, i) => [`${RAID_ROMAN[i]} · ${n(t.hp)} урона`, `+${n(t.coins)} ◆${i === 2 ? ' · трофей недели, эпический сундук, +1 500 ◆' : i === 4 ? ' · легендарный сундук, титул «Гроза колоссов»' : ''}`]))) +
      sec('Бой с близнецами', `<ul>${li('пока близнецы рядом, их связь гасит половину урона — разводи их')}${li('3 фазы: с ⅓ и ⅔ урона атаки чаще, появляются прислужники')}${li('атаки видно заранее: кольцо-волна, рывок, взрывы на полу')}${li('✦ слабые ядра у колоссов: съешь — урон ×3')}${li('у каждого босса недели своя особая атака: ' + RAID_SPECIAL.map((s, i) => `${RAID_NAMES[i]} — «${s[1]}»`).join(', '))}</ul>`) +
      sec('Награды за победы в рейде', `<ul>${li('каждая победа (ступень III): +2% урона, до +10%')}${li('1-я: «Аура рейдера» (+3% монет в рейде)')}${li('3-я: «Шлем рейдера» (+20 с к бою)')}${li('5-я: «Знамя рейда» и питомец «Рейдер»')}</ul>`);
    if (id === 'royale') return sec('Правила', `<ul>${li('зона сужается ступенями и смещается — следующий круг виден заранее')}${li('в новом круге падают бонусы')}${li('боты не возрождаются, побеждает последний')}${li('только в лиге, в свой сезон')}</ul>`);
    if (id === 'territory') return sec('Матч', `<ul>${li('4 минуты, вдвоём через сервер игры')}${li('ешь ботов на своей половине — граница ползёт к сопернику')}${li('90% поля — досрочная победа, но не раньше 2:00')}${li('поле в 1,25 раза больше обычного, игроки на 12% быстрее, крошки вдвое сытнее и притягиваются чуть издалека, боты медленнее')}${li('ботов можно есть только на своей половине')}${li('20 матчей — фон чата «Граница»')}</ul>`);
    if (id === 'duoback') return sec('Забег', `<ul>${li('вместе против 50 волн боссов, три сложности')}${li('каждая 5-я волна — особый босс, 50-я — финал')}${li('перерывы с едой и усилениями')}</ul>`) +
      sec('Помощь напарнику', tbl([['ешь ботов, пока он ждёт возвращения', '+1 очко'], ['съешь босса, который гнался за ним', '+3 очка'], ['каждое очко', '+15 ◆ (× сложность)'], ['100 очков за все забеги', 'титул «Надёжное плечо»'], ['300 очков', 'рамка «Плечом к плечу»']]));
    return '';
  }
  function modeInfo(id) {
    const m = MODES[id], a = modeArt(id), ms = modeMastery(id), pts = (save.mastery || {})[id] || 0;
    let el = $('modeInfoM');
    if (!el) {
      el = document.createElement('div'); el.id = 'modeInfoM'; el.className = 'modal mode-info-m'; el.hidden = true; document.body.appendChild(el);
      el.addEventListener('click', e => {
        if (e.target === el || e.target.closest('[data-mix]')) { el.hidden = true; const t = $('mode-' + el.dataset.id); if (t) t.focus(); return; }
        const pick = e.target.closest('[data-mipick]'); if (!pick) return;
        el.hidden = true; if (DUO_SOON && isDuoMode(pick.dataset.mipick)) { duoSoon(); return; }
        save.mode = pick.dataset.mipick; mode = save.mode; persist(); renderAll(); showCard('menuCard'); $('startBtn').focus();
      });
    }
    el.dataset.id = id;
    const lock = $('mode-' + id) && $('mode-' + id).disabled;
    const league = LEAGUE_ROT.includes(id) ? (id === leagueMode() ? 'сейчас' : `сезон ${nextSeasonOf(id)}`) : '—';
    el.innerHTML = `<div class="modal-card mi-card" role="dialog" aria-modal="true" aria-labelledby="miName" style="--mc:${a.c};--mc2:${a.c2}">` +
      `<div class="mi-h"><span class="mi-art">${modeIcon(id)}</span><div><b id="miName">${m.name}</b><small>${m.duo ? '👥 вдвоём, на двух телефонах' : `Мастерство${ms.name ? ` · ${ms.name}` : ''} · ${pts} оч.`}</small></div><button class="modal-x" type="button" data-mix aria-label="Закрыть">×</button></div>` +
      `<p class="mi-desc">${m.desc}</p>${modeDetail(id)}<span class="tg">${a.tags.map(t => `<i>${t}</i>`).join('')}</span>` +
      (m.duo ? `<div class="mi-st">${duoLine(id, 'rec')}</div>` : `<div class="mi-st"><span>Рекорд<b>${fmtBest(id, save.bests[id] || 0)}</b></span><span>Мастерство<b>${ms.name || '—'}</b></span><span>Лига<b>${league}</b></span></div>`) +
      (lock ? '' : `<button class="btn mi-pick" type="button" data-mipick="${id}">${save.mode === id ? 'Выбран — в меню' : 'Выбрать режим'}</button>`) + '</div>';
    el.hidden = false; el.querySelector('[data-mix]').focus();
  }
  $('modes').addEventListener('keydown', e => { const i = e.target.closest('[data-minfo]'); if (i && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); e.stopPropagation(); modeInfo(i.dataset.minfo); } });
  $('modes').addEventListener('click', e => {
    const inf = e.target.closest('[data-minfo]'); if (inf) { e.stopPropagation(); modeInfo(inf.dataset.minfo); return; }
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.soon) { duoSoon(); return; }
    save.mode = b.dataset.mode; mode = save.mode; persist(); renderAll();
    showCard('menuCard'); $('startBtn').focus();
  });
  // 2.7 «Характер капли»: chosen before every round of a solo mode (the last choice for that mode is already marked)
  const charSolo = () => !isDuoMode(save.mode);
  function charPick(go) {
    let m = $('charModal');
    if (!m) { m = document.createElement('div'); m.id = 'charModal'; m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Характер на этот раунд'); document.body.appendChild(m);
      m.addEventListener('click', e => {
        if (e.target === m || e.target.closest('[data-chx]')) { m.hidden = true; return; }
        const t = e.target.closest('[data-char]'); if (t && !t.disabled) { m.dataset.sel = t.dataset.char; m.querySelectorAll('[data-char]').forEach(x => { const on = x === t; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); }); return; }
        if (e.target.closest('[data-chgo]')) { const id = m.dataset.sel || null; save.char = id; (save.charMode = save.charMode || {})[save.mode] = id; persist(); m.hidden = true; m._go && m._go(); }
      }); }
    const lv = playerLevel(), last = (save.charMode || {})[save.mode], sel = last !== undefined ? last : save.char, ok = c => c && lv >= c.lvl, cur = ok(charById(sel)) ? sel : '';
    const tile = c => { const lock = lv < c.lvl, on = cur === c.id;
      return `<button type="button" class="ch-tile${on ? ' on' : ''}" data-char="${c.id}" ${lock ? 'disabled' : ''} style="--ac:${c.color}" aria-pressed="${on}"><span class="ch-ic">${c.icon}</span><b>${c.name}</b>${lock ? `<small class="ch-lock">🔒 с ${c.lvl} уровня</small>` : `<small class="ch-p">＋ ${c.plus}</small><small class="ch-m">− ${c.minus}</small>`}</button>`; };
    m.dataset.sel = cur; m._go = go;
    m.innerHTML = `<div class="ch-box"><button type="button" class="ch-x" data-chx aria-label="Закрыть">✕</button><h2>Характер на этот раунд</h2><p>${(MODES[save.mode] || {}).name || ''} · у каждого характера есть плюс и минус. Выбор запоминается для этого режима.</p>` +
      `<div class="ch-grid">${CHARS.map(tile).join('')}<button type="button" class="ch-tile none${cur ? '' : ' on'}" data-char="" aria-pressed="${!cur}"><span class="ch-ic">○</span><b>Без характера</b><small class="ch-p">без плюсов и минусов</small></button></div>` +
      `<button type="button" class="btn ch-go" data-chgo>В бой</button></div>`;
    m.hidden = false; m.querySelector('[data-chgo]').focus();
  }
  $('modeBtn').addEventListener('click', () => { renderAll(); showCard('modesCard'); const cur = $('mode-' + save.mode); (cur || $('modesBack')).focus(); });
  $('modesBack').addEventListener('click', () => { showCard('menuCard'); $('modeBtn').focus(); });

  // ---- special badges (besides «Легенда Капель» and «Миллионер») ----
  const SPECIAL = [
    { id: 'collector', src: 'все коллекции, кроме праздничных', name: 'Великий коллекционер', label: 'КОЛЛЕКЦИИ', c: '#3dffa2', c2: '#0b6e3e', glyph: '▦',
      prog: () => { const L = COLLECTIONS.filter(c => !c.holiday); return [L.filter(c => save.colDone.includes(c.id)).length, L.length]; }, how: n => `Собери все коллекции, кроме праздничных: ${n[0]} из ${n[1]}.` },
    { id: 'modes', src: 'мастерство «Легенда» во всех режимах', name: 'Мастер режимов', label: 'МАСТЕР', c: '#22e6ff', c2: '#0a3a6e', glyph: '12',
      prog: () => { const ids = SOLO_MODE_IDS; return [ids.filter(id => masteryLv(save.mastery[id] || 0) >= MASTERY_LV.length).length, ids.length]; }, how: n => `Мастерство «Легенда» во всех режимах: ${n[0]} из ${n[1]}.` },
    { id: 'neonchamp', src: '6 сезонов в «Неоне»', name: 'Чемпион Неона', label: 'НЕОН ×6', c: '#ff4fd8', c2: '#5a0a4a', glyph: 'N',
      prog: () => [Math.min(6, save.seasonLog.filter(x => x.league >= 5).length), 6], how: n => `Закончи 6 сезонов в высшей лиге («Неон» или праздничная): ${n[0]} из 6.` },
    { id: 'firstneon', src: 'первый сезон в «Неоне»', name: 'Первый Неон', label: 'НЕОН', c: '#ff4fd8', c2: '#3a0a40', glyph: '1',
      prog: () => [Math.min(1, save.seasonLog.filter(x => x.league >= 5).length), 1], how: () => 'Впервые закончи сезон основной лиги в «Неоне».' },
    { id: 'leaguelegend', src: '13 сезонов в «Неоне»', name: 'Легенда лиги', label: 'НЕОН ×13', c: '#ffd23f', c2: '#5a3b00', glyph: '13',
      prog: () => [Math.min(13, save.seasonLog.filter(x => x.league >= 5).length), 13], how: n => `Закончи 13 сезонов основной лиги в высшей лиге — полгода: ${n[0]} из 13.` },
    { id: 'conqueror', src: 'высшая ступень в обеих лигах', name: 'Покоритель лиг', label: 'ДВЕ ЛИГИ', c: '#22e6ff', c2: '#3a0a40', glyph: '⚔',
      prog: () => [(save.totals.maxLeague >= 5 ? 1 : 0) + ((save.totals.chaosMax || 0) >= 5 ? 1 : 0), 2], how: n => `Дойди до высшей ступени в обеих лигах: «Неон» в основной и «Сингулярность» в Хаос-лиге (${n[0]} из 2).` },
    { id: 'chaosheart', src: '50 сезонов Хаос-лиги в «Сингулярности»', name: 'Сердце хаоса', label: 'ХАОС ×50', c: '#ff4fd8', c2: '#1a0030', glyph: '◉', award: false,
      prog: () => [Math.min(50, save.chaosTop || 0), 50], how: n => `Закончи 50 сезонов Хаос-лиги в «Сингулярности»: ${n[0]} из 50.` },
    { id: 'veteran', src: '26 значков сезонов', name: 'Ветеран сезонов', label: 'ВЕТЕРАН', c: '#ff9a3d', c2: '#5a2a00', glyph: '26',
      prog: () => [Math.min(26, save.seasonLog.length), 26], how: n => `Собери 26 значков сезонов — это год игры: ${n[0]} из 26.` },
    { id: 'allhands', src: 'все 11 линеек достижений на III ступени', name: 'Мастер на все руки', label: 'ВСЕ РУКИ', c: '#3dffa2', c2: '#5a2a00', glyph: '✋',
      prog: () => { const L = ACH.filter(a => a.line); return [L.filter(a => save.ach.includes(a.id)).length, L.length]; }, how: n => `Доведи все линейки достижений до III ступени: ${n[0]} из ${n[1]}.` },
    { id: 'hc100k', src: 'победа в «Хардкоре»: обе половины достигли 50 000 массы', name: 'Корона Берсерка', label: '100K', c: '#ffd27a', c2: '#28124f', glyph: '∞',
      prog: () => [save.hc100k ? 1 : 0, 1], how: () => 'Пройди «Хардкор»: после разделения доведи каждую половину до 50 000 массы.' },
  ];
  // promo badges have their own detailed shapes (1.7.0)
  function promoBadgeSVG(b) {
    const id = 'pb_' + b.id, defs = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="${b.c}"/><stop offset="1" stop-color="${b.c2}"/></linearGradient></defs>`;
    let body = '';
    if (b.id === 'beta') body = `<path d="M50 4 L90 27 V73 L50 96 L10 73 V27 Z" fill="url(#${id})" stroke="${b.c}" stroke-width="2"/><path d="M50 13 L82 31 V69 L50 87 L18 69 V31 Z" fill="none" stroke="#fff" stroke-opacity=".5"/>` +
      `<g stroke="#0a2a6e" stroke-width="1.6" fill="none" opacity=".55"><path d="M20 40 H34 L40 34 M80 40 H66 L60 34 M20 62 H32 L38 68 M80 62 H68 L62 68"/></g><g fill="#0a2a6e" opacity=".6"><circle cx="40" cy="34" r="2"/><circle cx="60" cy="34" r="2"/><circle cx="38" cy="68" r="2"/><circle cx="62" cy="68" r="2"/></g>` +
      `<text x="50" y="64" text-anchor="middle" font-family="Russo One, Arial Black, sans-serif" font-size="38" fill="#fff" stroke="#0a2a6e" stroke-width="3" style="paint-order:stroke">β</text>`;
    else if (b.id === 'creator') body = `<path d="M50 3 L60 30 L89 27 L66 46 L78 74 L50 59 L22 74 L34 46 L11 27 L40 30 Z" fill="url(#${id})" stroke="${b.c}" stroke-width="2"/><circle cx="50" cy="45" r="17" fill="#5a2a00" stroke="#fff6c8" stroke-width="2"/>` +
      `<path d="M38 50 L38 40 L44 45 L50 36 L56 45 L62 40 L62 50 Z" fill="#ffd23f" stroke="#fff6c8" stroke-width="1"/><circle cx="50" cy="35" r="2.2" fill="#fff"/>` +
      `<path d="M30 80 Q50 92 70 80 L66 96 Q50 88 34 96 Z" fill="${b.c}" opacity=".9"/>`;
    else if (b.id === 'bday2026') body = `<path d="M50 4 C58 14 64 9 70 14 C76 19 72 26 80 31 C88 36 92 44 88 52 C85 60 90 68 82 74 C74 80 72 88 62 89 C55 90 52 96 50 96 C48 96 45 90 38 89 C28 88 26 80 18 74 C10 68 15 60 12 52 C8 44 12 36 20 31 C28 26 24 19 30 14 C36 9 42 14 50 4 Z" fill="url(#${id})" stroke="${b.c}" stroke-width="2"/>` +
      `<rect x="27" y="50" width="46" height="22" rx="4" fill="#fff0f8" stroke="#a3346f" stroke-width="1.6"/><path d="M27 56 Q31 61 35 56 Q39 61 43 56 Q47 61 51 56 Q55 61 59 56 Q63 61 67 56 Q71 61 73 56 V52 Q73 50 71 50 H29 Q27 50 27 52 Z" fill="#ff9ad5"/>` +
      `<rect x="31" y="38" width="38" height="13" rx="3" fill="#ff9ad5" stroke="#a3346f" stroke-width="1.4"/><path d="M31 42 Q35 46 39 42 Q43 46 47 42 Q51 46 55 42 Q59 46 63 42 Q67 46 69 42 V40 Q69 38 67 38 H33 Q31 38 31 40 Z" fill="#fff"/>` +
      `<g><rect x="38.5" y="25" width="4" height="13" rx="1.2" fill="#22e6ff"/><rect x="48" y="22" width="4" height="16" rx="1.2" fill="#ffd23f"/><rect x="57.5" y="25" width="4" height="13" rx="1.2" fill="#3dffa2"/>` +
      `<path d="M40.5 16 C43 19.5 43 21.5 40.5 24 C38 21.5 38 19.5 40.5 16 Z M50 13 C52.5 16.5 52.5 18.5 50 21 C47.5 18.5 47.5 16.5 50 13 Z M59.5 16 C62 19.5 62 21.5 59.5 24 C57 21.5 57 19.5 59.5 16 Z" fill="#ffb020"><animate attributeName="opacity" values="1;.6;1" dur="1.2s" repeatCount="indefinite"/></path></g>` +
      `<g fill="#fff" opacity=".9"><circle cx="20" cy="40" r="1.6"/><circle cx="80" cy="42" r="1.6"/><circle cx="24" cy="70" r="1.3"/><circle cx="77" cy="68" r="1.3"/></g>`;
    else body = `<circle cx="50" cy="48" r="42" fill="url(#${id})" stroke="${b.c}" stroke-width="2"/><circle cx="50" cy="48" r="34" fill="none" stroke="#fff" stroke-opacity=".5"/>` +
      `<path d="M43 26 H57 V41 H72 V55 H57 V70 H43 V55 H28 V41 H43 Z" fill="#fff" stroke="#0b5e36" stroke-width="2"/><path d="M50 62 C44 57 40 54 40 50 C40 46 45 45 47 48 L50 51 L53 48 C55 45 60 46 60 50 C60 54 56 57 50 62 Z" fill="#ff4f6d"/>` +
      `<path d="M14 82 L30 82 L35 74 L41 90 L47 80 L86 80" fill="none" stroke="${b.c}" stroke-width="2.5" stroke-linejoin="round"/>`;
    return `<svg class="legend-badge" viewBox="0 0 100 100" role="img" aria-label="Значок «${b.name}»" style="filter:drop-shadow(0 0 10px ${b.c}aa)">${defs}${body}<text x="50" y="${b.id === 'vet' ? 99 : b.id === 'creator' ? 99 : 99}" text-anchor="middle" font-family="Russo One, Arial Black, sans-serif" font-size="${b.label.length > 8 ? 9 : 10}" fill="${b.c}">${b.label}</text></svg>`;
  }
  function specialBadgeSVG(b, got) {
    if (PROMO_BADGES.includes(b)) return promoBadgeSVG(b);
    if (b.id === 'hc100k') return hcBadgeSVG('c', `legend-badge ${got ? '' : 'off'}`);
    return `<svg class="legend-badge ${got ? '' : 'off'}" viewBox="0 0 100 100" role="img" aria-label="Значок «${b.name}»${got ? '' : ', ещё не получен'}"${got ? ` style="filter:drop-shadow(0 0 10px ${b.c}99)"` : ''}>
      <defs><linearGradient id="spb_${b.id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".35" stop-color="${b.c}"/><stop offset="1" stop-color="${b.c2}"/></linearGradient></defs>
      <path d="M50 4 L88 18 V48 C88 70 70 82 50 90 C30 82 12 70 12 48 V18 Z" fill="url(#spb_${b.id})" stroke="${b.c}" stroke-width="2"/>
      <path d="M50 12 L80 23 V48 C80 65 66 75 50 82 C34 75 20 65 20 48 V23 Z" fill="none" stroke="#ffffff" stroke-opacity=".45" stroke-width="1.2"/>
      <text x="50" y="${b.glyph.length > 1 ? 58 : 60}" text-anchor="middle" font-family="Russo One, Arial Black, sans-serif" font-size="${b.glyph.length > 1 ? 28 : 34}" fill="#ffffff" style="paint-order:stroke" stroke="${b.c2}" stroke-width="3">${b.glyph}</text>
      <text x="50" y="99" text-anchor="middle" font-family="Russo One, Arial Black, sans-serif" font-size="${b.label.length > 8 ? 9 : 10}" fill="${b.c}">${b.label}</text>
    </svg>`;
  }
  // exclusive badges from promo codes: shown in the profile only once received
  const PROMO_BADGES = [
    { id: 'beta', src: 'промокод', name: 'Бета-тестер', label: 'БЕТА', c: '#22e6ff', c2: '#0a2a6e', glyph: 'β', sc: '#7cf3ff', frame: 'fr_beta', title: 'tt_beta' },
    { id: 'creator', src: 'промокод', name: 'Создатель', label: 'СОЗДАТЕЛЬ', c: '#ffd23f', c2: '#5a2a00', glyph: '✦', sc: '#ffe98a', frame: 'fr_creator', title: 'tt_creator', skin: 'cr_architect', bgs: ['bg_cr_plan'] },
    { id: 'vet', src: 'промокод', name: 'Ветврач', label: 'ВЕТВРАЧ', c: '#3dffa2', c2: '#0b5e36', glyph: '✚', sc: '#a6ffd4', frame: 'fr_vet', title: 'tt_vet' },
    // holiday gift boxes (one edition a year): badge + frame
    { id: 'bday2026', src: 'праздничная коробка «День рождения 2026»', name: 'Именинник 2026', label: '2026', c: '#ff4fd8', c2: '#5a0a48', glyph: '🎂', sc: '#ffc2ec', frame: 'fr_bday2026', gift: true },
  ];
  // 2.6: promo codes are checked by the server (SECURITY-MIGRATION.sql): the game no longer carries the codes
  // the look of the coin gifts (by the code's id on the server); an unknown id gets the default look
  const PROMO_COINS = {
    c_druzya: { name: 'Друзья', c: '#ffd23f', sc: '#fff6a0' },
    c_help3d26: { name: 'HELP3D26', c: '#22e6ff', sc: '#b8f7ff' },
    c_duo26: { name: 'ДУО26', c: '#3dffa2', sc: '#b8ffd9' }
  };
  const PROMO_ERR = { auth: 'Войди в аккаунт, чтобы активировать промокод: он даётся один раз на аккаунт.', unknown: 'Такого промокода нет.',
    expired: 'Срок действия этого промокода истёк.', used: 'Этот промокод уже активирован.', often: 'Слишком много попыток — подожди минуту.', net: 'Нет связи с сервером — попробуй ещё раз.' };
  async function redeemPromo(raw) {
    const code = String(raw || '').trim();
    if (!code) return { err: 'Введи промокод.' };
    const r = await Net.redeemPromo(code);
    if (!r || r.err) return { err: PROMO_ERR[(r && r.err) || 'net'] || PROMO_ERR.net };
    save.promo = save.promo || []; save.badges = save.badges || {};
    if (!save.promo.includes(r.id)) save.promo.push(r.id);
    if (r.kind === 'coins') {
      save.coins += r.coins; persist(); renderAll(); Net.walletSoon(1500);   // the server put them in the wallet already (or they go with the first sync)
      return { coins: { ...(PROMO_COINS[r.id] || { name: code.toUpperCase(), c: '#ffd23f', sc: '#fff6a0' }), coins: r.coins } };
    }
    const b = PROMO_BADGES.find(x => x.id === r.badge); if (!b) return { err: PROMO_ERR.net };
    save.badges[b.id] = today; [b.frame, b.title].forEach(d => { if (d && !save.decor.includes(d)) save.decor.push(d); }); if (b.skin && !save.skins.includes(b.skin)) save.skins.push(b.skin); pbgCheck(true); persist();
    return { badge: b };
  }
  const promoCoinSVG = n => `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><radialGradient id="pcg" cx=".35" cy=".3"><stop offset="0" stop-color="#fff6a0"/><stop offset=".6" stop-color="#ffd23f"/><stop offset="1" stop-color="#b07a00"/></radialGradient></defs>` +
    `<circle cx="50" cy="50" r="44" fill="url(#pcg)" stroke="#fff6a0" stroke-width="3"/><circle cx="50" cy="50" r="35" fill="none" stroke="#b07a00" stroke-width="2" stroke-dasharray="4 4"/>` +
    `<path d="M50 24 L64 50 L50 76 L36 50 Z" fill="#fff" opacity=".9"/><text x="50" y="96" text-anchor="middle" font-family="Russo One, Arial Black, sans-serif" font-size="13" fill="#5a3b00">+${n}</text></svg>`;
  function promoShow(b) {
    const fx = $('promoFx');
    fx.style.setProperty('--pc', b.c); fx.style.setProperty('--sc', b.sc);
    if (b.coins) { $('promoCoin').innerHTML = promoCoinSVG(b.coins); $('promoName').textContent = `+${b.coins.toLocaleString('ru-RU')} ◆`; $('promoWhat').textContent = `Подарок по промокоду «${b.name}» — монеты уже у тебя`; }
    else {
    $('promoCoin').innerHTML = specialBadgeSVG(b, true); $('promoName').textContent = `«${b.name}»`;
    $('promoWhat').innerHTML = `Особый значок, рамка <span ${frameAttr(b.frame)}>${b.name}</span>, титул ${titleTag(b.title)}, ${b.bgs ? 'фоны профиля' : 'фон профиля'} «${[pbgById('bg_' + b.id), ...(b.bgs || []).map(pbgById)].filter(Boolean).map(x => x.name).join('» и «')}»${b.skin ? ` и скин «${(SKINS.find(k => k.id === b.skin) || {}).name}» с эволюцией` : ''} — в профиле и гардеробе`; }
    $('promoSparks').innerHTML = Array.from({ length: 36 }, (_, i) => { const a = i / 36 * Math.PI * 2 + Math.random() * .3, r = 110 + Math.random() * 170;
      return `<i style="--dx:${(Math.cos(a) * r).toFixed(0)}px;--dy:${(Math.sin(a) * r).toFixed(0)}px;animation-delay:${(Math.random() * .35).toFixed(2)}s;${i % 3 ? '' : 'background:#fff'}"></i>`; }).join('');
    fx.hidden = false; fx.querySelectorAll('.promo-coin, .promo-burst, .promo-ring, .promo-sparks i, .promo-text').forEach(el => { el.style.animation = 'none'; void el.offsetWidth; el.style.animation = ''; });
    Sound.play('promo'); buzz([40, 60, 80]);
    clearTimeout(promoShow.t); promoShow.t = setTimeout(() => { fx.hidden = true; }, 4200);
  }
  // players who redeemed the beta code before the frame existed get it too
  // players who redeemed a code earlier get its newer frame and title too
  PROMO_BADGES.forEach(b => { if ((save.promo || []).includes(b.id) || (save.badges || {})[b.id]) { [b.frame, b.title].forEach(d => { if (d && !save.decor.includes(d)) { save.decor.push(d); persist(); } }); if (b.skin && !save.skins.includes(b.skin)) { save.skins.push(b.skin); persist(); } } });
  $('promoFx').addEventListener('click', () => { $('promoFx').hidden = true; });
  $('promoBtn').addEventListener('click', async () => {
    const m = $('promoMsg'), btn = $('promoBtn'); if (btn.disabled) return;
    btn.disabled = true; m.className = 'reset-note'; m.textContent = 'Проверяю…';
    const r = await redeemPromo($('promoIn').value); btn.disabled = false;
    m.className = 'reset-note ' + (r.err ? 'err' : 'ok');
    if (r.err) { m.textContent = r.err; Sound.play('click'); return; }
    if (r.coins) { m.textContent = `Получено ${r.coins.coins.toLocaleString('ru-RU')} ◆!`; $('promoIn').value = ''; promoShow(r.coins); return; }
    m.textContent = `Получены значок, рамка и титул «${r.badge.name}»!`; $('promoIn').value = ''; promoShow(r.badge);
  });
  $('promoIn').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('promoBtn').click(); } });

