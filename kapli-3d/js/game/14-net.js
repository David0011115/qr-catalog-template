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
    function linkTo(uid, cloudAt, hash) { meta.uid = uid; meta.cloudAt = cloudAt; meta.hash = hash || null; saveMeta(); }
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
      const mine = meta.uid === uid, dirty = mine && lh !== meta.hash;
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
        meta.cloudAt = data[0].updated_at; meta.hash = h; saveMeta(); retryMs = 0; setSync('ok');
      } catch (e) {
        setSync('err'); retryMs = Math.min(300000, retryMs ? retryMs * 2 : 20000); schedulePush(retryMs);
      } finally { pushing = false; }
      if (hashStr(localJson()) !== meta.hash && canPush && sync === 'ok') schedulePush(4000);
    }
    persistHook = () => { if (sess && canPush) { if (sync !== 'busy') setSync('pending'); schedulePush(8000); } };
    document.addEventListener('visibilitychange', () => { if (document.hidden && sess && canPush) pushNow(); });
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
    async function frRpc(fn, args) { await ensureClient(); const { data, error } = await withTimeout(sb.rpc(fn, args || {}), 9000); if (error) throw error; return data; }
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
      if (!sess) return;
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
      const on = !!sess; $('frIn').disabled = $('frAddBtn').disabled = !on;
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
      if (!sess) { toast('Войди в аккаунт'); return null; }
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
      if (!sess || !nick || nick === Net.nick) { box.innerHTML = sess || nick === Net.nick ? '' : '<p class="info-note">Войди в аккаунт, чтобы добавлять в друзья и писать.</p>'; return; }
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
    function readChatTheme(key) { let t='default'; try { t=localStorage.getItem(key)||'default'; } catch(e) {} return ['default','cosmos','aurora','sakura','drops'].includes(t)?t:'default'; }
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
    const themeNames = { cosmos: '🌌 Космос', aurora: '🌠 Аврора', sakura: '🌸 Сакура', drops: '💧 Капли', default: 'Стандартный фон' };
    const themeFull = $('themeFullPreview'), themeFullScene = $('themeFullScene'), themeFullTitle = $('themeFullTitle');
    const themeFullApply = $('themeFullApply'), themeFullBack = $('themeFullBack'), themeFullBackBottom = $('themeFullBackBottom');
    const THEME_ORDER = ['cosmos', 'aurora', 'sakura', 'drops'];
    const flipThemeFull = d => { if (!activeThemePreview) return; const i = THEME_ORDER.indexOf(activeThemePreview.pending); openThemeFullPreview(activeThemePreview, THEME_ORDER[(i + d + THEME_ORDER.length) % THEME_ORDER.length]); };
    $('themeFullPrev').addEventListener('click', () => flipThemeFull(-1));
    $('themeFullNext').addEventListener('click', () => flipThemeFull(1));
    function closeThemeFullPreview() { if (!activeThemePreview) return; themeFull.hidden = true; activeThemePreview = null; }
    function openThemeFullPreview(ctx, theme) {
      activeThemePreview = { ...ctx, pending: theme };
      themeFullScene.dataset.themePreview = theme;
      themeFullTitle.textContent = themeNames[theme] || 'Оформление';
      const i = THEME_ORDER.indexOf(theme); $('themeFullN').textContent = i < 0 ? '' : `${i + 1} / ${THEME_ORDER.length}`;
      themeFull.hidden = false;
      themeFullApply.focus();
    }
    function commitTheme(ctx, theme) {
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
      const open=()=>{ctx.saved=readChatTheme(keyFn());ctx.pending=ctx.saved;paintChatTheme(cardId,ctx.pending);mark();panel.hidden=false;gear.setAttribute('aria-expanded','true');};
      gear.setAttribute('aria-expanded','false');gear.addEventListener('click',()=>panel.hidden?open():dismiss(true));
      close.addEventListener('click',()=>dismiss(true));
      choices.forEach(b=>b.addEventListener('click',()=>{ctx.pending=b.dataset.themeChoice;paintChatTheme(cardId,ctx.pending);mark();}));
      panel.querySelectorAll('[data-theme-eye]').forEach(b=>b.addEventListener('click',()=>openThemeFullPreview(ctx,b.dataset.themeEye)));
      reset.addEventListener('click',()=>{ctx.pending='default';paintChatTheme(cardId,ctx.pending);mark();});
      apply.addEventListener('click',()=>commitTheme(ctx,ctx.pending));
    }
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
  if (TEST_MODE) { $('testBadge').hidden = false; document.querySelector('#menuCard h1').innerHTML += ' <em class="test-badge">ТЕСТ</em>'; }
  fixModeForLeague(); mode = save.mode;
  applyPet();
  resetViruses();
  setHoliday(seasonStarted ? holidayOf(seasonNow) : null);
  applySettings();
