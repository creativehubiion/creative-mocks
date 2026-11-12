/* */
/* Choose your build: copy of the stack core. Changes: track() is exported; G.meta.startHtml replaces the start block; an element #tc-ub (the game's unlock bar) is placed under the brand bar; G.sheetHtml(st) builds the end sheet and a #rt-retry button calls G.retry() and resumes play; a fail with st.reveal (arrived below the target) gets the staged reveal too, held while G.revealWait() is true; the sims retry from a checkpoint (?retries=1) and count first-attempt wins and wins within the retries separately; the sims take ?bots= (perfect, first, random) and also report the world clock and the game's own per-round stats (st.stats); the end sheet takes G.meta.shopLabel and shows st.sheetExtra on a fail too.
   Stack it, keep it: copy of the drive-A core. Changes: the sims also report gear kept, peak body swerve and points per bot (st.gear, st.swerve, st.points).
   Copy of _core/rt-core.js for the drive variants. One change: frame() passes draw() the interpolation fraction (acc * 60, 0..1 of a fixed step) and the real frame time, so the renderer can interpolate between the last two fixed steps instead of showing 0 or 2 steps per frame on 90/120 Hz screens.
   realtruck-01 greybox core: a hosted, full-window game (D-047). Portrait on phones (Meta in-app browsers first), landscape on desktop.
   A game module supplies: meta, layers, CONFIG, reset(seed), update(dt, input), status(), draw(ctx, W, H, t, mode), bot(kind, dt), hint(), geometry().
   The core owns: the canvas and resize, the fixed-step loop, input (touch, mouse, keyboard), attract mode (the game plays itself under the
   hint until the first action, D-041), the HUD bar in RealTruck's chrome, the ghost hand, callouts, the code-unlock sheet, sims and the
   layer contract (?geometry, ?blueprint=Lx, ?explained). Greyboxes are silent (greybox rule 43 addendum). */
