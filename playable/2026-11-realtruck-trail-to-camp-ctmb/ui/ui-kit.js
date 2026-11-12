/* Trail to Camp UI kit: tiny DOM components, no framework, no three.js. ES module.
   const hud = mountHud(el, opts) mounts one instance into el (the game's full-screen overlay or a gallery frame); the module-level
   functions (update, showPopup, callout, showStart, showEnd, showFail, showLoading, ...) act on the last mounted instance.
   The game owns the rules and the 3D; the kit owns layout, type, states and motion. The kit never changes game state: it calls the
   handlers it is given (onPlay, onFit, onRetry, onPlayAgain, onSound, onOption) and reports actions through opts.track(name, data).
   Look: RealTruck's flat black and yellow; pictures are renders of the game's own models (renders/); symbols are a few solid glyphs. */

const HERE = new URL('./', import.meta.url);
const CFG = {
  logo: new URL('assets/brand/realtruck-logo-horz-light.svg', HERE).href,
  renders: new URL('renders/', HERE).href,
  /* the portrait (phone) start screen: 'classic' (the approved one), 'poster' or 'sheet' (two new options for the owner's pick);
     landscape and desktop are not affected */
  startPortrait: 'classic'
};
export function config(o) { Object.assign(CFG, o || {}); }
export const renderUrl = name => new URL(name + '.png', CFG.renders).href;

/* ---------- copy: every string the kit shows ---------- */
export const COPY = {
  brandAlt: 'RealTruck',
  startHead: 'UNLOCK YOUR <em>BLACK FRIDAY</em> CODE',
  couponLabel: 'BLACK FRIDAY CODE',
  couponMask: '••••-••••',
  steps: n => [['LOAD UP:', 'grab the cargo on the road'], ['KIT OUT:', 'pick a RealTruck upgrade to protect it'], ['MAKE CAMP', `with ${n} on board and your code unlocks`]],
  play: 'PLAY',
  startLines: ['UNLOCK YOUR', 'BLACK FRIDAY', 'CODE'],
  /* poster tiles: two-word label + one short line (PROPOSED, owner to confirm) */
  tiles: n => [['LOAD UP', 'grab the cargo'], ['KIT OUT', 'pick a RealTruck upgrade'], ['MAKE CAMP', `arrive with ${n} to unlock`]],
  steer: 'DRAG TO STEER',
  steerKeys: 'STEER',
  or: 'or',
  unlockLabel: 'CODE<br>UNLOCK',
  almost: 'ALMOST THERE',
  reached: n => `${n} ON BOARD: GET IT TO CAMP`,
  campDone: 'CAMP',
  popKicker: 'BLACK FRIDAY UPGRADE',
  gateTitles: ['SORT THE TUB', 'COVER IT', 'RACK IT'],
  protectedWord: 'PROTECTED',
  fitIt: 'FIT IT',
  fitted: name => `${name} FITTED`,
  plusProtected: n => `+${n} PROTECTED`,
  steady: 'STEADY!',
  swerve: n => `SWERVE −${n}`,
  near: 'CLOSE ONE',
  streak: 'STREAK',
  finKicker: 'YOU MADE CAMP WITH',
  finWin: 'CODE UNLOCKED',
  finShort: n => `${n} MORE TO UNLOCK`,
  endHead: n => `YOU MADE CAMP WITH <b>${n}</b>`,
  endCodeLabel: 'YOUR BLACK FRIDAY CODE',
  sample: 'Sample: the code, offer and terms come from RealTruck',
  copyCode: 'COPY CODE',
  copied: 'COPIED',
  shop: 'SHOP BLACK FRIDAY',
  playAgain: 'PLAY AGAIN',
  soClose: 'SO CLOSE',
  failMore: n => `<b>${n} more</b> and your code unlocks`,
  tryAgain: 'TRY AGAIN',
  options: 'OPTIONS', sound: 'SOUND', on: 'ON', off: 'OFF', quality: 'QUALITY', auto: 'AUTO', low: 'LOW', high: 'HIGH', pace: 'PACE', relaxed: 'RELAXED', normal: 'NORMAL', done: 'DONE',
  soundOnLabel: 'Sound on', soundOffLabel: 'Sound off', closeLabel: 'Close'
};

/* THE SINGLE SOURCE for the upgrade cards: the game's product ids, the short names (RealTruck's casing: EVOm, EVOe), the get- and
   but-lines, the role, and each one's render. Vocabulary: things collected on the road are CARGO; RealTruck products are UPGRADES. */
export const PRODUCTS = {
  divider: { name: 'BED DIVIDER', role: 'secure', get: 'PROTECTS 12 CARGO', but: 'no bonus cargo', render: 'prod-divider' },
  slide: { name: 'MT SLIDE', role: 'haul', get: 'HEAVY CARGO x2', but: 'nothing protected', render: 'prod-slide' },
  rollM: { name: 'EVOm ROLL COVER', role: 'secure', get: 'PROTECTS 12 MORE CARGO', but: 'no bonus cargo', render: 'prod-rollm' },
  rollE: { name: 'EVOe ROLL COVER', role: 'haul', get: 'BLOCKS 2 BIG HITS A LEG', but: 'nothing protected', render: 'prod-rolle' },
  bars: { name: 'CROSS BARS', role: 'secure', get: 'PROTECTS 12 MORE CARGO', but: 'no bonus cargo', render: 'prod-bars' },
  rack: { name: 'ACCESSORY RACK 75', role: 'haul', get: 'BIG CARGO x3', but: 'nothing protected', render: 'prod-rack' },
  ladder: { name: 'LADDER RACK', role: 'haul', get: 'BIG CARGO x3', but: 'nothing protected', render: 'prod-ladder' },
  adventure: { name: 'ADVENTURE RACK 75', role: 'haul', get: 'BIG CARGO x3', but: 'nothing protected', render: 'prod-adventure' }
};
/* a card for showPopup from a product id: card('divider', { from: 0, to: 12 }) */
export const card = (id, meter = {}) => Object.assign({ id }, PRODUCTS[id], PRODUCTS[id] && PRODUCTS[id].role === 'secure' ? meter : {});

