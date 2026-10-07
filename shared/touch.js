// Touch ripple for the mobile preview: the phone's version of the CTV remote.
// The mock posts {iionTap:{x,y}} (0..1 of the ad unit) for every autopilot or viewer tap; we draw a finger ripple there.
(function () {
  const screen = document.querySelector('.phone .ad-slot') || document.querySelector('.phone .screen');
  if (!screen) return;
  const layer = document.createElement('div');
  layer.className = 'touch-layer';
  layer.setAttribute('aria-hidden', 'true');
  screen.appendChild(layer);
  addEventListener('message', e => {
    const t = e.data && e.data.iionTap;
    if (!t || typeof t.x !== 'number' || typeof t.y !== 'number') return;
    const d = document.createElement('i');
    d.className = 'tap';
    d.style.left = (t.x * 100) + '%';
    d.style.top = (t.y * 100) + '%';
    layer.appendChild(d);
    setTimeout(() => d.remove(), 750);
  });
})();
