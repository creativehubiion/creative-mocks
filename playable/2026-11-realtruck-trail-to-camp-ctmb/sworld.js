/* */
/* Trail to Camp, low-poly style frame (realtruck-01 / 05-style-test). The brand's ute on a stylised outback trail built from
   style-kit.js: generated road and banks, faceted props in one palette, baked long shadows, a colour script along the drive
   (golden hour -> sunset into the sun -> violet dusk at camp), the locked game camera, two static gameplay pieces.
   URL: ?tier=low|mid|desktop   ?aa=off|fxaa|msaa   ?ute=clean|chunky|real|stylised|gloss   ?moment=golden|sunset|dusk
        ?fly=1  drive the whole trail (all three moments)   ?cam=camp|high|beauty   ?t=<s> freeze the clock   ?stats   ?perf=0|1
        ?life=0 no birds/roo/tumbleweed/dust devils   ?ui=0 no options panel */
import * as THREE from 'three';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from './vendor/addons/libs/meshopt_decoder.module.js';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';
import * as K from './kit.js';
/* game layer hooks (06-game): absent in the style test, so this copy renders exactly like it */
const GAMEL = globalThis.__TC_GAME || null;
if (GAMEL && GAMEL.preKit) GAMEL.preKit(K);

const Q = new URLSearchParams(location.search);
const TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
const GPU0 = (() => { try { const c = document.createElement('canvas'), g = c.getContext('webgl2') || c.getContext('webgl'); if (!g) return ''; const x = g.getExtension('WEBGL_debug_renderer_info'); const s = String(x ? g.getParameter(x.UNMASKED_RENDERER_WEBGL) : g.getParameter(g.RENDERER)); const l = g.getExtension('WEBGL_lose_context'); if (l) l.loseContext(); return s; } catch (e) { return ''; } })();
const LOWGPU = /Mali|Adreno \(TM\) [3456]\d\d|PowerVR|SGX/i.test(GPU0) || (navigator.deviceMemory && navigator.deviceMemory <= 3);
const QT = Q.get('tier');
const TIER = QT === 'desktop' ? 'desktop' : QT === 'low' ? 'low' : QT === 'mid' ? 'mid' : !TOUCH ? 'desktop' : (/Apple/i.test(GPU0) && !LOWGPU ? 'mid' : 'low');
const LOW = TIER === 'low', HI = TIER === 'desktop';
let AA = ['off', 'fxaa', 'msaa'].includes(Q.get('aa')) ? Q.get('aa') : (HI ? 'msaa' : 'fxaa');
const MOMENT = ['golden', 'sunset', 'dusk'].includes(Q.get('moment')) ? Q.get('moment') : 'golden';
const DRIVE = Q.get('drive') === '1';
/* brand level: 0 none, 1 default (subtle), 2 heavier */
const BRAND = ['0', '1', '2'].includes(Q.get('brand')) ? +Q.get('brand') : 1;
const FLY = Q.get('fly') === '1' || DRIVE;
const LIGHT = ['golden', 'sunset', 'dusk'].includes(Q.get('light')) ? Q.get('light') : null;
let CAM = Q.get('cam') || 'chase';
let STATS = Q.has('stats');
const UI = Q.get('ui') !== '0';
const LIFE = Q.get('life') !== '0';
let PERF = Q.get('perf') === '1';
let FIXED_T = Q.has('t') ? parseFloat(Q.get('t')) : null;
let UTE = ['stylised', 'clean', 'chunky', 'real'].includes(Q.get('ute')) ? Q.get('ute') : null;
const DUSTLOOK = Q.get('dust') === 'facet' ? 'facet' : 'soft';
window.__style = { ready: false, errors: [], frames: 0, info: {} };
window.addEventListener('error', e => window.__style.errors.push(String(e.message)));
const status = document.getElementById('status');
const LOADT0 = performance.now();
const say = (t, p) => { if (status) { status.textContent = t; if (p !== undefined) status.style.setProperty('--p', p + '%'); } };

/* ---------------------------------------------------------------- tone curve: identity below 0.8 (the palette lands exactly), soft shoulder above */
THREE.ShaderChunk.tonemapping_pars_fragment = THREE.ShaderChunk.tonemapping_pars_fragment.replace('vec3 CustomToneMapping( vec3 color ) { return color; }', K.TONE_GLSL + '\nvec3 CustomToneMapping( vec3 color ) { return kitTone(color * toneMappingExposure); }');

/* ---------------------------------------------------------------- renderer */
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: AA === 'msaa' && !HI, powerPreference: 'high-performance', stencil: false });
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.CustomToneMapping;
const SHADOW_MAP = Q.get('shadow') === 'map' ? true : Q.get('shadow') === 'decal' ? false : HI, DYN_OFF = Q.get('dyn') === '0' || Q.has('scale'); let BADW = 0;
renderer.shadowMap.enabled = SHADOW_MAP; renderer.shadowMap.type = HI ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap; renderer.info.autoReset = false;
const DPR = Q.has('dpr') ? Math.max(1, Math.min(3, +Q.get('dpr') || 1)) : Math.min(window.devicePixelRatio || 1, LOW ? 1.5 : 2);
let SCALE = Q.has('scale') ? Math.max(0.5, Math.min(1, +Q.get('scale') || 1)) : 1; const SCALE_MIN = 0.7;
renderer.setPixelRatio(DPR);
const scene = new THREE.Scene();
/* depth range: near 0.8 m (the closest geometry to any camera is metres away), far 2700 m (just past the ground skirt; the sky dome
   is drawn at the far plane). With faces held 2-4 cm proud of their boards plus polygonOffset this removes distant z-fighting. */
const camera = new THREE.PerspectiveCamera(64, 1, 0.8, 2700); camera.rotation.order = 'YXZ';
const clock = new THREE.Clock();
const U = K.createUniforms(THREE);
const gltf = new GLTFLoader(); gltf.setMeshoptDecoder(MeshoptDecoder);
const loadGLB = url => new Promise((res, rej) => gltf.load(url, res, undefined, rej));
/* CC0 kit pieces (Kenney Nature Kit), recoloured into the palette; the world builds without them if any fail */
const KIT_NAMES = ['rock_largeA', 'rock_largeC', 'rock_largeE', 'rock_tallA', 'rock_tallE', 'rock_tallH', 'rock_smallA', 'rock_smallFlatB', 'rock_smallTopA', 'log', 'log_large', 'log_stack', 'stump_old', 'tent_detailedOpen', 'campfire_stones', 'campfire_logs', 'fence_simple', 'plant_bush', 'plant_bushLarge', 'plant_bushDetailed', 'plant_bushSmall'];
const KITM = {};
await Promise.all(KIT_NAMES.map(async n => { try { const g = await loadGLB(`assets/kit/${n}.glb`); KITM[n] = K.facetsFromScene(g.scene, n); } catch (e) { /* optional */ } }));
const kitSized = (n, h) => KITM[n] ? K.scaled(KITM[n], h / Math.max(0.05, KITM[n].size[1])) : null;
const worldMat = K.createWorldMaterial(THREE, U);

/* ---------------------------------------------------------------- the trail: 440 m of track with bends, a crest, a dry creek, a far rise */
const g = (s, c, w) => Math.exp(-(((s - c) / w) ** 2));
const CREEK_S = 200;
const heading0 = s => 0.2 * Math.sin((s - 40) / 80) + 0.08 * Math.sin((s + 10) / 38);
const heading = GAMEL ? s => heading0(s) + GAMEL.headingX(s) : heading0;
/* the first 300 m are the original trail; rises after 400 m (gorge floor, a long dusk rise) are new and add nothing before 300 m */
const roadY = s => 3.2 * g(s, 122, 30) + 1.2 * Math.sin(s / 37 + 0.5) + 2.6 * g(s, 292, 50) - 1.05 * g(s, CREEK_S, 7) + 2.4 * g(s, 455, 45) - 1.2 * g(s, 560, 30) + 3.0 * g(s, 735, 70) + 1.4 * g(s, 860, 40);
const T = K.trackFromFunctions(-70, 990, heading, roadY);
const TRAIL_END = 990, GORGE = [330, 600];
const creekCentre = u => CREEK_S + 7 * Math.sin(u / 23);
const creek = (s, u) => { const d = s - creekCentre(u); return -1.25 * Math.exp(-((d / 5.5) ** 2)) * K.smooth(150, 60, Math.abs(u)); };
const TOPT = { creek: (s, u, h) => (Math.abs(u) > K.ROAD.gutter ? creek(s, u) : 0) + (GAMEL && GAMEL.extraH ? GAMEL.extraH(s, u, h) : 0), road: GAMEL && GAMEL.roadH ? GAMEL.roadH : undefined };
const GH = (s, u) => K.groundHeight(T, s, u, TOPT);
const groundColour = (s, u, n) => {
  if (GAMEL && GAMEL.colour) { const c = GAMEL.colour(s, u, n); if (c) return c; }
  const cd = Math.abs(s - creekCentre(u));
  if (cd < 2.6 && Math.abs(u) > K.ROAD.gutter && Math.abs(u) < 150) return K.shade(K.C.sand, 1 + (K.hash2(s * 0.7, u * 0.9) - 0.5) * 0.08);
  /* past the camp pad the road gives way to the camp ground (a slightly paler, trodden ochre) */
  if (s > ROAD_END && Math.abs(u) <= K.ROAD.gutter + 6) return K.shade(K.mix3(K.C.earthOchre, K.C.sand, 0.35), 1 + (K.hash2(s * 0.37, u * 0.53) - 0.5) * 0.06);
  if (s > ROAD_END) return K.defaultGroundColour(s, 20 + Math.abs(u), n);
  return K.defaultGroundColour(s, u, n);
};
/* set pieces along the trail */
/* a row of seven camp-gear pickups, weaving gently left ahead of the rock fall */
const PICKUPS = GAMEL ? [] : [[54, 0.3, 'swag'], [58.5, 0, 'esky'], [63, -0.4, 'jerry'], [67.5, -0.8, 'firewood'], [72, -1.1, 'swag'], [76.5, -1.3, 'esky'], [81, -1.4, 'jerry']];
const HAZARD = { s: 92, u: 2.4 };
/* wildlife moments, staged for screen time from the game camera (see README): act 1 right (outside of the opening left bend), emus
   left in act 2, a sunset pair on the right rise, a dusk group left (outside of the closing right bend); watchers stay and watch */
/* hero moments (portrait): big reds standing upright 3.5 m off the road edge on the outside of a bend; the rest are background */
/* hero moments, one per stretch, on the outside of a bend 3.5 m off the road edge: act 1 (60 R), gorge (480 R, outside of the left bend), dusk (800 L, outside of the right bend) */
const ROO_DEFS = [{ s: 60, u: 7.3, watch: 1, big: 1 }, { s: 62.5, u: 7.6, watch: 1, big: 1 }, { s: 65, u: 10.5, joey: 1 }, { s: 68, u: 11.5 }, { s: 71, u: 12.4 },
  { s: 212, u: 14, calm: 1 }, { s: 216, u: 15.5, calm: 1, watch: 1 }, { s: 480, u: 7.3, watch: 1, big: 1 }, { s: 482.5, u: 7.6, watch: 1, big: 1 }, { s: 800, u: -7.3, watch: 1, big: 1 }, { s: 802.5, u: -7.6, watch: 1, big: 1 }, { s: 812, u: -11.2 }];
if ((GAMEL && GAMEL.lean)) ROO_DEFS.length = Math.min(ROO_DEFS.length, 9);
const ROO_GROUPS = { 'act 1 hero pair': [0, 2], 'act 1 mob': [2, 5], 'sunset pair': [5, 7], 'dusk hero pair': [7, 9], 'dusk background': [9, 10] };
const EMU_DEFS = [{ s: 168, u: -7.2 }, { s: 170.5, u: -8.2 }, { s: 173, u: -9.2 }];
const ANIMAL_ZONES = [[44, 84, 5, 20], [150, 200, -20, -5], [204, 224, 10, 24], [466, 500, 5, 20], [786, 820, -20, -5]];
const BRANDS = { billboard: { s: 116, u: -8.4, yaw: Math.PI + 0.5 }, gate: { s: 232 }, banner: { s: 910, u: -5.0, yaw: Math.PI + 0.2 } };
const EGG_SIGNS = [[() => K.wildlifeSign('emu'), 100, 6.2], [() => K.wildlifeSign('roo'), 158, 6.2], [() => K.tripleSign(), 205, -6.4], [() => K.wildlifeSign('wombat'), 90, -6.2], [() => K.wildlifeSign('cattle'), 244, 6.2]];
const TRAIL_TO_CAMP = 900, BOARDS = [[0.035, '5 km'], [0.45, '2 km'], [0.86, '500 m']].map(([k, d]) => ({ s: Math.round(k * TRAIL_TO_CAMP), u: 2.9, d, yaw: Math.PI - 0.65 }));
if (GAMEL && GAMEL.boards) { BOARDS.length = 0; for (const b of GAMEL.boards()) BOARDS.push(b); } if (GAMEL && GAMEL.brands) GAMEL.brands(BRANDS);
const ROAD_END = 905, GATE_S = 262, CAMP = { s: 918, u: -1.5 }, MILL = { s: 134, u: -34 }, SIGN = { s: 30, u: 6.4 };
const LOOPS = { golden: [-25, 46], sunset: [430, 500], dusk: [820, 880] };
const SPEED = FLY && !DRIVE ? 11 : 7.5;
const LOOP = FLY ? [-25, 895] : LOOPS[MOMENT];
const SWERVE = Q.get('swerve') === '1';
const laneU = s => (FLY ? -1.7 * K.smooth(78, 86, s) * K.smooth(104, 96, s) : 0) + (SWERVE ? 1.5 * Math.sin(s * 0.17) : 0);
const reserved = (s, u, r) => {
  if (GAMEL && GAMEL.reserved(s, u, r)) return true;
  if (Math.abs(u) < K.ROAD.bankTop + r && !(r < 0.6 && Math.abs(u) > K.ROAD.half + 0.4)) return true;
  if (Math.abs(s - GATE_S) < 6 + r && Math.abs(u) < 9) return true;
  for (const b of BOARDS) if (s > b.s - 50 && s < b.s + 4 && u > 2.5 && u < 16 + r) return true;
  for (const [a0, a1, b0, b1] of ANIMAL_ZONES) if (s > a0 - r && s < a1 + r && u > b0 - r && u < b1 + r && r > 0.5) return true;
  if (BRAND) { if (Math.abs(s - BRANDS.billboard.s) < 8 + r && Math.abs(u - BRANDS.billboard.u) < 8 + r) return true; if (Math.abs(s - BRANDS.gate.s) < 6 + r && Math.abs(u) < 11 + r) return true; }
  if (Math.hypot(s - CAMP.s, u - CAMP.u) < 10 + r) return true;
  if (s > ROAD_END - 120 && s < ROAD_END + 30 && Math.abs(u) < 7 + r) return true;
  if (Math.hypot(s - MILL.s, u - MILL.u) < 7 + r) return true;
  if (Math.abs(s - CREEK_S) < 7 && Math.abs(u) < 20 && r > 2) return true;
  return false;
};

