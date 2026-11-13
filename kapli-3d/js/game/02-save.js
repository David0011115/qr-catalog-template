  // ================= save =================
  let save = { best: 0, coins: 0, xp: 0, up: {}, skin: 'coral', skins: ['coral'], quests: [] };
  UPG.forEach(u => save.up[u.id] = 0);
  let saveRestored = false;
  {
    const SAFE = SAVE_KEY + '-safe';
    let raw = null, s = null, broken = false;
    try { raw = localStorage.getItem(SAVE_KEY); } catch (e) {}
    if (raw) { try { s = JSON.parse(raw); if (!s || typeof s !== 'object') throw new Error('save is not an object'); } catch (e) { broken = true; s = null; KapliErr.log(e, 'save-load'); } }
    if (broken) { try { localStorage.setItem(SAVE_KEY + '-corrupt', raw.slice(0, 400000)); } catch (e) {} }
    if (!s) { try { const safe = JSON.parse(localStorage.getItem(SAFE)); if (safe && safe.save && typeof safe.save === 'object') { s = safe.save; saveRestored = broken || 'missing'; } } catch (e) {} }
    if (s) save = { ...save, ...s, up: { ...save.up, ...s.up }, skins: s.skins || ['coral'], quests: s.quests || [] };
  }
  // the «Обзор» upgrade was removed (the camera is farther for everyone): refund what was spent on it
  if (save.up.vision) { save.coins += costs(25, 5).slice(0, save.up.vision).reduce((a, b) => a + b, 0); }
  delete save.up.vision;
  // abilities (save schema 2): owned, levels, build. Old players keep the eject they always had, new players start with an empty 3rd slot
  if (!save.abil) {
    const old = !!(save.totals || save.xp);
    save.abil = { owned: old ? ['dash', 'split', 'eject'] : ['dash', 'split'], bought: [], lv: {} };
    save.build = old ? [...ABIL_CFG.oldBuild] : [...ABIL_CFG.newBuild];
  }
  save.abil.bought = save.abil.bought || []; save.abil.lv = save.abil.lv || {};
  ['dash', 'split'].forEach(id => { if (!save.abil.owned.includes(id)) save.abil.owned.push(id); });
  save.build = (save.build || ABIL_CFG.newBuild).slice(0, ABIL_CFG.slots).map(id => id && abilById(id) && save.abil.owned.includes(id) ? id : null);
  save.build = save.build.map((id, i) => id && save.build.indexOf(id) !== i ? null : id);
  while (save.build.length < ABIL_CFG.slots) save.build.push(null);
  { // v54: the 6 separate holiday achievements of each holiday-year became one stepped achievement
    save.achT = save.achT || {}; save.ach = save.ach || [];
    for (const [pre] of [['ny'], ['vd'], ['hw']]) for (const y of [2027, 2028, 2029]) {
      const old = [`${pre}_${y}`, ...[1, 2, 3, 4, 5].map(i => `${pre}_${y}_${i}`)]; let n = 0;
      while (n < 6 && save.ach.includes(old[n])) n++;
      if (save.ach.some(id => old.includes(id))) { save.achT[`${pre}_${y}_all`] = Math.max(save.achT[`${pre}_${y}_all`] || 0, n); save.ach = save.ach.filter(id => !old.includes(id)); if (n >= 6) save.ach.push(`${pre}_${y}_all`); }
    } }
  if (save.up.keep || save.up.armor) {
    // v47: the two merged into «Защита» — keep the higher level, pay back what the other one cost
    const K = UPG.find(u => u.id === 'keep'), A = UPG.find(u => u.id === 'armor'), lk = save.up.keep || 0, la = save.up.armor || 0;
    const spent = (u, l) => u.cost.slice(0, l).reduce((x, y) => x + y, 0);
    save.up.guard = Math.max(save.up.guard || 0, lk, la);
    const back = lk >= la ? spent(A, la) : spent(K, lk);
    if (back) save.coins += back;
    save.up.keep = save.up.armor = 0;
  }
  if (!save.abilGrowth) {
    // v45: upgrade levels got cheaper (×1,8 → ×1,5 per level): pay back what was overpaid
    let back = 0;
    for (const [id, lv] of Object.entries(save.abil.lv)) { const a = abilById(id); if (!a || !a.price) continue;
      for (let l = 0; l < lv; l++) back += Math.round(a.price * .5 * Math.pow(1.8, l) / 50) * 50 - Math.round(a.price * .5 * Math.pow(1.5, l) / 50) * 50; }
    if (back > 0) { save.coins += back; save.abilRefund = back; }
    save.abilGrowth = ABIL_CFG.growth;
  }
  if (!save.bal163) {
    // 1.6.3: upgrades and ability levels became weaker: keep the levels, return 35% of what was spent on them
    let spent = 0;
    UPG.forEach(u => { for (let l = 0; l < Math.min(save.up[u.id] || 0, u.oldCost.length); l++) spent += u.oldCost[l]; });
    for (const [id, lv] of Object.entries((save.abil && save.abil.lv) || {})) { const a = abilById(id); if (!a || !a.price) continue; for (let l = 0; l < lv; l++) spent += Math.round(a.price * .5 * Math.pow(1.5, l) / 50) * 50; }
    const back = Math.round(spent * .35 / 5) * 5;
    if (back > 0) { save.coins += back; save.bal163Refund = back; }
    save.bal163 = true;
  }
  save.schema = 2;
  save.quests = save.quests.filter(id => QUESTS.some(q => q.id === id));
  function fillQuests(skip = []) {
    const lv = levelInfo(save.xp).level;
    save.quests = save.quests.filter(id => QUESTS.some(q => q.id === id));
    while (save.quests.length < 3) {
      // higher levels mostly get the harder tier they have unlocked; `skip`: goals that must not come back right now (a replaced one)
      let open = QUESTS.filter(q => !save.quests.includes(q.id) && !skip.includes(q.id) && (q.lvl || 1) <= lv);
      if (!open.length) open = QUESTS.filter(q => !save.quests.includes(q.id) && (q.lvl || 1) <= lv);
      const top = Math.max(...open.map(q => q.lvl || 1));
      const pool = top > 1 && Math.random() < .6 ? open.filter(q => (q.lvl || 1) === top) : open;
      save.quests.push(pool[Math.floor(Math.random() * pool.length)].id);
    }
  }
  fillQuests();
  try { localStorage.removeItem('blobs3d-save'); } catch (e) {}
  const Net = { uid: null, nick: null, shortId: '', email: '', submitRecord() {}, boot() {}, pushShowcase() {}, getShowcases: async () => new Map(), pcSocial() {}, pcSocialClick() {} };   // filled by the accounts block below
  const escHtml = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  let persistHook = null;   // cloud sync: told about every local save
  // every save also refreshes a safe copy (at most once a minute); a full storage is reported once instead of failing silently
  let safeAt = 0, storageWarned = false;
  const persist = () => {
    try {
      const json = JSON.stringify(save); localStorage.setItem(SAVE_KEY, json);
      if (Date.now() - safeAt > 60000) { safeAt = Date.now(); localStorage.setItem(SAVE_KEY + '-safe', JSON.stringify({ at: new Date().toISOString(), save })); }
    } catch (e) {
      KapliErr.log(e, 'save-write');
      if (!storageWarned) { storageWarned = true; setTimeout(() => { try { toast('⚠ Память браузера заполнена — прогресс может не сохраниться. Войди в аккаунт, чтобы он хранился в облаке'); } catch (er) {} }, 0); }
    }
    if (persistHook) persistHook();
  };
  if (saveRestored) setTimeout(() => { try { toast(saveRestored === 'missing' ? 'Сохранение не нашлось — прогресс восстановлен из резервной копии' : 'Сохранение было повреждено — прогресс восстановлен из резервной копии'); } catch (e) {} }, 2500);
  save.mode = MODES[save.mode] && !REMOVED_MODES.includes(save.mode) ? save.mode : 'classic';
  // ranked (league) battles: only these modes, league points only here, purchased upgrades switched off
  // each league season is played in one mode; they rotate season by season
  // 2.5: «Гонка массы» left the game (replaced by the mode for two «Спина к спине»), «Выживание» takes its place in the league circle
  const LEAGUE_ROT = ['timed', 'crown', 'survival', 'hardcore', 'royale'];
  const seasonMode = id => LEAGUE_ROT[(id - 1) % LEAGUE_ROT.length];
  const leagueMode = () => seasonMode(save.season.id);
  const nextSeasonOf = m => { for (let k = save.season.id; k < save.season.id + 6; k++) if (seasonMode(k) === m) return k; return '?'; };
  save.ranked = false;   // league rounds start only from the League window
  const ZERO_UP = Object.fromEntries(UPG.map(u => [u.id, 0]));
  let U = save.up;
  const fixModeForLeague = () => { if (save.mode === 'royale' && !TEST_MODE) save.mode = 'classic'; };   // test mode: royale open for testing
  let pendingRanked = false;   // true when the round is started from «Играть в лиге»
  let pendingTut = false, tut = null, pendingChaos = false;   // tutorial round: a quiet classic arena with step-by-step hints
  save.bests = { raid: 0, classic: save.best || 0, timed: 0, survival: 0, split: 0, crown: 0, race: 0, team: 0, giant: 0, hardcore: 0, daily: 0, ...(save.bests || {}) };
  save.ach = save.ach || [];
  save.totals = { kills: 0, bosses: 0, minions: 0, crumbs: 0, ejects: 0, rounds: 0, ...(save.totals || {}) };
  save.bossTypes = save.bossTypes || [];
  save.fx = { trail: null, aura: null, eat: null, ...(save.fx || {}) };
  save.fxOwned = save.fxOwned || [];
  save.chDone = save.chDone || [];
  save.pets = save.pets || []; save.pet = save.pet || null;
  save.chests = save.chests || 0; save.pity = save.pity || 0; save.legPity = save.legPity || 0;
  // chest stats for the profile: opened chests by source and rarity (counted from v33), and round chests per hour over the last 7 days
  save.chestStats = save.chestStats || { since: Date.now(), total: 0, src: {} };
  save.chestDays = save.chestDays || [];
  save.chatBg = save.chatBg || [];   // crafted chat scenes
  save.shards = Object.assign({ common: 0, rare: 0, epic: 0, legendary: 0 }, save.shards || {}); save.shardChests = save.shardChests || 0; save.chestSeq = save.chestSeq || 0;
  save.special = save.special || [];   // league / challenge chests: { kind, rar | league, title }
  save.dailyChestDay = save.dailyChestDay || '';
  save.stars = save.stars || {};                       // skin id -> 1..3 stars from chest duplicates
  save.hats = save.hats || []; save.hat = save.hat || null;
  save.decor = save.decor || []; save.frame = save.frame || null; save.title = save.title || null;
  save.arenas = save.arenas || []; save.arena = save.arena || 'default';
  save.colDone = save.colDone || [];
  save.mastery = save.mastery || {};
  if (!save.lvlCurve) {
    let xp = save.xp || 0, L = 1, need = 100;
    while (xp >= need) { xp -= need; L++; need = 100 + 50 * (L - 1); }
    L = Math.min(L, 50);
    save.xp = xpForLevel(L) + Math.round(xp / need * (100 + LEVEL_STEP * (L - 1)));
    save.lvlCurve = 2; save.lvlPaid = L;   // rewards start from the next level
  }
  if (save.lvlCurve === 2) {
    // v39: harder levels after 30 — keep everyone's level and progress inside it
    let xp = save.xp || 0, L = 1, need = 100;
    while (xp >= need && L < MAX_LEVEL) { xp -= need; L++; need = 100 + LEVEL_STEP * (L - 1); }
    save.xp = xpForLevel(L) + (L >= MAX_LEVEL ? 0 : Math.round(xp / need * levelNeed(L)));
    save.lvlCurve = 3;
  }
  save.legend = save.legend || { since: today };   // counters start the day the legendary achievements appeared
  function weeklyState() {
    const w = raidWeek();
    if (!save.weekly || save.weekly.week !== w) save.weekly = { week: w, prog: {}, modes: [], done: [], bonus: false };
    return save.weekly;
  }
  save.skillDone = save.skillDone || []; save.skillBest = save.skillBest || {};
  save.legendDone = (save.legendDone || []).filter(id => !['stars', 'wins'].includes(id));
  save.raid = save.raid || { week: 0, dmg: 0, done: false, day: '', tries: 0 };
  function raidState() {
    const r = save.raid, w = raidWeek();
    if (r.week !== w) Object.assign(r, { week: w, dmg: 0, done: false });
    if (r.day !== today) Object.assign(r, { day: today, tries: 0 });
    return r;
  }
  save.history = save.history || [];
  save.totals.modeRounds = save.totals.modeRounds || {};
  save.settings = { quality: 'high', joySize: 'm', joyAlpha: .35, vibrate: true, minimap: true, miniSize: 'm', sfxVol: .7, musVol: .45, autoQ: true, showFps: false, ...(save.settings || {}) };
  delete save.settings.botLevel; // единая сложность ботов для всех игроков
  save.season = save.season || { id: seasonNow, pts: 0 };
  [...(save.skins || []), ...(save.fxOwned || [])].forEach(id => { const m = /^hf?_(\w+?)_(\d{4})_\d$/.exec(id); if (m && HOLIDAYS[m[1]]) ensureHolidayItems(m[1], +m[2]); });
  save.seasonLog = save.seasonLog || [];
  save.act = save.act || {};   // 2.2: activity calendar — local date → [rounds, seconds, best mass]
  save.recaps = save.recaps || [];   // 2.2: season summaries, newest last (kept: 6)
  const ssNew = id => ({ id, r: 0, t: 0, m: 0, w: 0, c: 0, x: 0, ch: {}, md: {} });
  let seasonNotice = '';
  if (!seasonStarted) save.season = { id: 1, pts: 0 };   // nothing counts before the first season opens
  if (save.season.id !== seasonNow) {
    // a season ended while away: pay out by the league reached
    const li = leagueOf(save.season.pts), sd = seasonData(save.season.id), L = lgView(li, sd.holiday);
    if (save.season.pts > 0) {   // badge and rewards only for a season you actually played
      save.coins += L.coins;
      let extra = '';
      for (const it of seasonRewards(sd, li)) {
        const list = it.kind === 'skin' ? save.skins : it.kind === 'pet' ? save.pets : save.fxOwned;
        if (!list.includes(it.id)) { list.push(it.id); extra += `, ${({ skin: 'скин', fx: 'эффект', pet: 'питомец' })[it.kind]} «${it.name}»`; }
      }
      if (li >= 4 && !(save.hats || []).includes('crystals')) { save.hats = save.hats || []; save.hats.push('crystals'); extra += ', предмет над головой «Алмазная россыпь»'; }
      if (li >= 5 && !save.fxOwned.includes('neonAura')) { save.fxOwned.push('neonAura'); extra += ', аура «Неоновые кольца»'; }
      for (const d of leagueDecor(li)) if (!save.decor.includes(d.id)) { save.decor.push(d.id); extra += `, ${d.kind === 'frame' ? 'рамка' : 'титул'} «${d.name}»`; }
      for (const id of seasonDecor(sd, li)) if (!save.decor.includes(id)) { const d = decorById(id); save.decor.push(id); extra += `, ${d.kind === 'frame' ? 'рамка' : 'титул'} «${d.name}»`; }
      save.seasonLog.push({ id: save.season.id, league: li, pts: save.season.pts, name: sd.name, holiday: sd.holiday, year: sd.year || null });
      const tok = save.archTok === undefined ? 0 : archTokAdd(ARCH_TOK_LEAGUE[li]); if (tok) extra += `, жетоны архива +${tok} 🎟`;
      seasonNotice = `Сезон ${save.season.id} «${sd.name}» завершён: лига «${L.name}», получен значок. Награда: ${L.coins} ◆${extra}.`;
      if (sd.holiday) { const ky = sd.holiday + '_' + sd.year; save.totals.holLeagueY = save.totals.holLeagueY || {}; save.totals.holLeagueY[ky] = Math.max(save.totals.holLeagueY[ky] ?? 0, li); }
      if (sd.holiday) { save.totals.holLeague = save.totals.holLeague || {}; save.totals.holLeague[sd.holiday] = Math.max(save.totals.holLeague[sd.holiday] || 0, li); }
    }
    // 2.2: the season's summary, if anything was played in it (league points or not)
    if (save.ss && save.ss.id === save.season.id && save.ss.r > 0) {
      const S = save.ss, fav = Object.entries(S.md).sort((a, b) => b[1] - a[1])[0];
      save.recaps.push({ id: S.id, n: sd.name, r: S.r, t: Math.round(S.t), m: S.m, w: S.w, c: S.c, x: S.x, ch: S.ch, fav: fav || null, lg: save.season.pts > 0 ? li : -1, pts: save.season.pts });
      save.recaps = save.recaps.slice(-6); save.recapShow = S.id;
    }
    save.season = { id: seasonNow, pts: 0 };
  }
  if (!save.ss || save.ss.id !== save.season.id) save.ss = ssNew(save.season.id);
  addExtraCollections();   // after the Chaos League tables: its collections need them
  styleDecor();
  // ---- Chaos League save (schema 3) ----
  save.chaos = save.chaos || { id: chaosStarted ? chaosNow : 1, pts: 0 };
  save.chaosLog = save.chaosLog || [];
  save.abil.xa = save.abil.xa || []; save.abil.looks = save.abil.looks || []; save.abil.lookOn = save.abil.lookOn || {};
  save.chaosTop = save.chaosTop || 0;
  save.pc = save.pc || { bg: 'bg_base', badge: '' };
  ensureChaosSkin(save.chaos.id);
  let chaosNotice = '';
  if (!chaosStarted) save.chaos = { id: 1, pts: 0 };
  if (save.chaos.id !== chaosNow && chaosStarted) {
    const ti = chaosOf(save.chaos.pts), id = save.chaos.id;
    if (save.chaos.pts > 0) {
      save.coins += CHAOS_CFG.coins[ti]; save.legend.coins = (save.legend.coins || 0) + CHAOS_CFG.coins[ti];
      const got = chaosSeasonRewards(id, ti);
      save.chaosLog.push({ id, tier: ti, pts: save.chaos.pts });
      const tok = save.archTok === undefined ? 0 : archTokAdd(ARCH_TOK_CHAOS); if (tok) got.push(`жетоны архива +${tok} 🎟`);
      chaosNotice = `Хаос-сезон ${id} завершён: ступень «${ctName(ti)}». Награда: ${CHAOS_CFG.coins[ti]} ◆${got.map(g => ', ' + g).join('')}.`;
    }
    save.chaos = { id: chaosNow, pts: 0 };
  }
  if (save.archTok === undefined) {   // 1.7.0: tokens for the seasons already played
    save.archTok = 0; archTokAdd(save.seasonLog.reduce((a, x) => a + ARCH_TOK_LEAGUE[x.league], 0) + save.chaosLog.length * ARCH_TOK_CHAOS + 1);
  }
  save.schema = 3;
  // ---- 1.7.0: catalog migration. Removed items are replaced by the closest new one of the same rarity and source;
  // if the replacement is already owned, coins by rarity. Equipped items and duplicate stars follow the replacement. ----
  if (!save.mig170) {
    const MIG_COINS = { common: 300, rare: 750, epic: 1800, legendary: 4500 };
    // old id → [new id, rarity of the old item]
    const SK_MAP = { mint: ['marmalade', 'common'], lavender: ['marmalade', 'common'], sun: ['melon', 'common'], cherry: ['amanita', 'common'], neonpink: ['neon', 'common'], sunset: ['ocean', 'common'],
      tiger: ['c_caramel', 'common'], toxic: ['c_marble', 'common'], lime: ['c_soda', 'common'], plasma: ['c_nebula', 'rare'], king: ['c_chrome', 'rare'], ghost: ['c_neontiger', 'rare'],
      galaxy: ['c_lavalamp', 'epic'], quasar: ['c_crystal', 'epic'], aurora: ['c_chameleon', 'epic'], rainbow: ['c_crystal', 'epic'], emperor: ['c_starborn', 'legendary'], blackhole: ['c_starborn', 'legendary'],
      c_mint: ['c_soda', 'common'], c_berry: ['c_marble', 'common'], c_solar: ['c_crystal', 'epic'], c_diamond: ['c_starborn', 'legendary'],
      hologram: ['matrix', 'rare'], glacier: ['abyss', 'epic'], zebra: ['champion', 'rare'], pulsar: ['phoenix', 'epic'], prism: ['champion', 'rare'], shade: ['abyss', 'epic'] };
    const FX_MAP = { starTrail: ['bubbleTrail', 'common'], fireTrail: ['bubbleTrail', 'common'], pulseAura: ['orbitAura', 'common'], boltEat: ['shockEat', 'common'], haloAura: ['binaryAura', 'rare'],
      cometTrail: ['goldTrail', 'rare'], galaxyTrail: ['pixelTrail', 'epic'], quantumTrail: ['pixelTrail', 'legendary'], starveilTrail: ['pixelTrail', 'legendary'], prismAura: ['snowglobeAura', 'epic'],
      starAura: ['raysAura', 'legendary'], prismEat: ['miniholeEat', 'legendary'], goldEat: ['miniholeEat', 'legendary'], inkTrail: ['leafTrail', 'common'], plasmaTrail: ['pixelTrail', 'epic'],
      auroraTrail: ['raysAura', 'legendary'], rainbowEat: ['raysAura', 'legendary'], lc_stars: ['lc_starAura', 'rare'], lc_spiral: ['lc_starAura', 'epic'],
      starfall: ['supernova', 'epic'], snowTrail: ['rainbowTrail', 'rare'], sparkTrail: ['rainbowTrail', 'rare'], heartTrail: ['rainbowTrail', 'rare'], voidTrail: ['rainbowTrail', 'epic'],
      hexAura: ['electricAura', 'rare'], flameAura: ['electricAura', 'epic'], crownAura: ['electricAura', 'legendary'], cometAura: ['electricAura', 'rare'], galaxyAura: ['electricAura', 'rare'],
      confettiEat: ['supernova', 'rare'], vortexEat: ['supernova', 'epic'] };
    const PET_MAP = { c_p_ice: ['c_p_lav', 'rare'], c_p_plasma: ['c_p_slime', 'epic'], c_p_star: ['c_p_rainbow', 'legendary'], lc_p_jelly: ['lc_p_cupbot', 'epic'] };
    const seasonIdx = (n, even) => { let m = ((n - 1) % 26) + 1; if (even ? m % 2 : !(m % 2)) m = even ? Math.min(26, m + 1) : m - 1; return m; };
    const mapSkin = id => { if (SKINS.some(k => k.id === id)) return null; if (SK_MAP[id]) return SK_MAP[id];
      let m = /^raid_(\d+)$/.exec(id); if (m) return ['raid_q' + raidQuarter(+m[1]), 'epic'];
      m = /^cs_(\d+)$/.exec(id); if (m) return ['cs_q' + chaosQ(+m[1]), 'epic'];
      m = /^s_(\d+)$/.exec(id); if (m) return ['s_' + seasonIdx(+m[1], false), 'epic'];
      m = /^h_(\w+?)_\d{4}_\d$/.exec(id); if (m) return ['h_' + m[1], 'epic'];
      return ['coral', 'common']; };
    const mapFx = id => { if (FX.some(f => f.id === id)) return null; if (FX_MAP[id]) return FX_MAP[id];
      let m = /^sf_(\d+)$/.exec(id); if (m) return ['sf_' + seasonIdx(+m[1], true), 'epic'];
      m = /^hf_(\w+?)_\d{4}_\d$/.exec(id); if (m) return ['hf_' + m[1], 'epic'];
      return ['sparksTrail', 'common']; };
    const mapPet = id => { if (petById(id)) return null; if (PET_MAP[id]) return PET_MAP[id];
      let m = /^p_(\d+)_(pl|ne)$/.exec(id); if (m) return ['p_' + seasonIdx(+m[1], false), 'epic'];
      m = /^hp_(\w+?)_\d{4}_(pl|ne)$/.exec(id); if (m) return ['hp_' + m[1], 'epic'];
      return ['c_p_mint', 'common']; };
    let replaced = 0, coinsBack = 0;
    const migrate = (list, map) => { const out = [], ren = {};
      for (const id of list) { const r = map(id); if (!r) { if (!out.includes(id)) out.push(id); continue; }
        const [to, rar] = r; ren[id] = to; replaced++;
        if (out.includes(to) || list.includes(to)) coinsBack += MIG_COINS[rar] || 300; else out.push(to); }
      return { out, ren }; };
    const sk = migrate(save.skins || [], mapSkin), fx = migrate(save.fxOwned || [], mapFx), pt = migrate(save.pets || [], mapPet);
    save.skins = sk.out.includes('coral') ? sk.out : ['coral', ...sk.out]; save.fxOwned = fx.out; save.pets = pt.out;
    if (sk.ren[save.skin]) save.skin = sk.ren[save.skin];
    if (!SKINS.some(k => k.id === save.skin)) save.skin = 'coral';
    for (const slot of ['trail', 'aura', 'eat']) { const cur = save.fx[slot]; if (cur && fx.ren[cur]) save.fx[slot] = fx.ren[cur]; if (save.fx[slot] && !FX.some(f => f.id === save.fx[slot] && f.slot === slot)) save.fx[slot] = null; }
    if (save.pet && pt.ren[save.pet]) save.pet = pt.ren[save.pet];
    if (save.pet && !petById(save.pet)) save.pet = null;
    if (save.stars) for (const [o, n] of Object.entries(sk.ren)) if (save.stars[o]) { save.stars[n] = Math.max(save.stars[n] || 0, save.stars[o]); delete save.stars[o]; }
    save.archive = null;   // the archive showcase is rebuilt from the new catalog
    save.coins += coinsBack;
    save.mig170 = { replaced, coins: coinsBack };
    persist();
  }
  const LEVEL_DECOR = { 25: ['fr_lv20', 'tt_lv10'], 50: ['fr_lv40', 'tt_lv50'] };
  if (!save.arena170) {   // 1.7.0: «Джунгли», «Пустыня», «Полярная ночь» removed without refund (nobody had them yet)
    save.arenas = save.arenas || [];
    save.arenas = save.arenas.filter(id => ARENAS.some(a => a.id === id));
    if (!ARENAS.some(a => a.id === save.arena)) save.arena = 'default';
    save.chaosRift = Math.max(save.chaosRift || 0, save.chaosTop || 0);
    if (save.chaosRift >= 10 && !save.arenas.includes('inferno')) save.arenas.push('inferno');
    for (const q of [1, 2]) if ((save.colDone || []).includes('col_q' + q)) { const id = q === 1 ? 'sakura' : 'retro'; if (!save.arenas.includes(id)) save.arenas.push(id); }
    save.arena170 = { coins: 0 };
    persist();
  }
  if (!save.deco170) {   // 1.7.0: 260 frames/titles → 64; removed ones become the nearest kept one, repeats become coins
    const MC = { common: 300, rare: 750, epic: 1800, legendary: 4500 };
    const MAP = { fr_pink: ['fr_cyan', 'common'], fr_dash: ['fr_cyan', 'common'], fr_double: ['fr_glow', 'rare'], fr_sunset: ['fr_fire', 'epic'],
      tt_glutton: ['tt_crumb', 'common'], tt_quick: ['tt_crumb', 'common'], tt_hunter: ['tt_tactic', 'rare'], tt_splitter: ['tt_tactic', 'rare'], tt_bosseat: ['tt_storm', 'epic'], tt_legend: ['tt_lord', 'legendary'],
      fr_lg0: [null, 'common'], fr_lg1: [null, 'common'], fr_lg2: [null, 'rare'], tt_lv30: [null, 'epic'], fr_chaos: [null, 'epic'], fr_cq_old: [null, 'epic'] };
    const map = id => { if (decorById(id)) return null; if (MAP[id]) return MAP[id];
      let m = /^(fr|tt)_s_(\d+)$/.exec(id); if (m) return [`${m[1]}_sh${seasonHalf(((+m[2] - 1) % SEASON_YEAR) + 1)}`, m[1] === 'fr' ? 'epic' : 'legendary'];
      m = /^(fr|tt)_cs_(\d+)$/.exec(id); if (m) return [`${m[1] === 'fr' ? 'fr_cq' : 'tt_cq'}${chaosQ(+m[2])}`, m[1] === 'fr' ? 'epic' : 'legendary'];
      if (/^(fr|tt)_m_/.test(id) || /^tt_col_/.test(id)) return [null, 'rare'];
      if (/^tt_sk_/.test(id)) return [null, null];   // replaced by the 3 / 6 / 9 / 13 titles below
      return [null, 'common']; };
    let replaced = 0, coins = 0; const out = [], ren = {};
    for (const id of save.decor || []) { const r = map(id); if (!r) { if (!out.includes(id)) out.push(id); continue; }
      const [to, rar] = r; replaced++; if (to) ren[id] = to;
      if (to && !out.includes(to) && !(save.decor || []).includes(to)) out.push(to); else if (rar) coins += MC[rar]; }
    save.decor = out;
    for (const [n, id] of SKILL_TT) if ((save.skillDone || []).length >= n && !save.decor.includes(id)) save.decor.push(id);
    for (const [L, ids] of Object.entries(LEVEL_DECOR)) if ((save.lvlPaid || 1) >= +L) ids.forEach(id => { if (!save.decor.includes(id)) save.decor.push(id); });
    if (SOLO_MODE_IDS.every(id => masteryLv((save.mastery || {})[id] || 0) >= MASTERY_LV.length) && !save.decor.includes('fr_modes')) save.decor.push('fr_modes');
    for (const k of ['frame', 'title']) { if (save[k] && ren[save[k]]) save[k] = ren[save[k]]; if (save[k] && !decorById(save[k])) save[k] = null; }
    save.deco170 = { replaced, coins: 0 };   // no refund: nobody has the removed ones yet
    persist();
  }
  if (!save.upg170) {   // levels above the new maximum come back as coins at their price
    let back = 0;
    UPG.forEach(u => { const l = save.up[u.id] || 0; if (u.cutCost && l > u.cost.length) { back += u.cutCost.slice(0, l - u.cost.length).reduce((a, b) => a + b, 0); save.up[u.id] = u.cost.length; } });
    if (back) { save.coins += back; save.upgRefund170 = back; }
    save.upg170 = true; persist();
  }
  if (!save.bal209) {   // 2.0.9: «Крупный старт», «Пищеварение», «Жадность», «Удачливость» weaker — 35% back; «Пищеварение» 9–10 fully back
    let back = 0;
    for (const id of ['big', 'digest', 'greed', 'bonus']) { const u = UPG.find(x => x.id === id), l = save.up[id] || 0; for (let k = 0; k < Math.min(l, u.cost.length); k++) back += u.cost[k] * .35; }
    const dg = UPG.find(x => x.id === 'digest'), dl = save.up.digest || 0;
    if (dl > dg.cost.length) { back += dg.cutCost.slice(0, dl - dg.cost.length).reduce((a, b) => a + b, 0); save.up.digest = dg.cost.length; }
    back = Math.round(back / 5) * 5; if (back > 0) { save.coins += back; save.bal209Refund = back; }
    save.bal209 = true; persist();
  }
  if (TEST_MODE) {
    // unlock all content for testing; achievements and challenges stay open so they can be tried
    save.skins = SKINS.map(k => k.id);
    save.fxOwned = FX.map(f => f.id);
    save.pets = PETS.map(pt => pt.id);
    UPG.forEach(u => save.up[u.id] = u.cost.length);
    save.coins = Math.max(save.coins, 999999);
    if (!save.testInit) { save.xp = Math.max(save.xp, 5000000); save.testInit = true; }   // max level once; the test panel can change it later
    save.abil.owned = [...new Set([...save.abil.owned, ...BASE_ABIL.map(a => a.id)])]; save.abil.xa = XA_ABIL.map(a => a.id);
    save.chests = Math.max(save.chests, 25);
    save.hats = Object.keys(HATS); save.decor = DECOR.map(d => d.id); save.arenas = ARENAS.map(a => a.id);
  }
  save.totals.timedWins = save.totals.timedWins || 0;
  save.totals.splits = save.totals.splits || 0;
  for (const k of ['crownWins', 'raceWins', 'giantWins', 'dailies', 'bestWave', 'bestKills', 'time']) save.totals[k] = save.totals[k] || 0;
  // long challenges with exclusive rewards; progress comes from lifetime totals and records
  const CHALLENGES = [
    { id: 'ch_boss10',    name: 'Истребитель боссов', desc: 'Победи 25 боссов',                          goal: 25,   prog: () => save.totals.bosses,    reward: ['skin', 'champion'] },
    { id: 'ch_kills150',  name: 'Ужас арены',         desc: 'Съешь 300 капель за всё время',             goal: 300,  prog: () => save.totals.kills,     reward: ['fx', 'supernova'] },
    { id: 'ch_surv8',     name: 'Неуловимый',         desc: 'Продержись 8 минут в «Выживании»',          goal: 480,  prog: () => save.bests.survival || 0, time: true, reward: ['fx', 'rainbowTrail'] },
    { id: 'ch_timed5',    name: 'Король турниров',    desc: 'Займи 1 место в «На время» 5 раз',           goal: 5,    prog: () => save.totals.timedWins, reward: ['skin', 'phoenix'] },
    { id: 'ch_rounds50',  name: 'Марафонец',          desc: 'Сыграй 50 раундов',                         goal: 50,   prog: () => save.totals.rounds,    reward: ['fx', 'electricAura'] },
    { id: 'ch_team10',    name: 'Мастер импровизации', desc: 'Сыграй 25 раундов в «Случайном билде»',      goal: 25,   prog: () => (save.totals.modeRounds || {}).rbuild || 0, reward: ['skin', 'abyss'] },   // 2.1.0: was «Капитан» (team battle)
    { id: 'ch_split1000', name: 'Рой разума',         desc: 'Разделись на 10 частей за один раунд',       goal: 10,   prog: () => Math.max(save.totals.bestParts || 0, (save.bests.split || 0) >= 4000 ? 10 : 0), reward: ['skin', 'matrix'] },
    { id: 'ch_crumbs20k', name: 'Ненасытный',         desc: 'Собери 20 000 крошек за всё время',         goal: 20000, prog: () => save.totals.crumbs,   reward: ['skin', 'magma'] },
    { id: 'ch_mass10k',   name: 'Сверхгигант',        desc: 'Набери массу 10 000 в «Классике»',          goal: 10000, prog: () => save.bests.classic || 0, reward: ['skin', 'titan'] },
    { id: 'ch_race2',     name: 'Плечом к плечу',     desc: 'Пройдите 10 волн вдвоём в «Спине к спине»',  goal: 1,    prog: () => (save.bests.race > 0 && save.bests.race <= 300) || duoBestWave() >= 10 ? 1 : 0, reward: ['deco', 'fr_finish'] },
    { id: 'ch_crown5',    name: 'Венценосный',        desc: 'Победи в «Захвате короны» 5 раз',           goal: 5,    prog: () => save.totals.crownWins, reward: ['deco', 'tt_crowned'] },
    { id: 'ch_daily7',    name: 'Постоянство',        desc: 'Выиграй 7 матчей в «Захвате территории»', goal: 7,    prog: () => Math.max(save.totals.dailies || 0, (save.duo && save.duo.territory && save.duo.territory.wins) || 0),   reward: ['deco', 'fr_calendar'] },
    { id: 'ch_giant5',    name: 'Гроза гигантов',     desc: 'Победи босса недели в «Босс-рейде» 2 раза',  goal: 2,    prog: () => Math.max(save.raidWins || 0, Math.floor((save.totals.giantWins || 0) / 2.5)), reward: ['deco', 'tt_giants'] },
    { id: 'ch_hard1500',  name: 'Тёмная сторона',     desc: 'Набери массу 5000 в «Хардкоре»',            goal: 5000, prog: () => save.bests.hardcore || 0, reward: ['deco', 'fr_dark'] },
    { id: 'ch_surv20',    name: 'Двадцатая волна',    desc: 'Дойди до 20-й волны в «Выживании»',         goal: 20,   prog: () => save.totals.bestWave,  reward: ['deco', 'tt_unbreak'] },
  ];
  const rewardName = r => !r ? 'сундук' : (([type, id]) => type === 'skin' ? `скин «${SKINS.find(k => k.id === id).name}»` : type === 'deco' ? `${decorById(id).kind === 'frame' ? 'рамка' : 'титул'} «${decorById(id).name}»` : `эффект «${FX.find(f => f.id === id).name}»`)(r);
  const CH_TIER = { ch_rounds50: 'common', ch_daily7: 'common', ch_crumbs20k: 'common',
    ch_boss10: 'rare', ch_kills150: 'rare', ch_team10: 'rare', ch_race2: 'rare', ch_split1000: 'rare',
    ch_surv8: 'epic', ch_timed5: 'epic', ch_hard1500: 'epic', ch_crown5: 'epic', ch_giant5: 'epic',
    ch_mass10k: 'legendary', ch_surv20: 'legendary' };
  if (!save.ach170) {   // 1.7.0: old achievements count toward the new lines (no coins taken back, the steps reached are not paid again)
    const old = save.ach || [], has = id => old.includes(id), B = save.achBest = save.achBest || {};
    if (has('mass8000') || has('mass5000')) B.mass = Math.max(B.mass || 0, 5000); else if (has('mass2500') || has('mass1500')) B.mass = Math.max(B.mass || 0, 1500);
    B.mass = Math.max(B.mass || 0, ...['classic', 'hardcore', 'split'].map(m => Math.min(12000, +((save.bests || {})[m]) || 0)), 0);
    if (has('survive5')) B.survT = Math.max(B.survT || 0, 300);
    B.wave = Math.max(B.wave || 0, (save.totals && save.totals.bestWave) || 0, has('wave10') ? 10 : 0);
    save.achT = save.achT || {};
    const keepHol = old.filter(id => ACH.some(a => a.id === id && a.hol));
    save.ach = keepHol;
    const t0 = save.totals || {}, T0 = { kills: t0.kills || 0, bosses: t0.bosses || 0, starKills: t0.starKills || 0, bestCombo: t0.bestCombo || 0 };
    for (const a of ACH.filter(x => x.line)) { const n = Math.min(3, a.stepOf(T0, B)); save.achT[a.id] = n; if (n >= 3) { save.ach.push(a.id); if (a.title && !save.decor.includes(a.title)) save.decor.push(a.title); } }
    save.chDone = (save.chDone || []).filter(id => CHALLENGES.some(c => c.id === id));
    for (const c of CHALLENGES) if (save.chDone.includes(c.id) && c.reward && c.reward[0] === 'deco' && !save.decor.includes(c.reward[1])) save.decor.push(c.reward[1]);
    save.ach170 = true; persist();
  }
  function checkChallenges() {
    const got = [];
    for (const ch of CHALLENGES) {
      if (save.chDone.includes(ch.id) || ch.prog() < ch.goal) continue;
      save.chDone.push(ch.id);
      const [type, id] = ch.reward || [];
      if (type === 'skin' && !save.skins.includes(id)) save.skins.push(id);
      if (type === 'fx' && !save.fxOwned.includes(id)) save.fxOwned.push(id);
      if (type === 'deco' && !save.decor.includes(id)) save.decor.push(id);
      got.push(ch);
      save.special.push({ kind: 'challenge', rar: CH_TIER[ch.id] || 'rare', title: ch.name });
    }
    return got;
  }
  // one-time reset of score stats after the runaway-growth bug
  if (!save.scoreReset1) { save.best = 0; save.bests.classic = 0; save.coins = 0; save.scoreReset1 = true; persist(); }
  if (TEST_MODE) save.coins = Math.max(save.coins, 999999);
  // every level pays 50 × level coins; every 5th a chest; 10/20/30/40/50 a frame or a title
  const levelChest = L => L % 10 ? null : L <= 10 ? 'rare' : L <= 30 ? 'epic' : 'legendary';   // 1.7.0: every 10 levels
  function payLevels(to) {
    const out = [];
    for (let L = (save.lvlPaid || 1) + 1; L <= to; L++) {
      const c = 50 * L; save.coins += c; const parts = [`+${c} ◆`];
      const ch = levelChest(L); if (ch) { save.special.push({ kind: 'challenge', rar: ch, title: `Уровень ${L}` }); parts.push(`сундук «${RARITY[ch].name}»`); }
      for (const d of LEVEL_DECOR[L] || []) if (!save.decor.includes(d)) { save.decor.push(d); parts.push(`${decorById(d).kind === 'frame' ? 'рамка' : 'титул'} «${decorById(d).name}»`); }
      out.push(`<li class="done"><span>⬆ Уровень ${L}</span><span class="rw">${parts.join(' + ')}</span></li>`);
    }
    save.lvlPaid = Math.max(save.lvlPaid || 1, to);
    return out.join('');
  }
  const playerLevel = () => levelInfo(save.xp).level;
  const skin = () => SKINS.find(s => s.id === save.skin) || SKINS[0];

