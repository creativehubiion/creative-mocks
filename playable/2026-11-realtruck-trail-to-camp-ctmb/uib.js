/* The UI kit binding (07-ui/ui-kit.js, frozen contract in 07-ui/UI-SPEC.md section 0). The kit owns every display string and screen:
   loading, start, the in-play HUD, the gate pop-up, the build callout, the finale tally, the end and fail cards. This module only maps
   the game to it: one state object per frame, the kit's events to the core (play, fit, play again, try again, sound), the callouts, and
   the product turntables, which the view renders into the main canvas and this module copies into a transparent canvas above the kit at
   the kit's card-window rects. The old DOM layer (core sheets, hud2) stays in the page, hidden (body.uikit). */
import * as UI from './ui/ui-kit.js';
import * as L from './rules.js';
import * as AU from './au2.js';

let loadHidden = false, hud = null, RT = null, H = null, ph = '', popup = null, popK = -1, tv = null, tc = null, hinted = false, finDone = false, tallySum = 0, lostPrev = 0, buildK = -1, secBefore = 0;
const SHOP_URL = 'https://realtruck.com.au/?utm_source=game&utm_medium=social&utm_campaign=black_friday';
const GOOD = new Set(['SMOOTH LINE', 'MISSED THE HOLES', 'ALL HELD', 'SHALLOW FORD']);
const picks = () => { const q = L.S.sel || []; return { product_1: q[0] || '', product_2: q[1] || '', product_3: q[2] || '' }; };
let LOWT = false;
export function setTier(t) { LOWT = t === 'low'; }
export const phase = () => ph;
export const active = () => !!hud;

