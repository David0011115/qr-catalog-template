
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
        unauthorized: 'Сессия не найдена. Войди в аккаунт и попробуй снова.',
        'room-not-found': 'Комната не найдена. Проверь код.',
        'room-code-blocked': 'Слишком много неверных кодов. Попробуй через минуту.',
        'room-code-allocation-failed': 'Не удалось создать комнату. Попробуй ещё раз.',
        'privacy-consent-required': 'Для сетевой игры сначала прими Политику конфиденциальности в окне аккаунта.',
      };
      throw new Error(messages[data.error] || data.error || ('Ошибка сервера: ' + response.status));
    }
    return data;
  }

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
      const resume = saved && saved.mode === activeMode
        ? `<button id="serverReconnect" type="button" class="duo-action" style="width:100%;margin:0 0 12px">Вернуться в комнату ${esc(saved.code)}</button>`
        : '';

      body.innerHTML = resume + `
        <div class="duo-hint" style="margin:0 0 12px">Серверный онлайн: физика, столкновения и правила матча рассчитываются на сервере. Для входа нужен аккаунт игры.</div>
        ${activeMode === 'duoback' ? `
          <label style="display:block;margin:10px 0 6px">Сложность</label>
          <select id="serverDifficulty" style="width:100%;margin-bottom:12px">
            <option value="0">Обычный</option><option value="1">Сложный</option><option value="2">Безумие</option>
          </select>` : ''}
        <button id="serverCreate" type="button" class="duo-action" style="width:100%;margin-bottom:12px">Создать комнату</button>
        <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px">
          <input id="serverRoomCode" maxlength="5" autocapitalize="characters" autocomplete="off"
            placeholder="Код комнаты" aria-label="Код комнаты" style="min-width:0;text-transform:uppercase">
          <button id="serverJoin" type="button" class="duo-action">Войти</button>
        </div>`;

      if ($('serverDifficulty')) $('serverDifficulty').value = String(saved?.difficultyIndex ?? 0);
      return;
    }

    const players = room.players || [];
    const me = players.find(player => player.id === userId);
    role = me?.role || role;

    const statusText = {
      waiting: 'Ожидаем второго игрока',
      lobby: 'Оба игрока в комнате. Нажмите «Готов».',
      countdown: 'Оба игрока готовы. Матч скоро начнётся.',
      active: matchStarted ? 'Матч запущен' : 'Подключаем матч…',
      paused: 'Матч приостановлен. Ожидаем переподключение игрока.',
      closed: 'Комната закрыта',
    }[room.status] || 'Комната';

    const playersHtml = players.map(player => `
      <div style="display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid #ffffff18">
        <span>${esc(player.nickname || 'Игрок')} · ${player.role === 'host' ? 'создатель' : 'гость'}</span>
        <b>${player.ready ? 'Готов' : 'Не готов'} ${player.connected ? '' : '· нет связи'}</b>
      </div>`).join('');

    const countdown = room.status === 'countdown'
      ? `<div style="font-size:26px;font-weight:800;text-align:center;margin:12px 0">${Math.max(0, Math.ceil(((room.countdownEndsAt || Date.now()) - Date.now()) / 1000))}</div>`
      : '';

    const readyButton = ['waiting', 'lobby'].includes(room.status)
      ? `<button id="serverReady" type="button" class="duo-action" style="width:100%;margin:12px 0">${me?.ready ? 'Снять готовность' : 'Готов'}</button>`
      : '';

    const reconnectButton = room.status === 'paused'
      ? `<button id="serverReconnectSocket" type="button" class="duo-action" style="width:100%;margin:12px 0">Переподключиться</button>`
      : '';

    body.innerHTML = `
      <div style="text-align:center;margin:4px 0 14px">
        <div class="duo-hint">Код комнаты</div>
        <div style="font-size:32px;letter-spacing:7px;font-weight:900">${esc(room.code)}</div>
        <div class="duo-hint">${esc(statusText)}</div>
      </div>
      <div>${playersHtml}</div>
      ${activeMode === 'duoback' ? `<p class="duo-hint">Сложность: ${['Обычный', 'Сложный', 'Безумие'][room.difficultyIndex || 0]}</p>` : ''}
      ${countdown}${readyButton}${reconnectButton}
      <button id="serverLeave" type="button" class="duo-action" style="width:100%;opacity:.8">Выйти из комнаты</button>`;
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
    if (room.status === 'closed') clearSavedRoom();
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

  function scheduleReconnect() {
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

  function sendInput(x, z) {
    if (!connected) return false;
    const seq = inputSeq + 1;
    if (!sendMessage({ type: 'input', seq, x, z })) return false;
    inputSeq = seq;
    return true;
  }

  function useAbility(kind, slot) {
    if (!connected || kind !== 'slot' || !Number.isInteger(Number(slot))) return false;
    const seq = abilitySeq + 1;
    if (!sendMessage({ type: 'ability', seq, slot: Number(slot) })) return false;
    abilitySeq = seq;
    return true;
  }

  function useAction(action) {
    if (!connected || !['dash', 'split', 'eject'].includes(action)) return false;
    const seq = actionSeq + 1;
    if (!sendMessage({ type: 'action', seq, action })) return false;
    actionSeq = seq;
    return true;
  }

  function pickBoost(id) {
    if (!connected || typeof id !== 'string') return false;
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
    for (const owner of payload.owners) {
      const index = ownerIndices.get(owner.id);
      const ownCells = (payload.cells || []).filter(cell => cell.ownerId === owner.id)
        .sort((a, b) => String(a.slotId ?? a.id).localeCompare(String(b.slotId ?? b.id), undefined, { numeric: true }));
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
    applySnapshot(payload, true);

    if (paused) showLobbyCard();
    else if ($('duoCard')) $('duoCard').hidden = true;
  }

  function endClientMatch(result) {
    paused = false;

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
    }
    else if (message.type === 'world-init') startClientMatch(message);
    else if (message.type === 'snapshot') {
      lastProcessedSeqs = message.processedSeqs || lastProcessedSeqs;
      lastModeState = message.modeState || lastModeState;
      lastClock = message.clock || lastClock;
      applySnapshot(message, false);
    }
    else if (message.type === 'match-paused') {
      paused = true;
      if (room) room.status = 'paused';
      showLobbyCard();
    }
    else if (message.type === 'match-resumed') {
      paused = false;
      if (room) room.status = 'active';
      if ($('duoCard')) $('duoCard').hidden = true;
    }
    else if (message.type === 'match-ended') endClientMatch(message.result || {});
    else if (message.type === 'room-closed') {
      if (room) room.status = 'closed';
      clearSavedRoom();
      render();
    }
    else if (message.type === 'command-rejected') toast('Команда не принята: ' + (message.reason || 'ошибка'));
    else if (message.type === 'match-error') {
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

  async function readyToggle() {
    const me = room?.players?.find(player => player.id === userId);
    if (!room || !me) return;
    const data = await api('/api/rooms/' + room.code + '/ready', 'POST', { ready: !me.ready });
    updateRoom(data.room);
  }

  async function leaveRoom(fromBack = false) {
    if (leaving) return;
    leaving = true;
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
  }

  const body = $('duoBody');

  if (body) body.addEventListener('click', event => {
    if (!activeMode) return;
    const button = event.target.closest('button');
    if (!button) return;

    const id = button.id;
    const actions = {
      serverCreate: () => createRoom(),
      serverJoin: () => joinRoom($('serverRoomCode')?.value || ''),
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
    openLobby, sendInput, useAbility, useAction, pickBoost,
    get paused() { return paused || !!room && room.status === 'paused'; },
    get active() { return !!activeMode; },
    get room() { return room; },
    get processedSeqs() { return lastProcessedSeqs; },
    get apiBase() { return apiBase; },
  };
})();
