  // ================= scene =================
  const stage = $('stage');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  let QUALITY = 'high';
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = false;   // neon look relies on emissive light, not shadows
  stage.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = C('--bg');
  scene.fog = new THREE.Fog(scene.background, 50, 160);
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 2400);
  scene.add(new THREE.HemisphereLight(0x9a8cff, 0x0a0420, 0.55));
  const sun = new THREE.DirectionalLight(0xd8d0ff, 0.55);
  scene.add(sun, sun.target);

  // soft round sprite used for glows and particles
  function radialTex(stops) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const x = cv.getContext('2d'), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(([o, c]) => gr.addColorStop(o, c));
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(cv);
  }
  const glowTex = radialTex([[0, 'rgba(255,255,255,1)'], [.3, 'rgba(255,255,255,.75)'], [.55, 'rgba(255,255,255,.28)'], [1, 'rgba(255,255,255,0)']]);
  const dotTex = radialTex([[0, 'rgba(255,255,255,1)'], [.4, 'rgba(255,255,255,.6)'], [1, 'rgba(255,255,255,0)']]);
  const glowSprite = (color, size, opacity) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.scale.setScalar(size);
    return sp;
  };

  const nebulae = [];
  // starfield all around: the arena floats in space
  {
    const n = 2200, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const tints = [new THREE.Color('#ffffff'), new THREE.Color('#9fd8ff'), new THREE.Color('#ffb3f0'), new THREE.Color('#c9b8ff')];
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, rr = 380 + Math.random() * 120, q = Math.sqrt(1 - u * u);
      pos.set([Math.cos(a) * q * rr, u * rr, Math.sin(a) * q * rr], i * 3);
      const t = tints[i % 4], k = .5 + Math.random() * .5;
      col.set([t.r * k, t.g * k, t.b * k], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    var stars = new THREE.Points(geo, new THREE.PointsMaterial({ size: 2.2, sizeAttenuation: false, vertexColors: true, map: dotTex, transparent: true, depthWrite: false, fog: false }));
    scene.add(stars);
    // nebula clouds under and around the arena
    [['#ff4fd8', -260, -90, 120], ['#22e6ff', 240, -110, -160], ['#7b3dff', 40, -140, 260], ['#ff3d6e', -180, -120, -260]].forEach(([c, x, y, z]) => {
      const neb = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: c, transparent: true, opacity: .32, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      neb.position.set(x, y, z); neb.scale.setScalar(520); scene.add(neb); nebulae.push(neb);
    });
  }

  // flat things lying on the floor are drawn slightly in front of it, so they never flicker against it from far away
  const decal = m => Object.assign(m, { polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
  // glass floor with a neon grid
  const gc = document.createElement('canvas'); gc.width = gc.height = 128;
  const g = gc.getContext('2d');
  g.fillStyle = '#0b0824'; g.fillRect(0, 0, 128, 128);
  g.strokeStyle = 'rgba(140, 100, 255, .55)'; g.lineWidth = 2; g.strokeRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(34, 230, 255, .8)'; g.fillRect(0, 0, 4, 4);
  const gridTex = new THREE.CanvasTexture(gc);
  gridTex.wrapS = gridTex.wrapT = THREE.RepeatWrapping;
  gridTex.repeat.set(R / 3, R / 3);
  gridTex.anisotropy = 4;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 120), new THREE.MeshBasicMaterial({ map: gridTex }));
  floor.rotation.x = -Math.PI / 2; scene.add(floor);
  const edgeGlow = new THREE.Mesh(new THREE.RingGeometry(R - 10, R, 160), decal(new THREE.MeshBasicMaterial({ color: '#ff4fd8', transparent: true, opacity: .12, blending: THREE.AdditiveBlending, depthWrite: false })));
  edgeGlow.rotation.x = -Math.PI / 2; edgeGlow.position.y = 0.02; scene.add(edgeGlow);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(R, 0.55, 10, 220), new THREE.MeshBasicMaterial({ color: '#ff4fd8' }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.3; scene.add(rim);
  const rimGlow = new THREE.Mesh(new THREE.TorusGeometry(R, 2.4, 10, 220), new THREE.MeshBasicMaterial({ color: '#ff4fd8', transparent: true, opacity: .18, blending: THREE.AdditiveBlending, depthWrite: false }));
  rimGlow.rotation.x = Math.PI / 2; rimGlow.position.y = 0.3; scene.add(rimGlow);
  const rimInner = new THREE.Mesh(new THREE.TorusGeometry(R - 2.2, 0.18, 8, 220), new THREE.MeshBasicMaterial({ color: '#22e6ff' }));
  rimInner.rotation.x = Math.PI / 2; rimInner.position.y = 0.15; scene.add(rimInner);
  // synthwave sun for «Ретро-волна»: a striped gradient disc far behind the arena
  const retroSun = (() => {
    const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d');
    const gr = x.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#ffd23f'); gr.addColorStop(.55, '#ff6a3d'); gr.addColorStop(1, '#ff2d95');
    x.fillStyle = gr; x.beginPath(); x.arc(128, 128, 120, 0, Math.PI * 2); x.fill();
    x.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 7; i++) x.fillRect(0, 150 + i * 15, 256, 3 + i * 1.3);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false, fog: false }));
    sp.position.set(0, 45, -R - 140); sp.scale.setScalar(170); sp.visible = false; scene.add(sp);
    const halo = glowSprite('#ff4fd8', 420, .35); halo.material.fog = false; halo.position.copy(sp.position); halo.visible = false; scene.add(halo);
    return { sp, halo };
  })();
  // the 128×128 floor tile (3×3 units, repeated): every arena draws its own
  function drawFloorTile(A) {
    let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    g.globalAlpha = 1; g.lineCap = 'round'; g.fillStyle = A.floor; g.fillRect(0, 0, 128, 128);
    const crack = (col, w, n) => { g.strokeStyle = col; g.lineWidth = w; for (let k = 0; k < n; k++) { g.beginPath(); let x = rnd() * 128, y = 0; g.moveTo(x, y); while (y < 128) { x += (rnd() - .5) * 40; y += 12 + rnd() * 18; g.lineTo(x, y); } g.stroke(); } };
    switch (A.id) {
      case 'lava': g.shadowColor = '#ff6a00'; g.shadowBlur = 6; crack('rgba(255,106,0,.5)', 2.5, 1); crack('rgba(255,210,63,.45)', 1, 1); g.shadowBlur = 0; break;
      case 'inferno': g.fillStyle = 'rgba(255,45,0,.12)'; g.fillRect(0, 0, 128, 128); g.shadowColor = '#ff2d00'; g.shadowBlur = 10; crack('rgba(255,45,0,.55)', 2, 1); g.shadowBlur = 0; break;
      case 'ice': { const gr = g.createLinearGradient(0, 0, 128, 128); gr.addColorStop(0, 'rgba(255,255,255,.08)'); gr.addColorStop(.5, 'rgba(160,230,255,.02)'); gr.addColorStop(1, 'rgba(255,255,255,.1)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
        g.strokeStyle = 'rgba(255,255,255,.22)'; g.lineWidth = 1; for (let k = 0; k < 5; k++) { const x = rnd() * 128, y = rnd() * 128; g.beginPath(); g.moveTo(x, y); g.lineTo(x + 18 + rnd() * 20, y + 8 + rnd() * 10); g.stroke(); } break; }
      case 'ocean': g.strokeStyle = 'rgba(120,230,255,.28)'; g.lineWidth = 2; for (let k = 0; k < 4; k++) { g.beginPath(); const cx = rnd() * 128, cy = rnd() * 128, r = 14 + rnd() * 18;
        for (let a = 0; a <= 6.3; a += .5) { const rr = r * (1 + .3 * Math.sin(a * 3 + k)); g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.stroke(); } break;
      case 'cyber': g.strokeStyle = 'rgba(34,230,255,.55)'; g.lineWidth = 1.5; for (let k = 0; k < 4; k++) { let x = Math.round(rnd() * 8) * 16, y = Math.round(rnd() * 8) * 16; g.beginPath(); g.moveTo(x, y);
        for (let j = 0; j < 3; j++) { if (j % 2) y += (rnd() < .5 ? -1 : 1) * 32; else x += (rnd() < .5 ? -1 : 1) * 32; g.lineTo(x, y); } g.stroke(); g.fillStyle = '#ff4fd8'; g.fillRect(x - 3, y - 3, 6, 6); } break;
      case 'galaxy': {
        for (let k = 0; k < 22; k++) { g.fillStyle = ['#ffffff', '#9fd8ff', '#ffb3f0'][k % 3]; g.globalAlpha = .4 + rnd() * .6; const r = rnd() < .15 ? 1.6 : .8; g.beginPath(); g.arc(rnd() * 128, rnd() * 128, r, 0, 7); g.fill(); } g.globalAlpha = 1; break; }
      case 'olympus': g.fillStyle = 'rgba(255,246,220,.07)'; g.fillRect(0, 0, 128, 128); g.strokeStyle = 'rgba(255,210,63,.35)'; g.lineWidth = 1; for (let k = 0; k < 3; k++) { g.beginPath(); let x = 0, y = rnd() * 128; g.moveTo(x, y); while (x < 128) { x += 10 + rnd() * 14; y += (rnd() - .5) * 26; g.lineTo(x, y); } g.stroke(); } break;
      case 'sakura': for (let k = 0; k < 5; k++) { g.save(); g.translate(rnd() * 128, rnd() * 128); g.rotate(rnd() * 6); g.fillStyle = k % 2 ? 'rgba(255,158,196,.55)' : 'rgba(255,209,232,.45)'; g.beginPath(); g.ellipse(0, 0, 5, 2.6, 0, 0, 7); g.fill(); g.restore(); } break;
    }
    g.strokeStyle = A.grid; g.lineWidth = A.id === 'retro' ? 3 : 2; g.globalAlpha = A.id === 'galaxy' || A.id === 'olympus' ? .45 : 1; g.strokeRect(0, 0, 128, 128); g.globalAlpha = 1;
    g.fillStyle = A.dot; g.fillRect(0, 0, 4, 4);
    gridTex.needsUpdate = true;
  }
  // ================= arena look =================
  // Every arena has its own sky and haze, a picture across the whole floor (mapCv), mid-scale detail (detCv),
  // and a layer seen through the glass floor that shifts with the camera (deepCv, sampled at two depths by the floor shader).
  // All three are added on top of the dark floor tile, so food and drops stay the brightest things on the field.
  const lookCv = s => { const c = document.createElement('canvas'); c.width = c.height = s; return c; };
  const mapCv = lookCv(1024), detCv = lookCv(512), deepCv = lookCv(512);
  const lookTex = (cv, rep) => { const t = new THREE.CanvasTexture(cv); if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; } return t; };
  const mapTex = lookTex(mapCv), detTex = lookTex(detCv, 1), deepTex = lookTex(deepCv, 1);
  const TAU = Math.PI * 2;
  // a small drawing kit over one canvas: black ground, everything drawn adds light
  function lookPainter(cv, seed) {
    const g = cv.getContext('2d'), S = cv.width; let sd = seed;
    const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.shadowBlur = 0; g.setLineDash([]); g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#000'; g.fillRect(0, 0, S, S); g.globalCompositeOperation = 'lighter'; g.lineCap = g.lineJoin = 'round';
    const T = {
      g, S, rnd, h: S / 2,
      wrap(fn) { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { g.save(); g.translate(dx * S, dy * S); fn(); g.restore(); } },
      near(x, y, r, fn) { const xs = [0], ys = [0]; if (x < r) xs.push(S); if (x > S - r) xs.push(-S); if (y < r) ys.push(S); if (y > S - r) ys.push(-S); xs.forEach(dx => ys.forEach(dy => fn(x + dx, y + dy))); },
      blob(x, y, r, c, a) { const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, c); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = a; g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.globalAlpha = 1; },
      line(pts, w, c, a, glow) { g.globalAlpha = a; g.strokeStyle = c; g.lineWidth = w; g.shadowColor = c; g.shadowBlur = glow || 0; g.beginPath(); pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); g.shadowBlur = 0; g.globalAlpha = 1; },
      ring(r, w, c, a, glow, dash, x = S / 2, y = S / 2) { g.globalAlpha = a; g.strokeStyle = c; g.lineWidth = w; g.shadowColor = c; g.shadowBlur = glow || 0; g.setLineDash(dash || []); g.beginPath(); g.arc(x, y, r, 0, TAU); g.stroke(); g.setLineDash([]); g.shadowBlur = 0; g.globalAlpha = 1; },
      wander(x0, y0, x1, y1, n, amp) { const pts = [], nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny) || 1; let o = 0; for (let i = 0; i <= n; i++) { const t = i / n; o = (o + (rnd() - .5) * amp) * .8; const k = Math.sin(Math.PI * t); pts.push([x0 + (x1 - x0) * t + nx / l * o * k, y0 + (y1 - y0) * t + ny / l * o * k]); } return pts; },
      // seamless network of cracked plates: the edges of a jittered grid
      cells(n, w, c, a, glow, jit = .8, core) { const st = S / n, P = [], segs = [];
        for (let i = 0; i < n; i++) { P.push([]); for (let j = 0; j < n; j++) P[i].push([(i + .5 + (rnd() - .5) * jit) * st, (j + .5 + (rnd() - .5) * jit) * st]); }
        const at = (i, j) => { const p = P[i % n][j % n]; return [p[0] + (i >= n ? S : 0), p[1] + (j >= n ? S : 0)]; }, mid = (u, v) => [(u[0] + v[0]) / 2 + (rnd() - .5) * st * .3, (u[1] + v[1]) / 2 + (rnd() - .5) * st * .3];
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const p = at(i, j), q = at(i + 1, j), r = at(i, j + 1); segs.push([p, mid(p, q), q], [p, mid(p, r), r]); }
        T.wrap(() => segs.forEach(s => { T.line(s, w, c, a, glow); if (core) T.line(s, w * .3, core, a, 0); })); },
      blobs(n, cols, r0, r1, a) { for (let i = 0; i < n; i++) { const x = rnd() * S, y = rnd() * S, r = r0 + rnd() * (r1 - r0), c = cols[i % cols.length]; T.near(x, y, r, (px, py) => T.blob(px, py, r, c, a)); } },
      stars(n, cols, r0, r1) { for (let i = 0; i < n; i++) { g.globalAlpha = .35 + rnd() * .65; g.fillStyle = cols[i % cols.length]; g.beginPath(); g.arc(rnd() * S, rnd() * S, r0 + rnd() * (r1 - r0), 0, 7); g.fill(); } g.globalAlpha = 1; },
      veins(n, w, c, a, glow, amp, len = .6) { for (let i = 0; i < n; i++) { const x0 = rnd() * S, y0 = rnd() * S, an = rnd() * TAU, L = S * len * (.6 + rnd() * .6), pts = T.wander(x0, y0, x0 + Math.cos(an) * L, y0 + Math.sin(an) * L, 9, amp); T.wrap(() => T.line(pts, w, c, a, glow)); } },
      // whole-arena helpers (the map canvas: the field is the circle inscribed in the canvas)
      rings(list) { list.forEach(([f, w, c, a, glow, dash]) => T.ring(T.h * f, w, c, a, glow, dash)); },
      rays(n, f0, f1, w, c, a, glow, turn = 0) { for (let i = 0; i < n; i++) { const an = i / n * TAU + turn; T.line([[T.h + Math.cos(an) * T.h * f0, T.h + Math.sin(an) * T.h * f0], [T.h + Math.cos(an) * T.h * f1, T.h + Math.sin(an) * T.h * f1]], w, c, a, glow); } },
      zones(n, cols, r0, r1, a, spread = .92) { for (let i = 0; i < n; i++) { const an = rnd() * TAU, d = Math.sqrt(rnd()) * T.h * spread; T.blob(T.h + Math.cos(an) * d, T.h + Math.sin(an) * d, r0 + rnd() * (r1 - r0), cols[i % cols.length], a); } },
      rivers(n, w, c, a, glow, amp, core) { for (let i = 0; i < n; i++) { const a0 = rnd() * TAU, a1 = a0 + Math.PI * (.55 + rnd() * .9), pts = T.wander(T.h + Math.cos(a0) * T.h, T.h + Math.sin(a0) * T.h, T.h + Math.cos(a1) * T.h, T.h + Math.sin(a1) * T.h, 16, amp); T.line(pts, w, c, a, glow); if (core) T.line(pts, w * .3, core, a, glow * .4); } },
    };
    return T;
  }
  const LOOK = {
    default: { sky: ['#04021a', '#130a44', '#34187a'], fog: '#140b3a', map: 0.54, det: 0.26, deep: 0.46, depth: 10, drift: [.004, .002], paint: {
      map(T) { T.zones(9, ['#ff4fd8', '#22e6ff', '#7b3dff'], 120, 260, .06); T.rings([[.22, 5, '#22e6ff', .5, 18], [.48, 4, '#b26bff', .45, 16], [.74, 5, '#ff4fd8', .45, 18], [.95, 9, '#ff4fd8', .4, 26]]); T.rays(12, .22, .95, 2.5, '#8c64ff', .3, 10); T.blob(T.h, T.h, 70, '#b9a0ff', .25); T.ring(34, 4, '#fff', .5, 12); T.ring(52, 2, '#22e6ff', .5, 8); },
      det(T) { T.stars(70, ['#fff', '#9fd8ff', '#ffb3f0'], .8, 2); for (let i = 0; i < 9; i++) { let x = T.rnd() * T.S, y = T.rnd() * T.S; const pts = [[x, y]]; for (let k = 0; k < 3; k++) { x += (T.rnd() - .5) * 150; y += (T.rnd() - .5) * 150; pts.push([x, y]); } T.wrap(() => { T.line(pts, 1.4, '#9fd8ff', .4, 4); pts.forEach(p => T.blob(p[0], p[1], 9, '#fff', .8)); }); } },
      deep(T) { T.blobs(9, ['#ff4fd8', '#22e6ff', '#7b3dff'], 90, 190, .13); T.stars(190, ['#fff', '#9fd8ff', '#ffb3f0', '#c9b8ff'], .7, 2.1); } } },
    lava: { sky: ['#090200', '#3a0b00', '#8a2a00'], fog: '#2a0a02', map: 0.58, det: 0.29, deep: 0.46, depth: 8, drift: [.006, .003], paint: {
      map(T) { T.zones(6, ['#ff3d00', '#ff7a00'], 90, 200, .06); T.rivers(6, 16, '#ff5a00', .6, 22, 150, '#ffd23f'); T.zones(8, ['#ffb03a'], 22, 52, .4, .8); T.rings([[.96, 12, '#ff3d00', .5, 30]]); },
      det(T) { T.cells(7, 2.2, '#ff7a1a', .5, 6); T.stars(40, ['#ffd23f', '#ff9a3d'], 1, 2.4); },
      deep(T) { T.blobs(8, ['#ff3d00', '#b01800'], 70, 150, .1); T.cells(3, 7, '#ff5a00', .6, 14, .9, '#ffe08a'); } } },
    ice: { sky: ['#020a1e', '#0b2c58', '#3a82b4'], fog: '#0c2646', map: 0.54, det: 0.29, deep: 0.4, depth: 12, drift: [.002, .001], paint: {
      map(T) { T.zones(10, ['#9fe8ff', '#ffffff', '#4d7cff'], 110, 240, .055); for (let i = 0; i < 7; i++) { const a0 = T.rnd() * TAU, a1 = a0 + Math.PI * (.7 + T.rnd() * .6), pts = T.wander(T.h + Math.cos(a0) * T.h, T.h + Math.sin(a0) * T.h, T.h + Math.cos(a1) * T.h, T.h + Math.sin(a1) * T.h, 22, 70); T.line(pts, 5, '#e8fbff', .55, 14); } T.rings([[.3, 3, '#ffffff', .3, 10], [.95, 10, '#9fe8ff', .45, 26]]); },
      det(T) { T.veins(9, 1.3, '#ffffff', .5, 3, 26, .5); T.veins(8, .8, '#bfeeff', .5, 0, 40, .25); T.blobs(6, ['#ffffff'], 40, 90, .1); },
      deep(T) { T.blobs(8, ['#2a6aff', '#22c8ff', '#0a2a8a'], 90, 180, .12); for (let i = 0; i < 46; i++) { const x = T.rnd() * T.S, y = T.rnd() * T.S, r = 3 + T.rnd() * 13; T.near(x, y, r + 4, (px, py) => { T.ring(r, 1.4, '#dff8ff', .55, 3, null, px, py); T.blob(px - r * .35, py - r * .35, r * .5, '#fff', .5); }); } } } },
    ocean: { sky: ['#00101e', '#03324f', '#0c6a86'], fog: '#04283e', map: 0.51, det: 0.23, deep: 0.42, depth: 9, drift: [.012, .007], paint: {
      map(T) { T.zones(11, ['#22e6ff', '#3dffa2', '#22a6ff'], 120, 250, .06); for (let k = 0; k < 9; k++) { const an = T.rnd() * TAU, d = (.25 + T.rnd() * .6) * T.h, cx = T.h + Math.cos(an) * d, cy = T.h + Math.sin(an) * d; for (let i = 0; i < 9; i++) T.blob(cx + (T.rnd() - .5) * 90, cy + (T.rnd() - .5) * 90, 12 + T.rnd() * 16, ['#ff4fd8', '#ff9a3d', '#ffd23f', '#3dffa2'][i % 4], .5); } T.rings([[.55, 3, '#7fe8ff', .3, 12], [.95, 10, '#22a6ff', .45, 26]]); },
      det(T) { for (let i = 0; i < 16; i++) { const y = (i + .5) / 16 * T.S, pts = []; for (let x = -20; x <= T.S + 20; x += 16) pts.push([x, y + Math.sin(x / T.S * TAU * 3 + i * 1.3) * 7]); T.line(pts, 1.5, '#7fe8ff', .32, 3); } T.stars(26, ['#eafcff'], 1, 2.2); },
      deep(T) { T.blobs(6, ['#0a6aa8', '#0a8a7a'], 90, 170, .12); T.cells(4, 4.5, '#3fe0ff', .5, 10, 1); T.cells(7, 1.8, '#bfffee', .45, 4, 1); } } },
    cyber: { sky: ['#04000e', '#1a0438', '#560c7a'], fog: '#16042e', map: 0.58, det: 0.29, deep: 0.46, depth: 13, drift: [0, 0], paint: {
      map(T) { T.zones(8, ['#ff4fd8', '#22e6ff', '#7b3dff'], 110, 230, .05); for (let i = 0; i < 12; i++) { const an = i / 12 * TAU, c = i % 2 ? '#22e6ff' : '#ff4fd8', r1 = T.h * .2, r2 = T.h * (.45 + (i % 3) * .08), r3 = T.h * .96, b = an + (i % 2 ? .16 : -.16); T.line([[T.h + Math.cos(an) * r1, T.h + Math.sin(an) * r1], [T.h + Math.cos(an) * r2, T.h + Math.sin(an) * r2], [T.h + Math.cos(b) * (r2 + 40), T.h + Math.sin(b) * (r2 + 40)], [T.h + Math.cos(b) * r3, T.h + Math.sin(b) * r3]], 5, c, .55, 16); T.blob(T.h + Math.cos(an) * r2, T.h + Math.sin(an) * r2, 22, '#fff', .6); }
        const g = T.g; g.strokeStyle = '#22e6ff'; g.shadowColor = '#22e6ff'; [[70, 5, .6], [46, 3, .5], [100, 2, .35]].forEach(([s, w, a]) => { g.globalAlpha = a; g.lineWidth = w; g.shadowBlur = 16; g.strokeRect(T.h - s, T.h - s, s * 2, s * 2); }); g.shadowBlur = 0; g.globalAlpha = 1; T.rings([[.96, 10, '#22e6ff', .5, 26]]); },
      det(T) { for (let i = 0; i < 26; i++) { let x = Math.round(T.rnd() * 16) * 32, y = Math.round(T.rnd() * 16) * 32; const pts = [[x, y]], c = i % 3 ? '#22e6ff' : '#ff4fd8'; for (let k = 0; k < 4; k++) { const d = (1 + Math.floor(T.rnd() * 3)) * 32; if (k % 2) y += T.rnd() < .5 ? -d : d; else x += T.rnd() < .5 ? -d : d; pts.push([x, y]); } T.wrap(() => { T.line(pts, 1.6, c, .5, 4); T.blob(x, y, 7, '#fff', .9); }); } },
      deep(T) { const g = T.g, n = 6, st = T.S / n; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const bx = i * st + 9, by = j * st + 9, bw = st - 18, c = ['#22e6ff', '#ff4fd8', '#ffd23f', '#7b3dff'][Math.floor(T.rnd() * 4)]; g.globalAlpha = .1; g.fillStyle = c; g.fillRect(bx, by, bw, bw); g.globalAlpha = .55; for (let wx = bx + 5; wx < bx + bw - 4; wx += 9) for (let wy = by + 5; wy < by + bw - 4; wy += 9) if (T.rnd() < .5) g.fillRect(wx, wy, 4, 4); } g.globalAlpha = 1;
        for (let i = 0; i <= n; i++) { T.line([[i * st, 0], [i * st, T.S]], 2, '#ff4fd8', .35, 6); T.line([[0, i * st], [T.S, i * st]], 2, '#22e6ff', .35, 6); } } } },
    galaxy: { sky: ['#020010', '#0d0530', '#2c105e'], fog: '#0e0630', map: 0.61, det: 0.26, deep: 0.49, depth: 14, drift: [.003, .002], paint: {
      map(T) { T.zones(7, ['#7b3dff', '#ff4fd8', '#22e6ff'], 120, 240, .045); const R0 = T.h * .06, b = Math.log(T.h * .82 / R0) / (TAU * 1.6); for (let k = 0; k < 2; k++) for (let i = 0; i < 150; i++) { const t = i / 150, a = t * TAU * 1.6, r = R0 * Math.exp(b * a), an = a + k * Math.PI, x = T.h + Math.cos(an) * r + (T.rnd() - .5) * (12 + 60 * t), y = T.h + Math.sin(an) * r + (T.rnd() - .5) * (12 + 60 * t); T.blob(x, y, 16 + 34 * t + T.rnd() * 16, ['#c4a8ff', '#ff8ae0', '#8fd8ff'][i % 3], .1 + .08 * (1 - t)); }
        T.blob(T.h, T.h, 90, '#fff3d0', .3); T.blob(T.h, T.h, 30, '#ffffff', .5); T.rings([[.96, 9, '#b26bff', .45, 24]]); },
      det(T) { T.stars(110, ['#fff', '#9fd8ff', '#ffb3f0'], .7, 1.9); for (let i = 0; i < 12; i++) { const x = T.rnd() * T.S, y = T.rnd() * T.S, s = 7 + T.rnd() * 9; T.near(x, y, s + 6, (px, py) => { T.line([[px - s, py], [px + s, py]], 1.3, '#fff', .8, 4); T.line([[px, py - s], [px, py + s]], 1.3, '#fff', .8, 4); T.blob(px, py, s * .9, '#fff', .7); }); } },
      deep(T) { T.blobs(11, ['#7b3dff', '#ff4fd8', '#22e6ff', '#3a0a8e'], 80, 190, .15); T.stars(260, ['#fff', '#9fd8ff', '#ffb3f0', '#c9b8ff'], .6, 2.2); } } },
    olympus: { sky: ['#0a0a2c', '#4a3350', '#c8964a'], fog: '#1e1810', map: 0.34, det: 0.24, deep: 0.3, depth: 16, drift: [.008, .002], paint: {
      map(T) { T.zones(8, ['#ffd23f', '#fff6a0', '#ff9a3d'], 120, 240, .045); T.rings([[.2, 4, '#ffd23f', .6, 12], [.25, 2, '#fff6a0', .5, 6], [.5, 12, '#ffd23f', .5, 10, [26, 16]], [.46, 2, '#fff6a0', .5, 6], [.54, 2, '#fff6a0', .5, 6], [.78, 12, '#ffd23f', .45, 10, [34, 20]], [.74, 2, '#fff6a0', .45, 6], [.82, 2, '#fff6a0', .45, 6], [.96, 10, '#ffd23f', .5, 26]]); T.rays(24, .56, .72, 3, '#ffd23f', .4, 10); T.rays(12, .27, .44, 4, '#fff6a0', .4, 10, .26);
        const g = T.g; for (let i = 0; i < 16; i++) { const an = i / 16 * TAU; g.save(); g.translate(T.h + Math.cos(an) * T.h * .13, T.h + Math.sin(an) * T.h * .13); g.rotate(an + .5); g.globalAlpha = .5; g.strokeStyle = '#ffe27a'; g.lineWidth = 2.5; g.shadowColor = '#ffd23f'; g.shadowBlur = 6; g.beginPath(); g.ellipse(0, 0, 20, 7, 0, 0, 7); g.stroke(); g.restore(); } g.globalAlpha = 1; g.shadowBlur = 0; T.blob(T.h, T.h, 30, '#fff6a0', .4); },
      det(T) { T.veins(8, 1.5, '#ffd23f', .42, 4, 60, .7); T.veins(10, .9, '#fff6dc', .4, 0, 34, .35); T.blobs(6, ['#fff6dc'], 50, 110, .08); },
      deep(T) { for (let i = 0; i < 9; i++) { const x = T.rnd() * T.S, y = T.rnd() * T.S; for (let k = 0; k < 7; k++) { const px = x + (T.rnd() - .5) * 150, py = y + (T.rnd() - .5) * 60, r = 34 + T.rnd() * 46; T.near(px, py, r, (ax, ay) => T.blob(ax, ay, r, k % 3 ? '#fff4d8' : '#ffd9a0', .13)); } } } } },
    sakura: { sky: ['#0a0420', '#3a1452', '#96407e'], fog: '#2c1136', map: 0.54, det: 0.29, deep: 0.46, depth: 9, drift: [.01, .004], paint: {
      map(T) { T.zones(10, ['#ff9ec4', '#ff4fd8', '#b26bff'], 110, 240, .05); [.4, .72].forEach((f, k) => { const n = k ? 46 : 26; for (let i = 0; i < n; i++) { const an = i / n * TAU + k * .07; T.blob(T.h + Math.cos(an) * T.h * f, T.h + Math.sin(an) * T.h * f, 15 + (i % 3) * 3, '#ffe6f2', .34); } });
        for (let i = 0; i < 4; i++) { const an = i / 4 * TAU + .4; for (let k = 0; k < 9; k++) { const f = .42 + k * .034, a2 = an + k * .035; T.blob(T.h + Math.cos(a2) * T.h * f, T.h + Math.sin(a2) * T.h * f, 13, '#ffe6f2', .34); } }
        const g = T.g; for (let i = 0; i < 5; i++) { g.save(); g.translate(T.h, T.h); g.rotate(i / 5 * TAU); g.globalAlpha = .55; g.strokeStyle = '#ff9ec4'; g.lineWidth = 4; g.shadowColor = '#ff4fd8'; g.shadowBlur = 12; g.beginPath(); g.ellipse(0, -52, 28, 50, 0, 0, 7); g.stroke(); g.restore(); } g.globalAlpha = 1; g.shadowBlur = 0; T.blob(T.h, T.h, 18, '#ffe27a', .6); T.rings([[.96, 10, '#ff9ec4', .5, 26]]); },
      det(T) { const g = T.g; for (let i = 0; i < 90; i++) { const x = T.rnd() * T.S, y = T.rnd() * T.S, a = T.rnd() * TAU, s = 4 + T.rnd() * 5, c = ['#ff9ec4', '#ffd1e8', '#ff6fb8'][i % 3]; T.near(x, y, 12, (px, py) => { g.save(); g.translate(px, py); g.rotate(a); g.globalAlpha = .55; g.fillStyle = c; g.beginPath(); g.ellipse(0, 0, s, s * .5, 0, 0, 7); g.fill(); g.restore(); }); } g.globalAlpha = 1; },
      deep(T) { const g = T.g; T.blobs(7, ['#3a1a7a', '#7a2a8a', '#1a4a7a'], 90, 170, .12);
        for (let i = 0; i < 9; i++) { const x = T.rnd() * T.S, y = T.rnd() * T.S, a = T.rnd() * TAU, s = 20 + T.rnd() * 14, c = i % 3 ? '#ff8a3d' : '#fff0e0'; T.near(x, y, s * 2.4, (px, py) => { g.save(); g.translate(px, py); g.rotate(a); g.globalAlpha = .75; g.fillStyle = c; g.beginPath(); g.ellipse(0, 0, s, s * .38, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(-s * .8, 0); g.lineTo(-s * 1.7, -s * .5); g.lineTo(-s * 1.45, 0); g.lineTo(-s * 1.7, s * .5); g.closePath(); g.fill(); g.fillStyle = '#ff3d2a'; g.globalAlpha = .6; g.beginPath(); g.ellipse(s * .2, 0, s * .3, s * .22, 0, 0, 7); g.fill(); g.restore(); }); }
        for (let i = 0; i < 12; i++) { const x = T.rnd() * T.S, y = T.rnd() * T.S, r = 14 + T.rnd() * 12; T.near(x, y, r + 6, (px, py) => { g.globalAlpha = .4; g.fillStyle = '#3dd88a'; g.beginPath(); g.moveTo(px, py); g.arc(px, py, r, .4, TAU - .2); g.closePath(); g.fill(); g.globalAlpha = 1; T.ring(r + 7, 1.2, '#ffd1e8', .3, 0, null, px, py); }); } } } },
    inferno: { sky: ['#050000', '#2c0000', '#7a0c00'], fog: '#1a0302', map: 0.42, det: 0.26, deep: 0.36, depth: 8, drift: [.01, .006], paint: {
      map(T) { T.zones(9, ['#ff2d00', '#7b0000'], 110, 240, .06); for (let i = 0; i < 9; i++) { const an = i / 9 * TAU + T.rnd() * .3, pts = T.wander(T.h + Math.cos(an) * T.h * .1, T.h + Math.sin(an) * T.h * .1, T.h + Math.cos(an + .25) * T.h * .97, T.h + Math.sin(an + .25) * T.h * .97, 18, 90); T.line(pts, 13, '#ff2d00', .55, 20); T.line(pts, 4, '#ffb03a', .6, 6); }
        T.blob(T.h, T.h, 80, '#ff5a00', .3); T.ring(54, 5, '#ffd23f', .6, 14); T.rings([[.58, 4, '#ff2d00', .4, 16, [60, 40]], [.96, 14, '#ff2d00', .6, 34]]); },
      det(T) { const g = T.g; for (let i = 0; i < 30; i++) { const x = T.rnd() * T.S, y = T.rnd() * T.S, pts = []; for (let k = 0; k < 3; k++) { const a = T.rnd() * TAU, r = 16 + T.rnd() * 30; pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); } pts.push(pts[0]); T.wrap(() => T.line(pts, 1.6, '#ff3d1a', .45, 4)); } T.stars(50, ['#ffd23f', '#ff6a00'], 1, 2.6); g.globalAlpha = 1; },
      deep(T) { T.blobs(9, ['#ff2d00', '#a00000'], 70, 160, .12); T.cells(3, 8, '#ff2d00', .6, 16, .9, '#ffb03a'); } } },
    chronos: { sky: ['#080520', '#2a1630', '#9a5a26'], fog: '#150e08', map: 0.5, det: 0.16, deep: 0.36, depth: 13, drift: [.003, .0015], paint: {
      map(T) { const g = T.g, h = T.h; T.zones(8, ['#ffd27a', '#ff9a3d'], 120, 240, .045);
        T.rings([[.96, 10, '#ffd27a', .55, 24], [.9, 3, '#fff0c0', .5, 8], [.8, 3, '#fff0c0', .5, 8], [.56, 2.5, '#ffd27a', .4, 8], [.14, 5, '#ffd27a', .6, 12], [.08, 3, '#fff0c0', .5, 6]]);
        T.rays(60, .9, .935, 2.2, '#fff0c0', .5, 4); T.rays(12, .8, .935, 7, '#ffd27a', .6, 10); T.rays(12, .14, .2, 5, '#ffd27a', .5, 8, .26);
        g.font = "700 76px Georgia, 'Times New Roman', serif"; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#ffb45e'; g.shadowBlur = 12; g.fillStyle = '#ffe2a0'; g.globalAlpha = .6;
        ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'].forEach((n, i) => { g.save(); g.translate(h, h); g.rotate(i * TAU / 12); g.fillText(n, 0, -h * .68); g.restore(); }); g.shadowBlur = 0; g.globalAlpha = 1;
        // three small dials, like a chronograph
        [[0, .36], [TAU / 3, .36], [TAU * 2 / 3, .36]].forEach(([a, f]) => { const x = h + Math.sin(a) * h * f, y = h - Math.cos(a) * h * f; T.ring(58, 3, '#ffd27a', .5, 10, null, x, y); T.ring(46, 1.5, '#fff0c0', .5, 4, [3, 9], x, y); T.line([[x, y], [x + 26, y - 26]], 3, '#fff0c0', .5, 6); T.blob(x, y, 14, '#fff0c0', .6); }); },
      det(T) { for (let i = 0; i < 11; i++) { const x = T.rnd() * T.S, y = T.rnd() * T.S, r = 20 + T.rnd() * 34; T.near(x, y, r + 14, (px, py) => { T.ring(r, 7, '#ffd27a', .34, 0, [6, 6], px, py); T.ring(r - 7, 1.6, '#fff0c0', .5, 3, null, px, py); T.ring(r * .3, 1.6, '#fff0c0', .5, 3, null, px, py); for (let k = 0; k < 3; k++) { const a = k * TAU / 6; T.line([[px + Math.cos(a) * (r - 8), py + Math.sin(a) * (r - 8)], [px - Math.cos(a) * (r - 8), py - Math.sin(a) * (r - 8)]], 1.6, '#fff0c0', .4, 0); } }); } T.stars(30, ['#fff0c0'], .8, 1.8); },
      deep(T) { T.blobs(6, ['#c8662a', '#7a3a10'], 90, 170, .12); for (let i = 0; i < 7; i++) { const x = T.rnd() * T.S, y = T.rnd() * T.S, r = 60 + T.rnd() * 70; T.near(x, y, r + 22, (px, py) => { T.ring(r, 18, '#d99a3e', .4, 0, [15, 15], px, py); T.ring(r - 16, 6, '#ffb45e', .45, 8, null, px, py); T.ring(r * .28, 5, '#ffb45e', .45, 6, null, px, py); for (let k = 0; k < 3; k++) { const a = k * TAU / 6 + i; T.line([[px + Math.cos(a) * (r - 18), py + Math.sin(a) * (r - 18)], [px - Math.cos(a) * (r - 18), py - Math.sin(a) * (r - 18)]], 7, '#d99a3e', .4, 0); } }); } } } },
    retro: { sky: ['#0a0020', '#3c0a5c', '#ff4f9a'], fog: '#2a0a44', map: 0.5, det: 0.26, deep: 0.2, depth: 10, drift: [0, .02], paint: {
      map(T) { const g = T.g; T.zones(7, ['#ff4fd8', '#7b3dff', '#22e6ff'], 120, 240, .05); T.rays(32, .3, .96, 3, '#ff4fd8', .4, 10); T.rings([[.3, 5, '#22e6ff', .6, 16], [.62, 3, '#22e6ff', .4, 12], [.96, 10, '#ff4fd8', .5, 26]]);
        const r = T.h * .24, gr = g.createLinearGradient(0, T.h - r, 0, T.h + r); gr.addColorStop(0, '#ffd23f'); gr.addColorStop(.55, '#ff6a3d'); gr.addColorStop(1, '#ff2d95'); g.save(); g.beginPath(); g.arc(T.h, T.h, r, 0, 7); g.clip(); g.globalAlpha = .4; g.fillStyle = gr; for (let i = 0; i < 12; i++) { const y = T.h - r + i * (2 * r / 12); g.fillRect(T.h - r, y, 2 * r, (2 * r / 12) * (.9 - i * .05)); } g.restore(); g.globalAlpha = 1; T.ring(r, 4, '#ffd23f', .5, 18); },
      det(T) { const g = T.g; for (let i = 0; i < 34; i++) { const x = T.rnd() * T.S, y = T.rnd() * T.S, a = T.rnd() * TAU, s = 9 + T.rnd() * 13, c = ['#22e6ff', '#ff4fd8', '#ffd23f'][i % 3], pts = [0, 1, 2, 3].map(k => [x + Math.cos(a + k * TAU / 3) * s, y + Math.sin(a + k * TAU / 3) * s]); T.wrap(() => T.line(pts, 1.6, c, .5, 4)); } g.globalAlpha = 1; },
      deep(T) { const g = T.g; for (let i = 0; i < 8; i++) { const y = i * 64, gr = g.createLinearGradient(0, y, 0, y + 64); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.5, i % 2 ? '#ff4fd8' : '#ff9a3d'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.globalAlpha = .34; g.fillStyle = gr; g.fillRect(0, y + 14, T.S, 36); } g.globalAlpha = 1; T.stars(90, ['#fff', '#ffd23f', '#22e6ff'], .7, 1.8); } } },
  };
  // the floor: one opaque pass that adds the three pictures to the grid tile; the deep one is looked up where the eye's ray meets a plane below the glass
  const floorFx = new THREE.ShaderMaterial({
    fog: true,
    uniforms: Object.assign(THREE.UniformsUtils.clone(THREE.UniformsLib.fog), {
      tTile: { value: gridTex }, tMap: { value: mapTex }, tDet: { value: detTex }, tDeep: { value: deepTex },
      uTileRep: { value: R / 3 }, uR: { value: R }, uMap: { value: 1 }, uDet: { value: 1 }, uDeep: { value: 1 }, uDepth: { value: 10 },
      uDetSize: { value: 84 }, uDeepSize: { value: 120 }, uOffA: { value: new THREE.Vector2() }, uOffB: { value: new THREE.Vector2() } }),
    vertexShader: `varying vec2 vUv; varying vec3 vW;
#include <fog_pars_vertex>
void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `uniform sampler2D tTile, tMap, tDet, tDeep; uniform float uTileRep, uR, uMap, uDet, uDeep, uDepth, uDetSize, uDeepSize; uniform vec2 uOffA, uOffB;
varying vec2 vUv; varying vec3 vW;
#include <fog_pars_fragment>
void main() { vec2 p = vW.xz; vec3 V = cameraPosition - vW; vec2 par = V.xz / max(V.y, 1.0);
  vec3 add = (texture2D(tDeep, (p - par * uDepth) / uDeepSize + uOffA).rgb + texture2D(tDeep, (p - par * uDepth * 2.6) / (uDeepSize * 1.7) + uOffB).rgb * .55) * uDeep;
  add += texture2D(tDet, p / uDetSize).rgb * uDet + texture2D(tMap, vec2(p.x, -p.y) / (2.0 * uR) + .5).rgb * uMap;   // flipped so writing on the floor reads the right way from above
  add /= 1.0 + 1.7 * max(add.r, max(add.g, add.b));   // the added light levels off near 0.6, so the floor never outshines food and drops
  gl_FragColor = vec4(texture2D(tTile, vUv * uTileRep).rgb + add, 1.0);
#include <fog_fragment>
}`,
  });
  const floorBasic = floor.material;
  const skyCv = document.createElement('canvas'); skyCv.width = 4; skyCv.height = 256; const skyTex = new THREE.CanvasTexture(skyCv);
  const skyDome = new THREE.Mesh(new THREE.SphereGeometry(1100, 32, 20), new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false, depthWrite: false }));
  skyDome.renderOrder = -10; scene.add(skyDome);
  let lookDrift = [0, 0], lookPainted = '';
  function applyArenaLook(A) {
    const L = LOOK[A.id] || LOOK.default, sg = skyCv.getContext('2d'), gr = sg.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, L.sky[0]); gr.addColorStop(.3, L.sky[1]); gr.addColorStop(.5, L.sky[2]); gr.addColorStop(.8, L.fog); gr.addColorStop(1, L.fog);   // below the horizon the glow sinks slowly into the haze
    sg.fillStyle = gr; sg.fillRect(0, 0, 4, 256); skyTex.needsUpdate = true;
    scene.background.set(L.fog); scene.fog.color.set(L.fog);
    if (QUALITY === 'low') { floor.material = floorBasic; lookPainted = ''; return; }   // weak devices keep the plain tile
    if (lookPainted !== A.id) { L.paint.map(lookPainter(mapCv, 101)); L.paint.det(lookPainter(detCv, 202)); L.paint.deep(lookPainter(deepCv, 303)); mapTex.needsUpdate = detTex.needsUpdate = deepTex.needsUpdate = true; lookPainted = A.id; }
    const u = floorFx.uniforms; u.uMap.value = L.map; u.uDet.value = L.det; u.uDeep.value = L.deep; u.uDepth.value = L.depth; lookDrift = L.drift;
    floor.material = floorFx;
  }
  function lookTick(now) { const t = now / 1000, u = floorFx.uniforms; u.uOffA.value.set((t * lookDrift[0]) % 1, (t * lookDrift[1]) % 1); u.uOffB.value.set((.37 - t * lookDrift[0] * .6) % 1, (.61 - t * lookDrift[1] * .6) % 1); }
  // scenery around the field: 3D objects beyond the rim, on a ground ring; rebuilt when the arena changes
  const sceneryGround = new THREE.Mesh(new THREE.RingGeometry(R + .6, R + 120, 120, 1), new THREE.MeshBasicMaterial({ color: '#000' }));
  sceneryGround.rotation.x = -Math.PI / 2; sceneryGround.position.y = -.05; scene.add(sceneryGround);
  let scenery = null, sceneryAnim = null;
  function arenaScenery(A) {
    if (scenery) { scene.remove(scenery); scenery.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== glowTex) o.material.dispose(); }); }
    scenery = new THREE.Group(); sceneryAnim = null; scene.add(scenery);
    sceneryGround.visible = !!A.ground; if (A.ground) sceneryGround.material.color.set(A.ground);
    if (QUALITY === 'low') return;   // weak devices: no scenery
    let sd = 11; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    const ringPos = (n, r0, r1, i) => { const a = (i + rnd() * .6) / n * Math.PI * 2, r = r0 + rnd() * (r1 - r0); return [Math.cos(a) * r, Math.sin(a) * r, a]; };
    const inst = (geo, mat, n, place) => { const m = new THREE.InstancedMesh(geo, mat, n), d = new THREE.Object3D(); for (let i = 0; i < n; i++) { place(d, i); d.updateMatrix(); m.setMatrixAt(i, d.matrix); } scenery.add(m); return m; };
    const far = o => { o.traverse(x => { if (x.material) x.material.fog = false; }); return o; };
    const std = (c, e, ei = .6, x = {}) => new THREE.MeshStandardMaterial({ color: c, emissive: e || c, emissiveIntensity: ei, roughness: .5, metalness: .2, ...x });
    const glow = (c, sz, op, x, y, z) => { const s = glowSprite(c, sz, op); s.position.set(x, y, z); scenery.add(s); return s; };
    const planet = (c, e, r, x, y, z, ring) => { const p = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), std(c, e, .5)); p.position.set(x, y, z);
      if (ring) { const rg = new THREE.Mesh(new THREE.RingGeometry(r * 1.4, r * 2.1, 64), new THREE.MeshBasicMaterial({ color: ring, transparent: true, opacity: .55, side: THREE.DoubleSide })); rg.rotation.x = 1.2; p.add(rg); }
      scenery.add(far(p)); far(glow(e, r * 4.5, .35, x, y, z)); return p; };
    switch (A.id) {
      case 'default': {
        planet('#7b3dff', '#3a0a8e', 26, -260, 70, -330, '#ff4fd8'); planet('#22e6ff', '#0a4a6e', 12, 300, 40, -260); planet('#ff4fd8', '#5a0a4e', 8, 120, 90, 380);
        const belt = new THREE.Group(); scenery.add(belt);
        const m = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), std('#6a5ab0', '#2a1a60', .5, { flatShading: true }), 90), d = new THREE.Object3D();
        for (let i = 0; i < 90; i++) { const [x, z] = ringPos(90, R + 14, R + 40, i); d.position.set(x, -2 + rnd() * 10, z); d.rotation.set(rnd() * 3, rnd() * 3, 0); d.scale.setScalar(1 + rnd() * 3.5); d.updateMatrix(); m.setMatrixAt(i, d.matrix); }
        belt.add(m); sceneryAnim = t => { belt.rotation.y = t * .00002; }; break; }
      case 'lava': {
        const vol = std('#5a1a08', '#7a1800', .55, { flatShading: true }), glows = [];
        for (let i = 0; i < 22; i++) { const [x, z] = ringPos(22, R + 16, R + 55, i), h = 14 + rnd() * 22;
          const c = new THREE.Mesh(new THREE.ConeGeometry(h * .7, h, 9, 1, true), vol); c.position.set(x, h / 2 - .5, z); scenery.add(c);
          const cap = new THREE.Mesh(new THREE.CircleGeometry(h * .12, 12), new THREE.MeshBasicMaterial({ color: '#ff6a00' })); cap.rotation.x = -Math.PI / 2; cap.position.set(x, h * .86, z); scenery.add(cap);
          glows.push(glow('#ff6a00', h * 1.2, .55, x, h * .95, z)); }
        sceneryAnim = t => glows.forEach((s, i) => { s.material.opacity = .4 + .25 * Math.sin(t / 400 + i * 1.7); }); break; }
      case 'ice': {
        const mat = new THREE.MeshStandardMaterial({ color: '#dff8ff', emissive: '#6fc8ff', emissiveIntensity: .8, roughness: .1, metalness: .3, transparent: true, opacity: .8, flatShading: true });
        const m = inst(new THREE.OctahedronGeometry(1, 0), mat, 120, (d, i) => { const [x, z] = ringPos(120, R + 5, R + 40, i), h = 4 + rnd() * 13; d.position.set(x, h * .6, z); d.scale.set(1.2 + rnd() * 2, h, 1.2 + rnd() * 2); d.rotation.set((rnd() - .5) * .5, rnd() * 3, (rnd() - .5) * .5); });
        sceneryAnim = t => { mat.emissiveIntensity = .7 + .2 * Math.sin(t / 900); }; break; }
      case 'ocean': {
        const weedMat = std('#1fd88a', '#12a86a', .8), weeds = [];
        for (let i = 0; i < 80; i++) { const [x, z] = ringPos(80, R + 4, R + 34, i), h = 6 + rnd() * 12; const w = new THREE.Mesh(new THREE.CylinderGeometry(.35, .9, h, 5, 4), weedMat); w.geometry.translate(0, h / 2, 0); w.position.set(x, 0, z); scenery.add(w); weeds.push(w); }
        const corals = ['#ff4fd8', '#ff9a3d', '#ffd23f', '#3dffa2'];
        for (let i = 0; i < 44; i++) { const [x, z] = ringPos(44, R + 4, R + 26, i); const c = new THREE.Mesh(new THREE.DodecahedronGeometry(2 + rnd() * 3, 0), std(corals[i % 4], corals[i % 4], .8, { flatShading: true })); c.position.set(x, .8, z); c.scale.y = .7; scenery.add(c); }
        const jelly = []; for (let i = 0; i < 18; i++) { const [x, z] = ringPos(18, R + 10, R + 50, i); jelly.push(glow(['#ff9ec4', '#b26bff', '#22e6ff'][i % 3], 10, .75, x, 10 + rnd() * 12, z)); }
        sceneryAnim = t => { weeds.forEach((w, i) => { w.rotation.z = Math.sin(t / 900 + i) * .18; w.rotation.x = Math.cos(t / 1100 + i * .7) * .12; }); jelly.forEach((s, i) => { s.position.y = 12 + Math.sin(t / 1300 + i * 2) * 5; }); }; break; }
      case 'cyber': {
        const cv = document.createElement('canvas'); cv.width = 32; cv.height = 64; const x = cv.getContext('2d'); x.fillStyle = '#0a0018'; x.fillRect(0, 0, 32, 64);
        for (let yy = 2; yy < 64; yy += 6) for (let xx = 2; xx < 32; xx += 6) if (Math.random() < .55) { x.fillStyle = Math.random() < .5 ? '#22e6ff' : '#ff4fd8'; x.fillRect(xx, yy, 3, 3); }
        const tex = new THREE.CanvasTexture(cv); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2, 4); tex.magFilter = THREE.NearestFilter;
        const mat = new THREE.MeshBasicMaterial({ map: tex });
        inst(new THREE.BoxGeometry(1, 1, 1), mat, 80, (d, i) => { const [px, pz, a] = ringPos(80, R + 10, R + 70, i), h = 18 + rnd() * 60; d.position.set(px, h / 2, pz); d.scale.set(6 + rnd() * 8, h, 6 + rnd() * 8); d.rotation.y = -a; });
        const tips = []; for (let i = 0; i < 12; i++) { const [px, pz] = ringPos(12, R + 20, R + 60, i); tips.push(glow(i % 2 ? '#22e6ff' : '#ff4fd8', 8, .7, px, 70 + rnd() * 10, pz)); }
        sceneryAnim = t => tips.forEach((s, i) => { s.material.opacity = (Math.sin(t / 300 + i * 2.3) > .6) ? .9 : .25; }); break; }
      case 'galaxy': {
        const p = planet('#b26bff', '#3a0a8e', 40, 220, 80, -340, '#ffd1e8'); planet('#3dffa2', '#0a4a3a', 14, -320, 60, 120); planet('#ffd23f', '#6a3a00', 18, 160, 70, 360, '#ff9a3d'); planet('#22e6ff', '#0a3a6e', 9, -200, 110, -300);
        for (let i = 0; i < 5; i++) far(glow(['#7b3dff', '#ff4fd8', '#22e6ff'][i % 3], 260, .22, Math.cos(i * 1.3) * 420, 30 + i * 20, Math.sin(i * 1.3) * 420));
        const tw = []; for (let i = 0; i < 60; i++) { const [x, z] = ringPos(60, R + 8, R + 60, i); tw.push(glow(['#ffffff', '#9fd8ff', '#ffb3f0', '#ffd23f'][i % 4], 3 + rnd() * 5, .9, x, 2 + rnd() * 26, z)); }
        const ring = new THREE.Mesh(new THREE.RingGeometry(R + 6, R + 22, 160), new THREE.MeshBasicMaterial({ color: '#7b3dff', transparent: true, opacity: .18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        ring.rotation.x = -Math.PI / 2; ring.position.y = .1; scenery.add(ring);
        sceneryAnim = t => { p.rotation.y = t * .0001; tw.forEach((s, i) => { s.material.opacity = .45 + .45 * Math.sin(t / 500 + i * 2.1); }); }; break; }
      case 'olympus': {
        const marble = new THREE.MeshStandardMaterial({ color: '#fffaf0', emissive: '#b8a888', emissiveIntensity: .7, roughness: .6 });
        const n = 40;
        inst(new THREE.CylinderGeometry(1.1, 1.3, 16, 12), marble, n, (d, i) => { const a = i / n * Math.PI * 2; d.position.set(Math.cos(a) * (R + 9), 8, Math.sin(a) * (R + 9)); });
        inst(new THREE.BoxGeometry(3.4, 1, 3.4), marble, n, (d, i) => { const a = i / n * Math.PI * 2; d.position.set(Math.cos(a) * (R + 9), 16.4, Math.sin(a) * (R + 9)); });
        const wreath = new THREE.Mesh(new THREE.TorusGeometry(R + 9, .7, 8, 200), new THREE.MeshBasicMaterial({ color: '#ffd23f' })); wreath.rotation.x = Math.PI / 2; wreath.position.y = 17.4; scenery.add(wreath);
        const leaf = new THREE.MeshBasicMaterial({ color: '#ffd23f' });
        const lv = inst(new THREE.SphereGeometry(1, 6, 4), leaf, 160, (d, i) => { const a = i / 160 * Math.PI * 2; d.position.set(Math.cos(a) * (R + 9), 17.4 + (i % 2 ? .6 : -.6), Math.sin(a) * (R + 9)); d.scale.set(1.3, .35, .6); d.rotation.y = -a + (i % 2 ? .6 : -.6); });
        sceneryAnim = t => { leaf.color.setHSL(.13, 1, .55 + .1 * Math.sin(t / 700)); }; break; }
      case 'sakura': {
        const trunk = std('#6a3a20', '#3a1a10', .5), bloom = new THREE.MeshStandardMaterial({ color: '#ffc8e0', emissive: '#ff7fb4', emissiveIntensity: .75, roughness: .8, flatShading: true });
        for (let i = 0; i < 44; i++) { const [x, z] = ringPos(44, R + 7, R + 40, i), h = 7 + rnd() * 6;
          const t = new THREE.Mesh(new THREE.CylinderGeometry(.5, .9, h, 6), trunk); t.position.set(x, h / 2, z); scenery.add(t);
          for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(3 + rnd() * 2.5, 0), bloom); b.position.set(x + (rnd() - .5) * 5, h + rnd() * 3, z + (rnd() - .5) * 5); scenery.add(b); } }
        sceneryAnim = t => { bloom.emissiveIntensity = .7 + .12 * Math.sin(t / 1500); }; break; }
      case 'inferno': {
        const pillars = [];
        for (let i = 0; i < 28; i++) { const [x, z] = ringPos(28, R + 8, R + 45, i), h = 20 + rnd() * 25;
          const c = new THREE.Mesh(new THREE.ConeGeometry(3.2, h, 10, 1, true), new THREE.MeshBasicMaterial({ color: i % 2 ? '#ff2d00' : '#ff9a3d', transparent: true, opacity: .75, blending: THREE.AdditiveBlending, depthWrite: false }));
          c.geometry.translate(0, h / 2, 0); c.position.set(x, 0, z); scenery.add(c); pillars.push(c); glow('#ff2d00', 18, .5, x, 2, z); }
        inst(new THREE.DodecahedronGeometry(1, 0), std('#3a0800', '#7a1000', .6, { flatShading: true }), 80, (d, i) => { const [x, z] = ringPos(80, R + 4, R + 50, i); d.position.set(x, 0, z); d.scale.setScalar(1 + rnd() * 3); d.rotation.set(rnd() * 3, rnd() * 3, 0); });
        sceneryAnim = t => pillars.forEach((c, i) => { const k = .8 + .3 * Math.abs(Math.sin(t / 160 + i * 1.3)); c.scale.set(1 / Math.sqrt(k), k, 1 / Math.sqrt(k)); }); break; }
      case 'chronos': {
        const brass = std('#c8963c', '#7a4a12', .55, { metalness: .6, roughness: .35 }), gold = std('#ffd27a', '#c0822a', .7, { metalness: .6, roughness: .3 });
        // a brass wheel lying flat: rim, hub, three spokes and box teeth
        const mkGear = (r, teeth, mat) => { const g = new THREE.Group(), th = r * .16;
          const ring = new THREE.Mesh(new THREE.TorusGeometry(r * .82, r * .11, 6, 40), mat); ring.rotation.x = Math.PI / 2; g.add(ring);
          g.add(new THREE.Mesh(new THREE.CylinderGeometry(r * .2, r * .2, th, 16), mat));
          for (let k = 0; k < 3; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(r * 1.6, th * .6, r * .12), mat); sp.rotation.y = k * Math.PI / 3; g.add(sp); }
          const tm = new THREE.InstancedMesh(new THREE.BoxGeometry(r * .2, th, r * .17), mat, teeth), d = new THREE.Object3D();
          for (let i = 0; i < teeth; i++) { const a = i / teeth * Math.PI * 2; d.position.set(Math.cos(a) * r * .98, 0, Math.sin(a) * r * .98); d.rotation.y = -a; d.updateMatrix(); tm.setMatrixAt(i, d.matrix); }
          g.add(tm); return g; };
        const gears = [];
        for (let i = 0; i < 14; i++) { const [x, z] = ringPos(14, R + 26, R + 54, i), r = 13 + rnd() * 14, g = mkGear(r, Math.round(r * .9), i % 3 ? brass : gold); g.position.set(x, 1.4 + rnd() * 2.5, z); scenery.add(g); gears.push([g, (i % 2 ? 1 : -1) * 9 / r]); }
        // three great wheels standing on edge, half sunk into the ground
        for (let i = 0; i < 3; i++) { const a = i * 2.1 + .7, rr = R + 118, g = mkGear(66, 44, brass), tilt = new THREE.Group(), hold = new THREE.Group(); tilt.rotation.x = Math.PI / 2; tilt.add(g); hold.add(tilt); hold.position.set(Math.cos(a) * rr, 8, Math.sin(a) * rr); hold.rotation.y = -a + Math.PI / 2; scenery.add(far(hold)); gears.push([g, (i % 2 ? 1 : -1) * .12]); }
        // clock towers with a lit dial facing the field
        const dials = [];
        for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2 + .3, r = R + 84, h = 46 + rnd() * 26, x = Math.cos(a) * r, z = Math.sin(a) * r;
          const tw = new THREE.Mesh(new THREE.BoxGeometry(13, h, 13), std('#4a2e18', '#22140a', .45)); tw.position.set(x, h / 2, z); tw.rotation.y = -a; scenery.add(tw);
          const rf = new THREE.Mesh(new THREE.ConeGeometry(12, 18, 4), brass); rf.position.set(x, h + 9, z); rf.rotation.y = -a + Math.PI / 4; scenery.add(rf);
          dials.push(glow('#ffe7a0', 24, .95, Math.cos(a) * (r - 8), h - 10, Math.sin(a) * (r - 8))); }
        // the two hands of the floor dial: they go round under the drops, purely for looks
        const hand = (len, w, c) => { const sh = new THREE.Shape(), r0 = R * .16; sh.moveTo(-w, r0); sh.lineTo(w, r0); sh.lineTo(w * .6, len * .86); sh.lineTo(0, len); sh.lineTo(-w * .6, len * .86); sh.closePath();
          const m = new THREE.Mesh(new THREE.ShapeGeometry(sh), decal(new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .2, blending: THREE.AdditiveBlending, depthWrite: false }))); m.rotation.x = -Math.PI / 2;
          const piv = new THREE.Group(); piv.add(m); piv.position.y = .04; scenery.add(piv); return piv; };
        const hMin = hand(R * .86, .9, '#ffd27a'), hHr = hand(R * .56, 1.5, '#ffb45e');
        sceneryAnim = t => { const s = t * .001; gears.forEach(([g, k]) => { g.rotation.y = s * k; }); hMin.rotation.y = -s * Math.PI * 2 / 60; hHr.rotation.y = -s * Math.PI * 2 / 720 - 1; dials.forEach((d, i) => { d.material.opacity = .8 + .15 * Math.sin(s * 1.3 + i * 2); }); };
        break; }
      case 'retro': {
        sceneryGround.material.color.set('#12001f');
        const mtn = new THREE.MeshBasicMaterial({ color: '#ff4fd8', wireframe: true, transparent: true, opacity: .8 });
        for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2, r = R + 70 + rnd() * 50, h = 25 + rnd() * 45;
          const m = new THREE.Mesh(new THREE.ConeGeometry(h * .9, h, 4 + (i % 3), 3), i % 3 ? mtn : new THREE.MeshBasicMaterial({ color: '#22e6ff', wireframe: true })); m.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r); scenery.add(far(m)); }
        const lines = new THREE.GridHelper(2 * (R + 120), 60, '#ff4fd8', '#ff4fd8'); lines.position.y = .02; lines.material.transparent = true; lines.material.opacity = .35; scenery.add(lines);
        break; }
    }
  }
  function applyArena() {
    const A = arenaDef();
    retroSun.sp.visible = retroSun.halo.visible = A.fx === 'retro';
    drawFloorTile(A); applyArenaLook(A); arenaScenery(A);
    rim.material.color.set(A.rim); rimGlow.material.color.set(A.rim); edgeGlow.material.color.set(A.rim); rimInner.material.color.set(A.inner);
    nebulae.forEach((n, i) => n.material.color.set(A.neb[i]));
  }
  applyArena();
  // ---- field size: 1 for the usual modes, 2 for the modes for two. Everything sized by R follows, crumbs are laid out again ----
  let arenaK = 1;
  function setArenaSize(k) {
    if (k === arenaK) return;
    const was = arenaK; arenaK = k; R = R_BASE * k; FOOD = Math.min(FOOD_MAX, Math.round(FOOD_BASE * k * k));   // crumbs follow the area of the field
    [floor, edgeGlow, rim, rimGlow, rimInner, sceneryGround].forEach(m => m.scale.setScalar(k));
    gridTex.repeat.set(R / 3, R / 3); floorFx.uniforms.uTileRep.value = R / 3; floorFx.uniforms.uR.value = R;
    stars.scale.setScalar(k); nebulae.forEach(n => n.position.multiplyScalar(k / was));
    retroSun.sp.position.z = retroSun.halo.position.z = -R - 140;
    fgrid.forEach(b => { b.length = 0; }); foodKey.fill(-1); foodMesh.count = FOOD; for (let i = 0; i < FOOD; i++) placeFood(i);
    applyArena();   // the scenery stands around the new rim
  }

  // food
  const foodPalette = ['#22e6ff', '#ffd23f', '#b26bff', '#3dffa2', '#ff4fd8'].map(c => new THREE.Color(c));
  const foodMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.3, 0), new THREE.MeshBasicMaterial(), FOOD_MAX);
  foodMesh.count = FOOD;   // only the crumbs of the current field are drawn
  scene.add(foodMesh);
  const foods = [];
  const dummy = new THREE.Object3D();
  function randInArena(margin) {
    const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * (R - margin);
    return [Math.cos(a) * d, Math.sin(a) * d];
  }
  // 1.7.0: crumbs are kept in an 8×8 grid, so a blob only checks the crumbs around it (not all 5 250)
  const FG = 8, FGN = Math.ceil(2 * R_MAX / FG) + 1, fgrid = Array.from({ length: FGN * FGN }, () => []), foodKey = new Int32Array(FOOD_MAX).fill(-1);   // sized for the widest field
  const fgCell = v => Math.max(0, Math.min(FGN - 1, Math.floor((v + R) / FG)));
  function fgSet(i) {
    const f = foods[i], k = fgCell(f.x) * FGN + fgCell(f.z), old = foodKey[i];
    if (old === k) return;
    if (old >= 0) { const b = fgrid[old], j = b.indexOf(i); if (j >= 0) { b[j] = b[b.length - 1]; b.pop(); } }
    fgrid[k].push(i); foodKey[i] = k;
  }
  function placeFood(i) {
    const [x, z] = randInArena(1.5);
    foods[i] = { x, z }; fgSet(i);
    dummy.position.set(x, 0.35, z); dummy.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    dummy.updateMatrix(); foodMesh.setMatrixAt(i, dummy.matrix);
    foodMesh.instanceMatrix.needsUpdate = true;
  }
  for (let i = 0; i < FOOD_MAX; i++) { if (i < FOOD) placeFood(i); foodMesh.setColorAt(i, foodPalette[i % foodPalette.length]); }
  foodMesh.instanceColor.needsUpdate = true;

  // ================= blob visuals =================
  const sphereGeo = new THREE.SphereGeometry(1, 32, 24);
  const eyeGeo = new THREE.SphereGeometry(0.13, 10, 10);
  const pupilGeo = new THREE.SphereGeometry(0.07, 8, 8);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x14102a });
  const ringGeo = new THREE.RingGeometry(1.08, 1.22, 48);
  const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd166, metalness: .3, roughness: .35, emissive: 0xc08a10, emissiveIntensity: .8, side: THREE.DoubleSide });
  const radius = m => 0.38 * Math.sqrt(m);
  const cellR = c => 0.38 * Math.sqrt(c.mass) * (c.owner && c.owner.rs || 1);   // «Сжатие» shrinks the player's cells
  const PREY = C('--prey'), THREAT = C('--threat'), NEUTRAL = new THREE.Color(0x8088c0);

  function makeCrown() {
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(new THREE.CylinderGeometry(.42, .48, .18, 16, 1, true), crownMat));
    for (let i = 0; i < 5; i++) {
      const cone = new THREE.Mesh(new THREE.ConeGeometry(.1, .3, 8), crownMat);
      const a = i / 5 * Math.PI * 2;
      cone.position.set(Math.cos(a) * .42, .22, Math.sin(a) * .42);
      grp.add(cone);
    }
    grp.position.y = .92;
    return grp;
  }
  const allVis = [];
  function makeVis(color) {
    const mesh = new THREE.Mesh(sphereGeo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .45, roughness: .22, metalness: .1, transparent: true, opacity: .9 }));
    const glow = glowSprite(color, 3.2, .85); mesh.add(glow);
    [-0.35, 0.35].forEach(x => {
      const e = new THREE.Mesh(eyeGeo, eyeMat); e.position.set(x, 0.35, 0.86);
      const p = new THREE.Mesh(pupilGeo, pupilMat); p.position.set(0, 0, 0.09); e.add(p);
      mesh.add(e);
    });
    const crown = makeCrown(); crown.visible = false; mesh.add(crown);
    const shield = new THREE.Mesh(new THREE.SphereGeometry(1.25, 24, 16),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(BONUS.shield.color), transparent: true, opacity: .2 }));
    shield.visible = false; mesh.add(shield);
    const ring = new THREE.Mesh(ringGeo, decal(new THREE.MeshBasicMaterial({ color: NEUTRAL, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false })));
    ring.rotation.x = -Math.PI / 2;
    mesh.visible = ring.visible = false;
    scene.add(mesh, ring);
    const vis = { mesh, ring, crown, shield, glow, jig: 0 };
    allVis.push(vis);
    return vis;
  }

  // ---- skin textures: every pattern is drawn once per skin into a 256×128 canvas (wrapped around the sphere) ----
  // 1.7.0: new living patterns; `flow: [u, v]` scrolls the texture every frame, `emi` draws a separate glow map
  const texCache = {}, emiCache = {};
  const rnd = (seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647);
  function drawPattern(x, s, emi) {
    const W = 256, H = 128, A = s.accent || '#ffffff', C = s.color, r = rnd(([...s.id].reduce((a, ch) => a * 31 + ch.charCodeAt(0), 7) % 2147483646) + 1);
    const line = (pts, w, col, a = 1) => { x.globalAlpha = a; x.strokeStyle = col; x.lineWidth = w; x.beginPath(); pts.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.stroke(); x.globalAlpha = 1; };
    const dot = (px, py, rad, col, a = 1) => { x.globalAlpha = a; x.fillStyle = col; x.beginPath(); x.arc(px, py, rad, 0, Math.PI * 2); x.fill(); x.globalAlpha = 1; };
    const grad = (c1, c2, c3) => { const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, c1); if (c3) { g.addColorStop(.55, c2); g.addColorStop(1, c3); } else g.addColorStop(1, c2); x.fillStyle = g; x.fillRect(0, 0, W, H); };
    x.fillStyle = emi ? '#000000' : C; x.fillRect(0, 0, W, H); x.fillStyle = A;
    switch (s.pattern) {
      // ---- classic patterns ----
      case 'stripes': for (let i = 0; i < W; i += 42) x.fillRect(i, 0, 14, H); break;
      case 'dots': for (let q = 0; q < 4; q++) for (let c = 0; c < 8; c++) dot(c * 32 + (q % 2) * 16 + 8, q * 32 + 18, 7, A); break;
      case 'gradient': grad(C, A); break;
      case 'grid': for (let i = 0; i < W; i += 16) x.fillRect(i, 0, 2, H); for (let j = 0; j < H; j += 16) x.fillRect(0, j, W, 2); break;
      case 'zigzag': for (let i = -128; i < W; i += 24) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 10, 0); x.lineTo(i + 138, H); x.lineTo(i + 128, H); x.fill(); } break;
      case 'rings': for (let j = 4; j < H; j += 18) x.fillRect(0, j, W, 6); break;
      case 'stars': for (let i = 0; i < 140; i++) dot(r() * W, r() * H, r() < .1 ? 2 : .9, A, .4 + r() * .6); break;
      // ---- 1.7.0 patterns ----
      case 'waves': for (let j = 10; j < H; j += 22) { const pts = []; for (let i = 0; i <= W; i += 4) pts.push([i, j + Math.sin(i / W * Math.PI * 4 + j) * 5]); line(pts, 6, A, .85); line(pts.map(([a, b]) => [a, b - 4]), 2, '#ffffff', .55); } break;
      case 'spiral': for (let i = -H; i < W + H; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + 14, 0); x.lineTo(i + 14 + H * .8, H); x.lineTo(i + H * .8, H); x.fill(); } x.fillStyle = '#ffffff'; x.globalAlpha = .35; for (let i = -H; i < W + H; i += 32) { x.beginPath(); x.moveTo(i + 16, 0); x.lineTo(i + 19, 0); x.lineTo(i + 19 + H * .8, H); x.lineTo(i + 16 + H * .8, H); x.fill(); } x.globalAlpha = 1; break;
      case 'marble': for (let k = 0; k < 26; k++) { let px = r() * W, py = r() * H; const pts = [[px, py]]; for (let i = 0; i < 14; i++) { px += (r() - .3) * 22; py += (r() - .5) * 14; pts.push([px, py]); } line(pts, .6 + r() * 2.2, k % 5 ? A : '#ffffff', .25 + r() * .5); } break;
      case 'hex': { const s3 = 9; x.strokeStyle = A; x.lineWidth = 2; for (let row = 0; row < 12; row++) for (let col = 0; col < 18; col++) { const cx = col * s3 * 1.75 + (row % 2) * s3 * .87, cy = row * s3 * 1.5; x.beginPath(); for (let k = 0; k < 7; k++) { const a = Math.PI / 3 * k + Math.PI / 6; x.lineTo(cx + Math.cos(a) * s3, cy + Math.sin(a) * s3); } x.stroke(); } break; }
      case 'scales': for (let row = 0; row < 10; row++) for (let col = 0; col < 18; col++) { const cx = col * 16 + (row % 2) * 8, cy = row * 14; x.globalAlpha = .9; x.fillStyle = row % 2 ? A : '#ffffff'; x.beginPath(); x.arc(cx, cy, 9, 0, Math.PI); x.fill(); x.fillStyle = C; x.beginPath(); x.arc(cx, cy - 2, 7, 0, Math.PI); x.fill(); } x.globalAlpha = 1; break;
      case 'circuit': for (let k = 0; k < 40; k++) { let px = Math.round(r() * 32) * 8, py = Math.round(r() * 16) * 8; const pts = [[px, py]]; for (let i = 0; i < 4; i++) { if (r() < .5) px += (r() < .5 ? -1 : 1) * 8 * (1 + Math.floor(r() * 4)); else py += (r() < .5 ? -1 : 1) * 8 * (1 + Math.floor(r() * 3)); pts.push([px, py]); } line(pts, 2, A, emi ? 1 : .9); dot(px, py, 3, A); } if (!emi) { x.fillStyle = '#1a1a2a'; x.fillRect(110, 46, 36, 36); x.strokeStyle = A; x.lineWidth = 2; x.strokeRect(110, 46, 36, 36); } break;
      case 'cracks': { if (!emi) grad(C, '#1a0500'); for (let k = 0; k < 18; k++) { let px = r() * W, py = r() * H; const pts = [[px, py]]; for (let i = 0; i < 7; i++) { px += (r() - .5) * 30; py += (r() - .5) * 22; pts.push([px, py]); } line(pts, 3.5, emi ? '#ffffff' : A, 1); line(pts, 1.2, '#fff6a0', emi ? 1 : .8); } break; }
      case 'bubbles': for (let i = 0; i < 46; i++) { const px = r() * W, py = r() * H, rr = 2 + r() * 7; x.globalAlpha = .7; x.strokeStyle = A; x.lineWidth = 1.5; x.beginPath(); x.arc(px, py, rr, 0, Math.PI * 2); x.stroke(); dot(px - rr * .35, py - rr * .35, rr * .25, '#ffffff', .8); } break;
      case 'sunset': grad(s.c2 || '#2a0a4a', C, A); dot(W / 2, H * .62, 30, '#fff3a0', .95); x.fillStyle = s.c2 || '#2a0a4a'; for (let j = 0; j < 6; j++) x.fillRect(0, H * .62 + j * 5 + j * j * .6, W, 1.6 + j * .5); break;
      case 'synth': grad('#1a0040', C, '#ff9a3d'); dot(W / 2, H * .45, 26, '#ffd23f'); x.fillStyle = '#1a0040'; for (let j = 0; j < 6; j++) x.fillRect(0, H * .45 + j * 5, W, 1 + j * .7); x.strokeStyle = A; x.lineWidth = 1.4; for (let i = 0; i <= W; i += 16) { x.beginPath(); x.moveTo(i, H * .7); x.lineTo((i - W / 2) * 2.4 + W / 2, H); x.stroke(); } for (let j = 0; j < 5; j++) x.fillRect(0, H * .7 + j * j * 3, W, 1.2); break;
      case 'aurora': grad('#020814', C); for (let b = 0; b < 4; b++) { const pts = []; for (let i = 0; i <= W; i += 4) pts.push([i, 30 + b * 18 + Math.sin(i / 40 + b * 2) * 10]); line(pts, 10, [A, '#3dffa2', '#b26bff', '#22e6ff'][b], .45); } for (let i = 0; i < 50; i++) dot(r() * W, r() * H, .8, '#ffffff', .7); break;
      case 'swirl': grad('#05021a', C); for (let arm = 0; arm < 3; arm++) for (let i = 0; i < 70; i++) { const t = i / 70, a = arm * 2.1 + t * 5; dot(W / 2 + Math.cos(a) * t * 120, H / 2 + Math.sin(a) * t * 52, 1 + (1 - t) * 2.5, r() < .3 ? '#ffffff' : A, .9 - t * .5); } dot(W / 2, H / 2, 10, '#fff6c8', .9); break;
      case 'glitch': for (let k = 0; k < 26; k++) { x.fillStyle = [A, '#ffffff', '#ff2d55', '#22e6ff'][k % 4]; x.globalAlpha = .4 + r() * .6; x.fillRect(r() * W, r() * H, 10 + r() * 70, 2 + r() * 7); } x.globalAlpha = 1; break;
      case 'code': for (let col = 0; col < 32; col++) { const len = 4 + Math.floor(r() * 10), y0 = r() * H; for (let i = 0; i < len; i++) { x.globalAlpha = (i + 1) / len; x.fillStyle = i === len - 1 ? '#ffffff' : A; x.fillRect(col * 8 + 1, (y0 + i * 7) % H, 5, 5); } } x.globalAlpha = 1; break;
      case 'plates': for (let row = 0; row < 4; row++) for (let col = 0; col < 8; col++) { const px = col * 32 + (row % 2) * 16, py = row * 32; x.fillStyle = (row + col) % 2 ? A : '#ffffff'; x.globalAlpha = .25; x.fillRect(px + 2, py + 2, 28, 28); x.globalAlpha = 1; x.strokeStyle = A; x.lineWidth = 2; x.strokeRect(px + 2, py + 2, 28, 28); [[5, 5], [27, 5], [5, 27], [27, 27]].forEach(([a, b]) => dot(px + a, py + b, 1.6, '#ffffff')); } break;
      case 'hearts': for (let q = 0; q < 4; q++) for (let c = 0; c < 9; c++) { const px = c * 29 + (q % 2) * 14, py = q * 32 + 14; x.fillStyle = A; x.beginPath(); x.moveTo(px, py + 8); x.bezierCurveTo(px - 12, py - 2, px - 6, py - 12, px, py - 4); x.bezierCurveTo(px + 6, py - 12, px + 12, py - 2, px, py + 8); x.fill(); } break;
      case 'ribs': for (let i = 0; i < W; i += 32) { const g = x.createLinearGradient(i, 0, i + 32, 0); g.addColorStop(0, A); g.addColorStop(.5, C); g.addColorStop(1, A); x.fillStyle = g; x.fillRect(i, 0, 32, H); } break;
      case 'snow': grad(C, A); for (let i = 0; i < 120; i++) dot(r() * W, r() * H, r() < .15 ? 2 : 1, '#ffffff', .5 + r() * .5); break;
      case 'melon': for (let i = 0; i < W; i += 21) { const pts = []; for (let j = 0; j <= H; j += 6) pts.push([i + Math.sin(j / 9 + i) * 4, j]); line(pts, 7, A, 1); } break;
      case 'amanita': grad(C, '#a3001a'); for (let i = 0; i < 18; i++) dot(r() * W, r() * H * .8, 4 + r() * 6, '#ffffff', .95); break;
      case 'branches': for (let k = 0; k < 10; k++) { const grow = (px, py, a, len, d) => { if (d > 4 || len < 4) return; const nx = px + Math.cos(a) * len, ny = py + Math.sin(a) * len; line([[px, py], [nx, ny]], 3 - d * .5, emi ? '#ffffff' : A, 1); grow(nx, ny, a - .5 + r() * .3, len * .7, d + 1); grow(nx, ny, a + .5 - r() * .3, len * .7, d + 1); }; grow(r() * W, H, -Math.PI / 2 + (r() - .5) * .6, 26, 0); } break;
      case 'scan': grad(C, A); for (let j = 0; j < H; j += 4) { x.fillStyle = '#ffffff'; x.globalAlpha = j % 16 ? .12 : .4; x.fillRect(0, j, W, 1.4); } x.globalAlpha = 1; break;
      case 'facets': for (let i = 0; i < 60; i++) { x.fillStyle = [C, A, '#ffffff'][i % 3]; x.globalAlpha = .25 + r() * .5; x.beginPath(); x.moveTo(r() * W, r() * H); x.lineTo(r() * W, r() * H); x.lineTo(r() * W, r() * H); x.fill(); } x.globalAlpha = 1; break;
      case 'fractal': for (let k = 6; k >= 1; k--) for (let i = 0; i < 4; i++) { const sz = k * 10, cx = 32 + i * 64, cy = 64; x.strokeStyle = k % 2 ? A : '#ffffff'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx, cy - sz); x.lineTo(cx + sz, cy); x.lineTo(cx, cy + sz); x.lineTo(cx - sz, cy); x.closePath(); x.stroke(); } break;
      case 'vortex': for (let j = 0; j < H; j += 3) { x.fillStyle = A; x.globalAlpha = Math.pow(1 - j / H, 2); x.fillRect(0, j, W, 1.6); } x.globalAlpha = 1; for (let i = 0; i < 40; i++) dot(r() * W, r() * H * .5, 1, '#ffffff', .8); break;
      case 'meteors': for (let i = 0; i < 18; i++) { const px = r() * W, py = r() * H; const g = x.createLinearGradient(px, py, px - 40, py - 14); g.addColorStop(0, '#ffffff'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.strokeStyle = g; x.lineWidth = 2; x.beginPath(); x.moveTo(px, py); x.lineTo(px - 40, py - 14); x.stroke(); } for (let i = 0; i < 70; i++) dot(r() * W, r() * H, .8, A, .7); break;
      case 'tiger': for (let i = 0; i < 16; i++) { const px = r() * W; const pts = []; for (let j = 0; j <= H; j += 8) pts.push([px + Math.sin(j / 12 + i) * 8 + j * .15, j]); line(pts, 4 + r() * 4, A, 1); } break;
      case 'coins': for (let row = 0; row < 6; row++) for (let col = 0; col < 12; col++) { const cx = col * 22 + (row % 2) * 11, cy = row * 22 + 8; x.fillStyle = '#7a4a00'; x.beginPath(); x.ellipse(cx, cy + 3, 9, 5, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = A; x.beginPath(); x.ellipse(cx, cy, 9, 5, 0, 0, Math.PI * 2); x.fill(); x.strokeStyle = '#fff6c8'; x.lineWidth = 1; x.beginPath(); x.ellipse(cx, cy, 6, 3, 0, 0, Math.PI * 2); x.stroke(); } break;
      case 'heraldry': { x.fillStyle = A; x.fillRect(0, 0, 64, 64); x.fillRect(128, 0, 64, 64); x.fillRect(64, 64, 64, 64); x.fillRect(192, 64, 64, 64); x.fillStyle = '#ffd23f'; x.fillRect(0, 60, W, 8); for (let i = 28; i < W; i += 64) x.fillRect(i, 0, 8, H);
        for (let i = 0; i < 4; i++) { const cx = 32 + i * 64, cy = 32 + (i % 2) * 64; x.fillStyle = i % 2 ? C : A === '#ffffff' ? '#4d7cff' : '#ffffff'; x.globalAlpha = .7; x.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + k * Math.PI / 5, rr = k % 2 ? 5 : 12; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.fill(); x.globalAlpha = 1; } break; }
      case 'veins': for (let k = 0; k < 14; k++) { let px = r() * W, py = r() * H; const pts = [[px, py]]; for (let i = 0; i < 12; i++) { px += (r() - .3) * 24; py += (r() - .5) * 16; pts.push([px, py]); } line(pts, k % 3 ? 1.4 : 3, A, .9); line(pts, .6, '#ffffff', .6); } break;
      case 'shatter': for (let k = 0; k < 46; k++) { const cx = r() * W, cy = r() * H, rr = 4 + r() * 12; x.beginPath(); for (let i = 0; i < 4 + (k % 3); i++) { const a = i / (4 + (k % 3)) * 6.283 + r(); x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath();
        if (emi) { x.strokeStyle = '#ffffff'; x.lineWidth = 1.6; x.stroke(); } else { x.fillStyle = k % 2 ? A : '#ffffff'; x.globalAlpha = .25 + r() * .5; x.fill(); x.globalAlpha = 1; x.strokeStyle = A; x.lineWidth = 1.2; x.stroke(); } } break;
      case 'split': for (let j = 0; j < H; j += 6) { x.fillStyle = '#ff2dd8'; x.globalAlpha = .55; x.fillRect((j * 7) % 23 - 4, j, W, 2.5); x.fillStyle = '#22e6ff'; x.fillRect((j * 11) % 19 + 4, j + 3, W, 2); } x.globalAlpha = 1; for (let k = 0; k < 9; k++) { x.fillStyle = k % 2 ? '#ff2dd8' : '#22e6ff'; x.fillRect(r() * W, r() * H, 20 + r() * 50, 3); } break;
      case 'brass': grad('#fff0c0', C, A); for (let i = 0; i < W; i += 32) { x.fillStyle = '#7a4a12'; x.globalAlpha = .35; x.fillRect(i, 0, 2, H); x.globalAlpha = 1; for (let j = 18; j < H; j += 30) dot(i + 8, j, 2.2, '#fff6d8', .8); } line([[0, H * .48], [W, H * .48]], 3, A, .8); break;
      case 'live': liveDraw(x, s, 0); break;
      case 'laurel': grad(C, A); for (let i = 0; i < W; i += 12) { x.fillStyle = '#fff6c8'; x.globalAlpha = .6; x.beginPath(); x.ellipse(i, 64 + Math.sin(i / 20) * 20, 4, 8, .6, 0, Math.PI * 2); x.fill(); } x.globalAlpha = 1; break;
    }
    if (s.pattern2 === 'stars') for (let i = 0; i < 60; i++) dot(r() * W, r() * H, r() < .1 ? 1.8 : .8, '#ffffff', .4 + r() * .6);
  }
  // ---- 2.3 «Хронос» live skins: the dial / spring / moon are drawn flat, then wrapped onto the top cap of the sphere
  // (the camera looks from above and the drop turns to its heading, so the cap is the part that is always seen)
  const capCv = document.createElement('canvas'); capCv.width = capCv.height = 128; const capX = capCv.getContext('2d');
  const CAP_RAD = 1.15;   // the cap reaches 66° down from the top
  let capMap = null;
  function capWarp(x) {   // copies capCv onto the top rows of the 256×128 texture (polar → equirectangular)
    const rows = Math.ceil(CAP_RAD / Math.PI * 128), src = capX.getImageData(0, 0, 128, 128).data, img = x.getImageData(0, 0, 256, rows), d = img.data;
    if (!capMap) { capMap = new Int32Array(256 * rows); for (let y = 0; y < rows; y++) { const rr = (y + .5) / 128 * Math.PI / CAP_RAD * 64; for (let u = 0; u < 256; u++) { const a = (u + .5) / 256 * Math.PI * 2, fx = Math.round(64 + Math.cos(a) * rr), fy = Math.round(64 + Math.sin(a) * rr); capMap[y * 256 + u] = fx >= 0 && fx < 128 && fy >= 0 && fy < 128 ? (fy * 128 + fx) * 4 : -1; } } }
    for (let i = 0; i < capMap.length; i++) { const k = capMap[i]; if (k < 0) continue; const al = src[k + 3] / 255; if (!al) continue; const o = i * 4; d[o] = d[o] * (1 - al) + src[k] * al; d[o + 1] = d[o + 1] * (1 - al) + src[k + 1] * al; d[o + 2] = d[o + 2] * (1 - al) + src[k + 2] * al; }
    x.putImageData(img, 0, 0);
  }
  const liveState = {};
  function liveDraw(x, s, t) {
    const W = 256, H = 128, c = capX, A = s.accent, C = s.color;
    const gear = (cx, cy, r, n, rot) => { x.beginPath(); for (let i = 0; i <= n * 4; i++) { const a = rot + i / (n * 4) * Math.PI * 2, rr = (i % 4 < 2) ? r : r * .82; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.stroke(); x.beginPath(); x.arc(cx, cy, r * .45, 0, 6.29); x.stroke(); };
    const cgear = (cx, cy, r, n, rot) => { c.beginPath(); for (let i = 0; i <= n * 4; i++) { const a = rot + i / (n * 4) * Math.PI * 2, rr = (i % 4 < 2) ? r : r * .82; c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } c.closePath(); c.stroke(); c.beginPath(); c.arc(cx, cy, r * .45, 0, 6.29); c.stroke(); };
    const g = x.createLinearGradient(0, 0, 0, H);
    c.clearRect(0, 0, 128, 128);
    switch (s.live) {
      case 'engrave': {   // dark bronze, glowing engraved gears turning all over
        g.addColorStop(0, '#5a3010'); g.addColorStop(1, '#1e0c04'); x.fillStyle = g; x.fillRect(0, 0, W, H);
        x.strokeStyle = A; x.lineWidth = 1.4; x.shadowColor = A; x.shadowBlur = 4;
        [[30, 80, 20, 12, 1], [96, 92, 14, 9, -1.4], [150, 74, 22, 13, .8], [212, 96, 16, 10, -1.1], [250, 70, 12, 8, 1.5], [62, 112, 9, 7, 2]].forEach(([gx, gy, r, n, sp]) => gear(gx, gy, r, n, t * sp * .5));
        x.shadowBlur = 0;
        c.strokeStyle = A; c.lineWidth = 2; c.shadowColor = A; c.shadowBlur = 5; cgear(64, 64, 34, 16, t * .25); cgear(64, 64, 16, 10, -t * .6); cgear(28, 30, 14, 9, -t * .55); cgear(100, 98, 12, 8, t * .7); c.shadowBlur = 0; break;
      }
      case 'watch': {   // gold case, a white dial with hands on top
        g.addColorStop(0, '#fff0c0'); g.addColorStop(.5, C); g.addColorStop(1, A); x.fillStyle = g; x.fillRect(0, 0, W, H);
        x.strokeStyle = 'rgba(122,74,18,.45)'; x.lineWidth = 1; for (let i = 0; i < W; i += 8) { x.beginPath(); x.moveTo(i, 60); x.lineTo(i + 4, H); x.stroke(); }
        c.fillStyle = '#7a4a12'; c.beginPath(); c.arc(64, 64, 63, 0, 6.29); c.fill(); c.fillStyle = '#ffd27a'; c.beginPath(); c.arc(64, 64, 59, 0, 6.29); c.fill();
        c.fillStyle = '#fff8e6'; c.beginPath(); c.arc(64, 64, 54, 0, 6.29); c.fill();
        c.strokeStyle = '#2a1a08'; for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2, r0 = i % 5 ? 49 : 44; c.lineWidth = i % 5 ? 1 : 2.6; c.beginPath(); c.moveTo(64 + Math.cos(a) * r0, 64 + Math.sin(a) * r0); c.lineTo(64 + Math.cos(a) * 52, 64 + Math.sin(a) * 52); c.stroke(); }
        const hand = (a, len, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(64 - Math.cos(a) * 6, 64 - Math.sin(a) * 6); c.lineTo(64 + Math.cos(a) * len, 64 + Math.sin(a) * len); c.stroke(); };
        hand(t / 40 * Math.PI * 2, 28, 4.5, '#2a1a08'); hand(t / 8 * Math.PI * 2, 40, 3, '#2a1a08'); hand(t * Math.PI / 3, 46, 1.4, '#ff3d6e');
        c.fillStyle = '#2a1a08'; c.beginPath(); c.arc(64, 64, 4, 0, 6.29); c.fill(); break;
      }
      case 'spring': {   // a glowing clock spring pulses, a hand runs along it
        g.addColorStop(0, '#2a1a50'); g.addColorStop(1, '#06030f'); x.fillStyle = g; x.fillRect(0, 0, W, H);
        for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(34,230,255,' + (.2 + .3 * Math.abs(Math.sin(t * 2 + i))) + ')'; x.fillRect((i * 53) % W, 50 + (i * 29) % 78, 1.6, 1.6); }
        const k = .55 + .45 * Math.sin(t * 3); c.strokeStyle = `rgba(34,230,255,${.5 + .5 * k})`; c.lineWidth = 2.6; c.shadowColor = A; c.shadowBlur = 6 + 6 * k;
        c.beginPath(); for (let a = 0; a < 5.5 * Math.PI * 2; a += .12) { const r = 3 + a * 1.75; c.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } c.stroke(); c.shadowBlur = 0;
        const p = (t * .35) % 1, a = p * 5.5 * Math.PI * 2, r = 3 + a * 1.75; c.fillStyle = '#ffffff'; c.shadowColor = '#ffffff'; c.shadowBlur = 10; c.beginPath(); c.arc(64 + Math.cos(a) * r, 64 + Math.sin(a) * r, 3.4, 0, 6.29); c.fill(); c.shadowBlur = 0;
        c.fillStyle = '#ffd27a'; c.beginPath(); c.arc(64, 64, 4, 0, 6.29); c.fill(); break;
      }
      case 'moon': {   // blue enamel, gold stars, a moon-phase window on top; full moon flashes
        g.addColorStop(0, '#24308a'); g.addColorStop(1, '#0a0e36'); x.fillStyle = g; x.fillRect(0, 0, W, H);
        for (let i = 0; i < 46; i++) { const tw = .4 + .6 * Math.abs(Math.sin(t * 1.3 + i * 1.7)); x.globalAlpha = tw; x.fillStyle = i % 4 ? '#ffd27a' : '#ffffff'; const sx = (i * 67) % W, sy = 30 + (i * 41) % 96; x.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? 1 : 3; x.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); } x.fill(); } x.globalAlpha = 1;
        const ph = (t / 12) % 1, full = Math.max(0, 1 - Math.abs(ph - .5) * 8); liveState[s.id] = full;
        c.save(); c.beginPath(); c.arc(64, 70, 44, Math.PI, 0); c.closePath(); c.clip(); c.fillStyle = '#060a26'; c.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 9; i++) { c.fillStyle = '#fff'; c.globalAlpha = .4 + .6 * Math.abs(Math.sin(t * 2 + i)); c.fillRect(24 + (i * 37) % 80, 34 + (i * 23) % 30, 1.6, 1.6); } c.globalAlpha = 1;
        const mx = 64 + (ph - .5) * 150; c.fillStyle = '#fff6d8'; c.shadowColor = '#fff6d8'; c.shadowBlur = 8 + 12 * full; c.beginPath(); c.arc(mx, 58, 20, 0, 6.29); c.fill(); c.shadowBlur = 0;
        c.fillStyle = '#d8cfa8'; c.beginPath(); c.arc(mx - 6, 52, 4, 0, 6.29); c.arc(mx + 7, 63, 3, 0, 6.29); c.fill(); c.restore();
        c.strokeStyle = A; c.lineWidth = 5; c.beginPath(); c.arc(64, 70, 46, Math.PI, 0); c.stroke(); c.beginPath(); c.moveTo(16, 70); c.lineTo(112, 70); c.stroke();
        c.fillStyle = A; [[18, 70], [110, 70], [64, 22]].forEach(([px, py]) => { c.beginPath(); c.arc(px, py, 4.5, 0, 6.29); c.fill(); }); break;
      }
    }
    capWarp(x);
  }
  // redraw live textures ~12 times a second (one shared texture per skin, so many parts cost nothing extra)
  function liveTick(s, now) {
    const st = liveState['_t' + s.id] || 0; if (now - st < 80) return;
    liveState['_t' + s.id] = now; const tx = skinTex(s); liveDraw(tx.image.getContext('2d'), s, now / 1000); tx.needsUpdate = true;
  }
  // a gear outline shape, extruded (Скелетон, Шестерни-крылья, Стена шестерён)
  const gearGeoCache = {};
  function gearGeo(r, n, depth = .1) {
    const key = r + '_' + n + '_' + depth; if (gearGeoCache[key]) return gearGeoCache[key];
    const sh = new THREE.Shape(); for (let i = 0; i < n * 4; i++) { const a = i / (n * 4) * Math.PI * 2, rr = (i % 4 < 2) ? r : r * .8; i ? sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : sh.moveTo(Math.cos(a) * rr, Math.sin(a) * rr); } sh.closePath();
    const hole = new THREE.Path(); hole.absarc(0, 0, r * .3, 0, Math.PI * 2, true); sh.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false }); geo.translate(0, 0, -depth / 2);
    return (gearGeoCache[key] = geo);
  }
  function skinTex(s) {
    if (!s.pattern) return null;
    if (texCache[s.id]) return texCache[s.id];
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    drawPattern(cv.getContext('2d'), s, false);
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return (texCache[s.id] = t);
  }
  // glow-only map: dark everywhere except the lines (magma cracks, circuit traces, lightning branches)
  function skinEmi(s) {
    if (!s.emi) return skinTex(s);
    if (emiCache[s.id]) return emiCache[s.id];
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
    drawPattern(cv.getContext('2d'), s, true);
    const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return (emiCache[s.id] = t);
  }
  const swatchUrlCache = {};
  const swatchUrl = s => swatchUrlCache[s.id] || (swatchUrlCache[s.id] = skinTex(s).image.toDataURL());
  // a glint that sweeps over epic and legendary skins
  const isShiny = k => k.raid || k.legend || ['epic', 'legendary'].includes(k.chest || k.lchest || k.craft);
  const HEAD_SVG = {
    flame: '<path d="M12 2c2 4 6 6 6 11a6 6 0 0 1-12 0c0-3 2-5 3-7 1 2 2 3 3 3-1-3 0-5 0-7z" fill="#ff9a3d"/><path d="M12 11c1 2 3 3 3 5a3 3 0 0 1-6 0c0-1 1-2 1.5-3 .5 1 1 1.5 1.5 1.5-.5-1.5 0-2.5 0-3.5z" fill="#ffd23f"/>',
    antenna: '<path d="M9 23 L6 7 M15 23 L18 7" stroke="#3dffa2" stroke-width="2" fill="none"/><circle cx="6" cy="5" r="3" fill="#b9ff3d"/><circle cx="18" cy="5" r="3" fill="#b9ff3d"/>',
    halo: '<ellipse cx="12" cy="12" rx="10" ry="4.5" fill="none" stroke="#ffd23f" stroke-width="3"/>',
    gem: '<path d="M12 2 L20 10 L12 22 L4 10 Z" fill="#b26bff" stroke="#e8fbff" stroke-width="1.2"/><path d="M4 10 L20 10 M12 2 L9 10 L12 22 L15 10 Z" fill="none" stroke="#e8fbff" stroke-width=".8"/>',
    star: '<path d="M12 2 l3 7 7.4.6-5.6 4.8 1.8 7.4L12 17.8l-6.6 4 1.8-7.4L1.6 9.6 9 9z" fill="#ffd23f"/>',
    horns: '<path d="M4 21 C3 13 5 7 9 3 C8 9 9 15 11 21 Z M20 21 C21 13 19 7 15 3 C16 9 15 15 13 21 Z" fill="#ff3d6e"/>',
    moons: '<circle cx="12" cy="12" r="3" fill="#ff2d55"/><circle cx="4" cy="9" r="2.5" fill="#3a2a5a" stroke="#ff2d55"/><circle cx="20" cy="9" r="2.5" fill="#3a2a5a" stroke="#ff2d55"/><circle cx="12" cy="3.5" r="2.5" fill="#3a2a5a" stroke="#ff2d55"/>',
    coins: '<ellipse cx="12" cy="18" rx="8" ry="3" fill="#b07a00"/><ellipse cx="12" cy="14" rx="8" ry="3" fill="#ffd23f" stroke="#b07a00"/><ellipse cx="12" cy="10" rx="8" ry="3" fill="#ffd23f" stroke="#b07a00"/><ellipse cx="12" cy="6" rx="8" ry="3" fill="#fff6a0" stroke="#b07a00"/>',
    nova: '<path d="M12 1 L13.6 9 L22 6 L15 12 L22 18 L13.6 15 L12 23 L10.4 15 L2 18 L9 12 L2 6 L10.4 9 Z" fill="#ff4fd8"/><circle cx="12" cy="12" r="3" fill="#fff"/>',
    laurel: '<path d="M12 20 C5 18 3 12 4 6 M12 20 C19 18 21 12 20 6" stroke="#ffd23f" stroke-width="1.6" fill="none"/><g fill="#ffd23f"><ellipse cx="4.5" cy="9" rx="1.6" ry="2.6"/><ellipse cx="5.5" cy="14" rx="1.6" ry="2.6"/><ellipse cx="19.5" cy="9" rx="1.6" ry="2.6"/><ellipse cx="18.5" cy="14" rx="1.6" ry="2.6"/></g>',
    prism: '<path d="M12 2 L21 19 L3 19 Z" fill="#22e6ff" opacity=".85"/><path d="M12 2 L12 19 L3 19 Z" fill="#ff4fd8" opacity=".7"/>',
    wings: '<path d="M12 15 C8 6 3 6 1 9 C4 10 6 14 12 17 Z M12 15 C16 6 21 6 23 9 C20 10 18 14 12 17 Z" fill="#ffffff"/>',
  };
  Object.entries(HATS).forEach(([k, h]) => HEAD_SVG[k] = h.svg);
  const starsOf = k => (save.stars && save.stars[k.id]) || 0;
  const swClass = k => { const st = starsOf(k); return `sw ${k.crown ? 'crown' : ''} ${isShiny(k) || st >= 2 ? 'shine' + ((k.chest || k.lchest || k.craft) === 'legendary' ? ' leg' : '') + (k.shine === 'bolt' ? ' bolt' : '') : ''} ${st >= 3 ? 'st3' : ''}`; };
  const headIcon = k => k.head ? `<i class="hi" aria-hidden="true"><svg viewBox="0 0 24 24">${HEAD_SVG[k.head]}</svg></i>` : '';
  const hatIcon = id => `<svg viewBox="0 0 24 24" aria-hidden="true">${HATS[id].svg}</svg>`;
  const starRow = k => (k.chest || k.lchest) && save.skins.includes(k.id) ? `<span class="stars" title="Звёзды за повторы из сундуков">${'★'.repeat(starsOf(k))}${'☆'.repeat(3 - starsOf(k))}</span>` : '';
  const shineT = { value: 0 }, shineMats = {};
  // col: tinted glint for skins upgraded to 2 stars
  const shineMat = (leg, bolt, col) => shineMats[+leg + 2 * bolt + (col || '')] || (shineMats[+leg + 2 * bolt + (col || '')] = new THREE.ShaderMaterial({
    uniforms: { uT: shineT, uMode: { value: bolt ? 1 : 0 },
      uCol: { value: new THREE.Color(col || (bolt ? (leg ? '#fff6c8' : '#bff6ff') : (leg ? '#fff2b0' : '#ffffff'))) },
      uSpeed: { value: bolt ? (leg ? 1.3 : 1) : (leg ? .75 : .45) }, uPow: { value: bolt ? (leg ? 2.8 : 2.2) : (leg ? 2.2 : 1.6) } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying vec3 vN; void main(){ vN = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    // uMode 0 = soft stripe, 1 = jagged flickering lightning bolt
    fragmentShader: 'uniform float uT; uniform vec3 uCol; uniform float uSpeed; uniform float uPow; uniform float uMode; varying vec3 vN;' +
      'void main(){ float d = dot(vN, normalize(vec3(1., .25, .2))); float q = vN.y + vN.z * .5;' +
      ' float zig = (abs(fract(q * 2.5) - .5) - .25) * .45 * uMode; float p = mod(uT * uSpeed, 2.6) - 1.3; float w = mix(.2, .07, uMode);' +
      ' float b = pow(smoothstep(w, 0., abs(d + zig - p)), 1.5) * uPow;' +
      ' b *= mix(1., .4 + .6 * step(.3, fract(sin(floor(uT * 16.) * 12.9898) * 43758.5453)), uMode); gl_FragColor = vec4(uCol * b, b); }',
  }));
  const shineGeo = new THREE.SphereGeometry(1.025, 32, 24);
  // ---- 1.7.0 materials and living looks: mat = chrome | glass | jelly | crystal | rim | magma | matte; anim = breath | heartbeat | flicker | glitch | magma | dissolve | chameleon | twin ----
  const crystalGeo = new THREE.IcosahedronGeometry(1.04, 1);
  const bubbleGeo = new THREE.SphereGeometry(.08, 8, 6), bubbleMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .55, depthWrite: false });
  let envTex = null;
  // a soft silver studio for liquid metal («Хром»): white sky, cool greys, thin highlight strips — reads as polished silver, not a disco ball
  let silverTex = null;
  function silverEnv() {
    if (silverTex) return silverTex;
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const x = cv.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#ffffff'); g.addColorStop(.28, '#e9eef8'); g.addColorStop(.46, '#9aa3b8'); g.addColorStop(.52, '#3a4052'); g.addColorStop(.7, '#c7cfe0'); g.addColorStop(1, '#5d6478');
    x.fillStyle = g; x.fillRect(0, 0, 256, 128);
    x.globalAlpha = .85; for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#ffffff' : '#bfe9ff'; x.fillRect(i * 64 + 20, 18, 10, 46); } x.globalAlpha = 1;
    const t = new THREE.CanvasTexture(cv); t.mapping = THREE.EquirectangularReflectionMapping; t.encoding = THREE.sRGBEncoding;
    return (silverTex = t);
  }
  function neonEnv() {   // a small neon "room" reflected by chrome and crystal skins
    if (envTex) return envTex;
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const x = cv.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, '#ffffff'); g.addColorStop(.3, '#9b7bff'); g.addColorStop(.5, '#140a2e'); g.addColorStop(.62, '#ff4fd8'); g.addColorStop(1, '#05020f');
    x.fillStyle = g; x.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? '#22e6ff' : '#ffd23f'; x.fillRect(i * 32 + 6, 36, 5, 34); }
    // the plain equirect texture: every renderer (arena, menu blob, thumbnails, item window) prepares its own reflections from it.
    // A PMREM made by the arena renderer cannot be used by the others — metal skins rendered black outside the round.
    const t = new THREE.CanvasTexture(cv); t.mapping = THREE.EquirectangularReflectionMapping; t.encoding = THREE.sRGBEncoding;
    envTex = t;
    return envTex;
  }
  const rimMat = col => new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color(col) }, uK: { value: 1 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: 'varying float vF; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.); vec3 n = normalize(normalMatrix * normal); vF = pow(1. - abs(dot(n, normalize(-mv.xyz))), 2.2); gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uCol; uniform float uK; varying float vF; void main(){ gl_FragColor = vec4(uCol * vF * 1.7 * uK, vF * uK); }' });
  function applyLook(vis, s) {
    const m = vis.mesh.material;
    if (vis.extra) { vis.mesh.remove(vis.extra); vis.extra = null; }
    vis.mesh.geometry = s.mat === 'crystal' ? crystalGeo : sphereGeo;
    m.metalness = .1; m.roughness = .22; m.opacity = .9; m.envMap = null; m.flatShading = false; m.depthWrite = true;
    if (s.emi) { m.emissiveMap = skinEmi(s); m.emissive.set(s.emiColor || '#ffffff'); }
    const ex = new THREE.Group(); vis.extra = ex; vis.mesh.add(ex);
    switch (s.mat) {
      case 'chrome': m.metalness = 1; m.roughness = .13; m.envMap = neonEnv(); m.emissiveIntensity = .1; break;
      case 'glass': m.opacity = .55; m.roughness = .04; m.emissiveIntensity = .62; ex.add(glowSprite(s.accent || s.color, 1.7, .75)); break;
      case 'jelly': { m.opacity = .72; m.roughness = .08; const sh = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: s.accent || '#ffffff', transparent: true, opacity: .16, depthWrite: false })); sh.scale.setScalar(1.06); sh.userData.wobble = 1; ex.add(sh); break; }
      case 'crystal': m.flatShading = true; m.metalness = .35; m.roughness = .05; m.opacity = .88; m.envMap = neonEnv(); break;
      case 'rim': { m.emissiveIntensity = .12; const sh = new THREE.Mesh(sphereGeo, rimMat(s.accent || s.color)); sh.scale.setScalar(1.035); sh.userData.rim = 1; ex.add(sh); break; }
      case 'magma': m.roughness = .75; break;
      case 'gold': m.metalness = .9; m.roughness = .22; m.envMap = neonEnv(); m.emissiveIntensity = .22; break;
      case 'liquid': { m.metalness = 1; m.roughness = .08; m.envMap = silverEnv(); m.emissiveIntensity = .04; const sh = new THREE.Mesh(sphereGeo, new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 1, roughness: .05, envMap: silverEnv(), transparent: true, opacity: .35 })); sh.scale.setScalar(1.03); sh.userData.wobble = 1; ex.add(sh); break; }
      case 'pearl': { m.metalness = .25; m.roughness = .12; m.envMap = neonEnv(); m.emissiveIntensity = .3; const sh = new THREE.Mesh(sphereGeo, rimMat('#ff9ef2')); sh.scale.setScalar(1.03); sh.userData.pearl = 1; ex.add(sh); break; }
      case 'matte': m.roughness = .65; m.emissiveIntensity = .3; break;
      case 'skeleton': {   // see-through amber case, brass gears turning inside
        m.opacity = .32; m.roughness = .05; m.emissiveIntensity = .18; m.depthWrite = false;
        const gm = new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#b06a1a', emissiveIntensity: .7, metalness: .6, roughness: .3 });
        [[-.28, .1, .1, .5, 14, 1], [.34, .3, -.05, .34, 10, -1.6], [.22, -.36, .15, .26, 8, 2], [-.1, .45, -.2, .2, 7, -2.4]].forEach(([gx, gy, gz, r, n, sp]) => { const ge = new THREE.Mesh(gearGeo(r, n, .08), gm); ge.position.set(gx, gy, gz); ge.rotation.x = -.9; ge.userData.gear = sp; ex.add(ge); });
        break; }
      case 'sandglass': {   // clear glass; golden sand rises and piles up under the top
        m.opacity = .4; m.roughness = .03; m.emissiveIntensity = .35; m.depthWrite = false; ex.add(glowSprite('#bff8ff', 1.8, .5));
        const sm = new THREE.MeshBasicMaterial({ color: '#ffd27a' });
        for (let i = 0; i < 16; i++) { const b = new THREE.Mesh(bubbleGeo, sm); b.scale.setScalar(.45); b.userData.sand = i / 16; b.userData.bx = Math.sin(i * 2.4) * .45; b.userData.bz = Math.cos(i * 2.4) * .45; ex.add(b); }
        const pile = new THREE.Mesh(new THREE.SphereGeometry(.62, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffd27a', transparent: true, opacity: .9 })); pile.rotation.x = Math.PI; pile.position.y = .88; pile.userData.pile = 1; ex.add(pile);
        break; }
    }
    if (s.bubbles) for (let i = 0; i < 7; i++) { const b = new THREE.Mesh(bubbleGeo, bubbleMat); b.userData.bub = i / 7; b.userData.bx = Math.sin(i * 2.4) * .55; b.userData.bz = Math.cos(i * 2.4) * .55; ex.add(b); }
    if (s.anim === 'twin') { const tw = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: s.accent || '#ffffff', transparent: true, opacity: .3, depthWrite: false })); tw.userData.twin = 1; ex.add(tw); }
    m.needsUpdate = true;
  }
  function animateLook(v, now, c) {
    const lk = v.look; if (!lk) return;
    const m = v.mesh.material, t = now / 1000;
    if (lk.live) { liveTick(lk, now); if (lk.live === 'moon') { const f = liveState[lk.id] || 0; m.emissiveIntensity = .75 + 1.1 * f; v.glow.material.color.set(f > .05 ? '#e8ecff' : lk.color); } }
    if (lk.flow && lk.pattern) { const tx = skinTex(lk); tx.offset.set((t * lk.flow[0]) % 1, (t * lk.flow[1]) % 1); if (lk.emi) skinEmi(lk).offset.copy(tx.offset); }
    switch (lk.anim) {
      case 'breath': m.emissiveIntensity = .38 + .16 * Math.sin(t * 1.6); break;
      case 'heartbeat': { const p = (t * 1.15) % 1, k = Math.exp(-p * 16) + (p > .2 ? .6 * Math.exp(-(p - .2) * 16) : 0); m.emissiveIntensity = .35 + .9 * k; v.glow.material.opacity = .5 + .5 * k; break; }
      case 'flicker': m.emissiveIntensity = Math.random() < .04 ? .15 : .75; break;
      case 'glitch': if (Math.random() < .07) { skinTex(lk).offset.x = Math.random(); m.emissiveIntensity = 1.3; } else m.emissiveIntensity = .6; break;
      case 'magma': m.emissiveIntensity = .9 + .55 * Math.sin(t * 2.2 + (c ? c.x * .1 : 0)); break;
      case 'dissolve': m.opacity = .68 + .22 * Math.sin(t * 2.6); m.emissiveIntensity = .6 + .3 * Math.sin(t * 5.2); break;
      case 'chameleon': {
        let sp = .5 + .5 * Math.sin(t * .8);
        if (c) { const d = Math.hypot(c.x - (v._px ?? c.x), c.z - (v._pz ?? c.z)); v._px = c.x; v._pz = c.z; v._sp = (v._sp ?? 0) * .92 + Math.min(1, Math.max(0, d * 1.6 - .5)) * .08; sp = v._sp; }
        const h = .36 - .36 * sp; m.color.setHSL(h, 1, .55); m.emissive.setHSL(h, 1, .42); v.glow.material.color.setHSL(h, 1, .55); break; }
    }
    if (v.extra) v.extra.children.forEach(o => { const u = o.userData;
      if (u.wobble) o.scale.set(1.06 + Math.sin(t * 5) * .035, 1.06 + Math.sin(t * 5 + 1.6) * .045, 1.06 + Math.sin(t * 4 + .7) * .035);
      else if (u.gear) o.rotation.z = t * u.gear;
      else if (u.sand !== undefined) { const p = (u.sand + t * .3) % 1; o.position.set(u.bx * (1 - p * .6), -.8 + p * 1.55, u.bz * (1 - p * .6)); o.visible = p < .97; }
      else if (u.pile) { const p = (t / 9) % 1; o.scale.set(.4 + p * .6, .1 + p * .5, .4 + p * .6); }
      else if (u.bub !== undefined) { const p = (u.bub + t * .22) % 1; o.position.set(u.bx * (1 - p * .5), -.75 + p * 1.5, u.bz * (1 - p * .5)); o.scale.setScalar(.5 + p * .8); }
      else if (u.twin) { o.position.set(Math.sin(t * 13) * .14, Math.sin(t * 7) * .05, Math.cos(t * 9) * .14); o.visible = Math.random() > .35; }
      else if (u.pearl) { o.material.uniforms.uCol.value.setHSL((t * .08) % 1, .9, .7); o.material.uniforms.uK.value = .9; }
      else if (u.rim) o.material.uniforms.uK.value = lk.anim === 'flicker' ? (Math.random() < .05 ? .25 : 1) : .85 + .15 * Math.sin(t * 3); });
  }
  function applySkin(vis, s = skin(), stars = starsOf(s), hat = save.hat) {
    const m = vis.mesh.material;
    vis.stars = stars; vis.hatOn = !!hat;
    m.map = skinTex(s);
    m.emissiveMap = skinTex(s);
    m.color.set(s.pattern ? '#ffffff' : s.color);
    m.emissive.set(s.pattern ? '#ffffff' : s.color);
    m.emissiveIntensity = s.glow ? .75 : .42;
    vis.glow.material.color.set(s.color);
    vis.glow.material.opacity = s.glow ? 1 : .85;
    m.needsUpdate = true;
    vis.look = s;
    vis.crown.visible = !!s.crown && !hat;
    if (isShiny(s) || stars >= 2) {
      const mat = shineMat((s.chest || s.lchest || s.craft) === 'legendary' || !!s.legend, s.shine === 'bolt', !isShiny(s) ? '#' + new THREE.Color(s.accent || s.color).lerp(new THREE.Color('#ffffff'), .35).getHexString() : null);
      if (!vis.shine) { vis.shine = new THREE.Mesh(shineGeo, mat); vis.mesh.add(vis.shine); }
      vis.shine.material = mat; vis.shine.visible = true;
    } else if (vis.shine) vis.shine.visible = false;
    if (vis.head) { vis.mesh.remove(vis.head); vis.head = null; }
    if (hat || s.head) { vis.head = buildHead(hat || s.head); vis.mesh.add(vis.head); }
    // 3 stars: a soft pulsing halo in the skin colour
    if (stars >= 3) { if (!vis.starGlow) { vis.starGlow = glowSprite('#ffffff', 4.6, .5); vis.mesh.add(vis.starGlow); } vis.starGlow.material.color.set(s.accent || s.color); vis.starGlow.visible = true; }
    else if (vis.starGlow) vis.starGlow.visible = false;
    applyLook(vis, s);
    vis.ring.material.color.set(0xffffff);
  }
  // items above the head for epic and legendary skins (the crown stays for the others)
  function buildHead(type) {
    const g = new THREE.Group(); g.userData.type = type;
    // the camera looks from above, so shift items back (they read as "above the head" on screen) and enlarge them
    if (!['wings', 'helm', 'ring', 'shards', 'swarm', 'portal', 'cuphandles', 'fragments', 'warhelm', 'windkey'].includes(type)) { g.position.set(0, -.1, -.75); g.scale.setScalar(1.3); }
    if (type === 'helm') { g.position.set(0, .05, -.1); g.scale.setScalar(1.15); }
    const M = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); g.add(o); return o; };
    const basic = c => new THREE.MeshBasicMaterial({ color: c });
    switch (type) {
      case 'flame': ['#ff3d00', '#ff9a3d', '#ffd23f'].forEach((c, i) => { const sz = 1.15 - i * .25; const sp = glowSprite(c, sz, 1); sp.position.set(0, 1.15 + i * .2, 0); sp.userData.base = sz; g.add(sp); }); break;
      case 'antenna': [-1, 1].forEach(sx => { const st = M(new THREE.CylinderGeometry(.025, .03, .6, 6), basic('#3dffa2'), sx * .28, 1.15, 0); st.rotation.z = -sx * .35;
        const tip = M(new THREE.SphereGeometry(.09, 10, 8), basic('#b9ff3d'), sx * .4, 1.45, 0); tip.userData.tip = sx; tip.add(glowSprite('#3dffa2', .7, 1)); }); break;
      case 'halo': { const t = M(new THREE.TorusGeometry(.5, .05, 8, 40), basic('#ffd23f'), 0, 1.42, 0); t.rotation.x = Math.PI / 2; t.add(glowSprite('#ffd23f', 2, .5)); break; }
      case 'gem': { const gm = M(new THREE.OctahedronGeometry(.27), new THREE.MeshStandardMaterial({ color: '#b26bff', emissive: '#b26bff', emissiveIntensity: .8, metalness: .3, roughness: .15 }), 0, 1.5, 0); gm.add(glowSprite('#e8fbff', 1.2, .6)); break; }
      case 'star': { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ICONS.star, color: '#ffd23f', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sp.scale.setScalar(.85); sp.position.y = 1.5; g.add(sp); break; }
      case 'horns': [-1, 1].forEach(sx => { const h = M(new THREE.ConeGeometry(.12, .5, 12), new THREE.MeshStandardMaterial({ color: '#ff3d6e', emissive: '#7b0020', emissiveIntensity: .7, roughness: .3 }), sx * .38, 1.0, .1); h.rotation.z = -sx * .45; }); break;
      case 'wings': [-1, 1].forEach(sx => { const w = M(new THREE.SphereGeometry(.6, 16, 10), new THREE.MeshBasicMaterial({ color: '#ffffff' }), sx * 1.05, .5, -.55);
        w.scale.set(1, .42, .14); w.rotation.z = sx * .5; w.userData.wing = sx; w.add(glowSprite('#ffb8f0', 2.2, .8)); }); break;
      case 'cherry': { [-1, 1].forEach(sx => { const b = M(new THREE.SphereGeometry(.17, 14, 10), new THREE.MeshStandardMaterial({ color: '#ff2d55', emissive: '#a0001a', emissiveIntensity: .6, roughness: .25 }), sx * .17, 1.12, 0); b.add(glowSprite('#ff2d55', .8, .4)); const st = M(new THREE.CylinderGeometry(.02, .02, .4, 5), basic('#3dffa2'), sx * .09, 1.38, 0); st.rotation.z = sx * .4; }); break; }
      case 'planet': { const pl = M(new THREE.SphereGeometry(.22, 16, 12), new THREE.MeshStandardMaterial({ color: '#b26bff', emissive: '#5a1fb0', emissiveIntensity: .7 }), 0, 1.45, 0); const ring = new THREE.Mesh(new THREE.TorusGeometry(.38, .03, 6, 40), basic('#ffd23f')); ring.rotation.x = 1.2; pl.add(ring); pl.add(glowSprite('#b26bff', 1.2, .5)); break; }
      case 'snowflake': { const f = new THREE.Group(); f.position.y = 1.45; for (let i = 0; i < 3; i++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(.06, .6, .06), basic('#cfefff')); bar.rotation.z = i * Math.PI / 3; f.add(bar); } f.add(glowSprite('#9fe8ff', 1.3, .6)); g.add(f); break; }
      case 'windkey': {   // 2.3: a wind-up key sticking out of the back, turns while the drop moves
        const km = new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#b06a1a', emissiveIntensity: .55, metalness: .7, roughness: .25 });
        const k = new THREE.Group(); k.position.set(0, .25, -1.02); k.userData.key = 1; g.add(k);
        const sh = new THREE.Mesh(new THREE.CylinderGeometry(.06, .06, .45, 8), km); sh.rotation.x = Math.PI / 2; sh.position.z = -.12; k.add(sh);
        [-1, 1].forEach(sx => { const loop = new THREE.Mesh(new THREE.TorusGeometry(.16, .05, 8, 18), km); loop.position.set(sx * .2, 0, -.38); loop.rotation.y = Math.PI / 2; k.add(loop); });
        break; }
      case 'propeller': { M(new THREE.SphereGeometry(.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ff4fd8', emissive: '#7b0060', emissiveIntensity: .6 }), 0, .95, 0); M(new THREE.CylinderGeometry(.025, .025, .25, 6), basic('#ffd23f'), 0, 1.3, 0); const bl = M(new THREE.BoxGeometry(.9, .02, .12), basic('#22e6ff'), 0, 1.43, 0); bl.userData.spin = 1; break; }
      case 'tophat': { const mat = new THREE.MeshStandardMaterial({ color: '#1a1033', emissive: '#2a1060', emissiveIntensity: .5, roughness: .4 }); M(new THREE.CylinderGeometry(.48, .48, .05, 24), mat, 0, 1, 0); M(new THREE.CylinderGeometry(.3, .3, .5, 24), mat, 0, 1.26, 0); M(new THREE.CylinderGeometry(.305, .305, .09, 24), basic('#ff4fd8'), 0, 1.08, 0); break; }
      case 'moons': { const core = M(new THREE.SphereGeometry(.12, 12, 8), basic('#ff2d55'), 0, 1.45, 0); core.add(glowSprite('#ff2d55', 1, .7));
        for (let i = 0; i < 3; i++) { const mo = M(new THREE.SphereGeometry(.13, 12, 8), new THREE.MeshStandardMaterial({ color: '#3a2a5a', emissive: '#ff2d55', emissiveIntensity: .35 }), 0, 1.45, 0); mo.userData.orb = i * 2.09; } break; }
      case 'coins': for (let i = 0; i < 4; i++) { const cn = M(new THREE.CylinderGeometry(.24, .24, .06, 20), new THREE.MeshStandardMaterial({ color: '#ffd23f', emissive: '#b07a00', emissiveIntensity: .6, metalness: .5, roughness: .25 }), (i % 2) * .04, 1.05 + i * .08, 0); cn.userData.coin = i; } break;
      case 'nova': { const n = new THREE.Group(); n.position.y = 1.5; for (let i = 0; i < 8; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(.06, .42, 6), basic(i % 2 ? '#ff4fd8' : '#ffffff')); sp.rotation.z = i / 8 * Math.PI * 2; sp.position.set(-Math.sin(sp.rotation.z) * .22, Math.cos(sp.rotation.z) * .22, 0); n.add(sp); }
        n.add(glowSprite('#ff4fd8', 1.6, .8)); n.userData.nova = 1; g.add(n); break; }
      case 'laurel': [-1, 1].forEach(sx => { for (let i = 0; i < 5; i++) { const a = .3 + i * .28, lf = M(new THREE.SphereGeometry(.09, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffd23f', emissive: '#b07a00', emissiveIntensity: .7, metalness: .4 }), sx * Math.sin(a) * .45, 1.0 + Math.cos(a) * .3, 0); lf.scale.set(.6, 1.4, .6); lf.rotation.z = -sx * a; } }); break;
      case 'prism': { const pr = M(new THREE.TetrahedronGeometry(.3), new THREE.MeshStandardMaterial({ color: '#22e6ff', emissive: '#ff4fd8', emissiveIntensity: .5, roughness: .1, metalness: .3, transparent: true, opacity: .9 }), 0, 1.5, 0); pr.userData.prism = 1; pr.add(glowSprite('#22e6ff', 1.3, .6)); break; }
      case 'helm': { const mat = new THREE.MeshStandardMaterial({ color: '#3a2a5a', emissive: '#1a0a30', emissiveIntensity: .6, metalness: .5, roughness: .3 });
        M(new THREE.SphereGeometry(.55, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat, 0, .78, 0); M(new THREE.TorusGeometry(.55, .05, 6, 30), basic('#ff2d55'), 0, .8, 0).rotation.x = Math.PI / 2;
        const crest = M(new THREE.BoxGeometry(.08, .32, .6), basic('#ff2d55'), 0, 1.38, 0); crest.add(glowSprite('#ff2d55', 1, .5)); break; }
      case 'banner': { M(new THREE.CylinderGeometry(.03, .03, 1.1, 6), basic('#ffd23f'), -.3, 1.45, 0);
        const fl = M(new THREE.PlaneGeometry(.6, .38, 6, 1), new THREE.MeshBasicMaterial({ color: '#ff2d55', side: THREE.DoubleSide }), 0, 1.78, 0); fl.userData.flag = 1; fl.add(glowSprite('#ff2d55', 1.2, .35)); break; }
      case 'crystals': [['#9fe8ff', 0], ['#b26bff', 2.1], ['#e8fbff', 4.2]].forEach(([c, a]) => { const cr = M(new THREE.OctahedronGeometry(.16), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .8, roughness: .1 }), 0, 1.45, 0); cr.scale.y = 1.6; cr.userData.orb = a; cr.add(glowSprite(c, .7, .5)); }); break;
      case 'cup': { const gold = new THREE.MeshStandardMaterial({ color: '#ffd23f', emissive: '#b07a00', emissiveIntensity: .7, metalness: .6, roughness: .25 });
        M(new THREE.CylinderGeometry(.3, .12, .38, 20, 1, true), gold, 0, 1.42, 0); M(new THREE.CylinderGeometry(.04, .04, .16, 8), gold, 0, 1.16, 0); M(new THREE.CylinderGeometry(.18, .2, .07, 16), gold, 0, 1.05, 0);
        [-1, 1].forEach(sx => { const h = M(new THREE.TorusGeometry(.1, .025, 6, 16), gold, sx * .32, 1.45, 0); h.rotation.y = Math.PI / 2; });
        const cg = new THREE.Group(); cg.position.y = 1.42; cg.add(glowSprite('#ffd23f', 1.2, .5)); g.add(cg); break; }
      // ---- 1.7.0 details ----
      case 'ring': { const rg = M(new THREE.TorusGeometry(1.55, .07, 8, 64), new THREE.MeshStandardMaterial({ color: '#f4d29a', emissive: '#8a5a2b', emissiveIntensity: .6, roughness: .4 }), 0, 0, 0); rg.rotation.x = Math.PI / 2 - .35; rg.scale.z = .2;
        const rg2 = M(new THREE.TorusGeometry(1.8, .035, 6, 64), basic('#c9a06a'), 0, 0, 0); rg2.rotation.x = Math.PI / 2 - .35; g.userData.spin = 1; break; }
      case 'cap': { const cap = M(new THREE.SphereGeometry(.62, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ff2d4d', emissive: '#7a0012', emissiveIntensity: .6, roughness: .5 }), 0, .95, 0); cap.scale.y = .62;
        for (let i = 0; i < 7; i++) { const a = i * 2.4, rr = i ? .38 : 0; M(new THREE.SphereGeometry(.07, 8, 6), basic('#ffffff'), Math.cos(a) * rr, 1.27 - rr * .35, Math.sin(a) * rr); } break; }
      case 'icecrown': for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, h = i % 2 ? .38 : .6; const ic = M(new THREE.ConeGeometry(.07, h, 6), new THREE.MeshStandardMaterial({ color: '#e8fbff', emissive: '#9fe8ff', emissiveIntensity: .8, roughness: .05, transparent: true, opacity: .9 }), Math.cos(a) * .42, 1.05 + h / 2, Math.sin(a) * .42); ic.userData.ice = i; } g.add(glowSprite('#9fe8ff', 1.6, .45)); break;
      case 'gradcap': { const mat = new THREE.MeshStandardMaterial({ color: '#1a1033', emissive: '#2a1060', emissiveIntensity: .5 }); M(new THREE.CylinderGeometry(.3, .32, .2, 16), mat, 0, 1.02, 0); const b = M(new THREE.BoxGeometry(.85, .05, .85), mat, 0, 1.14, 0); b.rotation.y = Math.PI / 4;
        const ts = M(new THREE.CylinderGeometry(.015, .015, .32, 4), basic('#ffd23f'), .32, 1.0, .2); ts.userData.tassel = 1; M(new THREE.SphereGeometry(.05, 8, 6), basic('#ffd23f'), 0, 1.18, 0); break; }
      case 'shards': for (let i = 0; i < 6; i++) { const cr = M(new THREE.OctahedronGeometry(.18), new THREE.MeshStandardMaterial({ color: i % 2 ? '#b26bff' : '#9fe8ff', emissive: i % 2 ? '#7b3dff' : '#22e6ff', emissiveIntensity: .8, roughness: .05, flatShading: true }), 0, 0, 0); cr.scale.y = 1.8; cr.userData.orb = i / 6 * Math.PI * 2; } break;
      case 'swarm': for (let i = 0; i < 8; i++) { const mn = M(new THREE.SphereGeometry(.12, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffd23f', emissive: '#ff9a3d', emissiveIntensity: .7 }), 0, 0, 0); mn.userData.orb = i / 8 * Math.PI * 2; mn.userData.r = 1.4 + (i % 3) * .2; } break;
      case 'portal': { const p1 = M(new THREE.TorusGeometry(1.35, .06, 8, 60), basic('#22e6ff'), 0, 0, 0); p1.add(glowSprite('#22e6ff', 3.2, .35)); const p2 = M(new THREE.TorusGeometry(1.5, .03, 6, 60), basic('#ff4fd8'), 0, 0, 0); p1.userData.port = 1; p2.userData.port = -1; break; }
      case 'stem': { const st = M(new THREE.CylinderGeometry(.08, .12, .32, 7), new THREE.MeshStandardMaterial({ color: '#3a7a1a', emissive: '#1a4a0a', emissiveIntensity: .5 }), 0, 1.08, 0); st.rotation.z = .25;
        const lf = M(new THREE.SphereGeometry(.2, 10, 6), new THREE.MeshStandardMaterial({ color: '#3dff6e', emissive: '#0b5e36', emissiveIntensity: .6 }), .22, 1.15, 0); lf.scale.set(1.3, .25, .7); lf.userData.leaf = 1;
        const fire = glowSprite('#ff9a3d', 1.6, .8); fire.position.y = .1; fire.userData.base = 1.6; fire.userData.flick = 1; g.add(fire); break; }
      case 'cuphandles': { const gold = new THREE.MeshStandardMaterial({ color: '#ffd23f', emissive: '#b07a00', emissiveIntensity: .6, metalness: .8, roughness: .2 });
        [-1, 1].forEach(sx => { const hd = M(new THREE.TorusGeometry(.42, .07, 8, 24, Math.PI * 1.3), gold, sx * 1.02, .15, 0); hd.rotation.set(0, sx > 0 ? 0 : Math.PI, -Math.PI * .65); });
        const st = M(new THREE.SphereGeometry(.08, 8, 6), basic('#ffffff'), .5, 1.0, .5); st.add(glowSprite('#fff6a0', .9, 1)); st.userData.twinkle = 1; break; }
      case 'crest': { const sh = new THREE.Shape(); sh.moveTo(0, .32); sh.lineTo(.26, .24); sh.lineTo(.24, -.06); sh.quadraticCurveTo(.18, -.26, 0, -.36); sh.quadraticCurveTo(-.18, -.26, -.24, -.06); sh.lineTo(-.26, .24); sh.lineTo(0, .32);
        const geo = new THREE.ExtrudeGeometry(sh, { depth: .06, bevelEnabled: true, bevelSize: .025, bevelThickness: .02, bevelSegments: 2 });
        const c = M(geo, new THREE.MeshStandardMaterial({ color: '#4d7cff', emissive: '#1a3a9e', emissiveIntensity: .6, metalness: .5, roughness: .3 }), 0, 1.5, 0);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(.33, .02, 6, 30), basic('#e8ecff')); rim.position.z = .07; c.add(rim); c.add(glowSprite('#9fd8ff', 1.2, .5)); c.userData.crest = 1; break; }
      case 'starcrown': for (let i = 0; i < 7; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: ICONS.star, color: i % 2 ? '#ffffff' : '#ffd23f', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); sp.scale.setScalar(.36); sp.userData.orb = i / 7 * Math.PI * 2; g.add(sp); } { const h = M(new THREE.TorusGeometry(.5, .03, 6, 40), basic('#fff6c8'), 0, 1.4, 0); h.rotation.x = Math.PI / 2; h.add(glowSprite('#ffd23f', 1.8, .5)); } break;
      case 'lemon': { const sl = M(new THREE.CylinderGeometry(.32, .32, .07, 20), new THREE.MeshStandardMaterial({ color: '#fff35a', emissive: '#c9b000', emissiveIntensity: .5 }), .2, 1.12, 0); sl.rotation.z = Math.PI / 2 - .3;
        for (let i = 0; i < 6; i++) { const seg = new THREE.Mesh(new THREE.BoxGeometry(.02, .5, .02), basic('#ffffff')); seg.rotation.y = i * Math.PI / 6; seg.rotation.x = Math.PI / 2; sl.add(seg); }
        const straw = M(new THREE.CylinderGeometry(.04, .04, .9, 8), basic('#ff4fd8'), -.18, 1.3, 0); straw.rotation.z = .35; M(new THREE.CylinderGeometry(.04, .04, .25, 8), basic('#ffffff'), -.36, 1.78, 0).rotation.z = 1.4; break; }
      case 'warhelm': { const iron = new THREE.MeshStandardMaterial({ color: '#2a2a32', emissive: '#100808', emissiveIntensity: .4, metalness: .8, roughness: .45 });
        M(new THREE.SphereGeometry(.62, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), iron, 0, .72, 0); M(new THREE.TorusGeometry(.62, .05, 6, 30), basic('#ff2d2d'), 0, .74, 0).rotation.x = Math.PI / 2;
        [-1, 1].forEach(sx => { const h = M(new THREE.ConeGeometry(.13, .7, 10), new THREE.MeshStandardMaterial({ color: '#e8dcc0', emissive: '#3a2a10', emissiveIntensity: .4 }), sx * .62, 1.15, 0); h.rotation.z = -sx * .9; });
        const vis = M(new THREE.BoxGeometry(.5, .05, .1), basic('#ff2d2d'), 0, .88, .58); vis.add(glowSprite('#ff2d2d', .9, .8)); break; }
      case 'coincrown': for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, cn = M(new THREE.CylinderGeometry(.13, .13, .03, 16), new THREE.MeshStandardMaterial({ color: '#ffd23f', emissive: '#b07a00', emissiveIntensity: .6, metalness: .7, roughness: .2 }), Math.cos(a) * .45, 1.25, Math.sin(a) * .45); cn.rotation.set(Math.PI / 2, 0, -a); cn.userData.coin = i; } g.add(glowSprite('#ffd23f', 1.6, .4)); break;
      case 'fragments': for (let i = 0; i < 10; i++) { const fr = M(new THREE.TetrahedronGeometry(.13 + (i % 3) * .04), new THREE.MeshStandardMaterial({ color: i % 2 ? '#ff2dd8' : '#ff9a3d', emissive: i % 2 ? '#ff2dd8' : '#ff9a3d', emissiveIntensity: .8, flatShading: true }), 0, 0, 0); fr.userData.orb = i / 10 * Math.PI * 2; fr.userData.r = 1.3 + (i % 3) * .2; } break;
      case 'sprout': { M(new THREE.CylinderGeometry(.03, .04, .4, 6), basic('#3dffa2'), 0, 1.15, 0); [-1, 1].forEach(sx => { const lf = M(new THREE.SphereGeometry(.2, 12, 8), new THREE.MeshStandardMaterial({ color: '#3dffa2', emissive: '#0b6e3e', emissiveIntensity: .7 }), sx * .2, 1.38 + (sx > 0 ? .05 : 0), 0); lf.scale.set(1, .35, .6); lf.rotation.z = sx * .5; lf.userData.leaf = sx; }); break; }
    }
    return g;
  }
  function animateHead(v, now) {
    const g = v.head; if (!g) return;
    const t = now / 1000;
    switch (g.userData.type) {
      case 'flame': g.children.forEach((o, i) => { o.scale.setScalar(o.userData.base * (.85 + Math.random() * .3)); o.position.y = 1.15 + i * .2 + Math.sin(t * 9 + i) * .03; }); break;
      case 'antenna': g.children.forEach(o => { if (o.userData.tip) o.position.y = 1.45 + Math.sin(t * 5 + o.userData.tip) * .04; }); break;
      case 'halo': g.children[0].position.y = 1.42 + Math.sin(t * 2) * .06; break;
      case 'gem': g.children[0].rotation.y = t * 1.6; g.children[0].position.y = 1.5 + Math.sin(t * 2.4) * .08; break;
      case 'star': g.children[0].material.rotation = t * .8; g.children[0].position.y = 1.5 + Math.sin(t * 2) * .07; break;
      case 'wings': g.children.forEach(o => { if (o.userData.wing) o.rotation.z = o.userData.wing * (.5 + Math.sin(t * 7) * .25); }); break;
      case 'planet': g.children[0].rotation.y = t * 1.2; g.children[0].position.y = 1.45 + Math.sin(t * 2) * .06; break;
      case 'snowflake': g.children[0].rotation.y = t; g.children[0].rotation.z = t * .5; break;
      case 'propeller': g.children.forEach(o => { if (o.userData.spin) o.rotation.y = t * 14; }); break;
      case 'windkey': { const k = g.children[0], p = v.mesh.position, u = g.userData, d = u.px === undefined ? 0 : Math.hypot(p.x - u.px, p.z - u.pz); u.px = p.x; u.pz = p.z; u.sp = (u.sp || 0) * .9 + Math.min(1, d * 3) * .1; u.a = (u.a || 0) + .03 + u.sp * .5; k.rotation.z = u.a; break; }
      case 'moons': g.children.forEach(o => { if (o.userData.orb !== undefined) { const a = o.userData.orb + t * 1.8; o.position.set(Math.cos(a) * .45, 1.45 + Math.sin(a * 2) * .06, Math.sin(a) * .45); } }); break;
      case 'coins': g.children.forEach(o => { o.rotation.y = t * (1 + o.userData.coin * .3); }); g.position.y = -.1 + Math.sin(t * 2) * .03; break;
      case 'nova': g.children[0].rotation.z = t * 1.5; g.children[0].scale.setScalar(1 + Math.sin(t * 4) * .08); break;
      case 'laurel': g.rotation.y = Math.sin(t * 1.2) * .25; break;
      case 'prism': g.children[0].rotation.set(t * .9, t * 1.4, 0); g.children[0].position.y = 1.5 + Math.sin(t * 2.2) * .07; break;
      case 'banner': g.children.forEach(o => { if (o.userData.flag) { o.rotation.y = Math.sin(t * 4) * .35; o.scale.x = 1 + Math.sin(t * 6) * .05; } }); break;
      case 'crystals': g.children.forEach(o => { const a = o.userData.orb + t * 1.4; o.position.set(Math.cos(a) * .32, 1.45 + Math.sin(t * 2 + o.userData.orb) * .08, Math.sin(a) * .32); o.rotation.y = t * 2; }); break;
      case 'ring': g.rotation.y = t * .35; break;
      case 'cap': g.children[0].rotation.y = t * .3; g.position.y = -.1 + Math.sin(t * 2.4) * .03; break;
      case 'icecrown': g.children.forEach(o => { if (o.userData.ice !== undefined) o.material.emissiveIntensity = .6 + .4 * Math.sin(t * 4 + o.userData.ice); }); break;
      case 'gradcap': g.children.forEach(o => { if (o.userData.tassel) o.rotation.z = Math.sin(t * 3) * .4; }); break;
      case 'shards': g.children.forEach(o => { const a = o.userData.orb + t * 1.1; o.position.set(Math.cos(a) * 1.45, Math.sin(a * 2) * .3, Math.sin(a) * 1.45); o.rotation.y = t * 2; }); break;
      case 'swarm': g.children.forEach((o, i) => { const a = o.userData.orb + t * (1.4 + (i % 3) * .3); o.position.set(Math.cos(a) * o.userData.r, .3 + Math.sin(t * 3 + i) * .25, Math.sin(a) * o.userData.r); }); break;
      case 'portal': g.children.forEach(o => { if (o.userData.port) { o.rotation.y = t * o.userData.port * .9; o.rotation.x = Math.sin(t * .7) * .4; } }); break;
      case 'stem': g.children.forEach(o => { if (o.userData.flick) o.scale.setScalar(o.userData.base * (.8 + Math.random() * .3)); if (o.userData.leaf) o.rotation.z = Math.sin(t * 2) * .2; }); break;
      case 'cuphandles': g.children.forEach(o => { if (o.userData.twinkle) { o.position.set(Math.sin(t * 1.3) * .7, 1 + Math.sin(t * 2.1) * .2, .55); o.scale.setScalar(.6 + .5 * Math.abs(Math.sin(t * 4))); } }); break;
      case 'crest': g.children[0].rotation.y = Math.sin(t * 1.2) * .5; g.children[0].position.y = 1.5 + Math.sin(t * 2) * .05; break;
      case 'starcrown': g.children.forEach(o => { if (o.userData.orb !== undefined) { const a = o.userData.orb + t * .9; o.position.set(Math.cos(a) * .5, 1.42 + Math.sin(t * 3 + o.userData.orb) * .05, Math.sin(a) * .5); o.material.rotation = t; } }); break;
      case 'coincrown': g.children.forEach(o => { if (o.userData.coin !== undefined) o.position.y = 1.25 + Math.sin(t * 3 + o.userData.coin) * .05; }); g.rotation.y = t * .6; break;
      case 'fragments': g.children.forEach((o, i) => { const a = o.userData.orb + t * (.8 + (i % 3) * .3), k = .5 + .5 * Math.sin(t * 1.5 + i); o.position.set(Math.cos(a) * o.userData.r * (1 + k * .4), Math.sin(t * 2 + i) * .4, Math.sin(a) * o.userData.r * (1 + k * .4)); o.rotation.set(t * 2, t * 3, 0); o.scale.setScalar(.6 + (1 - k) * .6); }); break;
      case 'sprout': g.children.forEach(o => { if (o.userData.leaf) o.rotation.z = o.userData.leaf * (.5 + Math.sin(t * 2.5) * .12); }); break;
    }
  }

  // ================= particles =================
  const PMAX = 1400;
  const pPos = new Float32Array(PMAX * 3), pCol = new Float32Array(PMAX * 3);
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(pCol, 3));
  const pMat = new THREE.PointsMaterial({ size: 1, map: dotTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const particles = new THREE.Points(pGeo, pMat); particles.frustumCulled = false; scene.add(particles);
  const pData = Array.from({ length: PMAX }, () => ({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, r: 0, g: 0, b: 0 }));
  const pAlive = new Uint8Array(PMAX), pActive = [];
  let pNext = 0;
  // eat effects get their own particles — 2.6× bigger, so a purchased effect reads on screen (also on «low» quality, with fewer of them)
  const EMAX = 900, ePos = new Float32Array(EMAX * 3), eCol = new Float32Array(EMAX * 3), eGeo = new THREE.BufferGeometry();
  eGeo.setAttribute('position', new THREE.BufferAttribute(ePos, 3)); eGeo.setAttribute('color', new THREE.BufferAttribute(eCol, 3));
  const eMat = new THREE.PointsMaterial({ size: 2.6, map: dotTex, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
  const eParticles = new THREE.Points(eGeo, eMat); eParticles.frustumCulled = false; scene.add(eParticles);
  const eData = Array.from({ length: EMAX }, () => ({ life: 0, max: 1, vx: 0, vy: 0, vz: 0, r: 0, g: 0, b: 0 }));
  const eAlive = new Uint8Array(EMAX), eActive = [];
  let eNext = 0;
  const tmpCol = new THREE.Color();
  function emit(x, y, z, color, n, speed, life, keep) {   // keep: eat effects stay on «low» quality, with a third of the particles
    if (fxTarget) return fxTarget.emit(x, y, z, color, n, speed, life);
    if (QUALITY === 'low') { if (!keep) return; n = Math.ceil(n / 3); }
    if (QUALITY === 'medium') n = Math.ceil(n / 2);
    tmpCol.set(color);
    const P = keep ? ePos : pPos, D = keep ? eData : pData, AL = keep ? eAlive : pAlive, AC = keep ? eActive : pActive, MX = keep ? EMAX : PMAX;
    for (let i = 0; i < n; i++) {
      const slot = keep ? eNext : pNext, d = D[slot], k = slot * 3;
      if (!AL[slot]) { AL[slot] = 1; AC.push(slot); }
      if (keep) eNext = (eNext + 1) % MX; else pNext = (pNext + 1) % MX;
      const a = Math.random() * Math.PI * 2, sp = speed * (0.35 + Math.random() * 0.8);
      d.vx = Math.cos(a) * sp; d.vz = Math.sin(a) * sp; d.vy = (Math.random() * 0.8 + 0.2) * sp * 0.5;
      P[k] = x; P[k + 1] = y; P[k + 2] = z;
      d.r = tmpCol.r; d.g = tmpCol.g; d.b = tmpCol.b;
      d.life = d.max = life * (0.6 + Math.random() * 0.6);
    }
  }
  function stepParticles(dt, data, pos, col, geo, alive, active, fade) {
    const drag = Math.exp(-3 * dt);
    for (let n = active.length - 1; n >= 0; n--) {
      const i = active[n], d = data[i], k = i * 3;
      d.life -= dt;
      if (d.life <= 0) {
        d.life = 0; col[k] = col[k + 1] = col[k + 2] = 0; alive[i] = 0;
        active[n] = active[active.length - 1]; active.pop();
        continue;
      }
      pos[k] += d.vx * dt; pos[k + 1] += d.vy * dt; pos[k + 2] += d.vz * dt;
      d.vx *= drag; d.vy = d.vy * drag - 6 * dt; d.vz *= drag;
      if (pos[k + 1] < 0.1) { pos[k + 1] = 0.1; d.vy = 0; }
      const f = Math.max(0, d.life / d.max), g = fade ? Math.min(1, f * 1.8) : f;   // eat particles stay bright longer, then fade
      col[k] = d.r * g; col[k + 1] = d.g * g; col[k + 2] = d.b * g;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true;
  }
  function updateParticles(dt) {
    if (eActive.length || eGeo.userData.dirty) { stepParticles(dt, eData, ePos, eCol, eGeo, eAlive, eActive, true); eGeo.userData.dirty = eActive.length > 0; }
    stepParticles(dt, pData, pPos, pCol, pGeo, pAlive, pActive, false);
    pGeo.attributes.position.needsUpdate = true;
    pGeo.attributes.color.needsUpdate = true;
  }
  const cellColor = c => c.vis.glow.material.color;

  // icon sprites (hearts, stars, bolts) and floor shockwaves for eat effects
  function iconTex(paint) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 64;
    const x = cv.getContext('2d'); x.fillStyle = '#fff'; x.shadowColor = '#fff'; x.shadowBlur = 6; paint(x);
    return new THREE.CanvasTexture(cv);
  }
  const ICONS = {
    heart: iconTex(x => { x.beginPath(); x.moveTo(32, 54); x.bezierCurveTo(2, 32, 10, 4, 32, 20); x.bezierCurveTo(54, 4, 62, 32, 32, 54); x.fill(); }),
    star: iconTex(x => { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 11 : 26; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.fill(); }),
    bolt: iconTex(x => { x.beginPath(); [[36, 4], [14, 36], [30, 36], [24, 60], [50, 26], [34, 26], [42, 4]].forEach(([a, b]) => x.lineTo(a, b)); x.fill(); }),
    petal: iconTex(x => { x.beginPath(); x.moveTo(32, 6); x.bezierCurveTo(54, 20, 50, 46, 32, 58); x.bezierCurveTo(14, 46, 10, 20, 32, 6); x.fill(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.moveTo(26, 6); x.lineTo(32, 16); x.lineTo(38, 6); x.fill(); }),
    leaf: iconTex(x => { x.beginPath(); x.moveTo(8, 56); x.bezierCurveTo(8, 20, 30, 6, 58, 6); x.bezierCurveTo(58, 34, 40, 56, 8, 56); x.fill(); x.globalCompositeOperation = 'destination-out'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(10, 54); x.lineTo(50, 14); x.stroke(); }),
    square: iconTex(x => { x.fillRect(14, 14, 36, 36); }),
    drop: iconTex(x => { x.beginPath(); x.moveTo(32, 4); x.bezierCurveTo(48, 28, 52, 38, 52, 44); x.arc(32, 44, 20, 0, Math.PI); x.bezierCurveTo(12, 38, 16, 28, 32, 4); x.fill(); }),
    moon: iconTex(x => { x.beginPath(); x.arc(32, 32, 24, 0, Math.PI * 2); x.fill(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(44, 24, 20, 0, Math.PI * 2); x.fill(); }),
    plus1: iconTex(x => { x.font = 'bold 34px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('+1', 32, 34); }),
    arrow: iconTex(x => { x.lineWidth = 5; x.strokeStyle = '#fff'; x.beginPath(); x.moveTo(8, 56); x.lineTo(50, 14); x.stroke(); x.beginPath(); x.moveTo(56, 8); x.lineTo(38, 14); x.lineTo(50, 26); x.fill(); x.beginPath(); x.moveTo(8, 56); x.lineTo(6, 44); x.lineTo(18, 46); x.fill(); }),
  };
  // 2.3 «Хронос» icons: a gear, a dial, a tick mark, numbers 1…12 and Roman numerals I…XII
  ICONS.gear = iconTex(x => { x.beginPath(); for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, r = (i % 4 < 2) ? 28 : 22; x.lineTo(32 + Math.cos(a) * r, 32 + Math.sin(a) * r); } x.fill(); x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.arc(32, 32, 8, 0, 6.29); x.fill(); x.lineWidth = 3; x.beginPath(); x.arc(32, 32, 15, 0, 6.29); x.stroke(); });
  ICONS.clock = iconTex(x => { x.strokeStyle = '#fff'; x.lineWidth = 4; x.beginPath(); x.arc(32, 32, 25, 0, 6.29); x.stroke(); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.lineWidth = i % 3 ? 2 : 4; x.beginPath(); x.moveTo(32 + Math.cos(a) * 17, 32 + Math.sin(a) * 17); x.lineTo(32 + Math.cos(a) * 22, 32 + Math.sin(a) * 22); x.stroke(); } x.lineWidth = 3; x.beginPath(); x.moveTo(32, 32); x.lineTo(32, 14); x.moveTo(32, 32); x.lineTo(44, 36); x.stroke(); });
  ICONS.tick = iconTex(x => { x.fillRect(29, 10, 6, 44); });
  for (let k = 1; k <= 12; k++) { ICONS['n' + k] = iconTex(x => { x.font = 'bold 36px Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(k), 32, 34); });
    ICONS['r' + k] = iconTex(x => { x.font = `bold ${k > 8 || k === 8 ? 22 : 30}px Georgia, serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'][k % 12], 32, 34); }); }
  // floor marks («Часовые отметины»), flashing dials («Тик-так») and frozen frames («Стоп-кадр») live in small pools
  const crMarks = Array.from({ length: 36 }, () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), decal(new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })));
    m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); return { m, life: 0, max: 1 }; });
  let crMarkNext = 0;
  function crMark(x, z, icon, size, rot, color) { const d = crMarks[crMarkNext]; crMarkNext = (crMarkNext + 1) % crMarks.length;
    d.m.material.map = ICONS[icon]; d.m.material.color.set(color); d.m.material.needsUpdate = true; d.m.position.set(x, .06, z); d.m.rotation.z = rot; d.m.scale.setScalar(size); d.life = d.max = 2.4; d.m.visible = true; }
  const dialTex = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 128; const x = cv.getContext('2d'); x.strokeStyle = '#ffd27a'; x.lineWidth = 6; x.shadowColor = '#ffd27a'; x.shadowBlur = 8; x.beginPath(); x.arc(64, 64, 56, 0, 6.29); x.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; x.lineWidth = i % 3 ? 3 : 6; x.beginPath(); x.moveTo(64 + Math.cos(a) * 40, 64 + Math.sin(a) * 40); x.lineTo(64 + Math.cos(a) * 50, 64 + Math.sin(a) * 50); x.stroke(); } return new THREE.CanvasTexture(cv); })();
  const crDials = Array.from({ length: 4 }, () => { const g = new THREE.Group(); const face = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: dialTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); g.add(face);
    const hand = new THREE.Mesh(new THREE.PlaneGeometry(.08, .78), new THREE.MeshBasicMaterial({ color: '#ff4fd8', transparent: true, depthWrite: false, side: THREE.DoubleSide })); hand.geometry.translate(0, .39, 0); g.add(hand);
    g.visible = false; scene.add(g); return { g, face, hand, life: 0 }; });
  let crDialNext = 0;
  function crDial(x, y, z, r) { const d = crDials[crDialNext]; crDialNext = (crDialNext + 1) % crDials.length; d.g.position.set(x, y, z); d.g.scale.setScalar(1.2 + r * .6); d.life = 1; d.g.visible = true; }
  const crackTex = (() => { const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const x = cv.getContext('2d'); x.fillStyle = '#8a86a8'; x.fillRect(0, 0, 256, 128); x.strokeStyle = '#ffffff'; x.lineWidth = 2;
    let s0 = 7; const r = () => (s0 = (s0 * 16807) % 2147483647) / 2147483647; for (let k = 0; k < 12; k++) { let px = r() * 256, py = r() * 128; x.beginPath(); x.moveTo(px, py); for (let i = 0; i < 6; i++) { px += (r() - .5) * 50; py += (r() - .5) * 34; x.lineTo(px, py); } x.stroke(); } return new THREE.CanvasTexture(cv); })();
  const crFrozen = Array.from({ length: 4 }, () => { const m = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ map: crackTex, color: '#c8c4e8', transparent: true, opacity: .9 })); m.visible = false; scene.add(m); return { m, life: 0, done: true }; });
  let crFrozenNext = 0;
  function crFreeze(x, z, r, k = 1) { const d = crFrozen[crFrozenNext]; d.k = k; crFrozenNext = (crFrozenNext + 1) % crFrozen.length; d.m.position.set(x, r * .92, z); d.m.scale.setScalar(r); d.r = r; d.life = .55; d.done = false; d.m.visible = true; }
  function crFxTick(dt) {
    for (const d of crMarks) { if (!d.m.visible) continue; d.life -= dt; if (d.life <= 0) { d.m.visible = false; continue; } d.m.material.opacity = Math.min(1, d.life / d.max * 1.8); }
    for (const d of crDials) { if (!d.g.visible) continue; d.life -= dt; if (d.life <= 0) { d.g.visible = false; continue; } const p = 1 - d.life; d.g.quaternion.copy(camera.quaternion);
      d.hand.rotation.z = -p * Math.PI * 2.2; d.face.material.opacity = d.hand.material.opacity = p < .15 ? p / .15 : Math.min(1, d.life / .3); }
    for (const d of crFrozen) { if (!d.m.visible) continue; d.life -= dt; d.m.material.opacity = .9 * Math.min(1, d.life / .15 + .2);
      if (d.life <= .12 && !d.done) { d.done = true; const p = d.m.position; emit(p.x, p.y, p.z, '#e8b05a', 46, (3 + d.r * .6) * d.k, 1.3, true); emit(p.x, p.y, p.z, '#ffd27a', 20, 2 * d.k, 1.6, true); emit(p.x, p.y, p.z, '#ffffff', 14, 8 * d.k, .3, true); }
      if (d.life <= 0) d.m.visible = false; }
  }
  const iconPool = Array.from({ length: 70 }, () => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    sp.visible = false; scene.add(sp);
    return { sp, life: 0, max: 1, vx: 0, vy: 0, vz: 0, size: 1 };
  });
  let iconNext = 0;
  function emitIcons(x, y, z, icon, color, n, size) {
    if (fxTarget) return fxTarget.icons(x, y, z, icon, color, n, size);
    for (let i = 0; i < n; i++) {
      const d = iconPool[iconNext]; iconNext = (iconNext + 1) % iconPool.length;
      const a = Math.random() * Math.PI * 2, sp = 4 + Math.random() * 6;
      d.sp.material.map = ICONS[icon]; d.sp.material.color.set(color); d.sp.material.needsUpdate = true;
      d.sp.position.set(x, y, z); d.vx = Math.cos(a) * sp; d.vz = Math.sin(a) * sp; d.vy = 6 + Math.random() * 6;
      d.size = size * (0.7 + Math.random() * 0.6); d.life = d.max = 0.9 + Math.random() * 0.4; d.sp.visible = true;
    }
  }
  function trailIcon(x, y, z, icon, color, size, fall = 1) {
    if (fxTarget) return fxTarget.icons(x, y, z, icon, color, 1, size, true);
    if (QUALITY === 'low') return;
    const d = iconPool[iconNext]; iconNext = (iconNext + 1) % iconPool.length;
    d.sp.material.map = ICONS[icon]; d.sp.material.color.set(color); d.sp.material.needsUpdate = true; d.sp.material.rotation = Math.random() * 6.28;
    d.sp.position.set(x + (Math.random() - .5), y, z + (Math.random() - .5)); d.vx = (Math.random() - .5) * 2; d.vz = (Math.random() - .5) * 2; d.vy = 3.5 * fall;
    d.size = size * (.7 + Math.random() * .5); d.life = d.max = 1 + Math.random() * .5; d.sp.visible = true;
  }
  const waves = Array.from({ length: 8 }, () => {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 72), decal(new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
    m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m);
    return { m, life: 0, max: 1, r0: 1, r1: 3 };
  });
  let waveNext = 0;
  function wave(x, z, color, r0, r1, life) {
    if (fxTarget) return fxTarget.wave(x, z, color, r0, r1, life);
    const w = waves[waveNext]; waveNext = (waveNext + 1) % waves.length;
    w.m.position.set(x, 0.08, z); w.m.material.color.set(color); w.r0 = r0; w.r1 = r1; w.life = w.max = life; w.m.visible = true;
  }
  function updateFx(dt) {
    crFxTick(dt);
    for (const d of iconPool) {
      if (!d.sp.visible) continue;
      d.life -= dt;
      if (d.life <= 0) { d.sp.visible = false; continue; }
      d.sp.position.x += d.vx * dt; d.sp.position.y += d.vy * dt; d.sp.position.z += d.vz * dt;
      d.vy -= 9 * dt; d.vx *= 0.97; d.vz *= 0.97;
      const f = d.life / d.max; d.sp.material.opacity = Math.min(1, f * 1.6); d.sp.scale.setScalar(d.size * (0.6 + 0.4 * f));
    }
    for (const w of waves) {
      if (!w.m.visible) continue;
      w.life -= dt;
      if (w.life <= 0) { w.m.visible = false; continue; }
      const f = w.life / w.max; w.m.scale.setScalar(w.r0 + (w.r1 - w.r0) * (1 - f)); w.m.material.opacity = f;
    }
  }
  const emitP = (...a) => emit(...a), emitIconsP = (...a) => emitIcons(...a), waveP = (...a) => wave(...a);
  // eat effects are drawn bigger and brighter: more particles, wider spread, longer life, bigger icons and waves
  const EAT_FX_SCALE = { count: 1.8, spread: 1.45, life: 1.6, icons: 1.6, iconSize: 2.2, wave: 1.45 };
  // the camera backs off as the drop grows (up to ~7×), so eat effects grow with it and keep the same size on screen
  let fxViewK = 1;
  const FX_VIEW_BASE = (16 + 0.38 * Math.sqrt(10) * 4) * 2.2;   // camera height at the starting mass
  function eatFx(x, z, r, color, id = save.fx.eat) {
    const K = EAT_FX_SCALE, S = fxTarget ? 1 : Math.max(1, fxViewK * .85);
    const emit = (a, b, c, col, n, sp, life) => emitP(a, b, c, col, Math.round(n * K.count), sp * K.spread * S, life * K.life, true);
    const emitIcons = (a, b, c, ic, col, n, size) => emitIconsP(a, b, c, ic, col, Math.round(n * K.icons), size * K.iconSize * S);
    const wave = (a, b, col, r0, r1, life) => waveP(a, b, col, r0 * S, r1 * K.wave * S, life * K.life);
    r = Math.max(r, 1);
    const big = !fxTarget && player.cells.length ? Math.max(...player.cells.map(c => cellR(c))) : r;
    const y = fxTarget ? fxTarget.eatY : Math.max(r * 0.9, big * 1.15 + 1.2);   // above the eater, so the burst is not hidden inside the big drop
    switch (id) {
      case 'heartEat': emitIcons(x, y, z, 'heart', '#ff4f9a', 9, 1.4 + r * 0.25); break;
      case 'cr_tick': if (fxTarget) { emitIcons(x, y, z, 'clock', '#ffd27a', 2, 1.4 + r * .25); wave(x, z, '#ffd27a', r, r * 2.5 + 2, .5); } else { crDial(x, y, z, r * S); emit(x, y, z, '#ffd27a', 10, 6, .4); } break;
      case 'cr_freeze': if (fxTarget) { emit(x, y, z, '#c8c4e8', 20, 3, .4); emit(x, y, z, '#e8b05a', 30, 4, 1.1); emitIcons(x, y, z, 'square', '#c8c4e8', 3, .8); } else crFreeze(x, z, Math.max(r, S * .9), S); break;
      case 'psNova': emit(x, y, z, '#ffffff', 26, 16, .45); emit(x, y, z, '#ff8ae6', 20, 11, .8); emitIcons(x, y, z, 'star', '#ffffff', 3, 1.6 + r * .25); wave(x, z, '#ff8ae6', r, r * 4.5 + 4, .65); wave(x, z, '#9ff0ff', r * .5, r * 3 + 3, .5); break;
      case 'shockEat': wave(x, z, color, r, r * 4 + 4, .6); wave(x, z, '#ffffff', r * .5, r * 3 + 3, .45); break;
      case 'sf_6': emit(x, y, z, '#ffd23f', 40, 22, .8); emit(x, y, z, '#ff9a3d', 24, 14, 1); emitIcons(x, y, z, 'star', '#fff6a0', 4, 1.2 + r * .2); wave(x, z, '#ffd23f', r, r * 5 + 5, .7); break;
      case 'sf_12': emit(x, y, z, '#e8ecff', 34, 8, 1.2); emitIcons(x, y, z, 'moon', '#c9d6ff', 6, 1.3 + r * .2); wave(x, z, '#9fb0ff', r, r * 3.5 + 3, .7); break;
      case 'sf_18': for (let k = 0; k < 4; k++) emitIcons(x, y, z, 'square', ['#ff4fd8', '#22e6ff', '#ffd23f', '#3dffa2'][k], 3, .7 + r * .1); emitIcons(x, y + 1, z, 'plus1', '#ffffff', 1, 2 + r * .2); break;
      case 'sf_24': for (let k = 0; k < 14; k++) emit(x, y + k * 1.6, z, k % 3 ? '#22e6ff' : '#ffffff', 4, 1.2, .6); wave(x, z, '#22e6ff', r * .5, r * 4 + 4, .6); emit(x, y, z, '#ffffff', 30, 18, .4); break;
      case 'hf_valentine': emitIcons(x, y, z, 'arrow', '#ffd23f', 2, 1.8 + r * .2); emitIcons(x, y, z, 'heart', '#ff4f9a', 8, 1.3 + r * .2); wave(x, z, '#ff4f9a', r, r * 4 + 4, .7); break;
      case 'boltEat': emitIcons(x, y, z, 'bolt', '#ffd23f', 7, 1.6 + r * 0.25); emit(x, y, z, '#ffffff', 24, 16, .35); break;
      case 'starfall': emitIcons(x, y, z, 'star', '#ffd23f', 12, 1.5 + r * 0.25); emit(x, y, z, '#ffd23f', 24, 12, .7); break;
      case 'prismEat': for (let k = 0; k < 6; k++) emit(x, y, z, tmpCol.setHSL(k / 6, 1, .6).getHex(), 10, 18, .9); wave(x, z, '#ff4fd8', r, r * 5 + 5, .8); wave(x, z, '#ffd23f', r * .7, r * 4 + 4, .65); wave(x, z, '#22e6ff', r * .4, r * 3 + 3, .5); break;
      case 'goldEat': emitIcons(x, y, z, 'star', '#ffd23f', 14, 1.6 + r * .25); emit(x, y, z, '#ffd23f', 36, 14, .9); emit(x, y, z, '#ffffff', 14, 10, .5); wave(x, z, '#ffd23f', r, r * 5 + 5, .8); break;
      case 'confettiEat': ['#ff4fd8', '#22e6ff', '#ffd23f', '#3dffa2', '#b26bff'].forEach(cc => emit(x, y, z, cc, 12, 15, .9)); break;
      case 'vortexEat': wave(x, z, '#7b3dff', r * 4 + 4, r * .4, .6); wave(x, z, '#ff4fd8', r * 3 + 2, r * .3, .45); emit(x, y, z, '#b26bff', 30, 5, .7); break;
      case 'popEat': ['#ff4fd8', '#22e6ff', '#ffd23f', '#3dffa2', '#b26bff'].forEach(cc => emit(x, y, z, cc, 6, 9, .5)); break;
      case 'iceEat': emit(x, y, z, '#ffffff', 30, 14, .6); emit(x, y, z, '#9fe8ff', 20, 8, .9); wave(x, z, '#9fe8ff', r, r * 3.5 + 3, .6); break;
      case 'miniholeEat': wave(x, z, '#7b3dff', r * 4 + 4, r * .3, .7); emit(x, y, z, '#3a0a8e', 25, 3, .8); emit(x, y, z, '#ff4fd8', 10, 2, .6); break;
      case 'rainbowEat': for (let k = 0; k < 6; k++) emit(x, y, z, tmpCol.setHSL(k / 6, 1, .6).getHex(), 12, 16, .9); wave(x, z, '#ff4fd8', r, r * 5 + 5, .8); wave(x, z, '#22e6ff', r * .5, r * 4 + 3, .6); break;
      case 'lg_burstEat': wave(x, z, '#ffd23f', r, r * 6 + 6, .9); wave(x, z, '#ff4fd8', r * .6, r * 4 + 4, .7); emitIcons(x, y, z, 'star', '#ffd23f', 12, 1.7 + r * .25); for (let k = 0; k < 6; k++) emit(x, y, z, tmpCol.setHSL(k / 6, 1, .6).getHex(), 12, 20, .9); break;
      case 'supernova': wave(x, z, '#ff4fd8', r, r * 6 + 6, .8); wave(x, z, '#22e6ff', r * .5, r * 4 + 3, .55); emit(x, y, z, '#ffffff', 70, 24, .9); break;
    }
  }
  let trailT = 0;
  const fxById = id => FX.find(f => f.id === id) || null;
  const nearView = (x, z) => Math.abs(x - focus.x) < 70 && Math.abs(z - focus.z) < 55;
  // dressed bots: about half wear a skin, about a third carry each kind of effect
  function dressBot(o) {
    const base = { id: 'bot_' + o.name, color: o.baseColor };
    const pick = list => list[(Math.random() * list.length) | 0];
    let sk = Math.random() < .5 ? pick(SKINS.filter(k => k.id !== 'default' && !k.legend && !k.skill && !k.tut && !k.craft)) : base;
    o.fx = {};
    for (const slot of ['trail', 'aura', 'eat']) if (Math.random() < .3) o.fx[slot] = pick(FX.filter(f => f.slot === slot && !f.legend && !f.craft)).id;
    if (o.star) { sk = SKINS.find(k => k.id === o.star.skin) || sk; o.fx = { aura: o.star.aura, trail: o.star.trail, eat: 'supernova' }; }
    o.trailDef = o.fx.trail ? fxById(o.fx.trail) : null;
    const st = o.star ? 3 : sk === base || Math.random() < .5 ? 0 : 1 + ((Math.random() * 3) | 0);
    o.lvl = o.star ? 40 + ((Math.random() * 11) | 0) : 1 + ((Math.random() * Math.min(45, playerLevel() + 10)) | 0);
    o.frame = o.star ? 'fr_rainbow' : Math.random() < .3 ? DECOR.filter(d => d.kind === 'frame')[(Math.random() * 14) | 0].id : null;
    o.lookSkin = sk.id; o.lookSt = st;   // a match for two sends the look to the other phone
    o.free.forEach(v => { applySkin(v, sk, st, null); setAura(v, o.fx.aura, sk.color); });
  }
  function trailFx(dt, now) {
    trailT += dt; if (trailT < 0.035) return; trailT = 0;
    if (QUALITY === 'low') return;
    if (save.fx.trail) { if (!player.trailDef || player.trailDef.id !== save.fx.trail) player.trailDef = fxById(save.fx.trail); trailOwner(player, save.fx.trail, now); }
    // bots emit at half rate and only near the camera, to keep particles cheap
    for (const o of bots) if (o.fx && o.fx.trail && o.cells.length && Math.random() < .5) trailOwner(o, o.fx.trail, now);
  }
  function trailOwner(o, id, now) {
    for (const c of o.cells) {
      const r = cellR(c), x = c.x - c.hx * r * 0.8, z = c.z - c.hz * r * 0.8;
      if (!o.isPlayer && !nearView(x, z)) continue;
      switch (id) {
        case 'sparksTrail': emit(x, r * .5, z, cellColor(c), 2, 2.5, .5); break;
        case 'cr_cogs': if (Math.random() < .3) trailIcon(x, r * .5, z, 'gear', Math.random() < .6 ? '#ffd27a' : '#e8b05a', 1 + r * .1, .25); break;
        case 'cr_marks': { o._mkT = (o._mkT || 0) + 1; if (o._mkT % 6) break; o._mkN = ((o._mkN || 0) + 1) % 36; const n = o._mkN, num = n % 3 === 0, rot = Math.atan2(c.hx, c.hz);
          const icon = num ? 'n' + (12 - (n / 3) % 12) : 'tick', size = (num ? 2.2 : 1.6) + r * .45;
          if (fxTarget) fxTarget.icons(x, .1, z, icon, '#ffd27a', 1, size, true); else crMark(x, z, icon, size, rot, num ? '#fff6d8' : '#ffd27a'); break; }
        case 'psDust': emit(x, r * .5, z, ['#ffffff', '#ff8ae6', '#b26bff', '#9ff0ff'][(Math.random() * 4) | 0], 3, 1.6, .9); if (Math.random() < .12) emitIcons(x, r * .7, z, 'star', '#ffffff', 1, .7); break;
        case 'bubbleTrail': emit(x, r * .3, z, '#7fe8ff', 1, 1.2, 1.2); break;
        case 'starTrail': emit(x, r * .5, z, '#ffd23f', 2, 1.5, .8); break;
        case 'fireTrail': emit(x, r * .4, z, ['#ff3d00', '#ff9a3d', '#ffd23f'][(Math.random() * 3) | 0], 3, 3, .45); break;
        case 'rainbowTrail': emit(x, r * .5, z, tmpCol.setHSL((now / 1500) % 1, 1, .6).getHex(), 3, 2, .9); break;
        case 'snowTrail': emit(x, r * .6, z, Math.random() < .5 ? '#ffffff' : '#bfefff', 2, 1, 1.1); break;
        case 'sparkTrail': emit(x, r * .5, z, Math.random() < .5 ? '#ffffff' : '#22e6ff', 3, 6, .25); break;
        case 'heartTrail': if (Math.random() < .3) emitIcons(x, r * .6, z, 'heart', '#ff4f9a', 1, .9); emit(x, r * .5, z, '#ff4f9a', 1, 1.5, .5); break;
        case 'leafTrail': if (Math.random() < .3) trailIcon(x, r * .8, z, 'leaf', ['#3dffa2', '#ffd23f', '#9be15d'][(Math.random() * 3) | 0], .8); else emit(x, r * .5, z, '#9be15d', 1, 1.2, .8); break;
        case 'pixelTrail': trailIcon(x, r * .6, z, 'square', ['#ff4fd8', '#22e6ff', '#ffd23f', '#3dffa2'][(Math.random() * 4) | 0], .45 + Math.random() * .3); break;
        case 'sf_2': emit(x, r * .5, z, ['#ff4fd8', '#ff9a3d', '#7b3dff', '#ffd23f'][(Math.random() * 4) | 0], 4, .3, 1); break;
        case 'sf_8': emit(x, r * .5, z, Math.random() < .5 ? '#ff6ad5' : '#b26bff', 3, .6, 1.8); break;
        case 'sf_14': if (Math.random() < .45) trailIcon(x, r * 1.1, z, 'drop', Math.random() < .7 ? '#b9ff3d' : '#3dff6e', .55, -.2); emit(x, r * .3, z, '#b9ff3d', 1, .6, .6); break;
        case 'sf_20': if (Math.random() < .6) trailIcon(x, r * .5, z, 'square', ['#ffd23f', '#22e6ff', '#ff4fd8', '#ffffff'][(Math.random() * 4) | 0], .3 + Math.random() * .25, .3); break;
        case 'sf_26': if (Math.random() < .5) trailIcon(x, r * .9, z, 'petal', Math.random() < .7 ? '#ff6ad5' : '#22e6ff', .7); emit(x, r * .5, z, '#ffb8f0', 1, .8, .7); break;
        case 'hf_halloween': emit(x, r * .5, z, Math.random() < .7 ? '#3dff6e' : '#b9ff3d', 1, .35, 2.2); if (Math.random() < .08) wave(x, z, '#3dff6e', r * .3, r * .9, .7); break;
        case 'inkTrail': emit(x, r * .4, z, Math.random() < .7 ? '#3a0a8e' : '#ff4fd8', 3, 1, 1.1); break;
        case 'goldTrail': emit(x, r * .5, z, Math.random() < .5 ? '#ffd23f' : '#fff6a0', 3, 2, .7); break;
        case 'plasmaTrail': emit(x, r * .5, z, Math.random() < .5 ? '#22e6ff' : '#ff4fd8', 4, 6, .3); break;
        case 'auroraTrail': emit(x, r * .6, z, tmpCol.setHSL(.3 + .45 * (.5 + .5 * Math.sin(now / 1200)), 1, .6).getHex(), 3, 1.2, 1.2); break;
        default: {
          const f = o.trailDef; if (!f || !f.colors) break;
          const col = f.colors[(Math.random() * f.colors.length) | 0];
          switch (f.style) {
            case 'bubbles': emit(x, r * .3, z, col, 1, 1, 1.3); break;
            case 'stars': if (Math.random() < .35) emitIcons(x, r * .6, z, 'star', col, 1, .9); else emit(x, r * .5, z, col, 1, 1.5, .6); break;
            case 'ribbon': emit(x, r * .5, z, col, 4, .25, .9); break;
            case 'rings': if (Math.random() < .2) wave(x, z, col, r * .6, r * 1.5, .5); emit(x, r * .4, z, col, 1, .6, .5); break;
            case 'smoke': emit(x, r * .4, z, col, 2, .7, 1.5); break;
            case 'spiral': { const a = performance.now() / 110; emit(x + Math.cos(a) * r * .7, r * .5, z + Math.sin(a) * r * .7, col, 2, .4, .9); break; }
            default: emit(x, r * .5, z, col, 3, 2.2, .75);
          }
          break;
        }
        case 'voidTrail': emit(x, r * .5, z, Math.random() < .5 ? '#7b3dff' : '#3a0a8e', 3, 1.5, 1); break;
      }
    }
  }
  // auras live on every player part
  function buildAura(type, color = skin().color) {
    if (!type) return null;
    const grp = new THREE.Group(); grp.userData.type = type;
    const add = (o, d) => { o.userData = d || {}; grp.add(o); return o; };
    const sc = new THREE.Color(color);
    if (type === 'orbitAura') for (let i = 0; i < 3; i++) {
      const o = add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshBasicMaterial({ color: sc })), { a: i * Math.PI * 2 / 3 });
      o.add(glowSprite(sc, 0.9, .9));
    }
    if (type === 'ringAura') {
      const t = add(new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.05, 8, 72), new THREE.MeshBasicMaterial({ color: '#22e6ff', transparent: true, blending: THREE.AdditiveBlending })));
      t.rotation.x = Math.PI / 2 - .45;
    }
    if (type === 'pulseAura') for (let i = 0; i < 2; i++) {
      const m = add(new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: sc, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })), { ph: i * .5 });
      m.rotation.x = -Math.PI / 2; m.position.y = -0.88;
    }
    if (type === 'haloAura') {
      const t = add(new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.07, 8, 48), new THREE.MeshBasicMaterial({ color: '#ffd23f' })));
      t.rotation.x = Math.PI / 2; t.position.y = 1.35; t.add(glowSprite('#ffd23f', 2.2, .6));
    }
    if (type === 'electricAura') for (let i = 0; i < 7; i++) add(glowSprite(i % 2 ? '#22e6ff' : '#ffffff', 0.5, 1));
    if (type === 'hexAura') add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.25, 1), new THREE.MeshBasicMaterial({ color: '#22e6ff', wireframe: true, transparent: true, opacity: .45, blending: THREE.AdditiveBlending, depthWrite: false })));
    if (type === 'flameAura') for (let i = 0; i < 12; i++) add(glowSprite(i % 2 ? '#ff6a00' : '#ffd23f', 0.6, 1), { a: i / 12 * Math.PI * 2 });
    if (type === 'cometAura') { const head = add(glowSprite('#ffffff', 0.7, 1)); head.add(glowSprite('#22e6ff', 1.6, .8)); }
    if (type === 'prismAura') ['#ff4fd8', '#ff9a3d', '#ffd23f', '#3dffa2', '#22e6ff', '#7b3dff'].forEach((c, i) => add(glowSprite(c, .75, 1), { a: i / 6 * Math.PI * 2 }));
    if (type === 'starAura') for (let i = 0; i < 12; i++) { const sp = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: ICONS.star, color: i % 2 ? '#ffffff' : '#ffd23f', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })), { a: (i >> 1) / 6 * Math.PI * 2, up: i % 2 }); sp.scale.setScalar(.5); }
    if (type === 'crownAura') for (let i = 0; i < 8; i++) { const sp = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: ICONS.star, color: '#ffd23f', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })), { a: i / 8 * Math.PI * 2 }); sp.scale.setScalar(.45); }
    if (type === 'moonAura') { const m = add(new THREE.Mesh(new THREE.SphereGeometry(.22, 14, 10), new THREE.MeshBasicMaterial({ color: '#e8ecff' }))); m.add(glowSprite('#c9d6ff', 1.4, .7)); }
    if (type === 'binaryAura') { const a1 = add(glowSprite('#ffd23f', .9, 1), { a: 0 }); a1.add(glowSprite('#ffd23f', 1.8, .5)); const a2 = add(glowSprite('#22e6ff', .9, 1), { a: Math.PI }); a2.add(glowSprite('#22e6ff', 1.8, .5)); }
    if (type === 'snowglobeAura') add(new THREE.Mesh(new THREE.SphereGeometry(1.3, 20, 14), new THREE.MeshBasicMaterial({ color: '#cfefff', wireframe: true, transparent: true, opacity: .22, blending: THREE.AdditiveBlending, depthWrite: false })));
    if (type === 'raysAura') for (let i = 0; i < 12; i++) { const sp = add(glowSprite(i % 2 ? '#ffd23f' : '#ff9a3d', 1, .9), { a: i / 12 * Math.PI * 2 }); sp.scale.set(.22, 1.1, 1); }
    if (type === 'lg_crownAura') for (let i = 0; i < 16; i++) { const sp = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: ICONS.star, color: i % 2 ? '#ff4fd8' : '#ffd23f', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })), { a: (i >> 1) / 8 * Math.PI * 2, up: i % 2 }); sp.scale.setScalar(.55); }
    if (type === 'lg_crownAura') add(glowSprite('#ffd23f', 5, .35));
    if (type === 'lg_moneyAura') { for (let i = 0; i < 12; i++) { const cn = add(new THREE.Mesh(new THREE.CylinderGeometry(.17, .17, .04, 18), new THREE.MeshStandardMaterial({ color: '#ffd23f', emissive: '#b07a00', emissiveIntensity: .8, metalness: .5, roughness: .25 })), { a: i / 12 * Math.PI * 2, h: Math.random() * 3, sp: .8 + Math.random() * .6 }); cn.rotation.x = Math.PI / 2; } add(glowSprite('#ffd23f', 4.2, .3)); }
    if (type === 'raidAura') for (let i = 0; i < 9; i++) { const sh = add(new THREE.Mesh(new THREE.OctahedronGeometry(.16), new THREE.MeshBasicMaterial({ color: i % 3 ? '#ff2d55' : '#ffd23f' })), { a: i / 9 * Math.PI * 2 }); sh.scale.set(.7, 1.6, .7); sh.add(glowSprite('#ff2d55', .9, .6)); }
    if (type === 'neonAura') ['#ff4fd8', '#22e6ff', '#b26bff'].forEach((c, i) => { const t = add(new THREE.Mesh(new THREE.TorusGeometry(1.45 + i * .18, .035, 6, 64), new THREE.MeshBasicMaterial({ color: c, transparent: true, blending: THREE.AdditiveBlending })), { i }); t.rotation.x = Math.PI / 2 + (i - 1) * .5; });
    if (type === 'sf_4') for (let i = 0; i < 9; i++) { const sp = add(glowSprite(i ? (i % 2 ? '#ff4fd8' : '#b26bff') : '#22e6ff', i ? .75 - i * .05 : 1.1, 1), { i }); if (!i) sp.add(glowSprite('#22e6ff', 2, .5)); }
    if (type === 'sf_10') { for (let i = 0; i < 2; i++) { const m = add(new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 64), new THREE.MeshBasicMaterial({ color: '#3dffa2', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })), { ph: i * .5 }); m.rotation.x = -Math.PI / 2; m.position.y = -0.88; }
      for (let i = 0; i < 4; i++) { const cr = add(new THREE.Mesh(new THREE.OctahedronGeometry(.16), new THREE.MeshBasicMaterial({ color: '#3dffa2' })), { a: i / 4 * Math.PI * 2 }); cr.scale.y = 1.7; cr.add(glowSprite('#3dffa2', .8, .6)); } }
    if (type === 'sf_16') for (let i = 0; i < 4; i++) { const arc = add(new THREE.Mesh(new THREE.TorusGeometry(1.6, .03, 6, 40, Math.PI), new THREE.MeshBasicMaterial({ color: i % 2 ? '#22e6ff' : '#ff3d6e', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })), { a: i / 4 * Math.PI }); arc.rotation.y = i / 4 * Math.PI; }
    if (type === 'sf_22') for (let i = 0; i < 4; i++) { const b = add(new THREE.Mesh(new THREE.BoxGeometry(.05, .05, 5.5), new THREE.MeshBasicMaterial({ color: ['#ff4fd8', '#22e6ff', '#3dffa2', '#ffd23f'][i], transparent: true, opacity: .85, blending: THREE.AdditiveBlending, depthWrite: false })), { a: i / 4 * Math.PI }); b.position.y = .6; }
    if (type === 'hf_newyear') for (let i = 0; i < 14; i++) { const b = add(new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), new THREE.MeshBasicMaterial({ color: ['#ff2d55', '#3dff6e', '#ffd23f', '#22e6ff'][i % 4] })), { a: i / 14 * Math.PI * 2, i }); b.add(glowSprite(b.material.color, .7, .8)); }
    if (type === 'lc_starAura') for (let i = 0; i < 10; i++) add(new THREE.Sprite(new THREE.SpriteMaterial({ map: ICONS.star, color: i % 2 ? '#c0c8e0' : '#4d7cff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })), { a: i / 10 * Math.PI * 2, up: i % 2 }).scale.setScalar(.45);
    if (type === 'cr_cogwings') { const gm = new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#b06a1a', emissiveIntensity: .7, metalness: .6, roughness: .3 });
      [[-1, 1.45, .4, .34, 11, 1], [-1, 1.95, .02, .23, 8, -1.5], [1, 1.45, .4, .34, 11, -1], [1, 1.95, .02, .23, 8, 1.5]].forEach(([sx, d, y, r, n, sp]) => { const ge = add(new THREE.Mesh(gearGeo(r, n, .07), gm), { sp, y }); ge.position.set(sx * d, y, -.1); ge.rotation.x = -.85; }); add(glowSprite('#ffd27a', 4.2, .25)); }
    if (type === 'cr_halo') { const ring = add(new THREE.Mesh(new THREE.TorusGeometry(.78, .05, 8, 48), new THREE.MeshBasicMaterial({ color: '#ffd27a' })), { ring: 1 }); ring.rotation.x = Math.PI / 2; ring.position.y = 1.45; ring.add(glowSprite('#ffd27a', 2.6, .5));
      for (let i = 0; i < 12; i++) { const sp = add(new THREE.Sprite(new THREE.SpriteMaterial({ map: ICONS['r' + (i || 12)], color: '#fff6d8', transparent: true, depthWrite: false })), { a: i / 12 * Math.PI * 2 }); sp.scale.setScalar(.36); } }
    if (type === 'cr_foucault') { const arm = add(new THREE.Group(), { arm: 1 }); arm.position.y = 2.6;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(.015, .015, 1.7, 5), new THREE.MeshBasicMaterial({ color: '#ffd27a' })); rod.position.y = -.85; arm.add(rod);
      const bob = new THREE.Mesh(new THREE.SphereGeometry(.13, 12, 8), new THREE.MeshBasicMaterial({ color: '#fff6d8' })); bob.position.y = -1.7; bob.add(glowSprite('#ffd27a', 1.3, .9)); arm.add(bob);
      for (let i = 0; i < 46; i++) { const dt0 = add(glowSprite('#ffd27a', .3, .9), { trail: i }); dt0.visible = false; } }
    if (type === 'galaxyAura') for (let i = 0; i < 22; i++) add(glowSprite(i % 3 ? '#b26bff' : '#ff4fd8', 0.35, .95), { a: Math.random() * Math.PI * 2, r: 1.35 + Math.random() * 0.8, w: 0.6 + Math.random() * 1.2 });
    return grp;
  }
  function setAura(v, type, color) {
    if (v.aura) v.mesh.remove(v.aura);
    v.aura = buildAura(type, color);
    if (v.aura) v.mesh.add(v.aura);
  }
  function applyAura() { for (const v of playerVis) setAura(v, save.fx.aura); }
  const tmpV3 = new THREE.Vector3();
  function animateAura(v, now) {
    const g = v.aura; if (!g) return;
    const t = now / 1000, type = g.userData.type;
    if (type === 'orbitAura') g.children.forEach(o => { const a = o.userData.a + t * 2.2; o.position.set(Math.cos(a) * 1.7, 0.25 + Math.sin(a * 2) * .15, Math.sin(a) * 1.7); });
    if (type === 'ringAura') g.rotation.y = t * 0.8;
    if (type === 'pulseAura') g.children.forEach(m => { const f = (t / 1.4 + m.userData.ph) % 1; m.scale.setScalar(1 + f * 1.8); m.material.opacity = 1 - f; });
    if (type === 'haloAura') g.children[0].position.y = 1.35 + Math.sin(t * 2) * .08;
    if (type === 'electricAura') g.children.forEach(o => { if (Math.random() < .3) { const u = Math.random() * 2 - 1, a = Math.random() * 6.283, q = Math.sqrt(1 - u * u); o.position.set(Math.cos(a) * q * 1.03, u * 1.03, Math.sin(a) * q * 1.03); o.visible = Math.random() < .8; } });
    if (type === 'hexAura') { g.position.y = 0.35; g.rotation.y = t * .6; g.rotation.x = t * .25; }
    if (type === 'flameAura') g.children.forEach(o => { const a = o.userData.a + t * 1.5; o.position.set(Math.cos(a) * 1.15, -0.4 + Math.random() * .25, Math.sin(a) * 1.15); o.scale.setScalar(0.45 + Math.random() * .4); });
    if (type === 'cometAura') {
      const o = g.children[0], a = t * 2.6;
      o.position.set(Math.cos(a) * 2.1, .4 + Math.sin(a * 1.5) * .3, Math.sin(a) * 2.1);
      if (Math.random() < .6) { o.getWorldPosition(tmpV3); emit(tmpV3.x, tmpV3.y, tmpV3.z, '#9fe8ff', 1, .6, .6); }
    }
    if (type === 'prismAura') { g.rotation.x = .55; g.children.forEach(o => { const a = o.userData.a + t * 1.4; o.position.set(Math.cos(a) * 1.9, 0, Math.sin(a) * 1.9); }); }
    if (type === 'starAura') g.children.forEach(o => { const d = o.userData, a = d.a + t * (d.up ? 1.1 : -.8), r = d.up ? 1.35 : 1.95; o.position.set(Math.cos(a) * r, (d.up ? .9 : -.1) + Math.sin(t * 2 + d.a) * .08, Math.sin(a) * r); });
    if (type === 'crownAura') g.children.forEach(o => { const a = o.userData.a + t * 1.2; o.position.set(Math.cos(a) * .75, 1.45 + Math.sin(t * 2 + o.userData.a) * .06, Math.sin(a) * .75); });
    if (type === 'moonAura') { const a = t * 1.1; g.children[0].position.set(Math.cos(a) * 2.1, .5, Math.sin(a) * 2.1); }
    if (type === 'binaryAura') g.children.forEach(o => { const a = o.userData.a + t * 2; o.position.set(Math.cos(a) * 1.9, .3 + Math.sin(a) * .2, Math.sin(a) * 1.9); });
    if (type === 'snowglobeAura') { g.position.y = .25; g.rotation.y = t * .3; if (Math.random() < .25) { g.children[0].getWorldPosition(tmpV3); const sc = v.mesh.scale.x; emit(tmpV3.x + (Math.random() - .5) * sc * 1.6, tmpV3.y + sc * .9, tmpV3.z + (Math.random() - .5) * sc * 1.6, '#ffffff', 1, .3, 1.4); } }
    if (type === 'raysAura') g.children.forEach(o => { const a = o.userData.a + t * .8, pulse = 1.35 + Math.sin(t * 3 + o.userData.a * 2) * .12; o.position.set(Math.cos(a) * pulse, .1, Math.sin(a) * pulse); });
    if (type === 'lg_crownAura') g.children.forEach(o => { if (o.userData.a === undefined) return; const d = o.userData, a = d.a + t * (d.up ? 1.3 : -1.3), r = d.up ? 1.5 : 2.1; o.position.set(Math.cos(a) * r, (d.up ? 1 : .2) + Math.sin(t * 3 + d.a) * .1, Math.sin(a) * r); o.material.rotation = t * 2; });
    if (type === 'lg_moneyAura') g.children.forEach(o => { const d = o.userData; if (d.a === undefined) return; const a = d.a + t * .9, h = (d.h + t * d.sp) % 3; o.position.set(Math.cos(a) * 1.55, 2.2 - h * 1.1, Math.sin(a) * 1.55); o.rotation.z = t * 4 + d.a; });
    if (type === 'raidAura') { g.rotation.x = .3; g.children.forEach(o => { const a = o.userData.a + t * 1.6; o.position.set(Math.cos(a) * 1.7, Math.sin(a * 2 + t) * .2, Math.sin(a) * 1.7); o.rotation.y = t * 3; }); }
    if (type === 'neonAura') g.children.forEach(o => { const i = o.userData.i; o.rotation.z = t * (.6 + i * .3) * (i % 2 ? -1 : 1); const k = 1 + Math.sin(t * 3 + i * 2) * .06; o.scale.setScalar(k); o.material.opacity = .55 + .45 * Math.sin(t * 3 + i * 2); });
    if (type === 'sf_4') g.children.forEach(o => { const a = t * 1.6 - o.userData.i * .32; o.position.set(Math.cos(a) * 1.9, .4 + Math.sin(a * 2 + t) * .35, Math.sin(a) * 1.9); });
    if (type === 'sf_10') g.children.forEach(m => { if (m.userData.ph !== undefined) { const f = (t / 1.6 + m.userData.ph) % 1; m.scale.setScalar(1 + f * 1.6); m.material.opacity = 1 - f; } else { const a = m.userData.a + t * 1.2; m.position.set(Math.cos(a) * 1.55, .2 + Math.sin(t * 2 + m.userData.a) * .15, Math.sin(a) * 1.55); m.rotation.y = t * 2; } });
    if (type === 'sf_16') { g.rotation.y = t * .7; g.children.forEach((o, i) => { o.material.opacity = .45 + .55 * Math.abs(Math.sin(t * 3 + i)); }); }
    if (type === 'sf_22') g.children.forEach((o, i) => { o.rotation.y = o.userData.a + t * (i % 2 ? 1.3 : -1); o.rotation.x = Math.sin(t * 1.5 + i) * .35; o.material.opacity = .5 + .5 * Math.abs(Math.sin(t * 4 + i * 1.3)); });
    if (type === 'hf_newyear') g.children.forEach(o => { const a = o.userData.a + t * .5; o.position.set(Math.cos(a) * 1.45, .15 + Math.sin(a * 3) * .12, Math.sin(a) * 1.45); o.visible = Math.sin(t * 5 + o.userData.i * 1.7) > -.4; });
    if (type === 'lc_starAura') g.children.forEach(o => { const d = o.userData, a = d.a + t * (d.up ? 1 : -.7), r = d.up ? 1.4 : 1.9; o.position.set(Math.cos(a) * r, (d.up ? .8 : -.05), Math.sin(a) * r); o.material.rotation = t; });
    if (type === 'cr_cogwings') g.children.forEach(o => { const d = o.userData; if (d.sp) { o.rotation.z = t * d.sp * 1.6; o.position.y = d.y + Math.sin(t * 2.2) * .08; } });
    if (type === 'cr_halo') g.children.forEach(o => { const d = o.userData; if (d.ring) o.position.y = 1.45 + Math.sin(t * 1.8) * .05; else if (d.a !== undefined) { const a = d.a + t * .35; o.position.set(Math.cos(a) * .78, 1.62 + Math.sin(t * 1.8) * .05, Math.sin(a) * .78); } });
    if (type === 'cr_foucault') { const u = g.userData, arm = g.children[0], th = .62 * Math.sin(t * 2.1), ps = t * .23; arm.rotation.set(0, ps, th);
      if (!u.lt || now - u.lt > 45) { u.lt = now; u.ti = ((u.ti || 0) + 1) % 46; const d = g.children.find(o => o.userData.trail === u.ti); if (d) { const L = 1.7 * Math.sin(th); d.position.set(-L * Math.cos(ps), -.92, L * Math.sin(ps)); d.visible = true; d.userData.born = now; } }
      g.children.forEach(o => { const d = o.userData; if (d.trail === undefined || !o.visible) return; const age = (now - d.born) / 2100; if (age > 1) { o.visible = false; return; } o.material.opacity = .9 * (1 - age); o.material.color.setHSL((d.born / 3000 + d.trail * .01) % 1, .9, .62); }); }
    if (type === 'galaxyAura') { g.rotation.x = .45; g.children.forEach(o => { const d = o.userData, a = d.a + t * d.w; o.position.set(Math.cos(a) * d.r, Math.sin(a * 3) * .05, Math.sin(a) * d.r); }); }
  }