/* ---------------------------------------------------------------- world build: chunks of 40 m, one draw each */
const CH0 = -70, CHL = 40, NCH = Math.ceil((TRAIL_END - CH0) / CHL);
const chunks = Array.from({ length: NCH }, () => new K.Facets());
const casters = [];
const chunkOf = s => Math.max(0, Math.min(NCH - 1, Math.floor((s - CH0) / CHL)));
const trkOf = hint => (x, z) => T.toTrack(x, z, hint);
const PLACED = [];
function put(part, s, u, o = {}) {
  if (GAMEL && GAMEL.skipPut && GAMEL.skipPut(part, s, u, o)) return;
  if (GAMEL && GAMEL.adjustU) u = GAMEL.adjustU(part, s, u, o);
  if (GAMEL && GAMEL.onPut) GAMEL.onPut(part, s, u, o);
  const w = T.world(s, u), y = GH(s, u) - (o.sink || 0), th = w.th;
  const f = chunks[chunkOf(s)], before = f.casters.length, v0 = f.P.length / 3;
  PLACED.push({ ci: chunkOf(s), v0, v1: v0 + part.P.length / 3, s, u, tag: o.tag || 'prop', tris: part.tris });
  f.add(part, { x: w.x, y: y + (o.lift || 0), z: w.z, yaw: th + (o.yaw || 0), s: o.s || 1, tilt: o.tilt || 0 }, trkOf(s));
  for (let i = before; i < f.casters.length; i++) { f.casters[i].s = s; casters.push(f.casters[i]); }
}
function buildWorld() {
  const r = K.rng(20261111);
  for (let i = 0; i < NCH; i++) { const a = CH0 + i * CHL; K.buildTerrain(chunks[i], T, a, a + CHL, { ...TOPT, colour: groundColour }); }
  if (GAMEL) GAMEL.terrainDone(chunks);
  /* occupancy grid to keep props apart */
  const occ = new Map(); const key = (s, u) => Math.round(s / 2.5) + ':' + Math.round(u / 2.5);
  const free = (s, u, rad) => { if (reserved(s, u, rad)) return false; const n = Math.ceil(rad / 2.5); for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) if (occ.get(Math.round(s / 2.5) + a + ':' + (Math.round(u / 2.5) + b)) >= rad * 0.5) return false; return true; };
  const mark = (s, u, rad) => occ.set(key(s, u), rad);
  const gumAt = (s, u, v, sc = 1) => { if (!free(s, u, 3)) return; mark(s, u, 3); put(K.gum(Math.floor(s * 7 + u * 13), v, Math.abs(u) > 34 ? 1 : 0), s, u, { yaw: r() * 6.28, s: sc, sink: 0.15 }); };
  const spinAt = (s, u, sc = 1) => { if (!free(s, u, 0.9)) return; mark(s, u, 0.9); put(K.spinifex(Math.floor(s * 31 + u * 7), Math.floor(r() * 3), Math.abs(u) > 22 ? 1 : 0), s, u, { yaw: r() * 6.28, s: sc * (0.85 + r() * 0.4), sink: 0.05 }); };
  const KROCK = ['rock_largeA', 'rock_largeC', 'rock_largeE', 'rock_smallA', 'rock_smallFlatB', 'rock_smallTopA'].filter(n => KITM[n]);
  const rockAt = (s, u, sc = 1, tint) => { if (!free(s, u, sc)) return; mark(s, u, sc);
    if (!tint && KROCK.length && r() < 0.55) { const p = kitSized(KROCK[Math.floor(r() * KROCK.length)], 0.75 * sc); put(p, s, u, { yaw: r() * 6.28, sink: 0.08 * sc }); return; }
    put(K.rock(Math.floor(s * 11 + u * 3), Math.floor(r() * 3), tint), s, u, { yaw: r() * 6.28, s: sc, sink: 0.12 * sc }); };
  const KBUSH = ['plant_bush', 'plant_bushLarge', 'plant_bushDetailed', 'plant_bushSmall'].filter(n => KITM[n]);
  const bushAt = (s, u, h = 0.9) => { if (!KBUSH.length || !free(s, u, 1)) return; mark(s, u, 1); put(kitSized(KBUSH[Math.floor(r() * KBUSH.length)], h * (0.8 + r() * 0.5)), s, u, { yaw: r() * 6.28, sink: 0.05 }); };
  const KTALL = ['rock_tallA', 'rock_tallE', 'rock_tallH'].filter(n => KITM[n]);
  const towerAt = (s, u) => { if (!KTALL.length || !free(s, u, 2.5)) return; mark(s, u, 2.5); put(kitSized(KTALL[Math.floor(r() * KTALL.length)], 2.6 + r() * 2.2), s, u, { yaw: r() * 6.28, sink: 0.2 }); };
  const moundAt = (s, u, v) => { if (!free(s, u, 1.2)) return; mark(s, u, 1.2); put(K.termite(Math.floor(s * 5 + u), v), s, u, { yaw: r() * 6.28, s: 0.9 + r() * 0.3, sink: 0.1 }); };
  /* hand-placed groups that compose the golden frame: gums on the left throwing shadows across the road ahead */
  gumAt(48, -9.5, 0, 1.05); gumAt(53, -13, 1); spinAt(46, -7.6); spinAt(50, -7.2, 1.2); spinAt(55, -8.5); rockAt(51, -7.4, 0.8);
  gumAt(101, -10.5, 0, 1.1); gumAt(106, -15, 2); spinAt(99, -7.8); spinAt(104, -8.2, 1.1); rockAt(108, -8.5, 1.1);
  gumAt(83, 12, 1, 0.95); spinAt(80, 8.2); spinAt(86, 7.6, 1.2); moundAt(88, 10.5, 0); moundAt(91, 13.5, 1);
  gumAt(24, -11, 2); moundAt(20, 9.5, 0); moundAt(16, 12.5, 1); spinAt(22, 7.6); spinAt(18, 8.4);
  gumAt(36, 15, 0); rockAt(40, 9.5, 1.4); rockAt(42, 10.8, 0.7); spinAt(38, 8.2, 1.1);
  { const L = K.log(5); if (free(66, 9.2, 2.5)) { mark(66, 9.2, 2.5); put(L, 66, 9.2, { yaw: 0.5, sink: 0.08 }); } }
  /* creek: river red gums along the banks, river stones in the bed */
  for (const u of [-34, -19, 16, 31, 52, -55]) gumAt(creekCentre(u) + (u > 0 ? 7.5 : -7.5), u, 1, 1.15);
  for (let i = 0; i < 40; i++) { const u = (r() - 0.5) * 70; if (Math.abs(u) < 6.2) continue; const s = creekCentre(u) + (r() - 0.5) * 6; put(K.rock(i + 900, Math.floor(r() * 2), 'rockGrey'), s, u, { yaw: r() * 6, s: 0.35 + r() * 0.35, sink: 0.05 }); }
  /* composed groups along the corridor, alternating sides */
  for (let s = -60; s < TRAIL_END - 30; s += (s > GORGE[0] && s < GORGE[1] ? 11 : s > 620 ? 20 : 14) + r() * 12) {
    const side = r() < 0.5 ? -1 : 1, u0 = side * (9 + r() * 18), k0 = r(), kind = s > GORGE[0] && s < GORGE[1] ? 0.55 + k0 * 0.3 : s > 620 ? (k0 < 0.5 ? k0 * 0.7 : 0.86 + k0 * 0.14) : k0;
    if (kind < 0.35) { gumAt(s, u0, Math.floor(r() * 3)); gumAt(s + 4 + r() * 3, u0 + side * (3 + r() * 4), 2); for (let k = 0; k < 4; k++) spinAt(s + (r() - 0.5) * 9, u0 + (r() - 0.5) * 7); }
    else if (kind < 0.55) { for (let k = 0; k < 3 + r() * 3; k++) moundAt(s + (r() - 0.5) * 12, u0 + (r() - 0.5) * 10, r() < 0.6 ? 0 : 1); for (let k = 0; k < 3; k++) spinAt(s + (r() - 0.5) * 10, u0 + (r() - 0.5) * 8); }
    else if (kind < 0.75) { if (Math.abs(u0) > 12) towerAt(s, u0 + side * 2); for (let k = 0; k < 4 + r() * 4; k++) rockAt(s + (r() - 0.5) * 7, u0 + (r() - 0.5) * 6, 0.5 + r() * 1.4); for (let k = 0; k < 4; k++) spinAt(s + (r() - 0.5) * 9, u0 + (r() - 0.5) * 8); bushAt(s + 3, u0 - side * 2); }
    else if (kind < 0.85) { if (free(s, u0, 2.5)) { mark(s, u0, 2.5); const kl = r() < 0.5 && KITM.log_large ? kitSized('log_large', 0.62) : K.log(Math.floor(s)); put(kl, s, u0, { yaw: r() * 6, sink: 0.08 }); } if (KITM.stump_old && free(s - 3, u0, 1)) { mark(s - 3, u0, 1); put(kitSized('stump_old', 0.6), s - 3, u0, { yaw: r() * 6 }); } gumAt(s + 4, u0 + side * 3, 2); spinAt(s - 2, u0 - side * 2); }
    else { for (let k = 0; k < 7; k++) spinAt(s + (r() - 0.5) * 12, u0 + (r() - 0.5) * 9, 1.1); for (let k = 0; k < 3; k++) bushAt(s + (r() - 0.5) * 12, u0 + (r() - 0.5) * 9); }
  }
  /* depth: lone gums and mounds further out, spinifex scattered, pebbles in the gutters */
  for (let i = 0; i < 150; i++) { const s = -60 + r() * (TRAIL_END - 40), side = r() < 0.5 ? -1 : 1, u = side * (32 + r() * 105); if (s > GORGE[0] && s < GORGE[1] && r() < 0.6) continue; if (r() < 0.7) gumAt(s, u, Math.floor(r() * 3), 1 + r() * 0.3); else moundAt(s, u, 0); }
  for (let i = 0; i < 560; i++) { const s = -60 + r() * (TRAIL_END - 40), side = r() < 0.5 ? -1 : 1, u = side * (7 + Math.pow(r(), 1.6) * 45); spinAt(s, u); }
  for (let i = 0; i < 150; i++) { const s = -60 + r() * (TRAIL_END - 40), side = r() < 0.5 ? -1 : 1, u = side * (8 + Math.pow(r(), 1.4) * 40); bushAt(s, u, 0.8); }
  /* a station fence line either side of the gate */
  if (KITM.fence_simple) { const fp = kitSized('fence_simple', 1.05), w = fp.size[0]; for (let s = GATE_S - 36; s < GATE_S + 36; s += w * 0.98) { if (Math.abs(s - GATE_S) < 5.5) continue; for (const u of [-9.2, 9.2]) put(fp, s, u, { yaw: Math.PI / 2, sink: 0.05 }); } }
  for (let i = 0; i < 460; i++) { const s = -60 + r() * (TRAIL_END - 40), side = r() < 0.5 ? -1 : 1, u = side * (K.ROAD.half + 0.3 + r() * 2.4); if (Math.abs(s - HAZARD.s) < 6) continue; put(K.pebble(i + 77), s, u, { yaw: r() * 6, s: 0.8 + r() * 1.4, tag: 'pebble' }); }
  for (let i = 0; i < 0; i++) { const s = -60 + r() * 470, u = (r() - 0.5) * 6; if (Math.abs(u) > 0.5 && Math.abs(u) < 1.2) continue; if (s > 50 && s < 100) continue; put(K.pebble(i + 500), s, u, { yaw: r() * 6, s: 0.7 + r() * 0.6 }); }
  /* beyond the original 300 m: near-road composed groups every 12-18 m, alternating sides (gorge = rock outcrops, towers, bushes;
     dusk run = gums, mounds, spinifex), plus the depth layer further out */
  { const rq = K.rng(9090);
    for (let s = 305; s < TRAIL_END - 40; s += 12 + rq() * 6) {
      const side = rq() < 0.5 ? -1 : 1, u0 = side * (8.5 + rq() * 8), gorge = s > GORGE[0] && s < GORGE[1];
      if (gorge) { if (rq() < 0.5) towerAt(s, u0 + side * 3); for (let k = 0; k < 3 + rq() * 3; k++) rockAt(s + (rq() - 0.5) * 6, u0 + (rq() - 0.5) * 5, 0.5 + rq() * 1.3); for (let k = 0; k < 3; k++) spinAt(s + (rq() - 0.5) * 8, u0 + (rq() - 0.5) * 6); bushAt(s + 2, u0 + side * 2); }
      else { const k0 = rq(); if (k0 < 0.45) { gumAt(s, u0 + side * 2, Math.floor(rq() * 3)); for (let k = 0; k < 3; k++) spinAt(s + (rq() - 0.5) * 8, u0 + (rq() - 0.5) * 6); }
        else if (k0 < 0.7) { for (let k = 0; k < 3; k++) moundAt(s + (rq() - 0.5) * 9, u0 + side * 2 + (rq() - 0.5) * 6, rq() < 0.6 ? 0 : 1); spinAt(s, u0); }
        else { for (let k = 0; k < 5; k++) spinAt(s + (rq() - 0.5) * 10, u0 + (rq() - 0.5) * 7, 1.1); bushAt(s + 3, u0 - side); } }
    } }
  /* gorge (330-600 m): continuous ridge walls 28-45 m out on both sides plus buttes, each placed only if every vertex stays >= 14 m
     from the road centre line (and on its own side) */
  { const rg = K.rng(4242); let tries = 0, placed = 0;
    for (let s = GORGE[0] + 10; s < GORGE[1] - 10 && tries < 900; tries++) {
      const side = placed % 2 ? -1 : 1, v = rg() < 0.6 ? 2 : rg() < 0.7 ? 1 : 0, sc = v === 1 ? 0.3 + rg() * 0.15 : v === 2 ? 0.26 + rg() * 0.1 : 0.2 + rg() * 0.1;
      const u = side * (v === 2 ? 40 + rg() * 8 : 30 + rg() * 20), part = K.mesa(Math.floor(s * 3 + u), v), w = T.world(s, u), yaw = (v === 2 ? w.th : rg() * 6);
      const cy = Math.cos(yaw), sy = Math.sin(yaw); let minU = 1e9;
      for (let i = 0; i < part.P.length; i += 9) { const px = part.P[i] * sc, pz = part.P[i + 2] * sc, x = px * cy + pz * sy + w.x, z = -px * sy + pz * cy + w.z, tt = T.toTrack(x, z, s); minU = Math.min(minU, Math.abs(tt[1])); if (Math.sign(tt[1]) !== side) minU = 0; }
      if (minU < 15) { s += 3; continue; }
      const f = chunks[chunkOf(s)], v0 = f.P.length / 3; const H = v === 1 ? 70 * sc : 46 * sc;
      f.add(part, { x: w.x, y: GH(s, u) - 3, z: w.z, yaw, s: sc }, trkOf(s)); PLACED.push({ ci: chunkOf(s), v0, v1: f.P.length / 3, s, u, tag: 'mesa', tris: part.tris, minU });
      casters.push({ p: [w.x, GH(s, u) + H * 0.5, w.z], r: (v === 1 ? 20 : 40) * sc, sy: 1.2, maxLen: 45, s });
      placed++; s += 6 + rg() * 10;
    }
    window.__style.gorgeMesas = placed; }
  /* gorge: three big verge gums whose long sunset shadows lie across the road, a fence run on the right, mounds */
  gumAt(362, -8.6, 1, 1.25); gumAt(424, -8.8, 0, 1.2); gumAt(522, -8.4, 1, 1.25);
  for (const [s, u] of [[370, 11], [374, 13.5], [452, -12], [455, -14.5], [548, 12], [551, 10.5]]) moundAt(s, u, 0);
  if (KITM.fence_simple) { const fp = kitSized('fence_simple', 1.05), w = fp.size[0]; for (let s = 380; s < 460; s += w * 0.98) if (!reserved(s, 9.6, 0.3)) put(fp, s, 9.6, { yaw: Math.PI / 2, sink: 0.05 }); }
  /* verge gums through the late sunset and the dusk run, alternating sides every 30-45 m */
  { const rv = K.rng(777); let side = 1; for (let s = 490; s < ROAD_END - 40; s += 30 + rv() * 15) { gumAt(s, side * (9 + rv() * 3), Math.floor(rv() * 2), 1.05 + rv() * 0.2); spinAt(s - 2, side * 8); side = -side; } }
  /* dusk run: a second windmill and tank as the landmark before camp */
  put(K.windmillTower(false), 712, -26, { yaw: 0.6 }); put(K.waterTank(), 718, -30, { yaw: 0.3 });
  /* set pieces */
  for (const b of BOARDS) { const f = K.distanceGantry(); put(f, b.s, b.u, { yaw: b.yaw, tag: 'gantry' }); b.meta = f.meta; }
  if (!GAMEL) { put(K.rockFall(3), HAZARD.s, HAZARD.u, { yaw: 0.3, tag: 'hazard' });
  put(K.hazardMarker(), HAZARD.s - 3, K.ROAD.half + 0.9, { yaw: Math.PI, sink: 0.1, tag: 'hazard' }); }
  put(K.windmillTower(BRAND >= 1), MILL.s, MILL.u, { yaw: 0.4 }); put(K.waterTank(), MILL.s + 6, MILL.u - 4, { yaw: 0.2 });
  put(K.stationGate(), GATE_S, 0, { yaw: 0, tag: 'grid' });
  if (KITM.tent_detailedOpen) put(kitSized('tent_detailedOpen', 1.6), CAMP.s + 2.5, CAMP.u - 4.5, { yaw: 0.9 + Math.PI }); else put(K.tent(), CAMP.s + 2, CAMP.u - 4, { yaw: 0.9 });
  if (KITM.campfire_stones) { put(kitSized('campfire_stones', 0.32), CAMP.s - 1, CAMP.u + 1); if (KITM.campfire_logs) put(kitSized('campfire_logs', 0.42), CAMP.s - 1, CAMP.u + 1); put(K.flames(4), CAMP.s - 1, CAMP.u + 1, { tag: 'fx' }); } else put(K.campfire(4), CAMP.s - 1, CAMP.u + 1);
  if (KITM.log_stack) put(kitSized('log_stack', 0.7), CAMP.s + 5.5, CAMP.u + 3.5, { yaw: 0.4 });
  put(K.chair(1, BRAND >= 1), CAMP.s - 3.0, CAMP.u - 0.6, { yaw: 1.3 }); put(K.chair(2, BRAND >= 2), CAMP.s - 1.2, CAMP.u + 3.4, { yaw: 3.0 });
  /* brand structures (the logo goes on as a texture after the world is built) */
  if (BRAND) {
    const B = BRANDS; let f = K.brandBillboard(); put(f, B.billboard.s, B.billboard.u, { yaw: B.billboard.yaw }); B.billboard.meta = f.meta;
    f = K.brandGate(); put(f, B.gate.s, 0, { yaw: Math.PI, tag: 'archgate' }); B.gate.meta = f.meta;
    B.crates = []; const cr = BRAND >= 2 ? [[-4, 7.2], [-3.1, 8.3], [-4.4, 8.6], [-3.4, -7.4], [-4.2, -8.4]] : [[-4, 7.2], [-3.1, 8.3], [-4.4, 8.6]];
    cr.forEach(([ds, u], i) => { const c = K.brandCrate(0.85 + (i % 2) * 0.1); put(c, B.gate.s + ds, u, { yaw: Math.PI + (i - 1) * 0.25 }); B.crates.push({ s: B.gate.s + ds, u, yaw: Math.PI + (i - 1) * 0.25, meta: c.meta }); });
    f = K.brandBanner(); put(f, B.banner.s, B.banner.u, { yaw: B.banner.yaw }); B.banner.meta = f.meta;
    f = K.brandFlag(); put(f, CAMP.s + 4.5, CAMP.u - 1.5, { yaw: 2.2 }); B.flag = { s: CAMP.s + 4.5, u: CAMP.u - 1.5, yaw: 2.2, meta: f.meta };
    if (BRAND >= 2) put(K.bunting(7), CAMP.s - 2, CAMP.u - 6, { yaw: 1.2 });
  }
  put(K.swag(false), CAMP.s + 3.5, CAMP.u + 1.5, { yaw: 1.2, lift: -0.04 });
  gumAt(CAMP.s + 9, CAMP.u - 7, 1, 1.2); gumAt(CAMP.s - 8, CAMP.u - 9, 0);
  /* Easter eggs: signs face the oncoming driver (yaw pi), boards on the front of their posts */
  for (const [fn, s, u] of EGG_SIGNS) put(fn(), s, u, { yaw: Math.PI, sink: 0.02 });
  put(K.mailboxDrum(), GATE_S - 4, 6.4, { yaw: Math.PI / 2 }); put(K.dunny(), MILL.s + 8, MILL.u + 6, { yaw: 2.6 });
  put(K.billy(), CAMP.s - 0.2, CAMP.u + 1.9); if (!(GAMEL && GAMEL.lean)) put(K.goanna(), 41, -8.2, { yaw: 2.2, sink: 0.1 });
  if (GAMEL) GAMEL.extendWorld({ put, free, mark, gumAt, spinAt, rockAt, bushAt, towerAt, moundAt, r, KITM, kitSized, T, GH, chunks, chunkOf, trkOf, BRANDS, BRAND });
}
buildWorld();
const PICK = PICKUPS.map(([s, u, kind]) => { const f = new K.Facets(); const w = T.world(s, u); f.add(K[kind](), { x: w.x, y: GH(s, u) + 0.02, z: w.z, yaw: w.th + 0.4, s: K.PICKUP_SCALE }, trkOf(s)); return { s, u, f }; });
/* far layer: mesas, buttes and ridges in three hazed rings, plus a skirt of ground to the horizon */
const far = new K.Facets();
{
  const r = K.rng(7), anchors = [150, 450, 750].map(v => T.at(v)), mid = T.at(450);
  const trailPts = []; for (let s = -70; s <= TRAIL_END; s += 5) { const o = T.at(s); trailPts.push([o.x, o.z]); }
  const clearOf = (x, z, rad) => trailPts.every(([px, pz]) => Math.hypot(px - x, pz - z) > rad + 160);
  let rejected = 0;
  const ring = (dist, n, spread, sc, kinds) => { for (let i = 0; i < n; i++) for (const base of anchors) { const a = (i / (n - 1) - 0.5) * spread + (r() - 0.5) * 0.12 + base.th; const x = base.x + Math.sin(a) * dist, z = base.z + Math.cos(a) * dist; const kd = kinds[Math.floor(r() * kinds.length)], scale = sc * (0.8 + r() * 0.5), foot = (kd === 2 ? 85 * 2.6 : kd === 1 ? 26 : 85) * 1.45 * scale;
    if (!clearOf(x, z, foot)) { rejected++; continue; } far.add(K.mesa(i + dist + Math.round(base.x), kd), { x, y: -5, z, yaw: kd === 2 ? a + Math.PI / 2 : r() * 6, s: scale }, () => [-9999, -9999]); } };
  ring(380, 7, 2.6, 0.8, [0, 1, 0]); ring(680, 8, 2.9, 1.4, [0, 2, 2, 1]); ring(1100, 9, 3.2, 2.0, [2, 2, 0]);
  for (let i = 0; i < 6; i++) { const a = Math.PI + (i / 5 - 0.5) * 2.2, x = Math.sin(a) * 700, z = -60 + Math.cos(a) * 700; if (clearOf(x, z, 85 * 1.45 * 1.6)) far.add(K.mesa(i + 77, 2), { x, y: -5, z, yaw: r() * 6, s: 1.6 }, () => [-9999, -9999]); else rejected++; }
  window.__style.farRejected = rejected;
  /* skirt: a coarse faceted disc at the corridor edge level */
  const cx = mid.x, cz = mid.z, N = 28;
  for (let k = 0; k < N; k++) for (let j = 0; j < 3; j++) {
    const r0 = [0, 500, 1100][j], r1 = [500, 1100, 2500][j], a0 = (k / N) * Math.PI * 2, a1 = ((k + 1) / N) * Math.PI * 2;
    const p = (rr, a) => [cx + Math.sin(a) * rr, -6 + (K.hash2(rr, (Math.round(a * 1000) % 6283) / 1000) - 0.5) * 2, cz + Math.cos(a) * rr];
    const col = K.shade([K.C.earthRed, K.C.earthOchre, K.C.earthDeep][(k + j) % 3], 0.95);
    far.quad(p(r0, a0), p(r1, a0), p(r1, a1), p(r0, a1), col, [0, 0, 0, 0], [cx, -1000, cz]);
  }
  if (GAMEL) GAMEL.extendFar(far);
  far.T = new Array(far.P.length / 3 * 2).fill(-9999);
}

