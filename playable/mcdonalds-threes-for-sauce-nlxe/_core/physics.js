/* The physics kit (2026-11-04 01:16, the owner: "in a basketball kind of game the thrown object should have a full rigid body so
   that even if it hits the edge it should behave with real physics; the angle changes depending on how much of the edge is
   being hit"). cannon-es (MIT, about 130 KB minified: the engine that fits an ad) behind a small surface in the kit's own
   coordinates (x right, y up, z ahead; the world kit mirrors x when it draws). A game never touches cannon.
     const W = PHYSICS.world({ g })                      a world; g in the game's units (the arc-shot game uses 22)
     W.sphere({ x, y, z, r, vx, vy, vz, mass, bounce, friction, tag })   a thrown thing. The wrapper carries the projectile's
                                                         surface so a game and its bots read it as before: x y z, vx vy vz,
                                                         px py pz (the last step's start), age, live, state ('air' | 'landed'
                                                         | 'rest'), spin (an angle that grows with the roll), at(t) (the ballistic
                                                         read for an aim line), contacts (the tags it touched this step)
     W.solid({ x, y, z, w, h, outline, vx, vy, vz, wx, wy, wz, mass, bounce, friction, tag })   a thrown thing with a shape of its own (2026-11-05, the
                                                         owner: "the whole 3D model which is being thrown ... basically its shape", "shrink-wrap it around the shape
                                                         without the dents, we just need the right shape"). outline: points on its outside (WORLD.outline(layer, w, h)),
                                                         wrapped into one solid with no dents and few faces; x y z is its middle. Until the mesh has loaded
                                                         the outline is null and the body is a rounded stand-in of the slot, w wide and h high (the sims wait for the mesh). wx wy wz:
                                                         a spin to throw it with, if any. The wrapper is W.sphere's, and it turns: q is its turn, which
                                                         WORLD.layer(layer, kind, x, y, z, w, h, colour, { body }) gives the mesh, so what is seen is what hits.
     W.floor({ y, bounce, friction })                    the ground plane
     W.box({ x, y, z, w, h, d, tag, bounce })            a static block (a backboard, a wall), standing on y; .set(x, y, z) moves it;
                                                         draw it with the same w, h, d (WORLD.shape box takes { d }): the picture is the plate the ball meets
     W.ring({ x, y, z, r, tube, n, tag, bounce })        a rim: n small spheres around a circle in the xz plane (its opening up),
                                                         so a graze off the edge sends the ball off at the contact's angle;
                                                         .set(x, y, z) moves it (a drifting hoop)
     W.step(dt)                                          advances the world at a fixed 240 Hz sub-step, reads every wrapper back
   What a contact means is the game's: it reads body.contacts (['rim'], ['board'], ['floor']) after a step.
     PHYSICS.stats { thrown, past }                      for the judge (2026-11-05, the owner on run E: "why is the backboard not a rigid
                                                         body and why is the hero item going through it?"): thrown things made, and those
                                                         that cleared the top of a box in its own column and came down behind it,
                                                         touching nothing of it: to a player's eye they went through it. The wild bot reads this. */
