#!/usr/bin/env python3
"""lutgen.py - render a family of film-style looks from a JSON spec to .cube LUTs.

Usage:
  python3 lutgen.py film_family.json -o luts/
  python3 lutgen.py film_family.json -o luts/ --preview ref.jpg
  python3 lutgen.py film_family.json -o luts/ --only banksia --preview ref.jpg

Input assumption: display-referred sRGB / Rec.709 (phone photos and video).
Each look = DEFAULTS <- spec "base" <- look overrides. Unknown keys are errors.
"""
import argparse
import json
from pathlib import Path

import numpy as np

DEFAULTS = {
    "size": 33,                       # LUT grid size
    "exposure": 0.0,                  # stops, applied in linear light
    "warmth": 0.0,                    # + warmer (more red, less blue), linear light
    "tint": 0.0,                      # + greener, - magenta
    "contrast": 1.0,                  # S-curve strength (1.0 = moderate film curve)
    "pivot": 0.42,                    # midpoint of the S-curve
    "channel_contrast": [1, 1, 1],    # per-channel curve strength (crossover)
    "channel_pivot": [0, 0, 0],       # per-channel pivot offsets (crossover)
    "black": 0.0,                     # output black level (lifted = faded/matte)
    "white": 1.0,                     # output white level (lower = highlight rolloff)
    "saturation": 1.0,
    "sat_shadow_rolloff": 0.0,        # how much saturation falls away in shadows
    "sat_highlight_rolloff": 0.0,     # ...and in highlights
    "density": 0.0,                   # subtractive density: saturated colours go darker
    "hue_shifts": [],                 # [{"hue": deg, "width": deg, "shift": deg, "sat": mult}]
    "shadow_tint": [0, 0, 0],         # additive RGB in shadows
    "highlight_tint": [0, 0, 0],      # additive RGB in highlights
    "mono": None,                     # [r, g, b] channel mix for black and white looks
}

LUMA = np.array([0.2126, 0.7152, 0.0722])


