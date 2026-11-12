/* Trail to Camp (06-game, rebased on the style test): the world is the style test's own page (sworld.js), the game is a layer on it
   (glayer.js), the rules are the grey prototype's module (rules.js, single source, synced). Order: the layer builds the trail exactly as
   the world will and lays the round on it, the world builds with the layer's hooks, then the core runs the game. */
import * as L from './rules.js';
/* step D (planner 00:2x IST): swerve thresholds for the rate steering (06-controls INTEGRATION section 0); values only, the rules' logic untouched */
Object.assign(L.CONFIG.swerve, { warn: 4.5, lose: 6, violent: 15, window: 0.38 });
import * as HUD from './hud2.js';
import * as AU from './au2.js';
import * as G from './glayer.js';
import { SEEDS } from './seeds.js';
import * as UIB from './uib.js';
import { shuffleLegs, fairFilter } from './fair.js';
import * as UI from './ui/ui-kit.js';
import { createControls, steerInput } from './ctl.next/controls.js';
/* the controls module (06-controls): touch stick, arrows / A / D, mouse drag -> one steering value x, as a lateral rate through the rules' key path */
const CTL = createControls({ hud: UI, getPhase: UIB.phase, target: document.body });
import { initBrand } from './brand.js';

const Q = RT.Q;
G.setCore(RT); G.prepare();
window.__L = L;
/* pace (owner): the frozen module's clock runs PACE times faster while driving (holds, builds and the finale keep the prototype's timing);
   ?pace=1.0..1.8, default 1.5, a slider under ?options=1 */
const QP = new URLSearchParams(location.search);
G.PACE.k = Math.max(1, Math.min(1.8, +(QP.get('pace') || 1) || 1));
/* gate 3's rack rotates per round within the session (planner 01:3x IST): a random start, then each of the three before any repeats;
   set after the rules' reset (which picks it per layout seed); a checkpoint retry does not reset, so it keeps its round's rack; ?rack= wins */
const RACK_ROT = { i: Math.floor(Math.random() * 3) };
function rackTurn() { if (QP.get('rack') || RT.mode !== 'play') return; L.GATES[2].opts[1] = L.RACKS[RACK_ROT.i % 3]; RACK_ROT.i++; }
const paceK = () => (L.S.hold || L.S.done ? 1 : G.PACE.k);
/* steering feel: the target line moves at most 1.2 x the world forward speed (the rules' critically damped spring then follows it with no
   overshoot), so the ute never moves more sideways than forwards on the scaled trail; input mapping unchanged (the rules' own) */
