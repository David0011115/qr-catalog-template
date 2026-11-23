  // ================= menus, part: «Витрина недели», abilities, drawer icons, wardrobe and pet sorting (was in 08-menus.js; the files are joined in order by js/loader.js) =================
  // ---- 2.7 «Витрина недели»: 4 chest-only items the player does not have, for coins; new every Monday, one paid refresh a week ----
  const WSH_PRICE = { common: 8000, rare: 15000, epic: 30000, legendary: 60000 }, WSH_REFRESH = 3000;
  const wshOwned = (t, id) => (t === 'skin' ? save.skins : t === 'fx' ? save.fxOwned : t === 'pet' ? save.pets : save.decor).includes(id);
  const wshItem = (t, id) => t === 'skin' ? SKINS.find(k => k.id === id) : t === 'fx' ? FX.find(f => f.id === id) : t === 'pet' ? PETS.find(x => x.id === id) : decorById(id);
  function wshMake(skip = []) {
    const week = raidWeek(), legOk = week - (save.wshowLeg ?? -99) >= 4;
    const pool = t => (t === 'skin' ? SKINS : t === 'fx' ? FX : t === 'pet' ? PETS : DECOR.filter(d => !d.old)).filter(x => x.chest && (legOk || x.chest !== 'legendary') && !wshOwned(t, x.id) && !skip.includes(x.id)).map(x => [t, x]);
    const pick = (list, taken) => { const L = list.filter(([, x]) => !taken.some(([, y]) => y.id === x.id)); if (!L.length) return null;
      const r = pickRarity(Object.values(RARITY).map(v => v.w)), same = L.filter(([, x]) => x.chest === r); const from = same.length ? same : L; return from[Math.floor(Math.random() * from.length)]; };
    const out = [];
    for (const slot of [['skin'], ['skin'], ['fx'], ['pet', 'deco']]) { const it = pick(slot.flatMap(pool), out) || pick(['skin', 'fx', 'pet', 'deco'].flatMap(pool), out); if (it) { out.push(it); if (it[1].chest === 'legendary') { save.wshowLeg = week; } } }
    return out.map(([t, x]) => ({ t, id: x.id }));
  }
  function wshState() {
    const week = raidWeek();
    if (!save.wshow || save.wshow.week !== week) { save.wshow = { week, items: wshMake(), re: false }; persist(); }
    return save.wshow;
  }
  function wshHtml() {
    const W = wshState(), days = Math.max(1, Math.ceil((W.week + 1) * 7 - 3 - Date.now() / 864e5));
    const card = (o, i) => { const x = wshItem(o.t, o.id); if (!x) return ''; const rar = x.chest, own = wshOwned(o.t, o.id), price = WSH_PRICE[rar];
      const ico = o.t === 'skin' ? `<span class="${swClass(x)}" style="${swatch(x)};width:52px;height:52px">${headIcon(x)}</span>` : thumbImg(o.t === 'deco' ? 'deco' : o.t, o.id);
      const kind = o.t === 'skin' ? 'скин' : o.t === 'fx' ? 'эффект' : o.t === 'pet' ? 'питомец' : (x.kind === 'frame' ? 'рамка' : x.kind === 'title' ? 'титул' : 'украшение');
      return `<div class="wsh-card" style="--rc:${RARITY[rar].color}" data-info="${o.t}:${o.id}" tabindex="0" role="button" aria-label="${escHtml(x.name)} — посмотреть"><span class="wsh-ico">${ico}</span><b>${escHtml(x.name)}</b><small>${kind} · <span style="color:${RARITY[rar].color}">${RARITY[rar].name}</span></small>` +
        (own ? '<button class="buy sel" disabled>Куплено</button>' : `<button class="buy" data-wsh="${i}" ${save.coins >= price ? '' : 'disabled'}>${price.toLocaleString('ru-RU')} ◆</button>`) + '<em aria-hidden="true">👁</em></div>'; };
    return `<p class="empty-note">Предметы, которые обычно выпадают только из сундуков. Своя витрина у каждого игрока: здесь только то, чего у тебя ещё нет. Обновится через ${days} дн.</p>` +
      (W.items.length ? `<div class="wsh-grid">${W.items.map(card).join('')}</div>` : '<p class="empty-note">🎉 У тебя уже есть все предметы из сундуков — витрине нечего предложить.</p>') +
      `<div class="wsh-foot">${W.re ? '<small>Витрину уже обновляли на этой неделе.</small>' : `<button class="btn ghost" type="button" data-wshre="1" ${save.coins >= WSH_REFRESH ? '' : 'disabled'}>🔄 Обновить витрину сейчас · ${WSH_REFRESH.toLocaleString('ru-RU')} ◆</button><small>Один раз в неделю.</small>`}</div>` +
      `<ul class="quests arch-odds">${Object.entries(WSH_PRICE).map(([r, p]) => `<li><span><b style="color:${RARITY[r].color}">${RARITY[r].name}</b></span><span class="rw">${p.toLocaleString('ru-RU')} ◆</span></li>`).join('')}</ul><small class="wsh-note">Легендарный предмет появляется на витрине не чаще раза в 4 недели.</small>`;
  }
  function renderShop() {
    renderAll();
    const lv = playerLevel(), view = SHOP_VIEWS[shopView];
    $('shopTitle').textContent = view.title;
    $('shopTabs').hidden = view.tabs.length < 2;
    if (view.groups) {
      const g = view.groups.find(([, ids]) => ids.includes(shopTab)) || view.groups[0];
      const ico = id => view === SHOP_VIEWS.shop ? tabIcon(id) : '';
      $('shopTabs').innerHTML = `<div class="tab-groups">${view.groups.map(([name, ids]) => `<button class="tab tab-g" role="tab" data-tab="${ids[0]}" aria-selected="${ids.includes(shopTab)}">${ico(ids[0])}${name}</button>`).join('')}</div>` +
        (g[1].length > 1 ? `<div class="tab-sub">${g[1].map(id => `<button class="tab" role="tab" data-tab="${id}" aria-selected="${shopTab === id}">${ico(id)}${view.tabs.find(t => t[0] === id)[1]}</button>`).join('')}</div>` : '');
    } else
    $('shopTabs').innerHTML = view === SHOP_VIEWS.wardrobe   // 2.7: four tabs in one row, with icons
      ? `<div class="ward-tabs">${view.tabs.map(([id, name]) => `<button class="tab gtab" role="tab" data-tab="${id}" aria-selected="${shopTab === id}">${hubLogoSVG(({ wskin: 'skin', wfx: 'fx', wdeco: 'deco', warena: 'arena' })[id], 22).replace('class="hub-logo"', 'class="tab-ico"')}<b>${name}</b></button>`).join('')}</div>`
      : view === SHOP_VIEWS.goals
      ? `<div class="goal-tabs4">${view.tabs.map(([id, name]) => { const [d, n] = goalCount(id); return `<button class="tab gtab" role="tab" data-tab="${id}" aria-selected="${shopTab === id}" style="--hc:${HUB_ICON['g_' + id][0]}">${hubLogoSVG('g_' + id, 30).replace('class="hub-logo"', 'class="tab-ico"')}<span><b>${name}</b><small>${d}/${n}</small></span></button>`; }).join('')}</div>`
      : view.tabs.map(([id, name]) => `<button class="tab" role="tab" data-tab="${id}" aria-selected="${shopTab === id}">${name}</button>`).join('');
    if (shopTab === 'wshow') {
      $('shop').innerHTML = wshHtml();
    } else if (shopTab === 'skin') {
      const list = SKINS.filter(k => buyable(k) && !save.skins.includes(k.id));
      $('shop').innerHTML = list.length ? `<div class="skins">${list.map(k => skinTile(k, 'buy')).join('')}</div>`
        : '<p class="empty-note">Все скины магазина уже твои.</p>';
    } else if (shopTab === 'fx') {
      const html = FX_SLOTS.map(([slot, title]) => {
        const list = FX.filter(f => f.slot === slot && buyable(f) && !save.fxOwned.includes(f.id));
        return list.length ? `<h3>${title}</h3>` + list.map(f => fxRow(f, 'buy')).join('') : '';
      }).join('');
      $('shop').innerHTML = html || '<p class="empty-note">Все эффекты магазина уже твои.</p>';
    } else if (shopTab === 'wskin') {
      const own = sortOwned(SKINS.filter(k => save.skins.includes(k.id)), save.skins, 'wskin');
      $('shop').innerHTML = sortBar('wskin') + `<p class="empty-note">Собрано ${own.length} из ${SKINS.filter(k => !k.old || save.skins.includes(k.id)).length}. Выбери группу.</p>` +
        groupDrawers('ws_', own, sourceOf, ['Магазин', ...SOURCE_ORDER], part => `<div class="skins">${part.map(k => skinTile(k, 'own')).join('')}</div>`);
    } else if (shopTab === 'wfx') {
      const ownAll = sortOwned(FX.filter(f => save.fxOwned.includes(f.id)), save.fxOwned, 'wfx');
      $('shop').innerHTML = sortBar('wfx') + `<p class="empty-note">Собрано ${ownAll.length} из ${FX.length}.</p>` +
        (ownAll.length ? FX_SLOTS.map(([slot, title]) => {
          const list = ownAll.filter(f => f.slot === slot);
          return list.length ? drawer('wf_' + slot, `${title} <small class="cnt">${list.length}${save.fx[slot] ? ' · надет: ' + (FX.find(f => f.id === save.fx[slot]) || {}).name : ''}</small>`, list.map(f => fxRow(f, 'own')).join('')) : '';
        }).join('') : '<p class="empty-note">Пока пусто: купи эффект в магазине или открой сундук.</p>');
    } else if (shopTab === 'wpet') {
      const own = sortOwned(save.pets.map(petById).filter(Boolean), save.pets, 'wpet');
      $('shop').innerHTML = sortBar('wpet') + `<p class="empty-note">Собрано ${own.length} из ${PETS.length}.</p>` +
        (own.length ? groupDrawers('wp_', own, PET_SRC, PET_ORDER, part => part.map(pt => { const sel = save.pet === pt.id;
          return `<div class="fxrow ex" data-info="pet:${pt.id}" tabindex="0" role="button" aria-label="Подробнее: ${pt.name}"><span class="ico thumb">${thumbImg('pet', pt.id)}</span><span class="name">${pt.name} <span class="badge-ex">${pt.tier}</span>${save.archived && save.archived.includes(pt.id) ? ' <span class="badge-ex" style="color:#9fd8ff">из архива</span>' : ''}</span>` +
            `<span class="desc">${PET_SPECIES[pt.species]} · ${PET_BONUS[pt.bonus].name}: ${PET_BONUS[pt.bonus].text(pt.lv)}</span>` +
            `<button class="buy ${sel ? 'sel' : ''}" id="pet-${pt.id}" data-pet="${pt.id}">${sel ? 'Убрать' : 'Взять'}</button></div>`; }).join(''))
          : '<p class="empty-note">Пока пусто: дойди до лиги «Платина» в любом сезоне.</p>');
    } else if (shopTab === 'pcat') {
      // 2.7: one card per source in a grid (seasons ahead, chests, the workshop, holidays, legends, the raid), pets as small tiles
      const pwPet = (pt, note) => { const own = save.pets.includes(pt.id);
        return `<div class="pw-pet${own ? ' own' : ''}" data-info="pet:${pt.id}" tabindex="0" role="button" aria-label="Подробнее: ${pt.name}"><span class="ico thumb">${thumbImg('pet', pt.id)}</span>` +
          `<b>${pt.name}</b><small>${own ? '✓ есть' : note}</small></div>`; };
      const sec = (title, pets, note, extra = '') => !pets.length ? '' : `<section class="pw-sec"><h3>${title} <small>${pets.filter(pt => save.pets.includes(pt.id)).length}/${pets.length}</small></h3>${extra}<div class="pw-list">${pets.map(pt => pwPet(pt, typeof note === 'function' ? note(pt) : note)).join('')}</div></section>`;
      const seasons = [0, 1, 2, 3, 4, 5].map(k => save.season.id + k).map(id => { const sd = seasonData(id), hk = sd.holiday;
        return sec(`📅 Сезон ${id} · ${sd.name}${id === save.season.id ? ' · идёт' : ''}`, sd.pets, pt => `лига «${lgView(sd.pets.indexOf(pt) ? 5 : 3, hk).name}»`); }).join('');
      const by = f => PETS.filter(f);
      $('shop').innerHTML = '<div class="pw-grid">' + seasons +
        sec('🎁 Из сундуков', by(pt => pt.chest || pt.lchest), pt => pt.lchest ? 'сундук лиги' : `сундук · ${RARITY[pt.chest].name.toLowerCase()}`) +
        sec('🛠 Мастерская', by(pt => pt.craft), 'создаётся из осколков') +
        sec('🎉 Праздники', by(pt => pt.holiday), 'в праздничный сезон') +
        sec('👑 Легендарные', by(pt => pt.legend), 'легендарное достижение') +
        sec('⚔ Босс-рейд', by(pt => pt.raid), '5 побед над боссом недели') + '</div>';
    } else if (shopTab === 'arena' || shopTab === 'warena') {
      const shop = shopTab === 'arena', list = ARENAS.filter(a => shop ? a.id !== 'default' && !save.arenas.includes(a.id) : a.id === 'default' || save.arenas.includes(a.id)).sort((x, y) => (x.price || 1e9) - (y.price || 1e9));
      $('shop').innerHTML = (list.length ? list.map(a => {
          const sel = save.arena === a.id, lvOk = playerLevel() >= (a.lvl || 1), can = save.coins >= a.price && lvOk;
          const btn = shop && !a.price ? '<button class="buy" disabled>🔒</button>' : shop ? `<button class="buy" id="arena-${a.id}" data-arena="${a.id}" ${can ? '' : 'disabled'}>${lvOk ? `${a.price} ◆` : `С ур. ${a.lvl}`}</button>` : `<button class="buy ${sel ? 'sel' : ''}" id="arena-${a.id}" data-arena="${a.id}" ${sel ? 'disabled' : ''}>${sel ? 'Выбрана' : 'Выбрать'}</button>`;
          return `<div class="fxrow${a.exclusive ? ' ex' : ''}"${shop ? '' : ` data-info="arena:${a.id}" tabindex="0" role="button" aria-label="Подробнее: ${a.name}"`}><span class="ico"><span class="arena-pv" style="--fl:${a.floor};--gr:${a.grid};--rm:${a.rim}"></span></span><span class="name">${a.name}${a.exclusive ? ' <span class="badge-ex badge-legend">эксклюзив</span>' : ''}</span><span class="desc">${a.desc}.<br><span class="now">Особенность: ${ARENA_FX[a.id] || '—'}</span>${shop && !a.price ? `<br>Как получить: ${a.legend ? `легендарное достижение «${LEGEND.find(l => l.id === a.legend).name}»` : a.src}` : ''}</span>${btn}<button class="apv-link" id="apv-${a.id}" data-apv="${a.id}" style="--rm:${a.rim}">👁 Посмотреть арену</button></div>`;
        }).join('') : '<p class="empty-note">Все темы арены уже твои.</p>');
    } else if (shopTab === 'wdeco') {
      const row = (ico, name, desc, attr, on, label, info) => `<div class="fxrow"${info ? ` data-info="${info}" tabindex="0" role="button" aria-label="Подробнее: ${String(name).replace(/<[^>]*>/g, '').replace(/"/g, '&quot;')}"` : ''}><span class="ico">${ico}</span><span class="name">${name}</span><span class="desc">${desc}</span><button class="buy ${on ? 'sel' : ''}" ${attr}>${label}</button></div>`;
      const hats = Object.keys(HATS).map(h => { const own = save.hats.includes(h), col = COLLECTIONS.find(c => c.hat === h), on = save.hat === h;
        return own ? row(`<span class="hat-ico">${hatIcon(h)}</span>`, HATS[h].name, 'Надевается на любой скин вместо его предмета или короны.', `id="hat-${h}" data-hat="${h}"`, on, on ? 'Снять' : 'Надеть', 'hat:' + h)
                   : row(`<span class="hat-ico off">${hatIcon(h)}</span>`, HATS[h].name, col ? `Награда за коллекцию «${col.name}».` : `Награда: ${HATS[h].src}.`, 'disabled', false, 'Нет', 'hat:' + h); }).join('');
      const decoRows = kind => { const own = DECOR.filter(d => d.kind === kind && save.decor.includes(d.id)).sort((x, y) => RAR_ORDER[decoRarity(x)] - RAR_ORDER[decoRarity(y)] || x.name.localeCompare(y.name, 'ru'));
        return own.length ? own.map(d => { const on = (kind === 'frame' ? save.frame : save.title) === d.id;
          return row(d.kind === 'frame' ? `<span ${frameAttr(d.id)}>Аа</span>` : `<span class="tt-ico ttl ${d.cls || ''}" style="color:${d.color};border-color:${d.color};--a:${d.a};--b:${d.b}">${d.ico || 'Аа'}</span>`, `${d.name} <span class="badge-r" style="color:${RARITY[decoRarity(d)].color}">${RARITY[decoRarity(d)].name}</span>`, decoSource(d), `id="deco-${d.id}" data-deco="${d.id}"`, on, on ? 'Снять' : 'Выбрать', 'deco:' + d.id); }).join('')
          : `<p class="empty-note">Пока нет. ${kind === 'frame' ? 'Рамки выпадают из сундуков, даются за лигу и мастерство режимов' : 'Титулы выпадают из сундуков, даются за лигу, коллекции эффектов и мастерство режимов'}.</p>`; };
      const cntOf = k => `${DECOR.filter(d => d.kind === k && save.decor.includes(d.id)).length}/${DECOR.filter(d => d.kind === k && ((!d.promo && !d.old) || save.decor.includes(d.id))).length}`;
      $('shop').innerHTML = drawer('wd_hat', `Над головой <small class="cnt">${save.hats.length}/${Object.keys(HATS).length}${save.hat ? ' · надет: ' + HATS[save.hat].name : ''}</small>`, hats) +
        drawer('wd_frame', `Рамки <small class="cnt">${cntOf('frame')}${save.frame ? ' · выбрана: ' + decorById(save.frame).name : ''}</small>`, decoRows('frame')) +
        drawer('wd_title', `Титулы <small class="cnt">${cntOf('title')}${save.title ? ' · выбран: ' + decorById(save.title).name : ''}</small>`, decoRows('title'));
    } else if (shopTab === 'wcol') {
      const colCard = c => {
        const items = colItems(c), have = colOwned(c), full = have === items.length, got = save.colDone.includes(c.id);
        const chips = colList(c).map(([t, id]) => { const own = ownedList(t).includes(id);
          if (t === 'skin') { const k = SKINS.find(x => x.id === id); return `<span class="col-sw ${own ? '' : 'off'}" title="${k.name}" style="${swatch(k)}" data-info="skin:${id}" tabindex="0" role="button"></span>`; }
          if (t === 'abil') { const a = abilById(id); return `<span class="col-sw ab ${own ? '' : 'off'}" title="${a.name}" style="--ac:${a.color}">${a.icon}</span>`; }
          if (t === 'deco') { const d = decorById(id); return `<span class="col-sw ab ${own ? '' : 'off'}" title="${d.name}" style="--ac:${d.color || '#ff4fd8'}">${d.kind === 'frame' ? '▢' : 'Аа'}</span>`; }
          if (t === 'badge') return `<span class="col-sw ab ${own ? '' : 'off'}" title="Особый значок" style="--ac:#ff4fd8">★</span>`;
          if (t === 'look') return '';
          const it = t === 'pet' ? petById(id) : FX.find(x => x.id === id); return `<span class="col-sw fx ${own ? '' : 'off'}" title="${it.name}" data-info="${t}:${id}" tabindex="0" role="button">${thumbImg(t, id)}</span>`; }).join('');
        const names = c.fx ? `<small class="col-names">${items.map(id => FX.find(x => x.id === id).name).join(' · ')}</small>` : c.looks ? `<div class="look-sets">${ABILITIES.map(a => { const ls = [0, 1, 2].map(k => lookOf(a, k)), n = ls.filter(l => save.abil.looks.includes(l.id)).length;
          return `<span class="${n === 3 ? 'full' : ''}" style="--ac:${a.color}" title="${a.name}"><i>${a.icon}</i>${ls.map(l => `<em style="background:${save.abil.looks.includes(l.id) ? l.c : 'transparent'};border-color:${l.c}" title="${l.name}"></em>`).join('')}${n === 3 ? '<b>✓</b>' : ''}</span>`; }).join('')}</div><small class="col-names">✓ — набор из 3 обликов собран</small>` : '';
        const rwRef = c.hat ? 'hat:' + c.hat : c.frame ? 'deco:' + c.frame : c.title ? 'deco:' + c.title : '';
        const reward0 = c.hat ? `<span class="hat-ico sm">${hatIcon(c.hat)}</span> ${HATS[c.hat].name}` : [c.title && `титул ${titleTag(c.title)}`, c.frame && `рамка <span ${frameAttr(c.frame)}>Ты</span>`].filter(Boolean).join(' + ');
        const reward = rwRef ? `<span class="rwb" data-info="${rwRef}" tabindex="0" role="button" aria-label="Посмотреть награду">${reward0}${c.coins ? ` + ${c.coins} ◆` : ''}<em aria-hidden="true">👁</em></span>` : `${reward0}${c.coins ? ` + ${c.coins} ◆` : ''}`;
        const miss = !got && !full ? (n => n ? `<small class="col-miss">не хватает: ${n} — нажми на тусклый, чтобы узнать, где взять</small>` : '')(items.length - have) : '';
        return `<div class="chal ${got ? 'done' : ''}"><div class="chal-top"><b>${got ? '✓ ' : ''}${c.name}</b><span>${have} / ${items.length}</span></div>` +
          `<div class="col-row">${chips}</div>${names}<div class="track"><div class="fill" style="width:${(have / items.length * 100).toFixed(0)}%"></div></div>` +
          miss + `<div class="col-foot"><span class="rw">${reward}</span>` +
          (got ? '<span class="rw" style="color:var(--prey)">получено</span>' : `<button class="buy" id="col-${c.id}" data-col="${c.id}" ${full ? '' : 'disabled'}>${full ? 'Забрать' : 'Не собрано'}</button>`) + '</div></div>';
      };
      // 2.7: four tabs — skins, effects, league & chaos, special (pets, abilities, holidays)
      const CT = [['skin', 'Скины', c => !!c.skins, 'Наборы скинов', 'Собери все скины набора — получишь предмет над головой и монеты'],
        ['fx', 'Эффекты', c => !!c.fx, 'Наборы эффектов', 'Собери все эффекты набора — получишь монеты'],
        ['league', 'Лига и Хаос', c => ['league', 'seasons', 'chaos'].includes(c.group), 'Лига и Хаос-лига', 'Награды сезонов, Хаос-арсенал и ветераны Хаоса'],
        ['special', 'Особые', c => ['pets', 'abil', 'holiday'].includes(c.group), 'Особые наборы', 'Питомцы, способности и праздники']];
      const cur = CT.find(t => t[0] === (save.settings.colTab || 'skin')) || CT[0];
      const cnt = f => { const L = COLLECTIONS.filter(f); return [L.filter(c => save.colDone.includes(c.id)).length, L.length]; };
      const list = COLLECTIONS.filter(cur[2]), [cd, cn] = cnt(cur[2]), coins = list.filter(c => save.colDone.includes(c.id)).reduce((t, c) => t + (c.coins || 0), 0), ready = list.filter(c => !save.colDone.includes(c.id) && colOwned(c) === colItems(c).length).length;
      $('shop').innerHTML = `<div class="goal-tabs4 col-tabs" role="tablist">${CT.map(([k, name, f]) => { const [d, n] = cnt(f); return `<button type="button" class="tab gtab" role="tab" data-coltab="${k}" aria-selected="${k === cur[0]}" style="--hc:${HUB_ICON['c_' + k][0]}">${hubLogoSVG('c_' + k, 30).replace('class="hub-logo"', 'class="tab-ico"')}<span><b>${name}</b><small>${d}/${n}</small></span></button>`; }).join('')}</div>` +
        `<div class="g-sum" style="--hc:${HUB_ICON['c_' + cur[0]][0]}">${hubLogoSVG('c_' + cur[0], 44)}<div><b>${cur[3]} · ${cd} из ${cn}</b><small>${cur[4]}. ${[ready ? `<b style="color:#3dffa2">Можно забрать: ${ready}</b>` : '', coins ? `получено ${coins.toLocaleString('ru-RU')} ◆` : ''].filter(Boolean).join(' · ')}</small><div class="track"><div class="fill" style="width:${cn ? (cd / cn * 100).toFixed(0) : 0}%"></div></div></div></div>` +
        (list.length ? goalGroups(list.map(c => { const n = colItems(c).length, h = colOwned(c), got = save.colDone.includes(c.id); return { done: got, pct: n ? h / n : 0, html: colCard(c) }; }), 'Почти собрано', 'В процессе', 'Собрано')
          : '<p class="empty-note">Праздничные наборы появятся с первым праздничным сезоном.</p>');
    } else if (shopTab === 'ch') {
      const [cd, cn] = goalCount('ch');
      $('shop').innerHTML = `<div class="g-sum" style="--hc:${HUB_ICON.g_ch[0]}">${hubLogoSVG('g_ch', 44)}<div><b>Испытания · ${cd} из ${cn}</b><small>Большие цели на всё время игры: прогресс копится между раундами. Награда — предмет, нажми 👁, чтобы посмотреть.</small><div class="track"><div class="fill" style="width:${(cd / cn * 100).toFixed(0)}%"></div></div></div></div>` +
        goalGroups(CHALLENGES.map(ch => {
          const done = save.chDone.includes(ch.id), v = Math.min(ch.goal, ch.prog());
          const shown = ch.time ? `${fmtTime(v)} / ${fmtTime(ch.goal)}` : `${Math.floor(v)} / ${ch.goal}`;
          return { done, pct: v / ch.goal, html: `<div class="chal ${done ? 'done' : ''}"><div class="chal-top"><b>${done ? '✓ ' : ''}${ch.name}</b><span>${shown}</span></div>` +
            `<small>${ch.desc}</small><div class="track"><div class="fill" style="width:${(v / ch.goal * 100).toFixed(0)}%"></div></div>` +
            `<div class="col-foot">${rewardChip(ch.reward, `${done ? '✓ ' : ''}${rewardName(ch.reward)}`)}</div></div>` };
        }));
    } else if (shopTab === 'archive') {
      const lv = playerLevel();
      const icon = o => o.kind === 'skin' ? (k => `<span class="${swClass(k)}" style="${swatch(k)};width:44px;height:44px">${headIcon(k)}</span>`)(SKINS.find(x => x.id === o.id)) : thumbImg(o.kind, o.id);
      // the nearest season (from the current one) that still has something you don't own; up to two years ahead
      let nid = seasonNow; while (nid < seasonNow + 60 && !seasonOffers(nid).some(o => !ownsOffer(o))) nid++;
      const nd = seasonData(nid), nDate = fmtDate(seasonEnd(nid)), nOffers = seasonOffers(nid).filter(o => !ownsOffer(o));
      const preview = !nOffers.length ? '<p class="empty-note">У тебя есть все сезонные награды игры — новых поступлений в архив не будет.</p>'
        : `<h3>Пополнение ${nDate}</h3><p class="empty-note">${nid === seasonNow ? `Когда закончится сезон ${nid}` : `Ближайшие новые награды — после сезона ${nid}`} «${nd.name}». В архив попадут:</p>` +
        nOffers.map(o => `<div class="fxrow"><span class="ico thumb">${icon(o)}</span><span class="name">${offerName(o)}</span><span class="desc">${offerKind(o)} · будет стоить ${o.price} ◆</span><span class="rw" style="grid-column:3;grid-row:1/span 2;font-size:.78rem;color:var(--muted)">${nDate}</span></div>`).join('');
      if (lv < ARCHIVE_LVL) {
        $('shop').innerHTML = `<p class="empty-note">🔒 Архив сезонов откроется на ${ARCHIVE_LVL}-м уровне (сейчас ${lv}-й). В нём за монеты можно получить награды сезонов, которые ты пропустил.</p>`;
      } else if (!seasonStarted || seasonNow === 1) {
        $('shop').innerHTML = `<p class="empty-note">Архив пока пуст: у тебя ещё не закончился ни один сезон. Здесь будут награды прошедших сезонов, которые ты не успел получить в лиге.</p>` + (nOffers.length ? preview : '');   // 2.7: an empty archive no longer also says «у тебя есть все награды»
      } else {
        const all = archiveOffers(), show = archiveShowcase(), days = Math.max(1, Math.ceil(((raidWeek() + 1) * 7 - 3) - Date.now() / 864e5));
        const left = archBuysLeft(), tok = save.archTok || 0;
        const card = o => { const own = ownsOffer(o), t = ARCH_TOK[o.rar], can = save.coins >= o.price && tok >= t && left > 0;
          return `<div class="fxrow ex"><span class="ico thumb">${icon(o)}</span><span class="name">${offerName(o)} <span class="badge-ex">${offerKind(o)}</span> <span class="badge-r" style="color:${RARITY[archRarity(o)].color}">${RARITY[archRarity(o)].name}</span></span><span class="desc">из сезона «${o.from}»</span>` +
            (own ? '<button class="buy sel" disabled>Куплено</button>' : `<button class="buy" id="arch-${o.id}" data-arch="${o.id}" ${can ? '' : 'disabled'}>${o.price} ◆ + ${t} 🎟</button>`) + '</div>'; };
        $('shop').innerHTML = all.length
          ? `<div class="arch-tok"><span>🎟 Жетоны архива: <b>${tok}</b> из ${ARCH_TOK_CAP}</span><span>Покупок на этой неделе: <b>${ARCH_WEEK_LIMIT - left} из ${ARCH_WEEK_LIMIT}</b></span><small>Жетоны дают за каждый сезон лиги, в котором ты набрал очки (1–4 по итоговой лиге), за сезон Хаос-лиги (1) и за все задания недели (1).</small></div>` +
            `<p class="empty-note">Награды прошедших сезонов, которых у тебя нет: ${all.length}. Витрина обновится через ${days} дн.</p><h3>Витрина недели</h3>` + show.map(card).join('') +
            '<h3>Цены по редкости</h3><ul class="quests arch-odds">' + ['common', 'rare', 'epic', 'legendary'].map(r => `<li><span><b style="color:${RARITY[r].color}">${RARITY[r].name}</b> · ${({ common: 'праздничные предметы низших лиг', rare: 'питомцы «Платины», праздничные «Золото»/«Платина»', epic: 'скины «Алмаза», питомцы «Неона»', legendary: 'эффекты «Неона», главный праздничный скин' })[r]}</span><span class="rw">${ARCH_PRICE[r].toLocaleString('ru-RU')} ◆</span></li>`).join('') + '</ul>'
          : `<p class="empty-note">🎉 Ты собрал весь архив: у тебя есть все награды прошедших сезонов.</p>` + preview;
      }
    } else if (shopTab === 'week') {
      const W = weeklyState(), days = Math.max(1, Math.ceil(((W.week + 1) * 7 - 3) - Date.now() / 864e5));
      const TIER = { easy: 'Лёгкое', mid: 'Среднее', hard: 'Сложное' };
      $('shop').innerHTML = `<p class="empty-note">До обновления: ${days} дн.</p>` +
        weeklyTasks(W.week).map(t => { const v = Math.min(t.n, W.prog[t.id] || 0), ok = W.done.includes(t.id), R = RARITY[WEEK_RAR[t.tier]];
          return `<div class="chal ${ok ? 'done' : ''}"><div class="chal-top"><b>${ok ? '✓ ' : ''}${t.text(t.n)}</b><span>${v.toLocaleString('ru-RU')} / ${t.n.toLocaleString('ru-RU')}</span></div>` +
            `<small>${TIER[t.tier]} задание</small><div class="track"><div class="fill" style="width:${(v / t.n * 100).toFixed(0)}%"></div></div>` +
            `<span class="rw" style="color:${R.color}">${ok ? 'Выполнено' : 'Идёт к общей награде недели'}</span></div>`; }).join('') +
        `<div class="chal ${W.bonus ? 'done' : ''}"><div class="chal-top"><b>${W.bonus ? '✓ ' : ''}Все три задания</b><span>${W.done.length} / 3</span></div><span class="rw">Награда: сундук «${RARITY[WEEK_CHEST].name}», +${WEEK_BONUS} ◆ и жетон архива 🎟</span></div>`;
    } else if (shopTab === 'skill') {
      const vir = SKINS.find(k => k.id === 'sk_virtuoso'), done = save.skillDone.length;
      const fmtB = k => { const v = save.skillBest[k.id]; return v === undefined ? '' : `Лучшее: ${k.unit === 'с' ? fmtTime(v) : `${v.toLocaleString('ru-RU')} ${k.unit}`}`; };
      $('shop').innerHTML = `<div class="legend-head skill-head"><span class="legend-pics"><span class="legend-pic"><span class="${swClass(vir)}" style="${swatch(vir)}"></span></span><span class="legend-pic"><span ${frameAttr('fr_master')}>Ты</span></span></span>` +
        `<div><b>Мастерские · ${done} из ${SKILL.length}</b><small>Проверяют умение, а не время: всё нужно сделать за один раунд. Каждое даёт монеты; за 3, 6, 9 и 13 выполненных — титулы ${SKILL_TT.map(([n, id]) => titleTag(id)).join(' ')}.</small>` +
        `<small>За все — рамка «Мастер» и скин «Виртуоз»${save.decor.includes('fr_master') ? ' (получены)' : ''}.</small></div></div>` +
        goalGroups(SKILL.map(k => { const ok = save.skillDone.includes(k.id), b = fmtB(k);
          return { done: ok, pct: 0, html: `<div class="chal skill-card ${ok ? 'done' : ''}"><div class="chal-top"><b>${ok ? '✓ ' : '🎯 '}${k.name}</b><span>${ok ? 'выполнено' : b}</span></div><small>${k.desc}</small>` +
            `<small class="skill-hint">Подсказка: ${k.hint}</small>` +
            `<div class="col-foot"><span class="rw">+${k.coins} ◆</span>${ok && b ? `<span class="rw" style="color:var(--muted)">${b}</span>` : ''}</div></div>` }; }), '', 'Не выполнено');
    } else if (shopTab === 'legend') {
      const fmt = (L, v) => L.time ? `${Math.floor(v / 3600)} / ${L.goal / 3600} ч` : `${Math.min(v, L.goal).toLocaleString('ru-RU')} / ${L.goal.toLocaleString('ru-RU')}`;
      $('shop').innerHTML = `<div class="legend-head">${legendBadgeSVG(!!save.legendBadge)}<div><b>${save.legendBadge ? 'Ты — Легенда Капель!' : 'Значок «Легенда Капель»'}</b>` +
        `<small>${save.legendBadge ? 'Все легендарные достижения выполнены.' : `Выполни ${LEGEND_BASE.length} легендарных достижений (у «Грозы звёзд» и «Непобедимого» хватит первой ступени). Готово: ${LEGEND_BASE.filter(L => save.legendDone.includes(L.id)).length} из ${LEGEND_BASE.length}.`}</small>` +
        `<small>Прогресс считается с ${new Date(save.legend.since).toLocaleDateString('ru-RU')}. Каждое достижение даёт эксклюзивную награду, которую больше нигде не получить.</small></div></div>` +
        goalGroups(LEGEND.map(L => {
          const v = legendVal(L), done = save.legendDone.includes(L.id);
          const pics = rewardsOf(L).map(([t, id]) => t === 'badge' ? millionBadgeSVG(true, 40) : t === 'deco' && decorById(id).kind === 'title' ? titleTag(id) : t === 'skin' ? `<span class="${swClass(SKINS.find(k => k.id === id))}" style="${swatch(SKINS.find(k => k.id === id))}"></span>` : t === 'fx' ? thumbImg('fx', id) : t === 'pet' ? thumbImg('pet', id)
            : t === 'deco' ? `<span ${frameAttr(id)}>Ты</span>` : (a => `<span class="arena-pv" style="--fl:${a.floor};--gr:${a.grid};--rm:${a.rim}"></span>`)(ARENAS.find(a => a.id === id))).map((x, k) => { const r = rewardsOf(L)[k], info = r && ['skin', 'fx', 'deco', 'pet', 'arena'].includes(r[0]) ? ` data-info="${r[0]}:${r[1]}" tabindex="0" role="button" aria-label="Посмотреть награду"` : ''; return `<span class="legend-pic${info ? ' g-eye' : ''}"${info}>${x}</span>`; }).join('');
          return { done, pct: Math.min(1, v / L.goal), html: `<div class="chal legend-card ${done ? 'done' : ''}"><div class="chal-top"><b>${done ? '✓ ' : '👑 '}${L.name}</b><span>${fmt(L, v)}</span></div><small>${L.desc}</small>` +
            `<div class="track"><div class="fill" style="width:${Math.min(100, v / L.goal * 100).toFixed(1)}%"></div></div>` +
            `<div class="col-foot"><span class="legend-pics">${pics}</span><span class="rw">${legendNames(L)}${done ? ' — получено' : ''}</span></div></div>` };
        }), 'Ближе всего', 'Впереди');
    } else if (shopTab === 'ach') {
      const T = achTotals(), B = save.achBest || {}, lines = ACH.filter(a => a.line), hol = ACH.filter(a => a.hol);
      const cnt = [0, 0, 0, 0]; lines.forEach(a => { const t = achTier(a); for (let k = 1; k <= t; k++) cnt[k]++; });
      const card = a0 => {
        // one-off achievements (a holiday gift box) have no steps: shown as one step, done when the box was opened
        const a = a0.steps ? a0 : { ...a0, steps: [a0.desc] };
        const t = a0.steps ? achTier(a0) : (save.ach.includes(a0.id) || (a0.test && a0.test()) ? 1 : 0), n = a.steps.length, done = t >= n, v = ACH_VAL[a.id], m = achMetal(a, t);
        const val = v ? v[0](T, B) : null, goal = v && !done ? v[1][t] : null, prev = v && t ? v[1][t - 1] : 0;
        const pct = goal ? Math.max(0, Math.min(100, (val - prev) / (goal - prev) * 100)) : done ? 100 : 0;
        const steps = a.steps.map((st, k) => `<li class="${k < t ? 'on' : k === t ? 'next' : ''}"><i>${n <= 3 ? ROM3[k + 1] : k + 1}</i><span>${st}</span></li>`).join('');
        return `<div class="achc m${m}${done ? ' done' : ''}${a.hol ? ' hol' : ''}" style="--ac:${achArtOf(a)[0]}">${achEmblem(a, t, 62)}<div class="achc-b">` +
          `<div class="achc-h"><b>${a.name}</b><span class="achc-tier">${t ? (n <= 3 ? `${ROM3[t]} · ${METAL_NAME[m]}` : `${t} из ${n}`) : 'не начато'}</span></div><small class="achc-d">${a.desc}</small>` +
          `<ol class="achc-steps">${steps}</ol>` +
          (done ? `<div class="achc-f"><span>✓ Все ступени пройдены</span>${a.title ? titleTag(a.title) : ''}</div>`
            : `<div class="achc-bar"><i style="width:${pct.toFixed(1)}%"></i></div><div class="achc-f"><span>${goal ? `${Math.min(val, goal).toLocaleString('ru-RU')} / ${goal.toLocaleString('ru-RU')}` : `Дальше: ${a.steps[t]}`}</span><span class="rw">${a.pay ? `+${a.pay[t]} ◆` : 'праздничная коробка'}${a.title && t === n - 1 ? ` · титул ${titleTag(a.title)}` : ''}</span></div>`) + '</div></div>';
      };
      const holSeen = hol.filter(a => achTier(a) > 0), holNext = hol.filter(a => !achTier(a));
      $('shop').innerHTML = `<div class="ach-sum"><div><b>${lines.filter(a => achTier(a) >= 3).length}<small>/${lines.length}</small></b><span>линеек на золоте</span></div>` +
        [1, 2, 3].map(k => `<div class="m${k}">${achEmblem({ id: 'ln_star', steps: ['', '', ''] }, k, 34)}<span><b>${cnt[k]}</b> ${METAL_NAME[k].toLowerCase()}</span></div>`).join('') + '</div>' +
        goalGroups(lines.map(a => { const t = achTier(a), n = a.steps.length, v = ACH_VAL[a.id], T2 = T, val = v ? v[0](T2, B) : 0, goal = v && t < n ? v[1][t] : 0, prev = v && t ? v[1][t - 1] : 0;
          return { done: t >= n, pct: goal ? Math.min(1, Math.max(0, (val - prev) / (goal - prev))) : 0, html: card(a) }; })).replace(/class="g-grid"/g, 'class="g-grid achc-grid"') +
        (holSeen.length ? `<h3 class="ach-h">Праздники</h3><div class="achc-grid">${holSeen.map(card).join('')}</div>` : '') +
        `<details class="res-drawer ach-hol"><summary>Праздничные достижения впереди <small class="cnt">${holNext.length}</small></summary><div class="achc-grid">${holNext.map(card).join('')}</div></details>`;
    } else if (shopTab === 'abil') {
      $('shop').innerHTML = abilShopHtml(lv);
    } else if (shopTab === 'mab') {
      $('shop').innerHTML = myAbilHtml();
    } else {
      // 2.7: every upgrade on screen at once — tiles under short group titles (they used to hide in four drawers)
      $('shop').innerHTML = '<div class="up-grid">' + CATS.map(([title, ids]) => `<section class="up-sec"><h3 class="up-h">${drawerIcon(title)}${title} <small class="cnt">${ids.map(id => `${save.up[id]}/${UPG.find(u => u.id === id).cost.length}`).join(' · ')}</small></h3><div class="up-tiles">` + ids.map(id => UPG.find(u => u.id === id)).map(u => {
        const l = save.up[u.id], max = u.cost.length, price = u.cost[l], locked = lv < u.lvl;
        const pips = u.cost.map((_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('');
        const label = locked ? `С ур. ${u.lvl}` : l >= max ? 'Макс.' : `${price} ◆`;
        const dis = locked || l >= max || save.coins < price ? 'disabled' : '';
        return `<div class="up ${locked ? 'locked' : ''}"><span class="name">${u.name}</span><span class="desc">${u.desc}${u.info ? `<br><span class="now">Сейчас: ${u.info(l)}${l < max ? ` → дальше: ${u.info(l + 1)}` : ''}</span>` : ''}</span>
          <span class="pips">${pips}</span><button class="buy" id="buy-${u.id}" data-up="${u.id}" ${dis}>${label}</button></div>`;
      }).join('') + '</div></section>').join('') + '</div>';
    }
    const tName = (view.tabs.find(t => t[0] === shopTab) || [, view.title])[1];
    if (TAB_INFO[shopTab]) $('shop').insertAdjacentHTML('afterbegin', `<button class="tab-info-btn" id="tabInfoBtn" data-tabinfo="${shopTab}">ⓘ Информация · ${tName}</button>`);
  }
  // ---- «Способности»: build editor + list (buy / upgrade); dash and split upgrade through their old upgrade branches ----
  // ---- 2.3: icons for every drawer, matched by its title (the first match wins, so longer names go first) ----
  const DI = {
    chat: ICON_SVG.chat,
    sprout: '<path d="M12 21v-9M12 12c0-4 3-6.5 7-6.5 0 4-3 6.5-7 6.5zM12 14.5c0-3-2.5-5-6-5 0 3 2.5 5 6 5z"/>',
    bolt: '<path d="M13 2 4.5 14h6.5l-1 8 8.5-12H12z"/>',
    shield: '<path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z"/>',
    gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8.5h14V12M12 8v12.5M12 8c-1.8-4.2-6.3-4-6-1.3.2 1.3 2.5 1.3 6 1.3zM12 8c1.8-4.2 6.3-4 6-1.3-.2 1.3-2.5 1.3-6 1.3z"/>',
    shop: '<path d="M5 8h14l-1.2 12.5H6.2z"/><path d="M9 10.5V7a3 3 0 0 1 6 0v3.5"/>',
    chest: '<path d="M3 11h18v9H3zM3 11c0-3.5 4-6 9-6s9 2.5 9 6M10.5 13.5h3v3h-3z"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2"/>',
    skull: '<path d="M5 11a7 7 0 0 1 14 0v3.5l-2 1.2V19H7v-3.3l-2-1.2z"/><circle cx="9.2" cy="11.5" r="1.4"/><circle cx="14.8" cy="11.5" r="1.4"/><path d="M10.5 19v-2M13.5 19v-2"/>',
    calendar: '<rect x="4" y="5.5" width="16" height="15" rx="2"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/>',
    sparkle: '<path d="M12 3l1.8 5.6 5.7 1.9-5.7 1.9L12 18l-1.8-5.6-5.7-1.9 5.7-1.9zM19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z"/>',
    crown: '<path d="M3.5 8.5l4.5 4 4-7 4 7 4.5-4-2 10.5h-13z"/>',
    dna: '<path d="M7 2.5c0 5 10 5 10 9.5S7 17 7 21.5M17 2.5c0 5-10 5-10 9.5s10 5 10 9.5"/><path d="M8.6 5.5h6.8M10 8.3h4M10 15.7h4M8.6 18.5h6.8"/>',   // 2.7: skins with evolution
    star: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4l-5.3 3 1.2-6-4.5-4.1 6-.7z"/>',
    workshop: '<circle cx="9" cy="14" r="4.2"/><circle cx="9" cy="14" r="1.4"/><path d="M9 8.3v1.5M9 18.2v1.5M3.3 14h1.5M13.2 14h1.5M14.5 3.5l6 6-2 2-6-6zM15.5 8.5l-3.2 3.2"/>',
    cap: '<path d="M2 9l10-5 10 5-10 5zM6 11v5c3 2.2 9 2.2 12 0v-5M22 9v6"/>',
    chaos: '<path d="M12 12a2 2 0 1 1 2-2M14 10a4 4 0 1 1-4-4M10 6a6 6 0 1 1-6 6M4 12a8 8 0 1 1 8 8"/>',
    trail: '<path d="M3 16c3-5 5.5 1.5 8.5-3S17 13 21 8"/><circle cx="5" cy="19.5" r="1"/><circle cx="10" cy="19" r=".8"/><circle cx="20" cy="4.5" r="1.4"/>',
    aura: '<ellipse cx="12" cy="13" rx="9.5" ry="4"/><circle cx="12" cy="11" r="3.5"/><path d="M12 3v1.5M5 5.5l1 1M19 5.5l-1 1"/>',
    burst: '<path d="M12 2.5v5M12 16.5v5M2.5 12h5M16.5 12h5M5.3 5.3l3.5 3.5M15.2 15.2l3.5 3.5M5.3 18.7l3.5-3.5M15.2 8.8l3.5-3.5"/><circle cx="12" cy="12" r="1.6"/>',
    hat: '<path d="M3 18.5h18M6 18.5c0-4.5 1.5-9 6-9s6 4.5 6 9M9 9.5l1-5.5h4l1 5.5"/>',
    frame: '<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><circle cx="12" cy="11" r="3.2"/><path d="M7 18c1-2.5 3-3.5 5-3.5s4 1 5 3.5"/>',
    tag: '<path d="M3 12.5 12.5 3H20v7.5L10.5 20z"/><circle cx="16" cy="7" r="1.2"/>',
    image: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.5"/>',
    chatbg: '<path d="M3.5 5h17v11h-9l-5 4v-4h-3z"/><path d="M3.5 13l4-3.5 3 2.5 3.5-3.5 6.5 5.5"/><circle cx="15.5" cy="8.3" r="1.2"/>',
    smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14.2c1 1.8 2.4 2.6 4 2.6s3-.8 4-2.6"/><circle cx="9" cy="9.8" r=".9" fill="currentColor"/><circle cx="15" cy="9.8" r=".9" fill="currentColor"/>',
    drop: '<path d="M12 3c4 5 6.5 8 6.5 11.2a6.5 6.5 0 0 1-13 0C5.5 11 8 8 12 3z"/>',
    paw: '<circle cx="8" cy="8.5" r="1.8"/><circle cx="16" cy="8.5" r="1.8"/><circle cx="4.8" cy="13" r="1.6"/><circle cx="19.2" cy="13" r="1.6"/><path d="M12 12.5c3 0 5 3.2 5 5.2s-2 2.3-5 2.3-5-.3-5-2.3 2-5.2 5-5.2z"/>',
    crystal: '<path d="M12 2.5l6 6-6 13-6-13zM6 8.5h12M12 2.5v19"/>',
    pad: '<path d="M7 8h10a4.5 4.5 0 0 1 4 6.5l-1 2a2.5 2.5 0 0 1-4 .5L14.5 15h-5L8 17a2.5 2.5 0 0 1-4-.5l-1-2A4.5 4.5 0 0 1 7 8zM8 10.5v3.5M6.25 12.25h3.5"/><circle cx="15.5" cy="11.5" r=".8"/><circle cx="17.5" cy="13.2" r=".8"/>',
    rings: '<circle cx="9" cy="12" r="5.5"/><circle cx="15" cy="12" r="5.5"/>',
    planet: '<circle cx="12" cy="12" r="5"/><ellipse cx="12" cy="12" rx="10" ry="3.5" transform="rotate(-20 12 12)"/>',
    flag: '<path d="M5 21V3.5h12l-2.5 4 2.5 4H5"/>',
    robot: '<rect x="5" y="8" width="14" height="11" rx="3"/><circle cx="9.5" cy="13" r="1.3"/><circle cx="14.5" cy="13" r="1.3"/><path d="M12 8V4.5M10 16.5h4"/><circle cx="12" cy="3.5" r="1"/>',
    archive: '<path d="M3 4h18v4.5H3zM5 8.5V20h14V8.5M10 12.5h4"/>',
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M12 6.5 15.5 12 12 17.5 8.5 12z"/>',
    check: '<path d="M4 6.5l2 2 3.2-3.2M11.5 7H20M4 13.5l2 2 3.2-3.2M11.5 14H20M11.5 20H20"/>',
    medal: '<path d="M8 2.5l4 6.5 4-6.5"/><circle cx="12" cy="15" r="6"/><path d="M12 12v6M10 13.5l2-1.5"/>',
    palette: '<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-1.3-1-1.6-1-2.6 0-.9.7-1.4 1.6-1.4H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="14.5" cy="7" r="1"/>',
    bars: '<path d="M3 21h18M6 21v-8M11 21V5M16 21v-11M20.5 21v-5"/>',
    line: '<path d="M3 17l5-6 4 3 5-7 4 4M3 21h18"/>',
    hex: '<path d="M12 2.5l8.2 4.7v9.6L12 21.5l-8.2-4.7V7.2z"/><path d="M9 12l2 2 4-4"/>',
    trash: '<path d="M4 7h16M9.5 7V4h5v3M6 7l1 13.5h10L18 7M10 11v6M14 11v6"/>',
    flame: '<path d="M12 2.5c1 4 6 5.5 6 11.5a6 6 0 0 1-12 0c0-3 1.8-5 3-7 .2 2 1 3.2 2.2 3.4C11 7.8 11 5 12 2.5z"/>',
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20.5h8M12 16v4.5"/>',
    sound: '<path d="M4 9.5h3.5L13 5v14l-5.5-4.5H4zM16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11"/>',
    ticket: '<path d="M3 7.5a2.5 2.5 0 0 0 0 5v4h18v-4a2.5 2.5 0 0 1 0-5v-4H3zM14 3.5v13" stroke-dasharray="0"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  };
  const DRAWER_ICONS = [
    ['фоны чата', 'chatbg', '#ff6ad5'], ['арены', 'hub:arena'], ['эмоции', 'smile', '#ffd23f'],
    ['эволюция', 'dna', '#3dffa2'], ['обычные', 'palette', '#c9c2ff'], ['уровни', 'star', '#22e6ff'], ['коллекции', 'hub:col'], ['достижения', 'medal', '#3dffa2'], ['особые', 'ticket', '#ff4fd8'], ['архивные', 'hub:arch'], ['сундуки', 'hub:chest'], ['значки хаос', 'chaos', '#ff4fd8'], ['хаос', 'chaos', '#ff4fd8'], ['значки сезон', 'hex', '#ffd23f'], ['особые значки', 'hex', '#22e6ff'],
    ['мастерские достижения', 'medal', '#3dffa2'], ['легендарные достижения', 'crown', '#ffd23f'], ['праздничные достижения', 'gift', '#ff6ad5'],
    ['мастерство', 'medal', '#3dffa2'], ['мастерская', 'workshop', '#ffd27a'], ['все награды престижа', 'star', '#ffd23f'], ['престиж', 'star', '#ffd23f'],
    ['эффект поедания', 'burst', '#ff9a3d'], ['след', 'trail', '#22e6ff'], ['аура', 'aura', '#b26bff'],
    ['босс-рейд', 'skull', '#ff3d6e'], ['рейд', 'skull', '#ff3d6e'], ['боссы', 'skull', '#ff3d6e'], ['боты', 'robot', '#7fe8ff'],
    ['сундук', 'hub:chest'], ['из сундуков', 'hub:chest'], ['каких сколько', 'hub:chest'],
    ['над головой', 'hub:deco'], ['рамки', 'hub:p_frame'], ['титулы', 'hub:p_title'], ['фоны профиля', 'hub:p_bg'],
    ['скины', 'hub:skin'], ['эффекты', 'hub:fx'], ['питомц', 'hub:pet'], ['способност', 'hub:abil'],
    ['рост', 'sprout', '#3dffa2'], ['движение', 'bolt', '#ffd23f'], ['защита', 'shield', '#7fe8ff'], ['награды', 'gift', '#ff9a3d'],
    ['магазин', 'shop', '#22e6ff'], ['испытани', 'target', '#ff6ad5'], ['легенд', 'crown', '#ffd23f'], ['праздни', 'gift', '#ff6ad5'], ['обучение', 'cap', '#7fe8ff'],
    ['как играть', 'pad', '#22e6ff'], ['управление', 'pad', '#22e6ff'], ['цвета колец', 'rings', '#3dffa2'], ['арена', 'hub:arena'], ['режим', 'flag', '#ff6ad5'],
    ['лига', 'flag', '#ffd23f'], ['архив', 'hub:arch'], ['монеты', 'coin', '#ffd23f'], ['задания', 'check', '#3dffa2'], ['внешний вид', 'palette', '#ff4fd8'],
    ['статистика', 'bars', '#22e6ff'], ['последние раунды', 'line', '#22e6ff'], ['рекорды', 'flag', '#ffd23f'], ['сезон', 'calendar', '#ffd23f'],
    ['удалить аккаунт', 'trash', '#ff3d6e'], ['подробности', 'list', '#c9c2ff'], ['активность', 'flame', '#ff9a3d'], ['графика', 'monitor', '#22e6ff'], ['поддержка', 'chat', '#7fe8ff'], ['звук', 'sound', '#b26bff'], ['промокод', 'ticket', '#ffd23f'],
  ];
  function decorateDrawers(root = document) {
    root.querySelectorAll('details > summary:not([data-ic])').forEach(sm => {
      sm.dataset.ic = '1';
      const d = sm.parentElement; if (d.classList.contains('news-item') || d.dataset.dk && /^(ab_|wsp_)/.test(d.dataset.dk) || sm.querySelector('.ws-pk')) return;
      const first = sm.firstChild; if (!first) return;
      let label = (first.textContent || '').trim();
      const emoji = label.match(/^[^0-9A-Za-zА-Яа-яЁё«(]+/);   // old emoji prefixes are replaced by the drawn icon
      const key = label.replace(/^[^0-9A-Za-zА-Яа-яЁё«(]+/, '').toLowerCase(), hit = DRAWER_ICONS.find(([k]) => key.startsWith(k)) || DRAWER_ICONS.find(([k]) => k.length > 4 && key.includes(k)); if (!hit) return;
      if (emoji && first.nodeType === 3) first.textContent = first.textContent.replace(/^\s*[^0-9A-Za-zА-Яа-яЁё«(]+/, '');
      const wrap = document.createElement('span'); wrap.className = 'dr-lbl';
      // categories that already have a logo on the Collection buttons and shop tabs use the same drawing and colour
      const hub = hit[1].startsWith('hub:') && HUB_ICON[hit[1].slice(4)], art = hub ? hub[2] : DI[hit[1]], col = hub ? hub[0] : hit[2];
      wrap.innerHTML = `<i class="dr-ic" style="--ic:${col}" aria-hidden="true"><svg viewBox="0 0 24 24">${art}</svg></i>`;
      sm.insertBefore(wrap, first); wrap.appendChild(first);
    });
  }
  { let q = 0; new MutationObserver(() => { if (q) return; q = requestAnimationFrame(() => { q = 0; decorateDrawers(); }); }).observe(document.body, { childList: true, subtree: true }); requestAnimationFrame(() => decorateDrawers()); }
  // 2.7: the drawn icon of a group by its name (the same table as the drawers use)
  function drawerIcon(label) {
    const key = String(label).replace(/^[^0-9A-Za-zА-Яа-яЁё«(]+/, '').toLowerCase(), hit = DRAWER_ICONS.find(([k]) => key.startsWith(k)) || DRAWER_ICONS.find(([k]) => k.length > 4 && key.includes(k)); if (!hit) return '';
    const hub = hit[1].startsWith('hub:') && HUB_ICON[hit[1].slice(4)], art = hub ? hub[2] : DI[hit[1]], col = hub ? hub[0] : hit[2];
    return `<i class="dr-ic" style="--ic:${col}" aria-hidden="true"><svg viewBox="0 0 24 24">${art}</svg></i>`;
  }
  // 2.7: groups as one row of chips; only the chosen group is shown below — no stack of drawers to scroll through
  const catSel = {};
  function catChips(prefix, cats, cur) {
    return `<div class="cat-chips" role="tablist">${cats.map(([name, n, all]) => `<button type="button" role="tab" class="cat-chip" data-gcat="${prefix}|${escHtml(name)}" aria-selected="${name === cur}">${drawerIcon(name)}<span>${escHtml(name)}</span><small>${all !== undefined ? `${n}/${all}` : n}</small></button>`).join('')}</div>`;
  }
  function groupDrawers(prefix, list, keyOf, order, render) {
    const keys = [...new Set(list.map(keyOf))].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
    if (!keys.length) return '';
    const cur = keys.includes(catSel[prefix]) ? catSel[prefix] : keys[0];
    return catChips(prefix, keys.map(k => [k, list.filter(x => keyOf(x) === k).length]), cur) + render(list.filter(x => keyOf(x) === cur));
  }
  const PET_SRC = pt => pt.raid ? 'Рейд' : pt.craft ? 'Мастерская' : pt.legend ? 'Легендарные' : pt.lchest ? 'Из сундуков лиги' : pt.chest ? 'Из сундуков' : pt.holiday ? 'Праздничные' : 'Сезонные (лига)';
  const PET_ORDER = ['Сезонные (лига)', 'Праздничные', 'Из сундуков', 'Из сундуков лиги', 'Легендарные', 'Мастерская', 'Рейд'];
  function upRowHtml(u, lv) {
    const l = save.up[u.id], max = u.cost.length, price = u.cost[l], locked = lv < u.lvl;
    const pips = u.cost.map((_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('');
    const label = locked ? `С ур. ${u.lvl}` : l >= max ? 'Макс.' : `${price} ◆`;
    const dis = locked || l >= max || save.coins < price ? 'disabled' : '';
    return `<div class="up ${locked ? 'locked' : ''}"><span class="name">${u.name}</span><span class="desc">${u.desc}${u.info ? `<br><span class="now">Сейчас: ${u.info(l)}${l < max ? ` → дальше: ${u.info(l + 1)}` : ''}</span>` : ''}</span>
          <span class="pips">${pips}</span><button class="buy" id="buy-${u.id}" data-up="${u.id}" ${dis}>${label}</button></div>`;
  }
  function abStatLine(a, l) {
    const k = 1 + ABIL_CFG.powPerLv * l, parts = [];
    if (a.cd && a.cd > 1) parts.push(`перезарядка ${(a.cd * (1 - ABIL_CFG.cdPerLv * l)).toFixed(1).replace('.', ',')} с`);
    if (a.dur) parts.push(`действует ${(a.dur * (a.id === 'trap' ? 1 : k)).toFixed(1).replace('.', ',')} с`);
    if (a.radius) parts.push(`радиус ${Math.round(a.radius * k)}`);
    if (a.id === 'blink') parts.push(`дальность ${Math.round(a.dist * k)}`);
    if (a.id === 'eject') parts.push(`скорость выброса ×${k.toFixed(1).replace('.', ',')}`);
    if (a.id === 'push') parts.push(`сила ${Math.round(a.force * k)}`);
    return parts.join(' · ');
  }
  // drawers in the shop remember which ones are open between re-renders
  const openDrawers = new Set();
  const drawer = (key, summary, body) => `<details class="res-drawer shop-drawer" data-dk="${key}" ${openDrawers.has(key) ? 'open' : ''}><summary>${summary}</summary><div class="drawer-body">${body}</div></details>`;
  function buildSlotsHtml() {
    const own = save.abil.owned;
    return save.build.map((id, i) => {
      const a = id && abilById(id);
      const options = ABILITIES.filter(x => own.includes(x.id)).map(x => {
        const selected = x.id === id, used = !selected && save.build.includes(x.id);
        return `<button type="button" class="build-picker-option" role="option" aria-selected="${selected}" data-build-option="${i}" data-abil="${x.id}" ${used ? 'disabled' : ''}><span class="build-picker-option-icon" style="color:${x.color}">${x.icon}</span><span>${x.name}</span>${selected ? '<span aria-hidden="true">✓</span>' : ''}</button>`;
      }).join('');
      return `<div class="b-slot" style="--ac:${a ? a.color : 'var(--line)'}"><small>Слот ${i + 1} · ${ABIL_CFG.slotKeyName[i]}</small><span class="b-ico">${a ? a.icon : '＋'}</span>` +
        `<div class="build-picker"><button type="button" class="build-picker-trigger" data-picker-toggle="${i}" aria-label="Выбрать способность для слота ${i + 1}" aria-haspopup="listbox" aria-expanded="false" aria-controls="build-picker-list-${i}"><span class="build-picker-current">${a ? a.name : 'Выбрать способность'}</span><span class="build-picker-arrow" aria-hidden="true">⌄</span></button><div class="build-picker-menu" id="build-picker-list-${i}" role="listbox" aria-label="Способности для слота ${i + 1}" hidden><button type="button" class="build-picker-option" role="option" aria-selected="${!id}" data-build-option="${i}" data-abil=""><span class="build-picker-option-icon">＋</span><span>Пусто</span>${!id ? '<span aria-hidden="true">✓</span>' : ''}</button>${options}</div></div>` +
        (a && [0, 1, 2].some(k => save.abil.looks.includes(lookOf(a, k).id)) ? `<select data-look="${a.id}" aria-label="Облик: ${a.name}"><option value="">Стандартный облик</option>${[0, 1, 2].map(k => lookOf(a, k)).filter(l => save.abil.looks.includes(l.id)).map(l => `<option value="${l.id}" ${save.abil.lookOn[a.id] === l.id ? 'selected' : ''}>${l.name.split(': ')[1]}</option>`).join('')}</select>` : '') +
        `<button class="buy b-clear" data-slotclear="${i}" ${a ? '' : 'disabled'} aria-label="Очистить слот ${i + 1}" title="Очистить слот">✕</button></div>`;   // 2.7: a small ✕ in the corner instead of a full-width button
    }).join('');
  }
  const abLevelText = a => a.branches ? 'улучшения: ' + a.branches.map(id => { const u = UPG.find(x => x.id === id); return `«${u.name}» ${save.up[id]}/${u.cost.length}`; }).join(', ') : `уровень ${save.abil.lv[a.id] || 0}/${ABIL_CFG.levels}`;
  const abLooksText = a => { const n = [0, 1, 2].filter(k => save.abil.looks.includes(lookOf(a, k).id)).length; return n ? ` · обликов ${n}/3` : ''; };
  // «Коллекция → Способности»: the build + what you own, split into upgradable and not upgradable
  // 2.7: owned abilities as compact tiles in a grid (two lines of description, the full text on hover / long press)
  function myAbilHtml() {
    const own = save.abil.owned, row = (a, extra) => `<div class="ab-row own" style="--ac:${a.color}"><span class="ab-big">${a.icon}</span><div class="ab-txt"><b>${a.name}${save.build.includes(a.id) ? ' <span class="badge-ex">в билде</span>' : ''}</b><small class="ab-desc" title="${a.desc.replace(/"/g, '&quot;')}.">${a.desc}.</small><small class="now">${extra}</small></div></div>`;
    const up = BASE_ABIL.filter(a => own.includes(a.id)), fixed = XA_ABIL.filter(a => own.includes(a.id)), crafted = CR_ABIL.filter(a => own.includes(a.id));
    const lvNow = playerLevel(), chTile = c => { const lock = lvNow < c.lvl, on = save.char === c.id;
      return `<button type="button" class="ch-tile${on ? ' on' : ''}" data-char="${c.id}" ${lock ? 'disabled' : ''} style="--ac:${c.color}" aria-pressed="${on}"><span class="ch-ic">${c.icon}</span><b>${c.name}</b>${lock ? `<small class="ch-lock">🔒 с ${c.lvl} уровня</small>` : `<small class="ch-p">＋ ${c.plus}</small><small class="ch-m">− ${c.minus}</small>`}</button>`; };
    const charSec = `<h3>Характер капли · ${save.char ? charById(save.char)?.name : 'не выбран'}</h3><div class="ch-grid">${CHARS.map(chTile).join('')}<button type="button" class="ch-tile none${save.char ? '' : ' on'}" data-char="" aria-pressed="${!save.char}"><span class="ch-ic">○</span><b>Без характера</b><small class="ch-p">без плюсов и минусов</small></button></div>` +
      `<p class="empty-note">Действует в одиночных режимах. В лиге, Хаос-лиге, обучении и режимах для двоих — нет.</p>`;
    return `<h3>Билд · ${save.build.filter(Boolean).length} из ${ABIL_CFG.slots}</h3><div class="b-slots">${buildSlotsHtml()}</div>` +   /* 2.7 (owner): characters are picked before a round only, not in the collection */
      `<p class="empty-note">Билд меняется только здесь, между боями. В рейтинге и «Королевской битве» у всех рывок, деление и выброс.</p>` +
      `<h3>Улучшаемые · ${up.length} из ${BASE_ABIL.length}</h3>` + '<div class="ab-tiles">' + up.map(a => row(a, `${a.price ? 'куплена' : 'есть у всех'} · ${abLevelText(a)}${abLooksText(a)}`)).join('') + '</div>' +
      `<p class="empty-note">Улучшать — в «Магазине» → «Способности». Новые способности тоже там.</p>` +
      `<h3>Без улучшений · ${fixed.length} из ${XA_ABIL.length}</h3>` + (fixed.length ? '<div class="ab-tiles">' + fixed.map(a => row(a, `эксклюзив Хаос-лиги · перезарядка ${a.cd} с${abLooksText(a)}`)).join('') + '</div>'
        : '<p class="empty-note">Эксклюзивные способности даёт «Сингулярность» в Хаос-лиге — по одной за сезон.</p>') +
      `<h3>Из мастерской · ${crafted.length} из ${CR_ABIL.length}</h3>` + (crafted.length ? '<div class="ab-tiles">' + crafted.map(a => row(a, `создана из осколков · только обычные режимы · перезарядка ${a.cd} с`)).join('') + '</div>'
        : '<p class="empty-note">Эти способности создаются из осколков в «Мастерской» (плитка в главном меню).</p>');
  }
  // «Магазин → Способности»: buy new ones; upgrades of owned ones in drawers
  function abilShopHtml(lv) {
    const own = save.abil.owned;
    const toBuy = BASE_ABIL.filter(a => !own.includes(a.id)).map(a => `<div class="ab-row" style="--ac:${a.color}"><span class="ab-big">${a.icon}</span><div class="ab-txt"><b>${a.name}</b><small>${a.desc}.</small><small class="now">${abStatLine(a, 0)}</small></div>` +
      `<button class="buy" id="abuy-${a.id}" data-abuy="${a.id}" ${save.coins >= a.price ? '' : 'disabled'}>${a.price.toLocaleString('ru-RU')} ◆</button></div>`).join('');
    const ups = BASE_ABIL.filter(a => own.includes(a.id)).map(a => {
      let body;
      if (a.branches) body = a.branches.map(id => upRowHtml(UPG.find(u => u.id === id), lv)).join('');
      else {
        const l = save.abil.lv[a.id] || 0, max = l >= ABIL_CFG.levels, cost = abUpCost(a, l);
        const pips = Array.from({ length: ABIL_CFG.levels }, (_, i) => `<i class="${i < l ? 'on' : ''}"></i>`).join('');
        body = `<div class="ab-row own" style="--ac:${a.color}"><span class="ab-big">${a.icon}</span><div class="ab-txt"><small class="now">Сейчас: ${abStatLine(a, l)}${max ? '' : `<br>Дальше: ${abStatLine(a, l + 1)}`}</small><span class="pips">${pips}</span></div>` +
          `<button class="buy" id="aup-${a.id}" data-aup="${a.id}" ${max || save.coins < cost ? 'disabled' : ''}>${max ? 'Макс.' : `Улучшить · ${cost.toLocaleString('ru-RU')} ◆`}</button></div>`;
      }
      return drawer('ab_' + a.id, `<span style="color:${a.color}">${a.icon}</span> ${a.name} <small class="cnt">${abLevelText(a)}</small>`, body);
    }).join('');
    return (toBuy ? `<h3>Купить · куплено ${BASE_ABIL.length - BASE_ABIL.filter(a => !own.includes(a.id)).length} из ${BASE_ABIL.length}</h3>` + toBuy : '<p class="empty-note">Все способности куплены.</p>') +
      `<h3>Улучшения</h3>` + ups + `<p class="empty-note">Билд, купленные и полученные способности — в «Коллекция» → «Способности». Эксклюзивы Хаос-лиги не улучшаются.</p>`;
  }
  function checkAbilAch() { checkSteps(); }
  $('shop').addEventListener('toggle', e => { const d = e.target; if (d.matches && d.matches('details[data-dk]')) { if (d.open) openDrawers.add(d.dataset.dk); else openDrawers.delete(d.dataset.dk); } }, true);
  $('shop').addEventListener('change', e => {
    const lsel = e.target.closest('select[data-look]');
    if (lsel) { const id = lsel.dataset.look; if (lsel.value) save.abil.lookOn[id] = lsel.value; else delete save.abil.lookOn[id]; persist(); renderShop(); const again = document.querySelector(`select[data-look="${id}"]`); if (again) again.focus(); return; }
    const sel = e.target.closest('select[data-slot]'); if (!sel) return;
    const i = +sel.dataset.slot, id = sel.value || null;
    if (id && save.build.some((x, j) => x === id && j !== i)) return;
    save.build[i] = id; persist(); renderShop(); const again = document.querySelector(`select[data-slot="${i}"]`); if (again) again.focus();
  });
  // per-tab help: what the tab is for and how its items are earned (opened by the ⓘ button at the top of each tab)
  const TAB_INFO = {
    chaosAbil: () => ABILITIES.map(a => `<span style="color:${a.color}">${a.icon}</span> <b>${a.name}</b>${a.xa ? ' <small>(эксклюзив)</small>' : a.cr ? ' <small>(мастерская, не в Хаос-лиге)</small>' : ''} — ${a.desc}.${a.cd > 1 ? ` Перезарядка ${a.cd} с.` : a.id === 'dash' ? ' Перезарядка 4 с.' : a.id === 'split' ? ' Перезарядка 10 с, до 10 частей.' : ''}`),
    chaos: () => [`Хаос-лига открывается с ${CHAOS_CFG.entryLevel} уровня. Сезон длится ${CHAOS_CFG.seasonDays} дней, режим боя меняется по кругу, как в основной лиге.`,
      'В начале боя выдаются 3 случайные способности из 24 (12 обычных и 12 эксклюзивных); одна из них всегда рывок или деление. Набор не меняется до конца боя. Купленные способности и улучшения не действуют — у всех равные условия.',
      `Свои ступени: Искра, Помеха, Сбой, Шторм, Разлом, Сингулярность; очков нужно вдвое меньше, чем в основной лиге. Взнос за бой со «Сбоя»: ${CHAOS_CFG.fee.slice(2).join(' / ')}. Ниже порога своей ступени не опустишься. Монеты за бой — как в рейтинге (×1,5).`,
      `«Разлом» открывается с ${CHAOS_CFG.tierLevel[4]} уровня, «Сингулярность» — с ${CHAOS_CFG.tierLevel[5]}-го. Награды: монеты всем; «Разлом» — скин и рамка сезона; «Сингулярность» — ещё титул сезона и эксклюзивная способность (по одной за сезон), а когда получены все — облик способности. За 5, 10, 25 и 50 сезонов в «Сингулярности» — особые награды.`,
      'Полученные эксклюзивные способности можно ставить в билд в обычных режимах (без улучшений). В рейтинге основной лиги и в Хаос-лиге их выбрать нельзя.'],
    mab: () => ['Здесь билд — три слота способностей (Пробел, E, Q) — и все способности, которые у тебя есть.', 'Улучшаемые — купленные в магазине, а также рывок и деление (они есть у всех). Улучшения — в «Магазине» → «Способности».', 'Без улучшений — эксклюзивы Хаос-лиги (даются за «Сингулярность») и способности из Мастерской (только в обычных режимах).', 'Облик способности выбирается под слотом, если он у тебя есть. Облики меняют только вид и работают в обычных режимах и в Хаос-лиге.'],
    abil: () => ['Здесь покупаются новые способности и улучшаются купленные. Улучшения каждой способности — в своей шторке: до 5 уровней, за уровень перезарядка −4% и эффект +6,5%. У рывка и деления свои улучшения.',
      'Билд (что стоит в трёх слотах), купленные и полученные способности и облики — в «Коллекция» → «Способности».', 'В рейтинге и «Королевской битве» у всех рывок, деление и выброс, купленное там не действует. Эксклюзивы Хаос-лиги не улучшаются.'],
    up: () => ['Улучшения покупаются за монеты навсегда и действуют в обычных боях.', 'В рейтинговом бою лиги улучшения не действуют — там все на равных.', 'Часть улучшений открывается только с определённого уровня игрока. Верхние уровни каждого улучшения дороже.', 'Улучшения дают небольшой прирост — так прогресс равномернее: прокачанный игрок сильнее, но не в разы, и всё решает умение. Например, «Жадность» на максимуме +20% монет, «Пищеварение» +12% массы с еды, «Обтекаемость» +10% скорости, «Крупный старт» +10 массы; «Больше частей» — до 8 частей, «Второй шанс» — до 2 спасений.'],
    skin: () => ['Здесь скины, которые можно купить за монеты. Купленный скин появляется в гардеробе.', 'Остальные скины выпадают из сундуков, даются за испытания, достижения, лигу и сезоны.', 'Нажми на скин, чтобы посмотреть его подробнее.'],
    fx: () => ['Эффекты бывают трёх видов: след, аура и эффект поедания. В каждом слоте можно надеть один.', 'Здесь эффекты, которые продаются за монеты. Остальные — в сундуках, испытаниях и коллекциях.'],
    arena: () => ['Тема арены меняет пол, сетку, края арены, туманности и частицы вокруг.', 'Темы открываются с определённого уровня игрока, эксклюзивные — с 30-го. Купленные темы — в гардеробе.'],
    archive: () => [`Архив открывается на ${ARCHIVE_LVL}-м уровне. В нём можно получить награды прошедших сезонов, которые ты пропустил в лиге.`, `Каждый предмет стоит монеты и жетоны архива 🎟: обычный и редкий — 1 жетон, эпический — 2, легендарный — 3. Не больше ${ARCH_WEEK_LIMIT} покупок в неделю.`, `Жетоны: за каждый сезон лиги, в котором ты набрал очки (Бронза и Серебро 1, Золото и Платина 2, Алмаз 3, Неон 4), за сезон Хаос-лиги 1, за все три задания недели 1. Можно хранить до ${ARCH_TOK_CAP}.`, `Витрина: ${ARCHIVE_SLOTS} предметов, обновляется каждый понедельник; когда осталось мало — на витрине все.`, `У каждого предмета своя редкость, и цена зависит от неё: обычный ${ARCH_PRICE.common.toLocaleString('ru-RU')} ◆, редкий ${ARCH_PRICE.rare.toLocaleString('ru-RU')} ◆, эпический ${ARCH_PRICE.epic.toLocaleString('ru-RU')} ◆, легендарный ${ARCH_PRICE.legendary.toLocaleString('ru-RU')} ◆.`],
    wskin: () => ['Все твои скины. Нажми на скин, чтобы посмотреть подробности и надеть его.', 'Скин из сундука получает звезду за каждый повтор (до трёх): искры, цветной блик, сияющий ореол.'],
    wfx: () => ['Твои эффекты по слотам: след, аура, поедание. В каждом слоте можно надеть один эффект.', 'Нажми на эффект, чтобы посмотреть его подробнее.'],
    wdeco: () => ['Предмет над головой надевается на любой скин вместо его предмета или короны. Их дают за коллекции скинов.', 'Рамка и титул видны рядом с твоим именем в таблице лидеров.', 'Рамки выпадают из сундуков, даются за уровни, лигу и мастерство режимов. Титулы — из сундуков, за лигу, коллекции эффектов, мастерство и мастерские достижения.'],
    warena: () => ['Выбери тему арены из своих. Новые темы — в магазине, легендарные — за легендарные достижения.'],
    wcol: () => ['Скины: собери все скины коллекции и получи предмет над головой, который надевается на любой скин.', 'Эффекты: собери все эффекты набора и получи уникальный титул.',
      'Лига: все 12 эксклюзивов сундука лиги — предмет над головой «Кубок лиги».', 'Сезоны лиги: скины, эффекты и питомцы 13 сезонов подряд (за «Платину», «Алмаз» и «Неон» или из архива) — своя рамка.',
      'Праздники: все скины, эффекты и питомцы праздничного сезона года — праздничный титул. Каждый год новый набор.', 'Способности: «Арсенал» — все 12 способностей (рывок и деление уже есть) — титул «Оружейник», рамка «Оружейная» и 5 000 ◆.',
      'Питомцы: «Зверинец» — все 10 питомцев из сундуков, титул «Укротитель». Питомцы сезонов входят в «Сезоны лиги» по четвертям, праздничные — в праздничные наборы года.',
      'Хаос-лига: «Хаос-арсенал» (эксклюзивные способности), «Облики способностей» (по 3 на каждую способность), «Сезоны Хаоса» по четвертям (скин, рамка и титул каждого сезона) и «Ветераны Хаоса» (награды за 5, 10, 25 и 50 сезонов в «Сингулярности»). За каждую — титул или рамка, без монет.', 'Каждая коллекция даёт ещё и монеты. Награду нужно забрать кнопкой «Забрать».'],
    wpet: () => ['Питомец летает рядом и даёт бонус: монеты, опыт, скорость, магнит и другие. Можно взять одного.', 'Питомцы — награда лиги («Платина» и «Неон» в каждом сезоне свои, в праздники — праздничные), добыча из сундуков, предметы Мастерской, а за 5 побед в рейде — «Рейдер».', 'Бонус питомца не действует в рейтинговом бою.'],
    pcat: () => ['Питомцы выдаются в конце сезона за лиги «Платина» и «Неон» (в праздники — за праздничные лиги).', 'Ещё питомцы выпадают из обычных сундуков и сундуков лиги (чем реже питомец, тем сильнее бонус) и создаются в Мастерской из осколков.', 'Пропущенных сезонных питомцев можно купить в архиве с 20-го уровня.'],
    week: () => ['Новые задания каждый понедельник: лёгкое, среднее и сложное.', `За все три задания — один сундук «${RARITY[WEEK_CHEST].name}», +${WEEK_BONUS} ◆ и жетон архива 🎟 (для покупок в «Архиве»).`],
    ch: () => ['Испытания — большие цели на всё время игры: прогресс копится между раундами.', 'Каждое даёт уникальный предмет и сундук, редкость которого зависит от сложности.'],
    ach: () => ['11 линеек по 3 ступени: I — 150 ◆, II — 400 ◆, III — 1 000 ◆ и опыт.', 'III ступень линеек «Боссобой», «Звездобой», «Исполин», «Лига» и «Хаос» даёт ещё и титул.', 'Все 11 линеек на III ступени — особый значок «Мастер на все руки».', 'Праздничные достижения идут отдельно: по ступеням лиги праздничного сезона.'],
    skill: () => ['Мастерские достижения проверяют умение, а не время: всё нужно сделать за один раунд.', 'Каждое даёт свой титул и монеты. За все — рамка «Мастер» и скин «Виртуоз».'],
    legend: () => ['Легендарные достижения — самые долгие цели игры. Каждое даёт эксклюзивную награду, которую больше нигде не получить.', 'За все — значок «Легенда Капель». Дата начала отсчёта прогресса указана вверху вкладки.'],
  };
  function openTabInfo(tab) {
    const name = tab === 'chaos' ? 'Хаос-лига' : tab === 'chaosAbil' ? 'способности' : (Object.values(SHOP_VIEWS).flatMap(v => v.tabs).find(t => t[0] === tab) || [, ''])[1];
    $('tiName').textContent = 'Информация · ' + name;
    $('tiBody').innerHTML = '<ul class="ti-list">' + TAB_INFO[tab]().map(t => `<li>${t}</li>`).join('') + '</ul>';
    tiReturn = document.activeElement; $('tabInfoModal').hidden = false; $('tiOk').focus();
  }
  let tiReturn = null;
  const closeTabInfo = () => { $('tabInfoModal').hidden = true; if (tiReturn && tiReturn.isConnected) tiReturn.focus(); };
  $('shop').addEventListener('click', e => { const b = e.target.closest('[data-tabinfo]'); if (b) openTabInfo(b.dataset.tabinfo); });
  $('shop').addEventListener('click', e => { const b = e.target.closest('[data-char]'); if (!b || b.disabled) return; const id = b.dataset.char || null; save.char = id; persist(); renderShop(); const c = charById(id); toast(c ? `Характер «${c.name}»: ${c.plus}; ${c.minus}` : 'Без характера'); });   // 2.7
  $('tiOk').addEventListener('click', closeTabInfo); $('tiClose').addEventListener('click', closeTabInfo);
  $('tabInfoModal').addEventListener('click', e => { if (e.target === $('tabInfoModal')) closeTabInfo(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('tabInfoModal').hidden) { e.stopPropagation(); closeTabInfo(); } }, true);
  const _renderShop = renderShop;
  renderShop = function () { _renderShop(); fillThumbs(); };
  // ---- sorting for wardrobe and pets ----
  const SORTS = { new: 'Новые сначала', old: 'Старые сначала', rarity: 'По редкости', source: 'По источнику', name: 'По названию', bonus: 'По бонусу' };
  const SOURCE_ORDER = ['Эволюция', 'Престиж', 'Магазин', 'Сундук', 'Сундук лиги', 'Испытание', 'Рейд', 'Сезон', 'Праздник', 'Легенда', 'Мастерская'];
  const sourceOf = x => x.evoSkin ? 'Эволюция' : x.craft ? 'Мастерская' : x.prestige ? 'Престиж' : x.tut ? 'Обучение' : x.chaos ? 'Хаос-лига' : x.legend ? 'Легенда' : x.skill ? 'Испытание' : x.raid || x.special === 'raid' ? 'Рейд' : x.special ? 'Сезон' : x.lchest ? 'Сундук лиги' : x.chest ? 'Сундук' : x.ex ? 'Испытание' : x.holiday ? 'Праздник' : x.season || x.tier ? 'Сезон' : 'Магазин';
  // higher = rarer: legendary 4 … common 1; season/holiday and challenge rewards rank high, shop items by price
  const rarityScore = x => {
    if (x.legend) return 5;
    if (x.skill) return 4.6;
    if (x.special) return 3.85;
    const r = x.lchest || x.chest || x.craft; if (r) return RAR_KEYS.indexOf(r) + 1 + (x.lchest ? .5 : 0);
    if (x.raid) return 3.85; if (x.holiday) return 3.9; if (x.season || x.tier) return x.tier === 'Неон' ? 3.8 : 3.7; if (x.ex) return 3.6;
    return (x.price || 0) / 10000;
  };
  function sortOwned(list, order, tab) {
    const mode = (save.settings.sort || {})[tab] || 'new', idx = id => order.indexOf(id), byName = (a, b) => a.name.localeCompare(b.name, 'ru');
    const arr = list.slice();
    if (mode === 'new') arr.sort((a, b) => idx(b.id) - idx(a.id));
    if (mode === 'old') arr.sort((a, b) => idx(a.id) - idx(b.id));
    if (mode === 'rarity') arr.sort((a, b) => rarityScore(b) - rarityScore(a) || byName(a, b));
    if (mode === 'source') arr.sort((a, b) => SOURCE_ORDER.indexOf(sourceOf(a)) - SOURCE_ORDER.indexOf(sourceOf(b)) || byName(a, b));
    if (mode === 'name') arr.sort(byName);
    if (mode === 'bonus') arr.sort((a, b) => BONUS_KEYS.indexOf(a.bonus) - BONUS_KEYS.indexOf(b.bonus) || b.lv - a.lv || byName(a, b));
    return arr;
  }
  function sortBar(tab) {
    const cur = (save.settings.sort || {})[tab] || 'new';
    const opts = Object.entries(SORTS).filter(([k]) => k !== 'bonus' || tab === 'wpet');
    return `<label class="sortbar" for="sortSel"><span>Сортировка</span><select id="sortSel" data-tab="${tab}">${opts.map(([k, v]) => `<option value="${k}" ${k === cur ? 'selected' : ''}>${v}</option>`).join('')}</select></label>`;
  }
  $('shop').addEventListener('change', e => {
    if (e.target.id !== 'sortSel') return;
    save.settings.sort = { ...(save.settings.sort || {}), [e.target.dataset.tab]: e.target.value };
    persist(); renderShop(); const sel = $('sortSel'); if (sel) sel.focus();
  });
  $('shop').addEventListener('click', e => { const b = e.target.closest('[data-gcat]'); if (!b) return; const [p, name] = b.dataset.gcat.split('|'); catSel[p] = name; renderShop();
    const again = document.querySelector(`#shop [data-gcat="${CSS.escape(b.dataset.gcat)}"]`); if (again) { again.focus(); const row = again.parentElement; row.scrollLeft = Math.max(0, again.offsetLeft - row.offsetLeft - 24); } });
  $('shopTabs').addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]'); if (!b) return;
    shopTab = b.dataset.tab; renderShop(); $('overlay').scrollTop = 0;
    const again = document.querySelector(`#shopTabs [data-tab="${shopTab}"]`); if (again) again.focus();
  });
  document.addEventListener('click', e => {
    if (e.target.closest('.build-picker')) return;
    document.querySelectorAll('.build-picker-menu:not([hidden])').forEach(m => {
      m.hidden = true; const p = m.closest('.b-slot'); p.classList.remove('picker-open');
      const t = p.querySelector('[data-picker-toggle]'); if (t) t.setAttribute('aria-expanded', 'false');
    });
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const m = document.querySelector('.build-picker-menu:not([hidden])'); if (!m) return;
    const p = m.closest('.b-slot'), t = p.querySelector('[data-picker-toggle]');
    m.hidden = true; p.classList.remove('picker-open'); t.setAttribute('aria-expanded', 'false'); t.focus();
  });
  $('shop').addEventListener('click', e => {
    const toggle = e.target.closest('button[data-picker-toggle]');
    if (toggle) {
      const picker = toggle.closest('.b-slot'), menu = picker.querySelector('.build-picker-menu'), opening = menu.hidden;
      document.querySelectorAll('.build-picker-menu:not([hidden])').forEach(m => {
        m.hidden = true; const p = m.closest('.b-slot'); p.classList.remove('picker-open');
        const t = p.querySelector('[data-picker-toggle]'); if (t) t.setAttribute('aria-expanded', 'false');
      });
      if (opening) { menu.hidden = false; picker.classList.add('picker-open'); toggle.setAttribute('aria-expanded', 'true'); }
      return;
    }
    const option = e.target.closest('button[data-build-option]');
    if (option && !option.disabled) {
      const i = +option.dataset.buildOption, id = option.dataset.abil || null;
      if (id && save.build.some((x, j) => x === id && j !== i)) return;
      save.build[i] = id; persist(); renderShop();
      const again = document.querySelector(`[data-picker-toggle="${i}"]`); if (again) again.focus();
      return;
    }
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (guestBuyWarn(b)) return;
    if (b.dataset.apv) { openArenaPreview(b.dataset.apv, b.id); return; }
    if (b.dataset.wsh !== undefined) {
      const W = wshState(), o = W.items[+b.dataset.wsh]; if (!o) return; const x = wshItem(o.t, o.id), price = WSH_PRICE[x.chest];
      if (wshOwned(o.t, o.id) || save.coins < price) return;
      coinsSpend(price, 'showcase'); (o.t === 'skin' ? save.skins : o.t === 'fx' ? save.fxOwned : o.t === 'pet' ? save.pets : save.decor).push(o.id);
      toast(`Витрина недели: «${x.name}» теперь твой`); Sound.play('chest'); persist(); renderShop(); renderAll(); return;
    }
    if (b.dataset.wshre) {
      const W = wshState(); if (W.re || save.coins < WSH_REFRESH) return;
      coinsSpend(WSH_REFRESH, 'showcase-refresh'); W.items = wshMake(W.items.map(o => o.id)); W.re = true; persist(); toast('Витрина обновлена'); renderShop(); renderAll(); return;
    }
    if (b.dataset.arch) {
      const o = archiveOffers().find(x => x.id === b.dataset.arch); if (!o || save.coins < o.price || (save.archTok || 0) < ARCH_TOK[o.rar] || archBuysLeft() < 1) return;
      coinsSpend(o.price, 'archive'); save.archTok -= ARCH_TOK[o.rar]; save.archBuys.n++; grantArchive(o); toast(`Из архива: ${offerKind(o)} «${offerName(o)}»`); Sound.play('chest');
    } else if (b.dataset.hat && evoOn() && save.hat !== b.dataset.hat) { toast(`Нельзя с «${skin().name}»: у скина свои эффекты`); return;
    } else if (b.dataset.hat) { save.hat = save.hat === b.dataset.hat ? null : b.dataset.hat; refreshSkin(); }
    else if (b.dataset.deco) { const d = decorById(b.dataset.deco), k = d.kind === 'frame' ? 'frame' : 'title'; save[k] = save[k] === d.id ? null : d.id; }
    else if (b.dataset.col) {
      const c = COLLECTIONS.find(x => x.id === b.dataset.col);
      if (save.colDone.includes(c.id) || colOwned(c) < colItems(c).length) return;
      save.colDone.push(c.id); coinsAdd(c.coins, 'collection');
      if (c.hat && !save.hats.includes(c.hat)) save.hats.push(c.hat);
      if (c.title && !save.decor.includes(c.title)) save.decor.push(c.title);
      if (c.frame && !save.decor.includes(c.frame)) save.decor.push(c.frame);
      if (c.arena && !save.arenas.includes(c.arena)) save.arenas.push(c.arena);
      toast(`Коллекция «${c.name}» собрана: ${colRewardName(c)} + ${c.coins} ◆`);
    } else if (b.dataset.arena) {
      const a = ARENAS.find(x => x.id === b.dataset.arena);
      if (a.price && !save.arenas.includes(a.id)) { if (save.coins < a.price || playerLevel() < (a.lvl || 1)) return; coinsSpend(a.price, 'arena'); save.arenas.push(a.id); toast(`Арена «${a.name}» куплена и включена`); }
      save.arena = a.id; applyArena(); setHoliday(curHoliday);
    } else if (b.dataset.pet) {
      save.pet = save.pet === b.dataset.pet ? null : b.dataset.pet; applyPet();
    } else if (b.dataset.fx) {
      const f = FX.find(x => x.id === b.dataset.fx);
      if (!save.fxOwned.includes(f.id)) {
        if (!buyable(f) || save.coins < f.price || playerLevel() < f.lvl) return;
        coinsSpend(f.price, 'fx'); save.fxOwned.push(f.id);
      } else if (save.fx[f.slot] === f.id) { save.fx[f.slot] = null; persist(); applyAura(); renderShop(); const again = $(b.id); if (again) again.focus(); return; }
      if (evoOn()) { toast(`Нельзя с «${skin().name}»: у скина свои след, аура и эффект поедания`); persist(); renderShop(); return; }
      save.fx[f.slot] = f.id; applyAura();
    } else if (b.dataset.abuy) {
      const a = abilById(b.dataset.abuy); if (save.abil.owned.includes(a.id) || save.coins < a.price) return;
      coinsSpend(a.price, 'abil'); save.abil.owned.push(a.id); save.abil.bought.push(a.id);
      const free = save.build.indexOf(null); if (free >= 0) save.build[free] = a.id;
      toast(`Способность «${a.name}» куплена${free >= 0 ? ' и поставлена в билд' : ''}`); checkAbilAch();
    } else if (b.dataset.aup) {
      const a = abilById(b.dataset.aup), l = save.abil.lv[a.id] || 0, cost = abUpCost(a, l);
      if (!save.abil.owned.includes(a.id) || l >= ABIL_CFG.levels || save.coins < cost) return;
      coinsSpend(cost, 'abilup'); save.abil.lv[a.id] = l + 1; toast(`«${a.name}»: уровень ${l + 1}`); checkAbilAch(); if (arsenalTitleCheck()) setTimeout(() => toast('Новый титул «Мастер оружия»: все обычные способности на 5-м уровне!'), 1600);
    } else if (b.dataset.slotclear) {
      save.build[+b.dataset.slotclear] = null;
    } else if (b.dataset.up) {
      const u = UPG.find(x => x.id === b.dataset.up), l = save.up[u.id], price = u.cost[l];
      if (l < u.cost.length && save.coins >= price && playerLevel() >= u.lvl) { coinsSpend(price, 'upg'); save.up[u.id]++; }
    } else if (b.dataset.skin) {
      const s = SKINS.find(x => x.id === b.dataset.skin);
      if (!save.skins.includes(s.id)) { if (!buyable(s) || save.coins < s.price || playerLevel() < s.lvl) return; coinsSpend(s.price, 'skin'); save.skins.push(s.id); }
      save.skin = s.id; refreshSkin();
    }
    for (const ch of checkChallenges()) toast(`Испытание «${ch.name}»: ${rewardName(ch.reward)}`);
    persist(); renderShop();
    const again = $(b.id); if (again) again.focus(); else { const t = document.querySelector('#shopTabs [aria-selected="true"]'); if (t) t.focus(); }
  });

  // the line under a mode for two: wins for «Захват территории», the best wave for «Спина к спине»
  function duoLine(id, cls = '') {
    const d = (save.duo || {})[id] || {}, c = cls ? ` class="${cls}"` : '';
    return id === 'duoback' ? `<span${c}>Лучшая волна <b>${duoBestWave()}</b></span><span${c}>Забегов <b>${d.games || 0}</b></span>`
      : `<span${c}>Победы <b>${d.wins || 0}</b></span><span${c}>Матчей <b>${d.games || 0}</b></span>`;
  }
