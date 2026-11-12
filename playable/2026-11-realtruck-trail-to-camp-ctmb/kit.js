/* */
/* style-kit.js : the low-poly outback kit for Trail to Camp (realtruck-01).
   One module the game can import: palette, colour script (lighting moments blended along the trail), a facet builder
   (flat-shaded triangle soup with per-face solid colour), prop generators, the road/terrain generator, the long-shadow
   mask baker, and the material/sky factories. No imports: geometry code is plain JS (runs in node for counts);
   anything that needs three.js takes THREE as an argument. Rules: see STYLE-GUIDE.md. */

/* ================================================================ palette (sRGB hex) */
export const PALETTE = {
  earthRed: '#BC5A33', earthOchre: '#D48A4B', earthDeep: '#963F24',
  road: '#D2743F', roadLine: '#E6A26E', sand: '#E8BA84',
  rockRed: '#9A4B32', rockGrey: '#8C7C72',
  leaf: '#8BA56E', leafDark: '#647E58', straw: '#D9B25A', strawBase: '#97924A',
  trunk: '#ECE1CD', trunkShade: '#B8A792', bark: '#7A5A44',
  shadow: '#5A4A7A', black: '#1C1C20', white: '#F1ECE2', steel: '#B9BCC0',
  yellow: '#FFC600', hazard: '#D8332A', canvas: '#6F7D4C', canvasTan: '#B98A55', blue: '#2F6FB4', flame: '#FF8A2A'
};
/* which swatches a pickup may use: the brand yellow is reserved for pickups and UI */
export const RESERVED = ['yellow'];

export function srgbToLinear(c) { return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
export function lin(hex) {
  const h = hex.replace('#', ''), v = parseInt(h, 16);
  return [srgbToLinear(((v >> 16) & 255) / 255), srgbToLinear(((v >> 8) & 255) / 255), srgbToLinear((v & 255) / 255)];
}
export const C = Object.fromEntries(Object.entries(PALETTE).map(([k, v]) => [k, lin(v)]));
export const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
export const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/* ================================================================ colour script: lighting moments, blended along the trail.
   Angles in degrees. sunAz is a world azimuth (0 = +Z, 90 = +X). Colours are sRGB hex, converted on use. */
export const MOMENTS = {
  golden: {
    sunAz: 128, sunEl: 15, sunCol: '#FFDCAA', sunI: 3.1, hemiSky: '#AEB8EC', hemiGround: '#C8714A', hemiI: 1.45,
    rim: '#FFC07A', rimI: 1.0, shadowK: 0.72,
    hazeSun: '#FFDDA8', hazeAnti: '#F6CDBA', fog: 0.0009,
    skySun: ['#FFE6B8', '#FFCF9C', '#D9CBD6', '#7CA6E2'], skyAnti: ['#FADCC4', '#F3C4BC', '#B3C6EA', '#6A9CE4'],
    disc: 0.035, discCol: '#FFF4D2', glow: 0.55, moon: 1, rays: 0, exposure: 1.06, cloudLit: '#FFE6C4', cloudBody: '#E8BCC4', mist: 0.0, fire: 0.0
  },
  sunset: {
    sunAz: 18, sunEl: 3.5, sunCol: '#FFA868', sunI: 2.6, hemiSky: '#9488CC', hemiGround: '#B0503A', hemiI: 1.2,
    rim: '#FF9A55', rimI: 1.4, shadowK: 0.88,
    hazeSun: '#FFB070', hazeAnti: '#C98EA6', fog: 0.0014,
    skySun: ['#FFC070', '#FF9460', '#E07A88', '#5F6FB0'], skyAnti: ['#D7909E', '#B47FA8', '#7E78B4', '#4F5E9E'],
    disc: 0.05, discCol: '#FFE2A0', glow: 1.0, moon: 0, rays: 1, exposure: 1.0, cloudLit: '#FFB27A', cloudBody: '#B2708F', mist: 0.1, fire: 0.0
  },
  dusk: {
    sunAz: 10, sunEl: -4, sunCol: '#C47AA8', sunI: 0.55, hemiSky: '#9690D4', hemiGround: '#7E5462', hemiI: 1.55,
    rim: '#E08AA0', rimI: 0.8, shadowK: 0.5,
    hazeSun: '#C9809A', hazeAnti: '#6C66A0', fog: 0.0022,
    skySun: ['#E89A90', '#B9789E', '#6E66A6', '#2E3A74'], skyAnti: ['#8A78A8', '#6A64A0', '#4A5090', '#26306A'],
    disc: 0.0, discCol: '#FFD0A0', glow: 0.35, moon: 1, rays: 0, exposure: 1.18, cloudLit: '#E7A0A0', cloudBody: '#6E5C90', mist: 0.35, fire: 1.0
  }
};
/* the drive's colour script: trail distance (m) -> moment. Blends smoothly between neighbours. */
/* long trail (05-style-test-long): golden 0-300 open country, sunset 300-600 gorge, dusk 600-900 open run into camp */
export const SCRIPT = [[0, 'golden'], [270, 'golden'], [350, 'sunset'], [580, 'sunset'], [660, 'dusk']];
const isHex = v => typeof v === 'string' && v[0] === '#';
function lerpVal(a, b, t) {
  if (isHex(a)) return mix3(lin(a), lin(b), t);
  if (Array.isArray(a)) return a.map((x, i) => lerpVal(x, b[i], t));
  if (typeof a === 'number') return a + (b - a) * t;
  return t < 0.5 ? a : b;
}
export function momentAt(s, script = SCRIPT) {
  let i = 0; while (i < script.length - 1 && s > script[i + 1][0]) i++;
  const [s0, n0] = script[i], [s1, n1] = script[Math.min(i + 1, script.length - 1)];
  let t = s1 > s0 ? Math.min(1, Math.max(0, (s - s0) / (s1 - s0))) : 0; t = t * t * (3 - 2 * t);
  const A = MOMENTS[n0], B = MOMENTS[n1], out = {};
  for (const k in A) out[k] = lerpVal(A[k], B[k], t);
  return out;
}
export function sunDirOf(m) {
  const az = m.sunAz * Math.PI / 180, el = m.sunEl * Math.PI / 180;
  return [Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)];
}

/* ================================================================ deterministic random + noise */
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export function hash2(x, y) { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); }
export function vnoise(x, y) { const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1); return (a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy) * 2 - 1; }
export function fbm(x, y, o = 3) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }
export const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* ================================================================ facet builder: triangle soup, one solid colour per face.
   fx per face = [mask, sway, rim, glow]: mask = receives baked long shadows, sway = foliage wobble weight, rim = rim-light
   weight, glow = emissive (1 = pickup glow, 2 = flame with flicker). */
export class Facets {
  constructor() { this.P = []; this.Cl = []; this.F = []; this.T = []; this.casters = []; }
  get tris() { return this.P.length / 9; }
  tri(a, b, c, col, fx = [1, 0, 0, 0], ref = null) {
    if (ref) { const n = cross(sub(b, a), sub(c, a)), m = [(a[0] + b[0] + c[0]) / 3 - ref[0], (a[1] + b[1] + c[1]) / 3 - ref[1], (a[2] + b[2] + c[2]) / 3 - ref[2]]; if (n[0] * m[0] + n[1] * m[1] + n[2] * m[2] < 0) { const t = b; b = c; c = t; } }
    this.P.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    for (let k = 0; k < 3; k++) { this.Cl.push(col[0], col[1], col[2]); this.F.push(fx[0], fx[1], fx[2], fx[3]); }
  }
  quad(a, b, c, d, col, fx, ref = null) { this.tri(a, b, c, col, fx, ref); this.tri(a, c, d, col, fx, ref); }
  /* copy another Facets through a transform (yaw about Y, uniform or per-axis scale, translation); trk(x,z) gives track coords */
  add(part, tr = {}, trk = null) {
    const { x = 0, y = 0, z = 0, yaw = 0, s = 1, tilt = 0 } = tr; const sx = Array.isArray(s) ? s[0] : s, sy = Array.isArray(s) ? s[1] : s, sz = Array.isArray(s) ? s[2] : s;
    const cy = Math.cos(yaw), syw = Math.sin(yaw), ct = Math.cos(tilt), st = Math.sin(tilt), P = part.P, base = this.P.length / 3;
    for (let i = 0; i < P.length; i += 3) {
      let px = P[i] * sx, py = P[i + 1] * sy, pz = P[i + 2] * sz;
      const ty = py * ct - pz * st, tz = py * st + pz * ct; py = ty; pz = tz;
      const wx = px * cy + pz * syw + x, wz = -px * syw + pz * cy + z, wy = py + y;
      this.P.push(wx, wy, wz);
    }
    for (const v of part.Cl) this.Cl.push(v); for (const v of part.F) this.F.push(v);
    if (trk) { for (let i = base * 3; i < this.P.length; i += 3) { const t = trk(this.P[i], this.P[i + 2]); this.T.push(t[0], t[1]); } }
    for (const c of part.casters) {
      const r = c.r * sx, px = c.p[0] * sx, pz = c.p[2] * sz;
      const q = [px * cy + pz * syw + x, c.p[1] * sy + y, -px * syw + pz * cy + z];
      const out = { ...c, p: q, r }; if (c.q) { const qx = c.q[0] * sx, qz = c.q[2] * sz; out.q = [qx * cy + qz * syw + x, c.q[1] * sy + y, -qx * syw + qz * cy + z]; }
      this.casters.push(out);
    }
    return this;
  }
  /* fill track coords for any vertex that has none (used by builders that add raw triangles) */
  fillTrk(trk) { for (let i = this.T.length / 2 * 3; i < this.P.length; i += 3) { const t = trk(this.P[i], this.P[i + 2]); this.T.push(t[0], t[1]); } }
}
/* to a three.js BufferGeometry (non-indexed, face normals = split normals everywhere) */
export function toGeometry(THREE, f) {
  const g = new THREE.BufferGeometry(), n = f.P.length / 3;
  g.setAttribute('position', new THREE.Float32BufferAttribute(f.P, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(f.Cl, 3));
  g.setAttribute('aFx', new THREE.Float32BufferAttribute(f.F, 4));
  const T = f.T.length === n * 2 ? f.T : new Array(n * 2).fill(-9999);
  g.setAttribute('aTrk', new THREE.Float32BufferAttribute(T, 2));
  g.computeVertexNormals(); g.computeBoundingSphere(); g.computeBoundingBox();
  /* degenerate faces get an up normal (a zero normal normalises to NaN, and bloom spreads one NaN pixel over the screen) */
  { const N = g.attributes.normal.array; for (let i = 0; i < N.length; i += 3) if (!(Math.abs(N[i]) + Math.abs(N[i + 1]) + Math.abs(N[i + 2]) > 1e-6)) { N[i] = 0; N[i + 1] = 1; N[i + 2] = 0; } }
  return g;
}

/* ================================================================ primitives (local space) */
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const faceN = (a, b, c) => norm(cross(sub(b, a), sub(c, a)));
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const jit = (r, k) => 1 + (r() - 0.5) * 2 * k;
/* icosphere cache */
const ICO = {};
function icosphere(detail) {
  if (ICO[detail]) return ICO[detail];
  const t = (1 + Math.sqrt(5)) / 2; let V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(norm);
  let Fc = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let d = 0; d < detail; d++) {
    const mid = {}, F2 = [];
    const m = (a, b) => { const k = a < b ? a + '_' + b : b + '_' + a; if (mid[k] === undefined) { V.push(norm([(V[a][0] + V[b][0]) / 2, (V[a][1] + V[b][1]) / 2, (V[a][2] + V[b][2]) / 2])); mid[k] = V.length - 1; } return mid[k]; };
    for (const [a, b, c] of Fc) { const ab = m(a, b), bc = m(b, c), ca = m(c, a); F2.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]); }
    Fc = F2;
  }
  return (ICO[detail] = { V, F: Fc });
}
/* faceted blob: jittered icosphere, squashed, flattened underside. col(faceNormal, centroid) -> colour */
export function blob(f, r, o) {
  const { c = [0, 0, 0], rad = 1, sy = 1, detail = 1, j = 0.18, flat = -0.55, col, fx } = o;
  const { V, F } = icosphere(detail);
  const P = V.map((v, i) => { const k = jit(() => hash2(i * 1.7 + c[0] * 3.1 + c[2] * 1.3, i * 0.9 + c[1] * 2.7 + rad), j); let y = v[1] * sy * k; if (v[1] < flat) y = flat * sy * (0.92 + 0.08 * k); return [c[0] + v[0] * rad * k, c[1] + y * rad, c[2] + v[2] * rad * k]; });
  for (const [a, b, d] of F) { const A = P[a], B = P[b], D = P[d], n = faceN(A, B, D), cen = [(A[0] + B[0] + D[0]) / 3, (A[1] + B[1] + D[1]) / 3, (A[2] + B[2] + D[2]) / 3]; const no = dot3(n, sub(cen, c)) < 0 ? [-n[0], -n[1], -n[2]] : n; f.tri(A, B, D, col(no, cen, r), fx, c); }
}
/* tapered tube through points with radii; sides >= 4; optional cap at the end */
export function tube(f, pts, radii, sides, col, fx, capEnd = true, capStart = false) {
  const rings = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], tA = i < pts.length - 1 ? sub(pts[i + 1], p) : sub(p, pts[i - 1]), tB = i > 0 ? sub(p, pts[i - 1]) : tA;
    const t = norm([tA[0] + tB[0], tA[1] + tB[1], tA[2] + tB[2]]);
    const up = Math.abs(t[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0], u = norm(cross(t, up)), v = cross(u, t);
    const ring = []; for (let k = 0; k < sides; k++) { const a = (k / sides) * Math.PI * 2 + i * 0.35; ring.push([p[0] + (u[0] * Math.cos(a) + v[0] * Math.sin(a)) * radii[i], p[1] + (u[1] * Math.cos(a) + v[1] * Math.sin(a)) * radii[i], p[2] + (u[2] * Math.cos(a) + v[2] * Math.sin(a)) * radii[i]]); }
    rings.push(ring);
  }
  for (let i = 0; i < rings.length - 1; i++) for (let k = 0; k < sides; k++) {
    const a = rings[i][k], b = rings[i][(k + 1) % sides], c = rings[i + 1][(k + 1) % sides], d = rings[i + 1][k];
    const cen = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2];
    const ref = [(pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2, (pts[i][2] + pts[i + 1][2]) / 2];
    f.quad(a, d, c, b, col(i, k, cen), fx, ref);
  }
  const cap = (ring, p, i, ref) => { for (let k = 0; k < sides; k++) { const a = ring[k], b = ring[(k + 1) % sides]; f.tri(p, a, b, col(i, -1, p), fx, ref); } };
  if (capEnd) cap(rings[rings.length - 1], pts[pts.length - 1], pts.length - 1, pts[pts.length - 2]);
  if (capStart) cap(rings[0], pts[0], 0, pts[1]);
}
/* lofted rings around the Y axis: rings = [{y, r, n?}] with the same side count; radial jitter by seed; flat top cap */
export function loft(f, rings, sides, col, fx, seed = 1, j = 0.12, top = true) {
  const R = rings.map((rg, i) => { const out = []; for (let k = 0; k < sides; k++) { const a = (k / sides) * Math.PI * 2 + (rg.rot || 0); const kk = 1 + (hash2(seed + k * 3.3, i * 7.1 + seed) - 0.5) * 2 * j; out.push([Math.cos(a) * rg.r * kk * (rg.sx || 1), rg.y, Math.sin(a) * rg.r * kk * (rg.sz || 1)]); } return out; });
  for (let i = 0; i < R.length - 1; i++) for (let k = 0; k < sides; k++) {
    const a = R[i][k], b = R[i][(k + 1) % sides], c = R[i + 1][(k + 1) % sides], d = R[i + 1][k];
    const ref = [0, (rings[i].y + rings[i + 1].y) / 2, 0], n0 = faceN(a, d, c), cen = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2, (a[2] + c[2]) / 2];
    const no = dot3(n0, sub(cen, ref)) < 0 ? [-n0[0], -n0[1], -n0[2]] : n0;
    f.quad(a, d, c, b, col(i, k, no), fx, ref);
  }
  if (top) { const L = R[R.length - 1], cy = rings[rings.length - 1].y + (rings[rings.length - 1].dome || 0); const p = [0, cy, 0]; for (let k = 0; k < sides; k++) f.tri(p, L[(k + 1) % sides], L[k], col(R.length - 1, k, [0, 1, 0]), fx, [0, cy - 5, 0]); }
}
/* bevelled block centred at c, size w,h,d, bevel b (chamfered edges and corners via a two-level loft along Y) */
export function bevelBox(f, c, w, h, d, b, col, fx) {
  const oct = (hw, hd, bb) => [[hw - bb, -hd], [hw, -hd + bb], [hw, hd - bb], [hw - bb, hd], [-hw + bb, hd], [-hw, hd - bb], [-hw, -hd + bb], [-hw + bb, -hd]];
  const lv = [[-h / 2, oct(w / 2 - b, d / 2 - b, b * 0.7)], [-h / 2 + b, oct(w / 2, d / 2, b)], [h / 2 - b, oct(w / 2, d / 2, b)], [h / 2, oct(w / 2 - b, d / 2 - b, b * 0.7)]];
  const P = lv.map(([y, ring]) => ring.map(([x, z]) => [c[0] + x, c[1] + y, c[2] + z]));
  for (let i = 0; i < 3; i++) for (let k = 0; k < 8; k++) { const a = P[i][k], bb = P[i][(k + 1) % 8], cc = P[i + 1][(k + 1) % 8], dd = P[i + 1][k]; { const n0 = faceN(a, dd, cc), cen = [(a[0] + cc[0]) / 2, (a[1] + cc[1]) / 2, (a[2] + cc[2]) / 2], no = dot3(n0, sub(cen, c)) < 0 ? [-n0[0], -n0[1], -n0[2]] : n0; f.quad(a, dd, cc, bb, col(no), fx, c); } }
  const capT = P[3], capB = P[0], ct = [c[0], c[1] + h / 2, c[2]], cb = [c[0], c[1] - h / 2, c[2]];
  for (let k = 0; k < 8; k++) { f.tri(ct, capT[(k + 1) % 8], capT[k], col([0, 1, 0]), fx, c); f.tri(cb, capB[k], capB[(k + 1) % 8], col([0, -1, 0]), fx, c); }
}
/* generic oriented bevelled bar from p to q (square-ish section s), used for posts, frames and lattice */
export function bar(f, p, q, s, col, fx, sides = 4) { tube(f, [p, q], [s, s], sides, () => col, fx, true, true); }

