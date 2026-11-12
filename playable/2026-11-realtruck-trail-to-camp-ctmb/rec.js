/* */
const Q = new URLSearchParams(location.search);
const TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
export let PERF = Q.get('perf') === '1';
export const setPerf = v => { PERF = v; };
export const REC = (() => {
  const session = Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  const N = 2048, ring = new Float32Array(N), scratch = new Float32Array(N);
  let n = 0, wStart = performance.now(), over25 = 0, over50 = 0, maxDt = 0, hiddenSeen = document.hidden;
  const events = [], hitchBuf = [], t0 = performance.now(), url = (new URLSearchParams(location.search).get('perfurl') || 'perf');
  const ev = (type, extra) => { if (events.length < 200) events.push({ t: +((performance.now() - t0) / 1000).toFixed(2), type, ...(extra || {}) }); };
  document.addEventListener('visibilitychange', () => { hiddenSeen = hiddenSeen || document.hidden; ev('visibility', { hidden: document.hidden }); });
  window.addEventListener('resize', () => ev('resize', { w: innerWidth, h: innerHeight }));
  const longtasks = [];
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) { ev('longtask', { ms: Math.round(e.duration) }); longtasks.push({ t: +((e.startTime) / 1000).toFixed(2), ms: Math.round(e.duration) }); } }).observe({ entryTypes: ['longtask'] }); } catch (e) { /* not supported */ }
  let gpu = '';
  const post = body => { if (!PERF) return; try { fetch(url, { method: 'POST', body: JSON.stringify(body), keepalive: true, mode: 'cors', headers: { 'Content-Type': 'text/plain' } }).catch(() => {}); } catch (e) { /* ignore */ } };
  const R = {
    session, ev, samples: [], ticks: 0, longtasks, loadStages: [],
    frame(dt) { if (n < N) ring[n++] = dt; if (dt > 25) over25++; if (dt > 50) over50++; if (dt > maxDt) maxDt = dt; },
    init(renderer) { try { const gl = renderer.getContext(), x = gl.getExtension('WEBGL_debug_renderer_info'); gpu = x ? gl.getParameter(x.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER); } catch (e) { gpu = ''; } renderer.domElement.addEventListener('webglcontextlost', () => ev('webglcontextlost')); },
    stage(name) { const ms = Math.round(performance.now() - t0); R.loadStages.push({ name, ms }); ev('load', { stage: name, ms }); },
    tick(now, ctx) {
      if (now - wStart < 2000 && R.samples.length) return;
      const k = n; scratch.set(ring.subarray(0, k)); const s = scratch.subarray(0, k); s.sort();
      let sum = 0; for (let i = 0; i < k; i++) sum += s[i];
      const info = ctx.renderer.info, mem = performance.memory;
      const sample = {
        session, t: +((now - t0) / 1000).toFixed(2), ua: navigator.userAgent, dpr: window.devicePixelRatio, renderScale: ctx.scale,
        css: [innerWidth, innerHeight], canvas: [ctx.renderer.domElement.width, ctx.renderer.domElement.height], gpu, deviceMemory: navigator.deviceMemory, cores: navigator.hardwareConcurrency,
        page: ctx.page || 'game', tier: ctx.tier, aa: ctx.aa, set: ctx.set, mode: ctx.mode, s: ctx.s, frames: k, ms: { mean: k ? +(sum / k).toFixed(2) : 0, median: k ? +s[k >> 1].toFixed(2) : 0, p95: k ? +s[Math.min(k - 1, Math.floor(k * 0.95))].toFixed(2) : 0, max: +maxDt.toFixed(1) }, over25, over50,
        gl: { calls: ctx.calls, tris: ctx.tris, geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs ? info.programs.length : 0 },
        heapMB: mem ? +(mem.usedJSHeapSize / 1048576).toFixed(1) : null, texMB: ctx.texMB, hidden: hiddenSeen || document.hidden, events: events.splice(0), game: 'trail-to-camp'
      };
      R.samples.push(sample); if (R.samples.length > 120) R.samples.shift(); R.ticks++;
      setTimeout(() => post(sample), 0);
      n = 0; over25 = 0; over50 = 0; maxDt = 0; hiddenSeen = document.hidden; wStart = now;
    }
  };
  window.__perf = R; return R;
})();
