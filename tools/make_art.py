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
# The cave tileset (assets/cave/tileset.png) is two colours. Each cave biome gets
# a recoloured copy, stacked in assets/art/cave_tiles.png in TA.CAVE_BIOMES pal order.
CAVE_SRC = [(39, 39, 68), (73, 77, 126)]  # dark interior, rock rim
CAVE_RECOLOURS = [
    ('caverns', None),
    ('crystal', [(45, 30, 70), (110, 72, 150)]),
    ('fungal', [(24, 44, 48), (44, 98, 92)]),
    ('bones', [(48, 34, 40), (118, 82, 74)]),
]


def cave_tiles(out_dir):
    src = os.path.join(out_dir, 'cave', 'tileset.png')
    if not os.path.exists(src):
        print('  no cave tileset; run build_assets.py'); return
    base = Image.open(src).convert('RGBA')
    sheet = Image.new('RGBA', (base.width, base.height * len(CAVE_RECOLOURS)), (0, 0, 0, 0))
    for row, (_, cols) in enumerate(CAVE_RECOLOURS):
        im = base.copy(); px = im.load()
        if cols:
            for y in range(im.height):
                for x in range(im.width):
                    r, g, b, a = px[x, y]
                    if a and (r, g, b) in CAVE_SRC: px[x, y] = cols[CAVE_SRC.index((r, g, b))] + (a,)
        sheet.paste(im, (0, row * base.height))
    sheet.save(os.path.join(out_dir, 'art', 'cave_tiles.png'))


def main(out_dir):
    art = os.path.join(out_dir, 'art')
    os.makedirs(art, exist_ok=True)

    cave_tiles(out_dir)

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