/* ---------------------------------------------------------------- long-shadow mask (track space), sun per trail position */
const MASK = K.bakeShadowMask(T, casters, s => K.sunDirOf(K.momentAt(s)), { s0: -70, s1: TRAIL_END, u0: -64, u1: 64, res: 0.3 });
const maskTex = new THREE.DataTexture(MASK.data, MASK.w, MASK.h, THREE.RedFormat, THREE.UnsignedByteType);
maskTex.magFilter = THREE.LinearFilter; maskTex.minFilter = THREE.LinearFilter; maskTex.unpackAlignment = 1; maskTex.flipY = false; maskTex.needsUpdate = true;
U.uMask.value = maskTex; U.uMaskRect.value.set(MASK.s0, MASK.u0, 1 / MASK.ds, 1 / MASK.du);
/* the mask is indexed [u][s]: x = s, y = u */

/* ---------------------------------------------------------------- meshes */
let worldTris = 0;
const chunkMeshes = chunks.map((f, i) => { const m = new THREE.Mesh(K.toGeometry(THREE, f), worldMat); m.receiveShadow = false; m.matrixAutoUpdate = false; m.userData.s0 = CH0 + i * CHL; scene.add(m); worldTris += f.tris; return m; });
await (async () => { try { const ff = new FontFace('Oswald', 'url(assets/fonts/oswald-latin-700-normal.woff2)', { weight: '700' }); await ff.load(); document.fonts.add(ff); } catch (e) { /* falls back to the system sans */ } })();
/* brand: the official logo file (assets/brand), placed unmodified as a texture: billboard + gate header + finish banner faces
   (canvas: black board, the logo with clear space, the brand's own wording in heavy condensed caps), and small logo decals merged
   into one draw (crates, camp flag, chair back, windmill vane, dunny door). Small emissive floor so it stays readable at dusk. */
let LOGO = null;
if (BRAND) { try { LOGO = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = 'assets/brand/realtruck-logo-horz-light.svg'; }); } catch (e) { LOGO = null; } }
const LOGO_AR = 50 / 9.5;
function brandFaceCanvas(kind, wM, hM) {
  const W = 1024, H = Math.round(1024 * hM / wM), c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#1C1C20'; g.fillRect(0, 0, W, H); g.fillStyle = '#F1ECE2'; g.textBaseline = 'alphabetic';
  const logo = (x, y, w) => { if (LOGO) g.drawImage(LOGO, x, y, w, w / LOGO_AR); };
  /* layout on a grid: equal margins all round; the logo's clear space = its own height (about the height of its letter R);
     text and logo never closer than that; the logo is drawn unmodified (scale and position only) */
  const M = Math.round(Math.min(W, H) * 0.14), font = (px) => `700 ${px}px Oswald, Impact, sans-serif`;
  const fitText = (t, maxW, maxCap) => { g.font = font(100); if ('letterSpacing' in g) g.letterSpacing = '4px'; const m = g.measureText(t), cap = m.actualBoundingBoxAscent || 72; const k = Math.min(maxW / m.width, maxCap / cap); g.font = font(100 * k); const m2 = g.measureText(t); return { w: m2.width, cap: (m2.actualBoundingBoxAscent || 72 * k) }; };
  if (kind === 'billboard') {
    /* stacked: logo, a gap of one logo height, then the brand's own line; the block centred */
    let L = Math.min((H - 2 * M) / 2.6, (W - 2 * M) / LOGO_AR), lw = L * LOGO_AR;
    const T = fitText('FIND YOUR UTE ESSENTIALS', W - 2 * M, L * 0.6);
    const block = L + L + T.cap, y0 = (H - block) / 2;
    logo((W - lw) / 2, y0, lw);
    g.fillStyle = '#F1ECE2'; g.fillText('FIND YOUR UTE ESSENTIALS', (W - T.w) / 2, y0 + L + L + T.cap);
  } else if (kind === 'gate') {
    /* two zones side by side, a thin divider at the centre, gap = logo clear space on each side, each zone centred in its half */
    const L = Math.min((H - 2 * M) * 0.62, ((W / 2) - M) / LOGO_AR * 0.8), lw = L * LOGO_AR, clear = L;
    const zoneW = W / 2 - M - clear;
    const T = fitText('BLACK FRIDAY', zoneW, (H - 2 * M) * 0.8);
    g.fillStyle = '#FFC600'; g.fillText('BLACK FRIDAY', M + (zoneW - T.w) / 2, H / 2 + T.cap / 2);
    g.fillStyle = 'rgba(241,236,226,0.55)'; g.fillRect(W / 2 - 1.5, M, 3, H - 2 * M);
    const rx0 = W / 2 + clear, rw = W - M - rx0; logo(rx0 + (rw - lw) / 2, (H - L) / 2, Math.min(lw, rw));
  } else { const L = Math.min((H - 2 * M), (W - 2 * M) / LOGO_AR) * 0.7, lw = L * LOGO_AR; logo((W - lw) / 2, (H - L) / 2, lw); }
  (window.__style.brandCanvases = window.__style.brandCanvases || {})[kind] = c;
  return c;
}
function texOf(c) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t; }
function facePlane(map, w, h, s, u, yaw, cy, z, base, glow = 0.12) {
  const g0 = new THREE.PlaneGeometry(w, h), n = g0.attributes.position.count;
  g0.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(1), 3)); g0.setAttribute('aFx', new THREE.Float32BufferAttribute(new Array(n).fill([1, 0, 0, glow]).flat(), 4)); g0.setAttribute('aTrk', new THREE.Float32BufferAttribute(new Array(n).fill([s, u]).flat(), 2));
  const w0 = T.world(s, u), a = w0.th + yaw, y = (base === undefined ? GH(s, u) : base) + cy;
  g0.rotateY(a); g0.translate(w0.x + Math.sin(a) * z, y, w0.z + Math.cos(a) * z); return g0;
}
const brandMeshes = [];
if (BRAND && LOGO) {
  const mk = (geo, map, alpha) => { const m = K.createWorldMaterial(THREE, U); m.map = map; if (map) renderer.initTexture(map); m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -4; if (alpha) { m.alphaTest = 0.5; m.transparent = false; } m.customProgramCacheKey = () => 'kitworld-brand' + (alpha ? 'a' : ''); const me = new THREE.Mesh(geo, m); scene.add(me); brandMeshes.push(me); return me; };
  const B = BRANDS, bb = B.billboard, gt = B.gate, bn = B.banner;
  /* (fixed: the billboard texture was passed into the geometry argument and the board rendered blank) */
  mk(facePlane(null, bb.meta.face.w, bb.meta.face.h, bb.s, bb.u, bb.yaw, bb.meta.face.cy, bb.meta.face.z, undefined, 0.26), texOf(brandFaceCanvas('billboard', bb.meta.face.w, bb.meta.face.h)));
  { const geo = facePlane(null, gt.meta.face.w, gt.meta.face.h, gt.s, 0, Math.PI, gt.meta.face.cy, gt.meta.face.z, undefined, 0.22); mk(geo, texOf(brandFaceCanvas('gate', gt.meta.face.w, gt.meta.face.h))); }
  { const geo = facePlane(null, bn.meta.face.w, bn.meta.face.h, bn.s, bn.u, bn.yaw, bn.meta.face.cy, bn.meta.face.z); mk(geo, texOf(brandFaceCanvas('banner', bn.meta.face.w, bn.meta.face.h))); }
  /* decals: one geometry, one draw */
  const lc = document.createElement('canvas'); lc.width = 1024; lc.height = Math.round(1024 / LOGO_AR) + 8; lc.getContext('2d').drawImage(LOGO, 0, 4, 1024, 1024 / LOGO_AR);
  const dec = [];
  for (const c of B.crates) { const d = c.meta.decal; dec.push(facePlane(null, d.w, d.w / LOGO_AR, c.s, c.u, c.yaw, d.y, d.z + 0.013)); }
  { const fl = B.flag, d = fl.meta.decal, w0 = T.world(fl.s, fl.u), a = w0.th + fl.yaw; const g1 = new THREE.PlaneGeometry(d.w, d.w / LOGO_AR); const n = g1.attributes.position.count;
    g1.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(1), 3)); g1.setAttribute('aFx', new THREE.Float32BufferAttribute(new Array(n).fill([1, 0, 0, 0.12]).flat(), 4)); g1.setAttribute('aTrk', new THREE.Float32BufferAttribute(new Array(n).fill([fl.s, fl.u]).flat(), 2));
    g1.translate(d.x, 0, d.z + 0.015); g1.rotateY(a); g1.translate(w0.x, GH(fl.s, fl.u) + d.y, w0.z); dec.push(g1); }
  { const s = CAMP.s - 3.0, u = CAMP.u - 0.6, yaw = 1.3; dec.push(facePlane(null, 0.5, 0.5 / LOGO_AR, s, u, yaw + Math.PI, 0.82, 0.345)); }
  { const s = MILL.s, u = MILL.u, w0 = T.world(s, u), a = w0.th + 0.4; const g1 = new THREE.PlaneGeometry(1.3, 1.3 / LOGO_AR), n = g1.attributes.position.count;
    g1.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(1), 3)); g1.setAttribute('aFx', new THREE.Float32BufferAttribute(new Array(n).fill([0, 0, 0, 0.12]).flat(), 4)); g1.setAttribute('aTrk', new THREE.Float32BufferAttribute(new Array(n).fill([-9999, -9999]).flat(), 2));
    g1.rotateY(Math.PI / 2); g1.translate(0.055, 9.8, -1.5); g1.rotateY(a); g1.translate(w0.x, GH(s, u), w0.z); dec.push(g1); }
  { const s = MILL.s + 8, u = MILL.u + 6, yaw = 2.6; dec.push(facePlane(null, 0.42, 0.42 / LOGO_AR, s, u, yaw, 1.55, 0.63)); }
  mk(mergeGeometries(dec, false), texOf(lc), true);
}
window.__style.brands = BRANDS;
for (const b of BOARDS) {
  const F = K.distanceFaceCanvas(b.d, 'Oswald, Impact, sans-serif'); b.face = F; const tex = new THREE.CanvasTexture(F.canvas); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  const fm = b.meta.face, g0 = new THREE.PlaneGeometry(fm.w, fm.h), n = g0.attributes.position.count;
  g0.setAttribute('color', new THREE.Float32BufferAttribute(new Array(n * 3).fill(1), 3)); g0.setAttribute('aFx', new THREE.Float32BufferAttribute(new Array(n).fill([1, 0, 0, 0.28]).flat(), 4)); g0.setAttribute('aTrk', new THREE.Float32BufferAttribute(new Array(n).fill([b.s, b.u]).flat(), 2));
  const mat = K.createWorldMaterial(THREE, U); mat.map = tex; mat.customProgramCacheKey = () => 'kitworld-face'; mat.polygonOffset = true; mat.polygonOffsetFactor = -1; mat.polygonOffsetUnits = -4; renderer.initTexture(tex);
  const mesh = new THREE.Mesh(g0, mat), w = T.world(b.s, b.u), yy = GH(b.s, b.u), a = w.th + b.yaw;
  mesh.position.set(w.x + Math.sin(a) * fm.z, yy + fm.cy, w.z + Math.cos(a) * fm.z); mesh.rotation.set(0, a, 0); scene.add(mesh); mesh.updateMatrixWorld(true);
  const loc = (x, y) => new THREE.Vector3(x, y, 0).applyMatrix4(mesh.matrixWorld).toArray();
  b.num = [loc(0, -fm.h / 2 + F.numeral[0]), loc(0, -fm.h / 2 + F.numeral[1])]; b.corners = [loc(-fm.w / 2, -fm.h / 2), loc(fm.w / 2, -fm.h / 2), loc(fm.w / 2, fm.h / 2), loc(-fm.w / 2, fm.h / 2)];
}
const farMesh = new THREE.Mesh(K.toGeometry(THREE, far), worldMat); farMesh.matrixAutoUpdate = false; scene.add(farMesh); worldTris += far.tris;
const pickMeshes = PICK.map(p => { const m = new THREE.Mesh(K.toGeometry(THREE, p.f), K.createPickupMaterial(THREE, U)); m.matrixAutoUpdate = false; scene.add(m); worldTris += p.f.tris; return m; });
const sky = K.createSkyMaterial(THREE, U);
const skyDome = new THREE.Mesh(new THREE.SphereGeometry(3000, 32, 16), sky.mat); skyDome.renderOrder = -10; skyDome.frustumCulled = false; scene.add(skyDome);
/* lights: warm key (sun), cool hemisphere fill */
const sun = new THREE.DirectionalLight(0xffffff, 2.4); scene.add(sun, sun.target);
const hemi = new THREE.HemisphereLight(0x8890c8, 0xa05030, 1.0); scene.add(hemi);
sun.castShadow = SHADOW_MAP; { const SM = HI ? 2048 : 1024; sun.shadow.mapSize.set(SM, SM); const sc = sun.shadow.camera; sc.left = -4.5; sc.right = 4.5; sc.top = 4.5; sc.bottom = -4.5; sc.near = 1; sc.far = 60; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03; sun.shadow.radius = 2.5; }
const fireLight = !LOW ? new THREE.PointLight(0xff8a3a, 0, 16, 1.4) : null; if (fireLight) { const w = T.world(CAMP.s - 1, CAMP.u + 1); fireLight.position.set(w.x, GH(CAMP.s - 1, CAMP.u + 1) + 1.0, w.z); scene.add(fireLight); }
const LIGHTS = { sun, hemi };
let patchGlass = null; try { ({ patchGlass } = await import('models/lowpoly/glass.js')); } catch (e) { /* optional */ }
const GLASS_SKY = { zenith: new THREE.Color(), horizon: new THREE.Color(), ground: new THREE.Color(), sunDir: new THREE.Vector3(0, 1, 0), sunColor: new THREE.Color() };
function glassSkyFrom(m) {
  GLASS_SKY.zenith.setRGB(...K.mix3(m.skyAnti[3], m.skySun[3], 0.5)); GLASS_SKY.horizon.setRGB(...K.mix3(m.skyAnti[0], m.skySun[0], 0.5));
  GLASS_SKY.ground.setRGB(...K.shade(K.C.earthRed, 0.55)); GLASS_SKY.sunDir.copy(U.uSunDir.value); GLASS_SKY.sunColor.setRGB(...m.discCol).multiplyScalar(Math.max(0.15, Math.min(1, (m.sunEl + 2) / 6)));
}
function withGlass(m, mix) {
  if (!patchGlass) return m;
  const mine = m.onBeforeCompile, myKey = m.customProgramCacheKey; patchGlass(m, () => GLASS_SKY, { mix }); const glass = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => { glass(sh, r); mine(sh, r); }; m.customProgramCacheKey = () => myKey() + '-glass' + mix; m.needsUpdate = true; return m;
}

