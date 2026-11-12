/* Trail to Camp v2: the world along the rules' trail, in the style kit's language (kit.js). Pure JS (no three.js, no DOM): the terrain
   worker builds the chunks with it and the view uses the same height, position and colour-script functions, so what is drawn is what
   the wheels feel.
   - The layout is fixed per build (rules LAYOUT.seed = SEED): one trail, one set of road features, so the corridor, its props and the
     long-shadow mask are built once in the worker and kept.
   - Position: track coords (s, u) -> world. Near the road (|u| < 10 m) the exact trail; further out each column is blended toward a
     heavily smoothed copy of the trail, so the far field never folds on the gorge's tight bends (radius down to about 24 m).
   - Height GH(s, u): the rules' groundH on the running surface (|u| <= 4.5 m: the wheels' own ground, so grounding is exact), then the
     kit's gutter, bank and plain; gorge walls in act 2; dry creek beds through the plain; a cleared camp pad.
   - Colour script by trail distance: golden (act 1), late golden into the gorge, sunset into the sun (act 3), dusk at camp. */
import * as K from './kit.js';
import * as L from './rules.js';

export const SEED = 1;
export const GATE_AHEAD = 0;
export let RH = 4.5, GUT = 5.15, BANK = 7.6, CORR = RH + 1.5;
export function setRoad(h, g, b) { RH = h; GUT = g; BANK = b; CORR = RH + 1.5; }
export const WORLD = { s0: -80, s1: 1000, chunk: 40 };
export const NCH = Math.ceil((WORLD.s1 - WORLD.s0) / WORLD.chunk);
export const SCRIPT = [[-80, 'golden'], [230, 'golden'], [470, 'sunset'], [800, 'sunset'], [1150, 'dusk']];
export const momentAt = s => K.momentAt(s, SCRIPT);
export const ACTS = () => [0, L.CONFIG.act2S, L.CONFIG.gateS[2], L.CONFIG.campS];
export const actOf = s => s < L.CONFIG.act2S ? 1 : s < L.CONFIG.gateS[2] ? 2 : 3;

/* ---------- layout setup (idempotent) */
let READY = false;
const SM0 = -400, SMN = 1800, SX = new Float64Array(SMN), SZ = new Float64Array(SMN), STH = new Float64Array(SMN), SY = new Float64Array(SMN);
export function setup() {
  if (READY) return; READY = true;
  L.LAYOUT.seed = SEED; L.reset(SEED);
  /* smoothed trail: three box passes (about a 45 m Gaussian) of the true centreline, extended straight beyond both ends */
  const P = { x: 0, z: 0, th: 0 }, X = new Float64Array(SMN), Z = new Float64Array(SMN), Y = new Float64Array(SMN);
  for (let i = 0; i < SMN; i++) { const s = SM0 + i; L.trailAt(s, 0, P); X[i] = P.x; Z[i] = P.z; Y[i] = L.groundH(Math.max(-40, Math.min(L.NT, s)), 0); }
  const box = (A, r) => { const o = new Float64Array(SMN); let acc = 0; for (let i = -r; i <= r; i++) acc += A[Math.max(0, Math.min(SMN - 1, i))]; for (let i = 0; i < SMN; i++) { o[i] = acc / (2 * r + 1); acc += A[Math.min(SMN - 1, i + r + 1)] - A[Math.max(0, i - r)]; } return o; };
  let x = X, z = Z, y = Y; for (let k = 0; k < 3; k++) { x = box(x, 26); z = box(z, 26); y = box(y, 18); }
  SX.set(x); SZ.set(z); SY.set(y);
  for (let i = 0; i < SMN; i++) { const a = Math.max(0, i - 1), b = Math.min(SMN - 1, i + 1); STH[i] = Math.atan2(SX[b] - SX[a], SZ[b] - SZ[a]); }
  for (let i = 1; i < SMN; i++) { while (STH[i] - STH[i - 1] > Math.PI) STH[i] -= 2 * Math.PI; while (STH[i] - STH[i - 1] < -Math.PI) STH[i] += 2 * Math.PI; }
  buildFeatureIndex();
}
const smAt = (A, s) => { const f = Math.max(0, Math.min(SMN - 1.001, s - SM0)), i = Math.floor(f), a = f - i; return A[i] + (A[i + 1] - A[i]) * a; };
export const ySm = s => smAt(SY, s);
const TP = { x: 0, z: 0, th: 0 };
/* hooks: in the rebased game the style world owns position and height (HOOK.pos = T.world, HOOK.GH = its ground) */
export const HOOK = { pos: null, GH: null };
/* track coords -> world (x, z, heading) */
export function pos(s, u, o = {}) {
  if (HOOK.pos) return HOOK.pos(s, u, o);
  const w = K.smooth(10, 38, Math.abs(u));
  L.trailAt(s, u, TP);
  if (w <= 0) { o.x = TP.x; o.z = TP.z; o.th = TP.th; return o; }
  const th = smAt(STH, s), sx = smAt(SX, s) - Math.cos(th) * u, sz = smAt(SZ, s) + Math.sin(th) * u;
  let d = th - TP.th; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
  o.x = TP.x + (sx - TP.x) * w; o.z = TP.z + (sz - TP.z) * w; o.th = TP.th + d * w; return o;
}
/* world -> track coords near a hint (the true trail; used for the ute, gear and animals, all within about 40 m of the road) */
const TR = { s: 0, u: 0, th: 0 };
export function toTrack(x, z, hint) {
  let best = 1e18, bs = 0; const lo = Math.max(-60, Math.floor((hint == null ? 0 : hint) - 30)), hi = Math.min(L.NT + 40, lo + 61), Q = { x: 0, z: 0, th: 0 };
  if (hint == null) { for (let s = -60; s < L.NT + 40; s += 2) { L.trailAt(s, 0, Q); const d = (Q.x - x) ** 2 + (Q.z - z) ** 2; if (d < best) { best = d; bs = s; } } return toTrack(x, z, bs); }
  for (let s = lo; s <= hi; s++) { L.trailAt(s, 0, Q); const d = (Q.x - x) ** 2 + (Q.z - z) ** 2; if (d < best) { best = d; bs = s; } }
  L.toTrail(x, z, Math.max(0, bs), TR); return [TR.s, TR.u];
}
/* world -> track coords with no hint (animals, lost gear): a coarse cell cache of the nearest trail distance */
const NEAR = new Map();
export function toTrackAny(x, z) { const k = Math.round(x / 12) + ',' + Math.round(z / 12); let h = NEAR.get(k); const r = h == null ? toTrack(x, z, null) : toTrack(x, z, h); if (h == null) NEAR.set(k, r[0]); return r; }
/* the kit's track interface over the rules' trail (for the ground FX and the animal sims) */
export const T = {
  s0: WORLD.s0, s1: WORLD.s1, height: s => L.groundH(s, 0),
  at(s, o = {}) { pos(s, 0, o); o.y = L.groundH(s, 0); return o; },
  world(s, u, o = {}) { return pos(s, u, o); },
  toTrack(x, z, hint) { return toTrack(x, z, hint); }
};

