/* Shared greybox drawing helpers (grey shapes + one heat colour). All positions are fractions of the frame. */
window.GB = (function () {
  const INK = '#1a1a1e', G1 = '#55555c', G2 = '#8a8a92', G3 = '#b8b8c0', G4 = '#d9d9df', RED = '#e03020', RED2 = '#ff6a3a', GREEN = '#4a7a3a';
  const heatCol = h => `hsl(${18 - h * 14} ${60 + h * 35}% ${48 - h * 10}%)`;
  // a glowing ring without canvas shadowBlur: three soft strokes under a crisp core. shadowBlur re-renders a blurred copy of the
  // path every frame and is the single most expensive thing a phone's canvas does; this costs four plain strokes.
  function glowRing(ctx, x, y, r, glow, core, width, spread, alpha) { ctx.save(); for (let i = 3; i >= 1; i--) { ctx.globalAlpha = (alpha || .5) * .3 / i; ctx.lineWidth = width + i * spread * .55; ctx.strokeStyle = glow; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.lineWidth = width; ctx.strokeStyle = core; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke(); ctx.restore(); }
  function rr(ctx, x, y, w, h, r, fill, stroke) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); } }
  function ell(ctx, x, y, rx, ry, fill, stroke) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); } }
  function label(ctx, x, y, t, size, col = '#fff', align = 'center') { ctx.font = `700 ${size}px Inter, system-ui, sans-serif`; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = col; ctx.fillText(t, x, y); }
  function chicken(ctx, x, y, w, state, heat) { // state 0 dry .. 3 smashed; heat colours the sambal
    const h = w * (state >= 3 ? 0.42 : 0.6);
    ctx.save(); ctx.translate(x, y);
    ell(ctx, 0, 0, w / 2, h / 2, G3, G1); ell(ctx, -w * .18, -h * .15, w * .12, h * .18, G4); ell(ctx, w * .2, -h * .05, w * .1, h * .14, G4);
    if (state >= 1) { const sw = w * (0.5 + state * 0.18); ell(ctx, 0, -h * .12, sw / 2, h * .32, heatCol(heat)); for (let i = 0; i < 3 + state * 2; i++) ell(ctx, (i / (3 + state * 2) - .5) * sw * .8, -h * .12 + ((i % 2) - .5) * h * .18, w * .025, w * .02, '#fff8'); }
    if (state >= 3) { for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; ell(ctx, Math.cos(a) * w * .5, Math.sin(a) * h * .5, w * .06, w * .05, heatCol(heat)); } }
    ctx.restore();
  }
  function chili(ctx, x, y, size, kind, rot) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    const col = kind === 1 ? GREEN : kind === 3 ? INK : RED, s = kind === 3 ? size * .35 : size;
    if (kind === 3) { ell(ctx, 0, 0, s, s, col); ctx.restore(); return; }
    ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(0, -s * .55, s, s * .1); ctx.quadraticCurveTo(0, s * .5, -s, 0); ctx.fillStyle = col; ctx.fill();
    ctx.strokeStyle = GREEN; ctx.lineWidth = Math.max(2, s * .18); ctx.beginPath(); ctx.moveTo(-s, 0); ctx.lineTo(-s * 1.4, -s * .35); ctx.stroke();
    ctx.restore();
  }
  function hand(ctx, x, y, w, rot, dashed) { // open palm with four fingers; pointing along +x after rotation
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot); if (dashed) ctx.setLineDash([8, 6]);
    rr(ctx, -w * .5, -w * .3, w * .7, w * .6, w * .18, '#ecece9', INK);
    for (let i = 0; i < 4; i++) rr(ctx, w * .15, -w * .32 + i * w * .17, w * .45, w * .13, w * .06, '#ecece9', INK);
    rr(ctx, -w * .2, w * .2, w * .36, w * .14, w * .06, '#ecece9', INK);
    ctx.restore();
  }
  function pestle(ctx, x, y, len, thick, rot) { // base at (x,y), pointing up, rotated
    ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
    rr(ctx, -thick / 2, -len, thick, len, thick / 2, G2, INK); ell(ctx, 0, 0, thick * .7, thick * .45, G1, INK); ctx.restore();
  }
  function beatRing(ctx, x, y, r, S) {
    if (!S.beat.on) return; const f = S.beat.phase % 1, pulse = 1 + 0.35 * (1 - f), bold = typeof VIEW !== 'undefined' && VIEW.build;
    ctx.save();
    if (bold && S.beat.phase < (typeof Gepuk !== 'undefined' && Gepuk.CONFIG.beatLeadIn || 2)) {   // lead-in: the target ring breathes, nothing closes yet
      const b = 1 + 0.08 * Math.sin(S.beat.phase * Math.PI * 2); glowRing(ctx, x, y, r * b, '#fff', 'rgba(255,255,255,.95)', 9, 18, .6); ctx.restore(); return;
    }
    if (bold) {   // builds: rhythm-game language, unmistakable (owner, 19:05 IST): solid target ring, glowing ring closing onto it, flash on the hit
      glowRing(ctx, x, y, r, 'rgba(0,0,0,.7)', 'rgba(255,255,255,.9)', 7, 8, .6);
      glowRing(ctx, x, y, r * pulse, '#ff3b1f', S.beat.flash > 0 ? '#ffe36a' : '#ff4a2a', 12, 22, .9); ctx.globalAlpha = .95;
      if (S.beat.flash > 0) { ctx.globalAlpha = Math.min(1, S.beat.flash * 4) * .5; ctx.fillStyle = '#ffe36a'; ctx.beginPath(); ctx.arc(x, y, r * 1.1, 0, Math.PI * 2); ctx.fill(); }
    } else {
      ctx.lineWidth = 6; ctx.strokeStyle = S.beat.flash > 0 ? '#fff' : RED2; ctx.globalAlpha = .9;
      ctx.beginPath(); ctx.arc(x, y, r * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 3; ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }
  function drops(ctx, S, ox, oy, scale, heat) { S.drops.forEach(d => ell(ctx, ox + (d.x - .5) * scale, oy + (d.y - .72) * scale, 6, 6, heatCol(heat))); }
  function pops(ctx, S, x, y) { S.pops.forEach(p => { const life = p.big ? 1.1 : .7; ctx.globalAlpha = Math.max(0, 1 - p.t / life); if (p.big) { const k = Math.min(1, p.t / .18), sc = 1.5 - .5 * k; label(ctx, x, y - 40 - p.t * 30, p.txt, Math.round(44 * sc), p.cold ? '#9fe0ff' : '#ffd23a'); } else label(ctx, x, y - p.t * 60, p.txt, 26, (p.txt === 'EARLY' || p.txt === 'LATE') ? G3 : '#fff'); ctx.globalAlpha = 1; }); }
  function reveal(ctx, S, W, H, heat) { // win: plate lifted toward camera
    const k = Math.min(1, S.reveal / .9), e = 1 - Math.pow(1 - k, 3);
    ctx.save(); ctx.globalAlpha = e * .55; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    const cx = W / 2, cy = H * .5, w = W * (.35 + .35 * e);
    ell(ctx, cx, cy + w * .18, w * .62, w * .2, '#f2f2f0', G1); chicken(ctx, cx, cy, w, 3, heat);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; ell(ctx, cx + Math.cos(a) * w * (.55 + .25 * e), cy + Math.sin(a) * w * (.3 + .15 * e), w * .05, w * .05, heatCol(heat)); }
    label(ctx, cx, cy - w * .55, 'GEPUK!', 48 * e, '#fff'); ctx.restore();
  }
  // blueprint helpers
  function bpBase(ctx, W, H, key) { ctx.fillStyle = key || '#4A5A7A'; ctx.fillRect(0, 0, W, H); }
  function bpZone(ctx, x, y, w, h, col, t, explain) { if (!explain) return; ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 6; ctx.setLineDash([18, 12]); ctx.strokeRect(x, y, w, h); ctx.setLineDash([]); ctx.font = '700 34px Arial'; ctx.fillStyle = '#000'; const m = ctx.measureText(t); ctx.fillRect(x + 8, y + 8, m.width + 20, 46); ctx.fillStyle = col; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(t, x + 18, y + 31); ctx.restore(); }
  function bpLabel(ctx, x, y, t, col, explain) { if (!explain) return; ctx.save(); ctx.font = '700 34px Arial'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; const m = ctx.measureText(t); ctx.fillStyle = '#000'; ctx.fillRect(x - 6, y - 23, m.width + 20, 46); ctx.fillStyle = col; ctx.fillText(t, x + 4, y); ctx.restore(); }
  function sheet(ctx, W, H, cols, rows, key, explain, drawCell, names) { bpBase(ctx, W, H, key); const cw = W / cols, ch = H / rows; for (let i = 0; i < cols * rows; i++) { const cx = (i % cols) * cw + cw / 2, cy = Math.floor(i / cols) * ch + ch / 2; ell(ctx, cx, cy + ch * .3, cw * .28, ch * .06, '#3d4a66'); drawCell(ctx, cx, cy, Math.min(cw, ch) * .55, i); bpLabel(ctx, (i % cols) * cw + 20, Math.floor(i / cols) * ch + 40, `${i + 1} ${names[i]}`, '#ffd23a', explain); if (explain) { ctx.strokeStyle = '#ffffff44'; ctx.lineWidth = 3; ctx.strokeRect((i % cols) * cw, Math.floor(i / cols) * ch, cw, ch); } } }
  return { glowRing, INK, G1, G2, G3, G4, RED, RED2, GREEN, heatCol, rr, ell, label, chicken, chili, hand, pestle, beatRing, drops, pops, reveal, bpBase, bpZone, bpLabel, sheet };
})();
