/* Gepuk It — shared game core for every greybox variant (rules, CONFIG, state, input, HUD, cards, bot,
   sim, layer contract). A variant supplies a VIEW: its layers (draw + drawBlueprint) and its geometry.
   Hooks: ?bot (autopilot plays a real round) · ?sim (20 instant rounds) · ?sim&human (sloppy bot)
          ?attract (plays itself, used by the control panel) · ?blueprint=Lx · ?explained=Lx · ?geometry
   window.GAME = { S, CONFIG, reset, tap } */
(function () {
  const Q = new URLSearchParams(location.search);
  const has = k => Q.has(k);

  const STAGES = ['Belacan', 'Cili padi', 'Mala', 'Cili api', 'Gepuk'];   // the brief's heat ladder: one rung every 3 hits
  const CONFIG = {
    ctaUrl: 'https://www.marrybrown.com/',   // placeholder until the brief's landing page arrives; window.clickTag overrides
    roundSecs: 15,
    hitsToWin: 12, hitsPerStage: 3,
    tempos: [100, 114, 128, 142],      // bpm per stage (0..3): the pressure IS the tempo; starts slow enough to find
    windows: [0.22, 0.19, 0.16, 0.14],   // on-beat tolerance per stage, fraction of a beat each side: generous first, tight at the end
    beatWindow: 0.16,                // (fallback)
    beatLeadIn: 2,                   // the first chili takes two beats to fall: nothing counts before it lands
    fallBeats: 2,                    // a chili is in the air for two beats, so the next one is visible while you hit this one
    chiliByStage: [1, 0, 3, 2],      // which chili falls per stage (chili sheet cells): green chili, cili padi, mala peppercorn, cili api
    iceByStage: [0.14, 0.27, 0.34, 0.42],   // the coward's item: share of drops that are ice per stage, from the first stage on (owner: 'otherwise the game ends before the difficulty is reached'), never two in a row; smash it and the sambal is cold
    halfBeatFromStage: 2, halfBeatChance: 0.35,   // last stage: some chilis drop on the half-beat, so a memorised beat is not enough; the glow is the cue
    struckSecs: 0.14, missCost: 0.5,                // how long the struck frame shows after a hit
    idleToAttract: 3,
    copy: {
      tagline: 'Only The Brave Dares To Try', startTitle: 'Most people fail this.', startLine: 'Smash the chilis, never the ice. It gets faster. Prove it.', play: 'Tap to Play',
      hint: 'Tap when it glows hot', leadInHint: 'Here it comes', beatHint: 'NOW', holdHint: 'HOLD', cueBeat: 'Smash the chili when the spot glows', cueIce: 'Not that one!',
      winTitle: "YOU'VE EARNED YOUR BRAVE PASS.", winLine: 'You might be ready for Marrybrown Ayam Gepuk. Only The Brave Dares To Try.', cta: 'Try It Now  →',
      failTitle: 'BRAVE PASS DENIED.', failLine: "Maybe order something else. This one's for people who actually makan pedas.",
      failWhy: { time: "You couldn't keep up with the heat.", beat: 'You lost the beat.', ice: 'You kept cooling it down.' },
      giveUp: 'Give up', giveUpTaunt: 'Thought so.', share: 'Share my pass', shareFail: 'Share my denial (brave of you)',
      shareText: { win: 'I earned my Brave Pass at {level} tempo. Only The Brave Dares To Try. #BravePass', fail: 'Brave Pass DENIED at {level}. Maybe I should order something else. #BravePass' },
    },
  };
  const LEVELS = STAGES.map((n, i) => [n, i / 4]);   // kept for the share card and the sim line
  const stageOf = () => Math.min(4, Math.floor(S.hits / CONFIG.hitsPerStage));
  const stageName = () => STAGES[stageOf()];
  const BOT = has('bot') || has('attract'), HUMAN = has('human'), SIM = has('sim'), ATTRACT = has('attract');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const levelOf = h => { let l = 0; LEVELS.forEach((L, i) => { if (h >= L[1]) l = i; }); return l; };

  let S;
  function reset(mode) {
    S = { mode, heat: 0, elapsed: 0, timeLeft: CONFIG.roundSecs, hits: 0, smashes: 0, stage: 0, level: 0, lastTap: -9, lastTapOk: null,
      beat: { on: true, phase: 0, bpm: CONFIG.tempos[0], flash: 0, hits: 0 }, struck: 0, miss: 0, offBeat: 0, chill: 0, notes: [], nextNoteBeat: 0, glow: 0, cold: 0, iceHits: 0,
      hand: { active: false, progress: 0 }, pestle: 0, shake: 0, chilis: [], drops: [], pops: [], why: null, reveal: 0, idle: 0, cue: null, seen: {} };
  }

  function tap(src) {
    if (S.mode !== 'play' && S.mode !== 'attract') return;
    S.smashes++; S.lastTap = S.elapsed; S.idle = 0; if (src !== 'bot') SFX.unlock();
    const win = (CONFIG.windows || [])[Math.min(3, stageOf())] ?? CONFIG.beatWindow;
    let note = null, d = 9; S.notes.forEach(n => { const dd = Math.abs(S.beat.phase - n.land); if (dd < d) { d = dd; note = n; } });   // the nearest chili, landed or about to
    const f = note ? (S.beat.phase < note.land ? 0.9 : 0.1) : 0.5;   // for the EARLY / LATE pop
    if (note && d <= win && note.ice) {   // smashed the ice: the sambal cools, you lose a stage of progress (visible on the chicken and the thermometer), the round goes on
      note.hit = true; S.hits = Math.max(0, S.hits - CONFIG.hitsPerStage); S.iceHits++; S.chill = 0; S.cold = 1; S.shake = .6; S.struck = CONFIG.struckSecs; S.heat = S.hits / CONFIG.hitsToWin; S.level = stageOf();
      S.stage = stageOf(); S.beat.bpm = CONFIG.tempos[Math.min(3, S.stage)]; S.pops.push({ t: 0, txt: 'COLD!', big: true, cold: true }); if (!SIM) SFX.ice(); return; }
    if (note && d <= win) {   // HIT: the chili is smashed into the chicken
      note.hit = true;
      S.hits++; S.beat.hits++; S.struck = CONFIG.struckSecs; S.pestle = 1; S.shake = 1; S.beat.flash = 1; S.lastTapOk = true; if (!SIM) SFX.hit();
      S.chill = 0; S.heat = S.hits / CONFIG.hitsToWin; S.level = stageOf();   // a clean hit re-heats: any dip from a miss recovers
      for (let i = 0; i < 2; i++) S.chilis.push({ x: rand(0.3, 0.7), y: -0.05, vy: rand(0.9, 1.3), vx: rand(-0.15, 0.15), r: rand(0, 6.28), kind: Math.floor(rand(0, 4)), t: 0 });
      for (let i = 0; i < 5; i++) S.drops.push({ x: 0.5 + rand(-0.08, 0.08), y: 0.72, vx: rand(-0.6, 0.6), vy: rand(-1.4, -0.6), t: 0 });
      if (S.hits >= CONFIG.hitsToWin) return finish('win');
      if (S.hits % CONFIG.hitsPerStage === 0) { S.stage = stageOf(); S.beat.bpm = CONFIG.tempos[Math.min(3, S.stage)]; S.pops.push({ t: 0, txt: STAGES[S.stage].toUpperCase(), big: true }); if (!SIM) SFX.stage(); }
      else S.pops.push({ t: 0, txt: 'ON BEAT' });
    } else {   // MISS: a dull thud beside the bowl, no progress, no penalty
      S.struck = CONFIG.struckSecs * .6; S.miss = 1; S.shake = .35; S.lastTapOk = false; S.offBeat++; S.chill += CONFIG.missCost; if (S.chill >= 1) { S.chill -= 1; S.hits = Math.max(0, S.hits - 1); S.level = stageOf(); } S.heat = Math.max(0, S.hits - S.chill) / CONFIG.hitsToWin; S.pops.push({ t: 0, txt: f < 0.5 ? 'LATE' : 'EARLY' }); if (!SIM) SFX.miss();   // tell the player how to correct
    }
  }

  function finish(result, why) {
    const wasAttract = S.mode === 'attract';
    S.mode = result === 'win' ? 'reveal' : 'fail'; S.why = why || null; S.reveal = 0; S.attractEnd = wasAttract;
    if (!SIM && !wasAttract) { if (result === 'win') { SFX.win(); hideHud(true); setTimeout(() => showCard('win'), 1900); } else { SFX.fail(); hideHud(true); setTimeout(() => showCard('fail'), 700); } }
  }

  function update(dt) {
    if (S.mode === 'reveal') { S.reveal += dt; if (S.reveal > 0.9) S.mode = 'win'; }
    if (S.mode === 'play' || S.mode === 'attract') {
      S.elapsed += dt; S.timeLeft = Math.max(0, CONFIG.roundSecs - S.elapsed); S.idle += dt;
      S.beat.phase += dt * S.beat.bpm / 60; if (!SIM && S.mode === 'play') SFX.beat(S.beat.phase);
      while (S.nextNoteBeat <= S.beat.phase + 0.001) {   // one drop per beat, lands two beats later; ice only once a stage has been earned (never two in a row); in the last stage some on the half-beat
        const st = stageOf(), ice = S.hits >= CONFIG.hitsPerStage && !S._lastIce && Math.random() < CONFIG.iceByStage[Math.min(3, st)], half = st >= CONFIG.halfBeatFromStage && Math.random() < CONFIG.halfBeatChance ? 0.5 : 0;
        S.notes.push({ land: S.nextNoteBeat + CONFIG.fallBeats + half, kind: CONFIG.chiliByStage[Math.min(3, st)], ice, hit: false }); S._lastIce = ice; S.nextNoteBeat += 1;
        if (ice && !S.seen.ice) { S.seen.ice = true; S.cue = { text: CONFIG.copy.cueIce, until: S.elapsed + 1.4 }; } }
      { const win = (CONFIG.windows || [])[Math.min(3, stageOf())] ?? CONFIG.beatWindow; S.notes = S.notes.filter(n => !n.hit && S.beat.phase < n.land + win + 0.05); const inWin = S.notes.filter(n => Math.abs(S.beat.phase - n.land) <= win); S.glow = inWin.length ? (inWin.some(n => n.ice) ? 2 : 1) : 0; }   // 1 = hot (tap), 2 = cold (hold)
      if (!S.seen.beat && S.beat.phase >= CONFIG.beatLeadIn - 0.5) { S.seen.beat = true; S.cue = { text: CONFIG.copy.cueBeat, until: S.elapsed + 1.6 }; }
      if (S.timeLeft <= 0) return finish('fail', S.iceHits >= 2 ? 'ice' : S.offBeat > S.hits ? 'beat' : 'time');
    }
    S.struck = Math.max(0, S.struck - dt); S.miss = Math.max(0, S.miss - dt * 4); S.cold = Math.max(0, S.cold - dt * 1.6); S.pestle = Math.max(0, S.pestle - dt * 7); S.shake = Math.max(0, S.shake - dt * 6); S.beat.flash = Math.max(0, S.beat.flash - dt * 4);
    S.chilis.forEach(c => { c.t += dt; c.y += c.vy * dt; c.x += c.vx * dt; c.r += dt * 4; }); S.chilis = S.chilis.filter(c => c.y < 0.8);
    S.drops.forEach(d => { d.t += dt; d.x += d.vx * dt; d.vy += 3.2 * dt; d.y += d.vy * dt; }); S.drops = S.drops.filter(d => d.t < 0.8);
    S.pops.forEach(p => p.t += dt); S.pops = S.pops.filter(p => p.t < (p.big ? 1.1 : 0.7));
  }

  // ── autopilot ───────────────────────────────────────────
  let botNext = 0;
  function autopilot(dt) {
    // perfect bot: taps each chili just after it lands and lets the ice pass. first-timer bot: +-0.30 beat until its first 3 hits
    // land, +-0.24 after, skips 10% of chilis, and smashes the ice 12% of the time (a reflex it has to unlearn).
    S.notes.forEach(n => {
      if (n.hit || n.botDone) return;
      if (n.err == null) { const spread = HUMAN ? (S.hits < 3 ? 0.30 : 0.24) : 0.03; n.err = HUMAN ? rand(-spread, spread) : 0.03; n.skip = HUMAN && Math.random() < 0.10; n.smashIce = HUMAN && Math.random() < 0.10; }   // reading a blue glow is easy: the first-timer smashes ice 8% of the time
      if (S.beat.phase >= n.land + n.err) { n.botDone = true; if (n.ice ? n.smashIce : !n.skip) tap('bot'); }
    });
  }

  // ── sim ─────────────────────────────────────────────────
  function runSim() {
    const out = [];
    for (let r = 0; r < 20; r++) {
      reset('play'); let n = 0;
      while (S.mode === 'play') { autopilot(1 / 60); update(1 / 60); if (++n > 60 * 30) break; }
      out.push(`${S.mode === 'reveal' || S.mode === 'win' ? 'win ' : 'fail'} t=${S.elapsed.toFixed(1)} smashes=${S.smashes} stage=${stageName()} hits=${S.hits} misses=${S.offBeat} ice=${S.iceHits} why=${S.why || '-'} beatHits=${S.beat.hits}`);
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
      const ctx = c.getContext('2d'); const o = { explain: has('explained'), key: L.key, cell: +(Q.get('cell') || 0) }; if (L.shape) window.LAYERS.blueprint(ctx, L, c.width, c.height, o); else L.drawBlueprint(ctx, c.width, c.height, o);
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
  .mute{position:absolute;right:3cqw;top:23cqw;width:9cqw;height:9cqw;border-radius:50%;border:1px solid rgba(255,255,255,.4);background:rgba(0,0,0,.45);color:#fff;font-size:4.2cqw;pointer-events:auto;cursor:pointer}.mute.off{opacity:.5}
  .frame:has(.card:not([hidden])) .mute{display:none}
  .thermo{position:absolute;left:3cqw;right:3cqw;top:20.5cqw;height:3.4cqw;border-radius:2cqw;background:rgba(0,0,0,.6);border:1px solid rgba(255,255,255,.6)}
  .thermo .tghost{position:absolute;left:0;top:0;bottom:0;border-radius:2cqw;opacity:0;background:rgba(255,255,255,.8)}
  .thermo .tfill{position:absolute;left:0;top:0;bottom:0;border-radius:2cqw;background:linear-gradient(90deg,#ffb03a,#ff5a1f 60%,#ff2a2a);transition:width .18s ease-out}
  .thermo .thead{position:absolute;right:-2.8cqw;top:50%;width:6.4cqw;height:7.4cqw;margin-top:-4.5cqw;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 28'%3E%3Cpath d='M12 1c1.5 5 7 7.5 7 15a7 7 0 0 1-14 0c0-3 1.5-5 3-6.5 0 2.5 1 4 2.5 4.5C9.5 10 9 6 12 1z' fill='%23ff5a1f' stroke='%23fff' stroke-width='1.2'/%3E%3Cpath d='M12 13.5c.8 2.5 3 3.5 3 6a3 3 0 0 1-6 0c0-1.5.8-2.3 1.5-3 .1 1 .5 1.6 1.2 1.9-.6-1.5-.6-3 .3-4.9z' fill='%23ffe08a'/%3E%3C/svg%3E") center/contain no-repeat;filter:drop-shadow(0 0 .6cqw rgba(255,255,255,.9)) drop-shadow(0 .3cqw .6cqw rgba(0,0,0,.5));transform-origin:50% 90%}   /* the flame marks the heat level (SVG, not an emoji: emoji differ per phone) */
  .thermo .ttick{position:absolute;top:-1px;bottom:-1px;width:1px;background:rgba(255,255,255,.4)}
  .thermo.cold .tfill{transition:width .55s cubic-bezier(.3,.7,.4,1);background:linear-gradient(90deg,#7fd4ff,#2a6fb0)}   /* the drop on ice is slow enough to watch */
  .thermo.cold .thead{filter:hue-rotate(190deg) saturate(.7) drop-shadow(0 0 .6cqw rgba(200,240,255,.9))}   /* the flame goes blue when the sambal cools */
  @keyframes tghost{0%{opacity:1}100%{opacity:0}}@keyframes thead{0%{transform:scale(1)}40%{transform:scale(1.7)}100%{transform:scale(1)}}
  .thermo.up .tghost{animation:tghost .6s ease-out both}.thermo.up .thead{animation:thead .35s ease-out}   /* gain: a white flash over the new segment, the head pops */
  .thermo.down .tghost{background:rgba(127,212,255,.85);animation:tghost .9s ease-out both}   /* loss: a blue tail stays where the heat was */
  .frame.skin .thermo{box-shadow:inset 0 .4cqw .8cqw rgba(0,0,0,.8),0 .3cqw .8cqw rgba(0,0,0,.4)}
  .frame.skin .thermo .tfill{box-shadow:0 0 1.4cqw rgba(224,48,32,.6)}
  .hint{position:absolute;left:50%;bottom:6cqw;transform:translateX(-50%);font-size:3.8cqw;background:rgba(0,0,0,.45);border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:1.6cqw 4cqw;white-space:nowrap}
  .hint.beat{background:#e03020;border-color:#ff8a6a}
  .hint.cold{background:#2a6fb0;border-color:#9fd3ff}
  .giveup{position:absolute;left:3cqw;bottom:6cqw;font-size:3cqw;font-weight:600;color:rgba(255,255,255,.6);text-decoration:underline;pointer-events:auto;cursor:pointer}
  .card{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:space-between;gap:4cqw;padding:7cqw 7cqw 7cqw;background:rgba(20,10,10,.55);backdrop-filter:blur(2px);color:#fff;text-align:center}
  .card .mid{display:flex;flex-direction:column;align-items:center;gap:2.2cqw}
  .card .row{display:flex;justify-content:center;align-items:center;gap:2cqw;margin-top:1cqw}.card .row .dot{color:rgba(255,255,255,.6)}
  .card.sheet .stamp.big{position:absolute;top:-5cqw;left:50%;transform:translateX(-50%) rotate(-7deg);font-size:7.2cqw;padding:1.8cqw 5cqw;margin:0;z-index:3}
  .card.sheet .stamp.big:not(.denied)::after{content:'';position:absolute;right:-12cqw;top:-11cqw;width:24cqw;height:24cqw;background:url(assets/game/chilis.webp) 0 100%/200% 200% no-repeat;transform:rotate(20deg);filter:drop-shadow(0 .8cqw 1.2cqw rgba(0,0,0,.4));z-index:-1}
  .card .stamp.denied{position:relative}.card .stamp.denied::after{content:'';position:absolute;right:-11cqw;top:-10cqw;width:20cqw;height:20cqw;z-index:-1;background:url(assets/game/ice-cube.webp) center/contain no-repeat;transform:rotate(-15deg);filter:drop-shadow(0 .6cqw .8cqw rgba(0,0,0,.35))}   /* the ice on DENIED: the cold reference */   /* a chili from the game tucked on the stamp: the spice reference without touching the brief's copy */
  .card.sheet .corner{position:absolute;top:5cqw;right:5cqw;z-index:2}.card.sheet .corner .logo{height:7.5cqw;margin:0}
  .card .cap{font-size:3.2cqw;font-weight:700;letter-spacing:.04em;color:rgba(255,255,255,.7);text-transform:uppercase;margin-top:.5cqw}
  .frame:has(.card:not([hidden])) .top,.frame:has(.card:not([hidden])) .thermo,.frame:has(.card:not([hidden])) .hint,.frame:has(.card:not([hidden])) .greylabel{display:none}
  .card[hidden]{display:none}
  .card.start .logo{height:30cqw;margin-top:6cqw}
  .card.start .logo img{filter:drop-shadow(0 2cqw 4cqw rgba(0,0,0,.55))}
  .card.start h1{font-size:8.4cqw}
  .card.start .btn{font-size:4.8cqw;min-height:14cqw}
  .frame.skin .card.start{background:transparent;padding:0;gap:0;justify-content:space-between;top:-3px;left:-2px;right:-2px;bottom:-3px}   /* overflows the frame on all sides: no hairline at any DPR */
  .frame.skin .card.start .logo{width:100%;height:auto;padding:calc(4cqw + 2px) 0 6cqw;margin:-2px 0 0;background:linear-gradient(180deg,#ff0000,#f00000);border-radius:0 0 50% 50% / 0 0 18% 18%;box-shadow:0 1.5cqw 3cqw rgba(0,0,0,.25)}
  .frame.skin .card.start .logo img{height:17cqw;filter:drop-shadow(0 1.5cqw 3cqw rgba(0,0,0,.4))}
  .frame.skin .card.start .mid{width:100%;margin-top:auto;padding:8cqw 7cqw 1cqw;gap:1.2cqw;background:#ff0000;border-radius:50% 50% 0 0 / 14% 14% 0 0;box-shadow:0 -1.5cqw 3cqw rgba(0,0,0,.25)}
  .frame.skin .card.start .btns{width:100%;box-sizing:border-box;padding:2.5cqw 7cqw 5cqw;background:#ff0000}
  .frame.skin .card.start p{font-size:3.4cqw}
  .frame.skin .card.start .btn{min-height:12cqw}
  .frame.skin:has(#startCard:not([hidden])) canvas#game{transform:translateY(-22%) scale(1.04);transition:transform .5s cubic-bezier(.2,.9,.3,1)}
  .frame.skin:has(#failCard:not([hidden])) canvas#game{transform:translateY(-26%) scale(1.0);transition:transform .5s cubic-bezier(.2,.9,.3,1)}   /* on the splash the game rises into the window between the bands */
  .frame.skin canvas#game{transition:transform .5s cubic-bezier(.2,.9,.3,1)}
  .frame.skin .card.start .mid{box-sizing:border-box}
  .frame.skin .card.start .logo{box-sizing:border-box}
  .frame.skin .card.start .btn{animation:breathe 2s ease-in-out .5s infinite}
  .frame.skin .card.start h1{font-size:7.4cqw;text-shadow:0 .5cqw 0 rgba(0,0,0,.25)}
  .card .logo{height:20cqw;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:5cqw;font-weight:800;letter-spacing:.04em;border:2px dashed rgba(255,255,255,.5);border-radius:2cqw;padding:0 4cqw;color:rgba(255,255,255,.7)}
  .card h1{font-size:6.4cqw;line-height:1.08;margin:0;letter-spacing:-.01em;max-width:28ch;font-weight:900}   /* the site's headings are Lato 900 */
  .card p{font-size:3.6cqw;line-height:1.38;margin:0;color:rgba(255,255,255,.88);max-width:34ch}
  .card .big{font-size:5.4cqw;font-weight:800;color:#ffb088}
  .card .btns{display:grid;grid-template-columns:1fr;gap:3cqw;width:100%}
  .card .btn{font:inherit;font-weight:700;text-transform:none;font-size:4.1cqw;min-height:11.5cqw;padding:3.2cqw 4cqw;border-radius:999px;border:2px solid #fff;background:#fff;color:#1d1d1f;cursor:pointer}
  .card .btn.ghost{background:transparent;color:#fff}
  .card.start .btn{grid-column:1/-1}
  .card .stamp{display:inline-block;margin:0 auto 1.5cqw;padding:1.6cqw 4.5cqw;border:.8cqw solid #fff;border-radius:1.8cqw;font-size:6.4cqw;font-weight:900;letter-spacing:.05em;transform:rotate(-4deg);color:#fff;background:rgba(224,48,32,.85)}
  .card .stamp.denied{background:rgba(0,0,0,.5);border-color:rgba(255,255,255,.7)}
  .card .stamp small{display:block;font-size:3.4cqw;font-weight:700;letter-spacing:0;margin-top:.6cqw}
  .card .link{display:block;margin-top:2cqw;font-size:3.5cqw;font-weight:600;color:rgba(255,255,255,.8);text-decoration:underline;cursor:pointer;padding:1.5cqw}
  .greylabel{position:absolute;right:2cqw;top:22cqw;font-size:2.6cqw;color:rgba(255,255,255,.35);font-weight:600;letter-spacing:.08em}
  /* loader: in a build nothing of the game shows until every asset has settled (errors count, 10 s cap); the brand holds the screen */
  .loader{position:absolute;inset:0;z-index:9;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5cqw;background:linear-gradient(180deg,#ff0000,#d40000);transition:opacity .45s ease}
  .loader.done{opacity:0;pointer-events:none}.loader[hidden]{display:none}
  .loader img{height:26cqw;filter:drop-shadow(0 1.5cqw 3cqw rgba(0,0,0,.35));animation:pulse 1.4s ease-in-out infinite}
  .loader .bar{width:38cqw;height:1.4cqw;border-radius:1cqw;background:rgba(0,0,0,.25);overflow:hidden}.loader .bar i{display:block;height:100%;width:0;background:#fff;border-radius:1cqw;transition:width .25s ease}
  @keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
  .frame.loading canvas#game,.frame.loading .hud,.frame.loading .card{visibility:hidden}
  html.embed,html.embed body{background:#000;overflow:hidden;height:100%}html.embed body{display:flex;align-items:center;justify-content:center}html.embed .frame{width:min(100vw,calc(100vh * 2 / 3));height:min(100vh,calc(100vw * 3 / 2));aspect-ratio:auto;margin:0}
  @media (min-aspect-ratio:131/200) and (max-aspect-ratio:17/25){html.embed .frame{width:100vw;height:100vh}}   /* the hairline: an iframe cut to 2:3 by CSS rounds to a size a fraction off 2:3, so a letterboxed frame leaves a sub-pixel strip of body showing (top/bottom or sides, any DPR). Within 2% of 2:3 the frame simply fills the iframe (a <2% stretch nobody sees); real phones (far from 2:3) keep the letterbox */   /* full-screen on a phone: the 2:3 unit centred with black letterbox, exactly the interstitial slot */
  .brandmark{position:absolute;left:50%;top:1.6cqw;transform:translateX(-50%);height:14cqw;display:flex;align-items:center;justify-content:center;pointer-events:none}
  .brandmark img{height:100%;width:auto;filter:drop-shadow(0 .6cqw 1.2cqw rgba(0,0,0,.55))}
  .frame:has(.card:not([hidden])) .brandmark{display:none}
  /* ---- game-UI skin (builds only; rule: HUD looks like a game, not a web page). Brand tokens default until the kit lands */
  .frame.skin{--b1:#e03020;--b2:#ffbc7d;--ink:#1a0c08;--cream:#fff2df}
  .frame.revealing .top,.frame.revealing .thermo,.frame.revealing .hint{opacity:0;transition:opacity .3s}
  .frame.revealing .brandmark{display:none}   /* the in-game lockup leaves the instant the plate starts rising */
  .frame.skin .card.sheet{bottom:-3px;left:-2px;right:-2px;--stamp-lift:6cqw;--stamp-h:12.8cqw;--stamp-tilt:3cqw;--stamp-gap:6cqw;top:auto;height:auto;max-height:66%;justify-content:flex-end;gap:4cqw;padding-top:calc(var(--stamp-h) + var(--stamp-tilt) + var(--stamp-gap) - var(--stamp-lift));background:transparent;backdrop-filter:none;animation:sheetup .45s cubic-bezier(.2,.9,.3,1)}
  .frame.skin .card.sheet::after{content:'';position:absolute;inset:0;z-index:1;background:linear-gradient(180deg,#ff0000 0%,#d40000 100%);border-radius:50% 50% 0 0 / 16% 16% 0 0}   /* the brand site's section edge: a convex red arc */
  .frame.skin .card.sheet>*{position:relative;z-index:2}
  .frame.skin .card.sheet .corner{position:absolute;top:-31.7cqw;left:50%;transform:translateX(-50%);z-index:3}   /* measured: equal padding between the plate's bottom and the stamp's top */
  .frame.skin #failCard .corner{display:none}
  .frame.skin #failCard.sheet{--stamp-h:17.6cqw}   /* DENIED carries a second line (the reason), so the stamp is taller and the padding follows it: same gap to the title as on the pass */
  .frame.skin:has(#failCard:not([hidden])) .brandmark{display:flex;height:21cqw;top:4cqw;opacity:1}
  .frame.skin:has(#failCard:not([hidden])) .brandmark img{height:21cqw;filter:drop-shadow(0 .8cqw 1.6cqw rgba(0,0,0,.55))}   /* white lockup over the photo */   /* no plate on the fail: the lockup goes to the top of the frame, over the scene */
  .frame.skin .card.sheet .corner .logo{height:18cqw;filter:drop-shadow(0 .8cqw 1.6cqw rgba(0,0,0,.5))}
  .frame.skin .card.sheet .stamp.big{position:absolute;z-index:3;white-space:nowrap;top:calc(-1 * var(--stamp-lift))}   /* the lift rule above must not pull the corner lockup or the stamp into the column */
  .frame.skin .card.sheet .logo{height:8cqw;margin-bottom:-1cqw}   /* on the win sheet the dish is the hero: the lockup is small, at the top of the sheet, never on the dish */
  @keyframes sheetup{from{transform:translateY(40%);opacity:0}to{transform:none;opacity:1}}
  @keyframes slam{0%{transform:translateX(-50%) rotate(-7deg) scale(2.2);opacity:0}60%{transform:translateX(-50%) rotate(-7deg) scale(.94);opacity:1}100%{transform:translateX(-50%) rotate(-7deg) scale(1)}}
  @keyframes slamc{0%{transform:rotate(-4deg) scale(2.2);opacity:0}60%{transform:rotate(-4deg) scale(.94);opacity:1}100%{transform:rotate(-4deg) scale(1)}}
  @keyframes rise{from{transform:translateY(3cqw);opacity:0}to{transform:none;opacity:1}}
  @keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.03)}}
  @keyframes wiggle{0%,100%{transform:rotate(20deg)}50%{transform:rotate(30deg)}}
  @keyframes drip{0%,100%{transform:rotate(-15deg) translateY(0)}50%{transform:rotate(-12deg) translateY(.6cqw)}}
  .frame.skin .card.sheet .stamp.big{animation:slam .55s cubic-bezier(.2,1.2,.3,1) .35s both}
  .frame.skin .card#failCard .stamp.denied{animation:slam .55s cubic-bezier(.2,1.2,.3,1) .35s both}
  .frame.skin .card .mid>*{animation:rise .5s ease-out both}.frame.skin .card .mid>*:nth-child(1){animation-delay:.55s}.frame.skin .card .mid>*:nth-child(2){animation-delay:.68s}.frame.skin .card .mid>*:nth-child(3){animation-delay:.8s}
  .frame.skin .card:not(.start) .btn{animation:breathe 2.4s ease-in-out 1.4s infinite}
  .frame.skin .card.sheet .stamp.big::after{animation:wiggle 2.6s ease-in-out 1s infinite}
  .frame.skin .card .stamp.denied::after{animation:drip 2.2s ease-in-out 1s infinite}
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
  .frame.skin .card{background:linear-gradient(180deg,var(--b1) 0%,#d40000 100%);backdrop-filter:none;color:#fff}
  .frame.skin .card p{color:var(--cream)}
  .frame.skin .card .cap{color:var(--cream);opacity:.9}
  .frame.skin .card .link{color:#fff}
  .frame.skin .card h1{text-shadow:0 .5cqw 0 rgba(0,0,0,.55),0 1.2cqw 2.4cqw rgba(0,0,0,.5)}
  .frame.skin .card .btn{background:linear-gradient(180deg,#2a2a2a,#111);color:#fff;border:0;box-shadow:0 .9cqw 0 #000,0 1.4cqw 2.4cqw rgba(0,0,0,.35),inset 0 .4cqw 0 rgba(255,255,255,.18);text-shadow:none;transition:transform .08s,box-shadow .08s}
  .frame.skin .card .btn:active{transform:translateY(.7cqw);box-shadow:0 .2cqw 0 #000,0 .6cqw 1cqw rgba(0,0,0,.3),inset 0 .4cqw 0 rgba(255,255,255,.18)}
  .frame.skin .card .btn.ghost{background:transparent;color:#fff;border:2px solid #fff;box-shadow:0 .9cqw 0 rgba(0,0,0,.25);text-shadow:none}
  .frame.skin .card .stamp{background:linear-gradient(180deg,#fff,var(--cream));color:#d40000;border-color:#fff;box-shadow:0 1cqw 2.4cqw rgba(0,0,0,.55),inset 0 .5cqw 0 rgba(255,255,255,.4),inset 0 -.5cqw 0 rgba(0,0,0,.35);text-shadow:0 .4cqw 0 rgba(0,0,0,.45)}
  .frame.skin .card .stamp.denied{background:linear-gradient(180deg,#2a1a1a,#140c0c);color:#fff;border-color:#fff}
  .brandmark.ph{font-size:2.6cqw;font-weight:800;letter-spacing:.08em;color:rgba(255,255,255,.6);border:1px dashed rgba(255,255,255,.4);border-radius:1.5cqw;padding:0 2.5cqw}
  .card .logo img{height:100%;width:auto}.card .logo.art{border:0}
  `;

  const FX = { sm: -1, lv: -1, heat: -1 };
  const SFX = (() => {   // synthesised sound effects: no asset files; the AudioContext is created on the first user tap (autoplay rules)
    let ac = null, muted = false, lastBeat = -1;
    const ctx = () => { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } } if (ac && ac.state === 'suspended') ac.resume(); return ac; };
    function tone(f, t, dur, type, g, slide) { const a = ctx(); if (!a || muted) return; const o = a.createOscillator(), v = a.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur); v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g || .25, t + .005); v.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(v).connect(a.destination); o.start(t); o.stop(t + dur + .02); }
    function noise(t, dur, g, lp) { const a = ctx(); if (!a || muted) return; const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const src = a.createBufferSource(); src.buffer = b; const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 1200; const v = a.createGain(); v.gain.value = g || .3; src.connect(f).connect(v).connect(a.destination); src.start(t); }
    const now = () => (ctx() ? ac.currentTime : 0);
    return {
      unlock() { ctx(); }, get muted() { return muted; }, set muted(v) { muted = v; },
      tick() { tone(1500, now(), .04, 'square', .06); },
      hit() { const t = now(); noise(t, .09, .5, 900); tone(140, t, .14, 'sine', .5, -90); },
      miss() { tone(220, now(), .08, 'triangle', .15, -120); },
      ice() { const t = now(); tone(900, t, .35, 'sine', .25, -700); noise(t, .3, .25, 4000); },
      stage() { const t = now(); tone(660, t, .1, 'square', .12); tone(990, t + .11, .16, 'square', .12); },
      win() { const t = now(); [523, 659, 784, 1046].forEach((f, i) => tone(f, t + i * .11, .3, 'triangle', .2)); },
      fail() { const t = now(); tone(330, t, .25, 'sawtooth', .12, -120); tone(220, t + .22, .4, 'sawtooth', .12, -100); },
      beat(phase) { const b = Math.floor(phase); if (b !== lastBeat && phase >= 0) { lastBeat = b; this.tick(); } }, reset() { lastBeat = -1; },
    };
  })();
  function mount(VIEW) {
    if (CONFIG.brand) { const b = CONFIG.brand, st = document.createElement('style'); st.textContent = `.frame.skin{${b.red ? '--b1:' + b.red + ';' : ''}${b.accent ? '--b2:' + b.accent + ';' : ''}${b.font ? 'font-family:' + b.font + ',Inter,system-ui,sans-serif;' : ''}}`; document.head.appendChild(st); if (b.fontUrl) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = b.fontUrl; document.head.appendChild(l); } }    const LOGO = CONFIG.brand && CONFIG.brand.logo ? `<div class="logo art"><img src="${CONFIG.brand.logo}" alt=""></div>` : `<div class="logo">BRAND LOGO</div>`;
    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    document.body.innerHTML = `
    <div class="${VIEW.build ? 'frame skin loading' : 'frame'}" id="frame">
      ${VIEW.build ? `<div class="loader" id="loader" role="progressbar" aria-label="Loading"><img src="${(CONFIG.brand && (CONFIG.brand.logo || CONFIG.brand.logoOnArt)) || ''}" alt=""><div class="bar"><i id="loadBar"></i></div></div>` : ''}
      <canvas id="game"></canvas>
      <div class="hud">
        <div class="top"><span class="pill" id="count">12 to gepuk</span><span class="pill" id="timer">12.0</span></div>
        <div class="thermo" id="thermo"><div class="tghost" id="tghost"></div><div class="tfill" id="tfill" style="width:0%"><i class="thead"></i></div>${STAGES.map((n, i) => `<i class="ttick" style="left:${i * 25}%"></i>`).join('')}</div>
        <div class="hint" id="hint">${CONFIG.copy.hint}</div>
        ${CONFIG.brand && CONFIG.brand.logo ? `<div class="brandmark"><img src="${CONFIG.brand.logoOnArt || CONFIG.brand.logo}" alt=""></div>` : `<div class="brandmark ph">BRAND</div>`}
        ${VIEW.build ? '' : `<div class="greylabel">GREYBOX · ${VIEW.title.toUpperCase()}</div>`}
      </div>
      <div class="card start" id="startCard">${LOGO}
        <div class="mid"><div class="cap">${CONFIG.copy.tagline || ''}</div><h1>${CONFIG.copy.startTitle}</h1><p>${CONFIG.copy.startLine}</p></div>
        <div class="btns"><button class="btn" id="playBtn">${CONFIG.copy.play}</button></div></div>
      <div class="card sheet" id="winCard" hidden><div class="stamp big" id="stamp">BRAVE PASS</div><div class="corner">${LOGO}</div>
        <div class="mid"><h1>${CONFIG.copy.winTitle}</h1><p>${CONFIG.copy.winLine}</p><span id="stampSub" hidden></span></div>
        <div><div class="btns"><button class="btn" id="cta1">${CONFIG.copy.cta}</button></div><div class="row"><a class="link" id="share1">${CONFIG.copy.share}</a><span class="dot">&middot;</span><a class="link" id="again1">Play again</a></div></div></div>
      <div class="card sheet" id="failCard" hidden><div class="stamp big denied">DENIED<small id="failWhy"></small></div><div class="corner">${LOGO}</div>
        <div class="mid"><h1>${CONFIG.copy.failTitle}</h1><p>${CONFIG.copy.failLine}</p></div>
        <div><div class="btns"><button class="btn" id="cta2">${CONFIG.copy.cta}</button></div><div class="row"><a class="link" id="again2">Play again</a><span class="dot">&middot;</span><a class="link" id="share2">${CONFIG.copy.shareFail}</a></div></div></div>
    </div>`;
    const $ = id => document.getElementById(id);
    const canvas = $('game'), ctx = canvas.getContext('2d');
    let W = 640, H = 960, dpr = Math.min(2, devicePixelRatio || 1);
    const resize = () => { const r = $('frame').getBoundingClientRect(); W = r.width; H = r.height; canvas.width = W * dpr; canvas.height = H * dpr; };
    new ResizeObserver(resize).observe($('frame')); resize();

    function showCard(which) {
      if (which === 'win') { $('stampSub').textContent = `${stageName()} tempo · ${S.hits} hits`; $('winCard').hidden = false; }
      else { $('failWhy').textContent = CONFIG.copy.failWhy[S.why] || ''; $('failCard').hidden = false; }
      $('hint').style.display = 'none';
    }
    window.__showCard = showCard; window.__hideHud = on => $('frame').classList.toggle('revealing', !!on);
    const hideCards = () => { $('winCard').hidden = true; $('failCard').hidden = true; $('startCard').hidden = true; $('hint').style.display = ''; $('frame').classList.remove('revealing'); };
    const startRound = () => { hideCards(); SFX.unlock(); SFX.reset(); reset('play'); };
    window.DEMO = { start: () => { hideCards(); reset('attract'); $('startCard').hidden = false; }, slotMs: 20000, setAuto: () => {}, setSound: on => { SFX.muted = !on; } };   // the iion preview shell's contract
    $('playBtn').onclick = startRound; $('again1').onclick = startRound; $('again2').onclick = startRound;
    $('cta1').onclick = $('cta2').onclick = () => window.open(window.clickTag || CONFIG.ctaUrl, '_blank');
    // share card: code-drawn 1080×1350 image (the measure is a souvenir, never a stake)
    async function share(result) {
      const c = document.createElement('canvas'); c.width = 1080; c.height = 1350; const x = c.getContext('2d');
      x.fillStyle = result === 'win' ? '#b81e14' : '#2a2a2e'; x.fillRect(0, 0, 1080, 1350);
      x.strokeStyle = 'rgba(255,255,255,.5)'; x.lineWidth = 6; x.setLineDash([24, 18]); x.strokeRect(80, 120, 920, 160); x.setLineDash([]);
      x.fillStyle = '#fff'; x.font = '800 54px Inter, system-ui, sans-serif'; x.textAlign = 'center'; x.fillText('BRAND LOGO', 540, 220);
      x.save(); x.translate(540, 620); x.rotate(-0.12); x.strokeStyle = '#fff'; x.lineWidth = 18; x.strokeRect(-430, -120, 860, 240); x.font = '900 150px Inter, system-ui, sans-serif'; x.fillText(result === 'win' ? 'BRAVE PASS' : 'DENIED', 0, 55); x.restore();
      x.font = '700 48px Inter, system-ui, sans-serif'; x.fillText(result === 'win' ? `${stageName()} tempo · ${S.hits} hits` : (CONFIG.copy.failWhy[S.why] || CONFIG.copy.giveUpTaunt), 540, 860);
      x.font = '600 40px Inter, system-ui, sans-serif'; x.fillText(result === 'win' ? 'Only The Brave Dares To Try.' : "This one's for people who actually makan pedas.", 540, 1000);
      x.font = '600 34px Inter, system-ui, sans-serif'; x.fillStyle = 'rgba(255,255,255,.7)'; x.fillText('Marrybrown Ayam Gepuk · greybox', 540, 1260);
      const url = new URL((CONFIG.brand && CONFIG.brand.passUrl) || 'pass.html', location.href); url.searchParams.set('result', result); url.searchParams.set('level', stageName());   // the shared pass opens the landing page (preview: pass.html next to the build)
      const text = CONFIG.copy.shareText[result].replace('{level}', stageName()) + ' ' + url.href;
      const blob = await new Promise(r => c.toBlob(r, 'image/png')); const file = new File([blob], 'brave-pass.png', { type: 'image/png' });
      if (false && navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {   /* the share action opens the sharing hub (pass.html): result card, networks, story save, the KOL/KOC challenge hook; the in-game share sheet stays as the one-tap alternative if the client prefers it */ try { await navigator.share({ files: [file], text, url: url.href }); return; } catch (e) { /* cancelled */ } }
      window.open(url.href, '_blank', 'noopener');   // the sharing hub
    }
    $('share1').onclick = () => share('win'); $('share2').onclick = () => share('fail');

    $('frame').addEventListener('pointerdown', e => {
      try { const r = $('frame').getBoundingClientRect(); parent.postMessage({ iionTap: { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height } }, '*'); } catch (err) {}
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
      const left = Math.max(0, CONFIG.hitsToWin - S.hits); $('count').textContent = left === 0 ? 'GEPUK!' : `${left} to gepuk`; $('timer').textContent = S.timeLeft.toFixed(1);
      const hp = Math.round(S.heat * 1000) / 10;
      if (FX.heat < 0 || S.elapsed < 0.05) FX.heat = hp;
      else if (hp !== FX.heat) { const th = $('thermo'); th.classList.remove('up', 'down'); void th.offsetWidth; $('tghost').style.width = Math.max(hp, FX.heat) + '%'; th.classList.add(hp > FX.heat ? 'up' : 'down'); FX.heat = hp; }   // the change itself is shown: flash for gain, tail for loss
      $('tfill').style.width = hp + '%'; $('thermo').classList.toggle('cold', S.cold > 0);
      if (S.hits !== FX.sm) { FX.sm = S.hits; const c = $('count'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
      $('hint').textContent = S.glow === 2 ? CONFIG.copy.holdHint : S.glow === 1 ? CONFIG.copy.beatHint : (S.beat.phase < CONFIG.beatLeadIn ? CONFIG.copy.leadInHint : CONFIG.copy.hint); $('hint').classList.toggle('beat', S.glow === 1); $('hint').classList.toggle('cold', S.glow === 2);   // NOW on hot, HOLD on cold
      document.querySelectorAll('.lv').forEach((el, i) => el.classList.toggle('on', i <= S.level));
      const hint = $('hint'); const cueOn = S.cue && S.elapsed < S.cue.until; if (cueOn) { hint.textContent = S.cue.text; hint.classList.add('beat'); hint.classList.remove('cold'); }   // a first-appearance cue overrides the pill; otherwise the glow line above owns it
      hint.style.opacity = cueOn || (S.mode === 'play' && S.idle < CONFIG.idleToAttract) || S.beat.on || S.mode === 'attract' ? 1 : 0;
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  let showCard = w => window.__showCard && window.__showCard(w);
  let hideHud = on => window.__hideHud && window.__hideHud(on);

  window.Gepuk = {
    CONFIG, LEVELS, STAGES,
    run(VIEW) {
      if (SIM) runSim(); layerRoutes(VIEW);
      if (has('embed') || has('full')) document.documentElement.classList.add('embed');   // ?embed=1 in the shell's slot, ?full=1 on a real phone (shared/mobile.js): both the 2:3 letterbox
      mount(VIEW);
      if (VIEW.build && window.LAYERS) {   // gate: the loader stays until every layer, the meta and the brand marks have settled
        const SLOW = has('slow'); let expect = 1, done = 0, ready = false;
        const settle = () => { done++; const pct = Math.min(100, Math.round(done / expect * 100)); const b = document.getElementById('loadBar'); if (b) b.style.width = pct + '%'; if (done >= expect) reveal(); };
        const reveal = () => { if (ready) return; ready = true; setTimeout(() => { const l = document.getElementById('loader'); if (l) { l.classList.add('done'); setTimeout(() => { l.hidden = true; }, 500); } document.getElementById('frame').classList.remove('loading'); if (window.__onReady) window.__onReady(); }, 250); };
        const onSettle = () => settle();
        expect = 1 + VIEW.layers.filter(L => ['plate', 'sprite', 'sheet', 'viewmodel', 'mask-texture', 'particle', 'occluder'].includes(L.type)).length;   // meta + layers
        const marks = [CONFIG.brand && CONFIG.brand.logo, CONFIG.brand && CONFIG.brand.logoOnArt].filter(Boolean); expect += marks.length;
        marks.forEach(src => { const im = new Image(); im.onload = settle; im.onerror = settle; im.src = src; });
        setTimeout(() => window.LAYERS.load(VIEW.layers, 'assets/game/', onSettle), SLOW ? 1500 : 0);
        setTimeout(reveal, 10000);
      } else if (window.LAYERS) window.LAYERS.load(VIEW.layers, 'assets/game/');
      window.GAME = { get S() { return S; }, CONFIG, reset, tap };
      if (has('diag')) {   // QA: ?diag prints what the hairline depends on, inside the frame, on whatever machine shows it
        const box = document.createElement('pre'); box.style.cssText = 'position:fixed;left:0;top:30%;z-index:99;margin:0;padding:6px 8px;background:rgba(0,0,0,.8);color:#0f0;font:12px/1.4 monospace;white-space:pre;pointer-events:none';
        document.body.appendChild(box);
        const tick = () => { const f = $('frame').getBoundingClientRect(), b = document.querySelector('.card.start .logo'), bb = b ? b.getBoundingClientRect() : null;
          box.textContent = [`ua ${navigator.userAgent.replace(/^.*\) /, '').slice(0, 60)}`, `dpr ${devicePixelRatio}  view ${innerWidth}x${innerHeight}  ar ${(innerWidth / innerHeight).toFixed(4)}`,
            `frame t${f.top.toFixed(2)} l${f.left.toFixed(2)} ${f.width.toFixed(2)}x${f.height.toFixed(2)}`, bb ? `band t${bb.top.toFixed(2)} h${bb.height.toFixed(1)}` : 'band -',
            `fill-mq ${matchMedia('(min-aspect-ratio:131/200) and (max-aspect-ratio:17/25)').matches}  embed ${document.documentElement.classList.contains('embed')}`,
            `top row: ${(document.elementFromPoint(innerWidth / 2, 0) || {}).className || '-'}`, `v ${(document.scripts[0].src.split('?')[1] || '')}`].join('\n'); };
        tick(); setInterval(tick, 1000);
      }
      const qc = new URLSearchParams(location.search).get('card'); if (qc) setTimeout(() => { ['startCard', 'winCard', 'failCard'].forEach(i => { const el = document.getElementById(i); if (el) el.hidden = true; }); if (qc === 'fail') S.why = 'time'; S.hits = qc === 'win' ? CONFIG.hitsToWin : 5; showCard(qc); if (window.__hideHud) window.__hideHud(true); }, VIEW.build ? 1500 : 200);   // QA: ?card=win|fail opens the sheet for layout checks (?bot plays a real round for the full win reveal)
    },
    helpers: { clamp, rand, levelOf },
  };
})();
