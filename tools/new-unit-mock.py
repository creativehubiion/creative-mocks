#!/usr/bin/env python3
"""Build a playable, hybrid playable or interactive CTV mock from a game link or a file (video, image or GIF).

  python tools/new-unit-mock.py --format playable --brand "Brand Campaign" --url https://example.com/game/ [--suffix ab12]
  python tools/new-unit-mock.py --format hybrid --brand "Brand Campaign" --media screens.gif
  python tools/new-unit-mock.py --format interactive-ctv --brand "Brand Campaign" --media walkthrough.mp4
  python tools/new-unit-mock.py --format endcard --out <folder> --url ...|--media ...   (the playable end card of rewarded video:
                                                                                      a unit folder for new-video-mocks.py --rp-playable)

Formats: playable -> playable/<slug>-<sfx>/, hybrid -> hybrid/<slug>-<sfx>/ (the phone page, 2:3 interstitial),
interactive-ctv -> ctv/<slug>-interactive-<sfx>/ (the TV page, 16:9).
The page is ours (the format's template); mock.html is tools/unit-mock.html with:
  --url    the live game, shown in the unit (the link must allow being shown inside another page);
  --media  an image (WebP at its own size, capped), a GIF (kept as it is, so it animates) or a video (H.264, sound kept).
Static mocks are welcome: game screens compiled into a GIF or a short screen recording (user, 2026-11-13).
"""
import argparse, json, re, secrets, shutil, string, subprocess, sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
FORMATS = {   # template page, eyebrow before "·", unit shape, longest side for images and videos
    'playable': ('playable/_template/index.html', 'Playable', '2/3', 1280),
    'hybrid': ('hybrid/_template/index.html', 'Hybrid playable', '2/3', 1280),
    'interactive-ctv': ('ctv/_template-video/index.html', 'Interactive CTV', '16/9', 1920),
    'endcard': (None, None, '2/3', 1280),
}
IMG = {'.png', '.jpg', '.jpeg', '.webp'}
VID = {'.mp4', '.mov', '.webm', '.m4v'}


def html(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
def js(s): return s.replace('\\', '\\\\').replace("'", "\\'")
def slug(s): return re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')


def sub(s, a, b):
    if a not in s: sys.exit(f'template changed, cannot find: {a[:60]!r}')
    return s.replace(a, b, 1)


def media_into(src, assets, longest):
    """copy/convert the file; returns (relative path, type)"""
    src = Path(src); ext = src.suffix.lower(); assets.mkdir(parents=True, exist_ok=True)
    if ext == '.gif':
        shutil.copy2(src, assets / 'unit.gif'); return 'assets/unit.gif', 'image'
    if ext in IMG:
        from PIL import Image
        im = Image.open(src); im = im.convert('RGBA' if 'A' in im.getbands() else 'RGB')
        if max(im.size) > longest:
            k = longest / max(im.size); im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        im.save(assets / 'unit.webp', 'WEBP', quality=88, method=6, alpha_quality=95); return 'assets/unit.webp', 'image'
    if ext in VID:
        out = assets / 'unit.mp4'
        vf = f"scale='min({longest},iw)':'min({longest},ih)':force_original_aspect_ratio=decrease:force_divisible_by=2"
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(src), '-vf', vf, '-c:v', 'libx264', '-preset', 'medium', '-crf', '21',
                        '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '96k', str(out)], check=True)
        return 'assets/unit.mp4', 'video'
    sys.exit(f'not a video, image or GIF: {src.name}')


def unit(dst, ratio, longest, url, media, click):
    m = (REPO / 'tools' / 'unit-mock.html').read_text(encoding='utf-8')
    path, kind = ('', '') if url else media_into(media, dst / 'assets', longest)
    m = sub(m, "  url: '',", f"  url: '{js(url or '')}',")
    m = sub(m, "  media: '',", f"  media: '{path}',")
    m = sub(m, "  type: '',", f"  type: '{kind}',")
    m = sub(m, "  ratio: '2/3',", f"  ratio: '{ratio}',")
    m = sub(m, "  clickUrl: '',", f"  clickUrl: '{js(click or '')}',")
    (dst / 'mock.html').write_bytes(m.encode('utf-8'))
    return kind or 'link'


def main():
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument('--format', required=True, choices=FORMATS)
    a.add_argument('--brand', default=''); a.add_argument('--headline', default='')
    a.add_argument('--slug'); a.add_argument('--suffix'); a.add_argument('--out')
    a.add_argument('--url'); a.add_argument('--media'); a.add_argument('--click-url', default='')
    a.add_argument('--force', action='store_true')
    o = a.parse_args()
    if bool(o.url) == bool(o.media): sys.exit('give --url or --media (one of them)')
    if o.url and not re.match(r'^https?://', o.url): sys.exit('--url must start with http:// or https://')
    tpl, label, ratio, longest = FORMATS[o.format]

    if o.format == 'endcard':
        if not o.out: sys.exit('--format endcard needs --out <folder>')
        dst = Path(o.out); dst.mkdir(parents=True, exist_ok=True)
        print('end card unit:', unit(dst, ratio, longest, o.url, o.media, o.click_url), '->', dst); return

    if not o.brand: sys.exit('--brand is needed')
    sfx = o.suffix or ''.join(secrets.choice(string.ascii_lowercase + string.digits) for _ in range(4))
    base = o.slug or slug(o.brand)
    folder = {'playable': 'playable', 'hybrid': 'hybrid', 'interactive-ctv': 'ctv'}[o.format]
    name = f'{base}-interactive-{sfx}' if o.format == 'interactive-ctv' else f'{base}-{sfx}'
    dst = REPO / folder / name
    if dst.exists():
        if not o.force: sys.exit(f'{folder}/{name} exists (use --force)')
        shutil.rmtree(dst)
    dst.mkdir(parents=True)
    kind = unit(dst, ratio, longest, o.url, o.media, o.click_url)

    p = (REPO / tpl).read_text(encoding='utf-8')
    p = re.sub(r'<title>iion · Brand [^<]*</title>', f'<title>iion · {html(o.brand)} {label.lower()}</title>', p, count=1)
    p = re.sub(r'class="eyebrow">[^<·]*· Brand<', f'class="eyebrow">{label} · {html(o.brand)}<', p, count=1)
    p = re.sub(r'<h1>[^<]*</h1>', f'<h1>{html(o.headline or o.brand)}</h1>', p, count=1)
    what = {'link': 'the live game', 'image': 'the game screens', 'video': 'a recording of the game'}[kind]
    p = re.sub(r'<p>[^<]*</p>', f'<p>A {label.lower()} mock for {html(o.brand)}: {what}.</p>', p, count=1)
    if o.format == 'interactive-ctv' and kind != 'video':
        p = p.replace('<div class="controls">', '<div class="controls" style="display:none">', 1)   # nothing to turn the sound on for
    if o.format != 'interactive-ctv' and 'touch.js' not in p:
        p = p.replace('<script src="../../shared/theme.js', '<script src="../../shared/touch.js?v=4"></script>\n<script src="../../shared/theme.js', 1)
    (dst / 'index.html').write_bytes(p.encode('utf-8'))
    m = (dst / 'mock.html').read_text(encoding='utf-8').replace('<title>Brand · Format</title>', f'<title>{html(o.brand)} · {label}</title>')
    (dst / 'mock.html').write_bytes(m.encode('utf-8'))
    print(f'built {folder}/{name}/ ({label}, from {kind})')
    print(f'preview: http://127.0.0.1:8767/{folder}/{name}/')


if __name__ == '__main__':
    main()
