  // TEST MODE: everything unlocked, saved under a separate key so real progress is untouched.
  const TEST_MODE = false;   // ВНИМАНИЕ: перед заливкой в репозиторий вернуть false (сборка PWA проверяет это)
  const SAVE_KEY = TEST_MODE ? 'blobs3d-save-test' : 'blobs3d-save-v2';
  // the field's radius and the number of crumbs change with the mode (setArenaSize): modes for two play on a field twice as wide
  let R = 237.5, FOOD = 5250;
  const R_BASE = R, FOOD_BASE = FOOD, R_MAX = R * 2, FOOD_MAX = 12000, START_MASS = 10, MAX_BONUS = 6;
  const MAX_MASS = 15000;   // player per-part cap
  const BOT_MASS_CAP = 10000;  // total mass cap for each regular bot
  const BOSS_MASS_CAP = 12000; // ordinary bosses; survival and raid have separate caps
  const MODES = {
    classic:  { name: 'Классика',       desc: 'Обычный раунд до поражения' },
    timed:    { name: 'На время',       desc: '3 минуты, награда за место' },
    survival: { name: 'Выживание',      desc: 'Волна боссов каждые 15 с, каждая сильнее' },
    split:    { name: 'Только деление', desc: 'Без рывка, деление раз в 3 с, до 10 частей' },
    crown:    { name: 'Захват короны',  desc: 'Корона у самой крупной капли. Держи её дольше всех — матч до поражения' },
    race:     { name: 'Гонка массы',    desc: 'Кто первым наберёт 4000. Рекорд — лучшее время' },
    rbuild:   { name: 'Случайный билд', desc: 'Каждый раунд — 3 случайные способности из 12 обычных, даже не купленные. Опыт ×1,2', lvl: 10 },
    team:     { name: 'Командный бой',  desc: 'Ты и 5 союзников против 6 соперников, 4 минуты' },
    giant:    { name: 'Охота на Колосса', desc: 'Огромный босс делится, когда к нему подплываешь. Съешь все части' },
    hardcore: { name: 'Хардкор',        desc: 'Без бонусов и второго шанса, боты агрессивнее. Монеты ×1,6' },
    // modes for two phones on one network (a room by code): marked «вдвоём · локально» everywhere; 2.5 — replaces «Испытание дня»
    territory: { name: 'Захват территории', desc: 'Вдвоём, на двух телефонах. Поле разделено границей: ешь ботов на своей половине, расти — и граница ползёт к сопернику. 4 минуты, досрочная победа при 80% поля', duo: true },
    raid:     { name: 'Босс-рейд',      desc: 'Босс недели: урон копится между попытками. 3 попытки в день, за победу — уникальный скин' },
    royale:   { name: 'Королевская битва', desc: 'Арена сужается, боты не возрождаются, побеждает последний. Только в лиге, в свой сезон' },
  };
  const TIMED_LEN = 180, PLACE_BONUS = [40, 25, 15];
  const RACE_GOAL = 4000, TEAM_LEN = 240, DAILY_GOAL = 3000, ALLY_COLOR = '#6fa8ff';
  const LOWER_BETTER = { race: true, giant: true };
  // v46: «Только деление» and «Охота на Колосса» were removed: «Только деление» lives on as a daily modifier, the Colossus as the weekly raid boss
  const REMOVED_MODES = ['split', 'giant', 'team'];   // 2.1.0: «Командный бой» replaced by «Случайный билд»
  const MODE_IDS = Object.keys(MODES).filter(m => !REMOVED_MODES.includes(m));
  // modes for two: no mastery, no solo records; achievements «во всех режимах» count the solo ones
  const isDuoMode = m => !!(MODES[m] && MODES[m].duo), SOLO_MODE_IDS = MODE_IDS.filter(m => !isDuoMode(m));
  const DAILY = [
    { id: 'fog',      name: 'Туман',        desc: 'Видно только ближнее окружение' },
    { id: 'dashonly', name: 'Только рывок', desc: 'Деления нет, рывок раз в секунду' },
    { id: 'splitonly', name: 'Только деление', desc: 'Рывка нет, деление раз в 3 секунды, до 10 частей' },
    { id: 'bosses',   name: 'Нашествие',    desc: 'Боссы каждые 20 секунд, до трёх сразу' },
    { id: 'feast',    name: 'Пир',          desc: 'Крошки дают вдвое больше массы' },
    { id: 'speedy',   name: 'Турбо',        desc: 'Все капли на 30% быстрее' },
  ];
  const today = new Date().toISOString().slice(0, 10);
  // level L → L+1 needs 100 + 75·(L−1) XP; from level 30 on the step doubles: + another 75·(L−29). 50 is the top
  const MAX_LEVEL = 50, LEVEL_STEP = 75, LEVEL_HARD_FROM = 30, LEVEL_HARD_STEP = 75;
  const levelNeed = L => 100 + LEVEL_STEP * (L - 1) + (L >= LEVEL_HARD_FROM ? LEVEL_HARD_STEP * (L - LEVEL_HARD_FROM + 1) : 0);
  function levelInfo(xp) {
    let level = 1, need = levelNeed(1);
    while (xp >= need && level < MAX_LEVEL) { xp -= need; level++; need = levelNeed(level); }
    return { level, into: level >= MAX_LEVEL ? need : xp, need, max: level >= MAX_LEVEL };
  }
  // ================= 2.1.0 prestige: experience above level 50 → ★ stars (tier I, 10 000 each), then ✦ novas (tier II, 20 000 each); looks only =================
  const PS = { star: 10000, nova: 20000, max: 25 };
  const XP_AT_MAX = Array.from({ length: MAX_LEVEL - 1 }, (_, i) => levelNeed(i + 1)).reduce((a, b) => a + b, 0);
  function prestigeOf(xp) {
    const px = (xp || 0) - XP_AT_MAX; if (px < 0) return null;
    const s = Math.min(PS.max, Math.floor(px / PS.star));
    if (s < PS.max) return { s, n: 0, into: px - s * PS.star, need: PS.star, label: `★${s}`, next: `★${s + 1}`, tier: 1 };
    const q = px - PS.max * PS.star, n = Math.min(PS.max, Math.floor(q / PS.nova)), top = n >= PS.max;
    return { s, n, into: top ? PS.nova : q - n * PS.nova, need: PS.nova, label: `✦${n}`, next: top ? null : `✦${n + 1}`, tier: 2, top };
  }
  const psLabel = p => !p ? '' : p.n ? `✦${p.n}` : `★${p.s}`;   // p: {s, n} from a showcase
  const psReached = (p, t, n) => !!p && (t === 1 ? p.s >= n : p.n >= n);
  // [tier, step, kind, id or description]
  const PS_REWARDS = [[1, 1, 'look', 'Серебряная обводка уровня'], [1, 5, 'deco', 'tt_ps5'], [1, 10, 'look', 'Золотая обводка и звёзды у ника в рейтинге'], [1, 18, 'pbg', 'bg_ps_const'], [1, 25, 'deco', 'tt_ps25'],
    [2, 1, 'deco', 'fr_ps_orbit'], [2, 5, 'fx', 'psDust'], [2, 10, 'fx', 'psNova'], [2, 15, 'deco', 'tt_ps_sn'], [2, 20, 'pbg', 'bg_ps_nova'], [2, 25, 'deco', 'tt_ps_lg'], [2, 25, 'pbg', 'bg_ps_gal']];
  // level hexagon outline by prestige: none → cyan/pink, ★1 silver, ★10 gold, ✦25 rainbow
  const psStops = p => !p || (!p.s && !p.n) ? ['#22e6ff', '#ff4fd8'] : p.n >= 25 ? ['#ff4fd8', '#ffd23f', '#3dffa2', '#22e6ff', '#b26bff'] : p.s >= 10 ? ['#fff6a0', '#ffd23f', '#ff9a3d'] : ['#ffffff', '#c0c8e0', '#7d86a6'];
  const xpForLevel = L => { let t = 0; for (let k = 1; k < L; k++) t += levelNeed(k); return t; };
  const dailyMod = DAILY[[...today].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7) % DAILY.length];
  const EJECT_COST = 10, EJECT_MASS = 8, EJECT_MIN = 25, MAX_EJECTS = 60;
  const BASE_ABIL_N = 10, BASE_ABIL_IDS = () => BASE_ABIL.map(a => a.id);
  const ACH = [
    // 1.7.0: 10 lines of 3 steps (I · II · III) — 150 / 400 / 1 000 ◆; III of five hardest lines gives a title. B = save.achBest (per-round bests)
    ...[
      ['ln_hunter', 'Охотник',   'Съешь капли за всё время', ['50 капель', '500 капель', '5 000 капель'], T => [50, 500, 5000].filter(n => T.kills >= n).length],
      ['ln_boss',   'Боссобой',  'Побеждай боссов', ['1 босс', '50 боссов', '500 боссов'], T => [1, 50, 500].filter(n => T.bosses >= n).length, 'tt_ln_boss'],
      ['ln_star',   'Звездобой', 'Съешь ботов-звёзд', ['1 звезда', '25 звёзд', '250 звёзд'], T => [1, 25, 250].filter(n => T.starKills >= n).length, 'tt_ln_star'],
      ['ln_giant',  'Исполин',   'Набери массу за один раунд', ['масса 1 500', 'масса 5 000', 'масса 12 000'], (T, B) => [1500, 5000, 12000].filter(n => (B.mass || 0) >= n).length, 'tt_ln_giant'],
      ['ln_combo',  'Комбо',     'Сделай комбо', ['комбо ×5', 'комбо ×10', 'комбо ×15'], T => [5, 10, 15].filter(n => T.bestCombo >= n).length],
      ['ln_surv',   'Выживший',  'Держись в «Выживании»', ['5 минут', '10-я волна', '15-я волна'], (T, B) => ((B.survT || 0) >= 300 ? 1 : 0) + ((B.wave || 0) >= 10 ? 1 : 0) + ((B.wave || 0) >= 15 ? 1 : 0)],
      ['ln_league', 'Лига',      'Поднимайся в лиге в любом сезоне', ['«Золото»', '«Алмаз»', '«Неон»'], () => [2, 4, 5].filter(n => (save.totals.maxLeague || 0) >= n).length, 'tt_ln_league'],
      ['ln_season', 'Сезоны',    'Собирай значки сезонов', ['1 значок', '6 значков', '26 значков (год)'], () => [1, 6, 26].filter(n => save.seasonLog.length >= n).length],
      ['ln_chaos',  'Хаос',      'Покоряй Хаос-лигу', ['первый бой', '«Разлом»', '«Сингулярность»'], () => ((save.totals.chaosGames || 0) >= 1 ? 1 : 0) + [4, 5].filter(n => (save.totals.chaosMax || 0) >= n).length, 'tt_chaos'],
      ['ln_arsenal', 'Арсенал',  'Собирай способности', ['1 способность', 'способность 5 ур.', `все ${BASE_ABIL_N} из магазина`], () => (save.abil.bought.length >= 1 ? 1 : 0) + (Object.values(save.abil.lv).some(l => l >= 5) ? 1 : 0) + (BASE_ABIL_IDS().every(id => save.abil.owned.includes(id)) ? 1 : 0)],
    ].map(([id, name, desc, steps, f, title]) => ({ id, line: true, name, desc, steps, pay: [150, 400, 1000], coins: 1550, title, stepOf: (T, B) => Math.min(steps.length, f(T || achTotals(), B || save.achBest || {})) })),
    // holiday achievements carry the year: «Новый год 2027», «Хэллоуин 2027», «День влюблённых 2028»…
    ...[['newyear', 'Новый год', 'ny', 'Новогоднем сезоне', ['Бронза', 'Серебро', 'Золото', 'Платина', 'Алмаз', 'Неон']],
        ['valentine', 'День влюблённых', 'vd', 'сезоне «День влюблённых', ['Бронза', 'Серебро', 'Золото', 'Платина', 'Алмаз', 'Неон']],
        ['halloween', 'Хэллоуин', 'hw', 'сезоне «Хэллоуин', ['Бронза', 'Серебро', 'Золото', 'Платина', 'Алмаз', 'Неон']]]
      .flatMap(([k, title, pre, where, names]) => [2027, 2028, 2029].map(y => {
        const key = k + '_' + y, inSeason = k === 'newyear' ? `«${where} ${y}»` : `${where} ${y}»`;
        // one achievement with 6 steps: points in the season, then Серебро … Неон; each step pays once
        const steps = ['очки в сезоне', ...names.slice(1)], pay = [100, 50, 100, 200, 400, 800];
        return { id: `${pre}_${y}_all`, name: `${title} ${y}`, desc: `Набери очки в ${inSeason} и поднимайся по лигам`, coins: pay.reduce((a, b) => a + b, 0), steps, pay, hol: true,
          stepOf: () => { const v = (save.totals.holLeagueY || {})[key]; return v === undefined ? 0 : 1 + Math.max(0, v); },
          test: function () { return this.stepOf() >= 6; } };
      })),
  ];
  // holiday gift boxes: one achievement per edition (given when the box is opened)
  ACH.push({ id: 'ev_bday2026', name: 'Гость на дне рождения 2026', desc: 'Открой праздничную коробку в день рождения разработчика (15–20 ноября 2026)', coins: 0, hol: true, test: () => (save.gifts || []).includes('bday2026') });
  const SPLIT_CD = 10, BOT_PARTS = 4, DASH_MULT = 3.2;
  // ================= abilities: ALL tunable numbers live in this table =================
  // slots: 3 build slots; levels: upgrade levels of a bought ability; level 1 costs firstLevel × price, each next × growth;
  // every level: cooldown −cdPerLv, power (duration / distance / radius / force) +powPerLv.
  const ABIL_CFG = { slots: 3, levels: 5, firstLevel: .75, growth: 1.5, cdPerLv: .04, powPerLv: .065,
    rankedBuild: ['dash', 'split', 'eject'], newBuild: ['dash', 'split', null], oldBuild: ['dash', 'split', 'eject'],
    slotBtn: ['dash', 'split', 'eject'], slotKey: ['Space', 'KeyE', 'KeyQ'], slotKeyName: ['Пробел', 'E', 'Q'],
    arsenalCoins: 5000, slowFactor: .5, shrinkSpeed: 1.25, maxTraps: 2, decoySpeed: .55 };
  const ABILITIES = [
    { id: 'dash',   name: 'Рывок',             sh: 'Рывок',   icon: '»', color: '#ff4fd8', price: 0,     branches: ['dash', 'light'], desc: 'Короткое ускорение: ×3,2 от стартовой скорости у маленькой капли, у крупной меньше (масса 10 000 — примерно ×1,6). Забирает немного массы' },
    { id: 'split',  name: 'Деление',           sh: 'Деление', icon: '◐', color: '#22e6ff', price: 0,     branches: ['splitmax', 'merge'], desc: 'Капля делится пополам и бросает часть вперёд. Части потом сливаются' },
    { id: 'eject',  name: 'Выброс массы',      sh: 'Выброс',  icon: '•', color: '#3dffa2', price: 5000,  cd: .12, dist: 1, desc: 'Отдаёт кусочек массы вперёд: стать легче, покормить шип или союзника. Улучшение: выброс летит дальше' },
    { id: 'shield', name: 'Щит',               sh: 'Щит',     icon: '⛨', color: '#9fe8ff', price: 15000, cd: 25, dur: 6,  desc: '6 с тебя нельзя съесть; кто попробует — отлетает и теряет 5% массы. Шипы всё равно рвут крупную каплю' },
    { id: 'pulse',  name: 'Насыщение',         sh: 'Насыщ.',  icon: '✦', color: '#ffd23f', price: 12000, cd: 24, dur: 5,  desc: 'На 5 с обычная еда даёт вдвое больше массы' },
    { id: 'blink',  name: 'Скачок',            sh: 'Скачок',  icon: '⇢', color: '#b26bff', price: 20000, cd: 18, dist: 24, desc: 'Мгновенный перенос вперёд на увеличенную дистанцию; на старом месте на 1 с остаётся тень, за которой гонятся боты' },
    { id: 'slow',   name: 'Импульс',           sh: 'Импульс', icon: '⦿', color: '#4d7cff', price: 25000, cd: 22, dur: 15, radius: 36, desc: 'Волна вдвое замедляет соперников в радиусе на 15 с — рывки и ускорения тоже работают вполсилы' },
    { id: 'cloak',  name: 'Маскировка',        sh: 'Маскир.', icon: '◌', color: '#c9c2ff', price: 30000, cd: 28, dur: 4,  desc: '4 с боты тебя не видят; первая капля, съеденная из маскировки, даёт +15% массы' },
    { id: 'push',   name: 'Отражение',         sh: 'Отраж.',  icon: '⤺', color: '#ff9a3d', price: 22000, cd: 22, radius: 29, force: 100, stun: .6, desc: 'Мощно отбрасывает соперников в радиусе действия; крупные капли отбрасываются с повышенной силой' },
    { id: 'shrink', name: 'Сжатие',            sh: 'Сжатие',  icon: '⊙', color: '#7fe8ff', price: 14000, cd: 24, dur: 4, size: .3, desc: '4 с: на 30% меньше, на 25% быстрее, шипы не режут. Масса та же, есть можно только еду' },
    { id: 'decoy',  name: 'Клон',              sh: 'Клон',    icon: '◎', color: '#ff6ad5', price: 28000, cd: 28, dur: 5,  desc: 'Клон бежит туда, куда ты смотришь; если его схватят — рассыпается крошками и замедляет схватившего' },
    { id: 'trap',   name: 'Ловушка',           sh: 'Ловушка', icon: '✳', color: '#3dff6e', price: 35000, cd: 32, dur: 10, desc: 'Мина-шип на 10 с: срабатывает от крупной чужой капли и разрывает её на части. Тебя и союзников не трогает, не больше 2 сразу' },
    // Chaos League exclusives (xa): no price, no upgrades; from Chaos League «Сингулярность» seasons, one per season in this order
    { id: 'x_hole',    xa: true, name: 'Чёрная дыра',          sh: 'Дыра',     icon: '◉', color: '#b26bff', cd: 35, dur: 4, dist: 20, radius: 20, desc: 'Точка впереди 4 с втягивает еду и крошки — капли не трогает' },
    { id: 'x_ice',     xa: true, name: 'Ледяной след',         sh: 'Лёд',      icon: '❄', color: '#9fe8ff', cd: 30, dur: 4, radius: 5, desc: '4 с за тобой остаётся лёд: на нём соперники скользят и теряют управление' },
    { id: 'x_over',    xa: true, name: 'Перегрузка',           sh: 'Перегруз', icon: '⚡', color: '#ffd23f', cd: 45, dur: 3, desc: 'Сбрасывает перезарядку остальных способностей (и рывка с делением) и даёт 3 с ускорения' },
    { id: 'x_refl',    xa: true, name: 'Шипастая броня',       sh: 'Броня',    icon: '✹', color: '#c0c8e0', cd: 30, dur: 3, force: 45, desc: '3 с на капле шипы: кто коснётся и больше тебя — теряет 15% массы и отлетает' },
    { id: 'x_meteor',  xa: true, name: 'Метеорный дождь',      sh: 'Метеоры',  icon: '☄', color: '#ff6a00', cd: 38, dist: 22, radius: 10, force: 50, desc: '3 метеора падают в точки впереди: крупные капли разбивают на части, остальных отбрасывают' },
    { id: 'x_twin',    xa: true, name: 'Зеркальный двойник',   sh: 'Двойник',  icon: '⧉', color: '#3dffa2', cd: 28, dur: 5, desc: 'Вторая часть 5 с зеркально повторяет твои движения, потом сливается с тобой' },
    { id: 'x_ghost',   xa: true, name: 'Фантом',               sh: 'Фантом',  icon: '☁', color: '#e8ecff', cd: 40, dur: 3, radius: 22, force: 45, desc: '3 с сквозь всё: тебя нельзя съесть, но и есть нельзя. На выходе — ударная волна' },
    { id: 'x_anchor',  xa: true, name: 'Гравитационный колодец', sh: 'Колодец', icon: '⚓', color: '#4d7cff', cd: 35, dur: 4, radius: 22, desc: 'Зона на 4 с стягивает соперников к центру' },
    { id: 'x_hunt',    xa: true, name: 'Охота',                sh: 'Охота',    icon: '➹', color: '#ff2d55', cd: 22, radius: 60, force: 80, desc: 'Рывок с наведением на ближайшую каплю меньше тебя; поймал за 1,5 с — +10% массы' },
    { id: 'x_vamp',    xa: true, name: 'Кровопийца',           sh: 'Кровоп.',  icon: '♆', color: '#c2185b', cd: 40, dur: 5, radius: 12, desc: '5 с соседние капли меньше тебя понемногу теряют массу, а ты её получаешь' },
    { id: 'x_typhoon', xa: true, name: 'Тайфун',               sh: 'Тайфун',   icon: '🌀', color: '#7fe8ff', cd: 35, dur: 3, radius: 18, desc: 'Вихрь вокруг тебя 3 с раскидывает мелкие капли и отбивает выбросы' },
    { id: 'x_phase',   xa: true, name: 'Фазовый скачок',       sh: 'Фаза',     icon: '⇉', color: '#ff4fd8', cd: 28, dist: 14, desc: 'Скачок вперёд, и в течение 2 с — второй, в новом направлении' },
    // 2.3 workshop «Хронос» (cr): crafted, no price, no upgrades, ordinary modes only
    { id: 'cr_gearwall', cr: true, name: 'Стена шестерён', sh: 'Стена', icon: '⚙', color: '#e8b05a', cd: 26, dur: 5, dmg: .05, desc: 'Ставит перед тобой стену из вращающихся шестерён на 5 с. Кто врежется — отскакивает и теряет 5% массы' },
    { id: 'cr_rewind',   cr: true, name: 'Перемотка',      sh: 'Назад', icon: '⟲', color: '#22e6ff', cd: 40, back: 4, desc: 'Возвращает тебя туда, где ты был 4 с назад, и с той массой, если она была больше' },
    { id: 'cr_swap',     cr: true, name: 'Рокировка',      sh: 'Рокир.', icon: '⇄', color: '#b26bff', cd: 30, radius: 25, desc: 'Меняет тебя местами с ближайшей каплей впереди (в радиусе 25)' },
  ];
  const abilById = id => ABILITIES.find(a => a.id === id);
  const BASE_ABIL = ABILITIES.filter(a => !a.xa && !a.cr), XA_ABIL = ABILITIES.filter(a => a.xa), CR_ABIL = ABILITIES.filter(a => a.cr);
  const abUpCost = (a, lv) => Math.round(a.price * ABIL_CFG.firstLevel * Math.pow(ABIL_CFG.growth, lv) / 50) * 50;   // price of level lv+1   // dash = 3.2x the starting speed, whatever the mass
  const OLD_SPEED = 11, BASE_SPEED = OLD_SPEED * 3;   // everyone moves 3x faster than the first version (shown as 300%)   // split cooldown (s) for everyone, part limit for bots
  const css = getComputedStyle(document.documentElement);
  const tok = k => css.getPropertyValue(k).trim();
  const C = k => new THREE.Color(tok(k));
  const $ = id => document.getElementById(id);
  const fmtTime = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  // ================= content =================
  const PRICE_MULT = 2;   // all shop prices (upgrades, skins, effects)
  const COIN_MULT_CAP = 2;   // 2.0.9: the product of all coin multipliers of a round never goes above this
  const costs = (base, n, g = 1.38) => Array.from({ length: n }, (_, i) => Math.round(base * PRICE_MULT * Math.pow(g, i) / 5) * 5);
  const UPG = [
    { id: 'big',      lvl: 1, name: 'Крупный старт',    desc: '+1 к стартовой массе за уровень', cost: costs(30, 10), info: l => `старт ${10 + l} массы` },
    { id: 'speed',    lvl: 1, name: 'Обтекаемость',     desc: '+1% к скорости за уровень. Бонус «Ускорение» даёт +45%. Рывок: ×3,2 от стартовой скорости у маленькой капли, у крупной меньше', cost: costs(40, 10), info: l => `скорость ${100 + l}% (+${l}%)` },
    { id: 'dash',     lvl: 1, name: 'Реактивный рывок', desc: 'Рывок перезаряжается на 3% быстрее за уровень', cost: costs(35, 8), info: l => `перезарядка ${(4 * (1 - 0.03 * l)).toFixed(2)} с` },
    { id: 'greed',    lvl: 1, name: 'Жадность',         desc: '+2% монет за раунд за уровень', cost: costs(50, 10), info: l => `+${2 * l}% монет` },
    { id: 'magnet',   lvl: 2, name: 'Магнит',           desc: 'Подбираешь крошки дальше на 0,8 за уровень', cost: costs(40, 8), info: l => `+${(0.8 * l).toFixed(1)} к радиусу` },
    { id: 'splitmax', lvl: 3, name: 'Больше частей',    desc: '+1 к максимуму частей за уровень (базово 4)', cost: costs(80, 6, 1.5), info: l => `${4 + l} частей` },
    { id: 'bonus',    lvl: 3, name: 'Удачливость',      desc: 'Бонусы действуют на 5% дольше за уровень', cost: costs(50, 8), info: l => `+${5 * l}% к длительности` },
    { id: 'digest',   lvl: 4, name: 'Пищеварение',      desc: '+1,5% массы от еды и крошек за уровень (съеденные капли — без бонуса)', cost: costs(60, 10), info: l => `+${String(1.5 * l).replace('.', ',')}% массы с еды` },
    { id: 'merge',    lvl: 4, name: 'Быстрое слияние',  desc: 'Части сливаются на 3% быстрее за уровень', cost: costs(50, 8), info: l => `слияние ${(14 * (1 - 0.03 * l)).toFixed(1)} с` },
    { id: 'life',     lvl: 5, name: 'Второй шанс',      desc: '+1 спасение за раунд: возрождаешься с 40% массы. В «Хардкоре» не действует', cost: costs(300, 3, 2.5), info: l => `спасений: ${l}` },
    { id: 'light',    lvl: 5, name: 'Лёгкий рывок',     desc: 'Рывок длиннее, а массы забирает на 8% меньше за уровень', cost: costs(40, 6), info: l => `рывок ${(0.35 + 0.035 * l).toFixed(2)} с (×${((0.35 + 0.035 * l) / 0.35).toFixed(2)} длины), −${(3 * (1 - 0.08 * l)).toFixed(1)}% массы` },
    { id: 'spike',    lvl: 4, name: 'Шипостойкость',    desc: 'Шип разрывает тебя на 1 часть меньше за уровень (без улучшения — до 8 частей)', cost: costs(45, 4), info: l => `не больше ${8 - l} частей` },
    { id: 'guard',    lvl: 6, name: 'Защита',           desc: 'Крупная капля теряет массу на 4% медленнее, а врагу нужно быть на 1% крупнее, чтобы съесть тебя — за каждый уровень', cost: costs(80, 8), info: l => `−${4 * l}% потерь, +${l}% к защите` },
    { id: 'keep',     hidden: true, lvl: 6, name: 'Сохранность',      desc: 'Крупная капля теряет массу на 10% медленнее за уровень', cost: costs(50, 8), info: l => `−${10 * l}% потерь` },
    { id: 'armor',    hidden: true, lvl: 7, name: 'Плотная оболочка', desc: 'Врагу нужно быть на 3% крупнее за уровень, чтобы съесть тебя', cost: costs(80, 8), info: l => `+${3 * l}% к защите` },
  ];
  UPG.forEach(u => { if (u.lvl > 1) u.lvl = 2 * u.lvl - 1; });
  // economy: the upper half of every upgrade's levels costs 50% more (the first levels stay cheap)
  UPG.forEach(u => { const h = Math.ceil(u.cost.length / 2); u.cost = u.cost.map((c, i) => i >= h ? Math.round(c * 1.5 / 5) * 5 : c); });
  // 1.6.3: upgrades cost 50% more
  UPG.forEach(u => { u.oldCost = u.cost; u.cost = u.cost.map(c => Math.round(c * 1.5 / 5) * 5); });
  // 1.7.0 part 2: fewer levels where the top was too strong (8 parts, 2 saves); cut levels are refunded below
  const UPG_MAX = { splitmax: 4, life: 2, digest: 8 };   // 2.0.9: «Пищеварение» — 8 levels
  UPG.forEach(u => { if (UPG_MAX[u.id]) { u.cutCost = u.cost.slice(UPG_MAX[u.id]); u.cost = u.cost.slice(0, UPG_MAX[u.id]); } });
  // dash and split upgrades moved to the «Способности» tab as branches of those abilities (same save.up levels)
  const CATS = [
    ['Рост', ['big', 'digest', 'magnet']],
    ['Движение', ['speed']],
    ['Защита', ['life', 'guard', 'spike']],
    ['Награды', ['greed', 'bonus']],
  ];
  // cosmetic effects: one per slot, bought or earned in challenges (ex: true = challenge only)
  // ================= 1.7.0 catalog: every item has its own signature (material, living pattern, detail or shape) =================
  // sources: price (shop) · chest (rarity) · season (league season n) · holiday · chaosQ / raidQ (quarter) · lchest · ch (challenge) · legend · special
  const FX = [
    // shop
    { id: 'sparksTrail',  slot: 'trail', name: 'Искры',           desc: 'Искры цвета твоего скина',                     price: 900,  lvl: 3 },
    { id: 'bubbleTrail',  slot: 'trail', name: 'Пузыри',          desc: 'Пузырьки с бликом всплывают и лопаются',       price: 1800, lvl: 7 },
    { id: 'orbitAura',    slot: 'aura',  name: 'Спутники',        desc: 'Три сферы на разных орбитах',                  price: 1500, lvl: 5 },
    { id: 'ringAura',     slot: 'aura',  name: 'Кольцо',          desc: 'Наклонное неоновое кольцо, как у планеты',     price: 3000, lvl: 11 },
    { id: 'heartEat',     slot: 'eat',   name: 'Сердечки',        desc: 'Из добычи вылетают сердечки',                  price: 1200, lvl: 3 },
    { id: 'shockEat',     slot: 'eat',   name: 'Ударная волна',   desc: 'Двойное кольцо расходится по полу',            price: 2400, lvl: 9 },
    // chests
    { id: 'leafTrail',     slot: 'trail', name: 'Листопад',         desc: 'Кружащиеся зелёные и золотые листья',          chest: 'common' },
    { id: 'moonAura',      slot: 'aura',  name: 'Луна',             desc: 'Одинокая луна с кратерами на орбите',          chest: 'common' },
    { id: 'popEat',        slot: 'eat',   name: 'Хлопушка',         desc: 'Разноцветный хлопок конфетти',                 chest: 'common' },
    { id: 'goldTrail',     slot: 'trail', name: 'Золотая пыль',     desc: 'Сверкающая пыль оседает на пол',               chest: 'rare' },
    { id: 'binaryAura',    slot: 'aura',  name: 'Двойная звезда',   desc: 'Две звезды кружат друг напротив друга',        chest: 'rare' },
    { id: 'iceEat',        slot: 'eat',   name: 'Ледяной взрыв',    desc: 'Осколки льда и холодная волна',                chest: 'rare' },
    { id: 'pixelTrail',    slot: 'trail', name: 'Пиксели',          desc: 'Рассыпающиеся пиксели в духе ретро-игр',       chest: 'epic' },
    { id: 'snowglobeAura', slot: 'aura',  name: 'Снежный шар',      desc: 'Стеклянная сфера, внутри идёт снег',           chest: 'epic' },
    { id: 'miniholeEat',   slot: 'eat',   name: 'Мини-дыра',        desc: 'Добыча исчезает в тёмном вихре',               chest: 'epic' },
    { id: 'raysAura',      slot: 'aura',  name: 'Солнечная корона', desc: 'Вращающиеся золотые лучи и протуберанцы',      chest: 'legendary' },
    // league seasons (Diamond of even seasons)
    { id: 'sf_2',  slot: 'trail', name: 'Кибер-закат',        desc: 'Ретро-полосы заката тянутся за каплей',  season: 2 },
    { id: 'sf_4',  slot: 'aura',  name: 'Неоновый дракон',    desc: 'Неоновый дракон кружит вокруг капли',     season: 4 },
    { id: 'sf_6',  slot: 'eat',   name: 'Солнечный ветер',    desc: 'Поток солнечных частиц и золотая волна',  season: 6 },
    { id: 'sf_8',  slot: 'trail', name: 'Розовая туманность', desc: 'Клубы розового и фиолетового газа',       season: 8 },
    { id: 'sf_10', slot: 'aura',  name: 'Изумрудный пульс',   desc: 'Изумрудные кольца и кристаллы',           season: 10 },
    { id: 'sf_12', slot: 'eat',   name: 'Лунная пыль',        desc: 'Серебряная пыль и полумесяцы',            season: 12 },
    { id: 'sf_14', slot: 'trail', name: 'Кислотный дождь',    desc: 'Капли кислотного цвета стекают на пол',   season: 14 },
    { id: 'sf_16', slot: 'aura',  name: 'Магнитная буря',     desc: 'Дуги магнитного поля вокруг капли',       season: 16 },
    { id: 'sf_18', slot: 'eat',   name: 'Ретро-аркада',       desc: 'Пиксельный взрыв и «+1»',                 season: 18 },
    { id: 'sf_20', slot: 'trail', name: 'Огни мегаполиса',    desc: 'Мигающие огни ночного города',            season: 20 },
    { id: 'sf_22', slot: 'aura',  name: 'Лазерное шоу',       desc: 'Вращающиеся лазерные лучи',               season: 22 },
    { id: 'sf_24', slot: 'eat',   name: 'Гамма-всплеск',      desc: 'Ослепительный луч бьёт вверх',            season: 24 },
    { id: 'sf_26', slot: 'trail', name: 'Кибер-сакура',       desc: 'Неоновые лепестки сакуры',                season: 26 },
    // holidays (Diamond of the holiday season)
    { id: 'hf_halloween', slot: 'trail', name: 'Огоньки на болоте', desc: 'Блуждающие зелёные огоньки',    holiday: 'halloween' },
    { id: 'hf_newyear',   slot: 'aura',  name: 'Гирлянда',          desc: 'Мигающая гирлянда вокруг капли', holiday: 'newyear' },
    { id: 'hf_valentine', slot: 'eat',   name: 'Стрела амура',      desc: 'Стрела и всплеск сердец',        holiday: 'valentine' },
    // league chest
    { id: 'lc_ribbon',   slot: 'trail', name: 'Лента победителя', desc: 'Золотая лента за каплей', colors: ['#ffd23f', '#ffffff'], style: 'ribbon', lchest: 'common' },
    { id: 'lc_starAura', slot: 'aura',  name: 'Лиговые звёзды',   desc: 'Серебряные и синие звёзды на двух орбитах', lchest: 'rare' },
    { id: 'lc_halo',     slot: 'trail', name: 'Неоновый ореол',   desc: 'Расходящиеся неоновые кольца', colors: ['#ff4fd8', '#22e6ff', '#ffd23f'], style: 'rings', lchest: 'legendary' },
    // challenges
    { id: 'rainbowTrail', slot: 'trail', name: 'Радужный след',   desc: 'Переливается всеми цветами',      ch: 'epic' },
    { id: 'electricAura', slot: 'aura',  name: 'Искрящаяся аура', desc: 'По капле бегают разряды',         ch: 'rare' },
    { id: 'supernova',    slot: 'eat',   name: 'Взрыв звезды',    desc: 'Яркий взрыв и две ударные волны', ch: 'epic' },
    // legendary achievements
    { id: 'lg_titanTrail', slot: 'trail', name: 'Тропа титанов',   desc: 'Золотые и алые кольца остаются за каплей', colors: ['#ffd23f', '#ff2d55', '#ffffff'], style: 'rings', legend: 'bosses' },
    { id: 'lg_crownAura',  slot: 'aura',  name: 'Звёздная корона', desc: 'Два кольца золотых и розовых звёзд вращаются навстречу', legend: 'stars3' },
    { id: 'lg_moneyAura',  slot: 'aura',  name: 'Денежный дождь',  desc: 'Золотые монеты кружат и сыплются вокруг капли', legend: 'coins2' },
    { id: 'lg_burstEat',   slot: 'eat',   name: 'Взрыв легенды',   desc: 'Золотая волна, звёзды и радужные искры', legend: 'combo' },
    // special
    { id: 'raidAura', slot: 'aura', name: 'Аура рейдера',    desc: 'Красные осколки кружат вокруг капли', special: 'raid' },
    { id: 'neonAura', slot: 'aura', name: 'Неоновые кольца', desc: 'Три неоновых кольца пульсируют вокруг капли', special: 'league' },
    // 2.1.0 prestige rewards (not sold, not in chests)
    { id: 'psDust', slot: 'trail', name: 'Звёздная пыль', desc: 'Шлейф белых, розовых и голубых искр', prestige: '✦5' },
    { id: 'psNova', slot: 'eat', name: 'Звёздный взрыв', desc: 'Вспышка звезды и кольцо искр', prestige: '✦10' },
    // 2.3 workshop «Хронос» (craft only)
    { id: 'cr_cogs',     slot: 'trail', name: 'Шестерёнки',       desc: 'За каплей катятся и исчезают крупные шестерёнки', craft: 'rare' },
    { id: 'cr_tick',     slot: 'eat',   name: 'Тик-так',          desc: 'На месте добычи вспыхивает циферблат, стрелка делает круг, и он гаснет', craft: 'rare' },
    { id: 'cr_marks',    slot: 'trail', name: 'Часовые отметины', desc: 'За каплей на полу остаётся шкала с рисками и цифрами 12…1, она гаснет', craft: 'epic' },
    { id: 'cr_cogwings', slot: 'aura',  name: 'Шестерни-крылья',  desc: 'По бокам капли парят по две сцепленные шестерни и крутятся навстречу', craft: 'epic' },
    { id: 'cr_freeze',   slot: 'eat',   name: 'Стоп-кадр',        desc: 'Добыча на миг застывает серым кадром, трескается и осыпается латунным песком', craft: 'legendary' },
    { id: 'cr_halo',     slot: 'aura',  name: 'Часовой нимб',     desc: 'Над каплей медленно вращается нимб с римскими цифрами', craft: 'legendary' },
    { id: 'cr_foucault', slot: 'aura',  name: 'Маятник Фуко',     desc: 'Над каплей качается сияющий маятник и рисует на полу переливающуюся розетку', craft: 'legendary' },
  ];
  // older code reads ex / chaos / raid / season flags
  const FX_SLOTS = [['trail', 'След'], ['aura', 'Аура'], ['eat', 'Эффект поедания']];
  const SKINS = [
    // shop: simple but each with its own idea
    { id: 'coral',     name: 'Коралл',      color: '#ff8a5c', anim: 'breath', price: 0, lvl: 1, sig: 'дышит в покое' },
    { id: 'marmalade', name: 'Мармелад',    color: '#ff6ad5', accent: '#ffd1e8', mat: 'jelly', bubbles: true, price: 900, lvl: 3, sig: 'желе с пузырьками, колышется' },
    { id: 'ocean',     name: 'Океан',       color: '#1a5fd1', accent: '#7fe8ff', pattern: 'waves', flow: [.05, 0], price: 1200, lvl: 3, sig: 'бегущие волны' },
    { id: 'melon',     name: 'Арбуз',       color: '#8be36b', accent: '#1f6b2a', pattern: 'melon', price: 1500, lvl: 5, sig: 'полосатая корка' },
    { id: 'amanita',   name: 'Мухомор',     color: '#ff2d4d', accent: '#ffffff', pattern: 'amanita', head: 'cap', price: 2400, lvl: 7, sig: 'шляпка гриба' },
    { id: 'neon',      name: 'Неон',        color: '#14082e', accent: '#22e6ff', mat: 'rim', anim: 'flicker', glow: true, price: 3600, lvl: 9, sig: 'неоновый контур мерцает' },
    { id: 'saturn',    name: 'Сатурн',      color: '#f4c27a', accent: '#8a5a2b', pattern: 'rings', head: 'ring', price: 5400, lvl: 13, sig: 'кольцо планеты' },
    { id: 'cyber',     name: 'Кибер-сетка', color: '#07051a', accent: '#22e6ff', pattern: 'circuit', emi: true, flow: [.04, 0], glow: true, price: 7200, lvl: 17, sig: 'бегущие импульсы' },
    // chests
    { id: 'c_caramel',   name: 'Леденец',          color: '#ffffff', accent: '#ff3d6e', pattern: 'spiral', flow: [.08, 0], chest: 'common', sig: 'закручивающаяся спираль' },
    { id: 'c_marble',    name: 'Мрамор',           color: '#e8e6f0', accent: '#5a5470', pattern: 'marble', mat: 'matte', chest: 'common', sig: 'камень с прожилками' },
    { id: 'c_soda',      name: 'Газировка',        color: '#b9ff3d', accent: '#ffffff', mat: 'glass', bubbles: true, head: 'lemon', glow: true, chest: 'common', sig: 'лаймовое стекло, долька лимона и трубочка' },
    { id: 'c_peach',     name: 'Персиковый закат', color: '#ff9a6a', accent: '#ff4fd8', c2: '#3a0a5a', pattern: 'sunset', chest: 'common', sig: 'солнце за горизонтом' },
    { id: 'c_circuit',   name: 'Микросхема',       color: '#002b1f', accent: '#ffd23f', pattern: 'circuit', emi: true, flow: [0, .06], glow: true, chest: 'rare', sig: 'сигналы по дорожкам' },
    { id: 'c_nebula',    name: 'Туманность',       color: '#2a0a4a', accent: '#ff9ef2', pattern: 'swirl', flow: [.02, 0], glow: true, chest: 'rare', sig: 'плывущие звёзды и газ' },
    { id: 'c_chrome',    name: 'Хром',             color: '#c9d2e6', accent: '#ffffff', pattern: 'waves', flow: [.06, .02], mat: 'liquid', chest: 'rare', sig: 'жидкий металл, бегущие волны' },
    { id: 'c_neontiger', name: 'Неон-тигр',        color: '#ff4fd8', accent: '#120020', pattern: 'tiger', anim: 'flicker', glow: true, chest: 'rare', sig: 'светящиеся полосы со вспышкой' },
    { id: 'c_lavalamp',  name: 'Лава-лампа',       color: '#ff3d6e', accent: '#7b3dff', pattern: 'marble', flow: [0, .05], mat: 'glass', head: 'horns', glow: true, chest: 'epic', sig: 'плывущий воск, рожки' },
    { id: 'c_chameleon', name: 'Хамелеон',         color: '#3dffa2', accent: '#ffffff', pattern: 'scales', anim: 'chameleon', glow: true, chest: 'epic', sig: 'цвет меняется от скорости' },
    { id: 'c_crystal',   name: 'Кристалл',         color: '#9fd8ff', accent: '#ffffff', pattern: 'facets', mat: 'crystal', glow: true, chest: 'epic', sig: 'гранёная форма' },
    { id: 'c_starborn',  name: 'Звездорождённый',  color: '#ff4fd8', rainbow: true, glow: true, head: 'wings', shine: 'bolt', pattern: 'stars', chest: 'legendary', sig: 'радуга и крылья' },
    // league seasons (Diamond of odd seasons)
    { id: 's_1',  name: 'Полярное сияние',     color: '#0b3a3a', accent: '#3dffa2', pattern: 'aurora', flow: [.03, 0], glow: true, season: 1, sig: 'ленты сияния' },
    { id: 's_3',  name: 'Звёздный шторм',      color: '#1c1a6e', accent: '#22e6ff', pattern: 'meteors', flow: [.12, .04], glow: true, pulse: true, season: 3, sig: 'метеоры сквозь стекло' },
    { id: 's_5',  name: 'Ледяная комета',      color: '#e8fbff', accent: '#4d7cff', pattern: 'facets', mat: 'crystal', head: 'icecrown', glow: true, season: 5, sig: 'ледяной кристалл' },
    { id: 's_7',  name: 'Глубокий космос',     color: '#120830', accent: '#b26bff', pattern: 'swirl', flow: [.03, 0], glow: true, season: 7, sig: 'галактика внутри' },
    { id: 's_9',  name: 'Квантовый скачок',    color: '#22e6ff', accent: '#ffd23f', pattern: 'glitch', anim: 'twin', glow: true, season: 9, sig: 'капля двоится' },
    { id: 's_11', name: 'Плазменный вихрь',    color: '#7b3dff', accent: '#ff3d6e', pattern: 'spiral', flow: [.15, 0], glow: true, pulse: true, season: 11, sig: 'спираль плазмы' },
    { id: 's_13', name: 'Сверхновая',          color: '#fff6a0', accent: '#ff4fd8', pattern: 'rings', flow: [0, .35], anim: 'heartbeat', head: 'nova', glow: true, season: 13, sig: 'вспышки ядра' },
    { id: 's_15', name: 'Синтвейв',            color: '#ff4fd8', accent: '#22e6ff', pattern: 'synth', flow: [.02, 0], glow: true, season: 15, sig: 'ретро-солнце и сетка' },
    { id: 's_17', name: 'Электрический лес',   color: '#06140a', accent: '#3dffa2', pattern: 'branches', emi: true, emiColor: '#3dffa2', anim: 'flicker', glow: true, season: 17, sig: 'ветви-молнии' },
    { id: 's_19', name: 'Голографический сон', color: '#22e6ff', accent: '#ff4fd8', pattern: 'scan', flow: [0, .2], holo: true, holoBase: .5, holoSpan: .12, glow: true, season: 19, sig: 'голограмма с развёрткой' },
    { id: 's_21', name: 'Кристальная пещера',  color: '#3a1a6e', accent: '#9fe8ff', pattern: 'facets', mat: 'crystal', head: 'shards', glow: true, season: 21, sig: 'кристаллы на орбите' },
    { id: 's_23', name: 'Червоточина',         color: '#05021a', accent: '#b26bff', pattern: 'vortex', flow: [0, .1], head: 'portal', glow: true, season: 23, sig: 'портальное кольцо' },
    { id: 's_25', name: 'Легенда неона',       color: '#14082e', accent: '#ff4fd8', mat: 'rim', anim: 'heartbeat', crown: true, glow: true, season: 25, sig: 'неоновый контур и корона' },
    // holidays (Neon of the holiday season)
    { id: 'h_halloween', name: 'Тыквенный король', color: '#ff7a00', accent: '#b84a00', pattern: 'ribs', head: 'stem', glow: true, holiday: 'halloween', sig: 'тыква с огоньком' },
    { id: 'h_newyear',   name: 'Снежная королева', color: '#cfefff', accent: '#4d7cff', pattern: 'snow', flow: [0, -.08], mat: 'glass', head: 'icecrown', glow: true, holiday: 'newyear', sig: 'снег внутри стекла' },
    { id: 'h_valentine', name: 'Королева сердец',  color: '#ff2d55', accent: '#ffd1e8', pattern: 'hearts', anim: 'heartbeat', crown: true, glow: true, holiday: 'valentine', sig: 'бьётся сердце' },
    // Chaos League (first «Разлом» of a quarter)
    { id: 'cs_q1', name: 'Глитч',         color: '#0a0a1a', accent: '#ff2d55', pattern: 'glitch', anim: 'glitch', glow: true, chaosQ: 1, sig: 'цифровой сбой' },
    { id: 'cs_q2', name: 'Энтропия',      color: '#140812', accent: '#ff9a3d', pattern: 'shatter', emi: true, emiColor: '#ff9a3d', flow: [.03, -.05], anim: 'dissolve', head: 'fragments', glow: true, chaosQ: 2, sig: 'распадается на светящиеся осколки' },
    { id: 'cs_q3', name: 'Фрактал',       color: '#120830', accent: '#3dffa2', pattern: 'fractal', flow: [.05, .05], glow: true, chaosQ: 3, sig: 'бесконечный узор' },
    { id: 'cs_q4', name: 'Сингулярность', color: '#000000', accent: '#ff4fd8', pattern: 'vortex', head: 'portal', mat: 'chrome', glow: true, chaosQ: 4, sig: 'горизонт событий' },
    // boss raid trophies (quarter)
    { id: 'raid_q1', name: 'Трофей: Громила',   color: '#2a2a32', accent: '#ff2d2d', pattern: 'cracks', emi: true, emiColor: '#ff3d2d', mat: 'magma', anim: 'magma', head: 'warhelm', raidQ: 1, sig: 'железо, раскалённые трещины, рогатый шлем' },
    { id: 'raid_q2', name: 'Трофей: Матка роя', color: '#ffb020', accent: '#5a2a00', pattern: 'hex', head: 'swarm', glow: true, raidQ: 2, sig: 'соты и рой' },
    { id: 'raid_q3', name: 'Трофей: Мимик',     color: '#c0c8e0', mat: 'chrome', anim: 'chameleon', raidQ: 3, sig: 'зеркало, меняет цвет' },
    { id: 'raid_q4', name: 'Трофей: Телепорт',  color: '#120830', accent: '#22e6ff', pattern: 'vortex', head: 'portal', anim: 'twin', glow: true, raidQ: 4, sig: 'портал и мерцание' },
    // league chest
    { id: 'lc_shield',   name: 'Лиговый щит',       color: '#c0c8e0', accent: '#4d7cff', pattern: 'heraldry', head: 'crest', shine: 'stripe', lchest: 'common', sig: 'геральдика и герб лиги' },
    { id: 'lc_cup',      name: 'Чемпионский кубок', color: '#ffd23f', accent: '#fff6a0', pattern: 'laurel', mat: 'gold', head: 'cuphandles', shine: 'stripe', lchest: 'rare', sig: 'полированное золото, ручки кубка' },
    { id: 'lc_diamond',  name: 'Рейтинговый алмаз', color: '#b26bff', accent: '#e8fbff', pattern: 'facets', mat: 'crystal', head: 'gem', shine: 'bolt', lchest: 'epic', sig: 'огранённый алмаз' },
    { id: 'lc_absolute', name: 'Абсолют',           color: '#f4ecff', accent: '#ffd23f', pattern: 'stars', mat: 'pearl', head: 'starcrown', glow: true, lchest: 'legendary', sig: 'перламутр и корона из звёзд' },
    // challenges
    { id: 'champion', name: 'Чемпион', color: '#f4f0e6', accent: '#d9a400', pattern: 'veins', mat: 'matte', head: 'laurel', glow: true, ch: 'rare', sig: 'белый мрамор с золотом, лавры' },
    { id: 'phoenix',  name: 'Феникс',  color: '#ff3d00', accent: '#ffd23f', pattern: 'scales', flow: [0, -.12], head: 'flame', glow: true, ch: 'epic', sig: 'огненные перья' },
    { id: 'magma',    name: 'Магма',   color: '#2a0a00', accent: '#ff6a00', pattern: 'cracks', emi: true, emiColor: '#ff9a3d', mat: 'magma', anim: 'magma', ch: 'epic', sig: 'светящиеся трещины' },
    { id: 'matrix',   name: 'Матрица', color: '#001a0a', accent: '#3dffa2', pattern: 'code', emi: true, emiColor: '#3dffa2', flow: [0, -.25], glow: true, ch: 'rare', sig: 'стекающий код' },
    { id: 'abyss',    name: 'Бездна',  color: '#020210', accent: '#22e6ff', pattern: 'vortex', mat: 'rim', head: 'shards', glow: true, ch: 'epic', sig: 'глубина и осколки' },
    { id: 'titan',    name: 'Титан',   color: '#ffd23f', accent: '#ff4fd8', pattern: 'plates', mat: 'chrome', anim: 'heartbeat', crown: true, ch: 'legendary', sig: 'пластины и пульс ядра' },
    // legendary achievements
    { id: 'lg_worlds',    name: 'Пожиратель миров', color: '#14002a', accent: '#ff2d55', pattern: 'swirl', glow: true, pulse: true, head: 'moons', shine: 'bolt', legend: 'kills', sig: 'луны на орбите' },
    { id: 'lg_tycoon',    name: 'Золотой магнат',   color: '#b07a00', accent: '#ffd23f', pattern: 'coins', mat: 'gold', head: 'coincrown', shine: 'stripe', legend: 'coins', sig: 'стопки монет и корона из монет' },
    { id: 'lg_supernova', name: 'Звёздный взрыв',   color: '#ffffff', accent: '#ff4fd8', pattern: 'stars', holo: true, holoBase: .78, holoSpan: .08, glow: true, pulse: true, head: 'nova', shine: 'bolt', legend: 'stars2', sig: 'взрывы звёзд' },
    { id: 'lg_eternal',   name: 'Вечный чемпион',   color: '#fff6a0', accent: '#ffd23f', pattern: 'laurel', holo: true, holoBase: .1, holoSpan: .04, glow: true, head: 'laurel', shine: 'stripe', legend: 'wins3', sig: 'лавры и сияние' },
    // special
    { id: 'tut_student', name: 'Ученик',  color: '#9fe8ff', accent: '#ffd23f', pattern: 'dots', glow: true, head: 'gradcap', tut: true, sig: 'шапочка выпускника' },
    { id: 'sk_virtuoso', name: 'Виртуоз', color: '#22e6ff', accent: '#ff4fd8', pattern: 'zigzag', glow: true, pulse: true, head: 'prism', shine: 'bolt', skill: 'all', sig: 'призма и молния' },
    { id: 'cv_skin',     name: 'Хаосит',  color: '#0a0010', accent: '#ff2dd8', pattern: 'split', anim: 'glitch', head: 'fragments', glow: true, chaosVet: true, sig: 'расслоение цвета и осколки на орбите' },
    // 2.3 workshop «Хронос»: only crafted from shards (craft = rarity); `live` skins redraw their texture every few frames
    { id: 'cr_engrave',  name: 'Гравировка',      color: '#3a1a08', accent: '#ffd27a', pattern: 'live', live: 'engrave', craft: 'epic', sig: 'светящиеся гравированные шестерни вращаются' },
    { id: 'cr_watch',    name: 'Карманные часы',  color: '#e8b05a', accent: '#7a4a12', pattern: 'live', live: 'watch', craft: 'rare', sig: 'циферблат, стрелки идут на макушке' },
    { id: 'cr_windup',   name: 'Заводная капля',  color: '#e8b05a', accent: '#7a4a12', pattern: 'brass', head: 'windkey', craft: 'rare', sig: 'заводной ключ крутится на ходу' },
    { id: 'cr_skeleton', name: 'Скелетон',        color: '#e8b05a', accent: '#7a4a12', mat: 'skeleton', craft: 'epic', sig: 'прозрачный корпус, внутри крутится механизм' },
    { id: 'cr_sandup',   name: 'Время вспять',    color: '#bff8ff', accent: '#ffd27a', mat: 'sandglass', craft: 'epic', sig: 'песок сыплется вверх и копится у макушки' },
    { id: 'cr_spiral',   name: 'Часовая спираль', color: '#160c30', accent: '#22e6ff', pattern: 'live', live: 'spring', glow: true, craft: 'legendary', sig: 'пульсирует пружина, по ней бежит стрелка' },
    { id: 'cr_moon',     name: 'Лунная фаза',     color: '#141c5a', accent: '#ffd27a', pattern: 'live', live: 'moon', glow: true, craft: 'legendary', sig: 'окошко с фазами луны, в полнолуние вспышка' },
  ];
  [...SKINS, ...FX].forEach(x => { if (x.ch) x.ex = true; if (x.chaosQ) x.chaos = 'q' + x.chaosQ; if (x.chaosVet) x.chaos = 'vet'; if (x.raidQ) x.raid = true; });
  // rarities for chest loot; a duplicate turns into coins
  const RARITY = {
    common:    { name: 'Обычный',     color: '#b8b5d6', dup: 150,  w: 62 },
    rare:      { name: 'Редкий',      color: '#4d7cff', dup: 400,  w: 27 },
    epic:      { name: 'Эпический',   color: '#b26bff', dup: 900,  w: 9 },
    legendary: { name: 'Легендарный', color: '#ffd23f', dup: 2500, w: 2 },
  };
  // seasons: 14 days each; every season has its own skin for Diamond and Neon leagues
  // 2.0.0: season 1 starts Monday, 16 Nov 2026 (local time) for everyone; a progress reset only moves you to the season running on this calendar
  const SEASON_LEN = 14 * 86400000, SEASON_BASE = new Date(2026, 10, 16).getTime(), SEASON_EPOCH = (() => {
    try { const s0 = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s0 && s0.seasonEpoch >= SEASON_BASE) return s0.seasonEpoch; } catch (e) {}
    return SEASON_BASE;
  })();
  const seasonStarted = Date.now() >= SEASON_EPOCH;
  const seasonNow = Math.max(1, Math.floor((Date.now() - SEASON_EPOCH) / SEASON_LEN) + 1);
  const seasonEnd = id => SEASON_EPOCH + id * SEASON_LEN;
  const fmtDate = t => new Date(t).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  // 1.7.0: 26 regular seasons = one year. Odd seasons: skin at «Алмаз», pet at «Неон»; even seasons: effect at «Алмаз».
  // «Платина» gives the season frame, «Неон» the season title. After season 26 the names repeat as «год 2» without items until the next content update.
  const SEASON_NAMES = ['Полярное сияние', 'Кибер-закат', 'Звёздный шторм', 'Неоновый дракон', 'Ледяная комета', 'Солнечный ветер', 'Глубокий космос',
    'Розовая туманность', 'Квантовый скачок', 'Изумрудный пульс', 'Плазменный вихрь', 'Лунная пыль', 'Сверхновая', 'Кислотный дождь', 'Синтвейв',
    'Магнитная буря', 'Электрический лес', 'Ретро-аркада', 'Голографический сон', 'Огни мегаполиса', 'Кристальная пещера', 'Лазерное шоу',
    'Червоточина', 'Гамма-всплеск', 'Легенда неона', 'Кибер-сакура'];
  const SEASON_YEAR = SEASON_NAMES.length;
  const SEASON_PAT = ['gradient', 'stripes', 'dots', 'stars', 'grid', 'zigzag', 'rings', 'gradient'];
  const hslHex = (h, s2, l) => '#' + new THREE.Color().setHSL(((h % 360) + 360) % 360 / 360, s2, l).getHexString();
  const TRAIL_STYLES = ['sparks', 'bubbles', 'stars', 'ribbon', 'rings', 'smoke', 'spiral'];
  const TRAIL_STYLE_NAME = { sparks: 'Искры', bubbles: 'Пузыри', stars: 'Звёздочки', ribbon: 'Лента', rings: 'Кольца', smoke: 'Дымка', spiral: 'Спираль' };
  const bright = c => { const hsl = {}; new THREE.Color(c).getHSL(hsl); return hsl.l > .3 ? c : '#ffffff'; };
  const SEASONS = SEASON_NAMES.map((name, i) => ({ name, skin: SKINS.find(k => k.season === i + 1) || null, fx: FX.find(f => f.season === i + 1) || null }));
  // season frame (Platinum) and title (Neon): a colour of its own for every season
  const seasonHue = i => (i * 137.508) % 360;
  // holiday seasons replace the regular one whose dates include the holiday.
  // They have their own six leagues, a reward for EVERY league, and new items every year.
  const HOLIDAYS = {
    halloween: { name: 'Хэллоуин', md: [9, 31], rim: '#ff7a00',
      leagues: ['Тыква', 'Призрак', 'Вампир', 'Ведьма', 'Оборотень', 'Король тьмы'],
      colors: ['#ff9a3d', '#c9d6ff', '#ff2d55', '#3dff6e', '#b26bff', '#ff7a00'],
      editions: [
        [['skin', 'Тыквенный фонарь', '#ff7a00', '#2a0a3a', 'stripes'], ['fx', 'Огоньки на болоте', ['#3dff6e', '#b9ff3d']], ['skin', 'Летучая мышь', '#2a0a3a', '#b26bff', 'zigzag'],
         ['fx', 'Ведьмин дым', ['#b26bff', '#3dff6e']], ['fx', 'Призрачный след', ['#c9d6ff', '#b26bff']], ['skin', 'Тыквенный король', '#ff7a00', '#1a0a00', 'gradient', 'crown']],
        [['skin', 'Чёрный кот', '#120820', '#ffd23f', 'dots'], ['fx', 'Паутина', ['#e8ecff', '#7b3dff']], ['skin', 'Скелет', '#e8ecff', '#120820', 'rings'],
         ['fx', 'Тыквенные искры', ['#ff7a00', '#ffd23f']], ['fx', 'Кровавый туман', ['#ff2d55', '#7b0020']], ['skin', 'Граф Вампир', '#7b0020', '#ff2d55', 'gradient', 'crown']],
      ] },
    newyear: { name: 'Новогодний сезон', md: [0, 1], rim: '#9fe8ff',
      leagues: ['Снежинка', 'Сосулька', 'Снеговик', 'Олень', 'Дед Мороз', 'Повелитель зимы'],
      colors: ['#e8f6ff', '#9fe8ff', '#ffffff', '#c98a4b', '#ff2d55', '#4d7cff'],
      editions: [
        [['skin', 'Ёлочная игрушка', '#ff2d55', '#ffd23f', 'stars'], ['fx', 'Новогодние огни', ['#ff2d55', '#3dff6e', '#ffd23f']], ['skin', 'Снеговик', '#ffffff', '#9fe8ff', 'dots'],
         ['fx', 'Снегопад', ['#ffffff', '#9fe8ff']], ['fx', 'Бенгальский огонь', ['#ffd23f', '#ffffff']], ['skin', 'Дед Мороз', '#ff2d55', '#ffffff', 'rings', 'crown']],
        [['skin', 'Мандарин', '#ff9a3d', '#3dff6e', 'dots'], ['fx', 'Гирлянда', ['#ff2d55', '#ffd23f', '#22e6ff', '#3dff6e']], ['skin', 'Ледяной кристалл', '#9fe8ff', '#ffffff', 'grid'],
         ['fx', 'Зимнее сияние', ['#3dffa2', '#9fe8ff']], ['fx', 'Фейерверк', ['#ff4fd8', '#ffd23f', '#22e6ff']], ['skin', 'Снежная королева', '#e8f6ff', '#4d7cff', 'gradient', 'crown']],
      ] },
    valentine: { name: 'День влюблённых', md: [1, 14], rim: '#ff4f9a',
      leagues: ['Улыбка', 'Симпатия', 'Влюблённость', 'Свидание', 'Купидон', 'Вечная любовь'],
      colors: ['#ffd1e8', '#ff9ec4', '#ff6ad5', '#ff4f9a', '#ff2d55', '#ffd23f'],
      editions: [
        [['skin', 'Сердцеед', '#ff4f9a', '#ff9ec4', 'gradient'], ['fx', 'Купидон', ['#ff4f9a', '#ff2d55']], ['skin', 'Розовый бутон', '#ff6ad5', '#3dff6e', 'dots'],
         ['fx', 'Любовные письма', ['#ffffff', '#ff9ec4']], ['fx', 'Розовые лепестки', ['#ff9ec4', '#ff4fd8']], ['skin', 'Королева сердец', '#ff2d55', '#ffd23f', 'stripes', 'crown']],
        [['skin', 'Шоколадное сердце', '#6b3a1e', '#ff9ec4', 'gradient'], ['fx', 'Стрела амура', ['#ffd23f', '#ff4f9a']], ['skin', 'Валентинка', '#ffd1e8', '#ff2d55', 'rings'],
         ['fx', 'Конфетти любви', ['#ff4f9a', '#ffd23f', '#ffffff']], ['fx', 'Розовый туман', ['#ff9ec4', '#b26bff']], ['skin', 'Король романтики', '#ff4f9a', '#7b0020', 'zigzag', 'crown']],
      ] },
  };
  // 1.7.0: every holiday has one fixed set: skin (Neon), effect (Diamond), pet (Platinum); new years come with content updates
  const shiftHue = (c, turns) => turns ? '#' + new THREE.Color(c).offsetHSL(turns * .17, 0, 0).getHexString() : c;
  const holidayItems = k => [...SKINS.filter(x => x.holiday === k).map(x => ({ kind: 'skin', ...x })), ...FX.filter(x => x.holiday === k).map(x => ({ kind: 'fx', ...x }))];
  function ensureHolidayItems() {}
  function holidayOf(id) { const r = holidayInfo(id); return r ? r.k : null; }
  function holidayInfo(id) {
    const st = SEASON_EPOCH + (id - 1) * SEASON_LEN, en = st + SEASON_LEN, y0 = new Date(st).getFullYear();
    for (const [k, h] of Object.entries(HOLIDAYS)) for (const y of [y0, y0 + 1]) {
      const t = new Date(y, h.md[0], h.md[1], 12).getTime();
      if (t >= st && t < en) return { k, y };
    }
    return null;
  }
  function seasonData(id) {
    const hi = holidayInfo(id);
    if (hi) { const h = HOLIDAYS[hi.k]; return { name: `${h.name} ${hi.y}`, holiday: hi.k, year: hi.y, items: holidayItems(hi.k), pets: holidayPets(hi.k) }; }
    const i = (id - 1) % SEASON_YEAR, yr = Math.floor((id - 1) / SEASON_YEAR), sd = SEASONS[i];
    return { name: sd.name + (yr ? ` · год ${yr + 1}` : ''), idx: yr ? 0 : i + 1, holiday: null, skin: yr ? null : sd.skin, fx: yr ? null : sd.fx, pets: yr ? [] : seasonPets(i) };
  }
  // what a league gives at the end of a season (cumulative: higher leagues include lower rewards)
  function seasonRewards(sd, li) {
    const out = [];
    if (sd.holiday) {
      if (li >= 3 && sd.pets[0]) out.push({ kind: 'pet', ...sd.pets[0] });
      sd.items.forEach(it => { if ((it.kind === 'fx' && li >= 4) || (it.kind === 'skin' && li >= 5)) out.push(it); });
      return out;
    }
    if (li >= 4 && sd.skin) out.push({ kind: 'skin', ...sd.skin });
    if (li >= 4 && sd.fx) out.push({ kind: 'fx', ...sd.fx });
    if (li >= 5 && sd.pets[0]) out.push({ kind: 'pet', ...sd.pets[0] });
    return out;
  }
  function ensureSeasonDecor() {}   // 1.7.0: per-season frames/titles were replaced by two half-year ones
  const seasonHalf = idx => idx > SEASON_YEAR / 2 ? 2 : 1;
  const seasonDecor = (sd, li) => !sd.idx ? [] : [...(li >= 3 ? ['fr_sh' + seasonHalf(sd.idx)] : []), ...(li >= 5 ? ['tt_sh' + seasonHalf(sd.idx)] : [])];
  function leagueRewardText(sd, i) {
    const p = [];
    if (sd.holiday) {
      if (i === 3 && sd.pets[0]) p.push(`питомец «${sd.pets[0].name}»`);
      sd.items.forEach(it => { if ((it.kind === 'fx' && i === 4) || (it.kind === 'skin' && i === 5)) p.push(`${it.kind === 'skin' ? 'скин' : 'эффект'} «${it.name}»`); });
      return p.join(' + ');
    }
    if (i === 3 && sd.idx) p.push('рамка сезона');
    if (i >= 4 && sd.skin) p.push(`скин «${sd.skin.name}»`);
    if (i >= 4 && sd.fx) p.push(`эффект «${sd.fx.name}»`);
    if (i === 5 && sd.pets[0]) p.push(`питомец «${sd.pets[0].name}»`);
    if (i === 5 && sd.idx) p.push('титул сезона');
    return p.join(' + ');
  }
  // league names/colours depend on the season (holiday seasons rename them)
  const lgView = li => LEAGUES[li];   // v48: holiday seasons keep the usual leagues (Бронза…Неон); only their rewards are festive
  // ---- items above the head that go on any skin (rewards for skin collections) ----
  const HATS = {
    cherry:    { name: 'Вишенка',      svg: '<path d="M12 3 C12 8 8 10 7 14 M12 3 C13 8 16 10 17 14" stroke="#3dffa2" stroke-width="1.6" fill="none"/><circle cx="7" cy="16" r="4.5" fill="#ff2d55"/><circle cx="17" cy="16" r="4.5" fill="#ff2d55"/>' },
    planet:    { name: 'Мини-планета', svg: '<circle cx="12" cy="12" r="6" fill="#b26bff"/><ellipse cx="12" cy="12" rx="11" ry="3.5" fill="none" stroke="#ffd23f" stroke-width="1.6"/>' },
    snowflake: { name: 'Снежинка',     svg: '<path d="M12 2 V22 M3.3 7 L20.7 17 M3.3 17 L20.7 7" stroke="#9fe8ff" stroke-width="2.4" stroke-linecap="round"/>' },
    propeller: { name: 'Пропеллер',    svg: '<path d="M2 9 Q12 4 22 9 Q12 11 2 9 Z" fill="#22e6ff"/><path d="M6 20 Q6 12 12 12 Q18 12 18 20 Z" fill="#ff4fd8"/><rect x="11" y="8" width="2" height="5" fill="#ffd23f"/>' },
    tophat:    { name: 'Цилиндр',      svg: '<rect x="7" y="3" width="10" height="13" rx="1" fill="#1a1033" stroke="#b26bff"/><rect x="7" y="12" width="10" height="2.5" fill="#ff4fd8"/><rect x="3" y="16" width="18" height="3" rx="1.5" fill="#1a1033" stroke="#b26bff"/>' },
    helm:      { name: 'Шлем рейдера',    src: '3 победы над боссом рейда', svg: '<path d="M4 17 C4 8 8 4 12 4 C16 4 20 8 20 17 Z" fill="#3a2a5a" stroke="#ff2d55" stroke-width="1.4"/><path d="M12 1 L14 6 L10 6 Z" fill="#ff2d55"/><rect x="4" y="15" width="16" height="3" fill="#ff2d55"/>' },
    banner:    { name: 'Знамя рейда',     src: '5 побед над боссом рейда', svg: '<rect x="5" y="2" width="1.8" height="21" fill="#ffd23f"/><path d="M7 3 H20 L16.5 7.5 L20 12 H7 Z" fill="#ff2d55"/><circle cx="12" cy="7.5" r="2" fill="#ffd23f"/>' },
    crystals:  { name: 'Алмазная россыпь', src: 'лига «Алмаз» в конце сезона', svg: '<path d="M6 10 L9 6 L12 10 L9 15 Z" fill="#9fe8ff"/><path d="M12 7 L15.5 2 L19 7 L15.5 13 Z" fill="#b26bff"/><path d="M14 15 L17 11.5 L20 15 L17 20 Z" fill="#e8fbff"/>' },
    cup:       { name: 'Кубок лиги',   svg: '<path d="M7 3 H17 V8 C17 12 14.5 14 12 14 C9.5 14 7 12 7 8 Z" fill="#ffd23f"/><path d="M7 5 H4 C4 9 6 10 7.5 10 M17 5 H20 C20 9 18 10 16.5 10" stroke="#ffd23f" stroke-width="1.5" fill="none"/><rect x="11" y="14" width="2" height="4" fill="#ffd23f"/><rect x="8" y="18" width="8" height="3" rx="1" fill="#ff9a3d"/>' },
    sprout:    { name: 'Росток',       svg: '<path d="M12 22 V10" stroke="#3dffa2" stroke-width="2"/><path d="M12 12 C6 12 3 8 3 4 C8 4 12 7 12 12 Z M12 10 C17 10 21 7 21 3 C16 3 12 6 12 10 Z" fill="#3dffa2"/>' },
  };
  const COLLECTIONS = [
    { id: 'col_sweet',  name: 'Сладкоежка',        skins: ['marmalade', 'melon', 'c_caramel', 'c_soda', 'c_peach'],       hat: 'cherry',    coins: 1000 },
    { id: 'col_space',  name: 'Космос',            skins: ['saturn', 'c_nebula', 'c_starborn', 'c_crystal'],              hat: 'planet',    coins: 1500 },
    { id: 'col_elem',   name: 'Стихии',            skins: ['ocean', 'phoenix', 'magma', 'c_marble'],                      hat: 'snowflake', coins: 1500 },
    { id: 'col_cyber',  name: 'Кибер',             skins: ['neon', 'cyber', 'c_circuit', 'matrix', 'c_chrome'],           hat: 'propeller', coins: 1500 },
    { id: 'col_royal',  name: 'Королевская семья', skins: ['champion', 'titan', 'abyss'],                                 hat: 'tophat',    coins: 2000 },
    { id: 'col_nature', name: 'Природа',           skins: ['coral', 'amanita', 'c_chameleon', 'c_neontiger', 'c_lavalamp'], hat: 'sprout',  coins: 1000 },
    // effect collections: reward is a unique title
    { id: 'colfx_fire',  name: 'Огненный набор', fx: ['raysAura', 'supernova', 'sparksTrail'],        coins: 3000 },
    { id: 'colfx_ice',   name: 'Снег и лёд',     fx: ['snowglobeAura', 'iceEat', 'bubbleTrail'],      coins: 2500 },
    { id: 'colfx_star',  name: 'Звёздное небо',  fx: ['goldTrail', 'binaryAura', 'moonAura'],         coins: 3000 },
    { id: 'colfx_volt',  name: 'Гроза',          fx: ['electricAura', 'shockEat', 'pixelTrail'],      coins: 3000 },
    { id: 'colfx_party', name: 'Праздник',       fx: ['heartEat', 'popEat', 'rainbowTrail', 'leafTrail'], coins: 2500 },
    { id: 'colfx_void',  name: 'Орбиты и тьма',  fx: ['miniholeEat', 'orbitAura', 'ringAura'],        coins: 3000 },
  ];
  // a collection lists its items as [type, id]; skin and effect sets use the short skins / fx form, the newer ones a function (seasons and holidays are built late)
  const colList = c => c.skins ? c.skins.map(id => ['skin', id]) : c.fx ? c.fx.map(id => ['fx', id]) : c.items();
  const colItems = c => colList(c).map(x => x[1]);
  const ownedList = t => t === 'skin' ? save.skins : t === 'pet' ? save.pets : t === 'abil' ? save.abil.owned : t === 'look' ? save.abil.looks : t === 'deco' ? save.decor : t === 'badge' ? Object.keys(save.badges || {}) : save.fxOwned;
  const colOwned = c => colList(c).filter(([t, id]) => ownedList(t).includes(id)).length;
  const colRewardName = c => c.hat ? HATS[c.hat].name : [c.title && `титул «${decorById(c.title).name}»`, c.frame && `рамка «${decorById(c.frame).name}»`, c.arena && `арена «${ARENAS.find(a => a.id === c.arena).name}»`].filter(Boolean).join(' и ');
  // 1.7.0: 28 frames and 36 titles instead of 260; every one is styled by its rarity (see styleDecor)
  // a, b — the two colours of the animation; ico — the source icon in front of a title
  const fr = (id, name, rar, a, b, x = {}) => ({ id, kind: 'frame', name, rar, a, b, ...x });
  const tt = (id, name, rar, a, b, ico, x = {}) => ({ id, kind: 'title', name, rar, a, b, ico, color: a, ...x });
  const DECOR = [
    // 2.3 workshop «Хронос» frames (craft only)
    fr('fr_cr_dial', 'Циферблат', 'common', '#e8b05a', '#fff6d8', { craft: 'common' }),
    fr('fr_cr_roman', 'Римские часы', 'rare', '#e8b05a', '#7a4a12', { craft: 'rare' }),
    fr('fr_cr_pend', 'Маятник', 'epic', '#e8b05a', '#ffd27a', { craft: 'epic' }),
    fr('fr_cr_gyro', 'Гироскоп', 'legendary', '#ffd27a', '#e8b05a', { craft: 'legendary' }),
    // reward for the whole «Хронос» series (given by the workshop, never crafted)
    fr('fr_cr_tourb', 'Турбийон', 'legendary', '#ffd27a', '#fff3c4', { series: 'chronos' }),
    // chests: one of each rarity
    fr('fr_cyan', 'Неоновая линия', 'common', '#22e6ff', '#7b3dff', { chest: 'common' }),
    fr('fr_glow', 'Сияющая', 'rare', '#3dffa2', '#22e6ff', { chest: 'rare' }),
    fr('fr_fire', 'Огненная', 'epic', '#ff6a00', '#ffd23f', { chest: 'epic' }),
    fr('fr_rainbow', 'Радужная', 'legendary', '#ff4fd8', '#22e6ff', { chest: 'legendary' }),
    tt('tt_crumb', 'Крошкоед', 'common', '#c9c6ea', '#ffffff', '◆', { chest: 'common' }),
    tt('tt_tactic', 'Стратег', 'rare', '#6f9bff', '#22e6ff', '◆', { chest: 'rare' }),
    tt('tt_storm', 'Гроза ботов', 'epic', '#b26bff', '#ff4fd8', '◆', { chest: 'epic' }),
    tt('tt_lord', 'Повелитель арены', 'legendary', '#ffd23f', '#ff9a3d', '◆', { chest: 'legendary' }),
    // league: from «Платина» up (frame of the league reached, titles of it and below)
    fr('fr_lg3', 'Лига «Платина»', 'epic', '#7fe8ff', '#ffffff', { league: 3 }),
    fr('fr_lg4', 'Лига «Алмаз»', 'legendary', '#b26bff', '#22e6ff', { league: 4 }),
    fr('fr_lg5', 'Лига «Неон»', 'legendary', '#ff4fd8', '#22e6ff', { league: 5, crown: true }),
    tt('tt_lg3', 'Платиновый игрок', 'epic', '#7fe8ff', '#ffffff', '⚔', { league: 3 }),
    tt('tt_lg4', 'Алмазный ас', 'legendary', '#b26bff', '#22e6ff', '⚔', { league: 4 }),
    tt('tt_lg5', 'Неоновый чемпион', 'legendary', '#ff4fd8', '#22e6ff', '⚔', { league: 5 }),
    // league seasons: «Платина» in any season of the half-year gives its frame, «Неон» its title
    fr('fr_sh1', 'Платина полугодия I', 'epic', '#3dffa2', '#22e6ff', { half: 1 }),
    fr('fr_sh2', 'Платина полугодия II', 'epic', '#ff4fd8', '#ffd23f', { half: 2 }),
    tt('tt_sh1', 'Звезда сезонов I', 'legendary', '#3dffa2', '#22e6ff', '⚔', { half: 1 }),
    tt('tt_sh2', 'Звезда сезонов II', 'legendary', '#ff4fd8', '#ffd23f', '⚔', { half: 2 }),
    // Chaos League: «Разлом» in a season of the quarter — frame, «Сингулярность» — title
    fr('fr_cq1', 'Эпоха хаоса I', 'epic', '#22e6ff', '#7b3dff', { cq: 1 }),
    fr('fr_cq2', 'Эпоха хаоса II', 'epic', '#3dffa2', '#ff4fd8', { cq: 2 }),
    fr('fr_cq3', 'Эпоха хаоса III', 'epic', '#ff9a3d', '#b26bff', { cq: 3 }),
    fr('fr_cq4', 'Эпоха хаоса IV', 'epic', '#ff4fd8', '#22e6ff', { cq: 4 }),
    tt('tt_cq1', 'Хаос-чемпион I', 'legendary', '#22e6ff', '#b26bff', '◈', { cq: 1 }),
    tt('tt_cq2', 'Хаос-чемпион II', 'legendary', '#3dffa2', '#ff4fd8', '◈', { cq: 2 }),
    tt('tt_cq3', 'Хаос-чемпион III', 'legendary', '#ff9a3d', '#b26bff', '◈', { cq: 3 }),
    tt('tt_cq4', 'Хаос-чемпион IV', 'legendary', '#ff4fd8', '#22e6ff', '◈', { cq: 4 }),
    fr('fr_cvet', 'Пульс бездны', 'legendary', '#ff4fd8', '#22e6ff', { chaos: 'vet' }),
    fr('fr_sing', 'Горизонт сингулярности', 'legendary', '#b26bff', '#22e6ff', { chaos: 'top', orbit: true }),
    tt('tt_cvet', 'Ветеран Хаоса', 'legendary', '#ff4fd8', '#22e6ff', '◈', { chaos: 'vet' }),
    tt('tt_chaos', 'Повелитель хаоса', 'legendary', '#b26bff', '#ff4fd8', '◈', { line: 'chaos' }),
    // levels 25 and 50
    fr('fr_lv20', 'Ветеранская', 'rare', '#c0c8e0', '#9fd8ff', { level: 25 }),
    tt('tt_lv10', 'Опытный', 'rare', '#9fd8ff', '#ffffff', '▲', { level: 25 }),
    fr('fr_lv40', 'Звёздный путь', 'legendary', '#ffd23f', '#b26bff', { level: 50 }),
    tt('tt_lv50', 'Великий', 'legendary', '#ffd23f', '#fff6c8', '▲', { level: 50 }),
    // legendary achievements
    fr('fr_legend', 'Легендарная', 'legendary', '#ffd23f', '#ff4fd8', { legend: 'wins1', crown: true }),
    fr('fr_star', 'Звёздная', 'legendary', '#fff6a0', '#ff4fd8', { legend: 'stars1' }),
    fr('fr_platinum', 'Платиновая', 'legendary', '#e8fbff', '#ffd23f', { legend: 'coins2' }),
    tt('tt_starcatcher', 'Ловец звёзд', 'legendary', '#ffd23f', '#ff4fd8', '★', { legend: 'stars1' }),
    tt('tt_starstorm', 'Гроза звёзд', 'legendary', '#ff4fd8', '#ffd23f', '★', { legend: 'stars3' }),
    tt('tt_invincible', 'Непобедимый', 'legendary', '#ffd23f', '#ffffff', '★', { legend: 'wins2' }),
    tt('tt_millionaire', 'Миллионер', 'legendary', '#ffd23f', '#3dffa2', '★', { legend: 'coins2' }),
    // achievement lines, step III
    tt('tt_ln_boss', 'Истребитель', 'epic', '#ff3d6e', '#ffd23f', '❖', { line: 'boss' }),
    tt('tt_ln_star', 'Звездобой', 'epic', '#ffd23f', '#ff4fd8', '❖', { line: 'star' }),
    tt('tt_ln_giant', 'Исполин', 'epic', '#3dffa2', '#22e6ff', '❖', { line: 'giant' }),
    tt('tt_ln_league', 'Неоновая легенда', 'legendary', '#ff4fd8', '#22e6ff', '❖', { line: 'league' }),
    // challenges
    fr('fr_finish', 'Финишная черта', 'epic', '#ffffff', '#ff3d6e', { chal: 'ch_race2' }),
    fr('fr_calendar', 'Календарь', 'rare', '#3dffa2', '#ffd23f', { chal: 'ch_daily7' }),
    fr('fr_dark', 'Тьма', 'epic', '#7b3dff', '#05021a', { chal: 'ch_hard1500' }),
    tt('tt_crowned', 'Венценосный', 'epic', '#ffd23f', '#ff9a3d', '⚑', { chal: 'ch_crown5' }),
    tt('tt_giants', 'Гроза гигантов', 'epic', '#ff2d55', '#ffd23f', '⚑', { chal: 'ch_giant5' }),
    tt('tt_unbreak', 'Несокрушимый', 'legendary', '#22e6ff', '#ffffff', '⚑', { chal: 'ch_surv20' }),
    // mastery: one frame for «Легенда» in every mode
    fr('fr_modes', 'Мастер режимов', 'legendary', '#3dffa2', '#ffd23f', { mastery: 'all' }),
  ];
  // mastery of each mode: Бронза and Золото give coins, «Легенда» coins too; «Легенда» in all modes — the frame «Мастер режимов»
  const MASTERY_LV = [{ name: 'Бронза', pts: 300, coins: 600 }, { name: 'Золото', pts: 1000, coins: 1500 }, { name: 'Легенда', pts: 3000, coins: 2500 }];
  const masteryLv = pts => MASTERY_LV.filter(l => pts >= l.pts).length;
  // 2.1.0: mode cards — colours, icon (24×24 strokes) and short tags for each mode
  const MODE_ART = {
    classic:  { c: '#22e6ff', c2: '#7b3dff', ic: '<circle cx="10" cy="13" r="6.5"/><circle cx="8" cy="11.5" r="1" fill="currentColor"/><circle cx="12" cy="11.5" r="1" fill="currentColor"/><circle cx="19.5" cy="7.5" r="1.4"/><circle cx="20.5" cy="13.5" r="1.1"/><circle cx="18" cy="18.5" r="1"/>', tags: ['до поражения', 'боссы'] },
    timed:    { c: '#ffd23f', c2: '#ff9a3d', ic: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5V9.5M12 13.5l3 2M9.5 2.8h5M12 2.8v3M18.5 6.5l1.5-1.5"/>', tags: ['3 минуты', 'награда за место'] },
    survival: { c: '#ff3d6e', c2: '#7a0030', ic: '<path d="M5 11a7 7 0 0 1 14 0v3l-2 2v3.5H7V16l-2-2z"/><circle cx="9.3" cy="12" r="1.7"/><circle cx="14.7" cy="12" r="1.7"/><path d="M10.5 19.5v-2M13.5 19.5v-2"/>', tags: ['волны боссов', 'каждые 15 с'] },
    crown:    { c: '#ffd23f', c2: '#ff4fd8', ic: '<path d="M3.5 18.5h17L19 8l-4.5 4L12 4.5 9.5 12 5 8z"/><path d="M3.5 21h17"/>', tags: ['до поражения', 'время с короной'] },
    race:     { c: '#3dffa2', c2: '#0a8f6a', ic: '<path d="M6 21V3.5M6 4h11l-2.5 4L17 12H6"/><path d="M1.5 9h2.5M1 13h3M2 17h2"/>', tags: ['до 4000 массы', 'на скорость'] },
    rbuild:   { c: '#b26bff', c2: '#ff4fd8', ic: '<rect x="4" y="4" width="16" height="16" rx="3.5"/><circle cx="8.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.3" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.3" fill="currentColor"/>', tags: ['3 случайные способности', 'опыт ×1,2'], isNew: true },
    hardcore: { c: '#ff6a00', c2: '#ff2d55', ic: '<path d="M12 2.5c1 4 5.5 5.5 5.5 11a5.5 5.5 0 0 1-11 0c0-2.8 1.6-3.8 2.7-5.5.5 2.2 1.5 2.8 2.6 2.8 0-3.2-1-5.3.2-8.3z"/>', tags: ['без бонусов', 'монеты ×1,6'] },
    territory: { c: '#22e6ff', c2: '#ff4fd8', ic: '<circle cx="12" cy="12" r="9"/><path d="M13.5 3.2c-2.5 3-2.5 5.8 0 8.8s2.5 5.8 0 8.8" stroke-dasharray="2.2 1.8"/><circle cx="7.6" cy="12" r="2" fill="currentColor"/><circle cx="17" cy="12" r="1.6"/><path d="M9.8 9.2l1.6-1.5M9.8 14.8l1.6 1.5"/>', tags: ['4 минуты', 'граница поля'], duo: true },
    raid:     { c: '#ff2d75', c2: '#7b3dff', ic: '<circle cx="12" cy="13.5" r="6.5"/><path d="M7.2 9L4.5 3.5l4.8 3.3M16.8 9l2.7-5.5-4.8 3.3"/><path d="M9.3 12.5h1.4M13.3 12.5h1.4M9.5 16.3h5"/>', tags: ['босс недели', '3 попытки в день'] },
    royale:   { c: '#ff4fd8', c2: '#22e6ff', ic: '<circle cx="12" cy="12" r="9" stroke-dasharray="3 2.4"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.6" fill="currentColor"/>', tags: ['арена сужается', 'только в лиге'] },
  };
  const modeArt = id => MODE_ART[id] || MODE_ART.classic;
  const modeIcon = id => `<svg viewBox="0 0 24 24" aria-hidden="true">${modeArt(id).ic}</svg>`;
  // mastery of a mode: current level name (or null) and progress to the next level, 0…1
  const modeMastery = id => { const pts = (save.mastery || {})[id] || 0, lv = masteryLv(pts), cur = lv ? MASTERY_LV[lv - 1] : null, nx = MASTERY_LV[lv];
    return { name: cur ? cur.name : null, pct: nx ? (pts - (cur ? cur.pts : 0)) / (nx.pts - (cur ? cur.pts : 0)) : 1 }; };
  const decorById = id => DECOR.find(d => d.id === id) || null;
  // rarity look: common — neon line, rare — two-colour shimmer, epic — light running around, legendary — spectrum + pulse
  const RAR_LETTER = { common: 'c', rare: 'r', epic: 'e', legendary: 'l' };
  function styleDecor() {
    for (const d of DECOR) {
      if (d.styled) continue; d.styled = true;
      const hex = (d.css || '').match(/#[0-9a-f]{6}/gi) || [];
      d.a = d.a || d.color || hex[0] || '#22e6ff'; d.b = d.b || hex[1] || '#ffffff'; d.color = d.color || d.a;
      const L = RAR_LETTER[decoRarity(d)];
      if (d.kind === 'frame') { if (!d.cls) { d.cls = 'fr-' + L; d.css = `border:2px solid ${d.a}`; } d.css += `;--a:${d.a};--b:${d.b}`; }
      else { d.cls = d.cls || 'tt-' + L; d.ico = d.ico || (d.promo ? '' : d.chaos ? '◈' : d.col ? '✦' : d.skill ? '✪' : '◆'); }
    }
  }

  // season archive: rewards of seasons that are already over for this player, sold for coins
  // v49: every archive item has an explicit rarity (by the league it was earned in) and its price comes from the rarity;
  // the archive chest was removed — instead the weekly showcase is bigger
  const ARCHIVE_LVL = 20, ARCHIVE_SLOTS = 6;
  const ARCH_PRICE = { common: 12000, rare: 18000, epic: 26000, legendary: 36000 };
  // 1.7.0: an archive item also costs archive tokens, earned by taking part in seasons; at most 2 purchases a week.
  // A full regular season set (rare + 2 epic + legendary) costs 8 tokens: a player who skipped the league gathers them
  // from weekly tasks (1 a week) in about two months, an active player gets 1–4 per season on top.
  const ARCH_TOK = { common: 1, rare: 1, epic: 2, legendary: 3 };
  const ARCH_TOK_LEAGUE = [1, 1, 2, 2, 3, 4];   // per finished league season you played, by final league
  const ARCH_TOK_CHAOS = 1, ARCH_TOK_WEEK = 1, ARCH_TOK_CAP = 20, ARCH_WEEK_LIMIT = 2;
  const archTokAdd = n => { const before = save.archTok || 0; save.archTok = Math.min(ARCH_TOK_CAP, before + n); return save.archTok - before; };
  const archBuysLeft = () => { const w = raidWeek(); if (!save.archBuys || save.archBuys.week !== w) save.archBuys = { week: w, n: 0 }; return Math.max(0, ARCH_WEEK_LIMIT - save.archBuys.n); };
  const HOLIDAY_RAR = ['common', 'common', 'rare', 'rare', 'epic', 'legendary'];   // holiday item for Бронза … Неон
  const offer = (kind, id, rar, from) => ({ kind, id, rar, price: ARCH_PRICE[rar], from });
  function seasonOffers(id) {
    const sd = seasonData(id), out = [];
    if (sd.holiday) {
      sd.items.forEach(it => out.push(offer(it.kind, it.id, it.kind === 'skin' ? 'legendary' : 'epic', sd.name)));
      sd.pets.forEach(pt => out.push(offer('pet', pt.id, 'rare', sd.name)));
    } else {
      if (sd.skin) out.push(offer('skin', sd.skin.id, 'epic', sd.name));
      if (sd.fx) out.push(offer('fx', sd.fx.id, 'epic', sd.name));
      sd.pets.forEach(pt => out.push(offer('pet', pt.id, 'legendary', sd.name)));
    }
    return out;
  }
  const ownList = kind => kind === 'skin' ? save.skins : kind === 'pet' ? save.pets : save.fxOwned;
  const ownsOffer = o => ownList(o.kind).includes(o.id);
  function archiveOffers() {
    if (!seasonStarted) return [];
    const seen = new Set(), out = [];
    for (let id = 1; id < seasonNow; id++) for (const o of seasonOffers(id)) if (!seen.has(o.id)) { seen.add(o.id); if (!ownsOffer(o)) out.push(o); }
    return out;
  }
  // the weekly showcase: up to 4 offers picked on Monday; bought ones stay marked until next week
  function archiveShowcase() {
    const w = raidWeek(), all = archiveOffers();
    if (!save.archive || save.archive.week !== w) {
      let seed = w * 9301 + 49297; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const pool = all.slice(); for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      save.archive = { week: w, ids: pool.slice(0, ARCHIVE_SLOTS).map(o => o.id) };
    }
    const byId = {}; for (let id = 1; id < seasonNow; id++) for (const o of seasonOffers(id)) byId[o.id] = byId[o.id] || o;
    // when only a few are left, all of them are on the showcase
    if (all.length <= ARCHIVE_SLOTS) for (const o of all) if (!save.archive.ids.includes(o.id)) save.archive.ids.push(o.id);
    return save.archive.ids.map(id => byId[id]).filter(o => o && (all.some(a => a.id === o.id) || save.archive.ids.includes(o.id)));
  }
  function grantArchive(o) {
    const list = ownList(o.kind); if (!list.includes(o.id)) list.push(o.id);
    save.archived = save.archived || []; if (!save.archived.includes(o.id)) save.archived.push(o.id);
  }
  const archRarity = o => o.rar;
  const offerName = o => o.kind === 'pet' ? petById(o.id).name : (o.kind === 'skin' ? SKINS : FX).find(x => x.id === o.id).name;
  const offerKind = o => ({ skin: 'скин', fx: 'эффект', pet: 'питомец' })[o.kind];

  // weekly tasks: three a week (easy / medium / hard), each pays a chest; all three — a coin bonus
  const WEEKLY = {
    easy: [
      { id: 'w_rounds', text: n => `Сыграй ${n} раундов`, n: 15, add: S => 1 },
      { id: 'w_kills', text: n => `Съешь ${n} капель`, n: 40, add: S => S.kills },
      { id: 'w_crumbs', text: n => `Собери ${n.toLocaleString('ru-RU')} крошек`, n: 3000, add: S => S.crumbs },
      { id: 'w_bonus', text: n => `Подбери ${n} бонусов`, n: 20, add: S => S.bonuses },
    ],
    mid: [
      { id: 'w_bosses', text: n => `Победи ${n} боссов`, n: 8, add: S => S.bosses },
      { id: 'w_wins', text: n => `Одержи ${n} побед в любых режимах`, n: 5, add: S => S.win ? 1 : 0 },
      { id: 'w_mass', text: n => `${n} раза набери 4 000 массы за раунд`, n: 3, add: S => S.maxMass >= 4000 ? 1 : 0 },
      { id: 'w_combo', text: n => `${n} раза сделай комбо ×5`, n: 3, add: S => (S.bestCombo || 0) >= 5 ? 1 : 0 },
    ],
    hard: [
      { id: 'w_stars', text: n => `Съешь ${n} ботов-звёзд`, n: 5, add: S => S.starKills || 0 },
      { id: 'w_modes', text: n => `Сыграй в ${n} разных режимах`, n: 6, modes: true },
      { id: 'w_big', text: () => 'Набери 10 000 массы за один раунд', n: 1, add: S => S.maxMass >= 10000 ? 1 : 0 },
      { id: 'w_raid', text: n => `Нанеси ${n.toLocaleString('ru-RU')} урона боссу рейда`, n: 20000, add: S => S.mode === 'raid' ? S.raidDmg || 0 : 0 },
      { id: 'w_wave', text: () => 'Доживи до 8-й волны «Выживания»', n: 1, add: S => S.mode === 'survival' && S.wave >= 8 ? 1 : 0 },
    ],
  };
  const WEEK_RAR = { easy: 'rare', mid: 'epic', hard: 'legendary' }, WEEK_BONUS = 1000, WEEK_CHEST = 'epic';   // 1.7.0: one chest for all three
  const weeklyTasks = w => ['easy', 'mid', 'hard'].map((t, k) => { const pool = WEEKLY[t]; return { tier: t, ...pool[(w * 7 + k * 3) % pool.length] }; });

  // skill achievements: one round, done right. Each gives its own title and coins; all of them — a frame and a skin
  const SKILL = [
    { id: 'sk_hardcore', name: 'Без права на ошибку', desc: 'В «Хардкоре» набери 5 000 массы, ни разу не разделившись', hint: 'Делиться нельзя совсем — расти на крошках и мелких каплях, обходи шипы.', coins: 1500, title: ['Железный', '#c0c8e0'],
      test: S => S.mode === 'hardcore' && !S.splits && S.maxMass >= 5000, best: S => S.mode === 'hardcore' && !S.splits ? Math.round(S.maxMass) : null, unit: 'массы' },
    { id: 'sk_giant60', name: 'Молниеносный', desc: 'Набери массу 1000 быстрее чем за 60 секунд', hint: 'Не отвлекайся на боссов: собирай крошки и ешь мелкие капли подряд, бонус «Двойная еда» очень помогает.', coins: 2000, title: ['Молния', '#ffd23f'],
      test: S => S.t1000 !== undefined && S.t1000 <= 60, best: S => S.t1000 !== undefined ? Math.floor(S.t1000) : null, lower: true, unit: 'с' },
    { id: 'sk_pacifist', name: 'Пацифист', desc: 'Набери 3 000 массы, не съев ни одной капли — только крошки', hint: 'Подойдут бонусы «Двойная еда» и «Магнит», а также событие «Метеоритный дождь».', coins: 1000, title: ['Пацифист', '#3dffa2'],
      test: S => !S.eatenCells && S.maxMass >= 3000, best: S => !S.eatenCells ? Math.round(S.maxMass) : null, unit: 'массы' },
    { id: 'sk_nobonus', name: 'Чистая победа', desc: 'Займи 1-е место в режиме «На время», не подобрав ни одного бонуса', hint: 'Обходи светящиеся бонусы стороной — даже случайно.', coins: 1000, title: ['Честный игрок', '#9fd8ff'],
      test: S => S.mode === 'timed' && S.win && !S.bonuses },
    { id: 'sk_race', name: 'Стремительный', desc: 'Выиграй «Гонку массы» быстрее чем за 2 минуты', hint: 'Рывок + деление на крупную добычу ускоряют набор массы.', coins: 1500, title: ['Стрела', '#ff9a3d'],
      test: S => S.mode === 'race' && S.win && S.time <= 120, best: S => S.mode === 'race' && S.win ? Math.floor(S.time) : null, lower: true, unit: 'с' },
    { id: 'sk_crown', name: 'Король арены', desc: 'В «Захвате короны» удержи корону суммарно 2 минуты за раунд', hint: 'Корона у самой крупной капли: держи массу и не дели её без нужды.', coins: 1500, title: ['Монарх', '#ffd23f'],
      test: S => S.mode === 'crown' && S.crownT >= 120, best: S => S.mode === 'crown' ? Math.floor(S.crownT || 0) : null, unit: 'с' },
    { id: 'sk_royale', name: 'Тихий охотник', desc: 'Победи в «Королевской битве», ни разу не сделав рывок', hint: 'Без рывка важнее позиция: держись ближе к центру безопасной зоны.', coins: 2000, title: ['Невидимка', '#b26bff'],
      test: S => S.mode === 'royale' && S.win && !S.dashes },
    { id: 'sk_survival', name: 'Скала', desc: 'Доживи до 10-й волны «Выживания», ни разу не разделившись', hint: 'Боссов можно обходить — главное выжить. Шипы — твоё укрытие от крупных.', coins: 2000, title: ['Скала', '#7fe8ff'],
      test: S => S.mode === 'survival' && !S.splits && S.wave >= 10, best: S => S.mode === 'survival' && !S.splits ? S.wave || 0 : null, unit: 'волна' },
    { id: 'sk_untouched', name: 'Без единой царапины', desc: 'Продержись 5 минут, не потеряв ни одной своей части', hint: 'Любой режим. Части, съеденные врагами или шипами, обнуляют попытку.', coins: 1500, title: ['Невредимый', '#22e6ff'],
      test: S => S.time >= 300 && !S.partsLost, best: S => !S.partsLost ? Math.floor(S.time) : null, unit: 'с' },
    { id: 'sk_starsprint', name: 'Метеор', desc: 'Съешь бота-звезду в первые 60 секунд раунда', hint: 'Звезда отмечена ★ в таблице лидеров. Ищи её сразу после старта.', coins: 1000, title: ['Метеор', '#ff4fd8'],
      test: S => S.firstStarT !== undefined && S.firstStarT <= 60, best: S => S.firstStarT !== undefined ? Math.floor(S.firstStarT) : null, lower: true, unit: 'с' },
    { id: 'sk_raid', name: 'Удар титана', desc: 'Нанеси боссу рейда 15 000 урона за одну попытку', hint: 'Урон — масса частей босса, которые съел именно ты. Не давай ботам их перехватывать.', coins: 1500, title: ['Титаноборец', '#ff2d55'],
      test: S => S.mode === 'raid' && (S.raidDmg || 0) >= 15000, best: S => S.mode === 'raid' ? S.raidDmg || 0 : null, unit: 'урона' },
    { id: 'sk_team', name: 'Импровизатор', desc: 'В «Случайном билде» стань лидером арены, применив все три выпавшие способности', hint: 'Сразу попробуй каждую способность из билда — и пробейся на 1-е место хотя бы на мгновение.', coins: 1000, title: ['Импровизатор', '#b26bff'],
      test: S => S.mode === 'rbuild' && S.bestRank === 1 && runBuild.filter(Boolean).every(id => S.abUsed[id]) },   // 2.1.0: was «Разгром» (team battle); the id stays so earned progress counts
    { id: 'sk_david', name: 'Давид и Голиаф', desc: 'Съешь последнюю часть босса, когда твоя масса меньше 400', hint: 'Не расти до первого босса (таймер «Босс через…» вверху): пока ты мал, Шустрик весит всего 90. Подрасти одной частью до 120–200, загони его на шип и добей.', coins: 1500, title: ['Давид', '#fff6a0'],
      test: S => !!S.smallBoss },
  ];
  // 1.7.0: instead of 13 titles — 4 for 3 / 6 / 9 / 13 mastery achievements
  const SKILL_TT = [[3, 'tt_sk3'], [6, 'tt_sk6'], [9, 'tt_sk9'], [13, 'tt_sk13']];
  DECOR.push(tt('tt_sk3', 'Умелец', 'rare', '#7cf3ff', '#ffffff', '✪', { skillN: 3 }), tt('tt_sk6', 'Знаток', 'epic', '#3dffa2', '#22e6ff', '✪', { skillN: 6 }),
    tt('tt_sk9', 'Виртуоз', 'epic', '#ff9a3d', '#ffd23f', '✪', { skillN: 9 }), tt('tt_sk13', 'Гроссмейстер', 'legendary', '#ffd23f', '#ff4fd8', '✪', { skillN: 13 }));
  // promo-code exclusives: frame + title for each code (1.7.0)
  DECOR.push({ id: 'fr_beta', kind: 'frame', name: 'Бета-тестер', css: 'border:2px solid #22e6ff', cls: 'fr-beta', promo: true },
    { id: 'fr_creator', kind: 'frame', name: 'Создатель', css: 'border:2px solid #ffd23f', cls: 'fr-creator', promo: true, crown: true },
    { id: 'fr_vet', kind: 'frame', name: 'Ветврач', css: 'border:2px solid #3dffa2', cls: 'fr-vet', promo: true },
    { id: 'fr_bday2026', kind: 'frame', name: 'Именинник 2026', css: 'border:2px solid #ff4fd8', cls: 'fr-vet', a: '#ff4fd8', b: '#ffd23f', promo: true, gift: 'bday2026' },
    { id: 'tt_beta', kind: 'title', name: 'Бета-тестер', color: '#7cf3ff', cls: 'tt-holo', ico: 'β', promo: true },
    { id: 'tt_cr_master', kind: 'title', name: 'Часовых дел мастер', color: '#ffd27a', cls: 'tt-brass', ico: '⚙', rar: 'legendary', series: 'chronos' },
    { id: 'tt_ps5', kind: 'title', name: 'Неутомимый', color: '#ffd23f', cls: 'tt-gold', ico: '✦', rar: 'epic', prestige: '★5' },
    { id: 'tt_ps25', kind: 'title', name: 'Звёздный ветеран', color: '#fff6a0', cls: 'tt-gold', ico: '★', rar: 'legendary', prestige: '★25' },
    { id: 'tt_ps_sn', kind: 'title', name: 'Сверхновая', color: '#ff8ae6', cls: 'tt-holo', ico: '✦', rar: 'legendary', prestige: '✦15' },
    { id: 'tt_ps_lg', kind: 'title', name: 'Легенда звёзд', color: '#ffd23f', cls: 'tt-holo', ico: '★', rar: 'legendary', prestige: '✦25' },
    { id: 'fr_ps_orbit', kind: 'frame', name: 'Орбита', rar: 'legendary', a: '#b26bff', b: '#ff8ae6', css: 'border:2px solid #b26bff', cls: 'fr-l', prestige: '✦1' },
    { id: 'tt_creator', kind: 'title', name: 'Создатель игры', color: '#ffd23f', cls: 'tt-gold', ico: '♛', promo: true },
    { id: 'tt_vet', kind: 'title', name: 'Ветврач', color: '#3dffa2', cls: 'tt-pulse', ico: '✚', promo: true });
  DECOR.push(fr('fr_master', 'Мастер', 'legendary', '#22e6ff', '#ff4fd8', { skill: 'all' }));
  function checkSkill(S) {
    const out = [];
    for (const k of SKILL) {
      if (k.best) { const v = k.best(S); if (v !== null && v !== undefined) { const old = save.skillBest[k.id]; if (old === undefined || (k.lower ? v < old : v > old)) save.skillBest[k.id] = v; } }
      if (save.skillDone.includes(k.id) || !k.test(S)) continue;
      save.skillDone.push(k.id); save.coins += k.coins; save.legend.coins = (save.legend.coins || 0) + k.coins;
      out.push(k);
    }
    for (const [n, id] of SKILL_TT) if (save.skillDone.length >= n && !save.decor.includes(id)) { save.decor.push(id); out.push({ ms: id }); }
    if (save.skillDone.length === SKILL.length && !save.decor.includes('fr_master')) { save.decor.push('fr_master'); if (!save.skins.includes('sk_virtuoso')) save.skins.push('sk_virtuoso'); out.push({ all: true }); }
    return out;
  }

  // legendary achievements: counted from the day they appeared, each gives an exclusive item
  const LEGEND = [
    { id: 'kills',  name: 'Пожиратель миров',   desc: 'Съешь 100 000 капель',                 goal: 100000,  reward: ['skin', 'lg_worlds'] },
    { id: 'coins',  name: 'Золотой магнат I',   desc: 'Заработай 100 000 монет',              goal: 100000,  reward: ['skin', 'lg_tycoon'] },
    { id: 'coins2', key: 'coins', name: 'Золотой магнат II', desc: 'Заработай 1 000 000 монет — больше, чем стоят все арены вместе', goal: 1000000, reward: [['fx', 'lg_moneyAura'], ['deco', 'fr_platinum'], ['deco', 'tt_millionaire'], ['badge', 'millionaire']], extra: true },
    { id: 'bosses', name: 'Истребитель титанов', desc: 'Победи 10 000 боссов',                goal: 10000,   reward: ['fx', 'lg_titanTrail'] },
    { id: 'stars1', key: 'stars', name: 'Гроза звёзд I',   desc: 'Съешь 1 000 ботов-звёзд',              goal: 1000,  reward: [['deco', 'fr_star'], ['deco', 'tt_starcatcher']] },
    { id: 'stars2', key: 'stars', name: 'Гроза звёзд II',  desc: 'Съешь 5 000 ботов-звёзд',              goal: 5000,  reward: [['skin', 'lg_supernova'], ['pet', 'lg_starpet']], extra: true },
    { id: 'stars3', key: 'stars', name: 'Гроза звёзд III', desc: 'Съешь 10 000 ботов-звёзд',             goal: 10000, reward: [['fx', 'lg_crownAura'], ['deco', 'tt_starstorm']], extra: true },
    { id: 'wins1',  key: 'wins',  name: 'Непобедимый I',   desc: 'Одержи 1 000 побед в любых режимах',   goal: 1000,  reward: ['deco', 'fr_legend'] },
    { id: 'wins2',  key: 'wins',  name: 'Непобедимый II',  desc: 'Одержи 5 000 побед в любых режимах',   goal: 5000,  reward: ['deco', 'tt_invincible'], extra: true },
    { id: 'wins3',  key: 'wins',  name: 'Непобедимый III', desc: 'Одержи 10 000 побед в любых режимах',  goal: 10000, reward: ['skin', 'lg_eternal'], extra: true },
    { id: 'time',   name: 'Вечный игрок',       desc: 'Проведи в игре 100 часов',             goal: 360000,  reward: ['pet', 'lg_pet'], time: true },
    { id: 'crumbs', name: 'Космический пылесос', desc: 'Собери 1 000 000 крошек',             goal: 1000000, reward: ['arena', 'galaxy'] },
    { id: 'lwins',  name: 'Олимпиец',           desc: 'Одержи 500 побед в рейтинговом бою лиги', goal: 500,  reward: ['arena', 'olympus'] },
    { id: 'combo',  name: 'Цепная реакция',     desc: 'Сделай комбо ×25',                     goal: 25,      reward: ['fx', 'lg_burstEat'] },
  ];
  const LEGEND_BASE = LEGEND.filter(L => !L.extra);   // what the badge needs: first tiers only
  const rewardsOf = L => Array.isArray(L.reward[0]) ? L.reward : [L.reward];
  const legendNames = L => rewardsOf(L).map(legendName).join(' + ');
  const legendName = ([t, id]) => t === 'badge' ? 'значок «Миллионер»' : t === 'deco' && decorById(id).kind === 'title' ? `титул «${decorById(id).name}»` : t === 'skin' ? `скин «${SKINS.find(k => k.id === id).name}»` : t === 'fx' ? `эффект «${FX.find(f => f.id === id).name}»` : t === 'deco' ? `рамка «${decorById(id).name}»`
    : t === 'pet' ? `питомец «${petById(id).name}»` : `арена «${ARENAS.find(a => a.id === id).name}»`;
  function grantLegend(L) {
    for (const [t, id] of rewardsOf(L)) {
      if (t === 'badge') { save.badges = save.badges || {}; save.badges[id] = save.badges[id] || today; continue; }
      const list = t === 'skin' ? save.skins : t === 'fx' ? save.fxOwned : t === 'deco' ? save.decor : t === 'pet' ? save.pets : save.arenas;
      if (!list.includes(id)) list.push(id);
    }
  }
  const legendVal = L => save.legend[L.key || L.id] || 0;
  function checkLegend() {
    const out = [];
    for (const L of LEGEND) if (!save.legendDone.includes(L.id) && legendVal(L) >= L.goal) { save.legendDone.push(L.id); grantLegend(L); out.push(L); }
    if (LEGEND_BASE.every(L => save.legendDone.includes(L.id)) && !save.legendBadge) { save.legendBadge = today; out.push({ badge: true }); }
    return out;
  }
  const leagueDecor = li => DECOR.filter(d => d.league !== undefined && (d.kind === 'frame' ? d.league === li : d.league <= li));
  // ---- arena themes (shop) ----
  // 1.7.0: 10 arenas, each its own place — scenery around the field (arenaScenery), its own floor and its own rule
  const ARENAS = [
    { id: 'default', name: 'Неоновый космос', price: 0,     floor: '#0b0824', grid: 'rgba(140, 100, 255, .55)', dot: '#22e6ff', rim: '#ff4fd8', inner: '#22e6ff', neb: ['#ff4fd8', '#22e6ff', '#7b3dff', '#ff3d6e'], fx: null, desc: 'Неоновая сетка, пояс астероидов и планеты на горизонте' },
    { id: 'lava',    name: 'Лава',            price: 30000, lvl: 12, floor: '#1a0500', grid: 'rgba(255, 90, 0, .6)',     dot: '#ffd23f', rim: '#ff3d00', inner: '#ffd23f', neb: ['#ff3d00', '#ff9a3d', '#7b0020', '#ff2d55'], fx: 'embers', ground: '#120300', desc: 'Лавовые реки в трещинах пола и дымящиеся вулканы за краем' },
    { id: 'ice',     name: 'Лёд',             price: 36000, lvl: 16, floor: '#06142a', grid: 'rgba(160, 230, 255, .6)',  dot: '#ffffff', rim: '#9fe8ff', inner: '#ffffff', neb: ['#9fe8ff', '#4d7cff', '#ffffff', '#22e6ff'], fx: 'snow', ground: '#0a1f38', desc: 'Зеркальный лёд, ледяные торосы по кругу и снегопад' },
    { id: 'ocean',   name: 'Подводный мир',   price: 45000, lvl: 20, floor: '#021a33', grid: 'rgba(34, 170, 255, .55)',  dot: '#3dffa2', rim: '#22a6ff', inner: '#3dffa2', neb: ['#22a6ff', '#3dffa2', '#0a3a6e', '#22e6ff'], fx: 'bubbles', ground: '#03213a', desc: 'Блики воды на дне, водоросли, кораллы и медузы' },
    { id: 'cyber',   name: 'Киберград',       price: 60000, lvl: 24, floor: '#0a0018', grid: 'rgba(255, 79, 216, .7)',   dot: '#22e6ff', rim: '#22e6ff', inner: '#ff4fd8', neb: ['#ff4fd8', '#22e6ff', '#3dffa2', '#7b3dff'], fx: 'rain', ground: '#07001a', desc: 'Пол-микросхема, небоскрёбы с окнами и цифровой дождь' },
    { id: 'galaxy',  name: 'Млечный путь',    price: 0, legend: 'crumbs', floor: '#07021a', grid: 'rgba(178, 107, 255, .55)', dot: '#ffffff', rim: '#b26bff', inner: '#ff4fd8', neb: ['#7b3dff', '#ff4fd8', '#22e6ff', '#3a0a8e'], fx: 'cosmos', desc: 'Пол — звёздное небо, туманности и планета с кольцами' },
    { id: 'olympus', name: 'Олимп',           price: 0, legend: 'lwins',  floor: '#1a1405', grid: 'rgba(255, 210, 63, .6)',   dot: '#ffffff', rim: '#ffd23f', inner: '#ffffff', neb: ['#ffd23f', '#ff9a3d', '#fff6a0', '#ff4fd8'], fx: 'gold', ground: '#1f1a10', desc: 'Мраморный пол, колоннада и золотой венец по краю' },
    { id: 'sakura',  name: 'Сад сакуры',      price: 0, exclusive: true, src: 'коллекция «Первое полугодие» (сезоны лиги 1–13)', floor: '#1f0a17', grid: 'rgba(255, 158, 196, .55)', dot: '#ffffff', rim: '#ff9ec4', inner: '#ffd1e8', neb: ['#ff9ec4', '#ff4fd8', '#ffd1e8', '#b26bff'], fx: 'petals', ground: '#1a0b14', desc: 'Цветущие деревья вокруг поля, падают лепестки' },
    { id: 'inferno', name: 'Пекло',           price: 0, exclusive: true, src: 'Хаос-лига: 10 сезонов, законченных в «Разломе» или выше', floor: '#140000', grid: 'rgba(255, 45, 0, .65)', dot: '#ffd23f', rim: '#ff2d00', inner: '#ff9a3d', neb: ['#7b0000', '#ff2d00', '#ff9a3d', '#2a0000'], fx: 'ash', ground: '#0d0000', desc: 'Раскалённый пол, огненные столбы и пепел' },
    { id: 'retro',   name: 'Ретро-волна',     price: 0, exclusive: true, src: 'коллекция «Второе полугодие» (сезоны лиги 14–26)', floor: '#12001f', grid: 'rgba(255, 79, 216, .8)', dot: '#22e6ff', rim: '#ff4fd8', inner: '#ffd23f', neb: ['#ff4fd8', '#ff9a3d', '#7b3dff', '#22e6ff'], fx: 'retro', ground: '#12001f', desc: 'Синтвейв: солнце, неоновые горы и сетка до горизонта' },
    { id: 'chronos', name: 'Часовой механизм', price: 0, exclusive: true, craft: 'legendary', src: 'мастерская, серия «Хронос»', floor: '#120c07', grid: 'rgba(255, 210, 122, .45)', dot: '#fff6d8', rim: '#ffd27a', inner: '#e8b05a', neb: ['#ffd27a', '#ff9a3d', '#7b3dff', '#22e6ff'], fx: 'gold', ground: '#0c0805', desc: 'Пол — огромный циферблат с идущими стрелками, под стеклом шестерни, вокруг вращаются латунные колёса и стоят часовые башни' },
  ];
  let apvArena = null;   // arena shown in the preview (overrides the chosen one while it is open)
  const arenaDef = () => apvArena || ARENAS.find(a => a.id === save.arena) || ARENAS[0];
  // every arena has its own small rule — only in normal modes, never in the leagues (there everyone plays standard rules)
  const ARENA_FX = {
    default: 'без особенностей — стандартные правила',
    lava:    '+3 шипа на арене',
    ice:     'скользко: капли поворачивают медленнее',
    ocean:   'бонусы появляются на 40% чаще',
    cyber:   'все капли на 10% быстрее',
    galaxy:  '+10% опыта за раунд',
    olympus: '+5% монет за раунд',
    sakura:  'бонусы действуют на 25% дольше',
    inferno: 'шипов вдвое больше',
    retro:   'монеты за комбо ×2',
    chronos: 'способности перезаряжаются на 10% быстрее',
  };
  const arenaIs = id => !!(stats && stats.arena === id);
  // ---- weekly boss raid ----
  const RAID_HP = 40000, RAID_ATTEMPT_CAP = 18000, RAID_TRIES = 3, RAID_LEN = 240;
  const RAID_NAMES = ['Пожиратель', 'Тёмная медуза', 'Кристальный голем', 'Неоновый кракен', 'Звёздный червь', 'Ледяной титан', 'Магматический страж', 'Призрачный левиафан'];
  const RAID_HEADS = ['horns', 'gem', 'flame', 'antenna', 'halo', 'star', 'wings'];
  const raidWeek = () => Math.floor((Date.now() / 864e5 + 3) / 7);   // weeks start on Monday
  const raidBoss = w => {
    const h = (w * .618034) % 1, col = '#' + new THREE.Color().setHSL(h, .9, .55).getHexString(), acc = '#' + new THREE.Color().setHSL((h + .5) % 1, 1, .6).getHexString();
    const mon = new Date((w * 7 - 3) * 864e5), dd = n => String(n).padStart(2, '0');
    return { name: RAID_NAMES[w % RAID_NAMES.length], color: col, accent: acc, date: `${dd(mon.getUTCDate())}.${dd(mon.getUTCMonth() + 1)}.${String(mon.getUTCFullYear()).slice(2)}` };
  };
  // 1.7.0: one trophy per quarter of the year (the Monday of the raid week decides the quarter)
  const raidQuarter = w => Math.floor(new Date((w * 7 - 3) * 864e5).getUTCMonth() / 3) + 1;
  function ensureRaidSkin(w) { return 'raid_q' + raidQuarter(w); }

  // ================= pets (league rewards: Platinum and Neon; holiday pets in holiday seasons) =================
  const PET_SPECIES = { drop: 'Капелька', cat: 'Котик', cube: 'Кубик', pyramid: 'Пирамидка', jelly: 'Медуза', firefly: 'Светлячок', robot: 'Робот', ghost: 'Призрачок',
    pumpkin: 'Тыковка', bat: 'Летучая мышка', snowman: 'Снеговичок', deer: 'Олешек', heart: 'Сердечко', cupid: 'Амурчик', cuckoo: 'Кукушка', mouse: 'Мышка', owl: 'Совёнок' };
  const REG_SPECIES = ['drop', 'cat', 'cube', 'pyramid', 'jelly', 'firefly', 'robot', 'ghost'];
  const PET_BONUS = {
    magnet: { name: 'Сборщик', text: lv => `+${lv} к радиусу сбора крошек` },
    coins:  { name: 'Копилка', text: lv => `+${5 * lv}% монет за раунд` },
    speed:  { name: 'Ветерок', text: lv => `+${2 * lv}% к скорости` },
    xp:     { name: 'Умник',   text: lv => `+${5 * lv}% опыта за раунд` },
    shield: { name: 'Страж',   text: lv => `+${2 * lv} с неуязвимости в начале раунда` },
    eater:  { name: 'Обжора',  text: lv => `сам подбирает крошки рядом с собой (радиус ${2 + lv})` },
    // 2.3 workshop «Хронос» pets: their own skills (not tied to the level)
    cuckoo: { name: 'Кукушка',    text: () => 'раз в минуту кукует и показывает стрелкой, где ближайший бонус' },
    windup: { name: 'Завод',      text: () => 'раз в 45 с способности перезаряжаются на 2 с быстрее' },
    owl:    { name: 'Предсказатель', text: () => 'за 5 с до появления бонуса отмечает это место циферблатом с отсчётом' },
  };
  const BONUS_KEYS = Object.keys(PET_BONUS);
  // ---- extra collections: league set, league seasons by quarter (1–13, 14–26, 27–39, 40–52), holiday sets ----
  function addExtraCollections() {
    DECOR.push(tt('tt_zoo', 'Укротитель', 'epic', '#3dffa2', '#ffd23f', '✦', { col: true }));
    COLLECTIONS.push({ id: 'col_zoo', group: 'pets', name: 'Зверинец', title: 'tt_zoo', coins: 0, items: () => PETS.filter(pt => pt.chest).map(pt => ['pet', pt.id]) });
    COLLECTIONS.push({ id: 'col_league', group: 'league', name: 'Лиговый набор', hat: 'cup', coins: 3000,
      items: () => [...SKINS.filter(k => k.lchest).map(k => ['skin', k.id]), ...FX.filter(f => f.lchest).map(f => ['fx', f.id]), ...PETS.filter(pt => pt.lchest).map(pt => ['pet', pt.id])] });
    // 1.7.0: season frames (Platinum) and titles (Neon); league seasons collected in two halves of the year
    [['Первое', '#3dffa2', '#ffd23f'], ['Второе', '#ff4fd8', '#22e6ff']].forEach(([n, c, c2], q) => {
      DECOR.push(fr('fr_q' + (q + 1), `${n} полугодие`, 'epic', c, c2, { col: true }));
      COLLECTIONS.push({ id: 'col_q' + (q + 1), group: 'seasons', name: `${n} полугодие · сезоны ${q * 13 + 1}–${q * 13 + 13}`, frame: 'fr_q' + (q + 1), arena: q ? 'retro' : 'sakura', coins: 5000,
        items: () => { const out = []; for (let id = q * 13 + 1; id <= q * 13 + 13; id++) { const sd = seasonData(id);
          if (sd.holiday) sd.items.forEach(it => out.push([it.kind, it.id])); else { if (sd.skin) out.push(['skin', sd.skin.id]); if (sd.fx) out.push(['fx', sd.fx.id]); }
          sd.pets.forEach(pt => out.push(['pet', pt.id])); } return out; } });
    });
    DECOR.push(tt('tt_xarsenal', 'Архитектор хаоса', 'legendary', '#22e6ff', '#b26bff', '✦', { col: true }),
      fr('fr_xarsenal', 'Горизонт событий', 'legendary', '#b26bff', '#ff4fd8', { col: true }));
    COLLECTIONS.push({ id: 'col_xarsenal', group: 'chaos', name: 'Хаос-арсенал', title: 'tt_xarsenal', frame: 'fr_xarsenal', coins: 0, items: () => XA_ABIL.map(a => ['abil', a.id]) });
    DECOR.push(tt('tt_looks', 'Мастер обликов', 'epic', '#c46bff', '#22e6ff', '✦', { col: true }),
      tt('tt_cvetall', 'Вечный странник хаоса', 'legendary', '#ffd23f', '#ff4fd8', '✦', { col: true }));
    COLLECTIONS.push({ id: 'col_looks', group: 'chaos', looks: true, name: 'Облики способностей', title: 'tt_looks', coins: 0, items: () => allLooks().map(l => ['look', l.id]) });
    COLLECTIONS.push({ id: 'col_cvet', group: 'chaos', name: 'Ветераны Хаоса', title: 'tt_cvetall', coins: 0, items: () => CHAOS_VET.map(v => [v.kind, v.id]) });
    DECOR.push(tt('tt_arsenal', 'Оружейник', 'epic', '#ff9a3d', '#ffd23f', '✦', { col: true }),
      fr('fr_arsenal', 'Оружейная', 'epic', '#ff9a3d', '#ffd23f', { col: true }));
    COLLECTIONS.push({ id: 'col_arsenal', group: 'abil', name: 'Арсенал', title: 'tt_arsenal', frame: 'fr_arsenal', coins: ABIL_CFG.arsenalCoins, items: () => BASE_ABIL.map(a => ['abil', a.id]) });
    const HOL_TITLE = { newyear: ['Дух Нового года', '#9fe8ff'], valentine: ['Романтик', '#ff4f9a'], halloween: ['Ночной кошмар', '#ff7a00'] };
    Object.keys(HOLIDAYS).forEach(k => {
      DECOR.push(tt(`tt_hol_${k}`, HOL_TITLE[k][0], 'epic', HOL_TITLE[k][1], '#ffffff', '✦', { col: true }));
      COLLECTIONS.push({ id: `col_hol_${k}`, group: 'holiday', holiday: true, name: HOLIDAYS[k].name, title: `tt_hol_${k}`, coins: 2000,
        items: () => [...holidayItems(k).map(it => [it.kind, it.id]), ...holidayPets(k).map(pt => ['pet', pt.id])] });
    });
  }
  const PETS = [], petMap = {};
  const addPet = pt => { if (!petMap[pt.id]) { petMap[pt.id] = pt; PETS.push(pt); } };
  // 1.7.0: 32 pets, each its own species and animation (league seasons, holidays, chests, league chest, legends, raid)
  const PET_LIST = [
    // league seasons (Neon of odd seasons)
    ['p_1',  'Сиятельная медуза',  'jelly',   '#3dffa2', '#7b3dff', 'magnet', 2, { season: 1 }],
    ['p_3',  'Метеорит',           'meteor',  '#ff6a00', '#ffd23f', 'speed',  2, { season: 3 }],
    ['p_5',  'Ледяной лис',        'fox',     '#e8fbff', '#4d7cff', 'shield', 2, { season: 5 }],
    ['p_7',  'Астронавт',          'astro',   '#ffffff', '#b26bff', 'xp',     2, { season: 7 }],
    ['p_9',  'Кубит',              'qubit',   '#22e6ff', '#ffd23f', 'coins',  2, { season: 9 }],
    ['p_11', 'Плазменный змей',    'snake',   '#7b3dff', '#ff3d6e', 'eater',  2, { season: 11 }],
    ['p_13', 'Звёздочка',          'star',    '#fff6a0', '#ff4fd8', 'magnet', 2, { season: 13 }],
    ['p_15', 'Кассетник',          'tape',    '#ff4fd8', '#22e6ff', 'xp',     2, { season: 15 }],
    ['p_17', 'Светляк-дерево',     'beetle',  '#3dffa2', '#0b3a1a', 'speed',  2, { season: 17 }],
    ['p_19', 'Голо-кот',           'cat',     '#22e6ff', '#ff4fd8', 'coins',  2, { season: 19, holo: true }],
    ['p_21', 'Кристаллик',         'crystal', '#9fe8ff', '#b26bff', 'shield', 2, { season: 21 }],
    ['p_23', 'Мини-дыра',          'hole',    '#05021a', '#b26bff', 'eater',  2, { season: 23 }],
    ['p_25', 'Неоновый дракончик', 'dragon',  '#ff4fd8', '#22e6ff', 'coins',  3, { season: 25 }],
    // holidays (Platinum of the holiday season)
    ['hp_halloween', 'Тыковка',  'pumpkin', '#ff7a00', '#3dff6e', 'magnet', 2, { holiday: 'halloween' }],
    ['hp_newyear',   'Олешек',   'deer',    '#c98a4b', '#ff2d55', 'coins',  2, { holiday: 'newyear' }],
    ['hp_valentine', 'Амурчик',  'cupid',   '#ffd1e8', '#ffd23f', 'xp',     2, { holiday: 'valentine' }],
    // chests
    ['c_p_mint',      'Мятная капелька',    'drop',    '#3dffa2', '#22e6ff', 'magnet', 1, { chest: 'common' }],
    ['c_p_ginger',    'Рыжий котик',        'cat',     '#ff9a3d', '#fff3d6', 'coins',  1, { chest: 'common' }],
    ['c_p_cube',      'Кубик-рубик',        'cube',    '#4d7cff', '#ffd23f', 'xp',     1, { chest: 'common' }],
    ['c_p_neonfly',   'Неоновый светлячок', 'firefly', '#22e6ff', '#ff4fd8', 'eater',  1, { chest: 'rare' }],
    ['c_p_rusty',     'Ржавый робот',       'robot',   '#c98a4b', '#ffd23f', 'shield', 1, { chest: 'rare' }],
    ['c_p_lav',       'Лавандовая медуза',  'jelly',   '#c38bff', '#ff9ec4', 'speed',  1, { chest: 'rare' }],
    ['c_p_chameleon', 'Призрак-хамелеон',   'ghost',   '#3dffa2', '#b26bff', 'speed',  2, { chest: 'epic', holo: true }],
    ['c_p_goldcat',   'Золотой котик',      'cat',     '#ffd23f', '#ff9a3d', 'coins',  2, { chest: 'epic' }],
    ['c_p_slime',     'Пиксельный слизень', 'slime',   '#b9ff3d', '#1f4d00', 'eater',  2, { chest: 'epic' }],
    ['c_p_rainbow',   'Радужный светлячок', 'firefly', '#ff4fd8', '#3dffa2', 'shield', 3, { chest: 'legendary', rainbow: true }],
    // league chest
    ['lc_p_mascot', 'Лиговый талисман', 'cube',  '#c0c8e0', '#4d7cff', 'coins', 1, { lchest: 'common' }],
    ['lc_p_cupbot', 'Кубок-робот',      'robot', '#ffd23f', '#ff9a3d', 'xp',    2, { lchest: 'rare' }],
    ['lc_p_spirit', 'Неоновый дух',     'ghost', '#ff4fd8', '#22e6ff', 'speed', 3, { lchest: 'legendary' }],
    // legends and raid
    ['lg_starpet', 'Звёздный страж',     'robot', '#fff6a0', '#ff4fd8', 'shield', 3, { legend: 'stars2' }],
    ['lg_pet',     'Хранитель вечности', 'ghost', '#ffd23f', '#ff4fd8', 'coins',  3, { legend: 'time' }],
    ['raid_p',     'Рейдер',             'brute', '#ff2d55', '#ffd23f', 'eater',  2, { raid: true }],
    // 2.3 workshop «Хронос» (craft only)
    ['cr_p_cuckoo', 'Кукушка',          'cuckoo', '#e8b05a', '#7a4a12', 'cuckoo', 1, { craft: 'rare' }],
    ['cr_p_mouse',  'Заводная мышка',   'mouse',  '#d9a45a', '#7a4a12', 'windup', 1, { craft: 'epic' }],
    ['cr_p_owl',    'Совёнок-часовщик', 'owl',    '#c98a4b', '#5a3010', 'owl',    1, { craft: 'legendary' }],
  ];
  const PET_TIER = pt => pt.craft ? 'Мастерская · ' + RARITY[pt.craft].name : pt.season ? (pt.season % 2 ? 'Сезон · Неон' : 'Сезон') : pt.holiday ? 'Праздник · Платина' : pt.chest ? RARITY[pt.chest].name : pt.lchest ? 'Сундук лиги' : pt.legend ? 'Легенда' : pt.raid ? 'Босс-рейд' : '';
  PET_LIST.forEach(([id, name, species, color, accent, bonus, lv, extra]) => { const pt = { id, name, species, color, accent, bonus, lv, ...extra }; pt.tier = PET_TIER(pt); addPet(pt); });
  const seasonPets = i0 => PETS.filter(pt => pt.season === i0 + 1);
  const holidayPets = k => PETS.filter(pt => pt.holiday === k);
  function petById(id) { return (id && petMap[id]) || null; }
  const LEAGUES = [
    { name: 'Бронза',  pts: 0,     color: '#cd7f32', coins: 200 },
    { name: 'Серебро', pts: 1500,  color: '#c0c8e0', coins: 600 },
    { name: 'Золото',  pts: 4000,  color: '#ffd23f', coins: 1200 },
    { name: 'Платина', pts: 8000,  color: '#7fe8ff', coins: 2400 },
    { name: 'Алмаз',   pts: 15000, color: '#b26bff', coins: 4000, skin: true },
    { name: 'Неон',    pts: 25000, color: '#ff4fd8', coins: 8000, skin: true, fx: true },
  ];
  const LEAGUE_FEE = [0, 0, 80, 160, 240, 320];   // points paid per ranked game from «Золото» up
  const leagueOf = pts => LEAGUES.reduce((best, l, i) => pts >= l.pts ? i : best, 0);
  // ================= Chaos League: ALL tunable numbers here =================
  // tiers = the main league's six with half the thresholds (7-day seasons); fees ×1,5 from «Золото»; season coins halved
  // tierLevel: player level needed for a tier (Разлом 40, Сингулярность 46); below it points stop under that tier's threshold
  const CHAOS_CFG = { entryLevel: 25, tierLevel: { 4: 40, 5: 46 }, topTier: 4, seasonDays: 7, start: [2026, 10, 23],   // 2.0.0: first season — 23 Nov 2026, a week after the main league
    pts: LEAGUES.map(l => Math.round(l.pts / 2)), fee: [0, 0, 120, 240, 360, 480], coins: LEAGUES.map(l => Math.round(l.coins / 2)),
    achCoins: { first: 300, diamond: 1500, neon: 3000 }, showSec: 2.5, phase2Sec: 2, histMax: 20 };
  const CHAOS_LEN = CHAOS_CFG.seasonDays * 864e5;
  const CHAOS_BASE = new Date(...CHAOS_CFG.start).getTime();
  const CHAOS_EPOCH = (() => { try { const s0 = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s0 && s0.chaosEpoch >= CHAOS_BASE) return s0.chaosEpoch; } catch (e) {} return CHAOS_BASE; })();
  const chaosStarted = Date.now() >= CHAOS_EPOCH;
  const chaosNow = Math.max(1, Math.floor((Date.now() - CHAOS_EPOCH) / CHAOS_LEN) + 1);
  const chaosEnd = id => CHAOS_EPOCH + id * CHAOS_LEN;
  const chaosOf = pts => CHAOS_CFG.pts.reduce((best, p, i) => pts >= p ? i : best, 0);
  // Chaos League tiers: own names, icons and colours, brighter as you climb (thresholds and rules as above)
  const CHAOS_TIERS = [
    { name: 'Искра',         icon: '✦', color: '#9a8fc4' },
    { name: 'Помеха',        icon: '≈', color: '#6f8cff' },
    { name: 'Сбой',          icon: '⌁', color: '#22c8ff' },
    { name: 'Шторм',         icon: 'ϟ', color: '#3dffa2' },
    { name: 'Разлом',        icon: '⟋', color: '#ffb020' },
    { name: 'Сингулярность', icon: '◉', color: '#ff4fd8' },
  ];
  const ctName = i => CHAOS_TIERS[i].name, ctTag = i => `<span style="color:${CHAOS_TIERS[i].color}">${CHAOS_TIERS[i].icon} ${CHAOS_TIERS[i].name}</span>`;
  // chaos season skins: one per season, names cycle with a roman numeral after the first round
  const CHAOS_SKIN_NAMES = ['Глитч', 'Энтропия', 'Квантовый шум', 'Сбой системы', 'Буря пикселей', 'Искажение', 'Перегрев ядра', 'Фрактал', 'Вспышка хаоса', 'Аномалия', 'Белый шум', 'Дикая частота'];
  const ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X'];
  const chaosQ = id => (Math.ceil(id / 13) - 1) % 4 + 1;   // 1.7.0: one Chaos skin per quarter (13 weekly seasons)
  // season rewards by tier: Diamond = season skin + frame; Neon = + title + the next exclusive ability (table order)
  // the 3rd «Сингулярность» reward: the next exclusive ability not owned yet (table order, new quarterly ones included), then the next look
  const chaosNextThird = () => { const a = XA_ABIL.find(x => !save.abil.xa.includes(x.id)); if (a) return { kind: 'abil', a }; const l = allLooks().find(x => !save.abil.looks.includes(x.id)); return l ? { kind: 'look', l } : null; };
  const CHAOS_VET = [{ n: 5, kind: 'deco', id: 'tt_cvet', what: 'титул «Ветеран Хаоса»' }, { n: 10, kind: 'deco', id: 'fr_cvet', what: 'рамка «Пульс бездны»' },
    { n: 25, kind: 'skin', id: 'cv_skin', what: 'эксклюзивный скин «Хаосит»' }, { n: 50, kind: 'badge', id: 'chaosheart', what: 'особый значок «Сердце хаоса»' }];
  function chaosSeasonRewards(id, ti) {
    const out = [];
    if (ti >= CHAOS_CFG.topTier) {
      save.chaosRift = (save.chaosRift || 0) + 1;
      if (save.chaosRift >= 10 && !save.arenas.includes('inferno')) { save.arenas.push('inferno'); out.push('арена «Пекло»'); }
      const k = ensureChaosSkin(id); if (!save.skins.includes(k.id)) { save.skins.push(k.id); out.push(`скин «${k.name}»`); }
      const f = decorById('fr_cq' + chaosQ(id)); if (!save.decor.includes(f.id)) { save.decor.push(f.id); out.push(`рамка «${f.name}»`); }
    }
    if (ti >= 5) {
      const t = decorById('tt_cq' + chaosQ(id)); if (!save.decor.includes(t.id)) { save.decor.push(t.id); out.push(`титул «${t.name}»`); }
      save.chaosTop = (save.chaosTop || 0) + 1;   // personal counter of seasons finished in «Сингулярность»
      const nx = chaosNextThird();
      if (nx && nx.kind === 'abil') { save.abil.xa.push(nx.a.id); save.abil.owned.push(nx.a.id); out.push(`способность «${nx.a.name}»`); }
      else if (nx) { save.abil.looks.push(nx.l.id); out.push(`облик «${nx.l.name}»`); }
      for (const v of CHAOS_VET) if (save.chaosTop >= v.n) {
        const own = v.kind === 'deco' ? save.decor.includes(v.id) : v.kind === 'skin' ? save.skins.includes(v.id) : !!(save.badges || {})[v.id];
        if (own) continue;
        if (v.kind === 'deco') save.decor.push(v.id); else if (v.kind === 'skin') save.skins.push(v.id); else { save.badges = save.badges || {}; save.badges[v.id] = today; }
        out.push(v.what);
      }
    }
    return out;
  }
  // every chaos season has its own frame («Разлом») and title («Сингулярность»), named after the season skin
  function ensureChaosDecor() {}   // 1.7.0: per-season Chaos frames/titles were replaced by quarterly ones (fr_cq / tt_cq)
  // ===== ability looks: purely visual (flash colour and shape, trail colour, sound), 3 per ability =====
  // to add looks for new abilities nothing is needed: every ability in ABILITIES gets 3 automatically
  const LOOK_VARIANTS = [
    { n: 'Рубин', c: '#ff2d55', burst: 'ring', sfx: 'lookA' }, { n: 'Изумруд', c: '#3dff6e', burst: 'spark', sfx: 'lookB' }, { n: 'Сапфир', c: '#4d9bff', burst: 'nova', sfx: 'lookC' },
    { n: 'Золото', c: '#ffd23f', burst: 'spark', sfx: 'lookA' }, { n: 'Аметист', c: '#c46bff', burst: 'nova', sfx: 'lookB' }, { n: 'Лёд', c: '#9fe8ff', burst: 'ring', sfx: 'lookC' },
    { n: 'Пламя', c: '#ff7a1a', burst: 'nova', sfx: 'lookA' }, { n: 'Неон', c: '#ff4fd8', burst: 'ring', sfx: 'lookB' }, { n: 'Плазма', c: '#22e6ff', burst: 'spark', sfx: 'lookC' },
  ];
  // a look must differ from the ability's own colour: variants too close to it are skipped
  const hexRgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const colorDist = (x, y) => { const p = hexRgb(x), q = hexRgb(y); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
  const lookOf = (a, k) => {
    const i = ABILITIES.indexOf(a), start = i * 3 + Math.floor(i / 3), n = LOOK_VARIANTS.length;
    const ok = [...Array(n).keys()].map(j => LOOK_VARIANTS[(start + j) % n]).filter(v => colorDist(v.c, a.color) > 110);
    const v = ok[k % ok.length];
    return { id: `lk_${a.id}_${k}`, ab: a.id, k, name: `${a.name}: ${v.n}`, ...v };
  };
  // reward order: round-robin — the 1st look of every ability, then the 2nd, then the 3rd
  const allLooks = () => [0, 1, 2].flatMap(k => ABILITIES.filter(a => !a.cr).map(a => lookOf(a, k)));
  const lookById = id => allLooks().find(l => l.id === id);
  function ensureChaosSkin(id) { return SKINS.find(k => k.id === 'cs_q' + chaosQ(id)); }
  const QUESTS = [
    { id: 'kills3',  text: 'Съешь 3 капли за раунд',     stat: 'kills',   goal: 3,   coins: 20, xp: 40 },
    { id: 'kills6',  text: 'Съешь 6 капель за раунд',    stat: 'kills',   goal: 6,   coins: 45, xp: 80 },
    { id: 'mass150', text: 'Набери массу 800',           stat: 'maxMass', goal: 800, coins: 25, xp: 50 },
    { id: 'mass350', text: 'Набери массу 2500',          stat: 'maxMass', goal: 2500, coins: 60, xp: 110 },
    { id: 'bosses2', text: 'Съешь 2 боссов за раунд',    stat: 'bosses',  goal: 2,   coins: 90, xp: 180 },
    { id: 'minions5', text: 'Съешь 5 прислужников Матки', stat: 'minions', goal: 5,  coins: 25, xp: 50 },
    { id: 'leader',  text: 'Стань лидером арены',        stat: 'leader',  goal: 1,   coins: 30, xp: 60 },
    { id: 'boss',    text: 'Съешь босса',                stat: 'bosses',  goal: 1,   coins: 60, xp: 120 },
    { id: 'bonus3',  text: 'Подбери 3 бонуса за раунд',  stat: 'bonuses', goal: 3,   coins: 20, xp: 40 },
    { id: 'survive', text: 'Продержись 3 минуты',        stat: 'time',    goal: 180, coins: 30, xp: 60 },
    { id: 'split5',  text: 'Разделись 5 раз за раунд',   stat: 'splits',  goal: 5,   coins: 15, xp: 30 },
    { id: 'crumbs',  text: 'Собери 150 крошек за раунд', stat: 'crumbs',  goal: 150, coins: 20, xp: 40 },
    { id: 'abil5',   text: 'Используй способность 5 раз', stat: 'abilUses', goal: 5, coins: 30, xp: 60 },
    { id: 'dashkill', text: 'Съешь каплю во время рывка', stat: 'dashKills', goal: 1, coins: 40, xp: 80 },
    { id: 'top3',    text: 'Продержись в топ-3 минуту',  stat: 'top3T',   goal: 60,  coins: 35, xp: 70 },
    // from level 10
    { id: 'kills10', text: 'Съешь 10 капель за раунд',   stat: 'kills',   goal: 10,  coins: 70, xp: 140, lvl: 10 },
    { id: 'mass4k',  text: 'Набери массу 5000',          stat: 'maxMass', goal: 5000, coins: 80, xp: 160, lvl: 10 },
    { id: 'combo3',  text: 'Сделай комбо ×3',            stat: 'bestCombo', goal: 3, coins: 50, xp: 100, lvl: 10 },
    { id: 'star1',   text: 'Съешь бота-звезду',          stat: 'starKills', goal: 1, coins: 70, xp: 140, lvl: 10 },
    { id: 'survive5', text: 'Продержись 5 минут',        stat: 'time',    goal: 300, coins: 60, xp: 120, lvl: 10 },
    // from level 25
    { id: 'kills20', text: 'Съешь 20 капель за раунд',   stat: 'kills',   goal: 20,  coins: 130, xp: 260, lvl: 25 },
    { id: 'mass8k',  text: 'Набери массу 10 000',        stat: 'maxMass', goal: 10000, coins: 150, xp: 300, lvl: 25 },
    { id: 'bosses3', text: 'Съешь 3 боссов за раунд',    stat: 'bosses',  goal: 3,   coins: 160, xp: 320, lvl: 25 },
    { id: 'combo6',  text: 'Сделай комбо ×6',            stat: 'bestCombo', goal: 6, coins: 120, xp: 240, lvl: 25 },
    { id: 'crumbs600', text: 'Собери 600 крошек за раунд', stat: 'crumbs', goal: 600, coins: 90, xp: 180, lvl: 25 },
  ];
  // quest rewards grow with your level (×2 at level 31)
  const questMul = () => 1 + (levelInfo(save.xp).level - 1) / 30;
  const qCoins = q => Math.round(q.coins * questMul()), qXp = q => Math.round(q.xp * questMul());
  const BONUS_HINT = { speed: 'ты на 45% быстрее', shield: 'тебя нельзя съесть', double: 'еда даёт вдвое больше массы', magnet: 'крошки притягиваются издалека', fountain: 'вокруг рассыпались крошки, собирай быстрее ботов' };
  const BONUS = {
    speed:  { name: 'Ускорение',    color: '#ffd166', dur: 7 },
    shield: { name: 'Неуязвимость', color: '#5ce1e6', dur: 5 },
    double: { name: 'Двойная еда',  color: '#7ee08a', dur: 8 },
    magnet: { name: 'Магнит',       color: '#ff9ec4', dur: 8 },
    fountain: { name: 'Фонтан',     color: '#4d8dff', dur: 0, instant: true },   // 2.3: no timer — sprays a handful of crumbs around you at once
  };
  const PERSONA = {
    normal:     { tag: '',         sense: 1,   chase: .85, flee: 1,   preyK: 1 },
    coward:     { tag: 'трус',     sense: 1.4, chase: .5,  flee: 1.6, preyK: 2 },
    aggressive: { tag: 'агрессор', sense: 1.5, chase: 1,   flee: .6,  preyK: 1, likesPlayer: true },
    farmer:     { tag: 'фермер',   sense: 1,   chase: 0,   flee: 1.3, preyK: 1 },
    hunter:     { tag: 'охотник',  sense: 1.3, chase: 1,   flee: 1,   preyK: 1 },
    boss:       { tag: 'босс',     sense: 2,   chase: 1,   flee: 0,   preyK: 1 },
  };

