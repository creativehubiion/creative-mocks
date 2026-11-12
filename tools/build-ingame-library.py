#!/usr/bin/env python3
"""Import the in-game and Roblox scenes from the ad-banner-screenshot-generator repo into tools/ingame-library/.

  python tools/build-ingame-library.py <path to a clone of creativehubiion/ad-banner-screenshot-generator>

Writes tools/ingame-library/scenes.json and one background per scene (WebP, or H.264 MP4 for gameplay video).
Every scene is described in its own units (image pixels, or the SVG viewBox):
  quads    billboard corners [TL, TR, BR, BL], the creative is letterboxed on black and warped onto each
  masks    SVG path data for things standing in front of the billboard (redrawn from the background over the creative)
  overlay  an SVG drawn on top of everything (Roblox's Ad icon, mute and expand buttons), same viewBox
Needs Pillow, Playwright (installed Chrome) and ffmpeg. Re-run it when the generator gets new games.
"""
import copy, json, math, re, shutil, subprocess, sys, tempfile
import xml.etree.ElementTree as ET
from pathlib import Path
from PIL import Image

REPO = Path(__file__).resolve().parent.parent
OUT = REPO / "tools" / "ingame-library"
SVG_NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", SVG_NS)
ET.register_namespace("xlink", "http://www.w3.org/1999/xlink")
MAX_SIDE = 2400


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def corners(points):
    """Four points in any order -> [TL, TR, BR, BL]."""
    pts = sorted(points, key=lambda p: p[1])
    top, bottom = sorted(pts[:2]), sorted(pts[2:])
    return [top[0], top[1], bottom[1], bottom[0]]


def poly_points(s):
    nums = [float(n) for n in re.findall(r"-?\d*\.?\d+(?:e-?\d+)?", s)]
    pts = [(round(nums[i], 2), round(nums[i + 1], 2)) for i in range(0, len(nums) - 1, 2)]
    uniq = []
    for p in pts:
        if not any(abs(p[0] - q[0]) < .01 and abs(p[1] - q[1]) < .01 for q in uniq):
            uniq.append(p)
    return uniq


def path_endpoints(d):
    """Segment end points of an SVG path (M L H V C S Q T A Z, absolute or relative)."""
    toks = re.findall(r"[MmLlHhVvCcSsQqTtAaZz]|-?\d*\.?\d+(?:e-?\d+)?", d)
    n = {"M": 2, "L": 2, "H": 1, "V": 1, "C": 6, "S": 4, "Q": 4, "T": 2, "A": 7, "Z": 0}
    pts, x, y, i, cmd = [], 0.0, 0.0, 0, None
    while i < len(toks):
        if re.match(r"[A-Za-z]", toks[i]): cmd = toks[i]; i += 1
        if cmd in "Zz": continue
        k = n[cmd.upper()]; a = [float(v) for v in toks[i:i + k]]; i += k
        rel = cmd.islower()
        if cmd.upper() == "H": x = a[0] + (x if rel else 0)
        elif cmd.upper() == "V": y = a[0] + (y if rel else 0)
        else:
            ex, ey = a[-2], a[-1]
            x, y = (x + ex, y + ey) if rel else (ex, ey)
        pts.append((round(x, 2), round(y, 2)))
        if cmd == "M": cmd = "L"
        elif cmd == "m": cmd = "l"
    return pts


def extreme_corners(pts):
    return [min(pts, key=lambda p: p[0] + p[1]), max(pts, key=lambda p: p[0] - p[1]),
            max(pts, key=lambda p: p[0] + p[1]), min(pts, key=lambda p: p[0] - p[1])]


def to_path(el):
    tag = el.tag.split("}")[-1]
    if tag == "path":
        return el.get("d")
    if tag == "polygon":
        pts = poly_points(el.get("points", ""))
        return "M" + " L".join(f"{x},{y}" for x, y in pts) + " Z"
    if tag in ("ellipse", "circle"):
        cx, cy = float(el.get("cx", 0)), float(el.get("cy", 0))
        rx = float(el.get("rx", el.get("r", 0))); ry = float(el.get("ry", el.get("r", 0)))
        return f"M{cx - rx},{cy} a{rx},{ry} 0 1,0 {2 * rx},0 a{rx},{ry} 0 1,0 {-2 * rx},0 Z"
    return None


def ratio(q):
    (tl, tr, br, bl) = q
    w = (math.dist(tl, tr) + math.dist(bl, br)) / 2
    h = (math.dist(tl, bl) + math.dist(tr, br)) / 2
    return round(w / h, 3)


