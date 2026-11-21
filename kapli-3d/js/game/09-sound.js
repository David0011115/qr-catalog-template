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
    // ---- 2.7 music: its own theme for the main menu and for every mode (owner). All of it is made right here in Web Audio, no files.
    // Half of them keep the game's neon synthwave, the others are other genres (chiptune, drum'n'bass, house, march, taiko…).
    // A theme: chords one per bar, a pad, a bass line, drums, an arpeggio and a lead melody (in eighths: a note, «.» rest, «-» hold).
    // While a boss is on the field every theme adds its tense layer: a little faster, a 16th ostinato, more drums.
    const NOTE = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
    const nm = s => { const m = /^([A-G][#b]?)(-?\d)$/.exec(s); return m ? 12 * (+m[2] + 1) + NOTE[m[1]] : 0; };
    const chd = s => s.split(' ').map(nm);
    const mel = bars => bars.join(' ').trim().split(/\s+/).map(t => t === '.' ? 0 : t === '-' ? -1 : nm(t));
    const hz = m => 440 * Math.pow(2, (m - 69) / 12);
    const D4 = { k: 'x...x...x...x...', s: '....x.......x...', h: '.x.x.x.x.x.x.x.x' };
    const THEMES = {
      // main menu: dreamy, slow, no drums — soft pads, a quiet arpeggio and a bell melody
      menu: { bpm: 80, chords: ['A3 C4 E4 G4', 'F3 A3 C4 E4', 'C3 E3 G3 B3', 'G3 B3 D4 E4', 'A3 C4 E4 G4', 'F3 A3 C4 E4', 'D3 F3 A3 C4', 'E3 A3 B3 D4'],
        pad: { type: 'sawtooth', vol: .028, lp: 800, att: .9 }, arp: { type: 'triangle', vol: .02, every: 2, oct: 12, pat: 'up' },
        bass: { type: 'sine', vol: .05, lp: 400, pat: 'x...............', oct: -12, len: 14 },
        lead: { type: 'sine', vol: .045, notes: mel(['E5 - - - D5 - C5 -', 'C5 - - - A4 - - -', 'G4 - - - B4 - C5 -', 'D5 - - - - - . .', 'E5 - - - G5 - E5 -', 'F5 - - - E5 - C5 -', 'D5 - - - C5 - A4 -', 'B4 - - - - - . .']) } },
      // «Классика»: the game's synthwave, driving
      classic: { bpm: 104, chords: ['D3 F3 A3', 'A#2 D3 F3', 'F3 A3 C4', 'C3 E3 G3', 'D3 F3 A3', 'A#2 D3 F3', 'F3 A3 C4', 'C3 E3 G3'], drums: D4,
        pad: { type: 'sawtooth', vol: .03, lp: 1400, att: .4 }, bass: { type: 'sawtooth', vol: .065, lp: 420, pat: 'x.x.x.x.x.x.x.ox', oct: -12 },
        lead: { type: 'sawtooth', vol: .03, lp: 2200, det: 7, notes: mel(['A4 . D5 . F5 - E5 D5', 'D5 - - . F5 . G5 .', 'A5 - - . G5 F5 E5 .', 'E5 - - - . . . .', 'A4 . D5 . F5 - A5 .', 'A#5 - A5 - G5 . F5 .', 'F5 - E5 - C5 . E5 .', 'D5 - - - . . . .']) } },
      // «На время»: drum'n'bass — a race
      timed: { bpm: 172, chords: ['E3 G3 B3 D4', 'C3 E3 G3 B3', 'G3 B3 D4', 'D3 F#3 A3'], drums: { k: 'x.........x.....', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx' },
        pad: { type: 'sawtooth', vol: .022, lp: 1000, att: .3 }, bass: { type: 'sawtooth', vol: .07, lp: 280, pat: 'x.......x.......', oct: -12, len: 7 },
        arp: { type: 'triangle', vol: .02, every: 1, oct: 24, pat: 'up' },
        lead: { type: 'square', vol: .022, lp: 2600, notes: mel(['B4 . . . E5 . D5 .', 'E5 . G5 . . . F#5 .', 'D5 - - - B4 - - -', 'A4 . B4 . D5 . F#5 .']) } },
      // «Выживание»: dark and tense
      survival: { bpm: 96, chords: ['C3 D#3 G3', 'G#2 C3 D#3', 'F3 G#3 C4', 'G3 B3 D4'], drums: { k: 'x.....x...x.....', t: '............t.t.', h: '..x...x...x...x.' },
        pad: { type: 'sawtooth', vol: .03, lp: 600, att: .6 }, bass: { type: 'square', vol: .045, lp: 500, pat: 'x.x.x.x.x.x.x.x.', oct: -12 },
        lead: { type: 'triangle', vol: .05, notes: mel(['G4 - - . D#4 - - .', 'C4 - - - . . . .', 'G#4 - - . G4 - F4 .', 'D4 - - - - - . .']) } },
      // «Только деление»: chiptune, playful
      split: { bpm: 132, chords: ['C4 E4 G4', 'G3 B3 D4', 'A3 C4 E4', 'F3 A3 C4'], drums: { k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.' }, chip: true,
        bass: { type: 'square', vol: .04, lp: 900, pat: 'x.o.x.o.x.o.x.o.', oct: -12 }, arp: { type: 'square', vol: .013, every: 1, oct: 24, pat: 'updown', lp: 3500 },
        lead: { type: 'square', vol: .026, lp: 4000, notes: mel(['C5 . E5 G5 . E5 C5 .', 'D5 . G5 . B5 . G5 .', 'A5 . E5 . C5 . E5 A5', 'F5 . A5 . G5 . E5 .']) } },
      // «Захват короны»: royal march — fanfare brass, snare rolls, timpani
      crown: { bpm: 110, chords: ['D3 F#3 A3', 'G3 B3 D4', 'A3 C#4 E4', 'B2 D3 F#3', 'G3 B3 D4', 'A3 C#4 E4', 'D3 F#3 A3', 'D3 F#3 A3'], drums: { k: 'x.......x.......', s: '....x..x....x.xx', t: 'x.......x.......' },
        pad: { type: 'sawtooth', vol: .026, lp: 1300, att: .3 }, bass: { type: 'sawtooth', vol: .06, lp: 500, pat: 'x...x...x...x...', oct: -12, len: 3 },
        lead: { type: 'sawtooth', vol: .034, lp: 1800, det: 9, att: .03, notes: mel(['D5 . . F#5 A5 - - .', 'B5 - A5 - G5 . . .', 'E5 . . A5 C#6 - B5 A5', 'F#5 - - - . . . .', 'G5 - B5 - D6 - - B5', 'A5 - - E5 C#5 - E5 .', 'D5 - F#5 - A5 - - -', 'D6 - - - - - . .']) } },
      // «Случайный билд»: glitchy — the arpeggio picks random chord notes every loop
      rbuild: { bpm: 120, chords: ['F#3 A3 C#4', 'D3 F#3 A3', 'A3 C#4 E4', 'E3 G#3 B3'], drums: { k: 'x..x..x...x..x..', s: '....x.......x...', h: 'rand' },
        pad: { type: 'sawtooth', vol: .024, lp: 900, att: .2 }, bass: { type: 'sawtooth', vol: .06, lp: 450, pat: 'x..x..x...x..x..', oct: -12 },
        arp: { type: 'square', vol: .02, every: 1, oct: 12, pat: 'rand', lp: 3000 } },
      // «Командный бой»: a stadium anthem — stomp and clap
      team: { bpm: 116, chords: ['E3 G3 B3', 'C3 E3 G3', 'G3 B3 D4', 'D3 F#3 A3'], drums: { k: 'x...x...x...x...', c: '....c.......c...', h: '..x...x...x...x.' },
        pad: { type: 'sawtooth', vol: .03, lp: 1600, att: .3 }, bass: { type: 'sawtooth', vol: .06, lp: 450, pat: 'x.x.x.x.x.x.x.x.', oct: -12 },
        lead: { type: 'sawtooth', vol: .03, lp: 2400, det: 6, notes: mel(['E5 . G5 . A5 . B5 -', 'G5 - - . E5 . . .', 'D5 . E5 . G5 . A5 .', 'F#5 - - - . . . .']) } },
      // «Охота на Колосса»: epic and heavy — taiko, low brass
      giant: { bpm: 88, chords: ['D3 F3 A3', 'A#2 D3 F3', 'G2 A#2 D3', 'A2 C#3 E3'], drums: { k: 'x.......x.......', t: 'x.....x.x...x...' },
        pad: { type: 'sawtooth', vol: .032, lp: 1100, att: .5 }, bass: { type: 'sawtooth', vol: .07, lp: 300, pat: 'x.......x.......', oct: -12, len: 7 },
        lead: { type: 'sawtooth', vol: .036, lp: 1200, det: 10, att: .05, notes: mel(['D4 - - - F4 - E4 -', 'D4 - - - A#3 - - -', 'G3 - A#3 - D4 - F4 -', 'E4 - - - C#4 - - -']) } },
      // «Хардкор»: heavy and fast — power chords, a hard kick, a driving 16th bass
      hardcore: { bpm: 140, chords: ['E2 B2 E3', 'F2 C3 F3', 'E2 B2 E3', 'D2 A2 D3'], drums: { b: 'x...x...x...x...', s: '....x.......x...', h: 'xxxxxxxxxxxxxxxx' },
        pad: { type: 'sawtooth', vol: .032, lp: 900, att: .1 }, bass: { type: 'sawtooth', vol: .055, lp: 650, pat: 'xxxxxxxxxxxxxxxx', oct: 0, len: .9 },
        lead: { type: 'sawtooth', vol: .03, lp: 3000, det: 12, notes: mel(['E5 . . E5 F5 . E5 D5', 'C5 - - . B4 . C5 .', 'E5 . . E5 G5 . F5 E5', 'D5 - - - B4 - - -']) } },
      // «Захват территории»: house — offbeat bass, open hats, chord stabs
      territory: { bpm: 124, chords: ['A3 C4 E4', 'G3 B3 D4', 'F3 A3 C4', 'G3 B3 D4'], drums: { k: 'x...x...x...x...', o: '..o...o...o...o.', c: '....c.......c...' },
        bass: { type: 'sawtooth', vol: .06, lp: 600, pat: '..x...x...x...x.', oct: -12 }, arp: { type: 'sawtooth', vol: .018, every: 1, oct: 12, pat: 'stab', stab: '..x...x..x..x...', lp: 2200 },
        lead: { type: 'triangle', vol: .045, notes: mel(['E5 . A5 . C6 . B5 A5', 'G5 . . . D5 . . .', 'F5 . A5 . C6 . A5 .', 'B5 - - - G5 - - -']) } },
      // «Спина к спине»: epic co-op — big pad, running arpeggio, heroic lead
      duoback: { bpm: 128, chords: ['C3 D#3 G3', 'G#2 C3 D#3', 'D#3 G3 A#3', 'A#2 D3 F3'], drums: { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', t: '..............tt' },
        pad: { type: 'sawtooth', vol: .03, lp: 1500, att: .4 }, bass: { type: 'sawtooth', vol: .06, lp: 450, pat: 'x.x.x.x.x.x.x.x.', oct: -12 },
        arp: { type: 'triangle', vol: .018, every: 1, oct: 24, pat: 'up' },
        lead: { type: 'sawtooth', vol: .03, lp: 2400, det: 8, notes: mel(['G5 - - - D#5 - C5 .', 'C5 - D5 - D#5 - G5 -', 'A#5 - - - G5 - D#5 .', 'F5 - - - - - . .']) } },
      // «Босс-рейд»: menacing — a 16th ostinato in the bass, toms
      raid: { bpm: 120, chords: ['B2 D3 F#3', 'G2 B2 D3', 'E3 G3 B3', 'F#3 A#3 C#4'], drums: { k: 'x.....x.x.....x.', t: '....t.......t...', h: '..x...x...x...x.' },
        pad: { type: 'sawtooth', vol: .03, lp: 800, att: .5 }, bass: { type: 'square', vol: .05, lp: 450, pat: 'x.xxx.x.x.xxx.x.', oct: -12 },
        lead: { type: 'triangle', vol: .05, notes: mel(['F#4 - - - B4 - A4 -', 'G4 - - - - - . .', 'E4 - G4 - B4 - D5 -', 'C#5 - - - A#4 - - -']) } },
      // «Королевская битва»: tense trance — rising arpeggio, the snare rolls up at the end of the loop
      royale: { bpm: 128, chords: ['F3 G#3 C4', 'C#3 F3 G#3', 'G#3 C4 D#4', 'D#3 G3 A#3'], drums: { k: 'x...x...x...x...', o: '..o...o...o...o.', s: '....x.......x...' }, rollLast: true,
        pad: { type: 'sawtooth', vol: .026, lp: 1200, att: .4 }, bass: { type: 'sawtooth', vol: .055, lp: 500, pat: '..x...x...x...x.', oct: -12 },
        arp: { type: 'triangle', vol: .02, every: 1, oct: 24, pat: 'up' },
        lead: { type: 'sawtooth', vol: .028, lp: 2200, det: 7, notes: mel(['C5 - - - G#4 - C5 -', 'C#5 - - - F5 - - -', 'D#5 - C5 - G#4 - C5 -', 'A#4 - - - - - . .']) } },
    };
    THEMES.ranked = THEMES.classic;
    let theme = 'menu', want = 'menu', boss = false, loop = 0;
    const T = () => THEMES[theme] || THEMES.classic;
    const bpmNow = () => T().bpm * (boss && theme !== 'menu' ? 1.06 : 1);
    let seed = 1; const srnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    function schedule() {
      if (!ctx || ctx.state !== 'running' || !save.settings.musVol) { if (ctx) nextT = ctx.currentTime + .1; return; }
      if (nextT < ctx.currentTime) nextT = ctx.currentTime + .05;
      while (nextT < ctx.currentTime + .25) {
        if (step % 16 === 0 && want !== theme) { theme = want; step = 0; loop = 0; }   // a new theme starts on a bar line, from its first bar
        playStep(step, nextT); nextT += 60 / bpmNow() / 4;
        step++; if (step >= T().chords.length * 16) { step = 0; loop++; }
      }
    }
    const drum = { k: (at, d) => tone(150, .22, { vol: .22, slide: .27, at, dest: d }),
      b: (at, d) => { tone(160, .2, { vol: .26, slide: .25, at, dest: d }); tone(90, .14, { type: 'sawtooth', vol: .05, slide: .5, lp: 300, at, dest: d }); },
      s: (at, d, chip) => noise(chip ? .08 : .16, { vol: .07, f: 1800, type: 'bandpass', at, dest: d }),
      c: (at, d) => { noise(.09, { vol: .07, f: 1200, type: 'bandpass', q: 1.2, at, dest: d }); noise(.12, { vol: .05, f: 1400, type: 'bandpass', q: 1.2, at: at + .012, dest: d }); },
      h: (at, d) => noise(.04, { vol: .028, f: 8000, type: 'highpass', at, dest: d }),
      o: (at, d) => noise(.16, { vol: .03, f: 7000, type: 'highpass', at, dest: d }),
      t: (at, d) => tone(110, .32, { vol: .16, slide: .55, at, dest: d }) };
    function playStep(st, t) {
      const th = T(), at = t - ctx.currentTime, L = th.chords.length, bar = Math.floor(st / 16), s16 = st % 16, ch = chd(th.chords[bar % L]), d = musG, six = 60 / bpmNow() / 4;
      if (st === 0) seed = 1 + loop * 7919;   // «Случайный билд»: a new random arpeggio every loop
      const P = th.pad; if (P && s16 === 0) ch.forEach((m, i) => tone(hz(m), six * 16, { type: P.type, vol: P.vol, attack: P.att || .4, lp: P.lp, detune: i * 4 - 4, at, dest: d }));
      const B = th.bass; if (B) { const c = B.pat[s16]; if (c !== '.') { const m = ch[0] + B.oct + (c === 'o' ? 12 : c === 'f' ? 7 : 0); tone(hz(m), six * (B.len || 1.8), { type: B.type, vol: B.vol, lp: B.lp, at, dest: d }); } }
      const A = th.arp; if (A && s16 % A.every === 0) {
        const n = ch.length, i = s16 / A.every;
        if (A.pat === 'stab') { if (A.stab[s16] === 'x') ch.forEach(m => tone(hz(m + A.oct), six * 1.2, { type: A.type, vol: A.vol, lp: A.lp, at, dest: d })); }
        else { const idx = A.pat === 'rand' ? Math.floor(srnd() * n * 2) : A.pat === 'updown' ? [0, 1, 2, 3, 2, 1][i % 6] % n : i % n;
          tone(hz(ch[idx % n] + A.oct + (idx >= n ? 12 : 0)), six * (A.every === 1 ? .9 : 1.6), { type: A.type, vol: A.vol, lp: A.lp, at, dest: d }); } }
      const Ld = th.lead; if (Ld && s16 % 2 === 0) { const N = Ld.notes, e = (bar * 8 + s16 / 2) % N.length, m = N[e];
        if (m > 0) { let len = 1; while (N[(e + len) % N.length] === -1 && len < 16) len++; tone(hz(m), six * 2 * len * .92, { type: Ld.type, vol: Ld.vol, lp: Ld.lp, detune: Ld.det || 0, attack: Ld.att || .01, at, dest: d }); } }
      const Dm = th.drums; if (Dm) for (const k in Dm) { const p = Dm[k]; let hit = p === 'rand' ? (s16 % 2 === 1 ? srnd() < .7 : srnd() < .25) : p[s16] !== '.';
        if (k === 's' && th.rollLast && bar === L - 1 && s16 >= 8) hit = true;
        if (hit) drum[k](at, d, th.chip); }
      if (boss && theme !== 'menu') {   // the tense layer: a 16th ostinato on the chord, a kick before the bar line, hats on every 16th
        tone(hz(ch[s16 % 2 ? 1 % ch.length : 0] + 24 + (s16 % 4 === 3 ? 7 : 0)), six * .9, { type: 'square', vol: .018, lp: 2500, at, dest: d });
        if (s16 === 14) drum.k(at, d); if (!(Dm && Dm.h === 'xxxxxxxxxxxxxxxx')) drum.h(at, d);
      }
    }
    // test build: a theme rendered off-line into samples (levels checked, previews made) — the live sound is put back afterwards
    async function renderOffline(name, secs = 16, bossOn = false) {
      const keep = { ctx, master, sfxG, musG, noiseBuf, theme, want, boss, step, loop };
      const oc = new OfflineAudioContext(1, Math.ceil(44100 * secs), 44100);
      try {
        ctx = oc; master = oc.createGain(); master.gain.value = .9; master.connect(oc.destination); musG = oc.createGain(); musG.gain.value = .55; musG.connect(master); sfxG = oc.createGain();
        noiseBuf = oc.createBuffer(1, 44100, 44100); const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
        theme = want = name; boss = bossOn; step = 0; loop = 0; let t = .05;
        while (t < secs - .6) { playStep(step, t); t += 60 / bpmNow() / 4; step++; if (step >= T().chords.length * 16) { step = 0; loop++; } }
      } finally { ({ ctx, master, sfxG, musG, noiseBuf, theme, want, boss, step, loop } = keep); }
      return (await oc.startRendering()).getChannelData(0);
    }
    // the game asks every half second: menu or a round, which mode, a boss on the field or not
    function setMood(m, modeId) { boss = m === 'boss'; want = m === 'menu' ? 'menu' : THEMES[modeId] ? modeId : 'classic'; }
    document.addEventListener('visibilitychange', () => { if (!ctx) return; if (document.hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {}); });
    // browsers allow sound only after the first touch or key press
    const unlock = () => { ensure(); };
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, unlock, { capture: true, passive: true }));
    return { ensure, apply, play, setMood, renderOffline, themes: () => Object.keys(THEMES) };
  })();
  document.addEventListener('click', e => { if (e.target.closest('.btn, .buy, .tab, .mode, .seg button')) Sound.play('click'); }, true);
  // turning a phone upright mid-round pauses the game (the rotate screen covers it)
  const portraitLock = matchMedia('(orientation: portrait) and (hover: none) and (pointer: coarse)');
  const onPortrait = () => { if (portraitLock.matches && running && !paused && !dying) setPause(true); };
  if (portraitLock.addEventListener) portraitLock.addEventListener('change', onPortrait); else if (portraitLock.addListener) portraitLock.addListener(onPortrait);
  function setPause(on) {
    if (!running || dying) return;
    if (DuoM.on && on) { DuoM.menu(); return; }   // a match for two cannot stop: the menu opens while the round goes on
    paused = on;
    if (on) { renderPauseInfo(); showCard('pauseCard'); $('overlay').hidden = false; setGameUi(false); $('resumeBtn').focus(); }
    else { $('overlay').hidden = true; setGameUi(true); }
  }
  $('pauseBtn').addEventListener('click', () => setPause(true));
  $('resumeBtn').addEventListener('click', () => setPause(false));
  $('quitBtn').addEventListener('click', () => { paused = false; $('overlay').hidden = true; setGameUi(true); finishRound('Раунд завершён досрочно', 0, false); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && running && !paused && !dying) setPause(true); });

