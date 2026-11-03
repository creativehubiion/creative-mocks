// sony-htrab-01 build: the 3D world under the game's 2D layer (three.js 0.160). The game logic, HUD, minigames and icons stay in
// heist-game.js; this module reads GAME.S every frame and draws the bank: Gemini-textured rooms, lights and shadows, the Tripo-rigged
// robber and guard with retargeted Mixamo clips, sight cones on the floor, the TV, the camera, the lasers, the doors.
// Our world's x runs to the right looking along +z; three's runs to the left, so every x is mirrored (X).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const G = window.GAME, Q = new URLSearchParams(location.search), X = x => -x, D2R = Math.PI / 180;
const canvas = document.getElementById('gl');
const POSTFX = !Q.has('nopost') && !Q.get('capture') && !Q.has('matte');
const R = new THREE.WebGLRenderer({ canvas, antialias: !POSTFX, powerPreference: 'high-performance' });   // with the grade on, MSAA lives in the HDR target
let PR = Q.has('pr') ? +Q.get('pr') : Math.min(1.5, devicePixelRatio || 1); R.setPixelRatio(PR); R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
window.__R = R; window.__cam = null; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 0.95; R.outputColorSpace = THREE.SRGBColorSpace;
const scene = new THREE.Scene(); scene.background = new THREE.Color('#0d0b09'); scene.fog = new THREE.Fog('#1a1410', 22, 58);
const camera = new THREE.PerspectiveCamera(G.CONFIG.fovY, 2 / 3, 0.25, 80); camera.rotation.order = 'YXZ'; window.__cam = camera;   // near 0.25 / far 80: 2.5x the depth precision (phones z-fought at 0.1, owner 20:13)
function resize() { if (window.__capSized) return; const r = canvas.getBoundingClientRect(); if (!r.width) return; R.setSize(r.width, r.height, false); camera.aspect = r.width / r.height;
  camera.fov = G.CONFIG.fovY;   // the same vertical view as the 2:3 frame on any screen (owner 20:17: the robber stays as large)
  camera.updateProjectionMatrix(); }
new ResizeObserver(resize).observe(canvas); resize();

// ── materials from the Gemini tiles ──
// the loader screen: progress from three's loading manager; done when the bank, both actors and the environment are in (or after 25 s)
{ const bar = document.getElementById('loadBar'), el = document.getElementById('load'), lt = document.getElementById('loadT'), lv = document.getElementById('loadV'); let shown = 0, done = false;
  const LINES = ['Masks on…', 'Casing the bank…', 'Connecting to the stream…']; let li = 0; const cyc = setInterval(() => { if (done || !lt) return; li = (li + 1) % LINES.length; lt.textContent = LINES[li]; }, 900);
  const vt = setInterval(() => { if (!lv) return; const v = Math.round(150000 * Math.min(1, shown * 0.85 + 0.03) + Math.random() * 900); lv.textContent = (v >= 1000 ? Math.round(v / 1000) + 'K' : v) + ' watching'; }, 120);
  THREE.DefaultLoadingManager.onProgress = (u, a, b) => { shown = Math.max(shown, a / Math.max(1, b)); if (bar) bar.style.width = Math.round(4 + 96 * shown) + '%'; };
  const finish = () => { if (done || !el) return; done = true; clearInterval(cyc); clearInterval(vt); if (bar) bar.style.width = '100%'; if (lt) { lt.textContent = 'GOING LIVE'; lt.classList.add('live'); } if (lv) lv.textContent = '150K watching'; setTimeout(() => { el.classList.add('done'); if (G.S && G.S.mode === 'play' && !G.S.started && !G.BOT) G.begin('play'); window.__loaded = true; }, 650); };
  const poll = setInterval(() => { if (window.__bank && window.__actor && window.__guard && window.__env) { clearInterval(poll); finish(); } }, 100);
  setTimeout(() => { clearInterval(poll); finish(); }, 25000);
  if (!el) window.__loaded = true; }
const TL = new THREE.TextureLoader();
function tex(name, rx, ry) { const t = TL.load(`assets/tex/${name}.webp`); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = R.capabilities.getMaxAnisotropy(); return t; }
const mStd = (o) => new THREE.MeshStandardMaterial(o);
// a scanned material: colour + normal + roughness, repeated by metres
function pbr(id, rx, ry, o = {}) {
  const ld = (suf, srgb) => { const t = TL.load(`assets/pbr/${id}_${suf}.webp`); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = R.capabilities.getMaxAnisotropy(); return t; };
  return new THREE.MeshStandardMaterial(Object.assign({ map: ld('diff', true), normalMap: ld('nor'), roughnessMap: ld('rough'), roughness: 1, metalness: 0, normalScale: new THREE.Vector2(1, 1) }, o));
}
// the HDRI lights and reflects everything (image-based lighting)
const pmrem = new THREE.PMREMGenerator(R);
new RGBELoader().load('assets/pbr/bank_vault_1k.hdr', (hdr) => { const env = pmrem.fromEquirectangular(hdr).texture; scene.environment = env; hdr.dispose(); window.__env = true;
  scene.traverse(o => { if (o.isMesh && o.material && o.material.isMeshStandardMaterial) o.material.envMapIntensity = o.material.userData.env ?? 0.4; }); });
function plane(w, h, mat, pos, rot) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(...pos); m.rotation.set(...rot); m.receiveShadow = true; scene.add(m); return m; }
function box(x0, x1, y0, y1, z0, z1, mat, cast = true) { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), mat); m.position.set(X((x0 + x1) / 2), (y0 + y1) / 2, (z0 + z1) / 2); m.castShadow = cast; m.receiveShadow = true; scene.add(m); return m; }
// a room: floor, ceiling, two side walls (walnut panels below, plaster above); repeat by metres so tiles keep their size
function room(r, h, opts = {}) {
  const lower = opts.lower || 'dark_paneled_wood', upper = opts.upper || 'beige_wall_001';
  const w = r.x1 - r.x0, l = r.z1 - r.z0, cx = X((r.x0 + r.x1) / 2), cz = (r.z0 + r.z1) / 2;
  plane(w, l, mStd({ map: tex('floor-marble', w / 2.4, l / 2.4), roughness: 0.3, metalness: 0.0 }), [cx, 0, cz], [-Math.PI / 2, 0, 0]);
  plane(w, l, pbr('ceiling_interior', w / 4, l / 4), [cx, h, cz], [Math.PI / 2, 0, 0]);
  const panelH = Math.min(2.6, h * 0.55);
  for (const side of [-1, 1]) {
    const x = side < 0 ? r.x0 : r.x1, ry = side < 0 ? -Math.PI / 2 : Math.PI / 2;   // mirrored: our left wall is three's +x
    plane(l, panelH, pbr(lower, l / 2.0, panelH / 2.0), [X(x), panelH / 2, cz], [0, ry, 0]);
    plane(l, h - panelH, pbr(upper, l / 2.5, (h - panelH) / 2.5), [X(x), panelH + (h - panelH) / 2, cz], [0, ry, 0]);
    box(x - 0.04, x + 0.04, panelH - 0.05, panelH + 0.05, r.z0, r.z1, mStd({ color: '#b08d4a', metalness: 0.8, roughness: 0.35 }), false);   // brass rail
  }
  return { panelH };
}
const ROOM = G.ROOM;
room({ x0: ROOM.lobby.x0, x1: ROOM.lobby.x1, z0: -5, z1: ROOM.lobby.z1 }, 5);
room(ROOM.corr, 3.2, { lower: 'concrete_panels', upper: 'concrete_panels' }); room(ROOM.vault, 4.5, { lower: 'concrete_panels', upper: 'concrete_panels' });
// end walls: the entrance (glass doors), the security wall with its door gap, the corridor's ends, the vault's back wall
const wallMat = pbr('beige_wall_001', 4, 2), walnutEnd = pbr('dark_paneled_wood', 2.5, 2.5), concreteEnd = pbr('concrete_panels', 2, 2);
plane(12, 5, wallMat, [0, 2.5, -5], [0, 0, 0]);
const glass = mStd({ color: '#9fc3d6', transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.2 }); plane(3.2, 3, glass, [0, 1.5, -4.98], [0, 0, 0]);
box(-6, -1.1, 0, 5, 29.9, 30.1, walnutEnd); box(1.1, 6, 0, 5, 29.9, 30.1, walnutEnd); box(-1.1, 1.1, 3.2, 5, 29.9, 30.1, wallMat);
box(-5, -2, 0, 4.5, 53.9, 54.1, concreteEnd); box(2, 5, 0, 4.5, 53.9, 54.1, concreteEnd); box(-2, 2, 3.2, 4.5, 53.9, 54.1, concreteEnd);
const signC = document.createElement('canvas'); signC.width = 512; signC.height = 96; { const c = signC.getContext('2d'); c.fillStyle = '#1b1712'; c.fillRect(0, 0, 512, 96); c.fillStyle = '#d8b65a'; c.font = '700 54px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('VAULT ACCESS', 256, 50); }
const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.5), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(signC) })); sign.position.set(0, 3.7, 29.88); sign.rotation.y = Math.PI; scene.add(sign);
plane(10, 4.5, mStd({ color: '#3a3b3e', roughness: 0.7, metalness: 0.3 }), [0, 2.25, ROOM.vault.z1 - 0.01], [0, Math.PI, 0]);
// pillars, counter, bench
const pillarMats = [];
for (const b of G.BOX) {
  if (b.c === 'pillar') { const m = pbr('marble_01', 0.6, 2.5, { transparent: true, roughness: 0.6, color: '#f2ede6' }); pillarMats.push({ b, m }); box(b.x0, b.x1, 0, b.h, b.z0, b.z1, m); box(b.x0 - 0.12, b.x1 + 0.12, 0, 0.35, b.z0 - 0.12, b.z1 + 0.12, pbr('marble_01', 0.8, 0.3, { color: '#8d8478' })); box(b.x0 - 0.1, b.x1 + 0.1, b.h - 0.3, b.h, b.z0 - 0.1, b.z1 + 0.1, pbr('marble_01', 0.8, 0.3)); }
  else if (b.c === 'desk') { box(b.x0, b.x1, 0, b.h, b.z0, b.z1, pbr('dark_paneled_wood', 1.2, 0.6)); box(b.x0 - 0.05, b.x1 + 0.05, b.h, b.h + 0.06, b.z0 - 0.05, b.z1 + 0.05, pbr('marble_01', 1, 0.5, { roughness: 0.35 })); }
  else if (b.c === 'rope') { /* drawn as brass posts + rope below; collision only */ }
  else box(b.x0, b.x1, 0, b.h, b.z0, b.z1, mStd({ color: '#4b3a2a', roughness: 0.6 }));
}
// bank furniture that is not collision: teller-window grilles on the counter, a velvet-rope queue line, a big wall clock
const brass = mStd({ color: '#b8913c', metalness: 0.9, roughness: 0.3 });
for (let z = 5.6; z < 28.4; z += 1.4) box(4.5, 4.56, 1.15, 2.4, z - 0.03, z + 0.03, brass);                       // grille uprights between teller windows
box(4.5, 4.56, 2.36, 2.44, 5, 28.5, brass, false);                                                                     // the grille's top rail
for (const z of [3.5, 5.0, 6.5, 8.0]) { box(1.55, 1.65, 0, 0.95, z - 0.05, z + 0.05, brass); }                        // rope stanchions
const ropeMat = mStd({ color: '#7a1020', roughness: 0.7 }); box(1.58, 1.62, 0.82, 0.86, 3.5, 8.0, ropeMat, false);   // the velvet rope
const clock = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.08, 40), mStd({ color: '#efe6d2', roughness: 0.5 })); clock.rotation.x = Math.PI / 2; clock.position.set(0, 4.1, 29.86); scene.add(clock);
const clockRim = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.06, 10, 40), brass); clockRim.position.set(0, 4.1, 29.84); scene.add(clockRim);
// the security door (slides when hacked) and its keypad
const doorPanel = box(-1.1, 1.1, 0, 3.2, 29.95, 30.0, (() => { const t = new THREE.TextureLoader().load('assets/tex/security_door.webp'); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return new THREE.MeshBasicMaterial({ map: t, color: '#d4d6d9' }); })());   // the Gemini security door (owner 22:30)
const keypad = box(G.DOOR.keypad.x - 0.12, G.DOOR.keypad.x + 0.12, 1.12, 1.48, 29.86, 29.9, (() => { const t = new THREE.TextureLoader().load('assets/tex/keypad.webp'); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshBasicMaterial({ map: t, color: '#dcdcdc' }); })(), false);   // the Gemini keypad (owner 22:12)
// the vault door: a thick disc with bolts on a hinge
const vaultHinge = new THREE.Group(); vaultHinge.position.set(X(-2.4), 2.3, G.VAULT.z - 0.3); scene.add(vaultHinge);
const vaultDoor = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.5, 48), mStd({ color: '#a7abb0', metalness: 0.9, roughness: 0.28 })); vaultDoor.rotation.x = Math.PI / 2; vaultDoor.position.set(X(2.4) - X(-2.4) + X(-2.4) * 0 - 0, 0, 0); vaultDoor.position.x = X(0) - X(-2.4); vaultDoor.castShadow = true; vaultHinge.add(vaultDoor);
for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 12), mStd({ color: '#c9ccd1', metalness: 0.95, roughness: 0.28 })); bolt.rotation.x = Math.PI / 2; bolt.position.set(vaultDoor.position.x + Math.cos(a) * 1.7, Math.sin(a) * 1.7, -0.05); vaultHinge.add(bolt); }
{ const t = new THREE.TextureLoader().load('assets/tex/vault_door.webp'); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;   // the Gemini vault door face: bolts, wheel and dial are in the picture (00:44)
  const face = new THREE.Mesh(new THREE.CircleGeometry(2.2, 64), new THREE.MeshStandardMaterial({ map: t, transparent: true, metalness: 0.55, roughness: 0.38, envMapIntensity: 0.45 })); face.rotation.y = Math.PI; face.position.set(vaultDoor.position.x, 0, -0.262); vaultHinge.add(face);
  vaultDoor.material.metalness = 0.7; vaultDoor.material.roughness = 0.42; vaultDoor.material.color.set('#8d9196'); vaultHinge.children.forEach(c => { if (c !== vaultDoor && c !== face) c.visible = false; }); }
