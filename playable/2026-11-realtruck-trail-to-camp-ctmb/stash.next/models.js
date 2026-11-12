/* models.js : the stash's unit models for Trail to Camp (realtruck-01), in the style kit's facet language (flat faces, one solid
   colour per face, palette colours, small bevels). Geometry only: every generator takes the style kit module K and returns a
   K.Facets in local space, origin at the bottom centre, long axis along x for tub-zone units and along z for rack units.
   Brand yellow (#FFC600) appears only as a small accent (a lid edge, a latch, a buckle, a zip pull).
   Sizes (metres) are fixed here and read by stash.js through SIZE. */

export const SIZE = {
  box: [0.50, 0.24, 0.33],
  slim: [0.30, 0.18, 0.95],
  duffel: [0.62, 0.24, 0.33],
  soft: [0.62, 0.24, 0.33],
  tent: [0.64, 0.28, 1.25],
  kayak: [0.60, 0.30, 2.10],
  boards: [0.56, 0.20, 2.10],
  swags: [0.66, 0.22, 1.00],
  timber: [0.36, 0.22, 2.40],
  ladder: [0.44, 0.12, 2.50],
  pipe: [0.30, 0.22, 2.40]
};

const FX = [1, 0, 0.35, 0];
const FX0 = [1, 0, 0.15, 0];

function tone(K, c, n, k = 0.07) { return K.shade(c, 1 + n[1] * k - Math.abs(n[0]) * 0.02); }
function hex(K, h) { return K.lin(h); }

/* plain 12-triangle block centred at c (w along x, h along y, d along z), one colour per face via col(n) */
export function block(K, f, c, w, h, d, col, fx = FX) {
  const x0 = c[0] - w / 2, x1 = c[0] + w / 2, y0 = c[1] - h / 2, y1 = c[1] + h / 2, z0 = c[2] - d / 2, z1 = c[2] + d / 2;
  const F = [
    [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [0, 1, 0]],
    [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1], [0, -1, 0]],
    [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1], [1, 0, 0]],
    [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0]],
    [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1]],
    [[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0], [0, 0, -1]]
  ];
  for (const [a, b, cc, dd, n] of F) f.quad(a, b, cc, dd, col(n), fx, c);
}
const solid = (K, c, k) => n => tone(K, c, n, k);

/* ---------------------------------------------------------------- tub zone: four box variants (0.50 x 0.24 x 0.33) */
export function crate(K) {
  const f = new K.Facets(), C = K.C, tan = C.canvasTan, dark = K.shade(C.canvasTan, 0.72);
  K.bevelBox(f, [0, 0.10, 0], 0.50, 0.20, 0.33, 0.018, solid(K, tan), FX);
  block(K, f, [0, 0.055, 0], 0.506, 0.022, 0.336, solid(K, dark), FX);
  block(K, f, [0, 0.135, 0], 0.506, 0.022, 0.336, solid(K, dark), FX);
  block(K, f, [0, 0.221, 0], 0.51, 0.038, 0.34, solid(K, K.shade(C.canvas, 1.1)), FX);
  block(K, f, [0, 0.214, 0.171], 0.40, 0.012, 0.006, () => C.yellow, FX0);
  block(K, f, [0, 0.214, -0.171], 0.40, 0.012, 0.006, () => C.yellow, FX0);
  return f;
}
export function eskyPair(K) {
  const f = new K.Facets(), C = K.C;
  for (const y of [0, 0.12]) {
    K.bevelBox(f, [0, y + 0.048, 0], 0.49, 0.096, 0.32, 0.014, solid(K, C.white, 0.05), FX);
    block(K, f, [0, y + 0.108, 0], 0.50, 0.024, 0.33, solid(K, C.blue), FX);
  }
  block(K, f, [0, 0.233, 0], 0.18, 0.014, 0.05, () => C.white, FX0);
  block(K, f, [-0.16, 0.12, 0], 0.035, 0.244, 0.336, solid(K, C.black, 0.2), FX);
  block(K, f, [-0.16, 0.12, 0.17], 0.035, 0.04, 0.006, () => C.yellow, FX0);
  return f;
}
export function firewood(K) {
  const f = new K.Facets(), C = K.C, r = 0.054, L = 0.24;
  const end = (i, k) => k === -1 ? C.sand : (k % 2 ? C.bark : K.shade(C.bark, 0.88));
  for (const [z, y] of [[-0.108, r], [0, r], [0.108, r], [-0.054, r + 0.094], [0.054, r + 0.094]]) K.tube(f, [[-L, y, z], [L, y, z]], [r, r], 6, end, FX, true, true);
  for (const x of [-0.13, 0.13]) {
    block(K, f, [x, 0.234, 0], 0.03, 0.012, 0.25, solid(K, C.black, 0.2), FX);
    block(K, f, [x, 0.003, 0], 0.03, 0.006, 0.33, solid(K, C.black, 0.2), FX);
    for (const s of [-1, 1]) block(K, f, [x, 0.115, s * 0.168], 0.03, 0.23, 0.008, solid(K, C.black, 0.2), FX);
  }
  block(K, f, [0.13, 0.12, 0.174], 0.04, 0.04, 0.008, () => C.yellow, FX0);
  return f;
}
export function gearTub(K) {
  const f = new K.Facets(), C = K.C, body = K.shade(C.steel, 0.8);
  K.bevelBox(f, [0, 0.10, 0], 0.48, 0.20, 0.31, 0.02, solid(K, body), FX);
  block(K, f, [0, 0.205, 0], 0.50, 0.018, 0.33, solid(K, body), FX);
  block(K, f, [0, 0.225, 0], 0.49, 0.03, 0.32, solid(K, K.shade(C.blue, 0.75)), FX);
  for (const x of [-0.252, 0.252]) block(K, f, [x, 0.205, 0], 0.012, 0.05, 0.12, () => C.yellow, FX0);
  block(K, f, [0, 0.10, 0.158], 0.2, 0.04, 0.008, solid(K, K.shade(body, 0.8)), FX);
  return f;
}
/* case (4 boxes): a black road case on the pair footprint, alu corner caps and edge trim, two yellow latches.
   Built at 1.03 x 0.24 x 0.33 (the tub pair); stash.js scales x and z to the pair it sits on. */