/* ---------- road features from the rules' layout (HZ, BAYS, SIDE), indexed by s for the height and colour lookups */
let FEAT = [], CREEKB = [];
function buildFeatureIndex() {
  FEAT = L.HZ.map(h => ({ type: h.type, s0: h.s0, s1: h.s1, spans: h.spans.map(a => a.slice()), free: h.free.map(a => a.slice()), full: !!h.full, i: h.i }));
  CREEKB = L.CREEKS.map(c => ({ m: c.m, hw: c.hw }));
}
export const features = () => FEAT;
/* a new layout seed (per round): the feature index follows the rules' new hazards */
export function refreshFeatures() { buildFeatureIndex(); }
const inSpan = (spans, u) => { for (const [a, b] of spans) if (u >= a && u <= b) return true; return false; };

/* ---------- height */
const campC = () => ({ s: L.CONFIG.campS + 6, u: -1.6 });
export const CAMP = { s: 0, u: -12 };
function campPad(s, u) { const c = campC(), d = Math.hypot(s - (c.s + 6), u - (c.u - 7)); return K.smooth(26, 14, d); }
export function creekCentre(c, u) { return c.m + 6 * Math.sin(u / 23 + c.m); }
function creekBed(s, u, a) {
  let h = 0;
  for (const c of CREEKB) { const d = s - creekCentre(c, u); if (Math.abs(d) > 20) continue; h -= 1.1 * Math.exp(-((d / 5.5) ** 2)) * K.smooth(5.2, 9.5, a) * K.smooth(160, 50, a); }
  return h;
}
function wall(s, u, a, side) {
  const n = K.fbm(s * 0.03 + side * 7, 1.3, 2), inner = 11.5 + 3.5 * (n * 0.5 + 0.5) + (side > 0 ? 1.5 : 0);
  const rise = K.smooth(inner, inner + 7, a), top = 9 + 7 * (K.fbm(s * 0.017 + side * 3, a * 0.02, 2) * 0.5 + 0.5);
  /* stepped strata: terraces every 2.6 m */
  const raw = rise * top, st = 2.6, k = raw / st, fl = Math.floor(k), fr = k - fl, terr = (fl + K.smooth(0.2, 0.8, fr)) * st;
  return terr * 0.75 + raw * 0.25 + K.smooth(inner + 7, inner + 40, a) * 6;
}
export function GH(s, u) {
  if (HOOK.GH) return HOOK.GH(s, u);
  const a = Math.abs(u);
  if (a <= RH) return L.groundH(s, u);
  const side = u < 0 ? -1 : 1, e = L.groundH(s, side * RH), g = L.gorgeW(s);
  let h = e - 0.13 * K.smooth(RH, GUT, a);
  const bankH = (0.45 + 0.55 * (K.fbm(s * 0.035, side * 3.1, 2) * 0.5 + 0.5)) * (1 + 0.6 * g);
  h += (bankH + 0.13) * K.smooth(GUT, BANK + 1.2, a);
  h += (ySm(s) - e) * K.smooth(9, 40, a);
  const k = K.smooth(10, 70, a) * (1 - 0.7 * g), kf = K.smooth(60, 150, a);
  h += k * (2.6 * K.fbm(s * 0.012 + 3, u * 0.016, 3) + 1.8) + kf * (6 * (K.fbm(s * 0.006 + 9, u * 0.009 + side * 4, 2) * 0.5 + 0.5));
  h += 0.18 * K.fbm(s * 0.21, u * 0.23, 2) * K.smooth(5.5, 9, a);
  if (g > 0) h += g * wall(s, u, a, side);
  h += creekBed(s, u, a);
  const cp = campPad(s, u); if (cp > 0) h += (L.groundH(campC().s, 0) - 0.06 - h) * cp * K.smooth(RH, RH + 1.2, a);
  return h;
}

/* ---------- colour per face (kit palette) */
const C = K.C;
export function colour(s, u, n) {
  const a = Math.abs(u);
  if (a <= RH) {
    for (const f of FEAT) if (f.type === 'creek' && s > f.s0 - 1.4 && s < f.s1 + 1.4 && inSpan(f.free, u)) return K.shade(C.sand, 1.02);
    if (a > 0.62 && a < 0.98) return K.mix3(C.road, C.roadLine, 0.62);
    if (a > 2.35 && a < 2.85) return K.mix3(C.road, C.roadLine, 0.22);
    return C.road;
  }
  if (a <= GUT) return K.shade(C.earthDeep, 1.05);
  for (const c of CREEKB) { const d = Math.abs(s - creekCentre(c, u)); if (d < 4.4 && a < 160) return K.shade(C.sand, 1 + (K.hash2(s * 0.7, u * 0.9) - 0.5) * 0.08); }
  if (campPad(s, u) > 0.6 && a > RH + 1) return K.shade(K.mix3(C.sand, C.earthOchre, 0.5), 1 + (K.hash2(s * 0.7, u * 0.9) - 0.5) * 0.06);
  const g = L.gorgeW(s);
  if (g > 0.3 && a > 10) {
    /* gorge walls: strata bands by height, steep faces in rock red */
    const y = GH(s, u) - ySm(s), band = Math.floor(y / 2.6 + K.fbm(s * 0.02, u * 0.02, 1) * 0.6) % 3;
    if (n && n[1] < 0.72) return K.shade(band === 0 ? C.rockRed : band === 1 ? C.earthDeep : C.earthRed, 0.98 + (K.hash2(s * 0.37, u * 0.53) - 0.5) * 0.08);
    return K.shade(band === 1 ? C.earthOchre : C.earthRed, 1 + (K.hash2(s * 0.37, u * 0.53) - 0.5) * 0.07);
  }
  const v = K.fbm(s * 0.04, u * 0.05, 2), pick = v > 0.18 ? C.earthOchre : v < -0.22 ? C.earthDeep : C.earthRed;
  return K.shade(pick, 1 + (K.hash2(s * 0.37, u * 0.53) - 0.5) * 0.07);
}

