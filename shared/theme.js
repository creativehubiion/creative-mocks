// Night mode toggle for the preview pages: darkens the page around the TV and swaps in the white iion logo.
// The choice is remembered per viewer (localStorage).
(function () {
  const root = document.documentElement, KEY = 'iionNight';
  let on = false;
  try { on = localStorage.getItem(KEY) === '1'; } catch (e) {}
  const logo = document.querySelector('.nav img');
  const light = logo && logo.getAttribute('src');
  const dark = light && light.replace('iion-logo.png', 'iion-logo-dark.png');
  const MOON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>';
  const SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'night-toggle';
  function apply() {
    root.classList.toggle('night', on);
    if (logo && dark) logo.setAttribute('src', on ? dark : light);
    btn.innerHTML = on ? SUN : MOON;
    btn.title = on ? 'Light mode' : 'Night mode';
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.setAttribute('aria-label', on ? 'Switch to light mode' : 'Switch to night mode');
  }
  btn.addEventListener('click', () => { on = !on; try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) {} apply(); });
  // slim header: logo left, mock name centre (brand + headline from the hero), toggle right; the hero block is hidden
  const nav = document.querySelector('.nav'), h1 = document.querySelector('.hero h1'), eb = document.querySelector('.hero .eyebrow');
  // format label next to the logo (text before "·" in the eyebrow): Interactive CTV / Hybrid playable / Playable
  const fmt = eb ? eb.textContent.split('·')[0].trim() : '';
  if (nav && logo && fmt) {
    const left = document.createElement('div'); left.className = 'nav-left';
    logo.replaceWith(left); left.appendChild(logo);
    const f = document.createElement('span'); f.className = 'nav-format'; f.textContent = fmt; left.appendChild(f);
  }
  if (nav && h1) {
    const t = document.createElement('div'); t.className = 'nav-title';
    const brand = document.createElement('span'); brand.className = 'brand';
    brand.textContent = eb ? eb.textContent.split('·').pop().trim() : '';
    t.append(brand, h1); nav.appendChild(t);
    document.body.classList.add('slim');
  }
  (nav || document.body).appendChild(btn);
  // keep the sound button attached to the device (TV: in the stand; phone: under it), at any window size
  const tv = document.querySelector('.tv, .phone'), ctl = document.querySelector('.controls');
  if (tv && ctl && ctl.parentNode !== tv) tv.appendChild(ctl);
  apply();
})();
