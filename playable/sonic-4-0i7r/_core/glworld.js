/* The world layer on the GPU (rule 36, owner 2026-10-16 19:09 IST): the backdrop plate, the ground, the road and its lane
   dashes drawn with WebGL under the 2D canvas (objects, runner, light, HUD stay in 2D on top). Canvas 2D cannot map a texture in
   perspective or keep mipmaps, so the road was cut into strips that stepped and shimmered as the camera moved; here the road is
   one real surface: perspective-correct, mipmapped, anisotropic, its zones blended per pixel. The projection is the core's own
   proj() written as a matrix, so 2D objects sit on this ground exactly. Hand-written (~15 KB), no engine: the ad weight stays.
   If WebGL is missing, the core keeps its 2D path. */
window.GLWORLD = (function () {
  let gl = null, cv = null, P = {}, T = {}, buf = null, aniso = null, failed = false;
  const VS = `attribute vec3 p; attribute vec2 uv; attribute vec2 zf;
    uniform vec4 pr; uniform vec2 sh; varying vec2 vUv; varying vec2 vZf;
    void main() { vUv = uv; vZf = zf; float Z = p.z;
      gl_Position = vec4(pr.x * p.x + sh.x * Z, pr.y * p.y + pr.z * Z + sh.y * Z, pr.w * Z - 2.0 * 0.3 * 400.0 / 399.7, Z); }`;
  // surface: three zone textures blended by the zone weight, faded at the far edge; the road darkens toward its verges
  const FS = `#ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
    #else
    precision mediump float;
    #endif
    uniform sampler2D t0, t1, t2; uniform vec3 bias; uniform float verge; varying vec2 vUv; varying vec2 vZf;
    void main() { vec4 a = texture2D(t0, vUv, bias.x), b = texture2D(t1, vUv, bias.y), c = texture2D(t2, vUv, bias.z);
      vec4 col = vZf.x < 1.0 ? mix(a, b, vZf.x) : mix(b, c, vZf.x - 1.0);
      if (verge > 0.0) { float u = vUv.x; float e = smoothstep(0.0, 0.035, u) * smoothstep(1.0, 0.965, u); col.rgb *= mix(0.72, 1.0, e); }
      gl_FragColor = vec4(col.rgb, vZf.y); }`;
  const FS_DASH = `precision mediump float; varying vec2 vZf; void main() { gl_FragColor = vec4(1.0, 1.0, 1.0, vZf.y); }`;
  const VS_PLATE = `attribute vec2 q; uniform vec4 box; varying vec2 vUv; void main() { vUv = q; vec2 s = box.xy + q * box.zw; gl_Position = vec4(s.x * 2.0 - 1.0, 1.0 - s.y * 2.0, 0.0, 1.0); }`;
  const FS_PLATE = `precision mediump float; uniform sampler2D t; uniform float al; varying vec2 vUv; void main() { vec4 c = texture2D(t, vUv); gl_FragColor = vec4(c.rgb, c.a * al); }`;

  function prog(vs, fs) {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const loc = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const u = gl.getActiveUniform(p, i); loc[u.name] = gl.getUniformLocation(p, u.name); }
    const na = gl.getProgramParameter(p, gl.ACTIVE_ATTRIBUTES); for (let i = 0; i < na; i++) { const a = gl.getActiveAttrib(p, i); loc['@' + a.name] = gl.getAttribLocation(p, a.name); }
    return { p, loc };
  }
  function init(under) {
    if (gl || failed) return !!gl;
    try {
      cv = document.createElement('canvas'); cv.id = 'world'; under.parentNode.insertBefore(cv, under);
      gl = cv.getContext('webgl', { alpha: false, antialias: true, depth: true, premultipliedAlpha: false, powerPreference: 'high-performance' });
      if (!gl) throw new Error('no webgl');
      aniso = gl.getExtension('EXT_texture_filter_anisotropic') || gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
      P.surf = prog(VS, FS); P.dash = prog(VS, FS_DASH); P.plate = prog(VS_PLATE, FS_PLATE);
      buf = gl.createBuffer(); P.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, P.quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), gl.STATIC_DRAW);
      cv.addEventListener('webglcontextlost', e => { e.preventDefault(); failed = true; gl = null; cv.remove(); });   // the 2D path takes over
      return true;
    } catch (e) { failed = true; gl = null; if (cv) cv.remove(); return false; }
  }
  const pot = n => { let p = 1; while (p * 2 <= n && p < 1024) p *= 2; if (p * 1.5 < n && p < 1024) p *= 2; return p; };
  function tex(key, src, repeat) {   // a canvas or image → a texture, once; repeating ones resampled to powers of two (WebGL 1 mipmaps need them)
    if (T[key]) return T[key]; if (!src) return null;
    let s = src; if (repeat) { const c = document.createElement('canvas'); c.width = pot(src.width); c.height = pot(src.height); const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height); s = c; }
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, s);
    if (repeat) { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT); gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT))); }
    else { gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); }
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return (T[key] = t);
  }
  function bindAttribs(pr, stride) {
    const L = pr.loc, F = 4; gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    if (L['@p'] >= 0) { gl.enableVertexAttribArray(L['@p']); gl.vertexAttribPointer(L['@p'], 3, gl.FLOAT, false, stride * F, 0); }
    if (L['@uv'] >= 0) { gl.enableVertexAttribArray(L['@uv']); gl.vertexAttribPointer(L['@uv'], 2, gl.FLOAT, false, stride * F, 3 * F); }
    if (L['@zf'] >= 0) { gl.enableVertexAttribArray(L['@zf']); gl.vertexAttribPointer(L['@zf'], 2, gl.FLOAT, false, stride * F, 5 * F); }
  }
  /* o: { W, H, dpr, cam, k, hz, roadX, roadY, roadHalf, laneW, drawDist, zones:[start of zone 2, start of zone 3], shake:[px,py],
          plates:[{src, box:{x,y,w,h} frame fractions, alpha}], ground:[3 sources], groundW, road:[3 sources], roadLen, bias:{ground:[3], road:[3]} } */
  function draw(o) {
    if (!gl) return false;
    const bw = Math.round(o.W * o.dpr), bh = Math.round(o.H * o.dpr); if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    gl.viewport(0, 0, bw, bh); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    // the backdrop plate(s), screen-aligned, no depth
    gl.disable(gl.DEPTH_TEST); gl.useProgram(P.plate.p); gl.bindBuffer(gl.ARRAY_BUFFER, P.quad); gl.enableVertexAttribArray(P.plate.loc['@q']); gl.vertexAttribPointer(P.plate.loc['@q'], 2, gl.FLOAT, false, 0, 0);
    o.plates.forEach((pl, i) => { if (pl.alpha <= 0) return; const t = tex('plate:' + pl.key, pl.src, false); if (!t) return; gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.uniform1i(P.plate.loc.t, 0); gl.uniform1f(P.plate.loc.al, pl.alpha); gl.uniform4f(P.plate.loc.box, pl.box.x, pl.box.y, pl.box.w, pl.box.h); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); });
    // the surfaces
    const c = o.cam, near = 0.3, far = 400, A = (far + near) / (far - near);
    const pr = [2 * o.k, 2 * o.W * o.k / o.H, 1 - 2 * o.hz, A], shx = o.shake[0] * 2 / o.W, shy = -o.shake[1] * 2 / o.H;
    const zw = z => { let f = 0; o.zones.forEach(s => { const t = Math.min(1, Math.max(0, (z - s + 5) / 10)); f += t * t * (3 - 2 * t); }); return f; };   // 10 m blend around each zone line
    const fade = z => Math.min(1, Math.max(0, (o.drawDist - (z - c.z)) / 30));   // the far edge fades in, never a line
    const rows = []; { let z = Math.floor(c.z) - 1; const end = c.z + o.drawDist + 4; while (z <= end) { rows.push(z); const d = z - c.z, st = d < 30 ? 1 : d < 80 ? 2 : 4; z = Math.floor((z + st) / st) * st; } }   // world-aligned rows: they never swim
    const vb = 1 / o.groundW, gLen = o.groundW * o.groundAspect, rLen = o.roadLen, gz0 = Math.floor(c.z / gLen) * gLen, rz0 = Math.floor(c.z / rLen) * rLen;   // v counted from near the camera: small numbers, exact on phone GPUs
    const strip = (half, uOf, v0, len, lift) => { const a = []; rows.forEach(z => { const rx = o.roadX(z), ry = o.roadY(z) + lift, zf = zw(z), fd = fade(z), v = (z - v0) / len;
        a.push(rx - half - c.x, ry - c.y, z - c.z, uOf(-half), v, zf, fd, rx + half - c.x, ry - c.y, z - c.z, uOf(half), v, zf, fd); }); return new Float32Array(a); };
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.useProgram(P.surf.p);
    gl.uniform4f(P.surf.loc.pr, pr[0], pr[1], pr[2], pr[3]); gl.uniform2f(P.surf.loc.sh, shx, shy);
    const bindSet = (key, srcs) => { srcs.forEach((s, i) => { gl.activeTexture(gl.TEXTURE0 + i); gl.bindTexture(gl.TEXTURE_2D, tex(key + i, s, true)); }); gl.uniform1i(P.surf.loc.t0, 0); gl.uniform1i(P.surf.loc.t1, 1); gl.uniform1i(P.surf.loc.t2, 2); };
    // ground: one wide strip, its texture anchored to the road's centre line (it follows the curve)
    let d = strip(90, x => x * vb, gz0, gLen, 0); gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STREAM_DRAW); bindAttribs(P.surf, 7);
    bindSet('g', o.ground); gl.uniform3f(P.surf.loc.bias, ...o.bias.ground); gl.uniform1f(P.surf.loc.verge, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, d.length / 7);
    // road, lifted a hair above the ground
    gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(-1, -2);
    d = strip(o.roadHalf, x => (x + o.roadHalf) / (2 * o.roadHalf), rz0, rLen, 0); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STREAM_DRAW); bindAttribs(P.surf, 7);
    bindSet('r', o.road); gl.uniform3f(P.surf.loc.bias, ...o.bias.road); gl.uniform1f(P.surf.loc.verge, 1); gl.drawArrays(gl.TRIANGLE_STRIP, 0, d.length / 7);
    // lane dashes: 3 m on, 3 m off, at their world positions; thinner than a device pixel they fade instead of flickering
    gl.polygonOffset(-2, -4); const dv = [], dw = 0.05;
    for (let k = Math.floor(c.z / 6) * 6; k < c.z + o.drawDist; k += 6) for (const lx of [-0.5, 0.5]) {
      const q = []; for (const z of [k, k + 3]) { const dz = Math.max(.3, z - c.z), px = 2 * dw * o.k * o.W / dz * o.dpr, al = .55 * Math.min(1, px) * fade(z), x = o.roadX(z) + lx * o.laneW - c.x, y = o.roadY(z) - c.y;
        q.push([x - dw, y, z - c.z, 0, 0, 0, al], [x + dw, y, z - c.z, 0, 0, 0, al]); }
      dv.push(...q[0], ...q[1], ...q[2], ...q[1], ...q[3], ...q[2]); }
    if (dv.length) { d = new Float32Array(dv); gl.useProgram(P.dash.p); gl.uniform4f(P.dash.loc.pr, pr[0], pr[1], pr[2], pr[3]); gl.uniform2f(P.dash.loc.sh, shx, shy); gl.bufferData(gl.ARRAY_BUFFER, d, gl.STREAM_DRAW); bindAttribs(P.dash, 7); gl.drawArrays(gl.TRIANGLES, 0, d.length / 7); }
    gl.disable(gl.POLYGON_OFFSET_FILL);
    return true;
  }
  /* ── world sprites on the GPU (owner 20:21: props "shaking as if there is a mirage, even on load"; "what industry WebGL games do").
     Canvas 2D drew each prop from one of a few pre-shrunk copies and jumped between them as it came closer: a flicker of sharpness.
     Here every prop, hazard, ring, gate and their shadows is a textured quad from a mipmapped texture, filtered trilinearly and
     anisotropically, premultiplied (no dark fringes), batched in draw order (one draw call per texture run). The caller hands the
     quad's four corners in device pixels (its 2D transform already applied), so rotation, squash and fades carry over unchanged. */
  const VS_SPR = `attribute vec2 p; attribute vec2 uv; attribute vec4 c; uniform vec2 res; varying vec2 vUv; varying vec4 vC;
    void main() { vUv = uv; vC = c; gl_Position = vec4(p.x / res.x * 2.0 - 1.0, 1.0 - p.y / res.y * 2.0, 0.0, 1.0); }`;
  const FS_SPR = `precision mediump float; uniform sampler2D t; varying vec2 vUv; varying vec4 vC; void main() { gl_FragColor = texture2D(t, vUv) * vC; }`;
  const ST = new Map(); let sb = new Float32Array(8 * 6 * 512), nv = 0, sTex = null, sBuf = null, WHITE = null;
  const F = 8;   // floats per vertex: x, y, u, v, r, g, b, a (colour premultiplied)
  function spriteTex(src) {   // one mipmapped texture per picture, made once (powers of two up to 2048: WebGL 1 mipmaps need them)
    let t = ST.get(src); if (t) return t;
    const p2 = n => { let p = 1; while (p < n && p < 2048) p *= 2; return p; }, c = document.createElement('canvas'); c.width = p2(src.width); c.height = p2(src.height);
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height);
    t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    ST.set(src, t); return t;
  }
  const SEG = [];   // runs of vertices sharing a texture, in draw order: the whole frame is uploaded ONCE, then one bind + one draw per run
  function useTex(t) { if (t === sTex) return; if (sTex) SEG.push({ t: sTex, start: SEG.length ? SEG[SEG.length - 1].end : 0, end: nv }); sTex = t; }
  function room(n) { if ((nv + n) * F > sb.length) { const nb = new Float32Array(Math.max(sb.length * 2, (nv + n) * F)); nb.set(sb); sb = nb; } }
  function vtx(x, y, u, v, c) { const o = nv * F; sb[o] = x; sb[o + 1] = y; sb[o + 2] = u; sb[o + 3] = v; sb[o + 4] = c[0]; sb[o + 5] = c[1]; sb[o + 6] = c[2]; sb[o + 7] = c[3]; nv++; }
  function flush() {
    if (sTex) SEG.push({ t: sTex, start: SEG.length ? SEG[SEG.length - 1].end : 0, end: nv });
    if (!nv || !gl) { nv = 0; SEG.length = 0; sTex = null; return; }
    if (!P.spr) P.spr = prog(VS_SPR, FS_SPR); if (!sBuf) sBuf = gl.createBuffer();
    for (let i = 0; i < 8; i++) gl.disableVertexAttribArray(i);
    const L = P.spr.loc; gl.useProgram(P.spr.p); gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform2f(L.res, cv.width, cv.height); gl.activeTexture(gl.TEXTURE0); gl.uniform1i(L.t, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, sBuf); gl.bufferData(gl.ARRAY_BUFFER, sb.subarray(0, nv * F), gl.STREAM_DRAW);
    gl.enableVertexAttribArray(L['@p']); gl.vertexAttribPointer(L['@p'], 2, gl.FLOAT, false, F * 4, 0);
    gl.enableVertexAttribArray(L['@uv']); gl.vertexAttribPointer(L['@uv'], 2, gl.FLOAT, false, F * 4, 8);
    gl.enableVertexAttribArray(L['@c']); gl.vertexAttribPointer(L['@c'], 4, gl.FLOAT, false, F * 4, 16);
    for (const g of SEG) if (g.end > g.start) { gl.bindTexture(gl.TEXTURE_2D, g.t); gl.drawArrays(gl.TRIANGLES, g.start, g.end - g.start); }
    nv = 0; SEG.length = 0; sTex = null;
  }
  // a picture: q = its four corners [x0,y0, x1,y1, x2,y2, x3,y3] (top-left, top-right, bottom-left, bottom-right) in device pixels;
  // tint multiplies its colour (glitter dots are one white dot tinted)
  function sprite(src, sx, sy, sw, sh, q, alpha, tint) {
    if (!gl || alpha <= 0) return; useTex(spriteTex(src)); room(6);
    const u0 = sx / src.width, v0 = sy / src.height, u1 = (sx + sw) / src.width, v1 = (sy + sh) / src.height, c = tint ? [tint[0] * alpha, tint[1] * alpha, tint[2] * alpha, alpha] : [alpha, alpha, alpha, alpha];
    vtx(q[0], q[1], u0, v0, c); vtx(q[2], q[3], u1, v0, c); vtx(q[4], q[5], u0, v1, c); vtx(q[2], q[3], u1, v0, c); vtx(q[6], q[7], u1, v1, c); vtx(q[4], q[5], u0, v1, c);
  }
  // flat-coloured triangles (the trail's ribbon and brush strokes): xy = [x0,y0, x1,y1, x2,y2, ...] in device pixels, rgba 0..1 (straight alpha)
  function tris(xy, rgba) {
    if (!gl || rgba[3] <= 0 || xy.length < 6) return;
    if (!WHITE) { const c = document.createElement('canvas'); c.width = c.height = 4; const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 4, 4); WHITE = c; }
    useTex(spriteTex(WHITE)); room(xy.length / 2); const a = rgba[3], c = [rgba[0] * a, rgba[1] * a, rgba[2] * a, a];
    for (let i = 0; i < xy.length; i += 2) vtx(xy[i], xy[i + 1], .5, .5, c);
  }
  return { init, draw, sprite, tris, flush, preloadSprite: src => { if (gl && src) spriteTex(src); }, preload: (key, src, repeat) => { if (gl && src) tex(key, src, repeat); }, get ok() { return !!gl; } };
})();