def parse_svg(path):
    tree = ET.parse(path); root = tree.getroot()
    vb = [float(v) for v in re.split(r"[\s,]+", root.get("viewBox").strip())]
    w, h = vb[2], vb[3]
    parent = {c: p for p in root.iter() for c in p}
    quads, masks, bg_imgs, drop = [], [], [], []
    for el in root.iter():
        eid = (el.get("id") or "").lower()
        tag = el.tag.split("}")[-1]
        if tag in ("polygon", "path") and re.match(r"^(billboard|banner_area)", eid) and "mask" not in eid:
            if tag == "polygon":
                pts = poly_points(el.get("points"))
                q = corners(pts) if len(pts) == 4 else extreme_corners(pts)
            else:
                q = extreme_corners(path_endpoints(el.get("d")))
            quads.append([list(p) for p in q]); drop.append(el)
        elif eid.startswith("mask_path"):
            d = to_path(el)
            if d: masks.append(d); drop.append(el)
        elif tag == "image" and float(el.get("width", 0)) >= .8 * w:
            bg_imgs.append(el)
    for g in root.iter():
        if (g.get("id") or "").lower() == "banner_mask":
            for c in list(g):
                d = to_path(c)
                if d: masks.append(d)
            drop.append(g)
    # background: only the full-size images (and their ancestors), so icons stay out of it
    keep = set()
    for img in bg_imgs:
        n = img
        while n is not None:
            keep.add(n); n = parent.get(n)
    bg_root = copy.deepcopy(root)
    bg_map = dict(zip(root.iter(), bg_root.iter()))
    bg_parent = {c: p for p in bg_root.iter() for c in p}
    for el in list(root.iter()):
        tag = el.tag.split("}")[-1]
        if el is root or tag in ("defs", "style") or el in keep:
            continue
        if any(a in keep for a in [el]):
            continue
        anc = el; inside_keep_leaf = False
        while anc is not None:
            if anc in bg_imgs: inside_keep_leaf = True
            anc = parent.get(anc)
        if inside_keep_leaf: continue
        b = bg_map[el]
        if b in bg_parent and el not in keep:
            try: bg_parent[b].remove(b)
            except ValueError: pass
    # overlay: everything except the background images, the quads and the masks
    ov_root = copy.deepcopy(root)
    ov_map = dict(zip(root.iter(), ov_root.iter()))
    ov_parent = {c: p for p in ov_root.iter() for c in p}
    for el in bg_imgs + drop:
        o = ov_map[el]
        if o in ov_parent:
            try: ov_parent[o].remove(o)
            except ValueError: pass
    visible = [e for e in ov_root.iter() if e.tag.split("}")[-1] in ("path", "polygon", "rect", "ellipse", "circle", "image", "text", "line", "polyline")]
    overlay = ET.tostring(ov_root, encoding="unicode") if visible else None
    return w, h, quads, masks, ET.tostring(bg_root, encoding="unicode"), overlay


def rasterize(svg_text, w, h, out_png):
    from playwright.sync_api import sync_playwright
    scale = min(2.0, MAX_SIDE / max(w, h))
    with tempfile.TemporaryDirectory() as td:
        f = Path(td) / "scene.svg"; f.write_text(svg_text, encoding="utf-8")
        html = Path(td) / "r.html"
        html.write_text(f'<html><body style="margin:0;background:#000"><img src="scene.svg" style="display:block;width:{w}px;height:{h}px"></body></html>', encoding="utf-8")
        with sync_playwright() as p:
            b = p.chromium.launch(channel="chrome", headless=True)
            pg = b.new_page(viewport={"width": math.ceil(w), "height": math.ceil(h)}, device_scale_factor=scale)
            pg.goto(html.as_uri()); pg.wait_for_load_state("load")
            pg.screenshot(path=str(out_png), clip={"x": 0, "y": 0, "width": w, "height": h})
            b.close()


def save_webp(src_img, out):
    im = src_img.convert("RGB")
    if max(im.size) > MAX_SIDE:
        k = MAX_SIDE / max(im.size); im = im.resize((round(im.width * k), round(im.height * k)), Image.LANCZOS)
    im.save(out, "WEBP", quality=86, method=6)


