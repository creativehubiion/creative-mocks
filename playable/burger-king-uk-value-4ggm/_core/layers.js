/* Layer placement (D-015 item 4): one function draws a layer into its box in the game, using the art when
   it has loaded and the greybox shape otherwise; the same shape function renders the layer's blueprint.
   A layer:
     { id, name, type: plate|sprite|sheet|viewmodel|mask-texture|particle, canvas:[w,h], key, notes,
       box: { x, y, w, h, anchor }          frame fractions; anchor: 'centre' | 'bottom' | 'top' | 'left' | 'right' | 'corner-br' | 'corner-bl' | 'top-left'
       pivot?: [fx, fy]                       for viewmodel: the rotation point in frame fractions (box corner-br sits here)
       cells?: { cols, rows, names }          for sheets
     states?: true                          the cells are STATES of one object: generated as one base image + edits (rule 13); blueprint = the base state on ONE CELL's canvas (canvas ÷ cells), each edit on the same
       shape(ctx, x, y, w, h, S, cell)        draws the greybox shape inside the box (px); cell for sheets
       explain?(ctx, W, H)                    extra labels on the explained blueprint }
   The box aspect equals the canvas aspect, so the art fills the box exactly as the blueprint fills the canvas. */
window.LAYERS = (function () {
  const ART = {}, META = {};
  /* a picture that arrives while the game runs (the card posts {iionArt: {id, src}} as each piece lands, 2026-10-20)
     takes its place with a diffusion reveal: over 1.5 s in 12 steps the thing resolves from coarse blocks under grain
     to the sharp picture, the way an image model's preview does (the demo website's reveal). No ctx.filter, two
     small canvases made once: the phone budget holds (rule 27). */
  const REVEAL = {}, DIFF_MS = 1500, STEPS = 12;
  let rvCanvas = null, grainCanvas = null, grainStep = -1;
  function arrive(id, src) {
    const cur = ART[id]; if (cur && cur.src === src) return;
    const im = new Image(); im.onload = () => { ART[id] = im; REVEAL[id] = performance.now(); }; im.src = src;
  }
  function makeGrain() {
    const g = grainCanvas || (grainCanvas = document.createElement('canvas')); g.width = g.height = 48;
    const o = g.getContext('2d'), im = o.createImageData(48, 48);
    for (let i = 0; i < 48 * 48; i++) { const v = 110 + Math.random() * 145; im.data[i * 4] = v; im.data[i * 4 + 1] = v; im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    o.putImageData(im, 0, 0);
  }
  function drawRevealing(ctx, im, sx, sy, sw, sh, dx, dy, dw, dh, t) {
    const st = Math.min(STEPS, Math.floor(t * STEPS)), q = st / STEPS;
    const rv = rvCanvas || (rvCanvas = document.createElement('canvas'));
    const res = Math.max(6, Math.round(6 + (Math.min(256, Math.max(dw, dh)) - 6) * q * q));
    const rh = Math.max(1, Math.round(res * dh / Math.max(1, dw)));
    if (rv.width !== res || rv.height !== rh) { rv.width = res; rv.height = rh; }
    const o = rv.getContext('2d'); o.globalCompositeOperation = 'source-over'; o.globalAlpha = 1; o.clearRect(0, 0, rv.width, rv.height);
    o.imageSmoothingEnabled = true; o.drawImage(im, sx, sy, sw, sh, 0, 0, rv.width, rv.height);
    const noise = 0.85 * Math.pow(1 - q, 1.4);
    if (noise > 0.03) { if (st !== grainStep) { grainStep = st; makeGrain(); } o.globalAlpha = noise; o.globalCompositeOperation = 'source-atop'; o.drawImage(grainCanvas, 0, 0, rv.width, rv.height); o.globalAlpha = 1; o.globalCompositeOperation = 'source-over'; }
    ctx.imageSmoothingEnabled = true; ctx.drawImage(rv, dx, dy, dw, dh);
  }
  function load(layers, base, onSettle) {   // onSettle(id, ok) fires per layer (and for meta.json) so a build can hold its loader until everything is in
    onSettle && onSettle('meta', true);   // exported copy: meta.json is not fetched; this game never reads LAYERS.META
    layers.forEach(L => {
      if (!['plate', 'sprite', 'sheet', 'viewmodel', 'mask-texture', 'particle', 'occluder', 'tile'].includes(L.type) || !L.canvas) return;   // every picture layer with a canvas loads its file (a tile too, 2026-10-20: the game draws it from ART as a pattern)
      if (onSettle) onSettle.expect = (onSettle.expect || 0) + 1;
      const im = new Image(); im.onload = () => { ART[L.id] = im; onSettle && onSettle(L.id, true); }; im.onerror = () => { onSettle && onSettle(L.id, false); }; im.src = `${base}${L.name}.webp`;
    });
  }
  function boxPx(L, W, H, override) {
    const b = override || L.box; const w = b.w * W, h = b.h * H; let x = b.x * W, y = b.y * H;
    switch (b.anchor) {
      case 'centre': x -= w / 2; y -= h / 2; break;
      case 'bottom': x -= w / 2; y -= h; break;
      case 'top': x -= w / 2; break;
      case 'left': y -= h / 2; break;
      case 'right': x -= w; y -= h / 2; break;
      case 'corner-br': x -= w; y -= h; break;
      case 'corner-bl': y -= h; break;
    }
    return { x, y, w, h };
  }
  /* draw a layer in the game. opts: { box (override, frame fractions), rot (radians about the pivot), pivot ([px,py] in px), cell (sheet index), alpha }
     A brand layer (the lockup) is never drawn in the game (owner 2026-10-15): the brand mark is the engine's own, in
     the HUD and on the start and end cards, so a game that draws it would show it twice. Its blueprint still renders. */
  function draw(ctx, L, S, W, H, opts = {}) {
    const b = boxPx(L, W, H, opts.box); const im = ART[L.id];
    if (L.type === 'brand') return b;
    ctx.save(); if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    if (opts.rot) { const p = opts.pivot || [b.x + b.w / 2, b.y + b.h / 2]; ctx.translate(p[0], p[1]); ctx.rotate(opts.rot); ctx.translate(-p[0], -p[1]); }
    if (im) {
      let sx = 0, sy = 0, sw = im.width, sh = im.height;
      if (L.type === 'sheet' && L.cells) { sw = im.width / L.cells.cols; sh = im.height / L.cells.rows; const i = opts.cell || 0; sx = (i % L.cells.cols) * sw; sy = Math.floor(i / L.cells.cols) * sh; }
      const at = REVEAL[L.id], t = at ? (performance.now() - at) / DIFF_MS : 1;
      if (at && t >= 1) delete REVEAL[L.id];
      if (at && t < 1) drawRevealing(ctx, im, sx, sy, sw, sh, b.x, b.y, b.w, b.h, t);
      else ctx.drawImage(im, sx, sy, sw, sh, b.x, b.y, b.w, b.h);
    } else L.shape(ctx, b.x, b.y, b.w, b.h, S, opts.cell || 0);
    ctx.restore();
    return b;
  }
  /* render a layer's blueprint into its own canvas: the shape fills the canvas the way the art will fill the box */
  function blueprint(ctx, L, W, H, o) {
    if (L.type === 'plate' || L.type === 'mask-texture') { L.shape(ctx, 0, 0, W, H, null, 0, o); }
    else { ctx.fillStyle = L.key || '#4A5A7A'; ctx.fillRect(0, 0, W, H);
      if (L.type === 'sheet' && L.cells && !L.states) { const cw = W / L.cells.cols, ch = H / L.cells.rows; for (let i = 0; i < L.cells.cols * L.cells.rows; i++) { const x = (i % L.cells.cols) * cw, y = Math.floor(i / L.cells.cols) * ch; L.shape(ctx, x, y, cw, ch, null, i, o); if (o.explain) { ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 3; ctx.strokeRect(x, y, cw, ch); GB.bpLabel(ctx, x + 20, y + 40, `${i + 1} ${L.cells.names[i]}`, '#ffd23a', true); } } }
      else L.shape(ctx, 0, 0, W, H, null, o.cell || 0, o); }
    if (o.explain) { if (L.camera) { ctx.font = '700 34px Arial'; const t = 'CAMERA: ' + L.camera; if (ctx.measureText(t).width > W - 60) { const parts = t.split(', '); const mid = Math.ceil(parts.length / 2); GB.bpLabel(ctx, 30, H - 90, parts.slice(0, mid).join(', ') + ',', '#ffd23a', true); GB.bpLabel(ctx, 30, H - 40, parts.slice(mid).join(', '), '#ffd23a', true); } else GB.bpLabel(ctx, 30, H - 40, t, '#ffd23a', true); } if (L.explain) L.explain(ctx, W, H); }
  }

  /* ── lighting, shared (ported 2026-10-16 from the pipeline's sonic-01 build; greybox rules 11, 25, 26) ──────────────
     One light per scene, from VIEW.light.dir (a unit vector in screen terms: [-0.6, -0.8] is the upper left). Everything
     heavy is cached: no shadowBlur, no per-frame filters.
     grounded(ctx, L, S, W, H, { box, cell, lift, tier, dir })
       draws a layer whose base rests on the ground (box anchor 'bottom': x, y = the base point in frame fractions):
       the base is sunk SINK of its height below the ground line and clipped there, so no transparent margin or
       anti-aliased gap ever shows under it (nothing floats by accident); its shadow starts exactly at that base, in its
       own silhouette, at the scale it is drawn, thrown away from the light, faded by on-screen size so far objects never
       merge into a band; a thin contact patch where it touches. lift (frame fractions above the ground) is for an object
       really in the air: the shadow stays on the ground under it, smaller and lighter the higher it is.
       tier 1 (soft): a contact patch only (and the lifted drop shadow); tier 2 and 3: the silhouette shadow too. */
  const SINK = 0.025;
  let PATCH = null;
  function contact(ctx, x, y, w, a = 1) {
    if (!PATCH) { PATCH = document.createElement('canvas'); PATCH.width = 128; PATCH.height = 64; const c = PATCH.getContext('2d'); c.translate(64, 32); c.scale(1, 0.5); const g = c.createRadialGradient(0, 0, 0, 0, 0, 62); g.addColorStop(0, 'rgba(10,8,20,.7)'); g.addColorStop(0.55, 'rgba(10,8,20,.4)'); g.addColorStop(1, 'rgba(10,8,20,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 62, 0, 7); c.fill(); }
    if (w < 2) return; ctx.save(); ctx.globalAlpha *= a; ctx.drawImage(PATCH, x - w / 2, y - w * 0.06, w, w * 0.12); ctx.restore();   // centred under the base
  }
  // the silhouette of a layer (its art, or its greybox shape when no art is in), cached per layer, cell and shape (the
  // greybox one at one size per aspect, scaled when drawn: a thing growing as it nears never makes a new canvas a frame,
  // the phone budget, rule 27), blurred once offscreen, darkest at the base and fading toward the far end
  const SIL = {};
  function silhouette(L, cell, w, h) {
    const im = ART[L.id], aspect = Math.round(w / Math.max(h, 1) * 20) / 20, k = L.id + ':' + cell + ':' + (im ? 'art' : aspect);
    if (SIL[k]) return SIL[k];
    const P = 4; let iw, ih; const c = document.createElement('canvas'), x = c.getContext('2d');
    if (im) {
      let sx = 0, sy = 0, sw = im.width, sh = im.height; if (L.type === 'sheet' && L.cells) { sw = im.width / L.cells.cols; sh = im.height / L.cells.rows; sx = (cell % L.cells.cols) * sw; sy = Math.floor(cell / L.cells.cols) * sh; }
      const sc = Math.min(1, 160 / Math.max(sw, sh)); iw = Math.round(sw * sc); ih = Math.round(sh * sc); c.width = iw + 2 * P; c.height = ih + 2 * P;
      x.filter = 'blur(1.5px)'; x.drawImage(im, sx, sy, sw, sh, P, P, iw, ih); x.filter = 'none';
    } else {
      const a = Math.max(0.05, aspect); iw = Math.max(2, Math.round(a >= 1 ? 160 : 160 * a)); ih = Math.max(2, Math.round(a >= 1 ? 160 / a : 160)); c.width = iw + 2 * P; c.height = ih + 2 * P;
      const t = document.createElement('canvas'); t.width = c.width; t.height = c.height; L.shape(t.getContext('2d'), P, P, iw, ih, null, cell);
      x.filter = 'blur(1.5px)'; x.drawImage(t, 0, 0); x.filter = 'none';
    }
    x.globalCompositeOperation = 'source-in';
    const g = x.createLinearGradient(0, P + ih, 0, P); g.addColorStop(0, 'rgba(12,10,24,1)'); g.addColorStop(0.5, 'rgba(12,10,24,.6)'); g.addColorStop(1, 'rgba(12,10,24,.25)');
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    return (SIL[k] = { c, P, iw, ih });
  }
  const STATS = { grounded: 0 };   // read by the layout check: is the page grounding its objects at all
  function grounded(ctx, L, S, W, H, opts = {}) {
    STATS.grounded += 1;
    const box = opts.box || L.box, tier = opts.tier || 2, dir = opts.dir || [-0.6, -0.8], lift = opts.lift || 0;
    const b = boxPx(L, W, H, { ...box, anchor: 'bottom' });
    const x = b.x + b.w / 2, y = b.y + b.h, w = b.w, h = b.h, gy = y + lift * H;   // the base point; gy: the ground under it
    const near = Math.min(1, Math.max(0, (w / W - 0.015) / 0.08));   // by on-screen size: gone when tiny, full from ~10% of the frame
    if (near > 0 && L.type !== 'brand') {
      const up = Math.min(1, lift * H / Math.max(h, 1));   // how far up it is, in its own heights
      if (tier >= 2) {
        const sil = silhouette(L, opts.cell || 0, w, h);
        if (sil && w >= 3) {
          const s = w / sil.iw, side = dir[0] <= 0 ? 1 : -1, toward = dir[1] <= 0 ? 1 : -1;   // thrown away from the light
          ctx.save(); ctx.globalAlpha = Math.max(0.12, 0.5 - up * 0.4) * near; ctx.translate(x + side * up * w * 0.3, gy);
          ctx.transform(1 - up * 0.3, 0, -0.3 * near * side, (-0.13 * near - 0.02) * toward, 0, 0);   // laid on the ground; y = 0 is the base, so the base never moves
          ctx.drawImage(sil.c, -w / 2 - sil.P * s, -h - sil.P * s, sil.c.width * s, sil.c.height * s); ctx.restore();
        }
      }
      contact(ctx, x + (dir[0] <= 0 ? 1 : -1) * up * w * 0.25, gy, w * (tier >= 2 ? 0.3 : 0.75) * (1 - up * 0.5), (tier >= 2 ? 0.35 : 0.55) * near * (1 - up * 0.6));
    }
    if (lift) return draw(ctx, L, S, W, H, { ...opts, box: { ...box, anchor: 'bottom' } });
    // sunk and clipped at the ground line: no gap can show under it (rule 26)
    ctx.save(); ctx.beginPath(); ctx.rect(b.x - b.w, b.y - b.h, b.w * 3, b.h * 2); ctx.clip();
    const out = draw(ctx, L, S, W, H, { ...opts, box: { ...box, anchor: 'bottom', y: (y + h * SINK) / H } });
    ctx.restore();
    return out;
  }

  /* light(ctx, W, H, plan): the scene's light over the frame, by the page's plan (VIEW.light):
       { tier: 1|2|3, dir: [x, y], color: 'r,g,b', strength: 0-1, horizon: frame fraction or null, haze: 'r,g,b' }
     tier 1: a soft light from dir and a vignette; tier 2: plus the far side shaded; tier 3: plus haze at the horizon.
     Cached by size and plan; one drawImage a frame. */
  const LITE = { key: '', c: null };
  function light(ctx, W, H, plan) {
    if (!plan) return;
    const key = [Math.round(W), Math.round(H), JSON.stringify(plan)].join('|');
    if (LITE.key !== key) {
      const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(W)); c.height = Math.max(1, Math.round(H)); const x = c.getContext('2d');
      const tier = plan.tier || 1, dir = plan.dir || [-0.6, -0.8], col = plan.color || '255,244,214', k = plan.strength == null ? 0.25 : plan.strength;
      const lx = W / 2 + dir[0] * W * 0.7, ly = H / 2 + dir[1] * H * 0.7;
      let g = x.createRadialGradient(lx, ly, 0, lx, ly, Math.max(W, H) * 0.9); g.addColorStop(0, 'rgba(' + col + ',' + (0.55 * k).toFixed(3) + ')'); g.addColorStop(1, 'rgba(' + col + ',0)');
      x.globalCompositeOperation = 'lighter'; x.fillStyle = g; x.fillRect(0, 0, W, H); x.globalCompositeOperation = 'source-over';
      if (tier >= 2) { const sx = W / 2 - dir[0] * W * 0.7, sy = H / 2 - dir[1] * H * 0.7; g = x.createRadialGradient(sx, sy, 0, sx, sy, Math.max(W, H) * 0.8); g.addColorStop(0, 'rgba(10,12,30,' + (0.22 * k + 0.05).toFixed(3) + ')'); g.addColorStop(1, 'rgba(10,12,30,0)'); x.fillStyle = g; x.fillRect(0, 0, W, H); }
      if (tier >= 3 && plan.horizon != null) { const hy = plan.horizon * H, hz = plan.haze || '210,220,225'; g = x.createLinearGradient(0, hy - H * 0.08, 0, hy + H * 0.12); g.addColorStop(0, 'rgba(' + hz + ',0)'); g.addColorStop(0.45, 'rgba(' + hz + ',.5)'); g.addColorStop(1, 'rgba(' + hz + ',0)'); x.fillStyle = g; x.fillRect(0, hy - H * 0.08, W, H * 0.2); }
      g = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.45, W / 2, H / 2, Math.max(W, H) * 0.75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,' + (0.18 + 0.1 * k).toFixed(3) + ')'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      LITE.key = key; LITE.c = c;
    }
    ctx.drawImage(LITE.c, 0, 0, W, H);
  }
  return { ART, META, load, boxPx, draw, blueprint, grounded, contact, light, STATS, arrive };
})();
