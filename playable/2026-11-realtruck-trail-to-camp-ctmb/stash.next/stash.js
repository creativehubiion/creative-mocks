/* stash.js : the visual stash on the back of the ute for Trail to Camp (realtruck-01). ES module, three.js only (THREE is passed
   in), no DOM. Collected pieces land as loose items on the next place of a preset load (at most five, neatly stacked); the sixth
   packs them all into one box; when the preset load is complete (its maximum height), boxes consolidate: four boxes on a pair of
   places become one case, two stacked cases one trunk, so the load keeps taking cargo without getting taller. Hits burst the top
   unprotected unit; its lost items tumble off, the rest settle back as loose items. One body, one sway (stability driven), a
   yellow-wash tally, a fit choreography per product, and an optional see-through for anything that would cover the road.
   Presets and measurements: layout.js. Models: models.js. API and tables: README.md. */
import { layout, pairPose, keepFor, BIG, BIG_SIZE, RAIL, MAX_TOP, PRODUCT_OF } from './layout.js';
import { families, LOOSE_TYPES } from './models.js';

export const STASH_DEFAULTS = {
  pack: 6, caseOf: 4, trunkOf: 2, stageMax: 5, fitDuration: 1.9, swayMax: 0.13, danger: 0.35,
  worth: { swag: 1, esky: 1, jerry: 1, wood: 1, fridge: 2, genset: 3, tent: 3, kayak: 3, board: 2, board3: 3, swags3: 3, timber: 2, timber3: 3, logs: 3, ladder3: 3, poles: 2 }
};
const TAU = Math.PI * 2;
const clamp = (x, a, b) => x < a ? a : x > b ? b : x;
const sm = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
const easeOut = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const easeIn = t => { t = clamp(t, 0, 1); return t * t * t; };
const backOut = t => { t = clamp(t, 0, 1); const c = 1.6; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const lerp = (a, b, t) => a + (b - a) * t;
const CFG0 = { tub: 'none', cover: 'none', top: 'none' };

/* ================================================================ shader patch shared by every stash mesh (one program) */
function patchStash(THREE, m, SU, U) {
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => '';
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    Object.assign(sh.uniforms, SU); if (U) Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aPart; attribute float aYn; attribute float aSel; attribute vec4 aF2; varying vec3 vSP; varying vec4 vF2; varying float vYn;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nif (abs(aPart - aSel) > 0.5) transformed = vec3(0.0);\nvF2 = aF2; vYn = aYn;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvSP = (instanceMatrix * vec4(transformed, 1.0)).xyz;')
      .replace('vKW = (modelMatrix * vec4(transformed, 1.0)).xyz;', 'vKW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;');
    const fx = `
      { vec3 Vd = normalize(vViewPosition); float rim = pow(1.0 - clamp(abs(dot(normal, Vd)), 0.0, 1.0), 2.0);
        float below = step(vYn, vF2.x);
        outgoingLight = mix(outgoingLight, uStYellow * 1.15, below * vF2.y) + outgoingLight * vF2.z;
        outgoingLight += uStAmber * (0.35 + rim * 1.6) * vF2.w * uStDanger.y;
        float a = 1.0;
        if (uStFadeK.x > 0.5) {
          float hl = uStFade.y + uStFade.z * (vSP.z - uStFade.x); float f = smoothstep(0.0, uStFade.w, vSP.y - hl);
          a = mix(1.0, uStFadeK.y, f); a = mix(a, 1.0, clamp(rim * uStFadeK.w, 0.0, 1.0) * f); outgoingLight += outgoingLight * rim * 0.5 * f;
          if (uStFadeK.z > 0.5) { vec2 q = mod(floor(gl_FragCoord.xy), 4.0); int i = int(q.x) + int(q.y) * 4;
            float bay = i == 0 ? 0.0 : i == 1 ? 8.0 : i == 2 ? 2.0 : i == 3 ? 10.0 : i == 4 ? 12.0 : i == 5 ? 4.0 : i == 6 ? 14.0 : i == 7 ? 6.0 : i == 8 ? 3.0 : i == 9 ? 11.0 : i == 10 ? 1.0 : i == 11 ? 9.0 : i == 12 ? 15.0 : i == 13 ? 7.0 : i == 14 ? 13.0 : 5.0;
            if (a < (bay + 0.5) / 16.0) discard; a = 1.0; }
        }
        diffuseColor.a = a; }
      #include <opaque_fragment>`;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSP; varying vec4 vF2; varying float vYn; uniform vec3 uStYellow; uniform vec3 uStAmber; uniform vec4 uStDanger; uniform vec4 uStFade; uniform vec4 uStFadeK;');
    const k = sh.fragmentShader.lastIndexOf('#include <opaque_fragment>');
    sh.fragmentShader = sh.fragmentShader.slice(0, k) + fx + sh.fragmentShader.slice(k + '#include <opaque_fragment>'.length);
  };
  m.customProgramCacheKey = () => prevKey() + '-stash';
  return m;
}

/* geometry for a family: its variants merged, each tagged with aPart = variant index (the instance's aSel picks one) */
function familyGeometry(THREE, K, fam) {
  const parts = fam.variants.map(f => K.toGeometry(THREE, f));
  const names = ['position', 'normal', 'color', 'aFx', 'aTrk'];
  let n = 0; for (const g of parts) n += g.attributes.position.count;
  const geo = new THREE.BufferGeometry(), out = {};
  for (const nm of names) { const sz = parts[0].attributes[nm].itemSize; out[nm] = new Float32Array(n * sz); }
  const part = new Float32Array(n), yn = new Float32Array(n);
  let o = 0, maxY = 1e-3, minY = 0;
  for (const g of parts) { const P = g.attributes.position.array; for (let i = 1; i < P.length; i += 3) { maxY = Math.max(maxY, P[i]); minY = Math.min(minY, P[i]); } }
  parts.forEach((g, pi) => {
    const c = g.attributes.position.count;
    for (const nm of names) out[nm].set(g.attributes[nm].array, o * g.attributes[nm].itemSize);
    const P = g.attributes.position.array;
    for (let i = 0; i < c; i++) { part[o + i] = pi; yn[o + i] = (P[i * 3 + 1] - minY) / (maxY - minY); }
    o += c; g.dispose();
  });
  for (const nm of names) geo.setAttribute(nm, new THREE.BufferAttribute(out[nm], parts[0].attributes[nm].itemSize));
  geo.setAttribute('aPart', new THREE.BufferAttribute(part, 1));
  geo.setAttribute('aYn', new THREE.BufferAttribute(yn, 1));
  geo.computeBoundingSphere();
  const bb = fam.variants.map(f => { const mn = [9, 9, 9], mx = [-9, -9, -9]; for (let i = 0; i < f.P.length; i += 3) for (let c = 0; c < 3; c++) { mn[c] = Math.min(mn[c], f.P[i + c]); mx[c] = Math.max(mx[c], f.P[i + c]); } return { mn, mx }; });
  return { geo, bb, tris: fam.variants.map(f => f.tris) };
}

