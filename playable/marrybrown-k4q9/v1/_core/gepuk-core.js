/* Gepuk It — shared game core for every greybox variant (rules, CONFIG, state, input, HUD, cards, bot,
   sim, layer contract). A variant supplies a VIEW: its layers (draw + drawBlueprint) and its geometry.
   Hooks: ?bot (autopilot plays a real round) · ?sim (20 instant rounds) · ?sim&human (sloppy bot)
          ?attract (plays itself, used by the control panel) · ?blueprint=Lx · ?explained=Lx · ?geometry
   window.GAME = { S, CONFIG, reset, tap } */
(function () {
  const Q = new URLSearchParams(location.search);
  const has = k => Q.has(k);

  const LEVELS = [['Belacan', 0.0], ['Cili padi', 0.2], ['Mala', 0.42], ['Cili api', 0.62], ['Gepuk', 0.82]];
  const CONFIG = {
    ctaUrl: 'https://www.marrybrown.com/',   // placeholder until the brief's landing page arrives; window.clickTag overrides
    roundSecs: 12,
    hit: 0.06,                       // heat per smash
    decay: [0.06, 0.10, 0.15, 0.21, 0.26],   // heat lost per second at each level (hold tempo = decay/hit taps per second)
    decayGrace: 0.10,                // seconds after a smash with no decay
    gepukAt: 0.82,                   // heat where the beat phase starts
    beatBpm: 112, beatWindow: 0.12,  // on-beat tolerance (fraction of a beat, each side)
    beatHits: 3, offBeatCost: 0.06, beatLeadIn: 2,   // beats of lead-in when the beat phase starts: the ring pulses, taps cost nothing, nothing counts (owner: the phase change must be seen before it costs)
    handEvery: [1.5, 2.3], handTravel: 1.4, handKnock: 0.45, handFirstAt: 2.2,
    startGrace: 1.5,                 // no cold fail in the first seconds
    idleToAttract: 3,
    copy: {
      startTitle: 'Most people fail this.', startLine: 'Tap to smash. Keep the heat up. Prove it.', play: 'Tap to play',
      hint: 'Tap to smash', beatHint: 'ON THE BEAT', leadInHint: 'GET READY: ON THE BEAT', cueHand: 'Smash to push the water away!', cueBeat: 'Wait for the ring, tap ON THE BEAT',
      winTitle: "YOU'VE EARNED YOUR BRAVE PASS.", winLine: 'You might be ready for Marrybrown Ayam Gepuk. Only The Brave Dares To Try.', cta: 'TRY IT NOW ›',
      failTitle: 'BRAVE PASS DENIED.', failLine: "Maybe order something else. This one's for people who actually makan pedas.",
      failWhy: { cold: 'The sambal went cold.', beat: 'You lost the beat.', hand: 'You took the iced water.', time: 'Out of time.' },
      giveUp: 'Give up', giveUpTaunt: 'Thought so.', share: 'Share my pass', shareFail: 'Share my denial (brave of you)',
      shareText: { win: 'I earned my Brave Pass. {smashes} smashes, {level} heat. Only The Brave Dares To Try. #BravePass', fail: 'Brave Pass DENIED. Maybe I should order something else. #BravePass' },
    },
  };

  const BOT = has('bot') || has('attract'), HUMAN = has('human'), SIM = has('sim'), ATTRACT = has('attract');
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const levelOf = h => { let l = 0; LEVELS.forEach((L, i) => { if (h >= L[1]) l = i; }); return l; };

  let S;
  function reset(mode) {
    S = { mode, heat: 0.12, elapsed: 0, timeLeft: CONFIG.roundSecs, smashes: 0, level: 0, lastTap: -9, lastTapOk: null,
      hand: { active: false, progress: 0, nextAt: CONFIG.handFirstAt }, beat: { on: false, phase: 0, hits: 0, flash: 0 },
      pestle: 0, shake: 0, chilis: [], drops: [], pops: [], why: null, reveal: 0, idle: 0, cue: null, seen: {} };
  }

  function tap(src) {
    if (S.mode !== 'play' && S.mode !== 'attract') return;
    S.smashes++; S.pestle = 1; S.shake = 1; S.lastTap = S.elapsed; S.idle = 0;
    if (S.hand.active) { S.hand.progress -= CONFIG.handKnock; if (S.hand.progress <= 0) S.hand.active = false; }
    if (S.beat.on) {
      const f = S.beat.phase % 1, d = Math.min(f, 1 - f);
      if (S.beat.phase < CONFIG.beatLeadIn) { S.pops.push({ t: 0, txt: 'wait for it' }); return; }   // lead-in: free, nothing counts
      if (d <= CONFIG.beatWindow) { S.beat.hits++; S.heat = clamp(S.heat + CONFIG.hit, 0, 1); S.lastTapOk = true; S.beat.flash = 1; S.pops.push({ t: 0, txt: 'ON BEAT' });
        if (S.beat.hits >= CONFIG.beatHits) return finish('win'); }
      else { S.heat = Math.max(0.05, S.heat - CONFIG.offBeatCost); S.lastTapOk = false; S.offBeat = (S.offBeat || 0) + 1; S.pops.push({ t: 0, txt: 'OFF BEAT' }); }
    } else {
      S.heat = clamp(S.heat + CONFIG.hit, 0, 1);
    }
    S.chilis.push({ x: rand(0.2, 0.8), y: -0.05, vy: rand(0.9, 1.3), vx: rand(-0.15, 0.15), r: rand(0, 6.28), kind: Math.floor(rand(0, 4)), t: 0 });
    for (let i = 0; i < 5; i++) S.drops.push({ x: 0.5 + rand(-0.08, 0.08), y: 0.72, vx: rand(-0.6, 0.6), vy: rand(-1.4, -0.6), t: 0 });
  }

  function finish(result, why) {
    const wasAttract = S.mode === 'attract';
    S.mode = result === 'win' ? 'reveal' : 'fail'; S.why = why || null; S.reveal = 0; S.attractEnd = wasAttract;
    if (!SIM && !wasAttract) { if (result === 'win') { hideHud(true); setTimeout(() => showCard('win'), 1900); } else showCard('fail'); }
  }

  function update(dt) {
    if (S.mode === 'reveal') { S.reveal += dt; if (S.reveal > 0.9) S.mode = 'win'; }
    if (S.mode === 'play' || S.mode === 'attract') {
      S.elapsed += dt; S.timeLeft = Math.max(0, CONFIG.roundSecs - S.elapsed); S.idle += dt;
      S.level = levelOf(S.heat);
      if (!S.beat.on && S.elapsed - S.lastTap > CONFIG.decayGrace) S.heat -= CONFIG.decay[S.level] * dt;   // the beat phase holds the heat: only off-beat taps or the hand can lose it
      S.heat = clamp(S.heat, 0, 1);
      // beat phase
      const wasOn = S.beat.on;
      S.beat.on = S.heat >= CONFIG.gepukAt - (wasOn ? 0.1 : 0);
      if (!wasOn && S.beat.on) { S.beat.phase = 0; S.beat.hits = 0; if (!S.seen.beat) { S.seen.beat = true; S.cue = { text: CONFIG.copy.cueBeat, until: S.elapsed + 1.8 }; } }
      if (S.beat.on) S.beat.phase += dt * CONFIG.beatBpm / 60;
      // hand
      if (!S.hand.active && S.elapsed >= S.hand.nextAt) { S.hand.active = true; S.hand.progress = 0; if (!S.seen.hand) { S.seen.hand = true; S.cue = { text: CONFIG.copy.cueHand, until: S.elapsed + 1.8 }; } }
      if (S.hand.active) { S.hand.progress += dt / CONFIG.handTravel; if (S.hand.progress >= 1) return finish('fail', 'hand'); }
      if (!S.hand.active && S.elapsed >= S.hand.nextAt) S.hand.nextAt = S.elapsed + rand(...CONFIG.handEvery);
      if (S.heat <= 0.001 && S.elapsed > CONFIG.startGrace) return finish('fail', S.offBeat >= 2 ? 'beat' : 'cold');
      if (S.timeLeft <= 0) return finish('fail', 'time');
    }
    S.pestle = Math.max(0, S.pestle - dt * 7); S.shake = Math.max(0, S.shake - dt * 6); S.beat.flash = Math.max(0, S.beat.flash - dt * 4);
    S.chilis.forEach(c => { c.t += dt; c.y += c.vy * dt; c.x += c.vx * dt; c.r += dt * 4; }); S.chilis = S.chilis.filter(c => c.y < 0.8);
    S.drops.forEach(d => { d.t += dt; d.x += d.vx * dt; d.vy += 3.2 * dt; d.y += d.vy * dt; }); S.drops = S.drops.filter(d => d.t < 0.8);
    S.pops.forEach(p => p.t += dt); S.pops = S.pops.filter(p => p.t < 0.7);
  }

  // ── autopilot ───────────────────────────────────────────
  let botNext = 0;
  function autopilot(dt) {
    const skill = HUMAN ? 1.15 : 1.5, jitter = HUMAN ? 0.09 : 0.0, miss = HUMAN ? 0.08 : 0;
    if (S.beat.on) {
      const f = S.beat.phase % 1, d = Math.min(f, 1 - f);
      // a human hears the beat but lands within ±0.18 of it; the window is ±0.12, so some taps bruise
      if (S._hb == null) S._hb = HUMAN ? rand(0, 0.18) : 0.03;
      const want = d <= S._hb && S.elapsed - S.lastTap > 0.25;
      if (want) { S._hb = null; if (Math.random() > miss) tap('bot'); else S.lastTap = S.elapsed; }
      return;
    }
    const tempo = (CONFIG.decay[S.level] / CONFIG.hit) * skill + 1.2;  // taps per second
    if (S.elapsed - S.lastTap >= 1 / tempo + (HUMAN ? rand(-0.05, 0.12) : 0)) { if (Math.random() > miss) tap('bot'); else S.lastTap = S.elapsed; }
  }

  // ── sim ─────────────────────────────────────────────────
  function runSim() {
    const out = [];
    for (let r = 0; r < 20; r++) {
      reset('play'); let n = 0;
      while (S.mode === 'play') { autopilot(1 / 60); update(1 / 60); if (++n > 60 * 30) break; }
      out.push(`${S.mode === 'reveal' || S.mode === 'win' ? 'win ' : 'fail'} t=${S.elapsed.toFixed(1)} smashes=${S.smashes} level=${LEVELS[levelOf(S.heat)][0]} heat=${(S.heat * 100).toFixed(0)}% why=${S.why || '-'} beatHits=${S.beat.hits}`);
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
      const ctx = c.getContext('2d'); const o = { explain: has('explained'), key: L.key }; if (L.shape) window.LAYERS.blueprint(ctx, L, c.width, c.height, o); else L.drawBlueprint(ctx, c.width, c.height, o);
      document.title = `${L.id} ${L.name} ${has('explained') ? 'explained' : 'blueprint'}`;
      throw new Error('blueprint rendered');
    }
    if (has('geometry')) {
      document.body.innerHTML = `<pre id="geometry">${JSON.stringify({ variant: VIEW.id, canvas: VIEW.canvas, format: 'playable', key: '#4A5A7A', camera: VIEW.camera || null, geometry: VIEW.geometry(), layers: VIEW.layers.map(l => ({ id: l.id, name: l.name, type: l.type, canvas: l.canvas, key: l.key, box: l.box || null, pivot: l.pivot || null, cells: l.cells || null, camera: l.camera || null, notes: l.notes })) }, null, 2)}</pre>`;
      document.title = 'GEOMETRY'; throw new Error('geometry printed');
    }
  }

  // ── DOM: HUD, cards ─────────────────────────────────────
  const CSS = `
  html,body{margin:0;height:100%;background:#000;font-family:Inter,system-ui,sans-serif;-webkit-user-select:none;user-select:none}
  .frame{position:relative;width:min(100vw,calc(100dvh*2/3));aspect-ratio:2/3;margin:0 auto;overflow:hidden;background:#2a2a2e;container-type:inline-size;touch-action:none}
  canvas#game{position:absolute;inset:0;width:100%;height:100%;display:block}
  .hud{position:absolute;inset:0;pointer-events:none;color:#fff;font-weight:700}
  .top{position:absolute;left:3cqw;right:3cqw;top:3cqw;display:flex;justify-content:space-between;align-items:flex-start;font-size:3.6cqw}
  .pill{background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:1.2cqw 2.6cqw}
  .meter{position:absolute;top:14cqw;bottom:24cqw;width:4cqw;border-radius:2cqw;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.25)}
  .meter.right{right:3cqw}.meter.left{left:3cqw}
  .meter .fill{position:absolute;left:0;right:0;bottom:0;border-radius:2cqw;background:linear-gradient(0deg,#f0a030,#e03020 70%,#ff2a2a);transition:height .08s}
  .meter .lv{position:absolute;left:5.5cqw;font-size:2.8cqw;font-weight:600;color:rgba(255,255,255,.75);white-space:nowrap;transform:translateY(50%)}
  .meter.right .lv{left:auto;right:5.5cqw;text-align:right}
  .meter.left .lv{left:5.5cqw;text-align:left}
  .meter .lv.on{color:#fff}.meter .lv.gepuk{color:#ff6a3a;font-weight:800}
  .meter .tick{position:absolute;left:-1cqw;right:-1cqw;height:1px;background:rgba(255,255,255,.4)}
  .hint{position:absolute;left:50%;bottom:6cqw;transform:translateX(-50%);font-size:3.8cqw;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:1.6cqw 4cqw;white-space:nowrap}
  .hint.beat{background:#e03020;border-color:#ff8a6a}
  .giveup{position:absolute;left:3cqw;bottom:6cqw;font-size:3cqw;font-weight:600;color:rgba(255,255,255,.6);text-decoration:underline;pointer-events:auto;cursor:pointer}
  .card{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;padding:10cqw 8cqw 9cqw;background:rgba(20,10,10,.55);backdrop-filter:blur(2px);color:#fff;text-align:center}
  .card[hidden]{display:none}
  .card .logo{height:16cqw;display:flex;align-items:center;justify-content:center;font-size:5cqw;font-weight:800;letter-spacing:.04em;border:2px dashed rgba(255,255,255,.5);border-radius:2cqw;padding:0 4cqw;color:rgba(255,255,255,.7)}
  .card h1{font-size:8cqw;line-height:1.05;margin:0 0 3cqw;letter-spacing:-.01em}
  .card p{font-size:4cqw;line-height:1.35;margin:0 0 2cqw;color:rgba(255,255,255,.85)}
  .card .big{font-size:5.4cqw;font-weight:800;color:#ffb088}
  .card .btns{display:grid;grid-template-columns:1fr 1fr;gap:3cqw}
  .card .btn{font:inherit;font-weight:800;font-size:4cqw;padding:4cqw 2cqw;border-radius:999px;border:2px solid #fff;background:#fff;color:#1d1d1f;cursor:pointer}
  .card .btn.ghost{background:transparent;color:#fff}
  .card.start .btn{grid-column:1/-1}
  .card .stamp{display:inline-block;margin:0 auto 4cqw;padding:2cqw 5cqw;border:1cqw solid #fff;border-radius:2cqw;font-size:9cqw;font-weight:900;letter-spacing:.04em;transform:rotate(-5deg);color:#fff;background:rgba(224,48,32,.85)}
  .card .stamp.denied{background:rgba(0,0,0,.5);border-color:rgba(255,255,255,.7)}
  .card .stamp small{display:block;font-size:3.6cqw;font-weight:700;letter-spacing:0;margin-top:1cqw}
  .card .link{display:block;margin-top:3cqw;font-size:3.6cqw;font-weight:600;color:rgba(255,255,255,.75);text-decoration:underline;cursor:pointer}
  .greylabel{position:absolute;right:2cqw;top:14cqw;font-size:2.6cqw;color:rgba(255,255,255,.35);font-weight:600;letter-spacing:.08em}
  .brandmark{position:absolute;left:50%;top:2cqw;transform:translateX(-50%);height:11cqw;display:flex;align-items:center;justify-content:center;pointer-events:none}
  .brandmark img{height:100%;width:auto;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))}
  .frame:has(.card:not([hidden])) .brandmark{display:none}
  /* ---- game-UI skin (builds only; rule: HUD looks like a game, not a web page). Brand tokens default until the kit lands */
  .frame.skin{--b1:#e03020;--b2:#ffbc7d;--ink:#1a0c08;--cream:#fff2df}
  .frame.revealing .top,.frame.revealing .meter,.frame.revealing .giveup,.frame.revealing .hint{opacity:0;transition:opacity .3s}
  .frame.skin .card.sheet{top:auto;height:62%;justify-content:flex-end;padding-top:4cqw;background:linear-gradient(180deg,rgba(20,10,10,0) 0%,rgba(20,10,10,.55) 14%,rgba(20,10,10,.92) 40%);backdrop-filter:none;animation:sheetup .45s cubic-bezier(.2,.9,.3,1)}
  .frame.skin .card.sheet .logo{height:12cqw}
  @keyframes sheetup{from{transform:translateY(40%);opacity:0}to{transform:none;opacity:1}}
  .frame.skin .pill{background:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,.04) 48%,rgba(0,0,0,.38));border:1px solid rgba(255,255,255,.45);box-shadow:0 .7cqw 1.4cqw rgba(0,0,0,.5),inset 0 .35cqw 0 rgba(255,255,255,.35),inset 0 -.35cqw 0 rgba(0,0,0,.45);text-shadow:0 .3cqw 0 rgba(0,0,0,.65);backdrop-filter:blur(2px)}
  .frame.skin .pill.bump{animation:bump .28s cubic-bezier(.2,1.6,.4,1)}
  @keyframes bump{0%{transform:scale(1)}40%{transform:scale(1.22)}100%{transform:scale(1)}}
  .frame.skin .meter{background:linear-gradient(90deg,#120a08,#2a1a14 50%,#120a08);border:1px solid rgba(255,255,255,.35);box-shadow:inset 0 .5cqw 1cqw rgba(0,0,0,.8),0 .4cqw 1cqw rgba(0,0,0,.5),inset 0 0 0 .25cqw rgba(0,0,0,.6)}
  .frame.skin .meter .fill{background:linear-gradient(0deg,var(--b2),var(--b1) 60%,#ff5a3a);box-shadow:0 0 1.6cqw rgba(224,48,32,.65),inset .5cqw 0 0 rgba(255,255,255,.35),inset -.5cqw 0 0 rgba(0,0,0,.25);overflow:hidden}
  .frame.skin .meter .fill::after{content:'';position:absolute;left:0;right:0;height:40%;top:-40%;background:linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,.55),rgba(255,255,255,0));animation:shine 1.6s linear infinite}
  @keyframes shine{to{top:120%}}
  .frame.skin .meter.lvup{animation:lvup .5s ease-out}
  @keyframes lvup{0%{box-shadow:0 0 0 0 rgba(255,188,125,.95),inset 0 .5cqw 1cqw rgba(0,0,0,.8)}100%{box-shadow:0 0 0 2.4cqw rgba(255,196,0,0),inset 0 .5cqw 1cqw rgba(0,0,0,.8)}}
  .frame.skin .meter .lv{text-shadow:0 .3cqw 0 rgba(0,0,0,.8),0 0 .8cqw rgba(0,0,0,.6)}
  .frame.skin .meter .lv.gepuk{color:var(--b2);text-shadow:0 .3cqw 0 rgba(0,0,0,.8),0 0 1.2cqw rgba(255,188,125,.7)}
  .frame.skin .hint{background:linear-gradient(180deg,rgba(255,255,255,.2),rgba(0,0,0,.45));border:1px solid rgba(255,255,255,.5);box-shadow:0 .7cqw 1.4cqw rgba(0,0,0,.5),inset 0 .35cqw 0 rgba(255,255,255,.3);text-shadow:0 .3cqw 0 rgba(0,0,0,.7)}
  .frame.skin .hint.beat{background:linear-gradient(180deg,#ff7a5a,var(--b1) 55%,#9c1a10);border-color:#ffb79e;box-shadow:0 0 2.4cqw rgba(224,48,32,.8),0 .7cqw 1.4cqw rgba(0,0,0,.5),inset 0 .35cqw 0 rgba(255,255,255,.45);animation:beatpulse .54s ease-in-out infinite}
  @keyframes beatpulse{50%{transform:translateX(-50%) scale(1.06)}}
  .frame.skin .card{background:radial-gradient(120% 80% at 50% 0%,rgba(224,48,32,.35),rgba(20,10,10,.7) 60%)}
  .frame.skin .card h1{text-shadow:0 .5cqw 0 rgba(0,0,0,.55),0 1.2cqw 2.4cqw rgba(0,0,0,.5)}
  .frame.skin .card .btn{background:linear-gradient(180deg,#ff6a5a,var(--b1) 50%,#b80000);color:#fff;border:0;box-shadow:0 .9cqw 0 #7a0000,0 1.4cqw 2.4cqw rgba(0,0,0,.45),inset 0 .4cqw 0 rgba(255,255,255,.45);text-shadow:0 .3cqw 0 rgba(0,0,0,.45);transition:transform .08s,box-shadow .08s}
  .frame.skin .card .btn:active{transform:translateY(.7cqw);box-shadow:0 .2cqw 0 #7a0000,0 .6cqw 1cqw rgba(0,0,0,.4),inset 0 .4cqw 0 rgba(255,255,255,.45)}
  .frame.skin .card .btn.ghost{background:linear-gradient(180deg,rgba(255,255,255,.22),rgba(255,255,255,.06));color:#fff;border:1px solid rgba(255,255,255,.55);box-shadow:0 .9cqw 0 rgba(0,0,0,.45),0 1.4cqw 2.4cqw rgba(0,0,0,.35),inset 0 .4cqw 0 rgba(255,255,255,.35);text-shadow:0 .3cqw 0 rgba(0,0,0,.6)}
  .frame.skin .card .stamp{background:linear-gradient(180deg,#fff,var(--cream));color:var(--b1);border-color:var(--b1);box-shadow:0 1cqw 2.4cqw rgba(0,0,0,.55),inset 0 .5cqw 0 rgba(255,255,255,.4),inset 0 -.5cqw 0 rgba(0,0,0,.35);text-shadow:0 .4cqw 0 rgba(0,0,0,.45)}
  .frame.skin .card .stamp.denied{background:linear-gradient(180deg,#4a4a52,#1c1c22);border-color:rgba(255,255,255,.8)}
  .brandmark.ph{font-size:2.6cqw;font-weight:800;letter-spacing:.08em;color:rgba(255,255,255,.6);border:1px dashed rgba(255,255,255,.4);border-radius:1.5cqw;padding:0 2.5cqw}
  .card .logo img{height:100%;width:auto}.card .logo.art{border:0}
  `;

  const FX = { sm: -1, lv: -1 };
  function mount(VIEW) {
    if (CONFIG.brand) { const b = CONFIG.brand, st = document.createElement('style'); st.textContent = `.frame.skin{${b.red ? '--b1:' + b.red + ';' : ''}${b.accent ? '--b2:' + b.accent + ';' : ''}${b.font ? 'font-family:' + b.font + ',Inter,system-ui,sans-serif;' : ''}}`; document.head.appendChild(st); if (b.fontUrl) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = b.fontUrl; document.head.appendChild(l); } }    const LOGO = CONFIG.brand && CONFIG.brand.logo ? `<div class="logo art"><img src="${CONFIG.brand.logo}" alt=""></div>` : `<div class="logo">BRAND LOGO</div>`;
    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    document.body.innerHTML = `
    <div class="${VIEW.build ? 'frame skin' : 'frame'}" id="frame">
      <canvas id="game"></canvas>
      <div class="hud">
        <div class="top"><span class="pill" id="count">0 smashes</span><span class="pill" id="timer">12.0</span></div>
        <div class="meter ${VIEW.meterSide || 'right'}" id="meter"><div class="fill" id="fill" style="height:12%"></div>
          ${LEVELS.map(L => `<div class="tick" style="bottom:${L[1] * 100}%"></div><div class="lv ${L[0] === 'Gepuk' ? 'gepuk' : ''}" data-l="${L[0]}" style="bottom:${L[1] * 100}%">${L[0]}</div>`).join('')}</div>
        <div class="hint" id="hint">${CONFIG.copy.hint}</div>
        <div class="giveup" id="giveup">${CONFIG.copy.giveUp}</div>
        ${CONFIG.brand && CONFIG.brand.logo ? `<div class="brandmark"><img src="${CONFIG.brand.logoOnArt || CONFIG.brand.logo}" alt=""></div>` : `<div class="brandmark ph">BRAND</div>`}
        ${VIEW.build ? '' : `<div class="greylabel">GREYBOX · ${VIEW.title.toUpperCase()}</div>`}
      </div>
      <div class="card start" id="startCard">${LOGO}
        <div><h1>${CONFIG.copy.startTitle}</h1><p>${CONFIG.copy.startLine}</p></div>
        <div class="btns"><button class="btn" id="playBtn">${CONFIG.copy.play}</button></div></div>
      <div class="card sheet" id="winCard" hidden>${LOGO}
        <div><div class="stamp" id="stamp">BRAVE PASS<small id="stampSub"></small></div><h1>${CONFIG.copy.winTitle}</h1><p>${CONFIG.copy.winLine}</p></div>
        <div><div class="btns"><button class="btn" id="cta1">${CONFIG.copy.cta}</button><button class="btn ghost" id="share1">${CONFIG.copy.share}</button></div><a class="link" id="again1">Play again</a></div></div>
      <div class="card" id="failCard" hidden>${LOGO}
        <div><div class="stamp denied">DENIED<small id="failWhy"></small></div><h1>${CONFIG.copy.failTitle}</h1><p>${CONFIG.copy.failLine}</p></div>
        <div><div class="btns"><button class="btn" id="again2">Try again</button><button class="btn ghost" id="cta2">${CONFIG.copy.cta}</button></div><a class="link" id="share2">${CONFIG.copy.shareFail}</a></div></div>
    </div>`;
    const $ = id => document.getElementById(id);
    const canvas = $('game'), ctx = canvas.getContext('2d');
    let W = 640, H = 960, dpr = Math.min(2, devicePixelRatio || 1);
    const resize = () => { const r = $('frame').getBoundingClientRect(); W = r.width; H = r.height; canvas.width = W * dpr; canvas.height = H * dpr; };
    new ResizeObserver(resize).observe($('frame')); resize();

    function showCard(which) {
      if (which === 'win') { $('stampSub').textContent = `${S.smashes} smashes · ${LEVELS[levelOf(S.heat)][0]} heat`; $('winCard').hidden = false; }
      else { $('failWhy').textContent = CONFIG.copy.failWhy[S.why] || ''; $('failCard').hidden = false; }
      $('hint').style.display = 'none';
    }
    window.__showCard = showCard; window.__hideHud = on => $('frame').classList.toggle('revealing', !!on);
    const hideCards = () => { $('winCard').hidden = true; $('failCard').hidden = true; $('startCard').hidden = true; $('hint').style.display = ''; $('frame').classList.remove('revealing'); };
    const startRound = () => { hideCards(); reset('play'); };
    $('playBtn').onclick = startRound; $('again1').onclick = startRound; $('again2').onclick = startRound;
    $('cta1').onclick = $('cta2').onclick = () => window.open(window.clickTag || CONFIG.ctaUrl, '_blank');
    // share card: code-drawn 1080×1350 image (the measure is a souvenir, never a stake)
    async function share(result) {
      const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const x = c.getContext('2d');
      x.fillStyle = result === 'win' ? '#b81e14' : '#2a2a2e'; x.fillRect(0, 0, 1080, 1350);
      x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 6; x.setLineDash([24, 18]); x.strokeRect(80, 120, 920, 160); x.setLineDash([]);
      x.fillStyle = '#fff'; x.font = '800 54px Inter, system-ui, sans-serif'; x.textAlign = 'center'; x.fillText('BRAND LOGO', 540, 220);
      x.save(); x.translate(540, 620); x.rotate(-0.12); x.strokeStyle = '#fff'; x.lineWidth = 18; x.strokeRect(-430, -120, 860, 240); x.font = '900 150px Inter, system-ui, sans-serif'; x.fillText(result === 'win' ? 'BRAVE PASS' : 'DENIED', 0, 55); x.restore();
      x.font = '700 48px Inter, system-ui, sans-serif'; x.fillText(result === 'win' ? `${S.smashes} smashes · ${LEVELS[levelOf(S.heat)][0]} heat` : (CONFIG.copy.failWhy[S.why] || CONFIG.copy.giveUpTaunt), 540, 860);
      x.font = '600 40px Inter, system-ui, sans-serif'; x.fillText(result === 'win' ? 'Only The Brave Dares To Try.' : "This one's for people who actually makan pedas.", 540, 1000);
      x.font = '600 34px Inter, system-ui, sans-serif'; x.fillStyle = 'rgba(255,255,255,.7)'; x.fillText('Marrybrown Ayam Gepuk · greybox', 540, 1260);
      const text = CONFIG.copy.shareText[result].replace('{smashes}', S.smashes).replace('{level}', LEVELS[levelOf(S.heat)][0]);
      const blob = await new Promise(r => c.toBlob(r, 'image/png')); const file = new File([blob], 'brave-pass.png', { type: 'image/png' });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], text }); return; } catch (e) { /* cancelled */ } }
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'brave-pass.png'; a.click();
    }
    $('share1').onclick = () => share('win'); $('share2').onclick = () => share('fail');
    $('giveup').onclick = () => { if (S.mode === 'play') { S.why = null; S.mode = 'fail'; $('failWhy').textContent = CONFIG.copy.giveUpTaunt; $('failCard').hidden = false; $('hint').style.display = 'none'; } };
    $('frame').addEventListener('pointerdown', e => {
      if (e.target.closest('.card') || e.target.closest('.giveup')) return;
      if (S.mode === 'attract') { startRound(); tap('user'); return; }
      tap('user');
    });
    window.addEventListener('keydown', e => { if (e.code === 'Space') { if (S.mode === 'attract') startRound(); tap('key'); } });

    reset(BOT && !ATTRACT ? 'play' : 'attract');
    if (ATTRACT || BOT) $('startCard').hidden = true;
    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (S.mode === 'attract' || (BOT && !ATTRACT && S.mode === 'play')) autopilot(dt);
      update(dt);
      if (S.attractEnd) { S.reveal += 0; if (S.mode === 'fail' || S.reveal > 1.6) { reset('attract'); } }
      // draw
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      ctx.save(); if (S.shake > 0) ctx.translate((Math.random() - .5) * 8 * S.shake, (Math.random() - .5) * 8 * S.shake);
      VIEW.drawFrame(ctx, S, W, H, LEVELS, CONFIG);
      ctx.restore();
      // HUD
      $('fill').style.height = (S.heat * 100) + '%'; $('count').textContent = `${S.smashes} smashes`; $('timer').textContent = S.timeLeft.toFixed(1);
      if (S.smashes !== FX.sm) { FX.sm = S.smashes; const c = $('count'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
      if (S.level !== FX.lv) { if (S.level > FX.lv && FX.lv >= 0) { const m = $('meter'); m.classList.remove('lvup'); void m.offsetWidth; m.classList.add('lvup'); } FX.lv = S.level; }
      document.querySelectorAll('.lv').forEach((el, i) => el.classList.toggle('on', i <= S.level));
      const hint = $('hint'); const cueOn = S.cue && S.elapsed < S.cue.until; hint.textContent = cueOn ? S.cue.text : S.beat.on ? CONFIG.copy.beatHint : CONFIG.copy.hint; hint.classList.toggle('beat', S.beat.on || !!cueOn);
      hint.style.opacity = cueOn || (S.mode === 'play' && S.idle < CONFIG.idleToAttract) || S.beat.on || S.mode === 'attract' ? 1 : 0;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  let showCard = w => window.__showCard && window.__showCard(w);
  let hideHud = on => window.__hideHud && window.__hideHud(on);

  window.Gepuk = {
    CONFIG, LEVELS,
    run(VIEW) { if (SIM) runSim(); layerRoutes(VIEW); if (window.LAYERS) window.LAYERS.load(VIEW.layers, 'assets/game/'); mount(VIEW); window.GAME = { get S() { return S; }, CONFIG, reset, tap }; },
    helpers: { clamp, rand, levelOf },
  };
})();
