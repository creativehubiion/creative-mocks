/* */
/* */


const ENV = typeof window !== 'undefined' && window.RT ? window.RT : null;
export const Q = ENV ? ENV.Q : new URLSearchParams(typeof process !== 'undefined' ? process.argv.slice(2).filter(a => a.includes('=')).join('&') : '');
/* the view fills these in; the logic never touches three.js or the DOM */
export const FX = { sfx() {}, callUte() {}, callTop() {}, act() {}, plus() {}, cue() {}, event() {}, live: () => false, playing: () => false, width: () => 400 };
export const YEL = '#FFC600';
export function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export const gauss = r => { let u = 0, v = 0; while (!u) u = r(); while (!v) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
export const CONFIG = {
  length: 900, cruise: 14, cruise3: 16, startV: 7, accel: 3.3, hitV: 0.35, wetV: 0.6, dark: 74, half: 4.0, uMax: 3.35, hitHalf: 1.15, keyRate: 9,
  target: 50, stars: [50, 60, 70], barMax: 75,
  gateS: [118, 300, 560], campS: 890, act2S: 244, holdAt: 2.0, clearAfter: 18, hzAfter: 36, hzBefore: 14,
  gearSpace: 2.3, gearR: 0.95, slideR: 1.52, bigR: 1.25, gearDs: 1.5, longDs: 2.2, near: 0.45,
  budget: [11, 16, 18, 28], haul: 8, lineMax: 10, roughP: 0.5, roughN: 3, heavyP: 0.2, legSupply: 6, evoeCharges: 2, evoeShut: 3.4, looseCap: 6,
  /* ambient rough ground (owner): the worn wheel tracks are smooth; off them an over-tall loose stack teeters, then sheds an edge piece */
  ambient: 1, tracks: [-1.7, 0, 1.7], trackHalf: 0.45, teeterT: 1.0, edgeEvery: [0, 1.8, 1.0], bonusSlide: 0, bonusBars: 2, bigMax: 4, longMax: 3,
  pile: { perLayer: 12, packPerLayer: 12, layerH: 0.2, layers: 6, layersBars: 8, hitMin: 3, roadScale: 0.8, tubScale: 0.6 },
  hz: { first: 80, gap: 18, gapPair: 8, gap3: 13, jitter: 8, perLat: 4.6, pathSlope: 6.2, react: 9, settle: 5 },
  /* loss sizes (balance pass 2026-11-11): potholes potN (+1 on odd features); grid and creek gridN / creekN pieces (0 = the top loose layer);
     crest crestMax pieces above max(secure line, crestFloor) (0 = the top loose layer); fullGridP = share of act-3 grids that span the road */
  fx: { corrugEvery: 0.5, corrugMin: 7, gustTake: 2, gridMin: 3, branchY: 2.0, potN: 3, gridN: 0, creekN: 0, crestMax: 0, crestFloor: 0, fullGridP: 0, deckCap: 6 },
  /* gate stop: the hold starts at gateS - holdAt - easeK x speed. easeK 0 (the default) keeps the old trigger; the prototype view sets
     holdAt = nose - 0.3 and easeK 0.1417 (the 0.3 s ease's travel per m/s in 1/60 s steps) so the freeze completes with the nose under the arch */
  hold: { nose: 2.76, easeK: 0, inT: 0.3, botPick: 1.2, fitT: 2.0, fitSnap: 1.5, goT: 0, outT: 0.7 },
  shields: 2, elecRecharge: 8, dbl: 5,
  sigma: { gear: 0.5, hz: [0.75, 0.55, 0.4] }, react: [0.35, 0.7], view: 40, botLead: 4,
  drive: {
    wb: 3.22, track: 1.68, look0: 0.6, lookK: 0.42, lookMin: 2.5, lookMax: 8,
    steerMax: 1.7, steerV: 8, steerIn: 24, steerOut: 30, yawK: 10, gripK: 16, maxRel: 0.18, steerCap: 0.62, center: 0.85, assist: 0.5, lookRel: 6,
    slipVis: 0.02, slipMax: 0.02, slipK: 8, keyLead: 1.5, dragFrac: 0.72, dragMaxPx: 560, weight: 1
  },
  susp: { heaveW: 11, heaveZ: 0.45, pitchW: 8, pitchZ: 0.6, rollW: 7, rollZ: 0.6, rollK: 0.008, rollCap: 0.08, pitchK: 0.008, pitchCap: 0.035, accF: 8, travel: 0.17, kickV: -0.9, kickPitch: 0.25, roll: 1 },
  terr: { hill: [0.8, 85, 0.45, 47], bank: [0.04, 63], bump: [0.045, 3.6, 0.03, 5.7, 0.025, 9.5], berm: [0.9, 5.0, 6.5, 9, 16], fade: 24 },
  cam: {
    lateralFollow: 0.65, spring: 7, lookSpring: 11, heading: 0.3, ahead: 11, aheadMix: 0.35, lookAhead: 40, fovAtSpeed: 0.08, shake: [0.008, 0.12], orbitR: 7.2, orbitH: 3.2
  },
  code: 'XXXX-XXXX', revealHold: 4.4
};
export const L = CONFIG.length, NT = L + 100;
export const TUB_FLOOR = 0.98, TF = TUB_FLOOR;
/* wheel layout in the ute's frame: x + = the ute's left, z + = forward. Order FL, FR, RL, RR. */
export const WHX = [0.84, -0.84, 0.84, -0.84], WHZ = [1.62, 1.62, -1.6, -1.6], WHR = 0.42, CGY = 0.9;
export const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
export const wrapA = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
export const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const sm01 = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const R2 = i => ((i * 2654435761) % 1000) / 1000;
/* direct lateral control (owner 2026-11-11): the ute's line follows the target with a critically damped spring (latW 13: a new line in
   about 0.3 s), no pull to the centre, no soft edge, no response lag; body yaw and roll are drawn from the lateral motion (yaw capped
   about 13 deg) so the weight shows in the body, not in the response. A swipe of 38% of the screen width crosses the road (sens scales
   it). The pursuit model of the stack prototype stays behind ?drive=pursuit. */
Object.assign(CONFIG.drive, { mode: Q.get('drive') === 'pursuit' ? 'pursuit' : 'direct', latW: 13, yawCap: 0.23, dragFrac: 0.38, dragMaxPx: 1400, keyLead: 1.2, sens: clamp(+(Q.get('sens') || 1), 0.5, 2) });
CONFIG.ambient = clamp(Q.has('ambient') ? +Q.get('ambient') : 0, 0, 2);
/* drive smoothly (owner): a swerve is a reversal of lateral speed: the speed before the reversal and the new speed (m/s), both reached
   within window s, give its intensity I. I >= warn with loose gear on board: STEADY warning for again s; a second I >= warn inside it
   throws 1 loose piece (2 at I >= lose), and I >= violent throws 3 at once; +1 when more than tall loose layers ride (at most 3).
   Cross Bars or a loaded rack deck raise every threshold by barsK. cooldown s after a throw; never in the first 6 s or 1.5 s after a gate */
CONFIG.swerve = { on: 1, warn: 9, lose: 12, violent: 15, window: 0.45, again: 1.2, cooldown: 1.6, barsK: 1.2, tall: 2 };
/* stability (owner): no stacking cap. Loose cargo above the protected line is counted in boxes of box pieces; hold boxes ride solid
   (+bars with Cross Bars, +deck with cargo on a rack's deck), then stability falls linearly from 1 to 0 over span boxes. Losses scale by
   1 + featK x (1 - stability); swerve thresholds by swMin + (1 - swMin) x stability; below danger the crest takes two boxes (event
   unstable on entry); at or below crit any signed bump (smooth line too) or hard swerve sheds the top box */
CONFIG.stab = { box: 6, hold: 1, bars: 0, deck: 2, span: 3, danger: 0.35, crit: 0.1, featK: 1.5, swMin: 0.55 };
/* the game turns off any feature type it does not draw (set before reset(seed)): an off type is never laid */
CONFIG.features = { pothole: 1, corrug: 1, grid: 1, creek: 1, crest: 1, rocks: 1, log: 1, washout: 1 };
/* a smooth graded road: the small surface bumps are gentle long curves (the uneven features are their own shapes) */
CONFIG.terr.bump = [0.016, 7.2, 0.012, 11.4, 0.01, 17];
export const hashId = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h >>> 0; };

/* ---------- gear: four small camp-gear types, three big-ticket items (tub rack, worth 3) and three long loads (ladder rack, worth 2) ---------- */
export const GT = [
  { id: 'swag', label: 'SWAG', col: '#6c6f68', ink: '#ffffff', h: 0.32, kind: 'small', w: 1 },
  { id: 'esky', label: 'ESKY', col: '#d9d9d5', ink: '#222222', h: 0.34, kind: 'small', w: 1 },
  { id: 'jerry', label: 'JERRY', col: '#4a4d51', ink: '#ffffff', h: 0.34, kind: 'small', w: 1 },
  { id: 'wood', label: 'WOOD', col: '#958f84', ink: '#111111', h: 0.3, kind: 'small', w: 1 },
  { id: 'tent', label: 'ROOF TENT', col: '#5d6168', ink: '#ffffff', h: 0.42, kind: 'big', w: 3 },
  { id: 'kayak', label: 'KAYAK', col: '#c9c6bd', ink: '#222222', h: 0.3, kind: 'big', w: 3 },
  { id: 'logs', label: 'LONG WOOD', col: '#8b8478', ink: '#111111', h: 0.36, kind: 'big', w: 3 },
  { id: 'timber', label: 'TIMBER', col: '#a59e90', ink: '#111111', h: 0.2, kind: 'long', w: 2 },
  { id: 'poles', label: 'POLES', col: '#55585c', ink: '#ffffff', h: 0.22, kind: 'long', w: 2 },
  { id: 'board', label: 'BOARD', col: '#dcdad3', ink: '#222222', h: 0.14, kind: 'long', w: 2 },
  { id: 'fridge', label: 'FRIDGE x2', col: '#b9bdc2', ink: '#111111', h: 0.34, kind: 'small', w: 2 },
  { id: 'genset', label: 'GENSET x3', col: '#6d7074', ink: '#ffffff', h: 0.34, kind: 'small', w: 3 },
  { id: 'timber3', label: 'TIMBER x3', col: '#a59e90', ink: '#111111', h: 0.3, kind: 'big', w: 3 },
  { id: 'ladder3', label: 'LADDER x3', col: '#9aa0a6', ink: '#111111', h: 0.14, kind: 'big', w: 3 },
  { id: 'swags3', label: 'SWAGS x3', col: '#6c6f68', ink: '#ffffff', h: 0.34, kind: 'big', w: 3 },
  { id: 'board3', label: 'BOARD x3', col: '#dcdad3', ink: '#222222', h: 0.14, kind: 'big', w: 3 }
];
export const RACK_ITEMS = { rack: [4, 5], ladder: [12, 13], adventure: [14, 15] };
export const LAYER_H = { small: 0.34, big: 0.44, long: 0.26 };

/* ---------- hazards: each takes gear off a ute in its own way, each is answered by a product ---------- */
export const HZT = {
  pothole: { name: 'Potholes', short: 'potholes', cat: 'shake', len: 3.0, take: '3-4 loose, up to 10 from an unstable stash' },
  crest: { name: 'Crest jump', short: 'crest jump', cat: 'shake', len: 2.0, take: 'a box (6) loose, two boxes from an unstable stash' },
  rocks: { name: 'Rock fall', short: 'rock falls', cat: 'impact', len: 1.6 },
  log: { name: 'Fallen branch', short: 'fallen branch', cat: 'impact', len: 1.2 },
  washout: { name: 'Washed-out edge', short: 'washout', cat: 'impact', len: 4.0 },
  corrug: { name: 'Corrugations', short: 'corrugations', cat: 'shake', len: 16, take: '2 loose a second' },
  grid: { name: 'Cattle grid', short: 'cattle grid', cat: 'shake', len: 1.2, take: 'a box (6) loose, up to 15 from an unstable stash' },
  creek: { name: 'Creek dip', short: 'creek', cat: 'shake', len: 7, take: 'a box (6) loose, up to 15 from an unstable stash' },
  gust: { name: 'Willy-willy', short: 'willy-willies', cat: 'dust', len: 1.0 },
  branch: { name: 'Low branch', short: 'low branches', cat: 'branch', len: 1.0 }
};
/* which hazard types each leg uses, in order (leg 1 uses rock falls until the gorge starts at act2S) */
export const LEG = [
  { seq: ['pothole', 'rocks', 'pothole'] },
  { seq: ['corrug', 'grid', 'pothole', 'corrug', 'rocks'] },
  { seq: ['creek', 'corrug', 'crest', 'pothole', 'log', 'creek', 'grid', 'corrug'] },
  { seq: ['washout', 'corrug', 'crest', 'grid', 'pothole', 'creek', 'log', 'corrug', 'grid', 'pothole'] }
];
/* the NEXT LEG strip names the leg's hazard types in order of first appearance (filled after the layout) */
export const LEG_AHEAD = [[], [], [], []];
export const CP_NAME = ['the open road', 'the gorge', 'the sunset run'];
export const ACT_NAME = ['The open road', 'The gorge', 'Race the sunset'];

/* ---------- products: three gates in real fitment order. ANSWERS = the hazards a product makes harmless ---------- */
/* rail-mounted products and the cover kit sit at rail height RAIL (the top of the tub load: three layers of six) */
export const RAIL = TF + 3 * 0.2 + 0.02, DECK = TF + 6 * 0.2 + 0.12;
/* RealTruck Australia's real products for the 2022+ Ranger (01-read/products.md): display names and shop pages. No prices, load
   ratings or sale terms in game copy. The UTM tags are placeholders until the client's campaign tagging is known. */
