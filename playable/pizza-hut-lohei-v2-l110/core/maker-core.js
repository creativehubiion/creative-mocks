/* BUILD (05-build): the greybox core with the pack's art, the festive HUD, the reward cards, lighting and sound; ?noart = greybox shapes.
   Top Your Lohei Pizza — greybox core (pizzahut-01, second playable, owner 2026-11-02 20:39: the pizza-maker genre in our own design).
   The rule: the Lohei Pizza spins on a turntable, cut in four quarters. The order ticket calls each topping in turn (plum sauce, chicken,
   capsicum + pineapple, mozzarella, then the three toss toppings). Tap where it should go: the topping flies there from the tray (~0.35 s),
   so you lead the spin. A quarter that already has this topping bounces it off (-2 s). Fill all five orders before the clock runs out.
   The spin speeds up mid-game and eases at the end (all.md 19:26: the end is the easiest part). Greyboxes are silent.
   Hooks: ?attract · ?bot · ?sim (n=) · ?sim&human · ?geometry · ?blueprint=Lx · ?explained=Lx · ?card=win|fail · ?cfg={json}
   window.GAME = { S, CONFIG, drop, reset } */
(function () {
  const Q = new URLSearchParams(location.search), has = k => Q.has(k);
  const C = {
    title: 'Top your Lohei Pizza', kicker: 'Chinese New Year 2027', reward: 'Finish the pizza to unlock a CNY treat', play: 'Play',
    steps: [['Plum sauce', 'sauce'], ['Chicken', 'chicken'], ['Capsicum & pineapple', 'veg'], ['Mozzarella', 'cheese'], ['Crackers, peel & crunch', 'toss']],
    order: 'Order {n} of 5', tapHint: 'Tap just ahead of a glowing slice', done: 'Already has it! Tap a glowing slice', next: 'Next: {t}', last: 'Last one: {t}!', first: 'Tap the glowing slices!', nice: ['Nice!', 'Great!', 'Lucky!'], stepDone: 'Done!',
    winStamp: 'PIZZA READY!', failStamp: "TIME'S UP!", winLine: 'Your CNY treat is unlocked', failLine: 'So close! Your treat is one pizza away',
    claim: 'Claim my treat', rewardKick: 'Win a CNY treat!', rewardLine: 'Finish the pizza to unlock it', ticketKick: 'CNY treat unlocked!', ticketLine: 'Claim it with your Lohei Pizza order', lockedKick: 'So close!', lockedLine: 'Your CNY treat is one pizza away', fortune: 'Your Lohei Pizza is ready for a lucky 2027', failFortune: 'Almost there: one more try', item: '\u2018Lohei\u2019 Pizza', prodKick: 'New this Chinese New Year', addsKick: 'Pour on and toss', adds: ['Pok Cui crackers', 'Lime strip peel', 'Crispy cereal crunch'], shareText: 'I made a Lohei Pizza in {s} seconds. Your turn!', makeAnother: 'Make another', stamp: 'PROSPER!', share: 'Share', again: 'Play again', order2: 'Order now', logo: 'Pizza Hut logo',
  };
  const CONFIG = {
    time: 27,                                  // seconds on the clock at the start (each order done gives some back)
    spin: [0.8, 1.15, 1.4, 1.6, 1.8],          // rad/s per order: it keeps building to a finale (owner 20:57: the slowdown read as a let-down)
    flight: 0.35,                              // seconds from the tray to the pizza: the lead
    penalty: 0,                                // owner 20:51: no time taken for a bounce (the wasted tap is the cost)
    refill: 1.0,                               // seconds before the next topping after a bounce (the cost of a miss, no clock jump)
    bonus: 2,                                  // seconds back for each order done
    quarters: 6, assist: true,                 // the first drop of a game lands where it was aimed (rig the first move)
    ctaUrl: 'https://www.pizzahut.com.sg/',
  };
  let CFG_Q = {}; if (Q.get('cfg')) try { CFG_Q = JSON.parse(Q.get('cfg')); } catch (e) {}
  const BOT = has('bot') || has('attract'), HUMAN = has('human'), SPAM = has('spam'), SIM = has('sim'), ATTRACT = has('attract');   // ?spam: taps anywhere as fast as the tray allows (the mechanic must matter)
  const W = 640, H = 960, TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rand = (a, b) => a + Math.random() * (b - a), ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };
  const wrap = a => ((a % TAU) + TAU) % TAU;
  const COL = { sauce: '#B23A2E', chicken: '#E8D2B0', veg: ['#D9302A', '#F2C744'], cheese: '#F6F0DC', toss: ['#E9B9A4', '#C8D86A', '#C9913F'] };
  let V, S, cv, ctx;
  const NOART = has('noart') || has('blueprint') || has('explained') || has('geometry') || has('sim'), ART = {};
  const ART_FILES = { kitchen: 'kitchen.webp', turntable: 'turntable.webp', toppings: 'toppings.webp', tray: 'tray.webp', ticket: 'ticket.webp', logo: 'logo.svg', pizza: 'pizza-dressed.webp' };
  if (!NOART) for (const [k, f] of Object.entries(ART_FILES)) { const im = new Image(); im.onload = () => { ART[k] = im; if (k === 'toppings') sheets(); }; im.src = 'assets/game/' + f; }
  function sheets() { const im = ART.toppings, mk = () => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; return c; };
    const r = mk(), g = r.getContext('2d'); g.shadowColor = 'rgba(70,25,10,.6)'; g.shadowBlur = 2; g.drawImage(im, 0, 0); ART.rim = r;
    const d = mk(), h = d.getContext('2d'); h.filter = 'blur(2px)'; h.drawImage(im, 0, 0); h.filter = 'none'; h.globalCompositeOperation = 'source-in'; h.fillStyle = '#3a1205'; h.fillRect(0, 0, d.width, d.height); ART.shadow = d; }
  const SFX = (() => {   // synthesised (SOUND-STAGE §7), one pentatonic palette, one sound per action, attract silent, measured levels
    let ac = null, muted = false; try { muted = localStorage.getItem('ph-maker-mute') === '1'; } catch (e) {}
    const ctxA = () => { if (SIM || NOART) return null; if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' }); } catch (e) { ac = null; } } if (ac && ac.state === 'suspended') ac.resume(); return ac; };
    const bus = a => { if (a.__bus) return a.__bus; const m = a.createGain(), hp = a.createBiquadFilter(), c = a.createDynamicsCompressor(); m.gain.value = 0.85; hp.type = 'highpass'; hp.frequency.value = 60; c.threshold.value = -8; c.knee.value = 4; c.ratio.value = 20; c.attack.value = 0.002; c.release.value = 0.12; m.connect(hp); hp.connect(c); c.connect(a.destination); a.__bus = m; return m; };
    function bell(a, f, t, dur, g) { [[1, 1], [2, 0.45], [3.01, 0.25], [4.23, 0.12]].forEach(([r, amp], k) => { const o = a.createOscillator(), v = a.createGain(); o.type = 'sine'; o.frequency.value = f * r; v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g * amp, t + 0.004); v.gain.exponentialRampToValueAtTime(0.0001, t + dur / (1 + k * 0.7)); o.connect(v); v.connect(bus(a)); o.start(t); o.stop(t + dur + 0.05); }); }
    function hiss(a, t, dur, g, f0, f1, q, rise) { const n = Math.max(1, Math.floor(a.sampleRate * dur)), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; const src = a.createBufferSource(), bp = a.createBiquadFilter(), v = a.createGain(); src.buffer = b; bp.type = 'bandpass'; bp.Q.value = q; bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur); const pk = t + Math.max(0.004, dur * (rise || 0.02)); v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, pk); v.gain.exponentialRampToValueAtTime(0.0001, t + dur); src.connect(bp); bp.connect(v); v.connect(bus(a)); src.start(t); src.stop(t + dur + 0.02); }
    function plop(a, f, t, g) { const o = a.createOscillator(), v = a.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f * 2.2, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.06); v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, t + 0.004); v.gain.exponentialRampToValueAtTime(0.0001, t + 0.16); o.connect(v); v.connect(bus(a)); o.start(t); o.stop(t + 0.2); }
    const P = [783.99, 880, 987.77, 1174.66, 1318.51, 1567.98];   // G major pentatonic
    const G = { tap: 0.5, land: 0.42, chime: 0.22, win: 0.15, fail: 0.21 };
    const cues = {
      tap: (a, t) => hiss(a, t, 0.22, G.tap, 600, 2600, 0.9, 0.3),                                                 // the topping leaves the tray
      land: (a, t, n) => { plop(a, 260 + 40 * n, t, G.land); bell(a, P[Math.min(5, n)], t + 0.01, 0.35, G.chime * 0.45); },   // it lands: a plop and a note up the scale
      order: (a, t) => [0, 2, 4].forEach((i, j) => bell(a, P[i] * (j === 2 ? 1 : 1), t + j * 0.08, 0.6, G.chime)),   // an order done: a three-note run
      win: (a, t) => { bell(a, 98, t, 2.4, G.win * 1.3); [0, 1, 2, 3, 4].forEach(i => bell(a, P[i], t + 0.12 + i * 0.09, 0.7, G.win)); bell(a, P[0] * 2, t + 0.6, 1.2, G.win); },
      fail: (a, t) => { bell(a, 392, t, 0.45, G.fail); bell(a, 329.63, t + 0.2, 0.7, G.fail); },
    };
    return { cues, bus, unlock: ctxA, play(name, arg) { const a = ctxA(); if (!a || muted || a.state !== 'running') return; cues[name](a, a.currentTime + 0.005, arg); },
      get muted() { return muted; }, set muted(v) { muted = v; try { localStorage.setItem('ph-maker-mute', v ? '1' : '0'); } catch (e) {} } };
  })();

  function reset(mode) {
    S = { mode, t: 0, left: CONFIG.time, step: 0, rot: 0, filled: [], pieces: [], fly: [], pops: [], misses: 0, drops: 0, assisted: false,
      phase: 'play', reveal: 0, ended: false, bot: {}, hintT: 0, touched: false, flash: 0, stepT: 0, started: false, ghost: 0, banner: { t: 0, step: 0 }, missChip: 0 };
    S.filled = CONFIG.spin.map(() => new Array(CONFIG.quarters).fill(false));
  }
  const pt = (a, r) => ({ x: V.cx + Math.cos(a) * r, y: V.cy + Math.sin(a) * r * V.k });          // a screen angle and radius → screen point
  const toPolar = (x, y) => { const dx = x - V.cx, dy = (y - V.cy) / V.k; return { a: Math.atan2(dy, dx), r: Math.hypot(dx, dy) }; };
  const quarterOf = local => Math.floor(wrap(local) / (TAU / CONFIG.quarters));

  // ── a drop: from the tray to a point on the pizza; it lands after the flight, in whichever quarter is under it then ──
  function drop(x, y, src) {
    if (S.phase !== 'play' || (S.mode !== 'play' && S.mode !== 'attract')) return;
    if (S.fly.length || S.t < (S.reload || 0)) return;   // one topping in the air; after a bounce the tray refills first
    let { a, r } = toPolar(x, y); r = clamp(r, V.R * 0.25, V.R * 0.85);
    if (CONFIG.assist && !S.assisted && S.mode === 'play' && S.step === 0 && S.drops === 0) {   // the first drop lands in the quarter it was aimed at
      S.assisted = true; const q = quarterOf(a - S.rot); a = (q + 0.5) * TAU / CONFIG.quarters + S.rot + CONFIG.spin[0] * CONFIG.flight;
    }
    S.drops++; S.touched = true; S.started = true; S.hintT = 0; if (S.mode === 'play') SFX.play('tap');
    S.fly.push({ a, r, t: 0, step: S.step, k: (Math.random() * 3) | 0, x0: V.trayX + rand(-20, 20), y0: V.trayY });
  }
  function land(f) {
    const local = f.a - S.rot, q = quarterOf(local), st = f.step;
    if (st !== S.step) return;                                   // the order moved on while it flew: it just lands as extra
    if (S.filled[st][q]) { S.left = Math.max(0, S.left - CONFIG.penalty); S.reload = S.t + CONFIG.refill; S.misses++; S.flash = CONFIG.penalty ? 0.3 : 0.15; S.missChip = 1.6; S.hintT = 99; return; }
    S.filled[st][q] = true; S.pieces.push({ local, r: f.r, step: st, k: f.k, q }); if (S.mode === 'play') SFX.play('land', S.filled[st].filter(Boolean).length - 1); pop(C.nice[Math.min(2, S.filled[st].filter(Boolean).length - 1)], f.a, f.r, '#FFD23A');
    if (S.filled[st].every(Boolean)) {
      S.step++; S.stepT = 0; S.banner = { t: 0, step: S.step }; if (S.mode === 'play' && S.step < CONFIG.spin.length) SFX.play('order'); S.hintT = 99; S.left += CONFIG.bonus; if (S.step < CONFIG.spin.length && S.mode === 'play') pop('+' + CONFIG.bonus + 's', -Math.PI / 2 + S.rot * 0, V.R * 0.1, '#7CFF6B');   // an order done gives time back: the end is never a race
      if (S.step >= CONFIG.spin.length) finish('win');
    }
  }
  function pop(txt, a, r, col) { const p = pt(a, r); S.pops.push({ txt, x: p.x, y: p.y - 30, col, t: 0 }); }
  function finish(res) {
    if (S.mode === 'attract') { setTimeout(() => S && S.mode === 'attract' && reset('attract'), 1500); S.phase = 'done'; return; }
    SFX.play(res === 'win' ? 'win' : 'fail'); S.ended = true; S.phase = 'done'; S.mode = res === 'win' ? 'reveal' : 'fail'; S.reveal = 0;
    if (!SIM) setTimeout(() => showCard(res), res === 'win' ? 1600 : 900);
  }

  function update(dt) {
    S.t += dt; S.hintT += dt; S.stepT += dt; S.flash = Math.max(0, S.flash - dt);
    if (S.mode === 'reveal') { S.reveal += dt; S.rot += 0.5 * dt; }
    if (S.phase === 'play') {
      const w = CONFIG.spin[Math.min(S.step, CONFIG.spin.length - 1)]; S.rot += w * dt;
      if (S.mode === 'play' && S.started) { S.left -= dt; if (S.left <= 0) { S.left = 0; finish('fail'); } }
    }
    S.fly.forEach(f => { f.t += dt; if (f.t >= CONFIG.flight && !f.done) { f.done = true; if (S.phase === 'play' || S.mode === 'attract') land(f); } });
    S.fly = S.fly.filter(f => !f.done);
    S.pops.forEach(p => p.t += dt); S.pops = S.pops.filter(p => p.t < 0.9); S.banner.t += dt; S.missChip = Math.max(0, S.missChip - dt);
  }

  // ── input: a tap on the pizza (or near it) ──
  function toLogical(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
  function down(e) { SFX.unlock(); if (S.mode !== 'play') return; const p = toLogical(e); const { r } = toPolar(p.x, p.y); if (r > V.R * 1.25) return; S.hintT = 0; drop(p.x, p.y, 'user'); }

  // ── bots: perfect leads the spin exactly into the middle of an empty quarter; the first-timer aims where the quarter is NOW
  //    (no lead), scatters ~0.25 rad, learns the lead from where its misses landed, waits 0.45-0.9 s between taps ──
  function autopilot() {
    if (S.phase !== 'play' || (S.mode !== 'play' && S.mode !== 'attract')) return;
    const B = S.bot; B.wait ??= SPAM ? 0 : HUMAN ? rand(1.2, 2.0) : 0.35; if (SPAM) B.wait = 0; if ((B.since = (B.since || 0) + 1 / 60) < B.wait) return; B.since = 0; B.wait = HUMAN ? rand(0.8, 1.4) : ATTRACT ? 0.55 : 0.3;   // owner 20:51: a person reads the pizza before each tap
    if (SPAM) { const a = Math.random() * TAU, r = V.R * (0.3 + Math.random() * 0.5); const p = pt(a, r); drop(p.x, p.y, 'spam'); return; }
    if (S.fly.some(f => f.step === S.step)) { if (!HUMAN) return; }
    const empty = S.filled[S.step].map((v, i) => v ? -1 : i).filter(i => i >= 0); if (!empty.length) return;
    const w = CONFIG.spin[S.step], qw = TAU / CONFIG.quarters;
    let a;
    if (HUMAN) {   // the quarter nearest the tray side (bottom of the screen), aimed where it is now plus the lead learned so far
      B.lead ??= 0; const q = empty.reduce((b, i) => { const sa = wrap((i + 0.5) * qw + S.rot); const d = Math.abs(Math.atan2(Math.sin(sa - Math.PI / 2), Math.cos(sa - Math.PI / 2))); return d < b.d ? { i, d } : b; }, { i: empty[0], d: 9 }).i;
      a = (q + 0.5) * qw + S.rot + B.lead + gauss() * 0.25; B.last = { q, aim: a, w };
    } else { const q = empty[(Math.random() * empty.length) | 0]; a = (q + 0.5) * qw + S.rot + w * CONFIG.flight; }
    const p = pt(a, V.R * 0.55); drop(p.x, p.y, 'bot');
  }
  function hintTarget() {
    if (S.step >= CONFIG.spin.length) return null; const empty = S.filled[S.step].map((v, i) => v ? -1 : i).filter(i => i >= 0); if (!empty.length) return null;
    const qw = TAU / CONFIG.quarters, w = CONFIG.spin[S.step], lead = w * (CONFIG.flight + 0.25);
    const q = empty.reduce((b, i) => { const sa = wrap((i + 0.5) * qw + S.rot + lead); const d = Math.abs(Math.atan2(Math.sin(sa - Math.PI / 2), Math.cos(sa - Math.PI / 2))); return d < b.d ? { i, d } : b; }, { i: empty[0], d: 9 }).i;
    return { a: (q + 0.5) * qw + S.rot + lead, q };
  }
  function learn() {   // the first-timer sees its topping land behind where it aimed and leads a bit more each time
    const B = S.bot; if (!HUMAN || !B.last) return; const want = B.last.w * CONFIG.flight; B.lead += (want - B.lead) * 0.35; B.last = null;
  }

  // ── drawing (greybox: flat shapes; the HUD and cards plain) ──
  function ell(x, y, rx, ry, fill, stroke, lw) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(.1, rx), Math.max(.1, ry), 0, 0, TAU); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); } }
  function rr(x, y, w, h, r, fill, stroke, lw) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); } }
  function text(t, x, y, size, col, o = {}) { ctx.font = `${o.weight || 800} ${size}px ${o.display ? '"Lilita One",' : ''}"Open Sans",system-ui,sans-serif`; ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle'; if (o.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = o.stroke; ctx.strokeStyle = '#3a0a0a'; ctx.strokeText(t, x, y); } ctx.fillStyle = col; ctx.fillText(t, x, y); }
  const CELL = { sauce: () => 0, chicken: () => 1, veg: k => 2 + (k % 2), cheese: () => 4, toss: k => 5 + (k % 3) }, SIZE = { sauce: 58, chicken: 30, veg: 30, cheese: 34, toss: 28 };
  let DISC = false, PZ = null;   // DISC: drawing into the flat pizza layer
  function piece(x, y, kind, k, s, noShadow) {   // one topping
    s = (s || 1) * V.ps; const c = COL[kind];
    if (ART.toppings) { const im = ART.rim || ART.toppings, cw = im.width / 4, ch = im.height / 2, i = CELL[kind](k), z = SIZE[kind] * s;
      if (ART.shadow && !noShadow) { ctx.globalAlpha *= 0.3; ctx.drawImage(ART.shadow, (i % 4) * cw, Math.floor(i / 4) * ch, cw, ch, x - z / 2 + 3, y - z / 2 + 5, z, z); ctx.globalAlpha /= 0.3; }
      const zy = kind === 'sauce' && !DISC ? z * V.k : z; ctx.drawImage(im, (i % 4) * cw, Math.floor(i / 4) * ch, cw, ch, x - z / 2, y - zy / 2, z, zy); return; }   // sauce lies flat: squashed to the counter's angle
    if (kind === 'sauce') ell(x, y, 22 * s, 22 * s * V.k, 'rgba(178,58,46,.85)');
    else if (kind === 'cheese') { for (let j = 0; j < 5; j++) ell(x + (j - 2) * 5 * s, y + ((j * 7) % 5 - 2) * 2 * s, 9 * s, 3 * s * V.k + 1, c, '#d8cfb0', 1); }
    else if (kind === 'chicken') rr(x - 8 * s, y - 6 * s * V.k, 16 * s, 12 * s * V.k, 4, c, '#b89a74', 1.2);
    else { const cc = Array.isArray(c) ? c[k % c.length] : c; rr(x - 7 * s, y - 5 * s * V.k, 14 * s, 10 * s * V.k, 3, cc, 'rgba(0,0,0,.25)', 1); }
  }
  function drawWorld() {
    if (ART.kitchen) ctx.drawImage(ART.kitchen, 0, 0, W, H); else { ctx.fillStyle = V.bg; ctx.fillRect(0, 0, W, H); }
    if (V.counter && !ART.kitchen) { ctx.fillStyle = '#B9AFA6'; ctx.fillRect(0, V.counterY, W, H - V.counterY); ctx.fillStyle = '#A39890'; ctx.fillRect(0, V.counterY, W, 10); }
    // the turntable and the pizza
    if (ART.turntable) {
      let g = ctx.createRadialGradient(V.cx + 30, V.cy + 90, 20, V.cx + 30, V.cy + 90, V.R * 1.3); g.addColorStop(0, 'rgba(60,25,5,.38)'); g.addColorStop(1, 'rgba(60,25,5,0)'); ctx.save(); ctx.translate(0, V.cy + 90); ctx.scale(1, 0.32); ctx.translate(0, -(V.cy + 90)); ctx.fillStyle = g; ctx.fillRect(V.cx - V.R * 1.6, V.cy + 90 - V.R * 1.4, V.R * 3.2, V.R * 2.8); ctx.restore();   // its shadow on the counter, cast down-right
      const tw = V.R * 2.25, th = tw * ART.turntable.height / ART.turntable.width; ctx.drawImage(ART.turntable, V.cx - tw / 2, V.cy - th * 0.41, tw, th);
      const r = V.R * 0.9;   // the dough: the crust's side, the rim, the base, a few baked spots that turn with it
      ell(V.cx + 4, V.cy + 9, r * 1.02, r * V.k * 1.04, 'rgba(70,35,10,.35)'); ell(V.cx, V.cy + 6, r, r * V.k, '#B87A38'); ell(V.cx, V.cy, r, r * V.k, '#D9A35A');
      g = ctx.createRadialGradient(V.cx - r * 0.3, V.cy - r * V.k * 0.4, 10, V.cx, V.cy, r); g.addColorStop(0, '#F8E4BC'); g.addColorStop(1, '#EBC98E'); ell(V.cx, V.cy, r * 0.88, r * 0.88 * V.k, g);
      for (let j = 0; j < 14; j++) { const sp = pt(j * 2.4 + S.rot, r * (0.2 + 0.6 * ((j * 37) % 10) / 10)); ell(sp.x, sp.y, 7, 3.5, 'rgba(190,130,60,.22)'); }
    } else {
    ell(V.cx, V.cy + 10 * V.k, V.R * 1.12, V.R * 1.12 * V.k, 'rgba(0,0,0,.12)'); ell(V.cx, V.cy, V.R * 1.1, V.R * 1.1 * V.k, '#8F857C', '#6f665e', 2);
    if (V.k < 1) ell(V.cx, V.cy + V.R * 0.05, V.R, V.R * V.k, '#C6A06A');
    ell(V.cx, V.cy, V.R, V.R * V.k, '#E2C08A', '#B8925A', 3); ell(V.cx, V.cy, V.R * 0.86, V.R * 0.86 * V.k, '#EED9B0'); }
    // the quarters: lines that turn with the pizza; the current order's filled quarters tinted
    const qw = TAU / CONFIG.quarters, st = Math.min(S.step, CONFIG.spin.length - 1);
    for (let q = 0; q < CONFIG.quarters; q++) {
      const a0 = q * qw + S.rot; if (S.phase === 'play' && S.filled[st][q]) { ctx.beginPath(); ctx.moveTo(V.cx, V.cy); for (let j = 0; j <= 12; j++) { const p = pt(a0 + qw * j / 12, V.R * 0.86); ctx.lineTo(p.x, p.y); } ctx.closePath(); ctx.fillStyle = 'rgba(120,200,90,.22)'; ctx.fill(); }
      if (S.phase === 'play' && S.step < CONFIG.spin.length && !S.filled[st][q]) { ctx.save(); ctx.beginPath(); ctx.moveTo(V.cx, V.cy); for (let j = 0; j <= 12; j++) { const p2 = pt(a0 + qw * j / 12, V.R * 0.84); ctx.lineTo(p2.x, p2.y); } ctx.closePath(); ctx.fillStyle = `rgba(255,210,58,${0.12 + 0.1 * Math.sin(S.t * 6)})`; ctx.fill(); ctx.strokeStyle = 'rgba(255,190,30,.9)'; ctx.lineWidth = 3; ctx.setLineDash([10, 7]); ctx.stroke(); ctx.restore(); }
      if (S.phase === 'play' && S.filled[st][q]) { const c = pt(a0 + qw / 2, V.R * 0.62); ell(c.x, c.y, 13, 13 * V.k + 2, '#5BB04A'); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(c.x - 6, c.y); ctx.lineTo(c.x - 1, c.y + 5 * V.k); ctx.lineTo(c.x + 7, c.y - 5 * V.k); ctx.stroke(); }
      const e = pt(a0, V.R * 0.86); ctx.strokeStyle = 'rgba(120,90,50,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(V.cx, V.cy); ctx.lineTo(e.x, e.y); ctx.stroke();
    }
    // the spin arrows on the turntable rim: which way it turns
    for (const base of [0, Math.PI]) { const a0 = base + S.t * 0.15 - 0.5, a1 = a0 + 0.9; ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); for (let j = 0; j <= 16; j++) { const p2 = pt(a0 + (a1 - a0) * j / 16, V.R * 1.05); j ? ctx.lineTo(p2.x, p2.y) : ctx.moveTo(p2.x, p2.y); } ctx.stroke();
      const h = pt(a1, V.R * 1.05), hb1 = pt(a1 - 0.12, V.R * 0.98), hb2 = pt(a1 - 0.12, V.R * 1.12); ctx.beginPath(); ctx.moveTo(hb1.x, hb1.y); ctx.lineTo(h.x, h.y); ctx.lineTo(hb2.x, hb2.y); ctx.stroke(); ctx.lineCap = 'butt'; }
    // the toppings already on, in order
    if (ART.toppings) {   // a flat, top-down pizza layer that turns as one, drawn squashed to the counter's angle: every topping stays where it landed
      const sc = 2, n = Math.ceil(V.R * 2 * sc); if (!PZ) { PZ = document.createElement('canvas'); PZ.width = PZ.height = n; }
      const g = PZ.getContext('2d'), o = ctx; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, n, n); g.setTransform(sc, 0, 0, sc, n / 2, n / 2); g.rotate(S.rot); ctx = g; DISC = true;
      S.pieces.slice().sort((a, b) => a.step - b.step).forEach(p => { ctx.save(); ctx.translate(Math.cos(p.local) * p.r, Math.sin(p.local) * p.r); ctx.rotate(((p.q * 7 + p.k * 3 + p.step * 5) % 10) / 10 * TAU); ctx.globalAlpha = 0.28; ctx.translate(2, 3); if (ART.shadow) { const im = ART.shadow, cw = im.width / 4, ch = im.height / 2, i = CELL[C.steps[p.step][1]](p.k), z = SIZE[C.steps[p.step][1]] * V.ps; ctx.drawImage(im, (i % 4) * cw, Math.floor(i / 4) * ch, cw, ch, -z / 2, -z / 2, z, z); } ctx.translate(-2, -3); ctx.globalAlpha = 1; piece(0, 0, C.steps[p.step][1], p.k, 1, true); ctx.restore(); });
      DISC = false; ctx = o; ctx.save(); ctx.translate(V.cx, V.cy); ctx.scale(1, V.k); ctx.drawImage(PZ, -V.R, -V.R, V.R * 2, V.R * 2); ctx.restore();
    } else S.pieces.slice().sort((a, b) => a.step - b.step || a.r - b.r).forEach(p => { const sp = pt(p.local + S.rot, p.r); piece(sp.x, sp.y, C.steps[p.step][1], p.k, p.step === 0 ? 1.6 : 1, p.step === 0); });
    if (S.mode === 'reveal' && ART.pizza) { const r = V.R * 0.9, a = clamp(S.reveal / 0.9, 0, 1); ctx.save(); ctx.globalAlpha = a; ctx.translate(V.cx, V.cy); ctx.scale(1, V.k); ctx.rotate(S.rot); ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.clip(); ctx.drawImage(ART.pizza, -r, -r, r * 2, r * 2); ctx.restore(); }   // the finished pizza: the client's photo
    // in flight: an arc from the tray
    S.fly.forEach(f => { const k = f.t / CONFIG.flight, e = pt(f.a, f.r), x = f.x0 + (e.x - f.x0) * k, y = f.y0 + (e.y - f.y0) * k - Math.sin(k * Math.PI) * 120; ell(e.x, e.y, 10 * k, 10 * k * V.k, 'rgba(0,0,0,.15)'); piece(x, y, C.steps[f.step][1], f.k, 1.2 - 0.2 * k); });
    // the tray: the current order's topping waits here
    if (ART.tray) { ell(V.trayX + 8, V.trayY + 34, 120, 14, 'rgba(60,25,5,.28)'); const tw = 230, th = tw * ART.tray.height / ART.tray.width; ctx.drawImage(ART.tray, V.trayX - tw / 2, V.trayY - th * 0.55, tw, th); } else rr(V.trayX - 90, V.trayY - 34, 180, 68, 16, '#CFC5BB', '#9C938A', 2);
    if (S.step < CONFIG.spin.length) for (let j = 0; j < 7; j++) piece(V.trayX - 54 + j * 18, V.trayY + ((j % 2) ? -6 : 6), C.steps[S.step][1], j, 1);
  }
  let BANNER = null, GRADE = null;
  function banner() { const c = document.createElement('canvas'); c.width = W * 2; c.height = 160; const g = c.getContext('2d'); g.scale(2, 2);
    const gr = g.createLinearGradient(0, 0, 0, 56); gr.addColorStop(0, '#F0302A'); gr.addColorStop(0.55, '#D40B05'); gr.addColorStop(1, '#A80000'); g.fillStyle = gr; g.fillRect(0, 0, W, 56);
    g.strokeStyle = 'rgba(255,214,110,.16)'; g.lineWidth = 1.5; for (let row = 0; row < 4; row++) for (let x = (row % 2) * 14 - 14; x < W + 28; x += 28) { const y = 8 + row * 14; g.beginPath(); g.arc(x, y, 7, Math.PI, 0); g.stroke(); g.beginPath(); g.arc(x + 14, y, 7, Math.PI, 0); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(0, 0, W, 2);
    for (let x = 0; x < W; x += 16) { g.beginPath(); g.arc(x + 8, 55, 8, 0, Math.PI); g.closePath(); g.fillStyle = '#9A0000'; g.fill(); g.strokeStyle = '#F5C542'; g.lineWidth = 2; g.beginPath(); g.arc(x + 8, 55, 8, 0, Math.PI); g.stroke(); }
    g.fillStyle = '#F5C542'; g.fillRect(0, 53, W, 3); g.fillStyle = '#FFE9A0'; g.fillRect(0, 53, W, 1); return c; }
  function grade() { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    let r = g.createRadialGradient(140, 230, 20, 140, 230, 560); r.addColorStop(0, 'rgba(255,236,200,.16)'); r.addColorStop(1, 'rgba(255,236,200,0)'); g.fillStyle = r; g.fillRect(0, 0, W, H);
    r = g.createRadialGradient(W * 0.5, H * 0.55, 260, W * 0.5, H * 0.55, 720); r.addColorStop(0, 'rgba(50,12,0,0)'); r.addColorStop(1, 'rgba(50,12,0,.45)'); g.fillStyle = r; g.fillRect(0, 0, W, H); return c; }
  function coin(x, y, r, face, rim) { ell(x, y + 2.5, r, r, 'rgba(90,0,0,.45)'); ell(x, y, r, r, rim); ell(x, y, r - 3, r - 3, face); ell(x - r * 0.3, y - r * 0.35, r * 0.42, r * 0.24, 'rgba(255,255,255,.35)'); }
  function drawHUD() {
    if (S.cardUp) return; const t = S.t;
    if (ART.kitchen) { if (!GRADE) GRADE = grade(); ctx.drawImage(GRADE, 0, 0); }
    if (!ART.logo) { rr(0, 0, W, 62, 0, 'rgba(40,14,10,.55)'); rr(16, 11, 128, 40, 8, '#F2EEEA', '#C9C1B9', 1.5); text(C.logo, 80, 31, 12, '#6E665E'); }
    else { { const g = ctx.createLinearGradient(0, 62, 0, 120); g.addColorStop(0, 'rgba(70,12,0,.3)'); g.addColorStop(1, 'rgba(70,12,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 62, W, 58); }
      if (!BANNER) BANNER = banner(); ctx.drawImage(BANNER, 0, 0, W, 80);
      const sw = (t % 5) / 0.9; if (sw < 1) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, 54); ctx.clip(); const x = -120 + sw * (W + 240), g = ctx.createLinearGradient(x - 60, 0, x + 60, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,240,200,.28)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - 60, 0, 120, 54); ctx.restore(); }
      rr(12, 9, 86, 66, 16, '#7d0000'); rr(12, 5, 86, 66, 16, '#fff', '#F5C542', 3); const lh = 54, lw = lh * ART.logo.width / ART.logo.height; ctx.drawImage(ART.logo, 55 - lw / 2, 11, lw, lh); }
    // the clock coin: seconds left; red and pulsing under 5 s
    const low = S.left < 5 && S.started && S.phase === 'play', ps = low ? 1 + 0.08 * Math.sin(t * 14) : 1; ctx.save(); ctx.translate(136, 29); ctx.scale(ps, ps); coin(0, 0, 22, low ? '#FF6B5A' : '#F7C531', low ? '#9a0000' : '#B87A00'); ctx.restore();
    text(`${Math.ceil(S.left)}`, 136, 30, 20, low ? '#fff' : '#7d0000', { display: true, weight: 400 });
    // the five orders: each order's topping in a socket; done = gold ring and a tick; current = pulsing
    for (let i = 0; i < 5; i++) { const x = 206 + i * 52, done = i < S.step, cur = i === S.step && S.phase === 'play';
      ell(x, 29, 19, 19, done ? '#FFF1C4' : cur ? 'rgba(255,241,196,.75)' : 'rgba(90,0,0,.55)', done ? '#F5C542' : cur ? '#FFE27A' : 'rgba(245,197,66,.55)', done || cur ? 3 : 1.5);
      if (cur) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 6); ell(x, 29, 23, 23, null, '#FFE27A', 2); ctx.globalAlpha = 1; }
      ctx.globalAlpha = done || cur ? 1 : 0.45; piece(x, 29, C.steps[i][1], i === 2 ? 1 : 0, 0.85, true); ctx.globalAlpha = 1;
      if (done) { ell(x + 13, 41, 7, 7, '#5BB04A', '#fff', 1.5); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 9.5, 41); ctx.lineTo(x + 12, 43.5); ctx.lineTo(x + 16.5, 38.5); ctx.stroke(); } }
    if (S.step < CONFIG.spin.length && S.phase === 'play') {   // the order ticket
      const y = V.ticketY; if (ART.ticket) { const tw = 380, th = tw * ART.ticket.height / ART.ticket.width; ctx.drawImage(ART.ticket, W / 2 - tw / 2, y - 14, tw, th); } else rr(W / 2 - 170, y, 340, 74, 12, '#fff', '#C9C1B9', 2);
      text(C.order.replace('{n}', S.step + 1).toUpperCase(), W / 2, y + 30, 12, '#9a8f86', { weight: 800 });
      text(C.steps[S.step][0], W / 2 - 50, y + 56, 21, '#2b2522'); for (let q = 0; q < CONFIG.quarters; q++) ell(W / 2 + 70 + q * 15, y + 56, 6, 6, S.filled[S.step][q] ? '#5BB04A' : '#E3DCD5', '#bdb3aa', 1);
    }
    if (S.flash) { ctx.fillStyle = `rgba(255,60,40,${S.flash * 0.5})`; ctx.fillRect(0, 0, W, H); }
  }
  function drawPops() { S.pops.forEach(p => { ctx.globalAlpha = 1 - Math.max(0, p.t - 0.5) / 0.4; text(p.txt, p.x, p.y - p.t * 40, 24, p.col, { display: true, weight: 400, stroke: 5 }); ctx.globalAlpha = 1; });
    if (S.mode === 'play' && S.phase === 'play' && !BOT) {
      const show = !S.started || S.hintT > 2.2 || S.stepT < 1.6 || S.missChip > 0, tg = hintTarget();
      if (show && tg) {   // the ghost hand: moves in, taps just ahead of the glowing slice, a ghost topping arcs from the tray into it
        const cyc = 1.5, t = (S.t % cyc) / cyc, tp = pt(tg.a, V.R * 0.55), press = t > 0.3 && t < 0.42, k = clamp((t - 0.32) / 0.45, 0, 1);
        if (k > 0 && k < 1) { const x = V.trayX + (tp.x - V.trayX) * k, y = V.trayY + (tp.y - V.trayY) * k - Math.sin(k * Math.PI) * 120; ctx.globalAlpha = 0.55; piece(x, y, C.steps[S.step][1], 0, 1.1); ctx.globalAlpha = 1; }
        if (t > 0.3 && t < 0.7) { const r = 8 + (t - 0.3) * 90; ctx.globalAlpha = 1 - (t - 0.3) / 0.4; ell(tp.x, tp.y, r, r * V.k, null, '#FFD23A', 4); ctx.globalAlpha = 1; }
        const hx = tp.x + 6, hy = tp.y + 8 + (press ? 0 : 14) + (t < 0.25 ? (0.25 - t) * 160 : 0); ctx.globalAlpha = t < 0.12 ? t / 0.12 : t > 0.85 ? (1 - t) / 0.15 : 1;
        ctx.save(); ctx.translate(hx, hy); ctx.rotate(-0.25); rr(-6, 0, 12, 40, 6, '#fff', '#2B2B2B', 3); rr(-11, 32, 42, 38, 12, '#fff', '#2B2B2B', 3); rr(5, 26, 10, 17, 5, '#fff', '#2B2B2B', 2.5); rr(14, 28, 10, 16, 5, '#fff', '#2B2B2B', 2.5); ctx.restore(); ctx.globalAlpha = 1;
      }
      const chip = S.missChip > 0 ? C.done : (!S.started ? C.first : (S.hintT > 2.2 ? C.tapHint : null));
      if (chip) { const y = V.cy + V.R * V.k + 38; ctx.font = '800 17px "Open Sans",sans-serif'; const w = ctx.measureText(chip).width + 40; rr(W / 2 - w / 2, y - 18, w, 36, 18, S.missChip > 0 ? 'rgba(206,0,0,.92)' : 'rgba(30,20,18,.78)', '#fff', 2); text(chip, W / 2, y, 17, '#fff'); }
    }
    if (S.banner.t < 1.3 && S.banner.step > 0 && S.banner.step < CONFIG.spin.length && S.mode === 'play') {   // the next order, big for a moment
      const t = S.banner.t, sc = t < 0.2 ? 0.6 + 2 * t : 1, a = t > 1 ? (1.3 - t) / 0.3 : 1; ctx.save(); ctx.globalAlpha = a; ctx.translate(W / 2, V.cy - 40); ctx.scale(sc, sc);
      text((S.banner.step === CONFIG.spin.length - 1 ? C.last : C.next).replace('{t}', C.steps[S.banner.step][0]), 0, 0, S.banner.step === CONFIG.spin.length - 1 ? 34 : 40, '#FFD23A', { display: true, weight: 400, stroke: 8 }); ctx.restore(); }
    if (S.mode === 'reveal' && !S.cardUp) { ctx.globalAlpha = clamp(S.reveal / 0.4, 0, 1) * clamp((1.5 - S.reveal) / 0.3, 0, 1); text(C.winStamp, W / 2, 230, 54, '#FFD23A', { display: true, weight: 400, stroke: 9 }); ctx.globalAlpha = 1; }
  }
  function frame() { ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0); drawWorld(); drawHUD(); drawPops(); }

  // ── cards (greybox: plain, the same buttons as the toss game's) ──
  const NOTCH = 'radial-gradient(circle 2.6cqw at 0 50%,#0000 98%,#000) left/51% 100% no-repeat,radial-gradient(circle 2.6cqw at 100% 50%,#0000 98%,#000) right/51% 100% no-repeat';
  function makeCards() {
    const st = document.createElement('style'); st.textContent = `*{box-sizing:border-box} html,body{margin:0;height:100%;background:#000;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none}
      #stage{position:absolute;inset:0;margin:auto;aspect-ratio:2/3;max-width:100%;max-height:100%;container-type:size} #stage canvas{position:absolute;inset:0;width:100%;height:100%}
      .card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;font-family:"Open Sans",sans-serif;color:#fff} .hidden{display:none!important}
      #start{justify-content:flex-end;padding:0 6cqw 9cqh;background:linear-gradient(180deg,rgba(150,0,0,0) 34%,rgba(150,0,0,.6) 58%,rgba(110,0,0,.95) 100%)}
      .logo{background:#fff;border-radius:16px;padding:1.2cqh 3.4cqw;box-shadow:0 1cqh 2.4cqh #0005;margin-bottom:2.4cqh} .logo img{height:12cqh;display:block}
      .kicker{font:800 3.6cqw "Open Sans";color:#5a2a00;background:linear-gradient(#FFE27A,#F5B700);padding:.8cqh 4cqw;border-radius:999px;margin:0 0 1.6cqh;box-shadow:0 .5cqh 0 #a86d00,0 1cqh 2cqh #0005;text-transform:uppercase;letter-spacing:.06em}
      .title{font-family:"Lilita One",sans-serif;font-size:11.5cqw;line-height:.98;text-align:center;color:#FFD23A;-webkit-text-stroke:1.6cqw #5a0000;paint-order:stroke fill;margin:0 0 4.2cqh;text-transform:uppercase;transform:rotate(-3deg);text-shadow:0 .9cqh 0 #7d0000,0 1.6cqh 2.4cqh #0006}
      .coupon{display:grid;grid-template-columns:auto 1fr;align-items:center;width:78cqw;border-radius:14px;border:2px dashed #FFE27A;background:linear-gradient(180deg,#E3140C,#B80000);-webkit-mask:${NOTCH};mask:${NOTCH};filter:drop-shadow(0 .7cqh 0 #6e0000) drop-shadow(0 1.4cqh 1.6cqh #0006)}
      .coupon .stub{padding:1.6cqh 3cqw 1.6cqh 5cqw;border-right:2px dashed #FFE27A;display:flex} .coupon svg{width:9cqw;height:9cqw;background:#fff;border-radius:50%;padding:1.3cqw}
      .coupon .ct{text-align:center;padding:1.3cqh 5cqw 1.3cqh 3cqw} .coupon b{display:block;white-space:nowrap;font:400 5.6cqw/1 "Lilita One",sans-serif;color:#FFE27A;text-shadow:0 .4cqh 0 #6e0000;text-transform:uppercase} .coupon span{display:block;font:700 3.3cqw "Open Sans";color:#fff;margin-top:.5cqh}
      #start .coupon{margin:-2.4cqh 0 3.6cqh;animation:pulse 1.6s ease-in-out infinite}
      .btn{font:700 4.6cqw "Open Sans";border:0;border-radius:8px;padding:2.2cqh 0;width:72cqw;cursor:pointer;color:#fff;background:linear-gradient(180deg,#FF4A3D 0%,#E3140C 45%,#B80000 100%);box-shadow:0 .8cqh 0 #6e0000,0 1.6cqh 2.6cqh #0006,inset 0 .4cqh 0 rgba(255,255,255,.35)}
      #play{font-size:6.2cqw;padding:2.6cqh 0;width:76cqw;border:.6cqw solid #fff;border-radius:999px;animation:pulse 1.3s ease-in-out infinite} @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}
      .btn.gold{background:linear-gradient(180deg,#FFE27A 0%,#F7C531 55%,#E0A800 100%);color:#7d0000;box-shadow:0 .8cqh 0 #A86D00,0 1.6cqh 2.6cqh #0005,inset 0 .4cqh 0 rgba(255,255,255,.5)}
      #end{justify-content:flex-end} .sheet{width:100%;background:#fff;color:#2b2522;border-radius:22px 22px 0 0;padding:2cqh 6cqw 3cqh;display:flex;flex-direction:column;align-items:center;transform:translateY(100%);transition:transform .45s cubic-bezier(.2,1.1,.3,1)} .sheet.up{transform:none} .sheet>*{flex-shrink:0}
      .checker{width:calc(100% + 12cqw);margin:-2cqh -6cqw 0;height:3.2cqh;border-radius:22px 22px 0 0;background:repeating-conic-gradient(#CE0000 0 25%,#E8231C 0 50%) 0 0/3.2cqh 3.2cqh}
      .endlogo{margin:-9.5cqh 0 1.2cqh;background:#fff;border-radius:16px;padding:.9cqh 2.8cqw;border:.7cqw solid #F5C542;box-shadow:0 .8cqh 0 #7d0000,0 1.4cqh 2.6cqh #0005;transform:scale(.6);opacity:0;transition:transform .45s cubic-bezier(.2,1.4,.4,1) .15s,opacity .2s .15s} .endlogo img{height:9cqh;display:block} #end.on .endlogo{transform:none;opacity:1}
      .stamp{font:400 9.5cqw "Lilita One",sans-serif;color:#CE0000;margin:0;line-height:1;text-transform:uppercase;text-shadow:0 .6cqh 0 #FFD23A} .fortune{font-weight:800;font-size:4.2cqw;margin:.6cqh 0 1.6cqh;text-align:center}
      #end .coupon{width:100%;margin:0 0 2cqh} #end:not(.won) .coupon{background:linear-gradient(180deg,#9b908b,#7d726d);border-color:#d9d0cb;filter:drop-shadow(0 .6cqh 0 #4f4743)} #end:not(.won) .coupon b{color:#fff;text-shadow:0 .4cqh 0 #4f4743} #end:not(.won) .coupon svg{filter:grayscale(1);opacity:.75}
      .prod{display:flex;flex-wrap:wrap;align-items:center;gap:1.4cqh 4cqw;width:100%;margin:0 0 2.2cqh;padding:1.6cqh 3.4cqw;border-radius:16px;background:#FFF4E6;border:2px solid #F3D9B8}
      .pz{width:28cqw;height:28cqw;flex:0 0 28cqw;border-radius:50%;overflow:hidden;border:1cqw solid #fff;box-shadow:0 1cqh 2cqh #0004,0 0 0 .5cqw #F5C542} .pz img{width:100%;height:100%;object-fit:cover;display:block}
      .pinfo{flex:1;min-width:0} .pk{display:inline-block;font:800 2.6cqw "Open Sans";color:#7d0000;background:linear-gradient(#FFE27A,#F5B700);padding:.4cqh 2cqw;border-radius:999px;text-transform:uppercase;letter-spacing:.04em} .name{font:400 7.6cqw/1 "Lilita One",sans-serif;margin:.8cqh 0 0}
      .adds{flex:0 0 100%;display:grid;grid-template-columns:repeat(3,1fr);gap:2cqw;border-top:2px dashed #EBCB9F;padding-top:1.3cqh;position:relative} .addk{position:absolute;top:-1.5cqh;left:50%;transform:translateX(-50%);background:#FFF4E6;padding:0 2cqw;font:800 2.4cqw "Open Sans";color:#9a6a2e;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap}
      .add{display:flex;flex-direction:column;align-items:center;text-align:center;gap:.3cqh} .add i{width:10cqw;height:10cqw;border-radius:50%;background:#fff url(assets/game/toppings.webp) no-repeat;background-size:400% 200%;border:.5cqw solid #F5C542;box-shadow:0 .4cqh .8cqh #0003} .add b{font:800 2.7cqw/1.15 "Open Sans";color:#2b2522}
      .row{display:flex;gap:3cqw;width:100%} .row .btn{width:auto;flex:1} #end:not(.won) #sec{flex:0 0 38%;font-size:3.8cqw}
      .link{background:none;border:0;color:#7a6f66;font:700 3.6cqw "Open Sans";text-decoration:underline;margin-top:1.6cqh;cursor:pointer} #end:not(.won) .link{display:none}
      .snd{position:absolute;top:8.6cqh;right:2.6cqw;width:9cqw;height:9cqw;border-radius:50%;border:.6cqw solid #F5C542;background:#fff;box-shadow:0 .5cqh 0 #7d0000,0 .8cqh 1.6cqh #0005;padding:1.6cqw;cursor:pointer;z-index:5} .snd svg{width:100%;height:100%;display:block} .snd .x{display:none} .snd.off .x{display:block} .snd.off .w{display:none}`;
    document.head.appendChild(st);
    const coupon = (k, l, id) => `<div class="coupon" ${id ? `id="${id}"` : ''}><div class="stub"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10h18v4H3zM5 14h14v7H5z" fill="#CE0000"/><path d="M11 10h2v11h-2z" fill="#F5C542"/><path d="M12 10c-1.5-3.5-5-4-5.5-2S9 10 12 10zm0 0c1.5-3.5 5-4 5.5-2S15 10 12 10z" fill="none" stroke="#CE0000" stroke-width="1.6"/></svg></div><div class="ct"><b>${k}</b><span>${l}</span></div></div>`;
    document.getElementById('stage').insertAdjacentHTML('beforeend', `
      <div id="start" class="card">${NOART ? '' : '<div class="logo"><img src="assets/game/logo.svg" alt="Pizza Hut"></div>'}<div class="kicker">${C.kicker}</div><h1 class="title">${C.title}</h1>${coupon(C.rewardKick, C.rewardLine)}<button class="btn" id="play">${C.play}</button></div>
      <div id="end" class="card hidden"><div class="sheet" id="sheet"><div class="checker"></div>${NOART ? '' : '<div class="endlogo"><img src="assets/game/logo.svg" alt="Pizza Hut"></div>'}
        <p class="stamp" id="stamp"></p><p class="fortune" id="fortune"></p>${coupon('', '', 'ticket')}
        <div class="prod"><div class="pz"><img src="assets/game/pizza-dressed.webp" alt="Lohei Pizza"></div><div class="pinfo"><div class="pk">${C.prodKick}</div><div class="name">${C.item}</div></div>
          <div class="adds"><div class="addk">${C.addsKick}</div>${C.adds.map((n, k) => `<div class="add"><i style="background-position:${[33.33, 66.67, 100][k]}% 100%"></i><b>${n}</b></div>`).join('')}</div></div>
        <div class="row"><button class="btn" id="cta"></button><button class="btn gold" id="sec"></button></div><button class="link" id="again">${C.makeAnother}</button></div></div>
      ${NOART ? '' : '<button id="snd" class="snd" aria-label="Sound"><svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#CE0000"/><path class="w" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="#CE0000" stroke-width="2" fill="none" stroke-linecap="round"/><path class="x" d="M16 9l5 6M21 9l-5 6" stroke="#8a807b" stroke-width="2.2" stroke-linecap="round"/></svg></button>'}`);
    document.getElementById('play').onclick = e => { e.stopPropagation(); SFX.unlock(); document.getElementById('start').classList.add('hidden'); reset('play'); };
    const again = () => { document.getElementById('end').classList.add('hidden'); document.getElementById('end').classList.remove('on'); document.getElementById('sheet').classList.remove('up'); SFX.unlock(); reset('play'); };
    document.getElementById('again').onclick = e => { e.stopPropagation(); again(); };
    document.getElementById('cta').onclick = e => { e.stopPropagation(); if (S.mode === 'fail') again(); else exit(CONFIG.ctaUrl); };
    document.getElementById('sec').onclick = e => { e.stopPropagation(); if (S.mode === 'fail') { exit(CONFIG.ctaUrl); return; } const t = C.shareText.replace('{s}', Math.max(1, Math.round(S.t)));
      if (navigator.share) navigator.share({ text: t, url: CONFIG.ctaUrl }).catch(() => {}); else window.open('https://wa.me/?text=' + encodeURIComponent(t + ' ' + CONFIG.ctaUrl), '_blank'); };
    const snd = document.getElementById('snd'); if (snd) { const show = () => snd.classList.toggle('off', SFX.muted); show(); snd.onclick = e => { e.stopPropagation(); SFX.muted = !SFX.muted; SFX.unlock(); show(); }; }
    if (!ATTRACT) document.getElementById('start').classList.toggle('hidden', BOT);
  }
  function exit(url) { const u = window.clickTag || url; if (window.mraid && mraid.open) mraid.open(u); else window.open(u, '_blank'); }
  function showCard(res) {
    const win = res === 'win', E = document.getElementById('end'); S.cardUp = true; E.classList.toggle('won', win);
    document.getElementById('stamp').textContent = win ? C.stamp : C.failStamp; document.getElementById('fortune').textContent = win ? C.fortune : C.failFortune;
    const tk = document.querySelector('#ticket b'), tl = document.querySelector('#ticket span'); tk.textContent = win ? C.ticketKick : C.lockedKick; tl.textContent = win ? C.ticketLine : C.lockedLine;
    document.getElementById('cta').textContent = win ? C.claim : C.again; document.getElementById('sec').textContent = win ? C.share : C.order2;
    E.classList.remove('hidden'); requestAnimationFrame(() => requestAnimationFrame(() => { document.getElementById('sheet').classList.add('up'); E.classList.add('on'); }));
  }

  // ── sim ──
  function runSim() {
    const out = [], N = +(Q.get('n') || 20);
    for (let r = 0; r < N; r++) {
      reset('play'); let n = 0, fl = 0;
      while (S.mode === 'play' && !S.ended) { autopilot(); const m0 = S.misses, f0 = S.pieces.length; update(1 / 60); if (S.misses > m0 || S.pieces.length > f0) learn(); if (++n > 60 * 120) break; }
      out.push(`${S.mode === 'reveal' ? 'win ' : 'fail'} t=${S.t.toFixed(1)} left=${S.left.toFixed(1)} step=${S.step + 1} misses=${S.misses} drops=${S.drops}`);
    }
    const wins = out.filter(l => l.startsWith('win')).length;
    document.title = 'SIM'; document.body.innerHTML = `<pre id="sim">${SPAM ? 'spam bot' : HUMAN ? 'human bot' : 'perfect bot'}: ${wins}/${N} wins\n${out.join('\n')}</pre>`; throw new Error('sim done');
  }
  // ── layer contract ──
  function layerRoutes() {
    const bp = Q.get('blueprint') || Q.get('explained');
    if (bp) { const L = V.layers.find(l => l.id === bp); if (!L) { document.body.innerHTML = 'no layer ' + bp; throw new Error('no layer'); }
      const c = document.createElement('canvas'); c.width = L.canvas[0]; c.height = L.canvas[1]; c.style.cssText = 'max-width:100%;height:auto;display:block'; document.body.innerHTML = ''; document.body.style.cssText = 'margin:0;background:#222'; document.body.appendChild(c);
      window.LAYERS.blueprint(c.getContext('2d'), L, c.width, c.height, { explain: has('explained'), key: L.key }); document.title = `${L.id} ${L.name}`; throw new Error('blueprint rendered'); }
    if (has('geometry')) { document.body.innerHTML = `<pre id="geometry">${JSON.stringify({ variant: V.id, format: 'playable', key: '#4A5A7A', geometry: { canvas: [W, H], camera: V.camera, centre: [V.cx, V.cy], R: V.R, k: V.k, tray: [V.trayX, V.trayY], ticketY: V.ticketY, hudBand: [0, 62] }, layers: V.layers.map(l => ({ id: l.id, name: l.name, type: l.type, canvas: l.canvas, key: l.key || null, box: l.box || null, cells: l.cells || null, source: l.source || 'gemini', notes: l.notes })) }, null, 2)}</pre>`; document.title = 'GEOMETRY'; throw new Error('geometry printed'); }
  }
  // ── run ──
  function run(view) {
    V = view; Object.assign(CONFIG, view.config || {}, CFG_Q); reset(SIM ? 'play' : ATTRACT || !BOT ? 'attract' : 'play');
    layerRoutes(); if (SIM) runSim();
    document.body.innerHTML = '<div id="stage"><canvas width="640" height="960"></canvas></div>'; cv = document.querySelector('canvas'); ctx = cv.getContext('2d'); makeCards();
    if (BOT && !ATTRACT) reset('play');
    const card = Q.get('card'); if (card) { reset('play'); S.step = card === 'win' ? 5 : 2; const qw = Math.PI * 2 / CONFIG.quarters; for (let st = 0; st < S.step; st++) for (let q = 0; q < CONFIG.quarters; q++) { S.filled[st][q] = true; S.pieces.push({ local: (q + 0.3 + 0.4 * ((st * 7 + q * 3) % 5) / 5) * qw, r: V.R * (0.3 + 0.12 * ((st + q) % 5)), step: st, k: (st + q) % 3, q }); } S.mode = card === 'win' ? 'reveal' : 'fail'; S.reveal = 2; S.phase = 'done'; document.getElementById('start').classList.add('hidden'); showCard(card); }
    cv.addEventListener('pointerdown', down);
    let last = performance.now();
    const loop = now => { requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if ((BOT || S.mode === 'attract') && !card) { const m0 = S.misses, f0 = S.pieces.length; autopilot(); update(dt); if (S.misses > m0 || S.pieces.length > f0) learn(); } else update(dt); frame(); };
    requestAnimationFrame(loop);
    window.GAME = { get S() { return S; }, CONFIG, drop, reset, SFX }; window.__SFX = SFX;
  }
  window.MakerCore = { run, C };
})();
