/* Капли 3D: offline mode. Own cache name, never touches the catalog's caches on the same site. */
const CACHE = "kapli3d-v272";
const CORE = ["./", "index.html", "three.min.js", "supabase.js", "manifest.json", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "chat-cosmos.svg", "chat-aurora.svg", "chat-sakura.svg", "chat-drops.svg", "chat-chronos-workshop.svg", "chat-chronos-city.svg", "chat-chronos-heart.svg", "js/emotes.js", "js/errlog.js", "js/loader.js", "js/game/01-config.js", "js/game/02-save.js", "js/game/03-scene.js", "js/game/04-arena.js", "js/game/05-achievements.js", "js/game/06-abilities.js", "js/game/07-round.js", "js/game/08-menus.js", "js/game/09-sound.js", "js/game/10-items-chests.js", "js/game/11-leagues.js", "js/game/12-profile.js", "js/game/13-world.js", "js/game/14-net.js", "js/game/14b-duo.js", "js/game/15-boot.js", "js/app.js", "css/01-base.css", "css/02-leagues.css", "css/03-chat.css", "css/04-features.css", "css/05-chat-2.css"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("kapli3d-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (/fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request).then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return res; })));
    return;
  }
  if (url.origin !== location.origin) return;
  // opening the app: the saved copy is shown at once if the network is slow (over 2.5 s); the fresh one is still saved for next time
  if (e.request.mode === "navigate") {
    const net = fetch(e.request, { cache: "no-cache" }).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put("index.html", copy)); } return r; });
    e.waitUntil(net.catch(() => {}));
    e.respondWith(new Promise(done => {
      let settled = false; const finish = r => { if (!settled && r) { settled = true; done(r); } };
      const t = setTimeout(() => caches.match("index.html").then(finish), 2500);
      net.then(r => { clearTimeout(t); finish(r); }).catch(() => { clearTimeout(t); caches.match("index.html").then(r => finish(r || Response.error())); });
    }));
    return;
  }
  e.respondWith(
    fetch(e.request, { cache: "no-cache" }).then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html")))
  );
});
