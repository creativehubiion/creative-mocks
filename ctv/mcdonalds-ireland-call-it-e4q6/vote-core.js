/* Call It: interactive CTV core, McDonald's-themed build (run mcdonalds-ie-01, stage 05-build).
   Extended from the greybox core (03-greyboxes/_core/vote-core.js). The view file (index.html) supplies the layout CSS
   and an html(P) function that places the parts (P.ground, P.logo, P.rule, P.keys, P.timer, P.tiles, P.status, P.hero,
   P.outro, P.fx). Everything else lives here: the timeline on the spot's own clock, the input queue, the state, the
   attract bot, the theme, the effects, the sounds and the page contract.
   Theming is data: colours, fonts, the logo and the treat pictures come only from CONFIG.theme and CONFIG.treats
   (turned into CSS variables --c-* and --f-* on .tv).
   Page contract: ?embed=1 (fill the window, no preview chrome) . ?attract (plays itself, loops 1.5 s after the
   spot ends) . ?mute (testing: stays muted whatever is pressed, no sound chip, no effects) . ?t=<s> (jump the spot) .
   ?pick=<0-3> (lock that treat, for checking states with ?t) . ?safe (5% safe-area outline).
   window.DEMO = { start, slotMs, setAuto, setSound }. Every press posts { iionKey: 'left' | 'right' | 'ok' } to
   the parent, throttled to one per 260 ms per key.
   Sound: the spot's own audio is the soundtrack. Five short WebAudio effects sit quietly on top (move, lock, reveal
   rise, win sting, soft other-way note). The AudioContext is made only once sound is on, which happens only after a
   key or click in the page (preview) or DEMO.setSound(true) from the host page. Under ?mute nothing sounds at all;
   under ?embed or ?attract nothing sounds until the host calls DEMO.setSound(true).
   Plain script, no build step, ES2018. Usage: VoteCore.run(VIEW). */
