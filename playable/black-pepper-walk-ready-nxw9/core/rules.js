/* Walk Ready: the rules, with no drawing, so the bots can play them. Every fabric line is from the product's own page (00-intake/supplied/SOURCES.md). */
(function (root) {
  const CONFIG = {
    clock: 26,
    wrongCost: 5,
    changeTime: 2.1,
    looks: [
      { sky: 'breeze', temp: 14, cond: 'Cool, breezy', line: 'Cool and breezy', banner: 'A cool breeze this morning', needs: { top: 'breeze', bottom: 'breeze', layer: 'breeze' } },
      { sky: 'sun', temp: 29, cond: 'Hot, sunny', line: 'Hot and bright', banner: 'The sun is out. It\'s warming up', needs: { top: 'sun', bottom: 'sun', layer: 'sun' } },
      { sky: 'mix', temp: 21, cond: 'Sunny, breezy', line: 'Sunny with a breeze', banner: 'Now it\'s sunny, with a cool breeze', needs: { top: 'sun', bottom: 'breeze', layer: 'breeze' } },
    ],
  };
  const PIECES = {
    benedetta: { slot: 'top', mark: 'breeze', name: 'Benedetta 3/4 Sleeve Shirt', fact: 'Breathable 100% cotton' },
    tee: { slot: 'top', mark: 'sun', name: 'Kinnersly Scoop Neck Tee', fact: 'Lightweight & breathable' },
    rome: { slot: 'bottom', mark: 'breeze', name: 'Rome Pant', fact: 'Full length, elastic waist' },
    denim: { slot: 'bottom', mark: 'sun', name: 'Intense Denim Short Length Jean', fact: 'Stretch denim, short length' },
    mabel: { slot: 'layer', mark: 'breeze', name: 'Mabel Cardigan', fact: 'Soft, cosy warmth' },
    monty: { slot: 'layer', mark: 'sun', name: 'Monty Pintuck Jacket', fact: 'Lightweight French linen' },
  };
  const SLOTS = ['bottom', 'top', 'layer'];

  function newGame() { return { clock: 0, look: 0, worn: { top: null, bottom: null, layer: null }, gown: true, started: false, phase: 'play', changeT: 0, wrong: 0, drops: 0, result: null, spare: 0 }; }
  const needs = s => CONFIG.looks[s.look].needs;
  const slotDone = (s, slot) => { const w = s.worn[slot]; return !!w && PIECES[w].mark === needs(s)[slot]; };
  const lookDone = s => SLOTS.every(k => slotDone(s, k));
  const fits = (s, id) => PIECES[id].mark === needs(s)[PIECES[id].slot];

  /* One drop on her. Returns what happened, for the drawing to act out. */
  function drop(s, id) {
    if (s.phase !== 'play') return { ok: false, ignored: true };
    s.drops++;
    if (!fits(s, id)) { s.wrong++; return { ok: false, mark: PIECES[id].mark }; }
    const slot = PIECES[id].slot, was = s.worn[slot], first = s.gown; s.worn[slot] = id; s.gown = false;
    if (lookDone(s)) { if (s.look === CONFIG.looks.length - 1) win(s); else { s.phase = 'change'; s.changeT = 0; } return { ok: true, was, first, lookDone: true }; }
    return { ok: true, was, first };
  }
  function win(s) { s.phase = 'end'; s.result = 'win'; }
  function step(s, dt) {
    if (s.phase === 'change') { s.changeT += dt; if (s.changeT >= CONFIG.changeTime) { s.look++; s.phase = 'play'; s.worn = { top: null, bottom: null, layer: null }; s.gown = true; } return; }
  }
  /* The slot being dressed now: one choice of two at a time, bottom, then top, then layer. Each new look starts from the gown, so every piece is a real choice. */
  function current(s) { return SLOTS.find(k => !slotDone(s, k)) || null; }
  function rating(s) { return s.wrong === 0 ? 3 : s.wrong <= 2 ? 2 : 1; }
  /* The next piece a perfect player would take, for the ghost hand and the bot. */
  function suggest(s) { for (const k of SLOTS) if (!slotDone(s, k)) return Object.keys(PIECES).find(id => PIECES[id].slot === k && fits(s, id)); return null; }
  const RULES = { CONFIG, PIECES, SLOTS, newGame, drop, step, suggest, fits, slotDone, lookDone, current, rating };
  if (typeof module !== 'undefined') module.exports = RULES; else root.RULES = RULES;
})(typeof window !== 'undefined' ? window : globalThis);
