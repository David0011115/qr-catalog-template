import {
  createRoomState, joinRoom, setPlayerReady, tickRoom, leaveRoom,
  recordInvalidRoomCode, roomSummary, restoreRoomState, reconnectRoomPlayer,
} from '../../room/lifecycle.js';
import {
  tickMatchLifecycle,
} from '../../match/lifecycle.js';
import {
  createDuoMatchRuntime, restoreDuoMatchRuntime,
} from '../../match/runtime.js';
import { parseClientMessage, normalizeRoomCode, parseMode, sanitizeNickname } from '../protocol.js';
import { persistMatchResult } from '../../supabase/results.js';

const TICK_RATE = 30;
const TICK_MS = 1000 / TICK_RATE;
const SNAPSHOT_RATE = 15;
const PERSIST_INTERVAL_MS = 5000;
const RESULT_RETRY_MS = 60000;

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
});
const playerFor = (room, id) => room?.players.find(player => player.id === id) || null;
const totalMass = owner => owner.cells.reduce((sum, cell) => sum + cell.mass, 0);

function ownerSummary(owner) {
  return {
    id: owner.id, name: owner.name, kind: owner.kind, role: owner.role || null,
    team: owner.team || null, isPlayer: !!owner.isPlayer,
    homeSide: owner.homeSide || 0, mass: totalMass(owner),
    cellCount: owner.cells.length, build: owner.build || [],
    connected: owner.connected !== false,
  };
}

function cellSnapshot(cell) {
  return {
    id: cell.id, ownerId: cell.owner.id, x: cell.x, z: cell.z, mass: cell.mass,
    hx: cell.hx || 0, hz: cell.hz || 0, vx: cell.vx || 0, vz: cell.vz || 0,
    mergeT: cell.mergeT || 0, rs: cell.owner.rs || 1, gone: !!cell.gone,
    spawnShield: cell.owner.spawnSh || 0, dashT: cell.owner.dashT || 0,
  };
}

function hex(bytes) {
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function hashTicket(ticket) {
  return hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ticket)));
}

