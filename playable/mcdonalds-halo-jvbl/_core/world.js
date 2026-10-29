/* The world kit (2026-10-18; the pipeline's D-035, D-035a, D-035b; its sonic-01 fixes built in so no game repeats them).
   A general tool in two halves (owner 01:12: "not fixed to a camera angle, usable anywhere"):
   - the GPU core, for every game whatever its camera: the context and its restore, mipmapped premultiplied textures,
     the greybox shapes, every object in one batch sorted far to near, prewarm, the stats and ?prof;
   - camera modes over it, matching the grammar's cameras:
       'perspective'  a camera behind or above the player looking over a ground: rear chase, over the shoulder, a high
                      three-quarter view, a first-person ground (height, back, horizon, focal set the angle)
       'top'          straight down on a ground, scrolling along z (span: units across the frame; anchor: where the
                      follow point sits, as a fraction of the frame height)
       'side'         side-on with a floor line and parallax layers, scrolling along z (span; floor: the floor line as a
                      fraction of the height; anchor: where the follow point sits across); also the panning panorama
       'stage'        a fixed stage or close-up: no world, only the objects, in frame fractions (x, y) with sizes in
                      frame widths; the sharp, flicker-free batch for any fixed-camera game
   A game describes its world here and never writes a shader, never draws its own road, never sorts its own objects.

   What it draws, all on the GPU, under the engine's 2D canvas:
     the sky (a gradient per zone, dissolving between zones), the ground, the track and its lane lines, and every object
     in the world (greybox shapes or the Build stage's pictures) with its shadow, sorted far to near in one batch.
   The 2D canvas keeps only screen overlays (speed lines, flash, light, words in the game); the HUD and cards are the
   engine's. There is no 2D world path: every phone and ad web view has WebGL 1. A lost context is restored; a page that
   cannot get WebGL at all shows the end card with the call to action (the engine does it when WORLD.ok is false).

   WORLD.init(VIEW.world) once (the engine calls it when VIEW.world is set; WORLD.configure(VIEW.world), the shape
   without the GPU, runs first, before a sim too), where VIEW.world = {
     kind:      'track' | 'ground'
     camera:    { mode: 'perspective', framing: 'chase-low' | 'chase-high', feet?, size?, horizon?, focal?, follow, turn }
                A PERSPECTIVE CAMERA IS NAMED BY ITS FRAMING (2026-10-23, Sonic: typed heights and distances put the runner
                mid-frame, then a third of the frame tall): the framing says what the player SEES, and the kit solves the
                camera's height and distance from the framed subject's height (the runner kit passes its body height):
                  'chase-low'   feet at 0.80 of the frame height, the runner 0.15 of it tall, horizon 0.38, focal 1.25: a
                                rear runner seen from behind and above, about 25 degrees down, the long road ahead (sonic-01)
                  'chase-high'  feet at 0.82, the runner 0.12 tall, horizon 0.30, focal 1.0: higher, about 35 degrees down,
                                more of the road and its lanes seen from above (lane runners, crowded rows)
                feet / size / horizon / focal nudge the framing within fixed bounds (feet 0.74-0.86, size 0.10-0.20, horizon
                0.28-0.42, focal 0.8-1.5); height and back are the kit's and are not written. The page's OWN horizon (the
                plate's horizon line, the blueprint's marks) is the framing's: WORLD.framings['chase-low'].horizon, read
                when the page sets G (world.js loads before the page). A page written before the framings (height, back)
                still draws as it did.
                The old form, kept for pages written before 2026-10-23: { mode, height, back, horizon, focal, follow, turn }   follow: the share of the player's sideways offset the
                camera follows (the runner kit: 1 for lanes, 0.5 for steer); perspective: world units above the ground and behind the follow
                point, the horizon as a fraction of the frame height (0.38), focal in frame widths (0.9 = wide); turn: the share
                of the road's direction the camera turns with on a track (1: it looks down the road through a bend, as a chase
                camera does; 0: it always faces straight along z), rigid, from the track's own shape, never eased;
                { mode: 'top', span, anchor } · { mode: 'side', span, floor, anchor } · { mode: 'stage', background }
     layers:    [{ depth, colour, height, rough }]   ('side') parallax silhouettes, far (depth 0.1) to near (0.8)
     track:     { half, lanes, laneW, path: [{ len, bend, rise, half }] }   ('track' only) half width; lanes 0 = free; a
                segment's half eases the width to that value over the segment (the edges close in); each path
                segment eases its own bend (sideways units over the segment) and rise; or x(z) and y(z) functions
     zones:     [{ at, sky: [top, horizon], skyPlate, ground, groundAlt, road, roadAlt, line, groundTile, roadTile, haze }]   colours by distance; *Alt is a
                groundTile / roadTile: the ids of the zone's painted tile layers (rule 24: every large surface is a texture); the kit
                repeats them along the track (tileLen world units per tile, 6) and blends zone to zone; the colours stand until
                the tiles have loaded. In EVERY camera mode with a ground (2026-10-28, a side-view build kept its canyon tile
                in the folder and drew flat colour): perspective repeats them along the track; side tiles the floor face under
                the floor line with the ground tile; top tiles the ground with it and the track with the road tile.
                skyPlate: the id of the zone's sky picture (a `plate` layer): THE far backdrop in perspective and side view,
                covering the frame, its measured line (the pack's meta.measured.found) sitting on the camera's horizon
                (perspective) or floor line (side), a slow parallax across in side view; the sky colours stand until it has
                loaded and still give the haze. A world-kit page never draws a plate itself: a plate it declares is a
                zone's skyPlate, or it is never seen (2026-10-28, a sky with the brand's ring was painted and never drawn).
                second tint in bands across the surface (every `band` units) so speed reads on a flat greybox (P7)
     band:      units between ground bands (8); roadBand: units between road bands (6)
     drawDist:  how far the world is drawn (160); haze: the colour the far world fades into (the horizon sky by default)
     lines:     { dash, gap, width, alpha }   lane lines on a lanes track (3, 3, 0.05, 0.55)
   }
   Per frame, in the page's drawFrame:
     WORLD.begin(cam)                      cam = { x, y, z } the follow point on the ground (the runner kit gives it); in
                                           'side' the floor, the layers and the objects all move with cam.y together
     WORLD.shape(kind, x, y, z, w, h, colour, o)   a greybox object: kind 'box' | 'disc' | 'ring' | 'capsule' | 'blob';
                                                   x across, y above the ground, z along; w, h in world units;
                                                   o = { shadow: true, sink: 0.025, alpha, flat: true (lies on the ground) }
     WORLD.picture(img, rect, x, y, z, w, h, o)    the same for a picture (rect = its cell [sx, sy, sw, sh] or null)
     WORLD.layer(L, kind, x, y, z, w, h, colour, o) THE call for every object a layer paints: L from VIEW.layers; its picture once
                                                   loaded (the build's file), the shape `kind` until then, in the same box; a
                                                   sheet's cell o.cell; an animated character plays by the clock (o.animAt for a
                                                   one-shot); the picture keeps its own proportions (the height holds): the CELL
                                                   is the box, as the painter was given it, so every cell of a sheet keeps one
                                                   scale (a crouch stays shorter than a stand). With the
                                                   runner kit: kinds name their `layer`, R.draw(WORLD, { layers: VIEW.layers, playerLayer }).
     WORLD.end()                           draws everything queued, far to near
   Helpers: WORLD.project(x, y, z) -> { x, y, s } in CSS pixels (s = pixels per world unit), for the 2D overlays;
     WORLD.trackX(z), WORLD.trackY(z), WORLD.trackHalf(z) (the width at z), WORLD.heading(z); WORLD.fadeAt(z) (0..1, for anything drawn in 2D far away);
     WORLD.ok; WORLD.view ({ W, H } in CSS pixels); WORLD.stats (draw calls and textures of the last frame, read by the phone budget).
   ?prof prints the world's time per frame to the console every 2 s. */
