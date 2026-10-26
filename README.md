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
| W / ↑ / Space | ▲ | Jump (hold for a higher jump) |
| S / ↓ | ▼ | Drop through a cave trapdoor or a ledge |
| E / Enter | big button | Do whatever is in front of you (chop, mine, till, plant, water, harvest, trade, talk, attack, sleep, climb down a shaft, use a portal) |
| B | build | Build menu |
| Q | tap seed box | Switch seed type |
| F | eat | Eat food to heal |
| Esc | ☰ | Pause / save / new world |

## How the game works

- **World:** an endless strip split into 2400px biome regions. The biomes are Greenmeadow, Amberwood, Fallen Kingdom, Elderglade and Goblin Barrens, and danger rises with distance from the start. Each region lays out 1 to 3 points of interest at their real size: villages (fields, a market, a woodlot), towns and cities (gates at both ends, a hazy back row of buildings, smithies, plazas), ruins, goblin camps, war camps, bone fields, elder groves, dwarf dig sites and stray dogs. Everything comes from the world seed. The save only stores what you changed (felled trees regrow after a few days).
- **Biome borders:** two biomes mix over a 600px band. Ground tiles cross-fade, trees and grass dither between the two palettes, the skies blend, and a screen of foreground trees stands right on the seam.
- **Townsfolk:** villages have 3 to 5 people, towns 6 to 9 plus guards, cities 12 to 16 plus guards. They stroll, stop to chat with each other, head indoors at night, and some work all day (smiths, farmers, woodcutters, miners). Stand next to one and press E to talk.
- **Caves:** the caves lie right under the ground, in the same space, and run beneath the whole world. A cave mouth is a shaft with a trapdoor. Stand on it and press ↓ to drop through, and the camera follows you down past the soil and rock into the caverns. Down there are a stepped floor, ledges you can jump onto or drop through, ore, crystals, glowing mushrooms, chests on high ledges, and creatures that hop after you. To get out, jump up the ledges in a shaft towards the daylight and hop out of the hole. Each region above has its own cave biome: Echo Caverns, Crystal Depths, Fungal Grotto or Bone Pits.
- **Hidden biomes:** now and then a region is walled in by cliffs. The Lost Vale (lush, safe, a hermit trader) and the Ember Crater (rich rock, dangerous) can only be reached by going under the cliffs through the caves and climbing out inside.
- **Portals:** a rare region holds one end of a portal pair. The portal hides in ruins, in a cave or out in the open, and its twin lies 3 to 7 regions away, sometimes inside a hidden biome.
- **Depth:** some grass, rocks, trees, fences and small buildings stand in front of the path. They turn see-through when they would hide you. Archways (your walls, town gates, ruin gates) put their left half behind you and their right half in front, so you walk through them.
- **Homestead:** your banner claims ±176px of land. Inside it you can till fields and build: Hut (sleep, save, respawn), Market (sell, or stock the stall), Light Tower (creatures won't enter its glow), Watchtower (archers shoot from its windows; upgrade it from 1 to 3 archers), Walls (claim edges), Armory (tool upgrades), Barracks (guard) and Manor (bigger claim). Each building plays its Tiny Thrones spawn animation as it goes up.
- **Market stall and travellers:** stock produce on your market stall. Travellers walking the road during the day stop at the stall and buy, paying 25% over the market price into the till. If you are away, sales still happen now and then. Stop a traveller on the road to trade with them.
- **Farming:** crops grow only while watered. Watering lasts until the next morning, and rain waters everything. Each biome has its own fertility; Elderglade is best and the Barrens are worst. Crops are wheat, carrot, pumpkin, starberry (regrows) and moonflower (rare, glows at night, seeds come from Elderglade).
- **Night:** creatures spawn just off-screen and hunt you. Undead fear campfires and crumble at dawn. Goblins and bandits don't care about campfires, but light towers stop everyone. Fallen creatures lie where they fell for a minute, then sink into the ground one pixel every 3 seconds.
- **Weather:** each day rolls clear, sunny, overcast, rain, storm or morning fog. Weather eases in and out and tints the whole scene: sunny is warm, overcast and rain are cool and washed out, storms are dark with lightning, and fog rolls along the ground. Each biome also has a light colour grade of its own.

## Code map

| File | What's in it |
|---|---|
| `src/data.js` | All tunables: sprite rects, animation rows, biomes, crops, items, buildings, creatures, shops |
| `src/world.js` | Seeded biome regions and borders, cliffs, POI layouts, cave geometry, shafts, portals, chunk generation |
| `src/game.js` | Rules: time and weather, the context action, farming, building, tower upgrades, market stall, travellers, cave and portal travel, spawning, saving |
| `src/entities.js` | Shared jump/fall physics, player, creatures (and their corpses), traders, townsfolk, travellers, dogs, guards, arrows, particles |
| `src/render.js` | Camera, parallax (each set composited on its own, then blended), ground, back/street/front layers, archways, cliffs, caves, lighting, weather and colour grading |
| `src/ui.js` | DOM HUD, prompts, menus, strip map, touch controls |
| `tools/build_assets.py` | Copies the sheets the game uses out of `zips/` into `assets/` with clean names |
| `tools/make_art.py` | Original crop, soil, icon, campfire, chest and cave pixel art (the packs don't include these) |

The canvas is screen-sized. The world draws in world pixels through a whole-number zoom (about 92 world pixels tall), and positions snap to screen pixels rather than whole world pixels, so moving sprites glide instead of jumping one fat pixel at a time.

Debug helpers in the browser console: `TA.dbg.give('wood', 50)`, `TA.dbg.time(21)`, `TA.dbg.tp(-3000)`, `TA.dbg.tp(-900, 'c')` (into the caves), `TA.dbg.weather('storm')`.

## Asset credits

- Tiny Thrones series (Starter Pack, Goblin Camp, Parallax Pack, Elvish City) by Penusbmic
- Tiny Clans units and villagers by Zneeke
- TinyBit Dogs by Netherzapdos
- Tiny RPG icons by Pixeltiers

These are paid packs. They allow use in games but not redistribution of the raw files. If this repository is public, consider keeping `zips/` (and `assets/`) out of it.
