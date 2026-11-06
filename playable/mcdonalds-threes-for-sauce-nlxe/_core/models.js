/* The model pack (2026-11-04, Phase 1 item 5; R&D list E): generated 3D models in the world kit, with the loader's rules
   so no game repeats the Sonic night's findings (2026-11-03 01:00-06:30, docs/DEVLOG.md):
   - a model is registered for a LAYER id (MODELS.load(id, url, opts)); the kit draws it in the layer's box once it has
     loaded and the greybox shape until then, the same rule as a picture;
   - the height comes from the SKELETON when there is one (the top of the head bone to the lowest toe, in world space; a
     Mixamo rig carries scale on its bones, so the mesh's own bounds are not what is drawn), from the bounds otherwise; the
     model is wrapped so one unit of the wrap is one unit of height and its feet sit at y = 0;
   - materials: rough, no metal (a Tripo texture is an albedo, not a PBR set); every mesh casts a shadow and is never culled
     by the frustum (a skinned mesh's bounds lag its pose);
   - clips: the model's own animations by name, and LIBRARY clips (our 80 Mixamo clips as glTF) retargeted by rest: both
     skeletons are Mixamo's with the same bone axes, so a clip's WORLD rotations transfer as they are, turned by one global
     rotation about Y (-90 by default) that the two rigs' conventions differ by; position tracks are dropped (the game moves
     the body); the clip's pace follows the body's speed through `rate`;
   - the feet never go into the floor: the lowest toe is measured each frame and the body lifted by the deficit;
   - the glove lock: a cartoon glove is bigger than a hand, so an auto rig folds it at the wrong point; with the model's OWN
     clip the wrist and finger bones keep their rest pose (opts.lock); a library clip carries its own hands.
   The kit never ships a model it did not slim: the pack's slim pass (quantise, WebP 512, face limit) runs before a file
   reaches a build; the budget is the pipeline's (at most three models, the hero and the product first). */