window.WORLD = (function () {
  let C = null, gl = null, cv = null, aniso = null, lost = false, ok = false, tried = false;
  let W = 640, H = 960, dpr = 1, cam = { x: 0, y: 0, z: 0, c: 1, s: 0 }, camY = 2;
  const P = {}, TX = new Map(), stats = { draws: 0, textures: 0, sprites: 0 };
  const PROF = new URLSearchParams(location.search).has('prof');
  let profT = 0, profN = 0, profAt = 0;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = t => t * t * (3 - 2 * t);
  const hex = c => { const s = String(c || '#888').replace('#', ''); const n = parseInt(s.length === 3 ? s.split('').map(ch => ch + ch).join('') : s, 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

  // ── the track's path: segments ease their bend and rise (a straight start eases in; sonic-01's sway grew over 60 m) ──
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
  const trackHalf = z => !C.track ? 0 : segs.length ? along(z, 'h0', 'h1') : (C.track.half || 3);   // the width at z (it may narrow)
  const heading = z => (trackX(z + 1) - trackX(z - 1)) / 2;

  // ── the projection: one pinhole camera, horizon at a fixed line (verticals stay vertical); the same numbers for the
  //    GPU world and every 2D overlay (sonic-01 fix 1) ──
  const focal = () => (C.camera.focal || 0.9);
  const mode = () => C.camera.mode;
  // a ground point in the camera's frame, turned about the follow point by the camera's turn: [across, depth from the eye]
  const eye = (x, z) => { const dx = x - cam.x, dz = z - cam.z; return [dx * cam.c - dz * cam.s, dx * cam.s + dz * cam.c + C.camera.back]; };
  function project(x, y, z) {
    const sh = (window.ENGINE && ENGINE.shake) || { x: 0, y: 0 }, m = mode();
    if (m === 'top') { const s = W / C.camera.span; return { x: W / 2 + (x - cam.x) * s + sh.x, y: H * C.camera.anchor - (z - cam.z) * s - y * s * 0.5 + sh.y, s }; }
    if (m === 'side') { const s = W / C.camera.span; return { x: W * C.camera.anchor + (z - cam.z) * s + sh.x, y: H * C.camera.floor - (y - cam.y) * s + sh.y, s }; }
    if (m === 'stage') return { x: x * W + sh.x, y: y * H + sh.y, s: W };
    const e = eye(x, z), dz = Math.max(0.05, e[1]), k = W * focal();
    return { x: W / 2 + k * e[0] / dz + sh.x, y: H * C.camera.horizon - k * (y - camY) / dz + sh.y, s: k / dz };
  }
  const drawDist = () => C.drawDist || 160;
  const fadeAt = z => mode() !== 'perspective' ? 1 : clamp((drawDist() - (z - cam.z)) / 30, 0, 1);   // the far edge fades in over 30 units, never a line

  // ── zones: colours by distance, blended over 10 units around each line (smoothstep), the sky over 25 ──
  /** the zone's haze strength at z: its own `haze` (0..1) or 0.45 */
  function zoneHaze(z) { const Z = C.zones; let i = 0; while (i + 1 < Z.length && z >= Z[i + 1].at) i++; const hv = Z[i] && typeof Z[i].haze === 'number' ? Z[i].haze : 0.45; return clamp(hv, 0, 0.7); }
  function zoneMix(z, span) {
    const Z = C.zones; let i = 0; while (i + 1 < Z.length && z >= Z[i + 1].at - span / 2) i++;
    if (i + 1 < Z.length) { const t = clamp((z - (Z[i + 1].at - span / 2)) / span, 0, 1); if (t > 0) return { a: Z[i], b: Z[i + 1], t: ease(t) }; }
    return { a: Z[i], b: Z[i], t: 0 };
  }
  const mixC = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  // ── shaders ──
  // surfaces: per-vertex colour (zone-blended), a band tint by world distance, the verge shade, the haze to the sky
  const VS_SURF = `attribute vec3 p; attribute vec3 c0; attribute vec3 c1; attribute vec3 f;
    uniform vec4 pr; uniform vec2 sh; varying vec3 vC0; varying vec3 vC1; varying vec3 vF;
    void main() { vC0 = c0; vC1 = c1; vF = f; float Z = p.z;
      gl_Position = vec4(pr.x * p.x + sh.x * Z, pr.y * p.y + pr.z * Z + sh.y * Z, pr.w * Z - 0.6 * 400.0 / 399.7, Z); }`;
  // f = (band coordinate in world units / band, across 0..1, haze 0..1)
  const FS_SURF = `#ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform vec3 haze; uniform float verge; uniform float fadeEdge; varying vec3 vC0; varying vec3 vC1; varying vec3 vF;
    void main() {
      float b = fract(vF.x * 0.5); float w = fwidthless(vF.x);
      float m = smoothstep(0.5 - w, 0.5 + w, b);
      vec3 col = mix(vC0, vC1, m);
      if (verge > 0.0) { float u = vF.y; float e = smoothstep(0.0, 0.04, u) * smoothstep(1.0, 0.96, u); col *= mix(0.78, 1.0, e); }
      col = mix(col, haze, vF.z);
      gl_FragColor = vec4(col, 1.0); }`;
  // WebGL 1 has no fwidth without an extension: the band edge is softened by distance on the CPU instead (vF.x carries
  // whole bands; the edge width rides in the haze channel's spare range is not needed: a fixed soft edge is used)
  const FS_SURF_SRC = FS_SURF.replace('float w = fwidthless(vF.x);', 'float w = 0.04;');
  const FS_LINE = `precision mediump float; varying vec3 vC0; varying vec3 vC1; varying vec3 vF; void main() { gl_FragColor = vec4(vC0 * vF.x, vF.x); }`;
  // textured surfaces (rule 24; the Sonic session's glworld, 2026-10-23): the zone's painted tile repeated along the track, up to
  // three zones blended by the row's zone weight; the verge shade and the haze as on the colour surfaces
  const VS_TSURF = `attribute vec3 p; attribute vec2 uv; attribute vec3 f; attribute float zf;
    uniform vec4 pr; uniform vec2 sh; varying vec2 vUv; varying vec3 vF; varying float vZ;
    void main() { vUv = uv; vF = f; vZ = zf; float Z = p.z;
      gl_Position = vec4(pr.x * p.x + sh.x * Z, pr.y * p.y + pr.z * Z + sh.y * Z, pr.w * Z - 0.6 * 400.0 / 399.7, Z); }`;
  const FS_TSURF = `precision mediump float;
    uniform sampler2D t0; uniform sampler2D t1; uniform sampler2D t2; uniform vec3 haze; uniform float verge; varying vec2 vUv; varying vec3 vF; varying float vZ;
    void main() { vec3 a = texture2D(t0, vUv).rgb; vec3 b = texture2D(t1, vUv).rgb; vec3 c = texture2D(t2, vUv).rgb;
      vec3 col = vZ < 1.0 ? mix(a, b, vZ) : mix(b, c, min(vZ - 1.0, 1.0));
      if (verge > 0.0) { float u = vF.y; float e = smoothstep(0.0, 0.04, u) * smoothstep(1.0, 0.96, u); col *= mix(0.78, 1.0, e); }
      col = mix(col, haze, vF.z);
      gl_FragColor = vec4(col, 1.0); }`;
  const VS_FLAT = `attribute vec2 q; attribute vec4 c; uniform vec2 sh; varying vec4 vC; void main() { vC = c; gl_Position = vec4(q.x + sh.x, q.y + sh.y, 0.0, 1.0); }`;
  const FS_FLAT = `precision mediump float; varying vec4 vC; void main() { gl_FragColor = vC; }`;
  const VS_SKY = `attribute vec2 q; attribute vec3 c; uniform vec2 sh; varying vec3 vC; void main() { vC = c; gl_Position = vec4(q.x + sh.x, q.y + sh.y, 0.0, 1.0); }`;
  const FS_SKY = `precision mediump float; varying vec3 vC; void main() { gl_FragColor = vec4(vC, 1.0); }`;
  // objects: premultiplied, mipmapped, one batch (sonic-01 fix 26: no "mirage" from jumping between shrunk copies)
  const VS_SPR = `attribute vec2 p; attribute vec2 uv; attribute vec4 c; uniform vec2 res; varying vec2 vUv; varying vec4 vC;
    void main() { vUv = uv; vC = c; gl_Position = vec4(p.x / res.x * 2.0 - 1.0, 1.0 - p.y / res.y * 2.0, 0.0, 1.0); }`;
  const FS_SPR = `precision mediump float; uniform sampler2D t; varying vec2 vUv; varying vec4 vC; void main() { gl_FragColor = texture2D(t, vUv) * vC; }`;

  function prog(vs, fs) {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const loc = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i); loc[u.name] = gl.getUniformLocation(p, u.name); }
    const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES); for (let i = 0; i < na; i++) { const a = gl.getActiveAttrib(p, i); loc['@' + a.name] = gl.getAttribLocation(p, a.name); }
    return { p, loc };
  }

  // ── textures: one per picture, mipmapped at powers of two (WebGL 1 needs them; max 2048 a side on the GPU path,
  //    sonic-01 fix 39), premultiplied; the sources are kept so a lost context is restored by re-uploading ──
  const p2 = n => { let p = 1; while (p < n && p < 2048) p *= 2; return p; };   // 2048: every phone's texture size holds it; a sheet is a grid within it
  function texOf(src) {
    let t = TX.get(src); if (t && t.gl) return t.gl;
    const c = document.createElement('canvas'); c.width = p2(src.width); c.height = p2(src.height);
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height);
    const g = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, g);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    TX.set(src, { gl: g, w: c.width, h: c.height });
    return g;
  }

  // a repeating texture for a surface tile (a power of two, mipmapped, anisotropic): once per picture
  const TXR = new Map();
  function repTex(src) {
    let t = TXR.get(src); if (t) return t;
    const c = document.createElement('canvas'); c.width = p2(src.width); c.height = p2(src.height);
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height);
    t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    TXR.set(src, t); return t;
  }
  /* a picture the GPU will not take (a tainted canvas: a file:// page, a picture from another origin) is said once and left
     out, and the colour surface or the greybox shape stands for it; the frame never faults on it (2026-10-28) */
  const BAD = new Set();
  function safeTex(up, src) {
    if (BAD.has(src)) return null;
    try { return up(src); } catch (e) { BAD.add(src); console.error('world kit: a picture cannot be uploaded to the GPU (from another origin?); its colour or shape stands', e); return null; }
  }
  /* the tiles of a surface ('groundTile' | 'roadTile'): the first three zones' pictures once every one has loaded, the last
     repeated to three; null (the colour surface stands) when a zone names none or one is not in yet */
  function tilesOf(key) {
    const Z = C.zones.slice(0, 3); if (!Z.length) return null;
    const LA = typeof LAYERS !== 'undefined' ? LAYERS : window.LAYERS; if (!LA || !LA.ART) return null;
    const imgs = [];
    for (const z of Z) { if (!z[key]) return null; const im = LA.ART[z[key]]; if (!im || !im.width) return null; imgs.push(im); }
    while (imgs.length < 3) imgs.push(imgs[imgs.length - 1]);
    for (const im of imgs) if (!safeTex(repTex, im)) return null;
    return imgs;
  }
  /* the sky plate (the zone's `skyPlate`, a plate layer) once loaded: its picture and its measured line (the pack's
     meta.measured.found, a fraction of the picture's height; null when the pack measured none). The zone the camera is in. */
  function plateOf() {
    const m = zoneMix(cam.z, 25), z = m.t > 0.5 ? m.b : m.a; if (!z || !z.skyPlate) return null;
    const LA = typeof LAYERS !== 'undefined' ? LAYERS : window.LAYERS; if (!LA || !LA.ART) return null;
    const im = LA.ART[z.skyPlate]; if (!im || !im.width || !safeTex(texOf, im)) return null;
    const L = (LA.LOADED || []).find(l => l.id === z.skyPlate), rec = LA.META && ((L && LA.META[L.name]) || LA.META[z.skyPlate]);
    const line = rec && rec.measured && typeof rec.measured.found === 'number' ? rec.measured.found : null;
    return { im, line };
  }
  // ── screen-space textured quads (the sky plate, the tiles of the flat views): CSS pixels, uv in texture repeats, drawn at
  //    once with the object program; a list per zone so a blend band's overlay is drawn over its base ──
  let tsx = 0, tsy = 0;   // this frame's shake, CSS px
  function texQuad(list, p, uv, a) {   // p: tl, tr, bl, br; uv: the same corners
    for (const i of [0, 1, 2, 1, 3, 2]) list.push((p[i * 2] + tsx) * dpr, (p[i * 2 + 1] + tsy) * dpr, uv[i * 2], uv[i * 2 + 1], a, a, a, a);
  }
  function texDraw(tex, list) {
    if (!list.length) return;
    for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
    const L = P.spr.loc; gl.useProgram(P.spr.p); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform2f(L.res, cv.width, cv.height); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(L.t, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, P.sbuf); gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from(list), gl.STREAM_DRAW);
    gl.enableVertexAttribArray(L['@p']); gl.vertexAttribPointer(L['@p'], 2, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(L['@uv']); gl.vertexAttribPointer(L['@uv'], 2, gl.FLOAT, false, 32, 8);
    gl.enableVertexAttribArray(L['@c']); gl.vertexAttribPointer(L['@c'], 4, gl.FLOAT, false, 32, 16);
    gl.drawArrays(gl.TRIANGLES, 0, list.length / 8); stats.draws++; gl.disable(gl.BLEND); list.length = 0;
  }
  /* the tiles of the flat views: one list per zone (the first three), the zone's tile bound to it; a quad in a blend band goes
     to both zones' lists, the far zone's at the blend's weight, and the lists draw in zone order so the overlay lands on top */
  function tileLists(imgs) { return { imgs, lists: [[], [], []] }; }
  function tileQuad(T, z, p, uv) {
    const m = zoneMix(z, 10), ia = Math.min(2, Math.max(0, C.zones.indexOf(m.a))), ib = Math.min(2, Math.max(0, C.zones.indexOf(m.b)));
    texQuad(T.lists[ia], p, uv, 1);
    if (m.t > 0 && ib !== ia) texQuad(T.lists[ib], p, uv, m.t);
  }
  function tileDraw(T) { for (let i = 0; i < 3; i++) texDraw(repTex(T.imgs[i]), T.lists[i]); }
  /* the sky plate over the frame: covering it, its measured line on yLine (the horizon or the floor line), centred across with a
     slow parallax in side view, never a gap at an edge; a plate with no measured line is fitted to cover from the top */
  function drawPlate(pl, yLine, parallax) {
    const im = pl.im, pw = im.width, ph = im.height;
    let k = Math.max(W / pw, H / ph);
    if (pl.line != null && pl.line > 0.02 && pl.line < 0.98) k = Math.max(k, yLine / (pl.line * ph), (H - yLine) / ((1 - pl.line) * ph));
    const w = pw * k, h = ph * k, y0 = pl.line != null ? yLine - pl.line * h : 0, slack = w - W;
    const x0 = Math.max(-slack, Math.min(0, -slack / 2 - parallax));
    const list = []; texQuad(list, [x0, y0, x0 + w, y0, x0, y0 + h, x0 + w, y0 + h], [0, 0, 1, 0, 0, 1, 1, 1], 1); texDraw(texOf(im), list);
  }
  /* a textured strip: p, uv (across and along in tiles), f (band, across 0..1, haze), zf (the zone weight: index a + t) */
  function tstrip(rows, half, lift) {
    const need = rows.length * 2 * 9; if (vb.length < need) vb = new Float32Array(need * 2);
    let o = 0; const tl = C.tileLen || 6;
    for (const z of rows) {
      const rx = C.kind === 'track' ? trackX(z) : cam.x, ry = trackY(z) + lift, m = zoneMix(z, 10), fd = 1 - fadeAt(z);
      const hz = clamp(((z - cam.z) - drawDist() * 0.62) / (drawDist() * 0.38), 0, 1) * zoneHaze(z);
      const ia = Math.min(2, Math.max(0, C.zones.indexOf(m.a))), ib = Math.min(2, Math.max(0, C.zones.indexOf(m.b)));
      const zf = ia === ib ? ia : ib > ia ? ia + m.t : ib + (1 - m.t);
      const hw = typeof half === 'function' ? half(z) : half;
      for (const side of [-1, 1]) {
        const e = eye(rx + side * hw, z); vb[o++] = e[0]; vb[o++] = ry - camY; vb[o++] = e[1];
        vb[o++] = (side < 0 ? 0 : 1) * (2 * hw / tl); vb[o++] = z / tl;
        vb[o++] = 0; vb[o++] = side < 0 ? 0 : 1; vb[o++] = Math.max(hz, fd);
        vb[o++] = zf;
      }
    }
    return o;
  }
  function bindTSurf(n) {
    const L = P.tsurf.loc, F = 4, S = 9 * F;
    const at = (name, k, off) => { const l = L['@' + name]; if (l >= 0) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, k, gl.FLOAT, false, S, off); } };
    gl.bindBuffer(gl.ARRAY_BUFFER, P.buf); gl.bufferData(gl.ARRAY_BUFFER, vb.subarray(0, n), gl.STREAM_DRAW);
    at('p', 3, 0); at('uv', 2, 3 * F); at('f', 3, 5 * F); at('zf', 1, 8 * F);
  }
  /* one textured surface: the tiles bound to three units, the same projection and haze as the colour surfaces */
  function drawTextured(imgs, rows, half, verge, pr, sh, hor) {
    for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
    gl.useProgram(P.tsurf.p);
    gl.uniform4f(P.tsurf.loc.pr, pr[0], pr[1], pr[2], pr[3]); gl.uniform2f(P.tsurf.loc.sh, sh[0], sh[1]); gl.uniform3f(P.tsurf.loc.haze, hor[0], hor[1], hor[2]); gl.uniform1f(P.tsurf.loc.verge, verge);
    for (let k = 0; k < 3; k++) { gl.activeTexture(gl.TEXTURE0 + k); gl.bindTexture(gl.TEXTURE_2D, repTex(imgs[k])); gl.uniform1i(P.tsurf.loc['t' + k], k); }
    const n = tstrip(rows, half, 0); bindTSurf(n); gl.drawArrays(gl.TRIANGLE_STRIP, 0, n / 9); stats.draws++;
    gl.activeTexture(gl.TEXTURE0);
    for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
    gl.useProgram(P.surf.p);
  }

  // ── the greybox shapes: drawn once at load, white, tinted per object (built behind the loader, rule 38) ──
  const SHAPES = {};
  function makeShapes() {
    const mk = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.strokeStyle = '#fff'; draw(x, w, h); return c; };
    SHAPES.box = mk(128, 128, (x, w, h) => { const r = 14; x.beginPath(); x.moveTo(r, 0); x.arcTo(w, 0, w, h, r); x.arcTo(w, h, 0, h, r); x.arcTo(0, h, 0, 0, r); x.arcTo(0, 0, w, 0, r); x.fill(); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(0,0,0,.16)'; x.fillRect(0, h * 0.82, w, h); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(0, 0, w, h * 0.1); });
    SHAPES.disc = mk(128, 128, (x, w) => { x.beginPath(); x.arc(w / 2, w / 2, w / 2 - 1, 0, 7); x.fill(); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(0,0,0,.14)'; x.beginPath(); x.arc(w / 2, w * 0.62, w / 2, 0, 7); x.fill(); });
    SHAPES.ring = mk(128, 128, (x, w) => { x.lineWidth = w * 0.16; x.beginPath(); x.arc(w / 2, w / 2, w / 2 - w * 0.09, 0, 7); x.stroke(); });
    SHAPES.capsule = mk(64, 128, (x, w, h) => { const r = w / 2; x.beginPath(); x.arc(r, r, r - 1, Math.PI, 0); x.lineTo(w - 1, h - r); x.arc(r, h - r, r - 1, 0, Math.PI); x.closePath(); x.fill(); x.globalCompositeOperation = 'source-atop'; x.fillStyle = 'rgba(0,0,0,.15)'; x.fillRect(w * 0.6, 0, w, h); });
    SHAPES.blob = mk(128, 64, (x, w, h) => { const g = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.6, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.setTransform(1, 0, 0, h / w, 0, 0); x.fillStyle = g; x.beginPath(); x.arc(w / 2, w / 2, w / 2, 0, 7); x.fill(); });
  }

  // ── setup and restore ──
  function setupGL() {
    gl = cv.getContext('webgl', { alpha: false, antialias: true, depth: true, premultipliedAlpha: true, powerPreference: 'high-performance' });
    if (!gl) return false;
    aniso = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
    P.surf = prog(VS_SURF, FS_SURF_SRC); P.tsurf = prog(VS_TSURF, FS_TSURF); P.line = prog(VS_SURF, FS_LINE); P.flat = prog(VS_FLAT, FS_FLAT); P.sky = prog(VS_SKY, FS_SKY); P.spr = prog(VS_SPR, FS_SPR);
    P.buf = gl.createBuffer(); P.sbuf = gl.createBuffer();
    for (const v of TX.values()) v.gl = null;   // re-uploaded on next use (and right away for the shapes: prewarm)
    for (const s of Object.values(SHAPES)) texOf(s);
    return true;
  }
  // the world's shape (its config, path and width) without the GPU: the engine sets it before a sim, so the runner
  // kit's bots play the same track the player sees
  // ── named framings (2026-10-23): what the player sees, solved into the camera's numbers ──
  const FRAMINGS = {
    'chase-low': { feet: 0.80, size: 0.15, horizon: 0.38, focal: 1.25 },
    'chase-high': { feet: 0.82, size: 0.12, horizon: 0.30, focal: 1.0 },
  };
  const BOUNDS = { feet: [0.74, 0.86], size: [0.10, 0.20], horizon: [0.28, 0.42], focal: [0.8, 1.5] };
  let framed = null, framedKey = '';
  function frameSpec(cam) {
    const base = FRAMINGS[cam.framing] || (console.error(`world kit: unknown framing "${cam.framing}"; chase-low is used (framings: ${Object.keys(FRAMINGS).join(', ')})`), FRAMINGS['chase-low']);
    const out = {};
    for (const k of Object.keys(BOUNDS)) { const v = typeof cam[k] === 'number' ? cam[k] : base[k]; out[k] = Math.min(BOUNDS[k][1], Math.max(BOUNDS[k][0], v)); }
    return out;
  }
  /* the camera for a framing: the subject (subjectH units tall) at the follow point projects its feet at spec.feet and
     its height at spec.size of the frame, through the kit's own projection (y = H * horizon + W * focal * camY / back) */
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
    C.camera = Object.assign({ mode: 'perspective', height: 2.2, back: 5, horizon: 0.38, focal: 0.9, span: 12, anchor: 0.72, floor: 0.78 }, C.camera || {});
    if (C.camera.mode === 'side' && cfg && cfg.camera && cfg.camera.anchor == null) C.camera.anchor = 0.3;
    if (C.camera.mode === 'perspective' && C.camera.framing) { framed = frameSpec(C.camera); solveFraming(C.camera.subject); }
    C.layers = (C.layers || []).map((l, i) => ({ depth: l.depth == null ? 0.2 + i * 0.2 : l.depth, colour: hex(l.colour || '#a7b3c2'), height: l.height == null ? 0.18 : l.height, rough: l.rough == null ? 0.5 : l.rough, seed: l.seed || i * 7.3 + 1 })).sort((a, b) => a.depth - b.depth);
    C.zones = (C.zones && C.zones.length ? C.zones : [{ at: 0 }]).map(z => ({
      at: z.at || 0, sky: (z.sky || ['#9fc3e6', '#e8eef5']).map(hex), ground: hex(z.ground || '#b9bcc2'), groundAlt: hex(z.groundAlt || z.ground || '#b0b3b9'),
      road: hex(z.road || '#8d9097'), roadAlt: hex(z.roadAlt || z.road || '#858890'), line: hex(z.line || '#ffffff'),
      // the zone's painted tiles and its haze strength travel with it (2026-10-23: the normalised zone had dropped them)
      groundTile: z.groundTile || null, roadTile: z.roadTile || null, skyPlate: z.skyPlate || null, haze: typeof z.haze === 'number' ? z.haze : undefined }));
    C.lines = Object.assign({ dash: 3, gap: 3, width: 0.05, alpha: 0.55 }, C.lines || {});
    camY = C.camera.height;
    buildPath();
  }
  function init(cfg) {
    if (tried) return ok; tried = true;
    configure(cfg); makeShapes();
    const under = document.getElementById('game');
    if (!under) return (ok = false);
    cv = document.createElement('canvas'); cv.id = 'world'; cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
    under.parentNode.insertBefore(cv, under);
    try { ok = setupGL(); } catch (e) { console.error('world kit', e); ok = false; }
    if (!ok) { cv.remove(); return false; }
    new ResizeObserver(measure).observe(cv); measure();
    cv.addEventListener('webglcontextlost', e => { e.preventDefault(); lost = true; });
    cv.addEventListener('webglcontextrestored', () => { try { setupGL(); lost = false; } catch (e) { console.error('world kit restore', e); } });
    return true;
  }

  // ── a frame ──
  const Q = [];   // queued objects this frame: { d (depth), src, rect, corners, colour, alpha }
  let t0 = 0;
  function begin(c) {
    if (PROF) t0 = performance.now();
    cam = { x: c.x || 0, y: c.y || 0, z: c.z || 0, c: 1, s: 0 };
    if (framed) solveFraming(c.subject || C.camera.subject);   // the framed subject's height (the runner kit sends its body's)
    camY = (C.camera.height || 2) + (c.y || 0);
    // the turn: the road's direction over the next 6 units, so the camera looks into a bend rather than past it
    const tn = C.kind === 'track' && mode() === 'perspective' ? (C.camera.turn == null ? 1 : C.camera.turn) : 0;
    if (tn) { const a = tn * Math.atan((trackX(cam.z + 6) - trackX(cam.z)) / 6); cam.c = Math.cos(a); cam.s = Math.sin(a); }
    Q.length = 0;
  }
  function measure() { const r = cv.getBoundingClientRect(); W = r.width || 640; H = r.height || 960; dpr = Math.min(1.5, devicePixelRatio || 1); }
  function size() {
    const bw = Math.round(W * dpr), bh = Math.round(H * dpr); if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
  }

  // surfaces: world-aligned rows (1/2/4 units by distance, sonic-01 fix 3), coordinates relative to the camera so the
  // numbers stay small on phone GPUs (fix 4)
  let vb = new Float32Array(8192);
  function rowsAhead() {
    // a turned camera sees past the rows straight ahead on one side: the rows reach that much further both ways
    const pad = Math.ceil(Math.abs(cam.s) * 100), out = []; let z = Math.floor(cam.z - C.camera.back) + 1 - pad; const end = cam.z + drawDist() + 4 + pad;
    while (z <= end) { out.push(z); const d = z - cam.z, st = d < 30 ? 1 : d < 80 ? 2 : 4; z = Math.floor((z + st) / st) * st; }
    return out;
  }
  function strip(rows, half, kindOf, band, lift) {
    const need = rows.length * 2 * 12; if (vb.length < need) vb = new Float32Array(need * 2);
    let o = 0; const haze = C.haze ? hex(C.haze) : null;
    for (const z of rows) {
      const rx = C.kind === 'track' ? trackX(z) : cam.x, ry = trackY(z) + lift, m = zoneMix(z, 10), fd = 1 - fadeAt(z);
      // aerial haze toward the horizon (rule 25, the Sonic session): from the far third, up to the zone's strength (0.45 unless
      // the zone says `haze`), into the horizon's own colour; a page's haze colour is an override, never a wash over the course
      const hz = clamp(((z - cam.z) - drawDist() * 0.62) / (drawDist() * 0.38), 0, 1) * (zoneHaze(z));
      const c0 = mixC(kindOf(m.a, 0), kindOf(m.b, 0), m.t), c1 = mixC(kindOf(m.a, 1), kindOf(m.b, 1), m.t), bz = (z - Math.floor(cam.z / (2 * band)) * 2 * band) / band;
      const hw = typeof half === 'function' ? half(z) : half;
      for (const side of [-1, 1]) {
        const e = eye(rx + side * hw, z); vb[o++] = e[0]; vb[o++] = ry - camY; vb[o++] = e[1];
        vb[o++] = c0[0]; vb[o++] = c0[1]; vb[o++] = c0[2]; vb[o++] = c1[0]; vb[o++] = c1[1]; vb[o++] = c1[2];
        vb[o++] = bz; vb[o++] = side < 0 ? 0 : 1; vb[o++] = Math.max(hz, fd);
      }
    }
    return o;
  }
  function bindSurf(n, pr) {
    const L = (pr || P.surf).loc, F = 4, S = 12 * F;
    const at = (name, k, off) => { const l = L['@' + name]; if (l >= 0) { gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, k, gl.FLOAT, false, S, off); } };
    gl.bindBuffer(gl.ARRAY_BUFFER, P.buf); gl.bufferData(gl.ARRAY_BUFFER, vb.subarray(0, n), gl.STREAM_DRAW);
    at('p', 3, 0); at('c0', 3, 3 * F); at('c1', 3, 6 * F); at('f', 3, 9 * F);
  }
  function drawWorld() {
    size();
    gl.viewport(0, 0, cv.width, cv.height);
    const sky = zoneMix(cam.z + drawDist() * 0.5, 25), top = mixC(sky.a.sky[0], sky.b.sky[0], sky.t), hor = mixC(sky.a.sky[1], sky.b.sky[1], sky.t);
    gl.clearColor(hor[0], hor[1], hor[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
    const sh = (window.ENGINE && ENGINE.shake) || { x: 0, y: 0 }, shx = sh.x * 2 / W, shy = -sh.y * 2 / H; tsx = sh.x; tsy = sh.y;
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    // the sky: the zone's plate once loaded, its measured line on the horizon; a gradient from the top to just under the horizon until then
    const pl = plateOf();
    if (pl) drawPlate(pl, H * C.camera.horizon, 0);
    else {
      const hy = 1 - 2 * C.camera.horizon;
      const sv = new Float32Array([-1, 1, ...top, 1, 1, ...top, -1, hy - 0.04, ...hor, 1, hy - 0.04, ...hor]);
      gl.useProgram(P.sky.p);
      gl.bindBuffer(gl.ARRAY_BUFFER, P.buf); gl.bufferData(gl.ARRAY_BUFFER, sv, gl.STREAM_DRAW);
      gl.enableVertexAttribArray(P.sky.loc['@q']); gl.vertexAttribPointer(P.sky.loc['@q'], 2, gl.FLOAT, false, 20, 0);
      gl.enableVertexAttribArray(P.sky.loc['@c']); gl.vertexAttribPointer(P.sky.loc['@c'], 3, gl.FLOAT, false, 20, 8);
      gl.uniform2f(P.sky.loc.sh, shx, shy); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); stats.draws++;
    }
    for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
    // the ground and the track
    const k = focal(), near = 0.3, far = 400, A = (far + near) / (far - near);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.useProgram(P.surf.p);
    gl.uniform4f(P.surf.loc.pr, 2 * k, 2 * W * k / H, 1 - 2 * C.camera.horizon, A); gl.uniform2f(P.surf.loc.sh, shx, shy);
    gl.uniform3f(P.surf.loc.haze, hor[0], hor[1], hor[2]);
    const rows = rowsAhead();
    const prU = [2 * k, 2 * W * k / H, 1 - 2 * C.camera.horizon, A], shU = [shx, shy];
    // the ground and the track from their painted tiles once loaded (rule 24), the zone colours until then
    const gT = tilesOf('groundTile');
    let n;
    if (gT) drawTextured(gT, rows, C.groundHalf || 120, 0, prU, shU, hor);
    else { n = strip(rows, C.groundHalf || 120, (z, i) => i ? z.groundAlt : z.ground, C.band, 0); bindSurf(n); gl.uniform1f(P.surf.loc.verge, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, n / 12); stats.draws++; }
    if (C.kind === 'track') {
      gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);   // the road over the ground, never fighting it (fix 10)
      const rT = tilesOf('roadTile');
      if (rT) drawTextured(rT, rows, trackHalf, 1, prU, shU, hor);
      else { n = strip(rows, trackHalf, (z, i) => i ? z.roadAlt : z.road, C.roadBand, 0); bindSurf(n); gl.uniform1f(P.surf.loc.verge, 1); gl.drawArrays(gl.TRIANGLE_STRIP, 0, n / 12); stats.draws++; }
      gl.uniform4f(P.surf.loc.pr, prU[0], prU[1], prU[2], prU[3]); gl.uniform2f(P.surf.loc.sh, shx, shy); gl.uniform3f(P.surf.loc.haze, hor[0], hor[1], hor[2]);
      // lane lines: at their exact world positions, never per segment; thinner than a device pixel they fade (fix 5)
      const lanes = C.track.lanes || 0;
      if (lanes > 1) {
        gl.polygonOffset(-2, -4);
        const Lw = C.track.laneW || (2 * C.track.half / lanes), L = C.lines, per = L.dash + L.gap, out = [];
        for (let z0 = Math.floor((cam.z - C.camera.back) / per) * per; z0 < cam.z + drawDist(); z0 += per) for (let li = 1; li < lanes; li++) {
          const lx = (li - lanes / 2) * Lw, q = [];
          for (const z of [z0, z0 + L.dash]) {
            const e = eye(trackX(z) + lx, z), dz = Math.max(0.3, e[1]), px = 2 * L.width * k * W / dz * dpr, m = zoneMix(z, 10), lc = mixC(m.a.line, m.b.line, m.t);
            const al = L.alpha * Math.min(1, px) * fadeAt(z), x = e[0], y = trackY(z) - camY;
            q.push([x - L.width, y, dz, lc, al], [x + L.width, y, dz, lc, al]);
          }
          const v = (p) => [p[0], p[1], p[2], p[3][0], p[3][1], p[3][2], 0, 0, 0, p[4], 0, 0];
          out.push(...v(q[0]), ...v(q[1]), ...v(q[2]), ...v(q[1]), ...v(q[3]), ...v(q[2]));
        }
        if (out.length) {
          // the lines blend over the road: colour premultiplied by alpha, added over a darkened road by alpha
          if (vb.length < out.length) vb = new Float32Array(out.length * 2);
          gl.useProgram(P.line.p); gl.uniform4f(P.line.loc.pr, 2 * k, 2 * W * k / H, 1 - 2 * C.camera.horizon, A); gl.uniform2f(P.line.loc.sh, shx, shy);
          for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
          vb.set(out); bindSurf(out.length, P.line);
          gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
          gl.drawArrays(gl.TRIANGLES, 0, out.length / 12); stats.draws++; gl.disable(gl.BLEND);
        }
      }
      gl.disable(gl.POLYGON_OFFSET_FILL);
    }
    gl.disable(gl.DEPTH_TEST);
  }

  // screen-space colour triangles: xy in CSS pixels, rgba straight (premultiplied here)
  let fb = new Float32Array(6 * 2048), fn = 0;
  function tri6(x0, y0, x1, y1, c, a) {   // an axis-aligned quad (two triangles), CSS pixels
    if (fb.length < fn + 36) { const nb = new Float32Array(fb.length * 2); nb.set(fb); fb = nb; }
    const al = a == null ? 1 : a, X = v => v / W * 2 - 1, Y = v => 1 - v / H * 2, r = c[0] * al, g = c[1] * al, b = c[2] * al;
    for (const [x, y] of [[x0, y0], [x1, y0], [x0, y1], [x1, y0], [x1, y1], [x0, y1]]) { fb[fn++] = X(x); fb[fn++] = Y(y); fb[fn++] = r; fb[fn++] = g; fb[fn++] = b; fb[fn++] = al; }
  }
  function quad4(p, c, a) {   // any four corners (tl, tr, bl, br), CSS pixels
    if (fb.length < fn + 36) { const nb = new Float32Array(fb.length * 2); nb.set(fb); fb = nb; }
    const al = a == null ? 1 : a, X = v => v / W * 2 - 1, Y = v => 1 - v / H * 2, r = c[0] * al, g = c[1] * al, b = c[2] * al;
    for (const i of [0, 1, 2, 1, 3, 2]) { fb[fn++] = X(p[i * 2]); fb[fn++] = Y(p[i * 2 + 1]); fb[fn++] = r; fb[fn++] = g; fb[fn++] = b; fb[fn++] = al; }
  }
  function quadG(p, c0, c1, a) {
    if (fb.length < fn + 36) { const nb = new Float32Array(fb.length * 2); nb.set(fb); fb = nb; }
    const al = a == null ? 1 : a, X = v => v / W * 2 - 1, Y = v => 1 - v / H * 2;
    for (const i of [0, 1, 2, 1, 3, 2]) { const c = i < 2 ? c0 : c1; fb[fn++] = X(p[i * 2]); fb[fn++] = Y(p[i * 2 + 1]); fb[fn++] = c[0] * al; fb[fn++] = c[1] * al; fb[fn++] = c[2] * al; fb[fn++] = al; }
  }
  const zc = (z, key, alt) => { const m = zoneMix(z, 10); return mixC(m.a[alt ? key + 'Alt' : key], m.b[alt ? key + 'Alt' : key], m.t); };
  function flushFlat(shx, shy) {
    if (!fn) return;
    for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
    const L = P.flat.loc; gl.useProgram(P.flat.p); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.bindBuffer(gl.ARRAY_BUFFER, P.buf); gl.bufferData(gl.ARRAY_BUFFER, fb.subarray(0, fn), gl.STREAM_DRAW);
    gl.enableVertexAttribArray(L['@q']); gl.vertexAttribPointer(L['@q'], 2, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(L['@c']); gl.vertexAttribPointer(L['@c'], 4, gl.FLOAT, false, 24, 8);
    gl.uniform2f(L.sh, shx, shy); gl.drawArrays(gl.TRIANGLES, 0, fn / 6); stats.draws++; fn = 0; gl.disable(gl.BLEND);
  }
  function drawFlatWorld() {
    size(); gl.viewport(0, 0, cv.width, cv.height);
    const m = mode(), sh = (window.ENGINE && ENGINE.shake) || { x: 0, y: 0 }, shx = sh.x * 2 / W, shy = -sh.y * 2 / H; tsx = sh.x; tsy = sh.y;
    const at = zoneMix(cam.z, 25), top = mixC(at.a.sky[0], at.b.sky[0], at.t), hor = mixC(at.a.sky[1], at.b.sky[1], at.t);
    const bg = m === 'stage' && C.camera.background ? hex(C.camera.background) : hor;
    gl.clearColor(bg[0], bg[1], bg[2], 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); gl.disable(gl.DEPTH_TEST);
    if (m === 'stage') { if (!C.camera.background) { quad4([0, 0, W, 0, 0, H, W, H].map((v, i) => v), top, 1); } flushFlat(shx, shy); return; }
    const s = W / C.camera.span, Lw = C.track ? (C.track.laneW || (2 * (C.track.half || 3) / Math.max(1, C.track.lanes || 1))) : 0;
    const tl = C.tileLen || 6, gT = tilesOf('groundTile'), rT = C.kind === 'track' ? tilesOf('roadTile') : null;
    if (m === 'top') {
      // the ground in bands along z (world-aligned: they never swim), the track over it, its verges and lane lines; the ground
      // and the track from their painted tiles once loaded (rule 24), tl units a tile, the zone colours until then
      const zMin = cam.z - (H * (1 - C.camera.anchor)) / s - 2, zMax = cam.z + (H * C.camera.anchor) / s + 2, B = C.band;
      const GT = gT ? tileLists(gT) : null, u0 = (cam.x - (W / 2) / s) / tl, u1 = (cam.x + (W / 2) / s) / tl;
      for (let b = Math.floor(zMin / B); b * B < zMax; b++) { const z0 = b * B, y0 = H * C.camera.anchor - (z0 + B - cam.z) * s, y1 = H * C.camera.anchor - (z0 - cam.z) * s + 0.5;
        if (GT) tileQuad(GT, z0 + B / 2, [0, y0, W, y0, 0, y1, W, y1], [u0, -(z0 + B) / tl, u1, -(z0 + B) / tl, u0, -z0 / tl, u1, -z0 / tl]);
        else quadG([0, y0, W, y0, 0, y1, W, y1], zc(z0 + B, 'ground', b & 1), zc(z0, 'ground', b & 1)); }
      if (GT) tileDraw(GT);
      if (C.kind === 'track') {
        const RB = C.roadBand, RT = rT ? tileLists(rT) : null;
        if (RT) flushFlat(shx, shy);   // a colour ground under a tiled track
        for (let z = Math.floor(zMin); z < zMax; z += 1) {
          const half = trackHalf(z), h1 = trackHalf(z + 1);
          const a0 = project(trackX(z) - half, 0, z), b0 = project(trackX(z) + half, 0, z), a1 = project(trackX(z + 1) - h1, 0, z + 1), b1 = project(trackX(z + 1) + h1, 0, z + 1);
          const alt = Math.floor(z / RB) & 1, c = zc(z, 'road', alt);
          if (RT) tileQuad(RT, z + 0.5, [a1.x - sh.x, a1.y - sh.y, b1.x - sh.x, b1.y - sh.y, a0.x - sh.x, a0.y - sh.y + 0.5, b0.x - sh.x, b0.y - sh.y + 0.5], [0, -(z + 1) / tl, 2 * h1 / tl, -(z + 1) / tl, 0, -z / tl, 2 * half / tl, -z / tl]);
          else quadG([a1.x - sh.x, a1.y - sh.y, b1.x - sh.x, b1.y - sh.y, a0.x - sh.x, a0.y - sh.y + 0.5, b0.x - sh.x, b0.y - sh.y + 0.5], zc(z + 1, 'road', alt), c);
          const vw = half * 0.08 * s, dark = [c[0] * 0.8, c[1] * 0.8, c[2] * 0.8];   // the verge: a soft shade, never a kerb strip
          quad4([a1.x - sh.x, a1.y - sh.y, a1.x - sh.x + vw, a1.y - sh.y, a0.x - sh.x, a0.y - sh.y + 0.5, a0.x - sh.x + vw, a0.y - sh.y + 0.5], dark, 0.6);
          quad4([b1.x - sh.x - vw, b1.y - sh.y, b1.x - sh.x, b1.y - sh.y, b0.x - sh.x - vw, b0.y - sh.y + 0.5, b0.x - sh.x, b0.y - sh.y + 0.5], dark, 0.6);
        }
        if (RT) tileDraw(RT);   // the verges and the lane lines (the flat buffer) land over the tiled track at the flush
        const lanes = C.track.lanes || 0, L = C.lines, per = L.dash + L.gap;
        if (lanes > 1) for (let z0 = Math.floor(zMin / per) * per; z0 < zMax; z0 += per) for (let li = 1; li < lanes; li++) {
          const lx = (li - lanes / 2) * Lw, p0 = project(trackX(z0) + lx, 0, z0), p1 = project(trackX(z0 + L.dash) + lx, 0, z0 + L.dash), hw = Math.max(0.5, L.width * s);
          const zm = zoneMix(z0, 10); quad4([p1.x - hw - sh.x, p1.y - sh.y, p1.x + hw - sh.x, p1.y - sh.y, p0.x - hw - sh.x, p0.y - sh.y, p0.x + hw - sh.x, p0.y - sh.y], mixC(zm.a.line, zm.b.line, zm.t), L.alpha * Math.min(1, hw * 2 * dpr));
        }
      }
      flushFlat(shx, shy); return;
    }
    // side: the sky to the floor line, the parallax silhouettes far to near, the floor in bands. The floor, the layers
    // and the objects share one frame: the ground at z sits at gy(z) (the track's rise against the camera's height), so
    // whatever height the camera holds, a grounded object stands on the floor line drawn under it
    const fy = H * C.camera.floor, gy = z => fy - (trackY(z) - cam.y) * s, dy = gy(cam.z) - fy;
    // the sky: the zone's plate once loaded, its measured line on the floor line, sliding slowly with the camera; the gradient until then
    const pl = plateOf();
    if (pl) drawPlate(pl, fy, cam.z * s * 0.05); else quadG([0, 0, W, 0, 0, fy, W, fy], top, hor, 1);
    for (const l of C.layers) {
      const col = mixC(l.colour, hor, (1 - l.depth) * 0.5), shift = cam.z * s * l.depth, step = 8, hgt = l.height * H, base = fy + dy * l.depth;   // far layers move less, up and down as across
      for (let x = 0; x < W + step; x += step) {
        const u0 = (x + shift) / (W * 0.45), u1 = (x + step + shift) / (W * 0.45);
        const h0 = hgt * (0.55 + 0.45 * (0.6 * Math.sin(u0 * 2.1 + l.seed) + 0.4 * Math.sin(u0 * 5.3 + l.seed * 2) * l.rough));
        const h1 = hgt * (0.55 + 0.45 * (0.6 * Math.sin(u1 * 2.1 + l.seed) + 0.4 * Math.sin(u1 * 5.3 + l.seed * 2) * l.rough));
        quad4([x, base - h0, x + step, base - h1, x, H, x + step, H], col, 1);   // down to the frame's foot: a dip in the floor shows the hills, never a gap
      }
    }
    // the floor face under the floor line: the ground tile once loaded (rule 24), tl units a tile along and down, the zone
    // colours in bands until then; the thin floor line in the road colour over either
    if (C.floorFace === false) { flushFlat(shx, shy); return; }   // a page whose plate is the whole backdrop draws no floor face
    const zL = cam.z - (W * C.camera.anchor) / s - 2, zR = cam.z + (W * (1 - C.camera.anchor)) / s + 2, B = C.band;
    const GT = gT ? tileLists(gT) : null;
    if (GT) flushFlat(shx, shy);   // the sky and its hills under the tiles
    for (let b = Math.floor(zL / B); b * B < zR; b++) {
      const z0 = b * B, x0 = W * C.camera.anchor + (z0 - cam.z) * s, x1 = x0 + B * s + 0.5, steps = 4;
      for (let k = 0; k < steps; k++) {   // across the band in four steps, each with the zone colour of its own distance
        const za = z0 + B * k / steps, zb = za + B / steps, xa = x0 + (x1 - x0) * k / steps, xb = x0 + (x1 - x0) * (k + 1) / steps + 0.5, c = zc(za + B / steps / 2, 'ground', b & 1);
        const ya = gy(za), yb = gy(zb), lw = Math.max(2, 0.18 * s);
        if (GT) tileQuad(GT, za + B / steps / 2, [xa, ya, xb, yb, xa, H, xb, H], [za / tl, 0, zb / tl, 0, za / tl, (H - ya) / (tl * s), zb / tl, (H - yb) / (tl * s)]);
        else quad4([xa, ya, xb, yb, xa, H, xb, H], c, 1);
        quad4([xa, ya, xb, yb, xa, ya + lw, xb, yb + lw], zc(za + B / steps / 2, 'road', 0), 1);   // the floor line, following the rise
      }
    }
    if (GT) tileDraw(GT);
    flushFlat(shx, shy);
  }

  // ── objects ──
  function corners(px, py, w, h, s, sink) {   // a box standing on (px, py) in CSS pixels → device-pixel corners
    const ww = w * s, hh = h * s, x0 = (px - ww / 2) * dpr, x1 = (px + ww / 2) * dpr, y1 = (py + hh * sink) * dpr, y0 = (py - hh * (1 - sink)) * dpr;
    return [x0, y0, x1, y0, x0, y1, x1, y1];
  }
  function queueFlat(src, rect, x, y, z, w, h, colour, o) {
    const m = mode(), gy0 = m === 'side' ? trackY(z) : 0, p = project(x, gy0 + y, z), ww = w * p.s,   // side: y above the ground at z, as in perspective
    hh = h * p.s, r = rect || [0, 0, src.width, src.height];
    if (p.x + ww < -40 || p.x - ww > W + 40 || p.y + hh < -40 || p.y - hh > H + 40) return;
    const al = o.alpha == null ? 1 : o.alpha, col = colour ? hex(colour) : [1, 1, 1];
    const d = o.depth != null ? o.depth : m === 'side' ? x : m === 'top' ? -y : 0;
    const grounded = m === 'side' && !o.centre;
    const sink = grounded && y <= 0 ? (o.sink == null ? 0.025 : o.sink) : 0;
    if (o.shadow !== false && (m === 'top' || (m === 'side' && o.shadow !== undefined) || (m === 'side' && grounded))) {
      if (m === 'top') { const ox = ww * 0.12, oy = hh * 0.12; Q.push({ shadow: true, d: d + 0.001, src, rect: r, q: [(p.x - ww / 2 + ox) * dpr, (p.y - hh / 2 + oy) * dpr, (p.x + ww / 2 + ox) * dpr, (p.y - hh / 2 + oy) * dpr, (p.x - ww / 2 + ox) * dpr, (p.y + hh / 2 + oy) * dpr, (p.x + ww / 2 + ox) * dpr, (p.y + hh / 2 + oy) * dpr], c: [0, 0, 0, 0.25 * al] }); }
      else { const g = project(x, gy0, z), lift = clamp(1 - y / Math.max(h * 2, 0.5), 0.25, 1); Q.push({ shadow: true, d: d + 0.001, src: SHAPES.blob, rect: null, q: corners(g.x, g.y, w * (0.9 + (1 - lift) * 0.4), h * 0.14, g.s, 0.5), c: [0, 0, 0, 0.3 * lift * al] }); }
    }
    let q, rr = r;
    if (grounded) { q = corners(p.x, p.y, w, h, p.s, 0); if (sink) { rr = [r[0], r[1], r[2], r[3] * (1 - sink)]; q[1] = q[3] = (p.y - hh * (1 - sink)) * dpr; } }
    else q = [(p.x - ww / 2) * dpr, (p.y - hh / 2) * dpr, (p.x + ww / 2) * dpr, (p.y - hh / 2) * dpr, (p.x - ww / 2) * dpr, (p.y + hh / 2) * dpr, (p.x + ww / 2) * dpr, (p.y + hh / 2) * dpr];
    if (o.rot) { const cx = p.x * dpr, cy = p.y * dpr, c = Math.cos(o.rot), sn = Math.sin(o.rot); for (let i = 0; i < 8; i += 2) { const dx = q[i] - cx, dy = q[i + 1] - cy; q[i] = cx + dx * c - dy * sn; q[i + 1] = cy + dx * sn + dy * c; } }   // o.rot: turned about the foot, clockwise (a leaning thing)
    Q.push({ d, src, rect: rr, q, c: [col[0] * al, col[1] * al, col[2] * al, al] });
  }
  function queue(src, rect, x, y, z, w, h, colour, o) {
    o = o || {};
    if (mode() !== 'perspective') return queueFlat(src, rect, x, y, z, w, h, colour, o);
    const d = eye(x, z)[1];   // the depth from the eye: the near cut and the far-to-near order, turned camera or not
    if (d < 0.4 || z > cam.z + drawDist()) return;
    const fade = fadeAt(z) * (o.alpha == null ? 1 : o.alpha);
    if (fade <= 0) return;
    const gy = trackY(z), base = project(x, gy + y, z), sink = o.sink == null ? 0.025 : o.sink;   // grounded: sunk into the ground (rule 26)
    const r = rect || [0, 0, src.width, src.height];
    if (o.shadow !== false && !o.flat) {
      // the shadow as the Sonic session settled it (rule 25, the lab's castShadow, 2026-10-23 06:30): the object's own silhouette
      // with its base edges the object's base edges and the base never moving; laid on the ground toward the camera and a
      // little right (the light high ahead and left), flattened; darkest at the base, fading to its far end; by on-screen size,
      // gone when tiny; plus a thin contact line where it touches the ground. A grey placeholder keeps its blob.
      const g = project(x, gy, z), lift = clamp(1 - y / Math.max(h * 2, 0.5), 0.25, 1);
      const grey = Object.values(SHAPES).includes(src), sshape = o.shadowShape || (grey ? 'blob' : null);
      const near = clamp((w * g.s / W - 0.015) / 0.08, 0, 1);   // by on-screen width: gone under 1.5% of the frame, full from ~10%
      if (grey || sshape) {
        const q = corners(g.x, g.y, w * 1.15, w * 0.45, g.s, 0.5), a = 0.42 * lift * fade * clamp(g.s * w / 12, 0.2, 1);
        Q.push({ shadow: true, d: d + 0.001, src: SHAPES[sshape || 'blob'], rect: null, q, c: [0, 0, 0, a] });
      } else if (near > 0) {
        const ww = w * g.s * dpr, hh = h * g.s * dpr, bx = g.x * dpr, by = g.y * dpr;
        const len = hh * (0.13 * near + 0.02), shear = ww * 0.3 * near;   // the far end: a little toward the camera's right, flattened
        // base corners stay the object's; the far corners (the silhouette's top) come down the screen and to the right
        const q = [bx - ww / 2 + shear, by + len, bx + ww / 2 + shear, by + len, bx - ww / 2, by, bx + ww / 2, by];
        const a = Math.max(0.12, 0.5 - (y > 0 ? y / Math.max(h, 0.5) : 0)) * near * fade;
        Q.push({ shadow: true, d: d + 0.001, src, rect: r, q, c: [0, 0, 0, a], c2: [0, 0, 0, a * 0.35] });
        const cq = corners(g.x, g.y, w * 0.5, w * 0.08, g.s, 0.5);
        Q.push({ shadow: true, d: d + 0.0005, src: SHAPES.blob, rect: null, q: cq, c: [0, 0, 0, 0.35 * near * fade] });
      }
    }
    let q;
    if (o.flat) { const a = project(x - w / 2, gy, z - h / 2), b = project(x + w / 2, gy, z - h / 2), c = project(x - w / 2, gy, z + h / 2), e = project(x + w / 2, gy, z + h / 2); q = [c.x * dpr, c.y * dpr, e.x * dpr, e.y * dpr, a.x * dpr, a.y * dpr, b.x * dpr, b.y * dpr]; }
    else q = corners(base.x, base.y, w, h, base.s, y > 0 ? 0 : sink);
    const col = colour ? hex(colour) : [1, 1, 1];
    // a grounded thing's sunk part is cut from its own rows (cropB), never clipped (fix 25)
    const rr = (!o.flat && y <= 0 && sink > 0) ? [r[0], r[1], r[2], r[3] * (1 - sink)] : r;
    if (!o.flat && y <= 0 && sink > 0) q[5] = q[7] = base.y * dpr;
    Q.push({ d, src, rect: rr, q, c: [col[0] * fade, col[1] * fade, col[2] * fade, fade] });
  }
  const shape = (kind, x, y, z, w, h, colour, o) => { if (ok && SHAPES[kind]) queue(SHAPES[kind], null, x, y, z, w, h, colour || '#9aa0a8', o); };
  const picture = (img, rect, x, y, z, w, h, o) => { if (ok && img && img.width) queue(img, rect, x, y, z, w, h, null, o); };
  /* a LAYER in the world (2026-10-23, the Sonic build: every picture landed and the page drew grey shapes): the layer's picture
     once it has loaded (LAYERS.ART), the greybox shape `kind` until then, the same box either way. A sheet's cell comes from
     o.cell; an animated sheet (meta.anim) plays by the clock, a one-shot from o.animAt, the other cells as stills, as the 2D
     draw does. Pages and the runner kit draw every object through this, never through shape() alone. */
  const layer = (L, kind, x, y, z, w, h, colour, o) => {
    const LA = typeof LAYERS !== 'undefined' ? LAYERS : (window.LAYERS || null);
    const img = L && LA && LA.ART && LA.ART[L.id];
    if (!img || !img.width) { shape(kind, x, y, z, w, h, colour, o); return; }
    let rect = null;
    const c = (o && o.cell) || 0;
    const rec = LA.META && (LA.META[L.name] || LA.META[L.id]);   // keyed by the file's name, as the build writes it
    const anim = rec && rec.anim;
    if (anim && anim.frames > 1) {
      // the sheet is a grid (anim.cols a row; one row when absent): the animated cell's frames first, the other cells after
      const others = (L.cells ? L.cells.cols * L.cells.rows : 1) - 1, total = anim.frames + others, cols = anim.cols || total, ac = anim.cell || 0;
      const sw = img.width / cols, sh = img.height / Math.ceil(total / cols);
      const i = c === ac ? LA.animCell(anim, o && o.animAt != null ? o.animAt : null) : anim.frames + (c > ac ? c - 1 : c);
      rect = [(i % cols) * sw, Math.floor(i / cols) * sh, sw, sh];
    } else if (L.cells && L.type === 'sheet') {
      const sw = img.width / L.cells.cols, sh = img.height / L.cells.rows;
      rect = [(c % L.cells.cols) * sw, Math.floor(c / L.cells.cols) * sh, sw, sh];
    }
    // the picture is never stretched (2026-10-23 01:08, the owner on the test track: "a fat short Sonic"): the height holds,
    // the width follows the cell's own shape; and the record's foot line (meta.foot, the share of the cell above the feet)
    // sits on the ground: the room under the feet is sunk and cut, so the shadow starts at the feet, not under the room
    // the cell IS the box (2026-10-28/29): the painter paints at the cell's scale and the layer stage sends back a picture short
    // of its placeholder (the fill check, 0.8), so the kit never rescales a cell by its painted part; a draw by the painted
    // bounds was tried for a day and broke two things at once: a wide-short pillar drawn at the box's height grew to the width
    // of the gap beside it, and a crouch cell drawn at the stand's height stood taller than the stand
    const rw = rect ? rect[2] : img.width, rh = rect ? rect[3] : img.height;
    if (o && o.flat) { picture(img, rect, x, y, z, w, w * (rh / rw), Object.assign({}, o)); return; }   // lying flat: the depth from the picture
    // o.squash (the runner kit's turning sheet, rule 28): the cell drawn at the exact width of this moment's turn
    // o.scale (the runner kit's turning sheet): a cell painted a little smaller or larger drawn at the sheet's typical size
    if (o && o.scale > 0 && o.scale !== 1) h *= o.scale;
    const ww = h * (rw / rh) * (o && o.squash > 0 ? o.squash : 1);
    // the record's foot line: a number (the animated sheet's: the share of the cell above the room under the feet) or the 2D
    // record's contact ellipse {cx, cy, rx, ry} (a still's), whose BOTTOM edge is the lowest solid row (2026-10-23 10:04, the
    // owner: "the prop sinking is a bit too much": the ellipse's centre sits inside the base, and taking it as the feet cut
    // the boulder's bottom). The room under the feet is cut, then the object sinks 2.5% of its height, as the Sonic session's
    // drawGrounded did (rule 26); never more
    // a sheet's cell: its own base from the record's per-cell feet (2026-10-23, a tree and a palm in one scenery sheet floated)
    const cellFoot = !anim && y <= 0 && rec && Array.isArray(rec.feet) && typeof rec.feet[c] === 'number' ? rec.feet[c] : null;   // standing things only: a floating ring keeps its place
    const room = cellFoot != null ? 1 - cellFoot : rec && typeof rec.foot === 'number' ? 1 - rec.foot : rec && rec.foot && typeof rec.foot.cy === 'number' ? Math.max(0, 1 - (rec.foot.cy + (rec.foot.ry || 0))) : 0;
    const oo = Object.assign({ shadowShape: null }, o || {});
    if (oo.sink == null) oo.sink = Math.min(0.5, Math.max(0, room)) + 0.025;
    picture(img, rect, x, y, z, ww, h, oo);
  };

  let sb = new Float32Array(8 * 6 * 256);
  function end() {
    if (!ok || lost) return;
    stats.draws = 0; stats.sprites = Q.length;
    if (mode() === 'perspective') drawWorld(); else drawFlatWorld();
    // far to near, one upload, one draw per run of the same texture
    // shadows first (they lie on the ground under everything: one pass, few texture changes), then far to near
    Q.sort((a, b) => (b.shadow ? 1 : 0) - (a.shadow ? 1 : 0) || b.d - a.d);
    const need = Q.length * 6 * 8; if (sb.length < need) sb = new Float32Array(need * 2);
    let o = 0; const runs = []; let cur = null;
    for (const it of Q) {
      const t = TX.get(it.src), g = t && t.gl ? t.gl : safeTex(texOf, it.src), sw = it.src.width, sh = it.src.height;
      if (!g) continue;
      if (!cur || cur.g !== g) { cur = { g, start: o / 8, n: 0 }; runs.push(cur); }
      const r = it.rect || [0, 0, sw, sh], u0 = r[0] / sw, v0 = r[1] / sh, u1 = (r[0] + r[2]) / sw, v1 = (r[1] + r[3]) / sh, q = it.q, c = it.c;
      const c2 = it.c2 || c;   // a shadow fades to its far end: the top corners take c2 (rule 25)
      const V = (x, y, u, v, cc) => { sb[o++] = x; sb[o++] = y; sb[o++] = u; sb[o++] = v; sb[o++] = cc[0]; sb[o++] = cc[1]; sb[o++] = cc[2]; sb[o++] = cc[3]; };
      V(q[0], q[1], u0, v0, c2); V(q[2], q[3], u1, v0, c2); V(q[4], q[5], u0, v1, c); V(q[2], q[3], u1, v0, c2); V(q[6], q[7], u1, v1, c); V(q[4], q[5], u0, v1, c);
      cur.n += 6;
    }
    if (o) {
      for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
      const L = P.spr.loc; gl.useProgram(P.spr.p); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.uniform2f(L.res, cv.width, cv.height); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(L.t, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, P.sbuf); gl.bufferData(gl.ARRAY_BUFFER, sb.subarray(0, o), gl.STREAM_DRAW);
      gl.enableVertexAttribArray(L['@p']); gl.vertexAttribPointer(L['@p'], 2, gl.FLOAT, false, 32, 0);
      gl.enableVertexAttribArray(L['@uv']); gl.vertexAttribPointer(L['@uv'], 2, gl.FLOAT, false, 32, 8);
      gl.enableVertexAttribArray(L['@c']); gl.vertexAttribPointer(L['@c'], 4, gl.FLOAT, false, 32, 16);
      for (const r of runs) { gl.bindTexture(gl.TEXTURE_2D, r.g); gl.drawArrays(gl.TRIANGLES, r.start, r.n); stats.draws++; }
      gl.disable(gl.BLEND);
    }
    stats.textures = TX.size;
    Q.length = 0;
    if (PROF) { profT += performance.now() - t0; profN++; const now = performance.now(); if (now - profAt > 2000) { console.log(`world ${(profT / profN).toFixed(2)} ms/frame, ${stats.draws} draws, ${stats.sprites} objects`); profT = 0; profN = 0; profAt = now; } }
  }
  const preload = img => { if (ok && img && img.width) texOf(img); };

  const framings = Object.freeze(Object.fromEntries(Object.entries(FRAMINGS).map(([k, v]) => [k, Object.freeze({ ...v })])));
  return { framings, init, configure, begin, shape, picture, layer, end, project, preload, trackX, trackY, trackHalf, heading, fadeAt, get ok() { return ok && !lost; }, get tried() { return tried; }, get config() { return C; }, get view() { return { W, H }; }, stats };
})();
