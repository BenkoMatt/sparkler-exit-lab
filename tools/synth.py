#!/usr/bin/env python3
"""Synthesize sample night photos for Sparkler Exit Lab (fixed seed, procedural).
Outputs 4 JPEGs to site/assets/img/. Deterministic: same output every run."""
import math, random
from PIL import Image, ImageDraw, ImageFilter

random.seed(57005)  # fixed seed (0xDEAD) for reproducibility

W, H = 1600, 1067
OUT = "/root/projects/sites/sparkler-lab/site/assets/img"

def night_bg(warm=0.0, lift=0):
    """Dark scene: gradient sky, faint ground, bokeh."""
    img = Image.new("RGB", (W, H))
    px = img.load()
    for y in range(H):
        t = y / H
        r = int(8 + 6 * t + lift)
        g = int(10 + 7 * t + lift)
        b = int(16 + 9 * t + lift)
        for x in range(W):
            px[x, y] = (min(r,255), min(g,255), min(b,255))
    # faint warm glow near horizon center (ambient from sparklers)
    glow = Image.new("RGB", (W, H), 0)
    gd = ImageDraw.Draw(glow)
    gd.ellipse([W//2-520, int(H*0.45), W//2+520, int(H*0.95)],
               fill=(int(34+40*warm), int(26+30*warm), int(12)))
    glow = glow.filter(ImageFilter.GaussianBlur(180))
    img = Image.blend(img, Image.composite(glow, img, Image.new("L", (W,H), 140)), 0.6)
    d = ImageDraw.Draw(img)
    # ground line
    d.rectangle([0, int(H*0.82), W, H], fill=(8+lift, 9+lift, 12+lift))
    return img, d

def bokeh(d, n, ymin, ymax, rmin, rmax, alpha=42):
    for _ in range(n):
        x = random.randint(0, W); y = random.randint(int(ymin), int(ymax))
        r = random.randint(rmin, rmax)
        a = alpha + random.randint(-18, 18)
        col = (min(255, 255*a//100), int(180*a//100), int(90*a//100))
        d.ellipse([x-r, y-r, x+r, y+r], fill=col)

def silhouettes(d, cx, cy, scale=1.0):
    """Two simple walking figures, dark against glow."""
    col = (5, 5, 8)
    for i, dx in enumerate((-90, 90)):
        s = scale * (1.0 + 0.06*i)
        bx = cx + dx
        head_r = int(26*s)
        body_top = cy - int(150*s)
        d.ellipse([bx-head_r, body_top-head_r*2, bx+head_r, body_top], fill=col)
        d.polygon([(bx-int(34*s), body_top+int(6*s)), (bx+int(34*s), body_top+int(6*s)),
                   (bx+int(20*s), cy), (bx-int(20*s), cy)], fill=col)
        # arm raised holding wand
        d.line([bx+int(30*s), body_top+int(20*s), bx+int(120*s), body_top-int(70*s)],
               fill=col, width=int(12*s))
        # wand
        d.line([bx+int(120*s), body_top-int(70*s), bx+int(210*s), body_top-int(150*s)],
               fill=(90, 70, 45), width=int(6*s))

def trails(d, rows=2, length=220, n_per_side=9, ember_r=4, ember_alpha=90, trail_alpha=(100, 45)):
    """Two rows of wand tips emitting gold trails toward the vanishing point."""
    cy = int(H * 0.56)
    for side, sign in ((0, -1), (1, 1)):
        for i in range(n_per_side):
            t = i / (n_per_side - 1)
            # perspective: farther rows are higher and smaller
            x_edge = W//2 + sign * (120 + 560 * t)
            y = cy - int(150 * (1 - t)) + int(40 * t)
            # trail: CONTINUOUS bright streak pointing toward couple (vanishing direction)
            steps = int(length * (1 - 0.55 * t) / 4)
            for s in range(steps):
                tt = s / steps
                px = int(x_edge - sign * (30 + 190 * (1-t)) * tt)
                py = y + int(10 * tt * (1 if sign < 0 else -1)) + int(24 * tt * tt)
                a = int(100 - 55 * tt)  # solid core: 100->45 (of 100), stays bright
                r = max(1, int(5 * (1 - t) * (1 - tt) + 1))
                col = (min(255, 255*a//100), min(255, int(210*a//100)), int(120*a//100))
                d.ellipse([px-r, py-r, px+r, py+r], fill=col)
                # hot core pixel line on top
                if r >= 2:
                    d.ellipse([px-1, py-1, px+1, py+1], fill=(255, 240, 200))
            # ember at wand tip
            d.ellipse([x_edge-4, y-4, x_edge+4, y+4], fill=(255, 236, 180))

def spark_halo(img, cx, cy, r, strength=1.0):
    """Soft radial glow composited on the image."""
    halo = Image.new("L", (W, H), 0)
    hd = ImageDraw.Draw(halo)
    hd.ellipse([cx-r, cy-r, cx+r, cy+r], fill=int(255*strength))
    halo = halo.filter(ImageFilter.GaussianBlur(max(2, r//3)))
    gold = Image.new("RGB", (W, H), (255, 179, 71))
    return Image.composite(gold, img, halo.point(lambda v: v * 55 // 100))

def make_tunnel_drag():
    img, d = night_bg(warm=1.0)
    bokeh(d, 26, int(H*0.35), int(H*0.75), 6, 26, alpha=50)
    trails(d, length=340, n_per_side=10)
    silhouettes(d, W//2, int(H*0.82))
    img = img.filter(ImageFilter.GaussianBlur(0.6))
    # central glow where the couple stands
    img = spark_halo(img, W//2, int(H*0.6), 300, 0.9)
    return img

def make_flash_blown():
    """Front-curtain flash: whole frame lifted, flat, NO trails, wands nearly invisible."""
    img, d = night_bg(lift=70)  # overexposed flat look
    bokeh(d, 10, int(H*0.4), int(H*0.7), 4, 14, alpha=18)
    # tiny frozen ember dots only - no streaks
    cy = int(H * 0.58)
    for side, sign in ((0, -1), (1, 1)):
        for i in range(9):
            t = i / 8
            x = W//2 + sign * (W//2 - 40 - 560 * t)  # mirrored inward
            y = cy - int(150 * (1 - t)) + int(40 * t)
            d.ellipse([x-2, y-2, x+2, y+2], fill=(210, 190, 150))
    silhouettes(d, W//2, int(H*0.82))
    # flat flash wash
    wash = Image.new("RGB", (W, H), (36, 34, 30))
    img = Image.blend(img, wash, 0.28)
    return img

def make_couple_walk():
    img, d = night_bg(warm=0.8)
    # big soft bokeh tunnel
    bokeh(d, 60, int(H*0.25), int(H*0.85), 12, 46, alpha=60)
    trails(d, n_per_side=7, length=180, ember_alpha=70)
    silhouettes(d, W//2, int(H*0.80), scale=1.1)
    img = spark_halo(img, W//2, int(H*0.58), 340, 0.7)
    return img

def make_sparkler_heart():
    img, d = night_bg(warm=0.6)
    bokeh(d, 18, int(H*0.3), int(H*0.8), 6, 20, alpha=34)
    # one big wand from bottom-left, heart head at tip, glowing
    tip = (int(W*0.46), int(H*0.40))
    d.line([int(W*0.30), int(H*0.95), tip[0], tip[1]], fill=(120, 95, 55), width=7)
    # heart outline in glowing strokes
    pts = []
    for i in range(64):
        t = math.pi * 2 * i / 64
        # classic heart parametric (inverted-y)
        hx = 16 * math.sin(t) ** 3
        hy = 13 * math.cos(t) - 5 * math.cos(2*t) - 2 * math.cos(3*t) - math.cos(4*t)
        pts.append((tip[0] + hx * 9, tip[1] - hy * 9))
    d.line(pts + [pts[0]], fill=(255, 210, 130), width=5)
    for _ in range(140):  # embers around heart
        ang = random.random() * math.pi * 2
        rr = random.randint(26, 90)
        x = int(tip[0] + rr * math.cos(ang)); y = int(tip[1] + rr * math.sin(ang) * 0.9)
        d.ellipse([x-1, y-1, x+1, y+1], fill=(255, int(170+random.randint(0,60)), int(90+random.randint(0,40))))
    img = spark_halo(img, tip[0], tip[1], 150, 1.0)
    return img

jobs = [
    ("sample-tunnel-drag.jpg", make_tunnel_drag),
    ("sample-flash-blown.jpg", make_flash_blown),
    ("sample-couple-walk.jpg", make_couple_walk),
    ("sample-sparkler-heart.jpg", make_sparkler_heart),
]
import os
os.makedirs(OUT, exist_ok=True)
for name, fn in jobs:
    im = fn()
    im.save(f"{OUT}/{name}", "JPEG", quality=82, optimize=True)
    print(name, os.path.getsize(f"{OUT}/{name}"))
print("done")