/* The colour roles (2026-11-04 02:01, the owner: "the branding colors... how will that happen?"): a scene names ROLES, never a
   hex; the brand kit fills the roles. The roles and their bands are Higgsfield's colour law (ad-structure §4.1, measured off
   shipped games): seven roles `player`, `enemy`, `reward`, `hazard`, `ground`, `backdrop`, `hud`; the ACTORS (player, enemy,
   reward, hazard) saturated (at least 0.75) and mid-light (0.45-0.65), never grey, pastel, near-black or near-white; player to
   enemy at least 120 degrees of hue apart, reward at least 60 from each, hazard in the red-to-orange band; ground and backdrop
   saturated too (0.35-0.65, lightness 0.30-0.75), apart from the actors by hue (40) and lightness (0.12); a neutral grey on at
   most a quarter of the frame; every actor outlined or shadowed; particles in the reward or hazard hue at full saturation.
   OUR rule on top (the brand's main colour is the brand's own, never re-picked): the brand's colours fill the roles as they are,
   clamped only to the actor bands so they read on a phone; `check()` reports what the law would flag, for the eye and the
   battery, it never re-colours a brand.
     PALETTE.fromBrand(brand, { night, product })   brand = { colors: [{ hex, type: 'accent' | 'dark' | 'light' }] } (the brand
                                                   kit's own record); night: a dark backdrop; product: the product's own colour
                                                   (a sauce, a drink), kept as `product`
       -> roles { player, enemy, reward, hazard, ground, backdrop, hud, product, ink, line, groundAlt, backdropLow, silhouette,
                  crowd[], key, fill, rim, sky[] } (the extras are derived, for the scene's dressing and the light rig)
     PALETTE.apply(roles, el)                       the engine's card and pill variables on the frame (--accent, --ink, --red)
     PALETTE.check(roles) -> [strings]              the law's findings
     PALETTE.hsl(hex) / PALETTE.hex({ h, s, l })    the conversions */
