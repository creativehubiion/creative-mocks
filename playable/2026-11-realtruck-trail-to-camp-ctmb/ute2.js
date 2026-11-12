/* Trail to Camp v2: the ute, its fittings and the gear, baked the way the style frame does it (05-style-test/style.js loadLowpoly):
   matte flat colours go into vertex colour, so a model collapses to one flat mesh, one glow mesh, one textured mesh per mapped material
   (the RealTruck plate) and its glass; wheels are grouped per front wheel (they steer) and one rear axle. Every material is the kit's
   two-band ramp with the long-shadow mask sampled in the ute's track frame, a warm rim on the sun side and the height haze.
   Products bake the same way into a group in the ute's model space; the roll cover keeps its Open/Close clip as one skinned mesh per kind. */
import * as THREE from 'three';
import { mergeGeometries } from './vendor/addons/utils/BufferGeometryUtils.js';
import * as K from './kit.js';

export const UU = { uUteF: { value: new THREE.Vector4() }, uUteGain: { value: 1.35 } };
const UTE_GLSL = `uniform float uUteGain; uniform sampler2D uMask; uniform vec4 uMaskRect; uniform vec4 uUteF; uniform float uShadowK; uniform vec3 uRim; varying vec3 vKW; float kVis = 1.0;
float uteMask(vec3 wp) { vec2 d = wp.xz - uUteF.yz; float th = uUteF.w; vec2 tr = vec2(uUteF.x + d.x * sin(th) + d.y * cos(th), -d.x * cos(th) + d.y * sin(th)); vec2 mt = (tr - uMaskRect.xy) * uMaskRect.zw; return texture2D(uMask, mt).r; }`;
let U = null;
export function setUniforms(u) { U = u; }
export function patchUte(m, mode, extra) {
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U, UU, extra ? extra.uniforms : {});
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vKW;').replace('#include <project_vertex>', '#include <project_vertex>\nvKW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    if (/skinning/.test(sh.vertexShader) && m.skinning !== false) { /* skinned: vKW from the skinned position */ }
    let fs = sh.fragmentShader.replace('#include <lights_fragment_begin>', THREE.ShaderChunk.lights_fragment_begin).replace('#include <lights_lambert_pars_fragment>', THREE.ShaderChunk.lights_lambert_pars_fragment)
      .replace('#include <common>', '#include <common>\n' + UTE_GLSL + K.RAMP_GLSL.replace('float kVis = 1.0;', '') + K.HAZE_GLSL + (extra ? extra.decl || '' : ''))
      .replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight ); directLight.color *= kVis;');
    fs = fs.replace('void main() {', 'void main() {\n kVis = 1.0 - uteMask(vKW) * uShadowK * 0.85;');
    fs = fs.replace('float dotNL = saturate( dot( geometryNormal, directLight.direction ) );', 'float dotNL = kitRamp(dot( geometryNormal, directLight.direction ));');
    fs = fs.replace('#include <lights_fragment_end>', `#include <lights_fragment_end>
      { vec3 Vv = normalize(vViewPosition); float fr = pow(1.0 - clamp(dot(normal, Vv), 0.0, 1.0), 3.0); vec3 nw = (vec4(normal, 0.0) * viewMatrix).xyz;
        float sunSide = clamp(dot(normalize(nw.xz + 1e-4), normalize(uSunDir.xz + 1e-4)) * 0.6 + 0.4, 0.0, 1.0);
        totalEmissiveRadiance += uRim * fr * sunSide * smoothstep(-0.3, 0.5, nw.y) * (0.75 + 0.6 * diffuseColor.rgb) * 1.5; ${extra ? extra.frag || '' : ''} }`)
      .replace('#include <opaque_fragment>', `outgoingLight = applyHaze(outgoingLight * ${mode === 'glow' ? '1.0' : 'uUteGain'}, vKW);\nif (any(isnan(outgoingLight))) outgoingLight = vec3(0.0);\n#include <opaque_fragment>`);
    sh.fragmentShader = fs;
  };
  m.customProgramCacheKey = () => 'ute2-' + mode + m.type + (extra ? extra.key : '');
  m.needsUpdate = true; return m;
}

