/* The world kit on three.js (2026-11-03, branch bespoke-world-kit, Phase 1 of the plan after the Higgsfield R&D).
   The same surface as world.js, so the engine, the runner kit, the motion kit and every skeleton run on it unchanged:
     WORLD.configure(VIEW.world) · WORLD.init(VIEW.world) · WORLD.begin(cam) · WORLD.shape / picture / layer · WORLD.end()
     WORLD.project(x, y, z) · trackX / trackY / trackHalf / heading / fadeAt · ok · view · stats · framings · config
   What differs underneath: real geometry (a box is a box, a disc a sphere, a ring a torus facing the thrower), one sun with
   cast shadows that follows the camera, a hemisphere light, fog to the zone's haze, a sky dome with the zone's gradient;
   the camera is the SAME shifted pinhole as world.js (the horizon on a fixed line, verticals vertical, focal in frame
   widths), built as a projection matrix, so every 2D overlay drawn through WORLD.project lands on the same pixel.
   Perspective mode only (a 'top', 'side' or 'stage' page keeps world.js). Loaded as a module (three and its loaders come
   from the page's import map; a delivered single file inlines a slimmed build); it sets window.WORLD before the page's
   own module runs, so the engine's `VIEW.world && window.WORLD` holds as before.
   Coordinates: the kit's x runs to the RIGHT looking along +z (as world.js); three's camera frame puts +x on the left when
   it looks along +z, so the kit mirrors x once, here, in place(). A game never sees three.js.
   New on this kit (Phase 1): WORLD.hero(x, y, z, h) names the hero thing this frame; stats.heroShare is its projected
   share of the frame height, read by the battery and the build's verify (the camera rule, R&D list C).
   The vocabulary (2026-11-05, after the first full session build read toy against the Claude path's file):
     o.material on WORLD.shape: a MATERIAL ROLE, never a material: 'matte' (the default), 'lacquer' (painted metal, armour,
       lacquered plastic, a backboard: clearcoat), 'metal' (steel, iron, a rim, a post), 'gold' (brass, gold), 'wood', 'cloth',
       'rubber', 'glass' (translucent), 'glow' (a lamp, a sign, a strip: emissive in its own colour, it blooms), 'mark' (a cue, a
       painted marker: lit enough to read in any light, never blooms). The numbers are
       the look reference's, measured off shipped games; a role is shared, a shape only tints it.
     zones[].backdrop: the far backdrop as a STRIP on a cylinder around the camera, under the sky dome, drawn by recipe:
       { recipe: 'bokeh' | 'stands' | 'skyline', colours: [base, light1, light2, ...], span: 60, height: 1 } or { image } (a
       painted panorama from the pack: a plate layer's picture); the picture stands for `span` units of wall and repeats
       around the cylinder, its height follows (span x 3/8 x height). 'bokeh' is a dark hall of blurred lights (an arena at night, a
       concert), 'stands' rows of seats with a rail, 'skyline' building silhouettes with lit windows. The strip fades into
       the dome at its top and into the haze at its foot. No backdrop: the dome's gradient alone. A PAINTED plate is the backdrop:
       name the plate layer on the zone (skyPlate: 'L1') and its picture replaces the recipe when it has loaded (the recipe is
       the stand-in until then); stats.backdropKind says which stands ('stands', 'plate:L1').
     look.heroLight: a small warm light that follows the hero (toy 0, premium 0.5, arena 1.0), so a hero in a low hemisphere
       still reads; a page never lifts the hemisphere to light its hero.
     A page's look knobs are held to the style's bands: sun, sky, rimLight, env, bloom, exposure and heroLight may move to
       half or one-and-a-half times the style's number, never further (the look is a law; 2026-11-04 00:50).
     stats.tile: the ground recipe's one tile measured on screen at the target's distance, else the hero's ({ recipe, px }), for the look line:
       a pattern too fine reads as noise, too coarse as a few slabs.
     WORLD.crowd({ x, y, z, w, rows, perRow, colours, dark, sway, rise, depth, size, id }): a crowd in rising rows as ONE
       instanced pair (bodies, heads: two draw calls whatever the count), each figure in one of the colours (the palette's
       crowd[]), dark: true for silhouettes under arena light, swaying on its own seed. Called every frame like a shape. The
       crowd brings its own TIERS (the steps under the rows, from the same rise and depth; tier: a colour, tiers: false for flat
       ground): never draw separate riser boxes for it, they bury the back rows.
     WORLD.board({ x, y, z, w, h, text, colour, ink, speed, glow, yaw, font }): a message board, the text repeated and
       scrolling (speed in units per second, negative for the other way), glow: true emissive so it blooms (an LED ribbon),
       false a painted board. The campaign's line goes here, on the world's own surfaces.
     Geometry recipes as kinds of WORLD.shape (the look reference's rule: a hero object is never a bare box or sphere):
       'rounded' (a box with soft edges), 'lathe' with o.profile = [[r, y], ...] (r 0..0.5, y 0..1 from the base: a bottle, a
       barrel, a bowl, a post with a cap), 'plate' with o.outline = [[x, y], ...] (0..1, an extruded bevelled plate: a shield,
       a sign, a car side, a backboard with a lip) and o.d its depth. Each is cached by its points.
     A 'model' layer (the hero or a prop with a generated mesh): draw it with WORLD.layer(layer, standInKind, x, y, z, w, h, colour, o)
       and the kit loads assets/models/<layer id>.glb by itself and swaps it in for the stand-in when it has loaded; the slot
       (position, size, role, body) stays the page's. Its reference picture is never drawn in the world. Draw the layer as
       many times a frame as there are things (every piece in hand, in flight, at rest): each is the mesh, fitted inside its
       slot's box (w and h); o.tint multiplies a copy's colour (a sauced piece), o.yaw / o.pitch / o.roll turn it about the
       middle of its box (a tumbling piece stays on its path; a rigged character turns about its feet). Never give
       the mesh to one thing and a plain shape to the others. stats.heroToTarget is the hero's size against the target's.
       A model that is thrown is a body with its own shape: W.solid({ w, h, outline: WORLD.outline(layer, w, h), ... }) in the physics kit, drawn with
       WORLD.layer(layer, kind, x, y, z, w, h, colour, { body }): the mesh stands on the body and turns with it, so what is seen is what hits.
       A model is for the product or an organic hero only (food, a creature, a character): a layer drawn with target: true
       keeps its kit shapes and loads no model, since the target's body is the game's colliders and its states are code.
     o.target on a shape, or WORLD.target(x, y, z, h): the thing the player aims at (a hoop, a goal, a gate); stats.targetShare
       is its share of the frame height, read by the look beside the hero's (a target under a tenth of the frame is too small
       to aim at). stats.hero names the hero's kind and material role; stats.backdrop says whether a backdrop strip stands;
       stats.style the look's style: the eye reads them.
     WORLD.cue({ kind: 'arrow' | 'ring', x, y, z, size, dir, colour, alpha, pulse, id }): a cue IN the world (2026-11-05, the
       owner on a flat yellow triangle drawn over the arena: "a flat incomplete shape"): a correction arrow lying on the ground
       (dir: 'left' | 'right' | 'far' | 'near', the way to correct), or a ring on the ground around a spot (a landing, a target's
       foot), in the mark role so it reads in any light without blooming, pulse: 0..1 for a beat that grows and fades. The 2D layer over a
       world draws text, the HUD and the kit's own flood, never a hand-drawn polygon (the write check refuses one).
   THE CAMERA (2026-11-05, the owner: "the camera decides how finished a frame looks"): a page never types a camera. It names
     a FRAMING in VIEW.world.camera and the kit solves height and distance from the hero's share of the frame every frame:
       'chase-low' / 'chase-high': a runner or a vehicle seen from behind, low and close or high and wide (a track);
       'throw-back': a thrower seen from behind, the target ahead in the upper half (a throw-through-a-ring genre);
       'throw-first': first person, the held thing low in the frame, the target ahead (a flick game with no visible thrower).
     The playfield is laid out to fit the frame; the camera is never pulled back to fit a playfield. During play the camera is
     rigid (greybox rule P8). A move is the motion kit's rig handed to WORLD.begin: cam.frame(thing, share, secs) for the
     payoff's hero moment (the named thing at 0.25 to 0.35 of the frame height, the distance derived here from the share),
     cam.shake for an impact, cam.dolly / cam.zoom on top when a beat wants them, cam.reset after. stats.camera reports the
     framing, the zoom and how far a frame move has gone, so the look line says what the camera is doing. */