/* ---------- terrain: columns across the corridor, zip-stitched (the kit's buildTerrain with our widths and a finer road) */
const roadU = [0, 0.62, 0.98, 1.65, 2.35, 2.85, 3.5, 4.5], outU = [GUT, 6.2, BANK, 9.5, 12, 15, 19, 24, 30, 38, 48, 60, 75, 95, 120, 150];
const stepOut = a => a <= 9.5 ? 0.9 : a <= 19 ? 1.8 : a <= 48 ? 3.6 : a <= 95 ? 7.2 : 14.4;
export const COLUMNS = (() => { const c = []; for (const u of [...outU].reverse()) c.push([-u, stepOut(u)]); for (const u of [...roadU].reverse()) if (u) c.push([-u, 0.6]); for (const u of roadU) c.push([u, 0.6]); for (const u of outU) c.push([u, stepOut(u)]); return c; })();
/* finer rows (0.3 m) where the road shape changes quickly: cattle-grid humps and crests */
let FINE = null;
const fineAt = s => { if (!FINE) { FINE = []; for (const f of FEAT) if (f.type === 'grid' || f.type === 'crest') FINE.push([f.s0 - 5, f.s1 + 4]); } for (const [a, b] of FINE) if (s >= a && s <= b) return true; return false; };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const faceN = (a, b, c) => { const n = cross(sub(b, a), sub(c, a)), l = Math.hypot(n[0], n[1], n[2]) || 1; return [n[0] / l, n[1] / l, n[2] / l]; };
const PO = {};
export function buildTerrain(f, sA, sB) {
  const P = (s, u) => { pos(s, u, PO); return [PO.x, GH(s, u), PO.z]; };
  const colsV = COLUMNS.map(([u, st], ci) => {
    const pts = [], road = Math.abs(u) <= RH + 0.01, s0 = Math.floor(sA / st) * st;
    const list = []; for (let s = s0; s < sB + st - 1e-6; s += st) { list.push(s); if (road && fineAt(s + st * 0.5)) list.push(s + st * 0.5); }
    for (const s of list) {
      const edge = s <= sA || s >= sB, sst = road && fineAt(s) ? st * 0.5 : st, jitS = edge || road ? 0 : (K.hash2(ci * 3.7, s * 1.3) - 0.5) * sst * 0.5;
      const jitU = edge || road || Math.abs(u) <= GUT ? 0 : (K.hash2(ci * 1.9 + 7, s * 0.7) - 0.5) * (Math.abs(u) * 0.08 + 0.3);
      const m = sst * 0.33, sj = s + jitS, ss = edge ? Math.min(sB, Math.max(sA, s)) : (sj > sA + m && sj < sB - m ? sj : s), uu = u + (edge ? 0 : jitU);
      if (!edge && !(ss > sA + m && ss < sB - m)) continue; if (edge && pts.length && pts[pts.length - 1].s === ss) continue; pts.push({ s: ss, u: uu, p: P(ss, uu) });
    }
    if (!pts.length || pts[0].s !== sA) pts.unshift({ s: sA, u, p: P(sA, u) });
    if (pts[pts.length - 1].s !== sB) pts.push({ s: sB, u, p: P(sB, u) });
    return pts;
  });
  if (!f.SN) f.SN = [];
  const NaN9 = [NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN, NaN];
  const sn = v => { const e = 0.12, P1 = {}; pos(v.s, 0, P1); const th = P1.th, hs = (GH(v.s + e, v.u) - GH(v.s - e, v.u)) / (2 * e), hu = (GH(v.s, v.u + e) - GH(v.s, v.u - e)) / (2 * e);
    const ts = [Math.sin(th), hs, Math.cos(th)], tu = [-Math.cos(th), hu, Math.sin(th)], n = cross(tu, ts), l = Math.hypot(n[0], n[1], n[2]) || 1; return n[1] < 0 ? [-n[0] / l, -n[1] / l, -n[2] / l] : [n[0] / l, n[1] / l, n[2] / l]; };
  const onRoad = (a, b, c) => Math.abs(a.u) <= RH + 0.01 && Math.abs(b.u) <= RH + 0.01 && Math.abs(c.u) <= RH + 0.01;
  const emit = (a, b, c) => { const n = faceN(a.p, b.p, c.p), r = onRoad(a, b, c); if (n[1] < 0) { const t = b; b = c; c = t; }
    f.tri(a.p, b.p, c.p, colour((a.s + b.s + c.s) / 3, (a.u + b.u + c.u) / 3, n[1] < 0 ? [-n[0], -n[1], -n[2]] : n), [1, 0, 0, 0]); f.T.push(a.s, a.u, b.s, b.u, c.s, c.u);
    if (r) f.SN.push(...sn(a), ...sn(b), ...sn(c)); else f.SN.push(...NaN9); };
  for (let c = 0; c < colsV.length - 1; c++) {
    const A = colsV[c], B = colsV[c + 1]; let i = 0, j = 0;
    while (i < A.length - 1 || j < B.length - 1) { const advA = j >= B.length - 1 || (i < A.length - 1 && A[i + 1].s <= B[j + 1].s); if (advA) { emit(A[i], B[j], A[i + 1]); i++; } else { emit(A[i], B[j], B[j + 1]); j++; } }
  }
}

