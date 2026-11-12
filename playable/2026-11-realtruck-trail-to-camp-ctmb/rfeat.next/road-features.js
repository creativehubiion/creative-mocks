/* road-features.js : the signed road features of Trail to Camp, drawn and drivable (realtruck-01 / 06-features).
   Owner rule: nothing on the road is silent and nothing is lost without a cause the player can see and feel. Each feature the rules lay
   (choice-logic.js HZ: corrugations, potholes, cattle grid, creek dip, crest, rock fall, fallen branch, washed-out edge) becomes its own
   piece of road built from the kit's road surface at that spot (crown, cross slope, curve, gradient), shaped like what it is, with the
   same height under the wheels (heightAt) and a rattle (roughAt). A yellow diamond sign on the verge 40 m before each one.
   API: patchTerrain(THREE, roadMaterial) once -> holes; createRoadFeatures({ THREE, kit, trail, features, U, holes, sOffset, ground,
   gates, avoid }) -> { group, heightAt(s, u), roughAt(s, u), featureAt(s, u), list, update(s), dispose(), stats }.
   The kit road is not drawn inside each feature's footprint (patchTerrain discards it there, by box or mask in track space) and the
   feature draws the real surface instead. Three draw calls: surfaces and models, signs (polygonOffset), water. See INTEGRATION.md. */

export const TYPES = ['corrug', 'pothole', 'grid', 'creek', 'crest', 'rocks', 'log', 'washout'];
export const NAMES = { corrug: 'Corrugations', pothole: 'Potholes', grid: 'Cattle grid', creek: 'Creek dip', crest: 'Crest', rocks: 'Rock fall', log: 'Fallen branch', washout: 'Washed-out edge' };
/* the kit road's own columns (style-kit COLUMNS inside the gutter): the surface pieces share them, so tyre lines and crown match */
const KN = [-4.5, -3.8, -2.85, -2.35, -0.98, -0.62, 0, 0.62, 0.98, 2.35, 2.85, 3.8, 4.5];
/* a tyre's outer edge from the ute centre (wheel track 0.84 + half tyre 0.13): the rules judge the ute centre against the free lane,
   so the feature is drawn where a tyre of a ute outside the free lane goes, and a ute inside it keeps all four tyres on plain road */
const WH = 0.97, RX = 4.5, RE = 3.8, LIFT = 0, SINK = -0.01;
const DEFAULT_AVOID = [
  { s0: -18, s1: 37, side: 1 }, { s0: 355, s1: 410, side: 1 }, { s0: 724, s1: 779, side: 1 },
  { s0: 104, s1: 128, side: -1 }, { s0: 254, s1: 270, side: 0 }, { s0: 905, s1: 1e9, side: 0 }
];

/* visible extents: the complement of the free lanes widened by a tyre edge; smooth = the widened free lanes */
export function lanesOf(h) {
  const full = !!h.full || !h.free || !h.free.length;
  if (full) return { ext: [[-RX, RX]], smooth: [] };
  const cov = h.free.map(([a, b]) => [Math.max(-RX, a - WH), Math.min(RX, b + WH)]).sort((p, q) => p[0] - q[0]);
  const m = []; for (const c of cov) { if (m.length && c[0] <= m[m.length - 1][1]) m[m.length - 1][1] = Math.max(m[m.length - 1][1], c[1]); else m.push(c.slice()); }
  const ext = []; let x = -RX;
  for (const [a, b] of m) { if (a > x) ext.push([x, a]); x = Math.max(x, b); }
  if (x < RX) ext.push([x, RX]);
  return { ext: ext.filter(([a, b]) => b - a > 0.25 && !(a >= 3.6 || b <= -3.6)), smooth: m };
}

/* ---------------------------------------------------------------- growable vertex buffer with flat normals */
class Buf {
  constructor(n) { this.cap = n; this.nv = 0; this.P = new Float32Array(n * 3); this.N = new Float32Array(n * 3); this.Cl = new Float32Array(n * 3); this.F = new Float32Array(n * 4); this.T = new Float32Array(n * 2); }
  room(k) {
    if (this.nv + k <= this.cap) return; let n = this.cap; while (n < this.nv + k) n *= 2;
    const g = (a, w) => { const b = new Float32Array(n * w); b.set(a.subarray(0, this.nv * w)); return b; };
    this.P = g(this.P, 3); this.N = g(this.N, 3); this.Cl = g(this.Cl, 3); this.F = g(this.F, 4); this.T = g(this.T, 2); this.cap = n;
  }
  /* a, b, c = [x, y, z, s, u]; mode 1 = normal up, 2 = normal away from ref, 0 = as wound */
  tri(a, b, c, col, fx, mode, ref) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz);
    if (l < 1e-12) { nx = 0; ny = 1; nz = 0; } else { nx /= l; ny /= l; nz /= l; }
    let flip = false;
    if (mode === 1) flip = ny < 0;
    else if (mode === 2) { const mx = (a[0] + b[0] + c[0]) / 3 - ref[0], my = (a[1] + b[1] + c[1]) / 3 - ref[1], mz = (a[2] + b[2] + c[2]) / 3 - ref[2]; flip = nx * mx + ny * my + nz * mz < 0; }
    if (flip) { const t = b; b = c; c = t; nx = -nx; ny = -ny; nz = -nz; }
    this.room(3); this.put(a, nx, ny, nz, col, fx); this.put(b, nx, ny, nz, col, fx); this.put(c, nx, ny, nz, col, fx);
  }
  put(v, nx, ny, nz, col, fx) {
    const i = this.nv++, i3 = i * 3, i4 = i * 4, i2 = i * 2;
    this.P[i3] = v[0]; this.P[i3 + 1] = v[1]; this.P[i3 + 2] = v[2]; this.N[i3] = nx; this.N[i3 + 1] = ny; this.N[i3 + 2] = nz;
    this.Cl[i3] = col[0]; this.Cl[i3 + 1] = col[1]; this.Cl[i3 + 2] = col[2];
    this.F[i4] = fx[0]; this.F[i4 + 1] = fx[1]; this.F[i4 + 2] = fx[2]; this.F[i4 + 3] = fx[3]; this.T[i2] = v[3]; this.T[i2 + 1] = v[4];
  }
  quad(a, b, c, d, col, fx, mode, ref) { this.tri(a, b, c, col, fx, mode, ref); this.tri(a, c, d, col, fx, mode, ref); }
}

/* ---------------------------------------------------------------- pictograms: the HUD's drawPicto (hud2.js) as flat polygons, in its
   100-unit frame (diamond radius 46, canvas y down); strokes 5 units wide with round joints */
function pictoPolys(type) {
  const out = [], W = 5;
  const seg = (x0, y0, x1, y1, w = W) => { const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l * w / 2, ny = dx / l * w / 2; out.push([[x0 + nx, y0 + ny], [x1 + nx, y1 + ny], [x1 - nx, y1 - ny], [x0 - nx, y0 - ny]]); };
  const dot = (x, y, r, n = 10) => { const p = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; p.push([x + Math.cos(a) * r, y + Math.sin(a) * r]); } out.push(p); };
  const ell = (x, y, rx, ry, rot = 0, n = 14) => { const p = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, ex = Math.cos(a) * rx, ey = Math.sin(a) * ry; p.push([x + ex * Math.cos(rot) - ey * Math.sin(rot), y + ex * Math.sin(rot) + ey * Math.cos(rot)]); } out.push(p); };
  const line = (pts, w = W, joints = true) => { for (let i = 0; i < pts.length - 1; i++) seg(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], w); if (joints) for (let i = 1; i < pts.length - 1; i++) dot(pts[i][0], pts[i][1], w / 2, 8); for (const i of [0, pts.length - 1]) dot(pts[i][0], pts[i][1], w / 2, 8); };
  const wave = (y, a, f, x0 = -22, x1 = 22) => { const p = []; for (let x = x0; x <= x1; x += 2) p.push([x, y + a * Math.sin(x * f)]); line(p, W, false); };
  if (type === 'rocks') { out.push([[-24, 22], [-24, -16], [8, 22]]); dot(10, -10, 6); dot(18, 3, 5); dot(23, 15, 4); }
  else if (type === 'corrug') { for (const y of [-12, 0, 12]) wave(y, 4, 0.45); }
  else if (type === 'grid') { line([[-24, 10], [-12, -2], [12, -2], [24, 10]]); for (let x = -10; x <= 10; x += 5) line([[x, -2], [x, 10]]); line([[-26, 16], [26, 16]]); }
  else if (type === 'creek') { for (const y of [-6, 6, 18]) wave(y, 3.5, 0.3); out.push([[-12, -12], [12, -12], [8, -20], [-8, -20]]); }
  else if (type === 'pothole') { ell(-10, 4, 10, 5); ell(12, 12, 8, 4); line([[-26, -8], [26, -8]]); }
  else if (type === 'crest') { const p = []; for (let i = 0; i <= 16; i++) { const t = i / 16, x = (1 - t) * (1 - t) * -28 + t * t * 28, y = (1 - t) * (1 - t) * 18 + 2 * t * (1 - t) * -14 + t * t * 18; p.push([x, y]); } out.push(p); line([[0, -10], [0, -26]]); line([[-6, -20], [0, -26], [6, -20]]); }
  else if (type === 'log') { const c = Math.cos(-0.25), s = Math.sin(-0.25), r = (x, y) => [x * c - y * s, x * s + y * c]; out.push([r(-26, -5), r(26, -5), r(26, 5), r(-26, 5)]); line([[-8, -6], [-14, -18]]); line([[10, 2], [18, -12]]); line([[-26, 16], [26, 16]]); }
  else if (type === 'washout') { line([[-26, 16], [-26, -16], [26, -16]]); out.push({ concave: [[10, 16], [26, 16], [26, -16], [2, -16], [8, -4], [0, 4]] }); }
  return out;
}
/* ear clipping for a simple polygon (the washout's bite) */
function earClip(pts) {
  const idx = pts.map((_, i) => i), tris = []; let area = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
  const ccw = area > 0, cr = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  let guard = 0;
  while (idx.length > 3 && guard++ < 200) {
    for (let k = 0; k < idx.length; k++) {
      const i0 = idx[(k + idx.length - 1) % idx.length], i1 = idx[k], i2 = idx[(k + 1) % idx.length], A = pts[i0], B = pts[i1], Cc = pts[i2];
      const c = cr(A, B, Cc); if (ccw ? c <= 0 : c >= 0) continue;
      let inside = false; for (const j of idx) { if (j === i0 || j === i1 || j === i2) continue; const P = pts[j], d1 = cr(A, B, P), d2 = cr(B, Cc, P), d3 = cr(Cc, A, P); if (ccw ? (d1 > 0 && d2 > 0 && d3 > 0) : (d1 < 0 && d2 < 0 && d3 < 0)) { inside = true; break; } }
      if (inside) continue; tris.push([A, B, Cc]); idx.splice(k, 1); break;
    }
  }
  if (idx.length === 3) tris.push(idx.map(i => pts[i]));
  return tris;
}