const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.07, 12, 40), mStd({ color: '#d8d8d8', metalness: 0.95, roughness: 0.2 })); wheel.position.set(vaultDoor.position.x, 0, -0.3); wheel.visible = false;
const gold = new THREE.Group(); scene.add(gold); gold.visible = false; for (let i = 0; i < 0; i++) { const g = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.18, 0.25), mStd({ color: '#d9a92a', metalness: 1, roughness: 0.25, emissive: '#3a2600' })); g.position.set(X(-1.5 + (i % 6) * 0.6), 0.2 + Math.floor(i / 6) * 0.2, G.VAULT.z + 0.6); gold.add(g); }
// the lobby TV (screen switches to the crew's stream) and the security camera
const tvScreenC = document.createElement('canvas'); tvScreenC.width = 256; tvScreenC.height = 144; const tvTex = new THREE.CanvasTexture(tvScreenC); tvTex.colorSpace = THREE.SRGBColorSpace;
const tvMat = new THREE.MeshBasicMaterial({ map: tvTex }); const tv = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.12), tvMat); tv.position.set(X(G.TV.x - 0.05), G.TV.y, G.TV.z); tv.rotation.y = Math.PI / 2; scene.add(tv);
const tvBezel = box(G.TV.x - 0.02, G.TV.x + 0.07, G.TV.y - 0.62, G.TV.y + 0.62, G.TV.z - 1.06, G.TV.z + 1.06, mStd({ color: '#0b0b0c', roughness: 0.12, metalness: 0.6 })); tvBezel.userData.env = 1.2;
box(G.TV.x - 0.025, G.TV.x - 0.015, G.TV.y - 0.625, G.TV.y + 0.625, G.TV.z - 1.065, G.TV.z + 1.065, mStd({ color: '#6d6f73', roughness: 0.3, metalness: 1 }), false);   // aluminium edge
const tvGlass = new THREE.Mesh(new THREE.PlaneGeometry(2, 1.12), new THREE.MeshPhysicalMaterial({ color: '#000', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 })); tvGlass.position.set(X(G.TV.x - 0.06), G.TV.y, G.TV.z); tvGlass.rotation.y = Math.PI / 2; tvGlass.userData.env = 1.5; scene.add(tvGlass);
const camRig = new THREE.Group(); camRig.position.set(X(G.CCTV.x + 0.15), G.CCTV.h, G.CCTV.z); scene.add(camRig);
const camBody = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.55), mStd({ color: '#d9dadb', roughness: 0.78, metalness: 0, envMapIntensity: 0.25 })); camBody.castShadow = true; camRig.add(camBody);   // matte plastic housing (owner 00:10: too reflective)
const camLed = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshBasicMaterial({ color: '#ff2020' })); camLed.position.set(0, 0.06, 0.3); camRig.add(camLed);
box(G.CCTV.x - 0.05, G.CCTV.x + 0.15, G.CCTV.h - 0.04, G.CCTV.h + 0.04, G.CCTV.z - 0.04, G.CCTV.z + 0.04, mStd({ color: '#555' }), false);
// lasers + emitters + the laser box
// lasers (owner 00:59): core + glow + haze per beam, emitter housings with lenses at both walls
const laserCore = new THREE.MeshBasicMaterial({ color: '#ffe6e6' });
const laserGlow = new THREE.MeshBasicMaterial({ color: '#ff1a2a', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
const laserHaze = new THREE.MeshBasicMaterial({ color: '#ff2030', transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false });
const lensOn = new THREE.MeshBasicMaterial({ color: '#ff3040' }), lensOff = new THREE.MeshBasicMaterial({ color: '#3a0a0e' });
const housingMat = mStd({ color: '#1d2024', metalness: 0.6, roughness: 0.45 });
const lasers = G.LASERS.map(L => { const grp = new THREE.Group(), beams = new THREE.Group(), lenses = [];
  for (const y of [0.35, 0.8, 1.25, 1.7]) {
    for (const [r, m] of [[0.006, laserCore], [0.016, laserGlow], [0.05, laserHaze]]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 3.9, 8, 1, true), m); c.rotation.z = Math.PI / 2; c.position.set(0, y, L.z); beams.add(c); }
    for (const x of [-1.96, 1.96]) { const lens = new THREE.Mesh(new THREE.CircleGeometry(0.03, 16), lensOn); lens.position.set(x * 0.995, y, L.z); lens.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; grp.add(lens); lenses.push(lens); }
  }
  for (const x of [-2, 2]) grp.add(box(x - 0.06, x + 0.06, 0.15, 1.9, L.z - 0.09, L.z + 0.09, housingMat));   // the emitter posts (kept with the group: the bake hides loose static boxes)
  grp.add(beams); scene.add(grp); grp.userData = { beams, lenses }; return grp; });
const laserBoxMat = new THREE.MeshStandardMaterial({ color: '#331', emissive: '#ff3030', emissiveIntensity: 1.2 }); box(G.LASERBOX.x - 0.05, G.LASERBOX.x + 0.05, G.LASERBOX.y - 0.2, G.LASERBOX.y + 0.2, G.LASERBOX.z - 0.2, G.LASERBOX.z + 0.2, laserBoxMat, false);

// ── light: a warm hall, a moving key light with shadows over the robber, ceiling pools, red in the corridor ──
scene.add(new THREE.HemisphereLight('#ffe8c8', '#4a3c30', 1.3));
const fill = new THREE.DirectionalLight('#ffe2c2', Q.has('fill') ? +Q.get('fill') : 4.3); scene.add(fill, fill.target);          // from the camera: the face we see is never black   // characters only (the bank is baked): lifts the jacket, the room stays as graded (owner 23:14)
const rim = new THREE.DirectionalLight('#9fc8ff', 1.6); scene.add(rim, rim.target);             // cool edge from the windows, like the plates
const key = new THREE.DirectionalLight('#ffe3b8', 1.6); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 0.5, far: 30 }); scene.add(key, key.target);
const ROOMLIGHTS = []; for (const z of [4, 12, 20, 27]) { const p = new THREE.PointLight('#ffcf8a', 14, 11, 2); p.position.set(0, 4.6, z); scene.add(p); ROOMLIGHTS.push(p); }
for (const z of [36, 44, 51]) { const p = new THREE.PointLight('#e4edff', 9, 8, 2); p.position.set(0, 3, z); scene.add(p); ROOMLIGHTS.push(p); }
const carry = new THREE.PointLight('#ffe6c4', 12, 10, 2); scene.add(carry);   // with the bake on, this one light follows the player (perf, owner 20:05)
if (!Q.has('nobake') && !Q.get('capture')) ROOMLIGHTS.forEach(p => { p.visible = false; }); else carry.visible = false;   // clean cool vault light (owner 18:58: silver / grey, not dirty red)
const vaultLight = new THREE.PointLight('#bfe0ff', 10, 12, 2); vaultLight.position.set(0, 4, 59); scene.add(vaultLight);