export const hiddenNode = (gl, o) => { const a = gl.parser.associations.get(o), nodes = gl.parser.json.nodes || [], n = a && a.nodes !== undefined ? nodes[a.nodes] : null; return (n && n.extensions && n.extensions.KHR_node_visibility && n.extensions.KHR_node_visibility.visible === false) || /^BADGE_/.test(o.name); };
export function geoInto(o, inv, keep = ['position', 'normal', 'uv']) {
  const g0 = o.geometry, g1 = new THREE.BufferGeometry(), n = g0.attributes.position.count;
  for (const name of keep) { const a = g0.attributes[name]; if (!a) continue; const sz = name === 'uv' ? 2 : 3, arr = new Float32Array(n * sz); for (let i = 0; i < n; i++) { arr[i * sz] = a.getX(i); arr[i * sz + 1] = a.getY(i); if (sz === 3) arr[i * sz + 2] = a.getZ(i); } g1.setAttribute(name, new THREE.BufferAttribute(arr, sz)); }
  if (!g1.attributes.uv) g1.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  if (!g1.attributes.normal) g1.computeVertexNormals();
  g1.setIndex(g0.index ? Array.from(g0.index.array) : [...Array(n).keys()]);
  g1.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)); return g1;
}
/* one bucket per kind: 'flat' (vertex colours), 'glow', 'map:<uuid>', 'glass:<name>' */
function kindOf(m0) {
  const em = m0.emissive ? m0.emissive.clone().multiplyScalar(m0.emissiveIntensity || 1) : new THREE.Color(0, 0, 0), glow = em.r + em.g + em.b > 0.05;
  return { kind: /^(Glass|MirrorGlass)$/.test(m0.name) ? 'glass:' + m0.name : m0.map ? 'map:' + m0.uuid : glow ? 'glow' : 'flat', em, glow };
}
function bakeColour(o, m0, g1, em, glow) {
  const n = g1.attributes.position.count, arr = new Float32Array(n * 3), vc = o.geometry.attributes.color;
  const base = glow ? em.clone().add(m0.color.clone().multiplyScalar(0.3)) : (m0.map ? new THREE.Color(1, 1, 1) : m0.color.clone());
  /* product blacks lifted to a charcoal floor so rails, bars and slats read against the tub liner; the liner and wheel well stay darkest */
  if (/^Prod(Black|Rubber)/.test(m0.name)) { const k = Math.max(base.r, base.g, base.b); if (k < 0.06) base.multiplyScalar(0.06 / Math.max(k, 1e-3)); }
  if (/^(Well|Liner)/.test(m0.name)) base.multiplyScalar(0.7);
  for (let i = 0; i < n; i++) { const k = vc ? [vc.getX(i), vc.getY(i), vc.getZ(i)] : [1, 1, 1]; arr[i * 3] = base.r * k[0]; arr[i * 3 + 1] = base.g * k[1]; arr[i * 3 + 2] = base.b * k[2]; }
  g1.setAttribute('color', new THREE.BufferAttribute(arr, 3));
}
const MATS = {};
function matFor(kind, B, glass) {
  const key = kind + B.side + (B.map ? B.map.uuid : ''); if (MATS[key]) return MATS[key];
  let m;
  if (kind === 'glow') m = new THREE.MeshBasicMaterial({ vertexColors: true, side: B.side });
  else if (kind.startsWith('glass:')) { m = patchUte(new THREE.MeshLambertMaterial({ color: B.col || 0x5d86a6, side: B.side }), 'lowpoly'); if (glass) glass(m, kind === 'glass:Glass' ? 0.7 : 0.5); }
  else m = patchUte(new THREE.MeshLambertMaterial({ vertexColors: true, map: B.map, side: B.side }), 'lowpoly');
  m.userData.kind = kind; return (MATS[key] = m);
}
export function bakeInto(src, M, space, B_of) {
  space.updateMatrixWorld(true); src.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(space.matrixWorld).invert();
  src.traverse(o => {
    if (!o.isMesh || o.isSkinnedMesh) return; for (let q = o; q; q = q.parent) if (!q.visible) return;
    const m0 = o.material, { kind, em, glow } = kindOf(m0), tgt = B_of ? B_of(o) : M;
    const g1 = geoInto(o, inv); bakeColour(o, m0, g1, em, glow);
    if (!tgt.has(kind)) tgt.set(kind, { geos: [], map: m0.map || null, side: THREE.FrontSide, col: m0.color ? m0.color.clone() : null });
    const B = tgt.get(kind); B.geos.push(g1); if (m0.side === THREE.DoubleSide) B.side = THREE.DoubleSide;
  });
}
export function buildBuckets(M, parent, glass, shadow = true) {
  const out = [];
  for (const [kind, B] of M) { const mg = mergeGeometries(B.geos, false); if (!mg) continue; mg.computeBoundingSphere(); const mesh = new THREE.Mesh(mg, matFor(kind, B, glass)); mesh.castShadow = shadow && kind !== 'glow' && !kind.startsWith('glass'); mesh.receiveShadow = false; parent.add(mesh); out.push(mesh); }
  return out;
}

