#!/usr/bin/env python3
"""Trim black strips baked into game screenshots in tools/ingame-library (screenshots taken on phones with safe-area margins).

  python tools/trim-scene-bars.py [--dry-run]

Games are played full screen, so a mock should never show the phone's own black margins as part of the game (user, 2026-11-12).
Crops each still screenshot (no gameplay video, no masks or overlay to shift) to where the picture starts, and moves its billboard
corners with it. Safe to run again: a trimmed scene has no strips left. tools/build-ingame-library.py runs it at the end.
"""
import json, sys
from pathlib import Path
from PIL import Image
import numpy as np

LIB = Path(__file__).resolve().parent / "ingame-library"


def edges(a):
    """black strips (in pixels) on each side: left, right, top, bottom"""
    dark_col = lambda x: (a[:, x] < 18).mean() > 0.97
    dark_row = lambda y: (a[y] < 18).mean() > 0.97
    H, W = a.shape
    l = next((x for x in range(W // 4) if not dark_col(x)), 0)
    r = next((x for x in range(W // 4) if not dark_col(W - 1 - x)), 0)
    t = next((y for y in range(H // 4) if not dark_row(y)), 0)
    b = next((y for y in range(H // 4) if not dark_row(H - 1 - y)), 0)
    return l, r, t, b


def main():
    dry = "--dry-run" in sys.argv
    data = json.loads((LIB / "scenes.json").read_text(encoding="utf-8"))
    changed = 0
    for s in data["scenes"]:
        if s.get("bgVideo") or s.get("masks") or s.get("overlay"): continue
        p = LIB / s["bg"]
        im = Image.open(p); a = np.asarray(im.convert("L"))
        l, r, t, b = edges(a)
        if max(l, r, t, b) < 5: continue
        k = im.width / s["w"]                      # image pixels per scene unit
        box = (l, t, im.width - r, im.height - b)
        print(f"{s['id']}: trim {l}/{r}/{t}/{b} px (l/r/t/b) of {im.width}x{im.height}")
        changed += 1
        if dry: continue
        im.crop(box).save(p, quality=90, method=6) if p.suffix == ".webp" else im.crop(box).save(p)
        s["w"] = round((box[2] - box[0]) / k, 2); s["h"] = round((box[3] - box[1]) / k, 2)
        s["quads"] = [[[round(x - l / k, 2), round(y - t / k, 2)] for x, y in q] for q in s["quads"]]
    if changed and not dry:
        (LIB / "scenes.json").write_text(json.dumps(data, indent=1) + "\n", encoding="utf-8")
    print(f"{changed} scene(s) {'would be ' if dry else ''}trimmed")


if __name__ == "__main__":
    main()
