/* Don't Pop It — shared game core for every greybox variant (rules, CONFIG, state, input, HUD, cards, bots, sim,
   layer contract). A variant supplies a VIEW: its layers (shape + blueprint), its geometry (the field the spots live in,
   the spot and gel sizes) and drawFrame.
   Hooks: ?bot (autopilot plays a real round) · ?sim (20 instant rounds) · ?sim&human (first-timer bot)
          ?attract (plays itself, used by the control panel) · ?blueprint=Lx · ?explained=Lx · ?geometry · ?card=win|fail
   window.GAME = { S, CONFIG, reset, press, move, release }
   The rule: glide the gel over every spot to calm it. Never press one: a finger that rests on a spot pops it, the mark
   stays and two new spots rise beside it (the bacteria spread). Calm twelve before the skin is overrun. */
(function () {
  const Q = new URLSearchParams(location.search);
  const has = k => Q.has(k);
  const CONFIG = {
    ctaUrl: 'https://www.benzac.com.au/',      // placeholder until the client names the door (Acne Advice / Find in Store); window.clickTag overrides
    roundSecs: 15, calmToWin: 10, overrunAt: 6, // the line: six swollen spots at once and the skin is overrun
    leadIn: 0.8,                                // nothing rises before this: the skin is shown calm first (rule 16)
    interval: [1.2, 1.0, 1.35, 1.15],           // seconds between rises, by stage (calmed 0-2, 3-5, 6-8, 9+): with the bursts, one spot every 1.2 → 0.58 s
    burst: [1, 1, 2, 2],                        // spots per rise, by stage: by the last stage they come two at a time
    swellSecs: 1.4,                             // a spot takes this long to reach full size; it can be calmed from the start
    calmSecs: 0.4,                              // seconds of gliding contact that calm one spot
    pressSecs: 0.3, minSpeed: 0.08,             // a finger slower than minSpeed (frame widths / s) is resting; resting on a spot for pressSecs pops it
    spreadOnPop: 2, spreadDist: [0.10, 0.16],   // a pop raises two new spots this far away (frame widths)
    tipFollow: 16, idleToAttract: 3,
    copy: {
      brand: 'BENZAC', hint: 'Glide the gel. Never press.', leadInHint: 'Here they come',
      cueFirst: 'Glide over a spot to calm it', cuePop: 'Pressing spreads the bacteria: two more',
      popCalm: 'CALM', popPop: 'POPPED  +2',
      startTitle: 'No one wants it. Hit back.', startLine: 'Glide the gel over every spot. Never press one.', play: 'Play',
      winStamp: 'HANDS OFF', winTitle: 'Bacteria causes acne.', winLine: 'Hit back.', cta: 'Acne Advice ›',
      failStamp: 'CYCLE WINS', failLine: 'Glide, never press. Again?',
      failWhy: { popped: 'You pressed {p} and they spread.', overrun: 'The skin was overrun.', time: 'Time ran out with {n} spots still swollen.' },
      again: 'Again', calmed: 'Calmed', pops: 'Pops',
    },
  };
  const BOT = has('bot') || has('attract'), HUMAN = has('human'), SIM = has('sim'), ATTRACT = has('attract');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const dist = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * 1.5);   // frame widths (the frame is 2:3, so a height fraction is 1.5 widths)
  const stageOf = () => S.calmed < 3 ? 0 : S.calmed < 6 ? 1 : S.calmed < 9 ? 2 : 3;
  let G = null;   // the view's geometry: field, spotR, tipR

  let S;
  function reset(mode) {
    S = { mode, elapsed: 0, timeLeft: CONFIG.roundSecs, spots: [], marks: [], trail: [], calmed: 0, popped: 0, nextSpawn: CONFIG.leadIn,
      tip: { x: 0.5, y: 0.62 }, want: { x: 0.5, y: 0.62 }, lastTip: { x: 0.5, y: 0.62 }, down: false, restT: 0, speed: 0, popAt: { x: 0.5, y: 0.5 },
      pops: [], flash: 0, red: 0, shake: 0, why: null, reveal: 0, idle: 0, cue: null, seen: {}, nextId: 1, bot: {} };
  }
  const live = () => S.spots.filter(s => s.state === 'live');
  function inField(p) { const f = G.field; if (f.avoid && f.avoid.some(a => dist(p, a) < a.r)) return false; if (f.shape === 'ellipse') { const cx = f.x + f.w / 2, cy = f.y + f.h / 2; return ((p.x - cx) / (f.w / 2)) ** 2 + ((p.y - cy) / (f.h / 2)) ** 2 <= 1; } return p.x >= f.x && p.x <= f.x + f.w && p.y >= f.y && p.y <= f.y + f.h; }
  function spawnPoint(near) {   // a spot rises where there is room: inside the field, clear of other spots and of the finger
    const f = G.field; let best = null, bestD = -1;
    for (let i = 0; i < 40; i++) {
      let p; if (near) { const a = rand(0, 6.283), d = rand(CONFIG.spreadDist[0], CONFIG.spreadDist[1]); p = { x: near.x + Math.cos(a) * d, y: near.y + Math.sin(a) * d / 1.5 }; }
      else p = { x: rand(f.x, f.x + f.w), y: rand(f.y, f.y + f.h) };
      if (!inField(p)) continue;
      const dmin = Math.min(...S.spots.filter(s => s.state !== 'calm').map(s => dist(p, s)), near ? 9 : dist(p, S.tip) * 0.9, 9);
      if (dmin > bestD) { bestD = dmin; best = p; }
      if (dmin > G.spotR * 2.6) break;
    }
    return best;
  }
  function spawn(near) {
    const p = spawnPoint(near); if (!p) return;
    S.spots.push({ id: S.nextId++, x: p.x, y: p.y, born: S.elapsed, swell: near ? 0.25 : 0, calm: 0, state: 'live', t: 0, ph: rand(0, 6.283) });
  }
  // ── input: one control, the glide. press/move/release in frame fractions ────────
  function press(p, src) { if (S.mode !== 'play' && S.mode !== 'attract') return; S.down = true; S.want = { ...p }; S.tip = { ...p }; S.lastTip = { ...p }; S.restT = 0; S.idle = 0; if (src === 'user') SFX.unlock(); }
  function move(p) { if (!S.down) return; S.want = { x: clamp(p.x, 0, 1), y: clamp(p.y, 0, 1) }; S.idle = 0; }
  function release() { S.down = false; S.restT = 0; }
  function pop(s) {   // the mistake: the spot bursts, the mark stays, two more rise beside it
    s.state = 'popped'; S.marks.push({ x: s.x, y: s.y, t: 0 }); S.popped++; S.popAt = { x: s.x, y: s.y };
    S.red = 1; S.shake = .7; S.restT = 0; S.pops.push({ t: 0, txt: CONFIG.copy.popPop, big: true, bad: true }); if (!SIM) SFX.pop();
    for (let i = 0; i < CONFIG.spreadOnPop; i++) spawn(s);
    if (!S.seen.pop) { S.seen.pop = true; S.cue = { text: CONFIG.copy.cuePop, until: S.elapsed + 2.0 }; }
  }
  function calm(s) { s.state = 'calm'; s.t = 0; S.calmed++; S.popAt = { x: s.x, y: s.y }; S.flash = 1; S.pops.push({ t: 0, txt: CONFIG.copy.popCalm }); if (!SIM) SFX.calm(); if (S.calmed >= CONFIG.calmToWin) finish('win'); }
  function finish(result, why) {
    const wasAttract = S.mode === 'attract';
    if (wasAttract) { reset('attract'); return; }   // the splash loop: the skin keeps being calmed behind the start card
    S.mode = result === 'win' ? 'reveal' : 'fail'; S.why = why || null; S.reveal = 0; S.down = false;
    if (!SIM) { if (result === 'win') { SFX.win(); hideHud(true); setTimeout(() => showCard('win'), 1100); } else { SFX.fail(); hideHud(true); setTimeout(() => showCard('fail'), 800); } }
  }
  function update(dt) {
    if (S.mode === 'reveal') { S.reveal += dt; if (S.reveal > 1.0) S.mode = 'win'; }
    if (S.mode === 'play' || S.mode === 'attract') {
      S.elapsed += dt; S.timeLeft = Math.max(0, CONFIG.roundSecs - S.elapsed); S.idle += dt;
      if (S.elapsed >= S.nextSpawn && S.elapsed <= CONFIG.roundSecs - 0.3) { const st = stageOf(); for (let i = 0; i < CONFIG.burst[st]; i++) spawn(null); S.nextSpawn = S.elapsed + CONFIG.interval[st]; }
      if (!S.seen.cue && S.elapsed > CONFIG.leadIn) { S.seen.cue = true; S.cue = { text: CONFIG.copy.cueFirst, until: S.elapsed + 1.6 }; }
      // the gel tip follows the finger; its speed decides whether it glides (calms) or rests (pops)
      S.tip.x += (S.want.x - S.tip.x) * Math.min(1, dt * CONFIG.tipFollow); S.tip.y += (S.want.y - S.tip.y) * Math.min(1, dt * CONFIG.tipFollow);
      S.speed = dist(S.tip, S.lastTip) / dt; S.lastTip = { ...S.tip };
      if (S.down) {
        const moving = S.speed >= CONFIG.minSpeed; S.restT = moving ? 0 : S.restT + dt;
        if (moving) { S.trail.push({ x: S.tip.x, y: S.tip.y, t: 0 }); if (S.trail.length > 48) S.trail.shift(); }
        const over = live().filter(s => dist(S.tip, s) < G.spotR * (0.5 + 0.5 * s.swell) + G.tipR * 0.6);
        if (!moving && S.restT >= CONFIG.pressSecs && over.length) pop(over[0]);
        else if (moving) over.forEach(s => { s.calm += dt / CONFIG.calmSecs; if (s.calm >= 1 && s.state === 'live') calm(s); });
      } else S.restT = 0;
      S.spots.forEach(s => { s.swell = Math.min(1, s.swell + dt / CONFIG.swellSecs); if (s.state !== 'live') s.t += dt; });
      S.spots = S.spots.filter(s => s.state === 'live' || s.t < 0.6);
      if (S.mode === 'play' || S.mode === 'attract') {
        if (live().length >= CONFIG.overrunAt) return finish('fail', S.popped ? 'popped' : 'overrun');
        if (S.timeLeft <= 0) return finish('fail', 'time');
      }
    }
    S.marks.forEach(m => m.t += dt); S.trail.forEach(p => p.t += dt); S.trail = S.trail.filter(p => p.t < 0.9);
    S.flash = Math.max(0, S.flash - dt * 4); S.red = Math.max(0, S.red - dt * 2.5); S.shake = Math.max(0, S.shake - dt * 6);
    S.pops.forEach(p => p.t += dt); S.pops = S.pops.filter(p => p.t < (p.big ? 1.1 : 0.7));
  }

  // ── autopilot ───────────────────────────────────────────
  // perfect bot: goes to the nearest spot and circles over it until it calms; never rests. First-timer bot: sees a spot 0.3–0.6 s
  // after it rises, moves at half the speed, pauses between spots, and on one spot in ten rests its finger long enough to pop it.
  function autopilot(dt) {
    const B = S.bot; S.down = true;
    const ls = live(); if (!ls.length) { B.target = null; return; }
    if (B.target && B.target.state !== 'live') { B.target = null; B.pause = HUMAN ? rand(0.1, 0.26) : 0; }
    if (B.pause > 0) { B.pause -= dt; S.want = { ...S.tip }; return; }   // a short hesitation between spots (below pressSecs: no pop)
    if (!B.target) { const seen = HUMAN ? ls.filter(s => S.elapsed - s.born > (s.react == null ? (s.react = rand(0.25, 0.5)) : s.react)) : ls; if (!seen.length) { S.want = { ...S.tip }; return; }
      B.target = seen.sort((a, b) => dist(S.tip, a) - dist(S.tip, b))[0]; B.ang = rand(0, 6.283); B.rest = HUMAN && Math.random() < 1 / 10; B.arrived = false; }
    const T = B.target, maxV = HUMAN ? 1.15 : 1.8, orbitR = G.spotR * 0.45, orbitSpeed = HUMAN ? 0.26 : 0.4;
    let want; const d = dist(S.tip, T);
    if (d < orbitR * 1.3 || B.arrived) { B.arrived = true; if (B.rest) { want = { ...S.tip }; } else { B.ang += dt * orbitSpeed / orbitR; want = { x: T.x + Math.cos(B.ang) * orbitR, y: T.y + Math.sin(B.ang) * orbitR / 1.5 }; } }
    else want = { x: T.x, y: T.y };
    const dx = want.x - S.want.x, dy = (want.y - S.want.y) * 1.5, L = Math.hypot(dx, dy), step = Math.min(L, maxV * dt);
    if (L > 1e-6) S.want = { x: S.want.x + dx / L * step, y: S.want.y + dy / L * step / 1.5 };
  }
  // ── sim ─────────────────────────────────────────────────
  function runSim() {
    const out = [];
    const N = +(Q.get('n') || 20);   // ?n=60 for a steadier band
    for (let r = 0; r < N; r++) {
      reset('play'); let n = 0;
      while (S.mode === 'play') { autopilot(1 / 60); update(1 / 60); if (++n > 60 * 30) break; }
      out.push(`${S.mode === 'reveal' || S.mode === 'win' ? 'win ' : 'fail'} t=${S.elapsed.toFixed(1)} calmed=${S.calmed} popped=${S.popped} live=${live().length} why=${S.why || '-'}`);
    }
    const wins = out.filter(l => l.startsWith('win')).length;
    document.title = 'SIM'; document.body.innerHTML = `<pre id="sim">${HUMAN ? 'human bot' : 'perfect bot'}: ${wins}/${N} wins\n${out.join('\n')}</pre>`;
    throw new Error('sim done');
  }
  // ── layer contract: blueprint / explained / geometry ────
  function layerRoutes(VIEW) {
    const bp = Q.get('blueprint') || Q.get('explained');
    if (bp) {
      const L = VIEW.layers.find(l => l.id === bp); if (!L) { document.body.innerHTML = 'no layer ' + bp; throw new Error('no layer'); }
      const c = document.createElement('canvas'); c.width = L.canvas[0]; c.height = L.canvas[1]; c.style.cssText = 'max-width:100%;height:auto;display:block;background:#4A5A7A';
      document.body.innerHTML = ''; document.body.style.cssText = 'margin:0;background:#222'; document.body.appendChild(c);
      const ctx = c.getContext('2d'); const o = { explain: has('explained'), key: L.key, cell: +(Q.get('cell') || 0) }; window.LAYERS.blueprint(ctx, L, c.width, c.height, o);
      document.title = `${L.id} ${L.name} ${has('explained') ? 'explained' : 'blueprint'}`; throw new Error('blueprint rendered');
    }
    if (has('geometry')) {
      document.body.innerHTML = `<pre id="geometry">${JSON.stringify({ variant: VIEW.id, canvas: VIEW.canvas, format: 'playable', key: '#4A5A7A', camera: VIEW.camera || null, geometry: VIEW.geometry(), layers: VIEW.layers.map(l => ({ id: l.id, name: l.name, type: l.type, canvas: l.canvas, key: l.key, box: l.box || null, cells: l.cells || null, states: l.states || false, camera: l.camera || null, notes: l.notes })) }, null, 2)}</pre>`;
      document.title = 'GEOMETRY'; throw new Error('geometry printed');
    }
  }
  // ── DOM: HUD, cards ─────────────────────────────────────
  const CSS = `
  html,body{margin:0;height:100%;background:#000;font-family:Inter,system-ui,sans-serif;-webkit-user-select:none;user-select:none}
  .frame{--accent:#1F5FBF;--ink:#13233d;--red:#d8432f;position:relative;width:min(100vw,calc(100dvh*2/3));aspect-ratio:2/3;margin:0 auto;overflow:hidden;background:#2a2a2e;container-type:inline-size;touch-action:none}
  canvas#game{position:absolute;inset:0;width:100%;height:100%;display:block}
  .hud{position:absolute;inset:0;pointer-events:none;color:#fff;font-weight:700}
  .top{position:absolute;left:3cqw;right:3cqw;top:3cqw;display:flex;justify-content:space-between;align-items:flex-start;font-size:3.6cqw}
  .pill{background:#fff;border-radius:999px;padding:1.4cqw 3.2cqw;color:var(--ink);box-shadow:0 .6cqw 1.6cqw rgba(0,0,0,.18)}
  .pill.bump{animation:bump .28s cubic-bezier(.2,1.6,.4,1)}@keyframes bump{0%{transform:scale(1)}40%{transform:scale(1.22)}100%{transform:scale(1)}}
  .brandmark{position:absolute;left:50%;top:3.4cqw;transform:translateX(-50%);height:7cqw;display:flex;align-items:center;justify-content:center;font-size:3cqw;font-weight:900;letter-spacing:.14em;color:var(--ink);border:1px dashed rgba(19,35,61,.45);border-radius:1.5cqw;padding:0 3cqw;background:rgba(255,255,255,.5)}
  .flare{position:absolute;left:50%;bottom:4cqw;transform:translateX(-50%);display:flex;gap:1.6cqw;align-items:center;background:rgba(255,255,255,.85);border-radius:999px;padding:1.2cqw 2.6cqw}
  .flare i{display:block;width:3cqw;height:3cqw;border-radius:50%;background:#dcdce2;transition:background .15s}
  .flare i.on{background:var(--red)}.flare i.last{outline:.4cqw solid var(--red);outline-offset:.3cqw}
  .flare b{font-size:2.6cqw;color:var(--ink);margin-right:1cqw;letter-spacing:.06em}
  .hint{position:absolute;left:50%;top:13.5cqw;transform:translateX(-50%);font-size:3.4cqw;background:var(--accent);color:#fff;border-radius:999px;padding:1.6cqw 4.4cqw;white-space:nowrap;box-shadow:0 .6cqw 1.6cqw rgba(0,0,0,.22);transition:opacity .25s}
  .hint.cue{background:#fff;color:var(--ink)}
  .card{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding:0 8cqw 9cqw;text-align:center;background:linear-gradient(180deg,rgba(255,255,255,0) 35%,rgba(255,255,255,.92) 62%)}
  .card[hidden]{display:none}
  .frame:has(.card:not([hidden])) .top,.frame:has(.card:not([hidden])) .hint,.frame:has(.card:not([hidden])) .flare,.frame:has(.card:not([hidden])) .greylabel{display:none}
  .card .stamp{font-size:10cqw;line-height:1;font-weight:900;letter-spacing:.04em;color:var(--accent);border:1.1cqw solid var(--accent);border-radius:2cqw;padding:1.6cqw 4cqw;transform:rotate(-6deg);animation:stamp .35s cubic-bezier(.2,1.4,.3,1) both;margin-bottom:5cqw}
  .card .stamp.bad{color:var(--red);border-color:var(--red)}
  @keyframes stamp{0%{transform:rotate(-6deg) scale(1.8);opacity:0}100%{transform:rotate(-6deg) scale(1);opacity:1}}
  .card h1{font-size:8.2cqw;line-height:1.05;margin:0;font-weight:900;color:var(--ink)}
  .card p{font-size:3.8cqw;line-height:1.35;margin:2cqw 0 0;color:var(--ink);font-weight:600}
  .card .stat{display:inline-block;margin-top:3cqw;font-size:3.2cqw;font-weight:800;color:var(--ink);background:#fff;border:1px solid #d2d2d7;border-radius:999px;padding:1.4cqw 4cqw}
  .card .btn{font:inherit;font-weight:800;font-size:4.6cqw;min-height:12cqw;padding:2.6cqw 10cqw;margin-top:5cqw;border-radius:999px;border:0;background:var(--accent);color:#fff;cursor:pointer;box-shadow:0 1cqw 2.4cqw rgba(31,95,191,.35);animation:breathe 2.2s ease-in-out 1s infinite}
  .card .btn.ghost{background:transparent;color:var(--ink);box-shadow:none;animation:none;font-size:3.2cqw;min-height:6cqw;padding:1cqw 3cqw;margin-top:1.6cqw;text-decoration:underline}
  @keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
  .card .hand{width:16cqw;height:16cqw;margin:0 0 3cqw;animation:glide 1.8s ease-in-out infinite}
  @keyframes glide{0%,100%{transform:translateX(-30%) rotate(-8deg)}50%{transform:translateX(30%) rotate(8deg)}}
  .card .lockup{font-size:3cqw;font-weight:900;letter-spacing:.14em;color:var(--ink);border:1px dashed rgba(19,35,61,.45);border-radius:1.5cqw;padding:1.4cqw 3cqw;margin-bottom:4cqw}
  .brandmark.plain,.card .lockup.plain{border:0;background:none;font-size:4.2cqw;letter-spacing:.18em}   /* build: a plain wordmark until the kit's logo arrives (never a guessed colour) */
  .brandmark img{height:100%;width:auto;display:block}.card .lockup img{height:7cqw;width:auto;display:block}
  .loader{position:absolute;inset:0;z-index:9;display:flex;align-items:center;justify-content:center;background:#f3ece8;transition:opacity .45s ease}
  .loader.done{opacity:0;pointer-events:none}.loader[hidden]{display:none}
  .loader .bar{width:38cqw;height:1.4cqw;border-radius:1cqw;background:rgba(19,35,61,.12);overflow:hidden}.loader .bar i{display:block;height:100%;width:0;background:var(--accent);border-radius:1cqw;transition:width .25s ease}
  .frame.loading canvas#game,.frame.loading .hud,.frame.loading .card{visibility:hidden}
  .greylabel{position:absolute;right:2cqw;bottom:11.5cqw;font-size:2.4cqw;color:rgba(19,35,61,.55);font-weight:700;letter-spacing:.08em}
  .frame.revealing .top,.frame.revealing .hint,.frame.revealing .flare{opacity:0;transition:opacity .3s}
  html.embed,html.embed body{background:#000;overflow:hidden;height:100%}html.embed body{display:flex;align-items:center;justify-content:center}html.embed .frame{width:min(100vw,calc(100vh * 2 / 3));height:min(100vh,calc(100vw * 3 / 2));aspect-ratio:auto;margin:0}
  @media (min-aspect-ratio:131/200) and (max-aspect-ratio:17/25){html.embed .frame{width:100vw;height:100vh}}
  `;
  const FX = { sm: -1, pm: -1 };
  const SFX = (() => {
    let ac = null, muted = false;
    const ctx = () => { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } } if (ac && ac.state === 'suspended') ac.resume(); return ac; };
    function tone(f, t, dur, type, g, slide) { const a = ctx(); if (!a || muted) return; const o = a.createOscillator(), v = a.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur); v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g || .25, t + .005); v.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(v).connect(a.destination); o.start(t); o.stop(t + dur + .02); }
    function noise(t, dur, g, lp) { const a = ctx(); if (!a || muted) return; const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const src = a.createBufferSource(); src.buffer = b; const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 1200; const v = a.createGain(); v.gain.value = g || .3; src.connect(f).connect(v).connect(a.destination); src.start(t); }
    const now = () => (ctx() ? ac.currentTime : 0);
    return { unlock() { ctx(); }, get muted() { return muted; }, set muted(v) { muted = v; },
      calm() { const t = now(); tone(740, t, .1, 'sine', .16); tone(1100, t + .06, .16, 'sine', .14); },
      pop() { const t = now(); noise(t, .16, .45, 1800); tone(140, t, .22, 'sawtooth', .16, -70); },
      win() { const t = now(); [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * .11, .3, 'triangle', .18)); },
      fail() { const t = now(); tone(300, t, .25, 'sawtooth', .1, -110); tone(200, t + .22, .4, 'sawtooth', .1, -90); } };
  })();
  function mount(VIEW) {
    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    if (!document.querySelector('link[href*="Inter"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@600;700;800;900&display=swap'; document.head.appendChild(l); }
    const mark = VIEW.brandLogo ? `<img src="${VIEW.brandLogo}" alt="${CONFIG.copy.brand}">` : CONFIG.copy.brand;   // the kit's logo when the build has one; the wordmark otherwise
    const C = CONFIG.copy, dots = Array.from({ length: CONFIG.overrunAt }, (_, i) => `<i class="${i === CONFIG.overrunAt - 1 ? 'last' : ''}"></i>`).join('');
    document.body.innerHTML = `
    <div class="${VIEW.build ? 'frame loading' : 'frame'}" id="frame">
      <canvas id="game"></canvas>
      <div class="hud">
        <div class="top"><span class="pill" id="count">${C.calmed} 0/${CONFIG.calmToWin}</span><span class="pill" id="timer">${CONFIG.roundSecs.toFixed(1)}</span></div>
        <div class="brandmark${VIEW.build ? ' plain' : ''}">${mark}</div>
        <div class="hint" id="hint">${C.hint}</div>
        <div class="flare" id="flare"><b>BREAKOUT</b>${dots}</div>
        ${VIEW.build ? '' : `<div class="greylabel">GREYBOX · ${VIEW.title.toUpperCase()}</div>`}
      </div>
      ${VIEW.build ? '<div class="loader" id="loader" role="progressbar"><div class="bar"><i id="loadBar"></i></div></div>' : ''}
      <div class="card start" id="startCard"><div class="lockup${VIEW.build ? ' plain' : ''}">${mark}</div><h1>${C.startTitle}</h1><p>${C.startLine}</p>
        <svg class="hand" viewBox="0 0 100 100" aria-hidden="true"><path d="M42 92 V48 a8 8 0 0 1 16 0 v18 M58 60 a7 7 0 0 1 14 0 v10 M72 68 a6 6 0 0 1 12 0 v12 M42 70 a7 7 0 0 0 -14 0 v14" fill="none" stroke="#13233d" stroke-width="5" stroke-linecap="round"/><circle cx="50" cy="38" r="9" fill="#1F5FBF" opacity=".55"/></svg>
        <button class="btn" id="playBtn" type="button">${C.play}</button></div>
      <div class="card" id="winCard" hidden><div class="stamp">${C.winStamp}</div><h1>${C.winTitle}</h1><p>${C.winLine}</p><div class="stat" id="winStat"></div>
        <button class="btn" id="cta1" type="button">${C.cta}</button><button class="btn ghost" id="again1" type="button">${C.again}</button></div>
      <div class="card" id="failCard" hidden><div class="stamp bad">${C.failStamp}</div><h1 id="failWhy"></h1><p>${C.failLine}</p><div class="stat" id="failStat"></div>
        <button class="btn" id="again2" type="button">${C.again}</button><button class="btn ghost" id="cta2" type="button">${C.cta}</button></div>
    </div>`;
    const $ = id => document.getElementById(id);
    const canvas = $('game'), ctx = canvas.getContext('2d');
    let W = 640, H = 960, dpr = Math.min(2, devicePixelRatio || 1);
    const resize = () => { const r = $('frame').getBoundingClientRect(); W = r.width; H = r.height; canvas.width = W * dpr; canvas.height = H * dpr; };
    new ResizeObserver(resize).observe($('frame')); resize();
    function showCard(which) {
      const stat = `${S.popped} ${C.pops.toLowerCase()} · ${S.calmed} ${C.calmed.toLowerCase()}`;
      if (which === 'win') { $('winStat').textContent = stat; $('winCard').hidden = false; }
      else { $('failWhy').textContent = (C.failWhy[S.why] || C.failWhy.time).replace('{p}', S.popped === 1 ? 'one spot' : S.popped + ' spots').replace('{n}', live().length); $('failStat').textContent = stat; $('failCard').hidden = false; }
      $('hint').style.display = 'none';
    }
    window.__showCard = showCard; window.__hideHud = on => $('frame').classList.toggle('revealing', !!on);
    const hideCards = () => { $('winCard').hidden = true; $('failCard').hidden = true; $('startCard').hidden = true; $('hint').style.display = ''; $('frame').classList.remove('revealing'); };
    const startRound = () => { hideCards(); SFX.unlock(); reset('play'); };
    window.DEMO = { start: () => { hideCards(); reset('attract'); $('startCard').hidden = false; }, slotMs: 20000, setAuto: () => {}, setSound: on => { SFX.muted = !on; } };
    $('playBtn').onclick = startRound; $('again1').onclick = startRound; $('again2').onclick = startRound;
    $('cta1').onclick = $('cta2').onclick = () => window.open(window.clickTag || CONFIG.ctaUrl, '_blank');
    const fp = e => { const r = $('frame').getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
    $('frame').addEventListener('pointerdown', e => {
      try { const p = fp(e); parent.postMessage({ iionTap: p }, '*'); } catch (err) {}
      if (e.target.closest('.card')) return;
      if (S.mode === 'attract') startRound();
      press(fp(e), 'user');
    });
    $('frame').addEventListener('pointermove', e => { if (S.down && !BOT) move(fp(e)); });
    window.addEventListener('pointerup', () => { if (!BOT) release(); }); window.addEventListener('pointercancel', () => { if (!BOT) release(); });
    window.addEventListener('keydown', e => { if (e.code === 'Space' && S.mode === 'attract') startRound(); });
    reset(BOT && !ATTRACT ? 'play' : 'attract');
    if (ATTRACT || BOT) $('startCard').hidden = true;
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (S.mode === 'attract' || (BOT && !ATTRACT && S.mode === 'play')) autopilot(dt);
      update(dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.save(); if (S.shake > 0) ctx.translate((Math.random() - .5) * 8 * S.shake, (Math.random() - .5) * 8 * S.shake);
      VIEW.drawFrame(ctx, S, W, H, CONFIG);
      ctx.restore();
      $('count').textContent = `${C.calmed} ${S.calmed}/${CONFIG.calmToWin}`; $('timer').textContent = S.timeLeft.toFixed(1);
      if (S.calmed !== FX.sm) { FX.sm = S.calmed; const c = $('count'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
      const n = live().length; if (n !== FX.pm) { FX.pm = n; $('flare').querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i < n)); }
      const hint = $('hint'); const cueOn = S.cue && S.elapsed < S.cue.until;
      hint.textContent = cueOn ? S.cue.text : S.elapsed < CONFIG.leadIn ? C.leadInHint : C.hint; hint.classList.toggle('cue', !!cueOn);
      hint.style.opacity = cueOn || S.mode === 'attract' || (S.mode === 'play' && S.calmed < 2) ? 1 : 0;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  let showCard = w => window.__showCard && window.__showCard(w);
  let hideHud = on => window.__hideHud && window.__hideHud(on);

  window.DontPop = {
    CONFIG, dist, live: () => live(), stageOf: () => stageOf(),
    run(VIEW) {
      G = VIEW.geometry();
      if (SIM) runSim(); layerRoutes(VIEW);
      if (has('embed') || has('full')) document.documentElement.classList.add('embed');
      mount(VIEW);
      if (VIEW.build && window.LAYERS) {   // gate: nothing shows until every picture and the meta have settled (D-027: no grey shape in a build); 10 s cap
        let expect = 1 + VIEW.layers.filter(L => ['plate', 'sprite', 'sheet', 'viewmodel', 'mask-texture', 'particle', 'occluder'].includes(L.type)).length, done = 0, ready = false;
        const reveal = () => { if (ready) return; ready = true; setTimeout(() => { const l = document.getElementById('loader'); if (l) { l.classList.add('done'); setTimeout(() => { l.hidden = true; }, 500); } document.getElementById('frame').classList.remove('loading'); }, 250); };
        window.LAYERS.load(VIEW.layers, 'assets/game/', () => { done++; const b = document.getElementById('loadBar'); if (b) b.style.width = Math.min(100, Math.round(done / expect * 100)) + '%'; if (done >= expect) reveal(); });
        setTimeout(reveal, 10000);
      } else if (window.LAYERS) window.LAYERS.load(VIEW.layers, 'assets/game/');
      window.GAME = { get S() { return S; }, CONFIG, reset, press, move, release };
      const qc = Q.get('card'); if (qc) setTimeout(() => { ['startCard', 'winCard', 'failCard'].forEach(i => { const el = document.getElementById(i); if (el) el.hidden = true; }); if (qc === 'win') { S.calmed = CONFIG.calmToWin; S.popped = 0; S.mode = 'win'; } else { S.why = 'popped'; S.popped = 3; S.calmed = 5; S.mode = 'fail'; } showCard(qc); if (window.__hideHud) window.__hideHud(true); }, 200);
    },
    helpers: { clamp, rand },
  };
})();