def video(src, out, width):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-an", "-vf", f"scale={width}:-2,fps=30",
                    "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(out)], check=True)


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1]); shots = src / "public" / "screenshots"
    if OUT.exists(): shutil.rmtree(OUT)
    (OUT / "scenes").mkdir(parents=True)
    scenes = []

    def add(entry, bg_png=None, bg_image=None):
        sid = entry["id"]
        if bg_png is not None: save_webp(Image.open(bg_png), OUT / "scenes" / f"{sid}.webp")
        if bg_image is not None: save_webp(bg_image, OUT / "scenes" / f"{sid}.webp")
        entry["bg"] = f"scenes/{sid}.webp"
        entry["orientation"] = "portrait" if entry["h"] > entry["w"] else "landscape"
        entry["ratios"] = [ratio(q) for q in entry["quads"]]
        if entry.get("bgVideo"):   # the gameplay loop's length: a video creative is cut to it so both restart together
            entry["bgDuration"] = round(float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                                                       "-of", "csv=p=0", str(OUT / entry["bgVideo"])]).decode()), 3)
        scenes.append(entry); print(f"{sid:44} {entry['format']:8} {entry['w']:.0f}x{entry['h']:.0f} quads {entry['ratios']} masks {len(entry.get('masks', []))}")

    with tempfile.TemporaryDirectory() as td:
        # in-game screenshots (static display)
        for game in json.load(open(src / "data/games.json", encoding="utf-8"))["games"]:
            for ss in game["screenshots"]:
                f = shots / ss["filename"]; sid = "ingame-" + slug(Path(ss["filename"]).stem)
                base = {"id": sid, "category": "ingame", "format": "display", "game": game["name"]}
                if f.suffix.lower() == ".svg":
                    w, h, quads, masks, bg_svg, overlay = parse_svg(f)
                    png = Path(td) / f"{sid}.png"; rasterize(bg_svg, w, h, png)
                    add({**base, "w": w, "h": h, "quads": quads, "masks": masks}, bg_png=png)
                else:
                    im = Image.open(f)
                    quads = [[[b["perspective"][k]["x"], b["perspective"][k]["y"]] for k in ("topLeft", "topRight", "bottomRight", "bottomLeft")] for b in ss["billboards"]]
                    add({**base, "w": im.width, "h": im.height, "quads": quads, "masks": []}, bg_image=im)
        # in-game gameplay videos
        for game in json.load(open(src / "data/games-video.json", encoding="utf-8"))["games"]:
            for v in game["videos"]:
                f = src / "public/gameplay-videos" / v["filename"]; sid = "ingame-video-" + slug(game["name"])
                probe = json.loads(subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", str(f)]))["streams"][0]
                w, h = probe["width"], probe["height"]
                video(f, OUT / "scenes" / f"{sid}.mp4", min(w, 1280) if w >= h else min(w, 720))
                poster = Path(td) / f"{sid}.png"
                subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(f), "-frames:v", "1", str(poster)], check=True)
                quads = [[[b["perspective"][k]["x"], b["perspective"][k]["y"]] for k in ("topLeft", "topRight", "bottomRight", "bottomLeft")] for b in v["billboards"]]
                add({"id": sid, "category": "ingame", "format": "video", "game": game["name"], "w": w, "h": h, "quads": quads, "masks": [], "bgVideo": f"scenes/{sid}.mp4"}, bg_png=poster)
        # Roblox billboards (static) and Roblox video (static mock, animated mock)
        rb = [("roblox-billboard-1", "Rblx Billboard 1.svg", "display", "Roblox billboard, type 1", None),
              ("roblox-billboard-2", "Rblx Billboard 2.svg", "display", "Roblox billboard, type 2", None),
              ("roblox-video-static", "Rblx Video 1.svg", "video", "Roblox video, static scene", None),
              ("roblox-video-animated", "Rblx Video 2.svg", "video", "Roblox video, animated scene", "Rblx Video 2 BG.mp4")]
        for sid, fn, fmt, name, bgv in rb:
            w, h, quads, masks, bg_svg, overlay = parse_svg(shots / fn)
            png = Path(td) / f"{sid}.png"; rasterize(bg_svg, w, h, png)
            entry = {"id": sid, "category": "roblox", "format": fmt, "game": name, "w": w, "h": h, "quads": quads, "masks": masks}
            if overlay:
                (OUT / "scenes" / f"{sid}-overlay.svg").write_text(overlay, encoding="utf-8"); entry["overlay"] = f"scenes/{sid}-overlay.svg"
            if bgv:
                video(shots / bgv, OUT / "scenes" / f"{sid}.mp4", 1366); entry["bgVideo"] = f"scenes/{sid}.mp4"
            add(entry, bg_png=png)

    (OUT / "scenes.json").write_text(json.dumps({"source": "creativehubiion/ad-banner-screenshot-generator", "scenes": scenes}, indent=1) + "\n", encoding="utf-8")
    total = sum(p.stat().st_size for p in OUT.rglob("*") if p.is_file())
    print(f"{len(scenes)} scenes, {total / 1e6:.1f} MB in {OUT.relative_to(REPO)}")


if __name__ == "__main__":
    main()
