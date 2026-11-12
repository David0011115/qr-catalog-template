// Captures computed styles + boxes of every element on a set of screens, for two builds, and reports differences.
const { chromium } = require('playwright'), fs = require('fs');
const PROPS = ['display','position','top','left','right','bottom','width','height','margin-top','margin-left','padding-top','padding-left','padding-right','padding-bottom','font-size','font-weight','font-family','line-height','color','background-color','background-image','border-top-width','border-top-color','border-radius','box-shadow','opacity','transform','z-index','gap','grid-template-columns','flex-direction','justify-content','align-items','text-align','overflow','visibility','text-shadow','filter','backdrop-filter','white-space','letter-spacing','text-transform'];
const SCREENS = [
  ['menu', []], ['chests', ['chestBtn']], ['shop', ['shopBack|chestBack', 'shopBtn']], ['settings', ['shopBack', 'setBtn']], ['chat', ['setBack', 'chatBtn']],
  ['chatTheme', ['chatThemeGear']], ['leagues', ['chatThemeClose', 'chatBack', 'hubLeagueBtn']], ['profile', ['@back', 'acctChip']], ['news', ['profBack', 'newsBtn']], ['info', ['@back', 'infoBtn']]];
async function grab(port, vw, vh) {
  const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: vw, height: vh } }); await p.emulateMedia({ reducedMotion: 'reduce' });
  await p.addInitScript(() => { let s = 12345; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const T0 = new Date('2026-11-12T12:00:00+05:00').getTime(), RealDate = Date, start = performance.now();
    class FDate extends RealDate { constructor(...a) { super(...(a.length ? a : [T0 + (performance.now() - start)])); } static now() { return T0 + (performance.now() - start); } }
    window.Date = FDate; });
  await p.route(/supabase\.co/, r => r.abort());
  await p.goto(`http://localhost:${port}/local.html`); await p.evaluate(()=>{localStorage.clear(); localStorage.setItem('blobs3d-save-test', JSON.stringify({tutSeen:true,resetOffer170:true,newsSeen:99999,giftSeen:['bday2026','ny2027']}));}); await p.reload(); await p.waitForTimeout(5500);
  await p.evaluate(() => { const b=[...document.querySelectorAll('.modal:not([hidden]) button')].find(x=>/Понятно|Закрыть|Позже|Пропустить|Отлично/.test(x.textContent)); if(b) b.click(); });
  const out = {};
  for (const [name, clicks] of SCREENS) {
    for (const c of clicks) { await p.evaluate(c => { if (c === '@back') { [...document.querySelectorAll('.card:not([hidden]) .card-back, .card:not([hidden]) [id$="Back"]')][0]?.click(); return; } for (const id of c.split('|')) { const e = document.getElementById(id); if (e && e.offsetParent !== null) { e.click(); return; } } }, c); await p.waitForTimeout(450); }
    out[name] = await p.evaluate(PROPS => { const res = {}; let i = 0;
      document.querySelectorAll('body *').forEach(el => { if (el.closest('svg') && el.tagName !== 'svg') return; const cs = getComputedStyle(el); if (cs.display === 'none') return; const r = el.getBoundingClientRect();
        const id = el.id ? '#' + el.id : (el.className && typeof el.className === 'string' ? el.tagName.toLowerCase() + '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.') : el.tagName.toLowerCase());
        res[(i++) + ' ' + id] = ([Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)].join(',') + ' ' + PROPS.map(k => cs.getPropertyValue(k)).join('|')).replace(/https?:\/\/localhost:\d+\/(css\/\.\.\/)?/g, ''); });
      return res; }, PROPS);
  }
  await b.close(); return out;
}
(async () => {
  for (const [vw, vh] of [[986, 443], [390, 844]]) {
    const A = await grab(+process.argv[2] || 8781, vw, vh), B = await grab(+process.argv[3] || 8782, vw, vh); let diffs = 0, total = 0;
    for (const s of Object.keys(A)) { const a = A[s], bb = B[s] || {}; const ka = Object.keys(a);
      total += ka.length;
      for (const k of ka) if (a[k] !== bb[k]) { if (diffs < 12) { const pa = a[k].split(' '), pb = (bb[k] || '').split(' '); const props = a[k].split(' ').slice(1).join(' ').split('|'), propsB = (bb[k] || '').split(' ').slice(1).join(' ').split('|');
            const which = []; if (pa[0] !== pb[0]) which.push('box ' + pa[0] + ' → ' + pb[0]); props.forEach((v, j) => { if (v !== propsB[j]) which.push(PROPS[j] + ': ' + v.slice(0, 50) + ' → ' + (propsB[j] || '').slice(0, 50)); });
            console.log(`[${vw}x${vh}] ${s} ${k}: ${which.join('; ')}`); } diffs++; }
      if (Object.keys(bb).length !== ka.length) console.log(`[${vw}x${vh}] ${s}: element count ${ka.length} vs ${Object.keys(bb).length}`); }
    console.log(`${vw}x${vh}: screens ${Object.keys(A).length}, elements compared ${total}, differences ${diffs}`);
  }
})();