(function () {
  'use strict';

  var CONFIG = {
    spot: 'assets/spot.mp4',
    /* change this token whenever spot.mp4 changes (cache busting) */
    spotV: '20261113c',
    slotMs: 30000,
    /* seconds on the spot's clock */
    t: {
      panelIn: 3.0,
      voteStart: 4.0,
      voteEnd: 12.0,
      /* the last seconds of the vote bar get the urgent treatment */
      urgentSecs: 2.0,
      /* after the lock: a short hold, the counting beat, the four-bar reveal, then the hero */
      lockHold: 0.35,
      countSecs: 1.4,
      revealSecs: 4.0,
      heroAfter: 2.2,
      panelOut: 27.0,
      /* the spot's very last frames (from about 30.0 s) are black: the unit stops here so the end card holds */
      endAt: 29.85,
      squeezeSecs: 0.9
    },
    /* names exactly as McDonald's Ireland writes them on its desserts page; img: path from the view folder */
    treats: [
      { name: 'Oreo® McFlurry®', img: 'assets/treats/oreo-mcflurry.png' },
      { name: 'Apple Pie', img: 'assets/treats/apple-pie.png' },
      { name: 'Sugar Donut', img: 'assets/treats/sugar-donut.png' },
      { name: 'Strawberry Milkshake', img: 'assets/treats/strawberry-milkshake.png' }
    ],
    startSel: 1,
    /* SAMPLE FIGURES ONLY, not real data: a fixed "Ireland's vote" for the mock, same order as treats */
    tally: [41, 27, 19, 13],
    /* visual only: how far each bar runs ahead of or behind its share mid-race (points); every bar lands on its tally */
    race: [-6, 7, 3, -2],
    theme: {
      colors: {
        /* the ground is sampled from the spot's red end card (centre about #D9000A, edges about #860000) and set on
           McDonald's red #DA291C so the L sits in the same red world the spot ends on */
        groundLight: '#E5301F',
        ground: '#DA291C',
        groundMid: '#B9160E',
        groundDeep: '#860A05',
        text: '#FFFFFF',
        textSoft: 'rgba(255,255,255,.86)',
        yellow: '#FFC72C',
        yellowLight: '#FFD95E',
        yellowDeep: '#F2A900',
        ink: '#27251F',
        inkRed: '#8A1209',
        shade: 'rgba(70,0,0,.55)',
        track: 'rgba(70,0,0,.42)',
        glow: 'rgba(255,199,44,.62)',
        key: '#FFFFFF',
        keyInk: '#DA291C',
        keyEdge: 'rgba(90,0,0,.55)'
      },
      fonts: {
        display: '"Speedee",Arial,Helvetica,sans-serif',
        body: '"Speedee",Arial,Helvetica,sans-serif',
        faces: [
          { family: 'Speedee', src: 'assets/fonts/Speedee-Bold.ttf', weight: 700, format: 'truetype' },
          { family: 'Speedee', src: 'assets/fonts/Speedee-Regular.otf', weight: 400, format: 'opentype' }
        ]
      },
      logo: 'assets/brand/golden-arches.svg',
      /* confetti for "You called it.": arches yellow, a deeper gold, a light gold and white */
      confetti: ['#FFC72C', '#FFC72C', '#F2A900', '#FFD95E', '#FFFFFF']
    },
    lines: {
      rule: "Vote for your family's favourite treat",
      /* the part of the rule set in yellow */
      ruleAccent: 'favourite treat',
      /* how the column sets these lines (same words, chosen breaks; the column text is 16cqw wide) */
      ruleLines: ["Vote for your", "family's", 'favourite', 'treat'],
      calledLines: ['You', 'called it.'],
      ownWayLines: ['Your family', 'goes its', 'own way.'],
      move: 'Move',
      lock: 'Lock',
      counting: "Counting Ireland's vote",
      reveal: "Ireland's vote",
      called: 'You called it.',
      ownWay: 'Your family goes its own way.',
      pickedForYou: 'Picked for you',
      heroEyebrow: "Your family's favourite",
      chip: 'Preview: press any key or click for sound'
    },
    /* the attract bot: a first-timer on a remote */
    bot: { firstMove: [0.9, 1.3], stepGap: [0.34, 0.48], lockFrac: [0.56, 0.64] },
    keyThrottleMs: 260,
    attractRestartMs: 1500,
    /* effect loudness under the spot (0..1, master) */
    sfxVolume: 0.5
  };

  var Q = new URLSearchParams(location.search);
  var EMBED = Q.has('embed') && Q.get('embed') !== '0';
  var ATTRACT = Q.has('attract');
  var MUTE = Q.has('mute');
  var T = CONFIG.t;
  var TOP = CONFIG.tally.indexOf(Math.max.apply(null, CONFIG.tally));
  var rand = function (r) { return r[0] + Math.random() * (r[1] - r[0]); };
  var clamp = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); };
  /* registered marks set small and raised, as on McDonald's own menu */
  var nameHtml = function (s) { return esc(s).replace(/®/g, '<sup>®</sup>'); };

  function themeCss() {
    var th = CONFIG.theme, out = [];
    th.fonts.faces.forEach(function (f) {
      out.push('@font-face{font-family:"' + f.family + '";src:url("' + f.src + '")' + (f.format ? ' format("' + f.format + '")' : '') +
        ';font-weight:' + (f.weight || 400) + ';font-style:' + (f.style || 'normal') + ';font-display:block}');
    });
    var vars = Object.keys(th.colors).map(function (k) { return '--c-' + k + ':' + th.colors[k]; });
    vars.push('--f-display:' + th.fonts.display, '--f-body:' + th.fonts.body);
    out.push('.tv{' + vars.join(';') + '}');
    return out.join('\n');
  }

  /* shared easing: quick out, and a small overshoot for punches */
  var EASE = 'cubic-bezier(.22,.8,.3,1)';
  var POP = 'cubic-bezier(.3,1.5,.5,1)';

  var CORE_CSS = [
    'html,body{margin:0;height:100%;background:#000;overflow:hidden}',
    'body{display:flex;align-items:center;justify-content:center}',
    '.tv{position:relative;width:min(100vw,calc(100vh*16/9));aspect-ratio:16/9;container-type:size;overflow:hidden;background:#000;font-family:var(--f-body);color:var(--c-text);-webkit-font-smoothing:antialiased}',
    '.spot{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:contain;background:transparent;z-index:3;transform-origin:100% 0;',
    'transition:transform ' + T.squeezeSecs + 's cubic-bezier(.65,0,.25,1)}',
    '.panel{position:absolute;inset:0;z-index:2;pointer-events:none}',
    'sup{font-size:.5em;line-height:0;vertical-align:.85em;margin-left:.04em}',

    /* the ground: one light across the whole L */
    '.ground{position:absolute;inset:0;background:radial-gradient(70% 80% at 30% 86%,var(--c-groundLight) 0%,var(--c-ground) 34%,var(--c-groundMid) 68%,var(--c-groundDeep) 100%)}',

    '.logo{position:absolute;z-index:2}',
    '.logo img{display:block;height:100%;width:auto}',
    '.rule,.status{position:absolute;font-family:var(--f-display);font-weight:700;line-height:1.06;color:var(--c-text);letter-spacing:-.005em}',
    '.rule em{font-style:normal;color:var(--c-yellow)}',
    '.rule{transition:opacity .3s ' + EASE + ',transform .3s ' + EASE + '}',
    '.g-lock .rule{opacity:0;transform:translateY(-1.5cqh)}',

    /* the vote bar */
    '.timer{position:absolute;display:flex;align-items:center;gap:1.2cqw;transition:opacity .3s}',
    '.timer .track{position:relative;flex:1 1 auto;height:2cqh;border-radius:1cqh;background:var(--c-track);overflow:hidden;transition:transform .3s ' + EASE + '}',
    '.timer .track i{position:absolute;inset:0;border-radius:1cqh;background:var(--c-yellow);transform-origin:left center;transition:background-color .3s}',
    '.timer .count{flex:0 0 auto;min-width:2.6cqw;text-align:right;font:700 4cqh/1 var(--f-display);color:var(--c-yellow);transform-origin:100% 50%;transition:transform .25s ' + POP + ',color .25s}',
    '.urgent .timer .track{animation:beat .5s ease-in-out infinite alternate}',
    '.urgent .timer .track i{background:var(--c-text)}',
    '.urgent .timer .count{color:var(--c-text);transform:scale(1.35)}',
    '@keyframes beat{from{transform:scaleY(1)}to{transform:scaleY(1.45)}}',
    '.g-lock .timer{opacity:0}',

    /* the key hint: keys drawn as keys */
    '.keys{position:absolute;display:flex;flex-direction:column;align-items:flex-start;gap:1.5cqh;transition:opacity .3s}',
    '.keys .k{display:flex;align-items:center;gap:.7cqw}',
    '.keys em{font-style:normal;font:700 2.7cqh/1 var(--f-display);color:var(--c-text);margin-left:.4cqw}',
    '.keys kbd{display:inline-grid;place-items:center;width:4.6cqh;height:4.6cqh;box-sizing:border-box;border-radius:.8cqh;background:var(--c-key);box-shadow:0 .45cqh 0 var(--c-keyEdge)}',
    '.keys kbd svg{width:1.9cqh;height:1.9cqh;display:block;fill:var(--c-keyInk)}',
    '.keys kbd.ok{width:5.2cqh;height:5.2cqh;border-radius:50%;background:var(--c-yellow);font:700 2.3cqh/1 var(--f-display);color:var(--c-ink)}',
    '.g-lock .keys{opacity:0}',

    /* the treats: pictures on the ground, no cards. Each slot is as wide as its picture or its name needs (set by
       layoutSlots below, --slotw), so the wide apple pie and the tall milkshake share one baseline at full height */
    '.tiles{position:absolute;display:flex}',
    '.tile{position:relative;flex:0 0 var(--slotw,17cqw);pointer-events:auto;cursor:pointer;transition:opacity .3s ' + EASE + '}',
    '.stage{position:absolute;left:50%;z-index:2;width:calc(var(--slotw,17cqw) - .8cqw);transform-origin:50% 100%;transition:transform .28s ' + POP + '}',
    '.stage .pic{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:50% 100%;z-index:3;transform-origin:50% 100%;transition:transform .28s ' + POP + '}',
    '.stage .cshadow{position:absolute;left:50%;bottom:-.9cqh;width:var(--sw,9cqw);height:2.2cqh;transform:translateX(-50%);border-radius:50%;background:radial-gradient(closest-side,rgba(60,0,0,.62),rgba(60,0,0,.28) 55%,rgba(60,0,0,0));z-index:2;transition:transform .28s ' + EASE + ',opacity .28s}',
    /* plate, ring and glow never reach past their own slot, even focused (x1.08) */
    '.stage .plate,.stage .ring{position:absolute;left:50%;bottom:-1.9cqh;width:min(calc(var(--slotw,17cqw) * .84),calc(var(--sw,9cqw) + 3.4cqw));height:4.2cqh;border-radius:50%}',
    '.stage .plate{transform:translateX(-50%) scale(.6);background:radial-gradient(closest-side,var(--c-yellowLight),var(--c-yellow) 62%,var(--c-yellowDeep));box-shadow:0 0 0 .5cqh #fff,0 0 2.4cqh .6cqh var(--c-glow);opacity:0;z-index:1;transition:transform .28s ' + POP + ',opacity .2s}',
    '.stage .ring{margin-left:calc(min(calc(var(--slotw,17cqw) * .84),calc(var(--sw,9cqw) + 3.4cqw)) / -2);box-sizing:border-box;border:.5cqh solid #fff;opacity:0;z-index:1}',
    '.stage .glow{position:absolute;left:50%;top:55%;width:calc(var(--slotw,17cqw) * .84);height:16cqh;transform:translate(-50%,-50%) scale(.7);border-radius:50%;background:radial-gradient(closest-side,rgba(255,217,94,.62),rgba(255,199,44,.26) 55%,rgba(255,199,44,0));opacity:0;z-index:0;transition:transform .3s ' + EASE + ',opacity .25s}',
    '.tile .name{position:absolute;left:50%;z-index:2;transform:translateX(-50%);white-space:nowrap;font:700 2.7cqh/1 var(--f-display);color:var(--c-textSoft);padding:.5cqh 1cqh .45cqh;border-radius:2cqh;transition:background-color .2s,color .2s,opacity .3s}',

    /* focus, from the sofa: lift and scale, a gold plate with a white rim, a glow, the name lights, the rest dims */
    '.g-vote .tile:not(.sel){opacity:.74}',
    '.g-vote .tile.sel .stage,.g-lock:not(.g-tally) .tile.mine .stage{transform:scale(1.08)}',
    '.g-vote .tile.sel .pic,.g-lock:not(.g-tally) .tile.mine .pic{transform:translateY(-.5cqh)}',
    '.g-vote .tile.sel .cshadow,.g-lock:not(.g-tally) .tile.mine .cshadow{transform:translateX(-50%) scale(.82);opacity:.75}',
    '.g-vote .tile.sel .plate,.g-lock .tile.mine .plate{opacity:1;transform:translateX(-50%) scale(1)}',
    '.g-vote .tile.sel .glow,.g-lock .tile.mine .glow{opacity:1;transform:translate(-50%,-50%) scale(1)}',
    '.g-vote .tile.sel .name,.g-lock .tile.mine .name{background:var(--c-yellow);color:var(--c-ink)}',
    '.g-lock:not(.g-tally) .tile:not(.mine){opacity:.6}',

    /* the lock: a press (down and back, never past the spot's edge), a white ring going out and a brighter glow */
    '.tile.punch .stage{animation:punch .4s ' + EASE + '}',
    '.tile.punch .ring{animation:ring .55s ' + EASE + '}',
    '.tile.punch .glow{animation:gpunch .5s ' + EASE + '}',
    '@keyframes punch{0%{transform:scale(1.08)}30%{transform:scale(.95)}65%{transform:scale(1.08)}82%{transform:scale(1.04)}100%{transform:scale(1.08)}}',
    '@keyframes ring{0%{opacity:1;transform:scale(1,1)}100%{opacity:0;transform:scale(1.08,1.8)}}',
    '@keyframes gpunch{0%{transform:translate(-50%,-50%) scale(1);opacity:1}35%{transform:translate(-50%,-50%) scale(1.06);opacity:1}100%{transform:translate(-50%,-50%) scale(1);opacity:1}}',

    /* the reveal: treats settle, bars rise out of them; each percentage sits in its own clear slot above its bar
       (never behind a picture, bar, crown or ring), and the band then holds this state to the end */
    '.bar{position:absolute;left:50%;z-index:1;overflow:hidden;opacity:0;transition:opacity .3s}',
    '.bar .fill{position:absolute;border-radius:.6cqh .6cqh 0 0;background:linear-gradient(90deg,var(--c-yellowDeep),var(--c-yellow) 30%,var(--c-yellowLight) 62%,var(--c-yellow));transition:opacity .35s}',
    '.bar .fill::after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:0 0 0 .45cqh #fff,0 0 2cqh .5cqh rgba(255,255,255,.45);opacity:0}',
    '.bar .crown{position:absolute;left:50%;top:.6cqh;width:4.6cqh;height:3.1cqh;margin-left:-2.3cqh;opacity:0}',
    '.bar .crown svg{display:block;width:100%;height:100%;fill:var(--c-inkRed)}',
    '.tpct{position:absolute;left:50%;z-index:4;width:10cqw;margin-left:-5cqw;text-align:center;font:700 4.4cqh/1 var(--f-display);color:var(--c-text);opacity:0;transition:opacity .25s}',
    '.g-tally .bar,.g-tally .tpct{opacity:1}',
    '.g-tally .tile .stage{transform:translateY(var(--settle,3.4cqh)) scale(.5)}',
    '.g-tally .tile .name{opacity:0}',
    '.g-tally .tile.mine .fill::after{opacity:1}',
    '.g-crown .tile.top .crown{animation:cpop .4s ' + POP + ' both,cbob 1.8s ease-in-out .4s infinite alternate}',
    '.g-crown .tile.top .tpct{color:var(--c-yellow)}',
    '.g-crown .tile:not(.top) .fill{opacity:.82}',
    /* the band stays alive to the end: the crown bobs, the pick's ring breathes */
    '.g-res .tile.mine .fill::after{animation:rbreathe 1.6s ease-in-out infinite alternate}',
    '@keyframes cpop{0%{opacity:0;transform:scale(.3)}100%{opacity:1;transform:scale(1)}}',
    '@keyframes cbob{from{opacity:1;transform:translateY(0) rotate(-4deg)}to{opacity:1;transform:translateY(-.5cqh) rotate(4deg)}}',
    '@keyframes rbreathe{from{opacity:1}to{opacity:.45}}',

    /* status in the left column while Ireland's vote counts; it sits just above the big picture (--stk) */
    '.status{top:var(--stk,28cqh);height:var(--sblock,12.7cqh);display:flex;flex-direction:column;justify-content:flex-end;opacity:0;transform:translateY(1.5cqh);transition:opacity .3s,transform .3s ' + EASE + '}',
    '.status .st{display:block}',
    '.status .dots{position:absolute}',
    '.g-lock .status{opacity:1;transform:none;transition:opacity .3s .15s,transform .3s ' + EASE + ' .15s}',
    '.g-res .status{opacity:0;transform:translateY(-1.5cqh);transition:opacity .25s,transform .3s ' + EASE + '}',

    /* the hero: the picked treat big in the column from the lock; when the outcome arrives it rises and scales down in
       one eased move (--hresy, --hress, set by fitHero) while the outcome line comes in under it */
    '.hero{position:absolute;inset:0}',
    '.hero .hstage{position:absolute;opacity:0;transform:translateY(var(--hpre,0));transform-origin:50% calc(100% - 4.2cqh);transition:opacity .3s}',
    '.g-lock .hero .hstage{opacity:1}',
    '.g-res .hero .hstage{transform:translateY(var(--hresy,0)) scale(var(--hress,1));transition:opacity .3s,transform .55s ' + EASE + '}',
    '.hero .hstack{position:absolute;top:var(--hst,60cqh);display:flex;flex-direction:column;align-items:center;text-align:center}',
    '.hero .hout,.hero .eyebrow,.hero .hname{opacity:0;transform:translateY(3cqh);transition:opacity .3s,transform .55s ' + EASE + '}',
    '.g-res .hero .hout,.g-res .hero .eyebrow,.g-res .hero .hname{opacity:1;transform:none}',
    '.g-res .hero .hout{transition-delay:.08s}',
    '.g-res .hero .eyebrow{transition-delay:.28s}',
    '.g-res .hero .hname{transition-delay:.36s}',
    '.hero .hout{font-family:var(--f-display);font-weight:700;line-height:1.02;color:var(--c-yellow);text-wrap:balance}',
    '.hstack.own .hout{color:var(--c-text)}',
    '.hero .eyebrow{margin-top:1.8cqh;font:700 2.6cqh/1.1 var(--f-display);color:var(--c-textSoft);white-space:nowrap}',
    '.hero .hname{margin-top:.9cqh;font:700 3.5cqh/1.04 var(--f-display);color:var(--c-yellow);text-wrap:balance}',
    '.ln{white-space:nowrap}',
    '.hero .rays{position:absolute;left:50%;top:50%;width:46cqh;height:46cqh;margin:-23cqh 0 0 -23cqh;border-radius:50%;',
    'background:repeating-conic-gradient(rgba(255,199,44,.2) 0deg 8deg,rgba(255,199,44,0) 8deg 22.5deg);',
    '-webkit-mask-image:radial-gradient(closest-side,#000 30%,rgba(0,0,0,0) 100%);mask-image:radial-gradient(closest-side,#000 30%,rgba(0,0,0,0) 100%);',
    'animation:spin 48s linear infinite}',
    '.hero .hplate{position:absolute;left:50%;bottom:1.4cqh;width:min(20cqw,calc(var(--hsw,14cqw) + 5cqw));height:5.6cqh;transform:translateX(-50%);border-radius:50%;',
    'background:radial-gradient(closest-side,var(--c-yellowLight),var(--c-yellow) 62%,var(--c-yellowDeep));box-shadow:0 0 0 .55cqh #fff,0 0 4cqh 1.4cqh var(--c-glow)}',
    '.hero .hshadow{position:absolute;left:50%;bottom:3cqh;width:var(--hsw,12cqw);height:2.6cqh;transform:translateX(-50%);border-radius:50%;background:radial-gradient(closest-side,rgba(110,40,0,.55),rgba(110,40,0,0));animation:breathe 3.6s ease-in-out infinite alternate}',
    '.hero .hfloat{position:absolute;left:2cqw;right:2cqw;top:1cqh;bottom:4.2cqh;animation:float 3.6s ease-in-out infinite alternate}',
    '.hero .hpic{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:50% 100%;transform-origin:50% 100%}',
    '.g-lock .hero .hpic{animation:hin .5s ' + POP + ' both}',
    '.hero .spark{position:absolute;width:2.6cqh;height:2.6cqh;background:var(--c-yellowLight);clip-path:polygon(50% 0,61% 39%,100% 50%,61% 61%,50% 100%,39% 61%,0 50%,39% 39%);opacity:0;animation:twinkle 2.8s ease-in-out infinite}',
    '.hero .spark.w{background:#fff;width:2cqh;height:2cqh}',
    /* the tag rides with the picture; --inv cancels the picture's result scale so its text keeps its size */
    '.hero .hsticker{position:absolute;left:var(--stx,70%);top:var(--sty,0);display:none;place-items:center;text-align:center;width:9.6cqh;height:9.6cqh;margin:-3cqh 0 0 -4.8cqh;border-radius:50%;background:var(--c-yellow);color:var(--c-ink);font:700 2.3cqh/1.02 var(--f-display);transform:rotate(-10deg);box-shadow:0 .5cqh 0 var(--c-shade);transition:transform .55s ' + EASE + '}',
    '.g-auto.g-lock .hero .hsticker{display:grid;animation:stin .4s ' + POP + ' .3s backwards}',
    '.g-res .hero .hsticker{transform:rotate(-10deg) scale(var(--inv,1))}',
    '@keyframes stin{0%{transform:rotate(-10deg) scale(.5);opacity:0}100%{transform:rotate(-10deg) scale(1);opacity:1}}',
    '@keyframes spin{to{transform:rotate(360deg)}}',
    '@keyframes float{from{transform:translateY(0) rotate(-1.4deg)}to{transform:translateY(-1.6cqh) rotate(1.4deg)}}',
    '@keyframes breathe{from{transform:translateX(-50%) scale(1);opacity:1}to{transform:translateX(-50%) scale(.84);opacity:.7}}',
    '@keyframes hin{0%{transform:scale(.55);opacity:0}100%{transform:scale(1);opacity:1}}',
    '@keyframes twinkle{0%,100%{opacity:0;transform:scale(.2) rotate(0deg)}45%{opacity:1;transform:scale(1) rotate(45deg)}70%{opacity:0;transform:scale(.4) rotate(70deg)}}',

    /* effects layer: confetti for the win, warm rising glows for the other way (under the spot, never on it) */
    '.fx{position:absolute;inset:0;overflow:hidden;z-index:4}',
    '.fx i{position:absolute;display:block;opacity:0;will-change:transform,opacity}',
    '.fx i.cf{animation:cf var(--d,1.6s) linear forwards}',
    '.fx i.wm{border-radius:50%;background:radial-gradient(closest-side,rgba(255,217,94,.85),rgba(255,199,44,0));animation:rise var(--d,2.6s) ' + EASE + ' forwards}',
    '@keyframes cf{0%{transform:translate(0,0) rotate(0deg) scale(.3);opacity:0;animation-timing-function:cubic-bezier(.15,.7,.35,1)}',
    '8%{opacity:1}',
    '40%{transform:translate(calc(var(--dx) * .6),var(--up)) rotate(calc(var(--r) * .45)) scale(1);opacity:1;animation-timing-function:cubic-bezier(.5,0,.8,.6)}',
    '100%{transform:translate(var(--dx),var(--dn)) rotate(var(--r)) scale(.9);opacity:0}}',
    '@keyframes rise{0%{transform:translate(0,0) scale(.4);opacity:0}25%{opacity:.85}100%{transform:translate(var(--dx),var(--up)) scale(1.1);opacity:0}}',

    /* the L fades in as the spot squeezes, and out as it returns */
    '.lcol,.lband{position:absolute;opacity:0;transition:opacity .4s}',
    '.g-on .lcol,.g-on .lband{opacity:1;transition:opacity .5s .55s}',

    /* preview chrome only (never on the review page) */
    '.chrome{position:absolute;z-index:6;font-family:var(--f-body)}',
    '.chip{right:5cqw;top:5cqh;font-weight:700;font-size:2.2cqh;color:#fff;background:rgba(39,37,31,.78);padding:.8cqh 1.6cqh .7cqh;border-radius:99px;transition:opacity .4s}',
    '.safe{left:5%;top:5%;right:5%;bottom:5%;outline:.25cqh dashed #ff3bd4;pointer-events:none;z-index:7}',
    '.embed .chip{display:none}'
  ].join('\n');

  var SVG_L = '<svg viewBox="0 0 10 10"><path d="M7.6 1.2v7.6L1.6 5z"/></svg>';
  var SVG_R = '<svg viewBox="0 0 10 10"><path d="M2.4 1.2v7.6L8.4 5z"/></svg>';
  var SVG_CROWN = '<svg viewBox="0 0 44 30"><path d="M3 9l9 7 10-13 10 13 9-7-4 18H7z"/><circle cx="3" cy="8" r="3"/><circle cx="22" cy="3" r="3"/><circle cx="41" cy="8" r="3"/></svg>';

  window.VoteCore = { CONFIG: CONFIG, run: function (VIEW) {
    var squeeze = +VIEW.squeeze || 0;
    /* bar geometry from the view, in cqh: full height, the part hidden behind the settled treat, the label height */
    var BAR = VIEW.bar || { max: 14, hidden: 3.5, label: 3.6 };

    var st = document.createElement('style');
    st.textContent = themeCss() + '\n' + CORE_CSS + '\n' +
      (squeeze ? '.tv.sq .spot{transform:scale(' + squeeze + ')}\n' : '') + (VIEW.css || '');
    document.head.appendChild(st);

    var L = CONFIG.lines, TH = CONFIG.theme;
    /* lines joined with breaks when the view's text width needs set breaks; words in ruleAccent are set in yellow */
    var linesHtml = function (lines, whole) {
      if (!lines || lines.join(' ') !== whole) return esc(whole);
      return lines.map(function (ln) { return '<span class="ln">' + esc(ln) + '</span>'; }).join('<br>');
    };
    var ruleHtml = linesHtml(L.ruleLines, L.rule);
    if (L.ruleAccent) {
      L.ruleAccent.split(' ').forEach(function (w) { ruleHtml = ruleHtml.replace('>' + esc(w) + '<', '><em>' + esc(w) + '</em><'); });
    }
    var sparks = [[8, 14, 0, ''], [80, 8, 0.9, ' w'], [88, 52, 1.7, ''], [4, 58, 2.3, ' w']].map(function (s) {
      return '<i class="spark' + s[3] + '" style="left:' + s[0] + '%;top:' + s[1] + '%;animation-delay:' + s[2] + 's"></i>';
    }).join('');
    var P = {
      ground: '<div class="ground"></div>',
      logo: '<div class="logo"><img src="' + esc(TH.logo) + '" alt="McDonald\'s"></div>',
      rule: '<div class="rule" id="rule">' + ruleHtml + '</div>',
      keys: '<div class="keys"><span class="k"><kbd>' + SVG_L + '</kbd><kbd>' + SVG_R + '</kbd><em>' + esc(L.move) + '</em></span>' +
        '<span class="k"><kbd class="ok">OK</kbd><em>' + esc(L.lock) + '</em></span></div>',
      timer: '<div class="timer"><div class="track"><i id="tfill"></i></div><b class="count" id="tcount"></b></div>',
      tiles: '<div class="tiles" id="tiles">' + CONFIG.treats.map(function (tr, i) {
        return '<div class="tile" data-i="' + i + '">' +
          '<div class="bar"><div class="fill"><span class="crown">' + SVG_CROWN + '</span></div></div><b class="tpct">0%</b>' +
          '<div class="stage"><i class="glow"></i><i class="plate"></i><i class="ring"></i><i class="cshadow"></i>' +
          '<img class="pic" src="' + esc(tr.img) + '" alt=""></div>' +
          '<span class="name">' + nameHtml(tr.name) + '</span></div>';
      }).join('') + '</div>',
      status: '<div class="status" id="status"><span class="st"><span id="stext"></span><span class="dots" id="sdots"></span></span></div>',
      hero: '<div class="hero" id="hero">' +
        '<div class="hstage" id="hstage"><i class="rays"></i>' + sparks + '<i class="hplate"></i><i class="hshadow"></i>' +
        '<div class="hfloat" id="hfloat"><img class="hpic" id="hpic" alt=""><span class="hsticker">' + esc(L.pickedForYou) + '</span></div></div>' +
        '<div class="hstack" id="hstack"><div class="hout" id="hout"></div><div class="eyebrow">' + esc(L.heroEyebrow) + '</div>' +
        '<div class="hname" id="hname"></div></div></div>',
      outro: '',
      fx: '<div class="fx" id="fx"></div>'
    };
    var chip = !EMBED && !ATTRACT && !MUTE;
    var html = '<div class="tv' + (EMBED ? ' embed' : '') + '" id="tv">' +
      '<video class="spot" id="spot" muted autoplay playsinline preload="auto"></video>' +
      '<div class="panel" id="panel">' + VIEW.html(P) + '</div>' +
      (chip ? '<div class="chrome chip" id="chip">' + esc(L.chip) + '</div>' : '') +
      (Q.has('safe') ? '<div class="chrome safe"></div>' : '') +
      '</div>';
    document.body.innerHTML = html;
    if (/\$\{|\{\{|undefined|NaN|BRAND LINE/.test(document.body.innerHTML)) {
      console.error('Call It: a template string or placeholder is left in the markup (look for ${, {{, undefined, NaN or BRAND LINE).');
    }

    var $ = function (id) { return document.getElementById(id); };
    var tv = $('tv'), spot = $('spot'), tiles = [].slice.call(document.querySelectorAll('.tile'));
    var tfill = $('tfill'), tcount = $('tcount'), statusEl = $('status'), stext = $('stext'), sdots = $('sdots');
    var hname = $('hname'), hpic = $('hpic'), hstage = $('hstage'), hfloatEl = $('hfloat'), hout = $('hout'), hstack = $('hstack'), fxEl = $('fx');

    spot.muted = true;
    spot.defaultMuted = true;
    spot.autoplay = true;
    spot.playsInline = true;
    if (MUTE) spot.volume = 0;
    spot.src = CONFIG.spot + '?v=' + CONFIG.spotV;

    /* the vote row: each slot gets the width its picture (at full height, focused) or its name needs, on one baseline;
       contact shadows and plates follow each picture's real width */
    var stageBox = VIEW.stage || { w: 14, h: 12 };
    var heroBox = VIEW.heroPic || { w: 20, h: 38 };
    function tvUnits() { var r = tv.getBoundingClientRect(); return { cw: r.width / 100, ch: r.height / 100, r: r }; }
    function layoutSlots() {
      var u = tvUnits();
      if (!u.cw) return;
      var W = VIEW.tilesW || 68, needs = [], pics = [], sum = 0;
      tiles.forEach(function (el) {
        var img = el.querySelector('.pic'), nm = el.querySelector('.name');
        var a = img.naturalWidth ? img.naturalWidth / img.naturalHeight : 1;
        var picW = stageBox.h * 0.5625 * a;
        var need = Math.max(nm.getBoundingClientRect().width / u.cw + 1.2, picW * 1.08 + 1.4);
        needs.push(need);
        pics.push(picW);
        sum += need;
      });
      tiles.forEach(function (el, i) {
        var slot = sum > W ? needs[i] * W / sum : needs[i] + (W - sum) / tiles.length;
        el.style.setProperty('--slotw', slot.toFixed(2) + 'cqw');
        el.style.setProperty('--sw', (Math.min(slot - 0.8, pics[i]) * 0.86).toFixed(2) + 'cqw');
      });
    }
    tiles.forEach(function (el) {
      var img = el.querySelector('.pic');
      if (!img.complete) img.addEventListener('load', layoutSlots);
    });
    layoutSlots();

    /* the hero picture: big under the status while Ireland's vote counts (--hpre, --stk), then the result size and
       place above the outcome line (--hresy, --hress, --hst), all in cqh of the TV */
    var resGeo = { picMid: 40, textTop: 62 };
    function fitHero() {
      if (!hpic.naturalWidth) return;
      var a = hpic.naturalWidth / hpic.naturalHeight;
      var vw = Math.min(heroBox.w, heroBox.h * 0.5625 * a);
      var vh = vw / (0.5625 * a);
      hstage.style.setProperty('--hsw', (vw * 0.8).toFixed(2) + 'cqw');
      /* the tag sits on the picture's own top-right corner (the picture is bottom-centred in the float box) */
      var sx = Math.min(heroBox.w / 2 + vw / 2 - 1.2, heroBox.stickerMaxX || heroBox.w - 1.4);
      hfloatEl.style.setProperty('--stx', sx.toFixed(2) + 'cqw');
      hfloatEl.style.setProperty('--sty', (heroBox.h - vh + 1).toFixed(2) + 'cqh');
      /* beat 1: status and picture as one stack centred under the arches */
      var PB = heroBox.picBottom, top0 = heroBox.areaTop, area = heroBox.areaBottom - heroBox.areaTop;
      var sb = heroBox.statusBlock, stk = Math.max(heroBox.statusMin, top0 + (area - (sb + 3 + vh + 4)) / 2);
      tv.style.setProperty('--stk', stk.toFixed(2) + 'cqh');
      var pre = Math.min(heroBox.preMax, stk + sb + 3 - (PB - vh));
      hstage.style.setProperty('--hpre', pre.toFixed(2) + 'cqh');
      /* beat 2: the outcome line under a smaller picture, the whole stack centred in the same area */
      var u = tvUnits(), textH = u.ch ? hstack.getBoundingClientRect().height / u.ch : 24;
      var gap = heroBox.textGap, head = 1.6;
      var vr = Math.min(vh, heroBox.resMax, area - head - textH - gap);
      var sc = vr / vh;
      var t = top0 + head + Math.max(0, (area - head - (vr + gap + textH)) / 2);
      var bottom = t + vr;
      hstage.style.setProperty('--hresy', (bottom - PB).toFixed(2) + 'cqh');
      hstage.style.setProperty('--hress', sc.toFixed(4));
      hfloatEl.style.setProperty('--inv', (1 / sc).toFixed(4));
      tv.style.setProperty('--hst', (bottom + gap).toFixed(2) + 'cqh');
      resGeo = { picMid: t + vr / 2, textTop: bottom + gap + 4 };
    }
    hpic.addEventListener('load', fitHero);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { layoutSlots(); fitHero(); });

    var S, plan, loops = 0, first = true, auto = ATTRACT, soundOn = false, queue = [], last = {};
    var lastPost = { left: 0, right: 0, ok: 0 };

    function fresh() { return { sel: CONFIG.startSel, lockAt: null, pick: null, autoPicked: false, forced: null, said: false, rose: false, done: false }; }

    /* the attract bot: about a second after the vote opens, one or two steps about 0.4 s apart, then OK at about
       60% of the bar. Alternate loops pick the top treat and a different one (one or two steps the other way). */
    function makePlan(base) {
      var target = loops % 2 === 1 ? TOP : (loops % 4 === 2 ? 2 : 3);
      if (target === CONFIG.startSel) target = 3;
      var steps = [], at = base + rand(CONFIG.bot.firstMove), sel = CONFIG.startSel;
      while (sel !== target) {
        steps.push({ at: at, k: target < sel ? 'prev' : 'next' });
        sel += target < sel ? -1 : 1;
        at += rand(CONFIG.bot.stepGap);
      }
      var lockAt = T.voteStart + (T.voteEnd - T.voteStart) * rand(CONFIG.bot.lockFrac);
      steps.push({ at: Math.max(lockAt, at + 0.3), k: 'ok' });
      return { steps: steps, i: 0 };
    }

    function seekPlay(t0) {
      var go = function () {
        try { spot.currentTime = t0; } catch (e) { }
        spot.muted = !soundOn;
        if (MUTE) spot.volume = 0;
        var p = spot.play();
        if (p && p.catch) p.catch(function () { spot.muted = true; soundOn = false; spot.play().catch(function () { }); });
      };
      if (spot.readyState >= 1) go(); else spot.addEventListener('loadedmetadata', go, { once: true });
    }

    function begin() {
      loops++;
      S = fresh();
      queue.length = 0;
      last = {};
      var t0 = 0;
      if (first) {
        t0 = Math.max(0, +(Q.get('t') || 0)) || 0;
        var pk = Q.get('pick');
        if (pk !== null && pk !== '' && +pk >= 0 && +pk < CONFIG.treats.length) { S.sel = +pk; S.forced = +pk; }
        first = false;
      }
      plan = makePlan(T.voteStart);
      tiles.forEach(function (el) { el.classList.remove('punch', 'top'); });
      fxEl.innerHTML = '';
      seekPlay(t0);
    }

    function phaseAt(t) {
      if (t < T.panelIn) return 'pre';
      if (t >= T.panelOut) return 'out';
      if (S.lockAt === null) return t < T.voteStart ? 'intro' : 'vote';
      var d = t - S.lockAt;
      if (d < T.lockHold) return 'locked';
      d -= T.lockHold;
      if (d < T.countSecs) return 'counting';
      d -= T.countSecs;
      if (d < T.revealSecs) return 'reveal';
      d -= T.revealSecs;
      if (d < T.heroAfter) return 'outcome';
      return 'hero';
    }
    function revealStart() { return S.lockAt + T.lockHold + T.countSecs; }

    /* ---- sound: five short synthesized effects, quiet under the spot ---- */
    var AC = null, master = null;
    function ac() {
      if (!soundOn || MUTE) return null;
      try {
        if (!AC) {
          AC = new (window.AudioContext || window.webkitAudioContext)();
          master = AC.createGain();
          master.gain.value = CONFIG.sfxVolume;
          master.connect(AC.destination);
        }
        if (AC.state === 'suspended') AC.resume();
        return AC;
      } catch (e) { return null; }
    }
    function tone(type, f0, f1, at, dur, vol) {
      var c = ac();
      if (!c) return;
      var t = c.currentTime + (at || 0), o = c.createOscillator(), g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.012, dur / 4));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g);
      g.connect(master);
      o.start(t);
      o.stop(t + dur + 0.03);
    }
    var SFX = {
      move: function () { tone('triangle', 1250, 980, 0, 0.05, 0.09); },
      lock: function () { tone('sine', 392, 784, 0, 0.12, 0.2); tone('triangle', 784, 784, 0.07, 0.16, 0.1); },
      rise: function () { tone('triangle', 330, 880, 0, 0.7, 0.07); tone('sine', 495, 1320, 0.05, 0.65, 0.04); },
      win: function () {
        [523.25, 659.25, 783.99, 1046.5].forEach(function (f, i) { tone('triangle', f, f, i * 0.085, i === 3 ? 0.42 : 0.16, 0.13); });
      },
      ownWay: function () { tone('sine', 587.33, 587.33, 0, 0.22, 0.11); tone('sine', 783.99, 783.99, 0.16, 0.45, 0.09); }
    };

    /* ---- effects ---- */
    function piece(cls, x, y, style) {
      var i = document.createElement('i');
      i.className = cls;
      i.style.cssText = 'left:' + x + 'cqw;top:' + y + 'cqh;' + style;
      fxEl.appendChild(i);
    }
    function confetti() {
      var cols = TH.confetti, origins = [{ x: 13, y: resGeo.textTop }, { x: 13, y: resGeo.picMid }];
      origins.forEach(function (o, oi) {
        var n = oi === 0 ? 20 : 16;
        for (var k = 0; k < n; k++) {
          var w = 0.7 + Math.random() * 0.8, h = w * (Math.random() < 0.5 ? 0.45 : 1.4);
          var round = Math.random() < 0.3;
          var dx = (Math.random() * 2 - 1) * (oi === 0 ? 14 : 11);
          var up = -(oi === 0 ? 12 + Math.random() * 16 : 8 + Math.random() * 12);
          var dn = oi === 0 ? 10 + Math.random() * 22 : 16 + Math.random() * 24;
          piece('cf', o.x, o.y,
            'width:' + w.toFixed(2) + 'cqw;height:' + h.toFixed(2) + 'cqw;background:' + cols[k % cols.length] + ';' +
            (round ? 'border-radius:50%;' : '') +
            '--dx:' + dx.toFixed(1) + 'cqw;--up:' + up.toFixed(1) + 'cqh;--dn:' + dn.toFixed(1) + 'cqh;' +
            '--r:' + Math.round((Math.random() * 2 - 1) * 540) + 'deg;--d:' + (1.3 + Math.random() * 0.7).toFixed(2) + 's;' +
            'animation-delay:' + (Math.random() * 0.12).toFixed(2) + 's');
        }
      });
    }
    function warmth(pick) {
      var origins = [{ x: 13, y: resGeo.picMid + 6 }, { x: 13, y: resGeo.textTop + 4 }];
      origins.forEach(function (o, oi) {
        for (var k = 0; k < 7; k++) {
          var s = 1.6 + Math.random() * 2.2;
          piece('wm', o.x + (Math.random() * 2 - 1) * 5, o.y + 4,
            'width:' + s.toFixed(2) + 'cqw;height:' + s.toFixed(2) + 'cqw;' +
            '--dx:' + ((Math.random() * 2 - 1) * 4).toFixed(1) + 'cqw;--up:' + (-(8 + Math.random() * 12)).toFixed(1) + 'cqh;' +
            '--d:' + (2.2 + Math.random() * 1.2).toFixed(2) + 's;animation-delay:' + (k * 0.14).toFixed(2) + 's');
        }
      });
    }

    function lock(i, isAuto, at) {
      S.sel = i;
      S.pick = i;
      S.autoPicked = isAuto;
      S.lockAt = at;
      var el = tiles[i];
      el.classList.remove('punch');
      void el.offsetWidth;
      el.classList.add('punch');
      SFX.lock();
    }

    function apply(k, t) {
      var ph = phaseAt(t);
      if (ph !== 'intro' && ph !== 'vote') return;
      if (k === 'prev' && S.sel > 0) { S.sel--; SFX.move(); }
      if (k === 'next' && S.sel < tiles.length - 1) { S.sel++; SFX.move(); }
      if (k === 'ok') lock(S.sel, false, Math.max(t, T.panelIn));
    }

    function post(k) {
      var name = k === 'prev' ? 'left' : k === 'next' ? 'right' : 'ok';
      var now = performance.now();
      if (now - lastPost[name] < CONFIG.keyThrottleMs) return;
      lastPost[name] = now;
      try { parent.postMessage({ iionKey: name }, '*'); } catch (e) { }
    }
    function press(k) { post(k); queue.push(k); }

    function setSound(on) {
      soundOn = !!on && !MUTE;
      spot.muted = !soundOn;
      if (MUTE) spot.volume = 0;
      if (!soundOn && AC && AC.state === 'running') { try { AC.suspend(); } catch (e) { } }
      var c = $('chip');
      if (c && soundOn) { c.style.opacity = 0; setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 400); }
    }
    function hear() { if (!soundOn && chip) setSound(true); }

    var KEYS = { ArrowLeft: 'prev', ArrowRight: 'next', Enter: 'ok', ' ': 'ok', Spacebar: 'ok' };
    addEventListener('keydown', function (e) {
      var k = KEYS[e.key];
      hear();
      if (!k) return;
      e.preventDefault();
      if (k === 'ok' && e.repeat) return;
      press(k);
    });
    addEventListener('pointerdown', hear);
    tiles.forEach(function (el, i) {
      el.addEventListener('click', function () {
        var ph = phaseAt(spot.currentTime);
        if (ph !== 'intro' && ph !== 'vote') return;
        if (S.sel !== i) { S.sel = i; SFX.move(); }
        press('ok');
      });
    });
    function finish() {
      if (S.done) return;
      S.done = true;
      spot.pause();
      /* if a slow frame let the spot run into its black last frames, step back onto the end card */
      if (spot.currentTime > T.endAt) { try { spot.currentTime = T.endAt - 0.15; } catch (e) { } }
      if (auto) setTimeout(begin, CONFIG.attractRestartMs);
    }
    spot.addEventListener('ended', function () { if (S) finish(); });
    spot.addEventListener('timeupdate', function () { if (S && spot.currentTime >= T.endAt) finish(); });

    function set(key, val, fn) { if (last[key] !== val) { last[key] = val; fn(val); } }

    function frame() {
      requestAnimationFrame(frame);
      if (!S) return;
      var t = spot.currentTime;
      if (t >= T.endAt) finish();

      if (S.lockAt === null && S.forced !== null && t >= T.voteStart) lock(S.forced, false, Math.min(t, T.voteEnd));
      if (auto && S.lockAt === null && plan) {
        while (plan.i < plan.steps.length && plan.steps[plan.i].at <= t) { press(plan.steps[plan.i].k); plan.i++; }
      }
      while (queue.length) apply(queue.shift(), t);
      if (S.lockAt === null && t >= T.voteEnd) lock(S.sel, true, T.voteEnd);

      var ph = phaseAt(t);
      var on = ph !== 'pre' && ph !== 'out';
      var res = ph === 'outcome' || ph === 'hero';
      var urgent = (ph === 'vote') && (T.voteEnd - t) <= T.urgentSecs;
      /* the race: eased, each bar running a little ahead or behind mid-way, all landing on the sample tally */
      var p = 0;
      if (ph === 'reveal') p = clamp((t - revealStart()) / T.revealSecs);
      if (res) p = 1;
      /* the leader is crowned as the race lands, just before the outcome */
      var crown = res || (ph === 'reveal' && p >= 0.9);
      var groups = 'ph-' + ph + (on ? ' g-on' : '') + (ph === 'intro' || ph === 'vote' ? ' g-vote' : '') +
        (S.lockAt !== null && on ? ' g-lock' : '') + (ph === 'reveal' || res ? ' g-tally' : '') +
        (crown ? ' g-crown' : '') + (res ? ' g-res ' + (S.pick === TOP ? 'g-win' : 'g-own') : '') +
        (S.autoPicked && on ? ' g-auto' : '') + (urgent ? ' urgent' : '') +
        (ph === 'hero' ? ' g-hero' : '') + (squeeze && on ? ' sq' : '');
      set('cls', groups, function (g) { tv.className = 'tv' + (EMBED ? ' embed' : '') + ' ' + g; });

      set('sel', S.sel + ':' + S.pick, function () {
        tiles.forEach(function (el, i) {
          el.classList.toggle('sel', i === S.sel);
          el.classList.toggle('mine', i === S.pick);
          el.classList.toggle('top', i === TOP);
        });
      });

      var left = ph === 'pre' || ph === 'intro' ? T.voteEnd - T.voteStart : Math.max(0, T.voteEnd - t);
      var frac = clamp(left / (T.voteEnd - T.voteStart));
      set('timer', Math.round(frac * 600), function () { tfill.style.transform = 'scaleX(' + frac.toFixed(4) + ')'; });
      set('count', Math.ceil(left - 0.001), function (v) { tcount.textContent = String(Math.max(0, v)); });

      set('bars', Math.round(p * 1000), function () {
        var mx = Math.max.apply(null, CONFIG.tally), e = 1 - Math.pow(1 - p, 3), wob = Math.sin(Math.PI * p);
        tiles.forEach(function (el, i) {
          var v = Math.max(0, Math.min(mx, CONFIG.tally[i] * e + (CONFIG.race[i] || 0) * wob));
          var h = p > 0 ? BAR.hidden + (BAR.max - BAR.hidden) * (v / mx) : 0;
          el.querySelector('.fill').style.transform = 'translateY(' + (BAR.max - h).toFixed(2) + 'cqh)';
          /* the percentage rides just above whichever is higher, the bar's top or the treat's top: always clear */
          var pct = el.querySelector('.tpct');
          pct.textContent = Math.round(v) + '%';
          pct.style.transform = 'translateY(' + (-(Math.max(h, BAR.hidden) + BAR.gap)).toFixed(2) + 'cqh)';
        });
      });
      if (ph === 'reveal' && !S.rose) { S.rose = true; SFX.rise(); }

      /* the column's status line while the vote counts; the dots sit outside the line's width so it never re-wraps */
      var text = '', dots = '';
      if (ph === 'locked' || ph === 'counting') { text = L.counting; dots = '...'.slice(0, 1 + Math.floor((t - S.lockAt) * 3) % 3); }
      if (ph === 'reveal' || res) text = L.reveal;
      set('status', text, function (v) { stext.textContent = v; });
      set('dots', dots, function (v) { sdots.textContent = v; });
      if (res && !S.said) {
        S.said = true;
        if (S.pick === TOP) { confetti(); SFX.win(); }
        else { warmth(S.pick); SFX.ownWay(); }
      }

      set('hero', S.pick === null ? '' : String(S.pick), function () {
        if (S.pick === null) return;
        var tr = CONFIG.treats[S.pick];
        hname.innerHTML = nameHtml(tr.name);
        hout.innerHTML = S.pick === TOP ? linesHtml(L.calledLines, L.called) : linesHtml(L.ownWayLines, L.ownWay);
        hstack.classList.toggle('win', S.pick === TOP);
        hstack.classList.toggle('own', S.pick !== TOP);
        if (hpic.getAttribute('src') !== tr.img) hpic.src = tr.img; else fitHero();
      });
    }

    window.DEMO = {
      start: function () { first = false; begin(); },
      slotMs: CONFIG.slotMs,
      setAuto: function (on) {
        var was = auto;
        auto = !!on;
        if (auto && S && S.lockAt === null) { plan = makePlan(Math.max(T.voteStart, spot.currentTime)); }
        /* turned on after a loop has already stopped: start the next loop as attract would */
        if (auto && !was && S && S.done) setTimeout(begin, CONFIG.attractRestartMs);
      },
      setSound: setSound
    };
    window.CALLIT = { CONFIG: CONFIG, get S() { return S; } };

    begin();
    requestAnimationFrame(frame);
  } };
})();
