/* */

export const RAIL = 1.297, FLOOR = 0.729, PITCH = 0.242, MAX_TOP = 2.20;
export const FAM = {
  tub: { size: [0.50, 0.24, 0.33], long: 'x', caseFam: 'roadCase', trunkFam: 'chest', caseRot: 'roadCase' },
  slim: { size: [0.30, 0.18, 0.95], long: 'z', caseFam: 'cargoCase', trunkFam: 'cargoPod' },
  duffel: { size: [0.62, 0.24, 0.33], long: 'x', caseFam: 'expCase', trunkFam: 'aluBox' },
  soft: { size: [0.62, 0.24, 0.33], long: 'x', caseFam: 'haulBag', trunkFam: 'rollBundle' }
};
/* big units: family, worth, length class (long items start just behind the cab) */
export const BIG = {
  tent: { fam: 'tent', long: false }, kayak: { fam: 'kayak', long: true }, board: { fam: 'boards', long: true }, board3: { fam: 'boards', long: true },
  swags3: { fam: 'swags', long: false }, timber: { fam: 'timber', long: true }, timber3: { fam: 'timber', long: true }, logs: { fam: 'timber', long: true },
  ladder3: { fam: 'ladder', long: true }, poles: { fam: 'pipe', long: true }
};
export const BIG_SIZE = { tent: [0.64, 0.28, 1.25], kayak: [0.60, 0.253, 2.10], boards: [0.56, 0.20, 2.10], swags: [0.66, 0.23, 1.00], timber: [0.38, 0.226, 2.40], ladder: [0.44, 0.118, 2.50], pipe: [0.31, 0.228, 2.40] };

const r3 = v => Math.round(v * 1000) / 1000;
/* tub rows (no slide): four rows of 0.33 m across the 1.45 m tub, 2.5 cm apart; two columns of 0.50 m */
const TUB_Z = [-1.271, -1.626, -1.981, -2.336], TUB_X = [-0.27, 0.27];
/* MT Slide rows: three rows behind the cover canister on the 0.822 deck, two columns inside the deck lips */
const SLIDE_Z = [-1.5295, -1.8845, -2.2395], SLIDE_X = [-0.245, 0.245], SLIDE_Y = 0.823, SLIDE_K = 0.96;
/* divider front zone: three boxes standing lengthwise against the panel; back zone = tub rows 3 and 4 */
const DIV_FX = [-0.365, 0, 0.365], DIV_FZ = -1.435;
const ty = (k, y0 = FLOOR, p = PITCH) => y0 + k * p;

