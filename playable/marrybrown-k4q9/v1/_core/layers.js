/* Layer placement (D-015 item 4): one function draws a layer into its box in the game, using the art when
   it has loaded and the greybox shape otherwise; the same shape function renders the layer's blueprint.
   A layer:
     { id, name, type: plate|sprite|sheet|viewmodel|mask-texture|particle, canvas:[w,h], key, notes,
       box: { x, y, w, h, anchor }          frame fractions; anchor: 'centre' | 'bottom' | 'top' | 'left' | 'right' | 'corner-br'
       pivot?: [fx, fy]                       for viewmodel: the rotation point in frame fractions (box corner-br sits here)
       cells?: { cols, rows, names }          for sheets
     states?: true                          the cells are STATES of one object: generated as one base image + edits (rule 13); blueprint = base state on one canvas
       shape(ctx, x, y, w, h, S, cell)        draws the greybox shape inside the box (px); cell for sheets
       explain?(ctx, W, H)                    extra labels on the explained blueprint }
   The box aspect equals the canvas aspect, so the art fills the box exactly as the blueprint fills the canvas. */
window.LAYERS = (function () {
  const ART = {};
  function load(layers, base) {
    layers.forEach(L => {
      if (!['plate', 'sprite', 'sheet', 'viewmodel', 'mask-texture', 'particle'].includes(L.type)) return;
      const im = new Image(); im.onload = () => { ART[L.id] = im; }; im.onerror = () => {}; im.src = `${base}${L.name}.webp`;
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
    }
    return { x, y, w, h };
  }
  /* draw a layer in the game. opts: { box (override, frame fractions), rot (radians about the pivot), pivot ([px,py] in px), cell (sheet index), alpha } */
  function draw(ctx, L, S, W, H, opts = {}) {
    const b = boxPx(L, W, H, opts.box); const im = ART[L.id];
    ctx.save(); if (opts.alpha != null) ctx.globalAlpha = opts.alpha;
    if (opts.rot) { const p = opts.pivot || [b.x + b.w / 2, b.y + b.h / 2]; ctx.translate(p[0], p[1]); ctx.rotate(opts.rot); ctx.translate(-p[0], -p[1]); }
    if (im) {
      if (L.type === 'sheet' && L.cells) { const cw = im.width / L.cells.cols, ch = im.height / L.cells.rows, i = opts.cell || 0; ctx.drawImage(im, (i % L.cells.cols) * cw, Math.floor(i / L.cells.cols) * ch, cw, ch, b.x, b.y, b.w, b.h); }
      else ctx.drawImage(im, b.x, b.y, b.w, b.h);
    } else L.shape(ctx, b.x, b.y, b.w, b.h, S, opts.cell || 0);
    ctx.restore();
    return b;
  }
  /* render a layer's blueprint into its own canvas: the shape fills the canvas the way the art will fill the box */
  function blueprint(ctx, L, W, H, o) {
    if (L.type === 'plate' || L.type === 'mask-texture') { L.shape(ctx, 0, 0, W, H, null, 0, o); }
    else { ctx.fillStyle = L.key || '#4A5A7A'; ctx.fillRect(0, 0, W, H);
      if (L.type === 'sheet' && L.cells && !L.states) { const cw = W / L.cells.cols, ch = H / L.cells.rows; for (let i = 0; i < L.cells.cols * L.cells.rows; i++) { const x = (i % L.cells.cols) * cw, y = Math.floor(i / L.cells.cols) * ch; L.shape(ctx, x, y, cw, ch, null, i, o); if (o.explain) { ctx.strokeStyle = '#ffffff55'; ctx.lineWidth = 3; ctx.strokeRect(x, y, cw, ch); GB.bpLabel(ctx, x + 20, y + 40, `${i + 1} ${L.cells.names[i]}`, '#ffd23a', true); } } }
      else L.shape(ctx, 0, 0, W, H, null, 0, o); }
    if (o.explain) { if (L.camera) { ctx.font = '700 34px Arial'; const t = 'CAMERA: ' + L.camera; if (ctx.measureText(t).width > W - 60) { const parts = t.split(', '); const mid = Math.ceil(parts.length / 2); GB.bpLabel(ctx, 30, H - 90, parts.slice(0, mid).join(', ') + ',', '#ffd23a', true); GB.bpLabel(ctx, 30, H - 40, parts.slice(mid).join(', '), '#ffd23a', true); } else GB.bpLabel(ctx, 30, H - 40, t, '#ffd23a', true); } if (L.explain) L.explain(ctx, W, H); }
  }
  return { ART, load, boxPx, draw, blueprint };
})();
