/* Trail to Camp v2 sound: synthesised WebAudio, one pentatonic palette (from the choice prototype). Two buses:
   - motion (engine, tyres on gravel, wind, dust, pickups, hits, losses): follows game time. On any pause or freeze (choice gate, build
     shot, hit-stop, fail and end sheets, attract) it fades to silence in about 0.25 s and every queued motion note is cancelled; it fades
     back in with the time ramp after a fit.
   - ui (the pop-up's found shimmer, card chimes, select and confirm, the build's ratchet and clunk, the unlock): plays while paused.
   The AudioContext suspends while the tab is hidden. Ramps use setTargetAtTime (no clicks). M toggles mute (kept in sessionStorage). */
const Q = new URLSearchParams(location.search);
const AU = { c: null, m: null, mo: null, ui: null, nb: null, engO: null, engO2: null, engF: null, engG: null, scrG: null, windG: null, queued: [], muted: false };
try { AU.muted = sessionStorage.getItem('tc-mute') === '1'; } catch (e) { /* ignore */ }
let modeFn = () => 'attract';
export const setModeFn = f => { modeFn = f; };
const UI_IDS = new Set(['cards', 'card', 'sel', 'choose', 'ratchet', 'clunk', 'code', 'unlock', 'tally', 'tallyBig', 'slat', 'gate', 'build', 'thump', 'found', 'flip']);
/* iOS: a one-sample silent buffer started inside the gesture marks the page as unlocked */
function unlockTick() { try { const c = AU.c, b = c.createBuffer(1, 1, 22050), src = c.createBufferSource(); src.buffer = b; src.connect(c.destination); src.start(0); if (c.state !== 'running') c.resume(); AU.unlocked = c.state === 'running' || AU.unlocked; } catch (e) { /* ignore */ } }
export function auInit() {
  if (Q.has('sim')) return;
  if (AU.c) { if ((AU.c.state === 'suspended' || AU.c.state === 'interrupted') && !document.hidden) AU.c.resume(); if (!AU.unlocked) unlockTick(); return; }
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
  try {
    const c = AU.c = new C(); AU.m = c.createGain(); AU.m.gain.value = AU.muted ? 0 : 0.6; AU.m.connect(c.destination);
    AU.mo = c.createGain(); AU.mo.gain.value = 0; AU.mo.connect(AU.m); AU.ui = c.createGain(); AU.ui.gain.value = 1; AU.ui.connect(AU.m);
    const nb = AU.nb = c.createBuffer(1, c.sampleRate, c.sampleRate), d = nb.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    AU.engO = c.createOscillator(); AU.engO.type = 'sawtooth'; AU.engO2 = c.createOscillator(); AU.engO2.type = 'square';
    AU.engF = c.createBiquadFilter(); AU.engF.type = 'lowpass'; AU.engF.frequency.value = 300; AU.engG = c.createGain(); AU.engG.gain.value = 0;
    const g2 = c.createGain(); g2.gain.value = 0.4; AU.engO.connect(AU.engF); AU.engO2.connect(g2); g2.connect(AU.engF); AU.engF.connect(AU.engG); AU.engG.connect(AU.mo);
    AU.engO.start(); AU.engO2.start(); unlockTick();
    /* no continuous tyre, gravel or wind noise loop (owner: the muffled sliding noise is gone); the engine hum is the only motion loop */
  } catch (e) { AU.c = null; }
}
if (!Q.has('sim')) {
  /* capture phase: the UI kit's buttons stop propagation, the gesture still reaches the audio unlock (PLAY, the first steering touch, any later tap) */
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) addEventListener(ev, auInit, true);
  document.addEventListener('visibilitychange', () => { if (!AU.c) return; if (document.hidden) AU.c.suspend(); else AU.c.resume(); });
  addEventListener('keydown', e => { if (e.key === 'm' || e.key === 'M') setMuted(!AU.muted); });
}
export function setMuted(m) { AU.muted = m; try { sessionStorage.setItem('tc-mute', m ? '1' : '0'); } catch (e) { /* ignore */ } if (AU.c) AU.m.gain.setTargetAtTime(m ? 0 : 0.6, AU.c.currentTime, 0.05); }
export const isMuted = () => AU.muted;
const live = () => AU.c && modeFn() !== 'attract';
function track(node, t1, bus) { if (bus === AU.mo) { AU.queued.push({ node, t1 }); if (AU.queued.length > 80) AU.queued.splice(0, AU.queued.length - 80); } }
function tone(f, d, type, vol, f2, delay, bus) {
  const c = AU.c, t = c.currentTime + (delay || 0), o = c.createOscillator(), g = c.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g); g.connect(bus); o.start(t); o.stop(t + d + 0.03); track(o, t + d, bus);
}
function noise(d, vol, type, f0, f1, delay, q, bus) {
  const c = AU.c, t = c.currentTime + (delay || 0), n = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  n.buffer = AU.nb; f.type = type; f.frequency.setValueAtTime(f0, t); if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + d); if (q) f.Q.value = q;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  n.connect(f); f.connect(g); g.connect(bus); n.start(t, Math.random() * 0.5); n.stop(t + d + 0.03); track(n, t + d, bus);
}
function pad(f, d, vol, bus) { const c = AU.c, t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); g.connect(bus); o.start(t); o.stop(t + d + 0.05); }
const PENT = [0, 2, 4, 7, 9];
const note = n => 523.25 * Math.pow(2, (PENT[((n % 5) + 5) % 5] + 12 * Math.floor(n / 5)) / 12);
/* cancel queued motion notes (scheduled in the future) when the world freezes */
function cancelQueued() { if (!AU.c) return; const now = AU.c.currentTime; for (const q of AU.queued) { try { if (q.t1 > now + 0.02) q.node.stop(now + 0.02); } catch (e) { /* already stopped */ } } AU.queued.length = 0; }
export function sfx(id, a) {
  if (!live()) return;
  const bus = UI_IDS.has(id) ? AU.ui : AU.mo;
  if (bus === AU.mo && AU.frozen) return;
  const T = (f, d, ty, v, f2, dl) => tone(f, d, ty, v, f2, dl, bus), N = (d, v, ty, f0, f1, dl, q) => noise(d, v, ty, f0, f1, dl, q, bus);
  try {
    if (id === 'pick') { const f = note(Math.min(a || 0, 14)); T(f, 0.16, 'triangle', 0.2); T(f * 2, 0.07, 'sine', 0.05); }
    else if (id === 'thud') { T(150, 0.13, 'sine', 0.28, 55); N(0.07, 0.07, 'lowpass', 600, 200); }
    else if (id === 'hit') { N(0.38, 0.5, 'lowpass', 1500, 120); T(85, 0.32, 'sine', 0.45, 38); }
    else if (id === 'lost') { for (let i = 0; i < Math.min(a || 1, 5); i++) T(note(4 - i) / 2, 0.15, 'triangle', 0.14, null, 0.05 + i * 0.08); }
    else if (id === 'whoosh') { N(0.36, 0.26, 'bandpass', 450, 2600, 0, 1.2); }
    else if (id === 'clunk') { T(72, 0.14, 'square', 0.16, 42); N(0.09, 0.3, 'lowpass', 900, 180); }
    else if (id === 'bump') { N(0.14, 0.22, 'lowpass', 700, 140); T(78, 0.12, 'sine', 0.24, 48); }
    else if (id === 'mult') { T(note(5 + a), 0.12, 'square', 0.06); T(note(7 + a), 0.16, 'square', 0.06, null, 0.07); }
    else if (id === 'code') { [0, 2, 4].forEach((n, i) => T(note(8 + (a || 0) * 2 + n), 0.22, 'sine', 0.13, null, i * 0.06)); }
    else if (id === 'gate') { N(0.5, 0.18, 'lowpass', 2400, 300); }
    else if (id === 'found' || id === 'cards') { N(0.6, 0.1, 'bandpass', 1200, 5200, 0, 2.2); pad(note(0) / 2, 1.8, 0.06, bus); pad(note(3) / 2, 1.8, 0.045, bus); pad(note(5), 1.5, 0.03, bus); [12, 14, 16].forEach((n, i) => T(note(n), 0.4, 'sine', 0.035, null, 0.15 + i * 0.09)); }
    else if (id === 'card') { [0, 4, 7].forEach((n, i) => T(note(7 + (a || 0) * 2 + n), 0.3, 'sine', 0.1, null, i * 0.05)); }
    else if (id === 'sel') { T(note(9), 0.08, 'triangle', 0.12); T(note(14), 0.12, 'sine', 0.05, null, 0.03); }
    else if (id === 'flip') { N(0.12, 0.08, 'bandpass', 900, 2400, 0, 1.4); }
    else if (id === 'choose') { T(1400, 0.04, 'square', 0.07); [5, 7, 9, 12].forEach((n, i) => T(note(n), 0.35, 'sine', 0.13, null, 0.04 + i * 0.05)); }
    else if (id === 'tick' || id === 'resume') { /* no countdown in the game (owner): the engine fades back in with the time ramp instead */ }
    else if (id === 'ratchet') { for (let i = 0; i < 3; i++) T(1600 + (a || 0) * 120, 0.018, 'square', 0.06, null, i * 0.035); T(note(5 + (a || 0)), 0.12, 'triangle', 0.08, null, 0.1); }
    else if (id === 'thump') { T(64, 0.22, 'sine', 0.3, 40); N(0.16, 0.25, 'lowpass', 800, 160); }
    else if (id === 'shield' || id === 'shut') { for (let i = 0; i < 6; i++) T(180 + i * 30, 0.05, 'square', 0.06, null, i * 0.04); }
    else if (id === 'bonus') { [0, 2, 4, 5, 7].forEach((n, i) => T(note(5 + n), 0.14, 'triangle', 0.12, null, i * 0.045)); }
    else if (id === 'jump') { T(note(7), 0.3, 'square', 0.07, note(12)); }
    else if (id === 'splash') { N(0.5, 0.35, 'bandpass', 1800, 500, 0, 0.8); N(0.25, 0.2, 'highpass', 3000); }
    else if (id === 'strap') { T(120, 0.12, 'square', 0.12, 60); N(0.18, 0.25, 'lowpass', 1200, 200); [0, 4, 7].forEach((n, i) => T(note(5 + n), 0.2, 'triangle', 0.1, null, 0.08 + i * 0.05)); }
    else if (id === 'slat') { T(90 + (a || 0) * 6, 0.07, 'square', 0.12, 50); N(0.05, 0.14, 'lowpass', 900, 300); }
    /* the finale count (prototype): a short bright note per piece rising with the count, a fuller chord for heavy and big items */
    else if (id === 'tally') { const f = note(Math.min(a || 0, 18)); T(f, 0.09, 'triangle', 0.17); T(f * 2, 0.05, 'sine', 0.05); }
    else if (id === 'tallyBig') { const n0 = Math.min(a || 0, 16); [0, 2, 4].forEach((k, i) => T(note(n0 + k), 0.18, 'triangle', 0.12, null, i * 0.018)); T(note(n0) / 2, 0.22, 'sine', 0.14); }
    else if (id === 'unlock') { T(note(10), 0.08, 'square', 0.1); [0, 2, 4, 7, 9, 12].forEach((n, i) => { T(note(10 + n), 0.45, 'sine', 0.14, null, 0.1 + i * 0.06); T(note(10 + n) * 2, 0.25, 'sine', 0.04, null, 0.1 + i * 0.06); }); }
    else if (id === 'full') { T(note(2), 0.1, 'square', 0.05); }
  } catch (e) { /* ignore */ }
}
/* every frame: motion loops follow game time (scale 0..1); frozen = a gate, the build shot, a hit-stop or the sheets */
export function audioFrame(st) {
  if (!AU.c) return;
  const c = AU.c, t = c.currentTime, mode = modeFn(), frozen = st.frozen || !(mode === 'play' || mode === 'reveal'), k = frozen ? 0 : Math.max(0, Math.min(1, st.scale));
  if (frozen && !AU.frozen) { AU.frozen = true; cancelQueued(); }
  else if (!frozen && AU.frozen && k > 0.02) AU.frozen = false;
  AU.mo.gain.setTargetAtTime(k, t, frozen ? 0.07 : 0.12);
  const v = st.v, vk = st.vk, sc = 0.4 + 0.6 * k;
  AU.engO.frequency.setTargetAtTime((38 + v * 3.4 + st.kick * 10) * sc, t, 0.08); AU.engO2.frequency.setTargetAtTime((19 + v * 1.7) * sc, t, 0.08);
  AU.engF.frequency.setTargetAtTime(220 + v * 28 * sc, t, 0.1);
  AU.engG.gain.setTargetAtTime((0.035 + 0.03 * vk) * (mode === 'reveal' ? Math.min(1, vk * 1.5) : 1), t, 0.12);
}
export const audioState = () => (AU.c ? AU.c.state : 'none');
