/* Trail to Camp, the game layer on the style test's world (06-game, rebased). The world, sky, colour script, long shadows, dust, wildlife,
   boards, brand, tiers, post and perf recorder are the style test's own (sworld.js, a hook-patched copy of 05-style-test/style.js); this
   layer adds the game: the rules' ute pose and camera rig, the gear stream and pile with the safe zone, the fittings and their build shot,
   the road features' signs and dressing, the gates, the pop-up turntables, the HUD and sound, and the QA checks.
   Hooks it serves (GAMEL): preKit, headingX, roadYX, trailEnd, extraH, colour, reserved, boards, brands, terrainDone, onPut, extendWorld,
   farClear, extendFar, SCRIPT, attach, poseUte, pose, camera, fx, beforeRender, afterRender. */
import * as THREE from 'three';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/addons/libs/meshopt_decoder.module.js';
import * as K from './kit.js';
import { SEEDS } from './seeds.js';
import * as L from './rules.js';
import * as W from './w2.js';
import * as HUD from './hud2.js';
import * as UIB from './uib.js';
import { createRoadFeatures, patchTerrain } from './rfeat.next/road-features.js';
import { createStash } from './stash.next/stash.js';
import * as AU from './au2.js';
import * as UT from './ute2.js';
import { REC } from './rec.js';

const Q = new URLSearchParams(location.search), DEBUG = Q.get('debug') || '', LIFE = Q.get('life') !== '0';
const TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const GPU0 = (() => { try { const c = document.createElement('canvas'), g = c.getContext('webgl2') || c.getContext('webgl'); if (!g) return ''; const x = g.getExtension('WEBGL_debug_renderer_info'); const s = String(x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER)); const l = g.getExtension('WEBGL_lose_context'); if (l) l.loseContext(); return s; } catch (e) { return ''; } })();
const LOWGPU = /Mali|Adreno \(TM\) [345]\d\d|Adreno \(TM\) 6[0-4]\d|PowerVR|SGX/i.test(GPU0) || (navigator.deviceMemory && navigator.deviceMemory <= 3);
const SS = { get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } } };
const QT = Q.get('tier');
export const TIER = QT === 'desktop' ? 'desktop' : QT === 'low' ? 'low' : QT === 'mid' ? 'mid' : !TOUCH ? 'desktop' : (SS.get('tc-tier') || (/Apple/i.test(GPU0) && !LOWGPU ? 'mid' : 'low'));
const LOW = TIER === 'low', HI = TIER === 'desktop';
const AA = ['fxaa', 'msaa', 'none'].includes(Q.get('aa')) ? Q.get('aa') : HI ? 'msaa' : /Mali|Adreno|PowerVR/i.test(GPU0) ? 'fxaa' : 'msaa';
const BASE_DPR = Math.min(window.devicePixelRatio || 1, LOW ? 1.5 : 2), SCALE_MIN = LOW ? 0.75 : 0.7;
const BRAND = Q.has('brand') ? Math.max(0, Math.min(2, parseInt(Q.get('brand'), 10) || 0)) : 1;
let SCALE = 1;
const { CONFIG, GT, POSE, PREV, NP, PX, PZ, PYAW, PBY, PPITCH, PROLL, PSTEER, PSPIN, PW0, PBASE, PS, PU, WHX, WHZ, CGY, clamp, smooth, wrapA, sm01, R2 } = L;
const YEL = new THREE.Color(K.PALETTE.yellow);
let RT = null;
export function setCore(rt) { RT = rt; }

/* ---------------------------------------------------------------- the style world's handles (attach) */
let SW = null, renderer, scene, camera, U, worldMat, fireLight = null, gltf;
let VW = innerWidth, VH = innerHeight;
const loadGLB = url => new Promise((res, rej) => gltf.load(url, res, undefined, rej));
const say = (t, p) => { const e = document.getElementById('status'); if (e) { e.textContent = t; if (p !== undefined) e.style.setProperty('--p', p + '%'); } };
let drawing = false, pendingSize = null;
export function init() { HUD.build(RT, { bot: () => !!RT._botKind, muted: AU.isMuted, setMuted: AU.setMuted }); AU.setModeFn(() => RT.mode); }
export function resize() { /* the style world resizes at the start of its frame */ }
let RSZ = 1, RSZ_SEEN = 0; addEventListener('resize', () => { RSZ++; }); addEventListener('orientationchange', () => { RSZ++; });
function applySize() { if (RSZ_SEEN === RSZ) return; RSZ_SEEN = RSZ; VW = innerWidth; VH = innerHeight; }
/* ---------------------------------------------------------------- the world is the style test's own 440 m trail; rules distance x KS */
const gq = (s, c, w) => Math.exp(-(((s - c) / w) ** 2));
const heading0 = s => 0.2 * Math.sin((s - 40) / 80) + 0.08 * Math.sin((s + 10) / 38);
/* the long world's road (05-style-test-long/style.js): keep in step with its roadY */
export const WORLD = { s0: -70, s1: 990, roadEnd: 905, stop: 895, camp: { s: 918, u: -1.5 }, banner: { s: 910, u: -5.0 } };
const roadY0 = s => 3.2 * gq(s, 122, 30) + 1.2 * Math.sin(s / 37 + 0.5) + 2.6 * gq(s, 292, 50) - 1.05 * gq(s, 200, 7) + 2.4 * gq(s, 455, 45) - 1.2 * gq(s, 560, 30) + 3.0 * gq(s, 735, 70) + 1.4 * gq(s, 860, 40);
/* the shoulder in front of the camp banner, level with the road for the drive-in (regrade; terrain and wheels share it) */
export function padFlat(s, u, h) {
  if (true) return 0; const m = K.smooth(322, 329, s) * (1 - K.smooth(343, 349, s)) * K.smooth(3.9, 4.7, -u) * (1 - K.smooth(8.0, 9.6, -u));
  if (m <= 0) return 0; const yr = K.groundHeight(TR, s, 0, {}) - 0.06; return (yr - h) * m;
}
const STY_CREEK = (s, u) => { const cc = 200 + 7 * Math.sin(u / 23), d = s - cc; return -1.25 * Math.exp(-((d / 5.5) ** 2)) * K.smooth(150, 60, Math.abs(u)); };
export const S0 = 5, KS = 1;
export const PACE = { k: 1.0 };
let TR = null, BASE_OPT = null;
const baseW = (sw, u) => K.groundHeight(TR, sw, u, BASE_OPT);
export const ws = s => Math.max(WORLD.s0 + 1, Math.min(WORLD.s1 - 1, S0 + s * KS));
/* no road shapes from the rules tonight (the kit's road is drawn unchanged): its ripples, crests, grid humps and creek dips are zeroed */
export function flatten() { L.BM.fill(0); L.CRESTS.length = 0; L.JUMPS.length = 0; L.CREEKS.length = 0; }
export const FEATURES_ON = ['rocks', 'log', 'pothole'];
export function roadRules() {
  /* step C: no filter, no override (the road-features module draws every type) */
}
/* the felt profile of the drawn features, added to the rules' ground under the wheels (not to the drawn road, which the models sit on) */
function featureH(s, u) {
  let h = 0; for (const f of L.HZ) { if (s < f.s0 - 0.6 || s > f.s1 + 0.6) continue;
    const imp = f.type === 'rocks' || f.type === 'log', pot = f.type === 'pothole'; if (!imp && !pot) continue;
    const mid = (f.s0 + f.s1) / 2, half = Math.max(0.3, (f.s1 - f.s0) / 2), along = Math.max(0, 1 - Math.abs(s - mid) / (half + 0.4)), ka = along * along * (3 - 2 * along);
    let lat = 0; for (const [a, b] of (f.spans || [])) { const d = u < a ? a - u : u > b ? u - b : 0; lat = Math.max(lat, 1 - K.smooth(0, 0.18, d)); }
    if (lat <= 0) continue; h += (f.type === 'rocks' ? 0.22 : f.type === 'log' ? 0.14 : -0.09) * ka * lat; }
  return h;
}
export function prepare() {
  TR = K.trackFromFunctions(WORLD.s0, WORLD.s1, heading0, roadY0);
  BASE_OPT = { creek: (s, u, h) => (Math.abs(u) > K.ROAD.gutter ? STY_CREEK(s, u) + padFlat(s, u, h) : 0) };
  roadRules(); Object.assign(CONFIG.susp, { heaveW: 13, heaveZ: 0.55, pitchW: 11, rollW: 10 });
  W.setRoad(K.ROAD.half, K.ROAD.gutter, K.ROAD.bankTop);
  const o = {};
  L.TRAIL.fill = (TX, TZ, TH) => { for (let i = 0; i < TX.length; i++) { TR.at(ws(i), o); TX[i] = o.x; TZ[i] = o.z; TH[i] = o.th; } };
  L.GROUND.base = (s, u) => baseW(ws(s), u) + rfH(ws(s), u);
  /* the layer works in rules units: positions and heights map through the scale */
  W.HOOK.pos = (s, u, out = {}) => { TR.world(ws(s), u, out); return out; };
  W.HOOK.GH = (s, u) => baseW(ws(s), u);
  W.setup(); flatten();
}
/* the game's reservations: only its signs and its gate arches (the kit keeps its own composition) */
export function reserved(s, u, r) {
  const a = Math.abs(u); 
  for (const gs of CONFIG.gateS) if (Math.abs(s - ws(gs)) < 5 + r && a < 8.5) return true;
  for (const sg of allSigns()) if (Math.hypot(s - ws(sg.s), u - sg.u) < 1.6 + r) return true;
  return false;
}
/* the kit's gate arch moves to the last choice gate (never two arches in one place); the other two gates get their own arch */
export function boardsShort() { return [[0.08, '5 km'], [0.55, '2 km'], [0.88, '500 m']].map(([k, d]) => { let s = Math.round(k * 352); for (const g of CONFIG.gateS) { const gw = ws(g); if (Math.abs(s - gw) < 18) s = Math.round(gw - 18); } return { s, u: 2.4, d, yaw: Math.PI - 0.65 }; }); }
export function brands(B) { B.gate.s = ws(CONFIG.gateS[2]); }
let TERR_N = [], PUTS = [], DRESS_N = [], SIGNS = [];
export function terrainDone(chunks) { TERR_N = chunks.map(f => f.P.length / 3); }
export function onPut(part, s, u, o) { PUTS.push({ part, s: (s - S0) / KS, u, yaw: o.yaw || 0, sc: Array.isArray(o.s) ? 1 : (o.s || 1), sink: o.sink || 0, lift: o.lift || 0 }); }
export function computeSigns() { SIGNS = W.features().filter(f => f.type === 'rocks' || f.type === 'log' || true).map(f => ({ s: f.s0 - 38, u: K.ROAD.half + 1.95, kind: f.type, big: false })); }
let GATE_META = null, OURPUT = false;
const GATE_K = 1.18, scaleFace = fm => ({ w: fm.w * GATE_K, h: fm.h * GATE_K, cy: fm.cy * GATE_K, z: fm.z * GATE_K });
/* the kit's own arch at gate 3 is skipped (ours stands there, raised); its face meta is scaled so the kit draws its banner on ours */
export function skipPut(part, s, u, o) {
  if (OURPUT || !part.meta || !part.meta.face || part.meta.face.w < 6 || Math.abs(s - ws(CONFIG.gateS[2])) > 0.5) return false;
  part.meta.face = scaleFace(part.meta.face); return true;
}
export function extendWorld(api) {
  OURPUT = true; for (let k = 0; k < 3; k++) { const f = K.brandGate(); api.put(f, ws(CONFIG.gateS[k]), 0, { yaw: Math.PI, s: GATE_K }); GATE_META = f.meta; } OURPUT = false;
  /* road features: only the rock falls and the fallen branch (kit-style models on the road); the rest is plain road with sign and chip */
  DRESS_N = api.chunks.map(f => f.P.length / 3); WT = api.T;
}
const SIGN_KINDS = ['corrug', 'pothole', 'grid', 'crest', 'creek', 'rocks', 'log', 'washout', 'bay', 'side'];
function canvasTex(w, h, fn) { const c = document.createElement('canvas'); c.width = w; c.height = h; fn(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
let signMesh = null, gateDyn = [], dressMesh = null, postMesh = null, WT = null;
/* a new layout: the feature models (rock falls, the branch, potholes) and their signs for this round's hazards */
export function newLayout() {
  W.refreshFeatures(); computeSigns(); if (!scene || !worldMat) return; rfBuild();
  if (dressMesh) { scene.remove(dressMesh); dressMesh.geometry.dispose(); dressMesh = null; }
  const all = new K.Facets(), T0 = WT || SW.T; for (const d of W.dress(null, hint => (x, z) => T0.toTrack(x, z, ws(hint)))) { all.add(d.F, {}, null); for (const v of d.F.T) all.T.push(v); }
  if (all.P.length && !RF) { dressMesh = new THREE.Mesh(K.toGeometry(THREE, all), worldMat); dressMesh.frustumCulled = false; scene.add(dressMesh); }
  if (signMesh) { scene.remove(signMesh); signMesh.geometry.dispose(); signMesh = null; } if (postMesh) { scene.remove(postMesh); postMesh.geometry.dispose(); postMesh = null; } postGeos.length = 0; if (!RF) buildSigns();
}
let ALLSIGNS = null;
const allSigns = () => ALLSIGNS || (ALLSIGNS = SIGNS.concat(...SEEDS.map(x => (x.signs || []).map(s => ({ s, u: K.ROAD.half + 1.95 })))));
const postGeos = [];
function mergeG(geos) { let n = 0; for (const g of geos) n += g.attributes.position.count; const out = new THREE.BufferGeometry(); for (const name of ['position', 'normal', 'color', 'aFx', 'aTrk']) { const sz = geos[0].attributes[name].itemSize, a = new Float32Array(n * sz); let o = 0; for (const g of geos) { a.set(g.attributes[name].array, o); o += g.attributes[name].array.length; } out.setAttribute(name, new THREE.BufferAttribute(a, sz)); } out.computeBoundingSphere(); return out; }
function buildSigns() {
  const n = SIGN_KINDS.length, cell = 128, tex = canvasTex(cell * n, cell, c => { SIGN_KINDS.forEach((k, i) => { c.save(); c.translate(i * cell, 0); HUD.drawPicto(c, k, cell, '#E9B52C'); c.restore(); }); });
  const pos = [], uv = [], fx = [], trk = [], P = {};
  for (const sg of SIGNS) {
    const i = SIGN_KINDS.indexOf(sg.kind); if (i < 0) continue; const sz = 1.1, y0 = W.GH(sg.s, sg.u) + 2.2; W.pos(sg.s, sg.u, P);
    const th = P.th + Math.PI, rx = Math.cos(th), rz = -Math.sin(th), fwx = Math.sin(th), fwz = Math.cos(th), cx = P.x + fwx * 0.06, cz = P.z + fwz * 0.06;
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, -1], [1, 1], [-1, 1]]) { pos.push(cx + rx * a * sz / 2, y0 + b * sz / 2, cz + rz * a * sz / 2); uv.push((i + (a + 1) / 2) / n, (b + 1) / 2); fx.push(1, 0, 0.2, 0.05); trk.push(ws(sg.s), sg.u); }
    const pg = new K.Facets(); K.bevelBox(pg, [0, 1.05, -0.04], 0.09, 2.5, 0.09, 0.015, () => K.C.steel, [1, 0, 0, 0]); const g = K.toGeometry(THREE, pg); g.rotateY(th); g.translate(P.x, W.GH(sg.s, sg.u) - 0.3, P.z); postGeos.push(g);
  }
  if (!pos.length) return;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setAttribute('aFx', new THREE.Float32BufferAttribute(fx, 4)); g.setAttribute('aTrk', new THREE.Float32BufferAttribute(trk, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(new Array(pos.length).fill(1), 3)); g.computeVertexNormals();
  const m = K.createWorldMaterial(THREE, U); m.map = tex; m.alphaTest = 0.5; m.side = THREE.DoubleSide; m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -4; m.customProgramCacheKey = () => 'kitworld-sign';
  signMesh = new THREE.Mesh(g, m); signMesh.frustumCulled = false; scene.add(signMesh);
  if (postGeos.length) { const pm = new THREE.Mesh(mergeG(postGeos), worldMat); pm.frustumCulled = false; scene.add(pm); postMesh = pm; }
}
function buildGates() {
  const fm = SW.BRANDS.gate.meta ? SW.BRANDS.gate.meta.face : GATE_META && scaleFace(GATE_META.face); if (!fm || !SW.LOGO) return;
  const tex = SW.texOf(SW.brandFaceCanvas('gate', fm.w, fm.h));
  try { for (const b of SW.BOARDS || []) { const fm = b.meta && b.meta.face; if (!fm || !K.distanceFaceCanvas) continue; const g2 = SW.facePlane(null, fm.w, fm.h, b.s, b.u, b.yaw + Math.PI, fm.cy, fm.z), m2 = K.createWorldMaterial(THREE, U); m2.map = SW.texOf(b.face && b.face.canvas ? b.face.canvas : K.distanceFaceCanvas(b.d).canvas); m2.polygonOffset = true; m2.polygonOffsetFactor = -1; m2.polygonOffsetUnits = -4; m2.customProgramCacheKey = () => 'kitworld-brand'; scene.add(new THREE.Mesh(g2, m2)); }
    const bb = SW.BRANDS.billboard, fb = bb && bb.meta && bb.meta.face; if (fb) { const g3 = SW.facePlane(null, fb.w, fb.h, bb.s, bb.u, bb.yaw + Math.PI, fb.cy, fb.z), m3 = K.createWorldMaterial(THREE, U); m3.map = SW.texOf(SW.brandFaceCanvas('billboard', fb.w, fb.h)); m3.polygonOffset = true; m3.polygonOffsetFactor = -1; m3.polygonOffsetUnits = -4; m3.customProgramCacheKey = () => 'kitworld-brand'; scene.add(new THREE.Mesh(g3, m3)); } } catch (e) { console.warn('backs', e && e.message); }
  for (const [k, yw] of [[0, Math.PI], [1, Math.PI], [0, 0], [1, 0], [2, 0]]) { const s2 = ws(CONFIG.gateS[k]), geo = SW.facePlane(null, fm.w, fm.h, s2, 0, yw, fm.cy, fm.z); const m = K.createWorldMaterial(THREE, U); m.map = tex; m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -4; m.customProgramCacheKey = () => 'kitworld-brand'; const me = new THREE.Mesh(geo, m); me.userData = { s: s2, kind: 'gate' }; scene.add(me); gateDyn.push(me); }
}
/* ---------------------------------------------------------------- the ute (the style world's rig), fittings and gear */
let UTE = null, glassFn = null, SET = 'stylised', SET_DIR = 'models/lowpoly/stylised/';
const PROD_FILE = { divider: 'bed-divider', slide: 'tub-slide', rollM: 'roll-cover', rollE: 'roll-cover', bars: 'cargo-bars', rack: 'tub-rack-accessory', ladder: 'ladder-rack', adventure: 'tub-rack-adventure' };
const PRODS = {}, PRODP = {};
function useStyleUte() {
  const A = SW.UTEDATA.alt[SW.look] || null; SET = SW.look || SET; SET_DIR = 'models/lowpoly/' + SET + '/';
  UTE = { root: SW.ute, inner: SW.chassis, tilt: SW.ute, A, axles: A ? A.axles : SW.UTEDATA.axles, wheelR: 0.384 };
  if (UTE.axles && UTE.axles.length) UTE.wheelR = UTE.axles[0].y0;
}
const blobTex = () => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 4, 32, 32, 31); gr.addColorStop(0, 'rgba(40,24,48,0.7)'); gr.addColorStop(0.6, 'rgba(40,24,48,0.35)'); gr.addColorStop(1, 'rgba(40,24,48,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
async function loadProducts() {
  const ids = Object.keys(PROD_FILE); if (!glassFn) try { const gm = await import('models/lowpoly/glass.js'); if (gm.patchGlass) glassFn = null; } catch (e) { glassFn = null; }
  await Promise.all(ids.map(async id => {
    const file = PROD_FILE[id]; if (!PRODP[file]) PRODP[file] = UT.loadProduct(loadGLB, SET_DIR + file + '.glb', glassFn);
    try { const base = await PRODP[file]; PRODS[id] = makeFit(id, base); } catch (e) { console.warn('product', id, e); }
  }));
}
/* a fitted product: the full group in the ute's model space (one per product id; the two covers share the model), plus its assembly
   chunks (3-5 pieces split along the long axis, lowest first) and a blueprint ghost for the build shot */
const ghostMat = new THREE.MeshBasicMaterial({ color: 0xffc600, transparent: true, opacity: 0.28, depthWrite: false, toneMapped: false });
function makeFit(id, base) {
  const P = { id, base, grp: base.grp, chunks: [], ghost: new THREE.Group(), fitted: false };
  if (!base.mixer) {
    const src = base.parts.filter(m => m.isMesh), axis = base.size.x >= base.size.z ? 'x' : 'z', n = clamp(Math.round(Math.max(base.size.x, base.size.z) / 0.45), 3, 5);
    const lo = base.box.min[axis], span = Math.max(1e-3, base.box.max[axis] - lo);
    const bins = Array.from({ length: n }, () => new Map());
    for (const m of src) { const g = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry, p = g.attributes.position;
      for (let t = 0; t < p.count; t += 3) { const c = (p.getComponent(t, axis === 'x' ? 0 : 2) + p.getComponent(t + 1, axis === 'x' ? 0 : 2) + p.getComponent(t + 2, axis === 'x' ? 0 : 2)) / 3, b = clamp(Math.floor((c - lo) / span * n), 0, n - 1);
        if (!bins[b].has(m.material)) bins[b].set(m.material, []); bins[b].get(m.material).push(t); }
      for (let b = 0; b < n; b++) { const tl = bins[b].get(m.material); if (!tl) continue; const ng = new THREE.BufferGeometry(); for (const name of Object.keys(g.attributes)) { const a = g.attributes[name], sz = a.itemSize, arr = new Float32Array(tl.length * 3 * sz); tl.forEach((t, j) => { for (let q = 0; q < 3; q++) for (let c = 0; c < sz; c++) arr[(j * 3 + q) * sz + c] = a.getComponent(t + q, c); }); ng.setAttribute(name, new THREE.BufferAttribute(arr, sz)); } ng.computeBoundingSphere(); bins[b].set(m.material, ng); } }
    for (let b = 0; b < n; b++) { const cg = new THREE.Group(); for (const [mat, g] of bins[b]) { if (!g.isBufferGeometry) continue; cg.add(new THREE.Mesh(g, mat)); } cg.visible = false; P.chunks.push(cg); }
    for (const m of src) P.ghost.add(new THREE.Mesh(m.geometry, ghostMat));
  } else for (const m of base.parts) P.ghost.add(new THREE.Mesh(m.geometry, ghostMat));
  P.ghost.visible = false;
  return P;
}
let fitRoot = null, coverGrp = null;
function attachProducts() {
  fitRoot = new THREE.Group(); UTE.inner.add(fitRoot);
  for (const id in PRODS) { const P = PRODS[id]; if (P.base.mixer) { if (!coverGrp) { coverGrp = P.base.grp; coverGrp.visible = false; fitRoot.add(coverGrp); } P.grp = coverGrp; } else { P.whole = P.base.grp.clone(); P.whole.visible = false; fitRoot.add(P.whole); } for (const c of P.chunks) fitRoot.add(c); fitRoot.add(P.ghost); }
}
/* gear: one instanced mesh per type (road, flying, in the tub, lost), real size; one instanced ring for the road pieces */
const GEAR = [], MAXI = [64, 64, 64, 64, 8, 8, 8, 12, 12, 12, 24, 24, 8, 8, 8, 8];
let ringIM = null, gearShadowIM = null;
async function loadGearSet() {
  const g = await UT.loadGear(loadGLB, SET_DIR), ids = GT.map(t => t.id);
  /* the kit's own material for the gear, as the style test's pickups (no extra gain or rim): the palette colours land as picked */
  const mat = K.createWorldMaterial(THREE, U); mat.customProgramCacheKey = () => 'kitworld-gear';
  /* instanced: the haze and mask position must include the instance matrix (else every piece hazes as if at the world origin) */
  { const kit = mat.onBeforeCompile; mat.onBeforeCompile = (sh, r) => { kit(sh, r); sh.vertexShader = sh.vertexShader.replace('vKW = (modelMatrix * vec4(transformed, 1.0)).xyz;', 'vKW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;'); }; }
  ids.forEach((id, t) => {
    let geo = ['swag', 'esky', 'jerry', 'wood'].includes(id) && K.swag ? UT.kitGear(THREE, id) : g[id]; if (!geo) geo = UT.bigGear(THREE, id);
    if (!geo.attributes.color) { const n = geo.attributes.position.count, a = new Float32Array(n * 3), c = new THREE.Color(GT[t].col).convertSRGBToLinear(); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } geo.setAttribute('color', new THREE.BufferAttribute(a, 3)); }
    geo.computeBoundingBox(); const b = geo.boundingBox, size = b.getSize(new THREE.Vector3());
    const im = new THREE.InstancedMesh(geo, mat, MAXI[t]); im.count = 0; im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAXI[t] * 3).fill(1), 3); im.instanceColor.setUsage(THREE.DynamicDrawUsage);
    scene.add(im); GEAR[t] = { im, size, n: 0 };
  });
  /* the one indicator: a calm glowing ground ring (brand yellow), additive, slow breathing */
  const rg = new THREE.RingGeometry(0.56, 0.74, 40).rotateX(-Math.PI / 2), rm = new THREE.ShaderMaterial({ uniforms: { uT: U.uTime, uCol: { value: YEL.clone() } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; vec4 p = vec4(position, 1.0);\n#ifdef USE_INSTANCING\np = instanceMatrix * p;\n#endif\ngl_Position = projectionMatrix * modelViewMatrix * p; }',
    fragmentShader: 'uniform float uT; uniform vec3 uCol; varying vec2 vUv; void main(){ float k = 0.72 + 0.18 * sin(uT * 2.4); gl_FragColor = vec4(uCol * k * 0.9, 1.0); }' });
  ringIM = new THREE.InstancedMesh(rg, rm, 96); ringIM.count = 0; ringIM.frustumCulled = false; ringIM.renderOrder = 3; scene.add(ringIM);
  const sg = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2); gearShadowIM = new THREE.InstancedMesh(sg, new THREE.MeshBasicMaterial({ map: blobTex(), transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }), 96); gearShadowIM.count = 0; gearShadowIM.frustumCulled = false; gearShadowIM.renderOrder = 2; scene.add(gearShadowIM);
}

