// Animated TV remote that mirrors the playable's key presses (sent via postMessage from mock.html).
(function () {
  const tv = document.querySelector('.tv');
  if (!tv) return;
  const wrap = document.createElement('div');
  wrap.className = 'remote';
  wrap.setAttribute('aria-hidden', 'true');
  fetch(new URL('remote.svg.html', document.currentScript ? document.currentScript.src : location.href))
    .then(r => r.text()).then(html => { wrap.innerHTML = html; });
  tv.appendChild(wrap);

  const timers = {};
  function press(k) {
    const el = wrap.querySelector('.k-' + k);
    if (!el) return;
    el.classList.add('on'); wrap.classList.add('pressing');
    clearTimeout(timers[k]);
    timers[k] = setTimeout(() => { el.classList.remove('on'); wrap.classList.remove('pressing'); }, k === 'ok' ? 320 : 220);
  }
  addEventListener('message', e => { if (e.data && e.data.iionKey) press(e.data.iionKey); });
})();
