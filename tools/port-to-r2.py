#!/usr/bin/env python3
"""Copy the mocks hosted here (GitHub Pages) to creative-mocks.iion.media (Cloudflare R2, bucket creative-mocks), same paths.

  python tools/port-to-r2.py                    every published mock (+ shared/ and the root page)
  python tools/port-to-r2.py playable/hvhl ...  only these folders (after updating a mock here, re-run it for that folder)
  ... --dry-run                                 list what would go, upload nothing
  ... --redirect                                then add the GitHub -> creative-mocks.iion.media redirect to each page here

What goes: exactly the files git tracks (never local-only notes such as SOURCES.md), templates (_template*) left out.
On the way, pages are fixed for a bucket, which has no folder index: links that end in a folder ("../../showcase/x/",
the Away from the game phone redirect, a showcase's tab list) get index.html. The GitHub redirect line is never copied.

The redirect (--redirect): one script, first in each page's <head>, that sends a visitor of the github.io page to the same page on
creative-mocks.iion.media with its ?query and #hash. It runs only on github.io and only when the page is the top window, so the
copies can't loop and a page shown inside another is left alone. The files stay here as a working fallback. Idempotent.

Keys: R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY from the environment or from ../mock-builder/.env.local.
"""
import concurrent.futures as cf, mimetypes, os, re, subprocess, sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DOMAIN = 'creative-mocks.iion.media'
FORMATS = ('afg-video', 'afg-video-mobile', 'ctv', 'display-interstitial', 'hybrid', 'ingame-display', 'ingame-video', 'playable',
           'rewarded', 'rewarded-endcard', 'rewarded-playable', 'roblox-billboard', 'roblox-video', 'showcase')
MARK = 'iion-r2-redirect'
REDIRECT = ('<script id="' + MARK + '">/* this mock lives on ' + DOMAIN + ' now (tools/port-to-r2.py); the copy here stays as a fallback */'
            "if(/github\\.io$/.test(location.hostname)&&window.top===window){var p=location.pathname.replace(/^\\/creative-mocks/,'');"
            "if(/\\/$/.test(p))p+='index.html';location.replace('https://" + DOMAIN + "'+p+location.search+location.hash);}</script>")
TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
         '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png',
         '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg',
         '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
         '.otf': 'font/otf', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.hdr': 'application/octet-stream', '.txt': 'text/plain; charset=utf-8',
         '.xml': 'application/xml', '.ico': 'image/x-icon', '.atlas': 'text/plain; charset=utf-8', '.fnt': 'text/plain; charset=utf-8'}
OLD_AFG = "location.replace(q.has('desktop')?u+'?desktop'+(vv?'&'+vv:''):u+'mock.html?full=1'+(vv?'&'+vv:''));"
NEW_AFG = "const f=u.replace(/index\\.html$/,'');location.replace(q.has('desktop')?f+'index.html?desktop'+(vv?'&'+vv:''):f+'mock.html?full=1'+(vv?'&'+vv:''));"


def env():
    vals = dict(os.environ)
    f = REPO.parent / 'mock-builder' / '.env.local'
    if f.exists():
        for line in f.read_text(encoding='utf-8').splitlines():
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1); vals.setdefault(k, v)
    need = ['R2_ENDPOINT', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']
    if any(not vals.get(k) for k in need): sys.exit('STOP: bucket keys not found (R2_* in the environment or ../mock-builder/.env.local)')
    return {k: vals[k] for k in need}


def tracked(prefixes):
    files = subprocess.run(['git', 'ls-files', '-z'], cwd=REPO, capture_output=True, check=True).stdout.decode('utf-8').split('\0')
    out = []
    for f in filter(None, files):
        parts = f.split('/')
        if f == 'index.html' or (parts[0] == 'shared' and len(parts) == 2):
            if not prefixes: out.append(f)
            continue
        if parts[0] not in FORMATS or len(parts) < 3 or parts[1].startswith('_') or parts[-1] in ('SOURCES.md', '.DS_Store'): continue
        if prefixes and not any(f == p or f.startswith(p.rstrip('/') + '/') for p in prefixes): continue
        out.append(f)
    return out


def folder_links(s):
    """links that end in a folder get index.html (the bucket serves no folder index)"""
    s = s.replace(OLD_AFG, NEW_AFG)
    s = re.sub(r"(url:\s*'(?:\.\./)+[a-z0-9-]+/[a-z0-9-]+/)'", r"\1index.html'", s)               # showcase tab list
    def attr(m):
        v = m.group(2)
        if re.match(r'^(?:[a-z]+:|//|#|\?)', v, re.I) or not v.endswith('/'): return m.group(0)
        return f'{m.group(1)}="{v}index.html"'
    return re.sub(r'\b(href|src|content|data-full)="([^"]*)"', attr, s)


def strip_redirect(s):
    return re.sub(r'<script id="' + MARK + r'">.*?</script>', '', s, flags=re.S)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    dry, redirect = '--dry-run' in sys.argv, '--redirect' in sys.argv
    files = tracked(args)
    pages = [f for f in files if f.endswith('/index.html') or f == 'index.html']
    size = sum((REPO / f).stat().st_size for f in files)
    print(f'{len(files)} files, {size / 1e6:.1f} MB, {len(pages)} pages')
    if dry:
        for p in pages: print('  ', p)
        return
    import boto3
    e = env()
    s3 = boto3.client('s3', endpoint_url=e['R2_ENDPOINT'], aws_access_key_id=e['R2_ACCESS_KEY_ID'], aws_secret_access_key=e['R2_SECRET_ACCESS_KEY'], region_name='auto')

    def put(f):
        p = REPO / f; body = p.read_bytes()
        if p.suffix == '.html': body = folder_links(strip_redirect(body.decode('utf-8'))).encode('utf-8')
        ct = TYPES.get(p.suffix.lower()) or mimetypes.guess_type(p.name)[0] or 'application/octet-stream'
        s3.put_object(Bucket=e['R2_BUCKET'], Key=f, Body=body, ContentType=ct,
                      CacheControl='no-cache' if p.suffix == '.html' else 'public, max-age=600')
        return f
    done = 0
    with cf.ThreadPoolExecutor(8) as ex:
        for _ in ex.map(put, files):
            done += 1
            if done % 100 == 0: print(f'  {done}/{len(files)}')
    print(f'uploaded {done} files to {DOMAIN}')

    if redirect:
        n = 0
        for f in pages:
            p = REPO / f; s = p.read_bytes().decode('utf-8')                      # bytes: keep the file's own line endings
            if MARK in s: continue
            m = re.search(r'<head[^>]*>', s, re.I)
            if not m: print('  no <head> in', f); continue
            nl = '\r\n' if '\r\n' in s else '\n'
            p.write_bytes((s[:m.end()] + nl + REDIRECT + s[m.end():]).encode('utf-8'))
            n += 1
        print(f'redirect added to {n} page(s) here (commit and push to switch the GitHub links over)')


if __name__ == '__main__':
    main()
