/* Trail to Camp v2 HUD (DOM): the choice prototype's unlock bar, counters, SHUT button, camp reveal and sheets, restyled to the owner's
   "icon plus number" rule, and the item-focused gear-found pop-up. The DOM never drives the game: it sets S.hold.hi / S.hold.pending.
   - Road pictograms (drawPicto) are the one visual language: the road signs, the ahead chip, the cards and NEXT LEG use the same drawings.
   - The pop-up's cards hold no art of their own: the view draws each product's turntable into the card's .tt rect (cardRects()).
   - The bar: "CODE UNLOCK n / target", banked solid, on board at risk striped, padlocked coupon at the target, and under it the distance
     track (gates, ute, camp) with the metres to camp that the roadside boards also show. */
import * as L from './rules.js';

const Y = '#FFC600';
export const word = t => String(t || '').replace(/LOCKS IN (\d+) MORE/g, 'PROTECTS $1 MORE GEAR').replace(/LOCKS IN (\d+)/g, 'PROTECTS $1 GEAR').replace(/\blocked\b/g, 'protected').replace(/\bLOCKED\b/g, 'PROTECTED').replace(/\bSAFE\b/g, 'PROTECTED');
const PS = (s0) => `<svg class="tc-pp" viewBox="0 0 30 18" aria-hidden="true">${s0}</svg>`;
export const PICON = {
  divider: PS('<rect x="3" y="3" width="24" height="12" fill="none" stroke="#000" stroke-width="2.4"/><rect x="13.5" y="3" width="3" height="12" fill="#000"/>'),
  slide: PS('<rect x="3" y="5" width="18" height="8" fill="#000"/><path d="M22 9h6M25 6l3 3-3 3" stroke="#000" stroke-width="2" fill="none"/>'),
  rollM: PS('<rect x="2" y="8" width="26" height="4" fill="#000"/><circle cx="25" cy="7" r="3.2" fill="#000"/>'),
  rollE: PS('<rect x="2" y="8" width="26" height="4" fill="#000"/><circle cx="25" cy="7" r="3.2" fill="#000"/><path d="M12 1l-3 5h3l-2 4 5-6h-3l2-3z" fill="#000"/>'),
  bars: PS('<rect x="3" y="12" width="24" height="3" fill="#000"/><rect x="7" y="4" width="3" height="9" fill="#000"/><rect x="20" y="4" width="3" height="9" fill="#000"/><rect x="4" y="3" width="9" height="2.6" fill="#000"/><rect x="17" y="3" width="9" height="2.6" fill="#000"/>'),
  rack: PS('<rect x="3" y="12" width="24" height="3" fill="#000"/><rect x="4" y="5" width="3" height="8" fill="#000"/><rect x="23" y="5" width="3" height="8" fill="#000"/><rect x="3" y="3" width="24" height="3" fill="#000"/>'),
  adventure: PS('<rect x="3" y="12" width="24" height="3" fill="#000"/><rect x="5" y="7" width="3" height="6" fill="#000"/><rect x="22" y="7" width="3" height="6" fill="#000"/><rect x="3" y="5" width="24" height="3" fill="#000"/>'),
  ladder: PS('<rect x="3" y="12" width="20" height="3" fill="#000"/><rect x="4" y="4" width="3" height="9" fill="#000"/><rect x="19" y="4" width="3" height="9" fill="#000"/><rect x="2" y="2" width="27" height="3" fill="#000"/>')
};
export const SHORT = { divider: 'BED DIVIDER', slide: 'MT SLIDE', rollM: 'EVOm ROLL COVER', rollE: 'EVOe ROLL COVER', bars: 'CROSS BARS', rack: 'ACCESSORY RACK 75', ladder: 'LADDER RACK', adventure: 'ADVENTURE RACK 75' };
export function drawPicto(c, type, S0, fill = Y) {
  const m = S0 / 2, k = S0 / 100; c.save(); c.translate(m, m);
  c.fillStyle = fill; c.strokeStyle = '#000'; c.lineWidth = S0 * 0.06; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(0, -m * 0.92); c.lineTo(m * 0.92, 0); c.lineTo(0, m * 0.92); c.lineTo(-m * 0.92, 0); c.closePath(); c.fill(); c.stroke();
  c.fillStyle = '#000'; c.lineWidth = S0 * 0.05; c.lineCap = 'round';
  const P = (pts, f) => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x * k, y * k) : c.moveTo(x * k, y * k)); if (f) { c.closePath(); c.fill(); } else c.stroke(); };
  const O = (x, y, r) => { c.beginPath(); c.arc(x * k, y * k, r * k, 0, 6.283); c.fill(); };
  if (type === 'rocks') { P([[-24, 22], [-24, -16], [8, 22]], true); O(10, -10, 6); O(18, 3, 5); O(23, 15, 4); }
  else if (type === 'roo') { c.save(); c.rotate(-0.5); c.beginPath(); c.ellipse(-2 * k, 2 * k, 9 * k, 15 * k, 0, 0, 6.283); c.fill(); c.restore(); O(9, -16, 5); P([[11, -21], [13, -27]]); P([[-8, 14], [-26, 22]]); P([[0, 16], [8, 22]]); }
  else if (type === 'corrug') { for (const y of [-12, 0, 12]) { c.beginPath(); for (let x = -22; x <= 22; x += 2) { const yy = y + 4 * Math.sin(x * 0.45); x === -22 ? c.moveTo(x * k, yy * k) : c.lineTo(x * k, yy * k); } c.stroke(); } }
  else if (type === 'grid') { P([[-24, 10], [-12, -2], [12, -2], [24, 10]]); for (let x = -10; x <= 10; x += 5) P([[x, -2], [x, 10]]); P([[-26, 16], [26, 16]]); }
  else if (type === 'creek') { for (const y of [-6, 6, 18]) { c.beginPath(); for (let x = -22; x <= 22; x += 2) { const yy = y + 3.5 * Math.sin(x * 0.3); x === -22 ? c.moveTo(x * k, yy * k) : c.lineTo(x * k, yy * k); } c.stroke(); } P([[-12, -12], [12, -12], [8, -20], [-8, -20]], true); }
  else if (type === 'pothole') { c.beginPath(); c.ellipse(-10 * k, 4 * k, 10 * k, 5 * k, 0, 0, 6.283); c.fill(); c.beginPath(); c.ellipse(12 * k, 12 * k, 8 * k, 4 * k, 0, 0, 6.283); c.fill(); P([[-26, -8], [26, -8]]); }
  else if (type === 'crest') { c.beginPath(); c.moveTo(-28 * k, 18 * k); c.quadraticCurveTo(0, -14 * k, 28 * k, 18 * k); c.closePath(); c.fill(); P([[0, -10], [0, -26]]); P([[-6, -20], [0, -26], [6, -20]]); }
  else if (type === 'bay') { c.strokeRect(-18 * k, -14 * k, 36 * k, 28 * k); P([[-18, -4], [18, -4]]); P([[-18, 6], [18, 6]]); }
  else if (type === 'log' || type === 'branch') { c.save(); c.rotate(-0.25); c.fillRect(-26 * k, -5 * k, 52 * k, 10 * k); c.restore(); P([[-8, -6], [-14, -18]]); P([[10, 2], [18, -12]]); P([[-26, 16], [26, 16]]); }
  else if (type === 'washout') { P([[-26, 16], [-26, -16], [26, -16]], false); c.beginPath(); c.moveTo(10 * k, 16 * k); c.lineTo(26 * k, 16 * k); c.lineTo(26 * k, -16 * k); c.lineTo(2 * k, -16 * k); c.lineTo(8 * k, -4 * k); c.lineTo(0, 4 * k); c.closePath(); c.fill(); }
  else if (type === 'side') { P([[-10, 24], [-10, -4], [10, -20]]); P([[4, -20], [10, -20], [10, -14]]); P([[-10, -4], [-10, -24]]); }
  c.restore();
}
const pc = {};
export function pictoURL(type) { if (pc[type]) return pc[type]; const cv = document.createElement('canvas'); cv.width = cv.height = 96; drawPicto(cv.getContext('2d'), type, 96); return (pc[type] = cv.toDataURL()); }
const pic = (type, px, cls) => `<img class="tc-pic ${cls || ''}" src="${pictoURL(type)}" width="${px}" height="${px}" alt="">`;
/* small icons (inline SVG, white on dark): gear piece, loose piece, secure stack +n, tap, big item, long load, jerry can, strap, full */
const SV = (vb, s) => `<svg class="tc-ic" viewBox="${vb}" aria-hidden="true">${s}</svg>`;
export const IC = {
  gear: SV('0 0 24 24', '<rect x="3" y="8" width="18" height="12" rx="2" fill="#fff"/><rect x="8" y="4" width="8" height="5" rx="1.5" fill="none" stroke="#fff" stroke-width="2"/>'),
  loose: SV('0 0 24 24', '<g transform="rotate(-16 12 14)"><rect x="3" y="8" width="18" height="12" rx="2" fill="#ff5a3c"/></g><path d="M2 4l3 3M22 4l-3 3M12 1v3" stroke="#ff5a3c" stroke-width="2" stroke-linecap="round"/>'),
  stack: n => SV('0 0 40 24', `<rect x="2" y="14" width="18" height="7" fill="#fff"/><rect x="2" y="6" width="18" height="7" fill="#fff" opacity=".55"/><path d="M0 12.5h22" stroke="${Y}" stroke-width="2.4"/><text x="24" y="19" font-family="Oswald,Impact,sans-serif" font-weight="700" font-size="15" fill="${Y}">+${n}</text>`),
  tap: SV('0 0 40 24', `<path d="M12 22v-9a2 2 0 0 1 4 0v5l1-1a2 2 0 0 1 3 0l3 3v2" fill="none" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/><circle cx="14" cy="6" r="4" fill="none" stroke="${Y}" stroke-width="2"/><text x="25" y="17" font-family="Oswald,Impact,sans-serif" font-weight="700" font-size="11" fill="${Y}">SHUT</text>`),
  big: n => SV('0 0 44 24', `<path d="M2 20h20V10l-10-6-10 6z" fill="#fff"/><text x="24" y="19" font-family="Oswald,Impact,sans-serif" font-weight="700" font-size="15" fill="${Y}">x${n}</text>`),
  long: n => SV('0 0 44 24', `<rect x="1" y="8" width="22" height="3" fill="#fff"/><rect x="1" y="13" width="22" height="3" fill="#fff"/><text x="25" y="19" font-family="Oswald,Impact,sans-serif" font-weight="700" font-size="15" fill="${Y}">x${n}</text>`),
  jerry: n => SV('0 0 44 24', `<path d="M4 6h10l4 4v12H4z" fill="#fff"/><rect x="6" y="2" width="5" height="4" fill="#fff"/><text x="22" y="19" font-family="Oswald,Impact,sans-serif" font-weight="700" font-size="15" fill="${Y}">x${n}</text>`),
  tall: n => SV('0 0 40 24', `<rect x="3" y="17" width="14" height="5" fill="#fff"/><rect x="3" y="11" width="14" height="5" fill="#fff"/><rect x="3" y="5" width="14" height="5" fill="#fff" opacity=".6"/><text x="21" y="19" font-family="Oswald,Impact,sans-serif" font-weight="700" font-size="14" fill="${Y}">${n}</text>`),
  strap: SV('0 0 24 24', `<rect x="3" y="9" width="18" height="11" fill="#fff"/><path d="M1 13h22" stroke="${Y}" stroke-width="3"/>`),
  full: SV('0 0 24 24', '<rect x="3" y="5" width="18" height="15" fill="none" stroke="#fff" stroke-width="2"/><path d="M5 18L19 7" stroke="#ff5a3c" stroke-width="2.4"/>'),
  tick: '<i class="tc-tick">✓</i>',
  shield: SV('0 0 24 24', `<path d="M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" fill="${Y}"/><path d="M8 12l3 3 5-6" fill="none" stroke="#000" stroke-width="2.2"/>`),
  haul: SV('0 0 24 24', `<rect x="2" y="9" width="14" height="12" fill="${Y}"/><path d="M2 13h14" stroke="#000" stroke-width="1.5"/><path d="M19 3v8M15 7h8" stroke="${Y}" stroke-width="2.6"/>`),
  noEarn: SV('0 0 24 24', '<rect x="4" y="8" width="16" height="12" fill="none" stroke="#bbb" stroke-width="2"/><path d="M4 20L20 8" stroke="#bbb" stroke-width="2"/>'),
  coupon: SV('0 0 30 20', `<rect x="1" y="3" width="28" height="14" fill="none" stroke="${Y}" stroke-width="2" stroke-dasharray="3 2"/><rect x="11" y="8" width="8" height="6" fill="${Y}"/><path d="M12.5 8V6a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="${Y}" stroke-width="1.6"/>`)
};
export const ROLE = { divider: 'secure', rollM: 'secure', bars: 'secure', slide: 'haul', rollE: 'haul', rack: 'haul', ladder: 'haul', adventure: 'haul' };
const roleRow = id => ROLE[id] === 'secure' ? `<span class="rl">${IC.shield}</span><span class="cost">${IC.noEarn}</span>` : `<span class="rl">${IC.haul}</span><span class="cost">${IC.loose}</span>`;
const legsTrack = k => { let h = '<span class="lg">'; for (let i = 0; i < 4; i++) h += `<i class="${i <= k ? 'on' : ''}${i === k + 1 ? ' nx' : ''}"></i>`; return h + '⛺</span>'; };
/* what each product does, as at most three icons (secure-line stack, the features it answers with ticks, tap, x2/x3) */
function productIcons(id, ahead) {
  const shakes = ahead.filter(t => L.HZT[t] && L.HZT[t].cat === 'shake').slice(0, 2), withP = (pre, arr) => pre + arr.map(t => `<span class="pt">${pic(t, 26)}${IC.tick}</span>`).join('');
  switch (id) {
    case 'divider': return withP(IC.stack(1), shakes);
    case 'rollM': return withP(IC.stack(1), shakes);
    case 'bars': return withP(IC.stack(2), shakes.slice(0, 1)) + IC.tall(7);
    case 'slide': return IC.jerry(2);
    case 'rollE': return IC.tap + withP('', ahead.filter(t => L.HZT[t] && L.HZT[t].cat === 'shake').slice(0, 1));
    case 'rack': return IC.big(3);
    case 'ladder': return IC.long(2);
  }
  return '';
}
const LOCK = open => `<svg viewBox="0 0 60 40" aria-hidden="true"><rect x="2" y="6" width="56" height="30" fill="#111" stroke="${Y}" stroke-width="2.5" stroke-dasharray="5 3"/><path d="${open ? 'M23 18v-6a7 7 0 0 1 14 -1' : 'M23 18v-6a7 7 0 0 1 14 0v6'}" fill="none" stroke="${Y}" stroke-width="3.5"/><rect x="19" y="17" width="22" height="15" fill="${Y}"/><rect x="28.5" y="21" width="3" height="6" fill="#000"/></svg>`;
export const maskCode = () => L.CONFIG.code.replace(/[^-]/g, '•');

