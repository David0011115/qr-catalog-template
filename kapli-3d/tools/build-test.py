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
open(out + 'index.html', 'w', encoding='utf-8').write(s)
open(out + 'local.html', 'w', encoding='utf-8').write('<meta charset="utf-8">\n' + s)
print('ok')
