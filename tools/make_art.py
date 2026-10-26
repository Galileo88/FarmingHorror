#!/usr/bin/env python3
"""
Original pixel art for things the purchased packs don't include (crops, soil,
resource icons, campfire, chest, signpost). Drawn in the Resurrect 64 palette
that Tiny Thrones uses so it sits naturally next to the pack art.

Writes into assets/art/.
"""
import os
from PIL import Image

PAL = {
    '.': None,
    # greens
    'a': '#165a4c', 'b': '#239063', 'c': '#1ebc73', 'd': '#91db69',
    # olives
    'o': '#676633', 'p': '#a2a947', 'q': '#d5e04b',
    # golds / oranges / reds
    'y': '#f9c22b', 'Y': '#fbb954', 'w': '#e6904e', 'r': '#cd683d', 'R': '#9e4539',
    'e': '#e83b3b', 'E': '#b33831',
    # cyan glow
    't': '#0b8a8f', 'T': '#30e1b9', 'm': '#8ff8e2', 'W': '#ffffff',
    # woods
    'k': '#4d3729', 'K': '#805c45', 'j': '#674937', 'J': '#ad8266', 'B': '#c8ac99',
    # stones / darks
    'g': '#625565', 'G': '#7f708a', 'h': '#9babb2', 'H': '#c7dcd0', 'x': '#2e222f', 'X': '#3e3546',
    # purples
    'v': '#6b3e75', 'V': '#905ea9',
}


def rgba(hexs):
    h = hexs.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)


def paint(img, rows, ox, oy, sub=None):
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            if sub and ch in sub:
                ch = sub[ch]
            col = PAL.get(ch)
            if col:
                img.putpixel((ox + x, oy + y), rgba(col))


def bottom_center(img, rows, cell_x, cell_y, cw=16, ch=16, base=0):
    h = len(rows); w = max(len(r) for r in rows)
    ox = cell_x + (cw - w) // 2
    oy = cell_y + ch - h - base
    paint(img, rows, ox, oy)


# ---------------------------------------------------------------- crops
SPROUT = ["c.c", ".b."]
CROPS = {
    'wheat': [
        SPROUT,
        [".c...c.", "..c.c..", ".c.bc..", "..bb.b.", "..b.b.."],
        ["..q..p.", ".pq.qp.", "..pq.p.", ".p.bp..", "..bpb..", "..b.b..", "..b.b.."],
        ["..Y..y.", ".yY.Yy.", "yY.yY.y", ".y.yY..", "..wy.w.", "..w.w..", "..o.w..", ".o..o.."],
    ],
    'carrot': [
        SPROUT,
        [".c.c.", "c.cc.", ".bcb.", "..b.."],
        ["c.c.c", "bcbcb", ".bcb.", ".bbb.", "..b.."],
        [".c.c.c.", "cbcbcbc", ".bcbcb.", "..bcb..", "..rwr..", ".rwwr.."],
    ],
    'pumpkin': [
        SPROUT,
        ["..cc.", "bcc..", ".b.bc", "b..b."],
        [".cc...", "cbc.cc", "b.bcb.", "bb.b.b", ".pp...", "oppo.."],
        ["..k.c..", "..kcb..", ".RrwrR.", "RrwYwrR", "RrwwwrR", ".RrrrR."],
    ],
    'berry': [
        SPROUT,
        [".cc.", "cbbc", ".bb.", ".k.."],
        [".ccc.", "cbcbc", "bbcbb", ".bbb.", "..k.."],
        [".cec.", "cbEbe", "ebcbb", "bEbeb", ".bbb.", "..k.."],
    ],
    'moonflower': [
        ["T.T", ".t."],
        ["..T..", ".tT..", "..t.t", "..tt.", "..t.."],
        [".mTm.", ".TmT.", "..t..", ".at..", "..ta.", "..t.."],
        ["m.W.m", ".mWm.", "WmTmW", ".mWm.", "m.t.m", "..ta.", ".at..", "..t.."],
    ],
}
CROP_ORDER = ['wheat', 'carrot', 'pumpkin', 'berry', 'moonflower']
SEED_COLOR = {'wheat': 'y', 'carrot': 'r', 'pumpkin': 'w', 'berry': 'e', 'moonflower': 'T'}

SEEDS = ["k.k", ".k."]  # seed mound, stage 0