export const SHOP_BASE = 'https://realtruck.com.au/products/', UTM = '?utm_source=game&utm_medium=social&utm_campaign=black_friday';
/* alternates for a fourth or fifth gate-3 card later (not in the gates now) */
export const PROD_ALT = {
  carriers: { name: 'Cargo Carriers', label: 'Cargo Carriers', short: 'Cargo Carriers', url: SHOP_BASE + 'cargo-carriers-evo-fo10' + UTM, line: 'Carry more up top on the roll cover', fitment: 'on the cover' }
};
export const PROD = {
  divider: { get: 'PROTECTS 12 CARGO', but: 'no bonus cargo', card: 'BED DIVIDER', name: 'Bed Divider', label: 'Bed Divider', short: 'Bed Divider', url: SHOP_BASE + 'bed-divider-fo10' + UTM, line: 'Protects your bottom 12 pieces for the rest of the trail', answers: [], tag: '+1 SECURE' },
  slide: { get: 'HEAVY CARGO x2', but: 'nothing protected', card: 'MT SLIDE', name: 'MT Slide', label: 'MT Slide', short: 'MT Slide', url: SHOP_BASE + 'mt-slide-fo10' + UTM, line: 'Haul the heavy stuff: heavy cargo worth 2 and 3 turns up on the road. Nothing extra is protected', answers: [], tag: 'HEAVY x2-3' },
  rollM: { get: 'PROTECTS 12 CARGO', but: 'no bonus cargo', card: 'EVOm ROLL COVER', name: 'EVOm Manual Roll Cover', label: 'EVOm Manual Roll Cover', short: 'EVOm cover', url: SHOP_BASE + 'manual-roll-cover-fo10' + UTM, line: 'Secure storage, set and forget: its rails protect 12 more pieces. Big hits still take the loose rest', answers: [], tag: '+1 SECURE' },
  rollE: { get: 'BLOCKS 2 BIG HITS A LEG', but: 'nothing protected', card: 'EVOe ROLL COVER', name: 'EVOe Electric Roll Cover', label: 'EVOe Electric Roll Cover', short: 'EVOe cover', url: SHOP_BASE + 'electric-roll-cover-fo10' + UTM, line: 'Closes itself for two big hits each leg (crest, grid, creek) while loose cargo is on board. Nothing is protected', answers: [], tag: '2 AUTO SHUTS' },
  bars: { get: 'PROTECTS 12 MORE CARGO', but: 'no bonus cargo', card: 'CROSS BARS', name: 'Cross Bars', label: 'Cross Bars', short: 'Cross Bars', url: SHOP_BASE + 'cross-bars-flat-profile-fitment' + UTM, line: 'Protects 12 more pieces and lets you stack higher', answers: [], tag: '+2 SECURE' },
  rack: { get: 'BIG CARGO x3', but: 'nothing protected', card: 'ACCESSORY RACK', name: 'Accessory Rack 75', label: 'Accessory Rack 75', short: 'Accessory Rack 75', url: SHOP_BASE + 'accessory-rack-75-flat-evo' + UTM, line: 'A secured deck up top: a roof tent and a kayak worth 3 each. Nothing in the tub is protected', answers: [], tag: 'BIG CARGO x3' },
  ladder: { get: 'BIG CARGO x3', but: 'nothing protected', card: 'LADDER RACK', name: 'Ladder Rack', label: 'Ladder Rack', short: 'Ladder Rack', url: SHOP_BASE + 'ladder-rack-25-flat' + UTM, line: 'Long, bulky loads overhead: timber and a ladder worth 3 each on its secured deck. Nothing in the tub is protected', answers: [], tag: 'BIG CARGO x3' },
  adventure: { get: 'BIG CARGO x3', but: 'nothing protected', card: 'ADVENTURE RACK', name: 'Adventure Rack 75', label: 'Adventure Rack 75', short: 'Adventure Rack 75', url: SHOP_BASE + 'adventure-rack-75-standard' + UTM, line: 'Mid-height cross bars on a secured deck: swag rolls and a board worth 3 each. Nothing in the tub is protected', answers: [], tag: 'BIG CARGO x3' },
};
/* the card's icon row: what the item does (sec1 / sec2 raise the secure line, tap = one-touch shut, heavy2 / big3 / long2 = worth more);
   'ahead' adds up to two of the next leg's road features with a tick */
export const ROLE = { divider: 'secure', slide: 'haul', rollM: 'secure', rollE: 'haul', bars: 'secure', rack: 'haul', ladder: 'haul', adventure: 'haul' };
export const CARD_ICONS = { divider: ['shield', 'sec1', 'nohaul'], slide: ['haul', 'heavy2', 'exposed'], rollM: ['shield', 'sec1', 'nohaul'], rollE: ['haul', 'battery2', 'ok-crest'], bars: ['shield', 'sec2', 'nohaul'], rack: ['haul', 'big3', 'exposed'], ladder: ['haul', 'big3', 'exposed'], adventure: ['haul', 'big3', 'exposed'] };
export const GATES = [{ title: 'Sort the tub', opts: ['divider', 'slide'] }, { title: 'Cover it', opts: ['rollM', 'rollE'] }, { title: 'Rack it', opts: ['bars', 'rack'] }];
export const RACKS = ['rack', 'ladder', 'adventure'], RACK_Q = { accessory: 'rack', ladder: 'ladder', adventure: 'adventure' }[Q.get('rack')] || null;
export const PICKQ = (Q.get('pick') || '').split(',').map(x => parseInt(x, 10) - 1);

/* ---------- the trail: a seeded centreline table; the gorge (act 2) adds a tighter bend term ---------- */
export const TX = new Float32Array(NT + 1), TZ = new Float32Array(NT + 1), TH = new Float32Array(NT + 1);
export let curve = null;
export const gorgeW = s => smooth(CONFIG.act2S - 20, CONFIG.act2S + 10, s) * (1 - smooth(CONFIG.gateS[2] - 25, CONFIG.gateS[2] + 5, s));
export const TRAIL = { fill: null };
export const GROUND = { base: null };
export function buildTrail(R) {
  const a1 = 0.26 + R() * 0.12, l1 = 180 + R() * 80, p1 = R() * 6.283, a2 = 0.10 + R() * 0.08, l2 = 70 + R() * 30, p2 = R() * 6.283, a3 = 0.15 + R() * 0.05, l3 = 48 + R() * 10, p3 = R() * 6.283;
  const th0 = a1 * Math.sin(p1) + a2 * Math.sin(p2);
  let x = 0, z = 0;
  for (let i = 0; i <= NT; i++) {
    const th = a1 * Math.sin(6.2832 * i / l1 + p1) + a2 * Math.sin(6.2832 * i / l2 + p2) - th0 + gorgeW(i) * a3 * Math.sin(6.2832 * i / l3 + p3);
    TX[i] = x; TZ[i] = z; TH[i] = th; x += Math.sin(th); z += Math.cos(th);
  }
  if (TRAIL.fill) TRAIL.fill(TX, TZ, TH);
  curve = { a1: +a1.toFixed(3), l1: +l1.toFixed(1), a2: +a2.toFixed(3), l2: +l2.toFixed(1), gorge: [+a3.toFixed(3), +l3.toFixed(1)] };
}
export function trailAt(s, u, out) {
  let x, z, th;
  if (s <= 0) { th = TH[0]; x = TX[0] + Math.sin(th) * s; z = TZ[0] + Math.cos(th) * s; }
  else if (s >= NT) { th = TH[NT]; x = TX[NT] + Math.sin(th) * (s - NT); z = TZ[NT] + Math.cos(th) * (s - NT); }
  else { const i = Math.floor(s), f = s - i; th = TH[i] + (TH[i + 1] - TH[i]) * f; x = TX[i] + (TX[i + 1] - TX[i]) * f; z = TZ[i] + (TZ[i + 1] - TZ[i]) * f; }
  out.x = x - Math.cos(th) * u; out.z = z + Math.sin(th) * u; out.th = th; return out;
}
export const PJ = { x: 0, z: 0, th: 0 };
export function toTrail(x, z, hint, out) {
  const i0 = clamp(Math.floor(hint) - 4, 0, NT - 1), i1 = Math.min(NT - 1, i0 + 9);
  let best = 1e18, bs = 0;
  for (let i = i0; i <= i1; i++) {
    const ax = TX[i], az = TZ[i], dx = TX[i + 1] - ax, dz = TZ[i + 1] - az;
    let f = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz);
    if (f < 0 && i > 0) f = 0; else if (f > 1 && i < NT - 1) f = 1;
    const ex = ax + dx * f - x, ez = az + dz * f - z, d = ex * ex + ez * ez;
    if (d < best) { best = d; bs = i + f; }
  }
  trailAt(bs, 0, PJ);
  out.s = bs; out.u = (PJ.x - x) * Math.cos(PJ.th) + (z - PJ.z) * Math.sin(PJ.th); out.th = PJ.th; return out;
}

/* ---------- the ground: hills, banking, small bumps (calmed under hazards), berms (taller in the gorge), cattle-grid humps, creek dips ---------- */
export const TP = { p1: 0, p2: 0, p3: 0, q1: 0, q2: 0, q3: 0 };
export const BM = new Float32Array(NT + 141);
export let JUMPS = [], CREEKS = [], CRESTS = [];
export function terrainSeed(seed) { const R = rng(seed * 104729 + 3); TP.p1 = R() * 6.283; TP.p2 = R() * 6.283; TP.p3 = R() * 6.283; TP.q1 = R() * 6.283; TP.q2 = R() * 6.283; TP.q3 = R() * 6.283; }
export function terrainMask() {
  BM.fill(1);
  for (const h of HZ) for (let s = Math.floor(h.s0 - 4); s <= Math.ceil(h.s1 + 4); s++) {
    const d = Math.max(h.s0 - 1.5 - s, s - h.s1 - 1.5, 0), i = s + 40;
    if (i >= 0 && i < BM.length) BM[i] = Math.min(BM[i], smooth(0, 2.5, d));
  }
  JUMPS = HZ.filter(h => h.type === 'grid').map(h => ({ s: h.s0 + 0.6 }));
  CRESTS = HZ.filter(h => h.type === 'crest').map(h => ({ s: h.s0 + 1 }));
  CREEKS = HZ.filter(h => h.type === 'creek').map(h => ({ m: (h.s0 + h.s1) / 2, hw: (h.s1 - h.s0) / 2 + 1.5 }));
}
export function maskAt(s) { const f = clamp(s + 40, 0, BM.length - 1.001), i = Math.floor(f); return BM[i] + (BM[i + 1] - BM[i]) * (f - i); }
export function groundH(s, u) {
  const T = CONFIG.terr, a = Math.abs(u), fade = 1 - smooth(6, T.fade, a);
  let h = GROUND.base ? GROUND.base(s, u) : (T.hill[0] * (1 + Math.sin(6.2832 * s / T.hill[1] + TP.p1)) + T.hill[2] * (1 + Math.sin(6.2832 * s / T.hill[3] + TP.p2)) + 0.4 + T.bank[0] * Math.sin(6.2832 * s / T.bank[1] + TP.p3) * clamp(u, -6, 6)) * fade;
  const inner = 1 - smooth(3.6, 4.8, a);
  if (inner > 0) {
    const m = maskAt(s) * inner, B = T.bump;
    if (m > 0) h += m * (B[0] * Math.sin(6.2832 * s / B[1] + 0.4 * u + TP.q1) + B[2] * Math.sin(6.2832 * s / B[3] - 0.55 * u + TP.q2) + B[4] * Math.sin(6.2832 * s / B[5] + 0.85 * u + TP.q3));
    for (let k = 0; k < CRESTS.length; k++) { const d = s - CRESTS[k].s; if (d > -4 && d < 3) h += inner * 0.55 * (1 + Math.cos(Math.PI * d / (d < 0 ? 4 : 3))) / 2; }
    for (let k = 0; k < JUMPS.length; k++) { const d = s - JUMPS[k].s; if (d > -1.4 && d < 1.4) h += inner * 0.15 * (1 + Math.cos(Math.PI * d / 1.4)) / 2; }
  }
  for (let k = 0; k < CREEKS.length; k++) { const c = CREEKS[k], d = s - c.m; if (d > -c.hw && d < c.hw) h -= 0.32 * (1 + Math.cos(Math.PI * d / c.hw)) / 2 * (1 - smooth(5, 8, a)); }
  const E = T.berm, g = gorgeW(s);
  if (GROUND.base) return h;
  return h + E[0] * (1 + 1.8 * g) * smooth(E[1], E[2], a) * (1 - smooth(E[3], E[4] + 8 * g, a));
}
export const GW = { s: 0, u: 0, th: 0 };
export function groundAtWorld(x, z, hint) { toTrail(x, z, hint, GW); return groundH(GW.s, GW.u); }

/* ---------- layout ----------
   Hazards for all four legs are laid at reset (seeded per leg, the same whatever the player picks, so the NEXT LEG strip is true).
   Gear for a leg is laid when its gate is chosen (seeded by the leg and the product): tub slide = wide zig-zag lines, tub rack = big items
   at line ends, ladder rack = long loads in threes, cargo bars = a few more pieces. Spacing (owner 16:40, body yaw about 13 deg): each hazard
   sits at least pathSlope (6.2) m per metre of lateral move after the previous one on the clean path, and react (9 m, 15% more at the act-3
   speed) + perLat (4.6) m per metre between safe-line centres, for a first-timer who aims for the middle of each safe line. */