/* ---------- glyphs: solid and few; road-sign marks are bold black on the yellow diamond ---------- */
const G = s => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${s}</svg>`;
const GLYPH = {
  'padlock-closed': G('<path class="a" d="M6.5 10V7.5a5.5 5.5 0 0 1 11 0V10h-3V7.5a2.5 2.5 0 0 0-5 0V10z"/><path class="a" d="M4 10h16v12H4z"/><path class="b" d="M10.6 13.6h2.8v4.8h-2.8z"/>'),
  'padlock-open': G('<path class="a" d="M6.5 10V7.5a5.5 5.5 0 0 1 10.6-2.1l-2.8 1.1A2.5 2.5 0 0 0 9.5 7.5V10z"/><path class="a" d="M4 10h16v12H4z"/><path class="b" d="M10.6 13.6h2.8v4.8h-2.8z"/>'),
  star: G('<path class="a" d="m12 1.5 3.2 6.9 7.5.8-5.6 5.1 1.6 7.4L12 17.9l-6.7 3.8 1.6-7.4-5.6-5.1 7.5-.8z"/>'),
  'sound-on': G('<path class="a" d="M2.5 8.5h4.5l6-5v17l-6-5H2.5z"/><path class="s" d="M16 8.5c1.6 1.8 1.6 5.2 0 7M19 5.5c3.3 3.5 3.3 9.5 0 13"/>'),
  'sound-off': G('<path class="a" d="M2.5 8.5h4.5l6-5v17l-6-5H2.5z"/><path class="s" d="m16 9 6 6m0-6-6 6"/>'),
  'arrow-l': G('<path class="a" d="M3 12 13 3.5v5.5h8v6h-8v5.5z"/>'),
  'arrow-r': G('<path class="a" d="M21 12 11 3.5v5.5H3v6h8v5.5z"/>'),
  tent: G('<path class="a" d="M12 3 1.5 21h21z"/><path class="b" d="m12 11-4 10h8z"/>'),
  check: G('<path class="s" style="stroke-width:3.4" d="m4 12.5 5 5L20 6.5"/>'),
  close: G('<path class="s" style="stroke-width:3" d="m5 5 14 14M19 5 5 19"/>'),
  'sign-corrug': G('<path class="g" d="M3 7.5c2.2-2.6 4-2.6 6 0s3.8 2.6 6 0 3.8-2.6 6 0M3 12.5c2.2-2.6 4-2.6 6 0s3.8 2.6 6 0 3.8-2.6 6 0M3 17.5c2.2-2.6 4-2.6 6 0s3.8 2.6 6 0 3.8-2.6 6 0"/>'),
  'sign-rocks': G('<path class="f" d="M2 21 7.5 11l4 5 3.5-7L22 21z"/><path class="f" d="M15.5 3.5h4v4h-4z" transform="rotate(20 17.5 5.5)"/>'),
  'sign-pothole': G('<ellipse class="f" cx="8.5" cy="10" rx="6" ry="3.4"/><ellipse class="f" cx="16" cy="17" rx="5" ry="2.8"/>'),
  'sign-grid': G('<path class="g" d="M3 7h18M3 12h18M3 17h18"/><path class="f" d="M2 4h3v16H2zM19 4h3v16h-3z"/>'),
  'sign-creek': G('<path class="g" d="M2.5 10c2.3-2.4 4.2-2.4 6.3 0s4.2 2.4 6.4 0 4.2-2.4 6.3 0M2.5 16.5c2.3-2.4 4.2-2.4 6.3 0s4.2 2.4 6.4 0 4.2-2.4 6.3 0"/>'),
  'sign-crest': G('<path class="f" d="M1.5 21C5 11 19 11 22.5 21z"/><path class="f" d="M12 2.5 17 8h-3.2v4h-3.6V8H7z"/>'),
  'sign-branch': G('<path class="f" d="m2 16.5 19-6.5 1.2 3.4-19 6.5z"/><path class="g" d="m9.5 13.5-2.5-6M15.5 11.5l2-5.5"/>'),
  'sign-washout': G('<path class="f" d="M2 21V5h3.2v12.8H22V21z"/><path class="f" d="M12 9h10v6h-7l-1.5-3z"/>')
};
export const GLYPHS = Object.keys(GLYPH);
export function glyph(name, cls = '') { return `<i class="rk-ico ${cls}" data-i="${name}">${GLYPH[name] || ''}</i>`; }
export const signFor = type => GLYPH['sign-' + type] ? 'sign-' + type : type === 'log' ? 'sign-branch' : 'sign-rocks';
const arrow = '<i class="rk-arrow" aria-hidden="true"></i>';
/* the joystick: dark glass base, thin yellow ring, left/right chevrons, a yellow glow arc on the side being pushed; solid yellow knob
   with a crisp highlight and an inner ring (no bars: two bars read as a pause icon). viewBox units = CSS px at a 128 px base (scaled by the element size) */
/* the danger marker: a yellow diamond with a bold black "!" (drawn, no font), thin black edge, a short pointer under it; viewBox
   40 x 50, the pointer's tip at (20, 50) is the anchor */
const MARKER = `<svg viewBox="0 0 40 50" aria-hidden="true"><path d="M20 1.8 38.2 20 20 38.2 1.8 20z" fill="#FFC600" stroke="#000" stroke-width="2" stroke-linejoin="round"/>
  <path d="M17.6 9.5h4.8l-.9 13.6h-3z" fill="#000"/><circle cx="20" cy="28.3" r="2.6" fill="#000"/>
  <path d="M15.6 40.5h8.8L20 48.8z" fill="#FFC600" stroke="#000" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const STICK_BASE = `<svg class="rk-stick__base" viewBox="-64 -64 128 128" aria-hidden="true">
  <circle r="62" fill="rgba(13,11,9,.42)" stroke="rgba(0,0,0,.5)" stroke-width="1.5"/><circle r="50" fill="rgba(13,11,9,.16)"/><circle r="59.5" fill="none" stroke="#FFC600" stroke-width="2" stroke-opacity=".95"/>
  <rect x="-40" y="-1.5" width="80" height="3" fill="rgba(255,255,255,.18)"/>
  <path d="M-45 -8-53 0-45 8M45 -8 53 0 45 8" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="3" stroke-linecap="square"/>
  <g class="rk-stick__arc" style="opacity:0"><circle r="59.5" pathLength="360" fill="none" stroke="#FFC600" stroke-opacity=".3" stroke-width="12"/><circle r="59.5" pathLength="360" fill="none" stroke="#FFC600" stroke-width="4.5"/></g>
  <g class="rk-stick__arc" style="opacity:0" transform="rotate(180)"><circle r="59.5" pathLength="360" fill="none" stroke="#FFC600" stroke-opacity=".3" stroke-width="12"/><circle r="59.5" pathLength="360" fill="none" stroke="#FFC600" stroke-width="4.5"/></g></svg>`;
