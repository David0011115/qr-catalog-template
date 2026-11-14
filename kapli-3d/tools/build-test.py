# test build of the split game: copies the folder, switches TEST_MODE on in js/game/01-config.js, strips <head> for the artifact
import re, shutil, sys, os
src, out = sys.argv[1].rstrip('/') + '/', sys.argv[2].rstrip('/') + '/'
if os.path.exists(out): shutil.rmtree(out)
shutil.copytree(src, out)
c = open(out + 'js/game/01-config.js', encoding='utf-8').read(); assert c.count('const TEST_MODE = false;') == 1
open(out + 'js/game/01-config.js', 'w', encoding='utf-8').write(c.replace('const TEST_MODE = false;', 'const TEST_MODE = true;'))
s = open(out + 'index.html', encoding='utf-8').read()
for pat in [r'<!doctype html>\s*', r'<html[^>]*>\s*', r'</?head>\s*', r'<body>\s*', r'</body>\s*', r'</html>\s*', r'<meta name="viewport"[^>]*>\s*', r'<meta charset[^>]*>\s*',
            r'<link rel="(manifest|icon|apple-touch-icon)"[^>]*>\s*', r'<meta name="(apple|mobile)[^>]*>\s*']:
    s = re.sub(pat, '', s, flags=re.I)
s = '<title>Капли 3D Тест · модули</title>\n' + s.replace('<title>Капли 3D</title>', '')
# test build only: a «⛶ Во весь экран» button (the artifact page may or may not allow fullscreen; if not, it says so)
FS = """<button id="tstFs" type="button" aria-label="Во весь экран" title="Во весь экран" style="position:fixed;left:8px;bottom:8px;z-index:2147483000;width:40px;height:40px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:rgba(10,6,30,.7);color:#fff;font-size:20px;line-height:1;opacity:.75;cursor:pointer">⛶</button>
<script>(function () {
  var b = document.getElementById('tstFs'), d = document.documentElement;
  var fsEl = function () { return document.fullscreenElement || document.webkitFullscreenElement; };
  var sync = function () { b.textContent = fsEl() ? '✕' : '⛶'; b.title = b.ariaLabel = fsEl() ? 'Выйти из полного экрана' : 'Во весь экран'; };
  var say = function (t) { var n = document.createElement('div'); n.textContent = t; n.style.cssText = 'position:fixed;left:56px;bottom:10px;right:10px;max-width:420px;z-index:2147483000;padding:10px 12px;border-radius:12px;background:rgba(10,6,30,.92);color:#fff;font:14px/1.35 system-ui,sans-serif;border:1px solid rgba(255,255,255,.25)'; document.body.appendChild(n); setTimeout(function () { n.remove(); }, 6000); };
  b.addEventListener('click', function () {
    if (fsEl()) { (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
    var req = d.requestFullscreen || d.webkitRequestFullscreen;
    if (!req) { say('Этот браузер не умеет полный экран для страниц (так у iPhone). Поверни телефон горизонтально — панель браузера спрячется при прокрутке.'); return; }
    try { var r = req.call(d, { navigationUI: 'hide' });
      var ok = function () { try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(function () {}); } catch (e) {} };
      var no = function () { say('Страница claude.ai не разрешила полный экран. Можно сделать отдельную тестовую копию на сайте — там он будет.'); };
      if (r && r.then) r.then(ok, no); else setTimeout(function () { fsEl() ? ok() : no(); }, 400);
    } catch (e) { say('Страница claude.ai не разрешила полный экран: ' + e.message); }
  });
  document.addEventListener('fullscreenchange', sync); document.addEventListener('webkitfullscreenchange', sync);
})();</script>
"""
s = s + FS
open(out + 'index.html', 'w', encoding='utf-8').write(s)
open(out + 'local.html', 'w', encoding='utf-8').write('<meta charset="utf-8">\n' + s)
print('ok')