/* the ute rig: root (world pose) > tilt (pitch/roll about the centre of gravity) > inner (model space, tyres on y = 0) */
export async function loadUte(loadGLB, dir, glass, CGY) {
  const g = await loadGLB(dir + 'ute.glb');
  const root = new THREE.Group(); root.rotation.order = 'YXZ';
  const tilt = new THREE.Group(); tilt.rotation.order = 'YXZ'; tilt.position.y = CGY; root.add(tilt);
  const inner = new THREE.Group(); inner.position.y = -CGY; tilt.add(inner);
  const src = g.scene; inner.add(src); g.scene.traverse(o => { if (hiddenNode(g, o)) o.visible = false; });
  root.updateMatrixWorld(true);
  const wheels = {}; src.traverse(o => { const m = /^Wheel_(FL|FR|RL|RR)$/.exec(o.name); if (m) wheels[m[1]] = o; });
  const wheelOf = o => { for (let q = o; q; q = q.parent) for (const k in wheels) if (wheels[k] === q) return k; return null; };
  const invR = new THREE.Matrix4().copy(inner.matrixWorld).invert(), wpos = k => new THREE.Vector3().setFromMatrixPosition(wheels[k].matrixWorld).applyMatrix4(invR);
  /* wheel groups: each front wheel steers in its own group; the rear pair spins on one axle */
  /* wheel groups hang from the root (not the tilted body), so the tyres stay on the ground while the body pitches and rolls */
  const groups = {}, mk = (k, c) => { const gp = new THREE.Group(); gp.position.copy(c); const sp = new THREE.Group(); gp.add(sp); root.add(gp); return { g: gp, spin: sp, buckets: new Map(), c }; };
  for (const k of ['FL', 'FR']) if (wheels[k]) groups[k] = mk(k, wpos(k));
  if (wheels.RL && wheels.RR) groups.R = mk('R', wpos('RL').add(wpos('RR')).multiplyScalar(0.5));
  root.updateMatrixWorld(true);
  const body = new Map();
  const target = o => { const k = wheelOf(o); if (!k) return body; return (k === 'RL' || k === 'RR' ? groups.R : groups[k]).buckets; };
  /* bake each wheel bucket in its own group's space */
  for (const k in groups) { const G = groups[k]; const keys = k === 'R' ? ['RL', 'RR'] : [k]; const tmp = new Map(); for (const wk of keys) bakeInto(wheels[wk], tmp, G.spin); G.buckets = tmp; }
  bakeInto(src, body, inner, o => wheelOf(o) ? new Map() : body);
  inner.remove(src);
  const bodyG = new THREE.Group(); inner.add(bodyG); const meshes = buildBuckets(body, bodyG, glass);
  for (const k in groups) meshes.push(...buildBuckets(groups[k].buckets, groups[k].spin, glass));
  /* measured: tyre radius from the wheel box, tub from the README anchors */
  const bb = new THREE.Box3().setFromObject(wheels.FL || wheels.RL); const wheelR = Math.min(0.42, (bb.max.y - bb.min.y) / 2);
  const box = new THREE.Box3(); for (const m of bodyG.children) { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox); }
  return { root, tilt, inner, bodyG, groups, wheelR, meshes, box, axleZ: [groups.FL ? groups.FL.c.z : 1.64, groups.R ? groups.R.c.z : -1.64] };
}