/* ---------------------------------------------------------------- perf recorder (look-test recorder; adds style + ute look + moment) */
const REC = (() => {
  const session = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const N = 2048, ring = new Float32Array(N), scratch = new Float32Array(N);
  let n = 0, wStart = performance.now(), over25 = 0, over50 = 0, maxDt = 0, hiddenSeen = document.hidden;
  const events = [], t0 = performance.now(), url = (new URLSearchParams(location.search).get('perfurl') || 'perf');
  const ev = (type, extra) => { if (events.length < 200) events.push({ t: +((performance.now() - t0) / 1000).toFixed(2), type, ...(extra || {}) }); };
  document.addEventListener('visibilitychange', () => { hiddenSeen = hiddenSeen || document.hidden; ev('visibility', { hidden: document.hidden }); });
  window.addEventListener('resize', () => ev('resize', { w: innerWidth, h: innerHeight }));
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) ev('longtask', { ms: Math.round(e.duration) }); }).observe({ entryTypes: ['longtask'] }); } catch (e) { /* not supported */ }
  let gpu = '';
  const post = body => { if (!PERF) return; try { fetch(url, { method: 'POST', body: JSON.stringify(body), keepalive: true, mode: 'cors', headers: { 'Content-Type': 'text/plain' } }).catch(() => {}); } catch (e) { /* ignore */ } };
  const R = {
    session, ev, samples: [], median: 0,
    frame(dt) { if (n < N) ring[n++] = dt; if (dt > 25) over25++; if (dt > 50) over50++; if (dt > maxDt) maxDt = dt; },
    init(r) { try { const gl = r.getContext(), x = gl.getExtension('WEBGL_debug_renderer_info'); gpu = x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch (e) { gpu = ''; } r.domElement.addEventListener('webglcontextlost', () => ev('webglcontextlost')); },
    tick(now, ctx) {
      if (now - wStart < 2000) return;
      const k = n; scratch.set(ring.subarray(0, k)); const s = scratch.subarray(0, k); s.sort();
      let sum = 0; for (let i = 0; i < k; i++) sum += s[i];
      R.median = k ? s[k >> 1] : 0; const info = renderer.info, mem = performance.memory;
      const sample = {
        session, style: 'stylised', t: +((now - t0) / 1000).toFixed(2), ua: navigator.userAgent, dpr: window.devicePixelRatio, renderScale: SCALE,
        screen: [screen.width, screen.height], css: [innerWidth, innerHeight], canvas: [renderer.domElement.width, renderer.domElement.height],
        gpu, deviceMemory: navigator.deviceMemory, cores: navigator.hardwareConcurrency, tier: TIER, cam: CAM, ute: ctx.ute, moment: ctx.moment,
        frames: k, ms: { mean: k ? +(sum / k).toFixed(2) : 0, median: +R.median.toFixed(2), p95: k ? +s[Math.min(k - 1, Math.floor(k * 0.95))].toFixed(2) : 0, max: +maxDt.toFixed(1) }, over25, over50,
        gl: { calls: info.render.calls, tris: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs ? info.programs.length : 0 },
        heapMB: mem ? +(mem.usedJSHeapSize / 1048576).toFixed(1) : null, uteS: ctx.s, aa: AA, gpuMs: ctx.gpuMs, cpuMs: ctx.cpuMs, texMB: ctx.texMB, hidden: hiddenSeen || document.hidden, events: events.splice(0)
      };
      R.samples.push(sample); if (R.samples.length > 120) R.samples.shift();
      setTimeout(() => post(sample), 0);
      n = 0; over25 = 0; over50 = 0; maxDt = 0; hiddenSeen = document.hidden; wStart = now;
    }
  };
  window.__perf = R; return R;
})();
REC.init(renderer);

