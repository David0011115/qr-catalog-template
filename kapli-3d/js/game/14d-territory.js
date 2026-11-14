  // ================= «Захват территории»: rules of the duo mode =================
  // The field is split by a straight border. It creeps toward the player with less mass; eating the other player makes it
  // jump toward the victim. Bots can be eaten only on your own side, and on the other side you are 15% slower.
  // Coordinates are the host's: the host's half is x < bx. Both phones keep the same bx (the host sends it).
  (() => {
    const BORDER_V = .012, DEAD = .03, JUMP = .06, LIMIT = .9, FOREIGN_K = .85;
    const MATCH_S = 240, OVERTIME_S = 30, WIN_SHARE = .8, TIE = .02;   // 4 minutes; 80% of the field wins at once; within ±2% at the end: +30 s, once
    let lastSide = 0, signT = 0, bx = 0, bxView = 0, pHome = -1, mesh = null, mat = null, flash = 0, limit = MATCH_S, ot = false;

    // eight more small bots, used only here: 24 in all, half of them come back on each half of the field
    [['Капелька', 'coward'], ['Росинка', 'farmer'], ['Брызг', 'coward'], ['Ириска', 'farmer'], ['Пузырь', 'normal'], ['Мятка', 'coward'], ['Искорка', 'farmer'], ['Шарик', 'normal']].forEach(([n, p], k) => {
      const o = makeOwner(n, 'bot', p); o.baseColor = BOT_COLORS[(k * 2 + 1) % BOT_COLORS.length]; o.tExtra = true; o.disabled = true;
      o.free = Array.from({ length: BOT_PARTS }, () => makeVis(new THREE.Color(o.baseColor)));
      bots.push(o); owners.push(o);
    });

    const active = () => DuoM.mode === 'territory';
    const sideAt = x => x < bx ? -1 : 1;
    const homeOf = o => o === player ? pHome : o === DuoM.rival ? -pHome : 0;
    const botHome = o => bots.indexOf(o) % 2 ? 1 : -1;
    // share of the round field left of the line x = b·R
    const leftShare = () => { const b = Math.max(-1, Math.min(1, bx / R)); return (Math.PI - Math.acos(b) + b * Math.sqrt(1 - b * b)) / Math.PI; };
    const myShare = () => pHome < 0 ? leftShare() : 1 - leftShare();

    // bots come back on their own half (by count: 12 and 12), wherever the border is now
    const spawnBot0 = spawnBot, safeSpot0 = safeSpot; let want = 0;
    safeSpot = d => {
      if (!want) return safeSpot0(d);
      for (let t = 0; t < 80; t++) {
        const [x, z] = randInArena(6);
        if (sideAt(x) === want && cells.every(c => Math.hypot(c.x - x, c.z - z) > d + cellR(c))) return [x, z];
      }
      return [bx + (want * R - bx) * .5, (Math.random() - .5) * R * .6];
    };
    spawnBot = o => {
      if (o.tExtra && mode !== 'territory') return;
      want = active() && !DuoM.guest ? botHome(o) : 0;
      try { spawnBot0(o); } finally { want = 0; }
    };

    // the border on the floor: your half tinted blue, the other pink, a bright moving line between them
    function makeMesh() {
      mat = decal(new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        uniforms: { uBx: { value: 0 }, uMe: { value: -1 }, uT: { value: 0 }, uR: { value: R }, uF: { value: 0 } },
        vertexShader: 'varying vec2 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
        fragmentShader: `uniform float uBx, uMe, uT, uR, uF; varying vec2 vP;
          void main(){
            float d = vP.x - uBx, mine = step(0.0, d * uMe);
            vec3 me = vec3(.13, .9, 1.0), foe = vec3(1.0, .22, .42), tint = mix(foe, me, mine);
            float hatch = (1.0 - mine) * step(.72, fract((vP.x + vP.y) * .07));   // the other half: slanted stripes
            float line = exp(-abs(d) * .9), halo = exp(-abs(d) * .07);
            float run = .55 + .45 * sin(vP.y * .35 - uT * 4.0);
            float rim = smoothstep(uR, uR * .9, length(vP));
            vec3 col = mix(tint, vec3(1.0), line * .6);
            float a = (mix(.17, .12, mine) + hatch * .16 + halo * .14 + line * (.55 + .35 * run) + uF * halo * .5) * rim;
            gl_FragColor = vec4(col, a);
          }` }));
      mesh = new THREE.Mesh(new THREE.CircleGeometry(1, 128), mat);
      mesh.rotation.x = -Math.PI / 2; mesh.position.y = .06; mesh.renderOrder = 2;
    }

    DuoM.rules.territory = {
      arena: 1.5,   // 2.5: was ×2 — too much empty field for two
      pre(role) { lastSide = 0; bx = bxView = 0; flash = 0; limit = MATCH_S; ot = false; pHome = role === 'host' ? -1 : 1; },
      begin() {
        if (!mesh) makeMesh();
        mesh.scale.setScalar(R); mat.uniforms.uR.value = R; mat.uniforms.uMe.value = pHome; mat.uniforms.uBx.value = 0;
        scene.add(mesh);
        setTimeout(() => { if (active()) toast('Ешь ботов на своей (голубой) стороне. Чем ты тяжелее, тем дальше граница'); }, 2400);
      },
      end() { if (mesh) scene.remove(mesh); const el = document.getElementById('terrSign'); if (el) el.classList.remove('show'); },
      // a respawn spot well inside your own half, toward your edge
      spawnX: o => bx + (homeOf(o) * R - bx) * .6,
      tick(dt) {   // host only
        const a = total(player), b = total(DuoM.rival), s = a + b;
        if (s > 0) {
          const rel = (a - b) / s;   // the host's lead: plus pushes the border right (into the other half)
          if (Math.abs(rel) > DEAD) bx += Math.sign(rel) * Math.min(1, (Math.abs(rel) - DEAD) * 2.5) * BORDER_V * R * dt;
        }
        bx = Math.max(-LIMIT * R, Math.min(LIMIT * R, bx));
        // the end of the match (the host decides for both)
        if (dying) return;
        const hs = leftShare();
        if (hs >= WIN_SHARE) { DuoM.result('host', hs, 'early'); return; }
        if (hs <= 1 - WIN_SHARE) { DuoM.result('guest', hs, 'early'); return; }
        if (stats.time < limit) return;
        if (Math.abs(hs - .5) > TIE) DuoM.result(hs > .5 ? 'host' : 'guest', hs, 'time');
        else if (!ot) { ot = true; limit += OVERTIME_S; toast('Почти поровну! Ещё 30 секунд'); Sound.play('level'); }
        else DuoM.result('draw', hs, 'time');
      },
      timer: () => `⏱ ${fmtTime(Math.max(0, limit - stats.time))}${ot ? ' · +30 с' : ''}`,
      finish(me, sh, why) {   // personal stats of this mode, then the title of the result screen
        const p = Math.round(sh * 100);
        save.duo = save.duo || {};
        const t = save.duo.territory = Object.assign({ wins: 0, losses: 0, draws: 0, games: 0, best: 0, sum: 0, top: [] }, save.duo.territory);
        t.games++; t[me === 'win' ? 'wins' : me === 'loss' ? 'losses' : 'draws']++; t.best = Math.max(t.best, p); t.sum += p;
        t.top.push({ p, r: me, n: String(DuoM.rival.name || '').slice(0, 24), d: Date.now(), e: why === 'early' ? 1 : 0 });
        t.top.sort((a, b) => b.p - a.p || b.d - a.d); t.top.length = Math.min(5, t.top.length);
        persist(); stats.duoHero = { v: p, l: 'твоя доля поля, %' };
        if (!DuoM.practice) Net.duoTerritory(me, p);   // the rating of the mode (each player sends their own match)
        return { bonus: me === 'win' ? 60 : me === 'draw' ? 25 : 10,
          title: me === 'win' ? (why === 'early' ? `Досрочная победа: ${p}% поля!` : `Победа! Твоя территория ${p}%`) : me === 'loss' ? `Поражение: у тебя ${p}% поля` : `Ничья: ${p}% на ${100 - p}%` };
      },
      statsHtml() {   // the room screen: your record in this mode and your best matches
        const t = (save.duo || {}).territory;
        if (!t || !t.games) return '<p class="hint duo-stats" style="margin:0">Здесь появится твоя статистика: победы, поражения, доля поля и лучшие матчи.</p>';
        const R_ = { win: 'победа', loss: 'поражение', draw: 'ничья' };
        return `<div class="duo-stats"><div class="duo-st-row"><span>Победы <b>${t.wins}</b></span><span>Поражения <b>${t.losses}</b></span><span>Ничьи <b>${t.draws}</b></span><span>Средняя доля <b>${Math.round(t.sum / t.games)}%</b></span><span>Лучшая <b>${t.best}%</b></span></div>` +
          `<ol class="duo-top">${t.top.map(m => `<li><b>${m.p}%</b> · ${R_[m.r]}${m.e ? ' досрочно' : ''} · с ${escHtml(m.n)} · ${new Date(m.d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}</li>`).join('')}</ol></div>`;
      },
      lost(o, eater) {   // eating the other player: the border jumps toward the one who was eaten
        if (!eater || (eater !== player && eater !== DuoM.rival) || eater === o) return;
        bx += (o === player ? -1 : 1) * JUMP * R; bx = Math.max(-LIMIT * R, Math.min(LIMIT * R, bx)); flash = 1;
        toast(o === player ? 'Граница прыгнула к тебе!' : 'Граница прыгнула вперёд!');
      },
      snap(s) { s.bx = Math.round(bx * 10) / 10; s.lim = limit; },
      apply(s) {
        if (s.lim && s.lim !== limit) { const more = s.lim > limit && stats.time > 1; limit = s.lim; if (more && !ot) { ot = true; toast('Почти поровну! Ещё 30 секунд'); Sound.play('level'); } } if (s.bx !== undefined) { if (s.bx * pHome < bx * pHome - JUMP * R * .5 && stats.time > 3) flash = 1; bx = s.bx; } },
      view(dt) {
        this.cross(dt);
        bxView += (bx - bxView) * Math.min(1, dt * 6); flash = Math.max(0, flash - dt * 1.5);
        if (mat) { mat.uniforms.uBx.value = bxView; mat.uniforms.uT.value = stats.time; mat.uniforms.uF.value = flash; }
      },
      eatBlock(a, b) {   // your own bites of bots only count on your side
        const h = homeOf(a.owner);
        return !!h && b.owner.kind === 'bot' && sideAt(b.x) !== h;
      },
      speedK(c) { const h = homeOf(c.owner); return h && sideAt(c.x) !== h ? FOREIGN_K : 1; },
      cross(dt) {   // a short sign in the middle of the screen when your drop crosses the border
        if (!player.cells.length) { lastSide = 0; return; }
        const sd = sideAt(centerOf(player)[0]);
        if (lastSide && sd !== lastSide) {
          let el = document.getElementById('terrSign');
          if (!el) { el = document.createElement('div'); el.id = 'terrSign'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
          const mine = sd === pHome;
          el.className = mine ? 'mine' : 'foe'; el.style.removeProperty('--tc');
          el.innerHTML = mine ? '<b>Твоя территория</b><small>здесь можно есть ботов</small>' : '<b>Чужая территория</b><small>−15% скорости · ботов не съесть</small>';
          void el.offsetWidth; el.classList.add('show');
          clearTimeout(signT); signT = setTimeout(() => el.classList.remove('show'), 1700);
        }
        lastSide = sd;
      },
      chip() {
        const p = Math.round(myShare() * 100);
        return `Твоя территория ${p}%<span class="bar wide"><span style="width:${p}%"></span></span>`;
      },
      share: myShare,
      homeSide: (o, x) => sideAt(x) === homeOf(o),
      dbg(b, l) { if (!TEST_MODE) return; if (b !== undefined) bx = b * R; if (l !== undefined) limit = l; },   // test build only
      mini(g, size, s) {   // the minimap: your half tinted, the border as a bright line
        const x = size / 2 + bxView * s, h = Math.sqrt(Math.max(0, R * R - bxView * bxView)) * s, c = size / 2;
        g.save(); g.beginPath(); g.arc(c, c, R * s, 0, Math.PI * 2); g.clip();
        g.fillStyle = 'rgba(34,230,255,.16)'; g.fillRect(pHome < 0 ? 0 : x, 0, pHome < 0 ? x : size - x, size);
        g.fillStyle = 'rgba(255,79,216,.13)'; g.fillRect(pHome < 0 ? x : 0, 0, pHome < 0 ? size - x : x, size);
        g.restore();
        g.strokeStyle = '#fff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, c - h); g.lineTo(x, c + h); g.stroke();
      },
    };
  })();