/* ---------------------------------------------------------------- effects: ground FX (dust, pebbles, tracks), burst, dust ring, sweep, god rays, secure line */
let flash = null, gfx = null, rays = null, burstM = null, dustRing = null, secBand = null, strapG = null, sweep = null, speedEl = null, bonusG = [];
function buildFX() {
  gfx = SW.fx;
  const soft = (rgb, a0) => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, `rgba(${rgb},${a0})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };
  burstM = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft('255,214,90', 0.9), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); burstM.visible = false; burstM.renderOrder = 7; scene.add(burstM);
  dustRing = new THREE.Mesh(new THREE.RingGeometry(0.6, 1.0, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xe8c89a, transparent: true, opacity: 0, depthWrite: false })); dustRing.visible = false; scene.add(dustRing);
  /* the secure line: a thin brand-yellow band round the load at the secured height; the strap flash on banking */
  /* the safe zone: an outlined brand-yellow volume from the tub floor up to the secured level (scaled in y each frame), a faint fill */
  secBand = new THREE.Group(); const zb = new THREE.BoxGeometry(1.24, 1, 1.5).translate(0, 0.5, 0);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(zb), new THREE.LineBasicMaterial({ color: 0xFFC600, transparent: true, opacity: 0.95, depthWrite: false, toneMapped: false }));
  const fill = new THREE.Mesh(zb, new THREE.MeshBasicMaterial({ color: 0xFFC600, transparent: true, opacity: 0.04, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  const top = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 1.5).rotateX(-Math.PI / 2).translate(0, 1, 0), new THREE.MeshBasicMaterial({ color: 0xFFC600, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  secBand.add(fill, edges, top); secBand.position.set(0, TUB.floor + 0.005, -1.785); secBand.scale.y = 0.001; secBand.renderOrder = 4; secBand.visible = false; secBand.userData = { edges, fill, top };
  strapG = new THREE.Group(); const sm = new THREE.MeshBasicMaterial({ color: 0xFFC600, toneMapped: false }); for (const z of [-1.4, -2.2]) strapG.add(new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.03, 0.09).translate(0, 0, z), sm)); for (const z of [-1.4, -2.2]) for (const x of [-0.62, 0.62]) strapG.add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.5, 0.09).translate(x, -0.25, z), sm));
  strapG.visible = false;
  sweep = new THREE.Mesh(new THREE.PlaneGeometry(2, 1), new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false })); sweep.visible = false;
  flash = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.5, 1.7).translate(0, TUB.rail + 0.1, -1.78), new THREE.MeshBasicMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); flash.visible = false;
  UTE.inner.add(secBand, strapG, sweep, flash);
  /* bonus gates (a translucent brand-yellow frame with its label) */
  const P = {};
  for (const b of L.BG) {
    const g = new THREE.Group(), tex = canvasTex(256, 96, c => { c.fillStyle = '#000'; c.fillRect(0, 0, 256, 96); c.fillStyle = '#FFC600'; c.font = '700 56px Oswald, Impact, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(b.kind === '+3' ? '+3' : 'x2', 128, 50); });
    const pm = new THREE.MeshBasicMaterial({ color: 0xFFC600, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(b.half * 2, 1.5).translate(0, 0.75, 0), pm));
    const pf = new K.Facets(); for (const x of [-b.half, b.half]) K.bevelBox(pf, [x, 0.95, 0], 0.09, 1.9, 0.09, 0.015, () => K.C.black, [1, 0, 0, 0]); g.add(new THREE.Mesh(K.toGeometry(THREE, pf), worldMat));
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.5), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false })); lab.position.y = 2.2; g.add(lab);
    W.pos(b.s, b.u, P); g.position.set(P.x, L.groundH(b.s, b.u), P.z); g.rotation.y = P.th; g.userData = { pm, b, i: bonusG.length }; scene.add(g); bonusG.push(g);
  }
  /* speed lines removed (owner 02:31 IST) */
}

/* ---------------------------------------------------------------- loading: the style world attaches, the game builds on it */
let attachDone = null, attachRes = null; attachDone = new Promise(r => { attachRes = r; });
export async function attach(api) {
  SW = api; renderer = api.renderer; scene = api.scene; camera = api.camera; U = api.U; worldMat = api.worldMat; UT.setUniforms(U);
  gltf = new GLTFLoader(); MeshoptDecoder.useWorkers && MeshoptDecoder.useWorkers(2); gltf.setMeshoptDecoder(MeshoptDecoder);
  CONFIG.hold.goT = 0.001; CONFIG.hold.outT = 0.7;
  /* the gate stop (prototype): the ease starts from the ute's speed so the freeze completes with its nose under the arch */
  if (CONFIG.hold.nose != null) { CONFIG.holdAt = CONFIG.hold.nose - 0.3; CONFIG.hold.easeK = 0.1417; }
  if (Q.get('features') !== 'old') try { HOLES = patchTerrain(THREE, worldMat); } catch (e) { console.error('patchTerrain', e); HOLES = null; }
  UIB.setTier(SW.TIER); useStyleUte(); await loadGearSet(); newLayout(); buildGates(); buildFX(); stashInit();
  for (let i = 0; i < NP; i++) IP[i] = POSE[i]; poseUte(0);
  window.__game = { ready: true, tier: SW.TIER, set: SET, aa: SW.AA, loadMs: Math.round(performance.now()), frames: 0, errors: [] };
  loadProducts().then(() => { attachProducts(); return warmProducts(); }).then(() => prewarm()).catch(e => { console.error(e); window.__game.errors.push('products: ' + e.message); });
  if (Q.has('validate')) import('./w2check.js').then(C => { const ch = SW.chunkMeshes.map((m, i) => ({ P: m.geometry.attributes.position.array, Tr: m.geometry.attributes.aTrk.array, nT: TERR_N[i], nD: DRESS_N[i] == null ? 1e9 : DRESS_N[i], s0: m.userData.s0 })); const items = PUTS.filter(it => { const sz = it.part.size || null; let y1 = 0; if (!sz) { for (let k = 1; k < it.part.P.length; k += 3) y1 = Math.max(y1, it.part.P[k]); } else y1 = sz[1]; it.h = y1 * (it.sc || 1); return true; }); window.__validate = C.check({ chunks: ch, far: { P: SW.farMesh.geometry.attributes.position.array }, plan: { byChunk: [items] } });
    /* the BUILT scene: rays straight down onto the rendered road every metre; the first hit must be the road the wheels ride on */
    const rc = new THREE.Raycaster(), dn = new THREE.Vector3(0, -1, 0), o = new THREE.Vector3(), bad = [], CH0 = SW.chunkMeshes[0].userData.s0;
    for (let ss = 0; ss < CONFIG.campS + 10; ss += 1) for (const uu of [-3.6, -1.8, 0, 1.8, 3.6]) { const p0 = W.pos(ss, uu, {}), g = L.groundH(ss, uu), ci = Math.floor((ss - CH0) / 40), ms = [SW.chunkMeshes[ci - 1], SW.chunkMeshes[ci], SW.chunkMeshes[ci + 1]].filter(Boolean);
      o.set(p0.x, g + 40, p0.z); rc.set(o, dn); rc.far = 80; const hits = rc.intersectObjects(ms, false).filter(h => { if (h.point.y > g + 4.2) return false; const mi = SW.chunkMeshes.indexOf(h.object); return !(DRESS_N[mi] != null && h.face && h.face.a >= DRESS_N[mi]); }); const h = hits[0]; const y = h ? h.point.y : -999; if (Math.abs(y - g) > 0.05) bad.push([ss, uu, +(y - g).toFixed(2), h ? SW.chunkMeshes.indexOf(h.object) : -1, h && h.face ? (h.face.a < TERR_N[SW.chunkMeshes.indexOf(h.object)] ? 'terrain' : 'prop') : 'none']); }
    window.__validate.roadRays = { bad: bad.length, list: bad.slice(0, 40) }; if (bad.length) window.__validate.ok = false; });
  attachRes();
}
export async function load() { await attachDone; }
async function prewarm() {
  const t0 = performance.now(), p0 = renderer.info.programs ? renderer.info.programs.length : 0, vis = [];
  const show = o => { if (o) o.traverse(c => { if (!c.visible) { vis.push(c); c.visible = true; } }); };
  const hold = new THREE.Group(); hold.position.copy(UTE.root.position);
  for (const id in PRODS) { const P = PRODS[id]; for (const c of P.chunks) { const k = c.clone(); k.visible = true; hold.add(k); } const g = P.ghost.clone(); g.visible = true; hold.add(g); }
  if (STH) show(STH.group); if (RF) show(RF.group); for (const G of GEAR) if (G) show(G.im); show(fitRoot); if (ringIM) show(ringIM); if (gearShadowIM) show(gearShadowIM);
  scene.add(hold);
  try { await renderer.compileAsync(scene, camera); } catch (e) { /* ignore */ }
  scene.remove(hold); for (const c of vis) c.visible = false;
  try { if (!SW.LOW) { const id = Object.keys(PRODS)[0]; if (id) turntables([{ id, x: 0, y: 0, w: 2, h: 2, sel: false, dim: false, op: 1 }], 0); if (ttScene) { for (const k in ttObjs) if (ttObjs[k]) ttObjs[k].visible = true; await renderer.compileAsync(ttScene, ttCam); } } } catch (e) { console.warn('prewarm turntables', e && e.message); }
  console.info('shader prewarm: ' + p0 + ' -> ' + (renderer.info.programs ? renderer.info.programs.length : '?') + ' programs in ' + Math.round(performance.now() - t0) + ' ms');
}
async function warmProducts() {
  const hold = new THREE.Group(); for (const id in PRODS) { const P = PRODS[id]; if (P.whole) hold.add(P.whole.clone()); }
  hold.position.copy(UTE.root.position); scene.add(hold);
  try { await renderer.compileAsync(hold, camera, scene); } catch (e) { /* ignore */ } scene.remove(hold);
}

/* ---------------------------------------------------------------- per frame */
const IP = new Float64Array(NP), V1 = new THREE.Vector3(), V2 = new THREE.Vector3(), V3 = new THREE.Vector3(), V4 = new THREE.Vector3(), M4 = new THREE.Matrix4(), QQ = new THREE.Quaternion(), EU = new THREE.Euler(0, 0, 0, 'YXZ'), SC = new THREE.Vector3(1, 1, 1), PT = { x: 0, z: 0, th: 0 }, PO = {};
let lastT = 0, builtFor = -1, frames = 0, lastLay = null;
function poseUte() {
  const R = UTE.root; R.position.set(IP[PX], IP[PBY], IP[PZ]); R.rotation.set(-IP[PPITCH], uteYaw(), IP[PROLL]); R.position.y -= TYRE_SINK; SW.chassis.position.y = -fitDip(); if (Math.abs(SWV.roll) > 1e-4) { R.rotation.z += SWV.roll; SWV.roll *= Math.exp(-frameDt / 0.18); } if (coreMode === 'play' && RFC.rough > 0 && !L.S.hold && !L.S.done) { const t9 = U.uTime.value; R.position.y += RFC.rough * (0.014 * Math.sin(t9 * 87) + 0.008 * Math.sin(t9 * 131 + 1.7)); R.rotation.x += RFC.rough * 0.006 * Math.sin(t9 * 73 + 0.4); R.rotation.z += RFC.rough * 0.007 * Math.sin(t9 * 97 + 2.1); } parkPose(R); SW.chassis.position.set(0, 0, 0); SW.chassis.rotation.set(0, 0, 0);
  /* each axle pair sits on the ground under its two wheels, whatever the body pitch (axle centre = tyre radius above the contact) */
  const rx = -IP[PPITCH], cr = Math.cos(rx), sr = Math.sin(rx);
  const kL = WHX[0] > 0 ? 0 : 1, rL = WHX[2] > 0 ? 2 : 3;
  for (const a of UTE.axles || []) { const front = a.z > 0, own = a.steer && a.x != null, hw = own ? IP[PW0 + (a.x > 0 ? kL : 1 - kL)] : front ? (IP[PW0] + IP[PW0 + 1]) / 2 : (IP[PW0 + 2] + IP[PW0 + 3]) / 2, want = hw + a.y0 - IP[PBY]; a.axle.position.y = (want + a.z * sr) / Math.max(0.5, cr); a.spin.rotation.x = IP[PSPIN] * KS;
    if (!front && !a.steer && coreMode === 'play') a.axle.rotation.z = Math.atan2(IP[PW0 + rL] - IP[PW0 + 5 - rL], 1.68) - IP[PROLL]; else if (!front && !a.steer) a.axle.rotation.z = 0; }
  arriveAxles(); steerAndLights();
  R.updateMatrixWorld(true); tyrePatches();
  const th = L.trailAt(IP[PS], 0, PT).th; SW.rig.s = ws(IP[PS]); SW.rig.u = IP[PU]; SW.rig.th = IP[PYAW]; SW.rig.y = coreMode === 'attract' ? IP[PBY] : baseW(ws(IP[PS]), IP[PU]); if (ARR.on) { const tt = TR.toTrack(R.position.x, R.position.z); SW.rig.s = tt[0]; SW.rig.u = tt[1]; SW.rig.th = ARR.yaw; SW.rig.y = R.position.y; }
  SW.UU.uUteF.value.set(ws(IP[PS]), R.position.x, R.position.z, th); UT.UU.uUteF.value.set(ws(IP[PS]), R.position.x, R.position.z, th);
  SW.blob.position.set(R.position.x, (ARR.on ? ARR.gy : IP[PBASE]) + 0.03, R.position.z); SW.blob.rotation.set(-L.S.veh.gPitch * (1 - PARK.k), R.rotation.y, L.S.veh.gRoll * (1 - PARK.k));
  const cast = SW.cast, cb = SW.castBox;
  if (cast) cast.visible = !!cast.userData.on && !(PARK.k > 0);
  if (cast && cast.visible) { const sd = U.uSunDir.value, c = Math.cos(IP[PYAW]), sn = Math.sin(IP[PYAW]), d = cb.d;
    if (SW.UTEDATA.alt[SW.look] && cb.look !== SW.look) SW.buildCast(SW.look);
    if (cb.d && cb.tex) SW.placeCast(IP[PX], IP[PBASE], IP[PZ], IP[PYAW]); }
}
/* the drawn yaw: the rules aim the body by lateral over RULE forward speed; the world passes at KS of that, so the body turns by lateral
   over WORLD forward speed (capped 18 degrees, eased over about 0.15 s), so the ute always points where it travels */
const YW = { off: 0, t: -1 };
function uteYaw() {
  const V = L.S.veh; if (V.yawOff == null || L.S.done) { YW.t = -1; return IP[PYAW]; }
  const fw = Math.max(4, L.S.v) * KS, tgt = -clamp(Math.atan2(V.uvL || 0, fw), -0.314, 0.314), rt = L.S.rt, dt = YW.t < 0 ? 1 : clamp(rt - YW.t, 0, 0.1); YW.t = rt;
  YW.off += (tgt - YW.off) * (1 - Math.exp(-dt / 0.05)); return IP[PYAW] - V.yawOff + YW.off;
}
/* the product thump: a short suspension dip as the build snaps home (prototype beat) */
function fitDip() {
  const s = L.S, FS = CONFIG.hold.fitSnap; let d = 0;
  for (let j = 0; j < 3; j++) if (s.fitAt[j] >= 0) { const e = s.rt - s.fitAt[j] - FS; if (e >= 0 && e < 0.35) d = Math.max(d, 0.07 * Math.sin(Math.PI * e / 0.35) * (1 - e / 0.35)); }
  return d;
}
/* camp finale: the ute leaves the road and parks on the kit's camp pad by the fire (the kit's camp composition) */
const PARK = { k: 0, have: false };
const CAMP_W = { s: 918, u: -1.5 }, PAD = { s: 905, u: 0.4 };
function parkInit() {
  if (PARK.have) return; const a = TR.world(PAD.s, PAD.u, {}), f = TR.world(CAMP_W.s - 1, CAMP_W.u + 1, {});
  PARK.x = a.x; PARK.z = a.z; PARK.gy = baseW(PAD.s, PAD.u); PARK.fx = f.x; PARK.fz = f.z; PARK.fy = baseW(CAMP_W.s - 1, CAMP_W.u + 1); PARK.yaw = a.th;
  const c0 = TR.world(CAMP_W.s - 14, CAMP_W.u + 9, {}), c1 = TR.world(CAMP_W.s + 1, CAMP_W.u - 1, {}), dl = Math.hypot(c1.x - c0.x, c1.z - c0.z); PARK.dx = (c1.x - c0.x) / dl; PARK.dz = (c1.z - c0.z) / dl;
  { const q = TR.world(PAD.s, PAD.u + 1, {}); PARK.side = -(Math.sign((q.x - a.x) * Math.cos(PARK.yaw) - (q.z - a.z) * Math.sin(PARK.yaw)) || 1); }
  PARK.have = true;
}
const wrapA2 = a => Math.atan2(Math.sin(a), Math.cos(a));
const ARR = { on: false, T: 3, Lp: 0, v0: 0, P: null, tab: null, dy: 0, gy: 0, spin0: 0, d: 0, v: 0, yaw: 0, prevV: 0, dip: 0 };
function arrInit(R) {
  parkInit(); const x0 = R.position.x, z0 = R.position.z, h0 = IP[PYAW], h3 = PARK.yaw, ch = Math.hypot(PARK.x - x0, PARK.z - z0), a = Math.max(3, ch * 0.42);
  ARR.P = [[x0, z0], [x0 + Math.sin(h0) * a, z0 + Math.cos(h0) * a], [PARK.x - Math.sin(h3) * a * 0.75, PARK.z - Math.cos(h3) * a * 0.75], [PARK.x, PARK.z]];
  const N = 96, tab = new Float32Array(N + 1); let px = x0, pz = z0; for (let q = 1; q <= N; q++) { const p = bez(q / N); tab[q] = tab[q - 1] + Math.hypot(p[0] - px, p[1] - pz); px = p[0]; pz = p[1]; }
  ARR.tab = tab; ARR.Lp = tab[N]; ARR.v0 = Math.max(1.5, L.S.v * KS); ARR.T = clamp(2 * ARR.Lp / ARR.v0, 2.5, 3.5); if (ARR.v0 * ARR.T > 3 * ARR.Lp) ARR.v0 = 3 * ARR.Lp / ARR.T;
  ARR.dy = R.position.y - L.groundH(IP[PS], IP[PU]); ARR.spin0 = IP[PSPIN] * KS; ARR.on = true; ARR.prevV = ARR.v0; ARR.dip = 0;
  if (Q.has('arrivecheck')) sweepCheck();
  const n = L.S.pile.length + L.S.deck.length; tallyStep = n ? Math.min(0.09, 1.4 / n) : 0.06; TALLY_T0 = ARR.T + 0.8; ARR.endAt = TALLY_T0 + n * tallyStep + 1.6; { const td = stTallyDur(); if (td >= 0) ARR.endAt = TALLY_T0 + td + 1.6; }
}
function sweepCheck() {
  const UX = 1.0, ZF = 2.65, ZB = -2.8, MG = 0.5, pts = [];
  SW.chunkMeshes.forEach((m, ci) => { const s0 = m.userData.s0; if (s0 > PAD.s + 30 || s0 + 40 < PAD.s - 30) return; const P = m.geometry.attributes.position.array, n0 = TERR_N[ci] || 0;
    for (let q = n0; q < P.length / 3; q += 2) { const x = P[q * 3], y = P[q * 3 + 1], z = P[q * 3 + 2]; if (Math.hypot(x - PARK.x, z - PARK.z) > 26) continue; const g = gAt(x, z); if (y - g < 0.08) continue; pts.push(x, y - g, z); } });
  let minC = 99, at = null; const poses = [];
  for (let d = 0; d <= ARR.Lp + 1e-6; d += 0.25) { const t = bezAt(Math.min(d, ARR.Lp)), p = bez(t), p2 = bez(Math.min(1, t + 0.01)), p1 = bez(Math.max(0, t - 0.01)), yaw = Math.atan2(p2[0] - p1[0], p2[1] - p1[1]), c = Math.cos(yaw), sn = Math.sin(yaw); poses.push([p[0], p[1], yaw]);
    for (let k = 0; k < pts.length; k += 3) { const dx = pts[k] - p[0], dz = pts[k + 2] - p[1], lx = dx * c - dz * sn, lz = dx * sn + dz * c;
      const ox = Math.abs(lx) - UX, oz = lz > 0 ? lz - ZF : ZB - lz, dist = ox > 0 && oz > 0 ? Math.hypot(ox, oz) : Math.max(ox, oz); if (dist < minC) { minC = dist; at = [+d.toFixed(2), +pts[k].toFixed(2), +pts[k + 2].toFixed(2), +pts[k + 1].toFixed(2)]; } } }
  /* top-down debug image: props grey, the path yellow, the ute's footprint every metre, the parked one red */
  const S = 16, W2 = 640, cv = document.createElement('canvas'); cv.width = cv.height = W2; const x2 = cv.getContext('2d'), cx = PARK.x, cz = PARK.z, X = x => W2 / 2 + (x - cx) * S, Z = z => W2 / 2 - (z - cz) * S;
  x2.fillStyle = '#20180f'; x2.fillRect(0, 0, W2, W2); x2.fillStyle = '#9a9a9a'; for (let k = 0; k < pts.length; k += 3) x2.fillRect(X(pts[k]) - 1, Z(pts[k + 2]) - 1, 2, 2);
  const box = (px, pz, yaw, col) => { const c = Math.cos(yaw), sn = Math.sin(yaw), cs = [[UX, ZF], [-UX, ZF], [-UX, ZB], [UX, ZB]].map(([a, b]) => [px + a * c + b * sn, pz - a * sn + b * c]); x2.strokeStyle = col; x2.beginPath(); cs.forEach((q, i) => i ? x2.lineTo(X(q[0]), Z(q[1])) : x2.moveTo(X(q[0]), Z(q[1]))); x2.closePath(); x2.stroke(); };
  poses.forEach((q, i) => { if (i % 4 === 0) box(q[0], q[1], q[2], '#ffc60088'); }); box(PARK.x, PARK.z, PARK.yaw, '#ff3030');
  x2.strokeStyle = '#ffc600'; x2.lineWidth = 2; x2.beginPath(); poses.forEach((q, i) => i ? x2.lineTo(X(q[0]), Z(q[1])) : x2.moveTo(X(q[0]), Z(q[1]))); x2.stroke();
  x2.fillStyle = '#fff'; x2.font = '14px sans-serif'; x2.fillText('min clearance ' + minC.toFixed(2) + ' m (margin 0.5 included: >= 0 passes)', 10, 20);
  window.__sweep = { minClear: +(minC - MG).toFixed(3), clearRaw: +minC.toFixed(3), at, pts: pts.length / 3, len: +ARR.Lp.toFixed(2), img: cv.toDataURL('image/png') };
}
function bez(t) { const P = ARR.P, u = 1 - t, a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t; return [a * P[0][0] + b * P[1][0] + c * P[2][0] + d * P[3][0], a * P[0][1] + b * P[1][1] + c * P[2][1] + d * P[3][1]]; }
function bezAt(dist) { const tab = ARR.tab, N = tab.length - 1; let lo = 0, hi = N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tab[m] < dist) lo = m; else hi = m; } const f = (dist - tab[lo]) / Math.max(1e-6, tab[hi] - tab[lo]); return (lo + f) / N; }
const gAt = (x, z) => { const tt = TR.toTrack(x, z); return baseW(tt[0], tt[1]); };
function parkPose(R) {
  PARK.k = 0; const s = L.S; if (!s.done || !s.reveal) { ARR.on = false; return; } const fe = finaleE(); if (fe < 0) return;
  if (!ARR.on) arrInit(R);
  const tau = clamp(fe / ARR.T, 0, 1), T = ARR.T, h00 = tau * tau * tau - 2 * tau * tau + tau, h01 = -2 * tau * tau * tau + 3 * tau * tau, d = h00 * ARR.v0 * T + h01 * ARR.Lp;
  const vNow = (3 * tau * tau - 4 * tau + 1) * ARR.v0 + (-6 * tau * tau + 6 * tau) * ARR.Lp / T; ARR.v = tau >= 1 ? 0 : vNow; ARR.d = Math.min(ARR.Lp, d); PARK.k = tau;
  const t = bezAt(ARR.d), p = bez(t), p2 = bez(Math.min(1, t + 0.01)), p1 = bez(Math.max(0, t - 0.01)), yaw = Math.atan2(p2[0] - p1[0], p2[1] - p1[1]);
  const wb = 3.2, fx = p[0] + Math.sin(yaw) * wb / 2, fz = p[1] + Math.cos(yaw) * wb / 2, rx = p[0] - Math.sin(yaw) * wb / 2, rz = p[1] - Math.cos(yaw) * wb / 2, yf = gAt(fx, fz), yr = gAt(rx, rz);
  /* the brake dip: the nose goes down with the deceleration and settles back as it stops */
  const dec = Math.max(0, (ARR.prevV - ARR.v) / Math.max(1e-3, frameDt)); ARR.prevV = ARR.v; ARR.dip += (clamp(dec / 3, 0, 1) * 0.018 * (tau < 1 ? 1 : 0) - ARR.dip) * Math.min(1, frameDt * 8);
  const tw = 0.82, cx2 = Math.cos(yaw), sx2 = Math.sin(yaw), yL = (gAt(fx + cx2 * tw, fz - sx2 * tw) + gAt(rx + cx2 * tw, rz - sx2 * tw)) / 2, yR = (gAt(fx - cx2 * tw, fz + sx2 * tw) + gAt(rx - cx2 * tw, rz + sx2 * tw)) / 2, yF = (gAt(fx + cx2 * tw, fz - sx2 * tw) + gAt(fx - cx2 * tw, fz + sx2 * tw)) / 2, yB = (gAt(rx + cx2 * tw, rz - sx2 * tw) + gAt(rx - cx2 * tw, rz + sx2 * tw)) / 2;
  ARR.gy = (yF + yB) / 2; ARR.yaw = yaw; R.position.set(p[0], ARR.gy + ARR.dy - TYRE_SINK, p[1]); R.rotation.set(clamp(-Math.atan2(yF - yB, wb), -0.052, 0.052) + ARR.dip, yaw, clamp(Math.atan2(yL - yR, 2 * tw), -0.052, 0.052)); void yf; void yr;
  { const t3 = bezAt(Math.min(ARR.Lp, ARR.d + 0.5)), q3 = bez(t3), q4 = bez(Math.min(1, t3 + 0.01)), y3 = Math.atan2(q4[0] - q3[0], q4[1] - q3[1]); ARR.steer = clamp(wrapA2(y3 - yaw) / 0.5 * 3.2 * 0.5, -0.45, 0.45) * (tau < 1 ? 1 : 0.4); ARR.brake = tau > 0.25 ? 1 : 0; }
}
/* during the drive-in each axle sits at its rest height over its own ground and the wheels turn at the ground speed */
function arriveAxles() {
  if (!ARR.on) return; const R = UTE.root;
  R.updateMatrixWorld(true); for (const a of UTE.axles || []) { a.axle.position.y = a.y0; a.spin.rotation.x = ARR.spin0 + ARR.d / UTE.wheelR; a.axle.updateMatrixWorld(true); let dsum = 0, nn = 0; for (const x of (a.steer ? [0] : [0.82, -0.82])) { V2.set(x, -UTE.wheelR, 0).applyMatrix4(a.axle.matrixWorld); dsum += gAt(V2.x, V2.z) - V2.y; nn++; } a.axle.position.y = a.y0 + clamp(dsum / nn, -0.15, 0.15); }
  if (Q.has('arrivecheck') && PARK.k < 1) { R.updateMatrixWorld(true); const st = (window.__arrive = window.__arrive || { frames: 0, maxErr: 0, vJump: null }); st.frames++;
    if (st.vJump == null) st.vJump = +(Math.abs(ARR.v0 - L.S.v * KS)).toFixed(3);
    for (const a of UTE.axles || []) for (const x of (a.steer ? [0] : [0.82, -0.82])) { V2.set(x, -UTE.wheelR, 0).applyMatrix4(a.axle.matrixWorld); const e = Math.abs(V2.y - gAt(V2.x, V2.z)); if (e > st.maxErr) { st.maxErr = +e.toFixed(4); st.at = +PARK.k.toFixed(2); } } }
}
if (Q.has('deckmeasure')) window.__deckMeasure = () => {
  const rc = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3(), inv = new THREE.Matrix4(), res = {}; fitRoot.updateMatrixWorld(true); inv.copy(fitRoot.matrixWorld).invert();
  for (const id in PRODS) { const P = PRODS[id], obj = P.whole || P.grp; if (!obj) continue; obj.updateMatrixWorld(true); const bands = [];
    for (let z = -0.4; z >= -3.1; z -= 0.04) { let n = 0, ytop = -9, x0 = 9, x1 = -9; for (let x = -0.92; x <= 0.92; x += 0.04) { o.set(x, 4, z).applyMatrix4(fitRoot.matrixWorld); d.set(0, -1, 0).transformDirection(fitRoot.matrixWorld); rc.set(o, d); const h = rc.intersectObject(obj, true)[0]; if (!h) continue; const lp = h.point.clone().applyMatrix4(inv); if (lp.y < 1.0) continue; n++; ytop = Math.max(ytop, lp.y); x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
      if (n) bands.push([+z.toFixed(2), n, +ytop.toFixed(3), +x0.toFixed(2), +x1.toFixed(2)]); }
    const segs = []; for (const bd of bands) { const sg = segs[segs.length - 1]; if (sg && Math.abs(sg.z1 - bd[0]) < 0.05 && Math.abs(sg.y - bd[2]) < 0.03) { sg.z1 = bd[0]; sg.n = Math.max(sg.n, bd[1]); sg.x0 = Math.min(sg.x0, bd[3]); sg.x1 = Math.max(sg.x1, bd[4]); sg.y = Math.max(sg.y, bd[2]); } else segs.push({ z0: bd[0], z1: bd[0], y: bd[2], n: bd[1], x0: bd[3], x1: bd[4] }); }
    res[id] = { box: P.base.box ? [P.base.box.min.toArray().map(v => +v.toFixed(3)), P.base.box.max.toArray().map(v => +v.toFixed(3))] : null, segs }; }
  return res;
};
let finLight = null, revealUi = false;
let tailMats = null, prevV = 0, brakeK = 0;
function steerAndLights() {
  const s = L.S; let st = 0;
  if (ARR.on) st = ARR.steer || 0; else if (!s.hold) st = clamp(YW.off * 1.8, -0.4, 0.4);
  for (const a of UTE.axles || []) if (a.steer) a.axle.rotation.y += (st - a.axle.rotation.y) * Math.min(1, frameDt * 10);
  if (!tailMats) { tailMats = []; UTE.root.traverse(o => { if (o.isMesh && o.material && o.material.name === 'glowT') tailMats.push(o.material); }); }
  const dv = (prevV - s.v) / Math.max(1e-3, frameDt); prevV = s.v; const want = ARR.on ? (ARR.brake ? 1 : 0) : s.hold || dv > 6 ? 1 : 0;
  brakeK += (want - brakeK) * Math.min(1, frameDt * 12); for (const m of tailMats) m.color.setScalar(1 + 1.6 * brakeK);
}
const GRID_S = 262; let gridIn = false;
function gridRattle(R) {
  const s = L.S, w = ws(IP[PS]), on = !s.hold && !s.done && Math.abs(w - GRID_S) < 1.7 && s.v > 2;
  if (on) { const t = performance.now() / 1000, k = Math.min(1, s.v / 12); R.position.y += 0.011 * k * Math.sin(t * 95) + 0.006 * k * Math.sin(t * 141 + 1.3); R.rotation.z += 0.006 * k * Math.sin(t * 77); SWAY.xv += (Math.random() - 0.5) * 0.06 * k; if (!gridIn) { AU.sfx('slat', 2); setTimeout(() => AU.sfx('slat', 5), 70); setTimeout(() => AU.sfx('slat', 3), 140); } }
  gridIn = on;
}
/* proof: every loss with the feature under the ute at that moment */
let lostPrev = 0;
function lossLog() {
  const s = L.S; if (s.lost < lostPrev) lostPrev = 0; if (s.lost === lostPrev) return; const d = s.lost - lostPrev; lostPrev = s.lost;
  const f = L.HZ.find(h => s.s > h.s0 - 3 && s.s < h.s1 + 3), st = (window.__losses = window.__losses || []);
  let rf = ''; if (RF) { const sw = ws(s.s); for (const ds of [0, -1.5, 1.5, -3, 3]) for (const du of [0, -0.82, 0.82]) { const q = RF.featureAt(sw + ds, s.u + du); if (q && !rf) rf = q.type; } }
  st.push({ s: +s.s.toFixed(1), u: +s.u.toFixed(2), n: d, feature: f ? f.type : '', rf, swerve: (s.lostBy && s.lostBy.swerve) || 0, hit: f ? !!(s.hzHit && s.hzHit[f.i]) : null });
}
export const finaleEnd = () => ARR.endAt || 0;
export const TYRE_SINK = 0.016;
function wheelCheck() {
  if (!Q.has('wheelcheck')) return; const st = (window.__wheels = window.__wheels || {}), k = shotName || 'chase', R = UTE.root; R.updateMatrixWorld(true); const e = st[k] = st[k] || { n: 0, min: 9, max: -9 };
  for (const a of UTE.axles || []) for (const x of (a.steer ? [0] : [0.82, -0.82])) { V2.set(x, -UTE.wheelR, 0).applyMatrix4(a.axle.matrixWorld); const gap = V2.y - gAt(V2.x, V2.z); e.n++; e.min = Math.min(e.min, +gap.toFixed(4)); e.max = Math.max(e.max, +gap.toFixed(4)); }
}
const ATT = { s: 140, spin: 0, t: -1, dip: 0, dipT: 0.5, rest: null }, ATT_S0 = 140, ATT_S1 = 250, ATT_V = 10;
function attractPose() {
  const now = performance.now() / 1000, dt = ATT.t < 0 ? 0 : Math.min(0.034, now - ATT.t); ATT.t = now;
  if (ATT.rest == null) ATT.rest = IP[PBY] - IP[PBASE];
  ATT.s += ATT_V * dt; ATT.spin += ATT_V * dt / UTE.wheelR; if (ATT.s > ATT_S1) { ATT.s = ATT_S0; ATT.dip = 0.5; ATT.dipT = 0.5; INV.prev = null; }
  let zf = 1.6, zr = -1.6; for (const a of UTE.axles || []) { zf = Math.max(zf === 1.6 ? -9 : zf, a.z); zr = Math.min(zr === -1.6 ? 9 : zr, a.z); } const wb = zf - zr, s = ATT.s, P0 = TR.world(s, 0, {}), yf = (baseW(s + zf, 0.82) + baseW(s + zf, -0.82)) / 2, yr = (baseW(s + zr, 0.82) + baseW(s + zr, -0.82)) / 2, yc = yr + (yf - yr) * (0 - zr) / wb;
  IP[PX] = P0.x; IP[PZ] = P0.z; IP[PYAW] = P0.th; IP[PS] = s - S0; IP[PU] = 0; IP[PBASE] = yc; IP[PBY] = yc + ATT.rest; IP[PPITCH] = Math.atan2(yf - yr, wb); IP[PROLL] = 0;
  IP[PW0] = baseW(s + zf, 0.82); IP[PW0 + 1] = baseW(s + zf, -0.82); IP[PW0 + 2] = baseW(s + zr, 0.82); IP[PW0 + 3] = baseW(s + zr, -0.82); IP[PSPIN] = ATT.spin;
}
/* the dip (loop and PLAY): the exposure goes down and back up, the UI above never changes */
function attractDip(dt) { if (ATT.dip <= 0) return 1; ATT.dip = Math.max(0, ATT.dip - dt); const q = 1 - ATT.dip / ATT.dipT; return 1 - 0.92 * Math.sin(Math.PI * q); }
/* the blur vignette over the canvas, under the UI */
let blurEls = null, blurKey = '', blurTop = null;
/* scaled with the viewport (owner): the far-corner blur is about 0.9% of the longer side (about 12-17 px on a desktop, 7 px on a phone);
   the sharp region is an ellipse hugging the ute (55% x 70% of the frame in landscape, 75% x 38% in portrait) with a falloff over a
   quarter of the frame; two layers (half and full radius) so there is no visible step; one layer on Low */
function blurFrame(on) {
  if (!blurEls) { const c = document.getElementById('c'); blurEls = [0, 1].slice(0, SW.LOW ? 1 : 2).map(() => { const d = document.createElement('div'); d.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:0;opacity:0;transition:opacity .3s'; c.parentNode.insertBefore(d, c.nextSibling); return d; }); }
  const land = VW > VH, L0 = Math.max(VW, VH), x = ((UTE_SCREEN.x + 1) / 2 * 100).toFixed(1), y = ((1 - UTE_SCREEN.y) / 2 * 100).toFixed(1);
  const sw = land ? 38 : 37.5, sh = land ? 38 : 19, fw = land ? 12 : 22, fh = land ? 12 : 20;
  /* owner: portrait and narrow viewports stay sharp edge to edge (no edge blur) */
  if (!land || VW < 700) on = false;
  const key = [on, VW, VH, x, y].join(',');
  if (key === blurKey) return; blurKey = key;
  /* the top band (desktop): blur only, strongest behind the logo row, sharp by about half way down (long eased falloff) */
  if (!blurTop) { blurTop = document.createElement('div'); blurTop.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:0;opacity:0;transition:opacity .3s'; blurEls[0].parentNode.insertBefore(blurTop, blurEls[0]); }
  blurTop.style.opacity = on ? '1' : '0'; if (on) { const tm = 'linear-gradient(180deg, #000 0%, #000 14%, rgba(0,0,0,.82) 18%, rgba(0,0,0,.55) 22%, rgba(0,0,0,.28) 27%, rgba(0,0,0,.09) 31%, transparent 34%)'; blurTop.style.backdropFilter = blurTop.style.webkitBackdropFilter = `blur(${(L0 * 0.0022 * (+(Q.get('blurk') || 1))).toFixed(1)}px)`; blurTop.style.maskImage = tm; blurTop.style.webkitMaskImage = tm; }
  blurEls.forEach((d, i) => { const o = on ? '1' : '0'; d.style.opacity = o; if (!on) return;
    const BK = +(Q.get('blurk') || 1), px = (L0 * (i === 0 && blurEls.length > 1 ? 0.0018 : 0.0035) * BK).toFixed(1), rx = sw + fw * (i === 0 ? 0.6 : 1), ry = sh + fh * (i === 0 ? 0.6 : 1), inner = Math.round(100 * Math.min(sw / rx, sh / ry) * (i === 0 ? 1 : 1.15));
    const m = `radial-gradient(ellipse ${rx.toFixed(1)}% ${ry.toFixed(1)}% at ${x}% ${y}%, transparent ${Math.min(90, inner)}%, #000 100%)`;
    d.style.backdropFilter = d.style.webkitBackdropFilter = `blur(${px}px)`; d.style.maskImage = m; d.style.webkitMaskImage = m; });
}
window.__tyres = () => { const rc = new THREE.Raycaster(), o = new THREE.Vector3(), dn = new THREE.Vector3(0, -1, 0), out = []; UTE.root.updateMatrixWorld(true);
  for (const a of UTE.axles || []) for (const x of (a.steer ? [0] : [0.82, -0.82])) { V2.set(x, -UTE.wheelR, 0).applyMatrix4(a.axle.matrixWorld); o.set(V2.x, V2.y + 3, V2.z); rc.set(o, dn); rc.far = 8; const h = rc.intersectObjects(SW.chunkMeshes, false)[0];
    out.push({ z: +a.z.toFixed(2), x, tyre: +V2.y.toFixed(4), analytic: +gAt(V2.x, V2.z).toFixed(4), mesh: h ? +h.point.y.toFixed(4) : null, wheelR: +UTE.wheelR.toFixed(4), y0: +a.y0.toFixed(4), axleY: +a.axle.position.y.toFixed(4) }); }
  const geo = (UTE.axles || []).map(a => { let ymin = 9, ymax = -9, zmin = 9, zmax = -9; for (const m of a.spin.children) { if (!m.geometry) continue; m.geometry.computeBoundingBox(); const bb = m.geometry.boundingBox; ymin = Math.min(ymin, bb.min.y); ymax = Math.max(ymax, bb.max.y); zmin = Math.min(zmin, bb.min.z); zmax = Math.max(zmax, bb.max.z); } return { z: +a.z.toFixed(2), ymin: +ymin.toFixed(4), ymax: +ymax.toFixed(4), zmin: +zmin.toFixed(4), zmax: +zmax.toFixed(4), spinY: +a.spin.position.y.toFixed(4) }; });
  return { mode: coreMode, shot: shotName, rest: IP[PBY] - IP[PBASE], wheels: out, geo, look: SW.look }; };