/* ---------------------------------------------------------------- the ute: one rig, four looks on the same geometry (low-poly is its own model) */
const hiddenNode = (gl, o) => { const a = gl.parser.associations.get(o), nodes = gl.parser.json.nodes || [], n = a && a.nodes !== undefined ? nodes[a.nodes] : null; return (n && n.extensions && n.extensions.KHR_node_visibility && n.extensions.KHR_node_visibility.visible === false) || /^BADGE_/.test(o.name); };
function geoInto(o, inv) {
  const g0 = o.geometry, g1 = new THREE.BufferGeometry(), n = g0.attributes.position.count;
  for (const name of ['position', 'normal', 'uv']) { const a = g0.attributes[name]; if (!a) continue; const sz = name === 'uv' ? 2 : 3, arr = new Float32Array(n * sz); for (let i = 0; i < n; i++) { arr[i * sz] = a.getX(i); arr[i * sz + 1] = a.getY(i); if (sz === 3) arr[i * sz + 2] = a.getZ(i); } g1.setAttribute(name, new THREE.BufferAttribute(arr, sz)); }
  if (!g1.attributes.uv) g1.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (!g1.attributes.normal) g1.computeVertexNormals();
  g1.setIndex(g0.index ? Array.from(g0.index.array) : [...Array(n).keys()]);
  g1.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); return g1;
}
function mergeByMaterial(root, space, skip) {
  space.updateMatrixWorld(true); root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(space.matrixWorld).invert(), set = new Map();
  root.traverse(o => { if (!o.isMesh || o.isSkinnedMesh) return; for (let p = o; p; p = p.parent) if (!p.visible) return; if (skip && skip(o)) return; const k = o.material.uuid; if (!set.has(k)) set.set(k, { mat: o.material, geos: [] }); set.get(k).geos.push(geoInto(o, inv)); });
  const out = []; for (const { mat, geos } of set.values()) { const mg = mergeGeometries(geos, false); if (!mg) continue; mg.computeBoundingSphere(); const m = new THREE.Mesh(mg, mat); m.castShadow = !/glass|window|light|chrome|plate|interior|led/i.test(mat.name || ''); m.receiveShadow = true; out.push(m); } return out;
}
/* ute-space uniforms: the shadow mask is sampled in track space via the ute's frame */
const UU = { uUteF: { value: new THREE.Vector4() }, uUteGain: { value: 1.35 } };
const UTE_GLSL = `uniform float uUteGain; uniform sampler2D uMask; uniform vec4 uMaskRect; uniform vec4 uUteF; uniform float uShadowK; uniform vec3 uRim; varying vec3 vKW; float kVis = 1.0;
float uteMask(vec3 wp) { vec2 d = wp.xz - uUteF.yz; float th = uUteF.w; vec2 tr = vec2(uUteF.x + d.x * sin(th) + d.y * cos(th), -d.x * cos(th) + d.y * sin(th)); vec2 mt = (tr - uMaskRect.xy) * uMaskRect.zw; return texture2D(uMask, mt).r; }`;
function patchUte(m, mode, gloss) {
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U, UU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vKW;').replace('#include <project_vertex>', '#include <project_vertex>\nvKW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    let fs = sh.fragmentShader.replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin).replace('#include <lights_lambert_pars_fragment>', THREE.ShaderChunk.lights_lambert_pars_fragment)
      .replace('#include <common>', '#include <common>\n' + UTE_GLSL + (mode !== 'real' ? K.RAMP_GLSL.replace('float kVis = 1.0;', '') : '') + K.HAZE_GLSL)
      .replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight ); directLight.color *= kVis;')
      .replace('#include <lights_fragment_begin>', '#include <lights_fragment_begin>');
    fs = fs.replace('void main() {', 'void main() {\n kVis = 1.0 - uteMask(vKW) * uShadowK * 0.85;');
    if (mode !== 'real') fs = fs.replace('float dotNL = saturate( dot( geometryNormal, directLight.direction ) );', 'float dotNL = kitRamp(dot( geometryNormal, directLight.direction ));');
    /* rim on the hero: warm fresnel on the sun side */
    fs = fs.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      { vec3 Vv = normalize(vViewPosition); float fr = pow(1.0 - clamp(dot(normal, Vv), 0.0, 1.0), 3.0); vec3 nw = (vec4(normal, 0.0) * viewMatrix).xyz;
        float sunSide = clamp(dot(normalize(nw.xz + 1e-4), normalize(uSunDir.xz + 1e-4)) * 0.6 + 0.4, 0.0, 1.0);
        totalEmissiveRadiance += uRim * fr * sunSide * smoothstep(-0.3, 0.5, nw.y) * (${mode === 'lowpoly' ? '0.75' : '0.4'} + 0.6 * diffuseColor.rgb) * ${mode === 'real' ? '0.7' : mode === 'lowpoly' ? '1.5' : '1.1'};
        ${gloss ? `{ vec3 rw = reflect(-normalize((vec4(Vv, 0.0) * viewMatrix).xyz), normalize(nw)); float hb = smoothstep(0.02, 0.07, rw.y) * (1.0 - smoothstep(0.14, 0.22, rw.y)); float top = smoothstep(0.55, 0.75, rw.y);
          totalEmissiveRadiance += (uHzSun * hb * 0.55 + vec3(0.75, 0.8, 0.95) * top * 0.18) * ${gloss.toFixed(2)}; }` : ''} }`)
      .replace('#include <opaque_fragment>', `outgoingLight = applyHaze(outgoingLight * ${mode === 'real' ? '1.0' : 'uUteGain'}, vKW);\nif (any(isnan(outgoingLight))) outgoingLight = vec3(0.0);\n#include <opaque_fragment>`);
    sh.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => 'ute-' + mode + (gloss ? 'g' : '') + m.type;
  m.needsUpdate = true; return m;
}
/* the stylised look on the real geometry: solid palette colours, two-tone ramp, dark solid glass, emissive tail lights, AO panel lines */
function styliseMaterial(src, gloss) {
  const name = (src.name || '').toLowerCase();
  let col = src.color ? src.color.clone() : new THREE.Color(0.5, 0.5, 0.5);
  const metal = src.metalness > 0.5;
  const m = new THREE.MeshLambertMaterial({ name: src.name });
  if (/glass|window/.test(name) && !/rear|red|light/.test(name)) { col = new THREE.Color(K.PALETTE.blue).lerp(new THREE.Color(K.PALETTE.black), 0.55); }
  else if (/red light|rearlight|stop/.test(name)) { col = new THREE.Color(K.PALETTE.hazard); m.emissive = new THREE.Color(K.PALETTE.hazard).multiplyScalar(0.6); }
  else if (/headlight|led/.test(name)) { col = new THREE.Color(K.PALETTE.white); m.emissive = new THREE.Color(0.4, 0.4, 0.38); }
  else if (/tire|tyre|rubber/.test(name)) col = new THREE.Color(K.PALETTE.black).multiplyScalar(1.4);
  else if (metal && col.getHSL({}).s < 0.15) col = new THREE.Color(K.PALETTE.steel).multiplyScalar(col.r > 0.3 ? 1 : 0.45);
  m.color = col;
  if (src.map) m.map = src.map;
  if (src.aoMap) { m.aoMap = src.aoMap; m.aoMapIntensity = 1.4; }
  const nm = src.normalMap || src.clearcoatNormalMap; if (nm) { m.normalMap = nm; m.normalScale = (src.normalScale || src.clearcoatNormalScale || new THREE.Vector2(1, 1)).clone(); }
  if (m.aoMap) { const prev = null; m.userData.panel = true; }
  const isBody = !metal && col.getHSL({}).s > 0.15 && !m.emissive.getHex();
  return patchUte(m, 'stylised', gloss && (isBody || metal) ? (isBody ? 1 : 0.6) : 0);
}
const ute = new THREE.Group(); ute.rotation.order = 'YXZ'; scene.add(ute);
const chassis = new THREE.Group(); ute.add(chassis);
const UTEDATA = { looks: {}, wheels: [], axles: [], meshes: [], cz: 0.17, alt: {} };
async function loadUte() {
  const parts = await Promise.all(['ranger', 'roll-cover-manual', 'cargo-bars'].map(n => loadGLB(`assets/ute/${n}.glb`)));
  const src = new THREE.Group(); ute.add(src);
  for (const p of parts) { p.scene.traverse(o => { if (hiddenNode(p, o)) o.visible = false; }); src.add(p.scene); }
  /* the roll cover: hold the end pose of its Open clip (rolled up into the canister) */
  const cv = parts[1]; const clip = cv.animations.find(a => /Open/.test(a.name)); if (clip) { const mx = new THREE.AnimationMixer(cv.scene); mx.clipAction(clip).play(); mx.setTime(clip.duration * 0.999); }
  ute.updateMatrixWorld(true);
  const wheels = {}; src.traverse(o => { const m = /^Wheel_(FL|FR|RL|RR)$/.exec(o.name); if (m) wheels[m[1]] = o; });
  const inWheel = o => { for (let p = o; p; p = p.parent) if (/^Wheel_/.test(p.name)) return true; return false; };
  for (const m of mergeByMaterial(src, chassis, inWheel)) { chassis.add(m); UTEDATA.meshes.push(m); }
  /* skinned cover pieces stay live, moved under the chassis */
  const skinned = []; src.traverse(o => { if (o.isSkinnedMesh) { let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) vis = false; if (vis) skinned.push(o); } });
  if (skinned.length) { chassis.attach(cv.scene); for (const o of skinned) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; UTEDATA.meshes.push(o); } cv.scene.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) o.visible = false; }); }
  /* axles: front pair and rear pair, each merged by material, spinning about X through the axle */
  for (const pair of [['FL', 'FR'], ['RL', 'RR']]) {
    const a = wheels[pair[0]], b = wheels[pair[1]]; if (!a || !b) continue;
    const pa = new THREE.Vector3().setFromMatrixPosition(a.matrixWorld), pb = new THREE.Vector3().setFromMatrixPosition(b.matrixWorld);
    const axle = new THREE.Group(); axle.position.copy(pa).add(pb).multiplyScalar(0.5); const spin = new THREE.Group(); axle.add(spin); ute.add(axle); ute.updateMatrixWorld(true);
    const tmp = new THREE.Group(); tmp.add(a.clone(), b.clone()); src.add(tmp); a.parent.updateMatrixWorld(true);
    tmp.children[0].matrix.copy(a.matrixWorld); tmp.children[1].matrix.copy(b.matrixWorld); tmp.children.forEach(c => { c.matrixAutoUpdate = false; }); tmp.matrixAutoUpdate = false; tmp.matrix.copy(new THREE.Matrix4().copy(src.matrixWorld).invert()); tmp.updateMatrixWorld(true);
    for (const m of mergeByMaterial(tmp, spin)) { spin.add(m); UTEDATA.meshes.push(m); }
    src.remove(tmp); UTEDATA.axles.push({ axle, spin, y0: axle.position.y, z: axle.position.z });
  }
  if (!skinned.length) ute.remove(src); else { src.traverse(o => { if (o.isMesh && !o.isSkinnedMesh) o.visible = false; }); }
  const bb = new THREE.Box3(); for (const m of chassis.children) if (m.isMesh) { m.geometry.computeBoundingBox(); bb.union(m.geometry.boundingBox); }
  if (!bb.isEmpty()) UTEDATA.realCz = UTEDATA.cz = (bb.min.z + bb.max.z) / 2;
  /* the four looks: keep the original PBR set, build stylised and gloss sets */
  const env = makeEnv();
  const real = new Map(), sty = new Map(), glo = new Map();
  for (const m of UTEDATA.meshes) {
    const src0 = m.material; if (real.has(src0)) continue;
    if (src0.clearcoatNormalMap && !src0.normalMap) { src0.normalMap = src0.clearcoatNormalMap; src0.normalScale.copy(src0.clearcoatNormalScale); }
    if (LOW && src0.clearcoat) { src0.clearcoat = 0; src0.clearcoatMap = null; src0.clearcoatNormalMap = null; src0.clearcoatRoughnessMap = null; src0.roughness = Math.max(0.18, src0.roughness * 0.8); }
    src0.envMap = env; src0.envMapIntensity = 0.9;
    real.set(src0, patchUte(src0, 'real', 0)); sty.set(src0, styliseMaterial(src0, false)); glo.set(src0, styliseMaterial(src0, true));
  }
  for (const m of UTEDATA.meshes) m.userData.src = m.material;
  UTEDATA.looks = { real, stylised: sty, gloss: glo };
}
function makeEnv() {
  /* a small prefiltered environment: the kit sky over red ground, so the real paint reads as glossy metal */
  const es = new THREE.Scene(); const em = sky.mat.clone(); em.uniforms = { ...sky.mat.uniforms, uTone: { value: 0 } }; es.add(new THREE.Mesh(new THREE.SphereGeometry(50, 24, 12), em));
  const gnd = new THREE.Mesh(new THREE.CircleGeometry(40, 16).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color(K.PALETTE.earthRed).multiplyScalar(0.55) })); gnd.position.y = -2; es.add(gnd);
  const crt = new THREE.WebGLCubeRenderTarget(LOW ? 64 : 128, { type: THREE.HalfFloatType }); const cc = new THREE.CubeCamera(0.1, 100, crt); cc.update(renderer, es);
  const pm = new THREE.PMREMGenerator(renderer); const env = pm.fromCubemap(crt.texture).texture; crt.dispose(); pm.dispose(); return env;
}
/* the low-poly sets (another agent models them; same vehicle space, same file names): clean = matte simplified real ute, chunky = toy remodel.
   Matte flat colours, so each material's colour is baked into vertex colour and the set collapses to: one body mesh, one glow mesh
   (lights), one textured mesh per mapped material (the plate), and one mesh per axle (front pair, rear pair) that spins. */
async function loadLowpoly(set) {
  try {
    const dir = `models/lowpoly/${set}/`;
    const head = await fetch(dir + 'ute.glb', { method: 'HEAD' }); if (!head.ok) return false;
    const parts = await Promise.all((GAMEL ? ['ute'] : ['ute', 'roll-cover-open', 'cargo-bars']).map(n => loadGLB(dir + n + '.glb').catch(() => null)));
    const src = new THREE.Group(); ute.add(src);
    for (const p of parts) { if (!p) continue; p.scene.traverse(o => { if (hiddenNode(p, o)) o.visible = false; }); src.add(p.scene); }
    ute.updateMatrixWorld(true);
    const wheels = []; src.traverse(o => { if (/^wheel/i.test(o.name) && !/arch|well|liner/i.test(o.name)) wheels.push(o); });
    const topW = wheels.filter(o => { for (let q = o.parent; q; q = q.parent) if (wheels.includes(q)) return false; return true; });
    const wheelOf = o => { for (let q = o; q; q = q.parent) if (topW.includes(q)) return q; return null; };
    const inv = new THREE.Matrix4().copy(ute.matrixWorld).invert();
    const pos = w => new THREE.Vector3().setFromMatrixPosition(w.matrixWorld).applyMatrix4(inv);
    const axles = [];
    for (const ws of (GAMEL ? [...topW.filter(w => pos(w).z > 0).map(w => [w]), topW.filter(w => pos(w).z <= 0)] : [true, false].map(front => topW.filter(w => (pos(w).z > 0) === front)))) { if (!ws.length) continue; const c = new THREE.Vector3(); ws.forEach(w => c.add(pos(w))); c.multiplyScalar(1 / ws.length);
      const axle = new THREE.Group(); axle.position.copy(c); const spin = new THREE.Group(); axle.add(spin); ute.add(axle); axles.push({ axle, spin, ws, y0: c.y, z: c.z, x: c.x, steer: GAMEL && ws.length === 1, buckets: new Map() }); }
    ute.updateMatrixWorld(true);
    const body = new Map();
    const B_push = (M, kind, m0, geo) => { if (!M.has(kind)) M.set(kind, { geos: [], map: m0.map || null, side: THREE.FrontSide, col: m0.color ? m0.color.clone() : null }); const B = M.get(kind); B.geos.push(geo); if (m0.side === THREE.DoubleSide) B.side = THREE.DoubleSide; };
    src.traverse(o => {
      if (!o.isMesh || o.isSkinnedMesh) return; for (let q = o; q; q = q.parent) if (!q.visible) return;
      const m0 = o.material, w = wheelOf(o), ax = w ? axles.find(a => a.ws.includes(w)) : null;
      const em = m0.emissive ? m0.emissive.clone().multiplyScalar(m0.emissiveIntensity || 1) : new THREE.Color(0, 0, 0), glow = em.r + em.g + em.b > 0.05;
      const kind = /^(Glass|MirrorGlass)$/.test(m0.name) ? 'glass:' + m0.name : m0.map ? 'map:' + m0.uuid : glow ? (GAMEL && /TailLight/i.test(m0.name) ? 'glowT' : 'glow') : 'flat';
      const space = ax ? ax.spin : ute, M = ax ? ax.buckets : body;
      const g1 = geoInto(o, new THREE.Matrix4().copy(space.matrixWorld).invert()), n = g1.attributes.position.count, arr = new Float32Array(n * 3), vc = o.geometry.attributes.color;
      let base = glow ? em.clone().add(m0.color.clone().multiplyScalar(0.3)) : (m0.map ? new THREE.Color(1, 1, 1) : m0.color.clone());
      /* separation: the fittings' matte black (0.017) sits darker than the tub liner (0.034) and vanishes against it from the game camera;
         lift product blacks to a charcoal floor and keep the liner and wheel well as the darkest values */
      if (/^Prod(Black|Rubber)$/.test(m0.name)) { const k = Math.max(base.r, base.g, base.b); if (k < 0.06) base.multiplyScalar(0.06 / Math.max(k, 1e-3)); }
      if (/^(Well|Liner)$/.test(m0.name)) base.multiplyScalar(0.7);
      for (let i = 0; i < n; i++) { const k = vc ? [vc.getX(i), vc.getY(i), vc.getZ(i)] : [1, 1, 1]; arr[i * 3] = base.r * k[0]; arr[i * 3 + 1] = base.g * k[1]; arr[i * 3 + 2] = base.b * k[2]; }
      g1.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      /* chunky: split face normals baked in (no derivative normals: near-degenerate faces gave NaN pixels that bloom spread over the screen) */
      if (set === 'chunky') { const ng = g1.toNonIndexed(); ng.computeVertexNormals(); g1.dispose(); B_push(M, kind, m0, ng); return; }
      if (!M.has(kind)) M.set(kind, { geos: [], map: m0.map || null, side: THREE.FrontSide, col: m0.color ? m0.color.clone() : null }); const B = M.get(kind); B.geos.push(g1); if (m0.side === THREE.DoubleSide) B.side = THREE.DoubleSide;
    });
    ute.remove(src);
    const mats = {};
    const matFor = (kind, B) => { const key = kind + B.side; if (mats[key]) return mats[key];
      const m = kind === 'glow' || kind === 'glowT' ? new THREE.MeshBasicMaterial({ vertexColors: true, side: B.side, name: kind })
        : kind.startsWith('glass:') ? withGlass(patchUte(new THREE.MeshLambertMaterial({ color: B.col || 0x5d86a6, side: B.side }), 'lowpoly', 0), kind === 'glass:Glass' ? 0.7 : 0.5)
        : patchUte(new THREE.MeshLambertMaterial({ vertexColors: true, map: B.map, side: B.side }), 'lowpoly', 0);
      return (mats[key] = m); };
    const build = (M, parent) => { for (const [kind, B] of M) { const mg = mergeGeometries(B.geos, false); if (!mg) continue; mg.computeBoundingSphere(); const mesh = new THREE.Mesh(mg, matFor(kind, B)); mesh.castShadow = kind !== 'glow' && kind !== 'glowT'; mesh.receiveShadow = true; parent.add(mesh); } };
    const bodyG = new THREE.Group(); chassis.add(bodyG); build(body, bodyG);
    for (const a of axles) build(a.buckets, a.spin);
    const A = { grp: bodyG, axles, show(v) { bodyG.visible = v; for (const a of axles) a.axle.visible = v; } };
    { const bb = new THREE.Box3(); for (const m of bodyG.children) { m.geometry.computeBoundingBox(); bb.union(m.geometry.boundingBox); } if (!bb.isEmpty()) A.cz = (bb.min.z + bb.max.z) / 2; }
    A.show(false); UTEDATA.alt[set] = A; return true;
  } catch (e) { console.warn('lowpoly', set, e); return false; }
}
const AVAIL = {};
async function ensureLook(look) {
  if (look === 'clean' || look === 'chunky' || look === 'stylised') { if (!UTEDATA.alt[look]) await loadLowpoly(look); }
  else if (!UTEDATA.realLoaded) { await loadUte(); UTEDATA.realLoaded = true; for (const m of UTEDATA.meshes) m.visible = false; for (const a of UTEDATA.axles) a.axle.visible = false; }
}
function setLook(look) {
  UTE = look;
  const lp = UTEDATA.alt[look];
  for (const k in UTEDATA.alt) UTEDATA.alt[k].show(k === look);
  if (lp && lp.cz !== undefined) UTEDATA.cz = lp.cz; else if (UTEDATA.realCz !== undefined) UTEDATA.cz = UTEDATA.realCz;
  for (const m of UTEDATA.meshes) m.visible = !lp; for (const a of UTEDATA.axles) a.axle.visible = !lp;
  if (!lp && UTEDATA.realLoaded) for (const m of UTEDATA.meshes) { const set = UTEDATA.looks[look] || UTEDATA.looks.stylised; m.material = set.get(m.userData.src) || m.material; }
}
/* contact blob (all tiers) */
const blobTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 4, 32, 32, 31); gr.addColorStop(0, 'rgba(40,24,48,0.7)'); gr.addColorStop(0.6, 'rgba(40,24,48,0.35)'); gr.addColorStop(1, 'rgba(40,24,48,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const blob = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 5.9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }));
blob.rotation.order = 'YXZ'; blob.renderOrder = 1; scene.add(blob);
/* Low has no shadow map: a soft ute-shaped cast shadow, offset away from the sun and stretched along it */
const castTex = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d'); x.shadowColor = 'rgba(56,34,64,0.6)'; x.shadowBlur = 9; x.shadowOffsetX = 200; x.fillStyle = '#000'; x.fillRect(14 - 200, 14, 36, 100);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
const cast = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 6.0).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: castTex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3 }));
cast.renderOrder = 2; cast.visible = !SHADOW_MAP; cast.userData.on = !SHADOW_MAP; scene.add(cast);
const castC = document.createElement('canvas'), castS = document.createElement('canvas'); castC.width = castS.width = 96; castC.height = castS.height = 192;
const castBox = { cx: 0, cz: 0, bx: 2.6, bz: 6, d: null, look: null };
function freeBuild() {
  if (/[?&](validate|qa|arrivecheck|stylecheck)\b/.test(location.search)) return 0; let n = 0;
  const wipe = f => { if (!f) return; for (const k of Object.keys(f)) { const v = f[k]; if (Array.isArray(v) || ArrayBuffer.isView(v)) { n += v.length; f[k] = []; } } };
  for (const f of chunks) wipe(f); wipe(far); for (const p of PICK) wipe(p.f); n += casters.length; casters.length = 0;
  for (const m of chunkMeshes.concat([farMesh])) { const g = m.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); if (!g.boundingBox) g.computeBoundingBox(); for (const a of Object.values(g.attributes)) { n += a.array.length; const c = a.count; a.array = new a.array.constructor(0); a.count = c; } if (g.index) { const c = g.index.count; n += g.index.array.length; g.index.array = new g.index.array.constructor(0); g.index.count = c; } }
  return n;
}
const CAST_PTS = new Float32Array(8192);
function buildCast(look) {
  const A = UTEDATA.alt[look]; if (!A || SHADOW_MAP) return; const t0 = performance.now(); let n = 0;
  const take = (mesh, ox, oz) => { const pa = mesh.geometry && mesh.geometry.attributes.position; if (!pa) return; const st = Math.max(1, Math.ceil(pa.count / 700)); for (let i = 0; i < pa.count && n < 4096; i += st) { CAST_PTS[n * 2] = pa.getX(i) + ox; CAST_PTS[n * 2 + 1] = pa.getZ(i) + oz; n++; } };
  for (const m of A.grp.children) take(m, 0, 0);
  for (const a of A.axles) for (const m of a.spin.children) take(m, a.axle.position.x, a.axle.position.z);
  if (n < 3) return;
  const idx = new Uint16Array(n); for (let i = 0; i < n; i++) idx[i] = i;
  idx.sort((a, b) => CAST_PTS[a * 2] - CAST_PTS[b * 2] || CAST_PTS[a * 2 + 1] - CAST_PTS[b * 2 + 1]);
  const cr = (o, a, b) => (CAST_PTS[a * 2] - CAST_PTS[o * 2]) * (CAST_PTS[b * 2 + 1] - CAST_PTS[o * 2 + 1]) - (CAST_PTS[a * 2 + 1] - CAST_PTS[o * 2 + 1]) * (CAST_PTS[b * 2] - CAST_PTS[o * 2]);
  const hull = []; for (let k = 0; k < n; k++) { const p = idx[k]; while (hull.length >= 2 && cr(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) hull.pop(); hull.push(p); }
  const lo = hull.length + 1; for (let k = n - 2; k >= 0; k--) { const p = idx[k]; while (hull.length >= lo && cr(hull[hull.length - 2], hull[hull.length - 1], p) <= 0) hull.pop(); hull.push(p); } hull.pop();
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of hull) { x0 = Math.min(x0, CAST_PTS[p * 2]); x1 = Math.max(x1, CAST_PTS[p * 2]); z0 = Math.min(z0, CAST_PTS[p * 2 + 1]); z1 = Math.max(z1, CAST_PTS[p * 2 + 1]); }
  x0 -= 0.4; x1 += 0.4; z0 -= 0.4; z1 += 0.4;
  const W = castC.width, H = castC.height, g = castC.getContext('2d'); g.clearRect(0, 0, W, H); g.fillStyle = '#000'; g.beginPath();
  hull.forEach((p, k) => { const x = (CAST_PTS[p * 2] - x0) / (x1 - x0) * W, z = (CAST_PTS[p * 2 + 1] - z0) / (z1 - z0) * H; if (k) g.lineTo(x, z); else g.moveTo(x, z); }); g.closePath(); g.fill();
  const h = castS.getContext('2d'); h.clearRect(0, 0, W, H); h.shadowColor = 'rgba(56,34,64,0.55)'; h.shadowBlur = 4; h.shadowOffsetX = 400; h.drawImage(castC, -400, 0);
  if (!castBox.tex) { castBox.tex = new THREE.CanvasTexture(castS); castBox.tex.colorSpace = THREE.SRGBColorSpace; cast.material.map = castBox.tex; cast.material.needsUpdate = true; } else castBox.tex.needsUpdate = true;
  Object.assign(castBox, { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, bx: x1 - x0, bz: z1 - z0, d: true, look });
  cast.geometry.dispose(); cast.geometry = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const ms = performance.now() - t0; window.__castBuild = (window.__castBuild || []).concat([+ms.toFixed(1)]); if (!castBox.logged) { castBox.logged = true; console.info('cast shadow built in ' + ms.toFixed(1) + ' ms (' + n + ' vertices, hull ' + hull.length + ')'); }
}
/* the cast quad from the current sun in the ute's frame: offset away from the sun, stretched along it (no rebuild) */
function placeCast(px, py, pz, th) {
  const sd = U.uSunDir.value, c = Math.cos(th), sn = Math.sin(th); if (sd.y < 0.04) { cast.material.opacity = 0; return; }
  const k = Math.min(2.5, 1 / sd.y), dx = (sd.x * c - sd.z * sn) * k, dz = (sd.x * sn + sd.z * c) * k, lx = castBox.cx - dx * 0.9, lz = castBox.cz - dz * 0.9;
  cast.position.set(px + lx * c + lz * sn, py + 0.035, pz - lx * sn + lz * c); cast.rotation.set(0, th, 0); cast.scale.set(castBox.bx + Math.abs(dx) * 1.6, 1, castBox.bz + Math.abs(dz) * 1.6); cast.material.opacity = Math.min(1, sd.y * 6);
}