// ── sight cones on the floor ──
function rimMesh() { const N = 104, g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 2 * 3), 3)); const idx = []; for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: '#ff2a3a', transparent: true, opacity: 1, depthWrite: false, side: THREE.DoubleSide })); m.renderOrder = 3; scene.add(m); return m; }   // hard outline
function setRim(m, pts, y, width) {   // a strip of quads along the cone's outline (origin → arc → origin)
  const path = [pts[0], ...pts.slice(1), pts[0]].filter(p => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1])), a = m.geometry.attributes.position, n = a.count / 2;
  if (path.length < 2) { m.visible = false; if (!window.__rimWarn) { window.__rimWarn = 1; console.warn("rim: bad points", JSON.stringify(pts).slice(0, 200)); } return; }
  for (let i = 0; i < n; i++) { const p = path[Math.min(i, path.length - 1)], q = path[Math.min(i + 1, path.length - 1)], r = path[Math.min(Math.max(0, i - 1), path.length - 1)];
    let dx = q[0] - r[0], dz = q[1] - r[1]; const L = Math.hypot(dx, dz) || 1; dx /= L; dz /= L; const nx = -dz * width, nz = dx * width;
    a.setXYZ(i * 2, X(p[0] + nx), y, p[1] + nz); a.setXYZ(i * 2 + 1, X(p[0] - nx), y, p[1] - nz); }
  a.needsUpdate = true; m.geometry.computeBoundingSphere(); m.visible = true; }
function coneMesh(color) { const N = 100, pos = new Float32Array(N * 3), idx = []; for (let i = 1; i < N - 1; i++) idx.push(0, i, i + 1); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide })); m.renderOrder = 2; scene.add(m); return m; }
const coneCam = coneMesh('#b3081a'), coneGuard = coneMesh('#b80d14'), rimCam = rimMesh(), rimGuard = rimMesh();
function edgeDist(px, pz, pts) { let d = Infinity; for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], ex = b[0] - a[0], ez = b[1] - a[1], L2 = ex * ex + ez * ez || 1, u = Math.max(0, Math.min(1, ((px - a[0]) * ex + (pz - a[1]) * ez) / L2)); d = Math.min(d, Math.hypot(px - a[0] - u * ex, pz - a[1] - u * ez)); } return d; }
function setCone(m, pts, y, hot, rim, t, warn) { const a = m.geometry.attributes.position; for (let i = 0; i < a.count; i++) { const p = pts[Math.min(i, pts.length - 1)]; a.setXYZ(i, X(p[0]), y, p[1]); } a.needsUpdate = true; m.geometry.computeBoundingSphere();
  const pulse = 0.5 + 0.5 * Math.sin(t * (hot ? 18 : warn ? 11 : 5)); m.material.opacity = hot ? 0.7 + 0.15 * pulse : warn ? 0.55 + 0.15 * pulse : 0.5 + 0.04 * pulse; m.visible = true; if (rim) { setRim(rim, pts, y + 0.005, hot ? 0.075 : warn ? 0.07 : 0.05); rim.material.opacity = hot || warn ? 0.8 + 0.2 * pulse : 0.95; } }

// ── characters: Tripo rig + Mixamo clips (retargeted by rest, as in the bespoke kit) ──
function retargetByRest(skinned, srcRoot, srcBones, clip, fps = 30) {
  const tgt = skinned.skeleton.bones, inv = q => q.clone().invert();
  const tgtBind = tgt.map((b, i) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().copy(skinned.skeleton.boneInverses[i]).invert()));
  srcRoot.updateMatrixWorld(true);
  const srcByName = new Map(srcBones.map(b => [b.name, b]));
  const GY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (Q.has('gy') ? +Q.get('gy') : -90) * D2R);
  const order = tgt.map((b, i) => ({ b, i, depth: (() => { let d = 0, p = b.parent; while (p && p.isBone) { d++; p = p.parent; } return d; })() })).sort((a, c) => a.depth - c.depth);
  const mixer = new THREE.AnimationMixer(srcRoot); mixer.clipAction(clip).play(); mixer.update(0);
  const frames = Math.max(2, Math.round(clip.duration * fps)), dt = 1 / fps, times = new Float32Array(frames), vals = tgt.map(() => new Float32Array(frames * 4));
  for (let f = 0; f < frames; f++) {
    times[f] = f * dt; srcRoot.updateMatrixWorld(true); const world = new Map();
    const RT = Q.get('rt') || 'world';
    for (const { b, i } of order) {
      const sb = srcByName.get(b.name);
      if (RT === 'local') { (sb ? sb.quaternion.clone() : b.quaternion.clone()).toArray(vals[i], f * 4); continue; }   // same Mixamo layout: copy local rotations as they are
      const w = sb ? GY.clone().multiply(sb.getWorldQuaternion(new THREE.Quaternion())) : tgtBind[i].clone(); world.set(b, w); const pw = b.parent && b.parent.isBone ? world.get(b.parent) : null; (pw ? inv(pw).multiply(w) : w).toArray(vals[i], f * 4); }
    mixer.update(dt);
  }
  return new THREE.AnimationClip(clip.name, -1, tgt.map((b, i) => new THREE.QuaternionKeyframeTrack(`.bones[${b.name}].quaternion`, times, vals[i])));
}
const loader = new GLTFLoader(), libCache = {};
const loadLib = (name) => libCache[name] || (libCache[name] = new Promise((res, rej) => loader.load(`assets/motion/${name}.glb`, res, undefined, rej)));
async function makeActor(file, height, clips) {
  const gltf = await new Promise((res, rej) => loader.load(file, res, undefined, rej));
  const root = gltf.scene; root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; if (o.material) { o.material.metalness = 0; o.material.roughness = 0.85; } } });
  root.updateMatrixWorld(true); const bones = {}; root.traverse(o => { if (o.isBone) bones[o.name.replace(/^mixamorig:?/, '')] = o; });
  const wp = b => b.getWorldPosition(new THREE.Vector3()), top = bones.HeadTop_End && wp(bones.HeadTop_End), toe = bones.LeftToe_End && wp(bones.LeftToe_End);
  const box3 = new THREE.Box3().setFromObject(root, true), posedH = top && toe ? top.y - toe.y : box3.getSize(new THREE.Vector3()).y, footY = toe ? toe.y : box3.min.y, s = height / posedH;
  const wrap = new THREE.Group(); root.scale.setScalar(s); root.position.set(0, -footY * s, 0); wrap.add(root); scene.add(wrap);
  let skinned = null; root.traverse(o => { if (o.isSkinnedMesh && !skinned) skinned = o; });
  // the head lock: vertices above the neck ride the Head bone alone (bind pose: the mesh is undeformed at load)
  if (skinned && !Q.has('nohead') && !/robber_v2/.test(file)) {
    const bonesArr = skinned.skeleton.bones, hi = bonesArr.findIndex(b => /Head$/.test(b.name)), neck = bonesArr.find(b => /Neck$/.test(b.name)), head = bonesArr[hi];
    if (hi >= 0 && neck && head) { wrap.updateMatrixWorld(true);
      const ny = neck.getWorldPosition(new THREE.Vector3()).y, hy = head.getWorldPosition(new THREE.Vector3()).y, cut = ny + (hy - ny) * 0.55;
      const pos = skinned.geometry.attributes.position, si = skinned.geometry.attributes.skinIndex, sw = skinned.geometry.attributes.skinWeight, v = new THREE.Vector3(); let n = 0;
      for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(skinned.matrixWorld); if (v.y > cut) { si.setXYZW(i, hi, 0, 0, 0); sw.setXYZW(i, 1, 0, 0, 0); n++; } }
      si.needsUpdate = sw.needsUpdate = true; console.log('head lock', file, n, 'vertices');
    }
  }
  const handRest = []; root.traverse(o => { if (o.isBone && /(Left|Right)Hand(Index[123])?$/.test(o.name)) handRest.push([o, o.quaternion.clone()]); });   // hand + the index-finger chain Mixamo gave this rig: their curl folded the palm (owner 23:33)
  const mixer = new THREE.AnimationMixer(root), actions = {};
  const own = (gltf.animations || []); const findOwn = (name) => own.find(c => c.name.toLowerCase().includes(name));
  for (const [key, name] of Object.entries(clips)) {
    const oc = findOwn(name); if (oc) { const c = oc.clone(); if (!/robber_v2/.test(file)) c.tracks = c.tracks.filter(t => !/\.position$/.test(t.name) || /Hips/.test(t.name) === false); actions[key] = mixer.clipAction(c); continue; }   // Mixamo In Place clips keep the hips' motion: the idle sway shifts the hips over planted feet (owner 22:02: feet slid)
    try { const lib = await loadLib(name); const src = []; lib.scene.traverse(o => { if (/^mixamorig/.test(o.name)) { o.isBone = true; o.type = 'Bone'; src.push(o); } });
      const c = retargetByRest(skinned, lib.scene, src, lib.animations[0], 30); actions[key] = mixer.clipAction(c); } catch (e) { console.warn('clip failed', name, e); }
  }
  const limb = n => { let f = null; root.traverse(o => { if (o.isBone && new RegExp(n + '$').test(o.name)) f = o; }); return f; };
  const actor = { wrap, mixer, actions, cur: null, handRest, arms: [limb('LeftArm'), limb('RightArm')], legs: [limb('LeftUpLeg'), limb('RightUpLeg')], chest: limb('Spine2') || limb('Spine1'), neck: limb('Neck'), toes: [bones.LeftToe_End, bones.RightToe_End, bones.LeftToeBase, bones.RightToeBase, bones.LeftFoot, bones.RightFoot].filter(Boolean), sole: null };
  actor.play = (k, fade = 0.2, once = false) => { const a = actions[k]; if (!a || actor.cur === k) return; a.reset(); a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat); a.clampWhenFinished = once; a.fadeIn(fade).play(); if (actor.cur && actions[actor.cur]) actions[actor.cur].fadeOut(fade); actor.cur = k; };
  return actor;
}
// stand-ins until the models load (and if one fails)
const standIn = (c) => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.1, 6, 12), mStd({ color: c, roughness: 0.7 })); m.position.y = 0.85; m.castShadow = true; g.add(m); scene.add(g); return g; };
let robber = null, guardA = null; const robberStand = standIn('#2a2c30'), guardStand = standIn('#33476e');
const RV2 = !Q.has('oldrobber');   // robber v2: Mixamo rig + mocap (owner 21:33-21:50)
makeActor(RV2 ? 'assets/3d/robber_v2.glb' : 'assets/3d/robber.glb', 1.78, RV2 ? { idle: 'idle', walk: 'walk', jog: 'jog', run: 'run', win: 'win', lose: 'lose' } : { idle: 'idle', walk: 'walk', run: 'run', win: 'cheer', lose: 'defeat' })
  .then(a => { robber = a; window.__actor = a; a.wrap.traverse(o => { if (o.isMesh) { o.material.transparent = true; o.material.opacity = 1; o.renderOrder = 14; } });   /* drawn after the guard X-ray: only scenery reveals him (owner 00:26) */ if (!RV2) standFromRest(a); if (Q.get('pose')) { a.play(Q.get('pose'), 0); a.lockPose = true; } window.__THREE = THREE; robberStand.visible = false; a.play('idle', 0); window.__robber = { ok: true, clips: Object.keys(a.actions) }; }).catch(e => { console.error('robber failed', e); window.__robber = { ok: false }; });