export function roadCase(K, w = 1.03, h = 0.24, d = 0.33) {
  const f = new K.Facets(), C = K.C, blk = K.shade(C.black, 1.25), alu = C.steel;
  K.bevelBox(f, [0, h / 2, 0], w, h, d, 0.012, solid(K, blk, 0.3), FX);
  block(K, f, [0, h * 0.62, 0], w + 0.006, 0.016, d + 0.006, solid(K, alu, 0.1), FX);
  const c = 0.06;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [c / 2, h - c / 2]) block(K, f, [sx * (w / 2 - c / 2 + 0.004), y, sz * (d / 2 - c / 2 + 0.004)], c, c, c, solid(K, alu, 0.1), FX);
  block(K, f, [0, h - 0.003, 0], w - 0.1, 0.008, d - 0.08, solid(K, K.shade(C.steel, 0.92), 0.1), FX);
  for (const x of [-w * 0.25, w * 0.25]) block(K, f, [x, h * 0.62, d / 2 + 0.006], 0.05, 0.05, 0.012, () => C.yellow, FX0);
  return f;
}
/* trunk (2 cases): an olive steel-cornered expedition chest with a darker lid band, side handles and a yellow stencil bar */
export function chest(K, w = 1.03, h = 0.24, d = 0.33) {
  const f = new K.Facets(), C = K.C, ol = K.shade(C.canvas, 0.95), olD = K.shade(C.canvas, 0.7), steel = C.steel;
  K.bevelBox(f, [0, h * 0.42, 0], w, h * 0.84, d, 0.012, solid(K, ol), FX);
  K.bevelBox(f, [0, h * 0.92, 0], w + 0.01, h * 0.16, d + 0.01, 0.01, solid(K, olD), FX);
  for (const x of [-w / 2 + 0.03, w / 2 - 0.03, -w / 6, w / 6]) block(K, f, [x, h / 2, 0], 0.034, h + 0.008, d + 0.012, solid(K, x * x > 0.1 ? steel : olD, 0.1), FX);
  for (const sx of [-1, 1]) block(K, f, [sx * (w / 2 + 0.012), h * 0.55, 0], 0.02, 0.03, 0.12, solid(K, C.black, 0.2), FX);
  block(K, f, [0, h * 0.42, d / 2 + 0.008], w * 0.22, 0.03, 0.006, () => C.yellow, FX0);
  return f;
}