ICONS = {
    'wood': ["........", "...kkkk.", "..kKKKkB", ".kKKKkBJ", "kKKKkBJB", "kKKkBJB.", ".kkBJB..", "..BB...."],
    'stone': ["........", "...gg...", "..gGGg..", ".gGHGGg.", ".gGGGGg.", "gGGGGGGg", ".gggggg.", "........"],
    'fiber': ["........", ".c..c...", "..cb.c..", ".b.cb...", "..bcb.c.", ".b.bcb..", "..b.b...", "........"],
    'wheat': ["..y.Y...", ".yYyYy..", "..yYy...", "...w....", "..wkw...", "..w.w...", ".w...w..", "........"],
    'carrot': ["....c.c.", ".....cc.", "....rw..", "...rwr..", "..rwr...", ".rw.....", "r.......", "........"],
    'pumpkin': ["...k....", "..kc....", ".RrwrR..", "RrwYwrR.", "RrwwwrR.", ".RrrrR..", "........", "........"],
    'berry': ["....c...", "...cb...", "..e.e...", ".eEeWe..", ".eEEe.e.", "..e.eEe.", "....ee..", "........"],
    'moonflower': ["..m.m...", ".mWTWm..", "..TmT...", ".mWTWm..", "..m.t...", "....ta..", "....t...", "........"],
    'heart': ["........", ".ee.ee..", "eWeeeee.", "eeeeeEe.", ".eeeEe..", "..eEe...", "...e....", "........"],
    'heart_empty': ["........", ".XX.XX..", "XgXXXXX.", "XXXXXXX.", ".XXXXX..", "..XXX...", "...X....", "........"],
    'hoe': ["........", "....kgg.", "...k.g..", "..k.....", ".k......", "k.......", "........", "........"],
    'scythe': ["..hhh...", ".h...h..", "......h.", ".....k..", "....k...", "...k....", "..k.....", "........"],
    'axe': ["...gg...", "..gHGk..", "..gGk...", "...k....", "..k.....", ".k......", "........", "........"],
    'pick': [".hh.....", "h..hk...", "....k...", "...k.h..", "..k...h.", ".k......", "........", "........"],
    'can': ["........", "........", ".hhh.h..", "hGGGhh..", "hGGGh...", "hGGGh...", ".hhh....", "........"],
    'banner': ["kee.....", "keeeE...", "keeE....", "kE......", "k.......", "k.......", "k.......", "........"],
    'sun': ["...y....", ".y.y.y..", "..YYY...", "yYyyYy..", "..YYY...", ".y.y.y..", "...y....", "........"],
    'moon': ["...HH...", "..HH....", ".HH.....", ".HH.....", ".HH.....", "..HH....", "...HH...", "........"],
}


# ---------------------------------------------------------------- caves
# One palette per cave biome (and 'cliff' for the surface rock walls):
# deep, base, speck, rim, top (moss/crust), drip
CAVE_PALETTES = [
    ('caverns', ['#2e222f', '#3e3546', '#45293f', '#625565', '#7f708a', '#9babb2']),
    ('crystal', ['#2e222f', '#45293f', '#3e3546', '#6b3e75', '#905ea9', '#a884f3']),
    ('fungal', ['#2e222f', '#3e3546', '#323353', '#165a4c', '#239063', '#1ebc73']),
    ('bones', ['#2e222f', '#45293f', '#3e3546', '#6e2727', '#c8ac99', '#ad8266']),
    ('cliff', ['#3e3546', '#625565', '#45293f', '#7f708a', '#239063', '#9babb2']),
]


def _h(*n):
    """Small deterministic hash -> [0, 1)."""
    v = 2166136261
    for k in n:
        v = ((v ^ (k & 0xffffffff)) * 16777619) & 0xffffffff
        v ^= v >> 13
    return (v & 0xffff) / 65536.0


def cave_tiles(img, row, pal):
    deep, base, speck, rim, top, drip = [rgba(c) for c in pal]
    oy = row * 8
    for t in range(5):  # floor top, fill, fill 2, ceiling bottom, platform
        for y in range(8):
            for x in range(8):
                c = base
                v = _h(row, t, x, y)
                if v < 0.16: c = speck
                elif v > 0.93: c = deep
                if t == 0:
                    if y == 0: c = top if _h(x, 9, row) < 0.8 else rim
                    elif y == 1: c = rim if _h(x, 3, row) < 0.7 else top
                    elif y == 2 and _h(x, 4, row) < 0.3: c = rim
                if t == 2 and (x + y * 3) % 7 == 0: c = speck
                if t == 3:
                    if y == 7: c = rim if _h(x, 5, row) < 0.6 else deep
                    elif y == 6 and _h(x, 6, row) < 0.25: c = drip
                if t == 4:
                    if y >= 4: continue
                    c = [top, rim, base, deep][y]
                    if y == 1 and x in (0, 7): c = deep
                img.putpixel((t * 8 + x, oy + y), c)


