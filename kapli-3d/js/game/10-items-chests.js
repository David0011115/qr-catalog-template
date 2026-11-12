  // ================= item details (wardrobe and pets) =================
  let imFx = null, imFxSlot = null, imFxT = 0, imFxEat = 0;
  let imR = null, imScene, imCam, imObj = null, imVis = null, imKind = '', imId = '', imAnim = 0, imReturn = null;
  function imInit() {
    imR = new THREE.WebGLRenderer({ canvas: $('imCanvas'), antialias: true, alpha: true });
    imR.setPixelRatio(1); imR.setSize(480, 480, false); imR.setClearColor(0x000000, 0);
    imScene = new THREE.Scene();
    imScene.add(new THREE.HemisphereLight(0xc8c0ff, 0x10082a, 1.1));
    const d = new THREE.DirectionalLight(0xffffff, .8); d.position.set(2, 3, 4); imScene.add(d);
    imCam = new THREE.PerspectiveCamera(35, 1, .1, 80);
  }
  // a blob like the in-game one, built for the preview only
  function previewBlob(s, stars, hat) {
    const col = new THREE.Color(s.color);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 28), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .45, roughness: .22, metalness: .1 }));
    const glow = glowSprite(s.color, 3.2, .85); mesh.add(glow);
    [-0.35, 0.35].forEach(x => { const e = new THREE.Mesh(eyeGeo, eyeMat); e.position.set(x, 0.35, 0.86); const pu = new THREE.Mesh(pupilGeo, pupilMat); pu.position.set(0, 0, .09); e.add(pu); mesh.add(e); });
    const crown = makeCrown(); crown.visible = false; mesh.add(crown);
    const v = { mesh, glow, crown, ring: { material: new THREE.MeshBasicMaterial() }, jig: 0 };
    applySkin(v, s, stars, hat);
    return v;
  }
  const SLOT_NAME = { trail: 'След за каплей', aura: 'Аура вокруг капли', eat: 'Эффект при поедании' };
  const HEAD_NAME = { ring: 'кольцо планеты', cap: 'шляпка гриба', icecrown: 'ледяная корона', gradcap: 'шапочка выпускника', shards: 'кристаллы на орбите', swarm: 'рой', portal: 'портальные кольца', stem: 'хвостик тыквы с огоньком', flame: 'пламя', antenna: 'антенны', halo: 'нимб', gem: 'парящий кристалл', star: 'звезда', horns: 'рожки', wings: 'крылья', moons: 'три луны', coins: 'стопка монет', nova: 'звёздный взрыв', laurel: 'лавровый венок', prism: 'вращающаяся призма' };
  const PATTERN_NAME = { stripes: 'полоски', dots: 'горошек', gradient: 'градиент', grid: 'сетка', zigzag: 'зигзаг', rings: 'кольца', stars: 'звёзды',
    waves: 'волны', spiral: 'спираль', marble: 'мрамор', hex: 'соты', scales: 'чешуя', circuit: 'микросхема', cracks: 'трещины', bubbles: 'пузыри', sunset: 'закат', synth: 'синтвейв',
    aurora: 'северное сияние', swirl: 'галактика', glitch: 'цифровой сбой', code: 'бегущий код', plates: 'бронеплиты', hearts: 'сердечки', ribs: 'тыквенные дольки', snow: 'снегопад',
    melon: 'арбузная корка', amanita: 'пятна мухомора', branches: 'ветви-молнии', scan: 'развёртка голограммы', facets: 'грани', fractal: 'фрактал', vortex: 'воронка', meteors: 'метеоры',
    tiger: 'тигровые полосы', laurel: 'лавры' };
  const MAT_NAME = { chrome: 'зеркальный металл', glass: 'стекло', jelly: 'желе', crystal: 'кристалл', rim: 'неоновый контур', magma: 'раскалённый камень', matte: 'матовый камень' };
  const ANIM_NAME = { breath: 'дышит', heartbeat: 'бьётся как сердце', flicker: 'мерцает как неон', glitch: 'сбоит', magma: 'трещины пульсируют', dissolve: 'рассыпается и собирается', chameleon: 'меняет цвет от скорости', twin: 'двоится' };
  function sourceText(x) {
    if (save.archived && save.archived.includes(x.id)) return 'куплен в архиве сезонов';
    if (x.legend) return `легендарное достижение «${LEGEND.find(l => l.id === x.legend).name}»`;
    if (x.skill) return 'все мастерские достижения';
    if (x.prestige) return `престиж после 50-го уровня, ${x.prestige}`;
    if (x.tut) return 'награда за обучение';
    if (x.chaos === 'vet') return '25 сезонов Хаос-лиги в «Сингулярности»';
    if (x.chaosQ) return `Хаос-лига, ${['I', 'II', 'III', 'IV'][x.chaosQ - 1]} квартал: первый сезон в «Разломе» или выше`;
    if (x.raidQ) return `Босс-рейд: победа в ${['I', 'II', 'III', 'IV'][x.raidQ - 1]} квартале года`;
    if (x.chaos) return `Хаос-лига, сезон ${x.chaos}: «Разлом» или «Сингулярность»`;
    if (x.raid) return 'трофей босс-рейда';
    if (x.special === 'raid') return 'первая победа в босс-рейде';
    if (x.special === 'league') return 'лига «Неон» в конце сезона';
    if (x.lchest) return `сундук лиги · ${RARITY[x.lchest].name.toLowerCase()}`;
    if (x.chest) return `сундук · ${RARITY[x.chest].name.toLowerCase()}`;
    if (x.ex) { const ch = CHALLENGES.find(c => c.reward && c.reward[1] === x.id); return ch ? `испытание «${ch.name}»` : 'испытание'; }
    if (x.holiday) return `праздник «${HOLIDAYS[x.holiday].name}»`;
    if (x.season) return 'награда сезона лиги';
    return x.price ? `магазин · ${x.price} ◆${x.lvl > 1 ? `, с ${x.lvl} уровня` : ''}` : 'есть с самого начала';
  }
  const colsWith = id => COLLECTIONS.filter(c => colItems(c).includes(id)).map(c => `«${c.name}» ${colOwned(c)}/${colItems(c).length}${save.colDone.includes(c.id) ? ' ✓' : ''}`).join(', ');
  function openItem(ref) {
    const [kind, ...rest] = ref.split(':'), id = rest.join(':');
    imKind = kind; imId = id; imReturn = document.activeElement; imFxT = 0; imFxEat = 0; if (imFx) { imFx.owner = null; imFx.fired = false; }
    if (!imR) imInit();
    if (imObj) { imScene.remove(imObj); imObj = null; } imVis = null; imFxSlot = null; if (imFx) imFx.clear();
    let name = '', tag = '', rows = [], flat = '', act = '';
    const rarTag = r => r ? `<span class="badge-r" style="color:${RARITY[r].color}">${RARITY[r].name}</span>` : '';
    if (kind === 'skin') {
      const k = SKINS.find(x => x.id === id), st = starsOf(k);
      name = k.name; tag = rarTag(k.chest || k.lchest) + sourceBadge(k).replace(/badge-r[^>]*>[^<]*<\/span>/, '');
      imVis = previewBlob(k, st, null); imObj = imVis.mesh; imVis.look = k;
      const look = [k.pattern ? `узор «${PATTERN_NAME[k.pattern] || k.pattern}»` : 'однотонный', k.mat && MAT_NAME[k.mat], k.anim && ANIM_NAME[k.anim], k.flow && 'живой узор', k.glow && 'свечение', k.pulse && 'пульсация', k.holo && 'голограмма (переливается)', k.rainbow && 'радужный перелив', k.crown && 'корона'].filter(Boolean).join(', ');
      rows.push(['Откуда', sourceText(k)], ['Вид', look]);
      if (k.head) rows.push(['Над головой', HEAD_NAME[k.head] || k.head]);
      if (isShiny(k)) rows.push(['Блик', k.shine === 'bolt' ? 'молния' : 'полоса']);
      if (k.chest || k.lchest) rows.push(['Звёзды', `${'★'.repeat(st)}${'☆'.repeat(3 - st)} — ${st ? STAR_TEXT[st] + `; бонус, пока скин надет: ${starBonusOf(k).text(st)}` : `пока нет; звёзды этого скина дадут: ${STAR_BONUS[k.chest || k.lchest].text(1)} за каждую`}${st < 3 ? `. Следующая за повтор из сундука: ${STAR_TEXT[st + 1]}` : ''}`]);
      const cw = colsWith(id); if (cw) rows.push(['Коллекция', cw]);
      if (save.hat) rows.push(['Сейчас надето', `${HATS[save.hat].name} вместо предмета скина`]);
      act = !save.skins.includes(id) ? `<button class="btn ghost" disabled>${buyable(k) ? 'Купить можно в магазине' : 'Ещё не получен'}</button>` : save.skin === id ? '<button class="btn ghost" disabled>Выбран</button>' : `<button class="btn" data-act="skin-${id}">Выбрать</button>`;
    } else if (kind === 'fx') {
      const f = FX.find(x => x.id === id), on = save.fx[f.slot] === id;
      name = f.name; tag = rarTag(f.chest || f.lchest) + `<span class="badge-ex">${SLOT_NAME[f.slot]}</span>`;
      rows.push(['Что делает', f.desc], ['Откуда', sourceText(f)]);
      const cw = colsWith(id); if (cw) rows.push(['Коллекция', cw]);
      if (f.slot === 'aura') { const sc = skin().color; imVis = previewBlob(skin(), 0, save.hat); imObj = imVis.mesh; imVis.look = skin(); setAura(imVis, id, sc); }
      else { imVis = previewBlob(skin(), 0, save.hat); imObj = imVis.mesh; imVis.look = skin(); imFxSlot = f.slot; }
      act = !save.fxOwned.includes(id) ? `<button class="btn ghost" disabled>${buyable(f) ? 'Купить можно в магазине' : 'Ещё не получен'}</button>` : `<button class="btn ${on ? 'ghost' : ''}" data-act="fx-${id}">${on ? 'Снять' : 'Надеть'}</button>`;
    } else if (kind === 'pet') {
      const pt = petById(id), own = save.pets.includes(id), on = save.pet === id, B = PET_BONUS[pt.bonus];
      name = pt.name; tag = rarTag(pt.chest || pt.lchest) + (pt.tier ? `<span class="badge-ex">${pt.tier}</span>` : '');
      const g = buildPet(pt); scene.remove(g); g.visible = true; g.position.set(0, 0, 0); imObj = g;
      rows.push(['Вид', PET_SPECIES[pt.species]], ['Бонус', `${B.name}: ${B.text(pt.lv)}`], ['Сила', `уровень ${pt.lv} из 3`],
        ['Откуда', save.archived && save.archived.includes(pt.id) ? 'куплен в архиве сезонов' : pt.legend ? `легендарное достижение «${LEGEND.find(l => l.id === pt.legend).name}»` : pt.lchest ? 'сундук лиги' : pt.chest ? 'сундук' : pt.holiday ? 'праздничная лига' : `лига «${pt.tier}» в конце сезона`], ['В лиге', 'бонус не действует в рейтинговом бою']);
      act = own ? `<button class="btn ${on ? 'ghost' : ''}" data-act="pet-${id}">${on ? 'Убрать' : 'Взять'}</button>` : '<button class="btn ghost" disabled>Ещё не получен</button>';
    } else if (kind === 'hat') {
      const own = save.hats.includes(id), on = save.hat === id, col = COLLECTIONS.find(c => c.hat === id);
      name = HATS[id].name; tag = '<span class="badge-ex">предмет над головой</span>';
      imVis = previewBlob(skin(), 0, id); imObj = imVis.mesh; imVis.look = skin();
      rows.push(['Откуда', col ? `коллекция «${col.name}» (${colOwned(col)}/${colItems(col).length})` : HATS[id].src], ['Как носить', 'на любом скине, вместо его короны или предмета']);
      act = own ? `<button class="btn ${on ? 'ghost' : ''}" data-act="hat-${id}">${on ? 'Снять' : 'Надеть'}</button>` : `<button class="btn ghost" disabled>${col ? 'Собери коллекцию' : 'Ещё не получен'}</button>`;
    } else if (kind === 'deco') {
      const d = decorById(id), on = (d.kind === 'frame' ? save.frame : save.title) === id;
      name = d.name; tag = rarTag(decoRarity(d)) + `<span class="badge-ex">${d.kind === 'frame' ? 'рамка имени' : 'титул'}</span>`;
      flat = d.kind === 'frame' ? `<span class="im-frame">${pcAvatar({ skin: save.skin, frame: id }, 110)}${decoPreview(d)}</span>` : decoPreview(d);
      rows.push(['Где видно', d.kind === 'frame' ? 'рамка вокруг твоего имени в таблице лидеров и в профиле' : 'подпись после твоего имени в таблице лидеров и в профиле'],
        ['Откуда', d.chaos ? decoSource(d).replace(/\.$/, '') : d.level ? `${d.level}-й уровень игрока` : d.skill ? (d.skill === 'all' ? 'все мастерские достижения' : `мастерское достижение «${SKILL.find(k => k.id === d.skill).name}»`) : d.legend ? `легендарное достижение «${LEGEND.find(l => l.id === d.legend).name}»` : d.league !== undefined ? 'награда лиги в конце сезона' : d.col ? 'награда за коллекцию эффектов' : d.mastery ? `мастерство режима «${MODES[d.mastery].name}» (${d.kind === 'frame' ? 'уровень «Золото»' : 'уровень «Легенда»'})` : d.chest ? `сундук · ${RARITY[d.chest].name.toLowerCase()}` : decoSource(d).replace(/\.$/, '')]);
      act = save.decor.includes(id) ? `<button class="btn ${on ? 'ghost' : ''}" data-act="deco-${id}">${on ? 'Снять' : 'Выбрать'}</button>` : '<button class="btn ghost" disabled>Ещё не получена</button>';
    } else if (kind === 'arena') {
      const a = ARENAS.find(x => x.id === id), on = save.arena === id;
      name = a.name; tag = '<span class="badge-ex">тема арены</span>' + (a.exclusive ? '<span class="badge-ex badge-legend">эксклюзив</span>' : '');
      flat = `<span class="arena-pv" style="--fl:${a.floor};--gr:${a.grid};--rm:${a.rim}"></span>`;
      rows.push(['Что меняет', a.desc], ['Особенность', `${ARENA_FX[a.id] || '—'} (только в обычных режимах)`], ['Частицы', ({ embers: 'искры', snow: 'снег', bubbles: 'пузыри', fireflies: 'светлячки', sand: 'песок', rain: 'цифровой дождь', cosmos: 'мерцающие звёзды', gold: 'золотые искры', petals: 'лепестки сакуры', ash: 'пепел и искры', aurora: 'переливы сияния в небе', retro: 'неоновые искры и солнце на горизонте' })[a.fx] || 'нет'],
        ['Откуда', a.src ? a.src : a.legend ? `легендарное достижение «${LEGEND.find(l => l.id === a.legend).name}»` : a.price ? `магазин · ${a.price} ◆` : 'есть с самого начала']);
      act = `<button class="btn ghost" data-apv="${id}">👁 Посмотреть арену</button>` + (on ? '<button class="btn ghost" disabled>Выбрана</button>' : `<button class="btn" data-act="arena-${id}">Выбрать</button>`);
    }
    $('imName').textContent = name; $('imTag').innerHTML = tag;
    $('imInfo').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
    $('imActions').innerHTML = act + '<button class="btn ghost" id="imOk">Закрыть</button>';
    $('imFlat').innerHTML = flat; $('imFlat').hidden = !flat; $('imCanvas').hidden = !!flat; if (flat) pbgMount($('imFlat'));
    if (imObj) imScene.add(imObj);
    const big = kind === 'pet' ? 3.6 : imFxSlot === 'trail' ? 12.5 : imFxSlot ? 10 : imVis && imVis.aura ? 7.4 : 6.4, y = kind === 'pet' ? 0 : imFxSlot ? .4 : .6;
    if (imFxSlot && !imFx) imFx = makePreviewFx(imScene, 1);
    imR.setClearColor(imFxSlot ? '#160c36' : 0x000000, imFxSlot ? 1 : 0);   // glowing particles need a dark backdrop
    imCam.position.set(0, y + big * .28, big); imCam.lookAt(0, y, 0);
    $('itemModal').hidden = false; $('imClose').focus();
    cancelAnimationFrame(imAnim);
    const t0 = performance.now();
    const loop = now => {
      if ($('itemModal').hidden) return;
      if (imObj) {
        imObj.rotation.y = .5 + Math.sin((now - t0) / 1600) * .6;
        if (imKind === 'pet') animatePetLook(imObj, now);
        if (imFxSlot) {   // trail: the blob circles and leaves its trail; eat: a burst every 1.3 s
          const dt = Math.min(.05, (now - (imFxT || now)) / 1000); imFxT = now; imObj.rotation.y = 0;
          if (imFxSlot === 'trail') { const a = now / 900, x = Math.cos(a) * 2.4, z = Math.sin(a) * 2.4, hx = -Math.sin(a), hz = Math.cos(a);
            imObj.position.set(x, 0, z); imObj.rotation.y = Math.atan2(hx, hz);
            imFxEat += dt; const o = imFx.owner || (imFx.owner = pvOwner(imId, imVis));
            while (imFxEat > .03) { imFxEat -= .03; const b = (now - imFxEat * 1000) / 900; pvTrailStep(imFx, imId, o, Math.cos(b) * 2.4, Math.sin(b) * 2.4, -Math.sin(b), Math.cos(b), now); } }
          else { imObj.position.set(0, 0, 0); if ((imFxEat += dt) > 1.3 || !imFx.fired) { imFxEat = 0; imFx.fired = true; pvEat(imFx, imId, 0, 1.4, skin().color); } }
          imFx.update(dt);
        }
        if (imVis) {
          const lk = imVis.look, v = imVis, m = v.mesh.material;
          animateHead(v, now); if (v.aura) animateAura(v, now);
          if (lk.pulse) { const k = .5 + .5 * Math.sin(now / 280); m.emissiveIntensity = .25 + .8 * k; v.glow.material.opacity = .5 + .5 * k; }
          if (lk.holo) { const h = ((lk.holoBase ?? .5) + (lk.holoSpan ?? .17) * (1 + Math.sin(now / 900))) % 1; m.color.setHSL(h, 1, .62); m.emissive.setHSL(h, 1, .5); v.glow.material.color.setHSL(h, 1, .6); }
          if (lk.rainbow) { const h = (now / 4000) % 1; m.color.setHSL(h, 1, .6); m.emissive.setHSL(h, 1, .5); v.glow.material.color.setHSL(h, 1, .6); }
          animateLook(v, now, null);
          if (v.starGlow && v.starGlow.visible) v.starGlow.material.opacity = .3 + .25 * Math.sin(now / 320);
        } else if (imKind === 'pet') imObj.position.y = Math.sin(now / 400) * .08;
        shineT.value = now / 1000;
        imR.render(imScene, imCam);
      }
      imAnim = requestAnimationFrame(loop);
    };
    imAnim = requestAnimationFrame(loop);
  }
  function closeItem() {
    $('itemModal').hidden = true; cancelAnimationFrame(imAnim);
    if (imReturn && imReturn.isConnected) imReturn.focus();
  }
  $('imClose').addEventListener('click', closeItem);
  $('itemModal').addEventListener('click', e => {
    if (e.target === $('itemModal') || e.target.id === 'imOk') { closeItem(); return; }
    const pv = e.target.closest('button[data-apv]'); if (pv) { const ret = imReturn; closeItem(); openArenaPreview(pv.dataset.apv, ret && ret.id); return; }
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const orig = $(b.dataset.act);
    if (orig && !orig.disabled) orig.click();
    else if (b.dataset.act.startsWith('pbg-')) { save.pc = { ...(save.pc || {}), bg: imId }; persist(); try { Net.pushShowcase(); } catch (er) {} toast('Фон профиля поставлен'); }
    else if (b.dataset.act.startsWith('pet-')) { save.pet = save.pet === imId ? null : imId; applyPet(); persist(); renderShop(); }
    openItem(imKind + ':' + imId);   // refresh the window after the change
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('itemModal').hidden) { e.stopPropagation(); closeItem(); } }, true);
  $('shop').addEventListener('click', e => {
    const t = e.target.closest('[data-info]');
    if (t && !e.target.closest('button, select, label')) openItem(t.dataset.info);
  });
  $('shop').addEventListener('keydown', e => {
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-info]')) { e.preventDefault(); openItem(e.target.dataset.info); }
  });

  // ================= chests =================
  const LEAGUE_CHEST_W = { 1: [55, 38, 6, 1], 2: [35, 45, 17, 3], 3: [20, 42, 30, 8], 4: [5, 35, 45, 15], 5: [0, 20, 50, 30] };
  // round chest: chance grows with round length; mass and a win add a bit; capped; a guarantee after a dry streak
  const CHEST_RULE = { normal: { rate: .03, cap: .35, pity: 15 }, ranked: { rate: .04, cap: .45, pity: 10 } };   // 1.7.0: rarer, the catalog is smaller
  function roundChestChance(minutes, mass, win, ranked) {
    const R = CHEST_RULE[ranked ? 'ranked' : 'normal'];
    return Math.min(R.cap, minutes * R.rate * (1 + Math.min(.25, mass / 80000) + (win ? .1 : 0)));
  }
  const LEG_PITY = 80;
  const CHEST_SRC = { normal: 'За раунды', daily: 'Ежедневные', league: 'Сундуки лиги', level: 'За уровни', week: 'Задания недели', raid: 'Рейд', challenge: 'Испытания', archive: 'Сундук архива' };
  function logChest(src, rar) {
    const S = save.chestStats; S.total++;
    const o = S.src[src] = S.src[src] || {}; o[rar] = (o[rar] || 0) + 1;
  }
  function logRoundChest(ranked, sec, got) {
    let d = save.chestDays.find(x => x.d === today);
    if (!d) { d = { d: today, n: [0, 0, 0], r: [0, 0, 0] }; save.chestDays.push(d); }   // [seconds, rounds, chests]
    const a = ranked ? d.r : d.n; a[0] += Math.round(sec); a[1]++; a[2] += got ? 1 : 0;
    const cut = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    save.chestDays = save.chestDays.filter(x => x.d > cut);
  }   // round + daily chests: after 60 in a row without a legendary, the next one is legendary
  const leagueExcl = () => [...SKINS.filter(k => k.lchest).map(k => ['skin', k]), ...FX.filter(f => f.lchest).map(f => ['fx', f]), ...PETS.filter(pt => pt.lchest).map(pt => ['pet', pt])];
  const ownsTI = ([type, item]) => (type === 'skin' ? save.skins : type === 'pet' ? save.pets : type === 'deco' ? save.decor : save.fxOwned).includes(item.id);
  const RAR_KEYS = Object.keys(RARITY);
  const chestTotal = () => save.chests + save.special.length + (save.giftBoxes || []).length;
  // ===== holiday gift boxes: a new edition every year; only players with an account get one (the box lives in their cloud save) =====
  const GIFT_EVENTS = [
    { id: 'bday2026', from: '2026-11-15', to: '2026-11-20', box: 'Праздничная коробка «День рождения»', cake: '🎂', look: ['#ff4fd8', '#5a0a48', '#ffd23f', '#ff7ad9', 'rgba(255,79,216,.6)'],
      title: 'У разработчика день рождения!', text: 'В честь праздника каждого игрока с аккаунтом ждёт праздничная коробка с подарками.',
      give: [{ coins: 5000 }, { emote: ':cake:' }, { badge: 'bday2026' }, { frame: 'fr_bday2026' }, { ach: 'ev_bday2026' }] },
    { id: 'ny2027', from: '2027-01-01', to: '2027-01-07', box: 'Праздничная коробка «Новый год 2027»', cake: '🎆', look: ['#ff2d55', '#5a0010', '#ffd23f', '#ff7a1a', 'rgba(255,45,85,.6)'],
      title: 'С Новым годом!', text: 'Под ёлкой у каждого игрока с аккаунтом — праздничная коробка с живым фоном профиля «Год Огненной Козы».',
      give: [{ pbg: 'bg_goat27' }] },
  ];
  const astanaDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const giftActive = ev => TEST_MODE || (astanaDay() >= ev.from && astanaDay() <= ev.to);
  function giftCheck(signed) {
    if (!signed && !TEST_MODE) return;
    save.gifts = save.gifts || []; save.giftBoxes = save.giftBoxes || []; let n = 0;
    for (const ev of GIFT_EVENTS) if (giftActive(ev) && !save.gifts.includes(ev.id) && !save.giftBoxes.includes(ev.id)) { save.giftBoxes.push(ev.id); n++; }
    if (n) { persist(); renderAll(); if (!TEST_MODE) toast('🎁 В «Сундуках» тебя ждёт праздничная коробка!'); }
  }
  function giftItems(ev) {
    return ev.give.map(g => {
      if (g.coins) return { ico: promoCoinSVG(g.coins), name: `${g.coins.toLocaleString('ru-RU')} ◆`, kind: 'Монеты' };
      if (g.emote) return { ico: `<span class="gift-emo emo-play" data-emote="${g.emote}">${KapliEmo.svg(g.emote)}</span>`, name: `Смайлик «${KapliEmo.E[g.emote].n}»`, kind: 'Стикер в чате' };
      if (g.badge) { const b = PROMO_BADGES.find(x => x.id === g.badge); return { ico: specialBadgeSVG(b, true), name: `Значок «${b.name}»`, kind: 'Значок в профиле' }; }
      if (g.frame) return { ico: pcAvatar({ skin: save.skin, frame: g.frame }, 50), name: `Рамка «${decorById(g.frame).name}»`, kind: 'Рамка аватара' };
      if (g.ach) { const a = ACH.find(x => x.id === g.ach); return { ico: '<span class="gift-ach">🏅</span>', name: a.name, kind: 'Достижение' }; }
      if (g.pbg) return { ico: `<img class="gift-bg" alt="" src="${pbgThumb(g.pbg)}">`, name: `Фон «${pbgById(g.pbg).name}»`, kind: 'Живой фон профиля' };
      return null; }).filter(Boolean);
  }
  function giftGive(ev) {
    save.gifts = save.gifts || []; save.badges = save.badges || {}; save.emo = save.emo || [];
    for (const g of ev.give) {
      if (g.coins) save.coins += g.coins;
      if (g.emote && !save.emo.includes(g.emote)) save.emo.push(g.emote);
      if (g.badge && !save.badges[g.badge]) save.badges[g.badge] = today;
      if (g.frame && !save.decor.includes(g.frame)) save.decor.push(g.frame);
    }
    save.gifts.push(ev.id); save.giftBoxes = (save.giftBoxes || []).filter(x => x !== ev.id);
    for (const g of ev.give) if (g.ach && !save.ach.includes(g.ach)) save.ach.push(g.ach);
    pbgCheck(true);
  }
  const pickRarity = w => { const tot = w.reduce((a, b) => a + b, 0); let x = Math.random() * tot; for (let i = 0; i < w.length; i++) if ((x -= w[i]) < 0) return RAR_KEYS[i]; return RAR_KEYS[0]; };
  const CHEST_LOOK = {
    normal:    ['#7b3dff', '#3a1580', '#ff4fd8', '#9b3dff', 'rgba(178,107,255,.55)'],
    daily:     ['#22b8ff', '#0a3a6e', '#22e6ff', '#4d7cff', 'rgba(34,230,255,.55)'],
    league:    ['#ffb020', '#7a4a00', '#ffd23f', '#ff9a3d', 'rgba(255,210,63,.6)'],
  };
  function chestLook(kind, rar, ev) {
    const L = ev ? ev.look : kind === 'challenge' ? [RARITY[rar].color, '#1a0a3a', RARITY[rar].color, '#3a1580', RARITY[rar].color] : CHEST_LOOK[kind] || CHEST_LOOK.normal;
    return `--cb1:${L[0]};--cb2:${L[1]};--cl1:${L[2]};--cl2:${L[3]};--cg:${L[4]}`;
  }
  // opts: { rar } fixed rarity, or { league } for the exclusive league pool, else normal weights
  function rollChest(opts) {
    let rar, pool;
    if (opts.league) {
      const lpool = r => [...SKINS.filter(k => k.lchest === r).map(k => ['skin', k]), ...FX.filter(f => f.lchest === r).map(f => ['fx', f]), ...PETS.filter(pt => pt.lchest === r).map(pt => ['pet', pt]), ...DECOR.filter(d => d.chest === r).map(d => ['deco', d])];
      const w = LEAGUE_CHEST_W[opts.league];
      if (leagueExcl().some(x => !ownsTI(x))) {
        // until all 12 league exclusives are collected: no repeats, only missing items; the rarity odds keep the table among rarities that still have something missing
        const miss = r => leagueExcl().filter(x => x[1].lchest === r && !ownsTI(x));
        const ww = RAR_KEYS.map((r, i) => miss(r).length ? w[i] : 0);
        if (ww.some(x => x > 0)) { rar = pickRarity(ww); pool = miss(rar); }
        else { const all = RAR_KEYS.flatMap(r => miss(r).map(x => [r, x])); const [r0, x0] = all[Math.floor(Math.random() * all.length)]; rar = r0; pool = [x0]; }
      } else { rar = pickRarity(w); pool = lpool(rar); }
    } else {
      if (opts.rar) rar = opts.rar;
      else {
        rar = save.legPity >= LEG_PITY ? 'legendary' : pickRarity(Object.values(RARITY).map(r => r.w));
        save.legPity = rar === 'legendary' ? 0 : (save.legPity || 0) + 1;
      }
      pool = [...SKINS.filter(k => k.chest === rar).map(k => ['skin', k]), ...FX.filter(f => f.chest === rar).map(f => ['fx', f]), ...PETS.filter(pt => pt.chest === rar).map(pt => ['pet', pt]), ...DECOR.filter(d => d.chest === rar).map(d => ['deco', d])];
    }
    const [type, item] = pool[Math.floor(Math.random() * pool.length)];
    const list = type === 'skin' ? save.skins : type === 'pet' ? save.pets : type === 'deco' ? save.decor : save.fxOwned;
    const owned = list.includes(item.id);
    if (!owned) list.push(item.id);
    // a duplicate skin adds a star (up to 3); after that duplicates pay coins again
    let star = 0;
    if (owned && type === 'skin' && (save.stars[item.id] || 0) < 3) { star = save.stars[item.id] = (save.stars[item.id] || 0) + 1; if (save.skin === item.id) refreshSkin(); }
    const coins = (opts.league ? 100 + opts.league * 60 : 40) + Math.floor(Math.random() * 80) + (owned && !star ? RARITY[rar].dup : 0);
    save.coins += coins; save.legend.coins = (save.legend.coins || 0) + coins;
    for (const ch of checkChallenges()) toast(`Испытание «${ch.name}»: ${rewardName(ch.reward)}`);
    persist();
    return { type, item, rar, dup: owned, star, coins };
  }
  const STAR_TEXT = { 1: 'вокруг капли летят искры', 2: 'по капле бежит цветной блик', 3: 'капля сияет ореолом' };
  // П8: stars also give a small bonus while the skin is worn — its kind depends on the skin's rarity (normal modes only)
  const STAR_BONUS = { common: { k: 'coins', per: 1, text: n => `+${n}% монет за раунд` }, rare: { k: 'xp', per: 2, text: n => `+${2 * n}% опыта за раунд` },
    epic: { k: 'magnet', per: .2, text: n => `крошки собираются дальше на ${(.2 * n).toFixed(1).replace('.', ',')}` }, legendary: { k: 'bonus', per: 5, text: n => `бонусы действуют на ${5 * n}% дольше` } };
  const starBonusOf = k => { const r = k && (k.chest || k.lchest), n = k ? starsOf(k) : 0; return r && n ? { ...STAR_BONUS[r], n } : null; };
  const starBonus = kind => { if (!stats || stats.ranked) return 0; const b = starBonusOf(skin()); return b && b.k === kind ? b.per * b.n : 0; };
  // rarity of a frame or title, by where it comes from
  function decoRarity(d) {
    if (d.rar) return d.rar;
    if (d.promo) return 'legendary';
    if (d.chest) return d.chest;
    if (d.level) return d.level >= 50 ? 'legendary' : d.level >= 30 ? 'epic' : 'rare';
    if (d.league !== undefined) return d.league >= 4 ? 'legendary' : d.league === 3 ? 'epic' : d.league === 2 ? 'rare' : 'common';
    if (/^tt_lg/.test(d.id)) return d.id === 'tt_lg3' ? 'epic' : 'legendary';
    if (d.legend || d.chaos === 'vet' || d.skill === 'all') return 'legendary';
    if (d.mastery) return d.kind === 'title' ? 'legendary' : 'epic';
    if (typeof d.chaos === 'number') return d.kind === 'title' ? 'legendary' : 'epic';
    if (d.skill || d.col || d.chaos) return 'epic';
    return 'rare';
  }
  const RAR_ORDER = { legendary: 0, epic: 1, rare: 2, common: 3 };
  function decoSource(d) {
    if (d.prestige) return `Престиж после 50-го уровня: ${d.prestige}.`;
    if (d.promo) return 'Эксклюзив: награда за промокод.';
    if (d.half) return `Сезоны лиги ${d.half === 1 ? '1–13' : '14–26'}: ${d.kind === 'frame' ? '«Платина»' : '«Неон»'} в любом из них.`;
    if (d.cq) return `Хаос-лига, ${['', 'первый', 'второй', 'третий', 'четвёртый'][d.cq]} квартал года: ${d.kind === 'frame' ? '«Разлом»' : '«Сингулярность»'} в любом сезоне.`;
    if (d.skillN) return `Мастерские достижения: выполни ${d.skillN}.`;
    if (d.mastery === 'all') return 'Мастерство «Легенда» во всех режимах.';
    if (d.line) return 'Линейка достижений, III ступень.';
    if (d.chal) return `Испытание «${CHALLENGES.find(c => c.id === d.chal).name}».`;
    if (d.level) return `Награда за ${d.level}-й уровень.`;
    if (d.skill) return d.skill === 'all' ? 'Все мастерские достижения.' : 'Мастерское достижение.';
    if (d.legend) return 'Легендарное достижение.';
    if (d.league !== undefined || /^tt_lg/.test(d.id)) return 'Награда лиги в конце сезона.';
    if (d.chaos === 'top') return 'Хаос-лига: дойди до «Сингулярности».';
    if (d.chaos === 'vet') return 'Веха Хаос-лиги: сезоны в «Сингулярности».';
    if (typeof d.chaos === 'number') return `Хаос-лига, сезон ${d.chaos}.`;
    if (d.chaos) return 'Хаос-лига.';
    if (d.col) return 'Награда за коллекцию.';
    if (d.mastery) return `Мастерство режима «${MODES[d.mastery].name}».`;
    if (d.chest) return `Из сундука · ${RARITY[d.chest].name.toLowerCase()}.`;
    return 'Особая награда.';
  }
  const frameAttr = id => { const d = decorById(id); if (!d) return 'class="fr0"'; const g = FRAME_GLYPH[FRAME_STYLE[d.id]];
    return `class="fr fn ${d.cls || ''}" style="${d.css}"${g ? ` data-g="${g}"` : ''}`; };
  const titleTag = id => { const d = decorById(id); return d ? `<em class="ttl ${d.cls || ''}" style="color:${d.color};--a:${d.a || d.color};--b:${d.b || '#fff'}">${d.ico ? `<i class="tt-i">${d.ico}</i>` : ''}${d.name}</em>` : ''; };
  const decoPreview = d => d.kind === 'frame' ? `<span class="deco-pv"><span ${frameAttr(d.id)}>Ты</span></span>` : `<span class="deco-pv">${titleTag(d.id)}</span>`;
  function chestRows() {
    const rows = [];
    const daily = save.dailyChestDay !== today;
    const left = (() => { const t = new Date(); t.setHours(24, 0, 0, 0); const m = Math.ceil((t - Date.now()) / 60000); return `${Math.floor(m / 60)} ч ${m % 60} мин`; })();
    rows.push({ key: 'daily', look: chestLook('daily'), title: 'Ежедневный сундук', sub: daily ? 'Случайная редкость, раз в сутки' : `Следующий через ${left}`, btn: daily ? 'Забрать' : 'Завтра', dis: !daily });
    if (save.chests) rows.push({ key: 'normal', look: chestLook('normal'), title: `Сундук за раунды ×${save.chests}`, sub: 'Обычные шансы редкости', btn: 'Открыть', multi: Math.min(CHEST_MULTI, save.chests) });
    (save.giftBoxes || []).forEach(id => { const ev = GIFT_EVENTS.find(e => e.id === id); if (ev) rows.unshift({ key: 'gift' + id, look: chestLook('gift', null, ev), title: `${ev.cake} ${ev.box}`, sub: 'Подарок от разработчика — открой!', btn: 'Открыть', gift: true }); });
    save.special.forEach((c, i) => rows.push(c.kind === 'league'
      ? { key: 'sp' + i, look: chestLook('league'), title: `Сундук лиги «${c.title}»`, sub: 'Эксклюзивные предметы лиги', btn: 'Открыть' }
      : { key: 'sp' + i, look: chestLook('challenge', c.rar), title: `Сундук испытания «${c.title}»`, sub: `Редкость: ${RARITY[c.rar].name}`, btn: 'Открыть' }));
    return rows;
  }
  function renderChest() {
    $('chestCount').textContent = chestTotal();
    const rows = chestRows();
    $('chestList').innerHTML = rows.map(r => `<li style="${r.look}"${r.gift ? ' class="gift-row"' : ''}><span class="ci"></span><b>${r.title}</b><small>${r.sub}</small>` +
      `<span class="ch-btns">${r.multi > 1 ? `<button class="buy ch-multi" id="chn-${r.key}" data-openn="${r.key}" aria-label="Открыть сразу ${r.multi}">×${r.multi}</button>` : ''}<button class="buy" id="ch-${r.key}" data-open="${r.key}" ${r.dis ? 'disabled' : ''}>${r.btn}</button></span></li>`).join('');
    const tot = Object.values(RARITY).reduce((a, r) => a + r.w, 0);
    $('odds').innerHTML = Object.values(RARITY).map(r => `<li><b style="color:${r.color}">${r.name}</b><span>${Math.round(r.w / tot * 100)}%</span></li>`).join('');
    $('legPityNote').textContent = `Гарантия легендарного: если ${LEG_PITY} сундуков за раунды и ежедневных подряд без легендарного, следующий — легендарный. Без легендарного уже: ${save.legPity || 0} из ${LEG_PITY}.`;
    $('lgOdds').innerHTML = '<tr><th>Лига</th>' + Object.values(RARITY).map(r => `<th style="color:${r.color}" title="${r.name}">${r.name.slice(0, 5)}.</th>`).join('') + '</tr>' +
      [1, 2, 3, 4, 5].map(k => { const v = lgView(k, holidayOf(save.season.id)); return `<tr><td style="color:${v.color}">${v.name}</td>` + LEAGUE_CHEST_W[k].map(x => `<td>${x ? x + '%' : '—'}</td>`).join('') + '</tr>'; }).join('');
    $('chestBox').classList.toggle('empty', !chestTotal() && save.dailyChestDay === today);
    { const gb = (save.giftBoxes || [])[0], ev = gb && GIFT_EVENTS.find(e => e.id === gb), box = $('chestBox'); if (ev && !chestBusy && $('reveal').hidden) { box.classList.add('gift'); box.setAttribute('style', chestLook('gift', null, ev)); } }
  }
  let chestBusy = false;
  // the holiday window: once per edition; with an account it leads straight to the box, a guest is offered to sign in
  function giftModal() {
    const ev = GIFT_EVENTS.find(e => giftActive(e) && !(save.giftSeen || []).includes(e.id) && !(save.gifts || []).includes(e.id)); if (!ev) return;
    // wait until the loading screen is gone and no other window (tutorial, news) is open
    const sp = $('splash'); if ((sp && !sp.classList.contains('out')) || document.querySelector('.modal:not([hidden]):not(#birthdayModal)') || running || $('overlay').hidden) { setTimeout(giftModal, 1500); return; }
    const signed = !!Net.uid || TEST_MODE, modal = $('birthdayModal');
    modal.querySelector('.bday-cake').textContent = ev.cake; $('birthdayTitle').textContent = ev.title;
    $('birthdayText').textContent = ev.text + (signed ? ' Она уже лежит в «Сундуках».' : ' Войди в аккаунт, и коробка появится в «Сундуках».');
    modal.style.setProperty('--gc1', ev.look[0]); modal.style.setProperty('--gc2', ev.look[2]);
    $('birthdayClose').textContent = signed ? '🎁 Открыть коробку' : 'Войти в аккаунт';
    const done = () => { modal.hidden = true; save.giftSeen = [...(save.giftSeen || []), ev.id]; persist(); };
    $('birthdayClose').onclick = () => { done(); if (signed) { giftCheck(true); $('chestBtn').click(); } else Net.openAccount(); };
    $('birthdayLater').onclick = done;
    modal.onclick = e => { if (e.target === modal) done(); };
    modal.hidden = false; $('birthdayClose').focus();
  }
  setTimeout(() => { if (TEST_MODE) giftCheck(true); giftModal(); }, 1800);
  function openGiftBox(id) {
    const ev = GIFT_EVENTS.find(e => e.id === id); if (!ev || chestBusy || !(save.giftBoxes || []).includes(id)) return;
    chestBusy = true;
    const box = $('chestBox'); $('reveal').hidden = true; box.setAttribute('style', chestLook('gift', null, ev)); box.classList.add('gift');
    box.classList.remove('open', 'empty'); void box.offsetWidth; box.classList.add('shake');
    buzz([40, 60, 40]); Sound.play('chest'); $('overlay').scrollTop = 0;
    setTimeout(() => {
      const items = giftItems(ev); giftGive(ev); persist();
      box.classList.remove('shake'); box.classList.add('open');
      const el = $('reveal'); el.style.setProperty('--rc', ev.look[0]);
      el.innerHTML = `<span class="rar">${ev.box}</span><div class="gift-confetti" aria-hidden="true">${Array.from({ length: 28 }, (_, i) => `<i style="--x:${(Math.random() * 100).toFixed(0)}%;--d:${(Math.random() * .6).toFixed(2)}s;--c:${['#ff4fd8', '#ffd23f', '#22e6ff', '#3dffa2', '#b26bff'][i % 5]}"></i>`).join('')}</div>` +
        `<ul class="gift-items">${items.map((it, i) => `<li style="--i:${i}"><span class="gi">${it.ico}</span><b>${it.name}</b><small>${it.kind}</small></li>`).join('')}</ul>` +
        `<small>Всё уже у тебя: значки и фоны — в профиле, рамки — в гардеробе, стикер — в чате.</small>`;
      el.hidden = false; Sound.play('promo');
      renderChest(); renderAll(); chestBusy = false;
      setTimeout(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' }), 250);
    }, 900);
  }
  function openChest(key) {
    if (chestBusy) return;
    if (key.startsWith('gift')) return openGiftBox(key.slice(4));
    $('chestBox').classList.remove('gift');
    let opts, look;
    if (key === 'daily') { if (save.dailyChestDay === today) return; save.dailyChestDay = today; opts = {}; look = chestLook('daily'); }
    else if (key === 'normal') { if (!save.chests) return; save.chests--; opts = {}; look = chestLook('normal'); }
    else {
      const i = +key.slice(2), c = save.special[i]; if (!c) return;
      save.special.splice(i, 1);
      opts = c.kind === 'league' ? { league: c.league } : { rar: c.rar };
      opts.src = c.kind === 'league' ? 'league' : /^Уровень /.test(c.title) ? 'level' : c.title === 'Неделя' ? 'week' : c.title === 'Рейд' ? 'raid' : 'challenge';
      look = c.kind === 'league' ? chestLook('league') : chestLook('challenge', c.rar);
    }
    chestBusy = true;
    const box = $('chestBox'); $('reveal').hidden = true; box.setAttribute('style', look);
    box.dataset.kind = key === 'daily' || key === 'normal' || key === 'shard' ? key : opts.league ? 'league' : 'challenge';
    box.classList.remove('open', 'empty'); void box.offsetWidth; box.classList.add('shake');
    buzz(40); Sound.play('chest');
    $('overlay').scrollTop = 0;
    setTimeout(() => {
      const r = rollChest(opts), R2 = RARITY[r.rar];
      logChest(opts.src || key, r.rar); persist();
      box.style.setProperty('--rc', R2.color); box.classList.remove('shake'); box.classList.add('open');
      const pic = r.type === 'skin' ? `<div class="${swClass(r.item)}" style="${swatch(r.item)}">${headIcon(r.item)}</div>` : r.type === 'deco' ? decoPreview(r.item) : `<img class="sw" style="border-radius:14px" alt="" src="${r.type === 'pet' ? petThumb(r.item) : fxThumb(r.item)}">`;
      const kind = r.type === 'deco' ? (r.item.kind === 'frame' ? 'Рамка для имени' : 'Титул') : r.type === 'skin' ? 'Скин' : r.type === 'pet' ? `Питомец · ${PET_BONUS[r.item.bonus].name}: ${PET_BONUS[r.item.bonus].text(r.item.lv)}` : 'Эффект · ' + FX_SLOTS.find(sl => sl[0] === r.item.slot)[1].toLowerCase();
      const el = $('reveal'); el.style.setProperty('--rc', R2.color); el.dataset.look = `${r.type}:${r.item.id}`;
      el.innerHTML = `<span class="rar">${R2.name}${opts.league ? ' · сундук лиги' : ''}</span>${pic}<b>${r.item.name}</b><small>${kind}${r.star ? ` · повтор: звезда ${'★'.repeat(r.star)}${'☆'.repeat(3 - r.star)} — ${STAR_TEXT[r.star]}` : r.dup ? ' · уже есть, превращён в монеты' : r.type === 'pet' ? ' · теперь в «Питомцах»' : r.type === 'deco' ? ' · гардероб → «Украшения»' : ' · теперь в гардеробе'}</small><span class="coin">+${r.coins} ◆</span>`;
      { const pv = el.children[1]; if (pv) { pv.dataset.info = `${r.type}:${r.item.id}`; pv.classList.add('rv-pic'); pv.setAttribute('role', 'button'); pv.setAttribute('tabindex', '0'); pv.setAttribute('aria-label', 'Посмотреть: ' + r.item.name); } }
      el.insertAdjacentHTML('beforeend', `<button class="btn ghost rv-look" type="button" data-info="${r.type}:${r.item.id}">👁 Посмотреть</button>`);
      el.hidden = false;
      renderChest(); renderAll(); chestBusy = false;
    }, 750);
  }
  const CHEST_MULTI = 5;
  $('chestList').addEventListener('click', e => { const m = e.target.closest('button[data-openn]'); if (m) { openChestMany(m.dataset.openn); return; } const b = e.target.closest('button[data-open]'); if (b && !b.disabled) openChest(b.dataset.open); });
  $('reveal').addEventListener('click', e => { const t = e.target.closest('[data-info]'); if (t) openItem(t.dataset.info); });
  $('reveal').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-info]')) { e.preventDefault(); openItem(e.target.dataset.info); } });
  // open up to CHEST_MULTI round chests in one go; the reveal shows everything at once
  function openChestMany(key) {
    if (chestBusy || key !== 'normal') return;
    const n = Math.min(CHEST_MULTI, save.chests || 0); if (n < 2) return openChest(key);
    save.chests -= n; chestBusy = true;
    const box = $('chestBox'); $('reveal').hidden = true; box.classList.remove('gift'); box.setAttribute('style', chestLook('normal')); box.dataset.kind = 'normal';
    box.classList.remove('open', 'empty'); void box.offsetWidth; box.classList.add('shake');
    buzz(60); Sound.play('chest'); $('overlay').scrollTop = 0;
    setTimeout(() => {
      const el = $('reveal'), res = []; for (let c = 0; c < n; c++) { const r = rollChest({}); logChest('normal', r.rar); res.push(r); }
      const best = res.reduce((a, r) => RAR_KEYS.indexOf(r.rar) > RAR_KEYS.indexOf(a.rar) ? r : a, res[0]), coins = res.reduce((a, r) => a + (r.coins || 0), 0);
      el.style.setProperty('--rc', RARITY[best.rar].color); box.style.setProperty('--rc', RARITY[best.rar].color);
      el.innerHTML = `<span class="rar">Открыто сундуков: ${n}</span><div class="rv-multi">${res.map(r => { const R2 = RARITY[r.rar];
        const pic = r.type === 'skin' ? `<div class="${swClass(r.item)}" style="${swatch(r.item)}">${headIcon(r.item)}</div>` : r.type === 'deco' ? decoPreview(r.item) : `<img class="sw" style="border-radius:12px" alt="" src="${r.type === 'pet' ? petThumb(r.item) : fxThumb(r.item)}">`;
        return `<span class="rv-it" style="--rc:${R2.color}" data-info="${r.type}:${r.item.id}" tabindex="0" role="button" aria-label="Посмотреть: ${r.item.name}">${pic}<b>${r.item.name}</b><small>${R2.name}${r.star ? ` · ${'★'.repeat(r.star)}` : r.dup ? ' · повтор' : ' · новое'}</small></span>`; }).join('')}</div>` +
        (coins ? `<small>Монеты за повторы: +${coins.toLocaleString('ru-RU')} ◆</small>` : '') + '<small>Нажми на предмет, чтобы посмотреть его</small>';
      persist(); box.classList.remove('shake'); box.classList.add('open'); el.hidden = false; renderChest(); renderAll(); chestBusy = false;
    }, 900);
  }
  $('chestBtn').addEventListener('click', () => { showCard('chestCard'); $('reveal').hidden = true; $('chestBox').classList.remove('open'); $('chestBox').setAttribute('style', chestLook('normal')); renderChest(); const f = document.querySelector('#chestList button:not([disabled])'); (f || $('chestBack')).focus(); });
  $('chestBack').addEventListener('click', () => { renderAll(); showCard('menuCard'); $('chestBtn').focus(); });

  // ================= settings =================
  function buzz(ms) { if (save.settings.vibrate && navigator.vibrate) try { navigator.vibrate(ms); } catch (e) {} }
  function applySettings() {
    const st = save.settings;
    const qWas = QUALITY; QUALITY = st.quality; if (qWas !== QUALITY && typeof applyArena === 'function') applyArena();
    renderer.setPixelRatio(QUALITY === 'high' ? Math.min(devicePixelRatio, 2) : QUALITY === 'medium' ? Math.min(devicePixelRatio, 1.25) : 1);
    resize();
    allVis.forEach(v => v.glow.visible = QUALITY !== 'low');
    stars.visible = QUALITY !== 'low'; nebulae.forEach(n => n.visible = QUALITY !== 'low');
    const js = { s: 96, m: 128, l: 168 }[st.joySize] || 128;
    document.documentElement.style.setProperty('--joy', js + 'px');
    document.documentElement.style.setProperty('--joy-a', st.joyAlpha);
    JOY_R = js * .47;
    $('miniWrap').classList.toggle('off', !st.minimap);
    $('fps').hidden = !st.showFps;
    const mz = { s: [110, 84], m: [140, 100], l: [190, 140], xl: [240, 180] }[st.miniSize] || [140, 100];
    document.documentElement.style.setProperty('--mini-d', mz[0] + 'px'); document.documentElement.style.setProperty('--mini-p', mz[1] + 'px');
  }
  function renderSettings() {
    const st = save.settings;
    [['setQuality', st.quality], ['setJoy', st.joySize], ['setMiniSize', st.miniSize]].forEach(([id, v]) => $(id).querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', b.dataset.v === v)));
    $('setAlpha').value = st.joyAlpha; $('setVib').checked = st.vibrate; $('setMini').checked = st.minimap; $('setSfx').value = st.sfxVol; $('setMus').value = st.musVol; $('setAutoQ').checked = st.autoQ; $('setFps').checked = st.showFps;
  }
  const saveSettings = () => { persist(); applySettings(); renderSettings(); };
  $('setQuality').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; save.settings.quality = b.dataset.v; saveSettings(); b.focus(); });
  $('setMiniSize').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; save.settings.miniSize = b.dataset.v; saveSettings(); b.focus(); });
  $('setJoy').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; save.settings.joySize = b.dataset.v; saveSettings(); b.focus(); });
  $('setAlpha').addEventListener('input', e => { save.settings.joyAlpha = +e.target.value; persist(); applySettings(); });
  $('setVib').addEventListener('change', e => { save.settings.vibrate = e.target.checked; saveSettings(); });
  $('setSfx').addEventListener('input', e => { save.settings.sfxVol = +e.target.value; persist(); Sound.ensure(); Sound.apply(); Sound.play('bonus'); });
  $('setMus').addEventListener('input', e => { save.settings.musVol = +e.target.value; persist(); Sound.ensure(); Sound.apply(); });
  $('setMini').addEventListener('change', e => { save.settings.minimap = e.target.checked; saveSettings(); });
  $('setAutoQ').addEventListener('change', e => { save.settings.autoQ = e.target.checked; saveSettings(); });
  $('setFps').addEventListener('change', e => { save.settings.showFps = e.target.checked; saveSettings(); });
  $('setBtn').addEventListener('click', () => { renderSettings(); showCard('settingsCard'); $('setBack').focus(); });
  $('setBack').addEventListener('click', () => { showCard('menuCard'); $('setBtn').focus(); });
  // 1.7.0: there is no reset button any more; existing players get a one-time offer after the update
  function resetProgress() {
    // a clean save that keeps only the settings; league seasons restart from season 1 today
    // season 1 = the season running now on the shared calendar, so holidays and season dates stay the same for everyone
    const base = SEASON_BASE, k = Math.max(0, Math.floor((Date.now() - base) / SEASON_LEN));
    const kc = Math.max(0, Math.floor((Date.now() - CHAOS_BASE) / CHAOS_LEN));   // Chaos League: season 1 = the chaos week running now
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ settings: save.settings, seasonEpoch: base + k * SEASON_LEN, chaosEpoch: CHAOS_BASE + kc * CHAOS_LEN, resetOffer170: true, newsSeen: NEWS[0].id })); } catch (e) {}
    location.reload();
  }

