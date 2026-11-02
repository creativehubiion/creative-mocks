/* BUILD (05-build): the greybox core with the pack's art drawn in each layer's place; ?noart shows the greybox shapes.
   Toss It High — shared game core for every greybox view of pizzahut-01 (rules, CONFIG, strings, state, input, physics, HUD, cards,
   bots, sim, layer contract). A view supplies its camera (where the table sits, how many pixels a metre is, whether the camera follows
   the toss) and its layers; the game is the same in every view.
   Hooks: ?bot (autopilot plays a real round) · ?sim (instant rounds, ?n=) · ?sim&human (first-timer bot) · ?attract (plays itself
          behind the start card; the panel) · ?blueprint=Lx · ?explained=Lx · ?geometry · ?card=win|fail · ?cfg={json} (tuning only)
   window.GAME = { S, CONFIG, launch, reset }
   The rule: the Lohei Pizza sits on the table, its added toppings heaped on it. Flick up from the pizza: the faster the flick, the higher
   the mix flies (speed sets height). Toss it to the glowing lantern and it lights; each lantern hangs higher. Too soft and it falls short;
   too hard and it sails past, and past the top it hits the fan and rains onto the floor ('Floor of Gold!'). Five lanterns lit wins;
   three misses lose. Greyboxes are silent (rule 43 addendum). */
