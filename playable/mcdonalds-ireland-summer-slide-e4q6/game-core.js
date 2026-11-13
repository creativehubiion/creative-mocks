/*
  Summer Mix, McDonald's-themed build (05-build), sliding version: rules and physics. No DOM in this file.
  Copied from 03-greyboxes/game-core.js. Changes from the greybox (listed in SOURCES.md and the job report): smaller
  drinks (footprint diameters 10% to 26% of the table width, one steady step), a shorter table (400 x 360 units), the
  launch line at 285 (the far 79% of the table is playable) and the waiting row at 328, a fuller pre-stock (eight
  drinks, no free chain from the opening merge), deal weights 0.40/0.35/0.25, the fail rule (failEdge: the front of a
  footprint crossing the line), the pull (magnetRange 6, magnetDepth 0.6: depth gaps count shorter, as the perspective
  shows them), mergeReach 1.5 -> 4, the greedy bot's fallbacks (land beside a same drink, else park at the pile's front),
  nameShow 1.6 s, the camera, the words, the click-out and the theme.
  Physics is top-down on the table plane (no gravity): each drink is a circle, its cup's footprint.
  Table coordinates: x 0..table.width left to right, y 0 at the far edge, table.length at the near edge.
  Loads in the browser (window.GameCore) and in Node (require) so sim.mjs plays the same game.
  Matter.js is passed in by the caller.
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.GameCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------
     CONFIG: everything tunable lives here.
     Table units for the physics; screen px (640x960 design) for the view; seconds for time.
     ------------------------------------------------------------------ */
  var CONFIG = {
    /* working name of the game (a working title by iion) */
    name: 'Summer Slide',

    world: { width: 640, height: 960 },

    /* The serving counter, in table units. launchLineY: the dashed line; heldY: where the waiting drink stands. */
    table: {
      width: 400,
      length: 360,
      launchLineY: 285,
      heldY: 328,
      wallThickness: 200,
      /* true: a drink is over the line when the front of its footprint crosses it (not its centre) */
      failEdge: true
    },

    /*
      Perspective camera, in screen px: where the near and far edges of the table land and their half widths.
      The pinhole camera that produces this is derived in createProjection.
    */
    projection: {
      centerX: 320,
      nearY: 798,
      farY: 202,
      nearHalfW: 256,
      farHalfW: 186
    },

    /*
      Seven tiers, small to large. r = footprint radius in table units (the cup's base).
      The cup drawn on it follows the cut-out pictures: aspect = rim width / height, base = base width / rim width,
      dome = fraction of the height taken by a domed or cream top above the rim, cap = width of that top / rim width.
    */
    tiers: [
      { tier: 1, name: 'Sprite® Zero', short: 'Sprite', r: 20, aspect: 0.63, base: 0.74, dome: 0, cap: 1, image: null, art: '1-sprite-zero.png' },
      { tier: 2, name: 'Fanta® No Added Sugar', short: 'Fanta', r: 23.5, aspect: 0.63, base: 0.74, dome: 0, cap: 1, image: null, art: '2-fanta-no-added-sugar.png' },
      { tier: 3, name: 'Coca-Cola® Zero Sugar', short: 'Coke', r: 27.5, aspect: 0.63, base: 0.74, dome: 0, cap: 1, image: null, art: '3-coca-cola-zero-sugar.png' },
      { tier: 4, name: 'Strawberry Milkshake', short: 'Shake', r: 32, aspect: 0.61, base: 0.74, dome: 0, cap: 1, image: null, art: '4-strawberry-milkshake.png' },
      { tier: 5, name: 'Mango & Pineapple Smoothie', short: 'Smoothie', r: 38, aspect: 0.66, base: 0.74, dome: 0.13, cap: 0.6, image: null, art: '5-mango-pineapple-smoothie.png' },
      { tier: 6, name: 'Caramel Iced Frappé', short: 'Frappé', r: 44, aspect: 0.62, base: 0.74, dome: 0.22, cap: 0.55, image: null, art: '6-caramel-iced-frappe.png' },
      { tier: 7, name: 'Frozen Strawberry Lemonade', short: 'Lemonade', r: 52, aspect: 0.74, base: 0.74, dome: 0.12, cap: 0.6, image: null, art: '7-frozen-strawberry-lemonade.png' }
    ],
    /* Multiplies every footprint radius; one knob for how crowded the table gets. */
    sizeScale: 1,
    heroTier: 7,
    artPath: 'assets/drinks/',

    /* Only tiers 1 to 3 are dealt. Weights are relative. */
    deal: { weights: [0.4, 0.35, 0.25] },

    /* Pre-stocked cluster at the far end, table units. Same tiers must not touch. */
    /* the spine (Frappe behind a Strawberry Milkshake) and six small drinks; the Sprite at the front right is the start
       demo's match, and nothing of its kind is near enough to chain from that first merge */
    prestock: [
      { tier: 6, x: 200, y: 60 },
      { tier: 4, x: 200, y: 136 },
      { tier: 1, x: 70, y: 70 },
      { tier: 3, x: 335, y: 62 },
      { tier: 3, x: 85, y: 165 },
      { tier: 1, x: 318, y: 165 },
      { tier: 2, x: 110, y: 255 },
      { tier: 2, x: 250, y: 250 }
    ],
    /* the start demo: the waiting drink it slides and the table x it lines up with (the pre-stocked Sprite above) */
    demo: { tier: 1, x: 318, loop: 3.3 },

    timings: {
      cooldown: 0.45,
      failHold: 2.0,
      spawnGrace: 1.0,
      softCap: 40,
      nameShow: 1.6,
      pop: 0.15,
      settleMax: 3,
      winSlowScale: 0.3,
      heroRise: 1.1,
      endCardDelay: 0.5,
      hardStop: 240
    },

    physics: {
      step: 1 / 120,
      maxStepsPerFrame: 12,
      positionIterations: 12,
      velocityIterations: 10,
      density: 0.001,
      /* contact friction between drinks and against walls: low, they slide off each other */
      friction: 0.04,
      restitution: 0.12,
      wallRestitution: 0.2,
      /* rolling-free sliding: constant kinetic friction (units/s^2) plus a little air drag */
      slideDecel: 520,
      frictionAir: 0.006,
      slop: 0.02,
      launchSpeed: 760,
      maxSpeed: 1100,
      sleepThreshold: 30,
      settleSpeed: 6,
      growFrom: 0.72,
      growSteps: 10,
      /* same-tier footprints this close (units) count as touching, also when both are asleep */
      mergeReach: 4,
      /* overlap (units) at which a sleeping drink is woken so the solver can push it out */
      wakeDepth: 1.5,
      /*
        Like drinks pull together when the gap between them is under magnetRange units plus magnetFrac of their
        radii added (bigger drinks reach further), at magnetPull units/s^2, up to magnetMax units/s.
      */
      magnetRange: 6,
      magnetFrac: 0.3,
      magnetMinTier: 1,
      /*
        Front-to-back gaps are drawn shorter than side gaps (the cups stand up in front of what is behind them), so for
        the pull a depth gap counts as magnetDepth of its length: drinks that look touching pull together and merge.
      */
      magnetDepth: 0.6,
      /* true: no pull when another drink stands between the pair */
      magnetLineOfSight: false,
      magnetPull: 1400,
      magnetMax: 120
    },

    /* nearReach: with no clean hit, the greedy bot lands beside a same drink when it can get this close (units) */
    bot: { think: 0.75, scanStep: 4, nearReach: 30, fallback: 'front', frontMargin: 40 },

    /* working lines by iion for the pitch (not McDonald's copy); no prices, offers, dates or claims */
    words: {
      title: 'Summer’s on the menu',
      subtitle: 'Slide. Match. Sip.',
      orderLabel: 'Summer order',
      nextLabel: 'Next up',
      /* the one-word shout above a first-time drink's name, by tier */
      shouts: ['Fizz!', 'Zing!', 'Classic!', 'Shake it!', 'Tropical!', 'Iced!', 'Summer, served!'],
      playPrompt: 'Slide to play',
      chain2: 'Double mix!',
      chain3: 'Summer streak!',
      dangerHint: 'Keep the table cool',
      winTitle: 'Summer, served.',
      winLine: 'Find your summer flavour at McDonald’s.',
      failTitle: 'So close.',
      failLine: 'Your summer drink is waiting at McDonald’s.',
      retry: 'Try again',
      cta: 'See the drinks'
    },

    /* McDonald's Ireland's cold drinks menu (the page the drink pictures come from) */
    clickOut: { url: 'https://www.mcdonalds.com/ie/en-ie/menu/milkshakes-and-cold-drinks.html' },

    /*
      The McDonald's theme. Colours: McDonald's red #DA291C, golden yellow #FFC72C, white, near-black ink.
      All text is Speedee (supplied by the owner for mcdonalds-ie-01). Paths are relative to index.html.
    */
    theme: {
      colors: {
        page: '#B5160C',
        red: '#DA291C',
        redDeep: '#A8150B',
        redDark: '#7E0F07',
        yellow: '#FFC72C',
        yellowDeep: '#F2A900',
        yellowLight: '#FFE08A',
        white: '#FFFFFF',
        ink: '#27251F',
        inkSoft: '#5B5750',
        surfaceFar: '#F4E7D7',
        surfaceNear: '#FFFDF9',
        shadow: 'rgba(92,32,6,0.30)'
      },
      fonts: {
        family: 'Speedee, "Helvetica Neue", Arial, sans-serif',
        faces: [
          { family: 'Speedee', src: 'assets/fonts/Speedee-Bold.ttf', weight: '700' },
          { family: 'Speedee', src: 'assets/fonts/Speedee-Regular.otf', weight: '400' }
        ]
      },
      logo: 'assets/brand/golden-arches.svg',
      /* the background picture (cover-fitted to the window). sceneHasTable: true when the picture already has the
         tray painted in this exact projection (05-build/_blueprint); the game then does not draw its own tray */
      scene: 'assets/art/scene.jpg',
      /* the game's title logo (Gemini lettering, working title), drawn whole on the opening */
      gameLogo: 'assets/art/logo-summer-slide.png',
      sceneHasTable: true,
      /*
        How the painted scene is laid on the 640x960 frame: scaled uniformly by scale about (ax, ay), then moved by
        (dx, dy). The repaint's near edge came out 1.6% short; 1.012 about the far edge's middle puts every painted
        table corner within 3 px of the physics (never stretched; the physics and camera are untouched).
      */
      sceneFit: { scale: 1.012, ax: 320, ay: 202.5, dx: 0, dy: 0 },
      /* the soft copy of the scene outside the 2:3 frame (wide windows): its blur in screen px */
      outerBlurPx: 9,
      /* height / width of a cup's base ring and shadow at the front edge (the cup pictures' own base flattening) */
      ringFlat: 0.42,
      endBackdrop: 'assets/art/end-backdrop.jpg',
      ui: {
        button: 'assets/ui/button-yellow.png',
        ribbon: 'assets/ui/ribbon-red.png'
      },
      fx: {
        splash: { clear: 'assets/fx/splash-clear.png', orange: 'assets/fx/splash-orange.png', pink: 'assets/fx/splash-pink.png' },
        /* the merge droplets are drawn (tinted by drink); the generated droplet and ice pieces are not used */
        droplets: [],
        ice: [],
        sparkles: ['assets/fx/sparkle-1.png', 'assets/fx/sparkle-2.png', 'assets/fx/sparkle-4.png']
      },
      /* splash colour per tier: Sprite, Fanta (orange), Coke, Strawberry Milkshake (pink), Smoothie (orange), Frappe, Lemonade (pink) */
      splashByTier: ['clear', 'orange', 'clear', 'pink', 'orange', 'clear', 'pink'],
      /*
        Drawn picture width per footprint diameter. 1 = the cup's rim (its widest part) is the footprint, so cups that
        look touching are touching. The greybox drew the base on the footprint (1 / 0.74 = 1.35).
      */
      drinkWidth: 1,
      /* the cup's base centre sits on the footprint centre: the photo's base ellipse is baseLift x width above its bottom */
      baseLift: 0.075,
      /* the tray drawn on the physics walls, in table units: rim height, rim thickness, near lip height, front face depth */
      tray: { rimH: 15, rimT: 13, lipH: 6, lipT: 10, faceD: 14, standH: 120 },
      /* the light comes from behind on the right (the sun in the scene), so every shadow falls towards the viewer and
         to the left: direction on the table plane (x right, y towards the player) */
      shadowDir: { x: -0.42, y: 0.91 }
    }
  };

  /* ------------------------------------------------------------------ */

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function median(arr) {
    if (!arr.length) return null;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    var m = s.length >> 1;
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  /*
    Perspective mapping between the table plane and the screen. A pinhole camera behind and above the near
    edge: depth z = dc + (length - y); screen x = cx + f (x - w/2) / z; screen y = horizon + F / z.
  */
  function createProjection(cfg) {
    var T = cfg.table, Pj = cfg.projection;
    var L = T.length, Wt = T.width;
    var ratio = Pj.farHalfW / Pj.nearHalfW;
    var dc = ratio * L / (1 - ratio);
    var f = Pj.nearHalfW * dc / (Wt / 2);
    var F = (Pj.nearY - Pj.farY) / (1 / dc - 1 / (dc + L));
    var horizon = Pj.nearY - F / dc;
    function depth(y) { return dc + (L - y); }
    return {
      dc: dc, f: f, F: F, horizon: horizon,
      toScreen: function (x, y) {
        var z = depth(y);
        return { x: Pj.centerX + f * (x - Wt / 2) / z, y: horizon + F / z, s: f / z, sy: F / (z * z) };
      },
      /* px per table unit across, at table depth y */
      scaleAt: function (y) { return f / depth(y); },
      /* px per table unit along the table, at depth y (foreshortening) */
      scaleYAt: function (y) { var z = depth(y); return F / (z * z); },
      toTable: function (sx, sy) {
        var z = F / (sy - horizon);
        return { x: Wt / 2 + (sx - Pj.centerX) * z / f, y: L - (z - dc) };
      },
      /* table x under a screen x, on the table row at depth y */
      tableXAt: function (sx, y) {
        return Wt / 2 + (sx - Pj.centerX) * depth(y) / f;
      }
    };
  }

  /* Cup outline for drawing, in units where the footprint radius is r. Base centre at (0,0), y up negative. */
  function cupShape(def, r) {
    var baseW = 2 * r;
    var rimW = baseW / def.base;
    var h = rimW / def.aspect;
    var rimY = -h + h * def.dome;
    var pts = [];
    var c = Math.max(1, r * 0.08);
    if (def.dome > 0) {
      var capHalf = rimW / 2 * def.cap;
      pts.push({ x: -capHalf, y: -h }, { x: capHalf, y: -h }, { x: rimW / 2, y: rimY });
    } else {
      pts.push({ x: -rimW / 2 + c, y: -h }, { x: rimW / 2 - c, y: -h }, { x: rimW / 2, y: -h + c });
    }
    pts.push({ x: baseW / 2, y: -c }, { x: baseW / 2 - c, y: 0 }, { x: -baseW / 2 + c, y: 0 }, { x: -baseW / 2, y: -c });
    if (def.dome > 0) pts.push({ x: -rimW / 2, y: rimY });
    else pts.push({ x: -rimW / 2, y: -h + c });
    return { pts: pts, h: h, rimW: rimW, baseW: baseW, rimY: rimY };
  }

  function buildTiers(cfg) {
    var sc = cfg.sizeScale || 1;
    return cfg.tiers.map(function (t) {
      var d = Object.assign({}, t, { r: t.r * sc });
      d.shape = cupShape(d, d.r);
      return d;
    });
  }

  /* ------------------------------------------------------------------
     createGame: one round.
     opts: { config, seed, onEvent(name, data) }
     ------------------------------------------------------------------ */
  function createGame(Matter, opts) {
    opts = opts || {};
    var cfg = opts.config || CONFIG;
    var P = cfg.physics;
    var Tm = cfg.timings;
    var TB = cfg.table;
    var emit = opts.onEvent || function () {};
    var seed = (opts.seed == null ? 1 : opts.seed) >>> 0;
    var rng = mulberry32(seed * 2654435761 + 17);
    var tiers = buildTiers(cfg);
    var Body = Matter.Body;
    var Composite = Matter.Composite;
    var Sleeping = Matter.Sleeping;
    var maxTierN = tiers.length;

    var engine = Matter.Engine.create({
      enableSleeping: true,
      positionIterations: P.positionIterations,
      velocityIterations: P.velocityIterations
    });
    engine.gravity.x = 0;
    engine.gravity.y = 0;
    engine.gravity.scale = 0;
    var world = engine.world;

    var g = {
      cfg: cfg,
      tiers: tiers,
      engine: engine,
      seed: seed,
      state: 'settling',
      time: 0,
      playTime: 0,
      started: false,
      launches: 0,
      merges: 0,
      maxTier: 0,
      held: null,
      next: null,
      aimX: TB.width / 2,
      cooldown: 0,
      drinks: [],
      fx: [],
      made: {},
      lit: {},
      helpful: false,
      hero: null,
      result: null,
      autoMergesAtStart: 0
    };

    /* ---- walls: left, right, far, and a stop at the near edge of the table (behind the waiting drink) ---- */
    var wt = TB.wallThickness, Lt = TB.length, Wt = TB.width;
    var wo = { isStatic: true, friction: 0, frictionStatic: 0, restitution: P.wallRestitution, label: 'wall' };
    var walls = [
      Matter.Bodies.rectangle(-wt / 2, Lt / 2, wt, Lt + wt * 2, wo),
      Matter.Bodies.rectangle(Wt + wt / 2, Lt / 2, wt, Lt + wt * 2, wo),
      Matter.Bodies.rectangle(Wt / 2, -wt / 2, Wt + wt * 2, wt, wo),
      Matter.Bodies.rectangle(Wt / 2, Lt + wt / 2, Wt + wt * 2, wt, wo)
    ];
    Composite.add(world, walls);

    /* ---- drinks ---- */
    function makeDrink(tier, x, y, scale) {
      var d = tiers[tier - 1];
      var body = Matter.Bodies.circle(x, y, d.r, {
        density: P.density,
        friction: P.friction,
        frictionStatic: 0,
        restitution: P.restitution,
        frictionAir: P.frictionAir,
        slop: P.slop,
        sleepThreshold: P.sleepThreshold,
        inertia: Infinity,
        label: 'drink'
      }, 40);
      body.plugin = { drink: true, tier: tier, born: g.time, scale: 1, dead: false, overT: 0, popT: -1 };
      if (scale && scale < 1) {
        Body.scale(body, scale, scale);
        Body.setInertia(body, Infinity);
        body.plugin.scale = scale;
      }
      Composite.add(world, body);
      g.drinks.push(body);
      if (tier > g.maxTier) g.maxTier = tier;
      return body;
    }

    function removeDrink(body) {
      body.plugin.dead = true;
      Composite.remove(world, body);
      var i = g.drinks.indexOf(body);
      if (i >= 0) g.drinks.splice(i, 1);
    }

    g.radiusOf = function (body) {
      return tiers[body.plugin.tier - 1].r * body.plugin.scale;
    };

    /* ---- dealing ---- */
    function dealRandom() {
      var w = cfg.deal.weights;
      var sum = 0, i;
      for (i = 0; i < w.length; i++) sum += w[i];
      var r = rng() * sum;
      for (i = 0; i < w.length; i++) {
        r -= w[i];
        if (r < 0) return i + 1;
      }
      return w.length;
    }

    /* After the soft cap: deal the dealt tier whose drink on the table is easiest to hit (nearest the player). */
    function dealHelpful() {
      var best = 0, bestY = -Infinity;
      for (var i = 0; i < g.drinks.length; i++) {
        var b = g.drinks[i];
        var t = b.plugin.tier;
        if (t > cfg.deal.weights.length) continue;
        if (b.position.y > bestY) { bestY = b.position.y; best = t; }
      }
      return best || 1;
    }

    function deal() { return g.helpful ? dealHelpful() : dealRandom(); }

    g.aimRange = function (tier) {
      var r = tiers[(tier || 1) - 1].r;
      return { min: r + 2, max: Wt - r - 2 };
    };

    g.aim = function (x) {
      var rg = g.aimRange(g.held || g.next || 1);
      g.aimX = Math.max(rg.min, Math.min(rg.max, x));
    };

    g.touch = function () {
      if (!g.started && g.state === 'play') {
        g.started = true;
        emit('first_touch', {});
      }
    };

    g.canLaunch = function () {
      return g.state === 'play' && g.held != null && g.cooldown <= 0;
    };

    g.launch = function () {
      g.touch();
      if (!g.canLaunch()) return false;
      var tier = g.held;
      g.aim(g.aimX);
      var body = makeDrink(tier, g.aimX, TB.heldY);
      Body.setVelocity(body, { x: 0, y: -P.launchSpeed / 60 });
      body.plugin.launched = true;
      g.held = null;
      g.cooldown = Tm.cooldown;
      g.launches++;
      /* the menu strip lights a drink the first time it is on the table from the player's hand or a merge */
      g.lit[tier] = true;
      emit('drop', { tier: tier, x: Math.round(g.aimX), n: g.launches });
      return true;
    };
    g.drop = g.launch;

    /* ---- merging ---- */
    var pending = [];
    var mergeEnabled = false;

    function collect(ev) {
      if (!mergeEnabled) return;
      var pairs = ev.pairs;
      for (var i = 0; i < pairs.length; i++) {
        var a = pairs[i].bodyA.parent, b = pairs[i].bodyB.parent;
        if (!a.plugin || !b.plugin || !a.plugin.drink || !b.plugin.drink) continue;
        if (a.plugin.tier !== b.plugin.tier || a.plugin.tier >= maxTierN) continue;
        pending.push(a, b);
      }
    }
    Matter.Events.on(engine, 'collisionStart', collect);
    Matter.Events.on(engine, 'collisionActive', collect);

    /* Same-tier footprints within mergeReach (catches pairs that are both asleep, which Matter skips). */
    function collectNear() {
      if (!mergeEnabled) return;
      var d = g.drinks;
      for (var i = 0; i < d.length; i++) {
        var a = d[i];
        if (a.plugin.tier >= maxTierN) continue;
        for (var j = i + 1; j < d.length; j++) {
          var b = d[j];
          if (a.plugin.tier !== b.plugin.tier) continue;
          var dx = a.position.x - b.position.x, dy = a.position.y - b.position.y;
          var rr = g.radiusOf(a) + g.radiusOf(b) + P.mergeReach;
          if (dx * dx + dy * dy <= rr * rr) pending.push(a, b);
        }
      }
    }

    function processMerges() {
      if (!pending.length) return;
      var used = new Set();
      var list = pending;
      pending = [];
      for (var i = 0; i < list.length; i += 2) {
        var a = list[i], b = list[i + 1];
        if (a.plugin.dead || b.plugin.dead || used.has(a) || used.has(b)) continue;
        if (g.state !== 'play') continue;
        used.add(a);
        used.add(b);
        mergePair(a, b);
      }
    }

    function mergePair(a, b) {
      var tier = a.plugin.tier + 1;
      var d = tiers[tier - 1];
      var x = (a.position.x + b.position.x) / 2;
      var y = (a.position.y + b.position.y) / 2;
      var va = Body.getVelocity(a), vb = Body.getVelocity(b);
      removeDrink(a);
      removeDrink(b);
      var r0 = d.r * P.growFrom;
      x = Math.max(r0 + 1, Math.min(Wt - r0 - 1, x));
      y = Math.max(r0 + 1, Math.min(Lt - r0 - 1, y));
      var body = makeDrink(tier, x, y, P.growFrom);
      Body.setVelocity(body, { x: (va.x + vb.x) / 2, y: (va.y + vb.y) / 2 });
      body.plugin.popT = g.time;
      body.plugin.born = g.time;
      g.merges++;
      emit('merge', { tier: tier, x: Math.round(x), y: Math.round(y) });
      if (!g.made[tier]) {
        g.made[tier] = true;
        g.lit[tier] = true;
        g.fx.push({ type: 'name', tier: tier, x: x, y: y, t0: g.time, dur: Tm.nameShow });
        emit('tier_first', { tier: tier, name: d.name });
      }
      g.fx.push({ type: 'pop', tier: tier, x: x, y: y, t0: g.time, dur: 0.35 });
      if (tier === cfg.heroTier) startWin(body);
    }

    /* ---- win / fail ---- */
    function finish(outcome) {
      g.result = {
        outcome: outcome,
        drops: g.launches,
        seconds: Math.round(g.playTime * 10) / 10,
        maxTier: g.maxTier,
        merges: g.merges,
        seed: g.seed
      };
    }

    function startWin(body) {
      g.state = 'win';
      g.hero = { x: body.position.x, y: body.position.y, t: 0, k: 0 };
      removeDrink(body);
      engine.timing.timeScale = Tm.winSlowScale;
      finish('win');
      emit('win', { drops: g.launches, seconds: g.result.seconds });
    }

    function failRound() {
      g.state = 'fail';
      finish('fail');
      emit('fail', { drops: g.launches, seconds: g.result.seconds, maxTier: g.maxTier });
    }

    function isSettled(b) {
      return b.isSleeping || Body.getSpeed(b) * 60 < P.settleSpeed;
    }

    function checkOverflow(dt) {
      for (var i = 0; i < g.drinks.length; i++) {
        var b = g.drinks[i], pl = b.plugin;
        if (g.time - pl.born < Tm.spawnGrace) { pl.overT = 0; continue; }
        var front = TB.failEdge ? b.position.y + g.radiusOf(b) : b.position.y;
        if (isSettled(b) && front > TB.launchLineY) {
          pl.overT += dt;
          if (pl.overT >= Tm.failHold) { failRound(); return; }
        } else {
          pl.overT = 0;
        }
      }
    }

    g.dangerLevel = function () {
      var m = 0;
      for (var i = 0; i < g.drinks.length; i++) m = Math.max(m, g.drinks[i].plugin.overT / Tm.failHold);
      return m;
    };

    /* ---- the fixed step ---- */
    /*
      Matter leaves a sleeping drink where it is even when an awake one presses into it slowly (a merge
      growing, a squeeze against a wall), so a pair overlapping deeper than wakeDepth wakes both.
    */
    function wakeDeepContacts() {
      var list = engine.pairs.list;
      for (var i = 0; i < list.length; i++) {
        var pr = list[i];
        if (!pr.isActive || !pr.collision || pr.collision.depth < P.wakeDepth) continue;
        var a = pr.bodyA.parent, b = pr.bodyB.parent;
        if (a.isSleeping && !a.isStatic) Sleeping.set(a, false);
        if (b.isSleeping && !b.isStatic) Sleeping.set(b, false);
      }
    }

    function physicsStep(dt) {
      Matter.Engine.update(engine, dt * 1000);
      wakeDeepContacts();
      var ts = engine.timing.timeScale;
      var dec = P.slideDecel * dt * ts / 60;
      var vmax = P.maxSpeed / 60;
      var growInc = (1 - P.growFrom) / P.growSteps;
      for (var i = 0; i < g.drinks.length; i++) {
        var b = g.drinks[i], pl = b.plugin;
        if (pl.scale < 1) {
          var ns = Math.min(1, pl.scale + growInc);
          Body.scale(b, ns / pl.scale, ns / pl.scale);
          Body.setInertia(b, Infinity);
          pl.scale = ns;
        }
        if (b.isSleeping) continue;
        /* constant sliding friction: a definite stop, no endless creep */
        var v = Body.getVelocity(b);
        var sp = Math.sqrt(v.x * v.x + v.y * v.y);
        if (sp <= dec) {
          if (sp > 0) Body.setVelocity(b, { x: 0, y: 0 });
        } else {
          var k = (sp - dec) / sp;
          if (sp - dec > vmax) k = vmax / sp;
          Body.setVelocity(b, { x: v.x * k, y: v.y * k });
        }
      }
      magnet(dt);
      collectNear();
      processMerges();
    }

    function magnet(dt) {
      if (!mergeEnabled || !(P.magnetRange > 0 || P.magnetFrac > 0) || g.state !== 'play') return;
      var dv = P.magnetPull * dt / 60;
      var vmax = P.magnetMax / 60;
      var d = g.drinks;
      for (var i = 0; i < d.length; i++) {
        var a = d[i];
        if (a.plugin.tier >= maxTierN || a.plugin.tier < P.magnetMinTier) continue;
        for (var j = i + 1; j < d.length; j++) {
          var b = d[j];
          if (a.plugin.tier !== b.plugin.tier) continue;
          var dx = b.position.x - a.position.x, dy = b.position.y - a.position.y;
          var dist = Math.sqrt(dx * dx + dy * dy) || 1;
          var rs = g.radiusOf(a) + g.radiusOf(b);
          /* depth gaps count shorter (magnetDepth), as the perspective view shows them */
          var kd = P.magnetDepth || 1;
          var seen = kd === 1 ? dist : Math.sqrt(dx * dx + dy * dy * kd * kd);
          if (seen - rs > P.magnetRange + P.magnetFrac * rs) continue;
          var ux = dx / dist, uy = dy / dist;
          /* only pull when nothing stands between them, or the pull presses drinks into a third one */
          if (P.magnetLineOfSight && blocked(a, b, ux, uy, dist)) continue;
          pull(a, ux, uy, dv, vmax);
          pull(b, -ux, -uy, dv, vmax);
        }
      }
    }

    /* does any other drink's footprint cross the corridor between a and b (width of the smaller drink)? */
    function blocked(a, b, ux, uy, dist) {
      var half = Math.min(g.radiusOf(a), g.radiusOf(b)) * 0.8;
      var d = g.drinks;
      for (var k = 0; k < d.length; k++) {
        var c = d[k];
        if (c === a || c === b) continue;
        var cx = c.position.x - a.position.x, cy = c.position.y - a.position.y;
        var along = cx * ux + cy * uy;
        if (along <= 0 || along >= dist) continue;
        var side = Math.abs(cx * uy - cy * ux);
        if (side < g.radiusOf(c) + half) return true;
      }
      return false;
    }

    function pull(b, ux, uy, dv, vmax) {
      if (b.isSleeping) Sleeping.set(b, false);
      var v = Body.getVelocity(b);
      if (v.x * ux + v.y * uy >= vmax) return;
      /* the sliding friction removes dec each step, so add it back along the pull */
      Body.setVelocity(b, { x: v.x + ux * dv, y: v.y + uy * dv });
    }

    g.stepFixed = function () {
      var dt = P.step;
      if (g.state === 'play' || g.state === 'win' || g.state === 'settling') physicsStep(dt);
      g.time += dt * engine.timing.timeScale;
      if (g.state === 'play') {
        if (g.started) g.playTime += dt;
        if (g.cooldown > 0) {
          g.cooldown -= dt;
          if (g.cooldown <= 0 && g.held == null) {
            g.held = g.next;
            g.next = deal();
            g.aim(g.aimX);
          }
        }
        if (!g.helpful && g.playTime >= Tm.softCap) g.helpful = true;
        checkOverflow(dt);
      } else if (g.state === 'win') {
        var h = g.hero;
        h.t += dt;
        var k = Math.min(1, h.t / Tm.heroRise);
        h.k = 1 - Math.pow(1 - k, 3);
        if (h.t >= Tm.heroRise + Tm.endCardDelay) g.state = 'won';
      }
    };

    /* Advance by real seconds with an accumulator (the view calls this each frame). */
    var acc = 0;
    g.update = function (realDt, speed) {
      speed = speed || 1;
      acc += Math.min(realDt, 0.1) * speed;
      var maxSteps = P.maxStepsPerFrame * Math.max(1, Math.ceil(speed));
      var n = 0;
      while (acc >= P.step && n < maxSteps) {
        g.stepFixed();
        acc -= P.step;
        n++;
      }
      if (n >= maxSteps) acc = 0;
    };

    /*
      First drink hit by a drink of radius r sliding straight up from (x, heldY).
      Returns { body, y } where y is the table y the slider's centre reaches (far wall if nothing).
    */
    g.firstHit = function (x, r) {
      var best = null, bestY = r;
      for (var i = 0; i < g.drinks.length; i++) {
        var b = g.drinks[i];
        var rb = g.radiusOf(b);
        var dx = Math.abs(b.position.x - x);
        if (dx >= r + rb) continue;
        if (b.position.y >= TB.heldY) continue;
        var cy = b.position.y + Math.sqrt((r + rb) * (r + rb) - dx * dx);
        if (cy > bestY) { bestY = cy; best = b; }
      }
      return { body: best, y: bestY };
    };

    /* ---- pre-stock and settle (overlaps resolve, nothing merges) ---- */
    for (var p = 0; p < cfg.prestock.length; p++) {
      var s = cfg.prestock[p];
      makeDrink(s.tier, s.x, s.y);
    }
    var maxSettle = Math.round(Tm.settleMax / P.step);
    for (var st = 0; st < maxSettle; st++) {
      physicsStep(P.step);
      if (st > 10 && g.drinks.every(function (b) { return b.isSleeping || Body.getSpeed(b) === 0; })) break;
    }
    g.settleSteps = st;
    g.drinks.forEach(function (b) { b.plugin.born = -10; });
    g.time = 0;

    (function () {
      var c = 0, d = g.drinks;
      for (var i = 0; i < d.length; i++) {
        for (var j = i + 1; j < d.length; j++) {
          if (d[i].plugin.tier !== d[j].plugin.tier) continue;
          var dx = d[i].position.x - d[j].position.x, dy = d[i].position.y - d[j].position.y;
          var rr = g.radiusOf(d[i]) + g.radiusOf(d[j]) + P.mergeReach;
          if (dx * dx + dy * dy <= rr * rr) c++;
        }
      }
      g.autoMergesAtStart = c;
    })();

    mergeEnabled = true;
    g.state = 'play';
    g.held = deal();
    g.next = deal();
    g.aim(g.aimX);
    return g;
  }

  /* ------------------------------------------------------------------
     Bots. greedy: aim at a matching drink reachable in a straight line, else the emptiest lane.
     random: anywhere. Same code drives the page and sim.mjs.
     ------------------------------------------------------------------ */
  function createBot(kind, seed, cfg) {
    cfg = cfg || CONFIG;
    var rng = mulberry32(((seed >>> 0) * 40503 + 7777) >>> 0);
    var wait = 0;

    function chooseGreedy(g) {
      var tier = g.held;
      var r = g.tiers[tier - 1].r;
      var rg = g.aimRange(tier);
      var step = cfg.bot.scanStep;
      var bestMatch = null, bestMatchScore = -Infinity;
      var bestLane = (rg.min + rg.max) / 2, bestLaneY = Infinity;
      var bestNear = null, bestNearD = Infinity;
      var bestFront = null, bestFrontY = -Infinity, frontMax = g.cfg.table.launchLineY - r - cfg.bot.frontMargin;
      var same = g.drinks.filter(function (b) { return b.plugin.tier === tier; });
      for (var x = rg.min; x <= rg.max + 0.01; x += step) {
        var h = g.firstHit(x, r);
        if (h.body && h.body.plugin.tier === tier) {
          var score = -Math.abs(h.body.position.x - x);
          if (score > bestMatchScore) { bestMatchScore = score; bestMatch = x; }
        }
        /* no clean hit: land as close as possible to a drink of the same kind (the pull can finish the job) */
        for (var k = 0; k < same.length; k++) {
          var dx = same[k].position.x - x, dy = same[k].position.y - h.y;
          var dd = Math.sqrt(dx * dx + dy * dy) - g.radiusOf(same[k]) - r;
          if (dd < bestNearD) { bestNearD = dd; bestNear = x; }
        }
        if (h.y <= frontMax && h.y > bestFrontY) { bestFrontY = h.y; bestFront = x; }
        var laneY = h.y + Math.abs(x - (rg.min + rg.max) / 2) * 0.001;
        if (laneY < bestLaneY) { bestLaneY = laneY; bestLane = x; }
      }
      if (bestMatch != null) return bestMatch;
      if (bestNear != null && bestNearD < cfg.bot.nearReach) return bestNear;
      /* 'front': park it where it stops soonest while staying clear of the line (keeps the pile together) */
      if (cfg.bot.fallback === 'front' && bestFront != null) return bestFront;
      return bestLane;
    }

    function chooseRandom(g) {
      var rg = g.aimRange(g.held);
      return rg.min + rng() * (rg.max - rg.min);
    }

    return {
      kind: kind,
      tick: function (g, dt) {
        if (!g.canLaunch()) { wait = 0; return; }
        wait += dt;
        if (wait < cfg.bot.think) return;
        wait = 0;
        g.aim(kind === 'random' ? chooseRandom(g) : chooseGreedy(g));
        g.launch();
      }
    };
  }

  /* Play one round headless, round one only, no retry. */
  function playRound(Matter, opts) {
    var g = createGame(Matter, { config: opts.config, seed: opts.seed, onEvent: opts.onEvent });
    var bot = createBot(opts.bot, opts.seed, opts.config);
    var dt = g.cfg.physics.step;
    var limit = Math.round(g.cfg.timings.hardStop / dt);
    for (var i = 0; i < limit; i++) {
      bot.tick(g, dt);
      g.stepFixed();
      if (g.state !== 'play') break;
    }
    if (!g.result) {
      g.result = { outcome: 'stuck', drops: g.launches, seconds: Math.round(g.playTime * 10) / 10, maxTier: g.maxTier, merges: g.merges, seed: g.seed };
    }
    g.result.autoMergesAtStart = g.autoMergesAtStart;
    return g.result;
  }

  return {
    CONFIG: CONFIG,
    createGame: createGame,
    createBot: createBot,
    createProjection: createProjection,
    playRound: playRound,
    mulberry32: mulberry32,
    median: median,
    cupShape: cupShape
  };
});
