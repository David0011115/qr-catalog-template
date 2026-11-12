  // ================= accounts, cloud saves, chat and ranking (Supabase) =================
  // The local save (SAVE_KEY + persist) stays the only game save. The cloud copy in player_saves is
  // synced on top of it: compare-and-swap on updated_at, so an older device never overwrites a newer save.
  {
    const SB_URL = 'https://kprkslsptcnxajdllwje.supabase.co', SB_KEY = 'sb_publishable_C6dIYs3B1t1tkMYl4AgzzA_hVtZLBaj';
    const SB_LIB = 'supabase.js';
    const META_KEY = SAVE_KEY + '-cloud', APP_SAVE_VER = 170;
    const RANK_MODES = ['classic', 'timed', 'survival', 'crown', 'race', 'rbuild', 'hardcore', 'royale'];
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
      return [o.xp || 0, o.coins || 0, T.rounds || 0, T.kills || 0, L(o.skins), L(o.fxOwned), L(o.pets), L(o.decor), L(o.ach), L(o.pbg), (o.season || {}).pts || 0, (o.chaos || {}).pts || 0, o.chests || 0, L(o.special), sh, (o.abil && L(o.abil.owned)) || 0].join('|'); } catch (e) { return ''; } };
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
      sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'kapli3d-auth' } });
      sb.auth.onAuthStateChange((ev, session) => {
        if (ev === 'PASSWORD_RECOVERY') { sess = session; recoverPending = true; if (!splashOn) openAccount('recover'); }
        else if (ev === 'SIGNED_OUT') { sess = null; setUser(null); }
        else if (session) sess = session;
      });
      return sb;
    }
    function setUser(user, nick, publicId) {
      Net.uid = user ? user.id : null; Net.nick = user ? (nick || meta.nick || null) : null;
      Net.shortId = user && publicId != null ? String(publicId).padStart(6, '0') : '';
      Net.email = user ? user.email : '';
      if (user) setTimeout(() => giftCheck(true), 500);
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
      scTimer = setTimeout(async () => { const d = myShowcase(), js = JSON.stringify(d); if (js === scLast) return;
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
        const c = await frRpc('kapli_ping'); const before = FR.counts; FR.counts = c || FR.counts; frBadge();
        if (c.requests > before.requests && $('friendsCard').hidden) toast('👥 Новая заявка в друзья');
        if (c.gifts) await frClaim();
      } catch (e) { if (!netErr(e)) FR.off = true; }   // no server part yet: stay quiet until the next sign-in
    }
    async function frClaim() {
      const got = await frRpc('kapli_gifts_claim'); if (!got || !got.length) return;
      const sum = got.reduce((a, g) => a + g.amount, 0); save.coins += sum; persist(); renderAll();
      toast(got.length === 1 ? `🎁 Подарок от ${got[0].nickname}: +${sum} ◆` : `🎁 Подарки от друзей (${got.length}): +${sum} ◆`);
      FR.counts.gifts = 0;
    }
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
    const themeNames = { cosmos: '🌌 Космос', aurora: '🌠 Аврора', sakura: '🌸 Сакура', drops: '💧 Капли', 'chronos-workshop': '⚙ Мастерская часовщика', 'chronos-city': '🕰 Город башенных часов', 'chronos-heart': '✨ Сердце механизма', default: 'Стандартный фон' };
    const themeFull = $('themeFullPreview'), themeFullScene = $('themeFullScene'), themeFullTitle = $('themeFullTitle');
    const themeFullApply = $('themeFullApply'), themeFullBack = $('themeFullBack'), themeFullBackBottom = $('themeFullBackBottom');
    const THEME_ORDER = ['cosmos', 'aurora', 'sakura', 'drops', ...CHAT_BG.map(b => b.id)];
    const themeLocked = t => CHAT_BG.some(b => b.id === t) && !chatBgOwned(t);
    const flipThemeFull = d => { if (!activeThemePreview) return; const i = THEME_ORDER.indexOf(activeThemePreview.pending); openThemeFullPreview(activeThemePreview, THEME_ORDER[(i + d + THEME_ORDER.length) % THEME_ORDER.length]); };
    $('themeFullPrev').addEventListener('click', () => flipThemeFull(-1));
    $('themeFullNext').addEventListener('click', () => flipThemeFull(1));
    function closeThemeFullPreview() { if (!activeThemePreview) return; themeFull.hidden = true; activeThemePreview = null; }
    function openThemeFullPreview(ctx, theme) {
      activeThemePreview = { ...ctx, pending: theme };
      themeFullScene.dataset.themePreview = theme;
      themeFullTitle.textContent = themeNames[theme] || 'Оформление';
      const i = THEME_ORDER.indexOf(theme); $('themeFullN').textContent = i < 0 ? '' : `${i + 1} / ${THEME_ORDER.length}`;
      themeFullApply.textContent = themeLocked(theme) ? '🔒 Создаётся в мастерской' : 'Применить фон';
      themeFull.hidden = false;
      themeFullApply.focus();
    }
    function commitTheme(ctx, theme) {
      if (themeLocked(theme)) { toast('Этот фон создаётся в мастерской, серия «Хронос»'); return; }   // looking is free, applying needs the crafted scene
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
    $('rankModes').innerHTML = RANK_MODES.map(m => `<button type="button" data-rm="${m}" aria-pressed="false">${MODES[m].name}</button>`).join('');
    async function loadRank(m) {
      rankMode = m; document.querySelectorAll('[data-rm]').forEach(b => b.setAttribute('aria-pressed', b.dataset.rm === m));
      const list = $('rankList'); list.innerHTML = skelHTML(8); $('rankMe').textContent = '';
      try {
        await ensureClient();
        if (sess) await syncBests();
        const { data, error } = await withTimeout(sb.rpc('kapli_leaderboard', { p_mode: m, p_limit: 20 }), 9000); if (error) throw error;
        if (rankMode !== m) return;
        list.innerHTML = data.length ? data.map(r => `<li class="${r.is_me ? 'me' : ''}" data-pc="${escHtml(r.nickname)}" tabindex="0" role="button" aria-label="Профиль игрока ${escHtml(r.nickname)}"><span class="pl">${r.place}</span><span class="rk-who" data-who="${escHtml(r.nickname)}">${whoHTML(r.nickname, r.is_me ? myShowcase() : null)}</span><span class="sc">${fmtBest(m, r.score)}</span></li>`).join('')
          : emptyHTML('В этом режиме пока нет рекордов — стань первым!', 'search');
        decorateWho(list);
        if (!sess) { $('rankMe').textContent = 'Войди в аккаунт, чтобы твои рекорды попали в рейтинг.'; return; }
        const me = await sb.rpc('kapli_my_place', { p_mode: m });
        const row = me.data && me.data[0];
        $('rankMe').textContent = row ? `Твоё место: ${row.place} из ${row.total} · ${fmtBest(m, row.score)}` : 'У тебя пока нет рекорда в этом режиме — сыграй раунд.';
      } catch (e) {
        list.innerHTML = `<p class="empty-note">${netErr(e) ? 'Нет связи с сервером.' : /kapli_|function|PGRST20/i.test(String(e.message || e.code)) ? 'Рейтинг ещё не включён на сервере.' : 'Рейтинг сейчас недоступен.'}</p>`;
      }
    }
    $('rankModes').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) loadRank(b.dataset.rm); });
    $('rankList').addEventListener('click', e => { const li = e.target.closest('[data-pc]'); if (li) openPlayerCard(li.dataset.pc); });
    $('rankList').addEventListener('keydown', e => { const li = e.target.closest('[data-pc]'); if (li && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openPlayerCard(li.dataset.pc); } });
    $('rankBtn').addEventListener('click', () => { showCard('rankCard'); loadRank(RANK_MODES.includes(save.mode) ? save.mode : 'classic'); $('rankBack').focus(); });
    $('rankBack').addEventListener('click', () => { showCard('menuCard'); $('rankBtn').focus(); });

    Object.assign(Net, { boot, submitRecord: (m, v) => { submitRecord(m, v); }, openAccount, pushShowcase, getShowcases, pcSocial, pcSocialClick });
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
    try { pbgDraw(x, W, H, (pbgById(d.bg) || {}).id || 'bg_base', 3.3); } catch (e) { x.fillStyle = '#0b0824'; x.fillRect(0, 0, W, H); }
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
  function testAdd(title, buttons) { TEST_GROUPS.push({ title, buttons }); }
  const xpForPs = (t, n) => XP_AT_MAX + (t === 1 ? n * PS.star : PS.star * PS.max + n * PS.nova) + 1;
  testAdd('Уровень и престиж', [
    ['Ур. 9', () => { save.xp = xpForLevel(9); }], ['Ур. 30', () => { save.xp = xpForLevel(30); }], ['Ур. 50', () => { save.xp = XP_AT_MAX; }],
    ['★5', () => { save.xp = xpForPs(1, 5); }], ['★18', () => { save.xp = xpForPs(1, 18); }], ['★25', () => { save.xp = xpForPs(1, 25); }],
    ['✦10', () => { save.xp = xpForPs(2, 10); }], ['✦25', () => { save.xp = xpForPs(2, 25); }]]);
  testAdd('Всё сразу', [['Открыть всё сразу', () => {
    testUnlockAll(); save.xp = xpForPs(2, 25); save.coins = Math.max(save.coins, 999999);
    save.totals.maxLeague = 5; save.totals.chaosMax = 5; save.totals.chaosGames = Math.max(save.totals.chaosGames || 0, 1);
    MODE_IDS.forEach(id => { save.mastery[id] = Math.max(save.mastery[id] || 0, MASTERY_LV[MASTERY_LV.length - 1].pts); });
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
  testAdd('Итоги сезона', [
    ['Показать пример', () => {
      const id = Math.max(2, save.season.id), base = { n: seasonData(id - 1).name };
      save.recaps = [{ id: id - 1, n: seasonData(id - 1).name, r: 116, t: 31200, m: 2950, w: 24, c: 12400, x: 16800, ch: { common: 4, rare: 2, epic: 1 }, fav: ['classic', 52], lg: 3, pts: 9100 },
        { id, n: seasonData(id).name, r: 148, t: 39600, m: 3812, w: 41, c: 18450, x: 21300, ch: { legendary: 1, epic: 2, rare: 3, common: 3 }, fav: ['crown', 61], lg: 4, pts: 16300 }];
      void base; persist(); openRecap(save.recaps[1]); $('testModal').hidden = true; return 'так окно появится после конца сезона';
    }],
    ['Из моих раундов', () => { const S = save.ss; if (!S || !S.r) return 'сначала сыграй пару раундов';
      const fav = Object.entries(S.md).sort((a, b) => b[1] - a[1])[0]; save.recaps.push({ id: S.id, n: seasonData(S.id).name, r: S.r, t: Math.round(S.t), m: S.m, w: S.w, c: S.c, x: S.x, ch: S.ch, fav: fav || null, lg: save.season.pts > 0 ? leagueOf(save.season.pts) : -1, pts: save.season.pts });
      save.recaps = save.recaps.slice(-6); persist(); openRecap(save.recaps[save.recaps.length - 1]); $('testModal').hidden = true; }],
    ['Очистить', () => { save.recaps = []; delete save.recapShow; }]]);
  testAdd('Календарь активности', [
    ['Заполнить месяц', () => { save.act = {}; let r = 11; const rnd = () => (r = (r * 9301 + 49297) % 233280) / 233280; const now = new Date();
      for (let i = 0; i < 182; i++) { const x = rnd(); if (i > 8 && x < .35) continue; const n = i <= 8 ? 2 + Math.floor(rnd() * 6) : x < .65 ? 1 + Math.floor(rnd() * 2) : x < .85 ? 3 + Math.floor(rnd() * 3) : x < .96 ? 6 + Math.floor(rnd() * 5) : 11 + Math.floor(rnd() * 6);
        save.act[dayKey(dayShift(now, -i))] = [n, n * (150 + Math.floor(rnd() * 120)), 800 + Math.floor(rnd() * 4000)]; }
      save.actDays = Object.keys(save.act).length; save.actBest = 0; save.actBest = actBestStreak(); return 'открой Профиль → Активность'; }],
    ['Серия 30 дней', () => { const now = new Date(); for (let i = 0; i < 30; i++) { const k = dayKey(dayShift(now, -i)); if (!save.act[k]) save.act[k] = [3, 600, 1500]; } save.actBest = actBestStreak(); }],
    ['Очистить', () => { save.act = {}; save.actDays = 0; save.actBest = 0; }]]);
  testAdd('Мастерская', [
    ['Открыть мастерскую', () => { $('testModal').hidden = true; openWorkshop(); return 'открыта'; }],
    ['+5 сундуков осколков', () => { save.shardChests = (save.shardChests || 0) + 5; return 'Сундуки → «Сундук осколков»'; }],
    ['+300 осколков каждой редкости', () => { RAR_KEYS.forEach(k => { save.shards[k] += 300; }); }],
    ['Обнулить осколки', () => { RAR_KEYS.forEach(k => { save.shards[k] = 0; }); }],
    ['Создать всё', () => { WS_CATS.forEach(([cat]) => wsItems(cat).forEach(x => { if (!x.own) x.give(); })); return 'всё есть в коллекции'; }],
    ['Забрать всё созданное', () => { const crIds = new Set(Object.keys(CR_PRICE)); const drop = l => l.filter(id => !crIds.has(id));
      save.skins = drop(save.skins); save.fxOwned = drop(save.fxOwned); save.pets = drop(save.pets); save.decor = drop(save.decor); save.pbg = drop(save.pbg || []); save.abil.owned = drop(save.abil.owned);
      if (crIds.has(save.skin)) { save.skin = 'coral'; refreshSkin(); } ['trail', 'aura', 'eat'].forEach(sl => { if (crIds.has(save.fx[sl])) save.fx[sl] = null; }); applyAura();
      if (crIds.has(save.pet)) { save.pet = null; applyPet(); } if (crIds.has(save.frame)) save.frame = null; if (save.pc && crIds.has(save.pc.bg)) save.pc.bg = 'bg_base'; save.build = save.build.map(id => crIds.has(id) ? null : id); return 'можно создавать заново'; }],
    ...[['Надеть набор 1', 'cr_moon', 'cr_marks', 'cr_foucault', 'cr_freeze', 'cr_p_owl'], ['Надеть набор 2', 'cr_watch', 'cr_cogs', 'cr_cogwings', 'cr_tick', 'cr_p_cuckoo'],
      ['Надеть набор 3', 'cr_spiral', 'cr_marks', 'cr_halo', 'cr_tick', 'cr_p_mouse'], ['Надеть набор 4', 'cr_skeleton', 'cr_cogs', 'cr_halo', 'cr_freeze', 'cr_p_owl'],
      ['Надеть набор 5', 'cr_sandup', 'cr_cogs', 'cr_cogwings', 'cr_tick', 'cr_p_cuckoo'], ['Надеть набор 6', 'cr_engrave', 'cr_marks', 'cr_foucault', 'cr_freeze', 'cr_p_mouse'], ['Надеть набор 7', 'cr_windup', 'cr_cogs', 'cr_halo', 'cr_tick', 'cr_p_owl']]
      .map(([label, sk, tr, au, ea, pet]) => [label, () => { [[save.skins, sk], [save.fxOwned, tr], [save.fxOwned, au], [save.fxOwned, ea], [save.pets, pet]].forEach(([l, id]) => { if (!l.includes(id)) l.push(id); });
        save.skin = sk; save.hat = null; save.fx.trail = tr; save.fx.aura = au; save.fx.eat = ea; save.pet = pet; refreshSkin(); applyPet(); return `${SKINS.find(k => k.id === sk).name} · ${PETS.find(x => x.id === pet).name}`; }]),
    ['Билд: 3 способности Хронос', () => { CR_ABIL.forEach(a => { if (!save.abil.owned.includes(a.id)) save.abil.owned.push(a.id); }); save.build = CR_ABIL.map(a => a.id); return 'Пробел — стена, E — перемотка, Q — рокировка'; }]]);
  testAdd('Эффекты поедания', [
    ['Показать все в раунде', () => { testEatShow = !testEatShow; testEatI = 0; testEatT = 1; return testEatShow ? 'начни раунд: каждые 1,6 с перед каплей сработает следующий эффект' : 'выключено'; }],
    ['Старт: масса 10', () => { testStartMass = 0; }], ['Старт: масса 1 000', () => { testStartMass = 1000; }], ['Старт: масса 5 000', () => { testStartMass = 5000; }], ['Старт: масса 15 000', () => { testStartMass = 15000; }]]);
  testAdd('Бонусы на арене', [['Только «Фонтан», сразу под каплей', () => { testOnlyBonus = 'fountain'; return 'в раунде каждые 9 с «Фонтан» появляется прямо под тобой'; }], ['Все бонусы как обычно', () => { testOnlyBonus = null; }]]);
  testAdd('Сохранение', [['Сбросить тестовое сохранение', () => 'reset', 'warn']]);
  function testRender() {
    $('testGroups').innerHTML = TEST_GROUPS.map((g, gi) => `<div class="test-grp"><small>${g.title}</small><div>${g.buttons.map(([t, , cls], bi) => `<button type="button" data-tb="${gi}:${bi}" class="${cls || ''}">${t}</button>`).join('')}</div></div>`).join('');
  }
  let testResetArm = 0;
  // test build: everything collectable is open (profile backgrounds and badges too)
  function testUnlockAll() {
    save.pbg = [...new Set([...PBG.filter(b => !b.craft).map(b => b.id), ...(save.pbg || [])])]; save.badges = save.badges || {};
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