/* a product: baked into a group in model space (or a skinned cover: one skinned mesh per kind driven by its clip) */
export async function loadProduct(loadGLB, url, glass) {
  const g = await loadGLB(url);
  g.scene.traverse(o => { if (hiddenNode(g, o)) o.visible = false; });
  const grp = new THREE.Group(), out = { grp, url, parts: [] };
  const animated = new Set(); for (const c of g.animations) for (const t of c.tracks) animated.add(t.name.split('.')[0]);
  if (g.animations.length && /roll-cover/.test(url)) {
    /* skinned merge: each rigid slat bound fully to its animated ancestor */
    const root = g.scene; grp.add(root); root.updateMatrixWorld(true); grp.updateMatrixWorld(true);
    const bones = [root], boneIx = new Map([[root, 0]]), byK = new Map(), inv = new THREE.Matrix4().copy(grp.matrixWorld).invert(), hide = [];
    root.traverse(o => {
      if (!o.isMesh || o.isSkinnedMesh) return; for (let q = o; q; q = q.parent) if (!q.visible) return;
      let b = null; for (let q = o; q && q !== root; q = q.parent) if (animated.has(q.name)) { b = q; break; } b = b || root; if (!boneIx.has(b)) { boneIx.set(b, bones.length); bones.push(b); }
      const { kind, em, glow } = kindOf(o.material), g1 = geoInto(o, inv); bakeColour(o, o.material, g1, em, glow);
      const n = g1.attributes.position.count, si = new Uint16Array(n * 4), sw = new Float32Array(n * 4), bi = boneIx.get(b); for (let i = 0; i < n; i++) { si[i * 4] = bi; sw[i * 4] = 1; }
      g1.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g1.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
      const kk = kind.startsWith('map') ? 'flat' : kind; if (!byK.has(kk)) byK.set(kk, []); byK.get(kk).push(g1); hide.push(o);
    });
    const skel = new THREE.Skeleton(bones, bones.map(bn => new THREE.Matrix4().copy(bn.matrixWorld).invert().multiply(grp.matrixWorld)));
    for (const [kk, geos] of byK) { const mg = mergeGeometries(geos, false); if (!mg) continue; const mat = kk === 'glow' ? new THREE.MeshBasicMaterial({ vertexColors: true }) : patchUte(new THREE.MeshLambertMaterial({ vertexColors: true }), 'cover'); const sm = new THREE.SkinnedMesh(mg, mat); sm.frustumCulled = false; sm.castShadow = true; grp.add(sm); sm.bind(skel, new THREE.Matrix4()); out.parts.push(sm); }
    for (const o of hide) o.visible = false;
    out.mixer = new THREE.AnimationMixer(root); const clip = g.animations.find(a => /Open/i.test(a.name)) || g.animations[0];
    if (clip) { out.clip = clip; out.action = out.mixer.clipAction(clip); out.action.setLoop(THREE.LoopOnce, 1); out.action.clampWhenFinished = true; out.action.play(); }
    out.pose = t => { if (!out.action) return; if (Math.abs((out.poseT ?? -1) - t) < 1e-4) return; out.poseT = t; out.action.time = Math.min(t, out.clip.duration - 1e-4); out.action.enabled = true; out.mixer.update(0); };
    out.pose(out.clip ? out.clip.duration : 0);
  } else {
    /* rigid product: one bucket set per top-level part (the build shot assembles them one by one) */
    const top = []; g.scene.traverse(o => { if (o.isMesh && o.visible) top.push(o); });
    const groupsByParent = new Map(); for (const o of top) { let p = o; while (p.parent && p.parent !== g.scene && p.parent.parent && p.parent.parent !== g.scene) p = p.parent; const key = p.parent === g.scene ? o : p; if (!groupsByParent.has(key)) groupsByParent.set(key, []); groupsByParent.get(key).push(o); }
    grp.add(g.scene); grp.updateMatrixWorld(true);
    const M = new Map(); bakeInto(g.scene, M, grp); grp.remove(g.scene);
    const meshes = buildBuckets(M, grp, glass); out.parts = meshes;
  }
  const bb = new THREE.Box3(); grp.updateMatrixWorld(true); grp.traverse(o => { if (o.isMesh) { o.geometry.computeBoundingBox(); bb.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)); } });
  out.box = bb; out.size = bb.getSize(new THREE.Vector3()); out.centre = bb.getCenter(new THREE.Vector3());
  return out;
}