def crystal(img, ox, oy, pal):
    dark, mid, light, white = [rgba(PAL[k]) for k in pal]
    shards = [(3, 9, 2), (6, 7, 2), (1, 5, 1), (8, 4, 1)]  # x, height, half width
    for sx, hgt, hw in shards:
        for y in range(hgt):
            w = max(0, hw - (y * hw) // max(1, hgt - 2)) if y > hgt - 3 else hw
            for x in range(sx - w, sx + w + 1):
                if 0 <= x < 10:
                    c = mid if x < sx else light
                    if x == sx - w: c = dark
                    if y == hgt - 1: c = white
                    img.putpixel((ox + x, oy + 9 - y), c)


def cave_mouth(img, ox, oy):
    """40x24 rocky mound with a dark opening and a ladder poking out."""
    deep, base, speck, rim, top, drip = [rgba(c) for c in CAVE_PALETTES[4][1]]
    hole = rgba('#2e222f'); hole2 = rgba('#1b1320')
    wood, wood2 = rgba('#805c45'), rgba('#4d3729')
    W, H = 40, 24
    for x in range(W):
        d = abs(x - W / 2 + 0.5) / (W / 2)
        hgt = int(H * (1 - d ** 2.2) - _h(x, 77) * 2)
        for y in range(max(0, hgt)):
            c = base if _h(x, y, 1) > 0.15 else speck
            if y == hgt - 1: c = top if _h(x, 2) < 0.75 else rim
            elif y == hgt - 2: c = rim
            elif x < 4 or _h(x, y) > 0.95: c = deep
            img.putpixel((ox + x, oy + H - 1 - y), c)
    # opening
    for y in range(14):
        hw = int(8 * (1 - (y / 14) ** 2.4)) + 1
        for x in range(20 - hw, 20 + hw):
            img.putpixel((ox + x, oy + H - 1 - y), hole2 if abs(x - 19.5) < hw - 2 and y < 12 else hole)
    # ladder rails + rungs
    for y in range(17):
        img.putpixel((ox + 17, oy + H - 1 - y), wood2)
        img.putpixel((ox + 22, oy + H - 1 - y), wood2)
        if y % 3 == 1:
            for x in range(18, 22): img.putpixel((ox + x, oy + H - 1 - y), wood)


def stalagmite(img, ox, oy, pal_row):
    deep, base, speck, rim, top, drip = [rgba(c) for c in CAVE_PALETTES[pal_row][1]]
    for y in range(12):
        hw = max(0, int(3.5 * (1 - y / 12)))
        for x in range(3 - hw, 4 + hw):
            img.putpixel((ox + x, oy + 11 - y), rim if x < 3 else base)


def glowshroom(img, ox, oy):
    rows = [".mTTm.", "mTWTTm", "TTTTmT", "..ta..", "..ta..", ".atta."]
    paint(img, rows, ox, oy)


def cave_backdrop(out_path):
    """Tileable far-wall silhouettes, one 160x96 band per cave biome."""
    W, H = 160, 96
    img = Image.new('RGBA', (W, H * 4), (0, 0, 0, 0))
    for row, (_, pal) in enumerate(CAVE_PALETTES[:4]):
        far = rgba(pal[0]); near = rgba(pal[2]); edge = rgba(pal[1])
        for x in range(W):
            # columns, stalactites from the top, mounds from the bottom (periodic in x)
            import math
            a = 2 * math.pi * x / W
            top = 18 + 10 * math.sin(a * 3 + row) + 6 * math.sin(a * 7 + 1.3 * row)
            bot = 30 + 12 * math.sin(a * 2 + 0.7 * row) + 5 * math.sin(a * 9)
            spike = (x * 7 + row * 3) % 23
            if spike < 3: top += 14 - spike * 4
            for y in range(H):
                yy = y
                if yy < top or yy > H - bot:
                    c = far
                    if abs(yy - top) < 1.2 or abs(yy - (H - bot)) < 1.2: c = edge
                    img.putpixel((x, row * H + y), c)
                elif _h(x, y, row) < 0.012:
                    img.putpixel((x, row * H + y), near)
    img.save(out_path)


def main(out_dir):
    art = os.path.join(out_dir, 'art')
    os.makedirs(art, exist_ok=True)

    # cave.png: tile rows per palette (5 tiles of 8x8) + props
    cave = Image.new('RGBA', (96, 80), (0, 0, 0, 0))
    for r, (_, pal) in enumerate(CAVE_PALETTES):
        cave_tiles(cave, r, pal)
    crystal(cave, 48, 0, ['t', 'T', 'm', 'W'])
    crystal(cave, 58, 0, ['v', 'V', 'm', 'W'])
    glowshroom(cave, 68, 4)
    for i in range(4):
        stalagmite(cave, 48 + i * 8, 12, i)
    cave_mouth(cave, 0, 48)
    cave.save(os.path.join(art, 'cave.png'))
    cave_backdrop(os.path.join(art, 'cave_bg.png'))

    # crops.png: rows = crop types (CROP_ORDER), cols = stage 0..4 (16x16)
    img = Image.new('RGBA', (16 * 5, 16 * len(CROP_ORDER)), (0, 0, 0, 0))
    for r, name in enumerate(CROP_ORDER):
        bottom_center(img, SEEDS, 0, r * 16)
        for s, rows in enumerate(CROPS[name]):
            bottom_center(img, rows, (s + 1) * 16, r * 16)
    img.save(os.path.join(art, 'crops.png'))

    # soil.png: 16x6 tiles: dry, wet
    soil = Image.new('RGBA', (32, 6), (0, 0, 0, 0))
    dry = ["kjkkjkkjkkjkkjkk", "jKjjKjjKjjKjjKjj", "kjkxkjkxkjkxkjkx", "xkxkxkxkxkxkxkxk", "kxkxkxkxkxkxkxkx", "xxxxxxxxxxxxxxxx"]
    wet = [r.replace('K', 'j').replace('j', 'k').replace('k', 'X') for r in dry]
    wet = ["XkXXkXXkXXkXXkXX", "kjkkjkkjkkjkkjkk", "XkXxXkXxXkXxXkXx", "xXxXxXxXxXxXxXxX", "XxXxXxXxXxXxXxXx", "xxxxxxxxxxxxxxxx"]
    paint(soil, dry, 0, 0); paint(soil, wet, 16, 0)
    soil.save(os.path.join(art, 'soil.png'))

    # icons.png: 8x8 icons in one row; seed bags appended per crop
    names = list(ICONS.keys()) + [f'seed_{c}' for c in CROP_ORDER]
    icons = Image.new('RGBA', (8 * len(names), 8), (0, 0, 0, 0))
    bag = ["...kk...", "..k..k..", "...kk...", "..BBBB..", ".BBZZBB.", ".BZZZZB.", ".BBBBBB.", "........"]
    for i, n in enumerate(names):
        if n.startswith('seed_'):
            paint(icons, bag, i * 8, 0, sub={'Z': SEED_COLOR[n[5:]]})
        else:
            paint(icons, ICONS[n], i * 8, 0)
    icons.save(os.path.join(art, 'icons.png'))
    with open(os.path.join(art, 'icons.txt'), 'w') as f:
        f.write('\n'.join(names))

    # campfire.png: 4 frames 16x16
    fire = Image.new('RGBA', (64, 16), (0, 0, 0, 0))
    flames = [
        ["...y....", "..yY.y..", ".yYwYy..", ".YwrwY..", "..wrw..."],
        [".....y..", "..y.yY..", ".yYYwy..", ".YwrwY..", "..wrw..."],
        ["..y.....", "..Yy.y..", ".yYwYYy.", ".YwrwY..", "..wrw..."],
        ["....y...", "..yYy...", ".yYwwy..", ".YwrrY..", "..wrw..."],
    ]
    logs = ["..kK..Kk..", ".kKKkkKKk.", "kkJk..kJkk"]
    stones = ["g........g"]
    for i, fl in enumerate(flames):
        bottom_center(fire, logs + stones, i * 16, 0)
        bottom_center(fire, fl, i * 16, 0, base=3)
    fire.save(os.path.join(art, 'campfire.png'))

    # chest.png: closed, open (16x16)
    chest = Image.new('RGBA', (32, 16), (0, 0, 0, 0))
    closed = [".kkkkkkkk.", "kKKKKKKKKk", "kJJJyyJJJk", "kkkkyykkkk", "kKKKKKKKKk", "kKKKKKKKKk", "kkkkkkkkkk"]
    opened = [".kkkkkkkk.", "kJJJJJJJJk", "kkkkkkkkkk", "kYyYyWyYyk", "kKKKyyKKKk", "kKKKKKKKKk", "kkkkkkkkkk"]
    bottom_center(chest, closed, 0, 0); bottom_center(chest, opened, 16, 0)
    chest.save(os.path.join(art, 'chest.png'))

    # sign.png: build-site signpost (16x16)
    sign = Image.new('RGBA', (16, 16), (0, 0, 0, 0))
    post = ["kkkkkkk", "kJBJBJk", "kBJBJBk", "kkkkkkk", "...k...", "...k...", "...k...", "..kkk.."]
    bottom_center(sign, post, 0, 0)
    sign.save(os.path.join(art, 'sign.png'))
    print('generated art in assets/art/')


if __name__ == '__main__':
    main(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets'))