/* ---------------------------------------------------------------- Cross Bars: slim road cases laid across the bars (long axis z) */
export function slimCase(K, bodyCol) {
  const f = new K.Facets(), C = K.C, [w, h, d] = SIZE.slim, body = bodyCol || K.shade(C.black, 1.6), alu = C.steel;
  K.bevelBox(f, [0, h / 2, 0], w, h, d, 0.012, solid(K, body, 0.3), FX);
  block(K, f, [0, h * 0.6, 0], w + 0.006, 0.014, d + 0.006, solid(K, alu, 0.1), FX);
  for (const sz of [-1, 1]) block(K, f, [0, h / 2, sz * (d / 2 - 0.025)], w + 0.01, h + 0.008, 0.04, solid(K, alu, 0.1), FX);
  block(K, f, [0, h * 0.6, -d / 2 - 0.006], 0.06, 0.04, 0.012, () => C.yellow, FX0);
  return f;
}
/* Cross Bars case (2 slim cases): a silver aluminium cargo case with black edge rails */
export function cargoCase(K, w = 0.63, h = 0.18, d = 0.95) {
  const f = new K.Facets(), C = K.C, alu = K.shade(C.steel, 1.02), blk = C.black;
  K.bevelBox(f, [0, h / 2, 0], w, h, d, 0.014, solid(K, alu, 0.12), FX);
  for (const sx of [-1, 1]) block(K, f, [sx * (w / 2 - 0.012), h - 0.004, 0], 0.03, 0.012, d - 0.04, solid(K, blk, 0.2), FX);
  for (const sz of [-1, 1]) block(K, f, [0, h / 2, sz * (d / 2 - 0.02)], w + 0.01, h + 0.006, 0.036, solid(K, blk, 0.2), FX);
  block(K, f, [0, h * 0.55, -d / 2 - 0.008], 0.12, 0.04, 0.012, () => C.yellow, FX0);
  return f;
}
/* Cross Bars trunk (2 cargo cases): a black hard cargo box, a tapered lid over a straight base, alu edge rails */
export function cargoPod(K, w = 0.63, h = 0.18, d = 0.95) {
  const f = new K.Facets(), C = K.C, blk = K.shade(C.black, 1.5), lid = K.shade(C.black, 1.9);
  K.bevelBox(f, [0, h * 0.25, 0], w, h * 0.5, d, 0.012, solid(K, blk, 0.3), FX);
  K.bevelBox(f, [0, h * 0.74, 0], w - 0.04, h * 0.48, d - 0.06, 0.035, solid(K, lid, 0.35), FX);
  for (const sx of [-1, 1]) block(K, f, [sx * (w / 2 - 0.01), h * 0.5, 0], 0.02, 0.018, d + 0.004, solid(K, C.steel, 0.1), FX);
  block(K, f, [0, h * 0.5, -d / 2 - 0.004], 0.1, 0.03, 0.01, () => C.yellow, FX0);
  return f;
}