export let HZ = [], GP = [], NODES = [], BG = [], SIDE = [], BAYS = [], LEGN = [0, 0, 0, 0, 0], legBuilt = [false, false, false, false], layoutSeed = -1, nSpare = 0;
export const SPARES = 18;
export function freeOf(spans, mg) {
  const M = mg == null ? CONFIG.hitHalf : mg;
  let free = [[-CONFIG.uMax, CONFIG.uMax]];
  for (const [a, b] of spans) {
    const lo = a - M, hi = b + M, next = [];
    for (const [f0, f1] of free) { if (hi <= f0 || lo >= f1) next.push([f0, f1]); else { if (lo > f0) next.push([f0, lo]); if (hi < f1) next.push([hi, f1]); } }
    free = next;
  }
  return free.filter(f => f[1] - f[0] > 0.3);
}
export function nearestFree(free, x, m) {
  let best = 0, bd = 1e9;
  for (const [a, b] of free) { const mm = Math.min(m, (b - a) / 2), y = clamp(x, a + mm, b - mm), d = Math.abs(y - x); if (d < bd) { bd = d; best = y; } }
  return best;
}
export function centreOf(free) { let best = free[0], bw = -1; for (const f of free) if (f[1] - f[0] > bw) { bw = f[1] - f[0]; best = f; } return best ? (best[0] + best[1]) / 2 : 0; }
export const inFree = (free, u) => { for (const f of free) if (u >= f[0] && u <= f[1]) return true; return false; };
export let pathK = 0;
export function pathU(s) {
  if (!NODES.length) return 0;
  if (pathK >= NODES.length - 1 || NODES[pathK].s > s) pathK = 0;
  while (pathK < NODES.length - 2 && NODES[pathK + 1].s <= s) pathK++;
  const A = NODES[pathK], B = NODES[pathK + 1];
  if (!B || s <= A.s) return A.u;
  if (s >= B.s) return B.u;
  const t = (s - A.s) / (B.s - A.s);
  return A.u + (B.u - A.u) * sm01(t) + (A.arc || 0) * Math.sin(Math.PI * t);
}
export function buildBase(seed) {
  const R = rng(seed * 7919 + 13);
  buildTrail(R);
  HZ = []; BG = []; SIDE = []; BAYS = []; GP = []; NODES = [{ s: 0, u: 0, kind: 'start', arc: 0 }]; nSpare = 0; pathK = 0; legBuilt = [false, false, false, false];
  for (let i = 0; i < SPARES; i++) GP.push({ i, s: -1e9, u: 0, line: -1, bait: false, h: -1, type: 0, state: 'spare', t0: 0, lostT: -1, side: 1, from: null, leg: -1 });
  layoutSeed = seed; terrainSeed(seed);
  for (let leg = 0; leg < 4; leg++) { LEGN[leg] = NODES.length - 1; legHazards(leg, rng(seed * 7919 + 101 + leg * 1013)); }
  LEGN[4] = NODES.length - 1;
  for (let leg = 0; leg < 4; leg++) { LEG_AHEAD[leg] = []; for (const h of HZ) if (h.leg === leg && !LEG_AHEAD[leg].includes(h.type)) LEG_AHEAD[leg].push(h.type); }
  terrainMask();
}
/* one leg of hazards: shape (danger spans), the safe line for the ute centre (free), and the clean path through them */
export function legHazards(leg, R) {
  const H = CONFIG.hz, gs = CONFIG.gateS, sA = leg ? gs[leg - 1] : 0, sB = leg < 3 ? gs[leg] : CONFIG.campS;
  if (leg) NODES.push({ s: sA + CONFIG.clearAfter - 2, u: NODES[NODES.length - 1].u, kind: 'hold', arc: 0 });
  const last = NODES[NODES.length - 1];
  const bayFor = {};
  let s = leg ? sA + CONFIG.hzAfter : H.first, uPrev = last.u, sPrev = last.s, cPrev = last.u, lastPat = '', n = 0, seqI = 0, paired = false, forced = null, bonusLeft = leg ? 1 : 0, sideDone = leg !== 2;
  const sLim = sB - (leg < 3 ? CONFIG.hzBefore : 26), react = leg === 3 ? H.react * 1.15 : H.react;
  for (let guard = 0; guard < 60; guard++) {
    /* the side track (gorge, once): a lane at the road edge with a big haul, closed off by a fallen branch soon after */
    if (!sideDone && n === 2) {
      sideDone = true; const su = 2.5 * (R() < 0.5 ? -1 : 1);
      const a0 = Math.max(s - 10, sPrev + 3 + H.pathSlope * Math.abs(su - uPrev)), a1 = a0 + (CONFIG.haul - 1) * 3;
      if (a1 + 45 < sLim) {
        NODES.push({ s: a0, u: su, kind: 'side', arc: 0 }, { s: a1, u: su, kind: 'side', arc: 0 });
        SIDE.push({ s0: a0 - 6, s1: a1 + 26, u: su, haul: [a0, a1] });
        uPrev = su; sPrev = a1; cPrev = su; s = a1 + 4; forced = { type: 'log', spans: su > 0 ? [[0.95, CONFIG.half]] : [[-CONFIG.half, -0.95]], pat: su > 0 ? 'right' : 'left' };
        continue;
      }
    }
    const idx = HZ.length;
    let type = forced ? forced.type : leg === 1 && s < CONFIG.act2S ? (n % 2 ? 'rocks' : 'pothole') : LEG[leg].seq[seqI % LEG[leg].seq.length];
    /* a strap-down bay before a full-width feature (not needed right after a gate: the gate banks) */
    const fullNext = type === 'crest';
    if (false && fullNext && !forced && s - sA > 60 && !bayFor[seqI]) {
      bayFor[seqI] = 1; const bu = 2.5 * (R() < 0.5 ? -1 : 1);
      const a0 = Math.max(s - 20, sPrev + 3 + H.pathSlope * Math.abs(bu - uPrev)), a1 = a0 + 12;
      if (a1 + 30 < sLim) { NODES.push({ s: a0, u: bu, kind: 'bay', arc: 0 }, { s: a1, u: bu, kind: 'bay', arc: 0 }); BAYS.push({ s0: a0, s1: a1, u0: bu > 0 ? 1.95 : -3.1, u1: bu > 0 ? 3.1 : -1.95, leg, used: false }); uPrev = bu; sPrev = a1; cPrev = bu; s = a1 + 6; continue; }
    }
    const off = t => CONFIG.features[t] === 0 || CONFIG.features[t] === false;
    if (off(type)) {
      if (forced) { forced = null; continue; }
      if (leg === 1 && s < CONFIG.act2S) { const alt = type === 'rocks' ? 'pothole' : 'rocks'; if (!off(alt)) type = alt; else { s = CONFIG.act2S + 1; continue; } }
      else { const L0 = LEG[leg].seq.length; let q = 0; while (q < L0 && off(LEG[leg].seq[seqI % L0])) { seqI++; q++; } if (q >= L0) break; type = LEG[leg].seq[seqI % L0]; }
    }
    const T = HZT[type], early = idx < 2;
    const len = type === 'corrug' ? 14 + R() * 6 : T.len;
    let spans = [], free = null, pat = '', uA = 0, uB = 0;
    const side = R() < 0.5 ? -1 : 1;
    if (forced) { spans = forced.spans; pat = forced.pat; }
    else if (type === 'rocks' || type === 'log') {
      let pats = early ? ['left', 'right'] : type === 'log' ? ['left', 'right'] : ['left', 'right', 'mid', 'sides'];
      pats = pats.filter(p => p !== lastPat || pats.length === 1); pat = pats[Math.floor(R() * pats.length)];
      if (pat === 'left' || pat === 'right') { const c = early ? -0.7 : -0.3 + R() * 0.8; spans = pat === 'left' ? [[-CONFIG.half, c]] : [[-c, CONFIG.half]]; }
      else if (pat === 'mid') { const w = 0.5 + R() * 0.3; spans = [[-w, w]]; }
      else { const g = 1.5 + R() * 0.2; spans = [[-CONFIG.half, -g], [g, CONFIG.half]]; }
    } else if (type === 'washout') { const c = -1.5 + R() * 0.6; spans = side < 0 ? [[-CONFIG.half, c]] : [[-c, CONFIG.half]]; pat = side < 0 ? 'left' : 'right'; }
    else if (type === 'gust') { const c = (R() * 2 - 1) * 1.5; spans = [[c - 0.9, c + 0.9]]; uA = c + side * 8; uB = c; pat = 'gust'; free = freeOf(spans, 0.55); }
    else if (type === 'pothole') { const w = 2.4 + R() * 0.8, pk = early ? (R() < 0.5 ? 'left' : 'right') : ['left', 'right', 'mid'][Math.floor(R() * 3)]; spans = pk === 'left' ? [[-CONFIG.half, -CONFIG.half + w + 1.4]] : pk === 'right' ? [[CONFIG.half - w - 1.4, CONFIG.half]] : [[-w / 2, w / 2]]; pat = pk; free = freeOf(spans, 0.5); }
    else if (type === 'crest' || (type === 'grid' && leg >= 2 && R() < CONFIG.fx.fullGridP)) { spans = [[-CONFIG.half, CONFIG.half]]; free = [[-CONFIG.uMax, CONFIG.uMax]]; pat = 'full'; }
    else if (type === 'corrug' || type === 'branch') { const c = type === 'corrug' ? -0.5 + R() * 1.0 : -0.6 + R() * 1.3; spans = side < 0 ? [[-CONFIG.half, c]] : [[-c, CONFIG.half]]; pat = side < 0 ? 'left' : 'right'; free = freeOf(spans, 0.55); }
    else { const a = 1.7; free = side > 0 ? [[a, 3.05]] : [[-3.05, -a]]; spans = side > 0 ? [[-CONFIG.half, a]] : [[-a, CONFIG.half]]; pat = side > 0 ? 'shallow-right' : 'shallow-left'; }
    if (!free) free = freeOf(spans);
    const uN = nearestFree(free, leg === 3 ? 0 : uPrev, 0.3), d = Math.abs(uN - uPrev), cN = centreOf(free), dc = Math.abs(cN - cPrev);
    const s0 = Math.max(s, sPrev + 4.15 + H.settle + H.pathSlope * d, sPrev + react + H.perLat * dc);
    if (s0 + len + 2.65 > sLim) break;
    let u = uN + (cN - uN) * R() * 0.4, bait = false, bg = -1;
    /* a bonus gate beyond a risk: in the free lane right at the hazard's edge (0.85-2.05 m from it) */
    if (bonusLeft > 0 && (type === 'rocks' || type === 'log') && !forced && spans.length === 1 && pat !== 'mid' && (n >= 1 || leg === 3)) {
      const e = pat === 'left' ? spans[0][1] : spans[0][0], dir = pat === 'left' ? 1 : -1, gc = e + dir * 1.45;
      if (Math.abs(gc - uPrev) <= (s0 - 2.65 - H.settle - sPrev - 1.5) / H.pathSlope && Math.abs(gc) < CONFIG.uMax) { u = gc; bg = BG.length; BG.push({ s: s0 + 0.2, u: gc, half: 0.6, kind: leg === 2 ? 'x2' : '+3', state: 'live', hz: idx, gotAt: -9 }); bonusLeft--; }
    }
    if (bg < 0 && pat !== 'full' && R() < 0.45) {
      const f = free.find(f => uN >= f[0] - 1e-6 && uN <= f[1] + 1e-6) || free[0], c = [];
      if (f[0] > -CONFIG.uMax + 0.01) c.push(f[0] + 0.25);
      if (f[1] < CONFIG.uMax - 0.01) c.push(f[1] - 0.25);
      c.sort((a, b) => Math.abs(a - uPrev) - Math.abs(b - uPrev));
      if (c.length && Math.abs(c[0] - uPrev) <= (s0 - 2.65 - H.settle - sPrev - 1.5) / H.pathSlope) { u = c[0]; bait = true; }
    }
    HZ.push({ i: idx, type, cat: T.cat, leg, s0, s1: s0 + len, spans, free, bait, bg, uA, uB, side, pat, full: pat === 'full', rough: T.cat === 'shake' && pat !== 'full' && R() < CONFIG.roughP });
    NODES.push({ s: s0 - 2.65 - H.settle, s0, u, kind: 'in', h: idx, bait, arc: 0 }, { s: s0 + len + 2.65, u, kind: 'out', h: idx, arc: 0 });
    uPrev = u; sPrev = s0 + len + 2.65; cPrev = cN; lastPat = pat; n++; if (forced) forced = null; else seqI++;
    const act2 = s0 > CONFIG.act2S && leg < 3;
    if (act2 && !paired && R() < 0.55) { paired = true; s = s0 + len + H.gapPair + R() * 3; }
    else { paired = false; s = s0 + len + (leg === 3 ? H.gap3 + R() * 5 : H.gap + R() * H.jitter); }
  }
  NODES.push(leg < 3 ? { s: sB, u: uPrev, kind: 'gate', g: leg, arc: 0 } : { s: sB, u: uPrev, kind: 'camp', arc: 0 });
  if (leg === 3) NODES.push({ s: sB + 60, u: uPrev, kind: 'end', arc: 0 });
}
/* one leg of gear (laid at reset for leg 0, at the gate choice for the others) */
export function legGear(leg, style) {
  if (legBuilt[leg]) return; legBuilt[leg] = true;
  const R = rng((layoutSeed * 7919 + 977 + leg * 131) ^ hashId(style));
  const lines = [];
  for (let j = LEGN[leg]; j < LEGN[leg + 1] && j + 1 < NODES.length; j++) {
    const A = NODES[j], B = NODES[j + 1];
    if (A.kind === 'in' || A.kind === 'gate' || B.kind === 'out' || B.kind === 'end' || B.kind === 'hold') continue;
    if (A.kind === 'bay' && B.kind === 'bay') continue;
    const haul = A.kind === 'side' && B.kind === 'side', span = B.s - A.s;
    if (!haul && style !== 'slide' && style !== 'ladder' && leg > 0 && Math.abs(B.u - A.u) < 0.8 && span > 16) {
      let amp = (R() < 0.5 ? -1 : 1) * Math.min(1.1, span / (Math.PI * CONFIG.hz.pathSlope)), mid = (A.u + B.u) / 2;
      if (Math.abs(mid + amp) > 2.7) amp = -amp;
      if (Math.abs(mid + amp) > 2.7) amp = 0;
      A.arc = amp;
    }
    const sStart = haul ? A.s : A.kind === 'start' ? 18 : A.kind === 'hold' || A.kind === 'bay' ? A.s + 2 : A.s + 0.8, sEnd = haul ? B.s : B.kind === 'gate' ? B.s - 4 : B.kind === 'camp' ? B.s - 8 : B.kind === 'side' || B.kind === 'bay' ? B.s - 2 : B.s0 - 2;
    if (sEnd >= sStart) lines.push({ A, B, sStart, sEnd, haul });
  }
  const sp = CONFIG.gearSpace, wide = leg === 0, out = [];
  for (const ln of lines) {
    const pcs = [], step = ln.haul ? 3 : sp;
    for (let ps = ln.sEnd; ps >= ln.sStart - 1e-6; ps -= step) pcs.unshift({ s: ps, kind: 'small', off: 0 });
    if (!ln.haul) while (pcs.length > CONFIG.lineMax) pcs.shift();
    ln.pcs = pcs;
  }
  /* budget: trim the longest normal lines from their start until the leg holds its share (wide lines count 2 a slot) */
  const budget = CONFIG.budget[leg] + (style === 'slide' ? CONFIG.bonusSlide : style === 'bars' ? CONFIG.bonusBars : 0), per = wide ? 2 : 1;
  const count = () => lines.reduce((a, l) => a + (l.haul ? 0 : l.pcs.length * per), 0);
  for (let guard = 0; guard < 200 && count() > budget; guard++) { let lg = null; for (const l of lines) if (!l.haul && (!lg || l.pcs.length > lg.pcs.length)) lg = l; if (!lg || !lg.pcs.length) break; lg.pcs.shift(); }
  let bigK = 0, longK = 0, zig = 0, lineId = 1000 * leg;
  for (const ln of lines) {
    const t0 = Math.floor(R() * 4), pcs = ln.pcs;
    if (RACK_ITEMS[style] && pcs.length >= 2 && bigK < CONFIG.bigMax) { pcs[pcs.length - 1].kind = 'big'; bigK++; }
    if (false && style === 'ladder' && !ln.haul && ln.sEnd - ln.sStart >= 7.4 && longK < CONFIG.longMax) { longK += 3; pcs.length = 0; for (let q = 0; q < 3; q++) pcs.unshift({ s: ln.sEnd - q * 3.7, kind: 'long', off: 0 }); }
    pcs.forEach((p, q) => {
      const type = p.kind === 'big' ? RACK_ITEMS[style][(bigK + q) % 2] : p.kind === 'long' ? 7 + (q % 3) : (R() < 0.6 ? t0 : Math.floor(R() * 4));
      const bait = !!ln.B.bait && q === pcs.length - 1 && p.kind === 'small';
      if (wide && !ln.haul) { out.push({ s: p.s, line: lineId, bait: false, h: -1, type, off: -0.45 }); out.push({ s: p.s, line: lineId, bait: false, h: -1, type: (type + 1) % 4, off: 0.45 }); }
      else out.push({ s: p.s, line: lineId, bait, h: ln.B.kind === 'in' ? ln.B.h : -1, type, off: 0 });
    });
    lineId++;
  }
  /* temptation: a short line laid over the rough part of a partial feature (the clean path skips it; the gear costs loose gear) */
  for (const h of HZ) {
    if (h.leg !== leg || !h.rough) continue;
    const [a0, b0] = h.spans[0], uc = clamp((Math.max(-CONFIG.half, a0) + Math.min(CONFIG.half, b0)) / 2, -2.8, 2.8);
    const ss = (h.type === 'corrug' ? [h.s0 + 2, h.s0 + 5, h.s0 + 8] : [h.s0 - 6, h.s0 - 3, h.s0 - 0.2]).slice(3 - CONFIG.roughN);
    ss.forEach((s0, q) => out.push({ s: s0, line: lineId, bait: true, h: h.i, type: q === 1 ? 10 : Math.floor(R() * 4), off: 0, abs: uc }));
    lineId++;
  }
  out.sort((a, b) => a.s - b.s);
  /* MT Slide: heavy gear (worth 2 or 3) replaces some of the small gear in every leg after it is fitted */
  if (S && S.sel && S.sel[0] === 'slide') for (const p of out) if (p.type < 4 && R() < CONFIG.heavyP) p.type = R() < 0.6 ? 10 : 11;
  for (const p of out) { const u = p.abs != null ? p.abs : pathU(p.s) + p.off; GP.push({ i: GP.length, s: p.s, u: +clamp(u, -3.5, 3.5).toFixed(2), line: p.line, bait: p.bait, h: p.h, type: p.type, state: 'road', t0: 0, lostT: -1, side: 1, from: null, leg }); }
  pathK = 0;
}