(function () {
  const Q = new URLSearchParams(location.search), has = k => Q.has(k);
  // ── every word on screen (owner 17:24: English for review and ship; the phrases by their meaning) ──
  const STRINGS = { en: {
    startTitle: 'Toss your Lohei Pizza', startLine: 'Flick up to toss it to the glowing lantern.', play: 'Play',
    hint: 'Flick up to toss', logo: 'Pizza Hut logo', logoNote: '(client file)',
    phrases: ['Great luck!', 'Sweet life!', 'Rising higher!', 'Good health!', 'All wishes come true!'],   // 'Floor of gold' is kept for the fan: the fail is the phrase taken literally
    fortunes: ['Great luck and prosperity', 'May your life be sweet', 'Rise higher, step by step', 'Good health all year', 'May all your wishes come true'],
    lantern: 'Lantern {n} of 5',
    harder: 'A little harder', softer: 'A little softer', tooHard: 'Too hard! Floor of gold!', flickIt: 'Flick it, faster!', flickUp: 'Flick up!',
    cueSway: 'It sways. Watch it!', cueFan: 'Last one! Toss it high!', yourToss: 'your toss',
    winStamp: 'PROSPER!', failStamp: 'FLOOR OF GOLD!', failLine: 'Well, the floor got the gold this year.',
    yours: 'Your 2027:', stat: 'Tossed {m} m · {n} of 5 lanterns',
    item: '‘Lohei’ Pizza', itemSub: 'Chinese New Year 2027', photo: 'Lohei Pizza photo (client)', standIn: 'Stand-in photo', prodKick: 'New this Chinese New Year', startReward: 'Light all 5 lanterns to unlock a CNY treat', rewardKick: 'Win a CNY treat!', rewardLine: 'Light all 5 lanterns to unlock it', ticketKick: 'CNY treat unlocked!', ticketLine: 'Claim it with your Lohei Pizza order', claim: 'Claim my treat', playAgain: 'Play again', lockedKick: 'So close!', lockedLine: 'Your CNY treat is one toss away', prodLine: 'Pour on the toppings, then toss it high together for a year of prosperity.', addsKick: 'Pour on and toss', adds: [['Pok Cui crackers', ''], ['Lime strip peel', ''], ['Crispy cereal crunch', '']], /* owner 20:20: blessings off until the client gives one for each */
    couponKick: 'Your CNY treat', couponLine: 'Offer from Pizza Hut (to be confirmed)', couponCode: 'Code: ●●●●●●', couponTc: 'T&Cs apply',
    cta: 'Order now', share: 'Share', again: 'Toss again', shareText: 'I tossed my Lohei Pizza {m} m. Prosper! Toss yours:',
    up: '↑ {m} m', tossHere: 'Toss here',
  } };
  const C = STRINGS.en;
  const CONFIG = {
    ctaUrl: 'https://www.pizzahut.com.sg/',   // placeholder until the client gives the order link; window.clickTag overrides
    G: 7,                                     // m/s²: a little under real gravity, so a 2.6 m toss takes ~0.9 s up and reads
    ceil: 2.95,                               // the fan, metres above the table
    lanterns: [0.95, 1.4, 1.85, 2.25, 2.6],   // metres above the table
    bob: [0, 0, 0.05, 0.03, 0], endEase: [0, 0, 0.06, 0.18, 0.3], /* owner 19:26: the end is easy */ bobPeriod: 2.6,   // the draught: lanterns 3-5 rise and fall on their cords (the pressure)
    win0: 0.28, win1: 0.09,                   // half-window = win0 + win1 × height: a target's window grows with its distance (all.md 2026-10-29 23:39); sims 2026-10-30 n=150: perfect 100%, first-timer 65%
    tries: 3,                                 // three misses lose (each costs one cracker pip, seen in the HUD)
    spm: 900,                                 // finger speed (logical px/s) for each metre of toss: speed sets height, linearly
    grab: 90,                                 // the launch strip (px): the chopsticks follow the finger this far, then the mix is thrown
    assist: true,                             // the first toss of a game lands if it is anywhere near (rig the first move)
    idleHint: 3,                              // the ghost hand comes back after this many seconds without a touch
  };
  let CFG_Q = {}; if (Q.get('cfg')) try { CFG_Q = JSON.parse(Q.get('cfg')); } catch (e) { console.error('bad ?cfg', e); }   // tuning only; applied over the view's own config at run()
  const BOT = has('bot') || has('attract'), HUMAN = has('human'), SIM = has('sim'), ATTRACT = has('attract');
  const W = 640, H = 960, CX = 320;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rand = (a, b) => a + Math.random() * (b - a), lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
  const gauss = () => { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const KIND = ['#E8B400', '#8CC63F', '#E9D3A1'];   // gold crackers, lime peel, cereal crunch (game colours; the client's photos replace them)
  let V = null, S = null, cv, ctx;
  const GAIN = { toss: 0.67, lit: 0.27, fan: 1.05, win: 0.15, fail: 0.21 };   // set from sfx_measure.mjs (offline render, phone high-pass)
  const SFX = (() => {
    let ac = null, muted = false; try { muted = localStorage.getItem('ph-lohei-mute') === '1'; } catch (e) {}
    const ctxA = () => { if (SIM || NOART) return null; if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' }); } catch (e) { ac = null; } } if (ac && ac.state === 'suspended') ac.resume(); return ac; };
    const busOf = a => { if (a.__bus) return a.__bus; const m = a.createGain(), hp = a.createBiquadFilter(), c = a.createDynamicsCompressor(); m.gain.value = 0.85; hp.type = 'highpass'; hp.frequency.value = 60;
      c.threshold.value = -8; c.knee.value = 4; c.ratio.value = 20; c.attack.value = 0.002; c.release.value = 0.12; m.connect(hp); hp.connect(c); c.connect(a.destination); a.__bus = m; return m; };
    function bell(a, f, t, dur, g) {   // a struck bell: four partials, the higher ones dying first
      [[1, 1], [2, 0.45], [3.01, 0.25], [4.23, 0.12]].forEach(([r, amp], k) => { const o = a.createOscillator(), v = a.createGain(); o.type = 'sine'; o.frequency.value = f * r;
        v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g * amp, t + 0.004); v.gain.exponentialRampToValueAtTime(0.0001, t + dur / (1 + k * 0.7)); o.connect(v); v.connect(busOf(a)); o.start(t); o.stop(t + dur + 0.05); });
    }
    function hiss(a, t, dur, g, f0, f1, q, rise) {   // band-passed noise; a 4 ms fade-in so it never clicks
      const n = Math.max(1, Math.floor(a.sampleRate * dur)), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      const src = a.createBufferSource(), bp = a.createBiquadFilter(), v = a.createGain(); src.buffer = b; bp.type = 'bandpass'; bp.Q.value = q; bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
      const pk = t + Math.max(0.004, dur * (rise || 0.02)); v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, pk); v.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(bp); bp.connect(v); v.connect(busOf(a)); src.start(t); src.stop(t + dur + 0.02);
    }
    function knock(a, f, t, dur, g) { const o = a.createOscillator(), v = a.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(f * 1.6, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.03);
      v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g, t + 0.003); v.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(v); v.connect(busOf(a)); o.start(t); o.stop(t + dur + 0.02); }
    const P = [783.99, 880, 987.77, 1174.66, 1318.51];   // G5 A5 B5 D6 E6: the lanterns climb the pentatonic scale
    const cues = {
      toss: (a, t, k) => hiss(a, t, 0.24 + 0.1 * k, GAIN.toss * (0.6 + 0.4 * k), 450, 2400 + 1200 * k, 0.8, 0.35),   // your flick: one airy whoosh, fuller when harder
      lit: (a, t, i) => { const f = P[Math.max(0, Math.min(4, i))]; bell(a, f, t, 0.9, GAIN.lit); bell(a, f * 1.5, t + 0.07, 0.5, GAIN.lit * 0.35); },   // a lantern lights: a chime a step higher each time
      fan: (a, t) => { knock(a, 210, t, 0.12, GAIN.fan); knock(a, 160, t + 0.05, 0.14, GAIN.fan * 0.7); for (let j = 0; j < 7; j++) hiss(a, t + 0.08 + j * 0.055 + Math.random() * 0.03, 0.05, GAIN.fan * 0.45, 3200, 2600, 3, 0.1); },   // the fan's clack, the toppings scattering
      win: (a, t) => { bell(a, 98, t, 2.4, GAIN.win * 1.3); [0, 1, 2, 3, 4].forEach(i => bell(a, P[i], t + 0.12 + i * 0.09, 0.7, GAIN.win)); bell(a, P[0] * 2, t + 0.6, 1.2, GAIN.win); },   // a gong and a rising run
      fail: (a, t) => { bell(a, 392, t, 0.45, GAIN.fail); bell(a, 329.63, t + 0.2, 0.7, GAIN.fail); },   // a soft fall, G4 to E4
    };
    return { cues, busOf, unlock: ctxA, play(name, arg) { const a = ctxA(); if (!a || muted || a.state !== 'running') return; cues[name](a, a.currentTime + 0.005, arg); },
      get muted() { return muted; }, set muted(v) { muted = v; try { localStorage.setItem('ph-lohei-mute', v ? '1' : '0'); } catch (e) {} } };
  })();
  const ART = {}, DRESS = [], NOART = has('noart') || has('blueprint') || has('explained') || has('geometry') || has('sim');
  const ART_FILES = { room: 'room.webp', lantern: 'lantern.webp', toppings: 'toppings.webp', fan: 'fan.webp', logo: 'logo.svg', pizzaPlain: 'pizza-plain.webp', pizzaDressed: 'pizza-dressed.webp' };
  if (!NOART) for (const [k, f] of Object.entries(ART_FILES)) { const im = new Image(); im.onload = () => { ART[k] = im; if (k === 'pizzaDressed') dressMasks(); if (k === 'toppings') rimToppings(); }; im.src = 'assets/game/' + f; }
  function dressMasks() {   // the dressing: the client's finished photo shows through in patches, more with every lantern lit (5 = the whole photo)
    const im = ART.pizzaDressed, n = 512;
    for (let L = 1; L <= 5; L++) { const c = document.createElement('canvas'); c.width = c.height = n; const g = c.getContext('2d');
      if (L < 5) { g.fillStyle = '#000'; for (let k = 0; k < L * 6; k++) { const a = hash(k + 900) * 6.283, d = Math.sqrt(hash(k + 950)) * 0.4 * n; g.beginPath(); g.arc(n / 2 + Math.cos(a) * d, n / 2 + Math.sin(a) * d, n * (0.08 + 0.05 * hash(k + 990)), 0, 7); g.fill(); } g.globalCompositeOperation = 'source-in'; }
      g.drawImage(im, 0, 0, n, n); DRESS[L] = c; }
  }
  function rimToppings() {   // small pieces on a light cream wall: a soft dark edge baked in once, so they read in flight (palette rule: never pink-on-cream unedged)
    const im = ART.toppings, c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d');
    g.shadowColor = 'rgba(70,25,10,.75)'; g.shadowBlur = 3; g.drawImage(im, 0, 0); g.drawImage(im, 0, 0); ART.toppingsRim = c;
    const d = document.createElement('canvas'); d.width = im.width; d.height = im.height; const h = d.getContext('2d'); h.filter = 'blur(2px)'; h.drawImage(im, 0, 0); h.filter = 'none'; h.globalCompositeOperation = 'source-in'; h.fillStyle = '#3a1205'; h.fillRect(0, 0, d.width, d.height); ART.toppingsShadow = d;
  }

  // ── geometry ────────────────────────────────────────────
  const lanternH = (i, t) => CONFIG.lanterns[i] + CONFIG.bob[i] * Math.sin(2 * Math.PI * t / CONFIG.bobPeriod + i * 1.3);
  const halfWin = i => CONFIG.win0 + CONFIG.win1 * CONFIG.lanterns[i] + (CONFIG.endEase[i] || 0);
  const tUp = h => Math.sqrt(2 * Math.min(h, CONFIG.ceil) / CONFIG.G);
  const yOf = h => V.tableY - (h - S.cam) * V.px;            // screen y of a height (m) above the table
  const sx = dx => CX + dx * V.zoom;                          // world x (fixed-stage px from the centre) to screen
  const releaseY = () => V.tableY - 30 * V.zoom - CONFIG.grab;
  const LX = [-74, 76, -78, 74, -46];                         // lanterns hang beside the column, alternating

  function reset(mode) {
    S = { mode, t: 0, i: 0, misses: 0, lit: [], dress: 0, phase: 'aim', aimT: 0, mix: [], floor: [], table: [], fx: [], pops: [], cue: null, seen: {},
      marker: null, missHint: null, prompt: mode === 'play' && !BOT && !SIM, hintT: 0, idleT: 0, assisted: false, grab: null, drag: null, lift: 0, flickT: 9,
      bot: {}, cam: 0, reveal: 0, why: null, best: 0, toss: null, regather: 0, ended: false, touched: false };
  }

  // ── the toss ────────────────────────────────────────────
  function launch(h, src) {
    if (S.phase !== 'aim' || (S.mode !== 'play' && S.mode !== 'attract')) return;
    if (CONFIG.assist && !S.assisted && S.i === 0 && S.mode === 'play') {   // the first toss of a game lands (owner 2026-10-30 00:23: rig the first move)
      S.assisted = true; const tH = lanternH(0, S.t + tUp(h)); if (Math.abs(h - tH) < Math.max(0.35, tH * 0.45)) h = tH;
    }
    if (S.mode === 'play' && S.i >= 2 && S.misses > 0 && S.helpedAt !== S.misses) { const tH = lanternH(S.i, S.t + tUp(h)); if (Math.abs(h - tH) < tH * 0.5) { h = tH; S.helpedAt = S.misses; } }   // a miss late in the game earns one helped toss
    if (S.i >= 3) h = Math.min(h, CONFIG.ceil - 0.05);   // lanterns 4-5: a toss too hard stops just under the fan
    h = Math.max(0.12, h); S.phase = 'flight'; S.prompt = false; S.flickT = 0; S.lift = 0; S.grab = null; S.drag = null; S.idleT = 0;
    const capped = Math.min(h, CONFIG.ceil), tc = h >= CONFIG.ceil ? solveT(h, CONFIG.ceil) : tUp(h);
    S.toss = { h, peakAt: S.t + tc, res: null, apex: capped, dressOnLand: false, lost: false };
    if (S.mode === 'play') SFX.play('toss', clamp(h / 2.6, 0.3, 1));
    const v0 = Math.sqrt(2 * CONFIG.G * h);
    for (let k = 0; k < 26; k++) {
      const lead = k === 0, f = lead ? 1 : rand(0.8, 0.99);
      S.mix.push({ dx: lead ? 0 : rand(-46, 46), h: 0.05, vh: v0 * f, vx: rand(-26, 26) + (lead ? 0 : 0), k: k % 3, r: rand(0, 6.3), vr: rand(-9, 9), st: 'air', lead, s: rand(0.8, 1.2) });
    }
  }
  const solveT = (h, y) => { const v0 = Math.sqrt(2 * CONFIG.G * h), g = CONFIG.G, d = v0 * v0 - 2 * g * y; return (v0 - Math.sqrt(Math.max(0, d))) / g; };
  function resolve() {
    const T = S.toss, i = S.i, tH = lanternH(i, S.t), w = halfWin(i);
    let res = T.h >= CONFIG.ceil ? 'ceiling' : Math.abs(T.h - tH) <= w ? 'hit' : T.h < tH ? 'short' : 'high';
    T.res = res; S.best = Math.max(S.best, T.apex);
    if (res === 'hit') {
      S.lit.push(i); (S.litT = S.litT || {})[i] = S.t; T.dressOnLand = true; S.missHint = null;
      if (S.mode === 'play') SFX.play('lit', i); S.fx.push({ k: 'burst', i, t: 0 }); pop(C.phrases[i], sx(LX[i]), yOf(tH) - 46 * V.zoom, '#FFD23A', true);
      if (S.lit.length >= CONFIG.lanterns.length) S.fx.push({ k: 'allLit', t: 0 });
    } else {
      S.misses++; S.missT = S.t; S.missHint = res; T.lost = res === 'ceiling';
      S.marker = { h: T.apex, t: 0, res };
      pop(res === 'short' ? C.harder : res === 'high' ? C.softer : C.tooHard, CX, V.tableY - 150 * V.zoom, res === 'ceiling' ? '#FFD23A' : '#fff', res === 'ceiling');
      if (res === 'ceiling') { S.fx.push({ k: 'fan', t: 0 }); if (S.mode === 'play') SFX.play('fan'); }
    }
  }
  function endToss() {   // every piece of the mix has come down
    const T = S.toss; S.toss = null;
    if (T.dressOnLand) S.dress = Math.min(5, S.dress + 1);
    if (T.lost) S.dress = Math.max(0, S.dress - 1);   // the fan took a layer of toppings: the penalty is seen on the pizza (rule 19)
    const won = S.lit.length >= CONFIG.lanterns.length, lost = S.misses >= CONFIG.tries;
    if (won || lost) return finish(won ? 'win' : 'fail', T.res);
    if (T.res === 'hit') S.i++;
    S.phase = 'regather'; S.regather = 0;
  }
  function finish(result, why) {
    if (S.mode === 'attract') { setTimeout(() => S && S.mode === 'attract' && reset('attract'), 1200); S.phase = 'done'; return; }
    SFX.play(result === 'win' ? 'win' : 'fail'); S.ended = true; S.why = why; S.phase = 'done'; S.mode = result === 'win' ? 'reveal' : 'fail'; S.reveal = 0;
    if (!SIM) setTimeout(() => showCard(result), result === 'win' ? 2000 : 1000);   // the win holds on the dressed pizza; the fail can be quick (rule 15)
  }
  function pop(txt, x, y, col, big) { S.pops.push({ txt, x, y, col, big, t: 0 }); }

  // ── update ──────────────────────────────────────────────
  function update(dt) {
    S.t += dt; S.hintT += dt; S.flickT += dt;
    if (S.mode === 'reveal') { S.reveal += dt; if (S.reveal > 0.8) S.dress = 5;   // the win: the whole mix rains down onto the finished pizza
      if (S.reveal < 1.6 && Math.random() < 0.7) S.mix.push({ dx: rand(-140, 140), h: CONFIG.ceil - 0.2, vh: rand(-1, 0), vx: rand(-20, 20), k: (Math.random() * 3) | 0, r: rand(0, 6), vr: rand(-6, 6), st: 'air', s: 1 }); }
    if (S.phase === 'aim') {
      S.aimT += dt;
      if (!S.drag && !S.prompt && S.mode === 'play' && !BOT) { S.idleT += dt; if (S.idleT > CONFIG.idleHint) { S.prompt = true; S.hintT = 0; S.idleT = 0; } }
      const i = S.i;
      if (CONFIG.bob[i] > 0 && !S.seen.sway) { S.seen.sway = true; S.cue = { txt: C.cueSway, t: 0 }; }
      if (i === CONFIG.lanterns.length - 1 && !S.seen.fan) { S.seen.fan = true; S.cue = { txt: C.cueFan, t: 0 }; }
    }
    if (S.phase === 'regather') { S.regather += dt; S.table.forEach(p => p.fade = (p.fade || 0) + dt); if (S.regather > 0.55) { S.phase = 'aim'; S.aimT = 0; S.table = []; } }
    if (S.toss && !S.toss.res && S.t >= S.toss.peakAt) resolve();
    // the mix in the air
    const G = CONFIG.G, floorH = -(V.floorY - V.tableY) / V.px;
    S.mix.forEach(p => {
      if (p.st === 'air') {
        p.vh -= G * dt; p.h += p.vh * dt; p.dx += p.vx * dt; p.r += p.vr * dt;
        if (p.h >= CONFIG.ceil) { p.h = CONFIG.ceil; p.vh = -Math.abs(p.vh) * 0.12; p.vx = (Math.random() < 0.8 ? -1 : 1) * rand(330, 520); p.vr *= 2; p.hitCeil = true; }
        if (p.h <= 0 && p.vh < 0) {
          if (Math.abs(p.dx) < V.pizzaR * 0.8 && !p.hitCeil) { p.st = 'gone'; }
          else if (Math.abs(p.dx) < V.tableHalf) { p.st = 'table'; p.h = 0; S.table.push({ dx: p.dx, k: p.k, r: p.r }); }
          else if (p.h <= floorH) { p.st = 'floor'; S.floor.push({ dx: clamp(p.dx, -V.floorHalf, V.floorHalf), k: p.k, r: p.r }); }
        }
      }
    });
    S.mix = S.mix.filter(p => p.st === 'air');
    if (S.toss && S.toss.res && !S.mix.length) endToss();
    // the camera (follow view only): previews the next lantern, then rides the toss
    if (V.follow) {
      let want = 0; const top = Math.max(...S.mix.map(p => p.h), 0);
      if (S.phase === 'aim') { const a = S.aimT, tgt = Math.max(0, CONFIG.lanterns[S.i] - V.previewAt); want = S.mode === 'attract' || (S.i === 0 && !S.touched) ? 0 : a < 0.25 ? 0 : a < 1.0 ? tgt : a < 1.5 ? tgt : 0; if (S.drag) want = 0; }
      else if (S.phase === 'flight') want = Math.max(0, top - V.followAt);
      want = Math.min(want, CONFIG.ceil - V.viewM + 0.15);
      S.cam += (want - S.cam) * Math.min(1, dt * (S.phase === 'flight' ? 7 : 3.2));
    }
    S.fx.forEach(f => f.t += dt); S.fx = S.fx.filter(f => f.t < (f.k === 'allLit' ? 3 : 1.2));
    S.pops.forEach(p => p.t += dt); S.pops = S.pops.filter(p => p.t < (p.big ? 1.5 : 1.2));
    if (S.cue) { S.cue.t += dt; if (S.cue.t > 2.2) S.cue = null; }
    if (S.marker) { S.marker.t += dt; if (S.marker.t > 2.2) S.marker = null; }
  }

  // ── input: one control, the upward flick (grab-and-throw, the Tasty Travels pattern validated on mcdonalds-uae-01) ──
  function toLogical(e) { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
  function down(e) {
    if (S.mode !== 'play' || S.phase !== 'aim') return; const p = toLogical(e); if (p.y < H * 0.42) return;
    const now = performance.now(); S.missHintDrag = false; S.drag = { y0: p.y, t0: now, pts: [{ y: p.y, t: now }] }; S.grab = { fy0: p.y }; S.idleT = 0; S.prompt = false; S.touched = true;
  }
  function move(e) {
    if (!S.drag) return; const p = toLogical(e), now = performance.now();
    S.drag.pts.push({ y: p.y, t: now }); S.drag.pts = S.drag.pts.filter(q => now - q.t <= 100);
    const d = clamp(S.grab.fy0 - p.y, 0, CONFIG.grab); S.lift = d;   // the chopsticks follow the finger up the launch strip
    if (d >= CONFIG.grab) up();                                         // past the release line: thrown at the finger's speed
  }
  function up() {
    if (!S.drag) return; const D = S.drag, pts = D.pts, a = pts[0], b = pts[pts.length - 1], span = Math.max(16, b.t - a.t);
    const speed = (a.y - b.y) / span * 1000, travel = D.y0 - b.y, dur = (b.t - D.t0) / 1000;
    S.drag = null;
    if (travel < 18 || speed < 150) { S.lift = 0; S.grab = null; pop(C.flickUp, CX, V.tableY - 150 * V.zoom, '#fff'); S.prompt = true; S.hintT = 0; return; }
    if (dur > 0.45 && speed < 900) S.missHintDrag = true;   // a slow push, not a flick: it still throws (weakly) and is coached
    launch(speed / CONFIG.spm, 'user');
  }

  // ── bots ────────────────────────────────────────────────
  // perfect: tosses exactly to where the lantern will be at the top of the toss. First-timer (owner's lesson: 60-70% wins): misjudges how
  // hard a flick is at first (gain 0.66-1.5x), aims at where the lantern is NOW (not where it will be), flicks with ~13% scatter that
  // tightens after hits, learns from each miss by most of the error (it sees where the toss peaked), waits 0.8-1.6 s before the first flick.
  function autopilot() {
    if (S.phase !== 'aim' || (S.mode !== 'play' && S.mode !== 'attract')) return;
    const B = S.bot, i = S.i;
    B.wait ??= HUMAN ? rand(0.8, 1.6) : ATTRACT ? 0.9 : 0.35; if (S.aimT < B.wait) return; B.wait = HUMAN ? rand(0.45, 1.0) : ATTRACT ? 0.8 : 0.3;
    let h;
    if (HUMAN) {
      B.gain ??= Math.exp(rand(-1, 1) * 0.41); B.sig ??= 0.13 * (V.follow ? 1.2 : 1);
      const seen = lanternH(i, S.t) * (V.follow ? 1 + gauss() * 0.05 : 1);
      h = seen * B.gain * (1 + gauss() * B.sig); B.intended = seen;
    } else {
      h = CONFIG.lanterns[i]; for (let k = 0; k < 3; k++) h = lanternH(i, S.t + tUp(h));
      if (ATTRACT && (S.lit.length === 1 && !B.showedFail)) { B.showedFail = true; h = CONFIG.ceil + 0.4; }   // the attract loop shows the fan once (rule 8: the fail before the touch)
    }
    S.touched = true; launch(h, 'bot'); B.last = { h, intended: B.intended };
  }
  function learn(res) {   // the first-timer sees where the toss peaked against the lantern and corrects most of the way
    const B = S.bot; if (!HUMAN || !B.last) return;
    const seenApex = res === 'ceiling' ? B.last.intended * 1.3 : Math.min(B.last.h, CONFIG.ceil);
    const r = seenApex / Math.max(0.2, B.last.intended); if (res !== 'hit') B.gain /= Math.pow(r, 0.7); else B.sig = Math.max(0.08, B.sig * 0.88);
    B.last = null;
  }

  // ── drawing (greybox: flat clean shapes; the brand's chrome in the HUD and cards) ──
  function rr(x, y, w, h, r, fill, stroke, lw) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); } }
  function ell(x, y, rx, ry, fill, stroke, lw) { ctx.beginPath(); ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, 7); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 2; ctx.stroke(); } }
  function text(t, x, y, size, col, opts = {}) { ctx.font = `${opts.weight || 800} ${size}px ${opts.display ? '"Lilita One", ' : ''}"Open Sans", system-ui, sans-serif`; ctx.textAlign = opts.align || 'center'; ctx.textBaseline = 'middle'; if (opts.stroke) { ctx.lineJoin = 'round'; ctx.lineWidth = opts.stroke; ctx.strokeStyle = opts.strokeCol || '#3a0a0a'; ctx.strokeText(t, x, y); } ctx.fillStyle = col; ctx.fillText(t, x, y); }
  function piece(x, y, k, s, r) {   // one topping: a gold pillow cracker, a curl of lime peel, a cereal crumb
    if (ART.toppingsShadow) { const sh = ART.toppingsShadow, cw = sh.width / 3, ch = sh.height / 2, z = (k === 0 ? 17 : 16) * s * V.zoom; ctx.save(); ctx.translate(x + 4 * s, y + 6 * s); ctx.rotate(r); ctx.globalAlpha *= 0.3; ctx.drawImage(sh, k * cw, 0, cw, ch, -z / 2, -z / 2, z, z); ctx.restore(); }
    ctx.save(); ctx.translate(x, y); ctx.rotate(r); ctx.scale(s * V.zoom, s * V.zoom);
    const ts = ART.toppingsRim || ART.toppings;
    if (ts) { const cw = ts.width / 3, ch = ts.height / 2, z = k === 0 ? 17 : 16; ctx.drawImage(ts, k * cw, 0, cw, ch, -z / 2, -z / 2, z, z); ctx.restore(); return; }
    if (k === 0) { rr(-7, -4.5, 14, 9, 3, KIND[0], '#9a7300', 1.2); }
    else if (k === 1) { ctx.strokeStyle = KIND[1]; ctx.lineWidth = 3.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(0, 0, 6, 0.3, 3.6); ctx.stroke(); ctx.lineCap = 'butt'; }
    else { ell(0, 0, 4.2, 3.4, KIND[2], '#a88d55', 1); }
    ctx.restore();
  }
  function drawLantern(x, y, sc, lit, glow) {
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    if (glow > 0) { for (let k = 3; k >= 1; k--) ell(0, 0, 30 + k * 12 * glow, 34 + k * 12 * glow, `rgba(255,190,60,${0.09 * glow})`); }
    if (ART.lantern) { const im = ART.lantern, c = im.height, k = 0.675; ctx.drawImage(im, lit ? c : 0, 0, c, c, -58 * k, -60 * k, c * k, c * k); ctx.restore(); return; }   // body centre (58, 60) of the 156 cell; body 56 px wide
    rr(-10, -32, 20, 6, 2, '#C9A227'); rr(-10, 26, 20, 6, 2, '#C9A227');
    ell(0, 0, 25, 28, lit ? '#E8231C' : '#B9A9A6', lit ? '#9E0E0B' : '#8F8280', 2);
    ctx.strokeStyle = lit ? 'rgba(255,220,150,.55)' : 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; for (const k of [-12, 0, 12]) { ctx.beginPath(); ctx.ellipse(0, 0, Math.abs(k) > 0 ? 18 : 0.5, 27, 0, 0, 7); ctx.stroke(); }
    if (lit) ell(-7, -8, 6, 8, 'rgba(255,240,200,.45)');
    ctx.strokeStyle = '#C9A227'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 32); ctx.lineTo(0, 44); ctx.stroke();
    ctx.restore();
  }
  function drawRoom() {
    const yC = yOf(CONFIG.ceil);
    if (ART.room) { ctx.drawImage(ART.room, 0, 0, W, H); if (ART.fan) drawFan(yC); S.floor.forEach(p => piece(sx(Math.sign(p.dx) * (266 + hash(p.r * 13.7) * 46)), V.floorY - 32 + hash(p.r * 7.1) * 46, p.k, 1.4, p.r)); return; }   // the floor of gold: on the visible floor beside the table, inside the frame (QA 2026-11-02)   // the floor of gold: bigger and kept inside the frame (QA 2026-11-02: half of it sat off the edge)
    let g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#E6E0DA'); g.addColorStop(1, '#D9D1C9'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (let k = 0; k < 4; k++) { const x = 40 + k * 170, y0 = yC + 120 * V.zoom; if (y0 < H) rr(x, y0, 110, 150 * V.zoom, 6, 'rgba(255,255,255,.22)'); }   // wall panels (the plate's job: a CNY dining room)
    if (yC > -40) { rr(0, yC - 400, W, 400, 0, '#B8AEA5'); rr(0, yC - 10, W, 10, 0, '#A79C92'); }   // the ceiling
    // the fan, hung from the ceiling over the table
    const fy = yC + 26 * V.zoom; if (fy > -30) { const sp = S.t * 9 + (S.fx.some(f => f.k === 'fan') ? 6 : 0);
      rr(CX - 3, yC, 6, 22 * V.zoom, 2, '#8F857C'); ell(CX, fy, 14 * V.zoom, 7 * V.zoom, '#8F857C');
      for (let k = 0; k < 3; k++) { const a = sp + k * 2.09, w = Math.cos(a) * 120 * V.zoom; ell(CX + w / 2, fy, Math.abs(w / 2) + 4, 4 * V.zoom, 'rgba(143,133,124,.85)'); } }
    // floor and table (side view: the tabletop edge, the cloth falling to the floor)
    rr(0, V.floorY, W, H - V.floorY + 20, 0, '#C8BDB2');
    S.floor.forEach(p => piece(sx(p.dx), V.floorY + 6 + (hash(p.dx) * 10), p.k, 1, p.r));   // what the fan sent down stays: Floor of gold
    const th = V.tableHalf * V.zoom; rr(CX - th, V.tableY + 8 * V.zoom, th * 2, V.floorY - V.tableY - 4, 10, '#CFC5BB');
    ell(CX, V.tableY + 8 * V.zoom, th, 26 * V.zoom, '#DED5CB', '#BFB4A9', 2);
  }
  function drawFan(yC) {   // side view of a turning fan: the blade picture drawn three times, each foreshortened by the cosine of its angle; the hub on top
    const im = ART.fan, k = 269 / im.width, h = im.height * k, top = yC + 26 - 50 * k, hub = 174, b0 = hub + 14, bw = im.width - b0;
    const hit = S.fx.find(f => f.k === 'fan'), sp = S.t * 9 + (hit ? hit.t * 16 : 0), wob = hit ? Math.sin(hit.t * 40) * 3 * (1 - hit.t / 1.2) : 0;
    const blades = [0, 1, 2].map(j => { const a = sp + j * 2.094; return { c: Math.cos(a), s: Math.sin(a) }; });
    const blade = b => { ctx.save(); ctx.translate(CX + wob, 0); ctx.scale(b.c, 1); ctx.globalAlpha = b.s < 0 ? 0.7 : 1; ctx.drawImage(im, b0, 0, bw, im.height, 13 * k, top, bw * k, h); ctx.restore(); };
    blades.filter(b => b.s < 0).forEach(blade); ctx.drawImage(im, hub - 16, 0, 32, im.height, CX - 16 * k + wob, top, 32 * k, h); blades.filter(b => b.s >= 0).forEach(blade);
  }
  function drawTargetBand() {
    if (!(S.phase === 'aim' || S.phase === 'flight' || S.phase === 'regather') || S.i >= CONFIG.lanterns.length || S.mode === 'reveal') return;
    const i = S.i, h = lanternH(i, S.t), w = halfWin(i), y0 = yOf(h + w), y1 = yOf(h - w), pulse = 0.5 + 0.5 * Math.sin(S.t * 5), lx = sx(LX[i]);
    const xa = Math.min(CX - 62, lx - 52), xb = Math.max(CX + 62, lx + 52), r = Math.min(22, (y1 - y0) / 2);   // from the toppings' path to the lantern
    ctx.save(); ctx.shadowColor = 'rgba(255,190,40,.8)'; ctx.shadowBlur = 18 * pulse; rr(xa, y0, xb - xa, y1 - y0, r, `rgba(255,214,90,${0.18 + 0.14 * pulse})`); ctx.restore();
    rr(xa, y0, xb - xa, y1 - y0, r, null, '#FFC21F', 3.5);
    for (const [cx, cy, sx2, sy2] of [[xa, y0, 1, 1], [xb, y0, -1, 1], [xa, y1, 1, -1], [xb, y1, -1, -1]]) { ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx + sx2 * 4, cy + sy2 * 18); ctx.lineTo(cx + sx2 * 4, cy + sy2 * 4); ctx.lineTo(cx + sx2 * 18, cy + sy2 * 4); ctx.stroke(); ctx.lineCap = 'butt'; }   // corner brackets: a target
    if (S.phase === 'aim' && (S.mode === 'play' || S.mode === 'attract')) { const tx = (CX + (LX[i] < 0 ? xb : xa)) / 2 + (LX[i] < 0 ? -10 : 10); text(C.tossHere, (xa + xb) / 2, y0 - 18, 22, '#FFD23A', { display: true, weight: 400, stroke: 6 }); }
    // the aim line: chevrons climbing from the pizza into the zone (the way, not the strength)
    if (S.phase === 'aim' && S.mode === 'play') { const top = y1 + 6, bot = V.tableY - 40 * V.zoom; for (let y = bot - ((S.t * 60) % 26); y > top; y -= 26) { const a = Math.min(1, (bot - y) / 60) * Math.min(1, (y - top) / 40); ctx.globalAlpha = 0.9 * a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(CX - 9, y + 6); ctx.lineTo(CX, y - 3); ctx.lineTo(CX + 9, y + 6); ctx.stroke(); } ctx.globalAlpha = 1; ctx.lineCap = 'butt'; }
  }
  function drawLanterns() {
    CONFIG.lanterns.forEach((_, i) => {
      const h = lanternH(i, S.t), y = yOf(h), x = sx(LX[i]); if (y < -80 || y > H + 80) return;
      const yC = yOf(CONFIG.ceil); ctx.strokeStyle = '#8F857C'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, Math.max(-10, yC)); ctx.lineTo(x, y - (ART.lantern ? 26 : 32) * V.zoom); ctx.stroke();
      const lit = S.lit.includes(i), target = i === S.i && S.phase !== 'done' && S.mode !== 'reveal';
      if (ART.room) { let g = ctx.createRadialGradient(x + 18, y + 24, 4, x + 18, y + 24, 46); g.addColorStop(0, 'rgba(70,25,10,.28)'); g.addColorStop(1, 'rgba(70,25,10,0)'); ctx.fillStyle = g; ctx.fillRect(x - 40, y - 30, 110, 110);
        if (lit) { g = ctx.createRadialGradient(x, y, 10, x, y, 140); g.addColorStop(0, 'rgba(255,160,50,.30)'); g.addColorStop(0.5, 'rgba(255,150,40,.10)'); g.addColorStop(1, 'rgba(255,150,40,0)'); ctx.fillStyle = g; ctx.fillRect(x - 140, y - 140, 280, 280); } }
      const burst = S.fx.find(f => f.k === 'burst' && f.i === i), all = S.fx.find(f => f.k === 'allLit');
      drawLantern(x, y, V.zoom * (burst ? 1 + 0.25 * Math.sin(Math.min(1, burst.t / 0.35) * Math.PI) : 1), lit, lit ? 0.8 + (all ? 0.6 * Math.abs(Math.sin(all.t * 6 + i)) : 0) : target ? 0.5 + 0.5 * Math.sin(S.t * 5) : 0);
      if (burst && burst.t < 0.8) { for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283, r = (20 + burst.t * 140) * V.zoom; ctx.globalAlpha = 1 - burst.t / 0.8; ell(x + Math.cos(a) * r, y + Math.sin(a) * r, 3, 3, '#FFD23A'); } ctx.globalAlpha = 1; }
    });
  }
  function drawPizza() {
    const r = V.pizzaR * V.zoom, ry = r * 0.3, y = V.tableY;
    const photo = !!ART.pizzaPlain;
    if (photo) {
      let g = ctx.createRadialGradient(CX + 14, y + 16, r * 0.3, CX + 14, y + 16, r * 1.25); g.addColorStop(0, 'rgba(40,0,0,.55)'); g.addColorStop(1, 'rgba(40,0,0,0)'); ctx.save(); ctx.translate(0, y + 16); ctx.scale(1, 0.32); ctx.translate(0, -(y + 16)); ctx.fillStyle = g; ctx.fillRect(CX - r * 1.4, y + 16 - r * 1.3, r * 2.8, r * 2.6); ctx.restore();   // contact shadow, cast down-right
      ell(CX, y + 9, r * 1.05, ry * 1.07, '#2E211B'); ell(CX, y + 6, r * 1.05, ry * 1.07, '#5A4438'); ell(CX - r * 0.25, y + 3, r * 0.7, ry * 0.5, 'rgba(255,255,255,.10)');   // the pan: its side, then its lip
      ell(CX, y + 5, r, ry, '#9B5A22'); ell(CX, y + 3, r, ry, '#C98A45');   // the crust's side: the pizza has thickness
      ctx.drawImage(ART.pizzaPlain, CX - r, y - ry, r * 2, ry * 2); if (S.dress && DRESS[S.dress]) ctx.drawImage(DRESS[S.dress], CX - r, y - ry, r * 2, ry * 2);
      ctx.save(); ctx.beginPath(); ctx.ellipse(CX, y, r, ry, 0, 0, 7); ctx.clip(); g = ctx.createLinearGradient(CX - r, y - ry, CX + r, y + ry); g.addColorStop(0, 'rgba(255,244,220,.22)'); g.addColorStop(0.5, 'rgba(255,244,220,0)'); g.addColorStop(1, 'rgba(50,10,0,.28)'); ctx.fillStyle = g; ctx.fillRect(CX - r, y - ry, r * 2, ry * 2); ctx.restore();   // light from the upper left
    }
    else { ell(CX, y + 6, r * 1.06, ry * 1.1, 'rgba(0,0,0,.12)'); ell(CX, y, r, ry, '#E2C08A', '#B8925A', 2); ell(CX, y - 2, r * 0.86, ry * 0.82, '#EED9B0'); }
    const n = S.dress * (photo ? 4 : 9);
    for (let k = 0; k < n; k++) { const a = hash(k) * 6.283, d = Math.sqrt(hash(k + 50)) * 0.8; piece(CX + Math.cos(a) * r * d, y - 2 + Math.sin(a) * ry * d, k % 3, 0.8, hash(k + 9) * 6); }
    if (!S.dress && !photo) text(C.photo, CX, y + ry + 16, 12, '#8E8780', { weight: 700 });
    // the heap, ready to toss (gone while the mix is in the air)
    if (S.phase === 'aim' || S.phase === 'regather') { const k0 = S.phase === 'regather' ? ease(S.regather / 0.55) : 1, lift = S.lift * 0.6;
      for (let k = 0; k < 22; k++) { const a = hash(k + 200) * 6.283, d = Math.sqrt(hash(k + 300)); piece(CX + Math.cos(a) * 46 * d * V.zoom, y - 10 * V.zoom - (1 - d) * 18 * V.zoom - lift * (1 - d * 0.5), k % 3, 1, hash(k + 400) * 6); } }
  }
  function drawChopsticks() {   // your chopsticks: held from the bottom right, tips in the heap; they rise with the finger and snap up on the throw
    const fl = S.flickT < 0.35 ? Math.sin(S.flickT / 0.35 * Math.PI) : 0, up = S.lift + fl * 70;
    if (ART.room) {   // the art build: no hand (Gemini drew wrong fingers twice); long wooden chopsticks from off-screen, tapered, shaded as cylinders
      const tx = CX + 24 * V.zoom, ty = V.tableY - 14 * V.zoom - up, bx = W + 60, by = H + 70 - up * 0.45;
      const stick = (ox, oy, tipOff, light) => {
        const x0 = bx + ox, y0 = by + oy, x1 = tx + tipOff, y1 = ty + tipOff * 0.6, L = Math.hypot(x1 - x0, y1 - y0), nx = -(y1 - y0) / L, ny = (x1 - x0) / L, w0 = 7.5, w1 = 2.2;
        ctx.beginPath(); ctx.moveTo(x0 + nx * w0 + 3, y0 + ny * w0 + 5); ctx.lineTo(x1 + nx * w1 + 3, y1 + ny * w1 + 5); ctx.lineTo(x1 - nx * w1 + 3, y1 - ny * w1 + 5); ctx.lineTo(x0 - nx * w0 + 3, y0 - ny * w0 + 5); ctx.closePath(); ctx.fillStyle = 'rgba(60,15,5,.22)'; ctx.fill();   // its shadow
        const g = ctx.createLinearGradient(x1 + nx * 6, y1 + ny * 6, x1 - nx * 6, y1 - ny * 6); g.addColorStop(0, '#8A6239'); g.addColorStop(0.35, light); g.addColorStop(0.55, '#F6E4C2'); g.addColorStop(1, '#9C7448');
        ctx.beginPath(); ctx.moveTo(x0 + nx * w0, y0 + ny * w0); ctx.lineTo(x1 + nx * w1, y1 + ny * w1); ctx.arc(x1, y1, w1, Math.atan2(ny, nx), Math.atan2(-ny, -nx)); ctx.lineTo(x0 - nx * w0, y0 - ny * w0); ctx.closePath(); ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = 'rgba(90,55,25,.55)'; ctx.lineWidth = 1; ctx.stroke();
      };
      stick(0, 0, -2, '#D9B98A'); stick(-4, 16, 3, '#E2C497'); return;
    }
    const tipX = CX + 22 * V.zoom, tipY = V.tableY - 12 * V.zoom - up, gx = W - 70, gy = H + 30 - up * 0.5;
    ctx.save(); ctx.lineCap = 'round';
    for (const [o, c] of [[-7, '#BFA27E'], [7, '#CDB18C']]) { ctx.strokeStyle = c; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(gx + o, gy); ctx.lineTo(tipX + o * 0.25, tipY); ctx.stroke(); }
    ctx.restore();
    // the hand that holds them (greybox shape; the pack draws a real right hand in the standard chopstick grip, rule 14/21)
    ctx.save(); ctx.translate(gx + 4, gy - 40); ctx.rotate(-0.55); rr(-26, -16, 64, 52, 22, '#E8DCCF', '#B9AC9F', 2); rr(-36, -6, 26, 14, 7, '#E8DCCF', '#B9AC9F', 2); ctx.restore();
  }
  function drawMix() {
    S.mix.forEach(p => piece(sx(p.dx), yOf(p.h) - 8 * V.zoom, p.k, p.s, p.r));
    S.table.forEach(p => { ctx.globalAlpha = 1 - clamp((p.fade || 0) / 0.5, 0, 1); piece(sx(p.dx), V.tableY + 2, p.k, 1, p.r); ctx.globalAlpha = 1; });
  }
  function drawMarker() {   // where the last toss peaked, beside the band: the miss shows where the shot went (rule 18)
    const M = S.marker; if (!M) return; const y = yOf(M.h) - 8 * V.zoom, a = clamp(2.2 - M.t, 0, 1);
    ctx.globalAlpha = a; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(CX + 70 * V.zoom, y); ctx.lineTo(CX + 130 * V.zoom, y); ctx.stroke();
    text(C.yourToss, CX + 136 * V.zoom, y, 13, '#fff', { align: 'left', weight: 700 }); ctx.globalAlpha = 1;
  }
  function drawRelease() {
    if (S.phase !== 'aim' || S.mode !== 'play') return; const y = releaseY();
    ctx.setLineDash([9, 7]); ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(CX - 120, y); ctx.lineTo(CX + 120, y); ctx.stroke(); ctx.setLineDash([]);
  }
  function drawHint() {   // the ghost hand performs a real flick on the chopsticks: press, a short snap up, lift-off, a pause
    if (!S.prompt || S.phase !== 'aim' || S.mode !== 'play') return;
    const t = S.hintT % 2; if (t > 0.95) return;
    const x0 = CX + 60 * V.zoom, y0 = V.tableY + 50 * V.zoom, snap = ease(clamp((t - 0.32) / 0.1, 0, 1)), lift = clamp((t - 0.42) / 0.22, 0, 1);
    const y = y0 - 70 * snap - 26 * ease(lift), a = clamp(t / 0.15, 0, 1) * (1 - lift);
    if (t > 0.16 && t < 0.5) { const k = (t - 0.16) / 0.34; ctx.globalAlpha = (1 - k) * 0.9; ctx.strokeStyle = '#FFD23A'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x0, y0, 6 + 26 * k, 0, 7); ctx.stroke(); }
    if (snap > 0 && lift < 0.6) { ctx.globalAlpha = (1 - lift) * 0.85; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineCap = 'round'; for (const dx of [-12, 0, 12]) { ctx.beginPath(); ctx.moveTo(x0 + dx * 0.6, y - 10); ctx.lineTo(x0 + dx, y - 14 - 22 * snap); ctx.stroke(); } ctx.lineCap = 'butt'; }
    ctx.globalAlpha = a; ctx.save(); ctx.translate(x0, y); ctx.rotate(-0.28 * snap);
    rr(-5, 0, 10, 36, 5, '#fff', '#2B2B2B', 3); rr(-9, 30, 37, 34, 11, '#fff', '#2B2B2B', 3); rr(4, 25, 9, 15, 4.5, '#fff', '#2B2B2B', 2.5); rr(12, 27, 9, 14, 4.5, '#fff', '#2B2B2B', 2.5); rr(-3, 2, 6, 7, 3, '#E6E2D9');
    ctx.restore(); ctx.globalAlpha = 1;
    rr(CX - 82, releaseY() - 46, 164, 30, 15, 'rgba(30,20,18,.72)'); text(C.hint, CX, releaseY() - 31, 14, '#fff', { weight: 700 });
  }
  function drawPops() {
    if (S.mode === 'attract') return;
    S.pops.forEach(p => { const k = p.t / (p.big ? 1.5 : 1.2); ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4; const sc = p.big ? 1 + 0.3 * (1 - ease(p.t / 0.2)) : 1;
      text(p.txt, p.x, p.y - p.t * 30, Math.round((p.big ? 34 : 22) * sc), p.col, { display: true, weight: 400, stroke: p.big ? 7 : 5 }); ctx.globalAlpha = 1; });
    if (S.cue) { const a = Math.min(1, S.cue.t / 0.2, (2.2 - S.cue.t) / 0.3); ctx.globalAlpha = a; const y = V.follow ? 142 : yOf(lanternH(S.i, S.t)) + 62 * V.zoom; rr(CX - 150, y - 18, 300, 40, 20, '#7d0000'); rr(CX - 150, y - 22, 300, 40, 20, '#CE0000', '#fff', 3); text(S.cue.txt, CX, y - 2, 18, '#fff', { weight: 800 }); ctx.globalAlpha = 1; }
    if (S.missHintDrag && S.phase === 'aim' && S.mode === 'play') { text(C.flickIt, CX, V.tableY - 150 * V.zoom, 22, '#fff', { display: true, weight: 400, stroke: 5 }); }
  }
  function drawEdgeMarker() {   // follow view: the target is above the frame; a chip says how high
    if (!V.follow || S.phase !== 'aim' || S.i >= CONFIG.lanterns.length) return; const y = yOf(lanternH(S.i, S.t)); if (y > 80) return;
    rr(CX - 52, 76, 104, 30, 15, 'rgba(206,0,0,.92)'); text(C.up.replace('{m}', CONFIG.lanterns[S.i].toFixed(1)), CX, 91, 15, '#fff', { weight: 800 });
  }
  function chip(x, y, w, h, r) { rr(x, y + 4, w, h, r, '#7d0000'); rr(x, y, w, h, r, '#fff'); rr(x + 4, y + 3, w - 8, h * 0.42, r * 0.8, 'rgba(255,240,236,.9)'); rr(x, y, w, h, r, null, '#7d0000', 2.5); }
  let BANNER = null;
  function banner() {   // the banner, drawn once to its own canvas
    const c = document.createElement('canvas'); c.width = W * 2; c.height = 80 * 2; const g = c.getContext('2d'); g.scale(2, 2);
    const gr = g.createLinearGradient(0, 0, 0, 56); gr.addColorStop(0, '#F0302A'); gr.addColorStop(0.55, '#D40B05'); gr.addColorStop(1, '#A80000'); g.fillStyle = gr; g.fillRect(0, 0, W, 56);
    g.strokeStyle = 'rgba(255,214,110,.16)'; g.lineWidth = 1.5;   // the cloud lattice: rows of paired arcs
    for (let row = 0; row < 4; row++) for (let x = (row % 2) * 14 - 14; x < W + 28; x += 28) { const y = 8 + row * 14; g.beginPath(); g.arc(x, y, 7, Math.PI, 0); g.stroke(); g.beginPath(); g.arc(x + 14, y, 7, Math.PI, 0); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(0, 0, W, 2);
    for (let x = 0; x < W; x += 16) { g.beginPath(); g.arc(x + 8, 55, 8, 0, Math.PI); g.closePath(); g.fillStyle = '#9A0000'; g.fill(); g.strokeStyle = '#F5C542'; g.lineWidth = 2; g.beginPath(); g.arc(x + 8, 55, 8, 0, Math.PI); g.stroke(); }   // the valance
    g.fillStyle = '#F5C542'; g.fillRect(0, 53, W, 3); g.fillStyle = '#FFE9A0'; g.fillRect(0, 53, W, 1);   // the gold rim
    return c;
  }
  function coin(x, y, r, face, rim) { ell(x, y + 2.5, r, r, 'rgba(90,0,0,.45)'); ell(x, y, r, r, rim); ell(x, y, r - 3, r - 3, face); ell(x - r * 0.3, y - r * 0.35, r * 0.42, r * 0.24, 'rgba(255,255,255,.35)'); }
  function drawHUD() {
    if ((S.mode === 'reveal' && S.reveal > 1.2) || S.cardUp) return;
    const t = S.t, litT = S.litT || {};
    if (!ART.logo) { rr(0, 0, W, 62, 0, 'rgba(40,14,10,.55)'); rr(16, 11, 128, 40, 8, '#F2EEEA', '#C9C1B9', 1.5); text(C.logo, 80, 31, 12, '#6E665E', { weight: 800 }); }
    else {
      { const g = ctx.createLinearGradient(0, 62, 0, 120); g.addColorStop(0, 'rgba(70,12,0,.32)'); g.addColorStop(1, 'rgba(70,12,0,0)'); ctx.fillStyle = g; ctx.fillRect(0, 62, W, 58); }
      if (!BANNER) BANNER = banner(); ctx.drawImage(BANNER, 0, 0, W, 80);
      const sw = (t % 5) / 0.9;   // the sheen: a slanted light band crosses the banner every 5 s
      if (sw < 1) { ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, 54); ctx.clip(); const x = -120 + sw * (W + 240), g = ctx.createLinearGradient(x - 60, 0, x + 60, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,240,200,.28)'); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.fillRect(x - 60, 0, 120, 54); ctx.restore(); }
      rr(12, 9, 86, 66, 16, '#7d0000'); rr(12, 5, 86, 66, 16, '#fff', '#F5C542', 3); const lh = 54, lw = lh * ART.logo.width / ART.logo.height; ctx.drawImage(ART.logo, 55 - lw / 2, 11, lw, lh);   // the logo badge, gold-ringed, over the valance
    }
    const n = S.lit.length; coin(132, 29, 21, '#F7C531', '#B87A00'); text(`${n}/5`, 132, 30, 17, '#7d0000', { display: true, weight: 400 });   // the count on a gold coin
    // the lantern string: a gold cord sagging across the banner, five lanterns on hooks, swaying (rotation about the hook)
    const X0 = 162, X1 = 486, sag = 9, cy = x => 10 + sag * (1 - Math.pow((x - (X0 + X1) / 2) / ((X1 - X0) / 2), 2));
    ctx.strokeStyle = '#F5C542'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(X0, 10); ctx.quadraticCurveTo((X0 + X1) / 2, 10 + sag * 2, X1, 10); ctx.stroke();
    ell(X0, 10, 3.5, 3.5, '#FFE27A'); ell(X1, 10, 3.5, 3.5, '#FFE27A');
    for (let i = 0; i < 5; i++) {
      const x = 206 + i * 59, hy = cy(x), lit = S.lit.includes(i), target = i === S.i && S.mode === 'play' && !lit, since = lit && litT[i] != null ? t - litT[i] : 9;
      const a = 0.07 * Math.sin(t * 1.7 + i * 1.3) + (since < 2 ? 0.55 * Math.exp(-since * 2.6) * Math.sin(since * 11) : 0);
      ctx.save(); ctx.translate(x, hy); ctx.rotate(a);
      ctx.strokeStyle = '#F5C542'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 7); ctx.stroke();
      if (lit) { ell(0, 22, 16, 16, '#FFF1C4', '#F5C542', 2.5); drawLantern(0, 22, 0.36, true, 0); }
      else if (target) { ell(0, 22, 16, 16, 'rgba(255,241,196,.55)', '#FFE27A', 2.5); ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 6); ell(0, 22, 19, 19, null, '#FFE27A', 2); ctx.globalAlpha = 1; drawLantern(0, 22, 0.36, false, 0); }
      else { ell(0, 22, 16, 16, 'rgba(90,0,0,.55)', 'rgba(245,197,66,.6)', 1.5); ctx.globalAlpha = 0.45; drawLantern(0, 22, 0.36, false, 0); ctx.globalAlpha = 1; }
      ctx.restore();
      if (since < 0.7) { const k = since / 0.7; ctx.globalAlpha = 1 - k; for (let j = 0; j < 8; j++) { const an = j / 8 * 6.283, r = 10 + k * 26; ell(x + Math.cos(an) * r, hy + 22 + Math.sin(an) * r, 2.6, 2.6, '#FFE27A'); } ctx.globalAlpha = 1; }   // the gold burst
    }
    // lives: three red coins with gold rims, a cracker on each; a miss turns one grey with an X and shakes the row
    const ms = S.missT != null ? t - S.missT : 9, shake = ms < 0.45 ? Math.sin(ms * 55) * 6 * (1 - ms / 0.45) : 0;
    for (let k = 0; k < CONFIG.tries; k++) { const left = k < CONFIG.tries - S.misses, x = 542 + k * 32 + shake, ts = ART.toppingsRim || ART.toppings;
      if (left) { coin(x, 29, 15, '#D40B05', '#F5C542'); if (ts) ctx.drawImage(ts, 0, 0, ts.width / 3, ts.height / 2, x - 10, 19, 20, 20); }
      else { coin(x, 29, 15, '#8F7F7A', '#B8ABA6'); ctx.strokeStyle = '#5c504c'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 5, 24); ctx.lineTo(x + 5, 34); ctx.moveTo(x + 5, 24); ctx.lineTo(x - 5, 34); ctx.stroke(); ctx.lineCap = 'butt'; } }
  }
  function drawReveal() {   // the win: every lantern blazes, the mix rains down onto the finished pizza, the HUD fades (rule 15)
    if (S.mode !== 'reveal') return; const a = clamp(S.reveal / 0.6, 0, 1) * clamp((2.1 - S.reveal) / 0.3, 0, 1); if (a <= 0) return;
    ctx.globalAlpha = a * 0.9; text(C.winStamp, CX, 210, 64, '#FFD23A', { display: true, weight: 400, stroke: 10 }); ctx.globalAlpha = 1;
  }
  let GRADE = null;
  function grade() {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    let r = g.createRadialGradient(140, 230, 20, 140, 230, 560); r.addColorStop(0, 'rgba(255,236,200,.16)'); r.addColorStop(1, 'rgba(255,236,200,0)'); g.fillStyle = r; g.fillRect(0, 0, W, H);
    r = g.createRadialGradient(W * 0.48, H * 0.46, 260, W * 0.48, H * 0.5, 720); r.addColorStop(0, 'rgba(50,12,0,0)'); r.addColorStop(1, 'rgba(50,12,0,.5)'); g.fillStyle = r; g.fillRect(0, 0, W, H);
    const b = g.createLinearGradient(0, H - 140, 0, H); b.addColorStop(0, 'rgba(40,5,0,0)'); b.addColorStop(1, 'rgba(40,5,0,.28)'); g.fillStyle = b; g.fillRect(0, H - 140, W, 140);
    return c;
  }
  function frame() {
    ctx.setTransform(cv.width / W, 0, 0, cv.height / H, 0, 0);
    drawRoom(); drawTargetBand(); drawLanterns(); drawPizza(); drawMix(); drawMarker(); drawChopsticks(); if (ART.room) { if (!GRADE) GRADE = grade(); ctx.drawImage(GRADE, 0, 0); } drawRelease(); drawReveal(); drawEdgeMarker(); drawPops(); drawHUD(); drawHint();
  }

  // ── cards (DOM: Pizza Hut's measured chrome, pizzahut.com.sg 2026-10-30: red #CE0000, Open Sans 700 buttons, 8 px corners, sentence case;
  //    the checker is the box's and the site's; the display face is a stand-in until the brand kit arrives) ──
  const CSS = `
  *{box-sizing:border-box} html,body{margin:0;height:100%;background:#000;overflow:hidden;touch-action:none;-webkit-user-select:none;user-select:none}
  #stage{position:absolute;inset:0;margin:auto;aspect-ratio:2/3;max-width:100%;max-height:100%;container-type:size}
  #stage canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
  .card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;font-family:"Open Sans",system-ui,sans-serif;color:#fff;pointer-events:auto}
  .hidden{display:none!important}
  #start{justify-content:flex-end;padding:0 6cqw 9cqh;background:linear-gradient(180deg,rgba(120,0,0,0) 30%,rgba(120,0,0,.55) 62%,rgba(90,0,0,.92) 100%)}
  .logo{width:46cqw;height:9cqh;border:2px dashed #fff8;border-radius:10px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#ffffff1a;font-weight:800;font-size:3.2cqw;margin-bottom:2.4cqh}
  .logo.img{width:auto;height:auto;border:0;background:#fff;border-radius:14px;padding:1.2cqh 3.4cqw;box-shadow:0 1cqh 2.4cqh #0005} .logo.img img{height:12cqh;display:block}
  .kicker{font:800 3.6cqw "Open Sans",sans-serif;color:#5a2a00;background:linear-gradient(#FFE27A,#F5B700);padding:.8cqh 4cqw;border-radius:999px;margin:0 0 1.6cqh;box-shadow:0 .5cqh 0 #a86d00,0 1cqh 2cqh #0005;text-transform:uppercase;letter-spacing:.06em}
  #start{background:linear-gradient(180deg,rgba(150,0,0,0) 36%,rgba(150,0,0,.6) 60%,rgba(110,0,0,.95) 100%)!important}
  #play{font-size:6.2cqw;padding:2.6cqh 0;width:76cqw;border:.6cqw solid #fff;border-radius:999px;background:linear-gradient(180deg,#FF4A3D 0%,#E3140C 45%,#B80000 100%);box-shadow:0 1cqh 0 #6e0000,0 2cqh 3.4cqh #0008,inset 0 .5cqh 0 rgba(255,255,255,.35);animation:phpulse 1.3s ease-in-out infinite}
  @keyframes phpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}
  .stamp{font-size:11cqw!important;text-shadow:0 .6cqh 0 #FFD23A}
  #cta{background:linear-gradient(180deg,#FF4A3D 0%,#E3140C 45%,#B80000 100%);box-shadow:0 .8cqh 0 #6e0000,0 1.6cqh 2.6cqh #0006,inset 0 .4cqh 0 rgba(255,255,255,.35);animation:phpulse 1.3s ease-in-out infinite}
  #start .title{transform:rotate(-3deg);text-shadow:0 .9cqh 0 #7d0000,0 1.6cqh 2.4cqh #0006;margin:0 0 4.2cqh;font-size:11.5cqw}
  #share{background:linear-gradient(180deg,#FFE27A 0%,#F7C531 55%,#E0A800 100%);color:#7d0000;box-shadow:0 .8cqh 0 #A86D00,0 1.6cqh 2.6cqh #0005,inset 0 .4cqh 0 rgba(255,255,255,.5)}
  .sheet>*{flex-shrink:0} .sheet{padding-top:2cqh}
  .endlogo{margin:-9.5cqh 0 1.2cqh;background:#fff;border-radius:16px;padding:.9cqh 2.8cqw;border:.7cqw solid #F5C542;box-shadow:0 .8cqh 0 #7d0000,0 1.4cqh 2.6cqh #0005;position:relative;z-index:2;transform:scale(.6);opacity:0;transition:transform .45s cubic-bezier(.2,1.4,.4,1) .15s,opacity .2s .15s} .endlogo img{height:9cqh;display:block} #end.on .endlogo{transform:none;opacity:1}
  #end .stamp{font-size:9.5cqw!important} #end .fortune{margin:.6cqh 0 .2cqh} #end .stat{margin:0 0 1.8cqh}
  #end .prod{display:flex;flex-direction:row;align-items:center;gap:4cqw;width:100%;margin:0 0 2.2cqh;padding:1.6cqh 3.4cqw;border-radius:16px;background:#FFF4E6;border:2px solid #F3D9B8;text-align:left}
  .pz{width:30cqw;height:30cqw;flex:0 0 30cqw;border-radius:50%;overflow:hidden;border:1cqw solid #fff;box-shadow:0 1cqh 2cqh #0004,0 0 0 .5cqw #F5C542} .pz img{width:100%;height:100%;object-fit:cover;display:block}
  .pinfo{flex:1;min-width:0} .kick{display:inline-block;font:800 2.6cqw "Open Sans",sans-serif;color:#7d0000;background:linear-gradient(#FFE27A,#F5B700);padding:.4cqh 2cqw;border-radius:999px;text-transform:uppercase;letter-spacing:.04em}
  #end .name{font-size:7.6cqw;margin:.8cqh 0 .6cqh} .pline{margin:0;font:600 3.3cqw/1.35 "Open Sans",sans-serif;color:#4a403b}
  .snd{position:absolute;top:8.6cqh;right:2.6cqw;width:9cqw;height:9cqw;border-radius:50%;border:.6cqw solid #F5C542;background:#fff;box-shadow:0 .5cqh 0 #7d0000,0 .8cqh 1.6cqh #0005;padding:1.6cqw;cursor:pointer;z-index:5} .snd svg{width:100%;height:100%;display:block} .snd .x{display:none} .snd.off .x{display:block} .snd.off .w{display:none}
  #end .prod{flex-wrap:wrap;row-gap:1.4cqh}
  .adds{flex:0 0 100%;display:grid;grid-template-columns:repeat(3,1fr);gap:2cqw;border-top:2px dashed #EBCB9F;padding-top:1.3cqh;position:relative}
  .addk{position:absolute;top:-1.5cqh;left:50%;transform:translateX(-50%);background:#FFF4E6;padding:0 2cqw;font:800 2.4cqw "Open Sans",sans-serif;color:#9a6a2e;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap}
  .add{display:flex;flex-direction:column;align-items:center;text-align:center;gap:.3cqh} .add i{width:10cqw;height:10cqw;border-radius:50%;background:#fff url(assets/game/toppings.webp) no-repeat;background-size:300% 200%;border:.5cqw solid #F5C542;box-shadow:0 .4cqh .8cqh #0003}
  .add b{font:800 2.7cqw/1.15 "Open Sans",sans-serif;color:#2b2522} .add span{font:700 2.4cqw "Open Sans",sans-serif;color:#CE0000}
  .reward{display:flex;align-items:center;gap:2cqw;background:#fff;border:.6cqw solid #F5C542;border-radius:999px;padding:1cqh 4cqw 1cqh 2.6cqw;margin:-2.2cqh 0 3.4cqh;box-shadow:0 .6cqh 0 #a86d00,0 1.2cqh 2.4cqh #0006;animation:phpulse 1.6s ease-in-out infinite}
  .reward svg{width:7cqw;height:7cqw;flex:0 0 7cqw} .reward span{font:800 3.7cqw/1.2 "Open Sans",sans-serif;color:#7d0000}
  .ticket{display:flex;align-items:center;gap:3cqw;width:100%;margin:0 0 2cqh;padding:1.4cqh 4cqw;border-radius:14px;color:#fff;background:linear-gradient(180deg,#E3140C,#B80000);border:2px dashed #FFE27A;box-shadow:0 .6cqh 0 #6e0000,0 1.2cqh 2.4cqh #0004;position:relative;text-align:left}
  .ticket i{position:absolute;left:-2.4cqw;top:50%;width:4.8cqw;height:4.8cqw;margin-top:-2.4cqw;border-radius:50%;background:#fff} .ticket::after{content:"";position:absolute;right:-2.4cqw;top:50%;width:4.8cqw;height:4.8cqw;margin-top:-2.4cqw;border-radius:50%;background:#fff}
  .ticket div{flex:1} .ticket b{display:block;font-family:"Lilita One","Open Sans",sans-serif;font-weight:400;font-size:6cqw;line-height:1;color:#FFE27A;text-shadow:0 .4cqh 0 #6e0000} .ticket span{display:block;font:700 3.2cqw "Open Sans",sans-serif;margin-top:.5cqh}
  .ticket svg{width:9cqw;height:9cqw;flex:0 0 9cqw;background:#fff;border-radius:50%;padding:1.2cqw}
  #end:not(.won) .ticket{display:none} #end.won .stat,#end.won .pline{display:none} #end.won .fortune{margin:.4cqh 0 1.6cqh}
  #end:not(.won) .ticket{display:flex!important;background:linear-gradient(180deg,#9b908b,#7d726d);border-color:#d9d0cb;box-shadow:0 .6cqh 0 #4f4743,0 1.2cqh 2.4cqh #0003} #end:not(.won) .ticket b{color:#fff;text-shadow:0 .4cqh 0 #4f4743} #end:not(.won) .ticket svg{filter:grayscale(1);opacity:.75}
  #end:not(.won) #share{flex:0 0 38%;font-size:3.8cqw} #end:not(.won) #again{display:none} #end:not(.won) .stat{display:none}
  .ticket{-webkit-mask:radial-gradient(circle 2.6cqw at 0 50%,#0000 98%,#000) left/51% 100% no-repeat,radial-gradient(circle 2.6cqw at 100% 50%,#0000 98%,#000) right/51% 100% no-repeat;mask:radial-gradient(circle 2.6cqw at 0 50%,#0000 98%,#000) left/51% 100% no-repeat,radial-gradient(circle 2.6cqw at 100% 50%,#0000 98%,#000) right/51% 100% no-repeat;box-shadow:none!important;filter:drop-shadow(0 .6cqh 0 #6e0000)} .ticket::after,.ticket i{display:none!important} #end:not(.won) .ticket{filter:drop-shadow(0 .6cqh 0 #4f4743)}
  .reward.coupon{display:grid;grid-template-columns:auto 1fr;align-items:center;width:78cqw;padding:0;gap:0;border-radius:14px;border:2px dashed #FFE27A;background:linear-gradient(180deg,#E3140C,#B80000);box-shadow:none;margin:-2.4cqh 0 3.6cqh;animation:phpulse 1.6s ease-in-out infinite;
    -webkit-mask:radial-gradient(circle 2.6cqw at 0 50%,#0000 98%,#000) left/51% 100% no-repeat,radial-gradient(circle 2.6cqw at 100% 50%,#0000 98%,#000) right/51% 100% no-repeat;mask:radial-gradient(circle 2.6cqw at 0 50%,#0000 98%,#000) left/51% 100% no-repeat,radial-gradient(circle 2.6cqw at 100% 50%,#0000 98%,#000) right/51% 100% no-repeat;filter:drop-shadow(0 .7cqh 0 #6e0000) drop-shadow(0 1.4cqh 1.6cqh #0006)}
  .reward.coupon .stub{padding:1.6cqh 3cqw 1.6cqh 5cqw;border-right:2px dashed #FFE27A;display:flex;align-items:center} .reward.coupon .stub svg{width:9cqw;height:9cqw;background:#fff;border-radius:50%;padding:1.3cqw;flex:none}
  .reward.coupon .ctext{text-align:center;padding:1.3cqh 5cqw 1.3cqh 3cqw} .reward.coupon b{display:block;white-space:nowrap;font:400 5.6cqw/1 "Lilita One","Open Sans",sans-serif;color:#FFE27A;text-shadow:0 .4cqh 0 #6e0000;text-transform:uppercase} .reward.coupon span{display:block;font:700 3.3cqw "Open Sans",sans-serif;color:#fff;margin-top:.5cqh}
  .logo small{font-weight:600;font-size:2.4cqw;opacity:.8}
  .title{font-family:"Lilita One","Open Sans",sans-serif;font-size:10.5cqw;line-height:.98;text-align:center;color:#FFD23A;-webkit-text-stroke:1.6cqw #5a0000;paint-order:stroke fill;margin:0 0 1.6cqh;text-transform:uppercase}
  .line{font-weight:700;font-size:4.4cqw;text-align:center;margin:0 0 3.4cqh;text-shadow:0 2px 6px #0008}
  .btn{font:700 4.6cqw "Open Sans",sans-serif;border:0;border-radius:8px;padding:2.2cqh 0;width:72cqw;cursor:pointer;color:#fff;background:#CE0000;box-shadow:0 .7cqh 0 #7d0000,0 1.4cqh 2.4cqh #0006}
  .btn:active{transform:translateY(.5cqh);box-shadow:0 .2cqh 0 #7d0000}
  .btn.ghost{background:#fff;color:#CE0000;box-shadow:0 .7cqh 0 #d9cfc6}
  .link{background:none;border:0;color:#7a6f66;font:700 3.6cqw "Open Sans",sans-serif;text-decoration:underline;margin-top:1.6cqh;cursor:pointer}
  #end{justify-content:flex-end}
  .sheet{width:100%;background:#fff;color:#2b2522;border-radius:22px 22px 0 0;padding:2.6cqh 6cqw 3cqh;display:flex;flex-direction:column;align-items:center;transform:translateY(100%);transition:transform .45s cubic-bezier(.2,1.1,.3,1)}
  .sheet.up{transform:none}
  .checker{width:calc(100% + 12cqw);margin:-2.6cqh -6cqw 2cqh;height:3.2cqh;border-radius:22px 22px 0 0;background:repeating-conic-gradient(#CE0000 0 25%,#E8231C 0 50%) 0 0/3.2cqh 3.2cqh}
  .stamp{font-family:"Lilita One","Open Sans",sans-serif;font-size:9cqw;color:#CE0000;margin:0;line-height:1;text-transform:uppercase}
  .fortune{font-weight:800;font-size:4.2cqw;margin:1cqh 0 .2cqh;text-align:center}
  .stat{font-weight:600;font-size:3.3cqw;color:#7a6f66;margin:0 0 1.8cqh}
  .prod{display:flex;gap:4cqw;align-items:center;width:100%;margin-bottom:2.6cqh}
  .ph{width:30cqw;aspect-ratio:1;border-radius:50%;border:2px dashed #b9b0a8;background:#f1ece7;display:flex;align-items:center;justify-content:center;text-align:center;font:700 2.5cqw "Open Sans";color:#8e8780;padding:2cqw}
  .ph img{width:100%;height:100%;object-fit:cover;border-radius:50%} .ph:has(img){border:0;padding:0;position:relative;background:none} .ph em{position:absolute;bottom:6%;font-style:normal;font-size:2.2cqw;font-weight:700;color:#5c534c;background:#fffe;padding:.2cqh 1.6cqw;border-radius:6px;white-space:nowrap}
  .name{font-family:"Lilita One","Open Sans",sans-serif;font-size:7.4cqw;line-height:1;color:#2b2522}
  .sub{font-weight:700;font-size:3.4cqw;color:#CE0000;margin-top:.6cqh}
  .coupon{width:100%;border:2px dashed #CE0000;border-radius:12px;padding:1.4cqh 4cqw;margin-bottom:2.2cqh;display:grid;grid-template-columns:1fr auto;gap:.2cqh 3cqw;background:#fff6f4}
  .coupon b{font-size:3.2cqw;color:#CE0000;text-transform:uppercase;letter-spacing:.04em} .coupon span{font-size:3.4cqw;font-weight:700} .coupon i{font-style:normal;font-size:2.8cqw;color:#7a6f66;grid-column:2;grid-row:1/3;align-self:center;text-align:right}
  .row{display:flex;gap:3cqw;width:100%} .row .btn{width:auto;flex:1}
  `;
  let cardsMade = false;
  function makeCards() {
    if (cardsMade) return; cardsMade = true;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const stage = document.getElementById('stage');
    stage.insertAdjacentHTML('beforeend', `
      <div id="start" class="card ${ATTRACT && !has('embed') ? '' : ''}">${NOART ? `<div class="logo">${C.logo}<small>${C.logoNote}</small></div>` : `<div class="logo img"><img src="assets/game/logo.svg" alt="Pizza Hut"></div>`}
        ${NOART ? '' : `<div class="kicker">${C.itemSub}</div>`}<h1 class="title">${C.startTitle}</h1>${NOART ? '' : `<div class="reward coupon"><div class="stub"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10h18v4H3zM5 14h14v7H5z" fill="#CE0000"/><path d="M11 10h2v11h-2z" fill="#F5C542"/><path d="M12 10c-1.5-3.5-5-4-5.5-2S9 10 12 10zm0 0c1.5-3.5 5-4 5.5-2S15 10 12 10z" fill="none" stroke="#CE0000" stroke-width="1.6"/></svg></div><div class="ctext"><b>${C.rewardKick}</b><span>${C.rewardLine}</span></div></div>`}${NOART ? `<p class="line">${C.startLine}</p>` : ''}<button class="btn" id="play">${C.play}</button></div>
      <div id="end" class="card hidden"><div class="sheet" id="sheet"><div class="checker"></div>
        ${NOART ? '' : '<div class="endlogo"><img src="assets/game/logo.svg" alt="Pizza Hut"></div>'}
        <p class="stamp" id="stamp"></p><p class="fortune" id="fortune"></p><p class="stat" id="stat"></p>${NOART ? '' : `<div class="ticket"><div><b>${C.ticketKick}</b><span>${C.ticketLine}</span></div><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10h18v4H3zM5 14h14v7H5z" fill="#CE0000"/><path d="M11 10h2v11h-2z" fill="#F5C542"/><path d="M12 10c-1.5-3.5-5-4-5.5-2S9 10 12 10zm0 0c1.5-3.5 5-4 5.5-2S15 10 12 10z" fill="none" stroke="#CE0000" stroke-width="1.6"/></svg></div>`}
        <div class="prod">${NOART ? `<div class="ph">${C.photo}</div>` : '<div class="pz"><img src="assets/game/pizza-dressed.webp" alt="Lohei Pizza"></div>'}<div class="pinfo"><div class="kick">${C.prodKick}</div><div class="name">${C.item}</div><p class="pline">${C.prodLine}</p></div>${NOART ? '' : `<div class="adds"><div class="addk">${C.addsKick}</div>${C.adds.map((a, k) => `<div class="add"><i style="background-position:${k * 50}% 0"></i><b>${a[0]}</b>${a[1] ? `<span>${a[1]}</span>` : ''}</div>`).join('')}</div>`}</div>
        <div class="row"><button class="btn" id="cta">${C.cta}</button><button class="btn ghost" id="share">${C.share}</button></div>
        <button class="link" id="again">${C.again}</button></div></div>
      ${NOART ? '' : '<button id="snd" class="snd" aria-label="Sound"><svg viewBox="0 0 24 24"><path d="M4 9h4l5-4v14l-5-4H4z" fill="#CE0000"/><path class="w" d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="#CE0000" stroke-width="2" fill="none" stroke-linecap="round"/><path class="x" d="M16 9l5 6M21 9l-5 6" stroke="#8a807b" stroke-width="2.2" stroke-linecap="round"/></svg></button>'}`);
    document.getElementById('play').onclick = e => { e.stopPropagation(); SFX.unlock(); document.getElementById('start').classList.add('hidden'); reset('play'); };
    const snd = document.getElementById('snd'); if (snd) { const show = () => snd.classList.toggle('off', SFX.muted); show(); snd.onclick = e => { e.stopPropagation(); SFX.muted = !SFX.muted; SFX.unlock(); show(); }; }
    document.getElementById('cta').onclick = e => { e.stopPropagation(); if (!NOART && S && S.mode === 'fail') { document.getElementById('again').click(); return; } exit(CONFIG.ctaUrl); };
    document.getElementById('share').onclick = e => { e.stopPropagation(); if (!NOART && S && S.mode === 'fail') { exit(CONFIG.ctaUrl); return; } const m = (S && S.best || 2.6).toFixed(1), t = C.shareText.replace('{m}', m);   // synchronous inside the tap (all.md: phones block a window opened after an await)
      if (navigator.share) navigator.share({ text: t, url: CONFIG.ctaUrl }).catch(() => {}); else window.open('https://wa.me/?text=' + encodeURIComponent(t + ' ' + CONFIG.ctaUrl), '_blank'); };
    document.getElementById('again').onclick = e => { e.stopPropagation(); SFX.unlock(); document.getElementById('end').classList.add('hidden'); document.getElementById('end').classList.remove('on'); document.getElementById('sheet').classList.remove('up'); reset('play'); };
    if (!ATTRACT) document.getElementById('start').classList.toggle('hidden', BOT);
  }
  function exit(url) { const u = window.clickTag || url; if (window.mraid && mraid.open) mraid.open(u); else window.open(u, '_blank'); }
  function showCard(result) {
    const win = result === 'win', n = S.lit.length, last = n ? n - 1 : -1;
    document.getElementById('stamp').textContent = win ? C.winStamp : C.failStamp; document.getElementById('end').classList.toggle('won', win); if (!NOART) { document.getElementById('cta').textContent = win ? C.claim : C.playAgain; document.getElementById('share').textContent = win ? C.share : C.cta; const tk = document.querySelector('.ticket b'), tl = document.querySelector('.ticket span'); if (tk) { tk.textContent = win ? C.ticketKick : C.lockedKick; tl.textContent = win ? C.ticketLine : C.lockedLine; } }
    document.getElementById('fortune').textContent = win ? `${C.yours} ${C.fortunes[4]}` : n ? `${C.yours} ${C.fortunes[last]}` : C.failLine;
    document.getElementById('stat').textContent = C.stat.replace('{m}', Math.max(S.best, 0.1).toFixed(1)).replace('{n}', n);
    S.cardUp = true; document.getElementById('end').classList.remove('hidden'); requestAnimationFrame(() => requestAnimationFrame(() => { document.getElementById('sheet').classList.add('up'); document.getElementById('end').classList.add('on'); }));
  }

  // ── sim ─────────────────────────────────────────────────
  function runSim() {
    const out = [], N = +(Q.get('n') || 20);
    for (let r = 0; r < N; r++) {
      reset('play'); let n = 0, lastRes = null;
      while (S.mode === 'play' && !S.ended) { autopilot(); const before = S.toss && S.toss.res; update(1 / 60); if (S.toss && S.toss.res && !before) { lastRes = S.toss.res; learn(lastRes); } if (++n > 60 * 90) break; }
      out.push(`${S.mode === 'reveal' ? 'win ' : 'fail'} t=${S.t.toFixed(1)} lit=${S.lit.length} misses=${S.misses} best=${S.best.toFixed(2)} why=${S.why || '-'} zone=${S.i + 1}`);
    }
    const wins = out.filter(l => l.startsWith('win')).length;
    document.title = 'SIM'; document.body.innerHTML = `<pre id="sim">${HUMAN ? 'human bot' : 'perfect bot'}: ${wins}/${N} wins\n${out.join('\n')}</pre>`;
    throw new Error('sim done');
  }
  // ── layer contract: blueprint / explained / geometry ────
  function layerRoutes() {
    const bp = Q.get('blueprint') || Q.get('explained');
    if (bp) {
      const L = V.layers.find(l => l.id === bp); if (!L) { document.body.innerHTML = 'no layer ' + bp; throw new Error('no layer'); }
      const c = document.createElement('canvas'); c.width = L.canvas[0]; c.height = L.canvas[1]; c.style.cssText = 'max-width:100%;height:auto;display:block;background:#4A5A7A';
      document.body.innerHTML = ''; document.body.style.cssText = 'margin:0;background:#222'; document.body.appendChild(c);
      window.LAYERS.blueprint(c.getContext('2d'), L, c.width, c.height, { explain: has('explained'), key: L.key, cell: +(Q.get('cell') || 0) });
      document.title = `${L.id} ${L.name} ${has('explained') ? 'explained' : 'blueprint'}`; throw new Error('blueprint rendered');
    }
    if (has('geometry')) {
      const g = { canvas: [W, H], camera: V.camera, tableY: V.tableY, floorY: V.floorY, pxPerMetre: V.px, zoom: V.zoom, follow: !!V.follow, pizzaR: V.pizzaR, tableHalf: V.tableHalf,
        lanterns: CONFIG.lanterns.map((h, i) => ({ i: i + 1, heightM: h, x: sx(LX[i]), bobM: CONFIG.bob[i], halfWindowM: +halfWin(i).toFixed(3) })), ceilingM: CONFIG.ceil, releaseY: releaseY(), hudBand: [0, 62] };
      document.body.innerHTML = `<pre id="geometry">${JSON.stringify({ variant: V.id, format: 'playable', key: '#4A5A7A', geometry: g, layers: V.layers.map(l => ({ id: l.id, name: l.name, type: l.type, canvas: l.canvas, key: l.key || null, box: l.box || null, cells: l.cells || null, states: l.states || false, source: l.source || 'gemini', notes: l.notes })) }, null, 2)}</pre>`;
      document.title = 'GEOMETRY'; throw new Error('geometry printed');
    }
  }

  // ── run ─────────────────────────────────────────────────
  function run(view) {
    V = view; Object.assign(CONFIG, view.config || {}, CFG_Q); reset(SIM ? 'play' : ATTRACT || !BOT ? 'attract' : 'play');
    layerRoutes();
    if (SIM) runSim();
    document.body.innerHTML = '<div id="stage"><canvas width="640" height="960"></canvas></div>';
    cv = document.querySelector('canvas'); ctx = cv.getContext('2d');
    makeCards();
    if (BOT && !ATTRACT) reset('play');
    const card = Q.get('card'); if (card) { reset('play'); S.lit = card === 'win' ? [0, 1, 2, 3, 4] : [0, 1]; S.best = card === 'win' ? 2.62 : 1.43; S.dress = card === 'win' ? 5 : 2; S.mode = card === 'win' ? 'reveal' : 'fail'; S.reveal = 3; S.phase = 'done'; document.getElementById('start').classList.add('hidden'); showCard(card); }
    cv.addEventListener('pointerdown', e => { SFX.unlock(); down(e); cv.setPointerCapture?.(e.pointerId); });
    cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    let last = performance.now();
    const loop = now => { requestAnimationFrame(loop); const dt = Math.min(0.05, (now - last) / 1000); last = now;   // the next frame is booked first: one bad frame never stops the game
      if ((BOT || S.mode === 'attract') && !card) { const before = S.toss && S.toss.res; autopilot(); update(dt); if (S.toss && S.toss.res && !before) learn(S.toss.res); } else update(dt);
      frame(); };
    requestAnimationFrame(loop);
    window.GAME = { get S() { return S; }, CONFIG, launch, reset, SFX }; window.__SFX = SFX;
  }
  window.TossCore = { run, CONFIG, drawLanternShape: (c, x, y, s, lit) => { const o = ctx; ctx = c; drawLantern(x, y, s, lit, 0); ctx = o; } };
})();