/* ---------------------------------------------------------------- Accessory Rack deck: duffels (long axis z) and cases around them */
export function duffel(K, col) {
  const f = new K.Facets(), C = K.C, [w, h, d] = SIZE.duffel, c = col || C.canvas;
  const part = new K.Facets();
  K.tube(part, [[-0.30, 0.165, 0], [-0.17, 0.165, 0], [0.17, 0.165, 0], [0.30, 0.165, 0]], [0.11, 0.165, 0.165, 0.11], 8, (i, k) => k === -1 ? K.shade(c, 0.8) : (k % 2 ? c : K.shade(c, 0.92)), FX, true, true);
  f.add(part, { s: [1, h / 0.33, 1] });
  for (const x of [-0.13, 0.13]) block(K, f, [x, h / 2, 0], 0.035, h + 0.004, d + 0.01, solid(K, C.black, 0.2), FX);
  block(K, f, [0, h - 0.004, 0], 0.3, 0.012, 0.05, solid(K, C.black, 0.2), FX);
  block(K, f, [0.2, h * 0.8, -0.16], 0.03, 0.03, 0.012, () => C.yellow, FX0);
  return f;
}
/* deck case (2 duffels): a tan expedition hard case with black corners and latches */
export function expCase(K, w = 0.62, h = 0.24, d = 0.77) {
  const f = new K.Facets(), C = K.C, tan = K.shade(C.canvasTan, 1.05), blk = C.black;
  K.bevelBox(f, [0, h / 2, 0], w, h, d, 0.02, solid(K, tan), FX);
  block(K, f, [0, h * 0.66, 0], w + 0.006, 0.018, d + 0.006, solid(K, K.shade(tan, 0.75)), FX);
  const c = 0.06;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) block(K, f, [sx * (w / 2 - c / 2 + 0.004), h / 2, sz * (d / 2 - c / 2 + 0.004)], c, h + 0.008, c, solid(K, blk, 0.2), FX);
  for (const x of [-0.14, 0.14]) block(K, f, [x, h * 0.66, -d / 2 - 0.008], 0.06, 0.05, 0.014, () => C.yellow, FX0);
  return f;
}
/* deck trunk (2 deck cases): a ribbed aluminium transport box */
export function aluBox(K, w = 0.62, h = 0.24, d = 0.77) {
  const f = new K.Facets(), C = K.C, alu = K.shade(C.steel, 1.05), dark = K.shade(C.steel, 0.7);
  K.bevelBox(f, [0, h / 2, 0], w, h, d, 0.012, solid(K, alu, 0.12), FX);
  for (const y of [h * 0.3, h * 0.55]) block(K, f, [0, y, 0], w + 0.008, 0.012, d + 0.008, solid(K, dark), FX);
  block(K, f, [0, h * 0.8, 0], w + 0.012, 0.02, d + 0.012, solid(K, C.black, 0.2), FX);
  for (const sx of [-1, 1]) block(K, f, [sx * (w / 2 + 0.012), h * 0.5, 0], 0.016, 0.03, 0.14, solid(K, C.black, 0.2), FX);
  block(K, f, [0, h * 0.8, -d / 2 - 0.009], 0.08, 0.03, 0.01, () => C.yellow, FX0);
  return f;
}

/* ---------------------------------------------------------------- Adventure Rack: soft roll-top dry bags lying along z */
export function softBag(K, col) {
  const f = new K.Facets(), C = K.C, c = col || C.blue, R = 0.12;
  const part = new K.Facets();
  K.tube(part, [[-0.27, R, 0], [0.24, R, 0]], [R, R], 10, (i, k) => k === -1 ? K.shade(c, 0.85) : (k % 2 ? c : K.shade(c, 0.93)), FX, true, true);
  f.add(part, { s: [1, 1, 1.37] });
  block(K, f, [0.27, 0.12, 0], 0.06, 0.05, 0.24, solid(K, K.shade(c, 0.7)), FX);
  block(K, f, [0.304, 0.12, 0], 0.01, 0.03, 0.06, () => C.yellow, FX0);
  block(K, f, [-0.08, 0.12, 0], 0.03, 0.24, 0.335, solid(K, C.black, 0.2), FX);
  return f;
}
/* adventure case (2 soft bags): a big haul bag, strapped */
export function haulBag(K, w = 0.62, h = 0.24, d = 1.09) {
  const f = new K.Facets(), C = K.C, c = K.shade(C.canvasTan, 0.9);
  const part = new K.Facets();
  K.tube(part, [[0, 0.12, -0.52], [0, 0.12, -0.4], [0, 0.12, 0.4], [0, 0.12, 0.52]], [0.07, 0.12, 0.12, 0.07], 8, (i, k) => k === -1 ? K.shade(c, 0.8) : (k % 2 ? c : K.shade(c, 0.92)), FX, true, true);
  f.add(part, { s: [w / 0.24, h / 0.24, 1] });
  for (const z of [-0.25, 0.25]) block(K, f, [0, h / 2, z], w + 0.008, h + 0.004, 0.04, solid(K, C.black, 0.2), FX);
  block(K, f, [w * 0.3, h * 0.6, -d / 2 + 0.03], 0.05, 0.05, 0.012, () => C.yellow, FX0);
  return f;
}
/* adventure trunk (2 haul bags): a charcoal soft roof bag, domed, zipped round its waist */
export function rollBundle(K, w = 0.62, h = 0.24, d = 1.09) {
  const f = new K.Facets(), C = K.C, c = K.shade(C.steel, 0.42);
  const R = [{ y: 0, r: 1, sx: w / 2, sz: d / 2 }, { y: h * 0.45, r: 1, sx: w / 2, sz: d / 2 }, { y: h * 0.85, r: 1, sx: w / 2 - 0.05, sz: d / 2 - 0.06 }, { y: h, r: 1, sx: w / 2 - 0.14, sz: d / 2 - 0.16 }];
  K.loft(f, R, 12, (i, k, n) => tone(K, i === 1 ? K.shade(c, 1.12) : c, n, 0.3), FX, 5, 0, true);
  for (const z of [-d * 0.28, d * 0.28]) block(K, f, [0, h / 2, z], w + 0.006, h + 0.002, 0.035, solid(K, C.black, 0.2), FX);
  block(K, f, [w / 2 + 0.004, h * 0.45, d * 0.1], 0.012, 0.03, 0.06, () => C.yellow, FX0);
  return f;
}