/* ---------- the vehicle (variant A arcade model, owner retune 16:40: weighty, restrained body motion) ----------
   POSE holds what the renderer needs after each fixed step; PREV is the step before, and draw() blends them. */
export const NP = 16;
export const POSE = new Float64Array(NP), PREV = new Float64Array(NP);
export const PX = 0, PZ = 1, PYAW = 2, PBY = 3, PPITCH = 4, PROLL = 5, PSTEER = 6, PSPIN = 7, PW0 = 8, PBASE = 12, PS = 13, PU = 14, PGP = 15;
export const VQ = { x: 0, z: 0, th: 0 }, VT = { s: 0, u: 0, th: 0 }, HW = new Float64Array(4);
export function vehReset() {
  trailAt(0, 0, VQ);
  S.veh = { x: VQ.x, z: VQ.z, psi: VQ.th, phi: VQ.th, r: 0, delta: 0, aLat: 0, aLong: 0, aLatF: 0, aLongF: 0, spin: 0, by: 0, byv: 0, pitch: 0, pitchV: 0, roll: 0, rollV: 0, pB: 0, pBV: 0, rB: 0, rBV: 0, gPitch: 0, gRoll: 0, base: 0, slip: 0, settle: true };
  vehPose(1 / 60); PREV.set(POSE);
}
/* The steering law (shared with drive A): while steering, POSITION HOLD by pure pursuit onto the chosen line, aim held within maxRel of the
   trail heading (0.23 rad, about 13 deg, the owner's yaw cap). On release: self-centre (drive.center) and trail-follow assist (drive.assist). */
export const VQ2 = { x: 0, z: 0, th: 0 };
export function aimCmd(x, z, phi, v, target, Ld, bend) {
  const D = CONFIG.drive;
  trailAt(S.s + Ld, target, VQ); let ax = VQ.x, az = VQ.z, thT = VQ.th;
  if (bend < 1) {
    trailAt(S.s, target, VQ2); const tx = VQ2.x + Math.sin(VQ2.th) * Ld, tz = VQ2.z + Math.cos(VQ2.th) * Ld;
    ax = tx + (ax - tx) * bend; az = tz + (az - tz) * bend; thT = VQ2.th + wrapA(thT - VQ2.th) * bend;
  }
  const dx = ax - x, dz = az - z, aim = thT + clamp(wrapA(Math.atan2(dx, dz) - thT), -D.maxRel, D.maxRel);
  const alpha = wrapA(phi - aim), dmax = Math.min(D.steerCap, D.steerMax / (1 + v / D.steerV));
  return clamp(Math.atan(2 * D.wb * Math.sin(alpha) / Math.max(1, Math.hypot(dx, dz))), -dmax, dmax);
}
export function steerLaw(x, z, phi, v, dt) {
  const D = CONFIG.drive, C = S.ctl, a = clamp(D.assist, 0, 1), bend = Math.min(1, a / 0.5), pull = Math.max(0, (a - 0.5) / 0.5);
  if (C.active) return aimCmd(x, z, phi, v, S.target, clamp(D.look0 + D.lookK * v, D.lookMin, D.lookMax), bend);
  C.tRel += dt;
  const kc = 2 * Math.pow(30, clamp(D.center, 0, 1)) - 2, w = Math.exp(-kc * C.tRel);
  C.uHold *= 1 - 0.6 * pull * dt;
  const follow = bend > 0 ? bend * aimCmd(x, z, phi, v, C.uHold, D.lookRel, 1) : 0;
  return w * C.rem + (1 - w) * follow;
}
export function steerSmooth(cur, cmd, dt) {
  const D = CONFIG.drive, out = Math.abs(cmd) > Math.abs(cur) && cmd * cur >= 0, rate = (out ? D.steerIn : D.steerOut) * dt;
  return cur + clamp(cmd - cur, -rate, rate);
}
/* weight: yaw rate lags the wheel (yawK) and the travel direction lags the body (gripK), each time constant scaled by ?weight */
export function vehStep(dt) {
  const D = CONFIG.drive, V = S.veh, v = S.v, W = D.weight;
  V.delta = steerSmooth(V.delta, steerLaw(V.x, V.z, V.phi, v, dt), dt);
  const rT = v * Math.tan(V.delta) / D.wb;
  V.r += (rT - V.r) * (W > 0 ? 1 - Math.exp(-D.yawK / W * dt) : 1);
  V.psi -= V.r * dt;
  const phi0 = V.phi;
  V.phi += wrapA(V.psi - V.phi) * (W > 0 ? 1 - Math.exp(-D.gripK / W * dt) : 1);
  V.aLat = -wrapA(V.phi - phi0) / dt * v;
  V.x += Math.sin(V.phi) * v * dt; V.z += Math.cos(V.phi) * v * dt;
  V.spin += v / WHR * dt;
  const u0 = S.u;
  toTrail(V.x, V.z, S.s, VT);
  S.s = VT.s; S.u = VT.u; S.uv = (S.u - u0) / dt;
  if (Math.abs(S.u) > 4.4) { const push = (Math.abs(S.u) - 4.4) * Math.sign(S.u); trailAt(S.s, S.u - push, VQ); V.x = VQ.x; V.z = VQ.z; S.u -= push; V.phi += wrapA(VQ.th - V.phi) * 0.2; }
  vehPose(dt);
}
/* 4-point suspension: each wheel samples the ground; heave, pitch and roll spring toward the plane they make. Body roll and pitch from
   load transfer follow low-passed accelerations and are soft-capped (tanh), so a quick change leans the body a few degrees, never more. */
export function vehPose(dt) {
  const V = S.veh, U = CONFIG.susp, D = CONFIG.drive, c = Math.cos(V.psi), sn = Math.sin(V.psi);
  for (let k = 0; k < 4; k++) HW[k] = groundAtWorld(V.x + WHX[k] * c + WHZ[k] * sn, V.z - WHX[k] * sn + WHZ[k] * c, S.s);
  const base = (HW[0] + HW[1] + HW[2] + HW[3]) / 4;
  V.gPitch = Math.atan(((HW[0] + HW[1]) - (HW[2] + HW[3])) / 2 / D.wb);
  V.gRoll = Math.atan(((HW[0] + HW[2]) - (HW[1] + HW[3])) / 2 / D.track);
  const fa = 1 - Math.exp(-U.accF * dt);
  V.aLatF += (V.aLat - V.aLatF) * fa; V.aLongF += (V.aLong - V.aLongF) * fa;
  const rs = Math.max(0, U.roll), rc = U.rollCap * rs;
  const bodyRoll = rc > 0 ? -rc * Math.tanh(U.rollK * rs * V.aLatF / rc) : 0, bodyPitch = U.pitchCap * Math.tanh(U.pitchK * V.aLongF / U.pitchCap);
  if (V.settle) { V.by = base; V.byv = 0; V.pitch = V.gPitch; V.roll = V.gRoll; V.pB = V.rB = V.pBV = V.rBV = 0; V.settle = false; }
  V.byv += (U.heaveW * U.heaveW * (base - V.by) - 2 * U.heaveZ * U.heaveW * V.byv) * dt; V.by += V.byv * dt;
  if (V.by - base > U.travel) { V.by = base + U.travel; V.byv = Math.min(V.byv, 0); } else if (base - V.by > U.travel) { V.by = base - U.travel; V.byv = Math.max(V.byv, 0); }
  /* two springs each way: the body following the ground under the wheels (V.pitch / V.roll hold the ground part here) and the load-transfer lean (pB / rB) */
  V.pitchV += (U.pitchW * U.pitchW * (V.gPitch - V.pitch) - 2 * U.pitchZ * U.pitchW * V.pitchV) * dt; V.pitch += V.pitchV * dt;
  V.rollV += (U.rollW * U.rollW * (V.gRoll - V.roll) - 2 * U.rollZ * U.rollW * V.rollV) * dt; V.roll += V.rollV * dt;
  V.pBV += (U.pitchW * U.pitchW * (bodyPitch - V.pB) - 2 * U.pitchZ * U.pitchW * V.pBV) * dt; V.pB += V.pBV * dt;
  V.rBV += (U.rollW * U.rollW * (bodyRoll - V.rB) - 2 * U.rollZ * U.rollW * V.rBV) * dt; V.rB += V.rBV * dt;
  V.slip += (clamp(-V.r * D.slipVis, -D.slipMax, D.slipMax) - V.slip) * (1 - Math.exp(-D.slipK * dt));
  V.base = base;
  POSE[PX] = V.x; POSE[PZ] = V.z; POSE[PYAW] = V.psi + V.slip; POSE[PBY] = V.by; POSE[PPITCH] = V.pitch + V.pB; POSE[PROLL] = V.roll + V.rB; POSE[PSTEER] = V.delta; POSE[PSPIN] = V.spin;
  for (let k = 0; k < 4; k++) POSE[PW0 + k] = HW[k];
  POSE[PBASE] = base; POSE[PS] = S.s; POSE[PU] = S.u; POSE[PGP] = V.gRoll;
}
export function vehHit() { const V = S.veh; V.byv += CONFIG.susp.kickV; V.pBV += CONFIG.susp.kickPitch; }

/* ---------- state ----------
   Three rules: stack gear; bumps shake off whatever is not secured; RealTruck gear secures more.
   Nothing secures gear except the products (owner ruling). The pile (S.pile) stacks twelve to a layer; nothing is locked at the start, and
   each SECURE product locks in 12 from the bottom up (Bed Divider, EVOm, Cross Bars: at most 36, below the target); the rest is loose to camp.
   At most looseCap loose layers ride above the line (FULL bounce-offs beyond) so the pile never hides the road. A tub or ladder rack carries
   its big or long loads on a secured deck (S.deck). Gates are the choice and the retry checkpoint only.
   At camp the ute stops on the pad and the stack is shown and tallied piece by piece: everything on the ute against CONFIG.target unlocks the code. */
