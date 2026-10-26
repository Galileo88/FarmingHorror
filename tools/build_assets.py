#!/usr/bin/env python3
"""
Copies the sprite sheets the game uses out of the purchased asset zips in ../zips
into ../assets with short, stable names. Re-run after adding new packs.

    python tools/build_assets.py

Also generates the hand-made crop / item art (tools/make_art.py) that the packs
don't include.
"""
import os, sys, zipfile, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ZIPS = os.path.join(ROOT, "zips")
OUT = os.path.join(ROOT, "assets")

TT1 = "01 - TINY THRONES - Starter Pack.zip"
TT2 = "02 TINY THRONES - Goblin Camp.zip"
TT3 = "03 - Tiny Thrones - Parallax Pack.zip"
TT4 = "04 TINY THRONES - Elvish City.zip"
VIL = "tiny-clans-villagers-workers-all.zip"

FILES = {
    # tilesets
    "tiles/starter.png": (TT1, "Tileset/Tile Set 16x16.png"),
    "tiles/goblin.png": (TT2, "Tileset/Goblin Ruins Tileset.png"),
    "tiles/elvish.png": (TT4, "Tileset/Evlish City Sheet.png"),
    # flags (18x16, 13 frames)
    "flags/banner.png": (TT1, "Flag/flag sprite 18x16.png"),
    "flags/goblin.png": (TT2, "Animated Flag/Goblin Flag 18x16.png"),
    "flags/elvish.png": (TT4, "Animated Flag/Elvish Flag.png"),
    # buildings: 18 frames, frame 0 = finished preview, 1..17 = spawn animation
    "buildings/hut.png": (TT1, "Animated Buildings/Big Hut/Big Hu 32x32t.png"),
    "buildings/market.png": (TT1, "Animated Buildings/Food Building/Food Building 32x32.png"),
    "buildings/armory.png": (TT1, "Animated Buildings/Weapons Shop/Armory32x32.png"),
    "buildings/defense.png": (TT1, "Animated Buildings/Defense Shop/Defense Shop32x32.png"),
    "buildings/lighttower.png": (TT1, "Animated Buildings/Light Tower/Light Tower 32x48.png"),
    "buildings/watchtower.png": (TT1, "Animated Buildings/Small Tower/Small Tower 32x32.png"),
    "buildings/barracks.png": (TT1, "Animated Buildings/Barracks/Barracks 64x48.png"),
    "buildings/manor.png": (TT1, "Animated Buildings/Large Building/Large Building64x48.png"),
    "buildings/spire.png": (TT1, "Animated Buildings/Tall Tower/Tall Tower 1 - 16x64.png"),
    "buildings/wall.png": (TT1, "Animated Buildings/Gates/Gate 32x32.png"),
    "buildings/wall2.png": (TT1, "Animated Buildings/Gates/Gate 2 32x32.png"),
    "buildings/ruin1.png": (TT2, "Animated Buildings/Ruins 1 -16x32/Ruins 1 - 16x32.png"),
    "buildings/ruin2.png": (TT2, "Animated Buildings/Ruins 2 - 32x32/Ruins 2 -32x32.png"),
    "buildings/ruingate.png": (TT2, "Animated Buildings/Ruins Gate - 32xz32/Ruins Gate 32x32.png"),
    "buildings/ruintower.png": (TT2, "Animated Buildings/Ruins Tower 16x48/Ruins Tower 16x48.png"),
    "buildings/elf1.png": (TT4, "Animated Building Spawns/Building 1/Building 1- 32x32.png"),
    "buildings/elf2.png": (TT4, "Animated Building Spawns/Building 2/Building 2 - 32x32.png"),
    "buildings/elf4.png": (TT4, "Animated Building Spawns/Building 4/Bulding 4 - 32x80.png"),
    "buildings/elf6.png": (TT4, "Animated Building Spawns/Building 6/Building 6 - 32x32.png"),
    "buildings/elf7.png": (TT4, "Animated Building Spawns/Building 7/Building 7 - 16x32.png"),
    # villagers (32x16 cells)
    "units/worker1.png": (VIL, "tiny_clans_villagers_worker_1.png"),
    "units/worker2.png": (VIL, "tiny_clans_villagers_worker_2.png"),
    "units/farmer1.png": (VIL, "tiny_clans_villagers_farmer_1.png"),
    "units/lumberjack1.png": (VIL, "tiny_clans_villagers_lumberjack_1.png"),
    "units/miner1.png": (VIL, "tiny_clans_villagers_miner_1.png"),
    # creatures / folk (see src/data.js for row layouts)
    "units/skeleton.png": ("tiny-clans-skeletons.zip", "tiny_clans_-_skeleton_swordsman.png"),
    "units/zombie.png": ("tiny-clans-zombie.zip", "tiny_clans_-_undead_zombie.png"),
    "units/goblin.png": ("tiny-clans-goblins.zip", "tiny_clans_-_goblin_spearman.png"),
    "units/goblin_chief.png": ("tiny-clans-goblins.zip", "tiny_clans_-_goblin_chief.png"),
    "units/kobold.png": ("tiny_clans_kobolds.zip", "tiny_clans_kobold_axe.png"),
    "units/ratfolk.png": ("tiny_clans_ratfolk.zip", "tiny_clans_ratfolk_sword.png"),
    "units/bandit.png": ("tiny_clans_bandit_1.zip", "tiny_clans_bandit_1_club.png"),
    "units/demon.png": ("tiny_clans_demons.zip", "tiny_clans_demon_sword.png"),
    "units/elf.png": ("tiny_clans_elves.zip", "tiny_clans_elf_sword.png"),
    "units/dwarf.png": ("tiny_clans_dwarves.zip", "tiny_clans_dwarf_axe.png"),
    "units/guard.png": ("tiny-clans-humans.zip", "tiny_clans_-_human_swordsman.png"),
    "units/archer.png": ("tiny-clans-humans.zip", "tiny_clans_-_human_archer.png"),
    "units/spearman.png": ("tiny-clans-humans.zip", "tiny_clans_-_human_spearman.png"),
    "units/wizard.png": ("tiny-clans-humans.zip", "tiny_clans_-_human_wizard.png"),
    # townsfolk at work (32x16 cells)
    "units/smith.png": (VIL, "tiny_clans_villagers_blacksmith_2.png"),
    "units/farmer2.png": (VIL, "tiny_clans_villagers_farmer_2.png"),
    "units/lumber2.png": (VIL, "tiny_clans_villagers_lumberjack_2.png"),
    "units/miner2.png": (VIL, "tiny_clans_villagers_miner_2.png"),
    # dogs (16x16 cells)
    "units/dog_beagle.png": ("TinyBit Dogs Pack.zip", "TinyBit Dogs Pack/dog_beagle.png"),
    "units/dog_black.png": ("TinyBit Dogs Pack.zip", "TinyBit Dogs Pack/dog_black.png"),
    "units/dog_white.png": ("TinyBit Dogs Pack.zip", "TinyBit Dogs Pack/dog_white.png"),
    "units/dog_shepherd.png": ("TinyBit Dogs Pack.zip", "TinyBit Dogs Pack/dog_germanshepherd.png"),
    # icons (8x8)
    "icons/coin.png": ("Pixeltiers Tiny RPG Assets V2.zip", "icons/items/coin_001.png"),
    "icons/gem.png": ("Pixeltiers Tiny RPG Assets V2.zip", "icons/items/gemstone_003.png"),
    "icons/potion.png": ("Pixeltiers Tiny RPG Assets V2.zip", "icons/items/potion_001.png"),
    "icons/mushroom.png": ("Pixeltiers Tiny RPG Assets V2.zip", "icons/food/mushroom_001.png"),
    "icons/meat.png": ("Pixeltiers Tiny RPG Assets V2.zip", "icons/food/meat_001.png"),
    "icons/book.png": ("Pixeltiers Tiny RPG Assets V2.zip", "icons/items/book_003.png"),
    "icons/key.png": ("Pixeltiers Tiny RPG Assets V2.zip", "icons/items/key_001.png"),
    "icons/torch.png": ("Pixeltiers Tiny RPG Assets V2.zip", "icons/items/torch_001.png"),
}

