# test copy for the site (folder kapli-3d-test/ next to the game): installable on a phone, fullscreen like the real app,
# but fully separate from the real game — test mode, the TEST Supabase project and the test game server, its own storage keys, its own offline cache
import re, shutil, sys, os
src, out = sys.argv[1].rstrip('/') + '/', sys.argv[2].rstrip('/') + '/'
if os.path.exists(out): shutil.rmtree(out)
shutil.copytree(src, out, ignore=shutil.ignore_patterns('tools', 'server', 'tests', '*.sql', '*.md'))
def sub(path, a, b, n=1):
    s = open(out + path, encoding='utf-8').read(); assert s.count(a) == n, (path, a); open(out + path, 'w', encoding='utf-8').write(s.replace(a, b))
sub('js/game/01-config.js', 'const TEST_MODE = false;', 'const TEST_MODE = true;')
# 2.7 + online: the test copy talks only to the owner's TEST Supabase project (the same one the test game server checks
# accounts against), never to the real game's project — accounts, ratings and saves there are test data only
TEST_SB_URL, TEST_SB_KEY = 'https://kccwtpveezsrgwfnflhf.supabase.co', 'sb_publishable_oyO2ubBpXo3h1IBB-DPdsQ_gnYaO0Mf'
sub('js/game/14-net.js', "'https://kprkslsptcnxajdllwje.supabase.co'", repr(TEST_SB_URL))
sub('js/game/14-net.js', "'sb_publishable_C6dIYs3B1t1tkMYl4AgzzA_hVtZLBaj'", repr(TEST_SB_KEY))
assert 'kprkslsptcnxajdllwje' not in open(out + 'js/game/14-net.js', encoding='utf-8').read()
assert 'workers.dev' in open(out + 'js/game/14g-online-server.js', encoding='utf-8').read()   # the test game server
sub('js/game/14-net.js', "storageKey: 'kapli3d-auth'", "storageKey: 'kapli3dtest-auth'")
# every storage key gets its own prefix, so nothing the real game keeps on this site can be read, changed or cleared
GUARD = """<script>(function () { var P = 'kapli3dtest:', S = Storage.prototype, g = S.getItem, s = S.setItem, r = S.removeItem, k = S.key;
  S.getItem = function (x) { return g.call(this, P + x); }; S.setItem = function (x, v) { return s.call(this, P + x, v); }; S.removeItem = function (x) { return r.call(this, P + x); };
  S.clear = function () { var ks = []; for (var i = 0; i < this.length; i++) { var kk = k.call(this, i); if (kk && kk.indexOf(P) === 0) ks.push(kk); } for (var j = 0; j < ks.length; j++) r.call(this, ks[j]); };
})();</script>
"""
s = open(out + 'index.html', encoding='utf-8').read()
s = s.replace('<title>Капли 3D</title>', '<title>Капли 3D · Тест</title>', 1)
s = re.sub(r'(<meta charset[^>]*>\s*)', lambda m: m.group(1) + GUARD, s, count=1, flags=re.I)
assert 'kapli3dtest:' in s
open(out + 'index.html', 'w', encoding='utf-8').write(s)
# its own offline cache name: the real game's worker only clears «kapli3d-…», this one only «kapli3dtest-…»
sw = open(out + 'sw.js', encoding='utf-8').read()
sw = re.sub(r'const CACHE = "kapli3d-v(\d+)";', r'const CACHE = "kapli3dtest-v\1";', sw); sw = sw.replace('k.startsWith("kapli3d-")', 'k.startsWith("kapli3dtest-")')
assert 'kapli3dtest-v' in sw and 'startsWith("kapli3dtest-")' in sw
open(out + 'sw.js', 'w', encoding='utf-8').write(sw)
sub('manifest.json', '"name": "Капли 3D"', '"name": "Капли 3D · Тест"'); sub('manifest.json', '"short_name": "Капли 3D"', '"short_name": "Капли Тест"')
open(out + 'TEST-COPY.txt', 'w', encoding='utf-8').write('Тестовая копия ветки 2.7 (собрана tools/build-site-test.py). Тестовый режим, тестовая база и тестовый сервер игры, отдельное сохранение. Не основная игра.\n')
print('ok')