/* ---------------------------------------------------------------- ground FX (kit): faceted dust puffs, pebbles, tyre tracks, in world space */
const fx = K.createGroundFX(THREE, U, { puffs: LOW ? 40 : 64, pebbles: LOW ? 16 : 28, seed: 11, look: DUSTLOOK }); scene.add(fx.group); if (Q.get('dust') === '0') fx.group.visible = false;

/* ---------------------------------------------------------------- life in the world (cheap, optional) */
const life = (() => {
  if (!LIFE) return { update() {} };
  const out = [];
  /* windmill rotor */
  { const wm = new THREE.Mesh(K.toGeometry(THREE, K.windmillRotor()), worldMat); scene.add(wm); const w = T.world(MILL.s, MILL.u); const yaw = w.th + 0.4; wm.position.set(w.x + Math.sin(yaw) * 0.7, GH(MILL.s, MILL.u) + 9.8, w.z + Math.cos(yaw) * 0.7); wm.rotation.order = 'YXZ'; wm.rotation.y = yaw;
    if (!(GAMEL && GAMEL.lean)) out.push((s, t) => { wm.rotation.z = t * 1.6; }); }
  /* roos and emus: behaviour sims from the kit (graze / stand-and-look / turn / hop; run alongside / curve away / walk / peck),
     replayed from t = 0 when the clock is frozen so QA frames are reproducible; one instanced draw per species + one for contact blobs */
  { const env = { world: (s, u) => { const o = T.world(s, u); return { x: o.x, z: o.z, th: o.th }; }, toTrack: (x, z) => T.toTrack(x, z) };
    const roos = K.createRooSim(ROO_DEFS, env, 21);
    const emus = K.createEmuSim(EMU_DEFS, env, 5); window.__style.creatures = { roos, emus, groups: ROO_GROUPS };
    const mk = (parts, species, n) => { const g = K.rigGeometry(THREE, parts), aAnim = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4).setUsage(THREE.DynamicDrawUsage); g.setAttribute('aAnim', aAnim); const im = new THREE.InstancedMesh(g, K.createAnimalMaterial(THREE, U, species), n); im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(im); return { im, aAnim }; };
    const NR = ROO_DEFS.length, NE = EMU_DEFS.length, R1 = mk(K.roo2(true), 0, NR), E1 = mk(K.emu(), 1, NE);
    const bl = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2 }), NR + NE); bl.frustumCulled = false; bl.renderOrder = 1; scene.add(bl);
    const M = new THREE.Matrix4(), Qq = new THREE.Quaternion(), Eu = new THREE.Euler(0, 0, 0, 'YXZ'), Ps = new THREE.Vector3(), Sc = new THREE.Vector3(), hint = new Map();
    const ground = (a) => { const tt = T.toTrack(a.x, a.z, hint.get(a)); hint.set(a, tt[0]); return GH(tt[0], tt[1]); };
    let simT = null;
    const write = () => {
      roos.animals().forEach((a, i) => { const y = ground(a); Eu.set(0, a.h, 0); Qq.setFromEuler(Eu); Ps.set(a.x, y, a.z); Sc.setScalar(a.big ? 1.15 : a.joey ? 1.05 : 1.0); M.compose(Ps, Qq, Sc); R1.im.setMatrixAt(i, M); R1.aAnim.setXYZW(i, ...roos.anim(a));
        const k = 1 - a.lift * 0.8; Ps.set(a.x, y + 0.03, a.z); Eu.set(0, a.h, 0); Qq.setFromEuler(Eu); Sc.set(0.9 * k, 1, 1.5 * k); M.compose(Ps, Qq, Sc); bl.setMatrixAt(i, M); });
      emus.animals().forEach((a, i) => { const y = ground(a); Eu.set(0, a.h, a.lean); Qq.setFromEuler(Eu); Ps.set(a.x, y, a.z); Sc.setScalar(1); M.compose(Ps, Qq, Sc); E1.im.setMatrixAt(i, M); E1.aAnim.setXYZW(i, ...emus.anim(a));
        Ps.set(a.x, y + 0.03, a.z); Eu.set(0, a.h, 0); Qq.setFromEuler(Eu); Sc.set(0.9, 1, 1.1); M.compose(Ps, Qq, Sc); bl.setMatrixAt(NR + i, M); });
      R1.im.instanceMatrix.needsUpdate = true; R1.aAnim.needsUpdate = true; E1.im.instanceMatrix.needsUpdate = true; E1.aAnim.needsUpdate = true; bl.instanceMatrix.needsUpdate = true; };
    out.push((s, t) => {
      const STEP = 1 / 30, step = (dt, tt) => { const p = poseAt(tt); roos.step(dt, p); emus.step(dt, p); };
      if (FIXED_T !== null) { if (simT !== t) { roos.reset(21); emus.reset(5); for (let tt = 0; tt <= t; tt += STEP) step(STEP, tt); simT = t; } }
      else { const dt = simT === null ? STEP : Math.min(0.05, Math.max(0.0005, t - simT)); simT = t; step(dt, t); }
      write(); }); }
  /* galahs taking off from the gum by the road as the ute passes, and a wedge-tailed eagle circling high */
  if (!(GAMEL && GAMEL.lean)) { const NB = 7, pos = [], id = [], side = [], col = []; const pink = K.lin('#E58FA0'), grey = K.lin('#A6A4B0');
    const birdTris = (b, scale, body, wing) => { const tri = (a, c, d, w, cl) => { for (const v of [a, c, d]) { pos.push(v[0] * scale, v[1] * scale, v[2] * scale); id.push(b); side.push(w); col.push(...cl); } };
      tri([0, 0, 0.35], [-0.08, 0, -0.3], [0.08, 0, -0.3], 0, body); tri([0, 0, 0.1], [0, 0, -0.15], [-0.75, 0, -0.05], -1, wing); tri([0, 0, 0.1], [0.75, 0, -0.05], [0, 0, -0.15], 1, wing); };
    for (let b = 0; b < NB; b++) birdTris(b, 1, pink, grey);
    const gb = new THREE.BufferGeometry(); gb.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gb.setAttribute('aId', new THREE.Float32BufferAttribute(id, 1)); gb.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1)); gb.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const bm = new THREE.ShaderMaterial({ uniforms: { ...U, uPerch: { value: new THREE.Vector3() }, uTake: { value: 0 }, uEagle: { value: new THREE.Vector3() }, uFwd: { value: new THREE.Vector2(0, 1) } }, side: THREE.DoubleSide, vertexColors: true,
      vertexShader: `attribute float aId; attribute float aSide; uniform float uTime; uniform vec3 uPerch; uniform float uTake; uniform vec3 uEagle; uniform vec2 uFwd; varying vec3 vC; varying vec3 vKW;
        void main(){ vec3 p = position; vec3 c; vec3 fwd; float flap;
          if (aId > ${(NB - 0.5).toFixed(1)}) { float a = uTime * 0.12; c = uEagle + vec3(cos(a) * 34.0, 0.0, sin(a) * 34.0); fwd = normalize(vec3(-sin(a), 0.0, cos(a))); flap = 0.15 * sin(uTime * 1.3); p.y += p.x * 0.34; }
          else { float k = uTake, h = fract(sin(aId * 12.9898) * 43758.5); vec3 seat = uPerch + vec3((h - 0.5) * 2.4, 0.4 + h * 0.6, (fract(h * 7.3) - 0.5) * 2.4);
            vec3 dir = normalize(vec3(uFwd.x + (h - 0.5) * 1.2, 0.0, uFwd.y + (fract(h * 3.1) - 0.5) * 1.2)); c = seat + dir * k * (6.0 + h * 3.0) + vec3(0.0, k * (2.5 + h * 2.0) + k * k * 0.6, 0.0);
            fwd = k > 0.0 ? dir : vec3(sin(h * 6.28), 0.0, cos(h * 6.28)); flap = k > 0.0 ? sin(uTime * 13.0 + aId * 2.1) * 0.6 : 0.0; if (k <= 0.0) p.x *= 0.25; }
          vec3 rt = normalize(cross(vec3(0.0, 1.0, 0.0), fwd)); p.y += abs(p.x) * flap * 1.2; vec3 w = c + rt * p.x + vec3(0.0, p.y, 0.0) + fwd * p.z;
          vC = color; vKW = w; gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
      fragmentShader: K.HAZE_GLSL + 'varying vec3 vC; varying vec3 vKW; void main(){ gl_FragColor = vec4(applyHaze(vC * 0.9, vKW), 1.0);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}' });
    const mesh = new THREE.Mesh(gb, bm); mesh.frustumCulled = false; scene.add(mesh);
    const perch = T.world(48, -9.5);
    out.push((s, t) => { bm.uniforms.uPerch.value.set(perch.x, GH(48, -9.5) + 7.2, perch.z); bm.uniforms.uTake.value = Math.max(0, (s - 37) / SPEED); bm.uniforms.uFwd.value.set(-Math.cos(perch.th) * 0.6 + Math.sin(perch.th), Math.sin(perch.th) * 0.6 + Math.cos(perch.th));
      const e = T.world(s + 90, -20); bm.uniforms.uEagle.value.set(e.x, GH(s + 90, -20) + 62, e.z); }); }
  return { update(s, t) { for (const f of out) f(s, t); } };
})();
/* sunset god-ray wedges: additive geometry radiating from the sun */
const rays = (() => {
  const pos = [], al = []; const n = 6;
  for (let i = 0; i < n; i++) { const a = -0.9 + (i / (n - 1)) * 1.8 + (K.hash2(i, 3) - 0.5) * 0.15, w = 0.025 + K.hash2(i, 7) * 0.03, L = 1;
    pos.push(0, 0, 0, Math.sin(a - w) * L, -Math.cos(a - w) * L, 0, Math.sin(a + w) * L, -Math.cos(a + w) * L, 0); al.push(1, 0, 0); }
  const gb = new THREE.BufferGeometry(); gb.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gb.setAttribute('aA', new THREE.Float32BufferAttribute(al, 1));
  const m = new THREE.ShaderMaterial({ uniforms: { uCol: { value: new THREE.Color() }, uK: { value: 0 } }, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
    vertexShader: 'attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uCol; uniform float uK; varying float vA; void main(){ gl_FragColor = vec4(uCol * uK * vA * vA, 1.0); }' });
  const mesh = new THREE.Mesh(gb, m); mesh.frustumCulled = false; mesh.renderOrder = 8; scene.add(mesh);
  return { mesh, m };
})();

/* ---------------------------------------------------------------- post: Low = direct or one FXAA blit (+ vignette); Mid/Desktop = bloom + tone + vignette (+ FXAA) */
const blitScene = new THREE.Scene(), blitCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
let lowRT = null;
const blitMat = new THREE.ShaderMaterial({ uniforms: { tDiffuse: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uVig: { value: 0.22 }, uAA: { value: 1 } }, depthTest: false, depthWrite: false, toneMapped: false,
  vertexShader: 'varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uRes; uniform float uVig; uniform float uAA; varying vec2 vUv;
    vec3 T(vec2 o) { return texture2D(tDiffuse, vUv + o / uRes).rgb; }
    float L(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
    void main(){ vec3 rgbM = T(vec2(0.0)); vec3 col = rgbM;
      if (uAA > 0.5) { vec3 nw = T(vec2(-1.0, -1.0)), ne = T(vec2(1.0, -1.0)), sw = T(vec2(-1.0, 1.0)), se = T(vec2(1.0, 1.0));
        float lNW = L(nw), lNE = L(ne), lSW = L(sw), lSE = L(se), lM = L(rgbM), lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
        vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), ((lNW + lSW) - (lNE + lSE)));
        float red = max((lNW + lNE + lSW + lSE) * 0.03125, 1.0 / 128.0), rcp = 1.0 / (min(abs(dir.x), abs(dir.y)) + red);
        dir = clamp(dir * rcp, vec2(-8.0), vec2(8.0));
        vec3 a = 0.5 * (T(dir * (1.0 / 3.0 - 0.5)) + T(dir * (2.0 / 3.0 - 0.5))); vec3 b = a * 0.5 + 0.25 * (T(dir * -0.5) + T(dir * 0.5)); float lB = L(b);
        col = (lB < lMin || lB > lMax) ? a : b; }
      vec2 q = vUv - 0.5; col *= 1.0 - uVig * smoothstep(0.25, 0.85, dot(q, q) * 2.2);
      gl_FragColor = vec4(col, 1.0); }` });
{ const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3)); const bm = new THREE.Mesh(tri, blitMat); bm.frustumCulled = false; blitScene.add(bm); }
let composer = null, toneFx = null, fxaaPass = null;
async function buildPost() {
  if (LOW) return;
  const P = await import('postprocessing');
  composer = new P.EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: HI && AA === 'msaa' ? 4 : 0 });
  composer.addPass(new P.RenderPass(scene, camera));
  class Tone extends P.Effect { constructor() { super('KitTone', K.TONE_GLSL + `
uniform float uK; uniform float uVig; void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) { vec3 c = kitTone(inputColor.rgb * uK); vec2 q = uv - 0.5; c *= 1.0 - uVig * smoothstep(0.25, 0.85, dot(q, q) * 2.2); outputColor = vec4(c, inputColor.a); }`, { uniforms: new Map([['uK', new THREE.Uniform(1)], ['uVig', new THREE.Uniform(0.22)]]) }); } }
  const bloom = new P.BloomEffect({ mipmapBlur: true, intensity: 0.55, radius: 0.6, luminanceThreshold: 0.92, luminanceSmoothing: 0.15 });
  toneFx = new Tone();
  composer.addPass(new P.EffectPass(camera, bloom, toneFx));
  if (AA === 'fxaa') { fxaaPass = new P.EffectPass(camera, new P.FXAAEffect()); composer.addPass(fxaaPass); }
  renderer.toneMapping = THREE.NoToneMapping; sky.S.uTone.value = 0;
}
function makeLowRT() { if (lowRT) lowRT.dispose(); const w = renderer.domElement.width, h = renderer.domElement.height; lowRT = new THREE.WebGLRenderTarget(w, h, { type: THREE.UnsignedByteType, depthBuffer: true, stencilBuffer: false }); lowRT.texture.colorSpace = THREE.SRGBColorSpace; lowRT.isXRRenderTarget = true; blitMat.uniforms.tDiffuse.value = lowRT.texture; blitMat.uniforms.uRes.value.set(w, h); }
const vigEl = document.createElement('div'); vigEl.style.cssText = 'position:fixed;inset:0;pointer-events:none;background:radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 55%, rgba(30,14,30,0.28) 100%)'; document.body.appendChild(vigEl);
function render(dt) {
  if (composer) { composer.render(dt); vigEl.style.display = 'none'; return; }
  if (LOW && AA === 'fxaa') { renderer.setRenderTarget(lowRT); renderer.render(scene, camera); renderer.setRenderTarget(null); renderer.render(blitScene, blitCam); vigEl.style.display = 'none'; return; }
  vigEl.style.display = ''; renderer.render(scene, camera);
}

