// Touch ripple for the mobile preview: the phone's version of the CTV remote.
// The mock posts {iionTap:{x,y}} (0..1 of the ad unit) for every autopilot or viewer tap; we draw a finger ripple there.
(function () {
  const screen = document.querySelector('.phone .ad-slot') || document.querySelector('.phone .screen');
  if (!screen) return;
  const layer = document.createElement('div');
  layer.className = 'touch-layer';
  layer.setAttribute('aria-hidden', 'true');
  screen.appendChild(layer);
  function ripple(x, y) {
    const d = document.createElement('i');
    d.className = 'tap';
    d.style.left = (x * 100) + '%';
    d.style.top = (y * 100) + '%';
    layer.appendChild(d);
    setTimeout(() => d.remove(), 750);
  }
  // data-ripple="pointer": the unit doesn't post taps itself, so ripple the viewer's own pointer-downs (same-origin iframe)
  const frame = screen.querySelector('iframe');
  if (screen.dataset.ripple === 'pointer' && frame) {
    const hook = () => { try {
      frame.contentDocument.addEventListener('pointerdown', ev => {
        const w = frame.contentWindow; ripple(ev.clientX / w.innerWidth, ev.clientY / w.innerHeight);
      }, true);
    } catch (e) {} };
    frame.addEventListener('load', hook); if (frame.contentDocument && frame.contentDocument.readyState === 'complete') hook();
  }
  addEventListener('message', e => {
    const t = e.data && e.data.iionTap;
    if (!t || typeof t.x !== 'number' || typeof t.y !== 'number') return;
    ripple(t.x, t.y);
  });
})();
