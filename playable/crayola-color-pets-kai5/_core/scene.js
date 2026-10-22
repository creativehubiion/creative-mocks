/* Colour Me Christmas — the scene: one drawFrame for every view, driven by the view's geometry (frame fractions).
   Depth is draw order: room plate (wall, tree, floor) → countdown lights (code) → floor splats (code) → falling ornaments (picture)
   and bubbles (code) → pet (Crayola's photo; grey stand-in here) → its colour patches (code, clipped to the pet) → splats, suds,
   words (code). Nothing goes into anything, so separate pictures compose (rule 17). */
window.CPScene = (function () {
  const INK = '#1d1b26', G1 = '#55525e', G2 = '#8d8a96', G3 = '#bcb9c4', G4 = '#dedbe4';
  // the twelve patches, in the order they fill, as fractions of the pet's box (the pet faces right): cap, cheek, scarf, back, belly, hip,
  // tail, feet, ears, snout, chest, rump; together they cover the pet
  const PATCHES = [[.74, .13, .15, .08], [.68, .36, .1, .09], [.57, .5, .16, .065], [.4, .47, .14, .09], [.5, .74, .17, .1], [.24, .62, .12, .1], [.09, .53, .08, .065], [.36, .92, .2, .06], [.72, .06, .14, .05], [.84, .34, .07, .08], [.66, .66, .1, .1], [.26, .78, .1, .08]];
  // the same twelve patches placed on the real toy (the Scribble Scrubbie / Color Pets puppy photo, facing right), checked by eye on the cut-out
  const PHOTO_PATCHES = [[.74, .16, .15, .08], [.47, .46, .1, .12], [.65, .47, .15, .055], [.33, .42, .16, .09], [.55, .63, .14, .1], [.17, .55, .13, .11],
    [.33, .1, .05, .1], [.82, .93, .12, .055], [.14, .93, .12, .055], [.88, .27, .07, .065], [.72, .77, .08, .1], [.1, .78, .08, .1]];
  // washable marker on a flocked toy (owner 23:30: "the marker texture is not realistic, and color is not properly blended on the toy";
  // matched to Crayola's own photos of coloured pets): the ink soaks into the fuzz, so there are no strokes: a patch is soft dabs that build up
  // dense in the middle and feather out at the edge, neighbouring colours melt into each other, a fine fibre speckle runs through the ink,
  // and the toy's own shading shows through (the layer is multiplied over the photo). Every piece is built once and stamped.
  const dabs = {};
  function dab(col) {   // one soft round dab of ink, tinted, 64 px
    if (dabs[col]) return dabs[col];
    const c = document.createElement('canvas'); c.width = c.height = 64; const q = c.getContext('2d'), gr = q.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, col); gr.addColorStop(.45, col); gr.addColorStop(1, col + '00'); q.fillStyle = gr; q.fillRect(0, 0, 64, 64);
    return (dabs[col] = c);
  }
  function speckle(dark) {   // the flocking: fine random flecks, light ones punched out of the ink, dark ones laid into it
    const k0 = dark ? 'd' : 'l'; if (dabs[k0]) return dabs[k0];
    const c = document.createElement('canvas'); c.width = c.height = 192; const q = c.getContext('2d');
    for (let k = 0; k < (dark ? 600 : 1200); k++) { const o = dark ? 5000 : 0, x = hash(k * 3.1 + o) * 192, y = hash(k * 7.7 + 11 + o) * 192, r = .4 + hash(k * 1.3 + 3 + o) * (dark ? .9 : 1.2);
      q.fillStyle = dark ? `rgba(20,10,30,${.05 + hash(k * 2.9 + 4 + o) * .14})` : `rgba(0,0,0,${.12 + hash(k * 4.3 + 5 + o) * .3})`; q.beginPath(); q.arc(x, y, r, 0, 7); q.fill(); }
    return (dabs[k0] = c);
  }
  function markerPatch(g, cx, cy, rx, ry, col, seed, prog = 1) {
    // a kid's spot: a main blob and two smaller lobes, filled with overlapping dabs swept in from one side (prog reveals the sweep)
    const rnd = k => seeded(seed * 31 + k), lobes = [[0, 0, 1, 1], [(rnd(1) - .5) * 1.1, (rnd(2) - .5) * 1.1, .55 + rnd(3) * .25, .55 + rnd(4) * .25], [(rnd(5) - .5) * 1.2, (rnd(6) - .5) * 1.2, .4 + rnd(7) * .25, .45 + rnd(8) * .2]];
    const inside = (x, y) => lobes.reduce((m, [ox, oy, sx, sy]) => Math.max(m, 1 - Math.hypot((x - ox) / sx, (y - oy) / sy)), -1);   // >0 inside, 1 at a lobe centre
    const d = Math.min(rx, ry) * .55, step = .22, stamp = dab(col), pts = [];
    for (let y = -1.6; y <= 1.6; y += step) for (let x = -1.6; x <= 1.6; x += step) {
      const jx = x + (hash(seed * 97 + x * 131 + y * 17) - .5) * step, jy = y + (hash(seed * 61 + y * 113 + x * 29 + 5) - .5) * step;
      const inn = inside(jx, jy); if (inn > -.08) pts.push([jx, jy, inn]);
    }
    pts.sort((p1, p2) => p1[0] - p2[0]);   // the sweep: left to right, as the marker moves
    const last = Math.max(1, Math.round(pts.length * prog));
    g.save(); g.globalCompositeOperation = 'source-over';
    for (let k = 0; k < last; k++) { const [x, y, inn] = pts[k], s = d * (1.6 + Math.max(0, inn) * .9); g.globalAlpha = .16 + Math.max(0, Math.min(1, inn + .1)) * .34; g.drawImage(stamp, cx + x * rx - s / 2, cy + y * ry - s / 2, s, s); }
    g.restore();
  }
  // the photo's colour: the ink layer clipped to the toy's alpha and multiplied over the photo; rebuilt when the coat changes, and a few
  // times while the newest patch sweeps in
  const XM = {};   // Christmas pictures drawn in the scene (the bow on the box, the confetti stars); the toy itself only ever takes colour (owner 00:09)
  const coatCache = { key: '', c: null };
  function petPhoto(ctx, art, x, y, w, h, coat, colours, prog = 1) {
    ctx.drawImage(art, x, y, w, h);
    if (!coat.length) return;
    const step = Math.min(8, Math.floor(prog * 8)), key = coat.join(',') + '|' + art.width + '|' + step 
    if (coatCache.key !== key) {
      const c = coatCache.c || document.createElement('canvas'); c.width = art.width; c.height = art.height; const g = c.getContext('2d');
      g.clearRect(0, 0, c.width, c.height);
      coat.forEach((ci, i) => { const p = PHOTO_PATCHES[i % PHOTO_PATCHES.length], pr = i === coat.length - 1 ? Math.max(.15, step / 8) : 1; markerPatch(g, p[0] * c.width, p[1] * c.height, p[2] * c.width, p[3] * c.height, colours[ci], i * 7 + 3, pr); });
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = g.createPattern(speckle(false), 'repeat'); g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'source-atop'; g.fillStyle = g.createPattern(speckle(true), 'repeat'); g.fillRect(0, 0, c.width, c.height);
      g.globalCompositeOperation = 'destination-in'; g.drawImage(art, 0, 0); g.globalCompositeOperation = 'source-over';
      coatCache.key = key; coatCache.c = c;
    }
    ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.drawImage(coatCache.c, x, y, w, h); ctx.restore();
  }
  // the shadow takes the toy's shape (owner 23:30; rule 25): its own silhouette, flattened onto the floor and thrown away from the room's
  // light (upper left → down-right), softened by downscaling, plus darker contact patches under the paws; built once from the photo
  const shadowCache = {};
  function petShadow(art) {
    if (shadowCache.c && shadowCache.src === art) return shadowCache;
    const W0 = 256, H0 = Math.round(256 * art.height / art.width), sil = document.createElement('canvas'); sil.width = W0; sil.height = H0;
    const s = sil.getContext('2d'); s.drawImage(art, 0, 0, W0, H0); s.globalCompositeOperation = 'source-in'; s.fillStyle = '#1b1208'; s.fillRect(0, 0, W0, H0);
    const soft = document.createElement('canvas'); soft.width = W0 / 4; soft.height = H0 / 4; soft.getContext('2d').drawImage(sil, 0, 0, W0 / 4, H0 / 4);   // a cheap blur: down and up
    const a = s.getImageData(0, Math.round(H0 * .93), W0, Math.round(H0 * .07)).data, paws = []; let run = null;   // paws: the alpha runs in the bottom 7%
    for (let x = 0; x < W0; x++) { let on = false; for (let y = 0; y < a.length / 4 / W0; y++) if (a[(y * W0 + x) * 4 + 3] > 60) { on = true; break; } if (on && !run) run = [x, x]; else if (on) run[1] = x; else if (run) { paws.push(run); run = null; } }
    if (run) paws.push(run);
    Object.assign(shadowCache, { src: art, c: soft, paws: paws.map(([x0, x1]) => [(x0 + x1) / 2 / W0, (x1 - x0 + 1) / W0]) });
    return shadowCache;
  }
  function drawPetShadow(ctx, art, x, y, w, h, face) {   // x,y = the box's top-left in the pet's own (possibly mirrored) space; feet on y + h
    const sh = petShadow(art), fy = y + h;
    ctx.save(); ctx.globalAlpha = .3;
    ctx.translate(x, fy); ctx.transform(1, 0, -.35 * face, .26, 0, 0);   // feet on the floor line, the head thrown back behind the toy at 20% height, leaning right (away from the upper-left light)
    ctx.drawImage(sh.c, 0, -h, w, h); ctx.restore();
    ctx.save(); ctx.globalAlpha = .55; const soft = dab('#1b1208');   // contact: a feathered dark patch under each paw, wider than the paw, very flat
    sh.paws.forEach(([px, pw]) => { const rw = Math.max(4, pw * w * 1.5), rh = Math.max(3, h * .045); ctx.drawImage(soft, x + px * w - rw / 2, fy - rh * .55, rw, rh); });
    ctx.restore();
  }
  const rr = (ctx, x, y, w, h, r) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); };
  const ell = (ctx, x, y, rx, ry, fill, stroke, lw) => { ctx.beginPath(); ctx.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, 7); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); } };
  const seeded = i => ((i * 9301 + 49297) % 233280) / 233280;
  const hash = i => { const s = Math.sin(i * 12.9898 + 78.233) * 43758.5453; return s - Math.floor(s); };   // for textures: the linear `seeded` puts successive points on straight lines (they showed as stripes in the ink)

  // ── the pet silhouette (grey stand-in for Crayola's own Color Pets photo): body, head, ears, tail, legs, in a box w × h ──
  function petPath(ctx, x, y, w, h) {
    ctx.beginPath();
    ctx.ellipse(x + w * .46, y + h * .64, w * .36, h * .27, 0, 0, 7);
    ctx.moveTo(x + w * .9, y + h * .32); ctx.ellipse(x + w * .7, y + h * .32, w * .2, h * .21, 0, 0, 7);
    ctx.moveTo(x + w * .66, y + h * .1); ctx.ellipse(x + w * .62, y + h * .1, w * .05, h * .08, -.4, 0, 7);
    ctx.moveTo(x + w * .86, y + h * .1); ctx.ellipse(x + w * .82, y + h * .1, w * .05, h * .08, .4, 0, 7);
    ctx.moveTo(x + w * .14, y + h * .55); ctx.ellipse(x + w * .09, y + h * .53, w * .09, h * .06, -.5, 0, 7);
    [.24, .38, .56, .68].forEach(f => { ctx.moveTo(x + w * (f + .06), y + h * .86); ctx.roundRect(x + w * f, y + h * .8, w * .1, h * .2, w * .04); });
  }
  function pet(ctx, x, y, w, h, coat, colours, o = {}) {   // x,y = top-left of the box; coat = colour indexes in fill order
    ctx.save();
    petPath(ctx, x, y, w, h); ctx.fillStyle = '#fbfbfd'; ctx.fill(); ctx.strokeStyle = G1; ctx.lineWidth = Math.max(1.5, w * .012); ctx.stroke();
    ctx.save(); petPath(ctx, x, y, w, h); ctx.clip();   // the colour stays on the pet: patches are clipped to its silhouette (in the build: to the photo's alpha)
    coat.forEach((c, i) => { const p = PATCHES[i]; splatBlob(ctx, x + p[0] * w, y + p[1] * h, p[2] * w, p[3] * h, colours[c], i * 7 + 3); });
    ctx.restore();
    ell(ctx, x + w * .76, y + h * .29, w * .025, w * .025, INK);   // the eye
    ctx.beginPath(); ctx.arc(x + w * .78, y + h * .38, w * .04, .2, 2.6); ctx.strokeStyle = INK; ctx.lineWidth = Math.max(1, w * .01); ctx.stroke();
    if (o.label) { const m = ctx.getTransform(); ctx.save(); if (m.a < 0) { ctx.translate(x + w * .46, 0); ctx.scale(-1, 1); ctx.translate(-(x + w * .46), 0); } ctx.font = `800 ${Math.max(8, w * .07)}px Nunito, Inter, sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(29,27,38,.45)'; ctx.fillText('COLOR PET · photo', x + w * .46, y + h * .66); ctx.restore(); }   // the label reads the right way round when the pet faces left
    ctx.restore();
  }
  function splatBlob(ctx, cx, cy, rx, ry, col, seed) {   // a marker splat: an ellipse with a few drops round its rim
    ctx.fillStyle = col; ell(ctx, cx, cy, rx, ry, col);
    for (let k = 0; k < 6; k++) { const a = seeded(seed + k) * 6.283, d = 1 + seeded(seed + k + 20) * .35; ell(ctx, cx + Math.cos(a) * rx * d, cy + Math.sin(a) * ry * d, rx * .22, ry * .3, col); }
  }
  function ornament(ctx, x, y, r, col, rot, cell) {
    const art = window.LAYERS && window.LAYERS.ART.L2, m = window.LAYERS && window.LAYERS.META.ornaments;
    if (art && m && cell != null) {   // the picture: its cell drawn centred on the bauble, the cap above (the sheet's bauble fills ~78% of its cell)
      const cs = m.cell, d = r * 2 / .78; ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0); ctx.drawImage(art, cell * cs, 0, cs, cs, -d / 2, -d / 2 - r * .12, d, d); ctx.restore(); return;
    }
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot || 0);
    ctx.fillStyle = G2; rr(ctx, -r * .28, -r * 1.22, r * .56, r * .34, r * .08); ctx.fill();
    ctx.beginPath(); ctx.arc(0, -r * 1.3, r * .16, 0, 7); ctx.strokeStyle = G2; ctx.lineWidth = Math.max(1, r * .08); ctx.stroke();
    ell(ctx, 0, 0, r, r, col); ell(ctx, -r * .34, -r * .34, r * .26, r * .2, 'rgba(255,255,255,.65)');
    ctx.restore();
  }
  function bubble(ctx, x, y, r, t) {
    const wob = 1 + Math.sin(t * 9) * .04;
    ctx.save(); ctx.globalAlpha = .9; ell(ctx, x, y, r * wob, r / wob, 'rgba(225,242,255,.55)', '#8fc3ea', Math.max(1.5, r * .1));
    ctx.beginPath(); ctx.arc(x - r * .3, y - r * .3, r * .45, 3.4, 4.6); ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, r * .14); ctx.stroke(); ctx.restore();
  }
  // ── the room plate's greybox shape (also the L1 blueprint): wall, the tree, poinsettias, the floor and rug ──
  function room(ctx, x, y, w, h, G, o = {}) {
    const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#d9d4cc'); g.addColorStop(1, '#c8c1b7'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
    const fy = y + G.floorY * h - h * .05; ctx.fillStyle = '#a99c8c'; ctx.fillRect(x, fy, w, h - (fy - y)); ell(ctx, x + w * .5, fy + (h - (fy - y)) * .55, w * .46, (h - (fy - y)) * .32, '#b9aa98');
    if (G.tree) {   // the tree: three tiers, its widest at the drop zone's bottom
      const T = G.tree, tx = x + T.x * w; ctx.fillStyle = '#9fae9f'; ctx.strokeStyle = G1; ctx.lineWidth = Math.max(1.5, w * .004);
      [[T.top, T.top + (T.base - T.top) * .42, .5], [T.top + (T.base - T.top) * .25, T.top + (T.base - T.top) * .72, .78], [T.top + (T.base - T.top) * .52, T.base, 1]].forEach(([a, b, k]) => { ctx.beginPath(); ctx.moveTo(tx, y + a * h); ctx.lineTo(tx + T.half * k * w, y + b * h); ctx.lineTo(tx - T.half * k * w, y + b * h); ctx.closePath(); ctx.fill(); ctx.stroke(); });
      ctx.fillStyle = G2; ctx.fillRect(tx - w * .03, y + T.base * h, w * .06, (fy - y) - T.base * h + h * .01);
      star(ctx, tx, y + T.top * h - h * .012, w * .045);
    }
    if (G.tree && G.tree.top < (G.hudTop || .12)) {   // a close camera crops the tree: what rises into the HUD band fades into the wall, so the band stays plain
      const t0 = y + (G.hudTop || .12) * h, fade = ctx.createLinearGradient(0, t0 - h * .02, 0, t0 + h * .05); fade.addColorStop(0, '#d9d4cc'); fade.addColorStop(1, 'rgba(217,212,204,0)');
      ctx.fillStyle = '#d9d4cc'; ctx.fillRect(x, y, w, t0 - y - h * .02); ctx.fillStyle = fade; ctx.fillRect(x, t0 - h * .02, w, h * .07);
    }
    (G.pots || []).forEach(px => poinsettia(ctx, x + px * w, fy + h * .012, w * .09));
    if (G.gifts) G.gifts.forEach(([gx, gw, gh]) => { ctx.fillStyle = G3; ctx.strokeStyle = G1; ctx.lineWidth = Math.max(1.5, w * .004); rr(ctx, x + gx * w, fy - gh * h + h * .01, gw * w, gh * h, w * .006); ctx.fill(); ctx.stroke(); ctx.fillStyle = G4; ctx.fillRect(x + (gx + gw / 2) * w - w * .006, fy - gh * h + h * .01, w * .012, gh * h); });
    if (o.explain) {
      const Z = (zx, zy, zw, zh, col, t) => window.GB.bpZone(ctx, x + zx * w, y + zy * h, zw * w, zh * h, col, t, true);
      Z(0, 0, 1, .12, '#ffa500', 'HUD BAND 0-12%: plain calm wall; lockup left, colour dots right');
      Z(.03, G.lightsY - .02, .94, .05, '#ff4d6d', 'LIGHTS LINE: the countdown string is CODE; keep the wall plain here');
      Z(.5 - G.spawn.half - .02, G.spawn.y0, (G.spawn.half + .02) * 2, G.spawn.y1 - G.spawn.y0, '#00e5ff', 'DROP ZONE: ornaments shake loose here; branches BARE (no baubles in the plate)');
      Z(0, G.floorY - G.petH, 1, G.petH, '#7CFC00', 'PET LANE: the pet walks the whole width on the floor line; keep it clear, even, mid-value');
      window.GB.bpLabel(ctx, x + 30, y + G.floorY * h + 30, `FLOOR LINE ${Math.round(G.floorY * 100)}%`, '#ffd23a', true);
    }
  }
  function star(ctx, x, y, r) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr2 = i % 2 ? r * .45 : r; ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } ctx.closePath(); ctx.fillStyle = G4; ctx.fill(); ctx.strokeStyle = G1; ctx.lineWidth = 1.5; ctx.stroke(); }
  function poinsettia(ctx, x, y, r) { ctx.fillStyle = G2; rr(ctx, x - r * .5, y - r * .7, r, r * .7, r * .1); ctx.fill(); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; ctx.save(); ctx.translate(x + Math.cos(a) * r * .45, y - r * 1.1 + Math.sin(a) * r * .35); ctx.rotate(a + 1.57); ell(ctx, 0, 0, r * .18, r * .4, '#c9a3a3', G1, 1); ctx.restore(); } ell(ctx, x, y - r * 1.1, r * .12, r * .12, '#d8c27a'); }
  // the countdown (owner 23:38: "the lights going out are not really that indicative; can it be more prominent?"): a bigger string of
  // twelve bulbs swagged across the tree, each with a real glow; the next bulb to go flickers through the end of its slice, and when it
  // goes it flashes white and throws sparks; dead bulbs are dark glass. In the last 5 s every bulb still lit blinks red together (and the
  // header's yellow rule, the fuse, echoes it in the HUD).
  const glows = {};
  function glow(col) {   // a soft glow sprite per colour, built once (no shadowBlur)
    if (glows[col]) return glows[col]; const c = document.createElement('canvas'); c.width = c.height = 64; const q = c.getContext('2d'), gr = q.createRadialGradient(32, 32, 2, 32, 32, 32);
    gr.addColorStop(0, col); gr.addColorStop(.35, col + '88'); gr.addColorStop(1, col + '00'); q.fillStyle = gr; q.fillRect(0, 0, 64, 64); return (glows[col] = c);
  }
  const bulbFx = { lit: -1, pops: [] };
  function lights(ctx, S, W, H, CONFIG, G) {
    const n = 12, x1 = W * .05, x2 = W * .95, y0 = H * G.lightsY, gap = (x2 - x1) / (n - 1), sag = H * .03;
    const yAt = i => y0 + Math.sin((i / (n - 1)) * Math.PI * 2 - Math.PI / 2) * sag * .5 + sag * .5;   // two swags across the tree
    ctx.strokeStyle = '#2f3a2c'; ctx.lineWidth = Math.max(1.5, W * .004); ctx.beginPath(); ctx.moveTo(x1, yAt(0));
    for (let i = 1; i < n; i++) ctx.quadraticCurveTo(x1 + gap * (i - .5), (yAt(i - 1) + yAt(i)) / 2 + H * .008, x1 + gap * i, yAt(i)); ctx.stroke();
    const f = S.timeLeft / CONFIG.roundSecs * n, lit = Math.ceil(f), frac = f - Math.floor(f), low = S.timeLeft > 0 && S.timeLeft < 5 && S.mode !== 'attract';
    const playing = S.mode === 'play' || S.mode === 'attract';
    if (lit < bulbFx.lit && playing && S.elapsed > .1) for (let k = lit; k < bulbFx.lit; k++) bulbFx.pops.push({ i: k, t: 0 });   // a bulb just went out
    bulbFx.lit = lit;
    const cols = ['#ff4a3d', '#ffd23a', '#3fd16a', '#4fb6ff'], blinkOff = low && Math.floor(S.elapsed * 4) % 2 === 1, r = W * .019;
    for (let i = 0; i < n; i++) {
      const bx = x1 + gap * i, by = yAt(i) + r * .9, on = i < lit;
      const next = on && i === lit - 1 && frac < .35 && playing;   // the next to go flickers through the end of its slice
      const flick = next ? (Math.sin(S.elapsed * 40 + i) > -.2 ? 1 : .25) : 1, col = low ? '#ff3b2f' : cols[i % 4], lum = on ? (low ? (blinkOff ? .25 : 1) : flick) : 0;
      ctx.fillStyle = '#4a4a50'; ctx.fillRect(bx - r * .45, by - r * 1.55, r * .9, r * .6);   // the socket
      if (lum > .3) { ctx.globalAlpha = .75 * lum; ctx.drawImage(glow(col), bx - r * 3.6, by - r * 3.2, r * 7.2, r * 7.2); ctx.globalAlpha = 1; }
      ctx.save(); ctx.translate(bx, by); ctx.beginPath(); ctx.ellipse(0, 0, r * .72, r * 1.05, 0, 0, 7);
      ctx.fillStyle = on ? col : '#3b3842'; ctx.globalAlpha = on ? .35 + .65 * lum : 1; ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(-r * .25, -r * .35, r * .18, r * .3, -.4, 0, 7); ctx.fillStyle = on ? 'rgba(255,255,255,.75)' : 'rgba(255,255,255,.22)'; ctx.fill();
      ctx.restore();
    }
    bulbFx.pops = bulbFx.pops.filter(p => (p.t += 1 / 60) < .45);
    bulbFx.pops.forEach(p => {   // the bulb that just went: a white flash and four sparks falling away
      const bx = x1 + gap * p.i, by = yAt(p.i) + r * .9, k = p.t / .45;
      ctx.globalAlpha = (1 - k) * .9; ctx.drawImage(glow('#ffffff'), bx - r * 5 * (1 - k * .5), by - r * 5 * (1 - k * .5), r * 10 * (1 - k * .5), r * 10 * (1 - k * .5));
      for (let s = 0; s < 4; s++) { const a = -2.3 + s * .9, d = r * (1 + k * 4); ell(ctx, bx + Math.cos(a) * d, by + Math.sin(a) * d + k * k * r * 6, r * .18, r * .18, '#ffe9a8'); }
      ctx.globalAlpha = 1;
    });
  }
  function view(o) {
    const G = o.geometry;
    { const AS = o.build ? 'assets/game/' : '../assets/game/'; [['bow', 'xmas-bow'], ['star', 'xmas-star']].forEach(([k, n]) => { const im = new Image(); im.src = AS + n + '.webp'; XM[k] = im; }); }
    G.stageScale = G.stageScale || 1.45; G.stageY = G.stageY || .48; G.stageX = won => won ? .34 : .5;
    G.treeHalf = G.tree ? (yy => clampN(G.tree.half * Math.min(1, Math.max(.15, (yy - G.tree.top) / (G.tree.base - G.tree.top))) * .9, .06, G.spawn.half)) : null;
    const box = { x: 0, y: 0, w: 1, h: 1, anchor: 'top-left' };
    const petBox = { w: G.petW, h: G.petH, anchor: 'bottom' };
    const VIEW = {
      id: o.id, title: o.title, canvas: [640, 960], camera: o.camera, geometry: () => G, config: o.config || null,
      build: !!o.build, sound: !!o.build, lang: o.lang || null, music: o.build ? 'assets/audio/music.mp3' : null, samples: o.build ? { splat: 'assets/audio/splat.mp3', bubble: 'assets/audio/bubble.mp3' } : {},
      assets: o.build ? 'assets/game/' : '../assets/game/', artLayers: o.build ? ['L1', 'L2', 'L3', 'L5'] : ['L3', 'L5'],   // the greybox carries only the brand's real assets (toy, box, logo); a build has the art too
      brandLogo: o.build ? 'assets/brand/logo.webp' : '../assets/brand/logo.webp',
      layers: [
        { id: 'L1', name: 'room', type: 'plate', canvas: [1280, 1920], key: null, camera: o.camera, box,
          notes: o.plateNotes, shape(ctx, x, y, w, h, S, cell, opt) { room(ctx, x, y, w, h, G, opt || {}); } },
        { id: 'L2', name: 'ornaments', type: 'sheet', canvas: [1536, 512], key: '#4A5A7A', camera: o.camera, box: { w: G.ornR * 2.4, h: G.ornR * 2.4 * 640 / 960 * 1, anchor: 'centre' },
          cells: { cols: 3, rows: 1, names: ['red', 'green', 'gold'] },
          notes: 'picture ×3 · one glossy Christmas bauble per cell (red, green, gold), same size, same light top-left, a small silver cap and loop on top, straight on, no shadow; the fall, the sway, the spin and the splat are code',
          shape(ctx, x, y, w, h, S, cell) { const cols = ['#d62828', '#2a9d4b', '#e8b400']; ornament(ctx, x + w / 2, y + h * .56, Math.min(w, h) * .36, cols[cell || 0], 0); } },
        { id: 'L3', name: 'pet', type: 'sprite', source: 'supplied', canvas: [1024, 1024], key: null, camera: o.camera, box: petBox,
          notes: "SUPPLIED · the white Color Pet cut from Crayola's own product photo (Mexico site: Color Pets Dinosaur), never generated; facing right, side-on, feet on the box floor; the colour patches are code, clipped to the photo's alpha",
          shape(ctx, x, y, w, h) { pet(ctx, x, y, w, h, [], ['#000'], { label: true }); } },
        { id: 'L4', name: 'lockup', type: 'brand', canvas: [800, 240], key: null, notes: "SUPPLIED · Crayola's logo from the client's kit; grey placeholder until then, never drawn",
          shape(ctx, x, y, w, h) { ctx.fillStyle = G4; ctx.fillRect(x, y, w, h); } },
        { id: 'L5', name: 'pack', type: 'sprite', source: 'supplied', canvas: [1024, 1024], key: null, notes: "SUPPLIED · the Color Pets pack shot from Crayola's product photos, for the win card",
          shape(ctx, x, y, w, h) { ctx.fillStyle = G4; ctx.fillRect(x, y, w, h); } },
      ],
      drawFrame(ctx, S, W, H, CONFIG) {
        const plate = window.LAYERS && window.LAYERS.ART.L1;
        if (plate) ctx.drawImage(plate, 0, 0, W, H);
        else if (!G._room || G._room.w !== Math.round(W) || G._room.h !== Math.round(H)) {   // the room is static: drawn once per size, behind the loading
          const c = document.createElement('canvas'), d = Math.min(1.5, devicePixelRatio || 1); c.width = Math.round(W * d); c.height = Math.round(H * d);
          const cx = c.getContext('2d'); cx.scale(d, d); room(cx, 0, 0, W, H, G); G._room = { w: Math.round(W), h: Math.round(H), c };
        }
        if (!plate) ctx.drawImage(G._room.c, 0, 0, W, H);
        lights(ctx, S, W, H, CONFIG, G);
        S.fx.filter(f => f.k === 'floor').forEach(f => { ctx.globalAlpha = Math.min(1, (2.4 - f.t) / .6) * .85; splatBlob(ctx, f.x * W, f.y * H, W * .05, H * .01, f.c, Math.round(f.x * 100)); ctx.globalAlpha = 1; });
        const orR = G.ornR * W;
        S.items.forEach(it => {
          const x = it.x * W, y = it.y * H;
          if (it.kind === 'orn') { if (it.state === 'fall') ornament(ctx, x, y, orR, CONFIG.colours[it.c], it.rot + Math.sin(it.t * 3 + it.ph) * .25, it.c); else if (it.state === 'landed') { ctx.globalAlpha = 1 - it.t / .5; ornament(ctx, x, G.floorY * H - orR * .6, orR * (1 + it.t), CONFIG.colours[it.c], 1.4, it.c); ctx.globalAlpha = 1; } }
          else if (it.state === 'fall') bubble(ctx, x, y, orR * 1.05, it.t);
          else { ctx.globalAlpha = 1 - it.t / .5; ctx.strokeStyle = '#8fc3ea'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, it.state === 'landed' ? G.floorY * H - orR : y, orR * (1 + it.t * 3), 0, 7); ctx.stroke(); ctx.globalAlpha = 1; }
        });
        // the pet: faces where it walks, bobs as it walks, squashes on a catch, jumps on the win
        // facing with hysteresis (owner 23:50: a fast wiggle showed the pet looking both ways): it turns only after moving the other way for
        // 0.15 s at a real speed, and the turn is a quick squash through zero width (0.12 s), never a one-frame flip
        const p = S.pet, dirNow = Math.abs(p.vx) > .25 ? Math.sign(p.vx) : 0, dtF = 1 / 60;
        G._face = G._face || 1; G._turnT = G._turnT || 0;
        if (dirNow && dirNow !== G._face) { G._pend = (G._pend || 0) + dtF; if (G._pend > .15) { G._face = dirNow; G._pend = 0; G._turnT = .12; } } else G._pend = 0;
        G._turnT = Math.max(0, G._turnT - dtF);
        const face = G._face * (G._turnT > 0 ? Math.max(.08, Math.abs(1 - 2 * (G._turnT / .12))) : 1) * (G._turnT > .06 ? -1 : 1);
        // on either ending the pet walks up to centre stage, bigger, so the payoff (or the squeaky-clean fail) stays visible above the card
        const ended = S.mode === 'reveal' || S.mode === 'win' || S.mode === 'fail', won = S.mode !== 'fail';
        const k = ended ? easeOut(Math.min(1, Math.max(0, (S.reveal - (won ? .9 : .2)) / .7))) : 0;
        const sc = 1 + k * (G.stageScale - 1), px = (p.x + (G.stageX(won) - p.x) * k) * W, py = (G.floorY + (G.stageY - G.floorY) * k) * H;
        const pw = G.petW * W * sc, ph = G.petH * H * sc, walk = Math.min(1, Math.abs(p.vx) / CONFIG.petSpeed);
        const jump = won && ended ? Math.abs(Math.sin((S.reveal || 0) * 6)) * ph * .18 * (k < 1 ? 1 : .5) : 0;
        const bob = Math.abs(Math.sin(performance.now() / 90)) * ph * .03 * walk, sq = 1 - p.squash * .12;
        if (k > 0) { ctx.fillStyle = `rgba(255,253,247,${k * .35})`; ctx.fillRect(0, 0, W, H); }
        if (won && k > 0) packShot(ctx, W, H, G, k);
        // the shadow: in play the toy casts its own shape (drawn with it below); once the round ends (owner 23:37) a simple soft oval stays on
        // the floor under it, shrinking and fading as it hops up, full again when it lands
        if (ended || !(window.LAYERS && window.LAYERS.ART.L3)) {
          const lift = won && ended ? Math.min(1, jump / Math.max(1, ph * .18)) : 0, sw = pw * .44 * (1 - lift * .35), shh = ph * .07 * (1 - lift * .35);
          ctx.save(); ctx.globalAlpha = .42 * (1 - lift * .55); ctx.drawImage(dab('#1b1208'), px - sw, py - shh * .6, sw * 2, shh * 2); ctx.restore();
        }
        ctx.save(); ctx.translate(px, py - jump - bob); ctx.scale((k > 0 ? 1 : face) * (1 + p.squash * .08), sq);
        const art = window.LAYERS && window.LAYERS.ART.L3;
        if (art && !ended) { ctx.save(); ctx.translate(0, bob); drawPetShadow(ctx, art, -pw / 2, -ph, pw, ph, face); ctx.restore(); }   // on the floor, not lifted by the walk bob
        if (art) petPhoto(ctx, art, -pw / 2, -ph, pw, ph, S.coat, CONFIG.colours, S.coatT == null ? 1 : Math.min(1, (S.elapsed - S.coatT) / .25));   // the real toy, coloured through its own alpha; the newest patch scribbles in over 0.25 s
        else pet(ctx, -pw / 2, -ph, pw, ph, S.coat, CONFIG.colours, { label: !S.coat.length });
        ctx.restore();
        if (p.wash > 0 && !ended) for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283 + p.wash * 2; bubble(ctx, p.x * W + Math.cos(a) * pw * .45 * (1.4 - p.wash * .4), G.floorY * H - ph * .5 + Math.sin(a) * ph * .4 - (1 - p.wash) * ph * .4, orR * .4 * p.wash + 1, i); }
        S.fx.forEach(f => {
          if (f.k === 'splat') { const k = f.t / .7; ctx.globalAlpha = 1 - k; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283, d = pw * (.2 + k * .5); ell(ctx, f.x * W + Math.cos(a) * d, f.y * H + Math.sin(a) * d * .6, pw * .04 * (1 - k * .5), pw * .04 * (1 - k * .5), f.c); } ctx.globalAlpha = 1; }
          if (f.k === 'word' && f.txt) { const k = f.t / .8; ctx.globalAlpha = 1 - k * k; ctx.font = `900 ${W * .075}px Nunito, Inter, sans-serif`; ctx.textAlign = 'center'; ctx.lineWidth = W * .014; ctx.strokeStyle = '#00502E'; const ty = (G.floorY - G.petH - .03) * H - k * H * .05; ctx.strokeText(f.txt, p.x * W, ty); ctx.fillStyle = '#fff'; ctx.fillText(f.txt, p.x * W, ty); ctx.globalAlpha = 1; }
          if (f.k === 'pop') { const k = f.t / .7; ctx.globalAlpha = 1 - k; for (let i = 0; i < 5; i++) ell(ctx, f.x * W + (i - 2) * W * .02 * (1 + k * 2), f.y * H - k * H * .04 - (i % 2) * H * .01, W * .008, W * .008, null, '#8fc3ea', 1.5); ctx.globalAlpha = 1; }
        });
        if (S.flash > 0) { ctx.fillStyle = `rgba(160,210,255,${S.flash * .18})`; ctx.fillRect(0, 0, W, H); }
        if (S.confetti && (S.mode === 'reveal' || S.mode === 'win')) {   // confetti in Crayola's colours, tumbling (a strip that turns shows its edge)
          const CC = ['#e0362c', '#f08a1c', '#FFCC33', '#00892D', '#0078C2', '#592E87'];
          S.confetti.forEach((c, k) => { if (c.t > 0 || c.y > 1.05) return; if (k % 5 === 0 && XM.star && XM.star.naturalWidth) { const s = c.w * W * 2.2; ctx.save(); ctx.translate(c.x * W, c.y * H); ctx.rotate(c.r * .3); ctx.drawImage(XM.star, -s / 2, -s / 2, s, s); ctx.restore(); return; } ctx.save(); ctx.translate(c.x * W, c.y * H); ctx.rotate(c.r); ctx.scale(1, Math.abs(Math.cos(c.r * 1.7)) * .8 + .2); ctx.fillStyle = CC[c.c]; ctx.fillRect(-c.w * W / 2, -c.w * W * .3, c.w * W, c.w * W * .6); ctx.restore(); });
        }
        if (ended && won) for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283 + S.reveal * 1.5, d = pw * (.7 + Math.sin(S.reveal * 4 + i) * .1); ell(ctx, px + Math.cos(a) * d, py - ph * .55 - jump + Math.sin(a) * d * .7, W * .007, W * .007, ['#ffd23a', '#ff5a4f', '#47d16c'][i % 3]); }
        if (ended && !won && k > 0) for (let i = 0; i < 6; i++) bubble(ctx, px + Math.sin(S.reveal * 2 + i * 1.7) * pw * .5, py - ph * (.3 + ((S.reveal * .4 + i / 6) % 1)), W * .012 + i % 3 * W * .004, S.reveal + i);
      },
    };
    return VIEW;
  }
  const clampN = (v, a, b) => Math.max(a, Math.min(b, v));
  const easeOut = x => 1 - (1 - x) * (1 - x) * (1 - x);
  function packShot(ctx, W, H, G, k) {   // L5: the Color Pets pack shot (Crayola's photo), standing beside the dressed pet on the win
    const bw = W * .36, bh = H * .2, x = W * .6, y = H * G.stageY - bh;
    ctx.save(); ctx.globalAlpha = Math.min(1, k * 1.4); ctx.translate(0, (1 - k) * H * .05);
    const art = window.LAYERS && window.LAYERS.ART.L5;
    if (art) { const s = Math.min(bw / art.width, bh / art.height), dw = art.width * s, dh = art.height * s, bx = x + (bw - dw) / 2, by = y + bh - dh, soft = window.CPScene._dab;
      // depth (owner 00:09: "should we add some shadow or depth for the box?"): a warm glow behind it, a soft drop shadow thrown back-right
      // from the room's upper-left light, a dark contact patch where it stands, and a thin light edge on its left side
      if (soft) { ctx.save(); ctx.globalAlpha = .55; ctx.drawImage(soft('#ffd98a'), bx - dw * .35, by - dh * .3, dw * 1.7, dh * 1.6); ctx.restore();
        ctx.save(); ctx.globalAlpha = .5; ctx.drawImage(soft('#1b1208'), bx + dw * .04, by + dh * .06, dw * 1.14, dh * 1.08); ctx.restore();
        ctx.save(); ctx.globalAlpha = .55; ctx.drawImage(soft('#1b1208'), bx - dw * .08, by + dh * .9, dw * 1.16, dh * .2); ctx.restore(); }
      ctx.drawImage(art, bx, by, dw, dh);
      ctx.save(); const edge = ctx.createLinearGradient(bx, 0, bx + dw * .12, 0); edge.addColorStop(0, 'rgba(255,240,210,.45)'); edge.addColorStop(1, 'rgba(255,240,210,0)'); ctx.fillStyle = edge; ctx.fillRect(bx, by, dw * .12, dh); ctx.restore();
      const bow = XM.bow; if (bow && bow.complete && bow.naturalWidth) { const bwid = dw * .4, bh2 = bwid * bow.naturalHeight / bow.naturalWidth; ctx.save(); ctx.translate(bx + dw * .9, by + dh * .06); ctx.rotate(.3); ctx.drawImage(bow, -bwid / 2, -bh2 / 2, bwid, bh2); ctx.restore(); } }   // a Christmas gift: the bow on the lid's top-right corner, clear of the product name (it covered "Color Pets")
    else { ctx.fillStyle = '#ece9f0'; ctx.strokeStyle = '#9a96a3'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]); rr(ctx, x, y, bw, bh, W * .02); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
      ctx.font = `800 ${W * .032}px Nunito, Inter, sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = '#6c6876'; ctx.fillText('Color Pets', x + bw / 2, y + bh * .46); ctx.font = `700 ${W * .024}px Nunito, Inter, sans-serif`; ctx.fillText('pack · Crayola photo', x + bw / 2, y + bh * .58); }
    ctx.restore();
  }
  return { view, pet, PATCHES, _dab: col => dab(col) };
})();
