// CTV pages on phones: a "Full screen" button beside "Turn sound on". Tapping it drops the device mock and shows only the ad
// screen (16:9 on black) with sound on. Landscape is never forced: the viewer turns the phone for a bigger picture, as with
// YouTube. Opening the page in landscape keeps the TV mock; full screen only happens on tap.
// · Android / Chrome: also enters browser full screen (hides the system bars). Back or ✕ returns to the mock.
// · iPhone Safari: no full-screen API for pages, so the ad fills the browser window instead. ✕ returns to the mock.
// Add ?fs to try it on a desktop.
(function () {
  const q = new URLSearchParams(location.search), ua = navigator.userAgent || '';
  const isPhone = (navigator.userAgentData && navigator.userAgentData.mobile) ||
    /iPhone|iPod|Android.+Mobile|Windows Phone|Mobile Safari/i.test(ua) && !/iPad|Tablet/i.test(ua);
  const ctl = document.querySelector('.tv .controls, .controls');
  if ((!isPhone && !q.has('fs')) || !ctl) return;
  const root = document.documentElement, snd = document.getElementById('snd');
  const svg = p => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + p + '</svg>';
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'snd fs-btn';
  btn.innerHTML = svg('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>') + 'Full screen';
  ctl.appendChild(btn);
  const close = document.createElement('button');
  close.type = 'button'; close.className = 'fs-close'; close.setAttribute('aria-label', 'Exit full screen');
  close.innerHTML = svg('<path d="M6 6l12 12M18 6 6 18"/>');
  const hint = document.createElement('div');
  hint.className = 'fs-hint';
  hint.innerHTML = svg('<rect x="6" y="2" width="12" height="20" rx="2.5"/><path d="M2 16a10 10 0 0 0 6 5"/>') + 'Turn your phone sideways for a bigger picture';
  document.body.append(close, hint);

  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  function enter() {
    root.classList.add('fs');
    if (snd && !snd.classList.contains('on')) snd.click();          // the tap allows sound
    const req = root.requestFullscreen || root.webkitRequestFullscreen;
    if (req) try { const p = req.call(root); if (p && p.catch) p.catch(() => {}); } catch (e) {}
    scrollTo(0, 0);
  }
  function exit() {
    root.classList.remove('fs');
    if (fsEl()) try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) {}
  }
  btn.addEventListener('click', enter);
  close.addEventListener('click', exit);
  ['fullscreenchange', 'webkitfullscreenchange'].forEach(ev =>
    document.addEventListener(ev, () => { if (!fsEl()) root.classList.remove('fs'); }));   // Android back gesture
  addEventListener('keydown', e => { if (e.key === 'Escape') exit(); });
})();
