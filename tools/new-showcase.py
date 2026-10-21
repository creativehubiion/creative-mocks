"""
Build (or rebuild) a brand's one-link showcase from every mock that carries its suffix, whatever made them
(new-video-mocks.py, new-afg-video-mock.py, the AI creative generation pipeline, a colleague's folder):

  python tools/new-showcase.py --brand "BlackBear – Wife and Dog" --suffix 32eq [--name blackbear-wife-and-dog-32eq]

It looks in every format folder for <anything>-<suffix>/index.html and lists them in this order, with people-friendly labels
(the weekly Creative Hub bot uses them as link text, CLAUDE.md §8d):
  Interactive CTV · CTV video · Rewarded video · Rewarded video + end card · Away from the game video (one tab: the MacBook on a
  computer, the mobile web version on a phone; afg-video-mobile/ is never a tab of its own)
  · Hybrid playable · Playable
Writes showcase/<name>/index.html from showcase/_template/ (name defaults to the slug of the first mock found).
"""
import argparse, io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# folder: (how to tell, label, short label for the phone tab bar, icon, #hash)
KINDS = [
    ('ctv', 'interactive', 'Interactive CTV', 'Interactive', 'tvGame', 'interactive'),
    ('ctv', 'video', 'CTV video', 'CTV', 'tv', 'ctv'),
    ('rewarded', None, 'Rewarded video', 'Rewarded', 'land', 'rewarded'),
    ('rewarded-endcard', None, 'Rewarded video + end card', 'Rewarded + end card', 'landEnd', 'endcard'),
    ('afg-video', None, 'Away from the game video', 'AFG video', 'laptop', 'afg'),
    ('hybrid', None, 'Hybrid playable', 'Hybrid', 'phone', 'hybrid'),
    ('playable', None, 'Playable', 'Playable', 'phone', 'playable'),
]

def rd(p): return io.open(p, encoding='utf-8').read()
def js(s): return s.replace('\\', '\\\\').replace("'", "\\'")
def html(s): return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')

def main():
    a = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    a.add_argument('--brand', required=True); a.add_argument('--suffix', required=True); a.add_argument('--name')
    o = a.parse_args()
    rows, seen = [], set()
    for folder, how, label, short, icon, hid in KINDS:
        base = os.path.join(ROOT, folder)
        if not os.path.isdir(base): continue
        for d in sorted(os.listdir(base)):
            if d.startswith('_') or not d.endswith('-' + o.suffix) or not os.path.exists(os.path.join(base, d, 'index.html')): continue
            if (folder, d) in seen: continue
            if folder == 'ctv':   # interactive (eyebrow "Interactive CTV") or the CTV video ad
                inter = re.search(r'class="eyebrow">\s*Interactive CTV', rd(os.path.join(base, d, 'index.html'))) is not None
                if inter != (how == 'interactive'): continue
            seen.add((folder, d))
            n = sum(1 for r in rows if r[5].startswith(hid))
            rows.append((folder, d, label + (f' {n + 1}' if n else ''), short, icon, hid + (f'-{n + 1}' if n else '')))
    if len(rows) < 2: sys.exit(f'found {len(rows)} mock(s) with suffix -{o.suffix}; a showcase needs 2+')
    name = o.name or rows[0][1]
    s = rd(os.path.join(ROOT, 'showcase', '_template', 'index.html'))
    s = s.replace("const BRAND = 'Brand';", f"const BRAND = '{js(o.brand)}';").replace('<title>iion · Brand mocks</title>', f'<title>iion · {html(o.brand)} mocks</title>')
    lines = ',\n'.join(f"  {{ label: '{js(l)}', short: '{js(sh)}', icon: '{ic}', url: '../../{f}/{d}/', id: '{h}' }}" for f, d, l, sh, ic, h in rows)
    s, k = re.subn(r'const MOCKS = \[\n.*?\n\];', lambda m: 'const MOCKS = [\n' + lines + ',\n];', s, flags=re.S)
    if k != 1: sys.exit('showcase template changed: MOCKS block not found')
    dst = os.path.join(ROOT, 'showcase', name); os.makedirs(dst, exist_ok=True)
    io.open(os.path.join(dst, 'index.html'), 'w', encoding='utf-8', newline='\n').write(s)
    print(f'built showcase/{name}/ with {len(rows)} mocks:')
    for f, d, l, *_ in rows: print(f'  {l:34} {f}/{d}/')
    print(f'local: http://127.0.0.1:8767/showcase/{name}/\nlive after push: https://creativehubiion.github.io/creative-mocks/showcase/{name}/')

if __name__ == '__main__':
    main()
