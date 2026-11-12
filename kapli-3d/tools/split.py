#!/usr/bin/env python3
"""Splits kapli-3d/index.html into css/*.css and js/*.js without changing behaviour.
Reproducible: run it on the latest main right before merging.
usage: split.py <src kapli-3d dir> <out dir>"""
import sys, os, re, shutil, subprocess
src, out = sys.argv[1].rstrip('/') + '/', sys.argv[2].rstrip('/') + '/'
html = open(src + 'index.html', encoding='utf-8').read()
os.makedirs(out + 'css', exist_ok=True); os.makedirs(out + 'js/game', exist_ok=True)

# ---------- 1. styles: every <style> block in <head>, kept in the original order ----------
head_end = html.index('</head>')
head, rest = html[:head_end], html[head_end:]
blocks = []
def take_style(m):
    blocks.append((m.group(1) or '', m.group(2)))
    return '\x00STYLE%d\x00' % (len(blocks) - 1)
head = re.sub(r'<style(?:\s+id="([^"]*)")?>\n?(.*?)</style>\n?', take_style, head, flags=re.S)
# group by topic, but never reorder: a new file starts only where the topic changes
def topic(sid, i):
    if not sid: return 'base'
    if sid.startswith(('league', 'chaos')): return 'leagues'
    if sid.startswith('chat'): return 'chat'
    return 'features'
groups = []
for i, (sid, css) in enumerate(blocks):
    t = topic(sid, i)
    if groups and groups[-1][0] == t: groups[-1][1].append(i)
    else: groups.append([t, [i]])
used = {}; links = {}
for t, idx in groups:
    used[t] = used.get(t, 0) + 1
    name = f'{groups.index([t, idx]) + 1:02d}-{t}{"" if used[t] == 1 else "-" + str(used[t])}.css'
    body = '\n'.join((f'/* ---- {blocks[i][0] or "base"} ---- */\n' if blocks[i][0] else '') + blocks[i][1].rstrip() + '\n' for i in idx)
    open(out + 'css/' + name, 'w', encoding='utf-8').write(body)
    links[idx[0]] = f'<link rel="stylesheet" href="css/{name}">\n'
    for i in idx[1:]: links[i] = ''
head = re.sub(r'\x00STYLE(\d+)\x00', lambda m: links[int(m.group(1))], head)
html = head + rest

# ---------- 2. scripts ----------
def extract(start_marker, end_marker='</script>'):
    global html
    a = html.index(start_marker); b = html.index(end_marker, a)
    code = html[a + len(start_marker):b]
    return a, b + len(end_marker), code
# 2a. the emotes library (first inline script after <body>)
a, b, code = extract('<script>\n/* «Капли 3D» chat emotes')
open(out + 'js/emotes.js', 'w', encoding='utf-8').write('/* «Капли 3D» chat emotes' + code)
html = html[:a] + '<script src="js/emotes.js"></script>' + html[b:]
# 2b. the game: one big IIFE → sections in their own files, same order, shared top-level scope
a = html.index('<script src="three.min.js"></script>\n<script>\n(function () {\n')
start = a + len('<script src="three.min.js"></script>\n<script>\n(function () {\n')
end = html.index('\n})();\n</script>', start)
game = html[start:end]
lines = game.split('\n')
# kept as is (no re-indenting): the files are joined back byte for byte
SECTIONS = [  # (file, first section header that starts it) — order matters
    ('01-config.js', None),
    ('02-save.js', '// ================= save ='),
    ('03-scene.js', '// ================= scene ='),
    ('04-arena.js', '// ================= spikes (viruses) ='),
    ('05-achievements.js', '// ================= achievements ='),
    ('06-abilities.js', '// ================= abilities: runtime ='),
    ('07-round.js', '// ================= bonuses ='),
    ('08-menus.js', '// ================= menus ='),
    ('09-sound.js', '// ================= sound and music'),
    ('10-items-chests.js', '// ================= item details'),
    ('11-leagues.js', '// ================= season badges'),
    ('12-profile.js', '// ================= profile ='),
    ('13-world.js', '// ================= arena preview'),
    ('14-net.js', '// ================= accounts, cloud saves'),
]
cuts = [0]
for f, mark in SECTIONS[1:]:
    hits = [i for i, l in enumerate(lines) if l.startswith('  ' + mark)]
    assert len(hits) == 1, (mark, hits)
    cuts.append(hits[0])