/* ---------------------------------------------------------------- big units (long axis z, bottom centre origin) */
export function tentCase(K) {
  const f = new K.Facets(), C = K.C, [w, h, d] = SIZE.tent, shell = K.shade(C.steel, 0.55), base = C.black;
  K.bevelBox(f, [0, 0.06, 0], w, 0.12, d, 0.02, solid(K, base, 0.25), FX);
  K.bevelBox(f, [0, 0.12 + (h - 0.12) / 2, 0], w - 0.02, h - 0.12, d - 0.02, 0.04, solid(K, shell, 0.12), FX);
  block(K, f, [0, 0.122, 0], w + 0.006, 0.02, d + 0.006, solid(K, C.canvas), FX);
  block(K, f, [w / 2 + 0.004, 0.12, d * 0.3], 0.01, 0.04, 0.06, () => C.yellow, FX0);
  return f;
}
export function kayak(K) {
  const f = new K.Facets(), C = K.C, [w, h, L] = SIZE.kayak, hull = C.canvas, deck = K.shade(C.canvas, 1.12);
  const st = [[-1, 0.06, 0.55], [-0.82, 0.3, 0.3], [-0.5, 0.48, 0.1], [0, 0.5, 0.06], [0.5, 0.48, 0.1], [0.82, 0.3, 0.3], [1, 0.06, 0.55]];
  const ring = ([s, hw, lift]) => { const z = s * L / 2, b = lift * h * 0.5; return [[0, b, z], [hw * w * 0.6, b + 0.02, z], [hw * w, b + h * 0.35, z], [hw * w * 0.92, h * 0.62 + lift * 0.05, z], [hw * w * 0.4, h * 0.72 + lift * 0.05, z], [0, h * 0.75 + lift * 0.05, z], [-hw * w * 0.4, h * 0.72 + lift * 0.05, z], [-hw * w * 0.92, h * 0.62 + lift * 0.05, z], [-hw * w, b + h * 0.35, z], [-hw * w * 0.6, b + 0.02, z]]; };
  const R = st.map(ring), n = R[0].length;
  for (let i = 0; i < R.length - 1; i++) for (let k = 0; k < n; k++) {
    const a = R[i][k], b = R[i][(k + 1) % n], c = R[i + 1][(k + 1) % n], d = R[i + 1][k], top = k >= 3 && k <= 6;
    const ref = [0, h * 0.4, (a[2] + c[2]) / 2];
    f.quad(a, d, c, b, top ? deck : (k % 2 ? hull : K.shade(hull, 0.9)), FX, ref);
  }
  block(K, f, [0, h * 0.68, 0.05], w * 0.42, 0.06, 0.62, solid(K, C.black, 0.2), FX);
  block(K, f, [0, h * 0.72, -0.62], w * 0.25, 0.03, 0.2, solid(K, C.black, 0.2), FX);
  block(K, f, [0, h * 0.76, 0.75], 0.04, 0.02, 0.12, () => C.yellow, FX0);
  return f;
}
export function boards(K) {
  const f = new K.Facets(), C = K.C, [w, , L] = SIZE.boards, t = 0.085;
  const outline = []; const N = 14;
  for (let i = 0; i <= N; i++) { const s = -1 + 2 * i / N, hw = w / 2 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(s) * (s > 0 ? 1 : 0.96), 2.2)), 0.45); outline.push([hw, s * L / 2]); }
  const slab = (y0, top, rail) => {
    const L2 = outline.map(([hw, z]) => [hw, z]), R2 = outline.map(([hw, z]) => [-hw, z]);
    for (let i = 0; i < N; i++) {
      const a = L2[i], b = L2[i + 1], c = R2[i + 1], d = R2[i];
      f.quad([a[0], y0 + t, a[1]], [d[0], y0 + t, d[1]], [c[0], y0 + t, c[1]], [b[0], y0 + t, b[1]], top, FX, [0, y0, (a[1] + b[1]) / 2]);
      f.quad([a[0], y0, a[1]], [b[0], y0, b[1]], [c[0], y0, c[1]], [d[0], y0, d[1]], K.shade(top, 0.8), FX, [0, y0 + t, (a[1] + b[1]) / 2]);
      for (const [p, q] of [[a, b], [c, d]]) f.quad([p[0], y0, p[1]], [p[0], y0 + t, p[1]], [q[0], y0 + t, q[1]], [q[0], y0, q[1]], rail, FX, [0, y0 + t / 2, (p[1] + q[1]) / 2]);
    }
  };
  slab(0, C.white, C.canvasTan); slab(t + 0.01, K.shade(C.white, 0.94), C.blue);
  for (const z of [-0.35, 0.35]) block(K, f, [0, 0.1, z], w * 0.82, 0.2, 0.04, solid(K, C.black, 0.2), FX);
  block(K, f, [w * 0.41, 0.1, 0.35], 0.012, 0.04, 0.05, () => C.yellow, FX0);
  return f;
}
export function swagBundle(K) {
  const f = new K.Facets(), C = K.C, [w, h, d] = SIZE.swags, R = h / 2;
  const cols = [C.canvas, K.shade(C.canvas, 0.85), C.canvas];
  [-0.22, 0, 0.22].forEach((x, i) => K.tube(f, [[x, R, -d / 2], [x, R, d / 2]], [R, R], 10, (j, k) => k === -1 ? C.canvasTan : (k % 2 ? cols[i] : K.shade(cols[i], 0.92)), FX, true, true));
  for (const z of [-0.28, 0.28]) block(K, f, [0, R, z], w + 0.01, h + 0.012, 0.04, solid(K, C.bark, 0.1), FX);
  block(K, f, [0.22, h + 0.004, 0.28], 0.05, 0.012, 0.045, () => C.yellow, FX0);
  return f;
}
export function timber(K) {
  const f = new K.Facets(), C = K.C, [w, h, L] = SIZE.timber, pw = w / 3 - 0.006, ph = h / 2 - 0.004;
  for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) block(K, f, [-w / 3 + c * w / 3, ph / 2 + r * (ph + 0.008), (c + r) % 2 ? 0.04 : -0.03], pw, ph, L - 0.07, solid(K, (c + r) % 2 ? C.trunk : C.trunkShade, 0.05), FX);
  for (const z of [-0.6, 0.6]) block(K, f, [0, h / 2, z], w + 0.012, h + 0.012, 0.04, solid(K, C.black, 0.2), FX);
  block(K, f, [w / 2 + 0.008, h / 2, 0.6], 0.008, 0.04, 0.05, () => C.yellow, FX0);
  return f;
}
export function ladder(K) {
  const f = new K.Facets(), C = K.C, [w, h, L] = SIZE.ladder, al = C.steel;
  for (const [y, dw] of [[0, 0], [0.062, 0.05]]) {
    for (const sx of [-1, 1]) block(K, f, [sx * (w / 2 - 0.025 - dw / 2), y + 0.028, y ? 0.1 : 0], 0.05, 0.056, L - (y ? 0.25 : 0), solid(K, y ? al : K.shade(al, 0.86), 0.1), FX);
    for (let i = 0; i < 8; i++) block(K, f, [0, y + 0.028, -L / 2 + 0.2 + i * (L - 0.4) / 7 + (y ? 0.12 : 0)], w - 0.06 - dw, 0.026, 0.03, solid(K, al, 0.1), FX);
  }
  block(K, f, [0, 0.05, L / 2 - 0.05], w, 0.05, 0.06, solid(K, C.black, 0.2), FX);
  block(K, f, [0, 0.05, -L / 2 + 0.05], w, 0.05, 0.06, solid(K, C.black, 0.2), FX);
  block(K, f, [w / 2 - 0.03, 0.06, -L / 2 + 0.2], 0.012, 0.03, 0.05, () => C.yellow, FX0);
  return f;
}
export function pipeCase(K) {
  const f = new K.Facets(), C = K.C, [w, h, L] = SIZE.pipe, R = h / 2;
  for (const x of [-0.075, 0.075]) K.tube(f, [[x, R, -L / 2], [x, R, L / 2]], [R * 0.68, R * 0.68], 8, (i, k) => k === -1 ? C.black : (k % 2 ? C.white : K.shade(C.white, 0.9)), FX, true, true);
  for (const z of [-L / 2 + 0.04, L / 2 - 0.04]) block(K, f, [0, R, z], w, h, 0.08, solid(K, C.black, 0.2), FX);
  for (const z of [-0.5, 0.5]) block(K, f, [0, R, z], w + 0.01, h + 0.01, 0.04, solid(K, C.black, 0.2), FX);
  block(K, f, [0, h + 0.004, L / 2 - 0.04], 0.08, 0.008, 0.06, () => C.yellow, FX0);
  return f;
}

