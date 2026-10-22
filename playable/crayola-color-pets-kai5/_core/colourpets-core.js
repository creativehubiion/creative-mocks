/* Colour Me Christmas — shared game core for every greybox variant (rules, CONFIG, strings, state, input, HUD, cards, bots,
   sim, layer contract). A variant supplies a VIEW: its layers (shape + blueprint), its geometry (floor line, pet size, where
   things fall from) and drawFrame.
   Hooks: ?bot (autopilot plays a real round) · ?sim (instant rounds, ?n=) · ?sim&human (first-timer bot)
          ?attract (plays itself, used by the panel) · ?blueprint=Lx · ?explained=Lx · ?geometry · ?card=win|fail · ?lang=en|es-MX
   window.GAME = { S, CONFIG, reset, press, move, release }
   The rule: drag the white Color Pet left and right under the tree. Every ornament you catch splats its colour on the pet, a
   patch at a time; a soap bubble from the pet's own bath washes the last patch clean. Colour all twelve patches before the
   tree's lights go out. */
(function () {
  const Q = new URLSearchParams(location.search);
  const has = k => Q.has(k);
  // ── every word on screen lives here (owner 2026-10-22: English for review, es-MX before hosting) ──
  const STRINGS = {
    en: {   // the brand's own US English ("Color, Wash, Recolor" is the Scribble Scrubbie / Color Pets box line)
      brand: 'Crayola', eyebrow: 'Color Pets', hint: 'Drag to catch the colors', leadInHint: 'Get ready…',
      cueFirst: 'Catch it! Every color paints your pet', cueBubble: 'Bubbles wash it clean. Dodge them!', cueFast: 'Faster!',
      popCatch: 'SPLAT!', popWash: 'WASHED!', popMiss: '',
      ready: 'Ready', set: 'Set', go: 'Color!',
      chipCatch: 'Catch colors', chipDodge: 'Dodge bubbles',
      startTitle: 'Color Me Christmas', startLine: 'Drag the pet to catch the colors. Dodge the bubbles.', play: 'Play',
      winStamp: 'ALL DRESSED UP!', winTitle: 'Color, wash, recolor!', winLine: 'Color Pets. Creativity starts here.', cta: 'Shop the toys',
      failStamp: 'SQUEAKY CLEAN!', failLine: 'Wash it and color again?',
      failWhy: { time: 'Lights out! {n} to go.', washed: 'Washed clean!' },
      again: 'Play again', againFail: 'Wash & recolor', patches: 'spots', secs: 's',
      stat: 'Dressed in {t} s', statFail: '{c} of {n} colored',
      supplied: 'Color Pets · Crayola photo', patch: 'spot',
    },
    'es-MX': {   // Crayola Mexico's own words where they exist: "Pinta, baña y vuelve a pintar", "La creatividad comienza aquí", "Dónde comprar"
      brand: 'Crayola', eyebrow: 'Color Pets', hint: 'Arrastra para atrapar los colores', leadInHint: '¡Prepárate!',
      cueFirst: '¡Atrápala! Cada color pinta a tu mascota', cueBubble: 'Las burbujas lo lavan. ¡Esquívalas!', cueFast: '¡Más rápido!',
      popCatch: '¡SPLAT!', popWash: '¡LAVADO!', popMiss: '',
      ready: 'En sus marcas', set: 'Listos', go: '¡A pintar!',
      chipCatch: 'Atrapa colores', chipDodge: 'Esquiva burbujas',
      startTitle: 'Pinta mi Navidad', startLine: 'Arrastra a tu mascota para atrapar los colores. Esquiva las burbujas.', play: 'Jugar',
      winStamp: '¡DE GALA!', winTitle: '¡Pinta, baña y vuelve a pintar!', winLine: 'Color Pets. La creatividad comienza aquí.', cta: 'Dónde comprar',
      failStamp: '¡LIMPIECITO!', failLine: '¿Lo bañas y vuelves a pintar?',
      failWhy: { time: '¡Se apagaron las luces! Faltan {n}.', washed: '¡Quedó limpiecito!' },
      again: 'Jugar otra vez', againFail: 'Báñalo y vuelve a pintar', patches: 'manchas', patch: 'mancha', secs: 's',
      stat: 'Listo en {t} s', statFail: '{c} de {n} pintadas',
      supplied: 'Color Pets · foto de Crayola',
    },
  };
  const LANG = STRINGS[Q.get('lang')] ? Q.get('lang') : 'en';
  const CONFIG = {
    ctaUrl: 'https://www.crayola.com/es-mx/',   // placeholder until the client names the door; window.clickTag overrides
    lang: LANG,
    roundSecs: 23, patches: 12,                // colour twelve patches before the lights go out (living room, sims 2026-10-22 n=150: perfect 100%, first-timer 83%)
    leadIn: 0.9,                               // nothing falls before this (rule 16)
    // waves by elapsed time: [from s, seconds between drops, fall speed (frame heights / s), bubble share, sway (frame widths), tailed share]
    // a tailed ornament falls with a bubble just behind it: catch the colour, then slip out from under the suds (the skill, not the supply)
    waves: [[0, 0.95, 0.30, 0, 0, 0], [5, 0.80, 0.36, 0.22, 0.02, 0.3], [11, 0.68, 0.44, 0.26, 0.035, 0.45], [16, 0.58, 0.52, 0.3, 0.045, 0.55]],
    washPerBubble: 1,                          // a bubble washes this many patches
    petSpeed: 1.25,                             // frame widths / s the pet can move (follows the finger, capped)
    colours: ['#d62828', '#2a9d4b', '#e8b400'],   // red, green, gold: the game's ornament colours (not brand colours)
    idleToAttract: 3,
  };
  CONFIG.copy = STRINGS[LANG];
  if (Q.get('cfg')) try { Object.assign(CONFIG, JSON.parse(Q.get('cfg'))); } catch (e) { console.error('bad ?cfg', e); }   // tuning only: the sim harness tries CONFIG values without editing the file
  let VIEW_SOUND = false, MUSIC_URL = null, SAMPLE_URLS = {};   // set from VIEW.sound at run(): builds have sound, greyboxes do not
  const BOT = has('bot') || has('attract'), HUMAN = has('human'), SIM = has('sim'), ATTRACT = has('attract');
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  let G = null;   // the view's geometry
  const waveOf = t => { let w = 0; CONFIG.waves.forEach((v, i) => { if (t >= v[0]) w = i; }); return w; };

  let S;
  function reset(mode) {
    S = { mode, elapsed: 0, timeLeft: CONFIG.roundSecs, items: [], fx: [], pet: { x: 0.5, vx: 0, squash: 0, wash: 0 }, want: 0.5, down: false,
      coat: [], caught: 0, washed: 0, missed: 0, nextDrop: CONFIG.leadIn, wave: 0, why: null, reveal: 0, cue: null, seen: {}, nextId: 1,
      bot: {}, flash: 0, count: mode === 'play' && !SIM && !BOT ? 1.5 : 0, wonAt: null };
  }
  // ── the falling things ──────────────────────────────────
  function dropOne() {
    const w = CONFIG.waves[S.wave], sp = G.spawn;
    const bubble = S.elapsed > CONFIG.waves[1][0] && Math.random() < w[3];
    // a spawn point on the tree: inside its silhouette at that height (the view gives the half-width per height)
    const y = rand(sp.y0, sp.y1), half = G.treeHalf ? G.treeHalf(y) : sp.half; let x = clamp(G.treeX + rand(-half, half), G.edge, 1 - G.edge);
    // never two things on top of each other: keep away from the last drop
    const last = S.items[S.items.length - 1]; if (last && Math.abs(last.x0 - x) < 0.12 && last.y < y + 0.2) x = clamp(x + (x < 0.5 ? 0.2 : -0.2), G.edge, 1 - G.edge);
    S.items.push({ id: S.nextId++, kind: bubble ? 'bubble' : 'orn', c: bubble ? null : Math.floor(Math.random() * 3), x, x0: x, y, vy: w[2] * (bubble ? 0.82 : 1) * rand(0.92, 1.08),
      sway: w[4] * rand(0.6, 1.2), ph: rand(0, 6.283), born: S.elapsed, t: 0, rot: rand(-0.4, 0.4), state: 'fall' });
    const it = S.items[S.items.length - 1];
    if (!bubble && Math.random() < w[5]) {   // the tail: a bubble a little above and beside it, landing about 0.3 s later near the same spot
      const dx = rand(0.04, 0.09) * (Math.random() < .5 ? -1 : 1);
      S.items.push({ id: S.nextId++, kind: 'bubble', c: null, x: clamp(x + dx, G.edge, 1 - G.edge), x0: clamp(x + dx, G.edge, 1 - G.edge), y: y - 0.03, vy: it.vy * 0.86, sway: it.sway, ph: it.ph, born: S.elapsed, t: 0, rot: 0, state: 'fall', tail: true });
      if (!S.seen.bubble) { S.seen.bubble = true; S.cue = { text: CONFIG.copy.cueBubble, until: S.elapsed + 2.2 }; }
    }
    if (bubble && !S.seen.bubble) { S.seen.bubble = true; S.cue = { text: CONFIG.copy.cueBubble, until: S.elapsed + 2.2 }; }
  }
  // ── input: one control, the horizontal drag. press/move/release in frame fractions ──
  function press(p, src) { if (S.mode !== 'play' && S.mode !== 'attract') return; S.down = true; S.want = clamp(p.x, G.edge, 1 - G.edge); if (src === 'user') SFX.unlock(); }
  function move(p) { if (!S.down) return; S.want = clamp(p.x, G.edge, 1 - G.edge); }
  function release() { S.down = false; }
  function catchIt(it) {
    it.state = 'caught'; it.t = 0; S.pet.squash = 1;
    if (it.kind === 'orn') {
      S.caught++; if (S.coat.length < CONFIG.patches) { S.coat.push(it.c); S.coatT = S.elapsed; }
      S.fx.push({ k: 'splat', x: S.pet.x, y: G.floorY - G.petH * 0.55, c: CONFIG.colours[it.c], t: 0 }); S.fx.push({ k: 'word', txt: CONFIG.copy.popCatch, c: CONFIG.colours[it.c], t: 0 });
      if (!SIM) SFX.splat(S.coat.length);
      if (S.coat.length >= CONFIG.patches) finish('win');
    } else {
      S.washed++; const n = Math.min(CONFIG.washPerBubble, S.coat.length); for (let i = 0; i < n; i++) S.coat.pop();
      S.pet.wash = 1; S.flash = 1; S.fx.push({ k: 'suds', x: S.pet.x, y: G.floorY - G.petH * 0.5, t: 0 }); S.fx.push({ k: 'word', txt: CONFIG.copy.popWash, c: '#5aa9e6', t: 0, bad: true });
      if (!SIM) SFX.wash();
    }
  }
  function finish(result, why) {
    if (S.mode === 'attract') { reset('attract'); return; }   // the splash loop keeps colouring behind the start card
    S.mode = result === 'win' ? 'reveal' : 'fail'; S.why = why || null; S.reveal = 0; S.down = false; S.wonAt = S.elapsed; S.items = [];
    if (!SIM) SFX.duck(true);   // the bed ducks under the result
    if (result === 'win') S.confetti = Array.from({ length: 90 }, (_, k) => ({ x: .5 + rand(-.08, .08), y: .45, vx: rand(-.6, .6), vy: rand(-1.5, -.6), r: rand(0, 6.28), vr: rand(-8, 8), c: k % 6, w: rand(.012, .022), t: rand(0, .3) }));
    if (!SIM) { if (result === 'win') { SFX.win(); hideHud(true); setTimeout(() => showCard('win'), 2000); } else { SFX.fail(); hideHud(true); setTimeout(() => showCard('fail'), 900); } }
  }
  function update(dt) {
    if (S.confetti) S.confetti.forEach(c => { if ((c.t -= dt) > 0) return; c.vy += 1.4 * dt; c.vx *= .99; c.x += c.vx * dt * .5; c.y += c.vy * dt * .5; c.r += c.vr * dt; });
    if (S.mode === 'reveal' || S.mode === 'win' || S.mode === 'fail') { S.reveal += dt; if (S.mode === 'reveal' && S.reveal > 2.0) S.mode = 'win'; }   // the pet walks up to centre stage on either ending
    if (S.count > 0) { const before = S.count; S.count = Math.max(0, S.count - dt); if (!SIM && Math.ceil(before / 0.5) !== Math.ceil(S.count / 0.5)) { SFX.beep(S.count <= 0); if (S.count <= 0) SFX.duck(false); } }
    const playing = (S.mode === 'play' || S.mode === 'attract') && S.count <= 0;
    // the pet follows the finger at a capped speed (a toy on the floor, not a cursor)
    const p = S.pet, d = S.want - p.x, step = Math.min(Math.abs(d), CONFIG.petSpeed * dt) * Math.sign(d);
    p.vx = step / Math.max(dt, 1e-4); p.x += step; p.squash = Math.max(0, p.squash - dt * 4); p.wash = Math.max(0, p.wash - dt * 1.6);
    if (playing) {
      S.elapsed += dt; S.timeLeft = Math.max(0, CONFIG.roundSecs - S.elapsed);
      const wv = waveOf(S.elapsed); if (wv !== S.wave) { S.wave = wv; if (wv >= 2 && !S.seen['w' + wv]) { S.seen['w' + wv] = true; S.cue = { text: CONFIG.copy.cueFast, until: S.elapsed + 1.0 }; } }
      if (S.elapsed >= S.nextDrop && S.timeLeft > 0.6) { dropOne(); S.nextDrop = S.elapsed + CONFIG.waves[S.wave][1] * rand(0.85, 1.15); }
      if (!S.seen.cue && S.items.length) { S.seen.cue = true; S.cue = { text: CONFIG.copy.cueFirst, until: S.elapsed + 1.8 }; }
      const catchY = G.floorY - G.petH * 0.62;
      S.items.forEach(it => {
        it.t += dt; if (it.state !== 'fall') return;
        const prevY = it.y; it.y += it.vy * dt; it.x = clamp(it.x0 + Math.sin(it.t * 2.4 + it.ph) * it.sway, G.edge * 0.6, 1 - G.edge * 0.6);
        if (prevY < catchY && it.y >= catchY && Math.abs(it.x - p.x) < G.catchHalf) catchIt(it);
        else if (it.y >= G.floorY) { it.state = 'landed'; it.t = 0; if (it.kind === 'orn') { S.missed++; S.fx.push({ k: 'floor', x: it.x, y: G.floorY, c: CONFIG.colours[it.c], t: 0 }); } else S.fx.push({ k: 'pop', x: it.x, y: G.floorY, t: 0 }); }   // a missed bubble pops silently: the bubble sound means only "it hit the pet" (owner 00:14: a sound for a miss was confusing)
      });
      if (S.mode === 'play' || S.mode === 'attract') { if (S.timeLeft <= 0) return finish('fail', 'time'); }
    }
    S.items = S.items.filter(it => it.state === 'fall' || it.t < 0.5);
    S.fx.forEach(f => f.t += dt); S.fx = S.fx.filter(f => f.t < (f.k === 'floor' ? 2.4 : f.k === 'word' ? 0.8 : 0.7));
    S.flash = Math.max(0, S.flash - dt * 3);
  }

  // ── autopilot ───────────────────────────────────────────
  // perfect bot: for every falling thing it knows where and when it lands; it heads for the earliest ornament it can still reach and
  // steps aside from a bubble that would land on it. First-timer bot: notices a drop 0.3-0.55 s after it leaves the tree, aims with an
  // error that shrinks after the first catches, moves at 75% of the pet's speed, one bubble in four it does not see at all, fumbles the
  // first 0.5-0.9 s of the round, and after every catch stays put for 0.15-0.35 s (watching the splat) before it reacts again.
  function landing(it) { const catchY = G.floorY - G.petH * 0.62; const tl = Math.max(0, (catchY - it.y) / it.vy); const tt = it.t + tl; return { t: tl, x: clamp(it.x0 + Math.sin(tt * 2.4 + it.ph) * it.sway, G.edge * 0.6, 1 - G.edge * 0.6) }; }
  function autopilot(dt) {
    const B = S.bot; S.down = true; const p = S.pet;
    if (HUMAN) { B.fumble ??= rand(0.5, 0.9); if (S.elapsed < B.fumble) return; if (S.caught !== B.seenCaught) { B.seenCaught = S.caught; B.hold = S.elapsed + rand(0.15, 0.35); } if (S.elapsed < B.hold) return; }
    const speed = CONFIG.petSpeed * (HUMAN ? 0.75 : 1);
    const seen = S.items.filter(it => it.state === 'fall' && (!HUMAN || S.elapsed - it.born > (it.react == null ? (it.react = rand(0.3, 0.55)) : it.react)) && !(HUMAN && it.kind === 'bubble' && (it.blind ??= Math.random() < 0.25)));
    const L = seen.map(it => ({ it, ...landing(it) }));
    const bubbles = L.filter(l => l.it.kind === 'bubble');
    const hitBy = (x, tFrom, tTo) => bubbles.some(b => b.t >= tFrom - 0.05 && b.t <= tTo + 0.05 && Math.abs(b.x - x) < G.catchHalf * 1.15);
    let target = null;
    if (HUMAN && B.err == null) B.err = 0;
    const orns = L.filter(l => l.it.kind === 'orn' && Math.abs(l.x - p.x) - G.catchHalf * 0.6 <= speed * l.t).sort((a, b) => a.t - b.t);
    for (const o of orns) { if (!hitBy(o.x, o.t - 0.12, o.t)) { target = o; break; } }
    let want = target ? target.x : p.x;
    if (HUMAN && target) { if (B.tid !== target.it.id) { B.tid = target.it.id; B.err = rand(-1, 1) * G.catchHalf * (S.caught < 2 ? 1.1 : 0.75); } want += B.err; }
    // dodge: a bubble landing on where we stand (or are about to be) in the next half second
    const soon = bubbles.filter(b => b.t < 0.5 && Math.abs(b.x - p.x) < G.catchHalf * 1.2 && !(target && b.t > target.t + 0.03));   // a bubble landing after the ornament we are under waits: catch first, then step away
    if (soon.length) { const b = soon[0]; const away = p.x < b.x ? -1 : 1; const alt = b.x + away * G.catchHalf * 1.6; want = (alt < G.edge || alt > 1 - G.edge) ? b.x - away * G.catchHalf * 1.6 : alt; }
    // commit (owner 23:50: the bot "spazzes" the pet left and right): a new target is taken only when it differs by more than a dead zone,
    // and a non-urgent change waits until the last one has held 0.25 s; a dodge (a bubble about to land) always goes through at once
    want = clamp(want, G.edge, 1 - G.edge); const urgent = soon.length > 0;
    if (B.cw == null || urgent || (Math.abs(want - B.cw) > G.catchHalf * .35 && S.elapsed - (B.ct || 0) > .25)) { if (B.cw == null || Math.abs(want - B.cw) > .01) B.ct = S.elapsed; B.cw = want; }
    S.want = Math.abs(B.cw - p.x) < .012 ? p.x : B.cw;
  }
  // ── sim ─────────────────────────────────────────────────
  function runSim() {
    const out = [], N = +(Q.get('n') || 20);
    for (let r = 0; r < N; r++) {
      reset('play'); let n = 0;
      while (S.mode === 'play') { autopilot(1 / 60); update(1 / 60); if (++n > 60 * 40) break; }
      out.push(`${S.mode === 'reveal' || S.mode === 'win' ? 'win ' : 'fail'} t=${S.elapsed.toFixed(1)} coat=${S.coat.length} caught=${S.caught} washed=${S.washed} missed=${S.missed} why=${S.why || '-'}`);
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
      const g = { ...VIEW.geometry() }; delete g.treeHalf;
      document.body.innerHTML = `<pre id="geometry">${JSON.stringify({ variant: VIEW.id, canvas: VIEW.canvas, format: 'playable', key: '#4A5A7A', camera: VIEW.camera || null, geometry: g, layers: VIEW.layers.map(l => ({ id: l.id, name: l.name, type: l.type, canvas: l.canvas, key: l.key, box: l.box || null, cells: l.cells || null, states: l.states || false, source: l.source || 'gemini', camera: l.camera || null, notes: l.notes })) }, null, 2)}</pre>`;
      document.title = 'GEOMETRY'; throw new Error('geometry printed');
    }
  }
  // ── DOM: HUD, cards (owner 23:47: "the UI is a little underwhelming; not premium or playable"). Crayola's essence (the dark-green bar with
  //    the yellow rule, the oval logo, green Omnes-style display type, the crayon scribble, Crayola's card colours) built as a mobile GAME UI:
  //    chunky glossy buttons with a bevel, inner highlight, shine sweep and pressed state; a game-title lockup in crayon colours with an
  //    outline and an extruded shadow; a paint meter with the toy's own face as its badge; speech-bubble hints; a ribbon banner, stars and
  //    confetti on the win; floating panels instead of a web sheet. Nothing here is a web pattern. ──
  const CSS = `
  html,body{margin:0;height:100%;background:#000;font-family:'Open Sans',system-ui,sans-serif;-webkit-user-select:none;user-select:none}
  .frame{--cg-dark:#00502E;--cg-deep:#003a20;--cg:#00892D;--cy:#FFCC33;--cblue:#0078C2;--corange:#C25400;--cpurple:#592E87;--ink:#16241c;
    --display:Nunito,Omnes,'Arial Rounded MT Bold',sans-serif;position:relative;width:min(100vw,calc(100dvh*2/3));aspect-ratio:2/3;margin:0 auto;overflow:hidden;background:#3a3440;container-type:inline-size;touch-action:none}
  canvas#game{position:absolute;inset:0;width:100%;height:100%;display:block}
  .hud{position:absolute;inset:0;pointer-events:none;color:var(--ink)}
  .bar{position:absolute;left:0;right:0;top:0;height:11cqw;background:linear-gradient(#0d6e40,#00502E 70%);box-shadow:inset 0 -.4cqw 0 rgba(255,255,255,.1),0 1.6cqw 1.6cqw rgba(0,0,0,.25)}
  .fuse{position:absolute;left:0;right:0;top:11cqw;height:1.3cqw;background:#2c3d31}
  .fuse i{position:absolute;left:0;top:0;bottom:0;width:100%;background:linear-gradient(#ffe27a,var(--cy) 60%,#e0a800);transform-origin:left;will-change:transform}
  .fuse b{position:absolute;top:50%;width:4cqw;height:4cqw;margin:-2cqw 0 0 -2cqw;border-radius:50%;background:radial-gradient(#fff 0 20%,#ffd23a 38%,rgba(255,150,40,0) 70%);will-change:transform;animation:spark .18s steps(2) infinite}
  @keyframes spark{50%{transform:scale(1.25)}}
  .fuse.low i{background:#ff3b2f;animation:fusePulse .25s steps(2) infinite}.fuse.low b{background:radial-gradient(#fff 0 20%,#ff6a3a 38%,rgba(255,60,40,0) 70%)}
  @keyframes fusePulse{50%{opacity:.55}}
  .logo-s{position:absolute;left:2.6cqw;top:1.2cqw;width:23cqw;filter:drop-shadow(0 .6cqw .6cqw rgba(0,0,0,.35))}
  .logo-s img{width:100%;display:block}
  /* the paint meter: the toy's own face as its badge, twelve glossy paint cells that fill with the colours caught */
  .meter{position:absolute;right:2.2cqw;top:1.2cqw;display:flex;align-items:center}
  .badge{position:relative;z-index:2;width:9.4cqw;height:9.4cqw;margin-right:-2.6cqw;border-radius:50%;background:var(--petface) center/cover no-repeat,radial-gradient(circle at 40% 30%,#4fb3f0,#0078C2 60%,#005a93);   /* the white toy on Crayola blue: on white it merged into the disc (owner 23:56) */border:.6cqw solid var(--cy);box-shadow:0 .7cqw 0 var(--cg-deep),0 0 0 .4cqw var(--cg-deep)}
  .badge.bump{animation:bump .35s cubic-bezier(.2,1.6,.4,1)}@keyframes bump{40%{transform:scale(1.25) rotate(-8deg)}}
  .track{display:flex;gap:.5cqw;padding:1.1cqw 1.4cqw 1.1cqw 3.6cqw;background:var(--cg-deep);border-radius:99px;box-shadow:inset 0 .6cqw 0 rgba(0,0,0,.4),0 0 0 .45cqw rgba(255,255,255,.22)}
  .track{gap:.2cqw!important}.track i{display:block;width:4cqw;height:4.8cqw;background:var(--xm-orn) 0 60%/300% auto no-repeat;filter:grayscale(1) brightness(.4);opacity:.75}
  .track i.on{filter:drop-shadow(0 0 .9cqw rgba(255,240,180,.75));opacity:1}
  .track i.new{animation:cell .4s cubic-bezier(.2,1.7,.4,1)}@keyframes cell{0%{transform:scale(.3)}50%{transform:scale(1.45)}}
  .track i.gone{animation:gone .35s ease-out}@keyframes gone{0%{transform:scale(1.4);filter:brightness(2) hue-rotate(160deg)}}
  /* hints: a speech bubble with a tail, pointing down at the pet */
  .hint{position:absolute;left:50%;top:33cqw;transform:translateX(-50%);font:900 4.2cqw var(--display);background:#fff;color:var(--cg-dark);border:.55cqw solid var(--cg-dark);border-radius:4cqw;padding:1.8cqw 4.4cqw;white-space:nowrap;box-shadow:0 .9cqw 0 var(--cg-dark);transition:opacity .25s}
  .hint::after{content:'';position:absolute;left:50%;bottom:-2.6cqw;width:3.4cqw;height:3.4cqw;margin-left:-1.7cqw;background:inherit;border:inherit;border-width:0 .55cqw .55cqw 0;transform:rotate(45deg)}
  .hint.cue{background:var(--cy);animation:nudge .45s ease-in-out infinite alternate}@keyframes nudge{to{transform:translateX(-50%) scale(1.06)}}
  .count{position:absolute;left:0;right:0;margin:auto;width:max-content;max-width:none;top:34%;text-align:center;font:900 19cqw var(--display);color:#fff;-webkit-text-stroke:1.6cqw var(--cg-dark);paint-order:stroke fill;text-shadow:0 1.6cqw 0 var(--cg-deep);opacity:0}
  .count.on{animation:pop .5s cubic-bezier(.2,1.5,.4,1) both}@keyframes pop{0%{transform:scale(1.9) rotate(-6deg);opacity:0}30%{opacity:1}100%{transform:scale(1) rotate(0);opacity:1}}
  .card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;text-align:center}
  .card[hidden]{display:none}
  .frame.carded .hud{display:none}
  .card .topbar{position:absolute;left:0;right:0;top:0;height:11cqw;background:linear-gradient(#0d6e40,#00502E 70%);box-shadow:0 .9cqw 0 var(--cy),0 2cqw 2cqw rgba(0,0,0,.25)}
  .card .logo{position:absolute;left:50%;top:1.4cqw;width:30cqw;transform:translateX(-50%);filter:drop-shadow(0 .8cqw .8cqw rgba(0,0,0,.3));z-index:2}
  .card .logo img{width:100%;display:block}
  /* game buttons: glossy, bevelled, outlined, a shine that sweeps across, pressed when touched */
  .btn{position:relative;overflow:hidden;font:900 6.2cqw/1 var(--display);color:var(--cy);letter-spacing:.01em;padding:3.4cqw 13cqw 3.8cqw;border-radius:99px;border:.7cqw solid var(--cg-deep);cursor:pointer;
    background:linear-gradient(#22b062,#008a45 50%,#00663a);text-shadow:0 .55cqw 0 var(--cg-deep);
    box-shadow:inset 0 .9cqw 0 rgba(255,255,255,.4),inset 0 -1.1cqw 0 rgba(0,0,0,.22),0 1.4cqw 0 var(--cg-deep),0 2.8cqw 3.4cqw rgba(0,0,0,.38);animation:breathe 2.2s ease-in-out 1s infinite}
  .btn::after{content:'';position:absolute;top:-20%;bottom:-20%;left:-40%;width:28%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-20deg);animation:shine 2.8s ease-in-out 1.2s infinite}
  @keyframes shine{0%,60%{left:-40%}100%{left:130%}}
  .btn:active{transform:translateY(1.2cqw);box-shadow:inset 0 .9cqw 0 rgba(255,255,255,.4),inset 0 -1.1cqw 0 rgba(0,0,0,.22),0 .2cqw 0 var(--cg-deep),0 1cqw 2cqw rgba(0,0,0,.3)}
  .btn.ghost{font-size:4.2cqw;color:var(--cg-dark);padding:2.2cqw 8cqw 2.5cqw;margin-top:3.6cqw;border-width:.55cqw;background:linear-gradient(#fff,#e6efe8);text-shadow:none;animation:none;
    box-shadow:inset 0 .6cqw 0 #fff,inset 0 -.8cqw 0 rgba(0,80,46,.12),0 1cqw 0 var(--cg-dark),0 2cqw 2.4cqw rgba(0,0,0,.25)}
  .btn.ghost::after{display:none}
  @keyframes breathe{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
  /* start: the game title in crayon colours over the live scene, the rule as two picture chips, the big button; the pet uncovered */
  .card.start{justify-content:flex-start}
  .card.start::before{content:'';position:absolute;inset:0;background:radial-gradient(120% 60% at 50% 22%,rgba(0,40,20,.55),rgba(0,40,20,0) 70%)}
  .title{position:relative;margin-top:25cqw}
  .tag{display:inline-block;font:900 3.4cqw var(--display);letter-spacing:.1em;text-transform:uppercase;color:var(--cg-dark);background:var(--cy);border:.5cqw solid var(--cg-dark);border-radius:99px;padding:1cqw 3.6cqw;box-shadow:0 .7cqw 0 var(--cg-dark);transform:rotate(-3deg)}
  .lockup{margin:1cqw 0 0;font:900 19cqw/.92 var(--display);letter-spacing:-.01em}
  .lockup span{display:inline-block;color:var(--c);-webkit-text-stroke:1.7cqw #fff;paint-order:stroke fill;filter:drop-shadow(0 1.3cqw 0 var(--cg-dark));animation:bob 2.4s ease-in-out infinite;animation-delay:var(--d)}
  @keyframes bob{0%,100%{transform:translateY(0) rotate(var(--r))}50%{transform:translateY(-1.2cqw) rotate(calc(var(--r) * -1))}}
  .lockup2{margin:0;font:900 10.6cqw/1 var(--display);color:#fff;-webkit-text-stroke:1.3cqw var(--cg-dark);paint-order:stroke fill;filter:drop-shadow(0 1.1cqw 0 var(--cg-deep));letter-spacing:.02em}
  .how{position:relative;display:flex;gap:2.4cqw;justify-content:center;margin-top:3cqw}
  .chip{display:inline-flex;align-items:center;gap:1.6cqw;font:900 3.7cqw var(--display);color:var(--cg-dark);background:#fff;border:.5cqw solid var(--cg-dark);border-radius:99px;padding:1cqw 3.2cqw 1cqw 1.2cqw;box-shadow:0 .8cqw 0 var(--cg-dark)}
  .chip i{position:relative;width:6.4cqw;height:6.4cqw;border-radius:50%}
  .chip i.orn{background:radial-gradient(circle at 35% 30%,#fff 0 12%,#ff6b5e 22%,#d62828 60%,#8f1414)}
  .chip i.bub{background:radial-gradient(circle at 35% 30%,#fff 0 14%,rgba(220,242,255,.9) 26%,rgba(160,210,240,.55) 70%,#7fb8e0);box-shadow:inset 0 0 0 .35cqw #8fc3ea}
  .chip i::after{position:absolute;right:-1.2cqw;bottom:-1.2cqw;width:3.6cqw;height:3.6cqw;border-radius:50%;font:900 2.6cqw/3.6cqw var(--display);color:#fff;text-align:center;border:.35cqw solid #fff}
  .chip i.orn::after{content:'✓';background:var(--cg)}.chip i.bub::after{content:'✕';background:#e0362c}
  .card.start .btn{margin-top:4cqw}
  .card .drag{width:22cqw;height:9cqw;animation:drag 1.6s ease-in-out infinite}
  .card.start .drag{position:absolute;margin:0 0 0 -11cqw;filter:drop-shadow(0 .5cqw 0 rgba(255,255,255,.9))}
  @keyframes drag{0%,100%{transform:translateX(-35%)}50%{transform:translateX(35%)}}
  /* the end: a ribbon banner over the pet, a floating game panel with the result, stars as the souvenir */
  .card.end{justify-content:flex-end;padding:0 4cqw 4.4cqw;box-sizing:border-box}
  /* the ribbon banner (owner 23:58: the flat clip-path ends "feel low-effort"): a band in front with a gradient body, a light top edge, a dark
     bottom edge and a stitched seam; two tails behind it, lower, with a notched cut, their own darker gradient and a dark fold where each one
     tucks under the band. The tails are fixed-shape SVG; only the band stretches with the words, so nothing distorts in a longer language. */
  .card .stamp{position:absolute;top:24cqw;left:0;right:0;margin:auto;width:max-content;z-index:1;display:flex;align-items:flex-start;transform:rotate(-3deg);animation:stamp .45s cubic-bezier(.2,1.5,.3,1) both;filter:drop-shadow(0 1.4cqw 1.2cqw rgba(0,0,0,.35));
    --rb-hi:#f6a04e;--rb:#d86410;--rb-lo:#a84400;--rb-tail:#b34a00;--rb-tail-lo:#7a3000;--rb-fold:#4f1f00}
  .card .stamp.bad{--rb-hi:#5db8f2;--rb:#0e86d4;--rb-lo:#005a93;--rb-tail:#0a6aa8;--rb-tail-lo:#004a78;--rb-fold:#002c48}
  .stamp .band{position:relative;z-index:2;font:900 7.2cqw/1 var(--display);letter-spacing:.02em;color:#fff;padding:2.9cqw 5.4cqw 3.1cqw;white-space:nowrap;
    background:linear-gradient(var(--rb-hi),var(--rb) 45%,var(--rb-lo));box-shadow:inset 0 .7cqw 0 rgba(255,255,255,.4),inset 0 -.9cqw 0 rgba(0,0,0,.22);
    text-shadow:0 .5cqw 0 rgba(0,0,0,.28),0 0 .2cqw rgba(0,0,0,.3)}
  .stamp .band::before{content:'';position:absolute;left:0;right:0;top:1cqw;bottom:1cqw;border-top:.35cqw dashed rgba(255,255,255,.5);border-bottom:.35cqw dashed rgba(255,255,255,.32);pointer-events:none}
  .stamp .tail{position:relative;z-index:1;width:9.5cqw;height:calc(7.2cqw + 6cqw);margin-top:2.6cqw;flex:none}
  .stamp .tail.l{margin-right:-2.8cqw}.stamp .tail.r{margin-left:-2.8cqw;transform:scaleX(-1)}
  .stamp .tail svg{display:block;width:100%;height:100%;overflow:visible}
  @keyframes stamp{0%{transform:rotate(-3deg) scale(2);opacity:0}100%{transform:rotate(-3deg) scale(1);opacity:1}}
  .panel{position:relative;width:100%;box-sizing:border-box;background:linear-gradient(#fff,#f1f6f0);border:.8cqw solid var(--cg-dark);border-radius:6cqw;padding:7cqw 5cqw 4.4cqw;display:flex;flex-direction:column;align-items:center;
    box-shadow:inset 0 -1cqw 0 rgba(0,80,46,.08),0 1.6cqw 0 var(--cg-deep),0 3cqw 5cqw rgba(0,0,0,.45);animation:panelIn .5s cubic-bezier(.2,1.3,.4,1) both}
  @keyframes panelIn{0%{transform:translateY(40%);opacity:0}100%{transform:none;opacity:1}}
  .panel.nostars{padding-top:6cqw}
  .stars{position:absolute;top:-7.4cqw;left:50%;transform:translateX(-50%);display:flex;gap:1cqw;align-items:flex-end}
  .stars i{display:block;width:12cqw;height:12cqw;background:var(--xm-star) center/contain no-repeat;filter:drop-shadow(0 .8cqw .4cqw rgba(0,40,20,.45));animation:star .5s cubic-bezier(.2,1.6,.4,1) both}
  .stars i:nth-child(2){width:15cqw;height:15cqw;animation-delay:.18s}.stars i:nth-child(3){animation-delay:.36s}.stars i:nth-child(1){animation-delay:0s}
  .stars i.off{filter:grayscale(1) brightness(1.25) opacity(.55)}
  @keyframes star{0%{transform:scale(0) rotate(-40deg)}100%{transform:scale(1) rotate(0)}}
  .panel h1{font:900 7.2cqw/1.05 var(--display);margin:0;color:var(--cg)}
  .panel p{font:700 3.9cqw/1.4 'Open Sans',sans-serif;margin:1.8cqw 0 0;color:#36463d}
  .panel .stat{display:inline-flex;align-items:center;gap:1.4cqw;margin-top:2.4cqw;font:900 3.8cqw var(--display);color:var(--cg-dark);background:#e3f2e7;border:.4cqw solid #bfe0c8;border-radius:99px;padding:1.2cqw 4cqw}
  .panel .btn{margin-top:3.6cqw}.panel .btn.ghost{margin-top:3cqw}
  /* the Christmas pass: Mexico's papel picado under the header (start and end only, never over the catch), a poinsettia on the tag, holly
     and a poinsettia on the panel corners, gold-star pictures for the stars, real baubles as the meter's cells (all Gemini pictures) */
  .card .papel{position:absolute;left:0;right:0;top:11.4cqw;height:12.5cqw;background:var(--xm-papel) 50% 0/auto 100% repeat-x;transform-origin:50% 0;animation:sway 3.4s ease-in-out infinite;filter:drop-shadow(0 .8cqw .6cqw rgba(0,0,0,.25))}
  @keyframes sway{0%,100%{transform:rotate(-.6deg)}50%{transform:rotate(.6deg)}}
  .tag{position:relative}.tag::before{content:'';position:absolute;left:-8.2cqw;top:50%;width:10cqw;height:10cqw;margin-top:-5cqw;background:var(--xm-poin) center/contain no-repeat;transform:rotate(-12deg);filter:drop-shadow(0 .6cqw .4cqw rgba(0,0,0,.3))}
  .panel::before{content:'';position:absolute;left:-4cqw;top:-6cqw;width:19cqw;height:11cqw;background:var(--xm-holly) center/contain no-repeat;transform:rotate(-14deg);filter:drop-shadow(0 .8cqw .6cqw rgba(0,0,0,.3));z-index:3}
  .panel::after{content:'';position:absolute;right:-3.4cqw;top:-5cqw;width:14cqw;height:14cqw;background:var(--xm-poin) center/contain no-repeat;transform:rotate(10deg);filter:drop-shadow(0 .8cqw .6cqw rgba(0,0,0,.3));z-index:3}
  .greylabel{position:absolute;right:2cqw;bottom:2cqw;font:800 2.4cqw var(--display);color:rgba(255,255,255,.6);letter-spacing:.08em}
  .frame.revealing .hud{opacity:0;transition:opacity .3s}
  html.embed,html.embed body{background:#000;overflow:hidden;height:100%}html.embed body{display:flex;align-items:center;justify-content:center}html.embed .frame{width:min(100vw,calc(100vh * 2 / 3));height:min(100vh,calc(100vw * 3 / 2));aspect-ratio:auto;margin:0}
  @media (min-aspect-ratio:131/200) and (max-aspect-ratio:17/25){html.embed .frame{width:100vw;height:100vh}}
  `;
  // the crayon-scribble border (the site's own motif), loose crayon strokes in the brand's colours
  const SCRIBBLE = `<svg class="scribble" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true"><defs><filter id="crayon"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="1.6"/></filter></defs><g filter="url(#crayon)" fill="none" stroke-linecap="round" stroke-width="2.2">
    <path d="M-2 7 C10 1 16 12 28 5 S48 1 60 7 S84 11 96 4 S120 1 132 8 S158 11 170 4 S192 2 204 7" stroke="#C25400"/>
    <path d="M-2 4 C14 10 22 0 36 6 S58 11 70 4 S94 0 108 7 S130 11 144 3 S170 1 184 8 S198 9 204 5" stroke="#0078C2"/>
    <path d="M-2 9 C8 5 18 4 26 9 S44 12 54 6 S78 2 88 9 S112 11 122 5 S146 2 156 9 S180 11 204 6" stroke="#FFCC33"/>
    <path d="M6 3 c4 -3 8 4 3 5 s-6 -4 -1 -6 M74 8 c4 -3 8 4 3 5 s-6 -4 -1 -6 M150 4 c4 -3 8 4 3 5 s-6 -4 -1 -6" stroke="#592E87"/>
    <path d="M30 2 L44 9 M112 2 L126 9 M176 3 L190 10" stroke="#00892D"/></g></svg>`;
  // ── sound, the way our games do it (rule 32; owner 23:47: "balance the sounds in a web-safe way, as our games usually follow"):
  //    every source goes sfx/music bus → master → limiter → speakers, so nothing clips on any device and nothing jumps out; the files are
  //    loudness-normalised at the sound stage (effects ~-18 LUFS, music -26 LUFS) and the music bus sits a further 8 dB under the effects;
  //    silent until the player's own tap; a cue never stacks more than 3 deep; repeats vary pitch by a few percent. ──
  const SFX = (() => {
    let ac = null, muted = false, armed = false, master, limiter, sfxBus, musicBus;
    const MUSIC_LEVEL = .4, DUCK = .15;
    const ctx = () => {
      if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; }
        if (ac) { limiter = ac.createDynamicsCompressor(); limiter.threshold.value = -6; limiter.knee.value = 4; limiter.ratio.value = 12; limiter.attack.value = .003; limiter.release.value = .15;
          master = ac.createGain(); master.gain.value = muted ? 0 : .85; sfxBus = ac.createGain(); sfxBus.gain.value = 1; musicBus = ac.createGain(); musicBus.gain.value = 0;
          sfxBus.connect(master); musicBus.connect(master); master.connect(limiter); limiter.connect(ac.destination); } }
      if (ac && ac.state === 'suspended') ac.resume(); return ac; };
    function tone(f, t, dur, type, g, slide) { if (!armed) return; const a = ctx(); if (!a) return; const o = a.createOscillator(), v = a.createGain(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), t + dur); v.gain.setValueAtTime(0, t); v.gain.linearRampToValueAtTime(g || .2, t + .005); v.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(v).connect(sfxBus); o.start(t); o.stop(t + dur + .02); }
    function noise(t, dur, g, lp) { if (!armed) return; const a = ctx(); if (!a) return; const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const src = a.createBufferSource(); src.buffer = b; const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp || 1200; const v = a.createGain(); v.gain.value = g || .3; src.connect(f).connect(v).connect(sfxBus); src.start(t); }
    const now = () => (armed && ctx() ? ac.currentTime : 0);
    const scale = [523, 587, 659, 698, 784, 880, 988, 1046];
    // supplied effects (owner 23:42 splat, 23:44 bubble), decoded on the first tap; the synth plays until a sample has loaded
    const SMP = {}, LIVE = {};
    function samplesLoad() { const a = ctx(); if (!a) return; Object.entries(SAMPLE_URLS).forEach(([k, url]) => { if (SMP[k] !== undefined) return; SMP[k] = null;
      fetch(url).then(r => r.arrayBuffer()).then(b => a.decodeAudioData(b)).then(buf => { SMP[k] = buf; }).catch(() => {}); }); }
    function sample(k, rate = 1, g = 1) {
      const a = ctx(); if (!a || !armed || !SMP[k]) return false; LIVE[k] = (LIVE[k] || []).filter(n => n.on); if (LIVE[k].length >= 3) return true;   // never more than 3 deep
      const s = a.createBufferSource(), v = a.createGain(); s.buffer = SMP[k]; s.playbackRate.value = rate; v.gain.value = g; s.connect(v).connect(sfxBus);
      const node = { on: true }; s.onended = () => { node.on = false; }; LIVE[k].push(node); s.start(); return true; }
    // the music bed (owner 23:40): one gapless loop on the music bus; in on GO, ducked under the cards, back up on replay
    const M = { buf: null, src: null, loading: false, want: 0 };
    function musicLoad() { const a = ctx(); if (!a || M.buf || M.loading || !MUSIC_URL) return; M.loading = true;
      fetch(MUSIC_URL).then(r => r.arrayBuffer()).then(b => a.decodeAudioData(b)).then(buf => { M.buf = buf; M.loading = false; if (M.want > 0) musicLevel(M.want, .8); }).catch(() => { M.loading = false; }); }
    function musicLevel(v, secs) { M.want = v; const a = ctx(); if (!a || !armed || !M.buf) return;
      if (!M.src) { M.src = a.createBufferSource(); M.src.buffer = M.buf; M.src.loop = true; M.src.connect(musicBus); M.src.start(); }
      const g = musicBus.gain, t = a.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(v * MUSIC_LEVEL, t + secs); }
    return { music(v, secs = .8) { musicLevel(v, secs); }, duck(on) { musicLevel(on ? DUCK / MUSIC_LEVEL : 1, .4); },
      unlock() { if (ATTRACT || BOT || !(VIEW_SOUND || has('sound'))) return; armed = true; ctx(); musicLoad(); samplesLoad(); },   // greyboxes are silent (owner 23:11); ?sound or a build's sound:true turns it on
      get muted() { return muted; }, set muted(v) { muted = v; if (master) master.gain.setTargetAtTime(v ? 0 : .85, ac.currentTime, .05); },
      splat(n) { if (sample('splat', (1 + Math.min(11, n - 1) * .03) * (.97 + Math.random() * .06), .9)) return; const t = now(); noise(t, .08, .25, 900); tone(scale[Math.min(7, n - 1)], t + .02, .18, 'triangle', .16); },   // rises 3% per patch
      wash() { if (sample('bubble', .92 + Math.random() * .08, 1)) return; const t = now(); for (let i = 0; i < 5; i++) tone(900 + Math.random() * 900, t + i * .035, .07, 'sine', .07, 400); tone(420, t, .3, 'sine', .08, -200); },
      tick() { const t = now(); tone(1400, t, .05, 'square', .04); tone(700, t + .01, .06, 'sine', .04); },
      beep(go) { const t = now(); tone(go ? 1046 : 660, t, go ? .3 : .12, 'square', .06); },
      win() { const t = now(); [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, t + i * .1, .32, 'triangle', .14)); },
      fail() { const t = now(); for (let i = 0; i < 8; i++) tone(1200 + Math.random() * 1200, t + i * .05, .06, 'sine', .05, 300); tone(330, t + .2, .4, 'triangle', .09, -120); } };
  })();
  function mount(VIEW) {
    const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
    if (!document.querySelector('link[href*="Nunito"]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Nunito:wght@800;900&family=Open+Sans:wght@600;700&display=swap'; document.head.appendChild(l); }
    const C = CONFIG.copy, mark = VIEW.brandLogo ? `<img src="${VIEW.brandLogo}" alt="${C.brand}">` : C.brand;
    const AS = VIEW.assets || 'assets/game/', petImg = AS + 'pet.webp', petFace = AS + 'pet-face.webp';
    const xm = ['papel', 'star', 'holly', 'poinsettia'].map(n => `--xm-${n === 'poinsettia' ? 'poin' : n}:url(${AS}xmas-${n}.webp)`).join(';') + `;--xm-orn:url(${AS}ornaments.webp)`;   // the badge: a face portrait cut from the toy's photo
    const cells = Array.from({ length: CONFIG.patches }, () => '<i></i>').join('');
    const title = C.startTitle.split(' '), first = title.shift(), cols = ['#e0362c', '#f08a1c', '#f4c20d', '#2aa34a', '#1f7ad0', '#7a3fb0'];
    const crayon = [...first].map((ch, k) => `<span style="--c:${cols[k % cols.length]};--r:${(k % 2 ? 4 : -4)}deg;--d:${k * .12}s">${ch}</span>`).join('');
    const stars = '<i></i><i></i><i></i>';
    const tail = id => TAIL.split('id="tg"').join(`id="${id}"`).split('url(#tg)').join(`url(#${id})`);   // one gradient id per ribbon: a shared id resolves to the hidden card's copy and paints nothing
    const TAIL = `<svg viewBox="0 0 38 53" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="tg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--rb-tail)"/><stop offset="1" style="stop-color:var(--rb-tail-lo)"/></linearGradient></defs><polygon points="0,0 38,0 38,53 0,53 10,26.5" fill="url(#tg)"/><polygon points="27,0 38,0 38,11" style="fill:var(--rb-fold)"/><polyline points="0.5,1.2 37,1.2" stroke="rgba(255,255,255,.35)" stroke-width="1.4" fill="none"/><polyline points="3,4.5 35,4.5" stroke="rgba(255,255,255,.35)" stroke-width=".8" stroke-dasharray="2.4 2" fill="none"/><polyline points="3,48.5 27,48.5" stroke="rgba(255,255,255,.25)" stroke-width=".8" stroke-dasharray="2.4 2" fill="none"/></svg>`;
    document.body.innerHTML = `
    <div class="frame" id="frame" style="--petimg:url(${petImg});--petface:url(${petFace});${xm}">
      <canvas id="game"></canvas>
      <div class="hud">
        <div class="bar"></div><div class="fuse" id="fuse"><i></i><b></b></div><div class="logo-s">${mark}</div>
        <div class="meter"><div class="badge" id="badge"></div><div class="track" id="coat">${cells}</div></div>
        <div class="hint" id="hint">${C.hint}</div>
        <div class="count" id="count"></div>
        ${VIEW.build ? '' : `<div class="greylabel">GREYBOX · ${VIEW.title.toUpperCase()}</div>`}
      </div>
      <div class="card start" id="startCard"><div class="topbar"></div><div class="papel"></div><div class="logo">${mark}</div>
        <div class="title"><span class="tag">${C.eyebrow}</span><h1 class="lockup">${crayon}</h1><h2 class="lockup2">${title.join(' ')}</h2></div>
        <div class="how"><span class="chip"><i class="orn"></i>${C.chipCatch}</span><span class="chip"><i class="bub"></i>${C.chipDodge}</span></div>
        <button class="btn" id="playBtn" type="button">${C.play}</button>
        <svg class="drag" id="dragHint" viewBox="0 0 220 90" aria-hidden="true"><path d="M20 45 h180 M30 33 l-12 12 12 12 M190 33 l12 12 -12 12" fill="none" stroke="#1d1b26" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
      <div class="card end" id="winCard" hidden><div class="topbar"></div><div class="papel"></div><div class="logo">${mark}</div><div class="stamp"><div class="tail l">${tail('tgwl')}</div><div class="band">${C.winStamp}</div><div class="tail r">${tail('tgwr')}</div></div>
        <div class="panel"><div class="stars" id="winStars">${stars}</div><h1>${C.winTitle}</h1><p>${C.winLine}</p><div class="stat" id="winStat"></div>
        <button class="btn" id="cta1" type="button">${C.cta}</button><button class="btn ghost" id="again1" type="button">${C.again}</button></div></div>
      <div class="card end" id="failCard" hidden><div class="topbar"></div><div class="papel"></div><div class="logo">${mark}</div><div class="stamp bad"><div class="tail l">${tail('tgfl')}</div><div class="band">${C.failStamp}</div><div class="tail r">${tail('tgfr')}</div></div>
        <div class="panel nostars"><h1 id="failWhy"></h1><div class="stat" id="failStat"></div>
        <button class="btn" id="cta2" type="button">${C.cta}</button><button class="btn ghost" id="again2" type="button">${C.againFail}</button></div></div>
    </div>`;
    if (document.body.innerHTML.includes('${')) console.error('unfilled template in the markup');
    const $ = id => document.getElementById(id);
    const canvas = $('game'), ctx = canvas.getContext('2d');
    let W = 640, H = 960; const dpr = Math.min(1.5, devicePixelRatio || 1);
    const resize = () => { const r = $('frame').getBoundingClientRect(); W = r.width; H = r.height; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); };
    new ResizeObserver(resize).observe($('frame')); resize();
    function show(which) {
      $('frame').classList.add('carded');
      if (which === 'win') { const tw = S.wonAt ?? S.elapsed, n = tw <= CONFIG.roundSecs * .6 ? 3 : tw <= CONFIG.roundSecs * .8 ? 2 : 1; $('winStat').textContent = '⏱ ' + C.stat.replace('{t}', tw.toFixed(1)); $('winStars').querySelectorAll('i').forEach((st, k) => st.classList.toggle('off', k >= n)); $('winCard').hidden = false; }
      else { const white = CONFIG.patches - S.coat.length; $('failWhy').textContent = (S.coat.length === 0 && S.washed ? C.failWhy.washed : C.failWhy.time).replace('{n}', white === 1 ? `1 ${C.patch}` : `${white} ${C.patches}`); $('failStat').textContent = C.statFail.replace('{c}', S.coat.length).replace('{n}', CONFIG.patches); $('failCard').hidden = false; }
      fitAll(which === 'win' ? 'winCard' : 'failCard'); placeStamp(which === 'win' ? 'winCard' : 'failCard', which === 'win');
    }
    // the stamp sits in the gap between the logo and the pet standing on centre stage (owner 23:35: it covered the tail): measured from the
    // pet's own stage box (its top, plus the win's hop), never a fixed offset, so a bigger pet or another camera cannot run into it
    function placeStamp(card, won) {
      const el = $(card).querySelector('.stamp'), logo = $(card).querySelector('.logo'); if (!el || !logo) return;
      const fr = $('frame').getBoundingClientRect(), H = fr.height, sc = G.stageScale || 1, ph = G.petH * sc * H;
      const petTop = (G.stageY || .5) * H - ph - (won ? ph * .2 : ph * .04), logoBottom = logo.getBoundingClientRect().bottom - fr.top;
      el.style.top = '0px'; const sh = el.getBoundingClientRect().height + Math.abs(Math.sin(4 * Math.PI / 180)) * el.getBoundingClientRect().width * .5;
      const room = petTop - logoBottom, top = room > sh ? logoBottom + (room - sh) * .45 : Math.max(logoBottom + 2, petTop - sh);
      el.style.top = Math.round(top) + 'px';
    }
    function fitTo(el, maxW, minPx) { if (!el) return; el.style.fontSize = ''; let fs = parseFloat(getComputedStyle(el).fontSize), n = 0; while (el.scrollWidth > maxW && fs > minPx && n++ < 40) { fs *= .94; el.style.fontSize = fs + 'px'; } }
    // headlines: one line if they fit at a readable size, else two lines at full size
    function fitAll(card) { const fw = $('frame').clientWidth; if (!fw) return;
      const sc = card ? $(card) : document; sc.querySelectorAll('.lockup,.lockup2').forEach(e => fitTo(e, fw * .9, fw * .08)); sc.querySelectorAll('.stamp .band').forEach(e => fitTo(e, fw * .68, fw * .04));
      sc.querySelectorAll('.panel h1').forEach(e => { e.style.whiteSpace = 'nowrap'; fitTo(e, fw * .84, fw * .052); if (e.scrollWidth > fw * .84) { e.style.whiteSpace = 'normal'; e.style.fontSize = ''; } }); sc.querySelectorAll('.how').forEach(h => { let k = 0; while (h.scrollWidth > fw * .94 && k++ < 20) h.querySelectorAll('.chip').forEach(ch => { ch.style.fontSize = parseFloat(getComputedStyle(ch).fontSize) * .95 + 'px'; }); }); }
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => fitAll('startCard')); new ResizeObserver(() => fitAll('startCard')).observe($('frame'));
    window.__showCard = show; window.__hideHud = on => $('frame').classList.toggle('revealing', !!on);
    const hideCards = () => { ['winCard', 'failCard', 'startCard'].forEach(i => $(i).hidden = true); $('frame').classList.remove('revealing', 'carded'); };
    const startRound = () => { hideCards(); SFX.unlock(); reset('play'); };
    window.DEMO = { start: () => { hideCards(); reset('attract'); $('startCard').hidden = false; $('frame').classList.add('carded'); }, slotMs: 22000, setAuto: () => {}, setSound: on => { SFX.muted = !on; } };
    $('playBtn').onclick = startRound; $('again1').onclick = startRound; $('again2').onclick = startRound;
    $('cta1').onclick = $('cta2').onclick = () => window.open(window.clickTag || CONFIG.ctaUrl, '_blank');
    const fp = e => { const r = $('frame').getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }; };
    $('frame').addEventListener('pointerdown', e => {
      try { parent.postMessage({ iionTap: fp(e) }, '*'); } catch (err) {}
      if (e.target.closest('.card')) return;
      if (S.mode === 'attract') startRound();
      if (!BOT) press(fp(e), 'user');
    });
    $('frame').addEventListener('pointermove', e => { if (S.down && !BOT) move(fp(e)); });
    window.addEventListener('pointerup', () => { if (!BOT) release(); }); window.addEventListener('pointercancel', () => { if (!BOT) release(); });
    window.addEventListener('keydown', e => { if (e.code === 'Space' && S.mode === 'attract') startRound(); if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { S.want = clamp(S.pet.x + (e.code === 'ArrowLeft' ? -.18 : .18), G.edge, 1 - G.edge); } });
    reset(BOT && !ATTRACT ? 'play' : 'attract');
    if (ATTRACT || BOT) $('startCard').hidden = true; else $('frame').classList.add('carded');
    const FX = { coat: '', cnt: -1, fuse: -1, low: null, tick: -1 }; const fuse = $('fuse'), fuseBar = fuse.firstChild, fuseSpark = fuse.lastChild; const dragHint = $('dragHint'); dragHint.style.top = ((G.floorY - G.petH) * 100 - 1) + '%';
    let last = performance.now();
    function frame(now) {
      requestAnimationFrame(frame);   // book the next frame first: an error below never stops the loop
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (S.mode === 'attract' || (BOT && !ATTRACT && S.mode === 'play')) autopilot(dt);
      update(dt);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      VIEW.drawFrame(ctx, S, W, H, CONFIG);
      if (!$('startCard').hidden) dragHint.style.left = (S.pet.x * 100).toFixed(2) + '%';
      const fl = Math.round(S.timeLeft / CONFIG.roundSecs * 400) / 400;   // the fuse: only written when it moves a visible step
      if (fl !== FX.fuse) { FX.fuse = fl; fuseBar.style.transform = `scaleX(${fl})`; fuseSpark.style.transform = `translateX(${fl * fuse.clientWidth}px)`; }
      const low = S.mode === 'play' && S.timeLeft > 0 && S.timeLeft < 5; if (low !== FX.low) { FX.low = low; fuse.classList.toggle('low', low); }
      const tk = low ? Math.ceil(S.timeLeft) : -1; if (tk !== FX.tick) { if (tk > 0 && FX.tick !== -1) SFX.tick(); FX.tick = tk; }   // a tick each second of the last five
      const coat = S.coat.join(','); if (coat !== FX.coat) { const before = FX.coat ? FX.coat.split(',').length : 0; FX.coat = coat;
        $('coat').querySelectorAll('i').forEach((d, i) => { const on = i < S.coat.length; d.style.backgroundPosition = on ? `${S.coat[i] * 50}% 60%` : '0 60%'; d.classList.toggle('on', on); d.classList.remove('new', 'gone'); if (on && i === S.coat.length - 1 && S.coat.length > before) { void d.offsetWidth; d.classList.add('new'); } if (!on && i === S.coat.length && S.coat.length < before) { void d.offsetWidth; d.classList.add('gone'); } });
        if (S.coat.length > before) { const b = $('badge'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); } }
      const cn = S.count > 0 ? Math.ceil(S.count / 0.5) : 0; if (cn !== FX.cnt) { FX.cnt = cn; const el = $('count'); el.textContent = cn === 3 ? C.ready : cn === 2 ? C.set : cn === 1 ? C.go : ''; el.style.whiteSpace = 'nowrap'; fitTo(el, $('frame').clientWidth * .92, 20); el.classList.remove('on'); void el.offsetWidth; if (cn) el.classList.add('on'); else el.style.opacity = 0; if (cn) el.style.opacity = ''; }
      const hint = $('hint'); const cueOn = S.cue && S.elapsed < S.cue.until;
      hint.textContent = cueOn ? S.cue.text : S.elapsed < CONFIG.leadIn ? C.leadInHint : C.hint; hint.classList.toggle('cue', !!cueOn);
      hint.style.opacity = S.count > 0 ? 0 : cueOn || S.mode === 'attract' || (S.mode === 'play' && S.caught < 2) ? 1 : 0;
    }
    requestAnimationFrame(frame);
  }
  const showCard = w => window.__showCard && window.__showCard(w);
  const hideHud = on => window.__hideHud && window.__hideHud(on);

  window.ColourPets = {
    CONFIG, waveOf,
    run(VIEW) {
      if (!STRINGS[Q.get('lang')] && VIEW.lang && STRINGS[VIEW.lang]) { CONFIG.lang = VIEW.lang; CONFIG.copy = STRINGS[VIEW.lang]; }
      document.documentElement.lang = CONFIG.lang;
      G = VIEW.geometry(); VIEW_SOUND = !!VIEW.sound; MUSIC_URL = VIEW.music || null; SAMPLE_URLS = VIEW.samples || {};
      if (VIEW.config && !Q.get('cfg')) Object.assign(CONFIG, VIEW.config);   // a view's own tuning (its camera changes the fall length)
      if (SIM) runSim(); layerRoutes(VIEW);
      if (has('embed') || has('full')) document.documentElement.classList.add('embed');
      mount(VIEW);
      const art = VIEW.artLayers ? VIEW.layers.filter(L => VIEW.artLayers.includes(L.id)) : VIEW.layers;
      if (window.LAYERS && VIEW.build) {   // a build shows nothing until every picture and the meta have settled (no grey shape in a build); 10 s cap
        const fr = document.getElementById('frame'); fr.style.visibility = 'hidden'; let done = 0, shown = false; const expect = 1 + art.length;
        const show = () => { if (shown) return; shown = true; fr.style.visibility = ''; };
        window.LAYERS.load(art, VIEW.assets || 'assets/game/', () => { if (++done >= expect) show(); }); setTimeout(show, 10000);
      } else if (window.LAYERS) window.LAYERS.load(art, VIEW.assets || 'assets/game/');
      window.GAME = { get S() { return S; }, CONFIG, reset, press, move, release };
      const qc = Q.get('card'); if (qc) setTimeout(() => { ['startCard', 'winCard', 'failCard'].forEach(i => { const el = document.getElementById(i); if (el) el.hidden = true; }); if (qc === 'win') { S.coat = [0, 1, 2, 0, 1, 2, 0, 1, 2, 0, 1, 2]; S.mode = 'win'; S.wonAt = 15.2; S.reveal = 3; } else { S.coat = [0, 2, 1]; S.washed = 2; S.mode = 'fail'; S.reveal = 3; } showCard(qc); hideHud(true); }, 200);
    },
    helpers: { clamp, rand },
  };
})();