/* ---------- placement plan: every static piece as { chunk, part, s, u, yaw, sc, sink, lift } so the worker can build chunk by chunk */
export const DENSITY = { low: 0.55, mid: 0.8, desktop: 1 };
export function plan(tier, KITM) {
  const D = DENSITY[tier] || 0.8, r = K.rng(20261111), items = [], occ = new Map(), signs = [], boards = [], anchors = {}, brand = [];
  const CFG = L.CONFIG, gates = CFG.gateS, camp = campC(); CAMP.s = camp.s + 6; CAMP.u = camp.u - 9;
  anchors.camp = { s: CAMP.s, u: CAMP.u }; anchors.stop = { s: camp.s, u: camp.u };
  const key = (s, u) => Math.round(s / 2.5) + ':' + Math.round(u / 2.5);
  const reserved = (s, u, rad, tall) => {
    const a = Math.abs(u);
    if (a < CORR + 0.15 + rad) return true;
    for (const gs of gates) if (Math.abs(s - gs - GATE_AHEAD) < 7 + rad && a < 10) return true;
    if (Math.hypot(s - (camp.s + 4), u - (camp.u - 5)) < 15 + rad) return true;
    if (s > -24 && s < 14 && a < 15 && tall) return true;
    for (const f of FEAT) if (s > f.s0 - 3 && s < f.s1 + 3 && a < 9) return true;
    for (const sg of signs) if (Math.hypot(s - sg.s, u - sg.u) < 2.5 + rad) return true;
    return false;
  };
  const free = (s, u, rad, tall) => { if (reserved(s, u, rad, tall)) return false; const n = Math.ceil(rad / 2.5); for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) if (occ.get(Math.round(s / 2.5) + a + ':' + (Math.round(u / 2.5) + b)) >= rad * 0.5) return false; return true; };
  const mark = (s, u, rad) => occ.set(key(s, u), Math.max(rad, occ.get(key(s, u)) || 0));
  const level = (part, s, u, o) => { const sz = part.size || [1, 1, 1], r = Math.max(sz[0], sz[2]) * 0.4 * (o.s || 1); if (r < 0.35) return true; const base = GH(s, u) - (o.sink || 0); let gmin = 1e9, gmax = -1e9; for (const [ds, du] of [[r, 0], [-r, 0], [0, r], [0, -r]]) { const g = GH(s + ds, u + du); gmin = Math.min(gmin, g); gmax = Math.max(gmax, g); } return base - gmin <= 0.22 + r * 0.25 && gmax - base <= 0.32 + (o.sink || 0) + r * 0.35; };
  const put = (part, s, u, o = {}) => { if (!part || s < WORLD.s0 + 1 || s > WORLD.s1 - 1) return; if (!part.size) part.size = bboxOf(part); if (!o.force && !level(part, s, u, o)) { REJ.level++; return; } items.push({ part, s, u, yaw: o.yaw || 0, sc: o.s || 1, sink: o.sink || 0, lift: o.lift || 0, tilt: o.tilt || 0 }); };
  const kitSized = (n, h) => KITM[n] ? K.scaled(KITM[n], h / Math.max(0.05, KITM[n].size[1])) : null;
  /* would a tall piece at (s, u) stand in the chase camera's sight line to the road 0-36 m ahead? (bends: the inside is at risk) */
  const P0 = {}, P1 = {}, P2 = {};
  const blocks = (s, u, rad, h) => {
    if (Math.abs(u) > 30) return false; pos(s, u, P0);
    for (let sc = s - 40; sc <= s + 4; sc += 2) {
      pos(sc - 6.5, 0, P1); const cy = L.groundH(sc, 0) + 4.2;
      for (let d = 4; d <= 36; d += 4) for (const tu of [-3.4, 0, 3.4]) {
        pos(sc + d, tu, P2); const ty = L.groundH(sc + d, tu) + 0.3, vx = P2.x - P1.x, vz = P2.z - P1.z, L2 = vx * vx + vz * vz, f = ((P0.x - P1.x) * vx + (P0.z - P1.z) * vz) / L2;
        if (f <= 0.03 || f >= 0.97) continue; const px = P1.x + vx * f - P0.x, pz = P1.z + vz * f - P0.z; if (px * px + pz * pz > rad * rad) continue;
        if (GH(s, u) + h > cy + (ty - cy) * f - 0.2) return true;
      }
    }
    return false;
  };
  const gumAt = (s, u, v, sc = 1, force) => { if (!force && !free(s, u, 3, true)) return; if (blocks(s, u, 2.6, 7)) return; mark(s, u, 3); put(K.gum(Math.floor(s * 7 + u * 13), v, Math.abs(u) > 34 ? 1 : 0), s, u, { yaw: r() * 6.28, s: sc, sink: 0.15 }); };
  const spinAt = (s, u, sc = 1) => { if (!free(s, u, 0.9)) return; mark(s, u, 0.9); put(K.spinifex(Math.floor(s * 31 + u * 7), Math.floor(r() * 3), Math.abs(u) > 22 ? 1 : 0), s, u, { yaw: r() * 6.28, s: sc * (0.85 + r() * 0.4), sink: 0.05 }); };
  const KROCK = ['rock_largeA', 'rock_largeC', 'rock_largeE', 'rock_smallA', 'rock_smallFlatB', 'rock_smallTopA'].filter(n => KITM[n]);
  const rockAt = (s, u, sc = 1, tint) => { if (!free(s, u, sc)) return; mark(s, u, sc);
    if (!tint && KROCK.length && r() < 0.55) { put(kitSized(KROCK[Math.floor(r() * KROCK.length)], 0.75 * sc), s, u, { yaw: r() * 6.28, sink: 0.08 * sc }); return; }
    put(K.rock(Math.floor(s * 11 + u * 3), Math.floor(r() * 3), tint || 'rockRed'), s, u, { yaw: r() * 6.28, s: sc, sink: 0.12 * sc }); };
  const KBUSH = ['plant_bush', 'plant_bushLarge', 'plant_bushDetailed', 'plant_bushSmall'].filter(n => KITM[n]);
  const bushAt = (s, u, h = 0.9) => { if (!KBUSH.length || !free(s, u, 1)) return; mark(s, u, 1); put(kitSized(KBUSH[Math.floor(r() * KBUSH.length)], h * (0.8 + r() * 0.5)), s, u, { yaw: r() * 6.28, sink: 0.05 }); };
  const KTALL = ['rock_tallA', 'rock_tallE', 'rock_tallH'].filter(n => KITM[n]);
  const towerAt = (s, u, h) => { if (!KTALL.length || !free(s, u, 2.5, true) || blocks(s, u, 2, 4)) return; mark(s, u, 2.5); put(kitSized(KTALL[Math.floor(r() * KTALL.length)], h || 2.6 + r() * 2.2), s, u, { yaw: r() * 6.28, sink: 0.2 }); };
  const moundAt = (s, u, v) => { if (!free(s, u, 1.2)) return; mark(s, u, 1.2); put(K.termite(Math.floor(s * 5 + u), v), s, u, { yaw: r() * 6.28, s: 0.9 + r() * 0.3, sink: 0.1 }); };
  const signAt = (s, u, kind, big) => { signs.push({ s, u, kind, big: !!big }); mark(s, u, 1.5); };

  /* road features: warning signs 38 m ahead (right verge), the readable dressing goes in the chunk as facets (dress()) */
  for (const f of FEAT) signAt(f.s0 - 38, CORR + 0.45, f.type);
  for (const b of L.BAYS) signAt(b.s0 - 34, (CORR + 0.45) * Math.sign(b.u0 + b.u1), 'bay', true);
  for (const sd of L.SIDE) signAt(sd.haul[0] - 30, (CORR + 0.45) * Math.sign(sd.u), 'side', true);
  /* camp distance boards: the metres match the HUD's distance track (campS - s) */
  /* the kit's verge gantries at about 8%, 55% and 88% of the trail; each says the real metres to camp from where it stands */
  for (const frac of [0.08, 0.55, 0.88]) { let d = Math.round(CFG.campS * (1 - frac) / 50) * 50, s = CFG.campS - d; for (let k = 0; k < 6; k++) { let clash = false; for (const f of FEAT) if (s > f.s0 - 46 && s < f.s1 + 6) clash = true; for (const sg of signs) if (Math.abs(sg.s - s) < 12) clash = true; if (!clash) break; d += 50; s = CFG.campS - d; }
    const u = RH - 1.0 + 0.5, part = K.distanceGantry(); boards.push({ s, u, d: d + ' m', at: d, yaw: Math.PI - 0.65, face: part.meta.face }); items.push({ part, s, u, yaw: Math.PI - 0.65, sc: 1, sink: 0 }); mark(s, u + 3, 2); }
  /* wildlife warnings (decoration only) */
  for (const [s, u, k] of [[70, -6.8, 'roo'], [196, 6.8, 'emu'], [640, -6.8, 'roo'], [720, 6.8, 'wombat']]) if (!reserved(s, u, 0.3)) { items.push({ part: K.wildlifeSign(k), s, u, yaw: Math.PI, sc: 1, sink: 0.02 }); mark(s, u, 1); }
  if (!reserved(150, -7.0, 0.4)) { items.push({ part: K.tripleSign(), s: 150, u: -7.0, yaw: Math.PI, sc: 1, sink: 0.02 }); mark(150, -6.8, 1.2); }

  /* act 1, the open road (golden): composed gum groups throwing long shadows across the road, spinifex, mounds; a windmill and tank */
  const A2 = CFG.act2S, A3 = gates[2];
  gumAt(48, -9.5, 0, 1.05); gumAt(53, -13, 1); spinAt(46, -7.6); spinAt(50, -7.2, 1.2); spinAt(55, -8.5); rockAt(51, -7.6, 0.8);
  gumAt(101, -10.5, 0, 1.1); gumAt(106, -15, 2); spinAt(99, -7.8); spinAt(104, -8.2, 1.1); rockAt(108, -8.5, 1.1);
  gumAt(83, 12, 1, 0.95); spinAt(80, 8.2); spinAt(86, 7.9, 1.2); moundAt(88, 10.5, 0); moundAt(91, 13.5, 1);
  gumAt(24, -11, 2); moundAt(20, 9.5, 0); moundAt(16, 12.5, 1); spinAt(22, 7.8); spinAt(18, 8.4);
  anchors.mill = { s: 160, u: -34 }; put(K.windmillTower(), 160, -34, { yaw: 0.4 }); put(K.waterTank(), 166, -38, { yaw: 0.2 }); mark(160, -34, 7); mark(166, -38, 4);
  put(K.dunny(), 168, -28, { yaw: 2.6 }); put(K.mailboxDrum(), 92, 7.4, { yaw: Math.PI / 2 }); mark(92, 7.4, 1);
  anchors.perch = { s: 48, u: -9.5 };
  /* station fence and gate posts at each cattle grid (the grid itself is the feature's dressing) */
  if (KITM.fence_simple) { const fp = kitSized('fence_simple', 1.05), w = fp.size[0]; for (const f of FEAT) if (f.type === 'grid') for (let s = f.s0 - 45; s < f.s0 + 45; s += w * 0.98) { if (Math.abs(s - f.s0) < 2.5) continue; for (const u of [-9.4, 9.4]) if (!reserved(s, u, 0.3)) put(fp, s, u, { yaw: Math.PI / 2, sink: 0.05 }); } }
  /* composed groups along the corridor, alternating sides, act-specific */
  for (let s = -70; s < WORLD.s1 - 10; s += (14 + r() * 12) / D) {
    const act = actOf(s), side = r() < 0.5 ? -1 : 1, u0 = side * (9.5 + r() * 18), kind = r();
    if (act === 2) {
      /* the gorge: boulders and rock towers at the wall foot, a few gums by the creek beds, spinifex */
      if (kind < 0.45) { towerAt(s, side * (10.5 + r() * 3)); for (let k = 0; k < 4; k++) rockAt(s + (r() - 0.5) * 8, side * (9 + r() * 4), 0.6 + r() * 1.5); }
      else if (kind < 0.7) { for (let k = 0; k < 5; k++) spinAt(s + (r() - 0.5) * 10, side * (8.5 + r() * 4)); bushAt(s + 2, side * (9 + r() * 3)); }
      else if (kind < 0.85) { gumAt(s, side * (10 + r() * 3), 2, 0.9); spinAt(s + 2, side * 8.6); }
      else { for (let k = 0; k < 3; k++) rockAt(s + (r() - 0.5) * 6, side * (9 + r() * 3), 0.5 + r() * 0.8, r() < 0.5 ? 'rockGrey' : null); }
      continue;
    }
    if (kind < 0.35) { gumAt(s, u0, Math.floor(r() * 3)); gumAt(s + 4 + r() * 3, u0 + side * (3 + r() * 4), 2); for (let k = 0; k < 4; k++) spinAt(s + (r() - 0.5) * 9, u0 + (r() - 0.5) * 7); }
    else if (kind < 0.55) { for (let k = 0; k < 3 + r() * 3; k++) moundAt(s + (r() - 0.5) * 12, u0 + (r() - 0.5) * 10, r() < 0.6 ? 0 : 1); for (let k = 0; k < 3; k++) spinAt(s + (r() - 0.5) * 10, u0 + (r() - 0.5) * 8); }
    else if (kind < 0.75) { if (Math.abs(u0) > 12) towerAt(s, u0 + side * 2); for (let k = 0; k < 4 + r() * 4; k++) rockAt(s + (r() - 0.5) * 7, u0 + (r() - 0.5) * 6, 0.5 + r() * 1.4); for (let k = 0; k < 4; k++) spinAt(s + (r() - 0.5) * 9, u0 + (r() - 0.5) * 8); bushAt(s + 3, u0 - side * 2); }
    else if (kind < 0.85) { if (free(s, u0, 2.5)) { mark(s, u0, 2.5); put(r() < 0.5 && KITM.log_large ? kitSized('log_large', 0.62) : K.log(Math.floor(s)), s, u0, { yaw: r() * 6, sink: 0.08 }); } if (KITM.stump_old && free(s - 3, u0, 1)) { mark(s - 3, u0, 1); put(kitSized('stump_old', 0.6), s - 3, u0, { yaw: r() * 6 }); } gumAt(s + 4, u0 + side * 3, 2); spinAt(s - 2, u0 - side * 2); }
    else { for (let k = 0; k < 7; k++) spinAt(s + (r() - 0.5) * 12, u0 + (r() - 0.5) * 9, 1.1); for (let k = 0; k < 3; k++) bushAt(s + (r() - 0.5) * 12, u0 + (r() - 0.5) * 9); }
  }
  /* creek beds through the plain: river red gums on the banks, stones in the bed */
  for (const c of CREEKB) { for (const u of [-34, -19, 16, 31, 52, -55]) gumAt(creekCentre(c, u) + (u > 0 ? 7.5 : -7.5), u, 1, 1.15); for (let i = 0; i < 26 * D; i++) { const u = (r() - 0.5) * 70; if (Math.abs(u) < BANK + 0.5) continue; put(K.rock(i + 900, Math.floor(r() * 2), 'rockGrey'), creekCentre(c, u) + (r() - 0.5) * 6, u, { yaw: r() * 6, s: 0.35 + r() * 0.35, sink: 0.05 }); } }
  /* depth: lone gums and mounds further out (none in the gorge, the walls hide it), spinifex and bushes, pebbles in the gutters */
  const N = Math.round(1080 / 470 * D * 100) / 100;
  for (let i = 0; i < 150 * N; i++) { const s = -70 + r() * (WORLD.s1 - 80), side = r() < 0.5 ? -1 : 1, u = side * (32 + r() * 105); if (L.gorgeW(s) > 0.2) continue; if (r() < 0.7) gumAt(s, u, Math.floor(r() * 3), 1 + r() * 0.3); else moundAt(s, u, 0); }
  for (let i = 0; i < 260 * N; i++) { const s = -70 + r() * (WORLD.s1 - 80), side = r() < 0.5 ? -1 : 1, u = side * (8 + Math.pow(r(), 1.6) * 45); spinAt(s, u); }
  for (let i = 0; i < 70 * N; i++) { const s = -70 + r() * (WORLD.s1 - 80), side = r() < 0.5 ? -1 : 1, u = side * (8.5 + Math.pow(r(), 1.4) * 40); bushAt(s, u, 0.8); }
  for (let i = 0; i < 220 * N; i++) { const s = -70 + r() * (WORLD.s1 - 80), side = r() < 0.5 ? -1 : 1, u = side * (CORR + 0.2 + r() * 2.2); let near = false; for (const f of FEAT) if (s > f.s0 - 4 && s < f.s1 + 4) near = true; if (near) continue; put(K.pebble(i + 77), s, u, { yaw: r() * 6, s: 0.8 + r() * 1.4 }); }
  /* act 3: a road train on a far side track is a moving piece (view); mesas line the horizon (far layer) */
  /* the camp on its cleared pad: tent, fire, chairs, swag, billy, log stack; gums composed outside the orbit */
  const cs = CAMP.s, cu = CAMP.u;
  if (KITM.tent_detailedOpen) put(kitSized('tent_detailedOpen', 1.6), cs + 2.5, cu - 4.5, { yaw: 0.9 + Math.PI }); else put(K.tent(), cs + 2, cu - 4, { yaw: 0.9 });
  if (KITM.campfire_stones) { put(kitSized('campfire_stones', 0.32), cs - 1, cu + 1); if (KITM.campfire_logs) put(kitSized('campfire_logs', 0.42), cs - 1, cu + 1); put(K.flames(4), cs - 1, cu + 1); } else put(K.campfire(4), cs - 1, cu + 1);
  if (KITM.log_stack) put(kitSized('log_stack', 0.7), cs + 5.5, cu + 3.5, { yaw: 0.4 });
  put(K.chair(1), cs - 3.0, cu - 0.6, { yaw: 1.3 }); put(K.chair(2), cs - 1.2, cu + 3.4, { yaw: 3.0 });
  put(K.swag(false), cs + 3.5, cu + 1.5, { yaw: 1.2, lift: -0.04 }); put(K.billy(), cs - 0.2, cu + 1.9);
  anchors.fire = { s: cs - 1, u: cu + 1 };
  for (const [ds, du, v, sc] of [[24, -16, 1, 1.2], [-6, -24, 0, 1], [30, 8, 2, 1], [14, -30, 0, 1.1], [-14, 16, 1, 1]]) gumAt(cs + ds, cu + du, v, sc, true);
  put(K.goanna(), 41, -8.4, { yaw: 2.2, sink: 0.1 });
  /* brand placements (budget: one prominent in view at a time): the logo once on each gate (view), one billboard, the camp banner */
  const BL = 1; /* the view drops what is above the page's ?brand level */
  { const bb = K.brandBillboard(); brand.push({ kind: 'billboard', s: 430, u: -13, yaw: Math.PI + 0.35, face: bb.meta.face, level: 1 }); items.push({ part: bb, s: 430, u: -13, yaw: Math.PI + 0.35, sc: 1, sink: 0 }); mark(430, -13, 4); }
  { const bn = K.brandBanner(); brand.push({ kind: 'banner', s: CAMP.s - 7, u: -7.6, yaw: Math.PI, face: bn.meta.face, level: 1 }); items.push({ part: bn, s: CAMP.s - 7, u: -7.6, yaw: Math.PI, sc: 1, sink: 0 }); }
  { const fl = K.brandFlag(); brand.push({ kind: 'flag', s: CAMP.s + 4, u: CAMP.u - 2, yaw: 0.4, decal: fl.meta.decal, level: 1 }); items.push({ part: fl, s: CAMP.s + 4, u: CAMP.u - 2, yaw: 0.4, sc: 1, sink: 0 }); }
  for (let k = 0; k < 3; k++) { const cr = K.brandCrate(), s0 = gates[0] + GATE_AHEAD - 9 + k * 1.3, u0 = CORR + 1.0 + (k % 2) * 0.6; brand.push({ kind: 'crate', s: s0, u: u0, yaw: Math.PI + 0.2 * k, decal: cr.meta.decal, level: 1 }); items.push({ part: cr, s: s0, u: u0, yaw: Math.PI + 0.2 * k, sc: 1, sink: 0 }); }
  brand.push({ kind: 'dunny', s: 168, u: -28, yaw: 2.6, decal: { x: 0, y: 1.55, z: 0.6, w: 0.42 }, level: 1 });
  void BL;
  /* bucket by chunk */
  const byChunk = Array.from({ length: NCH }, () => []);
  for (const it of items) byChunk[chunkOf(it.s)].push(it);
  return { byChunk, signs, boards, anchors, brand, gateS: gates.map(g => g + GATE_AHEAD) };
}
export let gateMeta = null;
export const REJ = { level: 0 };
function bboxOf(part) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, y1 = -1e9; for (let i = 0; i < part.P.length; i += 3) { x0 = Math.min(x0, part.P[i]); x1 = Math.max(x1, part.P[i]); y1 = Math.max(y1, part.P[i + 1]); z0 = Math.min(z0, part.P[i + 2]); z1 = Math.max(z1, part.P[i + 2]); } return [x1 - x0, y1, z1 - z0]; }
export const chunkOf = s => Math.max(0, Math.min(NCH - 1, Math.floor((s - WORLD.s0) / WORLD.chunk)));