export let S, BR, resetId = 0, SNAP = null;
export const P = { active: false, x0: 0, y0: 0, t0: 0, target: 0, ease: false };
export const CORE = { speed: Q.get('core') === 'speed' };
export const LAYOUT = { seed: null };
export function reset(seed) {
  buildBase(LAYOUT.seed != null ? LAYOUT.seed : seed);
  BR = rng((seed ^ 0x5bd1) + 77);
  S = {
    seed, t: 0, rt: 0, s: 0, u: 0, uv: 0, target: 0, v: CONFIG.startV, cruise: CONFIG.cruise, kick: 0, hits: 0, done: null, reason: '', measure: '', failAt: null, endT: 0, reveal: false, stars: 0,
    pile: [], packed: [], packFrom: 0, charges: 0, sealAt: -1, onRough: false, roughT: 0, edgeN: 0, teeter: 0, deck: [], deckBanked: 0, banked: 0, holdT: 0, bankedAt: [], onN: 0, secN: 6, looseN: 0, total: 0, reach: CONFIG.gearR, bars: false, elec: false, shutUntil: -9, shutReady: 0, shutN: 0, shutReq: false, ease: false, easeKey: false, easeT: 0, stability: 1, unstable: false, swerveLevel: 0, sw: { dir: 0, pk: 0, pkT: -9, old: 0, revT: -9, fired: true, warnUntil: -9, coolUntil: -9, warnN: 0, lostN: 0 },
    sel: [null, null, null], fitAt: [-1, -1, -1], stage: [0, 0, 0], hold: null, holdU: 0, holdEnd: -9, gateDone: [false, false, false], cp: -1, retries: 0, bayUsed: BAYS.map(() => 0),
    scale: 1, got: 0, lost: 0, lostBy: {}, held: 0, clean: 0, mult: 1, bestMult: 1, run: 0, points: 0, close: 0, dbl: 0, longRun: 0, bonusN: 0, full: 0, act: 1, onCorr: false, banks: 0,
    hzHit: HZ.map(() => 0), hzMin: HZ.map(() => 9), hzDone: HZ.map(() => 0), corrT: 0, hzI: 0, hzPassed: 0, gI: SPARES, bgI: 0,
    campS: CONFIG.campS, stopS: 0, bankAt: -1, strapAt: -9, swerve: 0, rollMax: 0, pitchMax: 0, cueUntil: -1, cues: {}, milestone: 0, almost: false, lossAt: -9, lossW: 0, heldAt: -9, fullAt: -9, warnAt: -9, warnH: -1,
    imp: { n: 0, x: 0, z: 0 }, hitSide: 1, veh: null, ctl: { active: true, rem: 0, tRel: 0, uHold: 0 },
    bot: { objKey: '', seenAt: -1, commitAt: 0, err: 0, goal: 0, next: 0, fumbleT: 0, fumbleGoal: 0, delay: 0.5, greed: HZ.map(() => 0), asked: HZ.map(() => 0), bay: BAYS.map(() => 0), easeFor: -1 }
  };
  const b = S.bot; b.fumbleT = 0.8 + BR() * 0.8; b.fumbleGoal = (BR() < 0.5 ? -1 : 1) * (1.5 + BR() * 1.5);
  for (let i = 0; i < HZ.length; i++) b.greed[i] = BR() < 0.5 ? 1 : 0;
  for (let i = 0; i < BAYS.length; i++) b.bay[i] = BR() < 0.6 ? 1 : 0;
  GATES[2].opts[1] = RACK_Q || RACKS[((seed >>> 0) * 2654435761 >>> 7) % 3];
  legGear(0, 'start');
  SNAP = null; P.active = false; P.target = 0; P.ease = false;
  vehReset(); recount();
  resetId++;
}
/* checkpoints: a snapshot at each gate (after banking, before the choice); a retry restores it and offers the choice again */
export function snapshot(k) { SNAP = { k, S: JSON.stringify(S), GP: JSON.stringify(GP), BG: JSON.stringify(BG), legBuilt: legBuilt.slice(), nSpare, pose: Float64Array.from(POSE), arcs: NODES.map(n => n.arc || 0) }; }
export function retry() {
  if (!SNAP) return;
  const R0 = SNAP, retries = S.retries + 1;
  S = JSON.parse(R0.S); GP = JSON.parse(R0.GP); BG = JSON.parse(R0.BG); legBuilt = R0.legBuilt.slice(); nSpare = R0.nSpare; NODES.forEach((n, i) => { n.arc = R0.arcs[i]; });
  S.retries = retries; S.done = null; S.hold = null; S.reveal = false;
  /* a fair retry: the sunset clock leaves at least what a clean run needs from this gate, plus 8 s */
  const need = (S.campS - S.s) / (R0.k === 2 ? CONFIG.cruise3 : CONFIG.cruise) + 8; S.t = Math.min(S.t, CONFIG.dark - need);
  POSE.set(R0.pose); PREV.set(POSE); BR = rng(S.seed * 31 + retries * 977); P.active = false; P.ease = false; pathK = 0;
  startHold(R0.k, true);
  resetId++;
}

/* touch and mouse: relative drag (where the finger goes down is "where the ute is now"); during a choice hold the drag re-anchors.
   With ?core=speed, pulling the thumb back (down the screen) by 40 px eases off; Down key too. */
export function pointer(kind, x, y) {
  if (!S || S.done) return;
  if (kind === 'down') { P.active = true; P.x0 = x; P.y0 = y || 0; P.t0 = S.target; P.target = S.target; P.ease = false; return; }
  if (kind === 'up') { P.active = false; P.ease = false; return; }
  if (!P.active) return;
  if (CORE.speed && y != null) { const dy = y - P.y0; if (!P.ease && dy > 40) P.ease = true; else if (P.ease && dy < 22) P.ease = false; }
  if (S.hold) { P.x0 = x; P.t0 = S.target; P.target = S.target; return; }
  const D = CONFIG.drive, span = Math.min(FX.width(), D.dragMaxPx) * D.dragFrac / D.sens, k = 2 * CONFIG.uMax / span;
  let t = P.t0 + (x - P.x0) * k;
  if (t > CONFIG.uMax) { t = CONFIG.uMax; P.t0 = t; P.x0 = x; } else if (t < -CONFIG.uMax) { t = -CONFIG.uMax; P.t0 = t; P.x0 = x; }
  P.target = t;
}
export const clampU = u => u > CONFIG.uMax ? CONFIG.uMax : u < -CONFIG.uMax ? -CONFIG.uMax : u;
export const pileImp = (x, z) => { S.imp.n++; S.imp.x = x; S.imp.z = z; };
export const isShut = () => S.t < S.shutUntil;

/* the direct lateral model: S.u follows S.target through a critically damped spring; the ute sits on the trail at (S.s, S.u) */
export function vehStepDirect(dt) {
  const D = CONFIG.drive, V = S.veh, w = D.latW;
  if (V.uvL == null) { V.uvL = 0; V.yawOff = 0; }
  const ua = w * w * (S.target - S.u) - 2 * w * V.uvL; V.uvL += ua * dt; S.u += V.uvL * dt;
  if (S.u > CONFIG.uMax) { S.u = CONFIG.uMax; V.uvL = Math.min(0, V.uvL); } else if (S.u < -CONFIG.uMax) { S.u = -CONFIG.uMax; V.uvL = Math.max(0, V.uvL); }
  S.uv = V.uvL; S.s += S.v * dt;
  trailAt(S.s, S.u, VQ); V.x = VQ.x; V.z = VQ.z; VT.s = S.s; VT.u = S.u; VT.th = VQ.th;
  const yawT = -clamp(Math.atan2(V.uvL, Math.max(4, S.v)), -D.yawCap, D.yawCap), y0 = V.yawOff;
  V.yawOff += (yawT - V.yawOff) * (1 - Math.exp(-14 * dt));
  const psi0 = V.psi; V.psi = VQ.th + V.yawOff; V.phi = V.psi; V.r = -wrapA(V.psi - psi0) / dt;
  V.delta += (clamp(-V.yawOff * 2.4 - (V.yawOff - y0) / dt * 0.08, -0.5, 0.5) - V.delta) * (1 - Math.exp(-20 * dt));
  V.aLat = ua; V.spin += S.v / WHR * dt;
  vehPose(dt);
}
export const stepVeh = dt => CONFIG.drive.mode === 'pursuit' ? vehStep(dt) : vehStepDirect(dt);

/* ---------- the load ---------- */
/* what a piece counts: its type's worth (heavy gear 2 or 3, big items 3, long loads 2) */
export const worth = (i, k) => GT[GP[i].type].w;
/* the tub packs two layers below the rails (18); cross bars carry two more packed layers above them, a rack one; the rest stays loose */
export const packCap = () => 2 * CONFIG.pile.packPerLayer + (S.bars ? 2 * CONFIG.pile.packPerLayer : S.sel[2] === 'rack' || S.sel[2] === 'ladder' ? CONFIG.pile.packPerLayer : 0);
export const packLayers = () => Math.ceil(S.packed.length / CONFIG.pile.packPerLayer);
/* locked layers of 12: one per SECURE product fitted (Bed Divider, EVOm, Cross Bars); nothing is locked at the start */
export const secL = () => (S.sel[0] === 'divider' ? 1 : 0) + (S.sel[1] === 'rollM' ? 1 : 0) + (S.bars ? 1 : 0);
export const capL = () => S.bars ? CONFIG.pile.layersBars : CONFIG.pile.layers;
export function recount() {
  /* solid = gear at or below the secure line plus the rack deck (cannot be lost); loose = the rest of the pile (counts now, can still go) */
  S.secN = CONFIG.pile.perLayer * secL(); let safe = 0, loose = 0; for (let k = 0; k < S.pile.length; k++) { if (k < S.secN || isShut()) safe += worth(S.pile[k], k); else loose += worth(S.pile[k], k); } for (const i of S.deck) safe += worth(i, -1);
  S.banked = safe; S.onN = loose; S.looseN = isShut() ? 0 : Math.max(0, S.pile.length - S.secN); S.total = S.banked + S.onN;
}
export const deckCap = () => RACK_ITEMS[S.sel[2]] ? CONFIG.fx.deckCap : 0;
/* no stacking cap (owner): small cargo always fits; stability limits greed instead. A rack deck holds deckCap big pieces */
export function roomFor(kind) { if (kind === 'small') return true; return S.deck.length < deckCap(); }
/* stability 1 (solid) .. 0 (about to topple) from the loose boxes above the protected line (CONFIG.stab) */
export function stability() { const B = CONFIG.stab, hold = B.hold + (S.bars ? B.bars : 0) + (S.deck.length ? B.deck : 0); return clamp(1 - (looseNow() / B.box - hold) / B.span, 0, 1); }
export const stabK = () => 1 + CONFIG.stab.featK * (1 - stability());
/* eased off (speed core): features take half, rounded down */
export const eased = () => S.v <= S.cruise * 0.66;
/* drive smoothly: track the lateral speed's peak in each direction; a reversal pairs the old peak (if it was within window s) with the
   new direction's peak. The swerve is judged once the new peak has passed: STEADY warning, or a throw off the outside (see CONFIG.swerve) */
export function swerveStep(dt) {
  const C = CONFIG.swerve, W = S.sw, v = S.uv, d = v > 0.3 ? 1 : v < -0.3 ? -1 : 0, f = CONFIG.stab.swMin + (1 - CONFIG.stab.swMin) * stability();
  if (d && d === W.dir) { if (Math.abs(v) > W.pk) { W.pk = Math.abs(v); W.pkT = S.t; } else if (!W.fired && (Math.abs(v) < W.pk - 0.05 || S.t - W.revT > C.window)) swerveJudge(); }
  else if (d) { if (!W.fired) swerveJudge(); W.old = S.t - W.pkT <= C.window ? W.pk : 0; W.revT = S.t; W.dir = d; W.pk = Math.abs(v); W.pkT = S.t; W.fired = !W.old; }
  const k = (S.bars || S.deck.length ? C.barsK : 1) * f, I = W.fired ? 0 : Math.min(W.old, W.pk);
  S.swerveLevel = Math.max(S.swerveLevel * Math.exp(-3 * dt), clamp(I / (C.violent * k), 0, 1), S.t < W.warnUntil ? C.warn / C.violent : 0);
}
export function swerveJudge() {
  const C = CONFIG.swerve, W = S.sw, st = stability(), k = (S.bars || S.deck.length ? C.barsK : 1) * (CONFIG.stab.swMin + (1 - CONFIG.stab.swMin) * st), I = Math.min(W.old, W.pk);
  W.fired = true;
  if (!C.on || S.hold || S.t < 6 || S.rt - S.holdEnd < 1.5 || S.t < W.coolUntil || looseNow() <= 0 || I < C.warn * k) return;
  if (st <= CONFIG.stab.crit && S.t < W.warnUntil) { W.warnUntil = -9; W.coolUntil = S.t + C.cooldown; const w = takeLoose(CONFIG.stab.box, 'swerve'); W.lostN += w; if (w) { FX.event('swerve_lost', { n: w, intensity: 1, side: -W.dir, s: +S.s.toFixed(1), u: +S.u.toFixed(2) }); lossCall('TOO TALL!', w); } return; }
  if (I < C.violent * k && S.t >= W.warnUntil) { W.warnUntil = S.t + C.again; W.warnN++; FX.event('swerve_warn', { intensity: +(I / (C.violent * k)).toFixed(2), side: -W.dir, until: C.again, loose: looseNow() }); FX.callUte('STEADY!', '#ffffff'); return; }
  const n = Math.min(3, (I >= C.violent * k ? 3 : I >= C.lose * k ? 2 : 1) + (looseNow() > C.tall * CONFIG.pile.perLayer ? 1 : 0));
  W.warnUntil = -9; W.coolUntil = S.t + C.cooldown;
  const w = takeLoose(n, 'swerve'); W.lostN += w;
  if (w) { FX.event('swerve_lost', { n: w, intensity: +(I / (C.violent * k)).toFixed(2), side: -W.dir, s: +S.s.toFixed(1), u: +S.u.toFixed(2) }); lossCall('SWERVE', w); }
}
export function takeLoose(n, cause, h) {
  if (isShut()) return 0;
  if (eased()) n = Math.floor(n / 2);
  let w = 0;
  for (let q = 0; q < n && S.pile.length > S.secN; q++) { const wv = worth(S.pile[S.pile.length - 1], S.pile.length - 1), i = S.pile.pop(), g = GP[i]; g.state = 'lost'; g.lostT = S.rt; g.side = R2(i * 7 + S.lost) < 0.5 ? -1 : 1; S.lost += wv; w += wv; }
  S.lostBy[cause] = (S.lostBy[cause] || 0) + w; recount(); if (w) FX.event('loose_lost', { n: w, cause, kind: cause === 'swerve' ? 'swerve' : cause === 'edge' ? 'ambient' : h && h.cat === 'impact' ? 'hazard' : 'feature', type: h ? h.type : cause, id: h ? h.i : -1, s: +S.s.toFixed(1), u: +S.u.toFixed(2), onBoard: S.onN }); return w;
}
export const looseNow = () => isShut() ? 0 : Math.max(0, S.pile.length - S.secN);
export const topLooseLayer = () => { const P = CONFIG.pile.perLayer, L0 = S.pile.length; if (L0 <= S.secN) return 0; const start = Math.floor((L0 - 1) / P) * P; return L0 - Math.max(start, S.secN); };
/* a gate is the choice and the checkpoint only: it secures nothing; it refills the EVOe's charges for the next leg */
export function bank(where) { if (S.elec) S.charges = CONFIG.evoeCharges; }

