/* */
const Q = new URLSearchParams(location.search);
export const BRAND_LEVEL = Q.has('brand') ? Math.max(0, Math.min(2, parseInt(Q.get('brand'), 10) || 0)) : 1;
let LOGO = null;
const img = (h, extra) => `<img src="${LOGO}" alt="RealTruck" style="display:block;height:${h}px;width:auto;margin:0 auto;${extra || ''}">`;
/* swap any placeholder now on the page, and keep doing it for ones the core creates later (the end sheet is built at the end) */
function swap() {
  if (!LOGO || BRAND_LEVEL === 0) return;
  const bar = document.getElementById('rt-logo');
  if (bar && !bar.dataset.real) { bar.dataset.real = '1'; bar.style.border = '0'; bar.style.height = '26px'; bar.style.padding = '0 6px 0 0'; bar.innerHTML = img(22, 'margin:2px 0'); }
  for (const el of document.querySelectorAll('#rt-sheet .logo, .tc-logo-slot')) if (!el.dataset.real) { el.dataset.real = '1'; el.style.border = '0'; el.style.height = 'auto'; el.innerHTML = img(30); }
}
export async function initBrand(setsInfo) {
  if (BRAND_LEVEL === 0) { const bar = document.getElementById('rt-logo'); if (bar) bar.style.visibility = 'hidden'; return; }
  try { const info = await setsInfo(); if (info.logo) LOGO = 'assets/brand/' + info.logo; } catch (e) { LOGO = null; }
  if (!LOGO) return;
  swap(); new MutationObserver(swap).observe(document.body, { childList: true, subtree: true });
}