/* ---------- the readable dressing of each road feature, bays and side tracks, as kit facets (in the chunk of its start) */
const PAINT = K.lin('#E9B52C'), WATER = K.lin('#6FA4C4'), WATER2 = K.lin('#9CC6DC'), STEEL = C.steel, PIT = C.black, HOLE = K.shade(C.earthDeep, 0.62), HOLE2 = K.shade(C.earthDeep, 0.82);
export function dress(f, trkOf) {
  const out = [];
  const q = (s, u, y) => { pos(s, u, PO); return [PO.x, GH(s, u) + y, PO.z]; };
  const quad = (F, s0, u0, s1, u1, y, col, fx = [1, 0, 0, 0]) => { F.quad(q(s0, u0, y), q(s0, u1, y), q(s1, u1, y), q(s1, u0, y), col, fx, null); };
  const box = (F, s, u, w, h, d, col, fx) => { const p = q(s, u, 0); pos(s, u, PO); const part = new K.Facets(); K.bevelBox(part, [0, h / 2, 0], w, h, d, Math.min(0.03, w * 0.2), () => col, fx || [1, 0, 0, 0]); F.add(part, { x: p[0], y: p[1], z: p[2], yaw: PO.th }); };
  const marker = () => { /* no marker posts on the road tonight (owner) */ };
  const items = [];
  for (const h of FEAT) {
    const F = new K.Facets(), cen = h.free.length ? (h.free.reduce((b, x) => (x[1] - x[0] > b[1] - b[0] ? x : b))) : [0, 0], cu = (cen[0] + cen[1]) / 2;
    const dashes = () => { /* no paint on the road tonight (owner): the sign and the chip carry the warning */ };
    if (h.type === 'rocks') {
      for (const [a0, b0] of h.spans) { const a = Math.max(-RH + 0.1, a0), b = Math.min(RH - 0.1, b0), k = Math.max(2, Math.ceil((b - a) / 0.7));
        for (let i = 0; i < k; i++) { const u = a + (i + 0.5) * (b - a) / k, p = q(h.s0 + 0.6, u, -0.08); F.add(K.rock(h.i * 31 + i, i % 3, i % 2 ? 'rockRed' : 'rockGrey'), { x: p[0], y: p[1], z: p[2], yaw: i * 1.7, s: 0.55 + K.hash2(i, h.i) * 0.35 }); }
        for (let i = 0; i < 6; i++) { const u = a + K.hash2(i * 3, h.i) * (b - a), p = q(h.s0 + 0.2 + K.hash2(i, 7) * 1.4, u, 0); F.add(K.pebble(h.i * 7 + i), { x: p[0], y: p[1], z: p[2], yaw: i, s: 1.4 }); }
        for (const e of [a0, b0]) if (Math.abs(e) < L.CONFIG.half - 0.01) marker(F, h.s0 - 0.6, e); }
    } else if (h.type === 'log') {
      for (const [a0, b0] of h.spans) { const a = Math.max(-RH - 0.6, a0), b = Math.min(RH + 0.6, b0), p = q(h.s0 + 0.6, (a + b) / 2, 0.05); pos(h.s0 + 0.6, (a + b) / 2, PO);
        const lg = K.log(h.i * 13 + 3); const lb = new K.Facets(); lb.add(lg, { s: [Math.max(0.8, (b - a + 0.6) / 3.2), 1.25, 1.25] }); F.add(lb, { x: p[0], y: p[1], z: p[2], yaw: PO.th + Math.PI / 2 });
        for (const e of [a0, b0]) if (Math.abs(e) < L.CONFIG.half - 0.01) marker(F, h.s0 - 0.5, e); }
    } else if (h.type === 'washout') {
      for (const [a0, b0] of h.spans) for (const e of [a0, b0]) if (Math.abs(e) < L.CONFIG.half - 0.01) marker(F, h.s0 - 0.5, e);
    } else if (h.type === 'pothole') {
      const [a0, b0] = h.spans[0], a = Math.max(-RH + 0.3, a0), b = Math.min(RH - 0.3, b0), n = 6 + Math.floor((b - a) * 1.5);
      for (let i = 0; i < n; i++) { const s = h.s0 + 0.4 + K.hash2(i, h.i) * (h.s1 - h.s0 - 0.8), u = a + 0.4 + K.hash2(i * 7, h.i) * (b - a - 0.8), rs = 0.32 + 0.22 * K.hash2(i, 3), ru = 0.36 + 0.26 * K.hash2(i, 5);
        const ring = (k, y) => { const pts = []; for (let j = 0; j < 9; j++) { const t = j / 9 * 6.283; pts.push(q(s + Math.cos(t) * rs * k, u + Math.sin(t) * ru * k, y)); } return pts; };
        const o = ring(1.25, 0.02), m0 = ring(1, 0.006), c0 = q(s, u, 0.004);
        for (let j = 0; j < 9; j++) { const j2 = (j + 1) % 9; F.quad(o[j], o[j2], m0[j2], m0[j], HOLE2, [1, 0, 0, 0]); F.tri(m0[j], m0[j2], c0, K.hash2(i, 9) < 0.35 ? WATER : HOLE, [1, 0, 0, 0]); } }
      dashes(h.s0 - 9, 4);
    }
    items.push({ s: h.s0, F });
  }
  for (const b of L.BAYS) { const F = new K.Facets(); for (const s of [b.s0 - 2, b.s1 + 2]) for (const u of [b.u0 - 0.1, b.u1 + 0.1]) box(F, s, u, 0.14, 1.1, 0.14, PAINT); items.push({ s: b.s0, F }); }

  for (const it of items) { it.F.fillTrk(trkOf(it.s)); out.push(it); }
  return out;
}