/* ================================================================ shading helpers: solid colour per face, baked AO by height */
const lit = (c, n, k = 0.06) => shade(c, 1 + n[1] * k);
const ao = (c, y, h) => shade(c, 0.72 + 0.28 * smooth(0, h, y));
const vary = (c, r, k = 0.05) => shade(c, 1 + (r() - 0.5) * 2 * k);

/* ================================================================ props. Each returns a Facets in local space (base at y=0)
   with shadow casters (sphere: {p, r}; capsule: {p, q, r}) for the long-shadow baker. */
export function gum(seed = 1, variant = 0, lod = 0) {
  const r = rng(seed * 977 + variant * 31), f = new Facets();
  const H = variant === 0 ? 8.5 + r() * 2.5 : variant === 1 ? 6.2 + r() * 1.5 : 4.2 + r() * 1.0;
  const hf = variant === 1 ? 1.5 + r() * 0.5 : H * (0.26 + r() * 0.08), r0 = variant === 2 ? 0.24 : variant === 1 ? 0.42 : 0.36;
  const lean = (r() - 0.5) * 0.5, base = [0, 0, 0], fork = [lean, hf, (r() - 0.5) * 0.3];
  const trunkCol = (i, k, cen) => { const c = (k + i) % 5 === 0 ? C.trunkShade : C.trunk; return ao(c, cen[1], 2.2); };
  tube(f, [base, [lean * 0.4, hf * 0.5, 0], fork], [r0 * 1.25, r0 * 0.95, r0 * 0.78], 6, trunkCol, [1, 0, 0, 0], false);
  f.casters.push({ p: base, q: fork, r: r0 });
  const limbs = variant === 2 ? 2 : 3, ends = [];
  for (let i = 0; i < limbs; i++) {
    const a = (i / limbs) * Math.PI * 2 + r() * 1.2, spread = variant === 1 ? 2.6 + r() : 1.1 + r() * 0.9;
    const mid = [fork[0] + Math.cos(a) * spread * 0.55, hf + (H - hf) * 0.4, fork[2] + Math.sin(a) * spread * 0.55];
    const end = [fork[0] + Math.cos(a) * spread, hf + (H - hf) * (0.7 + r() * 0.1), fork[2] + Math.sin(a) * spread];
    tube(f, [fork, mid, end], [r0 * 0.66, r0 * 0.5, r0 * 0.34], 5, trunkCol, [1, 0, 0, 0]);
    f.casters.push({ p: fork, q: end, r: r0 * 0.5 }); ends.push(end);
  }
  /* canopy: fat clustered blobs, grey-green, darker underside faces, warm rim, sway */
  const leafCol = (n, cen, rr) => { const c = n[1] < -0.25 ? C.leafDark : (rr() < 0.2 ? shade(C.leaf, 1.08) : C.leaf); return vary(lit(c, n, 0.1), rr, 0.05); };
  for (const e of ends) {
    const nb = variant === 2 ? 3 : 4;
    for (let k = 0; k < nb; k++) {
      const rad = (variant === 2 ? 0.8 : variant === 1 ? 1.25 : 1.05) * (0.75 + r() * 0.5);
      const cc = [e[0] + (r() - 0.5) * 1.9, e[1] - 0.9 + k * 0.75 + r() * 0.5, e[2] + (r() - 0.5) * 1.9];
      blob(f, r, { c: cc, rad, sy: 0.82, detail: lod ? 0 : 1, j: lod ? 0.12 : 0.2, flat: -0.6, col: leafCol, fx: [0, 1, 1, 0] });
      f.casters.push({ p: cc, r: rad * 0.95, sy: 0.82 });
    }
  }
  return f;
}
export function spinifex(seed = 1, variant = 0, lod = 0) {
  const r = rng(seed * 131 + variant * 7), f = new Facets();
  const R = variant === 2 ? 0.55 : 0.7 + r() * 0.35, N = Math.round((variant === 2 ? 16 : 22 + Math.floor(r() * 6)) * (lod ? 0.45 : 1));
  /* olive core dome */
  if (variant !== 1) blob(f, r, { c: [0, 0.05, 0], rad: R * 0.7, sy: 0.55, detail: 0, j: 0.1, flat: -0.2, col: (n) => lit(C.strawBase, n, 0.15), fx: [1, 0, 0, 0] });
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + r() * 0.4, ring = variant === 1 ? 0.75 + r() * 0.25 : r() * 0.9;
    const bx = Math.cos(a) * R * ring * 0.8, bz = Math.sin(a) * R * ring * 0.8;
    const len = (variant === 2 ? 0.75 : 0.5) + r() * 0.35, out = 0.35 + ring * 0.55;
    const tip = [bx + Math.cos(a) * len * out, len * (1 - out * 0.45), bz + Math.sin(a) * len * out];
    const w = 0.09 + r() * 0.03, b0 = [bx + Math.cos(a + 1.6) * w, 0, bz + Math.sin(a + 1.6) * w], b1 = [bx + Math.cos(a - 1.6) * w, 0, bz + Math.sin(a - 1.6) * w], b2 = [bx - Math.cos(a) * w, 0.02, bz - Math.sin(a) * w];
    const cs = r() < 0.25 ? shade(C.straw, 1.1) : C.straw, cb = mix3(C.strawBase, C.straw, 0.4);
    const rf = [bx, len * 0.2, bz]; f.tri(b0, tip, b1, cs, [1, 0.35, 0.5, 0], rf); f.tri(b1, tip, b2, cb, [1, 0.35, 0.5, 0], rf); f.tri(b2, tip, b0, cs, [1, 0.35, 0.5, 0], rf);
  }
  f.casters.push({ p: [0, R * 0.35, 0], r: R * 0.8, sy: 0.5 });
  return f;
}
export function termite(seed = 1, variant = 0) {
  const r = rng(seed * 53 + variant), f = new Facets(), H = variant === 0 ? 2.4 + r() * 1.1 : 1.1 + r() * 0.4, W = variant === 0 ? 0.75 : 0.85;
  const col = (i, k, n) => ao(lit(k % 3 === 0 ? C.earthRed : C.earthDeep, n, 0.12), i, 2);
  loft(f, [{ y: -0.1, r: W * 1.15 }, { y: H * 0.2, r: W }, { y: H * 0.45, r: W * 0.78 }, { y: H * 0.7, r: W * 0.55 }, { y: H * 0.9, r: W * 0.32 }, { y: H, r: W * 0.14 }], 7, col, [1, 0, 0, 0], seed, 0.18);
  if (variant === 0) { const g = new Facets(); loft(g, [{ y: 0, r: 0.42 }, { y: H * 0.35, r: 0.3 }, { y: H * 0.62, r: 0.12 }], 6, col, [1, 0, 0, 0], seed + 9, 0.2); f.add(g, { x: W * 0.55, z: 0.2, s: 1 }); }
  f.casters.push({ p: [0, 0, 0], q: [0, H * 0.85, 0], r: W * 0.7 });
  return f;
}
export function rock(seed = 1, variant = 0, tint = 'rockRed') {
  const r = rng(seed * 17 + variant * 5), f = new Facets(), base = C[tint];
  const col = (n) => { const c = n[1] > 0.55 ? mix3(base, C.earthOchre, 0.35) : n[1] < -0.2 ? shade(base, 0.7) : base; return vary(lit(c, n, 0.1), r, 0.06); };
  if (variant === 0) blob(f, r, { c: [0, 0.38, 0], rad: 0.62, sy: 0.75, detail: 1, j: 0.2, flat: -0.45, col, fx: [1, 0, 0, 0] });
  else if (variant === 1) blob(f, r, { c: [0, 0.18, 0], rad: 0.95, sy: 0.32, detail: 0, j: 0.22, flat: -0.3, col, fx: [1, 0, 0, 0] });
  else blob(f, r, { c: [0, 0.62, 0], rad: 0.5, sy: 1.5, detail: 0, j: 0.25, flat: -0.55, col, fx: [1, 0, 0, 0] });
  f.casters.push({ p: [0, variant === 2 ? 0.6 : 0.3, 0], r: variant === 1 ? 0.8 : 0.55, sy: variant === 2 ? 1.4 : 0.7 });
  return f;
}
export function log(seed = 1) {
  const r = rng(seed * 7 + 3), f = new Facets(), L = 4.2 + r() * 1.4, R = 0.3;
  const col = (i, k) => k === -1 ? C.trunk : (k % 3 === 0 ? C.trunkShade : shade(C.trunkShade, 0.88));
  tube(f, [[-L / 2, R * 0.8, 0], [0, R * 0.85, 0.12], [L / 2, R * 0.75, 0]], [R, R * 0.92, R * 0.8], 6, col, [1, 0, 0, 0], true, true);
  tube(f, [[L * 0.15, R, 0.1], [L * 0.25, R + 0.7, 0.45]], [0.13, 0.08], 5, col, [1, 0, 0, 0]);
  tube(f, [[-L * 0.3, R, -0.1], [-L * 0.42, R + 0.35, -0.75]], [0.12, 0.08], 5, col, [1, 0, 0, 0]);
  f.casters.push({ p: [-L / 2, R, 0], q: [L / 2, R, 0], r: R });
  return f;
}
export function pebble(seed = 1) { const r = rng(seed), f = new Facets(); blob(f, r, { c: [0, 0.04, 0], rad: 0.1, sy: 0.6, detail: 0, j: 0.3, flat: -0.3, col: (n) => vary(lit(r() < 0.5 ? C.rockRed : C.earthDeep, n, 0.12), r, 0.08), fx: [1, 0, 0, 0] }); return f; }
/* mesa / butte / ridge piece with strata bands; big facets (far away) */
export function mesa(seed = 1, variant = 0) {
  const r = rng(seed * 29 + variant), f = new Facets(), Hh = variant === 1 ? 70 : 38 + r() * 14, R = variant === 1 ? 26 : 60 + r() * 25;
  const band = [C.earthRed, C.earthOchre, C.earthDeep, C.earthRed];
  const col = (i, k, n) => lit(i === 0 ? shade(C.earthDeep, 0.95) : band[i % 4], n, 0.05);
  const sx = variant === 2 ? 2.6 : 1, sz = variant === 2 ? 0.7 : 1;
  loft(f, [{ y: -6, r: R * 1.3, sx, sz }, { y: Hh * 0.3, r: R * 0.95, sx, sz }, { y: Hh * 0.55, r: R * 0.8, sx, sz }, { y: Hh * 0.82, r: R * 0.74, sx, sz }, { y: Hh, r: R * 0.7, sx, sz }], 11, col, [0, 0, 0.3, 0], seed, 0.1);
  return f;
}

/* ---------------------------------------------------------------- gameplay pieces (pickups glow; yellow only here and in UI) */
/* camp-gear pickups at TRUE size (the same generators, without the ring, go in the tub, so a collected piece never changes size):
   swag 1.0 m long x 0.35 m across, esky 0.6 x 0.4 x 0.4 m, jerry can 0.35 x 0.17 x 0.47 m, firewood bundle 0.5 m long x 0.3 m across.
   Place at PICKUP_SCALE (1.1, the readability allowance, at most 1.15). The ground ring is sized so its diameter is 1.2 m at that scale. */
