/* installable app: offline cache + install button */
const APP_VER = '230';
// shown to players as 1.5.9 instead of 59 (and 2.0.0 for 200): generation . tens of updates . update within them
const APP_LABEL = '2.3.0'; // Public release version.
// the installed app turns to landscape itself after it has opened (the manifest no longer forces it: a forced turn at launch made Android drop the first taps)
{ const standalone = matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || navigator.standalone;
  const lock = () => { try { if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {}); } catch (e) {} };
  if (standalone) { lock(); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') lock(); }); addEventListener('pointerdown', lock, { once: true }); } }
if ('serviceWorker' in navigator) {
  // check for a new version on every launch and whenever the app comes back to the screen; reload once when it takes over
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadController && !reloaded) { reloaded = true; location.reload(); } });
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    reg.update().catch(() => {});
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') reg.update().catch(() => {}); });
  }).catch(() => {}));
}
// version line at the bottom of Settings, so you can see which build is running
{ const card = document.getElementById('settingsCard'); if (card) { const p = document.createElement('p'); p.id = 'appVer'; p.textContent = 'Версия приложения: ' + APP_LABEL; card.appendChild(p); } }
(function () {
  const btn = document.getElementById('installBtn'), hint = document.getElementById('iosHint');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; if (!standalone) btn.hidden = false; });
  btn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch (err) {}
    deferred = null; btn.hidden = true;
  });
  window.addEventListener('appinstalled', () => { btn.hidden = true; });
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (ios && !standalone) hint.hidden = false;
})();
