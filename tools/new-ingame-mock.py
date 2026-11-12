#!/usr/bin/env python3
"""Make an in-game or Roblox ad mock: the brand's creative on a game's billboard, picked for the fewest black bars.

  python tools/new-ingame-mock.py --format ingame-display --brand "Brand" --creative banner.png [--suffix ab12]
  python tools/new-ingame-mock.py --format ingame-video   --brand "Brand" --creative spot.mp4
  python tools/new-ingame-mock.py --format roblox-billboard --brand "Brand" --creative banner.jpg
  python tools/new-ingame-mock.py --format roblox-video   --brand "Brand" --creative spot.mp4
  ... --list                       only rank the scenes for this creative, build nothing
  ... --scene ingame-boom-karts    use this scene instead of the best one (ids from --list or tools/ingame-library/scenes.json)
  ... --game "Dragon City"         only consider this game's scenes

The creative is letterboxed on black inside each billboard (never cropped or stretched), so the scene whose billboard shape
is closest to the creative's shape shows the fewest black bars. Score = share of the billboard left black, averaged over the
scene's billboards (every billboard in a scene shows the creative). Gameplay videos win ties for ingame-video; scenes that
don't fit a phone screen (or a 16:10 laptop for Roblox) lose a little. On a gameplay-video scene a video creative is cut to the gameplay's loop (from --trim-start, default 0 s), and the
page restarts both together, so the game never jumps back while the ad plays on. Writes <format>/<slug>-<suffix>/ from <format>/_template/.
"""
import argparse, json, math, random, re, shutil, string, subprocess, sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
LIB = REPO / "tools" / "ingame-library"
FORMATS = {
    "ingame-display": {"category": "ingame", "formats": ["display"], "label": "In-game display"},
    "ingame-video": {"category": "ingame", "formats": ["video", "display"], "label": "In-game video"},
    "roblox-billboard": {"category": "roblox", "formats": ["display"], "label": "Roblox billboard"},
    "roblox-video": {"category": "roblox", "formats": ["video"], "label": "Roblox video"},
}
VIDEO_EXT = {".mp4", ".mov", ".webm", ".m4v"}


def creative_ratio(path):
    if path.suffix.lower() in VIDEO_EXT:
        s = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
                                                "stream=width,height:stream_side_data=rotation", "-of", "json", str(path)]))["streams"][0]
        w, h = s["width"], s["height"]
        rot = abs(int(next((d.get("rotation", 0) for d in s.get("side_data_list", []) if "rotation" in d), 0)))
        return (h / w) if rot in (90, 270) else (w / h), "video"
    from PIL import Image
    with Image.open(path) as im:
        return im.width / im.height, "image"


def black_share(rc, rq):
    return 1 - min(rc / rq, rq / rc)


def score(scene, rc, fmt):
    blacks = [black_share(rc, r) for r in scene["ratios"]]
    s = sum(blacks) / len(blacks)
    screen = 16 / 10 if scene["category"] == "roblox" else (2.17 if scene["w"] > scene["h"] else 1 / 2.17)
    sa = scene["w"] / scene["h"]
    if abs(math.log(sa / screen)) > 0.12: s += 0.04          # the scene won't fill the device: a few black bars around it
    if fmt == "ingame-video" and scene["format"] != "video": s += 0.06   # prefer real gameplay video for a video ad
    return s, blacks


def rank(scenes, rc, fmt, game=None):
    f = FORMATS[fmt]
    cand = [s for s in scenes if s["category"] == f["category"] and s["format"] in f["formats"] and s["quads"]]
    if game: cand = [s for s in cand if s["game"].lower() == game.lower()]
    out = []
    for s in cand:
        sc, blacks = score(s, rc, fmt)
        area = sum(abs(poly_area(q)) for q in s["quads"]) / (s["w"] * s["h"])
        out.append((sc, -area, s, blacks))
    out.sort(key=lambda t: (round(t[0], 3), t[1]))
    return out


