/* Hop to the Arches (McDonald's Qatar · Side Missions with Xbox; market set by the owner 2026-10-29) on the shared engine.
   Hold to crouch, let go to leap rock to rock across the canyon to the Golden Arches. The course lives in world units:
   z along the jump (the side page scrolls it right, the rear page runs it into depth), y above the pillar tops (0 = a top).
   A miss drops the marine with his box after him; the next marine drops onto the same rock and the round goes on; the
   round is lost when the clock runs out short of the restaurant. */
(function () {
  const CONFIG = {
    ctaUrl: 'https://www.mcdonalds.com/qa/en-qa/',   // McDonald's Qatar (owner 2026-10-29: the campaign is for Qatar); the client's app link replaces it
    gesture: 'hold',                  // the card's one gesture; the start card's hand plays it
    roundSecs: 21,                      // 11 jumps (owner 2026-10-29: longer play); sims: perfect 14.1 s, first-timer band
    // the play size: every shape plays this course at these sizes (world units), so each shape is equally hard
    play: {
      pressFrom: 0.125,                 // frame fraction: a press below the top band counts
      span: 8.4,                        // world units across the frame (11.5 -> 9.8 -> 8.4, owner 2026-10-29: the marine at ~14% of the frame height for a phone)
      marineH: 1.8,                     // the marine's height, world units
      kinds: ['wide', 'wide', 'wide', 'wide', 'medium', 'medium', 'medium', 'medium', 'narrow', 'narrow', 'narrow', 'arches'],   // 11 jumps   // rock 0 the start, the last the restaurant
      halves: { wide: 0.85, medium: 0.65, narrow: 0.48, arches: 1.4 },   // half of each top's width
      gaps: [1.6, 1.7, 2.0, 2.3, 2.4, 2.1, 2.3, 2.7, 2.9, 2.4, 3.2],   // edge to edge before rocks 1..11, at rest
      // sliding rocks (owner 2026-10-29): a slow slide along the jump, the gap opens and closes; the rock carries whoever stands on it
      movers: { 6: { amp: 0.45, period: 2.8, phase: 0 }, 7: { amp: 0.5, period: 2.4, phase: 1.6 }, 10: { amp: 0.45, period: 1.9, phase: 0.8 } },
      // broken pillars leaning on a rock from behind, below the tops: ruin scenery between some rocks, not a landing surface
      leaners: [{ gap: 2, lean: 0.22 }, { gap: 5, lean: -0.2 }, { gap: 8, lean: 0.24 }],   // edge to edge before rocks 1..7: wider toward the restaurant
      boxRocks: [3, 6, 9],
      // single nuggets in mid-air on the arc of a clean leap into these rocks (still rocks only): three a jump, at body height
      nuggetArcs: [2, 4, 5, 8, 9], nuggetAt: [0.3, 0.5, 0.7], nuggetBody: 0.55, nuggetReach: 0.45,
      landTol: 0.12,                    // the feet may land this far past a top's edge
      doorAt: -0.35,                    // the doorway, as a share of the restaurant top's half from its centre (it faces the marine)
    },
    maxHold: 1.1,                       // seconds; at this hold he springs on his own at full power
    leapMin: 0.8, leapPerSecond: 5.0,   // leap length = leapMin + leapPerSecond × hold
    flightBase: 0.22, flightPerUnit: 0.04,   // seconds in the air
    apexBase: 0.5, apexPerUnit: 0.22,   // arc height
    sailPast: 0.55,                     // a long leap comes down this far past the target's far edge
    crouchPoseAt: 0.02,                 // share of the hold where the crouch still replaces the stand still: at once (owner 2026-10-29)
    settleSecs: 0, panSecs: 0.3,   // no wait after a landing: a hold starts the crouch at once (owner 2026-10-29)
    leadAt: 3, moveAt: 5, leadSecs: 0.8,   // the lead-ins: before the first medium rock, before the first sliding rock;           // the lead-in before rock 5: holds neither count nor cost
    fallSecs: 1.1, dropSecs: 0.5, dropFrom: 4, fallGravity: 14,   // the fall plus the drop-in: about 1.6 s
    inSecs: 0.6, revealSecs: 2.6,
    bot: { errEarly: 0.22, errLate: 0.11, cleanToSettle: 2, react: [0.12, 0.3], fumble: 0.3, overhold: 0.05 },
    idleToAttract: 3,
    copy: {
      brand: "McDonald's", hint: 'Hold', leadInHint: 'Hold',
      cueLead: 'Wider gaps, narrower rocks', cueMove: 'Moving rocks: time your jump', cueBox: 'Box lost, order down',
      popLevel: 'LEVEL {n}', popShort: 'SHORT', popLong: 'LONG',
      orderSizes: ['0 pcs', '6 pcs', '9 pcs', '20 pcs'], rockWord: 'Rock',
      startTitle: 'Hop to the Arches', startLine: '<b>HOLD</b> to crouch<i>·</i><b>RELEASE</b> to jump', play: 'Start mission',   // a mission briefing (owner 2026-10-29)
      winStamp: 'GAME ON', winTitle: 'Order up!',
      // the end cards are game screens, not copy (owner 2026-10-29): one line of payoff, the legal in small type
      winLine: "Unlock the armour in the McDonald's App.<small>Limited time only</small>",
      cta: 'Download the app',
      failStamp: 'GAME OVER', failLine: '',
      failWhy: { time: '{n} rocks to go!', one: 'One rock short!', falls: '{f} missed jumps!' },
      again: 'Play again',
    },
  };
  let E = null, S = null;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const gauss = () => { let u = 0; while (!u) u = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185 * Math.random()); };
  const leapDist = h => CONFIG.leapMin + CONFIG.leapPerSecond * Math.min(h, CONFIG.maxHold);
  const live = () => S.mode === 'play' || S.mode === 'attract';

  function buildRocks() {
    const P = CONFIG.play, out = []; let z = 0;
    P.kinds.forEach((kind, i) => {
      const half = P.halves[kind];
      if (i > 0) z += out[i - 1].half + P.gaps[i - 1] + half;
      const mv = (P.movers || {})[i] || null;
      out.push({ i, z, z0: z, half, kind, mv, box: P.boxRocks.includes(i), taken: false, last: i === P.kinds.length - 1 });
    });
    return out;
  }
  // the mid-air nuggets: on the arc of a centre-to-centre leap (the leap's own apex rule), lifted to the body's middle
  function buildNuggets(rocks) {
    const P = CONFIG.play, out = [];
    (P.nuggetArcs || []).forEach(i => {
      const A = rocks[i - 1], B = rocks[i]; if (!A || !B) return;
      const d = B.z0 - A.z0, apex = CONFIG.apexBase + CONFIG.apexPerUnit * d;
      P.nuggetAt.forEach((t, k) => out.push({ z: A.z0 + d * t, y: 4 * apex * t * (1 - t) + P.nuggetBody, taken: false, k, arc: i }));
    });
    return out;
  }
  function collectNuggets() {
    const M = S.marine, P = CONFIG.play, by = M.y + P.nuggetBody;
    S.nuggets.forEach(n => {
      if (n.taken || Math.abs(n.z - M.z) > P.nuggetReach || Math.abs(n.y - by) > P.nuggetReach) return;
      n.taken = true; S.bonus++; S.orderBump = 1;
      S.pops.push({ t: 0, txt: '+1', z: n.z, y: n.y + 0.3, kind: 'box' });
      S.sparks.push({ z: n.z, y: n.y, t: 0 });
      if (!E.SIM) E.SFX.nugget(S.chain++);   // each nugget in one leap a step up the scale
    });
  }
  // a rock's centre at time t: a sliding rock's sine about its rest place, a still rock where it stands
  const zAt = (R, t) => R.mv ? R.z0 + R.mv.amp * Math.sin(6.2832 * t / R.mv.period + R.mv.phase) : R.z;
  function moveRocks() {
    const M = S.marine, on = S.rocks[S.rock], riding = on && on.mv && M.y <= 0.001 && (S.phase === 'stand' || S.phase === 'land' || S.phase === 'lead');
    const before = on ? on.z : 0;
    S.rocks.forEach(R => { if (R.mv) R.z = zAt(R, S.elapsed); });
    if (riding) M.z += on.z - before;
  }
  function reset(mode) {
    const rocks = buildRocks(), last = rocks.length - 1;
    S = { mode, elapsed: 0, timeLeft: CONFIG.roundSecs, rocks, last, rock: 0, phase: 'stand', phaseT: 0, stand: 0,
      marine: { z: rocks[0].z, y: 0, crouch: 0, pose: 'stand', alpha: 1, spin: 0 }, nuggets: buildNuggets(rocks), bonus: 0, spilt: 0, chain: 0, sparks: [], spill: [],
      holding: false, holdT: 0, holdVoid: false, down: false, touched: false, fly: null, inDone: false,
      cam: { z: rocks[0].z }, pan: null, doorZ: rocks[last].z + CONFIG.play.doorAt * rocks[last].half,
      boxes: 0, picked: 0, lost: 0, falls: 0, shorts: 0, longs: 0, hops: 0, jumps: 0, clean: 0, autos: 0, squad: 0,
      floats: [], dust: [], pops: [], ghost: null, orderBump: 0, flash: 0, shake: 0,
      why: null, reveal: 0, idle: 0, cue: null, seen: {}, bot: { key: -1, w: 0 } };
  }
  function setPhase(p) { S.phase = p; S.phaseT = 0; if (p === 'stand') S.stand++; }
  function startHold() { S.holding = true; S.holdT = 0; }

  // the one control: hold to crouch deeper, let go to leap; the longer the hold, the longer the leap
  function press(p, src) {
    if (!live()) return;
    if (src === 'user' && p.y < CONFIG.play.pressFrom) return;
    S.down = true; S.idle = 0;
    if (src === 'user') { E.SFX.unlock(); S.touched = true; }
    if (S.phase === 'lead') { S.holdVoid = true; return; }
    if ((S.phase === 'stand' || S.phase === 'land') && !S.holding && !S.holdVoid) startHold();
  }
  function move() {}
  function release() {
    const was = S.holding; S.down = false; S.holdVoid = false;
    if (!live()) { S.holding = false; return; }
    if (was && S.phase === 'stand') leap(S.holdT, false);
  }
  function leap(h, auto) {
    const P = CONFIG.play, cur = S.rocks[S.rock], T = S.rocks[S.rock + 1];
    S.holding = false; if (!T) return;
    S.jumps++; S.chain = 0; if (auto) { S.autos++; S.holdVoid = true; }
    if (!E.SIM) E.SFX.jump();
    const d = CONFIG.leapMin + CONFIG.leapPerSecond * Math.min(h, CONFIG.maxHold);
    const z0 = S.marine.z, landZ = z0 + d, tz = zAt(T, S.elapsed + CONFIG.flightBase + CONFIG.flightPerUnit * Math.max(0.2, d));   // a sliding target: where it is at touchdown
    const near = tz - T.half - P.landTol, far = tz + T.half + P.landTol;
    let result = landZ <= cur.z + cur.half + P.landTol ? 'hop' : landZ < near ? 'short' : landZ > far ? 'long' : 'land';
    const z1 = result === 'long' ? Math.min(landZ, far + CONFIG.sailPast) : result === 'hop' ? Math.min(landZ, cur.z + cur.half) : landZ;
    const span = Math.max(0.2, z1 - z0);
    S.fly = { z0, z1, landZ, result, t: 0, secs: CONFIG.flightBase + CONFIG.flightPerUnit * span, apex: CONFIG.apexBase + CONFIG.apexPerUnit * span, need: tz, d };
    setPhase('leap');
  }
  function land(F) {
    const M = S.marine; M.y = 0;
    if (F.result === 'hop') { S.hops++; M.z = F.z1; M.pose = 'stand'; setPhase('land'); return; }
    if (F.result !== 'land') return miss(F);
    S.rock++; const R = S.rocks[S.rock]; S.clean++;
    M.z = clamp(F.landZ, R.z - R.half, R.z + R.half); M.pose = 'stand';
    S.dust.push({ z: M.z, t: 0 }); S.shake = 0.25;
    S.pan = { from: S.cam.z, to: R.z, t: 0 };
    S.pops.push({ t: 0, txt: CONFIG.copy.popLevel.replace('{n}', S.rock + 1), z: M.z, y: CONFIG.play.marineH * 1.4, big: true, kind: 'level' });
    if (!E.SIM) E.SFX.land();
    if (R.box && !R.taken) { R.taken = true; S.picked++; S.boxes = Math.min(3, S.boxes + 1); S.orderBump = 1; S.flash = 1; S.pops.push({ t: 0, txt: CONFIG.copy.orderSizes[S.boxes], z: M.z, y: CONFIG.play.marineH * 0.9, kind: 'box' }); if (!E.SIM) E.SFX.pick(); }
    if (R.last) { setPhase('in'); return; }
    // the cues are overlays only: they never pause input or void a hold that is already down (owner 2026-10-29: no wait time)
    if (S.rock === CONFIG.moveAt && !S.seen.move) { S.seen.move = true; E.cue(CONFIG.copy.cueMove, CONFIG.leadSecs + 0.8); }
    if (S.rock === CONFIG.leadAt && !S.seen.lead) { S.seen.lead = true; E.cue(CONFIG.copy.cueLead, CONFIG.leadSecs + 0.6); }
    setPhase('land');
  }
  function miss(F) {
    const short = F.result === 'short'; S.falls++; if (short) S.shorts++; else S.longs++;
    S.pops.push({ t: 0, txt: short ? CONFIG.copy.popShort : CONFIG.copy.popLong, z: F.z1, y: CONFIG.play.marineH * 1.2, big: true, bad: true, kind: 'miss' });
    S.ghost = { z: F.landZ, need: F.need, kind: F.result, first: S.falls === 1, t: 0 };
    if (S.boxes > 0) {
      S.boxes--; S.lost++; S.orderBump = 1;
      S.floats.push({ z: F.z1, y: 0.4, t: 0, vz: rand(0.2, 0.8), vy: rand(2.2, 3.2), spin: rand(-7, 7), alpha: 1, rot: 0 });   // the box drops for real: a pop, a tumble, gravity
      if (!S.seen.box) { S.seen.box = true; E.cue(CONFIG.copy.cueBox, 1.8); }
    }
    S.shake = 0.5;
    if (!E.SIM) E.SFX.whistle();
    // a miss keeps the leap's momentum (owner 2026-10-29: "stopped by an invisible gap and wall, then falling"): the arc goes on
    // under gravity from where it crossed the tops' level, and the body meets the pillars' real faces on the way down
    S.fallV = { vz: (F.z1 - F.z0) / F.secs, vy: -4 * F.apex / F.secs, hit: false };
    setPhase('fall');
  }
  // a pillar's face at depth y below its top (y <= 0), as a half-width: the painted shape measured from the pillar art (2026-10-29):
  // the sandstone cap full width for its top 0.27 units, the neck narrowing to 0.79 by 0.54, the shaft at 0.80 below; the arches
  // rock is drawn scaled to its own top, so its cap and neck scale with it
  const BODY = 0.22;   // the marine's half-depth along the jump at the torso and boots (the leap still)
  function faceHalf(R, y) {
    const k = R.kind === 'arches' ? R.half / CONFIG.play.halves.wide : 1, capT = 0.27 * k, neck = 0.54 * k, dd = -y;
    return R.half * (dd <= capT ? 1 : dd >= neck ? 0.8 : 1 - 0.2 * (dd - capT) / (neck - capT));
  }
  function fallStep(dt) {
    const M = S.marine, t = S.phaseT, V = S.fallV || { vz: 0.6, vy: 0, hit: false };
    V.vy -= CONFIG.fallGravity * dt; M.y += V.vy * dt; M.z += V.vz * dt; if (V.hit) V.vz *= Math.max(0, 1 - 3 * dt);   // off the wall: the knock dies away
    if (M.y < 0) for (const R of S.rocks) {
      const fh = faceHalf(R, M.y), dz = M.z - R.z;
      if (Math.abs(dz) >= fh + BODY) continue;
      const side = dz < 0 ? -1 : 1;
      M.z = R.z + side * (fh + BODY);                       // out of the rock, against its face
      if (V.vz * side < 0) {                                // moving into it: knocked back off the edge, then down the face
        V.vz = -V.vz * 0.15;
        if (!V.hit) {
          V.hit = true; S.shake = Math.max(S.shake, 0.35); if (!E.SIM) E.SFX.crash();
          // the crash spills half the collected nuggets: they burst away from the wall and fall (owner 2026-10-29)
          const lose = Math.ceil(S.bonus / 2);
          if (lose > 0) {
            S.bonus -= lose; S.spilt += lose; S.orderBump = 1;
            for (let i = 0; i < lose; i++) S.spill.push({ z: M.z, y: M.y + 0.7, vz: side * rand(0.8, 2.6), vy: rand(1.8, 4.2), spin: rand(-12, 12), rot: 0, t: 0 });
            S.pops.push({ t: 0, txt: `-${lose}`, z: M.z, y: M.y + 1.6, big: true, bad: true, kind: 'miss' });
            if (!E.SIM) E.SFX.spill(lose);
          }
        }
      }
    }
    M.spin = t * 2.2; M.pose = 'fall';
    M.alpha = 1 - clamp((t - 0.6) / 0.5, 0, 1);
  }
  function dropIn() {   // the next marine of the squad drops onto the same rock
    const R = S.rocks[S.rock];
    Object.assign(S.marine, { z: R.z, y: CONFIG.dropFrom, crouch: 0, pose: 'leap', alpha: 1, spin: 0 });
    S.squad++; if (!E.SIM) E.SFX.drop();
    setPhase('drop');
  }
  function step(dt) {
    const M = S.marine;
    S.phaseT += dt;
    switch (S.phase) {
      case 'stand':
        if (S.down && !S.holding && !S.holdVoid) startHold();
        if (S.holding) { S.holdT += dt; if (S.holdT >= CONFIG.maxHold) { leap(CONFIG.maxHold, true); break; } }
        M.crouch = S.holding ? Math.min(1, S.holdT / CONFIG.maxHold) : Math.max(0, M.crouch - dt * 8);
        M.pose = M.crouch >= CONFIG.crouchPoseAt ? 'crouch' : 'stand';
        break;
      case 'leap': {
        const F = S.fly; F.t = Math.min(1, F.t + dt / F.secs);
        M.z = F.z0 + (F.z1 - F.z0) * F.t; M.y = 4 * F.apex * F.t * (1 - F.t); M.crouch = Math.max(0, M.crouch - dt * 10); M.pose = 'leap'; collectNuggets();
        if (F.t >= 1) land(F);
        break;
      }
      case 'land': if (S.phaseT >= CONFIG.settleSecs) { setPhase('stand'); if (S.down && !S.holding && !S.holdVoid) startHold(); } break;
      case 'lead': if (S.phaseT >= CONFIG.leadSecs) setPhase('stand'); break;
      case 'fall': fallStep(dt); if (S.phaseT >= CONFIG.fallSecs) dropIn(); break;
      case 'drop': {
        const k = Math.min(1, S.phaseT / CONFIG.dropSecs);
        M.y = CONFIG.dropFrom * (1 - k * k); M.pose = 'leap';
        if (k >= 1) { M.y = 0; M.pose = 'stand'; S.dust.push({ z: M.z, t: 0 }); if (!E.SIM) E.SFX.land(); setPhase('land'); }
        break;
      }
      case 'in': {
        const k = Math.min(1, S.phaseT / CONFIG.inSecs);
        M.z += (S.doorZ - M.z) * Math.min(1, dt * 8); M.alpha = 1 - k; M.pose = 'stand'; M.crouch = 0;
        if (k >= 1 && !S.inDone) { S.inDone = true; E.finish('win'); }
        break;
      }
    }
  }
  function fx(dt) {
    if (S.pan) { S.pan.t = Math.min(1, S.pan.t + dt / CONFIG.panSecs); const k = S.pan.t, e = k * k * (3 - 2 * k); S.cam.z = S.pan.from + (S.pan.to - S.pan.from) * e; if (k >= 1) S.pan = null; }
    S.floats.forEach(f => { f.t += dt; f.vy -= CONFIG.fallGravity * dt; f.y += f.vy * dt; f.z += f.vz * dt; f.rot += f.spin * dt; f.alpha = Math.max(0, 1 - Math.max(0, f.t - 0.9) / 0.5); });
    S.floats = S.floats.filter(f => f.t < 1.4);
    S.spill.forEach(k => { k.t += dt; k.vy -= CONFIG.fallGravity * dt; k.y += k.vy * dt; k.z += k.vz * dt; k.rot += k.spin * dt; });
    S.spill = S.spill.filter(k => k.t < 1.6);
    S.dust.forEach(d => d.t += dt); S.dust = S.dust.filter(d => d.t < 0.5);
    S.sparks.forEach(k => k.t += dt); S.sparks = S.sparks.filter(k => k.t < 0.45);
    S.pops.forEach(p => p.t += dt); S.pops = S.pops.filter(p => p.t < (p.big ? 1.1 : 0.7));
    if (S.ghost) { S.ghost.t += dt; if (S.ghost.t > 1.8) S.ghost = null; }
    S.orderBump = Math.max(0, S.orderBump - dt * 3); S.flash = Math.max(0, S.flash - dt * 4); S.shake = Math.max(0, S.shake - dt * 5);
  }
  function update(dt) {
    if (S.mode === 'reveal') { S.reveal += dt; if (S.reveal > CONFIG.revealSecs) S.mode = 'win'; }
    if (live()) {
      S.elapsed += dt; S.timeLeft = Math.max(0, CONFIG.roundSecs - S.elapsed); S.idle += dt;
      moveRocks(); step(dt);
      if (live() && S.timeLeft <= 0 && S.phase !== 'leap' && S.phase !== 'in') { S.holding = false; return E.finish('fail', S.falls >= 2 ? 'falls' : 'time'); }
    } else if (S.phase === 'fall') { S.phaseT += dt; fallStep(dt); }
    fx(dt);
  }
  // perfect bot: releases on the first frame the leap's landing point passes the target top's centre.
  // first-timer bot: reacts late (the first press later still), misjudges by about 22% of the distance until two clean
  // landings and about 11% after, and now and then holds to the maximum and springs on its own.
  function autopilot(dt) {
    const H = E.HUMAN || S.mode === 'attract', B = S.bot, Bc = CONFIG.bot;
    if (S.phase !== 'stand') { if (S.down && !S.holding) release(); return; }
    const T = S.rocks[S.rock + 1]; if (!T) return;
    if (B.key !== S.stand) {
      const need = T.z - S.marine.z, frac = S.clean < Bc.cleanToSettle ? Bc.errEarly : Bc.errLate;
      B.key = S.stand; B.w = 0;
      B.react = H ? rand(Bc.react[0], Bc.react[1]) + (S.jumps === 0 ? Bc.fumble : 0) : 0.05;
      B.err = H ? clamp(gauss(), -2.5, 2.5) * frac * need : 0;
      B.over = H && Math.random() < Bc.overhold;
    }
    if (!S.holding) { if (S.down) return; B.w += dt; if (B.w >= B.react) press({ x: 0.5, y: 0.8 }, 'bot'); return; }
    if (B.over) return;
    const d = leapDist(S.holdT), tz = zAt(T, S.elapsed + CONFIG.flightBase + CONFIG.flightPerUnit * Math.max(0.2, d));   // aim where a sliding rock will be
    if (d >= tz - S.marine.z + B.err) release();
  }

  window.HopToTheArchesGame = {
    CONFIG, leapDist,
    run(VIEW) {
      const C = CONFIG.copy;
      const game = {
        CONFIG, get S() { return S; }, reset, press, move, release, update, autopilot,
        simLine: () => `t=${S.elapsed.toFixed(1)} rock=${S.rock}/${S.last} picked=${S.picked} boxes=${S.boxes} falls=${S.falls} short=${S.shorts} long=${S.longs} hops=${S.hops} auto=${S.autos} why=${S.why || '-'}`,
        hud: () => {
          if (!S) return { left: `${C.rockWord} 0/${CONFIG.play.kinds.length - 1}`, right: C.orderSizes[0], hint: C.hint, dots: null };
          return { left: `${C.rockWord} ${S.rock}/${S.last}`, right: C.orderSizes[S.boxes] + (S.bonus ? ` +${S.bonus}` : ''), hint: C.hint, hintOn: S.mode === 'play' && !S.touched, dots: null,
            rock: S.rock, rocks: S.last, boxes: S.boxes, order: C.orderSizes[S.boxes] + (S.bonus ? ` +${S.bonus}` : ''), bump: S.orderBump, clock: S.timeLeft / CONFIG.roundSecs, pulse: S.timeLeft <= 3 };
        },
        stat: () => `${S.rock}/${S.last} rocks · ${C.orderSizes[S.boxes]}${S.bonus ? ` +${S.bonus}` : ''}`,
        failWhy: () => { const left = S.last - S.rock; if (S.why === 'falls') return C.failWhy.falls.replace('{f}', S.falls); return left <= 1 ? C.failWhy.one : C.failWhy.time.replace('{n}', left); },
        sounds: raw => {
          // ONE palette (owner 2026-10-29: "too many different sounds... not cohesive"): a whoosh, a thud (and its deeper crash), one
          // chime voice in C major pentatonic for every reward (nugget up the scale, the box two notes up, the win arpeggio, the fail
          // the same notes falling) and the fall whistle. No sound for the cue, the drop-in or the spill. Trims in dB from the
          // offline measurement (short-term loudness after a 150 Hz high-pass): small cues -27..-25, rewards -24..-22, stingers -21
          const TRIM = { jump: 1.5, land: 2.9, crash: 2, nugget: 0, pick: 0, whistle: 0, win: 0, fail: 0 };
          let CUR = 1;
          const sfx = { now: raw.now, tone: (f, t, d, ty, g, sl) => raw.tone(f, t, d, ty, (g || .25) * CUR, sl), noise: (t, d, g, lp) => raw.noise(t, d, (g || .3) * CUR, lp) };
          const r = (k = 0.06) => 1 + (Math.random() * 2 - 1) * k;
          const C5 = [523, 587, 659, 784, 880, 1046, 1175, 1319, 1568, 1760];   // C major pentatonic, the one key
          const chime = (f, t, g) => { sfx.tone(f, t, .22, 'triangle', g); sfx.tone(f * 2, t, .12, 'sine', g * .25); };   // the one voice
          const cues = {
            jump() {},   // one sound per hop, on the landing (owner 2026-10-29: the take-off whoosh and the thud read as a laggy double)
            land() { const t = sfx.now(); sfx.noise(t, .11, .55, 380 * r(.2)); },   // a soft, dark stone thud
            crash() { const t = sfx.now(); sfx.tone(196 * r(.04), t, .16, 'triangle', .3, -70); },   // a short low bonk: an edge is never a landing (owner 2026-10-29)
            nugget(n) { chime(C5[Math.min(C5.length - 1, 4 + (n || 0))], sfx.now(), .16); },
            pick() { const t = sfx.now(); chime(C5[3], t, .18); chime(C5[5], t + .1, .18); },
            whistle() { const t = sfx.now(), f = 1700 + Math.random() * 450; sfx.tone(f, t, 1.0, 'sine', .1, -f * .75); },
            win() { const t = sfx.now(); [0, 2, 3, 5, 7].forEach((k, i) => chime(C5[k], t + i * .1, .2)); },
            fail() { const t = sfx.now(); [5, 3, 2, 0].forEach((k, i) => chime(C5[k] / 2, t + i * .14, .2)); },
            drop() {}, lead() {}, spill() {},
          };
          // the attract loop behind the start card is silent: the first sound is the player's own (owner 2026-10-29)
          return Object.fromEntries(Object.entries(cues).map(([k, fn]) => [k, (...a) => { if (S && (S.mode === 'attract' || S.attract || S.demo)) return; CUR = Math.pow(10, (TRIM[k] || 0) / 20); fn(...a); CUR = 1; }]));
        },
        cardState(qc) {
          if (qc === 'win') { S.rock = S.last; S.boxes = 3; S.picked = 3; S.bonus = 12; S.nuggets.forEach(n => { n.taken = true; }); S.rocks.forEach(r => { r.taken = true; }); S.cam.z = S.rocks[S.last].z; S.marine.z = S.doorZ; S.marine.alpha = 0; S.phase = 'in'; S.reveal = CONFIG.revealSecs; S.mode = 'win'; }
          else { S.why = 'time'; S.rock = S.last - 1; S.boxes = 1; S.picked = 2; S.lost = 1; S.falls = 1; S.cam.z = S.rocks[S.rock].z; S.marine.z = S.rocks[S.rock].z; S.mode = 'fail'; }
        },
        winDelayMs: 1000, failDelayMs: 900,   // the words follow the hero's rise (owner 2026-10-29: the card came in late)
      };
      E = window.ENGINE; E.run(game, VIEW);
    },
  };
})();