export const PALETTE = (function () {
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  function hsl(hex) {
    const s = String(hex || '#888').replace('#', ''), n = parseInt(s.length === 3 ? s.split('').map(ch => ch + ch).join('') : s, 16);
    const r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    if (mx === mn) return { h: 0, s: 0, l };
    const d = mx - mn, sat = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60;
    return { h, s: sat, l };
  }
  function hex(c) {
    const h = ((c.h % 360) + 360) % 360 / 360, s = clamp(c.s, 0, 1), l = clamp(c.l, 0, 1);
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => { t = (t + 1) % 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
    const to = v => Math.round(v * 255).toString(16).padStart(2, '0');
    return '#' + to(f(h + 1 / 3)) + to(f(h)) + to(f(h - 1 / 3));
  }
  const dist = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
  const actor = c => ({ h: c.h, s: Math.max(0.75, c.s), l: clamp(c.l, 0.45, 0.65) });            // an actor's band
  const surface = c => ({ h: c.h, s: clamp(c.s, 0.35, 0.65), l: clamp(c.l, 0.30, 0.75) });        // a ground's or backdrop's band
  function fromBrand(brand, o) {
    o = o || {};
    const cols = (brand && brand.colors) || [];
    const by = t => { const c = cols.find(x => x.type === t); return c ? hsl(c.hex) : null; };
    const accent = by('accent') || hsl('#1f5fbf'), dark = by('dark') || { h: accent.h + 20, s: 0.5, l: 0.35 }, light = by('light') || { h: accent.h + 50, s: 0.9, l: 0.75 };
    // the roles: the brand's main colour is the player's (its own, clamped only to the actor band); the light colour the reward;
    // the hazard red-to-orange near the main; the enemy across the wheel from the player; the ground from the dark colour; the
    // backdrop a deep cool across from the main at night, a pale version of the light by day; the hud the main colour
    const player = actor(accent);
    // the reward keeps the light colour's hue unless it sits within 60 degrees of the player's; then it moves out on the side it is on
    const dd = ((light.h - player.h + 540) % 360) - 180;
    const reward = actor({ h: Math.abs(dd) < 60 ? player.h + 60 * (dd >= 0 ? 1 : -1) : light.h, s: light.s, l: light.l });
    const hazard = actor({ h: clamp(accent.h < 180 ? accent.h + 18 : 20, 0, 40), s: 0.9, l: 0.5 });
    const enemy = actor({ h: player.h + 180, s: 0.8, l: 0.5 });
    // the ground from the dark colour; when its hue sits near the player's (a brown court under a red brand) it separates by
    // lightness instead, as the law allows: at least 0.13 lighter than the player
    const nearPlayer = dist(dark.h, player.h) < 40;
    const ground = surface({ h: dark.h, s: dark.s, l: nearPlayer ? Math.max(dark.l, player.l + 0.13) : Math.max(0.38, dark.l) });
    const backdrop = o.night ? surface({ h: player.h + 200, s: 0.5, l: 0.3 }) : surface({ h: light.h, s: 0.4, l: 0.72 });
    const hud = player;
    const R = { player: hex(player), enemy: hex(enemy), reward: hex(reward), hazard: hex(hazard), ground: hex(ground), backdrop: hex(backdrop), hud: hex(hud) };
    // the extras: derived, for the dressing and the light rig
    R.product = o.product || hex({ h: dark.h, s: 0.7, l: 0.22 });
    R.ink = hex({ h: dark.h, s: 0.6, l: 0.12 });
    R.line = R.reward;
    R.groundAlt = hex({ h: ground.h, s: ground.s, l: ground.l - 0.04 });
    R.backdropLow = hex({ h: backdrop.h + 15, s: backdrop.s, l: o.night ? backdrop.l + 0.18 : backdrop.l + 0.14 });
    R.sky = [R.backdrop, R.backdropLow];
    R.silhouette = hex({ h: backdrop.h, s: 0.25, l: o.night ? 0.16 : 0.42 });
    R.crowd = [R.silhouette, hex({ h: backdrop.h + 20, s: 0.22, l: o.night ? 0.2 : 0.46 }), R.player, R.silhouette, R.reward, hex({ h: backdrop.h - 20, s: 0.2, l: o.night ? 0.18 : 0.44 })];
    R.key = hex({ h: reward.h, s: 0.55, l: 0.82 });        // a warm key in the reward's family
    R.fill = hex({ h: backdrop.h, s: 0.6, l: 0.72 });      // a cool fill in the backdrop's
    R.rim = hex({ h: backdrop.h - 10, s: 0.7, l: 0.78 });
    R.beam = [hex({ h: backdrop.h + 10, s: 0.8, l: 0.68 }), hex({ h: backdrop.h + 40, s: 0.7, l: 0.66 })];
    return R;
  }
  function apply(R, el) {
    const e = el || document.querySelector('.frame') || document.documentElement;
    e.style.setProperty('--accent', R.hud); e.style.setProperty('--ink', R.ink); e.style.setProperty('--red', R.hazard);
  }
  function check(R) {
    const out = [], H = {}; for (const k of ['player', 'enemy', 'reward', 'hazard', 'ground', 'backdrop']) H[k] = hsl(R[k]);
    const E = 0.006;   // a hair of tolerance: a clamped value sits on the band's edge
    for (const k of ['player', 'enemy', 'reward', 'hazard']) { const c = H[k]; if (c.s < 0.75 - E || c.l < 0.45 - E || c.l > 0.65 + E) out.push(`${k} ${R[k]} is outside the actor band (saturation ${c.s.toFixed(2)}, lightness ${c.l.toFixed(2)})`); }
    if (dist(H.player.h, H.enemy.h) < 119.5) out.push(`player and enemy are ${dist(H.player.h, H.enemy.h).toFixed(0)} degrees apart (120 wanted)`);
    for (const k of ['player', 'enemy']) if (dist(H.reward.h, H[k].h) < 59.5) out.push(`reward is ${dist(H.reward.h, H[k].h).toFixed(0)} degrees from ${k} (60 wanted)`);
    if (!(H.hazard.h <= 40 || dist(H.hazard.h, H.player.h) >= 60)) out.push('hazard is neither red-to-orange nor 60 degrees from the player');
    for (const k of ['ground', 'backdrop']) { const c = H[k]; if (c.s < 0.35 || c.s > 0.65 || c.l < 0.3 || c.l > 0.75) out.push(`${k} ${R[k]} is outside the surface band (saturation ${c.s.toFixed(2)}, lightness ${c.l.toFixed(2)})`);
      for (const a of ['player', 'enemy']) if (dist(c.h, H[a].h) < 40 && Math.abs(c.l - H[a].l) < 0.12) out.push(`${k} sits on ${a} (hue ${dist(c.h, H[a].h).toFixed(0)} apart, lightness ${Math.abs(c.l - H[a].l).toFixed(2)} apart)`); }
    return out;
  }
  return { fromBrand, apply, check, hsl, hex };
})();
window.PALETTE = PALETTE;