/* ---------------------------------------------------------------- loose items: the kit's gear (no glow ring) plus a camp fridge and a generator */
export function fridge(K) {
  const f = new K.Facets(), C = K.C;
  K.bevelBox(f, [0, 0.17, 0], 0.62, 0.34, 0.40, 0.03, solid(K, K.shade(C.steel, 0.85), 0.08), FX);
  block(K, f, [0, 0.35, 0.02], 0.5, 0.03, 0.34, solid(K, C.black, 0.2), FX);
  block(K, f, [0.26, 0.17, 0.2], 0.08, 0.12, 0.02, solid(K, C.black, 0.2), FX);
  return f;
}
export function genset(K) {
  const f = new K.Facets(), C = K.C;
  K.bevelBox(f, [0, 0.15, 0], 0.5, 0.3, 0.3, 0.04, solid(K, K.shade(C.hazard, 0.85), 0.08), FX);
  block(K, f, [0, 0.33, 0], 0.4, 0.04, 0.05, solid(K, C.black, 0.2), FX);
  block(K, f, [0, 0.15, 0.152], 0.3, 0.16, 0.01, solid(K, C.black, 0.2), FX);
  return f;
}
export const LOOSE_TYPES = ['swag', 'esky', 'jerry', 'wood', 'fridge', 'genset'];
export function looseItem(K, type) {
  if (type === 'swag') return K.swag(false);
  if (type === 'esky') return K.esky(false);
  if (type === 'jerry') return K.jerry(false);
  if (type === 'wood') return K.firewood(false);
  if (type === 'fridge') return fridge(K);
  return genset(K);
}