const CSS = `
#tc-hud{position:fixed;left:12px;bottom:calc(env(safe-area-inset-bottom) + 14px);z-index:5;pointer-events:none;display:flex;align-items:center;gap:12px;color:#fff;text-shadow:0 2px 4px #000c;transition:opacity .3s}
#tc-hud .c{display:flex;align-items:center;gap:5px;background:#000b;padding:4px 9px 4px 6px;font:700 30px/1 Oswald,sans-serif}#tc-hud .c .tc-ic{width:28px;height:28px}
#tc-hud .c.lo{color:#ffcf6a}#tc-hud .c.lo.z{opacity:.35}#tc-hud .c.pop{animation:tcnum .3s ease-out}#tc-hud .m{background:${Y};color:#000;font:700 22px/1 Oswald,sans-serif;padding:4px 8px;transform:skewX(-10deg);text-shadow:none}
@keyframes tcnum{0%{transform:scale(1.35)}100%{transform:scale(1)}}
.tc-ic{display:inline-block;vertical-align:middle;width:34px;height:22px}.tc-pic{display:inline-block;vertical-align:middle}.tc-tick{font-style:normal;position:absolute;right:-5px;bottom:-4px;background:#1f9d55;color:#fff;font:700 11px/15px Roboto,sans-serif;width:15px;height:15px;border-radius:50%;text-align:center}
.rt-call:not(.cue){text-shadow:0 2px 0 #000,0 0 5px #000}.rt-call.tc-box{display:flex;align-items:center;gap:6px;background:#000;padding:3px 10px 4px;border-left:4px solid ${Y};text-shadow:none;font-size:clamp(20px,3.2vw,28px);animation:tcbox 1.25s ease-out forwards;white-space:nowrap}
.rt-call .tc-ic{width:30px;height:24px}.rt-call .red{color:#ff6a4c}
@keyframes tcbox{0%{opacity:0;transform:translate(-50%,-30%) scale(.7)}12%{opacity:1;transform:translate(-50%,-50%) scale(1.08)}24%{transform:translate(-50%,-50%) scale(1)}78%{opacity:1;transform:translate(-50%,-70%)}100%{opacity:0;transform:translate(-50%,-95%)}}
.tc-plus{position:fixed;z-index:6;pointer-events:none;transform:translate(-50%,-50%);font:700 20px Oswald,sans-serif;color:${Y};text-shadow:0 2px 0 #000,0 0 4px #000;white-space:nowrap;animation:tcplus .7s ease-out forwards}@keyframes tcplus{0%{opacity:0;transform:translate(-50%,-20%) scale(.6)}20%{opacity:1;transform:translate(-50%,-60%) scale(1.1)}100%{opacity:0;transform:translate(-50%,-190%) scale(1)}}
#tc-ub{position:fixed;left:0;right:0;top:46px;z-index:5;pointer-events:none;background:#000e;padding:5px 12px 6px;color:#fff;transition:opacity .3s;border-bottom:1px solid #333}
#tc-ub .row{display:flex;align-items:center;gap:9px;white-space:nowrap}#tc-ub .lab{font:700 11px/1.05 Roboto,sans-serif;letter-spacing:.14em;color:${Y}}
#tc-ub .cnt{font:700 30px/1 Oswald,sans-serif;display:inline-block;transform-origin:20% 60%}#tc-ub .cnt small{font-size:.6em;color:#ddd}#tc-ub .cnt.pop{animation:tcnum .28s ease-out}#tc-ub .cnt.hit{animation:tchit .5s ease-out}@keyframes tchit{0%{color:#ffd27a;transform:scale(1.15)}100%{transform:scale(1)}}
#tc-ub .st{margin-left:auto;display:flex;align-items:center;gap:8px;font:700 18px Oswald,sans-serif}#tc-ub .st .tc-ic{width:22px;height:20px}#tc-ub .st .lo{color:#ffd27a}#tc-ub .st .bat{display:flex;gap:3px;padding:2px 4px;border:1.5px solid #9cc9ff}#tc-ub .st .bat i{display:block;width:9px;height:15px;background:#333}#tc-ub .st .bat i.on{background:#9cd2ff;box-shadow:0 0 6px #9cd2ff}#tc-ub .st .bat.idle{opacity:.4}#tc-ub .st .bat.idle i.on{box-shadow:none}#tc-ub .st .al{color:${Y};font-size:13px;letter-spacing:.08em}
#tc-ub .trk{position:relative;height:18px;margin:6px 26px 0 0;background:#262626;border:1px solid #5a5a5a}
#tc-ub .f{position:absolute;top:0;bottom:0;left:0;width:0;transition:width .3s,left .3s}#tc-ub .f1{background:${Y}}#tc-ub .f2{background:${Y}}#tc-ub .f3{background:repeating-linear-gradient(-45deg,#ffe27a 0 5px,#b8952a 5px 10px)}
#tc-ub .sw{position:absolute;top:0;bottom:0;width:50px;left:-60px;background:linear-gradient(90deg,#fff0,#fffd,#fff0)}#tc-ub.flash .sw{animation:tcsw .7s ease-out}@keyframes tcsw{to{left:100%}}
#tc-ub.lose .trk{animation:tclose .45s}@keyframes tclose{0%{box-shadow:0 0 0 3px #ffb347}100%{box-shadow:0 0 0 0 #ffb34700}}
#tc-ub .tgt{position:absolute;top:-6px;bottom:-6px;width:3px;margin-left:-1px;background:#fff}
#tc-ub .lock{position:absolute;top:50%;width:54px;height:36px;margin:-18px 0 0 -27px}#tc-ub .lock svg{width:100%;height:100%;display:block}
#tc-ub .lock.almost{animation:tcshake .5s infinite;filter:drop-shadow(0 0 6px ${Y})}#tc-ub .lock.open{animation:tcburst .6s ease-out forwards}
@keyframes tcshake{0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg) scale(1.08)}75%{transform:rotate(8deg) scale(1.08)}}@keyframes tcburst{0%{transform:scale(1)}40%{transform:scale(1.6);filter:drop-shadow(0 0 14px ${Y})}100%{transform:scale(1.2);opacity:0}}
#tc-ub .star{position:absolute;top:50%;margin:-11px 0 0 -9px;font:700 18px/22px Roboto,sans-serif;color:#555;width:18px;text-align:center}#tc-ub .star.on{color:${Y};text-shadow:0 0 6px ${Y}}
#tc-ub .road{position:relative;height:4px;margin:11px 64px 4px 0;background:#555}#tc-ub .road i{position:absolute;top:-4px;width:3px;height:12px;margin-left:-1px;background:${Y}}#tc-ub .road i.on{top:-9px;width:26px;height:16px;margin-left:-13px;background:${Y};border:1px solid #000}#tc-ub .road i .tc-pp{display:block;width:24px;height:14px}
.tc-pp{display:inline-block;vertical-align:middle}#tc-choice .bn .fp{position:absolute;right:6px;top:6px;display:flex;gap:3px}#tc-choice .bn .fp span{background:${Y};padding:1px 2px;display:block}#tc-choice .bn .fp .tc-pp{width:26px;height:16px;display:block}#tc-choice .bn{position:relative}
#tc-ub .road b{position:absolute;right:-62px;top:-8px;font:700 12px/18px Oswald,sans-serif;letter-spacing:.04em;color:#fff;white-space:nowrap}#tc-ub .road b span{color:${Y}}#tc-ub .road .ic{position:absolute;top:-8px;width:22px;height:14px;margin-left:-11px}
#tc-ahead{position:fixed;left:10px;z-index:5;pointer-events:none;display:flex;align-items:center;gap:8px;background:#000d;border-left:4px solid ${Y};padding:4px 10px 4px 5px;color:#fff;opacity:0;transform:translateX(-12px);transition:opacity .25s,transform .25s;font:700 22px Oswald,sans-serif}
#tc-ahead.show{opacity:1;transform:none}#tc-ahead img{width:40px;height:40px}#tc-ahead .lo{color:#ff8a70;display:flex;align-items:center;gap:3px}#tc-ahead .lo .tc-ic{width:22px;height:22px}
#tc-shut{position:fixed;right:10px;bottom:calc(env(safe-area-inset-bottom) + 70px);z-index:6;width:84px;height:66px;border:0;border-radius:0;background:${Y};color:#000;font:700 15px/1.05 Oswald,sans-serif;text-transform:uppercase;display:none;padding:0;overflow:hidden}
#tc-shut .bar{position:absolute;left:0;bottom:0;height:5px;background:#000;width:0}#tc-shut.wait{background:#333;color:#aaa}#tc-shut.on{background:#fff}#tc-shut.no{background:#333;color:#ff8a7a}
#tc-dim{position:fixed;inset:0;z-index:6;pointer-events:none;opacity:0;transition:opacity .25s;background:radial-gradient(ellipse at 50% 46%,#000a 10%,#000e 100%)}
#tc-choice{position:fixed;inset:0;z-index:7;display:none;flex-direction:column;align-items:center;justify-content:center;padding:calc(env(safe-area-inset-top) + 8px) 10px calc(env(safe-area-inset-bottom) + 10px);box-sizing:border-box;color:#fff;text-align:center;overflow:hidden}
#tc-choice.show{display:flex}
#tc-choice .rays{display:none}
#tc-choice .burst{position:absolute;left:50%;top:44%;width:30px;height:30px;margin:-15px;border-radius:50%;background:#fff;box-shadow:0 0 60px 30px ${Y};animation:tcb2 .7s ease-out forwards;pointer-events:none}@keyframes tcb2{0%{transform:scale(.2);opacity:1}100%{transform:scale(16);opacity:0}}
#tc-choice .wrap{position:relative;width:min(560px,100%);display:flex;flex-direction:column;gap:9px;align-items:stretch}
#tc-choice .bn{background:#000;border:2px solid ${Y};box-shadow:0 0 24px #ffc60066;padding:6px 10px 8px;animation:tcpopin .4s cubic-bezier(.2,1.6,.4,1) both}@keyframes tcpopin{0%{transform:scale(.3);opacity:0}100%{transform:none;opacity:1}}
#tc-choice .bn .k{font:700 clamp(22px,6.6vw,34px)/1 Oswald,sans-serif;color:${Y};letter-spacing:.02em}#tc-choice .bn .t{font:700 clamp(16px,4.6vw,22px)/1.1 Oswald,sans-serif;letter-spacing:.06em;margin-top:3px}
#tc-choice .me{display:flex;justify-content:center;gap:14px;font:700 24px/1 Oswald,sans-serif}#tc-choice .me span{display:flex;align-items:center;gap:5px;background:#000c;padding:3px 9px 3px 5px}#tc-choice .me .tc-ic{width:24px;height:24px}#tc-choice .me .lo{color:#ff8a70}
#tc-choice .me .ok{color:#7fe08a}#tc-choice .me .lg{display:flex;align-items:center;gap:3px;font-size:16px}#tc-choice .me .lg i{display:block;width:16px;height:5px;background:#555}#tc-choice .me .lg i.on{background:${Y}}#tc-choice .me .lg i.nx{background:#fff}
#tc-choice .card .role{position:absolute;top:6px;left:6px;z-index:1}#tc-choice .card .role .tc-ic{width:28px;height:28px}#tc-choice .card .role .cost .tc-ic{width:16px;height:16px;opacity:.85}
#tc-choice .cards{display:flex;gap:8px;justify-content:center}
#tc-choice .card{flex:1 1 0;min-width:0;max-width:260px;display:flex;flex-direction:column;align-items:center;background:none;border:2px solid #ffc60099;color:#fff;padding:0 6px 8px;border-radius:0;cursor:pointer;position:relative;font:inherit;opacity:0;animation:tcflip .45s cubic-bezier(.2,1.4,.4,1) forwards;transition:transform .18s,box-shadow .18s,filter .18s,border-color .18s;touch-action:manipulation;perspective:600px}
@keyframes tcflip{0%{opacity:0;transform:perspective(600px) rotateY(85deg) scale(.7)}100%{opacity:1;transform:none}}
#tc-choice .card .tt{width:100%;aspect-ratio:1/1.05;position:relative}
#tc-choice .card .nm{font:700 clamp(19px,5.6vw,26px)/1 Oswald,sans-serif;letter-spacing:.01em;margin-top:2px;min-height:1.1em}#tc-choice .card .get{font:700 clamp(14px,4vw,17px)/1.1 Oswald,sans-serif;color:${Y};margin-top:6px;letter-spacing:.02em}#tc-choice .card .sm{margin-top:5px;font:700 15px/1 Oswald,sans-serif;color:#fff;background:#000a;padding:3px 7px;border:1.5px solid ${Y}}#tc-choice .card .sm span{color:${Y};font-size:11px;letter-spacing:.12em}#tc-choice .card .sm b{color:${Y}}#tc-choice .card .sm.dim{border-color:#555;color:#aaa}
#tc-choice .card .but{font:500 clamp(12px,3.4vw,14px)/1.2 Roboto,sans-serif;color:#aaa;margin-top:3px}
#tc-choice .card .pr{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:6px;min-height:30px}#tc-choice .card .pr .pt{position:relative;display:inline-block}
#tc-choice .card .i{position:absolute;top:5px;right:5px;width:22px;height:22px;border-radius:50%;border:1.5px solid #fff;font:700 14px/20px Georgia,serif;font-style:italic;display:none}
#tc-choice .card .bk{position:absolute;inset:0;background:#111;display:none;align-items:center;justify-content:center;padding:12px;font:500 15px/1.3 Roboto,sans-serif;color:#eee}
#tc-choice .card.flip .bk{display:flex}
#tc-choice .cards.has .card{filter:brightness(.45)}#tc-choice .cards.has .card.sel{filter:none;transform:scale(1.07);border-color:${Y};box-shadow:0 0 0 2px ${Y},0 0 34px #ffc600b0;z-index:2}#tc-choice .card.sel .i{display:block}
#tc-choice .nl{display:flex;align-items:center;justify-content:center;gap:6px;background:#000c;padding:5px 8px;font:700 13px Roboto,sans-serif;letter-spacing:.12em;color:#bbb}#tc-choice .nl img{width:30px;height:30px}
#tc-choice .fit{margin-top:2px;padding:15px;background:${Y};color:#000;border:0;border-radius:0;font:700 22px Oswald,sans-serif;letter-spacing:.08em;cursor:pointer;touch-action:manipulation}#tc-choice .fit[disabled]{background:#333;color:#888}
@media (orientation:landscape) and (min-width:700px){#tc-choice .wrap{width:min(860px,100%)}}
@media (orientation:landscape) and (max-height:560px){#tc-choice .card .tt{aspect-ratio:1/0.62}#tc-choice .bn .k{font-size:22px}}
#rt-start{bottom:calc(env(safe-area-inset-bottom) + 18px)!important;width:min(380px,calc(100vw - 32px))}
.tc-st{background:#000e;border-top:4px solid ${Y};padding:14px;text-align:center}.tc-st .h{font:700 clamp(26px,7.4vw,34px)/1 Oswald,sans-serif;text-transform:uppercase}
.tc-st .cp{position:relative;margin:12px auto 10px;width:230px;height:74px;border:2.5px dashed ${Y};display:flex;align-items:center;justify-content:center;gap:12px;background:#151515}.tc-st .cp svg{width:52px;height:36px}.tc-st .cp .c{font:700 26px Oswald,sans-serif;letter-spacing:.14em;color:${Y}}
.tc-st .s{font:500 14px Roboto,sans-serif;color:#ddd}.tc-st .go{display:inline-block;margin-top:12px;background:${Y};color:#000;font:700 16px Roboto,sans-serif;letter-spacing:.08em;padding:12px 22px}
#tc-rv{position:fixed;inset:0;z-index:7;pointer-events:none;display:none;align-items:center;justify-content:flex-start;padding-top:calc(env(safe-area-inset-top) + 300px);flex-direction:column;color:#fff;text-align:center}#tc-rv.show{display:flex}
#tc-rv .lab{font:700 14px Roboto,sans-serif;letter-spacing:.16em;background:#000;padding:5px 10px;border-left:4px solid ${Y}}#tc-rv .num{font:700 clamp(60px,17vw,104px)/1 Oswald,sans-serif;text-shadow:0 3px 0 #000,0 0 12px #000;margin-top:6px}#tc-rv .num small{font-size:.45em;color:#ddd}#tc-rv .num.hit{color:${Y}}#tc-rv .sub{font:700 20px Oswald,sans-serif;text-shadow:0 2px 0 #000;min-height:24px}
#tc-fc{position:fixed;z-index:8;left:0;top:0;width:260px;height:96px;margin:-48px 0 0 -130px;perspective:700px;pointer-events:none;display:none}
#tc-fc .in{position:absolute;inset:0;transform-style:preserve-3d;transition:transform .7s cubic-bezier(.3,1.4,.5,1)}#tc-fc.flip .in{transform:rotateY(180deg)}
#tc-fc .fa{position:absolute;inset:0;backface-visibility:hidden;display:flex;align-items:center;justify-content:center;gap:12px;background:#151515;border:2.5px dashed ${Y};overflow:hidden}#tc-fc .fa svg{width:56px;height:38px}#tc-fc .bk{transform:rotateY(180deg);background:${Y};border:0;flex-direction:column;gap:2px;color:#000}
#tc-fc .bk .k{font:700 11px Roboto,sans-serif;letter-spacing:.14em}#tc-fc .bk .c{font:700 34px Oswald,sans-serif;letter-spacing:.14em}
body.tc-sheet #rt-sheet{max-height:60vh;overflow-y:auto;padding-top:12px}#rt-sheet .stamp{font-size:clamp(24px,7vw,34px)!important}#rt-sheet .stars{margin:2px 0 6px!important}#rt-sheet .coupon{margin:6px 0!important;padding:8px 10px!important}#rt-sheet .coupon .code{font-size:30px!important}#rt-sheet .logo{display:none}
.tc-two{display:flex;gap:8px}.tc-two>*{flex:1 1 0;margin:0!important}.tc-build{margin:6px 0 8px}.tc-build .hd{font:700 11px Roboto,sans-serif;letter-spacing:.14em;color:#aaa;margin-bottom:6px}.tc-build .row{display:flex;gap:6px}.tc-build .bc{flex:1 1 0;min-width:0;background:#151515;border:1.5px solid #3a3a3a;padding:7px 5px;text-align:center}
.tc-build .bc .nm{font:700 14px/1.05 Oswald,sans-serif}.tc-build .bc a{display:inline-block;margin-top:5px;font:700 11px Roboto,sans-serif;letter-spacing:.1em;color:${Y}}
.tc-mb{position:relative;height:14px;margin:4px 0 12px;background:#2b2b2b;border:1px solid #555}.tc-mb i{position:absolute;top:0;bottom:0;left:0}.tc-mb .t{position:absolute;top:-4px;bottom:-4px;width:3px;background:#fff}
#rt-sheet .stars{font:700 22px Roboto,sans-serif;color:#555;letter-spacing:.1em;margin:-4px 0 8px}#rt-sheet .stars b{color:${Y}}
#rt-logo{width:auto!important;max-width:60vw;overflow:visible!important}#rt-logo img{height:22px!important;width:auto!important}
#tc-mute{position:fixed;right:10px;top:calc(env(safe-area-inset-top) + 150px);z-index:6;width:40px;height:40px;background:#000a;border:1px solid #555;color:#fff;font:16px sans-serif;padding:0}
`;
let S = () => L.S, el = id => document.getElementById(id), hud = null, RT = null;
export function build(rt, opt) {
  RT = rt;
  const st = document.createElement('style'); st.textContent = CSS + '#tc-ub .road i{display:none !important}'; document.head.appendChild(st);
  hud = document.createElement('div'); hud.id = 'tc-hud'; hud.className = 'rt';
  hud.innerHTML = `<div class="c" id="tc-cg">${IC.gear}<span id="tc-n">0</span></div><div class="c lo z" id="tc-cl">${IC.loose}<span id="tc-nl">0</span></div><div class="m" id="tc-m" style="visibility:hidden">x1</div>`;
  document.body.appendChild(hud);
  const ub = document.createElement('div'); ub.id = 'tc-ub'; ub.className = 'rt';
  const CF = L.CONFIG, T = CF.target, X = v => (100 * v / CF.barMax).toFixed(1) + '%';
  ub.innerHTML = `<div class="row"><div class="lab">CODE<br>UNLOCK</div><div class="cnt" id="tc-ubn">0<small> / ${T}</small></div><div class="st" id="tc-ubt"></div></div>
    <div class="trk"><div class="f f1" id="tc-f1"></div><div class="f f2" id="tc-f2"></div><div class="f f3" id="tc-f3"></div><div class="sw"></div><div class="tgt" style="left:${X(T)}"></div>
    <div class="star" id="tc-s2" style="left:${X(CF.stars[1])}">★</div><div class="star" id="tc-s3" style="left:${X(CF.stars[2])}">★</div><div class="lock" id="tc-lock" style="left:${X(T)}">${LOCK(false)}</div></div>
    <div class="road">${CF.gateS.map((g, k) => `<i id="tc-g${k}" style="left:${(100 * g / CF.campS).toFixed(1)}%"></i>`).join('')}<b id="tc-dist"></b><svg class="ic" id="tc-uteic" viewBox="0 0 22 14"><circle cx="11" cy="7" r="4.5" fill="${Y}"/></svg></div>`;
  document.body.appendChild(ub);
  const ah = document.createElement('div'); ah.id = 'tc-ahead'; ah.className = 'rt'; ah.innerHTML = '<img alt=""><span class="d"></span><span class="lo"></span>'; document.body.appendChild(ah);
  const sb = document.createElement('button'); sb.id = 'tc-shut'; sb.innerHTML = '<span id="tc-shutt">SHUT<br>COVER</span><div class="bar" id="tc-shutb"></div>'; document.body.appendChild(sb);
  const stop = e => e.stopPropagation();
  for (const ev of ['pointerdown', 'pointermove', 'touchstart', 'touchmove']) sb.addEventListener(ev, stop, { passive: true });
  sb.addEventListener('pointerdown', () => { if (L.S && RT.mode === 'play' && !opt.bot()) L.S.shutReq = true; });
  addEventListener('keydown', e => { if ((e.key === 's' || e.key === 'S' || e.key === ' ') && L.S && L.S.elec && RT.mode === 'play' && !L.S.hold) { e.preventDefault(); L.S.shutReq = true; } });
  document.body.appendChild(Object.assign(document.createElement('div'), { id: 'tc-dim' }));
  const ch = document.createElement('div'); ch.id = 'tc-choice'; ch.className = 'rt'; document.body.appendChild(ch);
  for (const ev of ['pointerdown', 'pointermove', 'touchstart', 'touchmove']) ch.addEventListener(ev, stop, { passive: true });
  const rv = document.createElement('div'); rv.id = 'tc-rv'; rv.className = 'rt'; rv.innerHTML = '<div class="lab" id="tc-rvl">SEALING THE LOAD</div><div class="num" id="tc-rvn"></div><div class="sub" id="tc-rvs"></div>'; document.body.appendChild(rv);
  const fc = document.createElement('div'); fc.id = 'tc-fc'; fc.className = 'rt'; fc.innerHTML = `<div class="in"><div class="fa">${LOCK(true)}<span style="font:700 26px Oswald,sans-serif;letter-spacing:.14em;color:${Y}">${maskCode()}</span></div><div class="fa bk"><div class="k">BLACK FRIDAY CODE</div><div class="c">${CF.code}</div></div></div>`; document.body.appendChild(fc);
  const mu = document.createElement('button'); mu.id = 'tc-mute'; mu.className = 'rt'; mu.textContent = opt.muted() ? '🔇' : '🔊'; for (const ev of ['pointerdown', 'touchstart']) mu.addEventListener(ev, stop, { passive: true }); mu.addEventListener('click', () => { opt.setMuted(!opt.muted()); mu.textContent = opt.muted() ? '🔇' : '🔊'; }); document.body.appendChild(mu);
  addEventListener('keydown', e => {
    const s = L.S; if (!s || !s.hold || RT.mode !== 'play' || s.hold.phase !== 'choose') return;
    const H = s.hold, n = H.n;
    if (/^[1-3]$/.test(e.key) && +e.key <= n) { const i = +e.key - 1; if (H.hi === i) H.pending = i; else H.hi = i; e.preventDefault(); }
    else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') H.hi = H.hi < 0 ? 0 : (H.hi + n - 1) % n;
    else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') H.hi = H.hi < 0 ? 0 : (H.hi + 1) % n;
    else if ((e.key === 'Enter') && H.hi >= 0) { H.pending = H.hi; e.preventDefault(); }
  });
  document.addEventListener('click', e => { const t = e.target.closest && e.target.closest('#tc-shop, #rt-copy'); if (!t) return; if (t.id === 'tc-shop') RT.track('shop_click', Object.assign({ url: t.href }, picks())); else RT.track('code_copy', picks()); });
}

