  // ================= duo: a room for two phones — connection test =================
  // One phone makes a room and shows a 5-character code, the other enters it. They find each other through a broadcast
  // channel of the game server, then talk directly over a WebRTC data channel (same Wi-Fi or a phone hotspot, iPhone and
  // Android alike). If the direct link does not come up, messages keep going through the server channel.
  // The entry in Settings shows only after the page was opened once with ?duo=1 (kept in localStorage).
  const Duo = (() => {
    const ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', DIRECT_MS = 7000, LOST_MS = 6000;
    const me = Math.random().toString(36).slice(2, 10);
    let ch = null, pc = null, dcR = null, dcU = null, role = '', code = '', state = 'idle', why = '', peer = '', rtt = 0, lastSeen = 0, tick = null, helloT = null, directT = null;
    let onMsg = () => {}, onState = () => {};
    const direct = () => !!(dcR && dcR.readyState === 'open');
    const set = (st, reason = '') => { state = st; why = reason; onState(); };
    const sig = (event, payload) => { if (ch) ch.send({ type: 'broadcast', event, payload: { ...payload, from: me } }); };
    // fast = may be dropped (positions); otherwise delivered in order
    function send(obj, fast) {
      const s = JSON.stringify(obj);
      if (direct()) { const d = fast && dcU && dcU.readyState === 'open' ? dcU : dcR; try { d.send(s); return; } catch (e) {} }
      sig('m', { d: s });
    }
    function got(s) { let m; try { m = JSON.parse(s); } catch (e) { return; } lastSeen = performance.now();
      if (m.t === 'pi') send({ t: 'po', n: m.n }, true); else if (m.t === 'po') { rtt = Math.round(performance.now() - m.n); onState(); } else if (m.t === 'bye') leave('Второй игрок вышел', true); else onMsg(m); }
    function wire(d) { d.onmessage = e => got(e.data); d.onopen = () => { clearTimeout(directT); onState(); }; d.onclose = () => onState(); if (d.label === 'r') dcR = d; else dcU = d; }
    function newPeer() {
      if (pc) try { pc.close(); } catch (e) {}
      dcR = dcU = null;
      if (!window.RTCPeerConnection) return null;
      // a public STUN server tells each phone its outside address, so a direct link can come up across networks too (no media relay: that still goes through the game server)
      pc = new RTCPeerConnection({ iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }] });
      pc.onicecandidate = e => { if (e.candidate) sig('ice', { c: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); };
      pc.ondatachannel = e => wire(e.channel);
      return pc;
    }
    async function onSig(event, p) {
      if (!p || p.from === me) return;
      try {
        if (event === 'hello' && role === 'host') {
          if (peer && peer !== p.from) { sig('full', { to: p.from }); return; }   // a room holds two phones
          const first = !peer; peer = p.from; lastSeen = performance.now(); sig('welcome', { to: p.from });
          if (first) { ready(); if (newPeer()) { wire(pc.createDataChannel('r')); wire(pc.createDataChannel('u', { ordered: false, maxRetransmits: 0 })); const o = await pc.createOffer(); await pc.setLocalDescription(o); sig('sdp', { to: peer, s: pc.localDescription }); } }
        } else if (p.to && p.to !== me) return;
        else if (event === 'full' && role === 'guest') leave('В этой комнате уже двое');
        else if (event === 'welcome' && role === 'guest' && !peer) { peer = p.from; lastSeen = performance.now(); ready(); }
        else if (event === 'sdp' && p.from === peer) {
          if (p.s.type === 'offer') { if (!newPeer()) return; await pc.setRemoteDescription(p.s); const a = await pc.createAnswer(); await pc.setLocalDescription(a); sig('sdp', { to: peer, s: pc.localDescription }); }
          else if (pc) await pc.setRemoteDescription(p.s);
        } else if (event === 'ice' && p.from === peer && pc) await pc.addIceCandidate(p.c).catch(() => {});
        else if (event === 'm' && p.from === peer) got(p.d);
      } catch (e) { if (window.KapliErr) KapliErr.log(e, 'duo'); }
    }
    function ready() {
      clearInterval(helloT); set('ready');
      directT = setTimeout(onState, DIRECT_MS);   // after this the screen says «через сервер» if the direct link is still down
      clearInterval(tick); tick = setInterval(() => { send({ t: 'pi', n: performance.now() }, true); if (performance.now() - lastSeen > LOST_MS) leave('Связь со вторым телефоном потеряна', true); }, 1000);
    }
    async function open(asRole, roomCode) {
      await leave('', true); role = asRole; code = roomCode || Array.from({ length: 5 }, () => ABC[Math.floor(Math.random() * ABC.length)]).join('');
      set(role === 'host' ? 'waiting' : 'joining');
      let sb; try { sb = await Net.client(); } catch (e) { set('idle', 'Нет связи с сервером игры. Проверь интернет.'); return; }
      const c = ch = sb.channel('kapli-duo-' + code, { config: { broadcast: { self: false, ack: false } } });
      ['hello', 'welcome', 'full', 'sdp', 'ice', 'm'].forEach(ev => c.on('broadcast', { event: ev }, m => { if (ch === c) onSig(ev, m.payload); }));
      c.subscribe(st => {
        if (ch !== c) return;
        if (st === 'SUBSCRIBED' && role === 'guest') { let n = 0; const hi = () => { if (ch !== c || peer) return; if (++n > 8) { leave('Комната с таким кодом не найдена'); return; } sig('hello', {}); }; hi(); helloT = setInterval(hi, 1000); }
        else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT') leave('Нет связи с сервером игры. Проверь интернет.');
      });
    }
    async function leave(reason = '', quiet) {
      clearInterval(tick); clearInterval(helloT); clearTimeout(directT);
      if (!quiet && state === 'ready') send({ t: 'bye' });
      if (pc) try { pc.close(); } catch (e) {} pc = dcR = dcU = null;
      const c = ch; ch = null; peer = ''; rtt = 0;
      if (c) try { const sb = await Net.client(); await sb.removeChannel(c); } catch (e) {}
      set('idle', reason);
    }
    return { host: () => open('host'), join: c => open('guest', String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)), leave, send,
      get state() { return state; }, get why() { return why; }, get code() { return code; }, get role() { return role; }, get rtt() { return rtt; }, get direct() { return direct(); },
      on(msg, st) { onMsg = msg; onState = st; } };
  })();

  // ---- the test screen: both players drag a drop on a small field and see each other's drop move ----
  {
    const on = (() => { try { if (/[?&]duo=1/.test(location.search)) localStorage.setItem('kapli3d-duo', '1'); return localStorage.getItem('kapli3d-duo') === '1'; } catch (e) { return false; } })();
    $('duoBtn').hidden = !on;
    const mine = { x: .3, y: .5 }, theirs = { x: .7, y: .5, seen: 0 }; let raf = 0, sentAt = 0, drawn = '';
    function render() {
      const b = $('duoBody'), st = Duo.state, key = st + '|' + Duo.code + '|' + Duo.why;
      if (st === 'ready') { const info = `Соединено · ${Duo.direct ? 'напрямую' : 'через сервер'} · задержка ${Duo.rtt ? Duo.rtt + ' мс' : '…'}`; if (drawn === key) { $('duoInfo').textContent = info; return; }
        b.innerHTML = `<p class="hint" id="duoInfo" style="margin:0">${info}</p><p class="hint" style="margin:0">Комната <b>${Duo.code}</b> · ты ${Duo.role === 'host' ? 'создал её' : 'вошёл в неё'}. Веди пальцем по полю — второй игрок видит твою каплю, а ты его.</p><canvas id="duoPad" class="duo-pad"></canvas><button class="btn ghost" id="duoLeave" type="button">Выйти из комнаты</button>`;
        pad(); }
      else if (st === 'waiting') b.innerHTML = `<p class="hint" style="margin:0">Скажи этот код второму игроку:</p><div class="duo-code" aria-label="Код комнаты">${Duo.code}</div><p class="hint" style="margin:0">Жду второй телефон…</p><button class="btn ghost" id="duoLeave" type="button">Отмена</button>`;
      else if (st === 'joining') b.innerHTML = `<p class="hint" style="margin:0">Ищу комнату <b>${Duo.code}</b>…</p><button class="btn ghost" id="duoLeave" type="button">Отмена</button>`;
      else b.innerHTML = (Duo.why ? `<p class="duo-why" role="status">${Duo.why}</p>` : '') +
        `<button class="btn" id="duoHost" type="button">Создать комнату</button><div class="duo-join"><input id="duoCode" inputmode="latin" autocomplete="off" autocapitalize="characters" maxlength="5" placeholder="Код" aria-label="Код комнаты"><button class="btn ghost" id="duoJoin" type="button">Войти по коду</button></div>` +
        `<p class="hint" style="margin:0">Обоим телефонам нужен интернет. В одной сети Wi-Fi связь будет прямой и быстрой; в разных сетях — прямой, если получится, иначе через сервер игры.</p>`;
      drawn = key; if (st !== 'ready') cancelAnimationFrame(raf);
    }
    function pad() {
      const cv = $('duoPad'), g = cv.getContext('2d');
      const move = e => { const r = cv.getBoundingClientRect(); mine.x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); mine.y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height)); e.preventDefault(); };
      cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); move(e); }); cv.addEventListener('pointermove', e => { if (e.buttons || e.pointerType === 'touch') move(e); });
      const drop = (x, y, r, c, label) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 6.29); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x - r * .3, y - r * .1, r * .2, 0, 6.29); g.arc(x + r * .3, y - r * .1, r * .2, 0, 6.29); g.fill();
        g.fillStyle = '#14102a'; g.beginPath(); g.arc(x - r * .3, y - r * .08, r * .09, 0, 6.29); g.arc(x + r * .3, y - r * .08, r * .09, 0, 6.29); g.fill(); g.fillStyle = '#fff'; g.font = `600 ${Math.round(r * .5)}px sans-serif`; g.textAlign = 'center'; g.fillText(label, x, y + r * 1.75); };
      const frame = now => {
        if (Duo.state !== 'ready' || !cv.isConnected) return; raf = requestAnimationFrame(frame);
        const w = cv.clientWidth, h = cv.clientHeight, k = Math.min(devicePixelRatio || 1, 2); if (cv.width !== Math.round(w * k)) { cv.width = Math.round(w * k); cv.height = Math.round(h * k); }
        g.setTransform(k, 0, 0, k, 0, 0); g.clearRect(0, 0, w, h); const r = Math.max(14, h * .09);
        theirs.dx = theirs.dx === undefined ? theirs.x : theirs.dx + (theirs.x - theirs.dx) * .35; theirs.dy = theirs.dy === undefined ? theirs.y : theirs.dy + (theirs.y - theirs.dy) * .35;   // smooth between packets
        if (theirs.seen) drop(theirs.dx * w, theirs.dy * h, r, '#ff4fd8', 'второй игрок');
        drop(mine.x * w, mine.y * h, r, '#22e6ff', 'ты');
        if (now - sentAt > (Duo.direct ? 50 : 125)) { sentAt = now; Duo.send({ t: 'p', x: +mine.x.toFixed(3), y: +mine.y.toFixed(3) }, true); }   // 20 a second directly, 8 through the server
      };
      raf = requestAnimationFrame(frame);
    }
    Duo.on(m => { if (m.t === 'p') { theirs.x = m.x; theirs.y = m.y; theirs.seen = 1; } }, () => { if (!$('duoCard').hidden) render(); });
    $('duoBtn').addEventListener('click', () => { drawn = ''; showCard('duoCard'); render(); });
    $('duoBack').addEventListener('click', () => { Duo.leave(); showCard('settingsCard'); $('duoBtn').focus(); });
    $('duoBody').addEventListener('click', e => { const id = e.target.id; if (id === 'duoHost') Duo.host(); else if (id === 'duoJoin') { const c = $('duoCode').value.trim(); if (c.length === 5) Duo.join(c); else { $('duoCode').focus(); toast('В коде комнаты 5 символов'); } } else if (id === 'duoLeave') Duo.leave(); });
  }