/* the model families stash.js instances: one mesh per family; families with several variants merge them and select per instance */
export function families(K) {
  const C = K.C;
  return {
    tubBox: { variants: [crate(K), eskyPair(K), firewood(K), gearTub(K)], size: SIZE.box },
    roadCase: { variants: [roadCase(K)], size: [1.03, 0.24, 0.33], scaled: true },
    chest: { variants: [chest(K)], size: [1.03, 0.24, 0.33], scaled: true },
    slimCase: { variants: [slimCase(K), slimCase(K, K.shade(C.canvas, 0.85)), slimCase(K, K.shade(C.steel, 0.7))], size: SIZE.slim },
    cargoCase: { variants: [cargoCase(K)], size: [0.63, 0.18, 0.95], scaled: true },
    cargoPod: { variants: [cargoPod(K)], size: [0.63, 0.18, 0.95], scaled: true },
    duffel: { variants: [duffel(K, C.canvas), duffel(K, K.shade(C.blue, 0.9)), duffel(K, K.shade(C.canvasTan, 0.85))], size: SIZE.duffel },
    expCase: { variants: [expCase(K)], size: [0.62, 0.24, 0.77], scaled: true },
    aluBox: { variants: [aluBox(K)], size: [0.62, 0.24, 0.77], scaled: true },
    softBag: { variants: [softBag(K, C.blue), softBag(K, K.shade(C.canvasTan, 0.95)), softBag(K, C.canvas)], size: SIZE.soft },
    haulBag: { variants: [haulBag(K)], size: [0.62, 0.24, 1.09], scaled: true },
    rollBundle: { variants: [rollBundle(K)], size: [0.62, 0.24, 1.09], scaled: true },
    tent: { variants: [tentCase(K)], size: SIZE.tent },
    kayak: { variants: [kayak(K)], size: SIZE.kayak },
    boards: { variants: [boards(K)], size: SIZE.boards },
    swags: { variants: [swagBundle(K)], size: SIZE.swags },
    timber: { variants: [timber(K)], size: SIZE.timber },
    ladder: { variants: [ladder(K)], size: SIZE.ladder },
    pipe: { variants: [pipeCase(K)], size: SIZE.pipe },
    loose: { variants: LOOSE_TYPES.map(t => looseItem(K, t)), size: null }
  };
}
