"""
Build a brand's video and display mocks (CTV video ad, rewarded video, rewarded video + end card, rewarded video + playable end card,
display interstitial) and,
when there is more than one, the one-link showcase page. Everything is copied from the templates, so the pages match every other mock:

  ctv/_template-video/   rewarded/_template/   rewarded-endcard/_template/   rewarded-playable/_template/
  display-interstitial/_template/   showcase/_template/

Example (the VOXI set):
  python tools/new-video-mocks.py --brand VOXI --headline "Unlimited social media." \
      --ctv-ad "D:/DOWNLOADS/voxi-tv.mp4" --ctv-headline "The fun never ends." \
      --rewarded-ad "D:/DOWNLOADS/voxi-mobile.mp4" --rewarded-preroll asphalt-legends \
      --endcard "D:/DOWNLOADS/voxi-banner.jpg" --endcard-preroll geometry-dash --click-url https://www.voxi.co.uk/

  Only the formats you give inputs for are built:  --ctv-ad -> CTV,  --rewarded-ad -> rewarded,
  --endcard -> rewarded + end card (its ad is --endcard-ad, or --rewarded-ad if not given),
  --rp-ad + --rp-playable -> rewarded video + playable end card (portrait: the video is centre-cropped to 9:16 if it isn't vertical;
  the playable folder is copied in as the end card: a mock folder's files without its index.html page, or a build whose index.html
  is the unit; pre-roll --rp-preroll from tools/video-library/preroll-portrait/: subway-surfer (default; trimmed to the run, 3.5 s, before its Dutch continue screen) or we-are-warriors (Italian on screen)),
  --display -> display interstitial (the static 2:3 image, 640x960, in the playable's phone; a tap opens --click-url).
  Pre-rolls: the clips in tools/video-library/preroll/ (dragon-city, asphalt-legends, geometry-dash, jurassic-world, rummikub).

Folders: <format>/<slug>-<suffix>/ (random 4-char suffix unless --suffix), showcase/<slug>-<suffix>/ for 2+ formats.
Then preview with tools/rangeserver.py and ship when the user says so (CLAUDE.md §8, §8d).
"""
import argparse, io, os, re, secrets, shutil, string, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LIB = os.path.join(ROOT, 'tools', 'video-library')
FORMATS = {  # key: (template folder, format folder, label in the showcase tab, icon, #hash)
    'ctv':      ('ctv/_template-video',         'ctv',              'CTV',                       'tv',      'ctv'),
    'rewarded': ('rewarded/_template',          'rewarded',         'Rewarded video',            'land',    'rewarded'),
    'endcard':  ('rewarded-endcard/_template',  'rewarded-endcard', 'Rewarded video + end card', 'landEnd', 'endcard'),
    'rp':       ('rewarded-playable/_template',  'rewarded-playable', 'Rewarded video + playable end card', 'phonePlay', 'rewarded-playable'),
    'display':  ('display-interstitial/_template', 'display-interstitial', 'Display interstitial', 'phoneImg', 'display'),
}
SHORT = {'Rewarded video': 'Rewarded', 'Rewarded video + end card': 'Rewarded + end card', 'Display interstitial': 'Display',
         'Rewarded video + playable end card': 'Rewarded + playable'}   # labels in the phone tab bar

def rd(p): return io.open(p, encoding='utf-8').read()
def wr(p, s): io.open(p, 'w', encoding='utf-8', newline='\n').write(s)
def sub(s, a, b):
    if a not in s: sys.exit(f'template changed, cannot find: {a!r}')
    return s.replace(a, b)
def js(s): return s.replace('\\', '\\\\').replace("'", "\\'")
def html(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def transcode(src, dst):
    # same settings as every spot in this repo (CLAUDE.md §6): 1280 wide, H.264 CRF 21, faststart, AAC 96k
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', "scale='min(1280,iw)':-2", '-c:v', 'libx264', '-preset', 'slow',
                    '-crf', '21', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '96k', dst], check=True)

def duration(p):
    out = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p], capture_output=True, text=True)
    try: return round(float(out.stdout.strip()))
    except ValueError: return None

def page(dst, brand, headline, desc):
    p = os.path.join(dst, 'index.html'); s = rd(p)
    s = re.sub(r'<title>iion · Brand ', f'<title>iion · {html(brand)} ', s)
    s = sub(s, '· Brand</div>', f'· {html(brand)}</div>')
    s = sub(s, '<h1>Headline.</h1>', f'<h1>{html(headline)}</h1>')
    s = sub(s, '<p>One line about the mock (not shown on the page).</p>', f'<p>{html(desc)}</p>')
    wr(p, s)
    m = os.path.join(dst, 'mock.html'); t = rd(m)
    wr(m, sub(t, '<title>Brand · ', f'<title>{html(brand)} · '))