PARALLAX = {
    "mountains_day": ("Mountains", ["Mountains - 1.png", "Mountains - 1.1.png", "Mountains - 1.2.png",
                                   "Mountains - 2.png", "Mountains - 3.png", "Mountains - 4.png", "Mountains - 5.png"]),
    "mountains_dusk": ("Dusk Mountains", [f"Dusk M - {i}.png" for i in range(1, 8)]),
    "mountains_night": ("Night Mountains", ["Dusk M - 1.png", "Dusk M - 2.png"] + [f"Dusk M -{i}.png" for i in range(3, 8)]),
    "city_day": ("City", [f"City - {i}.png" for i in range(1, 7)]),
    "city_dusk": ("Dusk City", [f"City Dusk - {i}.png" for i in range(1, 7)]),
    "city_night": ("Night City", [f"Night City - {i}.png" for i in range(1, 7)]),
    "spikes": ("Spikey Lands", [f"Spikey Lands - {i}.png" for i in range(1, 5)]),
    "spikes_teal": ("Spikey Lands Bluey green", [f"Spikey Lands 2 - {i}.png" for i in range(1, 5)]),
}


def copy(zipname, inner, dest):
    zp = os.path.join(ZIPS, zipname)
    if not os.path.exists(zp):
        print("  missing zip:", zipname); return False
    with zipfile.ZipFile(zp) as z:
        try:
            data = z.read(inner)
        except KeyError:
            print("  missing in", zipname, ":", inner); return False
    path = os.path.join(OUT, dest)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)
    return True


# Townsfolk: the worker sheet with its brown tunic swapped for other cloth colours
FOLK_TUNICS = {
    "folk_blue": [(48, 64, 112), (61, 80, 130), (29, 38, 70)],
    "folk_green": [(35, 90, 60), (45, 110, 72), (22, 55, 38)],
    "folk_red": [(120, 40, 45), (145, 52, 55), (75, 25, 30)],
    "folk_plum": [(95, 55, 105), (115, 70, 125), (60, 35, 66)],
}
TUNIC_SRC = [(81, 56, 27), (93, 65, 34), (50, 34, 15)]


def recolor_folk():
    from PIL import Image
    src = os.path.join(OUT, "units/worker2.png")
    if not os.path.exists(src):
        return
    base = Image.open(src).convert("RGBA")
    for name, cols in FOLK_TUNICS.items():
        im = base.copy(); px = im.load()
        for y in range(im.height):
            for x in range(im.width):
                r, g, b, a = px[x, y]
                if a and (r, g, b) in TUNIC_SRC:
                    px[x, y] = cols[TUNIC_SRC.index((r, g, b))] + (a,)
        im.save(os.path.join(OUT, f"units/{name}.png"))


def main():
    n = 0
    for dest, (zipname, inner) in FILES.items():
        n += copy(zipname, inner, dest)
    for name, (folder, layers) in PARALLAX.items():
        for i, layer in enumerate(layers):
            n += copy(TT3, f"Parallax PNG/{folder}/{layer}", f"parallax/{name}_{i}.png")
    print(f"copied {n} files into assets/")
    recolor_folk()
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import make_art
    make_art.main(OUT)


if __name__ == "__main__":
    main()
