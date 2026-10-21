/* Trust No One — interactive CTV core (wife-dog-01). A view supplies its LAYOUT (where the squeezed spot, the title column and the
   portrait band sit, in frame fractions of a 16:9 TV); everything else is here: the spot, the six faces, the tells, the remote,
   the bots, the sim, the end state, the layer contract.
   The rule: the client's teaser plays on; six faces from it sit on the band. Once each, a face gives a tell (its frame pulses red and
   its own seconds of the teaser play inside it). Move to it with ◀ ▶ and press OK while it is live: SEEN. Miss it: it slips into the
   dark. Every face gets exactly one tell (rule 1h: nobody is singled out, nothing beyond the teaser is implied).
   Hooks: ?attract (plays itself, muted) · ?bot (perfect) · ?sim (200 rounds, numbers only) · ?sim&human (first-timer) ·
          ?card=end · ?geometry · ?embed · ?t=<s> (start at a time)
   window.GAME = { S, CONFIG } */
(function () {
  const Q = new URLSearchParams(location.search), has = k => Q.has(k);
  const CONFIG = {
    spot: 'uploads/teaser-60s-720p.mp4', spotW: 1280, spotH: 720,
    squeezeAt: 2.0, squeezeSecs: 0.9,                 // the teaser plays full screen, then squeezes into its box as the band slides in
    tells: [[8, 4.5], [16, 2.1], [24, 1.6], [32, 1.25], [40, 1.0], [47, 0.8]],   // base seconds (+ perStep for each step away); the first is the practice: up to 4.5 s whatever the distance, then an even ramp down (owner 16:46)
    titleAt: 53.0,                                    // the teaser's own title card: the band closes on the line
    preseek: 0.7, perStep: 0.4, practiceMax: 4.5, guided: 2,   // the first red waits up to 4.5 s; the first 2 reds show the way on the focused card
    // the response device, one place to change it (owner 16:34 asked about "scan to book tickets"): the trailer now; tickets when they exist
    qr: { url: 'https://www.youtube.com/watch?v=YBsTBGq6-hA', img: 'faces/qr_trailer.png', caption: 'Scan to watch the trailer', point: 'Scan the QR to watch the trailer' },                                     // the tell clip is cued this long before it starts
    faces: [   // the teaser's own shots (00-intake/faces/faces.json): [clip from, to] s, crop box in source px; no names (billing is the client's)
      { clip: [2.80, 3.95], box: [490, 100, 790, 500] }, { clip: [23.75, 24.90], box: [302, 100, 558, 440] },
      { clip: [29.00, 29.80], box: [442, 80, 698, 420] }, { clip: [30.00, 30.70], box: [332, 80, 588, 420] },
      { clip: [39.45, 40.35], box: [310, 130, 550, 450] }, { clip: [51.00, 52.80], box: [602, 90, 918, 510] },
    ],
    stepSecs: 0.14, react: [0.32, 0.36], humanReact: [0.42, 0.75], humanStep: 0.2, humanMisread: 0.08,
    remoteReact: [0.5, 0.9], remoteStep: 0.38,   // a first-timer on a real TV remote: slower to react, ~0.38 s a press (press + IR/Bluetooth + TV input lag)
    copy: { rule: 'Catch the face that turns red.', keys: ['◀ ▶', 'move', 'OK', 'catch'], watch: 'Watch the faces.', first: 'Catch the red face', caught: 'Caught', missed: 'Missed', count: n => `Caught ${n} of 6`,
            line: 'Trust no one.', seen: n => `You caught ${n} of 6.`, coming: 'Coming soon', },
  };
  const TELL = Q.get('tell') || 'redout';   // redout (default) | flip | clip (round 1)
  const SIM = has('sim'), REMOTE = has('remote'), HUMAN = has('human') || REMOTE, BOT = has('bot') || has('attract'), ATTRACT = has('attract');
  const rand = (a, b) => a + Math.random() * (b - a);

  // ── the round, as data: which face tells when (the face furthest from where the selector stands; ties broken at random) ──
  function newState() { return { mode: 'ready', sel: 2, tellIdx: -1, live: null, done: [], seen: 0, cueShown: false, log: [] }; }
  function pickFace(S) {
    const left = [0, 1, 2, 3, 4, 5].filter(i => !S.done.includes(i)), far = Math.max(...left.map(i => Math.abs(i - S.sel)));
    const c = left.filter(i => Math.abs(i - S.sel) === far); return c[Math.floor(Math.random() * c.length)];
  }
  function step(S, t, input) {   // advance the rules to teaser time t; input: 'L' | 'R' | 'OK' | null. Returns events.
    const ev = [];
    if (input === 'L') S.sel = Math.max(0, S.sel - 1); if (input === 'R') S.sel = Math.min(5, S.sel + 1);
    if (S.live && t >= S.live.end) { S.done.push(S.live.face); S.log.push({ face: S.live.face, seen: false }); ev.push({ k: 'miss', face: S.live.face }); S.live = null; }
    const next = CONFIG.tells[S.tellIdx + 1];
    if (!S.live && next && t >= next[0]) { S.tellIdx++; const face = S.cued ?? pickFace(S); S.cued = null; S.live = { face, start: next[0], end: next[0] + (S.tellIdx === 0 ? CONFIG.practiceMax : next[1] + CONFIG.perStep * Math.abs(face - S.sel)) }; ev.push({ k: 'tell', face }); }
    const after = CONFIG.tells[S.tellIdx + 1];   // cue the next face early (its clip must be seeked before it shows)
    if (!S.live && after && S.cued == null && t >= after[0] - CONFIG.preseek) { S.cued = pickFace(S); ev.push({ k: 'cue', face: S.cued }); }
    if (input === 'OK') {
      if (S.live && S.live.face === S.sel) { S.done.push(S.sel); S.seen++; S.log.push({ face: S.sel, seen: true }); ev.push({ k: 'seen', face: S.sel }); S.live = null; }
      else ev.push({ k: 'wrong', face: S.sel });
    }
    if (t >= CONFIG.titleAt && S.mode === 'play') { S.mode = 'end'; ev.push({ k: 'end' }); }
    return ev;
  }

  // ── bots: a perfect one, and a first-timer who reacts late, moves slower and sometimes misreads which face moved ──
  function bot(human) {
    let plan = null;
    return (S, t) => {
      if (!S.live) { plan = null; return null; }
      if (!plan || plan.face !== S.live.face) {
        const misread = human && Math.random() < CONFIG.humanMisread, target = misread ? Math.max(0, Math.min(5, S.live.face + (Math.random() < .5 ? -1 : 1))) : S.live.face;
        plan = { face: S.live.face, target, at: S.live.start + rand(...(REMOTE ? CONFIG.remoteReact : human ? CONFIG.humanReact : CONFIG.react)), next: 0 };
      }
      if (t < plan.at || t < plan.next) return null;
      plan.next = t + (REMOTE ? CONFIG.remoteStep : human ? CONFIG.humanStep : CONFIG.stepSecs);
      if (S.sel < plan.target) return 'R'; if (S.sel > plan.target) return 'L';
      if (plan.target !== S.live.face) { plan.target = S.live.face; return null; }   // the misread is noticed on arrival
      return 'OK';
    };
  }
  if (SIM) {   // numbers only: N rounds of the rules at 60 Hz
    const N = +(Q.get('n') || 200), b = bot(HUMAN), hist = [0, 0, 0, 0, 0, 0, 0];
    for (let r = 0; r < N; r++) { const S = newState(); S.mode = 'play'; for (let t = 0; t < 60; t += 1 / 60) { step(S, t, b(S, t)); if (S.mode === 'end') break; } hist[S.seen]++; }
    const mean = hist.reduce((a, c, i) => a + c * i, 0) / N, perTell = CONFIG.tells.map((_, k) => 0);
    document.title = 'SIM'; document.body.innerHTML = `<pre id="sim">${REMOTE ? 'first-timer on a TV remote' : HUMAN ? 'first-timer (keyboard)' : 'perfect'} bot, ${N} rounds: faces seen ${mean.toFixed(2)} of 6 on average · distribution 0-6: ${hist.join(' / ')} · 6 of 6: ${Math.round(hist[6] / N * 100)}%</pre>`;
    window.SIMRESULT = { mean, hist, N }; return;
  }

  // ── the screen ──
  window.TrustCore = { run(VIEW) {
    const L = VIEW.layout, A = VIEW.assets || '../../00-intake/', D = VIEW.decor === undefined ? '../../04-pack/out/' : VIEW.decor;   // asset bases: greybox (intake + pack) or build (assets/)
    if (has('geometry')) { document.body.innerHTML = `<pre id="geometry">${JSON.stringify({ variant: VIEW.id, canvas: [1920, 1080], format: 'ctv', layout: L, layers: VIEW.layers }, null, 1)}</pre>`; return; }
    const pct = v => (v * 100).toFixed(3) + '%';
    const css = `
    html,body{margin:0;height:100%;background:#000;overflow:hidden;font-family:Inter,system-ui,sans-serif;color:#e8e6e1}
    body{display:flex;align-items:center;justify-content:center}
    .tv{position:relative;width:min(100vw,calc(100vh*16/9));aspect-ratio:16/9;background:#0b0b0d;overflow:hidden;container-type:size}
    .spot{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;background:#000;transition:all ${CONFIG.squeezeSecs}s cubic-bezier(.6,0,.2,1);z-index:2}
    .tv.squeezed .spot{left:${pct(L.spot.x)};top:${pct(L.spot.y)};width:${pct(L.spot.w)};height:${pct(L.spot.h)}}
    .col,.band{position:absolute;background:#2b2b2e;opacity:0;transition:opacity .6s .3s}
    .tv.squeezed .col,.tv.squeezed .band{opacity:1}
    .col{left:${pct(L.col.x)};top:${pct(L.col.y)};width:${pct(L.col.w)};height:${pct(L.col.h)};display:flex;flex-direction:column;align-items:center;justify-content:${L.colTop ? 'flex-start' : 'center'};padding-top:${L.colTop || 0}cqh;box-sizing:border-box;gap:2.2cqh;background:#161618}
    .col img{width:78%;opacity:.92} .col .line{font:600 3.2cqh/1.2 Georgia,serif;letter-spacing:.04em;color:#f1efe9;text-align:center;min-height:4cqh;transition:opacity .5s}
    .col .sub{font:500 1.9cqh Inter,sans-serif;letter-spacing:.32em;text-transform:uppercase;color:#9a978f}
    .band{left:${pct(L.band.x)};top:${pct(L.band.y)};width:${pct(L.band.w)};height:${pct(L.band.h)};display:flex;align-items:center;justify-content:space-evenly;padding:0 1cqw;box-sizing:border-box}
    .face{position:relative;height:${L.faceH}cqh;aspect-ratio:3/4;background:#555 center/cover;outline:.35cqh solid #6c6c70;outline-offset:.25cqh;transition:filter .5s,transform .2s}
    .face canvas{position:absolute;inset:0;width:100%;height:100%;opacity:0}
    .face.sel{outline-color:#f1efe9;transform:translateY(-.8cqh)} .face.sel::after{content:'';position:absolute;left:50%;bottom:-2.4cqh;transform:translateX(-50%);border:1cqh solid transparent;border-bottom-color:#f1efe9}
    .face.live{outline-color:#d0142c;animation:pulse .5s ease-in-out infinite alternate} .tell-clip .face.live canvas{opacity:1}
    @keyframes pulse{from{box-shadow:0 0 0 0 rgba(208,20,44,.0)}to{box-shadow:0 0 2.6cqh .6cqh rgba(208,20,44,.85)}}
    .face.seen{outline-color:#d0142c} .face.seen::before{content:'CAUGHT';position:absolute;left:50%;top:84%;transform:translate(-50%,-50%) rotate(-8deg);font:800 1.9cqh Inter,sans-serif;letter-spacing:.12em;color:#fff;background:#d0142c;padding:.3cqh .9cqh;z-index:2}
    .face.gone{filter:brightness(.18) grayscale(1);outline-color:#333}
    .face.wrong{animation:shake .25s}
    @keyframes shake{25%{transform:translateX(-.6cqh)}75%{transform:translateX(.6cqh)}}
    .how{position:absolute;left:${pct((L.how || {}).x || 0)};top:${pct((L.how || {}).y || 0)};width:${pct((L.how || {}).w || 0)};display:flex;flex-direction:column;align-items:center;gap:1.4cqh;opacity:0;transition:opacity .6s .5s;z-index:3;text-align:center}
    .tv.squeezed .how{opacity:1}
    .how .rule{font:700 ${L.howSize || 2.6}cqh/1.25 Inter,sans-serif;color:#fff}
    .how .rule b{color:#ff3348}
    .how .keys{display:flex;gap:.9cqh;align-items:center;font:500 ${(L.howSize || 2.6) * .72}cqh Inter,sans-serif;color:#b9b6ae}
    .how .keys kbd{font:700 ${(L.howSize || 2.6) * .72}cqh Inter,sans-serif;color:#111;background:#e9e6df;border-radius:.6cqh;padding:.3cqh .8cqh;box-shadow:0 .3cqh 0 #8d8a83}
    .how .count{font:700 ${(L.howSize || 2.6) * .8}cqh Inter,sans-serif;color:#e9e6df;letter-spacing:.06em}
    .keysbar{position:absolute;left:${pct(L.band.x)};width:${pct(L.band.w)};top:${pct(L.band.y - .052)};height:4.4cqh;transform:translateY(-50%);display:flex;align-items:center;justify-content:center;gap:2.4cqh;z-index:3;opacity:0;transition:opacity .6s .5s;font:600 2.1cqh var(--sans);color:#d8d4cb}
    .tv.squeezed .keysbar{opacity:1} .tv.ended .keysbar{opacity:0}
    .keysbar em{font-style:normal;color:#ff3b4f;font-weight:700} .keysbar .sep{width:.12cqh;height:2.6cqh;background:var(--gilt2)}
    .keysbar .k{display:flex;align-items:center;gap:.8cqh;font:600 1.75cqh var(--sans);letter-spacing:.2em;text-transform:uppercase;color:var(--mute)}
    .keysbar kbd{display:grid;place-items:center;min-width:3.4cqh;height:3.4cqh;padding:0 .5cqh;box-sizing:border-box;font:700 1.6cqh var(--sans);color:var(--paper);background:linear-gradient(#2a2a2e,#1a1a1d);border:.15cqh solid #4a4a50;border-radius:.7cqh;box-shadow:0 .3cqh 0 #000}
    .keysbar kbd.ok{border-radius:50%;width:3.8cqh;height:3.8cqh;padding:0;line-height:1;padding-top:.08em;border-color:var(--gilt);color:var(--gilt)}
    .guide{position:absolute;z-index:5;transform:translate(-50%,-50%);display:grid;place-items:center;pointer-events:none;opacity:0;transition:opacity .12s}
    .guide.on{opacity:1}
    .guide b{display:flex;align-items:center;gap:.2cqh;height:5.4cqh;font:0/0 a;background:none;}
    .guide b i{display:block;width:1.5cqh;height:1.5cqh;border:solid #fff;border-width:.42cqh .42cqh 0 0;filter:drop-shadow(0 0 .6cqh rgba(255,255,255,.7));opacity:.2;animation:chev 0.9s linear infinite}
    .guide.r b i{transform:rotate(45deg)} .guide.l b i{transform:rotate(-135deg)}
    .guide.r b i:nth-child(2),.guide.l b i:nth-child(2){animation-delay:.15s} .guide.r b i:nth-child(3),.guide.l b i:nth-child(3){animation-delay:.3s}
    .guide.l b{flex-direction:row-reverse}
    @keyframes chev{0%{opacity:.15}30%{opacity:1}70%{opacity:.15}100%{opacity:.15}}
    /* OK on the red face: the remote's own round OK key, the letters optically centred (line-height 1, cap height centred) */
    .guide.ok b{display:grid;place-items:center;width:6.4cqh;height:6.4cqh;border-radius:50%;background:#fff;box-shadow:0 0 0 .5cqh rgba(208,20,44,.9),0 .6cqh 1.8cqh rgba(0,0,0,.6);animation:beat .5s ease-in-out infinite alternate}
    .guide.ok b::after{content:'OK';font:800 2.5cqh/1 Inter,sans-serif;letter-spacing:.02em;color:#c8102e;padding-top:.08em}
    .guide.l b{--dx:-1cqh} .guide.r b{--dx:1cqh}
    @keyframes nudge{from{transform:translateX(0)}to{transform:translateX(var(--dx,0))}}
    @keyframes beat{from{transform:scale(.92)}to{transform:scale(1.08)}}
    .flag{position:absolute;z-index:4;transform:translate(-50%,-100%);font:800 2.6cqh Inter,sans-serif;color:#fff;background:#d0142c;padding:.6cqh 1.4cqh;border-radius:.6cqh;white-space:nowrap;pointer-events:none;opacity:0;transition:opacity .15s}
    .flag::after{content:'';position:absolute;left:50%;top:100%;transform:translateX(-50%);border:1cqh solid transparent;border-top-color:#d0142c}
    .flag.on{opacity:1} .flag.ok{background:#1f9d55} .flag.ok::after{border-top-color:#1f9d55} .flag.bad{background:#555} .flag.bad::after{border-top-color:#555}
    .hint{position:absolute;left:${pct(L.hint.x)};top:${pct(L.hint.y)};transform:translate(-50%,-50%);font:600 2.2cqh Inter,sans-serif;color:#f1efe9;background:rgba(0,0,0,.55);padding:.7cqh 1.6cqh;border-radius:99px;opacity:0;transition:opacity .4s;z-index:3;white-space:nowrap}
    .hint.on{opacity:1} .hint.cue{background:#d0142c}
    /* tokens: ink near-black, paper white, gilt hairlines (the dinner's gold), red only for the game (the teaser's danger colour) */
    .tv{--ink:#0d0d0f;--ink2:#151517;--paper:#f2efe8;--mute:#8f8b82;--gilt:#a68d5b;--gilt2:#5e5034;--red:#d0142c;--serif:'Cormorant Garamond',Georgia,serif;--sans:Inter,system-ui,sans-serif}
    .col.dossier{background:radial-gradient(120% 70% at 50% 28%,rgba(28,28,31,.72) 0%,rgba(13,13,15,.93) 70%)${D ? `,url(${D}damask.webp) 0 0/46cqh 46cqh` : ''};border-right:.18cqh solid var(--gilt2);justify-content:flex-start;padding:7.5cqh 3.4cqh 0;gap:0}
    .dossier .lock{width:84%;opacity:.95}
    .dossier .rule-line{display:flex;align-items:center;gap:1.2cqh;width:72%;margin:3.6cqh 0 3.2cqh}
    .dossier .rule-line i{flex:1;height:.14cqh;background:linear-gradient(90deg,transparent,var(--gilt))} .dossier .rule-line i:last-child{background:linear-gradient(90deg,var(--gilt),transparent)}
    .dossier .rule-line b{width:1cqh;height:1cqh;background:var(--red);transform:rotate(45deg)}
    .dossier h2{margin:0;font:italic 500 5.4cqh/1 var(--serif);color:var(--paper);letter-spacing:.01em}
    .dossier .do{margin:2cqh 0 0;font:500 2.35cqh/1.35 var(--sans);color:#d8d4cb;text-align:center;max-width:90%}
    .dossier .do em{font-style:normal;color:#ff3b4f;font-weight:700}
    .dossier .legend{display:grid;grid-template-columns:auto auto;column-gap:1.4cqh;row-gap:1.1cqh;align-items:center;margin-top:3.2cqh}
    .dossier .legend span{font:600 1.75cqh var(--sans);letter-spacing:.2em;text-transform:uppercase;color:var(--mute)}
    .dossier .cap{display:flex;gap:.6cqh;justify-content:flex-end}
    .dossier .cap kbd{display:grid;place-items:center;min-width:3.4cqh;height:3.4cqh;padding:0 .5cqh;box-sizing:border-box;font:700 1.6cqh var(--sans);color:var(--paper);background:linear-gradient(#2a2a2e,#1a1a1d);border:.15cqh solid #4a4a50;border-radius:.7cqh;box-shadow:0 .3cqh 0 #000}
    .dossier .cap kbd.ok{border-radius:50%;width:3.8cqh;height:3.8cqh;padding:0;line-height:1;padding-top:.08em;border-color:var(--gilt);color:var(--gilt)}
    .dossier .tally{margin-top:3.2cqh;display:flex;flex-direction:column;align-items:center;gap:1.2cqh}
    .dossier .pips{display:flex;gap:.9cqh} .dossier .pips i{width:2cqh;height:2.7cqh;border:.15cqh solid var(--gilt2);border-radius:.25cqh;transition:all .3s}
    .dossier .pips i.live{border-color:var(--red);box-shadow:0 0 1cqh var(--red)} .dossier .pips i.seen{background:var(--red);border-color:var(--red)} .dossier .pips i.gone{background:#2a2a2d;border-color:#2a2a2d}
    .dossier .score{font:600 2cqh var(--sans);letter-spacing:.24em;text-transform:uppercase;color:var(--mute)} .dossier .score b{font:600 3.2cqh var(--serif);letter-spacing:0;color:var(--paper);margin-right:.4cqh}
    .dossier .foot{position:static;margin-top:auto;padding-bottom:5.5cqh;width:100%;display:flex;flex-direction:column;align-items:center;gap:1.1cqh}   /* pinned to the bottom by the flex, so the QR group never crowds Coming soon */
    .dossier .qr{margin-bottom:3cqh}
    .dossier .foot .soon{font:600 2.2cqh var(--sans);letter-spacing:.42em;text-transform:uppercase;color:var(--paper);padding-left:.42em}
    .dossier .foot .credit{font:italic 500 1.9cqh var(--serif);color:var(--mute)}
    .dossier .qr{display:flex;flex-direction:column;align-items:center;gap:1cqh;margin-bottom:1.6cqh}
    .tv.ended .dossier .qr .code{animation:rise .5s both}
    @keyframes rise{from{opacity:0;transform:translateY(1.5cqh)}to{opacity:1;transform:none}}
    .dossier .qr .code{width:19cqh;height:19cqh;display:block;border-radius:.6cqh;image-rendering:pixelated;box-shadow:0 0 0 .35cqh var(--gilt2)}
    .dossier .qr .code span{background:rgba(0,0,0,.65);padding:.4cqh .6cqh}
    .dossier .qr .cap{font:600 1.7cqh var(--sans);letter-spacing:.2em;text-transform:uppercase;color:var(--paper)}
    .dossier .foot::before{content:'';width:40%;height:.12cqh;background:var(--gilt2);margin-bottom:3cqh}
    .tv.ended .dossier .do,.tv.ended .dossier .legend{opacity:0;height:0;margin:0;overflow:hidden}
    .dossier .result{font:500 2.6cqh/1.3 var(--serif);color:#d8d4cb;margin-top:2cqh;display:none} .tv.ended .dossier .result{display:none}   /* the band says it now (16:31); the column keeps the pips */
    /* the band: a dark stage with a gilt edge; each face in a thin gilt frame, numbered like a gallery wall (no names: billing is the client's) */
    .band.gallery{background:linear-gradient(rgba(20,20,22,.9),rgba(11,11,13,.95))${D ? `,url(${D}damask.webp) 0 0/46cqh 46cqh` : ''};border-top:.18cqh solid var(--gilt2)}
    .gallery .face{outline:.3cqh solid var(--gilt);outline-offset:.45cqh;box-shadow:inset 0 0 0 .22cqh rgba(0,0,0,.55),0 0 0 .2cqh #2a2216,0 1cqh 2cqh rgba(0,0,0,.6)}
    .band.gallery{padding-bottom:4.8cqh}   /* iion review page: the row sits higher so the numerals clear the bottom edge (the TV frame trims ~0.6%) */
    .gallery .face .num{position:absolute;left:0;right:0;bottom:-2.9cqh;text-align:center;font:600 1.7cqh var(--serif);letter-spacing:.2em;color:var(--mute)}
    /* the remote's focus, the way TV interfaces show it (owner 16:28: "is there an indication of which card is highlighted?"): the card lifts and
       grows, a thick white ring with a glow, its numeral lit, a white bar under it */
    .gallery .face{transition:filter .25s,transform .18s cubic-bezier(.3,1.4,.5,1),outline-color .15s,box-shadow .2s}
    .gallery .face.sel{outline:.6cqh solid #fff;outline-offset:.35cqh;transform:translateY(-1.4cqh) scale(1.1);z-index:3;box-shadow:0 0 0 .35cqh rgba(0,0,0,.6),0 0 4cqh 1cqh rgba(255,255,255,.28)}
    .gallery .face.sel .num{color:#fff;font-weight:700} .gallery .face.sel::after{display:block;content:'';position:absolute;left:30%;right:30%;bottom:-4.5cqh;height:.6cqh;border:0;background:#fff;border-radius:.3cqh;transform:none}
    .tell-redout .band.haslive .face.sel:not(.live):not(.seen):not(.gone){filter:brightness(.75)}
    .gallery .face.sel.live{outline-color:#fff}
    /* tell A, redout: the face drains to black-and-white and floods red, punches forward; the rest of the band drops into shadow */
    .tell-redout .face .tint{position:absolute;inset:0;background:var(--red);mix-blend-mode:multiply;opacity:0;transition:opacity .12s}
    .tell-redout .face.live{background-color:#d0142c;background-blend-mode:luminosity;filter:contrast(1.3) brightness(1.15);transform:scale(1.16);z-index:2;outline:.5cqh solid var(--red);outline-offset:.2cqh;box-shadow:0 0 4cqh 1cqh rgba(208,20,44,.7);animation:none}
    .tell-redout .face.live .tint{opacity:.35;mix-blend-mode:screen;animation:throb .45s ease-in-out infinite alternate}
    @keyframes throb{from{opacity:.45}to{opacity:0}}
    .tell-redout .band.haslive .face:not(.live):not(.seen):not(.gone){filter:brightness(.38) saturate(.4)}
    /* tell B, flip: the portrait turns its back, a red card; catch it before it turns round again */
    .tell-flip .face{transform-style:preserve-3d;transition:transform .35s cubic-bezier(.3,1.4,.5,1)}
    .tell-flip .face .back{position:absolute;inset:0;background:radial-gradient(circle at 50% 40%,#e8213a,#7a0716);backface-visibility:hidden;transform:rotateY(180deg);display:grid;place-items:center;font:italic 600 9cqh var(--serif);color:rgba(255,255,255,.85)}
    .tell-flip .face.live{transform:rotateY(180deg) scale(1.08);outline-color:var(--red);animation:none}
    .tell-flip .band.haslive .face:not(.live):not(.seen):not(.gone){filter:brightness(.5)}
    .gallery .face.live{outline-color:var(--red)} .gallery .face.seen{outline-color:var(--red)} .gallery .face.gone .num{color:#3a3a3d}
    /* the end (owner 16:33): the band now carries the result and "Trust no one", so the column hands its space to the QR: the heading and the
       tally step aside and the code grows to be the one thing on the left, with time left in the teaser to scan it */
    .dossier h2,.dossier .tally{transition:opacity .4s}
    .tv.ended .dossier h2,.tv.ended .dossier .tally{opacity:0;height:0;margin:0;overflow:hidden}
    .dossier .foot{transition:bottom .6s cubic-bezier(.3,1,.4,1)}
    /* the end column on one vertical rhythm (owner 16:34: "space them out properly"): three groups centred as a block,
       title · QR + caption · Coming soon + credit, 5cqh between groups and 1.2cqh inside each */
    .tv.ended .col.dossier{justify-content:center;padding-top:0}
    .tv.ended .dossier .lock{width:76%}
    .tv.ended .dossier .rule-line{margin:2.4cqh 0 6.4cqh}
    .tv.ended .dossier .foot{margin-top:0;padding-bottom:0;gap:1.2cqh}
    .tv.ended .dossier .foot::before{display:none}
    .tv.ended .dossier .qr{margin-bottom:5cqh;gap:1.6cqh}
    .dossier .qr .code{transition:width .6s cubic-bezier(.3,1.2,.4,1),height .6s cubic-bezier(.3,1.2,.4,1)}
    .tv.ended .dossier .qr .code{width:31cqh;height:31cqh;box-shadow:0 0 0 .5cqh var(--gilt),0 0 4cqh rgba(166,141,91,.35)}
    .tv.ended .dossier .qr .cap{font-size:1.9cqh;letter-spacing:.14em;margin-top:.8cqh}
    .band .over{display:none;flex:1;align-items:center;justify-content:center;gap:3cqh;padding-right:2cqw}
    .tv.ended .band.gallery{justify-content:flex-start;gap:0;padding-left:4cqw}
    .tv.ended .band.gallery .face{height:15cqh;margin-left:1.2cqh;outline-width:.25cqh;outline-offset:.3cqh;box-shadow:0 1.2cqh 2.4cqh rgba(0,0,0,.75);transition:transform .7s cubic-bezier(.3,1.3,.4,1),height .6s}
    .tv.ended .band.gallery .face:first-child{margin-left:0} .tv.ended .band.gallery .face .num{display:none}
    .tv.ended .band.gallery .face:nth-child(1){transform:rotate(-9deg) translateY(.8cqh)}  .tv.ended .band.gallery .face:nth-child(2){transform:rotate(5deg) translateY(-1.2cqh)}
    .tv.ended .band.gallery .face:nth-child(3){transform:rotate(-3deg) translateY(1.4cqh)} .tv.ended .band.gallery .face:nth-child(4){transform:rotate(8deg) translateY(-.6cqh)}
    .tv.ended .band.gallery .face:nth-child(5){transform:rotate(-6deg) translateY(1cqh)}   .tv.ended .band.gallery .face:nth-child(6){transform:rotate(4deg) translateY(-1.4cqh)}
    .tv.ended .band.gallery .face.seen::before{font-size:1.4cqh;padding:.25cqh .6cqh}
    .tv.ended .band .over{display:flex;animation:rise .6s .2s both}
    .over .res{display:flex;flex-direction:column;align-items:flex-start;gap:.6cqh}
    .over .res{align-items:center} .over .res b{font:italic 500 6.4cqh/1 var(--serif);color:var(--paper);white-space:nowrap} .over .res span{font:600 2cqh var(--sans);letter-spacing:.42em;padding-left:.42em;text-transform:uppercase;color:var(--mute)}
    .over .point{display:flex;align-items:center;gap:1.2cqh;white-space:nowrap;font:600 1.9cqh var(--sans);color:var(--paper);padding:1.2cqh 2cqh;border:.15cqh solid var(--gilt2);border-radius:.6cqh}
    .over .point i{font-style:normal;color:var(--gilt);font-size:2.6cqh}
    .grey{position:absolute;right:.8cqw;top:.8cqh;font:700 1.4cqh Inter;letter-spacing:.14em;color:#777;z-index:4}
    .sound{position:absolute;right:1cqw;top:3.2cqh;z-index:5;font:600 1.6cqh Inter,sans-serif;color:#ddd;background:rgba(0,0,0,.6);border:.12cqh solid #444;padding:.6cqh 1.2cqh;border-radius:99px;transition:opacity .4s}
    `;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500;600;700&display=swap'; document.head.appendChild(l); }
    const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
    document.body.innerHTML = `<div class="tv tell-${TELL}" id="tv">
      <video class="spot" id="spot" src="${A}${CONFIG.spot}" playsinline preload="auto"></video>
      ${L.dossier ? `<div class="col dossier">
        <img class="lock" src="${A}faces/title_lockup.png" alt="Wife and Dog">
        <div class="rule-line"><i></i><b></b><i></i></div>
        <h2>${CONFIG.copy.line}</h2>

        <p class="result" id="result"></p>

        <div class="tally"><div class="pips" id="pips">${'<i></i>'.repeat(6)}</div><div class="score" id="count"><b>0</b> of 6 caught</div></div>
        <div class="foot"><div class="qr"><img class="code" src="${A}${CONFIG.qr.img}" alt="QR: ${CONFIG.qr.url}"><div class="cap">${CONFIG.qr.caption}</div></div><div class="soon">${CONFIG.copy.coming}</div><div class="credit">Written and directed by Guy Ritchie</div></div>
      </div>` : `<div class="col"><img src="${A}faces/title_lockup.png" alt="Wife and Dog"><div class="line" id="line"></div><div class="sub" id="sub">${CONFIG.copy.coming}</div></div>`}
      <div class="band ${L.dossier ? 'gallery' : ''}" id="band">${CONFIG.faces.map((f, i) => `<div class="face" data-i="${i}" style="background-image:url(${A}faces/face_${i + 1}.jpg)"><canvas width="180" height="240"></canvas><div class="tint"></div>${TELL === 'flip' ? '<div class="back">?</div>' : ''}${L.dossier ? `<div class="num">${ROMAN[i]}</div>` : ''}</div>`).join('')}${L.dossier ? `<div class="over"><div class="res"><b id="overRes"></b><span>Trust no one</span></div></div>` : ''}</div>
      ${L.dossier ? '' : `<div class="how" id="how"><div class="rule">Catch the face that turns <b>red</b>.</div>
        <div class="keys"><kbd>◀ ▶</kbd> move <kbd>OK</kbd> catch</div><div class="count" id="count">${CONFIG.copy.count(0)}</div></div>`}
      ${L.dossier ? `<div class="keysbar"><span>Catch the face that turns <em>red</em></span><i class="sep"></i><span class="k"><kbd>◀</kbd><kbd>▶</kbd> Move</span><span class="k"><kbd class="ok">OK</kbd> Catch</span></div>` : ''}
      <div class="flag" id="flag"></div><div class="guide" id="guide"><b></b></div>
      <div class="hint" id="hint"></div>
      ${VIEW.build ? '' : `<div class="grey">GREYBOX · ${VIEW.title.toUpperCase()}</div>`}
      ${BOT ? '' : '<div class="sound" id="sound">🔇 Preview: press any key or click for sound</div>'}
      <video id="tellv" src="${A}${CONFIG.spot}" muted playsinline preload="auto" style="display:none"></video></div>`;
    if (document.body.innerHTML.includes('${')) console.error('UNFILLED TEMPLATE in the markup: a ${...} inside a quoted string (16:43: the end strip showed CONFIG.qr.point)');
    const $ = id => document.getElementById(id), tv = $('tv'), spot = $('spot'), tellv = $('tellv'), faces = [...document.querySelectorAll('.face')], hint = $('hint');
    let S = newState(); window.GAME = { get S() { return S; }, CONFIG };
    const b = BOT ? bot(HUMAN) : null; const queued = [], hintUntil0 = 0; let hintUntil = 0;   // every press is kept: two presses inside one frame both count (16:47: the third of three quick presses was lost)
    const say = (text, secs, cue) => { hint.textContent = text; hint.classList.add('on'); hint.classList.toggle('cue', !!cue); hintUntil = performance.now() + secs * 1000; };
    function begin() {
      S = newState(); S.mode = 'play'; faces.forEach(f => f.className = 'face'); if ($('line')) $('line').textContent = ''; tv.classList.remove('ended'); if (L.dossier) setTimeout(tally, 0); tv.classList.remove('squeezed');
      const t0 = +(Q.get('t') || 0);   // QA: start mid-teaser; tells already past are skipped, not missed
      S.tellIdx = CONFIG.tells.filter(x => x[0] < t0).length - 1;
      const go = () => { spot.currentTime = t0; spot.muted = !(soundOn || (!BOT && heard)); spot.play().catch(() => { spot.muted = true; spot.play(); }); };
      if (spot.readyState >= 1) go(); else spot.addEventListener('loadedmetadata', go, { once: true });
    }
    function cueClip(face) { tellv.currentTime = CONFIG.faces[face].clip[0]; tellv.play().catch(() => {}); }
    const guide = $('guide');
    function guideNow() {   // on the focused card: which way to go, or OK when you are there
      const on = S.mode === 'play' && S.live && S.tellIdx < CONFIG.guided; guide.classList.toggle('on', !!on); if (!on) return;
      const d = Math.sign(S.live.face - S.sel), el = faces[S.sel].getBoundingClientRect(), tr = tv.getBoundingClientRect();
      const cls = 'guide on ' + (d > 0 ? 'r' : d < 0 ? 'l' : 'ok'); if (guide.className !== cls) { guide.className = cls; guide.firstChild.innerHTML = d ? '<i></i><i></i><i></i>' : ''; }
      const x = d > 0 ? el.right + el.width * .02 : d < 0 ? el.left - el.width * .02 : el.left + el.width / 2, y = el.top + el.height / 2;
      guide.style.left = (x - tr.left + (d > 0 ? guide.offsetWidth * .5 : d < 0 ? -guide.offsetWidth * .5 : 0)) + 'px'; guide.style.top = (y - tr.top) + 'px';
    }
    function render() {
      guideNow();
      faces.forEach((el, i) => { el.classList.toggle('sel', i === S.sel && S.mode === 'play'); el.classList.toggle('live', !!S.live && S.live.face === i); });
      $('band').classList.toggle('haslive', !!S.live);
      if (S.live && TELL === 'clip') {   // the face's own seconds of the teaser, cropped to the portrait
        const f = CONFIG.faces[S.live.face], c = faces[S.live.face].querySelector('canvas'), x = c.getContext('2d'), [x0, y0, x1, y1] = f.box;
        if (tellv.currentTime > f.clip[1] || tellv.currentTime < f.clip[0] - .05) tellv.currentTime = f.clip[0];
        if (tellv.readyState >= 2) x.drawImage(tellv, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height);
      }
      if (performance.now() > hintUntil) hint.classList.remove('on');
      if (performance.now() > flagUntil) flag.classList.remove('on');
    }
    let flagUntil = 0; const flag = $('flag');
    let AC = null;
    function thump() { if (spot.muted) return; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); const t = AC.currentTime, o = AC.createOscillator(), g = AC.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + .18); g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.5, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + .32);
      o.connect(g).connect(AC.destination); o.start(t); o.stop(t + .35); } catch (e) {} }
    function tally() {   // the column's six pips are the band in miniature: caught red, missed dark, the live one glowing
      const pips = $('pips'); if (pips) [...pips.children].forEach((pip, i) => { const c = faces[i].classList; pip.className = c.contains('seen') ? 'seen' : c.contains('gone') ? 'gone' : (S.live && S.live.face === i) ? 'live' : ''; });
      const c = $('count'); if (c) c.innerHTML = L.dossier ? `<b>${S.seen}</b> of 6 caught` : CONFIG.copy.count(S.seen);
    }
    function flagAt(i, text, cls, secs) { const r = faces[i].getBoundingClientRect(), t = tv.getBoundingClientRect(); flag.style.left = (r.left + r.width / 2 - t.left) + 'px'; flag.style.top = (r.top - t.top - 6) + 'px';
      flag.textContent = text; flag.className = 'flag on ' + (cls || ''); flagUntil = performance.now() + secs * 1000; }
    function events(ev) {
      ev.forEach(e => {
        if (e.k === 'cue') cueClip(e.face);
        if (e.k === 'tell') { setTimeout(tally, 0); thump(); if (!S.live || tellv.paused) cueClip(e.face); if (!S.cueShown) { S.cueShown = true; flagAt(e.face, CONFIG.copy.first, '', CONFIG.practiceMax); } }
        if (e.k === 'seen') { faces[e.face].classList.add('seen'); flagAt(e.face, CONFIG.copy.caught, 'ok', .9); tally(); }   // replaces the practice flag at once
        if (e.k === 'miss') { faces[e.face].classList.add('gone'); flagAt(e.face, CONFIG.copy.missed, 'bad', .9); tally(); }
        if (e.k === 'wrong') { const el = faces[e.face]; el.classList.remove('wrong'); void el.offsetWidth; el.classList.add('wrong'); }
        if (e.k === 'end' && L.dossier) { tellv.pause(); tv.classList.add('ended'); $('result').textContent = CONFIG.copy.seen(S.seen); $('overRes').textContent = CONFIG.copy.seen(S.seen); tally(); return; }
        if (e.k === 'end') { tellv.pause(); $('how').style.opacity = 0; $('line').innerHTML = `${CONFIG.copy.line}<br><span style="font:500 2cqh Inter;color:#9a978f">${CONFIG.copy.seen(S.seen)}</span>`; }
      });
    }
    // iion review page (creative-mocks): the bot's presses light the page's remote, and its "Turn sound on" button reaches the spot
    const emitKey = k => { try { parent.postMessage({ iionKey: { L: 'left', R: 'right', OK: 'ok' }[k] }, '*'); } catch (e) {} };
    let soundOn = false;
    window.DEMO = { start: () => begin(), get slotMs() { return (isFinite(spot.duration) ? spot.duration : 60) * 1000 + 1500; }, setAuto: () => {},
      setSound: on => { soundOn = !!on; spot.muted = !soundOn; } };
    let heard = false;   // the browser's sound rule, preview only: the first key or click unmutes; on a TV the ad plays with sound from the start
    const hear = () => { if (heard || BOT) return; heard = true; spot.muted = false; const c = $('sound'); if (c) { c.style.opacity = 0; setTimeout(() => c.remove(), 400); } };
    const key = k => { hear(); if (S.mode === 'play') queued.push(k); };
    addEventListener('keydown', e => { const k = { ArrowLeft: 'L', ArrowRight: 'R', Enter: 'OK', ' ': 'OK' }[e.key]; if (k) { e.preventDefault(); key(k); } });
    faces.forEach((el, i) => el.addEventListener('click', () => { if (S.mode !== 'play') return key('OK'); S.sel = i; queued.push('OK'); }));
    addEventListener('pointerdown', hear);
    spot.addEventListener('ended', () => { if (ATTRACT) setTimeout(begin, 1500); });   // a TV ad does not replay: the end frame holds (owner 16:02)
    if (has('card')) { const s1 = $('sound'); if (s1) s1.remove(); if ($('how')) $('how').remove(); S.mode = 'end'; tv.classList.add('squeezed'); [0, 1, 3, 4, 5].forEach(i => faces[i].classList.add('seen')); faces[2].classList.add('gone'); S.seen = 5; events([{ k: 'end' }]); spot.currentTime = 56; return; }
    begin();   // the unit starts on its own, like the ad break
    (function frame() {
      requestAnimationFrame(frame);
      if (S.mode !== 'play' && S.mode !== 'end') return;
      const t = spot.currentTime;
      if (t >= CONFIG.squeezeAt && !tv.classList.contains('squeezed')) { tv.classList.add('squeezed'); }
      if (S.mode === 'play') { if (queued.length) while (queued.length) events(step(S, t, queued.shift())); else { const inp = b && b(S, t); if (inp) emitKey(inp); events(step(S, t, inp)); } }
      render();
    })();
  } };
})();