/* ================================================================ the terrain patch: call once on the material the kit road is drawn
   with (the game's world material). Inside the active cuts (up to n, set by update(s)) its fragments are discarded, so each feature's
   own surface replaces the road there. Returns the holes state to pass to every createRoadFeatures call. */
export function patchTerrain(THREE, mat, n = 12) {
  const blank = new THREE.DataTexture(new Uint8Array(4), 2, 2, THREE.RedFormat, THREE.UnsignedByteType); blank.needsUpdate = true;
  const uniforms = { uHoleB: { value: Array.from({ length: n }, () => new THREE.Vector4(1, 0, 0, 0)) }, uHoleT: { value: Array.from({ length: n }, () => new THREE.Vector4()) }, uHoleTex: { value: blank } };
  const prev = mat.onBeforeCompile, prevKey = mat.customProgramCacheKey ? mat.customProgramCacheKey() : '';
  mat.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r); Object.assign(sh.uniforms, uniforms);
    sh.fragmentShader = sh.fragmentShader.replace('void main() {', `uniform vec4 uHoleB[${n}]; uniform vec4 uHoleT[${n}]; uniform sampler2D uHoleTex;
void main() {
  for (int i = 0; i < ${n}; i++) { vec4 hb = uHoleB[i]; if (vTrk.x > hb.x && vTrk.x < hb.y && vTrk.y > hb.z && vTrk.y < hb.w) { vec4 ht = uHoleT[i]; if (ht.z < 0.0) discard; vec2 hq = (vTrk - hb.xz) / (hb.yw - hb.xz); if (texture2D(uHoleTex, ht.xy + hq * ht.zw).r > 0.5) discard; } }`);
  };
  mat.customProgramCacheKey = () => prevKey + '-holes'; mat.needsUpdate = true;
  return { uniforms, blank, n };
}