const STICK_KNOB = `<svg viewBox="-32 -32 64 64" aria-hidden="true">
  <circle cy="4" r="30" fill="rgba(0,0,0,.22)"/><circle cy="2.5" r="28" fill="rgba(0,0,0,.25)"/>
  <circle r="27" fill="#FFC600" stroke="rgba(0,0,0,.5)" stroke-width="1.5"/>
  <path d="M-26.2 6.5A27 27 0 0 0 26.2 6.5A30 30 0 0 1 -26.2 6.5z" fill="#D9A400"/>
  <path d="M-24 -5A24 24 0 0 1 24 -5A30 30 0 0 0 -24 -5z" fill="rgba(255,255,255,.3)"/>
  <path d="M-19 -13A23 23 0 0 1 4 -23" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="2.6" stroke-linecap="round"/>
  <circle r="17" fill="none" stroke="#C99400" stroke-width="2.2"/></svg>`;

/* ---------- helpers ---------- */
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const restart = (e, c) => { e.classList.remove(c); void e.offsetWidth; e.classList.add(c); };
const RM = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const stopIn = e => e.stopPropagation();
const guard = el => { for (const ev of ['pointerdown', 'pointermove', 'pointerup', 'touchstart', 'touchmove', 'touchend', 'mousedown']) el.addEventListener(ev, stopIn, { passive: true }); };
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch (e) { /* fall through to the textarea route */ }
  try { const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0'; document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok; } catch (e) { return false; }
}
const label = t => `<span>${t}</span>`;

/* the unlock bar: protected (solid) + loose (hatched) against the target; padlock at the target, stars past it */
function makeBar(cfg) {
  const T = cfg.target, M = cfg.barMax || Math.round(T * 1.5), X = v => (100 * clamp(v / M, 0, 1)).toFixed(2) + '%';
  const el = h('div', 'rk-bar');
  el.innerHTML = `<div class="rk-bar__trough"><div class="rk-bar__win"><div class="rk-bar__fill rk-bar__fill--loose"></div><div class="rk-bar__fill rk-bar__fill--safe"></div><div class="rk-bar__sweep"></div>${cfg.edge === false ? '' : '<div class="rk-bar__edge" style="left:0"></div>'}</div></div>` +
    /* stars removed (owner 2026-11-11 23:32): the code is the reward; cfg.stars is still accepted and ignored */
    (cfg.lock === false ? '' : `<span class="rk-bar__mark rk-lock" style="left:${X(T)}">${glyph('padlock-closed')}</span>`);
  const fl = el.querySelector('.rk-bar__fill--loose'), fs = el.querySelector('.rk-bar__fill--safe'), ed = el.querySelector('.rk-bar__edge'), lk = el.querySelector('.rk-lock'), st = [...el.querySelectorAll('.rk-star')];
  const last = { safe: -1, total: -1, lock: '' };
  return {
    el,
    set(safe, total) {
      if (safe === last.safe && total === last.total) return;
      fs.style.width = X(safe); fl.style.width = X(total); if (ed) { ed.style.left = X(total); ed.style.display = total > 0 && total < M ? '' : 'none'; }
      for (const s of st) { const on = total >= +s.dataset.s; if (on !== s.classList.contains('is-on')) { s.classList.toggle('is-on', on); if (on) restart(s, 'is-pop'); } }
      last.safe = safe; last.total = total;
    },
    lock(state) {
      if (!lk || state === last.lock) return; last.lock = state;
      lk.classList.toggle('is-ready', state === 'ready'); lk.classList.toggle('is-open', state === 'open');
      lk.innerHTML = glyph(state === 'open' ? 'padlock-open' : 'padlock-closed');
      if (state === 'open') restart(lk, 'is-burst');
    },
    sweep() { restart(el, 'is-sweep'); },
    loss() { restart(el, 'is-loss'); },
    instant(on) { el.querySelectorAll('.rk-bar__fill,.rk-bar__edge').forEach(e => { e.style.transition = on ? 'none' : ''; }); }
  };
}

/* ---------- the instance ---------- */
const INST = [];
let CUR = null;