export const PICKUP_SCALE = 1.1;
function glowRing(f, rad = 0.6 / PICKUP_SCALE) {
  const n = 16, w = 0.07, out = [], inn = [];
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2; out.push([Math.cos(a) * rad, 0.03, Math.sin(a) * rad]); inn.push([Math.cos(a) * (rad - w), 0.03, Math.sin(a) * (rad - w)]); }
  for (let k = 0; k < n; k++) { const k2 = (k + 1) % n; f.quad(out[k], inn[k], inn[k2], out[k2], C.yellow, [0, 0, 0, 1.6], [0, -1, 0]); }
}
export function swag(glow = true) {
  const f = new Facets(), R = 0.175, roll = (i, k) => k === -1 ? C.hazard : (k % 2 ? C.canvas : shade(C.canvas, 0.9));
  tube(f, [[-0.5, R, 0], [0.5, R, 0]], [R, R], 10, roll, [1, 0, 0, 0], true, true);
  for (const x of [-0.28, 0.28]) tube(f, [[x - 0.03, R, 0], [x + 0.03, R, 0]], [R + 0.012, R + 0.012], 10, () => C.bark, [1, 0, 0, 0], true, true);
  if (glow) glowRing(f); return f;
}
export function esky(glow = true) {
  const f = new Facets();
  bevelBox(f, [0, 0.16, 0], 0.6, 0.32, 0.4, 0.03, (n) => lit(C.white, n, 0.05), [1, 0, 0, 0]);
  bevelBox(f, [0, 0.355, 0], 0.62, 0.07, 0.42, 0.02, (n) => lit(C.blue, n, 0.05), [1, 0, 0, 0]);
  bevelBox(f, [0, 0.405, 0], 0.28, 0.03, 0.05, 0.01, () => C.white, [1, 0, 0, 0]);
  if (glow) glowRing(f); return f;
}
export function jerry(glow = true) {
  const f = new Facets();
  bevelBox(f, [0, 0.2, 0], 0.17, 0.4, 0.35, 0.025, (n) => lit(C.canvas, n, 0.05), [1, 0, 0, 0]);
  bevelBox(f, [0, 0.43, -0.1], 0.06, 0.06, 0.06, 0.01, () => C.black, [1, 0, 0, 0]);
  bevelBox(f, [0, 0.43, 0.07], 0.12, 0.05, 0.14, 0.012, () => shade(C.canvas, 0.8), [1, 0, 0, 0]);
  if (glow) glowRing(f); return f;
}
export function firewood(glow = true) {
  const f = new Facets(), end = (i, k) => k === -1 ? C.sand : C.bark, r = 0.072;
  const L = [[-0.075, r], [0.075, r], [-0.075, r * 3], [0.075, r * 3], [0, r * 4.6]];
  for (const [x, y] of L) tube(f, [[x, y, -0.25], [x, y, 0.25]], [r, r], 6, end, [1, 0, 0, 0], true, true);
  tube(f, [[0, 0.2, -0.02], [0, 0.2, 0.02]], [0.19, 0.19], 8, () => C.black, [1, 0, 0, 0], true, true);
  if (glow) glowRing(f); return f;
}
export function hazardMarker() {
  const f = new Facets();
  for (let i = 0; i < 6; i++) bevelBox(f, [0, 0.25 + i * 0.42, 0], 0.18, 0.42, 0.18, 0.025, () => (i % 2 ? C.white : C.hazard), [1, 0, 0, 0]);
  bevelBox(f, [0, 2.62, 0.1], 0.14, 0.24, 0.04, 0.015, () => C.hazard, [1, 0, 0, 0.8]);
  f.casters.push({ p: [0, 0, 0], q: [0, 2.6, 0], r: 0.1 });
  return f;
}
export function rockFall(seed = 1) {
  const f = new Facets(), r = rng(seed);
  for (let i = 0; i < 7; i++) { const g = rock(seed + i, i % 3 === 1 ? 0 : i % 3, 'rockGrey'); const s = 0.7 + r() * 1.1; f.add(g, { x: (r() - 0.2) * 3.5, z: (r() - 0.5) * 2.2, yaw: r() * 6, s }); }
  for (let i = 0; i < 16; i++) f.add(pebble(seed * 3 + i), { x: (r() - 0.3) * 4, z: (r() - 0.5) * 3, yaw: r() * 6, s: 1 + r() * 1.5 });
  return f;
}
/* roadside sign: black board, white tent and arrow shapes, no lettering and no brand */
export function campSign() {
  const f = new Facets(), fx = [1, 0, 0, 0];
  /* posts behind the board (board face at z = +0.05, posts z -0.2..-0.06), sunk 35 cm, ending 15 cm under the board's top edge */
  for (const x of [-0.75, 0.75]) bevelBox(f, [x, 0.9, -0.13], 0.14, 2.5, 0.14, 0.02, () => C.trunkShade, fx);
  bevelBox(f, [0, 1.75, 0], 2.1, 1.1, 0.1, 0.03, (n) => lit(C.black, n, 0.2), fx);
  const z = 0.075, o = [0, 1.7, -1]; f.tri([-0.75, 1.42, z], [-0.15, 1.42, z], [-0.45, 2.0, z], C.white, fx, o);
  f.tri([0.15, 1.62, z], [0.55, 1.62, z], [0.55, 1.78, z], C.white, fx, o); f.tri([0.15, 1.62, z], [0.55, 1.78, z], [0.15, 1.78, z], C.white, fx, o);
  f.tri([0.55, 1.5, z], [0.8, 1.7, z], [0.55, 1.9, z], C.white, fx, o);
  f.casters.push({ p: [0, 0, 0], q: [0, 1.8, 0], r: 0.6 });
  return f;
}
/* ---------------------------------------------------------------- camp set */
export function tent() {
  const f = new Facets(), fx = [1, 0, 0.3, 0];
  const col = (i, k, n) => lit(k % 2 ? C.canvasTan : shade(C.canvasTan, 0.9), n, 0.08);
  loft(f, [{ y: 0, r: 1.25, sx: 1.0, sz: 0.92 }, { y: 0.55, r: 1.15, sx: 1.0, sz: 0.92 }, { y: 1.0, r: 0.78, sx: 1.0, sz: 0.92 }, { y: 1.3, r: 0.3, sx: 1.0, sz: 0.92, dome: 0.05 }], 8, col, fx, 5, 0.0);
  /* door: a dark flat panel proud of the front facet */
  const z = 1.08; f.quad([-0.42, 0.04, z], [0.42, 0.04, z], [0.3, 0.95, z * 0.78], [-0.3, 0.95, z * 0.78], C.black, fx, [0, 0.5, 0]);
  /* fly sheet ridge pole and two pegged guy poles */
  bar(f, [-1.35, 1.32, 0], [1.35, 1.32, 0], 0.035, C.steel, fx);
  for (const x of [-1.6, 1.6]) bar(f, [x, 0, 0], [x * 0.84, 1.32, 0], 0.035, C.steel, fx);
  f.casters.push({ p: [0, 0.6, 0], r: 1.2, sy: 0.6 });
  return f;
}
export function campfire(seed = 2) {
  const f = new Facets(), r = rng(seed);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; f.add(rock(seed + i, 0, 'rockGrey'), { x: Math.cos(a) * 0.62, z: Math.sin(a) * 0.62, s: 0.32, yaw: r() * 6 }); }
  for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + 0.4; tube(f, [[Math.cos(a) * 0.5, 0.08, Math.sin(a) * 0.5], [Math.cos(a) * 0.05, 0.42, Math.sin(a) * 0.05]], [0.09, 0.08], 5, () => C.bark, [1, 0, 0, 0]); }
  const flame = [C.flame, C.yellow];
  for (let i = 0; i < 3; i++) loft(f, [{ y: 0.15, r: 0.32 - i * 0.08 }, { y: 0.55 + i * 0.12, r: 0.2 - i * 0.05 }, { y: 0.95 + i * 0.15, r: 0.02 }], 5, () => flame[i === 2 ? 1 : 0], [0, 0.5, 0, 2.0 + i * 0.2], seed + i, 0.25, false);
  return f;
}
export function flames(seed = 2) {
  const f = new Facets(), flame = [C.flame, C.yellow];
  for (let i = 0; i < 3; i++) loft(f, [{ y: 0.15, r: 0.3 - i * 0.08 }, { y: 0.55 + i * 0.12, r: 0.19 - i * 0.05 }, { y: 0.95 + i * 0.15, r: 0.02 }], 5, () => flame[i === 2 ? 1 : 0], [0, 0.5, 0, 2.0 + i * 0.2], seed + i, 0.25, false);
  return f;
}
export function chair(seed = 1, black = false) {
  const f = new Facets(), fx = [1, 0, 0, 0], frame = () => C.steel, seat = (n) => lit(black ? C.black : seed % 2 ? C.blue : C.hazard, n, black ? 0.3 : 0.1);
  for (const [x, z] of [[-0.28, -0.25], [0.28, -0.25], [-0.28, 0.25], [0.28, 0.25]]) bar(f, [x, 0, z], [x * 0.9, 0.45, z * 0.6], 0.035, C.steel, fx);
  bevelBox(f, [0, 0.47, 0], 0.62, 0.08, 0.56, 0.03, seat, fx);
  bevelBox(f, [0, 0.82, -0.3], 0.62, 0.62, 0.08, 0.03, seat, fx);
  for (const x of [-0.33, 0.33]) bar(f, [x, 0.47, 0.25], [x, 0.66, 0.15], 0.03, C.steel, fx);
  f.casters.push({ p: [0, 0.5, 0], r: 0.4 });
  return f;
}
/* ---------------------------------------------------------------- station pieces */
export function windmillTower(blackVane = false) {
  const f = new Facets(), fx = [1, 0, 0, 0], H = 9.5, B = 1.4, T = 0.35;
  const legs = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (const [x, z] of legs) bar(f, [x * B, 0, z * B], [x * T, H, z * T], 0.07, C.steel, fx);
  for (let i = 1; i < 5; i++) { const y = (i / 5) * H, w = B + (T - B) * (i / 5); for (let k = 0; k < 4; k++) { const [x0, z0] = legs[k], [x1, z1] = legs[(k + 1) % 4]; bar(f, [x0 * w, y, z0 * w], [x1 * w, y, z1 * w], 0.05, C.steel, fx); } }
  bevelBox(f, [0, H + 0.2, 0], 0.5, 0.5, 0.9, 0.05, () => shade(C.steel, 0.8), fx);
  bevelBox(f, [0, H + 0.3, -1.5], 0.06, 0.9, 1.6, 0.02, () => (blackVane ? C.black : C.hazard), fx);
  f.casters.push({ p: [0, 0, 0], q: [0, H, 0], r: 0.6 });
  return f;
}
export function windmillRotor() {
  const f = new Facets(), fx = [1, 0, 0, 0], n = 12;
  for (let k = 0; k < n; k++) { const a = (k / n) * Math.PI * 2, a2 = a + 0.2, r0 = 0.35, r1 = 2.0;
    const q = [[Math.cos(a) * r0, Math.sin(a) * r0, 0], [Math.cos(a) * r1, Math.sin(a) * r1, 0.08], [Math.cos(a2) * r1, Math.sin(a2) * r1, -0.08], [Math.cos(a2) * r0, Math.sin(a2) * r0, 0]];
    f.quad(q[0], q[1], q[2], q[3], k % 2 ? C.steel : shade(C.steel, 0.85), fx, [0, 0, -1]); f.quad(q[0], q[1], q[2], q[3], shade(C.steel, 0.7), fx, [0, 0, 1]); }
  tube(f, [[0, 0, -0.2], [0, 0, 0.25]], [0.32, 0.2], 8, () => shade(C.steel, 0.7), fx, true, true);
  return f;
}
export function waterTank() {
  const f = new Facets(), fx = [1, 0, 0, 0];
  for (const [x, z] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) bar(f, [x * 1.1, 0, z * 1.1], [x * 1.1, 1.6, z * 1.1], 0.09, C.bark, fx);
  bevelBox(f, [0, 1.65, 0], 2.8, 0.14, 2.8, 0.03, () => C.bark, fx);
  loft(f, [{ y: 1.72, r: 1.35 }, { y: 2.2, r: 1.35 }, { y: 2.7, r: 1.35 }, { y: 3.2, r: 1.35 }, { y: 3.7, r: 1.35 }, { y: 3.95, r: 1.0, dome: 0.25 }], 14, (i, k, n) => lit(i % 2 ? C.steel : shade(C.steel, 0.9), n, 0.1), fx, 3, 0.0);
  f.casters.push({ p: [0, 2.7, 0], r: 1.5 });
  return f;
}
export function stationGate() {
  const f = new Facets(), fx = [1, 0, 0, 0];
  /* posts sunk 40 cm and running up into the cross beam (nothing floating) */
  /* overhead station arch: the beam sits above the game camera (5.3 m), so it never draws as a bar across the frame */
  for (const x of [-5.7, 5.7]) bevelBox(f, [x, 2.45, 0], 0.3, 5.7, 0.3, 0.04, () => C.trunkShade, fx);
  bevelBox(f, [0, 5.3, 0], 11.8, 0.22, 0.22, 0.04, () => C.trunkShade, fx);
  if (!globalThis.__TC_GAME) {
  /* cattle grid: steel rails across the road over a dark pit whose top sits 4 cm above the road (no z-fighting) */
  bevelBox(f, [0, -0.025, 0], 7.4, 0.05, 2.4, 0.01, () => C.black, fx);
  for (let i = 0; i < 9; i++) bevelBox(f, [0, 0.01, -1.1 + i * 0.275], 7.4, 0.04, 0.09, 0.012, () => shade(mix3(C.steel, C.rockRed, 0.45), 0.7), fx);
  }
  f.casters.push({ p: [-5.7, 0, 0], q: [-5.7, 5.2, 0], r: 0.18 }, { p: [5.7, 0, 0], q: [5.7, 5.2, 0], r: 0.18 }, { p: [-5.7, 5.3, 0], q: [5.7, 5.3, 0], r: 0.12 });
  return f;
}
/* ---------------------------------------------------------------- life */
export function roo() {
  const f = new Facets(), fx = [0, 0, 0.6, 0], c = (n) => lit(C.earthOchre, n, 0.15);
  blob(f, rng(5), { c: [0, 0.75, 0], rad: 0.42, sy: 1.3, detail: 0, j: 0.05, flat: -0.9, col: c, fx });
  blob(f, rng(6), { c: [0, 1.32, 0.28], rad: 0.17, sy: 1.1, detail: 0, j: 0.05, flat: -0.9, col: c, fx });
  tube(f, [[0, 0.5, -0.25], [0, 0.18, -0.9]], [0.12, 0.05], 4, () => C.earthOchre, fx);
  tube(f, [[0, 0.45, 0.05], [0, 0.05, 0.25]], [0.13, 0.07], 4, () => C.earthOchre, fx);
  for (const sx of [1, -1]) { const a = [0.05 * sx, 1.42, 0.25], b = [0.1 * sx, 1.62, 0.2], c = [0.02 * sx, 1.45, 0.18]; f.tri(a, b, c, C.earthOchre, fx, [0, 1.5, 0.5]); f.tri(a, b, c, C.earthOchre, fx, [0, 1.5, -0.5]); }
  return f;
}
export function tumbleweed(seed = 4) { const f = new Facets(), r = rng(seed); blob(f, r, { c: [0, 0, 0], rad: 0.45, sy: 0.9, detail: 1, j: 0.25, flat: -2, col: (n) => vary(r() < 0.5 ? C.straw : C.strawBase, r, 0.08), fx: [0, 0, 0.4, 0] }); return f; }

/* ================================================================ kit pieces from CC0 packs (Kenney Nature Kit): a loaded glTF scene
   becomes a Facets in our palette (recolour by material name), base at y=0, centred, with a size and a bounding caster */
export const KENNEY_COLOURS = {
  dirt: 'rockRed', stone: 'rockGrey', _defaultMat: 'rockRed', woodBark: 'trunkShade', woodInner: 'sand', wood: 'canvasTan', woodDark: 'bark',
  colorRed: 'canvasTan', leafsGreen: 'leaf'
};
export function facetsFromScene(root, name = '', opt = {}) {
  root.updateMatrixWorld(true);
  const f = new Facets(), r = rng(name.length * 97 + 13), plant = /plant|grass|bush/.test(name), rocky = /rock|stone/.test(name);
  const colOf = (mat, n) => {
    let key = KENNEY_COLOURS[mat] || 'rockRed';
    if (mat === 'grass') key = plant ? 'leafDark' : 'earthOchre';
    let c = C[key];
    if (rocky && n[1] > 0.6) c = mix3(c, C.earthOchre, 0.3);
    return vary(lit(c, n, 0.08), r, 0.05);
  };
  const fx = plant ? [1, 0.6, 0.6, 0] : [1, 0, 0, 0];
  root.traverse(o => {
    if (!o.isMesh) return; const g = o.geometry, P = g.attributes.position, I = g.index, e = o.matrixWorld.elements, mat = (o.material && o.material.name) || '';
    const v = i => { const x = P.getX(i), y = P.getY(i), z = P.getZ(i); return [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]; };
    const groups = g.groups && g.groups.length ? g.groups : [{ start: 0, count: I ? I.count : P.count, materialIndex: 0 }];
    for (const gr of groups) {
      const m = Array.isArray(o.material) ? o.material[gr.materialIndex] : o.material, mn = (m && m.name) || mat;
      for (let k = gr.start; k < gr.start + gr.count; k += 3) { const a = v(I ? I.getX(k) : k), b = v(I ? I.getX(k + 1) : k + 1), c = v(I ? I.getX(k + 2) : k + 2); f.tri(a, b, c, colOf(mn, faceN(a, b, c)), fx); }
    }
  });
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < f.P.length; i += 3) { x0 = Math.min(x0, f.P[i]); x1 = Math.max(x1, f.P[i]); y0 = Math.min(y0, f.P[i + 1]); y1 = Math.max(y1, f.P[i + 1]); z0 = Math.min(z0, f.P[i + 2]); z1 = Math.max(z1, f.P[i + 2]); }
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2; for (let i = 0; i < f.P.length; i += 3) { f.P[i] -= cx; f.P[i + 1] -= y0; f.P[i + 2] -= cz; }
  f.size = [x1 - x0, y1 - y0, z1 - z0];
  const w = Math.max(f.size[0], f.size[2]) / 2; if (!opt.noShadow) f.casters.push({ p: [0, f.size[1] * 0.5, 0], r: w * 0.9, sy: Math.max(0.3, f.size[1] / Math.max(0.1, 2 * w)) });
  return f;
}
/* uniform rescale of a Facets (used to size kit pieces to real-world metres) */
export function scaled(part, k) { const f = new Facets(); f.add(part, { s: k }); f.size = part.size ? part.size.map(v => v * k) : null; return f; }

/* ================================================================ ground FX: dust puffs, flicked pebbles, tyre tracks (world space).
   Puffs are chunky faceted blobs (icosahedron, 20 faces, split normals) in ground tones, lit by the scene's own key and fill through
   the kit ramp, with the sun-side rim and the haze; they pop out, grow, tumble and shrink while a screen-door dither fades the last
   part (opaque, so no sorting and no overdraw pile-up). One instanced draw for puffs, one for pebbles, one for the two track ribbons.
   step(dt, src) with src = { wheels: [{ x, y, z, rear }], speed, fwd: [fx, fz], swerve 0..1, bump 0..1, ground(x, z), jump } */