/* ---------------------------------------------------------------- sizing + camera (the locked game camera) */
let VW = 1, VH = 1;
function resize() { VW = window.innerWidth; VH = window.innerHeight; renderer.setPixelRatio(DPR * SCALE); renderer.setSize(VW, VH, false); if (composer) composer.setSize(VW, VH, false); camera.aspect = VW / VH; camera.updateProjectionMatrix(); if (LOW && AA === 'fxaa') makeLowRT(); }
window.addEventListener('resize', () => { if (GAMEL) GAMEL.pendingResize = true; else resize(); });
const CAMS = { portrait: { h: 4.0, d: 6.5, pitch: 18, fov: 64 }, landscape: { h: 3.8, d: 6.5, pitch: 17, fov: 58 } };
const rig = { s: LOOP[0], u: 0, th: 0, y: 0, loop: 0 };
const tw = {}, tw2 = {};
function updateUte(t) {
  const L = LOOP[1] - LOOP[0], d = t * SPEED, ph = d % L, s = LOOP[0] + ph; rig.loop = Math.floor(d / L);
  const u = laneU(s), wb = UTEDATA.axles.length === 2 ? UTEDATA.axles[0].z - UTEDATA.axles[1].z : 3.2;
  T.world(s, u, tw); const yf = GH(s + wb / 2, laneU(s + wb / 2)), yr = GH(s - wb / 2, laneU(s - wb / 2));
  const du = (laneU(s + 1) - laneU(s - 1)) / 2;
  rig.s = s; rig.u = u; rig.th = tw.th + Math.atan(-du); rig.y = (yf + yr) / 2;
  const pitch = Math.atan2(yf - yr, wb);
  ute.position.set(tw.x, rig.y, tw.z); ute.rotation.set(-pitch, rig.th, 0);
  chassis.position.y = 0.014 * Math.sin(t * 2.3) + 0.007 * Math.sin(t * 5.1 + 1.0) + 0.012 * K.fbm(s * 0.9, 1.0, 2); chassis.rotation.x = 0.005 * Math.sin(t * 1.7); chassis.rotation.z = 0.004 * Math.sin(t * 2.1 + 0.5);
  const spin = d / 0.41;
  for (const a of UTEDATA.axles) { a.spin.rotation.x = spin; a.axle.position.y = a.y0 + 0.006 * Math.sin(t * 7 + a.z); }
  for (const k in UTEDATA.alt) for (const a of UTEDATA.alt[k].axles) { a.spin.rotation.x = spin; a.axle.position.y = a.y0 + 0.006 * Math.sin(t * 7 + a.z); }
  ute.updateMatrixWorld(true);
  UU.uUteF.value.set(s, tw.x, tw.z, tw.th);
  blob.position.set(tw.x, rig.y + 0.03, tw.z); blob.rotation.set(-pitch, rig.th, 0);
  if (cast.visible) {
    const sd = U.uSunDir.value, c = Math.cos(rig.th), sn = Math.sin(rig.th), d = castBox.d;
    if (UTEDATA.alt[UTE] && castBox.look !== UTE) buildCast(UTE);
    if (castBox.d && castBox.tex) placeCast(tw.x, rig.y, tw.z, rig.th);
    else { const k = Math.min(2.2, 0.75 / Math.max(0.08, sd.y)) * 0.55, l = Math.hypot(sd.x, sd.z) || 1; cast.position.set(tw.x - sd.x / l * k + sn * UTEDATA.cz, rig.y + 0.035, tw.z - sd.z / l * k + c * UTEDATA.cz); cast.rotation.set(-pitch, rig.th, 0); cast.material.opacity = Math.min(1, sd.y * 6); }
  }
  const edge = Math.min(ph, L - ph) / SPEED; return FLY || FIXED_T !== null ? 0 : 1 - K.smooth(0.0, 0.4, edge);
}
function poseAt(t) {
  if (GAMEL && GAMEL.pose) return GAMEL.pose(t);
  const Lp = LOOP[1] - LOOP[0], d = t * SPEED, s = LOOP[0] + (d % Lp), u = laneU(s), o = T.world(s, u), du = (laneU(s + 1) - laneU(s - 1)) / 2, th = o.th + Math.atan(-du);
  return { s, u, th, x: o.x, z: o.z, loop: Math.floor(d / Lp) };
}
const AXZ = () => { const A = UTEDATA.alt[UTE]; const ax = A ? A.axles : UTEDATA.axles; return ax.length >= 2 ? [ax[0].z, ax[1].z] : [1.6, -1.6]; };
function fxSource(t, dt) {
  const p = poseAt(t), q = poseAt(t - dt), q2 = poseAt(t - 2 * dt), [zf, zr] = AXZ(), F = [Math.sin(p.th), Math.cos(p.th)], Rr = [-Math.cos(p.th), Math.sin(p.th)];
  const wheels = [];
  for (const [z, rear] of [[zr, true], [zf, false]]) for (const x of [0.81, -0.81]) { const wx = p.x + F[0] * z - Rr[0] * x, wz = p.z + F[1] * z - Rr[1] * x; wheels.push({ x: wx, z: wz, y: GH(p.s + z, p.u - x), rear, side: x > 0 ? -1 : 1 }); }
  const yaw = (p.th - q.th) / dt, aLat = Math.abs(yaw * SPEED);
  const hy = sv => GH(sv + zr, p.u), acc = Math.abs((hy(p.s) - 2 * hy(q.s) + hy(q2.s)) / (dt * dt));
  return { wheels, speed: SPEED, fwd: F, swerve: Math.min(1, aLat / 4.5), bump: Math.min(1, acc / 14), ground: (x, z) => { const tt = T.toTrack(x, z, p.s); return GH(tt[0], tt[1]); }, jump: p.loop !== q.loop };
}
let fxT = null, fxLast = null;
function fxFrame(t) {
  const STEP = 1 / 60;
  if (FIXED_T !== null) { if (fxT === t) return; fx.reset(11); for (let k = 96; k >= 0; k--) fx.step(STEP, fxSource(t - k * STEP, STEP)); fxT = t; return; }
  const dt = fxLast === null ? STEP : Math.min(0.05, Math.max(0.001, t - fxLast)); fxLast = t; fx.step(dt, fxSource(t, dt));
}
function placeCamera(t) {
  const portrait = VH > VW, C = portrait ? CAMS.portrait : CAMS.landscape;
  if (CAM === 'camp') { const a = T.world(CAMP.s - 14, CAMP.u + 9), b = T.world(CAMP.s + 1, CAMP.u - 1); camera.position.set(a.x, GH(CAMP.s - 14, CAMP.u + 9) + 3.2, a.z); camera.fov = portrait ? 60 : 48; camera.lookAt(b.x, GH(CAMP.s, CAMP.u) + 0.8, b.z); camera.updateProjectionMatrix(); return; }
  if (CAM === 'high') { const a = T.world(rig.s - 30, 0), b = T.world(rig.s + 30, 0); camera.position.set(a.x, rig.y + 30, a.z); camera.fov = portrait ? 70 : 55; camera.lookAt(b.x, rig.y, b.z); camera.updateProjectionMatrix(); return; }
  if (CAM === 'look') { const ls = +Q.get('ls'), lu = +Q.get('lu'), d = +(Q.get('ld') || 10), lh = +(Q.get('lh') || 1.5), cu = lu + (lu > 0 ? -1 : 1) * d * 0.5; const a = T.world(ls - d, cu), b = T.world(ls, lu); camera.position.set(a.x, GH(ls - d, cu) + lh + 1.0, a.z); camera.fov = 45; camera.lookAt(b.x, GH(ls, lu) + lh, b.z); camera.updateProjectionMatrix(); return; }
  if (CAM === 'sign') { const a = T.world(SIGN.s - 9, 2.2), b = T.world(SIGN.s, SIGN.u); camera.position.set(a.x, GH(SIGN.s - 9, 2.2) + 1.6, a.z); camera.fov = portrait ? 50 : 38; camera.lookAt(b.x, GH(SIGN.s, SIGN.u) + 1.4, b.z); camera.updateProjectionMatrix(); return; }
  if (CAM === 'rear3q' || CAM === 'side') { const v = new THREE.Vector3(...(CAM === 'side' ? [6.8, 1.3, -1.8] : [4.2, 1.15, -8.2])).applyMatrix4(ute.matrixWorld); camera.position.copy(v); camera.fov = portrait ? 58 : 42; const l = new THREE.Vector3(0, 0.8, CAM === 'side' ? -2.6 : -1.2).applyMatrix4(ute.matrixWorld); camera.lookAt(l); camera.updateProjectionMatrix(); return; }
  if (CAM === 'beauty') { const v = new THREE.Vector3(4.6, 1.0, 5.2).applyMatrix4(ute.matrixWorld); camera.position.copy(v); camera.fov = portrait ? 48 : 32; const l = new THREE.Vector3(0, 0.9, UTEDATA.cz).applyMatrix4(ute.matrixWorld); camera.lookAt(l); camera.updateProjectionMatrix(); return; }
  /* chase: 6.5 m behind the ute's centre along a lagged heading, fixed height above the ground under the ute, fixed pitch */
  T.at(rig.s - 3.5, tw2); const thLag = rig.th * 0.55 + tw2.th * 0.45 + 0.012 * Math.sin(t * 0.43);
  const cx = ute.position.x + Math.sin(rig.th) * UTEDATA.cz, cz = ute.position.z + Math.cos(rig.th) * UTEDATA.cz;
  const sway = 0.1 * Math.sin(t * 0.57), rx = -Math.cos(thLag), rz = Math.sin(thLag);
  camera.position.set(cx - Math.sin(thLag) * C.d + rx * sway, rig.y + C.h + 0.05 * Math.sin(t * 0.9), cz - Math.cos(thLag) * C.d + rz * sway);
  camera.rotation.set(-C.pitch * Math.PI / 180, thLag + Math.PI, 0.006 * Math.sin(t * 0.45)); camera.fov = C.fov; camera.updateProjectionMatrix();
}

/* ---------------------------------------------------------------- stats, info */
const statsEl = Object.assign(document.createElement('pre'), { id: 'stats' }); statsEl.style.display = STATS ? '' : 'none'; document.body.appendChild(statsEl);
function texMB() { let b = 0; const seen = new Set(); scene.traverse(o => { const ms = o.material ? [o.material] : []; for (const m of ms) for (const k in m) { const t = m[k]; if (t && t.isTexture) seen.add(t); } }); seen.add(maskTex); for (const t of seen) { const im = t.image; if (im && im.width) b += im.width * im.height * (t === maskTex ? 1 : 4) * (t.generateMipmaps === false || t === maskTex ? 1 : 1.33); } if (!LOW) b += (HI ? 2048 : 1024) ** 2 * 4; return b / 1048576; }
function transferMB() { let b = 0; for (const e of performance.getEntriesByType('resource')) b += e.transferSize || e.encodedBodySize || 0; const nav = performance.getEntriesByType('navigation')[0]; if (nav) b += nav.transferSize || nav.encodedBodySize || 0; return b / 1048576; }
function transferSplit() { let ute = 0, other = 0; for (const e of performance.getEntriesByType('resource')) { const v = e.transferSize || e.encodedBodySize || 0; if (/\/ute\/|lowpoly/.test(e.name)) ute += v; else other += v; } const nav = performance.getEntriesByType('navigation')[0]; if (nav) other += nav.transferSize || nav.encodedBodySize || 0; return { uteMB: +(ute / 1048576).toFixed(2), otherMB: +(other / 1048576).toFixed(2) }; }

