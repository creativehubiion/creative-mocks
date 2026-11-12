/* In-game and Roblox ad scenes: a game screenshot (or gameplay video) with the brand's creative on its billboards.
   mock.html sets window.SCENE (from tools/ingame-library/scenes.json, written by tools/new-ingame-mock.py) and
   window.CREATIVE = { src, type: 'image' | 'video' }, then loads this file.
   Layers: background (image or video) > the creative on each billboard (letterboxed on black, warped onto the four corners
   with an exact perspective transform) > masks (things standing in front of the billboard, redrawn from the background)
   > overlay (Roblox's Ad icon, mute and expand buttons). The scene keeps its own units (image pixels or the SVG viewBox)
   and is scaled to fit the window: cover when the window is nearly the same shape, otherwise contain on black.
   window.DEMO = { setSound } so the page's sound button works for a video creative. */
(function () {
  const S = window.SCENE, C = window.CREATIVE, Q = new URLSearchParams(location.search);
  const bust = u => { const v = Q.get('v'); return v ? u + (u.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(v) : u; };
  const stage = document.getElementById('stage');
  if (Q.has('round')) document.documentElement.classList.add('round', innerWidth > innerHeight ? 'land' : 'port');
  const scene = document.createElement('div'); scene.className = 'scene';
  scene.style.width = S.w + 'px'; scene.style.height = S.h + 'px';
  stage.appendChild(scene);

  // background
  let bgVideo = null;
  if (S.bgVideo) {
    bgVideo = media('video', bust(S.bgVideo)); bgVideo.poster = bust(S.bg); bgVideo.className = 'bg';
    scene.appendChild(bgVideo);
  } else {
    const img = new Image(); img.src = bust(S.bg); img.className = 'bg'; img.alt = ''; scene.appendChild(img);
  }

  // the creative on every billboard
  const creatives = [];
  S.quads.forEach((q, i) => {
    const [tl, tr, br, bl] = q, d = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
    const bw = (d(tl, tr) + d(bl, br)) / 2, bh = (d(tl, bl) + d(tr, br)) / 2;
    const slot = document.createElement('div'); slot.className = 'slot';
    slot.style.width = bw + 'px'; slot.style.height = bh + 'px';
    if (S.radius && S.radius[i]) slot.style.borderRadius = S.radius[i] + 'px';
    slot.style.transform = matrix3d([[0, 0], [bw, 0], [bw, bh], [0, bh]], [tl, tr, br, bl]);
    const el = C.type === 'video' ? media('video', bust(C.src)) : Object.assign(new Image(), { src: bust(C.src), alt: '' });
    slot.appendChild(el); scene.appendChild(slot); creatives.push(el);
  });

  // masks: the background again, clipped to what stands in front of the billboard
  if (S.masks && S.masks.length && !S.bgVideo) {
    const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', `0 0 ${S.w} ${S.h}`); svg.setAttribute('class', 'mask');
    svg.innerHTML = `<defs><clipPath id="m">${S.masks.map(p => `<path d="${p}"/>`).join('')}</clipPath></defs>` +
      `<image href="${bust(S.bg)}" x="0" y="0" width="${S.w}" height="${S.h}" preserveAspectRatio="none" clip-path="url(#m)"/>`;
    scene.appendChild(svg);
  }

  // overlay: Roblox UI drawn over the ad
  if (S.overlay) { const o = new Image(); o.src = bust(S.overlay); o.className = 'overlay'; o.alt = ''; scene.appendChild(o); }

  // fit the scene to the window
  function fit() {
    const W = stage.clientWidth, H = stage.clientHeight, sa = S.w / S.h, wa = W / H;
    const near = Math.abs(Math.log(wa / sa)) < 0.09 && !Q.has('contain');
    const k = near ? Math.max(W / S.w, H / S.h) : Math.min(W / S.w, H / S.h);
    scene.style.transform = `translate(${(W - S.w * k) / 2}px, ${(H - S.h * k) / 2}px) scale(${k})`;
  }
  addEventListener('resize', fit); new ResizeObserver(fit).observe(stage); fit();

  /* gameplay video + video ad: one clock. The gameplay is the master; the ad (cut to the gameplay's loop by the generator)
     starts with it and both go back to the start together, so the game never jumps back while the ad plays on.
     An ad shorter than the loop repeats inside it, as a real billboard would. */
  const vids = creatives.filter(el => el.tagName === 'VIDEO');
  if (bgVideo && vids.length) {
    bgVideo.loop = false;
    vids.forEach(v => { v.loop = false; v.addEventListener('loadedmetadata', () => { if (bgVideo.duration && v.duration < bgVideo.duration - .25) v.loop = true; }); });
    const all = [bgVideo, ...vids];
    const restart = () => all.forEach(v => { v.currentTime = 0; v.play().catch(() => {}); });
    bgVideo.addEventListener('ended', restart);
    let ready = 0;   // start both on the same frame once each can play
    all.forEach(v => { v.pause(); v.addEventListener('canplay', () => { if (++ready === all.length) restart(); }, { once: true }); });
  }

  function media(tag, src) {
    const v = document.createElement(tag);
    v.muted = true; v.defaultMuted = true; v.setAttribute('muted', ''); v.playsInline = true; v.setAttribute('playsinline', '');
    v.autoplay = true; v.loop = true; v.preload = 'auto'; v.src = src;
    v.play && v.play().catch(() => {});
    return v;
  }

  /* exact perspective: the 3x3 homography taking the slot's rectangle to the billboard's corners, as a CSS matrix3d */
  function matrix3d(src, dst) {
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    const h = solve(A, b); // h0..h7, h8 = 1
    const H = [h[0], h[3], 0, h[6], h[1], h[4], 0, h[7], 0, 0, 1, 0, h[2], h[5], 0, 1];
    return `matrix3d(${H.map(n => +n.toFixed(10)).join(',')})`;
  }
  function solve(A, b) {
    const n = b.length, M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((r, i) => r[n] / r[i]);
  }

  // sound for a video creative (the page's button); a tap on the unit unlocks it too
  function setSound(on) { creatives.forEach(el => { if (el.tagName === 'VIDEO') { el.muted = !on; if (on) el.play().catch(() => {}); } }); }
  const hasSound = C.type === 'video';
  document.addEventListener('pointerdown', () => { if (hasSound) { setSound(true); try { parent.postMessage({ iionSound: true }, '*'); } catch (e) {} } }, { once: true });
  window.DEMO = { start() {}, slotMs: 0, setAuto() {}, setSound };
})();
