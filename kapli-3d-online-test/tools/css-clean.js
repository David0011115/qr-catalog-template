// Removes dead CSS: a declaration is dead when a LATER rule with the exact same selector, in the exact same @media/@supports context,
// sets the same property (and the earlier one is not !important while the later is not). Fallbacks for newer CSS (dvh, color-mix…) are kept.
// usage: node css-clean.js <css dir> (files are processed as one stylesheet in name order, written back in place)
const fs = require('fs'), path = require('path'), postcss = require('postcss');
const dir = process.argv[2], files = fs.readdirSync(dir).filter(f => f.endsWith('.css')).sort();
const roots = files.map(f => postcss.parse(fs.readFileSync(path.join(dir, f), 'utf8'), { from: f }));
const NEW = /\b(dvh|svh|lvh|dvw|svw|lvw|dvmin|dvmax)\b|color-mix\(|:has\(|\blh\b|text-wrap|light-dark\(/i;
const ctxOf = node => { const c = []; let p = node.parent; while (p && p.type !== 'root') { if (p.type === 'atrule') c.unshift('@' + p.name + ' ' + p.params.replace(/\s+/g, ' ').trim()); p = p.parent; } return c.join(' | '); };
const norm = s => s.replace(/\s+/g, ' ').replace(/\s*([>+~,])\s*/g, '$1').trim();
// walk every declaration in order across all files
const decls = [];
roots.forEach(r => r.walkDecls(d => { if (d.parent.type !== 'rule') return; decls.push(d); }));
const seen = new Map(); let removed = 0, kept = 0;
for (let i = decls.length - 1; i >= 0; i--) {
  const d = decls[i], rule = d.parent;
  if (rule.parent && rule.parent.type === 'atrule' && /keyframes/i.test(rule.parent.name)) continue;
  const key = ctxOf(rule) + ' || ' + norm(rule.selector) + ' || ' + d.prop.toLowerCase();
  const later = seen.get(key);
  if (later && later.rule !== rule && (later.important || !d.important)) {
    if (NEW.test(later.value) && !NEW.test(d.value)) kept++;   // the earlier value is the fallback for browsers without the newer CSS
    else { d.remove(); removed++; continue; }
  }
  if (!later || (d.important && !later.important)) seen.set(key, { rule, important: d.important || (later && later.important), value: d.value });
}
// drop rules and at-rules left empty
let emptyRules = 0;
const prune = r => { let ch = true; while (ch) { ch = false; r.walk(n => { if ((n.type === 'rule' || n.type === 'atrule') && n.nodes && n.nodes.filter(x => x.type !== 'comment').length === 0 && !/keyframes|font-face/i.test(n.name || '')) { n.remove(); emptyRules++; ch = true; } }); } };
roots.forEach(prune);
let before = 0, after = 0;
files.forEach((f, i) => { const p = path.join(dir, f); before += fs.readFileSync(p, 'utf8').length; const out = roots[i].toString().replace(/\n{3,}/g, '\n\n'); fs.writeFileSync(p, out); after += out.length; });
console.log(`removed declarations: ${removed}, empty rules: ${emptyRules}, kept (new-CSS fallbacks): ${kept}; size ${before} → ${after} bytes (−${Math.round((1 - after / before) * 100)}%)`);
