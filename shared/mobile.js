// Mobile previews (hybrid / playable): load in <head>, before the page paints.
// · On a phone: skip the mock page and open the ad unit full screen (2:3 with black bars, as it serves in-app).
//   The full-screen URL comes from .ad-slot[data-full] (fallback: the iframe src). Add ?desktop to keep the mock page.
// · On a desktop: a "Scan to play on your phone" QR card beside the phone, encoding this page's own URL.
// · On a desktop: the ad slot is pixel-snapped so no hairline shows along the creative's top edge (see below).
(function () {
  const q = new URLSearchParams(location.search);
  const ua = navigator.userAgent || '';
  const isPhone = (navigator.userAgentData && navigator.userAgentData.mobile) ||
    /iPhone|iPod|Android.+Mobile|Windows Phone|Mobile Safari/i.test(ua) && !/iPad|Tablet/i.test(ua);

  if (isPhone && !q.has('desktop')) {
    // never paint the mock page on a phone: black screen until we jump to the full-screen unit
    const hide = document.createElement('style');
    hide.textContent = 'html{background:#000!important}body{visibility:hidden!important}';
    document.head.appendChild(hide);
    let done = false;
    const go = () => {
      if (done) return false;
      const slot = document.querySelector('.ad-slot'), frame = slot && slot.querySelector('iframe');
      const target = (slot && slot.dataset.full) || (frame && frame.getAttribute('src'));
      if (!target) return false;
      done = true; location.replace(new URL(target, location.href).href); return true;
    };
    // jump as soon as the ad slot is parsed (well before DOMContentLoaded / images / fonts)
    const mo = new MutationObserver(() => { if (go()) mo.disconnect(); });
    mo.observe(document.documentElement, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', () => { mo.disconnect(); if (!go()) hide.remove(); });
    return;
  }

  document.addEventListener('DOMContentLoaded', () => {
    const phone = document.querySelector('.phone');
    if (!phone) return;
    const card = document.createElement('aside');
    card.className = 'qr-card';
    card.innerHTML = '<div class="qr" aria-hidden="true"></div><div class="txt"><b>Scan to play on your phone</b><span>Opens the ad full screen</span></div>';
    phone.appendChild(card);
    const url = location.origin + location.pathname;
    card.querySelector('.qr').setAttribute('title', url);
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';
    s.onload = () => {
      try {
        new QRCode(card.querySelector('.qr'), { text: url, width: 256, height: 256, colorDark: '#1d1d1f', colorLight: '#ffffff', correctLevel: QRCode.CorrectLevel.M });
      } catch (e) { card.remove(); }
    };
    s.onerror = () => card.remove();
    document.head.appendChild(s);
  });

  // · Slot snap (desktop): the ad slot is centred with translateY(-50%) inside a screen sized by percentages, so its edges can
  //   land between device pixels; the compositor then blends the slot's first row with the black bar above it and a 1px line
  //   shows along the top of the creative (clearest on a 2x Mac display, or whenever the window height makes the maths fractional).
  //   The slot's top and height are set so both edges fall on whole device pixels, keeping 2:3 to within one device pixel.
  //   Add ?nosnap to compare.
  document.addEventListener('DOMContentLoaded', () => {
    if (q.has('nosnap')) return;
    const slot = document.querySelector('.phone .ad-slot'); if (!slot) return;
    const scr = slot.parentElement;
    const snapSlot = () => {
      const dpr = window.devicePixelRatio || 1, r = scr.getBoundingClientRect(), w = r.width; if (!w) return;
      const h = Math.round(w * 1.5 * dpr) / dpr;                                   // 2:3 height on whole device pixels
      const absTop = r.top + (r.height - h) / 2, top = Math.round(absTop * dpr) / dpr - r.top;
      slot.style.transform = 'none'; slot.style.aspectRatio = 'auto'; slot.style.height = h + 'px'; slot.style.top = top + 'px';
    };
    snapSlot(); addEventListener('resize', snapSlot); addEventListener('scroll', snapSlot, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(snapSlot).observe(scr);
  });
})();