export function mount(rt, hooks) {
  RT = rt; H = hooks; document.body.classList.add('uikit');
  const st = document.createElement('style'); st.textContent = 'body.uikit .rt,body.uikit #rt-bar,body.uikit #tc-ub,body.uikit #rt-start,body.uikit #rt-sheet,body.uikit #tc-choice,body.uikit #tc-dim,body.uikit #rt-hand,body.uikit .rt-call,body.uikit .tc-plus,body.uikit #status{display:none !important}#c{z-index:0}body.uikit .rk-stage{z-index:5}'; document.head.appendChild(st);
  /* the kit's stage above the core's #rt-cv canvas (z-index 1): measured 00:4x IST, the canvas took the PLAY click (elementFromPoint at the
     button was #rt-cv); the stage keeps pointer-events none, so drags still reach the canvas and only the kit's controls take taps */
  /* ?uihide=1: the start scene running with the UI layer hidden (clean backdrops for the UI job) */
  if (new URLSearchParams(location.search).has('uihide')) st.textContent += '.rk-stage{display:none !important}';
  /* portrait start = the kit's poster (owner picked poster A, 23:29 IST); landscape and desktop unchanged */
  UI.config({ logo: new URL('assets/brand/realtruck-logo-horz-light.svg', location.href).href, renders: new URL('ui/renders/', location.href).href, startPortrait: 'poster' });
  const C = L.CONFIG;
  hud = UI.mountHud(document.body, {
    target: C.target, barMax: C.barMax, camp: C.campS, muted: AU.isMuted(),
    track: (name, data) => RT.track(name, Object.assign({}, data || {}, name === 'shop_click' || name === 'code_copy' ? picks() : {})),
    onSound: m => AU.setMuted(m),
    onPlay: () => { hinted = false; RT.startPlay(); },
    onPlayAgain: () => { hud.reset(); ph = ''; RT.startPlay(); },
    onRetry: cp => { hud.reset(); ph = ''; if (cp) RT.retry(); else RT.startPlay(); }
  });
  tv = document.createElement('canvas'); tv.id = 'tc-tt'; tv.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;z-index:60;pointer-events:none;display:none'; document.body.appendChild(tv); tc = tv.getContext('2d');
  hud.showLoading(0.1);
}
export function loading(p) { if (hud && ph === '') hud.showLoading(p); }
/* callouts from the rules' FX hooks: only the kit's kinds; the kit's copy; losses come from the count (lossFrame) */
export function call(text) {
  if (!hud || ph !== 'play') return; const t = String(text || '').replace(/<[^>]+>/g, '').trim().toUpperCase();
  if (/PROTECTED/.test(t)) return; if (/^STEADY/.test(t)) return hud.callout('steady'); if (/SWERVE/.test(t)) return; if (/CLOSE ONE/.test(t)) return hud.callout('near');
  if (GOOD.has(t)) return hud.callout('good', t);
}
/* a swerve throw: the kit's own callout with the number; the generic loss callout skips that many */
let swerveSkip = 0;
export function swerve(n) { if (!hud || !n) return; swerveSkip += n; hud.callout('swerve', n); }
/* the kit's danger markers (07-ui hud.markers): the view computes the list every frame in play */
export function markers(l) { if (hud && hud.markers) hud.markers(l); }
export function plus(n) { if (hud && ph === 'play') hud.callout('plus', n); }
function lossFrame() { const s = L.S; if (s.lost < lostPrev) lostPrev = 0; if (s.lost > lostPrev && ph === 'play') { const d = s.lost - lostPrev - swerveSkip; swerveSkip = Math.max(0, swerveSkip - (s.lost - lostPrev)); if (d > 0) hud.callout('loss', d); } lostPrev = s.lost; }
function nextChip() { const s = L.S; let best = null; for (const h of L.HZ) { const m = h.s0 - s.s; if (m > 0 && m < 55 && (!best || m < best.m)) best = { type: h.type, m }; } return best; }
function openPopup(k) {
  const s = L.S, G0 = L.GATES[k], titles = UI.COPY.gateTitles || [];
  const safeAfter = id => { const keep = s.sel.slice(), kb = s.bars; s.sel[k] = id; if (id === 'bars') s.bars = true; L.recount(); const n = s.secN; s.sel = keep; s.bars = kb; L.recount(); return n; };
  /* Low tier: the kit's static product renders in the card windows (no live turntables; perf audit 02:3x IST) */
  const cards = G0.opts.map(id => Object.assign(UI.card(id, { from: s.secN, to: safeAfter(id) }), LOWT && UI.PRODUCTS[id] && UI.renderUrl ? { img: UI.renderUrl(UI.PRODUCTS[id].render) } : {}));
  popup = { k, ids: G0.opts.slice(), p: hud.showPopup({ n: k + 1, title: titles[k] }, cards, i => { const S2 = L.S; if (S2.hold && S2.hold.phase === 'choose') { S2.hold.hi = i; S2.hold.pending = i; AU.sfx('choose'); } }) };
  popK = k; secBefore = s.secN; AU.sfx('found');
}
/* the product windows: the view renders turntables at these rects (viewport CSS px) */
export function cardRects() {
  if (!popup || !hud) return []; const s = L.S, hi = s.hold ? s.hold.hi : -1, sel = popup.p && popup.p.selected != null ? popup.p.selected : hi;
  return hud.cardRects().map((r, i) => ({ id: popup.ids[i], x: r.left, y: r.top, w: r.width, h: r.height, sel: sel === i, dim: sel >= 0 && sel !== i, op: 1 }));
}
export const popupShown = () => !!popup;
/* copy the turntables rendered into the main canvas onto the overlay above the kit */
export function blit(glCanvas, rects) {
  /* The stripes over the card names (owner 02:36 / 02:39 IST) were left-overs: the copy cleared only the current card rects, and the
     cards move (they slide up 24 units as the pop-up opens, scale 0.97 / 1.04 on a pick), so each frame's old bottom rows stayed on the
     overlay as thin dark lines over the title. Now the previous rects are cleared too, and every rect is converted once with the overlay's
     own scale (its device width over its CSS width), rounded inward to whole pixels and clipped to the window (never below its bottom). */
  if (!tv) return; const on = rects.length > 0; if (!on) { if (tv.style.display !== 'none') { tv.style.display = 'none'; tc.clearRect(0, 0, tv.width, tv.height); } BL.prev.length = 0; return; }
  const dpr = Math.min(2, window.devicePixelRatio || 1), W = Math.round(innerWidth * dpr), Hh = Math.round(innerHeight * dpr); if (tv.width !== W || tv.height !== Hh) { tv.width = W; tv.height = Hh; BL.prev.length = 0; }
  tv.style.display = ''; const ox = tv.width / innerWidth, oy = tv.height / innerHeight, kx = glCanvas.width / innerWidth, ky = glCanvas.height / innerHeight;
  for (const q of BL.prev) tc.clearRect(q[0], q[1], q[2], q[3]); BL.prev.length = 0;
  for (const r of rects) {
    const x0 = Math.ceil(r.x * ox), y0 = Math.ceil(r.y * oy), x1 = Math.min(W, Math.floor((r.x + r.w) * ox)), y1 = Math.min(Hh, Math.floor((r.y + r.h) * oy)); if (x1 <= x0 || y1 <= y0) continue;
    tc.clearRect(x0, y0, x1 - x0, y1 - y0); BL.prev.push([x0, y0, x1 - x0, y1 - y0]);
    try { tc.drawImage(glCanvas, x0 / ox * kx, y0 / oy * ky, (x1 - x0) / ox * kx, (y1 - y0) / oy * ky, x0, y0, x1 - x0, y1 - y0); } catch (e) { /* not ready */ }
  }
}
const BL = { prev: [] };
/* the finale count: one step per piece as the stash pulses (the view calls this with each piece's worth) */
export function tallyPiece(w) { if (!hud || ph !== 'finale') return; tallySum += w; hud.tally(Math.min(tallySum, L.S.total)); }
/* every frame, after the view has drawn */
export function frame() {
  if (!hud) return; const m = RT.mode, s = L.S, Hd = s.hold;
  if (!loadHidden) { loadHidden = true; hud.hideLoading(); }
  if (m === 'attract') { if (ph !== 'start') { hud.reset(); hud.showStart(); ph = 'start'; finDone = false; tallySum = 0; lostPrev = s.lost; } return; }
  if (m === 'end') { if (ph !== 'end') { const st = L.status ? L.status() : {}, win = s.total >= L.CONFIG.target && s.reveal;
      if (win) hud.showEnd({ total: s.total, target: L.CONFIG.target, code: L.CONFIG.code, shopUrl: SHOP_URL, sample: true });
      else hud.showFail({ total: s.total, protected: s.banked, target: L.CONFIG.target, checkpoint: st.canRetry ? { n: st.cp || 1 } : null, shopUrl: SHOP_URL });
      ph = 'end'; } return; }
  if (s.done) {
    if (s.reveal && ph !== 'finale' && H.finaleE() >= H.tallyT0() - 0.15) { tallySum = 0; finDone = false; hud.showFinale({ total: s.total, target: L.CONFIG.target, manual: true }); ph = 'finale'; }
    if (ph === 'finale' && !finDone && H.finaleE() > H.finaleEnd() - 1.3) { finDone = true; hud.tally(s.total); hud.tallyDone(); if (s.total >= L.CONFIG.target) AU.sfx('unlock'); }
    if (ph === 'play') { hud.update(state()); }
    return;
  }
  if (Hd && (Hd.phase === 'in' || Hd.phase === 'choose')) { if (Hd.phase === 'choose' && (!popup || popK !== Hd.k)) { openPopup(Hd.k); } if (ph !== 'pause') { hud.setPhase('pause'); ph = 'pause'; } return; }
  if (Hd && Hd.phase === 'fit') {
    if (popup) { try { if (popup.p && popup.p.selected == null && Hd.picked >= 0 && popup.p.select) popup.p.select(Hd.picked); } catch (e) { /* closed */ } hud.hidePopup(); popup = null; }
    if (ph !== 'build' || buildK !== Hd.k) { const id = s.sel[Hd.k], P = UI.PRODUCTS[id]; L.recount(); const gained = Math.max(0, s.secN - secBefore); hud.setPhase('build'); if (P) hud.showBuild(P.name, gained); ph = 'build'; buildK = Hd.k; }
    return;
  }
  if (popup) { hud.hidePopup(); popup = null; }
  if (ph !== 'play') { hud.setPhase('play'); ph = 'play'; /* the hint is the controls module's (06-controls) */ }
  lossFrame(); hud.update(state());
}
/* the narrow-screen test read on resize only (no per-frame layout read; perf audit 02:3x IST) */
let NARROW = innerWidth < 380; addEventListener('resize', () => { NARROW = innerWidth < 380; });
const state = () => { const s = L.S; return { total: s.total, protected: s.banked, s: s.s, camp: s.campS, next: nextChip(), streak: NARROW ? 0 : s.mult, unstable: !!s.unstable, muted: AU.isMuted() }; };
