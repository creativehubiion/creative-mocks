/* Trail to Camp controls (runs/realtruck-01/06-controls): the player's steering input. One ES module, no dependencies, no game code.
   The ute drives itself; the player only steers left/right. This module turns a phone thumb (touch or pen) or the arrow keys / A D
   into ONE number x in -1..1 and drives the UI kit's joystick and start hint (07-ui/UI-SPEC.md 0.2: hud.stick, hud.hint).

   const C = createControls({ hud, target, getPhase, band = 0.45, isBlocked });
   every frame (or every fixed step):  C.update(dt); const x = C.x();
   then the game turns x into a lateral RATE (steerInput below): hold = keep moving sideways, release = hold the lane, no auto-recentre.

   Touch: a floating stick. The base appears under the thumb when the touch starts in the lower `band` of the screen; a touch higher up
     still steers, with the base drawn on the band's top edge under the thumb's x. Horizontal travel drives it (full at TUNE.STICK_PX);
     past full travel the base follows the thumb, so reversing answers at once. Second fingers are ignored.
   Mouse: never steers (owner 2026-11-12 01:54: "disable the mouse on desktop/laptop"). A mouse pointer never places or shows the
     stick and never dismisses or switches the hint; mouse clicks on the kit's buttons and cards work as normal. The keys are the
     desktop control; a touch-screen laptop still steers by touch.
   Keys: ArrowLeft / ArrowRight and A / D. Hold ramps to full in TUNE.KEY_UP s, release ramps back in TUNE.KEY_DOWN s, the most recent
     of two opposite keys wins at once, auto-repeat is ignored, everything is released on blur.
   Steering only in the kit's 'play' phase; everything is released on leaving it.
   Hint (owner 2026-11-12 00:13: it stays until the player steers): when 'play' begins, hud.hint('stick', 0) on (pointer: coarse)
     devices, hud.hint('keys', 0) otherwise, no timeout. The first real STEERING input hides it (a touch that starts the
     stick, an arrow / A / D press); Enter, Space, other keys and taps on HUD buttons do not (the kit's own any-input auto-hide is
     re-armed before it can fire). If the first steering input is the other kind, the hint switches to that kind once and the next
     steering input hides it. A gate hides it; if the player has not steered yet this round it comes back when play resumes; once they
     have steered it does not return until the next round (PLAY AGAIN / TRY AGAIN).
   Keyboard UI: Enter / Space press the visible primary button (PLAY, FIT IT, PLAY AGAIN, TRY AGAIN; never COPY CODE). At a gate pop-up
     ArrowLeft / ArrowRight (and A / D) pick the left / right card, only on a fresh press made while the pop-up is open: a key held from
     driving only auto-repeats and is ignored. Selectors used are in SELECTORS (INTEGRATION.md lists them for the UI job). */

/* ---------- feel constants (all tuning lives here) ---------- */
export const TUNE = {
  /* horizontal thumb travel for full deflection, px: the kit's knob travel (0.36 of its 128 px base) */
  STICK_PX: 46,
  /* the knob's drawn vertical give: KY of the thumb's vertical travel, clamped to KY_MAX px (the kit's own clamp) */
  KY: 0.25,
  KY_MAX: 11.5,
  /* the drawn base stays this far inside the mount's edges (half the 128 px base + 4); visual only, the steering origin is the thumb */
  BASE_PAD: 68,
  /* dead zone, share of full deflection: nothing below it, then the remaining travel is re-spread from 0 */
  DEAD: 0.08,
  /* response curve exponent: out = ((|d| - DEAD) / (1 - DEAD)) ^ CURVE, so small thumb moves give fine corrections */
  CURVE: 1.5,
  /* finger jitter filter time constant, s */
  PTR_TAU: 0.03,
  /* slew limits, s for a full-scale change. Keys: hold to full, release to zero. Pointer: the same idea, a little quicker */
  KEY_UP: 0.18,
  KEY_DOWN: 0.12,
  PTR_UP: 0.12,
  PTR_DOWN: 0.10
};