export function update(dt, inp) {
  PREV.set(POSE);
  if (S.done) {
    S.endT += dt; S.rt += dt; const v0 = S.v;
    if (S.reveal) { const d = S.stopS - S.s; S.v = d > 0.3 ? Math.max(0, S.v - S.v * S.v / (2 * d) * dt) : Math.max(0, S.v - 9 * dt); S.ctl.active = true; S.target += (-1.6 - S.target) * Math.min(1, dt * 1.5); }
    else S.v = Math.max(0, S.v - 9 * dt);
    S.veh.aLong = (S.v - v0) / dt; S.kick = Math.max(0, S.kick - dt * 2.2);
    stepVeh(dt); stages(); return;
  }
  S.rt += dt;
  if (S.hold) holdStep(dt, inp); else S.scale = 1;
  const gdt = dt * S.scale;
  S.t += gdt;
  const frozen = S.hold && !(S.hold.phase === 'go' && S.hold.tg >= CONFIG.hold.goT);
  if (frozen) { S.target = S.holdU; S.ctl.active = true; S.ease = false; }
  else {
    const active = inp.steerTo != null || P.active || !!inp.steer;
    if (inp.steerTo != null) S.target = clampU(inp.steerTo);
    else if (active) {
      if (P.active) S.target = P.target;
      if (inp.steer) {
        const D = CONFIG.drive;
        S.target = clamp(clampU(S.target + inp.steer * CONFIG.keyRate * dt), S.u - D.keyLead, S.u + D.keyLead);
        if (P.active) { P.t0 = S.target; P.target = S.target; }
      }
    } else S.target = clampU(S.u);
    if (active !== S.ctl.active) { S.ctl.active = active; if (!active) { S.ctl.rem = S.veh.delta; S.ctl.tRel = 0; S.ctl.uHold = clampU(S.u + S.uv * 0.1); } }
    S.shutReq = false;
    S.ease = CORE.speed && (inp.ease != null ? !!inp.ease : (P.active && P.ease) || S.easeKey);
  }
  const v0 = S.v, goalV = S.ease ? S.cruise * 0.55 : S.cruise;
  if (S.v < goalV) S.v = Math.min(goalV, S.v + CONFIG.accel * gdt); else if (S.v > goalV) S.v = Math.max(goalV, S.v - 7 * gdt);
  if (S.ease) S.easeT += gdt;
  if (gdt <= 0) { if (S.hold) holdBeats(); return; }
  S.veh.aLong = (S.v - v0) / Math.max(1e-4, gdt);
  stepVeh(gdt);
  S.kick = Math.max(0, S.kick - gdt * 2.2);
  if (S.t > 2 && !S.hold) {
    S.swerve = Math.max(S.swerve, Math.abs(wrapA(S.veh.psi + S.veh.slip - VT.th)));
    S.rollMax = Math.max(S.rollMax, Math.abs(S.veh.rB)); S.pitchMax = Math.max(S.pitchMax, Math.abs(S.veh.pB));
  }
  if (S.shutUntil > 0 && S.t >= S.shutUntil && S.t - gdt < S.shutUntil) recount();

  /* road features and swerve hazards */
  S.onCorr = false;
  for (let i = S.hzI; i < HZ.length; i++) {
    const h = HZ[i];
    if (h.s0 > S.s + 2.65) break;
    if (h.s1 + 2.65 < S.s) { if (i === S.hzI) { S.hzI++; S.hzPassed++; if (h.cat === 'impact' && !S.hzHit[i] && S.hzMin[i] < CONFIG.near) closeOne(h); } continue; }
    const safe = !h.full && inFree(h.free, S.u);
    if (h.cat === 'impact') {
      if (!S.hzHit[i]) { if (!safe) { S.hzHit[i] = 1; impact(h); } else { let dm = 9; for (const [a, b] of h.spans) dm = Math.min(dm, S.u < a ? a - S.u : S.u > b ? S.u - b : 0); S.hzMin[i] = Math.min(S.hzMin[i], dm - CONFIG.hitHalf); } }
    } else if (h.type === 'corrug') {
      if (S.s >= h.s0 && S.s <= h.s1 && !safe) {
        if (!S.hzHit[i]) FX.event('feature_enter', { type: 'corrug', safe: false, loose: S.looseN }); S.onCorr = true; S.hzHit[i] = 1; S.corrT += gdt;
        const every = CONFIG.fx.corrugEvery * (eased() ? 2 : 1);
        if (S.corrT >= every) { S.corrT -= every; pileImp((BR() - 0.5) * 1.2, 0.8); const w = takeLoose(Math.round(stabK()), 'ripple', h); if (w) lossCall('SHAKEN LOOSE', w); else if (S.pile.length) heldCall(); }
      }
    } else if (!S.hzDone[i]) {
      const trig = h.type === 'creek' ? (h.s0 + h.s1) / 2 : h.s0;
      if (S.s >= trig) { S.hzDone[i] = 1; S.hzHit[i] = safe ? 0 : 1; passFx(h, safe); }
    }
    if (S.done) return;
  }
  if (!S.onCorr) S.corrT = Math.min(S.corrT, 0.6);
  /* ambient: off the wheel tracks, a loose pile more than one full layer above the safe zone teeters for teeterT, then loses one edge piece
     every edgeEvery[ambient] s while the ute stays on rough ground; never in the first 6 s or within 1.5 s after a gate. Deterministic. */
  S.onRough = !S.hold && !CONFIG.tracks.some(c => Math.abs(S.u - c) <= CONFIG.trackHalf);
  const tall = S.pile.length - S.secN > CONFIG.pile.perLayer && !isShut(), quiet = S.t < 6 || S.rt - S.holdEnd < 1.5 || CONFIG.ambient <= 0;
  if (S.onRough && tall && !quiet) {
    if (S.roughT === 0) FX.event('teeter', { pieces: S.pile.slice(-4) });
    S.roughT += gdt; S.teeter = S.roughT < CONFIG.teeterT ? 1 : 2;
    const every = CONFIG.edgeEvery[Math.round(CONFIG.ambient)] || 1.8;
    if (S.roughT >= CONFIG.teeterT + every * (S.edgeN + 1) - every) { S.edgeN++; const w = takeLoose(1, 'edge'); if (w) { FX.event('edge_lost', { n: w }); lossCall('EDGE', w); } }
  } else { S.roughT = 0; S.edgeN = 0; S.teeter = 0; }
  swerveStep(gdt);
  S.stability = stability(); { const dz = S.stability < CONFIG.stab.danger; if (dz && !S.unstable) FX.event('unstable', { stability: +S.stability.toFixed(2), loose: looseNow() }); S.unstable = dz; }
  /* EVOe: the cover closes itself just before a big hit (crest, cattle grid, creek dip) when loose gear would go and a charge is left */
  if (S.elec && S.charges > 0 && !isShut() && S.looseN > 0 && !S.hold) for (let i = S.hzI; i < HZ.length && i < S.hzI + 2; i++) {
    const h = HZ[i]; if (S.hzDone[i] || !(h.type === 'crest' || h.type === 'grid' || h.type === 'creek')) continue;
    const trig = h.type === 'creek' ? (h.s0 + h.s1) / 2 : h.s0, d = trig - S.s;
    if (d > 0 && d < S.v * 0.2 + 0.6 && (h.full || !inFree(h.free, S.u))) { S.charges--; S.shutUntil = S.t + CONFIG.evoeShut; S.shutAt = S.rt; S.shutN++; recount(); FX.sfx('shut'); FX.callUte('EVOe CLOSED ⚡' + (S.charges ? ' ' + S.charges + ' LEFT' : ''), '#bfe4ff'); FX.event('evoe_shut', { feature: h.type, charges: S.charges }); }
    break;
  }
  /* "5 LOOSE" warning: loose gear on board and a shaking feature within 40 m */
  if (!S.hold) { const h = HZ[S.hzI]; if (h && h.cat === 'shake' && h.s0 - S.s < 40 && h.s0 - S.s > 3 && S.looseN > 0 && S.warnH !== h.i) { S.warnH = h.i; S.warnAt = S.rt; } }
  /* strap-down bays: drive through to bank everything on board */
  for (let i = 0; i < BAYS.length; i++) { const b = BAYS[i]; if (!S.bayUsed[i] && S.s >= b.s0 && S.s <= b.s1 && S.u >= b.u0 && S.u <= b.u1) { S.bayUsed[i] = 1; bank('bay'); } }
  /* bonus gates: +3 GEAR drops three pieces in; x2 NEXT 5 doubles the next five pickups */
  while (S.bgI < BG.length && BG[S.bgI].s <= S.s) { const b = BG[S.bgI++]; if (Math.abs(S.u - b.u) <= b.half + 0.15) bonus(b); else b.state = 'missed'; }
  /* gear */
  for (let i = S.gI; i < GP.length; i++) {
    const g = GP[i];
    if (g.s > S.s + CONFIG.longDs) break;
    if (g.state !== 'road') { if (i === S.gI) S.gI++; continue; }
    const t = GT[g.type], ds = t.kind === 'long' ? CONFIG.longDs : CONFIG.gearDs, r = t.kind === 'small' ? S.reach : Math.max(S.reach, CONFIG.bigR);
    if (g.s > S.s + ds) continue;
    if (Math.abs(S.s - g.s) < ds && Math.abs(S.u - g.u) < r && pick(g)) continue;
    if (g.s < S.s - ds) { g.state = 'missed'; S.run = 0; if (t.kind === 'long') S.longRun = 0; if (i === S.gI) S.gI++; }
  }
  /* gates (bank + checkpoint + choice) */
  for (let k = 0; k < 3; k++) if (!S.gateDone[k] && S.s >= CONFIG.gateS[k] - CONFIG.holdAt - S.v * CONFIG.hold.easeK) { S.gateDone[k] = true; startHold(k); break; }
  const act = S.s < CONFIG.act2S ? 1 : S.gateDone[2] ? 3 : 2;
  if (act !== S.act) { S.act = act; if (act === 2) FX.act(2); }
  stages();
  /* unlock milestones: banked + on board against the target */
  const pct = S.total / CONFIG.target, lev = pct >= 1 ? 3 : pct >= 2 / 3 ? 2 : pct >= 1 / 3 ? 1 : 0;
  if (lev > S.milestone) { S.milestone = lev; FX.event('unlock_progress', { pct: [0, 33, 66, 100][lev] }); if (lev === 3) FX.callTop(S.banked >= CONFIG.target ? 'PROTECTED: NOW MAKE CAMP' : 'ENOUGH ON BOARD: KEEP IT', YEL); }
  if (!S.almost && pct >= 0.85 && pct < 1) { S.almost = true; FX.callTop('ALMOST THERE', YEL); }
  if (!S.cues.gear && S.t > 1.0 && GP.length > SPARES && GP[SPARES].s - S.s < 24) { S.cues.gear = 1; S.cueUntil = S.t + 1.8; FX.cue('gear', 'Drive through the cargo: stack it up', GP[SPARES].s, GP[SPARES].u, 1.2); }
  if (S.s >= S.campS - 4) arrive();
  else if (S.t >= CONFIG.dark) finish('dark');
}
/* while time is stopped only the presentation beats run (the fit clunk and its callouts) */
export function holdBeats() { stages(); }
/* the choice hold, a true pause: in (0.3 s ease to a full freeze), choose (no timer for a human: select a card, then FIT IT; bots and
   attract pick after 1.2 s), fit (the build shot, world frozen), go (0.7 s: the camera eases back while time ramps to full speed) */
export function startHold(k, again) {
  const n = GATES[k].opts.length;
  if (!again) { bank('gate'); S.cp = k; if (k === 2) S.needAt3 = CONFIG.target - S.total; snapshot(k); }
  S.hold = { k, n, phase: 'in', t: 0, tc: 0, tf: 0, tg: 0, hi: -1, pending: -1, picked: -1, botPick: Q.get('pick') === 'smart' ? smartPick(k) : Math.floor(BR() * n), tick: 0 };
  S.holdU = clampU(S.u); FX.sfx('gate'); FX.event('gate_open', { gate: k + 1, retry: !!again, ahead: LEG_AHEAD[k + 1] || [] });
}
export function smartPick(k) {
  const opts = GATES[k].opts, need = CONFIG.target - S.total, legsLeft = 3 - k, sec = opts.findIndex(o => ROLE[o] === 'secure'), haul = opts.findIndex(o => ROLE[o] === 'haul');
  /* the owner's rule: secure what you have while the road left can cover the deficit; haul more when it cannot */
  if (need <= 0) return sec; return need > CONFIG.legSupply * legsLeft * 0.8 || (legsLeft === 1 && need >= 4) ? haul : sec;
}
export function holdStep(dt, inp) {
  const H = S.hold, C = CONFIG.hold; H.t += dt;
  S.holdT += dt;
  if (H.phase === 'in') { S.scale = 1 - sm01(H.t / C.inT); if (H.t >= C.inT) { H.phase = 'choose'; H.tc = 0; S.scale = 0; } }
  else if (H.phase === 'choose') {
    S.scale = 0; H.tc += dt;
    let pick = -1;
    if (PICKQ[H.k] >= 0 && PICKQ[H.k] < H.n) { if (H.tc >= C.botPick) pick = PICKQ[H.k]; }
    else if (inp.pick != null && inp.pick >= 0) pick = inp.pick;
    else if (H.pending >= 0) pick = H.pending;
    if (pick >= 0) choose(pick);
  } else if (H.phase === 'fit') { S.scale = 0; H.tf += dt; if (H.tf >= C.fitT) { H.phase = 'go'; H.tg = 0; H.tick = 0; } }
  else {
    /* no countdown (owner): time ramps from paused to full speed while the camera eases back, steering is live from the first frame */
    H.tg += dt; if (!H.tick) { H.tick = 1; FX.sfx('resume'); }
    S.scale = H.tg < C.goT ? 0 : sm01((H.tg - C.goT) / C.outT);
    if (H.tg >= C.goT + C.outT) { S.hold = null; S.scale = 1; S.holdEnd = S.rt; if (H.k === 2) { S.cruise = CONFIG.cruise3; FX.act(3); } }
  }
}
export function choose(idx) {
  const H = S.hold, k = H.k, id = GATES[k].opts[idx];
  H.phase = 'fit'; H.tf = 0; H.picked = idx; H.hi = idx; S.sel[k] = id; S.fitAt[k] = S.rt; S.stage[k] = 0; S.points += 250;
  perk(id); legGear(k + 1, id); recount();
  FX.sfx('choose');
  FX.event('choice_made', { gate: k + 1, product: id, readS: +H.tc.toFixed(1), retry: S.retries });
}
export function perk(id) {
  if (id === 'rollE') { S.elec = true; S.charges = CONFIG.evoeCharges; }
  else if (id === 'bars') S.bars = true;
}
/* the electric cover: one tap shuts it for 2.5 s (nothing lost, nothing collected), 9 s to recharge; only when the pile is no taller
   than the rails (three layers) */