/* ---------- the choice gates (structure as facets; the banner and logo are textured in the view) */
export function gateFacets() {
  if (K.brandGate) { const g = K.brandGate(2 * (CORR + 0.35)); gateMeta = g.meta; return g; }
  const F = new K.Facets(), fx = [1, 0, 0, 0];
  for (const x of [-5.2, 5.2]) { K.bevelBox(F, [x, 2.1, 0], 0.34, 4.8, 0.34, 0.04, () => C.black, fx); K.bevelBox(F, [x, 0.2, 0], 0.6, 0.4, 0.6, 0.04, () => C.steel, fx); }
  K.bevelBox(F, [0, 4.42, 0], 10.8, 0.3, 0.3, 0.04, () => C.black, fx);
  F.casters.push({ p: [-5.2, 0, 0], q: [-5.2, 4.4, 0], r: 0.2 }, { p: [5.2, 0, 0], q: [5.2, 4.4, 0], r: 0.2 }, { p: [-5.2, 4.4, 0], q: [5.2, 4.4, 0], r: 0.15 });
  return F;
}

/* ---------- far layer: mesas, buttes and ridges in hazed rings ahead, a skirt of ground to the horizon */
export function buildFar() {
  const far = new K.Facets(), r = K.rng(7), P = {};
  const TS = []; for (let s = -80; s <= L.NT + 60; s += 4) { pos(s, 0, P); TS.push(P.x, P.z); }
  const clearOf = (x, z, rad) => { for (let i = 0; i < TS.length; i += 2) if ((TS[i] - x) ** 2 + (TS[i + 1] - z) ** 2 < (rad + 30) ** 2) return false; return true; };
  const ring = (sAt, dist, n, spread, sc, kinds) => { pos(sAt, 0, P); const bx = P.x, bz = P.z, th = P.th; for (let i = 0; i < n; i++) { for (let tr = 0; tr < 8; tr++) { const a = th + (i / (n - 1) - 0.5) * spread + (r() - 0.5) * 0.12 + tr * 0.09 * (i % 2 ? 1 : -1), x = bx + Math.sin(a) * (dist + tr * 25), z = bz + Math.cos(a) * (dist + tr * 25), k = sc * (0.8 + r() * 0.5), m = K.mesa(i + dist, kinds[Math.floor(r() * kinds.length)]), sz = bboxOf(m), rad = 0.5 * Math.hypot(sz[0], sz[2]) * k;
    if (!clearOf(x, z, rad)) continue; far.add(m, { x, y: ySm(sAt) - 4, z, yaw: r() * 6, s: k }, null); break; } } };
  ring(150, 330, 7, 2.4, 0.8, [0, 1, 0]); ring(300, 620, 9, 2.9, 1.4, [0, 2, 2, 1]); ring(500, 1050, 10, 3.2, 2.2, [2, 2, 0]);
  ring(650, 420, 6, 1.8, 1.0, [1, 0]); ring(850, 700, 8, 2.6, 1.6, [0, 2, 1]); ring(950, 380, 5, 1.6, 0.9, [1, 0]);
  for (let i = 0; i < 6; i++) { pos(-40, 0, P); const a = P.th + Math.PI + (i / 5 - 0.5) * 2.2, x = P.x + Math.sin(a) * 700, z = P.z + Math.cos(a) * 700; far.add(K.mesa(i + 77, 2), { x, y: ySm(0) - 4, z, yaw: r() * 6, s: 1.6 }, null); }
  pos(450, 0, P); const cx = P.x, cz = P.z, cy = ySm(450), N = 32;
  for (let k = 0; k < N; k++) for (let j = 0; j < 3; j++) {
    const r0 = [560, 900, 1500][j], r1 = [900, 1500, 3000][j], a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2;
    const p = (rr, a) => [cx + Math.sin(a) * rr, cy - 3.5 + (K.hash2(rr, (Math.round(a * 1000) % 6283) / 1000) - 0.5) * 3, cz + Math.cos(a) * rr];
    far.quad(p(r0, a0), p(r1, a0), p(r1, a1), p(r0, a1), K.shade([C.earthRed, C.earthOchre, C.earthDeep][(k + j) % 3], 0.95), [0, 0, 0, 0], [cx, -1000, cz]);
  }
  far.T = new Array(far.P.length / 3 * 2).fill(-9999); far.casters = [];
  return far;
}