/* icon + number callouts: rules text in, a compact icon line out */
let lastLossType = 'rocks';
export function setLossType(t) { lastLossType = t; }
/* one callout lane: centre, under the chip row, one at a time (0.8 s each, queued, at most 3 waiting); rapid +n merge into a rolling number */
const LANE = { q: [], busy: false, el: null, plusN: 0, plusT: 0 };
export function laneCall(html, color, top) {
  if (!LANE.el) { LANE.el = document.createElement('div'); LANE.el.className = 'rt'; LANE.el.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);z-index:6;pointer-events:none;display:none;align-items:center;gap:6px;background:#000;padding:3px 12px 4px;border-left:4px solid #FFC600;font:700 clamp(20px,5.4vw,26px) Oswald,sans-serif;white-space:nowrap'; document.body.appendChild(LANE.el); }
  LANE.top = top; if (LANE.q.length >= 3) LANE.q.shift(); LANE.q.push([html, color]); if (!LANE.busy) laneNext();
}
function laneNext() { const it = LANE.q.shift(); if (!it) { LANE.busy = false; LANE.el.style.display = 'none'; return; } LANE.busy = true; const e = LANE.el; e.innerHTML = it[0]; e.style.color = it[1] || '#fff'; e.style.top = (LANE.top || 160) + 'px'; e.style.display = 'flex'; e.animate([{ opacity: 0, transform: 'translateX(-50%) scale(.8)' }, { opacity: 1, transform: 'translateX(-50%) scale(1)', offset: 0.15 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }], { duration: 800 }); setTimeout(laneNext, 800); }
export function iconCall(text) {
  let m;
  if ((m = /-(\d+)$/.exec(text))) return `${pic(lastLossType, 30)}<span class="red">−${m[1]}</span>`;
  if (/^COVER SHUT/.test(text)) return `${IC.tap}<span>${/HELD/.test(text) ? '✓' : ''}</span>`;
  if (/HELD|KEPT IT/.test(text)) return `${IC.strap}<span>✓</span>`;
  if (/FULL/.test(text)) return `${IC.full}<span>FULL</span>`;
  if ((m = /x(\d)/.exec(text)) && /ROLL|STREAK/.test(text)) return `<span style="color:${Y}">x${m[1]}</span>`;
  if (/TOO TALL/.test(text)) return `${IC.tall('!')}`;
  if ((m = /BANKED \+(\d+)/.exec(text))) return `${IC.strap}<span style="color:${Y}">+${m[1]}</span>`;
  if (/NOTHING TO BANK/.test(text)) return `${IC.strap}<span>0</span>`;
  return word(text);
}