import * as THREE from './three.js';   // the kit's own bundle (scripts/bespoke-kit-bundle.mjs): three with the addons the kit uses
import { EffectComposer, RenderPass, UnrealBloomPass, ShaderPass, OutputPass, OrbitControls } from './three.js';
import { SURFACES } from './surfaces.js';
import { MODELS } from './models.js';
window.THREE = THREE;
// A SURFACE NEVER FLARES (2026-11-05, the owner on run E: "too much camera sun, sunflare and glints ... even if the camera moves around").
// Tone mapping is off, so a mirror highlight has no ceiling: it clips to white and the bloom makes it a flare, wherever the camera
// happens to catch it. The rule, in every lit material of every world: a surface's highlight, of a light or of the environment, stops at
// HIGHLIGHT_CAP, under the bloom's threshold. Only what is declared a light (kind 'lamp', role 'glow') may pass it, so a glow is a choice.
const HIGHLIGHT_CAP = 0.3;
THREE.ShaderChunk.lights_fragment_end += `
  reflectedLight.directSpecular = min(reflectedLight.directSpecular, vec3(${HIGHLIGHT_CAP.toFixed(2)}));
  reflectedLight.indirectSpecular = min(reflectedLight.indirectSpecular, vec3(${HIGHLIGHT_CAP.toFixed(2)}));
  #ifdef USE_CLEARCOAT
    clearcoatSpecularDirect = min(clearcoatSpecularDirect, vec3(${HIGHLIGHT_CAP.toFixed(2)}));
    clearcoatSpecularIndirect = min(clearcoatSpecularIndirect, vec3(${HIGHLIGHT_CAP.toFixed(2)}));
  #endif
`;
window.WORLD = (function () {
  let R = null, cv = null, scene = null, camera = null, sun = null, hemi = null, fill = null, rim = null, sky = null, orbit = null, ok = false, tried = false, lost = false;
  let heroLight = null, strip = null, groundTile = null, heroInfo = null, target = null;
  let W = 640, H = 960, dpr = 1, cam = { x: 0, y: 0, z: 0, c: 1, s: 0, zoom: 1 }, camY = 2;
  const stats = { draws: 0, textures: 0, sprites: 0, heroShare: 0 };
  const PROF = new URLSearchParams(location.search).has('prof');
  let profT = 0, profN = 0, profAt = 0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = t => t * t * (3 - 2 * t);
  const hex = c => { const s = String(c || '#888').replace('#', ''); const n = parseInt(s.length === 3 ? s.split('').map(ch => ch + ch).join('') : s, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
  const col3 = c => new THREE.Color(c[0], c[1], c[2]);
  let C = null;

  // ── the track's path (as world.js) ──
  let segs = [];
  function buildPath() {
    segs = []; let z = 0, x = 0, y = 0, h = (C.track && C.track.half) || 3;
    for (const s of (C.track && C.track.path) || []) { const h1 = s.half != null ? s.half : h; segs.push({ z0: z, z1: z + s.len, x0: x, x1: x + (s.bend || 0), y0: y, y1: y + (s.rise || 0), h0: h, h1 }); z += s.len; x += s.bend || 0; y += s.rise || 0; h = h1; }
  }
  function along(z, k0, k1) {
    if (!segs.length) return 0;
    if (z <= 0) return segs[0][k0];
    for (const s of segs) if (z < s.z1) return s[k0] + (s[k1] - s[k0]) * ease((z - s.z0) / (s.z1 - s.z0));
    return segs[segs.length - 1][k1];
  }
  const trackX = z => (C.track && C.track.x) ? C.track.x(z) : C.kind === 'track' ? along(z, 'x0', 'x1') : 0;
  const trackY = z => (C.track && C.track.y) ? C.track.y(z) : C.kind === 'track' ? along(z, 'y0', 'y1') : 0;
  const trackHalf = z => !C.track ? 0 : segs.length ? along(z, 'h0', 'h1') : (C.track.half || 3);
  const heading = z => (trackX(z + 1) - trackX(z - 1)) / 2;
  const trackEnd = () => segs.length ? segs[segs.length - 1].z1 : 400;

  // ── the projection (world.js's pinhole, kept to the pixel) ──
  const focal = () => (C.camera.focal || 0.9) * (cam.zoom || 1);
  const eye = (x, z) => { const dx = x - cam.x, dz = z - cam.z; return [dx * cam.c - dz * cam.s, dx * cam.s + dz * cam.c + C.camera.back]; };
  function project(x, y, z) {
    if (C.camera.mode === 'orbit' && camera) { const v = new THREE.Vector3(X(x), y, z).project(camera); return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, s: W * 0.5 / Math.max(0.05, camera.position.distanceTo(new THREE.Vector3(X(x), y, z))) }; }
    // in the 2D canvas's own frame, WITHOUT the engine's shake (2026-11-05, the engineer's kit note in run C: "WORLD.project
    // adds the engine's shake and the engine also translates the 2D canvas by it: overlays shake twice"). The engine moves
    // the 2D canvas by the shake and the world's camera carries it in its projection (setCamera), so a thing drawn on the
    // 2D canvas at this point sits on the world's pixel at rest and in a shake. A page element placed outside that canvas
    // adds ENGINE.shake itself.
    const e = eye(x, z), dz = Math.max(0.05, e[1]), k = W * focal();
    return { x: W / 2 + k * e[0] / dz, y: H * C.camera.horizon - k * (y - camY) / dz, s: k / dz };
  }
  const drawDist = () => C.drawDist || 160;
  const fadeAt = z => clamp((drawDist() - (z - cam.z)) / 30, 0, 1);

  // ── zones (as world.js) ──
  function zoneAt(z) { const Z = C.zones; let i = 0; while (i + 1 < Z.length && z >= Z[i + 1].at) i++; return Z[i]; }
  function zoneMix(z, span) {
    const Z = C.zones; let i = 0; while (i + 1 < Z.length && z >= Z[i + 1].at - span / 2) i++;
    if (i + 1 < Z.length) { const t = clamp((z - (Z[i + 1].at - span / 2)) / span, 0, 1); if (t > 0) return { a: Z[i], b: Z[i + 1], t: ease(t) }; }
    return { a: Z[i], b: Z[i], t: 0 };
  }
  const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const zc = (z, key, alt) => { const m = zoneMix(z, 10); return mixC(m.a[alt ? key + 'Alt' : key], m.b[alt ? key + 'Alt' : key], m.t); };

  // ── framings (as world.js: the subject's feet and share of the frame solve the camera's height and distance) ──
  const FRAMINGS = {
    // a runner or a vehicle seen from behind (the chase genre): low and close, or high and wide for a broad track
    'chase-low': { feet: 0.80, size: 0.15, horizon: 0.38, focal: 1.25 },
    'chase-high': { feet: 0.82, size: 0.12, horizon: 0.30, focal: 1.0 },
    // the thrower seen from behind, the target ahead (the throw-through-a-ring genre): the thrower lower and smaller in the
    // frame than a runner, the horizon a little higher so the target sits in the upper half
    'throw-back': { feet: 0.80, size: 0.15, horizon: 0.40, focal: 1.35 },   // a longer lens: the camera sits further back for the same hero share, so the target ahead reads larger (2026-11-04 02:06)
    // first person (2026-11-04 03:01, the owner: a thrower is not necessary): the camera at the thrower's eye, the HELD thing the
    // framed subject low in the frame, the target ahead; the subject is the ball or the product the player flicks
    'throw-first': { feet: 0.86, size: 0.16, horizon: 0.38, focal: 1.2 },
  };
  const BOUNDS = { feet: [0.60, 0.86], size: [0.08, 0.24], horizon: [0.28, 0.46], focal: [0.8, 1.5] };
  let framed = null, framedKey = '', frameU = 0;
  function frameSpec(c) {
    const base = FRAMINGS[c.framing] || (console.error(`world kit: unknown framing "${c.framing}"; chase-low is used (framings: ${Object.keys(FRAMINGS).join(', ')})`), FRAMINGS['chase-low']);
    const out = {};
    for (const k of Object.keys(BOUNDS)) { const v = typeof c[k] === 'number' ? c[k] : base[k]; out[k] = Math.min(BOUNDS[k][1], Math.max(BOUNDS[k][0], v)); }
    return out;
  }
  function solveFraming(subjectH) {
    if (!framed) return;
    const a = W / H, s = subjectH > 0 ? subjectH : 1.1, key = `${a.toFixed(4)}:${s}`;
    if (key === framedKey) return; framedKey = key;
    const back = (a * framed.focal * s) / framed.size;
    C.camera.back = back; C.camera.height = ((framed.feet - framed.horizon) * back) / (a * framed.focal);
    C.camera.horizon = framed.horizon; C.camera.focal = framed.focal;
    C.camera.solved = { framing: C.camera.framing, feet: framed.feet, size: framed.size, horizon: framed.horizon, focal: framed.focal, subject: s, height: C.camera.height, back };
  }
  let configured = false;
  function configure(cfg) {
    if (configured) return; configured = true;
    C = Object.assign({ kind: 'track', band: 8, roadBand: 6 }, cfg || {});
    const raw = (cfg && cfg.camera) || {};   // the page's own numbers, read for the framing BEFORE the defaults land (a default horizon is not a nudge)
    C.camera = Object.assign({ mode: 'perspective', height: 2.2, back: 5, horizon: 0.38, focal: 0.9, span: 12, anchor: 0.72, floor: 0.78 }, C.camera || {});
    if (C.camera.mode !== 'perspective' && C.camera.mode !== 'orbit') console.error(`world kit (three): camera mode "${C.camera.mode}" is not on this kit yet; load world.js for it`);
    if (C.camera.framing) { framed = frameSpec(raw); solveFraming(C.camera.subject); }
    C.zones = (C.zones && C.zones.length ? C.zones : [{ at: 0 }]).map(z => ({
      at: z.at || 0, sky: (z.sky || ['#9fc3e6', '#e8eef5']).map(hex), ground: hex(z.ground || '#b9bcc2'), groundAlt: hex(z.groundAlt || z.ground || '#b0b3b9'),
      road: hex(z.road || '#8d9097'), roadAlt: hex(z.roadAlt || z.road || '#858890'), line: hex(z.line || '#ffffff'),
      groundTile: z.groundTile || null, roadTile: z.roadTile || null, skyPlate: z.skyPlate || null, haze: typeof z.haze === 'number' ? z.haze : 0.45,
      surface: z.surface || null, roadSurface: z.roadSurface || null, backdrop: z.backdrop || null }));
    C.lines = Object.assign({ dash: 3, gap: 3, width: 0.05, alpha: 0.55 }, C.lines || {});
    // the look (2026-11-04, the owner: "like Minecraft vanilla versus Minecraft shaders"): the pass after the render. ACES tone
    // mapping with an exposure, a half-resolution bloom on the bright things (threshold, strength), a vignette, a saturation
    // and a contrast lift. Knobs on VIEW.world.look; `?fx=0` (the quality scaler's last step) renders plain. No reflections,
    // no ray-traced light: a 5 MB ad holds 45 fps on a phone
    // the bloom threshold sits above 1: only what is brighter than white (an emissive glow, a sun glint) blooms; a pale sky at
    // 0.82 bloomed into a white veil over the whole frame (the first setting)
    // the light plan (2026-11-04 00:44, the owner: "the world lighting is really dull, low and uninspiring"): 'day' is one
    // warm sun with a sky hemisphere; 'arena' is a stage: a warm KEY spot from high front-left casting the shadows, a cool
    // FILL from the right, a cool RIM from behind so every actor has an edge, the hemisphere low. Both get a room
    // environment for reflections (the sheen on a floor, the gloss on sauce and metal), strength `env`
    // THE LOOK IS A LAW, NOT A MOOD (2026-11-04 00:50, after the owner's "did you just increase a lot of reflection and make it
    // very bright?"): a page names a STYLE and the style fixes the light rig, the post chain and the exposure rule; the
    // numbers are the ones measured off shipped games in the R&D (compare-2026-11-02/higgsfield-playable-skill/look.md §1, §3, §4).
    //   'toy'      casual: no tone mapping, hemisphere 1.5 + one sun 1.85 with a PCF shadow map, no bloom, roughness 0.62
    //   'premium'  stylized-realistic: a warm sun 2.5 from front-left casting shadows, a cool rim 0.9 from behind, a hemisphere
    //              1.05 (sky #d6e6ff, ground #9a7a55), an environment from a small generated sky (zenith to horizon, a ground
    //              band, a sun spot, two soft boxes), bloom threshold 0.9 strength 0.55, saturation 1.1, contrast 1.06,
    //              vignette 0.24, a warm tint; tone mapping OFF (a lit face clips at white), so the LIGHT BUDGET rules: sun +
    //              hemisphere at most 2.6 on a lit face, and play surfaces mid-tone (albedo 0.55-0.80, saturation 0.30-0.65)
    //   'arena'    premium at night on a stage: the sun becomes a warm key spot, the rim stronger, the hemisphere low
    // Knobs on VIEW.world.look override a style's numbers one by one.
    const STYLES = {
      toy: { tone: 'none', sun: 1.85, sky: 1.5, hemiSky: '#dfe9f5', hemiGround: '#8a7a55', rimLight: 0, env: 0.0, bloom: 0, vignette: 0.0, saturation: 1.0, contrast: 1.0, exposure: 1.0, lights: 'day', outline: 0.014, contact: 0.28 },
      premium: { tone: 'none', sun: 1.8, sky: 0.85, hemiSky: '#d6e6ff', hemiGround: '#9a7a55', rimLight: 0.9, env: 0.6, bloom: 0.55, threshold: 1.0, outline: 0, contact: 0.24, radius: 0.35, vignette: 0.24, saturation: 1.1, contrast: 1.06, exposure: 1.0, lights: 'day', tint: [1.015, 1.0, 0.98] },
      arena: { tone: 'none', sun: 2.0, sky: 0.26, hemiSky: '#6a7aa8', hemiGround: '#2a2420', rimLight: 1.0, env: 0.6, bloom: 0.55, threshold: 1.0, outline: 0, contact: 0.3, radius: 0.35, vignette: 0.55, saturation: 1.12, contrast: 1.1, exposure: 1.0, lights: 'arena', tint: [1.01, 1.0, 0.99], heroLight: 1.0 },
    };
    STYLES.toy.heroLight = 0; STYLES.premium.heroLight = 0.5;
    const style = STYLES[(C.look && C.look.style) || 'toy'] || STYLES.toy;
    // the bands (2026-11-05): the first full session build lifted the arena's hemisphere from 0.5 to 0.95 to light the piece in
    // hand, and the night arena became a lit room. A page may move a number to half or one-and-a-half times the style's, no
    // further; the hero light is the way to light a hero
    if (C.look) for (const k of ['sun', 'sky', 'rimLight', 'env', 'bloom', 'exposure', 'heroLight']) {
      if (typeof C.look[k] === 'number' && typeof style[k] === 'number' && style[k] > 0) { const lo = style[k] * 0.5, hi = style[k] * 1.5; if (C.look[k] < lo || C.look[k] > hi) { console.warn(`world kit: look.${k} ${C.look[k]} held to the ${C.look.style || 'toy'} style's band ${lo.toFixed(2)} to ${hi.toFixed(2)}`); C.look[k] = Math.min(hi, Math.max(lo, C.look[k])); } }
    }
    C.look = Object.assign({ style: 'toy', exposure: 1.0, bloom: 0, threshold: 0.9, radius: 0.35, vignette: 0, saturation: 1, contrast: 1, sun: 1.85, sky: 1.5, lights: 'day', env: 0, key: '#ffe2b8', fill: '#8fb4ff', rim: '#9fd0ff', tone: 'none', tint: [1, 1, 1], outline: 0, contact: 0.25, heroLight: 0 }, style, C.look || {});
    camY = C.camera.height;
    buildPath();
  }

  // ── the scene ──
  const X = x => -x;   // the kit's x (right, looking along +z) to three's (left): mirrored once, here
  function bandTexture(a, b, units) {   // two tones in bands along z (the greybox's speed bands, P7), one texture
    const c = document.createElement('canvas'); c.width = 4; c.height = 64; const o = c.getContext('2d');
    o.fillStyle = `rgb(${a.map(v => Math.round(v * 255)).join(',')})`; o.fillRect(0, 0, 4, 32); o.fillStyle = `rgb(${b.map(v => Math.round(v * 255)).join(',')})`; o.fillRect(0, 32, 4, 32);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter; t.colorSpace = THREE.SRGBColorSpace; t.userData.units = units * 2; return t;
  }
  function ribbon(halfAt, yAt, zEnd, colourAt, step) {   // a strip along the track: positions, vertex colours, uv (u across, v along in units)
    const pos = [], col = [], uv = [], idx = []; let n = 0;
    for (let z = -40; z <= zEnd; z += step) {
      const cx = trackX(z), cy = trackY(z) + yAt, h = halfAt(z), c = colourAt(z);
      pos.push(X(cx - h), cy, z, X(cx + h), cy, z); col.push(c[0], c[1], c[2], c[0], c[1], c[2]); uv.push(0, z, 1, z);
      if (n > 0) idx.push(n * 2 - 2, n * 2, n * 2 - 1, n * 2 - 1, n * 2, n * 2 + 1); n++;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  /* a ground or road material: the zone's colour is the tone (vertex colours), and over it either a baked SURFACE recipe
     (the surface kit, world-space xz so the pattern never stretches with the ribbon) or the greybox's speed bands */
  function surfaceMaterial(surface, band, acrossRepeat) {
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.35 });   // the ground takes the environment at 0.35 (look.md §3): a floor lit by the sky's boxes on top of the sun clipped to white
    if (surface) {
      const b = SURFACES.bake(surface); m.map = b.map; m.normalMap = b.normalMap; m.normalScale.set(1.2, 1.2); m.roughness = 1 - 0.6 * (typeof surface === 'object' && surface.gloss != null ? surface.gloss : (b.gloss || 0));
      m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>\n { vec4 wp = modelMatrix * vec4(position, 1.0); vec2 suv = wp.xz / ${b.scale.toFixed(3)}; vMapUv = suv; vNormalMapUv = suv; }`); };
      m.userData.surface = b.recipe;
    } else {
      m.map = bandTexture([1, 1, 1], [0.94, 0.94, 0.94], band);
      m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>\n vMapUv = vec2(uv.x * ${acrossRepeat.toFixed(1)}, uv.y / ${(band * 2).toFixed(2)});`); };
    }
    return m;
  }
  function buildGround() {
    const far = C.kind === 'track' ? trackEnd() + 60 : 400, z0 = C.zones[0];
    const ground = new THREE.Mesh(ribbon(() => 120, -0.02, far, z => zc(z, 'ground'), C.kind === 'track' ? 2 : 20), surfaceMaterial(z0.surface, C.band, 60)); ground.receiveShadow = true; ground.userData.ground = true; scene.add(ground);
    if (z0.surface) { const b = SURFACES.bake(z0.surface); groundTile = { recipe: b.recipe, scale: b.scale }; }
    if (C.kind === 'track') {
      const road = new THREE.Mesh(ribbon(z => trackHalf(z), 0.01, far, z => zc(z, 'road'), 1), surfaceMaterial(z0.roadSurface, C.roadBand, 1)); road.receiveShadow = true; road.userData.ground = true; scene.add(road);
      // the verges: a darker edge line either side of the road reads the width (as the GPU kit's edge)
      const vm = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
      for (const sgn of [-1, 1]) {
        const g = ribbon(() => 0.06, 0.02, far, z => zc(z, 'road').map(v => v * 0.45), 1);
        const p = g.attributes.position; for (let k = 0; k < p.count; k++) { const z = p.getZ(k); p.setX(k, X(trackX(z) + sgn * trackHalf(z) + (k % 2 ? 0.06 : -0.06))); }
        const vg = new THREE.Mesh(g, vm); vg.userData.ground = true; scene.add(vg);
      }
      // lane lines: dashed strips between lanes
      const lanes = (C.track && C.track.lanes) || 0;
      if (lanes > 1) {
        const dash = document.createElement('canvas'); dash.width = 4; dash.height = 64; const o = dash.getContext('2d'); o.clearRect(0, 0, 4, 64); o.fillStyle = '#fff'; o.fillRect(0, 0, 4, Math.round(64 * C.lines.dash / (C.lines.dash + C.lines.gap)));
        const dt = new THREE.CanvasTexture(dash); dt.wrapS = dt.wrapT = THREE.RepeatWrapping; dt.magFilter = THREE.NearestFilter;
        const lm = new THREE.MeshBasicMaterial({ map: dt, transparent: true, opacity: C.lines.alpha, vertexColors: true, side: THREE.DoubleSide, depthWrite: false });
        lm.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>\n vMapUv = vec2(uv.x, uv.y / ${(C.lines.dash + C.lines.gap).toFixed(2)});`); };
        for (let i = 1; i < lanes; i++) {
          const f = -1 + 2 * i / lanes;
          const g = ribbon(() => C.lines.width, 0.02, far, z => zc(z, 'line'), 1);
          const p = g.attributes.position; for (let k = 0; k < p.count; k++) { const z = p.getZ(k); p.setX(k, X(trackX(z) + f * trackHalf(z) + (k % 2 ? C.lines.width : -C.lines.width))); }
          const lg = new THREE.Mesh(g, lm); lg.userData.ground = true; scene.add(lg);
        }
      }
    }
  }
  function buildSky() {
    const z0 = C.zones[0];
    const mat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false, toneMapped: false,   // the sky keeps the zone's own colours under the look's tone mapping
      uniforms: { top: { value: col3(z0.sky[0]) }, hor: { value: col3(z0.sky[1]) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 hor; varying vec3 vP; void main(){ float t = smoothstep(-0.02, 0.45, vP.y); gl_FragColor = vec4(mix(hor, top, t), 1.0); }' });
    sky = new THREE.Mesh(new THREE.SphereGeometry(600, 24, 12), mat); sky.frustumCulled = false; scene.add(sky);
  }
  function setupScene() {
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 800); camera.matrixAutoUpdate = false; scene.add(camera);
    if (C.look.lights === 'arena') {
      // a stage: the sun is a warm key spot (physical falloff; 420 cd per unit of `sun` lands about `sun` on the floor at 17 m)
      sun = new THREE.SpotLight(C.look.key, C.look.sun * 420, 0, 0.6, 0.45, 2); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03; sun.shadow.camera.near = 2; sun.shadow.camera.far = 80;
      scene.add(sun); scene.add(sun.target);
      fill = new THREE.DirectionalLight(C.look.fill, 0.45); scene.add(fill); scene.add(fill.target);
    } else {
      sun = new THREE.DirectionalLight('#fff4e0', C.look.sun); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
      Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 30, bottom: -8, near: 1, far: 70 }); scene.add(sun); scene.add(sun.target);
    }
    if (C.look.rimLight > 0) { rim = new THREE.DirectionalLight(C.look.rim, C.look.rimLight); scene.add(rim); scene.add(rim.target); }
    hemi = new THREE.HemisphereLight(C.look.hemiSky, C.look.hemiGround, C.look.sky); scene.add(hemi);
    // THE RIG'S COUNT NEVER CHANGES AFTER THIS LINE (2026-11-05, the owner on run C's Game 2: "even on PC it's starting to lag
    // and stutter in the middle"): a light switched off or on changes every lit material's shader, and the graphics card
    // builds them all again in one frame (measured: 15 programs, 1.75 s, the instant the payoff took the hero away). A light
    // that is not wanted this frame stays in the scene at intensity 0.
    if (C.look.heroLight > 0) { heroLight = new THREE.PointLight(C.look.key, 0, 9, 2); scene.add(heroLight); }   // follows the hero (end())
    if (C.look.env > 0) { scene.environment = skyEnvironment(); scene.environmentIntensity = C.look.env; }
    const haze = C.zones[0].sky[1];
    scene.fog = new THREE.Fog(col3(haze), drawDist() * 0.45, drawDist());
    buildSky(); buildBackdrop(); buildGround(); buildLook();
  }
  // ── the backdrop strip: a cylinder around the camera under the dome, its picture drawn by recipe or given (the pack's plate) ──
  const css = c => `rgb(${c.map(v => Math.round(Math.min(1, Math.max(0, v)) * 255)).join(',')})`;
  function backdropTexture(b, z0) {
    const cw = 2048, ch = 768, c = document.createElement('canvas'); c.width = cw; c.height = ch; const o = c.getContext('2d');
    const cols = (b.colours && b.colours.length ? b.colours : ['#140c0a', '#ffb347', '#ff6a3d', '#ffe6a8']).map(hex);
    const base = cols[0], lights = cols.slice(1).length ? cols.slice(1) : [[1, 0.8, 0.5]];
    const rnd = (() => { let s = (b.seed || 7) * 9301 + 49297; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; })();
    o.fillStyle = css(base); o.fillRect(0, 0, cw, ch);
    if (b.recipe === 'bokeh') {
      // a dark hall of blurred lights: denser and larger low (the stands), sparse high (the roof); a faint band where the seating is
      for (let i = 0; i < (b.count || 170); i++) {
        const x = rnd() * cw, y = ch * (0.28 + 0.6 * Math.pow(rnd(), 0.7)), r = 6 + 34 * Math.pow(rnd(), 2.2), col = lights[Math.floor(rnd() * lights.length)], a = 0.22 + 0.5 * rnd();
        const g = o.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, `rgba(${col.map(v => Math.round(v * 255)).join(',')},${a.toFixed(2)})`); g.addColorStop(0.55, `rgba(${col.map(v => Math.round(v * 255)).join(',')},${(a * 0.45).toFixed(2)})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        o.fillStyle = g; o.beginPath(); o.arc(x, y, r, 0, Math.PI * 2); o.fill();
      }
      const band = o.createLinearGradient(0, ch * 0.55, 0, ch); band.addColorStop(0, 'rgba(0,0,0,0)'); band.addColorStop(1, 'rgba(0,0,0,0.35)'); o.fillStyle = band; o.fillRect(0, 0, cw, ch);
    } else if (b.recipe === 'stands') {
      // rows of seats rising, two tones, a rail and a line of small lights above the top row
      const rows = b.rows || 7, rowH = ch * 0.07;
      for (let r = 0; r < rows; r++) {
        const y = ch * 0.92 - r * rowH, tone = 0.55 + 0.45 * (r / rows);
        o.fillStyle = css(base.map(v => v * (0.8 + 0.5 * tone))); o.fillRect(0, y - rowH, cw, rowH);
        const seatW = cw / 90, dark = css(base.map(v => v * 0.45)), lit = lights[r % lights.length];
        for (let i = 0; i < 90; i++) { const x = i * seatW + (r % 2 ? seatW / 2 : 0); o.fillStyle = rnd() < 0.18 ? css(lit.map(v => v * 0.85)) : dark; o.fillRect(x + 2, y - rowH * 0.85, seatW - 4, rowH * 0.7); }
      }
      o.fillStyle = css(lights[0].map(v => v * 0.6)); o.fillRect(0, ch * 0.92 - rows * rowH - 6, cw, 6);
      for (let i = 0; i < 24; i++) { const x = (i + 0.5) * cw / 24, y = ch * 0.92 - rows * rowH - 40; const g = o.createRadialGradient(x, y, 0, x, y, 26); g.addColorStop(0, 'rgba(255,245,220,0.9)'); g.addColorStop(1, 'rgba(255,245,220,0)'); o.fillStyle = g; o.fillRect(x - 26, y - 26, 52, 52); }
    } else if (b.recipe === 'skyline') {
      // building silhouettes against the dome, lit windows; the sky above is the dome (transparent here)
      o.clearRect(0, 0, cw, ch);
      let x = 0; const dark = css(base);
      while (x < cw) { const w = 40 + rnd() * 140, h = ch * (0.25 + 0.5 * rnd()); o.fillStyle = dark; o.fillRect(x, ch - h, w, h);
        for (let wy = ch - h + 12; wy < ch - 8; wy += 14) for (let wx = x + 6; wx < x + w - 8; wx += 12) if (rnd() < 0.3) { o.fillStyle = css(lights[Math.floor(rnd() * lights.length)]); o.fillRect(wx, wy, 6, 8); }
        x += w + 4 + rnd() * 20; }
    }
    // the foot blends into the haze, the top into the dome
    const foot = o.createLinearGradient(0, ch * 0.86, 0, ch); foot.addColorStop(0, `rgba(${z0.sky[1].map(v => Math.round(v * 255)).join(',')},0)`); foot.addColorStop(1, `rgba(${z0.sky[1].map(v => Math.round(v * 255)).join(',')},${b.recipe === 'skyline' ? 0 : 0.9})`); o.fillStyle = foot; o.fillRect(0, 0, cw, ch);
    o.globalCompositeOperation = 'destination-out'; const top = o.createLinearGradient(0, 0, 0, ch * 0.22); top.addColorStop(0, 'rgba(0,0,0,1)'); top.addColorStop(1, 'rgba(0,0,0,0)'); o.fillStyle = top; o.fillRect(0, 0, cw, ch * 0.22); o.globalCompositeOperation = 'source-over';
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4; return t;
  }
  function setStrip(tex, aspect, b, kind) {
    // the picture stands for `span` units of the hall's wall (60 by default) and repeats around the cylinder, so a seat is a
    // seat and a lamp a lamp whatever the draw distance (the first strip wrapped once: every seat a five-metre block)
    if (strip) { scene.remove(strip); strip.geometry.dispose(); strip.material.dispose(); strip = null; }
    const r = drawDist() * 0.9, span = (b && b.span) || 60, reps = Math.max(1, Math.round((2 * Math.PI * r) / span)), h = span * aspect * ((b && b.height) || 1);
    tex.repeat.set(reps, 1); tex.wrapS = THREE.RepeatWrapping; tex.needsUpdate = true;
    const m = new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, transparent: true, depthWrite: false, fog: false, toneMapped: false });
    strip = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 64, 1, true), m); strip.frustumCulled = false; strip.renderOrder = -1; strip.userData.h = h; strip.userData.kind = kind; scene.add(strip);
  }
  function buildBackdrop() {
    const z0 = C.zones[0], b = z0.backdrop; if (!b) return;
    if (b.image && b.image.width) setStrip(texOf(b.image), b.image.height / b.image.width, b, 'image');
    else if (b.recipe) setStrip(backdropTexture(b, z0), 768 / 2048, b, b.recipe);
  }
  // the painted plate IS the backdrop (2026-11-05, run C: the engineer named the painted wall as the zone's skyPlate, the 3D kit
  // took the word and drew nothing, and the recipe's rectangles stood where the painting should have been). A zone's
  // `skyPlate` (or backdrop.layer) names a plate layer; when its picture has loaded it becomes the strip, its top faded into
  // the dome; until then the recipe stands in, the same rule as a model and its stand-in.
  function plateBackdrop() {
    const z0 = C.zones[0]; if (!z0) return;
    const id = z0.skyPlate || (z0.backdrop && z0.backdrop.layer); if (!id || (strip && strip.userData.kind === 'plate:' + id)) return;
    const LA = typeof LAYERS !== 'undefined' ? LAYERS : (window.LAYERS || null), img = LA && LA.ART && LA.ART[id];
    if (!img || !img.width) return;
    const cw = Math.min(2048, img.width), ch = Math.round(cw * img.height / img.width), c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const o = c.getContext('2d'); o.drawImage(img, 0, 0, cw, ch);
    o.globalCompositeOperation = 'destination-out'; const top = o.createLinearGradient(0, 0, 0, ch * 0.12); top.addColorStop(0, 'rgba(0,0,0,1)'); top.addColorStop(1, 'rgba(0,0,0,0)'); o.fillStyle = top; o.fillRect(0, 0, cw, ch * 0.12);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    setStrip(t, img.height / img.width, z0.backdrop, 'plate:' + id);
  }
  // ── the environment for reflections: a PMREM of a small generated sky, never an image file (look.md §4.1) ──
  function skyEnvironment() {
    const z0 = C.zones[0], top = col3(z0.sky[0]), hor = col3(z0.sky[1]), ground = col3(z0.ground);
    const env = new THREE.Scene();
    const mat = new THREE.ShaderMaterial({ side: THREE.BackSide,
      uniforms: { top: { value: top }, hor: { value: hor }, ground: { value: ground } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 top; uniform vec3 hor; uniform vec3 ground; varying vec3 vP;
        void main(){ vec3 d = normalize(vP); vec3 c = d.y < 0.0 ? mix(hor, ground * 0.8, smoothstep(0.0, -0.25, d.y)) : mix(hor, top, smoothstep(0.0, 0.5, d.y));
          vec3 sunDir = normalize(vec3(-0.45, 0.6, 0.65)); float ds = max(0.0, dot(d, sunDir)); c += vec3(1.0, 0.95, 0.85) * (pow(ds, 700.0) * 30.0 + pow(ds, 18.0) * 1.2);
          vec3 keyDir = normalize(vec3(-0.2, 0.75, -0.6)); c += vec3(1.0) * 1.3 * smoothstep(0.86, 0.93, dot(d, keyDir));
          vec3 stripDir = normalize(vec3(0.9, 0.25, 0.1)); c += vec3(1.0) * 1.5 * smoothstep(0.965, 0.985, dot(d, stripDir));
          gl_FragColor = vec4(c, 1.0); }` });
    env.add(new THREE.Mesh(new THREE.SphereGeometry(50, 32, 16), mat));
    const pm = new THREE.PMREMGenerator(R); const tex = pm.fromScene(env, 0.02).texture; pm.dispose(); return tex;
  }
  // ── the look: the post chain ──
  let composer = null, bloom = null, grade = null;
  const FX = !new URLSearchParams(location.search).has('fx') || new URLSearchParams(location.search).get('fx') !== '0';
  const GRADE = {
    uniforms: { tDiffuse: { value: null }, uVignette: { value: 0.3 }, uSat: { value: 1.1 }, uCon: { value: 1.05 }, uTint: { value: new THREE.Vector3(1, 1, 1) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    // the grade (look.md §4.3): a highlight shoulder at 0.78 so a clipped face rolls off instead of stepping, saturation, contrast,
    // a vignette, a warm tint, a dither against banding
    fragmentShader: 'uniform sampler2D tDiffuse; uniform float uVignette; uniform float uSat; uniform float uCon; uniform vec3 uTint; varying vec2 vUv; void main(){ vec4 c = texture2D(tDiffuse, vUv); c.rgb = mix(c.rgb, 0.78 + (1.0 - 0.78) * (1.0 - exp(-(c.rgb - 0.78) / (1.0 - 0.78))), step(0.78, c.rgb)); float l = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722)); c.rgb = mix(vec3(l), c.rgb, uSat); c.rgb = (c.rgb - 0.5) * uCon + 0.5; vec2 q = vUv - 0.5; float v = 1.0 - uVignette * smoothstep(0.25, 0.75, dot(q, q) * 2.0); c.rgb *= v * uTint; c.rgb += (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.012; gl_FragColor = c; }',
  };
  function buildLook() {
    R.toneMapping = C.look.tone === 'aces' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping; R.toneMappingExposure = C.look.exposure;
    if (!FX) return;
    if (!(C.look.bloom > 0) && C.look.vignette === 0 && C.look.saturation === 1 && C.look.contrast === 1) return;   // the toy style: a plain render
    composer = new EffectComposer(R); composer.setPixelRatio(dpr); composer.setSize(W, H);
    composer.addPass(new RenderPass(scene, camera));
    if (C.look.bloom > 0) { bloom = new UnrealBloomPass(new THREE.Vector2(Math.max(64, W / 2), Math.max(64, H / 2)), C.look.bloom, C.look.radius, C.look.threshold); composer.addPass(bloom); }
    grade = new ShaderPass(GRADE); grade.uniforms.uVignette.value = C.look.vignette; grade.uniforms.uSat.value = C.look.saturation; grade.uniforms.uCon.value = C.look.contrast; grade.uniforms.uTint.value.fromArray(C.look.tint || [1, 1, 1]); composer.addPass(grade);
    composer.addPass(new OutputPass());
  }
  function init(cfg) {
    if (tried) return ok; tried = true;
    configure(cfg);
    const under = document.getElementById('game');
    if (!under) return (ok = false);
    try {
      R = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFShadowMap; R.outputColorSpace = THREE.SRGBColorSpace;
      cv = R.domElement; cv.id = 'world'; cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
      under.parentNode.insertBefore(cv, under);
      measure(); setupScene(); ok = true;
    } catch (e) { console.error('world kit (three)', e); ok = false; if (cv) cv.remove(); return false; }
    new ResizeObserver(measure).observe(cv);
    // the orbit camera (2026-11-04, the owner on the materials page: "does not let me rotate and zoom in, zoom out, and pan"):
    // an inspection mode for a review page, never a game's: drag turns, the wheel or a pinch zooms, a right drag or two
    // fingers pan; the camera starts where the follow point and the page's `orbit` say
    if (C.camera.mode === 'orbit') {
      camera.matrixAutoUpdate = true; const o = C.camera.orbit || {};
      camera.fov = o.fov || 45; camera.near = 0.1; camera.far = 800; camera.aspect = W / H; camera.updateProjectionMatrix();
      camera.position.set(X(o.x == null ? 4 : o.x), o.y == null ? 5 : o.y, o.z == null ? -6 : o.z);
      orbit = new OrbitControls(camera, cv.parentNode); orbit.target.set(X(o.tx || 0), o.ty || 0.5, o.tz || 3); orbit.enableDamping = true; orbit.dampingFactor = 0.08; orbit.minDistance = o.min || 1.5; orbit.maxDistance = o.max || 60; orbit.maxPolarAngle = Math.PI * 0.49; orbit.update();
      cv.parentNode.style.touchAction = 'none';
    }
    cv.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; });
    cv.addEventListener('webglcontextrestored', () => { lost = false; });
    return true;
  }
  function measure() {
    if (!cv) return;
    const r = cv.getBoundingClientRect(); W = r.width || 640; H = r.height || 960; dpr = Math.min(1.5, devicePixelRatio || 1);
    if (R) { R.setPixelRatio(dpr); R.setSize(W, H, false); }
    if (composer) { composer.setPixelRatio(dpr); composer.setSize(W, H); if (bloom) bloom.setSize(Math.max(64, W / 2), Math.max(64, H / 2)); }
  }

  // ── pools: one mesh per drawn thing, reused frame to frame ──
  const GEO = {
    box: () => new THREE.BoxGeometry(1, 1, 1),
    disc: () => new THREE.SphereGeometry(0.5, 24, 16),
    ring: () => new THREE.TorusGeometry(0.42, 0.08, 14, 40),       // outer radius 0.5; lies in the xy plane, facing z
    capsule: () => new THREE.CapsuleGeometry(0.5, 1, 6, 14),       // 2 tall at scale 1 (radius 0.5 + 1 + 0.5)
    blob: () => new THREE.SphereGeometry(0.5, 16, 10),
    ball: () => new THREE.SphereGeometry(0.5, 32, 24),             // a sphere with seams drawn on it (a basketball, a tennis ball)
    lamp: () => new THREE.SphereGeometry(0.5, 12, 8),              // an emissive sphere brighter than white: it blooms (a stadium light, a bulb)
    rim: () => new THREE.TorusGeometry(0.47, 0.03, 12, 56),        // a thin metal rim (outer radius 0.5), lying in the xy plane like 'ring'
    net: () => new THREE.CylinderGeometry(0.5, 0.3, 1, 24, 6, true),   // a hanging net: a tapered open sleeve with a woven alpha map
    shadow: () => new THREE.CircleGeometry(0.5, 24),
    rounded: () => { const s = new THREE.Shape(), r = 0.12, a = -0.5 + r, b = 0.5 - r; s.moveTo(a, -0.5); s.lineTo(b, -0.5); s.quadraticCurveTo(0.5, -0.5, 0.5, a); s.lineTo(0.5, b); s.quadraticCurveTo(0.5, 0.5, b, 0.5); s.lineTo(a, 0.5); s.quadraticCurveTo(-0.5, 0.5, -0.5, b); s.lineTo(-0.5, a); s.quadraticCurveTo(-0.5, -0.5, a, -0.5);
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.76, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 3, curveSegments: 6 }); g.translate(0, 0, -0.5); g.computeVertexNormals(); return g; },
  };
  // custom geometry by its points (2026-11-05): a lathe from a profile, a bevelled plate from an outline; centred like a box
  const CUSTOM = new Map();
  function customGeo(kind, o) {
    if (kind === 'lathe' && o && o.profile) {
      const key = 'lathe:' + JSON.stringify(o.profile); if (!CUSTOM.has(key)) CUSTOM.set(key, () => { const pts = o.profile.map(p => new THREE.Vector2(Math.max(0.001, p[0]), p[1])); const g = new THREE.LatheGeometry(pts, o.segments || 24); g.translate(0, -0.5, 0); g.computeVertexNormals(); return g; });
      return { key, make: CUSTOM.get(key) };
    }
    if (kind === 'plate' && o && o.outline) {
      const key = 'plate:' + JSON.stringify(o.outline) + ':' + (o.bevel || 0.06); if (!CUSTOM.has(key)) CUSTOM.set(key, () => { const s = new THREE.Shape(o.outline.map(p => new THREE.Vector2(p[0] - 0.5, p[1] - 0.5))); const bv = o.bevel || 0.06; const g = new THREE.ExtrudeGeometry(s, { depth: 1 - bv * 2, bevelEnabled: true, bevelThickness: bv, bevelSize: bv * 0.8, bevelSegments: 2, curveSegments: 4 }); g.translate(0, 0, -0.5); g.computeVertexNormals(); return g; });
      return { key, make: CUSTOM.get(key) };
    }
    return null;
  }
  let netMap = null;
  function netTexture() {   // the weave: two families of diagonal cords on a transparent ground
    if (netMap) return netMap;
    const c = document.createElement('canvas'); c.width = 256; c.height = 256; const o = c.getContext('2d');
    o.clearRect(0, 0, 256, 256); o.strokeStyle = '#fff'; o.lineWidth = 9; o.lineCap = 'round';
    for (let i = -4; i < 8; i++) { o.beginPath(); o.moveTo(i * 64, 0); o.lineTo(i * 64 + 256, 256); o.stroke(); o.beginPath(); o.moveTo(i * 64 + 256, 0); o.lineTo(i * 64, 256); o.stroke(); }
    netMap = new THREE.CanvasTexture(c); netMap.wrapS = THREE.RepeatWrapping; netMap.wrapT = THREE.ClampToEdgeWrapping; netMap.repeat.set(3, 1); netMap.anisotropy = 4; return netMap;
  }
  let ballMap = null;
  function ballTexture() {   // the seams: two great circles and a wavy pair, dark on white, so the spin reads; the colour tints it
    if (ballMap) return ballMap;
    const c = document.createElement('canvas'); c.width = 512; c.height = 256; const o = c.getContext('2d');
    o.fillStyle = '#fff'; o.fillRect(0, 0, 512, 256); o.strokeStyle = 'rgba(40,20,10,0.85)'; o.lineWidth = 7; o.lineCap = 'round';
    o.beginPath(); o.moveTo(0, 128); o.lineTo(512, 128); o.stroke();
    for (const x of [128, 384]) { o.beginPath(); o.moveTo(x, 0); o.lineTo(x, 256); o.stroke(); }
    for (const s of [1, -1]) { o.beginPath(); for (let x = 0; x <= 512; x += 4) { const y = 128 + s * (64 + 40 * Math.cos(x / 512 * Math.PI * 2)); if (x === 0) o.moveTo(x, y); else o.lineTo(x, y); } o.stroke(); }
    ballMap = new THREE.CanvasTexture(c); ballMap.colorSpace = THREE.SRGBColorSpace; ballMap.anisotropy = 4; return ballMap;
  }
  const geo = {}, pools = {}, used = {};
  const OUTLINE_MAT = new THREE.MeshBasicMaterial({ color: '#141418', side: THREE.BackSide });   // the inverted hull: the mesh drawn again, a little larger, back faces only (the toy style's ink line)
  function take(kind, make) {
    const g = geo[kind] || (geo[kind] = (make || GEO[kind])());
    const pool = pools[kind] || (pools[kind] = []); const i = used[kind] || 0; used[kind] = i + 1;
    if (i < pool.length) { pool[i].visible = true; return pool[i]; }
    const mat = kind === 'lamp' ? new THREE.MeshBasicMaterial({ color: '#ffffff' })
      : kind === 'rim' ? new THREE.MeshStandardMaterial({ color: '#9aa0a8', roughness: 0.32, metalness: 0.75 })
      : kind === 'net' ? new THREE.MeshStandardMaterial({ color: '#fff', roughness: 0.9, metalness: 0, map: netTexture(), alphaMap: netTexture(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide, envMapIntensity: 0.2 })
      : new THREE.MeshStandardMaterial({ color: '#9aa0a8', roughness: kind === 'ball' ? 0.55 : 0.62, metalness: 0, map: kind === 'ball' ? ballTexture() : null });
    const m = new THREE.Mesh(g, mat);
    m.castShadow = kind !== 'shadow' && kind !== 'net'; m.receiveShadow = false;
    if (C.look.outline > 0 && kind !== 'shadow' && kind !== 'net' && kind !== 'lamp') { const hull = new THREE.Mesh(g, OUTLINE_MAT); hull.scale.setScalar(1 + C.look.outline * 2.2); hull.castShadow = false; m.add(hull); }
    scene.add(m); pool.push(m); return m;
  }
  function hideRest() {
    for (const k of Object.keys(pools)) { const p = pools[k]; for (let i = used[k] || 0; i < p.length; i++) p[i].visible = false; }
    for (const c of CROWDS.values()) { if (!c.used) c.body.visible = c.head.visible = false; c.used = false; }
    for (const b of BOARDS.values()) { if (!b.used) b.mesh.visible = false; b.used = false; }
  }
  function place(m, x, y, z, w, h, kind, o) {
    const gy = trackY(z);
    if (o && o.flat && kind !== 'ring' && kind !== 'rim') { m.position.set(X(x), gy + y + 0.01, z); m.rotation.set(-Math.PI / 2, 0, 0); m.scale.set(w, h, 0.02); return; }
    m.rotation.set(0, 0, 0);
    if ((kind === 'ring' || kind === 'rim') && o && o.flat) { m.position.set(X(x), gy + y, z); m.rotation.set(-Math.PI / 2, 0, 0); m.scale.set(w, h, 1); return; }   // lying flat: the opening faces the sky, centred on y; h is the depth across
    if (kind === 'ring' || kind === 'rim') { m.position.set(X(x), gy + y + h / 2, z); m.scale.set(w, h, 1); }
    else if (kind === 'net') { m.position.set(X(x), gy + y + h / 2, z); m.scale.set(w, h, w); }
    else if (kind === 'capsule') { m.position.set(X(x), gy + y + h / 2, z); m.scale.set(w, h / 2, w); }
    else if (kind === 'blob') { m.position.set(X(x), gy + y + h / 2, z); m.scale.set(w, h, w * 0.8); }
    else if (kind === 'ball') { m.position.set(X(x), gy + y + h / 2, z); m.scale.set(w, h, w); if (o && o.spin != null) m.rotation.set(o.spin, o.spinY || 0, 0); }
    else { m.position.set(X(x), gy + y + h / 2, z); m.scale.set(w, h, kind === 'box' || kind === 'rounded' || kind === 'plate' ? (o && o.d ? o.d : Math.min(w, h)) : w); }   // a box's depth: o.d, else its smaller side (a backboard names d, the physics plate's, 2026-11-04)
  }
  function tint(m, colour, alpha) {
    const c = colour ? hex(colour) : [1, 1, 1]; m.material.color.setRGB(c[0], c[1], c[2]);
    const a = alpha == null ? 1 : alpha;
    if (a < 1) { m.material.transparent = true; m.material.opacity = a; m.material.depthWrite = false; } else if (m.material.transparent) { m.material.transparent = false; m.material.opacity = 1; m.material.depthWrite = true; }
  }
  let hero = null;
  const SURF_MATS = new Map();
  function surfMat(spec) {   // a shape's own surface: the bake on every face, one tile per face (a block of stone, a crate of planks)
    const key = typeof spec === 'string' ? spec : JSON.stringify(spec);
    let m = SURF_MATS.get(key); if (m) return m;
    const b = SURFACES.bake(spec);
    m = new THREE.MeshStandardMaterial({ roughness: 1 - 0.6 * (b.gloss || 0), metalness: 0, map: b.map, normalMap: b.normalMap, normalScale: new THREE.Vector2(1.2, 1.2) });
    if (b.emissiveMap) { m.emissiveMap = b.emissiveMap; m.emissive = new THREE.Color('#ff6a1f'); m.emissiveIntensity = 2.0; }
    SURF_MATS.set(key, m); return m;
  }
  // ── material roles (2026-11-05): a shape names a role, the kit holds the material; numbers from the look reference §3 ──
  const ROLES = {
    matte: { roughness: 0.95, metalness: 0, env: 0.2 },
    lacquer: { physical: true, roughness: 0.36, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.15, env: 0.8 },
    metal: { roughness: 0.3, metalness: 0.9, env: 1.3 },
    gold: { roughness: 0.28, metalness: 0.9, env: 1.3 },
    wood: { roughness: 0.64, metalness: 0, env: 0.4 },
    cloth: { roughness: 0.85, metalness: 0, env: 0.3 },
    rubber: { roughness: 0.8, metalness: 0, env: 0.3 },
    glass: { roughness: 0.18, metalness: 0.3, env: 1.3, alpha: 0.45 },
    glow: { roughness: 0.6, metalness: 0, env: 0, emissive: 1.4 },
    mark: { roughness: 0.7, metalness: 0, env: 0, emissive: 0.12 },   // a cue, a painted marker: lit from within enough to read in any light, under the bloom threshold
  };
  const ROLE_MATS = new Map();
  function roleMat(role) {
    let m = ROLE_MATS.get(role); if (m) return m;
    const r = ROLES[role];
    m = r.physical ? new THREE.MeshPhysicalMaterial({ roughness: r.roughness, metalness: r.metalness, clearcoat: r.clearcoat || 0, clearcoatRoughness: r.clearcoatRoughness || 0, envMapIntensity: r.env })
      : new THREE.MeshStandardMaterial({ roughness: r.roughness, metalness: r.metalness, envMapIntensity: r.env });
    if (r.emissive) { m.emissive = new THREE.Color('#ffffff'); m.emissiveIntensity = r.emissive; }
    ROLE_MATS.set(role, m); return m;
  }
  const OWN_MAT = { ball: 1, net: 1, rim: 1, lamp: 1, shadow: 1 };   // kinds with a material of their own (a texture, a weave, a glow)
  // ── the crowd: rising rows of figures as one instanced pair, each on its own seed, swaying (2026-11-05: the first session
  //    build drew forty blobs by hand from the example, forty draw calls, bright as actors) ──
  const CROWDS = new Map();
  const _M = new THREE.Matrix4(), _Q = new THREE.Quaternion(), _P = new THREE.Vector3(), _S = new THREE.Vector3(), _C = new THREE.Color(), _AX = new THREE.Vector3(0, 0, 1);
  function crowd(o) {
    if (!ok) return; o = o || {};
    const rows = o.rows || 2, per = o.perRow || 20, n = rows * per, key = `crowd:${o.id || ''}:${rows}x${per}`;
    let c = CROWDS.get(key);
    if (!c) {
      const body = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.5, 1.0, 3, 8), new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, envMapIntensity: 0.2 }), n);
      const head = new THREE.InstancedMesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshStandardMaterial({ roughness: 0.8, metalness: 0, envMapIntensity: 0.2 }), n);
      body.castShadow = head.castShadow = false; body.receiveShadow = head.receiveShadow = false; scene.add(body); scene.add(head);
      c = { body, head, n, seeds: Array.from({ length: n }, (_, i) => (Math.sin(i * 12.9898 + 78.233) * 43758.5453) % 1) }; CROWDS.set(key, c);
    }
    c.used = true; c.body.visible = c.head.visible = true;
    const cols = (o.colours && o.colours.length ? o.colours : ['#e04b3a', '#3a6fd6', '#f2c14e', '#f0e9dc', '#2f9e6f']).map(hex), dim = o.dark ? 0.3 : 1;
    const w = o.w || 20, sp = w / per, bw = o.size || 0.55, bh = bw * 1.6, rise = o.rise == null ? 0.6 : o.rise, depth = o.depth == null ? 1.3 : o.depth, sway = o.sway == null ? 0.05 : o.sway;
    for (let r = 0; r < rows; r++) for (let i = 0; i < per; i++) {
      const k = r * per + i, s = Math.abs(c.seeds[k]), x = (o.x || 0) - w / 2 + (i + 0.5 + (r % 2 ? 0.5 : 0)) * sp, z = (o.z || 0) + r * depth, y = (o.y || 0) + r * rise;
      const bob = Math.sin(T * (1.6 + s) + k * 1.7) * sway, lean = Math.sin(T * 1.1 + k * 0.9) * 0.05;
      _Q.setFromAxisAngle(_AX, lean);
      _P.set(X(x), trackY(z) + y + bh * 0.5 + bob, z); _S.set(bw, bh / 2, bw * 0.8); _M.compose(_P, _Q, _S); c.body.setMatrixAt(k, _M);
      _P.set(X(x), trackY(z) + y + bh + bw * 0.28 + bob, z); _S.set(bw * 0.62, bw * 0.62, bw * 0.62); _M.compose(_P, _Q, _S); c.head.setMatrixAt(k, _M);
      const col = cols[(k * 7 + r * 3) % cols.length]; _C.setRGB(col[0] * dim, col[1] * dim, col[2] * dim); c.body.setColorAt(k, _C); _C.multiplyScalar(0.8); c.head.setColorAt(k, _C);
    }
    c.body.instanceMatrix.needsUpdate = c.head.instanceMatrix.needsUpdate = true; c.body.instanceColor.needsUpdate = c.head.instanceColor.needsUpdate = true;
    stats.sprites += n;
    // the tiers under the rows, from the same numbers (2026-11-05, run C: the engineer drew its own riser slabs beside the crowd
    // and the two disagreed, so the back rows stood buried to their heads): each row stands on a step whose top is its feet
    // and whose front is half a depth before it; tiers: false for a crowd on flat ground, tier: a colour for the steps
    if (o.tiers !== false && rows > 1 && rise > 0) {
      const tc = o.tier || '#2a1a16';
      for (let r = 0; r < rows; r++) { const top = (o.y || 0) + r * rise; if (top <= 0.02) continue; shape('box', o.x || 0, 0, (o.z || 0) + r * depth, w + sp, top, tc, { d: depth, shadow: false, contact: false, material: 'matte', id: `${key}:tier${r}` }); }
    }
  }
  // ── the message board: the campaign's line on a world surface, repeated and scrolling; emissive when it glows ──
  const BOARDS = new Map(), BOARD_TEX = new Map();
  function boardTexture(text, colour, ink, font) {
    const key = [text, colour, ink, font].join('|'); let t = BOARD_TEX.get(key); if (t) return t;
    const c = document.createElement('canvas'), o = c.getContext('2d'), f = font || '700 92px system-ui, Arial, sans-serif', unit = `${String(text || '').toUpperCase()}   •   `;
    c.width = 2048; c.height = 128; o.font = f; const uw = Math.max(64, o.measureText(unit).width), reps = Math.max(1, Math.round(2048 / uw));
    c.width = Math.round(reps * uw); o.font = f; o.textBaseline = 'middle';
    o.fillStyle = colour || '#1a1a1a'; o.fillRect(0, 0, c.width, 128); o.fillStyle = ink || '#ffffff';
    for (let i = 0; i < reps; i++) o.fillText(unit, i * uw, 66);
    t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4; t.userData.aspect = c.width / 128;
    BOARD_TEX.set(key, t); return t;
  }
  function board(o) {
    if (!ok) return; o = o || {};
    const key = `board:${o.id || ''}:${o.text}|${o.colour}|${o.ink}|${o.glow ? 1 : 0}`;
    let b = BOARDS.get(key);
    if (!b) {
      const tex = boardTexture(o.text, o.colour, o.ink, o.font).clone(); tex.needsUpdate = true;
      const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0, side: THREE.DoubleSide, emissive: new THREE.Color(o.glow ? '#ffffff' : '#000000'), emissiveMap: o.glow ? tex : null, emissiveIntensity: o.glow ? 1.25 : 0, envMapIntensity: 0.3 });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); mesh.castShadow = false; mesh.receiveShadow = false; scene.add(mesh);
      b = { mesh, tex, aspect: tex.userData.aspect }; BOARDS.set(key, b);
    }
    b.used = true; b.mesh.visible = true;
    const w = o.w || 6, h = o.h || 0.6, m = b.mesh;
    b.tex.repeat.set((w / h) / b.aspect, 1); b.tex.offset.x = (((o.speed == null ? 1 : o.speed) * T) / w) * b.tex.repeat.x * -1;
    m.position.set(X(o.x || 0), trackY(o.z || 0) + (o.y || 0) + h / 2, o.z || 0); m.rotation.set(0, Math.PI + (o.yaw || 0), 0); m.scale.set(w, h, 1);
    stats.sprites++;
  }
  /** the contact shadow: a dark soft disc on the ground under a thing, fading as it lifts (ad-structure 4.1 rule 6, 4.2 rule 1) */
  function contactShadow(x, z, w, y, h) {
    const s = take('shadow'); const lift = clamp(1 - y / Math.max(h * 1.5, 0.5), 0, 1);
    s.material.color.setRGB(0, 0, 0); s.material.transparent = true; s.material.opacity = C.look.contact * lift; s.material.depthWrite = false; s.castShadow = false;
    s.rotation.set(-Math.PI / 2, 0, 0); s.position.set(X(x), trackY(z) + 0.012, z); s.scale.set(w * 1.15, w * 0.6, 1); s.renderOrder = 0;
  }
  // a lamp's long soft shine in a varnished floor, where its mirror image would stand (2026-11-06, the look): the floor is lit, not painted, without a second render of the world
  let SHEEN_MAKE = null;
  function lampSheen(x, y, z, w, c) {
    const h = camera.position.y, cx = camera.position.x, cz = camera.position.z, t = h / (h + y + 0.001), lx = X(x);
    if (!(z > cz + 1)) return;
    SHEEN_MAKE = SHEEN_MAKE || (() => {
      const cvs = document.createElement('canvas'); cvs.width = cvs.height = 64; const g = cvs.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cvs), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false })); mesh.renderOrder = 1; mesh.rotation.set(-Math.PI / 2, 0, 0); return mesh;
    });
    const m = takeLq('sheen', SHEEN_MAKE), zm = cz + (z - cz) * Math.max(t, 0.42);
    m.material.color.setRGB(c[0] * 0.09, c[1] * 0.08, c[2] * 0.06);
    m.position.set(cx + (lx - cx) * t, trackY(zm) + 0.015, zm); m.scale.set(Math.max(0.5, w * 2.4), Math.max(1.5, (z - cz) * 0.3), 1);
  }
  function shape(kind, x, y, z, w, h, colour, o) {
    const custom = ok ? customGeo(kind, o) : null;
    if (!ok || (!GEO[kind] && !custom)) return;
    o = o || {};
    if (z > cam.z + drawDist() || eye(x, z)[1] < 0.3) return;
    const m = custom ? take(custom.key, custom.make) : take(kind); place(m, x, y, z, w, h, kind, o);
    // a stand-in on a body turns with it, as the mesh will: an upright shape over a rolling body reads as sliding on ice (the owner, 2026-11-06)
    if (o.body && o.body.q) { const q = o.body.q; m.position.set(X(o.body.x), trackY(z) + o.body.y, o.body.z); m.quaternion.set(q.x, -q.y, -q.z, q.w); }
    if (kind === 'lamp') { const c = hex(colour || '#fff8e0'); m.material.color.setRGB(c[0] * 2.2, c[1] * 2.2, c[2] * 2.2); m.castShadow = false; if (C.look.lights === 'arena') lampSheen(x, y, z, w, c); stats.sprites++; return; }
    if (o.contact !== false && !o.flat && C.look.contact > 0 && y <= 0.6 && kind !== 'shadow') contactShadow(x, z, w * (kind === 'capsule' ? 0.9 : 1.0), y, h);
    const role = o.material && ROLES[o.material] && !OWN_MAT[kind] ? o.material : null;
    if (o.surface) { const sm = surfMat(o.surface); if (m.userData.surf !== sm) { m.userData.plain = m.userData.plain || m.material; m.material = sm.clone(); m.userData.surf = sm; m.userData.role = null; } }
    else if (role) { if (m.userData.role !== role) { m.userData.plain = m.userData.plain || m.material; m.material = roleMat(role).clone(); m.userData.role = role; m.userData.surf = null; } }
    else if (m.userData.surf || m.userData.role) { m.material = m.userData.plain; m.userData.surf = null; m.userData.role = null; }
    tint(m, colour || '#9aa0a8', o.alpha != null ? o.alpha : (role ? ROLES[role].alpha : undefined));
    if (role === 'glow') m.material.emissive.copy(m.material.color);
    if (o.surface) m.material.color.multiplyScalar(1.55);   // the bake sits at a mid value (0.62): the tint is lifted back so the colour reads as given
    if (o.yaw) m.rotation.y += o.yaw;
    m.castShadow = o.shadow !== false && !o.flat;
    if (o.hero) { hero = { x, y, z, h }; heroInfo = { kind: typeof kind === 'string' ? kind : 'picture', role: typeof role === 'string' ? role : null }; }
    if (o.target) target = { x, y, z, h };
    stats.sprites++;
  }
  // pictures: a billboard plane standing on its y with the picture (the build's layers until the model pack replaces them);
  // one texture per image, the cell by offset and repeat; a blob shadow under it
  const TEX = new Map();
  function texOf(img) {
    let t = TEX.get(img); if (t) return t;
    t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 4; t.needsUpdate = true; t.flipY = true; TEX.set(img, t); return t;
  }
  const PIC = { pool: [], used: 0 };
  function picture(img, rect, x, y, z, w, h, o) {
    if (!ok || !img || !img.width) return;
    o = o || {};
    if (z > cam.z + drawDist() || eye(x, z)[1] < 0.3) return;
    let m = PIC.pool[PIC.used];
    if (!m) { m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ transparent: true, alphaTest: 0.1, side: THREE.DoubleSide, depthWrite: true })); scene.add(m); PIC.pool.push(m); }
    PIC.used++; m.visible = true;
    const t = texOf(img); if (m.material.map !== t) { m.material.map = t; m.material.needsUpdate = true; }
    const r = rect || [0, 0, img.width, img.height];
    m.material.map = t;
    // the cell: a per-mesh copy of the texture's window (offset and repeat live on the texture, so a cell needs its own)
    if (!m.userData.cellTex || m.userData.cellTex.image !== img) { const ct = t.clone(); ct.needsUpdate = true; m.userData.cellTex = ct; m.material.map = ct; }
    const ct = m.userData.cellTex; ct.offset.set(r[0] / img.width, 1 - (r[1] + r[3]) / img.height); ct.repeat.set(r[2] / img.width, r[3] / img.height);
    const gy = trackY(z), sink = y <= 0 ? (o.sink == null ? 0.025 : o.sink) : 0;
    if (o.flat) { m.position.set(X(x), gy + y + 0.01, z); m.rotation.set(-Math.PI / 2, 0, 0); m.scale.set(w, h, 1); }
    else { m.position.set(X(x), gy + y + h * (0.5 - sink), z); m.quaternion.copy(camera.quaternion); if (o.roll) m.rotateZ(o.roll); m.scale.set(w, h, 1); }   // o.roll: a turn about the view axis (a thrown thing tumbling)
    m.material.opacity = o.alpha == null ? 1 : o.alpha;
    if (o.shadow !== false && !o.flat) { const s = take('shadow'); s.material.color.setRGB(0, 0, 0); s.material.transparent = true; s.material.opacity = 0.32 * clamp(1 - y / Math.max(h * 2, 0.5), 0.25, 1); s.material.depthWrite = false; s.castShadow = false; s.rotation.set(-Math.PI / 2, 0, 0); s.position.set(X(x), gy + 0.015, z); s.scale.set(w * 1.1, w * 0.45, 1); }
    if (o.hero) { hero = { x, y, z, h }; heroInfo = { kind: typeof kind === 'string' ? kind : 'picture', role: typeof role === 'string' ? role : null }; }
    if (o.target) target = { x, y, z, h };
    stats.sprites++;
  }
  // ── the model pack in the world: a layer with a registered model draws the model in its box ──
  //   WORLD.model(layerId, url, { clips: { run: url }, play: 'run', lock, gy })   register (the kit draws the shape until it loads)
  //   layer(..., o): o.anim names the clip (else the cell's name, else the model's own), o.rate its pace, o.heading the
  //   direction it faces (dx per unit z, as the track's heading), o.pitch and o.roll a lean, o.hero the camera rule
  let dt = 0, lastT = 0;
  const model = (id, url, opts) => MODELS.load(id, url, opts);
  // A model layer is drawn as many times a frame as the game needs (2026-11-05, the owner on run C's Game 2: "why does the
  // chicken change into a basic circle near the hoop or on the ground?": the kit placed ONE copy of a model per layer, so a
  // game with several pieces alive gave the mesh to the one being watched and drew lumps for the rest). The first draw of a
  // frame is the model itself; each further draw is a COPY, pooled: the same geometry and textures, its own materials so a
  // copy can carry a tint (o.tint: a sauced piece beside a plain one). A rigged model stays one a frame (one skeleton, one pose).
  // And a model never brings its own size (the owner, the same day: "we don't ever fail on the scaling of hero"): it is
  // fitted INSIDE the slot's box, width and height both, the slot being the stand-in's size, which is the physics body's.
  const _MB = new THREE.Box3(), _MS = new THREE.Vector3(), _MC = new THREE.Vector3(), MODEL_BASE = new WeakMap();   // material -> its own colour, before any tint
  const baseOf = mat => { let b = MODEL_BASE.get(mat); if (!b && mat.color) { b = mat.color.clone(); MODEL_BASE.set(mat, b); } return b || null; };
  function modelBox(rec) {
    if (rec.boxW != null) return;
    const w0 = rec.wrap, keepS = w0.scale.x, keepR = w0.rotation.clone(), keepP = w0.position.clone();
    w0.scale.setScalar(1); w0.rotation.set(0, 0, 0); w0.position.set(0, 0, 0); w0.updateMatrixWorld(true);
    _MB.setFromObject(w0, true).getSize(_MS);
    rec.boxW = Math.max(_MS.x, _MS.z) || 1; rec.boxH = _MS.y || 1; rec.boxC = _MB.getCenter(new THREE.Vector3());   // the middle of its box, in its own units
    w0.scale.setScalar(keepS); w0.rotation.copy(keepR); w0.position.copy(keepP);
    w0.traverse(m => { if (m.isMesh && m.material) baseOf(m.material); });   // (kept beside the material: userData does not survive a clone, see MODEL_BASE)
  }
  // a model's outside, in its own units (2026-11-05, the owner: "shrink-wrap it around the shape without the dents"): along each of a few dozen
  // directions, the vertex that reaches furthest; the physics kit wraps those into one solid. Directions are taken in the box's proportions,
  // so a long thin thing keeps its ends. outC, their mean, is inside the solid: the point it turns about.
  const OUTLINE_POINTS = 48, _OV = new THREE.Vector3(), _OM = new THREE.Matrix4();
  function modelOutline(rec) {
    if (rec.out) return rec.out;
    modelBox(rec);
    const w0 = rec.wrap, keepS = w0.scale.x, keepR = w0.rotation.clone(), keepP = w0.position.clone();
    w0.scale.setScalar(1); w0.rotation.set(0, 0, 0); w0.position.set(0, 0, 0); w0.updateMatrixWorld(true);
    _MB.setFromObject(w0, true).getSize(_MS);
    const sx = _MS.x || 1, sy = _MS.y || 1, sz = _MS.z || 1, ga = Math.PI * (3 - Math.sqrt(5)), best = [];
    const dirs = []; for (let i = 0; i < OUTLINE_POINTS; i++) { const y = 1 - (i + 0.5) / OUTLINE_POINTS * 2, r = Math.sqrt(1 - y * y), a = i * ga; dirs.push([Math.cos(a) * r / sx, y / sy, Math.sin(a) * r / sz]); best.push(-Infinity); }
    const out = new Array(OUTLINE_POINTS).fill(null);
    w0.traverse(m => {
      const pos = m.isMesh && m.geometry && m.geometry.attributes.position;
      if (!pos) return;
      _OM.copy(m.matrixWorld);
      const step = Math.max(1, Math.floor(pos.count / 40000));
      for (let i = 0; i < pos.count; i += step) {
        _OV.fromBufferAttribute(pos, i).applyMatrix4(_OM);
        for (let d = 0; d < OUTLINE_POINTS; d++) { const u = dirs[d], t = u[0] * _OV.x + u[1] * _OV.y + u[2] * _OV.z; if (t > best[d]) { best[d] = t; out[d] = [_OV.x, _OV.y, _OV.z]; } }
      }
    });
    w0.scale.setScalar(keepS); w0.rotation.copy(keepR); w0.position.copy(keepP);
    const pts = out.filter(Boolean), c = pts.reduce((a, q) => [a[0] + q[0] / pts.length, a[1] + q[1] / pts.length, a[2] + q[2] / pts.length], [0, 0, 0]);
    rec.outC = new THREE.Vector3(c[0], c[1], c[2]);
    return (rec.out = pts);
  }
  const slotFit = (rec, w, h) => (w > 0 ? Math.min(h / rec.boxH, w / rec.boxW) : h / rec.boxH);
  /** WORLD.outline(layer, w, h): the mesh's outside at the size it is drawn in that slot, about its own middle, in the physics kit's coordinates;
      null until the mesh has loaded. W.solid takes it. */
  function outline(L, w, h) {
    const rec = L && MODELS.get(L.id);
    if (!rec) return null;
    const pts = modelOutline(rec), fit = slotFit(rec, w, h), c = rec.outC;
    return pts.map(q => [-(q[0] - c.x) * fit, (q[1] - c.y) * fit, (q[2] - c.z) * fit]);   // x mirrored as X() mirrors it
  }
  function modelCopy(rec, n) {
    rec.copies = rec.copies || [];
    let c = rec.copies[n];
    if (!c) {
      c = rec.wrap.clone(true);
      c.traverse(m => { if (m.isMesh && m.material) { const base = baseOf(m.material); m.material = m.material.clone(); if (base) { MODEL_BASE.set(m.material, base); m.material.color.copy(base); } } });
      rec.copies[n] = c; scene.add(c);
    }
    return c;
  }
  function tintModel(obj, tint) {
    const t = tint ? hex(tint) : null;
    obj.traverse(m => { if (!m.isMesh || !m.material || !m.material.color) return; const b = baseOf(m.material); if (t) m.material.color.setRGB(b.r * t[0], b.g * t[1], b.b * t[2]); else m.material.color.copy(b); });
  }
  function placeModel(rec, L, x, y, z, w, h, o) {
    o = o || {};
    if (!rec.wrap.parent) scene.add(rec.wrap);
    modelBox(rec);
    const k = rec.skinned ? 0 : (rec.used || 0); rec.used = k + 1;
    const obj = k === 0 ? rec.wrap : modelCopy(rec, k - 1);
    obj.visible = true; rec.drawn = true;
    if (k === 0) {
      const name = o.anim || (L.cells && L.cells.names && L.cells.names[o.cell || 0]) || null;
      if (name && rec.actions[name]) MODELS.play(rec.id, name); else if (!rec.current && rec.own) MODELS.play(rec.id, rec.own);
      rec.rate = o.rate == null ? 1 : o.rate;
      MODELS.step(rec, dt);
    }
    const gy = trackY(z);
    // inside the slot's box: the height as asked, shrunk when the mesh would stand wider than the slot (a squat thing)
    const fit = slotFit(rec, w, h);
    obj.position.set(X(x), gy + y, z); obj.scale.setScalar(fit);
    const yaw = (o.heading == null ? 0 : Math.atan2(-o.heading, 1)) + (o.yaw || 0);
    obj.rotation.set(o.pitch || 0, yaw, o.roll || 0);
    // an object turns about the MIDDLE of its box (2026-11-05, the owner on run C's landed game: "the chicken pieces are
    // curving ... like a knuckleball, swerving in midair"): the flight was a straight arc; the mesh was turned about its
    // foot, so a tumbling piece swung in a circle of half its height around its own path. A rigged model (a character on
    // its feet) keeps the foot as its pivot.
    if (!rec.skinned && rec.boxC && (o.pitch || o.roll)) { _MC.copy(rec.boxC).multiplyScalar(fit); const cx = _MC.x, cy = _MC.y, cz = _MC.z; _MC.applyEuler(obj.rotation); obj.position.x += cx - _MC.x; obj.position.y += cy - _MC.y; obj.position.z += cz - _MC.z; }
    // on a body (W.solid): the mesh stands where the body stands and turns as it turns. The body lives in the kit's coordinates, so the turn is mirrored
    // as X() mirrors x; the mesh's outline middle is the point it turns about, so what is seen is what hits.
    if (o.body && o.body.q) {
      modelOutline(rec); const b = o.body, q = b.q;
      obj.quaternion.set(q.x, -q.y, -q.z, q.w);
      _MC.copy(rec.outC).multiplyScalar(fit).applyQuaternion(obj.quaternion);
      obj.position.set(X(b.x) - _MC.x, gy + b.y - _MC.y, b.z - _MC.z);
    } else if (k === 0) { const lift = MODELS.footLift(rec, gy + y + 0.02); if (lift > 0) obj.position.y += lift; }
    tintModel(obj, o.tint || null);
    if (o.contact !== false && C.look.contact > 0) contactShadow(x, z, Math.min(w || h, h) * 0.45, y, h);
    if (o.hero) { hero = { x, y, z, h }; heroInfo = { kind: 'model', role: 'model' }; }
    if (o.target) target = { x, y, z, h };
    stats.sprites++;
  }
  const MODEL_TRIED = new Set();
  function layer(L, kind, x, y, z, w, h, colour, o) {
    // a 'model' layer loads its mesh the way a picture layer loads its picture (2026-11-05, run C: the build put the generated
    // GLB beside the page and nothing loaded it): assets/models/<layer id>.glb, asked for once; until it has loaded, and if
    // it never does, the stand-in shape is drawn. Its reference picture is never drawn in the world (a flat cut-out of a 3D thing).
    // THE TARGET IS NEVER A MODEL (2026-11-05, the owner on run C: "I don't feel the sauce hoop needs to be a 3D model ... how
    // can we keep this logic intact so it doesn't start getting models made of stuff that should be handled with code?"): the
    // thing the player aims at, bounces off or fills is the game's colliders, and its states are code; drawn as kit shapes,
    // what is seen is what is hit. A model layer drawn as the target keeps its shapes; the look says so (stats.modelTarget).
    if (L && L.type === 'model' && o && o.target) { stats.modelTarget = L.id; shape(kind, x, y, z, w, h, colour, o); return; }
    if (L && L.type === 'model' && !MODEL_TRIED.has(L.id)) { MODEL_TRIED.add(L.id); if (!MODELS.records[L.id]) { try { MODELS.load(L.id, `assets/models/${L.id}.glb`, Object.assign({ optional: true }, o && o.model)); } catch (e) { /* the stand-in stays */ } } }
    if (o && o.body) { const b = o.body; x = b.x; y = b.y - h / 2; z = b.z; if (o.spin == null) o = Object.assign({}, o, { spin: b.spin }); }   // a slot on a body: where the body is
    const mdl = L && MODELS.get(L.id);
    if (mdl) { placeModel(mdl, L, x, y, z, w, h, o); return; }
    if (L && L.type === 'model' && MODELS.records[L.id] && !MODELS.records[L.id].error) return;
    const LA = typeof LAYERS !== 'undefined' ? LAYERS : (window.LAYERS || null);
    const img = L && L.type !== 'model' && LA && LA.ART && LA.ART[L.id];
    if (!img || !img.width) { shape(kind, x, y, z, w, h, colour, o); return; }
    let rect = null;
    const c = (o && o.cell) || 0;
    const rec = LA.META && (LA.META[L.name] || LA.META[L.id]);
    const anim = rec && rec.anim;
    if (anim && anim.frames > 1) {
      const others = (L.cells ? L.cells.cols * L.cells.rows : 1) - 1, total = anim.frames + others, cols = anim.cols || total, ac = anim.cell || 0;
      const sw = img.width / cols, sh = img.height / Math.ceil(total / cols);
      const i = c === ac ? LA.animCell(anim, o && o.animAt != null ? o.animAt : null) : anim.frames + (c > ac ? c - 1 : c);
      rect = [(i % cols) * sw, Math.floor(i / cols) * sh, sw, sh];
    } else if (L.cells && L.type === 'sheet') {
      const sw = img.width / L.cells.cols, sh = img.height / L.cells.rows;
      rect = [(c % L.cells.cols) * sw, Math.floor(c / L.cells.cols) * sh, sw, sh];
    }
    const rw = rect ? rect[2] : img.width, rh = rect ? rect[3] : img.height;
    if (o && o.flat) { picture(img, rect, x, y, z, w, w * (rh / rw), Object.assign({}, o)); return; }
    if (o && o.scale > 0 && o.scale !== 1) h *= o.scale;
    const ww = h * (rw / rh) * (o && o.squash > 0 ? o.squash : 1);
    const cellFoot = !anim && y <= 0 && rec && Array.isArray(rec.feet) && typeof rec.feet[c] === 'number' ? rec.feet[c] : null;
    const room = cellFoot != null ? 1 - cellFoot : rec && typeof rec.foot === 'number' ? 1 - rec.foot : rec && rec.foot && typeof rec.foot.cy === 'number' ? Math.max(0, 1 - (rec.foot.cy + (rec.foot.ry || 0))) : 0;
    const oo = Object.assign({}, o || {});
    if (oo.sink == null) oo.sink = Math.min(0.5, Math.max(0, room)) + 0.025;
    picture(img, rect, x, y, z, ww, h, oo);
  }
  /** the hero thing this frame (the camera rule): its projected share of the frame height lands on stats.heroShare */
  // o { kind, role }: an empty hand's slot, a hero of two parts: the slot is named with what stands there or will
  function heroAt(x, y, z, h, o) { hero = { x, y, z, h }; heroInfo = { kind: (o && o.kind) || 'named', role: (o && o.role) || null }; }
  /** a cue in the world: an arrow on the ground pointing the correction, or a ring around a spot; glow role, lit with the scene */
  const CUE_ARROW = [[0.05, 0.3], [0.55, 0.3], [0.55, 0.1], [0.95, 0.5], [0.55, 0.9], [0.55, 0.7], [0.05, 0.7]];
  function cue(o) {
    const size = o.size || 0.8, k = o.pulse == null ? 1 : o.pulse, alpha = (o.alpha == null ? 0.9 : o.alpha) * (o.pulse == null ? 1 : 1 - k);
    const sc = o.pulse == null ? size : size * (0.6 + 0.8 * k), colour = o.colour || '#ffd25a';
    if (o.kind === 'ring') return shape('ring', o.x || 0, o.y || 0, o.z || 0, sc, sc, colour, { flat: true, material: 'mark', alpha, shadow: false, contact: false, id: o.id });
    const a = { right: 0, far: -Math.PI / 2, left: Math.PI, near: Math.PI / 2 }[o.dir || 'right'] || 0, c = Math.cos(a), sn = Math.sin(a);   // a flat plate's local +y runs toward the camera
    const outline = CUE_ARROW.map(([px, py]) => [0.5 + (px - 0.5) * c - (py - 0.5) * sn, 0.5 + (px - 0.5) * sn + (py - 0.5) * c]);
    return shape('plate', o.x || 0, o.y || 0, o.z || 0, sc, sc, colour, { flat: true, material: 'mark', alpha, shadow: false, contact: false, outline, bevel: 0.02, id: o.id });
  }
  /** the target thing this frame (what the player aims at): its share lands on stats.targetShare */
  function targetAt(x, y, z, h) { target = { x, y, z, h }; }

  // ── the liquid kit (Phase 1 item 4; R&D list B: liquids by code, never a picture tile): stateless calls per frame, knobs only ──
  //   WORLD.liquid('fill', { x, y, z, w, h, level, colour, gloss, wave, thick })   a liquid rising in a container w wide, h tall,
  //                                                                                 standing on y; level 0..1; the top ripples
  //                                                                                 (wave: amplitude as a share of w, 0.03), thick
  //                                                                                 slows the ripple (sauce 1, water 0)
  //   WORLD.liquid('glass', { x, y, z, w, h, colour, alpha })                       the container: a clear cylinder with a rim
  //   WORLD.liquid('pool', { x, z, w, d, colour, alpha, wave, caustic })            a flat water in a w by d rectangle: a scrolling
  //                                                                                 ripple normal map, a caustic layer on top
  //   WORLD.liquid('lava', { x, z, w, d, colour, glow })                            cooled plates with cracks that pulse (0.7 Hz)
  //   WORLD.effect('ring', { x, z, r, progress, colour })                           a shock ring on the ground, expanding and fading
  //   WORLD.effect('beam', { from: {x,y,z}, to: {x,y,z}, w, colour, speed })        a flowing beam between two points
  let T = 0;
  const LQ = { pools: {}, used: {} };
  function takeLq(kind, make, poolKey) {
    kind = poolKey || kind;
    const pool = LQ.pools[kind] || (LQ.pools[kind] = []); const i = LQ.used[kind] || 0; LQ.used[kind] = i + 1;
    if (i < pool.length) { pool[i].visible = true; return pool[i]; }
    const m = make(); scene.add(m); pool.push(m); return m;
  }
  function hideLq() { for (const k of Object.keys(LQ.pools)) { const p = LQ.pools[k]; for (let i = LQ.used[k] || 0; i < p.length; i++) p[i].visible = false; LQ.used[k] = 0; } }
  const timeUniform = (mat, extra) => { mat.userData.u = Object.assign({ uT: { value: 0 } }, extra || {}); mat.onBeforeCompile = sh => { Object.assign(sh.uniforms, mat.userData.u); mat.userData.patch(sh); }; mat.customProgramCacheKey = () => mat.userData.key; };
  function liquid(kind, o) {
    if (!ok) return; o = o || {};
    const gy = trackY(o.z || 0); let c = hex(o.colour || '#3b8fd6');
    if (kind === 'fill') {
      // a liquid reads as the colour it is given: the arena's light doubled a sauce of #5a1c0c into rust orange (the owner, 2026-11-06)
      c = [c[0] * 0.55, c[1] * 0.55, c[2] * 0.55];
      const level = clamp(o.level == null ? 0.5 : o.level, 0.001, 1), gloss = o.gloss == null ? 0.85 : o.gloss, thick = o.thick == null ? 0.5 : o.thick, wave = o.wave == null ? 0.03 : o.wave;
      const boxy = o.shape === 'box', d0 = o.d || o.w;
      const body = takeLq(boxy ? 'fill-box' : 'fill', () => new THREE.Mesh(boxy ? new THREE.BoxGeometry(1, 1, 1) : new THREE.CylinderGeometry(0.5, 0.5, 1, 40, 1, false), new THREE.MeshPhysicalMaterial({ roughness: 0.2, metalness: 0, envMapIntensity: 0.35, specularIntensity: 0.35 })));
      body.material.color.setRGB(c[0], c[1], c[2]); body.material.roughness = Math.max(0.3, 1 - gloss * 0.9);   // a floor on the gloss: with tone mapping off a mirror highlight clips to white and blooms into a blob
      // a thin liquid shows through its body (water, juice), a thick one does not (sauce, paint)
      const op = 0.55 + 0.45 * thick; if (op < 0.99) { body.material.transparent = true; body.material.opacity = op; body.material.depthWrite = true; } else { body.material.transparent = false; body.material.opacity = 1; }
      body.position.set(X(o.x), gy + o.y + o.h * level / 2, o.z); body.scale.set(o.w * 0.98, o.h * level, d0 * 0.98); body.castShadow = false;
      // the top: a disc that ripples in its shader (a wave train across and a ring from the centre, slowed by thickness)
      const top = takeLq('fill-top', () => {
        const mat = new THREE.MeshPhysicalMaterial({ roughness: 0.2, metalness: 0, envMapIntensity: 0.35, specularIntensity: 0.35 });
        mat.userData.key = 'fill-top';
        // the wave: a train across, a train along and a ring from the centre, fading to the rim; the vertex lifts by it and the
        // fragment tilts the normal by its slope (finite differences of the same function), so the gloss moves with the wave
        const decl = 'uniform float uT; uniform float uWave; uniform float uThick; uniform float uScale; varying vec2 vLoc; varying vec3 vTx; varying vec3 vTy;\n float lqw(vec2 p, float sp) { float r = length(p); return (sin(p.x * 9.0 + uT * 2.6 * sp) * 0.5 + sin(p.y * 7.0 - uT * 2.1 * sp) * 0.3 + sin(r * 14.0 - uT * 3.0 * sp) * 0.4) * (1.0 - smoothstep(0.42, 0.5, r)); }';
        mat.userData.patch = sh => {
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\n' + decl)
            .replace('#include <begin_vertex>', '#include <begin_vertex>\n { float sp = 1.0 - 0.6 * uThick; transformed.z += uWave * lqw(position.xy, sp); vLoc = position.xy; vTx = normalize((modelViewMatrix * vec4(1.0, 0.0, 0.0, 0.0)).xyz); vTy = normalize((modelViewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz); }');
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n' + decl)
            .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n { float sp = 1.0 - 0.6 * uThick; float e = 0.004; float fx = (lqw(vLoc + vec2(e, 0.0), sp) - lqw(vLoc - vec2(e, 0.0), sp)) / (2.0 * e); float fy = (lqw(vLoc + vec2(0.0, e), sp) - lqw(vLoc - vec2(0.0, e), sp)) / (2.0 * e); normal = normalize(normal - vTx * (uWave * fx / uScale) - vTy * (uWave * fy / uScale)); }');
        };
        timeUniform(mat, { uWave: { value: 0.03 }, uThick: { value: 0.5 }, uScale: { value: 1 } });
        const m = new THREE.Mesh(new THREE.RingGeometry(0.0001, 0.5, 48, 14), mat); m.castShadow = false; return m;
      }, boxy ? 'fill-top-box' : null);
      top.material.color.setRGB(Math.min(0.85, c[0] * 1.05), Math.min(0.85, c[1] * 1.05), Math.min(0.85, c[2] * 1.05)); top.material.roughness = Math.max(0.28, 1 - gloss * 0.95);
      top.material.userData.u.uT.value = T; top.material.userData.u.uWave.value = wave * o.w; top.material.userData.u.uThick.value = thick; top.material.userData.u.uScale.value = o.w * 0.96;
      top.position.set(X(o.x), gy + o.y + o.h * level + 0.002, o.z); top.rotation.set(-Math.PI / 2, 0, 0); top.scale.set(o.w * 0.96, d0 * 0.96, 1);
      if (boxy && top.geometry.type !== 'PlaneGeometry') { top.geometry.dispose(); top.geometry = new THREE.PlaneGeometry(1, 1, 24, 24); }
      // the meniscus: a lighter rim where the liquid meets the glass; thicker liquids climb more
      const men = takeLq('fill-rim', () => { const m = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.012, 8, 48), new THREE.MeshPhysicalMaterial({ roughness: 0.3, envMapIntensity: 0.35, specularIntensity: 0.35 })); m.castShadow = false; return m; });
      men.material.color.setRGB(Math.min(1, c[0] * 1.15 + 0.02), Math.min(1, c[1] * 1.15 + 0.02), Math.min(1, c[2] * 1.15 + 0.02));
      men.position.set(X(o.x), gy + o.y + o.h * level + 0.004 + 0.01 * thick, o.z); men.rotation.set(Math.PI / 2, 0, 0); men.scale.set(o.w * 0.94, o.w * 0.94, 1 + 2 * thick);   // inside the glass: at 0.98 the ring stood through the wall and the two cut each other into a band of diamonds (the owner, 2026-11-06: "creating some dots") men.visible = !boxy;
      // drips on the outside of the glass (o.drips: how many), sliding down from the rim, slower when thick
      for (let i = 0; i < (o.drips || 0); i++) {
        const a = (i / Math.max(1, o.drips)) * Math.PI * 2 + 0.7, f = (T * (0.05 + 0.08 * (1 - thick)) + i * 0.37) % 1, dy = o.h - f * o.h * 0.7;
        const d = take('blob'); d.position.set(X(o.x + Math.cos(a) * o.w * 0.5), gy + o.y + dy, o.z + Math.sin(a) * o.w * 0.5); d.scale.set(o.w * 0.06, o.w * 0.16 * (0.6 + 0.4 * f), o.w * 0.04); d.rotation.set(0, 0, 0); tint(d, o.colour || '#3b8fd6', 1); d.castShadow = false;
      }
      stats.sprites += 2; return;
    }
    if (kind === 'glass') {
      const g = takeLq('glass', () => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 40, 1, true), new THREE.MeshPhysicalMaterial({ roughness: 0.3, metalness: 0, transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 0.3, specularIntensity: 0.4 })); /* clear glass shows at its edges and not across its middle: a flat 24% of white over a dark sauce made it dusty salmon (the owner, 2026-11-06: "the color of the sauce is not good") */ m.material.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n gl_FragColor.a *= clamp(0.1 + 2.2 * pow(1.0 - abs(dot(normalize(normal), normalize(vViewPosition))), 2.0), 0.0, 1.0);'); }; m.castShadow = false; m.renderOrder = 2; return m; });
      g.material.color.setRGB(c[0], c[1], c[2]); g.material.opacity = o.alpha == null ? 0.22 : o.alpha;
      g.position.set(X(o.x), gy + o.y + o.h / 2, o.z); g.scale.set(o.w, o.h, o.w);
      const rim = takeLq('glass-rim', () => { const m = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.012, 8, 48), new THREE.MeshStandardMaterial({ color: '#d8dde4', roughness: 0.45, transparent: true, opacity: 0.7, envMapIntensity: 0.3 })); m.castShadow = false; return m; });
      rim.position.set(X(o.x), gy + o.y + o.h, o.z); rim.rotation.set(Math.PI / 2, 0, 0); rim.scale.set(o.w, o.w, 1);
      stats.sprites += 2; return;
    }
    if (kind === 'pool') {
      // WATER, the quality tier (2026-11-04, the owner's bar: the Dino Munch water): the floor seen THROUGH the surface. The
      // opaque scene is rendered first to a half-size target with a depth texture (the pre-pass, only when a pool is drawn);
      // the surface reads it: the colour behind, shifted by the ripple normal (refraction); the floor's depth under the
      // surface (from the depth texture) tints the water from shallow to deep and foams the edge where the depth runs out;
      // the sun's highlight on the normal-mapped surface gives the glints (bright enough to bloom); caustics lie ON THE
      // FLOOR under it (drawn in the pre-pass, so they refract with it); bubbles rise inside
      needPre = true;
      const m = takeLq('pool', () => {
        const b = SURFACES.bake({ recipe: 'ripple', scale: o.scale || 2 });
        const mat = new THREE.MeshStandardMaterial({ roughness: 0.08, metalness: 0, transparent: false, depthWrite: true, envMapIntensity: 0.4 });
        mat.normalMap = b.normalMap.clone(); mat.normalMap.needsUpdate = true; mat.normalScale.set(0.5, 0.5); mat.userData.scale = b.scale; mat.userData.key = 'water';
        const u = { uT: { value: 0 }, tPre: { value: null }, tDepth: { value: null }, uRes: { value: new THREE.Vector2(1, 1) }, uNear: { value: 0.1 }, uFar: { value: 900 }, uShallow: { value: new THREE.Color('#5fc8e8') }, uDeep: { value: new THREE.Color('#1b4f8a') }, uAbsorb: { value: 0.9 }, uFoam: { value: 0.25 }, uRefract: { value: 0.035 }, uClear: { value: 0.75 }, uDbg: { value: +(new URLSearchParams(location.search).get('water') || 0) } };
        mat.userData.u = u;
        mat.userData.patch = sh => {
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n#include <packing>\n uniform sampler2D tPre; uniform sampler2D tDepth; uniform vec2 uRes; uniform float uNear; uniform float uFar; uniform vec3 uShallow; uniform vec3 uDeep; uniform float uAbsorb; uniform float uFoam; uniform float uRefract; uniform float uClear; uniform float uT; uniform float uDbg;')
            .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\n vec3 waterN0 = normal;')
            .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n vec3 waterN = normal;')
            // after the lights: the refracted floor replaces the diffuse term, the specular stays
            .replace('#include <opaque_fragment>', `{ vec2 suv = gl_FragCoord.xy / uRes; vec2 ruv = clamp(suv + (waterN - waterN0).xy * uRefract, 0.001, 0.999);   // the ripple's tilt only: the flat normal points up the screen and would read the floor further away
              float dRaw = texture2D(tDepth, ruv).x; float sceneZ = -perspectiveDepthToViewZ(dRaw, uNear, uFar); float hereZ = -(-vViewPosition.z);
              float depth = max(0.0, sceneZ - hereZ);
              if (depth <= 0.0) { ruv = suv; dRaw = texture2D(tDepth, ruv).x; sceneZ = -perspectiveDepthToViewZ(dRaw, uNear, uFar); depth = max(0.0, sceneZ - hereZ); }
              vec3 behind = texture2D(tPre, ruv).rgb;
              float absorb = 1.0 - exp(-depth * uAbsorb);
              vec3 tint = mix(uShallow, uDeep, clamp(depth * 0.35, 0.0, 1.0));
              vec3 water = mix(behind, tint * (0.55 + 0.45 * absorb), mix(1.0 - uClear, 1.0, absorb));
              float foam = (1.0 - smoothstep(0.0, uFoam, depth)) * (0.55 + 0.45 * sin(uT * 2.0 + vViewPosition.x * 6.0 + vViewPosition.y * 4.0));
              water += vec3(0.9) * foam * 0.8;
              outgoingLight = water + reflectedLight.directSpecular + reflectedLight.indirectSpecular;
              if (uDbg > 0.5 && uDbg < 1.5) outgoingLight = behind; else if (uDbg > 1.5 && uDbg < 2.5) outgoingLight = vec3(clamp(depth, 0.0, 1.0)); else if (uDbg > 2.5 && uDbg < 3.5) outgoingLight = vec3(dRaw); else if (uDbg > 3.5 && uDbg < 4.5) outgoingLight = vec3(dRaw * 50.0 - 49.0); else if (uDbg > 4.5 && uDbg < 5.5) outgoingLight = vec3(hereZ / 20.0); else if (uDbg > 5.5) outgoingLight = vec3(sceneZ / 20.0); }
              #include <opaque_fragment>`);
        };
        timeUniform(mat, u);
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); mesh.receiveShadow = false; mesh.castShadow = false; mesh.renderOrder = 1; mesh.userData.water = true; return mesh;
      });
      const u = m.material.userData.u, sc = m.material.userData.scale;
      u.uT.value = T; u.uShallow.value.setRGB(c[0], c[1], c[2]); u.uDeep.value.setRGB(c[0] * 0.35, c[1] * 0.45, c[2] * 0.7); u.uAbsorb.value = o.absorb == null ? 0.9 : o.absorb; u.uFoam.value = o.foam == null ? 0.25 : o.foam; u.uRefract.value = (o.refract == null ? 1 : o.refract) * 0.035; u.uClear.value = o.alpha == null ? 0.75 : o.alpha;
      m.material.normalScale.setScalar(0.5 * (o.wave == null ? 1 : o.wave)); m.material.normalMap.repeat.set(o.w / sc, o.d / sc); m.material.normalMap.offset.set(T * 0.03, T * 0.018);
      m.position.set(X(o.x), gy + (o.y || 0) + 0.02, o.z); m.rotation.set(-Math.PI / 2, 0, 0); m.scale.set(o.w, o.d, 1);
      if (o.caustic !== false) {
        const ca = takeLq('caustic', () => { const b = SURFACES.bake({ recipe: 'caustic', scale: o.scale || 3 }); const t2 = b.map.clone(); t2.needsUpdate = true; const mat = new THREE.MeshBasicMaterial({ map: t2, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false }); mat.userData.scale = b.scale; const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat); mesh.renderOrder = 0; return mesh; });
        const s2 = ca.material.userData.scale; ca.material.map.repeat.set(o.w / s2, o.d / s2); ca.material.map.offset.set(T * 0.025, -T * 0.014); ca.material.opacity = 0.3 * (o.caustic == null ? 1 : o.caustic);
        ca.position.set(X(o.x), gy + (o.y || 0) - (o.depth || 0.6) + 0.006, o.z); ca.rotation.set(-Math.PI / 2, 0, 0); ca.scale.set(o.w, o.d, 1);   // on the floor under the water (o.depth: how deep the floor is, 0.6)
      }
      if (o.bubbles) particles('bubbles', { x: o.x, y: gy + (o.y || 0) - (o.depth || 0.6), z: o.z, w: o.w, d: o.d, height: (o.depth || 0.6), n: 40, colour: '#dff6ff', size: 0.05, speed: 0.25, drift: 0.12, rate: o.bubbles });
      stats.sprites++; return;
    }
    if (kind === 'lava') {
      // LAVA, the quality tier: the crust holds still while the glow FLOWS under it (two reads of the emissive map scrolling
      // along the flow at different scales), the pulse on top; embers rise over it; the glow is brighter than white, so it blooms
      const m = takeLq('lava', () => {
        const b = SURFACES.bake({ recipe: 'lava', scale: o.scale || 3 });
        const mat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
        mat.map = b.map; mat.normalMap = b.normalMap; mat.normalScale.set(1.5, 1.5); mat.emissiveMap = b.emissiveMap; mat.emissive = new THREE.Color('#ffffff'); mat.emissiveIntensity = 1.7; mat.userData.scale = b.scale; mat.userData.key = 'lava';
        const u = { uT: { value: 0 }, uFlow: { value: new THREE.Vector2(0.02, 0.011) } };
        mat.userData.u = u;
        mat.userData.patch = sh => {
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\n uniform float uT; uniform vec2 uFlow;')
            .replace('#include <emissivemap_fragment>', `{ vec3 e1 = texture2D(emissiveMap, vEmissiveMapUv + uFlow * uT).rgb; vec3 e2 = texture2D(emissiveMap, vEmissiveMapUv * 1.7 + vec2(-uFlow.y, uFlow.x) * uT * 1.3).rgb;
              float m = max(e1.r, e2.r); vec3 heat = mix(vec3(0.72, 0.06, 0.0), vec3(1.0, 0.72, 0.22), smoothstep(0.25, 0.95, m));   // deep red to yellow by heat
              totalEmissiveRadiance = heat * (0.25 + 1.1 * m) * emissive.r * (0.9 + 0.1 * sin(uT * 4.4)); }`);   // three folds the intensity into the emissive uniform (white here)
        };
        timeUniform(mat, u);
        const mesh = new THREE.Mesh(o.h ? new THREE.BoxGeometry(1, 1, 1) : new THREE.PlaneGeometry(1, 1), mat); mesh.receiveShadow = true; mesh.castShadow = !!o.h; mesh.renderOrder = 1; return mesh;
      }, o.h ? 'lava-block' : null);
      const u = m.material.userData.u, sc = m.material.userData.scale;
      u.uT.value = T; m.material.color.setRGB(c[0], c[1], c[2]); m.material.emissiveIntensity = 1.7 * (o.glow == null ? 1 : o.glow);
      if (o.h) { for (const t of [m.material.map, m.material.normalMap, m.material.emissiveMap]) if (t) t.repeat.set(1, 1); m.position.set(X(o.x), gy + (o.y || 0) + o.h / 2, o.z); m.rotation.set(0, o.yaw || 0, 0); m.scale.set(o.w, o.h, o.d); if (o.embers !== 0) particles('embers', { x: o.x, y: gy + (o.y || 0) + o.h, z: o.z, w: o.w, d: o.d, height: 1.2, n: 50, colour: '#ffb347', size: 0.05, speed: 0.45, drift: 0.2, rate: o.embers == null ? 1 : o.embers, glow: 3 }); stats.sprites++; return; }
      if (o.flow) u.uFlow.value.set(o.flow.x == null ? 0.02 : o.flow.x, o.flow.z == null ? 0.011 : o.flow.z);
      for (const t of [m.material.map, m.material.normalMap, m.material.emissiveMap]) if (t) t.repeat.set(o.w / sc, o.d / sc);
      m.position.set(X(o.x), gy + (o.y || 0) + 0.02, o.z); m.rotation.set(-Math.PI / 2, 0, 0); m.scale.set(o.w, o.d, 1);
      if (o.embers !== 0) particles('embers', { x: o.x, y: gy + (o.y || 0) + 0.05, z: o.z, w: o.w, d: o.d, height: 1.6, n: 50, colour: '#ffb347', size: 0.06, speed: 0.45, drift: 0.25, rate: o.embers == null ? 1 : o.embers, glow: 3 });
      stats.sprites++;
    }
  }
  // ── particles: points rising in a box (embers, bubbles, dust); one draw, the motion in the vertex shader ──
  function particles(kind, o) {
    const pts = takeLq('particles:' + kind, () => {
      const n = o.n || 50, pos = new Float32Array(n * 3), ph = new Float32Array(n * 2);
      for (let i = 0; i < n; i++) { pos[i * 3] = Math.random() - 0.5; pos[i * 3 + 1] = Math.random(); pos[i * 3 + 2] = Math.random() - 0.5; ph[i * 2] = Math.random(); ph[i * 2 + 1] = Math.random() * 6.28; }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 2));
      const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: o.glow ? THREE.AdditiveBlending : THREE.NormalBlending,
        uniforms: { uT: { value: 0 }, uBox: { value: new THREE.Vector3(1, 1, 1) }, uColour: { value: new THREE.Color('#fff') }, uSize: { value: 0.05 }, uSpeed: { value: 0.4 }, uDrift: { value: 0.2 }, uRate: { value: 1 }, uGlow: { value: o.glow || 1 }, uDpr: { value: dpr } },
        vertexShader: `uniform float uT; uniform vec3 uBox; uniform float uSize; uniform float uSpeed; uniform float uDrift; uniform float uRate; uniform float uDpr; attribute vec2 ph; varying float vLife;
          void main() { float life = fract(position.y + uT * uSpeed * ph.x * 0.6 + uT * uSpeed * 0.4); vLife = life; if (ph.x > uRate) life = -1.0;
            vec3 p = vec3((position.x + sin(uT * 1.3 + ph.y) * uDrift * life) * uBox.x, life * uBox.y, (position.z + cos(uT * 1.1 + ph.y * 2.0) * uDrift * life) * uBox.z);
            vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
            float s = uSize * (0.6 + 0.4 * ph.x) * (1.0 - 0.5 * life); gl_PointSize = s * uDpr * 300.0 / max(0.3, -mv.z); if (life < 0.0) gl_PointSize = 0.0; }`,
        fragmentShader: `uniform vec3 uColour; uniform float uGlow; varying float vLife; void main() { vec2 q = gl_PointCoord - 0.5; float d = length(q); if (d > 0.5) discard; float a = (1.0 - smoothstep(0.2, 0.5, d)) * (1.0 - vLife * vLife); gl_FragColor = vec4(uColour * uGlow, a); }` });
      const P = new THREE.Points(g, mat); P.frustumCulled = false; P.renderOrder = 3; return P;
    });
    const u = pts.material.uniforms, c = hex(o.colour || '#fff');
    u.uT.value = T; u.uBox.value.set(o.w, o.height, o.d); u.uColour.value.setRGB(c[0], c[1], c[2]); u.uSize.value = o.size || 0.05; u.uSpeed.value = o.speed || 0.4; u.uDrift.value = o.drift || 0.2; u.uRate.value = Math.min(1, o.rate == null ? 1 : o.rate); u.uDpr.value = dpr;
    pts.position.set(X(o.x), o.y, o.z);
  }
  function effect(kind, o) {
    if (!ok) return; o = o || {};
    const gy = trackY(o.z || 0), c = hex(o.colour || '#ffd27a');
    if (kind === 'ring') {
      const p = clamp(o.progress == null ? 0 : o.progress, 0, 1);
      const m = takeLq('ring', () => { const mesh = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 48), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); mesh.renderOrder = 3; return mesh; });
      m.material.color.setRGB(c[0], c[1], c[2]); m.material.opacity = (1 - p) * 0.9;
      const r = (o.r || 1) * (0.2 + 0.8 * p);
      m.position.set(X(o.x), gy + (o.y || 0) + 0.03, o.z); m.rotation.set(-Math.PI / 2, 0, 0); m.scale.set(r, r, 1);
      return;
    }
    if (kind === 'splash') {
      // droplets flung out and up from a point, falling under gravity, fading: a hit on a thick liquid, a ball into water
      const n = o.n || 12, p = clamp(o.progress == null ? 0 : o.progress, 0, 1), r = o.r || 0.6, up = o.up == null ? 0.9 : o.up;
      if (p >= 1) return;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + (o.seed || 0), k = 0.7 + 0.3 * ((i * 7919) % 13) / 13;
        const dx = Math.cos(a) * r * p * k, dz = Math.sin(a) * r * p * k * 0.8, dy = up * k * (p * 1.6 - 1.9 * p * p);
        if ((o.y || 0) + dy < -0.02) continue;
        const m = take('blob'); m.position.set(X(o.x + dx), gy + (o.y || 0) + dy, o.z + dz); const sz = (o.size || 0.07) * (1 - 0.5 * p) * k; m.scale.set(sz, sz * 1.3, sz); m.rotation.set(0, 0, 0);
        tint(m, o.colour || '#d94a2a', 1 - p * p); m.castShadow = false;
      }
      return;
    }
    if (kind === 'beam') {
      const a = o.from, b = o.to, dx = X(b.x) - X(a.x), dy = (b.y || 0) - (a.y || 0), dz = b.z - a.z, len = Math.hypot(dx, dy, dz);
      const m = takeLq('beam', () => {
        const cvs = document.createElement('canvas'); cvs.width = 64; cvs.height = 32; const g = cvs.getContext('2d'); const gr = g.createLinearGradient(0, 0, 64, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 32); g.globalCompositeOperation = 'destination-in'; const gs = g.createLinearGradient(0, 0, 0, 32); gs.addColorStop(0, 'rgba(255,255,255,0)'); gs.addColorStop(0.5, 'rgba(255,255,255,1)'); gs.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gs; g.fillRect(0, 0, 64, 32);   // soft across as well as along: a ray of light has no hard edge
        const t = new THREE.CanvasTexture(cvs); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); mesh.renderOrder = 3; return mesh;
      });
      m.material.color.setRGB(c[0], c[1], c[2]);
      if (o.stripes === false) { m.material.map.repeat.set(1, 1); m.material.map.offset.set(0, 0); m.material.opacity = o.alpha == null ? 0.5 : o.alpha; }   // a light ray: one soft fade along its length
      else { m.material.map.repeat.set(len / (o.w || 0.3) / 2, 1); m.material.map.offset.set(-T * (o.speed == null ? 2 : o.speed), 0); m.material.opacity = 1; }
      m.position.set(X(a.x) + dx / 2, (a.y || 0) + dy / 2 + trackY(a.z), a.z + dz / 2); m.scale.set(len, o.w || 0.3, 1);
      m.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(dx, dy, dz).normalize());
      // the plane faces the camera about its own axis
      const toCam = camera.position.clone().sub(m.position); const axis = new THREE.Vector3(dx, dy, dz).normalize(); toCam.sub(axis.clone().multiplyScalar(toCam.dot(axis))).normalize();
      const n0 = new THREE.Vector3(0, 0, 1).applyQuaternion(m.quaternion); const ang = Math.atan2(axis.clone().cross(n0).dot(toCam), n0.dot(toCam)); m.rotateOnAxis(new THREE.Vector3(1, 0, 0), -ang);
    }
  }

  // ── a frame ──
  let t0 = 0;
  function begin(c) {
    if (PROF) t0 = performance.now();
    cam = { x: c.x || 0, y: c.y || 0, z: c.z || 0, c: 1, s: 0, zoom: c.zoom > 0 ? c.zoom : 1 };
    if (framed) solveFraming(c.subject || C.camera.subject);
    camY = (C.camera.height || 2) + (c.y || 0);
    frameU = 0;
    if (c.frame && c.frame.u > 0 && c.frame.h > 0) {
      // the rig's frame move (cam.frame): the named thing at its share of the frame height, centred; the camera's distance is
      // DERIVED from the share (projected height = h * k / depth), never typed; eased by the rig's u from the follow point
      const f = c.frame, u = Math.min(1, f.u), k = W * (C.camera.focal || 0.9) * (cam.zoom || 1), share = Math.min(0.9, Math.max(0.05, f.share || 0.3));
      const d = Math.max(1.2, f.h * k / (share * H)), hz = C.camera.horizon == null ? 0.38 : C.camera.horizon;
      const tz = f.z - d + (C.camera.back || 0), ty = (f.y + f.h / 2) + (0.5 - hz) * H * d / k;
      cam.x += (f.x - cam.x) * u; cam.z += (tz - cam.z) * u; camY += (ty - camY) * u; frameU = u;
    }
    const tn = C.kind === 'track' ? (C.camera.turn == null ? 1 : C.camera.turn) : 0;
    if (tn) { const a = tn * Math.atan((trackX(cam.z + 6) - trackX(cam.z)) / 6); cam.c = Math.cos(a); cam.s = Math.sin(a); }
    for (const k of Object.keys(used)) used[k] = 0; PIC.used = 0; stats.sprites = 0; stats.modelTarget = null; hero = null; heroInfo = null; target = null;
    T = performance.now() / 1000; dt = lastT ? Math.min(0.05, T - lastT) : 0; lastT = T;
    if (R) { R.info.autoReset = false; R.info.reset(); }   // the frame's draw calls across every pass of the post chain
    hideLq();
    for (const r of Object.values(MODELS.records)) if (r.ready && r.wrap) { r.wrap.visible = false; r.drawn = false; r.used = 0; if (r.copies) for (const c of r.copies) c.visible = false; }
  }
  function setCamera() {
    if (orbit) { orbit.update(); camera.aspect = W / H; camera.updateProjectionMatrix(); setLightsAndSky(); return; }
    // the pinhole: at the follow point, `back` behind it along its forward (s, c), camY up; the frame's principal point on the
    // horizon line (H * horizon from the top), k = W * focal pixels per unit at depth 1; the engine's shake shifts the point
    const sh = (window.ENGINE && ENGINE.shake) || { x: 0, y: 0 };
    const fwd = new THREE.Vector3(X(cam.s), 0, cam.c), pos = new THREE.Vector3(X(cam.x), camY, cam.z).addScaledVector(fwd, -C.camera.back);
    // the camera's matrices are set by hand (matrixAutoUpdate off), and lookAt reads the camera's place from its WORLD MATRIX:
    // the matrix is brought to the new place BEFORE the camera is aimed. (2026-11-05, measured while fixing the double shake:
    // aimed from last frame's place, the camera tilted by its own movement for every frame it moved sideways or up, so in a
    // framing move the world leaned and a mark drawn at project() slid up to 65 px off the thing it marked.)
    camera.position.copy(pos); camera.updateMatrix(); camera.updateMatrixWorld(true);
    camera.up.set(0, 1, 0); camera.lookAt(pos.clone().add(fwd)); camera.updateMatrix(); camera.updateMatrixWorld(true);
    const k = W * focal(), n = 0.1, f = 900;
    const left = (-W / 2 - sh.x) / k * n, right = (W / 2 - sh.x) / k * n, top = (H * C.camera.horizon + sh.y) / k * n, bottom = -(H * (1 - C.camera.horizon) - sh.y) / k * n;
    camera.projectionMatrix.makePerspective(left, right, top, bottom, n, f); camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.near = n; camera.far = f;
    setLightsAndSky();
  }
  function setLightsAndSky() {
    // the sun rides with the camera: high, ahead and to the left, so shadows fall toward the camera and a little right
    if (C.look.lights === 'arena') {
      // the key high and front-left of the follow point, the fill right, the rim behind the far end looking back at the camera
      sun.position.set(X(cam.x) + 7, trackY(cam.z) + 16, cam.z + 2); sun.target.position.set(X(cam.x), trackY(cam.z), cam.z + 9); sun.target.updateMatrixWorld();
      fill.position.set(X(cam.x) - 12, trackY(cam.z) + 8, cam.z + 4); fill.target.position.set(X(cam.x), trackY(cam.z), cam.z + 8); fill.target.updateMatrixWorld();
    } else { sun.position.set(X(cam.x) + 9, trackY(cam.z) + 18, cam.z + 12); sun.target.position.set(X(cam.x), trackY(cam.z), cam.z + 10); sun.target.updateMatrixWorld(); }
    if (rim) { rim.position.set(X(cam.x) - 3, trackY(cam.z) + 9, cam.z + 30); rim.target.position.set(X(cam.x), trackY(cam.z) + 1, cam.z); rim.target.updateMatrixWorld(); }
    // the zone's sky and haze at the follow point
    const z = zoneAt(cam.z), m = zoneMix(cam.z, 25), top3 = mixC(m.a.sky[0], m.b.sky[0], m.t), hor3 = mixC(m.a.sky[1], m.b.sky[1], m.t);
    // the sky never blooms: when the style blooms, the dome's colours are held under the threshold (a pale sky above it veiled
    // the whole frame white, twice)
    const cap = C.look.bloom > 0 ? Math.min(0.85, C.look.threshold - 0.08) : 1, hold = c => { const m = Math.max(c[0], c[1], c[2]); return m > cap ? c.map(v => v * cap / m) : c; };
    const t3 = hold(top3), h3 = hold(hor3);
    sky.material.uniforms.top.value.setRGB(t3[0], t3[1], t3[2]); sky.material.uniforms.hor.value.setRGB(h3[0], h3[1], h3[2]); sky.position.copy(camera.position);
    if (strip) strip.position.set(camera.position.x, trackY(cam.z) + strip.userData.h / 2 - 0.3, camera.position.z);
    scene.fog.color.setRGB(hor3[0], hor3[1], hor3[2]); scene.fog.near = drawDist() * (1 - z.haze); scene.fog.far = drawDist();
  }
  // ── the pre-pass for the water: the opaque scene at half size with a depth texture, read by the water's shader ──
  let pre = null, needPre = false;
  const waters = () => (LQ.pools.pool || []);
  function prePass() {
    const pw = Math.max(64, Math.round(W * dpr / 2)), ph = Math.max(64, Math.round(H * dpr / 2));
    if (!pre || pre.width !== pw || pre.height !== ph) { if (pre) pre.dispose(); pre = new THREE.WebGLRenderTarget(pw, ph, { depthBuffer: true, depthTexture: new THREE.DepthTexture(pw, ph, THREE.UnsignedIntType) }); pre.texture.colorSpace = THREE.LinearSRGBColorSpace; }
    const ws = waters(), vis = ws.map(w => w.visible); for (const w of ws) w.visible = false;
    const parts = LQ.pools['particles:bubbles'] || [], pv = parts.map(x => x.visible); for (const x of parts) x.visible = false;
    const tm = R.toneMapping; R.toneMapping = THREE.NoToneMapping;
    R.setRenderTarget(pre); R.render(scene, camera); R.setRenderTarget(null); R.toneMapping = tm;
    ws.forEach((w, i) => { w.visible = vis[i]; const u = w.material.userData.u; u.tPre.value = pre.texture; u.tDepth.value = pre.depthTexture; u.uRes.value.set(Math.round(W * dpr), Math.round(H * dpr)); });
    parts.forEach((x, i) => { x.visible = pv[i]; });
  }
  function end() {
    if (!ok || lost) return;
    hideRest(); for (let i = PIC.used; i < PIC.pool.length; i++) PIC.pool[i].visible = false;
    plateBackdrop();
    setCamera();
    if (heroLight) {   // a warm light a little in front of and above the hero, toward the camera (the hero reads in a low hemisphere)
      if (hero && C.look.heroLight > 0) { heroLight.position.set(X(hero.x) + 1.0, trackY(hero.z) + hero.y + hero.h * 1.5, hero.z - 1.6); heroLight.intensity = C.look.heroLight * 6; } else heroLight.intensity = 0;   // never .visible: see the rig
    }
    if (needPre) prePass(); else if (pre) { for (const w of waters()) w.visible = false; }   // (no pool this frame: nothing to read)
    if (composer) composer.render(); else R.render(scene, camera);
    needPre = false;
    stats.draws = R.info.render.calls; stats.textures = R.info.memory.textures;
    if (hero) { const a = project(hero.x, hero.y, hero.z), b = project(hero.x, hero.y + hero.h, hero.z); stats.heroShare = Math.abs(a.y - b.y) / H; } else stats.heroShare = 0;
    { const at = target || hero;   // the ground's pattern is read where the play is: at the target when one is named (a hero in hand sits on the lens), else at the hero
      if (at && groundTile) { const a = project(at.x - groundTile.scale / 2, 0, at.z), b = project(at.x + groundTile.scale / 2, 0, at.z); stats.tile = { recipe: groundTile.recipe, px: Math.round(Math.abs(b.x - a.x)) }; } else stats.tile = null; }
    if (target) { const a = project(target.x, target.y, target.z), b = project(target.x, target.y + target.h, target.z); stats.targetShare = Math.abs(a.y - b.y) / H; } else stats.targetShare = 0;
    stats.hero = heroInfo; stats.backdrop = !!strip; stats.backdropKind = strip ? strip.userData.kind : null; stats.style = C.look.style;
    stats.camera = { framing: C.camera.framing, zoom: +(cam.zoom || 1).toFixed(2), frame: +frameU.toFixed(2) };
    stats.heroToTarget = hero && target && target.h > 0 ? +(hero.h / target.h).toFixed(2) : null;   // the hero's size against the target's, in the world's own units
    if (PROF) { profT += performance.now() - t0; profN++; const now = performance.now(); if (now - profAt > 2000) { console.log(`world3 ${(profT / profN).toFixed(2)} ms/frame, ${stats.draws} draws, ${stats.sprites} objects, hero ${(stats.heroShare * 100).toFixed(1)}%`); profT = 0; profN = 0; profAt = now; } }
  }
  const preload = img => { if (ok && img && img.width) texOf(img); };
  /* the empty-ground share (the camera rule's second number, R&D list C; Higgsfield's gate 30 fails it over 20 %): the part of
     the frame below the horizon line where nothing stands on the ground. Measured on request by the battery and the build's
     verify, never per frame: the scene renders twice at a small size, once with only the sky, the ground and the road, once
     whole; a pixel that did not change is empty ground. Returns { empty: share of the lower frame, lower: share of the frame
     below the horizon } */
  function measureEmpty() {
    if (!ok) return null;
    const w = 120, h = Math.round(120 * H / W), rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: true });
    const keep = scene.children.filter(o => o.visible && !o.userData.ground && o !== sky && !o.isLight && o !== camera);
    for (const o of keep) o.visible = false;
    setCamera(); R.setRenderTarget(rt); R.render(scene, camera);
    const a = new Uint8Array(w * h * 4); R.readRenderTargetPixels(rt, 0, 0, w, h, a);
    for (const o of keep) o.visible = true;
    R.render(scene, camera);
    const b = new Uint8Array(w * h * 4); R.readRenderTargetPixels(rt, 0, 0, w, h, b);
    R.setRenderTarget(null); rt.dispose();
    const hor = Math.round(h * (1 - (orbit ? 0.5 : C.camera.horizon)));   // rows are bottom-up in the read-back
    let same = 0, n = 0;
    for (let y = 0; y < hor; y++) for (let x = 0; x < w; x++) { const p = (y * w + x) * 4; n++; if (Math.abs(a[p] - b[p]) < 8 && Math.abs(a[p + 1] - b[p + 1]) < 8 && Math.abs(a[p + 2] - b[p + 2]) < 8) same++; }
    return { empty: +(same / Math.max(1, n)).toFixed(3), lower: +(hor / h).toFixed(3) };
  }
  const framings = Object.freeze(Object.fromEntries(Object.entries(FRAMINGS).map(([k, v]) => [k, Object.freeze({ ...v })])));
  return { framings, init, configure, begin, shape, picture, layer, model, outline, hero: heroAt, target: targetAt, cue, liquid, effect, crowd, board, end, project, preload, measureEmpty, trackX, trackY, trackHalf, heading, fadeAt, get ok() { return ok && !lost; }, get tried() { return tried; }, get config() { return C; }, get view() { return { W, H }; }, stats, get three() { return { scene, camera, renderer: R }; } };
})();
