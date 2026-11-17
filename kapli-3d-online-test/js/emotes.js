/* «Капли 3D» chat emotes: glossy drops with the game's eyes. One file shared by the sample page and the game. */
(function (root) {
  const INK = '#1a0b2e';
  const DROP = 'M32 5C38.5 12 54 22.5 54 37.5A22 22 0 0 1 10 37.5C10 22.5 25.5 12 32 5Z';
  const E = {
    ':smile:': { n: 'Радость', c: ['#d4fcff', '#22e6ff', '#0a6f8a'] },
    ':sad:':   { n: 'Грусть',  c: ['#d8e4ff', '#4d7cff', '#18287a'] },
    ':angry:': { n: 'Злость',  c: ['#ffd3da', '#ff3b5c', '#7a0a20'] },
    ':laugh:': { n: 'Смех',    c: ['#ffe6c8', '#ff9a3d', '#97400a'] },
    ':love:':  { n: 'Любовь',  c: ['#ffd9f5', '#ff4fd8', '#7f1468'] },
    ':wow:':   { n: 'Удивление', c: ['#eddcff', '#b26bff', '#45188a'] },
    ':cool:':  { n: 'Круто',   c: ['#d6ffec', '#3dffa2', '#0d6e44'] },
    ':wink:':  { n: 'Подмигивание', c: ['#fff7cc', '#ffd23f', '#8f6200'] },
    ':king:':  { n: 'Король',  c: ['#e0dbff', '#6d5bff', '#24127a'] },
    ':yum:':   { n: 'Ням',     c: ['#f1ffcc', '#b9ff3d', '#4a7300'] },
    ':splat:': { n: 'Съели',   c: ['#e6f7ff', '#5cc8ff', '#13508a'] },
    ':gg:':    { n: 'GG',      c: ['#cffff7', '#2ec4b6', '#0a5a52'] },
    ':cake:':  { n: 'Торт', c: ['#fff0f8', '#ff9ad5', '#a3346f'], lock: true },   // birthday gift box: only owners can send it
    // «Хронос» series: four are crafted in the workshop, «Стоп-кадр» and «Ку-ку» come with the series' progress
    ':tick:':   { n: 'Тик-так',   c: ['#fff0c4', '#e8b05a', '#7a4a12'], lock: true },
    ':wait:':   { n: 'Жду',       c: ['#e4ecff', '#7f9bd8', '#2a3a7a'], lock: true },
    ':late:':   { n: 'Опоздал!',  c: ['#ffe0cc', '#ff7a3d', '#8a2a0a'], lock: true },
    ':windup:': { n: 'Заведён',   c: ['#f4ffd0', '#b9e03d', '#4f6a00'], lock: true },
    ':freeze:': { n: 'Стоп-кадр', c: ['#f2f2f6', '#a9a9ba', '#4a4a5c'], lock: true },
    ':cuckoo:': { n: 'Ку-ку',     c: ['#ffe6c8', '#c98a4b', '#5a3010'], lock: true },
  };
  const ORDER = Object.keys(E);
  const id = k => 'emo' + k.replace(/:/g, '');

  // shared gradients (inserted once into the page; never inside display:none, so every emote can reference them)
  function defs() {
    let g = '';
    for (const k of ORDER) { const [l, m, d] = E[k].c;
      g += `<radialGradient id="${id(k)}G" cx=".36" cy=".34" r=".78"><stop offset="0" stop-color="${l}"/><stop offset=".45" stop-color="${m}"/><stop offset="1" stop-color="${d}"/></radialGradient>`; }
    g += '<linearGradient id="emoGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff3a8"/><stop offset=".5" stop-color="#ffc21f"/><stop offset="1" stop-color="#b8740a"/></linearGradient>';
    return `<svg width="0" height="0" style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true" focusable="false"><defs>${g}</defs></svg>`;
  }

  // eyes in the game style: white ovals, dark pupils with a tiny glint
  const eye = (x, y, rx = 4.4, ry = 5.6, px = .6, py = .9, pr = 2.5) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#fff"/><circle cx="${x + px}" cy="${y + py}" r="${pr}" fill="${INK}"/><circle cx="${x + px - .9}" cy="${y + py - 1}" r=".8" fill="#fff"/>`;
  const eyes = (o = {}) => `<g class="e-eyes">${eye(25, 35, o.rx, o.ry, o.px, o.py, o.pr)}${eye(39, 35, o.rx, o.ry, o.px, o.py, o.pr)}</g>`;
  const happyEyes = '<g class="e-eyes" fill="none" stroke="' + INK + '" stroke-width="2.6" stroke-linecap="round"><path d="M21 37Q25 31 29 37"/><path d="M35 37Q39 31 43 37"/></g>';
  const blush = (o = .45) => `<ellipse cx="19.5" cy="43" rx="3.6" ry="2.2" fill="#ff6fae" opacity="${o}"/><ellipse cx="44.5" cy="43" rx="3.6" ry="2.2" fill="#ff6fae" opacity="${o}"/>`;
  const line = (d, w = 2.6) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const heart = (x, y, s, f = '#ff2d7a') => `<g transform="translate(${x} ${y}) scale(${s})"><path class="e-hp" d="M0 3C-4-1-4-5 0-3 4-5 4-1 0 3Z" fill="${f}" stroke="#fff" stroke-width=".35"/></g>`;

  const FACE = {
    ':smile:': () => eyes() + blush() + line('M24.5 44.5Q32 51.5 39.5 44.5'),
    ':sad:': () => line('M20.5 28.5L27.5 26.5', 2.2) + line('M43.5 28.5L36.5 26.5', 2.2) + eyes({ py: 2, ry: 5.2 }) + line('M25.5 49Q32 43.5 38.5 49')
      + '<path class="e-tear" d="M23 41.5C23 41.5 20.5 45 20.5 46.6A2.5 2.5 0 0 0 25.5 46.6C25.5 45 23 41.5 23 41.5Z" fill="#9fe8ff" stroke="#fff" stroke-width=".6"/>',
    ':angry:': () => eyes({ ry: 4, py: 1.2 }) + `<path d="M19 28.5L29 32.5M45 28.5L35 32.5" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>`
      + `<path d="M25 47.5Q32 43 39 47.5" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/>`,
    ':laugh:': () => happyEyes + `<path d="M22.5 42H41.5Q41 53.5 32 53.5Q23 53.5 22.5 42Z" fill="${INK}"/><path d="M26.5 50Q32 46.5 37.5 50Q35 53 32 53Q29 53 26.5 50Z" fill="#ff5f8f"/><path d="M23.5 42.2H40.5V44.4H23.5Z" fill="#fff"/>`
      + '<g class="e-tears"><path d="M17 36C17 36 14.5 39.5 14.5 41A2.5 2.5 0 0 0 19.5 41C19.5 39.5 17 36 17 36Z" fill="#9fe8ff"/><path d="M47 36C47 36 44.5 39.5 44.5 41A2.5 2.5 0 0 0 49.5 41C49.5 39.5 47 36 47 36Z" fill="#9fe8ff"/></g>',
    ':love:': () => `<g class="e-eyes">${heart(25, 34, 1.75, '#ff1f6e')}${heart(39, 34, 1.75, '#ff1f6e')}<circle cx="23" cy="32" r="1" fill="#fff"/><circle cx="37" cy="32" r="1" fill="#fff"/></g>` + blush(.55) + line('M25 45Q32 51 39 45'),
    ':wow:': () => line('M20.5 25.5Q25 22.5 29.5 25', 2.2) + line('M34.5 25Q39 22.5 43.5 25.5', 2.2) + eyes({ rx: 5.4, ry: 6.4, px: 0, py: 0, pr: 2 })
      + `<ellipse class="e-mouth" cx="32" cy="48" rx="3.6" ry="4.6" fill="${INK}"/>`,
    ':cool:': () => `<g class="e-glasses"><path d="M16 31.5H48V34.5Q47.5 41 40.5 41Q34 41 33.2 35H30.8Q30 41 23.5 41Q16.5 41 16 34.5Z" fill="${INK}"/><path d="M19.5 34L24 34" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/><path d="M36.5 34L41 34" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"/></g>`
      + line('M25.5 46.5Q33.5 50 39.5 44'),
    ':wink:': () => `<g class="e-eyes">${eye(25, 35)}<path class="e-wink" d="M35 36.5Q39 32 43 36.5" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/></g>` + blush()
      + `<path d="M24.5 44Q32 51 39.5 44" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"/><path d="M33.5 47.5Q35.5 52.5 38.5 49" fill="#ff5f8f" stroke="${INK}" stroke-width="1.4"/>`
      + '<path class="e-star" d="M49 22L50.3 25.2 53.5 26.5 50.3 27.8 49 31 47.7 27.8 44.5 26.5 47.7 25.2Z" fill="#fff6c8"/>',
    ':king:': () => `<g class="e-eyes" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"><path d="M21 35.5Q25 38.5 29 35.5"/><path d="M35 35.5Q39 38.5 43 35.5"/></g>` + blush(.35) + line('M25 44.5Q32 50 39 44.5')
      + '<g class="e-crown"><path d="M18.5 19.5L22.5 6.5 28 14.5 32 4 36 14.5 41.5 6.5 45.5 19.5Z" fill="url(#emoGold)" stroke="#8a5200" stroke-width="1.2" stroke-linejoin="round"/><rect x="18.5" y="18" width="27" height="4.4" rx="1.6" fill="url(#emoGold)" stroke="#8a5200" stroke-width="1.2"/><circle cx="32" cy="12.5" r="2" fill="#ff2d7a"/><circle cx="24.5" cy="14.8" r="1.4" fill="#22e6ff"/><circle cx="39.5" cy="14.8" r="1.4" fill="#3dffa2"/></g>',
    ':yum:': () => happyEyes + blush() + `<path class="e-mouth" d="M24 44Q32 53 40 44Q32 47 24 44Z" fill="${INK}"/><path class="e-tongue" d="M35 47Q40 50 41.5 45.5" fill="none" stroke="#ff5f8f" stroke-width="3" stroke-linecap="round"/>`
      + '<g class="e-food"><circle cx="50" cy="45" r="4.6" fill="#ffd23f" stroke="#fff6c8" stroke-width="1"/><circle cx="48.6" cy="43.6" r="1.3" fill="#fff"/></g>',
    ':splat:': () => '',   // custom body below
    ':cake:': () => '<path d="M14.5 29C21 25.5 43 25.5 49.5 29L50.5 32.5Q48 37.5 45 32.6Q42 38.5 38 32.8Q34.5 38.8 30.5 32.8Q27 38.5 23.5 32.6Q20 37.5 17 32.6Q15 34 13.6 32.5Z" fill="#fffaf2" stroke="#e7b8d2" stroke-width=".8"/>'
      + '<g class="e-sprinkles"><rect x="20" y="44" width="3.4" height="1.4" rx=".7" fill="#22e6ff" transform="rotate(30 21.7 44.7)"/><rect x="41" y="45" width="3.4" height="1.4" rx=".7" fill="#ffd23f" transform="rotate(-25 42.7 45.7)"/><rect x="30" y="54" width="3.4" height="1.4" rx=".7" fill="#3dffa2" transform="rotate(15 31.7 54.7)"/><rect x="46" y="38" width="3" height="1.3" rx=".6" fill="#b26bff"/><rect x="15" y="39" width="3" height="1.3" rx=".6" fill="#ff4f7a"/></g>'
      + `<g class="e-eyes" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"><path d="M22 41Q25.5 37 29 41"/><path d="M35 41Q38.5 37 42 41"/></g>` + '<ellipse cx="19" cy="46" rx="3.2" ry="2" fill="#ff5f9e" opacity=".5"/><ellipse cx="45" cy="46" rx="3.2" ry="2" fill="#ff5f9e" opacity=".5"/>'
      + line('M26.5 47.5Q32 53 37.5 47.5')
      + '<g class="e-candles"><rect x="23.3" y="15" width="3.4" height="11" rx="1" fill="#22e6ff" stroke="#0a6f8a" stroke-width=".6"/><rect x="30.3" y="11" width="3.4" height="15" rx="1" fill="#ffd23f" stroke="#8f6200" stroke-width=".6"/><rect x="37.3" y="15" width="3.4" height="11" rx="1" fill="#3dffa2" stroke="#0d6e44" stroke-width=".6"/>'
      + '<path class="e-flame" d="M25 7.5C26.8 10 27.4 11.6 25 14 22.6 11.6 23.2 10 25 7.5Z" fill="#ffb020"/><path class="e-flame" d="M32 3.5C33.8 6 34.4 7.6 32 10 29.6 7.6 30.2 6 32 3.5Z" fill="#ffb020"/><path class="e-flame" d="M39 7.5C40.8 10 41.4 11.6 39 14 36.6 11.6 37.2 10 39 7.5Z" fill="#ffb020"/>'
      + '<circle cx="25" cy="11.6" r="1" fill="#fff6c8"/><circle cx="32" cy="7.6" r="1" fill="#fff6c8"/><circle cx="39" cy="11.6" r="1" fill="#fff6c8"/></g>',
    // «Хронос» series: crafted in the workshop or earned by its progress
    // swings like a pendulum, eyes follow, «тик» and «так» marks pop at the sides
    ':tick:': () => `<g class="e-look">${eyes({ px: 0, py: .6 })}</g>` + blush(.4) + line('M26 45Q32 49.5 38 45')
      + '<circle cx="32" cy="52" r="3.6" fill="url(#emoGold)" stroke="#8a5200" stroke-width=".9"/><path d="M32 52V49.8M32 52L33.6 53" stroke="#5a3010" stroke-width=".9" stroke-linecap="round"/>',
    // bored half-closed eyes, flat mouth; the hourglass beside it turns over
    ':wait:': () => `<g class="e-eyes">${eye(25, 36, 4.4, 4.6, .6, 1.4, 2.3)}${eye(39, 36, 4.4, 4.6, .6, 1.4, 2.3)}<path d="M19.5 33.5Q25 30.5 30.5 33.5M33.5 33.5Q39 30.5 44.5 33.5" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/><path d="M20 33.2Q25 28 30 33.2ZM34 33.2Q39 28 44 33.2Z" fill="url(#emowaitG)"/></g>` + line('M27 47.5H37')
      + '<g class="e-glass"><path d="M46.5 39h9M46.5 55h9" stroke="url(#emoGold)" stroke-width="2.2" stroke-linecap="round"/><path d="M47.6 40.2Q47.6 45 51 47Q54.4 45 54.4 40.2ZM47.6 53.8Q47.6 49 51 47Q54.4 49 54.4 53.8Z" fill="#dff4ff" opacity=".85" stroke="#fff" stroke-width=".7"/><path class="e-sandA" d="M48.8 41.2Q49 44.4 51 45.8Q53 44.4 53.2 41.2Z" fill="#ffc21f"/><path d="M49 53.4Q50 51.2 51 50.8Q52 51.2 53 53.4Z" fill="#ffc21f"/></g>',
    // leans forward and dashes; the alarm clock flies behind, sweat flies off
    ':late:': () => line('M20 29.5L28 26.5', 2.2) + line('M44 29.5L36 26.5', 2.2) + eyes({ rx: 5, ry: 6, px: 1.4, py: .2, pr: 2.2 }) + `<ellipse class="e-mouth" cx="33" cy="48" rx="4.2" ry="4.6" fill="${INK}"/><path d="M30 50.5Q33 48.5 36 50.5Q34.5 52.4 33 52.4Q31.5 52.4 30 50.5Z" fill="#ff5f8f"/>`
      + '<g class="e-sweat"><path d="M12 24C12 24 9.8 27.2 9.8 28.6A2.2 2.2 0 0 0 14.2 28.6C14.2 27.2 12 24 12 24Z" fill="#9fe8ff"/><path d="M7 34C7 34 5.4 36.3 5.4 37.3A1.6 1.6 0 0 0 8.6 37.3C8.6 36.3 7 34 7 34Z" fill="#9fe8ff"/></g>'
      + `<g class="e-alarm"><circle cx="11" cy="12" r="7" fill="#fffdf2" stroke="#ff3b5c" stroke-width="2"/><path d="M11 12V8M11 12L14 13.4" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/><path d="M4.6 6.2A3.2 3.2 0 0 1 8.6 4M13.4 4A3.2 3.2 0 0 1 17.4 6.2" fill="none" stroke="#ff3b5c" stroke-width="2.2" stroke-linecap="round"/><path d="M6.4 18.2L5 20.4M15.6 18.2L17 20.4" stroke="#ff3b5c" stroke-width="1.8" stroke-linecap="round"/></g>`
      + '<g class="e-speed" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".8"><path d="M2 44H8M0 50H7M3 56H9"/></g>',
    // happy, a wind-up key turns on the crown and the drop keeps hopping
    ':windup:': () => happyEyes + blush(.5) + `<path d="M23.5 43H40.5Q40 52.5 32 52.5Q24 52.5 23.5 43Z" fill="${INK}"/><path d="M27 49.6Q32 46.6 37 49.6Q35 52 32 52Q29 52 27 49.6Z" fill="#ff5f8f"/><path d="M24.4 43.2H39.6V45.2H24.4Z" fill="#fff"/>`
      + '<g class="e-key"><path d="M32 9V1.5" stroke="url(#emoGold)" stroke-width="2.6" stroke-linecap="round"/><path d="M32 2C26 -4.5 21.5 -1 23.5 2.5C25 5 29.5 4 32 2ZM32 2C38 -4.5 42.5 -1 40.5 2.5C39 5 34.5 4 32 2Z" fill="url(#emoGold)" stroke="#8a5200" stroke-width="1" stroke-linejoin="round"/><circle cx="27" cy="1.4" r="1.5" fill="#5a3a00" opacity=".55"/><circle cx="37" cy="1.4" r="1.5" fill="#5a3a00" opacity=".55"/></g>'
      + '<g class="e-zap" fill="#fff6c8"><path d="M50 16L51.2 19 54.2 20.2 51.2 21.4 50 24.4 48.8 21.4 45.8 20.2 48.8 19Z"/><path d="M12 20L12.9 22.2 15.1 23.1 12.9 24 12 26.2 11.1 24 8.9 23.1 11.1 22.2Z"/></g>',
    // freezes mid-jump: the colour drains, a crack runs across, the pause sign pops
    ':freeze:': () => line('M20.5 25.5Q25 22.5 29.5 25', 2.2) + line('M34.5 25Q39 22.5 43.5 25.5', 2.2) + eyes({ rx: 5.2, ry: 6.2, px: 0, py: 0, pr: 1.8 }) + line('M27.5 47.5H36.5', 2.4)
      + '<path class="e-crack" d="M14 30L21 34.5L18.5 40.5L26 44L23 51L29.5 56" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" pathLength="1"/>'
      + '<g class="e-pause"><circle cx="50" cy="14" r="8.4" fill="#22e6ff" stroke="#fff" stroke-width="1.4"/><path d="M47 10.2V17.8M53 10.2V17.8" stroke="#06283a" stroke-width="2.6" stroke-linecap="round"/></g>',
    // a little door on the crown: the cuckoo pops out twice with its notes
    ':cuckoo:': () => eyes({ px: 0, py: -1.4 }) + blush(.4) + `<ellipse class="e-mouth" cx="32" cy="47.5" rx="3" ry="3.4" fill="${INK}"/>`
      + '<path d="M26.5 22.5V15.5L32 10.5L37.5 15.5V22.5Z" fill="#5a3010" stroke="#3a1c08" stroke-width="1" stroke-linejoin="round"/>'
      + '<g class="e-bird"><ellipse cx="32" cy="14" rx="5.2" ry="4.4" fill="#ffd23f" stroke="#8f6200" stroke-width=".9"/><circle cx="33.8" cy="12.8" r="1.1" fill="' + INK + '"/><path d="M36.6 13.6L41 15L36.6 16.4Z" fill="#ff7a2a"/><path d="M29 13Q26.4 15.2 28.4 17" fill="none" stroke="#c98a00" stroke-width="1.2" stroke-linecap="round"/></g>'
      + '<path d="M24 17L32 9.6L40 17" fill="none" stroke="#8a5a2a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'
      + `<g class="e-notes" fill="${INK}" stroke="#fff" stroke-width=".5"><path d="M47 6.5V13.4A2 2 0 1 1 45.6 11.5V5L51.4 3.8V10.4A2 2 0 1 1 50 8.5V6Z"/><path d="M13 9V15A1.7 1.7 0 1 1 11.8 13.4V8L16.4 7V12.4A1.7 1.7 0 1 1 15.2 10.8V8.5Z"/></g>`,
    ':gg:': () => happyEyes + blush(.4) + line('M26 44Q32 49 38 44')
      + '<g class="e-cup"><path d="M41 38H55V41Q55 49 48 50Q41 49 41 41Z" fill="url(#emoGold)" stroke="#8a5200" stroke-width="1.1"/><path d="M41 40.5Q37 40.5 37.5 44Q38.2 47 41.6 46.5M55 40.5Q59 40.5 58.5 44Q57.8 47 54.4 46.5" fill="none" stroke="#ffc21f" stroke-width="1.6"/><rect x="46.6" y="50" width="2.8" height="4" fill="#ffc21f"/><rect x="43" y="53.5" width="10" height="3" rx="1" fill="url(#emoGold)" stroke="#8a5200" stroke-width=".9"/><path d="M44 40.5V45" stroke="#fff" stroke-width="1.3" stroke-linecap="round" opacity=".7"/></g>'
      + '<g class="e-confetti"><rect x="10" y="16" width="3" height="3" rx=".6" fill="#ff4fd8" transform="rotate(20 11.5 17.5)"/><rect x="50" y="12" width="3" height="3" rx=".6" fill="#22e6ff" transform="rotate(-25 51.5 13.5)"/><circle cx="16" cy="9" r="1.6" fill="#ffd23f"/><circle cx="45" cy="6" r="1.4" fill="#3dffa2"/></g>'
  };

  function body(k) {
    const g = `url(#${id(k)}G)`, d = E[k].c[2];
    if (k === ':splat:') return `<g transform="translate(-3.2 -11) scale(1.1)"><g class="e-body"><path d="M5 50C4.5 45.5 11 44 15.5 45.5C17 41.5 24 41.5 27.5 43C30.5 39.5 38 39.5 41 43C45.5 41 53 42.5 52 46.5C58 46.5 60 51.5 55.5 54C52.5 58 40 57.5 32 57.5C22 58.5 10 57.5 8 54.5C4.5 53.5 5 51.5 5 50Z" fill="${g}" stroke="${d}" stroke-width="1.2"/>`
      + '<ellipse cx="17" cy="47.5" rx="4" ry="1.6" fill="#fff" opacity=".75" transform="rotate(-10 17 47.5)"/>'
      + `<g class="e-eyes" stroke="${INK}" stroke-width="2.6" stroke-linecap="round"><path d="M22 46L27 51M27 46L22 51"/><path d="M37 46L42 51M42 46L37 51"/></g>`
      + line('M29 54.5Q32 52.8 35 54.5', 2) + '</g>'
      + `<g class="e-drips"><circle cx="10" cy="36" r="2.8" fill="${g}"/><circle cx="55" cy="35" r="2.2" fill="${g}"/><circle cx="31" cy="31" r="2.4" fill="${g}"/><circle cx="44" cy="30" r="1.5" fill="${g}"/><circle cx="20" cy="32" r="1.4" fill="${g}"/></g></g>`;
    return `<g class="e-body"><path d="${DROP}" fill="${g}" stroke="${d}" stroke-width="1.2"/>`
      + '<ellipse cx="22.5" cy="24" rx="5.2" ry="2.8" fill="#fff" opacity=".78" transform="rotate(-38 22.5 24)"/><path d="M45 47Q43 54 35 56.5" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".28"/>'
      + FACE[k]() + '</g>';
  }
  const svg = k => `<svg class="emo" viewBox="0 0 64 64" aria-hidden="true">${body(k)}</svg>`;

  root.KapliEmo = { E, ORDER, defs, svg };
})(typeof window !== 'undefined' ? window : globalThis);

{ const put = () => document.body.insertAdjacentHTML('afterbegin', KapliEmo.defs()); if (document.body) put(); else document.addEventListener('DOMContentLoaded', put); }