import * as CANNON from './cannon.js';   // the kit's own bundle of cannon-es
export const PHYSICS = (function () {
  const stats = { thrown: 0, past: 0, solid: 0 };
  const FLOOR_GRIP = 2, SETTLE_ROLL = 0.92, SETTLE_SLIDE = 0.45;   // SETTLE: once a thrown thing has touched the floor it loses its roll and its run as a real one does; the engine has no rolling resistance of its own
  // the shrink-wrap: points to one convex solid, { v, f }, its faces wound outward. A plain incremental hull: the outline is a few dozen points.
  function hull(points) {
    const size = (i) => Math.max(...points.map(q => q[i])) - Math.min(...points.map(q => q[i]));
    const span = Math.max(size(0), size(1), size(2));
    if (!(span > 0)) return null;
    // points nearly on top of each other make slivers with no direction
    const pts = [];
    for (const q of points) if (!pts.some(o => Math.hypot(o[0] - q[0], o[1] - q[1], o[2] - q[2]) < span * 0.02)) pts.push(q);
    if (pts.length < 4) return null;
    const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const eps = span * 1e-3;
    // the first four: two far apart, the farthest from their line, the farthest from their plane
    let a = 0, b = 0;
    pts.forEach((q, i) => { if (q[0] < pts[a][0]) a = i; if (q[0] > pts[b][0]) b = i; });
    if (a === b) { pts.forEach((q, i) => { if (dot(sub(q, pts[a]), sub(q, pts[a])) > dot(sub(pts[b], pts[a]), sub(pts[b], pts[a]))) b = i; }); if (a === b) return null; }
    const line = sub(pts[b], pts[a]); let c = -1, far = eps * span;
    pts.forEach((q, i) => { const d = Math.sqrt(dot(cross(line, sub(q, pts[a])), cross(line, sub(q, pts[a])))); if (d > far) { far = d; c = i; } });
    if (c < 0) return null;
    const flat = cross(line, sub(pts[c], pts[a])), flatLen = Math.sqrt(dot(flat, flat)); let e = -1; far = eps;
    pts.forEach((q, i) => { const d = Math.abs(dot(flat, sub(q, pts[a]))) / flatLen; if (d > far) { far = d; e = i; } });
    if (e < 0) return null;   // a flat thing has no solid: the stand-in serves
    const mid = [a, b, c, e].reduce((m, i) => [m[0] + pts[i][0] / 4, m[1] + pts[i][1] / 4, m[2] + pts[i][2] / 4], [0, 0, 0]);
    const face = (i, j, k) => {
      let n = cross(sub(pts[j], pts[i]), sub(pts[k], pts[i])); const l = Math.sqrt(dot(n, n)) || 1; n = [n[0] / l, n[1] / l, n[2] / l];
      if (dot(n, sub(mid, pts[i])) > 0) { n = [-n[0], -n[1], -n[2]]; const t = j; j = k; k = t; }
      return { i, j, k, n, ok: l > 1e-12 };
    };
    let faces = [face(a, b, c), face(a, b, e), face(a, c, e), face(b, c, e)];
    pts.forEach((q, m) => {
      if (m === a || m === b || m === c || m === e) return;
      const seen = faces.filter(f => dot(f.n, sub(q, pts[f.i])) > eps);
      if (!seen.length) return;
      const edges = new Set(); for (const f of seen) for (const [u, v] of [[f.i, f.j], [f.j, f.k], [f.k, f.i]]) edges.add(`${u},${v}`);
      faces = faces.filter(f => !seen.includes(f));
      for (const ed of edges) { const [u, v] = ed.split(',').map(Number); if (!edges.has(`${v},${u}`)) faces.push(face(u, v, m)); }
    });
    if (faces.some(f => !f.ok)) return null;
    const used = [...new Set(faces.flatMap(f => [f.i, f.j, f.k]))], at = new Map(used.map((i, n) => [i, n]));
    return { v: used.map(i => pts[i]), f: faces.map(f => [at.get(f.i), at.get(f.j), at.get(f.k)]) };
  }
  // the slot's rounded stand-in: the same kind of body, so a game has one body and one way to draw it
  function roundedSlot(w, h) {
    const out = [], n = 26, ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) { const y = 1 - (i + 0.5) / n * 2, r = Math.sqrt(1 - y * y), a = i * ga; out.push([Math.cos(a) * r * w / 2, y * h / 2, Math.sin(a) * r * w / 2]); }
    return out;
  }
  function world(o) {
    o = o || {};
    const w = new CANNON.World({ gravity: new CANNON.Vec3(0, -(o.g == null ? 9.8 : o.g), 0) });
    w.broadphase = new CANNON.SAPBroadphase(w); w.allowSleep = true;
    const mats = {};
    const mat = (name, friction, bounce) => { const k = `${name}:${friction}:${bounce}`; if (!mats[k]) mats[k] = new CANNON.Material({ friction, restitution: bounce }); return mats[k]; };
    // a contact's friction and bounce are the PRODUCT of the two materials' numbers (cannon's rule). A floor declares how it grips: FLOOR_GRIP brings a pair
    // back to about what the two numbers say (0.6 and 0.5 were 0.3, and a thrown burger slid like it was on ice: the owner, 2026-11-06)
    w.defaultContactMaterial.friction = 0.3; w.defaultContactMaterial.restitution = 0.4; w.defaultContactMaterial.contactEquationRelaxation = 3;
    const bodies = [], boxes = [];
    function sphere(c) {
      const body = new CANNON.Body({ mass: c.mass == null ? 1 : c.mass, shape: new CANNON.Sphere(c.r || 0.2), material: mat('ball', c.friction == null ? 0.4 : c.friction, c.bounce == null ? 0.45 : c.bounce), linearDamping: 0.02, angularDamping: 0.15, allowSleep: false });
      return thrown(body, c, c.r || 0.2);
    }
    function solid(c) {
      const W0 = c.w || 0.4, H0 = c.h || W0, wrap = (c.outline && hull(c.outline)) || hull(roundedSlot(W0, H0));
      const shape = new CANNON.ConvexPolyhedron({ vertices: wrap.v.map(q => new CANNON.Vec3(q[0], q[1], q[2])), faces: wrap.f });
      const body = new CANNON.Body({ mass: c.mass == null ? 1 : c.mass, shape, material: mat('ball', c.friction == null ? 0.4 : c.friction, c.bounce == null ? 0.45 : c.bounce), linearDamping: 0.02, angularDamping: 0.15, allowSleep: false });
      body.angularVelocity.set(c.wx || 0, c.wy || 0, c.wz || 0);
      const p = thrown(body, c, W0 / 2); p.solid = true; p.faces = wrap.f.length; p.outlined = !!(c.outline && hull(c.outline)); stats.solid += 1;
      return p;
    }
    function thrown(body, c, r) {
      body.position.set(c.x || 0, c.y || 0, c.z || 0); body.velocity.set(c.vx || 0, c.vy || 0, c.vz || 0);
      body.userData = { tag: c.tag || 'ball' }; w.addBody(body);
      const p = { x: body.position.x, y: body.position.y, z: body.position.z, vx: c.vx || 0, vy: c.vy || 0, vz: c.vz || 0, px: 0, py: 0, pz: 0, age: 0, live: true, state: 'air', spin: 0, contacts: [], hit: false, r, q: { x: 0, y: 0, z: 0, w: 1 }, body, g: -w.gravity.y,
        at(t) { return { x: p.x + p.vx * t, y: p.y + p.vy * t - 0.5 * p.g * t * t, z: p.z + p.vz * t }; },
        step() { return p.state; },   // the world steps; a game that calls step on the wrapper gets its state
        drop() { p.live = false; w.removeBody(body); const i = bodies.indexOf(p); if (i >= 0) bodies.splice(i, 1); } };
      body.addEventListener('collide', e => { const t = e.body.userData && e.body.userData.tag; if (t && !p.contacts.includes(t)) p.contacts.push(t); });
      bodies.push(p); stats.thrown += 1; return p;
    }
    function floor(c) {
      c = c || {};
      const body = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: mat('floor', (c.friction == null ? 0.5 : c.friction) * FLOOR_GRIP, c.bounce == null ? 0.35 : c.bounce) });
      body.quaternion.setFromEuler(-Math.PI / 2, 0, 0); body.position.set(0, c.y || 0, 0); body.userData = { tag: c.tag || 'floor' }; w.addBody(body); return body;
    }
    function box(c) {
      const body = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, shape: new CANNON.Box(new CANNON.Vec3((c.w || 1) / 2, (c.h || 1) / 2, (c.d || 0.1) / 2)), material: mat('wall', c.friction == null ? 0.3 : c.friction, c.bounce == null ? 0.55 : c.bounce) });
      body.position.set(c.x || 0, (c.y || 0) + (c.h || 1) / 2, c.z || 0); body.userData = { tag: c.tag || 'wall' }; w.addBody(body); boxes.push({ body, w: c.w || 1, h: c.h || 1, d: c.d || 0.1, tag: c.tag || 'wall' });
      return { body, set(x, y, z) { body.position.set(x, y + (c.h || 1) / 2, z); }, drop() { w.removeBody(body); } };
    }
    function ring(c) {
      const n = c.n || 24, r = c.r || 1, tube = c.tube || 0.04;
      const body = new CANNON.Body({ mass: 0, type: CANNON.Body.KINEMATIC, material: mat('rim', c.friction == null ? 0.3 : c.friction, c.bounce == null ? 0.5 : c.bounce) });
      for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; body.addShape(new CANNON.Sphere(tube), new CANNON.Vec3(Math.cos(a) * r, 0, Math.sin(a) * r)); }
      body.position.set(c.x || 0, c.y || 0, c.z || 0); body.userData = { tag: c.tag || 'rim' }; w.addBody(body);
      return { body, set(x, y, z) { body.position.set(x, y, z); }, drop() { w.removeBody(body); } };
    }
    let acc = 0;
    function step(dt) {
      for (const p of bodies) { p.px = p.x; p.py = p.y; p.pz = p.z; p.contacts.length = 0; }
      // a fixed sub-step for stable contacts; the frame's remainder carries over
      acc += Math.min(0.1, dt); const h = 1 / 240; let n = 0;
      while (acc >= h && n < 24) { w.step(h); acc -= h; n++; }
      for (const p of bodies) {
        const b = p.body; p.x = b.position.x; p.y = b.position.y; p.z = b.position.z; p.vx = b.velocity.x; p.vy = b.velocity.y; p.vz = b.velocity.z; p.age += dt;
        p.spin += Math.hypot(b.angularVelocity.x, b.angularVelocity.y, b.angularVelocity.z) * dt;
        p.q.x = b.quaternion.x; p.q.y = b.quaternion.y; p.q.z = b.quaternion.z; p.q.w = b.quaternion.w;
        if (!p.settling && p.contacts.includes('floor')) { p.settling = true; b.angularDamping = SETTLE_ROLL; b.linearDamping = SETTLE_SLIDE; }
        // how far its underside reaches below its middle: a solid's depends on how it has turned
        let under = p.r; if (p.solid) { b.updateAABB(); under = b.position.y - b.aabb.lowerBound.y; }
        const speed = Math.hypot(p.vx, p.vy, p.vz), onFloor = p.y <= under + 0.02;
        if (onFloor && p.contacts.includes('floor') && p.state === 'air') p.state = 'landed';
        else if (p.state === 'landed') p.state = 'air';
        if (onFloor && speed < 0.35) { p.rest = (p.rest || 0) + dt; if (p.rest > 0.25) p.state = 'rest'; } else p.rest = 0;
        for (const x of boxes) {
          const back = x.body.position.z + x.d / 2;
          if (p.touched && p.touched.has(x.tag)) continue;
          if (p.contacts.includes(x.tag)) { (p.touched = p.touched || new Set()).add(x.tag); continue; }
          // over its top, in its own column: a ball that went through the hoop and falls on under the board is no such thing
          if (!p.pastBox && p.pz < back && p.z >= back && p.y >= x.body.position.y + x.h / 2 && Math.abs(p.x - x.body.position.x) <= x.w / 2 + p.r) { p.pastBox = true; stats.past += 1; }
        }
      }
    }
    return { sphere, solid, floor, box, ring, step, get raw() { return w; } };
  }
  return { world, stats, hull };
})();
window.PHYSICS = PHYSICS;
