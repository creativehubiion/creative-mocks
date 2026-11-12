/* The round's hazard layout made different and fair through the rules' exported data (planner / owner 02:04 IST); choice-logic.js is
   untouched. shuffleLegs(seed): each leg's type order shuffled per round (a copy of the original order, seeded). fairFilter(L): after the
   rules lay the round, hazards are dropped (in place, before any update) that break: the first one is corrugations or potholes and no
   nearer than 80 m; nothing within 40 m before or 25 m after a gate; at least 30 m between consecutive obstacles; rocks and the branch
   never within 40 m of each other; every avoidable obstacle keeps a free lane (the generator always gives one; asserted). Returns the
   kept count and what was dropped. Shared by the game (game3.js) and the node check. */
const rng = s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
let ORIG = null;
export function shuffleLegs(L, seed) {
  if (!ORIG) ORIG = L.LEG.map(l => l.seq.slice()); const R = rng((seed >>> 0) * 31 + 7);
  L.LEG.forEach((l, k) => { const a = ORIG[k].slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } l.seq.length = 0; for (const x of a) l.seq.push(x); });
}
export function fairFilter(L) {
  const H = L.HZ, G = L.CONFIG.gateS, rocky = t => t === 'rocks' || t === 'log', gentle = t => t === 'corrug' || t === 'pothole', why = {};
  const order = H.map((h, k) => k).sort((a, b) => H[a].s0 - H[b].s0), keep = new Set(); let last = null, noFree = 0;
  for (const k of order) {
    const h = H[k]; let w = '';
    if (h.type === 'gust' || h.type === 'branch') { keep.add(k); continue; }
    if (!h.full && !(h.free && h.free.length)) { noFree++; w = 'nofree'; }
    else if (h.s0 < 80) w = 'near';
    else if (!last && !gentle(h.type)) w = 'first';
    else if (G.some(g => h.s1 > g - 40 && h.s0 < g + 25)) w = 'gate';
    else if (last && h.s0 - last.s0 < 30) w = 'close';
    else if (last && rocky(h.type) && rocky(last.type) && h.s0 - last.s1 < 40) w = 'rockrock';
    if (w) { why[w] = (why[w] || 0) + 1; continue; }
    keep.add(k); last = h;
  }
  const kept = H.filter((h, k) => keep.has(k)); H.length = 0; for (const h of kept) H.push(h);
  return { n: H.length, dropped: why, noFree, types: H.map(h => h.type) };
}