def vertical(src, dst):
    # the brand video at 9:16: a landscape spot is centre-cropped (no vertical cut exists yet), height at most 1280, CLAUDE.md §6 settings
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', src], capture_output=True, text=True)
    w, h = (int(x) for x in out.stdout.strip().split(',')[:2])
    vf = "crop='min(iw,ih*9/16)':'min(ih,iw*16/9)',scale=-2:'min(1280,ih)'"
    if w / h > 9 / 16 + .01: print(f'note: {os.path.basename(src)} is {w}x{h}; centre-cropped to 9:16')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-vf', vf, '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p',
                    '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '96k', dst], check=True)

def endcard(src, dst):
    # the playable, as served: a mock folder (mock.html + files; its index.html is the review page, left out) or a build (index.html is the unit)
    if os.path.exists(dst): shutil.rmtree(dst)
    unit = 'mock.html' if os.path.exists(os.path.join(src, 'mock.html')) else 'index.html'
    if not os.path.exists(os.path.join(src, unit)): sys.exit(f'no mock.html or index.html in {src}')
    skip = {'index.html', 'SOURCES.md', '.DS_Store'} if unit == 'mock.html' else {'SOURCES.md', '.DS_Store'}
    shutil.copytree(src, dst, ignore=lambda d, names: [n for n in names if n in skip and d == src or n == '.DS_Store'])
    if unit == 'index.html': os.replace(os.path.join(dst, 'index.html'), os.path.join(dst, 'mock.html'))

def interstitial(src, dst):
    # the static image as WebP at its own pixel size, at most 640 wide (the 2:3 unit is 320x480 at 2x); CLAUDE.md §8e
    from PIL import Image
    im = Image.open(src); im = im.convert('RGBA' if 'A' in im.getbands() else 'RGB')
    if im.width > 640: im = im.resize((640, round(im.height * 640 / im.width)), Image.LANCZOS)
    if abs(im.width / im.height - 2 / 3) > .01: print(f'note: {os.path.basename(src)} is {im.width}x{im.height}, not 2:3; it is shown whole on black')
    im.save(dst, 'WEBP', quality=88, method=6, alpha_quality=95)
    return im.size

def preroll(dst, name, mock):
    src = os.path.join(LIB, 'preroll', name + '.mp4')
    if not os.path.exists(src): sys.exit(f'no pre-roll "{name}" in {os.path.dirname(src)}')
    shutil.copy(src, os.path.join(dst, 'assets', 'game-preroll.mp4'))
    s = rd(mock)
    wr(mock, re.sub(r'// the game the viewer was playing \([^)]*\)', f'// the game the viewer was playing ({name}, tools/video-library)', s))

