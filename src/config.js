// Farming Horror - tuning knobs.
// Change numbers here to rebalance the game. Times are in seconds, distances in pixels.
window.FH = window.FH || {};

FH.CFG = {
  // Screen / world
  width: 320,
  height: 180,
  tile: 16,
  cols: 20,
  rows: 12,

  // Farm zone where the hoe works (tile coordinates, inclusive)
  farm: { x1: 4, y1: 2, x2: 14, y2: 9 },

  // Day / night cycle
  dayLength: 150,     // 6:00 AM -> 6:00 PM
  duskLength: 15,     // 6:00 PM -> 7:00 PM
  nightLength: 90,    // 7:00 PM -> 5:00 AM
  nightsToWin: 5,

  // Economy
  startCoins: 20,
  refundRate: 0.5,    // shovel refund when digging up a placed item

  crops: {
    carrot:  { name: 'Carrot',  seedCost: 2, sellPrice: 6,  stageTime: 20 },
    pumpkin: { name: 'Pumpkin', seedCost: 6, sellPrice: 25, stageTime: 55 }
  },

  items: {
    scarecrow: { name: 'Scarecrow', cost: 15 },
    lantern:   { name: 'Lantern',   cost: 12 },
    fence:     { name: 'Fence',     cost: 2, hp: 4 }
  },

  // Player
  playerSpeed: 62,
  playerHearts: 5,
  invulnTime: 1.2,

  // Crows (daytime)
  crowSpeed: 48,
  crowEatTime: 5,
  crowSpawnBase: 11,     // seconds between crows on day 1
  crowSpawnMin: 4,
  crowMaxBase: 1,        // max crows at once on day 1 (+1 per day)
  shooRadius: 24,        // walk this close to scare a crow
  scarecrowRadius: 40,

  // Zombies (night)
  zombieBase: 2,
  zombiePerNight: 2,
  zombieSpeed: 15,
  zombieHp: 3,
  zombieChaseRadius: 52,
  zombieEatTime: 2.5,
  zombieRiseTime: 1.4,
  lanternRadius: 40,     // zombies avoid crops in lantern light and slow down inside it

  // Lighting (main.js caps the scene at 12 lights: farmer + house + ~10 lanterns)
  playerLightRadius: 70,
  lanternLightRadius: 56
};