const GUARD_FILE = 'assets/3d/guard.glb';
fetch(GUARD_FILE, { method: 'HEAD' }).then(r => r.ok ? makeActor(GUARD_FILE, 1.8, { idle: 'idle', walk: 'walk', look: 'look_around' }) : Promise.reject('no guard model yet'))
  .then(a => { guardA = a; guardStand.visible = false; if (!Q.has('noxray')) { const xm = new THREE.MeshBasicMaterial({ color: '#ff8a3d', transparent: true, opacity: 0.42, depthFunc: THREE.GreaterDepth, depthWrite: false }); const list = []; a.wrap.traverse(o => { if (o.isSkinnedMesh) list.push(o); });
    for (const o of list) { o.material.transparent = true; o.material.opacity = 1; o.renderOrder = 13; const x = new THREE.SkinnedMesh(o.geometry, xm);   // the guard draws after the X-ray: it only shows where a pillar hides him
      x.bind(o.skeleton, o.bindMatrix); x.position.copy(o.position); x.quaternion.copy(o.quaternion); x.scale.copy(o.scale); x.renderOrder = 12; x.frustumCulled = false; o.parent.add(x); } window.__xray = list.length; }   // seen through pillars (owner 00:18)
    a.play('walk', 0); window.__guard = { ok: true, clips: Object.keys(a.actions) }; window.__gActor = a; }).catch(e => console.warn('guard stand-in:', e));

// ── matte-painting plates: one game-camera pose per stretch of the route (x, z of the camera; yaw 0, the game's height and pitch) ──
const CAP = { h: G.CONFIG.capH || 2.2, pitch: G.CONFIG.capPitch || 9, fov: 72, aspect: 1.5, w: 1200, hgt: 800 };   // wide: 72 deg tall x ~95 deg across (3:2)   // the pose the plates were captured from (fixed, whatever the game camera does)
export const PLATES = [
  { id: 'P1_lobby_a', x: 0.55, z: -2.0, room: 'lobby', door: 'closed' },
  { id: 'P2_lobby_b', x: 0.55, z: 7.0, room: 'lobby', door: 'closed' },
  { id: 'P3_lobby_c', x: 0.0, z: 14.5, room: 'lobby', door: 'closed' },
  { id: 'P4_door', x: 0.0, z: 24.5, room: 'lobby', door: 'open' },
  { id: 'P5_corridor_a', x: 0.3, z: 32.0, room: 'corr', door: 'open' },
  { id: 'P6_corridor_b', x: 0.3, z: 42.0, room: 'corr', door: 'open' },
  { id: 'P7_vault', x: 0.3, z: 52.4, room: 'vault', door: 'open' },
];
window.PLATES = PLATES;
const CAPTURE = Q.get('capture');
if (CAPTURE) {
  const pose = PLATES.find(p => p.id === CAPTURE) || PLATES[0];
  document.getElementById('cv').style.display = 'none'; document.querySelectorAll('.card').forEach(c => c.style.display = 'none');
  // clay: every static surface one soft grey, lit from the ceiling, so Gemini reads the geometry and repaints it
  const clay = new THREE.MeshStandardMaterial({ color: '#b9b6b0', roughness: 0.95 }), clayDark = new THREE.MeshStandardMaterial({ color: '#8f8b85', roughness: 0.95 });
  scene.traverse(o => { if (o.isMesh) { const w = o.geometry.parameters && o.geometry.parameters.width; o.material = (o.position.y < 0.01 || (o.rotation.x !== 0 && Math.abs(o.rotation.x) > 1)) ? clayDark : clay; } });
  for (const o of [tv, tvBezel, tvGlass, camRig, keypad, vaultHinge, gold, coneCam, coneGuard, rimCam, rimGuard, robberStand, guardStand, ...lasers]) o.visible = false;
  const lineMat = new THREE.LineBasicMaterial({ color: '#1a1a1a' }); const meshes = []; scene.traverse(o => { if (o.isMesh && o.visible && o.geometry && !(o.geometry.type === 'PlaneGeometry' && o.position.y < 0.01)) meshes.push(o); });
  for (const o of meshes) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 20), lineMat); o.add(e); }
  doorPanel.visible = pose.door === 'closed'; sign.visible = true;
  scene.fog = null; scene.background = new THREE.Color('#111');
  scene.traverse(o => { if (o.isLight && !o.isHemisphereLight) o.visible = false; }); scene.add(new THREE.AmbientLight('#ffffff', 0.55)); const top = new THREE.DirectionalLight('#ffffff', 1.2); top.position.set(2, 10, 6); scene.add(top);   // neutral clay light
  window.CAPTURE_POSE = pose;
}

// ── the matte painting ──
const BAKE = !Q.has('nobake') && !CAPTURE;   // the Blender-baked bank (assets/3d/bank.glb) replaces the room boxes and the paintings
const MATTE = Q.has('matte') && !CAPTURE && !BAKE;
// the vault doorway: frame plate with a round hole + a thick ring, and the gold room behind (owner 01:07)
const vaultRoom = new THREE.Group(); scene.add(vaultRoom);
{ const VZ = G.VAULT.z, steel = mStd({ color: '#7d8287', metalness: 0.75, roughness: 0.38 }), dark = mStd({ color: '#2a2d31', metalness: 0.6, roughness: 0.5 });
  const sh = new THREE.Shape(); sh.moveTo(-2.32, 0); sh.lineTo(2.32, 0); sh.lineTo(2.32, 4.5); sh.lineTo(-2.32, 4.5); sh.lineTo(-2.32, 0); const hole = new THREE.Path(); hole.absarc(0, 2.3, 2.12, 0, Math.PI * 2, true); sh.holes.push(hole);
  const plate = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.2, bevelEnabled: false, curveSegments: 48 }), steel); plate.position.set(0, 0, VZ - 0.02); vaultRoom.add(plate);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.12, 16, 64), mStd({ color: '#a9aeb3', metalness: 0.9, roughness: 0.3 })); ring.position.set(0, 2.3, VZ - 0.04); vaultRoom.add(ring);
  const tun = new THREE.Mesh(new THREE.CylinderGeometry(2.12, 2.12, 0.6, 48, 1, true), dark); tun.rotation.x = Math.PI / 2; tun.position.set(0, 2.3, VZ + 0.4); tun.material.side = THREE.BackSide; vaultRoom.add(tun);
  const RZ0 = VZ + 0.7, RZ1 = VZ + 3.2, gw = 2.4, gh = 3.4, tex = (n, rx, ry) => { const t = new THREE.TextureLoader().load('assets/tex/' + n + '.webp'); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 8; return t; };   // photoreal like the vault (owner 01:13)
  const roomM = mStd({ map: tex('steel_panel', 1.2, 0.8), color: '#c9ccd0', metalness: 0.35, roughness: 0.5 }), floorM = mStd({ map: tex('vault_floor', 1.2, 1), color: '#d0d3d6', metalness: 0.1, roughness: 0.32 });
  const room = (x0, x1, y0, y1, z0, z1, m) => { const b = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), m); b.position.set(X((x0 + x1) / 2), (y0 + y1) / 2, (z0 + z1) / 2); vaultRoom.add(b); return b; };
  room(-gw, gw, -0.1, 0, RZ0, RZ1, floorM); room(-gw, gw, gh, gh + 0.1, RZ0, RZ1, roomM); room(-gw - 0.1, -gw, 0, gh, RZ0, RZ1, roomM); room(gw, gw + 0.1, 0, gh, RZ0, RZ1, roomM); room(-gw, gw, 0, gh, RZ1, RZ1 + 0.1, roomM);
  { const pt = tex('vault_treasure', 1, 1); pt.wrapS = pt.wrapT = THREE.ClampToEdgeWrapping; const plate = new THREE.Mesh(new THREE.PlaneGeometry(gw * 2, gh), new THREE.MeshBasicMaterial({ map: pt })); plate.rotation.y = Math.PI; plate.position.set(0, gh / 2, RZ1 - 0.02); vaultRoom.add(plate); }   // the photoreal treasure wall
  const warm = new THREE.PointLight('#ffcf7a', 9, 7, 2); warm.position.set(0, 2.8, RZ0 + 2); vaultRoom.add(warm); window.__vaultLight = warm; }
