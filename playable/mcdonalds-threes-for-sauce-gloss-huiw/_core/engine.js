/* The greybox engine: the half of every pipeline core that never changed (extracted 2026-10-14 from benzac-01
   dontpop-core.js, marrybrown-01 gepuk-core.js and tusami-01 atrapa-core.js, where these parts were the same
   scaffolding line for line): the query flags, the synthesised sound core, the frame CSS, the mount with the HUD and
   the three cards, the input binding in frame fractions, the loop with the autopilot and the shake, the finish with
   its reveal and card timers, the sim harness and bot runner, the layer routes (?blueprint ?explained ?geometry), the
   loader gate for a build, the ?card route, window.GAME and the shell's DEMO contract.

   A game supplies what changed per concept: CONFIG, its state and rules, its two bots, its sim line, its HUD text,
   its sounds. A view supplies the layers and drawFrame as before (D-015).

   ENGINE.run(game, VIEW) where game = {
     CONFIG,                       gesture ('tap' | 'hold' | 'swipe' | 'drag' | 'tilt': the card's one gesture; the start
                                   card's hand plays it), roundSecs, ctaUrl, idleToAttract, copy { brand, hint, leadInHint, startTitle,
                                   startLine, play, winStamp, winTitle, winLine, cta, failStamp, failLine, failWhy{}, again }
     get S(),                      the game's state object (the engine reads mode, elapsed, timeLeft, down, shake, cue, why)
     reset(mode),                  'play' | 'attract'
     press(p, src), move(p), release(),   the one control in frame fractions (a tap game uses press only)
     update(dt), autopilot(dt),    the rules and ONE bot, the expert; the kit's hand (E.hand: wait, aim, point) plays the
                                   first-timer by erring the expert's intent, so no game tunes its own judge (2026-11-05)
     pending(),                    OPTIONAL, and every game with a thing in flight has it: true while something the player
                                   already launched can still score. THE CLOCK CLOSES THE INPUT, NOT THE WORLD: when the
                                   round would fail (time, the last piece) while pending() is true, the engine takes no
                                   more input, the game goes on stepping what is in motion, and the round ends when
                                   pending() is false (a win if that motion wins it), 2.5 s at most (closeSecs)
     simLine(),                    one line per sim round ("win t=… …" / "fail …"); starts with win or fail
     hud(),                        { left, right, hint, cue, dots: { label, total, on, last } | null } per frame
     stat(), failWhy(),            the card's stat line and the fail card's cause
     sounds(sfx),                  { win(), fail(), …game sounds } built on sfx.tone / sfx.noise / sfx.now
     winDelayMs, failDelayMs       the card's delay after the reveal (defaults 1100 / 800)
   }
   The game ends a round with ENGINE.finish('win') or ENGINE.finish('fail', why).
   Hooks: ?embed ?mute ?attract ?bot ?sim&n=N ?sim&human&n=N ?geometry ?blueprint=Lx ?explained=Lx ?card=win|fail
          ?bot&hold (2026-11-03): the bot plays until a win, held at its reveal with no card, so a check can photograph the payoff
          (the hero moment, the impact, the fill) as the player sees it between the last move and the win card */
