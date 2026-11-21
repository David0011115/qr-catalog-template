  // ================= arena preview: live 3D fly-around of any arena; buy / select / flip through from it =================
  let apv = null;
  const apvOwned = a => a.id === 'default' || save.arenas.includes(a.id);
  function apvShow() {
    const a = ARENAS[apv.i], own = apvOwned(a), on = save.arena === a.id, lvOk = playerLevel() >= (a.lvl || 1);
    apvArena = a; applyArena();
    const how = a.legend ? `легендарное достижение «${LEGEND.find(l => l.id === a.legend).name}»` : a.src;
    const act = on ? '<button class="btn ghost" disabled>Выбрана</button>'
      : own ? '<button class="btn" id="apvDo">Выбрать</button>'
      : a.price ? `<button class="btn ${save.coins >= a.price && lvOk ? '' : 'ghost'}" id="apvDo" ${save.coins >= a.price && lvOk ? '' : 'disabled'}>${lvOk ? `Купить · ${a.price.toLocaleString('ru-RU')} ◆` : `Откроется с ${a.lvl} уровня`}</button>${lvOk && save.coins < a.price ? `<small>Не хватает ${(a.price - save.coins).toLocaleString('ru-RU')} ◆</small>` : ''}`
      : `<button class="btn ghost" disabled>🔒 Не в продаже</button><small>Как получить: ${how}</small>`;
    $('apvCard').style.setProperty('--apc', a.rim);
    $('apvCard').innerHTML = `<div class="apv-row"><b>${a.name}</b><span class="apv-n">${apv.i + 1} / ${ARENAS.length}${a.exclusive || a.legend ? ' · эксклюзив' : own ? ' · твоя' : ''}</span></div>` +
      `<small>${a.desc}.</small><small class="apv-fx">Особенность: ${ARENA_FX[a.id] || '—'} <span style="color:var(--muted)">(в обычных режимах)</span></small>${act}`;
  }
  function openArenaPreview(id, retId) {
    apv = { i: Math.max(0, ARENAS.findIndex(a => a.id === id)), ang: .5, pitch: .62, dist: R * 1.55, auto: true, drag: false, last: 0, pts: new Map(), pinch: 0, resume: 0, retId };
    focus.x = 0; focus.z = 0;
    $('overlay').hidden = true; document.body.classList.add('apv-on'); $('apv').hidden = false;
    apvShow(); $('apvClose').focus();
  }
  function closeArenaPreview() {
    if (!apv) return; const retId = apv.retId; clearTimeout(apv.resume); apv = null; apvArena = null;
    applyArena(); setHoliday(curHoliday);
    $('apv').hidden = true; document.body.classList.remove('apv-on'); $('overlay').hidden = false;
    renderShop(); const r = retId && $(retId); if (r) r.focus();
  }
  function apvStep(d) { apv.i = (apv.i + d + ARENAS.length) % ARENAS.length; apvShow(); }
  function apvCam(now) {
    const dt = Math.min(.05, (now - (apv.last || now)) / 1000); apv.last = now;
    if (apv.auto) apv.ang += dt * .14;
    const c = Math.cos(apv.pitch) * apv.dist;
    camLook.set(0, 0, 0); camPos.set(Math.sin(apv.ang) * c, Math.sin(apv.pitch) * apv.dist, Math.cos(apv.ang) * c);
  }
  $('apvClose').addEventListener('click', closeArenaPreview);
  $('apvPrev').addEventListener('click', () => apvStep(-1));
  $('apvNext').addEventListener('click', () => apvStep(1));
  $('apvCard').addEventListener('click', e => {
    if (!e.target.closest('#apvDo')) return;
    const a = ARENAS[apv.i];
    if (!apvOwned(a)) { if (!a.price || save.coins < a.price || playerLevel() < (a.lvl || 1)) return; coinsSpend(a.price, 'arena'); save.arenas.push(a.id); toast(`Арена «${a.name}» куплена и включена`); }
    else toast(`Арена «${a.name}» выбрана`);
    save.arena = a.id;
    for (const ch of checkChallenges()) toast(`Испытание «${ch.name}»: ${rewardName(ch.reward)}`);
    persist(); renderAll(); apvShow(); const b = $('apvCard').querySelector('button'); if (b) b.focus();
  });
  { const el = $('apvTouch'), clampN = (v, a, b) => Math.max(a, Math.min(b, v));
    const hold = () => { apv.auto = false; clearTimeout(apv.resume); };
    const release = () => { apv.resume = setTimeout(() => { if (apv) apv.auto = true; }, 2500); };
    el.addEventListener('pointerdown', e => { if (!apv) return; el.setPointerCapture(e.pointerId); apv.pts.set(e.pointerId, [e.clientX, e.clientY]); hold(); });
    el.addEventListener('pointermove', e => {
      if (!apv || !apv.pts.has(e.pointerId)) return;
      const [px, py] = apv.pts.get(e.pointerId); apv.pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (apv.pts.size === 1) { apv.ang -= (e.clientX - px) * .006; apv.pitch = clampN(apv.pitch + (e.clientY - py) * .004, .12, 1.35); }
      else if (apv.pts.size === 2) { const [a, b] = [...apv.pts.values()], d = hyp(a[0] - b[0], a[1] - b[1]); if (apv.pinch) apv.dist = clampN(apv.dist * apv.pinch / d, R * .45, R * 2.2); apv.pinch = d; }
    });
    const up = e => { if (!apv) return; apv.pts.delete(e.pointerId); apv.pinch = 0; if (!apv.pts.size) release(); };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', e => { if (!apv) return; e.preventDefault(); hold(); apv.dist = clampN(apv.dist * (1 + Math.sign(e.deltaY) * .1), R * .45, R * 2.2); release(); }, { passive: false });
  }
  document.addEventListener('keydown', e => {
    if (!apv) return;
    if (e.key === 'Escape') { e.stopPropagation(); e.preventDefault(); closeArenaPreview(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { if (!e.target.closest('input, select, textarea')) { e.preventDefault(); apvStep(e.key === 'ArrowLeft' ? -1 : 1); } }
  }, true);

  // ================= render loop =================
  const crownMesh = makeCrown(); crownMesh.visible = false; scene.add(crownMesh);
  const camPos = new THREE.Vector3(0, 40, 30), camLook = new THREE.Vector3(), tmpV = new THREE.Vector3();
  let focus = { x: 0, z: 0, m: START_MASS };
  function resize() {
    renderer.setSize(innerWidth, innerHeight, false);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize); resize();

  // ================= pet companion =================
  function petLv(kind) { const pt = petById(save.pet); return pt && pt.bonus === kind && !(stats && (stats.ranked || stats.duo)) ? pt.lv : 0; }   // matches for two: no pets, like the leagues
  let petObj = null, petT = 0;
  const basicMat = c => new THREE.MeshBasicMaterial({ color: c });
  function buildPet(pt) {
    const g = new THREE.Group(), col = new THREE.Color(pt.color), acc = new THREE.Color(pt.accent);
    const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .35, roughness: .3 });
    const accMat = new THREE.MeshStandardMaterial({ color: acc, emissive: acc, emissiveIntensity: .5, roughness: .3 });
    const M = (geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); g.add(o); return o; };
    const eyes = (y, z, sp = .17) => [-sp, sp].forEach(x => { const e = M(new THREE.SphereGeometry(.09, 8, 6), eyeMat, x, y, z); const pp = new THREE.Mesh(new THREE.SphereGeometry(.05, 6, 5), pupilMat); pp.position.z = .05; e.add(pp); });
    switch (pt.species) {
      case 'cat': M(new THREE.SphereGeometry(.5, 18, 14), mat); [-.27, .27].forEach(x => { const ear = M(new THREE.ConeGeometry(.16, .3, 4), accMat, x, .48, 0); ear.rotation.z = -x * .8; }); eyes(.1, .45); break;
      case 'cube': M(new THREE.BoxGeometry(.8, .8, .8), mat); eyes(.1, .42); break;
      case 'pyramid': M(new THREE.ConeGeometry(.6, .95, 4), mat).rotation.y = Math.PI / 4; eyes(-.05, .3, .14); break;
      case 'jelly': M(new THREE.SphereGeometry(.55, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; M(new THREE.CylinderGeometry(.04, .02, .6, 5), accMat, Math.cos(a) * .35, -.3, Math.sin(a) * .35); } eyes(.2, .45); break;
      case 'firefly': M(new THREE.SphereGeometry(.28, 14, 10), mat); g.add(glowSprite(acc, 2.6, .9)); eyes(.06, .25, .1); break;
      case 'robot': M(new THREE.BoxGeometry(.7, .65, .6), mat); M(new THREE.CylinderGeometry(.03, .03, .35, 5), accMat, 0, .5, 0); M(new THREE.SphereGeometry(.09, 8, 6), accMat, 0, .7, 0); eyes(.05, .31); break;
      case 'ghost': { const gm = mat.clone(); gm.transparent = true; gm.opacity = .8; M(new THREE.SphereGeometry(.45, 16, 12), gm, 0, .1, 0); M(new THREE.ConeGeometry(.45, .6, 12, 1, true), gm, 0, -.35, 0).rotation.x = Math.PI; eyes(.15, .4); break; }
      case 'pumpkin': M(new THREE.SphereGeometry(.5, 16, 12), mat).scale.set(1.1, .85, 1.1); M(new THREE.CylinderGeometry(.05, .07, .22, 6), accMat, 0, .5, 0); eyes(.08, .48); break;
      case 'bat': M(new THREE.SphereGeometry(.38, 14, 10), mat); [-1, 1].forEach(sx => { const w = M(new THREE.ConeGeometry(.3, .7, 3), accMat, sx * .55, .05, 0); w.rotation.z = sx * Math.PI / 2; w.userData.wing = sx; }); eyes(.08, .35, .13); break;
      case 'snowman': M(new THREE.SphereGeometry(.42, 14, 10), mat, 0, -.2, 0); M(new THREE.SphereGeometry(.3, 14, 10), mat, 0, .4, 0); M(new THREE.ConeGeometry(.06, .25, 6), accMat, 0, .38, .35).rotation.x = Math.PI / 2; eyes(.48, .26, .1); break;
      case 'deer': M(new THREE.SphereGeometry(.45, 14, 10), mat); [-1, 1].forEach(sx => { const an = M(new THREE.CylinderGeometry(.03, .04, .45, 5), accMat, sx * .22, .55, 0); an.rotation.z = -sx * .5; }); M(new THREE.SphereGeometry(.08, 8, 6), accMat, 0, 0, .45); eyes(.15, .38); break;
      case 'heart': { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ICONS.heart, color: col, transparent: true })); sp.scale.setScalar(1.4); g.add(sp); break; }
      case 'cupid': M(new THREE.SphereGeometry(.38, 14, 10), mat); [-1, 1].forEach(sx => { const w = M(new THREE.SphereGeometry(.25, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }), sx * .45, .15, -.1); w.scale.set(1, .5, .2); w.userData.wing = sx; }); M(new THREE.TorusGeometry(.22, .03, 6, 24), accMat, 0, .55, 0).rotation.x = Math.PI / 2; eyes(.08, .35, .13); break;
      // ---- 1.7.0 species ----
      case 'meteor': { const rock = M(new THREE.DodecahedronGeometry(.42, 0), new THREE.MeshStandardMaterial({ color: '#3a2a2a', emissive: col, emissiveIntensity: .35, roughness: .9, flatShading: true })); rock.userData.spin = 1;
        [0, 1, 2].forEach(i => { const fl = glowSprite(i ? acc : col, 1.1 - i * .25, .9); fl.position.set(0, 0, -.45 - i * .32); fl.userData.flick = 1.1 - i * .25; g.add(fl); }); eyes(.08, .38, .14); break; }
      case 'fox': M(new THREE.SphereGeometry(.42, 16, 12), mat); [-1, 1].forEach(sx => { const ear = M(new THREE.ConeGeometry(.13, .34, 4), accMat, sx * .22, .45, 0); ear.rotation.z = -sx * .3; });
        M(new THREE.SphereGeometry(.16, 10, 8), accMat, 0, -.05, .38).scale.set(1, .8, 1.2); { const tail = M(new THREE.ConeGeometry(.18, .7, 10), accMat, 0, .1, -.55); tail.rotation.x = -Math.PI / 2 - .4; tail.userData.tail = 1; } eyes(.12, .36, .15); break;
      case 'astro': { M(new THREE.SphereGeometry(.46, 18, 14), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#c9d6ff', emissiveIntensity: .25, roughness: .4 }));
        const visor = M(new THREE.SphereGeometry(.34, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#120830', emissive: acc, emissiveIntensity: .5, metalness: .6, roughness: .1 }), 0, .05, .2); visor.rotation.x = Math.PI / 2;
        M(new THREE.BoxGeometry(.4, .4, .2), accMat, 0, 0, -.45); const ant = M(new THREE.SphereGeometry(.06, 8, 6), basicMat(acc), .2, .52, 0); ant.add(glowSprite(acc, .6, 1)); break; }
      case 'qubit': { const shell = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .3, transparent: true, opacity: .35, roughness: .1 }); M(new THREE.BoxGeometry(.75, .75, .75), shell);
        const core = M(new THREE.BoxGeometry(.32, .32, .32), basicMat(acc)); core.userData.spin = 1; core.add(glowSprite(acc, 1.2, .8)); eyes(.12, .4, .15); g.userData.blink = 1; break; }
      case 'snake': for (let i = 0; i < 6; i++) { const seg = M(new THREE.SphereGeometry(.3 - i * .035, 12, 10), i % 2 ? accMat : mat, 0, 0, -i * .36); seg.userData.seg = i; if (!i) eyes(.1, .26, .11); } break;
      case 'star': { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ICONS.star, color: col, transparent: true })); sp.scale.setScalar(1.3); sp.userData.starSpin = 1; g.add(sp); g.add(glowSprite(acc, 1.8, .6)); eyes(.04, .12, .12); break; }
      case 'tape': M(new THREE.BoxGeometry(.8, .55, .4), mat); { const scr = M(new THREE.PlaneGeometry(.6, .32), basicMat('#120830'), 0, .03, .21); scr.userData.screen = 1;
        [-1, 1].forEach(sx => { const reel = M(new THREE.CylinderGeometry(.09, .09, .03, 12), basicMat(acc), sx * .15, .03, .23); reel.rotation.x = Math.PI / 2; reel.userData.reel = 1; }); M(new THREE.CylinderGeometry(.02, .02, .3, 5), accMat, .3, .42, 0); } break;
      case 'beetle': { const shell = M(new THREE.SphereGeometry(.45, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat); shell.scale.set(1, .7, 1.2);
        for (let i = 0; i < 6; i++) { const lg = M(new THREE.CylinderGeometry(.02, .02, .35, 4), accMat, (i % 2 ? 1 : -1) * .42, -.08, (Math.floor(i / 2) - 1) * .25); lg.rotation.z = (i % 2 ? -1 : 1) * 1.1; }
        [-1, 1].forEach(sx => { const tip = M(new THREE.SphereGeometry(.06, 8, 6), basicMat(col), sx * .15, .3, .5); tip.add(glowSprite(col, .9, 1)); tip.userData.blinkTip = sx; }); eyes(.1, .45, .13); break; }
      case 'crystal': { const cr = M(new THREE.OctahedronGeometry(.48, 0), new THREE.MeshStandardMaterial({ color: col, emissive: acc, emissiveIntensity: .45, roughness: .05, metalness: .3, flatShading: true, transparent: true, opacity: .88 })); cr.scale.y = 1.35; cr.userData.spin = 1; eyes(.05, .3, .12); break; }
      case 'hole': { M(new THREE.SphereGeometry(.34, 16, 12), basicMat('#000000')); const disk = M(new THREE.TorusGeometry(.55, .07, 6, 40), basicMat(acc)); disk.rotation.x = Math.PI / 2 - .4; disk.userData.disk = 1; disk.add(glowSprite(acc, 1.6, .5)); eyes(.06, .3, .12); break; }
      case 'dragon': M(new THREE.SphereGeometry(.4, 16, 12), mat); M(new THREE.SphereGeometry(.24, 12, 10), mat, 0, .2, .35);
        [-1, 1].forEach(sx => { const w = M(new THREE.ConeGeometry(.3, .7, 3), accMat, sx * .48, .15, -.05); w.rotation.z = sx * Math.PI / 2; w.userData.wing = sx; const hr = M(new THREE.ConeGeometry(.05, .2, 6), basicMat('#ffd23f'), sx * .1, .42, .38); hr.rotation.x = -.4; });
        { const tail = M(new THREE.ConeGeometry(.12, .55, 8), accMat, 0, 0, -.5); tail.rotation.x = -Math.PI / 2; tail.userData.tail = 1; } eyes(.26, .55, .1); break;
      case 'slime': { const sl = M(new THREE.SphereGeometry(.5, 16, 12), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: .35, transparent: true, opacity: .85, roughness: .1 })); sl.scale.y = .7; sl.userData.squash = 1;
        [-1, 1].forEach(sx => M(new THREE.BoxGeometry(.12, .12, .05), basicMat('#120820'), sx * .16, .08, .45)); break; }
      case 'brute': M(new THREE.BoxGeometry(.75, .62, .6), mat); M(new THREE.SphereGeometry(.38, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), accMat, 0, .3, 0); M(new THREE.ConeGeometry(.07, .3, 6), basicMat('#ffd23f'), 0, .72, 0);
        [-1, 1].forEach(sx => M(new THREE.SphereGeometry(.17, 10, 8), accMat, sx * .48, -.12, .12)); eyes(.06, .31, .15); break;
      // ---- 2.3 workshop «Хронос» ----
      case 'cuckoo': { M(new THREE.SphereGeometry(.4, 16, 12), mat).scale.set(1, .9, 1.15); M(new THREE.SphereGeometry(.27, 14, 10), mat, 0, .32, .3);
        M(new THREE.ConeGeometry(.08, .26, 8), basicMat('#ffd23f'), 0, .3, .64).rotation.x = Math.PI / 2;
        { const tail = M(new THREE.ConeGeometry(.16, .5, 6), accMat, 0, .12, -.55); tail.rotation.x = -Math.PI / 2 - .5; tail.userData.tail = 1; }
        [-1, 1].forEach(sx => { const w = M(new THREE.SphereGeometry(.26, 10, 8), accMat, sx * .38, .05, -.05); w.scale.set(.35, .7, 1.1); w.userData.wing = sx; }); eyes(.4, .5, .11); break; }
      case 'mouse': { M(new THREE.SphereGeometry(.4, 16, 12), mat).scale.set(1, .75, 1.3); [-1, 1].forEach(sx => M(new THREE.SphereGeometry(.17, 12, 8), accMat, sx * .24, .32, .28).scale.set(1, 1, .35));
        M(new THREE.SphereGeometry(.06, 8, 6), basicMat('#ff8aa8'), 0, .02, .56); { const tail = M(new THREE.TorusGeometry(.22, .025, 6, 16, Math.PI * 1.2), accMat, 0, -.05, -.6); tail.rotation.y = Math.PI / 2; tail.userData.tail = 1; }
        { const key = new THREE.Group(); key.position.set(0, .34, -.08); key.userData.reel = 1; g.add(key); const km = new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#b06a1a', emissiveIntensity: .6, metalness: .6, roughness: .3 });
          const sh = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .26, 6), km); sh.position.y = .1; key.add(sh); [-1, 1].forEach(sx => { const lp = new THREE.Mesh(new THREE.TorusGeometry(.09, .03, 6, 14), km); lp.position.set(sx * .11, .26, 0); key.add(lp); }); }
        eyes(.14, .46, .12); break; }
      case 'owl': { M(new THREE.SphereGeometry(.45, 16, 12), mat).scale.set(1, 1.12, .95); [-1, 1].forEach(sx => { const t2 = M(new THREE.ConeGeometry(.09, .3, 6), accMat, sx * .24, .55, .05); t2.rotation.z = -sx * .4; });
        M(new THREE.CircleGeometry(.2, 20), basicMat('#fff6d8'), 0, -.12, .44); { const fc = M(new THREE.PlaneGeometry(.38, .38), new THREE.MeshBasicMaterial({ map: ICONS.clock, color: '#2a1a08', transparent: true }), 0, -.12, .445); fc.userData.owlDial = 1; }
        [-1, 1].forEach(sx => { const w = M(new THREE.SphereGeometry(.24, 10, 8), accMat, sx * .44, -.05, -.02); w.scale.set(.3, .75, .9); w.userData.wing = sx; });
        eyes(.2, .4, .16); { const mono = M(new THREE.TorusGeometry(.13, .025, 6, 20), new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#b06a1a', emissiveIntensity: .7, metalness: .7 }), .16, .2, .47); mono.userData.mono = 1; } break; }
      default: M(new THREE.SphereGeometry(.5, 18, 14), mat); eyes(.1, .45);
    }
    g.add(glowSprite(col, 2.2, .45));
    g.userData.pt = pt; g.userData.mats = [mat, accMat];
    g.visible = false; scene.add(g);
    return g;
  }
  function animatePetLook(g, now) {
    const t = now / 1000, pt = g.userData.pt || {};
    g.children.forEach(o => { const u = o.userData;
      if (u.spin) { o.rotation.y = t * 1.5; o.rotation.x = t * .7; }
      if (u.flick) o.scale.setScalar(u.flick * (.75 + Math.random() * .4));
      if (u.tail) o.rotation.y = Math.sin(t * 6) * .5;
      if (u.seg !== undefined) o.position.x = Math.sin(t * 5 - u.seg * .8) * .18 * (u.seg ? 1 : .3);
      if (u.starSpin) o.material.rotation = t * 1.2;
      if (u.reel) o.rotation.y = t * 6;
      if (u.owlDial) o.rotation.z = -t * 1.2;
      if (u.blinkTip) o.visible = Math.sin(t * 6 + u.blinkTip) > -.5;
      if (u.disk) o.rotation.z = t * 2.5;
      if (u.squash) { const k = Math.sin(t * 5); o.scale.set(1 + k * .08, .7 - k * .08, 1 + k * .08); }
      if (u.screen) o.material.color.setHSL((t * .2) % 1, .8, .25 + .1 * Math.sin(t * 8)); });
    if (g.userData.blink) g.visible = g.visible && Math.random() > .03;
    if (pt.holo || pt.rainbow) { const h = pt.rainbow ? (t * .25) % 1 : .5 + .12 * Math.sin(t); g.userData.mats.forEach((m, i) => { m.color.setHSL((h + i * .3) % 1, 1, .6); m.emissive.setHSL((h + i * .3) % 1, 1, .4); }); }
  }
  function applyPet() {
    if (petObj) { scene.remove(petObj.g); petObj = null; }
    const pt = petById(save.pet);
    if (pt) petObj = { g: buildPet(pt), pt, x: 0, z: 0, y: 2 };
  }
  function animatePet(now, dt) {
    if (!petObj) return;
    const g = petObj.g;
    if (!player.cells.length) { g.visible = false; return; }
    const c = player.cells.reduce((a, b) => a.mass >= b.mass ? a : b), r = visualCellR(c), a = now / 1300;
    const tx = c.x + Math.cos(a) * (r + 2.2), tz = c.z + Math.sin(a) * (r + 2.2), ty = r * .9 + 1.3 + Math.sin(now / 280) * .3;
    const k = Math.min(1, dt * 6), px = petObj.x, pz = petObj.z;
    petObj.x += (tx - petObj.x) * k; petObj.z += (tz - petObj.z) * k; petObj.y += (ty - petObj.y) * k;
    g.position.set(petObj.x, petObj.y, petObj.z); g.visible = true;
    g.scale.setScalar(1 + Math.min(3, r * .12));
    if (Math.abs(petObj.x - px) + Math.abs(petObj.z - pz) > .001) g.rotation.y = Math.atan2(petObj.x - px, petObj.z - pz);
    g.children.forEach(o => { if (o.userData.wing) o.rotation.x = Math.sin(now / 90) * .5; });
    animatePetLook(g, now);
    // «Обжора» collects crumbs around itself
    petT -= dt;
    if (running && petT <= 0 && petObj.pt.bonus === 'eater' && petLv('eater')) {
      petT = .5; const rr = 2 + petObj.pt.lv, rr2 = rr * rr;
      for (let i = 0; i < FOOD; i++) { const f = foods[i]; if ((f.x - petObj.x) ** 2 + (f.z - petObj.z) ** 2 < rr2) { c.mass += 1; placeFood(i); } }
    }
    if (running) crPetTick(dt, c, now);
  }
  // ---- 2.3 «Хронос» pet skills ----
  let petCk = 60, petWd = 45, crArrowT = 0, crArrowB = null, owlNext = null;
  const textSprite = (txt, col) => { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const x = cv.getContext('2d'); x.font = '900 40px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = col; x.shadowColor = col; x.shadowBlur = 10; x.fillText(txt, 128, 34);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false })); sp.scale.set(4, 1, 1); sp.visible = false; scene.add(sp); return sp; };
  const cuckooTxt = textSprite('Ку-ку!', '#ffd27a'), windTxt = textSprite('−2 с', '#22e6ff'); let txtT = 0, txtSp = null;
  const crArrow = (() => { const sh = new THREE.Shape(); sh.moveTo(0, 1.6); sh.lineTo(1, .2); sh.lineTo(.36, .2); sh.lineTo(.36, -1.2); sh.lineTo(-.36, -1.2); sh.lineTo(-.36, .2); sh.lineTo(-1, .2); sh.closePath();
    const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), decal(new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: .9, depthWrite: false, side: THREE.DoubleSide }))); m.rotation.order = 'YXZ'; m.visible = false; scene.add(m); return m; })();
  const owlMark = (() => { const g = new THREE.Group(); const face = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), decal(new THREE.MeshBasicMaterial({ map: dialTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    face.rotation.x = -Math.PI / 2; face.position.y = .07; g.add(face); const hand = new THREE.Mesh(new THREE.PlaneGeometry(.05, .42), decal(new THREE.MeshBasicMaterial({ color: '#3dffa2', transparent: true, depthWrite: false })));
    hand.geometry.translate(0, .21, 0); hand.rotation.x = -Math.PI / 2; hand.position.y = .08; g.add(hand); const num = new THREE.Sprite(new THREE.SpriteMaterial({ map: ICONS.n5, color: '#3dffa2', transparent: true, depthWrite: false })); num.position.y = 3.2; num.scale.setScalar(2.4); g.add(num);
    g.userData = { hand, num }; g.scale.setScalar(5); g.visible = false; scene.add(g); return g; })();
  function showTxt(sp) { if (txtSp) txtSp.visible = false; txtSp = sp; txtT = 1.4; sp.visible = true; }
  function crPetTick(dt, c, now) {
    const kind = petObj.pt.bonus;
    if (txtSp) { txtT -= dt; txtSp.position.set(petObj.x, petObj.y + 1.6 + (1.4 - txtT) * .8, petObj.z); txtSp.material.opacity = Math.min(1, txtT * 2); if (txtT <= 0) { txtSp.visible = false; txtSp = null; } }
    if (kind === 'cuckoo' && petLv('cuckoo')) {
      petCk -= dt;
      if (petCk <= 0) { let best = null, bd = Infinity; for (const b of bonuses) { const d = hyp(b.x - c.x, b.z - c.z); if (d < bd) { bd = d; best = b; } }
        if (best) { petCk = 60; crArrowB = best; crArrowT = 3.5; showTxt(cuckooTxt); Sound.play('bonus'); } else petCk = 5; }
    }
    if (crArrowT > 0 && crArrowB && bonuses.includes(crArrowB)) { crArrowT -= dt; const dx = crArrowB.x - c.x, dz = crArrowB.z - c.z, d = hyp(dx, dz) || 1, rr = cellR(c) + 3.5;
      crArrow.position.set(c.x + dx / d * rr, .1, c.z + dz / d * rr); crArrow.rotation.set(-Math.PI / 2, Math.atan2(-dx, -dz), 0);
      crArrow.scale.setScalar(1.4 + Math.sin(now / 120) * .15); crArrow.material.opacity = Math.min(.9, crArrowT); crArrow.visible = true; }
    else { crArrow.visible = false; crArrowT = 0; }
    if (kind === 'windup' && petLv('windup')) {
      petWd -= dt;
      if (petWd <= 0) { petWd = 45; for (const k in player.abCd) player.abCd[k] = Math.max(0, player.abCd[k] - 2); player.dashCd = Math.max(0, (player.dashCd || 0) - 2); player.splitCd = Math.max(0, (player.splitCd || 0) - 2);
        emitIcons(c.x, cellR(c) * 1.4 + 1, c.z, 'gear', '#ffd27a', 5, 1.2); showTxt(windTxt); Sound.play('bonus'); }
    }
  }
  // «Совёнок-часовщик»: the next bonus spot is chosen 5 s early and marked with a ticking dial
  function owlTick(now) {
    if (!(petObj && petObj.pt.bonus === 'owl' && petLv('owl')) || mode === 'hardcore') { owlMark.visible = false; return; }
    if (!owlNext && bonusTimer <= 5 && bonuses.length < MAX_BONUS) { owlNext = randInArena(8); owlMark.position.set(owlNext[0], 0, owlNext[1]); }
    if (owlNext) { const left = Math.max(0, bonusTimer), u = owlMark.userData; owlMark.visible = true; u.hand.rotation.z = -(1 - left / 5) * Math.PI * 2; u.num.material.map = ICONS['n' + Math.max(1, Math.ceil(left))]; u.num.position.y = 3.2 + Math.sin(now / 200) * .15; }
  }
  function crPetReset() { petCk = 60; petWd = 45; crArrowT = 0; crArrowB = null; crArrow.visible = false; owlNext = null; owlMark.visible = false; if (txtSp) txtSp.visible = false; txtSp = null;
  }

  // holiday look for the running season (snow, embers, hearts and a recoloured rim)
  let curHoliday = null;
  function decorateArena() {
    const fx = arenaDef().fx; if (!fx || Math.random() > .6) return;
    const x = focus.x + (Math.random() - .5) * 90, z = focus.z + (Math.random() - .5) * 70, pick = a => a[(Math.random() * a.length) | 0];
    if (fx === 'embers') emit(x, .4, z, pick(['#ff3d00', '#ff9a3d', '#ffd23f']), 1, 3, 1.2);
    if (fx === 'snow') emit(x, 22, z, '#ffffff', 1, .3, 3.2);
    if (fx === 'bubbles') emit(x, .5, z, pick(['#7fe8ff', '#3dffa2']), 1, 2.5, 1.4);
    if (fx === 'fireflies') emit(x, 1 + Math.random() * 3, z, pick(['#c6ff3d', '#ffd23f']), 1, .8, 1.5);
    if (fx === 'sand') emit(x, .6, z, pick(['#ffb347', '#e8c27a']), 2, 4, .9);
    if (fx === 'rain') emit(x, 18, z, pick(['#22e6ff', '#ff4fd8', '#3dffa2']), 1, .2, 2.4);
    if (fx === 'petals') emit(x, 10 + Math.random() * 10, z, pick(['#ff9ec4', '#ffd1e8', '#ffffff']), 1, .5, 3);
    if (fx === 'ash') { emit(x, 14, z, pick(['#5a4a4a', '#8a7a7a']), 1, .3, 3); if (Math.random() < .5) emit(x, .4, z, pick(['#ff2d00', '#ff9a3d']), 1, 3.5, 1); }
    if (fx === 'aurora') { const t = performance.now() / 4000; nebulae.forEach((n, i) => n.material.color.setHSL((.38 + .4 * (.5 + .5 * Math.sin(t + i * 1.7))) % 1, 1, .5)); emit(x, 16 + Math.random() * 6, z, pick(['#3dffa2', '#b26bff', '#22e6ff']), 1, .2, 2); }
    if (fx === 'retro') emit(x, .5, z, pick(['#ff4fd8', '#22e6ff', '#ffd23f']), 1, 1.5, 1.4);
    if (fx === 'cosmos') emit(x, 2 + Math.random() * 10, z, pick(['#ffffff', '#b26bff', '#ff4fd8', '#9fd8ff']), 1, .1, 2.2);
    if (fx === 'gold') emit(x, .6 + Math.random() * 4, z, pick(['#ffd23f', '#fff6a0', '#ffffff']), 1, .6, 1.6);
  }
  function decorateHoliday() {
    decorateArena();
    if (!curHoliday || Math.random() > .5) return;
    const fx0 = focus.x + (Math.random() - .5) * 90, fz0 = focus.z + (Math.random() - .5) * 70;
    if (curHoliday === 'newyear') emit(fx0, 26, fz0, '#ffffff', 1, .4, 3.5);
    if (curHoliday === 'halloween') emit(fx0, .5, fz0, Math.random() < .5 ? '#ff7a00' : '#b26bff', 1, 1.5, 1.6);
    if (curHoliday === 'valentine' && Math.random() < .12) emitIcons(fx0, 1, fz0, 'heart', '#ff4f9a', 1, 1.6);
  }
  function setHoliday(k) {
    curHoliday = k;
    const col = k ? HOLIDAYS[k].rim : arenaDef().rim;
    rim.material.color.set(col); rimGlow.material.color.set(col); edgeGlow.material.color.set(col);
  }
  function draw(now) {
    if (!(draw.moodT > now)) { draw.moodT = now + 500; Sound.setMood(running && !paused ? (mode !== 'raid' && bossOwners.some(o => o.cells.length) ? 'boss' : 'game') : 'menu', stats && stats.ranked ? 'ranked' : mode);   /* 2.7: a theme per mode; the raid's own theme is already the boss music */ }
    // Relationship rings and hidden-boss visibility do not need 60 Hz checks.
    // Refreshing them at 10 Hz removes repeated canEat() scans when players split.
    const relationRefresh = now - (draw.relationAt || 0) >= 100;
    if (relationRefresh) draw.relationAt = now;
    // Cosmetics and ambient particles do not need 60 Hz updates. Keeping
    // transforms/camera at display rate while animating detail at 30 Hz
    // avoids bursts of material writes when many cells move together.
    const cosmeticRefresh = now - (draw.cosmeticAt || 0) >= 33;
    if (cosmeticRefresh) {
      draw.cosmeticAt = now;
      decorateHoliday();
      animatePet(now, Math.min(.05, (now - (draw.lastP || now)) / 1000));
      draw.lastP = now;
    }
    shineT.value = now / 1000;
    zoneLine.visible = zoneOut.visible = running && mode === 'royale';
    if (zoneLine.visible) { const Z = ModeX.zoneC; zoneLine.position.set(Z.x, .06, Z.z); zoneOut.position.set(Z.x, .06, Z.z); zoneLine.scale.setScalar(zoneR); zoneOut.scale.setScalar(zoneR); zoneLine.material.opacity = .6 + .4 * Math.sin(now / 200); }
    const shieldOn = effects && effects.shield > 0;
    // 2.7 FPS: on «Среднее» and «Низкое» only the biggest part of your drop wears the hat, aura and shine (each part drew them all)
    const pLead = QUALITY !== 'high' && player.cells.length > 1 ? mainOf(player) : null;
    for (const c of cells) {
      const r = visualCellR(c), v = c.vis, animateVisible = nearView(c.x, c.z);
      v.jig *= 0.93;
      const lk = v.look;
      if (lk) {
        const crownMode = mode === 'crown' && running;
        v.crown.visible = !!lk.crown && !v.hatOn && !crownMode;
        if (!c.owner.isPlayer || c.owner === player) { const show = c.owner === player ? (!pLead || c === pLead) : QUALITY !== 'low' && r * pxPerUnit >= 14; /* 2.7 FPS: a bot's hat, aura and gleam are not drawn while the drop is under ~14 px on screen */ if (v.aura) v.aura.visible = show; if (v.head) v.head.visible = show && !v.headOff; if (v.evo && c.owner === player && v.evoHid !== !show) { v.evoHid = !show; v.evo.children.forEach((k, i) => { if (!(i === 0 && v.evoBody)) k.visible = show; }); } if (v.shine) v.shine.visible = show && !v.evo && (isShiny(lk) || v.stars >= 2); if (v.starGlow) v.starGlow.visible = show && v.stars >= 3; }
        if (cosmeticRefresh && v.stars && Math.random() < .07 * v.stars && nearView(c.x, c.z)) emit(c.x + (Math.random() - .5) * r * 1.7, r * (.5 + Math.random() * 1.3), c.z + (Math.random() - .5) * r * 1.7, Math.random() < .5 ? '#ffffff' : lk.accent || lk.color, 1, 1.4, .6);
        if (cosmeticRefresh && v.starGlow && v.starGlow.visible) v.starGlow.material.opacity = .3 + .25 * Math.sin(now / 320 + c.x);
        if (v.aura && crownMode && v.aura.userData.type === 'crownAura') v.aura.visible = false;   // 2.7: no longer re-shows auras hidden above
        if (animateVisible && cosmeticRefresh) {
          animateAura(v, now); animateHead(v, now);
          if (lk.pulse) { const k = .5 + .5 * Math.sin(now / 280); v.mesh.material.emissiveIntensity = .25 + .8 * k; v.glow.material.opacity = .5 + .5 * k; }
          if (lk.holo) { const h = ((lk.holoBase ?? .5) + (lk.holoSpan ?? .17) * (1 + Math.sin(now / 900 + c.x * .05))) % 1; v.mesh.material.color.setHSL(h, 1, .62); v.mesh.material.emissive.setHSL(h, 1, .5); v.glow.material.color.setHSL(h, 1, .6); }
          if (lk.rainbow) { const h = (now / 4000 + c.x * 0.01) % 1; v.mesh.material.color.setHSL(h, 1, .6); v.mesh.material.emissive.setHSL(h, 1, .5); v.glow.material.color.setHSL(h, 1, .6); }
          animateLook(v, now, c);
        }
      }
      if (c.owner.bossType === 'chameleon' && (relationRefresh || c.seen === undefined)) {
        // Invisible until you are close: 10 Hz is enough for this proximity fade.
        let dmin = Infinity;
        for (const pc of player.cells) dmin = Math.min(dmin, hyp(pc.x - c.x, pc.z - c.z) - cellR(pc) - r);
        const al = !player.cells.length ? .9 : Math.max(.05, Math.min(.9, (30 - dmin) / 20));
        c.vis.mesh.material.opacity = al; c.vis.glow.material.opacity = al * .9; c.vis.crown.visible = al > .5; c.vis.ring.visible = al > .3; c.seen = al > .3;
      }
      const wobble = 1 + Math.sin(now / 260 + c.x) * 0.025 + Math.sin(now / 45) * 0.14 * v.jig;
      v.mesh.position.set(c.x, r * 0.92, c.z);
      v.mesh.scale.set(r * wobble, r * (2 - wobble) * 0.94, r * wobble);
      v.mesh.rotation.y = Math.atan2(c.hx, c.hz);
      v.ring.position.set(c.x, 0.03, c.z);
      v.ring.scale.setScalar(r);
      if (c.owner.isPlayer) {
        v.shield.visible = shieldOn;
        const mergeTone = player.freezeT > 0 || player.slowT > 0 ? 2 : c.mergeT > 0 ? 1 : 0;   // 2.7: an icy ring while slowed
        if (v._mergeTone !== mergeTone) {
          v.ring.material.color.set(mergeTone === 2 ? '#7fdcff' : mergeTone ? BONUS.shield.color : '#ffffff');
          v._mergeTone = mergeTone;
        }
        if (cosmeticRefresh) v.shield.material.opacity = 0.15 + 0.08 * Math.sin(now / 150);
      } else if (player.cells.length && (relationRefresh || v._ringTone === undefined)) {
        // Cache the expensive per-player canEat scans between render frames.
        let tone = 0; // neutral
        if (c.owner.team && c.owner.team === player.team) tone = 1; // ally
        else {
          const danger = player.cells.some(p => canEat(c, p));
          const food = !danger && player.cells.some(p => canEat(p, c));
          tone = danger ? 2 : food ? 3 : 0;
        }
        if (v._ringTone !== tone) {
          if (tone === 1) v.ring.material.color.set(ALLY_COLOR);
          else v.ring.material.color.copy(tone === 2 ? THREAT : tone === 3 ? PREY : NEUTRAL);
          v._ringTone = tone;
        }
      }
      // 2.7: in the modes for two the ring of a drop you can eat (green) or that can eat you (red) pulses and stands out past the edge
      if (DuoM.mode && !c.owner.isPlayer && (v._ringTone === 2 || v._ringTone === 3)) v.ring.scale.setScalar(r * (1.1 + .07 * Math.sin(now / 170)));
    }
    ejectMat.color.set(skin().color); ejectMat.emissive.set(skin().color);
    for (const v of viruses) { const rv = radius(v.mass); v.mesh.position.set(v.x, rv * .9, v.z); v.mesh.scale.setScalar(rv); v.mesh.rotation.y = now / 2000 + v.x; }
    if (meteorRing.visible) { meteorRing.scale.setScalar(40 + Math.sin(now / 200) * .8); meteorRing.material.opacity = ev.active ? .9 : .4 + .4 * Math.abs(Math.sin(now / 150)); }
    if (hole.visible) { holeRing.rotation.z = now / 400; }
    for (const e of ejects) e.mesh.position.set(e.x, radius(EJECT_MASS) * 0.9, e.z);
    if (cosmeticRefresh) for (const b of bonuses) {
      b.mesh.position.y = 1.2 + Math.sin(now / 300 + b.x) * 0.25;
      b.mesh.children[0].rotation.y = now / 500;
      b.mesh.children[1].rotation.x = now / 700; b.mesh.children[1].rotation.y = now / 900;
    }

    if (player.cells.length) {
      let m = 0, x = 0, z = 0;
      for (const c of player.cells) { m += c.mass; x += c.x * c.mass; z += c.z * c.mass; }
      focus = { x: x / m, z: z / m, m };
    } else if (!running) focus.m = 40;
    let spread = 0;
    if (player.cells.length > 1) {
      for (const c of player.cells) spread = Math.max(spread, hyp(c.x - focus.x, c.z - focus.z));
    }
    const fr = radius(focus.m);
    let h = (16 + fr * 4 + Math.max(0, fr - 10) * 2 + spread * 0.8) * 2.2 * (camera.aspect < 1 ? 1 + Math.min(.6, (1 - camera.aspect) * 1.1) : 1);   // giants get extra zoom-out; 120% farther for everyone (1.7.0); narrow portrait screens (phones) up to 60% more
    h = Math.min(h, 330);   // never leave the starry sky or lose the far edge of the arena
    fxViewK = h / FX_VIEW_BASE; pMat.size = Math.max(1, fxViewK * .7); eMat.size = 2.6 * Math.max(1, fxViewK * .7);   // particles keep their size on screen when the camera backs off
    camLook.lerp(tmpV.set(focus.x, 0, focus.z), 0.16);
    camPos.lerp(tmpV.set(focus.x, h, focus.z + h * 0.62), 0.12);
    if (apv) apvCam(now);
    camera.position.copy(camPos); camera.lookAt(camLook);
    // fog and shadows scale with the camera distance, so a big blob still sees clearly
    const camDist = camPos.distanceTo(camLook);
    pxPerUnit = innerHeight / 2 / Math.tan(camera.fov * Math.PI / 360) / Math.max(1, camDist);   // screen pixels per world unit at the arena (used next frame)
    stars.position.copy(camPos);   // the starfield always surrounds the camera
    const nearWanted = Math.max(.1, camDist * .02);   // keeps depth precision when the camera is far up
    if (Math.abs(camera.near - nearWanted) > nearWanted * .1) { camera.near = nearWanted; camera.updateProjectionMatrix(); }
    scene.fog.near = camDist * 1.3 + 20;
    scene.fog.far = camDist * 3.2 + 90;
    if (ev.active === 'eclipse') { scene.fog.near = camDist * 0.75; scene.fog.far = camDist * 1.45; }
    if (dailyIs('fog')) { scene.fog.near = camDist * 0.9; scene.fog.far = camDist * 1.7; }
    if (cosmeticRefresh) {
      const fdt = Math.min(0.05, (now - (draw.fxAt || now)) / 1000);
      updateParticles(fdt); updateFx(fdt); draw.fxAt = now;
    }
    pMat.size = 0.7 + camDist * 0.015;
    // the crown in «Захват короны» floats over the holder's biggest part
    crownMesh.visible = running && mode === 'crown' && (!!ModeX.crownGround || (!!crownHolder && crownHolder.cells.length > 0));
    if (crownMesh.visible && ModeX.crownGround) { const g = ModeX.crownGround; crownMesh.position.set(g.x, 2.2 + Math.sin(now / 300) * .5, g.z); crownMesh.scale.setScalar(4); crownMesh.rotation.y = now / 500; }
    else if (crownMesh.visible) {
      const top = crownHolder.cells.reduce((a, b) => a.mass >= b.mass ? a : b), r = visualCellR(top);
      crownMesh.position.set(top.x, r * 2 + 0.6 + Math.sin(now / 300) * 0.3, top.z);
      crownMesh.scale.setScalar(Math.max(2, r * 1.1)); crownMesh.rotation.y = now / 800;
    }
    const sh = sun.shadow.camera, span = Math.max(50, camDist * 1.4);
    if (Math.abs(sh.right - span) > 2) { sh.left = sh.bottom = -span; sh.right = sh.top = span; sh.far = span * 3 + 60; sh.updateProjectionMatrix(); }
    sun.position.set(camLook.x + 15, span * 0.8 + 20, camLook.z + 10); sun.target.position.copy(camLook);
    glowBatch.sync();
    renderer.render(scene, camera);
  }

  let last = performance.now();
  // frame rate: shown on demand; when it stays under 40 for 5 s in a round, graphics step down once per 10 s
  const perf = { frames: 0, t0: 0, fps: 60, low: 0, cool: 0 };
  const r1q = v => Math.round(v * 100) / 100;
  // 2.7 FPS: bots get a random skin, star level and aura each time they come back; a look never seen before compiled its shader in the middle of a round (a 60–80 ms hitch on a phone).
  // While the menu is open, every look a bot can get is put on a hidden drop and compiled — a little at a time, never during a round.
  // 8 hidden drops wear 8 looks at a time, then one compile; a round that starts before the end finishes the rest at its start (prewarmFinish)
  let prewarmJobs = null, prewarmI = 0, prewarmVis = null;
  function prewarmChunk(budgetMs) {
    try {
      if (!prewarmJobs) { prewarmVis = Array.from({ length: 8 }, () => makeVis(new THREE.Color('#8088c0')));
        const skins = SKINS.filter(k => !k.craft && !k.old && !EVO[k.id]);   // star bots wear legendary skins too
        prewarmJobs = [...skins.flatMap(sk => [0, 1, 2, 3].map(st => [sk, st])),   /* 2.7: ★2 too — a bot with 2 stars compiled mid-round (owner's report) */ ...FX.filter(f => f.slot === 'aura' && !f.craft).map(f => ['aura', f.id])]; }
      const t0 = performance.now();
      while (prewarmI < prewarmJobs.length && performance.now() - t0 < budgetMs) {
        for (let k = 0; k < prewarmVis.length && prewarmI < prewarmJobs.length; k++) { const [a, b] = prewarmJobs[prewarmI++], v = prewarmVis[k]; if (a === 'aura') setAura(v, b, '#8088c0'); else applySkin(v, a, b, null); }
        renderer.compile(scene, camera);
      }
    } catch (e) { if (prewarmJobs) prewarmI = prewarmJobs.length; }
    const done = !prewarmJobs || prewarmI >= prewarmJobs.length;
    if (done && prewarmVis) { try { prewarmVis.forEach(v => setAura(v, null)); } catch (e) {} prewarmVis = null; }
    return done;
  }
  function prewarmLooks() { const step = () => { if (running) { setTimeout(step, 4000); return; } if (!prewarmChunk(14)) setTimeout(step, 40); }; setTimeout(step, 2500); }
  function prewarmAgain() { prewarmJobs = null; prewarmI = 0; prewarmLooks(); }   // 2.7: after a change of graphics quality, warm the looks up again in the menu
  function prewarmFinish() { if (!prewarmJobs || prewarmI < prewarmJobs.length) prewarmChunk(1e9); }
  prewarmLooks();
  // 2.7 test: what an object on screen is — a named part (капля, кольцо, глаза…), whose drop it belongs to, or its shape
  let labelCells = null;
  function objLabel(o) {
    let p = o, named = null, depth = 0;
    while (p && p !== scene) { if (p.name && !named) named = p.name + (depth ? ' · детали' : ''); if (p.name === 'капля') break; p = p.parent; depth++; }
    let who = '';
    if (p && p.name === 'капля') { const c = labelCells ? labelCells.get(p) : cells.find(k => k.vis && k.vis.mesh === p); if (c) who = c.owner.isPlayer ? 'игрок' : c.owner.kind === 'boss' ? 'босс ' + c.owner.bossType : c.owner.kind; }
    return (named || ((o.geometry && o.geometry.type || o.type) + '/' + (o.material && o.material.type || ''))) + (who ? ' [' + who + ']' : '');
  }
  const seenProgs = new Set();
  function shaderWhy(o, m) {
    let p = o; while (p && p.name !== 'капля') p = p.parent;
    const c = p ? cells.find(k => k.vis && k.vis.mesh === p) : null, w = c && c.owner;
    const look = w && !w.isPlayer ? ` · облик ${w.lookSkin || '?'}★${w.lookSt || 0}${w.fx && w.fx.aura ? ' аура ' + w.fx.aura : ''}${w.star ? ' звезда' : ''}` : '';
    const f = [m.map && 'map', m.emissiveMap && 'emiMap', m.envMap && 'env', m.alphaMap && 'alpha', m.vertexColors && 'vcol', m.flatShading && 'flat', m.transparent && 'transp', m.side === 2 && 'double', o.isInstancedMesh && 'inst', m.fog === false && 'nofog'].filter(Boolean).join('+');
    return look + (f ? ' · ' + f : '') + ` · ${QUALITY}`;
  }
  function shaderWho() {
    const list = renderer.info.programs || [], fresh = list.filter(p => !seenProgs.has(p)); list.forEach(p => seenProgs.add(p));
    if (fresh.length > 6) return;   // a whole new arena (round start), not a hitch to explain
    for (const prog of fresh) {
      let who = null;
      scene.traverse(o => { if (who || !o.material) return; const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) { const pr = renderer.properties.get(m); if (pr && pr.currentProgram === prog) { who = objLabel(o) + shaderWhy(o, m); break; } } });
      TLog.ev('новый шейдер', (prog.name || '?') + (who ? ': ' + who : ''));
    }
  }
  // 2.7 test: what takes the draw calls right now — objects in view by kind (the glow batch counts as one)
  const cenFr = new THREE.Frustum(), cenM = new THREE.Matrix4();
  function drawCensus() {
    cenM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); cenFr.setFromProjectionMatrix(cenM);
    const out = {}; labelCells = new Map(); for (const c of cells) if (c.vis) labelCells.set(c.vis.mesh, c);
    scene.traverseVisible(o => {
      if (!(o.isMesh || o.isPoints || o.isSprite || o.isLine) || !o.layers.test(camera.layers)) return;
      if (o.frustumCulled) { if (o.isSprite ? !cenFr.intersectsSprite(o) : (o.geometry && !cenFr.intersectsObject(o))) return; }
      const k = objLabel(o).replace(/ \[босс .*\]$/, ' [босс]'); out[k] = (out[k] || 0) + 1;   // parts are counted by whose drop they are on
    });
    labelCells = null;
    return Object.entries(out).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, n]) => k + ' ' + n).join(', ');
  }
  function trackFps(now) {
    perf.frames++;
    if (now - perf.t0 < 1000) return;
    perf.fps = perf.frames * 1000 / (now - perf.t0); perf.frames = 0; perf.t0 = now;
    if (TEST_MODE && running && !paused) TLog.fps(perf.fps, () => {   // 2.7 test journal: what was on screen during a drop
      const ri = renderer.info.render, mem = performance.memory;
      return { q: QUALITY, mass: Math.round(total(player)), cells: cells.length, mine: player.cells.length, bots: bots.filter(o => o.cells.length).length, boss: bossOwners.filter(o => o.cells.length).length + raidTwins.filter(o => o.cells.length).length,
        fx: pActive.length + eActive.length, calls: ri.calls, tris: Math.round(ri.triangles / 1000) + 'k', heap: mem ? Math.round(mem.usedJSHeapSize / 1048576) + 'MB' : undefined, px: r1q(renderer.getPixelRatio()) }; });
    if (TEST_MODE && running && renderer.info.programs) shaderWho();   // 2.7: what still compiles mid-round, and for what
    if (save.settings.showFps) { const el = $('fps'); el.textContent = `${Math.round(perf.fps)} FPS`; el.classList.toggle('slow', perf.fps < 40); }
    if (running && !paused && !document.hidden && save.settings.autoQ) {   // 2.7: soft step first — resolution, before the quality preset
      perf.dcool = Math.max(0, (perf.dcool || 0) - 1);
      perf.dlow = perf.fps < 30 ? (perf.dlow || 0) + 1 : 0;   // a fallback only for heavy drops: the picture stays sharp otherwise
      perf.dhi = perf.fps >= 50 ? (perf.dhi || 0) + 1 : 0;
      if (!perf.dcool && perf.dlow >= 3 && dynPx > .7) { if (setDynPx(Math.max(.7, dynPx - .15)) && TEST_MODE) TLog.ev('разрешение', r1q(renderer.getPixelRatio())); perf.dlow = 0; perf.dcool = 3; }
      else if (!perf.dcool && perf.dhi >= 5 && dynPx < 1) { if (setDynPx(Math.min(1, dynPx + .15)) && TEST_MODE) TLog.ev('разрешение', r1q(renderer.getPixelRatio())); perf.dhi = 0; perf.dcool = 4; }
    }
    if (!running || paused || document.hidden || !save.settings.autoQ || save.settings.quality === 'low') { perf.low = 0; return; }
    perf.cool = Math.max(0, perf.cool - 1);
    perf.low = perf.fps < 40 ? perf.low + 1 : 0;
    if (perf.low >= 5 && !perf.cool) {
      save.settings.quality = save.settings.quality === 'high' ? 'medium' : 'low'; persist(); applySettings();
      toast(`Игра шла медленно — графика снижена до «${save.settings.quality === 'medium' ? 'Среднее' : 'Низкое'}»`);
      if (TEST_MODE) TLog.ev('графика снижена', save.settings.quality);
      perf.low = 0; perf.cool = 10;
    }
  }
  // menu backdrop: a few floating neon dots and drops (pure CSS, the 3D arena is not drawn under the menus)
  let menuBg = false;
  $('mbDots').innerHTML = Array.from({ length: 34 }, (_, i) => { const c = ['#22e6ff', '#ff4fd8', '#ffd23f', '#3dffa2', '#9b5cff'][i % 5];
    return `<i style="left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 100).toFixed(1)}%;--c:${c};--t:${(4 + Math.random() * 6).toFixed(1)}s;--dx:${(Math.random() * 60 - 30).toFixed(0)}px;--dy:${(Math.random() * 60 - 30).toFixed(0)}px"></i>`; }).join('') +
    [['#ff4fd8', 8, 70, 46], ['#22e6ff', 86, 24, 34], ['#3dffa2', 74, 82, 22], ['#ffd23f', 14, 18, 16]].map(([c, x, y, r]) =>
      `<b class="mb-blob" style="left:${x}%;top:${y}%;width:${r}px;height:${r}px;background:radial-gradient(circle at 35% 30%, #fff, ${c} 45%, transparent 72%);box-shadow:0 0 24px ${c}"></b>`).join('');
  // one frame; an error inside never stops the loop (that froze the game before): it is logged, and if a round keeps failing it ends cleanly
  let frameErrs = 0;
  const framePrev = [0, 0, 0];
  let pxPerUnit = 40;   // 2.7 test: the last frame's game logic, drawing and HUD, ms
  function frame(now) {
    try {
      if (sceneryAnim) sceneryAnim(now);
      lookTick(now);
      trackFps(now);
      if (TEST_MODE && running && !paused && !document.hidden) TLog.frame(now - last, framePrev);   // 2.7: hitches for the FPS analysis, with what the frame before spent where
      const dt = Math.min((now - last) / 1000, 0.05); last = now;
      if (TEST_MODE) testLogTick(dt);   // 2.7 test journal (14-net.js)
      const T0 = TEST_MODE ? performance.now() : 0;
      if (running && !paused && !dying) { if (ModeX.hcFrozen()) ModeX.hcFreezeTick(dt); else update(dt); }
      else if (running && dying) { for (const o of bots) if (o.cells.length) o.cells.forEach(k => steer(k, o.tx, o.tz, dt)); }
      else if (!running) idle(dt);
      const mb = !running && !$('overlay').hidden;
      if (mb !== menuBg) { menuBg = mb; document.body.classList.toggle('menu-bg', mb); }
      const T1 = TEST_MODE ? performance.now() : 0;
      if (!mb) draw(now);
      const T2 = TEST_MODE ? performance.now() : 0;
      updateHud(now);
      if (TEST_MODE) { const T3 = performance.now(); framePrev[0] = T1 - T0; framePrev[1] = T2 - T1; framePrev[2] = T3 - T2; }
      if (frameErrs) frameErrs = Math.max(0, frameErrs - .02);
    } catch (e) { onFrameError(e, now); }
    requestAnimationFrame(frame);
  }
  function onFrameError(e, now) {
    last = now; KapliErr.log(e, running ? 'round' : 'menu'); frameErrs++;
    if (frameErrs < 30) return;
    frameErrs = 0;
    if (running) {
      try { if (!dying) finishRound('Раунд завершён из-за сбоя', 0, false); else endRound(); }
      catch (e2) { KapliErr.log(e2, 'finish'); running = false; dying = false; paused = false; try { $('overlay').hidden = false; showCard('menuCard'); setGameUi(false); } catch (e3) {} }
      try { toast('Произошёл сбой — раунд завершён, прогресс сохранён. Отчёт: Настройки → Поддержка'); } catch (e4) {}
    }
  }
  // bots wander behind the menus
  function idle(dt) {
    for (const o of owners) {
      if (o.isPlayer || !o.cells.length) continue;
      o.think -= dt;
      if (o.think <= 0) { think(o); o.think = 0.5; }
      o.cells.forEach(k => steer(k, o.tx, o.tz, dt));
    }
  }

  // 2.2: the pause screen shows how the round is going and the goals of the day
  // 2.7: your buffs, with real numbers. The speed is measured: speedOf() against the bare speed of that mass (without the dash)
  function speedBuffK() {
    if (!player.cells.length) return 1;
    const c = mainOf(player), dash = player.dashT; player.dashT = 0;
    const real = speedOf(c); player.dashT = dash;
    const bare = BASE_SPEED * Math.pow(Math.min(c.mass, PLAYER_SPEED_MASS_CAP) / START_MASS, -0.15);
    return bare > 0 ? real / bare : 1;
  }
  const buffPct = k => `${k >= 1 ? '+' : '−'}${Math.round(Math.abs(k - 1) * 100)}%`;
  function buffRows() {
    const rows = [], add = (ic, name, val, note = '', bad = false) => rows.push({ ic, name, val, note, bad });
    const sec = t => `${Math.ceil(t)} с`;
    // speed
    const sk = speedBuffK();
    add('⚡', 'Скорость от бафов', buffPct(sk), 'итог всех бафов и замедлений, без рывка', sk < .995);
    if (U.speed) add('', '· Обтекаемость', `+${U.speed}%`, 'улучшение');
    if (effects.speed > 0) add('', '· Бонус «Ускорение»', '+45%', sec(effects.speed));
    if (petLv('speed')) add('', '· Питомец', `+${2 * petLv('speed')}%`);
    if (ModeX.hcK('speed') > 1) add('', '· Карточки «Хардкора»', buffPct(ModeX.hcK('speed')));
    if (abOn('shrink')) add('', '· Сжатие', '+25%', sec(player.abT.shrink));
    try { if (charIs('tank')) add('', '· Характер «Танк»', '−8%', '', true); } catch (e) {}
    if (player.freezeT > 0) add('', '· Оглушение', '−95%', sec(player.freezeT), true);
    else if (player.slowT > 0) add('', '· Замедление', `−${Math.round((1 - ABIL_CFG.slowFactor) * 100)}%`, sec(player.slowT), true);
    // food and growth
    const gk = ModeX.gainK();
    if (U.digest) add('🍽', 'Пищеварение', `+${(1.5 * U.digest).toFixed(1).replace('.', ',')}%`, 'крошки');
    if (effects.double > 0) add('🍽', 'Бонус «Двойная еда»', '×2', sec(effects.double));
    if (abOn('pulse')) add('🍽', 'Насыщение', 'крошки ×2, боты +30%, не таешь', sec(player.abT.pulse));
    if (gk < .995 || gk > 1.005) add('🍽', mode === 'hardcore' ? 'Еда в «Хардкоре»' : 'Рост большой массы', `×${gk.toFixed(2).replace('.', ',')}`, 'крошки и боты', gk < 1);
    // melting, protection, magnet
    const mk = ModeX.meltK() * (1 - .04 * U.guard) * (charIs('predator') ? 1.1 : 1);
    if (mk < .995 || mk > 1.005) add('🧊', 'Таяние', `×${mk.toFixed(2).replace('.', ',')}`, mk > 1 ? 'тает быстрее обычного' : 'тает медленнее', mk > 1);
    if (effects.shield > 0) add('🛡', 'Неуязвимость', sec(effects.shield));
    if (player.cells.length) { const er = eatRatio(mainOf(player)); if (er > 1.255) add('🛡', 'Защита', `съесть можно в ${er.toFixed(2).replace('.', ',')} раза крупнее`, 'обычно 1,25'); }
    const mg = 0.8 * U.magnet + (effects.magnet > 0 ? 6 : 0) + petLv('magnet') + starBonus('magnet');
    if (mg > 0) add('🧲', 'Притяжение крошек', `+${mg.toFixed(1).replace('.', ',')}`, effects.magnet > 0 ? 'бонус «Магнит» ' + sec(effects.magnet) : '');
    // abilities working now, hardcore cards and debuffs, the character
    for (const id of Object.keys(player.abT || {})) if (player.abT[id] > 0 && !['pulse', 'shrink', 'shieldB'].includes(id)) { const a = abilById(id); if (a) add(a.icon, a.name, 'действует', sec(player.abT[id])); }
    for (const [ic, name, v, n] of ModeX.hcBuffs()) add(ic, name, v, `итог карточек ${n}`);
    const DBN = { melt: 'таешь быстрее', slow: 'медленнее', absorb: 'еда менее сытная', magnet: 'притяжение слабее', dashLen: 'рывок короче', sense: 'боты видят дальше' };
    for (const [k, v] of ModeX.hcDebuffs()) add('🔻', DBN[k] || k, `${v}%`, 'минус рисковой карточки', true);
    try { const ch = charById(charNow()); if (ch) add(ch.icon, `Характер «${ch.name}»`, '', `＋ ${ch.plus}; − ${ch.minus}`); } catch (e) {}
    return rows;
  }
  function renderPauseInfo() {
    const box = $('pauseInfo'); if (!box || !stats) return;
    $('quitBtn').textContent = ModeX.quitLabel();
    const now = Math.round(total(player)), cell = (v, l) => `<div><b>${v}</b><small>${l}</small></div>`;
    const tiles = [cell(now.toLocaleString('ru-RU'), 'масса сейчас'), cell(Math.round(stats.maxMass || 0).toLocaleString('ru-RU'), 'лучшая за раунд'), cell($('rank').textContent || '–', 'место'),
      cell((stats.kills || 0).toLocaleString('ru-RU'), 'съедено капель'), cell(fmtTime(stats.time || 0), 'в раунде'), cell((stats.bosses || 0).toLocaleString('ru-RU'), 'боссов')].join('');
    const goals = stats.ranked ? '' : save.quests.map(id => QUESTS.find(q => q.id === id)).filter(Boolean).map(q => {
      const v = Math.min(q.goal, Math.round(stats[q.stat] || 0)), ok = doneQuests.has(q.id) || v >= q.goal;
      return `<li class="${ok ? 'done' : ''}"><span class="g-txt">${ok ? '✓ ' : ''}${q.text}<span class="g-bar"><i style="width:${(v / q.goal * 100).toFixed(0)}%;background:${ok ? '#3dffa2' : 'var(--food)'}"></i></span></span>` +
        `<span class="g-rw"><b>${ok ? 'готово' : `${v.toLocaleString('ru-RU')} / ${q.goal.toLocaleString('ru-RU')}`}</b><small>+${qCoins(q)} ◆</small></span></li>`; }).join('');
    const picked = ModeX.pickedHtml(), pickTitle = mode === 'hardcore' ? 'Улучшения этого раунда' : 'Замены способностей';
    const pickedSec = picked ? `<h3>${pickTitle}</h3><ul class="ps-picks">${picked}</ul>` : (mode === 'hardcore' ? '<h3>Улучшения этого раунда</h3><p class="ps-note">Пока ни одного: первое — на 2 000 массы.</p>' : '');
    const br = buffRows();
    const buffs = `<h3>Твои бафы</h3>` + (br.length ? `<ul class="ps-buffs">${br.map(r => `<li class="${r.bad ? 'bad' : ''}${r.name.startsWith('·') ? ' sub' : ''}"><span class="pb-n">${r.ic ? `<i>${r.ic}</i>` : ''}${r.name}${r.note ? `<small>${r.note}</small>` : ''}</span><b>${r.val}</b></li>`).join('')}</ul>` : '<p class="ps-note">Бафов нет.</p>');
    box.innerHTML = `<div class="ps-grid">${tiles}</div>` + pickedSec + buffs + (goals ? `<h3>Цели на сегодня</h3><ul class="goal-list">${goals}</ul>` : '<p class="ps-note">В рейтинговом бою цели дня не считаются.</p>');
  }
  // 2.2: one daily goal may be swapped once a day
  $('menuQuests').addEventListener('click', e => {
    const b = e.target.closest('[data-qswap]'); if (!b || save.qSwapDay === today) return;
    const id = b.dataset.qswap, i = save.quests.indexOf(id); if (i < 0) return;
    save.quests.splice(i, 1); fillQuests([id]);
    const nu = save.quests.pop(); save.quests.splice(i, 0, nu);   // the new goal takes the old one's place
    save.qSwapDay = today; persist(); renderAll(); toast('Цель заменена · следующая замена завтра');
  });
  // 2.2: time left in the league season, on the «Лиги» tile (updates every minute while the menu is open)
  function leftTxt(ms) { const m = Math.max(0, Math.floor(ms / 60000)), d = Math.floor(m / 1440), h = Math.floor(m % 1440 / 60);
    return d ? `${d} дн${h ? ` ${h} ч` : ''}` : h ? `${h} ч ${m % 60} мин` : `${Math.max(1, m)} мин`; }
  // ================= 2.2: logos for the Collection / Rewards buttons and the shop tabs =================
  const HUB_ICON = {
    p_bg: ['#7b3dff', '#22e6ff', '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 15l5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.6"/>'],
    p_frame: ['#ff4fd8', '#ffd23f', '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="5.2" stroke-dasharray="2 2"/>'],
    p_title: ['#ffd23f', '#ff9a3d', '<path d="M4 8h16v8H4z"/><path d="M4 8l-2 4 2 4M20 8l2 4-2 4M8 12h8"/>'],
    p_badge: ['#3dffa2', '#22e6ff', '<path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>'],
    p_shelf: ['#ff9a3d', '#ff3d6e', '<path d="M3 17h18M5 17v3M19 17v3"/><circle cx="7" cy="13" r="2.5"/><path d="M12 8.5l1.3 2.6 2.8.4-2 2 .5 2.8-2.6-1.4-2.6 1.4.5-2.8-2-2 2.8-.4z"/><rect x="16.5" y="10.5" width="4" height="5" rx="1"/>'],
    c_skin: ['#ff4fd8', '#ffd23f', '<path d="M12 3c3.2 4.2 6.5 7.6 6.5 11.2a6.5 6.5 0 0 1-13 0C5.5 10.6 8.8 7.2 12 3z"/><circle cx="10" cy="13" r="1.1" fill="currentColor"/><circle cx="14" cy="15.5" r="1.1" fill="currentColor"/><circle cx="11" cy="17.5" r="1.1" fill="currentColor"/>'],   // 2.7: one icon per thing everywhere — the same as «Скины» in the shop and wardrobe
    c_fx: ['#ffd23f', '#ff4fd8', '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M18.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8zM5.5 15.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"/>'],   // the same as «Эффекты»
    c_league: ['#ffd23f', '#ff9a3d', '<path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H4.5a2.5 2.5 0 0 0 2.5 4M17 6h2.5a2.5 2.5 0 0 1-2.5 4M12 13v4M8.5 20h7M10 17h4"/>'],
    c_special: ['#ff9a3d', '#ff3d6e', '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M4 13h16M12 9v11"/><path d="M12 9c-2-4-6-4-6-1.5S10 9 12 9c2 0 6 .5 6-1.5S14 5 12 9"/>'],
    g_ach: ['#22e6ff', '#7b3dff', '<circle cx="12" cy="14.5" r="6"/><path d="M8 3l3 5.5M16 3l-3 5.5"/><path d="M9.6 14.6l1.7 1.7 3.2-3.4"/>'],
    g_ch: ['#ff9a3d', '#ff3d6e', '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><path d="M18 3.5l-4.2 4.2M18 3.5v2.8h2.8"/>'],
    g_skill: ['#3dffa2', '#22e6ff', '<path d="M12 2.8l8.5 9.2-8.5 9.2L3.5 12z"/><path d="M13.2 6.8L10 12h4.2l-3.2 5.2"/>'],
    g_legend: ['#ffd23f', '#ff4fd8', '<path d="M3.8 17.2h16.4L18.6 7.6l-4.2 3.6L12 4.6l-2.4 6.6-4.2-3.6z"/><path d="M3.8 20.2h16.4"/>'],
    ward: ['#ff4fd8', '#7b3dff', '<path d="M12 7.2a2.1 2.1 0 1 1 2.1-2.1c0 1.3-2.1 1.6-2.1 3.1v.9"/><path d="M12 9.1L3.6 15.4c-.8.6-.4 1.6.6 1.6h15.6c1 0 1.4-1 .6-1.6z"/><circle cx="12" cy="19.6" r="1.4" fill="currentColor"/>'],
    pet: ['#3dffa2', '#0a8f6a', '<ellipse cx="12" cy="15.2" rx="4.6" ry="3.8"/><circle cx="6.2" cy="10.4" r="1.9"/><circle cx="9.8" cy="6.8" r="1.9"/><circle cx="14.2" cy="6.8" r="1.9"/><circle cx="17.8" cy="10.4" r="1.9"/>'],
    col: ['#b26bff', '#ff4fd8', '<rect x="7" y="4" width="11" height="14" rx="2"/><path d="M4.5 7.5v11a2 2 0 0 0 2 2H15"/><path d="M10 9h5M10 12h5M10 15h3"/>'],
    abil: ['#22e6ff', '#7b3dff', '<path d="M7 2.5l3.5 3.5L7 9.5 3.5 6zM17 2.5l3.5 3.5-3.5 3.5L13.5 6zM7 14.5l3.5 3.5L7 21.5 3.5 18zM17 14.5l3.5 3.5-3.5 3.5-3.5-3.5z"/>'],
    chest: ['#ff9a3d', '#ff4fd8', '<rect x="3.5" y="10" width="17" height="10" rx="2"/><path d="M3.5 13.5h17M5 10V8.5A4 4 0 0 1 9 4.5h6a4 4 0 0 1 4 4V10"/><rect x="10.5" y="12" width="3" height="3.6" rx=".8"/><path d="M12 1.5v1.5M7.5 2.6l.8 1.2M16.5 2.6l-.8 1.2"/>'],
    ach: ['#ffd23f', '#ff9a3d', '<circle cx="12" cy="9.5" r="6"/><path d="M12 6.8l1.1 2.2 2.4.3-1.8 1.7.5 2.4-2.2-1.2-2.2 1.2.5-2.4-1.8-1.7 2.4-.3z" fill="currentColor"/><path d="M8.3 14.3L6.5 21l3-1.5 2.5 2 .9-6M15.7 14.3L17.5 21l-3-1.5-2.5 2"/>'],
    up: ['#3dffa2', '#22e6ff', '<path d="M5 12.5l7-7 7 7M5 19l7-7 7 7"/>'],
    sabil: ['#22e6ff', '#b26bff', '<path d="M12 2.5l6 6.5-6 12.5L6 9z"/><path d="M6 9h12M9.5 9L12 21.5 14.5 9"/>'],
    skin: ['#ff4fd8', '#ffd23f', '<path d="M12 3c3.2 4.2 6.5 7.6 6.5 11.2a6.5 6.5 0 0 1-13 0C5.5 10.6 8.8 7.2 12 3z"/><circle cx="10" cy="13" r="1.1" fill="currentColor"/><circle cx="14" cy="15.5" r="1.1" fill="currentColor"/><circle cx="11" cy="17.5" r="1.1" fill="currentColor"/>'],
    fx: ['#ffd23f', '#ff4fd8', '<path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6z"/><path d="M18.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8zM5.5 15.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z"/>'],
    deco: ['#ff6ad5', '#ffd23f', '<path d="M3 18.5h18M6 18.5c0-4.5 1.5-9 6-9s6 4.5 6 9M9 9.5l1-5.5h4l1 5.5"/>'],   // «Украшения» (what is worn over the head)
    arena: ['#4d7cff', '#22e6ff', '<ellipse cx="12" cy="8.5" rx="9.5" ry="3.6"/><ellipse cx="12" cy="8.5" rx="4.6" ry="1.5"/><path d="M2.5 8.5v6.2c0 2 4.3 3.8 9.5 3.8s9.5-1.8 9.5-3.8V8.5"/><path d="M6.5 11.6v5.6M12 12.2v6.3M17.5 11.6v5.6"/><path d="M12 4.9V2.4l2.6.9-2.6.9"/>'],   // 2.7: a stadium (like 🏟), the same everywhere
    arch: ['#c0a0ff', '#ffd23f', '<path d="M6 4h11a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H8"/><path d="M6 4a2 2 0 0 0-2 2v1.5h4V6a2 2 0 0 0-2-2zM8 21a2 2 0 0 1-2-2V7.5"/><path d="M10.5 9h5M10.5 12h5M10.5 15h3"/>'],
  };
  function hubLogoSVG(k, size = 56) {
    const [c, c2, ic] = HUB_ICON[k] || HUB_ICON.col, id = 'hl' + k;
    return `<svg class="hub-logo" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true" style="--hc:${c}"><defs><linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset="1" stop-color="${c2}"/></linearGradient>` +
      `<radialGradient id="${id}b" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="${c}" stop-opacity=".45"/><stop offset="1" stop-color="#0b0624"/></radialGradient></defs>` +
      `<circle cx="32" cy="32" r="29" fill="url(#${id}b)" stroke="url(#${id}r)" stroke-width="3"/><circle cx="32" cy="32" r="24" fill="none" stroke="${c}" stroke-opacity=".3"/>` +
      `<g transform="translate(17 17) scale(1.25)" fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" color="#fff">${ic}</g></svg>`;
  }
  document.querySelectorAll('[data-logo]').forEach(el => { el.innerHTML = hubLogoSVG(el.dataset.logo, 56); });
  const SHOP_TAB_ICON = { up: 'up', abil: 'sabil', wshow: 'chest', skin: 'skin', fx: 'fx', arena: 'arena', archive: 'arch' };
  const tabIcon = id => SHOP_TAB_ICON[id] ? hubLogoSVG(SHOP_TAB_ICON[id], 22).replace('class="hub-logo"', 'class="tab-ico"') : '';
  function hubCardsInfo() {
    $('wardInfo').textContent = `скинов ${save.skins.length}/${SKINS.filter(k => !k.old || save.skins.includes(k.id)).length} · надето: «${skin().name}»`;
    const pt = save.pet && petById(save.pet); $('petInfo').textContent = pt ? ` · рядом: «${pt.name}»` : '';
    const bd = (save.build || []).filter(Boolean).map(id => (abilById(id) || {}).sh).filter(Boolean); $('abilInfo').textContent = bd.length ? ` · в бою: ${bd.join(' · ')}` : '';
    const lines = ACH.filter(a => a.line), m = [3, 2, 1].map(k => lines.filter(a => achMetal(a, achTier(a)) === k).length);
    $('achInfo').textContent = m.some(Boolean) ? `золото ${m[0]} · серебро ${m[1]} · бронза ${m[2]}` : 'испытания, мастерские и легендарные цели';
    $('chestInfo').textContent = save.dailyChestDay !== today ? 'ежедневный сундук уже ждёт' : 'ежедневный сундук — завтра';
  }
  // 2.2: league logos for the «Лиги» window — a gold crest for the League, the Chaos mark in a neon ring for the Chaos League
  function leagueLogoSVG(size = 56) {
    const leaf = (sx, k) => { const a = (-60 + k * 26) * Math.PI / 180, cx = 32 + sx * Math.cos(a) * 25, cy = 36 + Math.sin(a) * 23;
      return `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="2.4" ry="5.6" transform="rotate(${(sx * (a * 180 / Math.PI + 90)).toFixed(0)} ${cx.toFixed(1)} ${cy.toFixed(1)})" fill="url(#lgLf)"/>`; };
    let laurel = ''; for (const sx of [-1, 1]) for (let k = 0; k < 6; k++) laurel += leaf(sx, k);
    return `<svg class="lg-svg" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><defs>` +
      `<linearGradient id="lgSh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6b0"/><stop offset=".5" stop-color="#ffc93a"/><stop offset="1" stop-color="#a8650a"/></linearGradient>` +
      `<linearGradient id="lgIn" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2a8a"/><stop offset="1" stop-color="#0b0624"/></linearGradient>` +
      `<linearGradient id="lgLf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3dffa2"/><stop offset="1" stop-color="#0a8f6a"/></linearGradient></defs>` + laurel +
      `<path d="M32 14l15 5v13c0 9-6.4 15.2-15 18.6C23.4 47.2 17 41 17 32V19z" fill="url(#lgSh)"/><path d="M32 17.6l11.8 4V32c0 7.2-5 12.4-11.8 15.4C25.2 44.4 20.2 39.2 20.2 32V21.6z" fill="url(#lgIn)"/>` +
      `<path d="M32 23.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" fill="url(#lgSh)"/>` +
      `<path d="M23 12.5l3.6 3.6L32 8.6l5.4 7.5 3.6-3.6-1.6 7.2H24.6z" fill="url(#lgSh)" stroke="#a8650a" stroke-width=".8" stroke-linejoin="round"/><circle cx="32" cy="8.2" r="1.6" fill="#22e6ff"/></svg>`;
  }
  function chaosLogoSVG(size = 56) {
    let arms = ''; for (let i = 0; i < 8; i++) arms += `<g transform="rotate(${i * 45} 32 32)"><path d="M32 32V12.5"/><path d="M27.6 17.6L32 12l4.4 5.6"/></g>`;
    return `<svg class="lg-svg lg-chaos" viewBox="0 0 64 64" width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="chLg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4fd8"/><stop offset="1" stop-color="#22e6ff"/></linearGradient>` +
      `<radialGradient id="chBg"><stop offset="0" stop-color="#3a0a5e"/><stop offset="1" stop-color="#0b0624"/></radialGradient></defs>` +
      `<circle cx="32" cy="32" r="29" fill="url(#chBg)" stroke="url(#chLg)" stroke-width="2" stroke-dasharray="5 3.5"/>` +
      `<g fill="none" stroke="url(#chLg)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">${arms}</g><circle cx="32" cy="32" r="4.6" fill="#fff"/><circle cx="32" cy="32" r="8.5" fill="none" stroke="#fff" stroke-opacity=".35"/></svg>`;
  }
  // the Chaos League mark: eight arrows from one point, in the league's pink and cyan
  function chaosMarkSVG(size = 14) {
    let arms = ''; for (let i = 0; i < 8; i++) arms += `<g transform="rotate(${i * 45} 12 12)"><path d="M12 12V2.6"/><path d="M9.4 5.4L12 2.4l2.6 3"/></g>`;
    return `<svg class="chaos-mark" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="chMk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff4fd8"/><stop offset="1" stop-color="#22e6ff"/></linearGradient></defs>` +
      `<g fill="none" stroke="url(#chMk)" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${arms}</g><circle cx="12" cy="12" r="2.2" fill="#fff"/></svg>`;
  }
  // two leagues, two clocks: the league season (14 days) top right, the Chaos season (7 days, from level 25) bottom right
  const shortLeft = ms => { const m = Math.max(0, Math.floor(ms / 60000)); return m >= 1440 ? `${Math.floor(m / 1440)} дн` : m >= 60 ? `${Math.floor(m / 60)} ч` : `${Math.max(1, m)} мин`; };
  function seasonTimerTick() {
    const el = $('hubLeagueTimer'), ce = $('hubChaosTimer'); if (!el) return;
    const now = Date.now(), soon = !seasonStarted, left = soon ? SEASON_EPOCH - now : seasonEnd(save.season.id) - now;
    el.hidden = false; el.classList.toggle('hot', !soon && left < 864e5);
    el.textContent = `${soon ? '▶' : '⏳'} ${shortLeft(left)}`;
    el.title = soon ? `Первый сезон лиги начнётся ${fmtDate(SEASON_EPOCH)}` : `До конца сезона ${save.season.id}: ${leftTxt(left)}`;
    let label = `Лиги. ${el.title}`;
    ce.hidden = !chaosOpen(); $('hubLeagueBtn').classList.toggle('two-clocks', !ce.hidden);
    if (!ce.hidden) {
      const cs = !chaosStarted, cl = cs ? CHAOS_EPOCH - now : chaosEnd(save.chaos.id) - now;
      ce.classList.toggle('hot', !cs && cl < 864e5); ce.innerHTML = `${chaosMarkSVG(16)}${shortLeft(cl)}`;
      ce.title = cs ? `Первый Хаос-сезон начнётся ${fmtDate(CHAOS_EPOCH)}` : `До конца Хаос-сезона ${save.chaos.id}: ${leftTxt(cl)}`;
      label += `. ${ce.title}`;
    }
    $('hubLeagueBtn').setAttribute('aria-label', label);
  }
  setInterval(() => { if (!$('menuCard').hidden && !document.hidden) seasonTimerTick(); }, 60000);