export function createGroundFX(THREE, U, opt = {}) {
  const NP = opt.puffs || 40, NB = opt.pebbles || 20, TL = opt.trackLen || 6, TS = 0.22, NT = Math.ceil(TL / TS);
  const wind = opt.wind || [0.45, 0.15];
  let R = rng(opt.seed || 7);
  const group = new THREE.Group();
  const DITHER = 'float kitIGN(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }';
  const patchFX = (m, key) => {
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aFade; varying float vFade; varying vec3 vKW;')
        .replace('#include <project_vertex>', '#include <project_vertex>\nvFade = aFade; { vec4 wp = vec4(transformed, 1.0);\n#ifdef USE_INSTANCING\nwp = instanceMatrix * wp;\n#endif\nvKW = (modelMatrix * wp).xyz; }');
      sh.fragmentShader = sh.fragmentShader.replace('#include <lights_lambert_pars_fragment>', THREE.ShaderChunk.lights_lambert_pars_fragment)
        .replace('#include <common>', '#include <common>\nvarying float vFade; varying vec3 vKW; uniform vec3 uRim;\n' + RAMP_GLSL + HAZE_GLSL + DITHER)
        .replace('float dotNL = saturate( dot( geometryNormal, directLight.direction ) );', 'float dotNL = kitRamp(dot( geometryNormal, directLight.direction ));')
        .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif (kitIGN(gl_FragCoord.xy) > vFade) discard;')
        .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
          { vec3 Vv = normalize(vViewPosition); float fr = pow(1.0 - clamp(dot(normal, Vv), 0.0, 1.0), 2.0); vec3 nw = (vec4(normal, 0.0) * viewMatrix).xyz;
            float sunSide = clamp(dot(normalize(nw), normalize(uSunDir)) * 0.5 + 0.5, 0.0, 1.0); totalEmissiveRadiance += uRim * fr * sunSide * diffuseColor.rgb * 1.4; }`)
        .replace('#include <opaque_fragment>', 'outgoingLight = applyHaze(outgoingLight, vKW);\nif (any(isnan(outgoingLight))) outgoingLight = vec3(0.0);\n#include <opaque_fragment>');
    };
    m.customProgramCacheKey = () => key; return m;
  };
  const geoOf = g0 => { const g = g0.index ? g0.toNonIndexed() : g0; g.computeVertexNormals(); return g; };
  /* puffs */
  const pg = geoOf(new THREE.IcosahedronGeometry(1, 0)); const pFade = new THREE.InstancedBufferAttribute(new Float32Array(NP), 1); pFade.setUsage(THREE.DynamicDrawUsage); pg.setAttribute('aFade', pFade);
  const SOFT = opt.look === 'soft';
  const puffs = new THREE.InstancedMesh(pg, patchFX(new THREE.MeshLambertMaterial({ color: 0xffffff }), 'kitpuff'), NP); puffs.frustumCulled = false; puffs.instanceMatrix.setUsage(THREE.DynamicDrawUsage); if (!SOFT) group.add(puffs);
  const sg = new THREE.InstancedBufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3)); sg.setIndex([0, 1, 2, 0, 2, 3]); sg.instanceCount = NP;
  const sP = new THREE.InstancedBufferAttribute(new Float32Array(NP * 4), 4).setUsage(THREE.DynamicDrawUsage), sF = new THREE.InstancedBufferAttribute(new Float32Array(NP * 3), 3).setUsage(THREE.DynamicDrawUsage); sg.setAttribute('aP', sP); sg.setAttribute('aF', sF);
  const sm = new THREE.ShaderMaterial({ uniforms: { ...U, uTones: { value: [0, 1, 2].map(k => new THREE.Color()) } }, transparent: true, depthWrite: false,
    vertexShader: 'attribute vec4 aP; attribute vec3 aF; varying vec2 vQ; varying vec3 vF; varying vec3 vKW; void main(){ vQ = position.xy; vF = aF; vKW = aP.xyz; vec4 mv = viewMatrix * vec4(aP.xyz, 1.0); mv.xy += position.xy * aP.w; gl_Position = projectionMatrix * mv; }',
    fragmentShader: HAZE_GLSL + `uniform vec3 uTones[3]; uniform vec3 uSunC; uniform vec3 uHemiS; uniform vec3 uHemiG; uniform vec3 uRim; varying vec2 vQ; varying vec3 vF; varying vec3 vKW;
      void main(){ float r2 = dot(vQ, vQ); if (r2 > 1.0 || vF.x < 0.004) discard;
        vec3 nv = vec3(vQ, sqrt(1.0 - r2)); vec3 nw = normalize((vec4(nv, 0.0) * viewMatrix).xyz);
        vec3 tone = vF.z < 0.5 ? uTones[0] : vF.z < 1.5 ? uTones[1] : uTones[2];
        float ndl = max(dot(nw, uSunDir), 0.0); vec3 amb = mix(uHemiG, uHemiS, nw.y * 0.5 + 0.5);
        vec3 c = tone * (amb * 1.25 + uSunC * ndl) * 0.31831 + uRim * pow(1.0 - nv.z, 2.0) * clamp(dot(nw.xz, normalize(uSunDir.xz + 1e-4)) * 0.5 + 0.5, 0.0, 1.0) * tone * 1.2;
        float a = (1.0 - smoothstep(0.2, 1.0, r2)) * vF.x * 0.4 * smoothstep(0.0, 0.22, vKW.y - vF.y);
        gl_FragColor = vec4(applyHaze(c, vKW), a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  const soft = new THREE.Mesh(sg, sm); soft.frustumCulled = false; soft.renderOrder = 5; if (SOFT) group.add(soft);
  /* pebbles */
  const bg = geoOf(new THREE.OctahedronGeometry(1, 0)); const bFade = new THREE.InstancedBufferAttribute(new Float32Array(NB).fill(1), 1); bg.setAttribute('aFade', bFade);
  const pebs = new THREE.InstancedMesh(bg, patchFX(new THREE.MeshLambertMaterial({ color: 0xffffff }), 'kitpeb'), NB); pebs.frustumCulled = false; pebs.instanceMatrix.setUsage(THREE.DynamicDrawUsage); group.add(pebs);
  const col = new THREE.Color();
  const tones = [mix3(C.earthOchre, C.sand, 0.65), mix3(C.sand, C.white, 0.3), mix3(C.earthOchre, C.sand, 0.35)];
  for (let i = 0; i < NP; i++) { col.setRGB(...tones[i % 3]); puffs.setColorAt(i, col); }
  for (let k = 0; k < 3; k++) sm.uniforms.uTones.value[k].setRGB(...tones[k]);
  for (let i = 0; i < NB; i++) { col.setRGB(...(i % 2 ? C.rockRed : C.earthDeep)); pebs.setColorAt(i, col); }
  /* tyre tracks: two ribbons of quads, alpha fading with distance from the wheel */
  const tPos = new Float32Array(2 * NT * 6 * 3), tA = new Float32Array(2 * NT * 6);
  const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(tPos, 3).setUsage(THREE.DynamicDrawUsage)); tg.setAttribute('aA', new THREE.BufferAttribute(tA, 1).setUsage(THREE.DynamicDrawUsage));
  const tm = new THREE.ShaderMaterial({ uniforms: { ...U, uCol: { value: new THREE.Color().setRGB(...C.earthDeep) } }, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2,
    vertexShader: 'attribute float aA; varying float vA; varying vec3 vKW; void main(){ vA = aA; vKW = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }',
    fragmentShader: HAZE_GLSL + 'uniform vec3 uCol; varying float vA; varying vec3 vKW; void main(){ gl_FragColor = vec4(applyHaze(uCol * 0.85, vKW), vA);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' });
  const tracks = new THREE.Mesh(tg, tm); tracks.frustumCulled = false; tracks.renderOrder = 1; group.add(tracks);
  /* state */
  const TN = new Uint8Array(NP); const P = new Float32Array(NP * 3), V = new Float32Array(NP * 3), A = new Float32Array(NP).fill(9), L = new Float32Array(NP).fill(1), S0 = new Float32Array(NP), AX = new Float32Array(NP * 3), SP = new Float32Array(NP);
  const BP = new Float32Array(NB * 3), BV = new Float32Array(NB * 3), BA = new Float32Array(NB).fill(9), BS = new Float32Array(NB), BR = new Float32Array(NB);
  const acc = [0, 0, 0, 0], pacc = [0, 0], trk = [[], []], lastT = [null, null];
  let nextP = 0, nextB = 0;
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), Vp = new THREE.Vector3(), Vs = new THREE.Vector3(), Ax = new THREE.Vector3();
  const easeOut = x => 1 - Math.pow(1 - Math.min(1, x), 3);
  function spawnPuff(w, src, side) {
    const i = nextP; nextP = (nextP + 1) % NP; const sp = src.speed, fx = src.fwd[0], fz = src.fwd[1], rx = -fz, rz = fx;
    P[i * 3] = w.x + (R() - 0.5) * 0.25; P[i * 3 + 1] = w.y + 0.1; P[i * 3 + 2] = w.z + (R() - 0.5) * 0.25;
    const back = sp * (0.16 + 0.12 * R()), lat = (R() - 0.5) * 0.9 + side * (0.25 + src.swerve * 1.4);
    V[i * 3] = -fx * back + rx * lat; V[i * 3 + 1] = 0.35 + 0.45 * R() + src.bump * 0.6; V[i * 3 + 2] = -fz * back + rz * lat;
    A[i] = 0; L[i] = (1.0 + 0.5 * R()) * (opt.sizeK ? 1.8 : 1); S0[i] = (opt.sizeK || 1) * (0.075 + 0.05 * R()) * (0.7 + sp / 16) * (1 + 0.6 * src.bump + 0.5 * src.swerve) * (w.rear ? 1 : 0.7); TN[i] = Math.floor(R() * 3);
    Ax.set(R() - 0.5, R() - 0.5, R() - 0.5).normalize(); AX[i * 3] = Ax.x; AX[i * 3 + 1] = Ax.y; AX[i * 3 + 2] = Ax.z; SP[i] = (0.6 + R()) * (R() < 0.5 ? -1 : 1);
  }
  function spawnPebble(w, src, side) {
    const i = nextB; nextB = (nextB + 1) % NB; const fx = src.fwd[0], fz = src.fwd[1], rx = -fz, rz = fx, out = side * (1.2 + 2.0 * R());
    BP[i * 3] = w.x; BP[i * 3 + 1] = w.y + 0.06; BP[i * 3 + 2] = w.z;
    BV[i * 3] = -fx * src.speed * 0.3 + rx * out; BV[i * 3 + 1] = 1.6 + 1.6 * R(); BV[i * 3 + 2] = -fz * src.speed * 0.3 + rz * out;
    BA[i] = 0; BS[i] = 0.045 + 0.04 * R(); BR[i] = R() * 6;
  }
  const api = {
    group, puffs, pebs, tracks,
    reset(seed) { R = rng(seed || opt.seed || 7); A.fill(9); BA.fill(9); acc.fill(0); pacc.fill(0); trk[0].length = 0; trk[1].length = 0; lastT[0] = lastT[1] = null; nextP = 0; nextB = 0; },
    step(dt, src) {
      const sp = src.speed, moving = sp > 0.5 && !src.jump;
      const rate = moving ? sp * 1.9 * (1 + 1.5 * src.bump + 2.5 * src.swerve) : 0;
      src.wheels.forEach((w, k) => { const side = w.side || (k % 2 ? 1 : -1); acc[k] += rate * (w.rear ? 1 : 0.22) * dt; while (acc[k] >= 1) { acc[k] -= 1; spawnPuff(w, src, side); } });
      const prate = moving ? 26 * Math.max(0, src.swerve - 0.15) + 18 * Math.max(0, src.bump - 0.5) : 0;
      src.wheels.filter(w => w.rear).forEach((w, k) => { pacc[k] += prate * dt * 0.5; while (pacc[k] >= 1) { pacc[k] -= 1; spawnPebble(w, src, w.side || (k ? 1 : -1)); } });
      /* puffs: drag, slow rise, side wind; never below the ground */
      const dr = Math.exp(-2.4 * dt);
      for (let i = 0; i < NP; i++) {
        if (A[i] >= L[i]) { if (SOFT) { sP.array[i * 4 + 3] = 0; sF.array[i * 3] = 0; } else { M4.makeScale(0, 0, 0); puffs.setMatrixAt(i, M4); pFade.array[i] = 0; } continue; }
        A[i] += dt; const k = Math.min(1, A[i] / L[i]);
        V[i * 3] = V[i * 3] * dr + wind[0] * (1 - dr); V[i * 3 + 2] = V[i * 3 + 2] * dr + wind[1] * (1 - dr); V[i * 3 + 1] += (0.16 - V[i * 3 + 1]) * Math.min(1, 1.6 * dt);
        P[i * 3] += V[i * 3] * dt; P[i * 3 + 1] += V[i * 3 + 1] * dt; P[i * 3 + 2] += V[i * 3 + 2] * dt;
        const size = S0[i] * (0.3 + 1.9 * easeOut(k / 0.3) + 1.1 * k) * (1 - 0.45 * smooth(0.7, 1, k));
        const g0 = src.ground(P[i * 3], P[i * 3 + 2]), gy = g0 + size * 0.5; if (P[i * 3 + 1] < gy) P[i * 3 + 1] = gy;
        const fade = 1 - smooth(0.45, 1.0, k);
        if (SOFT) { const o = i * 4; sP.array[o] = P[i * 3]; sP.array[o + 1] = P[i * 3 + 1]; sP.array[o + 2] = P[i * 3 + 2]; sP.array[o + 3] = size * 1.7; sF.array[i * 3] = fade * Math.min(1, k * 8); sF.array[i * 3 + 1] = g0; sF.array[i * 3 + 2] = TN[i]; continue; }
        Ax.set(AX[i * 3], AX[i * 3 + 1], AX[i * 3 + 2]); Q.setFromAxisAngle(Ax, SP[i] * A[i]); Vp.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); Vs.set(size, size * 0.82, size);
        M4.compose(Vp, Q, Vs); puffs.setMatrixAt(i, M4); pFade.array[i] = fade;
      }
      if (SOFT) { sP.needsUpdate = true; sF.needsUpdate = true; } else { puffs.instanceMatrix.needsUpdate = true; pFade.needsUpdate = true; }
      /* pebbles: ballistic, one damped bounce, shrink out */
      for (let i = 0; i < NB; i++) {
        if (BA[i] >= 1.1) { M4.makeScale(0, 0, 0); pebs.setMatrixAt(i, M4); continue; }
        BA[i] += dt; BV[i * 3 + 1] -= 9.8 * dt; BP[i * 3] += BV[i * 3] * dt; BP[i * 3 + 1] += BV[i * 3 + 1] * dt; BP[i * 3 + 2] += BV[i * 3 + 2] * dt;
        const gy = src.ground(BP[i * 3], BP[i * 3 + 2]) + BS[i] * 0.6; if (BP[i * 3 + 1] < gy) { BP[i * 3 + 1] = gy; BV[i * 3 + 1] = Math.abs(BV[i * 3 + 1]) * 0.3; BV[i * 3] *= 0.55; BV[i * 3 + 2] *= 0.55; }
        BR[i] += dt * 9; Q.setFromAxisAngle(Ax.set(0.6, 0.3, 0.74).normalize(), BR[i]); const s = BS[i] * (1 - smooth(0.8, 1.1, BA[i]));
        M4.compose(Vp.set(BP[i * 3], BP[i * 3 + 1], BP[i * 3 + 2]), Q, Vs.set(s, s * 0.7, s)); pebs.setMatrixAt(i, M4);
      }
      pebs.instanceMatrix.needsUpdate = true;
      /* tracks: a point every 22 cm behind each rear wheel, the last few metres */
      const rears = src.wheels.filter(w => w.rear);
      for (let k = 0; k < 2 && k < rears.length; k++) {
        const w = rears[k], t = trk[k];
        if (src.jump) t.length = 0;
        const last = t[t.length - 1];
        if (!last || Math.hypot(w.x - last[0], w.z - last[2]) >= TS) { if (moving || !last) t.push([w.x, w.y + 0.025, w.z]); if (t.length > NT + 1) t.shift(); }
        for (let j = 0; j < NT; j++) {
          const o = (k * NT + j) * 18, ao = (k * NT + j) * 6;
          const a = t[t.length - 1 - j], b = t[t.length - 2 - j];
          if (!a || !b) { for (let q = 0; q < 18; q++) tPos[o + q] = 0; for (let q = 0; q < 6; q++) tA[ao + q] = 0; continue; }
          const dx = a[0] - b[0], dz = a[2] - b[2], l = Math.hypot(dx, dz) || 1, nx = -dz / l * 0.13, nz = dx / l * 0.13;
          const V4 = [[a[0] + nx, a[1], a[2] + nz], [a[0] - nx, a[1], a[2] - nz], [b[0] - nx, b[1], b[2] - nz], [b[0] + nx, b[1], b[2] + nz]];
          const idx = [0, 1, 2, 0, 2, 3]; for (let q = 0; q < 6; q++) { const v = V4[idx[q]]; tPos[o + q * 3] = v[0]; tPos[o + q * 3 + 1] = v[1]; tPos[o + q * 3 + 2] = v[2]; }
          const fa = 0.3 * (1 - j / NT) * Math.min(1, j / 2 + 0.3); const fb = 0.3 * (1 - (j + 1) / NT) * Math.min(1, (j + 1) / 2 + 0.3);
          const al = [fa, fa, fb, fa, fb, fb]; for (let q = 0; q < 6; q++) tA[ao + q] = al[q];
        }
      }
      tg.attributes.position.needsUpdate = true; tg.attributes.aA.needsUpdate = true;
    }
  };
  return api;
}

/* ================================================================ Australian roadside details ("Easter eggs"), same facet language.
   Signs: boards mounted on the FRONT of their posts (posts behind, sunk, ending under the board's top edge); pictograms and
   lettering are flat shapes layered 12 mm proud of the face (no z-fighting at game distances). Generic wording only. */