/* gear: the set's flat gear (swag, esky, jerry can, firewood) at real size, plus faceted big and long loads for the racks */
export function kitGear(THREE_, id) {
  const f = K[id === 'jerry' ? 'jerry' : id === 'wood' ? 'firewood' : id](false), g = K.toGeometry(THREE_, K.scaled(f, K.PICKUP_SCALE || 1.1));
  g.computeBoundingBox(); const b = g.boundingBox; g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); g.computeBoundingBox(); return g;
}
export async function loadGear(loadGLB, dir) {
  const files = { swag: 'gear-swag', esky: 'gear-esky', jerry: 'gear-jerrycan', wood: 'gear-firewood' }, out = {};
  for (const id in files) {
    try { const g = await loadGLB(dir + files[id] + '.glb'); const M = new Map(), holder = new THREE.Group(); holder.add(g.scene); bakeInto(g.scene, M, holder); const geos = []; for (const [, B] of M) geos.push(...B.geos);
      const mg = mergeGeometries(geos.map(x => { const y = x.index ? x.toNonIndexed() : x; y.deleteAttribute('uv'); return y; }), false); mg.computeBoundingBox(); const b = mg.boundingBox; mg.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); mg.computeBoundingBox(); out[id] = mg; } catch (e) { out[id] = null; }
  }
  return out;
}
/* faceted loads for the rack and ladder rack, in the kit palette (no textures) */
export function bigGear(THREE_, id) {
  const f = new K.Facets(), fx = [1, 0, 0, 0], C = K.C;
  if (id === 'tent') { K.bevelBox(f, [0, 0.16, 0], 1.25, 0.32, 1.0, 0.04, n => n[1] > 0.5 ? K.shade(C.canvas, 1.05) : C.canvas, fx); K.bevelBox(f, [0, 0.34, 0], 1.18, 0.06, 0.94, 0.02, () => C.black, fx); }
  else if (id === 'kayak') { K.loft(f, [{ y: -1.4, r: 0.02 }, { y: -0.9, r: 0.2 }, { y: 0, r: 0.3 }, { y: 0.9, r: 0.2 }, { y: 1.4, r: 0.02 }], 8, () => K.lin('#D8553A'), fx, 3, 0.02, false); }
  else if (id === 'logs') { for (let i = 0; i < 3; i++) K.tube(f, [[-1.0, 0.12 + (i === 2 ? 0.2 : 0), (i - 1) * 0.22 * (i === 2 ? 0 : 1)], [1.0, 0.12 + (i === 2 ? 0.2 : 0), (i - 1) * 0.22 * (i === 2 ? 0 : 1)]], [0.12, 0.12], 6, () => C.bark, fx); }
  else if (id === 'timber') { for (let i = 0; i < 3; i++) K.bevelBox(f, [0, 0.05 + i * 0.07, 0], 2.4, 0.06, 0.2, 0.01, () => K.shade(C.canvasTan, 1 - i * 0.05), fx); }
  else if (id === 'poles') { for (let i = 0; i < 4; i++) K.tube(f, [[-1.3, 0.05 + (i > 1 ? 0.08 : 0), (i % 2 - 0.5) * 0.12], [1.3, 0.05 + (i > 1 ? 0.08 : 0), (i % 2 - 0.5) * 0.12]], [0.04, 0.04], 5, () => C.steel, fx); }
  else if (id === 'fridge') { K.bevelBox(f, [0, 0.21, 0], 0.62, 0.42, 0.4, 0.03, n => n[1] > 0.5 ? C.white : K.shade(C.steel, 1.05), fx); K.bevelBox(f, [0.2, 0.43, 0], 0.16, 0.04, 0.3, 0.01, () => C.black, fx); }
  else if (id === 'genset') { K.bevelBox(f, [0, 0.2, 0], 0.52, 0.36, 0.36, 0.03, () => K.lin('#D8332A'), fx); for (const x of [-0.27, 0.27]) K.bevelBox(f, [x, 0.22, 0], 0.04, 0.44, 0.4, 0.01, () => C.black, fx); K.bevelBox(f, [0, 0.44, 0], 0.58, 0.04, 0.04, 0.01, () => C.black, fx); }
  else if (id === 'board') { K.loft(f, [{ y: -1.1, r: 0.03 }, { y: -0.6, r: 0.24 }, { y: 0.5, r: 0.26 }, { y: 1.1, r: 0.03 }], 6, () => C.white, fx, 3, 0.02, false); }
  /* the x3 rack loads (no models of their own before tonight: they were drawn as empty geometry): a bundle of three timber lengths, a
     flat aluminium ladder, three rolled swags (two below, one on top), three boards stacked flat */
  else if (id === 'timber3') { for (let i = 0; i < 3; i++) K.bevelBox(f, [0, 0.05, (i - 1) * 0.13], 1.5, 0.09, 0.12, 0.01, () => K.shade(C.canvasTan, 1 - i * 0.06), fx); K.bevelBox(f, [0.45, 0.05, 0], 0.05, 0.1, 0.42, 0.005, () => C.black, fx); K.bevelBox(f, [-0.45, 0.05, 0], 0.05, 0.1, 0.42, 0.005, () => C.black, fx); }
  else if (id === 'ladder3') { for (const z of [-0.2, 0.2]) K.bevelBox(f, [0, 0.03, z], 1.6, 0.06, 0.05, 0.01, () => C.steel, fx); for (let i = 0; i < 6; i++) K.bevelBox(f, [-0.7 + i * 0.28, 0.03, 0], 0.035, 0.035, 0.4, 0.005, () => K.shade(C.steel, 0.9), fx); }
  else if (id === 'swags3') { const col = K.lin('#5F6B45'); for (const [y, z] of [[0.11, -0.115], [0.11, 0.115], [0.3, 0]]) { K.tube(f, [[-0.6, y, z], [0.6, y, z]], [0.11, 0.11], 8, () => col, fx); for (const x of [-0.3, 0.3]) K.tube(f, [[x - 0.025, y, z], [x + 0.025, y, z]], [0.117, 0.117], 8, () => C.black, fx); } }
  if (id === 'board3') { const one = bigGear(THREE_, 'board'); one.computeBoundingBox(); const h = one.boundingBox.max.y + 0.01, parts = [0, 1, 2].map(i => one.clone().translate(0, i * h, 0)); const out = new THREE_.BufferGeometry();
    for (const nm of Object.keys(one.attributes)) { const sz = one.attributes[nm].itemSize, arr = new Float32Array(parts.reduce((a, p) => a + p.attributes[nm].array.length, 0)); let o = 0; for (const p of parts) { arr.set(p.attributes[nm].array, o); o += p.attributes[nm].array.length; } out.setAttribute(nm, new THREE_.BufferAttribute(arr, sz)); }
    out.computeBoundingBox(); return out; }
  const g = K.toGeometry(THREE_, f);
  if (id === 'kayak' || id === 'board') { g.rotateZ(Math.PI / 2); if (id === 'board') g.scale(1, 0.18, 1); else g.scale(1, 0.6, 1); }
  g.computeBoundingBox(); let b = g.boundingBox; g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); g.computeBoundingBox();
  /* fit the rack: at most 1.3 m long, 0.9 m wide, 0.38 m tall */
  b = g.boundingBox; const sz = b.getSize(new THREE_.Vector3()), k = Math.min(1, 1.3 / Math.max(sz.x, 1e-3), 0.9 / Math.max(sz.z, 1e-3), 0.38 / Math.max(sz.y, 1e-3)); g.scale(k, k, k); g.computeBoundingBox();
  return g;
}