/* ================================================================ the builder */
export function createRoadFeatures(o) {
  const THREE = o.THREE, K = o.kit, T = o.trail, sOff = o.sOffset || 0;
  const ground = o.ground || ((s, u) => K.groundHeight(T, s, u));
  const C = K.C, sm = K.smooth, shade = K.shade, mix = K.mix3, hash2 = K.hash2;
  const avoid = (o.avoid || DEFAULT_AVOID).concat((o.gates || []).map(g => ({ s0: g - 12, s1: g + 8, side: 0 })));
  const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
  /* palette (linear) */
  const STEEL_D = shade(mix(C.steel, C.rockRed, 0.45), 0.62), STEEL_T = mix(C.steel, C.white, 0.2), PIT = mix(C.black, C.earthDeep, 0.25);
  const SOIL = shade(C.earthDeep, 0.5), SOIL2 = shade(C.earthDeep, 0.72), FLOOR = shade(mix(mix(C.road, C.earthDeep, 0.55), C.shadow, 0.1), 0.74), WALL = shade(mix(C.road, C.earthDeep, 0.45), 0.86), CONTACT = shade(C.earthDeep, 0.55), CONC = mix(C.white, C.rockGrey, 0.45), PLATE = shade(C.steel, 0.74);
  const WET = shade(mix(C.sand, C.earthDeep, 0.5), 0.66), WET2 = shade(mix(C.sand, C.earthDeep, 0.55), 0.5), DRYB = mix(C.sand, C.road, 0.55), FORD = shade(mix(C.road, C.sand, 0.35), 1.03);
  const WATER = mix(shade(C.blue, 0.8), C.shadow, 0.3), PAINT = shade(C.white, 0.9), SIGN_Y = K.lin('#E9B52C');
  const FX0 = [1, 0, 0, 0], FXR = [1, 0, 0.6, 0], FXW = [1, 0, 1.2, 0];
  const roadCol = (s, u, n) => K.defaultGroundColour(s, u, n || [0, 1, 0]);
  const vary = (c, s, u, k = 0.04) => shade(c, 1 + (hash2(s * 3.1, u * 2.7) - 0.5) * 2 * k);

  /* the kit road under a point: linear between the kit's columns, as its faces are */
  function base(s, u) {
    if (u <= -RX || u >= RX) return ground(s, u);
    let i = 0; while (KN[i + 1] < u) i++;
    const a = KN[i], b = KN[i + 1], t = (u - a) / (b - a);
    return ground(s, a) * (1 - t) + ground(s, b) * t;
  }
  const WO = { x: 0, z: 0, th: 0, y: 0 };
  const V = (s, u, y) => { T.world(s, u, WO); return [WO.x, y, WO.z, s, u]; };
  const thAt = s => { T.at(s, WO); return WO.th; };

  const main = new Buf(1 << 16), inter = main, deco = new Buf(1 << 14), water = new Buf(1 << 10);
  const FE = [];

  /* ---------------- generic heightfield piece: rows sAt(i, u), columns us; y = base + h + lift(i, j); colour by face centroid */
  function field(buf, nRows, sAt, us, h, col, opt = {}) {
    const nc = us.length, G = new Array(nRows * nc), lift = opt.lift === undefined ? LIFT : opt.lift, sink = opt.sink === undefined ? SINK : opt.sink;
    for (let i = 0; i < nRows; i++) for (let j = 0; j < nc; j++) {
      const tr = opt.tuckRows === undefined ? true : opt.tuckRows, u = us[j], s = sAt(i, u);
      const edge = (tr === true && (i === 0 || i === nRows - 1)) || (tr === 'first' && i === 0) || (tr === 'last' && i === nRows - 1) || (opt.tuck0 && j === 0) || (opt.tuck1 && j === nc - 1);
      G[i * nc + j] = V(s, u, base(s, u) + h(s, u, i, j) + (edge ? sink : lift));
    }
    for (let i = 0; i < nRows - 1; i++) for (let j = 0; j < nc - 1; j++) {
      const a = G[i * nc + j], b = G[(i + 1) * nc + j], c = G[(i + 1) * nc + j + 1], d = G[i * nc + j + 1];
      if (opt.skip && opt.skip((a[3] + c[3]) / 2, (a[4] + c[4]) / 2)) continue;
      const diag = (i + j) & 1;
      const t1 = diag ? [a, b, c] : [a, b, d], t2 = diag ? [a, c, d] : [b, c, d];
      for (const t of [t1, t2]) {
        const cs = (t[0][3] + t[1][3] + t[2][3]) / 3, cu = (t[0][4] + t[1][4] + t[2][4]) / 3;
        buf.tri(t[0], t[1], t[2], col(cs, cu, i, j), opt.fx || FX0, 1);
      }
    }
    return G;
  }
  const colsIn = (lo, hi, extra = []) => { const c = KN.filter(u => u > lo + 0.04 && u < hi - 0.04).concat([lo, hi], extra.filter(u => u > lo + 0.04 && u < hi - 0.04)).sort((a, b) => a - b); const out = []; for (const u of c) if (!out.length || u - out[out.length - 1] > 0.05) out.push(u); return out; };

  /* ---------------- kit parts (Facets in local space) added through a transform at track (s, u) */
  const BOUNDS = new WeakMap();
  function bounds(part) {
    let b = BOUNDS.get(part); if (b) return b;
    let y0 = 1e9, y1 = -1e9, r = 0; for (let i = 0; i < part.P.length; i += 3) { y0 = Math.min(y0, part.P[i + 1]); y1 = Math.max(y1, part.P[i + 1]); r = Math.max(r, Math.hypot(part.P[i], part.P[i + 2])); }
    b = { y0, y1, r }; BOUNDS.set(part, b); return b;
  }
  function addPart(buf, part, s, u, y, yawX = 0, k = 1, fxOver = null) {
    T.world(s, u, WO); const th = WO.th, x0 = WO.x, z0 = WO.z, yaw = th + yawX, cy = Math.cos(yaw), sy = Math.sin(yaw), ks = Array.isArray(k) ? k : [k, k, k];
    const P = part.P, n = P.length / 3, ct = Math.cos(th), st = Math.sin(th);
    const v = new Array(3);
    for (let t = 0; t < n; t += 3) {
      for (let q = 0; q < 3; q++) {
        const i = (t + q) * 3, px = P[i] * ks[0], py = P[i + 1] * ks[1], pz = P[i + 2] * ks[2];
        const wx = px * cy + pz * sy, wz = -px * sy + pz * cy;
        v[q] = [x0 + wx, y + py, z0 + wz, s + wx * st + wz * ct, u - wx * ct + wz * st];
      }
      const ci = t * 3, fi = t * 4;
      buf.tri(v[0], v[1], v[2], [part.Cl[ci], part.Cl[ci + 1], part.Cl[ci + 2]], fxOver || [part.F[fi], part.F[fi + 1], part.F[fi + 2], part.F[fi + 3]], 0);
    }
  }
  const ROCKS = {}, rockPart = (seed, variant, tint) => { const key = seed + ':' + variant + ':' + tint; return ROCKS[key] || (ROCKS[key] = K.rock(seed, variant, tint)); };
  const PEB = []; for (let i = 0; i < 6; i++) PEB.push(K.pebble(11 + i * 7));
  /* a rock sitting on the surface: top hr above it, base 3 cm in */
  function putRock(buf, part, s, u, hr, yawX, surf, list) {
    const b = bounds(part), k = (hr + 0.03) / (b.y1 - b.y0), y = surf - 0.03 - b.y0 * k;
    addPart(buf, part, s, u, y, yawX, k);
    if (list) list.push({ s, u, r: b.r * k * 0.82, h: hr });
  }
  /* bevelled-free block between corners, in track space: a box (s +- hs, u +- hu, y0..y1) */
  function box(buf, s, u, y0, y1, hs, hu, cTop, cSide, fx = FX0) {
    const c = [V(s - hs, u - hu, y0), V(s + hs, u - hu, y0), V(s + hs, u + hu, y0), V(s - hs, u + hu, y0), V(s - hs, u - hu, y1), V(s + hs, u - hu, y1), V(s + hs, u + hu, y1), V(s - hs, u + hu, y1)];
    const ref = V(s, u, (y0 + y1) / 2);
    buf.quad(c[4], c[5], c[6], c[7], cTop, fx, 2, ref);
    for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0]]) buf.quad(c[a], c[b], c[b + 4], c[a + 4], cSide, fx, 2, ref);
  }
  /* a square-section beam between two track-space points */
  function beam(buf, p, q, w, col) {
    const hs = w / 2; const c = [V(p[0] - hs, p[1], p[2] - hs), V(p[0] + hs, p[1], p[2] - hs), V(p[0] + hs, p[1], p[2] + hs), V(p[0] - hs, p[1], p[2] + hs), V(q[0] - hs, q[1], q[2] - hs), V(q[0] + hs, q[1], q[2] - hs), V(q[0] + hs, q[1], q[2] + hs), V(q[0] - hs, q[1], q[2] + hs)];
    const ref = V((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2);
    for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 0]]) buf.quad(c[a], c[b], c[b + 4], c[a + 4], b === 2 || a === 2 ? col : shade(col, 0.8), FX0, 2, ref);
    buf.quad(c[0], c[1], c[2], c[3], col, FX0, 2, ref); buf.quad(c[4], c[5], c[6], c[7], col, FX0, 2, ref);
  }

  /* ---------------- signs: kit-style yellow diamond on one sunk steel post, board on the front, pictogram 4 cm proud (local, +z faces
     the driver); cached per type */
  const SIGNP = {}, SR = 0.6, SCY = 2.1, ST = 0.04;
  function signPart(type) {
    if (SIGNP[type]) return SIGNP[type];
    const f = new K.Facets(), fx = FX0, R = SR, cy = SCY;
    K.bevelBox(f, [0, (cy + 0.1 - 0.45) / 2, -0.07], 0.09, cy + 0.1 + 0.45, 0.09, 0.015, () => C.steel, fx);
    const dia = r => [[0, r], [r, 0], [0, -r], [-r, 0]], P = dia(R);
    const flat = (pts, z, col, sc = 1, face = 1) => { let cx = 0, cyy = 0; for (const p of pts) { cx += p[0]; cyy += p[1]; } cx /= pts.length; cyy /= pts.length; const Q = pts.map(p => [p[0] * sc, cy + p[1] * sc, z]); for (let i = 0; i < Q.length; i++) f.tri([cx * sc, cy + cyy * sc, z], Q[i], Q[(i + 1) % Q.length], col, fx, [cx * sc, cy + cyy * sc, z - face]); };
    for (let i = 0; i < 4; i++) { const a = P[i], b = P[(i + 1) % 4]; f.quad([a[0], cy + a[1], ST / 2], [b[0], cy + b[1], ST / 2], [b[0], cy + b[1], -ST / 2], [a[0], cy + a[1], -ST / 2], shade(SIGN_Y, 0.8), fx, [0, cy, 0]); }
    flat(P, -ST / 2, C.steel, 1, -1); flat(P, ST / 2, C.black); flat(dia(R * 0.878), ST / 2 + 0.02, SIGN_Y);
    const k = R / 49, z = ST / 2 + 0.04;
    for (const poly of pictoPolys(type)) {
      if (poly.concave) { for (const [a, b, c] of earClip(poly.concave)) f.tri([a[0] * k, cy - a[1] * k, z], [b[0] * k, cy - b[1] * k, z], [c[0] * k, cy - c[1] * k, z], C.black, fx, [0, cy, z - 1]); continue; }
      flat(poly.map(([x, y]) => [x, -y]), z, C.black, k);
    }
    return (SIGNP[type] = f);
  }

  /* ---------------- per-type preparation (heights) and drawing */
  const smoothEdge = (a, b, u, w) => (a > -RE ? sm(a, a + w, u) : 1) * (b < RE ? 1 - sm(b - w, b, u) : 1);
  function latOf(ext, u, w) { let m = 0; for (const [a, b] of ext) if (u >= a && u <= b) m = Math.max(m, smoothEdge(a, b, u, w)); return m; }

  /* CORRUGATIONS: transverse ridges, 6-8 cm, 35-45 cm apart; trough at road level (+2 cm), lit tops, darker troughs */
  const KNOT = [0.15, 0.42, 0.58, 0.85];
  function prepCorrug(fe, R) {
    const sA = fe.s0 - 0.8; let q = sA; const rid = [];
    while (q < fe.s1 + 0.8) { rid.push({ q, p: 0.35 + R() * 0.1, A: 0.06 + R() * 0.02, sk: (R() - 0.5) * 0.035 }); q += rid[rid.length - 1].p; }
    fe.rid = rid; fe.sA = sA; fe.sB = q;
    fe.env = s => sm(fe.sA, fe.sA + 1.2, s) * (1 - sm(fe.sB - 1.2, fe.sB, s));
    fe.lat = u => { let m = 0; for (const [a, b] of fe.ext) if (u >= a + (a > -RE ? 0.1 : 0) && u <= b - (b < RE ? 0.1 : 0)) m = Math.max(m, (a > -RE ? sm(a + 0.1, a + 0.4, u) : 1) * (b < RE ? 1 - sm(b - 0.4, b - 0.1, u) : 1)); return m * (1 - sm(4.0, 4.4, Math.abs(u))); };
    fe.wr = []; for (const [a, b] of fe.ext) { if (a > -3.6) fe.wr.push(a - 0.2); if (b < 3.6) fe.wr.push(b + 0.2); }
    fe.windrow = (s, u) => { let h = 0; for (const c of fe.wr) { const d = Math.abs(u - c); if (d < 0.22) h = Math.max(h, 0.045 * (1 + Math.cos(Math.PI * d / 0.22)) / 2 * (0.85 + 0.15 * Math.sin(s * 2.1 + c))); } return h * fe.env(s); };
    fe.H = (s, u) => {
      if (s < fe.sA || s >= fe.sB) return 0; const L = fe.lat(u); if (L <= 0) return 0;
      let lo = 0, hi = rid.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (rid[m].q <= s) lo = m; else hi = m - 1; }
      let best = 0;
      for (let k = Math.max(0, lo - 1); k <= Math.min(rid.length - 1, lo + 1); k++) {
        const r = rid[k], x = (s - r.sk * u - r.q) / r.p; if (x < 0 || x >= 1) continue;
        const pr = x < KNOT[0] ? 0 : x < KNOT[1] ? (x - KNOT[0]) / (KNOT[1] - KNOT[0]) : x < KNOT[2] ? 1 : x < KNOT[3] ? (KNOT[3] - x) / (KNOT[3] - KNOT[2]) : 0;
        best = Math.max(best, r.A * (0.85 + 0.15 * Math.sin(u * 1.9 + k * 2.17)) * pr);
      }
      return best * fe.env(s) * L;
    };
    const ridges = fe.H; fe.H = (s, u) => (s < fe.sA || s >= fe.sB ? 0 : Math.max(ridges(s, u), fe.windrow(s, u)));
    fe.Rf = (s, u) => (s < fe.sA || s >= fe.sB) ? 0 : Math.min(1, 1.4 * fe.env(s) * fe.lat(u));
  }
  function drawCorrug(fe) {
    let lo = 9, hi = -9; for (const [a, b] of fe.ext) { lo = Math.min(lo, a); hi = Math.max(hi, b); }
    const uLo = lo <= -RX + 0.01 ? -RX : Math.max(-RX, lo - 0.5), uHi = hi >= RX - 0.01 ? RX : Math.min(RX, hi + 0.5), ex = [-4.4, -4.0, 4.0, 4.4];
    for (const [a, b] of fe.ext) ex.push(a, a + 0.3, b - 0.3, b);
    for (const c of fe.wr) ex.push(c - 0.2, c, c + 0.2);
    const us = colsIn(uLo, uHi, ex), tuck0 = uLo > -RX, tuck1 = uHi < RX;
    if (tuck0) us.unshift(uLo - 0.2); if (tuck1) us.push(uHi + 0.2);
    /* rows: tuck (under the kit road), cut edge, the four knots of every ridge, cut edge, tuck */
    const rows = [[fe.sA - 0.6, 0, -1], [fe.sA - 0.4, 0, -2]]; fe.rid.forEach((r, k) => { for (let q = 0; q < 4; q++) rows.push([r.q + r.p * KNOT[q], r.sk, q]); });
    rows.push([fe.sB + 0.05, 0, 3], [fe.sB + 0.4, 0, -2], [fe.sB + 0.6, 0, -1]);
    fe.cut = { s0: fe.sA - 0.4, s1: fe.sB + 0.4, u0: uLo, u1: uHi, solid: true };
    const cls = i => rows[i][2], plainCol = (s, u) => (fe.env(s) > 0.05 ? shade(roadCol(s, u), 0.96) : roadCol(s, u));
    const colA = (s, u, i) => {
      const w = fe.env(s) * fe.lat(u), b = roadCol(s, u), c = cls(i), wr = fe.windrow(s, u);
      if (wr > 0.008) return vary(mix(b, C.roadLine, 0.3), s * 3, u, 0.07);
      if (w <= 0.001) return c >= 0 ? plainCol(s, u) : b;
      if (c === 0) return shade(b, 1 + 0.08 * w);
      if (c === 1) return mix(b, C.roadLine, 0.72 * w);
      if (c === 2) return shade(b, 1 - 0.2 * w);
      return shade(mix(b, C.earthDeep, 0.4 * w), 1 - 0.22 * w);
    };
    /* the ridges need a row at every knot; the graded side does not: when there is one inner edge, the graded side is its own piece with
       rows every 0.9 m, overlapping the ridged piece by 10 cm where both lie exactly on the road */
    const e = fe.ext.length === 1 ? (fe.ext[0][0] > -3.6 ? fe.ext[0][0] : fe.ext[0][1] < 3.6 ? fe.ext[0][1] : null) : null;
    if (e === null) { field(main, rows.length, (i, u) => rows[i][0] + rows[i][1] * u, us, (s, u, i) => (rows[i][2] < 0 ? 0 : fe.H(s, u)), colA, { tuck0, tuck1 }); return; }
    const right = e === fe.ext[0][1], ea = right ? e - 0.1 : e + 0.1, usA = us.filter(u => (right ? u < ea - 0.02 : u > ea + 0.02)).concat([ea]).sort((x, y) => x - y);
    const usB = us.filter(u => (right ? u > ea + 0.02 : u < ea - 0.02)).concat([ea]).sort((x, y) => x - y);
    field(main, rows.length, (i, u) => rows[i][0] + rows[i][1] * u, usA, (s, u, i) => (rows[i][2] < 0 ? 0 : fe.H(s, u)), colA, { tuck0: right ? tuck0 : false, tuck1: right ? false : tuck1 });
    const rb = [fe.sA - 0.6, fe.sA - 0.4]; for (let s = fe.sA; s < fe.sB - 0.3; s += 0.9) rb.push(s); rb.push(fe.sB, fe.sB + 0.4, fe.sB + 0.6);
    field(main, rb.length, i => rb[i], usB, (s, u, i) => (i === 0 || i === rb.length - 1 ? 0 : fe.windrow(s, u)), (s, u) => (fe.windrow(s, u) > 0.008 ? vary(mix(roadCol(s, u), C.roadLine, 0.3), s * 3, u, 0.07) : plainCol(s, u)), { tuck0: right ? false : tuck0, tuck1: right ? tuck1 : false });
  }

  /* CREST: the rules' own hump (0.55 m, rising over 4 m, falling over 3 m), full width, same road */
  function prepCrest(fe) {
    const c = fe.s0 + 1; fe.c = c; fe.sA = c - 4; fe.sB = c + 3;
    fe.H = (s, u) => { const d = s - c; if (d <= -4 || d >= 3) return 0; return 0.55 * (1 + Math.cos(Math.PI * d / (d < 0 ? 4 : 3))) / 2 * (1 - sm(3.6, 4.5, Math.abs(u))); };
    fe.Rf = () => 0;
  }
  function drawCrest(fe) {
    const rows = [fe.sA - 0.6, fe.sA - 0.4]; for (let s = fe.sA; s < fe.sB + 0.01; s += 0.35) rows.push(Math.min(s, fe.sB)); rows.push(fe.sB + 0.4, fe.sB + 0.6);
    fe.cut = { s0: fe.sA - 0.4, s1: fe.sB + 0.4, u0: -RX, u1: RX, solid: true };
    field(main, rows.length, i => rows[i], colsIn(-RX, RX, [-4.1, -3.6, 3.6, 4.1]), (s, u, i) => (i === 0 || i === rows.length - 1 ? 0 : fe.H(s, u)), (s, u) => roadCol(s, u));
  }

  /* CATTLE GRID: the rules' 0.15 m hump carrying a sunk steel grid across the full width: 10 weathered rails over a near-black pit, low
     earth-stained kerbs, a timber fence line from each kerb. The smooth band is the grid silted up with road earth to just under the rail
     tops (faint rails, nearly flush), its edge thinning out irregularly into open gaps */
  const FL = 1.35, GR = 1.4, GH = 0.15, NR = 9, RW = 0.1, RT = 0.075, PITD = 0.28;
  function prepGrid(fe) {
    const sg = fe.s0 + 0.6; fe.sg = sg; fe.sA = sg - FL - GR; fe.sB = sg + FL + GR;
    const band = fe.smooth.map(([a, b]) => [Math.max(-4.1, a), Math.min(4.1, b)]).filter(([a, b]) => b - a > 0.3);
    fe.band = band; fe.ph = sg * 1.7;
    /* silt fill 0..1 at u in gap k: full inside the band, thinning over 0.45 m past its edge (edge offset per gap) */
    fe.silt = (u, k) => {
      let w = 0;
      for (const [a, b] of band) {
        const ja = a - 0.12 * Math.sin(k * 2.3 + fe.ph) - 0.1, jb = b + 0.12 * Math.sin(k * 1.7 + fe.ph + 1) + 0.1;
        w = Math.max(w, (a > -4.05 ? sm(ja - 0.45, ja, u) : 1) * (b < 4.05 ? 1 - sm(jb, jb + 0.45, u) : 1));
      }
      return w;
    };
    fe.inBand = u => { let m = 0; for (const [a, b] of band) m = Math.max(m, (a > -4.05 ? sm(a - 0.1, a + 0.1, u) : 1) * (b < 4.05 ? 1 - sm(b - 0.1, b + 0.1, u) : 1)); return m; };
    fe.H = (s, u) => {
      const d = s - sg, ad = Math.abs(d), au = Math.abs(u), lat = 1 - sm(4.1, 4.5, au);
      if (ad >= FL) return ad < FL + GR ? GH * (1 + Math.cos(Math.PI * (ad - FL) / GR)) / 2 * lat : 0;
      if (au > 4.1) return GH * lat;
      return GH + sm(FL, FL - 0.15, ad) * RT;
    };
    fe.Rf = (s, u) => { const ad = Math.abs(s - sg); return ad < FL - 0.05 && Math.abs(u) < 4.1 ? 1 - fe.inBand(u) : 0; };
  }
  function drawGrid(fe) {
    const sg = fe.sg, us = colsIn(-RX, RX, [-4.1, 4.1]), lat = u => 1 - sm(4.1, 4.5, Math.abs(u));
    const hump = (s, u) => { const ad = Math.abs(s - sg); return ad >= FL ? (ad < FL + GR ? GH * (1 + Math.cos(Math.PI * (ad - FL) / GR)) / 2 * lat(u) : 0) : GH * lat(u); };
    for (const dir of [-1, 1]) {
      const rows = [sg + dir * (FL + GR + 0.6), sg + dir * (FL + GR + 0.4)]; for (let a = FL + GR; a > FL + 0.01; a -= 0.2) rows.push(sg + dir * a); rows.push(sg + dir * FL);
      if (dir > 0) rows.reverse();
      field(main, rows.length, i => rows[i], us, (s, u) => hump(s, u), (s, u) => roadCol(s, u), { tuckRows: dir < 0 ? 'first' : 'last' });
    }
    fe.cut = { s0: sg - FL - GR - 0.4, s1: sg + FL + GR + 0.4, u0: -RX, u1: RX, solid: true };
    /* the gutter beside the kerbs carries the hump down to the kit's gutter */
    for (const side of [-1, 1]) field(main, 2, i => sg - FL + i * 2 * FL, side < 0 ? [-4.5, -4.42, -4.1] : [4.1, 4.42, 4.5], (s, u) => GH * lat(u), () => shade(C.earthDeep, 1.05), { tuckRows: false });
    const top = (s, u) => base(s, u) + GH;
    const STW = shade(mix(C.rockGrey, C.bark, 0.4), 0.9), STL = mix(STW, C.steel, 0.72), STD = shade(STW, 0.72), PITC = shade(mix(C.black, C.earthDeep, 0.22), 0.7);
    const sI0 = sg - FL + 0.12, sI1 = sg + FL - 0.12, pitch = (sI1 - sI0) / NR, rail = k => [sI0 + (k + 0.5) * pitch - RW / 2, sI0 + (k + 0.5) * pitch + RW / 2];
    /* the pit floor and the silt as one surface: rows at every rail edge and mid-gap, columns dense where the silt thins out */
    const ex = []; for (const [a, b] of fe.band) for (let x = -0.7; x <= 0.71; x += 0.1) ex.push(a + x, b + x);
    const cu = colsIn(-4.1, 4.1, ex), rows = [sI0];
    for (let k = 0; k < NR; k++) { const [r0, r1] = rail(k); rows.push(r0 - 0.002, (r0 + r1) / 2, r1 + 0.002); }
    rows.push(sI1);
    const gapOf = s => Math.max(0, Math.min(NR, Math.round((s - sI0) / pitch)));
    const fillH = (s, u) => -PITD + (RT - 0.017 + PITD) * fe.silt(u, gapOf(s));
    field(main, rows.length, i => rows[i], cu, (s, u) => GH + fillH(s, u), (s, u) => { const w = fe.silt(u, gapOf(s)); return w > 0.02 ? mix(PITC, shade(roadCol(s, u), 0.86), Math.min(1, w * 1.15)) : PITC; }, { tuckRows: false });
    /* frame channels at both ends: the pit's end walls, a lit lip level with the approach */
    for (const dir of [-1, 1]) {
      const sO = sg + dir * FL, sI = sg + dir * (FL - 0.12);
      for (let j = 0; j < cu.length - 1; j++) {
        const u0 = cu[j], u1 = cu[j + 1], ref = V(sg, (u0 + u1) / 2, top(sg, u0));
        main.quad(V(sO, u0, top(sO, u0) + 0.012), V(sO, u1, top(sO, u1) + 0.012), V(sI, u1, top(sI, u1) + 0.012), V(sI, u0, top(sI, u0) + 0.012), STL, FXR, 1);
        main.quad(V(sI, u0, top(sI, u0) + 0.012), V(sI, u1, top(sI, u1) + 0.012), V(sI, u1, top(sI, u1) - PITD - 0.01), V(sI, u0, top(sI, u0) - PITD - 0.01), STD, FX0, 2, ref);
        main.quad(V(sO, u0, top(sO, u0) + 0.012), V(sO, u1, top(sO, u1) + 0.012), V(sO, u1, top(sO, u1) - 0.01), V(sO, u0, top(sO, u0) - 0.01), STD, FX0, 2, ref);
      }
    }
    /* rails: full width, chamfered top (a lit crown and two shaded chamfers), dark sides down into the pit */
    const ru = colsIn(-4.1, 4.1);
    for (let k = 0; k < NR; k++) {
      const [r0, r1] = rail(k), rc = (r0 + r1) / 2, c = 0.022;
      for (let j = 0; j < ru.length - 1; j++) {
        const u0 = ru[j], u1 = ru[j + 1], ref = V(rc, (u0 + u1) / 2, top(rc, u0) - 0.05);
        const P = (s, u, dy) => V(s, u, top(s, u) + dy);
        main.quad(P(r0 + c, u0, RT), P(r1 - c, u0, RT), P(r1 - c, u1, RT), P(r0 + c, u1, RT), STL, FXR, 1);
        main.quad(P(r0, u0, RT - c), P(r0 + c, u0, RT), P(r0 + c, u1, RT), P(r0, u1, RT - c), mix(STW, C.steel, 0.5), FXR, 2, ref);
        main.quad(P(r1 - c, u0, RT), P(r1, u0, RT - c), P(r1, u1, RT - c), P(r1 - c, u1, RT), shade(STW, 0.9), FXR, 2, ref);
        main.quad(P(r0, u0, RT - c), P(r0, u1, RT - c), P(r0, u1, -PITD), P(r0, u0, -PITD), shade(STW, 0.42), FX0, 2, ref);
        main.quad(P(r1, u0, RT - c), P(r1, u1, RT - c), P(r1, u1, -PITD), P(r1, u0, -PITD), STD, FX0, 2, ref);
      }
    }
    /* low kerbs at the rail ends, dusty and earth-stained, square to the road */
    const KERB = shade(mix(CONC, C.earthRed, 0.38), 0.86);
    for (const side of [-1, 1]) { const uc = side * 4.27; box(main, sg, uc, top(sg, side * 4.1) - PITD, top(sg, side * 4.1) + 0.09, FL + 0.06, 0.17, vary(KERB, sg, uc, 0.03), shade(KERB, 0.8)); }
    /* the fence line the grid sits in: a heavy strainer against each kerb, then posts every 2.4 m for 12 m, following the ground */
    fe.stubs = [];
    for (const side of [-1, 1]) {
      const pu = [4.62]; for (let x = 4.62 + 2.4; x <= 16.7; x += 2.4) pu.push(x);
      let prevG = null; const posts = [];
      for (const x of pu) { const u = side * x, gy = ground(sg, u); if (prevG !== null && Math.abs(gy - prevG) > 0.8) break; posts.push([u, gy]); prevG = gy; }
      posts.forEach(([u, gy], i) => { const w = i === 0 ? 0.09 : 0.065; box(main, sg, u, gy - 0.45, gy + (i === 0 ? 1.3 : 1.15), w, w, shade(C.bark, 1.15), C.bark); fe.stubs.push({ s: sg, u, y0: gy - 0.45, y1: gy + 1.15, r: w }); });
      for (let i = 0; i < posts.length - 1; i++) for (const hy of [0.5, 0.95]) beam(main, [sg - 0.09, posts[i][0], posts[i][1] + hy], [sg - 0.09, posts[i + 1][0], posts[i + 1][1] + hy], 0.075, shade(C.trunkShade, 0.85));
    }
  }

  /* CREEK DIP: the rules' dip (0.32 m over the rules' width), wet sand and stones, a thin level strip of water, the ford higher and paler */
  function prepCreek(fe) {
    const m = (fe.s0 + fe.s1) / 2, hw = (fe.s1 - fe.s0) / 2 + 1.5, ph = m * 0.37; fe.m = m; fe.hw = hw; fe.sA = m - hw * 1.17; fe.sB = m + hw * 1.17;
    /* the bed's own line: a gentle meander and a ragged width (same function for the drawing and the wheels) */
    fe.mid = u => m + 0.35 * Math.sin(0.6 * u + ph);
    fe.half = u => hw * (1 + 0.15 * Math.sin(0.9 * u + ph * 1.3) + 0.07 * Math.sin(2.3 * u + ph) + 0.04 * Math.sin(5.1 * u + ph * 0.7));
    { let ua = 9, ub = -9; for (const [a, b] of fe.ext) { ua = Math.min(ua, Math.max(a, -3.6)); ub = Math.max(ub, Math.min(b, 3.6)); } fe.pc = (ua + ub) / 2 + 0.3 * Math.sin(ph); fe.pl = Math.max(0.5, (ub - ua) * 0.36); }
    fe.dw = u => 0.255 + 0.09 * ((u - fe.pc) / fe.pl) ** 2 + 0.012 * Math.sin(3.7 * u + ph);
    const fd = fe.smooth.map(([a, b]) => [a, b]);
    fe.ford = u => { let w = 0; for (const [a, b] of fd) w = Math.max(w, (a > -RX + 0.01 ? sm(a - 0.18, a + 0.18, u) : 1) * (b < RX - 0.01 ? 1 - sm(b - 0.18, b + 0.18, u) : 1)); return w; };
    fe.D = (s, u) => { const h = fe.half(u), d = s - fe.mid(u); if (d <= -h || d >= h) return 0; const bell = (1 + Math.cos(Math.PI * d / h)) / 2; return (0.32 * bell + 0.018 * Math.sin(3.1 * u + d * 1.7) * bell * bell) * (1 - sm(3.7, 4.5, Math.abs(u))) * (1 - 0.58 * fe.ford(u)); };
    fe.H = (s, u) => -fe.D(s, u);
    fe.Rf = (s, u) => Math.min(0.3, fe.D(s, u) * 1.5);
  }
  function drawCreek(fe, R) {
    const rows = [fe.sA - 0.2]; for (let s = fe.sA; s < fe.sB + 0.01; s += 0.38) rows.push(Math.min(s, fe.sB)); if (rows[rows.length - 1] < fe.sB - 0.01) rows.push(fe.sB); rows.push(fe.sB + 0.2);
    const ex = []; for (const x of [3.7, 3.95, 4.2, 4.38]) ex.push(x, -x); for (let x = -3.3; x < 3.4; x += 0.6) ex.push(x); for (const [a, b] of fe.smooth) ex.push(a - 0.18, a, a + 0.18, b - 0.18, b, b + 0.18);
    const us = colsIn(-RX, RX, ex);
    /* dry sandy margin, damp sand, wet dark sand by the water; the ford a raised gravel bar a little paler than the road */
    const bedCol = (s, u) => {
      const D = fe.D(s, u), f = fe.ford(u), b = roadCol(s, u), w = sm(0.012, 0.07, D);
      const Dd = D / Math.max(0.3, 1 - 0.58 * f), deep = f < 0.5 && D > fe.dw(u) - 0.06 ? vary(shade(WET2, 0.8), s, u, 0.04) : Dd > 0.2 ? vary(WET2, s, u, 0.04) : Dd > 0.11 ? vary(WET, s, u, 0.05) : vary(DRYB, s, u, 0.05);
      return mix(b, mix(deep, vary(FORD, s, u, 0.06), sm(0.2, 0.8, f)), w);
    };
    const G = field(inter, rows.length, i => rows[i], us, (s, u) => fe.H(s, u), bedCol);
    /* water: a shallow pool in the lowest line of the deep side only. Each bed face is clipped to where the bed lies more than DW under
       the road at that point (so the water always lies inside the bed, never on the road beyond it), the surface 3.5 cm over that line */
    const nc = us.length, fw = v => (fe.ford(v[4]) < 0.5 ? fe.D(v[3], v[4]) - fe.dw(v[4]) : -1);
    const clip = (P) => { const out = []; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], fa = fw(a), fb = fw(b); if (fa > 0) out.push(a); if ((fa > 0) !== (fb > 0)) { const t = fa / (fa - fb); out.push([0, 0, 0, a[3] + (b[3] - a[3]) * t, a[4] + (b[4] - a[4]) * t]); } } return out; };
    for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < nc - 1; j++) {
      const a = G[i * nc + j], b = G[(i + 1) * nc + j], c = G[(i + 1) * nc + j + 1], d = G[i * nc + j + 1];
      if (Math.max(fw(a), fw(b), fw(c), fw(d)) <= 0) continue; const diag = (i + j) & 1;
      for (const t of diag ? [[a, b, c], [a, c, d]] : [[a, b, d], [b, c, d]]) {
        const p = clip(t); if (p.length < 3) continue;
        const q = p.map(v => V(v[3], v[4], base(v[3], v[4]) - 0.22));
        for (let k = 1; k < q.length - 1; k++) { const st = Math.max(0, Math.sin((q[0][4] - fe.pc) * 2.2 + (q[0][3] - fe.m) * 0.8)) ** 6; water.tri(q[0], q[k], q[k + 1], [st, st, st], FX0, 1); }
      }
    }
    /* river stones in the bed and gravel on the ford (inside the dip: interior pass) */
    for (let n = 0; n < 30; n++) {
      const u = (R() - 0.5) * 8.2, s = fe.mid(u) + (R() - 0.5) * fe.half(u) * 1.3, D = fe.D(s, u); if (D < 0.08) continue;
      const ford = fe.ford(u) > 0.5, part = rockPart(3 + n, ford || R() < 0.5 ? 1 : 0, ford ? 'rockGrey' : (R() < 0.5 ? 'rockGrey' : 'rockRed'));
      putRock(inter, part, s, u, ford ? 0.04 + R() * 0.03 : 0.06 + R() * 0.08, R() * 6, base(s, u) - D, null);
    }
    /* the creek line off the road: rocks and grass clumps on both banks along the bed */
    for (const side of [-1, 1]) for (let n = 0; n < 3; n++) {
      const u = side * (6.6 + n * 1.6 + R() * 0.8), s = fe.m + (R() - 0.5) * 3;
      if (n === 1) addPart(main, K.spinifex(40 + n + (side > 0 ? 5 : 0), 2), s, u, ground(s, u) - 0.04, R() * 6, 0.9 + R() * 0.3);
      else putRock(main, rockPart(60 + n * 3 + (side > 0 ? 1 : 0), 1, 'rockRed'), s, u, 0.18 + R() * 0.15, R() * 6, ground(s, u) - 0.06, null);
    }
    fe.cut = { s0: fe.sA, s1: fe.sB, u0: -RX, u1: RX, solid: true };
  }

  /* POTHOLES: irregular sunken holes with dark soil, a crumbled lip, loose stones; the free lane stays plain road */
  function prepPothole(fe, R) {
    const holes = [], s0 = fe.s0, s1 = fe.s1;
    for (const [a0, b0] of fe.ext) {
      const a = Math.max(a0, -3.75), b = Math.min(b0, 3.75), w = b - a; if (w < 0.5) continue;
      const nu = Math.max(1, Math.round(w / 0.95));
      for (let k = 0; k < nu; k++) for (let row = 0; row < 2; row++) {
        if (row === 1 && R() < 0.15) continue;
        const R0 = 0.3 + R() * 0.3, uc = a + (k + 0.5) * w / nu + (R() - 0.5) * 0.3, sc = s0 + (row ? 2.15 : 0.8) + ((k & 1) ? 0.35 : -0.15) + (R() - 0.5) * 0.4;
        const ucl = Math.max(a + R0 * 0.6, Math.min(b - R0 * 0.6, uc));
        if (holes.some(h => Math.hypot(h.s - sc, h.u - ucl) < (h.R0 + R0) * 1.4 + 0.12)) continue;
        holes.push({ s: sc, u: ucl, R0, dep: 0.07 + R() * 0.08, ph: [R() * 6.28, R() * 6.28, R() * 6.28, R() * 6.28] });
      }
    }
    fe.holes = holes; fe.sA = Math.min(...holes.map(h => h.s - h.R0 * 1.6), s0); fe.sB = Math.max(...holes.map(h => h.s + h.R0 * 1.6), s1);
    fe.cut = { s0: Math.min(...holes.map(h => h.s - h.R0 * 1.45)), s1: Math.max(...holes.map(h => h.s + h.R0 * 1.45)), u0: Math.min(...holes.map(h => h.u - h.R0 * 1.45)), u1: Math.max(...holes.map(h => h.u + h.R0 * 1.45)),
      inside: (s, u) => holes.some(h => { const ds = s - h.s, du = u - h.u; return Math.hypot(ds, du) <= Rth(h, Math.atan2(du, ds)) * 1.03; }) };
    if (!holes.length) fe.cut = null;
  }
  const Rth = (h, th) => h.R0 * (1 + 0.16 * Math.sin(2 * th + h.ph[0]) + 0.09 * Math.sin(3 * th + h.ph[1]) + 0.05 * Math.sin(5 * th + h.ph[2]));
  const lipH = (h, th) => 0.019 + 0.007 * Math.sin(4 * th + h.ph[3]) + 0.004 * Math.sin(7 * th + h.ph[0]);
  function holeProf(h, rho, th) {
    if (rho <= 0.55) return -h.dep * (1 - 0.1 * rho * rho);
    if (rho <= 1) return -h.dep * (1 - 0.1 * 0.3025) * (1 - sm(0.55, 1.0, rho));
    if (rho <= 1.35) return lipH(h, th) * Math.sin(Math.PI * Math.min(1, (rho - 1) / 0.35)) ** 2;
    return 0;
  }
  function potH(fe, s, u) {
    let best = 0;
    for (const h of fe.holes) {
      const ds = s - h.s, du = u - h.u; if (Math.abs(ds) > h.R0 * 1.7 || Math.abs(du) > h.R0 * 1.7) continue;
      const th = Math.atan2(du, ds), rho = Math.hypot(ds, du) / Rth(h, th); if (rho >= 1.35) continue;
      const v = holeProf(h, rho, th); if (Math.abs(v) > Math.abs(best)) best = v;
    }
    return best;
  }
  function drawPothole(fe, R) {
    const NS = 16, RI = [0, 0.3, 0.55, 0.75, 0.9, 1.0], RL = [1.0, 1.12, 1.35];
    for (const h of fe.holes) {
      const pt = (rho, k, y) => { const th = k / NS * Math.PI * 2, r = rho * Rth(h, th), s = h.s + Math.cos(th) * r, u = h.u + Math.sin(th) * r; return V(s, u, base(s, u) + (y === undefined ? holeProf(h, rho, th) : y)); };
      const ring = (rho, y) => { const a = []; for (let k = 0; k < NS; k++) a.push(pt(rho, k, y)); return a; };
      const rings = RI.map(r => (r === 0 ? null : ring(r))), c0 = V(h.s, h.u, base(h.s, h.u) + holeProf(h, 0, 0));
      for (let k = 0; k < NS; k++) inter.tri(c0, rings[1][k], rings[1][(k + 1) % NS], vary(shade(FLOOR, 0.9), h.s, k, 0.04), FX0, 1);
      for (let q = 1; q < RI.length - 1; q++) for (let k = 0; k < NS; k++) {
        const a = rings[q][k], b = rings[q][(k + 1) % NS], c = rings[q + 1][(k + 1) % NS], d = rings[q + 1][k];
        const col = q === 1 ? FLOOR : q === 2 ? shade(FLOOR, 1.08) : q === 3 ? WALL : CONTACT;
        inter.quad(a, b, c, d, vary(col, h.s + q, k, 0.06), FX0, 1);
      }
      /* lip: the crumbled raised edge, emerging from 8 mm under the road */
      const L = [ring(1.0, 0), ring(1.12), ring(1.35, -0.008)];
      for (let q = 0; q < 2; q++) for (let k = 0; k < NS; k++) {
        const a = L[q][k], b = L[q][(k + 1) % NS], c = L[q + 1][(k + 1) % NS], d = L[q + 1][k];
        main.quad(a, b, c, d, q === 0 ? vary(mix(roadCol(a[3], a[4]), C.roadLine, 0.22), h.s, k, 0.08) : roadCol(a[3], a[4]), FX0, 1);
      }
      /* cap at the rim */
      /* stones: one or two in the floor, chips on the lip */
      for (let n = 0; n < 2; n++) { const th = R() * 6.28, r = R() * 0.4 * h.R0, s = h.s + Math.cos(th) * r, u = h.u + Math.sin(th) * r; addPart(inter, PEB[n % PEB.length], s, u, base(s, u) - h.dep * 0.95, R() * 6, 0.8 + R() * 0.5); }
      for (let n = 0; n < 3; n++) { const th = R() * 6.28, rr = Rth(h, th) * (1.1 + R() * 0.5), s = h.s + Math.cos(th) * rr, u = h.u + Math.sin(th) * rr; addPart(main, PEB[(n + 2) % PEB.length], s, u, base(s, u) + 0.005, R() * 6, 0.55 + R() * 0.4); }
    }
    /* loose stones scattered over the patch */
    for (let n = 0; n < 8; n++) { const e = fe.ext[n % fe.ext.length], u = Math.max(-3.7, e[0]) + R() * (Math.min(3.7, e[1]) - Math.max(-3.7, e[0])), s = fe.s0 + R() * (fe.s1 - fe.s0); if (fe.holes.some(h => Math.hypot(h.s - s, h.u - u) < h.R0 * 1.5)) continue; addPart(main, PEB[n % PEB.length], s, u, base(s, u), R() * 6, 0.9 + R() * 0.9); }
  }

  /* WASHED-OUT EDGE: the road edge collapsed into a gully over the rules' length; floor to 0.3 m, a cut bank, a broken lip */
  function prepWashout(fe, R) {
    const e = fe.ext.find(([a, b]) => a <= -4.4) || fe.ext.find(([a, b]) => b >= 4.4) || fe.ext[0];
    fe.side = e[0] <= -4.4 ? -1 : 1; fe.Wb = fe.side < 0 ? e[1] + RX : RX - e[0];
    fe.sA = fe.s0 - 0.4; fe.sB = fe.s1 + 0.4; fe.ph = [R() * 6.28, R() * 6.28];
    fe.reach = s => { const t = (s - fe.sA) / (fe.sB - fe.sA); if (t <= 0 || t >= 1) return 0; return fe.Wb * Math.pow(sm(0, 0.4, t) * (1 - sm(0.82, 1, t)), 0.5) * (1 + 0.09 * Math.sin(6 * Math.PI * t + fe.ph[0]) + 0.05 * Math.sin(14 * Math.PI * t + fe.ph[1])) / 1.1; };
    fe.floor = s => { const t = (s - fe.sA) / (fe.sB - fe.sA); return t <= 0 || t >= 1 ? 0 : 0.38 * sm(0, 0.45, t) * (1 - sm(0.8, 0.97, t)); };
    fe.prof = (vp, s) => { const g = vp < 0.78 ? 1 - 0.25 * vp / 0.78 : 0.75 * (1 - sm(0.78, 1.0, vp)); return -fe.floor(s) * g; };
    fe.H = (s, u) => {
      if (s <= fe.sA || s >= fe.sB) return 0; const r = fe.reach(s); if (r < 0.01) return 0;
      const v = fe.side < 0 ? u + RX : RX - u; if (v < 0) return 0;
      if (v <= r) return fe.prof(v / r, s);
      if (v < r + 0.22) return 0.02 * Math.sin(Math.PI * (v - r) / 0.22) * sm(0, 0.3, r);
      return 0;
    };
    fe.Rf = (s, u) => Math.min(0.35, -fe.H(s, u) * 1.5);
  }
  function drawWashout(fe, R) {
    const VP = [0, 0.2, 0.4, 0.6, 0.75, 0.88, 1.0], rows = []; for (let s = fe.sA; s < fe.sB + 0.01; s += 0.2) rows.push(Math.min(s, fe.sB)); if (rows[rows.length - 1] < fe.sB) rows.push(fe.sB);
    const uOf = (s, vp, extra = 0) => { const r = fe.reach(s) * vp + extra; return fe.side < 0 ? -RX + r : RX - r; };
    const G = rows.map(s => VP.map(vp => { const u = uOf(s, vp); return V(s, u, base(s, u) + fe.prof(vp, s)); }));
    const HOLLOW = mix(C.earthDeep, C.black, 0.4);
    for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < VP.length - 1; j++) {
      /* a hollow in shadow: brightness falls with depth, the scooped walls never lighter than the road's own shade */
      const dep = -(fe.prof(VP[j], rows[i]) + fe.prof(VP[j + 1], rows[i + 1])) / 2 / 0.38, col = shade(HOLLOW, 0.72 - 0.42 * Math.min(1, dep));
      inter.quad(G[i][j], G[i + 1][j], G[i + 1][j + 1], G[i][j + 1], vary(col, rows[i], j, 0.04), FX0, 1);
    }
    /* the cut bank at the gully's outer side */
    const BANK = shade(mix(C.earthDeep, C.black, 0.3), 0.6);
    for (let i = 0; i < rows.length - 1; i++) {
      const a = G[i][0], b = G[i + 1][0], s0 = rows[i], s1 = rows[i + 1], u = fe.side * RX;
      inter.quad(a, b, V(s1, u, base(s1, u)), V(s0, u, base(s0, u)), vary(BANK, s0, 1, 0.05), FX0, 2, V((s0 + s1) / 2, fe.side * (RX + 1), base(s0, u) - 0.1));
    }
    /* broken lip on the road side */
    for (let i = 0; i < rows.length - 1; i++) {
      const s0 = rows[i], s1 = rows[i + 1], r0 = fe.reach(s0), r1 = fe.reach(s1);
      const P = (s, r, x, y) => { const u = fe.side < 0 ? -RX + r + x : RX - r - x; return V(s, u, base(s, u) + y); };
      const k0 = sm(0, 0.3, r0), k1 = sm(0, 0.3, r1);
      main.quad(P(s0, r0, 0, 0), P(s1, r1, 0, 0), P(s1, r1, 0.11, 0.02 * k1), P(s0, r0, 0.11, 0.02 * k0), vary(mix(roadCol(s0, uOf(s0, 1)), C.roadLine, 0.22), s0, 3, 0.08), FX0, 1);
      main.quad(P(s0, r0, 0.11, 0.02 * k0), P(s1, r1, 0.11, 0.02 * k1), P(s1, r1, 0.22, -0.008), P(s0, r0, 0.22, -0.008), roadCol(s0, uOf(s0, 1, 0.15)), FX0, 1);
    }
    /* caps over the gully */
    let rMax = 0; for (const s of rows) rMax = Math.max(rMax, fe.reach(s));
    fe.cut = { s0: fe.sA, s1: fe.sB, u0: fe.side < 0 ? -RX : RX - rMax - 0.1, u1: fe.side < 0 ? -RX + rMax + 0.1 : RX, inside: (s, u) => { const r = fe.reach(s), v = fe.side < 0 ? u + RX : RX - u; return r > 0.01 && v <= r + 0.03; } };
    /* debris: stones and slabs of broken road in the gully */
    for (let n = 0; n < 4; n++) {
      const s = fe.sA + (0.3 + n * 0.15) * (fe.sB - fe.sA), r = fe.reach(s), u = fe.side < 0 ? -RX + r + 0.12 : RX - r - 0.12;
      addPart(main, PEB[n % PEB.length], s, u, base(s, u) - 0.01, R() * 6, 0.8 + R() * 0.4);
    }
    for (let n = 0; n < 10; n++) {
      const s = fe.sA + (0.2 + R() * 0.6) * (fe.sB - fe.sA), vp = R() * 0.7, u = uOf(s, vp), y = base(s, u) + fe.prof(vp, s);
      if (n < 3) putRock(inter, rockPart(80 + n, 1, 'road'), s, u, 0.05 + R() * 0.03, R() * 6, y, null);
      else addPart(inter, PEB[n % PEB.length], s, u, y, R() * 6, 1 + R() * 1.2);
    }
  }

  /* ROCK FALL: kit rocks sitting on the road over the extent (wheel-height 0.13-0.25 m), boulders in the gutter, scree */
  function prepRocks(fe, R) {
    fe.place = [];
    for (const [a0, b0] of fe.ext) {
      const a = Math.max(a0, -3.75), b = Math.min(b0, 3.75), w = b - a; if (w < 0.3) continue;
      const n = Math.max(2, Math.round(w / 0.42));
      for (let row = 0; row < 2; row++) for (let k = 0; k < n; k++) {
        if (row === 1 && R() < 0.3) continue;
        const u = a + (k + 0.5 + (row ? 0.5 : 0)) * w / n + (R() - 0.5) * 0.12; if ((b0 < 3.6 && u > b - 0.42) || (a0 > -3.6 && u < a + 0.42) || u > b - 0.1) continue;
        fe.place.push({ s: fe.s0 + (row ? 1.15 : 0.45) + (R() - 0.5) * 0.3, u, hr: 0.16 + R() * 0.09, v: R() < 0.55 ? 1 : 0, seed: 21 + row * 13 + k * 3, yaw: R() * 6.28 });
      }
      if (a0 <= -4.3 || b0 >= 4.3) { const side = a0 <= -4.3 ? -1 : 1; for (let k = 0; k < 2; k++) fe.place.push({ s: fe.s0 + 0.3 + k * 1.1 + (R() - 0.5) * 0.4, u: side * (4.8 + R() * 0.4), hr: 0.42 + R() * 0.25, v: k ? 2 : 0, seed: 91 + k, yaw: R() * 6.28, big: true }); }
    }
    fe.rocks = []; fe.sA = fe.s0 - 0.8; fe.sB = fe.s1 + 0.8;
    /* the wheel's climb: a dome as high as the rock, 18 cm wider than its footprint (a 0.4 m tyre meets a rock before its centre does) */
    for (const p of fe.place) { if (p.big) continue; const part = rockPart(p.seed, p.v, 'rockGrey'), bd = bounds(part), k = (p.hr + 0.03) / (bd.y1 - bd.y0); fe.rocks.push({ s: p.s, u: p.u, r: bd.r * k * 0.8 + 0.18, h: p.hr }); }
    fe.H = (s, u) => domes(fe.rocks, s, u); fe.Rf = (s, u) => Math.min(0.6, fe.H(s, u) * 3);
  }
  function domes(list, s, u) { let m = 0; for (const r of list) { const q = ((s - r.s) ** 2 + (u - r.u) ** 2) / (r.r * r.r); if (q < 1) { const x = 1 - Math.sqrt(q); m = Math.max(m, r.h * x * x * (3 - 2 * x)); } } return m; }
  function drawRocks(fe, R) {
    for (const p of fe.place) { const part = rockPart(p.seed, p.v, 'rockGrey'); putRock(main, part, p.s, p.u, p.hr, p.yaw, Math.abs(p.u) > RX ? ground(p.s, p.u) : base(p.s, p.u), null); }
    for (let n = 0; n < 14; n++) { const e = fe.ext[n % fe.ext.length], u = Math.max(-4.3, e[0]) + R() * (Math.min(4.3, e[1]) - Math.max(-4.3, e[0])), s = fe.s0 + (R() - 0.3) * 2.6; addPart(main, PEB[n % PEB.length], s, u, base(s, u), R() * 6, 1 + R() * 1.4); }
  }

  /* FALLEN BRANCH: a pale gum limb from the verge across the extent, two twigs, leafy clumps on the verge; 0.15 m under a wheel */
  function prepLog(fe, R) {
    const e = fe.ext.find(([a, b]) => a <= -4.3) || fe.ext.find(([a, b]) => b >= 4.3) || fe.ext[0];
    const side = e[0] <= -4.3 ? -1 : 1, tip = side < 0 ? e[1] - 0.1 : e[0] + 0.1, ub = side * 5.6, flip = R() < 0.5 ? 1 : -1;
    const sb = fe.s0 + 0.6 + flip * 0.35, st = fe.s0 + 0.6 - flip * 0.35, pts = [];
    for (let k = 0; k <= 6; k++) { const t = k / 6; pts.push({ s: sb + (st - sb) * t + 0.28 * Math.sin(Math.PI * t) + 0.06 * Math.sin(3 * Math.PI * t), u: ub + (tip - ub) * t, r: 0.1 + (0.085 - 0.1) * t }); }
    const segs = []; for (let k = 0; k < 6; k++) segs.push([pts[k], pts[k + 1]]);
    const tw = [];
    for (const [k, dir] of [[1, -1], [3, 1], [5, -1]]) {
      const p = pts[k], ang = (side < 0 ? 0 : Math.PI) + dir * (0.8 + R() * 0.3), len = 0.5 + R() * 0.2;
      let u1 = p.u + Math.cos(ang) * len * 0.9; const s1 = p.s + Math.sin(ang) * len * 0.9 * flip;
      u1 = side < 0 ? Math.min(u1, e[1] - 0.05) : Math.max(u1, e[0] + 0.05);
      tw.push([{ s: p.s, u: p.u, r: 0.065 }, { s: s1, u: u1, r: 0.05 }]);
    }
    /* a fork: a second limb leaves the main one a third of the way along and lies back toward the verge */
    { const p = pts[2], dir = side < 0 ? -1 : 1, a = 0.55 * flip, L1 = 1.6, s1 = p.s + Math.sin(a) * L1, u1 = p.u + dir * Math.cos(a) * L1 * 0.4 + (tip - ub) * 0.25;
      tw.push([{ s: p.s, u: p.u, r: 0.075 }, { s: (p.s + s1) / 2, u: (p.u + u1) / 2, r: 0.062 }, { s: s1, u: side < 0 ? Math.min(u1, e[1] - 0.1) : Math.max(u1, e[0] + 0.1), r: 0.05 }]); }
    fe.limb = pts; fe.twigs = tw; fe.segs = segs.concat(tw.flatMap(t => t.slice(1).map((q, i) => [t[i], q]))); fe.side = side;
    { const ss = fe.segs.flatMap(([a, b]) => [a.s, b.s]); fe.sA = Math.min(...ss) - 0.6; fe.sB = Math.max(...ss) + 0.6; }
    fe.H = (s, u) => {
      let m = 0;
      for (const [a, b] of fe.segs) {
        const ds = b.s - a.s, du = b.u - a.u, L2 = ds * ds + du * du, t = Math.max(0, Math.min(1, ((s - a.s) * ds + (u - a.u) * du) / L2)), r = a.r + (b.r - a.r) * t;
        const d = Math.hypot(s - a.s - ds * t, u - a.u - du * t), w = r + 0.22; if (d < w) m = Math.max(m, 1.6 * r * (1 - (d / w) ** 2) ** 2);
      }
      return m;
    };
    fe.Rf = (s, u) => Math.min(0.6, fe.H(s, u) * 3);
  }
  function drawLog(fe, R) {
    const surf = (s, u) => (Math.abs(u) > RX ? ground(s, u) - 0.03 : base(s, u));
    const f = new K.Facets(), BK = mix(C.trunkShade, C.bark, 0.7), bark = (i, k) => (k === -1 ? C.trunk : k % 3 === 0 ? BK : k % 3 === 1 ? shade(BK, 1.12) : shade(BK, 0.85));
    const wp = p => { T.world(p.s, p.u, WO); return [WO.x, surf(p.s, p.u) + p.r * 0.75, WO.z]; };
    K.tube(f, fe.limb.map(wp), fe.limb.map(p => p.r), 6, bark, FX0, true, true);
    for (const t of fe.twigs) K.tube(f, t.map(wp), t.map(p => p.r), 5, bark, FX0, true, false);
    /* two twigs standing up off the verge half of the limb (a fallen branch never lies flat), a leaf tuft on each */
    const ups = [];
    for (const [k, ds, du] of [[1, 0.35, 0.25], [2, -0.3, 0.45]]) { const p = fe.limb[k], a = wp(p), dir = -fe.side; T.world(p.s + ds, p.u + dir * du, WO); const b = [WO.x, a[1] + 0.62, WO.z]; K.tube(f, [a, [(a[0] + b[0]) / 2, a[1] + 0.34, (a[2] + b[2]) / 2], b], [0.05, 0.045, 0.04], 5, bark, FX0, true, false); ups.push(b); }
    const limbN = f.P.length;
    /* leaf clumps lie on the verge, beyond any wheel */
    const rr = K.rng(7 + Math.round(fe.s0));
    const leaves = [];
    for (let n = 0; n < 5; n++) leaves.push({ u: fe.side * (4.7 + n * 0.4 + rr() * 0.2), s: fe.limb[0].s + (rr() - 0.5) * 1.8, rad: 0.42 + rr() * 0.25, sy: 0.6 });
    { const e = fe.twigs[fe.twigs.length - 1][1]; leaves.push({ u: e.u, s: e.s, rad: 0.24, sy: 0.4 }); }
    for (const b of ups) K.blob(f, rr, { c: [b[0], b[1] + 0.04, b[2]], rad: 0.26, sy: 0.8, detail: 1, j: 0.25, flat: -0.6, col: (no) => shade(rr() < 0.4 ? C.leaf : C.leafDark, 1 + no[1] * 0.08), fx: FX0 });
    for (const L0 of leaves) {
      const u = L0.u, s = L0.s, rad = L0.rad; T.world(s, u, WO);
      K.blob(f, rr, { c: [WO.x, surf(s, u) + rad * L0.sy * 0.35, WO.z], rad, sy: L0.sy, detail: 1, j: 0.25, flat: -0.35, col: (no) => { const c = rr() < 0.25 ? C.straw : rr() < 0.5 ? C.leaf : C.leafDark; return shade(c, 1 + no[1] * 0.08); }, fx: FX0 });
    }
    for (let t = 0; t < f.P.length; t += 9) {
      const v = [0, 3, 6].map(q => { const x = f.P[t + q], y = f.P[t + q + 1], z = f.P[t + q + 2], tk = T.toTrack(x, z, fe.s0); return [x, y, z, tk[0], tk[1]]; });
      const ci = t, ax = v[1][0] - v[0][0], ay = v[1][1] - v[0][1], az = v[1][2] - v[0][2], bx = v[2][0] - v[0][0], by = v[2][1] - v[0][1], bz = v[2][2] - v[0][2];
      const nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx, ky = ny / (Math.hypot(nx, ny, nz) || 1), k = t < limbN ? (ky < -0.15 ? 0.55 : ky < 0.35 ? 0.85 : 1.05) : 1;
      main.tri(v[0], v[1], v[2], [f.Cl[ci] * k, f.Cl[ci + 1] * k, f.Cl[ci + 2] * k], FX0, 0);
    }
  }

  /* ---------------- entrance marking: a short thin dashed line on the smooth lane's edge (features that have a smooth line) */
  function drawDashes(fe) {
    if (fe.full || !['corrug', 'pothole', 'grid', 'creek'].includes(fe.type)) return;
    const sE = fe.sA - 0.9, edges = [];
    for (const [a, b] of fe.ext) { if (a > -3.6) edges.push(a - 0.12); if (b < 3.6) edges.push(b + 0.12); }
    for (const ue of edges) for (let k = 0; k < 3; k++) {
      const s1 = sE - k * 1.5, s0 = s1 - 0.8, hu = 0.04, ref = V((s0 + s1) / 2, ue, base(s0, ue) - 0.5);
      const P = (s, u, y) => V(s, u, base(s, u) + y);
      deco.quad(P(s0, ue - hu, 0.022), P(s1, ue - hu, 0.022), P(s1, ue + hu, 0.022), P(s0, ue + hu, 0.022), PAINT, FX0, 1);
      for (const [p, q] of [[P(s0, ue - hu, 0.022), P(s1, ue - hu, 0.022)], [P(s1, ue - hu, 0.022), P(s1, ue + hu, 0.022)], [P(s1, ue + hu, 0.022), P(s0, ue + hu, 0.022)], [P(s0, ue + hu, 0.022), P(s0, ue - hu, 0.022)]]) deco.quad(p, q, [q[0], q[1] - 0.03, q[2], q[3], q[4]], [p[0], p[1] - 0.03, p[2], p[3], p[4]], shade(PAINT, 0.85), FX0, 2, [ref[0], ref[1] + 0.5, ref[2]]);
    }
    fe.dashes = edges;
  }

  /* ---------------- sign placement: 40 m before, right verge by default; flips side or shifts to keep clear of boards, gates and other signs */
  const placed = [];
  function placeSign(fe) {
    const want = fe.s0 - 40;
    const bad = (s, side) => avoid.some(a => s > a.s0 && s < a.s1 && (a.side === 0 || a.side === side)) || placed.some(p => p.side === side && Math.abs(p.s - s) < 6);
    let s = want, side = 1;
    for (let k = 0; k < 14; k++) { s = want + [0, -2, 2, -4, 4, -6, 6, -8, 8, -10, 10, -12, 12, -14][k]; if (!bad(s, 1)) { side = 1; break; } if (!bad(s, -1)) { side = -1; break; } }
    const u = side * (s > 785 ? 7.4 : 6.8), y = ground(s, u);
    placed.push({ s, side });
    fe.sign = { s, u, side, y };
    addPart(deco, signPart(fe.type), s, u, y, Math.PI - side * 0.3, 1);
  }

  /* ---------------- build */
  const src = (o.features || []).filter(h => TYPES.includes(h.type)).map((h, k) => ({ h, k, s0: h.s0 + sOff, s1: h.s1 + sOff })).sort((a, b) => a.s0 - b.s0);
  for (const it of src) {
    const h = it.h, ln = lanesOf(h), fe = { id: h.i === undefined ? it.k : h.i, type: h.type, name: NAMES[h.type], s0: it.s0, s1: it.s1, full: !!h.full, ext: ln.ext, smooth: ln.smooth, spans: h.spans, free: h.free };
    const R = K.rng(1 + Math.round(it.s0 * 10) * 7 + TYPES.indexOf(h.type) * 101);
    const m0 = main.nv, d0 = deco.nv, w0 = water.nv;
    if (h.type === 'corrug') { prepCorrug(fe, R); drawCorrug(fe); }
    else if (h.type === 'crest') { prepCrest(fe); drawCrest(fe); }
    else if (h.type === 'grid') { prepGrid(fe); drawGrid(fe); }
    else if (h.type === 'creek') { prepCreek(fe); drawCreek(fe, R); }
    else if (h.type === 'pothole') { prepPothole(fe, R); fe.H = (s, u) => potH(fe, s, u); fe.Rf = (s, u) => Math.min(0.3, -Math.min(0, potH(fe, s, u)) * 3); drawPothole(fe, R); }
    else if (h.type === 'washout') { prepWashout(fe, R); drawWashout(fe, R); }
    else if (h.type === 'rocks') { prepRocks(fe, R); drawRocks(fe, R); }
    else if (h.type === 'log') { prepLog(fe, R); drawLog(fe, R); }
    drawDashes(fe); placeSign(fe);
    fe.vr = [m0, main.nv, d0, deco.nv, w0, water.nv];
    fe.sMin = Math.min(fe.sign.s, fe.sA - 6); fe.sMax = fe.sB + 2;
    FE.push(fe);
  }
  const tBuild = (typeof performance !== 'undefined' ? performance : Date).now() - t0;

  /* ---------------- three.js objects */
  const geo = (b, full) => {
    const g = new THREE.BufferGeometry(), n = b.nv;
    g.setAttribute('position', new THREE.BufferAttribute(b.P.slice(0, n * 3), 3));
    if (full) { g.setAttribute('normal', new THREE.BufferAttribute(b.N.slice(0, n * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(b.Cl.slice(0, n * 3), 3)); g.setAttribute('aFx', new THREE.BufferAttribute(b.F.slice(0, n * 4), 4)); g.setAttribute('aTrk', new THREE.BufferAttribute(b.T.slice(0, n * 2), 2)); }
    g.computeBoundingSphere(); return g;
  };
  /* the surface pieces, interiors and models: the kit's world material (no offset: they replace the road, they do not sit on it);
     signs and dashes: the same program with the depth rule's polygonOffset */
  const mat = K.createWorldMaterial(THREE, o.U), decoMat = K.createWorldMaterial(THREE, o.U);
  decoMat.polygonOffset = true; decoMat.polygonOffsetFactor = -1; decoMat.polygonOffsetUnits = -4;
  const group = new THREE.Group(); group.name = 'road-features';
  const mk = (b, m, name) => { const me = new THREE.Mesh(geo(b, true), m); me.frustumCulled = false; me.receiveShadow = true; me.castShadow = false; me.name = name; group.add(me); return me; };
  const mMain = mk(main, mat, 'rf-main'), mDeco = mk(deco, decoMat, 'rf-signs');
  /* water is a reflection, not paint: a muted tone from the sky of the current moment (uniforms U), a little darker, soft pale streaks */
  const waterMat = new THREE.ShaderMaterial({
    uniforms: { uHemiS: o.U.uHemiS, uHzAnti: o.U.uHzAnti, uHzSun: o.U.uHzSun, uExposure: o.U.uExposure },
    vertexShader: 'varying float vSt; void main() { vSt = color.r; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uHemiS; uniform vec3 uHzAnti; uniform vec3 uHzSun; uniform float uExposure; varying float vSt; void main() { vec3 c = mix(uHemiS * 0.4, uHzAnti, 0.45) * 0.5; c = mix(c, uHzSun * 0.9, vSt * 0.4); gl_FragColor = vec4(c * uExposure, 1.0);' + String.fromCharCode(10) + '#include <tonemapping_fragment>' + String.fromCharCode(10) + '#include <colorspace_fragment>' + String.fromCharCode(10) + '}',
    vertexColors: true
  });
  const mWater = mk(water, waterMat, 'rf-water');

  /* ---------------- cuts: inside each feature's footprint the kit road is not drawn (patchTerrain discards it), so the feature's own
     surface replaces it. Solid cuts are boxes in (s, u); holes and the washout use a mask tile (128 x 128) in one atlas */
  const CUTS = FE.filter(f => f.cut).map(f => f.cut), TILE = 128, tiles = CUTS.filter(c => !c.solid);
  let atlas = null;
  for (const c of CUTS) if (c.solid) c.tile = [0, 0, -1, 0];
  if (tiles.length) {
    const cols = Math.min(8, tiles.length), rowsN = Math.ceil(tiles.length / 8), W = cols * TILE, Hh = rowsN * TILE, data = new Uint8Array(W * Hh);
    tiles.forEach((c, n) => {
      const cx = (n % 8) * TILE, cy = Math.floor(n / 8) * TILE; c.tile = [cx / W, cy / Hh, TILE / W, TILE / Hh];
      for (let j = 0; j < TILE; j++) for (let i = 0; i < TILE; i++) { const s = c.s0 + (i + 0.5) / TILE * (c.s1 - c.s0), u = c.u0 + (j + 0.5) / TILE * (c.u1 - c.u0); if (c.inside(s, u)) data[(cy + j) * W + cx + i] = 255; }
    });
    atlas = new THREE.DataTexture(data, W, Hh, THREE.RedFormat, THREE.UnsignedByteType); atlas.magFilter = atlas.minFilter = THREE.LinearFilter; atlas.generateMipmaps = false; atlas.needsUpdate = true;
  }
  const HS = o.holes || null;
  function holeSlots(a, b) {
    if (!HS) return; const B = HS.uniforms.uHoleB.value, Tt = HS.uniforms.uHoleT.value; let k = 0;
    if (a >= 0) for (let i = a; i <= b && k < B.length; i++) { const c = FE[i].cut; if (!c) continue; B[k].set(c.s0, c.s1, c.u0, c.u1); Tt[k].set(c.tile[0], c.tile[1], c.tile[2], c.tile[3]); k++; }
    for (; k < B.length; k++) B[k].set(1, 0, 0, 0);
    HS.uniforms.uHoleTex.value = atlas || HS.blank;
  }

  /* ---------------- queries */
  function heightAt(s, u) { let h = 0; for (let i = 0; i < FE.length; i++) { const f = FE[i]; if (s < f.sA - 0.7 || s > f.sB + 0.7) continue; h += f.H(s, u); } return h; }
  function featureAt(s, u) { for (let i = 0; i < FE.length; i++) { const f = FE[i]; if (s < f.sA - 0.7 || s > f.sB + 0.7) continue; if (Math.abs(f.H(s, u)) > 0.004) return f; } return null; }
  function roughAt(s, u) { let r = 0; for (let i = 0; i < FE.length; i++) { const f = FE[i]; if (s < f.sA - 0.7 || s > f.sB + 0.7) continue; const v = f.Rf(s, u); if (v > r) r = v; } return r; }
  /* the draw window: only features from `behind` m back to `ahead` m forward of s (no allocation) */
  const win = { behind: o.behind || 20, ahead: o.ahead || 150 };
  function update(s) {
    let a = -1, b = -1;
    for (let i = 0; i < FE.length; i++) { const f = FE[i]; if (f.sMax >= s - win.behind && f.sMin <= s + win.ahead) { if (a < 0) a = i; b = i; } }
    if (a < 0) { mMain.geometry.setDrawRange(0, 0); mDeco.geometry.setDrawRange(0, 0); mWater.geometry.setDrawRange(0, 0); holeSlots(-1, -1); return; }
    const A = FE[a].vr, B = FE[b].vr;
    mMain.geometry.setDrawRange(A[0], B[1] - A[0]); mDeco.geometry.setDrawRange(A[2], B[3] - A[2]); mWater.geometry.setDrawRange(A[4], B[5] - A[4]); holeSlots(a, b);
  }
  update(0);
  const list = FE.map(f => ({ id: f.id, type: f.type, name: f.name, s: [f.s0, f.s1], drawn: [+f.sA.toFixed(2), +f.sB.toFixed(2)], ext: f.ext.map(e => e.map(x => +x.toFixed(2))), smooth: f.smooth.map(e => e.map(x => +x.toFixed(2))), full: f.full, sign: { s: +f.sign.s.toFixed(1), u: f.sign.u, side: f.sign.side } }));
  function dispose() { for (const m of [mMain, mDeco, mWater]) { m.geometry.dispose(); group.remove(m); } mat.dispose(); decoMat.dispose(); waterMat.dispose(); if (atlas) atlas.dispose(); if (HS) holeSlots(-1, -1); }
  const stats = { buildMs: +tBuild.toFixed(1), tris: { main: main.nv / 3, signs: deco.nv / 3 }, cuts: CUTS.length, features: FE.length };
  return { group, heightAt, roughAt, featureAt, list, update, dispose, stats, window: win, _fe: FE, base, signPart };
}