const SIGN_YELLOW = lin('#E9B52C'), SIGN_GREEN = lin('#2F6B4C'), RUST = lin('#8C4A2E'), TIN = lin('#A7A39C');
/* flat convex polygon (2D points in the board plane) at depth z, facing +z */
function flatPoly(f, pts, z, col, ox = 0, oy = 0, sx = 1, sy = 1, face = 1, fx = [1, 0, 0, 0]) {
  const P = pts.map(([x, y]) => [ox + x * sx, oy + y * sy, z]); const c = [P.reduce((a, p) => a + p[0], 0) / P.length, P.reduce((a, p) => a + p[1], 0) / P.length, z];
  for (let i = 0; i < P.length; i++) f.tri(c, P[i], P[(i + 1) % P.length], col, fx, [c[0], c[1], z - face]);
}
const ell = (cx, cy, rx, ry, rot = 0, n = 10) => { const out = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2, x = Math.cos(a) * rx, y = Math.sin(a) * ry; out.push([cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)]); } return out; };
const quadP = (x0, y0, x1, y1, w) => { const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l * w / 2, ny = dx / l * w / 2; return [[x0 + nx, y0 + ny], [x0 - nx, y0 - ny], [x1 - nx, y1 - ny], [x1 + nx, y1 + ny]]; };
/* side-view silhouettes, about 1 unit across, centred */
export const PICTOS = {
  roo: [ell(0, 0.08, 0.27, 0.17, 0.75), ell(0.25, 0.4, 0.09, 0.065, 0.3), [[0.22, 0.45], [0.25, 0.6], [0.29, 0.47]], [[-0.17, -0.02], [-0.56, -0.34], [-0.1, -0.13]], [[-0.08, -0.04], [0.1, -0.04], [0.2, -0.33], [-0.06, -0.33]], [[-0.06, -0.37], [0.27, -0.37], [0.27, -0.31], [-0.06, -0.31]], quadP(0.15, 0.2, 0.3, 0.08, 0.05)],
  emu: [ell(-0.05, 0.05, 0.28, 0.19, -0.15), quadP(0.13, 0.12, 0.22, 0.5, 0.07), ell(0.25, 0.52, 0.065, 0.05), [[0.29, 0.54], [0.37, 0.5], [0.29, 0.5]], quadP(-0.05, -0.08, -0.12, -0.42, 0.05), quadP(0.04, -0.08, 0.1, -0.42, 0.05)],
  wombat: [ell(-0.02, -0.06, 0.34, 0.2), ell(0.3, -0.02, 0.13, 0.11), [[0.24, 0.07], [0.26, 0.15], [0.3, 0.08]], quadP(-0.25, -0.18, -0.25, -0.33, 0.08), quadP(-0.1, -0.18, -0.1, -0.33, 0.08), quadP(0.1, -0.18, 0.1, -0.33, 0.08), quadP(0.22, -0.18, 0.22, -0.33, 0.08)],
  cattle: [[[-0.32, -0.04], [0.22, -0.04], [0.22, 0.2], [-0.32, 0.2]], [[0.2, 0.08], [0.38, 0.04], [0.38, 0.2], [0.22, 0.24]], [[0.24, 0.24], [0.2, 0.33], [0.29, 0.24]], quadP(-0.28, -0.04, -0.28, -0.32, 0.07), quadP(-0.16, -0.04, -0.16, -0.32, 0.07), quadP(0.08, -0.04, 0.08, -0.32, 0.07), quadP(0.18, -0.04, 0.18, -0.32, 0.07), quadP(-0.32, 0.16, -0.4, -0.08, 0.03)],
  camel: [ell(-0.02, 0.06, 0.29, 0.15), ell(-0.04, 0.2, 0.14, 0.12), quadP(0.22, 0.08, 0.32, 0.32, 0.07), ell(0.36, 0.33, 0.07, 0.05), quadP(-0.22, -0.02, -0.22, -0.38, 0.05), quadP(-0.12, -0.02, -0.12, -0.38, 0.05), quadP(0.1, -0.02, 0.1, -0.38, 0.05), quadP(0.2, -0.02, 0.2, -0.38, 0.05)]
};
/* a tiny stroke font (generic wording): strokes in a 2 x 4 cell */
const GLYPH = {
  N: [[0, 0, 0, 4], [0, 4, 2, 0], [2, 0, 2, 4]], E: [[0, 0, 0, 4], [0, 4, 2, 4], [0, 2, 1.6, 2], [0, 0, 2, 0]], X: [[0, 0, 2, 4], [0, 4, 2, 0]], T: [[1, 0, 1, 4], [0, 4, 2, 4]],
  C: [[0, 0, 0, 4], [0, 4, 2, 4], [0, 0, 2, 0]], A: [[0, 0, 1, 4], [1, 4, 2, 0], [0.5, 1.6, 1.5, 1.6]], M: [[0, 0, 0, 4], [0, 4, 1, 2], [1, 2, 2, 4], [2, 4, 2, 0]], P: [[0, 0, 0, 4], [0, 4, 2, 4], [2, 4, 2, 2], [2, 2, 0, 2]],
  k: [[0, 0, 0, 4], [0, 1.2, 1.7, 2.7], [0.6, 1.8, 1.7, 0]], m: [[0, 0, 0, 2.6], [0, 2.6, 2, 2.6], [1, 0, 1, 2.6], [2, 0, 2, 2.6]],
  0: [[0, 0, 0, 4], [0, 4, 2, 4], [2, 4, 2, 0], [2, 0, 0, 0]], 2: [[0, 4, 2, 4], [2, 4, 2, 2], [2, 2, 0, 2], [0, 2, 0, 0], [0, 0, 2, 0]], 5: [[2, 4, 0, 4], [0, 4, 0, 2], [0, 2, 2, 2], [2, 2, 2, 0], [2, 0, 0, 0]],
  9: [[2, 0, 2, 4], [2, 4, 0, 4], [0, 4, 0, 2], [0, 2, 2, 2]]
};
export function lettering(f, text, cx, cy, h, z, col, bold = false, fx = [1, 0, 0, 0]) {
  const u = h / 4, adv = (bold ? 2.75 : 2.9) * u, w = (bold ? 0.62 : 0.42) * u, wide = [...text].reduce((a, ch) => a + (ch === ' ' ? 1.6 * u : adv), 0) - 0.9 * u;
  let x = cx - wide / 2;
  for (const ch of text) { if (ch === ' ') { x += 1.6 * u; continue; } for (const [x0, y0, x1, y1] of GLYPH[ch] || []) { const ext = 0.21; const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1; flatPoly(f, quadP(x + (x0 - dx / l * ext) * u, cy + (y0 - dy / l * ext) * u - 2 * u, x + (x1 + dx / l * ext) * u, cy + (y1 + dy / l * ext) * u - 2 * u, w), z, col, 0, 0, 1, 1, 1, fx); } x += adv; }
}
function post(f, x, z, top, w = 0.1) { bevelBox(f, [x, (top - 0.4) / 2, z], w, top + 0.4, w, 0.015, () => C.steel, [1, 0, 0, 0]); f.casters.push({ p: [x, 0, z], q: [x, top, z], r: w }); }
/* yellow diamond wildlife warning on one post: kind = roo | emu | wombat | cattle | camel */
export function wildlifeSign(kind = 'roo') {
  const f = new Facets(), fx = [1, 0, 0, 0], cy = 2.0, R = 0.5, T = 0.04;
  post(f, 0, -0.07, cy + 0.1, 0.09);
  const dia = r => [[0, r], [r, 0], [0, -r], [-r, 0]];
  /* board: a thin diamond slab, front face at z = +T/2 */
  const P = dia(R); for (let i = 0; i < 4; i++) { const a = P[i], b = P[(i + 1) % 4]; f.quad([a[0], cy + a[1], T / 2], [b[0], cy + b[1], T / 2], [b[0], cy + b[1], -T / 2], [a[0], cy + a[1], -T / 2], shade(SIGN_YELLOW, 0.8), fx, [0, cy, 0]); }
  flatPoly(f, P, -T / 2, C.steel, 0, cy, 1, 1, -1); flatPoly(f, P, T / 2, C.black, 0, cy);
  flatPoly(f, dia(R * 0.9), T / 2 + 0.02, SIGN_YELLOW, 0, cy);
  for (const poly of PICTOS[kind]) flatPoly(f, poly, T / 2 + 0.04, C.black, 0, cy, 0.62, 0.62);
  f.casters.push({ p: [0, cy, 0], r: R * 0.7 });
  return f;
}
/* the famous-style triple: camel, wombat, roo on a tall plate, with a generic distance plate */
export function tripleSign() {
  const f = new Facets(), fx = [1, 0, 0, 0], W = 0.8, H = 2.3, y0 = 1.2, T = 0.04;
  for (const x of [-0.28, 0.28]) post(f, x, -0.07, y0 + H - 0.15, 0.08);
  bevelBox(f, [0, y0 + H / 2, 0], W, H, T, 0.01, (n) => n[2] > 0.5 ? SIGN_YELLOW : shade(SIGN_YELLOW, 0.8), fx);
  const z = T / 2 + 0.025;
  ['camel', 'wombat', 'roo'].forEach((k, i) => { const cy = y0 + H - 0.4 - i * 0.62; for (const poly of PICTOS[k]) flatPoly(f, poly, z, C.black, 0, cy, 0.56, 0.56); });
  bevelBox(f, [0, y0 - 0.22, 0], W, 0.34, T, 0.01, () => SIGN_YELLOW, fx); lettering(f, 'NEXT 90 km', 0, y0 - 0.22, 0.15, z, C.black);
  f.casters.push({ p: [0, y0 + H / 2, 0], r: 0.4, sy: 3 });
  return f;
}
/* green distance sign: two posts behind a plate, white lettering */
export function distanceSign(text = 'CAMP 2 km') {
  const f = new Facets(), fx = [1, 0, 0, 0], W = 0.34 + text.length * 0.17, H = 0.5, y0 = 1.7, T = 0.04;
  for (const x of [-W * 0.32, W * 0.32]) post(f, x, -0.07, y0 + H * 0.3, 0.08);
  bevelBox(f, [0, y0, 0], W, H, T, 0.012, (n) => n[2] > 0.5 ? SIGN_GREEN : shade(SIGN_GREEN, 0.75), fx);
  lettering(f, text, 0, y0, 0.22, T / 2 + 0.025, C.white);
  f.casters.push({ p: [0, y0, 0], r: W / 2, sy: 0.4 });
  return f;
}
/* camp distance board on a cantilever gantry: a 3.0 x 2.1 m dark green board hung over the road shoulder (bottom 3.1 m up, clear
   of the ute) from an arm on one verge post, angled about 37 degrees toward the road, so the whole board stays inside the portrait
   game frame from 45 m to about 12 m. The face is a canvas texture with real type (Oswald 700, vendored): tent + CAMP, then the
   distance as the dominant line (1.0 m numerals = about 15 px at 40 m on a 360 px phone). Board on the front of its hangers and
   arm; the post sits on the verge, sunk. Local frame: board centre at x = 0, post at x = +3.0 (verge side). */
export const BOARD_GREEN = lin('#1E5A3C'), BOARD = { W: 3.0, H: 2.1, y0: 3.1, post: 3.0, numeral: 1.0 };
export function distanceGantry() {
  const f = new Facets(), fx = [1, 0, 0, 0], { W, H, y0, post: px } = BOARD, top = y0 + H, armY = top + 0.22, T = 0.08;
  bevelBox(f, [px, (armY + 0.1 - 0.8) / 2, -0.25], 0.22, armY + 0.1 + 0.8, 0.22, 0.03, () => C.steel, fx);
  bevelBox(f, [(px - W / 2 - 0.2) / 2 + 0.05, armY, -0.25], px + W / 2 + 0.3, 0.16, 0.16, 0.03, () => C.steel, fx);
  for (const x of [-W * 0.32, W * 0.32]) bevelBox(f, [x, (top + armY) / 2, -0.12], 0.08, armY - top + 0.1, 0.08, 0.015, () => C.steel, fx);
  /* board body (dark back and edges; the face is a separate textured plane at z = +T/2 + 2 mm) */
  bevelBox(f, [0, y0 + H / 2, -0.02], W, H, T, 0.02, (n) => n[2] > 0.5 ? BOARD_GREEN : shade(BOARD_GREEN, 0.6), fx);
  f.casters.push({ p: [0, y0 + H / 2, 0], r: W / 2, sy: 0.7 }, { p: [px, 0, -0.25], q: [px, armY, -0.25], r: 0.15 });
  f.meta = { face: { w: W - 0.04, h: H - 0.04, cy: y0 + H / 2, z: T / 2 - 0.02 + 0.02 } };
  return f;
}
/* the face texture, laid out on a grid like a real distance board (call after the font has loaded):
   inner margin 10% of the board height on every side; row 1 = tent pictogram LEFT of "CAMP" (gap = half a letter width), row 2 =
   the distance alone, centred, the largest element (number, thin space, unit); a clear gap between the rows; no arrow; nothing touches.
   Returns the canvas, the numeral's [bottom, top] in board metres from the face bottom, and the element boxes (for the overlap check). */
export function distanceFaceCanvas(dist = '2 km', font = 'Oswald', q = 0.5) {
  const Wp = 1024, Hp = Math.round(1024 * BOARD.H / BOARD.W), c = document.createElement('canvas'); c.width = Math.round(Wp * q); c.height = Math.round(Hp * q);
  const g = c.getContext('2d'), green = '#1E5A3C', pale = '#F1ECE2'; g.scale(q, q);
  const M = Math.ceil(Hp * 0.1), X0 = M, X1 = Wp - M, Y0 = M, Y1 = Hp - M, IH = Y1 - Y0, mPerPx = BOARD.H / Hp;
  g.fillStyle = green; g.fillRect(0, 0, Wp, Hp);
  /* pale border inside the margin band, a full margin/2 clear of the content */
  g.strokeStyle = pale; g.lineWidth = 12; g.strokeRect(M * 0.35, M * 0.35, Wp - M * 0.7, Hp - M * 0.7);
  const fit = (text, px, maxW, maxH) => { g.font = `700 ${px}px ${font}`; const m = g.measureText(text), h = (m.actualBoundingBoxAscent || px * 0.8) + (m.actualBoundingBoxDescent || 0); const k = Math.min(maxW / m.width, maxH / h); return px * k; };
  if ('letterSpacing' in g) g.letterSpacing = '0px';
  /* rows: row 1 takes 27% of the inner height, a 13% gap, row 2 the remaining 60% */
  const r1h = IH * 0.27, gap = IH * 0.13, r2y0 = Y0 + r1h + gap, r2h = Y1 - r2y0, boxes = [];
  /* row 1: CAMP at cap height r1h, tent the same height, gap half a letter width */
  let p1 = fit('CAMP', 300, (X1 - X0) * 0.7, r1h); g.font = `700 ${p1}px ${font}`; const mC = g.measureText('CAMP'), capH = mC.actualBoundingBoxAscent, letterW = mC.width / 4;
  const tentW = capH * 1.15, gapT = Math.max(letterW * 0.5, capH * 0.3), rowW = tentW + gapT + mC.width, rx = (Wp - rowW) / 2, base1 = Y0 + (r1h + capH) / 2;
  g.fillStyle = pale; g.beginPath(); g.moveTo(rx, base1); g.lineTo(rx + tentW, base1); g.lineTo(rx + tentW / 2, base1 - capH); g.closePath(); g.fill();
  g.fillStyle = green; g.beginPath(); g.moveTo(rx + tentW * 0.36, base1); g.lineTo(rx + tentW * 0.64, base1); g.lineTo(rx + tentW / 2, base1 - capH * 0.45); g.closePath(); g.fill();
  g.fillStyle = pale; g.fillText('CAMP', rx + tentW + gapT, base1);
  boxes.push(['tent', rx, base1 - capH, rx + tentW, base1], ['CAMP', rx + tentW + gapT, base1 - capH, rx + tentW + gapT + mC.width, base1]);
  /* row 2: the distance, centred; number and unit share a baseline, unit at 0.62 x, thin space between */
  const [num, unit = ''] = dist.split(' ');
  let p2 = 400; g.font = `700 ${p2}px ${font}`; let dN = g.measureText(num), nh = dN.actualBoundingBoxAscent; p2 = p2 * r2h / nh;
  const layout = p => { g.font = `700 ${p}px ${font}`; const wN = g.measureText(num).width, h = g.measureText(num).actualBoundingBoxAscent; g.font = `700 ${p * 0.62}px ${font}`; const wU = unit ? g.measureText(unit).width : 0, thin = unit ? p * 0.14 : 0; return { wN, wU, thin, h, w: wN + thin + wU }; };
  let L = layout(p2); if (L.w > X1 - X0) { p2 *= (X1 - X0) / L.w; L = layout(p2); }
  const base2 = Y1 - (r2h - L.h) / 2, x2 = (Wp - L.w) / 2;
  g.fillStyle = pale; g.font = `700 ${p2}px ${font}`; g.fillText(num, x2, base2); if (unit) { g.font = `700 ${p2 * 0.62}px ${font}`; g.fillText(unit, x2 + L.wN + L.thin, base2); }
  boxes.push(['num', x2, base2 - L.h, x2 + L.wN, base2]); if (unit) boxes.push(['unit', x2 + L.wN + L.thin, base2 - L.h * 0.62 * 1.05, x2 + L.w, base2]);
  /* QA: nothing overlaps, everything inside the margin */
  const ok = boxes.every(([, a0, b0, a1, b1], i) => a0 >= X0 - 0.5 && a1 <= X1 + 0.5 && b0 >= Y0 - 0.5 && b1 <= Y1 + 0.5 && boxes.every(([, c0, d0, c1, d1], j) => j === i || a1 <= c0 || c1 <= a0 || b1 <= d0 || d1 <= b0));
  return { canvas: c, numeral: [(Hp - base2) * mPerPx, (Hp - base2 + L.h) * mPerPx], boxes, ok, margin: M };
}
/* a drum mailbox on a post, rusty, with a little flag */
export function mailboxDrum() {
  const f = new Facets(), fx = [1, 0, 0, 0];
  bevelBox(f, [0, 0.45, 0], 0.12, 1.3, 0.12, 0.02, () => C.trunkShade, fx);
  tube(f, [[0, 1.32, -0.45], [0, 1.32, 0.45]], [0.3, 0.3], 10, (i, k) => k === -1 ? shade(RUST, 0.8) : (k % 3 ? RUST : shade(RUST, 1.15)), fx, true, true);
  bevelBox(f, [0.33, 1.45, 0.2], 0.03, 0.28, 0.03, 0.005, () => C.steel, fx); bevelBox(f, [0.33, 1.55, 0.28], 0.025, 0.1, 0.16, 0.005, () => C.hazard, fx);
  f.casters.push({ p: [0, 1.3, 0], r: 0.35 });
  return f;
}
/* the dunny: corrugated tin shed with a sloped roof and a timber door */
export function dunny() {
  const f = new Facets(), fx = [1, 0, 0, 0], W = 1.1, D = 1.1, H = 2.1;
  loft(f, [{ y: 0, r: 0.78, rot: Math.PI / 4 }, { y: 0.7, r: 0.78, rot: Math.PI / 4 }, { y: 1.4, r: 0.78, rot: Math.PI / 4 }, { y: H, r: 0.78, rot: Math.PI / 4 }], 4, (i, k, n) => lit(i % 2 ? TIN : shade(TIN, 0.9), n, 0.1), fx, 1, 0, false);
  const roof = new Facets(); bevelBox(roof, [0, 0, 0], W + 0.3, 0.06, D + 0.3, 0.015, (n) => lit(shade(TIN, 0.85), n, 0.2), fx); f.add(roof, { y: H + 0.05, tilt: -0.12 });
  bevelBox(f, [0, 0.95, D / 2 + 0.03], 0.62, 1.8, 0.05, 0.015, () => lin('#9C6B44'), fx);
  bevelBox(f, [0.22, 1.0, D / 2 + 0.065], 0.05, 0.05, 0.03, 0.005, () => C.black, fx);
  f.casters.push({ p: [0, 1, 0], r: 0.7, sy: 1.6 });
  return f;
}
export function billy() { const f = new Facets(), fx = [1, 0, 0, 0]; tube(f, [[0, 0, 0], [0, 0.24, 0]], [0.1, 0.1], 8, () => TIN, fx, true, true); tube(f, [[-0.1, 0.24, 0], [0, 0.36, 0], [0.1, 0.24, 0]], [0.012, 0.012, 0.012], 4, () => C.steel, fx, false); return f; }
/* goanna basking on a rock */
export function goanna() {
  const f = new Facets(), fx = [1, 0, 0.4, 0], skin = (i, k) => k % 2 ? lin('#6E6248') : lin('#857654');
  f.add(rock(41, 1), { s: 1.1 });
  const y = 0.55; tube(f, [[0, y, 0.55], [0, y + 0.02, 0.3], [0, y + 0.03, 0], [0, y + 0.02, -0.3], [0.06, y, -0.65], [0.15, y - 0.02, -1.0]], [0.04, 0.085, 0.1, 0.085, 0.045, 0.012], 5, skin, fx);
  for (const [z, sx] of [[0.22, 1], [0.22, -1], [-0.22, 1], [-0.22, -1]]) tube(f, [[0.05 * sx, y, z], [0.2 * sx, y - 0.06, z + 0.06], [0.24 * sx, y - 0.1, z + 0.12]], [0.03, 0.025, 0.02], 4, skin, fx);
  return f;
}
/* a road train far off: prime mover + three trailers, flat boxes (silhouette distance only) */
export function roadTrain() {
  const f = new Facets(), fx = [0, 0, 0.3, 0];
  bevelBox(f, [0, 1.6, 9.2], 2.4, 2.4, 3.2, 0.1, (n) => lit(C.white, n, 0.2), fx); bevelBox(f, [0, 2.0, 10.6], 2.3, 0.8, 0.4, 0.05, () => C.black, fx);
  for (let i = 0; i < 3; i++) bevelBox(f, [0, 1.9, 4.6 - i * 7.8], 2.5, 2.8, 7.2, 0.08, (n) => lit(i % 2 ? C.steel : shade(C.steel, 0.9), n, 0.2), fx);
  for (let i = 0; i < 9; i++) bevelBox(f, [0, 0.5, 9 - i * 2.4], 2.6, 1.0, 1.0, 0.1, () => C.black, fx);
  return f;
}
/* ---------------------------------------------------------------- animals with a part rig (one instanced draw per species).
   parts: list of [Facets, partId]; the vertex shader poses each part about its pivot from a per-instance aAnim. */
