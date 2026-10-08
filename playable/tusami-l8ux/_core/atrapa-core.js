/* Atrapa los números — shared game core for every greybox variant (rules, CONFIG, state, input, HUD, cards, bots,
   sim, layer contract). A variant supplies a VIEW: its layers (shape + blueprint) and its geometry.
   Hooks: ?bot (autopilot plays a real round) · ?sim (20 instant rounds) · ?sim&human (first-timer bot)
          ?attract (plays itself, used by the control panel) · ?blueprint=Lx · ?explained=Lx · ?geometry · ?card=win|fail
   window.GAME = { S, CONFIG, reset, drag }
   The rule: slide the ticket so its next empty slot is under the falling ball. Grey balls are numbers you already have:
   let them fall. It gets faster. Six numbers before the drum stops. */
(function () {
  const Q = new URLSearchParams(location.search);
  const has = k => Q.has(k);
  const CONFIG = {
    ctaUrl: 'https://tusami.bitel.com.pe/',   // placeholder until the client's landing page; window.clickTag overrides
    roundSecs: 15, slots: 6, numberMax: 46,   // TuSami Semanal: 6 numbers from 1–46 (to confirm with the client)
    ballNumbers: [7, 18, 26, 33, 41, 15, 28, 4, 79],   // the designer's nine individual balls (atlas order, 3x3); the build draws only these
    leadIn: 0.7,                              // the drum spins up before the first ball: nothing falls, nothing counts
    interval: [1.9, 1.7, 1.55, 1.4, 1.3, 1.2],   // seconds between drops, by numbers already caught (the pressure: the drum speeds up)
    fall:     [1.4, 1.25, 1.1, 1.0, 0.9, 0.82],   // the drop stays quick (the tension is in the fall); the 15 s round stretches only the gaps between balls    // seconds a ball is in the air, by numbers caught
    spread:   [0.08, 0.12, 0.15, 0.18, 0.20, 0.20], // how far from the ticket's resting line the landing point can be (frame widths)
    pairFrom: 1, pairChance: 0.7, pairGap: 0.36,   // from the fourth ball two can come close together, on opposite sides
    repeatChance: [0, 0.42, 0.48, 0.52, 0.56, 0.6],  // share of drops that carry a number already on the ticket (the one decision): the difficulty lives here, never in frustration; never three in a row
    catchHalf: 0.05,                                // half-width of the catch zone around the next slot (frame widths); generous first
    ticketW: 0.738, ticketXMin: 0.18, ticketXMax: 0.82,   // the ticket's width and its centre's travel: it may run a third of its width past either edge
    follow: 9, dragGain: 1.35, greyAt: 0.5,     // a repeat ball looks like any other until half its fall, then turns grey: the decision happens with half a second left                     // how snappily the ticket follows the finger; a thumb's inch moves the ticket a little more than an inch
    idleToAttract: 3,
    ui: { base: '../_ui/', startSticker: 'sticker-atrapa.png', poderosaSticker: 'sticker-poderosa.png', jugadaSticker: 'sticker-jugada.png', btnPlay: 'btn-juega.png', btnBuy: 'btn-compra.png', badge: 'badge.png', hand: 'hand.png' },   // the designer's UI pictures (00-intake/designer): taken as they are, never redrawn
    copy: {
      tagline: 'La Lotería Digital de Bitel', startTitle: '¡Atrapa los números!', startLine: 'Completa tu boleto para que aparezca La Poderosa. El bombo no espera.', play: 'Jugar',
      hint: 'Desliza el boleto', leadInHint: 'Ahí viene', cueRepeat: '¡Esa ya la tienes! Déjala caer', cueFirst: 'Pon la casilla bajo la bolilla',
      popCatch: '¡Atrapada!', popMiss: '¡Se escapó!', popRepeat: '¡Repetida!',
      winStamp: '¡Atrapa a La Poderosa!', winTitle: 'Ya tienes tu jugada.', winLine: 'Ahora juégala.', cta: 'Juega ahora ›', ctaBuy: 'Compra ahora ›',
      failStamp: '¡Casi!', failTitle: 'Te faltaron números.', failLine: 'El bombo no espera. ¿Otra vez?',
      failWhy: { time: 'El bombo se detuvo con {n} casillas vacías.', repeat: 'Las repetidas te vaciaron el boleto.' },
      again: 'Otra vez', share: 'Compartir', legal: '+18 Juega responsablemente',
    },
  };
  const BOT = has('bot') || has('attract'), HUMAN = has('human'), SIM = has('sim'), ATTRACT = has('attract');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const pad2 = n => String(n).padStart(2, '0');
  const slotOffset = i => (i - (CONFIG.slots - 1) / 2) * (CONFIG.ticketW / CONFIG.slots);   // a slot's centre relative to the ticket's centre (frame widths)
  const stageOf = () => Math.min(CONFIG.slots - 1, S.filled.length);

  let S;
  function reset(mode) {
    S = { mode, elapsed: 0, timeLeft: CONFIG.roundSecs, filled: [], ticketX: 0.5, targetX: 0.5, balls: [], nextDrop: CONFIG.leadIn, lastRepeat: false, caught: 0, missed: 0, repeats: 0, bursts: 0,
      pops: [], flash: 0, burst: 0, shake: 0, drum: 0, why: null, reveal: 0, idle: 0, cue: null, seen: {}, lastTouch: -9, attractEnd: false, dragging: false, nextId: 1 };
  }
  const inFlight = () => S.balls.filter(b => !b.done);
  function newNumber() { const pool = (window.LAYERS && window.LAYERS.ART && window.LAYERS.ART.L3) || (CONFIG.useBallNumbers) ? CONFIG.ballNumbers : null; let n, guard = 0;
    do { n = pool ? pool[Math.floor(Math.random() * pool.length)] : 1 + Math.floor(Math.random() * CONFIG.numberMax); } while ((S.filled.includes(n) || inFlight().some(b => b.num === n)) && ++guard < 200); return n; }
  function spawn(delay, side) {
    const st = stageOf(), i = S.filled.length;
    const forceBright = S.repeatRun >= 2, repeat = S.filled.length >= 1 && !forceBright && (side ? (S.lastRepeat ? Math.random() < 0.25 : Math.random() < 0.6) : Math.random() < CONFIG.repeatChance[st]);   // in a pair the second ball usually takes the other colour: one bright, one grey, choose
    const num = repeat ? S.filled[Math.floor(Math.random() * S.filled.length)] : newNumber();
    const sp = CONFIG.spread[st], off = slotOffset(i);
    let x1 = 0.5 + off + (side ? side * rand(sp * .5, sp) : rand(-sp, sp));
    x1 = clamp(x1, Math.max(0.1, CONFIG.ticketXMin + off), Math.min(0.9, CONFIG.ticketXMax + off));   // always reachable by the next slot, never off the frame
    const dur = CONFIG.fall[st];
    S.balls.push({ id: S.nextId++, num, repeat, x1, t: -(delay || 0) / dur, dur, done: false, caught: false, burst: false, slot: i });
    S.lastRepeat = repeat; S.repeatRun = repeat ? (S.repeatRun || 0) + 1 : 0;
    if (repeat && !S.seen.repeat) { S.seen.repeat = true; S.cue = { text: CONFIG.copy.cueRepeat, until: S.elapsed + 1.6 }; }
    return x1;
  }
  function grab(xFrac, src) {   // the finger lands: remember where it landed and where the ticket was
    if (S.mode !== 'play' && S.mode !== 'attract') return; S.grabX = xFrac; S.grabT = S.targetX; S.idle = 0; S.lastTouch = S.elapsed; if (src === 'user') SFX.unlock();
  }
  function drag(xFrac, src) {   // the one control: slide; the ticket moves as far as the finger moves, from wherever it is
    if (S.mode !== 'play' && S.mode !== 'attract') return; if (S.grabX == null) grab(xFrac, src);
    S.targetX = clamp(S.grabT + (xFrac - S.grabX) * CONFIG.dragGain, CONFIG.ticketXMin, CONFIG.ticketXMax); S.idle = 0; S.lastTouch = S.elapsed;
  }
  function resolve(b) {   // the ball reaches the ticket line
    b.done = true; const i = S.filled.length, slotX = S.ticketX + slotOffset(i), hit = Math.abs(b.x1 - slotX) <= CONFIG.catchHalf;
    if (hit && b.repeat) {   // caught a number you already have: the matching slot bursts and empties (seen, never only suffered)
      const k = S.filled.indexOf(b.num); if (k >= 0) S.filled.splice(k, 1); S.repeats++; S.bursts++; b.burst = true; S.burst = 1; S.shake = .8; S.pops.push({ t: 0, txt: CONFIG.copy.popRepeat, big: true, bad: true }); if (!SIM) SFX.burst(); return;
    }
    if (hit) {   // caught: the number snaps into the slot
      S.filled.push(b.num); S.caught++; b.caught = true; S.flash = 1; S.shake = .25; S.pops.push({ t: 0, txt: CONFIG.copy.popCatch }); if (!SIM) SFX.catch();
      if (S.filled.length >= CONFIG.slots) return finish('win');
      if (!S.seen.first) S.seen.first = true;
      return;
    }
    if (!b.repeat) { S.missed++; S.pops.push({ t: 0, txt: CONFIG.copy.popMiss, small: true }); if (!SIM) SFX.miss(); }   // a let-go repeat is the right call: silent
  }
  function finish(result, why) {
    const wasAttract = S.mode === 'attract';
    if (wasAttract) { const keep = { ticketX: S.ticketX, targetX: S.targetX }; reset('attract'); Object.assign(S, keep); return; }   // the splash loop: no La Poderosa, no fail, just the drum and the ticket going on
    S.mode = result === 'win' ? 'reveal' : 'fail'; S.why = why || null; S.reveal = 0; S.attractEnd = wasAttract;
    if (!SIM && !wasAttract) { if (result === 'win') { SFX.win(); hideHud(true); setTimeout(() => showCard('win'), 1200); } else { SFX.fail(); hideHud(true); setTimeout(() => showCard('fail'), 900); } }
  }
  function update(dt) {
    if (S.mode === 'reveal') { S.reveal += dt; if (S.reveal > 1.0) S.mode = 'win'; }
    if (S.mode === 'reveal' || S.mode === 'win' || S.mode === 'fail') { S.targetX = 0.5; S.ticketX += (0.5 - S.ticketX) * Math.min(1, dt * 6); }   // the end screens show the ticket centred, as the client drew it
    if (S.mode === 'play' || S.mode === 'attract') {
      S.elapsed += dt; S.timeLeft = Math.max(0, CONFIG.roundSecs - S.elapsed); S.idle += dt;
      S.drum = Math.min(1, S.elapsed / CONFIG.leadIn) * (0.4 + 0.6 * stageOf() / (CONFIG.slots - 1));   // the drum visibly spins faster as the ticket fills
      if (S.elapsed >= S.nextDrop && S.elapsed <= CONFIG.roundSecs - 0.35) {
        const st = stageOf(); const x1 = spawn(0, 0);
        if (st >= CONFIG.pairFrom && Math.random() < CONFIG.pairChance) spawn(CONFIG.pairGap, x1 > 0.5 + slotOffset(S.filled.length) ? -1 : 1);   // the pair comes on the other side
        S.nextDrop = S.elapsed + CONFIG.interval[st];
      }
      if (!S.seen.cue && S.elapsed > CONFIG.leadIn * .4) { S.seen.cue = true; S.cue = { text: CONFIG.copy.cueFirst, until: S.elapsed + 1.5 }; }
      S.ticketX += (S.targetX - S.ticketX) * Math.min(1, dt * CONFIG.follow);   // the ticket follows; a slot change shifts it so the new lit slot stays under the finger (targetX already accounts for it)
      S.balls.forEach(b => { if (b.done) { b.t += dt / b.dur; return; } b.t += dt / b.dur; if (b.t >= 1) resolve(b); });
      S.balls = S.balls.filter(b => b.t < 1.45);
      if (S.timeLeft <= 0) return finish('fail', S.bursts >= 2 ? 'repeat' : 'time');
    }
    S.flash = Math.max(0, S.flash - dt * 4); S.burst = Math.max(0, S.burst - dt * 2.2); S.shake = Math.max(0, S.shake - dt * 6);
    S.pops.forEach(p => p.t += dt); S.pops = S.pops.filter(p => p.t < (p.big ? 1.1 : 0.7));
  }

  // ── autopilot ───────────────────────────────────────────
  // perfect bot: slides the next empty slot under the next bright ball as soon as it is in the air, steps aside from grey ones; capped speed.
  // first-timer bot: reacts 0.3 s late, lands ±0.075 off until three catches then ±0.045, chases a grey ball 18% of the time, slower hand.
  function autopilot(dt) {
    const live = S.balls.filter(b => !b.done && b.t >= 0).sort((a, b) => a.t - b.t); if (!live.length) return;
    const next = live[live.length - 1];   // the one landing soonest
    if (next.plan == null) { next.plan = { react: HUMAN ? rand(0.25, 0.5) : 0.05, err: HUMAN ? rand(-1, 1) * (S.caught < 3 ? 0.11 : 0.07) : rand(-0.01, 0.01), chase: HUMAN && Math.random() < 0.25 }; }
    if (next.t * next.dur < next.plan.react) return;
    const off = slotOffset(S.filled.length);
    let want;
    if (next.repeat && !next.plan.chase && next.t >= CONFIG.greyAt) { want = next.x1 - off + (next.x1 - off > 0.5 ? -1 : 1) * (CONFIG.catchHalf + 0.06); }   // step aside, once it has turned grey
    else { const tl = (1 - next.t) * next.dur; want = next.x1 - off + next.plan.err * (tl < 0.5 ? 1.25 : tl < 0.8 ? 1.1 : 1); }   // less time, worse aim
    const maxV = HUMAN ? 0.9 : 1.6; const d = clamp(want, CONFIG.ticketXMin, CONFIG.ticketXMax) - S.targetX;
    S.targetX = clamp(S.targetX + clamp(d, -maxV * dt, maxV * dt), CONFIG.ticketXMin, CONFIG.ticketXMax); S.grabX = null;
  }
  // ── sim ─────────────────────────────────────────────────
  function runSim() {
    const out = [];
    for (let r = 0; r < 20; r++) {
      reset('play'); let n = 0;
      while (S.mode === 'play') { autopilot(1 / 60); update(1 / 60); if (++n > 60 * 30) break; }
      out.push(`${S.mode === 'reveal' || S.mode === 'win' ? 'win ' : 'fail'} t=${S.elapsed.toFixed(1)} caught=${S.caught} missed=${S.missed} bursts=${S.bursts} filled=${S.filled.length} why=${S.why || '-'} nums=${S.filled.map(pad2).join(' ')}`);
    }
    const wins = out.filter(l => l.startsWith('win')).length;
    document.title = 'SIM'; document.body.innerHTML = `<pre id="sim">${HUMAN ? 'human bot' : 'perfect bot'}: ${wins}/20 wins\n${out.join('\n')}</pre>`;
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
  html,body{margin:0;height:100%;background:#000;font-family:Poppins,Inter,system-ui,sans-serif;-webkit-user-select:none;user-select:none}
  .frame{--green:#1aa64a;--green2:#0b7a3a;--yellow:#fcd20a;--teal:#0b3d4a;--ink:#0b2a32;position:relative;width:min(100vw,calc(100dvh*2/3));aspect-ratio:2/3;margin:0 auto;overflow:hidden;background:#2a2a2e;container-type:inline-size;touch-action:none}
  canvas#game{position:absolute;inset:0;width:100%;height:100%;display:block}
  .hud{position:absolute;inset:0;pointer-events:none;color:#fff;font-weight:700}
  .top{position:absolute;left:3cqw;right:3cqw;top:33cqw;display:flex;justify-content:space-between;align-items:flex-start;font-size:3.8cqw}
  .pill{background:linear-gradient(180deg,#fff,#eef3f3);border:.4cqw solid #fff;border-radius:999px;padding:1.2cqw 3cqw;color:var(--teal);box-shadow:0 .6cqw 1.4cqw rgba(0,0,0,.3)}   /* the client's white glossy sticker look */
  .pill.bump{animation:bump .28s cubic-bezier(.2,1.6,.4,1)}@keyframes bump{0%{transform:scale(1)}40%{transform:scale(1.22)}100%{transform:scale(1)}}
  .hint{position:absolute;left:50%;top:89cqw;transform:translateX(-50%);font-size:3.6cqw;background:var(--yellow);border:.4cqw solid #fff;border-radius:999px;padding:1.6cqw 4.4cqw;white-space:nowrap;color:var(--teal);box-shadow:0 .6cqw 1.4cqw rgba(0,0,0,.3)}   /* the client's yellow sub-line badge */
  .hint.cue{background:#fff}
  .legal{position:absolute;left:50%;bottom:2cqw;transform:translateX(-50%);font-size:2.6cqw;font-weight:600;color:#fff;text-shadow:0 .3cqw .8cqw rgba(0,0,0,.6);white-space:nowrap}
  .card{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:0;padding:0 7cqw 2.5cqw;color:#fff;text-align:center;background:linear-gradient(180deg,rgba(0,0,0,0) 80%,rgba(0,0,0,.08) 100%)}   /* an overlay on the live scene, as the client's screens */
  .card[hidden]{display:none}
  .frame:has(.card:not([hidden])) .top,.frame:has(.card:not([hidden])) .hint,.frame:has(.card:not([hidden])) .greylabel,.frame:has(.card:not([hidden])) .hud .legal{display:none}
  canvas#game{transition:transform .5s cubic-bezier(.2,.9,.3,1)}
  .card .sticker{position:absolute;left:50%;transform:translateX(-50%);width:76cqw;filter:drop-shadow(0 1cqw 2cqw rgba(0,0,0,.35))}
  .card .sticker.atrapa{top:45.9cqw;width:69.4cqw;animation:pop .4s cubic-bezier(.2,1.4,.3,1) both}
  .card .sticker.poderosa{top:26.9cqw;width:54.8cqw;animation:pop .4s cubic-bezier(.2,1.4,.3,1) 0s both}
  .card .sticker.jugada{top:86cqw;width:58.8cqw;animation:pop .4s cubic-bezier(.2,1.4,.3,1) .15s both}
  @keyframes pop{0%{transform:translateX(-50%) scale(.6);opacity:0}100%{transform:translateX(-50%) scale(1);opacity:1}}
  .card .hand{position:absolute;left:50%;top:115.5cqw;width:15cqw;transform:translateX(-50%);animation:swipe 1.6s ease-in-out infinite}
  @keyframes swipe{0%,100%{transform:translateX(-80%)}50%{transform:translateX(-20%)}}
  .card .btnimg{display:block;position:absolute;left:50%;top:128.5cqw;transform:translateX(-50%);width:48cqw;margin:0;cursor:pointer;filter:drop-shadow(0 1cqw 2cqw rgba(0,0,0,.35));animation:breathe 2.2s ease-in-out 1s infinite;background:none;border:0;padding:0}
  .card .btnimg img{width:100%;display:block}
  .card .btnimg:active{transform:translateX(-50%) translateY(.6cqw)}
  @keyframes breathe{0%,100%{transform:translateX(-50%) scale(1)}50%{transform:translateX(-50%) scale(1.03)}}
  .card .btn{font:inherit;font-weight:800;font-size:4.6cqw;min-height:12cqw;padding:2.6cqw 8cqw;position:absolute;left:50%;top:128.5cqw;transform:translateX(-50%);border-radius:999px;border:.5cqw solid #d8ffe2;background:linear-gradient(180deg,#4fe08a 0%,var(--green) 48%,var(--green2) 100%);color:#fff;cursor:pointer;box-shadow:0 .8cqw 0 #05552a,0 1.4cqw 2.4cqw rgba(0,0,0,.4),inset 0 .5cqw 0 rgba(255,255,255,.45);text-shadow:0 .3cqw 0 rgba(0,0,0,.35);animation:breathe 2.2s ease-in-out 1s infinite}   /* a CSS twin of the client's green pill, for buttons they did not draw */
  .card .btn.ghost{position:static;transform:none;background:rgba(255,255,255,.92);color:var(--teal);border-color:#fff;box-shadow:0 .6cqw 1.4cqw rgba(0,0,0,.3);text-shadow:none;animation:none;font-size:2.6cqw;min-height:5cqw;padding:.5cqw 3.4cqw;line-height:1}
  .card .row{position:absolute;left:0;right:0;top:140.8cqw;display:flex;gap:2.4cqw;justify-content:center;margin:0}
  .card h1{font-size:9cqw;line-height:1;margin:0;font-weight:800;color:var(--yellow);text-shadow:0 .4cqw 0 #c9a400,.6cqw .6cqw 0 var(--teal),-.6cqw .6cqw 0 var(--teal),.6cqw -.6cqw 0 var(--teal),-.6cqw -.6cqw 0 var(--teal),0 1.4cqw 2.4cqw rgba(0,0,0,.4)}   /* a CSS twin of the client's 3D yellow sticker type, for lines they did not draw */
  .card p{font-size:3.6cqw;line-height:1.3;margin:1.2cqw 0 0;color:#fff;font-weight:700;text-shadow:0 .3cqw .8cqw rgba(0,0,0,.6)}
  .card .cap{display:inline-block;background:var(--yellow);color:var(--teal);font-size:3.2cqw;font-weight:700;border-radius:999px;padding:1.2cqw 4cqw;border:.4cqw solid #fff;box-shadow:0 .6cqw 1.4cqw rgba(0,0,0,.3)}
  .card .legal{position:absolute;left:50%;bottom:.4cqw;transform:translateX(-50%);margin:0;font-size:2.3cqw}
  .card .mid{position:absolute;left:7cqw;right:7cqw;top:48cqw;display:flex;flex-direction:column;align-items:center;gap:1.6cqw}
  .greylabel{position:absolute;right:2cqw;top:42cqw;font-size:2.6cqw;color:rgba(255,255,255,.5);font-weight:600;letter-spacing:.08em;text-shadow:0 .3cqw .8cqw rgba(0,0,0,.6)}
  .brandmark{display:none;position:absolute;left:50%;top:1.6cqw;transform:translateX(-50%);height:12cqw;align-items:center;justify-content:center;pointer-events:none}
  .brandmark img{height:100%;width:auto;filter:drop-shadow(0 .6cqw 1.2cqw rgba(0,0,0,.55))}
  .brandmark.ph{font-size:2.6cqw;font-weight:800;letter-spacing:.08em;color:rgba(255,255,255,.6);border:1px dashed rgba(255,255,255,.4);border-radius:1.5cqw;padding:0 2.5cqw}
  .frame.revealing .top,.frame.revealing .hint,.frame.revealing .brandmark{opacity:0;transition:opacity .3s}
  .loader{position:absolute;inset:0;z-index:9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5cqw;background:linear-gradient(180deg,#5fc3ff 0%,#8fd8ff 60%,#ffe9a8 100%);transition:opacity .45s ease}
  .loader.done{opacity:0;pointer-events:none}.loader[hidden]{display:none}
  .loader img{width:48cqw;filter:drop-shadow(0 1.5cqw 3cqw rgba(0,0,0,.25));animation:pulse 1.4s ease-in-out infinite}
  .loader .bar{width:38cqw;height:1.4cqw;border-radius:1cqw;background:rgba(0,60,80,.2);overflow:hidden}.loader .bar i{display:block;height:100%;width:0;background:#fff;border-radius:1cqw;transition:width .25s ease}
  @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
  .frame.loading canvas#game,.frame.loading .hud,.frame.loading .card{visibility:hidden}
  html.embed,html.embed body{background:#000;overflow:hidden;height:100%}html.embed body{display:flex;align-items:center;justify-content:center}html.embed .frame{width:min(100vw,calc(100vh * 2 / 3));height:min(100vh,calc(100vw * 3 / 2));aspect-ratio:auto;margin:0}
  @media (min-aspect-ratio:131/200) and (max-aspect-ratio:17/25){html.embed .frame{width:100vw;height:100vh}}
  `;
  const FX = { sm: -1 };
  const SFX = (() => {
    let ac = null, muted = false;
    const ctx = () => { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } } if (ac && ac.state === 'suspended') ac.resume(); return ac; };
    function tone(f, t, dur, type, g, slide) { const a = ctx(); if (!a || muted) return; const o = a.createOscillator(), v = a.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur); v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g || .25, t + .005); v.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(v).connect(a.destination); o.start(t); o.stop(t + dur + .02); }
    function noise(t, dur, g, lp) { const a = ctx(); if (!a || muted) return; const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const src = a.createBufferSource(); src.buffer = b; const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 1200; const v = a.createGain(); v.gain.value = g || .3; src.connect(f).connect(v).connect(a.destination); src.start(t); }
    const now = () => (ctx() ? ac.currentTime : 0);
    return { unlock() { ctx(); }, get muted() { return muted; }, set muted(v) { muted = v; },
      catch() { const t = now(); tone(880, t, .09, 'triangle', .2); tone(1320, t + .07, .14, 'triangle', .18); },
      miss() { tone(200, now(), .12, 'triangle', .12, -80); },
      burst() { const t = now(); noise(t, .22, .4, 2400); tone(160, t, .3, 'sawtooth', .18, -90); },
      win() { const t = now(); [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, t + i * .1, .32, 'triangle', .2)); },
      fail() { const t = now(); tone(330, t, .25, 'sawtooth', .12, -120); tone(220, t + .22, .4, 'sawtooth', .12, -100); } };
  })();
  function mount(VIEW) {
    if (CONFIG.brand) { const b = CONFIG.brand, st = document.createElement('style'); st.textContent = `.frame.skin{${b.font ? 'font-family:' + b.font + ',Inter,system-ui,sans-serif;' : ''}}`; document.head.appendChild(st); if (b.fontUrl) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = b.fontUrl; document.head.appendChild(l); } }
    const U = Object.fromEntries(Object.entries(CONFIG.ui).map(([k, v]) => [k, k === 'base' ? v : CONFIG.ui.base + v]));   // the designer's UI pictures
    const LOGO = CONFIG.brand && CONFIG.brand.logo ? `<div class="logo art"><img src="${CONFIG.brand.logo}" alt=""></div>` : '';
    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    if (!document.querySelector('link[href*="Poppins"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800&display=swap'; document.head.appendChild(l); }
    document.body.innerHTML = `
    <div class="${VIEW.build ? 'frame skin loading' : 'frame'}" id="frame">
      ${VIEW.build ? `<div class="loader" id="loader" role="progressbar" aria-label="Cargando"><img src="${U.badge}" alt=""><div class="bar"><i id="loadBar"></i></div></div>` : ''}
      <canvas id="game"></canvas>
      <div class="hud">
        <div class="top"><span class="pill" id="count">0 de 6</span><span class="pill" id="timer">15.0</span></div>
        <div class="hint" id="hint">${CONFIG.copy.hint}</div>
        <div class="legal">${CONFIG.copy.legal}</div>
        ${CONFIG.brand && CONFIG.brand.logo ? `<div class="brandmark"><img src="${CONFIG.brand.logoOnArt || CONFIG.brand.logo}" alt=""></div>` : `<div class="brandmark ph">TUSAMI</div>`}
        ${VIEW.build ? '' : `<div class="greylabel">GREYBOX · ${VIEW.title.toUpperCase()}</div>`}
      </div>
      <div class="card start" id="startCard"><img class="sticker atrapa" src="${U.startSticker}" alt="${CONFIG.copy.startTitle}">
        <img class="hand" src="${U.hand}" alt="">
        <button class="btnimg" id="playBtn" type="button" aria-label="${CONFIG.copy.cta}"><img src="${U.btnPlay}" alt=""></button><div class="legal">${CONFIG.copy.legal}</div></div>
      <div class="card" id="winCard" hidden><img class="sticker poderosa" src="${U.poderosaSticker}" alt="${CONFIG.copy.winStamp}"><img class="sticker jugada" src="${U.jugadaSticker}" alt="${CONFIG.copy.winTitle} ${CONFIG.copy.winLine}">
        <button class="btnimg" id="cta1" type="button" aria-label="${CONFIG.copy.ctaBuy}"><img src="${U.btnBuy}" alt=""></button>
        <div class="row"><button class="btn ghost" id="again1" type="button">${CONFIG.copy.again}</button></div><div class="legal">${CONFIG.copy.legal}</div></div>
      <div class="card" id="failCard" hidden>
        <div class="mid"><h1>${CONFIG.copy.failStamp}</h1><div class="cap" id="failWhy"></div><p>${CONFIG.copy.failLine}</p></div>
        <button class="btnimg" id="cta2" type="button" aria-label="${CONFIG.copy.cta}"><img src="${U.btnPlay}" alt=""></button>
        <div class="row"><button class="btn ghost" id="again2" type="button">${CONFIG.copy.again}</button></div><div class="legal">${CONFIG.copy.legal}</div></div>
    </div>`;
    const $ = id => document.getElementById(id);
    const canvas = $('game'), ctx = canvas.getContext('2d');
    let W = 640, H = 960, dpr = Math.min(2, devicePixelRatio || 1);
    const resize = () => { const r = $('frame').getBoundingClientRect(); W = r.width; H = r.height; canvas.width = W * dpr; canvas.height = H * dpr; };
    new ResizeObserver(resize).observe($('frame')); resize();
    function showCard(which) {
      if (which === 'win') { $('winCard').hidden = false; }
      else { $('failWhy').textContent = (CONFIG.copy.failWhy[S.why] || CONFIG.copy.failWhy.time).replace('{n}', CONFIG.slots - S.filled.length); $('failCard').hidden = false; }
      $('hint').style.display = 'none';
    }
    window.__showCard = showCard; window.__hideHud = on => $('frame').classList.toggle('revealing', !!on);
    const hideCards = () => { $('winCard').hidden = true; $('failCard').hidden = true; $('startCard').hidden = true; $('hint').style.display = ''; $('frame').classList.remove('revealing'); };
    const startRound = () => { hideCards(); SFX.unlock(); reset('play'); };
    window.DEMO = { start: () => { hideCards(); reset('attract'); $('startCard').hidden = false; }, slotMs: 20000, setAuto: () => {}, setSound: on => { SFX.muted = !on; } };
    $('playBtn').onclick = startRound; $('again1').onclick = startRound; $('again2').onclick = startRound;
    $('cta1').onclick = $('cta2').onclick = () => window.open(window.clickTag || CONFIG.ctaUrl, '_blank');
    function share(result) {   // the sharing hub (built at the build stage, as marrybrown-01's pass.html); synchronous inside the tap
      const url = new URL((CONFIG.brand && CONFIG.brand.passUrl) || 'pass.html', location.href); url.searchParams.set('result', result); url.searchParams.set('nums', S.filled.map(pad2).join('-'));
      if (window.top !== window) { try { if (window.open(url.href, '_blank', 'noopener')) return; } catch (e) {} } location.href = url.href;
    }
    const fx = e => { const r = $('frame').getBoundingClientRect(); return (e.clientX - r.left) / r.width; };
    $('frame').addEventListener('pointerdown', e => {
      try { const r = $('frame').getBoundingClientRect(); parent.postMessage({ iionTap: { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height } }, '*'); } catch (err) {}
      if (e.target.closest('.card')) return;
      if (S.mode === 'attract') startRound();
      S.dragging = true; grab(fx(e), 'user');
    });
    $('frame').addEventListener('pointermove', e => { if (S.dragging) drag(fx(e), 'user'); });
    window.__lastFx = null;
    window.addEventListener('pointerup', () => { S.dragging = false; S.grabX = null; }); window.addEventListener('pointercancel', () => { S.dragging = false; S.grabX = null; });
    window.addEventListener('keydown', e => { if (e.code === 'ArrowLeft') S.targetX = clamp(S.targetX - 0.06, CONFIG.ticketXMin, CONFIG.ticketXMax); if (e.code === 'ArrowRight') S.targetX = clamp(S.targetX + 0.06, CONFIG.ticketXMin, CONFIG.ticketXMax); if (e.code === 'Space' && S.mode === 'attract') startRound(); });
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
      $('count').textContent = `${S.filled.length} de ${CONFIG.slots}`; $('timer').textContent = S.timeLeft.toFixed(1);
      if (S.filled.length !== FX.sm) { FX.sm = S.filled.length; const c = $('count'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
      const hint = $('hint'); const cueOn = S.cue && S.elapsed < S.cue.until;
      hint.textContent = cueOn ? S.cue.text : S.elapsed < CONFIG.leadIn ? CONFIG.copy.leadInHint : CONFIG.copy.hint; hint.classList.toggle('cue', !!cueOn);
      hint.style.opacity = cueOn || S.mode === 'attract' || (S.mode === 'play' && S.caught < 2) ? 1 : 0;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  let showCard = w => window.__showCard && window.__showCard(w);
  let hideHud = on => window.__hideHud && window.__hideHud(on);

  window.Atrapa = {
    CONFIG, slotOffset, pad2,
    run(VIEW) {
      if (SIM) runSim(); layerRoutes(VIEW);
      if (has('embed') || has('full')) document.documentElement.classList.add('embed');
      mount(VIEW);
      if (VIEW.build && window.LAYERS) {   // gate: the loader stays until every layer, the meta and the UI pictures have settled
        const SLOW = has('slow'); let expect = 1, done = 0, ready = false;
        const settle = () => { done++; const pct = Math.min(100, Math.round(done / expect * 100)); const b = document.getElementById('loadBar'); if (b) b.style.width = pct + '%'; if (done >= expect) reveal(); };
        const reveal = () => { if (ready) return; ready = true; setTimeout(() => { const l = document.getElementById('loader'); if (l) { l.classList.add('done'); setTimeout(() => { l.hidden = true; }, 500); } document.getElementById('frame').classList.remove('loading'); if (window.__onReady) window.__onReady(); }, 250); };
        expect = 1 + VIEW.layers.filter(L => ['plate', 'sprite', 'sheet', 'viewmodel', 'mask-texture', 'particle', 'occluder'].includes(L.type)).length;
        const pics = Object.entries(CONFIG.ui).filter(([k]) => k !== 'base').map(([, v]) => CONFIG.ui.base + v); expect += pics.length;
        pics.forEach(src => { const im = new Image(); im.onload = settle; im.onerror = settle; im.src = src; });
        setTimeout(() => window.LAYERS.load(VIEW.layers, 'assets/game/', () => settle()), SLOW ? 1500 : 0);
        setTimeout(reveal, 10000);
      } else if (window.LAYERS) window.LAYERS.load(VIEW.layers, 'assets/game/');
      window.GAME = { get S() { return S; }, CONFIG, reset, drag, grab };
      const qc = Q.get('card'); if (qc) setTimeout(() => { ['startCard', 'winCard', 'failCard'].forEach(i => { const el = document.getElementById(i); if (el) el.hidden = true; }); if (qc === 'win') S.filled = [7, 14, 22, 31, 18, 26]; else { S.why = 'time'; S.filled = [7, 14, 22, 31]; } showCard(qc); if (window.__hideHud) window.__hideHud(true); }, 200);
    },
    helpers: { clamp, rand },
  };
})();