function S(o) {
  const F = FAM[o.fam], [a, h, b] = F.size, alongX = F.long === 'x' ? !o.rot : !!o.rot;
  const k = o.k || 1, w = (o.rot ? b : a) * (alongX ? k : 1), d = (o.rot ? a : b) * (alongX ? 1 : k);
  return { zone: o.zone, fam: o.fam, root: o.root, x: r3(o.x), y: r3(o.y), z: r3(o.z), rot: o.rot ? 1 : 0, k, w, h, d, alongX, tier: o.tier, pair: o.pair || null, side: o.side || 0, v: o.v || 0, caseFam: o.caseFam || F.caseFam, trunkFam: o.trunkFam || F.trunkFam,
    id: o.zone + ':' + r3(o.x) + ':' + r3(o.y) + ':' + r3(o.z) + ':' + (o.rot ? 1 : 0) };
}
/* variant designs for tub boxes: eskies and firewood low and at the front, tubs in the middle, crates at the back and on top */
const TUB_VAR = { 1: [1, 2, 3, 0], 2: [0, 3, 0, 0], 3: [3, 0, 3, 0] };
function tubPair(zone, z, tier, y, row, cover, rotFront) {
  return TUB_X.map((x, i) => S({ zone, fam: 'tub', root: 'tub', x, y, z, tier, pair: zone + ':r' + row, side: i, v: (TUB_VAR[tier] || TUB_VAR[3])[row] }));
}
function slidePair(z, tier, row) {
  return SLIDE_X.map((x, i) => S({ zone: 'slide', fam: 'tub', root: 'tub', x, y: ty(tier - 1, SLIDE_Y), z, k: SLIDE_K, tier, pair: 'slide:r' + row, side: i, v: (TUB_VAR[tier] || TUB_VAR[3])[(row + 1) % 4] }));
}
/* the tub layer for a configuration (MT Slide boxes are 4% narrower: the deck has catches at |x| 0.49 by z -1.56). topFit: a top product is fitted (the tub keeps one tier under it, except the Ladder Rack's cage) */
function tubSlots(cfg) {
  const cover = cfg.cover !== 'none', top = cfg.top, out = [];
  if (top === 'bars' || top === 'rack' || top === 'adventure') {
    /* a top product carries the load: the tub keeps a protected base at the front (one row under the bars, two under the racks)
       and the hidden tailgate row as reserve; everything else rides on the rack */
    if (cfg.tub === 'slide') { SLIDE_Z.slice(0, top === 'bars' ? 1 : 2).forEach((z, r) => out.push(...slidePair(z, 1, r))); return out; }
    if (cfg.tub === 'divider') {
      const fr = DIV_FX.map((x, i) => S({ zone: 'div', fam: 'tub', root: 'tub', x, y: ty(0), z: DIV_FZ, rot: 1, tier: 1, pair: i < 2 ? 'div:f' : null, side: i, v: 1, caseFam: 'expCase', trunkFam: 'aluBox' }));
      out.push(fr[1], fr[0], fr[2], ...tubPair('tub', TUB_Z[3], 1, ty(0), 3)); return out;
    }
    for (let r = 0; r < (top === 'bars' ? 1 : 2); r++) out.push(...tubPair('tub', TUB_Z[r], 1, ty(0), r));
    out.push(...tubPair('tub', TUB_Z[3], 1, ty(0), 3));
    return out;
  }
  const tiers = top === 'none' || top === 'ladder' ? 2 : 1;
  const crown = top === 'none' || top === 'ladder';
  if (cfg.tub === 'slide') {
    for (let t = 1; t <= tiers; t++) SLIDE_Z.forEach((z, r) => out.push(...slidePair(z, t, r)));
    if (crown) out.push(...slidePair(SLIDE_Z[1], 3, 1));
    return out;
  }
  if (cfg.tub === 'divider') {
    const front = t => DIV_FX.map((x, i) => S({ zone: 'div', fam: 'tub', root: 'tub', x, y: ty(t - 1), z: DIV_FZ, rot: 1, tier: t, pair: i < 2 ? 'div:f' : null, side: i, v: t === 1 ? (i === 1 ? 1 : 1) : 0, caseFam: 'expCase', trunkFam: 'aluBox' }));
    const ord = a => [a[1], a[0], a[2]];
    out.push(...ord(front(1)), ...tubPair('tub', TUB_Z[2], 1, ty(0), 2));
    if (tiers === 2) {
      if (cover) out.push(...TUB_X.map((x, i) => S({ zone: 'divc', fam: 'tub', root: 'tub', x, y: ty(1), z: -1.53, tier: 2, pair: 'divc:f', side: i, v: 0 })));
      else out.push(...ord(front(2)));
      out.push(...tubPair('tub', TUB_Z[2], 2, ty(1), 2));
    }
    out.push(...tubPair('tub', TUB_Z[3], 1, ty(0), 3));
    if (crown) out.push(...tubPair('tub', TUB_Z[2], 3, ty(2), 2));
    return out;
  }
  for (let r = 0; r < 3; r++) out.push(...tubPair('tub', TUB_Z[r], 1, ty(0), r));
  if (tiers === 2) for (let r = cover ? 1 : 0; r < 3; r++) out.push(...tubPair('tub', TUB_Z[r], 2, ty(1), r));
  out.push(...tubPair('tub', TUB_Z[3], 1, ty(0), 3));
  if (crown) for (let r = 1; r < 3; r++) out.push(...tubPair('tub', TUB_Z[r], 3, ty(2), r));
  return out;
}
/* Cross Bars: slim road cases laid across both bars, four abreast, two tiers */
const BARS_X = [-0.495, -0.165, 0.165, 0.495], BARS_Z = -1.797, BARS_Y = 1.3712, BARS_P = 0.182;
function barsSlots() {
  const out = [], ord = [1, 2, 0, 3];
  for (let t = 1; t <= 2; t++) for (const c of ord) out.push(S({ zone: 'bars', fam: 'slim', root: 'bars', x: BARS_X[c], y: BARS_Y + (t - 1) * BARS_P, z: BARS_Z, tier: t, pair: 'bars:' + (c < 2 ? 'l' : 'r'), side: c % 2, v: [0, 1, 1, 0][c] + (t - 1) * 2 }));
  return out;
}
/* Accessory Rack deck / Adventure Rack hoops: bags lying across the ute in a column of rows on the right half (the left half is the
   big lane); with no big unit on board the left half takes a low row too. The first two rows form a merge pair (a case spans both). */