const DYNAMIC = new Set([tvBezel, tvGlass, doorPanel, keypad, tv, coneCam, coneGuard, rimCam, rimGuard, robberStand, guardStand]);
[camRig, vaultHinge, gold, vaultRoom, ...lasers].forEach(g => g.traverse(o => DYNAMIC.add(o)));
const projectors = [];
function makeProjector(plate) {
  const cam = new THREE.PerspectiveCamera(CAP.fov, CAP.aspect, 0.1, 120); cam.rotation.order = 'YXZ';
  cam.position.set(X(plate.x), CAP.h, plate.z); cam.rotation.set(-CAP.pitch * D2R, Math.PI, 0); cam.updateMatrixWorld(); cam.updateProjectionMatrix(); cam.layers.set(1);
  const rt = new THREE.WebGLRenderTarget(CAP.w, CAP.hgt); rt.depthTexture = new THREE.DepthTexture(CAP.w, CAP.hgt); rt.depthTexture.type = THREE.UnsignedIntType;
  const tex = TL.load(`assets/plates/${plate.id}.webp`); tex.colorSpace = THREE.NoColorSpace; tex.anisotropy = R.capabilities.getMaxAnisotropy();
  const vp = new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
  return { plate, cam, rt, tex, vp, baked: false };
}
const MATTE_VS = `varying vec4 vW; varying vec3 vN; varying vec2 vUv; void main() { vW = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vUv = uv; gl_Position = projectionMatrix * viewMatrix * vW; }`;
const MATTE_FS = `
uniform sampler2D plateA; uniform sampler2D depthA; uniform mat4 vpA; uniform vec3 posA;
uniform sampler2D plateB; uniform sampler2D depthB; uniform mat4 vpB; uniform vec3 posB;
uniform float wB; uniform float near; uniform float far;
uniform sampler2D fbMap; uniform vec2 fbRepeat; uniform vec3 fbTint; uniform float fbOn;
varying vec4 vW; varying vec3 vN; varying vec2 vUv;
float lin(float z) { return (2.0 * near * far) / (far + near - z * (far - near)); }
vec4 look(sampler2D plate, sampler2D dep, mat4 vp, vec3 pos) {
  vec4 pc = vp * vW; vec3 n = pc.xyz / pc.w; vec2 uv = n.xy * 0.5 + 0.5;
  if (pc.w <= 0.0 || uv.x < 0.001 || uv.x > 0.999 || uv.y < 0.001 || uv.y > 0.999) return vec4(0.0);
  float seen = lin(texture2D(dep, uv).r * 2.0 - 1.0), here = lin(n.z);
  if (here > seen + 0.06 + 0.01 * here) return vec4(0.0);
  float facing = abs(dot(normalize(vN), normalize(pos - vW.xyz)));            // 1 = seen straight on, 0 = edge-on
  float w = smoothstep(0.12, 0.42, facing) * smoothstep(0.0, 0.04, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
  return vec4(texture2D(plate, uv).rgb, w);
}
void main() {
  vec4 A = look(plateA, depthA, vpA, posA), B = look(plateB, depthB, vpB, posB);
  float a = A.a * (1.0 - wB), b = B.a * wB, t = a + b;
  vec3 plateC = t > 0.001 ? (A.rgb * a + B.rgb * b) / t : (A.a > B.a ? A.rgb : B.rgb);
  float cover = clamp(max(t, max(A.a, B.a) * 0.85), 0.0, 1.0);
  vec3 fb = fbOn > 0.5 ? pow(texture2D(fbMap, vUv * fbRepeat).rgb, vec3(1.0 / 2.2)) * fbTint : fbTint;   // the surface's own material, toned to the plates
  gl_FragColor = vec4(mix(fb, plateC, cover), 1.0);
}`;
const GROUPS = { lobby: ['P1_lobby_a', 'P2_lobby_b', 'P3_lobby_c', 'P4_door'], corr: ['P4_door', 'P5_corridor_a', 'P6_corridor_b'], vault: ['P6_corridor_b', 'P7_vault'] };
const groupMats = {};
async function exists(url) { try { const r = await fetch(url, { method: 'HEAD' }); return r.ok; } catch (e) { return false; } }
if (MATTE) {
  const have = new Set(); for (const pl of PLATES) if (await exists(`assets/plates/${pl.id}.webp`)) have.add(pl.id);
  const byId = {}; for (const pl of PLATES) if (have.has(pl.id)) { const pj = makeProjector(pl); projectors.push(pj); byId[pl.id] = pj; }
  for (const [g, ids] of Object.entries(GROUPS)) {
    const list = ids.filter(id => byId[id]).map(id => byId[id]); if (!list.length) continue;
    const u = { plateA: { value: list[0].tex }, depthA: { value: list[0].rt.depthTexture }, vpA: { value: list[0].vp }, posA: { value: list[0].cam.position }, plateB: { value: list[0].tex }, depthB: { value: list[0].rt.depthTexture }, vpB: { value: list[0].vp }, posB: { value: list[0].cam.position }, wB: { value: 0 }, near: { value: 0.1 }, far: { value: 120 } };
    groupMats[g] = { list, mat: new THREE.ShaderMaterial({ vertexShader: MATTE_VS, fragmentShader: MATTE_FS, uniforms: u }) };
  }
  scene.traverse(o => { if (!o.isMesh || DYNAMIC.has(o) || (o.material.transparent && !pillarMats.find(pm => pm.m === o.material))) return;
    const bb = new THREE.Box3().setFromObject(o), cz = (bb.min.z + bb.max.z) / 2, g = cz <= ROOM.lobby.z1 + 0.2 ? 'lobby' : cz <= ROOM.corr.z1 + 0.2 ? 'corr' : 'vault';
    if (!groupMats[g]) return; o.layers.enable(1);
    const src = o.material, map = src.map || null, u = Object.assign({}, groupMats[g].mat.uniforms, { fbMap: { value: map }, fbRepeat: { value: map ? map.repeat.clone() : new THREE.Vector2(1, 1) }, fbTint: { value: new THREE.Color(map ? '#6a5a4a' : '#2a221b') }, fbOn: { value: map ? 1 : 0 } });
    o.material = new THREE.ShaderMaterial({ vertexShader: MATTE_VS, fragmentShader: MATTE_FS, uniforms: u }); o.userData.matte = g; });
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(12, 70), new THREE.ShadowMaterial({ opacity: 0.45, depthWrite: false })); catcher.rotation.x = -Math.PI / 2; catcher.position.set(0, 0.004, 30); catcher.receiveShadow = true; scene.add(catcher);
  scene.traverse(o => { if (o.isMesh && (o.material === brass || o.material === ropeMat || o === clock || o === clockRim)) o.visible = false; }); doorPanel.visible = false;   // no doubles over the painting
  window.__matte = { plates: projectors.map(p => p.plate.id) };
}
// per frame: the two plates of each group nearest the game camera
function pickPlates(camZ, camX) {   // the two plates nearest the camera (z counts double: the route runs along z); weight by distance
  for (const { list, mat } of Object.values(groupMats)) {
    const d = list.map(pj => ({ pj, d: Math.hypot((pj.plate.z - camZ) * 1.0, (pj.plate.x - camX) * 0.8) + (pj.plate.z > camZ + 1 ? 6 : 0) })).sort((a, b) => a.d - b.d);
    const A = d[0].pj, B = (d[1] || d[0]).pj, w = d[1] ? d[0].d / Math.max(1e-3, d[0].d + d[1].d) : 0;
    const u = mat.uniforms; u.plateA.value = A.tex; u.depthA.value = A.rt.depthTexture; u.vpA.value = A.vp; u.posA.value = A.cam.position; u.posB.value = B.cam.position; u.plateB.value = B.tex; u.depthB.value = B.rt.depthTexture; u.vpB.value = B.vp; u.wB.value = w;
  }
}
if (BAKE) {
  // hide every static room mesh (the game core still collides with the same layout); keep the live props
  scene.traverse(o => { if (o.isMesh && !DYNAMIC.has(o) && o !== tvBezel && o !== tvGlass) o.visible = false; });
  const TEXN = { floor: 'floor_checker', marble: 'marble_01_white', plaster: 'plaster_white', ceiling: 'ceiling_white', wood: 'dark_paneled_wood_diff', steel_floor: 'steel_floor', deposit_boxes: 'deposit_boxes', steel_panel: 'steel_panel', vault_floor: 'vault_floor', vault_steel: 'steel_panel' };   // + the vault and corridor (Gemini, 00:40)
  const EMIT = { skylight: '#eef5ff', lightstrip: '#f4f8ff', glassdoor: '#dcecff', lampglow: '#ffd79a' };
  const texCache = {}; const tileTex = (n) => texCache[n] || (texCache[n] = (() => { const t = TL.load(`assets/tex/${n}.webp`); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = R.capabilities.getMaxAnisotropy(); t.channel = 0; window.__texCache['tex_' + n] = t; return t; })());
  window.__texCache = {}; const lmCache = {}; const lightTex = (part) => lmCache[part] || (lmCache[part] = (() => { const t = TL.load(`assets/3d/${part}_light.webp`); t.colorSpace = THREE.SRGBColorSpace; t.channel = 1; t.flipY = false; window.__texCache['lm_' + part] = t; return t; })());
  const LM_GAIN = Q.has('lm') ? +Q.get('lm') : 4.85;   // bake stores irradiance / 4
  const FLOORS = [], METAL = []; window.__FLOORS = FLOORS; window.__METAL = METAL;
  new GLTFLoader().load('assets/3d/bank.glb', (g) => {
    g.scene.traverse(o => { if (!o.isMesh) return;
      let p = o, part = null; while (p) { const m = /^(bank_lobby|bank_corridor|bank_vault)/.exec(p.name || ''); if (m) { part = m[1]; break; } p = p.parent; }
      const name = (o.material.name || '').replace(/\.\d+$/, '');
      if (part) {
        if (EMIT[name]) { o.material = new THREE.MeshBasicMaterial({ color: EMIT[name] }); o.layers.enable(1); }
        else { const smooth = name === 'ceiling' && part !== 'bank_lobby';   /* corridor + vault: smooth white panels, not the speckled tile (look pass 20:31) */ const map = !smooth && TEXN[name] ? tileTex(TEXN[name]) : null; o.layers.enable(1); o.material = new THREE.MeshBasicMaterial({ map, color: map ? '#ffffff' : smooth ? '#eceef1' : (name === 'dark_steel' ? '#17191c' : '#cfcfcf'), lightMap: o.geometry.attributes.uv1 ? lightTex(part) : null, lightMapIntensity: LM_GAIN }); if (name === 'floor' || name === 'steel_floor' || name === 'vault_floor') FLOORS.push({ mat: o.material, part }); }
      } else { o.material.envMapIntensity = 1.0; o.castShadow = false; if (/clockface/.test(o.material.name || '')) o.visible = false; }   // brass, rope, clock, steel panels: live PBR with reflections
      o.receiveShadow = false; });
    { const groups = {}; g.scene.updateMatrixWorld(true);
      g.scene.traverse(o => { if (o.isMesh && /^c_(rim|face)/.test(o.name || '')) { o.visible = false; return; }   // the old clock: the Gemini face carries its own rim
        if (!o.isMesh || o.material.isMeshBasicMaterial) return; (groups[o.material.name] = groups[o.material.name] || []).push(o); });
      for (const [name, list] of Object.entries(groups)) { if (list.length < 2) { list.forEach(o => { o.castShadow = false; }); continue; }
        const geos = list.map(o => { let q = o.geometry.clone(); q.applyMatrix4(o.matrixWorld); if (q.index) q = q.toNonIndexed(); for (const k of Object.keys(q.attributes)) if (!['position', 'normal', 'uv'].includes(k)) q.deleteAttribute(k); return q; });
        const merged = mergeGeometries(geos, false); if (!merged) { console.warn('merge failed', name); continue; }
        const m = new THREE.Mesh(merged, list[0].material); m.name = 'live_' + name; list.forEach(o => o.parent.remove(o)); g.scene.add(m); }
    }
    g.scene.traverse(o => { if (!o.isMesh) return; const n = (o.material.name || '').replace(/\.\d+$/, ''); let p = o, part = null; while (p) { const m = /^(bank_lobby|bank_corridor|bank_vault)/.exec(p.name || ''); if (m) { part = m[1]; break; } p = p.parent; }
      if (!o.material.isMeshBasicMaterial) { o.layers.enable(1); METAL.push(o); } });
    scene.add(g.scene); window.__bank = { meshes: g.scene.children.length, lightmapped: true };
    { const t = TL.load('assets/tex/clock_face.webp'); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = R.capabilities.getMaxAnisotropy();   // the Gemini clock face (owner 22:12)
      const clock = new THREE.Mesh(new THREE.CircleGeometry(0.7, 64), new THREE.MeshBasicMaterial({ map: t, transparent: true, color: '#e9e4da', polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 })); clock.position.set(X(0), 4.27, 29.82);
      { const sc = document.createElement('canvas'); sc.width = sc.height = 128; const c2 = sc.getContext('2d'), gr = c2.createRadialGradient(64, 64, 30, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c2.fillStyle = gr; c2.fillRect(0, 0, 128, 128);
        const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); sh.position.set(X(0.02), 4.2, 29.86); sh.rotation.y = Math.PI; scene.add(sh); } clock.rotation.y = Math.PI; clock.layers.enable(1); scene.add(clock); window.__texCache.tex_clock = t; }   // a soft contact shadow on the wall (owner 00:19: the hard one was the old baked ring)
  }, undefined, e => console.error('bank failed', e));
  // a shadow catcher so the characters still cast onto the baked floor
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(12, 70), new THREE.ShadowMaterial({ opacity: 0.4, depthWrite: false })); catcher.rotation.x = -Math.PI / 2; catcher.position.set(0, 0.004, 30); catcher.receiveShadow = true; scene.add(catcher);
}
function bakeProjectors() { for (const pj of projectors) if (!pj.baked) { R.setRenderTarget(pj.rt); R.render(scene, pj.cam); R.setRenderTarget(null); pj.baked = true; } }