const LIM = { u: null };
function limitSteer(inp, dt) {
  if (!inp || inp.steerTo == null) { LIM.u = null; return inp; }
  const S = L.S; if (LIM.u == null) LIM.u = S.u; const vmax = Math.max(3, 1.2 * S.v * G.KS);
  LIM.u += Math.max(-vmax * dt, Math.min(vmax * dt, inp.steerTo - LIM.u)); return Object.assign({}, inp, { steerTo: LIM.u });
}
/* variety (owner): a vetted layout seed per round; a different one on PLAY AGAIN; ?seed= forces one */
let CUR_SEED = null;
/* a fresh random layout seed per round (owner 02:04 IST: not a fixed course); ?seed=N reproduces a round */
function pickSeed() { const f = +(QP.get('seed') || 0); if (f) return f; return 1 + Math.floor(Math.random() * 999999); }
window.__pace = G.PACE; window.__audio = AU.audioState; window.__limitSteer = limitSteer;
if (QP.get('options') === '1') { const d = document.createElement('div'); d.style.cssText = 'position:fixed;right:8px;bottom:120px;z-index:20;background:#000c;color:#fff;font:600 13px Roboto,sans-serif;padding:8px 10px;border:1px solid #FFC600'; d.innerHTML = 'Pace <b id="pcv"></b><br><input id="pcr" type="range" min="1" max="1.8" step="0.05" style="width:140px">'; document.body.appendChild(d); const r = d.querySelector('#pcr'), o = d.querySelector('#pcv'); r.value = G.PACE.k; o.textContent = G.PACE.k.toFixed(2); r.oninput = () => { G.PACE.k = +r.value; o.textContent = G.PACE.k.toFixed(2); }; }
window.__TC_GAME = {
  lean: new URLSearchParams(location.search).get('lean') !== '0', extraH: G.padFlat, trailEnd: 990, headingX: () => 0, roadYX: () => 0, reserved: G.reserved, brands: G.brands, skipPut: G.skipPut, terrainDone: G.terrainDone, onPut: G.onPut,
  extendWorld: G.extendWorld, farClear: () => true, extendFar: () => {}, skirtY: (x, z, y) => y, stationScale: 1,
  attach: G.attach, poseUte: G.hookPoseUte, pose: G.hookPose, camera: G.hookCamera, fx: G.hookFx, beforeRender: G.hookBeforeRender, afterRender: G.hookAfterRender
};
G.computeSigns();
await import('./sworld.js');
const TRACK = { choice_made: 'choose_product', unlock_progress: 'unlock_progress', code_unlocked: 'code_unlocked' };
const laneTop = () => { const u = document.getElementById('tc-ub'); return (u ? u.getBoundingClientRect().bottom : 120) + 64; };
const callBox = () => { const e = document.querySelectorAll('.rt-call:not(.cue)'); if (e.length) e[e.length - 1].classList.add('tc-box'); };
Object.assign(L.FX, {
  sfx: (...a) => AU.sfx(...a),
  callUte: (text, color) => { if (RT.sim) return; if (UIB.active()) return UIB.call(text); if (/FULL/i.test(text)) return; HUD.laneCall(String(text).replace(/<[^>]+>/g, ""), color, laneTop()); },
  callTop: (text, color) => { if (RT.sim || /^BANKED/.test(text)) return; if (UIB.active()) return UIB.call(text); if (/FULL/i.test(text)) return; HUD.laneCall(String(text).replace(/<[^>]+>/g, ""), color, laneTop()); },
  act: a => { if (RT.sim || RT.mode !== 'play' || UIB.active()) return; HUD.laneCall('ACT ' + a, '#FFC600', laneTop()); },
  plus: w => { if (RT.sim || RT.mode !== 'play') return; if (UIB.active()) return UIB.plus(w); const u = G.uteScreen(), d = document.createElement('div'); d.className = 'tc-plus'; d.textContent = '+' + w; d.style.left = (u.tx + (Math.random() - 0.5) * 50) + 'px'; d.style.top = (u.ty + 10) + 'px'; document.body.appendChild(d); setTimeout(() => d.remove(), 720); },
  cue() {}, live: () => !RT.sim, playing: () => !RT.sim && RT.mode === 'play', width: () => RT.W || 400,
  event(name, d) {
    if (name === 'feature_enter' || name === 'loose_lost') { const h = L.HZ[L.S.hzI]; if (h) HUD.setLossType(h.type); }
    if (name === 'fitted') AU.sfx('thump');
    if (name === 'swerve_warn') G.onSwerve('warn', d); if (name === 'swerve_lost') { G.onSwerve('lost', d); UIB.swerve(d && d.n); }
    if (TRACK[name] && L.FX.playing()) RT.track(TRACK[name], d);
  }
});
const GAME = {
  meta: { id: 'trail-to-camp', title: 'Trail to Camp', control: 'steer', renderer: 'three', idle: 3.2, parked: true, line: '', startLine: 'Trail to camp', startSub: '', startHtml: HUD.startHtml(), shopLabel: 'Shop Black Friday', kitStart: QP.get('ui') !== 'old' },
  CONFIG: Object.assign(L.CONFIG, { revealHold: 5.2 }), layers: [], reset: seed => { CUR_SEED = pickSeed(); let fr = null; for (let q = 0; q < 5; q++) { if (q) CUR_SEED = QP.get('seed') ? CUR_SEED + q : pickSeed(); shuffleLegs(L, CUR_SEED); L.LAYOUT.seed = CUR_SEED; L.reset(seed); fr = fairFilter(L); if (fr.n >= 10) break; } if (RT.mode === 'play') console.info('Trail to Camp round seed', CUR_SEED, '(?seed=' + CUR_SEED + ' reproduces it):', fr.n, 'obstacles', fr.types.join(' ')); window.__fair = fr; rackTurn(); G.flatten(); G.newLayout(); GAME.layout = CUR_SEED; window.__layoutSeed = CUR_SEED; }, status: L.status, bot: (k, dt) => L.bot(k, dt * paceK()), pointer: () => {}, retry: () => { L.retry(); G.flatten(); HUD.reset(); },
  revealWait: () => G.revealWait(), update(dt, inp) { const d = dt * paceK(); if (!RT._botKind) { CTL.update(dt); inp = Object.assign({}, inp, { steer: steerInput(CTL.x(), L.S.v, G.KS) }); } L.update(d, limitSteer(inp, d)); }, sheetHtml: st => HUD.sheetHtml(st),
  geometry: () => ({ length: L.CONFIG.length, gates: L.CONFIG.gateS, camp: L.CONFIG.campS, hazards: L.HZ.map(h => ({ type: h.type, s: [+h.s0.toFixed(1), +h.s1.toFixed(1)], free: h.free, full: !!h.full })) }),
  init: G.init, resize: G.resize, draw: G.draw, hint: G.hint, load: G.load, perf: G.perf, get state() { return L.S; }
};
Object.defineProperty(GAME, 'botKind', { get() { return RT._botKind; }, set(v) { RT._botKind = v; } });
/* the UI kit (07-ui) is the game's UI; ?ui=old keeps the interim DOM layer for comparison */
if (QP.get('ui') !== 'old') UIB.mount(RT, { finaleE: G.finaleE, tallyT0: () => G.TALLY_T0, finaleEnd: G.finaleEnd });
RT.run(GAME);
initBrand(() => fetch('assets/sets.json', { cache: 'no-store' }).then(r => r.json(), () => ({})));