let patchIM = null;
function tyrePatches() {
  if (!patchIM) { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 4, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(0.6, 'rgba(0,0,0,0.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64);
    patchIM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }), 4); patchIM.frustumCulled = false; patchIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(patchIM); }
  let n = 0; const yaw = UTE.root.rotation.y; EU.set(0, yaw, 0); QQ.setFromEuler(EU);
  for (const a of UTE.axles || []) for (const x of (a.steer ? [0] : [0.82, -0.82])) { if (n >= 4) break; V2.set(x, -UTE.wheelR, 0).applyMatrix4(a.axle.matrixWorld); V3.set(V2.x, gAt(V2.x, V2.z) + 0.004, V2.z); SC.set(0.42, 1, 0.62); M4.compose(V3, QQ, SC); patchIM.setMatrixAt(n++, M4); }
  SC.set(1, 1, 1); patchIM.count = n; patchIM.instanceMatrix.needsUpdate = true;
}
const CAMC = { off: 0 };
const PORT = { w: +(Q.get('portw') || 3.84), span: 0.85, spanS: 0.83, cb: 0.42, ct: 0.24, D: 0, tp: 0, ls: 0, h: +(Q.get('porth') || 1.35), az: +(Q.get('portaz') || 0.45), cy: +(Q.get('portcy') || 0.52), cyS: +(Q.get('portcys') || 0.48), lx: +(Q.get('portlx') || -0.07) };
function camClear() {
  const p = camera.position; camera.getWorldDirection(V4); V4.y = 0; if (V4.lengthSq() > 1e-6) V4.normalize();
  let g = gAt(p.x, p.z); for (const d of [1, 2]) g = Math.max(g, gAt(p.x + V4.x * d, p.z + V4.z * d) - 0.25);
  const need = Math.min(0.8, Math.max(0, g + 0.66 - p.y)); CAMC.off = need > CAMC.off ? need : CAMC.off + (need - CAMC.off) * Math.min(1, frameDt * 3); if (Q.has('invariant')) { const st = (window.__inv = window.__inv || { maxLift: 0 }); st.maxLift = Math.max(st.maxLift, +need.toFixed(3)); }
  if (CAMC.off > 1e-4) { p.y += CAMC.off; camera.lookAt(lookPos); camera.rotateX(camDelta); camera.updateMatrixWorld(); }
  if (Q.has('camcheck')) { const st = (window.__camclear = window.__camclear || {}), k = shotName || 'chase', c = +(p.y - gAt(p.x, p.z)).toFixed(3); if (st[k] == null || c < st[k]) st[k] = c; }
}
const SWV = { roll: 0, side: 0 };
export function onSwerve(kind, d) {
  const side = (d && d.side) || 1; if (kind === 'warn') { SWAY.xv += 0.35 * side; AU.sfx('ratchet', 2); }
  if (kind === 'lost') { SWAY.xv += 0.6 * side; SWV.roll = 0.11 * side; AU.sfx('hit'); }
}
let STH = null;
/* the build shot holds until the cargo has landed plus a beat (stash author's fix a, 01:2x IST): CONFIG.hold.fitT per fit, from the
   module's fit duration; restored on every round */