export const SHUT_T = 2.5, SHUT_RE = 9;
export const canShut = () => S.elec && !S.hold && S.t >= S.shutReady && (packLayers() + Math.ceil(S.pile.length / 6) <= 2 || !!S.sel[2]);
export function tryShut() {
  if (!S.elec || S.t < S.shutReady) return;
  if (!canShut()) { FX.callUte('TOO TALL TO SHUT', '#ffffff'); return; }
  S.shutUntil = S.t + SHUT_T; S.shutReady = S.t + SHUT_T + SHUT_RE; S.shutN++; S.shutAt = S.rt; recount(); FX.sfx('shut'); FX.callUte('COVER SHUT', YEL);
}
/* timed beats of each product fit (presentation clock S.rt: the world is in slow motion meanwhile) */
export function stages() {
  for (let j = 0; j < 3; j++) {
    if (S.fitAt[j] < 0) continue;
    const e = S.rt - S.fitAt[j];
    if (S.stage[j] === 0 && e >= CONFIG.hold.fitSnap) {
      S.stage[j] = 1; S.veh.byv -= 0.9; pileImp(0, 0.9); FX.sfx('clunk');
      FX.event('fitted', { gate: j, product: S.sel[j] });
    }
    if (S.stage[j] === 1 && e >= CONFIG.hold.fitSnap + 0.25) { S.stage[j] = 2; FX.sfx('code', j + 1); }
  }
}
export function impact(h) {
  S.hits++; S.hitSide = S.u >= 0 ? 1 : -1; S.v = Math.min(S.v, S.cruise * CONFIG.hitV); S.kick = 1; vehHit(); S.clean = 0; S.mult = 1; S.run = 0; pileImp((S.u > 0 ? -1 : 1) * 1.6, 2.4);
  FX.sfx('hit');
  const w = takeLoose(Math.round(CONFIG.stab.box * stabK()), 'impact', h);
  lossCall(h.type === 'rocks' ? 'ROCKS!' : h.type === 'log' ? 'BRANCH!' : 'WASHOUT!', w);
}
export function passFx(h, safe) {
  FX.event('feature_enter', { type: h.type, safe, loose: S.looseN });
  const Y = YEL;
  if (safe && stability() <= CONFIG.stab.crit && looseNow() > 0) { const w0 = takeLoose(CONFIG.stab.box, h.type, h); if (w0) { lossCall('TOO TALL!', w0); return; } }
  if (safe) { S.points += 50 * S.mult; FX.callUte(h.type === 'creek' ? 'SHALLOW FORD' : h.type === 'grid' ? 'SMOOTH LINE' : h.type === 'pothole' ? 'MISSED THE HOLES' : 'SMOOTH LINE', Y); FX.sfx('whoosh'); return; }
  let n = 0, word = '';
  if (h.type === 'pothole') { n = Math.round((CONFIG.fx.potN + (h.i % 2)) * stabK()); word = 'POTHOLES!'; S.veh.byv -= 0.8; pileImp((BR() - 0.5), 1.6); FX.sfx('bump'); }
  else if (h.type === 'grid') { n = Math.round((CONFIG.fx.gridN || CONFIG.stab.box) * stabK()); word = 'CATTLE GRID!'; S.veh.byv += 0.9; pileImp((BR() - 0.5) * 1.4, 2.2); FX.sfx('bump'); }
  else if (h.type === 'creek') { n = Math.round((CONFIG.fx.creekN || CONFIG.stab.box) * stabK()); word = 'CREEK DIP!'; S.v = Math.min(S.v, S.cruise * CONFIG.wetV); pileImp(0, 1.8); FX.sfx('splash'); }
  else if (h.type === 'crest') { n = CONFIG.fx.crestMax ? Math.min(CONFIG.fx.crestMax, Math.max(0, S.pile.length - Math.max(S.secN, CONFIG.fx.crestFloor))) : CONFIG.stab.box * (stability() < CONFIG.stab.danger ? 2 : 1); word = 'CREST JUMP!'; S.veh.byv += 2.0; S.kick = Math.max(S.kick, 0.6); pileImp((BR() - 0.5) * 1.2, 3.2); FX.sfx('jump'); }
  const w = takeLoose(n, h.type, h);
  if (w) lossCall(word, w); else if (S.pile.length || S.deck.length) heldCall(); else FX.callUte(word.replace('!', ''), '#ffffff');
}
export function lossCall(word, w) { S.lossAt = S.rt; S.lossW = w; if (w) { FX.sfx('lost', w); FX.callUte(word + ' -' + w, '#ffffff'); } else FX.callUte(word, '#ffffff'); }
export function heldCall() { S.held++; S.heldAt = S.rt; FX.callUte(isShut() ? 'COVER SHUT: ALL HELD' : eased() && S.looseN ? 'EASED OFF: KEPT IT' : 'SECURED: ALL HELD', YEL); FX.sfx('shield'); }
export function pick(g) {
  const t = GT[g.type];
  if (isShut()) return false;
  if (!roomFor(t.kind)) { g.state = 'gone'; S.full++; S.points += 5 * S.mult; if (S.rt - S.fullAt > 2.5) { S.fullAt = S.rt; FX.callUte('FULL', '#ffffff'); } return true; }
  g.state = 'pile'; g.t0 = S.rt;
  if (t.kind === 'small') S.pile.push(g.i); else S.deck.push(g.i);
  const wv = worth(g.i, t.kind === 'small' ? S.pile.length - 1 : -1); S.got += wv; S.run++; S.clean++;
  const m = Math.min(5, 1 + Math.floor(S.clean / 5));
  if (m > S.mult) { S.mult = m; S.bestMult = Math.max(S.bestMult, m); FX.sfx('mult', m); FX.callUte('ON A ROLL x' + m, YEL); }
  S.points += 10 * wv * S.mult;
  FX.sfx('pick', S.run - 1);
  recount(); FX.plus(wv); FX.event('pickup', { type: GT[g.type].id, w: wv, onBoard: S.onN, loose: S.looseN });
  if (S.dbl > 0 && t.kind === 'small') { S.dbl--; trailAt(g.s, g.u, PT0); spawnSpare({ x: PT0.x, y: groundH(g.s, g.u) + 0.4, z: PT0.z }); }
  if (t.kind === 'long') { S.longRun++; if (S.longRun % 3 === 0) { const m2 = Math.min(5, S.mult + 2); S.mult = m2; S.bestMult = Math.max(S.bestMult, m2); S.points += 150; S.veh.byv += 1.1; FX.sfx('jump'); FX.callUte('STREAK x3: LONG LOADS', YEL); } }
  return true;
}
export const PT0 = { x: 0, z: 0, th: 0 };
export function spawnSpare(from) {
  if (nSpare >= SPARES || !roomFor('small')) return;
  const g = GP[nSpare++]; g.type = Math.floor(R2(nSpare * 13 + S.got) * 4); g.state = 'pile'; g.t0 = S.rt; g.from = from;
  S.pile.push(g.i); S.got++; recount(); FX.plus(1);
}
export function bonus(b) {
  b.state = 'got'; b.gotAt = S.rt; S.bonusN++; S.points += 100;
  trailAt(b.s, b.u, PT0); const from = { x: PT0.x, y: groundH(b.s, b.u) + 1.0, z: PT0.z };
  if (b.kind === '+3') { for (let q = 0; q < 3; q++) spawnSpare(from); FX.callUte('+3 CARGO', YEL); }
  else { S.dbl += CONFIG.dbl; FX.callUte('x2 NEXT 5', YEL); }
  FX.sfx('bonus');
}
export function closeOne(h) {
  S.close++; S.clean += 2; S.points += 50 * S.mult;
  const m = Math.min(5, 1 + Math.floor(S.clean / 5)); if (m > S.mult) { S.mult = m; S.bestMult = Math.max(S.bestMult, m); }
  FX.callUte('CLOSE ONE', YEL); FX.sfx('whoosh');
}
export function arrive() { recount(); finish(S.total >= CONFIG.target ? 'win' : 'short'); }
export function finish(kind) {
  S.done = kind === 'win' ? 'win' : 'fail'; S.endT = 0; S.hold = null; S.scale = 1; recount();
  const N = S.total, T = CONFIG.target, short = Math.max(0, Math.round(S.campS - S.s));
  S.stars = N >= T ? 1 + (N >= CONFIG.stars[1] ? 1 : 0) + (N >= CONFIG.stars[2] ? 1 : 0) : 0;
  if (kind === 'win' || kind === 'short') { S.reveal = true; S.bankAt = S.rt; S.stopS = S.campS + 6; S.sealAt = S.rt + 0.6; FX.event('tally', { total: N, target: T, secured: S.banked, loose: S.onN, pieces: S.packed.length + S.pile.length + S.deck.length, startsIn: 0.6 }); }
  if (kind === 'win') {
    S.reason = 'Code unlocked'; S.measure = `${S.banked} protected + ${S.onN} loose made it · ${S.points.toLocaleString('en-AU')} points · best streak x${S.bestMult}`;
    FX.event('code_unlocked', { gear: N, stars: S.stars, retries: S.retries });
  } else {
    S.reason = 'So close'; S.measure = kind === 'short' ? `${N} / ${T} at camp` : `Lost the light ${short} m short of camp · ${N} / ${T}`;
    S.failAt = kind === 'short' ? 'short' : 'dark'; FX.event('fail', { reason: S.failAt, total: N, target: T, checkpoint: SNAP ? SNAP.k + 1 : 0 });
  }
  if (!!FX.live()) FX.sfx(kind === 'win' ? 'bank' : 'lost', kind === 'win' ? Math.min(N, 20) : 3);
}

/* ---------- status (one reused object, strings rebuilt only when a value changes) ---------- */
export const ST = { done: null, reason: '', progress: [0, 0, 0, 0], winTitle: 'Code unlocked', measure: '', simMeasure: 0, cue: false, extra: '', failAt: null, sheetExtra: '', gear: 0, swerve: 0, roll: 0, pitch: 0, points: 0, clock: 0, canRetry: false, cpName: '', reveal: false, stats: null };
export let extraKey = '';
export function status() {
  ST.done = S.done; ST.reason = S.reason; ST.measure = S.measure; ST.failAt = S.failAt; ST.reveal = S.reveal;
  ST.simMeasure = S.total; ST.cue = S.t < S.cueUntil; ST.gear = S.total; ST.points = S.points; ST.clock = +S.t.toFixed(2);
  ST.canRetry = S.done === 'fail' && !!SNAP; ST.cpName = SNAP ? CP_NAME[SNAP.k] : '';
  ST.swerve = +(S.swerve * 57.2958).toFixed(1); ST.roll = +(S.rollMax * 57.2958).toFixed(1); ST.pitch = +(S.pitchMax * 57.2958).toFixed(1);
  if (S.done) { const sh = S.needAt3 >= 4 ? 1 : 0; ST.stats = { shortAt3: sh, shortAt3Won: sh && S.done === 'win' ? 1 : 0, needAt3: S.needAt3 || 0, driveS: +(S.rt - S.endT - S.holdT).toFixed(1), readS: +S.holdT.toFixed(1), total: S.total, banked: S.banked, sealed: S.onN, got: S.got, lost: S.lost, hits: S.hits, held: S.held, shuts: S.shutN, banks: S.banks, bonus: S.bonusN, full: S.full, stars: S.stars, easeS: +S.easeT.toFixed(1) }; for (const k in S.lostBy) ST.stats['lost_' + k] = S.lostBy[k]; }
  return ST;
}

/* ---------- bots (greybox rule 5) ----------
   perfect: follows the clean path (every piece, bonus gate, smooth line and strap-down bay). first: reaction delay, aim error that shrinks
   as it learns, chases each gear line, goes for bait and bonus gates half the time, heads for a bay 60% of the time, taps the electric
   cover 60% of the times it sees a loss coming; with ?core=speed it eases off over 70% of the features it carries loose gear into.
   random: a random line every 0.3-0.9 s. All pick at a gate after 1.2 s (?pick= forces the cards). */