export function mountHud(el, opts = {}) {
  const o = Object.assign({ target: 50, barMax: 75, stars: [50, 60, 70], gates: [118, 300, 560], camp: 890, muted: false, options: false, track: () => {}, onSound: null, onOption: null, onPlay: null, onPlayAgain: null, onRetry: null }, opts);
  if (!opts.options && typeof location !== 'undefined' && /[?&]options=1\b/.test(location.search)) o.options = true;
  const stage = h('div', 'rk-stage'), root = h('div', 'rk-root');
  stage.appendChild(root); el.appendChild(stage);
  const T = o.target;

  /* brand bar: the logo and the sound toggle (an OPTIONS text button only behind ?options=1) */
  const brand = h('div', 'rk-brand rk-l-sheet');
  brand.innerHTML = `<img class="rk-logo" alt="${COPY.brandAlt}" src="${CFG.logo}" draggable="false"><span class="rk-sp"></span>${o.options ? `<button class="rk-btn rk-btn--ghost" data-a="options" style="min-height:var(--tap);font-size:var(--fs-label)">${label(COPY.options)}</button>` : ''}<button class="rk-iconbtn" data-a="sound" aria-label="${COPY.soundOnLabel}">${glyph('sound-on')}</button>`;
  guard(brand);
  const bSound = brand.querySelector('[data-a=sound]'), bOpt = brand.querySelector('[data-a=options]');

  /* HUD: unlock strip (count, bar, distance line), the sign chip, the streak, the steering hint */
  const hud = h('div', 'rk-hud rk-l-hud is-hidden');
  const top = h('div', 'rk-top'), un = h('div', 'rk-unlock');
  un.innerHTML = `<div class="rk-unlock__in"><div class="rk-unlock__row"><div class="rk-label rk-unlock__lab">${COPY.unlockLabel}</div><span class="rk-num rk-unlock__n">0</span><span class="rk-num rk-unlock__t"><span class="rk-slash">/</span>${T}</span><span class="rk-unlock__tag"><span></span></span></div><div class="rk-ub"></div>
    <div class="rk-track"><div class="rk-track__run"><div class="rk-track__line"></div><span class="rk-track__dot" style="left:0"></span></div>${glyph('tent', 'rk-track__camp')}</div></div>`;
  const bar = makeBar({ target: T, barMax: o.barMax, stars: o.stars });
  un.querySelector('.rk-ub').replaceWith(bar.el);
  const row2 = h('div', 'rk-row2'); row2.innerHTML = `<div class="rk-chip is-off"><span class="rk-sign">${glyph('sign-rocks')}</span><span class="rk-chip__m">0 m</span></div>`;
  top.append(un, row2);
  const cr = h('div', 'rk-corner rk-corner--r'); cr.innerHTML = `<div class="rk-streak is-off"><span class="rk-num rk-streak__x rk-cap">x2</span><span class="rk-label rk-streak__l">${COPY.streak}</span></div>`;
  const hint = h('div', 'rk-hint');
  hint.innerHTML = `<div class="rk-hint__stick">${STICK_BASE}<span class="rk-stick__knob">${STICK_KNOB}</span></div>
    <div class="rk-hint__keys"><span class="rk-kp"><span class="rk-key rk-key--l">${glyph('arrow-l')}</span><span class="rk-key rk-key--r">${glyph('arrow-r')}</span></span><span class="rk-or">${COPY.or}</span><span class="rk-kp"><span class="rk-key rk-key--l"><b class="rk-key__c rk-cap">A</b></span><span class="rk-key rk-key--r"><b class="rk-key__c rk-cap">D</b></span></span></div>
    <div class="rk-hint__t"><span class="rk-cap rk-hint__ts">${COPY.steer}</span><span class="rk-cap rk-hint__tk">${COPY.steerKeys}</span></div>`;
  /* the phone joystick: drawn by the kit, driven by the game (hud.stick); transform-only updates, hidden = display none */
  const stick = h('div', 'rk-stick'); stick.innerHTML = `${STICK_BASE}<span class="rk-stick__knob">${STICK_KNOB}</span>`;
  /* danger markers over obstacles: a pool of three, moved by transform only, display none when unused */
  const MK = [0, 1, 2].map(() => { const e = h('div', 'rk-mk'); e.innerHTML = `<span class="rk-mk__in">${MARKER}</span>`; e.style.display = 'none'; return { el: e, last: '' }; });
  hud.append(top, cr, hint, stick, ...MK.map(m => m.el));
  const SK = { el: stick, knob: stick.querySelector('.rk-stick__knob'), arcs: [...stick.querySelectorAll('.rk-stick__arc')], on: false, t: 0, last: '' };
  const R = {
    n: un.querySelector('.rk-unlock__n'), tag: un.querySelector('.rk-unlock__tag'), tagT: un.querySelector('.rk-unlock__tag > span'), dot: un.querySelector('.rk-track__dot'), chip: row2.querySelector('.rk-chip'), chipM: row2.querySelector('.rk-chip__m'), sign: row2.querySelector('.rk-sign'), streak: cr.querySelector('.rk-streak')
  };

  const lane = h('div', 'rk-lane rk-l-callout');
  const dim = h('div', 'rk-dim rk-l-dim'), pop = h('div', 'rk-pop rk-l-popup rk-hide');
  const scr = h('div', 'rk-l-screen'), fin = h('div', 'rk-fin rk-l-screen rk-hide'), scrim = h('div', 'rk-scrim rk-l-sheet'), sheets = h('div', 'rk-l-sheet'), load = h('div', 'rk-l-load');
  root.append(hud, lane, dim, pop, scr, fin, scrim, sheets, brand, load);
  for (const e of [pop, scr, sheets, scrim]) guard(e);

  const me = {
    el: root, opts: o, phase: 'idle', state: {}, muted: !!o.muted,

    /* ----- phase: which layers show ('loading' | 'start' | 'play' | 'pause' | 'build' | 'finale' | 'end' | 'fail') ----- */
    setPhase(p) {
      me.phase = p; root.dataset.phase = p;
      hud.classList.toggle('is-hidden', !['play', 'pause'].includes(p));
      hud.classList.toggle('is-dim', p === 'pause');
      brand.style.opacity = p === 'pause' || p === 'build' ? '0.2' : '';
      if (bOpt) bOpt.classList.toggle('rk-hide', !['start', 'end', 'fail'].includes(p));
      bSound.classList.toggle('rk-hide', p === 'loading');
      lane.style.display = ['play', 'build'].includes(p) ? '' : 'none';
      if (p !== 'play' && p !== 'build') me._laneClear();
      if (p !== 'play') { me.hint(false); me.stick(null); me.markers(null); }
      lane.classList.toggle('is-centre', p === 'build');
    },

    /* ----- per-frame HUD update; cheap: only changed values touch the DOM ----- */
    update(s) {
      const P = me.state, total = s.total | 0, safe = clamp(s.protected | 0, 0, total);
      if (total !== P.total) {
        R.n.textContent = total;
        if (P.total != null) { if (total > P.total) restart(R.n, 'is-pop'); else { restart(R.n, 'is-hit'); bar.loss(); } }
      }
      if (safe > (P.protected ?? safe)) bar.sweep();
      bar.set(safe, total);
      if (!!s.unstable !== !!P.unstable) bar.el.classList.toggle('is-unstable', !!s.unstable);
      const ready = total >= T, near = !ready && total >= T * 0.85, tag = ready ? 'ready' : near ? 'near' : '';
      if (tag !== P.tag) { R.tag.classList.toggle('is-on', !!tag); R.tag.classList.toggle('is-quiet', tag === 'near'); if (tag) R.tagT.textContent = ready ? COPY.reached(T) : COPY.almost; }
      bar.lock(ready ? 'ready' : 'locked');
      const camp = s.camp || o.camp, q = (100 * clamp((s.s || 0) / camp, 0, 1)).toFixed(1) + '%';
      if (q !== P.q) R.dot.style.left = q;
      const nx = s.next && s.next.m > 0 ? s.next : null, nk = nx ? nx.type + '|' + Math.round(nx.m / 10) * 10 : '';
      if (nk !== P.nk) { R.chip.classList.toggle('is-off', !nx); if (nx) { const want = signFor(nx.type), ic = R.sign.querySelector('.rk-ico'); if (ic.dataset.i !== want) ic.outerHTML = glyph(want); R.chipM.textContent = Math.round(nx.m / 10) * 10 + ' m'; R.chip.classList.toggle('is-near', nx.m <= 20); } }
      const st = s.streak | 0;
      if (st !== P.streak) { R.streak.classList.toggle('is-off', st < 2); if (st >= 2) { R.streak.querySelector('.rk-streak__x').textContent = 'x' + st; if (st > (P.streak | 0)) restart(R.streak, 'is-pop'); } }
      if (s.muted != null && s.muted !== me.muted) me.setMuted(s.muted, true);
      Object.assign(P, { total, protected: safe, tag, q, nk, streak: st, unstable: !!s.unstable });
      if (s.phase && s.phase !== me.phase) me.setPhase(s.phase);
    },

    setMuted(m, quiet) { me.muted = !!m; bSound.innerHTML = glyph(m ? 'sound-off' : 'sound-on'); bSound.setAttribute('aria-label', m ? COPY.soundOffLabel : COPY.soundOnLabel); if (!quiet && o.onSound) o.onSound(me.muted); },

    /* ----- DRAG TO STEER: the first second of play ----- */
    /* the start hint: hint('stick') on touch, hint('keys') on keyboard; hint(true) picks by the device; hides on the first input */
    hint(on = true, ms = 3000, opt = {}) {
      clearTimeout(me._ht); if (me._hOff) me._hOff();
      if (!on) { hint.classList.remove('is-on'); return; }
      const mode = on === 'stick' || on === 'keys' ? on : (typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 'stick' : 'keys');
      hint.dataset.mode = mode; hint.classList.add('is-on');
      if (opt && opt.manual) return;   /* the caller dismisses: hint(false), a new hint() call, or leaving the play phase */
      const off = () => { hint.classList.remove('is-on'); if (me._hOff) me._hOff(); };
      const evs = ['pointerdown', 'keydown'], t0 = performance.now(), fn = () => { if (performance.now() - t0 > 250) off(); };
      for (const ev of evs) addEventListener(ev, fn, { passive: true });
      me._hOff = () => { for (const ev of evs) removeEventListener(ev, fn); me._hOff = null; };
      if (ms) me._ht = setTimeout(off, ms);
    },

    /* danger markers, visual only: list = up to 3 items { x, y, a, s } in CSS px relative to the mount (x, y = the anchor point above
       the obstacle, the pointer's tip sits on it; a = alpha 0..1; s = scale, default 1); null or [] hides them */
    markers(list) {
      for (let i = 0; i < MK.length; i++) {
        const m = MK[i], it = list && list[i];
        if (!it || !(it.a > 0)) { if (m.last) { m.el.style.display = 'none'; m.last = ''; } continue; }
        if (!m.last) { m.el.style.display = 'block'; m.w = m.w || m.el.offsetWidth || 30; }
        /* the drawn size stays 26-36 px on phones (base 30) and 30-46 px on landscape (base 38) whatever scale the game sends */
        const lo = m.w > 36 ? 30 : 26, hi = m.w > 36 ? 46 : 36, sc = Math.max(lo / m.w, Math.min(hi / m.w, it.s == null ? 1 : it.s)), key = `${it.x.toFixed(1)},${it.y.toFixed(1)},${sc.toFixed(3)},${it.a.toFixed(2)}`;
        if (key === m.last) continue;
        m.last = key;
        m.el.style.transform = `translate3d(${it.x}px, ${it.y}px, 0) scale(${sc})`;
        m.el.style.opacity = Math.min(1, it.a);
      }
    },

    /* the phone joystick, visual only. s = { x, y, kx, ky, k? } in CSS px relative to the mount (x, y: where the thumb went down;
       kx, ky: knob offset, clamp |kx| to 0.36 of the base size; k: 0..1 deflection, default |kx| / max travel), or null to release */
    stick(s) {
      const el = SK.el;
      if (!s) { if (SK.on) { SK.on = false; el.classList.remove('is-on'); clearTimeout(SK.t); SK.t = setTimeout(() => { if (!SK.on) el.style.display = 'none'; }, 220); } return; }
      if (!SK.on) { SK.on = true; clearTimeout(SK.t); el.style.display = 'block'; void el.offsetWidth; el.classList.add('is-on'); }
      const R = el.offsetWidth * 0.36 || 46, kx = Math.max(-R, Math.min(R, s.kx || 0)), ky = Math.max(-R * 0.25, Math.min(R * 0.25, s.ky || 0)), k = s.k != null ? Math.max(0, Math.min(1, s.k)) : Math.abs(kx) / R;
      const key = `${s.x | 0},${s.y | 0},${kx.toFixed(1)},${ky.toFixed(1)},${k.toFixed(2)}`; if (key === SK.last) return; SK.last = key;
      el.style.transform = `translate3d(${s.x}px, ${s.y}px, 0)`;
      SK.knob.style.transform = `translate3d(${kx}px, ${ky}px, 0)`;
      const side = kx >= 0 ? 0 : 1, span = 24 + 86 * k, a = k < 0.06 ? 0 : Math.min(1, 0.35 + k);
      SK.arcs.forEach((g, i) => { const on = i === side; g.style.opacity = on ? a : 0; if (on) for (const c of g.children) { c.setAttribute('stroke-dasharray', `${span} ${360 - span}`); c.setAttribute('stroke-dashoffset', span / 2); } });
    },

    /* ----- the one callout lane: numbers and short words ----- */
    _q: [], _cur: null, _timer: 0,
    callout(kind, value, extra) {
      const pri = { protected: 3, fitted: 3, loss: 2, swerve: 2, steady: 2, near: 1, good: 1, info: 1, plus: 0 }[kind] ?? 1;
      const c = me._cur;
      if (kind === 'plus' && c && c.kind === 'plus') { c.v += value | 0 || 1; c.el.querySelector('.rk-call__v').textContent = '+' + c.v; restart(c.el, 'is-bump'); if (!(c.extra && c.extra.hold)) me._arm(700); return; }
      const item = { kind, v: kind === 'plus' ? (value | 0 || 1) : value, pri, extra };
      if (c && pri > c.pri) { me._q.unshift(item); me._next(true); return; }
      if (me._q.length >= 3) { let lo = 0; me._q.forEach((q2, i) => { if (q2.pri < me._q[lo].pri) lo = i; }); if (me._q[lo].pri <= pri) me._q.splice(lo, 1); else return; }
      me._q.push(item); me._q.sort((a, b) => b.pri - a.pri);
      if (!c) me._next();
    },
    _arm(ms) { clearTimeout(me._timer); me._timer = setTimeout(() => me._next(), ms); },
    _next(cut) {
      const c = me._cur;
      if (c) { const e = c.el; e.classList.remove('is-in'); e.classList.add('is-out'); setTimeout(() => e.remove(), cut ? 120 : 220); me._cur = null; }
      const it = me._q.shift(); if (!it) { clearTimeout(me._timer); return; }
      const e = h('div', 'rk-call rk-call--' + it.kind), v = it.v;
      const txt = it.kind === 'plus' ? '+' + v : it.kind === 'loss' ? '−' + Math.abs(v) : it.kind === 'protected' ? COPY.plusProtected(v) : it.kind === 'fitted' ? COPY.fitted(v) : it.kind === 'swerve' ? COPY.swerve(Math.abs(v)) : it.kind === 'steady' ? COPY.steady : it.kind === 'near' ? (v || COPY.near) : String(v);
      e.innerHTML = `<span class="rk-call__v rk-cap">${txt}</span>`;
      lane.appendChild(e); void e.offsetWidth; e.classList.add('is-in');
      me._cur = Object.assign(it, { el: e });
      if (it.extra && it.extra.hold) clearTimeout(me._timer); else me._arm({ plus: 700, loss: 950, swerve: 950, steady: 800, protected: 1300, fitted: 1200 }[it.kind] || 900);
    },
    _laneClear() { me._q = []; clearTimeout(me._timer); if (me._cur) { me._cur.el.remove(); me._cur = null; } lane.innerHTML = ''; },

    /* ----- gate pop-up: gate {n, title}; cards [{id, name, get, but, from, to, img}]; onFit(index) ----- */
    showPopup(gate, cards, onFit) {
      me.setPhase('pause'); dim.classList.add('is-on');
      pop.classList.remove('rk-hide', 'is-out', 'is-in');
      pop.innerHTML = `<div class="rk-pop__grp" role="dialog" aria-modal="true" aria-label="${COPY.popKicker}"><div class="rk-banner"><div class="rk-display rk-banner__k rk-cap">${COPY.popKicker}</div><div class="rk-display rk-banner__t rk-cap">${(gate && (gate.title || COPY.gateTitles[(gate.n || 1) - 1]) || '').toUpperCase()}</div></div>
        <div class="rk-cards">${cards.map((c, i) => { const meter = c.to != null ? `<div class="rk-card__meter"><span class="rk-card__ml">${COPY.protectedWord}</span><span>${c.from | 0}</span>${arrow}<b><span>${c.to}</span></b></div>` : '';
          return `<button class="rk-card" data-i="${i}" aria-pressed="false"><span class="rk-card__tick">${glyph('check')}</span><div class="rk-card__stage" data-slot="product" data-id="${c.id || ''}">${c.img ? `<img alt="" src="${c.img}">` : ''}</div><div class="rk-display rk-card__name rk-cap">${c.name || (PRODUCTS[c.id] || {}).name || ''}</div><div class="rk-display rk-card__get rk-cap">${c.get || (PRODUCTS[c.id] || {}).get || ''}</div>${meter}<div class="rk-card__but">${c.but || (PRODUCTS[c.id] || {}).but || ''}</div></button>`; }).join('')}</div>
        <button class="rk-btn rk-btn--primary rk-btn--big" data-a="fit" disabled>${label(COPY.fitIt)}</button></div>`;
      void pop.offsetWidth; pop.classList.add('is-in');
      const cs = pop.querySelector('.rk-cards'), btn = pop.querySelector('[data-a=fit]'), list = [...pop.querySelectorAll('.rk-card')];
      let sel = -1;
      const select = i => { sel = i; cs.classList.toggle('has-sel', i >= 0); list.forEach((c, k) => { c.classList.toggle('is-sel', k === i); c.setAttribute('aria-pressed', k === i); }); btn.disabled = i < 0; };
      list.forEach((c, i) => c.addEventListener('click', () => select(i)));
      btn.addEventListener('click', () => { if (sel < 0) return; o.track('choose_product', { gate: gate && gate.n, product: cards[sel].id }); me.hidePopup(); if (onFit) onFit(sel); });
      me._popKey = e => { if (e.repeat) return; if (/^[1-9]$/.test(e.key) && +e.key <= cards.length) select(+e.key - 1); else if (e.key === 'ArrowLeft') select(sel <= 0 ? 0 : sel - 1); else if (e.key === 'ArrowRight') select(sel < 0 ? 0 : Math.min(cards.length - 1, sel + 1)); else if (e.key === 'Enter' && sel >= 0) btn.click(); else return; e.preventDefault(); };
      addEventListener('keydown', me._popKey);
      return { select, get selected() { return sel; } };
    },
    hidePopup() { removeEventListener('keydown', me._popKey); dim.classList.remove('is-on'); pop.classList.add('is-out'); setTimeout(() => { pop.classList.add('rk-hide'); pop.innerHTML = ''; }, 260); },
    cardRects() { return [...pop.querySelectorAll('.rk-card__stage')].map(e => e.getBoundingClientRect()); },

    /* ----- build moment: name callout, then the protected beat; nothing else on screen ----- */
    showBuild(name, gained) { me.setPhase('build'); me._laneClear(); me.callout('fitted', name); if (gained) setTimeout(() => me.callout('protected', gained), 900); },

    /* ----- start / title ----- */
    showStart(onPlay) {
      me.setPhase('start'); scr.innerHTML = '';
      const mode = CFG.startPortrait || 'classic', portrait = root.clientWidth < root.clientHeight;
      me._startArgs = [onPlay]; me._startPortrait = portrait;
      if (!me._startRO && typeof ResizeObserver === 'function') { me._startRO = new ResizeObserver(() => { const p2 = root.clientWidth < root.clientHeight; if (me.phase === 'start' && p2 !== me._startPortrait && scr.querySelector('.rk-start:not(.is-out)')) me.showStart(...me._startArgs); }); me._startRO.observe(root); }
      root.classList.toggle('rk-sp-on', mode !== 'classic' && portrait);
      if (mode !== 'classic' && portrait) return me._showStartPortrait(mode, onPlay);
      const s = h('div', 'rk-screen rk-start');
      s.innerHTML = `<img class="rk-start__logo" alt="${COPY.brandAlt}" src="${CFG.logo}" draggable="false"><div class="rk-start__col"><div class="rk-start__top"><h1 class="rk-display rk-start__h">${COPY.startHead}</h1>
        <div class="rk-start__cp"><div class="rk-coupon rk-coupon--locked">${glyph('padlock-closed', 'rk-coupon__lock')}<div class="rk-coupon__txt"><div class="rk-label rk-coupon__k">${COPY.couponLabel}</div><div class="rk-num rk-coupon__code rk-cap">${COPY.couponMask}</div></div></div></div>
        <ol class="rk-steps">${COPY.steps(T).map(([k, t], i) => `<li class="rk-step"><span class="rk-step__n"><span>${i + 1}</span></span><span><b>${k}</b> ${t}</span></li>`).join('')}</ol></div><div class="rk-start__sp"></div>
        <div class="rk-start__bot"><button class="rk-btn rk-btn--primary rk-btn--big" data-a="play">${label(COPY.play)}</button></div></div>`;
      scr.appendChild(s); void s.offsetWidth; s.classList.add('is-in');
      s.querySelector('[data-a=play]').addEventListener('click', () => { o.track('play_start', {}); me.hideStart(); (onPlay || o.onPlay || (() => {}))(); });
    },
    /* the portrait start options: full-bleed world, logo and headline on the sky, the ute clear in 38-66% of the height,
       ticket + steps + PLAY in the thumb zone ('poster': floating on a bottom gradient; 'sheet': a black sheet) */
    _showStartPortrait(mode, onPlay) {
      if (mode === 'sheet' && root.clientHeight <= 700) mode = 'poster';
      const s = h('div', `rk-screen rk-start rk-ps rk-ps--${mode}`);
      const ticket = `<div class="rk-coupon rk-coupon--locked rk-coupon--slim">${glyph('padlock-closed', 'rk-coupon__lock')}<div class="rk-coupon__txt"><div class="rk-coupon__k">${COPY.couponLabel}</div><div class="rk-num rk-coupon__code rk-cap">${COPY.couponMask}</div></div></div>`;
      const steps = mode === 'poster'
        ? `<ol class="rk-tiles">${COPY.tiles(T).map(([k, t], i) => `<li class="rk-tile"><span class="rk-tile__hd"><span class="rk-step__n"><span>${i + 1}</span></span><b class="rk-tile__k rk-cap">${k}</b></span><span class="rk-tile__t">${t}</span></li>`).join('')}</ol>`
        : `<ol class="rk-steps rk-steps--compact">${COPY.steps(T).map(([k, t], i) => `<li class="rk-step"><span class="rk-step__n"><span>${i + 1}</span></span><span><b>${k}</b> ${t}</span></li>`).join('')}</ol>`;
      s.innerHTML = `<div class="rk-ps__top"><img class="rk-ps__logo" alt="${COPY.brandAlt}" src="${CFG.logo}" draggable="false"><h1 class="rk-display rk-ps__h">${COPY.startLines.map((l, i) => `<span class="rk-ps__l rk-ps__l${i + 1}">${l}</span>`).join('')}</h1></div>
        <div class="rk-ps__sp"></div><div class="rk-ps__bot">${ticket}${steps}<button class="rk-btn rk-btn--primary rk-btn--big rk-btn--sheen" data-a="play">${label(COPY.play)}</button></div>`;
      scr.appendChild(s); void s.offsetWidth; s.classList.add('is-in');
      s.querySelector('[data-a=play]').addEventListener('click', () => { o.track('play_start', {}); me.hideStart(); (onPlay || o.onPlay || (() => {}))(); });
    },
    hideStart() { const s = scr.querySelector('.rk-start'); if (!s) return; s.classList.add('is-out'); setTimeout(() => s.remove(), 300); },

    /* ----- loading: logo and bar ----- */
    showLoading(p) {
      let L = load.querySelector('.rk-load');
      if (!L) { me.setPhase('loading'); L = h('div', 'rk-screen rk-load'); L.innerHTML = `<img class="rk-logo" alt="${COPY.brandAlt}" src="${CFG.logo}"><div class="rk-load__bar"></div>`; const b = makeBar({ target: 100, barMax: 100, lock: false, edge: false }); L.querySelector('.rk-load__bar').replaceWith(b.el); b.el.classList.add('rk-load__bar'); b.el.setAttribute('role', 'progressbar'); L._b = b; load.appendChild(L); }
      const v = Math.round(clamp(p || 0, 0, 1) * 100); L._b.set(v, v); L._b.el.setAttribute('aria-valuenow', v);
    },
    hideLoading() { const L = load.querySelector('.rk-load'); if (!L) return; L.classList.add('is-out'); setTimeout(() => L.remove(), 320); },

    /* ----- finale tally over the scene: rolls 0 -> total (or the game drives it with tally(n) then tallyDone()) ----- */
    showFinale(r) {
      me.setPhase('finale'); me._laneClear();
      const TT = r.target || T;
      fin.classList.remove('rk-hide', 'is-up'); fin.classList.add('is-solo');
      fin.innerHTML = `<div class="rk-label rk-fin__k">${COPY.finKicker}</div><div class="rk-num rk-fin__n"><span>0</span><small>/ ${TT}</small></div><div class="rk-fin__bar"></div><div class="rk-display rk-fin__msg rk-cap"></div>`;
      const b = makeBar({ target: TT, barMax: r.barMax || o.barMax, stars: r.starsAt || o.stars }); fin.querySelector('.rk-fin__bar').replaceWith(b.el); b.el.classList.add('rk-fin__bar'); b.instant(true);
      const nw = fin.querySelector('.rk-fin__n'), num = nw.querySelector('span'), msg = fin.querySelector('.rk-fin__msg');
      let shown = -1;
      me.tally = n => { n = Math.round(n); if (n === shown) return; shown = n; num.textContent = n; b.set(n, n); if (n >= TT) { nw.classList.add('is-hit'); b.lock('open'); } };
      me.tally(0);
      me.tallyDone = () => { msg.textContent = (r.total >= TT) ? COPY.finWin : COPY.finShort(TT - r.total); msg.classList.add('is-on'); };
      if (r.manual) return Promise.resolve();
      const dur = RM() ? 1 : clamp((r.total || 0) * 32, 900, 2000);
      return new Promise(res => {
        const t0 = performance.now();
        const step = () => { const k = clamp((performance.now() - t0) / dur, 0, 1), e = 1 - Math.pow(1 - k, 2.2); me.tally((r.total || 0) * e); if (k < 1) setTimeout(step, 16); else { me.tallyDone(); setTimeout(res, RM() ? 300 : 900); } };
        setTimeout(step, 16);
      });
    },

    /* ----- END sheet: the count, the code, COPY CODE, one shop link, PLAY AGAIN ----- */
    showEnd(r) {
      me.setPhase('end'); fin.classList.remove('is-solo'); fin.classList.add('is-up');
      const code = r.code || 'XXXX-XXXX', stars = clamp(r.stars | 0, 0, 3);
      const sh = me._sheet('rk-end', `<div class="rk-sheet__head"><div class="rk-display rk-sheet__h">${COPY.endHead(r.total)}</div></div>
        <div class="rk-coupon rk-coupon--open is-reveal"><div class="rk-coupon__txt"><div class="rk-label rk-coupon__k">${COPY.endCodeLabel}</div><div class="rk-num rk-coupon__code rk-cap">${code}</div><div class="rk-coupon__rule"></div><div class="rk-coupon__note">${r.sample === false ? (r.terms || '') : COPY.sample}</div></div></div>
        <button class="rk-btn rk-btn--primary" data-a="copy">${label(COPY.copyCode)}</button>
        <a class="rk-btn rk-btn--secondary" data-a="shop" href="${r.shopUrl || '#'}" target="_blank" rel="noopener">${label(COPY.shop)}</a>
        <div class="rk-sheet__foot"><button class="rk-btn rk-btn--ghost" data-a="again">${label(COPY.playAgain)}</button></div>`);
      const cb = sh.querySelector('[data-a=copy]');
      let tm = 0;
      cb.addEventListener('click', async () => { const ok = await copyText(code); o.track('code_copy', { ok }); cb.classList.add('is-done'); cb.innerHTML = `${glyph('check')}${label(COPY.copied)}`; clearTimeout(tm); tm = setTimeout(() => { cb.classList.remove('is-done'); cb.innerHTML = label(COPY.copyCode); }, 2600); });
      sh.querySelector('[data-a=shop]').addEventListener('click', () => o.track('shop_click', { from: 'end' }));
      sh.querySelector('[data-a=again]').addEventListener('click', () => { o.track('play_again', { from: 'end' }); me.closeSheets(); (o.onPlayAgain || (() => {}))(); });
      return sh;
    },

    /* ----- FAIL sheet: keep them in ----- */
    showFail(r) {
      me.setPhase('fail'); fin.classList.add('rk-hide');
      const TT = r.target || T, cp = r.checkpoint;
      const sh = me._sheet('rk-fail', `<div class="rk-sheet__head"><div class="rk-display rk-sheet__h">${COPY.soClose}: <b>${r.total}</b> / ${TT}</div></div>
        <div class="rk-fail__bar"></div><div class="rk-fail__more">${COPY.failMore(Math.max(1, TT - r.total))}</div>
        <button class="rk-btn rk-btn--primary rk-btn--big" data-a="retry">${label(COPY.tryAgain)}</button>
        <div class="rk-sheet__foot"><a class="rk-btn rk-btn--ghost" data-a="shop" href="${r.shopUrl || '#'}" target="_blank" rel="noopener">${label(COPY.shop)}</a></div>`);
      const b = makeBar({ target: TT, barMax: r.barMax || o.barMax, stars: [] }); sh.querySelector('.rk-fail__bar').replaceWith(b.el); b.el.classList.add('rk-fail__bar'); b.instant(true); b.set(0, 0);
      setTimeout(() => { b.instant(false); b.set(r.protected ?? r.total, r.total); }, RM() ? 0 : 380);
      sh.querySelector('[data-a=retry]').addEventListener('click', () => { o.track('play_again', { from: 'fail', checkpoint: cp ? cp.n : 0 }); me.closeSheets(); (o.onRetry || o.onPlayAgain || (() => {}))(cp ? cp.n : 0); });
      sh.querySelector('[data-a=shop]').addEventListener('click', () => o.track('shop_click', { from: 'fail' }));
      return sh;
    },

    /* ----- OPTIONS sheet (internal: only when mounted with options: true or the page has ?options=1) ----- */
    showOptions(cur = {}) {
      const v = Object.assign({ sound: !me.muted, quality: 'auto', pace: 'normal' }, cur);
      const seg = (k, opts) => `<div class="rk-seg" role="group" data-k="${k}">${opts.map(([val, lab]) => `<button data-v="${val}" aria-pressed="${String(v[k]) === String(val)}">${lab}</button>`).join('')}</div>`;
      const sh = me._sheet('rk-opt', `<button class="rk-iconbtn rk-sheet__x" data-a="x" aria-label="${COPY.closeLabel}">${glyph('close')}</button><div class="rk-sheet__head"><div class="rk-display rk-sheet__h">${COPY.options}</div></div>
        <div class="rk-opt__row"><span class="rk-opt__l">${COPY.sound}</span>${seg('sound', [[true, COPY.on], [false, COPY.off]])}</div>
        <div class="rk-opt__row"><span class="rk-opt__l">${COPY.quality}</span>${seg('quality', [['auto', COPY.auto], ['low', COPY.low], ['high', COPY.high]])}</div>
        <div class="rk-opt__row"><span class="rk-opt__l">${COPY.pace}</span>${seg('pace', [['relaxed', COPY.relaxed], ['normal', COPY.normal]])}</div>
        <button class="rk-btn rk-btn--secondary" data-a="x">${label(COPY.done)}</button>`, { stack: true, scrim: true });
      sh.querySelectorAll('.rk-seg').forEach(g => g.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; g.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); const k = g.dataset.k, val = b.dataset.v === 'true' ? true : b.dataset.v === 'false' ? false : b.dataset.v; if (k === 'sound') me.setMuted(!val); if (o.onOption) o.onOption(k, val); }));
      sh.querySelectorAll('[data-a=x]').forEach(b => b.addEventListener('click', () => me._closeTop()));
      return sh;
    },

    _sheet(cls, html, f = {}) {
      if (!f.stack) me.closeSheets(true);
      const sh = h('div', 'rk-sheet ' + cls); sh.innerHTML = `<div class="rk-sheet__in">${html}</div>`;
      if (f.stack) sh.dataset.stack = '1';
      sheets.appendChild(sh); if (f.scrim) scrim.classList.add('is-on');
      void sh.offsetWidth; sh.classList.add('is-in');
      return sh;
    },
    _closeTop() { const all = [...sheets.children], t = all[all.length - 1]; if (!t) return; t.classList.remove('is-in'); if (t.dataset.stack) scrim.classList.remove('is-on'); setTimeout(() => t.remove(), 520); },
    closeSheets(now) { scrim.classList.remove('is-on'); for (const t of [...sheets.children]) { if (now) t.remove(); else { t.classList.remove('is-in'); setTimeout(() => t.remove(), 520); } } fin.classList.add('rk-hide'); },

    reset() { me._laneClear(); me.hint(false); me.closeSheets(true); dim.classList.remove('is-on'); pop.classList.add('rk-hide'); pop.innerHTML = ''; scr.innerHTML = ''; fin.classList.add('rk-hide'); me.state = {}; },
    destroy() { me.reset(); stage.remove(); const i = INST.indexOf(me); if (i >= 0) INST.splice(i, 1); if (CUR === me) CUR = INST[INST.length - 1] || null; }
  };
  bSound.addEventListener('click', () => me.setMuted(!me.muted));
  if (bOpt) bOpt.addEventListener('click', () => me.showOptions());
  me.setMuted(me.muted, true);
  me.setPhase('idle');
  INST.push(me); CUR = me;
  return me;
}

/* ---------- module-level API on the current instance ---------- */
const cur = () => { if (!CUR) throw new Error('mountHud(el) first'); return CUR; };
export const update = s => cur().update(s);
export const showPopup = (g, c, f) => cur().showPopup(g, c, f);
export const hidePopup = () => cur().hidePopup();
export const cardRects = () => cur().cardRects();
export const callout = (k, v, x) => cur().callout(k, v, x);
export const hint = (on, ms, opt) => cur().hint(on, ms, opt);
export const stick = st => cur().stick(st);
export const markers = l => cur().markers(l);
export const showStart = f => cur().showStart(f);
export const showEnd = r => cur().showEnd(r);
export const showFail = r => cur().showFail(r);
export const showFinale = r => cur().showFinale(r);
export const showBuild = (n, g) => cur().showBuild(n, g);
export const showLoading = p => cur().showLoading(p);
export const hideLoading = () => cur().hideLoading();
export const showOptions = v => cur().showOptions(v);
export const setPhase = p => cur().setPhase(p);