const FIT_T0 = 2.0;
const STK = { known: [], S: null, rid: -1, cfg: '', fit: null, fitAt: -9, fitK: -1, tally: false, impN: -1, prot: -1, mode: '' };
const STW = {}; for (const t of GT) STW[t.id] = t.w;
const ST_INV = new THREE.Matrix4(), ST_P = new THREE.Vector3();
function stashInit() {
  if (Q.get('stash') === 'old') return;
  try {
    STH = createStash({ THREE, ute: UTE.inner, kit: Object.assign({}, K, { U }), camera, options: { worth: STW } });
    STH.on('onPack', () => AU.sfx('ratchet', 2)); STH.on('onMerge', () => AU.sfx('strap')); STH.on('onBurst', () => AU.sfx('slat', 1));
    STH.setSeeThrough({ enabled: true, camera, ahead: 14, opacity: 0.4, mode: 'blend' }); window.__stash3 = STH;
  } catch (e) { console.error('stash', e); STH = null; }
}
const stOnBoard = s => { const a = []; for (const i of s.packed || []) a.push(i); for (const i of s.pile) a.push(i); for (const i of s.deck) a.push(i); return a; };
const stCfgOf = s => { const c = ['none', 'none', 'none']; for (let j = 0; j < 3; j++) if (s.sel[j] && s.fitAt[j] >= 0 && !(s.hold && s.hold.k === j && s.hold.phase !== 'go' && STK.fitK !== j)) c[j] = s.sel[j]; return c; };
const stProt = s => L.isShut() ? stOnBoard(s).length : Math.min(s.secN, s.pile.length + (s.packed || []).length);
let stWarned = false;
function stashRebuild(why) {
  if (why && why !== 'round' && !stWarned) { stWarned = true; console.warn('stash: rebuilt mid-round (' + why + '), animations in flight reset'); window.__stashRebuilt = why; }
  const s = L.S, c = stCfgOf(s); STH.reset(); STH.configure({ tub: c[0], cover: c[1], top: c[2] }); STK.cfg = c.join(',');
  STK.known = stOnBoard(s); for (const i of STK.known) STH.add(GT[L.GP[i].type].id, 1, { instant: true });
  CONFIG.hold.fitT = FIT_T0; STK.prot = stProt(s); STH.setProtected(STK.prot); STK.fit = null; STK.fitAt = -9; STK.fitK = -1; STK.tally = false; STK.S = s; STK.rid = L.resetId; STK.impN = s.imp.n;
}
/* the game's build shot -> the module's fit time: [0, 0.25 s] -> [0, t0], [0.25 s, fitSnap] -> [t0, t1], then real time to the end */
function stFitT(e) {
  const F = STK.fit, D = F.duration, a = F.product.t0 * D, b = F.product.t1 * D, FS = CONFIG.hold.fitSnap;
  const t = e <= 0.25 ? a * Math.max(0, e) / 0.25 : e <= FS ? a + (b - a) * (e - 0.25) / (FS - 0.25) : b + (e - FS); return clamp(t / D, 0, 1);
}
function stashFrame(fdt) {
  if (!STH) return; const s = L.S;
  STH.group.visible = coreMode !== 'attract';
  if (coreMode === 'attract') { if (STK.mode !== 'attract') { STH.reset(); STK.known = []; STK.S = null; } STK.mode = coreMode; return; }
  STK.mode = coreMode;
  if (s !== STK.S || L.resetId !== STK.rid) stashRebuild('round');
  /* the build shot: begin the fit when the 'fit' phase opens, then drive it from the shot's time */
  const H = s.hold;
  if (H && H.phase === 'fit' && s.fitAt[H.k] >= 0 && STK.fitAt !== s.fitAt[H.k] && s.sel[H.k]) { STK.fitK = H.k; STK.fitAt = s.fitAt[H.k]; STK.fit = STH.beginFit(s.sel[H.k]); if (STK.fit) { { const ft = CONFIG.hold.fitSnap + STK.fit.duration * (1 - STK.fit.product.t1) + 0.2; CONFIG.hold.fitT = isFinite(ft) ? Math.min(3.5, Math.max(FIT_T0, ft)) : FIT_T0; } const c = STK.cfg.split(','); c[H.k] = s.sel[H.k]; STK.cfg = c.join(','); } }
  if (STK.fit) { const t = stFitT(s.rt - STK.fitAt); STK.fit.update(t); if (t >= 1) STK.fit = null; }
  if (!STK.fit && stCfgOf(s).join(',') !== STK.cfg) stashRebuild('cfg');
  /* pickups and losses by state */
  const now = stOnBoard(s), was = new Set(STK.known), here = new Set(now); let lost = 0;
  for (const i of STK.known) if (!here.has(i)) { if (L.GP[i].state === 'lost') lost++; else { stashRebuild('removal'); return; } }
  if (lost) { const got = STH.lose(lost); const LS = (window.__stashLoss = window.__stashLoss || { asked: 0, lost: 0, n: 0 }); LS.asked += lost; LS.lost += got; LS.n++; }
  ST_INV.copy(UTE.inner.matrixWorld).invert();
  for (const i of now) {
    if (was.has(i)) continue; const g = L.GP[i], T = GT[g.type];
    if (T.kind === 'small') { if (g.from) ST_P.set(g.from.x, g.from.y, g.from.z); else { W.pos(g.s, g.u, PO); ST_P.set(PO.x, L.groundH(g.s, g.u) + 0.15, PO.z); } ST_P.applyMatrix4(ST_INV);
      STH.add(T.id, 1, { from: { x: ST_P.x, y: ST_P.y, z: ST_P.z }, fromScale: 0.8 }); }
    else STH.add(T.id);
  }
  STK.known = now;
  const pr = stProt(s); if (pr !== STK.prot) { STK.prot = pr; STH.setProtected(pr); }
  /* camp: the module's tally (yellow wash per unit); the kit's count steps by each unit's worth */
  if (s.done && s.reveal && !STK.tally && finaleE() >= TALLY_T0) { STK.tally = true; STH.setSeeThrough({ enabled: false });
    /* the kit's count follows the module's steps scaled to the rules' total (the module's own count can differ by a few: units still
       forming at camp, absorbed big units), so the count lands on the HUD's number with the last unit */
    const S1 = STH.state(); let exp = 0; for (const u of S1.units) exp += u.kind === 'box' || u.kind === 'case' || u.kind === 'trunk' || u.kind === 'big' ? u.worth : 1; exp += S1.staged ? S1.staged.length : 0;
    const TS = (window.__stashTally = { steps: 0, sum: 0, shown: 0, total: L.S.total, expected: exp });
    STH.tally(st => { TS.steps++; TS.sum += st.value; const want = st.index >= st.count - 1 ? L.S.total : Math.min(L.S.total, Math.round(TS.sum * L.S.total / Math.max(1, exp))); const d = want - TS.shown; TS.shown = want;
      AU.sfx(st.value > 1 ? 'tallyBig' : 'tally', Math.round(17 * st.index / Math.max(1, st.count - 1))); if (d > 0) UIB.tallyPiece(d); }); }
  const bump = s.imp.n !== STK.impN ? clamp(1 + Math.hypot(s.imp.x, s.imp.z), 1, 3) : 0; STK.impN = s.imp.n;
  const live = !s.done && !s.hold;
  STH.update(fdt, { lat: live && s.veh ? s.veh.aLatF : 0, lon: live && s.veh ? s.veh.aLongF : 0, bump: s.done ? 0 : bump, speed: live ? s.v * KS : 0, stability: L.stability(), camera });
}
/* the finale's length from the module's tally (units, not pieces): n steps of clamp(1.8 / n, 0.07, 0.16) s */
function stTallyDur() { if (!STH) return -1; const st = STH.state(), n = st.units.length + (st.staged ? st.staged.length : 0), dt = clamp(1.8 / Math.max(1, n), 0.07, 0.16); return n * dt; }
/* */
const STPF = Q.has('stashproof') ? [] : null; let stpfF = 0;
function stashProof() {
  if (!STPF || !STH || coreMode !== 'play') return; if (++stpfF % 10) return;
  const st = STH.state(); window.__stashSamples = STPF; if (STPF.length < 4000) STPF.push({ f: stpfF, s: +L.S.s.toFixed(1), cfg: st.cfg, fit: st.fit, units: st.units.map(u => ({ kind: u.kind, fam: u.fam, prot: u.prot, moving: u.moving, box: u.box, sway: u.sway })), staged: st.staged, pieces: st.pieces, see: st.seeThrough.active, sway: st.sway });
}
let RF = null, HOLES = null;
const RFC = { cont: ['', '', '', ''], rough: 0 };
function rfH(sw, u) { if (!RF) return 0; const a = RF.heightAt(sw - 0.13, u), b = RF.heightAt(sw, u), c = RF.heightAt(sw + 0.13, u), m = Math.max(a, b, c); return m > 0.004 ? m : (a + b + c) / 3; }
/* built once in the attach (so its programs are in the world's compileAsync) and then per round on the first play frame (behind the
   PLAY dip): a rebuild at the attract's reset disposed materials while the world's compileAsync was still polling them (three's
   isReady on a freed program: the page never started, measured 01:2x IST) */
function rfBuild() {
  if (!HOLES || Q.get('features') === 'old') return; if (RF && coreMode !== 'play') { RFC.dirty = true; return; } RFC.dirty = false; const t0 = performance.now();
  if (RF) { scene.remove(RF.group); RF.dispose(); RF = null; }
  try { RF = createRoadFeatures({ THREE, kit: K, trail: TR, features: L.HZ, sOffset: S0, U, holes: HOLES, ground: (s, u) => baseW(s, u), gates: CONFIG.gateS.map(ws) }); scene.add(RF.group); RF.update(-1000); }
  catch (e) { console.error('road features', e); RF = null; }
  window.__rf = { ms: Math.round(performance.now() - t0), stats: RF ? RF.stats : null, n: L.HZ.length };
}
/* every frame: the draw window and the cuts at the ute (none in the attract), rough and contact at the four wheels */
function rfFrame() {
  if (RFC.dirty && coreMode === 'play') rfBuild();
  if (!RF) return; const att = coreMode === 'attract'; RF.group.visible = !att; RF.update(att ? -1000 : ws(IP[PS])); if (att) { RFC.rough = 0; return; }
  const s = L.S, sw = ws(IP[PS]); let rough = 0;
  for (let k = 0; k < 4; k++) { const ss = sw + WHZ[k], uu = IP[PU] - WHX[k]; rough = Math.max(rough, RF.roughAt(ss, uu)); const f = RF.featureAt(ss, uu), ty = f ? f.type : '';
    if (ty !== RFC.cont[k]) { RFC.cont[k] = ty; if (!s.hold && !s.done && s.v > 1 && (ty === 'rocks' || ty === 'log' || ty === 'pothole' || ty === 'washout' || ty === 'grid')) { AU.sfx('thud'); AU.sfx(ty === 'pothole' || ty === 'washout' ? 'bump' : 'clunk'); RFC.burst = 0.25; } } }
  RFC.rough = rough;
}
const MK = { rounds: 0, doneSeen: false, list: [], items: [{ x: 0, y: 0, a: 0, s: 1 }, { x: 0, y: 0, a: 0, s: 1 }, { x: 0, y: 0, a: 0, s: 1 }], hudT: -9, hudB: 0, P: {} };
const MK_TYPES = { pothole: 1, rocks: 1, log: 1, washout: 1, corrug: 1, grid: 1, creek: 1 };
function markersFrame() {
  if (!UIB.active()) return; const s = L.S;
  if (s.done) { if (!MK.doneSeen) { MK.doneSeen = true; MK.rounds++; } UIB.markers(null); return; } MK.doneSeen = false;
  if (!RF || coreMode !== 'play' || s.hold) { UIB.markers(null); return; }
  const sw = ws(IP[PS]), uu = IP[PU], now = performance.now() / 1000;
  if (MK.hudT !== RSZ) { MK.hudT = RSZ; const t = document.querySelector('.rk-top'); MK.hudB = t ? t.getBoundingClientRect().bottom : 0; }
  /* candidates: one per drawn lane of each marked feature ahead, at the lane's centre */
  const C = MK.list; C.length = 0;
  for (const f of RF.list) { if (!MK_TYPES[f.type]) continue; const s0 = f.s[0], s1 = f.s[1], d0 = s0 - sw; if (d0 < 0 || d0 > 45) continue;
    for (const ln of f.ext || []) C.push({ sc: (s0 + s1) / 2, s0, u: (ln[0] + ln[1]) / 2, d0 }); }
  C.sort((a, b) => a.d0 - b.d0);
  /* groups within 8 m share one marker, at the lane nearest the ute */
  /* owner 02:04 IST: side-by-side sets each get their own marker; a group is the same lane (lateral centres within 1.2 m) within 8 m */
  const G = []; for (const c of C) { const g = G.find(q => c.d0 - q.d0 < 8 && Math.abs(c.u - q.u) <= 1.2); if (!g) G.push({ d0: c.d0, s0: c.s0, sc: c.sc, u: c.u }); }
  const maxN = MK.rounds === 0 ? 3 : 1, sk = MK.rounds === 0 ? 1 : 0.8;
  /* the ute's screen box (8 corners), 20 px margin */
  const R0 = UTE.root; R0.updateMatrixWorld(true); let bx0 = 1e9, bx1 = -1e9, by0 = 1e9, by1 = -1e9;
  for (const c of INV_BOX) { V2.set(c[0], c[1], c[2]).applyMatrix4(R0.matrixWorld).project(camera); const x = (V2.x + 1) / 2 * VW, y = (1 - V2.y) / 2 * VH; bx0 = Math.min(bx0, x); bx1 = Math.max(bx1, x); by0 = Math.min(by0, y); by1 = Math.max(by1, y); }
  const out = []; for (let i = 0; i < Math.min(maxN, G.length); i++) {
    const g = G[i], it = MK.items[i]; TR.world(g.sc, g.u, MK.P); V2.set(MK.P.x, baseW(g.sc, g.u) + 1.2, MK.P.z).project(camera);
    if (V2.z > 1 || V2.z < -1) continue; const x = (V2.x + 1) / 2 * VW, y = (1 - V2.y) / 2 * VH;
    const aIn = clamp((45 - g.d0) / 5, 0, 1), aOut = clamp(g.d0 / 6, 0, 1); let a = Math.min(aIn, aOut);
    if (x > bx0 - 20 && x < bx1 + 20 && y > by0 - 20 && y < by1 + 20) a = 0; if (y < MK.hudB + 8 || x < 0 || x > VW) a = 0;
    it.x = x; it.y = y; it.a = +a.toFixed(3); it.s = +((0.85 + 0.15 * clamp(1 - (g.d0 - 6) / 39, 0, 1)) * sk).toFixed(3); out.push(it);
  }
  /* markers in one row never overlap by more than half their width: nudge apart horizontally (marker about 34 px wide x scale) */
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) { const A = out[i], B = out[j], w = 34 * Math.max(A.s, B.s), dx = B.x - A.x; if (Math.abs(B.y - A.y) < w && Math.abs(dx) < w * 0.5) { const push = (w * 0.5 - Math.abs(dx)) / 2, sg = dx >= 0 ? 1 : -1; A.x -= sg * push; B.x += sg * push; } }
  UIB.markers(out);
  if (Q.has('mkcheck')) { const st = (window.__mk = window.__mk || { frames: 0, maxShown: 0, overUte: 0 }); st.frames++; st.maxShown = Math.max(st.maxShown, out.filter(o => o.a > 0).length); }
}
const FPSQ = new URLSearchParams(location.search), FPS_ON = FPSQ.get('fps') === '1' || (FPSQ.get('fps') !== '0' && !globalThis.TC_RELEASE);
const FPS = { el: null, t: 0, n: 0, b: [0, 0, 0, 0], bi: 0, ph: '#' };
function fpsFrame(dt) {
  if (!FPS_ON || !(dt > 0)) return;
  if (!FPS.el) { FPS.el = document.createElement('div'); FPS.el.style.cssText = 'position:fixed;left:calc(env(safe-area-inset-left) + 6px);top:calc(env(safe-area-inset-top) + 6px);z-index:70;pointer-events:none;padding:2px 6px;border-radius:3px;background:rgba(0,0,0,.55);color:#fff;font:600 12px/16px ui-monospace,Consolas,monospace;white-space:nowrap'; document.body.appendChild(FPS.el); }
  FPS.t += dt; FPS.n++; if (dt > FPS.b[FPS.bi]) FPS.b[FPS.bi] = dt;
  if (FPS.t < 0.5) return;
  const ph = UIB.active() ? UIB.phase() : coreMode;
  if (ph !== FPS.ph) { FPS.ph = ph; const play = ph === 'play' || ph === 'pause' || ph === 'build'; let top = 6; if (play) { const t = document.querySelector('.rk-top'); top = t ? Math.round(t.getBoundingClientRect().bottom) + 4 : 120; } FPS.el.style.top = play ? top + 'px' : 'calc(env(safe-area-inset-top) + 6px)'; }
  const worst = Math.max(FPS.b[0], FPS.b[1], FPS.b[2], FPS.b[3]), cv = renderer.domElement;
  FPS.el.textContent = Math.round(FPS.n / FPS.t) + ' fps \u00b7 worst ' + Math.round(worst * 1000) + ' ms \u00b7 ' + (SW.TIER || '') + ' \u00b7 ' + cv.width + 'x' + cv.height + (OVR ? ' \u00b7 ' + OVR : '');
  FPS.t = 0; FPS.n = 0; FPS.bi = (FPS.bi + 1) % 4; FPS.b[FPS.bi] = 0;
}
const PW = { ph: '' };
function phaseWatch() { const ph = coreMode + '/' + (UIB.active() ? UIB.phase() : ''); if (ph !== PW.ph) { PW.ph = ph; RSZ++; if (SW && SW.dynHoldFor) SW.dynHoldFor(1000); } }
const TTH = { k: 0 };
const FREED = { n: 0, done: false };
const CULLW = { far: Q.has('far') ? +Q.get('far') || 420 : 420, behind: Q.has('behind') ? +Q.get('behind') || 60 : 60 };
const OVR = ['scale', 'dpr', 'dyn', 'far', 'behind', 'shadow', 'dust', 'ute', 'aa', 'tier'].filter(k => Q.has(k)).map(k => k + '=' + Q.get(k)).join(' ');
export function revealWait() { return ARR.on && finaleE() < ARR.endAt; }
/* the stash (owner): packed slots, one body, one sway for the loose block */
const ROAD_K = 1.0, TUB_K = 0.6, DECK_K = 0.85, M2 = 0.02, GAP = 0.01, YAWMAX = 0.07;
const TUB = { floor: 0.735, rail: 1.312, z0: -2.53, z1: -1.035, inW: 0.60, tubY: 0.95, upW: 0.80, covW: 0.70, canister: 0.22 };
/* the grid: inner width 1.20 less margins, the tub length behind the cover canister (fixed, so fitting a cover never reshuffles) */
const GRID = (() => { const w = 2 * TUB.inW - 2 * M2, zf = TUB.z1 - TUB.canister - M2, zb = TUB.z0 + M2, cw = (w - 3 * GAP) / 4, cz = (zf - zb - 2 * GAP) / 3;
  const xs = [0, 1, 2, 3].map(c => -w / 2 + cw / 2 + c * (cw + GAP)), zs = [0, 1, 2].map(r => zf - cz / 2 - r * (cz + GAP));
  /* fill order inside a layer: the two middle columns first (middle, front, back rows), then the outer columns */
  const order = []; for (const c of [1, 2]) for (const r of [1, 0, 2]) order.push([c, r]); for (const c of [0, 3]) for (const r of [1, 0, 2]) order.push([c, r]);
  order.sort((a, b) => ((a[0] === 1 || a[0] === 2) ? 0 : 1) - ((b[0] === 1 || b[0] === 2) ? 0 : 1) || [1, 0, 2].indexOf(a[1]) - [1, 0, 2].indexOf(b[1]) || a[0] - b[0]);
  return { cw, cz, xs, zs, order, zf, zb }; })();