def srgb_to_linear(x):
    x = np.clip(x, 0, None)
    return np.where(x <= 0.04045, x / 12.92, ((x + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(x):
    x = np.clip(x, 0, None)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * x ** (1 / 2.4) - 0.055)


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def film_curve(x, k, p):
    """Normalised sigmoid: soft toe, soft shoulder, 0->0 and 1->1."""
    s = lambda v: 1 / (1 + np.exp(-k * (v - p)))
    return (s(x) - s(0.0)) / (s(1.0) - s(0.0))


def rgb_to_hsv(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn
    dd = np.where(d > 1e-8, d, 1)
    h = np.select([mx == r, mx == g], [((g - b) / dd) % 6, (b - r) / dd + 2], (r - g) / dd + 4) * 60
    h = np.where(d > 1e-8, h, 0)
    s = np.where(mx > 1e-8, d / np.where(mx > 1e-8, mx, 1), 0)
    return h, s, mx


def hsv_to_rgb(h, s, v):
    h = (h % 360) / 60
    i = np.floor(h).astype(int) % 6
    f = h - np.floor(h)
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    r = np.choose(i, [v, q, p, p, t, v])
    g = np.choose(i, [t, v, v, q, p, p])
    b = np.choose(i, [p, p, t, v, v, q])
    return np.stack([r, g, b], -1)


def transform(rgb, P):
    # 1. Exposure and white balance in linear light
    lin = srgb_to_linear(rgb) * 2 ** P["exposure"]
    lin = lin * np.array([1 + P["warmth"], 1 + P["tint"], 1 - P["warmth"]])
    x = np.clip(linear_to_srgb(lin), 0, 1.5)

    # 2. Film curve, per channel (differences between channels = crossover)
    out = np.empty_like(x)
    for c in range(3):
        k = 5 * P["contrast"] * P["channel_contrast"][c]
        p = P["pivot"] + P["channel_pivot"][c]
        out[..., c] = film_curve(x[..., c], k, p)
    out = P["black"] + (P["white"] - P["black"]) * out

    # 3. Colour: mono mix, or hue shifts + film saturation + density
    if P["mono"]:
        w = np.array(P["mono"], float)
        L = out @ (w / w.sum())
        out = np.repeat(L[..., None], 3, -1)
    else:
        if P["hue_shifts"]:
            h, s, v = rgb_to_hsv(np.clip(out, 0, 1))
            dh, sm = np.zeros_like(h), np.ones_like(s)
            for hs in P["hue_shifts"]:
                dist = (h - hs["hue"] + 180) % 360 - 180
                wgt = np.exp(-0.5 * (dist / hs["width"]) ** 2)
                dh += wgt * hs.get("shift", 0)
                sm *= 1 + wgt * (hs.get("sat", 1) - 1)
            out = hsv_to_rgb(h + dh, np.clip(s * sm, 0, 1), v)
        L = out @ LUMA
        sat = P["saturation"] * (
            1
            - P["sat_shadow_rolloff"] * (1 - smoothstep(0.0, 0.3, L))
            - P["sat_highlight_rolloff"] * smoothstep(0.6, 1.0, L)
        )
        out = L[..., None] + (out - L[..., None]) * np.clip(sat, 0, None)[..., None]
        chroma = out.max(-1) - out.min(-1)
        out = out * (1 - P["density"] * chroma)[..., None]

    # 4. Split toning
    L = out @ LUMA
    ws = 1 - smoothstep(0.0, 0.5, L)
    wh = smoothstep(0.5, 1.0, L)
    out = out + ws[..., None] * np.array(P["shadow_tint"]) + wh[..., None] * np.array(P["highlight_tint"])
    return np.clip(out, 0, 1)


def build_params(base, look):
    P = dict(DEFAULTS)
    for src in (base, look):
        for k, v in src.items():
            if k in ("name", "description"):
                continue
            if k not in DEFAULTS:
                raise KeyError(f"Unknown parameter '{k}' in look '{look.get('name')}'")
            P[k] = v
    return P


def write_cube(path, P, title):
    n = P["size"]
    g = np.linspace(0, 1, n)
    b, gg, r = np.meshgrid(g, g, g, indexing="ij")   # red varies fastest, per .cube spec
    rgb = np.stack([r, gg, b], -1).reshape(-1, 3)
    out = transform(rgb, P)
    with open(path, "w") as f:
        f.write(f'TITLE "{title}"\nLUT_3D_SIZE {n}\nDOMAIN_MIN 0 0 0\nDOMAIN_MAX 1 1 1\n')
        np.savetxt(f, out, fmt="%.6f")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("spec")
    ap.add_argument("-o", "--out", default="luts")
    ap.add_argument("--preview", help="reference image; writes graded previews and a contact sheet")
    ap.add_argument("--only", help="render a single look by name")
    a = ap.parse_args()

    spec = json.loads(Path(a.spec).read_text())
    out_dir = Path(a.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    base = spec.get("base", {})
    looks = [l for l in spec["looks"] if not a.only or l["name"] == a.only]
    if not looks:
        raise SystemExit(f"No look named '{a.only}'")

    img = None
    if a.preview:
        from PIL import Image
        im = Image.open(a.preview).convert("RGB")
        im.thumbnail((1200, 1200))
        img = np.asarray(im).astype(np.float32) / 255
        tiles = [img]

    for look in looks:
        P = build_params(base, look)
        name = look["name"]
        write_cube(out_dir / f"{name}.cube", P, name)
        print(f"wrote {out_dir / (name + '.cube')}")
        if img is not None:
            graded = transform(img.astype(np.float64), P)
            Image.fromarray((graded * 255 + 0.5).astype(np.uint8)).save(out_dir / f"{name}_preview.jpg", quality=92)
            tiles.append(graded)

    if img is not None and len(tiles) > 1:
        from PIL import Image
        h = 360
        row = []
        for t in tiles:
            pim = Image.fromarray((t * 255 + 0.5).astype(np.uint8))
            pim = pim.resize((round(pim.width * h / pim.height), h))
            row.append(np.asarray(pim))
        Image.fromarray(np.concatenate(row, axis=1)).save(out_dir / "contact_sheet.jpg", quality=90)
        print("contact sheet order: original, " + ", ".join(l["name"] for l in looks))


if __name__ == "__main__":
    main()
