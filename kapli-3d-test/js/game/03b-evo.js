  // ================= 2.7: skins with evolution (forms I–III) =================
  // A skin here grows with a long goal: form I when it is earned, II and III further on. The player picks any open form.
  // These skins carry their own look over the head, their own trail and their own eat effect (all three grow with the
  // form), so a hat, an aura, a trail and an eat effect are not worn with them. Other players' drops show form I.
  const EVO_T = { value: 0 };
  const EVO_NOISE = `float h3(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
    float n3(vec3 x){vec3 i=floor(x),f=fract(x);f=f*f*(3.-2.*f);return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
    float fbm(vec3 p){float v=0.,a=.5;for(int k=0;k<4;k++){v+=a*n3(p);p*=2.03;a*=.5;}return v;}`;
  const EVO_VS = 'varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){ vP=position; vec4 mv=modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }';
  const evoShader = (frag) => new THREE.ShaderMaterial({ uniforms: { t: EVO_T }, vertexShader: EVO_VS, fragmentShader: EVO_NOISE + 'uniform float t; varying vec3 vP; varying vec3 vN; varying vec3 vV; void main(){' + frag + '}' });
  const evoGlow = (c, op = .8) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false });
  const evoStd = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: .35, metalness: .2 }, o));
  const evoRim = (c, k) => new THREE.ShaderMaterial({ uniforms: { c: { value: new THREE.Color(c) }, k: { value: k } }, vertexShader: EVO_VS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide,
    fragmentShader: 'uniform vec3 c; uniform float k; varying vec3 vN; varying vec3 vV; void main(){ float f=pow(1.-abs(dot(vN,vV)),2.4); gl_FragColor=vec4(c*f*k,f); }' });
  const evoMatCache = {};
  const evoMat = (key, make) => evoMatCache[key] || (evoMatCache[key] = make());
  const LIT = 'float l=.42+.58*max(dot(vN,normalize(vec3(.4,.6,.7))),0.); float f=pow(1.-abs(dot(vN,vV)),2.2);';

  // ---- the body of each skin (the drop's own sphere is hidden under it) ----
  const EVO_BODY = {
    lg_worlds: () => new THREE.MeshBasicMaterial({ color: 0x000000 }),
    lg_eternal: () => evoShader(`float v=fbm(vP*2.6); float vein=1.-smoothstep(0.,.05,abs(v-.52)); vec3 c=mix(vec3(.93,.95,1.),vec3(.78,.84,.95),fbm(vP*6.)); c=mix(c,vec3(.35,.65,1.),vein*.8); ${LIT} gl_FragColor=vec4(c*l+f*vec3(.5,.8,1.)*.6,1.);`),
    cs_q4: () => evoShader(`float a=atan(vP.z,vP.x)+vP.y*3.-t*.8; float v=.5+.5*sin(a*3.+fbm(vP*3.)*4.); vec3 c=mix(vec3(.02,.01,.04),vec3(1.,.31,.85),pow(v,6.)); float f=pow(1.-abs(dot(vN,vV)),3.); gl_FragColor=vec4(c+f*vec3(.8,.3,1.),1.);`),
    hc_berserk: () => evoShader(`float beat=pow(max(0.,sin(t*2.6)),8.); float v=fbm(vP*3.2); float vein=1.-smoothstep(0.,.035,abs(v-.5)); vec3 c=mix(vec3(.09,.01,.02),vec3(.22,.02,.04),fbm(vP*6.)); c+=vein*(.35+beat)*vec3(1.,.1,.08)*1.4; ${LIT} gl_FragColor=vec4(c*l+f*vec3(.9,.1,.1)*(.5+beat),1.);`),
    duo_twin: () => evoShader(`vec3 q=normalize(vP); float a=atan(q.z,q.x)+t*.6; float s=sin(a+q.y*2.4); vec3 c=mix(vec3(.13,.9,1.),vec3(.24,1.,.64),smoothstep(-.08,.08,s)); float e=1.-smoothstep(0.,.1,abs(s)); ${LIT} gl_FragColor=vec4(c*l+e*.8+f*vec3(.6,1.,.9)*.6,1.);`),
    duo_shield: () => evoShader(`vec3 q=normalize(vP); vec2 uv=vec2(atan(q.z,q.x)*2.2,asin(q.y)*3.); vec2 r=vec2(1.,1.732),hh=r*.5; vec2 a=mod(uv,r)-hh,b=mod(uv-hh,r)-hh; vec2 g=dot(a,a)<dot(b,b)?a:b; g=abs(g); float hx=max(dot(g,vec2(.866,.5)),g.y); float e=smoothstep(.42,.5,hx); float p=.5+.5*sin(t*2.-length(uv)*.8); ${LIT} gl_FragColor=vec4(mix(vec3(.04,.18,.2),vec3(.08,.32,.3),p*.4)*l+e*vec3(.35,1.,.8)*(.6+.6*p)+f*vec3(.4,1.,.85)*.5,1.);`),
    duo_const: () => evoStd(0x0a1030, { roughness: .3, metalness: .4, emissive: 0x0a1440, emissiveIntensity: .7 }),
  };
  // forms II–III of the black hole glow a warm gold, brighter (as in the reference): [colour from form II, strength I, strength II–III]
  const EVO_RIM2 = { lg_worlds: ['#ffb070', 1.5, 2.2] };
  const EVO_RIM = { cr_skeleton: '#ffd27a', lg_worlds: '#ff6a3d', lg_eternal: '#9fd8ff', cs_q4: '#ff4fd8', hc_berserk: '#ff1a1a', duo_twin: '#7affd0', duo_shield: '#5affc8', duo_const: '#8aa8ff' };

  // ---- the extras of each form: (g, F, full) adds meshes to g and returns a tick (t, dt) ----
  const ring = (r, w, c, op) => new THREE.Mesh(new THREE.TorusGeometry(r, w, 8, 96), evoGlow(c, op));
  const orbitOf = (list, r, sp, y = 0, wob = 0) => (t) => list.forEach((m, i) => { const a = t * sp + i / list.length * 6.283; m.position.set(Math.cos(a) * r, y + Math.sin(a * 2 + t) * wob, Math.sin(a) * r); });
  const EVO_EXTRA = {
    lg_worlds(g, F, full) {
      const diskMat = k => new THREE.ShaderMaterial({ uniforms: { t: EVO_T, k: { value: k } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
        vertexShader: 'varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
        fragmentShader: EVO_NOISE + 'uniform float t; uniform float k; varying vec3 vP; void main(){ float d=length(vP.xy); float a=atan(vP.y,vP.x); float band=smoothstep(1.25,1.45,d)*(1.-smoothstep(1.9,2.75,d)); float sw=fbm(vec3(cos(a)*d*2.,sin(a)*d*2.,t*.4)+vec3(a*1.5-t*1.2/d,0.,0.)); vec3 hot=mix(vec3(1.,.25,.35),vec3(1.,.82,.45),smoothstep(1.9,1.3,d)); float i=band*(.45+sw*1.1)*k; gl_FragColor=vec4(hot*i,i); }' });
      const disk = new THREE.Mesh(new THREE.RingGeometry(1.2, 2.8, 96, 1), diskMat(F >= 3 ? 1.6 : 1.15)); disk.rotation.x = -1.2; g.add(disk);
      let d2 = null, ph = null; if (F >= 2) { d2 = new THREE.Mesh(new THREE.RingGeometry(1.25, 2.3, 96, 1), diskMat(.75)); d2.rotation.set(-.35, .5, .4); g.add(d2); ph = ring(1.2, .025, 0xffe0a0, .9); g.add(ph);
        // the photon ring always faces the camera, like in the reference (it was fixed in the group and read as a white loop across the hole)
        const q = new THREE.Quaternion(); ph.onBeforeRender = (r, sc, cam) => { ph.parent.getWorldQuaternion(q); ph.quaternion.copy(q.invert().multiply(cam.quaternion)); ph.updateMatrixWorld(); }; }
      const jets = []; if (F >= 3 && full) [1, -1].forEach(s => { const j = new THREE.Mesh(new THREE.ConeGeometry(.28, 3.2, 20, 1, true), evoGlow(0x9fd8ff, .35)); j.material.side = THREE.DoubleSide; j.position.y = s * 2.4; j.rotation.x = s > 0 ? Math.PI : 0; g.add(j); jets.push(j); });
      return (t, dt) => { disk.rotation.z += dt * .6; if (d2) d2.rotation.z -= dt * .45; jets.forEach((j, i) => { j.material.opacity = .25 + .15 * Math.sin(t * 7 + i); }); };
    },
    lg_tycoon(g, F, full) {
      const coinGeo = new THREE.CylinderGeometry(.07, .07, .014, 20), coinMat = evoStd(0xffcc33, { metalness: .9, roughness: .25, emissive: 0x6a4a00, emissiveIntensity: .5 });
      let rain = []; if (F >= 2 && full) for (let i = 0; i < 12; i++) { const c = new THREE.Mesh(coinGeo, coinMat); c.userData = { a: Math.random() * 6.283, r: 1.3 + Math.random() * .6, y: Math.random() * 3 - 1.5, v: .6 + Math.random() * .6 }; g.add(c); rain.push(c); }
      if (F >= 2) { const gem = new THREE.Mesh(new THREE.OctahedronGeometry(.11, 0), evoStd(0xff2d55, { emissive: 0xff2d55, emissiveIntensity: .7 })); gem.position.y = 1.65; g.add(gem); }
      let bars = []; let dia = null; if (F >= 3) { const barGeo = new THREE.BoxGeometry(.26, .1, .13), barMat = evoStd(0xffd700, { metalness: 1, roughness: .2, emissive: 0x5a3c00, emissiveIntensity: .6 }); for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(barGeo, barMat); g.add(b); bars.push(b); } bars = instancify(bars);
        dia = new THREE.Mesh(new THREE.OctahedronGeometry(.22, 0), new THREE.MeshStandardMaterial({ color: 0xbff6ff, roughness: 0, emissive: 0x4ad7ff, emissiveIntensity: .8, transparent: true, opacity: .9 })); dia.scale.y = 1.4; dia.position.y = 2.05; g.add(dia); }
      rain = instancify(rain); const orb = orbitOf(bars, 1.75, .6, 0, .15);
      return (t, dt) => { rain.forEach(c => { const u = c.userData; u.y -= dt * u.v; if (u.y < -1.6) u.y = 1.8; u.a += dt * .3; c.position.set(Math.cos(u.a) * u.r, u.y, Math.sin(u.a) * u.r); c.rotation.x += dt * 4; });
        orb(t); bars.forEach(b => b.lookAt(0, b.position.y, 0)); if (dia) { dia.rotation.y += dt * 1.5; dia.position.y = 2.05 + Math.sin(t * 2) * .06; } };
    },
    lg_supernova(g, F, full) {
      const waves = []; if (F >= 2) for (let i = 0; i < 2; i++) { const w = ring(1.2, .03, 0xffd1f0, .7); w.rotation.x = 1.57; w.userData.p = i * .5; g.add(w); waves.push(w); }
      const orb = []; if (F >= 2) for (let i = 0; i < 2; i++) { const o = new THREE.Mesh(new THREE.OctahedronGeometry(.09, 0), evoGlow(i ? 0x9ff6ff : 0xffd23f, 1)); g.add(o); orb.push(o); }
      let rays = []; if (F >= 3 && full) { const rg = new THREE.PlaneGeometry(.08, 1.4), rm = [0xffffff, 0xff9adf].map(c => { const m = evoGlow(c, .4); m.side = THREE.DoubleSide; return m; }), rr = [[], []];
        for (let i = 0; i < 14; i++) { const r = new THREE.Mesh(rg, rm[i % 2]); r.userData.a = i / 14 * 6.283; g.add(r); rr[i % 2].push(r); } rays = [...instancify(rr[0]), ...instancify(rr[1])]; }
      const o2 = orbitOf(orb, 1.5, 1.4, 0, .3);
      return (t) => { waves.forEach(w => { const u = (t * .5 + w.userData.p) % 1; w.scale.setScalar(.9 + u * 1.6); w.material.opacity = .7 * (1 - u); }); o2(t);
        rays.forEach(r => { const a = r.userData.a + t * .2, l = 1 + .35 * Math.sin(t * 4 + r.userData.a * 3); r.position.set(Math.cos(a) * (1.1 + .7 * l), Math.sin(a) * (1.1 + .7 * l), -.2); r.rotation.z = a - 1.57; r.scale.y = l; }); };
    },
    lg_eternal(g, F, full) {
      const wreath = new THREE.Group(); wreath.position.y = 1.08; g.add(wreath);
      { const lg = new THREE.SphereGeometry(.09, 8, 6), lm = evoStd(F >= 2 ? 0xd8e4f0 : 0x5fbf6a, { metalness: F >= 2 ? .95 : .05, roughness: F >= 2 ? .18 : .5 }), leaves = [];
        for (let i = 0; i < 20; i++) { if (i === 0 || i === 10) continue; const a = i / 20 * 6.283, l = new THREE.Mesh(lg, lm);
          l.scale.set(.55, .25, 1.15); l.position.set(Math.cos(a) * .55, 0, Math.sin(a) * .55); l.rotation.y = -a + .6; wreath.add(l); leaves.push(l); } instancify(leaves); }
      let halo = null; if (F >= 2) { halo = ring(.7, .028, 0xbfe6ff, .85); halo.rotation.x = 1.57; halo.position.y = 1.45; g.add(halo); }
      let inf = null; const flame = []; if (F >= 3) { inf = new THREE.Group(); inf.position.y = 2; [-1, 1].forEach(sd => { const tt = ring(.2, .035, 0x9fd8ff, .95); tt.position.x = sd * .2; inf.add(tt); }); g.add(inf);
        if (full) for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(.12 - k * .03, .45 - k * .1, 12), evoGlow([0x7ad0ff, 0xbfe6ff, 0xffffff][k], .65)); f.position.y = 1.62; g.add(f); flame.push(f); } }
      return (t, dt) => { wreath.rotation.y += dt * .3; if (halo) halo.position.y = 1.45 + Math.sin(t * 2) * .04; if (inf) inf.rotation.y = Math.sin(t * .8) * .6; flame.forEach((f, k) => f.scale.set(1, 1 + .25 * Math.sin(t * 7 + k * 2), 1)); };
    },
    sk_virtuoso(g, F, full) {
      const prism = s => { const m = new THREE.Mesh(new THREE.CylinderGeometry(.16 * s, .16 * s, .32 * s, 3), new THREE.MeshStandardMaterial({ color: 0xe8fbff, transparent: true, opacity: .8, roughness: .05, emissive: 0x7af6ff, emissiveIntensity: .45 })); g.add(m); return m; };
      const ps = F >= 2 ? [prism(.7), prism(.7)] : [];
      const RB = [0xff3d6e, 0xff9a3d, 0xffd23f, 0x3dffa2, 0x22e6ff, 0x7b3dff], beams = [];
      if (F >= 2 && full) RB.forEach(c => { const b = new THREE.Mesh(new THREE.PlaneGeometry(.05, 1.3), evoGlow(c, .5)); b.material.side = THREE.DoubleSide; g.add(b); beams.push(b); });
      const links = []; if (F >= 3) for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, 1, 6), evoGlow(RB[i * 2], .8)); g.add(l); links.push(l); }
      const top = new THREE.Vector3(0, 1.5, 0);
      return (t) => { ps.forEach((p, i) => { const a = t * .9 + i * 3.14; p.position.set(Math.cos(a) * 1.45, F >= 3 ? .4 : Math.sin(a) * .3, Math.sin(a) * 1.45); p.rotation.y = t * 2; });
        beams.forEach((b, i) => { const a = -.55 + i * .22; b.position.set(Math.sin(a) * .7, 1.85 - Math.cos(a) * .7, 0); b.rotation.set(0, t * .5, a); });
        if (links.length) { const pts = [top, ps[0].position, ps[1].position]; links.forEach((l, i) => { const a = pts[i], b = pts[(i + 1) % 3]; l.position.copy(a).add(b).multiplyScalar(.5); l.scale.y = a.distanceTo(b); l.lookAt(b); l.rotateX(1.57); }); } };
    },
    cs_q4(g, F, full) {
      let belt = null, pts = null, low = null, grid = null;
      if (F >= 2) { belt = ring(1.45, .045, 0x22e6ff, .9); belt.rotation.x = 1.3; g.add(belt);
        if (full) { const geo = new THREE.BufferGeometry(), n = 160; geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffa8f0, size: .05, transparent: true, opacity: .9 })); pts.userData.s = [...Array(n)].map(() => [Math.random() * 6.283, 1.25 + Math.random() * .45]); pts.rotation.x = -.27; g.add(pts); } }
      if (F >= 3) { low = ring(.42, .05, 0xff4fd8, .95); low.position.y = -1.55; low.rotation.x = 1.4; g.add(low);
        if (full) { grid = new THREE.Mesh(new THREE.RingGeometry(1.9, 3.2, 48, 5), new THREE.MeshBasicMaterial({ color: 0x7b3dff, wireframe: true, transparent: true, opacity: .3 })); grid.rotation.x = -1.35; g.add(grid); } }
      return (t, dt) => { if (belt) belt.rotation.z += dt * .4; if (low) low.rotation.z -= dt; if (grid) grid.rotation.z += dt * .15;
        if (pts) { const a = pts.geometry.attributes.position; pts.userData.s.forEach((s, i) => { s[0] += dt * (2.2 / s[1]); a.setXYZ(i, Math.cos(s[0]) * s[1], Math.sin(s[0] * 3) * .06, Math.sin(s[0]) * s[1]); }); a.needsUpdate = true; } };
    },
    cv_skin(g, F, full) {
      const layers = (F >= 3 ? [0xff2d55, 0x22e6ff, 0x3dff6e] : F >= 2 ? [0xff2d55, 0x22e6ff] : []).map(c => { const m = new THREE.Mesh(new THREE.SphereGeometry(1.01, 32, 24), evoGlow(c, .26)); g.add(m); return m; });
      const frags = []; if (F >= 2 && full) for (let i = 0; i < 10; i++) { const f = new THREE.Mesh(new THREE.TetrahedronGeometry(.1, 0), evoStd(i % 2 ? 0xff2dd8 : 0x22e6ff, { flatShading: true, emissive: i % 2 ? 0x6a0050 : 0x004a5a, emissiveIntensity: .8 })); f.userData = { a: Math.random() * 6.283, r: 1.4 + Math.random() * .5, y: (Math.random() - .5) * 1.4, s: .4 + Math.random() * .8 }; g.add(f); frags.push(f); }
      return (t, dt) => { const gl = (t % 2.2) < .18 ? (Math.random() - .5) * .25 : 0;
        layers.forEach((l, i) => { const sp = F >= 3 ? .18 + .18 * Math.max(0, Math.sin(t * 1.3)) : .05; l.position.set(Math.cos(i * 2.09 + t) * sp + gl, Math.sin(i * 2.09 + t * 1.3) * sp * .5, 0); });
        frags.forEach(f => { const u = f.userData; u.a += dt * u.s; f.position.set(Math.cos(u.a) * u.r + gl, u.y, Math.sin(u.a) * u.r); f.rotation.x += dt * 2; }); };
    },
    hc_berserk(g, F, full) {
      const spikes = [], N = F >= 3 ? 30 : 22, len = F >= 3 ? .62 : .42;
      const mat = evoStd(0x1a0204, { metalness: .6, roughness: .35, emissive: F >= 2 ? 0xff1a10 : 0x3a0000, emissiveIntensity: F >= 2 ? .9 : .4 }), geo = new THREE.ConeGeometry(.09, len, 8);
      for (let i = 0; i < N; i++) { const y = 1 - (i + .5) / N * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996, d = new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
        if (d.z > .55 && Math.abs(d.y) < .55) continue; const m = new THREE.Mesh(geo, mat); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d); m.userData.d = d; g.add(m); spikes.push(m); }
      const spikesI = instancify(spikes);   // 2.7 FPS: one draw for all spikes
      const waves = []; if (F >= 2 && full) for (let i = 0; i < 2; i++) { const w = new THREE.Mesh(new THREE.SphereGeometry(1.1, 24, 16), evoGlow(0xff2010, 0)); w.material.side = THREE.BackSide; g.add(w); waves.push(w); }
      const chains = []; if (F >= 3) for (let c = 0; c < 2; c++) { const ch = new THREE.Group(); const lm = evoStd(0x3a3a44, { metalness: 1, roughness: .3, emissive: 0xff4a10, emissiveIntensity: .7 }), lg = new THREE.TorusGeometry(.07, .022, 6, 12);
        const links = []; for (let k = 0; k < (full ? 20 : 12); k++) { const l = new THREE.Mesh(lg, lm), a = k / (full ? 20 : 12) * 6.283; l.position.set(Math.cos(a) * 1.75, 0, Math.sin(a) * 1.75); l.rotation.y = -a; if (k % 2) l.rotateX(1.57); ch.add(l); links.push(l); } instancify(links);
        ch.rotation.set(c ? .5 : -.4, 0, c ? .3 : -.2); g.add(ch); chains.push(ch); }
      return (t, dt) => { const beat = Math.pow(Math.max(0, Math.sin(t * 2.6)), 8), k = 1 + beat * .35;
        spikesI.forEach(m => { m.scale.set(1, k, 1); m.position.copy(m.userData.d).multiplyScalar(.98 + len * k / 2); });
        waves.forEach((w, i) => { const u = (t * 2.6 / 6.283 + i * .5) % 1; w.scale.setScalar(1 + u * 1.2); w.material.opacity = .35 * (1 - u); }); chains.forEach((c, i) => { c.rotation.y += dt * (i ? -.6 : .8); }); };
    },
    duo_twin(g, F, full) {
      let mate = null, teth = null; if (F >= 2) { mate = new THREE.Mesh(new THREE.SphereGeometry(.3, 24, 16), evoMat('duo_twin', EVO_BODY.duo_twin)); g.add(mate); teth = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, 1, 6), evoGlow(0xbfffe8, .85)); g.add(teth); }
      let helix = []; if (F >= 3) { const hg = new THREE.SphereGeometry(.05, 6, 4), hm = [evoGlow(0x3dff9a, 1), evoGlow(0x22e6ff, 1)], hh = [[], []];
        for (let i = 0; i < (full ? 32 : 16); i++) { const m = new THREE.Mesh(hg, hm[i % 2]); m.userData.k = i; g.add(m); hh[i % 2].push(m); } helix = [...instancify(hh[0]), ...instancify(hh[1])]; }
      const n = helix.length;
      return (t) => { if (mate) { const a = t * 1.1; mate.position.set(Math.cos(a) * 1.65, .35, Math.sin(a) * 1.65); const L = mate.position.length() - 1.25; teth.scale.y = L; teth.position.copy(mate.position).normalize().multiplyScalar(1 + L / 2); teth.lookAt(mate.position); teth.rotateX(1.57); }
        helix.forEach(m => { const k = m.userData.k, y = -1.4 + (k >> 1) / (n / 2) * 2.8, a = y * 2.4 + t * 1.5 + (k % 2 ? 0 : Math.PI); m.position.set(Math.cos(a) * 1.45, y, Math.sin(a) * 1.45); }); };
    },
    duo_shield(g, F, full) {
      let plates = []; if (F >= 2) { const pg = new THREE.CylinderGeometry(.26, .26, .05, 6), pm = evoStd(0x0f3a36, { metalness: .7, roughness: .3, emissive: 0x2affc8, emissiveIntensity: .5 }); for (let i = 0; i < 6; i++) { const p = new THREE.Mesh(pg, pm); g.add(p); plates.push(p); } plates = instancify(plates); }
      let dome = null; if (F >= 3) { dome = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9, full ? 2 : 1), new THREE.MeshBasicMaterial({ color: 0x5affc8, wireframe: true, transparent: true, opacity: .35, blending: THREE.AdditiveBlending })); g.add(dome); }
      const orb = orbitOf(plates, 1.5, .7, 0, .2);
      return (t, dt) => { orb(t); plates.forEach(p => { p.lookAt(0, p.position.y, 0); p.rotateX(1.57); }); if (dome) { dome.rotation.y += dt * .15; dome.material.opacity = .22 + .18 * Math.max(0, Math.sin(t * 2.2)); } };
    },
    duo_const(g, F, full) {
      const con = (n, R, seed) => { let s = seed; const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280), pts = [];
        for (let i = 0; i < n; i++) { const a = rnd() * 6.283, b = Math.acos(2 * rnd() - 1); pts.push(new THREE.Vector3(Math.sin(b) * Math.cos(a), Math.cos(b), Math.sin(b) * Math.sin(a)).multiplyScalar(R)); }
        const c = new THREE.Group(); c.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(pts), new THREE.PointsMaterial({ color: 0xffffff, size: .09, transparent: true, blending: THREE.AdditiveBlending })));
        const seg = []; pts.forEach((p, i) => { let best = 0, bd = 9; pts.forEach((q, j) => { if (j !== i && p.distanceTo(q) < bd) { bd = p.distanceTo(q); best = j; } }); seg.push(p, pts[best]); });
        c.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seg), new THREE.LineBasicMaterial({ color: 0x9ab8ff, transparent: true, opacity: .7, blending: THREE.AdditiveBlending }))); g.add(c); return c; };
      const body = con(22, 1.01, 7), outer = F >= 2 ? con(full ? 22 : 12, 1.85, 31) : null;
      const crown = []; let aur = null; if (F >= 3) { for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(new THREE.OctahedronGeometry(.07, 0), evoGlow(i % 3 ? 0xffffff : 0xffe08a, 1)); g.add(m); crown.push(m); } if (full) { aur = ring(1.35, .12, 0x6affd0, .35); aur.rotation.x = 1.4; g.add(aur); } }
      const orb = orbitOf(crown, .6, .6, 1.3, .05);
      return (t, dt) => { body.rotation.y += dt * .1; if (outer) outer.rotation.y -= dt * .12; orb(t); if (aur) aur.material.color.setHSL((.42 + .1 * Math.sin(t * .5)) % 1, .9, .6); };
    },
    // 2.7 «Хронос 2.0»: the skeleton watch grows its movement — II: more gears, a balance wheel and rubies; III: a tourbillon cage and a golden glow
    cr_skeleton(g, F, full) {
      const gm = new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#b06a1a', emissiveIntensity: .9, metalness: .6, roughness: .3 });
      const gears = [];
      const gear = (x, y, z, r, n, sp) => { const ge = new THREE.Mesh(gearGeo(r, n, .07), gm); ge.position.set(x, y, z); ge.rotation.x = Math.PI / 2; ge.userData.sp = sp; g.add(ge); gears.push(ge); return ge; };
      let balance = null, cage = null, glow = null; const rubies = [];
      if (F >= 2) {
        gear(-.42, -.3, -.12, .22, 8, 2.6); gear(.05, -.5, .2, .18, 7, -3.1); if (full) gear(.48, .02, .2, .16, 6, 3.4);
        balance = new THREE.Mesh(new THREE.TorusGeometry(.24, .025, 6, 32), gm); balance.position.set(.05, .1, .32); g.add(balance);
        const rm = new THREE.MeshStandardMaterial({ color: '#ff3d6e', emissive: '#ff1a4a', emissiveIntensity: 1.2, roughness: .2 });
        [[-.55, .35, .25], [.6, -.3, .1], [0, .6, .2]].forEach(([x, y, z]) => { const rb = new THREE.Mesh(new THREE.SphereGeometry(.05, 10, 8), rm); rb.position.set(x, y, z); g.add(rb); rubies.push(rb); });
      }
      if (F >= 3) {
        cage = new THREE.Group(); const tilt = new THREE.Group(); tilt.rotation.x = -1.15; tilt.position.y = .32; tilt.add(cage); g.add(tilt);   // lies under the glass facing the camera, not standing up like a halo
        cage.add(new THREE.Mesh(new THREE.TorusGeometry(.36, .03, 8, 48), gm));
        const bar = new THREE.Mesh(new THREE.BoxGeometry(.72, .05, .05), gm); cage.add(bar);
        [-.2, .2].forEach(y => { const ge = new THREE.Mesh(gearGeo(.11, 6, .06), gm); ge.position.y = y; ge.rotation.x = Math.PI / 2; ge.userData.sp = -5; cage.add(ge); gears.push(ge); });
        const core = new THREE.Mesh(new THREE.SphereGeometry(.08, 12, 10), new THREE.MeshStandardMaterial({ color: '#ff3d6e', emissive: '#ff1a4a', emissiveIntensity: 1.4 })); cage.add(core);
        if (full) { glow = glowSprite('#ffd27a', 3.2, .45); g.add(glow); }
      }
      return (t, dt) => {
        gears.forEach(o => { o.rotation.z += dt * o.userData.sp * (F >= 3 ? 1.5 : 1); });
        if (balance) balance.rotation.z = Math.sin(t * 9) * .9;   // the balance wheel swings back and forth like in a real watch
        rubies.forEach((o, i) => { o.material.emissiveIntensity = .9 + .6 * Math.sin(t * 3 + i * 2); });
        if (cage) cage.rotation.z += dt * .9;
        if (glow) glow.material.opacity = .32 + .18 * Math.sin(t * 2);
      };
    },
  };

  // ---- what opens each form ----
  const evoDuoBest = d => ((((save.duo || {}).duoback || {}).best || {})[d]) || 0;
  const evoChaosTop = () => (save.chaosLog || []).filter(x => x.tier >= CHAOS_CFG.topTier).length;
  const evoLegend = (k, steps) => () => steps.filter(n => (save.legend[k] || 0) >= n).length;
  const evoSteps = (v, steps) => steps.filter(n => v >= n).length;
  const EVO = {
    lg_worlds:   { forms: evoLegend('kills', [100000, 150000, 250000]), need: ['100 000', '150 000', '250 000'], unit: 'съеденных капель', c: '#ff6a3d', c2: '#ffd27a' },
    lg_tycoon:   { forms: evoLegend('coins', [100000, 250000, 500000]), need: ['100 000 ◆', '250 000 ◆', '500 000 ◆'], unit: 'заработано', c: '#ffd23f', c2: '#ff9a3d' },
    lg_supernova:{ forms: evoLegend('stars', [5000, 7500, 12000]), need: ['5 000', '7 500', '12 000'], unit: 'съеденных звёзд', c: '#ff9adf', c2: '#ffffff' },
    lg_eternal:  { forms: evoLegend('wins', [10000, 15000, 25000]), need: ['10 000', '15 000', '25 000'], unit: 'побед', c: '#9fd8ff', c2: '#ffffff' },
    sk_virtuoso: { forms: () => !save.skins.includes('sk_virtuoso') ? 0 : 1 + evoSteps(SOLO_MODE_IDS.filter(id => masteryLv((save.mastery || {})[id] || 0) >= MASTERY_LV.length).length, [4, 8]),
      need: ['все 13 мастерских', '«Легенда» в 4 режимах', '«Легенда» в 8 режимах'], unit: '', c: '#22e6ff', c2: '#ff4fd8' },
    cs_q4:       { forms: () => !save.skins.includes('cs_q4') ? 0 : evoSteps(Math.max(1, evoChaosTop()), [1, 3, 6]), need: ['1 сезон', '3 сезона', '6 сезонов'], unit: 'в «Разломе» или выше', c: '#ff4fd8', c2: '#22e6ff' },
    cv_skin:     { forms: () => !save.skins.includes('cv_skin') ? 0 : 1 + evoSteps((save.chaosLog || []).length, [35, 45]), need: ['25 сезонов в «Сингулярности»', '35 сезонов в Хаос-лиге', '45 сезонов в Хаос-лиге'], unit: '', c: '#ff2dd8', c2: '#22e6ff' },
    hc_berserk:  { forms: () => evoSteps(save.hcPeak || 0, [40000, 50000, 70000]), need: ['40 000', '50 000', '70 000'], unit: 'массы за раунд «Хардкора»', c: '#ff2d2d', c2: '#ff9a3d', rar: 'Хардкор', grant: 'Берсерк' },
    duo_twin:    { forms: () => evoSteps(evoDuoBest('normal'), [30, 40, 50]), need: ['30-я волна', '40-я волна', '50-я волна'], unit: '«Спины к спине» на сложности «Обычный»', c: '#7affd0', c2: '#22e6ff', grant: 'Близнецы' },
    duo_shield:  { forms: () => evoSteps(evoDuoBest('hard'), [30, 40, 50]), need: ['30-я волна', '40-я волна', '50-я волна'], unit: '«Спины к спине» на сложности «Сложный»', c: '#5affc8', c2: '#2ab8a0', grant: 'Щит союза' },
    // 2.7: the workshop's flagship — forms by how much of the «Хронос» series you own (23 items)
    cr_skeleton: { forms: () => !save.skins.includes('cr_skeleton') ? 0 : 1 + evoSteps(wsSeriesN(), [15, 23]), need: ['создать «Скелетон»', '15 предметов серии', 'вся серия · 23'], unit: '', c: '#ffd27a', c2: '#ff3d6e' },
    duo_const:   { forms: () => evoSteps(evoDuoBest('mad'), [30, 40, 50]), need: ['30-я волна', '40-я волна', '50-я волна'], unit: '«Спины к спине» на сложности «Безумие»', c: '#ffe08a', c2: '#b26bff', grant: 'Созвездие' },
  };
  // their swatches in the wardrobe and the lists (a CSS picture of the body)
  const EVO_SW = {
    cr_skeleton: 'background:radial-gradient(circle at 34% 30%, rgba(255,255,255,.45) 0 8%, transparent 22%), radial-gradient(circle at 42% 46%, #ffd27a 0 9%, #7a4a12 10% 12%, transparent 13%), radial-gradient(circle at 64% 62%, #e8b05a 0 7%, #7a4a12 8% 10%, transparent 11%), radial-gradient(circle at 60% 38%, #ff3d6e 0 3%, transparent 4%), radial-gradient(circle at 50% 50%, #4a3a20, #1b1208 70%);box-shadow:0 0 0 2px #ffd27a inset,0 0 10px rgba(255,210,122,.6)',
    lg_worlds: 'background:radial-gradient(circle at 50% 50%, #000 0 34%, #ffb070 38%, #ff3d6e 46%, rgba(255,60,110,0) 62%), radial-gradient(ellipse 100% 24% at 50% 52%, #ffd27a 0 30%, #ff3d6e 55%, transparent 70%), #05020c;box-shadow:0 0 14px #ff6a3d;',
    lg_eternal: 'background:radial-gradient(circle at 35% 30%, #fff 0 12%, transparent 40%), repeating-linear-gradient(125deg, transparent 0 9px, rgba(90,160,255,.75) 9px 10.5px, transparent 10.5px 21px), #e6eeff;box-shadow:0 0 12px #9fd8ff;',
    hc_berserk: 'background:radial-gradient(circle at 50% 50%, #ff2d2d 0 6%, transparent 7%), conic-gradient(from 0deg, #2a0306 0 6%, #ff1a1a 6% 8%, #2a0306 8% 18%, #ff1a1a 18% 20%, #2a0306 20% 31%, #ff1a1a 31% 33%, #2a0306 33% 45%, #ff1a1a 45% 47%, #2a0306 47% 58%, #ff1a1a 58% 60%, #2a0306 60% 72%, #ff1a1a 72% 74%, #2a0306 74% 86%, #ff1a1a 86% 88%, #2a0306 88%);box-shadow:0 0 14px #ff1a1a;',
    duo_twin: 'background:radial-gradient(circle at 30% 50%, #3dff9a 0 12%, transparent 13%), radial-gradient(circle at 70% 50%, #22e6ff 0 12%, transparent 13%), linear-gradient(105deg, #22e6ff 0 49%, #fff 49% 51%, #3dff9a 51%);box-shadow:0 0 14px #7affd0;',
    duo_shield: 'background:radial-gradient(circle, transparent 0 55%, rgba(90,255,200,.9) 56% 58%, transparent 59%) 0 0/14px 14px, radial-gradient(circle at 40% 35%, #1f6a62, #082624);box-shadow:0 0 14px #5affc8;',
    duo_const: 'background:radial-gradient(circle at 30% 30%, #fff 0 2px, transparent 3px), radial-gradient(circle at 65% 40%, #ffe08a 0 2px, transparent 3px), radial-gradient(circle at 45% 70%, #fff 0 2px, transparent 3px), linear-gradient(35deg, transparent 47%, rgba(154,184,255,.8) 48% 50%, transparent 51%), radial-gradient(circle at 40% 35%, #1a2a6a, #070a24);box-shadow:0 0 14px #8aa8ff;',
  };
  let evoPv = {};   // a form looked at in the item window (also a locked one)
  const isEvo = s => !!(s && EVO[s.id]);
  const evoOpen = id => !EVO[id] ? 0 : TEST_MODE && save.evoAll ? 3 : Math.min(3, EVO[id].forms());   // test build: «Открыть всё» opens every form
  const evoForm = id => { const n = evoOpen(id); if (!n) return 0; const p = (save.evo || {})[id]; return p && p <= n ? p : n; };
  const evoOn = (s = skin()) => isEvo(s) && save.skins.includes(s.id);
  // the skins themselves (the legendary and challenge ones already exist; these four are new)
  SKINS.push(
    { id: 'hc_berserk', name: 'Берсерк', color: '#3a0408', accent: '#ff1a1a', glow: true, evoSkin: true, sig: 'шипы бьются в такт сердцу', evoSrc: '«Хардкор»: 40 000 массы за один раунд' },
    { id: 'duo_twin', name: 'Близнецы', color: '#22e6ff', accent: '#3dff9a', glow: true, evoSkin: true, sig: 'два цвета, как инь-ян', evoSrc: '«Спина к спине», «Обычный»: дойти до 30-й волны' },
    { id: 'duo_shield', name: 'Щит союза', color: '#0f3a36', accent: '#5affc8', glow: true, evoSkin: true, sig: 'шестиугольная броня', evoSrc: '«Спина к спине», «Сложный»: дойти до 30-й волны' },
    { id: 'duo_const', name: 'Созвездие', color: '#0a1030', accent: '#ffe08a', glow: true, evoSkin: true, sig: 'звёзды, соединённые линиями', evoSrc: '«Спина к спине», «Безумие»: дойти до 30-й волны' });
  { const et = SKINS.find(k => k.id === 'lg_eternal'); if (et) { et.color = '#e8f0ff'; et.accent = '#5aa0ff'; et.sig = 'мрамор, лавр, знак бесконечности'; } }

  // called at the end of applySkin: the body and the form's extras; only your own drops and previews get the full form
  function evoApply(vis, s, mine) {
    if (vis.evo) { vis.mesh.remove(vis.evo); vis.evo = null; vis.evoTick = null; }
    vis.headOff = false;
    vis.mesh.material.visible = true;
    if (!isEvo(s)) return;
    const F = vis.evoF || (mine ? Math.max(1, evoForm(s.id)) : 1), full = mine && QUALITY !== 'low';
    const g = new THREE.Group(); g.userData.F = F;
    vis.evoBody = !!EVO_BODY[s.id]; vis.evoHid = false;
    if (EVO_BODY[s.id]) { g.add(new THREE.Mesh(sphereGeo, evoMat(s.id, EVO_BODY[s.id]))); vis.mesh.material.visible = false; }
    if (EVO_RIM[s.id]) { const R2 = EVO_RIM2[s.id], rim = new THREE.Mesh(sphereGeo, evoMat('rim' + s.id + F, () => R2 ? evoRim(F >= 2 ? R2[0] : EVO_RIM[s.id], F >= 2 ? R2[2] : R2[1]) : evoRim(EVO_RIM[s.id], F >= 2 ? 1.6 : 1.1))); rim.scale.setScalar(1.12); g.add(rim); }   // only the rim is bigger (g.add() returns the group — scaling it buried the eyes)
    if (mine && EVO_EXTRA[s.id]) vis.evoTick = EVO_EXTRA[s.id](g, F, full);
    vis.evo = g; vis.mesh.add(g);
    if (vis.shine) vis.shine.visible = false;   // the old legend gleam (a lightning bolt) is not part of the evolved look
    vis.headOff = !!(vis.head && (s.id === 'lg_eternal' || s.id === 'lg_worlds')); if (vis.headOff) vis.head.visible = false;   // the wreath of «Вечный чемпион» is drawn by its form (not the old gold one)
  }
  function evoTick(vis, now) { EVO_T.value = now / 1000; if (vis.evoTick) vis.evoTick(now / 1000, Math.min(.05, (now - (vis.evoLast || now)) / 1000)); vis.evoLast = now; if (vis.evo) instSync(vis.evo); }

  // ---- the skin's own trail and eat effect, both grow with the form ----
  function evoTrail(now) {
    const s = skin(), F = Math.max(1, evoForm(s.id)), E = EVO[s.id]; if (!E || !player.cells.length) return;
    const c = player.cells.reduce((a, b) => a.mass >= b.mass ? a : b), r = cellR(c), sp = hyp(c.vx || 0, c.vz || 0);
    if (Math.random() > .55) return;
    const back = (k = 1) => [c.x - (c.hx || 0) * r * k, c.z - (c.hz || 0) * r * k];
    const [x, z] = back(.9);
    emit(x, r * .4, z, E.c, F, 2 + F, .5 + F * .15);
    if (F >= 2) emit(x, r * .5, z, E.c2, 1, 3, .7);
    if (F >= 3 && Math.random() < .35) { const [x2, z2] = back(1.4); waveP(x2, z2, E.c, r * .3, r * .9, .5); }
    void sp; void now;
  }
  function evoEat(x, z, r) {
    const s = skin(), F = Math.max(1, evoForm(s.id)), E = EVO[s.id]; if (!E) return;
    const y = r * .6;
    if (s.id === 'lg_worlds') {   // the black hole pulls the drop in along a spiral, then a flash
      for (let k = 0; k < 3 + F * 2; k++) emitP(x + Math.cos(k * 1.3) * r * 1.6, y, z + Math.sin(k * 1.3) * r * 1.6, k % 2 ? E.c : E.c2, 4, -6 - F * 2, .45, true);
      if (F >= 2) waveP(x, z, '#ffb070', r * 2.2, r * .3, .45); if (F >= 3) waveP(x, z, '#ffffff', r * .5, r * 3.2, .6);
      return;
    }
    if (s.id === 'hc_berserk') {   // a heartbeat: a red burst and a double shock
      emitP(x, y, z, E.c, 10 + F * 6, 9 + F * 2, .55, true); waveP(x, z, E.c, r * .5, r * (1.6 + F * .4), .45);
      if (F >= 2) setTimeout(() => waveP(x, z, '#ff6a3d', r * .5, r * 2.2, .4), 160); if (F >= 3) emitP(x, y, z, '#ffd27a', 12, 14, .7, true);
      return;
    }
    emitP(x, y, z, E.c, 8 + F * 6, 8 + F * 2, .55, true);
    if (F >= 2) emitP(x, y, z, E.c2, 6 + F * 3, 11, .7, true);
    waveP(x, z, E.c, r * .5, r * (1.4 + F * .5), .5);
    if (F >= 3) setTimeout(() => waveP(x, z, E.c2, r * .4, r * 2.8, .55), 120);
  }

  // the skins you earn here: given when form I opens, the next forms are announced
  // ---- 2.7: getting a skin with evolution or a new form is an event: a moment in the round, a window after it, a «new» mark ----
  const RN3 = ['', 'I', 'II', 'III'];
  function evoCheck(quiet, live) {
    save.evoSeen = save.evoSeen || {}; save.evoNew = save.evoNew || {}; save.evoQ = save.evoQ || []; const out = [], evs = [];
    for (const [id, E] of Object.entries(EVO)) {
      const n = evoOpen(id); if (!n) continue;
      let fresh = false;
      if (E.grant && !save.skins.includes(id)) { save.skins.push(id); out.push(`Новый скин «${E.grant}»!`); fresh = true; }
      const was = save.evoSeen[id] || 0;
      if (n > was) { if ((was || fresh) && save.skins.includes(id)) { evs.push({ id, f: n, from: fresh ? 0 : was, fresh }); if (!fresh) out.push(`«${SKINS.find(k => k.id === id).name}»: открыта форма ${RN3[n]}`); } save.evoSeen[id] = n; }
      else if (fresh) evs.push({ id, f: Math.max(1, n), from: 0, fresh });
    }
    const bulk = TEST_MODE && save.evoAll && quiet;   // test «Открыть всё»: no flood of windows and marks
    for (const ev of evs) { if (bulk) continue; save.evoNew[ev.id] = ev.f; save.evoQ.push(ev);
      if (live) evoMoment(ev); }
    if (out.length || evs.length) { persist(); refreshSkin(); }
    return out;
  }
  // in the round: the drop turns into its new form right where it was earned
  function evoMoment(ev) {
    const k = SKINS.find(x => x.id === ev.id), E = EVO[ev.id]; if (!k) return;
    if (save.skin === ev.id) { save.evo = { ...(save.evo || {}), [ev.id]: ev.f }; refreshSkin(); }
    if (running && player.cells.length) { const c = player.cells.reduce((a, b) => a.mass >= b.mass ? a : b), r = cellR(c);
      [0, 180, 360].forEach((d, i) => setTimeout(() => { try { wave(c.x, c.z, i % 2 ? E.c2 : E.c, r, r * 3.2 + 10, .9); } catch (e) {} }, d));
      player.cells.forEach(cc => { if (cc.vis) cc.vis.jig = 1; }); }
    try { Sound.play('level'); } catch (e) {}
    let b = document.getElementById('evoBanner'); if (!b) { b = document.createElement('div'); b.id = 'evoBanner'; b.setAttribute('role', 'status'); document.body.appendChild(b); }
    b.style.setProperty('--ec', E.c); b.style.setProperty('--ec2', E.c2);
    b.innerHTML = `<i aria-hidden="true"><svg viewBox="0 0 24 24">${DI.dna}</svg></i><span><small>${ev.fresh ? 'Новый скин с эволюцией' : 'Эволюция'}</small><b>«${k.name}» · форма ${RN3[ev.f]}</b></span>`;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show'); clearTimeout(evoMoment.t); evoMoment.t = setTimeout(() => b.classList.remove('show'), 3200);
  }
  // live checks during a round: hardcore peak mass (the waves of «Спина к спине» are checked when a wave starts)
  let evoLiveT = 0, evoTestT = 0;
  function evoLiveTick(dt) {
    if (evoTestT > 0 && (evoTestT -= dt) <= 0) { evoTestT = 0; try { evoTestMoment(); } catch (e) { KapliErr.log(e, "evo-test"); } }
    if ((evoLiveT += dt) < 1) return; evoLiveT = 0;
    if (mode === 'hardcore' && !stats.ranked && player.cells.length) { const m = Math.round(total(player)); if (m > (save.hcPeak || 0)) { save.hcPeak = m; evoCheck(false, true); } }
  }
  function evoTestMoment() {   // test build: the worn evolution skin (or Berserk) jumps one form up right now
    const id = EVO[save.skin] ? save.skin : 'hc_berserk'; if (!save.skins.includes(id)) save.skins.push(id);
    const cur = Math.max(1, evoForm(id)), f = cur >= 3 ? 1 : cur + 1; if (save.skin !== id) { save.skin = id; save.evo = { ...(save.evo || {}), [id]: f === 1 ? 1 : f - 1 }; refreshSkin(); }
    const ev = { id, f, from: f - 1 }; save.evoNew = { ...(save.evoNew || {}), [id]: f }; (save.evoQ = save.evoQ || []).push(ev); evoMoment(ev);
  }
  // after the round (or on start-up): a window per event — the drop flows from its old form into the new one
  let evoWin = null;
  function evoShowQueue() {
    if (evoWin || running || !(save.evoQ || []).length) return;
    if ([...document.querySelectorAll('.modal')].some(m => !m.hidden && m.id !== 'evoModal')) { clearTimeout(evoShowQueue.t); evoShowQueue.t = setTimeout(evoShowQueue, 900); return; }   // another window is open: wait for it
    const ev = save.evoQ.shift(); persist(); const k = SKINS.find(x => x.id === ev.id), E = EVO[ev.id]; if (!k || !E) return evoShowQueue();
    let m = document.getElementById('evoModal');
    if (!m) { m = document.createElement('div'); m.id = 'evoModal'; m.className = 'modal'; m.hidden = true; document.body.appendChild(m); }
    m.style.setProperty('--ec', E.c); m.style.setProperty('--ec2', E.c2);
    const worn = save.skin === ev.id && Math.max(1, evoForm(ev.id)) === ev.f;
    m.innerHTML = `<div class="modal-card evo-card" role="dialog" aria-modal="true" aria-labelledby="evoT"><div class="evo-stage"><svg class="evo-helix" viewBox="0 0 24 24" aria-hidden="true">${DI.dna}</svg><canvas id="evoCv"></canvas><div class="evo-flash"></div></div>
      <div class="evo-tx"><small>${ev.fresh ? '🧬 Новый скин с эволюцией' : '🧬 Эволюция'}</small><h2 id="evoT">«${k.name}» · форма ${RN3[ev.f]}</h2>
      <p>${ev.fresh ? `Скин твой. Он растёт вместе с тобой: ${[1, 2, 3].map(f => `${RN3[f]} — ${E.need[f - 1]}`).join(' · ')}${E.unit ? ' ' + E.unit : ''}.` : `Открыта форма ${RN3[ev.f]} — ${E.need[ev.f - 1]}${E.unit ? ' ' + E.unit : ''}. Форму можно сменить в окне скина.`}</p>
      <div class="evo-acts">${worn ? '<button class="btn" type="button" data-evok>Отлично</button>' : `<button class="btn" type="button" data-evowear>Надеть форму ${RN3[ev.f]}</button><button class="btn ghost" type="button" data-evok>Позже</button>`}</div></div></div>`;
    m.hidden = false;
    // a small 3D stage: old form → flash → new form
    const cv = m.querySelector('#evoCv'), R = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true }); R.setClearColor(0x000000, 0);
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight(0xc8c0ff, 0x10082a, 1.1)); { const d = new THREE.DirectionalLight(0xffffff, .8); d.position.set(2, 3, 4); sc.add(d); }
    const cam = new THREE.PerspectiveCamera(35, 1, .1, 80); cam.position.set(0, 2.6, 8.6); cam.lookAt(0, .5, 0);
    const v = previewBlob(k, 0, null); v.look = k; v.evoF = Math.max(1, ev.from || 1); evoApply(v, k, true); sc.add(v.mesh); v.mesh.position.y = .5;
    if (ev.fresh) v.mesh.scale.setScalar(.01);
    const t0 = performance.now(); let swapped = false, raf = 0;
    const fit = () => { const w = cv.clientWidth || 260, h = cv.clientHeight || 260; R.setPixelRatio(Math.min(2, devicePixelRatio || 1)); R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    fit();
    const loop = now => { raf = requestAnimationFrame(loop); const t = (now - t0) / 1000;
      if (!swapped && t > 1.4) { swapped = true; v.evoF = ev.f; evoApply(v, k, true); m.querySelector('.evo-flash').classList.add('go'); try { Sound.play('level'); } catch (e) {} }
      const pop = swapped ? 1 + .25 * Math.exp(-(t - 1.4) * 4) * Math.sin((t - 1.4) * 14) : ev.fresh ? Math.min(1, t / 1.2) * .6 : 1;
      v.mesh.scale.setScalar(Math.max(.01, pop)); v.mesh.rotation.y = .4 + Math.sin(t * .6) * .5;
      try { animateHead(v, now); evoTick(v, now); } catch (e) {}
      alphaSafe(sc); R.render(sc, cam); };
    raf = requestAnimationFrame(loop);
    evoWin = () => { cancelAnimationFrame(raf); try { R.dispose(); } catch (e) {} evoWin = null; m.hidden = true; m.innerHTML = ''; };
    m.onclick = e => {
      if (e.target.closest('[data-evowear]')) { save.skin = ev.id; save.evo = { ...(save.evo || {}), [ev.id]: ev.f }; persist(); refreshSkin(); toast(`«${k.name}» · форма ${RN3[ev.f]} надета`); }
      else if (!e.target.closest('[data-evok]') && e.target !== m) return;
      evoWin(); try { renderAll(); } catch (er) {} setTimeout(evoShowQueue, 300);
    };
    const first = m.querySelector('[data-evowear], [data-evok]'); if (first) first.focus();
  }

  // ---- the badges of these goals: «Хардкор» 75 000 (a forged medallion with a drop of blood) and «Спина к спине» —
  //      all 50 waves on each difficulty (a laurel medallion: yin-yang / shield / crown of stars) ----
  const EVO_BADGES = [
    { id: 'hc75', name: 'Берсерк · 75 000', src: '«Хардкор»: 75 000 массы за один раунд', got: () => (save.hcPeak || 0) >= 75000 },
    { id: 'hc88', name: 'Берсерк · 88 000', src: '«Хардкор»: 88 000 общей массы за раунд (обе половины вместе)', got: () => (save.hcPeak || 0) >= 88000 },
    { id: 'duo50n', name: 'Спина к спине · Обычный', src: 'все 50 волн «Спины к спине» на «Обычном»', got: () => evoDuoBest('normal') >= 50 },
    { id: 'duo50h', name: 'Спина к спине · Сложный', src: 'все 50 волн «Спины к спине» на «Сложном»', got: () => evoDuoBest('hard') >= 50 },
    { id: 'duo50m', name: 'Спина к спине · Безумие', src: 'все 50 волн «Спины к спине» на «Безумии»', got: () => evoDuoBest('mad') >= 50 },
  ];
  // 2.7: the hardcore ladder badges — A «Абсолют» 75 000, B «Бесконечность» 88 000, C «Корона Берсерка» for the win (2 × 50 000)
  let hcbUid = 0;
  function hcBadgeSVG(kind, cls = '') {
    const id = 'hcb' + (++hcbUid), C = cls ? ` class="${cls}"` : '';
    if (kind === 'a') return `<svg viewBox="0 0 100 100"${C} role="img" aria-label="Берсерк · 75 000"><defs><radialGradient id="${id}a" cx="50%" cy="45%"><stop offset="0" stop-color="#3a0408"/><stop offset="1" stop-color="#0a0002"/></radialGradient><linearGradient id="${id}r" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#ff6a3d"/><stop offset=".5" stop-color="#ff1a1a"/><stop offset="1" stop-color="#7a0010"/></linearGradient><radialGradient id="${id}c"><stop offset=".55" stop-color="#ff3a1a" stop-opacity="0"/><stop offset=".7" stop-color="#ffb040"/><stop offset="1" stop-color="#ff1a1a" stop-opacity="0"/></radialGradient></defs>
      <path d="M50 3 L91 26 V74 L50 97 L9 74 V26 Z" fill="url(#${id}a)" stroke="url(#${id}r)" stroke-width="4"/><path d="M50 11 L84 30 V70 L50 89 L16 70 V30 Z" fill="none" stroke="#ff3a2a" stroke-opacity=".35" stroke-width="1.2"/>
      <circle cx="50" cy="44" r="22" fill="url(#${id}c)"><animate attributeName="r" values="21;24;21" dur="1.4s" repeatCount="indefinite"/></circle>
      ${Array.from({ length: 12 }, (_, i) => { const q = i * Math.PI / 6, r2 = i % 2 ? 23 : 27; return `<line x1="${(50 + Math.cos(q) * 17).toFixed(1)}" y1="${(44 + Math.sin(q) * 17).toFixed(1)}" x2="${(50 + Math.cos(q) * r2).toFixed(1)}" y2="${(44 + Math.sin(q) * r2).toFixed(1)}" stroke="#ffb040" stroke-width="1.6" stroke-linecap="round"/>`; }).join('')}
      <circle cx="50" cy="44" r="15" fill="#050001" stroke="#ff6a3d" stroke-width="1.6"/>
      <circle cx="43" cy="44" r="5.5" fill="#ff2d2d"><animate attributeName="cx" values="38;45;38" dur="2.8s" repeatCount="indefinite"/></circle><circle cx="57" cy="44" r="5.5" fill="#ff9a3d"><animate attributeName="cx" values="62;55;62" dur="2.8s" repeatCount="indefinite"/></circle>
      <text x="50" y="80" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="900" font-size="17" fill="#fff1e0" stroke="#7a0010" stroke-width=".8">75K</text></svg>`;
    if (kind === 'b') return `<svg viewBox="0 0 100 100"${C} role="img" aria-label="Берсерк · 88 000"><defs><linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#2a0306"/><stop offset="1" stop-color="#0a0002"/></linearGradient><linearGradient id="${id}e" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#ff2d2d"/><stop offset=".5" stop-color="#ffd27a"/><stop offset="1" stop-color="#ff6a3d"/></linearGradient></defs>
      <path d="M50 4 C70 22 88 38 88 60 A38 36 0 0 1 12 60 C12 38 30 22 50 4 Z" fill="url(#${id}s)" stroke="#ff2d2d" stroke-width="3.5"/><path d="M50 13 C66 28 80 41 80 59 A30 28 0 0 1 20 59 C20 41 34 28 50 13 Z" fill="none" stroke="#ff9a3d" stroke-opacity=".35"/>
      <path id="${id}p" d="M50 56 C40 44 26 44 26 56 C26 68 40 68 50 56 C60 44 74 44 74 56 C74 68 60 68 50 56 Z" fill="none" stroke="url(#${id}e)" stroke-width="3.2"/>
      <circle r="4.6" fill="#ff2d2d" stroke="#fff" stroke-width=".8"><animateMotion dur="3s" repeatCount="indefinite"><mpath href="#${id}p"/></animateMotion></circle><circle r="4.6" fill="#ffb040" stroke="#fff" stroke-width=".8"><animateMotion dur="3s" begin="-1.5s" repeatCount="indefinite"><mpath href="#${id}p"/></animateMotion></circle>
      <path d="M38 30 L42 36 L50 31 L58 36 L62 30 L60 40 L40 40 Z" fill="#ffd27a" stroke="#7a3a00" stroke-width=".8"/>
      <text x="50" y="86" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="900" font-size="11" letter-spacing="1" fill="#ffe6c0">88 000</text></svg>`;
    return `<svg viewBox="0 0 100 100"${C} role="img" aria-label="Корона Берсерка · победа"><defs><radialGradient id="${id}m" cx="50%" cy="40%"><stop stop-color="#4a050c"/><stop offset="1" stop-color="#0d0103"/></radialGradient></defs>
      <path d="M28 30 Q10 22 12 4 Q22 18 36 22 Z" fill="#1a0306" stroke="#ff2d2d" stroke-width="1.5"/><path d="M72 30 Q90 22 88 4 Q78 18 64 22 Z" fill="#1a0306" stroke="#ff2d2d" stroke-width="1.5"/>
      <circle cx="50" cy="50" r="36" fill="url(#${id}m)" stroke="#ff2d2d" stroke-width="3.5"/>
      ${Array.from({ length: 18 }, (_, i) => { const q = i * Math.PI / 9, P = (r, d) => `${(50 + Math.cos(q + d) * r).toFixed(1)} ${(50 + Math.sin(q + d) * r).toFixed(1)}`; return `<path d="M${P(36, 0)} L${P(42, .08)} L${P(36, .17)} Z" fill="#ff2d2d"/>`; }).join('')}
      <path d="M30 50 Q32 30 50 26 Q68 30 70 50 Q66 64 50 66 Q34 64 30 50 Z" fill="#050001"/>
      <circle cx="41" cy="47" r="3.6" fill="#ff3a1a"><animate attributeName="r" values="3;5;3" dur="1.2s" repeatCount="indefinite"/></circle><circle cx="59" cy="47" r="3.6" fill="#ff9a3d"><animate attributeName="r" values="3;5;3" dur="1.2s" repeatCount="indefinite"/></circle>
      <path d="M18 76 L82 76 L76 86 L82 96 L18 96 L24 86 Z" fill="#ff2d2d" stroke="#4a0008"/><text x="50" y="91" text-anchor="middle" font-family="system-ui,sans-serif" font-weight="900" font-size="12" fill="#fff">100K</text></svg>`;
  }
  function evoBadgeSVG(id) {
    if (id === 'hc75') return hcBadgeSVG('a', 'evo-badge');
    if (id === 'hc88') return hcBadgeSVG('b', 'evo-badge');
    if (id === 'hc75') {
      const teeth = Array.from({ length: 16 }, (_, k) => `<rect x="30" y="1.5" width="4" height="6" rx="1" transform="rotate(${k * 22.5} 32 32)"/>`).join('');
      return `<svg viewBox="0 0 64 72" class="evo-badge"><defs><linearGradient id="ebm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff4d0"/><stop offset=".45" stop-color="#ff2d2d"/><stop offset="1" stop-color="#7a0808"/></linearGradient><radialGradient id="ebc" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="#3a0a10"/><stop offset="1" stop-color="#0c0406"/></radialGradient></defs>
        <g fill="url(#ebm)">${teeth}</g><circle cx="32" cy="32" r="25" fill="url(#ebm)"/><circle cx="32" cy="32" r="21.5" fill="url(#ebc)"/>
        <path d="M32 14c6 6 10 10 10 17a10 10 0 0 1-20 0c0-7 4-11 10-17z" fill="url(#ebm)"/><path d="M32 22c3 3 5 6 5 9a5 5 0 0 1-10 0c0-3 2-6 5-9z" fill="#2a0004"/><path d="M20 20l-4-6M44 20l4-6M18 30h-6M46 30h6" stroke="url(#ebm)" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M8 56h48l-5 6 5 6H8l5-6z" fill="url(#ebm)"/><path d="M13 56h38v12H13z" fill="#1a0404" opacity=".85"/><text x="32" y="65" text-anchor="middle" font-family="Russo One, sans-serif" font-size="8.5" fill="#ffd0c0">75 000</text></svg>`;
    }
    const k = { duo50n: 'twin', duo50h: 'shield', duo50m: 'const' }[id]; if (!k) return '';
    const P = { twin: ['#7affd0', '#22e6ff', '#0a3a34', 'ОБЫЧНЫЙ'], shield: ['#c8fff0', '#2ab8a0', '#062a2a', 'СЛОЖНЫЙ'], const: ['#ffe08a', '#b26bff', '#1a0a3a', 'БЕЗУМИЕ'] }[k], g = 'edb' + k;
    const sym = k === 'twin' ? `<circle cx="40" cy="38" r="15" fill="none" stroke="url(#${g})" stroke-width="2.5"/><path d="M40 23a7.5 7.5 0 0 1 0 15a7.5 7.5 0 0 0 0 15a15 15 0 0 1 0-30z" fill="url(#${g})"/><circle cx="40" cy="30.5" r="2.2" fill="#0a3a34"/><circle cx="40" cy="45.5" r="2.2" fill="url(#${g})"/>`
      : k === 'shield' ? `<path d="M40 21l15 6v10c0 9-6 16-15 19-9-3-15-10-15-19V27z" fill="#082a2a" stroke="url(#${g})" stroke-width="2.5"/><path d="M33 33l14 12M47 33L33 45" stroke="url(#${g})" stroke-width="2.6" stroke-linecap="round"/>`
      : `<path d="M28 30l7 5 5-9 5 9 7-5-3 15H31z" fill="url(#${g})"/><g fill="#fff"><circle cx="26" cy="48" r="1.4"/><circle cx="40" cy="52" r="1.7"/><circle cx="54" cy="48" r="1.4"/></g><path d="M26 48L40 52L54 48" stroke="#fff" stroke-opacity=".6" stroke-width=".8" fill="none"/>`;
    const laurel = side => Array.from({ length: 6 }, (_, i) => { const a = (side ? -1 : 1) * (.5 + i * .32), x = 40 + Math.sin(a) * 31, y = 40 + Math.cos(a) * 31; return `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="2.6" ry="5.5" transform="rotate(${(-a * 57.3 + (side ? 30 : -30)).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})" fill="url(#${g})"/>`; }).join('');
    return `<svg viewBox="0 0 80 96" class="evo-badge"><defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="${P[0]}"/><stop offset="1" stop-color="${P[1]}"/></linearGradient><radialGradient id="${g}c" cx=".5" cy=".4" r=".6"><stop offset="0" stop-color="${P[2]}"/><stop offset="1" stop-color="#03060c"/></radialGradient></defs>
      ${laurel(0)}${laurel(1)}<circle cx="40" cy="40" r="23" fill="url(#${g})"/><circle cx="40" cy="40" r="20" fill="url(#${g}c)"/>${sym}
      <path d="M10 72h60l-6 7 6 7H10l6-7z" fill="url(#${g})"/><path d="M16 72h48v14H16z" fill="#06131a" opacity=".88"/><text x="40" y="82.5" text-anchor="middle" font-family="Russo One, sans-serif" font-size="7.5" fill="${P[0]}">${P[3]}</text></svg>`;
  }
