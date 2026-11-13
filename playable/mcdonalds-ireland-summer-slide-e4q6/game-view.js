/*
  Summer Mix, McDonald's-themed build: perspective drawing, input, interface, effects, sound, events and the in-page bots.
  Built on 03-greyboxes/game-view.js (same rounds, input, switches and track() events); the look is new.

  Switches: ?seed=N ?bot=greedy|random ?speed=N ?debug=1 ?nonav=1 ?mute ?cam=nearY,farY,nearHalfW,farHalfW
  Sound: nothing is created before the player's first touch; ?mute keeps everything silent always.
*/
(function () {
  'use strict';

  var Core = window.GameCore;
  var CONFIG = Core.CONFIG;
  var W = CONFIG.world.width;
  var H = CONFIG.world.height;
  var TH = CONFIG.theme;
  var COL = TH.colors;
  var FONT = TH.fonts.family;
  var TB = CONFIG.table;
  var TR = TH.tray;
  var K = TH.drinkWidth;
  var HERO = CONFIG.heroTier;
  var params = new URLSearchParams(location.search);

  if (params.get('cam')) {
    var cam = params.get('cam').split(',').map(Number);
    if (cam.length === 4 && cam.every(function (n) { return n > 0; })) {
      CONFIG.projection.nearY = cam[0];
      CONFIG.projection.farY = cam[1];
      CONFIG.projection.nearHalfW = cam[2];
      CONFIG.projection.farHalfW = cam[3];
    }
  }
  var PJ = Core.createProjection(CONFIG);

  Matter.Common.warn = function () {};

  var SEED = parseInt(params.get('seed') || '1', 10) || 1;
  var BOT = params.get('bot');
  var SPEED = Math.max(0.1, parseFloat(params.get('speed') || '1') || 1);
  var NONAV = params.get('nonav') === '1';
  var DEBUG = params.get('debug') === '1';
  var MUTE = params.has('mute') && params.get('mute') !== '0';
  var ALIGN = params.get('align') === '1';
  /* ambient life (water light, leaf shade, sheen, motes, glints, fizz, mist): ?fx=0 or reduced motion turns it off */
  var REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var FX = params.get('fx') !== '0' && !REDUCED;

  /* ---------- events ---------- */
  window.__events = [];
  window.__results = [];
  window.__result = null;

  function track(name, data) {
    var rec = { name: name, data: data || {}, t: Math.round(performance.now()) };
    window.__events.push(rec);
    console.log('[track] ' + name + ' ' + JSON.stringify(rec.data));
  }

  function clickOut() {
    track('cta', { url: CONFIG.clickOut.url });
    if (!NONAV) window.open(CONFIG.clickOut.url, '_blank', 'noopener');
  }
  window.clickOut = clickOut;

  /* ---------- sound: short synthesised WebAudio effects, made on the first touch only ---------- */
  var Sound = (function () {
    var ac = null, master = null, noiseBuf = null;
    var on = !MUTE;
    var lastClink = 0;

    function init() {
      if (MUTE || ac) return;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try { ac = new AC(); } catch (e) { ac = null; return; }
      master = ac.createGain();
      master.gain.value = on ? 0.55 : 0;
      master.connect(ac.destination);
      var len = Math.floor(ac.sampleRate * 0.5);
      noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }

    function ready() { return ac && on && ac.state !== 'closed'; }

    function tone(freq, t0, dur, type, gain, freqEnd) {
      var o = ac.createOscillator(), g = ac.createGain();
      o.type = type || 'sine';
      o.frequency.setValueAtTime(freq, t0);
      if (freqEnd) o.frequency.exponentialRampToValueAtTime(freqEnd, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g);
      g.connect(master);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    }

    function noise(t0, dur, f0, f1, gain) {
      var s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = noiseBuf;
      f.type = 'bandpass';
      f.Q.value = 1.4;
      f.frequency.setValueAtTime(f0, t0);
      f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.35);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      s.connect(f);
      f.connect(g);
      g.connect(master);
      s.start(t0);
      s.stop(t0 + dur + 0.05);
    }

    /* one pentatonic palette (C major pentatonic) so every effect sits together */
    var PENTA = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98];

    function play(name, arg) {
      if (!ready()) return;
      if (ac.state === 'suspended') ac.resume();
      var t = ac.currentTime + 0.005;
      if (name === 'slide') {
        noise(t, 0.28, 700, 2600, 0.12);
      } else if (name === 'clink') {
        var now = performance.now();
        if (now - lastClink < 70) return;
        lastClink = now;
        var v = Math.min(1, arg || 0.5);
        tone(2400 + Math.random() * 500, t, 0.09, 'sine', 0.035 * v);
        tone(3700 + Math.random() * 400, t, 0.06, 'sine', 0.018 * v);
      } else if (name === 'pop') {
        var f = PENTA[Math.min(PENTA.length - 1, (arg || 2) - 1)] / 2;
        tone(f * 0.8, t, 0.16, 'triangle', 0.16, f * 1.6);
        tone(f * 2, t + 0.02, 0.12, 'sine', 0.05);
      } else if (name === 'sparkle') {
        tone(PENTA[5], t, 0.18, 'sine', 0.05);
        tone(PENTA[7], t + 0.06, 0.18, 'sine', 0.045);
        tone(PENTA[8], t + 0.12, 0.26, 'sine', 0.04);
      } else if (name === 'win') {
        [0, 2, 4, 5].forEach(function (k, i) { tone(PENTA[k], t + i * 0.09, 0.5, 'triangle', 0.11); });
        tone(PENTA[5] / 2, t + 0.36, 0.8, 'sine', 0.08);
      } else if (name === 'fail') {
        tone(392, t, 0.28, 'sine', 0.07);
        tone(311.13, t + 0.2, 0.45, 'sine', 0.065);
      }
    }

    function toggle() {
      if (MUTE) return;
      on = !on;
      if (master) master.gain.setTargetAtTime(on ? 0.55 : 0, ac.currentTime, 0.02);
    }

    return { init: init, play: play, toggle: toggle, isOn: function () { return on; } };
  })();

  /* ---------- canvas and scaling (2:3 fitted; the scene fills the rest of the window) ---------- */
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var view = { s: 1, ox: 0, oy: 0, dpr: 1, cw: 0, ch: 0 };
  var staticLayer = document.createElement('canvas');
  var staticDirty = true;

  var safeProbe = document.createElement('div');
  safeProbe.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:env(safe-area-inset-bottom, 0px);pointer-events:none;visibility:hidden';
  document.body.appendChild(safeProbe);

  function resize() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cw = window.innerWidth, ch = window.innerHeight;
    canvas.style.width = cw + 'px';
    canvas.style.height = ch + 'px';
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    var s = Math.min(cw / W, ch / H);
    view.s = s;
    view.dpr = dpr;
    view.cw = cw;
    view.ch = ch;
    view.ox = (cw - W * s) / 2;
    view.oy = (ch - H * s) / 2;
    /* a page taller than 2:3: keep the menu strip clear of the phone's bottom safe area */
    var inset = safeProbe ? safeProbe.offsetHeight : 0;
    if (inset > 0 && ch - H * s > 0) view.oy = Math.max(0, Math.min(view.oy, ch - H * s - inset));
    staticDirty = true;
  }
  window.addEventListener('resize', resize);
  resize();

  function toGame(ev) {
    var r = canvas.getBoundingClientRect();
    return { x: (ev.clientX - r.left - view.ox) / view.s, y: (ev.clientY - r.top - view.oy) / view.s };
  }

  function fullRect() {
    return { x: -view.ox / view.s - 2, y: -view.oy / view.s - 2, w: view.cw / view.s + 4, h: view.ch / view.s + 4 };
  }

  function gameTransform(c) {
    c.setTransform(view.s * view.dpr, 0, 0, view.s * view.dpr, view.ox * view.dpr, view.oy * view.dpr);
  }

  /* ---------- assets ---------- */
  var IMG = { drinks: [], refl: [], fx: { splash: {}, droplets: [], ice: [], sparkles: [] } };
  var ready = false;

  function loadImage(src) {
    return new Promise(function (res) {
      var im = new Image();
      im.onload = function () {
        if (im.decode) im.decode().then(function () { res(im); }, function () { res(im); });
        else res(im);
      };
      im.onerror = function () { console.warn('missing ' + src); res(null); };
      im.src = src;
    });
  }

  function loadAll() {
    var jobs = [];
    CONFIG.tiers.forEach(function (t, i) {
      jobs.push(loadImage(CONFIG.artPath + t.art).then(function (im) { IMG.drinks[i] = im; }));
    });
    jobs.push(loadImage(TH.logo).then(function (im) { IMG.logo = im; }));
    jobs.push(loadImage(TH.scene).then(function (im) { IMG.scene = im; }));
    jobs.push(loadImage(TH.endBackdrop).then(function (im) { IMG.backdrop = im; }));
    jobs.push(loadImage(TH.ui.button).then(function (im) { IMG.button = im; }));
    jobs.push(loadImage(TH.ui.ribbon).then(function (im) { IMG.ribbon = im; }));
    if (TH.gameLogo) jobs.push(loadImage(TH.gameLogo).then(function (im) { IMG.gameLogo = im; }));
    Object.keys(TH.fx.splash).forEach(function (k) {
      jobs.push(loadImage(TH.fx.splash[k]).then(function (im) { IMG.fx.splash[k] = im; }));
    });
    ['droplets', 'ice', 'sparkles'].forEach(function (k) {
      TH.fx[k].forEach(function (src, i) {
        jobs.push(loadImage(src).then(function (im) { IMG.fx[k][i] = im; }));
      });
    });
    if (window.FontFace && document.fonts) {
      TH.fonts.faces.forEach(function (f) {
        var face = new FontFace(f.family, 'url("' + f.src + '")', { weight: f.weight });
        jobs.push(face.load().then(function (ff) { document.fonts.add(ff); }, function () { console.warn('font ' + f.src); }));
      });
    }
    return Promise.all(jobs).then(function () {
      buildSprites();
      ready = true;
      staticDirty = true;
    });
  }

  /* ---------- sprites made once: reflections, soft shadows, glow, rays ---------- */
  var SPR = {};

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function buildSprites() {
    /* each drink's reflection: the whole picture flipped, faded out from its foot (drawn under the drink, on the tray only) */
    IMG.drinks.forEach(function (im, i) {
      if (!im) return;
      var c = makeCanvas(im.naturalWidth, im.naturalHeight);
      var g = c.getContext('2d');
      g.translate(0, c.height);
      g.scale(1, -1);
      g.drawImage(im, 0, 0);
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.globalCompositeOperation = 'destination-in';
      var gr = g.createLinearGradient(0, 0, 0, c.height * 0.42);
      gr.addColorStop(0, 'rgba(0,0,0,0.30)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(0, 0, c.width, c.height);
      IMG.refl[i] = c;
    });
    /* cast shadows: a dark core right under the base and a lighter, softer cast part (circles, laid on the table plane) */
    /* warm shade taken from the tray's own shaded tone; drawn into one layer at these strengths, then the layer is
       laid down at SH_A, so overlaps never build up past it */
    SPR.shCore = radialSprite(128, 128, [[0, 'rgba(90,60,40,1)'], [0.45, 'rgba(90,60,40,0.6)'], [1, 'rgba(90,60,40,0)']]);
    SPR.shCast = radialSprite(128, 128, [[0, 'rgba(90,60,40,0.42)'], [0.5, 'rgba(90,60,40,0.24)'], [1, 'rgba(90,60,40,0)']]);
    /* the strip's not-yet-made state: each picture half desaturated (alpha untouched) */
    IMG.dim = [];
    IMG.drinks.forEach(function (im, i) {
      if (!im) return;
      var c = makeCanvas(im.naturalWidth, im.naturalHeight), g = c.getContext('2d');
      g.drawImage(im, 0, 0);
      try {
        var d = g.getImageData(0, 0, c.width, c.height), px = d.data;
        for (var k = 0; k < px.length; k += 4) {
          var l = 0.3 * px[k] + 0.59 * px[k + 1] + 0.11 * px[k + 2];
          px[k] = px[k] + (l - px[k]) * 0.55;
          px[k + 1] = px[k + 1] + (l - px[k + 1]) * 0.55;
          px[k + 2] = px[k + 2] + (l - px[k + 2]) * 0.55;
        }
        g.putImageData(d, 0, 0);
      } catch (e) { }
      IMG.dim[i] = c;
    });
    /* soft contact shadow */
    SPR.shadow = radialSprite(128, 64, [[0, 'rgba(70,24,4,0.62)'], [0.45, 'rgba(70,24,4,0.34)'], [1, 'rgba(70,24,4,0)']]);
    SPR.shadowSoft = radialSprite(128, 64, [[0, 'rgba(70,24,4,0.22)'], [1, 'rgba(70,24,4,0)']]);
    SPR.glow = radialSprite(256, 256, [[0, 'rgba(255,255,255,0.95)'], [0.35, 'rgba(255,240,200,0.6)'], [1, 'rgba(255,220,140,0)']]);
    SPR.goldGlow = radialSprite(128, 128, [[0, 'rgba(255,224,138,0.95)'], [0.55, 'rgba(255,199,44,0.45)'], [1, 'rgba(255,199,44,0)']]);
    SPR.redGlow = radialSprite(128, 64, [[0, 'rgba(218,41,28,0.55)'], [0.6, 'rgba(218,41,28,0.25)'], [1, 'rgba(218,41,28,0)']]);
    /* rays: alternating soft wedges, fading out from the centre */
    var R = 512, c = makeCanvas(R * 2, R * 2), g = c.getContext('2d');
    g.translate(R, R);
    var n = 18;
    g.fillStyle = 'rgba(255,248,220,1)';
    for (var k = 0; k < n; k++) {
      var a0 = k / n * Math.PI * 2, a1 = a0 + Math.PI / n;
      g.beginPath();
      g.moveTo(0, 0);
      g.arc(0, 0, R, a0, a1);
      g.closePath();
      g.fill();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = 'destination-in';
    var rg = g.createRadialGradient(R, R, 0, R, R, R);
    rg.addColorStop(0, 'rgba(0,0,0,0.0)');
    rg.addColorStop(0.12, 'rgba(0,0,0,0.42)');
    rg.addColorStop(0.6, 'rgba(0,0,0,0.22)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.fillRect(0, 0, R * 2, R * 2);
    SPR.rays = c;
  }

  function radialSprite(w, h, stops) {
    var c = makeCanvas(w, h), g = c.getContext('2d');
    g.translate(w / 2, h / 2);
    g.scale(w / 2, h / 2);
    var gr = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); });
    g.fillStyle = gr;
    g.beginPath();
    g.arc(0, 0, 1, 0, Math.PI * 2);
    g.fill();
    return c;
  }

  /* ---------- rounds ---------- */
  var round = 1;
  var game = null;
  var bot = null;
  var hintOn = true;
  var hintT = 0;
  var hintOut = -1;
  var endShown = false;
  var resultLogged = false;
  var overlay = null;
  var overlayT = 0;
  var buttons = [];
  var botRetryAt = -1;
  var heldPopT = 0;
  var lastHeld = null;
  var lastNext = null;
  var nextPopT = 0;
  var queuedLaunch = false;
  var failAt = -1;
  var failDrink = null;
  var parts = [];
  var floorFx = [];
  var flyers = [];
  var litShown = {};
  var litPulse = {};
  var bump = { t0: -10, amp: 0, x: W / 2, y: 500 };
  var winStartT = -1;

  function nowS() { return performance.now() / 1000; }

  /*
    The HUD grid at 640x960: one 24 px margin all round, 16 px gaps. Top row, one height and one top line: the order
    card | the arches plate (centred on the screen) | the Next card, the two cards the same width so both sides weigh
    the same. The menu strip sits on the bottom margin, full width, seven equal cells.
  */
  var HUD = (function () {
    var M = 24, G = 16, rowY = 24, rowH = 96, logoW = 96, stripH = 80;
    var cardW = (W - 2 * M - logoW - 2 * G) / 2;
    return {
      M: M, G: G, radius: 18, band: 30,
      order: { x: M, y: rowY, w: cardW, h: rowH },
      logo: { x: M + cardW + G, y: rowY, w: logoW, h: rowH },
      next: { x: W - M - cardW, y: rowY, w: cardW, h: rowH },
      strip: { x: M, y: H - M - stripH, w: W - 2 * M, h: stripH },
      stripPad: 10, stripGap: 10, thumbH: 52,
      nameY: rowY + rowH + G + 45
    };
  })();
  window.__hud = HUD;

  /* merges since the last slide (for the chain praise), the praise on screen, the once-per-round danger hint */
  var slideMerges = 0;
  var praise = null;
  var dangerHint = { shown: false, t0: -10 };

  function onCoreEvent(name, data) {
    if (name === 'first_touch') {
      if (hintOn) hintOut = nowS();
      hintOn = false;
      if (hudT0 == null) hudT0 = nowS();
    }
    if (name === 'drop') { Sound.play('slide'); slideMerges = 0; }
    if (name === 'merge') {
      onMerge(data);
      slideMerges++;
      if (slideMerges >= 2) {
        var pq = PJ.toScreen(data.x, data.y);
        praise = { text: slideMerges >= 3 ? CONFIG.words.chain3 : CONFIG.words.chain2, x: pq.x, y: pq.y, t0: game.time };
        if (window.__pauseOnPraise) { window.__pauseOnPraise = false; window.__pauseAt = nowS() + 0.15; }
      }
    }
    if (name === 'tier_first') onFirst(data);
    if (name === 'win') { Sound.play('win'); winStartT = nowS(); }
    if (name === 'fail') Sound.play('fail');
    track(name, data);
  }

  function onImpact(ev) {
    var pairs = ev.pairs;
    for (var i = 0; i < pairs.length; i++) {
      var a = pairs[i].bodyA.parent, b = pairs[i].bodyB.parent;
      var va = a.velocity, vb = b.velocity;
      var rel = Math.sqrt((va.x - vb.x) * (va.x - vb.x) + (va.y - vb.y) * (va.y - vb.y)) * 60;
      if (rel < 120) continue;
      var amp = Math.min(0.06, rel / 760 * 0.06);
      [a, b].forEach(function (body) {
        if (body.plugin && body.plugin.drink) { body.plugin.sqT = nowS(); body.plugin.sqA = amp; }
      });
      Sound.play('clink', rel / 700);
    }
  }

  function newRound() {
    queuedLaunch = false;
    demo = null;
    demoFade = null;
    var seed = round === 1 ? SEED : SEED + 1000 * (round - 1);
    game = Core.createGame(Matter, { seed: seed, onEvent: onCoreEvent });
    Matter.Events.on(game.engine, 'collisionStart', onImpact);
    realGame = game;
    bot = BOT ? Core.createBot(BOT, seed) : null;
    endShown = false;
    resultLogged = false;
    overlay = null;
    buttons = [];
    lastHeld = null;
    lastNext = null;
    failAt = -1;
    failDrink = null;
    parts = [];
    splashes = [];
    drops = [];
    floorFx = [];
    flyers = [];
    callout = null;
    litShown = {};
    litPulse = {};
    winStartT = -1;
    slideMerges = 0;
    praise = null;
    dangerHint = { shown: false, t0: -10 };
    window.__game = game;
    if (round === 1 && !BOT && hintOn) startDemoLoop();
  }

  /*
    The start demo: a scripted loop on a copy of the starting table (its own game, same seed and pre-stock). The hand
    drags the waiting Sprite to line up with the pre-stocked Sprite, both glow, it slides, they merge (pop, splash, the
    new drink's name), a beat, then the copy is thrown away and the loop starts again. The real round is untouched;
    the first touch ends the demo, fades its drinks out and hands over to the real round in the same frame.
    Track: one demo_loop per loop, nothing else.
  */
  var realGame = null;
  var demo = null;
  var demoFade = null;

  function onDemoEvent(name, data) {
    if (name === 'merge' && demo && demo.mergeT == null) demo.mergeT = demo.t;
    if (name === 'merge') onMerge(data);
  }

  function clearFx() {
    parts = [];
    splashes = [];
    drops = [];
    floorFx = [];
    flyers = [];
    callout = null;
    litShown = {};
    litPulse = {};
    lastHeld = null;
  }

  function startDemoLoop() {
    var g = Core.createGame(Matter, { seed: realGame.seed, onEvent: onDemoEvent });
    Matter.Events.on(g.engine, 'collisionStart', onImpact);
    g.held = CONFIG.demo.tier;
    g.next = realGame.next;
    g.aim(TB.width / 2);
    var target = null, best = Infinity;
    g.drinks.forEach(function (b) {
      if (b.plugin.tier !== CONFIG.demo.tier) return;
      var dd = Math.abs(b.position.x - CONFIG.demo.x);
      if (dd < best) { best = dd; target = b; }
    });
    demo = { g: g, t: 0, launched: false, target: target };
    window.__demo = demo;
    game = g;
    clearFx();
    track('demo_loop', {});
  }

  function endDemo() {
    if (!demo) return;
    var list = demo.g.drinks.map(function (b) {
      return { tier: b.plugin.tier, x: b.position.x, y: b.position.y, ps: popScale(b.plugin) };
    });
    demoFade = { list: list, t0: nowS() };
    demo = null;
    window.__demo = null;
    game = realGame;
    clearFx();
  }

  function updateDemo(dt) {
    if (!demo) return;
    var d = demo, D = CONFIG.demo, x0 = TB.width / 2;
    d.t += dt;
    if (d.t < 0.35) d.g.aim(x0);
    else if (d.t < 0.85) d.g.aim(x0 + (D.x - x0) * easeInOut((d.t - 0.35) / 0.5));
    else if (!d.launched && d.t >= 1.08) {
      d.g.aim(D.x);
      d.launched = true;
      d.g.launch();
    }
    if (d.t >= D.loop) startDemoLoop();
  }

  /* the matching pair glows just before the release */
  function demoGlow() {
    if (!demo) return 0;
    var t = demo.t;
    if (t < 0.6 || t > 1.3) return 0;
    return t < 0.8 ? (t - 0.6) / 0.2 : (t > 1.12 ? Math.max(0, 1 - (t - 1.12) / 0.18) : 1);
  }

  /* the demo's drinks fading out over the real table after the first touch (only where they differ from it) */
  function drawDemoFade(c) {
    if (!demoFade) return;
    var k = (nowS() - demoFade.t0) / 0.22;
    if (k >= 1) { demoFade = null; return; }
    demoFade.list.forEach(function (e) {
      var same = game.drinks.some(function (b) {
        return b.plugin.tier === e.tier && Math.abs(b.position.x - e.x) < 3 && Math.abs(b.position.y - e.y) < 3;
      });
      if (same) return;
      var bx = drinkBox(e.tier, e.x, e.y, e.ps);
      drawPic(c, e.tier, bx.x, bx.y, bx.w, 1 - k, 0);
    });
  }

  function retry() {
    round = 2;
    track('retry', {});
    newRound();
  }

  newRound();

  /* ---------- geometry helpers ---------- */
  function ratioOf(tier) {
    var im = IMG.drinks[tier - 1];
    return im ? im.naturalHeight / im.naturalWidth : 1.6;
  }

  /* a drink on the table: its picture's bottom-centre and size on screen */
  function drinkBox(tier, x, y, scale) {
    var r = CONFIG.tiers[tier - 1].r * (CONFIG.sizeScale || 1) * scale;
    var q = PJ.toScreen(x, y);
    var w = 2 * r * K * q.s;
    return { x: q.x, y: q.y + TH.baseLift * w, w: w, h: w * ratioOf(tier), cx: q.x, cy: q.y, r: r, s: q.s, sy: q.sy };
  }

  /* a point on or above the tray: table x, y and height h in table units (heights scale like widths) */
  function P(x, y, h) {
    var q = PJ.toScreen(x, y);
    return { x: q.x, y: q.y - (h || 0) * q.s };
  }

  function poly(c, pts) {
    c.beginPath();
    c.moveTo(pts[0].x, pts[0].y);
    for (var i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
    c.closePath();
  }

  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.arcTo(x + w, y, x + w, y + r, r);
    c.lineTo(x + w, y + h - r);
    c.arcTo(x + w, y + h, x + w - r, y + h, r);
    c.lineTo(x + r, y + h);
    c.arcTo(x, y + h, x, y + h - r, r);
    c.lineTo(x, y + r);
    c.arcTo(x, y, x + r, y, r);
    c.closePath();
  }

  function font(size, weight) {
    return (weight || 700) + ' ' + size + 'px ' + FONT;
  }

  function easeOutBack(k) {
    var c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2);
  }
  function easeOutCubic(k) { return 1 - Math.pow(1 - k, 3); }
  function easeInOut(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
  function clamp01(k) { return k < 0 ? 0 : (k > 1 ? 1 : k); }

  /* ---------- text with a raised, smaller ® ---------- */
  function measureRich(c, text, size, weight) {
    var bits = text.split('®'), w = 0;
    for (var i = 0; i < bits.length; i++) {
      c.font = font(size, weight);
      w += c.measureText(bits[i]).width;
      if (i < bits.length - 1) {
        c.font = font(size * 0.5, weight);
        w += c.measureText('®').width + size * 0.03;
      }
    }
    return w;
  }

  /*
    Text is centred on its cap height, not its line box: the alphabetic baseline goes at y + capHeight / 2, so the
    capitals sit optically centred on y (Speedee's ascent and descent are uneven).
  */
  var capCache = {};
  function capH(c, size, weight) {
    var k = size + '|' + (weight || 700);
    if (capCache[k] == null) {
      c.save();
      c.font = font(size, weight);
      var m = c.measureText('H');
      capCache[k] = m.actualBoundingBoxAscent || size * 0.7;
      c.restore();
    }
    return capCache[k];
  }

  function fillRich(c, text, x, y, size, weight, align) {
    var w = measureRich(c, text, size, weight);
    var sx = align === 'center' ? x - w / 2 : (align === 'right' ? x - w : x);
    var bits = text.split('®');
    var base = y + capH(c, size, weight) / 2;
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    for (var i = 0; i < bits.length; i++) {
      c.font = font(size, weight);
      c.fillText(bits[i], sx, base);
      sx += c.measureText(bits[i]).width;
      if (i < bits.length - 1) {
        c.font = font(size * 0.5, weight);
        c.fillText('®', sx + size * 0.015, base - capH(c, size, weight) * 0.48);
        sx += c.measureText('®').width + size * 0.03;
      }
    }
    return w;
  }

  /* one line of plain text, capitals centred on y */
  function fillCap(c, text, x, y, size, weight, align, stroke) {
    c.font = font(size, weight);
    c.textAlign = align || 'center';
    c.textBaseline = 'alphabetic';
    var base = y + capH(c, size, weight) / 2;
    if (stroke) c.strokeText(text, x, base);
    else c.fillText(text, x, base);
  }

  function fitSize(c, text, maxW, size, weight, minSize) {
    var s = size;
    while (measureRich(c, text, s, weight) > maxW && s > (minSize || 10)) s -= 1;
    return s;
  }

  function wrapRich(c, text, size, weight, maxW) {
    var words = text.split(' '), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var t = cur ? cur + ' ' + words[i] : words[i];
      if (cur && measureRich(c, t, size, weight) > maxW) { lines.push(cur); cur = words[i]; } else cur = t;
    }
    if (cur) lines.push(cur);
    return lines;
  }

  /* ---------- pictures ---------- */
  /* a drink picture, whole and at its own proportions; sq = transient squash amount (impact), 0 at rest */
  function drawPic(c, tier, bx, by, w, alpha, sq) {
    var im = IMG.drinks[tier - 1];
    if (!im) return;
    var h = w * im.naturalHeight / im.naturalWidth;
    var sx = 1 + (sq || 0), sy = 1 - (sq || 0);
    if (alpha != null && alpha < 1) { c.save(); c.globalAlpha *= alpha; }
    c.drawImage(im, bx - w * sx / 2, by - h * sy, w * sx, h * sy);
    if (alpha != null && alpha < 1) c.restore();
  }

  /* a drink in the interface, fitted to a box height, standing on bottomY */
  function drawThumb(c, tier, cx, bottomY, boxH, alpha) {
    var r = ratioOf(tier);
    drawPic(c, tier, cx, bottomY, boxH / r, alpha, 0);
  }

  /* ---------- the static layer: scene + tray, rebuilt on resize ---------- */
  /*
    The soft copy of the scene for the space outside the 2:3 frame, made once: the picture drawn into a 240x360 canvas
    (slightly enlarged so the blur has no transparent fringe) through a real Gaussian blur, or, where ctx.filter is
    missing, three halvings and a smoothed scale back up. Drawn with high-quality smoothing.
  */
  function softScene(im, blurSrc) {
    var h = 640, w = Math.round(h * im.naturalWidth / im.naturalHeight);
    var out = makeCanvas(w, h), g = out.getContext('2d');
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    if ('filter' in g) {
      g.filter = 'blur(' + blurSrc.toFixed(2) + 'px)';
      g.drawImage(im, -w * 0.04, -h * 0.04, w * 1.08, h * 1.08);
      g.filter = 'none';
      return out;
    }
    g.drawImage(im, 0, 0, w, h);
    var cur = out;
    var passes = Math.max(1, Math.min(4, Math.round(Math.log(Math.max(2, blurSrc)) / Math.LN2)));
    for (var i = 0; i < passes; i++) {
      var nx = makeCanvas(Math.max(1, cur.width >> 1), Math.max(1, cur.height >> 1)), ng = nx.getContext('2d');
      ng.imageSmoothingEnabled = true;
      ng.imageSmoothingQuality = 'high';
      ng.drawImage(cur, 0, 0, nx.width, nx.height);
      cur = nx;
    }
    g.clearRect(0, 0, w, h);
    g.drawImage(cur, 0, 0, w, h);
    return out;
  }

  function drawScene(c) {
    var f = fullRect();
    var im = IMG.scene;
    if (!im) {
      c.fillStyle = COL.page;
      c.fillRect(f.x, f.y, f.w, f.h);
      return;
    }
    /*
      The tray is seen from high up: its vanishing point is far above the screen, so the eye-level photo's horizon,
      parasol and parapet cannot belong to it. Until the painted scene arrives only the photo's plain warm floor is
      shown: scaled uniformly so the part below SCENE_FLOOR (a fraction of its height) covers the window.
    */
    var SCENE_FLOOR = TH.sceneHasTable ? 0 : 0.6;
    var srcH = im.naturalHeight * (1 - SCENE_FLOOR);
    var sc = Math.max(f.w / im.naturalWidth, f.h / srcH);
    var dw = im.naturalWidth * sc, dh = im.naturalHeight * sc;
    var top = TH.sceneHasTable ? f.y + (f.h - dh) / 2 : f.y - im.naturalHeight * SCENE_FLOOR * sc;
    c.drawImage(im, f.x + (f.w - dw) / 2, top, dw, dh);
    /* a painted scene is laid exactly on the 2:3 frame (its tray must meet the physics); around it, on a window of
       another shape, a soft (blurred) cover-fitted copy of the same picture continues it */
    if (TH.sceneHasTable) {
      var F = TH.sceneFit || { scale: 1, ax: 0, ay: 0, dx: 0, dy: 0 };
      var px0 = F.ax - F.ax * F.scale + F.dx, py0 = F.ay - F.ay * F.scale + F.dy, pw = W * F.scale, ph = H * F.scale;
      /* beyond the frame the picture continues as its own mirror image (decking below, water above, deck at the
         sides), uniformly scaled, never stretched */
      if (f.y < py0) {
        /* above: the water, mirrored for 120 px, then its own colour */
        if (!SPR.topCol) {
          var one2 = makeCanvas(1, 1), og2 = one2.getContext('2d');
          og2.drawImage(im, 0, 0, im.naturalWidth, 8, 0, 0, 1, 1);
          var d2 = og2.getImageData(0, 0, 1, 1).data;
          SPR.topCol = 'rgb(' + d2[0] + ',' + d2[1] + ',' + d2[2] + ')';
          SPR.topCol0 = 'rgba(' + d2[0] + ',' + d2[1] + ',' + d2[2] + ',0)';
        }
        c.fillStyle = SPR.topCol;
        c.fillRect(f.x, f.y, f.w, py0 - f.y);
        c.save();
        c.beginPath();
        c.rect(f.x, py0 - 120, f.w, 120);
        c.clip();
        c.translate(0, py0);
        c.scale(1, -1);
        c.drawImage(im, px0, 0, pw, ph);
        c.restore();
        var gt2 = c.createLinearGradient(0, py0 - 120, 0, py0 - 60);
        gt2.addColorStop(0, SPR.topCol);
        gt2.addColorStop(1, SPR.topCol0);
        c.fillStyle = gt2;
        c.fillRect(f.x, py0 - 121, f.w, 61);
      }

      if (f.x < px0 || f.x + f.w > px0 + pw) {
        /* a wider window: a soft, dimmed cover-fit of the same picture at the sides (a mirror would repeat the table) */
        /* the blur is set in screen px (theme.outerBlurPx) and converted to the 640 px source */
        var blurSrc = (TH.outerBlurPx || 9) * 640 / Math.max(1, dh * view.s);
        if (!SPR.sceneSoft || Math.abs(SPR.sceneSoftBlur - blurSrc) > 0.25) {
          SPR.sceneSoft = softScene(im, blurSrc);
          SPR.sceneSoftBlur = blurSrc;
        }
        c.save();
        c.imageSmoothingEnabled = true;
        c.imageSmoothingQuality = 'high';
        c.drawImage(SPR.sceneSoft, f.x + (f.w - dw) / 2, f.y + (f.h - dh) / 2, dw, dh);
        c.restore();
        c.fillStyle = 'rgba(0,0,0,0.1)';
        c.fillRect(f.x, f.y, f.w, f.h);
        /* a soft shadow where the frame meets the fill */
        [[px0, -1], [px0 + pw, 1]].forEach(function (e) {
          var g = c.createLinearGradient(e[0], 0, e[0] + e[1] * 26, 0);
          g.addColorStop(0, 'rgba(40,12,2,0.35)');
          g.addColorStop(1, 'rgba(40,12,2,0)');
          c.fillStyle = g;
          c.fillRect(Math.min(e[0], e[0] + e[1] * 26), f.y, 26, f.h);
        });
      }
      c.drawImage(im, px0, py0, pw, ph);
      /* below the frame the decking continues as a soft warm fill in the picture's own bottom colour (a mirror would
         repeat the table's legs) */
      if (f.y + f.h > H) {
        if (!SPR.deckCol) {
          var one = makeCanvas(1, 1), og = one.getContext('2d');
          og.drawImage(im, 0, im.naturalHeight - 8, im.naturalWidth, 8, 0, 0, 1, 1);
          var d1 = og.getImageData(0, 0, 1, 1).data;
          SPR.deckCol = [d1[0], d1[1], d1[2]];
        }
        var dc = SPR.deckCol;
        var gd = c.createLinearGradient(0, H - 24, 0, f.y + f.h);
        gd.addColorStop(0, 'rgba(' + dc[0] + ',' + dc[1] + ',' + dc[2] + ',0)');
        gd.addColorStop(24 / (f.y + f.h - H + 24), 'rgb(' + dc[0] + ',' + dc[1] + ',' + dc[2] + ')');
        gd.addColorStop(1, 'rgb(' + Math.round(dc[0] * 0.8) + ',' + Math.round(dc[1] * 0.8) + ',' + Math.round(dc[2] * 0.8) + ')');
        c.fillStyle = gd;
        c.fillRect(f.x, H - 24, f.w, f.y + f.h - H + 24);
      }
    }
    /* a warm wash at the very top so the cards sit on calm light */
    var g = c.createLinearGradient(0, f.y, 0, 150);
    g.addColorStop(0, 'rgba(120,20,8,0.28)');
    g.addColorStop(1, 'rgba(120,20,8,0)');
    c.fillStyle = g;
    c.fillRect(f.x, f.y, f.w, 150 - f.y);
  }

  /* the game's own tray; skipped when the scene picture has the tray painted in (TH.sceneHasTable) */
  function drawTray(c) {
    if (TH.sceneHasTable) { drawTrayCues(c); return; }
    drawTrayBody(c);
  }

  /* what the game always draws on the tray: the player's side of the line in a faint golden tint */
  function drawTrayCues(c) {
    var Wt = TB.width, L = TB.length;
    var z0 = P(0, TB.launchLineY, 0), z1 = P(Wt, TB.launchLineY, 0);
    poly(c, [z0, z1, P(Wt, L, 0), P(0, L, 0)]);
    var gz = c.createLinearGradient(0, z0.y, 0, P(0, L, 0).y);
    gz.addColorStop(0, 'rgba(255,199,44,0.16)');
    gz.addColorStop(1, 'rgba(255,199,44,0.06)');
    c.fillStyle = gz;
    c.fill();
  }

  /*
    The table under the tray stands on the floor TR.standH below the tray top: its shadow on the floor (cast along the
    same light as the drinks) and its two front legs. Points below the tray use negative heights.
  */
  function drawTableStand(c) {
    var Wt = TB.width, t = TR.rimT, Lo = TB.length + TR.lipT, hs = -TR.standH;
    var sd = TH.shadowDir, k = TR.standH * 0.55;
    c.save();
    var off = 4000;
    c.shadowColor = 'rgba(96,36,4,0.38)';
    c.shadowBlur = 34 * view.s * view.dpr;
    c.shadowOffsetX = off * view.s * view.dpr;
    c.translate(-off, 0);
    poly(c, [P(-t + sd.x * k, -t + sd.y * k, hs), P(Wt + t + sd.x * k, -t + sd.y * k, hs), P(Wt + t + sd.x * k, Lo + sd.y * k, hs), P(-t + sd.x * k, Lo + sd.y * k, hs)]);
    c.fillStyle = '#000';
    c.fill();
    c.restore();
    /* the legs end behind the menu strip (clipped at its middle), so nothing hangs below it */
    c.save();
    c.beginPath();
    c.rect(-1000, -1000, W + 2000, 1000 + HUD.strip.y + HUD.strip.h / 2);
    c.clip();
    [[-t + 4, -t + 22], [Wt + t - 22, Wt + t - 4]].forEach(function (lx) {
      var a = P(lx[0], Lo - 10, -TR.faceD), b = P(lx[1], Lo - 10, -TR.faceD), cc = P(lx[1], Lo - 10, hs), d = P(lx[0], Lo - 10, hs);
      var g = c.createLinearGradient(a.x, 0, b.x, 0);
      g.addColorStop(0, '#8E1208');
      g.addColorStop(0.5, '#B8190C');
      g.addColorStop(1, '#7A0F07');
      poly(c, [a, b, cc, d]);
      c.fillStyle = g;
      c.fill();
    });
    c.restore();
  }

  function drawTrayBody(c) {
    drawTableStand(c);
    var Wt = TB.width, L = TB.length, t = TR.rimT, rh = TR.rimH, lh = TR.lipH, Lo = L + TR.lipT, fd = TR.faceD;
    /* the soft shadow beneath (the shape is drawn far off and only its shadow lands here) */
    c.save();
    var off = 4000;
    c.shadowColor = 'rgba(96,36,4,0.42)';
    c.shadowBlur = 46 * view.s * view.dpr;
    c.shadowOffsetX = off * view.s * view.dpr;
    c.shadowOffsetY = 26 * view.s * view.dpr;
    var sh = [P(-t - 6, -t, -fd), P(Wt + t + 6, -t, -fd), P(Wt + t + 14, Lo + 10, -fd), P(-t - 14, Lo + 10, -fd)];
    c.translate(-off, 0);
    poly(c, sh);
    c.fillStyle = '#000';
    c.fill();
    c.restore();

    /* front face across the near end, with the side rims' ends */
    var face = [P(-t, Lo, rh), P(0, Lo, rh), P(0, Lo, lh), P(Wt, Lo, lh), P(Wt, Lo, rh), P(Wt + t, Lo, rh), P(Wt + t, Lo, -fd), P(-t, Lo, -fd)];
    var fy0 = P(0, Lo, rh).y, fy1 = P(0, Lo, -fd).y;
    var gf = c.createLinearGradient(0, fy0, 0, fy1);
    gf.addColorStop(0, '#E2311F');
    gf.addColorStop(0.55, '#C51E10');
    gf.addColorStop(1, '#93120A');
    poly(c, face);
    c.fillStyle = gf;
    c.fill();
    /* golden stripe along the front */
    poly(c, [P(-t, Lo, lh - 5), P(Wt + t, Lo, lh - 5), P(Wt + t, Lo, lh - 10), P(-t, Lo, lh - 10)]);
    c.fillStyle = COL.yellow;
    c.fill();

    /* the playing surface: glossy warm white */
    var a = P(0, 0, 0), b = P(Wt, 0, 0), cc = P(Wt, L, 0), d = P(0, L, 0);
    var gs = c.createLinearGradient(0, a.y, 0, d.y);
    gs.addColorStop(0, COL.surfaceFar);
    gs.addColorStop(0.5, '#FBF3E8');
    gs.addColorStop(1, COL.surfaceNear);
    poly(c, [a, b, cc, d]);
    c.fillStyle = gs;
    c.fill();
    c.save();
    poly(c, [a, b, cc, d]);
    c.clip();
    /* warm light pooling in the middle */
    var mid = P(Wt * 0.42, L * 0.38, 0);
    var gw = c.createRadialGradient(mid.x, mid.y, 0, mid.x, mid.y, 330);
    gw.addColorStop(0, 'rgba(255,238,205,0.75)');
    gw.addColorStop(1, 'rgba(255,238,205,0)');
    c.fillStyle = gw;
    c.fillRect(0, a.y - 20, W, d.y - a.y + 40);
    /* glossy sheen: one soft diagonal band */
    c.save();
    c.translate(W / 2, (a.y + d.y) / 2);
    c.rotate(-0.62);
    var gb = c.createLinearGradient(-90, 0, 90, 0);
    gb.addColorStop(0, 'rgba(255,255,255,0)');
    gb.addColorStop(0.5, 'rgba(255,255,255,0.55)');
    gb.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gb;
    c.fillRect(-90 + 70, -700, 180, 1400);
    var gb2 = c.createLinearGradient(-30, 0, 30, 0);
    gb2.addColorStop(0, 'rgba(255,255,255,0)');
    gb2.addColorStop(0.5, 'rgba(255,255,255,0.35)');
    gb2.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gb2;
    c.fillRect(-30 + 200, -700, 60, 1400);
    c.restore();
    drawTrayCues(c);
    /* the rims' soft shade on the surface */
    var s0 = P(0, 0, 0), s1 = P(0, 16, 0);
    var gfar = c.createLinearGradient(0, s0.y, 0, s1.y);
    gfar.addColorStop(0, 'rgba(150,40,10,0.20)');
    gfar.addColorStop(1, 'rgba(150,40,10,0)');
    c.fillStyle = gfar;
    poly(c, [P(0, 0, 0), P(Wt, 0, 0), P(Wt, 16, 0), P(0, 16, 0)]);
    c.fill();
    [[0, 12], [Wt, Wt - 12]].forEach(function (pr) {
      var e0 = P(pr[0], L * 0.5, 0), e1 = P(pr[1], L * 0.5, 0);
      var ge = c.createLinearGradient(e0.x, 0, e1.x, 0);
      ge.addColorStop(0, 'rgba(150,40,10,0.16)');
      ge.addColorStop(1, 'rgba(150,40,10,0)');
      c.fillStyle = ge;
      poly(c, [P(pr[0], 0, 0), P(pr[1], 0, 0), P(pr[1], L, 0), P(pr[0], L, 0)]);
      c.fill();
    });
    c.restore();

    /* far rim, inner face */
    var gr = c.createLinearGradient(0, P(0, 0, rh).y, 0, P(0, 0, 0).y);
    gr.addColorStop(0, '#E1301E');
    gr.addColorStop(1, '#B3180C');
    poly(c, [P(0, 0, 0), P(Wt, 0, 0), P(Wt, 0, rh), P(0, 0, rh)]);
    c.fillStyle = gr;
    c.fill();
    /* side rims, inner faces (light from the left: the right one is a touch darker) */
    var leftFace = [P(0, 0, 0), P(0, L, 0), P(0, L, lh), P(0, Lo, lh), P(0, Lo, rh), P(0, 0, rh)];
    var rightFace = [P(Wt, 0, 0), P(Wt, L, 0), P(Wt, L, lh), P(Wt, Lo, lh), P(Wt, Lo, rh), P(Wt, 0, rh)];
    var gl = c.createLinearGradient(0, P(0, 0, 0).y, 0, P(0, L, 0).y);
    gl.addColorStop(0, '#C9200F');
    gl.addColorStop(1, '#E3341F');
    poly(c, leftFace);
    c.fillStyle = gl;
    c.fill();
    var grt = c.createLinearGradient(0, P(0, 0, 0).y, 0, P(0, L, 0).y);
    grt.addColorStop(0, '#B71A0D');
    grt.addColorStop(1, '#D02613');
    poly(c, rightFace);
    c.fillStyle = grt;
    c.fill();

    /* the lip across the near end */
    poly(c, [P(0, L, lh), P(Wt, L, lh), P(Wt, Lo, lh), P(0, Lo, lh)]);
    c.fillStyle = '#E33522';
    c.fill();

    /* rim tops: one U around the far end and both sides */
    var top = [P(-t, Lo, rh), P(-t, -t, rh), P(Wt + t, -t, rh), P(Wt + t, Lo, rh), P(Wt, Lo, rh), P(Wt, 0, rh), P(0, 0, rh), P(0, Lo, rh)];
    var gt = c.createLinearGradient(0, P(0, -t, rh).y, 0, P(0, Lo, rh).y);
    gt.addColorStop(0, '#E8402B');
    gt.addColorStop(1, '#EC4A33');
    poly(c, top);
    c.fillStyle = gt;
    c.fill();
    /* golden-yellow trim on the inner edge of the rims and along the lip */
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.strokeStyle = COL.yellow;
    c.lineWidth = 3.2;
    c.beginPath();
    var p0 = P(0, Lo, rh), p1 = P(0, 0, rh), p2 = P(Wt, 0, rh), p3 = P(Wt, Lo, rh);
    c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.lineTo(p2.x, p2.y); c.lineTo(p3.x, p3.y);
    c.stroke();
    var l0 = P(0, L, lh), l1 = P(Wt, L, lh);
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(l0.x, l0.y); c.lineTo(l1.x, l1.y);
    c.stroke();
    /* a thin highlight on the outer edge */
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.lineWidth = 1.5;
    var o0 = P(-t, Lo, rh), o1 = P(-t, -t, rh), o2 = P(Wt + t, -t, rh), o3 = P(Wt + t, Lo, rh);
    c.beginPath();
    c.moveTo(o0.x, o0.y); c.lineTo(o1.x, o1.y); c.lineTo(o2.x, o2.y); c.lineTo(o3.x, o3.y);
    c.stroke();
    c.beginPath();
    c.moveTo(o0.x, o0.y); c.lineTo(o3.x, o3.y);
    c.stroke();
  }

  /* ?align=1: the physics tray over the picture (surface, rim inner and outer edges, the launch line) */
  function drawAlign(c) {
    var Wt = TB.width, L = TB.length, t = TR.rimT, Lo = L + TR.lipT;
    c.save();
    c.lineWidth = 2;
    c.strokeStyle = '#00E5FF';
    poly(c, [P(0, 0, 0), P(Wt, 0, 0), P(Wt, L, 0), P(0, L, 0)]);
    c.stroke();
    c.strokeStyle = '#FF2BD6';
    c.setLineDash([6, 4]);
    poly(c, [P(-t, -t, TR.rimH), P(Wt + t, -t, TR.rimH), P(Wt + t, Lo, TR.rimH), P(-t, Lo, TR.rimH)]);
    c.stroke();
    poly(c, [P(0, 0, TR.rimH), P(Wt, 0, TR.rimH), P(Wt, Lo, TR.rimH), P(0, Lo, TR.rimH)]);
    c.stroke();
    c.setLineDash([]);
    c.strokeStyle = '#39FF14';
    var l0 = P(0, TB.launchLineY, 0), l1 = P(Wt, TB.launchLineY, 0);
    c.beginPath(); c.moveTo(l0.x, l0.y); c.lineTo(l1.x, l1.y); c.stroke();
    c.restore();
  }

  function buildStatic() {
    staticLayer.width = canvas.width;
    staticLayer.height = canvas.height;
    var c = staticLayer.getContext('2d');
    gameTransform(c);
    drawScene(c);
    drawTray(c);
    if (DEBUG) {
      c.strokeStyle = 'rgba(0,0,0,0.25)';
      c.lineWidth = 1;
      for (var gx = 0; gx <= TB.width; gx += 50) {
        var p0 = P(gx, 0, 0), p1 = P(gx, TB.length, 0);
        c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke();
      }
      for (var gy = 0; gy <= TB.length; gy += 50) {
        var q0 = P(0, gy, 0), q1 = P(TB.width, gy, 0);
        c.beginPath(); c.moveTo(q0.x, q0.y); c.lineTo(q1.x, q1.y); c.stroke();
      }
    }
    staticDirty = false;
  }

  /* ---------- input: drag along the near edge to aim, release to slide ---------- */
  var dragging = false;
  var SOUND_BTN = { x: HUD.next.x + HUD.next.w - 20, y: HUD.next.y + HUD.band / 2, r: 12 };

  function aimFromScreen(p) {
    game.aim(PJ.tableXAt(p.x, TB.heldY));
  }

  canvas.addEventListener('pointerdown', function (ev) {
    ev.preventDefault();
    if (!ready) return;
    Sound.init();
    var p = toGame(ev);
    var dx = p.x - SOUND_BTN.x, dy = p.y - SOUND_BTN.y;
    if (!overlay && dx * dx + dy * dy <= (SOUND_BTN.r + 10) * (SOUND_BTN.r + 10)) { Sound.toggle(); return; }
    if (overlay) {
      for (var i = 0; i < buttons.length; i++) {
        var b = buttons[i];
        if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { b.fn(); return; }
      }
      return;
    }
    if (demo) endDemo();
    if (BOT || game.state !== 'play') return;
    try { canvas.setPointerCapture(ev.pointerId); } catch (e) { }
    dragging = true;
    if (hintOn) hintOut = nowS();
    hintOn = false;
    game.touch();
    aimFromScreen(p);
  });

  canvas.addEventListener('pointermove', function (ev) {
    if (dragging) aimFromScreen(toGame(ev));
  });

  canvas.addEventListener('pointerup', function (ev) {
    if (!dragging) return;
    dragging = false;
    aimFromScreen(toGame(ev));
    if (!game.launch() && game.state === 'play' && game.held == null && game.cooldown < 0.25) queuedLaunch = true;
  });
  canvas.addEventListener('pointercancel', function () { dragging = false; });

  /* ---------- effects ---------- */
  var MAX_PARTS = 110;

  function addPart(p) {
    if (parts.length >= MAX_PARTS) parts.shift();
    parts.push(p);
  }

  /*
    The merge splash starts on the merge frame itself (the core event fires in the step that swaps the drinks). It is
    anchored at the new drink's footprint centre on the table, its width tied to the footprint and its height flattened
    by the perspective there, and it is drawn in the depth sort just behind the new drink, so the cup stays in front.
    Liquid droplets fly along the table plane on short arcs in front of it. All timing in game time (?speed slows it).
  */
  var splashes = [];
  var drops = [];
  var TINT = {
    clear: ['rgba(214,236,255,0.95)', 'rgba(255,255,255,0.95)'],
    orange: ['rgba(255,163,26,0.95)', 'rgba(255,214,120,0.95)'],
    pink: ['rgba(238,86,128,0.95)', 'rgba(255,170,195,0.95)']
  };

  function onMerge(data) {
    if (window.__pauseOnMerge) { window.__pause = true; window.__pauseOnMerge = false; }
    var tier = data.tier;
    var t = game.time;
    /* coloured by what merged (the two drinks of the tier below) */
    var kind = TH.splashByTier[tier - 2] || 'clear';
    splashes.push({ x: data.x, y: data.y, tier: tier, kind: kind, t0: t });
    var r = CONFIG.tiers[tier - 1].r;
    var n = 8;
    for (var i = 0; i < n; i++) {
      var ang = (i + Math.random() * 0.6) / n * Math.PI * 2;
      var sp = 90 + Math.random() * 70;
      drops.push({
        x: data.x + Math.cos(ang) * r * 0.8, y: data.y + Math.sin(ang) * r * 0.8, h: 4,
        vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, vh: 140 + Math.random() * 70,
        size: 3 + Math.random() * 2.5, kind: kind, t0: t, dur: 0.32 + Math.random() * 0.06
      });
    }
    if (drops.length > 80) drops.splice(0, drops.length - 80);
    floorFx.push({ x: data.x, y: data.y, r: r, t0: nowS(), dur: 0.4 });
    Sound.play('pop', tier);
    if (tier >= 5) {
      var q = PJ.toScreen(data.x, data.y);
      bump.t0 = nowS();
      bump.amp = 0.006 + (tier - 5) * 0.004;
      bump.x = q.x;
      bump.y = q.y;
    }
  }

  /* one splash: 0.6 -> 1.15 in 90 ms, then it falls back and fades by 340 ms */
  function drawSplash(c, sp) {
    var k = game.time - sp.t0;
    if (k < 0 || k > 0.34) return;
    var img = IMG.fx.splash[sp.kind];
    if (!img) return;
    var q = PJ.toScreen(sp.x, sp.y);
    var r = CONFIG.tiers[sp.tier - 1].r;
    var grow = k < 0.09 ? 0.6 + 0.55 * easeOutCubic(k / 0.09) : 1.15 - 0.2 * ((k - 0.09) / 0.25);
    var fall = k < 0.09 ? 1 : 1 - 0.45 * ((k - 0.09) / 0.25);
    var alpha = k < 0.09 ? 0.9 : 0.9 * (1 - (k - 0.09) / 0.25);
    var w = 2 * r * q.s * 1.6 * grow;
    var flat = Math.max(0.55, Math.min(1, q.sy / q.s));
    var h = w * img.naturalHeight / img.naturalWidth * flat * fall;
    c.save();
    c.globalAlpha = Math.max(0, alpha);
    /* the crown's foot ring (about 12% of its height above the picture's bottom) on the footprint centre */
    c.drawImage(img, q.x - w / 2, q.y - h * 0.88, w, h);
    c.restore();
  }

  function drawDrops(c, dt) {
    for (var i = drops.length - 1; i >= 0; i--) {
      var d = drops[i];
      var k = (game.time - d.t0) / d.dur;
      if (k >= 1 || d.h < 0) { drops.splice(i, 1); continue; }
      if (k < 0) continue;
      var gdt = dt * SPEED;
      d.x += d.vx * gdt;
      d.y += d.vy * gdt;
      d.vh -= 900 * gdt;
      d.h += d.vh * gdt;
      var q = PJ.toScreen(d.x, d.y);
      var py = q.y - d.h * q.s;
      var sz = d.size * q.s * (1 - 0.3 * k);
      var col = TINT[d.kind] || TINT.clear;
      c.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
      c.fillStyle = col[0];
      c.beginPath(); c.ellipse(q.x, py, sz, sz * 1.15, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = col[1];
      c.beginPath(); c.arc(q.x - sz * 0.3, py - sz * 0.35, sz * 0.35, 0, Math.PI * 2); c.fill();
    }
    c.globalAlpha = 1;
  }

  /* seven equal cells with equal gaps inside the strip's padding (the plate's lower edge, 4 px, is below them) */
  function stripCells() {
    var S = HUD.strip, n = CONFIG.tiers.length, pad = HUD.stripPad, gap = HUD.stripGap;
    var cw = (S.w - 2 * pad - (n - 1) * gap) / n, ch = S.h - 4 - 2 * pad + 2;
    var out = [];
    for (var i = 0; i < n; i++) out.push({ x: S.x + pad + i * (cw + gap), y: S.y + pad - 1, w: cw, h: ch });
    return out;
  }
  function stripCell(tier) {
    var C = stripCells()[tier - 1];
    return { x: C.x + C.w / 2, y: C.y + C.h / 2 };
  }

  function onFirst(data) {
    var tier = data.tier;
    var t = nowS();
    var b = game.drinks.length ? game.drinks[game.drinks.length - 1] : null;
    var src = b && b.plugin.tier === tier ? drinkBox(tier, b.position.x, b.position.y, 1) : { x: W / 2, y: 500, h: 120 };
    for (var i = 0; i < 9; i++) {
      var a = i / 9 * Math.PI * 2;
      addPart({
        type: 'spark', img: IMG.fx.sparkles[i % 3], x: src.x + Math.cos(a) * 30, y: src.y - src.h * 0.55 + Math.sin(a) * 30,
        vx: Math.cos(a) * 120, vy: Math.sin(a) * 120 - 40, size: 22 + (i % 3) * 8, t0: t + i * 0.025, dur: 0.75
      });
    }
    if (tier !== HERO) {
      /* one callout at a time: a newer first-make replaces it, and the one replaced simply lights its cell */
      if (callout && callout.tier !== tier) { litShown[callout.tier] = true; litPulse[callout.tier] = t; }
      callout = { tier: tier, body: b && b.plugin.tier === tier ? b : null, x: b ? b.position.x : TB.width / 2, y: b ? b.position.y : 150, t0: game.time };
    } else { litShown[tier] = true; litPulse[tier] = t; }
    Sound.play('sparkle');
  }

  /*
    The first-make callout, tied to the new drink: the shout ("Zing!") big in outlined Speedee, the drink's name in a
    small tag under it, just above the cup. It never enters the top HUD row (8 px clear), keeps inside the side margins
    and stays above the launch line (so off the waiting drink). With no room above a far drink it sits beside it, or
    just under the HUD row. Life: pop 0.12 s, hold to 1.0 s, then it shrinks and flies to its menu cell, which lights.
  */
  var callout = null;
  var CO_FLY0 = 1.0, CO_END = 1.45;

  function drawCallout(c) {
    /* the core only appends its effects; drop the ones that are over */
    for (var j = game.fx.length - 1; j >= 0; j--) {
      if (game.time - game.fx[j].t0 > game.fx[j].dur) game.fx.splice(j, 1);
    }
    if (!callout || demo || hudTime() < 0) return;
    var co = callout;
    var k = game.time - co.t0;
    if (co.body && !co.body.plugin.dead) { co.x = co.body.position.x; co.y = co.body.position.y; }
    if (k >= CO_END) {
      litShown[co.tier] = true;
      litPulse[co.tier] = nowS();
      callout = null;
      return;
    }
    var shout = (CONFIG.words.shouts || [])[co.tier - 1] || '';
    var name = CONFIG.tiers[co.tier - 1].name;
    var ssz = 30, nsz = 16;
    var sw = measureRich(c, shout, ssz, 700) + 14;
    var tw = measureRich(c, name, nsz, 700) + 18, th = 26;
    var cw = Math.max(sw, tw), ch = ssz * 0.8 + 8 + th;
    var bx = drinkBox(co.tier, co.x, co.y, 1);
    var top = bx.y - bx.h;
    var cx = bx.x, cy = top - 6 - ch / 2;
    var hudBottom = HUD.order.y + HUD.order.h + 8;
    var lineY = P(0, TB.launchLineY, 0).y;
    if (cy - ch / 2 < hudBottom) {
      /* no room above: beside the drink, on the side with more room */
      var side = bx.x < W / 2 ? 1 : -1;
      var sx = bx.x + side * (bx.w / 2 + cw / 2 + 8);
      if (sx - cw / 2 >= HUD.M && sx + cw / 2 <= W - HUD.M) { cx = sx; cy = Math.max(hudBottom + ch / 2, bx.y - bx.h * 0.55); }
      else cy = hudBottom + ch / 2;
    }
    cy = Math.min(cy, lineY - 4 - ch / 2);
    cx = Math.max(HUD.M + cw / 2, Math.min(W - HUD.M - cw / 2, cx));
    var sc = k < 0.12 ? 0.6 + 0.4 * easeOutBack(k / 0.12) : 1, al = 1;
    if (k > CO_FLY0) {
      var fk = easeInOut((k - CO_FLY0) / (CO_END - CO_FLY0));
      var to = stripCell(co.tier);
      cx = cx + (to.x - cx) * fk;
      cy = cy + (to.y - cy) * fk - Math.sin(fk * Math.PI) * 50;
      sc = 1 - 0.65 * fk;
      al = 1 - 0.3 * fk;
    }
    c.save();
    c.globalAlpha *= al;
    c.translate(cx, cy);
    c.scale(sc, sc);
    var sy = -ch / 2 + ssz * 0.4;
    /* the shout: white, red outline, a soft shadow */
    c.lineJoin = 'round';
    c.lineWidth = 8;
    c.strokeStyle = 'rgba(70,20,5,0.3)';
    fillCap(c, shout, 0, sy + 3, ssz, 700, 'center', true);
    c.strokeStyle = COL.red;
    fillCap(c, shout, 0, sy, ssz, 700, 'center', true);
    c.fillStyle = '#FFFFFF';
    fillCap(c, shout, 0, sy, ssz, 700, 'center');
    /* the name tag */
    var ty = ch / 2 - th / 2;
    plate(c, { x: -tw / 2, y: ty - th / 2, w: tw, h: th + 4 }, 'red', 13);
    c.fillStyle = '#FFFFFF';
    fillRich(c, name, 0, ty, nsz, 700, 'center');
    c.restore();
  }

  function updateLit() {
    var t = nowS();
    for (var tier = 1; tier <= CONFIG.tiers.length; tier++) {
      if (!game.lit[tier] || litShown[tier]) continue;
      var waiting = flyers.some(function (f) { return f.tier === tier; }) || (callout && callout.tier === tier);
      if (waiting || game.made[tier]) {
        if (!waiting && game.made[tier]) { litShown[tier] = true; litPulse[tier] = t; }
        continue;
      }
      litShown[tier] = true;
      litPulse[tier] = t;
    }
  }

  function drawFloorFx(c) {
    var t = nowS();
    for (var i = floorFx.length - 1; i >= 0; i--) {
      var f = floorFx[i];
      var k = (t - f.t0) / f.dur;
      if (k >= 1) { floorFx.splice(i, 1); continue; }
      if (k < 0) continue;
      var q = PJ.toScreen(f.x, f.y);
      var rad = f.r * (1 + easeOutCubic(k) * 0.9);
      c.save();
      c.globalAlpha = (1 - k) * 0.9;
      c.strokeStyle = k < 0.4 ? '#FFFFFF' : COL.yellow;
      c.lineWidth = 6 * (1 - k) + 1.5;
      c.beginPath();
      var FF = footEllipse(f.x, f.y, rad);
      c.ellipse(FF.cx, FF.cy, FF.rx, FF.ry, 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
  }

  function drawParts(c, dt) {
    var t = nowS();
    for (var i = parts.length - 1; i >= 0; i--) {
      var p = parts[i];
      var k = (t - p.t0) / p.dur;
      if (k >= 1) { parts.splice(i, 1); continue; }
      if (k < 0) continue;
      if (p.type === 'splash') {
        var sc = 0.45 + 0.65 * easeOutCubic(Math.min(1, k * 1.6));
        var w = p.w * sc, h = w * p.img.naturalHeight / p.img.naturalWidth;
        c.save();
        c.globalAlpha = k < 0.55 ? 1 : (1 - k) / 0.45;
        c.drawImage(p.img, p.x - w / 2, p.y - h * 0.86, w, h);
        c.restore();
      } else if (p.type === 'bit') {
        p.vy += p.g * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (!p.img) continue;
        var s = p.size * (1 - 0.3 * k);
        c.save();
        c.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
        c.translate(p.x, p.y);
        c.rotate(p.rot);
        c.drawImage(p.img, -s / 2, -s / 2 * p.img.naturalHeight / p.img.naturalWidth, s, s * p.img.naturalHeight / p.img.naturalWidth);
        c.restore();
      } else if (p.type === 'spark') {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.94;
        p.vy *= 0.94;
        if (!p.img) continue;
        var ss = p.size * Math.sin(Math.PI * Math.min(1, k * 1.15));
        c.save();
        c.translate(p.x, p.y);
        c.rotate(k * 1.2);
        c.drawImage(p.img, -ss / 2, -ss / 2, ss, ss);
        c.restore();
      }
    }
  }

  /* ---------- drinks on the table ---------- */
  function popScale(pl) {
    if (pl.popT < 0) return 1;
    var k = Math.min(1, (game.time - pl.popT) / CONFIG.timings.pop);
    return 0.6 + 0.4 * easeOutBack(k);
  }

  function squash(pl) {
    if (!pl.sqT) return 0;
    var k = (nowS() - pl.sqT) / 0.2;
    if (k >= 1) return 0;
    return pl.sqA * Math.sin(k * Math.PI) * (1 - k);
  }

  /*
    A drink's shadow on the table plane, in the table's own perspective: drawn in table units through the local
    projection at the base (s across, sy along the table), so its circles come out as ellipses flattened by the camera's
    foreshortening at that depth. One light for every drink: the cast part falls along TH.shadowDir.
    ox, oy: the base centre on screen; r: footprint radius in table units.
  */
  var SH_ANG = Math.atan2(TH.shadowDir.y, TH.shadowDir.x);

  /*
    The footprint circle of radius r at table (x, y) as the camera sees it: centre = the projected (x, y); horizontal
    radius = half the screen distance between (x - r, y) and (x + r, y); vertical radius = half that between (x, y - r)
    and (x, y + r). Every ring, disc and shadow on the table uses this, so they all agree with the cup's base.
  */
  /*
    This camera stretches depth near the player (its depth scale there is about 1.5 times its width scale), which
    would make a footprint circle at the front taller than wide. The cup pictures show their base as a shallow
    ellipse, so the flattening follows the pictures: TH.ringFlat at the front edge, getting flatter up the table in
    the camera's own proportion (ry / rx at depth y over ry / rx at the front).
  */
  var FLAT_NEAR = (function () {
    var a0 = PJ.toScreen(TB.width / 2, TB.length);
    return a0.sy / a0.s;
  })();
  function footEllipse(x, y, r) {
    var c0 = PJ.toScreen(x, y), l = PJ.toScreen(x - r, y), rt = PJ.toScreen(x + r, y), f = PJ.toScreen(x, y - r), n = PJ.toScreen(x, y + r);
    var rx = Math.abs(rt.x - l.x) / 2, ryP = Math.abs(n.y - f.y) / 2;
    var flat = (TH.ringFlat || 0.42) * (ryP / rx) / FLAT_NEAR;
    return { cx: c0.x, cy: c0.y, rx: rx, ry: rx * flat };
  }
  function drawCastShadow(c, ox, oy, r, s, sy, alpha) {
    c.save();
    if (alpha != null) c.globalAlpha *= alpha;
    c.translate(ox, oy);
    c.transform(s, 0, 0, sy, 0, 0);
    c.rotate(SH_ANG);
    /* cast part: the footprint pushed 0.32 r along the light, 1.22 x 1.12 of it; contact part: 0.95 of the footprint */
    var a = r * 1.22, b = r * 1.12, d = r * 0.32;
    c.drawImage(SPR.shCast, d - a, -b, a * 2, b * 2);
    var rc = r * 0.95;
    c.drawImage(SPR.shCore, -rc, -rc, rc * 2, rc * 2);
    c.restore();
  }

  /* all table shadows of a frame go into this layer first */
  var SH_A = 0.32;
  var shadowLayer = document.createElement('canvas');
  function beginShadows(c) {
    if (shadowLayer.width !== canvas.width || shadowLayer.height !== canvas.height) {
      shadowLayer.width = canvas.width;
      shadowLayer.height = canvas.height;
    }
    var sc = shadowLayer.getContext('2d');
    sc.setTransform(1, 0, 0, 1, 0, 0);
    sc.clearRect(0, 0, shadowLayer.width, shadowLayer.height);
    sc.setTransform(c.getTransform());
    return sc;
  }
  function endShadows(c) {
    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = SH_A;
    c.drawImage(shadowLayer, 0, 0);
    c.restore();
  }

  /* the base centre of a drink picture on screen: the photo's base ellipse sits a little above its bottom edge */
  function baseCentreY(bottomY, w) { return bottomY - TH.baseLift * w; }

  function tableClip(c) {
    poly(c, [P(0, 0, 0), P(TB.width, 0, 0), P(TB.width, TB.length, 0), P(0, TB.length, 0)]);
    c.clip();
  }

  function collectDrawList() {
    var list = [];
    for (var i = 0; i < game.drinks.length; i++) {
      var b = game.drinks[i];
      list.push({ tier: b.plugin.tier, x: b.position.x, y: b.position.y, pl: b.plugin, body: b });
    }
    if (game.state === 'play' && game.held) {
      if (lastHeld !== game.held) { heldPopT = nowS(); lastHeld = game.held; }
      var k = Math.min(1, (nowS() - heldPopT) / 0.18);
      var breathe = FX ? 1 + 0.015 * Math.sin(nowS() * 3.2) : 1;
      list.push({ tier: game.held, x: game.aimX, y: TB.heldY, held: true, ps: (0.6 + 0.4 * easeOutBack(k)) * breathe });
    } else if (!game.held) {
      lastHeld = null;
    }
    for (var j = splashes.length - 1; j >= 0; j--) {
      if (game.time - splashes[j].t0 > 0.34) { splashes.splice(j, 1); continue; }
      list.push({ splash: splashes[j], y: splashes[j].y - 0.01, tier: splashes[j].tier, x: splashes[j].x });
    }
    list.sort(function (a, b) { return a.y - b.y; });
    return list;
  }

  function drawDrinks(c, list) {
    var i, e, bx;
    /* reflections on the glossy tray */
    c.save();
    tableClip(c);
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (e.splash) continue;
      var ps = e.held ? e.ps : popScale(e.pl);
      bx = drinkBox(e.tier, e.x, e.y, ps);
      e.bx = bx;
      var rf = IMG.refl[e.tier - 1];
      if (rf) c.drawImage(rf, bx.x - bx.w / 2, bx.y - bx.h * 0.02, bx.w, bx.h);
    }
    c.restore();
    drawFloorFx(c);
    var gk = demoGlow();
    if (gk > 0) {
      for (i = 0; i < list.length; i++) {
        e = list[i];
        if (!(e.held || (demo.target && e.body === demo.target))) continue;
        var gq = PJ.toScreen(e.x, e.y), grr = e.bx.r * 1.9;
        c.save();
        c.globalAlpha = gk;
        c.drawImage(SPR.goldGlow, gq.x - grr * gq.s, gq.y - grr * gq.sy, grr * gq.s * 2, grr * gq.sy * 2);
        c.restore();
      }
    }
    /* cast shadows on the table plane */
    var shc = beginShadows(c);
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (e.splash) continue;
      bx = e.bx;
      var FE = footEllipse(e.x, e.y, bx.r);
      drawCastShadow(shc, FE.cx, FE.cy, bx.r, FE.rx / bx.r, FE.ry / bx.r);
    }
    endShadows(c);
    /* danger rings under drinks that rest over the line */
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (e.splash || e.held || !e.pl || !(e.pl.overT > 0)) continue;
      drawDangerRing(c, e);
    }
    /* the launcher pad under the waiting drink, the aim, then the drinks far to near */
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (e.held) drawPadAndAim(c, e);
    }
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (e.splash) { drawSplash(c, e.splash); continue; }
      bx = e.bx;
      drawPic(c, e.tier, bx.x, bx.y, bx.w, 1, e.pl ? squash(e.pl) : 0);
    }
    if (DEBUG) {
      for (i = 0; i < list.length; i++) {
        e = list[i];
        if (e.splash) continue;
        var q = PJ.toScreen(e.x, e.y);
        var r = e.body ? game.radiusOf(e.body) : CONFIG.tiers[e.tier - 1].r;
        c.save();
        c.strokeStyle = e.body ? (e.body.isSleeping ? 'rgba(0,160,0,0.9)' : 'rgba(230,0,0,0.9)') : 'rgba(0,0,255,0.9)';
        c.lineWidth = 1.5;
        c.beginPath();
        c.ellipse(q.x, q.y, r * q.s, r * q.sy, 0, 0, Math.PI * 2);
        c.stroke();
        c.restore();
      }
    }
  }

  function drawDangerRing(c, e) {
    var k = Math.min(1, e.pl.overT / CONFIG.timings.failHold);
    var bx = e.bx;
    var r = baseRingR(bx.r);
    var DE = footEllipse(e.x, e.y, r);
    var q = { x: DE.cx, y: DE.cy, s: DE.rx / r, sy: DE.ry / r };
    var pulse = 0.5 + 0.5 * Math.sin(nowS() * 12);
    c.save();
    c.globalAlpha = 0.55 + 0.35 * pulse;
    c.drawImage(SPR.redGlow, q.x - DE.rx * 1.5, q.y - DE.ry * 1.5, DE.rx * 3, DE.ry * 3);
    c.globalAlpha = 1;
    c.lineWidth = 4;
    c.strokeStyle = 'rgba(255,255,255,0.85)';
    c.beginPath();
    c.ellipse(q.x, q.y, r * q.s, r * q.sy, 0, 0, Math.PI * 2);
    c.stroke();
    /* the time left drains anticlockwise from full */
    c.strokeStyle = COL.red;
    c.lineCap = 'round';
    c.lineWidth = 4;
    c.beginPath();
    c.ellipse(q.x, q.y, r * q.s, r * q.sy, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.02, 1 - k));
    c.stroke();
    c.restore();
  }

  function g_radius(body) { return game.radiusOf(body); }

  /* an ellipse lying on the table at (x, y), radius r in table units (the footprint as the camera sees it) */
  function tableEllipse(c, x, y, r) {
    var E = footEllipse(x, y, r);
    c.beginPath();
    c.ellipse(E.cx, E.cy, E.rx, E.ry, 0, 0, Math.PI * 2);
    return { x: E.cx, y: E.cy, s: E.rx / r, sy: E.ry / r, rx: E.rx, ry: E.ry };
  }

  /* a highlight ring round a cup: the drawn base (0.74 of the rim) x 1.25, in footprint units */
  function baseRingR(r) { return r * K * 0.74 * 1.25; }

  function drawPadAndAim(c, e) {
    var tier = e.tier;
    var r = CONFIG.tiers[tier - 1].r;
    var x = e.x;
    var hit = game.firstHit(x, r);
    var match = hit.body && hit.body.plugin.tier === tier;
    var t = nowS();
    var y0 = TB.heldY - r, y1 = hit.y;
    var gold = 'rgba(255,199,44,', white = 'rgba(255,255,255,';
    var tint = match ? gold : white;
    if (y1 < y0 - 4) {
      c.save();
      tableClip(c);
      /* the lane: a soft strip the width of the footprint, in the table's perspective */
      var la = P(x - r, y0, 0), lb = P(x + r, y0, 0), lc = P(x + r, y1, 0), ld = P(x - r, y1, 0);
      var lg = c.createLinearGradient(0, la.y, 0, ld.y);
      lg.addColorStop(0, tint + (match ? '0.30)' : '0.26)'));
      lg.addColorStop(1, tint + (match ? '0.16)' : '0.08)'));
      poly(c, [la, lb, lc, ld]);
      c.fillStyle = lg;
      c.fill();
      c.lineWidth = 1.5;
      c.strokeStyle = match ? 'rgba(242,169,0,0.55)' : 'rgba(218,41,28,0.22)';
      c.beginPath(); c.moveTo(la.x, la.y); c.lineTo(ld.x, ld.y); c.moveTo(lb.x, lb.y); c.lineTo(lc.x, lc.y); c.stroke();
      /* chevrons flowing away from the player along the centre line */
      var gap = 26, flow = (t * 70) % gap;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      for (var yy = y0 - 10 - flow; yy > y1 + r * 0.6; yy -= gap) {
        var kk = (y0 - yy) / Math.max(1, y0 - y1);
        var w = Math.min(9, r * 0.42);
        var ca = P(x - w, yy + w * 0.7, 0), cb = P(x, yy, 0), cc = P(x + w, yy + w * 0.7, 0);
        c.globalAlpha = 0.9 - 0.5 * kk;
        c.lineWidth = 3.2;
        c.strokeStyle = match ? COL.yellowDeep : COL.red;
        c.beginPath(); c.moveTo(ca.x, ca.y); c.lineTo(cb.x, cb.y); c.lineTo(cc.x, cc.y); c.stroke();
      }
      c.globalAlpha = 1;
      /* the landing marker: the footprint where it will meet the pile, pulsing */
      var pul = 1 + 0.06 * Math.sin(t * 6);
      var lq = tableEllipse(c, x, y1, baseRingR(r) * pul);
      c.fillStyle = tint + (match ? '0.30)' : '0.18)');
      c.fill();
      c.lineWidth = 3;
      c.strokeStyle = match ? COL.yellow : 'rgba(218,41,28,0.7)';
      c.stroke();
      tableEllipse(c, x, y1, baseRingR(r) * pul * 0.62);
      c.lineWidth = 1.5;
      c.strokeStyle = match ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.6)';
      c.stroke();
      c.restore();
      /* the matching drink: a soft gold ring round its footprint */
      if (match) {
        c.save();
        var mr = baseRingR(g_radius(hit.body)) * (1 + 0.05 * Math.sin(t * 6));
        var ME = footEllipse(hit.body.position.x, hit.body.position.y, mr);
        c.drawImage(SPR.goldGlow, ME.cx - ME.rx * 1.5, ME.cy - ME.ry * 1.5, ME.rx * 3, ME.ry * 3);
        tableEllipse(c, hit.body.position.x, hit.body.position.y, mr);
        c.lineWidth = 3;
        c.strokeStyle = COL.yellow;
        c.stroke();
        c.restore();
      }
    }
    /* the launcher pad: a subtle gold disc with a turning dashed ring */
    var pq = PJ.toScreen(x, TB.heldY);
    var pr = baseRingR(r);
    var PE = footEllipse(x, TB.heldY, pr);
    c.save();
    tableClip(c);
    var gp = c.createRadialGradient(pq.x, pq.y, 0, pq.x, pq.y, PE.rx);
    gp.addColorStop(0, 'rgba(255,224,138,0.75)');
    gp.addColorStop(0.75, 'rgba(255,199,44,0.6)');
    gp.addColorStop(1, 'rgba(242,169,0,0.35)');
    c.save();
    c.translate(PE.cx, PE.cy);
    c.scale(1, PE.ry / PE.rx);
    c.translate(-PE.cx, -PE.cy);
    c.fillStyle = gp;
    c.beginPath();
    c.ellipse(PE.cx, PE.cy, PE.rx, PE.rx, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();
    tableEllipse(c, x, TB.heldY, pr * 1.12);
    c.setLineDash([9, 7]);
    c.lineDashOffset = -t * 22;
    c.lineCap = 'round';
    c.lineWidth = 2.5;
    c.strokeStyle = 'rgba(218,41,28,0.75)';
    c.stroke();
    c.setLineDash([]);
    c.restore();
    c.save();
    /* small arrows either side: drag to aim */
    if (!BOT && game.launches < 3) {
      var ax = pr * pq.s + 16;
      var wob = Math.sin(nowS() * 4) * 3;
      c.fillStyle = 'rgba(218,41,28,0.85)';
      [-1, 1].forEach(function (sgn) {
        var bx0 = pq.x + sgn * (ax + wob);
        c.beginPath();
        c.moveTo(bx0 + sgn * 10, pq.y);
        c.lineTo(bx0, pq.y - 8);
        c.lineTo(bx0, pq.y + 8);
        c.closePath();
        c.fill();
      });
    }
    c.restore();
  }

  /* the dashed launch line, and the danger state on the player's side */
  function drawLine(c) {
    var danger = game.state === 'play' ? game.dangerLevel() : (failAt > 0 ? 1 : 0);
    if (danger > 0 && !dangerHint.shown && !demo && game.state === 'play') { dangerHint.shown = true; dangerHint.t0 = game.time; window.__dangerHint = dangerHint; }
    var Wt = TB.width, L = TB.length;
    var l0 = P(0, TB.launchLineY, 0), l1 = P(Wt, TB.launchLineY, 0);
    var t = nowS();
    if (danger > 0) {
      var pulse = 0.5 + 0.5 * Math.sin(t * (8 + danger * 8));
      c.save();
      poly(c, [l0, l1, P(Wt, L, 0), P(0, L, 0)]);
      var gz = c.createLinearGradient(0, l0.y, 0, P(0, L, 0).y);
      gz.addColorStop(0, 'rgba(218,41,28,' + (0.10 + 0.12 * pulse * (0.5 + danger / 2)) + ')');
      gz.addColorStop(1, 'rgba(218,41,28,0.02)');
      c.fillStyle = gz;
      c.fill();
      c.restore();
    }
    c.save();
    c.lineCap = 'round';
    c.setLineDash([14, 12]);
    c.lineDashOffset = -t * 18;
    c.lineWidth = danger > 0 ? 6 : 5;
    c.strokeStyle = '#FFFFFF';
    c.beginPath();
    c.moveTo(l0.x + 8, l0.y);
    c.lineTo(l1.x - 8, l1.y);
    c.stroke();
    c.lineWidth = danger > 0 ? 3.6 : 2.8;
    c.strokeStyle = danger > 0 ? COL.red : 'rgba(218,41,28,0.75)';
    c.stroke();
    c.restore();
  }

  /* ---------- interface ---------- */
  function shadowedPlate(c, x, y, w, h, r, fill) {
    c.save();
    c.fillStyle = 'rgba(90,20,4,0.22)';
    rr(c, x, y + 4, w, h, r);
    c.fill();
    c.fillStyle = fill;
    rr(c, x, y, w, h, r);
    c.fill();
    c.restore();
  }

  /*
    One plate family for the whole HUD: radius 18, a soft drop shadow, a body with a soft highlight along its top and a
    darker lower edge (depth), and a 2 px keyline. Cards: white body, gold keyline. Arches: red body, gold keyline.
    Menu strip: golden body, white keyline.
  */
  var PLATE = {
    white: { top: '#FFFFFF', bottom: '#FBF4EA', edge: '#E3D3BE', key: COL.yellow },
    red: { top: '#E5331F', bottom: '#C81F10', edge: '#9C150A', key: COL.yellow },
    gold: { top: '#FFD957', bottom: '#FFC72C', edge: '#D99A00', key: '#FFFFFF' }
  };

  function plate(c, R, kind, radius) {
    var k = PLATE[kind], r = radius == null ? HUD.radius : radius;
    var x = R.x, y = R.y, w = R.w, h = R.h;
    c.save();
    /* drop shadow: two soft layers */
    c.fillStyle = 'rgba(80,20,4,0.16)';
    rr(c, x - 1, y + 3, w + 2, h + 6, r + 1);
    c.fill();
    c.fillStyle = 'rgba(80,20,4,0.22)';
    rr(c, x, y + 2, w, h + 2, r);
    c.fill();
    /* lower edge, then the body lifted 4 px above it */
    c.fillStyle = k.edge;
    rr(c, x, y, w, h, r);
    c.fill();
    var g = c.createLinearGradient(0, y, 0, y + h - 4);
    g.addColorStop(0, k.top);
    g.addColorStop(1, k.bottom);
    c.fillStyle = g;
    rr(c, x, y, w, h - 4, r);
    c.fill();
    /* soft highlight along the top */
    c.save();
    rr(c, x, y, w, h - 4, r);
    c.clip();
    var hg = c.createLinearGradient(0, y, 0, y + Math.min(26, h * 0.4));
    hg.addColorStop(0, 'rgba(255,255,255,0.55)');
    hg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = hg;
    c.fillRect(x, y, w, Math.min(26, h * 0.4));
    c.restore();
    /* keyline */
    c.lineWidth = 2;
    c.strokeStyle = k.key;
    rr(c, x + 1, y + 1, w - 2, h - 2, r - 1);
    c.stroke();
    c.restore();
  }

  /* the arches on a red plate (the supplied mark, never redrawn) */
  function drawLogoPlate(c, R) {
    plate(c, R, 'red');
    if (IMG.logo) {
      var ah = (R.h - 4) * 0.56, aw = ah * IMG.logo.naturalWidth / IMG.logo.naturalHeight;
      c.drawImage(IMG.logo, R.x + (R.w - aw) / 2, R.y + (R.h - 4 - ah) / 2, aw, ah);
    }
    /* a slow shine pass every 9 s */
    if (FX) {
      var k = ((nowS() + 4) % 9) / 0.9;
      if (k < 1) {
        c.save();
        rr(c, R.x, R.y, R.w, R.h - 4, HUD.radius);
        c.clip();
        var sx = R.x - 40 + (R.w + 80) * easeInOut(k);
        var g = c.createLinearGradient(sx - 22, 0, sx + 22, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)');
        g.addColorStop(0.5, 'rgba(255,255,255,0.38)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.translate(sx, R.y + R.h / 2);
        c.rotate(0.35);
        c.translate(-sx, -(R.y + R.h / 2));
        c.fillRect(sx - 22, R.y - 40, 44, R.h + 80);
        c.restore();
      }
    }
  }

  /* one card style for the order and the Next drink: white plate, red band with the label, the drink and its name */
  var CARD_TEXT = 17;
  function drawCard(c, R, label, tier, popK) {
    var band = HUD.band;
    plate(c, R, 'white');
    c.save();
    rr(c, R.x + 2, R.y + 2, R.w - 4, R.h - 6, HUD.radius - 2);
    c.clip();
    var gb = c.createLinearGradient(0, R.y, 0, R.y + band);
    gb.addColorStop(0, '#E5331F');
    gb.addColorStop(1, '#CF2212');
    c.fillStyle = gb;
    c.fillRect(R.x, R.y, R.w, band);
    c.fillStyle = 'rgba(255,255,255,0.22)';
    c.fillRect(R.x, R.y + 2, R.w, 1);
    c.restore();
    c.fillStyle = '#FFFFFF';
    if ('letterSpacing' in c) c.letterSpacing = '1.5px';
    fillCap(c, label.toUpperCase(), R.x + 16, R.y + band / 2, 15, 700, 'left');
    if ('letterSpacing' in c) c.letterSpacing = '0px';
    if (!tier) return;
    var bodyY = R.y + band, bodyH = R.h - 4 - band;
    var colW = 50;
    var boxH = bodyH - 10;
    var tx0 = R.x + 16 + colW / 2, tb = bodyY + bodyH / 2 + boxH / 2;
    if (popK == null) {
      /* the goal: a soft pulse, and a shine as the card lands */
      var bh = boxH * (FX ? 1 + 0.03 * Math.sin(nowS() * 2.6) : 1);
      drawThumb(c, tier, tx0, tb + (bh - boxH) * 0, bh);
      drawThumbShine(c, tier, tx0, tb, boxH);
    } else {
      var sk = easeOutCubic(popK);
      c.save();
      c.globalAlpha *= sk;
      drawThumb(c, tier, tx0 + (1 - sk) * 26, tb, boxH);
      c.restore();
    }
    var name = CONFIG.tiers[tier - 1].name;
    var tx = R.x + 16 + colW + 10, maxW = R.x + R.w - 14 - tx;
    c.fillStyle = COL.ink;
    var lines = wrapRich(c, name, CARD_TEXT, 700, maxW);
    var lh = CARD_TEXT * 1.18;
    var ly = bodyY + bodyH / 2 - (lines.length - 1) * lh / 2;
    for (var i = 0; i < lines.length; i++) fillRich(c, lines[i], tx, ly + i * lh, CARD_TEXT, 700, 'left');
  }

  function drawOrderCard(c) {
    drawCard(c, HUD.order, CONFIG.words.orderLabel, HERO, null);
  }

  function drawNextSlot(c) {
    var nx = game.state === 'play' ? game.next : null;
    if (nx !== lastNext) { lastNext = nx; nextPopT = nowS(); }
    drawCard(c, HUD.next, CONFIG.words.nextLabel, nx, Math.min(1, (nowS() - nextPopT) / 0.25));
  }

  /* the sound switch sits in the Next card's red band, white on red */
  function drawSoundButton(c) {
    var b = SOUND_BTN;
    var on = Sound.isOn();
    c.save();
    c.globalAlpha = MUTE ? 0.6 : 1;
    c.fillStyle = '#FFFFFF';
    c.strokeStyle = '#FFFFFF';
    c.translate(b.x - 4, b.y);
    c.beginPath();
    c.moveTo(-7, -3.5); c.lineTo(-3.5, -3.5); c.lineTo(1.5, -8); c.lineTo(1.5, 8); c.lineTo(-3.5, 3.5); c.lineTo(-7, 3.5);
    c.closePath();
    c.fill();
    c.lineWidth = 2;
    c.lineCap = 'round';
    if (on) {
      c.beginPath(); c.arc(2.5, 0, 5.5, -0.8, 0.8); c.stroke();
      c.beginPath(); c.arc(2.5, 0, 9.5, -0.8, 0.8); c.stroke();
    } else {
      c.beginPath(); c.moveTo(5.5, -4.5); c.lineTo(12.5, 4.5); c.moveTo(12.5, -4.5); c.lineTo(5.5, 4.5); c.stroke();
    }
    c.restore();
  }

  /*
    The menu strip: a golden plate, seven equal cells with equal gaps and a chevron in each gap. Not made yet: a pale
    cell, the drink dimmed and half desaturated. Made: a white cell with a gold ring and a tick, with a pop when it
    lights. The hero's cell carries a gold ring always and pulses gently as the goal.
  */
  function drawStrip(c) {
    var S = HUD.strip;
    plate(c, S, 'gold');
    var n = CONFIG.tiers.length;
    var t = nowS();
    var cells = stripCells();
    for (var i = 0; i < n; i++) {
      var tier = i + 1;
      var C = cells[i];
      var lit = !!litShown[tier];
      var isHero = tier === HERO;
      var pk = litPulse[tier] != null ? clamp01((t - litPulse[tier]) / 0.5) : 1;
      var sc = pk < 1 ? 1 + 0.18 * Math.sin(pk * Math.PI) : 1;
      var ck = cellEntrance(i);
      if (ck < 1) sc *= ck <= 0 ? 0.001 : easeOutBack(ck);
      if (isHero && heroFlash() > 0) pk = Math.min(pk, 1 - heroFlash());
      if (isHero && !lit) sc *= 1 + 0.035 * Math.sin(t * 3.4);
      if (i < n - 1) {
        var gx = C.x + C.w + HUD.stripGap / 2, gy = C.y + C.h / 2;
        c.fillStyle = 'rgba(158,21,10,0.75)';
        c.beginPath();
        c.moveTo(gx + 3.5, gy);
        c.lineTo(gx - 2.5, gy - 6);
        c.lineTo(gx - 2.5, gy + 6);
        c.closePath();
        c.fill();
      }
      var cx = C.x + C.w / 2, cy = C.y + C.h / 2;
      c.save();
      c.translate(cx, cy);
      c.scale(sc, sc);
      c.translate(-cx, -cy);
      if (pk < 1) {
        c.save();
        c.globalAlpha = 1 - pk;
        var gr = C.w * (0.7 + pk * 0.5);
        c.drawImage(SPR.goldGlow, cx - gr, cy - gr, gr * 2, gr * 2);
        c.restore();
      }
      c.fillStyle = lit ? '#FFFFFF' : 'rgba(255,255,255,0.38)';
      rr(c, C.x, C.y, C.w, C.h, 12);
      c.fill();
      if (lit || isHero) {
        c.lineWidth = isHero ? 3 : 2;
        c.strokeStyle = isHero ? (lit ? COL.red : '#E39A00') : COL.yellowDeep;
        rr(c, C.x + 1, C.y + 1, C.w - 2, C.h - 2, 11);
        c.stroke();
      }
      var thumbH = HUD.thumbH;
      if (lit) drawThumb(c, tier, cx, C.y + C.h - 6, thumbH, 1);
      else drawDimThumb(c, tier, cx, C.y + C.h - 6, thumbH);
      if (lit && !isHero) {
        /* the tick */
        var tx = C.x + C.w - 9, ty = C.y + 9;
        c.fillStyle = COL.yellowDeep;
        c.beginPath(); c.arc(tx, ty, 7.5, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#FFFFFF';
        c.lineWidth = 2;
        c.lineCap = 'round';
        c.lineJoin = 'round';
        c.beginPath(); c.moveTo(tx - 3.5, ty); c.lineTo(tx - 1, ty + 2.6); c.lineTo(tx + 3.6, ty - 2.6); c.stroke();
      }
      c.restore();
    }
    /* drinks flying from the table to their place on the menu */
    for (var j = flyers.length - 1; j >= 0; j--) {
      var f = flyers[j];
      var k = (t - f.t0) / f.dur;
      if (k >= 1) {
        flyers.splice(j, 1);
        litShown[f.tier] = true;
        litPulse[f.tier] = t;
        continue;
      }
      if (k < 0) continue;
      var e = easeInOut(k);
      var to = stripCell(f.tier);
      var fx = f.x0 + (to.x - f.x0) * e;
      var fy = f.y0 + (to.y - f.y0) * e - Math.sin(e * Math.PI) * 90;
      drawThumb(c, f.tier, fx, fy + 30 * (1 - 0.3 * e), 60 * (1 - 0.15 * e));
    }
  }

  /* not made yet: the picture dimmed and half desaturated (a precomputed copy) */
  function drawDimThumb(c, tier, cx, bottomY, boxH) {
    var im = IMG.dim[tier - 1];
    if (!im) { drawThumb(c, tier, cx, bottomY, boxH, 0.5); return; }
    var w = boxH / ratioOf(tier);
    c.save();
    c.globalAlpha *= 0.6;
    c.drawImage(im, cx - w / 2, bottomY - boxH, w, boxH);
    c.restore();
  }

  /* "Double mix!" / "Summer streak!" over the merge that completed the chain */
  function drawPraise(c) {
    if (!praise || demo || hudTime() < 0) return;
    var k = (game.time - praise.t0) / 1.0;
    if (k >= 1) { praise = null; return; }
    var sc = k < 0.15 ? 0.6 + 0.4 * easeOutBack(k / 0.15) : 1;
    var y = P(0, (TB.launchLineY + TB.length) / 2, 0).y - k * 18;
    var x = game.aimX < TB.width / 2 ? W - 170 : 170;
    c.save();
    c.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
    c.translate(x, y);
    c.scale(sc, sc);
    c.lineJoin = 'round';
    c.lineWidth = 9;
    c.strokeStyle = COL.red;
    fillCap(c, praise.text, 0, 0, 34, 700, 'center', true);
    c.fillStyle = COL.yellow;
    fillCap(c, praise.text, 0, 0, 34, 700, 'center');
    c.restore();
  }

  /* "Keep the table cool": once per round, the first time a drink rests over the line */
  function drawDangerHint(c) {
    var k = (game.time - dangerHint.t0) / 2.0;
    if (k < 0 || k >= 1 || game.state !== 'play') return;
    var text = CONFIG.words.dangerHint;
    var size = 17, tw = measureRich(c, text, size, 700), pw = tw + 32, ph = 32;
    var ly = P(0, TB.launchLineY, 0).y;
    var cy = ly - 30;
    c.save();
    c.globalAlpha = k < 0.1 ? k / 0.1 : (k > 0.8 ? (1 - k) / 0.2 : 1);
    plate(c, { x: W / 2 - pw / 2, y: cy - ph / 2, w: pw, h: ph + 4 }, 'red', 16);
    c.fillStyle = '#FFFFFF';
    fillRich(c, text, W / 2, cy, size, 700, 'center');
    c.restore();
  }

  /* the first-time drink's name, big, under the top cards */
  function drawNames(c) {
    /* nothing of the HUD before the game starts (the start demo's merge shows no callout) */
    if (demo || hudTime() < 0) return;
    /* the core only appends its effects; drop the ones that are over */
    for (var j = game.fx.length - 1; j >= 0; j--) {
      if (game.time - game.fx[j].t0 > game.fx[j].dur) game.fx.splice(j, 1);
    }
    var names = game.fx.filter(function (e) { return e.type === 'name'; });
    if (!names.length) return;
    for (var i = 0; i < names.length; i++) {
      var f = names[i];
      var k = (game.time - f.t0) / f.dur;
      if (k < 0 || k >= 1) continue;
      var newest = i === names.length - 1;
      var alpha = k > 0.82 ? (1 - k) / 0.18 : 1;
      if (!newest) alpha = Math.min(alpha, 0.0);
      if (alpha <= 0) continue;
      var text = CONFIG.tiers[f.tier - 1].name;
      var size = fitSize(c, text, 470, 34, 700, 22);
      var tw = measureRich(c, text, size, 700);
      var thumbW = 54;
      var pw = Math.max(tw + thumbW + 46, 500), ph = 62;
      var cx = W / 2, cy = HUD.order.y + HUD.order.h / 2 + 6 - (k > 0.82 ? (k - 0.82) * 40 : 0);
      var sc = k < 0.14 ? 0.6 + 0.4 * easeOutBack(k / 0.14) : 1;
      c.save();
      c.globalAlpha = alpha;
      c.translate(cx, cy);
      c.scale(sc, sc);
      c.fillStyle = 'rgba(90,20,4,0.3)';
      rr(c, -pw / 2, -ph / 2 + 5, pw, ph, ph / 2);
      c.fill();
      c.fillStyle = COL.yellow;
      rr(c, -pw / 2 - 3, -ph / 2 - 3, pw + 6, ph + 6, ph / 2 + 3);
      c.fill();
      c.fillStyle = COL.red;
      rr(c, -pw / 2, -ph / 2, pw, ph, ph / 2);
      c.fill();
      drawThumb(c, f.tier, -pw / 2 + 14 + thumbW / 2, ph / 2 + 4, 80);
      c.fillStyle = '#FFFFFF';
      fillRich(c, text, -pw / 2 + thumbW + 26 + (pw - (tw + thumbW + 46)) / 2, 0, size, 700, 'left');
      /* the one-word summer shout, smaller, on a gold tab above the name */
      var shout = (CONFIG.words.shouts || [])[f.tier - 1];
      if (shout) {
        var ssz = 18, sw = measureRich(c, shout, ssz, 700) + 26, sh = 28;
        var sx = -pw / 2 + thumbW + 18 + (pw - (tw + thumbW + 46)) / 2;
        plate(c, { x: sx, y: -ph / 2 - sh + 6, w: sw, h: sh + 4 }, 'gold', 14);
        c.fillStyle = COL.red;
        fillRich(c, shout, sx + sw / 2, -ph / 2 - sh / 2 + 6, ssz, 700, 'center');
      }
      c.restore();
    }
  }

  /* ---------- start: title, line and an animated hand; they leave on the first touch ---------- */
  function drawHandShape(c, x, y, sc, pressed) {
    c.save();
    c.translate(x, y);
    c.rotate(-0.18);
    c.scale(sc * (pressed ? 0.92 : 1), sc * (pressed ? 0.92 : 1));
    /* the hand is five simple shapes; each is painted with the given action (fill or stroke) */
    function all(paint) {
      rr(c, -10, 0, 20, 64, 10); paint();
      rr(c, -15, 40, 56, 62, 20); paint();
      c.save(); c.translate(-14, 70); c.rotate(-0.55); rr(c, -9, -22, 18, 44, 9); paint(); c.restore();
      c.beginPath(); c.arc(16, 46, 10, 0, Math.PI * 2); paint();
      c.beginPath(); c.arc(31, 50, 9.5, 0, Math.PI * 2); paint();
    }
    function fill() { c.fill(); }
    function stroke() { c.stroke(); }
    c.save();
    c.translate(4, 6);
    c.globalAlpha = 0.25;
    c.fillStyle = '#5A1A04';
    all(fill);
    c.restore();
    /* outline: each shape stroked wide, then the white fill on top hides the inner edges */
    c.save();
    c.lineWidth = 7;
    c.lineJoin = 'round';
    c.strokeStyle = COL.ink;
    all(stroke);
    c.restore();
    c.fillStyle = '#FFFFFF';
    all(fill);
    c.strokeStyle = 'rgba(39,37,31,0.55)';
    c.lineWidth = 2.4;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(9, 56); c.lineTo(9, 66);
    c.moveTo(24, 58); c.lineTo(24, 68);
    c.stroke();
    c.restore();
  }

  function drawHint(c, dt) {
    var t = nowS();
    var outK = hintOut > 0 ? clamp01((t - hintOut) / 0.3) : 0;
    if (BOT || round !== 1 || outK >= 1) return;
    if (!hintOn && hintOut < 0) return;
    hintT += dt;
    var a = 1 - outK;
    var inK = clamp01(hintT / 0.5);
    /* the title and the line sit high, over the far end of the pile, clear of the demo's slide and below the
       first-drink name plate */
    var ty = HUD.nameY + 51 - 14 * (1 - easeOutCubic(inK)) - outK * 24;
    c.save();
    c.globalAlpha = a * inK;
    var tb = FX ? 0.7 + 0.3 * easeOutBack(clamp01(hintT / 0.55)) : 1;
    if (IMG.gameLogo) {
      /* the Summer Slide logo is the headline: whole, 70% of the frame wide, between the arches plate and the pile,
         clear of the demo's lane; its drop shadow is rendered once; it bounces in and floats very slightly */
      var L = logoSprite();
      var lw = W * 0.7, lh = lw * L.h / L.w;
      var lcx = W / 2, lcy = 100 + lh / 2 + (FX ? Math.sin(t * 1.4) * 2.5 : 0) - outK * 24;
      c.save();
      c.translate(lcx, lcy);
      c.scale(tb, tb);
      c.drawImage(L.canvas, -lw / 2 - L.pad * lw / L.w, -lh / 2 - L.pad * lw / L.w, L.canvas.width * lw / L.w, L.canvas.height * lw / L.w);
      c.restore();
      /* "Slide. Match. Sip." under the logo, outlined Speedee, each word lighting with the demo */
      var sy2 = 100 + lh + 14 - outK * 24, ssz2 = 24;
      var sw2 = measureRich(c, CONFIG.words.subtitle, ssz2, 700) + ssz2 * 0.64 + 30;
      plate(c, { x: W / 2 - sw2 / 2, y: sy2 - 19, w: sw2, h: 40 }, 'red', 18);
      drawSubtitleWords(c, W / 2, sy2 - 1, ssz2, false);
    } else if (IMG.ribbon) {
    c.drawImage(SPR.glow, W / 2 - 300, ty - 100, 600, 250);
    var tsz = fitSize(c, CONFIG.words.title, W - 2 * HUD.M - 24, 52, 700, 30);
    drawTitle(c, W / 2, ty, tsz, tb, clamp01(hintT / 0.6));
      var rw = 320, rh = rw * IMG.ribbon.naturalHeight / IMG.ribbon.naturalWidth;
      var ry = ty + 30;
      c.drawImage(IMG.ribbon, W / 2 - rw / 2, ry, rw, rh);
      /* the ribbon's front band spans its top 76%: centre on that. Each word lights in time with the demo:
         Slide. on the release, Match. on contact, Sip. as the new drink appears */
      drawSubtitleWords(c, W / 2, ry + rh * 0.38, 25);
    }
    c.restore();
    /* the call to play, where the menu strip will be */
    var py = HUD.strip.y + HUD.strip.h / 2;
    var ps = 1 + (FX ? 0.04 * Math.sin(t * 4) : 0);
    c.save();
    c.globalAlpha = a * inK;
    c.translate(W / 2, py);
    c.scale(ps, ps);
    c.lineJoin = 'round';
    c.lineWidth = 9;
    c.strokeStyle = COL.red;
    fillCap(c, CONFIG.words.playPrompt, 0, 2, 36, 700, 'center', true);
    c.strokeStyle = 'rgba(80,10,4,0.35)';
    c.lineWidth = 9;
    fillCap(c, CONFIG.words.playPrompt, 0, 5, 36, 700, 'center', true);
    c.lineWidth = 9;
    c.strokeStyle = COL.red;
    fillCap(c, CONFIG.words.playPrompt, 0, 2, 36, 700, 'center', true);
    c.fillStyle = '#FFFFFF';
    fillCap(c, CONFIG.words.playPrompt, 0, 2, 36, 700, 'center');
    c.restore();
    /* the hand follows the demo: press on the drink, drag to line up, let go, lift away */
    if (!demo || outK > 0) return;
    var d = demo;
    var pad = PJ.toScreen(d.g.aimX, TB.heldY);
    var hbx = drinkBox(d.g.held || CONFIG.demo.tier, d.g.aimX, TB.heldY, 1);
    var hx = pad.x + 4, hy = hbx.y - hbx.h * 0.45, pressed = false, ha = 1;
    if (d.t >= 1.08 && d.t < 1.5) {
      /* release ring */
      var rk = (d.t - 1.08) / 0.42;
      c.save();
      c.globalAlpha = (1 - rk) * 0.9;
      c.strokeStyle = '#FFFFFF';
      c.lineWidth = 3;
      c.beginPath();
      c.ellipse(pad.x, hy, 14 + 30 * rk, (14 + 30 * rk) * 0.55, 0, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
    if (d.t < 0.2) { ha = d.t / 0.2; hy += 26 * (1 - d.t / 0.2); }
    else if (d.t < 0.35) { pressed = d.t > 0.27; }
    else if (d.t < 1.08) { pressed = true; }
    else if (d.t < 1.7) { var k = (d.t - 1.08) / 0.62; hy += 30 * easeOutCubic(k); ha = 1 - k; }
    else ha = 0;
    if (ha <= 0) return;
    c.save();
    c.globalAlpha = ha;
    if (pressed) {
      c.strokeStyle = 'rgba(255,255,255,0.95)';
      c.lineWidth = 3;
      c.beginPath(); c.ellipse(hx - 4, hy, 16, 9, 0, 0, Math.PI * 2); c.stroke();
    }
    drawHandShape(c, hx, hy, 0.74, pressed);
    c.restore();
  }

  /* ---------- end screens ---------- */
  var BUTTON_FACE_C = (0.027 + 0.94) / 2;
  function drawButtonArt(c, label, cx, cy, w, fn, pulse) {
    var im = IMG.button;
    var h = im ? w * im.naturalHeight / im.naturalWidth : w * 0.37;
    var sc = 1 + (pulse ? 0.035 * Math.sin(nowS() * 4.2) : 0);
    c.save();
    c.translate(cx, cy);
    c.scale(sc, sc);
    if (im) c.drawImage(im, -w / 2, -h / 2, w, h);
    else { c.fillStyle = COL.yellow; rr(c, -w / 2, -h / 2, w, h, h / 2); c.fill(); }
    c.fillStyle = COL.red;
    /* the face runs from 2.7% to 94% of the picture's height (a darker rim below): centre on the face */
    var bsz = fitSize(c, label, w * 0.74, Math.round(h * 0.31), 700, 16);
    fillCap(c, label, 0, -h / 2 + h * BUTTON_FACE_C, bsz, 700, 'center');
    c.restore();
    buttons.push({ x: cx - w / 2, y: cy - h / 2, w: w, h: h, fn: fn });
  }

  function drawBackdrop(c, alpha) {
    var f = fullRect();
    var im = IMG.backdrop;
    c.save();
    c.globalAlpha = alpha;
    if (im) {
      /* cover the window, then zoom 14% about a point up and left of centre so the bottom-right corner (a faint smudge) is cropped off */
      var sc0 = Math.max(f.w / im.naturalWidth, f.h / im.naturalHeight);
      var z = 1.14;
      var dw0 = im.naturalWidth * sc0, dh0 = im.naturalHeight * sc0;
      var dx0 = f.x + (f.w - dw0) / 2, dy0 = f.y + (f.h - dh0) / 2;
      var px = f.x + f.w * 0.36, py = f.y + f.h * 0.34;
      c.drawImage(im, px + (dx0 - px) * z, py + (dy0 - py) * z, dw0 * z, dh0 * z);
    } else {
      c.fillStyle = COL.red;
      c.fillRect(f.x, f.y, f.w, f.h);
    }
    var g = c.createLinearGradient(0, 600, 0, f.y + f.h);
    g.addColorStop(0, 'rgba(126,15,7,0)');
    g.addColorStop(1, 'rgba(126,15,7,0.55)');
    c.fillStyle = g;
    c.fillRect(f.x, 600, f.w, f.y + f.h - 600);
    c.restore();
  }

  var HERO_END = { x: W / 2, y: 662, h: 340 };

  /* one line, or two balanced lines split at the space nearest the middle when it does not fit maxW */
  function balanced(c, text, size, maxW) {
    if (measureRich(c, text, size, 700) <= maxW) return [text];
    var words = text.split(' '), best = null, bestD = Infinity;
    for (var i = 1; i < words.length; i++) {
      var a = words.slice(0, i).join(' '), b = words.slice(i).join(' ');
      var d = Math.abs(measureRich(c, a, size, 700) - measureRich(c, b, size, 700));
      if (d < bestD) { bestD = d; best = [a, b]; }
    }
    return best || [text];
  }

  /*
    End-card headline: big Speedee sized to about 82% of the frame, on a soft dark-red glow, with a soft dark shadow, a
    thick deep-red outline (round joins) and a white fill, so it reads on yellow and on red rays alike.
  */
  var DEEP_RED = '#8E1410';
  function outlinedText(c, text, x, y, size, outline) {
    c.save();
    c.lineJoin = 'round';
    c.lineWidth = size * (outline || 0.22);
    c.strokeStyle = 'rgba(40,5,2,0.45)';
    fillCap(c, text, x, y + size * 0.07, size, 700, 'center', true);
    c.strokeStyle = DEEP_RED;
    fillCap(c, text, x, y, size, 700, 'center', true);
    c.fillStyle = '#FFFFFF';
    fillCap(c, text, x, y, size, 700, 'center');
    c.restore();
  }

  function drawHeadline(c, text, x, y) {
    var size = fitSize(c, text, W * 0.82, 84, 700, 40);
    var tw = measureRich(c, text, size, 700);
    c.save();
    c.translate(x, y);
    c.scale(1, 0.42);
    var g = c.createRadialGradient(0, 0, 0, 0, 0, tw * 0.62);
    g.addColorStop(0, 'rgba(110,12,6,0.6)');
    g.addColorStop(0.6, 'rgba(110,12,6,0.38)');
    g.addColorStop(1, 'rgba(110,12,6,0)');
    c.fillStyle = g;
    c.fillRect(-tw * 0.62, -tw * 0.62, tw * 1.24, tw * 1.24);
    c.restore();
    outlinedText(c, text, x, y, size);
  }

  function shadowLines(c, lines, x, y, size, lh, color) {
    /* a soft red scrim behind the line so it reads over the bright rays */
    var mw = 0;
    for (var j = 0; j < lines.length; j++) mw = Math.max(mw, measureRich(c, lines[j], size, 700));
    var bw = mw + 40, bh = (lines.length - 1) * lh + size * 1.6;
    c.save();
    c.fillStyle = 'rgba(160,22,10,0.62)';
    rr(c, x - bw / 2, y - size * 0.8, bw, bh, Math.min(20, bh / 2));
    c.fill();
    c.restore();
    for (var i = 0; i < lines.length; i++) outlinedText(c, lines[i], x, y + i * lh, size, 0.16);
  }

  function drawHeroOnCard(c, x, y, h, glowA) {
    var t = nowS();
    var w = h / ratioOf(HERO);
    c.save();
    c.globalAlpha = glowA;
    var R = 560;
    c.translate(x, y - h * 0.5);
    c.rotate(t * 0.12);
    c.drawImage(SPR.rays, -R, -R, R * 2, R * 2);
    c.restore();
    c.save();
    c.globalAlpha = glowA * 0.9;
    c.drawImage(SPR.glow, x - h * 0.75, y - h * 1.2, h * 1.5, h * 1.5);
    c.restore();
    var fl = Math.sin(t * 1.8) * 7;
    var hr = w / (2 * K);
    /* the same light as on the tray: the shadow falls to the viewer's left; it tightens as the drink floats up */
    drawCastShadow(c, x, baseCentreY(y - 6, w), hr, 1 - fl / 80, 0.32 * (1 - fl / 80), glowA * SH_A * 1.1);
    drawPic(c, HERO, x, y - 8 + fl - 6, w, 1, 0);
  }

  function textWithShadow(c, text, x, y, size, color) {
    c.save();
    c.fillStyle = 'rgba(110,14,6,0.55)';
    fillCap(c, text, x, y + Math.max(3, size * 0.06), size, 700, 'center');
    c.fillStyle = color;
    fillCap(c, text, x, y, size, 700, 'center');
    c.restore();
  }

  function namePill(c, text, cx, cy, size) {
    var tw = measureRich(c, text, size, 700);
    var pw = tw + 44, ph = size * 1.75;
    c.save();
    c.fillStyle = 'rgba(90,10,4,0.3)';
    rr(c, cx - pw / 2, cy - ph / 2 + 4, pw, ph, ph / 2);
    c.fill();
    c.fillStyle = COL.red;
    rr(c, cx - pw / 2, cy - ph / 2, pw, ph, ph / 2);
    c.fill();
    c.lineWidth = 3;
    c.strokeStyle = '#FFFFFF';
    c.stroke();
    c.fillStyle = '#FFFFFF';
    fillRich(c, text, cx, cy + 1, size, 700, 'center');
    c.restore();
  }

  function drawWinRise(c) {
    var hz = game.hero;
    var k = hz.k;

    var f = fullRect();
    c.save();
    c.fillStyle = 'rgba(120,16,6,' + (0.55 * k) + ')';
    c.fillRect(f.x, f.y, f.w, f.h);
    c.restore();
    var start = drinkBox(HERO, hz.x, hz.y, 1);
    var hEnd = HERO_END.h;
    var h = start.h + (hEnd - start.h) * k;
    var x = start.x + (HERO_END.x - start.x) * k;
    var y = start.y + (HERO_END.y - start.y) * k;
    var w = h / ratioOf(HERO);
    c.save();
    c.globalAlpha = k;
    c.translate(x, y - h * 0.5);
    c.rotate(nowS() * 0.12);
    c.drawImage(SPR.rays, -560, -560, 1120, 1120);
    c.restore();
    c.save();
    c.globalAlpha = k * 0.9;
    c.drawImage(SPR.glow, x - h * 0.75, y - h * 1.2, h * 1.5, h * 1.5);
    c.restore();
    var sNow = start.s + (1 - start.s) * k, syNow = start.sy + (0.32 - start.sy) * k;
    drawCastShadow(c, x, baseCentreY(y - 14 * k, w), (w / (2 * K)) / sNow, sNow, syNow, SH_A);
    drawPic(c, HERO, x, y - 14 * k, w, 1, 0);
  }

  function drawOverlay(c, dt) {
    buttons = [];
    if (game.state === 'win') { drawWinRise(c); return; }
    if (!overlay) return;
    overlayT += dt;
    var f = fullRect();
    var heroName = CONFIG.tiers[HERO - 1].name;
    var a = clamp01(overlayT / 0.35);
    if (overlay === 'retry') {
      c.save();
      c.globalAlpha = a;
      c.fillStyle = 'rgba(96,14,6,0.58)';
      c.fillRect(f.x, f.y, f.w, f.h);
      var sc = 0.85 + 0.15 * easeOutBack(clamp01(overlayT / 0.4));
      c.translate(W / 2, 480);
      c.scale(sc, sc);
      c.translate(-W / 2, -480);
      /* the same plate family as the HUD cards: white plate, red band, gold keyline */
      var RP = { x: 100, y: 330, w: 440, h: 300 };
      plate(c, RP, 'white');
      c.save();
      rr(c, RP.x + 2, RP.y + 2, RP.w - 4, RP.h - 6, HUD.radius - 2);
      c.clip();
      c.fillStyle = COL.red;
      c.fillRect(RP.x, RP.y, RP.w, HUD.band);
      c.restore();
      textWithShadow(c, CONFIG.words.failTitle, W / 2, 430, 64, COL.red);
      c.restore();
      if (a > 0.6) drawButtonArt(c, CONFIG.words.retry, W / 2, 540, 300, retry, true);
      return;
    }
    /* end cards: a soft, dimmed copy of the scene first, then the sunburst, the arches, the line, the hero, the button */
    drawBackdrop(c, a);
    var k1 = clamp01((overlayT - 0.1) / 0.4), k2 = clamp01((overlayT - 0.25) / 0.4), k3 = clamp01((overlayT - 0.4) / 0.4);
    drawHeroOnCard(c, HERO_END.x, HERO_END.y, HERO_END.h, overlay === 'win' ? 1 : a);
    drawEndSparkles(c, a);
    c.save();
    c.globalAlpha = a;
    drawLogoPlate(c, HUD.logo);
    c.restore();
    c.save();
    c.globalAlpha = k1;
    var dy = (1 - easeOutCubic(k1)) * 20;
    if (overlay === 'win') {
      drawHeadline(c, CONFIG.words.winTitle, W / 2, 196 + dy);
    } else {
      drawHeadline(c, CONFIG.words.failTitle, W / 2, 184 + dy);
      shadowLines(c, balanced(c, CONFIG.words.failLine, 28, 560), W / 2, 262 + dy, 28, 36, '#FFFFFF');
    }
    c.restore();
    c.save();
    c.globalAlpha = k2;
    var ny = 712 + (1 - easeOutCubic(k2)) * 14;
    var ns = fitSize(c, heroName, 500, 26, 700, 18);
    namePill(c, heroName, W / 2, ny, ns);
    if (overlay === 'win') shadowLines(c, balanced(c, CONFIG.words.winLine, 24, 560), W / 2, ny + 46, 24, 30, '#FFFFFF');
    c.restore();
    if (k3 > 0) {
      c.save();
      c.globalAlpha = k3;
      drawButtonArt(c, CONFIG.words.cta, W / 2, 858 + (1 - easeOutCubic(k3)) * 16, 300, clickOut, k3 >= 1);
      c.restore();
    }
  }

  /* ---------- round state watch ---------- */
  function watchRound() {
    if (game.result && !resultLogged) {
      resultLogged = true;
      var r = { outcome: game.result.outcome, drops: game.result.drops, seconds: game.result.seconds, maxTier: game.result.maxTier, round: round, seed: game.seed };
      window.__result = r;
      window.__results.push(r);
    }
    if (endShown) return;
    if (game.state === 'won') {
      game.fx.length = 0;
      endShown = true;
      overlay = 'win';
      overlayT = 0;
      track('end_card', { outcome: 'win' });
    } else if (game.state === 'fail') {
      dragging = false;
      if (failAt < 0) failAt = nowS();
      /* a short beat on the drink that went over before the panel */
      if (nowS() - failAt < 0.75) return;
      endShown = true;
      overlayT = 0;
      if (round === 1) {
        overlay = 'retry';
        if (BOT) botRetryAt = performance.now() + 1500 / SPEED;
      } else {
        overlay = 'fail';
        track('end_card', { outcome: 'fail' });
      }
    }
  }

  /* ---------- the HUD entrance (on the first touch) ---------- */
  /*
    Before the first touch only the scene, the table, the demo, the title lines and the arches are shown. On the first
    touch the HUD arrives in about 600 ms: the order card from the top left (overshoot), 70 ms later the Next card from
    the top right, 70 ms later the strip from below, then the seven cells pop left to right and the hero cell lands
    last with a gold flash; the order drink gets a shine as its card lands. Play is never held up by it. Bots, round
    two and a retry show the HUD at once. ?fx=0 / reduced motion: a plain fade.
  */
  var hudT0 = BOT ? -10 : null;

  function hudTime() {
    if (hudT0 == null) return -1;
    if (hudT0 === -10) return 10;
    return nowS() - hudT0;
  }

  function cellEntrance(i) {
    var t = hudTime();
    if (!FX || t >= 10) return 1;
    return clamp01((t - 0.30 - i * 0.045) / 0.16);
  }

  function heroFlash() {
    var t = hudTime();
    if (!FX || t >= 10 || t < 0.58) return 0;
    return Math.max(0, 1 - (t - 0.58) / 0.45);
  }

  /* a light sweep across the order card's drink as the card lands (an overlay; the picture is untouched) */
  function drawThumbShine(c, tier, cx, bottomY, boxH) {
    var t = hudTime();
    if (!FX || t < 0.36 || t > 0.9) return;
    var k = (t - 0.36) / 0.54;
    var w = boxH / ratioOf(tier);
    c.save();
    c.beginPath();
    c.rect(cx - w / 2 - 2, bottomY - boxH - 2, w + 4, boxH + 4);
    c.clip();
    c.globalCompositeOperation = 'lighter';
    var sx = cx - w + 2 * w * k;
    var g = c.createLinearGradient(sx - 10, 0, sx + 10, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.5, 'rgba(255,250,220,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(sx - 10, bottomY - boxH - 2, 20, boxH + 4);
    c.restore();
  }

  function drawHud(c) {
    var t = hudTime();
    if (t < 0) return;
    if (!FX) {
      c.save();
      c.globalAlpha = clamp01(t / 0.3);
      drawOrderCard(c);
      drawNextSlot(c);
      if (!overlay) drawSoundButton(c);
      drawStrip(c);
      c.restore();
      return;
    }
    function slide(delay, dx, dy, draw) {
      var k = clamp01((t - delay) / 0.38);
      if (k <= 0) return;
      var e = easeOutBack(k);
      c.save();
      c.translate((1 - e) * dx, (1 - e) * dy);
      if (k < 0.25) c.globalAlpha *= k / 0.25;
      draw();
      c.restore();
    }
    slide(0, -40, -150, function () { drawOrderCard(c); });
    slide(0.07, 40, -150, function () { drawNextSlot(c); if (!overlay) drawSoundButton(c); });
    slide(0.14, 0, 150, function () { drawStrip(c); });

  }

  /* ---------- the title, pre-rendered once (it bounces in and fades up) ---------- */
  var TITLE = null;
  function titleSprites(size) {
    if (TITLE && TITLE.size === size) return TITLE;
    var k = 2, cw = 640 * k, ch = 150 * k;
    var sharp = makeCanvas(cw, ch), g = sharp.getContext('2d');
    g.scale(k, k);
    g.lineJoin = 'round';
    g.lineWidth = 11;
    g.strokeStyle = '#FFFFFF';
    fillCap(g, CONFIG.words.title, 320, 75, size, 700, 'center', true);
    g.fillStyle = COL.red;
    fillCap(g, CONFIG.words.title, 320, 75, size, 700, 'center');
    TITLE = { size: size, sharp: sharp };
    return TITLE;
  }

  function drawTitle(c, cx, cy, size, scale, appear) {
    var T = titleSprites(size);
    c.save();
    c.translate(cx, cy);
    c.scale(scale, scale);
    c.globalAlpha *= appear;
    c.drawImage(T.sharp, -320, -75, 640, 150);
    c.restore();
  }

  /* "Slide." "Match." "Sip.": each lights in time with the demo */
  /* the logo with its drop shadow (warm, 35%, offset 2.5% of its height, soft) and a tight contact shadow, made once */
  var LOGO = null;
  function logoSprite() {
    if (LOGO) return LOGO;
    var im = IMG.gameLogo, w = im.naturalWidth, h = im.naturalHeight, pad = Math.round(h * 0.12);
    var cv = makeCanvas(w + pad * 2, h + pad * 2), g = cv.getContext('2d');
    var off = 10000;
    g.save();
    g.shadowColor = 'rgba(70,25,5,0.35)';
    g.shadowBlur = h * 0.05;
    g.shadowOffsetX = off;
    g.shadowOffsetY = h * 0.025;
    g.drawImage(im, pad - off, pad);
    g.restore();
    g.save();
    g.shadowColor = 'rgba(70,25,5,0.28)';
    g.shadowBlur = h * 0.012;
    g.shadowOffsetX = off;
    g.shadowOffsetY = h * 0.006;
    g.drawImage(im, pad - off, pad);
    g.restore();
    g.drawImage(im, pad, pad);
    LOGO = { canvas: cv, w: w, h: h, pad: pad };
    return LOGO;
  }

  function drawSubtitleWords(c, cx, cy, size, outlined) {
    var words = CONFIG.words.subtitle.split(' ');
    var times = null;
    if (demo) {
      var m = demo.mergeT;
      times = [demo.launched ? 1.08 : null, m != null ? m : null, m != null ? m + 0.32 : null];
    }
    var space = size * 0.32;
    var widths = words.map(function (w) { return measureRich(c, w, size, 700); });
    var total = widths.reduce(function (a, b) { return a + b; }, 0) + space * (words.length - 1);
    var x = cx - total / 2;
    for (var i = 0; i < words.length; i++) {
      var lit = true, pop = 0;
      if (times && FX) {
        var tw = times[i];
        lit = tw != null && demo.t >= tw;
        if (lit) pop = 1 - clamp01((demo.t - tw) / 0.25);
      }
      c.save();
      c.globalAlpha *= lit ? 1 : 0.45;
      c.translate(x + widths[i] / 2, cy);
      var sc = 1 + 0.2 * pop;
      c.scale(sc, sc);
      if (outlined) {
        c.lineJoin = 'round';
        c.lineWidth = 7;
        c.strokeStyle = COL.red;
        fillCap(c, words[i], 0, 0, size, 700, 'center', true);
      }
      c.fillStyle = lit && pop > 0 ? COL.yellow : '#FFFFFF';
      fillRich(c, words[i], 0, 0, size, 700, 'center');
      c.restore();
      x += widths[i] + space;
    }
  }

  /* ---------- ambient life, drawn over the painting (never warping it) ---------- */
  var AMB = { t: 0, motes: [], bubbles: [], mists: [], glint: null, glintNext: 1.2, built: false };
  /* the painting's open water between the parasol and the palm, and where small things catch the light */
  var POOL = [[214, -400], [492, -400], [492, 58], [470, 118], [168, 121], [196, 70]];
  var GLINTS = [[606, 646], [566, 437], [584, 452], [612, 424]];

  function buildAmbient() {
    /* caustic light: a tile of soft bright wavy lines */
    var cs = makeCanvas(160, 160), g = cs.getContext('2d');
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineCap = 'round';
    var rnd = Core.mulberry32(99);
    for (var i = 0; i < 18; i++) {
      var x = rnd() * 160, y = rnd() * 160, r = 10 + rnd() * 18;
      g.lineWidth = 1.5 + rnd() * 2;
      g.beginPath();
      for (var a = 0; a <= 6.4; a += 0.4) {
        var rr2 = r * (0.75 + 0.35 * Math.sin(a * 3 + i));
        var px = x + Math.cos(a) * rr2, py = y + Math.sin(a) * rr2 * 0.7;
        if (a === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.stroke();
    }
    var cs2 = makeCanvas(160, 160);
    var g2 = cs2.getContext('2d');
    for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) g2.drawImage(cs, ox * 160, oy * 160);
    SPR.caustic = cs2;
    /* a palm frond's shade, softened by drawing it small and scaling it up */
    var fr = makeCanvas(240, 170), f = fr.getContext('2d');
    f.fillStyle = 'rgb(60,34,14)';
    f.strokeStyle = 'rgb(60,34,14)';
    f.lineWidth = 4;
    f.beginPath();
    f.moveTo(10, 150);
    f.quadraticCurveTo(110, 40, 232, 30);
    f.stroke();
    for (var k = 0; k < 13; k++) {
      var u = 0.08 + k * 0.07;
      var bx = (1 - u) * (1 - u) * 10 + 2 * (1 - u) * u * 110 + u * u * 232;
      var by = (1 - u) * (1 - u) * 150 + 2 * (1 - u) * u * 40 + u * u * 30;
      [-1, 1].forEach(function (sd) {
        f.save();
        f.translate(bx, by);
        f.rotate(-0.45 + sd * 1.05);
        f.beginPath();
        f.ellipse(30 - k, 0, 34 - k * 1.6, 5, 0, 0, Math.PI * 2);
        f.fill();
        f.restore();
      });
    }
    var frs = makeCanvas(60, 43);
    frs.getContext('2d').drawImage(fr, 0, 0, 60, 43);
    SPR.frond = frs;
    SPR.mote = radialSprite(32, 32, [[0, 'rgba(255,248,225,0.9)'], [0.4, 'rgba(255,240,200,0.35)'], [1, 'rgba(255,240,200,0)']]);
    var r2 = Core.mulberry32(7);
    for (var m = 0; m < 10; m++) {
      AMB.motes.push({ x: (m % 2 ? 540 + r2() * 92 : 8 + r2() * 92), y: r2() * 960, vy: 7 + r2() * 9, ph: r2() * 6, r: 3 + r2() * 4, a: 0.25 + r2() * 0.3 });
    }
    AMB.built = true;
  }

  function drawAmbientBack(c, dt) {
    if (!FX || !ready || overlay === 'win' || overlay === 'fail') return;
    if (!AMB.built) buildAmbient();
    AMB.t += dt;
    var t = AMB.t, f = fullRect();
    /* water light: two caustic layers drifting different ways, added on, inside the open water only */
    c.save();
    c.beginPath();
    POOL.forEach(function (p, i) { var y = p[1] < 0 ? f.y : p[1]; if (i === 0) c.moveTo(p[0], y); else c.lineTo(p[0], y); });
    c.closePath();
    c.clip();
    c.globalCompositeOperation = 'lighter';
    [[1.6, 9, 4, 0.07], [2.3, -6, 7, 0.05]].forEach(function (L) {
      var sz = 160 * L[0];
      var ox = ((t * L[1]) % sz + sz) % sz, oy = ((t * L[2]) % sz + sz) % sz;
      c.globalAlpha = L[3];
      for (var x = 150 - sz + ox; x < 520; x += sz) {
        for (var y = f.y - sz + oy; y < 130; y += sz) c.drawImage(SPR.caustic, x, y, sz, sz);
      }
    });
    /* a few sparkles twinkling on the ripples, each with a soft bloom */
    for (var i = 0; i < 4; i++) {
      var cyc = 2.6 + i * 0.4, ph = (t + i * 0.9) / cyc, n = Math.floor(ph), k = ph - n;
      var rs = Core.mulberry32(n * 31 + i * 7);
      var sx = 240 + rs() * 230, sy = 12 + rs() * 95;
      var e = Math.sin(Math.PI * k);
      if (e <= 0.05) continue;
      c.globalAlpha = e * 0.8;
      var sp = IMG.fx.sparkles[i % 3];
      if (sp) { var ss = 12 * e; c.drawImage(sp, sx - ss / 2, sy - ss / 2, ss, ss); }
    }
    c.restore();
    /* palm shade swaying over the decking and the tray's right edge */
    c.save();
    c.globalCompositeOperation = 'multiply';
    c.globalAlpha = 0.2;
    c.translate(574 + Math.sin(t * 0.7) * 4, 430 + Math.sin(t * 0.5 + 1) * 2);
    c.rotate(2.1 + Math.sin(t * 0.6) * 0.035);
    c.drawImage(SPR.frond, -120, -85, 240, 170);
    c.restore();
    /* a slow sheen across the cream table top every 7 s */
    var sk = ((t + 2) % 7) / 1.9;
    if (sk < 1) {
      c.save();
      poly(c, [P(0, 0, 0), P(TB.width, 0, 0), P(TB.width, TB.length, 0), P(0, TB.length, 0)]);
      c.clip();
      var a0 = P(0, 0, 0), a1 = P(TB.width, TB.length, 0);
      var bx = a0.x - 200 + (a1.x - a0.x + 400) * easeInOut(sk);
      c.translate(bx, (a0.y + a1.y) / 2);
      c.rotate(-0.5);
      var gs = c.createLinearGradient(-60, 0, 60, 0);
      gs.addColorStop(0, 'rgba(255,255,255,0)');
      gs.addColorStop(0.5, 'rgba(255,255,255,' + (0.2 * Math.sin(Math.PI * sk)) + ')');
      gs.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gs;
      c.fillRect(-60, -700, 120, 1400);
      c.restore();
    }
    /* a rare glint on the sunglasses, the ice or the lemon */
    AMB.glintNext -= dt;
    if (!AMB.glint && AMB.glintNext <= 0) {
      AMB.glint = { p: GLINTS[Math.floor(Math.random() * GLINTS.length)], t: 0 };
      AMB.glintNext = 1.8 + Math.random() * 1.6;
    }
    if (AMB.glint) {
      AMB.glint.t += dt;
      var gk = AMB.glint.t / 0.7;
      if (gk >= 1) AMB.glint = null;
      else {
        var ge = Math.sin(Math.PI * gk), gp = AMB.glint.p;
        c.save();
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = ge;
        var gsp = IMG.fx.sparkles[1];
        if (gsp) { var gs2 = 18 * ge; c.translate(gp[0], gp[1]); c.rotate(gk); c.drawImage(gsp, -gs2 / 2, -gs2 / 2, gs2, gs2); }
        c.restore();
      }
    }
  }

  /* light flecks drifting up the margins beside the table */
  function drawAmbientFront(c, dt) {
    if (!FX || !AMB.built || overlay === 'win' || overlay === 'fail') return;
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (var i = 0; i < AMB.motes.length; i++) {
      var m = AMB.motes[i];
      m.y -= m.vy * dt;
      if (m.y < 130) m.y = 960 + Math.random() * 60;
      var x = m.x + Math.sin(AMB.t * 0.8 + m.ph) * 6;
      c.globalAlpha = m.a * (0.6 + 0.4 * Math.sin(AMB.t * 1.7 + m.ph));
      c.drawImage(SPR.mote, x - m.r, m.y - m.r, m.r * 2, m.r * 2);
    }
    c.restore();
  }

  /* fizz rising from the fizzy drinks at rest, a cold wisp over the frozen ones (capped) */
  var FIZZY = { 1: true, 2: true, 3: true }, FROZEN = { 5: true, 6: true, 7: true };
  function drawAmbientDrinks(c, dt, list) {
    if (!FX || !AMB.built) return;
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (!e.body || !e.body.isSleeping || !e.bx) continue;
      var bx = e.bx;
      if (FIZZY[e.tier] && AMB.bubbles.length < 22 && Math.random() < dt * 1.4) {
        AMB.bubbles.push({ x: bx.x + (Math.random() - 0.5) * bx.w * 0.55, y: bx.y - bx.h * 0.93, r: (0.8 + Math.random() * 0.9) * bx.s * 1.5, vy: 16 + Math.random() * 14, t: 0, life: 0.7 + Math.random() * 0.4 });
      }
      if (FROZEN[e.tier] && AMB.mists.length < 6 && Math.random() < dt * 0.5) {
        AMB.mists.push({ x: bx.x + (Math.random() - 0.5) * bx.w * 0.3, y: bx.y - bx.h * 0.98, w: bx.w * 0.7, t: 0, life: 1.6 });
      }
    }
    c.save();
    for (var b = AMB.bubbles.length - 1; b >= 0; b--) {
      var u = AMB.bubbles[b];
      u.t += dt;
      if (u.t >= u.life) { AMB.bubbles.splice(b, 1); continue; }
      u.y -= u.vy * dt;
      var k = u.t / u.life;
      c.globalAlpha = (k < 0.2 ? k / 0.2 : 1 - (k - 0.2) / 0.8) * 0.8;
      c.fillStyle = '#FFFFFF';
      c.beginPath();
      c.arc(u.x + Math.sin(u.t * 9 + b) * 1.2, u.y, u.r, 0, Math.PI * 2);
      c.fill();
    }
    for (var q = AMB.mists.length - 1; q >= 0; q--) {
      var w2 = AMB.mists[q];
      w2.t += dt;
      if (w2.t >= w2.life) { AMB.mists.splice(q, 1); continue; }
      var mk = w2.t / w2.life;
      var ww = w2.w * (0.6 + 0.6 * mk), hh = ww * 0.42;
      c.globalAlpha = Math.sin(Math.PI * mk) * 0.22;
      c.drawImage(SPR.glow, w2.x - ww / 2 + Math.sin(w2.t * 1.3) * 3, w2.y - hh / 2 - mk * 16, ww, hh);
    }
    c.restore();
  }

  /* end cards: a few sparkles drifting up through the rays */
  function drawEndSparkles(c, a) {
    if (!FX) return;
    var t = nowS();
    c.save();
    c.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 9; i++) {
      var x = 50 + ((i * 113 + t * (14 + i * 2)) % 540);
      var y = 940 - ((i * 157 + t * (26 + i * 3)) % 860);
      var e = 0.5 + 0.5 * Math.sin(t * 2.2 + i * 1.7);
      c.globalAlpha = a * e * 0.8;
      var sp = IMG.fx.sparkles[i % 3];
      if (sp) { var ss = 10 + 6 * e; c.drawImage(sp, x - ss / 2, y - ss / 2, ss, ss); }
    }
    c.restore();
  }

  /* ---------- main loop ---------- */
  var last = performance.now();
  var readySent = false;
  var fpsAcc = 0, fpsN = 0, fps = 0;

  function frame(now) {
    var dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    var ft0 = performance.now();
    if (!ready) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = COL.red;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      requestAnimationFrame(frame);
      return;
    }
    /* checks only: window.__pause freezes game time; window.__step = seconds of game time to advance once */
    var gdt = dt;
    if (window.__pauseAt && nowS() >= window.__pauseAt) { window.__pause = true; window.__pauseAt = 0; }
    if (window.__pause) { gdt = (window.__step || 0) / SPEED; window.__step = 0; }
    if (bot && game.state === 'play') bot.tick(game, gdt * SPEED);
    updateDemo(gdt * SPEED);
    game.update(gdt, SPEED);
    if (queuedLaunch) {
      if (game.state !== 'play') queuedLaunch = false;
      else if (game.canLaunch()) { queuedLaunch = false; game.launch(); }
    }
    watchRound();
    updateLit();
    if (BOT && overlay === 'retry' && botRetryAt > 0 && now >= botRetryAt) {
      botRetryAt = -1;
      retry();
    }
    if (staticDirty) buildStatic();

    /* gentle zoom thump on big merges, around the merge point */
    var bk = (nowS() - bump.t0) / 0.32;
    var z = bk >= 0 && bk < 1 ? 1 + bump.amp * Math.sin(bk * Math.PI) * (1 - bk) : 1;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COL.page;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    var pdx = (view.ox + bump.x * view.s) * view.dpr, pdy = (view.oy + bump.y * view.s) * view.dpr;
    if (z !== 1) ctx.drawImage(staticLayer, pdx - pdx * z, pdy - pdy * z, canvas.width * z, canvas.height * z);
    else ctx.drawImage(staticLayer, 0, 0);

    gameTransform(ctx);
    ctx.save();
    if (z !== 1) {
      ctx.translate(bump.x, bump.y);
      ctx.scale(z, z);
      ctx.translate(-bump.x, -bump.y);
    }
    drawAmbientBack(ctx, gdt);
    drawLine(ctx);
    var list = collectDrawList();
    drawDrinks(ctx, list);
    drawAmbientDrinks(ctx, gdt, list);
    drawDemoFade(ctx);
    drawDrops(ctx, gdt);
    drawParts(ctx, gdt);
    ctx.restore();

    drawAmbientFront(ctx, gdt);
    drawHint(ctx, dt);
    drawPraise(ctx);
    drawDangerHint(ctx);
    drawCallout(ctx);
    drawHud(ctx);
    drawLogoPlate(ctx, HUD.logo);
    drawOverlay(ctx, dt);
    if (ALIGN) drawAlign(ctx);

    if (DEBUG) {
      fpsAcc += dt; fpsN++;
      if (fpsAcc > 0.5) { fps = Math.round(fpsN / fpsAcc); fpsAcc = 0; fpsN = 0; }
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(4, 128, 70, 22);
      ctx.fillStyle = '#fff';
      ctx.font = font(14, 700);
      ctx.textAlign = 'left';
      ctx.fillText(fps + ' fps', 10, 140);
    }

    var ftw = performance.now() - ft0;
    var FT = window.__ft || (window.__ft = { n: 0, sum: 0, max: 0 });
    FT.n++; FT.sum += ftw; if (ftw > FT.max) FT.max = ftw;
    if (!readySent) {
      readySent = true;
      track('ready', { seed: SEED, bot: BOT || null, speed: SPEED, art: 1 });
    }
    requestAnimationFrame(frame);
  }

  loadAll();
  requestAnimationFrame(frame);
})();
