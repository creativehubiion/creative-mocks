/* Top Your Lohei Pizza — the layer list (D-015) from a view's camera. A NEW pack for this game (owner 20:40: its own camera, its own
   Gemini pictures); only the client's pizza photos and the logo carry over (the real product and the real mark). */
window.MakerLayers = function (v) {
  const W = 640, H = 960, KEY = '#4A5A7A', top = v.k >= 0.99;
  const plate = { id: 'L1', name: top ? 'table' : 'kitchen', type: 'plate', canvas: [1280, 1920], camera: v.camera,
    notes: top ? 'picture · photoreal, straight down onto a warm wooden dining table, a red-and-white checked cloth corner at the edges, soft light from the upper left; the middle (the turntable) and the bottom strip (the tray) plain; NO food, NO plates, NO people'
               : 'picture · photoreal, a bright Pizza-shop-style kitchen counter seen from the front at ~35° down: a warm back wall, a light stone counter from 45% down; the turntable spot and the tray spot plain; NO food, NO people, NO text or logos',
    shape(ctx, x, y, w, h, S, cell, o = {}) { const g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, top ? '#B98A5E' : '#E7DCCF'); g.addColorStop(1, top ? '#A0744C' : '#D9CCBD'); ctx.fillStyle = g; ctx.fillRect(x, y, w, h);
      if (!top) { ctx.fillStyle = '#C9BFB5'; ctx.fillRect(x, y + h * v.counterY / H, w, h - h * v.counterY / H); }
      const cx = x + w * v.cx / W, cy = y + h * v.cy / H, R = w * v.R * 1.1 / W; ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.beginPath(); ctx.ellipse(cx, cy, R, R * v.k, 0, 0, 7); ctx.fill();
      window.GB.bpZone(ctx, cx - R, cy - R * v.k, R * 2, R * 2 * v.k, '#ffd23a', 'TURNTABLE SPOT: plain', o.explain);
      window.GB.bpZone(ctx, x + w * 0.2, y + h * (v.trayY - 50) / H, w * 0.6, h * 100 / H, '#7fd1ff', 'TRAY SPOT: plain', o.explain);
      window.GB.bpZone(ctx, x + 10, y + 6, w - 20, h * 62 / H, '#7fd1ff', 'HUD band', o.explain); } };
  const turntable = { id: 'L2', name: 'turntable', type: 'sprite', canvas: [1024, top ? 1024 : 640], key: KEY, box: { x: v.cx / W, y: v.cy / H, w: v.R * 2.2 / W, h: v.R * 2.2 * v.k / H, anchor: 'centre' },
    notes: 'picture · a round wooden pizza board on a low metal turntable, ' + (top ? 'straight down' : 'seen at ~35° down') + ', empty, on the key colour; it turns in code',
    shape(ctx, x, y, w, h) { ctx.fillStyle = '#8F857C'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w * 0.48, h * 0.48, 0, 0, 7); ctx.fill(); } };
  const pizza = { id: 'L3', name: 'pizza', type: 'sprite', canvas: [1024, 1024], source: 'supplied', box: { x: v.cx / W, y: v.cy / H, w: v.R * 2 / W, h: v.R * 2 * v.k / H, anchor: 'centre' },
    notes: "SUPPLIED · the client's Lohei Pizza base from straight above (the slide's plain photo until their clean shots); the toppings land on it in code",
    shape(ctx, x, y, w, h) { ctx.fillStyle = '#E2C08A'; ctx.beginPath(); ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, 7); ctx.fill(); } };
  const names = ['plum sauce dollop', 'chicken chunk', 'red capsicum strip', 'pineapple chunk', 'mozzarella', 'cracker', 'lime peel', 'cereal crunch'];
  const cols = ['#B23A2E', '#E8D2B0', '#D9302A', '#F2C744', '#F6F0DC', '#E9B9A4', '#C8D86A', '#C9913F'];
  const toppings = { id: 'L4', name: 'toppings', type: 'sheet', canvas: [1024, 512], key: KEY, cells: { cols: 4, rows: 2, names },
    notes: 'picture · the Lohei Pizza\'s eight toppings, one per cell, ' + (top ? 'straight down' : 'seen at ~35° down') + ', matched to the client\'s photo; on the key colour; dropped as pieces in code',
    shape(ctx, x, y, w, h, S, cell) { ctx.fillStyle = cols[cell]; ctx.beginPath(); ctx.roundRect(x + w * 0.32, y + h * 0.36, w * 0.36, h * 0.28, 10); ctx.fill(); } };
  const tray = { id: 'L5', name: 'tray', type: 'sprite', canvas: [1024, 384], key: KEY, box: { x: v.trayX / W, y: v.trayY / H, w: 200 / W, h: 80 / H, anchor: 'centre' },
    notes: 'picture · a shallow stainless steel prep tray, empty, ' + (top ? 'straight down' : 'from the front at ~35° down') + ', on the key colour; the current topping fills it in code',
    shape(ctx, x, y, w, h) { ctx.fillStyle = '#CFC5BB'; ctx.beginPath(); ctx.roundRect(x + w * 0.05, y + h * 0.15, w * 0.9, h * 0.7, 24); ctx.fill(); } };
  const ticket = { id: 'L6', name: 'ticket', type: 'sprite', canvas: [1024, 256], key: KEY, box: { x: 0.5, y: (v.ticketY + 37) / H, w: 340 / W, h: 74 / H, anchor: 'centre' },
    notes: 'picture · a blank paper order ticket clipped to a little rail, straight on, on the key colour; the order text is code',
    shape(ctx, x, y, w, h) { ctx.fillStyle = '#fff'; ctx.fillRect(x + w * 0.04, y + h * 0.12, w * 0.92, h * 0.76); } };
  const logo = { id: 'L7', name: 'logo', type: 'brand', canvas: [512, 160], source: 'supplied', box: { x: 16 / W, y: 11 / H, w: 128 / W, h: 40 / H, anchor: 'top-left' }, notes: "SUPPLIED · Pizza Hut's published mark (00-intake/supplied/logo-pizzahut.svg)", shape() {} };
  const fx = { id: 'FX', name: 'code', type: 'hud-in-code', canvas: [W, H], notes: 'code: the spin, the flight arcs, the landing pops, the quarter tint, the timer, the order text, the cards', shape() {} };
  return [plate, turntable, pizza, toppings, tray, ticket, logo, fx];
};
