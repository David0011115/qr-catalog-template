  // ================= season badges (inline SVG) =================
  let badgeUid = 0;
  const BADGE_SHAPES = [
    '<circle cx="50" cy="48" r="38"/>',                                                           // Bronze: medal
    '<path d="M50 6 L88 19 L84 58 Q79 81 50 95 Q21 81 16 58 L12 19 Z"/>',                         // Silver: shield
    '<polygon points="50,5 89,27 89,71 50,94 11,71 11,27"/>',                                     // Gold: hexagon
    '<polygon points="32,6 68,6 94,32 94,68 68,94 32,94 6,68 6,32"/>',                            // Platinum: octagon
    '<polygon points="50,3 95,50 50,97 5,50"/>',                                                  // Diamond: rhombus
    '<polygon points="' + Array.from({ length: 24 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 12, r = i % 2 ? 34 : 47; return `${(50 + Math.cos(a) * r).toFixed(1)},${(50 + Math.sin(a) * r).toFixed(1)}`; }).join(' ') + '"/>', // Neon: starburst
  ];
  const BADGE_EMBLEM = {
    star: '<path d="M50 14 L53.5 22 L62 22.5 L55.5 28 L57.5 36 L50 31.8 L42.5 36 L44.5 28 L38 22.5 L46.5 22 Z"/>',
    newyear: '<g stroke-width="2.4" stroke-linecap="round" fill="none"><path d="M50 13 V35 M40.5 18.5 L59.5 29.5 M59.5 18.5 L40.5 29.5"/><path d="M46.5 14.5 L50 18 L53.5 14.5 M46.5 33.5 L50 30 L53.5 33.5"/></g>',
    valentine: '<path d="M50 36 C36 27 38 15 46 16 C48.5 16.3 50 18.5 50 20 C50 18.5 51.5 16.3 54 16 C62 15 64 27 50 36 Z"/>',
    halloween: '<ellipse cx="50" cy="26" rx="11" ry="9"/><rect x="48.5" y="13" width="3" height="6" rx="1"/><path d="M45 24 l2.5 -3 l2.5 3 Z M50.5 24 l2.5 -3 l2.5 3 Z M44 29 Q50 33 56 29" fill="#1a0820"/>',
  };
  function millionBadgeSVG(got, size) {
    return `<svg class="legend-badge ${got ? '' : 'off'}" ${size ? `style="width:${size}px;height:${size}px"` : ''} viewBox="0 0 100 100" role="img" aria-label="Значок «Миллионер»${got ? '' : ', ещё не получен'}">
      <defs><radialGradient id="mlb" cx=".35" cy=".3"><stop offset="0" stop-color="#fff6a0"/><stop offset=".6" stop-color="#ffd23f"/><stop offset="1" stop-color="#b07a00"/></radialGradient></defs>
      <g fill="#e8fbff" stroke="#c0c8e0" stroke-width="1.5">${Array.from({ length: 12 }, (_, i) => `<path transform="rotate(${i * 30} 50 48)" d="M50 2 L55 14 L45 14 Z"/>`).join('')}</g>
      <circle cx="50" cy="48" r="34" fill="url(#mlb)" stroke="#fff6a0" stroke-width="2.5"/>
      <circle cx="50" cy="48" r="27" fill="none" stroke="#b07a00" stroke-width="1.5" stroke-dasharray="3 3"/>
      <text x="50" y="58" text-anchor="middle" font-family="Russo One, Arial Black, sans-serif" font-size="28" fill="#5a3b00">1M</text>
      <text x="50" y="97" text-anchor="middle" font-family="Russo One, Arial Black, sans-serif" font-size="10" fill="#ffd23f">МИЛЛИОНЕР</text>
    </svg>`;
  }
  function legendBadgeSVG(got) {
    return `<svg class="legend-badge ${got ? '' : 'off'}" viewBox="0 0 100 100" role="img" aria-label="Значок «Легенда Капель»${got ? '' : ', ещё не получен'}">
      <defs><linearGradient id="lgb" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff6a0"/><stop offset=".5" stop-color="#ffd23f"/><stop offset="1" stop-color="#ff4fd8"/></linearGradient></defs>
      <path d="M50 4 L61 30 L90 32 L68 51 L75 80 L50 64 L25 80 L32 51 L10 32 L39 30 Z" fill="url(#lgb)" stroke="#fff6a0" stroke-width="2"/>
      <circle cx="50" cy="45" r="14" fill="#14002a" stroke="#ffd23f" stroke-width="2"/>
      <path d="M41 49 L44 39 L50 45 L56 39 L59 49 Z" fill="#ffd23f"/>
      <text x="50" y="96" text-anchor="middle" font-family="Russo One, Arial Black, sans-serif" font-size="11" fill="#ffd23f">ЛЕГЕНДА</text>
    </svg>`;
  }
  // ================= rank emblems (2.x): precious metal + gems, richer with every league =================
  // main league: Бронза medal → Серебро shield + sprigs → Золото hexagon + laurel + ruby → Платина octagon + wings + sapphire (shine)
  // → Алмаз rhombus + big wings + cut diamond (shine, sparkles) → Неон starburst + crown + iridescent stone (shine, sparkles, glow, colour flow)
  const RANK_ART = [
    { m: ['#ffe0c2', '#d98a45', '#a35a22', '#4a2208'], gem: 0,         laurel: 0, wings: 0, crown: 0, fx: 0 },
    { m: ['#ffffff', '#d8deef', '#8f99b8', '#353c55'], gem: 0,         laurel: 1, wings: 0, crown: 0, fx: 0 },
    { m: ['#fffbd0', '#ffd23f', '#c78a00', '#5a3700'], gem: '#ff2d55', laurel: 2, wings: 0, crown: 0, fx: 0 },
    { m: ['#f2ffff', '#9ff0ff', '#3fa6c8', '#0d3a52'], gem: '#2f6bff', laurel: 2, wings: 1, crown: 0, fx: 1 },
    { m: ['#fbf2ff', '#cf9bff', '#7b3ae0', '#22093f'], gem: 'cut',     laurel: 2, wings: 2, crown: 0, fx: 2 },
    { m: ['#fff0fb', '#ff8ae6', '#d01fb0', '#3a0640'], gem: 'neon',    laurel: 2, wings: 2, crown: 1, fx: 3 },
  ];
  // laurel branch along a circle around the emblem: a stem with leaf pairs, tips pointing up
  const leafArc = (from, to, n, r) => {
    const pt = (deg, rr) => { const a = deg * Math.PI / 180; return [50 + Math.cos(a) * rr, 52 + Math.sin(a) * rr]; };
    const [sx, sy] = pt(from, r), [ex, ey] = pt(to, r), sweep = to < from ? 0 : 1;
    let out = `<path d="M${sx.toFixed(1)} ${sy.toFixed(1)} A${r} ${r} 0 0 ${sweep} ${ex.toFixed(1)} ${ey.toFixed(1)}" fill="none" stroke-width="1.6"/>`;
    for (let i = 1; i <= n; i++) {
      const d = from + (to - from) * i / (n + .4), dir = to > from ? 1 : -1, tan = d + 90 * dir;
      for (const side of [-1, 1]) {
        const [x, y] = pt(d, r + side * 3.4), rot = tan - side * dir * 32, sc = 1 - i / (n * 2.6);
        out += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${(5.6 * sc).toFixed(1)}" ry="${(2.3 * sc).toFixed(1)}" transform="rotate(${rot.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
      }
    }
    return out;
  };
  const WING_L = 'M30 50 C20 46 9 38 1 24 C8 27 13 28 17 28 C10 23 6 17 5 10 C12 16 18 20 24 22 C20 18 18 14 18 9 C24 17 30 26 34 38 Z';
  const WING_L2 = 'M30 54 C18 54 7 50 -3 40 C5 41 11 41 15 40 C8 37 3 32 0 26 C8 30 15 32 21 32 C17 29 14 25 13 21 C21 28 29 36 33 46 Z';
  const SPARK = (x, y, s, d) => `<path class="rk-tw" style="animation-delay:${d}s" d="M${x} ${y - s} L${x + s * .28} ${y - s * .28} L${x + s} ${y} L${x + s * .28} ${y + s * .28} L${x} ${y + s} L${x - s * .28} ${y + s * .28} L${x - s} ${y} L${x - s * .28} ${y - s * .28} Z" fill="#fff"/>`;
  // the stone in the middle: star stamp (bronze/silver), round cabochon (gold/platinum), brilliant cut (diamond), living opal (neon)
  function rankGem(A, id) {
    const [hi, mid, lo, dk] = A.m;
    if (!A.gem) return `<path d="M50 34 L54.7 45.5 L67 46 L57.5 53.8 L60.8 66 L50 59.2 L39.2 66 L42.5 53.8 L33 46 L45.3 45.5 Z" fill="url(#${id}m)" stroke="${dk}" stroke-width="1.6" stroke-linejoin="round"/>` +
      `<path d="M50 34 L54.7 45.5 L50 52 Z M67 46 L57.5 53.8 L50 52 Z M60.8 66 L50 59.2 L50 52 Z" fill="#fff" opacity=".35"/>`;
    if (A.gem === 'cut' || A.gem === 'neon') {
      const fill = A.gem === 'neon' ? `url(#${id}o)` : `url(#${id}g)`;
      return `<g class="${A.gem === 'neon' ? 'rk-hue' : ''}"><path d="M37 46 L43 38 H57 L63 46 L50 67 Z" fill="${fill}" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>` +
        `<path d="M37 46 H63 M43 38 L47 46 L50 67 L53 46 L57 38 M47 46 L50 38 L53 46" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".8"/>` +
        `<path d="M43 38 L47 46 H37 Z" fill="#fff" opacity=".55"/><path d="M53 46 L63 46 L50 67 Z" fill="#000" opacity=".18"/></g>`;
    }
    return `<circle cx="50" cy="51" r="10.5" fill="url(#${id}m)" stroke="${dk}" stroke-width="1.2"/>` +
      `<circle cx="50" cy="51" r="8" fill="url(#${id}g)"/><path d="M50 43 L56 51 L50 59 L44 51 Z" fill="#fff" opacity=".18"/>` +
      `<ellipse cx="46.5" cy="47.5" rx="3" ry="1.8" fill="#fff" opacity=".85" transform="rotate(-35 46.5 47.5)"/>`;
  }
  // core: everything except the season number; opts.mini drops the fine details for 20–30 px use
  function rankArt(li, id, opts = {}) {
    const A = RANK_ART[li], [hi, mid, lo, dk] = A.m, mini = opts.mini, anim = !opts.still;
    const body = `<g transform="translate(50 52) scale(.74) translate(-50 -50)">`, inner = `<g transform="translate(50 52) scale(.6) translate(-50 -50)">`;
    const gemCol = A.gem === 'cut' ? ['#ffffff', '#e6f7ff', '#b6c9ff'] : A.gem === 'neon' ? ['#ffffff', '#ffb8f1', '#7b3dff'] : A.gem ? ['#ffffff', A.gem, '#14002a'] : null;
    return `<defs><linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${hi}"/><stop offset=".35" stop-color="${mid}"/><stop offset=".62" stop-color="${lo}"/><stop offset=".8" stop-color="${mid}"/><stop offset="1" stop-color="${dk}"/></linearGradient>` +
      `<linearGradient id="${id}d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${dk}"/><stop offset="1" stop-color="${lo}"/></linearGradient>` +
      (gemCol ? `<radialGradient id="${id}g" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="${gemCol[0]}"/><stop offset=".45" stop-color="${gemCol[1]}"/><stop offset="1" stop-color="${gemCol[2]}"/></radialGradient>` : '') +
      (A.gem === 'neon' ? `<linearGradient id="${id}o" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22e6ff"/><stop offset=".35" stop-color="#ffffff"/><stop offset=".6" stop-color="#ff4fd8"/><stop offset="1" stop-color="#7b3dff"/></linearGradient>` : '') +
      `<linearGradient id="${id}s" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>` +
      `<clipPath id="${id}c">${body}${BADGE_SHAPES[li]}</g></clipPath></defs>` +
      (A.wings ? `<g fill="url(#${id}m)" stroke="${dk}" stroke-width="1" stroke-linejoin="round">${A.wings > 1 ? `<path d="${WING_L2}"/><path d="${WING_L2}" transform="matrix(-1 0 0 1 100 0)"/>` : ''}<path d="${WING_L}"/><path d="${WING_L}" transform="matrix(-1 0 0 1 100 0)"/></g>` : '') +
      (A.laurel && !mini ? `<g fill="url(#${id}m)" stroke="${dk}" stroke-width=".6">${A.laurel > 1 ? leafArc(100, 215, 6, 42) + leafArc(80, -35, 6, 42) : leafArc(108, 175, 3, 42) + leafArc(72, 5, 3, 42)}</g>` : '') +
      `${body}<g fill="url(#${id}m)" stroke="${hi}" stroke-width="3">${BADGE_SHAPES[li]}</g></g>` +
      `${body}<g fill="none" stroke="${dk}" stroke-width="2.2" stroke-opacity=".7" transform="translate(50 50) scale(.93) translate(-50 -50)">${BADGE_SHAPES[li]}</g></g>` +
      `${inner}<g fill="url(#${id}d)" stroke="${hi}" stroke-opacity=".55" stroke-width="2">${BADGE_SHAPES[li]}</g></g>` +
      (A.fx && anim ? `<g clip-path="url(#${id}c)"><rect class="rk-sh" x="-40" y="-10" width="30" height="130" fill="url(#${id}s)" transform="skewX(-18)"/></g>` : '') +
      (opts.gem === false ? '' : rankGem(A, id)) +
      (A.crown ? `<g fill="url(#${id}m)" stroke="${dk}" stroke-width="1" stroke-linejoin="round"><path d="M35 17 L37 4 L43.5 11 L50 1 L56.5 11 L63 4 L65 17 Z"/><rect x="34" y="16" width="32" height="5" rx="1.5"/></g>` +
        `<circle cx="50" cy="8" r="2" fill="#22e6ff"/><circle cx="38" cy="10" r="1.4" fill="#fff"/><circle cx="62" cy="10" r="1.4" fill="#fff"/>` : '') +
      (A.fx >= 2 && anim && !mini ? SPARK(21, 22, 5, 0) + SPARK(82, 30, 4, 1.1) + SPARK(76, 82, 3.5, .5) + (A.fx >= 3 ? SPARK(18, 78, 4, 1.6) : '') : '');
  }
  const rankCls = (fx, extra = '') => `rk ${fx >= 3 ? 'rk-glow' : ''} ${extra}`;
  // small emblem of the league itself (menus, tables, rating, profile)
  function rankEmblem(li, size = 28, opts = {}) {
    li = Math.max(0, Math.min(5, li | 0)); const A = RANK_ART[li], id = 'rk' + (++badgeUid);
    return `<svg class="${rankCls(A.fx, opts.cls || '')}" width="${size}" height="${size}" viewBox="-4 -2 108 104" style="--rc:${LEAGUES[li].color}" role="img" aria-label="Лига ${LEAGUES[li].name}">${rankArt(li, id, { mini: size < 40, still: opts.still })}</svg>`;
  }
  const ribbon = (txt, col, dk) => `<path d="M16 80 H84 L79 88 L84 96 H16 L21 88 Z" fill="${dk}" stroke="${col}" stroke-width="1.6" stroke-linejoin="round"/>` +
    `<text x="50" y="92.5" text-anchor="middle" font-family="Russo One, Arial Black, sans-serif" font-size="${String(txt).length > 2 ? 11 : 12.5}" fill="#fff">${txt}</text>`;
  // season badge = the league emblem + season ribbon; holiday seasons swap the stone for the holiday mark
  function badgeSVG(x) {
    const li = Math.max(0, Math.min(5, x.league | 0)), L = lgView(li, x.holiday), A = RANK_ART[li], id = 'bg' + (++badgeUid);
    return `<svg class="${rankCls(A.fx)}" viewBox="-4 -2 108 104" style="--rc:${L.color}" role="img" aria-label="Значок сезона ${x.id}, ${L.name}">${rankArt(li, id, { gem: !x.holiday })}` +
      (x.holiday ? `<g fill="#ffffff" stroke="#ffffff" transform="translate(0 26)">${BADGE_EMBLEM[x.holiday]}</g>` : '') + ribbon(x.id, A.m[1], A.m[3]) + `</svg>`;
  }
  // ---- Chaos League: obsidian + tier colour, split-colour (cyan/magenta) edges, shards; alive from «Шторм» up ----
  function chaosArt(ti, id, opts = {}) {
    const T = CHAOS_TIERS[ti], c = T.color, mini = opts.mini, anim = !opts.still && ti >= 3;
    const body = `<g transform="translate(50 52) scale(.74) translate(-50 -50)">`, inner = `<g transform="translate(50 52) scale(.6) translate(-50 -50)">`;
    const shards = n => Array.from({ length: n }, (_, i) => { const a = (-90 + i * 360 / n) * Math.PI / 180, x = 50 + Math.cos(a) * 46, y = 52 + Math.sin(a) * 46;
      return `<path d="M${x.toFixed(1)} ${(y - 5).toFixed(1)} L${(x + 3).toFixed(1)} ${(y + 3).toFixed(1)} L${(x - 3).toFixed(1)} ${(y + 3).toFixed(1)} Z" transform="rotate(${(i * 360 / n).toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`; }).join('');
    return `<defs><linearGradient id="${id}m" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c}"/><stop offset=".45" stop-color="#1a0630"/><stop offset=".7" stop-color="#07020f"/><stop offset="1" stop-color="${c}" stop-opacity=".85"/></linearGradient>` +
      `<radialGradient id="${id}g" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="${c}"/><stop offset="1" stop-color="#07020f"/></radialGradient>` +
      `<clipPath id="${id}c">${body}${BADGE_SHAPES[ti]}</g></clipPath></defs>` +
      (ti >= 4 && !mini ? `<circle class="${anim ? 'rk-spin' : ''}" cx="50" cy="52" r="47" fill="none" stroke="${c}" stroke-width="1.4" stroke-dasharray="2 5 9 4" opacity=".8"/>` : '') +
      (ti >= 1 && !mini ? `<g fill="${c}" opacity=".9">${shards(ti >= 3 ? 8 : 4 + ti)}</g>` : '') +
      (ti >= 3 ? `<g fill="url(#${id}m)" stroke="${c}" stroke-width="1"><path d="M28 48 L4 30 L14 44 L-2 44 L16 54 L4 62 L30 58 Z"/><path d="M28 48 L4 30 L14 44 L-2 44 L16 54 L4 62 L30 58 Z" transform="matrix(-1 0 0 1 100 0)"/></g>` : '') +
      `<g class="${anim ? 'rk-gl' : ''}">${body}<g fill="none" stroke="#22e6ff" stroke-width="2.4" opacity=".75" transform="translate(-2.4 0)">${BADGE_SHAPES[ti]}</g><g fill="none" stroke="#ff4fd8" stroke-width="2.4" opacity=".75" transform="translate(2.4 0)">${BADGE_SHAPES[ti]}</g></g></g>` +
      `${body}<g fill="url(#${id}m)" stroke="${c}" stroke-width="3" stroke-dasharray="${ti >= 2 ? '0' : '7 3'}">${BADGE_SHAPES[ti]}</g></g>` +
      `${inner}<g fill="#0b0418" stroke="${c}" stroke-opacity=".5" stroke-width="2">${BADGE_SHAPES[ti]}</g></g>` +
      `<g clip-path="url(#${id}c)"><rect class="${anim ? 'rk-gs' : ''}" x="0" y="${38 + ti * 3}" width="100" height="3.5" fill="#22e6ff" opacity=".55"/><rect x="0" y="${58 - ti * 2}" width="100" height="2.5" fill="#ff4fd8" opacity=".5"/></g>` +
      `<circle cx="50" cy="51" r="12" fill="url(#${id}g)" opacity=".55"/>` +
      `<text x="50" y="58.5" text-anchor="middle" font-size="20" fill="#fff" style="paint-order:stroke" stroke="${c}" stroke-width="1.2">${T.icon}</text>` +
      (ti >= 5 ? `<g fill="url(#${id}m)" stroke="${c}" stroke-width="1"><path d="M36 17 L33 3 L42 11 L50 -1 L58 11 L67 3 L64 17 Z"/></g><circle cx="50" cy="8" r="2" fill="#fff"/>` : '');
  }
  function chaosEmblem(ti, size = 28, opts = {}) {
    ti = Math.max(0, Math.min(5, ti | 0)); const id = 'ck' + (++badgeUid);
    return `<svg class="rk rk-chaos ${ti >= 5 ? 'rk-glow' : ''} ${opts.cls || ''}" width="${size}" height="${size}" viewBox="-4 -2 108 104" style="--rc:${CHAOS_TIERS[ti].color}" role="img" aria-label="Хаос-лига, ${CHAOS_TIERS[ti].name}">${chaosArt(ti, id, { mini: size < 40, still: opts.still })}</svg>`;
  }
  function chaosBadgeSVG(x) {
    const ti = Math.max(0, Math.min(5, x.tier | 0)), T = CHAOS_TIERS[ti], id = 'cbg' + (++badgeUid);
    return `<svg class="rk rk-chaos ${ti >= 5 ? 'rk-glow' : ''}" viewBox="-4 -2 108 104" style="--rc:${T.color}" role="img" aria-label="Значок Хаос-сезона ${x.id}, ${T.name}">${chaosArt(ti, id)}${ribbon(x.id, T.color, '#12051f')}</svg>`;
  }
  function badgeDesc(x, live) {
    const L = lgView(x.league, x.holiday), st = SEASON_EPOCH + (x.id - 1) * SEASON_LEN;
    return `<div>${badgeSVG(x)}</div><div style="--bc:${L.color}"><b>Сезон ${x.id}${x.name ? ` «${x.name}»` : ''}</b>
      <p>${fmtDate(st)} – ${fmtDate(st + SEASON_LEN)}<br>Лига: <span>${L.name}</span> · ${x.pts} очков${x.holiday ? `<br>Праздничный сезон: ${HOLIDAYS[x.holiday].name}` : ''}${live ? '<br>Сезон ещё идёт: значок улучшится, если поднимешься в лиге' : ''}</p></div>`;
  }

  // Interactive reward preview for the League screen.
  let leaguePreviewItems = [];
  let chaosPreviewItems = [];
  let leaguePreviewOverlay = null;
  function showLeagueRewardPreview(item) {
    if (!item) return;
    // skins, pets, effects, frames and titles open the full item window (3D model, what it gives, where it comes from)
    { const id = item.id, ref = !id ? null : (item.kind === 'skin' || (!item.kind && SKINS.some(s => s.id === id))) && SKINS.some(s => s.id === id) ? 'skin:' + id
        : item.kind === 'pet' && petById(id) ? 'pet:' + id : item.kind === 'fx' && FX.some(f => f.id === id) ? 'fx:' + id
        : (item.kind === 'frame' || item.kind === 'title') && decorById(id) ? 'deco:' + id : null;
      if (ref) { if (leaguePreviewOverlay) leaguePreviewOverlay.hidden = true; openItem(ref); return; } }
    if (!leaguePreviewOverlay) {
      leaguePreviewOverlay = document.createElement('div');
      leaguePreviewOverlay.id = 'leagueRewardPreview';
      leaguePreviewOverlay.hidden = true;
      leaguePreviewOverlay.innerHTML = '<div class="lrp-card" role="dialog" aria-modal="true" aria-labelledby="lrpTitle"><div class="lrp-visual" id="lrpVisual"></div><h3 id="lrpTitle"></h3><p id="lrpDescription"></p><button type="button" class="btn" id="lrpClose">Понятно</button></div>';
      document.body.appendChild(leaguePreviewOverlay);
      leaguePreviewOverlay.addEventListener('click', e => { if (e.target === leaguePreviewOverlay || e.target.id === 'lrpClose') leaguePreviewOverlay.hidden = true; });
      document.addEventListener('keydown', e => { if (e.key === 'Escape' && leaguePreviewOverlay && !leaguePreviewOverlay.hidden) leaguePreviewOverlay.hidden = true; });
    }
    const visual = $('lrpVisual');
    visual.replaceChildren();
    if (item.kind === 'badge') visual.innerHTML = badgeSVG({id:save.season.id,league:item.league,pts:save.season.pts,name:seasonData(save.season.id).name,holiday:seasonData(save.season.id).holiday});
    else if (item.kind === 'chaosBadge') visual.innerHTML = chaosBadgeSVG({id:item.seasonId || save.chaos.id,tier:item.tier});
    else if (item.kind === 'abil') visual.innerHTML = '<div class="lrp-chaos-ability" style="--lrp-color:' + (item.color || '#b26bff') + '"><span>' + (item.icon || '✦') + '</span></div>';
    else if (item.kind === 'look') visual.innerHTML = '<div class="lrp-chaos-ability" style="--lrp-color:' + (item.color || '#ff4fd8') + '"><span>✧</span></div>';
    else if (item.kind === 'skin' || item.id && SKINS.some(s => s.id === item.id)) {
      // Render the skin swatch through the DOM style API: complex pattern textures
      // (including generated data-URL textures) are not safe to interpolate into HTML.
      const sw = document.createElement('div');
      sw.className = 'sw lrp-skin-preview';
      const skin = item.kind === 'skin' ? item : SKINS.find(s => s.id === item.id);
      try { sw.style.cssText = swatch(skin); } catch (_) {}
      if (!sw.style.background && !sw.style.backgroundImage && !sw.style.backgroundColor) {
        sw.style.background = `radial-gradient(circle at 32% 25%,#fff9,transparent 24%),linear-gradient(145deg,${skin.accent || '#ffffff'},${skin.color || '#7b3dff'} 58%,#09051c)`;
      }
      sw.style.width = '112px'; sw.style.height = '112px'; sw.style.borderRadius = '50%';
      sw.style.border = '3px solid rgba(255,255,255,.62)';
      sw.style.boxShadow = `0 0 30px ${skin.accent || skin.color || '#8e7aff'}`;
      visual.appendChild(sw);
    }
    else if (item.kind === 'fx') visual.innerHTML = '<div class="sw" style="background:radial-gradient(circle at 35% 35%,#fff,' + (item.color || '#ff4fd8') + ' 42%,#09051c);--lrp-color:' + (item.color || '#ff4fd8') + '"></div>';
    else if (item.kind === 'pet') visual.innerHTML = '<div style="font-size:76px;filter:drop-shadow(0 0 18px #9b8cff)">🐾</div>';
    else if (item.kind === 'coins') visual.innerHTML = '<div style="font-size:66px;color:#ffd23f;text-shadow:0 0 24px #ffd23f">◆</div>';
    else if (item.kind === 'frame') visual.innerHTML = '<div style="width:90px;height:90px;border:8px double #b58aff;border-radius:28px;box-shadow:0 0 24px #9b70ff"></div>';
    else if (item.kind === 'title') visual.innerHTML = '<div style="font-size:26px;font-weight:900;color:#ffd36a;text-shadow:0 0 18px #ffb52e">ТИТУЛ</div>';
    $('lrpTitle').textContent = item.name || 'Награда сезона';
    $('lrpDescription').textContent = (item.description || 'Награда за достижение соответствующей ступени лиги.') + (item.kind === 'abil' && item.cd ? ` Перезарядка ${item.cd} с${item.dur ? `, действует ${item.dur} с` : ''}. Работает только в Хаос-лиге.` : '');
    leaguePreviewOverlay.hidden = false;
    $('lrpClose').focus();
  }
  $('lgTable').addEventListener('click', e => {
    const b = e.target.closest('[data-league-preview]');
    if (b) showLeagueRewardPreview(leaguePreviewItems[Number(b.dataset.leaguePreview)]);
  });
  $('seasonSkin').addEventListener('click', () => {
    const sd = seasonData(save.season.id), li = leagueOf(save.season.pts);
    const item = sd.skin || sd.fx || (sd.items && sd.items[0]) || (sd.pets && sd.pets[0]);
    if (item) showLeagueRewardPreview({...item,description:'Главная сезонная награда. Условия получения указаны в карточке сезона.'});
  });
  $('seasonSkin').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('seasonSkin').click(); } });

  // ================= league =================
  // ================= Chaos League: points, window =================
  function chaosApply(gain) {
    if (!chaosStarted) return null;
    gain = Math.round(gain);
    const C = save.chaos, tb = chaosOf(C.pts), fee = CHAOS_CFG.fee[tb], floor = CHAOS_CFG.pts[tb], before = C.pts;
    let after = Math.max(floor, before + gain - fee), capped = false;
    // below level 46 the tier stops at Platinum: points above the Diamond threshold don't pile up
    const lockT = chaosLockTier(stats.lvStart), cap = lockT !== null ? CHAOS_CFG.pts[lockT] - 1 : Infinity;
    if (after > cap) { after = Math.max(before, cap); capped = CHAOS_TIERS[lockT].name; }
    C.last = { gain, fee, net: after - before, floor: before + gain - fee < floor, capped };
    C.games = (C.games || 0) + 1; C.fees = (C.fees || 0) + Math.min(fee, Math.max(0, before - after + gain));
    C.pts = after;
    const tier = chaosOf(after);
    C.hist = [...(C.hist || []), { t: Date.now(), mode, gain, fee, net: after - before, tier }].slice(-CHAOS_CFG.histMax);
    save.totals.chaosGames = (save.totals.chaosGames || 0) + 1; save.totals.chaosMax = Math.max(save.totals.chaosMax || 0, tier);
    return { ...C.last, tier };
  }
  const chaosOpen = () => playerLevel() >= CHAOS_CFG.entryLevel;
  // the lowest tier still closed for this level (null = all open)
  const chaosLockTier = lv => { for (const t of [4, 5]) if (lv < CHAOS_CFG.tierLevel[t]) return t; return null; };
  function chaosRewardItems(ti, seasonId = save.chaos.id) {
    const items = [{ kind:'coins', name:`${CHAOS_CFG.coins[ti]} ◆`, description:'Монеты за итоговую ступень Хаос-сезона.' }, { kind:'chaosBadge', name:`Значок сезона · ${ctName(ti)}`, description:'Сезонный значок Хаос-лиги. Его форма и цвет соответствуют достигнутой ступени.', tier:ti, seasonId }];
    if (ti >= CHAOS_CFG.topTier) {
      const skin = ensureChaosSkin(seasonId);
      if (skin) items.push({ ...skin, kind:'skin', description:'Эксклюзивный скин Хаос-лиги за достижение ступени «Разлом» или выше.' });
      const frame = decorById('fr_cq' + chaosQ(seasonId));
      if (frame) items.push({ ...frame, kind:'frame', name:frame.name, description:'Квартальная рамка Хаос-лиги за достижение ступени «Разлом» или выше.' });
    }
    if (ti >= 5) {
      const title = decorById('tt_cq' + chaosQ(seasonId));
      if (title) items.push({ ...title, kind:'title', name:title.name, description:'Квартальный титул за завершение сезона на ступени «Сингулярность».' });
      const nx = chaosNextThird();
      if (nx && nx.kind === 'abil') items.push({ ...nx.a, kind:'abil', icon:nx.a.icon, name:nx.a.name, description:nx.a.desc || 'Эксклюзивная способность Хаос-лиги.' });
      else if (nx) items.push({ ...nx.l, kind:'look', name:nx.l.name, description:'Визуальный облик эксклюзивной способности.' });
    }
    return items;
  }
  function chaosRewardText(ti) { return chaosRewardItems(ti).map(x => x.name).join(' · '); }
  function renderChaosBtn() {
    const ti = chaosOf(save.chaos.pts);
    $('chaosBtn').innerHTML = `<span class="lg-logo">${chaosLogoSVG(56)}</span><span class="lg-tx"><b class="lg-ttl">Хаос-лига</b>` + (chaosOpen()
      ? `<small class="lg-me"><b class="rk-name" style="color:${CHAOS_TIERS[ti].color}">${chaosEmblem(ti, 22)}${ctName(ti)}</b> · ${save.chaos.pts} очков</small>` +
        `<small class="lg-when">${chaosStarted ? `сезон ${save.chaos.id} · до ${fmtDate(chaosEnd(save.chaos.id))}` : `первый сезон — с ${fmtDate(CHAOS_EPOCH)}`} · 7 дней</small>`
      : `<small class="lg-me">🔒 откроется с ${CHAOS_CFG.entryLevel}-го уровня</small><small class="lg-when">случайные способности · сезон 7 дней</small>`) + '</span>';
  }
  function renderChaos() {
    const C = save.chaos, ti = chaosOf(C.pts), L = CHAOS_TIERS[ti], lv = playerLevel(), open = chaosOpen(), lockT = chaosLockTier(lv);
    const nextI = ti < 5 ? ti + 1 : null, nextPts = nextI !== null ? CHAOS_CFG.pts[nextI] : null;
    const pct = nextPts !== null ? (C.pts - CHAOS_CFG.pts[ti]) / (nextPts - CHAOS_CFG.pts[ti]) * 100 : 100;
    const days = Math.max(0, Math.ceil((chaosEnd(C.id) - Date.now()) / 864e5));
    const when = chaosStarted ? `Хаос-сезон ${C.id} · режим «${MODES[seasonMode(C.id)].name}» · до ${fmtDate(chaosEnd(C.id))} (осталось ${days} дн.)` : `Хаос-сезон 1 начнётся ${fmtDate(CHAOS_EPOCH)}. До старта очки не начисляются`;
    const g = C.last, sign = v => (v >= 0 ? '+' : '−') + Math.abs(v);
    const next = nextI !== null ? CHAOS_TIERS[nextI] : null;
    const steps = CHAOS_TIERS.map((tier, i) => `<div class="league-step ${i < ti ? 'passed' : ''} ${i === ti ? 'current' : ''}" style="--lc:${tier.color}" aria-label="${tier.name}${i === ti ? ', текущая ступень' : ''}">${chaosEmblem(i, 27, { still: i !== ti })}<span>${tier.name}</span></div>`).join('');
    $('chaosPanel').innerHTML =
      `<div class="league-current" style="--rc:${L.color}">` +
        `<div class="league-current-head"><div class="league-current-emblem">${chaosEmblem(ti, 92)}</div><div class="league-current-copy"><small>ТВОЯ ТЕКУЩАЯ СТУПЕНЬ</small><b>${L.icon} ${L.name}</b><span>Очки Хаос-лиги</span></div></div>` +
        `<div class="league-points"><strong>${C.pts.toLocaleString('ru-RU')}</strong><span>ОЧКОВ</span></div>` +
        `<div class="league-progress-area"><div class="league-progress-title"><b>${next ? `До следующей ступени — ${next.name}` : 'Достигнута высшая ступень'}</b><span>${Math.max(0,Math.min(100,pct)).toFixed(0)}%</span></div>` +
        `<div class="league-progress-track" role="progressbar" aria-label="Прогресс до следующей ступени" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.max(0,Math.min(100,pct)).toFixed(0)}"><div class="league-progress-fill" style="width:${Math.max(0,Math.min(100,pct)).toFixed(2)}%;background:linear-gradient(90deg,#22e6ff,${L.color},#ff4fd8)"></div></div>` +
        `<div class="league-progress-labels"><span>${CHAOS_CFG.pts[ti].toLocaleString('ru-RU')}</span><b>${nextPts !== null ? `${nextPts.toLocaleString('ru-RU')} очков` : 'МАКСИМУМ'}</b></div></div>` +
        `<div class="league-path-label">ТВОЙ ПУТЬ ПО СТУПЕНЯМ</div><div class="league-steps">${steps}</div>` +
        `<div class="league-to-go">${nextPts !== null ? `До повышения: <b>${Math.max(0,nextPts-C.pts).toLocaleString('ru-RU')} очков</b>` : 'Ты достиг вершины Хаос-лиги'}</div>` +
        `<div class="league-season-line">${when}</div>` +
        (lockT !== null ? `<span class="notice">${lockT === 4 ? `«Разлом» откроется на ${CHAOS_CFG.tierLevel[4]} уровне, «Сингулярность» — на ${CHAOS_CFG.tierLevel[5]}-м (сейчас ${lv}-й). До этого ступень не выше «Шторма».` : `«Сингулярность» откроется на ${CHAOS_CFG.tierLevel[5]} уровне (сейчас ${lv}-й). До этого ступень не выше «Разлома».`}</span>` : '') +
        (g ? `<div class="lg-last ${g.net < 0 ? 'neg' : ''}"><b>Последняя игра <strong>${sign(g.net)}</strong></b><small>Результат: ${sign(g.gain)}${g.fee ? ` · взнос −${g.fee}` : ''}${g.floor ? ' · достигнут порог ступени' : ''}${g.capped ? ` · счёт остановился: «${g.capped}» откроется с ${CHAOS_CFG.tierLevel[CHAOS_TIERS.findIndex(t => t.name === g.capped)] || ''} уровня` : ''}</small><small>За сезон: ${C.games || 0} игр${C.fees ? ` · ${C.fees} взносов` : ''}</small></div>` : '') +
        (() => { const nx = chaosNextThird(), top = save.chaosTop || 0, nv = CHAOS_VET.find(v => top < v.n);
          return `<div class="lg-last"><b>Сезонов в «Сингулярности»: <strong>${top}</strong></b><small>Следующая третья награда: ${nx ? (nx.kind === 'abil' ? `способность «${nx.a.name}»` : `облик «${nx.l.name}»`) : 'всё получено'}.</small><small>Вехи: ${CHAOS_VET.map(v => `${v.n} — ${v.what}${top >= v.n ? ' ✓' : ''}`).join(' · ')}${nv ? ` · до следующей: ${nv.n - top}` : ''}</small></div>`; })() +
        (chaosNotice ? `<span class="notice">${chaosNotice}</span>` : '') +
      `</div>`;
    $('chaosSeasonSkin').innerHTML = `<div class="sw crown">${chaosBadgeSVG({ id:C.id, tier:ti })}</div><div><b>Значок сезона: ${L.icon} ${L.name}</b><br><small>${chaosStarted ? 'В конце сезона значок останется в профиле. Форма и цвет зависят от достигнутой ступени.' : 'Значок будет выдан по итогам первого Хаос-сезона.'}</small></div>`;
    $('chaosBadgeInfo').innerHTML = `<div>${chaosBadgeSVG({ id:C.id, tier:ti })}</div><div><b>Твой значок Хаос-сезона</b><p>Сезон ${C.id} · ${L.name}. Значок сохраняется в профиле после завершения сезона.</p></div>`;
    $('chaosPlay').disabled = !open;
    $('chaosPlay').textContent = open ? `Играть · ${MODES[seasonMode(C.id)].name}` : `Откроется на ${CHAOS_CFG.entryLevel} уровне`;
    $('chaosNote').textContent = open ? `3 случайные способности на бой (одна — рывок или деление), у всех равные условия. Купленные способности и улучшения не действуют.${CHAOS_CFG.fee[ti] ? ` Взнос за бой: ${CHAOS_CFG.fee[ti]} очков.` : ''}` : `Сейчас у тебя ${lv}-й уровень.`;
    chaosPreviewItems = [];
    $('chaosTable').innerHTML = CHAOS_TIERS.map((l, i) => {
      const chips = chaosRewardItems(i, C.id).map(item => {
        const n = chaosPreviewItems.push(item) - 1;
        const label = item.kind === 'coins' ? '◆ ' + item.name.replace(' ◆','') : item.kind === 'badge' || /^Значок/.test(item.name) ? 'Значок' : item.kind === 'skin' ? 'Скин' : item.kind === 'frame' ? 'Рамка' : item.kind === 'title' ? 'Титул' : item.kind === 'abil' ? 'Способность' : item.kind === 'look' ? 'Облик' : item.name;
        return `<button type="button" class="lg-reward-chip" data-chaos-preview="${n}">${label}</button>`;
      }).join('');
      return `<li class="${i === ti ? 'cur' : i > ti ? 'lock' : ''}" style="--lc:${l.color}"><div class="lg-rank-line"><b class="rk-name">${chaosEmblem(i, 27, { still: i !== ti })}${l.icon} ${l.name}</b><span>от ${CHAOS_CFG.pts[i].toLocaleString('ru-RU')} очков${i === ti ? ' · ты здесь' : ''}${CHAOS_CFG.fee[i] ? ` · взнос ${CHAOS_CFG.fee[i]}` : ''}${CHAOS_CFG.tierLevel[i] ? ` · с ${CHAOS_CFG.tierLevel[i]} ур.` : ''}</span></div><div class="lg-reward-chips">${chips}</div></li>`;
    }).join('');
    $('chaosXa').innerHTML = XA_ABIL.map(a => `<div class="ab-row ${save.abil.xa.includes(a.id) ? 'own' : ''}" style="--ac:${a.color}"><span class="ab-big">${a.icon}</span><div class="ab-txt"><b>${a.name}${save.abil.xa.includes(a.id) ? ' <span class="badge-ex">получена</span>' : ''}</b><small>${a.desc}. Перезарядка ${a.cd} с.</small></div></div>`).join('');
  }
  $('chaosTable').addEventListener('click', e => {
    const b = e.target.closest('[data-chaos-preview]');
    if (b) showLeagueRewardPreview(chaosPreviewItems[Number(b.dataset.chaosPreview)]);
  });
  $('chaosBtn').addEventListener('click', () => {
    renderChaos(); showCard('chaosCard'); $('chaosBack').focus();
    // first visit after it opens: a short intro to the Chaos League
    if (chaosOpen() && !save.chaosIntro) { save.chaosIntro = true; persist();
      tutModal('Добро пожаловать в Хаос-лигу!', `<ul>
        <li><b>Случайные способности.</b> В начале боя каждый получает 3 случайные способности из 24, одна — рывок или деление. Набор не меняется до конца боя.</li>
        <li><b>Равные условия.</b> Купленные способности, улучшения и облики здесь не действуют — у всех одинаково.</li>
        <li><b>Свои ступени:</b> Искра → Помеха → Сбой → Шторм → Разлом (с ${CHAOS_CFG.tierLevel[4]} ур.) → Сингулярность (с ${CHAOS_CFG.tierLevel[5]} ур.). Сезон — 7 дней, взнос — со «Сбоя».</li>
        <li><b>Награды:</b> монеты, скин, рамка и титул сезона, а за «Сингулярность» — эксклюзивные способности, которые потом можно ставить в билд.</li>
        <li>Что делает каждая способность — кнопка «ⓘ Все 24 способности» в этом окне.</li></ul>`, [['tutOk', 'Понятно', 'btn']]); }
  });
  $('chaosPlay').addEventListener('click', () => { if (!chaosOpen()) return; pendingRanked = true; pendingChaos = true; startRound(); });
  $('chaosBack').addEventListener('click', () => { showCard('menuCard'); $('chaosBtn').focus(); });
  $('chaosInfoBtn').addEventListener('click', () => openTabInfo('chaos'));
  $('chaosAbilBtn').addEventListener('click', () => openTabInfo('chaosAbil'));
  // ⓘ buttons that show a block of the page's own help (chests, league, profile)
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-infotpl]'); if (!b) return;
    $('tiName').textContent = 'Информация · ' + b.dataset.infotitle;
    $('tiBody').innerHTML = $(b.dataset.infotpl).innerHTML;
    tiReturn = b; $('tabInfoModal').hidden = false; $('tiOk').focus();
  });
  function renderLeague() {
    const sd = seasonData(save.season.id), hk = sd.holiday, li = leagueOf(save.season.pts), L = lgView(li, hk), next = li < 5 ? lgView(li + 1, hk) : null;
    $('leaguePlay').textContent = `Играть в лиге · ${MODES[leagueMode()].name}`;
    $('leaguePlayNote').textContent = seasonStarted
      ? `Рейтинговый бой: только режим этого сезона, улучшения и бонусы питомцев отключены, начисляются очки лиги.${LEAGUE_FEE[leagueOf(save.season.pts)] ? ` Взнос за игру в твоей лиге: ${LEAGUE_FEE[leagueOf(save.season.pts)]} очков — слабая игра может уменьшить счёт, но из лиги не вылетишь.` : ''}`
      : `Сезон начнётся ${fmtDate(SEASON_EPOCH)}. До старта можно потренироваться: раунд пройдёт по правилам лиги, но без очков.`;
    const rawPct = next ? (save.season.pts - L.pts) / (next.pts - L.pts) * 100 : 100;
    const pct = Math.max(0, Math.min(100, rawPct));
    const when = seasonStarted
      ? `Сезон ${save.season.id} «${sd.name}»${sd.holiday ? ' · праздничный' : ''} · ${MODES[leagueMode()].name} · до ${fmtDate(seasonEnd(save.season.id))} (ещё ${Math.ceil((seasonEnd(save.season.id) - Date.now()) / 86400000)} дн.)`
      : `Сезон начнётся ${fmtDate(SEASON_EPOCH)} · до старта очки не начисляются`;
    const RA = RANK_ART[li].m;
    const steps = LEAGUES.map((tier, i) => `<div class="league-step ${i < li ? 'passed' : ''} ${i === li ? 'current' : ''}" style="--lc:${tier.color}" aria-label="${tier.name}${i === li ? ', текущая лига' : ''}">${rankEmblem(i, 27, { still: i !== li })}<span>${tier.name}</span></div>`).join('');
    $('leaguePanel').innerHTML =
      `<div class="league-current" style="--rc:${L.color}">` +
        `<div class="league-current-head"><div class="league-current-emblem">${rankEmblem(li, 92)}</div><div class="league-current-copy"><small>ТВОЙ ТЕКУЩИЙ РАНГ</small><b>${L.name}</b><span>Сезонные очки</span></div></div>` +
        `<div class="league-points"><strong>${save.season.pts.toLocaleString('ru-RU')}</strong><span>ОЧКОВ</span></div>` +
        `<div class="league-progress-area"><div class="league-progress-title"><b>${next ? `До следующего ранга — ${next.name}` : 'Достигнута высшая лига'}</b><span>${pct.toFixed(0)}%</span></div>` +
        `<div class="league-progress-track" role="progressbar" aria-label="Прогресс до следующей лиги" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct.toFixed(0)}"><div class="league-progress-fill" style="width:${pct.toFixed(2)}%;background:linear-gradient(90deg, ${RA[2]}, ${RA[1]}, ${RA[0]})"></div></div>` +
        `<div class="league-progress-labels"><span>${L.pts.toLocaleString('ru-RU')}</span><b>${next ? `${next.pts.toLocaleString('ru-RU')} очков` : 'МАКСИМУМ'}</b></div></div>` +
        `<div class="league-path-label">ТВОЙ ПУТЬ ПО ЛИГАМ</div><div class="league-steps">${steps}</div>` +
        (next ? `<div class="league-to-go">До повышения: <b>${Math.max(0, next.pts - save.season.pts).toLocaleString('ru-RU')} очков</b></div>` : `<div class="league-to-go">Ты достиг вершины рейтинга</div>`) +
        `<div class="league-season-line">${when}</div>` +
        (() => { const g = save.season.last; if (!g) return ''; const sign = v => (v >= 0 ? '+' : '−') + Math.abs(v);
          return `<div class="lg-last ${g.net < 0 ? 'neg' : ''}"><b>Последняя игра <strong>${sign(g.net)}</strong></b><small>Результат: ${sign(g.gain)}${g.fee ? ` · взнос −${g.fee}` : ''}${g.floor ? ` · достигнут порог «${L.name}»` : ''}</small><small>За сезон: ${save.season.games || 0} игр${save.season.fees ? ` · ${save.season.fees} взносов` : ''}</small></div>`; })() +
        (seasonNotice ? `<span class="notice">${seasonNotice}</span>` : '') +
      `</div>`;
    if (hk) {
      const top = sd.items[5];
      $('seasonSkin').innerHTML = `<div class="sw crown" style="${swatch(top)}"></div><div><b>Праздничный сезон: ${sd.name}</b><br><small>Лиги обычные, но за каждую — праздничный скин или эффект. Главная награда — «${top.name}» за лигу «Неон».</small></div>`;
    } else {
      const sk = sd.skin, fx = sd.fx, pet = sd.pets && sd.pets[0];   // odd seasons: skin (+ pet at «Неон»), even seasons: effect
      $('seasonSkin').innerHTML = sk ? `<div class="sw ${sk.crown ? 'crown' : ''}" style="${swatch(sk)}"></div><div><b>Скин сезона: ${sk.name}</b><br><small>${save.skins.includes(sk.id) ? 'Уже в гардеробе.' : 'За лиги «Алмаз» и «Неон».'}${pet ? ` Питомец «${pet.name}» — за «Неон».` : ''}${fx ? ` Эффект «${fx.name}» — за «Алмаз».` : ''}</small></div>`
        : fx ? `<div class="sw crown" style="background:radial-gradient(circle at 35% 35%, #fff, ${fx.color || '#ff4fd8'} 45%, #0b0824)"></div><div><b>Эффект сезона: ${fx.name}</b><br><small>${save.fxOwned.includes(fx.id) ? 'Уже у тебя.' : 'За лигу «Алмаз».'}</small></div>` : '';
    }
    { const cur = { id: save.season.id, league: li, pts: save.season.pts, name: sd.name, holiday: hk };
      $('curBadge').style.setProperty('--bc', L.color);
      $('curBadge').innerHTML = badgeDesc(cur, true).replace('<b>', '<b>Твой значок: '); }
    const nextIds = [1, 2, 3].map(k => save.season.id + k);
    $('seasonNext').innerHTML = nextIds.map(id => { const d = seasonData(id); return `<li><span>Сезон ${id}: ${d.name}${d.holiday ? ' · праздник, праздничные награды' : ''} · «${MODES[seasonMode(id)].name}»</span><span class="rw">с ${fmtDate(SEASON_EPOCH + (id - 1) * SEASON_LEN)}</span></li>`; }).join('');
    leaguePreviewItems = [];
    $('lgTable').innerHTML = LEAGUES.map((_, i) => {
      const l = lgView(i, hk), rewards = seasonRewards(sd, i), decor = seasonDecor(sd, i);
      const addPreview = (item) => { const n = leaguePreviewItems.push(item) - 1; return n; };
      const chips = [
        `<button type="button" class="lg-reward-chip" data-league-preview="${addPreview({kind:'coins',name:`${l.coins} ◆`,description:'Монеты за достижение этой лиги по итогам сезона.'})}">◆ ${l.coins}</button>`,
        `<button type="button" class="lg-reward-chip" data-league-preview="${addPreview({kind:'badge',name:'Значок сезона',description:`Значок с эмблемой лиги «${l.name}» и номером сезона.`,league:i})}">Значок</button>`,
        ...rewards.map(r => `<button type="button" class="lg-reward-chip" data-league-preview="${addPreview({...r,description:r.kind==='skin'?'Сезонный облик капли.':r.kind==='fx'?'Эффект оформления капли.':r.kind==='pet'?'Питомец, который сопровождает игрока.':'Награда сезона.'})}">${r.kind==='skin'?'Скин':r.kind==='fx'?'Эффект':r.kind==='pet'?'Питомец':r.name}</button>`),
        ...decor.map(id => `<button type="button" class="lg-reward-chip" data-league-preview="${addPreview({id,kind:id.startsWith('fr_')?'frame':'title',name:id.startsWith('fr_')?'Рамка сезона':'Титул сезона',description:'Дополнительная награда за высокий ранг в сезоне.'})}">${id.startsWith('fr_')?'Рамка':'Титул'}</button>`)
      ].join('');
      return `<li class="${i === li ? 'cur' : i > li ? 'lock' : ''}" style="--lc:${l.color}"><div class="lg-rank-line"><b class="rk-name">${rankEmblem(i, 27, { still: i !== li })}${l.name}</b><span>от ${l.pts} очков${i === li ? ' · ты здесь' : ''}</span></div><div class="lg-reward-chips">${chips}</div></li>`;
    }).join('');
    $('seasonSkin').setAttribute('role','button');
    $('seasonSkin').setAttribute('tabindex','0');
    $('seasonSkin').setAttribute('data-season-preview','1');
  }
  $('leagueBtn').addEventListener('click', () => { renderLeague(); showCard('leagueCard'); $('leagueBack').focus(); });
  $('leaguePlay').addEventListener('click', () => { pendingRanked = true; startRound(); });
  $('leagueBack').addEventListener('click', () => { showCard('menuCard'); $('leagueBtn').focus(); });