assert cuts == sorted(cuts), cuts
# the last lines (start the game) go to their own boot file: from the final `renderAll();` that is followed only by boot calls
boot_at = max(i for i, l in enumerate(lines) if l == '  renderAll();')
cuts.append(boot_at); cuts.append(len(lines))
files = [f for f, _ in SECTIONS] + ['15-boot.js']
tags = []
for k, f in enumerate(files):
    chunk = '\n'.join(lines[cuts[k]:cuts[k + 1]]) + '\n'
    open(out + 'js/game/' + f, 'w', encoding='utf-8').write(chunk)
    tags.append(f'<script src="js/{f}"></script>')
# the files are joined back into ONE function at start-up, exactly like the old single script (same scope, same hoisting),
# so behaviour cannot change; the repository still keeps every topic in its own file
loader = """/* Капли 3D · loader: joins the game files (js/game/) into one script, exactly like the former single <script>.
   Every file shares one scope, so the code works the same as before the split. KAPLI_MAP turns a line of
   kapli-game.js (in error stacks) back into the file and line it came from. */
(() => {
  const FILES = %s;
  const fail = e => { const s = document.getElementById('splashState') || document.querySelector('.splash'); if (s) s.insertAdjacentHTML('beforeend', '<p style="color:#ff8aa8;margin-top:12px">Не удалось загрузить игру. Проверь интернет и открой её ещё раз.</p>'); console.error(e); };
  Promise.all(FILES.map(f => fetch('js/game/' + f).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.text(); }))).then(texts => {
    const map = []; let line = 2;
    texts.forEach((t, i) => { map.push({ file: FILES[i], from: line }); line += t.split('\\n').length - 1; });
    window.KAPLI_MAP = map;
    window.kapliWhere = n => { let m = map[0]; for (const x of map) if (x.from <= n) m = x; return m ? m.file + ':' + (n - m.from + 1) : '?:' + n; };
    const sc = document.createElement('script');
    sc.textContent = '(function () {\\n' + texts.join('') + '})();\\n//# sourceURL=kapli-game.js';
    document.body.appendChild(sc);
  }).catch(fail);
})();
""" % ('[' + ', '.join(f"'{f}'" for f in files) + ']')
open(out + 'js/loader.js', 'w', encoding='utf-8').write(loader)
html = html[:a] + '<script src="three.min.js"></script>\n<script src="js/loader.js"></script>' + html[end + len('\n})();\n</script>'):]
# 2c. app version / offline script (the last inline script)
m = re.search(r'<script>\n(/\* installable app.*?)</script>', html, re.S)
open(out + 'js/app.js', 'w', encoding='utf-8').write(m.group(1))
html = html[:m.start()] + '<script src="js/app.js"></script>' + html[m.end():]
assert '<script>' not in html, 'an inline script is left'
open(out + 'index.html', 'w', encoding='utf-8').write(html)

# ---------- 3. the rest of the folder + offline cache list ----------
for fn in os.listdir(src):
    if fn != 'index.html' and os.path.isfile(src + fn): shutil.copy(src + fn, out + fn)
sw = open(out + 'sw.js', encoding='utf-8').read()
extra = ['js/emotes.js', 'js/loader.js'] + ['js/game/' + f for f in files] + ['js/app.js'] + sorted('css/' + x for x in os.listdir(out + 'css'))
sw = re.sub(r'(const CORE = \[)(.*?)(\];)', lambda m: m.group(1) + m.group(2) + ', ' + ', '.join(f'"{x}"' for x in extra) + m.group(3), sw, count=1, flags=re.S)
open(out + 'sw.js', 'w', encoding='utf-8').write(sw)

# ---------- 4. syntax check of every script file (as a classic script) ----------
bad = []
joined = '(function () {\n' + ''.join(open(out + 'js/game/' + f, encoding='utf-8').read() for f in files) + '})();\n'
open('/tmp/kapli-joined.js', 'w').write(joined)
r = subprocess.run(['node', '--check', '/tmp/kapli-joined.js'], capture_output=True, text=True)
if r.returncode: bad.append(('joined game', r.stderr.strip().split('\n')[-1]))
same = joined == '(function () {\n' + game + '\n})();\n'
print('joined game identical to the original (after dedent):', same)
for fn in sorted(x for x in os.listdir(out + 'js') if x.endswith('.js')):
    r = subprocess.run(['node', '--check', out + 'js/' + fn], capture_output=True, text=True)
    if r.returncode: bad.append((fn, r.stderr.strip().split('\n')[-1]))
print('css:', sorted(os.listdir(out + 'css')))
print('js :', len(os.listdir(out + 'js')), 'files; index.html', len(html.split('\n')), 'lines')
print('syntax errors:', bad or 'none')