export function roo2(joey = true) {
  const fur = lin('#B07A4E'), furD = lin('#8E5E3C'), col = (n) => vary(lit(n[1] < -0.3 ? furD : fur, n, 0.12), rng(3), 0.04);
  const body = new Facets(), head = new Facets(), tail = new Facets(), legs = new Facets(), jo = new Facets(); const fx = [0, 0, 1.1, 0];
  blob(body, rng(1), { c: [0, 0.8, 0.02], rad: 0.33, sy: 1.45, detail: 0, j: 0.06, flat: -0.95, col, fx });
  blob(head, rng(2), { c: [0, 1.36, 0.2], rad: 0.13, sy: 1.0, detail: 0, j: 0.05, flat: -0.95, col, fx });
  blob(head, rng(4), { c: [0, 1.32, 0.32], rad: 0.07, sy: 0.8, detail: 0, j: 0.05, flat: -0.95, col, fx });
  for (const sx of [1, -1]) { const a = [0.05 * sx, 1.44, 0.17], b = [0.08 * sx, 1.62, 0.12], c = [0.02 * sx, 1.46, 0.1]; head.tri(a, b, c, fur, fx, [0, 1.5, 0.5]); head.tri(a, b, c, furD, fx, [0, 1.5, -0.5]); }
  tube(head, [[0.1, 1.05, 0.24], [0.12, 0.88, 0.32]], [0.04, 0.03], 4, () => fur, fx); tube(head, [[-0.1, 1.05, 0.24], [-0.12, 0.88, 0.32]], [0.04, 0.03], 4, () => fur, fx);
  tube(tail, [[0, 0.55, -0.2], [0, 0.32, -0.62], [0, 0.12, -1.0]], [0.12, 0.08, 0.04], 5, () => fur, fx);
  for (const sx of [1, -1]) { tube(legs, [[0.13 * sx, 0.62, -0.02], [0.15 * sx, 0.3, 0.1], [0.14 * sx, 0.08, -0.04]], [0.11, 0.07, 0.05], 5, () => fur, fx); bevelBox(legs, [0.14 * sx, 0.04, 0.08], 0.09, 0.07, 0.34, 0.02, () => furD, fx); }
  if (joey) { blob(jo, rng(9), { c: [0, 0.86, 0.29], rad: 0.075, sy: 1.0, detail: 0, j: 0.05, flat: -0.95, col, fx }); for (const sx of [1, -1]) jo.tri([0.03 * sx, 0.92, 0.3], [0.05 * sx, 1.0, 0.28], [0.01 * sx, 0.93, 0.27], fur, fx, [0, 0.9, 0.6]); }
  return [[body, 0], [head, 1], [tail, 2], [legs, 3], [jo, 4]];
}
export function emu() {
  const fea = lin('#5E544A'), feaL = lin('#7A6E60'), leg = lin('#8A7A64'), fx = [0, 0, 1.0, 0];
  const body = new Facets(), neck = new Facets(), lL = new Facets(), lR = new Facets();
  blob(body, rng(11), { c: [0, 1.1, -0.05], rad: 0.42, sy: 0.8, detail: 1, j: 0.12, flat: -0.8, col: (n) => vary(lit(n[1] > 0.3 ? feaL : fea, n, 0.1), rng(5), 0.05), fx });
  tube(neck, [[0, 1.25, 0.3], [0, 1.6, 0.42], [0, 1.82, 0.47]], [0.09, 0.06, 0.05], 5, () => fea, fx);
  blob(neck, rng(12), { c: [0, 1.86, 0.52], rad: 0.08, sy: 0.8, detail: 0, j: 0.05, flat: -0.95, col: () => fea, fx }); neck.tri([0.02, 1.85, 0.58], [-0.02, 1.85, 0.58], [0, 1.83, 0.68], C.black, fx, [0, 1.9, 0.5]);
  for (const [F, sx] of [[lL, 1], [lR, -1]]) { tube(F, [[0.12 * sx, 0.92, 0], [0.13 * sx, 0.5, 0.06], [0.12 * sx, 0.06, -0.02]], [0.06, 0.035, 0.03], 4, () => leg, fx); bevelBox(F, [0.12 * sx, 0.03, 0.06], 0.08, 0.05, 0.18, 0.015, () => leg, fx); }
  return [[body, 0], [neck, 1], [lL, 2], [lR, 3]];
}
export function rigGeometry(THREE, parts) {
  const all = new Facets(), ids = [];
  for (const [p, id] of parts) { all.add(p); for (let i = 0; i < p.P.length / 3; i++) ids.push(id); }
  all.T = new Array(all.P.length / 3 * 2).fill(-9999);
  const g = toGeometry(THREE, all); g.setAttribute('aPart', new THREE.Float32BufferAttribute(ids, 1)); return g;
}
/* animal material: the world material plus the pose rig. species 0 = roo (aAnim: mode 0 graze .. 1 alert .. 2 hop, phase, joey, -)
   species 1 = emu (aAnim: run 0..1, phase, -, -) */
