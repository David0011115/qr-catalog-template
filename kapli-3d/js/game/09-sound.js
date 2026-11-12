  // ================= sound and music (Web Audio, generated in the game) =================
  const Sound = (() => {
    let ctx = null, master, sfxG, musG, noiseBuf = null, mood = 'menu', nextT = 0, step = 0, timer = null;
    const last = {};
    function apply() { if (!ctx) return; sfxG.gain.value = save.settings.sfxVol; musG.gain.value = save.settings.musVol * .55; }
    function ensure() {
      if (!ctx) {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return null;
        try { ctx = new AC(); } catch (e) { return null; }
        master = ctx.createGain(); master.gain.value = .9; master.connect(ctx.destination);
        sfxG = ctx.createGain(); musG = ctx.createGain(); sfxG.connect(master); musG.connect(master);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        apply(); timer = setInterval(schedule, 60);
      }
      if (ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {});
      return ctx;
    }
    function tone(freq, dur, o = {}) {
      if (!ctx) return;
      const t = ctx.currentTime + (o.at || 0), osc = ctx.createOscillator(), g = ctx.createGain();
      osc.type = o.type || 'sine'; osc.frequency.setValueAtTime(freq, t);
      if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * o.slide), t + dur);
      if (o.detune) osc.detune.value = o.detune;
      const v = o.vol ?? .2, a = o.attack ?? .005;
      g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      let out = g;
      if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; g.connect(f); out = f; }
      osc.connect(g); out.connect(o.dest || sfxG); osc.start(t); osc.stop(t + dur + .05);
    }
    function noise(dur, o = {}) {
      if (!ctx) return;
      const t = ctx.currentTime + (o.at || 0), src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
      src.buffer = noiseBuf; f.type = o.type || 'lowpass'; f.frequency.setValueAtTime(o.f || 2000, t); f.Q.value = o.q || .7;
      if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
      const v = o.vol ?? .2; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + (o.attack || .005)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(o.dest || sfxG); src.start(t, Math.random() * .5); src.stop(t + dur + .05);
    }
    const arp = (notes, gap, o) => notes.forEach((f, i) => tone(f, o.dur || .25, { ...o, at: i * gap }));
    const SFX = {
      crumb: () => tone(1100 + Math.random() * 600, .05, { vol: .035 }),
      eat: () => { tone(260, .14, { type: 'triangle', vol: .22, slide: 2.4 }); tone(520, .12, { vol: .08, slide: 2, at: .03 }); },
      eaten: () => tone(420, .55, { type: 'sawtooth', vol: .14, slide: .22, lp: 1800 }),
      split: () => noise(.2, { vol: .22, f: 600, sweep: 4000, type: 'bandpass', q: 1.5 }),
      dash: () => { noise(.28, { vol: .2, f: 3000, sweep: 500, type: 'bandpass' }); tone(200, .2, { type: 'triangle', vol: .08, slide: 3 }); },
      eject: () => tone(240, .09, { type: 'square', vol: .06, slide: .55, lp: 1500 }),
      spike: () => { noise(.4, { vol: .32, f: 1200, sweep: 200 }); tone(140, .35, { type: 'sawtooth', vol: .12, slide: .4, lp: 900 }); },
      bonus: () => arp([880, 1320, 1760], .06, { vol: .1, dur: .16 }),
      boss: () => { tone(70, 1.2, { type: 'sawtooth', vol: .16, slide: .8, lp: 500 }); tone(72, 1.2, { type: 'sawtooth', vol: .12, slide: .8, lp: 500, detune: 12 }); noise(1, { vol: .06, f: 300 }); },
      bossDown: () => arp([523, 659, 784, 1047], .08, { type: 'triangle', vol: .14, dur: .28 }),
      teleport: () => { tone(300, .3, { type: 'sine', vol: .1, slide: 4 }); tone(1200, .3, { type: 'sine', vol: .06, slide: .25, at: .05 }); },
      combo: n => { const f = 440 * Math.pow(2, Math.min(n, 10) * 2 / 12); tone(f, .14, { type: 'square', vol: .06, lp: 3000 }); tone(f * 1.5, .18, { type: 'triangle', vol: .08, at: .06 }); },
      star: () => arp([1047, 1319, 1568, 2093], .05, { vol: .1, dur: .22 }),
      win: () => arp([523, 659, 784, 1047, 1319], .1, { type: 'triangle', vol: .14, dur: .4 }),
      lose: () => arp([392, 330, 262, 196], .13, { type: 'triangle', vol: .12, dur: .4 }),
      chest: () => { noise(.3, { vol: .12, f: 5000, type: 'highpass' }); arp([784, 988, 1175, 1568], .07, { vol: .09, dur: .3, at: .2 }); },
      record: () => arp([784, 988, 1175, 1568, 1976], .07, { type: 'triangle', vol: .13, dur: .22 }),
      promo: () => { arp([523, 659, 784, 1047], .08, { type: 'triangle', vol: .1, dur: .3 }); setTimeout(() => arp([1047, 1319, 1568, 2093], .07, { type: 'square', vol: .08, dur: .45 }), 360); setTimeout(() => arp([2093, 2637], .12, { type: 'triangle', vol: .07, dur: .6 }), 720); },
      rankup: () => { arp([523, 784, 1047, 1568], .09, { type: 'square', vol: .09, dur: .25 }); setTimeout(() => arp([1568, 2093], .1, { type: 'triangle', vol: .1, dur: .35 }), 380); },
      level: () => arp([659, 784, 988, 1319], .07, { type: 'square', vol: .06, dur: .25, lp: 3000 }),
      lookA: () => arp([660, 990, 1320], .05, { type: 'triangle', vol: .1, dur: .14 }),
      lookB: () => arp([1175, 880, 1568], .05, { type: 'square', vol: .06, dur: .12 }),
      lookC: () => { tone(520, .3, { type: 'sine', vol: .12, slide: 2 }); },
      click: () => tone(1300, .03, { type: 'square', vol: .025, lp: 4000 }),
    };
    const GAP = { crumb: 70, eat: 50, eject: 60, click: 40, spike: 120 };
    function play(name, arg) {
      if (!ctx || !save.settings.sfxVol || ctx.state !== 'running') return;
      const now = performance.now(); if (GAP[name] && now - (last[name] || 0) < GAP[name]) return; last[name] = now;
      try { SFX[name] && SFX[name](arg); } catch (e) {}
    }
    // ---- music: synthwave in A minor (Am – F – C – G), one bar per chord ----
    const CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]];
    const hz = m => 440 * Math.pow(2, (m - 69) / 12);
    const TEMPO = { menu: 84, game: 104, boss: 116 };
    function schedule() {
      if (!ctx || ctx.state !== 'running' || !save.settings.musVol) { if (ctx) nextT = ctx.currentTime + .1; return; }
      const sixteenth = 60 / TEMPO[mood] / 4;
      if (nextT < ctx.currentTime) nextT = ctx.currentTime + .05;
      while (nextT < ctx.currentTime + .25) { playStep(step, nextT); nextT += sixteenth; step = (step + 1) % 64; }
    }
    function playStep(st, t) {
      const at = t - ctx.currentTime, bar = Math.floor(st / 16), s16 = st % 16, ch = CHORDS[bar], d = musG, sixteenth = 60 / TEMPO[mood] / 4;
      if (s16 === 0) ch.forEach((m, i) => { tone(hz(m), sixteenth * 16, { type: 'sawtooth', vol: .035, attack: .5, lp: mood === 'menu' ? 900 : 1500, detune: i * 4 - 4, at, dest: d }); });
      if (s16 % 2 === 0) { const m = ch[(s16 / 2) % 3] + 12 + (s16 % 8 === 6 ? 12 : 0); tone(hz(m), sixteenth * 1.6, { type: 'triangle', vol: mood === 'menu' ? .03 : .045, at, dest: d }); }
      if (mood === 'menu') return;
      if (s16 % 2 === 0) tone(hz(ch[0] - 24), sixteenth * 1.8, { type: 'sawtooth', vol: .07, lp: 420, at, dest: d });
      if (s16 % 4 === 0) tone(150, .22, { vol: .22, slide: .27, at, dest: d });
      if (s16 === 4 || s16 === 12) noise(.16, { vol: .07, f: 1800, type: 'bandpass', at, dest: d });
      if (s16 % 2 === 1) noise(.04, { vol: .03, f: 8000, type: 'highpass', at, dest: d });
      if (mood === 'boss' && s16 % 1 === 0 && s16 % 2 === 1) tone(hz(ch[s16 % 3] + 24), sixteenth * .9, { type: 'square', vol: .022, lp: 2500, at, dest: d });
    }
    function setMood(m) { if (m !== mood) mood = m; }
    document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {}); });
    // browsers allow sound only after the first touch or key press
    const unlock = () => { ensure(); };
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, unlock, { capture: true, passive: true }));
    return { ensure, apply, play, setMood };
  })();
  document.addEventListener('click', e => { if (e.target.closest('.btn, .buy, .tab, .mode, .seg button')) Sound.play('click'); }, true);
  // turning a phone upright mid-round pauses the game (the rotate screen covers it)
  const portraitLock = matchMedia('(orientation: portrait) and (hover: none) and (pointer: coarse)');
  const onPortrait = () => { if (portraitLock.matches && running && !paused && !dying) setPause(true); };
  if (portraitLock.addEventListener) portraitLock.addEventListener('change', onPortrait); else if (portraitLock.addListener) portraitLock.addListener(onPortrait);
  function setPause(on) {
    if (!running || dying) return;
    paused = on;
    if (on) { renderPauseInfo(); showCard('pauseCard'); $('overlay').hidden = false; setGameUi(false); $('resumeBtn').focus(); }
    else { $('overlay').hidden = true; setGameUi(true); }
  }
  $('pauseBtn').addEventListener('click', () => setPause(true));
  $('resumeBtn').addEventListener('click', () => setPause(false));
  $('quitBtn').addEventListener('click', () => { paused = false; $('overlay').hidden = true; setGameUi(true); finishRound('Раунд завершён досрочно', 0, false); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused && !dying) setPause(true); });