function deckSlots(zone, fam, y0, rows, big) {
  const out = [], put = (x, half, t) => rows.forEach((z, ri) => out.push(S({ zone, fam, root: zone, x, y: ty(t - 1, y0), z, tier: t, pair: ri < 2 ? zone + ':' + half : null, side: ri, v: (ri + t + (half === 'L' ? 1 : 0)) % 3 })));
  put(0.36, 'R', 1);
  put(0.36, 'R', 2);
  if (!big) put(-0.36, 'L', 1);
  return out;
}
export function lanesFor(cfg) {
  /* front: where long loads start (behind the cab, or over it on the ladder rack); short loads sit centred on the rack (zShort);
     longOnly: short loads need a long load under them (the ladder rack's crossbars are 1.2 m apart) */
  if (cfg.top === 'rack') return [{ x: -0.355, y: 1.554, maxW: 0.66, front: -1.02, zShort: -1.81 }];
  if (cfg.top === 'adventure') return [{ x: -0.36, y: 1.557, maxW: 0.66, front: -1.02, zShort: -1.81 }];
  if (cfg.top === 'ladder') return [{ x: -0.25, y: 1.855, maxW: 0.44, front: -0.72, zShort: -1.76, longOnly: true }, { x: 0.25, y: 1.855, maxW: 0.44, front: -0.72, zShort: -1.76, longOnly: true }];
  return [];
}
export function layout(cfg, bigCount = 0) {
  const slots = tubSlots(cfg), big = bigCount > 0;
  if (cfg.top === 'bars') slots.push(...barsSlots());
  if (cfg.top === 'rack') slots.push(...deckSlots('deck', 'duffel', 1.554, [-1.36, -1.80, -2.24], big));
  if (cfg.top === 'adventure') slots.push(...deckSlots('hoops', 'soft', 1.557, [-1.432, -2.193], big));
  /* order: the tub's first tier, then the top zone, then the rest of the tub (the hidden tailgate row last) */
  const t1 = slots.filter(s => s.tier === 1 && (s.zone === 'tub' || s.zone === 'div' || s.zone === 'slide') && s.z > -2.2);
  const back = slots.filter(s => s.tier === 1 && (s.zone === 'tub' || s.zone === 'div' || s.zone === 'slide') && s.z <= -2.2);
  const topZ = slots.filter(s => s.root !== 'tub');
  const rest = slots.filter(s => !t1.includes(s) && !back.includes(s) && !topZ.includes(s));
  let ordered = cfg.tub === 'slide' ? [...t1, ...back, ...topZ, ...rest] : [...t1, ...topZ, ...rest, ...back];
  /* before a top product the tub fills as a block from the cab end, both tiers (the front rows are the ones the chase camera
     sees), then the rows behind, the crown, and the hidden tailgate row last */
  if (cfg.top === 'none') {
    const key = q => (q.root !== 'tub' ? 9 : q.tier === 1 && q.z <= -2.2 && cfg.tub !== 'slide' ? 8 : q.tier >= 3 ? 7 : q.z > -1.9 ? 0 : 1) * 10 + q.tier;
    ordered = slots.slice().sort((a, b) => key(a) - key(b) || b.z - a.z || slots.indexOf(a) - slots.indexOf(b));
  }
  /* the composed load: the first CAP places (the hidden tailgate row stays as a reserve after them) */
  const CAP = { bars: 10, rack: 9, adventure: 8, ladder: 8 }[cfg.top];
  if (CAP) { const res = ordered.filter(s => s.root === 'tub' && s.tier === 1 && s.z <= -2.2 && cfg.tub !== 'slide'), main = ordered.filter(s => !res.includes(s)); ordered.length = 0; ordered.push(...main.slice(0, CAP), ...res); }
  ordered.forEach((s, i) => { s.order = i; });
  /* supports: same-root slots one tier down whose footprints overlap by more than 2 cm */
  for (const s of ordered) {
    s.sup = [];
    if (s.tier > 1) for (const q of ordered) { if (q.root !== s.root || q.tier !== s.tier - 1) continue; const ox = Math.min(s.x + s.w / 2, q.x + q.w / 2) - Math.max(s.x - s.w / 2, q.x - q.w / 2), oz = Math.min(s.z + s.d / 2, q.z + q.d / 2) - Math.max(s.z - s.d / 2, q.z - q.d / 2); if (ox > 0.02 && oz > 0.02) s.sup.push(q.id); }
  }
  const byId = new Map(ordered.map(s => [s.id, s]));
  /* pairs: key -> tier -> [slotA, slotB] */
  const pairs = new Map();
  for (const s of ordered) if (s.pair) { if (!pairs.has(s.pair)) pairs.set(s.pair, new Map()); const P = pairs.get(s.pair); if (!P.has(s.tier)) P.set(s.tier, []); P.get(s.tier)[s.side] = s; }
  for (const [k, P] of pairs) for (const [t, arr] of P) if (!arr[0] || !arr[1]) P.delete(t);
  return { slots: ordered, byId, pairs, lanes: lanesFor(cfg), cfg };
}
/* the pose of a case or trunk on a pair (centre and footprint) */
export function pairPose(a, b) {
  const x0 = Math.min(a.x - a.w / 2, b.x - b.w / 2), x1 = Math.max(a.x + a.w / 2, b.x + b.w / 2), z0 = Math.min(a.z - a.d / 2, b.z - b.d / 2), z1 = Math.max(a.z + a.d / 2, b.z + b.d / 2);
  return { x: (x0 + x1) / 2, y: a.y, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, h: a.h };
}
/* keep-out volumes of the fittings (for the fit choreography's planning only; the QA tests the real triangles) */
export const KEEP = {
  divider: [[-0.78, 0.78, 0.78, 1.245, -1.74, -1.705], [-0.78, -0.6, 0.78, 1.245, -1.86, -1.585], [0.6, 0.78, 0.78, 1.245, -1.86, -1.585]],
  slide: [[-0.535, 0.535, 0.715, 0.90, -2.47, -1.11]],
  cover: [[-0.70, 0.70, 1.05, 1.30, -1.335, -0.98], [-0.78, -0.66, 0.83, 1.30, -2.54, -0.98], [0.66, 0.78, 0.83, 1.30, -2.54, -0.98], [-0.78, 0.78, 1.24, 1.30, -2.54, -2.42]],
  bars: [[-0.78, 0.78, 1.29, 1.37, -1.436, -1.38], [-0.78, 0.78, 1.29, 1.37, -2.214, -2.159]],
  rack: [[-0.715, 0.715, 1.51, 1.555, -2.48, -1.15], [-0.715, -0.6, 1.29, 1.51, -2.48, -1.15], [0.6, 0.715, 1.29, 1.51, -2.48, -1.15]],
  ladder: [[-0.84, 0.84, 1.80, 1.905, -1.21, -1.08], [-0.84, 0.84, 1.80, 1.905, -2.43, -2.30], [-0.84, -0.57, 1.29, 1.905, -1.21, -1.08], [0.57, 0.84, 1.29, 1.905, -1.21, -1.08], [-0.84, -0.57, 1.29, 1.905, -2.43, -2.30], [0.57, 0.84, 1.29, 1.905, -2.43, -2.30]],
  adventure: [[-0.76, 0.76, 1.51, 1.557, -1.452, -1.412], [-0.76, 0.76, 1.51, 1.557, -2.213, -2.173], [-0.77, -0.70, 1.29, 1.557, -2.28, -1.35], [0.70, 0.77, 1.29, 1.557, -2.28, -1.35]]
};
export const PRODUCT_OF = { divider: 'tub', slide: 'tub', rollM: 'cover', rollE: 'cover', bars: 'top', rack: 'top', ladder: 'top', adventure: 'top' };
export function keepFor(cfg) {
  const out = [];
  if (cfg.tub !== 'none') out.push(...KEEP[cfg.tub]);
  if (cfg.cover !== 'none') out.push(...KEEP.cover);
  if (cfg.top !== 'none') out.push(...KEEP[cfg.top]);
  return out;
}
