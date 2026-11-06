/* The surface kit (2026-11-04, Phase 1 item 3; R&D list B): surfaces by code, never by picture tiles.
   A recipe is a height function h(u, v) -> 0..1 plus a tint; baked ONCE at load on a canvas into an albedo (a grey around
   1.0 with the recipe's own tint variation, so the zone's colour stays the tone: the material multiplies the vertex colour
   by the map) and a normal map by finite differences. 256 px by default (a tile of `scale` world units), 512 for a ground
   seen close. A bake is a few milliseconds of code and no bytes in the file; an image tile of the same size is 150-300 KB.
   Recipes: court (hardwood boards with a varnish), planks (decks, bridges), stone (flagstones), cobbles, tiles (square with
   grout), cloth (weave with stripes), sand (ripples and grain), grass (a meadow in two scales with blade speckle), asphalt
   (fine grain, a few cracks), metal (brushed lines with patina). Every noise is seeded, so a bake is the same on every run.
   SURFACES.bake(name | { recipe, scale, size, seed, strength }) -> { map, normalMap, scale } (three.js textures, repeat wrap).
   `strength` scales the normal map (each recipe has its own default: a varnished court 0.35, cobbles 1.2); a page sets it only
   when the look at play distance asks for it. */
import * as THREE from './three.js';
export const SURFACES = (function () {
  // ── seeded hash and value noise (tileable: coordinates wrap at `period`) ──
  const fract = x => x - Math.floor(x);
  const hash2 = (x, y, seed) => fract(Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453);
  const smooth = t => t * t * (3 - 2 * t);
  function vnoise(x, y, period, seed) {   // value noise on a grid of `period` cells, wrapping
    const xi = Math.floor(x), yi = Math.floor(y), fx = smooth(x - xi), fy = smooth(y - yi);
    const w = (i, j) => hash2(((xi + i) % period + period) % period, ((yi + j) % period + period) % period, seed);
    const a = w(0, 0), b = w(1, 0), c = w(0, 1), d = w(1, 1);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  function fbm(u, v, octaves, base, seed) {   // u, v in 0..1 tile space; base: cells across the tile at octave 0
    let s = 0, amp = 0.5, f = base, norm = 0;
    for (let i = 0; i < octaves; i++) { s += amp * vnoise(u * f, v * f, f, seed + i * 3.1); norm += amp; amp *= 0.5; f *= 2; }
    return s / norm;
  }
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const wrap = x => x - Math.floor(x);

  // ── recipes: (u, v, seed) -> { h: 0..1, t: tint 0.7..1.3 (a multiplier on the tone), g?: gloss 0..1 } ──
  const RECIPES = {
    court(u, v, seed) {   // a maple court (2026-11-05, the owner: "tiles instead of a wooden basketball floor... wavy texture"):
      // strips 24 across a tile and one long (a 3 m tile: 12 cm by 3 m, the proportion of a real strip), rows offset by a
      // random share so the ends never line up; a fine noise grain along the strip, no sine; a shallow seam, since a varnished
      // court is nearly flat (the old recipe's six squat boards and full-depth seams read as grooved bricks from the thrower's eye)
      const cols = 24, p = u * cols, col = Math.floor(p), f = wrap(p), e = Math.min(f, 1 - f);
      const off = hash2(col, 0, seed + 11), rv = wrap(v + off), row = Math.floor(v + off), ev = Math.min(rv, 1 - rv);
      const board = hash2(col, row, seed);
      const grain = fbm(u * 1.0, v * 0.12 + board * 3.1, 3, 48, seed + 5);
      const seam = sstep(0, 0.09, e) * sstep(0, 0.006, ev);
      return { h: 0.8 + 0.2 * seam + 0.02 * grain, t: (0.93 + 0.14 * board) * (0.96 + 0.08 * grain), g: 0.55 };
    },
    planks(u, v, seed) {   // decks: boards 1 wide, 6 long, rows offset 0.5; knots; strong grain
      const cols = 4, p = u * cols, col = Math.floor(p), rowf = v * 1.5 + 0.5 * (col % 2), row = Math.floor(rowf), f = wrap(p), e = Math.min(f, 1 - f), ef = Math.min(wrap(rowf), 1 - wrap(rowf));
      const board = hash2(col, row, seed);
      const grain = fbm(u * 1.5, v * 0.08 + board, 2, 32, seed + 7);
      const kx = hash2(col, row, seed + 2) * 0.6 + 0.2, ky = hash2(col, row, seed + 3), kd = Math.hypot((f - kx) * 1.2, wrap(rowf) - ky);
      const knot = 1 - sstep(0.02, 0.06, kd);
      return { h: sstep(0, 0.04, e) * sstep(0, 0.025, ef) * (0.8 + 0.2 * grain) - 0.15 * knot, t: (0.78 + 0.3 * board) * (0.9 + 0.14 * grain) * (1 - 0.3 * knot), g: 0.2 };
    },
    stone(u, v, seed) {   // flagstones: 4 x 4 cells, jittered corners, bevelled edges, a little surface noise
      const n = 4, p = u * n, q = v * n, ci = Math.floor(p), cj = Math.floor(q);
      const jx = (hash2(ci, cj, seed) - 0.5) * 0.25, jy = (hash2(ci, cj, seed + 1) - 0.5) * 0.25;
      const fx = wrap(p) - 0.5 - jx, fy = wrap(q) - 0.5 - jy, e = 0.46 - Math.max(Math.abs(fx), Math.abs(fy)) + 0.03 * (fbm(u, v, 2, 24, seed) - 0.5);
      const bevel = sstep(0, 0.08, e), id = hash2(ci, cj, seed + 5);
      return { h: bevel * (0.75 + 0.25 * fbm(u, v, 3, 12, seed + 9)), t: (0.85 + 0.3 * id) * (0.94 + 0.12 * fbm(u, v, 2, 40, seed + 4)), g: 0.1 };
    },
    cobbles(u, v, seed) {   // rounded stones in jittered rows
      const cx = 7, cy = 5, row = Math.floor(v * cy), shift = 0.5 * (row % 2);
      const p = u * cx + shift, q = v * cy, ci = Math.floor(p), cj = Math.floor(q);
      const jx = (hash2(ci, cj, seed) - 0.5) * 0.2, jy = (hash2(ci, cj, seed + 1) - 0.5) * 0.2;
      const fx = (wrap(p) - 0.5 - jx) * 1.0, fy = (wrap(q) - 0.5 - jy) * 1.3, d = Math.hypot(fx, fy);
      const dome = sstep(0.5, 0.2, d), id = hash2(ci, cj, seed + 3);
      return { h: dome * Math.sqrt(Math.max(0, 1 - (d / 0.5) ** 2)), t: (0.8 + 0.4 * id) * (0.95 + 0.1 * fbm(u, v, 2, 30, seed + 4)), g: 0.15 };
    },
    tiles(u, v, seed) {   // square tiles with grout
      const n = 4, p = u * n, q = v * n, ci = Math.floor(p), cj = Math.floor(q), fx = wrap(p), fy = wrap(q);
      const e = Math.min(fx, 1 - fx, fy, 1 - fy), id = hash2(ci, cj, seed);
      return { h: sstep(0.02, 0.06, e), t: (0.92 + 0.16 * id) * (0.97 + 0.06 * fbm(u, v, 2, 24, seed + 2)), g: 0.5 };
    },
    cloth(u, v, seed) {   // weave with stripes across
      const weave = 0.5 + 0.5 * Math.sin(u * 2 * Math.PI * 64) * Math.sin(v * 2 * Math.PI * 64);
      const stripe = Math.floor(u * 6) % 2 ? 1.0 : 0.82;
      return { h: 0.5 + 0.1 * weave, t: stripe * (0.96 + 0.08 * fbm(u, v, 2, 20, seed)), g: 0 };
    },
    sand(u, v, seed) {   // ripples along v with fine grain
      const ripple = 0.5 + 0.5 * Math.sin((v + 0.12 * fbm(u, v, 2, 4, seed)) * 2 * Math.PI * 9);
      const grain = fbm(u, v, 3, 48, seed + 3);
      return { h: 0.45 + 0.35 * ripple + 0.2 * grain, t: 0.95 + 0.1 * grain, g: 0 };
    },
    grass(u, v, seed) {   // a meadow in two scales, blade speckle
      const m = fbm(u, v, 2, 3, seed) * 0.6 + fbm(u, v, 3, 12, seed + 1) * 0.4;
      const blade = hash2(Math.floor(u * 180), Math.floor(v * 180), seed + 5) > 0.93 ? 1 : 0;
      return { h: 0.4 + 0.4 * m + 0.2 * blade, t: (0.86 + 0.26 * m) * (1 + 0.12 * blade), g: 0 };
    },
    asphalt(u, v, seed) {   // fine grain and a few cracks
      const grain = fbm(u, v, 3, 90, seed);
      const crack = sstep(0.006, 0, Math.abs(fbm(u, v, 3, 3, seed + 2) - 0.5)) * sstep(0.58, 0.7, fbm(u, v, 2, 2, seed + 8));   // thin, and only in a few patches
      return { h: 0.6 + 0.4 * grain - 0.5 * crack, t: (0.94 + 0.12 * grain) * (1 - 0.3 * crack), g: 0.05 };
    },
    metal(u, v, seed) {   // brushed along u with patina
      const brush = fbm(u * 0.15, v, 2, 90, seed), patina = fbm(u, v, 3, 5, seed + 4);
      return { h: 0.5 + 0.3 * brush, t: (0.9 + 0.2 * brush) * (0.9 + 0.2 * patina), g: 0.7 };
    },
    // ── the liquids' bakes (the liquid kit scrolls these; they are never a ground) ──
    ripple(u, v, seed) {   // a water surface: two crossing wave trains and a little noise, for a scrolling normal map
      const w1 = Math.sin((u * 1.0 + v * 0.35) * 2 * Math.PI * 6), w2 = Math.sin((u * -0.4 + v * 1.0) * 2 * Math.PI * 5 + 1.3);
      return { h: 0.5 + 0.22 * w1 + 0.18 * w2 + 0.1 * (fbm(u, v, 2, 12, seed) - 0.5), t: 1, g: 1 };
    },
    caustic(u, v, seed) {   // bright cell lines (the light through a water surface): the lines are the tint, the height is flat
      const n = 6, p = u * n, q = v * n, ci = Math.floor(p), cj = Math.floor(q);
      let d1 = 9, d2 = 9;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const cx = ci + i + hash2(ci + i, cj + j, seed), cy = cj + j + hash2(ci + i, cj + j, seed + 1); const d = Math.hypot(p - cx, q - cy); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
      const line = 1 - sstep(0, 0.12, d2 - d1);
      return { h: 0.5, t: 0.35 + 1.2 * line, g: 0 };
    },
    lava(u, v, seed) {   // molten flow with irregular crust islands (2026-11-04 01:03, the owner: the even honeycomb "looks a bit fake")
      // the islands: a warped noise field cut at a threshold, so no two are alike and their edges are ragged; the melt between
      // them carries its own heat variation; the crust has fine cracks that glow faintly
      const warp = fbm(u, v, 2, 3, seed + 21) - 0.5;
      const field = fbm(u + 0.3 * warp, v - 0.25 * warp, 4, 3, seed);
      const crust = sstep(0.47, 0.56, field);
      const heat = fbm(u * 1.3 + 0.1 * warp, v * 0.8, 3, 6, seed + 7);
      const n = 7, p = u * n, q = v * n, ci = Math.floor(p), cj = Math.floor(q);
      let d1 = 9, d2 = 9;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const cx = ci + i + hash2(ci + i, cj + j, seed + 2), cy = cj + j + hash2(ci + i, cj + j, seed + 3); const d = Math.hypot(p - cx, q - cy); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
      const crack = (1 - sstep(0.0, 0.035, d2 - d1)) * crust;
      const plate = fbm(u, v, 3, 14, seed + 5);
      return { h: crust * (0.78 + 0.22 * plate) + (1 - crust) * (0.3 + 0.12 * heat) - 0.3 * crack, t: crust * (0.16 + 0.14 * plate) * (1 - 0.4 * crack) + (1 - crust) * (1.1 + 0.7 * heat), g: 0.35 * (1 - crust), e: (1 - crust) * (0.55 + 0.45 * heat) + crack * 0.45 };
    },
  };
  const DEFAULT_SCALE = { court: 3, planks: 3, stone: 3, cobbles: 2, tiles: 2, cloth: 1.5, sand: 3, grass: 4, asphalt: 3, metal: 1.5, ripple: 2, caustic: 3, lava: 3 };
  // the normal's strength per recipe (2026-11-05): a varnished court or a polished floor is nearly flat, cobbles and stone are not
  const DEFAULT_STRENGTH = { court: 0.35, planks: 0.8, stone: 1, cobbles: 1.2, tiles: 0.6, cloth: 0.5, sand: 0.7, grass: 0.8, asphalt: 0.5, metal: 0.3, ripple: 1, caustic: 0.4, lava: 1 };
  const BAKED = new Map();
  /** bake a recipe to textures (cached by recipe, size and seed) */
  function bake(spec) {
    const o = typeof spec === 'string' ? { recipe: spec } : (spec || {});
    const name = RECIPES[o.recipe] ? o.recipe : (console.error(`surface kit: unknown recipe "${o.recipe}" (recipes: ${Object.keys(RECIPES).join(', ')}); stone is used`), 'stone');
    const size = o.size || 256, seed = o.seed || 1, strength = o.strength || DEFAULT_STRENGTH[name] || 1, scale = o.scale || DEFAULT_SCALE[name] || 3;
    const key = `${name}:${size}:${seed}:${strength}`;
    if (BAKED.has(key)) return Object.assign({}, BAKED.get(key), { scale });
    const t0 = performance.now();
    const R = RECIPES[name], H = new Float32Array(size * size), T = new Float32Array(size * size), E = new Float32Array(size * size);
    let gl = 0, hasE = false;
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) { const r = R(i / size, j / size, seed); H[j * size + i] = clamp(r.h, 0, 1); T[j * size + i] = r.t; gl += r.g || 0; if (r.e) { hasE = true; E[j * size + i] = clamp(r.e, 0, 1); } }
    const alb = document.createElement('canvas'); alb.width = alb.height = size; const ao = alb.getContext('2d'), ai = ao.createImageData(size, size);
    const nor = document.createElement('canvas'); nor.width = nor.height = size; const no = nor.getContext('2d'), ni = no.createImageData(size, size);
    const emi = hasE ? document.createElement('canvas') : null; let eo = null, ei = null; if (emi) { emi.width = emi.height = size; eo = emi.getContext('2d'); ei = eo.createImageData(size, size); }
    const k = 18 * strength;
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const p = j * size + i, h = H[p];
      // albedo: the tint around 1.0, deepened in the lows (ambient occlusion from the height itself)
      const v = clamp(T[p] * (0.82 + 0.18 * h), 0, 1.6) * 0.62;   // 0.62: a mid value, so the zone's colour reads at the tone and the map lightens or darkens it
      const c = Math.round(clamp(v, 0, 1) * 255);
      ai.data[p * 4] = c; ai.data[p * 4 + 1] = c; ai.data[p * 4 + 2] = c; ai.data[p * 4 + 3] = 255;
      if (ei) { const e = Math.round(E[p] * 255); ei.data[p * 4] = e; ei.data[p * 4 + 1] = e; ei.data[p * 4 + 2] = e; ei.data[p * 4 + 3] = 255; }
      // normal from finite differences (wrapping), y up in tangent space
      const hx = H[j * size + ((i + 1) % size)] - H[j * size + ((i - 1 + size) % size)], hy = H[((j + 1) % size) * size + i] - H[((j - 1 + size) % size) * size + i];
      let nx = -hx * k, ny = -hy * k, nz = 1; const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
      ni.data[p * 4] = Math.round((nx * 0.5 + 0.5) * 255); ni.data[p * 4 + 1] = Math.round((ny * 0.5 + 0.5) * 255); ni.data[p * 4 + 2] = Math.round((nz * 0.5 + 0.5) * 255); ni.data[p * 4 + 3] = 255;
    }
    ao.putImageData(ai, 0, 0); no.putImageData(ni, 0, 0); if (eo) eo.putImageData(ei, 0, 0);
    const map = new THREE.CanvasTexture(alb); map.wrapS = map.wrapT = THREE.RepeatWrapping; map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4;
    const normalMap = new THREE.CanvasTexture(nor); normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping; normalMap.anisotropy = 4;
    let emissiveMap = null; if (emi) { emissiveMap = new THREE.CanvasTexture(emi); emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping; emissiveMap.colorSpace = THREE.SRGBColorSpace; }
    const out = { map, normalMap, emissiveMap, gloss: gl / (size * size), ms: +(performance.now() - t0).toFixed(1), recipe: name };
    BAKED.set(key, out);
    return Object.assign({}, out, { scale });
  }
  return { bake, recipes: Object.keys(RECIPES), DEFAULT_SCALE };
})();
window.SURFACES = SURFACES;
