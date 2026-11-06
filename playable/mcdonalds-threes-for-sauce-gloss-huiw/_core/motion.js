/* The motion kit (2026-11-03, the direction of 2026-11-02 decision 2: an open mechanic composed from primitives, no
   menu). What every game's motion shares, game-side, no drawing: a game composes its mechanic from these and keeps its
   own meaning on top (what a hit means, what fills the screen, the score, the HUD, the cards). Every number is in the
   game's own units (world units on the world kit, frame fractions on a stage); nothing here is in pixels. Every piece
   is deterministic for the sims (a burst takes a seed), costs nothing while idle, and never allocates per frame once
   made. Tween, spring, timers and the camera rig run on MOTION.update(dt) once per frame; the rest the game steps.

   const M = window.MOTION;

   M.update(dt)                                   step every live tween, spring, timer and the camera rig (call once per
                                                  frame from the game's update, before reading any of them)

   PROJECTILE: a thing in flight under gravity, in the kit's units (world units on the world kit, frame fractions on a
   stage; use the same units for gravity and the hit tests)
   const p = M.projectile({ x, y, z, vx, vy, vz, g, drag, floor, bounce })
                                                  g: units/s² down (9.8 world; a stage uses about 2.5); drag: 0..1 per
                                                  second of speed lost in the air (0); floor: the y a projectile lands on
                                                  (0, the ground; null: never lands); bounce: the share of vertical speed
                                                  kept on landing (0: it stops; 0.4: a bounce)
   p.step(dt) -> 'air' | 'landed' | 'rest'        advances it; 'landed' once, the frame it touches the floor; 'rest' after
   p.x, p.y, p.z, p.vx, p.vy, p.vz, p.live, p.age the state (set p.live = false to drop it)
   p.at(t) -> { x, y, z }                         where it will be t seconds from now (the aim line, the bot's read)
   M.launch(from, to, { secs } | { speed } | { apex }, g)   the velocity that carries a thing from `from` to `to` ({ x, y, z })
                                                  in secs, or at a speed (the low arc), or over an apex height above the
                                                  higher end: -> { vx, vy, vz, secs }; what every aim, throw and shot uses
   M.hitRing(p, ring, r) / M.hitBox(p, box)       the hit tests: ring = { x, y, z } with radius r (a hoop, a mouth, a
                                                  goal; true when the projectile is within r of its centre on the plane the
                                                  ring faces: the hit counts on the frame the projectile crosses the ring's
                                                  plane, never twice); box = { x, y, z, w, h, d } a block (true inside it).
                                                  Both take the projectile's last step into account so a fast thing never
                                                  tunnels through a thin target
   M.hitRim(p, ring, r, rimW, bounce) -> 'through' | 'rim' | false   the ring WITH its rim: 'through' when the crossing
                                                  lands inside r (the hole), 'rim' when it lands on the band from r to
                                                  r + rimW: the projectile is put back on the near side and its velocity
                                                  reflected off the rim (bounce: the share of speed kept, 0.45), so a near
                                                  miss rattles off the orange instead of sailing through it
   M.swipe(points, { minLen, maxSecs }) -> { dx, dy, speed, secs } | null   a swipe read off the pointer's trail
                                                  ([{ x, y, t }] in frame fractions and seconds): its direction and speed,
                                                  for a flick that launches; null until it is long and quick enough

   SPRING: a value pulled to a target with overshoot and settle, for everything that lands, bounces, squashes, pops
   const s = M.spring(value, { k, damp })         k: stiffness (120 snappy, 40 soft); damp: 0.5 bouncy .. 1 no overshoot
   s.to(target), s.v (the value), s.vel, s.at(target) (true when settled at it), s.kick(impulse) (a hit: adds velocity)
   M.spring2(x, y, opts) -> { to(x, y), x, y }    the same for a point (a camera, a thing that sways)

   TWEEN: a value eased from a to b over secs, then done; chained with .then
   const t = M.tween(from, to, secs, ease)        ease: 'linear' | 'in' | 'out' | 'inOut' | 'back' (overshoot at the end) |
                                                  'bounce' | 'elastic'; t.v the value; t.done; t.then(fn); t.cancel()
   M.tweenTo(obj, { x: 1, y: 2 }, secs, ease)     eases the named fields of an object in place (several at once)
   M.ease[name](t) the curves themselves (t 0..1 -> 0..1)

   TIMERS: for anything that happens after, or every, or for a while
   M.after(secs, fn) -> timer                      once; M.every(secs, fn) -> timer; M.during(secs, fn(t 0..1)) -> timer
   timer.cancel(); M.clear()                      clears every timer, tween and spring (the game's reset calls it)
   M.cooldown(secs) -> { ready, use(), left }     a gate that opens again secs after use() (a shot, a dash)
   M.reload({ wait, rise }) -> { use(), ready, shown, u }   the next piece after a throw (2026-11-05, the owner: "a new hero spawns just after
                                                  the previous one is flicked, making it look a little buggy"): use() at the throw; for wait
                                                  seconds (0.45) the hand is EMPTY and the eye follows the throw; then it comes in over rise
                                                  seconds (0.3), u 0 to 1 eased, from out of frame at the bottom or off the hand's own edge; a
                                                  draw is if (shown), at its place less (1 - u) of a travel; ready: it can be thrown. The hand's
                                                  slot stays named while it is empty: WORLD.hero(x, y, z, h, { kind, role })

   BURST: particles for an impact, a splash, confetti, dust; the game draws them (M knows no canvas)
   const b = M.burst({ x, y, z, n, speed, spread, g, life, size, seed, dir })
                                                  n pieces from a point; speed and its spread (units/s); dir: the mean
                                                  direction { x, y, z } (up by default); g: gravity; life: seconds each
                                                  piece lives (its `a` fades 1 -> 0 over it); size: [min, max]
   b.step(dt); b.live; b.parts -> [{ x, y, z, s, a, rot }]   the game draws each part (WORLD.shape, a sprite, a disc)
   M.trail(len) -> { push(x, y, z), points }      a ring buffer of a thing's last positions, for a streak behind it

   FLOOD: a substance rising to fill the frame with a wave on its top edge (the payoff's third beat: the brand's
   substance filling the screen; also a drain, a pour, a tide)
   const f = M.flood({ from: 0, to: 1, secs, wave: { amp, len, speed }, ease })
                                                  from/to in frame fractions of the height the surface reaches (0 the
                                                  bottom, 1 the top); wave: amplitude (fraction of height), length (fraction
                                                  of width), speed (waves per second)
   f.step(dt); f.level (0..1); f.done; f.surface(x 0..1) -> y (0..1, the top edge at x with the wave on it); f.path(ctx, W, H)
                                                  traces the filled region on a 2D context (the game fills it with its
                                                  colour or clips a picture to it); f.points(n) -> [{ x, y }] the top edge

   CAMERA RIG: the follow point, the dolly, the zoom and the shake a game hands to WORLD.begin (the world kit's
   camera stays rigid by itself; the rig is what a game moves on purpose: a payoff dolly, a hit shake, a zoom on the
   product, never an eased follow during play, greybox rule P8 / rule 39)
   const cam = M.camera({ x, y, z })              the rig; cam.set(x, y, z) the follow point this frame (the runner kit's
                                                  R.camera(), or the game's own); cam.dolly({ dx, dy, dz }, secs, ease) a
                                                  move added on top, eased; cam.zoom(factor, secs, ease) a zoom (1 none;
                                                  1.6 close); cam.shake(strength, secs) a decaying shake (the engine's
                                                  S.shake drives the same thing: set S.shake and leave it); cam.look(from,
                                                  to, secs) a dolly from one offset to another; cam.reset() back to the follow
                                                  point, no zoom; cam.value() -> { x, y, z, zoom, subject? } FOR WORLD.begin
                                                  every frame. The zoom goes to WORLD.begin as `zoom` (the world kit scales
                                                  its focal by it when given; a stage page scales its drawing by it)
   cam.frame(thing, share, secs, ease)             THE PAYOFF'S MOVE (2026-11-05): the camera goes to where the named thing
                                                  fills `share` of the frame height (0.25 to 0.35 for a hero moment), centred;
                                                  `thing` is { x, y, z, h } or a function returning it (a hoop that drifts).
                                                  The world kit derives the distance from the share (Higgsfield's rule and
                                                  ours: a camera is never pulled to typed offsets to "get closer"); a dolly
                                                  or a zoom on top still applies. cam.reset() ends it. The look line reports
                                                  the move (stats.camera) so the eye sees the framing it asked for.

   SEQUENCE: beats in order, for a payoff (hero moment, impact, the fill, the card) or a teaching loop
   M.sequence([{ secs, at(t 0..1), start(), end() }, ...]) -> seq   seq.step(dt); seq.done; seq.beat (the index); seq.skip()
                                                  each beat runs for its secs with at(t) each frame; start and end once

   Drawing what the tests read (2026-11-03, the owner's first hand on the test game: "the ball crosses the centre and
   does not register"): a projectile's point and a ring's centre are CENTRES; a world-kit shape STANDS on its y. Draw a
   ball at p.y minus half its height, a ring at its centre minus its radius, a burst's piece at q.y minus half its size,
   or the eye sees a hit where the test sees the rim.

   The sims: every piece is driven by dt only, nothing reads the clock, so a sim at 60 fixed steps a second is the
   game a player gets. */
