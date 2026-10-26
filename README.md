# Tiny Acres

A side-scrolling, procedurally generated exploration and farming game in plain HTML5 canvas, built on the Tiny Thrones / Tiny Clans asset packs.

You start with nothing but a few seeds beside a campfire. The world runs forever in both directions. Gather wood and stone, pick a spot you like, plant your banner to claim the land, then till, sow, water and harvest, and build up a homestead while night creatures test your walls.

## Running it

No build step. Serve the folder with any static server and open it:

```
python -m http.server 8000
# then open http://localhost:8000
```

Double-clicking `index.html` also works in most browsers. The game saves to the browser's local storage.

## Controls

| Keyboard | Touch | Action |
|---|---|---|
| A / D or ← / → | ◀ ▶ | Walk |
| Shift | run | Run |
| E / Space | big button | Do whatever is in front of you (chop, mine, till, plant, water, harvest, trade, attack, sleep) |
| B | build | Build menu |
| Q | tap seed box | Switch seed type |
| F | eat | Eat food to heal |
| Esc | ☰ | Pause / save / new world |

## How the game works

- **World:** an endless strip split into ~1400px biome regions. The biomes are Greenmeadow, Amberwood, Fallen Kingdom, Elderglade and Goblin Barrens, and danger rises with distance from the start. Each region places 1 to 2 points of interest: villages, old towns, ruins, goblin camps, war camps, bone fields, elder groves, dwarf dig sites and stray dogs. Everything comes from the world seed. The save only stores what you changed (felled trees regrow after a few days).
- **Homestead:** your banner claims ±176px of land. Inside it you can till fields and build: Hut (sleep, save, respawn), Market (sell), Light Tower (creatures won't enter its glow), Watchtower (archer), Walls (claim edges), Armory (tool upgrades), Barracks (guard) and Manor (bigger claim). Each building plays its Tiny Thrones spawn animation as it goes up.
- **Farming:** crops grow only while watered. Watering lasts until the next morning, and rain waters everything. Each biome has its own fertility; Elderglade is best and the Barrens are worst. Crops are wheat, carrot, pumpkin, starberry (regrows) and moonflower (rare, glows at night, seeds come from Elderglade).
- **Night:** creatures spawn just off-screen and hunt you. Undead fear campfires and crumble at dawn. Goblins and bandits don't care about campfires, but light towers stop everyone.

## Code map

| File | What's in it |
|---|---|
| `src/data.js` | All tunables: sprite rects, animation rows, biomes, crops, items, buildings, creatures, shops |
| `src/world.js` | Seeded biome regions, chunk generation, POI recipes |
| `src/game.js` | Rules: time and weather, the context action, farming, building, trading, spawning, saving |
| `src/entities.js` | Player, creatures, traders, dogs, guards, arrows, particles |
| `src/render.js` | Parallax (biome and time-of-day blending), ground, objects, lighting, rain |
| `src/ui.js` | DOM HUD, prompts, menus, strip map, touch controls |
| `tools/build_assets.py` | Copies the sheets the game uses out of `zips/` into `assets/` with clean names |
| `tools/make_art.py` | Original crop, soil, icon, campfire and chest pixel art (the packs don't include these) |

Debug helpers in the browser console: `TA.dbg.give('wood', 50)`, `TA.dbg.time(21)`, `TA.dbg.tp(-3000)`.

## Asset credits

- Tiny Thrones series (Starter Pack, Goblin Camp, Parallax Pack, Elvish City) by Penusbmic
- Tiny Clans units and villagers by Zneeke
- TinyBit Dogs by Netherzapdos
- Tiny RPG icons by Pixeltiers

These are paid packs. They allow use in games but not redistribution of the raw files. If this repository is public, consider keeping `zips/` (and `assets/`) out of it.