export const BOT = { tap: false, hold: false, swipe: 0, steer: 0, steerTo: 0, pick: -1, shut: false, ease: null };
export function bot(kind, dt) {
  const b = S.bot; BOT.steerTo = S.target; BOT.pick = -1; BOT.shut = false; BOT.ease = null;
  if (S.done) return BOT;
  if (S.hold) { if (S.hold.phase === 'choose' && S.hold.tc >= CONFIG.hold.botPick) BOT.pick = S.hold.botPick; return BOT; }
  const h = S.hzI < HZ.length ? HZ[S.hzI] : null;
  if (kind === 'spam' || kind === 'random') { b.next -= dt; if (b.next <= 0) { b.goal = (BR() * 2 - 1) * CONFIG.uMax; b.next = 0.3 + BR() * 0.6; b.easeFor = CORE.speed && BR() < 0.3 ? 1 : -1; } BOT.ease = b.easeFor > 0; BOT.steerTo = b.goal; return BOT; }
  if (kind === 'perfect') {
    BOT.steerTo = clampU(pathU(S.s + CONFIG.botLead * S.v / CONFIG.cruise));
    /* perfect play takes a rough line when it has secure room for it, or the EVOe tap ready to shut just after the last pickup */
    for (let i = S.hzI; i < HZ.length && i < S.hzI + 2; i++) { const hr = HZ[i]; if (!hr.rough || hr.s0 - S.s > 16 || S.s > hr.s1 + 1) continue;
      const room = S.secN - S.pile.length, saved = S.elec && S.charges > HZ.filter(x => x.leg === hr.leg && x.type === 'crest' && x.s0 > hr.s0).length && (hr.type === 'grid' || hr.type === 'creek'), [a0, b0] = hr.spans[0];
      if (room >= CONFIG.roughN + 1 || saved) BOT.steerTo = clamp((Math.max(-CONFIG.half, a0) + Math.min(CONFIG.half, b0)) / 2, -2.8, 2.8);
      break; }
    if (CORE.speed) BOT.ease = !!(h && h.full && h.s0 - S.s < 30 && S.looseN > 0);
    return BOT;
  }
  if (S.t < b.fumbleT) { BOT.steerTo = b.fumbleGoal; return BOT; }
  let g = null; for (let i = S.gI; i < GP.length; i++) { const q = GP[i]; if (q.state === 'road' && q.s > S.s + 5) { g = q; break; } }
  let bay = -1; for (let i = 0; i < BAYS.length; i++) { const B = BAYS[i]; if (!S.bayUsed[i] && (b.bay[i] || S.retries) && B.s1 > S.s && B.s0 - S.s < 30) { bay = i; break; } }
  let key, aim, objS, sig;
  /* a retry is a second run of a leg the player has seen: the bot aims at its best, skips the greedy rough lines and uses the bays */
  const learn = S.retries ? 2 : S.hzPassed < 3 ? 0 : S.hzPassed < 6 ? 1 : 2, greedy = i => !S.retries && b.greed[i];
  if (bay >= 0 && S.onN > 0) { const B = BAYS[bay]; key = 'b' + bay; aim = (B.u0 + B.u1) / 2; objS = B.s0; sig = 0.35; }
  else if (g && g.s - S.s < 28 && (!h || g.s < h.s0 - 5 || (g.bait && greedy(g.h)))) { key = 'g' + g.line; aim = g.u; objS = g.s; sig = CONFIG.sigma.gear; }
  else if (h) { const bg = h.bg >= 0 && greedy(h.i) ? BG[h.bg] : null; key = 'h' + h.i; aim = bg ? bg.u : centreOf(h.free); objS = h.s0; sig = CONFIG.sigma.hz[learn]; }
  else { key = 'end'; aim = 0; objS = S.s; sig = 0; }
  if (key !== b.objKey) {
    const cont = key[0] === 'g' && b.objKey[0] === 'g';
    b.objKey = key; b.seenAt = -1; b.delay = cont ? 0.2 + BR() * 0.2 : CONFIG.react[0] + BR() * (CONFIG.react[1] - CONFIG.react[0]); b.err = gauss(BR) * sig;
  }
  if (b.seenAt < 0 && objS - S.s < CONFIG.view) { b.seenAt = S.t; b.commitAt = S.t + b.delay; }
  if (b.seenAt >= 0 && S.t >= b.commitAt) b.goal = clampU(aim + b.err);
  const threat = h && h.cat === 'shake' && (h.full || !inFree(h.free, b.goal)) && h.s0 - S.s < 16 && h.s0 - S.s > 1 && S.looseN > 0;
  if (CORE.speed) { if (h && h.cat === 'shake' && h.s0 - S.s < 28 && S.looseN > 0 && b.easeFor !== h.i && b.easeFor !== -h.i - 2) b.easeFor = BR() < 0.7 ? h.i : -h.i - 2; BOT.ease = b.easeFor >= 0 && h && b.easeFor === h.i && S.s < h.s1 + 3; }
  BOT.steerTo = b.goal; return BOT;
}


/* ---------- drive test (?drivetest): step responses in fixed steps with the layout removed ---------- */
export function driveRun(input, n) {
  reset(1); HZ = []; GP = []; BG = []; BAYS = []; S.hzHit = []; S.gateDone = [true, true, true]; S.campS = 1e9;
  const rec = { yaw: [], steer: [], u: [], th: [], roll: [] };
  for (let i = 0; i < (n || 330); i++) { const inp = input(i); update(1 / 60, inp); rec.yaw.push(POSE[PYAW]); rec.steer.push(POSE[PSTEER]); rec.u.push(S.u); rec.th.push(trailAt(S.s, 0, PJ).th); rec.roll.push(S.veh.rB); }
  return rec;
}
export function drivetest(id) {
  const deg = Math.PI / 180, first = (A, B, thr) => { for (let i = 150; i < A.length; i++) if (Math.abs(A[i] - B[i]) >= thr) return i - 150 + 1; return null; };
  const base = driveRun(() => ({ steerTo: 0 })), lane = driveRun(i => ({ steerTo: i < 150 ? 0 : 2.5 })), small = driveRun(i => ({ steerTo: i < 150 ? 0 : 0.8 }));
  const du = lane.u.map((u, i) => u - base.u[i]);
  let t10 = null, t90 = null, over = 0; for (let i = 150; i < du.length; i++) { if (t10 == null && du[i] >= 0.25) t10 = +((i - 150 + 1) / 60).toFixed(2); if (t90 == null && du[i] >= 2.25) t90 = +((i - 150 + 1) / 60).toFixed(2); over = Math.max(over, du[i] - 2.5); }
  const pk = (rec, f) => +(Math.max(...rec.map((y, i) => Math.abs(f(y, i)))) / deg).toFixed(1);
  return { variant: id || 'trail-to-camp-choice', laneChange_0_to_2p5m: { stepsToWheel1deg: first(lane.steer, base.steer, 1 * deg), t10s: t10, t90s: t90, overshootM: +over.toFixed(3), peakYawDeg: pk(lane.yaw, (y, i) => y - base.yaw[i]), peakRollDeg: pk(lane.roll, (r, i) => r - base.roll[i]) }, smallChange_0p8m: { peakYawDeg: pk(small.yaw, (y, i) => y - base.yaw[i]) } };
}

/* ---------- sims (greybox rule 5), shared by the browser core (?sim) and Node: node choice-logic.js n=200 bots=first pick=1,2,3 ----------
   Per bot: first-attempt unlock %, unlock within the allowed checkpoint retries %, round length (first attempt and including retries, in
   fixed steps of 1/60 s, holds included), world clock at the end, gear at camp, fail reasons and per-round means of the logic's stats. */
export function spread(a) { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y), q = f => +b[Math.min(b.length - 1, Math.floor(b.length * f))].toFixed(1); return { min: +b[0].toFixed(1), p10: q(0.1), median: q(0.5), p90: q(0.9), max: +b[b.length - 1].toFixed(1) }; }
export function simRun(opt) {
  const n = opt.n || 200, kinds = opt.bots || ['perfect', 'first', 'random'], maxR = opt.retries == null ? 1 : opt.retries, out = { n, retries: maxR, core: CORE.speed ? 'speed' : 'steer', pick: Q.get('pick') || 'random', bots: {} };
  for (const kind of kinds) {
    let wins = 0, winsR = 0; const firstT = [], allT = [], clocks = [], gear = [], reasons = {}, acc = {};
    for (let i = 0; i < n; i++) {
      reset(1000 + i); let tt = 0, st, used = 0, first = null;
      while (tt < 400) { const a = bot(kind, 1 / 60); update(1 / 60, a); tt += 1 / 60; st = status();
        if (st.done) { if (!first) { first = { done: st.done, gear: st.gear, clock: st.clock, reason: st.failAt, stats: Object.assign({}, st.stats), t: tt }; }
          if (st.done === 'fail' && st.canRetry && used < maxR) { retry(); used++; continue; } break; } }
      if (!first) continue;
      allT.push(tt); firstT.push(first.t); clocks.push(first.clock); gear.push(first.gear);
      if (first.done === 'win') wins++; else reasons[first.reason] = (reasons[first.reason] || 0) + 1;
      if (st.done === 'win') winsR++;
      for (const k in first.stats) acc[k] = (acc[k] || 0) + first.stats[k];
    }
    out.bots[kind] = { unlockFirstPct: Math.round(100 * wins / n), unlockWithinRetryPct: Math.round(100 * winsR / n), firstAttemptS: spread(firstT), totalS: spread(allT), clock: spread(clocks), gearAtCamp: spread(gear), failReasons: reasons, means: Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, +(v / n).toFixed(2)])) };
  }
  return out;
}

/* tuning hook: ?cfg={"target":20,...} merges into CONFIG (sweeps only). Owner feel knobs: ?center, ?assist, ?roll=0..2, ?weight=0..2 */
if (Q.has('cfg')) { const c = JSON.parse(Q.get('cfg')); for (const k in c) { if (typeof c[k] === 'object' && CONFIG[k] && !Array.isArray(c[k])) Object.assign(CONFIG[k], c[k]); else CONFIG[k] = c[k]; } }
if (Q.has('center')) CONFIG.drive.center = clamp(+Q.get('center') || 0, 0, 1);
if (Q.has('assist')) CONFIG.drive.assist = clamp(+Q.get('assist') || 0, 0, 1);
if (Q.has('roll')) CONFIG.susp.roll = clamp(+Q.get('roll') || 0, 0, 2);
if (Q.has('weight')) CONFIG.drive.weight = clamp(+Q.get('weight') || 0, 0, 2);
/* stars at the target, +20% and +40%; the unlock bar runs to +50% */
if (!(Q.get('cfg') || '').includes('stars')) CONFIG.stars = [CONFIG.target, Math.round(CONFIG.target * 1.2), Math.round(CONFIG.target * 1.4)];
CONFIG.barMax = Math.round(CONFIG.target * 1.5);
reset(Q.has('seed') ? +Q.get('seed') : 1);
/* edge test (?edgetest / node choice-logic.js edgetest=1): reach and response of the lateral control with the layout removed */
export function edgeTest() {
  const run = (cmd, n) => { reset(1); HZ = []; GP = []; BG = []; BAYS = []; S.hzHit = []; S.gateDone = [true, true, true]; S.campS = 1e9; S.v = CONFIG.cruise; const u = []; for (let i = 0; i < n; i++) { update(1 / 60, cmd(i)); u.push(S.u); } return u; };
  const hold = run(i => ({ steerTo: i < 60 ? CONFIG.uMax : -CONFIG.uMax }), 180), lane = run(i => ({ steerTo: i < 30 ? 0 : 2.5 }), 120), key = run(() => ({ steer: 1 }), 120);
  const tAt = (a, from, f) => { for (let i = from; i < a.length; i++) if (f(a[i])) return +((i - from + 1) / 60).toFixed(2); return null; };
  const max = Math.max(...hold), min = Math.min(...hold), tyre = 0.84 + 0.15;
  return { roadHalfWidth: CONFIG.half, uteCentreRange: [+min.toFixed(2), +max.toFixed(2)], outerTyreReach: [+(min - tyre).toFixed(2), +(max + tyre).toFixed(2)],
    edgeToEdge90s: tAt(hold, 60, u => u <= CONFIG.uMax - 0.9 * 2 * CONFIG.uMax), laneChange2p5m_t90s: tAt(lane, 30, u => u >= 2.25), keyHoldToEdge95s: tAt(key, 0, u => u >= 0.95 * CONFIG.uMax),
    swipeForFullRoad: `${Math.round(CONFIG.drive.dragFrac / CONFIG.drive.sens * 100)}% of the screen width (capped at ${CONFIG.drive.dragMaxPx} px)` };
}
export const NODE_MAIN = !ENV && typeof process !== 'undefined' && /choice-logic(-dev)?\.js$/.test((process.argv[1] || '').replace(/\\/g, '/'));
if (NODE_MAIN && Q.has('edgetest')) console.log(JSON.stringify(edgeTest(), null, 1));
/* stack test: through a perfect run with the given picks, the protected total before each gate, the card's "PROTECTED a -> b" numbers
   (the view shows a = S.secN and b = a + perLayer on a SECURE card) and the total after the fit must agree */
export function stackTest(seed) {
  reset(seed || 7); const rows = []; let seen = -1, before = 0;
  for (let n = 0; n < 60 * 200 && !S.done; n++) {
    if (S.hold && S.hold.k !== seen && S.hold.phase === 'choose') { seen = S.hold.k; before = S.secN; }
    const hadHold = S.hold && S.hold.phase === 'choose' ? S.hold.k : -1;
    update(1 / 60, bot('perfect', 1 / 60));
    if (hadHold >= 0 && (!S.hold || S.hold.phase !== 'choose')) { const id = S.sel[hadHold], secure = ROLE[id] === 'secure'; rows.push({ gate: hadHold + 1, product: id, before, cardFrom: secure ? before : null, cardTo: secure ? before + CONFIG.pile.perLayer : null, after: S.secN, ok: secure ? S.secN === before + CONFIG.pile.perLayer : S.secN === before }); }
  }
  return { pick: Q.get('pick'), rows, pass: rows.length === 3 && rows.every(r => r.ok) };
}
if (NODE_MAIN && Q.has('stacktest')) { const r = stackTest(); console.log(JSON.stringify(r, null, 1)); if (!r.pass) process.exitCode = 1; }
if (NODE_MAIN && Q.has('n')) {
  const bots = (Q.get('bots') || 'perfect,first,random').split(','), o = simRun({ n: +Q.get('n'), bots, retries: Q.has('retries') ? +Q.get('retries') : 1 });
  console.log(Q.has('json') ? JSON.stringify(o) : JSON.stringify(o, null, 1));
}