window.ENGINE = (function () {
  const Q = new URLSearchParams(location.search);
  const has = k => Q.has(k);
  const BOT = has('bot') || has('attract'), HUMAN = has('human'), SLOW = has('slow'), WILD = has('wild'), IDLE = has('idle'), SIM = has('sim'), ATTRACT = has('attract'), MUTE = has('mute');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  // ── the hand (2026-11-05): the kit plays the first-timer. A game writes ONE bot, the expert, and its intent goes through
  // the hand: exact for the expert, a thumb's for the first-timer (?sim&human): a reaction wait, an angle and a length
  // error, a jittered point, a hesitation now and then, all larger before the hand has settled (two gestures). The numbers
  // are the kit's, one set for every game, so no game tunes its own judge (the owner, after the first full session build
  // whose own first-timer bot won 68% while a real thumb could not finish: "playables should be easy and completable").
  const HAND = { expertWait: 0.3, wait: [0.9, 1.6], firstWait: [1.4, 2.2], hesitate: 0.1, hesitateSecs: 0.8, settleAfter: 2,
    // twice the first numbers (2026-11-05, the owner on run E: "it's still a bit difficult to win", where this hand won 100 of 100 with no
    // misses; at these numbers it wins 74 with 1.3 misses, the nearest a bot has come to that thumb). The floor of 80 on this hand is
    // what makes errors hard to happen in every game.
    angle: [20, 10], len: [0.36, 0.18], point: [0.06, 0.03], expert: { angle: 0.5, len: 0.01, point: 0.002 } };
  const hand = (() => {
    let count = 0;
    const settled = () => count >= HAND.settleAfter, pick = (pair) => settled() ? pair[1] : pair[0];
    return {
      get count() { return count; },
      reset() { count = 0; },
      /** seconds the bot waits before its next gesture (the expert is quick; a thumb thinks, and hesitates now and then) */
      // ?slow (with ?human): the same hand at HALF THE PACE, every wait doubled (2026-11-05, the owner on run C's landed game:
      // "a bit difficult, especially with the time limit being very low", where the first-timer bot won 85 to 90 percent
      // and the engineer had cut the clock because of it). The slow hand is the judge of TIME: a game it cannot finish is
      // hard by its clock, and time is forgiveness, never difficulty.
      wait() { if (!HUMAN) return HAND.expertWait; const w = settled() ? HAND.wait : HAND.firstWait; return (rand(w[0], w[1]) + (Math.random() < HAND.hesitate ? HAND.hesitateSecs : 0)) * (SLOW ? 2 : 1); },
      /** a swipe or throw intent { dx, dy, len } (a direction and a length), returned as the hand would make it */
      // ?wild (2026-11-05): the whole range of the gesture, short to as long as a thumb goes, a wide lean: the bots aim well, so a game's
      // long throws went untested and sailed over the board on run E. It judges the world's solids, never the round's fairness.
      aim(v) {
        count++; if (WILD) { const th = rand(-25, 25) * Math.PI / 180, c = Math.cos(th), sn = Math.sin(th), x = v.dx || 0, y = v.dy || 0; return Object.assign({}, v, { dx: x * c - y * sn, dy: x * sn + y * c, len: (v.len == null ? 1 : v.len) * rand(0.4, 1.8) }); }
        const a = HUMAN ? pick(HAND.angle) : HAND.expert.angle, l = HUMAN ? pick(HAND.len) : HAND.expert.len;
        const th = rand(-a, a) * Math.PI / 180, c = Math.cos(th), sn = Math.sin(th), x = v.dx || 0, y = v.dy || 0;
        return Object.assign({}, v, { dx: x * c - y * sn, dy: x * sn + y * c, len: (v.len == null ? 1 : v.len) * (1 + rand(-l, l)) });
      },
      /** a tap or press point { x, y } in frame fractions, as the hand would land it */
      point(p) { count++; const j = HUMAN ? pick(HAND.point) : HAND.expert.point; return { x: clamp(p.x + rand(-j, j), 0, 1), y: clamp(p.y + rand(-j, j), 0, 1) }; },
    };
  })();
  const dist = (a, b) => Math.hypot(a.x - b.x, (a.y - b.y) * 1.5);   // frame widths (the frame is 2:3, so a height fraction is 1.5 widths)

  let game = null, VIEW = null, SFX = null;
  const shakeXY = { x: 0, y: 0 };   // this frame's shake offset in CSS pixels, shared with the world layer
  const S = () => game.S;

  // ── sound core: synthesised, created on the first user tap (autoplay rules); ?mute keeps it silent ──
  function makeSfx(build) {
    let ac = null, muted = MUTE;
    const ctx = () => { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } } if (ac && ac.state === 'suspended') ac.resume(); return ac; };
    function tone(f, t, dur, type, g, slide) { const a = ctx(); if (!a || muted) return; const o = a.createOscillator(), v = a.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur); v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g || .25, t + .005); v.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(v).connect(a.destination); o.start(t); o.stop(t + dur + .02); }
    function noise(t, dur, g, lp) { const a = ctx(); if (!a || muted) return; const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const src = a.createBufferSource(); src.buffer = b; const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 1200; const v = a.createGain(); v.gain.value = g || .3; src.connect(f).connect(v).connect(a.destination); src.start(t); }
    const now = () => (ctx() ? ac.currentTime : 0);
    const api = { unlock() { ctx(); }, get muted() { return muted; }, set muted(v) { muted = v; }, tone, noise, now };
    const set = build ? build(api) : {};
    return Object.assign(api, set, { win: set.win || (() => { const t = now(); [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * .11, .3, 'triangle', .18)); }), fail: set.fail || (() => { const t = now(); tone(300, t, .25, 'sawtooth', .1, -110); tone(200, t + .22, .4, 'sawtooth', .1, -90); }) });
  }

  // ── finish: the round ends; in attract the game loops; otherwise the reveal, then the card ──
  function finish(result, why) {
    const st = S();
    if (st.mode === 'attract') { game.reset('attract'); return; }
    // a round ends ONCE (2026-11-05, the owner on run C: the fail card and the win card came up together, because a piece still
    // in the air went in after the buzzer had ended the round). The first end stands; a later one is counted for the sims and
    // ignored. A game that wants a thing in flight to count waits for it before it ends the round.
    if (st.mode === 'fail' || st.mode === 'reveal' || st.mode === 'win') { st.endedTwice = (st.endedTwice || 0) + 1; return; }
    // THE CLOCK CLOSES THE INPUT, NOT THE WORLD (2026-11-05, the owner on run C's landed game: "the time ends but a shot is in
    // the air ... shouldn't that in-motion shot be counted if it lands, even if the buzzer has hit, like basketball does?").
    // A round that would fail while something the player launched can still score is CLOSED, not ended: no more input (the
    // handlers and the bot below), the game goes on stepping its motion in play mode, and closeStep ends the round when
    // that motion has resolved. It still ends once: a win from that motion is the round's one ending.
    if (result !== 'win' && !st.closeDone) {
      if (st.closed) return;
      if (game.pending && game.pending()) { st.closed = true; st.closing = 0; st.closedWhy = why || null; st.down = false; return; }
    }
    if (result === 'win' && st.closed) st.wonLate = 1;
    // ?hold wants the win's payoff: a bot's failed round plays again (the perfect bot still loses a few in a hundred)
    if (has('hold') && result !== 'win') { game.reset('play'); return; }
    st.mode = result === 'win' ? 'reveal' : 'fail'; st.why = why || null; st.reveal = 0; st.down = false;
    if (SIM) return;
    if (result === 'win') { SFX.win(); hideHud(true); if (!has('hold')) setTimeout(() => showCard('win'), game.winDelayMs || 1100); }
    else { SFX.fail(); hideHud(true); setTimeout(() => showCard('fail'), game.failDelayMs || 800); }
  }
  // a closed round's clock: ended when nothing launched is still in motion, or after closeSecs (a rolling piece never holds the card)
  function closeStep(dt) {
    const st = S();
    if (!st.closed || st.mode !== 'play') return;
    st.closing = (st.closing || 0) + dt;
    if (!(game.pending && game.pending()) || st.closing > (game.closeSecs || 2.5)) { st.closeDone = true; finish('fail', st.closedWhy); }
  }
  function cue(text, secs) { const st = S(); st.cue = { text, until: st.elapsed + (secs || 1.6) }; }

  // ── sim: instant rounds with the chosen bot; the page becomes the report ──
  // the bots throw what the player throws (2026-11-05, on the chicken: its shape went through a hoop 39 times in 180 where the rounded stand-in of the
  // same slot went 63, its corners catch the rim): the sim waits for the page's model layers, and a mesh that is not there leaves the stand-in
  function simOnModels(view, go) {
    const MODELS = window.MODELS, ids = MODELS ? ((view && view.layers) || []).filter(l => l.type === 'model').map(l => l.id) : [];
    if (!ids.length) return go();
    for (const id of ids) if (!MODELS.records[id]) { try { MODELS.load(id, `assets/models/${id}.glb`, { optional: true }); } catch (e) { /* the stand-in stays */ } }
    const t0 = performance.now();
    (function wait() {
      const open = ids.some(id => { const r = MODELS.records[id]; return r && !r.ready && !r.error; });
      if (!open || performance.now() - t0 > 8000) return go();
      setTimeout(wait, 50);
    })();
    throw new Error('sim done');   // the page stops here as it does after a sim: no loop starts while the bots wait for the meshes
  }
  function runSim() {
    const out = [];
    const N = +(Q.get('n') || 20);   // ?n=60 for a steadier band
    for (let r = 0; r < N; r++) {
      game.reset('play'); hand.reset(); let n = 0;
      // ?idle: no input at all, so a game that wins itself shows up (owner 2026-10-18: the mechanic must matter)
      while (S().mode === 'play') { if (!IDLE && !S().closed) game.autopilot(1 / 60); game.update(1 / 60); closeStep(1 / 60); if (++n > 60 * 90) break; }   // 90 s: a three-stage session outlasts 30 (2026-11-04)
      const st = S();
      out.push(`${st.mode === 'reveal' || st.mode === 'win' ? 'win ' : 'fail'} ${game.simLine ? game.simLine() : `t=${st.elapsed.toFixed(1)} why=${st.why || '-'}`}${st.endedTwice ? ` ended-twice=${st.endedTwice}` : ''}${st.wonLate ? ' won-late=1' : ''}${st.timeLeft != null ? ` time-left=${Math.max(0, st.timeLeft).toFixed(1)}` : ''}`);
    }
    const wins = out.filter(l => l.startsWith('win')).length;
    const ph = window.PHYSICS && window.PHYSICS.stats;
    document.title = 'SIM'; document.body.innerHTML = `<pre id="sim">${IDLE ? 'idle bot' : WILD ? 'wild hand' : HUMAN ? (SLOW ? 'slow hand' : 'human bot') : 'perfect bot'}: ${wins}/${N} wins${ph ? ` rigid thrown=${ph.thrown} past=${ph.past}` : ''}\n${out.join('\n')}</pre>`;
    throw new Error('sim done');
  }

  // ── layer contract: blueprint / explained / geometry ──
  function layerRoutes() {
    const bp = Q.get('blueprint') || Q.get('explained');
    if (bp) {
      const L = VIEW.layers.find(l => l.id === bp); if (!L) { document.body.innerHTML = 'no layer ' + bp; throw new Error('no layer'); }
      const c = document.createElement('canvas'); const pc = L.states && L.cells && !(L.type === 'sheet' && L.cells.rows > 1) ? [L.canvas[0] / L.cells.cols, L.canvas[1] / L.cells.rows] : L.canvas; c.width = pc[0]; c.height = pc[1];   // a states layer's picture is ONE cell of its sheet: the base object on the cell's canvas, the edits on the same (B1a 2026-10-20) c.style.cssText = 'max-width:100%;height:auto;display:block;background:#4A5A7A';
      document.body.innerHTML = ''; document.body.style.cssText = 'margin:0;background:#222'; document.body.appendChild(c);
      const ctx = c.getContext('2d'); const o = { explain: has('explained'), key: L.key, cell: +(Q.get('cell') || 0) }; window.LAYERS.blueprint(ctx, L, c.width, c.height, o);
      document.title = `${L.id} ${L.name} ${has('explained') ? 'explained' : 'blueprint'}`; throw new Error('blueprint rendered');
    }
    if (has('geometry')) {
      document.body.innerHTML = `<pre id="geometry">${JSON.stringify({ variant: VIEW.id, canvas: VIEW.canvas, format: 'playable', key: '#4A5A7A', camera: VIEW.camera || null, geometry: VIEW.geometry(), layers: VIEW.layers.map(l => ({ id: l.id, name: l.name, type: l.type, canvas: l.canvas, key: l.key, box: l.box || null, pivot: l.pivot || null, cells: l.cells || null, states: l.states || false, camera: l.camera || null, notes: l.notes })) }, null, 2)}</pre>`;
      document.title = 'GEOMETRY'; throw new Error('geometry printed');
    }
  }

  // ── the frame: HUD, cards, loader (the same CSS as the pipeline's cores) ──
  const CSS = `
  html,body{margin:0;height:100%;background:#000;font-family:Inter,system-ui,sans-serif;-webkit-user-select:none;user-select:none}
  /* pixel floors (2026-11-03, the sizes pass): the parts scale with the frame (cqw), and in a slot smaller than the design
     (300x250, 480x320) a text never drops under 10 px nor a button under 32 px; the layout gives way, the words still read */
  .frame{--accent:#1F5FBF;--ink:#13233d;--red:#d8432f;position:relative;width:min(100vw,calc(100dvh*2/3));aspect-ratio:2/3;margin:0 auto;overflow:hidden;background:#2a2a2e;container-type:inline-size;touch-action:none}
  canvas#game{position:absolute;inset:0;width:100%;height:100%;display:block}
  .hud{position:absolute;inset:0;pointer-events:none;color:#fff;font-weight:700}
  .top{position:absolute;left:3cqw;right:3cqw;top:3cqw;display:flex;justify-content:space-between;align-items:flex-start;font-size:max(3.6cqw,10px)}
  .pill{background:#fff;border-radius:999px;padding:1.4cqw 3.2cqw;color:var(--ink);box-shadow:0 .6cqw 1.6cqw rgba(0,0,0,.18)}
  .pill.bump{animation:bump .28s cubic-bezier(.2,1.6,.4,1)}@keyframes bump{0%{transform:scale(1)}40%{transform:scale(1.22)}100%{transform:scale(1)}}
  .brandmark{position:absolute;left:50%;top:2.75cqw;transform:translateX(-50%);height:9.5cqw;display:flex;align-items:center;justify-content:center;font-size:max(3cqw,10px);font-weight:900;letter-spacing:.14em;color:var(--ink);border:1px dashed rgba(19,35,61,.45);border-radius:1.5cqw;padding:0 3cqw;background:rgba(255,255,255,.5)}
  .flare{position:absolute;left:50%;bottom:4cqw;transform:translateX(-50%);display:flex;gap:1.6cqw;align-items:center;background:rgba(255,255,255,.85);border-radius:999px;padding:1.2cqw 2.6cqw}
  .flare[hidden]{display:none}
  .flare i{display:block;width:3cqw;height:3cqw;border-radius:50%;background:#dcdce2;transition:background .15s}
  .flare i.on{background:var(--red)}.flare i.last{outline:.4cqw solid var(--red);outline-offset:.3cqw}
  .flare b{font-size:max(2.6cqw,10px);color:var(--ink);margin-right:1cqw;letter-spacing:.06em}
  .hint{position:absolute;left:50%;top:13.5cqw;transform:translateX(-50%);font-size:max(3.4cqw,10px);background:var(--accent);color:#fff;border-radius:999px;padding:1.6cqw 4.4cqw;white-space:nowrap;box-shadow:0 .6cqw 1.6cqw rgba(0,0,0,.22);transition:opacity .25s}
  .hint.cue{background:#fff;color:var(--ink)}
  .card{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;padding:0 8cqw 9cqw;text-align:center;background:linear-gradient(180deg,rgba(255,255,255,0) 35%,rgba(255,255,255,.92) 62%)}
  .card[hidden]{display:none}
  .frame.carded .top,.frame.carded .hint,.frame.carded .flare,.frame.carded .greylabel{display:none}
  .frame.start-on .brandmark{display:none}
  .card .art-deco{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:0}.card>*:not(.art-deco){position:relative;z-index:1}
  .frame.own-hud .top,.frame.own-hud .flare{display:none}
  .frame.carded .game-hud,.frame.revealing .game-hud{display:none}
  .game-hud{position:absolute;inset:0;pointer-events:none}
  .frame.brand-low .card{padding-bottom:var(--brand-clear)}
  .card .stamp{font-size:10cqw;line-height:1;font-weight:900;letter-spacing:.04em;color:var(--accent);border:1.1cqw solid var(--accent);border-radius:2cqw;padding:1.6cqw 4cqw;transform:rotate(-6deg);animation:stamp .35s cubic-bezier(.2,1.4,.3,1) both;margin-bottom:5cqw}
  .card .stamp.bad{color:var(--red);border-color:var(--red)}
  @keyframes stamp{0%{transform:rotate(-6deg) scale(1.8);opacity:0}100%{transform:rotate(-6deg) scale(1);opacity:1}}
  .card h1{font-size:8.2cqw;line-height:1.05;margin:0;font-weight:900;color:var(--ink)}
  .card p{font-size:max(3.8cqw,10px);line-height:1.35;margin:2cqw 0 0;color:var(--ink);font-weight:600}
  .card .stat{display:inline-block;margin-top:3cqw;font-size:max(3.2cqw,10px);font-weight:800;color:var(--ink);background:#fff;border:1px solid #d2d2d7;border-radius:999px;padding:1.4cqw 4cqw}
  .card .stat:empty{display:none}
  .card .btn{font:inherit;font-weight:800;font-size:max(4.6cqw,10px);min-height:max(12cqw,32px);padding:2.6cqw 10cqw;margin-top:5cqw;border-radius:999px;border:0;background:var(--accent);color:#fff;cursor:pointer;box-shadow:0 1cqw 2.4cqw rgba(31,95,191,.35);animation:breathe 2.2s ease-in-out 1s infinite}
  .card .btn.ghost{background:transparent;color:var(--ink);box-shadow:none;animation:none;font-size:max(3.2cqw,10px);min-height:6cqw;padding:1cqw 3cqw;margin-top:1.6cqw;text-decoration:underline}
  @keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
  .card .hand{width:17cqw;height:17cqw;margin:0 0 2.5cqw;overflow:visible}
  .hand .mover,.hand .body{transform-origin:50% 60%;transform-box:fill-box}
  .hand .ring{fill:none;stroke:var(--accent);stroke-width:3.2;opacity:0;transform-origin:center;transform-box:fill-box}
  .hand .ring.fill{stroke-dasharray:63;stroke-dashoffset:63;transform:rotate(-90deg)}
  .hand.tap .body{animation:handTap 1.4s ease-in-out infinite}.hand.tap .ring{animation:ringTap 1.4s ease-out infinite}
  .hand.hold .body{animation:handHold 2.4s ease-in-out infinite}.hand.hold .ring.fill{animation:ringHold 2.4s linear infinite}
  .hand.swipe .mover{animation:handSwipe 1.8s ease-in-out infinite}.hand.swipe .ring{opacity:.45}
  .hand.drag .mover{animation:handDrag 2.4s ease-in-out infinite}.hand.drag .ring{opacity:.45}
  .hand.tilt .mover{animation:handTilt 2s ease-in-out infinite}
  @keyframes handTap{0%,100%{transform:translateY(0) scale(1)}22%{transform:translateY(8%) scale(.94)}44%{transform:translateY(0) scale(1)}}
  @keyframes ringTap{0%,20%{opacity:0;transform:scale(.4)}26%{opacity:.9;transform:scale(.6)}70%,100%{opacity:0;transform:scale(1.7)}}
  @keyframes handHold{0%,100%{transform:translateY(0) scale(1)}12%,72%{transform:translateY(8%) scale(.94)}82%{transform:translateY(-3%) scale(1.02)}}
  @keyframes ringHold{0%,11%{opacity:0;stroke-dashoffset:63}14%{opacity:.95;stroke-dashoffset:63}72%{opacity:.95;stroke-dashoffset:0}80%,100%{opacity:0;stroke-dashoffset:0}}
  @keyframes handSwipe{0%,100%{transform:translateX(-26%) rotate(-6deg)}50%{transform:translateX(26%) rotate(6deg)}}
  @keyframes handDrag{0%,100%{transform:translate(-20%,2%)}25%{transform:translate(0,-10%)}50%{transform:translate(20%,2%)}75%{transform:translate(0,12%)}}
  @keyframes handTilt{0%,100%{transform:rotate(-14deg)}50%{transform:rotate(14deg)}}
  .card .lockup{font-size:max(3cqw,10px);font-weight:900;letter-spacing:.14em;color:var(--ink);border:1px dashed rgba(19,35,61,.45);border-radius:1.5cqw;padding:1.4cqw 3cqw;margin-bottom:4cqw}
  .brandmark.plain,.card .lockup.plain{border:0;background:none;font-size:max(4.2cqw,10px);letter-spacing:.18em}
  .brandmark img{height:100%;max-height:9.5cqw;width:auto;max-width:72cqw;object-fit:contain;display:block}.card .lockup img{height:10cqw;width:auto;display:block}
  .loader{position:absolute;inset:0;z-index:9;display:flex;align-items:center;justify-content:center;background:#f3ece8;transition:opacity .45s ease}
  .loader.done{opacity:0;pointer-events:none}.loader[hidden]{display:none}
  .loader .bar{width:38cqw;height:1.4cqw;border-radius:1cqw;background:rgba(19,35,61,.12);overflow:hidden}.loader .bar i{display:block;height:100%;width:0;background:var(--accent);border-radius:1cqw;transition:width .25s ease}
  .frame.loading canvas#game,.frame.loading .hud,.frame.loading .card{visibility:hidden}
  .greylabel{position:absolute;right:2cqw;bottom:11.5cqw;font-size:2.4cqw;color:rgba(19,35,61,.55);font-weight:700;letter-spacing:.08em}
  .frame.revealing .top,.frame.revealing .hint,.frame.revealing .flare{opacity:0;transition:opacity .3s}
  html.embed,html.embed body{background:#000;overflow:hidden;height:100%}html.embed body{display:flex;align-items:center;justify-content:center}html.embed .frame{width:min(100vw,calc(100vh * 2 / 3));height:min(100vh,calc(100vw * 3 / 2));aspect-ratio:auto;margin:0}
  /* the frame fills a portrait slot from 9:19.5 to 3:4 (a phone, an interstitial): the world's camera takes the real aspect and the 2D layout is in % and cqw; outside the band the 2:3 frame is centred (2026-11-05: both references filled the phone, ours sat letterboxed) */
  @media (min-aspect-ratio:9/19.5) and (max-aspect-ratio:3/4){html.embed .frame{width:100vw;height:100vh}}
  `;
  let showCard = () => {}, hideHud = () => {};
  // which cards show, as classes on the frame (sonic-01 fix, pipeline rules 38-39): `:has()` re-styled the whole frame on
  // every DOM change, worst in Safari; every place that shows or hides a card calls this once
  const syncCards = () => {
    const f = document.getElementById('frame'); if (!f) return;
    const shown = id => { const el = document.getElementById(id); return !!el && !el.hidden; };
    f.classList.toggle('carded', shown('startCard') || shown('winCard') || shown('failCard'));
    f.classList.toggle('start-on', shown('startCard'));
  };

  function mount() {
    const CONFIG = game.CONFIG, C = CONFIG.copy;
    // the start card's hand plays the card's one gesture (2026-10-29, the owner: one hand for every game, gliding left and
    // right under "Hold to crouch"): CONFIG.gesture names it, the practices check asks for it, and the hand presses (tap),
    // presses and holds while a ring fills (hold), glides (swipe), follows a loop (drag) or rocks (tilt)
    const GESTURE = /^(tap|hold|swipe|drag|tilt)$/.test(String(CONFIG.gesture)) ? CONFIG.gesture : 'tap';
    const handSvg = (g) => `<svg class="hand ${g}" viewBox="0 0 100 100" aria-hidden="true">` +
      '<defs><linearGradient id="handGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cfd5e0"/></linearGradient>' +
      '<filter id="handShade" x="-25%" y="-25%" width="150%" height="160%"><feDropShadow dx="0" dy="2.5" stdDeviation="2.2" flood-color="#13233d" flood-opacity=".3"/></filter></defs>' +
      `<g class="mover"><circle class="ring${g === 'hold' ? ' fill' : ''}" cx="45.5" cy="19" r="10"/>` +
      '<g class="body" filter="url(#handShade)" fill="url(#handGrad)" stroke="#13233d" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">' +
      '<path d="M39 58 V21 a6.5 6.5 0 0 1 13 0 v26 a6 6 0 0 1 12 0 v5 a6 6 0 0 1 12 0 v6 a5.5 5.5 0 0 1 11 0 v12 c0 15 -10 25 -25 25 h-8 c-10 0 -18 -6 -22 -15 l-10 -16 a6 6 0 0 1 10 -7 l7 9 z"/>' +
      '<path d="M52 47 v12 M64 52 v9 M76 58 v8" fill="none" opacity=".9"/></g></g></svg>';
    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    // an art pass's composition for this page (opt-in): its CSS lands after the engine's, so it wins on the same selectors
    // the art pass's display fonts (2026-10-16), from the approved list only, one request
    const ART_FONTS = ["Lilita One","Luckiest Guy","Bungee","Titan One","Bangers","Russo One","Press Start 2P","Bebas Neue","Anton","Archivo Black","Fredoka","Baloo 2","Poppins","Montserrat","Oswald","Rubik"];
    const fonts = (VIEW.artFonts || []).filter(f => ART_FONTS.includes(f)).slice(0, 2);
    if (fonts.length) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?' + fonts.map(f => 'family=' + f.replace(/ /g, '+')).join('&') + '&display=swap'; document.head.appendChild(l); }
    if (VIEW.art) { const art = document.createElement('style'); art.id = 'art'; art.textContent = VIEW.art; document.head.appendChild(art); }
    if (!document.querySelector('link[href*="Inter"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@600;700;800;900&display=swap'; document.head.appendChild(l); }
    // the kit's mark from the run's own folder (assets/brand/logo.png beside a build, ../assets/brand/ beside a greybox page; owner 2026-10-20: the mark needs no build), the wordmark when there is none
    const logoSrc = VIEW.brandLogo || (VIEW.build ? 'assets/brand/logo.png' : '../assets/brand/logo.png');
    const mark = `<img src="${logoSrc}" alt="${C.brand}" onerror="this.replaceWith(document.createTextNode(this.alt))">`;
    const hud0 = game.hud ? game.hud() : {};
    const dots = hud0.dots ? Array.from({ length: hud0.dots.total }, (_, i) => `<i class="${i === hud0.dots.total - 1 ? 'last' : ''}"></i>`).join('') : '';
    document.body.innerHTML = `
    <div class="${VIEW.build ? 'frame loading' : 'frame'}" id="frame">
      <canvas id="game"></canvas>
      <div class="hud">
        <div class="top"><span class="pill" id="count">${hud0.left || ''}</span><span class="pill" id="timer">${hud0.right || ''}</span></div>
        <div class="brandmark${VIEW.build ? ' plain' : ''}">${mark}</div>
        <div class="hint" id="hint">${C.hint || ''}</div>
        <div class="flare" id="flare" ${hud0.dots ? '' : 'hidden'}><b>${hud0.dots ? hud0.dots.label : ''}</b>${dots}</div>
        ${VIEW.build || VIEW.final ? '' : `<div class="greylabel">GREYBOX · ${(VIEW.title || VIEW.id || '').toUpperCase()}</div>`}
      </div>
      ${VIEW.build ? '<div class="loader" id="loader" role="progressbar"><div class="bar"><i id="loadBar"></i></div></div>' : ''}
      <div class="card start" id="startCard"><div class="lockup${VIEW.build ? ' plain' : ''}">${mark}</div><h1>${C.startTitle}</h1><p>${C.startLine}</p>
        ${handSvg(GESTURE)}
        <button class="btn" id="playBtn" type="button">${C.play}</button></div>
      <div class="card" id="winCard" hidden><div class="stamp">${C.winStamp}</div><h1>${C.winTitle}</h1><p>${C.winLine}</p><div class="stat" id="winStat"></div>
        <button class="btn" id="cta1" type="button">${C.cta}</button><button class="btn ghost" id="again1" type="button">${C.again}</button></div>
      <div class="card" id="failCard" hidden><div class="stamp bad">${C.failStamp}</div><h1 id="failWhy"></h1><p>${C.failLine}</p><div class="stat" id="failStat"></div>
        <button class="btn" id="again2" type="button">${C.again}</button><button class="btn ghost" id="cta2" type="button">${C.cta}</button></div>
    </div>`;
    const $ = id => document.getElementById(id);
    // the art pass's own pieces on each screen (2026-10-16: bands, strips, stamps), markup only, behind the card's parts
    if (VIEW.artDecor) for (const [k, id] of [['start', 'startCard'], ['win', 'winCard'], ['fail', 'failCard']]) {
      const html = String(VIEW.artDecor[k] || '').replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
      if (html.trim()) { const d = document.createElement('div'); d.className = 'art-deco'; d.setAttribute('aria-hidden', 'true'); d.innerHTML = html; $(id).prepend(d); }
    }
    // the brand mark sits where the game's own layout puts its brand layer (owner 2026-10-15 23:29); the top centre is
    // only the fallback for a page that declares none. A brand in the lower half lifts the cards' content clear of it.
    const brandL = (VIEW.layers || []).find(l => l.type === 'brand' && l.box);
    if (brandL && window.LAYERS && window.LAYERS.boxPx) {
      const b = window.LAYERS.boxPx(brandL, 1, 1), m = document.querySelector('.brandmark');
      Object.assign(m.style, { left: b.x * 100 + '%', top: b.y * 100 + '%', width: b.w * 100 + '%', height: b.h * 100 + '%', transform: 'none' });
      if (b.y > 0.5) { $('frame').classList.add('brand-low'); $('frame').style.setProperty('--brand-clear', `calc(${((1 - b.y) * 150).toFixed(2)}cqw + 3cqw)`); }
    }
    // the game's own HUD (owner 2026-10-16): a page that plans one supplies it, and the engine's pills step aside
    let gameHud = null;
    if (VIEW.hud && (VIEW.hud.html || VIEW.hud.update)) {
      gameHud = document.createElement('div'); gameHud.className = 'game-hud'; gameHud.innerHTML = VIEW.hud.html || '';
      document.querySelector('.hud').appendChild(gameHud); $('frame').classList.add('own-hud');
      if (VIEW.hud.css) { const hs = document.createElement('style'); hs.textContent = VIEW.hud.css; document.head.appendChild(hs); }
    }
    const canvas = $('game'), ctx = canvas.getContext('2d');
    // the world kit (2026-10-18): a page that describes a world gets it on the GPU under this canvas. A device with no
    // WebGL at all gets the start card as an end card: the brand and the call to action, never a half-drawn game
    if (VIEW.world && window.WORLD && !window.WORLD.init(VIEW.world)) {
      $('frame').classList.add('no-world');
      const sc = $('startCard'); sc.hidden = false;
      $('playBtn').textContent = C.cta; $('playBtn').onclick = () => window.open(window.clickTag || CONFIG.ctaUrl, '_blank');
      const hand = sc.querySelector('.hand'); if (hand) hand.remove();
      syncCards();
      return;
    }
    let W = 640, H = 960, dpr = Math.min(1.5, devicePixelRatio || 1);   // the phone budget (rule 27): 1.5x is sharp at slot size, 2x costs 78% more pixels a frame
    // the backing canvas a whole number of device pixels (sonic-01 fix): a fractional size resamples every frame
    const resize = () => { const r = $('frame').getBoundingClientRect(); W = r.width; H = r.height; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); };
    new ResizeObserver(resize).observe($('frame')); resize();
    showCard = which => {
      const stat = game.stat ? game.stat() : '';
      if (which === 'win') { $('winStat').textContent = stat; $('winCard').hidden = false; }
      else { $('failWhy').textContent = game.failWhy ? game.failWhy() : (C.failWhy && (C.failWhy[S().why] || C.failWhy.time)) || ''; $('failStat').textContent = stat; $('failCard').hidden = false; }
      $('hint').style.display = 'none';
      syncCards();
    };
    hideHud = on => $('frame').classList.toggle('revealing', !!on);
    window.__showCard = showCard; window.__hideHud = hideHud;
    const hideCards = () => { $('winCard').hidden = true; $('failCard').hidden = true; $('startCard').hidden = true; $('hint').style.display = ''; $('frame').classList.remove('revealing'); syncCards(); };
    const startRound = () => { hand.reset(); hideCards(); SFX.unlock(); if (SFX.reset) SFX.reset(); game.reset('play'); };
    window.DEMO = { start: () => { hideCards(); game.reset('attract'); $('startCard').hidden = false; syncCards(); }, slotMs: 20000, setAuto: () => {}, setSound: on => { SFX.muted = !on; } };
    $('playBtn').onclick = startRound; $('again1').onclick = startRound; $('again2').onclick = startRound;
    $('cta1').onclick = $('cta2').onclick = () => window.open(window.clickTag || CONFIG.ctaUrl, '_blank');
    const fp = e => { const r = $('frame').getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
    $('frame').addEventListener('pointerdown', e => {
      try { const p = fp(e); parent.postMessage({ iionTap: p }, '*'); } catch (err) {}
      if (e.target.closest('.card')) return;
      if (S().closed) return;   // the clock has closed the input; what is in motion plays out
      if (S().mode === 'attract') startRound();
      game.press(fp(e), 'user');
    });
    $('frame').addEventListener('pointermove', e => { if (S().down && !BOT && !S().closed && game.move) game.move(fp(e)); });
    window.addEventListener('pointerup', () => { if (!BOT && !S().closed && game.release) game.release(); }); window.addEventListener('pointercancel', () => { if (!BOT && !S().closed && game.release) game.release(); });
    window.addEventListener('keydown', e => { if (e.code === 'Space') { if (S().mode === 'attract') startRound(); game.press({ x: 0.5, y: 0.6 }, 'key'); } });
    game.reset(BOT && !ATTRACT ? 'play' : 'attract');
    if (ATTRACT || BOT) $('startCard').hidden = true;
    syncCards();
    // the HUD's last written values: the page is written only when a value changes (sonic-01 fix, rule 38)
    const FX = { left: null, on: -1, count: null, timer: null, hint: null, cue: null, op: null };
    const put = (key, el, v) => { if (FX[key] !== v) { FX[key] = v; el.textContent = v; } };
    let fault = false;
    let last = performance.now();
    // paused while the planner is not looking (2026-10-16: two frames playing at once stuttered on a phone): the studio
    // posts {iionPlay: false} for a frame out of view, and a hidden tab pauses; the loop stops, nothing is drawn
    let paused = false, looping = true;
    const setPlay = on => { paused = !on; if (!paused && !looping) { looping = true; last = performance.now(); requestAnimationFrame(frame); } };
    window.addEventListener('message', e => {
      if (e.data && typeof e.data.iionPlay === 'boolean') setPlay(e.data.iionPlay);
      // a piece that landed while this frame plays (the card posts it): the layer takes it in place with its reveal
      if (e.data && e.data.iionArt && window.LAYERS && window.LAYERS.arrive) window.LAYERS.arrive(String(e.data.iionArt.id), String(e.data.iionArt.src), e.data.iionArt.meta ? String(e.data.iionArt.meta) : undefined);
    });
    document.addEventListener('visibilitychange', () => setPlay(document.visibilityState === 'visible'));
    const els = { count: $('count'), timer: $('timer'), hint: $('hint'), flare: $('flare') };
    // ?fps: the frame rate and the slowest frame of the last half second, for a check on a real phone (the truth; a
    // server's software GPU is not)
    const fpsEl = has('fps') ? Object.assign(document.createElement('div'), { style: 'position:absolute;left:2cqw;bottom:2cqw;z-index:20;font:700 3cqw/1 monospace;color:#fff;background:rgba(0,0,0,.6);padding:1cqw 1.6cqw;border-radius:1cqw;pointer-events:none' }) : null;
    if (fpsEl) $('frame').appendChild(fpsEl);
    const fpsT = { n: 0, at: performance.now(), worst: 0 };
    function frame(now) {
      if (paused && !SIM) { looping = false; return; }
      // the next frame is booked first (sonic-01 fix): a fault in one frame is reported once and never stops the game
      requestAnimationFrame(frame);
      try { step(now); } catch (e) { if (!fault) { fault = true; console.error('frame fault', e); } }
    }
    function step(now) {
      // the raw frame time, clamped to 50 ms (pipeline rule 38): smoothing it made uneven phone frames judder
      if (fpsEl) { fpsT.n++; fpsT.worst = Math.max(fpsT.worst, now - last); if (now - fpsT.at >= 500) { fpsEl.textContent = `${Math.round(fpsT.n * 1000 / (now - fpsT.at))} fps · worst ${Math.round(fpsT.worst)} ms`; fpsT.n = 0; fpsT.at = now; fpsT.worst = 0; } }
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const st = S();
      if (st.mode === 'attract' || (BOT && !ATTRACT && st.mode === 'play' && !st.closed)) game.autopilot(dt);
      game.update(dt);
      closeStep(dt);
      // the hit shake is a smooth decaying wobble (sonic-01 fix): random jitter each frame read as the game shaking.
      // Kept on ENGINE.shake for a world layer drawn elsewhere (the world kit), so every layer moves together
      const k = st.shake > 0 ? 4 * st.shake : 0;
      shakeXY.x = k ? Math.sin(now * 0.047) * k : 0; shakeXY.y = k ? Math.cos(now * 0.039) * k : 0;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.save(); if (k) ctx.translate(shakeXY.x, shakeXY.y);
      VIEW.drawFrame(ctx, st, W, H, CONFIG);
      ctx.restore();
      // the scene's light, by the page's lighting plan (2026-10-16): always over the world, under the HUD and the cards
      if (VIEW.light && window.LAYERS && window.LAYERS.light) window.LAYERS.light(ctx, W, H, VIEW.light);
      const h = game.hud ? game.hud() : {};
      if (gameHud && VIEW.hud.update) { try { VIEW.hud.update(st, gameHud, h); } catch (e) { /* a HUD fault never stops the round */ } }
      put('count', els.count, h.left || ''); put('timer', els.timer, String(h.right != null ? h.right : (st.timeLeft != null ? st.timeLeft.toFixed(1) : '')));
      if (h.left !== FX.left) { FX.left = h.left; const c = els.count; c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
      if (h.dots && h.dots.on !== FX.on) { FX.on = h.dots.on; els.flare.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i < h.dots.on)); }
      const cueOn = !!(st.cue && st.elapsed < st.cue.until);
      put('hint', els.hint, cueOn ? st.cue.text : (h.hint != null ? h.hint : C.hint || ''));
      if (FX.cue !== cueOn) { FX.cue = cueOn; els.hint.classList.toggle('cue', cueOn); }
      const op = cueOn || st.mode === 'attract' || (h.hintOn != null ? h.hintOn : (st.mode === 'play' && st.elapsed < 4)) ? '1' : '0';
      if (FX.op !== op) { FX.op = op; els.hint.style.opacity = op; }
    }
    requestAnimationFrame(frame);
  }

  function run(g, view) {
    game = g; VIEW = view; SFX = makeSfx(game.sounds);
    try { window.__VIEW_GEOMETRY = VIEW.geometry ? VIEW.geometry() : null; } catch (e) { window.__VIEW_GEOMETRY = null; }   // read by the layout check
    window.__VIEW_LIGHT = VIEW.light || null;   // read by the layout check: the page's lighting plan
    window.__VIEW_PICTURES = (VIEW.layers || []).filter(l => ['sprite', 'sheet', 'viewmodel'].includes(l.type)).length;
    game.engine = { SFX, finish, cue, hand, HUMAN, BOT, SIM, ATTRACT, clamp, rand, dist, Q, has };
    // the world's shape before the game starts, so a sim plays the track the player sees (its path and width)
    if (VIEW.world && window.WORLD && window.WORLD.configure) window.WORLD.configure(VIEW.world);
    if (game.init) game.init(VIEW);
    if (!SIM && window.MODELS) for (const l of VIEW.layers || []) if (l.type === 'model' && !window.MODELS.records[l.id]) { try { window.MODELS.load(l.id, `assets/models/${l.id}.glb`, { optional: true }); } catch (e) { /* the stand-in stays */ } }
    if (SIM) simOnModels(view, runSim); layerRoutes();
    if (has('embed') || has('full')) document.documentElement.classList.add('embed');
    mount();
    if (VIEW.build && window.LAYERS) {   // gate: nothing shows until every picture and the meta have settled (D-027); 10 s cap
      let expect = 1 + VIEW.layers.filter(L => ['plate', 'sprite', 'sheet', 'viewmodel', 'mask-texture', 'particle', 'occluder', 'tile'].includes(L.type) && L.canvas).length, done = 0, ready = false;
      const reveal = () => { if (ready) return; ready = true; setTimeout(() => { const l = document.getElementById('loader'); if (l) { l.classList.add('done'); setTimeout(() => { l.hidden = true; }, 500); } document.getElementById('frame').classList.remove('loading'); }, 250); };
      window.LAYERS.load(VIEW.layers, 'assets/game/', () => { done++; const b = document.getElementById('loadBar'); if (b) b.style.width = Math.min(100, Math.round(done / expect * 100)) + '%'; if (done >= expect) reveal(); });
      setTimeout(reveal, 10000);
    } else if (window.LAYERS) window.LAYERS.load(VIEW.layers, 'assets/game/');
    window.GAME = { get S() { return S(); }, CONFIG: game.CONFIG, reset: m => game.reset(m), press: (p, s) => game.press(p, s), move: p => game.move && game.move(p), release: () => game.release && game.release(), get pending() { return !!(game.pending && game.pending()); } };
    const qc = Q.get('card'); if (qc) setTimeout(() => { ['startCard', 'winCard', 'failCard'].forEach(i => { const el = document.getElementById(i); if (el) el.hidden = true; }); if (game.cardState) game.cardState(qc); else S().mode = qc === 'win' ? 'win' : 'fail'; showCard(qc); hideHud(true); }, 200);
  }

  return { run, finish, cue, hand, get SFX() { return SFX; }, get S() { return S(); }, get shake() { return shakeXY; }, HUMAN, BOT, SIM, ATTRACT, MUTE, clamp, rand, dist, Q, has };
})();
