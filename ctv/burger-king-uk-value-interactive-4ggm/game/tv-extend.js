/* Interactive CTV only (?tv): the game composed lower, and its world carried on to the right edge of the TV.
   Loaded by the game page after its VIEW is built and before it runs. The game's frame stays 2:3 at the left of a full-TV iframe;
   a second canvas (#ext) sits right beside its canvas with the same top, the same height and the same backing height, so both are
   snapped to the same device pixels (a CSS background in the outer page landed a pixel off, owner 16:21 and 16:24). #ext shows the
   game's right edge stretched (the cream band, the shelves, the counter run straight on) and, every frame, any item of the game
   that has crossed that edge: tipping, falling or lying on the counter (owner 16:23: toppled items were cut off at the edge).
   DROP (owner 16:25): the whole stage is composed 6% lower, so the counter sits at 81% and the banner under the spot has room.
   LIGHT (owner 16:32: "why is there a colour difference between the two tables?"): the game lit its own frame (a warm pool and a
   vignette), so its edge was the darkest part of it, and the extension copied that edge flat. Now the extension starts from the
   unlit plate, and one light is drawn across the whole TV: each canvas draws its own slice of it. */
(function () {
  const VIEW = window.VIEW_TV, T = window.TrayTowerGame;
  const DROP = 0.06;
  // ── 1. the stage, lower: the plate, the tray and the rail move down together; the plain top band takes the space ──
  const G = VIEW.geometry();
  ['trayY', 'counterY', 'railY', 'goalY', 'bandH'].forEach(k => { G[k] += DROP; });
  const L = id => VIEW.layers.find(l => l.id === id);
  L('L1').box = { ...L('L1').box, y: DROP };
  L('L2').box = { ...L('L2').box, y: L('L2').box.y + DROP };
  const draw0 = VIEW.drawFrame;
  VIEW.drawFrame = function (ctx, S, W, H) {
    // no screen shake on a TV (owner 16:37): the game's canvas moving against the extension opened a cut at the seam. The engine has
    // already shifted the canvas by its shake this frame: undo it, and zero the shake so neither the engine nor this page moves again
    const sk = window.ENGINE && window.ENGINE.shake; if (sk && (sk.x || sk.y)) ctx.translate(-sk.x, -sk.y);
    if (S) S.shake = 0;
    // the band above the lowered plate: the plate's own top tenth, stretched
    const im = window.LAYERS && window.LAYERS.ART && window.LAYERS.ART.L1;
    if (im) ctx.drawImage(im, 0, 0, im.width, im.height * 0.1, 0, 0, W, H * (DROP + 0.1));
    return draw0.apply(this, arguments);
  };
  // the start card's board and title move down with the stage (DROP of the height = 9cqw of the width at 2:3); the tap ring went with the hand
  const PLAN = { ...VIEW.light, dir: [-0.25, -0.85] };   // the game's own light, over the TV: from above the game's right side, so the banner is not the shaded corner
  let TVL = null;            // the TV-wide light, in CSS px (frame left to the TV's right edge)
  const light0 = window.LAYERS.light;
  window.LAYERS.light = (ctx, W, H) => { if (TVL) ctx.drawImage(TVL, 0, 0, W, H, 0, 0, W, H); };   // the game's slice
  VIEW.art += 'html.embed body{justify-content:flex-start}#ext{position:fixed;display:block;pointer-events:none}'
    + '#startCard{padding-top:59.5cqw}.tt-board{top:51cqw}.tt-ring{display:none}';

  // ── 2. the extension canvas, registered to the game's canvas ──
  const PIC = {};
  ['melt', 'wrap', 'tenders'].forEach(k => { const im = new Image(); im.src = `assets/game/${k}.webp`; PIC[k] = im; });
  let ext, ex, wallCol = null, game = null, frameEl = null, offX = 0, extCss = null;
  function place() {
    const r = frameEl.getBoundingClientRect(), dpr = devicePixelRatio || 1;
    // start one device pixel inside the game's edge, on a whole device pixel: the edge falls on a fraction of a pixel, and two layers
    // meeting there each half-cover the shared column, so the page behind showed through as a hairline
    const left = (Math.floor(r.right * dpr) - 1) / dpr, w = Math.max(0, innerWidth - left);
    Object.assign(ext.style, { left: left + 'px', top: r.top + 'px', width: w + 'px', height: r.height + 'px' });
    ext.width = Math.max(1, Math.round(w * dpr)); ext.height = game.height;   // the game's own backing height: the same rows
    offX = (r.right - left) * ext.width / w;   // the game's edge, in ext pixels
    extCss = { left: left - r.left, w, h: r.height };
    const tl = document.createElement('canvas'), tw = innerWidth - r.left; tl.width = Math.max(1, Math.round(tw)); tl.height = Math.max(1, Math.round(r.height));
    light0(tl.getContext('2d'), tw, r.height, PLAN); TVL = tl;
    wallCol = null; sampleSoon(3);
  }
  function sampleSoon(n) { requestAnimationFrame(() => { if (n > 0) return sampleSoon(n - 1); sample(); }); }
  function sample() {   // the plate's right edge, unlit, in the game's own layout (the band above the dropped plate, then the plate)
    const im = window.LAYERS.ART && window.LAYERS.ART.L1;
    if (frameEl.classList.contains('loading') || !game.height || !im) { setTimeout(sample, 100); return; }
    const H = game.height, c = document.createElement('canvas'); c.width = 1; c.height = H; const x = c.getContext('2d');
    x.drawImage(im, im.width - 1, 0, 1, im.height * 0.1, 0, 0, 1, H * (DROP + 0.1));
    x.drawImage(im, im.width - 1, 0, 1, im.height, 0, DROP * H, 1, H);
    wallCol = c;
  }
  function frame() {
    requestAnimationFrame(frame);
    if (!ext || !wallCol) return;
    if (ext.height !== game.height) { ext.height = game.height; sample(); return; }   // the game resized after us: same rows again
    const S = T.S; ex.setTransform(1, 0, 0, 1, 0, 0);
    ex.drawImage(wallCol, 0, 0, 1, wallCol.height, 0, 0, ext.width, ext.height);
    if (!S) return;
    // frame fractions → ext pixels: x is measured from the game's right edge; the scales are the game canvas's own
    const kx = game.width, ky = ext.height;
    const box = (kind, fx, fy, wf, hf, rot, centre) => {
      const im = PIC[kind]; if (!im || !im.complete) return;
      const x = (fx - 1) * kx + offX, y = fy * ky, wp = wf * kx, hp = hf * ky;
      if (x + wp < 0) return;
      ex.save(); ex.translate(x, y); if (rot) ex.rotate(rot); ex.drawImage(im, -wp / 2, centre ? -hp / 2 : -hp, wp, hp); ex.restore();
    };
    S.debris.forEach(d => { const f = T.toFrame(d.x, d.y), wf = d.w * f.s, hf = d.h * f.s / 1.5;
      if (d.settled && f.x > 1) { ex.save(); ex.globalAlpha = .45; ex.fillStyle = '#190802'; ex.beginPath(); ex.ellipse((f.x - 1) * kx + offX, (f.y + hf / 2) * ky, wf * kx * .42, hf * ky * .18, 0, 0, 7); ex.fill(); ex.restore(); }
      box(d.kind, f.x, f.y, wf, hf, d.rot, true); });
    const stack = it => { const q = T.pose(it), f = T.toFrame(q.x, q.y); box(it.kind, f.x, f.y, it.w * f.s, it.h * f.s / 1.5 * (it.squash || 1), q.rot, false); };
    S.tower.forEach(stack); (S.tips || []).forEach(t => t.items.forEach(stack));
    if (TVL && extCss) { ex.setTransform(1, 0, 0, 1, 0, 0); ex.drawImage(TVL, extCss.left, 0, extCss.w, extCss.h, 0, 0, ext.width, ext.height); }   // the extension's slice of the one light
  }
  function mountExt() {
    frameEl = document.getElementById('frame'); game = document.getElementById('game');
    if (!frameEl || !game) { setTimeout(mountExt, 50); return; }
    ext = document.createElement('canvas'); ext.id = 'ext'; ext.setAttribute('aria-hidden', 'true'); document.body.appendChild(ext); ex = ext.getContext('2d');
    new ResizeObserver(place).observe(frameEl); window.addEventListener('resize', place); place();
    requestAnimationFrame(frame);
  }
  setTimeout(mountExt, 0);
})();