def poly_area(q):
    return 0.5 * sum(q[i][0] * q[(i + 1) % 4][1] - q[(i + 1) % 4][0] * q[i][1] for i in range(4))


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--format", required=True, choices=FORMATS)
    ap.add_argument("--creative", required=True, type=Path)
    ap.add_argument("--brand")
    ap.add_argument("--headline", default="")
    ap.add_argument("--suffix")
    ap.add_argument("--scene")
    ap.add_argument("--game")
    ap.add_argument("--list", action="store_true")
    ap.add_argument("--force", action="store_true")
    ap.add_argument("--trim-start", type=float, default=0.0, help="where the cut starts in a video creative, for gameplay-video scenes (s)")
    a = ap.parse_args()

    scenes = json.loads((LIB / "scenes.json").read_text(encoding="utf-8"))["scenes"]
    rc, kind = creative_ratio(a.creative)
    if a.format in ("ingame-video", "roblox-video") and kind != "video":
        print("note: a still image on a video format; it will show as a static billboard")
    ranked = rank(scenes, rc, a.format, a.game)
    if not ranked: sys.exit("no scenes for that format/game")
    print(f"creative {a.creative.name}: {kind}, ratio {rc:.3f}")
    print(f"{'scene':42} {'game':30} {'billboards':18} black bars")
    for sc, _, s, blacks in ranked[:8]:
        print(f"{s['id']:42} {s['game'][:30]:30} {str(s['ratios']):18} {round(100 * sum(blacks) / len(blacks))}%"
              + ("  (gameplay video)" if s.get("bgVideo") else ""))
    if a.list: return

    scene = next((s for s in scenes if s["id"] == a.scene), None) if a.scene else ranked[0][2]
    if not scene: sys.exit(f"unknown scene {a.scene}")
    if not a.brand: sys.exit("--brand is needed to build a mock")
    sfx = a.suffix or "".join(random.choice(string.ascii_lowercase + string.digits) for _ in range(4))
    dest = REPO / a.format / f"{slug(a.brand)}-{sfx}"
    if dest.exists() and not a.force: sys.exit(f"{dest.relative_to(REPO)} exists (use --force to rebuild)")
    if dest.exists(): shutil.rmtree(dest)
    tpl = REPO / a.format / "_template"
    (dest / "assets").mkdir(parents=True)

    # the page: phone portrait or landscape for in-game scenes, the laptop for Roblox
    page = tpl / "index.html"
    if not page.exists():
        page = tpl / ("index-portrait.html" if scene["h"] > scene["w"] else "index-landscape.html")
    html = page.read_text(encoding="utf-8").replace("· Brand", f"· {a.brand}").replace("iion · Brand ", f"iion · {a.brand} ")
    html = html.replace("<h1>Headline.</h1>", f"<h1>{a.headline or scene['game']}</h1>")
    (dest / "index.html").write_text(html, encoding="utf-8")

    # the scene's files
    sc = {k: scene[k] for k in ("id", "game", "w", "h", "quads", "masks", "ratios") if k in scene}
    for key in ("bg", "bgVideo", "overlay"):
        if scene.get(key):
            src = LIB / scene[key]; name = f"scene{src.suffix}" if key == "bg" else ("scene-video.mp4" if key == "bgVideo" else "scene-overlay.svg")
            shutil.copy2(src, dest / "assets" / name); sc[key] = f"assets/{name}"
    if a.format == "ingame-video" and scene["format"] != "video":
        sc.pop("bgVideo", None)

    # the creative: images as WebP at their own size (max 1600 px), videos as H.264 (max 1280 px) with their sound
    if kind == "video":
        out = dest / "assets" / "creative.mp4"
        # on gameplay video the ad is cut to the gameplay's loop, so the game never jumps back while the ad plays on
        loop = sc.get("bgVideo") and scene.get("bgDuration")
        trim = ["-ss", str(a.trim_start), "-t", str(scene["bgDuration"])] if loop else []
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *trim, "-i", str(a.creative), "-vf", "scale='min(1280,iw)':-2", "-c:v", "libx264",
                        "-preset", "slow", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", str(out)], check=True)
        if loop:
            print(f"creative cut to {scene['bgDuration']:.1f} s from {a.trim_start:g} s, the length of the gameplay loop "
                  f"(--trim-start to use another part; a screenshot scene keeps the full ad)")
    else:
        from PIL import Image
        out = dest / "assets" / "creative.webp"
        im = Image.open(a.creative).convert("RGBA")
        if max(im.size) > 1600:
            k = 1600 / max(im.size); im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
        im.save(out, "WEBP", quality=90, method=6)
    cr = {"src": f"assets/{out.name}", "type": kind}

    mock = (tpl / "mock.html").read_text(encoding="utf-8")
    mock = mock.replace("window.SCENE = {};", "window.SCENE = " + json.dumps(sc, separators=(",", ":")) + ";")
    mock = mock.replace("window.CREATIVE = {};", "window.CREATIVE = " + json.dumps(cr) + ";")
    (dest / "mock.html").write_text(mock, encoding="utf-8")
    print(f"\nwrote {dest.relative_to(REPO)} on {scene['id']} ({scene['game']}), "
          f"{round(100 * sum(black_share(rc, r) for r in scene['ratios']) / len(scene['ratios']))}% black bars")
    print(f"preview: http://127.0.0.1:8767/{dest.relative_to(REPO).as_posix()}/")


if __name__ == "__main__":
    main()