// ── per frame ──
const ARM_SPACE = (Q.has('arms') ? +Q.get('arms') : 6) * D2R, LEG_SPACE = (Q.has('legs') ? +Q.get('legs') : 2) * D2R;   // owner 19:13: a bit too much   // like Mixamo's arm-space
const _q = new THREE.Quaternion(), _ax = new THREE.Vector3();
const _gv = new THREE.Vector3();
function standFromRest(a) {   // the robber's stand pose: the rig's rest pose, arms lowered to the sides (owner 21:18: no idle motion)
  let sk = null; a.wrap.traverse(o => { if (o.isSkinnedMesh && !sk) sk = o.skeleton; }); if (!sk) return;
  for (const x of Object.values(a.actions)) x.stop(); sk.pose(); a.wrap.updateMatrixWorld(true); openStance(a, -72 * D2R, 0); for (const b of [...a.arms, ...a.legs]) if (b) b.userData.q0 = null;
  const tracks = sk.bones.map(b => new THREE.QuaternionKeyframeTrack(b.uuid + '.quaternion', [0], b.quaternion.toArray())); tracks.push(new THREE.VectorKeyframeTrack(sk.bones[0].uuid + '.position', [0], sk.bones[0].position.toArray()));
  if (a.actions.idle) a.actions.idle.stop(); a.actions.idle = a.mixer.clipAction(new THREE.AnimationClip('stand', 1, tracks)); window.__stand = { bones: sk.bones.length }; }
function standFromWalk(a) {   // the robber's stand pose: one frame of its own walk (feet closest together, both flat)
  const walk = a.actions.walk; if (!walk) return; const clip = walk.getClip(), fps = 30, n = Math.max(2, Math.floor(clip.duration * fps)); const feet = ['LeftFoot', 'RightFoot'].map(k => { let f = null; a.wrap.traverse(o => { if (o.isBone && o.name.endsWith(k)) f = o; }); return f; });
  if (!feet[0] || !feet[1]) return; const p = new THREE.Vector3(), q = new THREE.Vector3(); let best = 0, low = Infinity; for (const x of Object.values(a.actions)) x.setEffectiveWeight(0); walk.play(); walk.setEffectiveWeight(1);
  for (let f = 0; f < n; f++) { walk.time = f / fps; a.mixer.update(0); a.wrap.updateMatrixWorld(true); feet[0].getWorldPosition(p); feet[1].getWorldPosition(q); const score = Math.hypot(p.x - q.x, p.z - q.z) + 3 * Math.abs(p.y - q.y); if (score < low) { low = score; best = f; } }
  walk.setEffectiveWeight(0); const stand = a.mixer.clipAction(THREE.AnimationUtils.subclip(clip, 'stand', best, best + 1, fps)); if (a.actions.idle) a.actions.idle.stop(); a.actions.idle = stand; window.__stand = { frame: best, score: +low.toFixed(3) }; }
function idleHoldTime(a) {   // the idle frame with both hands lowest (Tripo clips open blending out of the T-pose: frame 0 has the arms out)
  const act = a.actions.idle; if (!act) return 0; const hands = ['LeftHand', 'RightHand'].map(n => { let f = null; a.wrap.traverse(o => { if (o.isBone && o.name.endsWith(n)) f = o; }); return f; }).filter(Boolean); if (!hands.length) return act.getClip().duration * 0.5;
  const dur = act.getClip().duration, w0 = act.getEffectiveWeight(), ts = act.timeScale; let best = dur * 0.5, low = Infinity; act.setEffectiveWeight(1);
  for (let i = 2; i <= 38; i++) { act.time = dur * i / 40; a.mixer.update(0); a.wrap.updateMatrixWorld(true); let y = 0; for (const h of hands) { h.getWorldPosition(_gv); y += _gv.y; } if (y < low) { low = y; best = act.time; } }
  act.setEffectiveWeight(w0); act.timeScale = ts; window.__holdT = +best.toFixed(2); return best; }
function groundLock(a, obj) {   // feet ON the floor: the lowest foot bone held at the measured sole offset (owner 20:42)
  obj.updateMatrixWorld(true); let low = Infinity; for (const b of a.toes) { b.getWorldPosition(_gv); low = Math.min(low, _gv.y); } if (!isFinite(low)) return;
  if (a.sole == null) { let m = null; a.wrap.traverse(o => { if (o.isSkinnedMesh && !m) m = o; }); if (!m) { a.sole = 0.03; } else { m.computeBoundingBox(); const bb = m.boundingBox.clone().applyMatrix4(m.matrixWorld); a.sole = Math.max(0, low - bb.min.y); } window.__sole = window.__sole || {}; window.__sole[a === robber ? 'robber' : 'guard'] = +a.sole.toFixed(3); }
  const d = a.sole + 0.005 - low; obj.position.y += d > 0 ? d : Math.max(d, -0.03); }   // lift fully; settle at most 3 cm (a cheer jump stays a jump)
function unStance(a) { for (const b of [...a.arms, ...a.legs]) if (b && b.userData.q0) b.quaternion.copy(b.userData.q0); }   // back to the mixer's pose (no stacking: the bust windmill, owner 20:41)
function openStance(a, arm, leg) {   // rotate each upper arm / thigh outward about the body's forward axis, in the parent's frame
  for (const b of [...a.arms, ...a.legs]) if (b) (b.userData.q0 = b.userData.q0 || new THREE.Quaternion()).copy(b.quaternion);
  const fwd = new THREE.Vector3(0, 0, 1);
  a.arms.forEach((b, i) => { if (!b) return; const side = i === 0 ? 1 : -1; _ax.copy(fwd); b.parent.updateMatrixWorld(); const pq = b.parent.getWorldQuaternion(new THREE.Quaternion()).invert(); _ax.applyQuaternion(a.wrap.quaternion).applyQuaternion(pq).normalize(); b.quaternion.premultiply(_q.setFromAxisAngle(_ax, side * arm)); });
  a.legs.forEach((b, i) => { if (!b) return; const side = i === 0 ? 1 : -1; _ax.copy(fwd); b.parent.updateMatrixWorld(); const pq = b.parent.getWorldQuaternion(new THREE.Quaternion()).invert(); _ax.applyQuaternion(a.wrap.quaternion).applyQuaternion(pq).normalize(); b.quaternion.premultiply(_q.setFromAxisAngle(_ax, side * leg)); });
}
const IDLE_IN = (Q.has('idlearms') ? +Q.get('idlearms') : 0) * D2R;   // 0: the idle is fixed at the source (Mixamo defaults, owner 22:01)
const FACE_OFF = (Q.has('face') ? +Q.get('face') : 0) * D2R;   // measured from the hip bones: the retargeted rig already faces +z (error 2-4°)
const yawOf = (faceDeg) => Math.atan2(-Math.cos(faceDeg * D2R), Math.sin(faceDeg * D2R));   // our floor heading → three's rotation.y
// ── reflections: one box-projected probe per space, captured from the baked room once everything is in ──
const PROBES = { bank_lobby: { pos: [0, 1.7, 14], min: [-6, 0, -5], max: [6, 5, 30], rough: 1.2, k: 0.32 },
                 bank_corridor: { pos: [0, 1.6, 42], min: [-2, 0, 30.1], max: [2, 3.2, 54], rough: 1.6, k: 0.45 },
                 bank_vault: { pos: [0, 1.7, 59], min: [-5, 0, 54.1], max: [5, 4.5, 64], rough: 1.6, k: 0.45 } };
let probesDone = Q.has('noreflect');
function floorShader(mat, pr, tex) {
  mat.envMap = tex; mat.needsUpdate = true;
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.boxMin = { value: new THREE.Vector3(...pr.min) }; sh.uniforms.boxMax = { value: new THREE.Vector3(...pr.max) };
    sh.uniforms.probePos = { value: new THREE.Vector3(...pr.pos) }; sh.uniforms.reflK = { value: pr.k }; sh.uniforms.reflRough = { value: pr.rough };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = worldPosition.xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos; uniform vec3 boxMin, boxMax, probePos; uniform float reflK, reflRough;')
      .replace('#include <envmap_fragment>', `{
        vec3 V = normalize(vWPos - cameraPosition), N = vec3(0.0, 1.0, 0.0), Rv = reflect(V, N);
        vec3 t1 = (boxMax - vWPos) / Rv, t2 = (boxMin - vWPos) / Rv, tf = max(t1, t2); float d = min(min(tf.x, tf.y), tf.z);
        vec3 dir = vWPos + Rv * d - probePos;
        vec3 env = textureCube(envMap, vec3(flipEnvMap * dir.x, dir.yz), reflRough).rgb;
        float fres = reflK * (0.08 + 0.92 * pow(1.0 - max(dot(-V, N), 0.0), 5.0));
        outgoingLight = outgoingLight * (1.0 - 0.35 * fres) + env * fres;
      }`);
  };
}
function captureProbes() {
  probesDone = true; const pm = new THREE.PMREMGenerator(R); const caps = {};
  scene.traverse(o => { if (o.isLight) o.layers.enable(1); });
  for (const [part, pr] of Object.entries(PROBES)) {
    const rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
    const cc = new THREE.CubeCamera(0.1, 80, rt); cc.children.forEach(c => c.layers.set(1)); cc.position.set(...pr.pos); scene.add(cc); cc.update(R, scene); scene.remove(cc);
    caps[part] = { rt, pm: pm.fromCubemap(rt.texture).texture };
  }
  for (const f of window.__FLOORS || []) if (caps[f.part]) floorShader(f.mat, PROBES[f.part], caps[f.part].rt.texture);
  for (const o of window.__METAL || []) { const steel = /steel/.test(o.material.name || ''); o.material.envMap = (steel ? caps.bank_corridor : caps.bank_lobby).pm; o.material.envMapIntensity = steel ? 1.0 : 0.9; o.material.needsUpdate = true; }
  window.__probes = Object.keys(caps).length;
}

