/* Капли 3D · loader: joins the game files (js/game/) into one script, exactly like the former single <script>.
   Every file shares one scope, so the code works the same as before the split. KAPLI_MAP turns a line of
   kapli-game.js (in error stacks) back into the file and line it came from. */
(() => {
  const FILES = ['01-config.js', '02-save.js', '03-scene.js', '04-arena.js', '05-achievements.js', '06-abilities.js', '07-round.js', '08-menus.js', '09-sound.js', '10-items-chests.js', '11-leagues.js', '12-profile.js', '13-world.js', '14-net.js', '14b-duo.js', '14c-duo-match.js', '14d-territory.js', '14e-duoback.js', '14f-modes.js', '15-boot.js'];
  const fail = e => { const s = document.getElementById('splashState') || document.querySelector('.splash'); if (s) s.insertAdjacentHTML('beforeend', '<p style="color:#ff8aa8;margin-top:12px">Не удалось загрузить игру. Проверь интернет и открой её ещё раз.</p>'); console.error(e); };
  Promise.all(FILES.map(f => fetch('js/game/' + f).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.text(); }))).then(texts => {
    const map = []; let line = 2;
    texts.forEach((t, i) => { map.push({ file: FILES[i], from: line }); line += t.split('\n').length - 1; });
    window.KAPLI_MAP = map;
    window.kapliWhere = n => { let m = map[0]; for (const x of map) if (x.from <= n) m = x; return m ? m.file + ':' + (n - m.from + 1) : '?:' + n; };
    const sc = document.createElement('script');
    sc.textContent = '(function () {\n' + texts.join('') + '})();\n//# sourceURL=kapli-game.js';
    document.body.appendChild(sc);
  }).catch(fail);
})();
