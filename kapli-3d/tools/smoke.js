const { chromium } = require('playwright');
(async () => { const port = process.argv[2] || 8776; const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] }); const p = await b.newPage({ viewport: { width: 844, height: 390 } }); const errs=[];
  p.on('pageerror', e => errs.push('PE '+e.message+' @'+(e.stack||'').split('\n')[1])); p.on('console', m => { if (m.type()==='error' && !/supabase|Failed to load|ERR_|404/.test(m.text())) errs.push('C '+m.text()); });
  await p.route(/supabase\.co/, r => r.abort());
  await p.goto(`http://localhost:${port}/local.html`); await p.evaluate(()=>{localStorage.clear(); localStorage.setItem('blobs3d-save-test', JSON.stringify({tutSeen:true,resetOffer170:true,newsSeen:99999,giftSeen:['bday2026','ny2027']}));}); await p.reload(); await p.waitForTimeout(5500);
  const close = () => p.evaluate(() => { const b=[...document.querySelectorAll('.modal:not([hidden]) button')].find(x=>/Понятно|Закрыть|Позже|Пропустить|Отлично/.test(x.textContent)); if(b) b.click(); });
  await close();
  const steps = [['menu', null], ['chests', 'chestBtn'], ['back', 'chestBack'], ['shop', 'shopBtn'], ['shopBack','shopBack'], ['settings','setBtn'], ['setBack','setBack'], ['chat','chatBtn'], ['chatBack','chatBack'], ['leagues','hubLeagueBtn']];
  const seen = [];
  for (const [n, id] of steps) { if (id) await p.evaluate(id=>{ const e=document.getElementById(id); e && e.click(); }, id); await p.waitForTimeout(700); seen.push(n + ':' + await p.evaluate(()=>[...document.querySelectorAll('.card:not([hidden])')].map(c=>c.id).join('/'))); }
  await p.evaluate(()=>{ [...document.querySelectorAll('.card:not([hidden]) .card-back, .card:not([hidden]) [id$="Back"]')][0]?.click(); }); await p.waitForTimeout(400);
  await p.evaluate(()=>document.getElementById('startBtn').click()); await p.waitForTimeout(6000); await close(); await p.waitForTimeout(3000);
  seen.push('round mass=' + await p.evaluate(()=>document.querySelector('#hud')?.innerText.replace(/\s+/g,' ').slice(0,80)));
  await p.screenshot({ path: process.argv[3] || 'shots/split-round.png' });
  console.log(seen.join('\n')); console.log('ERR', errs.join('\n')); await b.close(); })();
