/* Zone Dash — shared game core for every greybox variant (rules, CONFIG, course, state, input, renderer, HUD, cards,
   bots, sim, layer contract). A variant supplies a VIEW: its camera (horizon, focal, height, distance behind) and title;
   the layers, the road and the objects are drawn here from the same constants, so the blueprints match the game.
   Hooks: ?bot (autopilot plays a real round) · ?sim (20 instant rounds, ?n=60) · ?sim&human (first-timer bot)
          ?attract (plays itself) · ?blueprint=Lx · ?explained=Lx · ?geometry · ?card=win|fail
   window.GAME = { S, CONFIG, reset, swipe }
   The rule (the card, Sonic's own): the runner runs away from you down three lanes through three zones, faster at every
   boost ring. Swipe left / right to change lane. Rings are the shield: hit a hazard carrying rings and they scatter (you
   keep running, slower for a moment); hit one carrying none and it is GAME OVER. Reach the finish gate. */
(function () {
  const Q = new URLSearchParams(location.search);
  const has = k => Q.has(k);
  const CONFIG = {
    ctaUrl: 'https://www.paramountmovies.com/',  // placeholder until the client names the ticket door; window.clickTag overrides
    speeds: [26, 32, 38],          // m/s per zone (the runner is ~1 m tall; lanes 1.6 m)
    zoneSecs: [6.2, 6.2, 6.2],     // seconds of running per zone at full speed: ~20 s with the lead-in
    leadIn: 1.0,                   // a straight stretch with a ring line before anything can hurt (rule 16)
    gateLead: 1.1,                 // seconds after each boost ring before the first hazard of the new zone (rule 16)
    rowGap: [1.1, 0.85, 0.66],     // seconds between hazard rows, by zone (rule 18: generous first)
    twoLane: [0.2, 0.6, 0.8],     // chance a row blocks two lanes, by zone
    maxShift: [2, 2, 1],           // when a row blocks two lanes, how far its free lane may sit from the last row's free lane
    rollerShare: [0, 0, 0.6],      // share of two-lane rows that are one spiked roller across both lanes (zone 3)
    startRings: 6, ringLine: 5, ringGap: 3.2, ringChance: [0.7, 0.42, 0.32],
    greedLine: [0.2, 0.35, 0.5],   // chance a ring line runs into a lane the NEXT row blocks (the rich lane brushes the spikes)
    laneSecs: 0.13,                // time to cross one lane
    hitSlow: 0.6, recover: 1.4, mercy: 1.0, // a hit keeps 60% speed, recovers in 1.4 s; 1 s of flicker after a spill
    hitHalf: 0.42,                 // lane overlap that counts as a hit (lane units)
    drawDist: 150, segLen: 2,
    curve: { a: 2.2, l: 70 }, hill: { a: 0.9, l: 55 },   // gentle sway and swell of the course (metres)
    idleToAttract: 3, readySecs: 1.5,   // READY · SET · GO! before the run starts (owner 16:25, 16:28: the expected countdown)
    humanLook: 0.8, humanReact: [0.36, 0.62],   // the first-timer bot: sees a row this far ahead (s), reacts this much later
    copy: {
      brand: 'SONIC 4 · LOGO', hint: 'Swipe to change lane', leadInHint: 'Grab the rings',
      cueSpill: 'Rings lost! No rings = next hit ends it', cueRoller: 'Two lanes blocked: find the gap',
      zones: ['JUNGLE', 'ZONE 2 · FASTER', 'ZONE 3 · FASTER'], zoneNames: ['Jungle', 'Checkered hills', 'Desert ruins'],
      startTitle: 'Three zones. One run.', startLine: 'Swipe left and right. Grab rings, dodge spikes.', play: 'Run',
      winStamp: 'FINISH', winTitle: 'In cinemas 19 March 2027', winLine: 'The fastest hero is back.', cta: 'Get tickets',
      failStamp: 'GAME OVER', failLine: 'Rings are your shield. Run again?',
      failWhy: { norings: 'Hit with no rings.', time: 'Out of time.' },
      again: 'Run again', rings: 'rings',
      swipeWord: 'SWIPE', howLine: 'Grab rings · Dodge spikes', press: 'TAP TO RUN', dateBand: 'IN CINEMAS 19 MARCH 2027', clear: 'COURSE CLEAR!', tTime: 'TIME', tRings: 'RINGS', tTotal: 'TOTAL', over1: 'GAME', over2: 'OVER',
    },
  };
  const BOT = has('bot') || has('attract'), HUMANBOT = has('human'), SIM = has('sim'), ATTRACT = has('attract');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  let G = null;   // the view's camera geometry

  // ── the course ─────────────────────────────────────────
  // world: z metres along the course from the start; x metres across (lane centre = lane * laneW); y metres up.
  const roadX = z => CONFIG.curve.a * Math.sin(z / CONFIG.curve.l) * Math.min(1, z / 60);
  const roadY = z => CONFIG.hill.a * Math.sin(z / CONFIG.hill.l + 1) * Math.min(1, z / 60);
  function buildCourse() {
    const C = CONFIG, zones = []; let z = 0;
    for (let i = 0; i < 3; i++) { const len = C.speeds[i] * C.zoneSecs[i] + (i === 0 ? C.speeds[0] * C.leadIn : 0); zones.push({ i, start: z, end: z + len }); z += len; }
    const rows = [], rings = [], props = [];
    let prevFree = [0];
    zones.forEach(Z => {
      const v = C.speeds[Z.i]; let rz = Z.start + v * (Z.i === 0 ? C.leadIn + 0.9 : C.gateLead);
      while (rz < Z.end - v * 0.6) {
        let lanes;
        if (Math.random() < C.twoLane[Z.i]) {   // two blocked: the free lane is within maxShift of a free lane of the last row
          const cand = [-1, 0, 1].filter(f => prevFree.some(p => Math.abs(p - f) <= C.maxShift[Z.i]));
          const free = pick(cand); lanes = [-1, 0, 1].filter(l => l !== free);
        } else lanes = [pick([-1, 0, 1])];
        const roller = lanes.length === 2 && Math.abs(lanes[0] - lanes[1]) === 1 && Math.random() < C.rollerShare[Z.i];
        const kinds = roller ? ['roller'] : lanes.map(() => pick(['spikes', 'spikes', 'boulder']));
        rows.push({ z: rz, zone: Z.i, lanes, kinds, roller, free: [-1, 0, 1].filter(l => !lanes.includes(l)) });
        prevFree = rows[rows.length - 1].free;
        rz += v * C.rowGap[Z.i] * rand(0.92, 1.15);
      }
    });
    // the start line of rings: straight down the middle lane, before anything can hurt
    for (let i = 0; i < C.startRings; i++) rings.push({ z: CONFIG.speeds[0] * 0.35 + i * C.ringGap, lane: 0 });
    // ring lines between rows: in a lane free at the row behind, usually also free at the next row; sometimes not (greed)
    rows.forEach((r, i) => {
      const next = rows[i + 1]; if (!next || Math.random() > C.ringChance[r.zone]) return;
      const greedy = Math.random() < C.greedLine[r.zone];
      let opts = r.free.filter(l => greedy ? next.lanes.includes(l) : !next.lanes.includes(l)); if (!opts.length) opts = r.free;
      const lane = pick(opts), z0 = r.z + (next.z - r.z) * 0.22;
      for (let k = 0; k < C.ringLine; k++) { const zz = z0 + k * C.ringGap; if (zz < next.z - 2) rings.push({ z: zz, lane }); }
    });
    // roadside props: alternate sides every ~11 m, the zone's three kinds
    for (let pz = 8; pz < z + 200; pz += rand(8, 14)) { const zi = pz < zones[1].start ? 0 : pz < zones[2].start ? 1 : 2; props.push({ z: pz, side: Math.random() < .5 ? -1 : 1, cell: zi * 3 + Math.floor(Math.random() * 3), off: rand(1.0, 3.5), zone: zi }); }
    return { zones, rows, rings, props, length: z };
  }

  let S;
  function reset(mode) {
    const course = buildCourse();
    S = { mode, elapsed: 0, z: 0, v: CONFIG.speeds[0], vTarget: CONFIG.speeds[0], zone: 0, lane: 0, laneX: 0, rings: 0, ringsTotal: 0, spills: 0,
      course, mercy: 0, trail: [], scatter: [], pops: [], flash: 0, red: 0, shake: 0, boost: 0, banner: null, why: null, reveal: 0, tumble: 0,
      idle: 0, cue: null, seen: {}, bot: { nextAt: 0, wrongUntil: 0 }, swiped: false };
  }
  const zoneAt = z => { const Z = S.course.zones; return z < Z[1].start ? 0 : z < Z[2].start ? 1 : 2; };

  // ── input: one control, the swipe ──────────────────────
  function swipe(dir, src) {
    if (S.mode !== 'play' && S.mode !== 'attract') return;
    S.lane = clamp(S.lane + dir, -1, 1); S.swiped = true; S.idle = 0; if (src === 'user') SFX.unlock();   // no lane-change sound (owner 16:31)
  }
  function hit(row) {
    if (S.mercy > 0) return;
    if (S.rings > 0) {   // the shield: the rings scatter, the run goes on, slower for a moment
      const n = Math.min(S.rings, 14); for (let i = 0; i < n; i++) S.scatter.push({ a: rand(-2.6, -0.5), sp: rand(0.35, 0.8), t: 0, life: rand(.7, 1.1) });
      S.rings = 0; S.spills++; S.mercy = CONFIG.mercy; S.v *= CONFIG.hitSlow; S.red = 1; S.shake = .8; if (!SIM) SFX.spill();
      S.pops.push({ t: 0, txt: 'RINGS LOST', big: true, bad: true });
      if (!S.seen.spill) { S.seen.spill = true; S.cue = { text: CONFIG.copy.cueSpill, until: S.elapsed + 2.2 }; }
    } else finish('fail', 'norings');
  }
  function finish(result, why) {
    if (S.mode === 'attract') { reset('attract'); return; }   // the splash loop never ends on a card
    S.mode = result === 'win' ? 'reveal' : 'fail'; S.why = why || null; S.reveal = 0;
    if (!SIM) { SFX.music(false); if (result === 'win') { SFX.win(); hideHud(true); setTimeout(() => showCard('win'), 1700); } else { SFX.fail(); hideHud(true); setTimeout(() => showCard('fail'), 900); } }
  }
  function update(dt) {
    S.clock = (S.clock || 0) + dt;
    if (S.mode === 'ready') { S.readyT = (S.readyT || 0) + dt; if (S.readyT >= CONFIG.readySecs) { S.mode = 'play'; if (!SIM) { SFX.boost(); SFX.music(true); SFX.duck(false); } S.boost = .6; S.dust = Array.from({ length: 14 }, () => ({ a: rand(-3.1, 0), v: rand(.4, 1), t: 0, life: rand(.4, .7), r: rand(.03, .07) })); } return; }
    const C = CONFIG;
    if (S.mode === 'reveal') { S.reveal += dt; S.v = Math.max(8, S.v - dt * 14); S.z += S.v * dt; if (S.reveal > 1.6) S.mode = 'win'; }
    if (S.mode === 'fail') { S.tumble += dt; S.v = Math.max(0, S.v - dt * 40); S.z += S.v * dt; }
    if (S.mode === 'play' || S.mode === 'attract') {
      S.elapsed += dt; S.idle += dt;
      const z0 = S.z, zi = zoneAt(S.z);
      if (zi !== S.zone) { S.zone = zi; S.boost = 1; S.vTarget = C.speeds[zi]; if (!SIM) SFX.boost(); }
      // the banner for the next zone shows ~1 s before its boost ring (rule 16)
      const nextZ = S.course.zones[S.zone + 1]; if (nextZ && nextZ.start - S.z < S.v * 1.0 && S.banner !== S.zone + 1) { S.banner = S.zone + 1; S.bannerT = 0; }
      if (S.v < S.vTarget) S.v = Math.min(S.vTarget, S.v + dt * S.vTarget * (1 - C.hitSlow) / C.recover * (S.boost > 0 ? 3 : 1));
      S.z += S.v * dt;
      // lane: the runner slides toward the swiped lane
      const d = S.lane - S.laneX, step = dt / C.laneSecs; S.laneX = Math.abs(d) <= step ? S.lane : S.laneX + Math.sign(d) * step;
      S.mercy = Math.max(0, S.mercy - dt);
      // rings collected as they pass
      S.course.rings.forEach(r => { if (!r.got && r.z > z0 - 0.5 && r.z <= S.z + 0.3 && Math.abs(r.lane - S.laneX) < 0.5) { r.got = true; S.rings++; S.ringsTotal++; if (!SIM) SFX.ring(); } });
      // hazards: a row hits if the runner's lane overlaps one of its blocked lanes as it passes
      for (const row of S.course.rows) { if (row.done || row.z > S.z) continue; if (row.z < z0 - 1) { row.done = true; continue; } row.done = true;
        if (row.lanes.some(l => Math.abs(l - S.laneX) < C.hitHalf)) { hit(row); if (S.mode !== 'play' && S.mode !== 'attract') return; } }
      if (!S.seen.roller) { const r = S.course.rows.find(r => r.roller && r.z - S.z < S.v * 1.1 && r.z > S.z); if (r) { S.seen.roller = true; S.cue = { text: C.copy.cueRoller, until: S.elapsed + 1.6 }; } }
      if (S.z >= S.course.length) return finish('win');
      if (S.elapsed > 40) return finish('fail', 'time');   // no dead state
    }
    S.trail.push({ x: roadX(S.z) + S.laneX * G.laneW, z: S.z }); S.trail = S.trail.filter(p => S.z - p.z < G.camBack + 2);
    S.scatter.forEach(p => p.t += dt); S.scatter = S.scatter.filter(p => p.t < p.life);
    if (S.dust) { S.dust.forEach(p => p.t += dt); S.dust = S.dust.filter(p => p.t < p.life); }
    S.flash = Math.max(0, S.flash - dt * 4); S.red = Math.max(0, S.red - dt * 2.5); S.shake = Math.max(0, S.shake - dt * 5); S.boost = Math.max(0, S.boost - dt * 0.8);
    if (S.banner != null) S.bannerT = (S.bannerT || 0) + dt;
    S.pops.forEach(p => p.t += dt); S.pops = S.pops.filter(p => p.t < 1.1);
  }

  // ── autopilot ───────────────────────────────────────────
  // perfect bot: sees every row within 1.3 s, takes the nearest free lane of the next row (ties: the one also free in the row
  // after, then the one with rings), swipes one lane at a time with no delay; grabs rings only when the lane stays safe.
  // First-timer bot: sees a row only when it is 1.05 s away and reacts 0.28-0.5 s later, swipes the wrong way 6% of the time
  // (corrects 0.3 s later), chases a ring line into a lane without checking the next row 35% of the time, fumbles the first 0.6 s.
  function autopilot(dt) {
    const B = S.bot, C = CONFIG, v = S.v, HUMAN = HUMANBOT || S.mode === 'attract';   // the attract loop plays as a first-timer: it shows the spill and the fail (rule 8)
    if (HUMAN && S.elapsed < 0.6) return;
    if (S.elapsed < B.nextAt) return;
    const look = HUMAN ? (G.humanLook || C.humanLook) : 1.3;   // the view sets how early a first-timer sees a row (the low camera hides it longer)
    const ahead = S.course.rows.filter(r => !r.done && r.z > S.z && r.z - S.z < v * look);
    let rows = ahead;
    if (HUMAN) rows = ahead.filter(r => { if (r.seenAt == null) { r.seenAt = S.elapsed; r.react = rand(C.humanReact[0], C.humanReact[1]); } return S.elapsed - r.seenAt >= r.react; });
    let want = S.lane;
    const r0 = rows[0], r1 = rows[1];
    const ringLaneAhead = () => { const rs = S.course.rings.filter(r => !r.got && r.z > S.z && r.z - S.z < v * 0.9); return rs.length ? rs[0].lane : null; };
    if (r0) {
      if (r0.lanes.includes(want) || (r0.lanes.some(l => Math.abs(l - S.laneX) < .6) && r0.free.indexOf(want) < 0)) {
        let opts = r0.free.slice().sort((a, b) => Math.abs(a - S.lane) - Math.abs(b - S.lane));
        if (!HUMAN && r1) opts.sort((a, b) => (r1.lanes.includes(a) ? 1 : 0) - (r1.lanes.includes(b) ? 1 : 0) || Math.abs(a - S.lane) - Math.abs(b - S.lane));
        want = opts[0];
      } else if (!HUMAN && r1 && r1.lanes.includes(want)) {
        const opts = r0.free.filter(l => !r1.lanes.includes(l)).sort((a, b) => Math.abs(a - S.lane) - Math.abs(b - S.lane)); if (opts.length) want = opts[0];
      }
    }
    const rl = ringLaneAhead();
    if (rl != null && rl !== want) {
      const safe = !r0 || (!r0.lanes.includes(rl) && (HUMAN || !r1 || !r1.lanes.includes(rl)));
      const timeToRow = r0 ? (r0.z - S.z) / v : 9;
      if (HUMAN ? (Math.random() < 0.35 * dt * 6 && (!r0 || timeToRow > 0.5)) : (safe && timeToRow > 0.45)) want = rl;
    }
    if (want !== S.lane) {
      let dir = Math.sign(want - S.lane);
      if (HUMAN && Math.random() < 0.08) { dir = -dir; B.wrongUntil = S.elapsed + 0.3; }
      if (S.lane + dir >= -1 && S.lane + dir <= 1) swipe(dir, 'bot');
      B.nextAt = S.elapsed + (HUMAN ? (S.elapsed < B.wrongUntil ? 0.3 : rand(0.12, 0.22)) : 0.06);
    }
  }
  // ── sim ─────────────────────────────────────────────────
  function runSim() {
    const out = [], N = +(Q.get('n') || 20);
    for (let r = 0; r < N; r++) {
      reset('play'); let n = 0;
      while (S.mode === 'play') { autopilot(1 / 60); update(1 / 60); if (++n > 60 * 45) break; }
      out.push(`${S.mode === 'reveal' || S.mode === 'win' ? 'win ' : 'fail'} t=${S.elapsed.toFixed(1)} zone=${S.zone + 1} rings=${S.ringsTotal} spills=${S.spills} why=${S.why || '-'}`);
    }
    const wins = out.filter(l => l.startsWith('win')).length;
    document.title = 'SIM'; document.body.innerHTML = `<pre id="sim">${HUMANBOT ? 'human bot' : 'perfect bot'}: ${wins}/${N} wins\n${out.join('\n')}</pre>`;
    throw new Error('sim done');
  }

  // ── the camera and the renderer (shared by every view) ──
  // proj: world → screen. The view sets hz (horizon, frame heights), k (focal, frame widths per metre at 1 m), camH (m above
  // the runner's ground), camBack (m behind the runner), follow (how much the camera follows the runner across the lanes).
  function camera(Sx) { const rk = Sx.mode === 'ready' ? Math.min(1, (Sx.readyT || 0) / CONFIG.readySecs) : 1, back = G.camBack + 2.4 * Math.pow(1 - rk, 2), z = Sx.z - back; return { z, x: roadX(Sx.z) + Sx.laneX * G.laneW * G.follow, y: roadY(Sx.z) + G.camH }; }
  function proj(cam, x, y, z, W, H) { const dz = z - cam.z; if (dz < 0.3) return null; const s = G.k / dz; return { x: W * (0.5 + (x - cam.x) * s), y: H * G.hz + W * (cam.y - y) * s, s: s * W }; }
  const ZC = [   // greybox zone tints: grey with a hint of each zone's hue, so the three zones read apart
    { sky: ['#b9c7c0', '#e3e9e4'], ground: ['#7d8a7c', '#738070'], road: ['#9a8f84', '#8f857a'], edge: ['#5c6a5a', '#6a7868'] },
    { sky: ['#b5cbd8', '#e6eef3'], ground: ['#8fae86', '#86a47d'], road: ['#a49a8c', '#9a9083'], edge: ['#8a6a52', '#6d5240'] },
    { sky: ['#d6c6b0', '#f1e8dc'], ground: ['#c9b08e', '#bfa684'], road: ['#b8ad9d', '#ada292'], edge: ['#9a7a5a', '#86684b'] },
  ];
  const SP = {};
  function stripPattern(ctx, id, zi) {   // one zone's strip of a three-strip tile as a repeating pattern, made once
    const k = id + zi; if (SP[k] !== undefined) return SP[k];
    const im = LAYERS.ART[id]; if (!im) return null;
    const w = Math.floor(im.width / 3), h = im.height, c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(im, zi * w, 0, w, h, 0, 0, w, h);
    return (SP[k] = { p: ctx.createPattern(c, 'repeat'), w, h });
  }
  const GP = {};
  function groundPattern(ctx, zi) {   // the zone's ground strip as a repeating pattern, made once
    if (GP[zi] !== undefined) return GP[zi];
    const im = LAYERS.ART.L3b; if (!im) return null;
    const w = Math.floor(im.width / 3), h = im.height, c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(im, zi * w, 0, w, h, 0, 0, w, h);
    return (GP[zi] = { p: ctx.createPattern(c, 'repeat'), w, h });
  }
  const GC = {};
  function groundOf(zi) {
    if (GC[zi]) return GC[zi];
    const im = LAYERS.ART[['L1a', 'L1b', 'L1c'][zi]]; if (!im) return ZC[zi];
    try { const c = document.createElement('canvas'); c.width = c.height = 8; const x = c.getContext('2d'); x.drawImage(im, im.width * .3, im.height * .5, im.width * .4, im.height * .06, 0, 0, 8, 8); const d = x.getImageData(0, 0, 8, 8).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } const n = d.length / 4; r /= n; g /= n; b /= n;
      const col = k => `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`; GC[zi] = { ground: [col(1), col(.93)], edge: [col(.62), col(.55)], road: ZC[zi].road }; } catch (e) { GC[zi] = ZC[zi]; }
    return GC[zi];
  }
  function render(ctx, Sx, W, H, VIEW) {
    const C = CONFIG, cam = camera(Sx), L = id => VIEW.layers.find(l => l.id === id), zi = zoneAt(Sx.z);
    // backdrop: the zone's plate, drifting a little with the curve
    const drift = -roadX(Sx.z + 40) * 0.012;
    LAYERS.draw(ctx, L(['L1a', 'L1b', 'L1c'][zi]), Sx, W, H, { box: { ...G.boxes.backdrop, x: G.boxes.backdrop.x + drift } });
    // road: segments far → near
    const seg = C.segLen, zStart = Math.floor(cam.z / seg) * seg, pts = [];
    for (let z = zStart + Math.ceil(C.drawDist / seg) * seg; z > cam.z + 0.6;) { const p = proj(cam, roadX(z), roadY(z), z, W, H); if (p) pts.push({ z, ...p }); const dz = z - cam.z; z -= dz < 18 ? 1 : dz < 45 ? 2 : 4; }   // finer near the camera: the texture stays a trapezoid, not a staircase
    const tile = LAYERS.ART.L3, tileLen = tile ? G.roadHalf * 2 * (tile.height / (tile.width / 3)) : 24;   // the strip keeps its aspect on the road
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1]; const zz = zoneAt(a.z), T = groundOf(zz), band = Math.floor(a.z / 6) % 2;
      if (b.y <= a.y) continue;
      const gpat = groundPattern(ctx, zz);
      if (gpat) { const ppm = (a.s + b.s) / 2, GW = 8, gl = GW * gpat.h / gpat.w, sx = ppm * GW / gpat.w, sy2 = (b.y - a.y) / ((a.z - b.z) / gl * gpat.h), r0 = (1 - (((a.z % gl) + gl) % gl) / gl) * gpat.h;
        gpat.p.setTransform(new DOMMatrix([sx, 0, 0, sy2, (a.x + b.x) / 2, a.y - r0 * sy2])); ctx.fillStyle = gpat.p; ctx.fillRect(0, a.y, W, b.y - a.y + 1);
        }
      else { ctx.fillStyle = T.ground[band]; ctx.fillRect(0, a.y, W, b.y - a.y + 1); }
      const ha = G.roadHalf * a.s, hb = G.roadHalf * b.s, ea = ha * 1.12, eb = hb * 1.12;
      const rp = tile ? stripPattern(ctx, 'L3', zz) : null;
      if (rp) {   // the road strip as a pattern scaled to this depth: one path fill per segment, no clipping
        const ppm = (a.s + b.s) / 2, sx = ppm * G.roadHalf * 2 / rp.w, sy2 = (b.y - a.y) / ((a.z - b.z) / tileLen * rp.h), r0 = (1 - (((a.z % tileLen) + tileLen) % tileLen) / tileLen) * rp.h;
        rp.p.setTransform(new DOMMatrix([sx, 0, 0, sy2, (a.x + b.x) / 2 - G.roadHalf * ppm, a.y - r0 * sy2])); ctx.fillStyle = rp.p;
        ctx.beginPath(); ctx.moveTo(a.x - ha, a.y - .5); ctx.lineTo(a.x + ha, a.y - .5); ctx.lineTo(b.x + hb, b.y + .5); ctx.lineTo(b.x - hb, b.y + .5); ctx.closePath(); ctx.fill();
      } else quad(ctx, a.x - ha, a.y, a.x + ha, b.x + hb, b.y, b.x - hb, T.road[band]);
      ctx.save(); ctx.lineCap = 'round'; ctx.strokeStyle = 'rgba(30,20,10,.22)'; ctx.lineWidth = Math.max(1, .14 * (a.s + b.s) / 2);   // the verge: one continuous soft line where the road meets the ground (no stepped bands)
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(a.x + sd * ha * 1.02, a.y); ctx.lineTo(b.x + sd * hb * 1.02, b.y); ctx.stroke(); }
      ctx.restore();
      if (Math.floor(a.z / 3) % 2 === 0) for (const lx of [-0.5, 0.5]) { const wa = 0.05 * a.s, wb = 0.05 * b.s, xa = a.x + lx * G.laneW * a.s, xb = b.x + lx * G.laneW * b.s; quad(ctx, xa - wa, a.y, xa + wa, xb + wb, b.y, xb - wb, 'rgba(255,255,255,.55)'); }
    }
    // objects far → near: props, hazards, rings, the boost rings, the finish gate, the runner
    const objs = [];
    Sx.course.props.forEach(p => { if (p.z > cam.z + 1 && p.z - cam.z < C.drawDist) objs.push({ z: p.z, k: 'prop', p }); });
    Sx.course.rows.forEach(r => { if (r.z > cam.z + 1 && r.z - cam.z < C.drawDist) objs.push({ z: r.z, k: 'row', r }); });
    Sx.course.rings.forEach(r => { if (!r.got && r.z > cam.z + 1 && r.z - cam.z < C.drawDist * .7) objs.push({ z: r.z, k: 'ring', r }); });
    Sx.course.zones.slice(1).forEach(Z => { if (Z.start > cam.z + 1 && Z.start - cam.z < C.drawDist) objs.push({ z: Z.start, k: 'gate' }); });
    if (Sx.course.length - cam.z < C.drawDist && Sx.course.length > cam.z + 1) objs.push({ z: Sx.course.length, k: 'finish' });
    objs.push({ z: Sx.z, k: 'runner' });
    objs.sort((a, b) => b.z - a.z);
    for (const o of objs) {
      if (o.k === 'prop') { const p = o.p, x = roadX(p.z) + p.side * (G.roadHalf * 1.12 + p.off + 1.2), q = proj(cam, x, roadY(p.z), p.z, W, H); if (!q) continue; const h = G.propH * q.s; drawGrounded(ctx, L('L2'), p.cell, q.x, q.y, h, h, Sx, W, H); }
      else if (o.k === 'row') { const r = o.r;
        if (r.roller) { const lx = (r.lanes[0] + r.lanes[1]) / 2, q = proj(cam, roadX(r.z) + lx * G.laneW, roadY(r.z), r.z, W, H); if (!q) continue; const w = G.laneW * 2 * q.s * 0.98; drawGrounded(ctx, L('L6'), 0, q.x, q.y, w, w * 0.5, Sx, W, H); }
        else r.lanes.forEach((l, j) => { const q = proj(cam, roadX(r.z) + l * G.laneW, roadY(r.z), r.z, W, H); if (!q) return; const w = G.laneW * q.s * 0.92; drawGrounded(ctx, L('L5'), r.kinds[j] === 'boulder' ? 1 : 0, q.x, q.y, w, w, Sx, W, H); }); }
      else if (o.k === 'ring') { const r = o.r, q = proj(cam, roadX(r.z) + r.lane * G.laneW, roadY(r.z) + 0.55, r.z, W, H); if (!q) continue; const gq = proj(cam, roadX(r.z) + r.lane * G.laneW, roadY(r.z), r.z, W, H); if (gq) shadowAt(ctx, gq.x, gq.y, 0.5 * gq.s, .5); goldRing(ctx, q.x, q.y, 0.3 * q.s, Math.cos((Sx.clock || 0) * 2.6 + r.z * .35)); }
      else if (o.k === 'gate') { const q = proj(cam, roadX(o.z), roadY(o.z) + 2.4, o.z, W, H); if (!q) continue; goldRing(ctx, q.x, q.y, 2.3 * q.s, 1, true); }
      else if (o.k === 'finish') { const q = proj(cam, roadX(o.z), roadY(o.z), o.z, W, H); if (!q) continue; const w = G.roadHalf * 2.6 * q.s; drawGrounded(ctx, L('L7'), 0, q.x, q.y, w, w, Sx, W, H); finishWord(ctx, q.x, q.y, w); }   // the word is code (no text in pictures), set on the banner measured in the picture
      else if (o.k === 'runner') drawRunner(ctx, Sx, cam, W, H, L('L4'));
    }
    lightPass(ctx, Sx, W, H, zi);
    // speed lines on a boost; red flash on a spill
    if (Sx.boost > 0 || Sx.mode === 'reveal') { ctx.save(); ctx.globalAlpha = Math.max(Sx.boost, Sx.mode === 'reveal' ? .6 : 0) * .55; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283 + Sx.z * 0.07, r0 = W * (0.42 + ((i * 37) % 10) / 40), r1 = r0 + W * 0.18; ctx.beginPath(); ctx.moveTo(W / 2 + Math.cos(a) * r0, H * G.hz + Math.sin(a) * r0); ctx.lineTo(W / 2 + Math.cos(a) * r1, H * G.hz + Math.sin(a) * r1); ctx.stroke(); } ctx.restore(); }
    if (Sx.red > 0) { ctx.save(); ctx.globalAlpha = Sx.red * .25; ctx.fillStyle = '#d8232f'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
    if (Sx.mode === 'ready') { const t = Sx.readyT || 0, beat = CONFIG.readySecs / 3, n = Math.min(2, Math.floor(t / beat)), k = (t - n * beat) / beat;
      const word = ['READY', 'SET', 'GO!'][n], go = n === 2, x = n === 0 ? W / 2 + (1 - Math.min(1, k * 3.2)) * W : W / 2, sc = n === 1 ? 1 + .25 * Math.max(0, 1 - k * 4) : go ? 1 + .35 * Math.min(1, k * 2.2) : 1, a = go ? Math.min(1, (1 - k) * 2.5) : 1;
      ctx.save(); ctx.globalAlpha = Math.max(0, a); ctx.translate(x, H * .52); ctx.scale(sc, sc); ctx.transform(1, 0, -.15, 1, 0, 0); ctx.font = `${Math.round(W * (go ? .2 : .14))}px 'Lilita One', Inter, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = W * .022; ctx.strokeStyle = '#0a1a55'; ctx.strokeText(word, 0, W * .012); ctx.strokeText(word, 0, 0); ctx.fillStyle = go ? '#ffd21a' : '#fff'; ctx.fillText(word, 0, 0); ctx.restore();
      if (!SIM && n !== Sx.readyBeat) { Sx.readyBeat = n; SFX.beep(go); } }
    if (Sx.banner != null && Sx.bannerT < 1.8 && (Sx.mode === 'play' || Sx.mode === 'attract')) { const k = Sx.bannerT, a = k < .2 ? k / .2 : k > 1.4 ? (1.8 - k) / .4 : 1; ctx.save(); ctx.globalAlpha = a; ctx.font = `italic 900 ${Math.round(W * .085)}px Inter, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineWidth = W * .012; ctx.strokeStyle = '#13233d'; ctx.strokeText(CONFIG.copy.zones[Sx.banner], W / 2, H * .3); ctx.fillStyle = '#ffd23a'; ctx.fillText(CONFIG.copy.zones[Sx.banner], W / 2, H * .3); ctx.restore(); }
    if (Sx.mode !== 'attract') GB.pops(ctx, Sx, W / 2, H * G.feet - G.runnerH * runnerScale(Sx, cam, W, H) * 1.1);
  }
  // ── lighting (code, rule 11 + rule 25): no shadowBlur, no filters: cached sprites and cached full-screen layers ──
  let SHADOW = null, PUFF = null;
  function shadowAt(ctx, x, y, w, a = 1) {
    if (!SHADOW) { SHADOW = document.createElement('canvas'); SHADOW.width = 128; SHADOW.height = 64; const c = SHADOW.getContext('2d'); c.translate(64, 32); c.scale(1, .5); const g = c.createRadialGradient(0, 0, 0, 0, 0, 62); g.addColorStop(0, 'rgba(10,8,20,.7)'); g.addColorStop(.55, 'rgba(10,8,20,.4)'); g.addColorStop(1, 'rgba(10,8,20,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 62, 0, 7); c.fill(); }
    if (w < 2) return; ctx.save(); ctx.globalAlpha = a; ctx.drawImage(SHADOW, x - w / 2, y - w * .06, w, w * .12); ctx.restore();   // centred under the base
  }
  // a shadow in the object's own shape: its silhouette (cached once per picture and cell, blurred once offscreen), laid on the
  // ground behind it, flattened and thrown to the right, away from the light in the upper left; plus a small dark contact patch
  const SIL = {};
  function silhouette(L, cell) {
    const im = LAYERS.ART[L.id], k = `${L.id}:${cell}`; if (!im) return null; if (SIL[k]) return SIL[k];
    let sx = 0, sy = 0, sw = im.width, sh = im.height; if (L.cells) { sw = im.width / L.cells.cols; sh = im.height / L.cells.rows; sx = (cell % L.cells.cols) * sw; sy = Math.floor(cell / L.cells.cols) * sh; }
    const P = 4, sc = Math.min(1, 160 / Math.max(sw, sh)), iw = Math.round(sw * sc), ih = Math.round(sh * sc), c = document.createElement('canvas'); c.width = iw + 2 * P; c.height = ih + 2 * P; const x = c.getContext('2d');
    x.filter = 'blur(1.5px)'; x.drawImage(im, sx, sy, sw, sh, P, P, iw, ih); x.filter = 'none'; x.globalCompositeOperation = 'source-in';
    const g = x.createLinearGradient(0, P + ih, 0, P); g.addColorStop(0, 'rgba(12,10,24,1)'); g.addColorStop(.5, 'rgba(12,10,24,.6)'); g.addColorStop(1, 'rgba(12,10,24,.25)');   // darkest at the base, fading toward the far end
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    return (SIL[k] = { c, P, iw, ih });
  }
  // every grounded sprite goes through here (rule 26): its base sits SINK of its height below the ground line and is clipped there,
  // so no anti-aliased gap or transparent margin can ever show under it; then its shadow from the same base
  const SINK = .025;
  function drawGrounded(ctx, L, cell, x, y, w, h, Sx, W, H) {
    castShadow(ctx, L, cell, x, y, w, h);
    ctx.save(); ctx.beginPath(); ctx.rect(x - w, y - h * 2, w * 2, h * 2); ctx.clip();
    LAYERS.draw(ctx, L, Sx, W, H, { box: { x: x / W, y: (y + h * SINK) / H, w: w / W, h: h / H, anchor: 'bottom' }, cell }); ctx.restore();
  }
  function castShadow(ctx, L, cell, x, y, w, h, lift = 0) {
    const near = Math.min(1, Math.max(0, (w / ctx.canvas.clientWidth - .015) / .08)); if (near <= 0) return;   // by on-screen size: gone when tiny, full from ~10% of the frame
    const sil = silhouette(L, cell); if (!sil || w < 3) { shadowAt(ctx, x, y, w * .6); return; }
    const s = w / sil.iw;   // the same scale the picture is drawn at: the shadow's base edges are the object's base edges
    ctx.save(); ctx.globalAlpha = Math.max(.12, .5 - lift / h) * near; ctx.translate(x, y); ctx.transform(1, 0, -0.3 * near, -0.13 * near - .02, 0, 0);   // laid on the ground toward the camera, a little right; y = 0 is the base, so the base never moves
    ctx.drawImage(sil.c, -w / 2 - sil.P * s, -h - sil.P * s, sil.c.width * s, sil.c.height * s); ctx.restore();
    shadowAt(ctx, x, y, w * .3, .35 * near);   // a thin contact line where it touches the ground
  }
  const LIGHT = { key: '', zones: {} };
  const ZLIGHT = [   // per zone: the light colour, its strength, haze strength, shafts
    { light: '255,236,170', a: .30, haze: .55, shafts: true, shade: .30 },
    { light: '255,248,220', a: .22, haze: .45, shafts: false, shade: .18 },
    { light: '255,214,140', a: .34, haze: .60, shafts: false, shade: .22 },
  ];
  function hazeOf(zi) {   // the colour of the backdrop just above its horizon: distant things fade into it
    const im = LAYERS.ART[['L1a', 'L1b', 'L1c'][zi]]; if (!im) return '200,210,215';
    try { const c = document.createElement('canvas'); c.width = c.height = 4; const x = c.getContext('2d'); x.drawImage(im, im.width * .25, im.height * (G.hz - .05), im.width * .5, im.height * .04, 0, 0, 4, 4); const d = x.getImageData(0, 0, 4, 4).data; let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; } const n = d.length / 4; return `${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)}`; } catch (e) { return '200,210,215'; }
  }
  function lightLayers(W, H, zi) {
    const key = `${Math.round(W)}x${Math.round(H)}`; if (LIGHT.key !== key) { LIGHT.key = key; LIGHT.zones = {}; }
    if (LIGHT.zones[zi] && LIGHT.zones[zi].art === !!LAYERS.ART.L1a) return LIGHT.zones[zi];
    const Z = ZLIGHT[zi], mk = () => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(W)); c.height = Math.max(1, Math.round(H)); return c; };
    const light = mk(), lc = light.getContext('2d');
    let g = lc.createRadialGradient(-W * .15, -H * .05, 0, -W * .15, -H * .05, H * 1.1); g.addColorStop(0, `rgba(${Z.light},${Z.a})`); g.addColorStop(.5, `rgba(${Z.light},${Z.a * .35})`); g.addColorStop(1, `rgba(${Z.light},0)`); lc.fillStyle = g; lc.fillRect(0, 0, W, H);
    if (Z.shafts) for (const [x0, wd, al] of [[.05, .10, .10], [.24, .06, .08], [.40, .12, .06]]) { const sg = lc.createLinearGradient(0, 0, 0, H * .8); sg.addColorStop(0, `rgba(${Z.light},${al})`); sg.addColorStop(1, `rgba(${Z.light},0)`); lc.fillStyle = sg; lc.beginPath(); lc.moveTo(W * x0, 0); lc.lineTo(W * (x0 + wd), 0); lc.lineTo(W * (x0 + wd + .35), H * .8); lc.lineTo(W * (x0 + .3), H * .8); lc.closePath(); lc.fill(); }   // light through the canopy
    const shade = mk(), sc = shade.getContext('2d');
    g = sc.createLinearGradient(0, 0, W, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(10,10,30,${Z.shade * .6})`); sc.fillStyle = g; sc.fillRect(0, 0, W, H);   // the side away from the light
    g = sc.createRadialGradient(W / 2, H * .55, H * .3, W / 2, H * .55, H * .85); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(5,5,20,${Z.shade + .12})`); sc.fillStyle = g; sc.fillRect(0, 0, W, H);   // vignette
    const haze = hazeOf(zi), all = mk(), ac = all.getContext('2d'), hy = H * G.hz;
    const hg = ac.createLinearGradient(0, hy - H * .08, 0, hy + H * .17); hg.addColorStop(0, `rgba(${haze},0)`); hg.addColorStop(.3, `rgba(${haze},${Z.haze})`); hg.addColorStop(.5, `rgba(${haze},${Z.haze * .45})`); hg.addColorStop(1, `rgba(${haze},0)`);
    ac.fillStyle = hg; ac.fillRect(0, hy - H * .08, W, H * .25);   // aerial haze, soft both sides
    ac.globalAlpha = .7; ac.drawImage(light, 0, 0); ac.globalAlpha = 1; ac.drawImage(shade, 0, 0);
    return (LIGHT.zones[zi] = { all, art: !!LAYERS.ART.L1a });
  }
  function lightPass(ctx, Sx, W, H, zi) {
    ctx.drawImage(lightLayers(W, H, zi).all, 0, 0, W, H);   // one cached full-screen layer per zone: haze, light, shade, vignette
  }
  // the banner's box in the gate picture, measured once from its red cloth (the picture decides where the word goes, not a guess)
  let BANNER = null;
  function bannerBox() {
    if (BANNER) return BANNER; const im = LAYERS.ART.L7; if (!im) return { x0: .06, x1: .94, y0: .1, y1: .24 };
    try { const n = 160, c = document.createElement('canvas'); c.width = c.height = n; const x = c.getContext('2d'); x.drawImage(im, 0, 0, n, n); const d = x.getImageData(0, 0, n, n).data;
      let x0 = n, x1 = 0, y0 = n, y1 = 0; for (let y = 0; y < n * .6; y++) for (let i = 0; i < n; i++) { const k = (y * n + i) * 4, r = d[k], g = d[k + 1], b = d[k + 2], a = d[k + 3]; if (a > 128 && r > 120 && r > g * 1.6 && r > b * 1.6) { x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
      BANNER = x1 > x0 ? { x0: x0 / n, x1: x1 / n, y0: y0 / n, y1: y1 / n } : { x0: .06, x1: .94, y0: .1, y1: .24 }; } catch (e) { BANNER = { x0: .06, x1: .94, y0: .1, y1: .24 }; }
    return BANNER;
  }
  function finishWord(ctx, cx, by, w) {   // the gate is drawn w×w with its base at (cx, by)
    const B = bannerBox(), left = cx - w / 2 + B.x0 * w, right = cx - w / 2 + B.x1 * w, top = by - w + B.y0 * w, bot = by - w + B.y1 * w, bw = right - left, bh = bot - top;
    if (bh < 4) return; let fs = bh * .62; ctx.save(); ctx.font = `${fs}px 'Lilita One', Inter, sans-serif`; const mw = ctx.measureText('FINISH').width; if (mw > bw * .78) { fs *= bw * .78 / mw; ctx.font = `${fs}px 'Lilita One', Inter, sans-serif`; }
    ctx.translate((left + right) / 2, (top + bot) / 2 - bh * .04); ctx.transform(1, 0, -.14, 1, 0, 0); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
    ctx.lineWidth = Math.max(1.5, fs * .16); ctx.strokeStyle = '#4a0a06'; ctx.strokeText('FINISH', 0, 0); ctx.fillStyle = '#fff6d8'; ctx.fillText('FINISH', 0, 0); ctx.restore();
  }
  function quad(ctx, x1, y1, x2, x3, y3, x4, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y1); ctx.lineTo(x3, y3); ctx.lineTo(x4, y3); ctx.closePath(); ctx.fill(); }
  // a 3D gold ring (owner, 16:00: "more 3D, bright and contrasty like the actual game"): a torus lit from the upper left,
  // pre-rendered once as a sprite (dark rim for contrast, warm body, hot highlight, inner shadow, a glint); spun by squashing,
  // with the tube's thickness kept when it turns edge-on
  let RING = null;
  function ringSprite() {
    if (RING) return RING; const S = 128, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), R = S * .36, T = S * .13, cx = S / 2;
    x.lineWidth = T + 5; x.strokeStyle = '#5a3200'; x.beginPath(); x.arc(cx, cx, R, 0, 7); x.stroke();   // dark outline: reads on grass, dirt and sand
    const body = x.createLinearGradient(cx - R, cx - R, cx + R, cx + R); body.addColorStop(0, '#fff6b0'); body.addColorStop(.3, '#ffd41c'); body.addColorStop(.62, '#f0a000'); body.addColorStop(1, '#9a5a00');
    x.lineWidth = T; x.strokeStyle = body; x.beginPath(); x.arc(cx, cx, R, 0, 7); x.stroke();
    x.lineWidth = T * .32; x.strokeStyle = 'rgba(120,60,0,.55)'; x.beginPath(); x.arc(cx, cx, R - T * .32, 0, 7); x.stroke();   // the inside of the tube in shade
    x.lineWidth = T * .3; x.strokeStyle = 'rgba(255,255,235,.95)'; x.lineCap = 'round'; x.beginPath(); x.arc(cx, cx, R + T * .1, 3.5, 4.9); x.stroke();   // the hot highlight, upper left
    x.lineWidth = T * .18; x.strokeStyle = 'rgba(255,240,170,.8)'; x.beginPath(); x.arc(cx, cx, R - T * .05, .35, 1.1); x.stroke();   // bounce light, lower right
    const gl = x.createRadialGradient(cx - R * .62, cx - R * .62, 0, cx - R * .62, cx - R * .62, T * 1.1); gl.addColorStop(0, 'rgba(255,255,255,.95)'); gl.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gl; x.fillRect(0, 0, S, S);   // glint
    return (RING = { c, S, R });
  }
  const RSQ = [1, .9, .74, .52, .3, .12];
  function goldRing(ctx, x, y, r, squash, big) {
    const im = LAYERS.ART.L10;
    if (im) { const sq = Math.max(.1, Math.abs(squash)); let best = 0; RSQ.forEach((v, i) => { if (Math.abs(v - sq) < Math.abs(RSQ[best] - sq)) best = i; });
      const cw = im.width / 3, ch = im.height / 2, d = r * 2.1;   // the processed cell is trimmed to the ring: its height is the ring's diameter
      const cellW = d * (cw / ch), wNow = cellW * sq / RSQ[best];   // the painted angle's shading, the exact width of this moment's turn: no stepping between frames
      ctx.drawImage(im, (best % 3) * cw, Math.floor(best / 3) * ch, cw, ch, x - wNow / 2, y - d / 2, wNow, d);
      if (big) { ctx.save(); ctx.globalAlpha = .3; ctx.globalCompositeOperation = 'screen'; ctx.drawImage(im, 0, 0, cw, ch, x - d * .55, y - d * .55, d * 1.1, d * 1.1); ctx.restore(); }
      return; }
    const sp = ringSprite(), k = r / sp.R, d = sp.S * k, sq = Math.max(.16, squash);
    ctx.save(); ctx.translate(x, y); ctx.scale(sq, 1); ctx.drawImage(sp.c, -d / 2, -d / 2, d, d); ctx.restore();
    if (big) { ctx.save(); ctx.globalAlpha = .35; ctx.globalCompositeOperation = 'screen'; ctx.translate(x, y); ctx.drawImage(sp.c, -d * .55, -d * .55, d * 1.1, d * 1.1); ctx.restore(); }   // the boost ring glows
  }
  function runnerScale(Sx, cam) { return G.k / (Sx.z - cam.z); }
  function drawRunner(ctx, Sx, cam, W, H, L4) {
    const x = roadX(Sx.z) + Sx.laneX * G.laneW, q = proj(cam, x, roadY(Sx.z), Sx.z, W, H); if (!q) return;
    // the blue trail: where the runner has been, from his heels to the bottom of the frame (code)
    const pts = Sx.trail.map(p => { const q2 = proj(cam, p.x, roadY(p.z) + 0.02, p.z, W, H); return q2 && { ...q2, z: p.z }; }).filter(Boolean);   // each point keeps its own distance (the taper and the ragged edge need it)
    if (pts.length > 2) {   // the video's trail: a painted ink ribbon with ragged edges, brush streaks peeling off its sides, glitter along it
      const zs = pts.map(p => p.z), nz = z => Math.sin(z * 2.3) * .5 + Math.sin(z * 5.7 + 1.3) * .3 + Math.sin(z * 11.1) * .2;   // fixed to the ground: the ragged edge does not crawl
      const L = [], R = []; pts.forEach((p, i) => { const z = zs[i] || 0, tp = Math.min(1, Math.max(.4, (Sx.z - z) / .3)), w = p.s * tp * (.12 + .06 * nz(z)), wr = p.s * tp * (.12 + .06 * nz(z + 7.7));; L.push([p.x - w, p.y]); R.push([p.x + wr, p.y]); });
      ctx.save(); ctx.beginPath(); ctx.moveTo(L[0][0], L[0][1]); L.forEach(q => ctx.lineTo(q[0], q[1])); for (let i = R.length - 1; i >= 0; i--) ctx.lineTo(R[i][0], R[i][1]); ctx.closePath();
      ctx.fillStyle = '#1a3fd6'; ctx.fill(); ctx.lineWidth = Math.max(1, pts[pts.length - 1].s * .012); ctx.strokeStyle = '#0d2490'; ctx.stroke();
      ctx.globalAlpha = .35; ctx.beginPath(); pts.forEach((p, i) => { const x = p.x - p.s * .05; i ? ctx.lineTo(x, p.y) : ctx.moveTo(x, p.y); }); ctx.lineWidth = Math.max(1, pts[pts.length - 1].s * .025); ctx.strokeStyle = '#5c86ff'; ctx.stroke(); ctx.globalAlpha = 1;   // a wet highlight down one side
      ctx.lineCap = 'round'; ctx.strokeStyle = '#1a3fd6';
      for (const side of [-1, 1]) for (const off of [.17, .22]) { ctx.beginPath(); let on = false; pts.forEach((p, i) => { const z = zs[i] || 0, draw = nz(z * 1.7 + off * 10 + side) > -.05; const x = p.x + side * p.s * Math.min(1, Math.max(.4, (Sx.z - z) / .3)) * (off + .025 * nz(z * 3 + off)); if (draw && !on) { ctx.moveTo(x, p.y); on = true; } else if (draw) ctx.lineTo(x, p.y); else on = false; }); ctx.lineWidth = Math.max(1.2, pts[pts.length - 1].s * (off < .2 ? .026 : .016)); ctx.stroke(); }   // brush streaks, broken
      const c = Sx.clock || 0; pts.forEach((p, i) => { const z = zs[i] || 0, h = Math.abs(Math.sin(z * 12.9898) * 43758.5453) % 1; if (h > .55) { const tw = .4 + .6 * Math.abs(Math.sin(c * 7 + h * 40)); ctx.globalAlpha = tw; ctx.fillStyle = h > .9 ? '#ffd6ff' : '#ff7ad9'; ctx.beginPath(); ctx.arc(p.x + (h - .78) * p.s * .9, p.y, Math.max(1.3, p.s * .016), 0, 7); ctx.fill(); } }); ctx.globalAlpha = 1;   // glitter
      ctx.restore(); }
    if (Sx.dust && Sx.dust.length) { if (!PUFF) { PUFF = document.createElement('canvas'); PUFF.width = PUFF.height = 64; const x = PUFF.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 31); g.addColorStop(0, 'rgba(255,248,232,.9)'); g.addColorStop(.6, 'rgba(240,226,200,.45)'); g.addColorStop(1, 'rgba(240,226,200,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); }
      ctx.save(); Sx.dust.forEach(p => { const k = p.t / p.life, r = p.r * W * .7 * (1 + k * 1.8), px = q.x + Math.cos(p.a) * p.v * W * .12 * k, py = q.y - Math.abs(Math.sin(p.a)) * p.v * W * .05 * k; ctx.globalAlpha = (1 - k) * .7; ctx.drawImage(PUFF, px - r, py - r * .7, r * 2, r * 1.4); }); ctx.restore(); }   // the dust kick on GO!: pale soft puffs
    // scattered rings fly out from the runner
    Sx.scatter.forEach(p => { const t = p.t, px = q.x + Math.cos(p.a) * p.sp * W * t * 0.9, py = q.y - G.runnerH * q.s * .5 + Math.sin(p.a) * p.sp * W * t * 0.9 + W * 1.2 * t * t; ctx.save(); ctx.globalAlpha = 1 - t / p.life; goldRing(ctx, px, py, W * .018, Math.abs(Math.cos(t * 9 + p.a)) * .8 + .2); ctx.restore(); });
    let h = G.runnerH * q.s, frameI = Math.floor(Sx.z / 1.1) % 6, bob = Math.abs(Math.sin(Sx.z / 1.1 * Math.PI)) * h * 0.04, squat = 1;
    if (Sx.mode === 'ready') { const t = Sx.readyT || 0, beat = CONFIG.readySecs / 3, c = Sx.clock || 0;
      if (t < beat * 2 - .12) { const ph = c * 12; frameI = Math.floor(ph) % 6; bob = Math.abs(Math.sin(ph / 3 * Math.PI)) * h * .025; squat = 1 - .012 * Math.sin(c * 4.2); }   // jogging on the spot: all six run frames at 12 fps, two steps per cycle, a soft bob and breath
      else { frameI = 2; squat = .9; bob = 0; } }   // SET: crouched to launch
    const cell = Sx.mode === 'fail' ? 6 : Sx.mode === 'reveal' || Sx.mode === 'win' ? 7 : frameI;
    castShadow(ctx, L4, cell, q.x, q.y, h, h, bob);   // his own shape on the ground; it stays down while he bobs
    if (Sx.mercy > 0 && Math.floor(Sx.mercy * 14) % 2) return;   // flicker after a spill
    ctx.save(); if (Sx.mode === 'fail') { ctx.translate(q.x, q.y); ctx.rotate(Math.min(1.3, Sx.tumble * 3)); ctx.translate(-q.x, -q.y); }
    const lean = (Sx.lane - Sx.laneX) * -0.25; ctx.translate(q.x, q.y); ctx.rotate(lean); ctx.translate(-q.x, -q.y);
    if (squat !== 1) { ctx.translate(q.x, q.y); ctx.scale(1 + (1 - squat) * .5, squat); ctx.translate(-q.x, -q.y); }
    LAYERS.draw(ctx, L4, Sx, W, H, { box: { x: q.x / W, y: (q.y - bob) / H, w: h / W, h: h / H, anchor: 'bottom' }, cell });
    ctx.restore();
  }

  // ── layers (D-015): the same for every camera; their boxes are sized by the renderer from world metres ──
  function makeLayers(VIEW) {
    const CAM = VIEW.camera, plateBox = { x: -0.1, y: 0, w: 1.2, h: 1.2 * 640 / 960 * 1920 / 1536, anchor: 'top-left' };
    G.boxes = { backdrop: plateBox };
    const backdrop = (id, zi, name, sees) => ({ id, name, type: 'plate', canvas: [1536, 1920], key: null, camera: CAM, box: plateBox,
      notes: `picture · ${sees}. Seen from the chase camera: the horizon at ${Math.round(G.hz * 100)}% of the frame height (marked); everything below it is covered by the road and ground the game draws, so it is plain ground colour; the top 12% is a plain sky band for the HUD. No path, no characters, no text.`,
      shape(ctx, x, y, w, h, S, cell, o) { const T = ZC[zi], hy = y + h * (G.hz / (plateBox.h)); const g = ctx.createLinearGradient(0, y, 0, hy); g.addColorStop(0, T.sky[0]); g.addColorStop(1, T.sky[1]); ctx.fillStyle = g; ctx.fillRect(x, y, w, hy - y);
        ctx.fillStyle = T.edge[1]; ctx.beginPath(); ctx.moveTo(x, hy); for (let i = 0; i <= 24; i++) { const px = x + w * i / 24, ph = [0.10, 0.05, 0.14][zi] * h * (0.4 + 0.6 * Math.abs(Math.sin(i * 1.7 + zi))); ctx.lineTo(px, hy - ph); } ctx.lineTo(x + w, hy); ctx.closePath(); ctx.fill();
        ctx.fillStyle = T.ground[0]; ctx.fillRect(x, hy, w, y + h - hy);
        if (o && o.explain) { GB.bpZone(ctx, x + w * .083, y, w * .833, h * .12 * 1.0, '#ffa500', 'HUD STRIP: plain sky band (top 12% of the frame)', true); GB.bpLabel(ctx, 30, hy - 30, `HORIZON at ${Math.round(G.hz * 100)}% of the frame height: the course vanishes here`, '#ffd23a', true); GB.bpZone(ctx, x, hy + 8, w, y + h - hy - 8, '#00e5ff', 'COVERED BY THE ROAD AND GROUND (code / tile): plain', true); GB.bpLabel(ctx, 30, 70, 'The box is 1.2 frame widths: it drifts sideways with the curves', '#ffd23a', true); } } });
    const PROPS = [['fern', 'mossy rock', 'jungle tree'], ['palm tree', 'sunflower', 'checkered rock block'], ['sandstone pillar', 'canyon spire', 'broken arch']];
    return [
      backdrop('L1a', 0, 'backdrop-jungle', 'zone 1, jungle: a deep gorge of mossy rock walls and hanging vines, light through the canopy, distant misty cliffs'),
      backdrop('L1b', 1, 'backdrop-hills', 'zone 2, checkered hills: bright sky, turquoise sea, rock stacks and mesas with brown checkerboard soil layers under green grass, distant mountains'),
      backdrop('L1c', 2, 'backdrop-ruins', 'zone 3, desert ruins: hot sky, sandstone canyon walls, pyramids and an aqueduct far off'),
      { id: 'L2', name: 'roadside', type: 'sheet', canvas: [1536, 1536], key: '#4A5A7A', camera: CAM, cells: { cols: 3, rows: 3, names: PROPS.flat() },
        notes: 'picture ×9 · roadside props, three per zone (rows: jungle, checkered hills, desert ruins), each standing on its base at the bottom centre of its cell, seen from slightly above at the chase camera\'s angle, same light; drawn at the course edges scaled by distance',
        shape(ctx, x, y, w, h, S, cell) { const cx = x + w / 2, by = y + h * .96, zi = Math.floor(cell / 3), T = ZC[zi], K = '#2a2a30', L = ['#6f8a5c', '#7d7f72', '#4f6a44', '#8a6a46', '#d8b23a', '#8a6a52', '#c8b08a', '#b08a62', '#c2a47e'][cell]; ctx.lineWidth = 2; ctx.strokeStyle = K;
          const tri = (pts, col) => { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (let q = 2; q < pts.length; q += 2) ctx.lineTo(pts[q], pts[q + 1]); ctx.closePath(); ctx.fillStyle = col; ctx.fill(); ctx.stroke(); };
          if (cell === 0) { for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(cx, by); ctx.quadraticCurveTo(cx + i * w * .1, by - h * .45, cx + i * w * .16, by - h * (.6 - Math.abs(i) * .08)); ctx.lineWidth = w * .045; ctx.strokeStyle = L; ctx.stroke(); } }   // fern: fronds from one root
          else if (cell === 1) { GB.ell(ctx, cx, by - h * .2, w * .36, h * .2, L, K); GB.ell(ctx, cx - w * .1, by - h * .32, w * .16, h * .07, '#8fae78'); }   // mossy rock: low, wide, moss on top
          else if (cell === 2) { GB.rr(ctx, cx - w * .05, by - h * .82, w * .1, h * .82, w * .03, '#6b5a44', K); GB.ell(ctx, cx, by - h * .82, w * .3, h * .14, L, K); GB.ell(ctx, cx - w * .2, by - h * .7, w * .16, h * .09, L, K); GB.ell(ctx, cx + w * .2, by - h * .72, w * .16, h * .09, L, K); }   // jungle tree: tall trunk, layered canopy
          else if (cell === 3) { ctx.beginPath(); ctx.moveTo(cx, by); ctx.quadraticCurveTo(cx + w * .12, by - h * .38, cx + w * .04, by - h * .7); ctx.lineWidth = w * .06; ctx.strokeStyle = L; ctx.stroke(); for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + (i - 2.5) * .5; ctx.beginPath(); ctx.moveTo(cx + w * .04, by - h * .7); ctx.quadraticCurveTo(cx + w * .04 + Math.cos(a) * w * .2, by - h * .7 + Math.sin(a) * h * .12 - h * .05, cx + w * .04 + Math.cos(a) * w * .34, by - h * .7 + Math.sin(a) * h * .1 + h * .1); ctx.lineWidth = w * .035; ctx.strokeStyle = '#5f8f3e'; ctx.stroke(); } }   // palm: curved trunk, fronds
          else if (cell === 4) { ctx.beginPath(); ctx.moveTo(cx, by); ctx.lineTo(cx, by - h * .6); ctx.lineWidth = w * .03; ctx.strokeStyle = '#4f7a34'; ctx.stroke(); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; GB.ell(ctx, cx + Math.cos(a) * w * .1, by - h * .66 + Math.sin(a) * w * .1, w * .05, w * .05, L, K); } GB.ell(ctx, cx, by - h * .66, w * .08, w * .08, '#6b4a2a', K); }   // sunflower: stem, petals, brown disc
          else if (cell === 5) { const bw = w * .56, bh = h * .5; for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) { ctx.fillStyle = (r + c) % 2 ? '#8a6a52' : '#6d5240'; ctx.fillRect(cx - bw / 2 + c * bw / 4, by - bh + r * bh / 4, bw / 4, bh / 4); } ctx.strokeRect(cx - bw / 2, by - bh, bw, bh); ctx.fillStyle = '#7fb85a'; ctx.fillRect(cx - bw / 2 - 2, by - bh - h * .05, bw + 4, h * .06); ctx.strokeRect(cx - bw / 2 - 2, by - bh - h * .05, bw + 4, h * .06); }   // checkered block: brown checker soil, grass cap
          else if (cell === 6) { GB.rr(ctx, cx - w * .09, by - h * .86, w * .18, h * .86, 3, L, K); GB.rr(ctx, cx - w * .13, by - h * .9, w * .26, h * .06, 3, L, K); }   // sandstone pillar
          else if (cell === 7) tri([cx - w * .2, by, cx - w * .04, by - h * .9, cx + w * .06, by - h * .7, cx + w * .2, by], L);   // canyon spire
          else { GB.rr(ctx, cx - w * .32, by - h * .62, w * .12, h * .62, 3, L, K); GB.rr(ctx, cx + w * .2, by - h * .4, w * .12, h * .4, 3, L, K); GB.rr(ctx, cx - w * .36, by - h * .7, w * .44, h * .09, 3, L, K); } } },   // broken arch: one post holds half a lintel
      { id: 'L3', name: 'road', type: 'tile', canvas: [1536, 1024], key: null, camera: 'straight down (top-down), the texture tiles along its length',
        notes: 'picture · three seamless top-down path textures side by side (jungle dirt, checkered-hill grass path, desert stone causeway), each a vertical strip that tiles top-to-bottom; no lane lines (code), no objects; the game warps it into the road',
        shape(ctx, x, y, w, h, S, cell, o) { for (let i = 0; i < 3; i++) { ctx.fillStyle = ZC[i].road[0]; ctx.fillRect(x + w * i / 3, y, w / 3, h); ctx.fillStyle = ZC[i].road[1]; for (let j = 0; j < 8; j++) ctx.fillRect(x + w * i / 3, y + h * j / 8, w / 3, h / 16); if (o && o.explain) GB.bpLabel(ctx, x + w * i / 3 + 20, 50, ['jungle', 'hills', 'ruins'][i], '#ffd23a', true); } } },
      { id: 'L3b', name: 'ground', type: 'tile', canvas: [1536, 1024], key: null, camera: 'straight down (top-down), the texture tiles in both directions',
        notes: 'picture · three seamless top-down ground textures side by side (jungle forest floor, seaside grass, desert sand), each a strip that tiles in both directions; covers the ground on both sides of the road (rule 24: half the frame below the horizon is never a flat colour)',
        shape(ctx, x, y, w, h, S, cell, o) { for (let i = 0; i < 3; i++) { ctx.fillStyle = ZC[i].ground[0]; ctx.fillRect(x + w * i / 3, y, w / 3, h); ctx.fillStyle = ZC[i].ground[1]; for (let j = 0; j < 30; j++) { const px = x + w * i / 3 + ((j * 7919) % 100) / 100 * w / 3, py = y + ((j * 104729) % 100) / 100 * h; ctx.beginPath(); ctx.arc(px, py, w * .012, 0, 7); ctx.fill(); } if (o && o.explain) GB.bpLabel(ctx, x + w * i / 3 + 20, 50, ['jungle floor', 'grass', 'sand'][i], '#ffd23a', true); } } },
      { id: 'L4', name: 'runner', type: 'sheet', canvas: [2048, 1024], key: '#FF00FF', camera: 'from behind and slightly above, the runner moving away from the camera', cells: { cols: 4, rows: 2, names: ['run 1', 'run 2', 'run 3', 'run 4', 'run 5', 'run 6', 'hit / stumble', 'win'] },
        notes: 'picture FROM THE CLIENT’S OWN FOOTAGE (owner, 2026-10-16: the hero is the most important part) · the hero from BEHIND as the supplied video shows him: a six-frame run cycle, a stumble and a win pose, feet at the bottom centre of each cell; MAGENTA key (#FF00FF) because the hero is blue (rule 22); final art: the client’s own renders replace this sheet in place',
        shape(ctx, x, y, w, h, S, cell) { const cx = x + w / 2, by = y + h * .97, u = h, ph = (cell % 6) / 6 * 6.283, st = cell === 6, wn = cell === 7, G1 = '#77777f', G2 = '#a9a9b1', K = '#2a2a30'; ctx.lineCap = 'round';
          ctx.strokeStyle = G1; ctx.lineWidth = u * .09; const la = wn ? 0 : Math.sin(ph) * u * .08;
          ctx.beginPath(); ctx.moveTo(cx - u * .08, by - u * .42); ctx.lineTo(cx - u * .1, by - la * .5 - u * .02); ctx.moveTo(cx + u * .08, by - u * .42); ctx.lineTo(cx + u * .1, by + la * .5 - u * .02 - (st ? u * .1 : 0)); ctx.stroke();
          GB.ell(ctx, cx - u * .1, by - u * .02 - la * .5, u * .07, u * .035, '#d9d9df', K); GB.ell(ctx, cx + u * .1, by - u * .02 + la * .5, u * .07, u * .035, '#d9d9df', K);
          GB.ell(ctx, cx, by - u * .52, u * .17, u * .17, G2, K);
          ctx.strokeStyle = G1; ctx.lineWidth = u * .06; ctx.beginPath(); ctx.moveTo(cx - u * .15, by - u * .6); ctx.lineTo(cx - u * .24, by - u * (wn ? .9 : .5) - la * .4); ctx.moveTo(cx + u * .15, by - u * .6); ctx.lineTo(cx + u * .24, by - u * (wn ? .9 : .5) + la * .4); ctx.stroke();
          GB.ell(ctx, cx, by - u * .78, u * .16, u * .15, G2, K);
          for (const d of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(cx + d * u * .08, by - u * .86); ctx.lineTo(cx + d * u * .2, by - u * .95); ctx.lineTo(cx + d * u * .1, by - u * .76); ctx.closePath(); ctx.fillStyle = G2; ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 1.5; ctx.stroke(); }
          ctx.font = `700 ${Math.round(u * .07)}px Inter, system-ui`; ctx.textAlign = 'center'; ctx.fillStyle = '#2a2a30'; if (u > 120) ctx.fillText(st ? 'HIT' : wn ? 'WIN' : 'SUPPLIED', cx, by - u * .5); } },
      { id: 'L10', name: 'ring', type: 'sheet', canvas: [1536, 1024], key: '#4A5A7A', camera: 'straight on, at eye level', cells: { cols: 3, rows: 2, names: ['face on', 'turned 25°', 'turned 42°', 'turned 58°', 'turned 72°', 'edge on'] },
        notes: 'picture ×6 · the gold ring at six angles of one spin, same ring, same light, centred in each cell, in the render of the world (owner 16:01: the code ring looked disconnected from the world art); the game plays the angles to spin it; the scatter and the boost glow stay code',
        shape(ctx, x, y, w, h, S, cell) { const sq = [1, .9, .74, .52, .3, .12][cell], cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) * .36; ctx.save(); ctx.translate(cx, cy); ctx.scale(sq, 1); ctx.lineWidth = r * .32; ctx.strokeStyle = '#f2c200'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); ctx.restore(); } },
      { id: 'L5', name: 'hazards', type: 'sheet', canvas: [1024, 512], key: '#4A5A7A', camera: CAM, cells: { cols: 2, rows: 1, names: ['spike strip', 'boulder'] },
        notes: 'picture ×2 · one lane wide each, standing on the ground at the bottom of the cell, seen from the chase camera: 1 a low strip of silver spikes on a dark base, 2 a round boulder; both read as STOP at 30 px',
        shape(ctx, x, y, w, h, S, cell) { const cx = x + w / 2, by = y + h * .98, K = '#1a1a1e';
          if (cell === 0) { GB.rr(ctx, x + w * .04, by - h * .1, w * .92, h * .1, 2, '#3a3a40', K); const n = 6; for (let i = 0; i < n; i++) { const sx = x + w * .06 + i * w * .88 / n; ctx.beginPath(); ctx.moveTo(sx, by - h * .1); ctx.lineTo(sx + w * .88 / n / 2, by - h * .42); ctx.lineTo(sx + w * .88 / n, by - h * .1); ctx.closePath(); ctx.fillStyle = '#f2f2f4'; ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 1.5; ctx.stroke(); } }
          else { GB.ell(ctx, cx, by - h * .38, w * .4, h * .38, '#6f6a66', K); GB.ell(ctx, cx - w * .12, by - h * .52, w * .12, h * .08, '#8d8884'); } } },
      { id: 'L6', name: 'spiked-roller', type: 'sprite', canvas: [1024, 512], key: '#4A5A7A', camera: CAM,
        notes: 'picture · a spiked log roller lying across TWO lanes, on the ground at the bottom of the canvas, seen from the chase camera; zone 3 (ruins): dark wood and iron spikes',
        shape(ctx, x, y, w, h) { const by = y + h * .98, K = '#1a1a1e'; GB.rr(ctx, x + w * .03, by - h * .5, w * .94, h * .42, h * .2, '#7a6650', K); for (let i = 0; i < 9; i++) { const sx = x + w * .08 + i * w * .1; ctx.beginPath(); ctx.moveTo(sx - w * .025, by - h * .5); ctx.lineTo(sx, by - h * .78); ctx.lineTo(sx + w * .025, by - h * .5); ctx.closePath(); ctx.fillStyle = '#e6e6ea'; ctx.fill(); ctx.strokeStyle = K; ctx.lineWidth = 1.5; ctx.stroke(); } } },
      { id: 'L7', name: 'finish-gate', type: 'sprite', canvas: [1024, 1024], key: '#4A5A7A', camera: CAM,
        notes: 'picture · a sandstone finish arch spanning the whole course, pillars at the bottom corners, a plain warm-red cloth banner across the top with NO lettering (FINISH is code); no blue anywhere (rule 22), seen straight on from the chase camera',
        shape(ctx, x, y, w, h) { const K = '#2a2a30'; GB.rr(ctx, x + w * .04, y + h * .2, w * .12, h * .8, 4, '#b8a888', K); GB.rr(ctx, x + w * .84, y + h * .2, w * .12, h * .8, 4, '#b8a888', K); GB.rr(ctx, x + w * .02, y + h * .1, w * .96, h * .14, 4, '#d8452a', K); } },
      { id: 'L8', name: 'logo', type: 'brand', canvas: null, key: null, notes: 'SUPPLIED · the Sonic 4 logo (colour + white): top centre in play, above the copy on every card; grey placeholder until then (never drawn in code)' },
      { id: 'L9', name: 'key-art', type: 'brand', canvas: null, key: null, notes: 'SUPPLIED · the film\'s key art: the backdrop of the start card and the win card' },
      { id: 'FX', name: 'code-effects', type: 'hud-in-code', canvas: null, key: null, notes: 'code · the lane lines, the rings (plain gold rings), the boost rings at the zone gates, the blue trail, speed lines, the ring scatter, the red flash, the stumble, zone banners, the HUD and the cards (DOM)' },
    ];
  }

  // ── layer contract: blueprint / explained / geometry ────
  function layerRoutes(VIEW) {
    const bp = Q.get('blueprint') || Q.get('explained');
    if (bp) {
      const L = VIEW.layers.find(l => l.id === bp); if (!L || !L.canvas) { document.body.innerHTML = 'no layer ' + bp; throw new Error('no layer'); }
      const c = document.createElement('canvas'); c.width = L.canvas[0]; c.height = L.canvas[1]; c.style.cssText = 'max-width:100%;height:auto;display:block;background:#4A5A7A';
      document.body.innerHTML = ''; document.body.style.cssText = 'margin:0;background:#222'; document.body.appendChild(c);
      const ctx = c.getContext('2d'); const o = { explain: has('explained'), key: L.key, cell: +(Q.get('cell') || 0) };
      if (L.type === 'tile') L.shape(ctx, 0, 0, c.width, c.height, null, 0, o); else window.LAYERS.blueprint(ctx, L, c.width, c.height, o);
      document.title = `${L.id} ${L.name} ${has('explained') ? 'explained' : 'blueprint'}`; throw new Error('blueprint rendered');
    }
    if (has('geometry')) {
      document.body.innerHTML = `<pre id="geometry">${JSON.stringify({ variant: VIEW.id, canvas: VIEW.canvas, format: 'playable', key: '#4A5A7A', camera: VIEW.camera || null, geometry: { ...G, boxes: G.boxes }, layers: VIEW.layers.map(l => ({ id: l.id, name: l.name, type: l.type, canvas: l.canvas, key: l.key, box: l.box || null, cells: l.cells || null, states: l.states || false, camera: l.camera || null, notes: l.notes })) }, null, 2)}</pre>`;
      document.title = 'GEOMETRY'; throw new Error('geometry printed');
    }
  }
  // ── DOM: HUD, cards ─────────────────────────────────────
  const CSS = `
  html,body{margin:0;height:100%;background:#000;font-family:Inter,system-ui,sans-serif;-webkit-user-select:none;user-select:none}
  .frame{--accent:#1E50D0;--ink:#13233d;--red:#e0202a;--gold:#ffd23a;position:relative;width:min(100vw,calc(100dvh*2/3));aspect-ratio:2/3;margin:0 auto;overflow:hidden;background:#2a2a2e;container-type:inline-size;touch-action:none}
  canvas#game{position:absolute;inset:0;width:100%;height:100%;display:block}
  .hud{position:absolute;inset:0;pointer-events:none;color:#fff;font-weight:700}
  .brandmark{position:absolute;left:50%;top:2.6cqw;transform:translateX(-50%);height:6cqw;display:flex;align-items:center;justify-content:center;font-size:2.6cqw;font-weight:900;letter-spacing:.12em;color:var(--ink);border:1px dashed rgba(19,35,61,.45);border-radius:1.5cqw;padding:0 3cqw;background:rgba(255,255,255,.55);white-space:nowrap}
  .watch{position:absolute;left:50%;top:11.4cqw;transform:translateX(-50%) skewX(-8deg);display:flex;align-items:center;gap:1.6cqw;background:var(--zc,#4a7a3a);border:.6cqw solid rgba(255,255,255,.85);border-radius:1.6cqw;padding:.8cqw 3cqw;font-size:5cqw;font-weight:900;font-style:italic;font-variant-numeric:tabular-nums;box-shadow:0 .6cqw 1.6cqw rgba(0,0,0,.25)}
  .watch small{font-size:2.8cqw;opacity:.85}.watch .zd{display:flex;gap:.8cqw}.watch .zd i{width:1.8cqw;height:1.8cqw;border-radius:50%;background:rgba(255,255,255,.35)}.watch .zd i.on{background:#fff}
  .rings{position:absolute;left:3.4cqw;top:11.6cqw;display:flex;align-items:center;gap:1.4cqw;font-size:4.6cqw;font-weight:900;font-style:italic;color:#fff;text-shadow:0 .4cqw 0 rgba(0,0,0,.35)}
  .rings i{display:block;width:4.6cqw;height:4.6cqw;border-radius:50%;border:1.1cqw solid var(--gold);box-sizing:border-box}.rings.zero{color:var(--red);animation:blink .5s steps(2) infinite}@keyframes blink{50%{opacity:.35}}
  .rings.bump{animation:bump .25s cubic-bezier(.2,1.6,.4,1)}@keyframes bump{40%{transform:scale(1.25)}}
  .hint{position:absolute;left:50%;bottom:6cqw;transform:translateX(-50%);font-size:3.4cqw;background:var(--accent);color:#fff;border-radius:999px;padding:1.6cqw 4.4cqw;white-space:nowrap;box-shadow:0 .6cqw 1.6cqw rgba(0,0,0,.22);transition:opacity .25s}
  .hint.cue{background:#fff;color:var(--ink)}
  .card{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding:0 8cqw 9cqw;text-align:center;background:linear-gradient(180deg,rgba(255,255,255,0) 30%,rgba(255,255,255,.93) 60%)}
  .card[hidden]{display:none}
  .frame:has(.card:not([hidden])) .watch,.frame:has(.card:not([hidden])) .rings,.frame:has(.card:not([hidden])) .hint,.frame:has(.card:not([hidden])) .greylabel,.frame:has(.card:not([hidden])) .brandmark{display:none}
  .card .stamp{font-size:11cqw;line-height:1;font-weight:900;font-style:italic;letter-spacing:.02em;color:var(--accent);transform:skewX(-8deg);animation:stamp .35s cubic-bezier(.2,1.4,.3,1) both;margin-bottom:4cqw}
  @keyframes stamp{0%{transform:skewX(-8deg) scale(1.8);opacity:0}100%{transform:skewX(-8deg) scale(1);opacity:1}}
  .card.fail{background:rgba(0,0,0,.92);justify-content:center}.card.fail .stamp{color:var(--red);font-size:14cqw;margin-bottom:6cqw}.card.fail h1,.card.fail p{color:#fff}.card.fail .stat{background:transparent;color:#fff;border-color:rgba(255,255,255,.35)}.card.fail .btn.ghost{color:#fff}
  .card h1{font-size:7.6cqw;line-height:1.05;margin:0;font-weight:900;color:var(--ink)}
  .card p{font-size:3.8cqw;line-height:1.35;margin:2cqw 0 0;color:var(--ink);font-weight:600}
  .card .stat{display:inline-block;margin-top:3cqw;font-size:3.2cqw;font-weight:800;color:var(--ink);background:#fff;border:1px solid #d2d2d7;border-radius:999px;padding:1.4cqw 4cqw}
  .card .btn{font:inherit;font-weight:800;font-size:4.8cqw;min-height:12cqw;padding:2.6cqw 11cqw;margin-top:5cqw;border-radius:999px;border:0;background:var(--accent);color:#fff;cursor:pointer;box-shadow:0 1cqw 2.4cqw rgba(30,80,208,.35);animation:breathe 2.2s ease-in-out 1s infinite}
  .card .btn.ghost{background:transparent;color:var(--ink);box-shadow:none;animation:none;font-size:3.2cqw;min-height:6cqw;padding:1cqw 3cqw;margin-top:1.6cqw;text-decoration:underline}
  @keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
  .card .swipe{width:22cqw;height:12cqw;margin:0 0 2cqw;position:relative}.card .swipe svg{position:absolute;left:50%;top:0;width:12cqw;height:12cqw;margin-left:-6cqw;animation:swipe 1.6s ease-in-out infinite}
  @keyframes swipe{0%,100%{transform:translateX(-60%) rotate(-8deg)}50%{transform:translateX(60%) rotate(8deg)}}
  .card .lockup{font-size:3cqw;font-weight:900;letter-spacing:.12em;color:var(--ink);border:1px dashed rgba(19,35,61,.45);border-radius:1.5cqw;padding:1.4cqw 3cqw;margin-bottom:4cqw;background:rgba(255,255,255,.6)}
  .card .keyart{position:absolute;left:8cqw;right:8cqw;top:8cqw;height:44cqw;border:1px dashed rgba(19,35,61,.4);border-radius:2cqw;display:flex;align-items:center;justify-content:center;font-size:3cqw;font-weight:800;letter-spacing:.1em;color:rgba(19,35,61,.6);background:rgba(255,255,255,.35)}
  .card.start{background:linear-gradient(180deg,rgba(255,255,255,0) 40%,rgba(255,255,255,.9) 66%)}
  .loader{position:absolute;inset:0;z-index:9;display:flex;align-items:center;justify-content:center;background:#0d1a3a;transition:opacity .45s ease}
  .loader.done{opacity:0;pointer-events:none}.loader[hidden]{display:none}
  .loader .bar{width:38cqw;height:1.4cqw;border-radius:1cqw;background:rgba(255,255,255,.15);overflow:hidden}.loader .bar i{display:block;height:100%;width:0;background:var(--gold);border-radius:1cqw;transition:width .25s ease}
  .frame.loading canvas#game,.frame.loading .hud,.frame.loading .card{visibility:hidden}
  .brandmark:has(img){border:0;background:none;padding:0;height:9cqw;top:1.6cqw}.brandmark img{height:100%;width:auto;display:block;filter:drop-shadow(0 .4cqw .8cqw rgba(0,0,0,.45))}
  .card .lockup:has(img){border:0;background:none;padding:0}.card .lockup img{height:14cqw;width:auto;display:block}
  /* game-style screens: slanted bands, a checkered speed strip, a blinking press line, results that count up (owner 15:51) */
  .card.sg{background:none;padding:0;justify-content:flex-start;font-family:'Lilita One',Inter,system-ui,sans-serif;overflow:hidden}
  .sg-band{position:absolute;left:-12%;width:124%;transform:skewY(-5deg);box-shadow:0 1cqw 0 rgba(0,0,0,.25)}
  .sg-band.blue{top:14cqw;height:34.5cqw;background:linear-gradient(180deg,#2a63ff 0%,#1240c9 55%,#0a2a8c 100%);animation:sgL .45s cubic-bezier(.2,1.2,.3,1) both}
  .sg-band.yellow{top:49.5cqw;height:3.6cqw;background:#ffd21a;animation:sgR .45s .08s cubic-bezier(.2,1.2,.3,1) both}
  .sg-band.red{bottom:6cqw;height:12cqw;background:linear-gradient(180deg,#ff3b2f,#c4141b);display:flex;align-items:center;justify-content:center;animation:sgR .45s .2s cubic-bezier(.2,1.2,.3,1) both}
  .sg-band.red span{transform:skewX(-8deg);color:#fff;font-size:5.8cqw;letter-spacing:.06em;text-shadow:0 .5cqw 0 #7a0a0f}
  .sg-band.small{top:9cqw;height:15cqw;display:flex;align-items:center;justify-content:center}
  .sg-band.small span{transform:skewY(5deg) skewX(-10deg);color:#fff;font-size:11cqw;letter-spacing:.02em;-webkit-text-stroke:.5cqw #0a1a55;paint-order:stroke fill;text-shadow:0 .9cqw 0 #0a1a55}
  .sg-checker{position:absolute;left:-12%;width:124%;height:5cqw;transform:skewY(-5deg);background:repeating-conic-gradient(#0a2a8c 0 25%,#ffd21a 0 50%) 0 0/5cqw 5cqw;animation:sgRun .5s linear infinite}
  .sg-checker.top{top:11cqw}.sg-checker.bottom{bottom:2.4cqw}.sg-checker.mid{top:25.5cqw;height:3.4cqw;background-size:3.4cqw 3.4cqw}
  @keyframes sgRun{to{background-position:-10cqw 0}}
  @keyframes sgL{0%{transform:translateX(-110%) skewY(-5deg)}100%{transform:translateX(0) skewY(-5deg)}}
  @keyframes sgR{0%{transform:translateX(110%) skewY(-5deg)}100%{transform:translateX(0) skewY(-5deg)}}
  .sg-logo{position:absolute;left:0;right:0;top:15.5cqw;display:flex;justify-content:center;animation:sgDrop .7s .25s cubic-bezier(.3,1.6,.5,1) both}
  .sg-logo img{width:88cqw;height:auto;display:block;filter:drop-shadow(0 1cqw 0 rgba(0,0,30,.55))}
  @keyframes sgDrop{0%{transform:translateY(-70cqw) scale(.6)}100%{transform:none}}
  .sg-rings{position:absolute;left:0;right:0;top:56cqw;display:flex;justify-content:center;gap:5cqw}
  .sg-rings i{width:8cqw;height:8cqw;background:url(assets/game/ring.webp) 0 0/300% 200% no-repeat;filter:drop-shadow(0 .6cqw 0 rgba(0,0,0,.3));animation:sgRingSpin .9s step-end infinite,sgPop .4s both}
  .sg-rings i:nth-child(2){animation-delay:-.2s,.55s}.sg-rings i:nth-child(3){animation-delay:-.4s,.6s}.sg-rings i:nth-child(4){animation-delay:-.6s,.65s}.sg-rings i:nth-child(5){animation-delay:-.8s,.7s}.sg-rings i:nth-child(1){animation-delay:0s,.5s}
  @keyframes sgRingSpin{0%{background-position:0 0}10%{background-position:50% 0}20%{background-position:100% 0}30%{background-position:0 100%}40%{background-position:50% 100%}50%{background-position:100% 100%}60%{background-position:50% 100%}70%{background-position:0 100%}80%{background-position:100% 0}90%{background-position:50% 0}}
  @keyframes sgPop{0%{opacity:0;translate:0 6cqw}100%{opacity:1;translate:0 0}}
  .sg-tag{position:absolute;left:0;right:0;top:40.8cqw;text-align:center;color:#ffd21a;font-size:5.2cqw;-webkit-text-stroke:.6cqw #0a1a55;paint-order:stroke fill;transform:skewX(-8deg);text-shadow:0 .8cqw 0 #0a1a55;animation:sgPop .4s .8s both}
  .sg-how{position:absolute;left:0;right:0;top:60cqw;display:flex;flex-direction:column;align-items:center;gap:1.4cqw;animation:sgPop .4s .95s both}
  .sg-swipe{display:flex;align-items:center;justify-content:center;gap:3cqw;font-family:'Lilita One',Inter,sans-serif;font-size:6.4cqw;color:#fff;-webkit-text-stroke:.5cqw #0a1a55;paint-order:stroke fill;transform:skewX(-8deg);text-shadow:0 .7cqw 0 #0a1a55}
  .sg-swipe i{width:0;height:0;border-top:2.6cqw solid transparent;border-bottom:2.6cqw solid transparent;filter:drop-shadow(0 .5cqw 0 #0a1a55)}
  .sg-swipe i.l{border-right:3.6cqw solid #ffd21a;animation:sgNudgeL .8s ease-in-out infinite}.sg-swipe i.r{border-left:3.6cqw solid #ffd21a;animation:sgNudgeR .8s ease-in-out infinite}
  @keyframes sgNudgeL{50%{transform:translateX(-1.6cqw)}}@keyframes sgNudgeR{50%{transform:translateX(1.6cqw)}}
  .sg-how p{margin:0;font:700 3.4cqw Inter,system-ui,sans-serif;color:#fff;text-shadow:0 .3cqw .9cqw rgba(0,0,0,.85),0 0 .3cqw rgba(0,0,0,.6);letter-spacing:.02em}
  .sg-press{position:absolute;left:0;right:0;margin:0 auto;width:max-content;top:77cqw;font-family:'Lilita One',Inter,sans-serif;font-size:8cqw;letter-spacing:.03em;color:#0a1a55;background:linear-gradient(180deg,#ffe25a,#ffbf00);border:0;border-radius:3cqw;padding:3.2cqw 12cqw;cursor:pointer;transform:skewX(-8deg);box-shadow:0 1.2cqw 0 #b07a00,0 2cqw 3cqw rgba(0,0,0,.35);white-space:nowrap;animation:sgPop .4s 1.1s both,sgPress 1.1s ease-in-out 1.6s infinite}
  @keyframes sgPress{0%,100%{scale:1}50%{scale:1.08}}   .card .stat[hidden]{display:none}
  .card.win.sg{background:linear-gradient(180deg,rgba(5,15,60,0) 0%,rgba(5,15,60,.55) 30%,rgba(5,15,60,.9) 100%)}
  .sg-results{position:absolute;left:5cqw;right:6cqw;top:33cqw;display:flex;align-items:flex-end;gap:4cqw}
  .sg-hero{width:42cqw;height:42cqw;background:url(assets/game/runner.webp) 100% 100%/400% 200% no-repeat;animation:sgHero .6s .3s cubic-bezier(.2,1.4,.4,1) both;filter:drop-shadow(0 1cqw 0 rgba(0,0,0,.35))}
  @keyframes sgHero{0%{transform:translateX(-60cqw)}100%{transform:none}}
  .sg-tally{flex:1;display:flex;flex-direction:column;gap:2.2cqw;padding-bottom:2cqw}
  .sg-tally .row{display:flex;justify-content:space-between;align-items:baseline;color:#fff;font-size:6.4cqw;transform:skewX(-8deg);animation:sgR2 .4s both}
  .sg-tally .row:nth-child(1){animation-delay:.5s}.sg-tally .row:nth-child(2){animation-delay:.62s}.sg-tally .row:nth-child(3){animation-delay:.74s}
  .sg-tally .row b{font-weight:400;color:#ffd21a;-webkit-text-stroke:.45cqw #0a1a55;paint-order:stroke fill}
  .sg-tally .row span{font-variant-numeric:tabular-nums;-webkit-text-stroke:.45cqw #0a1a55;paint-order:stroke fill}
  .sg-tally .row.total{border-top:.6cqw solid #ffd21a;padding-top:1.6cqw;font-size:7.4cqw}
  @keyframes sgR2{0%{opacity:0;transform:translateX(30cqw) skewX(-8deg)}100%{opacity:1;transform:skewX(-8deg)}}
  .sg-close{position:absolute;left:0;right:0;bottom:8cqw;display:flex;flex-direction:column;align-items:center;animation:sgPop .45s 2.6s both}
  .sg-close .lockup{margin:0 0 1cqw}.sg-close .lockup img{height:16cqw}
  .sg-close h1{font-family:'Lilita One',Inter,sans-serif;font-weight:400;color:#fff;font-size:7cqw;letter-spacing:.02em;-webkit-text-stroke:.5cqw #0a1a55;paint-order:stroke fill}
  .card.sg .btn.sg-cta,.card.sg .btn.sg-again{font-family:'Lilita One',Inter,sans-serif;font-weight:400;font-size:6.2cqw;letter-spacing:.03em;background:linear-gradient(180deg,#ffe25a,#ffbf00);color:#0a1a55;border-radius:3cqw;transform:skewX(-8deg);box-shadow:0 1.2cqw 0 #b07a00,0 2cqw 3cqw rgba(0,0,0,.35);margin-top:4cqw}
  .card.sg .btn.ghost{color:#fff;font:700 3.4cqw Inter,system-ui,sans-serif}
  .card.fail.sg{background:rgba(2,6,25,.9);justify-content:center;align-items:center;padding:0 8cqw}
  .sg-over{display:flex;gap:3cqw;margin-bottom:6cqw;font-size:14.5cqw;line-height:1}
  .sg-over span{color:#ff2b25;-webkit-text-stroke:.8cqw #fff;paint-order:stroke fill;text-shadow:0 1.4cqw 0 #5a0006;transform:skewX(-10deg)}
  .sg-over .l{animation:sgOverL .55s cubic-bezier(.2,1.3,.4,1) both}.sg-over .r{animation:sgOverR .55s cubic-bezier(.2,1.3,.4,1) both}
  @keyframes sgOverL{0%{transform:translateX(-90cqw) skewX(-10deg)}100%{transform:skewX(-10deg)}}
  @keyframes sgOverR{0%{transform:translateX(90cqw) skewX(-10deg)}100%{transform:skewX(-10deg)}}
  .card.fail.sg h1{font-family:'Lilita One',Inter,sans-serif;font-weight:400;color:#fff;font-size:7cqw;animation:sgPop .4s .5s both}.card.fail.sg p{color:#cfd8ff;animation:sgPop .4s .6s both}
  .card.fail.sg .stat{animation:sgPop .4s .7s both}.card.fail.sg .btn{animation:sgPop .4s .8s both}
  .card.start.leave .sg-band.blue,.card.start.leave .sg-checker.top{animation:sgOutL .36s ease-in both}.card.start.leave .sg-band.yellow,.card.start.leave .sg-band.red,.card.start.leave .sg-checker.bottom{animation:sgOutR .36s ease-in both}
  .card.start.leave .sg-logo,.card.start.leave .sg-tag{animation:sgOutUp .36s ease-in both}.card.start.leave .sg-how,.card.start.leave .sg-press{animation:sgOutDown .3s ease-in both}
  @keyframes sgOutL{to{transform:translateX(-120%) skewY(-5deg)}}@keyframes sgOutR{to{transform:translateX(120%) skewY(-5deg)}}@keyframes sgOutUp{to{transform:translateY(-60cqw);opacity:0}}@keyframes sgOutDown{to{transform:translateY(40cqw);opacity:0}}
  .greylabel{position:absolute;right:2cqw;bottom:1.4cqw;font-size:2.2cqw;color:rgba(255,255,255,.7);font-weight:700;letter-spacing:.08em}
  .frame.revealing .watch,.frame.revealing .rings,.frame.revealing .hint{opacity:0;transition:opacity .3s}
  html.embed,html.embed body{background:#000;overflow:hidden;height:100%}html.embed body{display:flex;align-items:center;justify-content:center}html.embed .frame{width:min(100vw,calc(100vh * 2 / 3));height:min(100vh,calc(100vw * 3 / 2));aspect-ratio:auto;margin:0}
  @media (min-aspect-ratio:131/200) and (max-aspect-ratio:17/25){html.embed .frame{width:100vw;height:100vh}}
  `;
  // ── sound (rule 32): every source goes sfx/music bus → master → limiter → speakers, so nothing clips and nothing jumps out.
  // Files from the sound stage (assets/audio/<cue>.mp3, already loudness-normalised) are used when present; the synth is the
  // fallback. Nothing plays before the first tap (ad slots start silent); the music bed sits ~8 dB under the effects and ducks
  // under the end screens; a cue never stacks more than 3 deep, and repeats vary pitch by a few percent so they never machine-gun.
  const SFX = (() => {
    let ac = null, muted = false, master, limiter, sfxBus, musicBus, musicSrc = null; const BUF = {}, LIVE = {};
    const CUES = ['ring', 'spill', 'boost', 'beep', 'go', 'win', 'fail', 'music', 'loop'], FETCHED = {};
    if (!SIM) CUES.forEach(c => { FETCHED[c] = fetch(`assets/audio/${c}.mp3`).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null); });   // download early, decode on the first tap
    let LOOPMETA = {}; if (!SIM) fetch('assets/audio/audio.json').then(r => r.ok ? r.json() : {}).then(j => { LOOPMETA = j || {}; }).catch(() => {});   // exact bar loop points measured by the sound stage
    const ctx = () => {
      if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
        if (ac) { limiter = ac.createDynamicsCompressor(); limiter.threshold.value = -6; limiter.knee.value = 4; limiter.ratio.value = 12; limiter.attack.value = .003; limiter.release.value = .15;
          master = ac.createGain(); master.gain.value = muted ? 0 : .85; sfxBus = ac.createGain(); sfxBus.gain.value = 1; musicBus = ac.createGain(); musicBus.gain.value = .4;
          sfxBus.connect(master); musicBus.connect(master); master.connect(limiter); limiter.connect(ac.destination);
          CUES.forEach(c => FETCHED[c] && FETCHED[c].then(ab => ab && ac.decodeAudioData(ab).then(b => { BUF[c] = b; }).catch(() => {}))); } }
      if (ac && ac.state === 'suspended') ac.resume(); return ac; };
    function tone(f, t, dur, type, g, slide) { const a = ctx(); if (!a) return; const o = a.createOscillator(), v = a.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur); v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g || .25, t + .005); v.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(v).connect(sfxBus); o.start(t); o.stop(t + dur + .02); }
    function noise(t, dur, g, lp) { const a = ctx(); if (!a) return; const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const src = a.createBufferSource(); src.buffer = b; const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 1200; const v = a.createGain(); v.gain.value = g || .3; src.connect(f).connect(v).connect(sfxBus); src.start(t); }
    function file(c, vary) {   // play a stage file; false when it is not loaded (the synth plays instead)
      const a = ctx(); if (!a || !BUF[c]) return false; LIVE[c] = (LIVE[c] || []).filter(n => n.on); if (LIVE[c].length >= 3) return true;
      const src = a.createBufferSource(); src.buffer = BUF[c]; if (vary) src.playbackRate.value = 1 + (Math.random() - .5) * .06; src.connect(sfxBus); const node = { on: true }; src.onended = () => { node.on = false; }; LIVE[c].push(node); src.start(); return true; }
    const now = () => (ctx() ? ac.currentTime : 0);
    return { unlock() { ctx(); }, get muted() { return muted; }, set muted(v) { muted = v; if (master) master.gain.setTargetAtTime(v ? 0 : .85, ac.currentTime, .05); },
      music(on) { const a = ctx(); if (!a) return; if (on) { const bed = BUF.music || BUF.loop; if (musicSrc || !bed) return; musicSrc = a.createBufferSource(); musicSrc.buffer = bed; musicSrc.loop = true; const lm = BUF.music ? LOOPMETA.music : null; if (lm && lm.loopEnd <= bed.duration) { musicSrc.loopStart = lm.loopStart; musicSrc.loopEnd = lm.loopEnd; }   /* sample-accurate loop on the bar line */ musicSrc.connect(musicBus); musicBus.gain.cancelScheduledValues(a.currentTime); musicBus.gain.setValueAtTime(0, a.currentTime); musicBus.gain.linearRampToValueAtTime(.4, a.currentTime + .6); musicSrc.start(); }
        else if (musicSrc) { const m = musicSrc; musicBus.gain.setTargetAtTime(0, a.currentTime, .25); setTimeout(() => { try { m.stop(); } catch (e) {} }, 1200); musicSrc = null; } },
      duck(on) { if (musicBus && ac) musicBus.gain.setTargetAtTime(on ? .15 : .4, ac.currentTime, .2); },
      beep(go) { if (file(go ? 'go' : 'beep')) return; const t = now(); tone(go ? 880 : 520, t, go ? .28 : .14, 'square', .07); },
      ring() { if (file('ring', true)) return; const t = now(); tone(1320, t, .07, 'square', .05); tone(1980, t + .05, .12, 'square', .05); },
      swish() {},
      tick() { const t = now(); tone(2400, t, .022, 'square', .025); },   // the tally's counting tick: tiny, quiet, synthesized (no file needed)
      spill() { if (file('spill')) return; const t = now(); for (let i = 0; i < 6; i++) tone(1500 - i * 120, t + i * .04, .1, 'square', .05); noise(t, .2, .25, 900); },
      boost() { if (file('boost')) return; const t = now(); tone(220, t, .5, 'sawtooth', .08, 600); noise(t, .5, .15, 2500); },
      win() { if (file('win')) return; const t = now(); [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * .11, .3, 'triangle', .18)); },
      fail() { if (file('fail')) return; const t = now(); tone(300, t, .25, 'sawtooth', .1, -110); tone(200, t + .22, .4, 'sawtooth', .1, -90); } };
  })();
  const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}<small>.${String(Math.floor((s % 1) * 100)).padStart(2, '0')}</small>`;
  const ZONECOL = ['#4a7a3a', '#1E50D0', '#d0661e'];
  function mount(VIEW) {
    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    if (!document.querySelector('link[href*="Inter"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@600;700;800;900&display=swap'; document.head.appendChild(l); }
    { const l2 = document.createElement('link'); l2.rel = 'stylesheet'; l2.href = 'https://fonts.googleapis.com/css2?family=Lilita+One&display=swap'; document.head.appendChild(l2); }
    const C = CONFIG.copy, mark = VIEW.brandLogo ? `<img src="${VIEW.brandLogo}" alt="Sonic 4">` : C.brand;
    const hand = `<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M42 92 V48 a8 8 0 0 1 16 0 v18 M58 60 a7 7 0 0 1 14 0 v10 M72 68 a6 6 0 0 1 12 0 v12 M42 70 a7 7 0 0 0 -14 0 v14" fill="none" stroke="#13233d" stroke-width="5" stroke-linecap="round"/></svg>`;
    document.body.innerHTML = `
    <div class="${VIEW.build ? 'frame loading' : 'frame'}" id="frame">
      <canvas id="game"></canvas>
      <div class="hud">
        <div class="brandmark">${mark}</div>
        <div class="watch" id="watch"><span id="time">0:00</span><span class="zd"><i class="on"></i><i></i><i></i></span></div>
        <div class="rings" id="rings"><i></i><span id="ringN">0</span></div>
        <div class="hint" id="hint">${C.hint}</div>
        ${VIEW.build ? '' : `<div class="greylabel">GREYBOX · ${VIEW.title.toUpperCase()}</div>`}
      </div>
      ${VIEW.build ? '<div class="loader" id="loader" role="progressbar"><div class="bar"><i id="loadBar"></i></div></div>' : ''}
      <div class="card start sg" id="startCard">
        <div class="sg-band blue"></div><div class="sg-checker top"></div><div class="sg-band yellow"></div>
        <div class="sg-logo">${mark}</div>
        <div class="sg-tag">${C.startTitle}</div>
        <div class="sg-how"><div class="sg-swipe"><i class="l"></i><span>${C.swipeWord}</span><i class="r"></i></div><p>${C.howLine}</p></div>
        <button class="sg-press" id="playBtn" type="button">${C.press}</button>
        <div class="sg-band red"><span>${C.dateBand}</span></div><div class="sg-checker bottom"></div></div>
      <div class="card win sg" id="winCard" hidden>
        <div class="sg-band blue small"><span>${C.clear}</span></div><div class="sg-checker mid"></div>
        <div class="sg-results"><div class="sg-hero" aria-hidden="true"></div>
          <div class="sg-tally"><div class="row"><b>${C.tTime}</b><span id="tTime">0.0</span></div><div class="row"><b>${C.tRings}</b><span id="tRings">0</span></div><div class="row total"><b>${C.tTotal}</b><span id="tTotal">0</span></div></div></div>
        <div class="sg-close"><div class="lockup">${mark}</div><h1>${C.winTitle}</h1><div class="stat" id="winStat" hidden></div>
          <button class="btn sg-cta" id="cta1" type="button">${C.cta}</button><button class="btn ghost" id="again1" type="button">${C.again}</button></div></div>
      <div class="card fail sg" id="failCard" hidden>
        <div class="sg-over"><span class="l">${C.over1}</span><span class="r">${C.over2}</span></div>
        <h1 id="failWhy"></h1><p>${C.failLine}</p><div class="stat" id="failStat"></div>
        <button class="btn sg-again" id="again2" type="button">${C.again}</button><button class="btn ghost" id="cta2" type="button">${C.cta}</button></div>
    </div>`;
    const $ = id => document.getElementById(id);
    const canvas = $('game'), ctx = canvas.getContext('2d');
    let W = 640, H = 960; const dpr = Math.min(1.5, devicePixelRatio || 1);   // phone budget: 1.5x is sharp at slot size, 2x costs 78% more pixels per frame
    const resize = () => { const r = $('frame').getBoundingClientRect(); W = r.width; H = r.height; canvas.width = W * dpr; canvas.height = H * dpr; };
    new ResizeObserver(resize).observe($('frame')); resize();
    function showCard(which) {
      const t = S.elapsed.toFixed(1), stat = `${t} s · ${S.ringsTotal} ${C.rings}`;
      if (which === 'win') { $('winStat').textContent = stat; $('winCard').hidden = false;
        const total = S.ringsTotal * 100 + Math.max(0, Math.round((30 - S.elapsed) * 500));
        const count = (id, to, ms, dec, done) => { const el = $(id), t0 = performance.now(); let lastTick = 0; const step = now => { const k = Math.min(1, (now - t0) / ms); el.textContent = (to * k).toFixed(dec); if (k < 1) { if (!SIM && now - lastTick > 55) { SFX.tick(); lastTick = now; } requestAnimationFrame(step); } else { if (!SIM) SFX.ring(); done && done(); } }; requestAnimationFrame(step); };   /* ticks WHILE the number climbs, the coin ding the moment it lands: sound and number move together */
        ['tTime', 'tRings', 'tTotal'].forEach(id => $(id).textContent = '0');
        setTimeout(() => count('tTime', S.elapsed, 450, 1, () => count('tRings', S.ringsTotal, 450, 0, () => count('tTotal', total, 700, 0))), 520); }
      else { $('failWhy').textContent = C.failWhy[S.why] || C.failWhy.norings; $('failStat').textContent = `${C.zoneNames[S.zone]} · ${t} s`; $('failCard').hidden = false; }
    }
    window.__showCard = showCard; window.__hideHud = on => $('frame').classList.toggle('revealing', !!on);
    const hideCards = () => { ['winCard', 'failCard', 'startCard'].forEach(i => $(i).hidden = true); $('frame').classList.remove('revealing'); };
    const startRound = () => { SFX.unlock(); const st = $('startCard');
      if (!st.hidden && !st.classList.contains('leave')) { st.classList.add('leave'); setTimeout(() => { st.classList.remove('leave'); hideCards(); reset('ready'); }, 380); }
      else if (st.hidden) { hideCards(); reset('ready'); } };
    window.DEMO = { start: () => { hideCards(); reset('attract'); $('startCard').hidden = false; }, slotMs: 20000, setAuto: () => {}, setSound: on => { SFX.muted = !on; } };
    $('playBtn').onclick = startRound; $('again1').onclick = startRound; $('again2').onclick = startRound;
    $('cta1').onclick = $('cta2').onclick = () => window.open(window.clickTag || CONFIG.ctaUrl, '_blank');
    // the swipe: a horizontal move of 6% of the frame width changes one lane, and re-anchors so one long drag can cross two
    let g = null;
    const fx = e => { const r = $('frame').getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
    $('frame').addEventListener('pointerdown', e => { try { const r = $('frame').getBoundingClientRect(); parent.postMessage({ iionTap: { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height } }, '*'); } catch (err) {}
      if (e.target.closest('.card')) return; if (S.mode === 'attract') { startRound(); } g = { x: fx(e), fired: false }; });
    $('frame').addEventListener('pointermove', e => { if (!g || BOT) return; const dx = fx(e) - g.x; if (Math.abs(dx) > 0.06) { swipe(Math.sign(dx), 'user'); g = { x: fx(e), fired: true }; } });
    const up = e => { if (g && !BOT && !g.fired && e.clientX != null) { const dx = fx(e) - g.x; if (Math.abs(dx) > 0.025) swipe(Math.sign(dx), 'user'); } g = null; };
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', () => { g = null; });
    window.addEventListener('keydown', e => { if (e.code === 'ArrowLeft') swipe(-1, 'user'); if (e.code === 'ArrowRight') swipe(1, 'user'); if (e.code === 'Space' && S.mode === 'attract') startRound(); });
    reset(BOT && !ATTRACT ? 'play' : 'attract');
    if (ATTRACT || BOT) $('startCard').hidden = true;
    let last = performance.now(), lastRings = -1; const FPS = { n: 0, acc: 0, v: 0 };
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (S.mode === 'attract' || (BOT && !ATTRACT && S.mode === 'play')) autopilot(dt);
      update(dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.save(); if (S.shake > 0) ctx.translate((Math.random() - .5) * 10 * S.shake, (Math.random() - .5) * 10 * S.shake);
      VIEW.drawFrame(ctx, S, W, H, CONFIG);
      ctx.restore();
      if (has('fps')) { FPS.n++; FPS.acc += dt; if (FPS.acc >= .5) { FPS.v = Math.round(FPS.n / FPS.acc); FPS.n = 0; FPS.acc = 0; } ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(W - 74, H - 30, 70, 24); ctx.fillStyle = FPS.v >= 50 ? '#6f6' : FPS.v >= 30 ? '#fd4' : '#f55'; ctx.font = '700 14px Inter, sans-serif'; ctx.textAlign = 'left'; ctx.fillText(FPS.v + ' fps', W - 66, H - 13); }   // ?fps: a frame counter for checking on a real phone
      $('time').innerHTML = fmt(S.elapsed); $('watch').style.setProperty('--zc', ZONECOL[S.zone]); $('watch').querySelectorAll('.zd i').forEach((d, i) => d.classList.toggle('on', i <= S.zone));
      if (S.rings !== lastRings) { const r = $('rings'); $('ringN').textContent = S.rings; r.classList.remove('bump'); void r.offsetWidth; r.classList.add(S.rings > lastRings ? 'bump' : 'x'); lastRings = S.rings; }
      $('rings').classList.toggle('zero', S.rings === 0 && S.mode === 'play' && S.elapsed > 2);
      const hint = $('hint'), cueOn = S.cue && S.elapsed < S.cue.until;
      hint.textContent = cueOn ? S.cue.text : S.elapsed < CONFIG.leadIn ? C.leadInHint : C.hint; hint.classList.toggle('cue', !!cueOn);
      hint.style.opacity = cueOn || S.mode === 'attract' || (S.mode === 'play' && !S.swiped) ? 1 : 0;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  const showCard = w => window.__showCard && window.__showCard(w);
  const hideHud = on => window.__hideHud && window.__hideHud(on);

  window.ZoneDash = {
    CONFIG, roadX, roadY,
    run(VIEW) {
      G = VIEW.geometry();
      if (VIEW.config) Object.assign(CONFIG, VIEW.config);   // a view may tune its own course (its band, rule 5), never the rules
      VIEW.layers = makeLayers(VIEW);
      VIEW.drawFrame = VIEW.drawFrame || ((ctx, Sx, W, H) => render(ctx, Sx, W, H, VIEW));
      if (SIM) runSim(); layerRoutes(VIEW);
      if (has('embed') || has('full')) document.documentElement.classList.add('embed');
      mount(VIEW);
      if (VIEW.build && window.LAYERS) {   // gate: nothing shows until every picture and the meta have settled (a missing supplied layer counts as settled: its grey shape stays); 10 s cap
        const expect = 1 + VIEW.layers.filter(L => ['plate', 'sprite', 'sheet', 'viewmodel', 'mask-texture', 'particle', 'occluder', 'tile'].includes(L.type)).length; let done = 0, ready = false;
        const reveal = () => { if (ready) return; ready = true; setTimeout(() => { const l = document.getElementById('loader'); if (l) { l.classList.add('done'); setTimeout(() => { l.hidden = true; }, 500); } document.getElementById('frame').classList.remove('loading'); }, 250); };
        window.LAYERS.load(VIEW.layers, 'assets/game/', () => { done++; const b = document.getElementById('loadBar'); if (b) b.style.width = Math.min(100, Math.round(done / expect * 100)) + '%'; if (done >= expect) reveal(); });
        setTimeout(reveal, 10000);
      } else if (window.LAYERS) window.LAYERS.load(VIEW.layers, 'assets/game/');
      window.GAME = { get S() { return S; }, CONFIG, reset, swipe };
      const qc = Q.get('card'); if (qc) setTimeout(() => { ['startCard', 'winCard', 'failCard'].forEach(i => { const el = document.getElementById(i); if (el) el.hidden = true; }); S.mode = qc === 'win' ? 'win' : 'fail'; S.elapsed = 19.4; S.ringsTotal = 23; S.why = 'norings'; S.zone = 2; showCard(qc); hideHud(true); }, 200);
    },
    helpers: { clamp, rand },
  };
})();