/* ---------- long-shadow mask in track space (our own coords for every caster: the part's (s, u) plus its local offset) */
export const MASK_RECT = { s0: WORLD.s0, s1: WORLD.s1, u0: -64, u1: 64, res: 0.27 };
export function bakeMask(casters) {
  const { s0, s1, u0, u1, res } = MASK_RECT, w = Math.ceil((s1 - s0) / res), h = Math.ceil((u1 - u0) / res), M = new Uint8Array(w * h);
  const ellipse = (cs, cu, as, au, bs, bu) => {
    const ext = Math.hypot(as, bs) + Math.hypot(au, bu) + 0.5, la = as * as + au * au, lb = bs * bs + bu * bu;
    const x0 = Math.max(0, Math.floor((cs - ext - s0) / res)), x1 = Math.min(w - 1, Math.ceil((cs + ext - s0) / res)), y0 = Math.max(0, Math.floor((cu - ext - u0) / res)), y1 = Math.min(h - 1, Math.ceil((cu + ext - u0) / res));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const ds = s0 + x * res - cs, du = u0 + y * res - cu, pa = (ds * as + du * au) / la, pb = (ds * bs + du * bu) / lb; if (pa * pa + pb * pb <= 1) M[y * w + x] = 255; }
  };
  const P = {};
  for (const c of casters) {
    const cs = c.ts, cu = c.tu; if (cs < s0 - 40 || cs > s1 + 40 || Math.abs(cu) > 90) continue;
    pos(cs, cu, P); const th = P.th, sd = K.sunDirOf(momentAt(cs)); if (sd[1] <= 0.02) continue;
    const fS = -(sd[0] * Math.sin(th) + sd[2] * Math.cos(th)), fU = -(-sd[0] * Math.cos(th) + sd[2] * Math.sin(th)), Ln = Math.hypot(fS, fU) || 1, dS = fS / Ln, dU = fU / Ln, cot = Math.hypot(sd[0], sd[2]) / sd[1];
    const gy = GH(cs, cu);
    if (c.q) { const hp = Math.max(0, c.p[1] - gy), hq = Math.max(0, c.q[1] - gy), ps = cs + dS * hp * cot, pu = cu + dU * hp * cot, es = c.qs + dS * hq * cot, eu = c.qu + dU * hq * cot, n = Math.max(2, Math.ceil(Math.hypot(es - ps, eu - pu) / (c.r * 0.8)));
      for (let k = 0; k <= n; k++) { const t = k / n; ellipse(ps + (es - ps) * t, pu + (eu - pu) * t, c.r, 0, 0, c.r); } }
    else { const hh = Math.max(0, c.p[1] - gy), sy = c.sy || 1, ext = c.r * sy * cot; ellipse(cs + dS * hh * cot, cu + dU * hh * cot, dS * (c.r + ext * 0.5), dU * (c.r + ext * 0.5), -dU * c.r, dS * c.r); }
  }
  const O = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0, n = 0; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const xx = x + i, yy = y + j; if (xx >= 0 && yy >= 0 && xx < w && yy < h) { a += M[yy * w + xx]; n++; } } O[y * w + x] = a / n; }
  return { data: O, w, h, s0, u0, ds: s1 - s0, du: u1 - u0 };
}