/* */
export const STEER = { RATE: 7.5, FWD: 1.2, MIN_RATE: 3, KEY_RATE: 9 };
export function steerInput(x, v, ks = 1, keyRate = STEER.KEY_RATE) {
  const rate = Math.min(STEER.RATE, Math.max(STEER.MIN_RATE, STEER.FWD * (v || 0) * ks));
  return clamp(x || 0, -1, 1) * rate / keyRate;
}

/* ---------- the kit's DOM, as this module reads it (INTEGRATION.md asks the UI job to keep these stable) ---------- */
export const SELECTORS = {
  root: '.rk-root',
  popup: '.rk-pop:not(.rk-hide):not(.is-out)',
  card: '.rk-card[data-i]',
  cardSelected: '[aria-pressed="true"]',
  fit: '[data-a=fit]',
  /* Enter / Space: the first visible, enabled match wins */
  primary: ['.rk-pop:not(.rk-hide):not(.is-out) [data-a=fit]', '.rk-sheet.rk-fail.is-in [data-a=retry]', '.rk-sheet.rk-end.is-in [data-a=again]', '.rk-start:not(.is-out) [data-a=play]'],
  /* a pointer that starts on one of these never steers */
  blocked: 'button, a, input, select, textarea, label, [role=dialog], .rk-card, .rk-btn, .rk-iconbtn, .rk-sheet, .rk-pop, .rk-brand'
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

/* dead zone + response curve on a deflection in -1..1 */
export function shape(d, T = TUNE) {
  const a = Math.abs(d);
  if (a <= T.DEAD) return 0;
  return Math.sign(d) * Math.pow(Math.min(1, (a - T.DEAD) / (1 - T.DEAD)), T.CURVE);
}
/* slew toward g: `up` s per full scale moving away from zero, `dn` s per full scale moving toward it; a reversal stops at zero first */
function slew(c, g, dt, up, dn) {
  if (c === g) return c;
  const out = g > c ? c >= 0 : c <= 0, r = dt / (out ? up : dn);
  const n = g > c ? Math.min(g, c + r) : Math.max(g, c - r);
  if (!out && ((c > 0 && n < 0) || (c < 0 && n > 0))) return 0;
  return n;
}

/* ---------- the shaper: pure, no DOM (Node imports it for the swerve check) ----------
   down(x) / move(x) / up(): the thumb's x in px; keys(dir): -1, 0, 1 (the winning key); step(dt) -> x in -1..1 */
export function createShaper(T = TUNE) {
  const s = { down: false, ox: 0, raw: 0, f: 0, kdir: 0, kv: 0, pv: 0, x: 0 };
  return {
    down(x) { s.down = true; s.ox = x; s.raw = 0; s.f = 0; },
    move(x) {
      if (!s.down) return;
      const M = T.STICK_PX;
      if (x - s.ox > M) s.ox = x - M; else if (x - s.ox < -M) s.ox = x + M;
      s.raw = (x - s.ox) / M;
    },
    up() { s.down = false; s.raw = 0; },
    keys(dir) { s.kdir = dir > 0 ? 1 : dir < 0 ? -1 : 0; },
    reset() { s.down = false; s.raw = 0; s.f = 0; s.kdir = 0; s.kv = 0; s.pv = 0; s.x = 0; },
    step(dt) {
      s.kv = slew(s.kv, s.kdir, dt, T.KEY_UP, T.KEY_DOWN);
      if (s.down) s.f += (s.raw - s.f) * (1 - Math.exp(-dt / T.PTR_TAU)); else s.f = 0;
      s.pv = slew(s.pv, s.down ? shape(s.f, T) : 0, dt, T.PTR_UP, T.PTR_DOWN);
      s.x = clamp(s.kv + s.pv, -1, 1);
      return s.x;
    },
    get x() { return s.x; },
    get raw() { return s.raw; },
    get origin() { return s.ox; },
    get isDown() { return s.down; }
  };
}

const PHASES = new Set(['start', 'play', 'pause', 'build', 'finale', 'end', 'fail']);
const ARM = new Set(['', 'idle', 'loading', 'start', 'end', 'fail']);
const KEY_DIR = { ArrowLeft: -1, ArrowRight: 1, a: -1, A: -1, d: 1, D: 1 };
const CODE_DIR = { KeyA: -1, KeyD: 1 };
const keyDir = e => KEY_DIR[e.key] || CODE_DIR[e.code] || 0;
const isAct = e => e.key === 'Enter' || e.key === ' ' || e.code === 'Space';
const typing = t => !!(t && t.closest && t.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]'));
const visible = el => !!(el && el.isConnected && !el.disabled && el.getClientRects().length);

/* ---------- the DOM controller ---------- */
export function createControls(o = {}) {
  const T = o.tune ? Object.assign({}, TUNE, o.tune) : TUNE;
  const hud = o.hud || null, band = clamp(o.band == null ? 0.45 : +o.band, 0.05, 1);
  const getPhase = o.getPhase || (() => (hud && hud.phase) || 'play');
  const tgt = o.target || document.body;
  const tEl = tgt === window || tgt === document ? document.documentElement : tgt;
  const mq = q => { try { return matchMedia(q).matches; } catch (e) { return false; } };
  const coarse = () => mq('(pointer: coarse)');
  const doHints = o.hints !== false && !!hud, doUI = o.keyboardUI !== false;
  const sh = createShaper(T);
  const st = { kind: coarse() ? 'touch' : 'keys', ptr: null, shown: false, keys: [], phase: '', hintMode: null, hintOn: false, steered: false, switched: false, hEl: null, tabNav: false, x: 0 };
  const rootEl = () => (hud && hud.el) || document.querySelector(SELECTORS.root) || document.documentElement;
  const q = sel => rootEl().querySelector(sel) || document.querySelector(sel);
  const blocked = e => {
    const t = e.target;
    if (t && t.closest && t.closest(SELECTORS.blocked)) return true;
    try { return !!(o.isBlocked && o.isBlocked(e)); } catch (err) { return false; }
  };

  /* ----- the start hint: stays (hint(mode, 0)) until the player steers; this module dismisses it, not the kit ----- */
  const hintEl = () => (st.hEl && st.hEl.isConnected ? st.hEl : (st.hEl = rootEl().querySelector('.rk-hint')));
  function showHint(mode) { st.hintMode = mode; st.hintOn = true; hud.hint(mode, 0); }
  function hideHint() { if (st.hintOn) { st.hintOn = false; hud.hint(false); } }
  /* the kit hides its hint on ANY pointerdown / keydown after 250 ms; re-calling hint() before the kit's own listener runs (this is a
     window capture listener) re-arms it with a fresh 250 ms guard, so a non-steering key or tap cannot dismiss it. No visual change */
  function rearmHint() { if (st.hintOn && getPhase() === 'play') hud.hint(st.hintMode, 0); }
  /* a real steering input: the first one of the other kind switches the hint (it stays); otherwise it dismisses it for the round */
  function real(kind) {
    st.kind = kind;
    if (!st.hintOn) { st.steered = true; return; }
    const want = kind === 'keys' ? 'keys' : 'stick';
    if (!st.steered && !st.switched && want !== st.hintMode) { st.switched = true; st.steered = true; showHint(want); return; }
    st.steered = true; hideHint();
  }

  /* ----- pointer: touch and pen (a mouse never steers) ----- */
  function draw() {
    const p = st.ptr;
    if (!p || !p.show || !hud) return;
    const M = T.STICK_PX, ox = sh.origin, kx = clamp(p.x - ox, -M, M), ky = clamp((p.y - p.oy) * T.KY, -T.KY_MAX, T.KY_MAX);
    const W = p.w, H = p.h, P = T.BASE_PAD;
    const bx = W > 2 * P ? clamp(ox, P, W - P) : W / 2, by = H > 2 * P ? clamp(p.by, P, H - P) : H / 2;
    hud.stick({ x: bx, y: by, kx, ky, k: Math.abs(kx) / M });
    st.shown = true;
  }
  function releasePtr() {
    const p = st.ptr;
    if (!p) return;
    st.ptr = null; sh.up();
    if (st.shown && hud) hud.stick(null);
    st.shown = false;
    try { if (tEl.hasPointerCapture && tEl.hasPointerCapture(p.id)) tEl.releasePointerCapture(p.id); } catch (e) { /* already released */ }
  }
  function onDown(e) {
    if (st.ptr || getPhase() !== 'play') return;
    if (e.pointerType === 'mouse' || blocked(e)) return;
    const kind = 'touch';
    const R = rootEl().getBoundingClientRect(), x = e.clientX - R.left, y = e.clientY - R.top, top = R.height * (1 - band);
    st.ptr = { id: e.pointerId, kind, show: true, left: R.left, top: R.top, w: R.width, h: R.height, x, y, oy: y, by: y >= top ? y : top };
    sh.down(x);
    try { if (tEl.setPointerCapture) tEl.setPointerCapture(e.pointerId); } catch (err) { /* not capturable: window listeners still see it */ }
    if (e.cancelable) e.preventDefault();
    real(kind);
    draw();
  }
  function onMove(e) {
    const p = st.ptr;
    if (!p || e.pointerId !== p.id) return;
    p.x = e.clientX - p.left; p.y = e.clientY - p.top;
    sh.move(p.x);
  }
  function onUp(e) { if (st.ptr && e.pointerId === st.ptr.id) releasePtr(); }

  /* ----- keys ----- */
  function popupOpen() { const p = q(SELECTORS.popup); return p && p.querySelector(SELECTORS.card) ? p : null; }
  function pickCard(pop, dir) {
    const cards = [...pop.querySelectorAll(SELECTORS.card)], n = cards.length;
    if (!n) return;
    const cur = cards.findIndex(c => c.matches(SELECTORS.cardSelected) || c.classList.contains('is-sel'));
    const i = cur < 0 ? (dir < 0 ? 0 : n - 1) : clamp(cur + dir, 0, n - 1);
    if (i !== cur) cards[i].click();
  }
  function primary() { for (const s of SELECTORS.primary) { const b = q(s); if (visible(b)) return b; } return null; }
  /* a button the player reached with Tab keeps its native Enter / Space. Tracked by hand: Chrome turns :focus-visible on for the
     focused element by the very keydown being handled, so it cannot tell a mouse-clicked button from a tabbed one here */
  function nativeFocus() {
    const a = document.activeElement;
    return !!(st.tabNav && a && a !== document.body && a.closest && a.closest('button, a, [role=button]'));
  }
  function onKeyDown(e) {
    rearmHint();
    if (e.key === 'Tab') { st.tabNav = true; return; }
    if (e.ctrlKey || e.metaKey || e.altKey || typing(e.target)) return;
    const ph = getPhase(), dir = keyDir(e), act = isAct(e);
    if (!dir && !act) return;
    const pop = doUI ? popupOpen() : null;
    if (pop) {
      /* the gate pop-up owns these keys (the kit's own arrow handler would also take auto-repeats from a held driving key) */
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.repeat) return;
      if (dir) pickCard(pop, dir);
      else { const b = pop.querySelector(SELECTORS.fit); if (visible(b)) b.click(); }
      return;
    }
    if (dir) {
      if (PHASES.has(ph)) e.preventDefault();
      if (e.repeat || (ph !== 'play' && ph !== 'build')) return;
      const id = e.code || e.key.toLowerCase();
      st.keys = st.keys.filter(k => k.id !== id); st.keys.push({ id, dir });
      if (ph === 'play') real('keys');
      return;
    }
    if (!doUI || nativeFocus()) return;
    if (PHASES.has(ph)) e.preventDefault();
    if (e.repeat) return;
    const b = primary();
    if (b) { e.preventDefault(); b.click(); }
  }
  function onKeyUp(e) {
    if (!keyDir(e)) return;
    const id = e.code || e.key.toLowerCase();
    st.keys = st.keys.filter(k => k.id !== id);
  }

  /* ----- releases ----- */
  function releaseAll() { releasePtr(); st.keys = []; }
  const onBlur = () => releaseAll();
  const onVis = () => { if (document.hidden) releaseAll(); };
  const onCtx = e => { if (!typing(e.target)) e.preventDefault(); };
  const onSel = e => { if (!typing(e.target)) e.preventDefault(); };
  const onTouch = e => { if (e.cancelable && ((st.ptr && st.ptr.kind === 'touch') || (e.touches && e.touches.length > 1))) e.preventDefault(); };
  const onLost = e => { if (st.ptr && e.pointerId === st.ptr.id) releasePtr(); };
  const onAnyDown = () => { st.tabNav = false; rearmHint(); };

  /* ----- phases ----- */
  function phaseChange(prev, ph) {
    if (prev === 'play') releaseAll();
    /* a new round: the hint is owed again */
    if (ARM.has(ph)) { st.steered = false; st.switched = false; st.hintMode = null; }
    /* a key pressed in the build shot and still held is already steering */
    if (ph === 'play' && st.keys.length) real('keys');
    if (ph === 'play') { if (doHints && !st.steered) showHint(st.hintMode || (coarse() ? 'stick' : 'keys')); }
    else if (st.hintOn) hideHint();
    st.phase = ph;
  }

  /* ----- wiring ----- */
  const css = tEl.style, saved = { touchAction: css.touchAction, userSelect: css.userSelect, webkitUserSelect: css.webkitUserSelect, webkitTouchCallout: css.webkitTouchCallout };
  css.touchAction = 'none'; css.userSelect = 'none'; css.webkitUserSelect = 'none'; css.webkitTouchCallout = 'none';
  const L = [
    [tEl, 'pointerdown', onDown, { passive: false }], [window, 'pointermove', onMove, { passive: true }], [window, 'pointerup', onUp, { passive: true }],
    [window, 'pointercancel', onUp, { passive: true }], [tEl, 'lostpointercapture', onLost, { passive: true }],
    [window, 'keydown', onKeyDown, { capture: true }], [window, 'keyup', onKeyUp, { capture: true }], [window, 'blur', onBlur, false],
    [document, 'visibilitychange', onVis, false], [tEl, 'contextmenu', onCtx, false], [tEl, 'selectstart', onSel, false], [tEl, 'dragstart', onSel, false],
    [tEl, 'touchmove', onTouch, { passive: false }], [tEl, 'touchstart', onTouch, { passive: false }], [window, 'pointerdown', onAnyDown, { capture: true, passive: true }]
  ];
  for (const [el, ev, fn, opt] of L) el.addEventListener(ev, fn, opt);

  return {
    /* steering value -1..1 after dead zone, curve and ramps (0 outside 'play') */
    x: () => st.x,
    /* 'touch' | 'keys': the last real steering input (before any: a guess from the device) */
    kind: () => st.kind,
    update(dt) {
      dt = clamp(+dt || 0, 0, 0.1);
      const ph = getPhase();
      if (ph !== st.phase) phaseChange(st.phase, ph);
      if (ph !== 'play') { if (st.ptr) releasePtr(); sh.reset(); st.x = 0; return 0; }
      /* safety net: if anything else hid the hint while it is still owed, put it back */
      if (st.hintOn) { const h = hintEl(); if (h && !h.classList.contains('is-on')) hud.hint(st.hintMode, 0); }
      sh.keys(st.keys.length ? st.keys[st.keys.length - 1].dir : 0);
      st.x = sh.step(dt);
      draw();
      return st.x;
    },
    /* for the integrator's own release (a restart, a teardown) */
    release: releaseAll,
    dispose() {
      releaseAll();
      for (const [el, ev, fn, opt] of L) el.removeEventListener(ev, fn, opt);
      Object.assign(css, saved);
    }
  };
}