// ── film grade ──
let post = null;
if (POSTFX) {
  const mk = (s2) => new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: s2 || 0, depthBuffer: !!s2 });
  const quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), quadScene = new THREE.Scene(), quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2)); quadScene.add(quad);
  const VS = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
  const bright = new THREE.ShaderMaterial({ uniforms: { t: { value: null } }, vertexShader: VS, depthTest: false, depthWrite: false,
    fragmentShader: 'uniform sampler2D t; varying vec2 vUv; void main() { vec3 c = texture2D(t, vUv).rgb; float l = max(c.r, max(c.g, c.b)); gl_FragColor = vec4(c * smoothstep(1.1, 2.0, l), 1.0); }' });
  const blur = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, dir: { value: new THREE.Vector2() } }, vertexShader: VS, depthTest: false, depthWrite: false,
    fragmentShader: 'uniform sampler2D t; uniform vec2 dir; varying vec2 vUv; void main() { vec3 c = texture2D(t, vUv).rgb * 0.227; c += (texture2D(t, vUv + dir * 1.38).rgb + texture2D(t, vUv - dir * 1.38).rgb) * 0.316; c += (texture2D(t, vUv + dir * 3.23).rgb + texture2D(t, vUv - dir * 3.23).rgb) * 0.07; gl_FragColor = vec4(c, 1.0); }' });
  const comp = new THREE.ShaderMaterial({ uniforms: { t: { value: null }, b: { value: null }, exposure: { value: Q.has('exp') ? +Q.get('exp') : 1.2 }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) } }, vertexShader: VS, depthTest: false, depthWrite: false,
    fragmentShader: `uniform sampler2D t, b; uniform float exposure, time; uniform vec2 res; varying vec2 vUv;
      vec3 gradeFit(vec3 v) { vec3 a = v * (v + 0.0245786) - 0.000090537; vec3 bb = v * (0.983729 * v + 0.4329510) + 0.238081; return a / bb; }
      vec3 gradeAces(vec3 c) { const mat3 I = mat3(vec3(0.59719, 0.07600, 0.02840), vec3(0.35458, 0.90834, 0.13383), vec3(0.04823, 0.01566, 0.83777));
        const mat3 O = mat3(vec3(1.60475, -0.10208, -0.00327), vec3(-0.53108, 1.10813, -0.07276), vec3(-0.07367, -0.00605, 1.07602));
        c *= exposure / 0.6; c = I * c; c = gradeFit(c); c = O * c; return clamp(c, 0.0, 1.0); }
      vec3 toSRGB(vec3 c) { return mix(c * 12.92, 1.055 * pow(c, vec3(0.41666)) - 0.055, step(0.0031308, c)); }
      float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main() {
        vec3 c = texture2D(t, vUv).rgb + texture2D(b, vUv).rgb * 0.45;
        c = gradeAces(c);
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        c = mix(c, c * vec3(0.90, 0.99, 1.07), (1.0 - l) * 0.45);        // teal in the shadows
        c = mix(c, c * vec3(1.05, 1.0, 0.93), l * 0.30);                // warm in the highlights
        c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);                      // gentler S-curve (owner 23:11: too contrasty on the phone)
        c = mix(vec3(l), c, 1.06);
        vec2 q = (vUv - 0.5) * vec2(res.x / res.y, 1.0); c *= mix(0.68, 1.0, smoothstep(0.85, 0.25, length(q)));
        c = toSRGB(clamp(c, 0.0, 1.0)) + (hash(vUv * res + fract(time) * 91.0) - 0.5) * 0.022;
        gl_FragColor = vec4(c, 1.0); }` });
  [bright, blur, comp].forEach(m => { m.toneMapped = false; }); post = { main: mk(4), a: mk(0), b: mk(0), quad, quadScene, quadCam, bright, blur, comp, w: 0, h: 0 };
}
// the objective's floor spot: a soft glow + an expanding ring, in the world (depth-tested: the robber's feet stand over it; owner 23:19)
const spotC = document.createElement('canvas'); spotC.width = spotC.height = 128; { const c = spotC.getContext('2d'), gr = c.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,214,0,.55)'); gr.addColorStop(0.6, 'rgba(255,214,0,.18)'); gr.addColorStop(1, 'rgba(255,214,0,0)'); c.fillStyle = gr; c.fillRect(0, 0, 128, 128); }
const spotGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(spotC), transparent: true, depthWrite: false })); spotGlow.rotation.x = -Math.PI / 2; spotGlow.renderOrder = 1; scene.add(spotGlow);
const spotRing = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.7, 64), new THREE.MeshBasicMaterial({ color: '#ffd600', transparent: true, depthWrite: false })); spotRing.rotation.x = -Math.PI / 2; spotRing.renderOrder = 1; scene.add(spotRing);
const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.17, 0), new THREE.MeshStandardMaterial({ color: '#f2c21a', emissive: '#6a4a00', emissiveIntensity: 0.35, metalness: 0.3, roughness: 0.45, envMapIntensity: 0.5, flatShading: true })); gem.scale.set(0.78, 1.2, 0.78); scene.add(gem); { const ol = new THREE.Mesh(gem.geometry, new THREE.MeshBasicMaterial({ color: '#141008', side: THREE.BackSide })); ol.scale.setScalar(1.16); gem.add(ol); }   /* a dark outline shell (owner 00:57: it blended into the marble) */ { const xo = new THREE.Mesh(gem.geometry, new THREE.MeshBasicMaterial({ color: '#141008', side: THREE.BackSide, transparent: true, opacity: 0.9, depthFunc: THREE.GreaterDepth, depthWrite: false })); xo.scale.setScalar(1.2); xo.renderOrder = 14; gem.add(xo); const xg = new THREE.Mesh(gem.geometry, new THREE.MeshBasicMaterial({ color: '#ffd23a', transparent: true, opacity: 0.8, depthFunc: THREE.GreaterDepth, depthWrite: false })); xg.renderOrder = 15; gem.add(xg); gem.material.transparent = true; gem.material.opacity = 1; gem.renderOrder = 16; gem.children.forEach(c => { if (c !== xo && c !== xg) { c.material.transparent = true; c.renderOrder = 16; } }); }   /* the gem draws after its X-ray: it never darkens itself */   /* seen through pillars (owner 01:41) */   // the objective marker, in the world (owner 00:53)   // smaller, no hot shine (owner 00:59)
const gemGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), new THREE.MeshBasicMaterial({ map: spotGlow.material.map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 })); scene.add(gemGlow);
function updateSpot(s) { const o = G.objective ? G.objective(s) : null, on = !!(o && o.x != null && !s.end && !(s.dial || (s.puzzle && !s.puzzle.done))); spotGlow.visible = spotRing.visible = gem.visible = on; gemGlow.visible = false; if (!on) return;
  gem.position.set(X(o.x), 2.35 + Math.sin(s.t * 3) * 0.12, o.z); gem.rotation.y = s.t * 1.8; { const kd = Math.min(1.5, Math.max(1, camera.position.distanceTo(gem.position) / 8)); gem.scale.set(0.78 * kd, 1.2 * kd, 0.78 * kd); } gemGlow.position.copy(gem.position); gemGlow.quaternion.copy(camera.quaternion);   // a minimum on-screen size (owner 01:48: lost at a distance)
  spotGlow.position.set(X(o.x), 0.025, o.z); const u = (s.t * 0.8) % 1; spotRing.position.set(X(o.x), 0.03, o.z); spotRing.scale.setScalar(0.3 + 0.7 * u); spotRing.material.opacity = 0.75 * (1 - u); }
