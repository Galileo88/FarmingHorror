# Farming Horror

A 16×16 pixel-art farming game with a horror twist. Grow crops by day, keep the crows off them, then survive the night when zombies rise from the graveyard.

Built with [Phaser 4](https://phaser.io) in plain JavaScript, with no build step and no install.

## Play it

**Online:** https://galileo88.github.io/FarmingHorror/

**Offline:** double-click `index.html`. It opens in your browser and runs offline.

**Or run a local server.** You'll need one once you add PNG art, because browsers block loading image files straight from disk:

```bash
# from the repo folder, either of these:
python3 -m http.server 8000
npx serve .
```

Then open http://localhost:8000.

**Publishing:** GitHub Pages serves the `main` branch as-is (Settings → Pages → Deploy from a branch → `main` / root). Every push to `main` updates the online version within a minute or two. The empty `.nojekyll` file tells Pages to skip its Jekyll step and serve the files directly.

## Controls

| Key | Action |
|---|---|
| WASD / arrow keys | Move |
| Space (or J) | Use the selected tool on the highlighted tile. Any tool harvests a ripe crop. |
| 1–8, Q / E, mouse wheel, click the hotbar | Pick a tool |
| P / Esc | Pause |
| M | Mute |

## How a day works

1. **Day (6 AM to 6 PM).** Use the **hoe** on grass in the middle field. Plant **carrot** (fast, cheap) or **pumpkin** (slow, worth a lot) seeds, then **water** them. Crops only grow on watered soil, and the soil dries out every night.
2. **Crows** show up and land on your crops. If a crow pecks for 5 seconds, the crop is gone. You can deal with crows three ways:
   - walk up to a crow to shoo it away
   - hit it with the **shovel**
   - put a **scarecrow** nearby
3. **Dusk.** A bell rings and the light fades.
4. **Night (7 PM to 5 AM).** **Zombies** climb out of the graves on the right. They go for your crops, and they go for you if you get close. You can deal with zombies these ways:
   - **Shovel:** hits them, knocks them back, and earns you a coin per kill.
   - **Lanterns:** zombies won't target crops inside lantern light, and they slow down in it.
   - **Fences:** block zombies, but zombies will chew through them.
5. **Dawn.** Any zombies left burn up, and you get a summary of the night. Survive 5 nights to win, or keep going in endless mode.

You have 5 hearts, and they refill each morning.

## Project layout

```
index.html          loads Phaser + the game scripts in order
lib/phaser.min.js   Phaser 4.2.1 (MIT), vendored so it works offline
src/config.js       ALL the tuning numbers: day length, prices, enemy speed...
src/palette.js      the shared color palette
src/art.js          every sprite, drawn as text (one letter = one pixel)
src/font.js         tiny 3x5 pixel font
src/audio.js        synthesized sound effects + generative music
src/field.js        ground tiles, crops, placed items
src/player.js       the farmer
src/crow.js         crow AI (approach, peck, flee)
src/zombie.js       zombie AI (rise, chase, eat, chew fences)
src/scenes/         boot, title, game (main loop), hud
```

### Easy things to tweak

- **Balance:** change the numbers in `src/config.js`. For example, set `dayLength: 300` for longer days, or `zombiePerNight: 3` for bigger hordes.
- **Art:** in `src/art.js`, each sprite is a block of text where each letter is one pixel and the letters map to colors in `src/palette.js`. Edit a letter and reload the page.
- **Colors:** edit `src/palette.js`. Every sprite updates.

## Using downloaded art (e.g. Sunnyside World)

All the art is currently made in code, so the repo contains no third-party assets. To switch to a pack like [Sunnyside World](https://danieldiggle.itch.io/sunnyside):

1. Put the pack in `assets/licensed/`. That folder is git-ignored on purpose: Sunnyside, Sprout Lands and similar packs don't allow redistribution, and a public repo counts as redistribution.
2. In `src/scenes/boot.js`, load the sheet with the same key, for example `this.load.spritesheet('farmer', 'assets/licensed/...png', { frameWidth: 16, frameHeight: 16 })`. Then remove that key from `FH.SPRITES` in `src/art.js`.
3. Run the game from a local server (see above).
4. Add the asset to `CREDITS.md`.

CC0 packs (Kenney, 0x72, Ninja Adventure) are safe to commit. Put those in `assets/` instead.

## Ideas for what's next

- Scarecrows that crows slowly learn to ignore unless you move them
- A well for refilling the watering can, plus a shop and inventory
- More enemies: fast "runner" zombies, a boss on blood-moon nights
- More crops and seasons
- Save and load with localStorage
- Touch controls for phones