export class GameRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.room = null;
    this.runtime = null;
    this.seed = null;
    this.loopTimer = null;
    this.nextTickAt = 0;
    this.lastPersistAt = 0;
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS room_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        payload TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS event_log (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS snapshots (
        sequence INTEGER PRIMARY KEY,
        payload TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS socket_tickets (
        ticket_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);
    ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS invalid_attempts (
        user_id TEXT PRIMARY KEY,
        count INTEGER NOT NULL,
        blocked_until INTEGER NOT NULL
      )
    `);
    this.ready = ctx.blockConcurrencyWhile(async () => this.load());
  }

  sql(query, ...values) { return this.ctx.storage.sql.exec(query, ...values); }

  async load() {
    const latest = this.sql('SELECT sequence, payload FROM snapshots ORDER BY sequence DESC LIMIT 1').toArray()[0];
    let sequence = 0;
    let payload = null;
    if (latest) {
      sequence = Number(latest.sequence);
      payload = JSON.parse(latest.payload);
    } else {
      const row = this.sql('SELECT payload FROM room_state WHERE id = 1').toArray()[0];
      if (row) payload = JSON.parse(row.payload);
    }
    if (payload) this.restorePayload(payload);
    if (this.runtime && latest) {
      const events = this.sql(
        'SELECT sequence, type, payload FROM event_log WHERE sequence > ? ORDER BY sequence ASC',
        sequence,
      ).toArray();
      for (const event of events) {
        const item = JSON.parse(event.payload);
        if (event.type === 'input-command') this.runtime.submitInput(item.playerId, item.command);
        if (event.type === 'ability-command') this.runtime.submitAbility(item.playerId, item.command);
      }
    }
    this.lastPersistAt = Date.now();
    if (this.room?.status === 'paused' && this.runtime) await this.scheduleReconnectAlarm();
    if (this.room?.status === 'closed' && this.runtime?.lifecycle.status === 'finished' && !this.room.resultPersistence) {
      await this.ctx.storage.setAlarm(Date.now() + RESULT_RETRY_MS);
      this.room.resultPersistence = { status: 'pending', reason: 'recovery-retry' };
    }
  }

  restorePayload(payload) {
    this.room = payload.room ? restoreRoomState(payload.room) : null;
    this.runtime = payload.match ? restoreDuoMatchRuntime(payload.match, {
      resolveDisconnect: this.resolveDisconnect.bind(this),
    }) : null;
    this.seed = payload.seed ?? null;
  }

  exportPayload() {
    return {
      room: this.room,
      match: this.runtime ? this.runtime.serialize() : null,
      seed: this.seed,
    };
  }

  async writeSnapshot() {
    const sequenceRow = this.sql('SELECT COALESCE(MAX(sequence), 0) AS sequence FROM event_log').toArray()[0];
    const sequence = Number(sequenceRow?.sequence || 0);
    const now = Date.now();
    const payload = JSON.stringify(this.exportPayload());
    this.sql(
      'INSERT INTO snapshots(sequence, payload, created_at) VALUES(?, ?, ?) ON CONFLICT(sequence) DO UPDATE SET payload = excluded.payload, created_at = excluded.created_at',
      sequence, payload, now,
    );
    this.sql(
      'INSERT INTO room_state(id, payload, updated_at) VALUES(1, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at',
      payload, now,
    );
    const keep = this.sql('SELECT sequence FROM snapshots ORDER BY sequence DESC LIMIT 2').toArray();
    if (keep.length === 2) {
      const oldestKept = Number(keep[1].sequence);
      this.sql('DELETE FROM event_log WHERE sequence <= ?', oldestKept);
      this.sql('DELETE FROM snapshots WHERE sequence < ?', oldestKept);
    }
    this.lastPersistAt = now;
  }

  async appendEvent(type, payload = {}, critical = false) {
    const now = Date.now();
    this.sql('INSERT INTO event_log(type, payload, created_at) VALUES(?, ?, ?)', type, JSON.stringify(payload), now);
    if (critical) await this.writeSnapshot();
  }

  roomView() {
    if (!this.room) return null;
    return {
      ...roomSummary(this.room),
      mode: this.room.mode,
      difficultyIndex: this.room.difficultyIndex,
      players: this.room.players.map(player => ({
        id: player.id, role: player.role, nickname: player.nickname || 'Игрок',
        ready: player.ready, connected: player.connected,
      })),
    };
  }

  requireRoomPlayer(userId) {
    if (!this.room) return null;
    return playerFor(this.room, userId);
  }

  async fetch(request) {
    await this.ready;
    if (this.runtime?.lifecycle.status === 'active' && this.room?.status === 'active') this.startLoop();
    const url = new URL(request.url);
    if (url.pathname.endsWith('/socket') && request.method === 'GET') return this.openSocket(request);
    if (!url.pathname.startsWith('/internal/')) return json({ error: 'not-found' }, 404);
    const userId = request.headers.get('x-kapli-user-id');
    const nickname = sanitizeNickname(request.headers.get('x-kapli-user-nickname'));
    const body = request.method === 'GET' ? {} : await this.readJson(request);
    if (request.method !== 'GET' && !body) return json({ error: 'invalid-json' }, 400);

    if (url.pathname === '/internal/create' && request.method === 'POST') return this.createRoom(userId, nickname, body);
    if (url.pathname === '/internal/join' && request.method === 'POST') return this.join(userId, nickname);
    if (url.pathname === '/internal/state' && request.method === 'GET') {
      if (!this.requireRoomPlayer(userId)) return json({ error: 'room-not-found' }, 404);
      return json({ room: this.roomView() });
    }
    if (url.pathname === '/internal/ready' && request.method === 'POST') return this.readyPlayer(userId, body.ready);
    if (url.pathname === '/internal/leave' && request.method === 'POST') return this.leavePlayer(userId);
    if (url.pathname === '/internal/ticket' && request.method === 'POST') return this.issueTicket(userId);
    return json({ error: 'not-found' }, 404);
  }

  async readJson(request) {
    const length = Number(request.headers.get('content-length') || 0);
    if (length > 4096) return null;
    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > 4096) return null;
    try {
      const value = JSON.parse(text);
      return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
    } catch { return null; }
  }

  async createRoom(userId, nickname, body) {
    if (!userId) return json({ error: 'unauthorized' }, 401);
    const code = normalizeRoomCode(body.code);
    const mode = parseMode(body.mode);
    const difficultyIndex = body.difficultyIndex ?? 0;
    if (!code || !mode || !Number.isInteger(difficultyIndex) || difficultyIndex < 0 || difficultyIndex > 2) {
      return json({ error: 'invalid-room-options' }, 400);
    }
    if (this.room) return json({ error: 'room-code-already-used' }, 409);
    this.room = createRoomState({ roomId: crypto.randomUUID(), code, hostId: userId, now: Date.now() });
    this.room.players[0].nickname = nickname;
    this.room.mode = mode;
    this.room.difficultyIndex = difficultyIndex;
    this.seed = null;
    await this.appendEvent('room-created', { roomId: this.room.roomId, hostId: userId, mode }, true);
    await this.ctx.storage.setAlarm(this.room.waitingDeadlineAt);
    return json({ room: this.roomView() }, 201);
  }

  async recordInvalidAttempt(userId) {
    const row = this.sql('SELECT count, blocked_until FROM invalid_attempts WHERE user_id = ?', userId).toArray()[0];
    const attempts = { [userId]: row ? { count: Number(row.count), blockedUntil: Number(row.blocked_until) } : { count: 0, blockedUntil: 0 } };
    const result = recordInvalidRoomCode(attempts, userId, Date.now());
    const next = attempts[userId];
    this.sql(
      'INSERT INTO invalid_attempts(user_id, count, blocked_until) VALUES(?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET count = excluded.count, blocked_until = excluded.blocked_until',
      userId, next.count, next.blockedUntil,
    );
    return result;
  }

  async join(userId, nickname) {
    if (!userId) return json({ error: 'unauthorized' }, 401);
    if (!this.room) {
      const attempt = await this.recordInvalidAttempt(userId);
      return json({ error: attempt.blocked ? 'room-code-blocked' : 'room-not-found', ...attempt }, attempt.blocked ? 429 : 404);
    }
    const result = joinRoom(this.room, userId, Date.now());
    if (!result.ok) return json({ error: result.reason }, 409);
    const player = playerFor(this.room, userId);
    player.nickname = nickname;
    this.sql('DELETE FROM invalid_attempts WHERE user_id = ?', userId);
    await this.ctx.storage.deleteAlarm();
    await this.appendEvent('player-joined', { playerId: userId, role: 'guest' }, true);
    this.broadcast({ type: 'room-state', room: this.roomView() });
    return json({ room: this.roomView() }, 200);
  }

  async readyPlayer(userId, ready) {
    if (typeof ready !== 'boolean' || !this.requireRoomPlayer(userId)) return json({ error: 'room-or-player-not-found' }, 404);
    const result = setPlayerReady(this.room, userId, ready, Date.now());
    if (!result.ok) return json({ error: result.reason }, 409);
    await this.appendEvent('player-ready', { playerId: userId, ready, result }, true);
    if (result.countdownStarted) await this.ctx.storage.setAlarm(result.startsAt);
    else if (result.countdownCancelled) await this.ctx.storage.deleteAlarm();
    this.broadcast({ type: 'room-state', room: this.roomView(), event: result });
    return json({ room: this.roomView(), event: result });
  }

  async leavePlayer(userId) {
    if (!this.requireRoomPlayer(userId)) return json({ error: 'room-or-player-not-found' }, 404);
    const result = leaveRoom(this.room, userId, Date.now());
    if (result.action === 'match-disconnect') {
      await this.pauseForDisconnect(userId);
    } else {
      await this.appendEvent('player-left', { playerId: userId, result }, true);
      if (this.room.status === 'waiting' && this.room.waitingDeadlineAt) await this.ctx.storage.setAlarm(this.room.waitingDeadlineAt);
      else await this.ctx.storage.deleteAlarm();
    }
    this.broadcast({ type: 'room-state', room: this.roomView(), event: result });
    return json({ room: this.roomView(), event: result });
  }

  async issueTicket(userId) {
    if (!this.requireRoomPlayer(userId)) return json({ error: 'room-or-player-not-found' }, 404);
    const ticket = hex(crypto.getRandomValues(new Uint8Array(32)));
    const ticketHash = await hashTicket(ticket);
    const expiresAt = Date.now() + 30000;
    this.sql('INSERT INTO socket_tickets(ticket_hash, user_id, expires_at) VALUES(?, ?, ?)', ticketHash, userId, expiresAt);
    return json({ ticket, expiresAt });
  }

  async consumeTicket(ticket) {
    if (typeof ticket !== 'string' || ticket.length !== 64) return null;
    const ticketHash = await hashTicket(ticket);
    const row = this.sql('SELECT user_id, expires_at FROM socket_tickets WHERE ticket_hash = ?', ticketHash).toArray()[0];
    this.sql('DELETE FROM socket_tickets WHERE ticket_hash = ?', ticketHash);
    if (!row || Number(row.expires_at) <= Date.now()) return null;
    return row.user_id;
  }

  async openSocket(request) {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'websocket-upgrade-required' }, 400);
    const url = new URL(request.url);
    const userId = await this.consumeTicket(url.searchParams.get('ticket'));
    const player = this.requireRoomPlayer(userId);
    if (!userId || !player || this.room.status === 'closed') return json({ error: 'invalid-or-expired-ticket' }, 401);

    for (const socket of this.ctx.getWebSockets()) {
      const attachment = socket.deserializeAttachment();
      if (attachment?.userId === userId) {
        try { socket.close(4001, 'replaced-by-new-connection'); } catch {}
      }
    }

    if (this.runtime?.lifecycle.status === 'paused' && !player.connected) {
      const resumed = this.runtime.reconnect(userId, Date.now());
      if (resumed.ok) reconnectRoomPlayer(this.room, userId);
      else if (resumed.reason !== 'match-not-paused') return json({ error: resumed.reason }, 409);
    }
    player.connected = true;
    if (this.room.status === 'paused' && this.room.players.every(item => item.connected)) this.room.status = 'active';

    const pair = new WebSocketPair();
    const client = pair[0], server = pair[1];
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ userId });
    server.send(JSON.stringify({ type: 'room-state', room: this.roomView() }));
    if (this.runtime) server.send(JSON.stringify(this.worldInitMessage()));
    await this.appendEvent('socket-connected', { playerId: userId }, true);
    if (this.runtime?.lifecycle.status === 'active' && this.room.status === 'active') this.startLoop();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket, raw) {
    await this.ready;
    if (this.runtime?.lifecycle.status === 'active' && this.room?.status === 'active') this.startLoop();
    const attachment = socket.deserializeAttachment();
    const userId = attachment?.userId;
    if (!userId || !this.runtime || this.runtime.lifecycle.status !== 'active') {
      this.send(socket, { type: 'error', error: 'match-not-active' });
      return;
    }
    const parsed = parseClientMessage(typeof raw === 'string' ? raw : '');
    if (!parsed.ok) {
      this.send(socket, { type: 'command-rejected', reason: parsed.reason });
      return;
    }
    if (parsed.command.type === 'ping') {
      this.send(socket, { type: 'pong', sentAt: parsed.command.sentAt, serverAt: Date.now() });
      return;
    }
    const result = parsed.command.type === 'input'
      ? this.runtime.submitInput(userId, parsed.command)
      : this.runtime.submitAbility(userId, parsed.command);
    if (!result.ok) {
      this.send(socket, { type: 'command-rejected', reason: result.reason, seq: parsed.command.seq });
      return;
    }
    await this.appendEvent(
      parsed.command.type === 'input' ? 'input-command' : 'ability-command',
      { playerId: userId, command: parsed.command },
      false,
    );
    this.send(socket, {
      type: parsed.command.type === 'input' ? 'input-queued' : 'ability-queued',
      seq: parsed.command.seq,
    });
  }

  async webSocketClose(socket) {
    await this.ready;
    const userId = socket.deserializeAttachment()?.userId;
    if (!userId) return;
    const stillConnected = this.ctx.getWebSockets().some(other =>
      other !== socket && other.readyState === 1 && other.deserializeAttachment()?.userId === userId);
    if (stillConnected) return;
    await this.onDisconnect(userId);
  }

  async webSocketError(socket) {
    await this.webSocketClose(socket);
  }

  async onDisconnect(userId) {
    const player = this.requireRoomPlayer(userId);
    if (!player || !player.connected) return;
    if (this.runtime && ['active', 'paused'].includes(this.runtime.lifecycle.status)) {
      await this.pauseForDisconnect(userId);
    } else {
      const result = leaveRoom(this.room, userId, Date.now());
      await this.appendEvent('lobby-socket-closed', { playerId: userId, result }, true);
      if (this.room.status === 'waiting' && this.room.waitingDeadlineAt) await this.ctx.storage.setAlarm(this.room.waitingDeadlineAt);
      this.broadcast({ type: 'room-state', room: this.roomView(), event: result });
    }
  }

  async pauseForDisconnect(userId) {
    const now = Date.now();
    const result = this.runtime?.disconnect(userId, now);
    const player = playerFor(this.room, userId);
    if (player) player.connected = false;
    this.room.status = 'paused';
    this.stopLoop();
    await this.appendEvent('player-disconnected', { playerId: userId, result }, true);
    await this.scheduleReconnectAlarm();
    this.broadcast({ type: 'match-paused', playerId: userId, reconnectUntil: result?.reconnectUntil });
  }

  scheduleReconnectAlarm() {
    if (!this.runtime) return;
    const deadlines = this.runtime.lifecycle.players
      .filter(player => !player.connected && Number.isFinite(player.reconnectUntil))
      .map(player => player.reconnectUntil);
    if (deadlines.length) return this.ctx.storage.setAlarm(Math.min(...deadlines));
  }

  resolveDisconnect(disconnected, players) {
    const connected = players.filter(player => player.connected);
    if (this.room?.mode === 'territory' && connected.length === 1) {
      return { mode: 'territory', reason: 'reconnect-timeout', winnerRole: connected[0].role };
    }
    return { mode: this.room?.mode, reason: 'reconnect-timeout', disconnected };
  }

  async alarm() {
    await this.ready;
    const now = Date.now();
    if (this.room?.status === 'closed' && this.runtime?.lifecycle.status === 'finished' && this.room.resultPersistence?.status === 'pending') {
      await this.persistResult();
      return;
    }
    if (this.room?.status === 'paused' && this.runtime) {
      const result = tickMatchLifecycle(this.runtime.lifecycle, now, this.resolveDisconnect.bind(this));
      if (result.ended) {
        this.room.status = 'closed'; this.room.closedAt = now; this.room.closeReason = 'match-ended';
        await this.finishMatch();
      } else this.scheduleReconnectAlarm();
      return;
    }
    if (!this.room) return;
    const result = tickRoom(this.room, now, () => crypto.randomUUID());
    if (result.action === 'match-started') {
      this.seed = crypto.getRandomValues(new Uint32Array(1))[0];
      this.runtime = createDuoMatchRuntime({
        roomId: this.room.roomId, matchId: result.matchId,
        players: result.players.map(player => ({
          id: player.id, role: player.role, nickname: player.nickname || 'Игрок',
        })),
        mode: this.room.mode, seed: this.seed, startedAt: now,
        difficultyIndex: this.room.difficultyIndex,
        options: { resolveDisconnect: this.resolveDisconnect.bind(this) },
      });
      await this.appendEvent('match-started', { matchId: result.matchId, mode: this.room.mode, seed: this.seed }, true);
      this.broadcast({ type: 'match-started', matchId: result.matchId, mode: this.room.mode });
      this.broadcast(this.worldInitMessage());
      this.startLoop();
    } else if (result.action === 'closed') {
      await this.appendEvent('room-closed', { reason: result.reason }, true);
      this.broadcast({ type: 'room-closed', reason: result.reason });
    } else if (this.room.status === 'waiting' && this.room.waitingDeadlineAt) {
      await this.ctx.storage.setAlarm(this.room.waitingDeadlineAt);
    }
  }

  worldInitMessage() {
    const world = this.runtime.world;
    return {
      type: 'world-init', matchId: this.runtime.lifecycle.matchId, mode: this.runtime.mode,
      arenaRadius: world.arenaRadius, build: world.build,
      owners: world.owners.map(ownerSummary),
      cells: world.cells.map(cellSnapshot),
      food: world.food.map(food => ({ id: food.id, x: food.x, z: food.z })),
      viruses: world.viruses.map(virus => ({ ...virus })),
      ejects: world.ejects.map(item => ({ ...item })),
      modeState: world.modeState,
      tick: this.runtime.simulation.tick, clock: world.clock || 0,
    };
  }

  snapshotMessage(out) {
    const world = this.runtime.world;
    const foodChanges = (world.pendingFoodChanges || []).splice(0);
    return {
      type: 'snapshot', tick: out.tick, clock: world.clock || 0,
      cells: world.cells.map(cellSnapshot),
      owners: world.owners.map(ownerSummary),
      viruses: world.viruses.map(virus => ({ ...virus })),
      ejects: world.ejects.map(item => ({ ...item })),
      foodChanges, modeState: world.modeState,
      elapsedMs: this.runtime.elapsedMs(),
    };
  }

  startLoop() {
    if (this.loopTimer || !this.runtime || this.runtime.lifecycle.status !== 'active' || this.room?.status !== 'active') return;
    this.nextTickAt = performance.now() + TICK_MS;
    const run = () => {
      if (!this.runtime || this.runtime.lifecycle.status !== 'active' || this.room?.status !== 'active') {
        this.loopTimer = null; return;
      }
      let ticks = 0;
      while (performance.now() >= this.nextTickAt && ticks < 5) {
        let out;
        try { out = this.runtime.step(); }
        catch (error) {
          this.loopTimer = null;
          this.room.status = 'closed'; this.room.closedAt = Date.now(); this.room.closeReason = 'simulation-error';
          this.appendEvent('simulation-error', { message: String(error?.message || error) }, true).catch(() => {});
          this.broadcast({ type: 'match-error', error: 'simulation-error' });
          return;
        }
        ticks++;
        this.nextTickAt += TICK_MS;
        if (out.snapshotDue && out.advanced) this.broadcast(this.snapshotMessage(out));
        if (this.runtime.lifecycle.status === 'finished') {
          this.loopTimer = null;
          this.finishMatch().catch(() => {});
          return;
        }
      }
      const now = Date.now();
      if (now - this.lastPersistAt >= PERSIST_INTERVAL_MS) this.writeSnapshot().catch(() => {});
      const delay = this.nextTickAt - performance.now();
      this.loopTimer = setTimeout(run, Math.max(0, delay));
    };
    this.loopTimer = setTimeout(run, 0);
  }

  stopLoop() {
    if (this.loopTimer) clearTimeout(this.loopTimer);
    this.loopTimer = null;
  }

  async finishMatch() {
    this.stopLoop();
    if (!this.room || !this.runtime) return;
    this.room.status = 'closed';
    this.room.closedAt ||= Date.now();
    this.room.closeReason ||= 'match-finished';
    const result = this.runtime.lifecycle.result;
    await this.appendEvent('match-finished', { matchId: this.runtime.lifecycle.matchId, result }, true);
    this.broadcast({ type: 'match-ended', matchId: this.runtime.lifecycle.matchId, result });
    await this.persistResult();
  }

  async persistResult() {
    if (!this.runtime || !this.room) return;
    try {
      const result = await persistMatchResult(this.env, this.runtime, this.room);
      this.room.resultPersistence = { status: result.ok ? 'saved' : 'pending', ...result };
      if (!result.ok) await this.ctx.storage.setAlarm(Date.now() + RESULT_RETRY_MS);
      else await this.writeSnapshot();
    } catch (error) {
      this.room.resultPersistence = { status: 'pending', reason: 'supabase-error', message: String(error?.message || error) };
      await this.ctx.storage.setAlarm(Date.now() + RESULT_RETRY_MS);
      await this.writeSnapshot();
    }
  }

  send(socket, payload) {
    try { if (socket.readyState === 1) socket.send(JSON.stringify(payload)); } catch {}
  }

  broadcast(payload) {
    const text = JSON.stringify(payload);
    for (const socket of this.ctx.getWebSockets()) {
      try { if (socket.readyState === 1) socket.send(text); } catch {}
    }
  }
}
