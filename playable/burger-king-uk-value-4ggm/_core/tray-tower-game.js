/* Tray Tower (Burger King UK) on the shared engine. A Melt, a Wrap or a carton of Chicken Tenders slides along the rail
   under the band; one tap drops it straight down onto the pile on the tray. Each lands relative to the item under it:
   inside a small window it snaps square; off-centre it stays where it landed and the tower wobbles from the knock.
   Balance is the real rule (owner 2026-10-23: it must play like real physics): at every level, the weight of
   everything above must sit over what holds it (the tray's top, or the middle of the item under it that can carry
   weight). Past the edge it tips over that edge and the round is over (owner 2026-10-23: anything on the counter is a
   loss): one item alone has slipped off; more than one is the tower going over, and the items below stay standing.
   Close to the edge the part above teeters as a warning, and an item landed on the other side pulls the balance back,
   as a counterweight would. Each landing says how the balance stands (owner: the game is the lean, not the timing).
   The slide speeds up in two steps, each announced by a held beat ('Faster') in which taps do not count.
   World units: frame widths, x from the tray's middle, y up from the tray's top. A shape only zooms and scrolls the
   view (CONFIG.shapes), so every shape plays at the same size and speed. */
(function () {
  const CONFIG = {
    ctaUrl: 'https://www.burgerking.co.uk/',
    roundSecs: 0,                  // no clock: the tower is the measure; a round ends at the top or on the topple
    play: {                        // the play size in frame widths, the same in every shape
      travel: 0.22,                // the slide runs this far either side of its middle
      centreClamp: 0.12,           // the slide's middle follows the pile top, never further than this from the tray's middle
      trayW: 0.46, trayH: 0.03,    // the tray: its whole top holds the first item
      items: {
        melt:    { w: 0.30, h: 0.065, support: 0.80 },   // squat, flat top: the middle 80% holds the next
        wrap:    { w: 0.27, h: 0.075, support: 0.55 },   // round top: only the middle 55% holds the next
        tenders: { w: 0.32, h: 0.085, support: 0.95 },   // wide flat carton: forgiving
      },
    },
    order: ['melt', 'wrap', 'tenders'],   // the order, over and over
    names: { melt: 'Melts', wrap: 'Wraps', tenders: 'Chicken Tenders' },
    short: { melt: 'Melt', wrap: 'Wrap', tenders: 'Tenders' },
    shapes: {
      // fit: the item heights stretch so toWin items reach the goal flag exactly (the view never moves)
      'counter-tower': { toWin: 12, stageAt: [4, 8], zoom: 1, fit: true, scroll: false },
      // scroll: the pile slides down so its top stays topGap (frame heights) under the rail; winRun: the run back to the tray
      'close-pile':    { toWin: 15, stageAt: [5, 10], zoom: 1.45, fit: false, scroll: true, topGap: 0.26, winRun: 1.3 },
    },
    speeds: [0.36, 0.5, 0.76],     // slide speed per stage, frame widths a second (the pressure)
    leadIn: 0.5,                   // seconds before the first item
    spawnGap: 0.12,                // seconds between a landing and the next item
    holdSecs: 0.7,                 // the 'Faster' beat: the item holds still, taps do not count
    minGap: 0.008,                 // the shortest fall
    gravity: 9,                    // frame widths a second squared
    cleanFrac: 0.1,                // a clean landing: within this share of the support's half width
    wobOmega: 6.5, wobDamp: 0.22,  // the wobble after a knock: a damped spring from the tray (radians a second; damping ratio)
    wobKick: 0.2,                  // the knock of an off-centre landing, radians a second at a full support's miss
    wobGrowth: 0.1,               // the same knock wobbles a taller tower more, by this share per item stacked
    tipAcc: [3, 14],               // tipping over an edge: angular acceleration, a + b x angle (radians a second squared)
    tipOff: 0.6,                   // past this angle a tipping item leaves the edge and falls free
    teeterAt: 0.3,                 // the part above teeters when its balance is within this share of the edge
    leanAt: 0.6,                   // a landing reads 'LEANING' below this balance margin, 'STEADY' above it
    teeterMax: 0.05,               // the teeter's lean at the edge itself, radians
    autoPasses: 2.5,               // an untapped item drops itself after this many back-and-forth passes (at the far end)
    winHold: 1.6,                  // seconds the finished tower stands before the sheet's timer runs out
    idleToAttract: 3,
    copy: {
      brand: 'BURGER KING', hint: 'Tap to drop', leadInHint: 'Here it comes',
      cueSway: 'Off-centre makes it wobble', cueWrap: 'Round top: land it in the middle', cueFaster: 'Faster', cueLean: 'Leaning! Land the next one on the other side',
      popClean: 'SQUARE', popSteady: 'STEADY', popLean: 'LEANING', popTeeter: 'TEETERING', popSlip: 'SLIPPED',
      startTitle: 'Stack the order.', startLine: 'Tap to drop. Keep the pile balanced', play: 'Play',
      winStamp: 'ORDER UP', winTitle: 'That much, for that price?', winLine: 'Melts, Wraps and Chicken Tenders. All that choice, all that taste.', cta: 'Order now',
      failStamp: 'TOPPLED', failStampSlip: 'SLIPPED', failLine: 'Keep the weight over the middle. Again?',
      failWhy: { topple: 'The tower lasted {n}. The {item} did it.', slip: 'The {item} slipped off at {n} high.', none: 'It went over before it stood.' },
      again: 'Replay',
    },
  };
  let E = null, S = null, G = null, SH = CONFIG.shapes['counter-tower'], FIT = 1;
  const P = CONFIG.play;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const sz = kind => { const I = P.items[kind]; return { w: I.w, h: I.h * FIT, support: I.support }; };
  const top = () => S.tower[S.tower.length - 1] || null;
  const pileTop = () => { const t = top(); return t ? t.y + t.h : 0; };
  const restTop = () => { const t = top(); return t ? t.x : 0; };
  const supportHalf = () => { const t = top(); return t ? t.w * t.support / 2 : P.trayW / 2; };
  function wobAt(t) {   // the wobble angle t seconds ahead, from the spring's state now
    const w = CONFIG.wobOmega, z = CONFIG.wobDamp, wd = w * Math.sqrt(1 - z * z);
    return Math.exp(-z * w * t) * (S.wob * Math.cos(wd * t) + (S.wobV + z * w * S.wob) / wd * Math.sin(wd * t));
  }
  const topXAt = ahead => restTop() + pileTop() * Math.sin(wobAt(ahead));
  // what holds level k up: the tray's top for k = -1, else the middle part of item k that can carry weight
  const holder = k => k < 0 ? { c: 0, h: P.trayW / 2, y: 0 } : { c: S.tower[k].x, h: S.tower[k].w * S.tower[k].support / 2, y: S.tower[k].y + S.tower[k].h };
  // the balance: for every level, where the weight of everything above it sits against the edge of what holds it.
  // Returns the lowest level whose load is past its edge (fall: true), else the level closest to its edge; margin is
  // 1 at dead centre and 0 at the edge. Weight goes by the picture's area.
  function balance() {
    let worst = null;
    for (let k = -1; k < S.tower.length - 1; k++) {
      let m = 0, mx = 0; for (let j = k + 1; j < S.tower.length; j++) { const a = S.tower[j].w * S.tower[j].h; m += a; mx += a * S.tower[j].x; }
      const hd = holder(k), off = mx / m - hd.c, dir = Math.sign(off) || 1;
      const r = { k, dir, margin: 1 - Math.abs(off) / hd.h, px: hd.c + dir * hd.h, py: hd.y };
      if (r.margin < 0) return { ...r, fall: true };
      if (!worst || r.margin < worst.margin) worst = r;
    }
    return worst;
  }
  const stageOf = () => S.count >= SH.stageAt[1] ? 2 : S.count >= SH.stageAt[0] ? 1 : 0;
  const hoverBottom = kind => Math.max(((G.trayY - G.railY) * 1.5 + S.scroll) / SH.zoom - sz(kind).h, pileTop() + CONFIG.minGap);
  const fallTime = c => Math.sqrt(2 * Math.max(0, c.y - pileTop()) / CONFIG.gravity);
  const ease = k => k * k * (3 - 2 * k);
  // a stacked item's pose as the tower rocks from the tray's top: its bottom centre and its turn
  function pose(it) {
    let bx = it.x, by = it.y, a = 0, px = 0, py = 0;
    const L = S.lean;
    if (it.tip) { a = it.tip.dir * it.tip.ang; px = it.tip.px; py = it.tip.py; }
    else if (L && L.margin < CONFIG.teeterAt && S.tower.indexOf(it) > L.k) {
      a = L.dir * CONFIG.teeterMax * (1 - Math.max(0, L.margin) / CONFIG.teeterAt) * (0.6 + 0.4 * Math.sin(S.tt * 9)); px = L.px; py = L.py;
    }
    if (a) { const dx = bx - px, dy = by - py, c = Math.cos(a), s = Math.sin(a); bx = px + dx * c + dy * s; by = py - dx * s + dy * c; }
    const s = Math.sin(S.theta); return { x: bx + by * s, y: by * Math.cos(S.theta), rot: a + S.theta };
  }
  // world (frame widths from the tray's middle, up from the tray's top) to frame fractions; s = frame widths per unit
  function toFrame(wx, wy) { const z = SH.zoom, sc = S ? S.scroll : 0; return { x: G.cx + wx * z, y: G.trayY - (wy * z - sc) / 1.5, s: z }; }

  function reset(mode) {
    S = { mode, elapsed: 0, timeLeft: null, tower: [], cur: null, debris: [], count: 0, drops: 0, cleans: 0, offs: 0, slips: 0, ignored: 0,
      kinds: { melt: 0, wrap: 0, tenders: 0 }, culprit: null, wob: 0, wobV: 0, theta: 0, tips: [], lean: null, tt: 0, dead: false, scroll: 0, runFrom: null, side: -1, hold: 0, stageShown: 0,
      nextSpawn: CONFIG.leadIn, over: 0, overResult: null, toppled: 0, ring: 0, ringAt: null, glow: 0, steam: 0,
      pops: [], lands: [], shake: 0, why: null, reveal: 0, idle: 0, cue: null, seen: {}, down: false };
  }
  function spawn() {
    const kind = CONFIG.order[S.count % 3], c = clamp(restTop(), -P.centreClamp, P.centreClamp);
    S.side = -S.side;
    const st = stageOf();
    S.cur = { kind, c, x: c + S.side * P.travel, dir: -S.side, v: CONFIG.speeds[st], y: 0, vy: 0, state: 'slide', dist: 0, plan: null };
    S.cur.y = hoverBottom(kind);
    if (st > S.stageShown) { S.stageShown = st; S.hold = CONFIG.holdSecs; E.cue(CONFIG.copy.cueFaster, CONFIG.holdSecs); if (!E.SIM) E.SFX.faster(); }
  }
  // in attract the round plays out for a moment before it loops; in play it ends at once
  function end(result, why) {
    if (S.mode === 'attract') { if (!S.over) { S.over = 1.4; S.overResult = result; } return; }
    E.finish(result, why);
  }
  function drop(c) { c.state = 'fall'; c.vy = 0; S.drops++; }
  // the one control: a tap drops the sliding item; during the 'Faster' beat it does not count
  function press(p, src) {
    if (S.mode !== 'play' && S.mode !== 'attract') return;
    S.idle = 0; if (src === 'user') E.SFX.unlock();
    const c = S.cur; if (!c || c.state !== 'slide' || S.over > 0) return;
    if (S.hold > 0) { S.ignored++; return; }
    drop(c);
  }
  function land(c) {
    S.cur = null; S.nextSpawn = S.elapsed + CONFIG.spawnGap;
    const k = sz(c.kind), sh = supportHalf(), d = c.x - topXAt(0), ad = Math.abs(d), sgn = Math.sign(d) || 1;
    const growth = 1 + CONFIG.wobGrowth * S.count;
    S.culprit = c.kind;
    const clean = ad <= CONFIG.cleanFrac * sh;
    const it = { kind: c.kind, w: k.w, h: k.h, support: k.support, y: pileTop(), x: clean ? restTop() : restTop() + d, flash: 0, side: sgn, squash: 1 };
    S.tower.push(it);
    const b = balance();
    if (b.fall) {   // past an edge: what is above it tips over that edge
      const group = S.tower.splice(b.k + 1);
      const t = { items: group, px: b.px, py: b.py, dir: b.dir, ang: 0, w: 0.6, why: group.length > 1 ? 'topple' : 'slip' };
      group.forEach(g => { g.tip = t; }); S.tips.push(t); S.lean = balance(); S.dead = true;
      if (t.why === 'topple') { S.shake = 1; if (!E.SIM) E.SFX.topple(); }
      else {   // the one just dropped goes over the edge
        S.slips++; S.shake = 0.5; S.wobV += sgn * CONFIG.wobKick * growth;
        S.pops.push({ t: 0, txt: CONFIG.copy.popSlip, x: it.x, y: it.y + k.h, bad: true, big: true }); if (!E.SIM) E.SFX.slip();
      }
      return;
    }
    S.lean = b;
    if (clean) {   // snaps square: the knock is soft and the wobble settles
      S.cleans++; S.wobV *= 0.5; S.ring = 1; S.ringAt = { x: it.x, y: it.y + k.h };
      S.pops.push({ t: 0, txt: CONFIG.copy.popClean, x: it.x, y: it.y + k.h }); if (!E.SIM) E.SFX.clean();
    } else {   // off-centre: it stays where it landed, the overhang flashes, the tower wobbles from the knock; the pop says how the balance stands
      S.offs++; S.wobV += sgn * CONFIG.wobKick * Math.min(1, ad / sh) * growth; it.flash = 1;
      const cp = CONFIG.copy, word = b.margin < CONFIG.teeterAt ? cp.popTeeter : b.margin < CONFIG.leanAt ? cp.popLean : cp.popSteady;
      S.pops.push({ t: 0, txt: word, x: it.x, y: it.y + k.h, bad: word !== cp.popSteady, big: word === cp.popTeeter });
      if (!E.SIM) E.SFX.land();
      if (!S.seen.sway) { S.seen.sway = true; E.cue(CONFIG.copy.cueSway, 1.8); }
    }
    S.count++; S.kinds[c.kind]++; S.lands.push({ x: it.x, y: it.y, t: 0, clean, kind: c.kind });
    if (b.margin < CONFIG.teeterAt && !S.seen.lean) { S.seen.lean = true; E.cue(CONFIG.copy.cueLean, 2); }
    else if (c.kind === 'wrap' && !S.seen.wrap) { S.seen.wrap = true; E.cue(CONFIG.copy.cueWrap, 1.8); }   // the next one lands on its round top
    if (S.count >= SH.toWin) { S.lean = null; end('win'); }
  }
  // a tipping group turns about its edge, faster as it goes; past tipOff each item leaves with the speed it had there
  function tipStep(t, dt) {
    t.w += dt * (CONFIG.tipAcc[0] + CONFIG.tipAcc[1] * t.ang); t.ang += t.w * dt;
    if (t.ang < CONFIG.tipOff) return false;
    const da = t.dir * t.w;
    t.items.forEach(it => {
      const q = pose(it), cx = q.x + Math.sin(q.rot) * it.h / 2, cy = q.y + Math.cos(q.rot) * it.h / 2;
      S.debris.push({ kind: it.kind, x: cx, y: cy, w: it.w, h: it.h, vx: da * (cy - t.py), vy: -da * (cx - t.px), rot: q.rot, vr: da, settled: false });
    });
    S.why = t.why; end('fail', t.why);
    return true;
  }
  function update(dt) {
    if (S.mode === 'reveal') { S.reveal += dt; if (S.reveal > CONFIG.winHold) S.mode = 'win'; }
    if (S.mode === 'reveal' || S.mode === 'win') {   // the tower stands still and glows; steam rises
      S.glow = Math.min(1, S.glow + dt * 2); S.steam += dt;
      if (SH.winRun) { if (S.runFrom == null) S.runFrom = S.scroll; const k = Math.min(1, S.reveal / SH.winRun); S.scroll = S.runFrom * (1 - ease(k)); }
    }
    if (S.mode === 'play' || S.mode === 'attract') {
      S.elapsed += dt; S.idle += dt;
      if (S.over > 0) { S.over -= dt; if (S.over <= 0) { E.finish(S.overResult, 'topple'); return; } }
      else {
        if (!S.cur && !S.dead && S.elapsed >= S.nextSpawn) spawn();
        const c = S.cur;
        if (c && c.state === 'slide') {
          if (S.hold > 0) S.hold -= dt;
          else {
            c.x += c.dir * c.v * dt; c.dist += c.v * dt;
            if (c.x > c.c + P.travel) { c.x = 2 * (c.c + P.travel) - c.x; c.dir = -1; }
            if (c.x < c.c - P.travel) { c.x = 2 * (c.c - P.travel) - c.x; c.dir = 1; }
            if (c.dist >= CONFIG.autoPasses * 4 * P.travel) drop(c);
          }
          if (c.state === 'slide') c.y = hoverBottom(c.kind);
        } else if (c && c.state === 'fall') {
          c.vy += CONFIG.gravity * dt; c.y -= c.vy * dt;
          if (c.y <= pileTop()) { c.y = pileTop(); land(c); }
        }
      }
    }
    { const w = CONFIG.wobOmega; S.wobV += (-w * w * S.wob - 2 * CONFIG.wobDamp * w * S.wobV) * dt; S.wob += S.wobV * dt; S.theta = S.wob; }
    S.tt += dt; S.tips = S.tips.filter(t => !tipStep(t, dt));
    // the view: fixed in a tower that fits the frame; in a close pile it slides so the top stays under the rail
    let want = 0;
    if (SH.scroll && (S.mode === 'play' || S.mode === 'attract') && !S.over) want = Math.max(0, pileTop() * SH.zoom - (G.trayY - G.railY - SH.topGap) * 1.5);
    if (!SH.winRun || !(S.mode === 'reveal' || S.mode === 'win')) S.scroll += (want - S.scroll) * Math.min(1, dt * (S.mode === 'fail' || S.over ? 4 : 6));
    S.debris.forEach(b => {
      if (b.settled) return;
      b.vy -= CONFIG.gravity * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt;
      const floor = (Math.abs(b.x) < P.trayW / 2 ? 0 : -P.trayH) + b.h / 2;
      if (b.y <= floor && b.vy < 0) {
        b.y = floor; b.vy = -b.vy * 0.25; b.vx *= 0.55; b.vr *= 0.4;
        if (b.vy < 0.2) { b.vy = 0; b.vx = 0; b.vr = 0; b.settled = true; b.rot = Math.round(b.rot / Math.PI) * Math.PI; }
      }
    });
    if (S.debris.length > 40) S.debris.splice(0, S.debris.length - 40);
    S.tower.forEach(it => { it.flash = Math.max(0, it.flash - dt * 2.5); });
    S.ring = Math.max(0, S.ring - dt * 3); S.shake = Math.max(0, S.shake - dt * 5);
    S.pops.forEach(p => p.t += dt); S.pops = S.pops.filter(p => p.t < (p.big ? 1.1 : 0.7));
    S.lands.forEach(l => l.t += dt); S.lands = S.lands.filter(l => l.t < 0.8);
  }
  // perfect bot: taps when the item is over where the pile top will be when it lands (the sway predicted over the fall).
  // first-timer bot (and the attract loop): reacts 0.2–0.45 s late, aims at where the top is now, misses by up to 18% of
  // the item's width until three clean landings (11% after), fumbles its first tap, sometimes taps during 'Faster'.
  function autopilot(dt) {
    const c = S.cur; if (!c || c.state !== 'slide' || S.over > 0) return;
    const H = E.HUMAN || S.mode === 'attract';
    if (!c.plan) {
      const w = sz(c.kind).w, sigma = (S.cleans < 3 ? 0.18 : 0.11) * w;
      const fumble = H && S.drops === 0 && Math.random() < 0.6;
      c.plan = H ? { react: rand(0.2, 0.45), err: fumble ? (Math.random() < 0.5 ? -1 : 1) * rand(0.25, 0.4) * w : rand(-1, 1) * sigma, earlyTap: S.hold > 0 && Math.random() < 0.35, age: 0 } : { react: 0, err: 0, age: 0 };
    }
    if (S.hold > 0) { if (c.plan.earlyTap && !c.plan.earlyDone && S.hold < CONFIG.holdSecs * 0.6) { c.plan.earlyDone = true; press({ x: 0.5, y: 0.5 }, 'bot'); } return; }
    c.plan.age += dt; if (c.plan.age < c.plan.react) return;
    const target = clamp(H ? topXAt(0) + c.plan.err : topXAt(fallTime(c)), c.c - P.travel, c.c + P.travel);
    if (Math.abs(c.x - target) <= c.v * dt * 0.6) press({ x: 0.5, y: 0.5 }, 'bot');
  }
  function buildTower(n) { for (let i = 0; i < n; i++) { const kind = CONFIG.order[i % 3], k = sz(kind); S.tower.push({ kind, w: k.w, h: k.h, support: k.support, y: pileTop(), x: 0, flash: 0, side: 1, squash: 1 }); S.count++; S.kinds[kind]++; } }

  window.TrayTowerGame = {
    CONFIG, get S() { return S; }, balance: () => balance(), shape: () => SH, size: kind => sz(kind), pose: it => pose(it), toFrame, pileTop: () => pileTop(), geometry: () => G, stageOf: () => stageOf(),
    run(VIEW) {
      const game = {
        CONFIG, get S() { return S; }, reset, press, update, autopilot,
        init(V) {
          SH = CONFIG.shapes[V.id] || CONFIG.shapes['counter-tower'];
          const g = V.geometry ? V.geometry() || {} : {}, num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
          G = { cx: num(g.cx, 0.5), trayY: num(g.trayY, 0.78), railY: num(g.railY, 0.165), goalY: num(g.goalY, 0.185) };
          let sum = 0; for (let i = 0; i < SH.toWin; i++) sum += P.items[CONFIG.order[i % 3]].h;
          FIT = SH.fit ? clamp(((G.trayY - G.goalY) * 1.5 / SH.zoom) / sum, 0.6, 1.6) : 1;
        },
        simLine: () => `t=${S.elapsed.toFixed(1)} height=${S.count} clean=${S.cleans} off=${S.offs} slips=${S.slips} margin=${S.lean ? S.lean.margin.toFixed(2) : '-'} ignored=${S.ignored} why=${S.why || '-'}`,
        hud: () => ({ left: `${S ? S.count : 0}/${SH.toWin}`, right: '', hint: S && S.elapsed < CONFIG.leadIn ? CONFIG.copy.leadInHint : CONFIG.copy.hint, hintOn: !!(S && S.mode === 'play' && S.count < 1), dots: null }),
        stat: () => `${S.count} high · ${S.kinds.melt} Melts · ${S.kinds.wrap} Wraps · ${S.kinds.tenders} Tenders`,
        failWhy: () => {
          const cp = CONFIG.copy, st = document.querySelector('#failCard .stamp'); if (st) st.textContent = S.why === 'slip' ? cp.failStampSlip : cp.failStamp;
          return S.count ? cp.failWhy[S.why === 'slip' ? 'slip' : 'topple'].replace('{n}', S.count).replace('{item}', CONFIG.short[S.culprit] || 'Wrap') : cp.failWhy.none;
        },
        sounds: sfx => ({
          land() { const t = sfx.now(); sfx.noise(t, .07, .3, 700); sfx.tone(180, t, .12, 'sine', .3, -60); },
          clean() { const t = sfx.now(); sfx.noise(t, .05, .2, 900); sfx.tone(740, t, .1, 'sine', .16); sfx.tone(1100, t + .06, .16, 'sine', .14); },
          slip() { const t = sfx.now(); sfx.tone(520, t, .3, 'triangle', .14, -320); },
          faster() { const t = sfx.now(); sfx.tone(660, t, .1, 'square', .1); sfx.tone(990, t + .11, .16, 'square', .1); },
          topple() { const t = sfx.now(); sfx.noise(t, .5, .45, 1200); sfx.tone(160, t, .5, 'sawtooth', .12, -100); },
        }),
        cardState(qc) {
          reset('play');
          if (qc === 'win') { buildTower(SH.toWin); S.mode = 'win'; S.glow = 1; S.reveal = CONFIG.winHold + 1; S.runFrom = 0; }
          else {
            buildTower(9); S.culprit = 'wrap'; S.why = 'topple';
            S.tower.forEach((it, i) => { const x = 0.1 + i * 0.07; S.debris.push({ kind: it.kind, x, y: (x < P.trayW / 2 ? 0 : -P.trayH) + it.h / 2, w: it.w, h: it.h, vx: 0, vy: 0, rot: i % 2 ? Math.PI : 0, vr: 0, settled: true }); });
            S.tower = []; S.mode = 'fail';
          }
        },
        winDelayMs: 2200, failDelayMs: 900,
      };
      E = window.ENGINE; E.run(game, VIEW);
    },
  };
})();