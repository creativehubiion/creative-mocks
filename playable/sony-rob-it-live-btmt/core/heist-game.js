// sony-htrab-01 greybox v3: "Rob it live", free movement. Over-the-shoulder camera behind the wolf-masked robber.
// One thumb: DRAG anywhere to move (up = forward, sideways = left/right, down = back), let go to stop; TAP a hack icon to hack it.
// The lobby is a free room: a guard patrols with a sight cone, a security camera pans; pillars block sight (hide behind them).
// Objectives (marker in the world): get to the security door → hack the keypad → laser corridor → crack the vault.
// Hooks: ?bot · ?sim&n= · ?card=win|fail · ?cfg={json}
(() => {
  const Q = new URLSearchParams(location.search);
  const CONFIG = Object.assign({
    vault: 'lockpick', pinW: [16, 12, 9], pinHold: 0.6, stressT: 1.4,   // vault: 'lockpick' | 'dial'
    guardInstant: true, camInstant: true,   // any red light busts on contact (owner 18:40: otherwise you can run straight through)   // the guard's cone busts on contact (owner 18:02)
    sneak: 1.6, run: 4.4, runAt: 0.62, hear: 0,   // stick bands: below runAt sneaks (silent), above runs (heard within hear m)
    time: 0, speed: 4.4, stars: 3, fill: 0.6, drain: 1.0, grace: 0.9,   // time 0 = no clock (owner 16:18: no time pressure for now)
    fovY: 62, camBack: 2.9, camH: 1.95, camSide: 0.6, pitch: 7, capH: 2.2, capPitch: 9,   // closer, lower third person (owner 18:39: hero large like the reference frames); plates were captured at capH / capPitch
    guardSpeed: 1.5, guardLook: 1.6, guardTell: 1.0, guardHalf: 35, guardRange: 30,   // instant bust: a longer warning, a tighter cone (owner 18:02)
    tvTime: 1e6, guardWall: false, guardBand: [2.4, 1.6], guardCircle: false, guardRadius: 7.2, tvHalf: 16, patrolLRC: true, guardLookC: 2.6, guardWake: 4, cctvPark: false,
    camHalf: 22, camRange: 11, laserOn: 1.3, laserOff: 1.6, laserHack: 5, dialZones: [70, 52, 38], dialSpeed: 190,
  }, JSON.parse(Q.get('cfg') || '{}'));
  const W = 640; let H = 960; const D2R = Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let seed = 777; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);

  // ── the bank ──
  const ROOM = { lobby: { x0: -6, x1: 6, z0: 0, z1: 30 }, corr: { x0: -2, x1: 2, z0: 30, z1: 54 }, vault: { x0: -5, x1: 5, z0: 54, z1: 64 } };
  const BOX = [
    ...[10, 17, 24].flatMap(z => [{ x0: -3.1, x1: -2.1, z0: z - 0.5, z1: z + 0.5, h: 5, c: 'pillar' }, { x0: 2.1, x1: 3.1, z0: z - 0.5, z1: z + 0.5, h: 5, c: 'pillar' }]),
    { x0: 4.5, x1: 6, z0: 5, z1: 28.5, h: 1.15, c: 'desk' },         // the teller line along the right wall (blocks bodies, not sight)
    ...[6, 13, 20].map(z => ({ x0: -6, x1: -5.1, z0: z - 0.6, z1: z + 0.6, h: 0.95, c: 'bench' })),   // customer writing desks on the left wall
    { x0: 1.5, x1: 1.7, z0: 3.4, z1: 8.1, h: 0.95, c: 'rope' },
    ...[0, 4, 8, 12, 16, 20, 24, 28].flatMap(z => [{ x0: -6, x1: -5.8, z0: z - 0.37, z1: z + 0.37, h: 1.0, c: 'trim' }, { x0: 5.8, x1: 6, z0: z - 0.37, z1: z + 0.37, h: 1.0, c: 'trim' }]),   // wall pilasters (owner 20:40)     // the brass posts + velvet rope queue line (owner 18:54: collides; waist-high, so sight passes)

  ];
  const GUARD = { z: 20.5, x0: -4.2, x1: 4.2 };              // walks across the hall at z 20.5, stops at each end to look down the hall
  const TV = { x: 5.92, y: 2.6, z: 17.5 };   // by the middle right pillar: hack it from the pillar's shadow (owner 22:40)
  const CCTV = { x: -5.8, z: 13, h: 3.4, red: 18, away: -82, tRed: 2.2, tAway: 2.6, tSwing: 0.6 };
  const CAMWALLS = [{ x0: -6, x1: -1.1, z0: 29.9, z1: 30.1, h: 5 }, { x0: 1.1, x1: 6, z0: 29.9, z1: 30.1, h: 5 }, { x0: -5, x1: -2, z0: 53.9, z1: 54.1, h: 5 }, { x0: 2, x1: 5, z0: 53.9, z1: 54.1, h: 5 }];   // doorway walls: the camera arm only
  const DOOR = { z: 30, keypad: { x: 1.4, y: 1.3, z: 29.95 } };
  const LASERS = [37, 42, 47].map((z, i) => ({ z, off: i * 0.95 }));
  const LASERBOX = { x: -1.95, y: 1.4, z: 33 };
  const VAULT = { z: 64, stop: 58.5 };
  const HACKS = [
    { id: 'cctv', name: 'CCTV', act: 'LOOP IT', glyph: 'cam', pos: () => [CCTV.x + 0.2, CCTV.h, CCTV.z], reach: 13 },
    { id: 'tv', name: 'LOBBY TV', act: 'PUT YOUR STREAM ON', glyph: 'tv', pos: () => [TV.x, TV.y, TV.z], reach: 10.3 },   // from either middle pillar's shadow, left or right (owner 23:09)
    { id: 'keypad', name: 'SECURITY DOOR', act: 'HACK', glyph: 'lock', pos: () => [DOOR.keypad.x, DOOR.keypad.y, DOOR.keypad.z], reach: 3.2 },
    { id: 'lasers', name: 'LASER GRID', act: 'SHUT DOWN', glyph: 'bolt', pos: () => [LASERBOX.x, LASERBOX.y, LASERBOX.z], reach: 5 },
  ];
  const C = {
    live: 'LIVE', hint: 'Drag to move', move: 'Stay out of the red light',
    cctv: 'Get close to the CCTV to hack it', guard: 'He\'s looking this way! Get behind a pillar', tv: 'Hack the TV: he will turn to watch it',
    keypad: 'Get to the keypad by the door', wall: 'He sees everything in his circle. Put your stream on the TV', tvwalk: 'He is heading for the TV. Slip behind him', puzzle: 'Turn the pieces to route the power to the lock', lasers: 'Cross when the lasers switch off',
    dial: 'Drag the pick slowly. Hold still where it shakes most', spotted: 'Spotted! Get out of sight',
    winT: 'Heist complete', failT: 'BUSTED', timeT: 'Out of time', watched: 'watched you live',
    chat: { start: ['LIVE!! let\'s make content', 'wolf is back', 'go go go'], spot: ['HE SAW YOU', 'run!!', 'noooo'], hack: ['big brain', 'EZ'], tv: ['hes watching US lol', 'say hi to the guard'],
      tell: ['he\'s turning!!', 'HIDE'], door: ['door\'s open!', 'nice'], laser: ['lasers bro', 'careful'], vault: ['THE VAULT', 'crack it!!'], win: ['LEGEND', 'we\'re rich', 'GG'],
      idle: ['sneaky sneaky', 'is this a real bank??', 'W stream', '🔥🔥🔥', 'the guard is so slow lol', 'ROB IT', 'clip it!!', 'no way he pulls this off', 'hi from Jakarta 👋', 'mask goes hard', 'watch the camera', '😂😂', 'sub sub sub', 'left side!!', 'bro is actually robbing a bank on stream', 'the guard has no idea this is going out live', 'wait for the guard to look away first!!'],
      idleTv: ['the guard is glued to the TV 😂', 'bro is watching his own robbery', 'GO GO while he watches', 'he has no idea', 'imagine watching yourself get robbed', 'he likes the stream lol', 'new viewer: the guard', 'stay behind him!!'],
      idleCorr: ['LASERS 😳', 'time it time it', 'dont touch the red!!', 'wait for the gap', 'my heart rn', 'NOW GO', 'so close to the vault', 'this corridor is insane'],
      idleVault: ['THE VAULT 🔥', 'crack it slow', 'hands steady bro', 'how much is in there??', 'listen for the click', 'dont rush it', 'we are so rich', 'chat is shaking'] },
  };

  // ── world as functions of time ──
  const gWalk = () => (GUARD.x1 - GUARD.x0) / CONFIG.guardSpeed, gCycle = () => 2 * (gWalk() + CONFIG.guardTell + CONFIG.guardLook);
  function guardAt(gt) {   // gt: the guard's own clock (stops while he watches the TV)
    if (CONFIG.patrolLRC) { const w = gWalk(), h = w / 2, tl = CONFIG.guardTell, T = 2 * h + w + tl + CONFIG.guardLookC, u = ((gt % T) + T) % T;   // centre -> left -> right -> centre, tell, look down the hall (owner 22:50)
      if (u < h) return { x: (u / h) * GUARD.x0, a: 180, mode: 'walk' };
      if (u < h + w) return { x: GUARD.x0 + ((u - h) / w) * (GUARD.x1 - GUARD.x0), a: 0, mode: 'walk' };
      if (u < 2 * h + w) return { x: GUARD.x1 * (1 - (u - h - w) / h), a: 180, mode: 'walk' };
      if (u < 2 * h + w + tl) return { x: 0, a: -90, mode: 'tell' };
      return { x: 0, a: -90, mode: 'look' }; }
    const T = gCycle(), u = ((gt % T) + T) % T, w = gWalk(), L = CONFIG.guardTell + CONFIG.guardLook;
    if (u < w) return { x: GUARD.x0 + (u / w) * (GUARD.x1 - GUARD.x0), a: 0, mode: 'walk' };
    if (u < w + CONFIG.guardTell) return { x: GUARD.x1, a: 0, mode: 'tell' };
    if (u < w + L) return { x: GUARD.x1, a: -90, mode: 'look' };
    const v = u - w - L; if (v < w) return { x: GUARD.x1 - (v / w) * (GUARD.x1 - GUARD.x0), a: 180, mode: 'walk' };
    if (v < w + CONFIG.guardTell) return { x: GUARD.x0, a: 180, mode: 'tell' };
    return { x: GUARD.x0, a: -90, mode: 'look' };
  }
  const TVSPOT = 3.0;   // where he stands to watch the TV (owner 23:59: never from a corner that blocks the way)
  const tvGuard = (s, t) => { const k = Math.max(0, t - (s.tvAt == null ? t : s.tvAt)) * CONFIG.guardSpeed, x0 = s.tvFromX == null ? TVSPOT : s.tvFromX, d = TVSPOT - x0, x = Math.abs(d) <= k ? TVSPOT : x0 + Math.sign(d) * k; return { x, a: Math.atan2(TV.z - GUARD.z, TV.x - x) / D2R, mode: x === TVSPOT ? 'tv' : 'walk' }; };
  function guard(s) { const g = guardAt(s.gt); if (s.end === 'busted' && s.seen === 'guard') return { x: g.x, a: Math.atan2(s.z - GUARD.z, s.x - g.x) / D2R, mode: 'look' }; if (s.t < s.tvUntil) return tvGuard(s, s.t); return g; }
  function cctvAngle(t, ph) { const T = CCTV.tRed + CCTV.tAway + 2 * CCTV.tSwing; let u = ((t + ph * T) % T + T) % T; const e = k => k * k * (3 - 2 * k);
    if (u < CCTV.tRed) return CCTV.red; u -= CCTV.tRed; if (u < CCTV.tSwing) return CCTV.red + (CCTV.away - CCTV.red) * e(u / CCTV.tSwing); u -= CCTV.tSwing; if (u < CCTV.tAway) return CCTV.away; u -= CCTV.tAway; return CCTV.away + (CCTV.red - CCTV.away) * e(u / CCTV.tSwing); }
  const laserOn = (L, t, s) => t >= s.laserHackUntil && (((t + L.off + s.lOff) % (CONFIG.laserOn + CONFIG.laserOff)) < CONFIG.laserOn);
  function blocked(ax, az, bx, bz) {
    const dx = bx - ax, dz = bz - az;
    for (const b of BOX) { if (b.h < 2) continue; let t0 = 0.001, t1 = 0.999;
      if (Math.abs(dx) > 1e-9) { let p = (b.x0 - ax) / dx, q = (b.x1 - ax) / dx; if (p > q) [p, q] = [q, p]; t0 = Math.max(t0, p); t1 = Math.min(t1, q); } else if (ax < b.x0 || ax > b.x1) continue;
      if (Math.abs(dz) > 1e-9) { let p = (b.z0 - az) / dz, q = (b.z1 - az) / dz; if (p > q) [p, q] = [q, p]; t0 = Math.max(t0, p); t1 = Math.min(t1, q); } else if (az < b.z0 || az > b.z1) continue;
      if (t0 <= t1) return true; }
    return false;
  }
  function inCone(ox, oz, a, half, range, x, z) { const dx = x - ox, dz = z - oz, d = Math.hypot(dx, dz); if (d > range) return false; let da = Math.atan2(dz, dx) / D2R - a; da = ((da + 540) % 360) - 180; return Math.abs(da) <= half && !blocked(ox, oz, x, z); }
  const camAng = (s, t) => s.cctvLive || !CONFIG.cctvPark ? cctvAngle((s.camT == null ? t : s.camT + (t - s.t)), s.cPh) : 55;   // parked up the hall until its tutorial (owner 22:59)
  function seenAt(s, x, z, t, gt, looped, tvUntil) {
    if (z > ROOM.lobby.z1) return null;
    if (t < looped && inCone(CCTV.x, CCTV.z, camAng(s, t), CONFIG.camHalf, CONFIG.camRange, x, z)) return 'cctv';
    if (CONFIG.guardWall && t >= tvUntil && z > GUARD.z - CONFIG.guardBand[0] && z < GUARD.z + CONFIG.guardBand[1]) return 'guard';   // his line: no sneaking past unless he is watching the TV (owner 22:35)
    if (CONFIG.guardCircle && t >= tvUntil && inCone(guardAt(gt).x, GUARD.z, 0, 180, CONFIG.guardRadius, x, z)) return 'guard';   // his circle, with pillar shadows: only the TV turns it into a cone
    const g0 = guardAt(gt), g = t < tvUntil ? tvGuard(s, t) : g0;
    if (inCone(g.x, GUARD.z, g.a, t < tvUntil && CONFIG.guardCircle ? CONFIG.tvHalf : CONFIG.guardHalf, CONFIG.guardRange, x, z)) return 'guard';   // watching the TV he still sees what is in front of him
    return null;
  }

  // ── a round ──
  function newRound(mode) {
    return { mode, t: 0, gt: CONFIG.patrolLRC ? 2 * gWalk() + CONFIG.guardTell + 0.01 : rnd() * gCycle(), cPh: rnd(), lOff: rnd() * 3, clock: CONFIG.time, started: false, x: -4.9, z: 0.9, vx: 0, vz: 0, face: 90, cctvLive: false, walk: 0,
      meter: 0, stars: 0, grace: 0, looped: 1e9, tvUntil: -9, laserHackUntil: -9, hacking: null, mini: null, door: false, puzzle: null, dial: null,
      end: null, endT: 0, viewers: 150000, bestZ: 2, ev: [], seen: null, by: [] };
  }
  // where the robber may stand: rooms joined by the door (open only once hacked) and the vault stop line while the dial runs
  function walkable(s, x, z) {
    const r = 0.42, inR = (R) =>    x >= R.x0 + r && x <= R.x1 - r && z >= R.z0 + r && z <= R.z1 - r;
    let ok = inR(ROOM.lobby) || (s.door && (inR(ROOM.corr) || inR(ROOM.vault) || (Math.abs(x) <= 0.8 && z > 29 && z < 31) || (Math.abs(x) <= 1.6 && z > 53 && z < 55)));   // doorways
    if (ok && z > ROOM.lobby.z1 - r && z < ROOM.corr.z0 + r + 0.01 && !(Math.abs(x) <= 0.8)) ok = inR(ROOM.corr) && z > 30.3;
    if (s.dial && !s.dial.done && z > VAULT.stop) ok = false;
    if (!ok) return false;
    for (const b of BOX) if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return false;
    return true;
  }
  function move(s, cx, cz, dt) {
    let L = Math.hypot(cx, cz); if (L > 1) { cx /= L; cz /= L; L = 1; }
    const v = L < 0.08 ? 0 : 0.9 + (CONFIG.run - 0.9) * Math.pow((L - 0.08) / 0.92, 1.2);   // walk → fast walk → run, continuous (owner 17:43)
    s.running = L > CONFIG.runAt + 0.02; const ux = L ? cx / L : 0, uz = L ? cz / L : 0;
    const k = Math.min(1, dt * 12); s.vx += (ux * v - s.vx) * k; s.vz += (uz * v - s.vz) * k;
    const nx = s.x + s.vx * dt, nz = s.z + s.vz * dt;
    if (walkable(s, nx, nz)) { s.x = nx; s.z = nz; } else if (walkable(s, nx, s.z)) { s.x = nx; s.vz = 0; } else if (walkable(s, s.x, nz)) { s.z = nz; s.vx = 0; } else { s.vx = s.vz = 0; }
    const sp = Math.hypot(s.vx, s.vz); s.walk += sp * dt; if (sp > 0.3) s.face = Math.atan2(s.vz, s.vx) / D2R;
  }
  const near = (s, h) => { const p = h.pos(); return Math.hypot(p[0] - s.x, p[2] - s.z) <= h.reach; };
  function hackable(s, h) {
    if (s.hacking || s.mini || s.end) return false;
    if (h.id === 'cctv' && s.looped < 1e9) return false;
    if (h.id === 'tv' && s.t < s.tvUntil + 1.5) return false;
    if (h.id === 'keypad' && (s.door || s.puzzle)) return false;
    if (h.id === 'lasers') return false;   // lasers are timing only (owner 22:31)
    return near(s, h);
  }
  const PR = 3, PC = 4, N_ = 1, E_ = 2, S_ = 4, W_ = 8, OPP = { 1: 4, 2: 8, 4: 1, 8: 2 }, STEP = { 1: [-1, 0], 2: [0, 1], 4: [1, 0], 8: [0, -1] };
  const rotMask = (m, r) => { for (let i = 0; i < r; i++) m = ((m << 1) | (m >> 3)) & 15; return m; };
  function makeGrid() {   // Watch Dogs-style: 3 x 4 pieces, route power from the left of row 1 to the lock on the right edge
    let r = 1, c = 0, from = W_, exitRow = 1; const path = new Map(), key = (r, c) => r * PC + c;
    for (let g = 0; g < 40; g++) {
      const opts = [];
      if (c === PC - 1) opts.push(E_);
      else { opts.push(E_, E_); if (r > 0 && !path.has(key(r - 1, c)) && from !== N_) opts.push(N_); if (r < PR - 1 && !path.has(key(r + 1, c)) && from !== S_) opts.push(S_); }
      let to = opts[Math.floor(rnd() * opts.length)];
      if ((to === N_ || to === S_) && path.has(key(r + STEP[to][0], c))) to = E_;
      path.set(key(r, c), from | to);
      if (to === E_ && c === PC - 1) { exitRow = r; break; }
      r += STEP[to][0]; c += STEP[to][1]; from = OPP[to];
    }
    const tiles = [];
    for (let i = 0; i < PR * PC; i++) {
      const need = path.has(i) ? path.get(i) : null;
      const base = need != null ? ((need === (N_ | S_) || need === (E_ | W_)) ? (E_ | W_) : (N_ | E_)) : [E_ | W_, N_ | E_, N_ | E_ | W_][Math.floor(rnd() * 3)];
      let rot = Math.floor(rnd() * 4);
      if (need != null) { let k = 0; while (rotMask(base, k) !== need) k++; rot = (k + 4 - (rnd() < 0.7 ? 1 : 2)) % 4; }   // one tap away, sometimes two
      tiles.push({ base, rot, need });
    }
    return { tiles, exitRow, done: false, doneT: 0 };
  }
  function powered(pz) {
    const on = new Set(), q = [], m0 = rotMask(pz.tiles[PC].base, pz.tiles[PC].rot);
    if (m0 & W_) { on.add(PC); q.push([1, 0]); }
    while (q.length) {
      const [r, c] = q.shift(), m = rotMask(pz.tiles[r * PC + c].base, pz.tiles[r * PC + c].rot);
      for (const d of [N_, E_, S_, W_]) if (m & d) {
        const nr = r + STEP[d][0], nc = c + STEP[d][1]; if (nr < 0 || nr >= PR || nc < 0 || nc >= PC) continue;
        const k = nr * PC + nc; if (on.has(k)) continue;
        if (rotMask(pz.tiles[k].base, pz.tiles[k].rot) & OPP[d]) { on.add(k); q.push([nr, nc]); }
      }
    }
    return on;
  }
  const gridSolved = (pz) => { const k = pz.exitRow * PC + PC - 1; return powered(pz).has(k) && (rotMask(pz.tiles[k].base, pz.tiles[k].rot) & E_) > 0; };
  function act(s, a) {
    if (s.end) return;
    if (a.exit) { if (s.mini) { if (s.mini.id === 'cctv') s.cctvLive = true; s.mini = null; } else if (s.puzzle && !s.puzzle.done) s.puzzle = null; else if (s.dial && !s.dial.done) { s.dial = null; s.z = Math.max(ROOM.corr.z1 + 0.6, s.z - 1.6); } s.ev.push('exit'); return; }
    if (a.tap) { const h = HACKS.find(x => x.id === a.tap); if (h && hackable(s, h)) { s.started = true; if (h.id === 'keypad') s.hacking = { id: h.id, t: 0.2 }; else if (h.id === 'tv' && !Q.has('oldhack') && !Q.has('remote')) { const ft = 0.15 + rnd() * 0.7; let f0 = rnd(); if (Math.abs(f0 - ft) < 0.35) f0 = ft > 0.5 ? ft - 0.4 : ft + 0.4; s.mini = { id: 'tv', kind: 'tuner', f: f0, ft, lockT: 0, done: false, doneT: 0 }; }
        else if (h.id === 'tv' && !Q.has('oldhack')) { const code = String(10 + Math.floor(rnd() * 89)); s.mini = { id: 'tv', kind: 'remote', code, typed: '', flash: 0, press: null, pressT: 0, done: false, doneT: 0 }; } else if (h.id === 'cctv' && !Q.has('oldhack')) { const pt = [0, 1, 2]; for (let i = 2; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [pt[i], pt[j]] = [pt[j], pt[i]]; } if (pt[0] === 0 && pt[1] === 1) [pt[0], pt[2]] = [pt[2], pt[0]]; s.mini = { id: 'cctv', kind: 'wires', ports: pt, conn: [false, false, false], glitch: 0, flash: 0, done: false, doneT: 0 }; } else s.mini = { id: h.id, u: 0, dir: 1, zone: 0.3 + rnd() * 0.4, w: 0.24, lock: 0, flash: 0 }; } return; }
    if (a.tune != null && s.mini && s.mini.kind === 'tuner' && !s.mini.done) { const m = s.mini; m.f = clamp(m.f + a.tune, 0, 1); return; }
    if (a.broadcast && s.mini && s.mini.kind === 'tuner' && !s.mini.done) { const m = s.mini; m.press = 0.2; if (Math.abs(m.f - m.ft) < 0.012) { m.done = true; m.doneT = s.t; m.f = m.ft; s.ev.push('looped'); } else { m.fail = 1.4; s.ev.push('miss'); } return; }   // the BROADCAST button decides (owner 00:10)
    if (a.key && s.mini && s.mini.kind === 'remote' && !s.mini.done) { const m = s.mini, k = a.key; m.press = k; m.pressT = 0.18; s.ev.push('key');
      if (k === 'ok') { if (m.typed === m.code) { m.done = true; m.doneT = s.t; s.ev.push('looped'); } else { m.flash = 0.5; m.typed = ''; s.ev.push('miss'); } }
      else if (m.typed.length < 2) { const t2 = m.typed + k; if (m.code.startsWith(t2)) m.typed = t2; else { m.flash = 0.5; m.typed = ''; s.ev.push('miss'); } } return; }
    if (a.wire && s.mini && s.mini.kind === 'wires' && !s.mini.done) { const m = s.mini, { from, to } = a.wire; if (m.ports[to] === from && !m.conn[from]) { m.conn[from] = true; m.glitch = 0.35; s.ev.push('wire'); if (m.conn.every(Boolean)) { m.done = true; m.doneT = s.t; s.ev.push('looped'); } } else { m.flash = 0.35; s.ev.push('miss'); } return; }
    if (a.mini && s.mini && s.mini.lock <= 0) { if (Math.abs(s.mini.u - s.mini.zone) <= s.mini.w / 2) { s.hacking = { id: s.mini.id, t: 0.2 }; s.mini = null; } else { s.mini.lock = 0.4; s.mini.flash = 0.4; s.ev.push('miss'); } return; }
    if (a.tile != null && s.puzzle && !s.puzzle.done) { const tl = s.puzzle.tiles[a.tile]; tl.rot = (tl.rot + 1) % 4; if (gridSolved(s.puzzle)) { s.puzzle.done = true; s.puzzle.doneT = s.t; s.ev.push('solved'); } return; }
    if (a.dial && s.dial && !s.dial.done && s.dial.lock <= 0) {
      const da = ((s.dial.a - s.dial.zone + 540) % 360) - 180, w = CONFIG.dialZones[s.dial.hits] / 2;
      if (Math.abs(da) <= w) { s.dial.hits++; s.dial.flash = 0.35; s.ev.push('bolt'); s.viewers += 300000; if (s.dial.hits >= 3) { s.dial.done = true; s.end = 'win'; s.ev.push('win'); s.viewers += 2500000; } else s.dial.zone = (s.dial.zone + 120 + rnd() * 120) % 360; }
      else { s.dial.lock = 0.8; s.dial.flash = -0.35; s.ev.push('miss'); }
    }
  }
  function step(s, dt, cx, cz) {
    s.t += dt; s.ev.length = 0; if (s.end) { s.endT += dt; return; }
    if ((cx || cz) && !s.started) s.started = true; if (s.started && CONFIG.time > 0) s.clock -= dt;
    const held = !!(s.mini || s.hacking || (s.puzzle && !s.puzzle.done) || (s.dial && !s.dial.done)); s.camT = (s.camT == null ? s.t - dt : s.camT) + (held ? 0 : dt);   // a hack panel holds the world (owner 23:03)
    if (!held && s.t >= s.tvUntil && (!CONFIG.patrolLRC || s.walk > CONFIG.guardWake)) s.gt += dt;   // stops while he watches the TV; at the start he holds his look down the hall until you have moved a few metres (owner 22:57)
    const busy = (s.puzzle && !s.puzzle.done) || (s.dial && !s.dial.done) || s.hacking || s.mini;
    if (s.mini && s.mini.kind === 'tuner') { const m = s.mini; if (!m.done) { m.fail = Math.max(0, (m.fail || 0) - dt); m.press = Math.max(0, (m.press || 0) - dt); } else if (s.t - m.doneT > 1.3) { s.hacking = { id: 'tv', t: 0.44 }; s.mini = null; } }
    else if (s.mini && s.mini.kind === 'remote') { const m = s.mini; m.flash = Math.max(0, m.flash - dt); m.pressT = Math.max(0, m.pressT - dt); if (m.done && s.t - m.doneT > 1.2) { s.hacking = { id: 'tv', t: 0.44 }; s.mini = null; } }
    else if (s.mini && s.mini.kind === 'wires') { const m = s.mini; m.glitch = Math.max(0, m.glitch - dt); m.flash = Math.max(0, m.flash - dt); if (m.done && s.t - m.doneT > 1.1) { s.hacking = { id: 'cctv', t: 0.44 }; s.mini = null; } }
    else if (s.mini) { const m = s.mini; m.u += dt * 1.5 * m.dir; if (m.u > 1) { m.u = 2 - m.u; m.dir = -1; } if (m.u < 0) { m.u = -m.u; m.dir = 1; } m.lock -= dt; m.flash *= 0.9; }
    const zPrev = s.z; move(s, busy ? 0 : cx, busy ? 0 : cz, dt);
    if (s.hacking) { s.hacking.t += dt; if (s.hacking.t >= 0.45) { const id = s.hacking.id; s.hacking = null; s.ev.push('hack:' + id); s.viewers += 220000;
      if (id === 'cctv') s.looped = s.t; if (id === 'tv') { s.tvUntil = s.t + CONFIG.tvTime; s.tvAt = s.t; s.tvFromX = guardAt(s.gt).x; } if (id === 'keypad') s.puzzle = makeGrid(); if (id === 'lasers') s.laserHackUntil = s.t + CONFIG.laserHack; } }
    if (s.puzzle && s.puzzle.done && !s.door && s.t - s.puzzle.doneT > 0.5) { s.door = true; s.ev.push('door'); s.viewers += 200000; }
    if (!s.dial && s.z >= VAULT.stop - 0.3 && s.door) { s.dial = CONFIG.vault === 'dial' ? { a: rnd() * 360, hits: 0, zone: 90 + rnd() * 180, lock: 0, done: false, flash: 0 } : { pick: true, a: -60 + rnd() * 20, sweet: -55 + rnd() * 110, pins: 0, hold: 0, stress: 0, snap: 0, done: false, flash: 0, held: false, lastA: 0, still: 0 }; s.ev.push('vault'); s.vx = s.vz = 0; }
    if (s.dial && !s.dial.done && !s.dial.pick) { s.dial.a = (s.dial.a + CONFIG.dialSpeed * (1 + 0.25 * s.dial.hits) * dt) % 360; s.dial.lock -= dt; s.dial.flash *= 0.9; }
    if (s.dial && s.dial.pick && !s.dial.done) { const d = s.dial; d.flash *= 0.9; d.snap -= dt;
      const moved = Math.abs(d.a - d.lastA); d.lastA = d.a; d.still = moved < 0.25 ? d.still + dt : 0;   // a still thumb
      const off = Math.abs(d.a - d.sweet), inSweet = off <= CONFIG.pinW[d.pins] / 2;
      if (d.snap > 0 || !d.held) { d.hold = Math.max(0, d.hold - dt * 2); d.stress = Math.max(0, d.stress - dt); }
      else if (inSweet && d.still > 0.05) { d.hold += dt; d.stress = Math.max(0, d.stress - dt); if (d.hold >= CONFIG.pinHold) { d.pins++; d.hold = 0; d.flash = 0.4; s.ev.push('bolt'); s.viewers += 350000; if (d.pins >= 3) { d.done = true; s.end = 'win'; s.ev.push('win'); s.viewers += 2500000; } else { let n; do { n = -55 + rnd() * 110; } while (Math.abs(n - d.sweet) < 35); d.sweet = n; } } }
      else if (!inSweet && d.still > 0.3) { d.hold = Math.max(0, d.hold - dt * 2); d.stress += dt / CONFIG.stressT; if (d.stress >= 1) { d.stress = 0; d.snap = 0.8; d.flash = -0.4; s.ev.push('snap'); } }
      else d.hold = Math.max(0, d.hold - dt * 2);
    }
    s.seen = held || s.safe ? null : seenAt(s, s.x, s.z, s.t, s.gt, s.looped, s.tvUntil);
    if (CONFIG.hear > 0 && !s.seen && s.running && s.z < ROOM.lobby.z1 && Math.hypot(s.x - guard(s).x, s.z - GUARD.z) < CONFIG.hear) s.seen = 'heard';
    if ((s.seen === 'guard' && CONFIG.guardInstant) || (s.seen === 'cctv' && CONFIG.camInstant)) { s.stars = CONFIG.stars; s.by.push(s.seen + '@' + Math.round(s.z)); s.end = 'busted'; s.ev.push('spotted', 'busted'); return; }   // a person saw you: busted
    if (s.grace > 0) s.grace -= dt; else if (s.seen) { s.meter += dt / CONFIG.fill; if (s.meter >= 1) star(s, s.seen); } else s.meter = Math.max(0, s.meter - dt * CONFIG.drain);
    for (const L of LASERS) if (!s.safe && laserOn(L, s.t, s) && zPrev < L.z + 0.15 && s.z > L.z - 0.25 && s.grace <= 0) { s.stars = CONFIG.stars; s.by.push('laser@' + Math.round(s.z)); s.seen = 'laser'; s.end = 'busted'; s.ev.push('spotted', 'busted'); break; }   // a laser is an instant bust (owner 22:42)
    if (s.z > s.bestZ) { s.viewers += (s.z - s.bestZ) * 16000; s.bestZ = s.z; }
    if (s.stars >= CONFIG.stars) { s.end = 'busted'; s.ev.push('busted'); } else if (CONFIG.time > 0 && s.clock <= 0) { s.end = 'time'; s.ev.push('time'); }
  }
  function star(s, by) { s.stars++; s.meter = 0; s.grace = CONFIG.grace; s.ev.push('spotted'); s.by.push(by + '@' + Math.round(s.z)); s.viewers += 150000; }
  // the current objective: a point the marker floats over
  function objective(s) {   // by the furthest point reached (bestZ): running back never moves the checkpoint back (owner 00:54)
    const pz = Math.max(s.z, s.bestZ || 0);
    if (!s.door && s.looped >= 1e9 && pz < GUARD.z) return { x: null, z: null, text: 'Loop the camera' };
    if (!s.door && s.tvUntil < 0 && pz < GUARD.z && !s.cp1) return { x: -2.8, z: 8.9, text: 'Hide behind the pillar' };   // checkpoint 1: wait here for the guard (owner 01:28)
    if (!s.door && s.tvUntil < 0 && pz < GUARD.z) return { x: -3.6, z: 16.3, text: Math.hypot(s.x + 3.6, s.z - 16.3) < 1.0 ? 'Hack the TV' : 'Sneak to the next pillar' };   // a true blind spot: a 0.5 m circle never seen over the whole patrol (sampled 01:31)   /* the left middle pillar's blind spot: never seen over a full patrol (sampled 23:18) */   // a spot to stand on (owner 23:10)
    if (!s.door) return { x: DOOR.keypad.x - 0.6, z: 29.2, text: pz < 12 ? 'Sneak to the security door' : 'Hack the security door' };
    if (pz < 49) return { x: 0, z: 50, text: 'Get through the lasers' };
    return { x: 0, z: VAULT.stop, text: 'Crack the vault' };
  }

  // ── bots: roll the world forward per candidate move (the guard and camera are deterministic) ──
  const DIRS0 = [[0, 1], [0.7, 0.7], [-0.7, 0.7], [1, 0], [-1, 0], [0.7, -0.7], [-0.7, -0.7], [0, -1]];
  const DIRS = [[0, 0], ...DIRS0, ...DIRS0.map(([x, z]) => [x * 0.5, z * 0.5])];   // run or sneak in each direction
  function route(s, x, z) {   // distance to go, along the rooms
    if (!s.door) return Math.hypot(x - 0.6, z - 29.0);
    if (z < 30.3) return Math.hypot(x, z - 30.6) + 28;
    return Math.max(0, VAULT.stop - z) + Math.abs(x) * 0.3;
  }
  function plan(s, horizon, firstTimer) {
    let best = [0, 0], bestScore = -1e9; const d0 = route(s, s.x, s.z);
    for (const [cx, cz] of DIRS) {
      const r = { x: s.x, z: s.z, vx: s.vx, vz: s.vz, walk: 0, face: s.face, door: s.door, dial: s.dial }; let meter = s.meter, grace = s.grace, gt = s.gt, hit = 0, laser = false;
      for (let k = 1; k <= Math.round(horizon / 0.1); k++) {
        const t = s.t + k * 0.1; const zp = r.z; move(r, cx, cz, 0.1); if (t >= s.tvUntil) gt += 0.1;
        // a first-timer only sees where the guard is going when he signals: it assumes he keeps doing what he does now
        const w = seenAt(s, r.x, r.z, t, firstTimer ? s.gt + (t - s.t) * (guardAt(s.gt).mode === 'walk' ? 1 : 0.0) : gt, s.looped, s.tvUntil);
        const heard = CONFIG.hear > 0 && !w && r.running && r.z < ROOM.lobby.z1 && Math.hypot(r.x - guardAt(gt).x, r.z - GUARD.z) < CONFIG.hear;
        if ((w === 'guard' && CONFIG.guardInstant) || (w === 'cctv' && CONFIG.camInstant)) { hit = k; break; }
        if (grace > 0) grace -= 0.1; else if (w || heard) { meter += 0.1 / CONFIG.fill; if (meter >= 0.95) { hit = k; break; } } else meter = Math.max(0, meter - 0.1);
        for (const L of LASERS) if (laserOn(L, t, s) && zp < L.z + 0.15 && r.z > L.z - 0.35) laser = true;
        if (laser) { hit = k; break; }
      }
      const sc = hit ? -1000 + hit * 10 : (d0 - route(s, r.x, r.z)) * 10 - meter * 20;
      if (sc > bestScore) { bestScore = sc; best = [cx, cz]; }
    }
    return best;
  }
  function makeBot(kind) {
    const b = { kind, cur: [0, 0], next: 0, nextTap: 0, q: [], start: kind === 'firstTimer' ? 0.8 + rnd() * 0.8 : 0.1, useTv: kind !== 'firstTimer' || rnd() < 0.6, prog: 0, progT: 0 };
    const react = kind === 'firstTimer' ? 0.35 : 0, pace = () => kind === 'firstTimer' ? 0.8 + rnd() * 0.5 : 0.25;
    b.tick = (s) => {
      if (s.t < b.start) return [0, 0];
      // taps (the lockpick is moved every frame, see below)
      if (s.dial && s.dial.pick && !s.dial.done) b.nextTap = 0;
      if (s.t >= b.nextTap) {
        let tap = null;
        if (s.mini && s.mini.kind === 'tuner') { const m = s.mini; if (!m.done) { const d = m.ft - m.f; tap = kind === 'spam' ? (rnd() < 0.3 ? { broadcast: true } : { tune: (rnd() - 0.5) * 0.12 }) : Math.abs(d) < 0.008 ? { broadcast: true } : { tune: clamp(d + (kind === 'firstTimer' ? (rnd() - 0.5) * 0.01 : 0), -0.05, 0.05) }; } }
        else if (s.mini && s.mini.kind === 'remote') { const m = s.mini; if (!m.done) tap = { key: kind === 'spam' ? String(Math.floor(rnd() * 10)) : (m.typed.length < 2 ? m.code[m.typed.length] : 'ok') }; }
        else if (s.mini && s.mini.kind === 'wires') { const m = s.mini, i = m.conn.indexOf(false); if (i >= 0 && !m.done) tap = { wire: { from: i, to: kind === 'spam' ? Math.floor(rnd() * 3) : m.ports.indexOf(i) } }; }
        else if (s.mini) { if (kind === 'spam') tap = { mini: true }; else { const m = s.mini, lead = 1.5 * react * m.dir, err = kind === 'firstTimer' ? (rnd() - 0.5) * 0.18 : 0; if (Math.abs(m.u + lead + err - m.zone) <= m.w * 0.35) tap = { mini: true }; } }
        else if (kind === 'spam' && s.dial && s.dial.pick) { s.dial.held = true; s.dial.a = clamp(s.dial.a + (rnd() - 0.5) * 30, -80, 80); }
        else if (kind === 'spam') { const h = HACKS.find(h => hackable(s, h)); if (h) tap = { tap: h.id }; else if (s.puzzle && !s.puzzle.done) tap = { tile: Math.floor(rnd() * PR * PC) }; else if (s.dial && !s.dial.done) tap = { dial: true }; }
        else {
          const g = guard(s);
          if (hackable(s, HACKS[0])) tap = { tap: 'cctv' };
          else if (b.useTv && hackable(s, HACKS[1]) && s.z > 9 && s.z < GUARD.z && g.mode !== 'tv') tap = { tap: 'tv' };
          else if (hackable(s, HACKS[2])) tap = { tap: 'keypad' };
          else if (s.puzzle && !s.puzzle.done) { const i = s.puzzle.tiles.findIndex(tl => tl.need != null && rotMask(tl.base, tl.rot) !== tl.need); tap = { tile: kind === 'firstTimer' && rnd() < 0.25 ? Math.floor(rnd() * PR * PC) : i }; }
          else if (s.dial && s.dial.pick && !s.dial.done) { const d = s.dial; d.held = true;
            if (kind === 'perfect') { d.a += clamp(d.sweet - d.a, -120 / 30, 120 / 30); }
            else { b.scan = b.scan || { dir: 1, best: 0, t: 0 }; const near = Math.max(0, 1 - Math.abs(d.a - d.sweet) / 40), sc = b.scan;
              if (Math.abs(d.a - d.sweet) <= CONFIG.pinW[d.pins] / 2 * 0.8 && near > 0.85) { /* feel it: hold still */ }
              else { if (near < sc.best - 0.05) { sc.dir *= -1; sc.best = near; } sc.best = Math.max(sc.best * 0.995, near); d.a = clamp(d.a + sc.dir * (near > 0.5 ? 0.6 : 1.8) + (rnd() - 0.5) * 0.5, -80, 80); if (Math.abs(d.a) >= 80) sc.dir *= -1; } }
          }
          else if (s.dial && !s.dial.done) { const da = ((s.dial.a - s.dial.zone + 540) % 360) - 180, w = CONFIG.dialZones[s.dial.hits] / 2, lead = CONFIG.dialSpeed * (1 + 0.25 * s.dial.hits) * react, err = kind === 'firstTimer' ? (rnd() - 0.5) * 50 : 0; if (Math.abs(da + lead + err) <= w * 0.8) tap = { dial: true }; }
        }
        if (tap) { if (react) b.q.push({ at: s.t + react, tap }); else act(s, tap); b.nextTap = s.t + (tap.mini && kind !== 'spam' ? 0.45 : pace()); }
      }
      while (b.q.length && b.q[0].at <= s.t) act(s, b.q.shift().tap);
      if (kind === 'spam') return [0, 1];
      if (s.z > b.prog + 0.5) { b.prog = s.z; b.progT = s.t; }
      const stalled = s.t - b.progT > 3;
      if (s.t >= b.next) { b.cur = plan(s, stalled ? 0.7 : kind === 'perfect' ? 1.6 : 1.0, kind === 'firstTimer'); b.next = s.t + (kind === 'perfect' ? 0.1 : 0.45 + rnd() * 0.3); if (kind === 'firstTimer' && rnd() < 0.08) b.cur = DIRS[Math.floor(rnd() * 3)]; }
      return b.cur;
    };
    return b;
  }

  if (Q.has('sim')) {
    const n = +(Q.get('n') || 100), out = {};
    for (const kind of ['perfect', 'firstTimer', 'spam']) {
      let wins = 0, bust = 0, time = 0, stars = 0; const left = [], by = {}, failZ = [];
      for (let i = 0; i < n; i++) { const s = newRound('sim'), b = makeBot(kind); while (!s.end && s.t < 100) { const [cx, cz] = b.tick(s); step(s, 1 / 30, cx, cz); }
        if (s.end === 'win') { wins++; left.push(s.clock); } else { s.end === 'busted' ? bust++ : time++; failZ.push(Math.round(s.z)); }
        stars += s.stars; for (const k of s.by) { const id = k.split('@')[0]; by[id] = (by[id] || 0) + 1; } }
      left.sort((a, b) => a - b);
      if (CONFIG.time <= 0) left.length = 0;
      out[kind] = { elapsed: null, win: `${wins}/${n} (${Math.round(100 * wins / n)}%)`, busted: bust, timeout: time, meanStars: +(stars / n).toFixed(2), medianLeft: left.length ? +left[left.length >> 1].toFixed(1) : null, failZ: failZ.slice(0, 14), by };
    }
    window.SIM = out; document.body.innerHTML = '<pre style="color:#0f0">' + JSON.stringify({ config: CONFIG, sim: out }, null, 1) + '</pre>'; return;
  }

  // ── render ──
  const cv = document.getElementById('cv'), ctx = cv.getContext('2d'); cv.width = W; cv.height = H;
  const CAM = { x: CONFIG.camSide, y: CONFIG.camH, z: 2 - CONFIG.camBack, yaw: 0, head: 90 };   // head: the floor direction the camera looks along (90 = down the hall)
  const FOLLOW = Q.get('cam') === 'follow';   // ?cam=follow: the camera swings behind the robber (GTA on a console); default: looks down the hall, leans
  const sp = Math.sin(CONFIG.pitch * D2R), cp = Math.cos(CONFIG.pitch * D2R), NEAR = 0.2; let F = (H / 2) / Math.tan(CONFIG.fovY * D2R / 2);
  const toCam = (x, y, z) => { const ax = x - CAM.x, ry = y - CAM.y, az = z - CAM.z, cy = Math.cos(CAM.yaw), sy = Math.sin(CAM.yaw), rx = ax * cy - az * sy, rz = ax * sy + az * cy; return [rx, ry * cp + rz * sp, -ry * sp + rz * cp]; };
  const scr = c => [W / 2 + F * c[0] / c[2], H / 2 - F * c[1] / c[2]];
  const P = (x, y, z) => { const c = toCam(x, y, z); return c[2] < NEAR ? null : [...scr(c), c[2]]; };
  function clip(pts) { const o = []; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], ai = a[2] >= NEAR, bi = b[2] >= NEAR; if (ai) o.push(a); if (ai !== bi) { const t = (NEAR - a[2]) / (b[2] - a[2]); o.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, NEAR]); } } return o; }
  function poly(w, fill, stroke, lw = 2) { const c = clip(w.map(p => toCam(...p))); if (c.length < 3) return; ctx.beginPath(); c.forEach((p, i) => { const [X, Y] = scr(p); i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } }
  function line3(a, b, col, lw) { let A = toCam(...a), B = toCam(...b); if (A[2] < NEAR && B[2] < NEAR) return; if (A[2] < NEAR) { const t = (NEAR - A[2]) / (B[2] - A[2]); A = A.map((v, i) => v + (B[i] - v) * t); } if (B[2] < NEAR) { const t = (NEAR - B[2]) / (A[2] - B[2]); B = B.map((v, i) => v + (A[i] - v) * t); } const [x1, y1] = scr(A), [x2, y2] = scr(B); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
  const GREEN = '#3BEA1E', PINK = '#FF2FB3', RED = '#ff3b4f', WD = '#e9f1f7';
  function room(r, fa, fb, wc, h) {
    poly([[r.x0, 0, r.z0], [r.x1, 0, r.z0], [r.x1, 0, r.z1], [r.x0, 0, r.z1]], fa);
    for (let z = Math.max(r.z0, Math.floor((CAM.z - (FOLLOW ? 25 : 2)) / 1.5) * 1.5); z < Math.min(r.z1, CAM.z + 40); z += 1.5) for (let x = r.x0; x < r.x1; x += 1.5) if ((Math.round((x - r.x0) / 1.5) + Math.round((z - r.z0) / 1.5)) & 1) poly([[x, 0.001, z], [Math.min(r.x1, x + 1.5), 0.001, z], [Math.min(r.x1, x + 1.5), 0.001, Math.min(r.z1, z + 1.5)], [x, 0.001, Math.min(r.z1, z + 1.5)]], fb);
    poly([[r.x0, 0, r.z0], [r.x0, 0, r.z1], [r.x0, h, r.z1], [r.x0, h, r.z0]], wc, '#3d3f43', 1.5); poly([[r.x1, 0, r.z0], [r.x1, 0, r.z1], [r.x1, h, r.z1], [r.x1, h, r.z0]], wc, '#3d3f43', 1.5);
    poly([[r.x0, h, r.z0], [r.x1, h, r.z0], [r.x1, h, r.z1], [r.x0, h, r.z1]], '#2c2e32');
    for (let z = Math.ceil(r.z0 / 6) * 6; z < r.z1; z += 6) poly([[-0.8, h - 0.01, z], [0.8, h - 0.01, z], [0.8, h - 0.01, z + 0.5], [-0.8, h - 0.01, z + 0.5]], '#d9dccf');
  }
  function box(b, fade) {
    ctx.globalAlpha = fade ? 0.35 : 1; const side = '#7d7f83', top = '#a3a5a9', front = b.c === 'desk' ? '#6d6253' : b.c === 'bench' ? '#5a4c3e' : '#8f9195';
    if (CAM.x < b.x0) poly([[b.x0, 0, b.z0], [b.x0, 0, b.z1], [b.x0, b.h, b.z1], [b.x0, b.h, b.z0]], side, '#4a4c50', 1.2);
    if (CAM.x > b.x1) poly([[b.x1, 0, b.z0], [b.x1, 0, b.z1], [b.x1, b.h, b.z1], [b.x1, b.h, b.z0]], side, '#4a4c50', 1.2);
    if (CAM.z < b.z0) poly([[b.x0, 0, b.z0], [b.x1, 0, b.z0], [b.x1, b.h, b.z0], [b.x0, b.h, b.z0]], front, '#4a4c50', 1.2);
    if (CAM.z > b.z1) poly([[b.x0, 0, b.z1], [b.x1, 0, b.z1], [b.x1, b.h, b.z1], [b.x0, b.h, b.z1]], front, '#4a4c50', 1.2);
    if (b.h < CAM.y) poly([[b.x0, b.h, b.z0], [b.x1, b.h, b.z0], [b.x1, b.h, b.z1], [b.x0, b.h, b.z1]], top, '#4a4c50', 1.2);
    ctx.globalAlpha = 1;
  }
  function cone(ox, oz, a, half, range, fill, edge) {
    const pts = [[ox, 0.02, oz]], N = 28;
    for (let i = 0; i <= N; i++) { const aa = (a - half + 2 * half * i / N) * D2R; let L = range; for (let k = 0.25; k < range; k += 0.25) { const x = ox + Math.cos(aa) * k, z = oz + Math.sin(aa) * k; if (blocked(ox, oz, x, z) || x < ROOM.lobby.x0 || x > ROOM.lobby.x1 || z < 0 || z > ROOM.lobby.z1) { L = k; break; } } pts.push([ox + Math.cos(aa) * L, 0.02, oz + Math.sin(aa) * L]); }
    poly(pts, fill, edge, 2);
  }
  function coneFloor(ox, oz, a, half, range, n) {
    const pts = [[ox, oz]], N = n || 48;
    for (let i = 0; i <= N; i++) { const aa = (a - half + 2 * half * i / N) * D2R; let L = range; for (let k = 0.25; k < range; k += 0.25) { const x = ox + Math.cos(aa) * k, z = oz + Math.sin(aa) * k; if (blocked(ox, oz, x, z) || x < ROOM.lobby.x0 || x > ROOM.lobby.x1 || z < 0 || z > ROOM.lobby.z1) { let lo = k - 0.25, hi = k; for (let it = 0; it < 5; it++) { const mid = (lo + hi) / 2, mx = ox + Math.cos(aa) * mid, mz = oz + Math.sin(aa) * mid; if (blocked(ox, oz, mx, mz) || mx < ROOM.lobby.x0 || mx > ROOM.lobby.x1 || mz < 0 || mz > ROOM.lobby.z1) hi = mid; else lo = mid; } L = lo; break; } } pts.push([ox + Math.cos(aa) * L, oz + Math.sin(aa) * L]); }   // hits refined to ~1 cm: a smooth edge while it turns (owner 21:09)
    return pts;
  }
  function figure(x, z, o) {
    const f = P(x, 0, z), hd = P(x, 1.75, z); if (!f || !hd) return null; const h = f[1] - hd[1]; if (h < 4) return null; const u = h / 1.75, cx = f[0];
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(cx, f[1], 0.42 * u, 0.12 * u, 0, 0, 7); ctx.fill();
    const side = Math.cos((o.face || 90) * D2R), sw = Math.sin(o.walk * 3.4) * (o.moving ? 1 : 0), lean = side * 0.08 * u;
    ctx.lineCap = 'round'; ctx.strokeStyle = o.legs; ctx.lineWidth = 0.17 * u;
    for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + sd * 0.11 * u, f[1] - 0.9 * u); ctx.lineTo(cx + sd * 0.12 * u + sd * sw * Math.abs(side) * 0.15 * u, f[1] - 0.06 * u - Math.max(0, sd * sw) * 0.12 * u); ctx.stroke(); }
    ctx.fillStyle = o.body; ctx.strokeStyle = '#151515'; ctx.lineWidth = Math.max(1.5, u * 0.02);
    ctx.beginPath(); ctx.moveTo(cx - 0.24 * u + lean, f[1] - 1.45 * u); ctx.lineTo(cx + 0.24 * u + lean, f[1] - 1.45 * u); ctx.lineTo(cx + 0.2 * u, f[1] - 0.85 * u); ctx.lineTo(cx - 0.2 * u, f[1] - 0.85 * u); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = o.body; ctx.lineWidth = 0.12 * u; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(cx + sd * 0.24 * u + lean, f[1] - 1.4 * u); ctx.lineTo(cx + sd * 0.3 * u, f[1] - 0.95 * u - sd * sw * 0.06 * u); ctx.stroke(); }
    if (o.bag && !(o.eyes && Math.sin((o.face || 90) * D2R) < -0.35)) { ctx.fillStyle = '#1b1d20'; ctx.beginPath(); ctx.roundRect(cx - 0.16 * u + lean, f[1] - 1.4 * u, 0.32 * u, 0.38 * u, 0.06 * u); ctx.fill(); }
    const hy = f[1] - 1.6 * u, hx = cx + lean * 1.3; ctx.fillStyle = o.head; ctx.strokeStyle = '#151515'; ctx.lineWidth = Math.max(1.5, u * 0.02); ctx.beginPath(); ctx.ellipse(hx, hy, 0.12 * u, 0.14 * u, 0, 0, 7); ctx.fill(); ctx.stroke();
    if (o.snout && Math.abs(side) > 0.3) { ctx.beginPath(); ctx.moveTo(hx + side * 0.1 * u, hy - 0.02 * u); ctx.lineTo(hx + side * 0.24 * u, hy + 0.03 * u); ctx.lineTo(hx + side * 0.1 * u, hy + 0.07 * u); ctx.closePath(); ctx.fill(); ctx.stroke(); }
    if (o.ears) { ctx.fillStyle = o.head; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(hx + sd * 0.04 * u, hy - 0.11 * u); ctx.lineTo(hx + sd * 0.13 * u, hy - 0.28 * u); ctx.lineTo(hx + sd * 0.12 * u, hy - 0.06 * u); ctx.closePath(); ctx.fill(); ctx.stroke(); } }
    if (o.eyes && Math.sin((o.face || 90) * D2R) < -0.35) { ctx.fillStyle = GREEN; for (const sd of [-1, 1]) { ctx.beginPath(); ctx.ellipse(hx + sd * 0.05 * u + lean * 0.3, hy - 0.01 * u, 0.028 * u, 0.018 * u, 0, 0, 7); ctx.fill(); } ctx.fillStyle = '#4a4740'; ctx.beginPath(); ctx.ellipse(hx + lean * 0.3, hy + 0.07 * u, 0.06 * u, 0.04 * u, 0, 0, 7); ctx.fill(); }
    if (o.cap) { ctx.fillStyle = '#1f2a44'; ctx.fillRect(hx - 0.13 * u, hy - 0.15 * u, 0.26 * u, 0.08 * u); }
    ctx.lineCap = 'butt'; return { x: cx, top: hy - 0.2 * u, u, foot: f[1] };
  }
  function label(x, y, t, col, size, bg) { ctx.font = `400 ${size}px "Bebas Neue",Impact,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; if (bg) { const w = ctx.measureText(t).width + size * 0.9; ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(x - w / 2, y - size * 0.72, w, size * 1.44, 6); ctx.fill(); } ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.strokeText(t, x, y); ctx.fillStyle = col; ctx.fillText(t, x, y); ctx.textBaseline = 'alphabetic'; }
  function glyph(g, x, y, r, col) {
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = r * 0.16;
    if (g === 'cam') { ctx.strokeRect(x - r * 0.45, y - r * 0.25, r * 0.65, r * 0.5); ctx.beginPath(); ctx.moveTo(x + r * 0.2, y); ctx.lineTo(x + r * 0.5, y - r * 0.22); ctx.lineTo(x + r * 0.5, y + r * 0.22); ctx.closePath(); ctx.fill(); }
    if (g === 'tv') { ctx.strokeRect(x - r * 0.5, y - r * 0.32, r, r * 0.64); ctx.beginPath(); ctx.moveTo(x - r * 0.2, y + r * 0.5); ctx.lineTo(x + r * 0.2, y + r * 0.5); ctx.stroke(); }
    if (g === 'lock') { ctx.strokeRect(x - r * 0.35, y - r * 0.05, r * 0.7, r * 0.5); ctx.beginPath(); ctx.arc(x, y - r * 0.05, r * 0.24, Math.PI, 0); ctx.stroke(); }
    if (g === 'bolt') { ctx.beginPath(); ctx.moveTo(x + r * 0.1, y - r * 0.5); ctx.lineTo(x - r * 0.25, y + r * 0.05); ctx.lineTo(x + r * 0.02, y + r * 0.05); ctx.lineTo(x - r * 0.1, y + r * 0.5); ctx.lineTo(x + r * 0.25, y - r * 0.05); ctx.lineTo(x - r * 0.02, y - r * 0.05); ctx.closePath(); ctx.fill(); }
  }
  let ICONS = [], TILES = [];
  function drawHackIcons(s) {
    ICONS = [];
    for (const h of HACKS) {
      const p = P(...h.pos()); if (!p) continue; const ok = hackable(s, h), dist = Math.hypot(h.pos()[0] - s.x, h.pos()[2] - s.z);
      if (!ok && !(s.hacking && s.hacking.id === h.id) && dist > h.reach + 14) continue;
      if ((h.id === 'cctv' && s.looped < 1e9) || (h.id === 'keypad' && (s.door || s.puzzle)) || h.id === 'lasers') continue;
      const pul = 0.5 + 0.5 * Math.sin(s.t * 6), near = !ok && dist <= h.reach + 3.5, far = !ok && !near, busy = s.hacking && s.hacking.id === h.id;
      const r = ok ? 30 + 3 * pul : near ? 22 : 15, x = clamp(p[0], 52, W - 52), y = clamp(p[1] - (ok ? 50 : 36), 172, H - 620), al = far ? 0.6 : 1;
      ctx.globalAlpha = al; ctx.strokeStyle = far ? 'rgba(233,241,247,.3)' : 'rgba(233,241,247,.6)'; ctx.lineWidth = far ? 1.5 : 2; ctx.beginPath(); ctx.moveTo(clamp(p[0], 0, W), clamp(p[1], 0, H)); ctx.lineTo(x, y + r); ctx.stroke();
      ctx.fillStyle = ok ? 'rgba(7,10,15,.82)' : 'rgba(7,10,15,.6)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.strokeStyle = ok ? GREEN : 'rgba(233,241,247,.45)'; ctx.lineWidth = ok ? 3 : 2; ctx.stroke();
      if (ok) { ctx.save(); ctx.shadowColor = GREEN; ctx.shadowBlur = 12; ctx.strokeStyle = `rgba(59,234,30,${0.3 + 0.5 * pul})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 7 + 5 * pul, 0, 7); ctx.stroke(); ctx.restore(); }
      glyph(h.glyph, x, y, r * 0.9, ok ? '#fff' : 'rgba(233,241,247,.75)');
      if (busy) { ctx.strokeStyle = GREEN; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, r + 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.hacking.t / 0.45); ctx.stroke(); }
      if (!far) { const right = x > W / 2, tx = right ? x - r - 12 : x + r + 12;
        ctx.font = '400 19px "Bebas Neue",Impact,sans-serif'; if ('letterSpacing' in ctx) ctx.letterSpacing = '2px'; const nw = ctx.measureText(h.name).width; if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
        glass(right ? tx - nw - 14 : tx - 2, y - (ok ? 26 : 13), nw + 16, 26, 4, 0.62); caps(h.name, right ? tx - nw / 2 - 6 : tx + nw / 2 + 6, y + (ok ? -6 : 7), 19, ok ? '#fff' : 'rgba(233,241,247,.9)', 'center', 2);
        if (ok) { const at = 'TAP · ' + h.act; ctx.font = '400 18px "Bebas Neue",Impact,sans-serif'; if ('letterSpacing' in ctx) ctx.letterSpacing = '2px'; const aw = ctx.measureText(at).width; if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
          const ax = right ? Math.max(8, tx - aw - 14) : Math.min(W - aw - 24, tx - 2); ctx.fillStyle = GREEN; ctx.beginPath(); ctx.roundRect(ax, y + 4, aw + 16, 24, 4); ctx.fill(); ctx.save(); ctx.fillStyle = '#06130a'; ctx.font = '400 18px "Bebas Neue",Impact,sans-serif'; ctx.textAlign = 'center'; if ('letterSpacing' in ctx) ctx.letterSpacing = '2px'; ctx.fillText(at, ax + (aw + 16) / 2 + 1, y + 23); ctx.restore(); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; } }
      ctx.globalAlpha = 1;
      if (ok) ICONS.push({ id: h.id, x, y, r: r + 20 });
    }
  }
  function drawGuardTag(s) {   // a small TV badge on the guard while the TV holds him; its pointer follows him, on screen or off (owner 02:18, 02:22)
    if (!(s.t < s.tvUntil) || s.z > ROOM.lobby.z1 || s.end || s.mini) return; const g = guard(s);
    const sc = (x, y, z) => { const c = toCam(x, y, z); return c[2] > NEAR ? [W / 2 + F * c[0] / c[2], H / 2 - F * c[1] / c[2], 1] : [W / 2 + Math.sign(c[0] || 1) * W, H + 400, 0]; };   // behind the camera: his own side, not mirrored (owner 02:24)
    const top = sc(g.x, 2.3, GUARD.z), head = sc(g.x, 1.75, GUARD.z), bob = Math.sin(s.t * 3) * 2, T = 140, B = H - 300;
    const x = clamp(top[0], 30, W - 30); const y = clamp(top[1] - 6 + bob, T, B), off = !top[2] || top[0] < 30 || top[0] > W - 30 || top[1] - 6 < T || top[1] - 6 > B;
    const k = clamp((s.t - (s.tvAt || 0)) / 0.3, 0, 1);
    const ta = Math.atan2(head[1] - y, head[0] - x);   // no side-step at the gem: it crosses it smoothly, on him (owner 02:23: jitter)
    UI.tagA = UI.tagA == null ? ta : UI.tagA + Math.atan2(Math.sin(ta - UI.tagA), Math.cos(ta - UI.tagA)) * 0.25;
    ctx.save(); ctx.globalAlpha = k; ctx.fillStyle = 'rgba(6,19,10,.88)'; ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = GREEN; ctx.lineWidth = 2; ctx.stroke(); glyph('tv', x, y, 12, GREEN);
    ctx.translate(x, y); ctx.rotate(UI.tagA); ctx.fillStyle = GREEN; ctx.beginPath(); ctx.moveTo(25, 0); ctx.lineTo(16, -6); ctx.lineTo(16, 6); ctx.closePath(); ctx.fill(); ctx.restore(); }
  const statusOn = s => s.tvAt != null && s.t < s.tvUntil && s.t - s.tvAt < 3.4 && s.z <= ROOM.lobby.z1 && !s.end;
  function drawStatus(s) {   // GUARD DISTRACTED in a fixed slot under the OBJECTIVE card, 3 s from the hack (owner 02:18)
    if (!statusOn(s) || s.mini) return; const age = s.t - s.tvAt, a = Math.min(1, age / 0.25, (3.4 - age) / 0.4), sl = (1 - Math.min(1, age / 0.25)) * -24;
    ctx.save(); ctx.globalAlpha = a; ctx.font = '400 17px "Bebas Neue",Impact,sans-serif'; if ('letterSpacing' in ctx) ctx.letterSpacing = '2px'; const tw = ctx.measureText('GUARD DISTRACTED').width; if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    const x0 = 20 + sl, y0 = UI.cueB ? UI.cueB + 10 : 124, w = tw + 46; ctx.fillStyle = 'rgba(6,19,10,.85)'; ctx.beginPath(); ctx.roundRect(x0, y0, w, 30, 4); ctx.fill(); ctx.strokeStyle = GREEN; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = GREEN; ctx.fillRect(x0, y0, 3, 30);   // under the CREW line when it shows, never pushing it
    glyph('tv', x0 + 20, y0 + 15, 15, GREEN); caps('GUARD DISTRACTED', x0 + 34, y0 + 22, 17, GREEN, 'left', 2); ctx.restore(); }
  function drawMarker(s) {   // GTA-style objective marker over the target
    if (s.dial || s.puzzle && !s.puzzle.done || s.mini) return; const o = objective(s); if (o.x == null) { UI.mk = null; return; } const bob = Math.sin(s.t * 3) * 0.12, p = P(o.x, 2.4 + bob + 0.25 * Math.min(0.5, Math.max(0, Math.hypot(o.x - CAM.x, o.z - CAM.z) / 8 - 1)), o.z), f = P(o.x, 0.02, o.z);
    { const c = toCam(o.x, 2.4, o.z), behind = c[2] < NEAR, sx = behind ? W / 2 + Math.sign(c[0] || 1) * W : W / 2 + F * c[0] / c[2], sy = behind ? H : H / 2 - F * c[1] / c[2], M0 = 46, top = 150, bot = H - 210;
      const hidden = !behind && blocked(CAM.x, CAM.z, o.x, o.z);   // a pillar or wall between the camera and the target
      if (hidden && !(sx < M0 || sx > W - M0 || sy < top || sy > bot)) { const bob2 = Math.sin(s.t * 5) * 5, gx = sx, gy = sy - 62 + bob2; ctx.save(); ctx.fillStyle = "#ffd600"; ctx.strokeStyle = "rgba(10,8,4,.9)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(gx - 13, gy - 10); ctx.lineTo(gx + 13, gy - 10); ctx.lineTo(gx, gy + 6); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore(); }   // hidden but on screen: an arrow over it
      if (behind || sx < M0 || sx > W - M0 || sy < top || sy > bot) {   // off-screen: a gold arrow on the edge, pointing at it (owner 01:41)
        const cx = W / 2, cy = (top + bot) / 2, dx = sx - cx, dy = sy - cy, k = Math.min((W / 2 - M0) / Math.max(1e-3, Math.abs(dx)), ((bot - top) / 2) / Math.max(1e-3, Math.abs(dy))), ax = cx + dx * k, ay = cy + dy * k, ang = Math.atan2(dy, dx), pul = 1 + 0.08 * Math.sin(s.t * 6);
        ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang); ctx.scale(pul, pul); ctx.fillStyle = 'rgba(7,10,15,.78)'; ctx.beginPath(); ctx.arc(0, 0, 24, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = '#ffd600'; ctx.lineWidth = 2.5; ctx.stroke();
        ctx.fillStyle = '#ffd600'; ctx.beginPath(); ctx.moveTo(15, 0); ctx.lineTo(-7, -11); ctx.lineTo(-2, 0); ctx.lineTo(-7, 11); ctx.closePath(); ctx.fill(); ctx.restore();
        const lbl = Math.round(Math.hypot(o.x - s.x, o.z - s.z)) + ' M', lx = clamp(ax - Math.cos(ang) * 44, 40, W - 40), ly = clamp(ay - Math.sin(ang) * 40, top - 10, bot + 20); ctx.font = '400 18px "Bebas Neue",Impact,sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(10,8,4,.9)'; ctx.strokeText(lbl, lx, ly + 6); caps(lbl, lx, ly + 6, 18, '#ffd600', 'center', 1.5); return; } }
    UI.mk = p ? [p[0], p[1]] : null; if (!p) return;
    
    const r = clamp(F * 0.17 / p[2], 7, 14);   /* the gem itself is 3D now (world3d); the HUD keeps the distance */
    { const lbl = Math.round(Math.hypot(o.x - s.x, o.z - s.z)) + ' M', ly = p[1] - r * 1.4 - 8; ctx.font = '400 18px "Bebas Neue",Impact,sans-serif'; ctx.textAlign = 'center'; if ('letterSpacing' in ctx) ctx.letterSpacing = '1.5px'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.strokeStyle = 'rgba(10,8,4,.9)'; ctx.strokeText(lbl, p[0], ly); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; caps(lbl, p[0], ly, 18, '#ffd600', 'center', 1.5); }   // a thin dark outline (owner 00:59)
  }
  const fmtV = v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : Math.round(v / 1e3) + 'K';
  const WHO = [['rizky', '#FF2FB3'], ['dimas_', '#3fd6ff'], ['nadia.s', '#ffd600'], ['bang_jo', '#3BEA1E'], ['ayu', '#ff8a3d'], ['tomi', '#b78cff'], ['kevin.x', '#7cf0c8'], ['salsa', '#ff6b8a']];
  const chat = []; const say = k => { const a = C.chat[k], w = WHO[Math.floor(Math.random() * WHO.length)]; chat.push({ t: a[Math.floor(Math.random() * a.length)], at: S.t, who: w[0], col: w[1] }); if (chat.length > 12) chat.shift(); };
  const UI = { shownV: 0, lastV: 0, lastT: 0, pops: [], nextChat: 2.2, stickA: 0, sx: 0, sy: 0, kx: 0, ky: 0, k: 0, ang: 0, run: false };
  let callout = null; const once = new Set(); const call = (k, t) => { if (once.has(k)) { if (callout && callout.k === k) callout.live = S.t; return; } once.add(k); callout = { k, t, at: S.t, live: S.t }; };   // a cue stays while its action is still there (owner 20:56)
  function star5(x, y, r, fill) { ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } ctx.closePath(); ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.stroke(); }
  function caps(t, x, y, size, col, align, track) { ctx.font = `400 ${size}px "Bebas Neue",Impact,sans-serif`; ctx.textAlign = align || 'left'; ctx.textBaseline = 'alphabetic'; if ('letterSpacing' in ctx) ctx.letterSpacing = (track || 0) + 'px'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.75)'; ctx.shadowBlur = 6; ctx.fillStyle = col; ctx.fillText(t, x, y); ctx.restore(); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; }
  const EYE = typeof Path2D !== 'undefined' ? new Path2D('M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0') : null;   // Lucide 'eye' (ISC)
  function lucideEye(x, y, size, col) { if (!EYE) return; const k = size / 24; ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(EYE); ctx.beginPath(); ctx.arc(12, 12, 3, 0, 7); ctx.stroke(); ctx.restore(); }
  function glass(x, y, w, h, r, a) { ctx.fillStyle = `rgba(7,10,15,${a == null ? 0.6 : a})`; ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.10)'; ctx.lineWidth = 1; ctx.stroke(); }
  function eyeGlyph(x, y, r, col, open) { ctx.strokeStyle = col; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - r, y); ctx.quadraticCurveTo(x, y - r * 0.75, x + r, y); ctx.quadraticCurveTo(x, y + r * 0.75, x - r, y); ctx.stroke();
    if (open) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(x, y, r * 0.3, 0, 7); ctx.fill(); } else { ctx.beginPath(); ctx.moveTo(x - r * 0.9, y - r * 0.6); ctx.lineTo(x + r * 0.9, y + r * 0.6); ctx.stroke(); } }
  function wrap(t, maxW) { const words = t.split(' '), lines = []; let cur = ''; for (const w of words) { const tryL = cur ? cur + ' ' + w : w; if (ctx.measureText(tryL).width > maxW && cur) { lines.push(cur); cur = w; } else cur = tryL; } if (cur) lines.push(cur); return lines; }
  function hud(s) {
    const dt = Math.max(0, Math.min(0.1, s.t - UI.lastT)); UI.lastT = s.t;
    if (s.t < 0.05 || UI.shownV > s.viewers * 1.5) UI.shownV = s.viewers;
    if (s.viewers - UI.lastV > 60000 && UI.lastV > 0) UI.pops.push({ v: s.viewers - UI.lastV, at: s.t }); UI.lastV = s.viewers;
    UI.shownV += (s.viewers - UI.shownV) * Math.min(1, dt * 5);
    // ambient chat: the stream is alive
    if (s.started && !s.end && s.t > UI.nextChat) { say(s.z > ROOM.corr.z1 ? 'idleVault' : s.z > ROOM.lobby.z1 ? 'idleCorr' : s.t < s.tvUntil ? 'idleTv' : 'idle');   // the stream reacts to where you are (owner 22:42)
       UI.nextChat = s.t + 3 + Math.random() * 2; }
    // top scrim
    // the stream card: LIVE, viewers, channel (the film's livestream look)
    const pulse = 0.5 + 0.5 * Math.sin(s.t * 5);
    ctx.fillStyle = '#e8132b'; ctx.beginPath(); ctx.roundRect(20, 20, 76, 30, 4); ctx.fill();
    ctx.fillStyle = `rgba(255,255,255,${0.45 + 0.55 * pulse})`; ctx.beginPath(); ctx.arc(35, 35, 4.5, 0, 7); ctx.fill(); caps('LIVE', 46, 45, 25, '#fff', 'left', 2);
    { const vt = fmtV(UI.shownV); ctx.font = '400 25px "Bebas Neue",Impact,sans-serif'; if ('letterSpacing' in ctx) ctx.letterSpacing = '1px'; const tw = ctx.measureText(vt).width; if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
      const pw = 12 + 22 + 8 + tw + 12; glass(102, 20, pw, 30, 4, 0.55); lucideEye(102 + 12, 24, 22, '#fff'); caps(vt, 102 + 12 + 22 + 8, 45, 25, '#fff', 'left', 1); UI.pillR = 102 + pw; }
    for (const p of UI.pops) { const age = s.t - p.at; if (age > 1.4) continue; ctx.globalAlpha = Math.min(1, (1.4 - age) / 0.5); caps('+' + fmtV(p.v), (UI.pillR || 226) + 8, 45 - age * 18, 22, GREEN, 'left', 1); ctx.globalAlpha = 1; }
    UI.pops = UI.pops.filter(p => s.t - p.at < 1.4);
    // no heat stars: one touch of the red is a bust (owner 21:22)
    // the film's title, always on (owner 20:49: branded throughout); the client's supplied title treatment
    if (LOGOH.complete && LOGOH.naturalWidth) { const lw = 150, lh = lw * LOGOH.naturalHeight / LOGOH.naturalWidth; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 8; ctx.drawImage(LOGOH, W - 20 - lw, 20, lw, lh); ctx.restore(); }   // the horizontal lockup (owner 21:00)
    // objective
    const obj = objective(s).text; ctx.font = '700 20px "Open Sans",sans-serif'; glass(20, 62, ctx.measureText(obj).width + 28, 54, 4, 0.58); ctx.fillStyle = GREEN; ctx.fillRect(20, 62, 3, 54); caps('OBJECTIVE', 31, 80, 15, GREEN, 'left', 2.5);
    ctx.font = '700 20px "Open Sans",sans-serif'; ctx.textAlign = 'left'; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.8)'; ctx.shadowBlur = 6; ctx.fillStyle = '#fff'; ctx.fillText(obj, 31, 105); ctx.restore();
    // stealth: an eye in a detection ring (lobby only)
    if (s.z < ROOM.lobby.z1 && !s.end && (s.seen || s.meter > 0.02)) { const hp = P(s.x, 2.25, s.z); if (hp) { const m = s.seen ? 1 : Math.min(1, s.meter), x = clamp(hp[0], 40, W - 40), y = clamp(hp[1], 150, H - 200), r = 17;
      ctx.fillStyle = 'rgba(7,10,15,.62)'; ctx.beginPath(); ctx.arc(x, y, r + 5, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
      ctx.save(); ctx.shadowColor = RED; ctx.shadowBlur = 10; ctx.strokeStyle = m >= 1 ? RED : '#ffbe28'; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + m * Math.PI * 2); ctx.stroke(); ctx.restore();
      eyeGlyph(x, y, 9, m >= 1 ? RED : '#ffbe28', true);
      if (m >= 1) { glass(x - 30, y - r - 34, 60, 22, 11, 0.7); caps('SEEN', x, y - r - 17, 17, RED, 'center', 2.5); } } }
    // chat: the film's stream column (right, compact: owner 20:57)
    const panel = (s.puzzle && s.t - (s.puzzle.done ? s.puzzle.doneT : s.t) < 0.9) || s.dial || s.mini || TUT.on;
    if (!panel && s.started) { const CW = 200, x0 = W - 16 - CW, maxH = 150, bot = H - 452, LH = 18, GAP = 8, PAD = 10;
      const lay = []; let used = 0;
      for (let i = chat.length - 1; i >= 0; i--) { const c = chat[i]; ctx.font = '800 13px "Open Sans",sans-serif'; const nw = ctx.measureText(c.who + '  ').width; ctx.font = '600 13px "Open Sans",sans-serif';
        const words = c.t.split(' '), lines = []; let cur = '', first = true; for (const wd of words) { const lim = first ? CW - 18 - nw : CW - 18, tryL = cur ? cur + ' ' + wd : wd; if (ctx.measureText(tryL).width > lim && cur) { lines.push(cur); cur = wd; first = false; } else cur = tryL; } lines.push(cur);
        const h = lines.length * LH; if (used + h + (lay.length ? GAP : 0) > maxH) break; used += h + (lay.length ? GAP : 0); lay.push({ c, nw, lines, h }); }
      UI.chatH = (UI.chatH || 0) + (used - (UI.chatH || 0)) * 0.2;
      if (UI.chatH > 4) glass(x0 - PAD, bot - UI.chatH - PAD + 4, CW + PAD * 2, UI.chatH + PAD * 2, 10, 0.34);   // exactly the messages + even padding
      let y = bot + 4; for (const it of lay) { const { c, nw, lines, h } = it, age = s.t - c.at, slide = Math.max(0, 1 - age / 0.25), yTop = y - h + slide * 8;
        ctx.globalAlpha = 1 - slide * 0.7; ctx.fillStyle = c.col; ctx.beginPath(); ctx.arc(x0 + 5, yTop + 9, 5, 0, 7); ctx.fill();
        ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.9)'; ctx.shadowBlur = 3; ctx.textAlign = 'left'; ctx.font = '800 13px "Open Sans",sans-serif'; ctx.fillStyle = c.col; ctx.fillText(c.who, x0 + 16, yTop + 13);
        ctx.font = '600 13px "Open Sans",sans-serif'; ctx.fillStyle = '#fff'; lines.forEach((l, k) => ctx.fillText(l, k ? x0 + 16 : x0 + 16 + nw, yTop + 13 + k * LH)); ctx.restore();
        y = y - h - GAP; }
      ctx.globalAlpha = 1; }
    // callouts: cinematic subtitles with a CREW tag
    UI.cueB = 0; const cueEnd = callout ? Math.max(callout.at + 3.6, callout.live + 0.4) : 0;   // never over a hack panel: the panel carries its own instruction (owner 20:46)
    if (callout && s.started && !panel && s.t < cueEnd) { const age = s.t - callout.at; ctx.globalAlpha = Math.min(1, age / 0.2, (cueEnd - s.t) / 0.4);
      ctx.font = '700 18px "Open Sans",sans-serif'; const lines = wrap(callout.t, W - 140); let yy = 172; UI.cueB = yy + 12 + (lines.length - 1) * 28;   // a clear gap under the objective card (owner 23:39)
      { const bw = Math.min(W - 24, Math.max(...lines.map(l => ctx.measureText(l).width)) + 120), sg = ctx.createLinearGradient(W / 2 - bw / 2, 0, W / 2 + bw / 2, 0); sg.addColorStop(0, 'rgba(0,0,0,0)'); sg.addColorStop(0.15, 'rgba(0,0,0,.62)'); sg.addColorStop(0.85, 'rgba(0,0,0,.62)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = sg; ctx.fillRect(W / 2 - bw / 2, yy - 30, bw, 42 + (lines.length - 1) * 28); }
      ctx.font = '400 17px "Bebas Neue",Impact,sans-serif'; const tagW = ctx.measureText('CREW').width + 14; const firstW = (() => { ctx.font = '700 18px "Open Sans",sans-serif'; return ctx.measureText(lines[0]).width; })();
      const tx = W / 2 - (firstW + tagW + 8) / 2; ctx.fillStyle = GREEN; ctx.beginPath(); ctx.roundRect(tx, yy - 18, tagW, 23, 3); ctx.fill(); caps('CREW', tx + tagW / 2, yy, 17, '#06130a', 'center', 1.5);
      ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.95)'; ctx.shadowBlur = 8; ctx.font = '700 18px "Open Sans",sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.fillText(lines[0], tx + tagW + 8, yy);
      ctx.textAlign = 'center'; for (let i = 1; i < lines.length; i++) ctx.fillText(lines[i], W / 2, yy + i * 24); ctx.restore(); ctx.globalAlpha = 1; }
  }
  const HAND = new Image(); HAND.src = 'assets/tex/hand.webp';
  const TRAIL = [];
  function drawHand(x, y, a) {   // a touch point (owner 01:15: a circle, not a hand): soft disc, ripple, fading trail
    const t = performance.now() / 1000, rp = (t * 1.4) % 1; TRAIL.push([x, y, t]); while (TRAIL.length && t - TRAIL[0][2] > 0.35) TRAIL.shift();
    ctx.save(); for (const [tx, ty, tt] of TRAIL) { const k = 1 - (t - tt) / 0.35; ctx.globalAlpha = a * k * 0.25; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(tx, ty, 16 * k + 4, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = a * (1 - rp) * 0.7; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(x, y, 24 + rp * 22, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = a; const g2 = ctx.createRadialGradient(x, y, 0, x, y, 24); g2.addColorStop(0, 'rgba(255,255,255,.95)'); g2.addColorStop(0.6, 'rgba(255,255,255,.55)'); g2.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(x, y, 24, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
  const HINT_X = 430;   // the right thumb's rest zone in one-handed portrait (owner 20:36)
  function hintPill(x, y, sub) { ctx.font = '400 30px "Bebas Neue",Impact,sans-serif'; if ('letterSpacing' in ctx) ctx.letterSpacing = '3px'; const tw = ctx.measureText('DRAG TO MOVE').width; if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    const w = Math.max(tw, sub ? 190 : 0) + 40, h = sub ? 62 : 42, x0 = Math.min(W - 12 - w, Math.max(12, x - w / 2)); glass(x0, y - 30, w, h, h / 2 > 26 ? 18 : 21, 0.68);
    caps('DRAG TO MOVE', x0 + w / 2, y + 2, 30, '#fff', 'center', 3); if (sub) { ctx.font = '600 14px "Open Sans",sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText('anywhere on the screen', x0 + w / 2, y + 23); } }
  const FREE = Q.has('free');   // ?free: just the robber in the bank, no tutorials, no busts, every door open (owner 23:34)
  const TUT = { shown: Q.has('notut') || FREE || Q.has('tvnow') || Q.has('vault'), on: false, at: 0, page: 0 }; const TUT2 = { shown: Q.has('notut') || FREE || Q.has('tvnow') || Q.has('vault'), on: false, at: 0 };   // the tutorial cards (owner 21:16-21:24)
  const img = src => { const i = new Image(); i.src = src; return i; };
  const TUT_PAGES = [
    { kicker: 'HOW TO STAY HIDDEN', title: 'STAY OUT OF THE RED', lines: ['The guard and the cameras see everything in red.', 'One touch and you are busted.'], shots: [[img('assets/tut_guard.webp'), '']], key: 'rgba(255,42,58,.7)' },
    { kicker: 'HOW TO GET IN', title: 'HACK YOUR WAY IN', lines: ['Get close to a glowing icon and tap it.', 'Each hack is a quick mini-game.'], shots: [[img('assets/tut_t_cam.webp'), 'CAMERA'], [img('assets/tut_t_tv.webp'), 'TV'], [img('assets/tut_t_door.webp'), 'DOOR']], key: 'rgba(59,234,30,.7)' } ];
  function drawTut2() {   // spotlight on the CCTV hotspot: the guided first hack
    const ic = ICONS.find(i => i.id === 'cctv'); if (!ic) return; const age = (performance.now() - TUT2.at) / 1000, a = Math.min(1, age / 0.3), p = 0.5 + 0.5 * Math.sin(age * 5);
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(0,0,0,.66)'; const hr = ic.r + 14 + 4 * p; ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.moveTo(ic.x + hr, ic.y); ctx.arc(ic.x, ic.y, hr, 0, Math.PI * 2, true); ctx.fill('evenodd');   /* moveTo: no seam line from the corner (the 'lighting' wedge, owner 23:01) */
    ctx.strokeStyle = GREEN; ctx.lineWidth = 3; ctx.shadowColor = GREEN; ctx.shadowBlur = 16; ctx.beginPath(); ctx.arc(ic.x, ic.y, ic.r + 14 + 4 * p, 0, 7); ctx.stroke(); ctx.shadowBlur = 0;
    const cy = Math.min(H - 300, ic.y + 150), cw = W - 80; glass(40, cy - 20, cw, 132, 14, 0.9); ctx.strokeStyle = 'rgba(59,234,30,.6)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(40, cy - 20, cw, 132, 14); ctx.stroke();
    caps('LOOP THE CAMERA', W / 2, cy + 26, 34, '#fff', 'center', 2); ctx.font = '600 17px "Open Sans",sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillText('Tap the camera to hack it. Its red cone goes dark.', W / 2, cy + 62);
    caps('TAP THE CAMERA', W / 2, cy + 96, 20, GREEN, 'center', 3);
    ctx.strokeStyle = 'rgba(59,234,30,.7)'; ctx.setLineDash([6, 6]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ic.x, ic.y + ic.r + 18); ctx.lineTo(Math.max(70, Math.min(W - 70, ic.x)), cy - 22); ctx.stroke(); ctx.setLineDash([]); ctx.restore(); }
  function drawTut() {
    const pg = TUT_PAGES[TUT.page], age = (performance.now() - TUT.at) / 1000, a = Math.min(1, age / 0.25), cw = W - 56, x0 = 28, n = pg.shots.length, iw = (cw - 36 - (n - 1) * 12) / n, ih = n > 1 ? iw * 1.25 : iw * 0.625,   /* one large still per card (owner 21:26: two thumbnails were too small on a phone) */ ch = 70 + ih + 34 + 116, y0 = H / 2 - ch / 2 - 30;
    ctx.save(); ctx.fillStyle = `rgba(0,0,0,${0.55 * Math.min(1, (performance.now() - TUT.at0) / 250 || 1)})`; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = a;
    ctx.translate((1 - a) * 30, 0); glass(x0, y0, cw, ch, 14, 0.88); ctx.strokeStyle = pg.key; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(x0, y0, cw, ch, 14); ctx.stroke();
    caps(pg.kicker, W / 2, y0 + 36, 17, GREEN, 'center', 3);
    pg.shots.forEach(([im, label], i) => { const ix = x0 + 18 + i * (iw + 12), iy = y0 + 54; ctx.save(); ctx.beginPath(); ctx.roundRect(ix, iy, iw, ih, 8); ctx.clip();
      if (im.complete && im.naturalWidth) { const r = Math.max(iw / im.naturalWidth, ih / im.naturalHeight), dw = im.naturalWidth * r, dh = im.naturalHeight * r; ctx.drawImage(im, ix + (iw - dw) / 2, iy + (ih - dh) / 2, dw, dh); } else { ctx.fillStyle = '#222'; ctx.fillRect(ix, iy, iw, ih); }
      const lg = ctx.createLinearGradient(0, iy + ih - 40, 0, iy + ih); lg.addColorStop(0, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(0,0,0,.75)'); ctx.fillStyle = lg; ctx.fillRect(ix, iy + ih - 40, iw, 40); ctx.restore();
      ctx.strokeStyle = pg.key; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(ix, iy, iw, ih, 8); ctx.stroke(); caps(label, ix + iw / 2, iy + ih - 10, 20, '#fff', 'center', 2.5); });
    const ty = y0 + 54 + ih + 52; caps(pg.title, W / 2, ty, 38, '#fff', 'center', 2);
    ctx.font = '600 17px "Open Sans",sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.88)'; pg.lines.forEach((l, i) => ctx.fillText(l, W / 2, ty + 34 + i * 24));
    for (let i = 0; i < TUT_PAGES.length; i++) { ctx.fillStyle = i === TUT.page ? '#fff' : 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.arc(W / 2 - (TUT_PAGES.length - 1) * 9 + i * 18, y0 + ch - 16, 4, 0, 7); ctx.fill(); }
    if (age > 0.6) { const p = 0.5 + 0.5 * Math.sin(age * 5); ctx.globalAlpha = a * (0.75 + 0.25 * p); caps(TUT.page < TUT_PAGES.length - 1 ? 'TAP FOR NEXT' : 'TAP TO PLAY', W / 2, y0 + ch + 36, 22, GREEN, 'center', 3); }
    ctx.restore(); }
  const EXIT = { x: W - 40, y: 150, r: 24 }; const panelOpen = s => !!(s.mini || (s.puzzle && !s.puzzle.done) || (s.dial && !s.dial.done && !s.end));
  function drawExit(s) { if (!panelOpen(s) || s.mode !== 'play' || s.end || (s.mini && s.mini.done)) return; const y = s.mini && (s.mini.kind === 'wires' || s.mini.kind === 'remote' || s.mini.kind === 'tuner') ? 150 : s.dial ? 150 : s.puzzle ? 150 : H - 420; EXIT.y = y;
    ctx.fillStyle = 'rgba(7,10,15,.8)'; ctx.beginPath(); ctx.arc(EXIT.x, y, EXIT.r, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(EXIT.x - 8, y - 8); ctx.lineTo(EXIT.x + 8, y + 8); ctx.moveTo(EXIT.x + 8, y - 8); ctx.lineTo(EXIT.x - 8, y + 8); ctx.stroke(); ctx.lineCap = 'butt'; }
  // the joystick: floats under the thumb; glass base, direction glow, speed arc, chrome knob
  function drawStick(cx, cy, kx, ky, k, ang, run, a, ghost) {
    const R = 74, sc = 0.86 + 0.14 * a; ctx.save(); ctx.globalAlpha = a * (ghost ? 0.9 : 1); ctx.translate(cx, cy); ctx.scale(sc, sc);
    const bg = ctx.createRadialGradient(0, 0, 10, 0, 0, R + 6); bg.addColorStop(0, 'rgba(12,16,22,.18)'); bg.addColorStop(0.7, 'rgba(12,16,22,.38)'); bg.addColorStop(1, 'rgba(12,16,22,.55)'); ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, R + 6, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke();
    ctx.setLineDash([3, 7]); ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0, 0, R * CONFIG.runAt, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    for (let i = 0; i < 4; i++) { const an = i * Math.PI / 2 - Math.PI / 2; ctx.save(); ctx.rotate(an); ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(R - 16, -6); ctx.lineTo(R - 10, 0); ctx.lineTo(R - 16, 6); ctx.stroke(); ctx.restore(); }
    const accent = run ? '#ffbe28' : '#ffffff';
    if (k > 0.08) { ctx.save(); ctx.shadowColor = accent; ctx.shadowBlur = 14; ctx.strokeStyle = accent; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, R, ang - 0.45, ang + 0.45); ctx.stroke(); ctx.restore();
      ctx.strokeStyle = run ? 'rgba(255,190,40,.9)' : 'rgba(255,255,255,.65)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, R + 11, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2 * 0.999); ctx.stroke(); ctx.lineCap = 'butt'; }
    ctx.save(); ctx.shadowColor = run ? 'rgba(255,190,40,.8)' : 'rgba(0,0,0,.45)'; ctx.shadowBlur = run ? 22 : 12; ctx.shadowOffsetY = run ? 0 : 4;
    const kg = ctx.createRadialGradient(kx - 8, ky - 10, 4, kx, ky, 32); kg.addColorStop(0, '#ffffff'); kg.addColorStop(0.65, '#dfe5ea'); kg.addColorStop(1, '#a9b3bc'); ctx.fillStyle = kg; ctx.beginPath(); ctx.arc(kx, ky, 31, 0, 7); ctx.fill(); ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,.14)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(kx, ky, 22, 0, 7); ctx.stroke(); ctx.fillStyle = run ? '#ffbe28' : 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.arc(kx, ky, 5, 0, 7); ctx.fill();
    ctx.restore();
  }
  const PCB = new Image(); PCB.src = 'assets/tex/pcb.webp';
  function drawPuzzle(s) { }   // drawn after the HUD over the dim (drawDoor), like the other hacks
  function busBar(x1, y1, x2, y2, lit, t) {   // a copper bar, shaded as a rod; lit: glowing current
    ctx.lineCap = 'round'; const L = [['rgba(0,0,0,.55)', 20, 3, 5], ['#5a2f12', 17, 0, 0], ['#a8602a', 12, 0, -1], ['#e7a56a', 5, 0, -3], ['rgba(255,240,220,.6)', 1.6, 0, -5]];
    for (const [c, lw, dx, dy] of L) { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x1 + dx, y1 + dy); ctx.lineTo(x2 + dx, y2 + dy); ctx.stroke(); }
    if (lit) { ctx.save(); ctx.shadowColor = GREEN; ctx.shadowBlur = 16; ctx.strokeStyle = 'rgba(59,234,30,.85)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
      const u = (t * 2.2) % 1; ctx.fillStyle = 'rgba(220,255,210,.95)'; ctx.beginPath(); ctx.arc(x1 + (x2 - x1) * u, y1 + (y2 - y1) * u, 4, 0, 7); ctx.fill(); }
    ctx.lineCap = 'butt'; }
  function plate(x, y, w, h, lit) {   // brushed steel plate with four screws
    const pg = ctx.createLinearGradient(x, y, x + w, y + h); pg.addColorStop(0, lit ? '#4b5a4a' : '#5c6268'); pg.addColorStop(0.5, lit ? '#2f3b30' : '#3c4146'); pg.addColorStop(1, lit ? '#3d4a3c' : '#4a5056');
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3; ctx.fillStyle = pg; ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.fill(); ctx.restore();
    for (let i = 0; i < 9; i++) { ctx.fillStyle = 'rgba(255,255,255,.035)'; ctx.fillRect(x + 4, y + 6 + i * (h - 12) / 9, w - 8, 1); }
    ctx.strokeStyle = lit ? 'rgba(59,234,30,.55)' : 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x, y, w, h, 8); ctx.stroke();
    for (const [sx, sy] of [[x + 12, y + 12], [x + w - 12, y + 12], [x + 12, y + h - 12], [x + w - 12, y + h - 12]]) { const sg = ctx.createRadialGradient(sx - 1, sy - 1, 0, sx, sy, 5); sg.addColorStop(0, '#e3e7ea'); sg.addColorStop(1, '#5d646a'); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 4.5, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(sx - 3, sy); ctx.lineTo(sx + 3, sy); ctx.stroke(); } }
  function drawDoor(s) {
    const pz = s.puzzle; TILES = []; const cs = 126, x0 = (W - PC * cs) / 2, y0 = 300, on = powered(pz), solved = pz.done;
    glass(6, 122, W - 12, H - 130, 14, 0.93); ctx.strokeStyle = 'rgba(59,234,30,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(6, 122, W - 12, H - 130, 14); ctx.stroke();
    caps(solved ? 'ACCESS GRANTED' : 'ROUTE THE POWER TO THE LOCK', W / 2, 154, 28, solved ? GREEN : '#fff', 'center', 2.5);
    ctx.font = '600 17px "Open Sans",sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.88)'; ctx.fillText(solved ? 'The security door is open' : 'Tap a piece to turn it. Join the power to the lock', W / 2, 186);
    // the board
    const bx = 12, by = 206, bw = W - 24, bh = H - 222; ctx.save(); ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.clip();
    if (PCB.complete && PCB.naturalWidth) { const r = Math.max(bw / PCB.naturalWidth, bh / PCB.naturalHeight), dw = PCB.naturalWidth * r, dh = PCB.naturalHeight * r; ctx.drawImage(PCB, bx + (bw - dw) / 2, by + (bh - dh) / 2, dw, dh); } else { ctx.fillStyle = '#0f2a1c'; ctx.fillRect(bx, by, bw, bh); }
    ctx.fillStyle = 'rgba(3,8,6,.35)'; ctx.fillRect(bx, by, bw, bh); ctx.restore(); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.stroke();
    // plates + bars
    for (let r = 0; r < PR; r++) for (let c = 0; c < PC; c++) {
      const k = r * PC + c, tl = pz.tiles[k], x = x0 + c * cs, y = y0 + r * cs, lit = on.has(k), m = rotMask(tl.base, tl.rot), cx = x + cs / 2, cy = y + cs / 2;
      plate(x + 5, y + 5, cs - 10, cs - 10, lit);
      for (const d of [N_, E_, S_, W_]) if (m & d) busBar(cx, cy, cx + STEP[d][1] * (cs / 2 - 4), cy + STEP[d][0] * (cs / 2 - 4), lit, s.t);
      const hg = ctx.createRadialGradient(cx - 3, cy - 4, 2, cx, cy, 15); hg.addColorStop(0, lit ? '#d9ffd0' : '#f2c79a'); hg.addColorStop(1, lit ? '#2a8a1a' : '#6a3a16'); ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx, cy, 14, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.lineWidth = 2; ctx.stroke();
      TILES.push({ x, y, cs, i: k });
    }
    // power terminal (left) and the lock solenoid (right)
    const sy = y0 + cs + cs / 2, ty = y0 + pz.exitRow * cs + cs / 2, tlit = gridSolved(pz);
    busBar(x0 - 26, sy, x0 + 6, sy, true, s.t); const tg = ctx.createLinearGradient(0, sy - 26, 0, sy + 26); tg.addColorStop(0, '#ff6a5a'); tg.addColorStop(1, '#8a1408'); ctx.fillStyle = tg; ctx.beginPath(); ctx.roundRect(x0 - 44, sy - 26, 28, 52, 6); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 2; ctx.stroke(); caps('+', x0 - 30, sy + 8, 26, '#fff', 'center', 0);
    busBar(x0 + PC * cs - 6, ty, x0 + PC * cs + 22, ty, tlit, s.t); const lg = ctx.createLinearGradient(0, ty - 30, 0, ty + 30); lg.addColorStop(0, tlit ? '#7dff6a' : '#c6ccd1'); lg.addColorStop(1, tlit ? '#1f7a12' : '#4a5056'); ctx.fillStyle = lg; ctx.beginPath(); ctx.roundRect(x0 + PC * cs + 16, ty - 30, 30, 60, 8); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 2; ctx.stroke(); glyph('lock', x0 + PC * cs + 31, ty, 20, tlit ? '#041' : '#222');
    caps('POWER', x0 - 30, sy + 48, 15, '#ffb4a8', 'center', 1.5); caps(tlit ? 'OPEN' : 'LOCK', x0 + PC * cs + 31, ty + 50, 15, tlit ? GREEN : '#e6ecf0', 'center', 1.5);
  }
  const MONITOR = { x: 12, y: 166, w: 616, h: 346 }, WIRE = { drag: null, x: 0, y: 0, plugs: [620, 730, 840].map(y => ({ x: 120, y })), ports: [620, 730, 840].map(y => ({ x: 548, y })) }, WCOL = ['#ff3b4f', '#ffd600', '#3fd6ff'];
  const JUNC = new Image(); JUNC.src = 'assets/tex/junction.webp';
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255, f = v => Math.round(k >= 1 ? v + (255 - v) * (k - 1) : v * k); return `rgb(${f(r)},${f(g)},${f(b)})`; };
  function cablePath(x0, y0, hx, hy) { const d = Math.hypot(hx - x0, hy - y0), sag = 26 + d * 0.12; return [x0, y0, x0 + (hx - x0) * 0.45, y0 + sag, hx - (hx - x0) * 0.25, hy + sag * 0.35, hx, hy]; }
  function strokeBez(p, dx, dy) { ctx.beginPath(); ctx.moveTo(p[0] + dx, p[1] + dy); ctx.bezierCurveTo(p[2] + dx, p[3] + dy, p[4] + dx, p[5] + dy, p[6] + dx, p[7] + dy); ctx.stroke(); }
  const bez = (p, t) => { const u = 1 - t; return [u * u * u * p[0] + 3 * u * u * t * p[2] + 3 * u * t * t * p[4] + t * t * t * p[6], u * u * u * p[1] + 3 * u * u * t * p[3] + 3 * u * t * t * p[5] + t * t * t * p[7]]; };
  function cable(x0, y0, hx, hy, col, inserted) {   // a rubber tube from the panel edge; inserted = pushed straight into a socket (rises toward the viewer)
    const p = cablePath(x0, y0, hx, hy), N = 40, rise = 1.01; ctx.lineCap = 'round';
    const widthAt = t => t < rise ? 1 : 1 + (t - rise) / (1 - rise) * 0.75;   // thicker as it comes toward the camera
    const layers = [['rgba(0,0,0,.5)', 20, 3, 6], [shade(col, 0.42), 18, 0, 0], [shade(col, 0.85), 13, 0, -1], [shade(col, 1.25), 6, 0, -3], ['rgba(255,255,255,.55)', 1.6, 0, -5]];
    for (const [c, lw, dx, dy] of layers) { ctx.strokeStyle = c; let prev = bez(p, 0);
      for (let i = 1; i <= N; i++) { const t = i / N, q = bez(p, t), k = widthAt(t); ctx.lineWidth = lw * k; ctx.beginPath(); ctx.moveTo(prev[0] + dx * k, prev[1] + dy * k); ctx.lineTo(q[0] + dx * k, q[1] + dy * k); ctx.stroke(); prev = q; } }
    ctx.lineCap = 'butt';
    if (inserted) { const r = 13; const g2 = ctx.createRadialGradient(hx - 4, hy - 5, 2, hx, hy, r); g2.addColorStop(0, shade(col, 1.35)); g2.addColorStop(0.6, col); g2.addColorStop(1, shade(col, 0.35)); ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(hx, hy, r, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(hx, hy, r + 2, 0, 7); ctx.stroke(); }
    else { const ang = Math.atan2(p[7] - p[5], p[6] - p[4]); ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang); const fg = ctx.createLinearGradient(0, -9, 0, 9); fg.addColorStop(0, '#e9edf0'); fg.addColorStop(0.5, '#8e959b'); fg.addColorStop(1, '#3b4045'); ctx.fillStyle = fg; ctx.beginPath(); ctx.roundRect(-10, -9.5, 8, 19, 2); ctx.fill(); ctx.fillStyle = shade(col, 0.9); ctx.beginPath(); ctx.arc(0, 0, 8.5, -Math.PI / 2, Math.PI / 2); ctx.fill(); ctx.restore(); } }
  function plug(x, y, ang, col) {   // metal connector head: body, coloured collar, gold pin, pointing along the cable
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.shadowColor = 'rgba(0,0,0,.55)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
    const bg = ctx.createLinearGradient(0, -12, 0, 12); bg.addColorStop(0, '#e9edf0'); bg.addColorStop(0.45, '#9aa1a7'); bg.addColorStop(1, '#3b4045');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.roundRect(-40, -12, 38, 24, 5); ctx.fill(); ctx.shadowColor = 'transparent';
    const cg = ctx.createLinearGradient(0, -14, 0, 14); cg.addColorStop(0, shade(col, 1.3)); cg.addColorStop(0.5, col); cg.addColorStop(1, shade(col, 0.45)); ctx.fillStyle = cg; ctx.beginPath(); ctx.roundRect(-50, -14, 14, 28, 4); ctx.fill();
    for (let k = 0; k < 3; k++) { ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(-34 + k * 9, -12, 2, 24); }
    const pg = ctx.createLinearGradient(0, -5, 0, 5); pg.addColorStop(0, '#fbe7a6'); pg.addColorStop(0.5, '#d4a640'); pg.addColorStop(1, '#7a5a1c'); ctx.fillStyle = pg; ctx.beginPath(); ctx.roundRect(-3, -5, 16, 10, 2); ctx.fill();
    ctx.restore(); }
  function socketRim(x, y, col) { ctx.save(); ctx.beginPath(); ctx.arc(x, y, 32, 0, Math.PI * 2); ctx.moveTo(x + 16.5, y); ctx.arc(x, y, 16.5, 0, Math.PI * 2, true); const rg = ctx.createRadialGradient(x - 8, y - 10, 4, x, y, 34); rg.addColorStop(0, '#dfe4e8'); rg.addColorStop(0.55, '#7d848a'); rg.addColorStop(1, '#2a2e32'); ctx.fillStyle = rg; ctx.fill('evenodd');
    ctx.shadowColor = col; ctx.shadowBlur = 22; ctx.strokeStyle = shade(col, 1.2); ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(x, y, 24, 0, 7); ctx.stroke(); ctx.restore(); }
  function socket(x, y, col, on, code, t) {   // beveled steel socket with an LED ring
    const rg = ctx.createRadialGradient(x - 8, y - 10, 4, x, y, 34); rg.addColorStop(0, '#dfe4e8'); rg.addColorStop(0.55, '#7d848a'); rg.addColorStop(1, '#2a2e32');
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4; ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, 32, 0, 7); ctx.fill(); ctx.restore();
    ctx.fillStyle = '#0b0d10'; ctx.beginPath(); ctx.arc(x, y, 17, 0, 7); ctx.fill();
    ctx.save(); ctx.shadowColor = col; ctx.shadowBlur = on ? 22 : 10 + 6 * Math.sin(t * 4); ctx.strokeStyle = on ? shade(col, 1.2) : col; ctx.lineWidth = on ? 5 : 3.5; ctx.beginPath(); ctx.arc(x, y, 24, 0, 7); ctx.stroke(); ctx.restore();
    ctx.font = '700 12px "Open Sans",sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(230,236,240,.75)'; ctx.fillText(code, x + 38, y + 4); }
  const REMOTE = new Image(); REMOTE.src = 'assets/tex/remote.webp'; const REMOTE_KEYS = {"1": [0.194, 0.489], "2": [0.5, 0.489], "3": [0.802, 0.489], "4": [0.194, 0.632], "5": [0.5, 0.632], "6": [0.802, 0.632], "7": [0.194, 0.776], "8": [0.5, 0.776], "9": [0.802, 0.776], "0": [0.5, 0.916], "ok": [0.5, 0.19], "r": 0.116};
  const RBOX = { x: 0, y: 0, w: 0, h: 0 };
  const KNOB = new Image(); KNOB.src = 'assets/tex/knob.webp'; const TK = { x: W / 2, y: 0, r: 104, drag: false, a0: 0 }; const BB = { x: W / 2 - 150, y: 0, w: 300, h: 58 };
  function drawTuner(s) {   // the lobby TV, a frequency scale with a needle, a signal meter, the knob
    const m = s.mini, sig = m.done ? 1 : clamp(1 - Math.abs(m.f - m.ft) / 0.11, 0, 1), sharp = Math.pow(sig, 3);   // only clear close to the band (owner 00:14)
    glass(6, 122, W - 12, H - 130, 14, 0.93); ctx.strokeStyle = 'rgba(59,234,30,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(6, 122, W - 12, H - 130, 14); ctx.stroke();
    caps(m.done ? 'SIGNAL LOCKED' : 'TUNE IN YOUR STREAM', W / 2, 154, 28, m.done ? GREEN : '#fff', 'center', 2.5);
    const tw = 560, tx = (W - tw) / 2, ty = 172, th = tw * 9 / 16; ctx.fillStyle = '#0b0b0c'; ctx.beginPath(); ctx.roundRect(tx - 8, ty - 8, tw + 16, th + 16, 8); ctx.fill(); ctx.strokeStyle = '#3a3c40'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.rect(tx, ty, tw, th); ctx.clip(); ctx.fillStyle = '#111'; ctx.fillRect(tx, ty, tw, th);
    // the stream picture, rolling and tearing until it is tuned
    const roll = m.done ? 0 : ((s.t * 380 * (1 - sharp) * (1 - sharp)) % th), drawPic = (oy) => { const sg = ctx.createLinearGradient(tx, ty + oy, tx + tw, ty + oy + th); sg.addColorStop(0, '#ff2fb3'); sg.addColorStop(1, '#7a1060'); ctx.fillStyle = sg; ctx.fillRect(tx, ty + oy, tw, th);
      ctx.fillStyle = '#e8132b'; ctx.fillRect(tx + tw - 120, ty + oy + 16, 100, 34); caps('LIVE', tx + tw - 70, ty + oy + 43, 28, '#fff', 'center', 2); if (LOGOH.complete && LOGOH.naturalWidth) { const lw = 230, lh = lw * LOGOH.naturalHeight / LOGOH.naturalWidth; ctx.drawImage(LOGOH, tx + tw / 2 - lw / 2, ty + oy + th / 2 - lh / 2 - 12, lw, lh); } caps('MASKED CREW · LIVE FROM THE BANK', tx + tw / 2, ty + oy + th - 26, 22, '#fff', 'center', 2); };
    ctx.globalAlpha = 0.15 + 0.85 * sharp; drawPic(roll); drawPic(roll - th); ctx.globalAlpha = 1;
    if (!m.done) { for (let i = 0; i < 6 * (1 - sharp) + 1; i++) { const yy = ty + ((s.t * 523 + i * 97) % th), hh = 3 + (i * 7) % 12, off = (1 - sharp) * 60 * Math.sin(s.t * 31 + i); ctx.drawImage(cv, (tx) * HUDSC, yy * HUDSC, tw * HUDSC, hh * HUDSC, tx + off, yy, tw, hh); }
      const n = Math.floor(1400 * (1 - sharp)); for (let i = 0; i < n; i++) { const v = Math.floor(Math.random() * 255); ctx.fillStyle = `rgba(${v},${v},${v},${0.85 * (1 - sharp)})`; ctx.fillRect(tx + Math.random() * tw, ty + Math.random() * th, 5, 2); } }
    ctx.restore();
    // frequency scale with a needle
    const sy = ty + th + 34, sx0 = 56, sx1 = W - 56; glass(sx0 - 14, sy - 24, sx1 - sx0 + 28, 58, 8, 0.7);
    for (let i = 0; i <= 40; i++) { const x = sx0 + (sx1 - sx0) * i / 40, big = i % 5 === 0; ctx.fillStyle = 'rgba(230,236,240,.7)'; ctx.fillRect(x - 1, sy - (big ? 12 : 6), 2, big ? 12 : 6); if (big) { ctx.font = '600 11px "Open Sans",sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(230,236,240,.6)'; ctx.fillText(String(470 + i * 5), x, sy + 18); } }
    const nx = sx0 + (sx1 - sx0) * m.f; ctx.save(); ctx.shadowColor = '#ff5a1f'; ctx.shadowBlur = 10; ctx.fillStyle = '#ff5a1f'; ctx.fillRect(nx - 1.5, sy - 22, 3, 30); ctx.restore();
    // signal meter
    const my = sy + 52; caps('SIGNAL', 56, my + 6, 16, 'rgba(230,236,240,.7)', 'left', 2); for (let i = 0; i < 20; i++) { const on = i < Math.round(sig * 20), c = sig > 0.85 ? GREEN : i < 7 ? '#ff3b4f' : i < 13 ? '#ffd600' : GREEN; ctx.fillStyle = on ? c : 'rgba(255,255,255,.1)'; ctx.fillRect(130 + i * 22, my - 8, 17, 16); }
    // the knob
    TK.y = my + 132; const ang = m.f * Math.PI * 4; ctx.save(); ctx.translate(TK.x, TK.y);
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.beginPath(); ctx.arc(4, 8, TK.r + 6, 0, Math.PI * 2); ctx.fill(); ctx.rotate(ang);
    if (KNOB.complete && KNOB.naturalWidth) ctx.drawImage(KNOB, -TK.r, -TK.r, TK.r * 2, TK.r * 2); else { ctx.fillStyle = '#9aa1a7'; ctx.beginPath(); ctx.arc(0, 0, TK.r, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = '#ff5a1f'; ctx.fillRect(-3, -TK.r + 10, 6, 50); }
    ctx.restore();
    if (!m.done && s.t % 1.6 < 0.9) { ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(TK.x, TK.y, TK.r + 18, -2.4, -0.7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(TK.x + Math.cos(-0.7) * (TK.r + 18), TK.y + Math.sin(-0.7) * (TK.r + 18)); ctx.lineTo(TK.x + Math.cos(-0.7) * (TK.r + 18) - 12, TK.y + Math.sin(-0.7) * (TK.r + 18) - 4); ctx.stroke(); }
    if (!m.done) { ctx.font = '600 16px "Open Sans",sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = m.fail > 0 ? '#ff6b6b' : 'rgba(255,255,255,.85)'; ctx.fillText(m.fail > 0 ? 'Weak signal. Find a clearer picture' : 'Spin the dial until the picture clears, then broadcast', W / 2, TK.y + TK.r + 28);
      BB.y = TK.y + TK.r + 44; const pr = (m.press || 0) > 0 ? 3 : 0; ctx.save(); ctx.shadowColor = 'rgba(232,19,43,.6)'; ctx.shadowBlur = 18; const bgd = ctx.createLinearGradient(0, BB.y, 0, BB.y + BB.h); bgd.addColorStop(0, '#ff3b4f'); bgd.addColorStop(1, '#a50d1f'); ctx.fillStyle = bgd; ctx.beginPath(); ctx.roundRect(BB.x, BB.y + pr, BB.w, BB.h - pr, 12); ctx.fill(); ctx.restore();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(BB.x + 40, BB.y + BB.h / 2 + pr / 2, 7, 0, 7); ctx.fill(); caps('BROADCAST', BB.x + BB.w / 2 + 14, BB.y + BB.h / 2 + 11 + pr / 2, 30, '#fff', 'center', 3); }
    if (m.fail > 0) { ctx.save(); ctx.beginPath(); ctx.rect(tx, ty, tw, th); ctx.clip(); for (let i = 0; i < 1600 * m.fail / 1.4; i++) { const v = Math.floor(Math.random() * 255); ctx.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',.9)'; ctx.fillRect(tx + Math.random() * tw, ty + Math.random() * th, 6, 3); }
      const bw2 = 300, bh2 = 64, bx2 = tx + tw / 2 - bw2 / 2, by2 = ty + th / 2 - bh2 / 2; ctx.fillStyle = 'rgba(0,0,40,.85)'; ctx.fillRect(bx2, by2, bw2, bh2); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.strokeRect(bx2 + 4, by2 + 4, bw2 - 8, bh2 - 8); ctx.font = '400 22px "Press Start 2P",monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.fillText('WEAK SIGNAL', tx + tw / 2, by2 + bh2 / 2 + 10); ctx.restore(); }   // the TV says it, like a real set (owner 00:13)
  }
  function drawRemote(s) {   // the lobby TV above, the remote below
    const m = s.mini, M = MONITOR; glass(6, 122, W - 12, H - 130, 14, 0.93); ctx.strokeStyle = 'rgba(59,234,30,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(6, 122, W - 12, H - 130, 14); ctx.stroke();
    caps(m.done ? 'STREAM ON AIR' : 'CHANGE THE CHANNEL', W / 2, 154, 28, m.done ? GREEN : '#fff', 'center', 2.5);
    const tw = 440, tx = (W - tw) / 2, ty = 172, th = tw * 9 / 16; ctx.fillStyle = '#0b0b0c'; ctx.beginPath(); ctx.roundRect(tx - 10, ty - 10, tw + 20, th + 20, 8); ctx.fill(); ctx.strokeStyle = '#3a3c40'; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.beginPath(); ctx.rect(tx, ty, tw, th); ctx.clip();
    if (m.done) { const a = Math.min(1, (s.t - m.doneT) / 0.25); const sg = ctx.createLinearGradient(tx, ty, tx + tw, ty + th); sg.addColorStop(0, '#ff2fb3'); sg.addColorStop(1, '#7a1060'); ctx.fillStyle = sg; ctx.fillRect(tx, ty, tw, th); ctx.globalAlpha = a; ctx.fillStyle = '#e8132b'; ctx.fillRect(tx + tw - 120, ty + 16, 100, 34); caps('LIVE', tx + tw - 70, ty + 43, 28, '#fff', 'center', 2); caps('MASKED CREW · LIVE FROM THE BANK', tx + tw / 2, ty + th - 26, 22, '#fff', 'center', 2); if (LOGOH.complete && LOGOH.naturalWidth) { const lw = 200, lh = lw * LOGOH.naturalHeight / LOGOH.naturalWidth; ctx.drawImage(LOGOH, tx + tw / 2 - lw / 2, ty + th / 2 - lh / 2 - 10, lw, lh); } ctx.globalAlpha = 1; }
    else { const gr = ctx.createLinearGradient(tx, ty, tx, ty + th); gr.addColorStop(0, '#12324f'); gr.addColorStop(1, '#0a1a2c'); ctx.fillStyle = gr; ctx.fillRect(tx, ty, tw, th); ctx.fillStyle = '#c8102e'; ctx.fillRect(tx, ty + th - 44, tw, 44); ctx.font = '700 16px "Open Sans",sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.fillText('BREAKING · MASKED CREW STILL AT LARGE · POLICE ON ALERT ·', tx + tw - ((s.t * 70) % (tw + 520)), ty + th - 16); caps('CITY NEWS', tx + 22, ty + 46, 34, '#fff', 'left', 2);
      if (m.flash > 0) for (let i = 0; i < 900; i++) { const v = Math.floor(Math.random() * 255); ctx.fillStyle = `rgba(${v},${v},${v},${0.8 * m.flash / 0.5})`; ctx.fillRect(tx + Math.random() * tw, ty + Math.random() * th, 6, 3); }
      const osd = 'CH ' + (m.typed + '__').slice(0, 2); ctx.font = '700 40px "Press Start 2P",monospace'; ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillText(osd, tx + tw - 18, ty + 66); ctx.fillStyle = '#3BEA1E'; ctx.fillText(osd, tx + tw - 20, ty + 64); }
    ctx.restore();
    // the crew's phone message with the channel
    if (!m.done) { const py = ty + th + 24; glass(40, py, W - 80, 48, 10, 0.75); ctx.fillStyle = GREEN; ctx.beginPath(); ctx.roundRect(52, py + 12, 58, 24, 4); ctx.fill(); caps('CREW', 81, py + 31, 17, '#06130a', 'center', 1.5); ctx.font = '700 19px "Open Sans",sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.fillText('We are live on channel ' + m.code + '. Punch it in, then OK', 122, py + 31); }
    // the remote
    const ry = ty + th + 86, rh = H - 20 - ry, img = REMOTE.complete && REMOTE.naturalWidth ? REMOTE : null, ar = img ? img.naturalWidth / img.naturalHeight : 0.5625, rw = rh * ar; Object.assign(RBOX, { x: W / 2 - rw / 2, y: ry, w: rw, h: rh });
    if (img) ctx.drawImage(img, RBOX.x, RBOX.y, rw, rh); else { ctx.fillStyle = '#111'; ctx.fillRect(RBOX.x, RBOX.y, rw, rh); }
    if (m.pressT > 0 && REMOTE_KEYS[m.press]) { const [u, v] = REMOTE_KEYS[m.press], r = REMOTE_KEYS.r * rw; ctx.fillStyle = `rgba(59,234,30,${m.pressT / 0.18 * 0.45})`; ctx.beginPath(); ctx.arc(RBOX.x + u * rw, RBOX.y + v * rh, r, 0, 7); ctx.fill(); }
    if (!m.done) { const next = m.typed.length < 2 ? m.code[m.typed.length] : 'ok'; if (REMOTE_KEYS[next] && s.t % 1.2 < 0.6 && m.typed.length === 0 && s.t - (m.openT || (m.openT = s.t)) > 4) { const [u, v] = REMOTE_KEYS[next]; ctx.strokeStyle = 'rgba(59,234,30,.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(RBOX.x + u * rw, RBOX.y + v * rh, REMOTE_KEYS.r * rw + 4, 0, 7); ctx.stroke(); } }
  }
  function drawWires(s) {
    const m = s.mini, M = MONITOR; glass(6, 122, W - 12, H - 130, 14, 0.93); ctx.strokeStyle = 'rgba(59,234,30,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(6, 122, W - 12, H - 130, 14); ctx.stroke();
    caps(m.done ? 'CAMERA LOOPED' : 'LOOP THE CAMERA', W / 2, 154, 28, m.done ? GREEN : '#fff', 'center', 2.5);
    // the live feed: world3d draws the CCTV's view into this hole
    ctx.clearRect(M.x, M.y, M.w, M.h); ctx.save(); ctx.beginPath(); ctx.rect(M.x, M.y, M.w, M.h); ctx.clip();
    ctx.fillStyle = 'rgba(20,60,40,.16)'; ctx.fillRect(M.x, M.y, M.w, M.h); for (let y = M.y; y < M.y + M.h; y += 3) { ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(M.x, y, M.w, 1); }
    if (m.glitch > 0) for (let i = 0; i < 7; i++) { const yy = M.y + ((s.t * 997 + i * 61) % M.h), hh = 4 + (i * 13) % 18; ctx.fillStyle = i % 2 ? 'rgba(255,255,255,.35)' : 'rgba(59,234,30,.35)'; ctx.fillRect(M.x + ((i * 47) % 60) - 30, yy, M.w + 60, hh); }
    const vg = ctx.createRadialGradient(M.x + M.w / 2, M.y + M.h / 2, M.h * 0.3, M.x + M.w / 2, M.y + M.h / 2, M.w * 0.62); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.55)'); ctx.fillStyle = vg; ctx.fillRect(M.x, M.y, M.w, M.h);
    ctx.font = '700 13px "Open Sans",sans-serif'; ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillText('CAM 01 · LOBBY ENTRANCE', M.x + 12, M.y + 22);
    const tsec = 13 * 3600 + 14 * 60 + Math.floor(m.done ? m.doneT : s.t) + 7, ts = [Math.floor(tsec / 3600), Math.floor(tsec / 60) % 60, tsec % 60].map(v => String(v).padStart(2, '0')).join(':'); ctx.fillText(ts, M.x + 12, M.y + M.h - 12);
    ctx.textAlign = 'right'; if (m.done) { ctx.fillStyle = GREEN; ctx.fillText('LOOP ▶ PLAYBACK', M.x + M.w - 12, M.y + 22); } else { ctx.fillStyle = (s.t % 1) < 0.5 ? RED : 'rgba(255,59,79,.35)'; ctx.beginPath(); ctx.arc(M.x + M.w - 46, M.y + 17, 5, 0, 7); ctx.fill(); ctx.fillStyle = '#fff'; ctx.fillText('REC', M.x + M.w - 12, M.y + 22); }
    if (m.done) { const a = Math.min(1, (s.t - m.doneT) / 0.2); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(6,19,10,.75)'; ctx.fillRect(M.x + M.w / 2 - 120, M.y + M.h / 2 - 30, 240, 60); ctx.strokeStyle = GREEN; ctx.lineWidth = 3; ctx.strokeRect(M.x + M.w / 2 - 120, M.y + M.h / 2 - 30, 240, 60); caps('LOOPED', M.x + M.w / 2, M.y + M.h / 2 + 14, 40, GREEN, 'center', 6); ctx.globalAlpha = 1; }
    ctx.restore(); ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 2; ctx.strokeRect(M.x, M.y, M.w, M.h);
    ctx.font = '600 17px "Open Sans",sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fillText(m.done ? 'Security is watching an empty hall' : 'Drag each wire to its matching colour', W / 2, 554);
    // the wire area: a junction-box backplate, sockets (right), cables entering from the left edge
    { const bx = 12, by = 572, bw = W - 24, bh = H - 588; ctx.save(); ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.clip();
      if (JUNC.complete && JUNC.naturalWidth) { const r = Math.max(bw / JUNC.naturalWidth, bh / JUNC.naturalHeight), dw = JUNC.naturalWidth * r, dh = JUNC.naturalHeight * r; ctx.drawImage(JUNC, bx + (bw - dw) / 2, by + (bh - dh) / 2, dw, dh); } else { ctx.fillStyle = '#1a1d21'; ctx.fillRect(bx, by, bw, bh); }
      ctx.fillStyle = 'rgba(4,7,10,.45)'; ctx.fillRect(bx, by, bw, bh); ctx.restore(); ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 10); ctx.stroke(); }
    const CODES = ['A1', 'B2', 'C3'];
    WIRE.ports.forEach((p, i) => socket(p.x, p.y, WCOL[m.ports[i]], m.conn[m.ports[i]], CODES[i], s.t));
    WIRE.plugs.forEach((p, i) => { const c = WCOL[i]; let hx = p.x, hy = p.y;
      if (m.conn[i]) { const to = WIRE.ports[m.ports.indexOf(i)]; hx = to.x; hy = to.y; } else if (WIRE.drag === i) { hx = WIRE.x; hy = WIRE.y; }   // pin tip at the hole's centre
      cable(14, p.y, hx, hy, c, m.conn[i]);
   // the socket's rim over the plug: the jack goes in (owner 22:28)
      if (!m.conn[i] && WIRE.drag == null && !m.done) { const pul = 0.5 + 0.5 * Math.sin(s.t * 6 + i); ctx.strokeStyle = `rgba(255,255,255,${0.25 + 0.4 * pul})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x - 22, p.y, 32 + 5 * pul, 0, 7); ctx.stroke(); } });
    if (m.flash > 0) { ctx.fillStyle = `rgba(255,40,60,${m.flash})`; ctx.fillRect(14, 570, W - 28, 330); }
  }
  function drawMini(s) {
    const m = s.mini; if (!m) return; if (m.kind === 'wires' || m.kind === 'remote' || m.kind === 'tuner') return; const x0 = 70, w = W - 140, y = H - 330, h = 46;   // wires: drawn after the HUD, over a dim (owner 22:27)
    ctx.fillStyle = 'rgba(4,10,14,.9)'; ctx.beginPath(); ctx.roundRect(40, y - 70, W - 80, 150, 14); ctx.fill(); ctx.strokeStyle = WD; ctx.lineWidth = 2; ctx.stroke();
    label(W / 2, y - 40, 'SIGNAL LOCK · TAP ON GREEN', WD, 28);
    ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(x0, y, w, h); ctx.fillStyle = GREEN; ctx.fillRect(x0 + (m.zone - m.w / 2) * w, y, m.w * w, h);
    for (let i = 0; i < 24; i++) { ctx.fillStyle = 'rgba(233,241,247,.15)'; ctx.fillRect(x0 + i * w / 24, y + h - 8 - ((i * 37) % 7) * 3, 3, 8 + ((i * 37) % 7) * 3); }
    ctx.fillStyle = '#fff'; ctx.fillRect(x0 + m.u * w - 4, y - 8, 8, h + 16);
    if (m.flash > 0.05) { ctx.fillStyle = `rgba(255,40,60,${m.flash})`; ctx.fillRect(x0, y, w, h); }
  }
  const LOCK = new Image(); LOCK.src = 'assets/tex/lock.webp';
  function rod(x1, y1, x2, y2, w, c1, c2, c3) { ctx.lineCap = 'round'; for (const [lw, c, dy] of [[w + 4, 'rgba(0,0,0,.5)', 3], [w, c1, 0], [w * 0.55, c2, -w * 0.15], [w * 0.18, c3, -w * 0.3]]) { ctx.strokeStyle = c; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(x1, y1 + dy); ctx.lineTo(x2, y2 + dy); ctx.stroke(); } ctx.lineCap = 'butt'; }
  function drawPick(s) {
    const d = s.dial, inS = Math.abs(d.a - d.sweet) <= CONFIG.pinW[d.pins] / 2, near = Math.max(0, 1 - Math.abs(d.a - d.sweet) / 40), snapped = d.snap > 0;
    glass(6, 122, W - 12, H - 130, 14, 0.93); ctx.strokeStyle = 'rgba(59,234,30,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(6, 122, W - 12, H - 130, 14); ctx.stroke();
    caps(d.done ? 'VAULT OPEN' : snapped ? 'PICK SNAPPED' : 'CRACK THE VAULT', W / 2, 154, 28, d.done ? GREEN : snapped ? '#ff6b6b' : '#fff', 'center', 2.5);
    ctx.font = '600 17px "Open Sans",sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = inS && !snapped ? GREEN : 'rgba(255,255,255,.88)'; ctx.fillText(snapped ? 'Too much force. Ease off and try again' : inS ? 'Hold still... the pin is setting' : 'Slide left or right. Stop where it shakes, then hold', W / 2, 186);
    // pin chamber cutaway
    const px0 = 150, pw = W - 300, py0 = 210, ph = 170, shear = py0 + 104; glass(px0 - 20, py0 - 8, pw + 40, ph + 16, 10, 0.6);
    ctx.fillStyle = 'rgba(120,126,134,.22)'; ctx.fillRect(px0, py0, pw, ph); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.5; ctx.strokeRect(px0, py0, pw, ph);
    ctx.setLineDash([6, 5]); ctx.strokeStyle = 'rgba(59,234,30,.55)'; ctx.beginPath(); ctx.moveTo(px0, shear); ctx.lineTo(px0 + pw, shear); ctx.stroke(); ctx.setLineDash([]); caps('SHEAR LINE', px0 + pw + 10, shear + 5, 12, 'rgba(59,234,30,.7)', 'left', 1);
    for (let i = 0; i < 3; i++) { const x = px0 + pw * (i + 0.5) / 3, set = i < d.pins, cur = i === d.pins && !d.done, jit = cur && !snapped ? Math.sin(s.t * 70 + i) * (near * near * 5 + (inS ? 2 : 0)) : 0, lift = set ? 30 : cur ? d.hold / CONFIG.pinHold * 30 : 0;
      ctx.strokeStyle = 'rgba(200,205,210,.7)'; ctx.lineWidth = 2; ctx.beginPath(); for (let k = 0; k <= 10; k++) { const yy = py0 + 6 + k * (46 - lift * 0.6) / 10; ctx.lineTo(x + (k % 2 ? 9 : -9), yy); } ctx.stroke();   // spring
      const brass = (y, h, lit) => { const gr = ctx.createLinearGradient(x - 13, 0, x + 13, 0); gr.addColorStop(0, lit ? '#2f8a1e' : '#7a5a1c'); gr.addColorStop(0.5, lit ? '#9dff7a' : '#f3d37a'); gr.addColorStop(1, lit ? '#2f8a1e' : '#8a6420'); ctx.fillStyle = gr; ctx.beginPath(); ctx.roundRect(x - 12, y, 24, h, 4); ctx.fill(); };
      brass(py0 + 54 - lift * 0.6 + jit, 46, set); brass(py0 + 104 - lift + jit, 52, set); }
    { const u = (d.a + 80) / 160, tipX = px0 + 14 + (pw - 28) * u, sh2 = snapped ? 0 : Math.sin(s.t * 90) * (near * near * 4); rod(px0 + pw + 20, py0 + ph - 14, tipX + sh2, py0 + ph - 14, 6, snapped ? '#7a1a1a' : '#5f656b', snapped ? '#ff5a5a' : '#cfd5db', '#ffffff'); ctx.fillStyle = snapped ? '#ff5a5a' : '#e6ebef'; ctx.beginPath(); ctx.moveTo(tipX + sh2, py0 + ph - 14); ctx.lineTo(tipX + sh2 + 10, py0 + ph - 26); ctx.lineTo(tipX + sh2 + 14, py0 + ph - 14); ctx.closePath(); ctx.fill(); }   // the pick under the pins
    // the lock face, turning as pins set
    const cx = W / 2, cy = 520, R = 125; ctx.save(); ctx.translate(cx, cy); ctx.rotate((d.pins * 14 + d.hold / CONFIG.pinHold * 10 + (d.done ? 70 : 0)) * D2R);
    if (LOCK.complete && LOCK.naturalWidth) ctx.drawImage(LOCK, -R, -R, R * 2, R * 2); else { ctx.fillStyle = '#8a8f95'; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.fill(); }
    ctx.restore();
    // the tension wrench (an L from the bottom of the keyway) and the pick (from the lower right into the keyway, angle = d.a)
    rod(cx, cy + 36, cx, cy + 118, 8, '#6d737a', '#c3c9cf', '#f2f5f7'); rod(cx, cy + 118, cx - 80, cy + 118, 8, '#6d737a', '#c3c9cf', '#f2f5f7');
    { const u = (d.a + 80) / 160, sh = snapped ? 0 : (near * near * 5 + (inS ? 2 : 0)) * Math.sin(s.t * 90), kx = cx - 26 + 52 * u + sh * 0.4; ctx.save(); if (near > 0.2 && !snapped) { ctx.shadowColor = inS ? GREEN : '#ffd600'; ctx.shadowBlur = near * 18; } rod(cx + 170, cy - 18, kx, cy - 18, 7, snapped ? '#7a1a1a' : '#5f656b', snapped ? '#ff5a5a' : '#cfd5db', '#ffffff'); ctx.restore(); ctx.fillStyle = '#2b2f34'; ctx.beginPath(); ctx.roundRect(cx + 150, cy - 28, 80, 20, 7); ctx.fill(); }
    // vibration gauge + stress
    const gx = 40, gy = 676; caps('VIBRATION', gx, gy - 8, 15, 'rgba(230,236,240,.75)', 'left', 2); for (let i = 0; i < 16; i++) { const on = i < Math.round(near * 16); ctx.fillStyle = on ? (inS ? GREEN : i > 11 ? '#ffd600' : '#c8a640') : 'rgba(255,255,255,.1)'; ctx.fillRect(gx + i * 18, gy, 14, 18 + (i % 2) * 4); }
    caps('STRESS', W - 40, gy - 8, 15, 'rgba(255,170,170,.8)', 'right', 2); ctx.fillStyle = 'rgba(255,255,255,.1)'; ctx.fillRect(W - 240, gy, 200, 12); ctx.fillStyle = '#ff3b4f'; ctx.fillRect(W - 240, gy, 200 * d.stress, 12);
    if (!d.held && !snapped && !d.done) { const u = 0.5 + 0.5 * Math.sin(s.t * 2.2), hx = 150 + (W - 300) * u, hy = 830, a2 = Math.min(1, (s.t - (d.idleAt || (d.idleAt = s.t))) / 0.4);   // a ghost thumb shows the gesture (owner 01:09: no slider)
      ctx.save(); ctx.globalAlpha = a2; ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3; ctx.setLineDash([8, 8]); ctx.beginPath(); ctx.moveTo(150, hy); ctx.lineTo(W - 150, hy); ctx.stroke(); ctx.setLineDash([]);
      drawHand(hx, hy, 1);
      caps('SLIDE LEFT AND RIGHT', W / 2, hy + 62, 26, '#fff', 'center', 3); ctx.restore(); } else if (d.held) d.idleAt = 0;
    caps(`${d.pins} / 3 PINS SET`, W / 2, 742, 30, d.done ? GREEN : '#fff', 'center', 3);
    if (d.flash > 0.05) { ctx.fillStyle = `rgba(59,234,30,${d.flash * 0.6})`; ctx.fillRect(6, 122, W - 12, H - 130); }
    if (d.flash < -0.05) { ctx.fillStyle = `rgba(255,40,60,${-d.flash * 0.6})`; ctx.fillRect(6, 122, W - 12, H - 130); }
    if (navigator.vibrate && s.mode === 'play' && !BOT && near > 0.6 && d.held && (s.t * 10 % 1) < 0.2) try { navigator.vibrate(near > 0.9 ? 30 : 12); } catch (e) {}
  }
  function drawDial(s) {
    const d = s.dial; if (!d || (d.done && s.endT > 0.6)) return; if (d.pick) return; const cx = W / 2, cy = 470, R = 170;   // the lockpick draws after the HUD over the dim
    ctx.fillStyle = 'rgba(30,32,36,.92)'; ctx.beginPath(); ctx.arc(cx, cy, R + 26, 0, 7); ctx.fill(); ctx.strokeStyle = '#8a8c90'; ctx.lineWidth = 8; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 26; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
    if (!d.done) { const w = CONFIG.dialZones[Math.min(2, d.hits)] / 2; ctx.strokeStyle = GREEN; ctx.beginPath(); ctx.arc(cx, cy, R, (d.zone - w - 90) * D2R, (d.zone + w - 90) * D2R); ctx.stroke(); }
    const ma = (d.a - 90) * D2R; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx + Math.cos(ma) * R, cy + Math.sin(ma) * R, 18, 0, 7); ctx.fill(); ctx.strokeStyle = '#000'; ctx.lineWidth = 3; ctx.stroke();
    for (let i = 0; i < 3; i++) { ctx.fillStyle = i < d.hits ? GREEN : '#444'; ctx.beginPath(); ctx.arc(cx - 50 + i * 50, cy, 18, 0, 7); ctx.fill(); }
    label(cx, cy + 70, `${d.hits}/3`, '#fff', 48); label(cx, cy + R + 60, 'TAP ON GREEN', GREEN, 34);
    if (d.flash < -0.05) { ctx.fillStyle = `rgba(255,40,60,${-d.flash})`; ctx.beginPath(); ctx.arc(cx, cy, R + 26, 0, 7); ctx.fill(); }
    if (d.flash > 0.05) { ctx.fillStyle = `rgba(59,234,30,${d.flash})`; ctx.beginPath(); ctx.arc(cx, cy, R + 26, 0, 7); ctx.fill(); }
  }
  function draw(s) {
    const W3 = !!window.W3D; if (W3) ctx.clearRect(0, 0, W, H); else { ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H); }
    if (!W3) {
    room(ROOM.vault, '#4c4e52', '#47494d', '#5e6064', 4.5); room(ROOM.corr, '#45474b', '#414347', '#55575b', 3.2);
    { const open = s.end === 'win' ? Math.min(1, s.endT / 1.2) : 0, pts = []; for (let i = 0; i < 30; i++) { const a = i / 30 * Math.PI * 2; pts.push([Math.cos(a) * 2.4, 2.3 + Math.sin(a) * 2.2, VAULT.z - 0.02]); } poly(pts, open ? '#141414' : '#9a9ca0', '#55575b', 4); if (open) poly(pts.map(p => [p[0] - 2.4 * open * 1.1, p[1], p[2] - open * 1.6]), '#8a8c90', '#55575b', 4); }
    for (const L of LASERS) { const on = laserOn(L, s.t, s), soon = !on && laserOn(L, s.t + 0.35, s); for (const y of [0.35, 0.8, 1.25, 1.7]) line3([ROOM.corr.x0, y, L.z], [ROOM.corr.x1, y, L.z], on ? RED : soon ? ((s.t * 12 % 1) < 0.5 ? 'rgba(255,60,80,.6)' : 'rgba(255,60,80,.15)') : 'rgba(255,60,80,.12)', on ? 4 : 2); }
    { const p = P(LASERBOX.x, LASERBOX.y, LASERBOX.z); if (p) { ctx.fillStyle = s.t < s.laserHackUntil ? GREEN : '#c43'; const r = F * 0.18 / p[2]; ctx.fillRect(p[0] - r, p[1] - r, r * 2, r * 2); } }
    room({ x0: ROOM.lobby.x0, x1: ROOM.lobby.x1, z0: -5, z1: ROOM.lobby.z1 }, '#5d5f63', '#585a5e', '#6e7074', 5);   // the lobby plus its entrance vestibule (drawn, not walked)
    poly([[ROOM.lobby.x0, 0, -5], [ROOM.lobby.x1, 0, -5], [ROOM.lobby.x1, 5, -5], [ROOM.lobby.x0, 5, -5]], '#6a6c70', '#3d3f43', 1.5);
    poly([[-1.6, 0, -4.98], [1.6, 0, -4.98], [1.6, 3, -4.98], [-1.6, 3, -4.98]], 'rgba(150,190,210,.35)', '#3d3f43', 2);   // the front doors (glass)
    for (const x of [-5.5, 5.5]) poly([[x - 0.1, 0.005, 0], [x + 0.1, 0.005, 0], [x + 0.1, 0.005, 0.2], [x - 0.1, 0.005, 0.2]], '#444');
    { const z = DOOR.z; poly([[ROOM.lobby.x0, 0, z], [-1.1, 0, z], [-1.1, 5, z], [ROOM.lobby.x0, 5, z]], '#7a7c80', '#3d3f43', 1.5); poly([[1.1, 0, z], [ROOM.lobby.x1, 0, z], [ROOM.lobby.x1, 5, z], [1.1, 5, z]], '#7a7c80', '#3d3f43', 1.5); poly([[-1.1, 3.2, z], [1.1, 3.2, z], [1.1, 5, z], [-1.1, 5, z]], '#7a7c80');
      const op = s.door ? Math.min(1, (s.t - s.puzzle.doneT - 0.5) / 0.6) : 0; poly([[-1.1 - op * 2.1, 0, z - 0.02], [1.1 - op * 2.1, 0, z - 0.02], [1.1 - op * 2.1, 3.2, z - 0.02], [-1.1 - op * 2.1, 3.2, z - 0.02]], '#9da0a4', '#3d3f43', 2);
      const k = P(DOOR.keypad.x, DOOR.keypad.y, DOOR.keypad.z - 0.03); if (k) { const r = F * 0.12 / k[2]; ctx.fillStyle = s.door ? GREEN : '#e33'; ctx.fillRect(k[0] - r, k[1] - r * 1.3, r * 2, r * 2.6); }
      const sg = P(0, 3.7, z); if (sg && z - CAM.z > 4) label(sg[0], sg[1], 'VAULT ACCESS', '#ddd', Math.min(40, Math.round(F * 0.35 / (z - CAM.z)))); }
    // the lobby TV
    { const on = s.t < s.tvUntil; poly([[TV.x, TV.y - 0.55, TV.z - 1], [TV.x, TV.y - 0.55, TV.z + 1], [TV.x, TV.y + 0.55, TV.z + 1], [TV.x, TV.y + 0.55, TV.z - 1]], on ? PINK : '#1c1e22', '#000', 3); if (on) poly([[TV.x - 0.01, TV.y + 0.2, TV.z + 0.4], [TV.x - 0.01, TV.y + 0.2, TV.z + 0.9], [TV.x - 0.01, TV.y + 0.45, TV.z + 0.9], [TV.x - 0.01, TV.y + 0.45, TV.z + 0.4]], '#e8132b'); }
    // sight (hacker vision)
    if (s.z < ROOM.lobby.z1 + 1) {
      if (s.t < s.looped) cone(CCTV.x, CCTV.z, cctvAngle(s.t, s.cPh), CONFIG.camHalf, CONFIG.camRange, s.seen === 'cctv' ? 'rgba(255,40,60,.45)' : 'rgba(255,40,60,.24)', 'rgba(255,90,100,.8)');
      const g = guard(s); cone(g.x, GUARD.z, g.a, CONFIG.guardHalf, CONFIG.guardRange, s.seen === 'guard' ? 'rgba(255,40,60,.45)' : g.mode === 'look' ? 'rgba(255,40,60,.3)' : 'rgba(255,60,60,.2)', 'rgba(255,90,100,.8)');
    }
    // props and people, far → near (the robber sorts in too: pillars in front of him fade)
    const g = guard(s), items = BOX.map(b => ({ x: (b.x0 + b.x1) / 2, z: FOLLOW ? (b.z0 + b.z1) / 2 : b.z1, f: () => box(b, b.z1 < s.z && b.h > 2 && Math.abs((b.x0 + b.x1) / 2 - s.x) < 2.2 && b.z1 > CAM.z) }));
    items.push({ x: g.x, z: GUARD.z, f: () => { const r = figure(g.x, GUARD.z, { legs: '#1f2a44', body: '#3e4f70', head: '#c9b19a', cap: true, walk: s.gt * 1.4, moving: g.mode === 'walk' && s.t >= s.tvUntil, face: g.a }); if (r) { if (g.mode === 'tell') label(r.x, r.top - 26, '!', '#ffd21f', 54); if (g.mode === 'tv') label(r.x, r.top - 22, '♥', PINK, 40); } } });
    { const a = s.face * D2R, pts = [[s.x + Math.cos(a) * 0.95, 0.03, s.z + Math.sin(a) * 0.95], [s.x + Math.cos(a + 2.5) * 0.55, 0.03, s.z + Math.sin(a + 2.5) * 0.55], [s.x + Math.cos(a) * 0.5, 0.03, s.z + Math.sin(a) * 0.5], [s.x + Math.cos(a - 2.5) * 0.55, 0.03, s.z + Math.sin(a - 2.5) * 0.55]]; poly(pts, 'rgba(255,214,0,.55)', 'rgba(0,0,0,.5)', 1.5); }
    if (CONFIG.hear > 0 && s.running && !s.end) for (let i = 0; i < 2; i++) { const u = ((s.t * 1.6 + i * 0.5) % 1), rr = 0.4 + u * CONFIG.hear * 0.55, pts = []; for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; pts.push([s.x + Math.cos(a) * rr, 0.025, s.z + Math.sin(a) * rr]); } poly(pts, null, `rgba(255,255,255,${0.45 * (1 - u)})`, 2); }
    items.push({ x: s.x, z: s.z, f: () => { const blink = s.grace > 0 && (s.t * 10 % 1) < 0.5; figure(s.x, s.z, { legs: '#2a2c30', body: blink ? '#ddd' : '#33363b', head: '#6d6a64', ears: true, snout: true, eyes: true, bag: true, walk: s.walk, moving: Math.hypot(s.vx, s.vz) > 0.3, face: s.face }); } });
    items.forEach(i => { i.d = Math.hypot((i.x ?? 0) - CAM.x, i.z - CAM.z); }); items.sort((a, b) => b.d - a.d).forEach(i => i.f());
    }   // end of the 2D world (the 3D world draws it instead)
    if (!W3) { const p = P(CCTV.x + 0.15, CCTV.h, CCTV.z); if (p) { const r = F * 0.22 / p[2]; ctx.fillStyle = '#2a2a2a'; ctx.fillRect(p[0] - r * 0.4, p[1] - r * 0.6, r * 1.6, r * 1.1); ctx.fillStyle = s.t >= s.looped ? GREEN : ((s.t * 2 % 1) < 0.5 ? '#ff2a3a' : '#611'); ctx.beginPath(); ctx.arc(p[0] + r, p[1], r * 0.25, 0, 7); ctx.fill(); if (s.t >= s.looped) label(p[0] + r * 0.5, p[1] - r * 1.4, 'LOOPED', GREEN, 22); } }
    const hook = s.mode === 'play' && !s.started && !BOT; if (!hook) { drawMarker(s); drawHackIcons(s); drawGuardTag(s); drawStatus(s); } drawPuzzle(s); drawDial(s); drawMini(s);
    if (s.end === 'busted' || s.end === 'time') { ctx.fillStyle = (s.endT * 4 % 1) < 0.5 ? 'rgba(255,0,40,.28)' : 'rgba(30,60,255,.28)'; ctx.fillRect(0, 0, W, H); if (s.endT < 1.25) label(W / 2, H * 0.42, s.end === 'busted' ? C.failT : C.timeT, '#fff', 110); }
    if (s.end === 'win') for (let i = 0; i < 50; i++) { const x = (i * 97 + s.endT * 50 * (i % 5 + 1)) % W, y = ((i * 53) % H + s.endT * 320 * (1 + i % 3)) % H; ctx.fillStyle = i % 3 ? GREEN : PINK; ctx.fillRect(x, y, 16, 9); }
    if (s.grace > CONFIG.grace - 0.3 && !s.end) { ctx.fillStyle = 'rgba(255,0,40,.25)'; ctx.fillRect(0, 0, W, H); }
    hud(s);
    if (s.dial && s.dial.pick && !(s.dial.done && s.endT > 0.6)) { ctx.fillStyle = 'rgba(0,0,0,.62)'; ctx.fillRect(0, 0, W, H); drawPick(s); }   // the vault terminal over the dim (owner 01:02)
    if (s.puzzle && !(s.puzzle.done && s.t - s.puzzle.doneT > 0.9)) { ctx.fillStyle = 'rgba(0,0,0,.62)'; ctx.fillRect(0, 0, W, H); drawDoor(s); }   // the door hack over the dim (owner 00:07)
    if (s.mini && (s.mini.kind === 'wires' || s.mini.kind === 'remote' || s.mini.kind === 'tuner')) { ctx.fillStyle = 'rgba(0,0,0,.62)'; ctx.fillRect(0, 0, W, H); if (s.mini.kind === 'wires') drawWires(s); else if (s.mini.kind === 'tuner') drawTuner(s); else drawRemote(s); }   // dim the game and the HUD behind the camera hack
    // the hook (before the first drag): the title flashes in, the scene is live, a thumb shows the one action
    if (s.mode === 'play' && !s.started && !BOT && !IN.down) {
      const a = Math.min(1, s.t / 0.5);   // no splash: the game is live, only the thumb hint shows (owner 20:07)
      const u = s.t * 1.6, kx = Math.sin(u) * 22, ky = -40 - Math.cos(u * 2) * 10, cx = HINT_X, cy = H - 250;
      drawStick(cx, cy, kx, ky, Math.hypot(kx, ky) / 74, Math.atan2(ky, kx), false, a, true); drawHand(cx + kx, cy + ky, a);
      ctx.globalAlpha = a; hintPill(cx, H - 130, true); ctx.globalAlpha = 1;
      return;
    }
    // the stick (floating, fades in and out)
    if (s.mode === 'play' && !s.end && !BOT) {
      if (IN.down && !(s.dial && s.dial.pick)) { const R = 74, dx0 = IN.x - IN.ox, dy0 = IN.y - IN.oy, L = Math.hypot(dx0, dy0), kk = Math.min(1, R / Math.max(1, L));
        Object.assign(UI, { stickA: Math.min(1, UI.stickA + 0.25), sx: IN.ox, sy: IN.oy, kx: dx0 * kk, ky: dy0 * kk, k: Math.min(1, L / R), ang: Math.atan2(dy0, dx0), run: L / R > CONFIG.runAt }); }
      else UI.stickA = Math.max(0, UI.stickA - 0.14);
      if (UI.stickA > 0) { drawStick(UI.sx, UI.sy, UI.kx, UI.ky, UI.k, UI.ang, UI.run, UI.stickA, false);
        if (IN.down) { const t = UI.k > 0.85 ? 'RUN' : UI.k > 0.45 ? 'FAST WALK' : UI.k > 0.08 ? 'WALK' : ''; if (t) { ctx.font = '400 18px "Bebas Neue",Impact,sans-serif'; const tw = ctx.measureText(t).width + 26; glass(UI.sx - tw / 2, UI.sy + 96, tw, 26, 13, 0.6); caps(t, UI.sx, UI.sy + 115, 18, UI.run ? '#ffbe28' : '#fff', 'center', 2.5); } } }
      else if (!s.mini && !(s.puzzle && s.t - (s.puzzle.done ? s.puzzle.doneT : s.t) < 1.2) && !s.dial && (!s.started || s.t - IN.lastUp > 2.5)) {
        const u = s.t * 1.6, kx = Math.sin(u) * 22, ky = -40 - Math.cos(u * 2) * 10, a = Math.min(1, (s.t - IN.lastUp - 2.5) / 0.4);
        drawStick(HINT_X, H - 250, kx, ky, Math.hypot(kx, ky) / 74, Math.atan2(ky, kx), false, Math.max(0, a) * 0.85, true); drawHand(HINT_X + kx, H - 250 + ky, Math.max(0, a)); ctx.globalAlpha = Math.max(0, a); hintPill(HINT_X, H - 130, false); ctx.globalAlpha = 1;
      }
    }
  }
  // ── input ──
  const IN = { down: false, ox: 0, oy: 0, x: 0, y: 0, lastUp: 0 };
  const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; };
  window.addEventListener('pointerdown', e => {
    if (TUT2.on) { const [tx, ty] = pos(e), ic = ICONS.find(i => i.id === 'cctv'); if (ic && Math.hypot(tx - ic.x, ty - ic.y) <= ic.r + 16) { TUT2.on = false; S.safe = false; S.started = true; act(S, { tap: 'cctv' }); } return; }
    if (TUT.on) { if (performance.now() - TUT.at > 600) { if (TUT.page < TUT_PAGES.length - 1) { TUT.page++; TUT.at = performance.now(); } else TUT.on = false; } return; }
    if (S.mode !== 'play' || S.end || BOT) return; const [x, y] = pos(e);
    if (panelOpen(S) && Math.hypot(x - EXIT.x, y - EXIT.y) <= EXIT.r + 14) { act(S, { exit: true }); WIRE.drag = null; return; }
    if (S.mini && S.mini.kind === 'tuner') { if (!S.mini.done && x >= BB.x && x <= BB.x + BB.w && y >= BB.y && y <= BB.y + BB.h) { act(S, { broadcast: true }); return; } if (Math.hypot(x - TK.x, y - TK.y) < TK.r + 50) { TK.drag = true; TK.a0 = Math.atan2(y - TK.y, x - TK.x); cv.setPointerCapture(e.pointerId); } return; }
    if (S.mini && S.mini.kind === 'remote') { if (RBOX.w) { const u = (x - RBOX.x) / RBOX.w, v = (y - RBOX.y) / RBOX.h; let best = null, bd = 1e9; for (const [k, kv] of Object.entries(REMOTE_KEYS)) { if (k === 'r') continue; const d = Math.hypot((u - kv[0]) * RBOX.w, (v - kv[1]) * RBOX.h); if (d < bd) { bd = d; best = k; } } if (best && bd <= REMOTE_KEYS.r * RBOX.w * 1.25) act(S, { key: best }); } return; }
    if (S.mini && S.mini.kind === 'wires') { const i = WIRE.plugs.findIndex((p, k) => !S.mini.conn[k] && Math.hypot(x - (p.x - 22), y - p.y) < 62); if (i >= 0) { WIRE.drag = i; WIRE.x = x; WIRE.y = y; cv.setPointerCapture(e.pointerId); } return; }
    if (S.mini) { act(S, { mini: true }); return; }
    if (S.dial && S.dial.pick && !S.dial.done) { cv.setPointerCapture(e.pointerId); Object.assign(IN, { down: true, ox: x, oy: y, x, y, pickA0: S.dial.a }); S.dial.held = true; return; }
    if (S.dial && !S.dial.done) { act(S, { dial: true }); return; }
    if (S.puzzle && !S.puzzle.done) { const t = TILES.find(t => x >= t.x && x <= t.x + t.cs && y >= t.y && y <= t.y + t.cs); if (t) act(S, { tile: t.i }); return; }
    const ic = ICONS.find(i => Math.hypot(x - i.x, y - i.y) <= i.r); if (ic) { act(S, { tap: ic.id }); return; }
    cv.setPointerCapture(e.pointerId); Object.assign(IN, { down: true, ox: x, oy: y, x, y });
  });
  window.addEventListener('pointermove', e => { if (TK.drag && S.mini && S.mini.kind === 'tuner') { const [tx2, ty2] = pos(e), a1 = Math.atan2(ty2 - TK.y, tx2 - TK.x); let da = a1 - TK.a0; if (da > Math.PI) da -= Math.PI * 2; if (da < -Math.PI) da += Math.PI * 2; TK.a0 = a1; act(S, { tune: da / (Math.PI * 4) }); return; } if (WIRE.drag != null) { const [wx, wy] = pos(e); WIRE.x = wx; WIRE.y = wy; return; } if (!IN.down) return; const [x, y] = pos(e); IN.x = x; IN.y = y; if (S.dial && S.dial.pick && !S.dial.done && IN.pickA0 != null && S.dial.snap <= 0) S.dial.a = clamp(IN.pickA0 + (x - IN.ox) * 0.35, -80, 80); });
  const up = () => { TK.drag = false; if (WIRE.drag != null) { const to = WIRE.ports.findIndex(p => Math.hypot(WIRE.x - p.x, WIRE.y - p.y) < 62); if (to >= 0 && S.mini) act(S, { wire: { from: WIRE.drag, to } }); WIRE.drag = null; return; } if (IN.down) IN.lastUp = S.t; IN.down = false; IN.pickA0 = null; if (S.dial && S.dial.pick) S.dial.held = false; }; window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  function stick() { if (!IN.down || (S.dial && S.dial.pick)) return [0, 0]; const dx = IN.x - IN.ox, dy = IN.y - IN.oy, L = Math.hypot(dx, dy); if (L < 10) return [0, 0]; const k = Math.min(1, L / 70); return [dx / L * k, -dy / L * k]; }

  // ── loop ──
  let S, BOT = null; const startCard = document.getElementById('start'), endCard = document.getElementById('end');
  function begin(mode) { seed = (Date.now() & 0xffff) + 5; S = newRound(mode); BOT = mode === 'attract' || Q.has('bot') ? makeBot('perfect') : null; chat.length = 0; callout = null; once.clear(); if (mode === 'play') { say('start'); } CAM.x = S.x + CONFIG.camSide; CAM.z = S.z - CONFIG.camBack; }
  window.GAME = { get S() { return S; }, get callout() { return callout; }, camAng, blocked, seenAt, objective, get MONITOR() { return MONITOR; }, CONFIG, begin, act, CAM, ROOM, BOX, GUARD, TV, CCTV, DOOR, LASERS, LASERBOX, VAULT, guard, cctvAngle, laserOn, coneFloor, get BOT() { return BOT; } };
  document.getElementById('play').onclick = () => { startCard.classList.add('hidden'); begin('play'); };
  for (const b of document.querySelectorAll('.again')) b.onclick = () => { endTimers.forEach(clearInterval); endCard.classList.add('hidden'); begin('play'); };
  for (const b of document.querySelectorAll('.tickets')) b.onclick = () => window.open('https://www.sonypictures.com/', '_blank');
  let endTimers = [];
  function showEnd(s) {   // the approved end cards (owner 01:36)
    endTimers.forEach(clearInterval); endTimers = []; const won = s.end === 'win', E = endCard; E.classList.remove('hidden'); E.classList.toggle('lostc', !won);
    document.getElementById('endK').textContent = won ? 'YOU WENT' : 'STREAM CUT'; document.getElementById('endT').textContent = won ? 'VIRAL' : 'BUSTED';
    document.getElementById('endW').innerHTML = won ? 'WATCHED YOU<br>ROB IT LIVE' : 'WATCHED YOU<br>GET CAUGHT';
    const by = (s.by[s.by.length - 1] || '').split('@')[0], WHY = { guard: 'The guard saw you. Stay behind a pillar until his red sweeps away, then move.', cctv: 'The camera saw you. Loop it first, or wait for its red to pass.', laser: 'A laser got you. Wait for the beams to switch off, then cross.' };
    document.getElementById('endWhy').textContent = WHY[by] || WHY.guard;
    const vEl = document.getElementById('endV'), T = s.viewers, t0 = performance.now(); if (won) { const f = () => { const k = Math.min(1, (performance.now() - t0) / 1600), e = 1 - Math.pow(1 - k, 3); vEl.textContent = fmtV(T * e); if (k < 1) requestAnimationFrame(f); }; f(); } else vEl.textContent = fmtV(T);
    const box = document.getElementById('endChat'); box.innerHTML = ''; const L = won ? [['rizky', '#FF2FB3', 'LEGEND 🔥'], ['dimas_', '#3fd6ff', 'HE ACTUALLY DID IT'], ['nadia.s', '#ffd600', 'we are RICH 💰'], ['bang_jo', '#3BEA1E', 'GG GG GG'], ['ayu', '#ff8a3d', 'clip it!!'], ['salsa', '#ff6b8a', 'best stream ever'], ['tomi', '#b78cff', 'the guard 😂']] : [['rizky', '#FF2FB3', 'NOOOO 😭'], ['dimas_', '#3fd6ff', by === 'laser' ? 'the lasers got him' : 'he walked right into the red'], ['nadia.s', '#ffd600', 'unlucky bro'], ['bang_jo', '#3BEA1E', 'run it back!!'], ['ayu', '#ff8a3d', 'F in the chat'], ['tomi', '#b78cff', 'wait for the guard next time']];
    let i = 0; endTimers.push(setInterval(() => { const [w, c, m] = L[i++ % L.length], d = document.createElement('div'); d.innerHTML = '<b style="color:' + c + '">' + w + '</b>' + m; box.appendChild(d); if (box.children.length > 6) box.firstChild.remove(); }, 680));
    const cf = document.getElementById('conf'); cf.innerHTML = ''; if (won) for (let k = 0; k < 26; k++) { const e = document.createElement('i'); e.style.left = (Math.random() * 100) + '%'; e.style.background = k % 3 ? '#3BEA1E' : '#FF2FB3'; e.style.animationDelay = (-Math.random() * 3.2) + 's'; e.style.animationDuration = (2.6 + Math.random() * 1.6) + 's'; cf.appendChild(e); }
    const st = document.getElementById('endSticker'); st.style.animation = 'none'; void st.offsetWidth; st.style.animation = ''; }
  const LOGO = new Image(); LOGO.src = 'assets/logo-title.png'; const LOGOH = new Image(); LOGOH.src = 'assets/logo-horizontal.png';
  startCard.classList.add('hidden'); begin(Q.has('attract') ? 'attract' : 'play');   // the ad opens IN the game: the first drag is the start (D-041)
  if (Q.has('card')) { startCard.classList.add('hidden'); S.end = Q.get('card') === 'win' ? 'win' : 'busted'; S.endT = 9; S.viewers = 4200000; showEnd(S); }
  if (Q.has('bot')) { startCard.classList.add('hidden'); begin('play'); }
  if (Q.has('vault')) { S.started = true; S.door = true; S.puzzle = { tiles: [], done: true, doneT: -9 }; S.looped = 0; S.safe = true; S.z = 52.5; S.x = 0; CAM.z = S.z - CONFIG.camBack; CAM.x = CONFIG.camSide; }   // ?vault: start at the vault doorway, no busts (owner 00:45)
  if (Q.has('tvnow')) { S.started = true; S.looped = 0; S.x = -3.6; S.z = 16.3; S.safe = true; CAM.z = S.z - CONFIG.camBack; CAM.x = S.x + CONFIG.camSide; setTimeout(() => act(S, { tap: 'tv' }), 900); }   // ?tvnow: straight to the TV hack (owner 23:57)
  if (Q.has('vaultnow')) { S.started = true; S.door = true; S.puzzle = { tiles: [], done: true, doneT: -9 }; S.looped = 0; S.z = 58.4; S.x = 0; CAM.z = S.z - CONFIG.camBack; CAM.x = CONFIG.camSide; }
  if (Q.has('puzzle')) { S.started = true; S.z = 28.4; S.x = 0.6; S.looped = 0; S.puzzle = makeGrid(); CAM.z = S.z - CONFIG.camBack; CAM.x = S.x + CONFIG.camSide; }
  let HUDSC = 0; const reframe = () => { const r = cv.getBoundingClientRect(); const sc = r.width ? Math.min(3, Math.max(1, r.width * (devicePixelRatio || 1) / W)) : 1;
    if (Math.abs(sc - HUDSC) > 0.01) { HUDSC = sc; cv.width = Math.round(W * sc); cv.height = Math.round(H * sc); ctx.setTransform(sc, 0, 0, sc, 0, 0); }   // crisp at the phone's pixel density (owner 20:38)
    F = (H / 2) / Math.tan(CONFIG.fovY * D2R / 2); };   // HUD markers follow the full-screen world
  addEventListener('resize', reframe); new ResizeObserver(reframe).observe(cv); reframe();
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    let [cx, cz] = BOT ? BOT.tick(S) : stick();
    if (FOLLOW && !BOT) { const th = CAM.head * D2R, fx = Math.cos(th), fz = Math.sin(th); [cx, cz] = [fx * cz + fz * cx, fz * cz - fx * cx]; }   // stick up = where the camera looks
    if (S.mode === 'play' && !BOT && !TUT.shown && (S.started || IN.down) && S.z < ROOM.lobby.z1) {   // on the first drag, before a step (owner 22:56)
      TUT.shown = true; TUT.on = true; TUT.page = 0; TUT.at = TUT.at0 = performance.now(); IN.down = false; S.vx = S.vz = 0; }
    if (S.mode === 'play' && !BOT && !TUT2.shown && !Q.has('notut')) S.safe = true;
    if (FREE && S.mode === 'play') { S.safe = true; }   // free roam: no busts; the hacks (camera, TV, door lock, vault) all playable (owner 00:12)
    const redAhead = () => { const k = 0.4; return !!seenAt(S, S.x + S.vx * k, S.z + S.vz * k, S.t + k, S.gt, S.looped, S.tvUntil) || !!seenAt(S, S.x, S.z, S.t, S.gt, S.looped, S.tvUntil); };
    if (S.mode === 'play' && !BOT && TUT.shown && !TUT.on && !TUT2.shown && (S.walk > 1.5 || (S.walk > 0.2 && redAhead())) && S.looped >= 1e9 && hackable(S, HACKS[0])) { TUT2.shown = true; TUT2.on = true; TUT2.at = performance.now(); IN.down = false; S.vx = S.vz = 0; }
    if (!S.cp1 && S.looped < 1e9 && (Math.hypot(S.x + 2.8, S.z - 8.9) < 0.9 || S.bestZ > 12)) S.cp1 = true;   // checkpoint 1 reached
    const was = S.end; if (!TUT.on && !TUT2.on) step(S, dt, cx, cz);
    if (S.mode === 'play' && S.started) {
      for (const e of S.ev) { if (e === 'snap') say('spot'); if (e === 'spotted') { say('spot'); call('spot', C.spotted); } if (e === 'hack:tv') say('tv'); else if (e.startsWith('hack')) say('hack'); if (e === 'door') say('door'); if (e === 'vault') { say('vault'); call('dial', C.dial); } if (e === 'win') say('win'); }
      const far = (h, extra) => { const p = h.pos(), d = Math.hypot(p[0] - S.x, p[2] - S.z); return d > h.reach && d <= h.reach + extra; };   // approaching, not yet in reach: the chip takes over in reach
      if (S.looped >= 1e9 && far(HACKS[0], 12)) call('cctv', C.cctv);
      const g = guard(S); if (g.mode === 'tell' && S.z > 8 && S.z < GUARD.z) { if (!once.has('guard')) say('tell'); call('guard', C.guard); }
      if (S.looped < 1e9 && S.t >= S.tvUntil + 1.5 && far(HACKS[1], 10) && S.z < GUARD.z) call('tv', C.tv);
      if (S.t < S.tvUntil && S.z < GUARD.z) call('tvwalk', C.tvwalk);
      if (!S.end && !S.safe && !S.mini && S.z < ROOM.lobby.z1 && !S.seen) {   // wait / go: hidden now, but the next step would be in the red (owner 01:24)
        const ahead = [1.4, 2.4, 3.5].some(d => !!seenAt(S, S.x, Math.min(ROOM.lobby.z1 - 0.5, S.z + d), S.t, S.gt, S.looped, S.tvUntil));   // the next few steps of the path, not just one
        if (ahead) { if (!callout || callout.k !== 'wait') callout = { k: 'wait', t: 'Wait... let his red move away', at: S.t, live: S.t }; else callout.live = S.t; S.waited = (S.waited || 0) + dt; }
        else if (S.waited > 0.6) { callout = { k: 'go', t: 'GO NOW!', at: S.t, live: S.t }; S.waited = 0; } else S.waited = 0; }
      if ((CONFIG.guardWall || CONFIG.guardCircle) && S.t >= S.tvUntil && S.z > GUARD.z - CONFIG.guardRadius - 4 && S.z < GUARD.z - CONFIG.guardRadius) call('wall', C.wall);
      if (!S.door && !S.puzzle && S.z > 22 && far(HACKS[2], 12)) call('keypad', C.keypad); if (S.puzzle && !S.puzzle.done) call('puzzle', C.puzzle);
      if (S.door && S.z > 31 && S.z < 37) { if (!once.has('lasers')) say('laser'); call('lasers', C.lasers); }
    }
    if (S.end && !was && S.mode === 'attract') setTimeout(() => begin('attract'), 2000);
    if (S.end && !was && S.mode === 'play') setTimeout(() => showEnd(S), S.end === 'win' ? 1800 : 1300);
    CAM.y = CONFIG.camH + Math.abs(Math.sin(S.walk * 1.7)) * 0.03;
    if (FOLLOW) {   // swing behind the robber while he moves (not when he walks toward the camera: no flip)
      const sp = Math.hypot(S.vx, S.vz); let d = ((S.face - CAM.head + 540) % 360) - 180;
      if (sp > 0.5 && Math.abs(d) < 120) CAM.head += d * Math.min(1, dt * 1.6 * sp / CONFIG.speed);
      const th = CAM.head * D2R, tx = S.x - Math.cos(th) * CONFIG.camBack + Math.sin(th) * CONFIG.camSide, tz = S.z - Math.sin(th) * CONFIG.camBack - Math.cos(th) * CONFIG.camSide;
      CAM.x += (tx - CAM.x) * Math.min(1, dt * 8); CAM.z += (tz - CAM.z) * Math.min(1, dt * 8); CAM.yaw = (90 - CAM.head) * D2R;
      { const R = S.z < ROOM.lobby.z1 ? ROOM.lobby : S.z < ROOM.corr.z1 ? ROOM.corr : ROOM.vault; CAM.x = clamp(CAM.x, R.x0 + 0.3, R.x1 - 0.3); CAM.z = clamp(CAM.z, (S.z < ROOM.lobby.z1 ? -5 : R.z0 - 3) + 0.3, R.z1 - 0.3); }   // the camera never leaves the room (pulls in off walls)
    } else { if (CAM.fx != null) { CAM.x = CAM.fx; CAM.z = CAM.fz; }   // the free (un-armed) camera carries on from where it wants to be
      CAM.x += (S.x + CONFIG.camSide - CAM.x) * Math.min(1, dt * 6); CAM.z += (S.z - CONFIG.camBack - CAM.z) * Math.min(1, dt * 6); CAM.yaw += (clamp(S.vx / CONFIG.speed, -1, 1) * 14 * D2R - CAM.yaw) * Math.min(1, dt * 2.5);
      { const R = CAM.z < ROOM.lobby.z1 ? ROOM.lobby : CAM.z < ROOM.corr.z1 ? ROOM.corr : ROOM.vault, WM = R === ROOM.corr ? 0.45 : 0.55; CAM.x = clamp(CAM.x, R.x0 + WM, R.x1 - WM); CAM.z = Math.max(CAM.z, -4.7);   // 0.55 m off the walls: the near plane never pokes through (owner 00:48)   // the room the CAMERA is in (owner 00:51: it sat inside the corridor wall at the vault door)
        if (CAM.z < DOOR.z + 0.3 && S.z > DOOR.z - 0.8 && Math.abs(S.x) < 1.3) CAM.x = clamp(CAM.x, -0.8, 0.8);   // only when going through the doorway (owner 23:57: the camera jumped right at the clock wall)   // thread the security doorway
        if (CAM.z < ROOM.corr.z1 + 0.3 && S.z > ROOM.corr.z1 - 0.8 && Math.abs(S.x) < 2.2) CAM.x = clamp(CAM.x, -1.6, 1.6);   // and the vault doorway
        { const hitT = (ox, oz, cx, cz) => { let tmin = 1; const dx = cx - ox, dz = cz - oz;   // camera arm (owner 23:19/23:24): first pillar hit on the robber -> camera line
            for (const bx of [...BOX, ...CAMWALLS]) { if (bx.h < 2.5) continue; const m = 0.3, x0 = bx.x0 - m, x1 = bx.x1 + m, z0 = bx.z0 - m, z1 = bx.z1 + m; let t0 = 0, t1 = 1, ok = true;
              for (const [o, d, lo, hi] of [[ox, dx, x0, x1], [oz, dz, z0, z1]]) { if (Math.abs(d) < 1e-6) { if (o < lo || o > hi) ok = false; continue; } let a1 = (lo - o) / d, a2 = (hi - o) / d; if (a1 > a2) [a1, a2] = [a2, a1]; t0 = Math.max(t0, a1); t1 = Math.min(t1, a2); if (t0 > t1) ok = false; }
              if (ok && t0 > 0 && t0 < tmin) tmin = t0; } return tmin; };
          const ox = S.x, oz = S.z, dx = CAM.x - ox, dz = CAM.z - oz, L = 0.35; CAM.fx = CAM.x; CAM.fz = CAM.z;
          const tNow = hitT(ox, oz, CAM.x, CAM.z), tAhead = hitT(ox + S.vx * L, oz + S.vz * L, CAM.x + S.vx * L, CAM.z + S.vz * L), kt = Math.max(0.2, Math.min(tNow, tAhead) - 0.03);
          CAM.armK = CAM.armK == null ? kt : CAM.armK + (kt - CAM.armK) * Math.min(1, dt * (kt < CAM.armK ? 7 : 3.5));   // look ahead and ease in, ease out: no pops
          if (tNow < 1 && CAM.armK > tNow - 0.03) CAM.armK = Math.max(0.2, tNow - 0.03);   // never inside the marble
          CAM.x = ox + dx * CAM.armK; CAM.z = oz + dz * CAM.armK; } } }
    if (S.end === 'win' && S.z > ROOM.corr.z1) { const k = Math.min(1, dt * 1.2); CAM.x += (0.35 - CAM.x) * k; CAM.z += (VAULT.stop - 3.4 - CAM.z) * k; S.x += (0 - S.x) * k * 0.5; }   /* he turns to the camera, the gold behind him (owner 01:26) */   // look into the open vault
    draw(S); drawExit(S); if (TUT.on) drawTut(); if (TUT2.on) drawTut2(); requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
