/* Toss It High — the layer list (D-015) built from a view's camera, so the blueprints are drawn from the same numbers the game uses.
   Picture or code per layer (rule 7): the room, the lanterns, the fan and the chopstick hand are pictures; the pizza, the toppings and the
   logo are the CLIENT's (supplied, never generated); the toss, the glow, the sway, the gold on the floor, the shadows are code. */
window.TossLayers = function (v) {
  const W = 640, H = 960, KEY = '#4A5A7A', Z = v.zoom;
  const fy = h => (v.tableY - h * v.px) / H;   // a height above the table (camera at rest) as a frame fraction
  const roomH = v.follow ? Math.round(1920 * (v.floorY + 40 - (v.tableY - (2.95 + 0.15) * v.px)) / H / 2) * 2 : 1920;   // the follow view's room is taller than the screen
  const room = {
    id: 'L1', name: 'room', type: 'plate', canvas: [1280, roomH], camera: v.camera,
    notes: `picture · photoreal: a warm Singapore Chinese New Year dining room seen from the side at table height, ${v.follow ? 'tall (the camera rises with the toss): wall from the floor up to the ceiling' : 'the whole room from the floor to the ceiling in one frame'}; a round table with a red cloth across the bottom (its top edge at ${Math.round(v.tableY / H * 100)}% of the screen), the floor below it; a plain ceiling band at the top with a slot for the fan (separate layer); a warm wall with soft red-and-gold decorations ONLY at the far left and right edges; the middle column (the toss) and the five lantern spots plain and calm; NO lanterns (separate layer), NO food, NO people; light from the upper left`,
    shape(ctx, x, y, w, h, S, cell, o = {}) {   // the layout guide: ceiling band, the fan slot, the plain toss column, the round table in a red cloth, the floor
      const top = v.follow ? 0.03 : (v.tableY - 2.95 * v.px) / H, tab = v.follow ? 1 - (v.floorY + 40 - v.tableY) / (roomH / 2) : v.tableY / H, flo = v.follow ? 1 - 40 / (roomH / 2) : v.floorY / H;
      const Y = f => y + f * h, cx = x + w / 2, th = w * v.tableHalf * Z / W;
      const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#E6DFD7'); g.addColorStop(1, '#D8CEC4'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#C9A9A0'; for (const ex of [x, x + w - w * 0.08]) ctx.fillRect(ex, Y(top) + h * 0.05, w * 0.08, Y(tab) - Y(top) - h * 0.1);   // decorations only at the far edges
      ctx.fillStyle = '#B8AEA5'; ctx.fillRect(x, y, w, Y(top) - y);
      ctx.fillStyle = '#8F857C'; ctx.fillRect(cx - w * 0.005, Y(top), w * 0.01, h * 0.02); ctx.fillRect(cx - w * 0.2, Y(top) + h * 0.02, w * 0.4, h * 0.008);   // the fan's slot
      ctx.fillStyle = '#C8BDB2'; ctx.fillRect(x, Y(flo), w, y + h - Y(flo));
      ctx.fillStyle = '#B5312B'; ctx.beginPath(); ctx.moveTo(cx - th, Y(tab) + h * 0.008); ctx.lineTo(cx - th * 1.04, Y(flo) + h * 0.004); ctx.lineTo(cx + th * 1.04, Y(flo) + h * 0.004); ctx.lineTo(cx + th, Y(tab) + h * 0.008); ctx.fill();   // the cloth falling to the floor
      ctx.fillStyle = '#C9473F'; ctx.beginPath(); ctx.ellipse(cx, Y(tab) + h * 0.008, th, h * 0.027, 0, 0, 7); ctx.fill();   // the round tabletop, seen just from above its edge
      window.GB.bpZone(ctx, x + w * 0.27, Y(top) + h * 0.04, w * 0.46, Y(tab) - Y(top) - h * 0.07, '#ffd23a', 'TOSS COLUMN: plain, calm wall', o.explain);
      if (!v.follow) window.GB.bpZone(ctx, x + 10, y + 6, w - 20, h * 62 / H - 10, '#7fd1ff', 'CEILING = HUD band: plain', o.explain);
      window.GB.bpLabel(ctx, x + 30, Y(tab) - 40, 'ROUND TABLE, RED CLOTH (the pizza sits centre)', '#ffd23a', o.explain);
      window.GB.bpLabel(ctx, x + 30, Y(flo) + 50, 'FLOOR (the gold lands here)', '#ffd23a', o.explain);
      window.GB.bpLabel(ctx, x + w * 0.62, Y(top) + h * 0.03, 'FAN (separate layer)', '#ffd23a', o.explain);
      window.GB.bpLabel(ctx, x + 20, Y(top) + h * 0.3, 'DECOR', '#ffd23a', o.explain);
    },
  };
  const lanterns = {
    id: 'L2', name: 'lantern', type: 'sheet', canvas: [512, 640], key: KEY, states: true, cells: { cols: 2, rows: 1, names: ['unlit', 'lit'] },
    box: { x: 0.5, y: fy(1.4), w: 0.12 * Z, h: 0.12 * Z * 1.25 * (640 / 1024) * 2 * (W / H), anchor: 'centre' },
    notes: 'picture · a classic red silk Chinese lantern, round, gold caps and a gold tassel, seen straight on at eye level, on the key colour; cell 2 is an EDIT of cell 1 in the same chat: the same lantern glowing warm from inside. No text, no characters on it.',
    shape(ctx, x, y, w, h, S, cell) { const c = window.TossCore.drawLanternShape; c(ctx, x + w / 2, y + h * 0.47, Math.min(w / 70, h / 100), cell === 1); },
  };
  const pizza = {
    id: 'L3', name: 'pizza', type: 'sprite', canvas: [1024, 1024], source: 'supplied', states: true,
    box: { x: 0.5, y: v.tableY / H, w: 2 * v.pizzaR * Z / W, h: 2 * v.pizzaR * Z * 0.3 / H, anchor: 'centre' },
    notes: "SUPPLIED · the client's 'Lohei' Pizza photographed straight down: (1) plain, before the toss (plum sauce, chicken, capsicum, pineapple, mozzarella); (2) finished with the gold crackers, lime peel and cereal crunch. Drawn squashed to the table's angle; the dressing between them is a code mask. The slide's photos (in the box, low-res) are stand-ins only.",
    shape(ctx, x, y, w, h) { ctx.fillStyle = '#E2C08A'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 7); ctx.fill(); },
  };
  const toppings = {
    id: 'L4', name: 'toppings', type: 'sheet', canvas: [768, 512], source: 'supplied', key: KEY, cells: { cols: 3, rows: 2, names: ['gold cracker', 'lime peel', 'cereal crunch', 'gold cracker 2', 'lime peel 2', 'cereal crunch 2'] },
    notes: "SUPPLIED · the client's three added toppings, one piece per cell, cut out: Pok Cui gold crackers, lime strip peel, crispy cereal crunch. Thrown as particles in code. Fallback if no photos: Gemini on the key from the slide's crop, labelled stand-in.",
    shape(ctx, x, y, w, h, S, cell) { const col = ['#E8B400', '#8CC63F', '#E9D3A1'][cell % 3]; ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(x + w * 0.3, y + h * 0.38, w * 0.4, h * 0.24, 8); ctx.fill(); },
  };
  const hand = {
    id: 'L5', name: 'chopstick-hand', type: 'viewmodel', canvas: [768, 512], key: KEY, states: true, cells: { cols: 2, rows: 1, names: ['rest', 'flick'] },
    box: { x: 1, y: 1, w: 0.5, h: 0.5 * (512 / 768) * (W / H), anchor: 'corner-br' }, pivot: [0.8, 1.0],   // measured from the greybox: tips at the heap (0.07, 0.19 of the box), the grip at the lower right
    notes: 'picture · a right hand from the lower right holding a pair of light wooden chopsticks in the standard grip (the upper stick held like a pen between thumb, index and middle finger; the lower stick resting in the thumb crook and on the ring finger), tips pointing up-left to the frame centre; wrist cut by the frame corner; no sleeve logo, no face; cell 2 is an EDIT: the same hand flicked upward, tips raised. Action truth (rule 14): chopsticks lift and toss, they never stab.',
    shape(ctx, x, y, w, h) {   // two sticks from the hand at the lower right to the tips up-left at the heap; the hand in the standard grip (rule 21: right proportions)
      const P = (fx, fy) => [x + fx * w, y + fy * h]; ctx.lineCap = 'round';
      for (const [a, b, c] of [[[0.86, 0.98], [0.07, 0.19], '#C9AC86'], [[0.9, 0.9], [0.09, 0.25], '#D9BE97']]) { ctx.strokeStyle = c; ctx.lineWidth = w * 0.016; ctx.beginPath(); ctx.moveTo(...P(...a)); ctx.lineTo(...P(...b)); ctx.stroke(); }
      ctx.fillStyle = '#E8DCCF'; ctx.strokeStyle = '#B9AC9F'; ctx.lineWidth = 3;
      const blob = (fx, fy, rx, ry, rot) => { ctx.beginPath(); ctx.ellipse(x + fx * w, y + fy * h, rx * w, ry * h, rot, 0, 7); ctx.fill(); ctx.stroke(); };
      blob(0.88, 0.95, 0.11, 0.17, -0.5); blob(0.76, 0.82, 0.07, 0.035, -0.55); blob(0.79, 0.9, 0.065, 0.032, -0.5); blob(0.83, 0.77, 0.05, 0.03, 0.4);   // palm, index and middle along the sticks, the thumb over them
      ctx.lineCap = 'butt';
    },
  };
  const fan = {
    id: 'L6', name: 'fan', type: 'sprite', canvas: [1024, 256], key: KEY,
    box: { x: 0.5, y: fy(2.95) + 0.03, w: 0.42 * Z, h: 0.42 * Z * 0.25 * (W / H), anchor: 'centre' },
    notes: 'picture · a dark wooden ceiling fan seen from the side at eye level, blades level, on the key colour; the blades blur and turn in code.',
    shape(ctx, x, y, w, h) { ctx.fillStyle = '#8F857C'; ctx.fillRect(x, y + h * 0.45, w, h * 0.1); ctx.fillRect(x + w * 0.47, y, w * 0.06, h * 0.5); },
  };
  const logo = { id: 'L7', name: 'logo', type: 'brand', canvas: [512, 160], source: 'supplied', box: { x: 16 / W, y: 11 / H, w: 128 / W, h: 40 / H, anchor: 'top-left' },
    notes: "SUPPLIED · Pizza Hut's logo (the client's file); grey placeholder until it arrives, never drawn (rule 6)", shape() {} };
  const fx = { id: 'FX', name: 'code', type: 'hud-in-code', canvas: [W, H], notes: 'code: the toss (particles), the target glow band, the lantern sway and burst, the fan spin, gold on the floor, the aim and release lines, the ghost hand, contact shadows, pops, HUD, cards', shape() {} };
  return [room, lanterns, pizza, toppings, hand, fan, logo, fx];
};