/* ---------- chunk assembly: terrain + its props + its feature dressing -> flat arrays (normals computed here, off the main thread) */
export function trkOf(hint) { return (x, z) => toTrack(x, z, hint); }
export function place(F, it) {
  pos(it.s, it.u, PO); const y = GH(it.s, it.u) - (it.sink || 0) + (it.lift || 0), th = PO.th + (it.yaw || 0), before = F.casters.length;
  /* props carry their own track coords: the part's (s, u) plus the local offset, rotated into the road frame */
  const base = F.P.length / 3;
  F.add(it.part, { x: PO.x, y, z: PO.z, yaw: th, s: it.sc || 1, tilt: it.tilt || 0 }, null);
  const fs = Math.sin(PO.th), fc = Math.cos(PO.th), n = F.P.length / 3;
  for (let i = base; i < n; i++) { const dx = F.P[i * 3] - PO.x, dz = F.P[i * 3 + 2] - PO.z; F.T.push(it.s + dx * fs + dz * fc, it.u - dx * fc + dz * fs); }
  for (let i = before; i < F.casters.length; i++) { const c = F.casters[i], dx = c.p[0] - PO.x, dz = c.p[2] - PO.z; c.ts = it.s + dx * fs + dz * fc; c.tu = it.u - dx * fc + dz * fs; if (c.q) { const qx = c.q[0] - PO.x, qz = c.q[2] - PO.z; c.qs = it.s + qx * fs + qz * fc; c.qu = it.u - qx * fc + qz * fs; } }
}
export function toArrays(F) {
  const n = F.P.length / 3, P = new Float32Array(F.P), N = new Int8Array(n * 3), Cl = new Uint16Array(n * 3), Fx = new Float32Array(F.F), Tr = new Float32Array(F.T.length === n * 2 ? F.T : new Array(n * 2).fill(-9999));
  for (let i = 0; i < n * 3; i++) Cl[i] = Math.max(0, Math.min(65535, Math.round(F.Cl[i] * 65535)));
  const SN = F.SN || [];
  for (let t = 0; t < n; t += 3) {
    if (t * 3 + 8 < SN.length && isFinite(SN[t * 3])) { for (let k = 0; k < 9; k++) N[t * 3 + k] = Math.round(SN[t * 3 + k] * 127); continue; }
    const a = t * 3, ax = P[a], ay = P[a + 1], az = P[a + 2], bx = P[a + 3] - ax, by = P[a + 4] - ay, bz = P[a + 5] - az, cx = P[a + 6] - ax, cy = P[a + 7] - ay, cz = P[a + 8] - az;
    let nx = by * cz - bz * cy, ny = bz * cx - bx * cz, nz = bx * cy - by * cx; const l = Math.hypot(nx, ny, nz); if (l > 1e-9) { nx /= l; ny /= l; nz /= l; } else { nx = 0; ny = 1; nz = 0; }
    for (let k = 0; k < 3; k++) { N[a + k * 3] = Math.round(nx * 127); N[a + k * 3 + 1] = Math.round(ny * 127); N[a + k * 3 + 2] = Math.round(nz * 127); }
  }
  return { P, N, Cl, Fx, Tr, tris: n / 3 };
}