let hudKey = '', ubKey = '', aheadKey = '', shutKey = '';
export function reset() { hudKey = ubKey = aheadKey = shutKey = ''; uiShown = false; rvState = ''; }
export function frame(mode, TOP) {
  const s = L.S, CF = L.CONFIG; if (!hud || !s) return;
  const key = s.onN + '|' + s.looseN + '|' + s.mult + '|' + mode + '|' + !!s.reveal;
  if (key !== hudKey) {
    const prev = hudKey ? hudKey.split('|') : [0, 0, 1]; hudKey = key;
    hud.style.opacity = mode === 'end' || s.reveal || mode === 'attract' ? 0 : 1;
    el('tc-n').textContent = s.onN; el('tc-nl').textContent = s.looseN; el('tc-cl').classList.toggle('z', !s.looseN);
    if (s.onN > +prev[0]) { const c = el('tc-cg'); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
    if (s.looseN > +prev[1]) { const c = el('tc-cl'); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
    const m = el('tc-m'); m.style.visibility = s.mult > 1 ? 'visible' : 'hidden'; m.textContent = 'x' + s.mult;
  }
  const ub = el('tc-ub'), T = CF.target, M = CF.barMax; ub.style.opacity = mode === 'attract' ? 0 : 1;
  const near = s.total >= T * 0.85, full = s.total >= T, uk = (s.done ? 'D' + Math.round(FIN.e * 10) + RT.mode : '') + s.banked + '|' + s.onN + '|' + s.looseN + '|' + near + '|' + (s.reveal && s.done === 'win') + '|' + (s.charges || 0) + (s.elec ? 'e' : '');
  if (uk !== ubKey) {
    const pv = ubKey ? ubKey.split('|').map(Number) : [0, 0, 0]; ubKey = uk;
    /* at camp the loose share converts to solid as the tally runs (finale clock); the end screen is solid to the total */
    let b = s.banked, sec = s.onN - s.looseN, lo = s.looseN; if (s.done) { const k = FIN.e >= 0 ? Math.max(0, Math.min(1, (FIN.e - FIN.t0) / Math.max(0.2, FIN.t1 - FIN.t0))) : 1; const shown = Math.round(s.total * (RT.mode === 'end' ? 1 : k)); b = shown; sec = 0; lo = 0; }
    const p = v => (100 * Math.max(0, Math.min(v, M)) / M).toFixed(2) + '%';
    el('tc-f1').style.width = p(b); el('tc-f2').style.left = p(b); el('tc-f2').style.width = p(Math.min(sec, M - b)); el('tc-f3').style.left = p(b + sec); el('tc-f3').style.width = p(Math.min(lo, M - b - sec));
    const cn = el('tc-ubn'), was = pv[0] + pv[1]; cn.innerHTML = `${s.total}<small> / ${T}</small>`;
    if (s.total > was) { cn.classList.remove('pop', 'hit'); void cn.offsetWidth; cn.classList.add('pop'); }
    else if (s.total < was) { cn.classList.remove('pop', 'hit'); void cn.offsetWidth; cn.classList.add('hit'); ub.classList.remove('lose'); void ub.offsetWidth; ub.classList.add('lose'); }
    el('tc-ubt').innerHTML = s.done ? '' : (full ? `<span class="al">REACH CAMP TO UNLOCK</span>` : near ? `<span class="al">ALMOST</span>` : '') + (s.elec ? `<span class="bat${s.looseN ? '' : ' idle'}">${'<i class=on></i>'.repeat(s.charges || 0)}${'<i></i>'.repeat(Math.max(0, (L.CONFIG.evoeCharges || 2) - (s.charges || 0)))}</span>` : '') + (lo ? `<span class="lo">${IC.loose}${lo}</span>` : '');
    el('tc-lock').classList.toggle('almost', near && !s.done);
    el('tc-s2').classList.toggle('on', s.total >= CF.stars[1]); el('tc-s3').classList.toggle('on', s.total >= CF.stars[2]);
    if (s.banked > pv[0]) { ub.classList.remove('flash'); void ub.offsetWidth; ub.classList.add('flash'); }
  }
  { const gk = s.sel.join(','); if (gk !== frame.gk) { frame.gk = gk; for (let k = 0; k < 3; k++) { const m = el('tc-g' + k); if (!m) continue; const id = s.sel[k]; m.className = id ? 'on' : ''; m.innerHTML = id ? PICON[id] : ''; } } }
  { const ic = el('tc-uteic'), q = (100 * Math.max(0, Math.min(1, s.s / s.campS))).toFixed(1) + '%'; if (ic.style.left !== q) ic.style.left = q;
    const d = Math.max(0, Math.round((s.campS - s.s) / 10) * 10), dt = el('tc-dist'), txt = '<span>⛺</span>'; void d; if (dt.dataset.t !== txt) { dt.dataset.t = txt; dt.innerHTML = txt; } }
  /* ahead chip: the next feature within 55 m as its sign, the metres, and the loose count at risk */
  let ak = '';
  if (mode === 'play' && !s.hold && !s.done) for (let i = s.hzI; i < L.HZ.length; i++) { const h = L.HZ[i], d = h.s0 - s.s; if (d < -1) continue; if (d < 55) ak = i + '|' + Math.max(0, Math.round(d / 10) * 10); break; }
  if (ak && s.looseN) ak += '|' + s.looseN;
  if (ak !== aheadKey) {
    aheadKey = ak; const e = el('tc-ahead');
    if (!ak) e.classList.remove('show');
    else { const [i, d] = ak.split('|'), h = L.HZ[+i]; if (+d <= 0) { e.classList.remove('show'); return; } e.querySelector('img').src = pictoURL(h.type); e.querySelector('.d').textContent = d + ' m'; e.querySelector('.lo').innerHTML = ''; e.style.top = (TOP + 6) + 'px'; e.classList.add('show'); }
  }
  const sb = el('tc-shut');
  if (true) { if (sb.style.display !== 'none') sb.style.display = 'none'; }
  else {
    const shut = L.isShut(), ready = !shut && s.t >= s.shutReady, ok = L.canShut(), q = shut ? (s.shutUntil - s.t) / L.SHUT_T : ready ? 1 : 1 - (s.shutReady - s.t) / L.SHUT_RE;
    const sk = (shut ? 'on' : ready ? (ok ? 'r' : 'no') : 'wait') + '|' + Math.round(q * 20);
    if (sk !== shutKey) { shutKey = sk; sb.style.display = 'block'; sb.className = shut ? 'on' : ready ? (ok ? '' : 'no') : 'wait'; el('tc-shutt').innerHTML = shut ? 'SHUT<br>' + Math.ceil(s.shutUntil - s.t) + ' s' : ready ? (ok ? 'SHUT<br>COVER' : 'TOO<br>TALL') : 'SHUT<br>…'; el('tc-shutb').style.width = (q * 100).toFixed(0) + '%'; }
  }
  const mu = el('tc-mute'); if (mu) { const vis = mode === 'play' && !s.hold ? '' : 'hidden'; if (mu.style.visibility !== vis) mu.style.visibility = vis; mu.style.top = (TOP + 64) + 'px'; }
}

/* the gear-found pop-up (true pause): header, state icons, product cards (turntable + short name + icons; "i" flips the selected card to its
   one line), NEXT LEG as road pictograms, one FIT IT */
let uiK = -1, uiShown = false, lastTap = { i: -1, t: 0 };
export const popupShown = () => uiShown;
export function uiFrame(sfx) {
  const s = L.S, H = s && s.hold, e = el('tc-choice'), dim = el('tc-dim'), att = RT.mode !== 'play';
  const want = !att && H && (H.phase === 'choose' || (H.phase === 'in' && H.t > 0.2));
  if (want && (!uiShown || H.k !== uiK)) {
    uiK = H.k; uiShown = true; const G0 = L.GATES[H.k], ahead = L.LEG_AHEAD[H.k + 1] || [];
    let h = `<div class="rays"></div><div class="burst"></div><div class="wrap"><div class="bn"><div class="k">BLACK FRIDAY GEAR FOUND</div><div class="t">${G0.title.toUpperCase()}</div>${s.sel.some(Boolean) ? `<div class="fp">${s.sel.filter(Boolean).map(id => `<span>${PICON[id]}</span>`).join('')}</div>` : ''}</div><div class="cards">`;
    const safeAfter = id => { const keep = s.sel.slice(), kb = s.bars; s.sel[H.k] = id; if (id === 'bars') s.bars = true; L.recount(); const n = s.secN; s.sel = keep; s.bars = kb; L.recount(); return n; };
    G0.opts.forEach((id, i) => { const P = L.PROD[id], sa = safeAfter(id), sn = s.secN, meter = (L.ROLE || ROLE)[id] === 'secure' || sa > sn ? `<div class="sm"><span>PROTECTED</span> ${sn} → <b>${sa}</b></div>` : ''; h += `<button class="card" data-i="${i}" style="animation-delay:${(0.2 + i * 0.16).toFixed(2)}s"><div class="role">${(L.ROLE || ROLE)[id] === 'secure' ? IC.shield : IC.haul}</div><div class="tt" data-id="${id}"></div><div class="nm">${P.card || SHORT[id]}</div><div class="get">${word(P.get)}</div>${meter}<div class="but">${word(P.but)}</div><span class="i" data-i="${i}">i</span><div class="bk">${P.line}</div></button>`; });
    h += `</div><button class="fit" id="tc-fit" disabled>FIT IT</button></div>`;
    e.innerHTML = h; e.classList.add('show'); sfx('found'); G0.opts.forEach((o, i) => setTimeout(() => sfx('card', i), 220 + i * 160));
    e.querySelectorAll('.card').forEach(c => { const i = +c.dataset.i; c.addEventListener('pointerdown', ev => { ev.stopPropagation(); ev.preventDefault(); const S2 = L.S; if (!S2.hold || S2.hold.phase !== 'choose') return;
      if (ev.target.closest('.i') && S2.hold.hi === i) { c.classList.toggle('flip'); sfx('flip'); return; }
      const now = performance.now(); if (lastTap.i === i && now - lastTap.t < 420 && !c.classList.contains('flip')) S2.hold.pending = i; else { if (S2.hold.hi !== i) e.querySelectorAll('.card.flip').forEach(x => x.classList.remove('flip')); S2.hold.hi = i; sfx('sel'); } lastTap = { i, t: now }; }); });
    el('tc-fit').addEventListener('pointerdown', ev => { ev.stopPropagation(); ev.preventDefault(); const S2 = L.S; if (S2.hold && S2.hold.phase === 'choose' && S2.hold.hi >= 0) { S2.hold.pending = S2.hold.hi; sfx('choose'); } });
  }
  if (!want && uiShown) { uiShown = false; e.classList.remove('show'); e.innerHTML = ''; }
  dim.style.opacity = '0'; { const f = uiShown ? 'brightness(.32)' : ''; for (const id of ['tc-ub', 'rt-bar', 'tc-hud', 'tc-mute']) { const x = el(id); if (x && x.style.filter !== f) x.style.filter = f; } }
  if (uiShown && H) {
    e.querySelectorAll('.card').forEach((c, i) => c.classList.toggle('sel', i === H.hi));
    const cs = e.querySelector('.cards'); if (cs) cs.classList.toggle('has', H.hi >= 0);
    const fb = el('tc-fit'); if (fb) fb.disabled = H.hi < 0;
  }
}
/* the turntable rects for the view (CSS px, top-left origin), with the selected flag; empty unless the pop-up is up */
export function cardRects() {
  if (!uiShown) return [];
  const H = L.S.hold, out = [];
  document.querySelectorAll('#tc-choice .card').forEach((c, i) => { const tt = c.querySelector('.tt'); if (!tt || c.classList.contains('flip')) return; const r = tt.getBoundingClientRect(), cr = c.getBoundingClientRect(); const op = +getComputedStyle(c).opacity; out.push({ id: tt.dataset.id, x: r.left, y: r.top, w: r.width, h: r.height, card: { x: cr.left + 2, y: cr.top + 2, w: cr.width - 4, h: cr.height - 4 }, sel: H && H.hi === i, dim: H && H.hi >= 0 && H.hi !== i, op }); });
  return out;
}

/* camp finale (no cover closing): roll onto the pad and stop, a tally of everything on board from the bottom up, the count rolls against
   the target, the bar fills to the coupon, the padlock bursts and the coupon flips (timeline from the view's finale clock e) */
let rvState = '';
const FIN = { e: -1, t0: 1.5, t1: 3 };
export function revealFrame(e, VW, VH, sfx, T0, step, n) {
  FIN.e = e; FIN.t0 = T0; FIN.t1 = T0 + step * n + 0.35;
  const s = L.S, rv = el('tc-rv'), fc = el('tc-fc'), CF = L.CONFIG;
  if (s.done && RT.mode === 'end') { rv.classList.remove('show'); fc.style.display = 'none'; if (s.done === 'win') { el('tc-lock').classList.remove('almost', 'open'); el('tc-lock').innerHTML = LOCK(true); } return; }
  if (!s.done || e < 0) { if (rvState) { rvState = ''; rv.classList.remove('show'); fc.style.display = 'none'; fc.className = 'rt'; el('tc-lock').classList.remove('open'); el('tc-lock').innerHTML = LOCK(false); } return; }
  const T = CF.target, win = s.done === 'win', tEnd = T0 + step * n + 0.35;
  if (!rvState && e >= T0 - 0.3) { rvState = 'tally'; rv.classList.add('show'); el('tc-rvl').textContent = 'YOU MADE CAMP WITH'; el('tc-rvn').innerHTML = `0<small> / ${T}</small>`; el('tc-rvs').textContent = ''; }
  if (rvState === 'tally') { const k = Math.max(0, Math.min(1, (e - T0) / Math.max(0.2, tEnd - T0))), v = Math.round(s.total * k), n0 = el('tc-rvn'); if (n0.dataset.n !== String(v)) { n0.dataset.n = v; n0.innerHTML = `${v}<small> / ${T}</small>`; n0.classList.toggle('hit', v >= T); } }
  if (e >= tEnd && rvState === 'tally') {
    rvState = 'done'; el('tc-rvn').innerHTML = `${s.total}<small> / ${T}</small>`;
    if (win) {
      el('tc-rvs').textContent = '★'.repeat(s.stars) + '☆'.repeat(3 - s.stars);
      const lock = el('tc-lock'); lock.innerHTML = LOCK(true); lock.classList.remove('almost'); lock.classList.add('open'); sfx('unlock');
      const r = lock.getBoundingClientRect(); fc.style.display = 'block'; fc.style.transition = 'none'; fc.style.transform = `translate(${r.left + r.width / 2}px,${r.top + r.height / 2}px) scale(.2)`;
      requestAnimationFrame(() => requestAnimationFrame(() => { fc.style.transition = 'transform .65s cubic-bezier(.2,.9,.3,1.15)'; fc.style.transform = `translate(${VW / 2}px,${VH * 0.8}px) scale(1)`; }));
      setTimeout(() => fc.classList.add('flip'), 700);
    } else { el('tc-rvs').innerHTML = `SO CLOSE: ${s.total} / ${T}`; sfx('lost', 2); }
  }
}

function buildCards() {
  const s = L.S, c = s.sel.map(id => id ? `<div class="bc"><div class="nm">${SHORT[id]}</div><a href="${L.PROD[id].url}" target="_blank" rel="noopener" data-p="${id}">VIEW</a></div>` : '').join('');
  return c ? `<div class="tc-build"><div class="hd">YOUR BUILD</div><div class="row">${c}</div></div>` : '';
}
const SHOP_URL = 'https://realtruck.com.au/?utm_source=game&utm_medium=social&utm_campaign=black_friday';
const shopUrl = () => SHOP_URL;
const picks = () => { const q = L.S.sel || []; return { product_1: q[0] || '', product_2: q[1] || '', product_3: q[2] || '' }; };
export function sheetHtml(st) {
  document.body.classList.add('tc-sheet');
  const s = L.S, CF = L.CONFIG, T = CF.target, build = '', M = CF.barMax, p = v => (100 * Math.max(0, Math.min(v, M)) / M).toFixed(1) + '%';
  if (st.done === 'win') {
    return `<div class="logo">REALTRUCK LOGO</div><div class="stamp">You made camp with ${s.total}</div><div class="stars">${'<b>★</b>'.repeat(s.stars)}${'★'.repeat(3 - s.stars)}</div>
      <div class="coupon"><div class="k">Black Friday code unlocked</div><div class="code" id="rt-code">${CF.code}</div><div class="f">Sample: the code, offer and terms come from RealTruck</div></div>
      <button class="rt-btn p" id="rt-copy">Copy code</button>${build}<a class="rt-btn s" id="tc-shop" href="${shopUrl()}" target="_blank" rel="noopener" style="box-sizing:border-box;text-decoration:none;display:block;text-align:center">Shop Black Friday</a><button class="rt-btn l" id="rt-again">Play again</button>`;
  }
  const pct = Math.min(99, Math.round(100 * s.total / T));
  return `<div class="logo">REALTRUCK LOGO</div><div class="stamp" style="color:#fff">So close: ${s.total} / ${T}</div>
    <div class="res">${pct}% unlocked${st.failAt === 'dark' ? ' · the sun set before camp' : ''}</div>
    <div class="tc-mb"><i style="width:${p(s.banked)};background:${Y}"></i><i style="left:${p(s.banked)};width:${p(s.onN)};background:#9c8a4a"></i><span class="t" style="left:${p(T)}"></span></div>
    <div class="coupon locked"><div class="k">Black Friday code</div><div class="code">${maskCode()}</div><div class="f">${T - s.total} more gear unlocks it</div></div>
    ${st.canRetry ? `<button class="rt-btn p" id="rt-retry">Try again from ${st.cpName}</button>` : ''}<button class="rt-btn ${st.canRetry ? 's' : 'p'}" id="rt-again">Play again from the start</button><a class="rt-btn l" id="tc-shop" href="${shopUrl()}" target="_blank" rel="noopener">Shop Black Friday</a>`;
}
export const startHtml = () => `<div class="tc-st"><div class="tc-logo-slot" style="height:0"></div><div class="h">Unlock your Black Friday code</div><div class="cp">${LOCK(false)}<span class="c">${maskCode()}</span></div><div class="s">Make camp before sunset to unlock it</div><div class="go" id="tc-go">Drag to start</div></div>`;