window.RT = (function () {
  const Q = new URLSearchParams(location.search);
  const DPR = Math.min(1.5, window.devicePixelRatio || 1);
  const BRAND = { black: '#000000', yellow: '#FFC600', white: '#FFFFFF', grey: '#F0F0F0', ink: '#141414' };
  const SHOP = 'https://realtruck.com.au/?utm_source=meta&utm_medium=paid_social&utm_campaign=black_friday_game';
  let G, cv, ctx, W = 0, H = 0, mode = 'attract', modeT = 0, lastAction = 0, playT = 0, attractEnd = 0, sheetShown = false, hudKey = '';
  const input = { tap: false, hold: false, swipe: 0, steer: 0 };
  let holdDown = false, swipeStart = null, keyL = false, keyR = false;

  function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const gauss = r => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  const CSS = `
  html,body{margin:0;height:100%;overflow:hidden;background:#111;overscroll-behavior:none;-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent}
  #rt-cv{position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;touch-action:none;display:block}
  .rt{font-family:Roboto,system-ui,sans-serif;color:#fff}
  #rt-bar{position:fixed;left:0;right:0;top:0;display:flex;flex-wrap:nowrap;align-items:center;gap:10px;padding:calc(env(safe-area-inset-top) + 8px) 14px 8px;background:#000;border-bottom:3px solid ${BRAND.yellow};z-index:5;pointer-events:none}
  #rt-logo{flex:0 0 auto;width:clamp(84px,24vw,118px);height:24px;border:1.5px dashed #8a8a8a;color:#9a9a9a;font:700 9px/24px Roboto,sans-serif;white-space:nowrap;overflow:hidden;text-align:center;letter-spacing:.08em}
  #rt-prog{margin-left:auto;display:flex;flex-wrap:nowrap;align-items:center;gap:clamp(3px,1vw,6px);white-space:nowrap;font:600 15px Oswald,sans-serif;letter-spacing:.04em;text-transform:uppercase}
  .pip{flex:0 0 auto;width:clamp(9px,2.4vw,14px);height:clamp(9px,2.4vw,14px);border:2px solid #777;box-sizing:border-box;background:transparent;transform:skewX(-12deg)}
  .pip.on{background:${BRAND.yellow};border-color:${BRAND.yellow}}
  .pip.lost{border-color:#d33;background:repeating-linear-gradient(45deg,#d33 0 2px,transparent 2px 5px)}
  #rt-line{position:fixed;left:0;right:0;top:46px;text-align:center;font:600 clamp(15px,2.3vw,22px)/1.2 Oswald,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:#fff;padding:8px 14px;background:linear-gradient(#000c,#0000);z-index:4;pointer-events:none;text-shadow:0 1px 2px #000}
  #rt-line b{color:${BRAND.yellow};font-weight:700}
  #rt-hand{position:fixed;width:58px;height:58px;margin:-6px 0 0 -18px;z-index:6;pointer-events:none;display:none;filter:drop-shadow(0 3px 4px #0008)}
  #rt-hand .ring{position:absolute;left:-14px;top:-14px;width:44px;height:44px;border:3px solid ${BRAND.yellow};border-radius:50%;opacity:0}
  #rt-hand.tap .ring,#rt-hand.hold .ring{animation:ring 1s infinite}
  #rt-hand.drag svg{animation:drag 1.8s infinite} #rt-hand.tap svg{animation:press 1s infinite} #rt-hand.hold svg{animation:presshold 1.6s infinite} #rt-hand.swipe svg,#rt-hand.steer svg{animation:swipe 1.4s infinite}
  @keyframes press{0%,40%,100%{transform:translate(0,0) scale(1)}55%,70%{transform:translate(2px,4px) scale(.9)}}
  @keyframes presshold{0%{transform:scale(1)}15%,85%{transform:translate(2px,4px) scale(.9)}100%{transform:scale(1)}}
  @keyframes drag{0%{transform:translate(0,0);opacity:0}10%{opacity:1;transform:translate(0,0) scale(.9)}70%{transform:translate(var(--dx,0px),var(--dy,-120px)) scale(.9);opacity:1}85%,100%{transform:translate(var(--dx,0px),var(--dy,-120px));opacity:0}}
  @keyframes ring{0%,50%{opacity:0;transform:scale(.4)}60%{opacity:1}100%{opacity:0;transform:scale(1.3)}}
  @keyframes swipe{0%{transform:translateX(-46px);opacity:0}15%{opacity:1}60%{transform:translateX(46px);opacity:1}80%,100%{transform:translateX(46px);opacity:0}}
  #rt-start{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom) + 6%);transform:translateX(-50%);z-index:5;pointer-events:none;text-align:center}
  #rt-start .k{display:inline-block;background:${BRAND.yellow};color:#000;font:700 13px Roboto,sans-serif;letter-spacing:.08em;padding:6px 10px;text-transform:uppercase}
  #rt-start .t{font:700 clamp(26px,4.6vw,46px)/1 Oswald,sans-serif;text-transform:uppercase;letter-spacing:.02em;margin-top:8px;text-shadow:0 2px 6px #000}
  #rt-start .s{font:500 14px Roboto,sans-serif;margin-top:6px;opacity:.9;text-shadow:0 1px 3px #000}
  .rt-call{position:fixed;z-index:6;pointer-events:none;transform:translate(-50%,-50%);font:700 clamp(18px,3vw,28px) Oswald,sans-serif;text-transform:uppercase;letter-spacing:.04em;white-space:nowrap;text-shadow:0 2px 4px #000;animation:call 1.25s ease-out forwards}
  .rt-call.cue{background:#000;color:${BRAND.yellow};padding:6px 12px;border-left:4px solid ${BRAND.yellow};font-size:clamp(15px,2.4vw,20px);animation:cue 2.2s ease-out forwards;text-shadow:none}
  @keyframes call{0%{opacity:0;transform:translate(-50%,-30%) scale(.7)}15%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}30%{transform:translate(-50%,-50%) scale(1)}100%{opacity:0;transform:translate(-50%,-110%)}}
  @keyframes cue{0%{opacity:0}10%,80%{opacity:1}100%{opacity:0}}
  #rt-sheet{position:fixed;z-index:8;left:50%;bottom:0;width:min(440px,100vw);transform:translate(-50%,110%);transition:transform .45s cubic-bezier(.2,.9,.25,1.08);background:#000;border-top:4px solid ${BRAND.yellow};padding:18px 20px calc(env(safe-area-inset-bottom) + 18px);box-sizing:border-box;text-align:center}
  #rt-sheet.show{transform:translate(-50%,0)}
  @media (orientation:landscape) and (min-width:760px){#rt-sheet{left:auto;right:4vw;bottom:50%;width:400px;transform:translate(0,calc(50% + 100vh));border:0;border-left:4px solid ${BRAND.yellow}}#rt-sheet.show{transform:translate(0,50%)}}
  #rt-sheet .logo{margin:0 auto 10px;width:150px;height:28px;border:1.5px dashed #8a8a8a;color:#9a9a9a;font:700 10px/28px Roboto,sans-serif;letter-spacing:.08em}
  #rt-sheet .stamp{font:700 clamp(34px,6vw,46px)/1 Oswald,sans-serif;text-transform:uppercase;color:${BRAND.yellow};letter-spacing:.02em}
  #rt-sheet .res{font:500 15px Roboto,sans-serif;margin:6px 0 14px;color:#ddd}
  .coupon{position:relative;margin:0 auto 14px;padding:14px 18px;background:${BRAND.yellow};color:#000;-webkit-mask:radial-gradient(circle 11px at 0 50%,#0000 98%,#000) left/51% 100% no-repeat,radial-gradient(circle 11px at 100% 50%,#0000 98%,#000) right/51% 100% no-repeat;mask:radial-gradient(circle 11px at 0 50%,#0000 98%,#000) left/51% 100% no-repeat,radial-gradient(circle 11px at 100% 50%,#0000 98%,#000) right/51% 100% no-repeat}
  .coupon .k{font:700 12px Roboto,sans-serif;letter-spacing:.12em;text-transform:uppercase}
  .coupon .code{font:700 34px/1.1 Oswald,sans-serif;letter-spacing:.12em;margin:4px 0;border-top:2px dashed #0006;border-bottom:2px dashed #0006;padding:4px 0}
  .coupon.locked{background:#2a2a2a;color:#aaa}.coupon.locked .code{border-color:#fff3}
  .coupon .f{font:500 11px Roboto,sans-serif;opacity:.75}
  .rt-btn{display:block;width:100%;border:0;margin:8px 0 0;padding:15px 10px;font:700 17px Roboto,sans-serif;text-transform:uppercase;letter-spacing:.04em;cursor:pointer;border-radius:0}
  .rt-btn.p{background:${BRAND.yellow};color:#000}.rt-btn.s{background:transparent;color:#fff;border:2px solid #fff}
  .rt-btn.l{background:none;color:#bbb;font-size:14px;text-decoration:underline;padding:10px}
  #rt-sim{position:fixed;inset:0;z-index:20;background:#111;color:#e8e8e8;font:13px/1.45 ui-monospace,Consolas,monospace;padding:16px;white-space:pre-wrap;overflow:auto}
  `;

  function el(tag, attrs, html) { const e = document.createElement(tag); Object.assign(e, attrs || {}); if (html != null) e.innerHTML = html; return e; }
  const HAND = '<svg viewBox="0 0 64 64" width="58" height="58"><path d="M24 30V10a5 5 0 0 1 10 0v16l2-.4V22a5 5 0 0 1 10 0v4.5l1-.2a5 5 0 0 1 9 3V42c0 9-7 17-16 17h-4c-6 0-10-3-13-8L14 41a5 5 0 0 1 8-6z" fill="#fff" stroke="#000" stroke-width="3" stroke-linejoin="round"/></svg>';

  function buildDom() {
    document.head.appendChild(el('style', {}, CSS));
    /* release: no external fonts (Oswald is local in ui/fonts.css; body text uses the system sans) */
    /* meta.renderer 'three': the game owns the canvas (G.init makes its WebGL renderer, G.resize sizes it, G.draw renders); the core keeps the input and the chrome */
    cv = document.getElementById('rt-cv') || el('canvas', { id: 'rt-cv' }); if (!cv.parentNode) document.body.appendChild(cv);
    if (G.meta.renderer === 'three') { ctx = null; G.init(cv, DPR); } else ctx = cv.getContext('2d');
    const bar = el('div', { id: 'rt-bar', className: 'rt' }, `<div id="rt-logo">REALTRUCK LOGO</div><div id="rt-prog"></div>`);
    document.body.appendChild(bar);
    document.body.appendChild(el('div', { id: 'rt-line', className: 'rt' }, G.meta.line));
    document.body.appendChild(el('div', { id: 'rt-hand', className: G.meta.control }, '<div class="ring"></div>' + HAND));
    document.body.appendChild(el('div', { id: 'rt-start', className: 'rt' }, G.meta.startHtml || `<div class="k">Black Friday</div><div class="t">${G.meta.startLine}</div><div class="s">${G.meta.startSub}</div>`));
    document.body.appendChild(el('div', { id: 'rt-sheet', className: 'rt' }));
    addEventListener('resize', resize); if (window.visualViewport) visualViewport.addEventListener('resize', resize);
    resize();
  }
  function resize() { W = innerWidth; H = innerHeight; if (ctx) { cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); } else G.resize(W, H, DPR); placeLine(); if (sheetShown) measureSheet(); }
  /* the instruction sits under the bar, measured only when the bar changes (no layout reads in the frame, greybox rule 38) */
  let lineTop = 90;
  function placeLine() { const b = document.getElementById('rt-bar'), l = document.getElementById('rt-line'), u = document.getElementById('tc-ub'); if (!b || !l) return; let y = b.offsetHeight; if (u) { u.style.top = y + 'px'; y += u.offsetHeight; } l.style.top = y + 'px'; lineTop = y + l.offsetHeight; }
  /* the payoff stays visible (greybox rule 15): while the sheet is up, the game's camera fits the space the sheet leaves */
  const inset = { r: 0, b: 0 }, insetGoal = { r: 0, b: 0 };
  function measureSheet() { const s = document.getElementById('rt-sheet'), side = matchMedia('(orientation:landscape) and (min-width:760px)').matches; insetGoal.r = side ? s.offsetWidth + W * 0.04 + 12 : 0; insetGoal.b = side ? 0 : s.offsetHeight + 8; }
  const hudTop = () => lineTop;

  /* input: the first action in attract starts a fresh round and is not applied (the world is already running under it) */
  function action(kind, v) {
    if (mode === 'end') return;
    lastAction = playT;
    if (mode === 'attract') { startPlay(); return; }
    if (mode !== 'play') return;
    if (kind === 'tap') input.tap = true; else if (kind === 'swipe') input.swipe = v; else if (kind === 'hold') input.hold = v;
  }
  function bindInput() {
    cv.addEventListener('pointerdown', e => {
      e.preventDefault(); holdDown = true;
      /* steer: the first touch starts the round and already holds the wheel (G.pointer gets the down), so a drag that starts the game steers at once */
      if (G.meta.control === 'steer') { if (mode === 'attract' && !G.meta.kitStart) action('start'); if (mode === 'play' && !G.botKind) { lastAction = playT; G.pointer('down', e.clientX, e.clientY); } return; }
      if (G.meta.control === 'drag') { if (mode === 'attract') { action('start'); return; } if (mode === 'play' && !G.botKind) { lastAction = playT; G.pointer('down', e.clientX, e.clientY); } return; }
      if (G.meta.control === 'swipe') { swipeStart = { x: e.clientX, y: e.clientY, used: false }; if (mode === 'attract' && !G.meta.kitStart) action('start'); return; }
      if (G.meta.control === 'hold') { if (mode === 'attract') { action('start'); input.hold = true; return; } action('hold', true); return; }
      action('tap');
    }, { passive: false });
    cv.addEventListener('pointermove', e => {
      if (G.meta.control === 'drag' || G.meta.control === 'steer') { if (mode === 'play' && !G.botKind && holdDown) { lastAction = playT; G.pointer('move', e.clientX, e.clientY); } return; }
      if (G.meta.control !== 'swipe' || !swipeStart || swipeStart.used) return;
      const dx = e.clientX - swipeStart.x; if (Math.abs(dx) > 28) { swipeStart.used = true; action('swipe', Math.sign(dx)); }
    });
    const up = e => {
      if ((G.meta.control === 'drag' || G.meta.control === 'steer') && holdDown && mode === 'play' && !G.botKind) G.pointer('up', e.clientX, e.clientY);
      holdDown = false;
      if (G.meta.control === 'hold') action('hold', false);
      if (G.meta.control === 'swipe' && swipeStart && !swipeStart.used && mode === 'play') action('swipe', e.clientX < W / 2 ? -1 : 1);
      swipeStart = null;
    };
    addEventListener('pointerup', up); addEventListener('pointercancel', up);
    addEventListener('keydown', e => {
      if (e.repeat && G.meta.control !== 'hold') return;
      const k = e.key;
      if (G.meta.control === 'steer' && /^(ArrowLeft|ArrowRight|a|d|A|D)$/.test(k)) { e.preventDefault(); if (mode === 'attract' && !G.meta.kitStart) action('start'); if (/^(ArrowLeft|a|A)$/.test(k)) keyL = true; else keyR = true; input.steer = (keyR ? 1 : 0) - (keyL ? 1 : 0); lastAction = playT; }
      else if (G.meta.control === 'swipe' && /^(ArrowLeft|ArrowRight|a|d|A|D)$/.test(k)) { e.preventDefault(); if (mode === 'attract' && !G.meta.kitStart) action('start'); else action('swipe', /^(ArrowLeft|a|A)$/.test(k) ? -1 : 1); }
      else if (G.meta.control === 'hold' && /^( |ArrowRight|ArrowUp)$/.test(k)) { e.preventDefault(); if (e.repeat) return; if (mode === 'attract') { action('start'); input.hold = true; } else action('hold', true); }
      else if (G.meta.control === 'tap' && /^( |Enter|ArrowDown)$/.test(k)) { e.preventDefault(); action('tap'); }
    });
    addEventListener('keyup', e => {
      if (G.meta.control === 'hold' && /^( |ArrowRight|ArrowUp)$/.test(e.key)) action('hold', false);
      if (G.meta.control === 'steer' && /^(ArrowLeft|ArrowRight|a|d|A|D)$/.test(e.key)) { if (/^(ArrowLeft|a|A)$/.test(e.key)) keyL = false; else keyR = false; input.steer = (keyR ? 1 : 0) - (keyL ? 1 : 0); }
    });
    addEventListener('blur', () => { keyL = keyR = false; input.steer = 0; });
    document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
  }

  let seedN = 1;
  function startPlay() {
    mode = 'play'; modeT = 0; playT = 0; lastAction = 0; sheetShown = false; insetGoal.r = insetGoal.b = 0; Object.assign(input, { tap: false, hold: false, swipe: 0 });
    G.reset(Q.has('seed') ? +Q.get('seed') : (Date.now() & 0xffff)); G.botKind = null; cueSeen.clear();
    document.getElementById('rt-start').style.display = 'none';
    const s = document.getElementById('rt-sheet'); s.classList.remove('show');
    track('game_start');
  }
  function startAttract() { mode = 'attract'; modeT = 0; G.reset(seedN++); G.botKind = 'first'; document.getElementById('rt-start').style.display = ''; }

  /* callouts: big words over the action, and one-time cues (greybox rule 8: once, in the moment it matters) */
  const cueSeen = new Set();
  function call(text, x, y, color) { if (SIM) return; const c = el('div', { className: 'rt-call rt' }, text); c.style.left = x + 'px'; c.style.top = y + 'px'; c.style.color = color || '#fff'; document.body.appendChild(c); setTimeout(() => c.remove(), 1300); }
  function cue(id, text, x, y) { if (SIM || mode !== 'play' || cueSeen.has(id)) return; cueSeen.add(id); const c = el('div', { className: 'rt-call cue rt' }, text); c.style.left = x + 'px'; c.style.top = y + 'px'; document.body.appendChild(c); setTimeout(() => c.remove(), 2300); }

  function track(ev, data) { (window.dataLayer = window.dataLayer || []).push({ event: 'rt_' + ev, game: G.meta.id, layout: G.layout, ...(data || {}) }); if (window.fbq) window.fbq('trackCustom', 'rt_' + ev, data || {}); }

  function hud(st) {
    const [done, total, lost, lostMax] = st.progress; const key = st.progress.join(',') + '|' + (st.extra || '');
    if (key === hudKey) return; hudKey = key;
    let pips = ''; for (let i = 0; i < total; i++) pips += `<div class="pip${i < done ? ' on' : ''}"></div>`;
    let miss = ''; if (lostMax) { miss = '<span style="display:flex;gap:3px;margin-left:8px;opacity:.85">' + Array.from({ length: lostMax }, (_, i) => `<div class="pip${i < lost ? ' lost' : ''}" style="width:9px;height:9px"></div>`).join('') + '</span>'; }
    document.getElementById('rt-prog').innerHTML = (st.extra ? `<span style="margin-right:8px">${st.extra}</span>` : '') + pips + miss; placeLine();
  }

  function showSheet(st) {
    if (sheetShown) return; sheetShown = true; const s = document.getElementById('rt-sheet');
    if (G.sheetHtml) { s.innerHTML = G.sheetHtml(st); track(st.done === 'win' ? 'win' : 'fail', { measure: st.measure, reason: st.reason }); }
    else if (st.done === 'win') {
      s.innerHTML = `<div class="logo">REALTRUCK LOGO</div><div class="stamp">${st.winTitle}</div><div class="res">${st.measure}</div>${st.sheetExtra || ''}
        <div class="coupon"><div class="k">Black Friday code unlocked</div><div class="code" id="rt-code">${G.CONFIG.code}</div><div class="f">Sample: the code, offer and terms come from RealTruck</div></div>
        <button class="rt-btn p" id="rt-copy">Copy code</button><button class="rt-btn s" id="rt-shop">${G.meta.shopLabel || 'Shop Black Friday'}</button><button class="rt-btn l" id="rt-again">Play again</button>`;
      track('win', { measure: st.measure });
    } else {
      s.innerHTML = `<div class="logo">REALTRUCK LOGO</div><div class="stamp" style="color:#fff">${st.reason}</div><div class="res">${st.measure}</div>${st.sheetExtra || ''}
        <div class="coupon locked"><div class="k">Black Friday code</div><div class="code">• • • • • •</div><div class="f">One more go unlocks it</div></div>
        <button class="rt-btn p" id="rt-again">Play again</button><button class="rt-btn s" id="rt-shop">Shop now</button>`;
      track('fail', { reason: st.reason });
    }
    const copy = document.getElementById('rt-copy');
    if (copy) copy.onclick = () => { const t = G.CONFIG.code; const done = () => { copy.textContent = 'Copied'; track('code_copied'); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(t).then(done, () => fallback(t, done)); else fallback(t, done); };
    const shop = document.getElementById('rt-shop'); if (shop) shop.onclick = () => { track('shop_click'); window.open(SHOP, '_blank'); };
    const again = document.getElementById('rt-again'); if (again) again.onclick = () => { track('replay'); startPlay(); };
    const retry = document.getElementById('rt-retry'); if (retry) retry.onclick = () => { track('retry_checkpoint', { from: st.cpName }); G.retry(); mode = 'play'; modeT = 0; sheetShown = false; insetGoal.r = insetGoal.b = 0; s.classList.remove('show'); };
    measureSheet(); requestAnimationFrame(() => s.classList.add('show'));
  }
  function fallback(t, done) { const a = el('textarea', { value: t }); a.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(a); a.select(); try { document.execCommand('copy'); done(); } catch (e) {} a.remove(); }

  function handHint(show) {
    const h = document.getElementById('rt-hand'); if (!show) { h.style.display = 'none'; return; }
    const p = G.hint(); if (!p) { h.style.display = 'none'; return; }
    h.style.display = 'block'; h.style.left = p.x + 'px'; h.style.top = p.y + 'px'; if (p.dx != null) { h.style.setProperty('--dx', p.dx + 'px'); h.style.setProperty('--dy', p.dy + 'px'); }
  }

  /* fixed-step loop */
  let acc = 0, last = 0, t = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - (last || now)) / 1000); last = now;
    /* QA hook: window.__pause holds the game still (the frame keeps drawing) for screenshots */
    if (!window.__pause) { acc += dt; while (acc >= 1 / 60) { step(1 / 60); acc -= 1 / 60; } }
    if (ctx) ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    G.draw(ctx, W, H, t, mode, hudTop(), acc * 60, dt);
    requestAnimationFrame(frame);
  }
  function step(dt) {
    t += dt; modeT += dt; const k = Math.min(1, dt * 5); inset.r += (insetGoal.r - inset.r) * k; inset.b += (insetGoal.b - inset.b) * k;
    const st = G.status();
    if (mode === 'attract') {
      /* meta.parked: the attract shot is the parked ute (game build); otherwise the game plays itself under the hint */
      if (!G.meta.parked) { const a = G.bot(G.botKind || 'first', dt); G.update(dt, a); }
      if (st.done) { attractEnd += dt; if (attractEnd > 1.6) { attractEnd = 0; startAttract(); } }
      handHint(true);
    } else if (mode === 'play') {
      playT += dt; if (G.meta.control === 'steer' && (holdDown || input.steer)) lastAction = playT;
      let inp = { tap: input.tap, hold: input.hold, swipe: input.swipe, steer: input.steer };
      if (G.botKind) inp = G.bot(G.botKind, dt);
      G.update(dt, inp); input.tap = false; input.swipe = 0;
      const s2 = G.status();
      if (s2.done) { mode = s2.done === 'win' || s2.reveal ? 'reveal' : 'end'; modeT = 0; handHint(false); if (mode === 'end') setTimeout(() => showSheet(G.status()), 650); }
      else handHint(!G.botKind && (playT - lastAction > (G.meta.idle || 2.6) || s2.cue));
    } else {
      G.update(dt, { tap: false, hold: false, swipe: 0 });
      if (mode === 'reveal' && modeT > (G.CONFIG.revealHold || 2.2) && !(G.revealWait && G.revealWait())) { mode = 'end'; showSheet(G.status()); }
    }
    hud(G.status());
  }

  /* sims (greybox rule 5): perfect, first-timer and spam bots; reports win rate, round time, where fails happen and the measure spread */
  let SIM = false;
  function spread(a) { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y), q = f => +b[Math.min(b.length - 1, Math.floor(b.length * f))].toFixed(1); return { min: b[0], p10: q(0.1), median: q(0.5), p90: q(0.9), max: b[b.length - 1] }; }
  function sim() {
    SIM = true; const n = +(Q.get('n') || 200), out = { game: G.meta.id, n, bots: {} };
    const kinds = (Q.get('bots') || 'perfect,first,random').split(',');
    for (const kind of kinds) {
      const maxR = +(Q.get('retries') || 1); let wins = 0, winsR = 0; const clocks = [], acc = {}, firstT = [], allT = []; const times = [], failAt = {}, measures = {}, reasons = {}, gear = [], gearWin = [], swerve = [], points = [], roll = [], pitch = []; let dead = 0;
      for (let i = 0; i < n; i++) {
        G.reset(1000 + i); let tt = 0, st, used = 0, first = null, firstTT = 0;
        while (tt < 400) { const a = G.bot(kind, 1 / 60); G.update(1 / 60, a); tt += 1 / 60; st = G.status();
          if (st.done) { if (!first) { first = { done: st.done, gear: st.gear, clock: st.clock, reason: st.reason, stats: st.stats ? Object.assign({}, st.stats) : null, measure: st.simMeasure, failAt: st.failAt, progress: st.progress.slice(), swerve: st.swerve, points: st.points, roll: st.roll, pitch: st.pitch }; firstTT = tt; }
            if (st.done === 'fail' && st.canRetry && used < maxR) { G.retry(); used++; continue; } break; } }
        if (!st.done) { dead++; continue; }
        allT.push(tt); firstT.push(firstTT); if (st.done === 'win') winsR++;
        st = first;
        if (st.clock != null) clocks.push(st.clock); if (st.stats) for (const k in st.stats) acc[k] = (acc[k] || 0) + st.stats[k];
        if (st.done === 'win') { wins++; times.push(firstTT); } else { const k = st.failAt != null ? st.failAt : st.progress[0] + '/' + st.progress[1]; failAt[k] = (failAt[k] || 0) + 1; reasons[st.reason] = (reasons[st.reason] || 0) + 1; }
        const m = st.simMeasure != null ? st.simMeasure : st.measure; measures[m] = (measures[m] || 0) + 1;
        if (st.gear != null) { gear.push(st.gear); if (st.done === 'win') gearWin.push(st.gear); } if (st.swerve != null) swerve.push(st.swerve); if (st.points != null) points.push(st.points); if (st.roll != null) roll.push(st.roll); if (st.pitch != null) pitch.push(st.pitch);
      }
      times.sort((a, b) => a - b);
      out.bots[kind] = { winPct: Math.round(100 * wins / n), winWithinRetryPct: Math.round(100 * winsR / n), firstAttemptTime: spread(firstT), totalTime: spread(allT), dead, time: times.length ? { p10: +times[Math.floor(times.length * .1)].toFixed(1), median: +times[times.length >> 1].toFixed(1), p90: +times[Math.floor(times.length * .9)].toFixed(1) } : null, failsAtProgress: failAt, failReasons: reasons, measureSpread: Object.keys(measures).length, gearKept: spread(gear), gearKeptWins: spread(gearWin), clock: spread(clocks), means: Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, +(v / n).toFixed(2)])), swerveDeg: spread(swerve), rollDeg: spread(roll), pitchDeg: spread(pitch), points: spread(points) };
    }
    window.SIM = out; console.log('SIM', JSON.stringify(out));
    document.body.appendChild(el('div', { id: 'rt-sim' }, 'SIM ' + G.meta.id + '\n' + JSON.stringify(out, null, 2)));
  }

  /* layer contract (D-015): ?geometry, ?blueprint=Lx, ?explained */
  function contract() {
    if (Q.has('geometry')) { document.body.appendChild(el('pre', { id: 'rt-sim' }, JSON.stringify({ game: G.meta.id, format: 'hosted full window, portrait + landscape', layers: G.layers.map(L => ({ id: L.id, name: L.name, type: L.type, kind: L.kind, canvas: L.canvas, key: L.key || null, notes: L.notes })), geometry: G.geometry() }, null, 2))); return true; }
    const id = Q.get('blueprint') || Q.get('explained'); if (!id) return false;
    const L = G.layers.find(l => l.id === id); if (!L) return false;
    const c = el('canvas'); c.width = L.canvas[0]; c.height = L.canvas[1]; c.style.cssText = 'max-width:100vw;max-height:100vh;display:block;margin:auto;background:#222';
    document.body.style.overflow = 'auto'; document.body.appendChild(c); const x = c.getContext('2d');
    if (L.type !== 'plate' && L.type !== 'tile') { x.fillStyle = L.key || '#4A5A7A'; x.fillRect(0, 0, c.width, c.height); }
    L.shape(x, c.width, c.height);
    if (Q.has('explained')) { x.font = '700 30px Arial'; x.fillStyle = '#FFC600'; x.fillText(`${L.id} ${L.name} · ${L.kind} · ${L.canvas.join('x')}`, 24, 44); x.font = '24px Arial'; x.fillStyle = '#fff'; wrap(x, L.notes, 24, 84, c.width - 48, 30); }
    return true;
  }
  function wrap(x, txt, X, Y, w, lh) { let line = ''; for (const word of String(txt).split(' ')) { const t = line ? line + ' ' + word : word; if (x.measureText(t).width > w) { x.fillText(line, X, Y); Y += lh; line = word; } else line = t; } x.fillText(line, X, Y); }

  function run(game) {
    G = game; window.GAME = G;
    if (Q.has('sim')) { document.body.style.background = '#111'; sim(); return; }
    if (contract()) return;
    buildDom();
    const go = () => {
      bindInput(); const ld = document.getElementById('tc-load'); if (ld) ld.remove();
      if (Q.has('bot')) { startPlay(); G.botKind = Q.get('bot') || 'perfect'; } else startAttract();
      requestAnimationFrame(frame);
    };
    if (G.load) G.load().then(go, e => { console.error(e); const ld = document.getElementById('tc-load'); if (ld) ld.textContent = 'Could not load: ' + (e && e.message || e); });
    else go();
  }
  return { startPlay, retry: () => { G.retry(); mode = 'play'; modeT = 0; sheetShown = false; insetGoal.r = insetGoal.b = 0; const sh = document.getElementById('rt-sheet'); if (sh) sh.classList.remove('show'); }, run, rng, gauss, call, cue, track, BRAND, Q, inset, get W() { return W; }, get H() { return H; }, get mode() { return mode; }, get sim() { return SIM; } };
})();