window.MOTION = (function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rng = seed => { let s = (seed >>> 0) || 1; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  // ── easing ──
  const ease = {
    linear: t => t,
    in: t => t * t,
    out: t => 1 - (1 - t) * (1 - t),
    inOut: t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    back: t => { const c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); },
    bounce: t => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; },
    elastic: t => t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1,
  };
  const easeOf = e => (typeof e === 'function' ? e : ease[e] || ease.out);

  // ── the live set: everything update(dt) steps ──
  const live = new Set();
  function update(dt) {
    dt = clamp(dt || 0, 0, 0.05);
    for (const o of Array.from(live)) o._step(dt);
  }
  function clear() { for (const o of Array.from(live)) o.cancel(); live.clear(); }

  // ── tween ──
  function tween(from, to, secs, e) {
    const fn = easeOf(e); let t = 0; const T = Math.max(1e-6, secs || 0); const thens = [];
    const o = {
      v: from, done: false, t: 0,
      _step(dt) { t += dt; o.t = clamp(t / T, 0, 1); o.v = from + (to - from) * fn(o.t); if (o.t >= 1) { o.done = true; live.delete(o); thens.splice(0).forEach(f => f()); } },
      then(f) { if (o.done) f(); else thens.push(f); return o; },
      cancel() { live.delete(o); },
    };
    live.add(o); o._step(0); return o;
  }
  function tweenTo(obj, fields, secs, e) {
    const keys = Object.keys(fields), from = {}; for (const k of keys) from[k] = +obj[k] || 0;
    const t = tween(0, 1, secs, e); const set = () => { for (const k of keys) obj[k] = from[k] + (fields[k] - from[k]) * t.v; };
    const step = t._step; t._step = dt => { step(dt); set(); }; set(); return t;
  }

  // ── spring ──
  function spring(value, opts) {
    const k = (opts && opts.k) || 80, damp = clamp((opts && opts.damp) != null ? opts.damp : 0.7, 0.05, 1.2);
    const c = 2 * Math.sqrt(k) * damp;   // critical at damp 1
    const o = {
      v: value, vel: 0, target: value,
      to(t) { o.target = t; return o; },
      kick(i) { o.vel += i; return o; },
      at(t) { return Math.abs(o.v - (t == null ? o.target : t)) < 1e-3 && Math.abs(o.vel) < 1e-3; },
      _step(dt) { const n = Math.max(1, Math.ceil(dt / (1 / 120))), h = dt / n; for (let i = 0; i < n; i++) { const a = -k * (o.v - o.target) - c * o.vel; o.vel += a * h; o.v += o.vel * h; } },
      cancel() { live.delete(o); },
    };
    live.add(o); return o;
  }
  function spring2(x, y, opts) {
    const a = spring(x, opts), b = spring(y, opts);
    return { to(nx, ny) { a.to(nx); b.to(ny); return this; }, kick(ix, iy) { a.kick(ix); b.kick(iy || 0); return this; }, get x() { return a.v; }, get y() { return b.v; }, at() { return a.at() && b.at(); }, cancel() { a.cancel(); b.cancel(); } };
  }

  // ── timers ──
  function after(secs, fn) { let t = 0; const o = { _step(dt) { t += dt; if (t >= secs) { live.delete(o); fn(); } }, cancel() { live.delete(o); } }; live.add(o); return o; }
  function every(secs, fn) { let t = 0; const o = { _step(dt) { t += dt; while (t >= secs) { t -= secs; fn(); } }, cancel() { live.delete(o); } }; live.add(o); return o; }
  function during(secs, fn) { let t = 0; const T = Math.max(1e-6, secs); const o = { done: false, _step(dt) { t += dt; const u = clamp(t / T, 0, 1); fn(u); if (u >= 1) { o.done = true; live.delete(o); } }, cancel() { live.delete(o); } }; live.add(o); o._step(0); return o; }
  function cooldown(secs) { let left = 0; const o = { get ready() { return left <= 0; }, get left() { return Math.max(0, left); }, use() { if (left > 0) return false; left = secs; return true; }, _step(dt) { if (left > 0) left -= dt; }, cancel() { live.delete(o); } }; live.add(o); return o; }

  function reload(c) {
    c = c || {};
    const wait = c.wait == null ? 0.45 : c.wait, rise = c.rise == null ? 0.3 : c.rise, end = wait + rise;
    let t = end;
    const o = {
      use() { t = 0; return o; },
      get ready() { return t >= end; },
      get shown() { return t >= wait; },
      get u() { const x = clamp((t - wait) / Math.max(0.001, rise), 0, 1); return 1 - Math.pow(1 - x, 3); },
      _step(dt) { if (t < end) t += dt; },
      cancel() { live.delete(o); },
    };
    live.add(o);
    return o;
  }

  // ── projectile ──
  function projectile(c) {
    const g = c.g != null ? c.g : 9.8, drag = clamp(c.drag || 0, 0, 1), floor = c.floor === undefined ? 0 : c.floor, bounce = clamp(c.bounce || 0, 0, 1);
    const p = {
      x: c.x || 0, y: c.y || 0, z: c.z || 0, vx: c.vx || 0, vy: c.vy || 0, vz: c.vz || 0, live: true, age: 0, state: 'air', g,
      px: 0, py: 0, pz: 0,   // the last step's start: the hit tests sweep from it
      step(dt) {
        if (!p.live || p.state === 'rest') return p.state;
        p.px = p.x; p.py = p.y; p.pz = p.z; p.age += dt;
        if (drag) { const f = Math.pow(1 - drag, dt); p.vx *= f; p.vz *= f; p.vy *= f; }
        p.vy -= g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (floor != null && p.y <= floor && p.vy < 0) {
          p.y = floor;
          if (bounce > 0 && Math.abs(p.vy) > 0.4) { p.vy = -p.vy * bounce; p.vx *= 0.8; p.vz *= 0.8; p.state = 'air'; return 'landed'; }
          p.vy = 0; p.vx = 0; p.vz = 0; p.state = 'rest'; return 'landed';
        }
        p.state = 'air'; return 'air';
      },
      at(t) { return { x: p.x + p.vx * t, y: p.y + p.vy * t - 0.5 * g * t * t, z: p.z + p.vz * t }; },
    };
    p.px = p.x; p.py = p.y; p.pz = p.z;
    return p;
  }
  function launch(from, to, how, g) {
    g = g != null ? g : 9.8;
    const dx = (to.x || 0) - (from.x || 0), dy = (to.y || 0) - (from.y || 0), dz = (to.z || 0) - (from.z || 0), dh = Math.hypot(dx, dz);
    let secs;
    if (how && how.secs) secs = how.secs;
    else if (how && how.apex != null) { const top = Math.max(from.y || 0, to.y || 0) + how.apex, up = Math.sqrt(2 * g * Math.max(0.01, top - (from.y || 0))); const down = Math.sqrt(2 * g * Math.max(0.01, top - (to.y || 0))); secs = (up + down) / g; }
    else { const v = (how && how.speed) || 10; // the low arc at speed v: solve the time from the quadratic in t² (falls back to the straight flight time)
      const a = g * g / 4, b = -(v * v + g * dy), c0 = dh * dh + dy * dy, disc = b * b - 4 * a * c0;
      secs = disc >= 0 ? Math.sqrt(Math.max(0.01, (-b - Math.sqrt(disc)) / (2 * a))) : Math.max(0.05, Math.hypot(dh, dy) / v); }
    secs = Math.max(0.05, secs);
    return { vx: dx / secs, vz: dz / secs, vy: dy / secs + 0.5 * g * secs, secs };
  }
  // the hit tests sweep the last step: a point moving from (px, py, pz) to (x, y, z) in one frame
  function hitRing(p, ring, r) {
    const n = ring.n || { x: 0, y: 0, z: 1 };   // the plane the ring faces (along z by default: a hoop seen from the front)
    const d0 = (p.px - ring.x) * n.x + (p.py - ring.y) * n.y + (p.pz - ring.z) * n.z, d1 = (p.x - ring.x) * n.x + (p.y - ring.y) * n.y + (p.z - ring.z) * n.z;
    if (!((d0 > 0 && d1 <= 0) || (d0 < 0 && d1 >= 0) || (d0 === 0 && d1 === 0))) return false;
    const t = d0 === d1 ? 0 : d0 / (d0 - d1), cx = p.px + (p.x - p.px) * t, cy = p.py + (p.y - p.py) * t, cz = p.pz + (p.z - p.pz) * t;
    const ox = cx - ring.x, oy = cy - ring.y, oz = cz - ring.z, along = ox * n.x + oy * n.y + oz * n.z;
    return Math.hypot(ox - along * n.x, oy - along * n.y, oz - along * n.z) <= r;
  }
  function hitRim(p, ring, r, rimW, bounce) {
    const n = ring.n || { x: 0, y: 0, z: 1 };
    const d0 = (p.px - ring.x) * n.x + (p.py - ring.y) * n.y + (p.pz - ring.z) * n.z, d1 = (p.x - ring.x) * n.x + (p.y - ring.y) * n.y + (p.z - ring.z) * n.z;
    if (!((d0 > 0 && d1 <= 0) || (d0 < 0 && d1 >= 0))) return false;
    const t = d0 === d1 ? 0 : d0 / (d0 - d1), cx = p.px + (p.x - p.px) * t, cy = p.py + (p.y - p.py) * t, cz = p.pz + (p.z - p.pz) * t;
    const ox = cx - ring.x, oy = cy - ring.y, oz = cz - ring.z, along = ox * n.x + oy * n.y + oz * n.z;
    const rx = ox - along * n.x, ry = oy - along * n.y, rz = oz - along * n.z, dist = Math.hypot(rx, ry, rz);
    if (dist <= r) return 'through';
    if (dist > r + (rimW || 0.15)) return false;
    // on the rim: back to the crossing on the near side, the velocity reflected about the rim's surface there (the
    // normal points from the ring's centre out through the rim, tilted by the side the ball came from)
    const k = bounce != null ? bounce : 0.45, sgn = d0 > 0 ? 1 : -1;
    const ux = rx / dist, uy = ry / dist, uz = rz / dist;
    const nx = (ux + n.x * sgn * 1.2), ny = (uy + n.y * sgn * 1.2), nz = (uz + n.z * sgn * 1.2), nl = Math.hypot(nx, ny, nz);
    const mx = nx / nl, my = ny / nl, mz = nz / nl, dot = p.vx * mx + p.vy * my + p.vz * mz;
    p.vx = (p.vx - 2 * dot * mx) * k; p.vy = (p.vy - 2 * dot * my) * k; p.vz = (p.vz - 2 * dot * mz) * k;
    p.x = cx + mx * 0.05; p.y = cy + my * 0.05; p.z = cz + mz * 0.05;
    return 'rim';
  }
  function hitBox(p, b) {
    const inside = (x, y, z) => Math.abs(x - b.x) <= (b.w || 1) / 2 && y >= (b.y || 0) && y <= (b.y || 0) + (b.h || 1) && Math.abs(z - b.z) <= (b.d || b.w || 1) / 2;
    if (inside(p.x, p.y, p.z)) return true;
    for (let i = 1; i <= 4; i++) { const t = i / 5; if (inside(p.px + (p.x - p.px) * t, p.py + (p.y - p.py) * t, p.pz + (p.z - p.pz) * t)) return true; }
    return false;
  }
  function swipe(points, o) {
    const minLen = (o && o.minLen) || 0.06, maxSecs = (o && o.maxSecs) || 0.5;
    if (!points || points.length < 2) return null;
    const last = points[points.length - 1]; let i = points.length - 2;
    while (i > 0 && last.t - points[i].t < maxSecs) i--;
    const a = points[i], dx = last.x - a.x, dy = last.y - a.y, len = Math.hypot(dx, dy), secs = Math.max(1e-3, last.t - a.t);
    if (len < minLen) return null;
    return { dx: dx / len, dy: dy / len, len, speed: len / secs, secs };
  }

  // ── burst ──
  function burst(c) {
    const r = rng(c.seed || 1), n = c.n || 16, sp = c.speed || 4, spread = c.spread != null ? c.spread : 0.6, g = c.g != null ? c.g : 9.8, life = c.life || 0.8;
    const dir = c.dir || { x: 0, y: 1, z: 0 }, sz = c.size || [0.1, 0.2], parts = [];
    for (let i = 0; i < n; i++) {
      const a = r() * Math.PI * 2, b = (r() - 0.5) * Math.PI * spread, s = sp * (0.6 + r() * 0.8);
      // the mean direction, scattered within the spread: a cone about dir
      const sx = Math.cos(a) * Math.sin(b), sy = Math.cos(b), sz2 = Math.sin(a) * Math.sin(b);
      const up = { x: dir.x * sy + sx * (1 - Math.abs(dir.x)), y: dir.y * sy + (1 - Math.abs(dir.y)) * sx * 0.5, z: dir.z * sy + sz2 * (1 - Math.abs(dir.z)) };
      parts.push({ x: c.x || 0, y: c.y || 0, z: c.z || 0, vx: up.x * s, vy: up.y * s, vz: up.z * s, s: sz[0] + r() * (sz[1] - sz[0]), a: 1, rot: r() * Math.PI * 2, spin: (r() - 0.5) * 6, t: 0, life: life * (0.7 + r() * 0.6) });
    }
    const o = {
      parts, live: true, age: 0,
      step(dt) {
        if (!o.live) return; o.age += dt; let any = false;
        for (const q of parts) { if (q.a <= 0) continue; q.t += dt; q.vy -= g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.rot += q.spin * dt; q.a = clamp(1 - q.t / q.life, 0, 1); if (c.floor != null && q.y < c.floor) { q.y = c.floor; q.vy = 0; q.vx *= 0.9; q.vz *= 0.9; } if (q.a > 0) any = true; }
        o.live = any;
      },
    };
    return o;
  }
  function trail(len) {
    const pts = []; return { points: pts, push(x, y, z) { pts.push({ x, y, z }); if (pts.length > (len || 12)) pts.shift(); }, clear() { pts.length = 0; } };
  }

  // ── flood ──
  function flood(c) {
    const from = c.from != null ? c.from : 0, to = c.to != null ? c.to : 1, T = Math.max(1e-6, c.secs || 1.2), fn = easeOf(c.ease || 'inOut');
    const w = Object.assign({ amp: 0.015, len: 0.5, speed: 1.2 }, c.wave || {});
    const o = {
      level: from, done: false, t: 0, phase: 0,
      step(dt) { o.t += dt; o.phase += dt * w.speed * Math.PI * 2; const u = clamp(o.t / T, 0, 1); o.level = from + (to - from) * fn(u); if (u >= 1) o.done = true; },
      surface(x) { const k = (Math.PI * 2) / Math.max(0.05, w.len); return 1 - o.level + Math.sin(x * k + o.phase) * w.amp + Math.sin(x * k * 2.3 - o.phase * 0.7) * w.amp * 0.35; },
      points(n) { const out = []; n = n || 24; for (let i = 0; i <= n; i++) { const x = i / n; out.push({ x, y: o.surface(x) }); } return out; },
      path(ctx, W, H) { const n = 32; ctx.beginPath(); ctx.moveTo(0, H); for (let i = 0; i <= n; i++) { const x = i / n; ctx.lineTo(x * W, o.surface(x) * H); } ctx.lineTo(W, H); ctx.closePath(); },
    };
    return o;
  }

  // ── camera rig ──
  function camera(c) {
    const base = { x: (c && c.x) || 0, y: (c && c.y) || 0, z: (c && c.z) || 0 };
    const off = { x: 0, y: 0, z: 0 }, zoomV = { v: 1 }, frameU = { v: 0 }; let shakeS = 0, shakeT = 0, shakeL = 0, subject, frameAt = null;
    const o = {
      set(x, y, z, sub) { base.x = x || 0; base.y = y || 0; base.z = z || 0; subject = sub; return o; },
      dolly(d, secs, e) { return tweenTo(off, { x: off.x + (d.dx || 0), y: off.y + (d.dy || 0), z: off.z + (d.dz || 0) }, secs || 0.6, e || 'inOut'); },
      look(from, to, secs, e) { off.x = from.x || 0; off.y = from.y || 0; off.z = from.z || 0; return tweenTo(off, { x: to.x || 0, y: to.y || 0, z: to.z || 0 }, secs || 0.8, e || 'inOut'); },
      zoom(f, secs, e) { return tweenTo(zoomV, { v: f || 1 }, secs || 0.5, e || 'inOut'); },
      frame(at, share, secs, e) { frameAt = { at, share: share || 0.3 }; frameU.v = 0; return tweenTo(frameU, { v: 1 }, secs || 0.7, e || 'inOut'); },
      shake(s, secs) { shakeS = Math.max(shakeS, s || 1); shakeL = secs || 0.4; shakeT = shakeL; return o; },
      reset() { off.x = off.y = off.z = 0; zoomV.v = 1; shakeS = shakeT = 0; frameAt = null; frameU.v = 0; return o; },
      _step(dt) { if (shakeT > 0) { shakeT -= dt; if (shakeT <= 0) { shakeT = 0; shakeS = 0; } } },
      cancel() { live.delete(o); },
      get zoomValue() { return zoomV.v; },
      get offset() { return off; },
      value() { const k = shakeT > 0 ? shakeS * (shakeT / shakeL) : 0; const fr = frameAt && frameU.v > 0 ? Object.assign({}, typeof frameAt.at === 'function' ? frameAt.at() : frameAt.at, { share: frameAt.share, u: frameU.v }) : null;
        return { x: base.x + off.x, y: base.y + off.y, z: base.z + off.z, zoom: zoomV.v, shake: k, subject, frame: fr }; },
    };
    live.add(o); return o;
  }

  // ── sequence ──
  function sequence(beats) {
    let i = 0, t = 0, started = false;
    const o = {
      done: false, get beat() { return i; },
      step(dt) {
        if (o.done) return; const b = beats[i]; if (!b) { o.done = true; return; }
        if (!started) { started = true; if (b.start) b.start(); }
        t += dt; const u = clamp(t / Math.max(1e-6, b.secs || 0), 0, 1); if (b.at) b.at(u);
        if (u >= 1) { if (b.end) b.end(); i++; t = 0; started = false; if (i >= beats.length) o.done = true; }
      },
      skip() { const b = beats[i]; if (b && started && b.end) b.end(); i++; t = 0; started = false; if (i >= beats.length) o.done = true; },
    };
    return o;
  }

  return { update, clear, ease, tween, tweenTo, spring, spring2, after, every, during, cooldown, reload, projectile, launch, hitRing, hitRim, hitBox, swipe, burst, trail, flood, camera, sequence, rng, clamp };
})();
