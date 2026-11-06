/* Threes for Sauce (McDonald's NZ, Dunked Korean Sticky BBQ Chicken, run 931f800a). The player flicks basketballs at a hoop;
   every basket gulps Korean Sticky BBQ sauce up a clear tube; the hoop slides after the first basket, wider and faster after
   each; the eighth ball is sauced and counts two; five notches fill the tube, and the filling ball becomes the Dunked McCrispy,
   which drops through the net while the sauce floods the screen. Composed from the motion kit (swipe, launch, springs, tweens,
   reload, burst, flood, the camera rig, the payoff sequence) and the physics kit (the ball a sphere, the rim a ring, the
   backboard and the post boxes, the burger a solid). Every number is a knob in CONFIG; the sims decide them. */
(function () {
  const CONFIG = {
    ctaUrl: 'https://www.mcdonalds.co.nz/',
    gesture: 'swipe', gestureDir: 'up',
    roundSecs: 80,       // a safety cap only: the rack ends the round (harder-low)
    idleSecs: 20,        // no flick for this long ends the round as the empty rack (no dead state)
    balls: 8,            // G1 the rack (harder-low)
    notches: 5,          // G1 the tube's notches to fill (harder-high)
    saucedWorth: 2,      // G11 the last ball's notches (harder-low)
    // G2 the pressure, three stages: one teaches the flick on a still hoop, two adds the slide, three plays it faster.
    // amp: how far the hoop swings each way, units (harder-high); secs: one full swing (harder-low). Within a stage the numbers
    // step per basket from the first to the second; the slide speed amp/secs in a stage's last basket is 1.5x its first or more
    stages: [
      { name: 'Still', baskets: 1, amp: [0, 0], secs: [4, 4] },
      { name: 'It moves', baskets: 2, amp: [1.3, 1.7], secs: [4.2, 3.4] },
      { name: 'Faster', baskets: 2, amp: [1.8, 2.3], secs: [3.1, 2.4] },
    ],
    leadInSecs: 0.8,     // after a basket the hoop eases into its new slide before the next ball rolls in (rule 16)
    rollSecs: 0.3,       // the next ball rising into the hand
    settleSecs: 0.2,     // after a miss resolves, before the next ball comes up
    flightCap: 2.2,      // a ball that has not scored or landed by then is spent
    ball: { r: 0.21 },
    hoop: { x: 0, y: 2.6, z: 7.5, r: 0.85, tube: 0.05, rimBounce: 0.5,
      board: { dz: 0.95, w: 2.2, h: 1.45, y0: -0.4, d: 0.08, bounce: 0.5 },   // behind the rim's centre; catches the long flicks
      post: { dz: 0.4, w: 0.22 } },
    hoopThroat: 0.62,    // the half-width of the counted throat under the rim (inside the hole the rim leaves a ball's centre)
    // the flick: its across part (dx * len) times aimAcross is where across the court it lands (harder-high); its length over
    // range sets the reach, softened by reachGain (harder-high) and held within reach[] of the hoop's distance
    throw: { from: { x: 0, y: 0.25, z: 0 }, apex: 1.5, g: 24, range: 0.3, aimAcross: 9, reachGain: 0.25, reach: [0.6, 1.15] },
    tube: { x: 1.3, y: 0.12, z: 1.5, w: 0.32, h: 2.6 },          // the sauce tube on the right edge (the measure)
    rack: { z: -0.5, h: 0.07, ball: 0.13, gap: 0.14 },           // the rack along the bottom
    // the McCrispy's slot (the model's box and the solid's); profile: the stand-in's lathe, [r 0..0.5, y 0..1], also its body until the mesh is in
    burger: { w: 0.56, h: 0.46, profile: [[0.46, 0], [0.5, 0.12], [0.5, 0.3], [0.53, 0.42], [0.5, 0.55], [0.48, 0.72], [0.38, 0.88], [0.2, 0.98], [0.001, 1]] },
    payoff: { frame: 0.55, impact: 0.35, surge: 0.8, recede: 0.8, hold: 1.5, rest: 0.45, share: 0.32 },   // rest: the flood's level after the surge (frame fraction), the burger sits dunked in it
    copy: {
      brand: "McDonald's", hint: 'Flick it up at the hoop', leadInHint: 'Flick up',
      startTitle: 'Threes for Sauce', startLine: 'Flick it in. Five baskets fill the Korean Sticky BBQ sauce.', play: 'Play',
      winStamp: 'DUNKED', winTitle: "They dunk hoops. Macca's dunks burgers.",
      winLine: "Dunked Korean Sticky BBQ Chicken. The first Macca's Dunked, here for a limited time.", cta: 'Order now',
      failStamp: 'RIMMED OUT', failLine: "Dunked Korean Sticky BBQ Chicken. Here for a limited time.",
      failWhy: { balls: 'Rimmed out. The sauce did not.', idle: 'Rimmed out. The sauce did not.', time: 'Rimmed out. The sauce did not.' },
      again: 'Play again',
      line: "They dunk hoops. Macca's dunks burgers.",
      cueMoves: 'It moves now. Lead it.', cueFaster: 'Faster.', cueSauced: 'Sauced ball. Counts two.',
      winStat: '{n} from {shots}. Dunked.', failStat: '{n} of {need} in the tube',
    },
  };
  let E = null, S = null, M = null, round = 0, modelLayer = null;
  const TAU = Math.PI * 2;
  const live = () => S.mode === 'play' || S.mode === 'attract';
  // the stage a basket count is in, and how far through it (0 at its first basket, 1 at its last)
  function stageOf(b) {
    let acc = 0;
    for (let i = 0; i < CONFIG.stages.length; i++) { const s = CONFIG.stages[i]; if (b < acc + s.baskets) return { i, s, k: s.baskets > 1 ? (b - acc) / (s.baskets - 1) : 0 }; acc += s.baskets; }
    const i = CONFIG.stages.length - 1; return { i, s: CONFIG.stages[i], k: 1 };
  }
  function driftFor(b) { const { s, k } = stageOf(b); return { amp: s.amp[0] + (s.amp[1] - s.amp[0]) * k, secs: s.secs[0] + (s.secs[1] - s.secs[0]) * k }; }
  // the hoop's x `ahead` seconds from now, at the slide it has now (what a thrower reads)
  function hoopX(ahead) { return CONFIG.hoop.x + (S ? S.amp * S.dir * Math.sin(S.phase + (S.ampTo > 0 ? (ahead || 0) * TAU / S.secs : 0)) : 0); }
  function hoopVel() { return S && S.ampTo > 0 ? S.amp * S.dir * Math.cos(S.phase) : 0; }
  // the burger's outside: the mesh's own once it has loaded, else the stand-in lathe's (a flat-bottomed bun stands as drawn)
  function outline() {
    const Bg = CONFIG.burger, mesh = window.WORLD && modelLayer && window.WORLD.outline ? window.WORLD.outline(modelLayer, Bg.w, Bg.h) : null;
    if (mesh) return mesh;
    const out = [];
    for (const [r, y] of Bg.profile) for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; out.push([Math.cos(a) * r * Bg.w, (y - 0.5) * Bg.h, Math.sin(a) * r * Bg.w]); }
    return out;
  }

  function makeWorld() {
    const Hc = CONFIG.hoop, B = Hc.board, W = window.PHYSICS.world({ g: CONFIG.throw.g });
    W.floor({ y: 0, bounce: 0.4, friction: 0.5 });
    const rim = W.ring({ x: Hc.x, y: Hc.y, z: Hc.z, r: Hc.r, tube: Hc.tube, n: 28, tag: 'rim', bounce: Hc.rimBounce });
    const board = W.box({ x: Hc.x, y: Hc.y + B.y0, z: Hc.z + B.dz, w: B.w, h: B.h, d: B.d, tag: 'board', bounce: B.bounce });
    const post = W.box({ x: Hc.x, y: 0, z: Hc.z + B.dz + Hc.post.dz, w: Hc.post.w, h: Hc.y + B.y0, d: Hc.post.w, tag: 'post', bounce: 0.4 });
    return { W, place(x) { rim.set(x, Hc.y, Hc.z); board.set(x, Hc.y + B.y0, Hc.z + B.dz); post.set(x, 0, Hc.z + B.dz + Hc.post.dz); } };
  }

  function reset(mode) {
    M = window.MOTION; M.clear(); round++;
    const r = M.rng(round * 131);
    S = { mode, elapsed: 0, idle: 0, why: null, reveal: 0, cue: null, down: false, trail: [], aim: null, shake: 0, flash: 0,
      notches: 0, baskets: 0, made: 0, shots: 0, rims: 0, banks: 0, saucedIn: false,
      ball: null, spent: [], loaded: true, burst: null, pops: [], ghost: null, seen: {},
      amp: 0, ampTo: 0, ampTw: null, secs: CONFIG.stages[0].secs[0], secsTw: null, phase: r() * TAU, dir: r() < 0.5 ? 1 : -1,
      squash: M.spring(1, { k: 160, damp: 0.45 }), level: M.spring(0, { k: 90, damp: 0.5 }), tubeShake: 0,
      handRoll: M.reload({ wait: CONFIG.settleSecs, rise: CONFIG.rollSecs }), handLead: M.reload({ wait: CONFIG.leadInSecs, rise: CONFIG.rollSecs }),
      cam: M.camera({ x: 0, y: 0, z: 0 }), payoff: null, flood: null, burger: null, glazed: false, stamp: 0, spin: null, failT: 0, drained: false, botWait: 0, botNeed: null };
    S.hand = S.handRoll;
    S.world = makeWorld();
  }
  const ready = () => live() && S.loaded && S.hand.ready && S.shots < CONFIG.balls && !(S.ball && S.ball.live && !S.ball.resolved);

  function throwFrom(sw) {
    const T = CONFIG.throw, Hc = CONFIG.hoop;
    const reach = M.clamp(1 + (sw.len / T.range - 1) * T.reachGain, T.reach[0], T.reach[1]);
    const tx = T.from.x + sw.dx * sw.len * T.aimAcross;
    const v = M.launch(T.from, { x: tx, y: Hc.y, z: T.from.z + Hc.z * reach }, { apex: T.apex }, T.g);
    if (S.ball && S.ball.live) { S.spent.push(S.ball); while (S.spent.length > 3) { const o = S.spent.shift(); if (o.live) { o.drop(); o.live = false; } } }
    const b = S.world.W.sphere({ x: T.from.x, y: T.from.y, z: T.from.z, vx: v.vx, vy: v.vy, vz: v.vz, r: CONFIG.ball.r, round: true, mass: 1, bounce: 0.5, friction: 0.4, tag: 'ball' });
    b.sauced = S.shots === CONFIG.balls - 1; b.hoopAt = hoopX(0); b.rims = 0; b.board = false; b.cross = null; b.resolved = false; b.hit = false;
    S.ball = b; S.shots++; S.loaded = false; S.idle = 0;
    if (!E.SIM) E.SFX.throw();
  }
  function press(p, src) {
    if (!live()) return; S.down = true; if (src === 'user') E.SFX.unlock();
    S.trail = [{ x: p.x, y: p.y, t: S.elapsed }];
  }
  function move(p) { if (!S.down) return; S.trail.push({ x: p.x, y: p.y, t: S.elapsed }); if (S.trail.length > 24) S.trail.shift(); S.aim = M.swipe(S.trail, { minLen: 0.03, maxSecs: 0.6 }); }
  function release() {
    if (!S.down) return; S.down = false;
    const sw = M.swipe(S.trail, { minLen: 0.05, maxSecs: 0.6 }); S.aim = null; S.trail = [];
    if (!sw || sw.dy > -0.3) return;   // a flick goes up the frame; a tap is not a shot
    if (!ready()) return;              // a flick while the next ball rolls in does not count
    throwFrom(sw);
  }

  // the next ball rolls up into the hand (after a basket it waits for the hoop's new slide)
  function load(lead) {
    if (S.shots >= CONFIG.balls) return;
    S.hand = lead ? S.handLead : S.handRoll; S.hand.use(); S.loaded = true;
    if (S.shots === CONFIG.balls - 1 && !S.seen.sauced) { S.seen.sauced = 1; E.cue(CONFIG.copy.cueSauced, 2.2); }
  }
  function burstAt(level, n, big) {
    const T = CONFIG.tube;
    S.burst = M.burst({ x: T.x, y: T.y + T.h * Math.min(1, level), z: T.z, n, speed: big ? 4.5 : 2.2, spread: big ? 1.0 : 0.6, g: 12, life: big ? 0.9 : 0.5, size: big ? [0.05, 0.11] : [0.03, 0.06], seed: S.shots * 13 + n, floor: 0 });
  }
  function score(b) {
    b.hit = true; b.resolved = true;
    const worth = b.sauced ? CONFIG.saucedWorth : 1;
    S.made++; S.baskets++; S.notches = Math.min(CONFIG.notches, S.notches + worth); if (b.sauced) S.saucedIn = true;
    S.squash.kick(-9); S.level.to(S.notches / CONFIG.notches); S.level.kick(1.2); S.tubeShake = 1; S.flash = 0.6;
    burstAt(S.notches / CONFIG.notches, 10, false);
    if (!E.SIM) { E.SFX.swish(); E.SFX.gulp(); }
    if (S.notches >= CONFIG.notches) { startPayoff(b); E.finish('win'); return; }
    if (S.shots >= CONFIG.balls) { lose(b); return; }
    // the hoop's next slide, eased in over the lead-in; the cue says so the first time
    const was = stageOf(S.baskets - 1).i, d = driftFor(S.baskets), st = stageOf(S.baskets).i;
    S.ampTw = M.tween(S.amp, d.amp, CONFIG.leadInSecs, 'inOut'); S.secsTw = M.tween(S.secs, d.secs, CONFIG.leadInSecs, 'inOut'); S.ampTo = d.amp;
    if (d.amp > 0 && !S.seen.moves) { S.seen.moves = 1; E.cue(CONFIG.copy.cueMoves, 2); }
    else if (st > was && st >= 2 && !S.seen.faster) { S.seen.faster = 1; E.cue(CONFIG.copy.cueFaster, 1.6); }
    load(true);
  }
  // a miss names itself: which way, and on a moving hoop a ghost ring where the hoop was at the flick (rule 18)
  function miss(b) {
    const moving = S.amp > 0.1; let text;
    if (!b.cross) text = b.board ? 'Long' : 'Short';
    else {
      const { dx, dz, vel } = b.cross;
      if (Math.abs(dz) > Math.abs(dx) + 0.2) text = dz < 0 ? 'Short' : 'Long';
      else if (moving) text = Math.sign(dx) === -Math.sign(vel) ? 'Behind it' : 'Ahead of it';
      else text = dx < 0 ? 'Too far left' : 'Too far right';
    }
    S.pops.push({ text, x: hoopX(0), y: CONFIG.hoop.y + 1.2, z: CONFIG.hoop.z, t: 0 });
    if (moving) S.ghost = { x: b.hoopAt, a: 1 };
  }
  function resolve(b) {
    if (b.resolved) return; b.resolved = true;
    miss(b);
    if (S.shots >= CONFIG.balls) { if (S.notches < CONFIG.notches) lose(b); return; }
    load(false);
  }
  // G3: the last ball spins round the rim and out (when it reached the rim), the sauce slurps back down
  function lose(b) {
    if (b && b.rims > 0 && b.live) { const hx = hoopX(0); S.spin = { t: 0, x: hx, a: Math.atan2(b.z - CONFIG.hoop.z, b.x - hx) }; b.drop(); b.live = false; }
    E.finish('fail', 'balls');
  }

  // G5 / G9 / G12: the filling ball becomes the McCrispy at the rim; it drops through the net, the camera frames it, the tube
  // bursts, the sauce surges over the screen and falls back so the burger sits dunked in it, the line stamps on, then the card
  function startPayoff(b) {
    const Hc = CONFIG.hoop, Bg = CONFIG.burger, P = CONFIG.payoff, c = S.cam, hx = hoopX(0);
    const y = Math.min(b.y, Hc.y - 0.05); b.drop(); b.live = false; S.ball = null;
    for (const o of S.spent) if (o.live) { o.drop(); o.live = false; }   // the floor under the net is the burger's alone
    S.burger = S.world.W.solid({ x: hx, y, z: Hc.z, vx: 0, vy: -1, vz: 0, w: Bg.w, h: Bg.h, outline: outline(), mass: 1, bounce: 0.2, friction: 0.7, tag: 'burger' });
    S.flash = 1; S.swapAt = S.elapsed;
    S.payoff = M.sequence([
      { secs: P.frame, start() { c.frame(() => { const g = S.burger; return { x: g.x, y: g.y - Bg.h / 2, z: g.z, h: Bg.h }; }, P.share, P.frame, 'inOut'); } },
      { secs: P.impact, start() { S.shake = 0.8; S.tubeShake = 1.6; S.level.to(1.1); S.level.kick(3); burstAt(1, 26, true); if (!E.SIM) E.SFX.burst(); } },
      { secs: P.surge, start() { S.flood = M.flood({ from: 0, to: 1.1, secs: P.surge, wave: { amp: 0.025, len: 0.5, speed: 1.3 }, ease: 'out' }); if (!E.SIM) E.SFX.flood(); } },
      { secs: P.recede, start() { S.glazed = true; S.flood = M.flood({ from: 1.1, to: P.rest, secs: P.recede, wave: { amp: 0.018, len: 0.6, speed: 1.0 }, ease: 'inOut' }); } },
      { secs: P.hold, start() { S.stamp = 0.001; } },
    ]);
  }
  const payoffSecs = () => { const P = CONFIG.payoff; return P.frame + P.impact + P.surge + P.recede + P.hold; };

  function stepBall(b) {
    const Hc = CONFIG.hoop, hx = hoopX(0);
    if (b.contacts.includes('rim')) { b.rims++; S.rims++; S.squash.kick(-3); if (!E.SIM) E.SFX.rim(); }
    if (b.contacts.includes('board')) { if (!b.board) S.banks++; b.board = true; if (!E.SIM) E.SFX.board(); }
    if (b.resolved) return;
    // through: falling, it is in the net's throat under the rim, having come from above it (the rim's colliders decide what
    // gets there; the throat is narrower than the hole, so nothing reaches it from outside the rim)
    if (b.y > Hc.y) b.above = true;
    const throat = { x: hx, y: Hc.y - 0.4, z: Hc.z, w: CONFIG.hoopThroat * 2, h: 0.36, d: CONFIG.hoopThroat * 2 };
    if (b.above && b.vy < 0 && M.hitBox(b, throat)) { score(b); return; }
    if (b.above && b.vy < 0 && !b.cross && b.y < Hc.y) b.cross = { dx: b.x - hx, dz: b.z - Hc.z, vel: hoopVel() };
    if (b.contacts.includes('floor')) b.grounded = true;
    if (b.grounded || b.age > CONFIG.flightCap) resolve(b);
  }
  function update(dt) {
    M.update(dt);
    S.flash = Math.max(0, S.flash - dt * 3); S.shake = Math.max(0, S.shake - dt * 2.5); S.tubeShake = Math.max(0, S.tubeShake - dt * 3);
    for (const p of S.pops) p.t += dt; S.pops = S.pops.filter(p => p.t < 1.2);
    if (S.ghost) { S.ghost.a -= dt / 1.4; if (S.ghost.a <= 0) S.ghost = null; }
    if (S.burst) { S.burst.step(dt); if (!S.burst.live) S.burst = null; }
    if (S.mode === 'reveal' || S.mode === 'win') {
      S.reveal += dt; S.world.W.step(dt);
      if (S.payoff) S.payoff.step(dt); if (S.flood) S.flood.step(dt); if (S.stamp > 0) S.stamp += dt;
      if (S.mode === 'reveal' && S.reveal > payoffSecs()) S.mode = 'win';
      return;
    }
    if (S.mode === 'fail') {
      S.failT += dt; S.world.W.step(dt); if (S.spin) S.spin.t += dt;
      if (!S.drained && S.failT > (S.spin ? 1.1 : 0.15)) { S.drained = true; S.level.to(0); if (!E.SIM) E.SFX.slurp(); }
      return;
    }
    if (!live()) return;
    S.elapsed += dt; S.idle += dt;
    if (S.ampTw) S.amp = S.ampTw.v; if (S.secsTw) S.secs = S.secsTw.v;
    if (S.ampTo > 0) S.phase += dt * TAU / S.secs;
    S.world.place(hoopX(0));
    S.world.W.step(dt);
    const b = S.ball;
    if (b && b.live) { stepBall(b); if (!live()) return; }
    for (const o of S.spent) if (o.live && (o.state === 'rest' || o.age > 6)) { o.drop(); o.live = false; }
    if (b && b.live && b.resolved && (b.state === 'rest' || b.age > 6)) { b.drop(); b.live = false; }
    if (S.elapsed >= CONFIG.roundSecs) return E.finish('fail', 'time');
    if (S.idle >= CONFIG.idleSecs && S.loaded) return E.finish('fail', 'idle');
  }

  // ONE bot, the expert: it reads where the hoop will be when the ball arrives (the slide and the flight time) and flicks the
  // swipe that lands there. The kit's hand errs this intent for the first-timer. ?lazy: the card's game test, a straight flick
  // up every time (G8)
  function autopilot(dt) {
    if (!ready()) { S.botWait = 0; S.botNeed = null; return; }
    S.botWait += dt; if (S.botNeed == null) S.botNeed = E.hand.wait(); if (S.botWait < S.botNeed) return; S.botWait = 0; S.botNeed = null;
    const T = CONFIG.throw, Hc = CONFIG.hoop, r = M.rng(round * 977 + S.shots * 7 + 1);
    if (E.has('lazy')) { throwFrom(E.hand.aim({ dx: 0, dy: -1, len: T.range })); return; }
    const flight = M.launch(T.from, { x: 0, y: Hc.y, z: Hc.z }, { apex: T.apex }, T.g).secs;
    const aimX = hoopX(flight) + (r() - 0.5) * 0.2;
    const len = T.range * (0.99 + r() * 0.02);
    const dx = M.clamp((aimX - T.from.x) / (T.aimAcross * len), -0.95, 0.95), dy = -Math.sqrt(1 - dx * dx);
    throwFrom(E.hand.aim({ dx, dy, len }));
  }

  window.ThreesForSauceGame = {
    CONFIG, get S() { return S; }, hoopX, stageOf,
    run(VIEW) {
      modelLayer = (VIEW.layers || []).find(l => l.type === 'model') || null;
      const C = CONFIG.copy;
      const game = {
        CONFIG, get S() { return S; }, reset, press, move, release, update, autopilot,
        pending: () => !!(S.ball && S.ball.live && !S.ball.resolved),
        simLine: () => `t=${S.elapsed.toFixed(1)} made=${S.made} shots=${S.shots} notches=${S.notches} rims=${S.rims} banks=${S.banks} sauced=${S.saucedIn ? 1 : 0} why=${S.why || '-'}`,
        hud: () => {
          if (!S) return { left: '', right: '', dots: null };
          const left = CONFIG.balls - S.shots;
          return { left: `Sauce ${S.notches}/${CONFIG.notches}`, right: `${left} ${left === 1 ? 'ball' : 'balls'}`,
            hint: S.elapsed < 1 ? C.leadInHint : C.hint, hintOn: S.mode === 'play' && S.elapsed < 3 && S.shots === 0, dots: null };
        },
        stat: () => (S.mode === 'fail' ? C.failStat : C.winStat).replace('{n}', S.notches).replace('{shots}', S.shots).replace('{need}', CONFIG.notches),
        failWhy: () => C.failWhy[S.why] || C.failWhy.balls,
        sounds: sfx => ({
          throw() { const t = sfx.now(); sfx.noise(t, 0.09, 0.2, 900); },
          swish() { const t = sfx.now(); sfx.noise(t, 0.18, 0.22, 4200); sfx.tone(880, t + 0.04, 0.12, 'sine', 0.08); },
          gulp() { const t = sfx.now(); sfx.tone(180, t + 0.08, 0.16, 'sine', 0.2, 140); },
          rim() { const t = sfx.now(); sfx.tone(520, t, 0.06, 'square', 0.07); sfx.noise(t, 0.06, 0.2, 3000); },
          board() { const t = sfx.now(); sfx.noise(t, 0.08, 0.25, 700); },
          burst() { const t = sfx.now(); sfx.noise(t, 0.35, 0.3, 600); sfx.tone(120, t, 0.3, 'sine', 0.22, -40); },
          flood() { const t = sfx.now(); sfx.noise(t, 0.8, 0.18, 400); },
          slurp() { const t = sfx.now(); sfx.tone(320, t, 0.5, 'sawtooth', 0.06, -220); sfx.noise(t, 0.4, 0.12, 500); },
        }),
        cardState(qc) {
          if (qc === 'win') { S.notches = CONFIG.notches; S.made = 4; S.shots = 7; S.mode = 'win'; S.level.to(1); }
          else { S.notches = 3; S.made = 3; S.shots = CONFIG.balls; S.why = 'balls'; S.mode = 'fail'; }
        },
        winDelayMs: Math.round(payoffSecs() * 1000), failDelayMs: 1500,
      };
      E = window.ENGINE; E.run(game, VIEW);
    },
  };
})();