/* ---------------------------------------------------------------- options panel */
function buildPanel() {
  const css = document.createElement('style');
  css.textContent = `#opt{position:fixed;right:10px;top:10px;z-index:5;font:500 14px/1.3 system-ui,sans-serif;color:#f3e9da}
    #opt>button{min-height:40px;padding:8px 14px;border-radius:20px;border:1px solid rgba(255,255,255,.25);background:rgba(28,20,30,.62);color:inherit;font:inherit}
    #opt .p{display:none;margin-top:8px;padding:12px 14px;border-radius:12px;background:rgba(28,20,30,.82);border:1px solid rgba(255,255,255,.18);min-width:210px}
    #opt.open .p{display:block} #opt h4{margin:8px 0 4px;font-size:11px;letter-spacing:.08em;text-transform:uppercase;opacity:.65}
    #opt label{display:flex;align-items:center;gap:10px;min-height:36px} #opt input[type=checkbox]{width:20px;height:20px;accent-color:#ffc600}
    #opt select{width:100%;min-height:36px;border-radius:8px;border:1px solid rgba(255,255,255,.25);background:#2a2030;color:inherit;font:inherit;padding:4px 8px} #opt .note{font-size:12px;opacity:.7}`;
  document.head.appendChild(css);
  const box = document.createElement('div'); box.id = 'opt'; if (innerWidth >= 900) box.classList.add('open');
  const sel = (k, opts, v) => `<select data-s="${k}">${opts.map(([a, b]) => `<option value="${a}" ${a === v ? 'selected' : ''}>${b}</option>`).join('')}</select>`;
  const looks = [...(AVAIL.stylised ? [['stylised', 'Stylised (real mesh)']] : []), ...(AVAIL.clean ? [['clean', 'Clean (light)']] : []), ...(AVAIL.chunky ? [['chunky', 'Chunky']] : []), ['real', 'Real (PBR)']];
  box.innerHTML = `<button type="button">Options</button><div class="p">
    <h4>Ute</h4>${sel('ute', looks, UTE)}
    <h4>Moment</h4>${sel('moment', [['golden', 'Golden hour'], ['sunset', 'Sunset'], ['dusk', 'Dusk at camp'], ['fly', 'Drive all three']], FLY ? 'fly' : MOMENT)}
    <h4>Quality</h4>${sel('tier', [['low', 'Low'], ['mid', 'Mid'], ['desktop', 'Desktop']], TIER)}<div class="note">tier: ${TIER}${QT ? '' : ' (auto)'} · ${GPU0.slice(0, 28)}</div>
    <h4>Smoothing</h4>${sel('aa', [['off', 'Off'], ['fxaa', 'FXAA'], ['msaa', 'MSAA (reload)']], AA)}
    <h4>Camera</h4>${sel('cam', [['chase', 'Game'], ['beauty', 'Beauty'], ['high', 'High'], ['camp', 'Camp']], CAM)}
    <label><input type="checkbox" data-k="stats" ${STATS ? 'checked' : ''}>Stats</label><label><input type="checkbox" data-k="perf" ${PERF ? 'checked' : ''}>Performance log</label></div>`;
  document.body.appendChild(box);
  box.querySelector('button').onclick = () => box.classList.toggle('open');
  const reload = (k, v) => { const p = new URLSearchParams(location.search); if (k === 'moment') { p.delete('fly'); p.delete('moment'); if (v === 'fly') p.set('fly', '1'); else p.set('moment', v); } else p.set(k, v); p.set('ute', UTE); location.search = p.toString(); };
  box.querySelector('[data-s=ute]').onchange = async e => { const el = e.target; el.disabled = true; await ensureLook(el.value); try { await renderer.compileAsync(scene, camera); } catch (er) { /* ignore */ } setLook(el.value); el.disabled = false; REC.ev('ute', { look: UTE }); const p = new URLSearchParams(location.search); p.set('ute', UTE); history.replaceState(null, '', '?' + p); };
  box.querySelector('[data-s=moment]').onchange = e => reload('moment', e.target.value);
  box.querySelector('[data-s=tier]').onchange = e => reload('tier', e.target.value);
  box.querySelector('[data-s=aa]').onchange = e => { const v = e.target.value; if (v === 'msaa' || AA === 'msaa' || !LOW) { reload('aa', v); return; } AA = v; if (v === 'fxaa') makeLowRT(); REC.ev('aa', { aa: v }); };
  box.querySelector('[data-s=cam]').onchange = e => { CAM = e.target.value; };
  box.querySelectorAll('input[type=checkbox]').forEach(el => el.onchange = () => { if (el.dataset.k === 'stats') { STATS = el.checked; statsEl.style.display = STATS ? '' : 'none'; } else PERF = el.checked; });
}

/* ---------------------------------------------------------------- main */
async function main() {
  say('building trail', 30);
  say('loading ute', 55);
  /* only the chosen look is loaded at start; the others load when picked in the panel */
  for (const set of ['stylised']) { try { AVAIL[set] = (await fetch(`models/lowpoly/${set}/ute.glb`, { method: 'HEAD' })).ok; } catch (e) { AVAIL[set] = false; } }
  /* default: the stylised real-mesh set (Clean on Low, where triangles are tightest) */
  if (!UTE) UTE = (LOW ? ['clean', 'stylised'] : ['stylised', 'clean']).concat(['chunky']).find(k => AVAIL[k]) || 'real';
  if (UTE !== 'real' && !AVAIL[UTE]) UTE = ['stylised', 'clean', 'chunky'].find(k => AVAIL[k]) || 'real';
  await ensureLook(UTE);
  setLook(UTE);
  await buildPost();
  resize();
  if (UI && !GAMEL) buildPanel();
  if (GAMEL) await GAMEL.attach({ THREE, K, renderer, scene, camera, U, UU, T, GH, ute, chassis, UTEDATA, setLook, ensureLook, get look() { return UTE; }, rig, fx, blob, cast, castBox, buildCast, placeCast, freeBuild, dynHoldFor: ms => { dynHold = Math.max(dynHold, performance.now() + ms); }, chunkMeshes, farMesh, sky, sun, hemi, worldMat, life, REC, BRANDS, BOARDS, brandFaceCanvas, facePlane, texOf, LOGO, TIER, LOW, HI, AA, DPR, get composer() { return composer; }, get SCALE() { return SCALE; }, CAMP, MILL, placeCamera, setCam: c => { CAM = c; } });
  say('compiling', 85);
  const t0 = FIXED_T !== null ? FIXED_T : 0;
  updateUte(t0); placeCamera(t0);
  /* compile every look once so switching never hitches */
  if (UTEDATA.realLoaded) { const keep = UTE; for (const l of ['real']) { setLook(l); try { renderer.compile(scene, camera); } catch (e) { /* ignore */ } } setLook(keep); }
  try { await renderer.compileAsync(scene, camera); } catch (e) { renderer.compile(scene, camera); }
  const texMem = texMB();
  let frames = 0, fpsN = 0, infoT = performance.now(), lastT = 0, cpuSum = 0, cpuN = 0, dynN = 0, dynT = performance.now(), dynHold = performance.now() + 3000, okW = 0, xfer = 0, lastStats = 0;
  const dynRing = new Float32Array(90);
  /* GPU time per frame where EXT_disjoint_timer_query_webgl2 exists (desktop Chrome; ?gputimer=1) */
  const GT = (() => { const gl = renderer.getContext(), ext = Q.get('gputimer') === '1' ? gl.getExtension('EXT_disjoint_timer_query_webgl2') : null; if (!ext) return { begin() {}, end() {}, read() { return null; } };
    const pool = []; let active = null, sum = 0, cnt = 0;
    return { begin() { if (active || pool.length > 4) return; active = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, active); },
      end() { if (active) { gl.endQuery(ext.TIME_ELAPSED_EXT); pool.push(active); active = null; } while (pool.length && gl.getQueryParameter(pool[0], gl.QUERY_RESULT_AVAILABLE)) { const qq = pool.shift(); if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) { sum += gl.getQueryParameter(qq, gl.QUERY_RESULT) / 1e6; cnt++; } gl.deleteQuery(qq); } },
      read() { const v = cnt ? +(sum / cnt).toFixed(3) : null; sum = 0; cnt = 0; return v; } }; })();
  let gpuMs = null;
  const frustum = new THREE.Frustum(), pm = new THREE.Matrix4();
  function frame() {
    const now0 = performance.now();
    const t = FIXED_T !== null ? FIXED_T : clock.getElapsedTime();
    U.uTime.value = t;
    if (GAMEL && GAMEL.pendingResize) { GAMEL.pendingResize = false; resize(); }
    const fade = GAMEL ? GAMEL.poseUte(t) : updateUte(t);
    if (GAMEL) GAMEL.camera(t); else placeCamera(t);
    const m = LIGHT ? K.momentAt(0, [[0, LIGHT]]) : K.momentAt(rig.s, GAMEL ? GAMEL.SCRIPT : undefined);
    K.applyMoment(THREE, m, U, sky, LIGHTS); glassSkyFrom(m);
    renderer.toneMappingExposure = 1 - fade; sky.S.uExposure && (sky.S.uExposure.value = 1); if (toneFx) toneFx.uniforms.get('uK').value = 1 - fade;
    U.uFlicker.value = 0.82 + 0.18 * Math.sin(t * 17.0) * Math.sin(t * 7.3 + 1.0);
    if (fireLight) fireLight.intensity = m.fire * (14 + 5 * U.uFlicker.value);
    { const w = T.world(CREEK_S, 0); U.uMist.value.set(w.x, w.z, 46, m.mist); U.uMistH.value = roadY(CREEK_S) - 0.6; U.uMistCol.value.setRGB(...m.hazeAnti); }
    /* the key light's shadow box rides with the ute; only the chunks under the ute receive it */
    const sd = U.uSunDir.value; sun.target.position.copy(ute.position); sun.position.copy(ute.position).addScaledVector(sd, 30); sun.target.updateMatrixWorld();
    for (const c of chunkMeshes) { c.receiveShadow = !LOW && Math.abs(c.userData.s0 + CHL / 2 - rig.s) < CHL; c.visible = CAM !== 'chase' || (c.userData.s0 + CHL > rig.s - 90 && c.userData.s0 < rig.s + 520); }
    /* god rays: a fan hung in the sky at the sun, facing the camera */
    rays.m.uniforms.uK.value = m.rays * 0.045; rays.mesh.visible = m.rays > 0.02 && sd.y > -0.02;
    if (rays.mesh.visible) { rays.mesh.position.copy(camera.position).addScaledVector(sd, 900); rays.mesh.quaternion.copy(camera.quaternion); rays.mesh.scale.setScalar(900); rays.m.uniforms.uCol.value.setRGB(...m.sunCol); }
    if (GAMEL) GAMEL.fx(t); else fxFrame(t);
    life.update(rig.s, t);
    for (let i = 0; i < pickMeshes.length; i++) { const pm = pickMeshes[i]; pm.visible = !(FLY && rig.s > PICK[i].s - 1); const o = pm.material.userData.pickup, ph = t * 2.6 - i * 0.55;
      o.uGlowK.value = 0.8 + 0.28 * Math.sin(ph); o.uBob.value = 0.06 + 0.06 * Math.sin(ph); }
    renderer.info.reset();
    const tc0 = performance.now();
    if (GAMEL) GAMEL.beforeRender(t); GT.begin(); render(0.016); GT.end(); if (GAMEL) GAMEL.afterRender(t);
    const now = performance.now();
    const fdt = lastT ? tc0 - lastT : 16.7; lastT = tc0; REC.frame(fdt); dynRing[dynN++ % 90] = fdt;
    cpuSum += now - now0; cpuN++; frames++; fpsN++;
    if (now - infoT > 500) {
      { const g = GT.read(); if (g !== null) gpuMs = g; }
      if (frames < 900 && now - xfer > 2000) { xfer = now; window.__style.xfer = { totalMB: +transferMB().toFixed(2), ...transferSplit() }; }
      window.__style.info = { fps: fpsN * 1000 / (now - infoT), calls: renderer.info.render.calls, tris: renderer.info.render.triangles, programs: renderer.info.programs ? renderer.info.programs.length : 0, texMB: +texMem.toFixed(1), worldTris, tier: TIER, ute: UTE, moment: FLY ? 'fly' : MOMENT, aa: AA, gpuMs, cpuMs: +(cpuSum / Math.max(1, cpuN)).toFixed(2), dpr: DPR, scale: SCALE, size: [VW, VH], canvas: [renderer.domElement.width, renderer.domElement.height], ...(window.__style.xfer || {}) };
      infoT = now; fpsN = 0; cpuSum = 0; cpuN = 0;
    }
    window.__style.frames = frames;
    REC.tick(now, { ute: UTE, moment: FLY ? 'fly' : MOMENT, s: +rig.s.toFixed(1), gpuMs, cpuMs: window.__style.info.cpuMs, texMB: +texMem.toFixed(1) });
    if (now < dynHold) { dynN = 0; dynT = now; }
    else if (now - dynT > 1000 && dynN >= 20 && FIXED_T === null && !HI && !DYN_OFF) {
      const k = Math.min(dynN, 90), so = Float32Array.from(dynRing.subarray(0, k)).sort(), med = so[k >> 1], p95 = so[Math.floor(k * 0.95)]; let slow = 0; for (let i = 0; i < k; i++) if (so[i] > 33) slow++;
      BADW = med > 20 ? BADW + 1 : 0;
      if (BADW >= 2 && SCALE > SCALE_MIN) { BADW = 0; SCALE = Math.max(SCALE_MIN, SCALE - 0.1); dynHold = now + 1500; resize(); REC.ev('render-scale', { scale: +SCALE.toFixed(2) }); console.info('render scale ' + SCALE.toFixed(2) + ' (median ' + med.toFixed(1) + ' ms)'); okW = 0; }
      else if (med < 17.5 && slow <= 1 && SCALE < 1) { if (++okW >= 2) { SCALE = Math.min(1, SCALE + 0.05); dynHold = now + 1500; resize(); console.info('render scale ' + SCALE.toFixed(2) + ' (median ' + med.toFixed(1) + ' ms)'); okW = 0; } } else okW = 0;
      dynT = now; dynN = 0;
    }
    if (STATS && now - lastStats > 400) { lastStats = now; const i = window.__style.info; statsEl.textContent = `${i.tier} ${i.fps ? i.fps.toFixed(0) : '-'} fps  ute ${i.ute}\ncalls ${i.calls}  tris ${(i.tris / 1000).toFixed(0)}k  prog ${i.programs}\ntex ~${i.texMB} MB  load ${i.totalMB || '-'} MB (ute ${i.uteMB || '-'})\n${VW}x${VH} @${(DPR * SCALE).toFixed(2)}  ${i.moment} s=${rig.s.toFixed(0)}`; }
    requestAnimationFrame(frame);
  }
  render(0.016);
  say('', 100); window.__style.ready = true;
  requestAnimationFrame(frame);
}
main().catch(e => { console.error(e); window.__style.errors.push(String(e && e.stack || e)); say('error: ' + e.message); });
window.__style.boards = BOARDS;
/* hard checks: nothing inside the drivable corridor + 1.5 m shoulder (|u| < 5.3 m, below 3 m above the road) except the hazard, the
   cattle grid, the arch gate posts and pebbles; nothing floating (lowest vertex > 12 cm above the ground under it) or fully buried;
   near mesas >= 14 m clear */
window.__style.placedBins = () => { const b = {}; for (const p of PLACED) { const k = Math.floor(p.s / 100) * 100; b[k] = b[k] || {}; b[k][p.tag] = (b[k][p.tag] || 0) + 1; } return b; };
window.__style.qa = () => {
  const out = { corridor: [], floating: [], buried: [], mesaTight: [], placed: PLACED.length, gorgeMesas: window.__style.gorgeMesas, farRejected: window.__style.farRejected };
  for (const p of PLACED) {
    const f = chunks[p.ci]; let lo = 1e9, hi = -1e9, bad = 0;
    for (let v = p.v0; v < p.v1; v++) { const s = f.T[v * 2], u = f.T[v * 2 + 1], y = f.P[v * 3 + 1], gy = GH(s, u), h = y - gy; lo = Math.min(lo, h); hi = Math.max(hi, h); if (Math.abs(u) < 5.3 && h > -0.05 && h < 3.0) bad++; }
    if (bad && p.s < ROAD_END && !['hazard', 'grid', 'pebble', 'archgate', 'gantry'].includes(p.tag)) out.corridor.push([p.tag, +p.s.toFixed(1), +p.u.toFixed(1), bad]);
    if (p.tag === 'gantry' && bad) out.corridor.push(['gantry-low', +p.s.toFixed(1), bad]);
    if (lo > 0.12 && p.tag !== 'mesa' && p.tag !== 'fx') out.floating.push([p.tag, +p.s.toFixed(1), +p.u.toFixed(1), +lo.toFixed(2)]);
    if (hi < 0.02) out.buried.push([p.tag, +p.s.toFixed(1), +p.u.toFixed(1)]);
    if (p.tag === 'mesa' && p.minU < 15) out.mesaTight.push([+p.s.toFixed(0), +p.minU.toFixed(1)]);
  }
  return out;
};
window.__style.setT = v => { FIXED_T = v; };
window.__style.api = { MASK, casters, T, K, GH, setLook, get rig() { return rig; }, camera, renderer, scene };