/* ================================================================ the stash */
export function createStash({ THREE, ute = null, anchors = null, kit, camera = null, options = {} }) {
  const K = kit, O = { ...STASH_DEFAULTS, ...options, worth: { ...STASH_DEFAULTS.worth, ...(options.worth || {}) } };
  const group = new THREE.Group(); group.name = 'Stash';
  if (anchors && anchors.tubFloor) { const y = anchors.tubFloor.isVector3 ? anchors.tubFloor.y : +anchors.tubFloor; if (isFinite(y)) group.position.y = y - 0.712; }
  if (ute && ute.add) ute.add(group);
  const FAMS = families(K);

  /* ---------------------------------------------------------------- shared material and per-family instanced meshes */
  const SU = {
    uStYellow: { value: new THREE.Color().setRGB(...K.C.yellow) }, uStAmber: { value: new THREE.Color(1.0, 0.42, 0.05) },
    uStDanger: { value: new THREE.Vector4(0, 0, 0, 0) }, uStFade: { value: new THREE.Vector4(0, 9, 0, 0.3) }, uStFadeK: { value: new THREE.Vector4(0, 0.4, 0, 0.9) }
  };
  let mat;
  if (K.U && K.createWorldMaterial) mat = K.createWorldMaterial(THREE, K.U); else mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  patchStash(THREE, mat, SU, null); mat.vertexColors = true;
  const CAP = { tubBox: 40, roadCase: 16, chest: 12, slimCase: 24, cargoCase: 10, cargoPod: 8, duffel: 24, expCase: 12, aluBox: 8, softBag: 24, haulBag: 10, rollBundle: 8, tent: 4, kayak: 4, boards: 4, swags: 4, timber: 4, ladder: 4, pipe: 4, loose: 72 };
  const MESH = {}, FG = {};
  for (const [name, fam] of Object.entries(FAMS)) {
    const fg = familyGeometry(THREE, K, fam); FG[name] = { ...fg, size: fam.size, scaled: !!fam.scaled };
    const cap = CAP[name] || 8, im = new THREE.InstancedMesh(fg.geo, mat, cap);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.count = 0; im.frustumCulled = false; im.castShadow = true; im.receiveShadow = true; im.name = 'stash-' + name; im.renderOrder = 2;
    im.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3); im.instanceColor.setUsage(THREE.DynamicDrawUsage);
    const sel = new THREE.InstancedBufferAttribute(new Float32Array(cap), 1), f2 = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
    sel.setUsage(THREE.DynamicDrawUsage); f2.setUsage(THREE.DynamicDrawUsage); fg.geo.setAttribute('aSel', sel); fg.geo.setAttribute('aF2', f2);
    im.visible = false; group.add(im); MESH[name] = { im, sel, f2, cap, n: 0 };
  }
  /* loose item natives: long axis and size per type, for the staging fit */
  const LOOSE_BB = FG.loose.bb.map(b => { const sx = b.mx[0] - b.mn[0], sy = b.mx[1] - b.mn[1], sz = b.mx[2] - b.mn[2]; return { long: sx >= sz ? 'x' : 'z', L: Math.max(sx, sz), S: Math.min(sx, sz), H: sy, cx: (b.mx[0] + b.mn[0]) / 2, cz: (b.mx[2] + b.mn[2]) / 2, y0: b.mn[1] }; });
  const typeIndex = t => { const i = LOOSE_TYPES.indexOf(t); return i < 0 ? 0 : i; };

  /* strips: tie-down bands, protection corner marks, flying lids and the count digits (one unlit instanced cube) */
  const STRIP_CAP = 900;
  const strips = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), STRIP_CAP);
  strips.instanceMatrix.setUsage(THREE.DynamicDrawUsage); strips.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(STRIP_CAP * 3), 3); strips.instanceColor.setUsage(THREE.DynamicDrawUsage);
  strips.count = 0; strips.frustumCulled = false; strips.renderOrder = 3; strips.name = 'stash-strips'; group.add(strips);
  /* puffs and sparkles: soft round sprites (a generated texture, no DOM) */
  const PUFF_CAP = 96, dot = new Uint8Array(32 * 32 * 4);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const d = Math.hypot(x - 15.5, y - 15.5) / 15.5, a = Math.max(0, 1 - d * d) ** 1.4; const i = (y * 32 + x) * 4; dot[i] = dot[i + 1] = dot[i + 2] = 255; dot[i + 3] = Math.round(a * 255); }
  const dotTex = new THREE.DataTexture(dot, 32, 32, THREE.RGBAFormat); dotTex.needsUpdate = true;
  const puffs = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: dotTex, transparent: true, depthWrite: false, toneMapped: false }), PUFF_CAP);
  puffs.instanceMatrix.setUsage(THREE.DynamicDrawUsage); puffs.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PUFF_CAP * 3), 3); puffs.count = 0; puffs.frustumCulled = false; puffs.renderOrder = 4; puffs.name = 'stash-puffs'; group.add(puffs);

  /* ---------------------------------------------------------------- logic state */
  const PIVOT = { tub: RAIL, bars: 1.3712, deck: 1.554, hoops: 1.557 };
  let cfg = { ...CFG0 }, L = layout(cfg, 0), T = 0, protectedN = 0, stability = 1, uidN = 0, fullFired = false;
  const units = [], loose = [], bigs = [], dying = [];
  const occ = new Map();
  const ev = { onPack: null, onBurst: null, onLost: null, onFull: null, onMerge: null, onAbsorb: null, onTallyEnd: null };
  const fire = (k, a) => { const f = ev[k] || (options && options[k]); if (f) try { f(a); } catch (e) { /* the game's handler */ } };

  function newUnit(kind, fam, extra) {
    const u = { uid: ++uidN, kind, fam, var: 0, pieces: 0, worth: 0, slots: [], alive: true, prot: false, rest: { x: 0, y: 0, z: 0, ry: 0, sx: 1, sy: 1, sz: 1, w: 0.5, h: 0.24, d: 0.33 },
      p: { x: 0, y: 0, z: 0, ry: 0, sx: 1, sy: 1, sz: 1 }, form: null, move: null, die: null, wash: [0, 0, 0], big: null, ...extra };
    return u;
  }
  const famOfSlot = s => s.fam === 'tub' ? 'tubBox' : s.fam === 'slim' ? 'slimCase' : s.fam === 'duffel' ? 'duffel' : 'softBag';
  function restFromSlots(u) {
    if (u.kind === 'box') { const s = L.byId.get(u.slots[0]); const F = FG[u.fam], b = F.bb[u.var] || F.bb[0]; u.rest.x = s.x; u.rest.y = s.y; u.rest.z = s.z; u.rest.ry = s.rot ? Math.PI / 2 : 0; u.rest.sx = s.k || 1; u.rest.sy = 1; u.rest.sz = 1; u.rest.w = s.w; u.rest.h = s.h; u.rest.d = s.d; u.root = s.root; u.pivot = PIVOT[s.root] != null ? PIVOT[s.root] : RAIL; return; }
    const a = L.byId.get(u.slots[0]), b = L.byId.get(u.slots[1]), q = pairPose(a, b), F = FG[u.fam], nat = F.size;
    u.rest.x = q.x; u.rest.y = q.y; u.rest.z = q.z; u.rest.ry = 0; u.rest.sx = q.w / nat[0]; u.rest.sy = q.h / nat[1]; u.rest.sz = q.d / nat[2]; u.rest.w = q.w; u.rest.h = q.h; u.rest.d = q.d; u.root = a.root; u.pivot = PIVOT[a.root] != null ? PIVOT[a.root] : RAIL;
  }
  const free = s => !occ.has(s.id);
  const supported = s => s.sup.every(id => occ.has(id));
  function occupy(u) { for (const id of u.slots) occ.set(id, u); restFromSlots(u); }
  function vacate(u) { for (const id of u.slots) if (occ.get(id) === u) occ.delete(id); }
  /* the next place a box goes: first free supported slot in order; reserve slots (the hidden tailgate row under a top product) last */
  function nextSlot(allowReserve) {
    for (const s of L.slots) if (free(s) && supported(s) && (!s.reserve || allowReserve)) return s;
    return null;
  }
  function markReserve() { const top = cfg.top !== 'none'; for (const s of L.slots) s.reserve = top && s.root === 'tub' && s.tier === 1 && s.z <= -2.2 && cfg.tub !== 'slide'; }
  markReserve();
  /* protection: units bottom-up by their first slot's order; a unit is protected when all its pieces are within protectedN */
  function rank(u) { if (u.kind === 'big') return 1e9 + u.uid; let r = 1e4; for (const id of u.slots) { const s = L.byId.get(id); if (s) r = Math.min(r, s.order); } return Math.round(u.rest.y * 100) * 1e4 + r; }
  function sortedUnits() { return units.filter(u => u.alive && u.kind !== 'big').sort((a, b) => rank(a) - rank(b)); }
  function reprotect() { let cum = 0; for (const u of sortedUnits()) { cum += u.pieces; u.prot = cum <= protectedN; u.straddle = !u.prot && cum - u.pieces < protectedN; } }

  /* ---------------------------------------------------------------- consolidation: four boxes on a pair over two tiers -> a case; two stacked cases -> a trunk */
  function topOfPair(key) { const P = L.pairs.get(key); if (!P) return 0; let t = 0; for (const [tier, arr] of P) if (occ.has(arr[0].id) || occ.has(arr[1].id)) t = Math.max(t, tier); return t; }
  function findMerge() {
    let best = null, gTop = 0;
    for (const u of units) if (u.alive && u.kind !== 'big' && !u.hidden) gTop = Math.max(gTop, u.rest.y + u.rest.h);
    for (const [key, P] of L.pairs) {
      const tiers = [...P.keys()].sort((a, b) => a - b), top = topOfPair(key);
      for (const t of tiers) {
        if (!P.has(t + 1) || t + 1 !== top) continue;
        const A = P.get(t), B = P.get(t + 1), ua = occ.get(A[0].id), ub = occ.get(A[1].id), uc = occ.get(B[0].id), ud = occ.get(B[1].id);
        if (!ua || !ub || !uc || !ud) continue;
        const four = [ua, ub, uc, ud], members = [...new Set(four)], prot = members.map(u => u.prot || u.straddle);
        /* four boxes become a case; anything heavier (a case or trunk with a full tier above it) becomes a trunk */
        const kind = members.length === 4 && members.every(u => u.kind === 'box') ? 'case' : 'trunk';
        if (members.some(u => u.kind === 'big')) continue;
        /* prefer: a case over a trunk; a pair below the load's peak (the silhouette holds); unprotected; then the lowest */
        const peak = B[0].y + B[0].h >= gTop - 0.03, score = (kind === 'case' ? 1000 : 0) + (peak ? 0 : 300) - (prot.every(p => p) ? 500 : 0) - A[0].y * 10 - members.reduce((q, u) => q + u.pieces, 0) * 0.01;
        if (!best || score > best.score) best = { key, t, kind, A, B, members, score };
      }
    }
    return best;
  }
  function doMerge(m, animate = true) {
    const famCase = m.A[0].caseFam, famTrunk = m.A[0].trunkFam, fam = m.kind === 'case' ? famCase : famTrunk;
    const u = newUnit(m.kind, fam, { slots: [m.A[0].id, m.A[1].id] });
    for (const q of m.members) { u.pieces += q.pieces; u.worth += q.worth; q.alive = false; vacate(q); const i = units.indexOf(q); if (i >= 0) units.splice(i, 1); }
    units.push(u); occupy(u); reprotect();
    if (animate) {
      for (const q of m.members) { q.die = { type: 'merge', t0: T, dur: 0.32, tx: u.rest.x, ty: u.rest.y + u.rest.h * 0.5, tz: u.rest.z }; dying.push(q); }
      u.form = { t0: T + 0.3, dur: m.kind === 'case' ? 0.55 : 0.7, big: m.kind === 'case' ? 1.4 : 1.8 };
      later(0.3, () => { fire('onMerge', { kind: m.kind, pieces: u.pieces, worth: u.worth, from: m.members.length, position: new THREE.Vector3(u.rest.x, u.rest.y + u.rest.h, u.rest.z) }); popText('+' + u.worth, u.rest.x, u.rest.y + u.rest.h + 0.1, u.rest.z, m.kind === 'case' ? 0.26 : 0.32, 1.1); burstPuffs(u.rest.x, u.rest.y, u.rest.z, u.rest.w, u.rest.d, m.kind === 'case' ? 14 : 18, true); washUnit(u, 0.75); });
    } else u.form = null;
    return u;
  }
  /* make sure the next box has a place: merge when the composed load is full; then the reserve row; then absorb */
  function ensureRoom(animate = true) {
    if (nextSlot(false)) return true;
    if (!fullFired) { fullFired = true; fire('onFull', { height: height(), pieces: count() }); }
    const m = findMerge(); if (m) { doMerge(m, animate); return true; }
    return !!nextSlot(true);
  }
  function absorbTarget() { let best = null; for (const u of sortedUnits()) if (!u.prot && (u.kind === 'trunk' || u.kind === 'case')) best = !best || u.kind === 'trunk' && best.kind !== 'trunk' || u.rest.y >= best.rest.y && u.kind === best.kind ? u : best; return best || sortedUnits().slice(-1)[0] || null; }

  /* ---------------------------------------------------------------- items (visual only): staged, flying, spilling, lost */
  const ITEM_CAP = 72, items = [];
  for (let i = 0; i < ITEM_CAP; i++) items.push({ on: false, type: 0, st: '', t0: 0, dur: 0, p: { x: 0, y: 0, z: 0 }, a: { x: 0, y: 0, z: 0 }, b: { x: 0, y: 0, z: 0 }, v: { x: 0, y: 0, z: 0 }, ry: 0, rx: 0, rz: 0, wx: 0, wz: 0, s: 1, s0: 1, s1: 1, arc: 0.4, k: 0, ry0: 0, ry1: 0, next: '' });
  const getItem = () => { for (const it of items) if (!it.on) { it.on = true; it.rx = it.rz = it.wx = it.wz = 0; it.packTo = null; it.tallied = 0; return it; } return null; };
  let stagedVis = [];
  /* staging pose for loose item i (0..4) on the next slot: three side by side, two on top, long axes across the slot's long side */
  const SP = { x: 0, y: 0, z: 0, ry: 0, s: 1 };
  function stagePose(i, type, out = SP) {
    const s = nextSlot(false) || nextSlot(true);
    if (!s) { const u = absorbTarget(); out.x = u ? u.rest.x : 0; out.y = u ? u.rest.y + u.rest.h : RAIL; out.z = u ? u.rest.z : -1.8; out.ry = 0; out.s = 0.001; return out; }
    const nb = LOOSE_BB[typeIndex(type)], long = Math.max(s.w, s.d), short = Math.min(s.w, s.d), alongX = s.w >= s.d;
    let cellA, cellB, cellH, ca, cb, cy;
    if (long > 0.8) { cellA = long / 5 - 0.012; cellB = short - 0.01; cellH = s.h - 0.01; ca = -long / 2 + (i + 0.5) * long / 5; cb = 0; cy = 0; }
    else { const top = i >= 3, col = top ? i - 3 : i; cellA = long / 3 - 0.012; cellB = short - 0.01; cellH = s.h / 2 - 0.006; ca = top ? (col - 0.5) * long / 3 : (col - 1) * long / 3; cb = 0; cy = top ? s.h / 2 : 0; }
    const sc = Math.min(cellA / nb.S, cellB / nb.L, cellH / nb.H);
    out.s = sc; out.y = s.y + cy - nb.y0 * sc + 0.002;
    const itemLongAlongX = nb.long === 'x', wantAlongX = !alongX;
    out.ry = itemLongAlongX === wantAlongX ? 0 : Math.PI / 2;
    const cx = nb.cx * sc, cz = nb.cz * sc, rcx = out.ry ? cz : cx, rcz = out.ry ? -cx : cz;
    if (alongX) { out.x = s.x + ca - rcx; out.z = s.z + cb - rcz; } else { out.x = s.x + cb - rcx; out.z = s.z + ca - rcz; }
    return out;
  }
  function restage(hop = 0.25) {
    stagedVis = stagedVis.filter(it => it.on);
    stagedVis.forEach((it, i) => { if (it.st === 'arrive' || it.st === 'staged' || it.st === 'hop') { stagePose(i, LOOSE_TYPES[it.type]); flyItem(it, SP, hop, 0.18, it.st === 'arrive' ? 'arrive' : 'hop'); } });
  }
  function flyItem(it, to, dur, arc, st) {
    it.a.x = it.p.x; it.a.y = it.p.y; it.a.z = it.p.z; it.b.x = to.x; it.b.y = to.y; it.b.z = to.z; it.s0 = it.s; it.s1 = to.s; it.ry0 = it.ry; it.ry1 = to.ry;
    it.t0 = T; it.dur = dur; it.arc = arc; it.st = st || 'arrive';
  }

  /* ---------------------------------------------------------------- deferred calls (no timers: run in update) */
  const LATER = [];
  function later(dt, fn) { LATER.push({ at: T + dt, fn }); }

  /* ---------------------------------------------------------------- adding */
  const DEF_FROM = { x: 0, y: 2.6, z: -4.2, s: 0.9 };
  function addLoose(type, opts = {}) {
    const instant = !!opts.instant, worth = opts.worth || O.worth[type] || 1;
    if (!ensureRoom(!instant)) { const u = absorbTarget(); if (u) { u.pieces += 1; u.worth += worth; if (!instant) { popText('+' + worth, u.rest.x, u.rest.y + u.rest.h + 0.08, u.rest.z, 0.14, 0.6); washUnit(u, 0.4); fire('onAbsorb', { pieces: 1, worth, into: u.kind }); } } return; }
    loose.push({ type, worth });
    if (!instant) {
      const it = getItem();
      if (it) { it.type = typeIndex(type); const f = opts.from || DEF_FROM; it.p.x = f.x; it.p.y = f.y; it.p.z = f.z; it.s = opts.fromScale || f.s || 0.9; it.ry = 0; stagedVis.push(it); stagePose(stagedVis.length - 1, type); flyItem(it, SP, opts.flight || 0.34, 0.55, 'arrive'); it.rx = 0; it.wx = (Math.random() - 0.5) * 6; it.wz = (Math.random() - 0.5) * 4; }
    }
    if (loose.length >= O.pack) pack(instant);
    else if (instant) syncStagedInstant();
  }
  function pack(instant) {
    const s = nextSlot(false) || nextSlot(true); if (!s) return;
    const box = newUnit('box', famOfSlot(s), { slots: [s.id], var: s.v % (s.fam === 'tub' ? 4 : 3) });
    for (const q of loose.splice(0, O.pack)) { box.pieces += 1; box.worth += q.worth; }
    units.push(box); occupy(box); reprotect();
    const vis = stagedVis.splice(0, O.pack);
    if (instant) { for (const it of vis) it.on = false; box.form = null; ensureRoom(false); syncStagedInstant(); return; }
    const wait = vis.length ? Math.max(0, ...vis.map(it => it.st === 'arrive' ? it.t0 + it.dur - T : 0)) : 0;
    box.form = { t0: T + wait + 0.26, dur: 0.46, big: 1, hidden: true };
    for (const it of vis) { it.packAt = T + wait; it.packTo = { x: box.rest.x, y: box.rest.y + box.rest.h * 0.45, z: box.rest.z }; }
    later(wait + 0.26, () => {
      fire('onPack', { pieces: box.pieces, worth: box.worth, position: new THREE.Vector3(box.rest.x, box.rest.y + box.rest.h, box.rest.z) });
      popText('+' + box.worth, box.rest.x, box.rest.y + box.rest.h + 0.08, box.rest.z, 0.17, 0.85);
      burstPuffs(box.rest.x, box.rest.y, box.rest.z, box.rest.w, box.rest.d, 8, true);
      if (ensureRoom(true)) restage(0.3);
    });
  }
  function syncStagedInstant() {
    for (const it of stagedVis) it.on = false; stagedVis = [];
    loose.forEach((q, i) => { const it = getItem(); if (!it) return; it.type = typeIndex(q.type); stagePose(i, q.type); it.p.x = SP.x; it.p.y = SP.y; it.p.z = SP.z; it.s = SP.s; it.ry = SP.ry; it.st = 'staged'; stagedVis.push(it); });
  }
  function addBig(type, opts = {}) {
    const B = BIG[type] || { fam: 'boards', long: true }, worth = opts.worth || O.worth[type] || 3;
    const u = newUnit('big', B.fam, { pieces: 0, worth, big: { type, long: B.long }, prot: true });
    const apply = () => { bigs.push(u); units.push(u); relayout(); };
    if (opts.instant || fit) { if (fit) finishFit(); apply(); return u; }
    choreograph(apply, { duration: 1.1, auto: true });
    later(0.75, () => { if (u.hidden) return; popText('+' + worth, u.rest.x, u.rest.y + u.rest.h + 0.12, u.rest.z, 0.22, 1.0); burstPuffs(u.rest.x, u.rest.y, u.rest.z, u.rest.w, u.rest.d, 10, true); });
    return u;
  }
  /* big lanes: round robin, stacked; short loads on a long-only lane need a long load under them; above MAX_TOP the unit is
     absorbed into the lane's top load (its worth counts, nothing new shows) */
  function placeBigs() {
    const lanes = L.lanes, stack = lanes.map(() => []);
    for (const u of bigs) { u.alive = true; u.hidden = false; }
    if (!lanes.length) { for (const u of bigs) { u.hidden = true; } return; }
    let li = 0;
    for (const u of bigs) {
      const sz = BIG_SIZE[u.fam]; let placed = false;
      for (let k = 0; k < lanes.length && !placed; k++) {
        const j = (li + k) % lanes.length, ln = lanes[j], st = stack[j], below = st[st.length - 1];
        if (!u.big.long && ln.longOnly && !below) continue;
        const sc = Math.min(1, ln.maxW / sz[0]), h = sz[1] * sc, d = sz[2] * sc, y = below ? below.rest.y + below.rest.h + 0.004 : ln.y;
        if (y + h > MAX_TOP) continue;
        const z = u.big.long ? ln.front - d / 2 : (below ? below.rest.z : ln.zShort);
        Object.assign(u.rest, { x: ln.x, y, z, ry: 0, sx: sc, sy: sc, sz: sc, w: sz[0] * sc, h, d }); u.root = 'lane' + j; u.lane = j; u.pivot = ln.y;
        st.push(u); placed = true; li = (j + 1) % lanes.length;
      }
      if (!placed) { u.hidden = true; }
    }
  }

  /* ---------------------------------------------------------------- re-layout (configure, fits, big units arriving) */
  function relayout() {
    const bigOn = bigs.length > 0 && cfg.top !== 'none' && cfg.top !== 'bars';
    L = layout(cfg, bigOn ? bigs.length : 0); markReserve(); occ.clear();
    const keep = [], displaced = [];
    for (const u of units) { if (!u.alive || u.kind === 'big') continue; if (u.slots.every(id => L.byId.has(id))) keep.push(u); else displaced.push(u); }
    let changed = true;
    for (const u of keep) for (const id of u.slots) occ.set(id, u);
    while (changed) { changed = false; for (const u of keep.slice()) { if (u.slots.some(id => !supported(L.byId.get(id)))) { for (const id of u.slots) occ.delete(id); keep.splice(keep.indexOf(u), 1); displaced.push(u); changed = true; } } }
    for (const u of keep) restFromSlots(u);
    const order = { trunk: 0, case: 1, box: 2 };
    displaced.sort((a, b) => order[a.kind] - order[b.kind] || a.rest.y - b.rest.y);
    /* displaced boxes: the places they will fill are the next free ones in order; each goes to the nearest of them (no crossings) */
    const dBoxes = displaced.filter(u => u.kind === 'box'), targets = [], PH = { ph: true };
    for (let i = 0; i < dBoxes.length; i++) { const s = nextSlot(false) || (cfg.top === 'none' ? nextSlot(true) : null); if (!s) break; targets.push(s); occ.set(s.id, PH); }
    for (const s of targets) occ.delete(s.id);
    const pairs = []; for (const u of dBoxes) for (const s of targets) pairs.push([Math.hypot(u.rest.x - s.x, (u.rest.y - s.y) * 1.5, u.rest.z - s.z), u, s]);
    pairs.sort((a, b) => a[0] - b[0]);
    const took = new Set(), got = new Map();
    for (const [, u, s2] of pairs) { if (got.has(u) || took.has(s2)) continue; got.set(u, s2); took.add(s2); }
    for (const u of dBoxes) { const s2 = got.get(u); if (!s2) continue; u.slots = [s2.id]; u.fam = famOfSlot(s2); if (u.fam !== 'tubBox') u.var = u.var % 3; occupy(u); }
    for (const u of displaced) {
      let ok = false;
      if (u.kind === 'box' && got.has(u)) continue;
      if (u.kind === 'box') { let s = nextSlot(false); if (!s) { const mg = findMerge(); if (mg) { doMerge(mg, false); s = nextSlot(false); } } if (!s && cfg.top === 'none') s = nextSlot(true); if (s) { u.slots = [s.id]; u.fam = famOfSlot(s); if (u.fam !== 'tubBox') u.var = u.var % 3; occupy(u); ok = true; } }
      else {
        for (const s of L.slots) { if (!s.pair || s.side !== 0) continue; const P = L.pairs.get(s.pair), arr = P && P.get(s.tier); if (!arr) continue; if (free(arr[0]) && free(arr[1]) && supported(arr[0]) && supported(arr[1])) { u.slots = [arr[0].id, arr[1].id]; u.fam = u.kind === 'case' ? arr[0].caseFam : arr[0].trunkFam; occupy(u); ok = true; break; } }
        if (!ok) {
          /* no pair free: the case opens back into boxes, placed one by one (consolidating elsewhere if needed) */
          const n = Math.floor(u.pieces / O.pack), per = u.worth / Math.max(1, u.pieces);
          u.alive = false; units.splice(units.indexOf(u), 1);
          for (let i = 0; i < n; i++) { if (!ensureRoom(false)) { const t = absorbTarget(); if (t) { t.pieces += O.pack; t.worth += per * O.pack; } continue; } const s = nextSlot(false) || nextSlot(true); const b = newUnit('box', famOfSlot(s), { slots: [s.id], pieces: O.pack, worth: Math.round(per * O.pack), var: s.v % 4 }); units.push(b); occupy(b); b.p.x = u.rest.x; b.p.y = u.rest.y; b.p.z = u.rest.z; b.fromDisplaced = true; }
          const rem = u.pieces - n * O.pack; for (let i = 0; i < rem; i++) loose.push({ type: 'swag', worth: 1 });
          ok = true;
        }
      }
      if (!ok) { const t = absorbTarget(); if (t && t !== u) { t.pieces += u.pieces; t.worth += u.worth; } u.alive = false; units.splice(units.indexOf(u), 1); }
    }
    placeBigs(); reprotect();
    ensureRoom(false);
    while (loose.length >= O.pack) pack(true);
  }
  function configure(c) { cfg = { ...cfg, ...c }; relayout(); syncStagedInstant(); snapAll(); }
  function snapAll() { for (const u of units) { u.move = null; u.form = null; Object.assign(u.p, { x: u.rest.x, y: u.rest.y, z: u.rest.z, ry: u.rest.ry, sx: u.rest.sx, sy: u.rest.sy, sz: u.rest.sz }); } for (const u of dying) u.dieDone = true; dying.length = 0; }

  /* ---------------------------------------------------------------- losing */
  let lastLat = 0;
  function lose(n, opts = {}) {
    finishFit();
    let rem = Math.max(0, Math.floor(n)), lost = 0;
    const dir = opts.dir || (Math.abs(lastLat) > 1.5 ? (lastLat > 0 ? 'right' : 'left') : 'back');
    const spill = [];
    while (rem > 0 && loose.length) {
      const q = loose.pop(); rem--; lost++;
      const it = stagedVis.pop(); if (it) { it.st = ''; spill.push({ it, lost: true }); }
    }
    while (rem > 0) {
      const cand = sortedUnits().filter(u => !u.prot).sort((a, b) => (a.rest.y + a.rest.h) - (b.rest.y + b.rest.h) || rank(a) - rank(b)); const u = cand[cand.length - 1]; if (!u) break;
      let cum = 0; for (const q of sortedUnits()) { if (q === u) break; cum += q.pieces; }
      const free = Math.max(0, u.pieces - Math.max(0, protectedN - cum)); if (!free) break;
      const take = Math.min(rem, free), keepN = u.pieces - take, per = u.worth / Math.max(1, u.pieces);
      rem -= take; lost += take; u.alive = false; vacate(u); units.splice(units.indexOf(u), 1);
      u.die = { type: 'burst', t0: T, dur: 0.16 }; dying.push(u);
      fire('onBurst', { kind: u.kind, lost: take, survivors: keepN, position: new THREE.Vector3(u.rest.x, u.rest.y + u.rest.h, u.rest.z) });
      lidFly(u, dir); burstPuffs(u.rest.x, u.rest.y + u.rest.h * 0.5, u.rest.z, u.rest.w, u.rest.d, 10, false);
      const cx = u.rest.x, cy = u.rest.y + u.rest.h * 0.5, cz = u.rest.z, shown = Math.min(take, 8);
      for (let i = 0; i < shown; i++) { const it = getItem(); if (!it) break; it.type = (u.uid + i) % 4; it.p.x = cx + (Math.random() - 0.5) * u.rest.w * 0.6; it.p.y = cy; it.p.z = cz + (Math.random() - 0.5) * u.rest.d * 0.6; it.s = 0.36; it.ry = Math.random() * 6; spill.push({ it, lost: true }); }
      /* survivors: whole boxes go back into places (packing again), the rest become loose items */
      const nb = Math.floor(keepN / O.pack), nl = keepN - nb * O.pack;
      reprotect();
      for (let i = 0; i < nb; i++) { if (!ensureRoom(true)) break; const s = nextSlot(false) || nextSlot(true); const b = newUnit('box', famOfSlot(s), { slots: [s.id], pieces: O.pack, worth: Math.round(per * O.pack), var: s.fam === 'tub' ? s.v : s.v % 3 }); units.push(b); occupy(b); b.form = { t0: T + 0.35 + i * 0.08, dur: 0.4, big: 0.8, from: { x: cx, y: cy, z: cz } }; }
      for (let i = 0; i < nl; i++) { loose.push({ type: LOOSE_TYPES[(u.uid + i) % 4], worth: 1 }); const it = getItem(); if (!it) continue; it.type = (u.uid + i) % 4; it.p.x = cx; it.p.y = cy; it.p.z = cz; it.s = 0.34; it.ry = 0; stagedVis.push(it); }
      reprotect();
      if (rem <= 0) break;
    }
    /* spilled lost items: arcs off the outside of the turn or off the back, then they lie on the road for a moment */
    for (const { it } of spill) {
      const side = dir === 'left' ? 1 : dir === 'right' ? -1 : 0, spread = (Math.random() - 0.5);
      it.st = 'lost'; it.t0 = T; it.v.x = side ? side * (2.4 + Math.random() * 1.2) : spread * 1.6; it.v.y = 2.2 + Math.random() * 1.4; it.v.z = side ? -0.6 - Math.random() : -(2.6 + Math.random() * 1.4);
      it.wx = (Math.random() - 0.5) * 14; it.wz = (Math.random() - 0.5) * 10; it.s = Math.max(it.s, 0.42);
    }
    stagedVis.forEach((it, i) => { stagePose(i, LOOSE_TYPES[it.type]); flyItem(it, SP, 0.42, 0.5, 'hop'); });
    if (lost) fire('onLost', { count: lost, dir });
    return lost;
  }

  /* ---------------------------------------------------------------- effects: puffs, digits, lids, wash */
  const PUFF = []; for (let i = 0; i < PUFF_CAP; i++) PUFF.push({ on: false, t0: 0, life: 0.6, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 0.2, r: 0, g: 0, b: 0 });
  function puff(x, y, z, vx, vy, vz, s, life, col) { const p = PUFF.find(q => !q.on); if (!p) return; Object.assign(p, { on: true, t0: T, life, x, y, z, vx, vy, vz, s }); p.r = col[0]; p.g = col[1]; p.b = col[2]; }
  const DUST = [0.86, 0.66, 0.48], SPARK = [1.0, 0.93, 0.62];
  function burstPuffs(x, y, z, w, d, n, sparkle) {
    for (let i = 0; i < n; i++) { const a = i / n * TAU, c = Math.cos(a), s = Math.sin(a); puff(x + c * w * 0.5, y + 0.03, z + s * d * 0.5, c * 0.7, 0.25 + Math.random() * 0.2, s * 0.7, 0.14 + Math.random() * 0.06, 0.55, DUST); }
    if (sparkle) for (let i = 0; i < Math.ceil(n * 0.6); i++) puff(x + (Math.random() - 0.5) * w, y + 0.2 + Math.random() * 0.25, z + (Math.random() - 0.5) * d, 0, 0.6 + Math.random() * 0.4, 0, 0.05 + Math.random() * 0.03, 0.5, SPARK);
  }
  const POPS = []; for (let i = 0; i < 24; i++) POPS.push({ on: false, txt: '', x: 0, y: 0, z: 0, t0: 0, life: 1, size: 0.18 });
  function popText(txt, x, y, z, size, life) { const p = POPS.find(q => !q.on) || POPS[0]; Object.assign(p, { on: true, txt: String(txt).slice(0, 5), x, y, z, t0: T, life, size }); }
  const LIDS = []; for (let i = 0; i < 10; i++) LIDS.push({ on: false, t0: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, w: 0.5, d: 0.33, r: 0, rv: 0, col: [0.1, 0.1, 0.1] });
  function lidFly(u, dir) {
    const l = LIDS.find(q => !q.on); if (!l) return; const side = dir === 'left' ? 1 : dir === 'right' ? -1 : 0;
    Object.assign(l, { on: true, t0: T, x: u.rest.x, y: u.rest.y + u.rest.h, z: u.rest.z, vx: side * 1.6 + (Math.random() - 0.5) * 0.6, vy: 3.2, vz: side ? -0.4 : -1.6, w: u.rest.w * 0.98, d: u.rest.d * 0.98, r: 0, rv: (Math.random() < 0.5 ? -1 : 1) * 9 });
    const c = u.fam === 'tubBox' ? [0.04, 0.04, 0.045] : u.fam === 'slimCase' ? [0.06, 0.06, 0.07] : [0.18, 0.2, 0.12]; l.col = c;
  }
  function washUnit(u, k) { u.washT0 = T; u.washK = k; }

  /* ---------------------------------------------------------------- tally: bottom to top, a yellow wash sweeps up each unit */
  let tallyS = null;
  function tally(onStep, opts = {}) {
    const list = units.filter(u => u.alive && !u.hidden).sort((a, b) => (a.rest.y - b.rest.y) || (a.rest.z - b.rest.z) || (a.rest.x - b.rest.x));
    const steps = list.map(u => ({ u, kind: u.kind, value: u.kind === 'box' || u.kind === 'case' || u.kind === 'trunk' || u.kind === 'big' ? u.worth : 1 }));
    stagedVis.forEach((it, i) => steps.push({ it, kind: 'loose', value: loose[i] ? loose[i].worth : 1 }));
    const n = steps.length, dt = opts.step || clamp(1.8 / Math.max(1, n), 0.07, 0.16);
    tallyS = { steps, i: 0, t0: T + (opts.delay || 0), dt, onStep, total: 0, end: T + (opts.delay || 0) + n * dt + 0.9 };
    for (const u of units) { u.washT0 = -9; u.glow = 0; }
    return { steps: n, duration: n * dt + 0.9, step: dt };
  }
  function tallyStep() {
    if (!tallyS) return;
    while (tallyS.i < tallyS.steps.length && T >= tallyS.t0 + tallyS.i * tallyS.dt) {
      const st = tallyS.steps[tallyS.i]; tallyS.total += st.value;
      let x, y, z; if (st.u) { washUnit(st.u, 0.85); st.u.tallied = T; x = st.u.rest.x; y = st.u.rest.y + st.u.rest.h; z = st.u.rest.z; } else { st.it.tallied = T; x = st.it.p.x; y = st.it.p.y + 0.12; z = st.it.p.z; }
      popText('+' + st.value, x, y + 0.08, z, st.kind === 'loose' ? 0.12 : st.kind === 'box' ? 0.16 : 0.22, 0.75);
      if (tallyS.onStep) try { tallyS.onStep({ index: tallyS.i, count: tallyS.steps.length, kind: st.kind, value: st.value, total: tallyS.total, position: new THREE.Vector3(x, y, z) }); } catch (e) { /* the game's handler */ }
      tallyS.i++;
    }
    if (T > tallyS.end) { tallyS = null; for (const u of units) u.tallied = 0; fire('onTallyEnd', {}); }
  }

  /* ---------------------------------------------------------------- the fit choreography */
  let fit = null;
  function poseOf(u) { const r = u.rest; return { x: r.x, y: r.y, z: r.z, ry: r.ry, sx: r.sx, sy: r.sy, sz: r.sz, fam: u.fam, var: u.var }; }
  /* the axis-aligned footprint of a family at a rotation and scale */
  function dimsOf(fam, ry, sx, sy, sz, out) {
    const N = FG[fam] ? FG[fam].size : [0.5, 0.24, 0.33], w0 = N[0] * sx, d0 = N[2] * sz, c = Math.abs(Math.cos(ry)), s2 = Math.abs(Math.sin(ry));
    out.w = c * w0 + s2 * d0; out.d = s2 * w0 + c * d0; out.h = N[1] * sy; return out;
  }
  const DIM = { w: 0, h: 0, d: 0 };
  function beginFit(product, fopts = {}) {
    const slot = PRODUCT_OF[product]; if (!slot) return null;
    return choreograph(() => { cfg = { ...cfg, [slot]: product }; relayout(); }, { ...fopts, product, slot });
  }
  /* a re-arrangement with motion: apply() changes the logic; every unit whose place changed lifts, the product (if any) arrives,
     then the units land in their new places, lowest first; hover heights are raised until no two boxes ever overlap */
  function choreograph(apply, fopts = {}) {
    const product = fopts.product || null, slot = fopts.slot || null;
    finishFit();
    const before = new Map(); for (const u of units) if (u.alive) before.set(u, poseOf(u));
    const itemsBefore = stagedVis.map(it => ({ x: it.p.x, y: it.p.y, z: it.p.z }));
    apply();
    /* timing in seconds: lift 0..0.35, the product arrives, then the movers land one by one, lowest first */
    const keep = keepFor(cfg), prodKeep = product ? keepFor({ tub: slot === 'tub' ? product : 'none', cover: slot === 'cover' ? product : 'none', top: slot === 'top' ? product : 'none' }) : [];
    const kind = product === 'slide' ? 'slide' : 'drop', drop = 0.35, pt0s = product ? 0.36 : 0, pt1s = product ? 0.95 : 0;
    const S0 = product ? pt1s + 0.04 : 0.36, DUR = 0.32, STG = 0.07;
    const movers = [], statics = [];
    for (const u of units) {
      if (!u.alive || u.hidden) continue; const b = before.get(u);
      if (!b) { movers.push({ u, from: { ...poseOf(u) }, fresh: true }); continue; }
      const d = Math.abs(b.x - u.rest.x) + Math.abs(b.y - u.rest.y) + Math.abs(b.z - u.rest.z) + Math.abs(b.ry - u.rest.ry) + Math.abs(b.sx - u.rest.sx) + Math.abs(b.sz - u.rest.sz);
      if (d > 0.002 || b.fam !== u.fam) movers.push({ u, from: b, famFrom: b.fam !== u.fam ? b.fam : null, varFrom: b.var }); else statics.push(u);
    }
    /* units in the way of the arriving product also lift and come back */
    const hitsBox = (x0, x1, y0, y1, z0, z1, k) => !(x1 <= k[0] || x0 >= k[1] || y1 <= k[2] || y0 >= k[3] || z1 <= k[4] || z0 >= k[5]);
    for (const u of statics.slice()) { const r = u.rest; for (const k of prodKeep) { const kk = kind === 'slide' ? [k[0], k[1], k[2], k[3], -3.6, k[5]] : [k[0], k[1], k[2], k[3] + drop, k[4], k[5]]; if (hitsBox(r.x - r.w / 2, r.x + r.w / 2, r.y, r.y + r.h, r.z - r.d / 2, r.z + r.d / 2, kk)) { statics.splice(statics.indexOf(u), 1); movers.push({ u, from: poseOf(u) }); break; } } }
    /* the MT Slide: the whole tub load lifts as one so the tray can glide in under it */
    if (product === 'slide') for (const u of statics.slice()) if (u.root === 'tub') { statics.splice(statics.indexOf(u), 1); movers.push({ u, from: poseOf(u) }); }
    const staticTop = (x0, x1, z0, z1) => { let t = 0; for (const u of statics) { const r = u.rest; if (r.x + r.w / 2 > x0 && r.x - r.w / 2 < x1 && r.z + r.d / 2 > z0 && r.z - r.d / 2 < z1) t = Math.max(t, r.y + r.h); } for (const k of keep) if (k[1] > x0 && k[0] < x1 && k[5] > z0 && k[4] < z1) t = Math.max(t, k[3] + (prodKeep.includes(k) && kind === 'drop' ? drop : 0)); return t; };
    for (const m of movers) {
      const a = m.from, r = m.u.rest, wa = Math.max(r.w, r.d) / 2 + 0.05;
      const x0 = Math.min(a.x, r.x) - wa, x1 = Math.max(a.x, r.x) + wa, z0 = Math.min(a.z, r.z) - wa, z1 = Math.max(a.z, r.z) + wa;
      if (kind === 'slide' && m.u.root === 'tub' && !m.fresh) m.h = Math.max(a.y + 0.2, 0.905 + (a.y - 0.729), r.y + 0.02);
      else m.h = Math.max(a.y + 0.14, staticTop(x0, x1, z0, z1) + 0.03, r.y + 0.02, RAIL + 0.04, m.fresh ? r.y + 0.5 : 0);
    }
    const column = m0 => { for (const m of movers) if (m !== m0 && m.from.y > m0.from.y && Math.abs(m.from.x - m0.from.x) < 0.3 && Math.abs(m.from.z - m0.from.z) < 0.3) m.h = Math.max(m.h, m0.h + (m.from.y - m0.from.y)); };
    movers.sort((a, b) => a.from.y - b.from.y); for (const m of movers) column(m);
    movers.sort((a, b) => (a.fresh ? 1 : 0) - (b.fresh ? 1 : 0) || a.u.rest.y - b.u.rest.y || a.u.rest.z - b.u.rest.z);
    const n = movers.length;
    movers.forEach((m, i) => { m.s = S0 + i * STG; m.d = DUR; });
    const planN = n;
    /* sampled check: a mover in motion that meets a hovering one rises over it; two in motion: the later waits; a mover landing
       into a column another still hovers over waits until that one has moved on */
    const box = (m, t, out) => { evalMover(m, t, out); dimsOf(out.fam, out.ry, out.sx, out.sy, out.sz, DIM); out.x0 = out.x - DIM.w / 2; out.x1 = out.x + DIM.w / 2; out.z0 = out.z - DIM.d / 2; out.z1 = out.z + DIM.d / 2; out.y1 = out.y + DIM.h; return out; };
    const hit = (A, B) => A.x1 - 0.004 > B.x0 && A.x0 + 0.004 < B.x1 && A.z1 - 0.004 > B.z0 && A.z0 + 0.004 < B.z1 && A.y1 - 0.004 > B.y && A.y + 0.004 < B.y1;
    const SB = {}; const statBox = r => { SB.x0 = r.x - r.w / 2; SB.x1 = r.x + r.w / 2; SB.z0 = r.z - r.d / 2; SB.z1 = r.z + r.d / 2; SB.y = r.y; SB.y1 = r.y + r.h; return SB; };
    const A = {}, Bx = {}; let conflicts = 0;
    for (let it = 0; it < 80; it++) {
      let fixed = false; const end = Math.max(...movers.map(m => m.s + m.d), 0.5);
      for (let t = 0; t <= end + 0.001 && !fixed; t += 1 / 40) {
        for (let i = 0; i < n && !fixed; i++) {
          const mi = movers[i]; box(mi, t, A); const inI = t >= mi.s && t <= mi.s + mi.d;
          for (let j = i + 1; j < n && !fixed; j++) {
            const mj = movers[j]; box(mj, t, Bx); if (!hit(A, Bx)) continue;
            const inJ = t >= mj.s && t <= mj.s + mj.d, hovI = t < mi.s, hovJ = t < mj.s;
            const topOf = m => m.h + m.u.rest.h + 0.03;
            if (inI && inJ) { const late = mi.s >= mj.s ? mi : mj, early = late === mi ? mj : mi; late.s = early.s + early.d + 0.01; }
            else if (inI && hovJ) { mj.h = Math.max(mj.h + 0.02, topOf(mi)); column(mj); }
            else if (inJ && hovI) { mi.h = Math.max(mi.h + 0.02, topOf(mj)); column(mi); }
            else if (inI) { mi.h += Bx.y1 - A.y + 0.03; column(mi); }
            else if (inJ) { mj.h += A.y1 - Bx.y + 0.03; column(mj); }
            else { const up = mi.from.y >= mj.from.y ? mi : mj, lo = up === mi ? Bx : A, me = up === mi ? A : Bx; up.h += lo.y1 - me.y + 0.03; column(up); }
            fixed = true;
          }
          if (fixed) break;
          for (const u of statics) { if (!hit(A, statBox(u.rest))) continue; if (inI || hovI) { mi.h += SB.y1 - A.y + 0.03; column(mi); fixed = true; } else conflicts++; break; }
        }
      }
      if (!fixed) break;
      for (const m of movers) m.h = Math.min(m.h, 2.7);
      if (it === 79) conflicts++;
    }
    const bobs = [];
    if (product) {
      const byTop = statics.slice().sort((a, b) => (b.rest.y + b.rest.h) - (a.rest.y + a.rest.h));
      const over = (a, b) => Math.min(a.x + a.w / 2, b.x + b.w / 2) - Math.max(a.x - a.w / 2, b.x - b.w / 2) > 0.005 && Math.min(a.z + a.d / 2, b.z + b.d / 2) - Math.max(a.z - a.d / 2, b.z - b.d / 2) > 0.005;
      const amp = new Map(), t0 = new Map();
      for (const u of byTop) {
        const r = u.rest, top = r.y + r.h; let a = u.kind === 'big' ? 0.1 : 0.2, tt = pt0s + 0.05 + clamp((-1.1 - r.z) / 1.4, 0, 1) * 0.12;
        for (const k of keep) if (k[1] > r.x - r.w / 2 && k[0] < r.x + r.w / 2 && k[5] > r.z - r.d / 2 && k[4] < r.z + r.d / 2 && k[2] >= top - 0.002) a = Math.min(a, k[2] - top - 0.015);
        for (const q of byTop) { if (q === u || !amp.has(q)) continue; const rq = q.rest; if (rq.y >= top - 0.002 && over(r, rq)) { a = Math.min(a, amp.get(q) + (rq.y - top) - 0.004); tt = t0.get(q); } }
        for (const m of movers) { const f = m.from; if (m.bob || f.y < top - 0.002) continue; dimsOf(f.fam || m.u.fam, f.ry, f.sx, f.sy, f.sz, DIM); if (over(r, { x: f.x, z: f.z, w: DIM.w, d: DIM.d })) a = Math.min(a, m.h - top - 0.02); }
        amp.set(u, Math.max(0, a)); t0.set(u, tt);
      }
      for (const u of statics) { const a = amp.get(u); if (a > 0.015) { const m = { u, from: poseOf(u), bob: true, amp: a, b0: t0.get(u), bd: 0.42, s: 1e9, d: 0, h: u.rest.y }; bobs.push(m); } }
    }
    for (const m of bobs) { movers.push(m); statics.splice(statics.indexOf(m.u), 1); }
    const D = Math.max(1.2, Math.max(0, ...movers.filter(m => !m.bob).map(m => m.s + m.d)) + 0.08, pt1s + 0.2, ...bobs.map(m => m.b0 + m.bd + 0.05));
    const pt0 = pt0s / D, pt1 = pt1s / D;
    for (const m of movers) m.u.move = m;
    fit = { product, D, t: 0, movers, statics, kind, pt0, pt1, drop, items: itemsBefore, auto: !!fopts.auto, conflicts, solidWas: null, hover: Math.max(0, ...movers.map(m => m.h + m.u.rest.h)) };
    stagedVis.forEach((it, i) => { stagePose(i, LOOSE_TYPES[it.type]); it.a.x = it.p.x; it.a.y = it.p.y; it.a.z = it.p.z; it.b.x = SP.x; it.b.y = SP.y; it.b.z = SP.z; it.s1 = SP.s; it.ry1 = SP.ry; it.st = 'fit'; it.hh = Math.max(...movers.map(m => m.h + m.u.rest.h), it.p.y) + 0.12; });
    const api = {
      duration: D, product: { kind, t0: pt0, t1: pt1, drop }, movers: n, bobs: bobs.length, conflicts, hover: fit.hover,
      update(t01) { if (fit) { fit.t = clamp(t01, 0, 1); if (fit.t >= 1) finishFit(); } },
      end() { finishFit(); }
    };
    fit.api = api; api.debug = movers.map(m => ({ fam: m.u.fam, from: [m.from.x, m.from.y, m.from.z].map(v => +v.toFixed(2)), to: [m.u.rest.x, m.u.rest.y, m.u.rest.z].map(v => +v.toFixed(2)), h: +m.h.toFixed(2), s: +m.s.toFixed(2), fresh: !!m.fresh })); return api;
  }
  function evalMover(m, t, o) {
    const a = m.from, r = m.u.rest;
    if (m.bob) {
      const e = clamp((t - m.b0) / m.bd, 0, 1); o.fam = m.u.fam; o.var = m.u.var; o.x = r.x; o.z = r.z; o.ry = r.ry; o.sx = r.sx; o.sy = r.sy; o.sz = r.sz;
      o.y = r.y + m.amp * Math.sin(Math.PI * Math.min(1, e * 1.08)) * (e < 0.93 ? 1 : 0); return o;
    }
    const old = m.famFrom && t < m.s + m.d;
    o.fam = old ? m.famFrom : m.u.fam; o.var = old ? m.varFrom : m.u.var; o.sy = old ? a.sy : r.sy;
    if (t < m.s) {
      const k = sm(clamp(t / 0.3, 0, 1)) + Math.sin(clamp(t / 0.3, 0, 1) * Math.PI) * 0.0; o.x = a.x; o.z = a.z; o.y = lerp(a.y, m.h, k); o.ry = a.ry; o.sx = a.sx; o.sz = a.sz;
      if (m.fresh) o.y = m.h;
      return o;
    }
    const u = clamp((t - m.s) / m.d, 0, 1), u1 = sm(clamp(u / 0.55, 0, 1)), u2 = clamp((u - 0.55) / 0.45, 0, 1);
    o.x = lerp(a.x, r.x, u1); o.z = lerp(a.z, r.z, u1); o.ry = lerp(a.ry, r.ry, u1);
    if (old) { o.sx = a.sx; o.sz = a.sz; } else if (m.famFrom) { o.sx = r.sx; o.sz = r.sz; } else { o.sx = lerp(a.sx, r.sx, u1); o.sz = lerp(a.sz, r.sz, u1); }
    o.y = u2 > 0 ? lerp(m.h, r.y, easeIn(u2)) : m.h + Math.sin(u1 * Math.PI) * 0.03;
    return o;
  }
  function finishFit() {
    if (!fit) return;
    for (const m of fit.movers) { m.u.move = null; Object.assign(m.u.p, { x: m.u.rest.x, y: m.u.rest.y, z: m.u.rest.z, ry: m.u.rest.ry, sx: m.u.rest.sx, sy: m.u.rest.sy, sz: m.u.rest.sz }); m.u.land = T; }
    stagedVis.forEach((it, i) => { stagePose(i, LOOSE_TYPES[it.type]); it.p.x = SP.x; it.p.y = SP.y; it.p.z = SP.z; it.s = SP.s; it.ry = SP.ry; it.st = 'staged'; });
    fit = null;
  }

  /* ---------------------------------------------------------------- motion: one damped spring for the upper load, stability driven */
  const SW = { x: 0, vx: 0, z: 0, vz: 0, teeter: 0 };
  function swayStep(dt, mo) {
    const lat = mo && isFinite(mo.lat) ? mo.lat : 0, lon = mo && isFinite(mo.lon) ? mo.lon : 0; lastLat = lat;
    if (mo && isFinite(mo.stability)) stability = clamp(mo.stability, 0, 1);
    const inst = 1 - stability, f = 1.5 - 0.8 * inst, w = TAU * f, zeta = 0.75 - 0.5 * inst, gain = (0.012 + 0.03 * inst);
    const tx = clamp(-lat * gain, -O.swayMax, O.swayMax), tz = clamp(lon * gain * 0.4, -0.05, 0.05);
    if (mo && mo.bump) { const b = typeof mo.bump === 'number' ? mo.bump : Math.hypot(mo.bump.x || 0, mo.bump.y || 0); SW.vx += (Math.random() - 0.5) * b * 0.25 * (0.4 + inst); SW.vz += b * 0.08 * (0.4 + inst); }
    const N = Math.max(1, Math.ceil(dt * 240)), h = dt / N;
    for (let i = 0; i < N; i++) { SW.vx += (w * w * (tx - SW.x) - 2 * zeta * w * SW.vx) * h; SW.x += SW.vx * h; SW.vz += (w * w * (tz - SW.z) - 2 * zeta * w * SW.vz) * h; SW.z += SW.vz * h; }
    const lim = O.swayMax * (0.3 + 0.7 * inst); SW.x = clamp(SW.x, -lim, lim); SW.z = clamp(SW.z, -0.05, 0.05);
  }

  /* ---------------------------------------------------------------- see-through (safety for anything over the road line) */
  const FADE = { enabled: false, mode: 'blend', opacity: 0.4, soft: 0.24, fromHeight: null, camera: null, ahead: 14, roadY: 0.3, active: 0, everActive: 0 };
  function setSeeThrough(o = {}) { Object.assign(FADE, o); }
  const _m4 = new THREE.Matrix4(), _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qH = new THREE.Quaternion(), _qV = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler(), _m2 = new THREE.Matrix4(), _m3 = new THREE.Matrix4(), _col = new THREE.Color();
  let fadeLine = { cz: 0, cy: 9, slope: 0 };
  function updateFade(cam) {
    const solid = !!fit || !!tallyS || FADE.solid;
    let on = FADE.enabled && !solid;
    if (on && FADE.fromHeight != null) { fadeLine.cz = 0; fadeLine.cy = FADE.fromHeight; fadeLine.slope = 0; }
    else if (on && (FADE.camera || cam)) {
      const c = FADE.camera || cam; group.updateWorldMatrix(true, false); _m4.copy(group.matrixWorld).invert();
      c.getWorldPosition(_v).applyMatrix4(_m4); _v2.set(0, FADE.roadY, FADE.ahead); if (group.parent) { group.parent.localToWorld(_v2); _v2.applyMatrix4(_m4); }
      fadeLine.cz = _v.z; fadeLine.cy = _v.y; fadeLine.slope = (_v2.y - _v.y) / ((_v2.z - _v.z) || 1e-3);
    } else on = false;
    SU.uStFade.value.set(fadeLine.cz, fadeLine.cy, fadeLine.slope, FADE.soft);
    SU.uStFadeK.value.set(on ? 1 : 0, FADE.opacity, FADE.mode === 'dither' ? 1 : 0, 0.9);
    const blend = on && FADE.mode !== 'dither';
    if (mat.transparent !== blend) { mat.transparent = blend; mat.needsUpdate = true; }
    FADE.active = 0;
    if (on) for (const u of units) { if (!u.alive || u.hidden) continue; const r = u.rest, zf = r.z + r.d / 2, hl = fadeLine.cy + fadeLine.slope * (zf - fadeLine.cz); if (r.y + r.h > hl) FADE.active++; }
    if (FADE.active) FADE.everActive++;
  }

  /* ---------------------------------------------------------------- per-frame presentation */
  const PP = { x: 0, y: 0, z: 0, ry: 0, sx: 1, sz: 1, sq: 1 };
  const shear = new THREE.Matrix4();
  let camQ = new THREE.Quaternion(), hasCam = false;
  function put(name, sel, x, y, z, ry, sx, sy, sz, f2a, f2b, f2c, f2d, sway, pv, rx = 0, rz = 0) {
    const M = MESH[name]; if (!M || M.n >= M.cap) return;
    _e.set(rx, ry, rz); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz); _m2.compose(_p, _q, _s);
    if (sway) { const k = 1 / (MAX_TOP - RAIL); shear.set(1, SW.x * k, 0, -SW.x * k * pv, 0, 1, 0, 0, 0, SW.z * k, 1, -SW.z * k * pv, 0, 0, 0, 1); _m2.premultiply(shear); }
    M.im.setMatrixAt(M.n, _m2); M.sel.array[M.n] = sel; const o = M.n * 4; M.f2.array[o] = f2a; M.f2.array[o + 1] = f2b; M.f2.array[o + 2] = f2c; M.f2.array[o + 3] = f2d;
    M.im.instanceColor.setXYZ(M.n, 1, 1, 1); M.n++;
  }
  function strip(x, y, z, sx, sy, sz, q, r, g, b) { if (strips.count >= STRIP_CAP) return; _p.set(x, y, z); _s.set(sx, sy, sz); _m2.compose(_p, q || _q2.identity(), _s); strips.setMatrixAt(strips.count, _m2); strips.instanceColor.setXYZ(strips.count, r, g, b); strips.count++; }
  const SEG = { a: [0, 0.5, 1], b: [0.25, 0.25, 0], c: [0.25, -0.25, 0], d: [0, -0.5, 1], e: [-0.25, -0.25, 0], f: [-0.25, 0.25, 0], g: [0, 0, 1], p: [0, 0, 0] };
  const GLY = { 0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abfgcd', '+': 'gp' };
  const RIGHT = new THREE.Vector3(), UP = new THREE.Vector3(), FWD = new THREE.Vector3();
  function drawPops() {
    _qH.copy(camQ); _q.setFromAxisAngle(FWD.set(0, 0, 1), Math.PI / 2); _qV.copy(camQ).multiply(_q);
    RIGHT.set(1, 0, 0).applyQuaternion(camQ); UP.set(0, 1, 0).applyQuaternion(camQ); FWD.set(0, 0, 1).applyQuaternion(camQ);
    for (const p of POPS) {
      if (!p.on) continue; const e = (T - p.t0) / p.life; if (e >= 1) { p.on = false; continue; }
      const sc = p.size * (e < 0.15 ? backOut(e / 0.15) : 1) * (e > 0.8 ? 1 - (e - 0.8) / 0.2 : 1), rise = easeOut(e) * 0.35;
      const n = p.txt.length, adv = 0.72;
      for (let c = 0; c < n; c++) {
        const g = GLY[p.txt[c]]; if (!g) continue; const ox = (c - (n - 1) / 2) * adv * sc;
        for (const sname of g) {
          const S = SEG[sname], horiz = S[2] === 1, len = 0.5 * sc, th = 0.15 * sc;
          for (const layer of [0, 1]) {
            const pad = layer ? 0 : 0.05 * sc, back = layer ? 0.004 : -0.004;
            _v.set(p.x, p.y + rise, p.z).addScaledVector(RIGHT, ox + S[0] * sc).addScaledVector(UP, S[1] * sc).addScaledVector(FWD, back);
            strip(_v.x, _v.y, _v.z, len + pad, th + pad, 0.01, horiz ? _qH : _qV, layer ? 1 : 0.05, layer ? 0.78 : 0.04, layer ? 0 : 0.03);
          }
        }
      }
    }
  }
  const ITEM_TMP = { x: 0, y: 0, z: 0 };
  function update(dt, motion = {}) {
    dt = clamp(dt || 0, 0, 0.1); T += dt;
    for (let i = LATER.length - 1; i >= 0; i--) if (T >= LATER[i].at) { const f = LATER[i].fn; LATER.splice(i, 1); f(); }
    if (fit && fit.auto) { fit.t = clamp(fit.t + dt / fit.D, 0, 1); if (fit.t >= 1) finishFit(); }
    swayStep(dt, motion);
    const cam = motion.camera || camera;
    if (cam) { group.updateWorldMatrix(true, false); group.matrixWorld.decompose(_v, _q2, _s); cam.getWorldQuaternion(camQ); camQ.premultiply(_q2.invert()); hasCam = true; } else camQ.identity();
    updateFade(cam);
    tallyStep();
    const inst = 1 - stability, danger = clamp((O.danger - stability) / O.danger, 0, 1), pulse = 0.5 + 0.5 * Math.sin(T * TAU * 2.2);
    SU.uStDanger.value.set(0, danger * (0.45 + 0.55 * pulse), 0, 0);
    SW.teeter = danger * 0.045 * Math.sin(T * TAU * 2.4);
    for (const k in MESH) MESH[k].n = 0; strips.count = 0;
    /* top tier of the loose load (for the teeter) */
    let topY = 0; for (const u of units) if (u.alive && !u.prot && u.kind !== 'big') topY = Math.max(topY, u.rest.y + u.rest.h);
    const fitT = fit ? fit.t * fit.D : 0, fitU = fit ? fit.t : 0;
    const drawUnit = (u, dyingNow) => {
      let x, y, z, ry, sx, sy, sz;
      let fam = u.fam, vr = u.var;
      if (u.move && fit) {
        const m = u.move; evalMover(m, fitT, PP); x = PP.x; y = PP.y; z = PP.z; ry = PP.ry; sx = PP.sx; sy = PP.sy; sz = PP.sz; fam = PP.fam; vr = PP.var;
        if (!m.landed && (m.bob ? fitT >= m.b0 + m.bd * 0.93 : fitT >= m.s + m.d)) { m.landed = true; u.land = T; burstPuffs(u.rest.x, u.rest.y, u.rest.z, u.rest.w, u.rest.d, m.famFrom ? 8 : 4, !!m.famFrom); if (m.famFrom) u.form = { t0: T, dur: 0.3, big: 0.6 }; }
      }
      else { x = u.rest.x; y = u.rest.y; z = u.rest.z; ry = u.rest.ry; sx = u.rest.sx; sy = u.rest.sy; sz = u.rest.sz; }
      let mx = 1, my = 1, mz = 1, dy = 0;
      if (u.form) {
        const e = (T - u.form.t0) / u.form.dur;
        if (e < 0) { if (u.form.hidden || u.form.from) return; }
        else if (e < 1) { const b = u.form.big || 1, k = backOut(e); my = 0.5 + 0.5 * k + Math.sin(e * Math.PI) * 0.18 * b; mx = mz = 1 + Math.sin(e * Math.PI) * 0.12 * b * (1 - e); dy = (1 - easeOut(Math.min(1, e * 1.6))) * (0.12 * b + (u.form.drop || 0)) - (e > 0.6 && e < 0.8 ? Math.sin((e - 0.6) / 0.2 * Math.PI) * 0.006 : 0);
          if (u.form.from) { const k2 = easeOut(Math.min(1, e * 1.4)); x = lerp(u.form.from.x, x, k2); z = lerp(u.form.from.z, z, k2); y = lerp(u.form.from.y, y, k2) + Math.sin(k2 * Math.PI) * 0.35; } }
        else u.form = null;
      }
      if (u.land && T - u.land < 0.22) { const e = (T - u.land) / 0.22; my *= 1 - Math.sin(e * Math.PI) * 0.06; mx *= 1 + Math.sin(e * Math.PI) * 0.03; mz = mx; }
      if (dyingNow) {
        const D2 = u.die, e = (T - D2.t0) / D2.dur; if (e >= 1) { u.dieDone = true; return; }
        if (D2.type === 'merge') { const k = sm(e); x = lerp(x, D2.tx, k); y = lerp(y, D2.ty - u.rest.h * 0.3, k) + Math.sin(e * Math.PI) * 0.12; z = lerp(z, D2.tz, k); mx = my = mz = 1 - 0.55 * k; }
        else { const k = e; mx = mz = 1 + 0.14 * Math.sin(k * Math.PI * 0.5); my = 1 + 0.2 * k; }
      }
      let washF = 0, washK = 0, glow = 0;
      if (u.washT0 != null && u.washT0 > 0) { const e = T - u.washT0; washF = clamp(e / 0.12, 0, 1.05); washK = e < 0.12 ? u.washK : u.washK * Math.max(0, 1 - (e - 0.12) / 0.45); glow = e < 1.2 ? 0.12 : 0.12 * Math.max(0, 1 - (e - 1.2) / 0.6); if (tallyS && u.tallied) glow = 0.14; }
      const amber = !u.prot && u.kind !== 'big' && !dyingNow ? 1 : 0;
      const sway = !u.move && !dyingNow && (u.kind === 'big' || !u.prot) && (u.rest.y + u.rest.h > RAIL + 0.02);
      let rz = 0;
      if (sway && amber && u.rest.y + u.rest.h >= topY - 0.03 && danger > 0) rz = SW.teeter;
      const F = FG[fam], sel = F && F.bb.length > 1 ? vr % F.bb.length : 0;
      put(fam, sel, x, y + dy, z, ry, sx * mx, sy * my, sz * mz, washF, washK, glow, amber, sway, u.pivot != null ? u.pivot : RAIL, 0, rz);
      if (u.prot && u.kind !== 'big' && !dyingNow && !u.move) protMarks(u);
    };
    for (const u of units) { if (!u.alive || u.hidden) continue; drawUnit(u, false); }
    for (let i = dying.length - 1; i >= 0; i--) { const u = dying[i]; drawUnit(u, true); if (u.dieDone) dying.splice(i, 1); }
    /* items */
    for (const it of items) {
      if (!it.on) continue;
      let x = it.p.x, y = it.p.y, z = it.p.z, s = it.s, rx = it.rx, rz = it.rz;
      if (it.packTo && T >= it.packAt) {
        const q = T - it.packAt, P = it.packTo;
        if (it.st === 'arrive' || it.st === 'hop') { it.st = 'staged'; it.p.x = it.b.x; it.p.y = it.b.y; it.p.z = it.b.z; it.s = it.s1; it.ry = it.ry1; x = it.p.x; y = it.p.y; z = it.p.z; s = it.s; }
        if (q < 0.1) { y += Math.sin(q / 0.1 * Math.PI) * 0.1; rx = rz = 0; }
        else if (q < 0.26) { const k = sm((q - 0.1) / 0.16); x = lerp(it.p.x, P.x, k); y = lerp(it.p.y, P.y, k); z = lerp(it.p.z, P.z, k); s = it.s * (1 - 0.45 * k); rx = rz = 0; }
        else { it.on = false; it.packTo = null; continue; }
      } else if (it.st === 'arrive' || it.st === 'hop') {
        const e = clamp((T - it.t0) / it.dur, 0, 1), k = it.st === 'arrive' ? sm(e) : easeOut(e);
        x = lerp(it.a.x, it.b.x, k); z = lerp(it.a.z, it.b.z, k); y = lerp(it.a.y, it.b.y, k) + Math.sin(e * Math.PI) * it.arc; s = lerp(it.s0, it.s1, k); it.ry = lerp(it.ry0, it.ry1, k);
        rx = (1 - e) * it.wx * 0.15; rz = (1 - e) * it.wz * 0.15;
        if (e >= 1) { it.st = 'staged'; it.p.x = it.b.x; it.p.y = it.b.y; it.p.z = it.b.z; it.s = it.s1; rx = rz = 0; }
        else { it.p.x = x; it.p.y = y; it.p.z = z; it.s = s; }
        x = it.st === 'staged' ? it.p.x : x; y = it.st === 'staged' ? it.p.y : y;
      } else if (it.st === 'fit' && fit) {
        const t = fitU, u1 = clamp(t / 0.22, 0, 1), u2 = clamp((t - 0.85) / 0.15, 0, 1);
        x = lerp(it.a.x, it.b.x, sm(u2)); z = lerp(it.a.z, it.b.z, sm(u2)); y = u2 > 0 ? lerp(it.hh, it.b.y, easeIn(u2)) : lerp(it.a.y, it.hh, backOut(u1)); s = lerp(it.s, it.s1, u2);
      } else if (it.st === 'lost') {
        const e = T - it.t0;
        if (it.p.y > 0.0 || it.v.y > 0) { it.v.y -= 9.8 * dt; it.p.x += it.v.x * dt; it.p.y += it.v.y * dt; it.p.z += it.v.z * dt; it.rx += it.wx * dt; it.rz += it.wz * dt;
          if (it.p.y <= 0 && it.v.y < 0) { it.p.y = 0; it.v.y = 0; it.v.x *= 0.3; it.v.z *= 0.3; it.wx *= 0.2; it.wz *= 0.2; it.rx = Math.round(it.rx / (Math.PI / 2)) * Math.PI / 2; it.rz = 0; } }
        else { const sp = motion.speed || 0; it.p.z -= sp * dt; it.p.x += it.v.x * dt; it.p.z += it.v.z * dt; it.v.x *= 0.9; it.v.z *= 0.9; }
        x = it.p.x; y = it.p.y; z = it.p.z; rx = it.rx; rz = it.rz;
        if (e > 1.8) s = it.s * Math.max(0, 1 - (e - 1.8) / 0.4);
        if (e > 2.2) { it.on = false; continue; }
      }
      let glowI = 0, washI = 0;
      if (it.tallied) { const e = T - it.tallied; washI = e < 0.12 ? 0.85 : 0.85 * Math.max(0, 1 - (e - 0.12) / 0.45); glowI = tallyS ? 0.14 : 0; }
      const nb = LOOSE_BB[it.type], yb = it.st === 'lost' ? 0 : 0;
      put('loose', it.type, x, y + yb, z, it.ry, s, s, s, washI ? 1.05 : 0, washI, glowI, 0, false, RAIL, rx, rz);
    }
    /* lids */
    for (const l of LIDS) {
      if (!l.on) continue; const e = T - l.t0; if (e > 1.6) { l.on = false; continue; }
      l.vy -= 9.8 * dt; l.x += l.vx * dt; l.y += l.vy * dt; l.z += l.vz * dt; l.r += l.rv * dt; if (l.y < 0.01) { l.y = 0.01; l.vy = 0; l.vx *= 0.8; l.vz *= 0.8; l.rv *= 0.5; }
      _e.set(l.r * 0.6, l.r * 0.2, l.r); _q.setFromEuler(_e); const fade = e > 1.2 ? 1 - (e - 1.2) / 0.4 : 1;
      strip(l.x, l.y, l.z, l.w * fade, 0.03, l.d * fade, _q, l.col[0], l.col[1], l.col[2]);
    }
    bands();
    drawPops();
    /* puffs (billboards) */
    puffs.count = 0;
    for (const p of PUFF) {
      if (!p.on) continue; const e = (T - p.t0) / p.life; if (e >= 1) { p.on = false; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.vx *= 0.94; p.vz *= 0.94; p.vy *= 0.96;
      const sc = p.s * (0.6 + 0.8 * easeOut(e)) * (1 - e * e); _p.set(p.x, p.y, p.z); _s.set(sc, sc, sc); _m2.compose(_p, camQ, _s); puffs.setMatrixAt(puffs.count, _m2); puffs.instanceColor.setXYZ(puffs.count, p.r * (1 - e * 0.3), p.g * (1 - e * 0.3), p.b * (1 - e * 0.3)); puffs.count++;
    }
    for (const k in MESH) { const M = MESH[k]; M.im.count = M.n; M.im.visible = M.n > 0; if (M.n) { M.im.instanceMatrix.needsUpdate = true; M.im.instanceColor.needsUpdate = true; M.sel.needsUpdate = true; M.f2.needsUpdate = true; } }
    strips.visible = strips.count > 0; strips.instanceMatrix.needsUpdate = true; strips.instanceColor.needsUpdate = true;
    puffs.visible = puffs.count > 0; puffs.instanceMatrix.needsUpdate = true; if (puffs.instanceColor) puffs.instanceColor.needsUpdate = true;
  }
  /* protection marks: four small yellow corner brackets on the top of each protected unit */
  function protMarks(u) {
    const r = u.rest, y = r.y + r.h + 0.006, a = 0.07, t = 0.014;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const cx = r.x + sx * (r.w / 2 - a / 2 - 0.01), cz = r.z + sz * (r.d / 2 - 0.01 - t / 2), cx2 = r.x + sx * (r.w / 2 - 0.01 - t / 2), cz2 = r.z + sz * (r.d / 2 - a / 2 - 0.01);
      strip(cx, y, cz, a, 0.01, t, null, 1, 0.78, 0); strip(cx2, y, cz2, t, 0.01, a, null, 1, 0.78, 0);
    }
  }
  /* tie-down bands over the big loads (two per lane stack) */
  function bands() {
    const k = 1 / (MAX_TOP - RAIL);
    for (const u of bigs) {
      if (!u.alive || u.hidden || u.lane == null || (u.move && fit)) continue;
      const r = u.rest, y0 = r.y, y1 = r.y + r.h + 0.004, w = r.w + 0.012, pv = u.pivot != null ? u.pivot : RAIL;
      const dx0 = SW.x * k * (y0 - pv), dx1 = SW.x * k * (y1 - pv), off = Math.min(0.42, r.d * 0.28);
      for (const z of [r.z - off, r.z + off]) {
        strip(r.x + dx1, y1, z, w, 0.01, 0.04, null, 0.06, 0.06, 0.07);
        for (const sgn of [-1, 1]) strip(r.x + sgn * w / 2 + (dx0 + dx1) / 2, (y0 + y1) / 2, z, 0.01, y1 - y0, 0.04, null, 0.06, 0.06, 0.07);
      }
    }
  }

  /* ---------------------------------------------------------------- public API */
  function count() { let n = loose.length; for (const u of units) if (u.alive && u.kind !== 'big') n += u.pieces; return n; }
  function height() { let t = RAIL; for (const u of units) if (u.alive && !u.hidden) t = Math.max(t, u.rest.y + u.rest.h); return Math.max(0, t - RAIL); }
  function add(type, n = 1, opts = {}) {
    if (BIG[type]) { for (let i = 0; i < n; i++) addBig(type, opts); return; }
    for (let i = 0; i < n; i++) addLoose(type, opts);
  }
  function setProtected(n) { const was = protectedN; protectedN = Math.max(0, Math.floor(n)); reprotect(); if (protectedN > was) for (const u of units) if (u.prot && u.alive) washUnit(u, 0.35); }
  function reset() {
    finishFit(); units.length = 0; loose.length = 0; bigs.length = 0; dying.length = 0; occ.clear(); stagedVis = []; for (const it of items) it.on = false; for (const p of PUFF) p.on = false; for (const p of POPS) p.on = false; for (const l of LIDS) l.on = false; LATER.length = 0;
    tallyS = null; fullFired = false; protectedN = 0; SW.x = SW.vx = SW.z = SW.vz = 0; cfg = { ...CFG0 }; L = layout(cfg, 0); markReserve();
  }
  /* the units' current boxes in stash space (for QA and the game's checks) */
  function state() {
    const list = [];
    for (const u of units) {
      if (!u.alive || u.hidden) continue; let x = u.rest.x, y = u.rest.y, z = u.rest.z, ry = u.rest.ry;
      let w = u.rest.w, d = u.rest.d, h = u.rest.h;
      if (u.move && fit) { evalMover(u.move, fit.t * fit.D, PP); x = PP.x; y = PP.y; z = PP.z; ry = PP.ry; dimsOf(PP.fam, PP.ry, PP.sx, PP.sy, PP.sz, DIM); w = DIM.w; d = DIM.d; h = DIM.h; }
      const swap = Math.abs(Math.sin(ry)) > 0.5 && u.kind === 'box' && false;
      const sx = (!u.prot || u.kind === 'big') && y + h > RAIL + 0.02 ? Math.abs(SW.x) / (MAX_TOP - RAIL) * Math.max(0, y + h - (u.pivot != null ? u.pivot : RAIL)) : 0;
      list.push({ kind: u.kind, fam: u.fam, pieces: u.pieces, worth: u.worth, prot: u.prot, moving: !!(u.move && fit), root: u.root, box: [x - w / 2, y, z - d / 2, x + w / 2, y + h, z + d / 2], sway: sx, slots: u.slots.slice() });
    }
    const st = [];
    for (const it of stagedVis) if (it.on) { const b = LOOSE_BB[it.type], s = it.s, rot = Math.abs(Math.sin(it.ry)) > 0.5, alongX = (b.long === 'x') !== rot, hx = (alongX ? b.L : b.S) * s / 2, hz = (alongX ? b.S : b.L) * s / 2, cx = it.p.x + (rot ? b.cz : b.cx) * s, cz = it.p.z + (rot ? -b.cx : b.cz) * s; st.push({ type: LOOSE_TYPES[it.type], st: it.st, box: [cx - hx, it.p.y, cz - hz, cx + hx, it.p.y + b.H * s, cz + hz] }); }
    const kinds = { box: 0, case: 0, trunk: 0, big: 0 }; for (const u of units) if (u.alive && !u.hidden) kinds[u.kind]++;
    return { cfg: { ...cfg }, pieces: count(), loose: loose.length, protected: protectedN, units: list, staged: st, kinds, height: height(), stability, sway: { x: SW.x, z: SW.z }, fit: fit ? { t: fit.t, product: fit.product, pt1: fit.pt1, D: fit.D } : null, tally: !!tallyS,
      seeThrough: { active: FADE.active, everActive: FADE.everActive }, slotsFree: L.slots.filter(s => free(s)).length, slots: L.slots.length, value: units.reduce((a, u) => a + (u.alive ? u.worth : 0), 0) + loose.reduce((a, q) => a + q.worth, 0) };
  }
  function stats() { let tris = 0, calls = 0; for (const k in MESH) { const M = MESH[k]; if (!M.n) continue; calls++; const F = FG[k]; for (let i = 0; i < M.n; i++) tris += F.tris.reduce((a, b) => a + b, 0); } if (strips.count) { calls++; tris += strips.count * 12; } if (puffs.count) { calls++; tris += puffs.count * 2; } return { drawCalls: calls, triangles: tris }; }
  reset();
  return {
    group, configure, add, lose, setProtected, update, tally, reset, state, beginFit, height, setSeeThrough, stats,
    setStability(s) { stability = clamp(s, 0, 1); },
    dispose() {
      finishFit(); if (group.parent) group.parent.remove(group);
      for (const k in MESH) { MESH[k].im.geometry.dispose(); MESH[k].im.dispose && MESH[k].im.dispose(); }
      strips.geometry.dispose(); strips.material.dispose(); puffs.geometry.dispose(); puffs.material.dispose(); dotTex.dispose(); mat.dispose();
    },
    on(name, fn) { ev[name] = fn; },
    get config() { return { ...cfg }; }, layout: () => L, materials: { stash: mat }
  };
}