const yawOf = i => (R2(i * 3 + 1) - 0.5) * 2 * YAWMAX;
/* per type: long axis along the tub, uniform scale to the cell footprint (with the yaw allowance), height capped at 0.26 m */
const FIT = [];
function fitOf(t) {
  if (FIT[t]) return FIT[t]; const G = GEAR[t]; if (!G) return { k: TUB_K, yaw: 0, ex: 0.1, ez: 0.1, h: 0.1 };
  const sz = G.size, rot = sz.x > sz.z, ax = rot ? sz.z : sz.x, az = rot ? sz.x : sz.z, sn = Math.sin(YAWMAX), cs = Math.cos(YAWMAX);
  let k = Math.min((GRID.cw - 0.004) / (ax * cs + az * sn), (GRID.cz - 0.004) / (az * cs + ax * sn), 0.26 / sz.y);
  return (FIT[t] = { k, yaw: rot ? Math.PI / 2 : 0, ex: ax * k / 2, ez: az * k / 2, h: sz.y * k });
}
/* deck items: long axis along the ute, big ones within 0.9 m across, long ones within 0.42 m (three abreast) */
const DFIT = [];
function dfitOf(t) {
  if (DFIT[t]) return DFIT[t]; const G = GEAR[t]; if (!G) return { k: DECK_K, yaw: 0, ex: 0.3, ez: 0.5, h: 0.2 };
  const sz = G.size, rot = sz.x > sz.z, ax = rot ? sz.z : sz.x, az = rot ? sz.x : sz.z, long = GT[t].kind === 'long';
  const k = Math.min(DECK_K, (long ? 0.42 : 0.9) / ax, 1.4 / az, 0.4 / sz.y);
  return (DFIT[t] = { k, yaw: rot ? Math.PI / 2 : 0, ex: ax * k / 2, ez: az * k / 2, h: sz.y * k });
}
function deckTop() { const id = L.S.sel[2]; return id && PRODS[id] && id !== 'bars' ? PRODS[id].base.box.max.y + 0.02 : TUB.rail + 0.1; }
const PL = new Map();
const zFront = () => TUB.z1 - (L.S.sel[1] ? TUB.canister : 0);
const RACKS = {
  bars: { y: 1.368, sup: [-1.42, -2.18], hw: 0.76 },
  rack: { y: 1.554, sup: [-1.36, -2.24], hw: 0.68, plat: true },
  ladder: { y: 1.856, sup: [-1.16, -2.36], hw: 0.80 },
  adventure: { y: 1.553, sup: [-1.44, -2.20], hw: 0.74 }
};
/* the loadouts: slots in fill order; acc = gear ids it takes; on = slots it rests on (all filled); block = slots that must be empty */
const LOADOUT = {
  rack: [{ id: 'A', x: 0, z: -1.80, acc: ['tent', 'kayak'], w: 0.9, l: 1.24 }, { id: 'B', x: 0, z: -1.80, acc: ['kayak'], on: ['A'], w: 0.62, l: 1.24 }],
  ladder: [{ id: 'C', x: 0, z: -1.76, acc: ['timber3', 'ladder3'], w: 0.42, l: 1.45 }, { id: 'L', x: -0.53, z: -1.76, acc: ['timber3'], w: 0.24, l: 1.45 }, { id: 'R', x: 0.53, z: -1.76, acc: ['timber3'], w: 0.24, l: 1.45 }, { id: 'T', x: 0, z: -1.76, acc: ['ladder3', 'timber3'], on: ['C'], w: 0.42, l: 1.45 }],
  adventure: [{ id: 'L', x: -0.33, z: -1.82, acc: ['board3'], block: ['S1'], w: 0.56, l: 1.3 }, { id: 'R', x: 0.33, z: -1.82, acc: ['board3'], block: ['S1'], w: 0.56, l: 1.3 }, { id: 'S', x: 0, z: -1.82, acc: ['swags3'], on: ['L', 'R'], across: true, w: 0.36, l: 1.3 }, { id: 'S1', x: 0, z: -1.44, acc: ['swags3'], block: ['L', 'R'], across: true, w: 0.36, l: 1.3 }]
};
const LFIT = {};
function slotFit(t, sl) {
  const key = t + ':' + sl.id + ':' + (sl.across ? 1 : 0); if (LFIT[key]) return LFIT[key]; const G = GEAR[t]; if (!G) return { k: DECK_K, yaw: 0, ex: 0.3, ez: 0.5, h: 0.2 };
  const sz = G.size, alongZ = sz.z >= sz.x, longS = Math.max(sz.x, sz.z), shortS = Math.min(sz.x, sz.z), k = Math.min(sl.w / shortS, sl.l / longS, 0.32 / sz.y);
  /* long side along the ute (z), or across (x) for a strapped roll */
  const yaw = sl.across ? (alongZ ? Math.PI / 2 : 0) : (alongZ ? 0 : Math.PI / 2), ex = (sl.across ? longS : shortS) * k / 2, ez = (sl.across ? shortS : longS) * k / 2;
  return (LFIT[key] = { k, yaw, ex, ez, h: sz.y * k });
}
const LOAD = { plus: 0, items: [], top: 0 };
function layoutPile() {
  PL.clear(); const s = L.S, rail = s.sel[2], RK = rail ? RACKS[rail] : null, colY = new Float32Array(12).fill(TUB.floor + 0.004);
  let n = s.pile.length, plus = 0; LOAD.items.length = 0; LOAD.top = 0;
  /* the rack loadout */
  const LO = LOADOUT[rail], filled = {};
  if (LO) for (const i of s.deck) {
    const t = L.GP[i].type, gid = GT[t].id; let placed = false;
    for (const sl of LO) { if (filled[sl.id] || !sl.acc.includes(gid)) continue; if (sl.on && !sl.on.every(q => filled[q])) continue; if (sl.block && sl.block.some(q => filled[q])) continue;
      const f = slotFit(t, sl), y = sl.on ? Math.max(...sl.on.map(q => filled[q].y + filled[q].f.h)) + 0.004 : RK.y + 0.003; if (y + f.h > RK.y + 0.6) continue;
      filled[sl.id] = { y, f }; PL.set(i, { x: sl.x, y, z: sl.z, f, yaw: f.yaw, layer: -1, deck: true, loose: false, order: n++ }); LOAD.items.push({ x0: sl.x - (sl.across ? f.ex : f.ex), x1: sl.x + f.ex, z0: sl.z - f.ez, z1: sl.z + f.ez, y1: y + f.h }); LOAD.top = Math.max(LOAD.top, y + f.h); placed = true; break; }
    if (!placed) plus++;
  } else plus += s.deck.length;
  /* the tub stash: slot k = layer floor(k / 12), cell GRID.order[k % 12]; each piece on the one below in its cell; with a rail product
     fitted nothing reaches the rail line: Cross Bars take the overflow in rows on each bar (two layers), the racks count it as "+n" */
  let top = TUB.floor, topL = -1, bk = 0; const barY = new Float32Array(8).fill(RK ? RK.y + 0.003 : 0);
  s.pile.forEach((i, k) => {
    const layer = Math.floor(k / 12), [c, r] = GRID.order[k % 12], ci = r * 4 + c, f = fitOf(L.GP[i].type), loose = k >= s.secN && !L.isShut();
    let y = colY[ci];
    if (rail && y + f.h > TUB.rail - M2) {
      if (rail !== 'bars' || bk >= 16) { plus++; return; }
      const bc = bk % 8, bcol = [1, 2, 0, 3][bc % 4], brow = bc < 4 ? 0 : 1, by = barY[bc]; bk++;
      if (by + f.h > RK.y + 0.6) { plus++; return; }
      barY[bc] = by + f.h; PL.set(i, { x: GRID.xs[bcol], y: by, z: RK.sup[brow], f, yaw: f.yaw + yawOf(i), layer, deck: false, bar: true, loose, order: k }); top = Math.max(top, by + f.h); topL = Math.max(topL, layer); return;
    }
    const capY = TUB.rail + 0.8; colY[ci] = y + f.h; if (y + f.h > capY) { plus++; return; }
    PL.set(i, { x: GRID.xs[c], y, z: GRID.zs[r], f, yaw: f.yaw + yawOf(i), layer, deck: false, loose, order: k });
    top = Math.max(top, y + f.h); topL = Math.max(topL, layer);
  });
  LOAD.plus = plus;
  const lineL = Math.floor(Math.min(s.secN, s.pile.length) / 12);
  return { base: TUB.floor, top: Math.max(top, LOAD.top), packedTop: TUB.floor, count: n, LH: 0.2, per: 12, packN: 0, lineL, topL, colY };
}
/* tie-down bands over the rack load (two, at the supports), and the "+n" tag */
let bandIM = null, plusSpr = null, plusN = -1;
function loadFX() {
  if (!bandIM) { bandIM = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x1b1b1d }), 6); bandIM.count = 0; bandIM.frustumCulled = false; UTE.inner.add(bandIM);
    const c = document.createElement('canvas'); c.width = 128; c.height = 64; plusSpr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthWrite: false, toneMapped: false })); plusSpr.userData.c = c; plusSpr.scale.set(0.46, 0.23, 1); plusSpr.visible = false; UTE.inner.add(plusSpr); }
  const s = L.S, RK = s.sel[2] ? RACKS[s.sel[2]] : null, it = LOAD.items; bandIM.count = 0;
  if (RK && it.length && !RK.plat || RK && it.length) { let x0 = 9, x1 = -9; for (const q of it) { x0 = Math.min(x0, q.x0); x1 = Math.max(x1, q.x1); } const y1 = LOAD.top + 0.006, y0 = RK.y, M = new THREE.Matrix4(), P3 = new THREE.Vector3(), Qi = new THREE.Quaternion(), S3 = new THREE.Vector3();
    for (const z of RK.sup) { P3.set((x0 + x1) / 2, y1, z); S3.set(x1 - x0 + 0.03, 0.012, 0.05); M.compose(P3, Qi, S3); bandIM.setMatrixAt(bandIM.count++, M);
      for (const x of [x0 - 0.008, x1 + 0.008]) { P3.set(x, (y0 + y1) / 2, z); S3.set(0.012, Math.max(0.01, y1 - y0), 0.05); M.compose(P3, Qi, S3); bandIM.setMatrixAt(bandIM.count++, M); } }
    bandIM.instanceMatrix.needsUpdate = true; }
  const pn = 0; if (pn !== plusN) { plusN = pn; const c = plusSpr.userData.c, x = c.getContext('2d'); x.clearRect(0, 0, 128, 64); if (pn > 0) { x.fillStyle = '#000'; x.fillRect(4, 6, 120, 52); x.strokeStyle = '#FFC600'; x.lineWidth = 4; x.strokeRect(4, 6, 120, 52); x.fillStyle = '#FFC600'; x.font = '700 40px Oswald, Impact, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('+' + pn, 64, 34); } plusSpr.material.map.needsUpdate = true; plusSpr.visible = pn > 0; }
  if (plusSpr.visible) plusSpr.position.set(0, Math.max(LOAD.top, lastLay ? lastLay.top : TUB.rail) + 0.32, -2.3);
}
/* the allowed volume (check only: the grid and the sway limits keep every piece inside by construction): inside the tub walls below
   the rails (0.60 between the wheel tubs up to 0.95, 0.80 above), the cover rails (0.70) when a cover is fitted and the piece reaches the
   rail line, never into the canister; window.__clip records the worst true-volume overlap (positive = outside) */
const CL = { x: 0, y: 0, z: 0 };
function inVol(px, py, pz, ex, ez, ey, rx, rz, deck) {
  CL.x = px; CL.y = py; CL.z = pz;
  const tx = ey * Math.abs(Math.sin(rz)), tz = ey * Math.abs(Math.sin(rx)), cov = !!L.S.sel[1], reach = py + ey > TUB.rail - M2;
  let W0 = deck || py >= TUB.tubY ? TUB.upW : TUB.inW; if (cov && (reach || deck)) W0 = Math.min(W0, TUB.covW);
  if (L.S.done) return; const st = (window.__clip = window.__clip || { n: 0, worst: -9 }); st.n++;
  const zf = deck ? -0.6 : zFront(), zb = deck ? -2.9 : TUB.z0, o = Math.max(Math.abs(px) + ex + tx - W0, pz + ez + tz - zf, zb - (pz - ez - tz), TUB.floor - py);
  if (o > st.worst) { st.worst = +o.toFixed(4); st.at = +L.S.s.toFixed(1); st.deck = !!deck; }
}
/* the one sway: a damped two-axis spring for the loose block (metres at a six-layer top); shear per layer above the protected line */
const SWAY = { x: 0, xv: 0, z: 0, zv: 0, impN: 0, lmax: 6 };
function swayStep(s, gfdt) {
  if (s.imp.n !== SWAY.impN) { SWAY.impN = s.imp.n; SWAY.xv += clamp(s.imp.x, -3, 3) * 0.05; SWAY.zv += clamp(s.imp.z, -3, 3) * 0.03; }
  const w = 6.5, zt = s.bars ? 0.8 : 0.5, tx = clamp(-s.veh.aLatF * 0.0045, -0.04, 0.04), tz = clamp(s.veh.aLongF * 0.002, -0.015, 0.015), n = Math.max(1, Math.ceil(gfdt * 120)), h = gfdt / n;
  for (let q = 0; q < n; q++) { SWAY.xv += (w * w * (tx - SWAY.x) - 2 * zt * w * SWAY.xv) * h; SWAY.x += SWAY.xv * h; SWAY.zv += (w * w * (tz - SWAY.z) - 2 * zt * w * SWAY.zv) * h; SWAY.z += SWAY.zv * h; }
  const lim = 0.04 * (1 + 0.8 * (s.swerveLevel || 0) + (s.unstable ? 0.5 : 0)); if (s.unstable && gfdt > 0) SWAY.xv += (Math.random() - 0.5) * 0.15 * gfdt * 60 * 0.05; SWAY.x = clamp(SWAY.x, -lim, lim); SWAY.z = clamp(SWAY.z, -0.02, 0.02);
}
const shear = (tgt, lay) => { if (!tgt.loose || tgt.deck) return 0; return Math.max(0, tgt.layer - lay.lineL) / SWAY.lmax; };
/* contact patches (soft dark squares under each piece) and the loose block's top edge */
let aoIM = null, looseEdge = null, aoN = 0;
function stashFX() {
  if (aoIM) return;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 6, 32, 32, 32); gr.addColorStop(0, 'rgba(0,0,0,0.85)'); gr.addColorStop(0.7, 'rgba(0,0,0,0.5)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c), m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  aoIM = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), m, 160); aoIM.count = 0; aoIM.frustumCulled = false; aoIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(aoIM);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(15), 3));
  looseEdge = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xff8a3a, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false })); looseEdge.frustumCulled = false; looseEdge.visible = false; UTE.inner.add(looseEdge);
}
/* proof (?stashcheck=1): AABBs in ute space each frame after landing */
const SC_ON = Q.has('stashcheck');
const BOXES = [], PREVREL = new Map();
function stashCheck(lay) {
  const st = (window.__stash = window.__stash || { frames: 0, maxOverlap: 0, maxGap: 0, maxRel: 0, pieces: 0, at: {} }); st.frames++; st.pieces = Math.max(st.pieces, BOXES.length);
  for (let a = 0; a < BOXES.length; a++) { const A = BOXES[a];
    /* support: the floor, the deck plane, or a piece below whose top meets this base over its footprint */
    let sup = A.y0 <= TUB.floor + 0.006 || A.onDeck ? 0 : 9;
    for (let b = 0; b < BOXES.length; b++) { if (a === b) continue; const B = BOXES[b];
      const ox = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0), oy = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0), oz = Math.min(A.z1, B.z1) - Math.max(A.z0, B.z0);
      if (ox > 0 && oy > 0 && oz > 0) { const o = Math.min(ox, oy, oz); if (o > st.maxOverlap) { st.maxOverlap = +o.toFixed(4); st.at.overlap = [+L.S.s.toFixed(1), A.i, B.i]; } }
      if (ox > 0.02 && oz > 0.02 && B.y1 <= A.y0 + 0.005) sup = Math.min(sup, A.y0 - B.y1); }
    if (sup < 9 && sup > st.maxGap) { st.maxGap = +sup.toFixed(4); st.at.gap = [+L.S.s.toFixed(1), A.i]; } }
  /* same-layer relative motion: each landed piece against the first landed piece of its layer */
  const first = new Map(); for (const A of BOXES) { if (A.layer < 0) continue; if (!first.has(A.layer)) { first.set(A.layer, A); continue; } const F = first.get(A.layer), key = A.i + ':' + F.i, rx = A.cx - F.cx, rz = A.cz - F.cz, p = PREVREL.get(key);
    if (p) { const d = Math.hypot(rx - p[0], rz - p[1]); if (d > st.maxRel) { st.maxRel = +d.toFixed(5); st.at.rel = [+L.S.s.toFixed(1), A.i, F.i]; } } PREVREL.set(key, [rx, rz]); }
}
/* per-piece presentation state */
const GV = [];
const gv = i => GV[i] || (GV[i] = { st: '', from: new THREE.Vector3(), p: new THREE.Vector3(), v: new THREE.Vector3(), lp: new THREE.Vector3(), rot: new THREE.Euler(), land: -9, rest: false, floor: 0 });
const pileSt = { x: 0, xv: 0, z: 0, zv: 0, impN: 0 };
const LOOSE_C = new THREE.Color(), PACK_C = new THREE.Color(0.97, 0.96, 0.94), WHITE = new THREE.Color(1, 1, 1), TALLY_C = new THREE.Color(), ML = new THREE.Matrix4();
let tally = -1, tallyStep = 0.06, lockPrev = -1, lockFrom = 0, lockTo = 0, lockAt = -9;
function addInst(t, mat, col) { const G = GEAR[t]; if (!G || G.n >= MAXI[t]) return; G.im.setMatrixAt(G.n, mat); G.im.instanceColor.setXYZ(G.n, col.r, col.g, col.b); G.n++; }
let ringN = 0, shN = 0;
function gearFrame(rt, tt, fdt, gfdt, thS) {
  const s = L.S; for (const G of GEAR) if (G) G.n = 0; ringN = 0; shN = 0;
  const lay = layoutPile(), uteM = UTE.inner.matrixWorld; lastLay = lay; stashFrame(fdt); stashProof();
  /* pile spring (calm): lean from the body's lateral and fore-aft acceleration, kicks, corrugation jiggle; cargo bars damp it */
  lossLog(); swayStep(s, gfdt); stashFX(); aoN = 0; BOXES.length = 0; let looseTop = null;
  const pulse = 0.5 + 0.5 * Math.sin(tt * 6), bankE = s.done ? rt - doneAt() : -1, slide = s.reach > CONFIG.gearR + 0.01;
  if (s.secN > lockPrev && lockPrev >= 0 && !s.done) { lockFrom = Math.min(lockPrev, s.pile.length); lockTo = Math.min(s.secN, s.pile.length); lockAt = rt + 0.15; if (lockTo > lockFrom && L.FX.live()) setTimeout(() => RT.call(`<span style="color:#FFC600">+${lockTo - lockFrom} PROTECTED</span>`, VW / 2, VH * 0.3, '#FFC600'), 400); } lockPrev = s.secN;
  { const n = (s.packed || []).length + s.pile.length + s.deck.length; tallyStep = n ? Math.min(0.09, 1.4 / n) : 0.06; tally = s.done && bankE > TALLY_T0 ? bankE - TALLY_T0 : -1; if (!s.done) for (const q of GV) if (q) q.pinged = false; }
  for (let i = 0; i < L.GP.length; i++) {
    const g = L.GP[i], v = gv(i), T = GT[g.type], G = GEAR[g.type]; if (!G) continue; const sz = G.size, small = T.kind === 'small';
    /* lay pieces with their smallest extent up and the longest across the ute */
    const yawLay = small ? 0 : 0;
    if (g.state === 'road' || g.state === 'missed') {
      v.st = 'road'; const near = g.s - s.s; if (near > 150 || near < -30) continue;
      W.pos(g.s, g.u, PO); const gy = L.groundH(g.s, g.u);
      EU.set(0, PO.th + Math.PI / 2 + (small ? 0.35 * Math.sin(i * 1.7) : 0), 0); QQ.setFromEuler(EU); V1.set(PO.x, gy + 0.01, PO.z); SC.setScalar(small ? ROAD_K : 0.9); M4.compose(V1, QQ, SC); SC.setScalar(1); addInst(g.type, M4, WHITE);
      if (g.state === 'road') { const rs = small ? 0.62 : 1.0; EU.set(0, PO.th, 0); QQ.setFromEuler(EU); V1.set(PO.x, gy + 0.03, PO.z); V2.set(rs, 1, small ? rs : rs * (T.kind === 'long' ? 1.9 : 1.3)); M4.compose(V1, QQ, V2); if (ringN < 96) ringIM.setMatrixAt(ringN++, M4); V2.set(sz.x * 0.9, 1, sz.z * 1.0); M4.compose(V1, QQ, V2); if (shN < 96) gearShadowIM.setMatrixAt(shN++, M4); }
      continue;
    }
    if (g.state === 'spare' || g.state === 'gone') { v.st = g.state; continue; }
    if (STH && (g.state === 'pile' || g.state === 'lost')) { v.st = g.state === 'pile' ? 'pile' : 'lost'; continue; }
    const tgt = PL.get(i);
    if (g.state === 'pile' && tgt) {
      if (v.st === 'road' || v.st === 'spare' || v.st === 'gone') { v.st = 'fly'; if (g.from) v.from.set(g.from.x, g.from.y, g.from.z); else { W.pos(g.s, g.u, PO); v.from.set(PO.x, L.groundH(g.s, g.u), PO.z); } }
      if (v.st === '' ) { v.st = 'pile'; v.lp.set(tgt.x, tgt.y, tgt.z); }
      if (v.st === 'fly') {
        /* the prototype's flight to the next free slot: an arc that rises with the stash, a tumble, road size to slot size with a bounce
           (deck loads pop bigger); it lands flat with a thud and a short squash-and-settle */
        const dur = slide && !g.from ? 0.42 : 0.32, e = (rt - g.t0) / dur, kT = tgt.f.k;
        if (e >= 1 || s.done) { v.st = 'pile'; v.land = rt; AU.sfx('thud'); SWAY.xv += (R2(i) - 0.5) * 0.04; }
        else { V1.set(tgt.x, tgt.y, tgt.z).applyMatrix4(uteM); const f = 1 - Math.pow(1 - e, 2); V2.lerpVectors(v.from, V1, f); V2.y += Math.sin(Math.PI * e) * (1.2 + (tgt.y - TUB.floor) * 0.6);
          const q = e * e; EU.set((1 - q) * e * 4, IP[PYAW] + tgt.yaw * q + (1 - q) * e * 2, 0); QQ.setFromEuler(EU); SC.setScalar((ROAD_K + (kT - ROAD_K) * e) * (1 + (tgt.deck ? 0.4 : 0.25) * Math.sin(Math.PI * e))); M4.compose(V2, QQ, SC); SC.setScalar(1); addInst(g.type, M4, WHITE); continue; }
      }
      if (v.st === 'pile') {
        /* placed: the slot, the layer's shear (loose block only), a settle on landing; colour flash for the protect run and the tally */
        const sh = shear(tgt, lay), dx = SWAY.x * sh, dz = SWAY.z * sh, th = clamp(SWAY.x / 1.2, -0.026, 0.026) * (sh > 0 ? 1 : 0), tz2 = clamp(SWAY.z / 1.2, -0.012, 0.012) * (sh > 0 ? 1 : 0);
        let sx = 1, sy = 1; const le = rt - v.land; if (le < 0.12) { const q = 1 - le / 0.12; sy = 1 - 0.12 * Math.sin(Math.PI * q); sx = 1 + 0.03 * Math.sin(Math.PI * q); }
        let tk = 0; { const k = s.pile.indexOf(i); if (k >= lockFrom && k < lockTo) { const q = rt - lockAt - (k - lockFrom) * 0.07; if (q > 0 && q < 0.3) { tk = Math.sin(Math.PI * q / 0.3) * 0.7; if (!v.locked || v.locked < lockAt) { v.locked = rt; AU.sfx('ratchet', k - lockFrom); } } } }
        if (tally >= 0) { const q = tally - tgt.order * tallyStep; if (q > 0 && q < 0.32) tk = Math.sin(Math.PI * q / 0.32); if (q > 0 && !v.pinged) { v.pinged = true; AU.sfx(T.w > 1 || tgt.deck ? 'tallyBig' : 'tally', Math.round(17 * tgt.order / Math.max(1, lay.count - 1))); UIB.tallyPiece(T.w); } }
        const px = tgt.x + dx, py = tgt.y, pz = tgt.z + dz, F = tgt.f; v.lp.set(px, py + F.h / 2, pz);
        V2.set(px, py, pz); EU.set(-tz2, tgt.yaw, th); QQ.setFromEuler(EU); const pop = s.done ? 0.2 * tk * (T.w > 1 ? 1.6 : 1) : 0; SC.set(F.k * sx * (1 + pop), F.k * sy * (1 + pop), F.k * sx * (1 + pop));
        ML.compose(V2, QQ, SC); M4.multiplyMatrices(uteM, ML); SC.set(1, 1, 1);
        const col = tk > 0 ? TALLY_C.setRGB(1 + 0.8 * tk, 1 + 0.6 * tk, 1 + 0.2 * tk) : WHITE; addInst(g.type, M4, col);
        /* the contact patch under it */
        if (aoN < 160) { V2.set(px, py + 0.003, pz); EU.set(0, tgt.yaw, 0); QQ.setFromEuler(EU); SC.set(F.ex * 2.3, 1, F.ez * 2.3); ML.compose(V2, QQ, SC); M4.multiplyMatrices(uteM, ML); aoIM.setMatrixAt(aoN++, M4); SC.set(1, 1, 1); }
        if (tgt.loose && !tgt.deck && (!looseTop || tgt.layer >= looseTop.layer)) { if (!looseTop || tgt.layer > looseTop.layer) looseTop = { layer: tgt.layer, x0: 9, x1: -9, z0: 9, z1: -9, y: 0 }; looseTop.x0 = Math.min(looseTop.x0, px - F.ex); looseTop.x1 = Math.max(looseTop.x1, px + F.ex); looseTop.z0 = Math.min(looseTop.z0, pz - F.ez); looseTop.z1 = Math.max(looseTop.z1, pz + F.ez); looseTop.y = Math.max(looseTop.y, py + F.h); }
        if (SC_ON && le >= 0.12 && !s.done) { const ca = Math.abs(Math.cos(tgt.yaw)), sa = Math.abs(Math.sin(tgt.yaw)), hx = F.ex * ca + F.ez * sa, hz = F.ez * ca + F.ex * sa, lx = F.h * Math.abs(Math.sin(th)), lz = F.h * Math.abs(Math.sin(tz2));
          /* the model's footprint at this yaw (the fit's long axis is along z after its base yaw) */
          const bx = Math.abs(Math.cos(tgt.yaw - F.yaw)) * F.ex + Math.abs(Math.sin(tgt.yaw - F.yaw)) * F.ez, bz = Math.abs(Math.cos(tgt.yaw - F.yaw)) * F.ez + Math.abs(Math.sin(tgt.yaw - F.yaw)) * F.ex;
          BOXES.push({ i, layer: tgt.deck ? -1 : tgt.layer, x0: px - bx - lx, x1: px + bx + lx, z0: pz - bz - lz, z1: pz + bz + lz, y0: py, y1: py + F.h, cx: px, cz: pz, onDeck: tgt.deck && !(tgt.y > (RACKS[s.sel[2]] || { y: 0 }).y + 0.01) || tgt.bar && Math.abs(py - RACKS.bars.y - 0.003) < 0.006 });
          inVol(px, py, pz, bx, bz, F.h, tz2, th, tgt.deck); void hx; void hz; }
        continue;
      }
    }
    if (g.state === 'lost') {
      if (v.st !== 'lost') {
        v.st = 'lost'; v.rest = false; const t0 = PL.get(i) || { x: 0, y: TUB.floor + 0.6, z: -1.8 }; v.p.set(v.lp.x || t0.x, v.lp.y || t0.y, v.lp.z || t0.z).applyMatrix4(uteM);
        const side = g.side || 1, sp = 1.4 + R2(i) * 2.2, fw = (R2(i + 7) - 0.3) * 2; v.v.set(Math.sin(thS) * (s.v * 0.3 + fw) - Math.cos(thS) * side * sp, 3.6 + R2(i + 1) * 2.2, Math.cos(thS) * (s.v * 0.3 + fw) + Math.sin(thS) * side * sp);
        const tt2 = W.toTrack(v.p.x + v.v.x * 0.9, v.p.z + v.v.z * 0.9, s.s); v.floor = W.GH(tt2[0], tt2[1]); v.rot.set(0, IP[PYAW], 0);
      }
      if (!v.rest) { v.p.addScaledVector(v.v, fdt); v.v.y -= 9.8 * fdt; v.rot.x += fdt * 7; v.rot.z += fdt * 3 * (g.side || 1); if (v.p.y <= v.floor && v.v.y < 0) { v.p.y = v.floor; v.rest = true; v.rot.set(0, R2(i) * 3, (R2(i + 2) - 0.5) * 0.3); } }
      if (v.p.distanceToSquared(UTE.root.position) > 3600) continue;
      QQ.setFromEuler(v.rot); M4.compose(v.p, QQ, SC); addInst(g.type, M4, WHITE);
    }
  }
  for (const G of GEAR) if (G) { G.im.count = G.n; G.im.instanceMatrix.needsUpdate = true; G.im.instanceColor.needsUpdate = true; }
  if (STH) { aoN = 0; looseTop = null; } aoIM.count = aoN; aoIM.instanceMatrix.needsUpdate = true; if (!STH) loadFX();
  if (looseTop && !s.done) { const a = looseEdge.geometry.attributes.position.array, y = looseTop.y + 0.012, P5 = [[looseTop.x0, looseTop.z0], [looseTop.x1, looseTop.z0], [looseTop.x1, looseTop.z1], [looseTop.x0, looseTop.z1], [looseTop.x0, looseTop.z0]]; P5.forEach((p, q) => { a[q * 3] = p[0]; a[q * 3 + 1] = y; a[q * 3 + 2] = p[1]; }); looseEdge.geometry.attributes.position.needsUpdate = true; looseEdge.visible = true; looseEdge.material.opacity = 0.65 + 0.25 * Math.sin(tt * (s.unstable ? 11 : 4)); looseEdge.material.color.setRGB(1, 0.54 - 0.25 * Math.min(1, s.swerveLevel || 0), 0.23 - 0.2 * Math.min(1, s.swerveLevel || 0)); } else looseEdge.visible = false;
  if (SC_ON) stashCheck(lay);
  ringIM.count = ringN; ringIM.instanceMatrix.needsUpdate = true; gearShadowIM.count = shN; gearShadowIM.instanceMatrix.needsUpdate = true;
  /* secure line: at the top of the secured gear (the packed load plus secN live pieces) */
  const secLayers = Math.ceil(s.secN / lay.per), zh = Math.max(0.001, lay.base + secLayers * lay.LH - TUB.floor + 0.02);
  secBand.visible = s.secN > 0 && !s.done && !STH; if (secBand.visible) { secBand.scale.y += (zh - secBand.scale.y) * Math.min(1, fdt * 5); const lk = lockAt > 0 && rt - lockAt < 1.2 ? 1 - (rt - lockAt) / 1.2 : 0; secBand.userData.edges.material.opacity = 0.75 + 0.2 * Math.sin(tt * 3) + 0.05 * lk; secBand.userData.fill.material.opacity = 0; if (secBand.userData.top) secBand.userData.top.material.opacity = 0.02 * lk; }
  { const e = rt - s.strapAt; strapG.visible = !STH && !!(s.packed && s.packed.length); strapG.position.y = lay.packedTop + 0.01; strapG.scale.y = e >= 0 && e < 0.5 ? 1 + 2 * (0.5 - e) : 1; }
  return lay;
}
/* products: hidden until fitted; the build shot assembles the chosen one over its ghost (3-5 chunks, one tick each), then it stays */
export let TALLY_T0 = 1.5;
let doneRt = -1;
const doneAt = () => { if (L.S.done && doneRt < 0) doneRt = L.S.rt; if (!L.S.done) doneRt = -1; return doneRt; };
export const finaleE = () => L.S.done ? L.S.rt - doneAt() : -1;
const easeBack = k => { const c = 1.7; k = clamp(k, 0, 1); return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
function productFrame(rt, tt) {
  const s = L.S; if (!fitRoot) return;
  let coverOn = false; if (coverGrp) coverGrp.visible = false;
  for (const id in PRODS) { const P = PRODS[id], j = s.sel.indexOf(id), on = j >= 0 && s.fitAt[j] >= 0; if (P.whole) P.whole.visible = false; for (const c of P.chunks) c.visible = false; P.ghost.visible = false;
    if (!on) continue;
    const e = rt - s.fitAt[j], FS = CONFIG.hold.fitSnap, building = s.hold && s.hold.k === j && s.hold.phase === 'fit';
    if (P.base.mixer) { coverOn = true; if (building) { P.ghost.visible = e < FS; const q = clamp((e - 0.4) / (FS - 0.6), 0, 1); coverGrp.position.y = (1 - easeBack(q)) * 1.2; coverGrp.visible = e > 0.4; } else coverGrp.position.y = 0; continue; }
    if (building || e < FS + 0.05) {
      P.ghost.visible = e >= 0 && e < FS + 0.1; ghostMat.opacity = 0.22 + 0.16 * Math.sin(tt * 12); const n = P.chunks.length; if (e >= FS && P.thud !== s.fitAt[j]) { P.thud = s.fitAt[j]; AU.sfx('thud'); }
      P.chunks.forEach((c, k) => { const t0 = 0.25 + k * (FS - 0.45) / n, q = (e - t0) / 0.3; if (q < 0) return; c.visible = true; const kk = q >= 1 ? 0 : 1 - easeBack(q); c.position.set((k % 2 ? -1 : 1) * 0.9 * kk, 1.8 * kk, -0.6 * kk); c.rotation.set(0.6 * kk, 0.8 * kk * (k % 2 ? -1 : 1), 0); c.scale.setScalar(q >= 1 ? 1 : 1 + 0.15 * Math.sin(Math.PI * clamp(q, 0, 1)));
        if (q >= 0.95 && c.userData.ticked !== s.fitAt[j]) { c.userData.ticked = s.fitAt[j]; AU.sfx('ratchet', k); } });
    } else P.whole.visible = true;
  }
  /* the cover: rolled open (canister) from gate 2; at camp it rolls shut over the packed load; the EVOe shuts on a tap */
  /* the EVOe shuts itself for a big hit: a quick glide shut with a blue-white flash, open again after the feature (no finale close) */
  if (coverOn) { const P = PRODS[s.sel[1]], b = P.base; let shut = 0; if (!s.done && L.isShut()) shut = clamp((rt - (s.shutAt || 0)) / 0.22, 0, 1) * clamp((s.shutUntil - s.t) / 0.25, 0, 1);
    b.pose(b.clip ? b.clip.duration * (1 - shut) : 0); coverGrp.visible = true;
    const fe = rt - (s.shutAt || -9); flash.visible = fe >= 0 && fe < 0.45 && !s.done; if (flash.visible) flash.material.opacity = 0.9 * (1 - fe / 0.45); }
  /* fitted beat: light sweep along the product and a dust ring at the wheels */
  let de = 9; for (let j = 0; j < 3; j++) if (s.fitAt[j] >= 0) { const e = rt - s.fitAt[j] - CONFIG.hold.fitSnap; if (e >= 0 && e < de) de = e; }
  if (!dustRing.userData.soft) { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 18, 64, 64, 64); g.addColorStop(0, 'rgba(232,200,154,0)'); g.addColorStop(0.55, 'rgba(232,200,154,0.55)'); g.addColorStop(1, 'rgba(232,200,154,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); dustRing.geometry.dispose(); dustRing.geometry = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2); dustRing.material.map = new THREE.CanvasTexture(c); dustRing.material.color.set(0xffffff); dustRing.material.needsUpdate = true; dustRing.userData.soft = true; }
  dustRing.visible = de < 0.4; if (dustRing.visible) { const q = de / 0.4; dustRing.position.set(IP[PX], IP[PBASE] + 0.05, IP[PZ]); dustRing.scale.setScalar(1.8 + q * 2.2); dustRing.material.opacity = 0.5 * Math.sin(Math.PI * Math.min(1, q * 1.4 + 0.15)) * (1 - q); }
  sweep.visible = false; if (sweep.visible) { const q = de / 0.45; sweep.position.set(0, 1.4, -0.9 - q * 2.2); sweep.scale.set(0.9, 1.2, 1); sweep.material.opacity = 0.5 * Math.sin(Math.PI * q); }
}

/* ---------------------------------------------------------------- camera: chase (locked Cinematic), build shot, eased return, opening crane, finale orbit */
const CAMS = { portrait: { h: 4.0, d: 6.5, p: 18, f: 64, l: 14, y: 0 }, landscape: { h: 3.8, d: 6.5, p: 17, f: 58, l: 14, y: 0.02 } };
const camPos = new THREE.Vector3(), camVel = new THREE.Vector3(), lookPos = new THREE.Vector3(), lookVel = new THREE.Vector3(), PT2 = { x: 0, z: 0, th: 0 };
const VS = new THREE.Vector3();
function springTo(x, v, g, w, dt) { const n = Math.max(1, Math.ceil(dt * 120)), h = dt / n; for (let i = 0; i < n; i++) { VS.subVectors(g, x).multiplyScalar(w * w).addScaledVector(v, -2 * w); v.addScaledVector(VS, h); x.addScaledVector(v, h); } }
let camSnap = true, camDelta = 0, camFov = 64, holdVis = 0, shotName = 'chase';
const buildPose = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 50, have: false }, introT = { t: -1 };
function chaseGoal(out, mode, fdt) {
  const s = L.S, portrait = VH > VW, G0 = CAMS[portrait ? 'portrait' : 'landscape'], CC = CONFIG.cam;
  trailAt0(IP[PS], PT); const thS = PT.th; trailAt0(IP[PS] + 20, PT2);
  const bendLat = (PT2.x - PT.x) * -Math.cos(thS) + (PT2.z - PT.z) * Math.sin(thS), swing = -clamp(bendLat * 0.12, -1, 1), lookLat = clamp(bendLat * 0.35, -3, 3);
  L.trailAt(IP[PS] + CC.ahead, IP[PU] * 0.5, PT); const thA = PT.th, ch = thS + wrapA(thA - thS) * 0.4 + wrapA(IP[PYAW] - thS) * CC.heading;
  const d = G0.d - 0.6 * holdVis;
  L.trailAt(IP[PS], IP[PU] * 0.86 + swing, PT); out.pos.set(PT.x - Math.sin(ch) * d, IP[PBASE] + 0.5 * (IP[PBY] - IP[PBASE]) + G0.h, PT.z - Math.cos(ch) * d);
  L.trailAt(IP[PS] + G0.l, IP[PU] * 0.5 + lookLat, PT); out.look.set(PT.x, out.pos.y, PT.z);
  /* lead that cancels the spring lag (2v/w); the direct poses (opening blend, the return from a build shot) leave it out */
  const vf = s.v, fx = Math.sin(thS) * vf, fz = Math.cos(thS) * vf; out.vx = fx; out.vz = fz; if (!out.noLead) { out.pos.x += fx * 2 / 7; out.pos.z += fz * 2 / 7; out.look.x += fx * 2 / 11; out.look.z += fz * 2 / 11; }
  out.fov = G0.f + 3 * (s.v / CONFIG.cruise - 0.6) - 4 * s.kick; out.pitch = -G0.p * Math.PI / 180; out.lensY = G0.y + (portrait ? 0.12 : 0.1) * holdVis;
  return out;
}
const trailAt0 = (s, o) => L.trailAt(s, 0, o);
/* the framed rear three-quarter build shot: the whole ute in view above the bottom HUD, fitting side to the lens */
function buildGoal(out, k) {
  const portrait = VH > VW, fov = portrait ? 56 : 46, tanV = Math.tan(fov * Math.PI / 360), tanH = tanV * VW / VH, tubProd = k === 0, el = tubProd ? 0.62 : 0.5, az = IP[PYAW] + Math.PI + 0.62;
  const top = HUD_TOP(), freeV = Math.max(0.3, (VH - top - 70) / VH), r = Math.max(6.5, (6.4 / 2) / tanH, (4.8 / 2) / (tanV * freeV));
  V3.set(IP[PX], IP[PBY] + 1.3, IP[PZ]); V4.set(0, 0, -0.9).applyAxisAngle(V1.set(0, 1, 0), IP[PYAW]); V3.add(V4);
  out.pos.set(V3.x + Math.sin(az) * Math.cos(el) * r, V3.y + Math.sin(el) * r, V3.z + Math.cos(az) * Math.cos(el) * r); out.look.copy(V3); out.fov = fov; out.pitch = 0; out.lensY = -0.5 * (top - 60) / VH; return out;
}
/* the opening: the parked ute from its front three-quarter, low; on the first drag the camera cranes up and round to the chase */
/* the poster's live layout (owner 01:3x IST: on his phone the code ticket covered the ute): the headline's bottom and the offer block's
   top in CSS px from the kit's own elements (offsetTop chains: no transforms, so the entrance animation does not move them), read on a
   resize and every half second; the ute's silhouette is fitted between them with 8 px under the headline and 16 px over the offer block,
   using its measured extent per unit of span (below the aim point 0.42 x span x width, above 0.24, worst downhill included) */
const PB = { w: 0, h: 0, t: -9, hb: 0, ot: 0 };
function portBand() {
  const now = performance.now() / 1000; if (PB.w === VW && PB.h === VH && now - PB.t < 0.5) return PB; PB.w = VW; PB.h = VH; PB.t = now;
  const top = e => { let y = 0; for (let q = e; q; q = q.offsetParent) y += q.offsetTop; return y; }, hd = document.querySelector('.rk-ps__h'), ob = document.querySelector('.rk-ps__bot');
  PB.hb = hd ? top(hd) + hd.offsetHeight : 0.31 * VH; PB.ot = ob ? top(ob) : 0.68 * VH; return PB;
}
const ORB = { rel: 0 };
function kitChase(out, mode, fdt) {
  if (!(SW.placeCamera && !Q.has('rig'))) { out.noLead = true; chaseGoal(out, mode, fdt); out.noLead = false; return out; }
  SW.placeCamera(U.uTime.value); camera.updateMatrixWorld(); const kv = clamp((L.S.v * KS * PACE.k - 5) / 6, 0, 1); camera.getWorldDirection(V4);
  out.pos.copy(camera.position); out.look.copy(camera.position).addScaledVector(V4, 10); out.fov = camera.fov + 2.5 * kv; out.pitch = 0; out.lensY = 0; return out;
}
function camLog() {
  if (!Q.has('camlog') || coreMode !== 'play' || introT.t < 0) return; const e = L.S.rt - introT.t; if (e < 2.2 || e > 3.6) return; camera.getWorldDirection(V4);
  const st = (window.__camlog = window.__camlog || []); st.push([+e.toFixed(3), shotName, +camera.position.x.toFixed(3), +camera.position.y.toFixed(3), +camera.position.z.toFixed(3), +V4.x.toFixed(4), +V4.y.toFixed(4), +V4.z.toFixed(4), +camera.fov.toFixed(2), camera.view && camera.view.enabled ? +(camera.view.offsetY / VH).toFixed(4) : 0, camera.view && camera.view.enabled ? +(camera.view.offsetX / VW).toFixed(4) : 0, +CAMC.off.toFixed(3), +IP[PX].toFixed(3), +IP[PZ].toFixed(3)]);
}
function orbitLerp(a, b, k, fv) {
  const cx = IP[PX], cz = IP[PZ], ax = a.x - cx, az = a.z - cz, bx = b.x - cx, bz = b.z - cz, ra = Math.hypot(ax, az), rb = Math.hypot(bx, bz), pa = Math.atan2(ax, az), d = wrapA2(Math.atan2(bx, bz) - pa);
  const p = pa + d * Math.min(1, k / 0.9), rel = p - IP[PYAW], tanH = Math.tan((fv || 50) * Math.PI / 360) * VW / VH, need = (5.6 * Math.abs(Math.sin(rel)) + 2.1 * Math.abs(Math.cos(rel))) / (2 * 0.76 * tanH), r = Math.max(ra + (rb - ra) * k, need); ORB.rel = Math.abs(wrapA2(rel)); a.set(cx + Math.sin(p) * r, a.y + (b.y - a.y) * k, cz + Math.cos(p) * r);
}
function introGoal(out) {
  const portrait = VH > VW, yaw = IP[PYAW], tt = performance.now() / 1000;
  if (portrait) {
    const shortP = VH <= 700, fov = 50, tanV = Math.tan(fov * Math.PI / 360), tanH = tanV * VW / VH, az = yaw + PORT.az + 0.03 * Math.sin(tt * 0.16), B = portBand(), CB = PORT.cb + 0.3 * Math.max(0, VW / VH - 0.46), span = Math.max(0.55, Math.min(shortP ? PORT.spanS : PORT.span, (B.ot - 16 - B.hb - 8) / ((CB + PORT.ct) * VW))), cpx = Math.max(B.hb + 8 + PORT.ct * span * VW, Math.min((shortP ? PORT.cyS : PORT.cy) * VH, B.ot - 16 - CB * span * VW)), D0 = PORT.w / (2 * span * tanH), dk = Math.min(1, frameDt * 3);
    /* eased, not fed back: the distance follows a resize over about 0.3 s, the slope term follows the pitch over about 0.3 s; both snap
       at the loop's wrap (a cut inside the dip) */
    const wrap = (ATT.s || 0) < PORT.ls - 1; PORT.ls = ATT.s || 0; if (!(PORT.D > 0) || coreMode !== 'attract' || wrap) { PORT.D = D0; PORT.tp = Math.tan(IP[PPITCH]); } else { PORT.D += (D0 - PORT.D) * dk; PORT.tp += (Math.tan(IP[PPITCH]) - PORT.tp) * dk; } const D = PORT.D;
    V3.set(IP[PX], IP[PBASE] + 0.95, IP[PZ]); out.pos.set(V3.x + Math.sin(az) * D, IP[PBASE] + Math.max(1.25, PORT.h + PORT.tp * Math.cos(az - yaw) * D), V3.z + Math.cos(az) * D); out.look.copy(V3); out.fov = fov; out.pitch = 0; out.lensY = 0.5 - cpx / VH; return out;
  }
  const az = yaw + 0.36 + 0.12 * Math.sin(tt * 0.16);
  V3.set(IP[PX], IP[PBY] + 1.0, IP[PZ]); const dI = 11.5; out.pos.set(V3.x + Math.sin(az) * dI, IP[PBASE] + 1.7, V3.z + Math.cos(az) * dI); out.look.set(V3.x + Math.sin(yaw) * 0.4, V3.y - 0.1, V3.z + Math.cos(yaw) * 0.4); out.fov = 42; out.pitch = 0; out.lensY = 0; return out;
}
function finaleGoal(out) {
  parkInit(); const s = L.S, sheet = UIB.active() ? UIB.phase() === 'end' : document.querySelector('#rt-sheet.show'), portrait = VH > VW, fov = portrait ? 50 : 40, tanV = Math.tan(fov * Math.PI / 360), tanH = tanV * VW / VH;
  const yaw = PARK.yaw, fx = Math.sin(yaw), fz = Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw), a = 0.62 + Math.min(s.endT || 0, 10) * 0.012, ca = Math.cos(a), sa = Math.sin(a) * PARK.side;
  V3.set(PARK.x - fx * 0.55, PARK.gy + 1.35, PARK.z - fz * 0.55);
  /* the ute and its stash (about 4.1 m across from this angle) fill about 60% of the frame width; landscape is limited by the height */
  const D = Math.max(6.5, portrait ? 4.1 / (2 * 0.6 * tanH) : 3.0 / (2 * 0.55 * tanV)), el = 0.3, dx = -fx * ca + rx * sa, dz = -fz * ca + rz * sa;
  out.pos.set(V3.x + dx * Math.cos(el) * D, V3.y + Math.sin(el) * D, V3.z + dz * Math.cos(el) * D); out.look.copy(V3); out.fov = fov; out.pitch = 0;
  out.lensY = sheet ? (portrait ? 0.24 : 0.16) : -0.04; out.sphere = { c: V3.clone(), R: 3.0, fTop: 0, fBot: 1 }; return out;
}
const HUD_TOP = () => { const u = document.getElementById('tc-ub'); return u ? u.getBoundingClientRect().bottom : 0; };
function finaleCheck() {
  const g = GOAL.sphere; if (!g) return; const st = (window.__finale = window.__finale || { frames: 0, out: 0, worst: 1 }); st.frames++;
  let worst = 1; for (const x of [-1, 1]) for (const y of [0, 1]) for (const z of [-1, 1]) { V2.set(x * 1.0, y * Math.max(1.9, (lastLay ? lastLay.top : 1.4) + 0.15), z * 2.8).applyMatrix4(UTE.root.matrixWorld).project(camera); const sx = (V2.x + 1) / 2, sy = (1 - V2.y) / 2; worst = Math.min(worst, sx, 1 - sx, sy - g.fTop, g.fBot - sy); }
  st.worst = Math.min(st.worst, +worst.toFixed(3)); if (worst < 0) st.out++;
}
const GOAL = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 64, pitch: 0, lensY: 0 }, GOAL2 = { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 64, pitch: 0, lensY: 0 };
const ease = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
function placeCam(fdt, mode, top) {
  const s = L.S, H = s.hold;
  holdVis += ((H && (H.phase === 'choose' || H.phase === 'in') && mode === 'play' ? 1 : 0) - holdVis) * Math.min(1, fdt * 6);
  let direct = false;
  if (mode === 'attract' || (mode === 'play' && introT.t >= 0 && s.rt - introT.t < 2.8)) {
    introGoal(GOAL); shotName = 'opening';
    if (mode === 'play') { const k = ease((s.rt - introT.t) / 2.8); kitChase(GOAL2, mode, fdt); orbitLerp(GOAL.pos, GOAL2.pos, k, GOAL.fov + (GOAL2.fov - GOAL.fov) * k); GOAL.look.lerp(GOAL2.look, Math.pow(smooth(0.25, 1, k), 1.8)); GOAL.fov += (GOAL2.fov - GOAL.fov) * k; GOAL.pitch = GOAL2.pitch * k; GOAL.lensY += (GOAL2.lensY - GOAL.lensY) * k; }
    direct = true;
  } else if (s.done && !(ARR.on && finaleE() < ARR.T + 0.15)) { finaleGoal(GOAL); shotName = s.reveal ? 'finale' : 'fail'; }
  else if (H && H.phase === 'fit') { buildGoal(GOAL, H.k); const k = ease(H.tf / 0.55); if (!buildPose.have) { buildPose.pos.copy(camPos); buildPose.look.copy(lookPos); buildPose.fov = camFov; buildPose.have = true; } GOAL.pos.lerpVectors(buildPose.pos, GOAL.pos, k); GOAL.look.lerpVectors(buildPose.look, GOAL.look, k); GOAL.fov = buildPose.fov + (GOAL.fov - buildPose.fov) * k; GOAL.pitch = camDelta * (1 - k); direct = true; shotName = 'build' + (H.k + 1); }
  else if (H && H.phase === 'go') {
    /* one eased move back to the chase while game time ramps in (no countdown): blend from the held build pose to the rig's pose */
    if (!buildPose.held) { buildPose.pos.copy(camPos); buildPose.look.copy(lookPos); buildPose.fov = camFov; buildPose.held = true; } GOAL2.pos.copy(buildPose.pos); GOAL2.look.copy(buildPose.look); GOAL2.fov = buildPose.fov; GOAL2.lensY = -0.06; GOAL.noLead = true; chaseGoal(GOAL, mode, fdt); GOAL.noLead = false; const k = ease(H.tg / (CONFIG.hold.goT + CONFIG.hold.outT));
    GOAL.pos.lerpVectors(GOAL2.pos, GOAL.pos, k); GOAL.look.lerpVectors(GOAL2.look, GOAL.look, k); GOAL.fov = GOAL2.fov + (GOAL.fov - GOAL2.fov) * k; GOAL.pitch *= k; GOAL.lensY = GOAL2.lensY + (GOAL.lensY - GOAL2.lensY) * k; direct = true; shotName = 'return';
  }
  else if (SW.placeCamera && !Q.has('rig')) {
    /* the chase camera is the style test's own (same distance, height, pitch, lag), so the game frame matches the style frame */
    if (camera.view && camera.view.enabled) camera.clearViewOffset(); GOAL.lensX = 0; GOAL.lensY = 0; SW.placeCamera(U.uTime.value); { const kv = clamp((L.S.v * KS * PACE.k - 5) / 6, 0, 1); if (kv > 0) { camera.fov += 2.5 * kv; camera.updateProjectionMatrix(); } } { const s2 = L.S, tt2 = U.uTime.value, shk = s2.hold || s2.done ? 0 : 0.1 * s2.kick + (s2.onCorr ? 0.02 : 0) + 0.03 * RFC.rough * Math.min(1, s2.v / 8); if (shk > 1e-4) { camera.position.x += shk * Math.sin(tt2 * 31); camera.position.y += shk * Math.sin(tt2 * 37 + 1.3); } } camera.updateMatrixWorld(); camera.getWorldDirection(V4); camPos.copy(camera.position); lookPos.copy(camera.position).addScaledVector(V4, 10); camVel.set(0, 0, 0); lookVel.set(0, 0, 0); camFov = camera.fov; camDelta = 0; buildPose.have = false; buildPose.held = false; shotName = 'chase'; safeFrame(); return;
  }
  else { chaseGoal(GOAL, mode, fdt); buildPose.have = false; buildPose.held = false; shotName = 'chase'; }
  if (camSnap || direct) { camPos.copy(GOAL.pos); lookPos.copy(GOAL.look); const vx = s.v * Math.sin(IP[PYAW]), vz = s.v * Math.cos(IP[PYAW]); camVel.set(vx * (s.hold ? s.scale : 1), 0, vz * (s.hold ? s.scale : 1)); lookVel.copy(camVel); if (s.done || (s.hold && s.hold.phase === 'fit')) { camVel.set(0, 0, 0); lookVel.set(0, 0, 0); } camDelta = GOAL.pitch; camFov = GOAL.fov; camSnap = false; }
  else { springTo(camPos, camVel, GOAL.pos, s.done ? 7 : 7, fdt); springTo(lookPos, lookVel, GOAL.look, s.done ? 11 : 11, fdt); const k = 1 - Math.exp(-fdt * 8); camDelta += (GOAL.pitch - camDelta) * k; camFov += (GOAL.fov - camFov) * k; }
  const shk = s.done || H ? 0 : 0.006 * (s.v / CONFIG.cruise) + 0.1 * s.kick + (s.onCorr ? 0.02 : 0) + 0.03 * RFC.rough * Math.min(1, s.v / 8), tt = U.uTime.value;
  camera.position.set(camPos.x + shk * Math.sin(tt * 31), camPos.y + shk * Math.sin(tt * 37 + 1.3), camPos.z);
  camera.lookAt(lookPos); camera.rotateX(camDelta);
  if (camera.fov !== camFov) { camera.fov = camFov; camera.updateProjectionMatrix(); }
  const lx = VW > VH && ((shotName === 'opening' && coreMode === 'attract') || shotName === 'finale' || shotName === 'fail') ? 0.17 : (VH > VW && shotName === 'opening' && coreMode === 'attract' ? PORT.lx : 0); GOAL.lensX = GOAL.lensX == null ? lx : GOAL.lensX + (lx - GOAL.lensX) * Math.min(1, fdt * 4);
  if (Math.abs(GOAL.lensY) > 1e-4 || Math.abs(GOAL.lensX) > 1e-4) camera.setViewOffset(VW, VH, GOAL.lensX * VW, GOAL.lensY * VH, VW, VH); else if (camera.view && camera.view.enabled) camera.clearViewOffset();
  camera.updateMatrixWorld();
  if (shotName === 'chase' || shotName === 'return') safeFrame();
  if (shotName === 'finale' || shotName === 'fail') finaleCheck();
}
/* safe frame: the ute's box (body plus the pile) stays above 8% from the bottom and inside the sides; pulled back along the view if not */
const SAFE = { bottom: 0.92, side: 0.0 }, BX = {}, BOXC = []; for (const x of [-1, 1]) for (const y of [0, 1]) for (const z of [-1, 1]) BOXC.push([x, y, z]);
function uteBox(out) { const hy = 1.95 + Math.ceil(L.S.pile.length / 6) * 0.34 * 0.6; let a = 1e9, b = -1e9, c = -1e9, d = 1e9; for (const [x, y, z] of BOXC) { V2.set(x * 0.98, y * hy + 0.05, z > 0 ? 2.75 : -2.75).applyMatrix4(UTE.tilt.matrixWorld).project(camera); const sx = (V2.x + 1) / 2, sy = (1 - V2.y) / 2; a = Math.min(a, sx); b = Math.max(b, sx); c = Math.max(c, sy); d = Math.min(d, sy); } out.minX = a; out.maxX = b; out.maxY = c; out.minY = d; return out; }
let safeEl = null;
function safeFrame() {
  for (let pass = 0; pass < 3; pass++) { uteBox(BX); const over = Math.max(BX.maxY - SAFE.bottom, SAFE.side - BX.minX, BX.maxX - (1 - SAFE.side), 0); if (over <= 0) break; camera.getWorldDirection(V4); camera.position.addScaledVector(V4, -Math.min(1.2, over * 9)); camPos.addScaledVector(V4, -Math.min(1.2, over * 9)); camera.updateMatrixWorld(); }
  uteBox(BX); const st = (window.__safe = window.__safe || { frames: 0, worstBottom: 1, worstSide: 1, violations: 0 }); st.frames++;
  const mb = SAFE.bottom - BX.maxY, ms = Math.min(BX.minX - SAFE.side, 1 - SAFE.side - BX.maxX); if (mb < st.worstBottom) st.worstBottomAt = +L.S.s.toFixed(1); if (ms < st.worstSide) st.worstSideAt = +L.S.s.toFixed(1); st.worstBottom = Math.min(st.worstBottom, +mb.toFixed(4)); st.worstSide = Math.min(st.worstSide, +ms.toFixed(4)); if (mb < -0.002 || ms < -0.002) st.violations++;
  if (DEBUG === 'safeframe') { if (!safeEl) { safeEl = document.createElement('div'); safeEl.style.cssText = 'position:fixed;z-index:30;pointer-events:none;border:2px solid #0f0'; document.body.appendChild(safeEl); } safeEl.style.left = BX.minX * VW + 'px'; safeEl.style.top = BX.minY * VH + 'px'; safeEl.style.width = (BX.maxX - BX.minX) * VW + 'px'; safeEl.style.height = (BX.maxY - BX.minY) * VH + 'px'; }
}
/* clear lens (QA, ?debug=lens): every authored-shot frame casts rays from the camera to 9 points on the ute; any hit on the world counts */
const RAY = new THREE.Raycaster();
function lensCheck() {
  if (shotName === 'chase') return; const st = (window.__lens = window.__lens || {}), r = st[shotName] || (st[shotName] = { frames: 0, blocked: 0, worst: 0 }); r.frames++;
  const occ = SW.chunkMeshes.filter(c => c && c.visible).concat(gateDyn); let hit = 0;
  for (const [x, y, z] of [[0, 1, 0], [0.8, 0.8, 1.8], [-0.8, 0.8, 1.8], [0.8, 0.8, -2.4], [-0.8, 0.8, -2.4], [0, 1.6, 0.3], [0, 1.2, -1.8], [0.9, 0.5, 0], [-0.9, 0.5, 0]]) { V2.set(x, y, z).applyMatrix4(UTE.inner.matrixWorld); V3.subVectors(V2, camera.position); const d = V3.length(); RAY.set(camera.position, V3.normalize()); RAY.far = d - 0.05; if (RAY.intersectObjects(occ, true).length) hit++; }
  if (hit) r.blocked++; r.worst = Math.max(r.worst, hit / 9);
}
/* grounding (QA): each wheel's bottom against the drawn ground under it */
function groundCheck() {
  /* the style rig spins and lifts each axle pair: its two tyres' contact points against the drawn ground */
  const st = (window.__ground = window.__ground || { frames: 0, maxErr: 0, sum: 0, n: 0 }); if (L.S.hold || L.S.done || L.S.t < 0.5) return; st.frames++;
  for (const a of UTE.axles || []) for (const x of (a.steer ? [0] : [0.82, -0.82])) { V2.set(x, -UTE.wheelR, 0).applyMatrix4(a.axle.matrixWorld); const tt = W.toTrack(V2.x, V2.z, L.S.s), e = Math.abs(V2.y - W.GH(tt[0], tt[1])); if (e > st.maxErr) { st.maxErr = e; st.at = +L.S.s.toFixed(1); st.u = +tt[1].toFixed(2); } st.sum += e; st.n++; }
  st.mean = +(st.sum / Math.max(1, st.n)).toFixed(4);
}
/* chunk culling by the trail window and the view cone; prominent brand pieces: only the nearest one ahead is shown */
const FR = new THREE.Frustum(), PM = new THREE.Matrix4();
let cullN = 0;
function cull() {
  PM.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse); FR.setFromProjectionMatrix(PM); const s = ws(L.S.s); cullN = 0;
  for (const c of SW.chunkMeshes) { if (!c.geometry.boundingBox) c.geometry.computeBoundingBox(); const s0 = c.userData.s0, ok = s0 + 40 > s - CULLW.behind && s0 < s + CULLW.far && FR.intersectsBox(c.geometry.boundingBox); c.visible = ok; if (ok) cullN++; }
  const items = gateDyn.map(g => ({ o: g, s: g.userData.s }));
  let best = null, bd = 1e9; for (const it of items) { const d = it.s - s; if (d > -12 && d < 190 && d < bd) { bd = d; best = it; } }
  for (const it of items) it.o.visible = it === best || Math.abs(it.s - s) < 60;
  for (const b of bonusG) { b.visible = false; continue; const B = b.userData.b, e = B.state === 'got' ? L.S.rt - B.gotAt : -1; b.visible = B.s - s < 150 && B.s - s > -10 && (e < 0 || e < 0.5); if (b.visible) { b.userData.pm.opacity = e >= 0 ? 0.8 * (1 - e / 0.5) : B.state === 'missed' ? 0.1 : 0.28 + 0.1 * Math.sin(U.uTime.value * 4); b.scale.setScalar(e >= 0 ? 1 + e * 1.5 : 1); } }
}
/* ---------------------------------------------------------------- the pop-up turntables: the chosen products spun in scissored viewports */
let ttScene = null, ttCam = null, ttObjs = {}, ttRim = null, ttSpin = {}, panelQ = null;
let dimQ = null, dimK = 0;
function dimPass(on, dt) {
  dimK += ((on ? 1 : 0) - dimK) * Math.min(1, dt * 8); if (dimK < 0.01) return;
  if (!dimQ) { const m = new THREE.ShaderMaterial({ uniforms: { uK: { value: 0 } }, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, vertexShader: 'varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: 'uniform float uK; varying vec2 vUv; void main(){ vec2 q = vUv - vec2(0.5, 0.54); float r = length(q * vec2(1.0, 1.3)); gl_FragColor = vec4(0.0, 0.0, 0.0, uK * mix(0.88, 0.93, smoothstep(0.1, 0.75, r))); }' }); const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); const q = new THREE.Mesh(tri, m); q.frustumCulled = false; dimQ = { scene: new THREE.Scene(), cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), m }; dimQ.scene.add(q); }
  dimQ.m.uniforms.uK.value = dimK; renderer.autoClear = false; renderer.render(dimQ.scene, dimQ.cam); renderer.autoClear = true;
}
function turntables(rects, dt) {
  if (!rects.length || !fitRoot) return;
  if (!ttScene) {
    ttScene = new THREE.Scene(); ttCam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    const key = new THREE.DirectionalLight(0xfff4e4, 3.4); key.position.set(2, 3, 2.5); const fill = new THREE.HemisphereLight(0xc8d0f0, 0x5a4a3a, 1.9); ttRim = new THREE.DirectionalLight(0xffe0b0, 3.2); ttRim.position.set(-2, 1.5, -3);
    ttScene.add(key, fill, ttRim);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.06, 0.08, 40), new THREE.MeshBasicMaterial({ color: 0x15120c, toneMapped: false })); pad.scale.set(0.72, 1, 0.72); const halo = new THREE.Mesh(new THREE.RingGeometry(0.74, 0.8, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffc600, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    ttScene.userData = { pad, halo }; ttScene.add(pad, halo);
    const mp = []; for (let i = 0; i < 7; i++) mp.push((Math.random() - 0.5) * 2.4, 0.2 + Math.random() * 1.4, (Math.random() - 0.5) * 2.4);
    const motes = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(mp, 3)), new THREE.PointsMaterial({ color: 0xfff0a0, size: 0.022, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })); ttScene.add(motes); ttScene.userData.motes = motes;
  }
  const dpr = renderer.getPixelRatio(), sk = U.uShadowK.value, ex = U.uExposure.value, fd = U.uFogD.value; U.uShadowK.value = 0; U.uFogD.value = 0; const keepUte = UT.UU.uUteF.value.clone(); UT.UU.uUteF.value.set(-9999, 0, 0, 0);
  renderer.autoClear = false; renderer.setRenderTarget(null);
  for (const r of rects) {
    const P = PRODS[r.id]; if (!P || r.op < 0.05) continue;
    /* the card's own opaque panel (near-black, a soft lift at the top), drawn before its turntable */
    if (!r.card) r.card = { x: r.x, y: r.y, w: r.w, h: r.h };
    if (r.card) { if (!panelQ) { const m = new THREE.ShaderMaterial({ uniforms: { uSel: { value: 0 } }, depthTest: false, depthWrite: false, toneMapped: false, vertexShader: 'varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: 'uniform float uSel; varying vec2 vUv; void main(){ float g = smoothstep(0.0, 1.0, vUv.y); float c = mix(0.02, 0.075 + 0.03 * uSel, g) * (1.0 - 0.25 * pow(abs(vUv.x - 0.5) * 2.0, 2.0)); gl_FragColor = vec4(c, c * 0.96, c * 0.9, 1.0); }' }); const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); const q = new THREE.Mesh(tri, m); q.frustumCulled = false; panelQ = { scene: new THREE.Scene(), cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), m }; panelQ.scene.add(q); }
      const c = r.card; panelQ.m.uniforms.uSel.value = r.sel ? 1 : 0; renderer.setViewport(c.x, VH - c.y - c.h, c.w, c.h); renderer.setScissor(c.x, VH - c.y - c.h, c.w, c.h); renderer.setScissorTest(true); renderer.render(panelQ.scene, panelQ.cam); }
    let o = ttObjs[r.id]; if (!o) { const src = P.base.mixer ? P.base.grp : P.base.grp; o = new THREE.Group(); const inner = P.base.mixer ? src.clone(true) : src.clone(true); inner.position.set(-P.base.centre.x, -P.base.box.min.y, -P.base.centre.z); inner.traverse(q => { q.visible = true; q.frustumCulled = false; }); o.add(inner); o.userData.size = Math.max(P.base.size.x, P.base.size.z, P.base.size.y * 1.4); ttObjs[r.id] = o; if (P.base.mixer) { const mx = new THREE.AnimationMixer(inner); const a = mx.clipAction(P.base.clip); a.play(); mx.setTime(P.base.clip.duration * 0.5); } }
    ttSpin[r.id] = (ttSpin[r.id] || 0) + dt * (2 * Math.PI / (r.sel ? 3.2 : 7));
    ttScene.children.filter(c => c.isGroup).forEach(c => ttScene.remove(c)); ttScene.add(o);
    const sz = P.base.size, R = 0.5 * Math.hypot(sz.x, sz.y, sz.z), k = 1.0 / Math.max(R, 1e-3); o.scale.setScalar(k); o.rotation.set(0.12, ttSpin[r.id], 0); o.position.y = 0.06;
    ttScene.userData.halo.material.opacity = (r.sel ? 0.55 : r.dim ? 0.12 : 0.3) * (0.8 + 0.2 * Math.sin(U.uTime.value * 3)); ttScene.userData.motes.rotation.y = U.uTime.value * 0.12;
    /* the unit sphere (the product, radius 1 after scaling) plus the pad (radius 1.32 at the base) stay inside 80% of the smaller side */
    ttCam.aspect = r.w / r.h; ttCam.fov = 30; const half = Math.min(15, Math.atan(Math.tan(15 * Math.PI / 180) * ttCam.aspect) * 180 / Math.PI) * Math.PI / 180, dist = 1.0 / Math.sin(half) / 0.8;
    ttCam.position.set(0, 0.55 + dist * Math.sin(0.3), dist * Math.cos(0.3)); ttCam.lookAt(0, 0.55, 0); ttCam.near = 0.1; ttCam.far = dist + 10; ttCam.updateProjectionMatrix();
    ttScene.userData.pad.position.y = -0.0; o.position.y = 0.55 - (P.base.size.y * k) / 2 + 0.06;
    const x = Math.round(r.x * dpr), y = Math.round((VH - r.y - r.h) * dpr), w = Math.round(r.w * dpr), h = Math.round(r.h * dpr);
    renderer.setViewport(r.x, VH - r.y - r.h, r.w, r.h); renderer.setScissor(r.x, VH - r.y - r.h, r.w, r.h); renderer.setScissorTest(true);
    renderer.clearDepth(); const tm = renderer.toneMapping; renderer.toneMappingExposure = r.dim ? 0.55 : 1; renderer.render(ttScene, ttCam); renderer.toneMappingExposure = 1; renderer.toneMapping = tm;
    void x; void y; void w; void h;
  }
  renderer.setScissorTest(false); renderer.setViewport(0, 0, VW, VH); renderer.autoClear = true;
  U.uShadowK.value = sk; U.uExposure.value = ex; U.uFogD.value = fd; UT.UU.uUteF.value.copy(keepUte);
}

/* ---------------------------------------------------------------- the frame: the core's draw only records; the style world's frame calls the hooks */
let coreMode = 'attract', coreTop = 0, coreAlpha = 1, lastNow = performance.now(), frameDt = 0.016, prevMode = '';
export function draw(ctx, Wd, Hd, t, mode, top, alpha) { coreMode = mode; coreTop = top; coreAlpha = alpha != null ? clamp(alpha, 0, 1) : 1; }
const GH_AT = (x, z, hint) => { const q = W.toTrack(x, z, hint); return W.GH(q[0], q[1]); };
export function hookPoseUte(t) {
  if (!UTE) return 0; applySize();
  const s = L.S, now = performance.now(); frameDt = Math.min(0.1, (now - lastNow) / 1000); lastNow = now;
  if (builtFor !== L.resetId) { builtFor = L.resetId; PREV.set(POSE); camSnap = true; HUD.reset(); for (let i = 0; i < GV.length; i++) if (GV[i]) GV[i].st = ''; pileSt.x = pileSt.xv = pileSt.z = pileSt.zv = 0; pileSt.impN = s.imp.n; if (gfx) gfx.reset(11); introT.t = -1; }
  if (coreMode === 'play' && prevMode === 'attract') { introT.t = s.rt; ATT.dip = 0.4; ATT.dipT = 0.4; INV.prev = null; } prevMode = coreMode;
  const a = coreAlpha, tt = performance.now() / 1000, rt = s.rt + a / 60, gfdt = frameDt * (s.done ? 1 : s.scale);
  for (let i = 0; i < NP; i++) IP[i] = PREV[i] + (POSE[i] - PREV[i]) * a;
  if (coreMode === 'attract') attractPose(); else ATT.t = -1;
  poseUte();
  L.trailAt(IP[PS], 0, PT); const thS = PT.th;
  if (!FREED.done && ++FREED.n > 60 && SW.freeBuild) { FREED.done = true; const t0 = performance.now(), n = SW.freeBuild(); console.info('world build arrays freed: ' + (n / 1e6).toFixed(1) + 'M values in ' + (performance.now() - t0).toFixed(0) + ' ms'); }
  phaseWatch(); rfFrame(); markersFrame(); fpsFrame(frameDt); gearFrame(rt, tt, frameDt, gfdt, thS);
  productFrame(rt, tt);
  return 0;
}
/* the game's ute position for the style world's life sims (roos and emus react to it) */
export function hookPose() { return { s: ws(IP[PS]), u: IP[PU], th: IP[PYAW], x: IP[PX], z: IP[PZ], loop: 0 }; }
export function hookCamera() { placeCam(frameDt, coreMode, coreTop); camClear(); camLog(); if (window.__camQA) { const q = window.__camQA(); const R0 = UTE.root; R0.updateMatrixWorld(true); camera.position.set(...q.p).applyMatrix4(R0.matrixWorld); V4.set(...q.l).applyMatrix4(R0.matrixWorld); camera.lookAt(V4); camera.fov = q.fov || 50; if (camera.view && camera.view.enabled) camera.clearViewOffset(); camera.updateProjectionMatrix(); camera.updateMatrixWorld(); } }
export function hookFx() {
  const s = L.S; if (coreMode === 'attract') { const c = Math.cos(IP[PYAW]), sn = Math.sin(IP[PYAW]), wh = []; for (let k = 2; k < 4; k++) { const x = IP[PX] + WHX[k] * c + WHZ[k] * sn, z = IP[PZ] - WHX[k] * sn + WHZ[k] * c; wh.push({ x, z, y: IP[PW0 + k], rear: true, side: WHX[k] > 0 ? -1 : 1 }); } gfx.step(Math.min(0.05, frameDt), { wheels: wh, speed: 7.5, swerve: 0, bump: 0, fwd: [sn, c], ground: (x, z) => gAt(x, z), jump: false }); return; }
  const gfdt = frameDt * (s.done ? 1 : s.scale); if (!(gfdt > 0) || s.hold) return;
  if (s.done) { if (!ARR.on || ARR.v < 0.2) { gfx.step(gfdt, { wheels: [], speed: 0, swerve: 0, bump: 0, fwd: [0, 1], ground: (x, z) => gAt(x, z), jump: false }); return; } const R = UTE.root, c = Math.cos(R.rotation.y), sn = Math.sin(R.rotation.y), wh = []; for (let k = 2; k < 4; k++) { const x = R.position.x + WHX[k] * c + WHZ[k] * sn, z = R.position.z - WHX[k] * sn + WHZ[k] * c; wh.push({ x, z, y: gAt(x, z), rear: true, side: WHX[k] > 0 ? -1 : 1 }); } gfx.step(gfdt, { wheels: wh, speed: Math.min(7.5, ARR.v), swerve: 0, bump: 0, fwd: [sn, c], ground: (x, z) => gAt(x, z), jump: false }); return; }
  const wheels = [], c = Math.cos(IP[PYAW]), sn = Math.sin(IP[PYAW]);
  for (let k = 2; k < 4; k++) { const x = IP[PX] + WHX[k] * c + WHZ[k] * sn, z = IP[PZ] - WHX[k] * sn + WHZ[k] * c; wheels.push({ x, z, y: IP[PW0 + k], rear: true, side: WHX[k] > 0 ? -1 : 1 }); }
  /* the kit's dust as in the style test: rear tyres, its own speed scale (7.5 m/s), light swerve and bump */
  gfx.step(gfdt, { wheels, speed: Math.min(7.5, s.v), swerve: Math.min(0.5, Math.abs(s.veh.r || 0)), bump: Math.min(1, s.kick + 0.6 * RFC.rough + (RFC.burst > 0 ? 0.8 : 0)), fwd: [Math.sin(IP[PYAW]), Math.cos(IP[PYAW])], ground: (x, z) => GH_AT(x, z, s.s), jump: false }); RFC.burst = Math.max(0, (RFC.burst || 0) - gfdt); return;
  gfx.step(gfdt, { wheels, speed: s.v, fwd: [Math.sin(IP[PYAW]), Math.cos(IP[PYAW])], swerve: Math.min(1, Math.abs(s.veh.r || 0) * 2), bump: Math.min(1, s.kick + (s.onCorr ? 0.6 : 0)), ground: (x, z) => GH_AT(x, z, s.s), jump: false });
}
export function hookBeforeRender() {
  const att = coreMode === 'attract'; cull(); if (signMesh) signMesh.visible = !att && !(L.S.hold && L.S.hold.phase === 'fit'); if (postMesh) postMesh.visible = !att; if (dressMesh) dressMesh.visible = !att; for (const G of GEAR) if (G) G.im.visible = !att; if (ringIM) ringIM.visible = !att; if (gearShadowIM) gearShadowIM.visible = !att;
  renderer.toneMappingExposure *= attractDip(frameDt); blurFrame(!Q.has('noblur') && (att || (typeof UIB !== 'undefined' && UIB.active() && UIB.phase() === 'end'))); if (PARK.k > 0) renderer.toneMappingExposure *= 1 + 0.25 * PARK.k;
  if (!SW.LOW) { if (!finLight) { finLight = new THREE.PointLight(0xffa050, 0, 14, 1.4); scene.add(finLight); } if (PARK.k > 0 && PARK.have) { finLight.position.set(PARK.x * 0.7 + PARK.fx * 0.3, PARK.gy + 2.2, PARK.z * 0.7 + PARK.fz * 0.3); finLight.intensity = 7 * PARK.k * (0.9 + 0.1 * U.uFlicker.value); } else finLight.intensity = 0; }
  { const on = !!(L.S.done && L.S.reveal && coreMode !== 'end'); if (on !== revealUi) { revealUi = on; document.body.classList.toggle('tc-reveal', on); if (!document.getElementById('tc-reveal-css')) { const st = document.createElement('style'); st.id = 'tc-reveal-css'; st.textContent = 'body.tc-reveal #tc-ub{visibility:hidden !important}'; document.head.appendChild(st); } } }
  const s = L.S; 
  if (Q.get('ui') === '0') document.body.classList.add('tc-noui');
}
const INV = { prev: null, playAt: -1, lastMode: '' };
const INV_BOX = [[-1, 0, -2.8], [1, 0, -2.8], [-1, 2.1, -2.8], [1, 2.1, -2.8], [-1, 0, 2.65], [1, 0, 2.65], [-1, 2.1, 2.65], [1, 2.1, 2.65]];
let INV_PTS = null;
function invPoints() {
  if (INV_PTS) return INV_PTS; const R0 = UTE.root; R0.updateMatrixWorld(true); const iv = new THREE.Matrix4().copy(R0.matrixWorld).invert(), M = new THREE.Matrix4(), P = new THREE.Vector3(), N = 194, dirs = [], best = [];
  for (let k = 0; k < N; k++) { const y = 1 - 2 * (k + 0.5) / N, r = Math.sqrt(1 - y * y), a = k * 2.39996; dirs.push([Math.cos(a) * r, y, Math.sin(a) * r]); best.push([-1e9, 0, 0, 0]); }
  R0.traverseVisible(o => { if (!o.isMesh || o.isInstancedMesh || !o.geometry || !o.geometry.attributes.position) return; const pa = o.geometry.attributes.position; M.multiplyMatrices(iv, o.matrixWorld);
    for (let q = 0; q < pa.count; q++) { P.fromBufferAttribute(pa, q).applyMatrix4(M); for (let k = 0; k < N; k++) { const d = dirs[k], e = P.x * d[0] + P.y * d[1] + P.z * d[2]; if (e > best[k][0]) { best[k][0] = e; best[k][1] = P.x; best[k][2] = P.y; best[k][3] = P.z; } } } });
  INV_PTS = best.filter(b => b[0] > -1e8).map(b => [b[1], b[2], b[3]]); window.__invPts = INV_PTS.length; window.__invP = INV_PTS; return INV_PTS;
}
function invariant() {
  if (!Q.has('invariant')) return; const st = (window.__inv = window.__inv || { maxLift: 0 }); Object.assign(st, Object.assign({ frames: 0, box: 0, centre: 0, height: 0, move: 0, worstEdge: 0, worstHeight: null, worstMove: 0, at: [] }, st));
  const now = performance.now() / 1000; if (coreMode === 'play' && INV.lastMode === 'attract') INV.playAt = now; INV.lastMode = coreMode;
  const att = coreMode === 'attract', early = coreMode === 'play' && INV.playAt > 0 && now - INV.playAt < 3; if (!att && !early) { INV.prev = null; return; }
  st.frames++; const R0 = UTE.root; R0.updateMatrixWorld(true); camera.updateMatrixWorld(); let edge = 0;
  const PTS = att ? invPoints() : (INV_PTS || INV_BOX); let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
  for (const c of PTS) { V2.set(c[0], c[1], c[2]).applyMatrix4(R0.matrixWorld).project(camera); edge = Math.max(edge, Math.abs(V2.x), Math.abs(V2.y)); x0 = Math.min(x0, V2.x); x1 = Math.max(x1, V2.x); y0 = Math.min(y0, V2.y); y1 = Math.max(y1, V2.y); }
  const cx = (UTE_SCREEN.x + 1) / 2, cy = (1 - UTE_SCREEN.y) / 2, h = camera.position.y - IP[PBASE], dip = ATT.dip > 0;
  const mv = INV.prev ? camera.position.distanceTo(INV.prev) : 0; INV.prev = (INV.prev || new THREE.Vector3()).copy(camera.position);
  const tag = (k, v) => { st[k]++; if (st.at.length < 12) st.at.push([k, coreMode, +v.toFixed(3), +(ATT.s || 0).toFixed(1), VW, VH]); };
  if (edge > 1) tag('box', edge); if (cx < 0.12 || cx > 0.88 || cy < 0.12 || cy > 0.88) tag('centre', Math.max(Math.abs(cx - 0.5), Math.abs(cy - 0.5)));
  if (early) { st.early = st.early || []; if (st.early.length < 200) st.early.push([+(now - INV.playAt).toFixed(2), +x0.toFixed(2), +x1.toFixed(2), +y0.toFixed(2), +y1.toFixed(2), +Math.hypot(camera.position.x - IP[PX], camera.position.z - IP[PZ]).toFixed(1), +wrapA2(Math.atan2(camera.position.x - IP[PX], camera.position.z - IP[PZ]) - IP[PYAW]).toFixed(2), +camera.fov.toFixed(0)]); }
  if (att && (h < 1.2 || h > 3.2)) tag('height', h);
  if (att && VH > VW) {
    const top = (1 - y1) / 2 * VH, bot = (1 - y0) / 2 * VH, hd = document.querySelector('.rk-ps__h'), ob = document.querySelector('.rk-ps__bot');
    const hb = hd ? hd.getBoundingClientRect().bottom : 0, ot = ob ? ob.getBoundingClientRect().top : VH; st.band = st.band || 0;
    if (hd && ob && (top < hb || bot > ot)) tag('band', top < hb ? hb - top : bot - ot);
    const b = st.pbox = st.pbox || { x0: 9, x1: -9, y0: 9, y1: -9, head: 0, offer: 1, span: [9, -9] }, f = [(x0 + 1) / 2, (x1 + 1) / 2, top / VH, bot / VH];
    b.x0 = Math.min(b.x0, +f[0].toFixed(3)); b.x1 = Math.max(b.x1, +f[1].toFixed(3)); b.y0 = Math.min(b.y0, +f[2].toFixed(3)); b.y1 = Math.max(b.y1, +f[3].toFixed(3)); if (!b.wb || f[3] > b.wb[0]) b.wb = [+f[3].toFixed(3), +(ATT.s || 0).toFixed(1), +CAMC.off.toFixed(2), +h.toFixed(2), +camera.position.distanceTo(R0.position).toFixed(2), +(R0.rotation.y - IP[PYAW]).toFixed(3), +R0.rotation.x.toFixed(3), +(R0.position.y - IP[PBASE]).toFixed(2), +camera.fov.toFixed(1)]; if (!b.wt || f[2] < b.wt[0]) b.wt = [+f[2].toFixed(3), +(ATT.s || 0).toFixed(1), +CAMC.off.toFixed(2), +h.toFixed(2)]; b.head = +(hb / VH).toFixed(3); b.offer = +(ot / VH).toFixed(3); b.span = [Math.min(b.span[0], +(f[1] - f[0]).toFixed(3)), Math.max(b.span[1], +(f[1] - f[0]).toFixed(3))]; } if (!dip && mv > 0.6) tag('move', mv);
  st.worstEdge = Math.max(st.worstEdge, +edge.toFixed(3)); if (att) st.worstHeight = [Math.min(st.worstHeight ? st.worstHeight[0] : 9, +h.toFixed(3)), Math.max(st.worstHeight ? st.worstHeight[1] : -9, +h.toFixed(3))]; if (!dip) st.worstMove = Math.max(st.worstMove, +mv.toFixed(3));
}
export function hookAfterRender() {
  const s = L.S, KIT = UIB.active(); TTH.k ^= 1; if (KIT && UIB.popupShown() && TTH.k && !SW.LOW) { /* the odd frame: the overlay keeps the last copy */ } else { const rects = KIT ? (SW.LOW ? [] : UIB.cardRects()) : HUD.cardRects(); dimPass(KIT ? false : HUD.popupShown(), frameDt); turntables(rects, frameDt * (KIT && !SW.LOW ? 2 : 1)); if (KIT) UIB.blit(renderer.domElement, rects); }
  if (DEBUG === 'lens' || Q.has('vischeck')) lensCheck();
  if (coreMode === 'play') groundCheck(); wheelCheck(); invariant();
  UTE_SCREEN.set(IP[PX], IP[PBY] + 1.2, IP[PZ]).project(camera); TOPS.set(IP[PX], IP[PBY] + 1.8 + Math.ceil(s.pile.length / 6) * 0.34, IP[PZ]).project(camera);
  if (KIT) UIB.frame(); else { HUD.frame(coreMode, coreTop); HUD.uiFrame(AU.sfx); } if (!KIT) HUD.revealFrame(finaleE(), VW, VH, AU.sfx, TALLY_T0, tallyStep, (s.packed || []).length + s.pile.length + s.deck.length);
  AU.audioFrame({ frozen: !!s.hold && !(s.hold.phase === 'go') || (s.hold && s.hold.phase === 'go' && s.scale < 0.02) || (!s.done && s.scale < 0.98 && !s.hold), scale: s.done ? 1 : s.scale, v: s.v, vk: s.v / CONFIG.cruise, kick: s.kick, slip: Math.abs(s.veh.r || 0), corr: s.onCorr });
  const g = window.__game; if (g) { frames++; g.frames = frames; g.calls = renderer.info.render.calls; g.tris = renderer.info.render.triangles; g.mode = coreMode; g.shot = shotName; g.s = +s.s.toFixed(1); g.cull = cullN; const st = window.__style; if (st && st.info) { g.fps = st.info.fps; } }
}
const UTE_SCREEN = new THREE.Vector3(), TOPS = new THREE.Vector3();
export const uteScreen = () => ({ x: (UTE_SCREEN.x + 1) / 2 * VW, y: (1 - UTE_SCREEN.y) / 2 * VH, tx: (TOPS.x + 1) / 2 * VW, ty: (1 - TOPS.y) / 2 * VH });
export function hint() {
  const s = L.S; if (RT.mode === 'attract') { const el = document.getElementById('tc-go'); if (el) { const r = el.getBoundingClientRect(); if (r.width) return { x: r.left + r.width * 0.7, y: r.top + r.height * 0.4, dx: 0, dy: 0 }; } }
  if (s.hold || s.rt - s.holdEnd < 2.5 || s.reveal) return null;
  const u = uteScreen(); return { x: Math.max(60, Math.min(VW - 60, u.x)), y: Math.min(VH - 190, u.y + 90) };
}
export const perf = () => renderer ? { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures } : null;
/* QA: freeze a named shot (__shot) and expose internals */
window.__v2 = { get PL() { return PL; }, get LOAD() { return LOAD; }, get GEARN() { return GEAR.map(G => G ? G.n : -1); }, get camera() { return camera; }, get renderer() { return renderer; }, get scene() { return scene; }, get chunks() { return SW ? SW.chunkMeshes : []; }, get plan() { return PLAN; }, PRODS, get ute() { return UTE; }, uteScreen, get puts() { return PUTS; }, get terrN() { return TERR_N; }, get dressN() { return DRESS_N; } };