const cctvCam = new THREE.PerspectiveCamera(64, 500 / 281, 0.25, 60);
function renderMonitor(s) {   // the CCTV's live view inside the wire panel's monitor (frozen on the empty hall once looped)
  const m = s.mini; if (!m || m.kind !== 'wires') return; const M = G.MONITOR; cctvCam.aspect = M.w / M.h; cctvCam.updateProjectionMatrix(); const cw = canvas.clientWidth, ch = canvas.clientHeight, sx = cw / 640, sy = ch / 960;
  const gx = G.CCTV.x, gz = G.CCTV.z;
  if (!m.aim) m.aim = [s.x, s.z];   /* aimed at the robber when the hack opens: you see yourself on the feed; once looped he is gone from it */
  const cx0 = m.aim[0] > 0 ? -5.2 : 5.2; cctvCam.position.set(X(cx0), 4.2, Math.max(-3.5, m.aim[1] - 8)); cctvCam.lookAt(X(m.aim[0]), 0.9, m.aim[1]);   // a corner camera above the entrance, opposite side: a clear view of him
  const hide = [coneCam, rimCam, coneGuard, rimGuard]; const vis = hide.map(o => o.visible); hide.forEach(o => { o.visible = false; }); const rv = robber ? robber.wrap.visible : true; if (robber && m.done) robber.wrap.visible = false;
  R.setRenderTarget(null); R.setScissorTest(true); R.setScissor(M.x * sx, (960 - M.y - M.h) * sy, M.w * sx, M.h * sy); R.setViewport(M.x * sx, (960 - M.y - M.h) * sy, M.w * sx, M.h * sy);
  R.render(scene, cctvCam); R.setScissorTest(false); R.setViewport(0, 0, cw, ch); hide.forEach((o, i) => { o.visible = vis[i]; }); if (robber) robber.wrap.visible = rv;
}
function renderFrame(t) {
  if (!post) { R.render(scene, camera); return; }
  const w = R.domElement.width, h = R.domElement.height;
  if (w !== post.w || h !== post.h) { post.w = w; post.h = h; post.main.setSize(w, h); post.a.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2)); post.b.setSize(Math.max(1, w >> 2), Math.max(1, h >> 2)); post.comp.uniforms.res.value.set(w, h); }
  const pass = (m, out) => { post.quad.material = m; R.setRenderTarget(out); R.render(post.quadScene, post.quadCam); };
  R.setRenderTarget(post.main); R.render(scene, camera);
  post.bright.uniforms.t.value = post.main.texture; pass(post.bright, post.a);
  post.blur.uniforms.t.value = post.a.texture; post.blur.uniforms.dir.value.set(1 / post.a.width, 0); pass(post.blur, post.b);
  post.blur.uniforms.t.value = post.b.texture; post.blur.uniforms.dir.value.set(0, 1 / post.a.height); pass(post.blur, post.a);
  post.comp.uniforms.t.value = post.main.texture; post.comp.uniforms.b.value = post.a.texture; post.comp.uniforms.time.value = t; pass(post.comp, null);
}
let tvTick = 0, fpsT = 0, fpsN = 0; let lastT = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; const s = G.S, C = G.CAM; if (!s) return requestAnimationFrame(frame);
  if (CAPTURE) { const pz = window.CAPTURE_POSE; if (!window.__capSized) { window.__capSized = true; Object.assign(canvas.style, { position: 'fixed', left: '0', top: '0', width: CAP.w + 'px', height: CAP.hgt + 'px', zIndex: 9 }); R.setPixelRatio(1); R.setSize(CAP.w, CAP.hgt, false); } camera.aspect = CAP.aspect; camera.fov = CAP.fov; camera.updateProjectionMatrix(); camera.position.set(X(pz.x), CAP.h, pz.z); camera.rotation.set(-CAP.pitch * D2R, Math.PI, 0); if (robber) robber.wrap.visible = false; if (guardA) guardA.wrap.visible = false; R.render(scene, camera); window.CAPTURED = true; return requestAnimationFrame(frame); }
  // camera = the game's camera
  camera.position.set(X(C.x), C.y, C.z); camera.rotation.set(-G.CONFIG.pitch * D2R, Math.PI - C.yaw, 0);
  key.position.set(X(s.x) + 4, 9, s.z - 3); key.target.position.set(X(s.x), 0, s.z + 2);
  fill.position.set(X(C.x), C.y + 0.5, C.z); fill.target.position.set(X(s.x), 1, s.z); rim.position.set(X(s.x) - 3, 4, s.z + 5); rim.target.position.set(X(s.x), 1, s.z);
  // the robber
  const rob = robber ? robber.wrap : robberStand; rob.position.set(X(s.x), 0, s.z);
  const tgtYaw = yawOf(s.face) + FACE_OFF; let dy = ((tgtYaw - rob.rotation.y + Math.PI * 3) % (Math.PI * 2)) - Math.PI; rob.rotation.y += dy * Math.min(1, dt * 12);
  if (robber && robber.round !== s) {   // a new round: drop the win / lose pose, start again from idle
    robber.round = s; robber.mixer.stopAllAction(); robber.started = false; robber.cur = null;
  }
  if (robber) {
    const sp = Math.hypot(s.vx, s.vz), A = robber.actions;
    if (s.end) { const k = s.end === 'win' ? 'win' : 'lose'; if (robber.cur !== k) { for (const a of Object.values(A)) a.fadeOut(0.25); const a = A[k]; if (a) { a.reset(); a.setLoop(k === 'win' ? THREE.LoopRepeat : THREE.LoopOnce); a.clampWhenFinished = k !== 'win'; a.fadeIn(0.25).play(); } robber.cur = k; } }
    else if (!robber.lockPose) {
      if (!robber.started) { for (const k of ['idle', 'walk', 'jog', 'run']) if (A[k]) { A[k].play(); A[k].setEffectiveWeight(0); } robber.started = true; robber.cur = 'loco'; }
      robber.still = sp < 0.12 ? (robber.still || 0) + dt : 0;   // seconds standing still
      const move = THREE.MathUtils.smoothstep(sp, 0.12, 0.9), wRun = THREE.MathUtils.smoothstep(sp, RV2 ? 2.3 : 2.6, RV2 ? 3.3 : 3.8);   // walk -> the owner's run (Mixamo Running, 23:38)   // idle → walk → fast walk → run
      const wJog = A.jog && Q.has('jog') ? THREE.MathUtils.smoothstep(sp, 1.6, 2.5) : 0;   // walk -> jog as the top gear (owner 23:27: the sprint read frantic); ?run brings the sprint back
      const tgt = { idle: 1 - move, walk: move * (1 - wJog) * (1 - wRun), jog: move * wJog * (1 - wRun), run: move * wRun }, ease = 1 - Math.exp(-dt / 0.12);   // eased weights (~0.35 s)
      robber.wt = robber.wt || { idle: 1, walk: 0, jog: 0, run: 0 }; for (const k in tgt) { robber.wt[k] += (tgt[k] - robber.wt[k]) * ease; if (A[k]) A[k].setEffectiveWeight(robber.wt[k]); }
      if (A.idle && robber.wt.idle < 0.05) A.idle.time = 0;   // every stop starts the idle from its calm first frame
      if (A.walk) A.walk.timeScale = THREE.MathUtils.clamp(sp / 1.4, 0.6, 1.4); if (A.jog) A.jog.timeScale = THREE.MathUtils.clamp(sp / 2.9, 0.75, 1.5);
      if (A.run) { A.run.timeScale = THREE.MathUtils.clamp(sp / 4.2, 0.8, 1.15); }
      if (RV2 && A.walk && A.run && robber.wt && robber.wt.walk > 0.02 && robber.wt.run > 0.02) { const lead = robber.wt.walk >= robber.wt.run ? A.walk : A.run, fol = lead === A.walk ? A.run : A.walk; fol.time = (lead.time / lead.getClip().duration) * fol.getClip().duration; }   // in step while they cross-fade: no scissoring legs
    }
    unStance(robber); robber.mixer.update(dt); if (!RV2) openStance(robber, ARM_SPACE, LEG_SPACE);
    for (const [b, q] of robber.handRest) b.quaternion.slerp(q, Q.has('hand') ? +Q.get('hand') : 1);
    if (RV2 && !s.end && robber.wt) openStance(robber, -IDLE_IN * robber.wt.idle, 0);   // the idle's arms in (owner 21:58: too spread)   // no cupped palm: 30% of the clip's wrist bend
    // feet on the floor: lift by the lowest toe's deficit (the clip has no root height)
    if (!RV2 || Math.hypot(s.vx, s.vz) < 1.2 || s.end) groundLock(robber, rob);   // not at run speed: the flight phase has both feet up (owner 23:41)
  }
  // the guard
  const g = G.guard(s), gw = guardA ? guardA.wrap : guardStand; gw.position.set(X(g.x), 0, G.GUARD.z); gw.rotation.y = yawOf(g.a) + FACE_OFF;
  if (guardA) { unStance(guardA); guardA.play(g.mode === 'walk' ? 'walk' : g.mode === 'look' ? 'look' : 'idle', 0.25); const held = !!(s.mini || s.hacking || (s.puzzle && !s.puzzle.done) || (s.dial && !s.dial.done)); guardA.mixer.update(held ? 0 : dt); openStance(guardA, ARM_SPACE * 0.7, LEG_SPACE * 0.7); groundLock(guardA, gw); }
  // cones (only in the lobby)
  const inLobby = s.z < ROOM.lobby.z1 + 1;
  if (inLobby && s.t < s.looped) { const cp = G.coneFloor(G.CCTV.x, G.CCTV.z, G.camAng(s, s.t), G.CONFIG.camHalf, G.CONFIG.camRange); setCone(coneCam, cp, 0.03, s.seen === 'cctv', rimCam, s.t, edgeDist(s.x, s.z, cp) < 1.5); } else { coneCam.visible = false; rimCam.visible = false; }
  if (inLobby) { const circ = G.CONFIG.guardCircle && s.t >= s.tvUntil && s.end !== 'busted', R0 = G.CONFIG.guardRadius;
    const gp = circ ? G.coneFloor(g.x, G.GUARD.z, 0, 180, R0, 96) : G.coneFloor(g.x, G.GUARD.z, g.a, s.t < s.tvUntil ? G.CONFIG.tvHalf : G.CONFIG.guardHalf, G.CONFIG.guardRange); setCone(coneGuard, gp, 0.035, s.seen === 'guard', rimGuard, s.t, edgeDist(s.x, s.z, gp) < 1.5); } else { coneGuard.visible = false; rimGuard.visible = false; }
  // the CCTV turns with its sweep; its LED goes green when looped
  camRig.rotation.y = yawOf(G.camAng(s, s.t)); camRig.rotation.x = 0.35; camLed.material.color.set(s.t >= s.looped ? '#30ff40' : ((s.t * 2) % 1 < 0.5 ? '#ff2020' : '#400'));
  // the TV: grey static, or the crew's stream (pink, LIVE)
  if ((tvTick = (tvTick || 0) + dt) > 1 / 15) { tvTick = 0; const c = tvScreenC.getContext('2d'), on = s.t < s.tvUntil; if (on) { c.fillStyle = '#ff2fb3'; c.fillRect(0, 0, 256, 144); c.fillStyle = '#e8132b'; c.fillRect(176, 10, 70, 28); c.fillStyle = '#fff'; c.font = '700 22px sans-serif'; c.fillText('LIVE', 186, 32); c.fillStyle = '#3BEA1E'; c.font = '700 34px sans-serif'; c.fillText('WOLF CAM', 18, 90); }
    else { const gr = c.createLinearGradient(0, 0, 256, 144); gr.addColorStop(0, '#12324f'); gr.addColorStop(1, '#0a1a2c'); c.fillStyle = gr; c.fillRect(0, 0, 256, 144); c.fillStyle = 'rgba(255,255,255,.08)'; for (let i = 0; i < 6; i++) c.fillRect(140 + i * 18, 30 + (i % 3) * 8, 10, 70 - (i % 3) * 8);
      c.fillStyle = '#c8102e'; c.fillRect(0, 112, 256, 32); c.fillStyle = '#fff'; c.font = '700 13px sans-serif'; c.fillText('BREAKING  ·  MASKED CREW STILL AT LARGE  ·  POLICE ON ALERT  ·  ', 256 - ((s.t * 60) % 520), 132); c.fillStyle = '#fff'; c.font = '700 22px sans-serif'; c.fillText('CITY NEWS', 14, 34); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(14, 44, 90, 3); }
    tvTex.needsUpdate = true; }
  // doors, lasers, vault
  const op = s.door && s.puzzle ? Math.min(1, (s.t - s.puzzle.doneT - 0.5) / 0.6) : 0; doorPanel.position.x = X(-op * 2.1); keypad.material.color.set(s.door ? '#c9ffd2' : '#dcdcdc');
  G.LASERS.forEach((L, i) => { const on = G.laserOn(L, s.t, s), soon = !on && G.laserOn(L, s.t + 0.5, s), u = lasers[i].userData; lasers[i].visible = true; u.beams.visible = on; const flick = 0.85 + 0.15 * Math.sin(s.t * 47 + i * 3); laserGlow.opacity = 0.55 * flick; for (const l of u.lenses) l.material = on || (soon && (s.t * 10 % 1) < 0.5) ? lensOn : lensOff; });   // the lenses tell you it is coming
  laserBoxMat.emissive.set(s.t < s.laserHackUntil ? '#30ff40' : '#ff3030');
  const vo = s.end === 'win' ? Math.min(1, s.endT / 1.4) : 0; vaultHinge.rotation.y = -vo * 1.75; if (window.__vaultLight) window.__vaultLight.intensity = 3 + 14 * vo; wheel.rotation.z = (s.dial && s.dial.pick ? s.dial.a * 0.04 : 0) + vo * 3;
  // pillars between the camera and the robber turn see-through
  if (!MATTE) for (const { b, m } of pillarMats) { const near = b.z1 < s.z && b.z1 > C.z && Math.abs((b.x0 + b.x1) / 2 - s.x) < 2.2; m.opacity += ((near ? 0.3 : 1) - m.opacity) * Math.min(1, dt * 8); m.depthWrite = m.opacity > 0.95; }
  if (carry.visible) { const inVault = s.z > 31; carry.position.set(X(s.x) * 0.5, inVault ? 3 : 4.4, s.z + 1.5); carry.color.set(inVault ? '#e4edff' : '#ffe6c4'); }
  fpsT += dt; fpsN++; if (fpsT > 2) { const fps = fpsN / fpsT; window.__fps = Math.round(fps); if (fps < 45 && PR > 1 && !Q.has('pr')) { PR = Math.max(1, PR - 0.25); R.setPixelRatio(PR); resize(); } fpsT = 0; fpsN = 0; }
  if (!probesDone && BAKE && window.__bank && Object.values(window.__texCache || {}).every(t => t.image)) captureProbes();
  bakeProjectors(); pickPlates(C.z, C.x); updateSpot(s); renderFrame(now / 1000); renderMonitor(s); requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
window.W3D_READY = true;