import * as THREE from './three.js';
import { GLTFLoader } from './three.js';
export const MODELS = (function () {
  const REC = {};   // id -> { ready, wrap, root, height, footY, mixer, actions, current, rate, locks, skinned, bones, toes, lock, error }
  const loader = new GLTFLoader();
  const inv = q => q.clone().invert();
  /** a library clip onto this skin, by rest (2026-11-03 03:45): world rotations of the source joints, turned by gy degrees about Y */
  function retargetByRest(skinned, srcRoot, srcBones, clip, gyDeg, fps) {
    const tgt = skinned.skeleton.bones;
    const srcByName = new Map(srcBones.map(b => [b.name, b]));
    const GY = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (gyDeg == null ? -90 : gyDeg) * Math.PI / 180);
    const tgtBind = tgt.map((b, i) => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().copy(skinned.skeleton.boneInverses[i]).invert()));
    const order = tgt.map((b, i) => ({ b, i, depth: (() => { let d = 0, p = b.parent; while (p && p.isBone) { d++; p = p.parent; } return d; })() })).sort((a, c) => a.depth - c.depth);
    const mixer = new THREE.AnimationMixer(srcRoot); mixer.clipAction(clip).play(); mixer.update(0);
    const frames = Math.max(2, Math.round(clip.duration * fps)), dt = 1 / fps;
    const times = new Float32Array(frames), vals = tgt.map(() => new Float32Array(frames * 4));
    for (let f = 0; f < frames; f++) {
      times[f] = f * dt; srcRoot.updateMatrixWorld(true);
      const world = new Map();
      for (const { b, i } of order) {
        const sb = srcByName.get(b.name);
        const w = sb ? GY.clone().multiply(sb.getWorldQuaternion(new THREE.Quaternion())) : tgtBind[i].clone();
        world.set(b, w);
        const pw = b.parent && b.parent.isBone ? world.get(b.parent) : null;
        (pw ? inv(pw).multiply(w) : w).toArray(vals[i], f * 4);
      }
      mixer.update(dt);
    }
    return new THREE.AnimationClip(clip.name + ' retargeted', -1, tgt.map((b, i) => new THREE.QuaternionKeyframeTrack(`.bones[${b.name}].quaternion`, times, vals[i])));
  }
  function load(id, url, opts) {
    opts = opts || {};
    if (REC[id]) return REC[id];
    const rec = REC[id] = { id, url, ready: false, wrap: null, root: null, height: 1, footY: 0, mixer: null, actions: {}, current: null, rate: 1, locks: [], skinned: null, toes: [], lock: opts.lock !== false, error: null, pending: {}, own: null };
    loader.load(url, gltf => {
      const root = gltf.scene;
      root.traverse(o => { if (o.isMesh || o.isSkinnedMesh) { o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false; if (o.material) { o.material.roughness = 1; o.material.metalness = 0; } if (o.isSkinnedMesh && !rec.skinned) rec.skinned = o; } });
      root.updateMatrixWorld(true);
      const bones = {}; root.traverse(o => { if (o.isBone) bones[o.name.replace(/^mixamorig:?/, '')] = o; });
      const wp = b => b.getWorldPosition(new THREE.Vector3());
      const top = bones.HeadTop_End ? wp(bones.HeadTop_End) : null, toe = bones.LeftToe_End ? wp(bones.LeftToe_End) : null;
      const box = new THREE.Box3().setFromObject(root, true), size = box.getSize(new THREE.Vector3());
      const posedH = top && toe ? top.y - toe.y : size.y, footY = toe ? toe.y : box.min.y;
      const s = 1 / Math.max(0.001, posedH);
      const wrap = new THREE.Group(); root.scale.setScalar(s); root.position.set(0, -footY * s, 0); wrap.add(root);
      rec.root = root; rec.wrap = wrap; rec.height = posedH; rec.footY = footY; rec.scale = s;
      rec.toes = [bones.LeftToe_End, bones.RightToe_End, bones.LeftToeBase, bones.RightToeBase].filter(Boolean);
      rec.mixer = new THREE.AnimationMixer(root);
      for (const c of gltf.animations) { rec.actions[c.name] = rec.mixer.clipAction(c); if (!rec.own) rec.own = c.name; }
      root.traverse(o => { if (o.isBone && /Hand|Foot|Toe/.test(o.name)) rec.locks.push({ bone: o, q: o.quaternion.clone() }); });
      rec.ready = true;
      if (opts.clips) for (const [name, curl] of Object.entries(opts.clips)) clip(id, name, curl, opts);
      if (opts.play) play(id, opts.play);
    }, undefined, e => { rec.error = String(e); (opts.optional ? console.info : console.error)('model pack: load failed', id, url, e); });   // optional: a layer's mesh that does not exist yet (milestone 1, a failed model) is no fault, the stand-in holds its slot
    return rec;
  }
  /** a library clip for a loaded model, retargeted by rest; it plays under `name` once ready */
  function clip(id, name, url, opts) {
    const rec = REC[id]; if (!rec || rec.pending[name]) return; rec.pending[name] = true;
    loader.load(url, lib => {
      const c = lib.animations[0]; if (!c || !rec.skinned) { console.error('model pack: clip without animation or skin', id, name); return; }
      const srcBones = []; lib.scene.traverse(o => { if (/^mixamorig/.test(o.name)) { o.isBone = true; o.type = 'Bone'; srcBones.push(o); } });
      const rc = retargetByRest(rec.skinned, lib.scene, srcBones, c, opts && opts.gy, 30);
      // the library clip's mixer is on the skinned mesh (its bones' quaternion tracks), the model's own on the root
      rec.libMixer = rec.libMixer || new THREE.AnimationMixer(rec.skinned);
      rec.actions[name] = rec.libMixer.clipAction(rc); rec.actions[name].userData = { lib: true };
      if (rec.want === name) play(id, name);
    }, undefined, e => console.error('model pack: clip failed', id, name, e));
  }
  function play(id, name) {
    const rec = REC[id]; if (!rec) return; rec.want = name;
    const a = rec.actions[name]; if (!a) return;
    if (rec.current === a) return;
    if (rec.current) rec.current.fadeOut(0.15);
    a.reset().fadeIn(0.15).play(); rec.current = a; rec.currentLib = !!(a.userData && a.userData.lib);
  }
  /** step the model's animation by dt (the kit calls it once per drawn model per frame) */
  function step(rec, dt) {
    if (!rec.ready) return;
    const r = rec.rate == null ? 1 : rec.rate;
    if (rec.current && rec.currentLib) { if (rec.libMixer) rec.libMixer.update(dt * r); }
    else if (rec.mixer) rec.mixer.update(dt * r);
    // the glove lock, with the model's own clip only
    if (rec.lock && !rec.currentLib) for (const l of rec.locks) l.bone.quaternion.copy(l.q);
  }
  /** the deficit under the lowest toe (world y of the floor minus the lowest toe), 0 when the feet are on or above it */
  function footLift(rec, floorY) {
    if (!rec.toes.length) return 0;
    rec.wrap.updateMatrixWorld(true); let low = Infinity; const v = new THREE.Vector3();
    for (const b of rec.toes) { b.getWorldPosition(v); if (v.y < low) low = v.y; }
    return low < floorY ? floorY - low : 0;
  }
  const get = id => (REC[id] && REC[id].ready ? REC[id] : null);
  return { load, clip, play, step, footLift, get, get records() { return REC; } };
})();
window.MODELS = MODELS;
