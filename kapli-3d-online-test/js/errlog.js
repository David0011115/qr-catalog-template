/* Error journal: the last 25 errors (deduplicated) stay on the device, so a player can send them to support in one tap */
window.KapliErr = (() => {
  const KEY = 'kapli3d-errlog', MAX = 25;
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } };
  function log(err, where) {
    try {
      const msg = String((err && (err.message || err.reason && err.reason.message || err.reason)) || err || 'unknown').slice(0, 300);
      const at = String((err && err.stack) || '').split('\n').slice(1, 3).map(l => l.trim().replace(/^at\s+/, '').replace(/https?:\/\/[^\s)]*\//g, '')).join(' < ').slice(0, 220);
      const list = read(), last = list[list.length - 1];
      if (last && last.m === msg && last.w === where) { last.n = (last.n || 1) + 1; last.t = Date.now(); }
      else list.push({ t: Date.now(), w: where || '', m: msg, s: at, n: 1 });
      localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
    } catch (e) {}
  }
  addEventListener('error', e => { if (e && e.message) log(e.error || e, 'window'); });
  addEventListener('unhandledrejection', e => log(e && e.reason || e, 'promise'));
  return { log, read, clear: () => { try { localStorage.removeItem(KEY); } catch (e) {} } };
})();