def main():
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument('--brand', required=True, help='brand name as shown in the header, e.g. VOXI')
    a.add_argument('--slug', help='folder name (default: the brand, lower-case, dashes)')
    a.add_argument('--suffix', help='4-char URL suffix (default: random); reuse one to add formats to an existing set')
    a.add_argument('--headline', default='', help='header title for every format (each can override)')
    a.add_argument('--ctv-ad'); a.add_argument('--ctv-headline')
    a.add_argument('--rewarded-ad'); a.add_argument('--rewarded-headline'); a.add_argument('--rewarded-preroll', default='asphalt-legends')
    a.add_argument('--endcard', help='end card image (jpg/png)'); a.add_argument('--endcard-ad'); a.add_argument('--endcard-headline')
    a.add_argument('--endcard-preroll', default='geometry-dash')
    a.add_argument('--rp-ad', help='rewarded + playable end card: the brand video (vertical, or cropped to 9:16)')
    a.add_argument('--rp-playable', help='rewarded + playable end card: the playable folder to show as the end card')
    a.add_argument('--rp-preroll', default='subway-surfer'); a.add_argument('--rp-headline')
    a.add_argument('--display', help='display interstitial image, 2:3 (640x960)'); a.add_argument('--display-headline')
    a.add_argument('--click-url', default='', help='end card / display interstitial tap target')
    a.add_argument('--force', action='store_true', help='overwrite existing folders')
    o = a.parse_args()

    slug = o.slug or re.sub(r'[^a-z0-9]+', '-', o.brand.lower()).strip('-')
    sfx = o.suffix or ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(4))
    name = f'{slug}-{sfx}'
    want = [k for k, on in (('ctv', o.ctv_ad), ('rewarded', o.rewarded_ad), ('endcard', o.endcard), ('rp', o.rp_ad), ('display', o.display)) if on]
    if not want: sys.exit('give at least one of --ctv-ad, --rewarded-ad, --endcard, --rp-ad, --display')
    if 'rp' in want and not o.rp_playable: sys.exit('--rp-ad needs --rp-playable (the playable folder for the end card)')
    if 'endcard' in want and not (o.endcard_ad or o.rewarded_ad): sys.exit('--endcard needs --endcard-ad (or --rewarded-ad)')

    built = []
    for k in want:
        tpl, fmt, label, icon, hid = FORMATS[k]
        dst = os.path.join(ROOT, fmt, name)
        if os.path.exists(dst):
            if not o.force: sys.exit(f'{fmt}/{name} exists (use --force)')
            shutil.rmtree(dst)
        shutil.copytree(os.path.join(ROOT, tpl), dst)
        ad = os.path.join(dst, 'assets', 'ad.mp4')
        if k == 'rp':
            vertical(o.rp_ad, ad); secs = duration(ad)
            src = os.path.join(LIB, 'preroll-portrait', o.rp_preroll + '.mp4')
            if not os.path.exists(src): sys.exit(f'no portrait pre-roll "{o.rp_preroll}" in {os.path.dirname(src)}')
            shutil.copy(src, os.path.join(dst, 'assets', 'game-preroll.mp4'))
            endcard(o.rp_playable, os.path.join(dst, 'endcard'))
            page(dst, o.brand, o.rp_headline or o.headline, f'A portrait rewarded video: the game, the {secs}-second {o.brand} video with the reward countdown, then the {o.brand} playable as the end card.')
        elif k == 'display':
            w, h = interstitial(o.display, os.path.join(dst, 'assets', 'interstitial.webp'))
            mock = os.path.join(dst, 'mock.html'); s = rd(mock)
            if o.click_url: s = re.sub(r"clickUrl: '',\s*//", lambda m: f"clickUrl: '{js(o.click_url)}',  //", s, count=1)
            wr(mock, s)
            page(dst, o.brand, o.display_headline or o.headline, f'A {o.brand} display interstitial: the static {w}x{h} image full screen in the app, a tap opens the site.')
        elif k == 'ctv':
            transcode(o.ctv_ad, ad); secs = duration(ad)
            page(dst, o.brand, o.ctv_headline or o.headline, f'A {secs}-second {o.brand} spot in a CTV ad break, with the countdown to the programme.')
        else:
            transcode(o.rewarded_ad if k == 'rewarded' else (o.endcard_ad or o.rewarded_ad), ad); secs = duration(ad)
            mock = os.path.join(dst, 'mock.html')
            preroll(dst, o.rewarded_preroll if k == 'rewarded' else o.endcard_preroll, mock)
            s = rd(mock)
            if o.click_url: s = re.sub(r"clickUrl: '',\s*//", lambda m: f"clickUrl: '{js(o.click_url)}',  //", s, count=1)
            if k == 'endcard':
                ext = os.path.splitext(o.endcard)[1].lower() or '.jpg'
                os.remove(os.path.join(dst, 'assets', 'endcard.jpg'))
                shutil.copy(o.endcard, os.path.join(dst, 'assets', 'endcard' + ext))
                s = s.replace("endcard: 'assets/endcard.jpg',", f"endcard: 'assets/endcard{ext}',")
            wr(mock, s)
            head = (o.rewarded_headline if k == 'rewarded' else o.endcard_headline) or o.headline
            extra = ', then the end card' if k == 'endcard' else ''
            page(dst, o.brand, head, f'A landscape rewarded video: the game, then the {secs}-second {o.brand} spot with the reward countdown{extra}.')
        built.append((k, fmt, label, icon, hid))
        print(f'built {fmt}/{name}/')

    if len(built) > 1:
        dst = os.path.join(ROOT, 'showcase', name)
        if os.path.exists(dst) and not o.force: sys.exit(f'showcase/{name} exists (use --force)')
        os.makedirs(dst, exist_ok=True)
        s = rd(os.path.join(ROOT, 'showcase', '_template', 'index.html'))
        s = sub(s, "const BRAND = 'Brand';", f"const BRAND = '{js(o.brand)}';")
        s = sub(s, '<title>iion · Brand mocks</title>', f'<title>iion · {html(o.brand)} mocks</title>')
        short = lambda label: f"short: '{SHORT[label]}', " if label in SHORT else ''
        rows = ',\n'.join(f"  {{ label: '{label}', {short(label)}icon: '{icon}', url: '../../{fmt}/{name}/', id: '{hid}' }}" for _, fmt, label, icon, hid in built)
        s, n = re.subn(r'const MOCKS = \[\n.*?\n\];', 'const MOCKS = [\n' + rows + ',\n];', s, flags=re.S)
        if n != 1: sys.exit('showcase template changed: MOCKS block not found')
        wr(os.path.join(dst, 'index.html'), s)
        print(f'built showcase/{name}/')

    base = 'https://creativehubiion.github.io/creative-mocks'
    print('\nlocal:  http://127.0.0.1:8767/<folder>/   live after push:')
    for _, fmt, *_ in built: print(f'  {base}/{fmt}/{name}/')
    if len(built) > 1: print(f'  {base}/showcase/{name}/   <- the one link to send')

if __name__ == '__main__':
    main()