export function createAnimalMaterial(THREE, U, species) {
  const m = createWorldMaterial(THREE, U), prev = m.onBeforeCompile;
  /* roo aAnim = [mode 0 graze .. 1 stand .. 2 hop, phase (hop 0..1: crouch 0-.15, airborne arc, landing squash .85-1; graze: slow shift), joey, head yaw] */
  const ROOP = `
    float mo = aAnim.x, ph = aAnim.y, hy = aAnim.w;
    float wg = 1.0 - clamp(mo, 0.0, 1.0), wh = clamp(mo - 1.0, 0.0, 1.0), ws = 1.0 - wg - wh;
    float air = clamp((ph - 0.15) / 0.7, 0.0, 1.0), inAir = step(0.15, ph) * step(ph, 0.85), arc = sin(3.14159 * air) * inAir;
    float sq = (ph < 0.15 ? sin(3.14159 * ph / 0.15) : (ph > 0.85 ? sin(3.14159 * (ph - 0.85) / 0.15) : 0.0)) * wh;
    float shift = (ph - 0.5) * 2.0 * wg;
    float aB = wg * (0.95 + 0.05 * shift) + ws * 0.06 + wh * (0.28 + 0.42 * air * inAir + 0.2 * sq);
    float aH = wg * 0.5 + ws * -0.12 + wh * -0.25;
    float aT = wg * 0.2 + ws * -0.06 + wh * (0.4 * arc - 0.3 * sq);
    float aL = wh * (-0.6 * arc + 0.35 * sq);
    float lift = wh * (arc * ${ROO.hopHeight.toFixed(2)} - sq * 0.08); float yaw = hy * (ws + 0.3 * wg) * 0.8;
    vec3 hip = vec3(0.0, 0.55, -0.05), piv2 = vec3(0.0, 1.22, 0.16), piv1 = aPart > 1.5 && aPart < 2.5 ? vec3(0.0, 0.5, -0.2) : hip;
    float A1 = aPart < 1.5 ? aB : aPart < 2.5 ? aT : aPart < 3.5 ? aL : aB; float A2 = aPart > 0.5 && aPart < 1.5 ? aH : 0.0; float AY = aPart > 0.5 && aPart < 1.5 ? yaw : 0.0; float sc = aPart > 3.5 ? aAnim.z : 1.0;`;
  /* emu aAnim = [run 0..1, stride phase (radians, advanced by distance / stride), peck 0..1, moving 0..1] */
  const EMUP = `
    float run = aAnim.x, ph = aAnim.y, pk = aAnim.z, mv = aAnim.w; float amp = mv * (0.3 + 0.5 * run), aL = amp * sin(ph);
    vec3 hip = vec3(0.0, 0.95, 0.0), piv2 = vec3(0.0, 1.25, 0.3), piv1 = hip;
    float A1 = aPart < 0.5 ? 0.1 * run : aPart < 1.5 ? 0.1 * run : aPart < 2.5 ? aL : -aL;
    float A2 = aPart > 0.5 && aPart < 1.5 ? 0.12 * run + 0.1 * run * sin(2.0 * ph) + pk * 1.15 : 0.0; float AY = 0.0; float sc = 1.0;
    float lift = (0.02 + 0.06 * run) * abs(sin(ph)) * mv;`;
  m.onBeforeCompile = (sh, r) => {
    prev(sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      attribute float aPart; attribute vec4 aAnim;
      vec3 kRotX(vec3 p, vec3 c, float a) { p -= c; float cs = cos(a), sn = sin(a); return vec3(p.x, cs * p.y - sn * p.z, sn * p.y + cs * p.z) + c; }
      vec3 kRotY(vec3 p, vec3 c, float a) { p -= c; float cs = cos(a), sn = sin(a); return vec3(cs * p.x + sn * p.z, p.y, -sn * p.x + cs * p.z) + c; }`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        ${species === 0 ? ROOP : EMUP}
        objectNormal = kRotX(kRotX(kRotY(objectNormal, vec3(0.0), AY), vec3(0.0), A2), vec3(0.0), A1);`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed = kRotY(transformed, piv2, AY); transformed = kRotX(transformed, piv2, A2); transformed = kRotX(transformed, piv1, A1);
        ${species === 0 ? 'if (aPart > 3.5) transformed = mix(vec3(0.0, 0.86, 0.29), transformed, sc);' : ''} transformed.y += lift;`)
      .replace('vKW = (modelMatrix * vec4(transformed, 1.0)).xyz;', 'vKW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;');
  };
  m.customProgramCacheKey = () => 'kitanimal2-' + species;
  return m;
}

/* ================================================================ creature behaviour (pure JS, deterministic, replayable).
   Facing always follows travel: heading turns toward the wanted direction at a limited rate (ROO.turnRate / EMU.turnRate), speed
   eases down through turns, and leg cycles advance by distance travelled (stride length x cadence = speed, so feet never slide).
   Roos move only while airborne in a hop; standing and turning happen on planted feet. Scenery only: no colliders; a creature
   never targets a point nearer the road than its keepOut. */
export const ROO = {
  graze: [3, 8], stand: [1.5, 4], turn: [0.3, 0.6], hops: [2, 5], hopDur: [0.45, 0.6], hopLen: [1.5, 2.5], fleeHopLen: [2.6, 3.4], maxSpeed: 8,
  notice: 45, react: 28, turnRate: 2.6, hopHeight: 0.5, keepOut: 6, homeR: 6, fleeAngle: 0.4
};
export const EMU = { runSpeed: [7.6, 8.6], runTime: [3.5, 4.5], walkSpeed: 1.2, stride: { run: 2.7, walk: 0.85 }, turnRate: 1.2, peck: [2, 4], walk: [1.5, 3], trigger: 20, keepOut: 6 };
const wrapA = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const lerpR = (r, [a, b]) => a + (b - a) * r();
/* world frame helpers are passed in: toTrack(x, z) -> [s, u], world(s, u) -> {x, z, th} (th = road heading at s) */
export function createRooSim(defs, env, seed = 1) {
  /* defs: [{ s, u, joey, calm }]; calm = ridge roo: mostly standing, short hops */
  let R = rng(seed);
  const make = () => defs.map((d, i) => { const w = env.world(d.s, d.u); return { i, watch: !!d.watch, big: !!d.big, x: w.x, z: w.z, home: [w.x, w.z], h: w.th + (R() - 0.5) * 3, st: 'graze', tm: lerpR(R, ROO.graze) * (0.3 + 0.7 * R()), hops: 0, hp: 0, hd: 0.5, hl: 2, wantH: 0, flee: 0, joey: d.joey ? 1 : 0, calm: !!d.calm, side: d.u < 0 ? -1 : 1, look: 0, ph: R() * 6, mode: 0, lift: 0 }; });
  let A = make();
  const api = {
    animals: () => A,
    reset(sd) { R = rng(sd || seed); A = make(); },
    step(dt, ute) {
      for (const a of A) {
        const dx = ute.x - a.x, dz = ute.z - a.z, dUte = Math.hypot(dx, dz), toUte = Math.atan2(dx, dz);
        a.look += (wrapA(toUte - a.h) * (dUte < ROO.notice && a.st !== 'hop' ? 1 : 0) - a.look) * Math.min(1, dt * 4);
        a.look = Math.max(-1.1, Math.min(1.1, a.look));
        if (a.flee > 0) a.flee -= dt;
        /* reaction: the nearest stand, look, then move off away from the road at an easy pace */
        /* reaction: watchers stand tall, then drift on a few easy hops along the road (staying in view); the rest move off along the road and gently away */
        if (dUte < ROO.react && a.flee <= 0 && (a.st === 'graze' || a.st === 'stand')) { a.st = 'stand'; a.tm = a.watch ? 0.9 + R() * 0.5 : 0.6 + R() * 0.6; a.flee = 10; a.fleeNext = true; }
        a.tm -= dt;
        if (a.st === 'graze') { a.mode += (0 - a.mode) * Math.min(1, dt * 3); a.ph += dt * 0.25; if (a.tm <= 0) { a.st = 'stand'; a.tm = lerpR(R, ROO.stand) * (a.calm ? 2.2 : 1); } }
        else if (a.st === 'stand') { a.mode += (1 - a.mode) * Math.min(1, dt * 4); if (a.tm <= 0 && a.watch && !a.fleeNext) { a.st = R() < 0.5 ? 'graze' : 'stand'; a.tm = a.st === 'graze' ? lerpR(R, ROO.graze) : lerpR(R, ROO.stand); }
          else if (a.tm <= 0) {
            const [s0, u0] = env.toTrack(a.x, a.z);
            let want;
            if (a.fleeNext) { want = env.world(s0, u0).th - a.side * (a.watch ? 0.15 : ROO.fleeAngle) + (R() - 0.5) * 0.2; a.hops = a.watch ? 3 : 4 + Math.floor(R() * 3); a.fast = !a.watch; a.fleeNext = false; }
            else { const hx = a.home[0] - a.x, hz = a.home[1] - a.z, far = Math.hypot(hx, hz) > ROO.homeR; want = far ? Math.atan2(hx, hz) + (R() - 0.5) * 0.8 : a.h + (R() - 0.5) * 2.4; a.hops = a.calm ? 1 + Math.floor(R() * 2) : lerpR(R, ROO.hops) | 0; a.fast = false; }
            /* never toward the road: if the first hops would bring it inside keepOut, mirror the heading away */
            const awayH = env.world(s0, u0).th - a.side * Math.PI / 2, tx = a.x + Math.sin(want) * 6, tz = a.z + Math.cos(want) * 6, [, ut] = env.toTrack(tx, tz);
            if (Math.abs(ut) < ROO.keepOut || Math.sign(ut) !== a.side) want = awayH + (R() - 0.5) * 0.8;
            a.wantH = want; a.st = 'turn'; a.tm = lerpR(R, ROO.turn); } }
        else if (a.st === 'turn') { a.mode += (1 - a.mode) * Math.min(1, dt * 4); const d = wrapA(a.wantH - a.h), mx = ROO.turnRate * dt; a.h += Math.abs(d) < mx ? d : Math.sign(d) * mx; if (a.tm <= 0 && Math.abs(wrapA(a.wantH - a.h)) < 0.15) { a.st = 'hop'; a.hp = 0; a.hd = lerpR(R, ROO.hopDur); a.hl = lerpR(R, a.fast ? ROO.fleeHopLen : ROO.hopLen); } }
        else if (a.st === 'hop') {
          a.mode += (2 - a.mode) * Math.min(1, dt * 10); const p0 = a.hp; a.hp += dt / a.hd;
          /* ground travel only while airborne (phase 0.15-0.85); speed capped */
          const air = k => Math.max(0, Math.min(1, (k - 0.15) / 0.7)); const ds = (air(Math.min(1, a.hp)) - air(p0)) * Math.min(a.hl, ROO.maxSpeed * a.hd);
          a.x += Math.sin(a.h) * ds; a.z += Math.cos(a.h) * ds;
          if (a.hp >= 1) { a.hops--; if (a.hops > 0) { a.hp -= 1; a.hd = lerpR(R, ROO.hopDur); a.hl = lerpR(R, a.fast ? ROO.fleeHopLen : ROO.hopLen); a.h += (R() - 0.5) * 0.25; } else { a.hp = 0; a.st = R() < 0.55 ? 'stand' : 'graze'; a.tm = a.st === 'stand' ? lerpR(R, ROO.stand) : lerpR(R, ROO.graze); } }
        }
        a.lift = a.st === 'hop' ? Math.sin(Math.PI * Math.max(0, Math.min(1, (a.hp - 0.15) / 0.7))) * ROO.hopHeight : 0;
      }
    },
    /* per-instance outputs for the rig shader: [mode, phase, joey, headYaw] (hop phase 0..1 while hopping, slow graze phase otherwise) */
    anim(a) { return [a.mode, a.st === 'hop' ? a.hp : 0.5 + 0.5 * Math.sin(a.ph), a.joey, a.look]; }
  };
  return api;
}
export function createEmuSim(defs, env, seed = 3) {
  let R = rng(seed);
  const make = () => defs.map((d, i) => { const w = env.world(d.s, d.u); return { i, x: w.x, z: w.z, home: [w.x, w.z], h: w.th + (R() - 0.5) * 0.6, v: 0, st: 'peck', tm: lerpR(R, EMU.peck), ph: R() * 6, peck: 1, run: 0, lean: 0, yawRate: 0, side: d.u < 0 ? -1 : 1, done: false, wantH: w.th }; });
  let A = make();
  return {
    animals: () => A, reset(sd) { R = rng(sd || seed); A = make(); },
    step(dt, ute) {
      for (const a of A) {
        const [s, u] = env.toTrack(a.x, a.z), road = env.world(s, u).th, [us] = env.toTrack(ute.x, ute.z);
        if (!a.done && (a.st === 'peck' || a.st === 'walk') && s - us < EMU.trigger && s - us > 0) { a.st = 'run'; a.tm = lerpR(R, EMU.runTime); a.vT = lerpR(R, EMU.runSpeed); a.done = true; }
        a.tm -= dt; let vT = 0, wantH = a.h;
        if (a.st === 'run') { vT = a.vT; wantH = road + a.side * 0.05; if (a.tm <= 0) { a.st = 'curve'; a.tm = 2.5; } }
        else if (a.st === 'curve') { vT = Math.max(EMU.walkSpeed, a.v - 2.6 * dt * 2); wantH = road - a.side * (Math.PI / 2) * 0.85; if (a.tm <= 0) { a.st = 'walk'; a.tm = lerpR(R, EMU.walk); } }
        else if (a.st === 'walk') { vT = EMU.walkSpeed; if (!a.done) { const hx = a.home[0] - a.x, hz = a.home[1] - a.z; if (Math.hypot(hx, hz) > 3) wantH = Math.atan2(hx, hz); } if (a.tm <= 0) { a.st = 'peck'; a.tm = lerpR(R, EMU.peck); } }
        else if (a.st === 'peck') { vT = 0; if (a.tm <= 0) { a.st = 'walk'; a.tm = lerpR(R, EMU.walk); a.h += (R() - 0.5) * 0.8; } wantH = a.h; }
        /* never toward the road */
        if (Math.abs(u) < EMU.keepOut) wantH = road - a.side * Math.PI / 2;
        const d = wrapA(wantH - a.h), mx = EMU.turnRate * dt, turn = Math.abs(d) < mx ? d : Math.sign(d) * mx; a.h += turn; a.yawRate = turn / Math.max(dt, 1e-4);
        /* speed eases toward target, slower through turns */
        const vTurn = vT * (1 - Math.min(0.5, Math.abs(d) * 0.4)); a.v += (vTurn - a.v) * Math.min(1, dt * 1.8);
        a.x += Math.sin(a.h) * a.v * dt; a.z += Math.cos(a.h) * a.v * dt;
        const stride = a.v > 3 ? EMU.stride.run : EMU.stride.walk; a.ph += (a.v * dt / stride) * Math.PI * 2;
        a.run += ((a.v > 3 ? 1 : 0) - a.run) * Math.min(1, dt * 3); a.peck += ((a.st === 'peck' ? 1 : 0) - a.peck) * Math.min(1, dt * 2.5);
        a.lean += (-a.yawRate * a.v * 0.035 - a.lean) * Math.min(1, dt * 5);
      }
    },
    anim(a) { return [a.run, a.ph, a.peck, Math.min(1, a.v / 1.2)]; }
  };
}

/* ================================================================ brand placements (structures only; the logo itself is never drawn
   in code: the official file is placed as a texture by the game, scale and position only). Black and #FFC600, matte, lit by the
   colour script. Each returns facets plus meta.face / meta.decal = where the textured face or the logo decal goes (local space). */
const BLACK = C.black;
export function brandBillboard() {
  const f = new Facets(), fx = [1, 0, 0, 0], W = 5.0, H = 2.5, y0 = 2.4;
  for (const x of [-2.0, 0, 2.0]) bevelBox(f, [x, (y0 + H - 0.2 - 0.6) / 2, -0.25], 0.16, y0 + H - 0.2 + 0.6, 0.16, 0.02, () => C.steel, fx);
  for (const y of [y0 + 0.5, y0 + H - 0.5]) bevelBox(f, [0, y, -0.25], 4.3, 0.1, 0.1, 0.02, () => C.steel, fx);
  bevelBox(f, [0, y0 + H / 2, -0.05], W, H, 0.12, 0.03, (n) => n[2] > 0.5 ? BLACK : shade(C.steel, 0.5), fx);
  f.casters.push({ p: [0, y0 + H / 2, 0], r: W / 2, sy: 0.5 }); f.meta = { face: { w: W - 0.08, h: H - 0.08, cy: y0 + H / 2, z: 0.035 } };
  return f;
}
export function brandGate(span = 11.2) {
  const f = new Facets(), fx = [1, 0, 0, 0], H = 4.6, hb = 1.4;
  for (const x of [-span / 2, span / 2]) { bevelBox(f, [x, (H - 0.6) / 2, 0], 0.42, H + 0.6, 0.42, 0.04, () => BLACK, fx); for (let i = 0; i < 4; i++) bevelBox(f, [x, 0.6 + i * 0.9, 0], 0.44, 0.22, 0.44, 0.03, () => C.yellow, fx); f.casters.push({ p: [x, 0, 0], q: [x, H, 0], r: 0.25 }); }
  bevelBox(f, [0, H + 0.1, 0], span + 0.4, 0.3, 0.36, 0.04, () => BLACK, fx);
  bevelBox(f, [0, H + 0.25 + hb / 2, 0], 6.2, hb, 0.14, 0.03, (n) => n[2] > 0.5 ? BLACK : shade(BLACK, 1.4), fx);
  bevelBox(f, [0, H + 0.2, 0.08], 6.2, 0.07, 0.04, 0.01, () => C.yellow, fx);
  f.casters.push({ p: [-span / 2, H, 0], q: [span / 2, H, 0], r: 0.3 }); f.meta = { face: { w: 6.1, h: hb - 0.08, cy: H + 0.25 + hb / 2, z: 0.095 } };
  return f;
}
export function brandCrate(s = 0.9) {
  const f = new Facets(), fx = [1, 0, 0, 0], h = s * 0.75;
  bevelBox(f, [0, h / 2, 0], s, h, s * 0.75, 0.04, (n) => lit(BLACK, n, 0.25), fx);
  bevelBox(f, [0, h * 0.78, 0], s + 0.02, h * 0.12, s * 0.75 + 0.02, 0.01, () => C.yellow, fx);
  f.casters.push({ p: [0, h / 2, 0], r: s * 0.5 }); f.meta = { decal: { x: 0, y: h * 0.42, z: s * 0.375 + 0.012, w: s * 0.7 } };
  return f;
}
export function brandFlag() {
  const f = new Facets(), fx = [1, 0, 0, 0], ref = [0.7, 3.4, -1], ref2 = [0.7, 3.4, 1];
  bar(f, [0, -0.3, 0], [0, 4.0, 0], 0.035, C.steel, fx, 6);
  const q = [[0.05, 3.85, 0], [1.25, 3.85, 0], [1.25, 3.15, 0], [0.05, 3.15, 0]], y = [[0.05, 3.2, 0], [1.25, 3.2, 0], [1.25, 3.15, 0], [0.05, 3.15, 0]];
  f.quad(...q, BLACK, fx, ref); f.quad(...q, BLACK, fx, ref2);
  f.quad(...y.map(p => [p[0], p[1], 0.003]), C.yellow, fx, ref2); f.quad(...y.map(p => [p[0], p[1], -0.003]), C.yellow, fx, ref);
  f.meta = { decal: { x: 0.65, y: 3.55, z: 0.006, w: 0.95 } };
  return f;
}
export function brandBanner(w = 4.4) {
  const f = new Facets(), fx = [1, 0, 0, 0], y0 = 1.9, h = 0.9;
  for (const x of [-w / 2 - 0.1, w / 2 + 0.1]) bar(f, [x, -0.3, 0], [x, y0 + h + 0.25, 0], 0.05, C.steel, fx, 6);
  bevelBox(f, [0, y0 + h / 2, 0], w, h, 0.05, 0.015, (n) => n[2] > 0.5 ? BLACK : shade(BLACK, 1.3), fx);
  for (const y of [y0 + 0.04, y0 + h - 0.04]) bevelBox(f, [0, y, 0.03], w, 0.06, 0.02, 0.005, () => C.yellow, fx);
  f.meta = { face: { w: w - 0.1, h: h - 0.2, cy: y0 + h / 2, z: 0.05 } };
  return f;
}
export function bunting(len = 8, n = 12) {
  const f = new Facets(), fx = [0, 0.3, 0, 0];
  for (let i = 0; i < n; i++) { const x0 = -len / 2 + (i / n) * len, x1 = x0 + len / n * 0.85, sag = 0.25 * Math.sin(Math.PI * (i + 0.5) / n), y = 2.6 - sag; const c = i % 2 ? C.yellow : BLACK;
    f.tri([x0, y, 0], [x1, y, 0], [(x0 + x1) / 2, y - 0.32, 0], c, fx, [0, y, -1]); f.tri([x0, y, 0], [x1, y, 0], [(x0 + x1) / 2, y - 0.32, 0], c, fx, [0, y, 1]); }
  return f;
}

/* the library, for counts and for the README */
export const LIBRARY = {
  'gum (ghost, tall)': () => gum(1, 0), 'gum (spreading)': () => gum(2, 1), 'gum (young)': () => gum(3, 2), 'gum far LOD': () => gum(1, 0, 1),
  'spinifex (hummock)': () => spinifex(1, 0), 'spinifex (ring)': () => spinifex(2, 1), 'spinifex (clump)': () => spinifex(3, 2),
  'termite mound (cathedral)': () => termite(1, 0), 'termite mound (squat)': () => termite(2, 1),
  'rock (boulder)': () => rock(1, 0), 'rock (slab)': () => rock(2, 1), 'rock (tall)': () => rock(3, 2), 'log': () => log(1), 'pebble': () => pebble(1),
  'mesa': () => mesa(1, 0), 'butte': () => mesa(2, 1), 'ridge': () => mesa(3, 2),
  'pickup swag': swag, 'pickup esky': esky, 'pickup jerry can': jerry, 'pickup firewood': firewood, 'hazard marker': hazardMarker, 'rock fall': () => rockFall(1), 'camp sign': campSign,
  'tent': tent, 'campfire': () => campfire(2), 'camp chair': () => chair(1), 'windmill tower': windmillTower, 'windmill rotor': windmillRotor, 'water tank': waterTank, 'station gate + cattle grid': stationGate,
  'roo': roo, 'tumbleweed': () => tumbleweed(4),
  'sign: kangaroo': () => wildlifeSign('roo'), 'sign: emu': () => wildlifeSign('emu'), 'sign: wombat': () => wildlifeSign('wombat'), 'sign: cattle': () => wildlifeSign('cattle'),
  'sign: camel/wombat/roo NEXT 90 km': tripleSign, 'board: CAMP gantry (face is a texture)': distanceGantry,
  'brand billboard (face is a texture)': brandBillboard, 'brand gate (header face is a texture)': () => brandGate(), 'brand crate': () => brandCrate(), 'brand flag': brandFlag, 'brand finish banner': () => brandBanner(), 'bunting': () => bunting(),
  'mailbox drum': mailboxDrum, 'dunny': dunny, 'billy': billy, 'goanna on rock': goanna, 'road train': roadTrain,
  'kangaroo (rigged, with joey)': () => { const f = new Facets(); for (const [p] of roo2(true)) f.add(p); return f; }, 'emu (rigged)': () => { const f = new Facets(); for (const [p] of emu()) f.add(p); return f; }
};

/* ================================================================ track, road and terrain.
   A track is { s0, s1, at(s, out) -> out {x, y, z, th} } with heading th (radians, 0 = +Z, +th turns toward +X).
   Lateral u > 0 is to the driver's right. world(s, u) = centre + u * R, R = (-cos th, 0, sin th). */
export function trackFromFunctions(s0, s1, headingFn, heightFn, step = 0.5) {
  const n = Math.ceil((s1 - s0) / step) + 1, X = new Float64Array(n), Z = new Float64Array(n), TH = new Float64Array(n);
  let x = 0, z = 0;
  for (let i = 0; i < n; i++) { const s = s0 + i * step, th = headingFn(s); TH[i] = th; X[i] = x; Z[i] = z; const thm = headingFn(s + step * 0.5); x += Math.sin(thm) * step; z += Math.cos(thm) * step; }
  const T = {
    s0, s1, step, X, Z, TH, height: heightFn,
    at(s, o = {}) { const f = Math.min(n - 1.001, Math.max(0, (s - s0) / step)), i = Math.floor(f), a = f - i; o.x = X[i] + (X[i + 1] - X[i]) * a; o.z = Z[i] + (Z[i + 1] - Z[i]) * a; o.th = TH[i] + (TH[i + 1] - TH[i]) * a; o.y = heightFn(s); return o; },
    world(s, u, o = {}) { T.at(s, o); const c = Math.cos(o.th), sn = Math.sin(o.th); o.x += -c * u; o.z += sn * u; return o; },
    /* nearest track coords of a world point (local search from a hint) */
    toTrack(x, z, hint) {
      let best = 1e18, bi = 0; const lo = hint === undefined ? 0 : Math.max(0, Math.floor((hint - 40 - s0) / step)), hi = hint === undefined ? n - 1 : Math.min(n - 1, Math.ceil((hint + 40 - s0) / step));
      for (let i = lo; i <= hi; i++) { const d = (X[i] - x) ** 2 + (Z[i] - z) ** 2; if (d < best) { best = d; bi = i; } }
      const th = TH[bi], fx = Math.sin(th), fz = Math.cos(th), dx = x - X[bi], dz = z - Z[bi];
      return [s0 + bi * step + dx * fx + dz * fz, -dx * Math.cos(th) + dz * Math.sin(th)];
    }
  };
  return T;
}
/* ground height across the corridor. P: { roadHalf, bank, hills } */
export const ROAD = { half: 3.8, gutter: 4.5, bankTop: 6.5 };
export function groundHeight(T, s, u, opt = {}) {
  const yr = T.height(s), au = Math.abs(u), side = u < 0 ? -1 : 1;
  if (au <= ROAD.half) { const h0 = yr - 0.05 * (au / ROAD.half) ** 2; return opt.road ? h0 + opt.road(s, u, h0) : h0; }
  if (au <= ROAD.gutter) { const h0 = yr - 0.05 - 0.14 * smooth(ROAD.half, ROAD.gutter, au); return opt.road ? h0 + opt.road(s, u, h0) : h0; }
  const bankH = 0.45 + 0.55 * (fbm(s * 0.035, side * 3.1, 2) * 0.5 + 0.5);
  let h = yr - 0.19 + (bankH + 0.19) * smooth(ROAD.gutter, ROAD.bankTop + 1.5, au);
  const k = smooth(8, 70, au), kf = smooth(60, 150, au);
  h += k * (2.6 * fbm(s * 0.012 + 3, u * 0.016, 3) + 1.8) + kf * (6 * (fbm(s * 0.006 + 9, u * 0.009 + side * 4, 2) * 0.5 + 0.5));
  h += 0.18 * fbm(s * 0.21, u * 0.23, 2) * smooth(5, 9, au);
  if (opt.creek) h += opt.creek(s, u, h);
  return h;
}
/* columns across the corridor: [u, step along s]; the zip stitcher joins columns with different steps without cracks */
export const COLUMNS = (() => {
  const c = [];
  const roadU = [0, 0.62, 0.98, 2.35, 2.85, 3.8], out = [4.5, 5.4, 6.5, 7.8, 9.5, 12, 15, 19, 24, 30, 38, 48, 60, 75, 95, 120, 150];
  const stepAt = au => au <= 9.5 ? 0.9 : au <= 19 ? 1.8 : au <= 48 ? 3.6 : au <= 95 ? 7.2 : 14.4;
  for (const u of [...out].reverse()) c.push([-u, stepAt(u)]);
  for (const u of [...roadU].reverse()) if (u) c.push([-u, 0.9]);
  for (const u of roadU) c.push([u, 0.9]);
  for (const u of out) c.push([u, stepAt(u)]);
  return c;
})();
/* build the terrain + road for s in [sA, sB) into a Facets; colourFn(s, u, n, cen) chooses each face's swatch */
export function buildTerrain(f, T, sA, sB, opt = {}) {
  const P = (s, u) => { const o = T.world(s, u); return [o.x, groundHeight(T, s, u, opt), o.z]; };
  const colsV = COLUMNS.map(([u, st], ci) => {
    const pts = []; const s0 = Math.floor(sA / st) * st;
    for (let s = s0; s < sB + st - 1e-6; s += st) {
      const edge = s <= sA || s >= sB, onRoad = Math.abs(u) <= ROAD.half + 0.01, jitS = edge ? 0 : (hash2(ci * 3.7, s * 1.3) - 0.5) * st * 0.5;
      const jitU = edge || onRoad || Math.abs(u) <= ROAD.gutter ? 0 : (hash2(ci * 1.9 + 7, s * 0.7) - 0.5) * (Math.abs(u) * 0.08 + 0.3);
      /* interior vertices keep a third of a step clear of the chunk edges (a sliver there gets a wild normal and shows as a bright line) */
      const m = st * 0.33, sj = s + jitS, ss = edge ? Math.min(sB, Math.max(sA, s)) : (sj > sA + m && sj < sB - m ? sj : s), uu = u + (edge ? 0 : jitU);
      if (!edge && !(ss > sA + m && ss < sB - m)) continue; if (edge && pts.length && pts[pts.length - 1].s === ss) continue; pts.push({ s: ss, u: uu, p: P(ss, uu) });
    }
    /* both chunk edges always carry a vertex (float accumulation can leave the last sample a hair short of sB) */
    if (!pts.length || pts[0].s !== sA) pts.unshift({ s: sA, u, p: P(sA, u) });
    if (pts[pts.length - 1].s !== sB) pts.push({ s: sB, u, p: P(sB, u) });
    return pts;
  });
  const col = opt.colour || defaultGroundColour;
  const emit = (a, b, c) => { const n = faceN(a.p, b.p, c.p); if (n[1] < 0) { f.tri(a.p, c.p, b.p, col((a.s + b.s + c.s) / 3, (a.u + b.u + c.u) / 3, [-n[0], -n[1], -n[2]]), [1, 0, 0, 0]); f.T.push(a.s, a.u, c.s, c.u, b.s, b.u); return; } f.tri(a.p, b.p, c.p, col((a.s + b.s + c.s) / 3, (a.u + b.u + c.u) / 3, n), [1, 0, 0, 0]); f.T.push(a.s, a.u, b.s, b.u, c.s, c.u); };
  for (let c = 0; c < colsV.length - 1; c++) {
    const L = colsV[c], R = colsV[c + 1]; let i = 0, j = 0;
    while (i < L.length - 1 || j < R.length - 1) {
      const advL = j >= R.length - 1 || (i < L.length - 1 && L[i + 1].s <= R[j + 1].s);
      if (advL) { emit(L[i], R[j], L[i + 1]); i++; } else { emit(L[i], R[j], R[j + 1]); j++; }
    }
  }
}
export function defaultGroundColour(s, u, n) {
  const au = Math.abs(u);
  if (au <= ROAD.half) { if (au > 0.62 && au < 0.98) return mix3(C.road, C.roadLine, 0.62); if (au > 2.35 && au < 2.85) return mix3(C.road, C.roadLine, 0.22); return hash2(Math.floor(s * 0.8), Math.floor(u * 1.5)) > 0.93 ? shade(C.road, 0.95) : C.road; }
  if (au <= ROAD.gutter) return shade(C.earthDeep, 1.05);
  const v = fbm(s * 0.04, u * 0.05, 2), pick = v > 0.18 ? C.earthOchre : v < -0.22 ? C.earthDeep : C.earthRed;
  return shade(pick, 1 + (hash2(s * 0.37, u * 0.53) - 0.5) * 0.07);
}

/* ================================================================ long-shadow mask, baked in track space (s, u).
   Union of projected casters, then a small blur. One byte per texel; returns { data, w, h, s0, u0, ds, du }. */
export function bakeShadowMask(T, casters, sunAt, rect) {
  const { s0, s1, u0, u1, res = 0.2 } = rect, w = Math.ceil((s1 - s0) / res), h = Math.ceil((u1 - u0) / res), M = new Uint8Array(w * h);
  const tmp = {};
  const ellipse = (cs, cu, as, au, bs, bu) => {
    /* ellipse centre (cs,cu) with axis vectors a=(as,au), b=(bs,bu) in metres; fill */
    const ext = Math.hypot(as, bs) + Math.hypot(au, bu) + 0.5, la = as * as + au * au, lb = bs * bs + bu * bu;
    const x0 = Math.max(0, Math.floor((cs - ext - s0) / res)), x1 = Math.min(w - 1, Math.ceil((cs + ext - s0) / res)), y0 = Math.max(0, Math.floor((cu - ext - u0) / res)), y1 = Math.min(h - 1, Math.ceil((cu + ext - u0) / res));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const ds = s0 + x * res - cs, du = u0 + y * res - cu; const pa = (ds * as + du * au) / la, pb = (ds * bs + du * bu) / lb; if (pa * pa + pb * pb <= 1) M[y * w + x] = 255; }
  };
  for (const c of casters) {
    const [cs, cu] = T.toTrack(c.p[0], c.p[2], c.s);
    if (cs < s0 - 40 || cs > s1 + 40) continue;
    T.at(cs, tmp); const th = tmp.th, sd = sunAt(cs); if (sd[1] <= 0.02) continue;
    /* sun direction into track frame: F = (sin th, cos th), R = (-cos th, sin th) */
    const fS = -(sd[0] * Math.sin(th) + sd[2] * Math.cos(th)), fU = -(-sd[0] * Math.cos(th) + sd[2] * Math.sin(th)), L = Math.hypot(fS, fU) || 1, dS = fS / L, dU = fU / L, cot = Math.hypot(sd[0], sd[2]) / sd[1];
    const gy = groundHeight(T, cs, cu);
    if (c.q) {
      const [qs, qu] = T.toTrack(c.q[0], c.q[2], c.s), hp = Math.max(0, c.p[1] - gy), hq = Math.max(0, c.q[1] - gy);
      const ps = cs + dS * hp * cot, pu = cu + dU * hp * cot, es = qs + dS * hq * cot, eu = qu + dU * hq * cot, n = Math.max(2, Math.ceil(Math.hypot(es - ps, eu - pu) / (c.r * 0.8)));
      for (let k = 0; k <= n; k++) { const t = k / n; ellipse(ps + (es - ps) * t, pu + (eu - pu) * t, c.r, 0, 0, c.r); }
    } else {
      const ct = c.maxLen ? Math.min(cot, c.maxLen / Math.max(1, c.p[1] - gy)) : cot, hh = Math.max(0, c.p[1] - gy), sy = c.sy || 1, ext = c.r * sy * ct;
      ellipse(cs + dS * hh * ct, cu + dU * hh * ct, dS * (c.r + ext * 0.5), dU * (c.r + ext * 0.5), -dU * c.r, dS * c.r);
    }
  }
  /* soften: one 3x3 box pass */
  const O = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0, n = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < w && yy < h) { a += M[yy * w + xx]; n++; } } O[y * w + x] = a / n; }
  return { data: O, w, h, s0, u0, ds: s1 - s0, du: u1 - u0 };
}

/* ================================================================ GLSL shared by the world material, the ute patch and the sky */
export const TONE_GLSL = `
#ifndef KIT_TONE_DEF
#define KIT_TONE_DEF
vec3 kitTone(vec3 c) {
  float m = max(max(c.r, c.g), c.b);
  if (m <= 0.8) return c;
  float f = 0.8 + 0.2 * (1.0 - exp(-(m - 0.8) / 0.2));
  vec3 r = c * (f / m);
  return mix(r, vec3(f), smoothstep(1.4, 7.0, m) * 0.85);
}
#endif`;
export const HAZE_GLSL = `
uniform vec3 uSunDir; uniform vec3 uHzSun; uniform vec3 uHzAnti; uniform float uFogD; uniform vec4 uMist; uniform vec3 uMistCol; uniform float uMistH;
vec3 hazeCol(vec3 d) { float sa = dot(normalize(d.xz + 1e-5), normalize(uSunDir.xz + 1e-5)) * 0.5 + 0.5; return mix(uHzAnti, uHzSun, sa * sa * sa); }
vec3 applyHaze(vec3 col, vec3 wp) {
  vec3 d = wp - cameraPosition; float dist = length(d);
  float f = 1.0 - exp(-uFogD * dist);
  f *= mix(1.0, 0.55, smoothstep(10.0, 90.0, wp.y));
  col = mix(col, hazeCol(d), f);
  float mz = uMist.w * smoothstep(uMist.z, uMist.z * 0.3, length(wp.xz - uMist.xy)) * exp(-max(wp.y - uMistH, 0.0) * 1.6) * (0.6 + 0.4 * smoothstep(5.0, 40.0, dist));
  return mix(col, uMistCol, clamp(mz, 0.0, 0.85));
}`;
/* the world material: Lambert with vertex colours and split normals, a stepped (toon-ramp) key, cool ambient, baked long
   shadows from the mask, rim on foliage, foliage sway, emissive glow (pickups, flames with flicker), height haze + creek mist */
export function createUniforms(THREE) {
  return {
    uTime: { value: 0 }, uSway: { value: 1 }, uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uHzSun: { value: new THREE.Color() }, uHzAnti: { value: new THREE.Color() },
    uFogD: { value: 0.0016 }, uMask: { value: null }, uMaskRect: { value: new THREE.Vector4(0, 0, 1, 1) }, uRim: { value: new THREE.Color() }, uRamp: { value: new THREE.Vector4(0.28, 0.06, 0.55, 0.55) },
    uShadowK: { value: 0.85 }, uGlowK: { value: 1 }, uFlicker: { value: 1 }, uMist: { value: new THREE.Vector4(0, 0, 1, 0) }, uMistCol: { value: new THREE.Color(1, 1, 1) }, uMistH: { value: 1.2 },
    uExposure: { value: 1 }, uGrade: { value: new THREE.Vector4(0, 0, 0, 0) },
    uSunC: { value: new THREE.Color() }, uHemiS: { value: new THREE.Color() }, uHemiG: { value: new THREE.Color() }
  };
}
export const RAMP_GLSL = `
uniform vec4 uRamp; float kVis = 1.0;
float kitRamp(float d) { float t = 0.6 * smoothstep(-0.02, 0.05, d) + 0.4 * smoothstep(uRamp.x - uRamp.y, uRamp.x + uRamp.y, d); return mix(clamp(d, 0.0, 1.0), t, uRamp.w); }`;
export function patchWorld(THREE, m, U, opt = {}) {
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aTrk; attribute vec4 aFx; varying vec2 vTrk; varying vec4 vFx; varying vec3 vKW; uniform float uTime; uniform float uSway;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vTrk = aTrk; vFx = aFx;
        if (aFx.y > 0.0) { float ph = uTime * 1.5 + position.x * 0.31 + position.z * 0.23; float h = aFx.y * uSway * clamp(position.y * 0.12, 0.0, 1.0);
          transformed.x += h * (sin(ph) * 0.09 + sin(ph * 2.7 + 1.3) * 0.03); transformed.z += h * cos(ph * 0.83) * 0.07; transformed.y += h * sin(ph * 1.9) * 0.025; }`)
      .replace('#include <project_vertex>', '#include <project_vertex>\nvKW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <lights_lambert_pars_fragment>', THREE.ShaderChunk.lights_lambert_pars_fragment)
      .replace('#include <common>', `#include <common>
        varying vec2 vTrk; varying vec4 vFx; varying vec3 vKW; uniform sampler2D uMask; uniform vec4 uMaskRect; uniform vec3 uRim; uniform float uShadowK; uniform float uGlowK; uniform float uFlicker; uniform float uExposure;
        ${RAMP_GLSL}
        ${HAZE_GLSL}`)
      .replace('float dotNL = saturate( dot( geometryNormal, directLight.direction ) );', 'float dotNL = kitRamp(dot( geometryNormal, directLight.direction )) * kVis;')
      .replace('#include <lights_lambert_fragment>', `#include <lights_lambert_fragment>
        { vec2 mt = (vTrk - uMaskRect.xy) * uMaskRect.zw; float inside = step(0.0, mt.x) * step(mt.x, 1.0) * step(0.0, mt.y) * step(mt.y, 1.0);
          kVis = 1.0 - texture2D(uMask, mt).r * inside * vFx.x * uShadowK; }`)
      .replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
        { vec3 Vv = normalize(vViewPosition); float fr = pow(1.0 - clamp(dot(normal, Vv), 0.0, 1.0), 2.5);
          vec3 nw = (vec4(normal, 0.0) * viewMatrix).xyz; float sunSide = clamp(dot(normalize(nw.xz + 1e-4), normalize(uSunDir.xz + 1e-4)) * 0.5 + 0.5, 0.0, 1.0);
          totalEmissiveRadiance += uRim * fr * vFx.z * sunSide * diffuseColor.rgb * 1.6;
          totalEmissiveRadiance += diffuseColor.rgb * vFx.w * uGlowK * (vFx.w > 1.9 ? uFlicker : 1.0); }`)
      .replace('#include <opaque_fragment>', 'outgoingLight = applyHaze(outgoingLight, vKW) * uExposure;\nif (any(isnan(outgoingLight))) outgoingLight = vec3(0.0);\n#include <opaque_fragment>')
      .replace('#include <fog_fragment>', '');
  };
  m.customProgramCacheKey = () => 'kitworld' + (opt.key || '');
  return m;
}
/* collectibles: one calm marker only, the glowing ground ring (yellow, the reserved pickup colour). Each piece gets its own
   material instance (same program) so its ring can pulse in step along a line (uGlowK) and the gear can bob (uBob) while the
   ring stays on the ground. Tall markers are reserved for hazards and gates. */
export function createPickupMaterial(THREE, U) {
  const own = { uGlowK: { value: 1 }, uBob: { value: 0 } };
  const m = new THREE.MeshLambertMaterial({ vertexColors: true }); patchWorld(THREE, m, { ...U, ...own }, { key: 'pickup' });
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => { prev(sh, r); Object.assign(sh.uniforms, own);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uBob;').replace('#include <project_vertex>', 'if (aFx.w < 0.5) transformed.y += uBob;\n#include <project_vertex>'); };
  m.userData.pickup = own; return m;
}
export function createWorldMaterial(THREE, U) {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true });
  return patchWorld(THREE, m, U);
}
/* sky: stepped graphic gradient (sun side vs anti-sun side), graphic sun disc with flat halos, moon, flat two-tone clouds */
export function createSkyMaterial(THREE, U) {
  const S = {
    uSkySun: { value: [0, 1, 2, 3].map(() => new THREE.Color()) }, uSkyAnti: { value: [0, 1, 2, 3].map(() => new THREE.Color()) },
    uSunCol: { value: new THREE.Color() }, uDisc: { value: 0.03 }, uGlow: { value: 0.5 }, uMoon: { value: 0 }, uCloudLit: { value: new THREE.Color() }, uCloudBody: { value: new THREE.Color() },
    uClouds: { value: [new THREE.Vector4(0.15, 0.085, 0.16, 0.035), new THREE.Vector4(-0.32, 0.12, 0.12, 0.028), new THREE.Vector4(0.55, 0.06, 0.2, 0.03), new THREE.Vector4(-0.7, 0.07, 0.15, 0.03), new THREE.Vector4(2.6, 0.08, 0.22, 0.04), new THREE.Vector4(-2.4, 0.1, 0.18, 0.03)] },
    uBands: { value: 9 }, uTone: { value: 1 }
  };
  const mat = new THREE.ShaderMaterial({
    uniforms: { ...U, ...S },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `varying vec3 vDir; uniform vec3 uSkySun[4]; uniform vec3 uSkyAnti[4]; uniform vec3 uSunCol; uniform float uDisc; uniform float uGlow; uniform float uMoon; uniform vec3 uCloudLit; uniform vec3 uCloudBody; uniform vec4 uClouds[6]; uniform float uBands; uniform float uExposure; uniform float uTone;
      ${HAZE_GLSL}
      vec3 ramp4(vec3 c[4], float e) { float t0 = smoothstep(0.0, 0.07, e), t1 = smoothstep(0.05, 0.25, e), t2 = smoothstep(0.22, 0.75, e); return mix(mix(mix(c[0], c[1], t0), c[2], t1), c[3], t2); }
      void main(){
        vec3 d = normalize(vDir); float e = max(d.y, 0.0);
        float q = e * uBands; float eq = (floor(q) + smoothstep(0.42, 0.58, fract(q))) / uBands; eq = mix(eq, e, smoothstep(0.0, 0.05, e) * 0.0 + 0.15);
        vec2 dz = normalize(d.xz + 1e-5), sz = normalize(uSunDir.xz + 1e-5); float sa = dot(dz, sz) * 0.5 + 0.5; float sa3 = sa * sa * sa;
        vec3 c = mix(ramp4(uSkyAnti, eq), ramp4(uSkySun, eq), sa3);
        if (d.y < 0.0) c = hazeCol(d);
        /* sun: flat disc, two flat halos, soft glow */
        float cs = dot(d, normalize(uSunDir)); float ang = acos(clamp(cs, -1.0, 1.0)); float aa = fwidth(ang) * 1.5;
        c += uSunCol * uGlow * (0.22 * (1.0 - smoothstep(uDisc * 2.2 - aa, uDisc * 2.2 + aa, ang)) + 0.12 * (1.0 - smoothstep(uDisc * 4.0 - aa, uDisc * 4.0 + aa, ang)) + 0.35 * exp(-ang * 5.0));
        float disc = 1.0 - smoothstep(uDisc - aa, uDisc + aa, ang); c = mix(c, uSunCol * 2.4, disc * step(0.0005, uDisc));
        /* moon opposite the sun, a little higher */
        vec3 md = normalize(vec3(-uSunDir.x, 0.12, -uSunDir.z)); float ma = acos(clamp(dot(d, md), -1.0, 1.0)); float mm = (1.0 - smoothstep(0.022 - aa, 0.022 + aa, ma)) * uMoon; c = mix(c, vec3(1.0, 0.93, 0.88), mm * 0.85);
        /* flat clouds: union of circles in (azimuth, elevation), flat underside, lit lower band */
        float az = atan(d.x, d.z), el = asin(clamp(d.y, -1.0, 1.0));
        for (int i = 0; i < 6; i++) { vec4 cl = uClouds[i]; float dx = az - cl.x; dx = mod(dx + 3.14159, 6.28318) - 3.14159; vec2 p = vec2(dx / cl.z, (el - cl.y) / cl.w);
          float k = max(max(1.0 - length(p - vec2(-0.5, 0.0)) / 0.5, 1.0 - length(p - vec2(0.0, 0.25)) / 0.62), max(1.0 - length(p - vec2(0.48, 0.05)) / 0.45, 1.0 - length(p - vec2(0.15, 0.6)) / 0.42));
          float ca = fwidth(k) * 1.2; float inside = smoothstep(-ca, ca, k) * smoothstep(-0.05, 0.02, p.y);
          float lower = 1.0 - smoothstep(0.18, 0.24, p.y); vec3 cc = mix(uCloudBody, uCloudLit, lower * (0.4 + 0.6 * sa));
          c = mix(c, cc, inside); }
        c *= uExposure; gl_FragColor = vec4(mix(c, kitTone(c), uTone), 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false
  });
  mat.fragmentShader = TONE_GLSL + '\n' + mat.fragmentShader;
  return { mat, S };
}
/* apply a blended moment to the uniforms + lights */
export function applyMoment(THREE, m, U, sky, lights) {
  const sd = sunDirOf(m); U.uSunDir.value.set(sd[0], sd[1], sd[2]).normalize();
  U.uHzSun.value.setRGB(...m.hazeSun); U.uHzAnti.value.setRGB(...m.hazeAnti); U.uFogD.value = m.fog; U.uRim.value.setRGB(...m.rim).multiplyScalar(m.rimI);
  U.uShadowK.value = m.shadowK; U.uExposure.value = m.exposure;
  { const vis = Math.max(0, Math.min(1, (m.sunEl + 2) / 4)); U.uSunC.value.setRGB(...m.sunCol).multiplyScalar(m.sunI * vis); U.uHemiS.value.setRGB(...m.hemiSky).multiplyScalar(m.hemiI); U.uHemiG.value.setRGB(...m.hemiGround).multiplyScalar(m.hemiI); }
  if (sky) { for (let i = 0; i < 4; i++) { sky.S.uSkySun.value[i].setRGB(...m.skySun[i]); sky.S.uSkyAnti.value[i].setRGB(...m.skyAnti[i]); } sky.S.uSunCol.value.setRGB(...m.discCol); sky.S.uDisc.value = m.disc; sky.S.uGlow.value = m.glow; sky.S.uMoon.value = m.moon; sky.S.uCloudLit.value.setRGB(...m.cloudLit); sky.S.uCloudBody.value.setRGB(...m.cloudBody); }
  if (lights) {
    lights.sun.color.setRGB(...m.sunCol); lights.sun.intensity = m.sunI * Math.max(0, Math.min(1, (m.sunEl + 2) / 4));
    lights.hemi.color.setRGB(...m.hemiSky); lights.hemi.groundColor.setRGB(...m.hemiGround); lights.hemi.intensity = m.hemiI;
  }
}
