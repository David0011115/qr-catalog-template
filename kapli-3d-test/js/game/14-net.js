  // ================= accounts, cloud saves, chat and ranking (Supabase) =================
  // The local save (SAVE_KEY + persist) stays the only game save. The cloud copy in player_saves is
  // synced on top of it: compare-and-swap on updated_at, so an older device never overwrites a newer save.
  {
    const SB_URL = 'https://kccwtpveezsrgwfnflhf.supabase.co', SB_KEY = 'sb_publishable_oyO2ubBpXo3h1IBB-DPdsQ_gnYaO0Mf';
    const SB_LIB = 'supabase.js';
    const META_KEY = SAVE_KEY + '-cloud', APP_SAVE_VER = 170;
    const RANK_MODES = ['classic', 'timed', 'survival', 'crown', 'rbuild', 'hardcore', 'royale'];
    const NICK_RE = [/^[A-Za-z0-9_]{3,16}$/, /^[А-Яа-яЁё0-9_]{3,16}$/];
    let sb = null, sess = null, canPush = false, pushing = false, pushTimer = null, retryMs = 0, sync = 'guest', pending = null, recoverPending = false, splashOn = true, privacyPending = false;
    async function checkPrivacyConsent() {
      if (!sess) return false;
      const { data, error } = await withTimeout(sb.rpc('kapli_has_privacy_consent'), 8000);
      if (error) throw error;
      privacyPending = data !== true;
      if (privacyPending) canPush = false;
      return !privacyPending;
    }
    async function acceptPrivacyConsent() {
      if (!sess) throw new Error('Сначала войди в аккаунт');
      const { error } = await withTimeout(sb.rpc('kapli_accept_privacy_policy'), 8000);
      if (error) throw error;
      privacyPending = false;
    }
    let meta = {}; try { meta = JSON.parse(localStorage.getItem(META_KEY)) || {}; } catch (e) {}
    meta.recSent = meta.recSent || {};
    const saveMeta = () => { try { localStorage.setItem(META_KEY, JSON.stringify(meta)); } catch (e) {} };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);
    const hashStr = t => { let h = 0x811c9dc5; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16) + ':' + t.length; };
    const localJson = () => { try { return localStorage.getItem(SAVE_KEY) || ''; } catch (e) { return ''; } };
    const summary = j => { try { const o = typeof j === 'string' ? JSON.parse(j) : j; return { lvl: levelInfo(o.xp || 0).level, coins: o.coins || 0, rounds: (o.totals && o.totals.rounds) || 0 }; } catch (e) { return { lvl: 1, coins: 0, rounds: 0 }; } };
    const hasProgress = j => { const m = summary(j); return m.rounds > 0 || m.coins > 0 || m.lvl > 1; };
    const progFp = j => { try { const o = typeof j === 'string' ? JSON.parse(j) : j, T = o.totals || {}, L = a => (a || []).length, sh = o.shards ? Object.values(o.shards).reduce((a, b) => a + b, 0) : 0;
      return [o.xp || 0, o.coins || 0, T.rounds || 0, T.kills || 0, L(o.skins), L(o.fxOwned), L(o.pets), L(o.decor), L(o.ach), L(o.pbg), (o.season || {}).pts || 0, (o.chaos || {}).pts || 0, o.chests || 0, L(o.special), sh, (o.abil && L(o.abil.owned)) || 0, o.hc100k ? 1 : 0, o.badges && o.badges.hc100k || 0].join('|'); } catch (e) { return ''; } };
    const sumTxt = m => `уровень ${m.lvl}, ${m.coins.toLocaleString('ru-RU')} ◆, раундов: ${m.rounds}`;
    const netErr = e => { const t = String((e && (e.message || e.error_description)) || e || ''); return /fetch|network|timeout|Failed|Load failed/i.test(t); };

    function loadLib() {
      if (window.supabase && window.supabase.createClient) return Promise.resolve();
      if (loadLib.p) return loadLib.p;
      loadLib.p = new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = SB_LIB; sc.async = true; sc.onload = () => window.supabase ? res() : rej(new Error('lib')); sc.onerror = () => { loadLib.p = null; rej(new Error('lib')); }; document.head.appendChild(sc); });
      return loadLib.p;
    }
    async function ensureClient() {
      if (sb) return sb;
      await withTimeout(loadLib(), 9000);
      sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'kapli3dtest-auth' } });
      sb.auth.onAuthStateChange((ev, session) => {
        if (ev === 'PASSWORD_RECOVERY') { sess = session; recoverPending = true; if (!splashOn) openAccount('recover'); }
        else if (ev === 'SIGNED_OUT') { sess = null; setUser(null); }
        else if (session) sess = session;
      });
      return sb;
    }
    Net.client = ensureClient;   // the room for two (14b-duo.js) talks to the same server
    function setUser(user, nick, publicId) {
      Net.uid = user ? user.id : null; Net.nick = user ? (nick || meta.nick || null) : null;
      Net.shortId = user && publicId != null ? String(publicId).padStart(6, '0') : '';
      Net.email = user ? user.email : '';
      if (user) { setTimeout(() => giftCheck(true), 500); setTimeout(() => syncBadges(), 2500); walletSoon(4000); }
      if (!user) { canPush = false; setSync('guest'); frStop(); } else { if (!privacyPending) setTimeout(() => pushShowcase(), 3000); if (!privacyPending && Net.uid !== frStart.uid) frStart(); }
      frStart.uid = Net.uid;
      renderChip();
    }
    async function loadProfile() {
      const { data } = await withTimeout(sb.from('player_profiles').select('nickname, public_id').eq('user_id', sess.user.id).maybeSingle(), 8000);
      const nick = data ? data.nickname : (sess.user.user_metadata && sess.user.user_metadata.nickname) || null;
      if (nick) { meta.nick = nick; saveMeta(); }
      setUser(sess.user, nick, data && data.public_id);
    }

    // ---------- sync status shown in the menu chip and the account window ----------
    const SYNC_TXT = { guest: ['', 'Профиль · войти или создать аккаунт'], ok: ['ok', '☁ Сохранено в облаке'], pending: ['', '☁ Изменения скоро отправятся'], busy: ['', '☁ Синхронизация…'],
      err: ['warn', '⚠ Нет связи — прогресс сохранён на устройстве'], wait: ['warn', '⚠ Нужно выбрать сохранение'], newer: ['err', '⚠ Сохранение из новой версии — обнови игру'], off: ['warn', 'Офлайн — прогресс на устройстве'] };
    function setSync(st) { sync = st; renderChip(); }
    function renderChip() {
      const t = SYNC_TXT[sess ? sync : (sync === 'off' ? 'off' : 'guest')] || SYNC_TXT.guest;
      $('acctName').textContent = sess ? (Net.nick || 'Аккаунт') : 'Гость';
      $('acctSync').textContent = t[1]; $('acctSync').className = t[0];
      if (!$('accountCard').hidden && !$('acctUser').hidden) $('auSync').textContent = t[1];
    }

    // ---------- cloud save ----------
    function linkTo(uid, cloudAt, hash) { meta.uid = uid; meta.cloudAt = cloudAt; meta.hash = hash || null; meta.fp = hash ? progFp(localJson()) : null; saveMeta(); }
    function backupLocal(tag) { try { localStorage.setItem(SAVE_KEY + '-backup', JSON.stringify({ at: new Date().toISOString(), tag, save: localJson() })); } catch (e) {} }
    function applyCloud(row) {
      backupLocal('before-cloud');
      const json = JSON.stringify(row.save_data);
      try { localStorage.setItem(SAVE_KEY, json); } catch (e) { return; }
      linkTo(sess.user.id, row.updated_at, hashStr(json));
      try { sessionStorage.setItem('kapliFast', '1'); } catch (e) {}
      location.reload();
    }
    async function fetchCloud() {
      const { data, error } = await withTimeout(sb.from('player_saves').select('save_data, updated_at, save_version').eq('user_id', sess.user.id).maybeSingle(), 10000);
      if (error) throw error;
      return data;
    }
    // decides what to do with the local and the cloud save; never merges and never overwrites silently
    async function resolveCloud() {
      if (privacyPending) { canPush = false; return 'warn'; }
      canPush = false; pending = null;
      const uid = sess.user.id, row = await fetchCloud(), lj = localJson(), lh = hashStr(lj);
      // «dirty» = this device earned something since the last sync; changes the game makes by itself on start do not count (they caused false «which save?» questions)
      const mine = meta.uid === uid, dirty = mine && lh !== meta.hash && (!meta.fp || progFp(lj) !== meta.fp);
      if (!row) {
        if (mine || !hasProgress(lj)) { linkTo(uid, null, null); canPush = true; await pushNow(); return 'ok'; }
        pending = { kind: 'transfer' }; setSync('wait'); return 'choice';
      }
      if ((row.save_version || 0) > APP_SAVE_VER) { setSync('newer'); return 'warn'; }
      if (mine && row.updated_at === meta.cloudAt) { canPush = true; if (dirty) schedulePush(1500); else setSync('ok'); return 'ok'; }
      if (hashStr(JSON.stringify(row.save_data)) === lh) { linkTo(uid, row.updated_at, lh); canPush = true; setSync('ok'); return 'ok'; }
      if ((mine && !dirty) || !hasProgress(lj)) { applyCloud(row); return 'reload'; }
      pending = { kind: 'conflict', row }; setSync('wait'); return 'choice';
    }
    function showChoice() {
      if (!pending) return;
      const loc = summary(localJson());
      if (pending.kind === 'transfer') {
        tutModal('Перенести прогресс в аккаунт?', `<p>В аккаунте <b>${escHtml(Net.nick || '')}</b> ещё нет сохранения.</p><p>На этом устройстве: <b>${sumTxt(loc)}</b>.</p><p>Перенести этот прогресс в аккаунт? Тогда он будет доступен и на других устройствах.</p>`,
          [['syncTransfer', 'Перенести в аккаунт', 'btn'], ['syncFresh', 'Начать аккаунт с нуля', 'btn ghost']]);
      } else {
        const cl = summary(pending.row.save_data), when = new Date(pending.row.updated_at).toLocaleString('ru-RU', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
        tutModal('Какой прогресс оставить?', `<p>В аккаунте уже есть сохранение (${when}): <b>${sumTxt(cl)}</b>.</p><p>На этом устройстве: <b>${sumTxt(loc)}</b>.</p><p>Сохранения не объединяются. Тот прогресс, который ты не выберешь, останется копией на этом устройстве.</p>`,
          [['syncUseCloud', 'Прогресс аккаунта', 'btn'], ['syncUseLocal', 'Прогресс этого устройства', 'btn ghost']]);
      }
    }
    $('tutModal').addEventListener('click', async e => {
      const id = e.target.id; if (!/^sync/.test(id) || !pending) return;
      const p = pending; $('tutModal').hidden = true;
      if (id === 'syncTransfer') { linkTo(sess.user.id, null, null); pending = null; canPush = true; await pushNow(); syncBests(); toast('Прогресс перенесён в аккаунт'); }
      else if (id === 'syncFresh') {
        backupLocal('guest-before-fresh-account');
        const base = SEASON_BASE, k = Math.max(0, Math.floor((Date.now() - base) / SEASON_LEN)), kc = Math.max(0, Math.floor((Date.now() - CHAOS_BASE) / CHAOS_LEN));
        try { localStorage.setItem(SAVE_KEY, JSON.stringify({ settings: save.settings, seasonEpoch: base + k * SEASON_LEN, chaosEpoch: CHAOS_BASE + kc * CHAOS_LEN, tutSeen: true, tourSeen: true, newsSeen: save.newsSeen })); } catch (er) {}
        linkTo(sess.user.id, null, null); try { sessionStorage.setItem('kapliFast', '1'); } catch (er) {} location.reload();
      }
      else if (id === 'syncUseCloud') applyCloud(p.row);
      else if (id === 'syncUseLocal') {
        try { localStorage.setItem(SAVE_KEY + '-cloud-backup', JSON.stringify({ at: p.row.updated_at, save: p.row.save_data })); } catch (er) {}
        linkTo(sess.user.id, p.row.updated_at, null); pending = null; canPush = true; await pushNow(); syncBests(); toast('Прогресс устройства сохранён в аккаунт');
      }
    });
    function schedulePush(ms) { clearTimeout(pushTimer); pushTimer = setTimeout(pushNow, ms); }
    async function pushNow() {
      clearTimeout(pushTimer);
      if (!sb || !sess || privacyPending || !canPush || pushing) return;
      const json = localJson(); if (!json) return;
      const h = hashStr(json); if (h === meta.hash) { setSync('ok'); return; }
      pushing = true; setSync('busy');
      try {
        const body = { save_data: JSON.parse(json), save_version: APP_SAVE_VER, updated_at: new Date().toISOString() };
        const q = meta.cloudAt
          ? sb.from('player_saves').update(body).eq('user_id', sess.user.id).eq('updated_at', meta.cloudAt).select('updated_at')
          : sb.from('player_saves').insert({ user_id: sess.user.id, ...body }).select('updated_at');
        const { data, error } = await withTimeout(q, 12000);
        if (error && error.code !== '23505') throw error;
        if (error || !data || !data.length) {   // the cloud save changed on another device: ask instead of overwriting
          pushing = false; const r = await resolveCloud(); if (r === 'choice' && !splashOn) showChoice(); return;
        }
        meta.cloudAt = data[0].updated_at; meta.hash = h; meta.fp = progFp(json); saveMeta(); retryMs = 0; setSync('ok');
      } catch (e) {
        setSync('err'); retryMs = Math.min(300000, retryMs ? retryMs * 2 : 20000); schedulePush(retryMs);
      } finally { pushing = false; }
      if (hashStr(localJson()) !== meta.hash && canPush && sync === 'ok') schedulePush(4000);
    }
    persistHook = () => { if (sess && canPush) { if (sync !== 'busy') setSync('pending'); schedulePush(8000); } };
    document.addEventListener('visibilitychange', () => { if (document.hidden && sess && canPush) pushNow(); else if (!document.hidden) recheckCloud(); });
    let recheckAt = 0;
    async function recheckCloud() {
      if (!sess || !canPush || pushing || running || splashOn || Date.now() - recheckAt < 20000) return;
      recheckAt = Date.now();
      try { const row = await fetchCloud(); if (!row || row.updated_at === meta.cloudAt) return;
        const r = await resolveCloud(); if (r === 'choice') showChoice(); } catch (e) { KapliErr.log(e, 'cloud-recheck'); }
    }
    addEventListener('online', async () => { if (!sess) return; if (!canPush && !pending) { try { const r = await resolveCloud(); if (r === 'choice') showChoice(); } catch (e) { setSync('err'); } } else pushNow(); });
    addEventListener('offline', () => { if (sess) setSync('err'); });

    // ---------- records ----------
    async function submitRecord(m, score) {
      if (!sb || !sess || privacyPending || !RANK_MODES.includes(m) || !(score > 0)) return false;
      const { error } = await sb.rpc('kapli_submit_record', { p_mode: m, p_score: Math.round(score) }).then(r => r, e => ({ error: e }));
      if (!error) { meta.recSent[m] = score; saveMeta(); return true; }
      return false;
    }
    // Duo online ratings are submitted only by the authoritative Cloudflare room server.
    async function syncBests() { for (const m of RANK_MODES) { const v = save.bests[m] || 0; if (v > 0 && meta.recSent[m] !== v) await submitRecord(m, v); } }

    // ---------- launch screen ----------
    const STEPS = [['net', 'Подключение'], ['acct', 'Аккаунт'], ['save', 'Сохранение'], ['arena', 'Арена']];
    $('spSteps').innerHTML = STEPS.map(([k, t]) => `<li data-st="${k}"><i></i><span>${t}</span></li>`).join('');
    function step(k, st, msg) { const li = $('spSteps').querySelector(`[data-st="${k}"]`); if (li) li.className = st; if (msg) $('spStatus').textContent = msg; }
    async function prepare() {
      let result = null;
      step('net', 'run', 'Подключение…');
      if (navigator.onLine === false) { step('net', 'warn'); step('acct', 'skip'); step('save', 'ok', 'Нет интернета — играем с сохранением на устройстве'); setSync('off'); }
      else {
        try {
          await ensureClient(); step('net', 'ok');
          step('acct', 'run', 'Проверка аккаунта…');
          const { data } = await withTimeout(sb.auth.getSession(), 8000); sess = data.session;
          if (sess) {
            privacyPending = true; canPush = false;
            await loadProfile().catch(() => setUser(sess.user, meta.nick)); step('acct', 'ok');
            let consentOk = false;
            try { consentOk = await checkPrivacyConsent(); } catch (e) { privacyPending = true; canPush = false; }
            if (consentOk) {
              step('save', 'run', 'Загрузка сохранения…');
              try { result = await resolveCloud(); step('save', result === 'warn' ? 'warn' : 'ok'); if (result === 'ok') syncBests(); }
              catch (e) { step('save', 'warn', 'Облако не ответило — прогресс сохранён на устройстве'); setSync('err'); }
            } else { step('save', 'warn', 'Нужно подтвердить актуальную Политику конфиденциальности'); }
          } else { step('acct', 'skip'); step('save', 'ok', 'Гость — сохранение на устройстве'); }
        } catch (e) { step('net', 'warn'); step('acct', 'skip'); step('save', 'ok', 'Сервер недоступен — играем с сохранением на устройстве'); setSync('off'); }
      }
      if (result === 'reload') return result;
      step('arena', 'run', 'Подготовка арены…');
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      step('arena', 'ok', result === 'choice' ? 'Нужно выбрать сохранение' : 'Готово');
      return result;
    }
    async function boot() {
      let fast = false; try { fast = sessionStorage.getItem('kapliFast') === '1'; sessionStorage.removeItem('kapliFast'); } catch (e) {}
      const sp = $('splash'), logo = $('spLogo'), title = $('spTitle');
      let skip = false, wake = null; const nap = ms => new Promise(r => { wake = r; setTimeout(r, ms); });
      $('spSkip').addEventListener('click', () => { skip = true; if (wake) wake(); });
      const prep = prepare();
      if (!fast) {
        setTimeout(() => { $('spSkip').hidden = false; }, 900);
        requestAnimationFrame(() => logo.classList.add('on'));
        await nap(2600); logo.classList.add('off'); if (!skip) await nap(700);
      }
      logo.hidden = true; $('spSkip').hidden = true; title.classList.add('on'); title.setAttribute('aria-hidden', 'false');
      const r = await Promise.race([prep, sleep(30000).then(() => 'slow')]);
      if (r === 'reload') return;   // the page reloads with the cloud save
      await sleep(fast ? 150 : 600);
      sp.classList.add('out'); splashOn = false;
      setTimeout(() => { sp.hidden = true; }, 650);
      if (pending) showChoice(); else if (recoverPending) openAccount('recover'); else if (privacyPending) openAccount('privacy');
      $('startBtn').focus();
    }

    // ---------- account window ----------
    let av = 'login', busy = false;
    const msg = (t, ok) => { $('acctMsg').textContent = t || ''; $('acctMsg').className = 'acct-msg' + (t ? (ok ? ' ok' : ' err') : ''); };
    function setView(v) {
      av = v; msg('');
      document.querySelectorAll('[data-av]').forEach(b => b.setAttribute('aria-checked', b.dataset.av === (v === 'forgot' ? 'login' : v)));
      $('fNickWrap').hidden = v !== 'reg'; $('fPassWrap').hidden = v === 'forgot'; $('fPassHint').hidden = v !== 'reg';
      $('privacyConsentWrap').hidden = v !== 'reg'; $('privacyConsent').required = v === 'reg';
      if (v !== 'reg') $('privacyConsent').checked = false;
      $('fPass').autocomplete = v === 'reg' ? 'new-password' : 'current-password';
      $('acctSubmit').textContent = v === 'reg' ? 'Создать аккаунт' : v === 'forgot' ? 'Отправить письмо для сброса' : 'Войти';
      $('acctForgot').textContent = v === 'forgot' ? '← Назад ко входу' : 'Забыли пароль?'; $('acctForgot').hidden = v === 'reg';
    }
    let acctRet = 'menuCard';
    function openAccount(view, ret) {
      if (ret) acctRet = ret; else if ($('accountCard').hidden) acctRet = 'menuCard';
      showCard('accountCard');
      const rec = view === 'recover' && sess, privacy = view === 'privacy' && sess;
      $('acctPrivacy').hidden = !privacy; $('acctRecover').hidden = !rec; $('acctGuest').hidden = !!(sess || rec || privacy); $('acctUser').hidden = !sess || rec || privacy;
      if (sess && !rec) { $('auNick').textContent = Net.nick || 'Без ника'; $('auId').textContent = Net.shortId; $('auEmail').textContent = Net.email || ''; renderChip(); $('auDelConfirm').hidden = true; $('auDelete').hidden = false; }
      if (!sess) setView(view === 'reg' ? 'reg' : 'login');
      if (privacy) $('privacyExistingAccept').focus(); else if (rec) { recoverPending = false; $('recPass').focus(); } else $('acctBack').focus();
    }
    const ERR = [
      [/invalid login credentials|invalid_credentials/i, 'Неверный Email или пароль'],
      [/already registered|user_already_exists|already been registered/i, 'Этот Email уже зарегистрирован — попробуй войти'],
      [/password should be at least|weak_password|weak password/i, 'Пароль слишком простой: не короче 6 символов'],
      [/unable to validate email|invalid email|email_address_invalid|invalid format/i, 'Неверный формат Email'],
      [/email not confirmed|email_not_confirmed/i, 'Email не подтверждён — открой ссылку из письма'],
      [/database error saving new user|unexpected_failure/i, 'Ник недопустим или уже занят — выбери другой'],
      [/rate limit|over_email_send_rate_limit|too many/i, 'Слишком много попыток — подожди немного'],
      [/same_password|should be different/i, 'Новый пароль должен отличаться от старого'],
    ];
    const errText = e => { const t = String((e && (e.code || '') + ' ' + (e.message || '')) || e); if (netErr(e)) return 'Нет связи с сервером — проверь интернет'; const f = ERR.find(([re]) => re.test(t)); return f ? f[1] : 'Не получилось: ' + (e && e.message || 'ошибка'); };
    const NICK_ST = { length: 'Ник — от 3 до 16 символов', format: 'Только буквы одного алфавита (латиница или кириллица), цифры и «_»', reserved: 'Такой ник зарезервирован — выбери другой', forbidden: 'Ник содержит недопустимые слова', taken: 'Этот ник уже занят' };
    // quick check in the browser (the server repeats it with the full word list): look-alike letters and digits are folded first
    const NICK_FOLD = { 'а': 'a', 'в': 'b', 'е': 'e', 'ё': 'e', 'к': 'k', 'м': 'm', 'н': 'h', 'о': 'o', 'р': 'p', 'с': 'c', 'т': 't', 'у': 'y', 'х': 'x', 'и': 'i', 'й': 'i', 'u': 'i', '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', 'l': 'i', '_': '' };
    const NICK_RESERVED = ['admin', 'админ', 'moderator', 'модератор', 'support', 'поддержка', 'саппорт', 'system', 'система', 'developer', 'разработчик', 'official', 'официальн', 'hugin', 'хугин'];
    const nickFold = n => [...n.toLowerCase()].map(ch => NICK_FOLD[ch] ?? ch).join('').replace(/(.)\1+/g, '$1');
    function nickLocal(n) {
      if (n.length < 3 || n.length > 16) return 'length';
      if (!NICK_RE.some(re => re.test(n))) return 'format';
      const f = nickFold(n); return NICK_RESERVED.some(w => f.includes(nickFold(w))) || /^(mod|dev|root|gm|bot|owner)$/.test(f) ? 'reserved' : null;
    }
    $('fNick').addEventListener('input', () => { const n = $('fNick').value.trim(), st = n ? nickLocal(n) : null; $('fNickHint').textContent = st ? NICK_ST[st] : '3–16 символов: латиница или кириллица (не вместе), цифры и «_». Изменить ник потом нельзя.'; $('fNickHint').className = st ? 'err' : ''; });
    document.querySelectorAll('[data-av]').forEach(b => b.addEventListener('click', () => setView(b.dataset.av)));
    $('acctForgot').addEventListener('click', () => setView(av === 'forgot' ? 'login' : 'forgot'));
    async function afterSignIn() {
      privacyPending = true; canPush = false;
      await loadProfile().catch(() => setUser(sess.user, meta.nick));
      try {
        if (!(await checkPrivacyConsent())) { openAccount('privacy'); renderAll(); return; }
      } catch (e) { privacyPending = true; canPush = false; openAccount('privacy'); $('privacyExistingMsg').textContent = 'Не удалось проверить согласие. Проверь интернет и попробуй ещё раз.'; renderAll(); return; }
      openAccount();
      try { const r = await resolveCloud(); if (r === 'choice') showChoice(); else if (r === 'ok') syncBests(); }
      catch (e) { setSync('err'); toast('Облако не ответило — прогресс сохранён на устройстве'); }
      renderAll();
    }
    $('acctForm').addEventListener('submit', async e => {
      e.preventDefault(); if (busy) return;
      if (av === 'reg' && !$('privacyConsent').checked) return msg('Для регистрации необходимо принять Политику конфиденциальности');
      const email = $('fEmail').value.trim(), pass = $('fPass').value, nick = $('fNick').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return msg('Введи корректный Email');
      if (av !== 'forgot' && pass.length < 6) return msg('Пароль — не короче 6 символов');
      if (av === 'reg') { const st = nickLocal(nick); if (st) return msg(NICK_ST[st]); }
      busy = true; $('acctSubmit').disabled = true; msg('Подожди…', true);
      try {
        await ensureClient();
        if (av === 'forgot') {
          const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.href.split('#')[0] });
          if (error) throw error; msg('Письмо со ссылкой для нового пароля отправлено, если такой Email зарегистрирован', true);
        } else if (av === 'reg') {
          const chk = await sb.rpc('kapli_nick_status', { p_nick: nick });
          if (!chk.error && chk.data !== 'ok') throw { message: NICK_ST[chk.data] || 'Ник недопустим', nick: true };
          const { data, error } = await sb.auth.signUp({ email, password: pass, options: { data: {
            nickname: nick,
            privacy_policy_accepted: true,
            privacy_policy_version: '1.0',
            privacy_policy_accepted_at: new Date().toISOString()
          } } });
          if (error) throw error;
          if (data.user && data.user.identities && !data.user.identities.length) throw { message: 'already registered' };
          if (!data.session) { msg('Аккаунт создан. Подтверди Email по ссылке из письма и войди', true); setView('login'); }
          else { sess = data.session; meta.nick = nick; saveMeta(); $('fPass').value = ''; await acceptPrivacyConsent(); await afterSignIn(); toast(`Аккаунт «${nick}» создан`); }
        } else {
          const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
          if (error) throw error;
          sess = data.session; $('fPass').value = ''; await afterSignIn(); toast(`Вход выполнен: ${Net.nick || email}`);
        }
      } catch (er) { msg(er && er.nick ? er.message : errText(er)); }
      finally { busy = false; $('acctSubmit').disabled = false; }
    });
    $('privacyExistingAccept').addEventListener('click', async () => {
      const check = $('privacyExistingConsent'), out = $('privacyExistingMsg'), btn = $('privacyExistingAccept');
      if (!check.checked) { out.textContent = 'Поставь отметку о согласии, чтобы продолжить.'; out.className = 'acct-msg err'; return; }
      btn.disabled = true; out.textContent = 'Сохраняем подтверждение…'; out.className = 'acct-msg';
      try {
        await acceptPrivacyConsent();
        out.textContent = 'Согласие сохранено.'; out.className = 'acct-msg ok';
        await loadProfile().catch(() => setUser(sess.user, meta.nick));
        openAccount();
        try { const r = await resolveCloud(); if (r === 'choice') showChoice(); else if (r === 'ok') syncBests(); }
        catch (e) { setSync('err'); toast('Облако не ответило — прогресс остался на устройстве'); }
        renderAll(); toast('Политика конфиденциальности принята');
      } catch (e) { out.textContent = errText(e); out.className = 'acct-msg err'; }
      finally { btn.disabled = false; }
    });
    $('privacyExistingLogout').addEventListener('click', async () => {
      try { await sb.auth.signOut(); } catch (e) { try { await sb.auth.signOut({ scope: 'local' }); } catch (er) {} }
      sess = null; privacyPending = false; canPush = false; meta = { recSent: {} }; saveMeta(); setUser(null); openAccount(); renderAll();
    });
    $('recForm').addEventListener('submit', async e => {
      e.preventDefault(); if (busy) return; const p = $('recPass').value;
      if (p.length < 6) { $('recMsg').textContent = 'Пароль — не короче 6 символов'; $('recMsg').className = 'acct-msg err'; return; }
      busy = true; $('recSubmit').disabled = true;
      try { const { error } = await sb.auth.updateUser({ password: p }); if (error) throw error; $('recPass').value = ''; toast('Пароль изменён'); openAccount(); }
      catch (er) { $('recMsg').textContent = errText(er); $('recMsg').className = 'acct-msg err'; }
      finally { busy = false; $('recSubmit').disabled = false; }
    });
    $('auSyncNow').addEventListener('click', async () => {
      if (!sess) return;
      try { if (!canPush) { const r = await resolveCloud(); if (r === 'choice') return showChoice(); } else await pushNow(); toast(sync === 'ok' ? 'Прогресс сохранён в облаке' : 'Не удалось — попробуем ещё раз позже'); }
      catch (e) { setSync('err'); toast('Нет связи с сервером'); }
    });
    $('auCopy').addEventListener('click', () => { try { navigator.clipboard.writeText(Net.shortId); toast('ID скопирован'); } catch (e) {} });
    $('auLogout').addEventListener('click', async () => {
      if (sess && canPush) await pushNow();
      try { await sb.auth.signOut(); } catch (e) { try { await sb.auth.signOut({ scope: 'local' }); } catch (er) {} }
      sess = null; meta = { recSent: {} }; saveMeta(); setUser(null); openAccount(); renderAll(); toast('Ты вышел из аккаунта. Прогресс остался на устройстве');
    });
    $('auDelete').addEventListener('click', () => { $('auDelConfirm').hidden = false; $('auDelete').hidden = true; $('auDelNo').focus(); });
    $('auDelNo').addEventListener('click', () => { $('auDelConfirm').hidden = true; $('auDelete').hidden = false; });
    $('auDelYes').addEventListener('click', async () => {
      try { const { error } = await sb.rpc('kapli_delete_my_account'); if (error) throw error; }
      catch (e) { toast(netErr(e) ? 'Нет связи с сервером' : 'Удаление ещё не включено на сервере'); return; }
      try { await sb.auth.signOut({ scope: 'local' }); } catch (e) {}
      sess = null; meta = { recSent: {} }; saveMeta(); setUser(null); openAccount(); renderAll(); toast('Аккаунт удалён');
    });
    $('acctBack').addEventListener('click', () => { const r = acctRet; acctRet = 'menuCard';
      if (r === 'profileCard') { showCard('profileCard'); renderProfile(); $('profAcct').focus(); } else { showCard('menuCard'); $('acctChip').focus(); } });

    // ---------- profile showcase (others see it in the ranking and the chat) ----------
    const scCache = new Map(); let scTimer = null, scLast = '';
    // ---- test build only: a pretend friend served locally, so the friend screens and a friend's card can be seen without the server ----
    const TN = TEST_MODE ? (() => {
      const now = Date.now(), iso = m => new Date(now - m * 60000).toISOString();
      const fr = { nickname: 'Спектр', public_id: 104729, status: 'friend', online: true, last_seen: iso(0), unread: 2, gift_sent: false };
      const card = { bg: 'bg_ps_gal', frame: 'fr_ps_orbit', title: 'tt_ps_lg', badge: 'legend', skin: 'lg_supernova', lvl: 50, ps: { s: 25, n: 12 },
        shelf: [['ln_boss', 3], ['ln_league', 3], ['ln_combo', 2]], league: 5, chaos: 4, wins: 1240, best: 3812, ach: 14 };
      { let r = 5, g = ''; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280;
        for (let i = 0; i < 30; i++) { const x = rnd(); g += i >= 16 ? String(2 + (i % 3)) : x < .3 ? '0' : x < .6 ? '1' : x < .82 ? '2' : x < .95 ? '3' : '4'; }
        const t = new Date(now), tk = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
        card.act = { g, t: tk, s: 14, b: 37 }; }
      card.rc = { id: 4, n: 'Неоновый прилив', r: 203, t: 52800, m: 6120, w: 77, c: 26300, x: 30100, ch: { legendary: 1, epic: 3, rare: 4, common: 2 }, fav: ['crown', 94], lg: 5, pts: 27400 };
      const dms = [[1, false, 'Привет! Видел мой новый фон «Галактика»?', 64], [2, true, 'Ага, круто! Это за ✦25?', 61], [3, false, 'Да, вторая ступень престижа. Сыграем в «Захват короны»?', 5], [4, false, 'Я в игре 😉', 2]]
        .map(([id, mine, body, ago]) => ({ id, mine, body, created_at: iso(ago), read_at: mine ? iso(ago - 1) : null }));
      return { fr, card, dms, list: [fr], blocks: [] };
    })() : null;
    if (TN) scCache.set(TN.fr.nickname, TN.card);
    const tnOn = () => TEST_MODE && !sess;
    function tnRpc(fn, a) {
      const f = TN.fr, last = TN.dms[TN.dms.length - 1];
      switch (fn) {
        case 'kapli_friends': return TN.list.map(x => ({ ...x }));
        case 'kapli_blocks': return TN.blocks.map(x => ({ ...x }));
        case 'kapli_dm_threads': return TN.list.filter(x => x.status === 'friend').map(x => ({ nickname: x.nickname, public_id: x.public_id, is_friend: true, online: x.online, last_seen: x.last_seen, last_body: last.body, last_mine: last.mine, last_at: last.created_at, unread: x.unread }));
        case 'kapli_dm_history': return TN.dms.filter(m => !a.p_after || m.id > a.p_after).slice().reverse();
        case 'kapli_dm_read': f.unread = 0; return null;
        case 'kapli_dm_send': TN.dms.push({ id: TN.dms.length + 1, mine: true, body: a.p_body, created_at: new Date().toISOString(), read_at: null }); return 'sent';
        case 'kapli_gift_send': if (f.gift_sent) return 'already'; f.gift_sent = true; return 'sent';
        case 'kapli_ping': return { requests: 0, unread: f.unread, gifts: 0 };
        case 'kapli_gifts_claim': return [];
        case 'kapli_friend_remove': TN.list = TN.list.filter(x => x.nickname !== a.p_nick); return 'removed';
        case 'kapli_friend_request': if (TN.list.some(x => x.nickname.toLowerCase() === String(a.p_query).toLowerCase())) return 'already'; TN.list = [...TN.list, f]; f.status = 'friend'; return 'accepted';
        case 'kapli_block': return a.p_on ? 'blocked' : 'unblocked';
        default: return null;
      }
    }
    async function getShowcases(nicks) {
      const need = [...new Set(nicks)].filter(n => n && !scCache.has(n) && n !== Net.nick).slice(0, 50);
      if (need.length) {
        try { await ensureClient(); const { data, error } = await withTimeout(sb.rpc('kapli_showcases', { p_nicks: need }), 9000); if (error) throw error;
          need.forEach(n => scCache.set(n, null)); (data || []).forEach(r => scCache.set(r.nickname, r.data)); }
        catch (e) { need.forEach(n => scCache.set(n, null)); }
      }
      if (Net.nick) scCache.set(Net.nick, myShowcase());
      return scCache;
    }
    function pushShowcase() {
      if (!sess || privacyPending) return; clearTimeout(scTimer);
      scTimer = setTimeout(async () => { const d = myShowcase(); if (d.bgf) d.bg = pbgKey(d.bg, d.bgf); delete d.bgf; const js = JSON.stringify(d); if (js === scLast) return;
        try { await ensureClient(); const { error } = await withTimeout(sb.rpc('kapli_set_showcase', { p: d }), 9000); if (!error) scLast = js; } catch (e) {} }, 1500);
    }
    // a small avatar + title next to a nickname; tapping opens the player's card
    const whoHTML = (nick, d) => `<span class="rk-av">${d ? pcAvatar(d, 34) : ''}</span><span class="rk-n">${d && d.league !== undefined ? rankEmblem(d.league, 18, { still: true }) : ''}${escHtml(nick)}${d && d.ps && (d.ps.n || d.ps.s >= 10) ? `<small class="ps-nick${d.ps.n ? ' nova' : ''}">${psLabel(d.ps)}</small>` : ''}${d && d.title && decorById(d.title) ? `<small class="rk-t">${titleTag(d.title)}</small>` : ''}</span>`;
    async function decorateWho(root) {
      const els = [...root.querySelectorAll('[data-who]')]; if (!els.length) return;
      const m = await getShowcases(els.map(e => e.dataset.who));
      els.forEach(e => { if (!e.isConnected) return; const d = m.get(e.dataset.who); if (d && !e.dataset.done) { e.dataset.done = 1; e.innerHTML = whoHTML(e.dataset.who, d); } });
    }

    // ---------- chat ----------
    let chatCh = null, chatPoll = null, chatLast = 0; const chatIds = new Set();
    const hhmm = t => new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    // chat emotes: glossy drops (KapliEmo); a fresh message plays its emote once, older ones stay still; tap replays
    const EMO_RE = /:[a-z]+:/g;
    function chatBodyHtml(body, play) {
      return escHtml(String(body || '')).replace(EMO_RE, t => KapliEmo.E[t] ? `<span class="chat-inline-emoji ${play ? 'emo-play' : ''}" data-emote="${t}" role="img" aria-label="${KapliEmo.E[t].n}">${KapliEmo.svg(t)}</span>` : t);
    }
    const emoOnly = body => { const t = String(body || '').match(EMO_RE) || []; return t.length > 0 && t.length <= 6 && t.every(x => KapliEmo.E[x]) && !String(body).replace(EMO_RE, '').trim(); };
    const emoFresh = m => Date.now() - new Date(m.created_at).getTime() < 30000;
    const emoReplay = el => { el.classList.remove('emo-play'); void el.offsetWidth; el.classList.add('emo-play'); };
    const EMO_RECENT = 'kapli3d-emo-recent';
    // gift emotes (lock: true) can be sent only by their owners; everybody sees them in messages
    const emoCanUse = k => !KapliEmo.E[k].lock || (save.emo || []).includes(k);
    const emoGuard = t => t.replace(EMO_RE, k => KapliEmo.E[k] && !emoCanUse(k) ? '' : k).trim();
    function renderEmojiPicker() {
      let rec = []; try { rec = JSON.parse(localStorage.getItem(EMO_RECENT) || '[]').filter(k => KapliEmo.E[k]); } catch (e) {}
      const order = [...rec, ...KapliEmo.ORDER.filter(k => !rec.includes(k))].filter(emoCanUse);
      $('chatEmojiPicker').innerHTML = order.map(k => `<button class="chat-emoji-option" type="button" data-emote="${k}" aria-label="${KapliEmo.E[k].n}" title="${KapliEmo.E[k].n}"><span class="emo-w emo-play" data-emote="${k}">${KapliEmo.svg(k)}</span></button>`).join('');
    }
    function emoUsed(k) { try { const rec = JSON.parse(localStorage.getItem(EMO_RECENT) || '[]').filter(x => x !== k); rec.unshift(k); localStorage.setItem(EMO_RECENT, JSON.stringify(rec.slice(0, 4))); } catch (e) {} }
    renderEmojiPicker();
    function chatAdd(m, atEnd = true) {
      if (chatIds.has(m.id)) return; chatIds.add(m.id); chatLast = Math.max(chatLast, m.id);
      const list = $('chatList'); list.querySelectorAll('.empty-box, .empty-note, .skel, .sr-only').forEach(x => x.remove());
      const me = Net.nick && m.nickname === Net.nick, near = list.scrollHeight - list.scrollTop - list.clientHeight < 60;
      const li = document.createElement('li'); if (me) li.className = 'me';
      li.innerHTML = `<button type="button" class="ch-who" data-pc="${escHtml(m.nickname)}" data-who="${escHtml(m.nickname)}" aria-label="Профиль игрока ${escHtml(m.nickname)}"><b>${escHtml(m.nickname)}</b></button><time>${hhmm(m.created_at)}</time>${!me && sess ? `<button class="rep" data-rep="${m.id}" title="Пожаловаться" aria-label="Пожаловаться на сообщение">⚑</button>` : ''}<p>${chatBodyHtml(m.body, emoFresh(m))}</p>`;
      if (emoOnly(m.body)) li.classList.add('emo-only');
      if (atEnd) list.appendChild(li); else list.prepend(li);
      while (list.children.length > 120) list.firstChild.remove();
      if (near || me) list.scrollTop = list.scrollHeight;
      clearTimeout(chatAdd.t); chatAdd.t = setTimeout(() => decorateWho($('chatList')), 300);
    }
    async function chatFetch(newer) {
      let q = sb.from('kapli_chat').select('id, nickname, body, created_at');
      q = newer ? q.gt('id', chatLast).order('id', { ascending: true }).limit(50) : q.order('id', { ascending: false }).limit(60);
      const { data, error } = await withTimeout(q, 9000); if (error) throw error;
      (newer ? data : data.reverse()).forEach(m => chatAdd(m));
    }
    async function openChat() {
      applySavedChatTheme('chatCard', 'kapli3d-chat-theme');
      { const t = $('chatTabs').querySelector('[data-ct="all"]'); if (t && t.getAttribute('aria-selected') !== 'true') t.click(); }
      showCard('chatCard'); const list = $('chatList'); list.innerHTML = skelHTML(6); chatIds.clear(); chatLast = 0;
      $('chatNote').textContent = sess ? 'Не больше одного сообщения в 3 секунды. Будь вежлив: ⚑ — пожаловаться.' : 'Читать могут все. Чтобы писать, войди в аккаунт.';
      $('chatIn').disabled = $('chatSend').disabled = $('chatEmojiBtn').disabled = !sess; $('chatEmojiPicker').hidden = true; $('chatIn').placeholder = sess ? 'Сообщение… (не чаще раза в 3 с)' : 'Войди в аккаунт, чтобы писать';
      try {
        await ensureClient(); await chatFetch(false); list.querySelectorAll('.skel, .sr-only').forEach(x => x.remove());
        if (!list.children.length) list.innerHTML = emptyHTML('Сообщений пока нет — напиши первым!', 'sleep');
        list.scrollTop = list.scrollHeight;
        chatCh = sb.channel('kapli-chat').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kapli_chat' }, p => { if (p.new && p.new.id) chatAdd(p.new); }).subscribe();
        chatPoll = setInterval(() => chatFetch(true).catch(() => {}), 7000);
      } catch (e) {
        list.innerHTML = `<p class="empty-note">${netErr(e) ? 'Нет связи с сервером чата.' : /kapli_chat|relation|PGRST20/i.test(String(e.message || e.code)) ? 'Чат ещё не включён на сервере.' : 'Чат сейчас недоступен.'}</p>`;
      }
    }
    function closeChat() { clearInterval(chatPoll); chatPoll = null; if (chatCh && sb) { sb.removeChannel(chatCh); chatCh = null; } showCard('menuCard'); $('chatBtn').focus(); }
    let chatBusy = false;
    $('chatForm').addEventListener('submit', async e => {
      e.preventDefault(); const t = emoGuard($('chatIn').value.trim()); if (!t || !sess || chatBusy) return;
      chatBusy = true; $('chatSend').disabled = true;
      try {
        const { data, error } = await withTimeout(sb.from('kapli_chat').insert({ body: t }).select('id, nickname, body, created_at'), 9000);
        if (error) throw error; $('chatIn').value = ''; if (data && data[0]) chatAdd(data[0]);
      } catch (er) {
        const m = String((er && er.message) || '');
        toast(/chat_too_fast/.test(m) ? 'Не так быстро — подожди пару секунд' : /chat_forbidden/.test(m) ? 'В сообщении есть запрещённые слова' : /no_profile/.test(m) ? 'У аккаунта нет ника' : netErr(er) ? 'Нет связи с сервером' : 'Сообщение не отправлено');
      } finally { chatBusy = false; $('chatSend').disabled = !sess; $('chatIn').focus(); }
    });
    $('chatEmojiBtn').addEventListener('click', () => {
      if (!sess) return;
      if ($('chatEmojiPicker').hidden) renderEmojiPicker();
      $('chatEmojiPicker').hidden = !$('chatEmojiPicker').hidden;
    });
    $('chatEmojiPicker').addEventListener('click', e => {
      const btn = e.target.closest('[data-emote]'); if (!btn || !sess) return;
      const input = $('chatIn'), token = btn.dataset.emote;
      const start = input.selectionStart ?? input.value.length, end = input.selectionEnd ?? input.value.length;
      input.value = input.value.slice(0, start) + token + input.value.slice(end);
      const pos = start + token.length; input.focus(); input.setSelectionRange(pos, pos);
      emoUsed(token); $('chatEmojiPicker').hidden = true;
    });
    $('chatList').addEventListener('click', async e => {
      const emo = e.target.closest('.chat-inline-emoji'); if (emo) { emoReplay(emo); return; }
      const who = e.target.closest('[data-pc]'); if (who) { openPlayerCard(who.dataset.pc); return; }
      const b = e.target.closest('[data-rep]'); if (!b || !sess) return;
      b.disabled = true; const { error } = await sb.rpc('kapli_chat_report', { p_message: +b.dataset.rep }).then(r => r, er => ({ error: er }));
      toast(error ? 'Жалоба не отправлена' : 'Жалоба отправлена, спасибо'); if (!error) b.remove();
    });
    $('chatBtn').addEventListener('click', openChat);
    $('chatBack').addEventListener('click', closeChat);

    // ---------- clans: announced, not built yet ----------
    $('clanBtn').addEventListener('click', () => { showCard('clanCard'); $('clanBack').focus(); });
    $('clanBack').addEventListener('click', () => { showCard('menuCard'); $('clanBtn').focus(); });
    $('chatTabs').addEventListener('click', e => {
      const b = e.target.closest('[data-ct]'); if (!b) return; const clan = b.dataset.ct === 'clan';
      document.querySelectorAll('#chatTabs [data-ct]').forEach(t => t.setAttribute('aria-selected', t === b));
      $('chatClan').hidden = !clan; $('chatList').hidden = clan; $('chatForm').hidden = clan; $('chatNote').hidden = clan;
      if (!clan) $('chatList').scrollTop = $('chatList').scrollHeight;
    });
    $('chatClanMore').addEventListener('click', () => { closeChat(); showCard('clanCard'); $('clanBack').focus(); });

    // ---------- friends, private messages, block list, gifts, online status (server: FRIENDS-DM-MIGRATION.sql) ----------
    const FR = { list: [], blocks: [], threads: [], thrErr: null, counts: { requests: 0, unread: 0, gifts: 0 }, tab: 'friends', timer: null, ch: null, off: false, dm: null, dmLast: 0, dmPoll: null, dmBusy: false };
    const frErr = e => netErr(e) ? 'Нет связи с сервером.' : /kapli_|function|PGRST20|schema cache/i.test(String((e && (e.message || e.code)) || '')) ? 'Друзья ещё не включены на сервере.' : 'Не получилось, попробуй ещё раз.';
    const thrTime = t => { if (!t) return ''; const d = new Date(t), n = new Date(), day = 864e5, d0 = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
      if (d >= d0) return hhmm(t); if (d >= d0 - day) return 'вчера'; if (d >= d0 - 6 * day) return d.toLocaleDateString('ru-RU', { weekday: 'short' });
      return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', ''); };
    const agoTxt = t => { if (!t) return 'давно не заходил(а)'; const m = Math.round((Date.now() - new Date(t)) / 6e4);
      return m < 60 ? `был(а) ${Math.max(1, m)} мин назад` : m < 1440 ? `был(а) ${Math.round(m / 60)} ч назад` : `был(а) ${Math.round(m / 1440)} дн. назад`; };
    async function frRpc(fn, args) { if (tnOn()) return tnRpc(fn, args || {}); await ensureClient(); const { data, error } = await withTimeout(sb.rpc(fn, args || {}), 9000); if (error) throw error; return data; }
    function frBadge() {
      const n = FR.counts.requests + FR.counts.unread, b = $('frBadge');
      b.hidden = !sess || !n; b.textContent = n > 99 ? '99+' : n;
      $('frBtn').setAttribute('aria-label', n ? `Друзья: ${FR.counts.requests ? `заявок ${FR.counts.requests}` : ''}${FR.counts.requests && FR.counts.unread ? ', ' : ''}${FR.counts.unread ? `непрочитанных ${FR.counts.unread}` : ''}` : 'Друзья');
    }
    // every minute while the game is open: online mark + counters; waiting gifts are claimed into the save
    async function frPing() {
      if (!sess || FR.off || document.hidden) return;
      try {
        const ver = typeof APP_LABEL !== 'undefined' ? APP_LABEL : '';
        let c; try { c = FR.noVer ? await frRpc('kapli_ping') : await frRpc('kapli_ping', { p_ver: ver }); }
        catch (e) { if (!FR.noVer && /PGRST202|Could not find the function/i.test(String((e && (e.message || e.code)) || e))) { FR.noVer = true; c = await frRpc('kapli_ping'); } else throw e; }
        const before = FR.counts; FR.counts = c || FR.counts; frBadge();
        if (c.requests > before.requests && $('friendsCard').hidden) toast('👥 Новая заявка в друзья');
        if (c.gifts) await frClaim();
      } catch (e) {
        // 2.5: one failed ping used to switch the online mark off until the next sign-in, so a player who kept playing
        // showed «был(а) N дн. назад». Now only a missing server part stops it; an expired session is refreshed and the
        // next minute tries again
        if (netErr(e)) return;
        const t = String((e && (e.message || e.code)) || e || '');
        if (/PGRST202|Could not find the function|does not exist/i.test(t)) FR.off = true;
        else if (/JWT|401|PGRST301|expired/i.test(t)) { try { await sb.auth.refreshSession(); } catch (er) {} }
      }
    }
    async function frClaim() {
      const got = await frRpc('kapli_gifts_claim'); if (!got || !got.length) return;
      const sum = got.reduce((a, g) => a + g.amount, 0); save.coins += sum; persist(); renderAll(); walletSoon(1500);   // the server put them in the wallet already
      toast(got.length === 1 ? `🎁 Подарок от ${got[0].nickname}: +${sum} ◆` : `🎁 Подарки от друзей (${got.length}): +${sum} ◆`);
      FR.counts.gifts = 0;
    }
    document.addEventListener('visibilitychange', () => { if (!document.hidden && FR.timer) frPing(); });   // back in the game: «в игре» at once, not in a minute
    function frStart() {
      frStop(); FR.off = false; frPing(); FR.timer = setInterval(frPing, 60000);
      ensureClient().then(() => {
        if (!sess) return;
        FR.ch = sb.channel('kapli-dm-' + sess.user.id).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'kapli_dm', filter: `recipient=eq.${sess.user.id}` }, () => {
          if (FR.dm && !$('dmCard').hidden) { dmFetch(true).catch(() => {}); return; }
          FR.counts.unread++; frBadge(); toast('💬 Новое личное сообщение');
          if (!$('friendsCard').hidden) frLoad();
        }).subscribe();
      }).catch(() => {});
    }
    function frStop() { clearInterval(FR.timer); FR.timer = null; if (FR.ch && sb) { sb.removeChannel(FR.ch); FR.ch = null; } FR.counts = { requests: 0, unread: 0, gifts: 0 }; FR.list = []; frBadge(); }
    document.addEventListener('visibilitychange', () => { if (!document.hidden && sess && FR.timer) frPing(); });

    // ---- the friends window ----
    const frRel = nick => { const n = String(nick).toLowerCase(), f = FR.list.find(x => x.nickname.toLowerCase() === n); if (f) return f.status;
      return FR.blocks.some(x => x.nickname.toLowerCase() === n) ? 'blocked' : 'none'; };
    async function frLoad() {
      if (!sess && !tnOn()) return;
      try { const [l, b, t] = await Promise.all([frRpc('kapli_friends'), frRpc('kapli_blocks'), frRpc('kapli_dm_threads').catch(e => { FR.thrErr = e; return null; })]);
        FR.list = l || []; FR.blocks = b || []; if (t) { FR.threads = t; FR.thrErr = null; }
        FR.counts.requests = FR.list.filter(f => f.status === 'incoming').length; FR.counts.unread = FR.list.reduce((a, f) => a + (f.unread || 0), 0); frBadge();
        if (!$('friendsCard').hidden) frRender(); }
      catch (e) { if (!$('friendsCard').hidden) $('frList').innerHTML = `<p class="empty-note">${frErr(e)}</p>`; throw e; }
    }
    function frRender() {
      const fr = FR.list.filter(f => f.status === 'friend'), rq = FR.list.filter(f => f.status !== 'friend');
      const inc = rq.filter(f => f.status === 'incoming').length;
      const unr = FR.threads.reduce((a, t) => a + (t.unread || 0), 0) || FR.counts.unread;
      $('frTabs').innerHTML = [['friends', `👥 Друзья${fr.length ? ` · ${fr.length}` : ''}`], ['msgs', `💬 Сообщения${unr ? ` · ${unr}` : ''}`], ['req', `📨 Заявки${inc ? ` · ${inc}` : ''}`], ['blocked', '⛔ Чёрный список']]
        .map(([k, n]) => `<button class="tab" role="tab" data-frt="${k}" aria-selected="${FR.tab === k}">${n}</button>`).join('');
      const who = f => `<span class="rk-who" data-who="${escHtml(f.nickname)}">${whoHTML(f.nickname, null)}</span>`;
      const nk = f => escHtml(f.nickname);
      let html = '';
      if (FR.tab === 'friends') html = fr.length ? fr.map(f => `<li class="fr-row" data-pc="${nk(f)}" tabindex="0" role="button" aria-label="Профиль игрока ${nk(f)}">${who(f)}` +
          `<small class="fr-st ${f.online ? 'on' : ''}">${f.online ? '● в игре' : agoTxt(f.last_seen)}</small>` +
          `<span class="fr-acts"><button class="fr-b" data-fa="dm" data-nick="${nk(f)}" aria-label="Написать ${nk(f)}${f.unread ? `, непрочитанных ${f.unread}` : ''}">💬${f.unread ? `<i class="fr-n">${f.unread}</i>` : ''}</button>` +
          `<button class="fr-b" data-fa="gift" data-nick="${nk(f)}" ${f.gift_sent ? 'disabled title="Подарок уже отправлен сегодня"' : 'title="Подарить 100 ◆ (раз в день)"'} aria-label="Подарок для ${nk(f)}">🎁</button></span></li>`).join('')
        : emptyHTML('Друзей пока нет. Найди игрока по нику или ID — или нажми на ник в рейтинге или чате.', 'search');
      else if (FR.tab === 'msgs') html = FR.thrErr ? `<p class="empty-note">${/kapli_dm_threads|function|PGRST20|schema cache/i.test(String(FR.thrErr.message || FR.thrErr.code || '')) ? 'Список переписок ещё не включён на сервере. Пока переписку можно открыть кнопкой 💬 у друга.' : frErr(FR.thrErr)}</p>`
        : FR.threads.length ? FR.threads.map(t => `<li class="fr-row th-row${t.unread ? ' un' : ''}${t.online ? ' on' : ''}" data-dmo="${nk(t)}" tabindex="0" role="button" aria-label="Переписка с ${nk(t)}${t.unread ? `, непрочитанных ${t.unread}` : ''}">${who(t)}` +
            `<time class="th-tm">${thrTime(t.last_at)}</time><small class="th-pv">${t.last_mine ? '<i>Ты:</i> ' : ''}${escHtml(t.last_body)}</small>${t.unread ? `<i class="th-n">${t.unread}</i>` : ''}</li>`).join('')
          : emptyHTML('Переписок пока нет. Напиши другу — кнопка 💬 во вкладке «Друзья».', 'sleep');
      else if (FR.tab === 'req') html = rq.length ? rq.map(f => `<li class="fr-row" data-pc="${nk(f)}" tabindex="0" role="button" aria-label="Профиль игрока ${nk(f)}">${who(f)}` +
          (f.status === 'incoming' ? `<small class="fr-st">хочет дружить</small><span class="fr-acts"><button class="btn fr-sm" data-fa="accept" data-nick="${nk(f)}">Принять</button><button class="btn ghost fr-sm" data-fa="decline" data-nick="${nk(f)}">Нет</button></span>`
            : `<small class="fr-st">заявка отправлена</small><span class="fr-acts"><button class="btn ghost fr-sm" data-fa="cancel" data-nick="${nk(f)}">Отменить</button></span>`) + '</li>').join('')
        : emptyHTML('Заявок нет.', 'sleep');
      else html = FR.blocks.length ? FR.blocks.map(f => `<li class="fr-row">${who(f)}<small class="fr-st">заблокирован(а)</small><span class="fr-acts"><button class="btn ghost fr-sm" data-fa="unblock" data-nick="${nk(f)}">Разблокировать</button></span></li>`).join('')
        : emptyHTML('Чёрный список пуст. Заблокированный игрок не может присылать заявки, сообщения и подарки.', 'happy');
      $('frList').innerHTML = html; decorateWho($('frList'));
    }
    async function openFriends(keepTab) {
      showCard('friendsCard'); $('frNote').textContent = '';
      const on = !!sess || tnOn(); $('frIn').disabled = $('frAddBtn').disabled = !on;
      $('frTabs').hidden = !on;
      if (!on) { $('frTabs').innerHTML = ''; $('frList').innerHTML = emptyHTML('Друзья и личные сообщения — для игроков с аккаунтом. Войди или создай аккаунт: нажми на свой ник вверху меню.', 'sad'); $('frBack').focus(); return; }
      if (keepTab !== true) FR.tab = FR.counts.unread ? 'msgs' : FR.counts.requests ? 'req' : 'friends';
      $('frList').innerHTML = skelHTML(5); $('frBack').focus();
      try { await frLoad(); frRender(); if (FR.counts.gifts) frClaim().catch(() => {}); } catch (e) {}
    }
    const FA_TXT = { sent: 'Заявка отправлена', accepted: 'Теперь вы друзья!', already: 'Вы уже друзья', pending: 'Заявка уже отправлена — ждём ответа', self: 'Это ты 🙂',
      not_found: 'Игрок не найден — проверь ник или ID', unavailable: 'Нельзя отправить заявку этому игроку', limit: 'Лимит: 200 друзей и 30 открытых заявок',
      declined: 'Заявка отклонена', removed: 'Готово', blocked: 'Игрок в чёрном списке', unblocked: 'Игрок убран из чёрного списка', none: 'Уже неактуально', not_friends: 'Подарки — только друзьям' };
    // one action from the friends window or a player card; returns the server answer
    async function frAct(act, nick) {
      if (!sess && !tnOn()) { toast('Войди в аккаунт'); return null; }
      if ((act === 'remove' && !confirm(`Удалить ${nick} из друзей?`)) || (act === 'block' && !confirm(`Заблокировать ${nick}? Дружба и переписка прекратятся.`))) return null;
      if (act === 'dm') { openDm(nick); return 'dm'; }
      try {
        const r = act === 'add' ? await frRpc('kapli_friend_request', { p_query: nick })
          : act === 'accept' || act === 'decline' ? await frRpc('kapli_friend_respond', { p_nick: nick, p_accept: act === 'accept' })
          : act === 'cancel' || act === 'remove' ? await frRpc('kapli_friend_remove', { p_nick: nick })
          : act === 'block' || act === 'unblock' ? await frRpc('kapli_block', { p_nick: nick, p_on: act === 'block' })
          : act === 'gift' ? await frRpc('kapli_gift_send', { p_nick: nick }) : null;
        toast(act === 'gift' ? (r === 'sent' ? `🎁 Подарок отправлен: ${nick} получит 100 ◆` : r === 'already' ? 'Сегодня ты уже дарил(а) этому другу' : FA_TXT[r] || r)
          : act === 'cancel' && r === 'removed' ? 'Заявка отменена' : act === 'remove' && r === 'removed' ? `${nick} удалён(а) из друзей` : FA_TXT[r] || r);
        await frLoad().catch(() => {}); return r;
      } catch (e) { toast(frErr(e)); return null; }
    }
    $('frBtn').addEventListener('click', () => openFriends());
    $('frBack').addEventListener('click', () => { showCard('menuCard'); $('frBtn').focus(); });
    $('frTabs').addEventListener('click', e => { const b = e.target.closest('[data-frt]'); if (b) { FR.tab = b.dataset.frt; frRender(); const a = $('frTabs').querySelector(`[data-frt="${FR.tab}"]`); if (a) a.focus(); } });
    $('frAdd').addEventListener('submit', async e => {
      e.preventDefault(); const q = $('frIn').value.trim(); if (!q) return;
      $('frAddBtn').disabled = true; const r = await frAct('add', q); $('frAddBtn').disabled = false;
      if (r) { $('frNote').textContent = FA_TXT[r] || ''; if (r === 'sent' || r === 'accepted') { $('frIn').value = ''; FR.tab = r === 'sent' ? 'req' : 'friends'; frRender(); } }
    });
    $('frList').addEventListener('click', async e => {
      const b = e.target.closest('[data-fa]');
      if (b) { b.disabled = true; await frAct(b.dataset.fa, b.dataset.nick); if (b.isConnected) b.disabled = false; return; }
      const th = e.target.closest('[data-dmo]'); if (th) { openDm(th.dataset.dmo); return; }
      const row = e.target.closest('[data-pc]'); if (row) openPlayerCard(row.dataset.pc);
    });
    $('frList').addEventListener('keydown', e => { const r = e.target.closest('[data-pc], [data-dmo]'); if (r && e.target === r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); if (r.dataset.dmo) openDm(r.dataset.dmo); else openPlayerCard(r.dataset.pc); } });

    // ---- actions on another player's card ----
    async function pcSocial(nick, box) {
      if ((!sess && !tnOn()) || !nick || nick === Net.nick) { box.innerHTML = sess || nick === Net.nick ? '' : '<p class="info-note">Войди в аккаунт, чтобы добавлять в друзья и писать.</p>'; return; }
      box.innerHTML = '<p class="empty-note">…</p>';
      try { await frLoad(); } catch (e) { box.innerHTML = `<p class="info-note">${frErr(e)}</p>`; return; }
      const rel = frRel(nick), f = FR.list.find(x => x.nickname.toLowerCase() === nick.toLowerCase()), n = escHtml(nick);
      const B = (a, t, cls = 'ghost', dis) => `<button class="btn ${cls}" data-fa="${a}" data-nick="${n}" ${dis ? 'disabled' : ''}>${t}</button>`;
      box.innerHTML = (f && f.status === 'friend' ? `<small class="fr-st ${f.online ? 'on' : ''}">${f.online ? '● в игре' : agoTxt(f.last_seen)}</small>` : '') + '<div class="pc-acts">' + (
        rel === 'friend' ? B('dm', `💬 Написать${f.unread ? ` · ${f.unread}` : ''}`, '') + B('gift', f.gift_sent ? '🎁 Подарено сегодня' : '🎁 Подарить 100 ◆', 'ghost', f.gift_sent) + B('remove', 'Удалить из друзей') + B('block', '⛔ Заблокировать')
        : rel === 'incoming' ? B('accept', '✓ Принять заявку', '') + B('decline', 'Отклонить') + B('block', '⛔ Заблокировать')
        : rel === 'outgoing' ? B('cancel', 'Отменить заявку') + B('block', '⛔ Заблокировать')
        : rel === 'blocked' ? B('unblock', 'Разблокировать')
        : B('add', '👥 Добавить в друзья', '') + B('block', '⛔ Заблокировать')) + '</div>';
    }
    async function pcSocialClick(e, box) {
      const b = e.target.closest('[data-fa]'); if (!b) return;
      const nick = b.dataset.nick; b.disabled = true;
      if (b.dataset.fa === 'dm') { $('pcModal').hidden = true; openDm(nick); return; }
      await frAct(b.dataset.fa, nick); if (box.isConnected && !$('pcModal').hidden) pcSocial(nick, box);
    }

    // Theme chooser: preview is temporary until Apply; settings are local to this device.
    function readChatTheme(key) { let t='default'; try { t=localStorage.getItem(key)||'default'; } catch(e) {} return ['default','cosmos','aurora','sakura','drops'].includes(t)||chatBgOwned(t)?t:'default'; }   // a crafted scene counts only while it is owned
    function paintChatTheme(cardId, theme) { const card=$(cardId); if(!card)return; card.classList.toggle('chat-themed',theme!=='default'); card.dataset.chatTheme=theme; syncChatBg(card, theme); }
    // Chat scene: an <object> with the theme's SVG, so its animation can be driven from here.
    // It advances at most CHAT_BG_FPS times a second, stands still while the chat scrolls, and stops when the chat is off screen.
    // Until the document loads (or if it cannot be scripted) the CSS background of the card shows the same scene.
    const CHAT_BG_FPS = 30, CHAT_BG_HOLD = 220;
    const chatBgSeen = new Set(); let chatBgRaf = 0, chatBgLast = 0, chatBgHold = 0;
    const chatBgIO = 'IntersectionObserver' in window ? new IntersectionObserver(es => { es.forEach(e => e.isIntersecting ? chatBgSeen.add(e.target) : chatBgSeen.delete(e.target)); chatBgKick(); }) : null;
    function chatBgKick() { if (!chatBgRaf && chatBgSeen.size && !document.hidden) { chatBgLast = 0; chatBgRaf = requestAnimationFrame(chatBgTick); } }
    function chatBgTick(now) {
      chatBgRaf = 0; if (!chatBgSeen.size || document.hidden) return;
      chatBgRaf = requestAnimationFrame(chatBgTick);
      if (!chatBgLast) { chatBgLast = now; return; }
      if (now < chatBgHold) { chatBgLast = now; return; }
      const dt = now - chatBgLast; if (dt < 1000 / CHAT_BG_FPS - 2) return;
      chatBgLast = now;
      chatBgSeen.forEach(o => { if (!o._svg) return; o._t += Math.min(dt, 120) / 1000; try { o._svg.setCurrentTime(o._t); } catch (e) {} });
    }
    document.addEventListener('visibilitychange', chatBgKick);
    document.addEventListener('gesturestart', e => e.preventDefault());   // iOS ignores user-scalable=no; this stops its pinch zoom
    function dropChatBg(card, o) { if (chatBgIO) chatBgIO.unobserve(o); chatBgSeen.delete(o); o.remove(); card.classList.remove('chat-bg-on'); }
    function syncChatBg(card, theme) {
      let o = card.querySelector(':scope > .chat-bg');
      if (o && o.dataset.theme === theme) return;
      if (o) dropChatBg(card, o);
      if (theme === 'default' || !chatBgIO) return;
      o = document.createElement('object'); o.className = 'chat-bg'; o.type = 'image/svg+xml'; o.dataset.theme = theme; o.tabIndex = -1; o.setAttribute('aria-hidden', 'true');
      o.addEventListener('load', () => {
        let svg = null; try { svg = o.contentDocument && o.contentDocument.documentElement; } catch (e) {}
        if (!o.isConnected) return;
        if (!svg || !svg.pauseAnimations || !svg.setCurrentTime) { dropChatBg(card, o); return; }
        svg.pauseAnimations(); o._svg = svg; o._t = 0; card.classList.add('chat-bg-on'); chatBgIO.observe(o);
      });
      o.addEventListener('error', () => { if (o.isConnected) dropChatBg(card, o); });
      o.data = 'chat-' + theme + '.svg';
      card.prepend(o);
      if (!card._chatBgScroll) { card._chatBgScroll = true; card.addEventListener('scroll', () => { chatBgHold = performance.now() + CHAT_BG_HOLD; }, { capture: true, passive: true }); }
    }
    let activeThemePreview = null;
    const themeNames = { cosmos: '🌌 Космос', aurora: '🌠 Аврора', sakura: '🌸 Сакура', drops: '💧 Капли', 'chronos-workshop': '⚙ Мастерская часовщика', 'chronos-city': '🕰 Город башенных часов', 'chronos-heart': '✨ Сердце механизма', 'duo-border': '👥 Граница', 'duo-backtoback': '👥 Плечом к плечу', default: 'Стандартный фон' };
    const themeFull = $('themeFullPreview'), themeFullScene = $('themeFullScene'), themeFullTitle = $('themeFullTitle');
    const themeFullApply = $('themeFullApply'), themeFullBack = $('themeFullBack'), themeFullBackBottom = $('themeFullBackBottom');
    const THEME_ORDER = ['cosmos', 'aurora', 'sakura', 'drops', ...CHAT_BG_ALL.map(b => b.id)];
    const themeLocked = t => CHAT_BG_ALL.some(b => b.id === t) && !chatBgOwned(t);
    const lockWhy = t => { const m = CHAT_BG_MODE.find(b => b.id === t); return m ? `${m.need} ${m.unit} в «${MODES[m.mode].name}» (сейчас ${(((save.duo || {})[m.mode] || {}).games || 0)})` : ''; };
    const flipThemeFull = d => { if (!activeThemePreview) return; const i = THEME_ORDER.indexOf(activeThemePreview.pending); openThemeFullPreview(activeThemePreview, THEME_ORDER[(i + d + THEME_ORDER.length) % THEME_ORDER.length]); };
    $('themeFullPrev').addEventListener('click', () => flipThemeFull(-1));
    $('themeFullNext').addEventListener('click', () => flipThemeFull(1));
    function closeThemeFullPreview() { if (!activeThemePreview) return; themeFull.hidden = true; activeThemePreview = null; }
    function openThemeFullPreview(ctx, theme) {
      activeThemePreview = { ...ctx, pending: theme };
      themeFullScene.dataset.themePreview = theme;
      themeFullTitle.textContent = themeNames[theme] || 'Оформление';
      const i = THEME_ORDER.indexOf(theme); $('themeFullN').textContent = i < 0 ? '' : `${i + 1} / ${THEME_ORDER.length}`;
      themeFullApply.textContent = themeLocked(theme) ? (lockWhy(theme) ? `🔒 ${lockWhy(theme)}` : '🔒 Создаётся в мастерской') : 'Применить фон';
      themeFull.hidden = false;
      themeFullApply.focus();
    }
    function commitTheme(ctx, theme) {
      if (themeLocked(theme)) { toast(lockWhy(theme) ? `Этот фон — награда: ${lockWhy(theme)}` : 'Этот фон создаётся в мастерской, серия «Хронос»'); return; }   // looking is free, applying needs the crafted scene
      const key = ctx.keyFn();
      try { if (theme === 'default') localStorage.removeItem(key); else localStorage.setItem(key, theme); } catch (e) {}
      paintChatTheme(ctx.cardId, theme);
      ctx.saved = theme;
      ctx.pending = theme;
      ctx.dismiss(false);
      closeThemeFullPreview();
    }
    themeFullBack.addEventListener('click', closeThemeFullPreview);
    themeFullBackBottom.addEventListener('click', closeThemeFullPreview);
    themeFullApply.addEventListener('click', () => { if (activeThemePreview) commitTheme(activeThemePreview, activeThemePreview.pending); });
    document.addEventListener('keydown', e => { if (!activeThemePreview) return; if (e.key === 'Escape') closeThemeFullPreview(); else if (e.key === 'ArrowLeft') flipThemeFull(-1); else if (e.key === 'ArrowRight') flipThemeFull(1); });
    function setupThemePicker(prefix, cardId, keyFn) {
      const panel=$(prefix+'ThemePanel'), gear=$(prefix+'ThemeGear'), close=$(prefix+'ThemeClose'), reset=$(prefix+'ThemeReset'), apply=$(prefix+'ThemeApply');
      if(!panel||!gear||!close||!reset||!apply)return;
      const ctx = { cardId, keyFn, saved:'default', pending:'default', dismiss:null };
      const choices=[...panel.querySelectorAll('[data-theme-choice]')];
      const mark=()=>choices.forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeChoice===ctx.pending)));
      const dismiss=restore=>{if(restore)paintChatTheme(cardId,ctx.saved);panel.hidden=true;gear.setAttribute('aria-expanded','false');};
      ctx.dismiss=dismiss;
      const open=()=>{ctx.saved=readChatTheme(keyFn());ctx.pending=ctx.saved;paintChatTheme(cardId,ctx.pending);mark();choices.forEach(b=>b.classList.toggle('locked',themeLocked(b.dataset.themeChoice)));panel.hidden=false;gear.setAttribute('aria-expanded','true');};
      gear.setAttribute('aria-expanded','false');gear.addEventListener('click',()=>panel.hidden?open():dismiss(true));
      close.addEventListener('click',()=>dismiss(true));
      choices.forEach(b=>b.addEventListener('click',()=>{ctx.pending=b.dataset.themeChoice;paintChatTheme(cardId,ctx.pending);mark();}));
      panel.querySelectorAll('[data-theme-eye]').forEach(b=>b.addEventListener('click',()=>openThemeFullPreview(ctx,b.dataset.themeEye)));
      reset.addEventListener('click',()=>{ctx.pending='default';paintChatTheme(cardId,ctx.pending);mark();});
      apply.addEventListener('click',()=>commitTheme(ctx,ctx.pending));
    }
    // full-screen preview of any chat scene from outside the chat (workshop cards): «Применить» sets it for the general chat once crafted
    Net.previewChatTheme = theme => { const ctx = { cardId: 'chatCard', keyFn: () => 'kapli3d-chat-theme', saved: readChatTheme('kapli3d-chat-theme'), pending: theme, dismiss: () => {} }; openThemeFullPreview(ctx, theme); };
    function applySavedChatTheme(cardId,key) { paintChatTheme(cardId,readChatTheme(key)); }
    setupThemePicker('chat','chatCard',()=> 'kapli3d-chat-theme');
    setupThemePicker('dm','dmCard',()=> 'kapli3d-dm-theme:'+encodeURIComponent((FR.dm||'').toLowerCase()));

    // ---- one private conversation ----
    function dmAdd(m) {
      const list = $('dmList'); if (list.querySelector(`[data-dm="${m.id}"]`)) return;
      list.querySelectorAll('.empty-box, .empty-note, .skel, .sr-only').forEach(x => x.remove());
      FR.dmLast = Math.max(FR.dmLast, m.id);
      const near = list.scrollHeight - list.scrollTop - list.clientHeight < 60, li = document.createElement('li');
      li.dataset.dm = m.id; if (m.mine) li.className = 'me';
      li.innerHTML = `<b>${m.mine ? 'Ты' : escHtml(FR.dm)}</b><time>${hhmm(m.created_at)}${m.mine ? ` <span class="dm-rd" title="${m.read_at ? 'Прочитано' : 'Доставлено'}">${m.read_at ? '✓✓' : '✓'}</span>` : ''}</time>` +
        (!m.mine ? `<button class="rep" data-dmrep="${m.id}" title="Пожаловаться" aria-label="Пожаловаться на сообщение">⚑</button>` : '') + `<p>${chatBodyHtml(m.body, emoFresh(m))}</p>`; if (emoOnly(m.body)) li.classList.add('emo-only');
      list.appendChild(li); while (list.children.length > 200) list.firstChild.remove();
      if (near || m.mine) list.scrollTop = list.scrollHeight;
    }
    async function dmFetch(newer) {
      const nick = FR.dm; const rows = await frRpc('kapli_dm_history', { p_nick: nick, p_after: newer ? FR.dmLast : null, p_limit: 60 });
      if (FR.dm !== nick) return;
      (rows || []).reverse().forEach(dmAdd);
      if ((rows || []).some(r => !r.mine)) { frRpc('kapli_dm_read', { p_nick: nick }).then(() => { frPing(); FR.threads.forEach(t => { if (t.nickname === nick) t.unread = 0; }); }).catch(() => {}); }
      if (!newer) $('dmList').scrollTop = $('dmList').scrollHeight;
    }
    async function openDm(nick) {
      FR.dm = nick; FR.dmLast = 0; showCard('dmCard');
      applySavedChatTheme('dmCard', 'kapli3d-dm-theme:' + encodeURIComponent(nick.toLowerCase()));
      const f = FR.list.find(x => x.nickname.toLowerCase() === nick.toLowerCase());
      $('dmHead').innerHTML = `<button type="button" class="ch-who" data-pc="${escHtml(nick)}" data-who="${escHtml(nick)}" aria-label="Профиль игрока ${escHtml(nick)}">${whoHTML(nick, null)}</button>` +
        (f ? `<small class="fr-st ${f.online ? 'on' : ''}">${f.online ? '● в игре' : agoTxt(f.last_seen)}</small>` : '');
      decorateWho($('dmHead'));
      $('dmList').innerHTML = skelHTML(4); $('dmNote').textContent = 'Личные сообщения видите только вы двое. ⚑ — пожаловаться.';
      const canWrite = !!(f && f.status === 'friend');
      $('dmIn').value = ''; $('dmIn').disabled = $('dmSend').disabled = !canWrite; $('dmIn').placeholder = canWrite ? 'Сообщение…' : 'Вы больше не друзья — писать нельзя';
      if (canWrite) $('dmIn').focus(); else $('dmBack').focus();
      try { await dmFetch(false); $('dmList').querySelectorAll('.skel, .sr-only').forEach(x => x.remove()); if (!$('dmList').querySelector('li')) $('dmList').innerHTML = emptyHTML('Сообщений пока нет — напиши первым!', 'sleep'); }
      catch (e) { $('dmList').innerHTML = `<p class="empty-note">${frErr(e)}</p>`; }
      clearInterval(FR.dmPoll); FR.dmPoll = setInterval(() => { if (!$('dmCard').hidden) dmFetch(true).catch(() => {}); }, 6000);
    }
    function closeDm() { clearInterval(FR.dmPoll); FR.dmPoll = null; FR.dm = null; openFriends(true); }
    const DM_ERR = { not_friends: 'Писать можно только друзьям', too_fast: 'Не так быстро — подожди секунду', daily_limit: 'На сегодня лимит сообщений исчерпан', empty: '' };
    $('dmForm').addEventListener('submit', async e => {
      e.preventDefault(); const t = emoGuard($('dmIn').value.trim()); if (!t || !FR.dm || FR.dmBusy) return;
      FR.dmBusy = true; $('dmSend').disabled = true;
      try { await frRpc('kapli_dm_send', { p_nick: FR.dm, p_body: t }); $('dmIn').value = ''; await dmFetch(true); }
      catch (er) { const k = Object.keys(DM_ERR).find(k => String(er.message || '').includes(k)); toast(k ? DM_ERR[k] || 'Пустое сообщение' : frErr(er)); }
      FR.dmBusy = false; $('dmSend').disabled = false; $('dmIn').focus();
    });
    $('dmBack').addEventListener('click', closeDm);
    $('dmHead').addEventListener('click', e => { const w = e.target.closest('[data-pc]'); if (w) openPlayerCard(w.dataset.pc); });
    $('dmList').addEventListener('click', async e => {
      { const emo = e.target.closest('.chat-inline-emoji'); if (emo) { emoReplay(emo); return; } }
      const b = e.target.closest('[data-dmrep]'); if (!b) return;
      b.disabled = true;
      try { await frRpc('kapli_dm_report', { p_message: +b.dataset.dmrep }); toast('Жалоба отправлена, спасибо. Игрока можно заблокировать в его профиле.'); b.remove(); }
      catch (er) { b.disabled = false; toast(frErr(er)); }
    });

    // ---------- ranking by mode ----------
    let rankMode = 'classic';
    let rankDiff = 0;
    $('rankModes').innerHTML = RANK_MODES.map(m => `<button type="button" data-rm="${m}" aria-pressed="false">${MODES[m].name}</button>`).join('') +
      ['territory', 'duoback'].map(m => `<button type="button" data-rm="${m}" class="rm-duo" aria-pressed="false">👥 ${MODES[m].name}</button>`).join('') +
      `<button type="button" data-rm="coins" class="rm-coins" aria-pressed="false">◆ Монеты</button>`;
    // 2.6: coins earned in the game since 2.6, counted by the server wallet (COINS-RATING-MIGRATION.sql)
    async function loadCoinsRank() {
      const list = $('rankList');
      const { data, error } = await withTimeout(sb.rpc('kapli_coins_top', { p_limit: 20 }), 9000); if (error) throw error;
      if (rankMode !== 'coins') return;
      list.innerHTML = data.length ? data.map(r => `<li class="${r.is_me ? 'me' : ''}" data-pc="${escHtml(r.nickname)}" tabindex="0" role="button" aria-label="Профиль игрока ${escHtml(r.nickname)}"><span class="pl">${r.place}</span><span class="rk-who" data-who="${escHtml(r.nickname)}">${whoHTML(r.nickname, r.is_me ? myShowcase() : null)}</span><span class="sc">${Number(r.total).toLocaleString('ru-RU')} ◆</span></li>`).join('')
        : `<li class="rk-empty">${emptyHTML('Здесь будут те, кто заработал больше всех монет в игре, — начиная с версии 2.6.', 'search')}</li>`;
      decorateWho(list);
      if (!sess) { $('rankMe').textContent = 'Войди в аккаунт: монеты считает сервер, только у игроков с аккаунтом.'; return; }
      const me = await sb.rpc('kapli_coins_me'); const row = me.data && me.data[0];
      $('rankMe').textContent = row ? `Твоё место: ${row.place} из ${row.players} · заработано ${Number(row.total).toLocaleString('ru-RU')} ◆ с версии 2.6` : 'Считаются монеты, заработанные в игре с версии 2.6: раунды, достижения, сундуки, лиги. Промокоды и подарки не входят.';
    }
    // the ratings of the modes for two: «Захват территории» — most wins; «Спина к спине» — the best pairs on each difficulty
    async function loadDuoRank(m) {
      const list = $('rankList');
      const DF = ['Обычный', 'Сложный', 'Безумие'];
      const head = m === 'duoback' ? `<li class="rk-diff" role="group" aria-label="Сложность">${DF.map((n, i) => `<button type="button" data-rdf="${i}" aria-pressed="${i === rankDiff}">${n}</button>`).join('')}</li>` : '';
      const { data, error } = await withTimeout(m === 'territory' ? sb.rpc('kapli_duo_territory_top', { p_limit: 20 }) : sb.rpc('kapli_duo_coop_top', { p_diff: rankDiff, p_limit: 20 }), 9000); if (error) throw error;
      if (rankMode !== m) return;
      list.innerHTML = head + (data.length ? data.map(r => m === 'territory'
        ? `<li class="${r.is_me ? 'me' : ''}" data-pc="${escHtml(r.nickname)}" tabindex="0" role="button" aria-label="Профиль игрока ${escHtml(r.nickname)}"><span class="pl">${r.place}</span><span class="rk-who" data-who="${escHtml(r.nickname)}">${whoHTML(r.nickname, r.is_me ? myShowcase() : null)}</span><span class="sc">${r.wins} поб. · ${r.best_share}%</span></li>`
        : `<li class="${r.is_me ? 'me' : ''} rk-pair"><span class="pl">${r.place}</span><span class="rk-pair-who">${escHtml(r.nickname)} <i>+</i> ${escHtml(r.mate_nickname)}<small>${fmtTime(r.time_s)} · боссов ${r.bosses} · ботов ${r.bots} · возвращений ${r.respawns}</small></span><span class="sc">${r.waves} волн</span></li>`).join('')
        : `<li class="rk-empty">${emptyHTML(m === 'territory' ? 'Пока никто не выиграл матч — стань первым!' : 'На этой сложности пока нет забегов — пройдите первыми!', 'search')}</li>`);
      decorateWho(list);
      if (!sess) { $('rankMe').textContent = 'Войди в аккаунт, чтобы твои матчи попали в рейтинг.'; return; }
      if (m === 'territory') { const me = await sb.rpc('kapli_duo_territory_me'); const row = me.data && me.data[0]; $('rankMe').textContent = row ? `Твоё место: ${row.place} из ${row.total} · побед ${row.wins} из ${row.games} · лучшая доля ${row.best_share}%` : 'У тебя пока нет побед в этом режиме.'; }
      else { const mine = data.find(r => r.is_me); $('rankMe').textContent = mine ? `Ваша лучшая пара: ${mine.place}-е место · ${mine.waves} волн` : 'Рейтинг пар: забег засчитывает сервер игры, когда матч закончен. Матчи напрямую — без рейтинга.'; }
    }
    async function loadRank(m) {
      rankMode = m; document.querySelectorAll('[data-rm]').forEach(b => b.setAttribute('aria-pressed', b.dataset.rm === m));
      const list = $('rankList'); list.innerHTML = skelHTML(8); $('rankMe').textContent = '';
      try {
        await ensureClient();
        if (m === 'territory' || m === 'duoback') { await loadDuoRank(m); return; }
        if (m === 'coins') { await loadCoinsRank(); return; }
        if (sess) await syncBests();
        const { data, error } = await withTimeout(sb.rpc('kapli_leaderboard', { p_mode: m, p_limit: 20 }), 9000); if (error) throw error;
        if (rankMode !== m) return;
        list.innerHTML = data.length ? data.map(r => `<li class="${r.is_me ? 'me' : ''}" data-pc="${escHtml(r.nickname)}" tabindex="0" role="button" aria-label="Профиль игрока ${escHtml(r.nickname)}"><span class="pl">${r.place}</span><span class="rk-who" data-who="${escHtml(r.nickname)}">${whoHTML(r.nickname, r.is_me ? myShowcase() : null)}</span><span class="sc">${fmtBest(m, r.score)}</span></li>`).join('')
          : emptyHTML('В этом режиме пока нет рекордов — стань первым!', 'search');
        decorateWho(list);
        if (!sess) { $('rankMe').textContent = 'Войди в аккаунт, чтобы твои рекорды попали в рейтинг.'; return; }
        const [me, hd] = await Promise.all([sb.rpc('kapli_my_place', { p_mode: m }), sb.rpc('kapli_my_held').then(r => r, () => ({}))]);
        const row = me.data && me.data[0], held = Array.isArray(hd.data) && hd.data.includes(m);
        if (held) { const li = list.querySelector('li.me .sc'); if (li) li.insertAdjacentHTML('beforeend', '<small class="rk-held">⏳ на проверке</small>'); }
        $('rankMe').textContent = row ? `Твоё место: ${row.place} из ${row.total} · ${fmtBest(m, row.score)}${held ? ' · ⏳ рекорд на проверке: другие увидят его после одобрения' : ''}` : 'У тебя пока нет рекорда в этом режиме — сыграй раунд.';
      } catch (e) {
        list.innerHTML = `<p class="empty-note">${netErr(e) ? 'Нет связи с сервером.' : /kapli_|function|PGRST20/i.test(String(e.message || e.code)) ? 'Рейтинг ещё не включён на сервере.' : 'Рейтинг сейчас недоступен.'}</p>`;
      }
    }
    $('rankModes').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) loadRank(b.dataset.rm); });
    $('rankList').addEventListener('click', e => { const b = e.target.closest('[data-rdf]'); if (b) { e.stopPropagation(); rankDiff = +b.dataset.rdf; loadRank('duoback'); } }, true);
    $('rankList').addEventListener('click', e => { const li = e.target.closest('[data-pc]'); if (li) openPlayerCard(li.dataset.pc); });
    $('rankList').addEventListener('keydown', e => { const li = e.target.closest('[data-pc]'); if (li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPlayerCard(li.dataset.pc); } });
    // 2.6: records «на проверке» — the «Создатель» reviews them here (RECORDS-REVIEW-MIGRATION.sql; the server checks the badge itself)
    async function reviewCheck() {
      let btn = $('rankReview');
      if (!sess || !(save.badges || {}).creator) { if (btn) btn.hidden = true; return; }
      let data; try { const r = await withTimeout(sb.rpc('kapli_review_list'), 9000); if (r.error) throw r.error; data = r.data; } catch (e) { if (btn) btn.hidden = true; return; }
      if (!btn) { btn = document.createElement('button'); btn.type = 'button'; btn.id = 'rankReview'; btn.className = 'btn ghost rank-review'; $('rankMe').after(btn); btn.addEventListener('click', reviewOpen); }
      btn.hidden = false; btn.textContent = `🕵 На проверке (${data.length})`; btn.classList.toggle('has', data.length > 0);
      return data;
    }
    async function reviewOpen() {
      const data = await reviewCheck(); if (!data) return;
      let m = $('reviewM');
      if (!m) {
        m = document.createElement('div'); m.id = 'reviewM'; m.className = 'modal'; m.hidden = true;
        m.innerHTML = `<div class="modal-card review-card" role="dialog" aria-modal="true" aria-labelledby="reviewH"><button class="modal-x" type="button" data-rvx aria-label="Закрыть">×</button><h2 id="reviewH">Рекорды на проверке</h2><p class="review-note">Рекорд держится, если он в 3 раза выше прошлого или первый рекорд слишком большой. До решения его видит только сам игрок.</p><ul class="review-list" id="reviewList"></ul></div>`;
        document.body.appendChild(m);
        m.addEventListener('click', async e => {
          if (e.target === m || e.target.closest('[data-rvx]')) { m.hidden = true; $('rankReview').focus(); return; }
          const b = e.target.closest('[data-rvok]'); if (!b) return;
          const li = b.closest('li'), ok = b.dataset.rvok === '1';
          if (!ok && !confirm(`Удалить рекорд игрока ${li.dataset.nick}?`)) return;
          li.querySelectorAll('button').forEach(x => x.disabled = true);
          try { const { error } = await withTimeout(sb.rpc('kapli_review_record', { p_nick: li.dataset.nick, p_mode: li.dataset.mode, p_ok: ok }), 9000); if (error) throw error;
            toast(ok ? `Рекорд ${li.dataset.nick} показан всем` : `Рекорд ${li.dataset.nick} удалён`); li.remove();
            if (!$('reviewList').children.length) $('reviewList').innerHTML = '<li class="review-empty">Проверять нечего ✓</li>';
            reviewCheck(); if (li.dataset.mode === rankMode) loadRank(rankMode);
          } catch (er) { li.querySelectorAll('button').forEach(x => x.disabled = false); toast(netErr(er) ? 'Нет связи с сервером.' : 'Не получилось — попробуй ещё раз.'); }
        });
      }
      const mName = k => (MODES[k] || {}).name || k;
      $('reviewList').innerHTML = data.length ? data.map(r => `<li data-nick="${escHtml(r.nickname)}" data-mode="${escHtml(r.mode)}"><div class="rv-who"><b>${escHtml(r.nickname)}</b> · ${escHtml(mName(r.mode))}<small>${r.prev_score != null ? `было ${fmtBest(r.mode, r.prev_score)} → ` : 'первый рекорд: '}<b>${fmtBest(r.mode, r.score)}</b>${r.prev_score ? ` (×${(r.score / r.prev_score).toFixed(1)})` : ''} · ${new Date(r.at).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></div><button type="button" class="btn rv-ok" data-rvok="1">Показать</button><button type="button" class="btn ghost rv-no" data-rvok="0">Удалить</button></li>`).join('')
        : '<li class="review-empty">Проверять нечего ✓</li>';
      m.hidden = false; m.querySelector('[data-rvx]').focus();
    }
    $('rankBtn').addEventListener('click', () => { reviewCheck(); showCard('rankCard'); loadRank(RANK_MODES.includes(save.mode) || isDuoMode(save.mode) ? save.mode : 'classic'); $('rankBack').focus(); });
    $('rankBack').addEventListener('click', () => { showCard('menuCard'); $('rankBtn').focus(); });

    // ---------- 2.6: the coin wallet on the server (WALLET-MIGRATION.sql, economy V1) ----------
    // save.wal = { uid, q: [{ id, k: 'e' | 's', n, s }] }: the operations not yet confirmed. The server counts each id once,
    // so the queue may be sent again (no answer, another phone with the same cloud save). Its answer is the balance:
    // the coins shown = the wallet + what is still in the queue. Before the first answer for this account the coins on
    // the phone go to the server «as is» (the server caps them) and the queue is not used.
    let walBusy = false, walAgain = false, walOff = false, walTimer = null;
    const qSum = q => q.reduce((t, o) => t + (o.k === 's' ? -o.n : o.n), 0);
    function walletSoon(ms) { clearTimeout(walTimer); walTimer = setTimeout(walletSync, ms || 6000); }
    async function walletSync() {
      if (walBusy) { walAgain = true; return; }
      if (!sb || !sess || privacyPending || walOff) return;
      if (!canPush || pending) { walletSoon(15000); return; }   // canPush: the save on this phone is the account's one (no «which save?» question open)
      const uid = sess.user.id, W = save.wal && save.wal.uid === uid && Array.isArray(save.wal.q) ? save.wal : null;
      walBusy = true; walAgain = false;
      try {
        if (!W) {   // the first time for this account on this phone
          const c0 = save.coins;
          const { data, error } = await withTimeout(sb.rpc('kapli_wallet_sync', { p_init: c0, p_ops: [] }), 10000); if (error) throw error;
          if (!data || data.err || typeof data.coins !== 'number' || !sess || sess.user.id !== uid) return;
          const d = save.coins - c0;   // coins that came while the answer was on its way
          save.wal = { uid, q: [] }; save.coins = data.coins;
          if (d > 0) coinsAdd(d, 'late'); else if (d < 0) coinsSpend(-d, 'late');
        } else {
          for (let i = 0; i < 5 && W.q.length; i++) {
            const batch = W.q.slice(0, 200);
            const { data, error } = await withTimeout(sb.rpc('kapli_wallet_sync', { p_init: 0, p_ops: batch }), 10000); if (error) throw error;
            if (!data || data.err || typeof data.coins !== 'number') return;
            const gone = new Set([...(data.done || []), ...(data.bad || [])]);
            if ((data.bad || []).length) KapliErr.log(new Error(`wallet refused ${data.bad.length}: ${batch.filter(o => data.bad.includes(o.id)).map(o => o.k + o.n + ':' + o.s).join(',').slice(0, 200)}`), 'wallet');
            W.q = W.q.filter(o => !gone.has(o.id));
            save.coins = Math.max(0, data.coins + qSum(W.q));
            if (!gone.size) break;
          }
          if (!W.q.length && !walAgain) {   // nothing to send: just take the balance (promo, gifts, the other phone)
            const { data, error } = await withTimeout(sb.rpc('kapli_wallet_sync', { p_init: 0, p_ops: [] }), 10000); if (error) throw error;
            if (data && typeof data.coins === 'number') save.coins = Math.max(0, data.coins + qSum(W.q));
          }
        }
        persist(); renderAll();
      } catch (e) {
        const t = String((e && (e.message || e.code)) || e || '');
        if (/PGRST202|Could not find the function|does not exist/i.test(t)) walOff = true;   // the server has no wallet yet: coins stay on the phone as before
        else if (!netErr(e)) KapliErr.log(e, 'wallet');
        walletSoon(60000);
      } finally { walBusy = false; if (walAgain) walletSoon(1500); }
    }
    setInterval(() => { if (save.wal && save.wal.q && save.wal.q.length) walletSync(); }, 90000);
    document.addEventListener('visibilitychange', () => { if (document.hidden && save.wal && save.wal.q && save.wal.q.length) walletSync(); });

    // ---------- 2.6: promo codes and exclusive badges are kept by the server (SECURITY-MIGRATION.sql) ----------
    async function redeemPromo(code) {
      try { await ensureClient(); if (!sess) return { err: 'auth' };
        const { data, error } = await withTimeout(sb.rpc('kapli_redeem_promo', { p_code: code }), 9000); if (error) throw error; return data; }
      catch (e) { return { err: 'net' }; }
    }
    // the exclusive badges the server granted: the ones it does not know are removed from this save (with their frame,
    // title and background), the granted ones come back on a new phone
    const EXCL = ['creator', 'beta', 'vet'];
    async function syncBadges() {
      if (!sess || privacyPending) return;
      let mine; try { const { data, error } = await withTimeout(sb.rpc('kapli_my_badges'), 9000); if (error || !Array.isArray(data)) return; mine = data; } catch (e) { return; }
      save.badges = save.badges || {}; save.pbg = save.pbg || []; let changed = false;
      for (const id of EXCL) {
        const has = mine.includes(id), items = ['fr_' + id, 'tt_' + id];
        if (has && !save.badges[id]) { save.badges[id] = today; items.forEach(d => { if (!save.decor.includes(d)) save.decor.push(d); }); changed = true; }
        if (!has && (save.badges[id] || items.some(d => save.decor.includes(d)) || save.pbg.includes('bg_' + id))) {
          delete save.badges[id]; save.decor = save.decor.filter(d => !items.includes(d)); save.pbg = save.pbg.filter(b => b !== 'bg_' + id);
          if (save.frame === 'fr_' + id) save.frame = null; if (save.title === 'tt_' + id) save.title = null;
          save.pc = save.pc || {}; if (save.pc.badge === id) save.pc.badge = ''; if (save.pc.bg === 'bg_' + id) save.pc.bg = 'bg_base';
          changed = true;
        }
      }
      if (changed) { pbgCheck(true); persist(); renderAll(); pushShowcase(); }
    }
    // ---------- 2.6: error reports (the device's journal goes to the server, no personal data) ----------
    const DEV_KEY = 'kapli3d-dev', SENT_KEY = 'kapli3d-errsent';
    const devId = () => { try { let d = localStorage.getItem(DEV_KEY); if (!d) { d = 'd' + Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem(DEV_KEY, d); } return d; } catch (e) { return ''; } };
    async function errFlush() {
      try {
        const sent = +(localStorage.getItem(SENT_KEY) || 0), fresh = KapliErr.read().filter(e => e.t > sent).slice(-10); if (!fresh.length || !navigator.onLine) return;
        await ensureClient(); if (!sb) return;
        const { error } = await withTimeout(sb.rpc('kapli_err_report', { p_device: devId(), p_ver: typeof APP_LABEL !== 'undefined' ? APP_LABEL : '', p_ua: navigator.userAgent.slice(0, 160), p_items: fresh.map(e => ({ w: e.w, m: e.m, s: e.s, n: e.n })) }), 9000);
        if (!error) localStorage.setItem(SENT_KEY, String(Math.max(...fresh.map(e => e.t))));
      } catch (e) {}
    }
    setTimeout(errFlush, 15000); setInterval(errFlush, 5 * 60000);
    Object.assign(Net, { boot, submitRecord: (m, v) => { submitRecord(m, v); }, redeemPromo, walletSoon, walletSync, openAccount, pushShowcase, getShowcases, pcSocial, pcSocialClick });
    renderChip();
  }

  effects = { speed: 0, shield: 0, double: 0, magnet: 0 };
  stats = { time: 0 }; history = [0];
  bots.forEach(spawnBot);
  rebuildCells();
  if (TEST_MODE) { $('testBadge').hidden = false; document.querySelector('#menuCard h1').innerHTML += ' <button type="button" class="test-badge" data-testopen>ТЕСТ ▾</button>'; }

  // ================= 2.2: activity calendar =================
  // one entry per local day: [rounds, seconds played, best mass]; the last 40 days are kept, the day count and best streak live on
  const plural = (n, one, few, many) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };
  const ACT_KEEP = 40;   // a month is shown; a little slack for time zones
  const dayKey = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dayShift = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  function actStreak(from = new Date()) {
    let d = from; if (!save.act[dayKey(d)]) d = dayShift(d, -1);   // today not played yet: the streak still counts up to yesterday
    let n = 0; while (save.act[dayKey(d)]) { n++; d = dayShift(d, -1); }
    return n;
  }
  function actBestStreak() {
    const keys = Object.keys(save.act).sort(); let best = 0, run = 0, prev = null;
    for (const k of keys) { const d = new Date(k + 'T12:00'); run = prev && dayKey(dayShift(prev, 1)) === k ? run + 1 : 1; best = Math.max(best, run); prev = d; }
    return Math.max(best, save.actBest || 0);
  }
  function actPrune() { const cut = dayKey(dayShift(new Date(), -ACT_KEEP)); for (const k of Object.keys(save.act)) if (k < cut) delete save.act[k]; }
  function actLog(sec, mass) {
    const k = dayKey(new Date()), e = save.act[k];
    if (!e) save.actDays = (save.actDays || 0) + 1;
    save.act[k] = e ? [e[0] + 1, e[1] + Math.round(sec), Math.max(e[2], Math.round(mass))] : [1, Math.round(sec), Math.round(mass)];
    save.actBest = actBestStreak(); actPrune();
  }
  const actLevel = r => !r ? 0 : r <= 2 ? 1 : r <= 5 ? 2 : r <= 10 ? 3 : 4;
  const WD = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'], WD_FULL = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
  const MON = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  const MONG = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
  const wdOf = d => (d.getDay() + 6) % 7;   // Monday = 0
  let actSel = null;
  // the last 30 days as a month calendar: weekday columns, one row per week; lvl(key) → 0…4; own calendar has clickable days
  const ACT_DAYS = 30;
  function actGridHTML(lvl, end, opt = {}) {
    const ek = dayKey(end), first = dayShift(end, -(ACT_DAYS - 1)), fk = dayKey(first), start = dayShift(first, -wdOf(first));
    let cells = '';
    for (let d = start; dayKey(d) <= ek || wdOf(d) !== 0; d = dayShift(d, 1)) {
      const k = dayKey(d), out = k < fk || k > ek, l = out ? 0 : lvl(k), num = d.getDate();
      cells += out ? `<i class="out">${k > ek ? '' : num}</i>` : opt.click ? `<button type="button" class="l${l}${k === ek ? ' today' : ''}${k === opt.sel ? ' sel' : ''}" data-day="${k}" aria-label="${num} ${MONG[d.getMonth()]}: ${opt.label(k)}">${num}</button>` : `<i class="l${l}${k === ek ? ' today' : ''}">${num}</i>`;
    }
    return `<div class="actm"><div class="actm-head">${first.getDate()} ${MONG[first.getMonth()]} — ${end.getDate()} ${MONG[end.getMonth()]}</div>` +
      `<div class="actm-wd">${WD.map(d => `<span>${d}</span>`).join('')}</div><div class="actm-grid">${cells}</div></div>` +
      `<div class="actv-leg"><span>меньше</span>${[0, 1, 2, 3, 4].map(l => `<i class="l${l}"></i>`).join('')}<span>больше</span></div>`;
  }
  const actMonthDays = () => { const now = new Date(); let n = 0; for (let i = 0; i < ACT_DAYS; i++) if (save.act[dayKey(dayShift(now, -i))]) n++; return n; };
  // what other players see: 182 day levels as digits (oldest → the day it was sent) plus the counters
  function actPublic() {
    const now = new Date(); let g = '';
    for (let i = ACT_DAYS - 1; i >= 0; i--) { const e = save.act[dayKey(dayShift(now, -i))]; g += actLevel(e && e[0]); }
    return { g, t: dayKey(now), s: actStreak(), b: actBestStreak() };
  }
  // another player's activity, folded under the card
  function actOtherHTML(a) {
    if (!a || typeof a.g !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(a.t || '')) return '';
    const end = new Date(a.t + 'T12:00'), n = a.g.length, map = {};
    for (let i = 0; i < n; i++) map[dayKey(dayShift(end, -(n - 1 - i)))] = Math.min(4, +a.g[i] || 0);   // older cards may send more days: only the last 30 are drawn
    // a streak counts only if the card was sent today or yesterday
    const fresh = dayKey(new Date()) === a.t || dayKey(dayShift(new Date(), -1)) === a.t, st = fresh ? +a.s || 0 : 0;
    const md = [...a.g.slice(-ACT_DAYS)].filter(c => c !== '0').length;
    return `<details class="pc-actv"><summary>🔥 Активность <small>${st ? `серия ${st} ${plural(st, 'день', 'дня', 'дней')} подряд` : `за месяц: ${md} ${plural(md, 'день', 'дня', 'дней')}`}</small></summary>` +
      `<div class="actv"><div class="actv-kpi"><div class="fire"><b>${st ? '🔥 ' : ''}${st}</b><small>${plural(st, 'день', 'дня', 'дней')} подряд</small></div><div><b>${+a.b || 0}</b><small>лучшая серия</small></div><div><b>${md}<small> / ${ACT_DAYS}</small></b><small>дней за месяц</small></div></div>` +
      actGridHTML(k => map[k] || 0, end) + '</div></details>';
  }
  function renderActivity() {
    const box = $('profAct'); if (!box) return;
    const now = new Date();
    const byWd = [0, 0, 0, 0, 0, 0, 0], cut = dayKey(dayShift(now, -(ACT_DAYS - 1))); Object.entries(save.act).forEach(([k, e]) => { if (k >= cut) byWd[wdOf(new Date(k + 'T12:00'))] += e[0]; });
    const md = actMonthDays(), favWd = byWd.some(Boolean) ? byWd.indexOf(Math.max(...byWd)) : -1, streak = actStreak();
    const sel = actSel && save.act[actSel], sd = actSel && new Date(actSel + 'T12:00');
    box.innerHTML = `<div class="actv-kpi"><div class="fire"><b>${streak ? '🔥 ' : ''}${streak}</b><small>${plural(streak, 'день', 'дня', 'дней')} подряд</small></div><div><b>${actBestStreak()}</b><small>лучшая серия</small></div>` +
      `<div><b>${md}<small> / ${ACT_DAYS}</small></b><small>дней за месяц</small></div><div><b>${favWd < 0 ? '—' : WD[favWd][0].toUpperCase() + WD[favWd][1]}</b><small>любимый день</small></div></div>` +
      actGridHTML(k => actLevel(save.act[k] && save.act[k][0]), now, { click: true, sel: actSel, label: k => { const e = save.act[k]; return e ? `${e[0]} ${plural(e[0], 'раунд', 'раунда', 'раундов')}` : 'не играл'; } }) +
      `<p class="actv-day" aria-live="polite">${sel ? `<b>${sd.getDate()} ${MONG[sd.getMonth()]}, ${WD_FULL[wdOf(sd)]}</b> · ${sel[0]} ${plural(sel[0], 'раунд', 'раунда', 'раундов')} · ${Math.max(1, Math.round(sel[1] / 60))} мин · лучшая масса ${sel[2].toLocaleString('ru-RU')}`
        : actSel ? `<b>${sd.getDate()} ${MONG[sd.getMonth()]}</b> · в этот день ты не играл` : 'Нажми на день — сколько раундов и лучший результат'}</p>` +
      (Object.keys(save.act).length ? '' : '<p class="info-note" style="margin:6px 0 0">Календарь заполняется с этого обновления: каждый сыгранный день подсветится.</p>');
  }
  $('profAct').addEventListener('click', e => { const b = e.target.closest('[data-day]'); if (!b) return; actSel = actSel === b.dataset.day ? null : b.dataset.day; renderActivity(); const nb = $('profAct').querySelector(`[data-day="${b.dataset.day}"]`); if (nb) nb.focus(); });
  // ================= 2.2: season summary =================
  const rcNum = v => Math.max(0, Math.round(+v || 0));
  const rcDur = sec => { const m = Math.round(rcNum(sec) / 60); return m >= 60 ? `${Math.floor(m / 60)} ч${m % 60 ? ` ${m % 60} мин` : ''}` : `${m} мин`; };
  // rc: one summary; prev: the season before (for the arrows); data from another player is checked field by field
  function rcHTML(rc, prev) {
    const id = rcNum(rc.id), r = rcNum(rc.r), w = rcNum(rc.w), lg = Number.isInteger(rc.lg) && rc.lg >= 0 && rc.lg <= 5 ? rc.lg : -1;
    const pl = prev && Number.isInteger(prev.lg) && prev.lg >= 0 && prev.lg <= 5 ? prev.lg : -1;
    const ch = rc.ch && typeof rc.ch === 'object' ? rc.ch : {}, chN = RAR_KEYS.reduce((a, k) => a + rcNum(ch[k]), 0);
    const fav = Array.isArray(rc.fav) && MODES[rc.fav[0]] ? rc.fav : null;
    const delta = (a, b, f = v => v) => prev ? (a > b ? `<span class="rc-up">+${f(a - b)} к прошлому</span>` : a < b ? `<span>−${f(b - a)} к прошлому</span>` : '<span>как в прошлом</span>') : '';
    const dates = id ? `${fmtDate(seasonEnd(id - 1))} — ${fmtDate(seasonEnd(id) - 864e5)}` : '';
    return `<div class="rc"><div class="rc-hd"><b>Итоги сезона ${id}</b><small>${rc.n ? `«${escHtml(String(rc.n).slice(0, 40))}» · ` : ''}${dates}</small></div>` +
      `<div class="rc-big"><div><b>${r.toLocaleString('ru-RU')}</b><small>${plural(r, 'раунд', 'раунда', 'раундов')}</small>${delta(r, rcNum(prev && prev.r))}</div>` +
      `<div><b>${rcDur(rc.t)}</b><small>в игре</small>${delta(rcNum(rc.t), rcNum(prev && prev.t), rcDur)}</div>` +
      `<div><b>${rcNum(rc.m).toLocaleString('ru-RU')}</b><small>лучшая масса</small>${prev && rcNum(rc.m) > rcNum(prev.m) ? '<span class="rc-up">новый рекорд сезона</span>' : ''}</div>` +
      `<div><b>${w.toLocaleString('ru-RU')}</b><small>${plural(w, 'победа', 'победы', 'побед')}</small>${r ? `<span>${Math.round(w / r * 100)}% раундов</span>` : ''}</div></div>` +
      `<div class="rc-two"><div class="rc-bx"><small>Лига</small>${lg < 0 ? '<span class="rc-dim">в рейтинговых боях не участвовал</span>' : `<div class="rc-lg">${pl >= 0 ? `<span>${LG_NAMES[pl]}</span> → ` : ''}<b style="color:${LG_COLS[lg]}">${LG_NAMES[lg]}</b></div><span class="rc-dim">${rcNum(rc.pts).toLocaleString('ru-RU')} очков лиги</span>`}</div>` +
      `<div class="rc-bx"><small>Из сундуков · ${chN}</small>${chN ? `<div class="rc-drops">${RAR_KEYS.slice().reverse().filter(k => rcNum(ch[k])).map(k => `<i style="--c:${RARITY[k].color}">${RARITY[k].name} ×${rcNum(ch[k])}</i>`).join('')}</div>` : '<span class="rc-dim">сундуков не открыто</span>'}</div>` +
      `<div class="rc-bx"><small>Любимый режим</small>${fav ? `<b>${MODES[fav[0]].name} · ${rcNum(fav[1])} ${plural(rcNum(fav[1]), 'раунд', 'раунда', 'раундов')}</b>` : '<span class="rc-dim">—</span>'}</div>` +
      `<div class="rc-bx"><small>Заработано</small><b class="rc-gold">${rcNum(rc.c).toLocaleString('ru-RU')} ◆ · ${rcNum(rc.x).toLocaleString('ru-RU')} опыта</b></div></div></div>`;
  }
  const rcPrev = rc => { const i = save.recaps.indexOf(rc); return i > 0 ? save.recaps[i - 1] : null; };
  let recapCur = null;
  function openRecap(rc) { recapCur = rc; $('recapBody').innerHTML = rcHTML(rc, rcPrev(rc)); $('recapModal').hidden = false; $('recapOk').focus(); }
  function closeRecap() { $('recapModal').hidden = true; if (save.recapShow) { delete save.recapShow; persist(); } }
  $('recapOk').addEventListener('click', closeRecap); $('recapClose').addEventListener('click', closeRecap);
  $('recapModal').addEventListener('click', e => { if (e.target === $('recapModal')) closeRecap(); });
  // the window comes once, after the season ended, when the menu is on screen
  function recapWatch() {
    let n = 0; const t = setInterval(() => {
      if (++n > 120 || !save.recapShow) { clearInterval(t); return; }
      const sp = $('splash'), splashUp = sp && !sp.classList.contains('out') && getComputedStyle(sp).display !== 'none';
      if (splashUp || running || $('menuCard').hidden || [...document.querySelectorAll('.modal')].some(m => !m.hidden)) return;
      const rc = save.recaps.find(x => x.id === save.recapShow); clearInterval(t); if (rc) openRecap(rc); else { delete save.recapShow; persist(); }
    }, 500);
  }
  function renderRecaps() {
    const box = $('profRecaps'); if (!box) return;
    box.innerHTML = save.recaps.length ? `<details open class="res-drawer"><summary>Итоги сезонов <small class="cnt">${save.recaps.length}</small></summary><div class="rc-list">` +
      save.recaps.slice().reverse().map((rc, i) => `<details class="rc-fold"${i ? '' : ' open'}><summary>Сезон ${rcNum(rc.id)} <small>${rcNum(rc.r)} ${plural(rcNum(rc.r), 'раунд', 'раунда', 'раундов')}${rc.lg >= 0 ? ` · ${LG_NAMES[rc.lg]}` : ''}</small></summary>${rcHTML(rc, rcPrev(rc))}</details>`).join('') + '</div></details>'
      : '<p class="info-note" style="margin:0 0 8px">Итоги появятся после первого сыгранного сезона лиги: что сыграно, лучшая масса, лига, сундуки, любимый режим.</p>';
  }
  // what other players see under the card: the last summary, folded
  function rcOtherHTML(rc) {
    if (!rc || typeof rc !== 'object' || !rcNum(rc.id)) return '';
    const lg = Number.isInteger(rc.lg) && rc.lg >= 0 && rc.lg <= 5 ? rc.lg : -1;
    return `<details class="pc-actv pc-rc"><summary>🏆 Итоги сезона ${rcNum(rc.id)} <small>${rcNum(rc.r)} ${plural(rcNum(rc.r), 'раунд', 'раунда', 'раундов')}${lg >= 0 ? ` · ${LG_NAMES[lg]}` : ''}</small></summary>${rcHTML(rc, null)}</details>`;
  }
  // ================= 2.2: share as a picture =================
  // the card and the season summary are drawn on a canvas from the same parts the game uses (background, skin texture, SVG emblems)
  const svgImg = (svg, w, h) => new Promise(res => {
    let t = String(svg); if (!/xmlns=/.test(t)) t = t.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    t = t.replace(/<svg([^>]*?)\swidth="[^"]*"/, '<svg$1').replace(/<svg([^>]*?)\sheight="[^"]*"/, '<svg$1').replace('<svg', `<svg width="${w}" height="${h}"`);
    const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(t);
  });
  const urlImg = src => new Promise(res => { const im = new Image(); im.onload = () => res(im); im.onerror = () => res(null); im.src = src; });
  const rr = (x, X, Y, W, H, R) => { x.beginPath(); x.moveTo(X + R, Y); x.arcTo(X + W, Y, X + W, Y + H, R); x.arcTo(X + W, Y + H, X, Y + H, R); x.arcTo(X, Y + H, X, Y, R); x.arcTo(X, Y, X + W, Y, R); x.closePath(); };
  const FD = '"Russo One", "Arial Black", sans-serif', FB = '"Golos Text", system-ui, sans-serif';
  function fitText(x, t, maxW) { let s = String(t); while (s.length > 1 && x.measureText(s).width > maxW) s = s.slice(0, -2) + '…'; return s; }
  async function drawCard(d, nick) {
    try { await document.fonts.ready; } catch (e) {}
    const W = 1080, H = 640, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
    x.save(); rr(x, 0, 0, W, H, 36); x.clip();
    try { pbgDraw(x, W, H, d.bgf ? pbgKey((pbgById(d.bg) || {}).id, d.bgf) : String(d.bg || '').replace(/_f[123]$/, '') === (pbgById(d.bg) || {}).id ? d.bg : (pbgById(d.bg) || {}).id || 'bg_base', 3.3); } catch (e) { x.fillStyle = '#0b0824'; x.fillRect(0, 0, W, H); }
    const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, 'rgba(5,4,15,.15)'); gr.addColorStop(.55, 'rgba(5,4,15,.35)'); gr.addColorStop(1, 'rgba(5,4,15,.8)'); x.fillStyle = gr; x.fillRect(0, 0, W, H);
    // avatar: skin texture in a circle, eyes, frame ornament, badge
    const k = SKINS.find(s => s.id === d.skin) || SKINS[0], fr = decorById(d.frame), AX = 70, AY = 60, AS = 210;
    x.save(); x.beginPath(); x.arc(AX + AS / 2, AY + AS / 2, AS / 2 - 6, 0, Math.PI * 2); x.closePath(); x.fillStyle = '#05040f'; x.fill(); x.clip();
    let su = null; try { su = swatchUrl(k); } catch (e) {}
    const sk = su && await urlImg(su);
    if (sk) x.drawImage(sk, AX, AY, AS, AS);
    else { const g = x.createRadialGradient(AX + AS * .4, AY + AS * .35, 6, AX + AS / 2, AY + AS / 2, AS / 2); g.addColorStop(0, k.accent || '#ffffff'); g.addColorStop(.35, k.color || '#22e6ff'); g.addColorStop(1, '#0b0624'); x.fillStyle = g; x.fillRect(AX, AY, AS, AS); }
    const sh = x.createRadialGradient(AX + AS * .35, AY + AS * .3, 4, AX + AS / 2, AY + AS / 2, AS / 2); sh.addColorStop(0, 'rgba(255,255,255,.35)'); sh.addColorStop(.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.45)'); x.fillStyle = sh; x.fillRect(AX, AY, AS, AS);
    x.restore();
    [[-1], [1]].forEach(([sx]) => { x.fillStyle = '#fff'; x.beginPath(); x.ellipse(AX + AS / 2 + sx * 24, AY + AS * .44, 13, 17, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = '#0b0624'; x.beginPath(); x.arc(AX + AS / 2 + sx * 24 + 3, AY + AS * .44 + 3, 6, 0, Math.PI * 2); x.fill(); });
    if (fr) { const o = await svgImg(frameOrnSVG(fr), AS * 1.44, AS * 1.44); if (o) x.drawImage(o, AX - AS * .22, AY - AS * .22); }
    else { x.strokeStyle = 'rgba(150,120,255,.6)'; x.lineWidth = 5; x.beginPath(); x.arc(AX + AS / 2, AY + AS / 2, AS / 2 - 3, 0, Math.PI * 2); x.stroke(); }
    if (d.badge) { const b = await svgImg(pbBadgeSVG(d.badge), 92, 92); if (b) x.drawImage(b, AX + AS - 70, AY + AS - 70); }
    // name, title, league
    const TX = 330, TW = 520; x.textBaseline = 'alphabetic';
    x.fillStyle = '#fff'; x.font = `64px ${FD}`; x.shadowColor = 'rgba(0,0,0,.7)'; x.shadowBlur = 16; x.fillText(fitText(x, nick, TW), TX, 128); x.shadowBlur = 0;
    let ty = 150; const td = d.title && decorById(d.title);
    if (td) { x.font = `600 30px ${FB}`; const tw = x.measureText(td.name).width + 44; rr(x, TX, ty, tw, 52, 26); x.fillStyle = 'rgba(10,6,30,.75)'; x.fill(); x.strokeStyle = 'rgba(255,255,255,.2)'; x.lineWidth = 2; x.stroke(); x.fillStyle = td.color || '#ffd23f'; x.fillText(td.name, TX + 22, ty + 36); ty += 70; }
    const li = Math.max(0, Math.min(5, d.league || 0)), le = await svgImg(rankEmblem(li, 44, { still: true }), 44, 44);
    if (le) x.drawImage(le, TX, ty); x.font = `600 30px ${FB}`; x.fillStyle = LG_COLS[li]; x.fillText(LG_NAMES[li], TX + 54, ty + 33);
    // level hexagon with the prestige outline
    const HX = 900, HY = 70, HW = 120, HH = 132, hex = new Path2D(`M${HX + 60} ${HY} L${HX + 114} ${HY + 32} V${HY + 100} L${HX + 60} ${HY + 132} L${HX + 6} ${HY + 100} V${HY + 32} Z`);
    const hg = x.createLinearGradient(HX, HY, HX + HW, HY + HH), st = psStops(d.ps); st.forEach((c, i) => hg.addColorStop(i / Math.max(1, st.length - 1), c));
    x.fillStyle = 'rgba(20,10,50,.82)'; x.fill(hex); x.strokeStyle = hg; x.lineWidth = d.ps ? 7 : 5; x.stroke(hex);
    x.textAlign = 'center'; x.fillStyle = '#cfc9f0'; x.font = `600 17px ${FB}`; x.fillText('УРОВЕНЬ', HX + 60, HY + 52); x.fillStyle = '#fff'; x.font = `56px ${FD}`; x.fillText(String(Math.max(1, Math.min(50, d.lvl || 1))), HX + 60, HY + 108);
    if (d.ps) { const lb = psLabel(d.ps); x.font = `26px ${FD}`; const lw = x.measureText(lb).width + 28; rr(x, HX + 60 - lw / 2, HY - 24, lw, 38, 19); x.fillStyle = '#140c2e'; x.fill(); x.strokeStyle = d.ps.n ? '#ff4fd8' : '#ffd23f'; x.lineWidth = 2.5; x.stroke(); x.fillStyle = d.ps.n ? '#ff8ae6' : '#ffd23f'; x.fillText(lb, HX + 60, HY + 5); }
    x.textAlign = 'left';
    // three numbers
    const stats = [[(d.wins || 0).toLocaleString('ru-RU'), 'побед'], [(d.best || 0).toLocaleString('ru-RU'), 'рекорд «Классики»'], [String(d.ach || 0), 'достижений']];
    let sx = 70; const SY = 320;
    for (const [v, l] of stats) { x.font = `600 22px ${FB}`; const w = Math.max(150, x.measureText(l).width + 40); rr(x, sx, SY, w, 96, 20); x.fillStyle = 'rgba(10,6,30,.66)'; x.fill(); x.strokeStyle = 'rgba(150,120,255,.35)'; x.lineWidth = 2; x.stroke();
      x.fillStyle = '#fff'; x.font = `40px ${FD}`; x.fillText(v, sx + 20, SY + 50); x.fillStyle = '#cfc9f0'; x.font = `22px ${FB}`; x.fillText(l, sx + 20, SY + 80); sx += w + 14; }
    // shelf
    const shelf = (Array.isArray(d.shelf) ? d.shelf : []).map(([id, t]) => [achById(id), t]).filter(([a, t]) => a && t).slice(0, 3);
    if (shelf.length) { const bw = (W - 140 - 2 * 14) / 3; let bx = 70; const BY = 438;
      for (const [a, t] of shelf) { const [ac] = achArtOf(a); rr(x, bx, BY, bw, 104, 22); x.fillStyle = 'rgba(10,6,30,.72)'; x.fill(); x.strokeStyle = ac; x.globalAlpha = .7; x.lineWidth = 2.5; x.stroke(); x.globalAlpha = 1;
        const em = await svgImg(achEmblem(a, Math.min(t, a.steps.length), 80), 80, 80); if (em) x.drawImage(em, bx + 14, BY + 12);
        x.fillStyle = '#fff'; x.font = `28px ${FD}`; x.fillText(fitText(x, a.name, bw - 120), bx + 106, BY + 50); x.fillStyle = '#cfc9f0'; x.font = `22px ${FB}`;
        x.fillText(a.steps.length <= 3 ? `${ROM3[Math.min(t, 3)]} · ${METAL_NAME[achMetal(a, t)]}` : `${t} из ${a.steps.length}`, bx + 106, BY + 82); bx += bw + 14; } }
    // signature
    x.textAlign = 'right'; x.font = `30px ${FD}`; x.fillStyle = '#fff'; x.shadowColor = '#ff4fd8'; x.shadowBlur = 18; x.fillText('Капли 3D', W - 44, H - 34); x.shadowBlur = 0;
    x.font = `20px ${FB}`; x.fillStyle = 'rgba(255,255,255,.6)'; x.fillText(new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }), W - 44, H - 74);
    x.restore();
    x.lineWidth = 4; x.strokeStyle = 'rgba(150,120,255,.6)'; rr(x, 2, 2, W - 4, H - 4, 35); x.stroke();
    return cv;
  }
  async function drawRecap(rc, nick) {
    try { await document.fonts.ready; } catch (e) {}
    const W = 1080, H = 760, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
    x.save(); rr(x, 0, 0, W, H, 36); x.clip();
    const bg = x.createLinearGradient(0, 0, W, H); bg.addColorStop(0, '#1a0b3a'); bg.addColorStop(1, '#07102a'); x.fillStyle = bg; x.fillRect(0, 0, W, H);
    [[W, 0, '#ff4fd8', .45], [0, H, '#22e6ff', .35]].forEach(([cx, cy, c, a]) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, 620); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); x.globalAlpha = a; x.fillStyle = g; x.fillRect(0, 0, W, H); x.globalAlpha = 1; });
    const id = rcNum(rc.id), r = rcNum(rc.r), w = rcNum(rc.w), lg = Number.isInteger(rc.lg) && rc.lg >= 0 && rc.lg <= 5 ? rc.lg : -1;
    x.fillStyle = '#fff'; x.font = `56px ${FD}`; x.fillText(`Итоги сезона ${id}`, 60, 104);
    x.font = `26px ${FB}`; x.fillStyle = '#cfc9f0'; x.fillText(`${nick} · ${rc.n ? `«${String(rc.n).slice(0, 40)}» · ` : ''}${fmtDate(seasonEnd(id - 1))} — ${fmtDate(seasonEnd(id) - 864e5)}`, 60, 148);
    const tiles = [[r.toLocaleString('ru-RU'), plural(r, 'раунд', 'раунда', 'раундов')], [rcDur(rc.t), 'в игре'], [rcNum(rc.m).toLocaleString('ru-RU'), 'лучшая масса'], [w.toLocaleString('ru-RU'), plural(w, 'победа', 'победы', 'побед')]];
    const tw = (W - 120 - 3 * 16) / 4; tiles.forEach(([v, l], i) => { const tx = 60 + i * (tw + 16); rr(x, tx, 190, tw, 150, 24); x.fillStyle = 'rgba(10,6,30,.6)'; x.fill();
      x.fillStyle = '#fff'; x.font = `${v.length > 7 ? 38 : 50}px ${FD}`; x.fillText(v, tx + 24, 272); x.fillStyle = '#cfc9f0'; x.font = `22px ${FB}`; x.fillText(l.toUpperCase(), tx + 24, 312); });
    const fav = Array.isArray(rc.fav) && MODES[rc.fav[0]] ? rc.fav : null, ch = rc.ch || {};
    const boxes = [['ЛИГА', lg < 0 ? 'без рейтинговых боёв' : LG_NAMES[lg], lg < 0 ? '#cfc9f0' : LG_COLS[lg]], ['ЛЮБИМЫЙ РЕЖИМ', fav ? MODES[fav[0]].name : '—', '#fff'],
      ['ИЗ СУНДУКОВ', RAR_KEYS.slice().reverse().filter(k => rcNum(ch[k])).map(k => `${({ legendary: 'лег.', epic: 'эпич.', rare: 'редк.', common: 'обыч.' })[k] || k} ×${rcNum(ch[k])}`).join(' · ') || 'не открывал', '#fff'], ['ЗАРАБОТАНО', `${rcNum(rc.c).toLocaleString('ru-RU')} ◆ · ${rcNum(rc.x).toLocaleString('ru-RU')} опыта`, '#ffd23f']];
    const bw2 = (W - 120 - 16) / 2; boxes.forEach(([l, v, c], i) => { const bx = 60 + (i % 2) * (bw2 + 16), by = 364 + Math.floor(i / 2) * 140; rr(x, bx, by, bw2, 124, 24); x.fillStyle = 'rgba(10,6,30,.6)'; x.fill();
      x.fillStyle = '#cfc9f0'; x.font = `22px ${FB}`; x.fillText(l, bx + 24, by + 44); x.fillStyle = c; x.font = `${i === 0 ? '40px ' + FD : '600 28px ' + FB}`; x.fillText(fitText(x, v, bw2 - 48), bx + 24, by + 92); });
    x.textAlign = 'right'; x.font = `30px ${FD}`; x.fillStyle = '#fff'; x.shadowColor = '#ff4fd8'; x.shadowBlur = 18; x.fillText('Капли 3D', W - 44, H - 34); x.shadowBlur = 0; x.textAlign = 'left';
    x.restore(); x.lineWidth = 4; x.strokeStyle = 'rgba(255,79,216,.6)'; rr(x, 2, 2, W - 4, H - 4, 35); x.stroke();
    return cv;
  }
  let shareBlob = null, shareName = 'kapli3d.png';
  async function openShare(make, name, title) {
    shareBlob = null; shareName = name; $('shareTitle').textContent = title; $('sharePv').innerHTML = '<p class="empty-note">Рисую картинку…</p>'; $('shareModal').hidden = false; $('shareClose').focus();
    $('shareGo').hidden = !(navigator.canShare && navigator.share);
    try { const cv = await make(); shareBlob = await new Promise(r => cv.toBlob(r, 'image/png')); const url = cv.toDataURL('image/png');
      $('sharePv').innerHTML = `<img src="${url}" alt="${escHtml(title)}">`; }
    catch (e) { console.warn('share picture:', e); $('sharePv').innerHTML = '<p class="empty-note">Не получилось нарисовать картинку. Попробуй ещё раз.</p>'; }
  }
  $('shareClose').addEventListener('click', () => { $('shareModal').hidden = true; });
  $('shareModal').addEventListener('click', e => { if (e.target === $('shareModal')) $('shareModal').hidden = true; });
  $('shareGo').addEventListener('click', async () => {
    if (!shareBlob) return; const file = new File([shareBlob], shareName, { type: 'image/png' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title: 'Капли 3D' }); else $('shareNote').textContent = 'Этот браузер не умеет отправлять картинки — сохрани её кнопкой «Сохранить».'; }
    catch (e) { if (e && e.name !== 'AbortError') $('shareNote').textContent = 'Отправить не получилось — сохрани картинку кнопкой «Сохранить».'; }
  });
  $('shareSave').addEventListener('click', () => {
    if (!shareBlob) return; const a = document.createElement('a'); a.href = URL.createObjectURL(shareBlob); a.download = shareName; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); $('shareNote').textContent = 'Картинка сохранена в загрузки. Если ничего не скачалось — нажми на картинку и удерживай.';
  });
  $('profShare').addEventListener('click', () => openShare(() => drawCard(myShowcase(), Net.nick || 'Капля'), 'kapli3d-kartochka.png', 'Поделиться карточкой'));
  $('recapShare').addEventListener('click', () => { const rc = recapCur; if (rc) openShare(() => drawRecap(rc, Net.nick || 'Капля'), `kapli3d-sezon-${rc.id}.png`, 'Поделиться итогами'); });
  // ---------- graphics recovery: the browser may take the GPU away (app in background, low memory) and give it back.
  // In the menu we simply restart with the saved progress; during a round we offer a restart instead of ending it on our own.
  const gfx = { lost: 0 };
  function gfxReload() { try { persist(); } catch (e) {} location.reload(); }
  function gfxWatch(cv) {
    if (!cv || cv.dataset.gfxw) return; cv.dataset.gfxw = 1;
    cv.addEventListener('webglcontextlost', e => { e.preventDefault(); gfx.lost++; }, false);
    cv.addEventListener('webglcontextrestored', () => { if (!running) gfxReload(); else $('gfxBar').hidden = false; }, false);
  }
  gfxWatch(renderer.domElement); gfxWatch($('mbCanvas')); gfxWatch($('imCanvas'));
  let gfxArm = 0;
  $('gfxReload').addEventListener('click', () => {
    if (running && Date.now() - gfxArm > 4000) { gfxArm = Date.now(); $('gfxNote').textContent = 'Идёт раунд — нажми ещё раз, чтобы прервать его и перезагрузить графику'; return; }
    gfxReload();
  });
  $('gfxBarDo').addEventListener('click', gfxReload);
  $('gfxBarX').addEventListener('click', () => { $('gfxBar').hidden = true; });
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
  const STRESS = {
    ladder: { name: 'Лесенка нагрузки', steps: [
      ['5 000 + 2 босса', () => { stressMass(5000); stressBosses(2); }, 0],
      ['25 000 + 3 босса, боты крупнее', () => { stressMass(25000); stressBosses(3); stressBots(3000, 6000); }, 0],
      ['деление на максимум частей', () => { for (let i = 0; i < 8; i++) { player.splitCd = 0; split(); } }, 1],
      ['60 000 + 4 босса', () => { stressMass(60000); stressBosses(4); }, 1],
      ['толпа: все боты 5–9 тыс. + эффекты', () => { stressBots(5000, 9000); stressBosses(4); }, 2],
      ['максимум: 100 000, звездопад, эффекты', () => { stressMass(100000); stressBosses(4); stressEvent('starfall'); }, 2]] },
    storm: { name: 'Шторм эффектов', steps: EVENTS.slice(0, 6).map((e, i) => ['событие «' + e.name + '»', () => { stressMass(Math.max(total(player), 15000)); if (!i) { stressBosses(2); stressBots(2000, 5000); } stressEvent(e.id); }, 2]) }
  };
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
    save.mode = 'classic'; save.char = null; save.settings.autoQ = false; testStartMass = 1000; charChosen = true;
    $('testModal').hidden = true;
    $('startBtn').click();
    if (!running) { stressStop(); stressQueue = null; return 'раунд не начался'; }
    const R0 = stressRun; R0.t0 = performance.now(); R0.last = R0.t0; R0.step = -1; R0.secT = R0.t0; R0.secN = 0; R0.all = []; R0.steps = []; R0.fxT = 0; R0.abT = 0; R0.abI = 0;
    ev.timer = 999;   // no random arena events: the script decides
    requestAnimationFrame(stressFrame);
    return 'идёт ' + sc.name + ' · ' + (QNAME[save.settings.quality] || save.settings.quality) + ' (60 с)';
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
    stressQueue = { list: ['low', 'medium', 'high'].flatMap(q => [['ladder', q], ['storm', q]]), res: [], quality: save.settings.quality };
    stressNext(); return 'полный прогон: 6 тестов по 60 с — телефон не трогай';
  }
  function stressNext() {
    const Q = stressQueue; if (!Q) return;
    const nx = Q.list.shift();
    if (!nx) {
      if (save.settings.quality !== Q.quality) { save.settings.quality = Q.quality; applySettings(); persist(); }
      TLog.begin({ mode: 'stress', name: 'Стресс · сравнение настроек', quality: Q.quality });
      TLog.end({ dur: Q.res.length * 60, end: Q.res.map(r => `${r.name} · ${QNAME[r.quality]}: ${r.avg}/${r.low1}`).join(' · '), cmp: Q.res });
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
    if (!running || dying || paused) { toast('Стресс-тест прерван'); stressQueue = null; stressStop(); return; }
    const el = now - R0.t0, dtm = now - R0.last; R0.last = now;
    if (R0.step >= 0 && dtm > 0) { R0.cur.ms.push(dtm); R0.all.push(dtm); }
    R0.secN++; if (now - R0.secT >= 1000) { const f = Math.round(R0.secN * 1000 / (now - R0.secT)); if (R0.cur) R0.cur.secs.push(f); R0.secs = R0.secs || []; R0.secs.push(f); R0.secN = 0; R0.secT = now; }
    const step = Math.min(R0.sc.steps.length, Math.floor(el / 10000));
    if (step !== R0.step) {
      if (R0.cur) stressClose(R0);
      if (step >= R0.sc.steps.length) { stressFinish(R0); return; }
      R0.step = step; const [label, act, fx] = R0.sc.steps[step];
      R0.cur = { label, fx, ms: [], secs: [] }; try { act(); } catch (e) { R0.cur.err = String(e.message).slice(0, 80); }
      toast(`Стресс · ${QNAME[save.settings.quality] || ''} · ${step + 1}/${R0.sc.steps.length}: ${label}`); TLog.ev('стресс: шаг', label);
    }
    if (R0.cur && !R0.cur.census && el - R0.step * 10000 > 7000) { try { R0.cur.census = drawCensus(); } catch (e) {} }   // what is drawn, late in the step
    effects.shield = Math.max(effects.shield || 0, 1);   // nobody eats the autopilot: the run always lasts 60 s
    // autopilot: circles the arena, so the camera passes everything
    if (player.cells.length) { const m = mainOf(player), a = el / 1000 * .22, tx = Math.cos(a) * R * .38, tz = Math.sin(a) * R * .38, d = hyp(tx - m.x, tz - m.z) || 1;
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
    R0.steps.push({ step: c.label, ...stressSum(c.ms, c.secs), calls: ri.calls, tris: Math.round(ri.triangles / 1000) + 'k', cells: cells.length, mine: player.cells.length,
      bosses: bossOwners.filter(o => o.cells.length).length, mass: Math.round(total(player)), fx: pActive.length + eActive.length, heap: mem ? Math.round(mem.usedJSHeapSize / 1048576) : null, drawn: c.census || null, err: c.err });
    R0.cur = null;
  }
  function stressFinish(R0) {
    const res = { scenario: R0.id, name: R0.name, build: R0.build, quality: save.settings.quality, px: Math.round(renderer.getPixelRatio() * 100) / 100, ...stressSum(R0.all, R0.secs || []), steps: R0.steps };
    TLog.extra('stress', res);
    const worst = R0.steps.reduce((a, b) => (b.avg ?? 99) < (a.avg ?? 99) ? b : a, R0.steps[0] || {});
    const queued = !!stressQueue;
    stressStop(queued);
    TLog.end({ dur: 60, peak: Math.round(stats.maxMass), final: Math.round(total(player)), end: `${res.avg} FPS · мин ${res.min} · 1% ${res.low1}`, st: { avg: res.avg, min: res.min, low1: res.low1, h50: res.h50, h100: res.h100, build: res.build } });
    try { endRound(); } catch (e) {}
    if (queued) { stressQueue.res.push({ name: res.name, quality: res.quality, build: res.build, avg: res.avg, min: res.min, low1: res.low1, h50: res.h50, h100: res.h100, worstStep: worst.step });
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
      <small>${tlDate(r.at)} · ${escHtml(r.dev?.gpu || r.dev?.os || '')} · средний / 1% худших</small><i>${r.cmp.map(c => `${escHtml(c.name.split(' ')[0])} ${QNAME[c.quality] || c.quality}: ${c.avg}/${c.low1}`).join(' · ')}</i></button></li>`;
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
      ${testFilter === 'stress' ? `<div class="tl-stress-run"><p>Игра сама играет 60 с по одному сценарию, графика не меняется во время теста. Сравнивай отчёты разных версий и телефонов.</p>
        <div class="tl-btns two"><button type="button" data-stress="ladder">▶ Лесенка нагрузки<small>масса 5к → 100к, до 4 боссов, деление, толпа</small></button><button type="button" data-stress="storm">▶ Шторм эффектов<small>6 событий, боссы, взрывы, способности</small></button></div>
        <div class="tl-btns one"><button type="button" data-stress="all">▶ Полный прогон: оба теста × Низкое, Среднее, Высокое<small>6 тестов, ~6 мин; в конце — таблица сравнения</small></button></div></div>` : ''}
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
    save.skins = keep(SKINS, save.skins); save.fxOwned = keep(FX, save.fxOwned); save.pets = keep(PETS, save.pets); save.decor = keep(DECOR, save.decor); save.arenas = ARENAS.map(a => a.id); save.hats = Object.keys(HATS);
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
  fixModeForLeague(); mode = save.mode;
  applyPet();
  resetViruses();
  setHoliday(seasonStarted ? holidayOf(seasonNow) : null);
  applySettings();
