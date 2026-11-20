
// Kapli-3D · authenticated Cloudflare Durable Object multiplayer client.
(() => {
  const ROOM_STORAGE_KEY = 'kapli-online-room';
  const API_BASE = 'https://kapli-3d-online-test.mistari501.workers.dev';

  const MODES = {
    territory: 'Захват территории',
    duoback: 'Спина к спине',
  };

  let apiBase = API_BASE;
  let activeMode = null, room = null, role = '', userId = '', socket = null;
  let paused = false, matchStarted = false, leaving = false, connected = false;
  let inputSeq = 0, abilitySeq = 0, boostSeq = 0, actionSeq = 0, reconnectDelay = 1000, reconnectTimer = null;
  let lastModeState = null, lastClock = 0, lastMatchId = null, lastProcessedSeqs = null;

  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
  const modeName = id => MODES[id] || 'Игра вдвоём';

  async function sessionInfo() {
    if (typeof Net === 'undefined' || typeof Net.client !== 'function') throw new Error('Сервис аккаунта не подключён');
    const client = await Net.client();
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    const session = data?.session;
    if (!session?.access_token || !session.user?.id) throw new Error('Сначала войди в аккаунт игры');
    userId = session.user.id;
    return session.access_token;
  }

  async function api(path, method = 'GET', body) {
    const token = await sessionInfo();
    const response = await fetch(apiBase + path, {
      method,
      headers: {
        authorization: 'Bearer ' + token,
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) {
      const messages = {
        unauthorized: data.authReason === 'missing-bearer'
          ? 'Браузер не передал сессию аккаунта. Обнови страницу и войди заново.'
          : data.authReason === 'supabase-unreachable'
            ? 'Не удалось связаться с Supabase для проверки аккаунта.'
            : data.authReason?.startsWith('supabase-rejected-')
              ? `Supabase отклонил сессию (${data.authReason.replace('supabase-rejected-', 'HTTP ')}). Выйди из аккаунта и войди снова.`
              : data.authReason
                ? `Не удалось проверить аккаунт (${data.authReason}).`
                : 'Сессия не найдена. Войди в аккаунт и попробуй снова.',
        'room-not-found': 'Комната не найдена. Проверь код.',
        'room-code-blocked': 'Слишком много неверных кодов. Попробуй через минуту.',
        'room-code-allocation-failed': 'Не удалось создать комнату. Попробуй ещё раз.',
        'privacy-consent-required': 'Для сетевой игры сначала прими Политику конфиденциальности в окне аккаунта.',
      };
      throw new Error(messages[data.error] || data.error || ('Ошибка сервера: ' + response.status));
    }
    return data;
  }

  // 2.7: is the game server there? 'unknown' while checking, 'ok', or 'down' (no answer, an error, or this site not allowed)
  let health = 'unknown', healthAt = 0;
  async function checkHealth(force = false) {
    if (!force && health !== 'unknown' && Date.now() - healthAt < 30000) return health;
    const ctl = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => ctl?.abort(), 6000);
    try {
      const response = await fetch(apiBase + '/health', { cache: 'no-store', signal: ctl?.signal });
      health = response.ok ? 'ok' : 'down';
    } catch { health = 'down'; }
    finally { clearTimeout(timer); healthAt = Date.now(); }
    return health;
  }
  function serverDown() { health = 'down'; healthAt = Date.now(); if (!room) render(); }

  function savedRoom() {
    try {
      const value = JSON.parse(localStorage.getItem(ROOM_STORAGE_KEY) || 'null');
      return value && value.code && value.mode ? value : null;
    } catch { return null; }
  }

  function saveRoom() {
    if (room?.code && activeMode) localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify({
      code: room.code, mode: activeMode, difficultyIndex: room.difficultyIndex || 0,
    }));
  }

  function clearSavedRoom() {
    localStorage.removeItem(ROOM_STORAGE_KEY);
  }

  function render() {
    const body = $('duoBody');
    if (!body || !activeMode) return;

    if (room?.status === 'active' && matchStarted && !paused) {
      if ($('duoCard')) $('duoCard').hidden = true;
      return;
    }

    if (!room) {
      const saved = savedRoom();
      const diffs = DuoM.rules?.duoback?.diffs || [{ name: 'Обычный' }, { name: 'Сложный' }, { name: 'Безумие' }];
      const cur = Math.max(0, Math.min(2, Number(saved?.difficultyIndex ?? save?.duoDiff ?? 0) || 0));
      const resume = saved && saved.mode === activeMode
        ? `<button id="serverReconnect" type="button" class="btn srv-resume">↩ Вернуться в комнату <b>${esc(saved.code)}</b></button>`
        : '';
      // 2.7: the same look as the room for two phones — pills for the difficulty, the game's buttons and code field
      body.innerHTML = resume + `
        <div class="srv-intro"><span class="srv-ic" aria-hidden="true">🌐</span>
          <p>Матч считает сервер игры: честный рейтинг и возврат в комнату, если связь пропала. Нужен аккаунт игры у обоих.</p></div>
        ${activeMode === 'duoback' ? `
          <div class="srv-sec">
            <p class="srv-lbl">Сложность</p>
            <div class="db-diff" role="group" aria-label="Сложность">${diffs.map((d, i) =>
              `<button type="button" class="db-df${i === cur ? ' on' : ''}" data-sdf="${i}" aria-pressed="${i === cur}">${esc(d.name)}</button>`).join('')}</div>
            ${diffs[cur].about ? `<p class="hint srv-about" id="serverDiffAbout">${esc(diffs[cur].about)}</p>` : ''}
            <input type="hidden" id="serverDifficulty" value="${cur}">
          </div>` : ''}
        ${health === 'down' ? `<div class="srv-down" role="status"><b>Сервер игры сейчас не отвечает</b>
          <span>Можно сыграть напрямую между телефонами — такой матч не попадёт в рейтинг. Или попробуй позже.</span>
          <button id="serverDirect" type="button" class="btn ghost">👥 Играть напрямую · без рейтинга</button>
          <button id="serverRetry" type="button" class="link-btn">Проверить сервер ещё раз</button></div>`
          : health === 'unknown' ? '<p class="hint srv-check">Проверяю сервер игры…</p>' : ''}
        <button id="serverCreate" type="button" class="btn">Создать комнату</button>
        <div class="duo-join">
          <input id="serverRoomCode" maxlength="5" inputmode="latin" autocapitalize="characters" autocomplete="off" placeholder="Код" aria-label="Код комнаты">
          <button id="serverJoin" type="button" class="btn ghost">Войти по коду</button>
        </div>
        <p class="hint srv-foot">Первый игрок создаёт комнату и говорит код второму. Матч начнётся, когда оба нажмут «Готов».</p>`;
      return;
    }

    const players = room.players || [];
    const me = players.find(player => player.id === userId);
    role = me?.role || role;

    const statusText = {
      waiting: 'Ждём второго игрока…',
      lobby: 'Оба в комнате — нажмите «Готов»',
      countdown: 'Оба готовы — матч начинается',
      active: matchStarted ? 'Матч идёт' : 'Подключаем матч…',
      paused: 'Пауза: ждём, пока игрок переподключится',
      closed: 'Комната закрыта',
    }[room.status] || 'Комната';

    const seat = player => `
      <li class="srv-pl${player.id === userId ? ' me' : ''}${player.connected === false ? ' off' : ''}">
        <span class="srv-dot" aria-hidden="true"></span>
        <span class="srv-nm"><b>${esc(player.nickname || 'Игрок')}</b><small>${player.role === 'host' ? 'создатель' : 'гость'}${player.id === userId ? ' · ты' : ''}${player.connected === false ? ' · нет связи' : ''}</small></span>
        <span class="srv-rd${player.ready ? ' on' : ''}">${player.ready ? '✓ Готов' : 'Не готов'}</span>
      </li>`;
    const playersHtml = players.map(seat).join('') +
      (players.length < 2 ? '<li class="srv-pl empty"><span class="srv-dot" aria-hidden="true"></span><span class="srv-nm"><b>Свободное место</b><small>второй игрок войдёт по коду</small></span></li>' : '');

    const diffs = DuoM.rules?.duoback?.diffs;
    const di = room.difficultyIndex || 0;
    const countdown = room.status === 'countdown'
      ? `<div class="srv-count" aria-live="polite">${Math.max(0, Math.ceil(((room.countdownEndsAt || Date.now()) - Date.now()) / 1000))}</div>`
      : '';
    const readyButton = ['waiting', 'lobby'].includes(room.status)
      ? `<button id="serverReady" type="button" class="btn${me?.ready ? ' ghost' : ''}">${me?.ready ? 'Снять готовность' : '✓ Готов'}</button>`
      : '';
    const reconnectButton = room.status === 'paused'
      ? '<button id="serverReconnectSocket" type="button" class="btn">Переподключиться</button>'
      : '';

    body.innerHTML = `
      ${room.status === 'waiting' ? '<p class="hint srv-say">Скажи этот код второму игроку:</p>' : ''}
      <div class="duo-code srv-code" aria-label="Код комнаты">${esc(room.code)}</div>
      ${['waiting', 'lobby'].includes(room.status) && players.length < 2 ? `<div class="srv-share"><button id="serverCopyCode" type="button" class="btn ghost">📋 Скопировать код</button><button id="serverShare" type="button" class="btn ghost">🔗 Поделиться ссылкой</button></div>` : ''}
      <p class="srv-status st-${esc(room.status)}" role="status">${esc(statusText)}</p>
      <ul class="srv-pls">${playersHtml}</ul>
      ${activeMode === 'duoback' ? `<p class="srv-diff">Сложность: <b>${esc((diffs?.[di]?.name) || ['Обычный', 'Сложный', 'Безумие'][di])}</b>${diffs?.[di]?.about ? `<small>${esc(diffs[di].about)}</small>` : ''}</p>` : ''}
      ${countdown}${readyButton}${reconnectButton}
      <button id="serverLeave" type="button" class="btn ghost">Выйти из комнаты</button>`;
  }

  function showLobbyCard() {
    if (window.openDuoServerCard) window.openDuoServerCard(activeMode,
      `${esc(modeName(activeMode))} <span class="duo-badge">🌐 серверный онлайн</span>`);
    render();
  }

  function updateRoom(next) {
    if (!next) return;
    room = next;
    if (room.mode) activeMode = room.mode;
    const me = room.players?.find(player => player.id === userId);
    if (me) role = me.role;
    saveRoom();
    if (room.status === 'closed') clearSavedRoom(); else startLobbyPoll();
    render();
  }

  async function createRoom() {
    const difficultyIndex = activeMode === 'duoback' ? Number($('serverDifficulty')?.value || 0) : 0;
    const data = await api('/api/rooms', 'POST', { mode: activeMode, difficultyIndex });
    updateRoom(data.room);
    role = 'host';
    await connectSocket();
  }

  async function joinRoom(code) {
    const normalized = String(code || '').trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{5}$/.test(normalized)) throw new Error('Код должен состоять из пяти символов');
    const data = await api('/api/rooms/' + normalized + '/join', 'POST', {});
    updateRoom(data.room);
    role = 'guest';
    await connectSocket();
  }

  async function reconnectSavedRoom() {
    const saved = savedRoom();
    if (!saved) throw new Error('Сохранённая комната не найдена');
    activeMode = saved.mode;
    const data = await api('/api/rooms/' + saved.code);
    updateRoom(data.room);
    if (!room.players?.some(player => player.id === userId)) throw new Error('Этот аккаунт не состоит в комнате');
    await connectSocket();
  }

  async function connectSocket() {
    if (!room || !apiBase || leaving) return;
    if (socket && socket.readyState <= 1) return;

    const ticketData = await api('/api/rooms/' + room.code + '/socket-ticket', 'POST', {});
    const wsBase = apiBase.replace(/^https:/, 'wss:').replace(/^http:/, 'ws:');
    const ws = new WebSocket(wsBase + '/api/rooms/' + room.code + '/socket?ticket=' + encodeURIComponent(ticketData.ticket));
    socket = ws;

    ws.onopen = () => {
      if (socket !== ws) return;
      connected = true;
      reconnectDelay = 1000;
    };

    ws.onmessage = event => {
      if (socket !== ws) return;
      let message;
      try { message = JSON.parse(event.data); } catch { return; }
      handleMessage(message);
    };

    ws.onerror = () => {
      if (socket === ws) connected = false;
    };

    ws.onclose = event => {
      // The DO closes an older socket after accepting its replacement. Events
      // from that obsolete socket must not pause the new live connection.
      if (socket !== ws) return;
      socket = null;
      connected = false;
      if (TEST_MODE) TLog.ev('сеть: соединение закрыто', event?.code || 0);

      if (event?.code === 4001) {
        if (matchStarted && room) {
          paused = true;
          room.status = 'paused';
          showLobbyCard();
        }
        toast('Подключение открыто в другом окне');
        return;
      }

      if (leaving || !room || room.status === 'closed') return;

      if (matchStarted) {
        paused = true;
        if (room) room.status = 'paused';
        showLobbyCard();
      }

      scheduleReconnect();
    };
  }

  // 2.7: a silent server must never leave a player in a frozen match that still «plays». After 3 s without a
  // snapshot the drop stops guessing its way forward and a sign says so; after 8 s the socket is dropped, which
  // starts the usual pause card and reconnect (and shows the result if the match ended meanwhile).
  let lastSnapAt = 0, stalled = false, watchdog = null, stallLogged = false, pingAt = 0, loggedWave = -1;
  function stallSign(show, seconds) {
    let el = $('srvStall');
    if (!show) { if (el) el.hidden = true; return; }
    if (!el) { el = document.createElement('div'); el.id = 'srvStall'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.hidden = false;
    el.innerHTML = `<b>Нет связи с сервером</b><small>Ждём ответа… ${seconds} с</small>`;
  }
  function checkSilence() {
    if (!matchStarted || !room || room.status !== 'active' || paused) { if (stalled) { stalled = false; stallSign(false); } return; }
    const silent = performance.now() - lastSnapAt;
    stalled = silent > 3000;
    if (TEST_MODE && stalled && !stallLogged) { stallLogged = true; TLog.ev('сеть: тишина сервера 3 с'); } if (!stalled) stallLogged = false;
    if (TEST_MODE && matchStarted && performance.now() - pingAt > 2000) { pingAt = performance.now(); sendMessage({ type: 'ping', sentAt: Date.now() }); }   // test journal: ping every 2 s
    stallSign(stalled, Math.round(silent / 1000));
    if (silent > 8000 && socket) { const old = socket; try { old.close(4000, 'server-silent'); } catch {} }
  }
  function startWatchdog() { lastSnapAt = performance.now(); loggedWave = -1; if (!watchdog) watchdog = setInterval(checkSilence, 500); }
  function stopWatchdog() { if (watchdog) clearInterval(watchdog); watchdog = null; stalled = false; stallSign(false); }

  // 2.7: the lobby must not depend on one WebSocket message. On a phone the socket can die quietly (screen off, network switch),
  // and the creator then kept «Ждём второго игрока…» after the guest had joined. While the lobby is open the room is asked
  // every 2.5 s, a dead socket is reopened, and coming back to the app refreshes at once.
  let lobbyPoll = null, lobbyBusy = false;
  const lobbyKey = r => r ? r.status + '|' + (r.players || []).map(p => p.id + ':' + (p.ready ? 1 : 0) + ':' + (p.connected === false ? 0 : 1)).join(',') : '';
  function lobbyTick() {
    if (!room || leaving || !activeMode || room.status === 'closed') { if (lobbyPoll) { clearInterval(lobbyPoll); lobbyPoll = null; } return; }
    if (matchStarted || document.hidden || lobbyBusy) return;
    if (!socket || socket.readyState > 1) connectSocket().catch(() => {});
    lobbyBusy = true;
    const code = room.code;
    api('/api/rooms/' + code).then(data => {
      if (!data || !data.room || !room || room.code !== code || matchStarted || data.room.status === 'active') return;
      if (lobbyKey(data.room) !== lobbyKey(room)) { if (TEST_MODE) TLog.ev('лобби: обновлено опросом', data.room.status); updateRoom(data.room); }
    }).catch(() => {}).finally(() => { lobbyBusy = false; });
  }
  function startLobbyPoll() { if (!lobbyPoll) lobbyPoll = setInterval(lobbyTick, 2500); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) lobbyTick(); });

  function scheduleReconnect() {
    if (TEST_MODE) TLog.ev('сеть: переподключение');
    if (reconnectTimer || leaving || !room || room.status === 'closed') return;
    const delay = reconnectDelay;
    reconnectDelay = Math.min(8000, reconnectDelay * 2);

    reconnectTimer = setTimeout(async () => {
      reconnectTimer = null;
      try {
        await connectSocket();
      } catch (error) {
        scheduleReconnect();
      }
    }, delay);
  }

  function sendMessage(message) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    try {
      socket.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  function canSendGameplay() {
    return connected && matchStarted && !paused;
  }

  function sendInput(x, z) {
    if (!canSendGameplay()) return false;
    const seq = inputSeq + 1;
    if (!sendMessage({ type: 'input', seq, x, z })) return false;
    inputSeq = seq;
    return true;
  }

  function useAbility(kind, slot) {
    if (!canSendGameplay() || kind !== 'slot' || !Number.isInteger(Number(slot))) return false;
    const seq = abilitySeq + 1;
    if (!sendMessage({ type: 'ability', seq, slot: Number(slot) })) return false;
    abilitySeq = seq;
    return true;
  }

  function useAction(action) {
    if (!canSendGameplay() || !['dash', 'split', 'eject'].includes(action)) return false;
    const seq = actionSeq + 1;
    if (!sendMessage({ type: 'action', seq, action })) return false;
    actionSeq = seq;
    return true;
  }

  function pickBoost(id) {
    if (!canSendGameplay() || typeof id !== 'string') return false;
    const seq = boostSeq + 1;
    if (!sendMessage({ type: 'boost', seq, id })) return false;
    boostSeq = seq;
    return true;
  }

  function applySnapshot(payload, initial = false) {
    if (!payload || !Array.isArray(payload.owners) || typeof DuoM === 'undefined') return;
    const ownerIndices = new Map();
    for (const owner of payload.owners) ownerIndices.set(owner.id, DuoM.serverIndex(owner));

    const rows = [], cellMeta = {};
    const cellsByOwner = new Map();
    for (const cell of payload.cells || []) {
      let ownCells = cellsByOwner.get(cell.ownerId);
      if (!ownCells) cellsByOwner.set(cell.ownerId, ownCells = []);
      ownCells.push(cell);
    }
    for (const owner of payload.owners) {
      const index = ownerIndices.get(owner.id);
      const ownCells = (cellsByOwner.get(owner.id) || [])
        .sort((a, b) => {
          const av = a.slotId ?? a.id, bv = b.slotId ?? b.id;
          const an = Number(av), bn = Number(bv);
          if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
          const as = String(av), bs = String(bv);
          return as < bs ? -1 : as > bs ? 1 : 0;
        });
      const row = [index];
      for (const cell of ownCells) row.push(cell.x, cell.z, cell.mass);
      rows.push(row);
      cellMeta[index] = ownCells.map(cell => ({
        id: cell.id, slotId: cell.slotId, hx: cell.hx, hz: cell.hz, vx: cell.vx, vz: cell.vz,
        mergeT: cell.mergeT, rs: cell.rs, spawnShield: cell.spawnShield, dashT: cell.dashT,
      }));
    }

    const foodItems = initial ? (payload.food || []) : (payload.foodChanges || []);
    const food = [];
    for (const item of foodItems) {
      const match = String(item.id).match(/(\d+)$/);
      const index = Number(match?.[1]);
      if (Number.isInteger(index) && index >= 0) food.push(index, item.x, item.z);
    }

    const viruses = payload.viruses || [];
    const local = payload.owners.find(owner => owner.role === role);
    lastModeState = payload.modeState || lastModeState;
    lastClock = payload.clock || lastClock;

    DuoM.serverApply({
      tm: payload.clock || 0, o: rows, cm: cellMeta, f: food,
      b: Array.isArray(payload.bonuses)
        ? payload.bonuses.flatMap(bonus => [DuoM.serverBonusIndex(bonus.type), bonus.x, bonus.z]) : undefined,
      v: viruses.flatMap(virus => [virus.x, virus.z, virus.mass]),
      vm: viruses, ms: payload.modeState, rt: payload.respawnTimers || {},
      cd: local ? { d: local.dashCd || 0, s: local.splitCd || 0, a: local.abCd || {} } : null,
      ej: payload.ejects || [],
    });
  }

  function startClientMatch(payload) {
    if (!room) return;
    activeMode = payload.mode || activeMode || room.mode;
    const self = payload.owners.find(owner => owner.role === role);
    const peer = payload.owners.find(owner => owner.isPlayer && owner.role !== role);

    if (!DuoM.server) {
      DuoM.serverBegin(role, {
        m: activeMode, diff: room.difficultyIndex || 0, seed: 1,
        build: self?.build || [], name: self?.name || 'Игрок',
        peerName: peer?.name || 'Напарник', peerSkin: peer?.skin || null,
      });
    }

    lastProcessedSeqs = payload.processedSeqs || null;
    inputSeq = payload.inputSeqs?.[userId] || 0;
    abilitySeq = payload.abilitySeqs?.[userId] || 0;
    boostSeq = payload.boostSeqs?.[userId] || 0;
    actionSeq = payload.actionSeqs?.[userId] || 0;
    matchStarted = true;
    paused = room.status === 'paused';
    if (!paused && room.status !== 'active') room.status = 'active';   // 2.7: see «match-started»
    applySnapshot(payload, true);

    if (paused) showLobbyCard();
    else if ($('duoCard')) $('duoCard').hidden = true;
  }

  function endClientMatch(result) {
    paused = false; stopWatchdog();

    if (activeMode === 'territory') {
      const winner = result?.winner || result?.winnerRole || 'draw';
      const share = Number.isFinite(result?.share) ? result.share : 0.5;
      DuoM.serverEnd(winner, share, result?.reason || 'time');
    } else {
      const state = lastModeState || {};
      const waves = result?.won ? 50 : Math.max(0, state.phase === 1 ? state.wave || 0 : (state.wave || 0) - 1);
      DuoM.serverEnd('coop', 0, result?.reason || 'complete', {
        w: waves, t: Math.round(lastClock || 0), b: state.team?.bosses || 0,
        s: state.team?.specials || 0, k: state.team?.bots || 0,
        r: state.team?.respawns || 0, s5: state.team?.specialWave5Time || 0,
        df: state.difficultyIndex || 0, won: !!result?.won,
      });
    }

    matchStarted = false;
    room = null;
    role = '';
    clearSavedRoom();

    if (socket) {
      const old = socket;
      socket = null;
      try { old.close(1000, 'match-ended'); } catch {}
    }
  }

  function handleMessage(message) {
    if (message.type === 'room-state') updateRoom(message.room);
    else if (message.type === 'match-started') {
      lastMatchId = message.matchId;
      matchStarted = true;
      if (room && room.status !== 'paused') room.status = 'active';   // 2.7: it stayed «countdown», so the silence watchdog and the ping never ran
    }
    else if (message.type === 'world-init') { startClientMatch(message); startWatchdog(); }
    else if (message.type === 'snapshot') {
      { const t = performance.now(); if (TEST_MODE && lastSnapAt) TLog.net('gap', t - lastSnapAt, Number.isFinite(message.lag) ? message.lag : undefined); lastSnapAt = t; }
      if (TEST_MODE && message.modeState && activeMode === 'duoback' && message.modeState.wave !== loggedWave) { loggedWave = message.modeState.wave; TLog.ev('волна', loggedWave); }
      lastProcessedSeqs = message.processedSeqs || lastProcessedSeqs;
      lastModeState = message.modeState || lastModeState;
      lastClock = message.clock || lastClock;
      applySnapshot(message, false);
    }
    else if (message.type === 'pong') { if (TEST_MODE && Number.isFinite(message.sentAt)) TLog.net('ping', Date.now() - message.sentAt); }
    else if (message.type === 'match-paused') {
      if (TEST_MODE) TLog.ev('сеть: пауза', message.playerId === userId ? 'я отключился' : 'соперник отключился');
      paused = true;
      if (room) room.status = 'paused';
      showLobbyCard();
    }
    else if (message.type === 'match-resumed') {
      if (TEST_MODE) TLog.ev('сеть: матч продолжен');
      paused = false;
      if (room) room.status = 'active';
      if ($('duoCard')) $('duoCard').hidden = true;
    }
    else if (message.type === 'match-ended') { if (TEST_MODE) TLog.ev('сеть: конец матча', message.result?.reason || ''); endClientMatch(message.result || {}); }
    else if (message.type === 'room-closed') {
      if (room) room.status = 'closed';
      clearSavedRoom();
      render();
    }
    else if (message.type === 'command-rejected') toast('Команда не принята: ' + (message.reason || 'ошибка'));
    else if (message.type === 'match-error') {
      stopWatchdog();
      toast('Сервер остановил матч из-за внутренней ошибки');
      if (room) {
        room.status = 'closed';
        room.closeReason = 'simulation-error';
      }
      clearSavedRoom();
      matchStarted = false;
      paused = false;
      connected = false;
      if (socket) {
        const old = socket;
        socket = null;
        try { old.close(1011, 'simulation-error'); } catch {}
      }
      DuoM.serverAbort?.();
      showLobbyCard();
    }
    else if (message.type === 'error') toast(message.error || 'Ошибка онлайн-соединения');
  }

  async function finishMatch() {
    if (TEST_MODE) TLog.ev('я нажал «Выход»');
    if (!room?.code || !matchStarted || leaving) return;
    const code = room.code;
    try {
      await api('/api/rooms/' + code + '/finish', 'POST', {});
    } catch (error) {
      toast(error?.message || 'Не удалось завершить матч для обоих игроков');
    }
  }

  async function readyToggle() {
    const me = room?.players?.find(player => player.id === userId);
    if (!room || !me) return;
    const data = await api('/api/rooms/' + room.code + '/ready', 'POST', { ready: !me.ready });
    updateRoom(data.room);
  }

  async function leaveRoom(fromBack = false) {
    if (leaving) return;
    leaving = true; stopWatchdog();
    const wasServerMatch = !!DuoM.server;
    const wasActive = !!room && ['active', 'paused'].includes(room.status);

    if (room && room.status !== 'closed') {
      try { await api('/api/rooms/' + room.code + '/leave', 'POST', {}); } catch {}
    }

    if (socket) {
      const old = socket;
      socket = null;
      try { old.close(1000, 'leaving-room'); } catch {}
    }

    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (wasServerMatch) DuoM.serverAbort();
    if (!wasActive) clearSavedRoom();

    room = null;
    role = '';
    connected = false;
    paused = false;
    matchStarted = false;
    activeMode = null;

    if (fromBack && window.closeDuoServerCard) window.closeDuoServerCard();
    leaving = false;
  }

  // 2.7: share the room — the code, or a link that opens the game straight into this room
  const roomLink = () => { const u = new URL(location.href); u.search = ''; u.hash = ''; u.searchParams.set('room', room.code); u.searchParams.set('m', activeMode); return u.toString(); };
  async function copyText(text, done) {
    if (!text) return;
    try { await navigator.clipboard.writeText(text); toast(done); }
    catch { const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select();
      let ok = false; try { ok = document.execCommand('copy'); } catch {} t.remove(); toast(ok ? done : 'Не получилось скопировать — код: ' + text); }
  }
  async function shareRoom() {
    if (!room) return;
    const url = roomLink(), text = `Заходи в «${modeName(activeMode)}» в «Капли 3D»! Код комнаты: ${room.code}`;
    if (navigator.share) { try { await navigator.share({ title: 'Капли 3D', text, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; } }
    copyText(text + '\n' + url, 'Ссылка на комнату скопирована');
  }
  // a link with ?room=CODE&m=mode: open the lobby of that mode and join the room (after the game has started up)
  function joinFromLink() {
    let code = '', mode = '';
    try { const p = new URLSearchParams(location.search); code = (p.get('room') || '').trim().toUpperCase(); mode = p.get('m') || ''; } catch { return; }
    if (!code) return;
    try { const u = new URL(location.href); u.searchParams.delete('room'); u.searchParams.delete('m'); window.history.replaceState(null, '', u.toString()); } catch {}   // window.: the game has its own «history» (the mass graph)
    if (!MODES[mode] || !/^[A-HJ-NP-Z2-9]{5}$/.test(code)) { setTimeout(() => toast('Ссылка на комнату устарела или неверная'), 2500); return; }
    let tries = 0;
    const go = () => {
      if (typeof running !== 'undefined' && running) return;   // a round is on: the link is dropped
      const blocked = document.querySelectorAll('.modal:not([hidden])').length || ($('tour') && !$('tour').hidden);
      if (blocked && tries++ < 40) { setTimeout(go, 1500); return; }
      try { save.mode = mode; persist(); } catch {}
      openLobby(mode);
      const box = $('serverRoomCode'); if (box) box.value = code;
      toast(`Входим в комнату ${code}…`);
      joinRoom(code).catch(error => { try { networkGuard(error); } catch (e) { toast(e?.message || 'Не удалось войти в комнату'); } const b = $('serverRoomCode'); if (b) b.value = code; });
    };
    setTimeout(go, 2500);
  }
  joinFromLink();

  function openLobby(mode) {
    if (!MODES[mode]) return;
    activeMode = mode;
    room = null;
    role = '';
    paused = false;
    matchStarted = false;
    connected = false;
    leaving = false;
    lastModeState = null;
    lastClock = 0;
    lastMatchId = null;
    showLobbyCard();
    checkHealth().then(() => { if (activeMode === mode && !room) render(); });
  }
  // a request that never reached the server (no network, server down, site not allowed) offers the direct match
  function networkGuard(error) {
    if (error instanceof TypeError || /fetch|network|Failed/i.test(error?.message || '')) { serverDown(); throw new Error('Сервер игры не отвечает. Можно сыграть напрямую — без рейтинга.'); }
    throw error;
  }

  const body = $('duoBody');

  if (body) body.addEventListener('click', event => {
    if (!activeMode) return;
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.sdf !== undefined) {   // 2.7: a difficulty pill on the first screen
      event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation();
      const i = Number(button.dataset.sdf) || 0, diffs = DuoM.rules?.duoback?.diffs;
      if ($('serverDifficulty')) $('serverDifficulty').value = String(i);
      save.duoDiff = i; persist();   // remembered for the next room
      body.querySelectorAll('[data-sdf]').forEach(x => { const on = x === button; x.classList.toggle('on', on); x.setAttribute('aria-pressed', on); });
      if ($('serverDiffAbout') && diffs?.[i]?.about) $('serverDiffAbout').textContent = diffs[i].about;
      return;
    }

    const id = button.id;
    const actions = {
      serverCreate: () => createRoom().catch(networkGuard),
      serverCopyCode: () => copyText(room?.code || '', 'Код комнаты скопирован'),
      serverShare: () => shareRoom(),
      serverJoin: () => joinRoom($('serverRoomCode')?.value || '').catch(networkGuard),
      serverDirect: () => { const mode = activeMode; activeMode = null; window.openDuoLobbyDirect?.(mode); },
      serverRetry: () => { health = 'unknown'; render(); return checkHealth(true).then(render); },
      serverReady: () => readyToggle(),
      serverLeave: () => leaveRoom(true),
      serverReconnect: () => reconnectSavedRoom(),
      serverReconnectSocket: () => connectSocket(),
    };

    if (!actions[id]) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    Promise.resolve(actions[id]()).catch(error => toast(error?.message || 'Не удалось выполнить действие'));
  }, true);

  const back = $('duoBack');

  if (back) back.addEventListener('click', event => {
    if (!activeMode) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    leaveRoom(true).catch(error => toast(error?.message || 'Не удалось выйти из комнаты'));
  }, true);

  window.KapliOnlineServer = {
    openLobby, sendInput, useAbility, useAction, pickBoost, finishMatch,
    get paused() { return paused || stalled || !!room && room.status === 'paused'; },
    get active() { return !!activeMode; },
    get room() { return room; },
    get processedSeqs() { return lastProcessedSeqs; },
    get apiBase() { return apiBase; },
  };
})();
