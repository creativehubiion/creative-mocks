/* Walk Ready: drawing and input. The rules live in rules.js. One 640x960 WebGL world under one 640x960 2D HUD. */
(function () {
  const { CONFIG, PIECES, SLOTS } = window.RULES, R = window.RULES;
  const Q = new URLSearchParams(location.search);
  const W = 640, H = 960, BS = 0.2886, CX = 200, FEET = 925;
  const RACK = { benedetta: [390, 302], tee: [483, 302], monty: [577, 302], rome: [390, 490], denim: [483, 490], mabel: [577, 490] };
  const THUMB = 0.51;
  const CTA_URL = 'https://www.blackpepper.com.au/pages/register';
  const SKY = { breeze: { wind: 1, light: [0.975, 0.985, 1.02], sun: 0.12 }, sun: { wind: 0.12, light: [1.045, 1.02, 0.965], sun: 1 }, mix: { wind: 0.75, light: [1.02, 1.015, 1.0], sun: 0.62 } };
  const lerp = (a, b, k) => a + (b - a) * k, clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const ease = k => k * k * (3 - 2 * k);

  const stage = document.getElementById('stage'), glc = document.getElementById('gl'), hud = document.getElementById('hud'); let ctx = hud.getContext('2d'); const HUD_CTX = ctx;
  document.getElementById('loadMark').innerHTML = window.LOGO_SVG;
  document.getElementById('endMark').innerHTML = window.LOGO_SVG;
  const gl = glc.getContext('webgl2', { alpha: false, antialias: true, powerPreference: 'high-performance', premultipliedAlpha: true }) || glc.getContext('webgl', { alpha: false, antialias: true });
  const IS2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;

  /* ---------- GL ---------- */
  const VS = `attribute vec2 aUV; uniform vec4 uRect; uniform vec4 uRot; uniform float uMode; uniform vec4 uBody; uniform vec4 uBody2; uniform vec2 uSettle; uniform float uTime; varying vec2 vUV;
  void main(){ vUV=aUV; vec2 p=uRect.xy+aUV*uRect.zw;
    if(uMode>0.5){ float top=uBody.y,h=uBody.z,cx=uBody.x; float by=(p.y-top)/h, bx=(p.x-cx)/h;
      float chest=smoothstep(.62,.30,by)*smoothstep(.02,.22,by); p.y-=uBody2.x*chest; p.x+=bx*uBody2.x*.3*chest;
      float sh=smoothstep(.40,.17,by); p.y-=uBody2.y*9.*sh; p.x-=bx*uBody2.y*34.*sh;
      float fy=top+h; p.y=fy-(fy-p.y)*(1.+uBody2.z); p.x=cx+(p.x-cx)*(1.-uBody2.z*.6);
      p.x+=uBody.w*pow(max(0.,1.-by),1.5);
      float k=aUV.y*aUV.y; p.x+=uBody2.w*(sin(uTime*3.1+aUV.y*7.+aUV.x*4.)+.5*sin(uTime*5.3+aUV.y*13.))*k*2.6;
      p.y+=uSettle.x*aUV.y*22.; p.x+=uSettle.y*k*16.; }
    if(uRot.z!=0.){ float c=cos(uRot.z),s=sin(uRot.z); vec2 d=p-uRot.xy; p=uRot.xy+vec2(d.x*c-d.y*s,d.x*s+d.y*c);
      float k=aUV.y*aUV.y; }
    gl_Position=vec4(p.x/320.-1.,1.-p.y/480.,0.,1.); }`;
  const FS = `precision mediump float; varying vec2 vUV; uniform sampler2D t; uniform float uAlpha; uniform vec3 uGrade; uniform float uBias; uniform float uShadow; uniform vec2 uFlip; uniform vec2 uClip;
  void main(){ if(gl_FragCoord.x<uClip.x||gl_FragCoord.x>uClip.y) discard; vec2 uv=vUV; if(uFlip.x>0.5) uv.x=1.-uv.x; vec4 c=texture2D(t,uv,uBias); if(uShadow>0.5){ gl_FragColor=vec4(0.,0.,0.,c.a)*uAlpha; return; } gl_FragColor=vec4(c.rgb*uGrade,c.a)*uAlpha; }`;
  const FS_STREET = `precision mediump float; varying vec2 vUV; uniform sampler2D a,b,c; uniform vec3 uMix; uniform float uWind; uniform float uTs;
  void main(){ vec2 uv=vUV; float s=smoothstep(.72,.12,uv.y);
    float o=uWind*s*(sin(uTs*1.7+uv.y*9.+uv.x*5.)*.0065+sin(uTs*4.3+uv.y*31.+uv.x*17.)*.0026);
    uv.x+=o; uv.y+=o*.35;
    vec3 col=texture2D(a,uv).rgb*uMix.x+texture2D(b,uv).rgb*uMix.y+texture2D(c,uv).rgb*uMix.z; gl_FragColor=vec4(col,1.); }`;
  const FS_GLASS = `precision mediump float; varying vec2 vUV; uniform sampler2D t; uniform float uAlpha;
  void main(){ float a=texture2D(t,vUV).a; float g=1.-a; float d=vUV.x*1.2+vUV.y*.55; float streak=pow(max(0.,sin(d*7.+.6)),6.); float top=smoothstep(.35,.0,vUV.y);
    float v=(.045+.085*streak+.05*top)*uAlpha*g; gl_FragColor=vec4(vec3(v),v*.55); }`;
  function compile(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; }
  function program(vs, fs) { const p = gl.createProgram(); gl.attachShader(p, compile(gl.VERTEX_SHADER, vs)); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, 'aUV'); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name] = gl.getUniformLocation(p, a.name); } return { p, u }; }
  const P = program(VS, FS), PS = program(VS, FS_STREET), PG = program(VS, FS_GLASS);
  const GX = 12, GY = 28;
  {
    const v = [], idx = [];
    for (let y = 0; y <= GY; y++) for (let x = 0; x <= GX; x++) v.push(x / GX, y / GY);
    for (let y = 0; y < GY; y++) for (let x = 0; x < GX; x++) { const a = y * (GX + 1) + x; idx.push(a, a + 1, a + GX + 1, a + 1, a + GX + 2, a + GX + 1); }
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.STATIC_DRAW);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  }
  const NIDX = GX * GY * 6;
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.clearColor(1, 1, 1, 1);
  function texture(img) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    if (IS2) { gl.generateMipmap(gl.TEXTURE_2D); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); } else gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    return t;
  }

  /* ---------- assets ---------- */
  const LAYER_NAMES = ['body', 'wbody', 'gown', 'face_cold', 'face_hot', 'star', ...Object.keys(PIECES), ...Object.keys(PIECES).map(k => 'w' + k)];
  const TEX = {}, IMG = {};
  let META = null, world = null;
  const loadBar = document.getElementById('loadBar');
  async function loadAll() {
    META = await (await fetch('assets/meta.json')).json();
    const names = [...LAYER_NAMES, 'store', 'door', 'street_breeze', 'street_sun', 'street_mix'];
    let done = 0;
    await Promise.all(names.map(n => new Promise((res, rej) => { const i = new Image(); i.onload = () => { IMG[n] = i; loadBar.style.width = (++done / names.length * 100) + '%'; res(); }; i.onerror = () => rej(new Error('asset ' + n)); i.src = `assets/${n}.webp`; })));
    if (document.fonts) { try { await Promise.all([document.fonts.load('700 28px Montserrat'), document.fonts.load('500 24px Montserrat')]); } catch (e) { /* the fallback face still reads */ } }
    for (const n of names) TEX[n] = texture(IMG[n]);
    TEX.hanger = texture(makeHanger());
    TEX.soft = texture(makeSoft());
    TEX.sunpool = texture(makeSunPool());
    TEX.vignette = texture(makeVignette());
    TEX.leaf = texture(makeLeaf());
    TEX.spark = texture(makeSpark());
    TEX.glow = texture(makeGlow());
    for (const n of ['body', 'wbody', ...Object.keys(PIECES)]) TEX['sh_' + n] = texture(makeShadow(IMG[n]));
    for (const n of Object.keys(PIECES)) TEX['ol_' + n] = texture(makeOutline(n));
  }
  const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function makeHanger() {
    const c = canvas(128, 64), g = c.getContext('2d'); g.lineCap = 'round'; g.lineJoin = 'round';
    const path = () => { g.beginPath(); g.moveTo(64, 34); g.lineTo(64, 16); g.arc(58, 11, 6.5, 0.2, -2.6, true); g.moveTo(64, 28); g.lineTo(10, 54); g.lineTo(118, 54); g.closePath(); };
    g.strokeStyle = '#6d6f72'; g.lineWidth = 4; path(); g.stroke(); g.strokeStyle = 'rgba(255,255,255,.65)'; g.lineWidth = 1.2; path(); g.stroke();
    return c;
  }
  function makeSoft() { const c = canvas(128, 128), g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 2, 64, 64, 64); r.addColorStop(0, 'rgba(0,0,0,1)'); r.addColorStop(0.55, 'rgba(0,0,0,.55)'); r.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return c; }
  function makeSunPool() {
    const c = canvas(80, 60), g = c.getContext('2d'); g.fillStyle = 'rgba(255,226,170,1)';
    const quad = (a, b, d, e) => { g.beginPath(); g.moveTo(a, 0); g.lineTo(b, 0); g.lineTo(e, 60); g.lineTo(d, 60); g.closePath(); g.fill(); };
    quad(4, 19, 8, 40); quad(23, 41, 48, 75); quad(43, 61, 78, 105); quad(63, 79, 108, 136);
    g.globalCompositeOperation = 'destination-in';
    const v = g.createLinearGradient(0, 0, 0, 60); v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(0.7, 'rgba(0,0,0,.5)'); v.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = v; g.fillRect(0, 0, 80, 60);
    const h = g.createLinearGradient(0, 0, 80, 0); h.addColorStop(0, 'rgba(0,0,0,0)'); h.addColorStop(0.1, 'rgba(0,0,0,1)'); h.addColorStop(0.9, 'rgba(0,0,0,1)'); h.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = h; g.fillRect(0, 0, 80, 60);
    return c;
  }
  const OL_PAD = 9, OL_DENSITY = 2;
  function makeOutline(id) {
    const l = META.layers[id], w = l.w * BS * THUMB * 1.1, h = l.h * BS * THUMB * 1.1, cw = Math.ceil((w + OL_PAD * 2) * OL_DENSITY), ch = Math.ceil((h + OL_PAD * 2) * OL_DENSITY), c = canvas(cw, ch), g = c.getContext('2d');
    const stamp = (col, r) => { const t = canvas(cw, ch), q = t.getContext('2d'); q.drawImage(IMG[id], OL_PAD * OL_DENSITY, OL_PAD * OL_DENSITY, w * OL_DENSITY, h * OL_DENSITY); q.globalCompositeOperation = 'source-in'; q.fillStyle = col; q.fillRect(0, 0, cw, ch); for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; g.drawImage(t, Math.cos(a) * r * OL_DENSITY, Math.sin(a) * r * OL_DENSITY); } };
    stamp('#8a6400', 4.9); stamp('#ffd400', 3.7);
    return c;
  }
  const SH_PAD = 0.16;
  function makeShadow(img) {
    const ch = 96, cw = Math.max(16, Math.round(ch * img.width / img.height)), c = canvas(cw, ch), g = c.getContext('2d');
    g.drawImage(img, cw * SH_PAD / (1 + 2 * SH_PAD), ch * SH_PAD / (1 + 2 * SH_PAD), cw / (1 + 2 * SH_PAD), ch / (1 + 2 * SH_PAD));
    g.globalCompositeOperation = 'source-in'; g.fillStyle = '#000'; g.fillRect(0, 0, cw, ch);
    return c;
  }
  function makeVignette() { const c = canvas(160, 240), g = c.getContext('2d'), r = g.createRadialGradient(80, 110, 70, 80, 120, 170); r.addColorStop(0, 'rgba(30,20,10,0)'); r.addColorStop(1, 'rgba(30,20,10,.26)'); g.fillStyle = r; g.fillRect(0, 0, 160, 240); return c; }
  function makeLeaf() { const c = canvas(32, 16), g = c.getContext('2d'); g.fillStyle = '#4f6a3d'; g.beginPath(); g.moveTo(1, 8); g.quadraticCurveTo(16, -3, 31, 8); g.quadraticCurveTo(16, 19, 1, 8); g.fill(); return c; }
  function makeGlow() { const c = canvas(128, 128), g = c.getContext('2d'), r = g.createRadialGradient(64, 64, 6, 64, 64, 64); r.addColorStop(0, 'rgba(232,206,150,.95)'); r.addColorStop(0.55, 'rgba(214,178,110,.5)'); r.addColorStop(1, 'rgba(214,178,110,0)'); g.fillStyle = r; g.fillRect(0, 0, 128, 128); return c; }
  function makeSpark() { const c = canvas(64, 64), g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.25, 'rgba(255,248,225,.7)'); r.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); return c; }

  /* ---------- draw helpers ---------- */
  let now = 0, grade = [1, 1, 1];
  const BODY = { top: 0, h: 0, sway: 0, breath: 0, hunch: 0, squash: 0, cloth: 0.25 };
  function use(pr) { gl.useProgram(pr.p); return pr.u; }
  function quad(tex, x, y, w, h, o) {
    o = o || {};
    const u = use(P);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(u.t, 0);
    gl.uniform4f(u.uRect, x, y, w, h);
    gl.uniform4f(u.uRot, o.px || 0, o.py || 0, o.rot || 0, 0);
    gl.uniform1f(u.uMode, o.body ? 1 : 0);
    if (o.body) {
      gl.uniform4f(u.uBody, CX + (o.dx || 0), BODY.top, BODY.h, BODY.sway);
      gl.uniform4f(u.uBody2, BODY.breath, BODY.hunch, BODY.squash, o.cloth === undefined ? 0 : o.cloth);
      gl.uniform2f(u.uSettle, o.stretch || 0, o.wob || 0);
      gl.uniform1f(u.uTime, now);
    }
    gl.uniform1f(u.uAlpha, o.alpha === undefined ? 1 : o.alpha);
    const gr = o.grade || (o.flat ? [1, 1, 1] : grade);
    gl.uniform3f(u.uGrade, gr[0], gr[1], gr[2]);
    gl.uniform1f(u.uBias, o.bias || 0);
    gl.uniform1f(u.uShadow, o.shadow ? 1 : 0);
    gl.uniform2f(u.uFlip, o.flipX ? 1 : 0, 0);
    gl.uniform2f(u.uClip, o.clip ? o.clip[0] : -9000, o.clip ? o.clip[1] : 9000);
    if (o.add) gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawElements(gl.TRIANGLES, NIDX, gl.UNSIGNED_SHORT, 0);
    if (o.add) gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  }
  const layerRect = (name, ox, oy) => { const l = META.layers[name]; return { x: META.X0 + l.x * BS + (ox || 0), y: META.Y0 + l.y * BS + (oy || 0), w: l.w * BS, h: l.h * BS }; };

  /* ---------- state ---------- */
  let G = R.newGame();
  const fx = { skyA: 'breeze', skyB: 'breeze', skyK: 1, light: SKY.breeze.light.slice(), sunA: 0.12, wind: 1, door: 0, fly: [], pop: null, coachShake: 0, flashT: null, triedWrong: null, msg: null, msgI: 0, msgHello: false, pose: 'stand', poseT: 0, react: null, gownFall: 0, settle: {}, sparks: [], leaves: [], confetti: [], rackAnim: {}, lock: 0, pill: null, banner: null, endT: 0, hintT: 0, firstTouch: false, hurry: 0, shake: 0, chipPop: {} };
  let drag = null, audio = null;
  const pieceIds = Object.keys(PIECES);
  for (let i = 0; i < 14; i++) fx.leaves.push({ x: Math.random() * 640, y: 40 + Math.random() * 240, r: Math.random() * 6, s: 0.5 + Math.random() * 0.8, sz: 5 + Math.random() * 7 });

  function setPill(text, secs, tone) { fx.pill = { text, t: 0, life: secs, tone: tone || 'ink' }; }

  /* ---------- sound: one soft palette, silent until the first touch ---------- */
  function initAudio() {
    if (audio) return;
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const c = new AC({ latencyHint: 'interactive' }), master = c.createGain(), comp = c.createDynamicsCompressor(), hp = c.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 180; master.gain.value = 0.55; comp.threshold.value = -14; comp.ratio.value = 6;
    master.connect(hp); hp.connect(comp); comp.connect(c.destination);
    const noise = c.createBuffer(1, c.sampleRate, c.sampleRate), d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    audio = { c, master, noise };
  }
  function tone(f, at, dur, vol) { if (!audio) return; const { c, master } = audio, t = c.currentTime + at, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = f; o2.frequency.value = f * 2.001; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); const g2 = c.createGain(); g2.gain.value = 0.22; o.connect(g); o2.connect(g2); g2.connect(g); g.connect(master); o.start(t); o2.start(t); o.stop(t + dur + 0.02); o2.stop(t + dur + 0.02); }
  function swish(at, dur, vol, from, to) { if (!audio) return; const { c, master, noise } = audio, t = c.currentTime + at, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); s.buffer = noise; s.loop = true; f.type = 'bandpass'; f.Q.value = 0.8; f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur + 0.02); }
  const SFX = {
    pick() { swish(0, 0.16, 0.16, 900, 2200); },
    good() { swish(0, 0.14, 0.14, 2200, 800); tone(660, 0.05, 0.28, 0.2); tone(990, 0.13, 0.4, 0.17); },
    wrong() { tone(247, 0, 0.22, 0.17); tone(208, 0.1, 0.3, 0.14); },
    look() { tone(660, 0, 0.3, 0.16); tone(880, 0.1, 0.32, 0.16); tone(1320, 0.2, 0.5, 0.15); },
    weather() { swish(0.05, 1, 0.1, 500, 1500); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.11, 0.6, 0.18)); swish(0.3, 0.5, 0.06, 1200, 3000); },
    lost() { tone(392, 0, 0.3, 0.15); tone(330, 0.16, 0.5, 0.14); },
  };

  /* ---------- geometry of pieces ---------- */
  function thumbRect(id) { const l = META.layers[id], [hx, hy] = RACK[id], w = l.w * BS * THUMB, h = l.h * BS * THUMB, y = hy + 21; return { x: hx - w / 2, y, w, h, hx, hy }; }
  const onRack = id => !Object.values(G.worn).includes(id) && !(drag && drag.id === id);
  function hit(x, y) {
    let best = null, bd = 1e9;
    for (const id of pieceIds) { if (!onRack(id)) continue; const r = thumbRect(id); const pad = 8; if (x > r.x - pad && x < r.x + r.w + pad && y > r.hy && y < r.y + r.h + pad) { const d = Math.abs(x - r.hx); if (d < bd) { bd = d; best = id; } } }
    return best;
  }
  const overBody = (x, y) => x > CX - 155 && x < CX + 130 && y > 240 && y < FEET + 10;

  /* ---------- input ---------- */
  function toCanvas(e) { const r = hud.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * W, (e.clientY - r.top) / r.height * H]; }
  function pick(id, x, y) {
    if (!G.started) { G.started = true; fx.firstTouch = true; }
    const t = thumbRect(id);
    drag = { id, x, y, tx: x, ty: y, s: THUMB, rot: 0, rotV: 0, labelT: 0, swing: 1.1, swingV: 0, over: 0, overK: 0, lx: x, ly: y };
    fx.hintT = 0; SFX.pick();
  }
  function move(x, y) { if (!drag) return; drag.tx = x; drag.ty = y; }
  function release() {
    if (!drag) return;
    const id = drag.id, d = drag; drag = null;
    if (!overBody(d.tx, d.ty)) { flyBack(id, d.x, d.y, d.s, 0.26); return; }
    const res = R.drop(G, id);
    if (res.ignored) { flyBack(id, d.x, d.y, d.s, 0.26); return; }
    if (res.ok) {
      fx.settle[PIECES[id].slot] = { y: 0.9, yv: 0, x: 0.7, xv: 0, t: 0 };
      if (res.first) fx.gownFall = 0.0001;
      if (res.was) flyBack(res.was, CX, 500, 0.82, 0.42);
      burst(id); fx.squashV = -1.6; fx.pop = { t: 0 }; fx.fly.push({ t: 0, slot: PIECES[id].slot }); fx.triedWrong = null;
      if (res.lookDone) fx.flashT = 0;
      SFX.good();
      if (res.lookDone && G.result !== 'win') SFX.look();
    } else {
      const cold = PIECES[id].mark === 'sun';
      fx.react = { kind: cold ? 'cold' : 'hot', t: 0, id };
      setPill(cold ? 'Better for a sunnier morning' : 'Better for a cooler morning', 1.9, 'ink');
      fx.tryOn = { id, t: 0, x: d.x, y: d.y, s: d.s };
      fx.lock = 0.7; fx.triedWrong = PIECES[id].slot;
      SFX.wrong();
    }
    if (G.result) beginEnd();
  }
  function flyBack(id, x, y, s, dur) { const r = thumbRect(id); fx.rackAnim[id] = { t: 0, dur, x0: x, y0: y, s0: s, x1: r.x + r.w / 2, y1: r.y + r.h / 2 }; }
  function burst(id) { const r = layerRect(id); for (let i = 0; i < 16; i++) fx.sparks.push({ x: r.x + Math.random() * r.w, y: r.y + Math.random() * r.h, t: -Math.random() * 0.22, life: 0.5 + Math.random() * 0.3, sz: 5 + Math.random() * 8 }); }
  hud.addEventListener('pointerdown', e => {
    initAudio(); if (audio && audio.c.state === 'suspended') audio.c.resume();
    const [x, y] = toCanvas(e);
    try { if (window.parent !== window) window.parent.postMessage({ iionTap: { x: x / W, y: y / H } }, '*'); } catch (err) { /* no parent to tell */ }
    if (G.phase !== 'play' || fx.lock > 0) return;
    const id = hit(x, y); if (!id) return;
    if (PIECES[id].slot !== R.current(G)) { fx.coachShake = 1; return; }
    hud.setPointerCapture && hud.setPointerCapture(e.pointerId);
    pick(id, x, y); e.preventDefault();
  });
  hud.addEventListener('pointermove', e => { if (!drag) return; const [x, y] = toCanvas(e); move(x, y); e.preventDefault(); });
  const up = () => release();
  hud.addEventListener('pointerup', up); hud.addEventListener('pointercancel', up);
  document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

  /* ---------- end ---------- */
  function beginEnd() {
    fx.endT = 0.0001; drag = null;
    if (G.result === 'win') { fx.pose = 'squash'; fx.poseT = 0; SFX.win(); fx.pill = null; fx.flashT = 0; }
  }
  const $ = id => document.getElementById(id);
  function showPanel() {
    const win = G.result === 'win';
    $('endStamp').textContent = 'Walk ready!';
    $('endSub').textContent = 'The perfect morning walk outfit.';
    const list = $('endList'); list.innerHTML = '';
    const show = win ? SLOTS.map(k => G.worn[k]) : ['benedetta', 'rome', 'mabel'];
    for (const id of show) { const li = document.createElement('li'); li.innerHTML = `<span class="ph"><img src="assets/${id}.webp" alt=""></span><b>${PIECES[id].name}</b>`; list.appendChild(li); }
    const st = $('endStars'), rate = win ? R.rating(G) : 0; st.innerHTML = ''; st.style.display = win ? 'flex' : 'none'; for (let i = 0; i < 3; i++) { const im = document.createElement('img'); im.src = 'assets/star.webp'; im.alt = ''; if (i >= rate) im.className = 'off'; st.appendChild(im); }
    $('end').classList.add('show');
  }
  function openCTA() {
    let u = CTA_URL; const c = Q.get('clickTag');
    if (c) { let pre = c; for (const k of ['sai', 'sig', 'fbs_aeid', 'urlfix', 'adurl']) { const v = Q.get(k); if (v !== null) pre += `&${k}=${v}`; } u = pre + CTA_URL; }
    if (window.mraid && window.mraid.open) window.mraid.open(u); else window.open(u, '_blank');
  }
  $('cta').onclick = openCTA;
  $('again').onclick = () => restart();
  function restart() {
    G = R.newGame(); Object.assign(fx, { skyA: 'breeze', skyB: 'breeze', skyK: 1, door: 0, fly: [], pop: null, coachShake: 0, flashT: null, triedWrong: null, penalty: null, lastSec: null, secPop: 0, msg: null, msgI: 0, msgHello: true, pose: 'stand', poseT: 0, react: null, gownFall: 0, settle: {}, sparks: [], confetti: [], rackAnim: {}, lock: 0, pill: null, banner: null, endT: 0, hintT: 0, hurry: 0, tryOn: null, firstTouch: false, weatherDone: 0 });
    drag = null; $('end').classList.remove('show');
  }

  /* ---------- update ---------- */
  function update(dt) {
    now += dt;
    const was = G.phase, lookWas = G.look, wornWas = Object.assign({}, G.worn);
    R.step(G, drag && G.phase === 'play' ? 0 : dt);
    if (G.look !== lookWas) { fx.chipT = 0; for (const k of SLOTS) if (wornWas[k]) flyBack(wornWas[k], CX, 500, 0.8, 0.42); fx.gownFall = 0; fx.triedWrong = null; }
    if (was === 'play' && G.result) beginEnd();
    if (G.phase === 'change' && fx.weatherDone !== lookWas + 1 && G.changeT > 0.55) {
      fx.weatherDone = lookWas + 1; fx.skyA = CONFIG.looks[lookWas].sky; fx.skyB = CONFIG.looks[lookWas + 1].sky; fx.skyK = 0;
      fx.banner = { text: CONFIG.looks[lookWas + 1].banner, t: 0, life: 1.75 }; SFX.weather();
    }
    fx.skyK = Math.min(1, fx.skyK + dt / 1.1);
    const sa = SKY[fx.skyA], sb = SKY[fx.skyB], kk = ease(fx.skyK);
    for (let i = 0; i < 3; i++) fx.light[i] = lerp(sa.light[i], sb.light[i], kk);
    fx.sunA = lerp(sa.sun, sb.sun, kk); fx.wind = lerp(sa.wind, sb.wind, kk);
    grade = fx.light;

    /* the body idles for ever */
    BODY.breath = 1.6 + Math.sin(now * 1.5) * 1.6;
    BODY.sway = Math.sin(now * 0.72) * 2.2;
    BODY.hunch = 0;
    let squash = 0;
    if (fx.squashV) { fx.squash = (fx.squash || 0) + fx.squashV * dt; fx.squashV += -(fx.squash || 0) * 170 * dt; fx.squashV *= Math.pow(0.002, dt); squash = fx.squash; if (Math.abs(fx.squashV) < 0.02 && Math.abs(fx.squash) < 0.002) { fx.squashV = 0; fx.squash = 0; } }
    BODY.squash = squash;
    if (fx.react) {
      fx.react.t += dt; const k = fx.react.t, env = k < 0.12 ? k / 0.12 : Math.max(0, 1 - (k - 0.7) / 0.4);
      if (fx.react.kind === 'cold') { BODY.hunch = env; BODY.sway += Math.sin(now * 38) * 1.6 * env; }
      else { BODY.sway += -5 * env; BODY.breath += 3 * env * Math.sin(now * 6); }
      if (k > 1.1) fx.react = null;
    }
    for (const k of Object.keys(fx.settle)) { const s = fx.settle[k]; s.yv += -s.y * 150 * dt; s.yv *= Math.pow(0.004, dt); s.y += s.yv * dt; s.xv += -s.x * 90 * dt; s.xv *= Math.pow(0.012, dt); s.x += s.xv * dt; s.t += dt; if (s.t > 1.6) delete fx.settle[k]; }
    if (fx.gownFall > 0) { fx.gownFall += dt / 0.5; if (fx.gownFall >= 1) fx.gownFall = 0; }
    if (fx.lock > 0) fx.lock -= dt;
    if (fx.tryOn) { fx.tryOn.t += dt; if (fx.tryOn.t > 0.55) { flyBack(fx.tryOn.id, CX, 520, 0.85, 0.4); fx.tryOn = null; } }
    for (const id of Object.keys(fx.rackAnim)) { const a = fx.rackAnim[id]; a.t += dt; if (a.t >= a.dur) delete fx.rackAnim[id]; }
    fx.sparks = fx.sparks.filter(s => (s.t += dt) < s.life);
    fx.fly = fx.fly.filter(f => (f.t += dt) < 0.5);
    if (fx.pop) { fx.pop.t += dt; if (fx.pop.t > 1) fx.pop = null; }
    if (fx.chipT !== undefined) fx.chipT += dt;
    if (fx.coachShake > 0) fx.coachShake = Math.max(0, fx.coachShake - dt * 2.4);
    if (fx.flashT !== null && fx.flashT !== undefined) { fx.flashT += dt; if (fx.flashT > 0.5) fx.flashT = null; }
    if (fx.pill) { fx.pill.t += dt; if (fx.pill.t > fx.pill.life) fx.pill = null; }
    if (fx.banner) { fx.banner.t += dt; if (fx.banner.t > fx.banner.life) fx.banner = null; }

    /* the piece follows the finger with a little weight */
    if (drag) {
      const prevX = drag.x;
      drag.x += (drag.tx - drag.x) * Math.min(1, dt * 26); drag.y += (drag.ty - drag.y) * Math.min(1, dt * 26);
      const over = overBody(drag.tx, drag.ty) ? 1 : 0; drag.overK += (over - drag.overK) * Math.min(1, dt * 14);
      const target = lerp(0.72, 0.82, drag.overK); drag.s += (target - drag.s) * Math.min(1, dt * 12);
      const v = (drag.x - prevX) / Math.max(dt, 0.001); drag.rot += (clamp(v * 0.00028, -0.32, 0.32) - drag.rot) * Math.min(1, dt * 10);
      drag.labelT += dt; drag.swingV += (-drag.swing * 95 - v * 0.009) * dt; drag.swingV *= Math.pow(0.03, dt); drag.swing += drag.swingV * dt;
    }

    /* idle hint: the touch point shows the real drag on a real piece */
    if (G.phase === 'play' && !drag && !fx.rackAnim.length) fx.hintT += dt; else fx.hintT = 0;

    if (G.result) {
      fx.endT += dt;
      if (G.result === 'win') {
        if (fx.pose === 'squash') { fx.poseT += dt; if (fx.poseT > 0.14) { fx.pose = 'win'; fx.squashV = 1.5; burstAll(); } }
        fx.door = Math.min(1, fx.door + dt / 1.1);
        if (fx.endT > 0.5 && fx.confetti.length === 0) makeConfetti();
        if (fx.endT > 2.1 && !fx.panelShown) { fx.panelShown = true; showPanel(); }
      } else {
        fx.door = Math.min(1, fx.door + dt / 0.5);
        if (fx.endT > 0.32) fx.hurry = Math.min(1, fx.hurry + dt / 0.95);
        if (fx.endT > 1.55 && !fx.panelShown) { fx.panelShown = true; showPanel(); }
      }
    } else fx.panelShown = false;
    fx.cam = lerp(fx.cam || 0, fx.panelShown && G.result === 'win' ? -58 : 0, Math.min(1, dt * 5));
    for (const c of fx.confetti) { c.vy += 150 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.r += c.vr * dt; }
    for (const l of fx.leaves) { l.x -= (60 + 180 * l.s) * dt * (0.25 + fx.wind); l.y += Math.sin(now * 2 * l.s + l.r) * 22 * dt; l.r += dt * 3 * l.s; if (l.x < -20) { l.x = 660; l.y = 40 + Math.random() * 240; } }
  }
  function burstAll() { for (let i = 0; i < 34; i++) fx.sparks.push({ x: CX - 110 + Math.random() * 220, y: 270 + Math.random() * 560, t: -Math.random() * 0.35, life: 0.6 + Math.random() * 0.45, sz: 6 + Math.random() * 11 }); }
  function makeConfetti() { const cols = [[0.07, 0.07, 0.07], [0.98, 0.97, 0.94], [0.8, 0.68, 0.42]]; for (let i = 0; i < 30; i++) fx.confetti.push({ x: 20 + Math.random() * 400, y: -20 - Math.random() * 240, vx: -22 + Math.random() * 44, vy: 40 + Math.random() * 90, r: Math.random() * 6, vr: -6 + Math.random() * 12, w: 7 + Math.random() * 6, h: 4 + Math.random() * 4, c: cols[i % cols.length] }); }

  /* ---------- draw: world ---------- */
  function drawStreet() {
    const u = use(PS), m = META.street;
    const names = ['breeze', 'sun', 'mix'], mix = [0, 0, 0];
    mix[names.indexOf(fx.skyA)] += 1 - ease(fx.skyK); mix[names.indexOf(fx.skyB)] += ease(fx.skyK);
    names.forEach((n, i) => { gl.activeTexture(gl.TEXTURE0 + i + 1); gl.bindTexture(gl.TEXTURE_2D, TEX['street_' + n]); });
    gl.uniform1i(u.a, 1); gl.uniform1i(u.b, 2); gl.uniform1i(u.c, 3);
    gl.uniform3f(u.uMix, mix[0], mix[1], mix[2]); gl.uniform1f(u.uWind, fx.wind + 0.12); gl.uniform1f(u.uTs, now % 600);
    gl.uniform4f(u.uRect, 0, m.y, m.w, m.h); gl.uniform4f(u.uRot, 0, 0, 0, 0); gl.uniform1f(u.uMode, 0);
    gl.drawElements(gl.TRIANGLES, NIDX, gl.UNSIGNED_SHORT, 0);
    gl.activeTexture(gl.TEXTURE0);
  }
  function drawGlass() { const u = use(PG); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, TEX.store); gl.uniform1i(u.t, 0); gl.uniform4f(u.uRect, 0, 0, W, H); gl.uniform4f(u.uRot, 0, 0, 0, 0); gl.uniform1f(u.uMode, 0); gl.uniform1f(u.uAlpha, 1); gl.drawElements(gl.TRIANGLES, NIDX, gl.UNSIGNED_SHORT, 0); }
  function drawDoor() {
    const d = META.door, k = ease(fx.door), w = d.w * (1 - 0.86 * k);
    if (k > 0) quad(TEX.soft, d.x + w - 26, d.y, 60, d.h, { shadow: true, alpha: 0.2 * k });
    quad(TEX.door, d.x, d.y, w, d.h, {});
  }
  function softShadow(tex, x, y, w, h, o) { quad(TEX[tex], x - w * SH_PAD, y - h * SH_PAD, w * (1 + 2 * SH_PAD), h * (1 + 2 * SH_PAD), Object.assign({ shadow: true }, o)); }
  function drawRack() {
    for (const id of pieceIds) {
      if (!onRack(id) && !fx.rackAnim[id]) continue;
      if (fx.tryOn && fx.tryOn.id === id) continue;
      const r = thumbRect(id), a = fx.rackAnim[id];
      const cur = G.phase === 'play' ? R.current(G) : null, lit = cur && PIECES[id].slot === cur, dim = cur && !lit ? 0.42 : 1;
      const near = drag ? Math.max(0, 1 - Math.abs(r.hx - drag.x) / 120) : 0;
      const sw = Math.sin(now * 1.3 + r.hx * 0.03) * 0.012 + near * Math.sin(now * 9) * 0.015;
      if (a) {
        const k = ease(Math.min(1, a.t / a.dur)), cx = lerp(a.x0, a.x1, k), cy = lerp(a.y0, a.y1, k) - Math.sin(k * Math.PI) * 26, s = lerp(a.s0, THUMB, k), l = META.layers[id], w = l.w * BS * s, h = l.h * BS * s;
        quad(TEX[id], cx - w / 2, cy - h / 2, w, h, {});
        continue;
      }
      softShadow('sh_' + id, r.x + (lit ? 6 : 4), r.y + (lit ? 11 : 7), r.w * (lit ? 1.1 : 1), r.h * (lit ? 1.1 : 1), { rot: sw, px: r.hx, py: r.hy + 6, alpha: (lit ? 0.42 : 0.26) * dim });
            const zk = lit ? 1.1 : dim < 1 ? 0.92 : 1, zw = r.w * zk, zh = r.h * zk;
      if (lit && !drag) quad(TEX['ol_' + id], r.hx - zw / 2 - OL_PAD, r.y - OL_PAD, zw + OL_PAD * 2, zh + OL_PAD * 2, { rot: sw, px: r.hx, py: r.hy + 6, flat: true });
      quad(TEX.hanger, r.hx - 26, r.hy - 2, 52, 26, { rot: sw, px: r.hx, py: r.hy + 6, alpha: dim });
      quad(TEX[id], r.hx - zw / 2, r.y, zw, zh, { rot: sw, px: r.hx, py: r.hy + 6, alpha: dim });
    }
    for (const id of Object.values(G.worn).filter(Boolean)) {
      const r = thumbRect(id);
      quad(TEX.hanger, r.hx - 26, r.hy - 2, 52, 26, { rot: Math.sin(now * 1.3 + r.hx * 0.03) * 0.014, px: r.hx, py: r.hy + 6 });
    }
  }
  function drawModel() {
    const win = fx.pose === 'win', prefix = win ? 'w' : '', hurry = fx.hurry, sname = prefix + 'body', cam = fx.cam || 0;
    const dx = cam + (hurry ? -hurry * hurry * 300 : 0), dy = hurry ? Math.abs(Math.sin(now * 13)) * -9 * Math.min(1, hurry * 3) : 0;
    const sr = layerRect(sname, cam), feet = META.Y0 + (META.layers.body.y + META.layers.body.h) * BS, shA = 1 - hurry;
    if (shA > 0.01) {
      const hh = sr.h * 0.13, w2 = sr.w * (1 + 2 * SH_PAD), h2 = hh * (1 + 2 * SH_PAD);
      quad(TEX['sh_' + sname], sr.x - sr.w * SH_PAD + 10, feet + hh * (1 + SH_PAD), w2, -h2, { shadow: true, alpha: 0.3 * shA });
      quad(TEX.soft, CX + cam - 130, feet - 28, 260, 54, { shadow: true, alpha: 0.42 * shA });
    }
    const put = (name, o) => { const r = layerRect(name, dx, dy); quad(TEX[name], r.x, r.y, r.w, r.h, Object.assign({ body: true, dx }, o)); };
    if (hurry > 0.98) return;
    put(sname, { cloth: 0 });
    const over = drag ? drag.overK : 0, dSlot = drag ? PIECES[drag.id].slot : null;
    let trA = 0, trSlot = null;
    if (fx.tryOn) { const k = fx.tryOn.t; trA = Math.min(1, k / 0.1, Math.max(0, 1 - (k - 0.38) / 0.17)); trSlot = PIECES[fx.tryOn.id].slot; }
    const layerShown = (G.worn.layer && !(G.result === 'lost')) || (dSlot === 'layer' && over > 0.5) || (trSlot === 'layer' && trA > 0.5);
    const torso = win ? [CX + cam - 48, CX + cam + 68] : [CX + cam - 55, CX + cam + 55];
    const cloth = { layer: 0.42, top: 0.22, bottom: 0.1 };
    if (G.result !== 'lost') for (const slot of ['bottom', 'top', 'layer']) {
      const id = G.worn[slot], sub = slot === dSlot ? over : 0, tk = slot === trSlot ? trA : 0, keep = 1 - Math.max(sub, tk), st = fx.settle[slot], clip = slot === 'top' && layerShown ? torso : null;
      if (id && keep > 0.01) put(prefix + id, { alpha: keep, cloth: cloth[slot], stretch: st ? st.y : 0, wob: st ? st.x : 0, clip });
      if (sub > 0.01) put(prefix + drag.id, { alpha: sub, cloth: cloth[slot], clip });
      if (tk > 0.01) put(prefix + fx.tryOn.id, { alpha: tk, cloth: cloth[slot], clip });
    }
    if (G.gown && fx.gownFall === 0) { const a = 1 - Math.max(G.result === 'lost' ? 0 : over, trA); if (a > 0.01) put('gown', { alpha: a, cloth: 0.15 }); }
    if (fx.gownFall > 0) { const k = fx.gownFall, r = layerRect('gown'); quad(TEX.gown, r.x, r.y + k * k * 90, r.w, r.h, { body: true, alpha: 1 - k, stretch: k * 0.5 }); }
    if (fx.react && !win) {
      const f = fx.react.kind === 'cold' ? 'face_cold' : 'face_hot', k = fx.react.t, a = Math.min(1, k / 0.08, Math.max(0, 1 - (k - 0.8) / 0.25));
      put(f, { alpha: a, cloth: 0 });
    }
  }
  function drawSparks() {
    for (const s of fx.sparks) { if (s.t < 0) continue; const k = s.t / s.life, a = Math.sin(k * Math.PI), z = s.sz * (0.5 + a * 0.7); quad(TEX.spark, s.x - z / 2, s.y - z / 2, z, z, { add: true, alpha: a * 0.95, flat: true }); }
  }
  function drawDragged() {
    if (!drag) return;
    const l = META.layers[drag.id], k = 1 - drag.overK, w = l.w * BS * drag.s, h = l.h * BS * drag.s, x = drag.x - w / 2, y = drag.y - h * 0.36;
    if (k < 0.02) return;
    softShadow('sh_' + drag.id, x + 10, y + 18, w, h, { alpha: 0.3 * k, rot: drag.rot, px: drag.x, py: y });
    quad(TEX[drag.id], x, y, w, h, { alpha: k, rot: drag.rot, px: drag.x, py: y, flat: false });
  }
  function drawGhostHand() {
    /* The real piece travels with the touch point, at the real speed */
    if (G.phase !== 'play' || drag || !hintActive()) return;
    const c = hintFrame(); if (!c) return;
    const l = META.layers[c.id], s = lerp(THUMB, 0.72, c.k), w = l.w * BS * s, h = l.h * BS * s;
    quad(TEX[c.id], c.x - w / 2, c.y - h * 0.36, w, h, { alpha: c.a * 0.85 * clamp((0.72 - c.k) / 0.2, 0, 1) });
  }
  const hintWait = () => (G.started ? 3.6 : 0.5);
  const hintActive = () => !G.started && fx.hintT > hintWait() && !fx.lock;
  function hintFrame() {
    const id = R.suggest(G); if (!id) return null;
    const t = (fx.hintT - hintWait()) % 2.5, r = thumbRect(id), x0 = r.hx, y0 = r.y + r.h * 0.4, x1 = CX + 8, y1 = PIECES[id].slot === 'bottom' ? 690 : 500;
    const press = 0.3, travel = 1.15;
    let k = 0, a = 1; if (t < press) { a = t / press; k = 0; } else if (t < press + travel) k = ease((t - press) / travel); else { k = 1; a = Math.max(0, 1 - (t - press - travel) / 0.45); }
    return { id, x: lerp(x0, x1, k), y: lerp(y0, y1, k), k, a, x0, y0 };
  }

  /* ---------- draw: HUD. A premium dress-up game in the brand's black and white, with champagne gold as the reward colour. ---------- */
  const FONT = 'Montserrat,Arial,sans-serif', INK = '#111111', MUT = '#6b665d', GOLD = '#c9a86a', GOLD2 = '#e9d7ad', PAPER = '#f6f2ea';
  const SLOT_SIL = { top: 'benedetta', bottom: 'rome', layer: 'mabel' }, WORD = { top: 'TOP', bottom: 'BOTTOM', layer: 'LAYER' };
  const SIL = {}, CACHE = new Map();
  function cached(key, x, y, w, h, fn) {
    let c = CACHE.get(key);
    if (!c) { c = canvas(Math.ceil(w), Math.ceil(h)); const g = c.getContext('2d'); g.translate(-x, -y); const main = ctx; ctx = g; try { fn(); } finally { ctx = main; } CACHE.set(key, c); }
    ctx.drawImage(c, x, y, w, h);
  }
  function dimStar(x, y, size) { if (!SIL.star) { const c = canvas(64, 64), g = c.getContext('2d'); g.drawImage(IMG.star, 0, 0, 64, 64); g.globalCompositeOperation = 'source-in'; g.fillStyle = 'rgba(120,120,120,.32)'; g.fillRect(0, 0, 64, 64); SIL.star = c; } ctx.drawImage(SIL.star, x - size / 2, y - size / 2, size, size); }
  function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function wrap(text, maxw) { const words = text.split(' '), out = []; let l = ''; for (const w of words) { const t = l ? l + ' ' + w : w; if (ctx.measureText(t).width > maxw && l) { out.push(l); l = w; } else l = t; } if (l) out.push(l); return out; }
  function caps(text, x, y, size, col, align, track) { ctx.font = `700 ${size}px ${FONT}`; ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = col; if ('letterSpacing' in ctx) ctx.letterSpacing = (track === undefined ? 2.2 : track) + 'px'; ctx.fillText(text, x, y); if ('letterSpacing' in ctx) ctx.letterSpacing = '0px'; }
  function goldFill(x0, y0, x1, y1) { const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, GOLD2); g.addColorStop(0.5, GOLD); g.addColorStop(1, '#a98a4e'); return g; }
  const SKYCOL = { breeze: ['#64839f', '#a9bdcd'], sun: ['#1c7bdc', '#70c2f7'], mix: ['#3a90da', '#a9d3ee'] };
  function glyph(kind, x, y, sz) {
    /* Plain weather shapes everyone reads at a glance */
    ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round';
    if (kind === 'sun' || kind === 'mix') {
      const k = kind === 'mix' ? 0.72 : 1, ox = kind === 'mix' ? -sz * 0.14 : 0, oy = kind === 'mix' ? -sz * 0.12 : 0;
      ctx.strokeStyle = '#ffd34d'; ctx.lineWidth = sz * 0.075 * k; for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4; ctx.beginPath(); ctx.moveTo(ox + Math.cos(a) * sz * 0.31 * k, oy + Math.sin(a) * sz * 0.31 * k); ctx.lineTo(ox + Math.cos(a) * sz * 0.43 * k, oy + Math.sin(a) * sz * 0.43 * k); ctx.stroke(); }
      ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.arc(ox, oy, sz * 0.22 * k, 0, 7); ctx.fill();
    }
    if (kind === 'breeze' || kind === 'mix') {
      const k = kind === 'mix' ? 0.62 : 1, ox = kind === 'mix' ? sz * 0.12 : 0, oy = kind === 'mix' ? sz * 0.2 : 0, q = sz * k;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = sz * 0.075 * (kind === 'mix' ? 0.85 : 1);
      ctx.beginPath(); ctx.moveTo(ox - q * 0.42, oy - q * 0.14); ctx.lineTo(ox + q * 0.14, oy - q * 0.14); ctx.arc(ox + q * 0.14, oy - q * 0.27, q * 0.13, Math.PI / 2, -Math.PI * 0.8, true); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox - q * 0.42, oy + q * 0.03); ctx.lineTo(ox + q * 0.36, oy + q * 0.03); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox - q * 0.3, oy + q * 0.2); ctx.lineTo(ox + q * 0.06, oy + q * 0.2); ctx.arc(ox + q * 0.06, oy + q * 0.31, q * 0.11, -Math.PI / 2, Math.PI * 0.8); ctx.stroke();
    }
    ctx.restore();
  }
  function badge(mark, x, y, size) {
    const c = SKYCOL[mark] || SKYCOL.sun, g = ctx.createLinearGradient(0, y - size / 2, 0, y + size / 2); g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
    ctx.fillStyle = g; rr(x - size / 2, y - size / 2, size, size, size * 0.24); ctx.fill(); glyph(mark, x, y, size * 0.74);
  }
  function widget(lk, x, y, z) {
    /* The weather, the way everyone's phone already shows it */
    const w = 132 * z, c = SKYCOL[lk.sky], g = ctx.createLinearGradient(0, y, 0, y + w); g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
    ctx.fillStyle = g; rr(x, y, w, w, 26 * z); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.font = `600 ${15 * z}px ${FONT}`; ctx.fillText('Today', x + 14 * z, y + 27 * z);
    ctx.font = `300 ${50 * z}px ${FONT}`; ctx.fillText(lk.temp + '°', x + 12 * z, y + 78 * z);
    glyph(lk.sky, x + w - 30 * z, y + 28 * z, 34 * z);
    ctx.font = `600 ${16.5 * z}px ${FONT}`; ctx.fillText(lk.cond, x + 13 * z, y + 112 * z, w - 22 * z);
  }
  const ELEV = { 1: [[2, 5, 0.3], [7, 16, 0.24]], 2: [[3, 7, 0.32], [12, 28, 0.32]], 3: [[5, 10, 0.38], [18, 38, 0.42]] };
  function lift(level, shape, fill) {
    for (const [dy, blur, a] of ELEV[level]) { ctx.save(); ctx.shadowColor = `rgba(20,14,6,${a})`; ctx.shadowBlur = blur; ctx.shadowOffsetY = dy; ctx.fillStyle = fill; shape(); ctx.fill(); ctx.restore(); }
    ctx.fillStyle = fill; shape(); ctx.fill();
  }
  function textLift(a) { ctx.shadowColor = `rgba(0,0,0,${a === undefined ? 0.7 : a})`; ctx.shadowBlur = 10; ctx.shadowOffsetY = 2; }
  function card(x, y, w, h, r, fill, border) { lift(2, () => rr(x, y, w, h, r), fill); if (border) { ctx.strokeStyle = border; ctx.lineWidth = 2; rr(x + 1, y + 1, w - 2, h - 2, r - 1); ctx.stroke(); } }
  function star(x, y, size, alpha) { ctx.save(); ctx.globalAlpha *= alpha === undefined ? 1 : alpha; if (size > 22) { ctx.shadowColor = 'rgba(20,14,6,.45)'; ctx.shadowBlur = size * 0.2; ctx.shadowOffsetY = size * 0.07; } ctx.drawImage(IMG.star, x - size / 2, y - size / 2, size, size); ctx.restore(); }
  function tickMedal(x, y, r) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 6; ctx.fillStyle = goldFill(x - r, y - r, x + r, y + r); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.restore(); ctx.strokeStyle = INK; ctx.lineWidth = r * 0.26; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x - r * 0.46, y + r * 0.03); ctx.lineTo(x - r * 0.1, y + r * 0.38); ctx.lineTo(x + r * 0.5, y - r * 0.34); ctx.stroke(); }
  const shownLook = () => (G.phase === 'change' && G.changeT > 0.55 ? Math.min(G.look + 1, 2) : G.look);
  const looksDone = () => (G.result === 'win' ? 3 : G.look + (G.phase === 'change' ? 1 : 0));

  const BOARD = 72, DISC_Y = 852, DISC_X = [404, 486, 568];
  function drawFascia() {
    if (fx.panelShown) return;
    cached('board', 0, 0, W, BOARD + 34, () => { lift(2, () => { ctx.beginPath(); ctx.rect(-40, -40, W + 80, BOARD + 40); }, '#fff'); const lw = 430, lh = lw * 18 / 214; if (LOGO_IMG && LOGO_IMG.naturalWidth) ctx.drawImage(LOGO_IMG, W / 2 - lw / 2, (BOARD - lh) / 2, lw, lh); });
  }
  const WX = 10, WY = BOARD + 10, WZ = 0.8, WS = 132 * WZ;
  function drawMission() {
    if (G.result) return;
    const li = shownLook(), lk = CONFIG.looks[li], done = looksDone(), hidden = G.phase === 'change' && G.changeT > 0.92;
    for (let i = 0; i < 3; i++) { const sx = W - 62 + i * 22, on = i < done; if (on) star(sx, BOARD / 2, 21); else dimStar(sx, BOARD / 2, 18); }
    if (hidden) return;
    const pop = fx.chipT === undefined ? 1 : 1 + Math.max(0, 0.08 * (1 - fx.chipT / 0.25));
    ctx.save(); ctx.translate(WX + WS / 2, WY + WS / 2); ctx.scale(pop, pop); ctx.translate(-WX - WS / 2, -WY - WS / 2);
    cached(`w|${li}`, WX - 44, WY - 44, WS + 88, WS + 104, () => { lift(2, () => rr(WX, WY, WS, WS, 26 * WZ), SKYCOL[lk.sky][0]); widget(lk, WX, WY, WZ); ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1; rr(WX + 0.5, WY + 0.5, WS - 1, WS - 1, 26 * WZ - 0.5); ctx.stroke(); });
    ctx.restore();
  }
  const OUTSIDE = { breeze: "It's breezy out.", sun: "It's hot and sunny.", mix: "Sunny, but breezy." };
  function speechLines() {
    if (G.result || G.phase !== 'play' || drag) return null;
    const cur = R.current(G); if (!cur) return null;
    if (fx.react) return [fx.react.kind === 'cold' ? 'Brrr!' : 'Phew!', fx.react.kind === 'cold' ? 'Better for a sunnier morning.' : 'Better for a cooler morning.'];
    const lk = CONFIG.looks[G.look], need = lk.needs[cur], word = cur === 'bottom' ? 'bottom' : cur;
    if (fx.triedWrong === cur) return [OUTSIDE[lk.sky], `Try the other ${word}.`];
    return [OUTSIDE[lk.sky], lk.sky === 'mix' ? `Which ${word} for the ${need}?` : `Which ${word} suits it?`];
  }
  function drawSpeech() {
    /* A speech bubble from her, not a card: she tells you the weather and asks */
    const t = speechLines(); if (!t) return;
    const key = 's|' + t.join('|');
    let c = CACHE.get(key + '|h');
    if (!c) { ctx.font = `500 18px ${FONT}`; const a = wrap(t[0], 236); ctx.font = `700 23px ${FONT}`; const b = wrap(t[1], 236); ctx.font = `500 18px ${FONT}`; const aw = Math.max(...a.map(l => ctx.measureText(l).width)); ctx.font = `700 23px ${FONT}`; const bw = Math.max(...b.map(l => ctx.measureText(l).width)); c = { a, b, w: Math.max(aw, bw) + 34, h: 24 + a.length * 23 + b.length * 28 }; CACHE.set(key + '|h', c); }
    const { a, b, w, h } = c, x = CX + 64, y = 276 - h, bob = Math.sin(now * 2.6) * 1.6, sh = Math.sin(fx.coachShake * 18) * 7 * fx.coachShake;
    ctx.save(); ctx.translate(x + sh, y + bob);
    cached(key, -60, -46, w + 112, h + 110, () => {
      const R0 = 20, shape = () => { ctx.beginPath(); ctx.moveTo(R0, 0); ctx.lineTo(w - R0, 0); ctx.arcTo(w, 0, w, R0, R0); ctx.lineTo(w, h - R0); ctx.arcTo(w, h, w - R0, h, R0); ctx.lineTo(66, h); ctx.quadraticCurveTo(50, h + 17, -9, h + 21); ctx.quadraticCurveTo(20, h + 11, 28, h); ctx.lineTo(R0, h); ctx.arcTo(0, h, 0, h - R0, R0); ctx.lineTo(0, R0); ctx.arcTo(0, 0, R0, 0, R0); ctx.closePath(); }; lift(2, shape, '#fff'); shape(); ctx.strokeStyle = 'rgba(40,30,15,.2)'; ctx.lineWidth = 1.2; ctx.lineJoin = 'round'; ctx.stroke();
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.font = `500 18px ${FONT}`; ctx.fillStyle = '#4a463f'; a.forEach((l, i) => ctx.fillText(l, 17, 12 + i * 23));
      ctx.font = `700 23px ${FONT}`; ctx.fillStyle = INK; b.forEach((l, i) => ctx.fillText(l, 17, 12 + a.length * 23 + 1 + i * 28));
    });
    ctx.restore();
  }
  function drawOpening() {
    /* The brief's line, only until the first touch */
    if (G.started || G.result) return;
    const a = Math.min(1, now / 0.4);
    ctx.save(); ctx.globalAlpha = a;
    cached('open', 120, BOARD + 2, 520, 84, () => { lift(1, () => rr(344, BOARD + 12, 286, 58, 14), 'rgba(14,14,14,.9)'); ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = `600 18px ${FONT}`; ctx.fillText('Drag to style the perfect', 358, BOARD + 31); ctx.fillText('morning walk outfit.', 358, BOARD + 52); });
    ctx.restore();
  }
  function fitImage(img, x, y, w, h, alpha) { const k = Math.min(w / img.width, h / img.height), dw = img.width * k, dh = img.height * k; ctx.save(); ctx.globalAlpha *= alpha === undefined ? 1 : alpha; ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); ctx.restore(); }
  function silhouette(id) { if (!SIL[id]) { const c = canvas(IMG[id].width, IMG[id].height), g = c.getContext('2d'); g.drawImage(IMG[id], 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#8d8676'; g.fillRect(0, 0, c.width, c.height); SIL[id] = c; } return SIL[id]; }
  function drawTray() {
    /* My Look: small discs under the rack. The one being dressed is the big one. */
    if (G.result) return;
    const cur = G.phase === 'play' ? R.current(G) : null, changing = G.phase === 'change' && G.changeT > 0.55;
    fx.discK = fx.discK || { top: 0, bottom: 0, layer: 0 };
    SLOTS.forEach((k, i) => {
      fx.discK[k] = lerp(fx.discK[k], cur === k ? 1 : 0, 0.16);
      const q = fx.discK[k], r = lerp(26, 37, q), x = DISC_X[i], y = DISC_Y, done = !changing && R.slotDone(G, k), worn = changing ? null : G.worn[k];
      const key = `d|${k}|${worn || '-'}|${done ? 1 : 0}`;
      ctx.save(); ctx.translate(x, y); const z = r / 37; ctx.scale(z, z);
      cached(key, -62, -62, 124, 132, () => {
        lift(1, () => { ctx.beginPath(); ctx.arc(0, 0, 37, 0, 7); }, '#fff');
        ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 35, 0, 7); ctx.clip(); if (worn) fitImage(IMG[worn], -29, -29, 58, 58); else fitImage(silhouette(SLOT_SIL[k]), -29, -29, 58, 58, 0.26); ctx.restore();
        if (done) tickMedal(25, 25, 13);
      });
      ctx.restore();
      if (q > 0.5) { ctx.save(); ctx.globalAlpha = (q - 0.5) * 2; ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r + 3 + Math.sin(now * 4), 0, 7); ctx.stroke(); const t = WORD[k]; ctx.font = `700 13px ${FONT}`; const tw = ctx.measureText(t).width + 26 + (t.length * 1.4); ctx.fillStyle = INK; ctx.shadowColor = 'rgba(20,14,6,.4)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3; rr(x - tw / 2, y + r + 9, tw, 24, 12); ctx.fill(); ctx.shadowColor = 'transparent'; caps(t, x, y + r + 22, 13, '#fff', 'center', 1.4); ctx.restore(); }
    });
  }
  function drawDropTarget() {
    if (!drag || G.result) return;
    const pu = 1 + Math.sin(now * 6) * 0.03;
    ctx.save(); ctx.globalAlpha = 0.85; ctx.strokeStyle = GOLD; ctx.lineWidth = 2.5; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -now * 30; ctx.beginPath(); ctx.ellipse(CX, FEET - 2, 128 * pu, 22 * pu, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
    if (drag.overK < 0.5) { ctx.save(); ctx.translate(CX, 560); cached('dropher', -124, -56, 248, 118, () => { lift(2, () => rr(-82, -19, 164, 38, 19), 'rgba(14,14,14,.92)'); caps('DROP ON HER', 0, 1, 15, '#fff', 'center', 1.6); }); ctx.restore(); }
  }
  function drawPop() {
    if (!fx.pop || G.result === 'lost' || G.phase === 'change') return;
    const k = fx.pop.t, s = k < 0.12 ? 0.7 + 0.4 * (k / 0.12) : k < 0.22 ? 1.1 - 0.1 * ((k - 0.12) / 0.1) : 1, a = Math.max(0, Math.min(1, (0.85 - k) / 0.2));
    ctx.save(); ctx.globalAlpha = a; ctx.translate(CX, 500 - k * 26); ctx.scale(s, s);
    cached('match', -140, -58, 280, 124, () => { lift(2, () => rr(-98, -20, 196, 40, 20), goldFill(0, -20, 0, 20)); caps('PERFECT MATCH', 0, 1, 15.5, INK, 'center', 1.4); });
    ctx.restore();
    for (const f of fx.fly) { const q = ease(f.t / 0.5), i = SLOTS.indexOf(f.slot), x1 = DISC_X[i], y1 = DISC_Y, x = lerp(CX, x1, q), y = lerp(500, y1, q) - Math.sin(q * Math.PI) * 50; star(x, y, 34 - q * 14); }
  }
  function drawLabel() {
    if (!drag) return;
    const p = PIECES[drag.id], w = 214, pad = 14;
    ctx.font = `700 23px ${FONT}`; const claim = wrap(p.fact, w - pad * 2 - 4); ctx.font = `500 14.5px ${FONT}`; const name = wrap(p.name, w - pad * 2 - 44);
    const h = 26 + claim.length * 27 + 10 + 40;
    const k = clamp(drag.labelT / 0.14, 0, 1), side = drag.x > 320 ? -1 : 1, hx = clamp(drag.x + side * (60 + w / 2), w / 2 + 8, W - w / 2 - 8), hy = clamp(drag.y - h * 0.5, BOARD + 16, 900 - h);
    const rot = clamp(drag.swing, -0.5, 0.5) * 0.26;
    ctx.save(); ctx.globalAlpha = k;
    ctx.strokeStyle = GOLD; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(drag.x, drag.y - 40); ctx.quadraticCurveTo((drag.x + hx) / 2, Math.min(drag.y, hy) - 22, hx, hy + 10); ctx.stroke();
    ctx.translate(hx, hy + 10); ctx.rotate(rot); ctx.scale(0.75 + 0.25 * k, 0.75 + 0.25 * k); ctx.translate(-w / 2, -10);
    cached('tag|' + drag.id, -60, -60, w + 120, h + 130, () => {
      lift(3, () => { ctx.beginPath(); ctx.moveTo(20, 0); ctx.lineTo(w - 20, 0); ctx.lineTo(w, 16); ctx.lineTo(w, h - 10); ctx.quadraticCurveTo(w, h, w - 10, h); ctx.lineTo(10, h); ctx.quadraticCurveTo(0, h, 0, h - 10); ctx.lineTo(0, 16); ctx.closePath(); }, '#141414');
      ctx.fillStyle = GOLD2; ctx.beginPath(); ctx.arc(w / 2, 10, 4, 0, 7); ctx.fill();
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff'; ctx.font = `700 23px ${FONT}`; claim.forEach((l, i) => ctx.fillText(l, pad, 24 + i * 27));
      const by = 24 + claim.length * 27 + 8; badge(p.mark, pad + 15, by + 15, 30);
      ctx.font = `500 15px ${FONT}`; ctx.fillStyle = '#d6d0c5'; ctx.textBaseline = 'middle'; const nl = wrap(p.name, w - pad * 2 - 40); nl.slice(0, 2).forEach((l, i) => ctx.fillText(l, pad + 38, by + 15 + (i - (Math.min(nl.length, 2) - 1) / 2) * 16));
    });
    ctx.restore();
  }
  function drawHintTouch() {
    if (G.phase !== 'play' || drag || !hintActive()) return;
    const c = hintFrame(); if (!c) return;
    ctx.save(); ctx.globalAlpha = c.a;
    const g = ctx.createLinearGradient(c.x0, c.y0, c.x, c.y); g.addColorStop(0, 'rgba(233,215,173,0)'); g.addColorStop(1, 'rgba(233,215,173,.9)'); ctx.strokeStyle = g; ctx.lineWidth = 8; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(c.x0, c.y0); ctx.lineTo(c.x, c.y); ctx.stroke();
    const r = 22 + Math.sin(now * 7) * 2.5; ctx.strokeStyle = GOLD; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(c.x, c.y, r + 10, 0, 7); ctx.stroke(); ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(c.x, c.y, r - 5, 0, 7); ctx.fill(); ctx.restore();
  }
  function softBack(x, y, r, a) { const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
  function drawLookDone() {
    /* No box: a star, then the next sky, floating over the scene for a moment */
    if (G.phase !== 'change') return;
    const t = G.changeT, T = CONFIG.changeTime, a = clamp(Math.min(1, t / 0.12, (T - t) / 0.2), 0, 1), cx = W / 2, cy = 400;
    ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(0, BOARD, W, H - BOARD); if (t < 1.72) { ctx.globalAlpha = a * (t < 0.92 ? 1 : 0.5); softBack(cx, cy, 300, 0.62); ctx.globalAlpha = a; }
    if (t < 0.92) {
      const sp = clamp((t - 0.06) / 0.18, 0, 1), ss = sp < 1 ? 30 + 66 * sp : 86 + Math.sin(now * 5) * 2;
      star(cx, cy - 26, ss); ctx.save(); textLift(); caps(`LOOK ${G.look + 1} COMPLETE`, cx, cy + 48, 20, '#fff', 'center', 2.4); ctx.restore();
    } else {
      const lk = CONFIG.looks[G.look + 1], sp = clamp((t - 0.92) / 0.18, 0, 1), fly = ease(clamp((t - 1.72) / 0.36, 0, 1)), z = lerp(lerp(1.2, 1.9, sp), WZ, fly), wx = lerp(cx - 66 * z, WX, fly), wy = lerp(cy - 66 * z, WY, fly);
      ctx.globalAlpha = Math.max(sp, 0.001); lift(3, () => rr(wx, wy, 132 * z, 132 * z, 26 * z), SKYCOL[lk.sky][0]); widget(lk, wx, wy, z);
    }
    ctx.restore();
  }
  function drawFlash() { if (fx.flashT === null || fx.flashT === undefined) return; const k = fx.flashT; ctx.save(); ctx.globalAlpha = Math.max(0, 0.55 * (1 - k / 0.18)) + (k > 0.24 ? Math.max(0, 0.28 * (1 - (k - 0.24) / 0.16)) : 0); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.restore(); }
  function drawWinMoment() {
    if (G.result !== 'win' || fx.panelShown) return;
    const k = fx.endT - 0.35; if (k < 0) return;
    const p = clamp(k / 0.2, 0, 1), rate = R.rating(G), cx = 452, cy = 186;
    ctx.save(); ctx.globalAlpha = p; ctx.save(); ctx.beginPath(); ctx.rect(0, BOARD, W, H - BOARD); ctx.clip(); softBack(cx, cy, 170, 0.6); ctx.restore();
    for (let i = 0; i < 3; i++) { const sp = clamp((k - 0.1 - i * 0.14) / 0.16, 0, 1), sz = i < rate ? 44 * (sp < 1 ? 0.4 + 0.75 * sp : 1) : 34; if (i < rate) { if (sp > 0) star(cx - 52 + i * 52, cy - 24, sz); } else dimStar(cx - 52 + i * 52, cy - 24, sz); }
    textLift(0.8); ctx.font = `700 36px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'; ctx.fillText('Walk ready!', cx, cy + 28); ctx.restore();
  }
  /* ---------- frame ---------- */
  let LOGO_IMG = null, LOGO_W = null, last = 0, paused = false, offscreen = false;
  function render() {
    gl.viewport(0, 0, glc.width, glc.height);
    drawStreet();
    if (fx.wind > 0.3) { const a = clamp((fx.wind - 0.3) * 1.3, 0, 1) * 0.95; for (const l of fx.leaves) quad(TEX.leaf, l.x, l.y, l.sz * 2, l.sz, { rot: l.r, px: l.x + l.sz, py: l.y + l.sz / 2, alpha: a, flat: true }); }
    drawGlass();
    quad(TEX.store, 0, 0, W, H, {});
    drawDoor();
    if (fx.sunA > 0.03) quad(TEX.sunpool, 0, 590, 640, 370, { add: true, alpha: fx.sunA * 0.15, flat: true });
    if (fx.door > 0.02) quad(TEX.sunpool, -40, 590, 300, 330, { add: true, alpha: ease(fx.door) * 0.16, flat: true });
    drawRack();
    if (!(fx.panelShown && G.result === 'lost' && fx.hurry >= 1)) drawModel();
    drawSparks();
    drawGhostHand();
    drawDragged();
    quad(TEX.vignette, 0, 0, W, H, { flat: true, alpha: 0.9 });
    ctx.clearRect(0, 0, W, H);
    for (const c of fx.confetti) { if (c.y > H + 20) continue; ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.r); ctx.scale(1, Math.abs(Math.cos(c.r * 1.4)) * 0.9 + 0.1); ctx.fillStyle = `rgb(${c.c.map(v => Math.round(v * 255)).join(',')})`; ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h); ctx.restore(); }
    drawFascia(); drawMission(); drawTray(); drawDropTarget(); drawSpeech(); drawOpening(); drawPop(); drawHintTouch(); drawLabel(); drawLookDone(); drawWinMoment(); drawFlash();
  }
  function frame(t) {
    requestAnimationFrame(frame);
    if (document.hidden || offscreen) { last = t; return; }
    const dt = Math.min(0.05, (t - last) / 1000 || 0); last = t;
    if (BOT) BOT.tick(dt);
    update(dt); render();
    fxps(dt);
  }
  let fN = 0, fT = 0;
  function fxps(dt) { fN++; fT += dt; if (fT > 1) { window.__fps = Math.round(fN / fT); fN = 0; fT = 0; } }

  /* ---------- bot: plays a real round through the same pick, move and release ---------- */
  const BOT = Q.has('bot') ? {
    wait: 1.2, cur: null, t: 0,
    tick(dt) {
      if (G.phase !== 'play') { return; }
      if (this.cur) { this.t += dt / 0.8; const k = ease(Math.min(1, this.t)), c = this.cur; move(lerp(c.x0, c.x1, k), lerp(c.y0, c.y1, k)); if (this.t >= 1.15) { release(); this.cur = null; this.wait = 0.5; } return; }
      this.wait -= dt; if (this.wait > 0 || fx.lock > 0) return;
      const id = R.suggest(G); if (!id) return; const r = thumbRect(id), x0 = r.hx, y0 = r.y + r.h * 0.4;
      pick(id, x0, y0); this.cur = { x0, y0, x1: CX, y1: 520 }; this.t = 0;
    },
  } : null;

  /* ---------- boot ---------- */
  (async function boot() {
    await loadAll();
    const logo = new Image(); await new Promise(r => { logo.onload = r; logo.onerror = r; logo.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(window.LOGO_SVG.replace('width="214" height="18"', 'width="856" height="72"')); }); LOGO_IMG = logo;
    if (logo.naturalWidth) { const c = canvas(856, 72), g = c.getContext('2d'); g.drawImage(logo, 0, 0, 856, 72); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, 856, 72); LOGO_W = c; }
    META.X0 = CX - 848 * BS; META.Y0 = FEET - (META.layers.body.y + META.layers.body.h) * BS;
    BODY.top = META.Y0 + META.layers.body.y * BS; BODY.h = META.layers.body.h * BS;
    if ('IntersectionObserver' in window) new IntersectionObserver(es => { offscreen = !es[es.length - 1].isIntersecting; }).observe(stage);
    const card = Q.get('card');
    if (card === 'win') { G.worn = { top: 'tee', bottom: 'rome', layer: 'mabel' }; G.gown = false; G.started = true; G.look = 2; G.clock = 20; G.phase = 'end'; G.result = 'win'; G.spare = 14; fx.skyA = fx.skyB = 'mix'; beginEnd(); }
        render(); gl.finish && gl.finish();
    document.getElementById('load').classList.add('done');
    last = performance.now(); requestAnimationFrame(frame);
    window.W_READY = true;
  })().catch(e => { console.error(e); });

  window.GAME = { get G() { return G; }, fx, thumbRect, restart, pick, move, release, overBody, get drag() { return drag; } };
})();
