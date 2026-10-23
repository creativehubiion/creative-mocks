"""
Build an "Away from the game video" mock: a publisher's article on a laptop, with the brand's spot playing as the pre-roll in the
site's own in-article video player (the slot where video is really served programmatically, e.g. Future plc's JW Player
"Latest Videos" carousel → Google Ad Manager pre-roll). Copies afg-video/_template/ like every other format (CLAUDE.md §8d).

  python tools/new-afg-video-mock.py --brand "Black Bear" --headline "Wife and Dog." \
      --url https://www.whattowatch.com/movies --ad "D:/DOWNLOADS/teaser.mp4" --suffix 32eq [--device mobile|both]

  --device desktop (default): the site's desktop layout on our MacBook  -> afg-video/<slug>-<sfx>/
  --device mobile: the site's mobile layout (iPhone, 390 wide) on our phone, Safari bar at the bottom; on a real phone the link
                   opens the site full screen (shared/mobile.js)        -> afg-video-mobile/<slug>-<sfx>/
  --device both: the two of them, as ONE mock: the MacBook page sends phones to the mobile version (give --suffix so they pair).

What it does:
  1. Opens --url in headless Chrome at 1440×900 (a 13" MacBook's screen) with ad and consent hosts blocked. If the page has no
     video player (a listing page such as /movies), it follows the page's own article links until one has a player.
  2. Removes every other ad slot (Ad Manager / Prebid containers, "Advertisement" labels, empty ad widgets), so the page looks
     like the brand's placement only, and paints the player's own poster into it.
  3. Saves a 2x snapshot from the top of the page to below the player (assets/site.webp) and the player's box on it.
  4. Transcodes the spot (1280 wide, CRF 21, like every spot here) to assets/ad.mp4 and fills the page copy.
Folder: afg-video/<slug>-<suffix>/ (reuse a brand's suffix so it sits with its other formats). Needs: pip install playwright (uses
the installed Chrome, no browser download). Preview with tools/rangeserver.py; ship on the user's word.
"""
import argparse, io, json, os, re, secrets, shutil, string, subprocess, sys, tempfile
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEVICES = {   # the screen in CSS px, and where the mock goes
    'desktop': dict(w=1440, h=900, folder='afg-video', ctx={}),
    'mobile':  dict(w=390, h=844, folder='afg-video-mobile', ctx=dict(is_mobile=True, has_touch=True, user_agent=
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1')),
}
BLOCK = ('doubleclick.net', 'googlesyndication', 'googletagservices', 'amazon-adsystem', 'privacy-mgmt.com', 'consensu.org',
         'cookielaw.org', 'onetrust', 'didomi', 'quantcast', 'pbxai', 'p-n.io', 'doubleverify', 'id5-sync', 'crwdcntrl',
         'brandmetrics', 'scorecardresearch', 'ml314', 'cpx.to', 'nodals', 'mrf.io', 'dotmetrics', 'webcontentassessor',
         'privacymanager', 'euid.eu', 'adnxs', 'rubiconproject', 'pubmatic', 'criteo', 'taboola', 'outbrain', 'teads', 'seedtag',
         'imasdk.googleapis.com', 'adsafeprotected', 'moatads', 'permutive', 'confiant')
PLAYERS = '.jwplayer, video-js, .video-js, .vjs-tech, [class*="player" i] video, video'
HIDE_CSS = '''
[id^="google_ads"], [id^="div-gpt-ad"], [id^="gpt-"], .bordeaux-slot, .dfp-leaderboard-container, .ad-unit, ins.adsbygoogle,
[data-ad-slot], [data-google-query-id], [id*="taboola" i], [class*="taboola" i], .OUTBRAIN, [class*="outbrain" i],
[class*="advert" i]:not(body):not(html), [id*="advert" i], [class*="ad-slot" i], [class*="adslot" i], [class*="ad-container" i],
.widget-empty, [class*="sticky-ad" i], [class*="anchored" i], [id*="anchored" i] { display:none !important }
'''

def rd(p): return io.open(p, encoding='utf-8').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
def html(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def js(s): return s.replace('\\', '\\\\').replace("'", "\\'")
def sub(s, a, b):
    if a not in s: sys.exit(f'template changed, cannot find: {a!r}')
    return s.replace(a, b)

def transcode(src, dst):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', "scale='min(1280,iw)':-2", '-c:v', 'libx264', '-preset', 'slow',
                    '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '96k', dst], check=True)
    # a spot that is already web-ready (H.264, at most 1280 wide) and smaller than our encode is kept as it is, only remuxed
    probe = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,width',
                            '-of', 'csv=p=0', src], capture_output=True, text=True).stdout.strip().split(',')
    if len(probe) == 2 and probe[0] == 'h264' and int(probe[1]) <= 1280 and os.path.getsize(src) < os.path.getsize(dst):
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-c', 'copy', '-movflags', '+faststart', dst], check=True)
        print('  spot kept as delivered (already web-ready and smaller than a re-encode)')

FIND_PLAYER = '''sel => {
  const ok = [...document.querySelectorAll(sel)].map(e => e.closest('.jwplayer, video-js, .video-js') || e)
    .filter(e => { const r = e.getBoundingClientRect(); return r.width >= 300 && r.height >= 160; });
  if (!ok.length) return null;
  const e = ok[0], r = e.getBoundingClientRect();
  return { box: [Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.width), Math.round(r.height)], jw: e.classList.contains('jwplayer') };
}'''

def snapshot(url, out_png, player_sel, dev):
    W, H = dev['w'], dev['h']
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(channel='chrome', headless=True)
        pg = b.new_page(viewport={'width': W, 'height': H}, device_scale_factor=2, locale='en-GB', **dev['ctx'])
        pg.route('**/*', lambda r: r.abort() if any(h in r.request.url for h in BLOCK) else r.continue_())
        def load(u):
            pg.goto(u, wait_until='domcontentloaded', timeout=60000); pg.wait_for_timeout(4000)
            pg.add_style_tag(content=HIDE_CSS)
            for y in range(0, 4000, 700): pg.mouse.wheel(0, 700); pg.wait_for_timeout(350)   # wake lazy players and images
            pg.wait_for_timeout(1500)
            return pg.evaluate(FIND_PLAYER, player_sel)
        found, used = load(url), url
        if not found:   # a listing page: try its articles
            host = urlparse(url).netloc
            links = pg.evaluate('''host => [...new Set([...document.querySelectorAll('main a[href], article a[href], a[href]')]
              .map(a => a.href.split('#')[0]).filter(h => { try { const u = new URL(h); return u.host === host && u.pathname.split('/').filter(Boolean).length >= 2 &&
              /[a-z0-9]+-[a-z0-9]+-[a-z0-9]+-[a-z0-9]+/.test(u.pathname) } catch (e) { return false } }))].slice(0, 10)''', host)
            for u in links:
                print('  no player there, trying', u)
                found = load(u)
                if found: used = u; break
        if not found: sys.exit('no video player found on the page or its first articles (pass an article URL, or --player-selector)')
        # labels left behind by removed slots, and the player's own poster (the player stays in setup with its ad calls blocked)
        pg.evaluate('''() => { for (const e of document.querySelectorAll('body *')) { const t = (e.childElementCount ? '' : e.textContent || '').trim();
            if (/^advertisement$/i.test(t)) e.style.setProperty('display', 'none', 'important'); } }''')
        pg.evaluate('''([sel]) => {
          const e = [...document.querySelectorAll(sel)].map(e => e.closest('.jwplayer, video-js, .video-js') || e)
            .find(e => { const r = e.getBoundingClientRect(); return r.width >= 300 && r.height >= 160; });
          let img = '', title = '';
          try { const it = jwplayer(e.id).getPlaylist()[0]; img = it.image; title = it.title || ''; } catch (x) {}
          if (!img) { const v = e.querySelector('video') || (e.tagName === 'VIDEO' ? e : null); img = v && v.poster || ''; }
          if (!img) return;
          const o = document.createElement('div');
          o.style.cssText = 'position:absolute;inset:0;z-index:99;background:#000 center/cover no-repeat url("' + img + '")';
          o.innerHTML = '<div style="position:absolute;left:0;right:0;top:0;padding:14px 16px 28px;background:linear-gradient(rgba(0,0,0,.6),rgba(0,0,0,0));color:#fff;font:600 17px/1.25 Arial,sans-serif">' +
            title.replace(/[<&]/g, '') + '</div><svg viewBox="0 0 80 80" style="position:absolute;left:50%;top:50%;width:64px;height:64px;transform:translate(-50%,-50%);filter:drop-shadow(0 1px 4px rgba(0,0,0,.5))"><path d="M30 22v36l29-18z" fill="#fff"/></svg>';
          if (getComputedStyle(e).position === 'static') e.style.position = 'relative';
          e.appendChild(o);
        }''', [player_sel])
        # a header the site pins to the top while scrolling (fixed/sticky, full width): keep its scrolled look as assets/head.png
        pin = pg.evaluate('''W => { const e = [...document.querySelectorAll('body *')].find(e => { const s = getComputedStyle(e), r = e.getBoundingClientRect();
            return (s.position === 'fixed' || s.position === 'sticky') && Math.abs(r.top) < 2 && r.width >= W * .8 && r.height >= 30 && r.height <= 160; });
          if (e) e.setAttribute('data-iion-pin', '');
          return e ? Math.round(e.getBoundingClientRect().height) : 0; }''', W)
        pin_at = 0
        if pin:
            pg.screenshot(path=out_png.replace('site.png', 'head.png'), clip={'x': 0, 'y': 0, 'width': W, 'height': pin})
            # from which scroll does the site show it? 0 = a header pinned from the top; more = a bar that slides in once the real
            # header has scrolled away (TechRadar desktop's "Become a TechRadar Insider"): the mock shows it only from there
            pin_at = pg.evaluate('''async () => { const e = document.querySelector('[data-iion-pin]'); if (!e) return 0;
              const on = () => { const s = getComputedStyle(e), r = e.getBoundingClientRect();
                return s.display !== 'none' && s.visibility !== 'hidden' && +s.opacity > .5 && Math.abs(r.top) < 4 && r.bottom > r.height * .8; };
              for (let y = 0; y < document.documentElement.scrollHeight; y += 20) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 80)); if (on()) return y; }
              return 0; }''')
            print(f'  pinned header: {pin}px, shown from {pin_at}px of scroll')
        pg.mouse.wheel(0, -100000); pg.wait_for_timeout(2500)
        found = pg.evaluate(FIND_PLAYER, player_sel)   # again: removing the ads moved it
        page_h = pg.evaluate('document.documentElement.scrollHeight')
        x, y, w, h = found['box']
        crop = min(page_h, y + h + H)
        pg.screenshot(path=out_png, full_page=True, clip={'x': 0, 'y': 0, 'width': W, 'height': crop})
        b.close()
        return used, found['box'], crop, pin, pin_at

def main():
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument('--brand', required=True); a.add_argument('--headline', default='')
    a.add_argument('--url', required=True, help='the publisher page (an article with a video player, or a section page)')
    a.add_argument('--ad', required=True, help='the brand spot (any size; shown full frame with black bars in the 16:9 player)')
    a.add_argument('--slug'); a.add_argument('--suffix'); a.add_argument('--force', action='store_true')
    a.add_argument('--player-selector', default=PLAYERS, help='CSS selector for the site\'s video player (default covers JW Player, video.js, <video>)')
    a.add_argument('--device', choices=['desktop', 'mobile', 'both'], default='desktop')
    o = a.parse_args()
    for d in (['desktop', 'mobile'] if o.device == 'both' else [o.device]): build(o, d)
    link_devices(o)

def link_devices(o):
    # one mock, two devices: the MacBook page sends phones to the mobile web version when that exists
    slug = o.slug or re.sub(r'[^a-z0-9]+', '-', o.brand.lower()).strip('-'); name = f'{slug}-{o.suffix}' if o.suffix else None
    if not name: return
    lap, mob = os.path.join(ROOT, 'afg-video', name, 'index.html'), os.path.join(ROOT, 'afg-video-mobile', name, 'index.html')
    if os.path.exists(lap) and os.path.exists(mob):
        s = re.sub(r'<meta name="iion-mobile" content="[^"]*">', f'<meta name="iion-mobile" content="../../afg-video-mobile/{name}/">', rd(lap))
        wr(lap, s); print(f'linked afg-video/{name}/ -> phones get afg-video-mobile/{name}/')

def build(o, device):
    dev = DEVICES[device]; W = dev['w']; fold = dev['folder']

    slug = o.slug or re.sub(r'[^a-z0-9]+', '-', o.brand.lower()).strip('-')
    sfx = o.suffix or ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(4))
    name = f'{slug}-{sfx}'; dst = os.path.join(ROOT, fold, name)
    if os.path.exists(dst):
        if not o.force: sys.exit(f'{fold}/{name} exists (use --force)')
        shutil.rmtree(dst)
    shutil.copytree(os.path.join(ROOT, fold, '_template'), dst)

    tmp = os.path.join(tempfile.mkdtemp(), 'site.png')
    print(f'snapshot ({device})', o.url)
    used, box, crop, pin, pin_at = snapshot(o.url, tmp, o.player_selector, dev)
    from PIL import Image
    im = Image.open(tmp).convert('RGB'); im.save(os.path.join(dst, 'assets', 'site.webp'), 'WEBP', quality=80, method=6)
    top = '#%02x%02x%02x' % im.getpixel((im.width // 2, 2))   # the page's colour under the phone's status bar
    head = os.path.join(dst, 'assets', 'head.webp')
    if pin: Image.open(tmp.replace('site.png', 'head.png')).convert('RGB').save(head, 'WEBP', quality=85, method=6)
    elif os.path.exists(head): os.remove(head)
    print(f'  page {used}\n  player {box} on a {W}x{crop} snapshot')
    transcode(o.ad, os.path.join(dst, 'assets', 'ad.mp4'))

    m = os.path.join(dst, 'mock.html'); s = rd(m)
    s, n = re.subn(r"const SITE = \{.*?\};", f"const SITE = {{ pin: {pin}, pinAt: {pin_at}, img: 'assets/site.webp', w: {W}, h: {crop}, player: {json.dumps(box)}, top: '{top}', url: '{js(used)}' }};", s)
    if n != 1: sys.exit('mock template changed: SITE line not found')
    wr(m, sub(s, '<title>Brand · ', f'<title>{html(o.brand)} · '))
    p = os.path.join(dst, 'index.html'); s = rd(p)
    s = sub(s, '<title>iion · Brand ', f'<title>iion · {html(o.brand)} ')
    s = sub(s, '· Brand</div>', f'· {html(o.brand)}</div>')   # (the mobile page's eyebrow says ", mobile": the bot skips it)
    s = sub(s, '<h1>Headline.</h1>', f'<h1>{html(o.headline or o.brand)}</h1>')
    host = urlparse(used).netloc.replace('www.', '')
    s = sub(s, '<p>One line about the mock (not shown on the page).</p>', f'<p>The {html(o.brand)} spot as the pre-roll in the video player of an article on {html(host)}{" (mobile web)" if device == "mobile" else ""}.</p>')
    r, g, bl = (int(top[i:i + 2], 16) for i in (1, 3, 5))
    if device == 'mobile' and (0.299 * r + 0.587 * g + 0.114 * bl) > 150:   # light page top: dark status bar text
        s = sub(s, '<div class="statusbar">', '<div class="statusbar dark">')
    wr(p, s)
    print(f'built {fold}/{name}/\n  local: http://127.0.0.1:8767/{fold}/{name}/\n  live after push: https://creativehubiion.github.io/creative-mocks/{fold}/{name}/')

if __name__ == '__main__':
    main()
