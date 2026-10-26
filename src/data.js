// ============================================================================
// Game data: sprite rects, animations, biomes, crops, items, buildings, mobs.
// Everything tunable lives here.
// ============================================================================
window.TA = window.TA || {};

TA.DAY_SECONDS = 420;          // real seconds per in-game day
TA.START_HOUR = 7.5;
TA.CHUNK = 256;                // world chunk width (px)
TA.REGION = 1400;              // biome region width (px)
TA.CLAIM_RADIUS = 176;         // land claimed by a banner, each side

// ---------------------------------------------------------------- images
TA.IMAGES = {
  starter: 'assets/tiles/starter.png',
  goblinTiles: 'assets/tiles/goblin.png',
  elvishTiles: 'assets/tiles/elvish.png',
  flagBanner: 'assets/flags/banner.png',
  flagGoblin: 'assets/flags/goblin.png',
  flagElvish: 'assets/flags/elvish.png',
  crops: 'assets/art/crops.png',
  soil: 'assets/art/soil.png',
  icons: 'assets/art/icons.png',
  campfire: 'assets/art/campfire.png',
  chest: 'assets/art/chest.png',
  sign: 'assets/art/sign.png',
  coin: 'assets/icons/coin.png',
  gem: 'assets/icons/gem.png',
  mushroom: 'assets/icons/mushroom.png',
  meat: 'assets/icons/meat.png',
  potion: 'assets/icons/potion.png',
};
['hut', 'market', 'armory', 'defense', 'lighttower', 'watchtower', 'barracks', 'manor', 'spire',
  'wall', 'wall2', 'ruin1', 'ruin2', 'ruingate', 'ruintower', 'elf1', 'elf2', 'elf4', 'elf6', 'elf7']
  .forEach(n => TA.IMAGES['b_' + n] = `assets/buildings/${n}.png`);
['worker1', 'worker2', 'farmer1', 'lumberjack1', 'miner1', 'skeleton', 'zombie', 'goblin', 'goblin_chief',
  'kobold', 'ratfolk', 'bandit', 'demon', 'elf', 'dwarf', 'guard', 'archer',
  'dog_beagle', 'dog_black', 'dog_white', 'dog_shepherd']
  .forEach(n => TA.IMAGES['u_' + n] = `assets/units/${n}.png`);
TA.PARALLAX_SETS = {
  mountains_day: 7, mountains_dusk: 7, mountains_night: 7,
  city_day: 6, city_dusk: 6, city_night: 6,
  spikes: 4, spikes_teal: 4,
};
for (const [k, n] of Object.entries(TA.PARALLAX_SETS))
  for (let i = 0; i < n; i++) TA.IMAGES[`px_${k}_${i}`] = `assets/parallax/${k}_${i}.png`;

// ---------------------------------------------------------------- static sprite rects [img, x, y, w, h]
TA.SPR = {
  // trees (teal)
  tree_t_small: ['starter', 20, 83, 7, 13], tree_t_mid: ['starter', 64, 94, 16, 18],
  tree_t_big: ['starter', 102, 92, 22, 20], tree_t_round: ['starter', 130, 82, 13, 14],
  tree_t_tall: ['starter', 149, 82, 10, 30], tree_t_pine: ['starter', 8, 99, 7, 13],
  tree_t_group: ['starter', 21, 99, 20, 13],
  // trees (olive)
  tree_o_small: ['starter', 20, 115, 7, 13], tree_o_mid: ['starter', 64, 126, 16, 18],
  tree_o_big: ['starter', 102, 124, 22, 20], tree_o_round: ['starter', 130, 114, 13, 14],
  tree_o_tall: ['starter', 148, 114, 10, 30], tree_o_pine: ['starter', 8, 131, 7, 13],
  tree_o_group: ['starter', 21, 131, 20, 13],
  // bushes (forage)
  bush_t: ['starter', 129, 102, 14, 10], bush_t2: ['starter', 82, 101, 12, 11],
  bush_o: ['starter', 82, 133, 12, 11], bush_o2: ['starter', 129, 134, 14, 10],
  // little plants / grass (decor)
  sprig_t1: ['starter', 5, 89, 5, 7], sprig_t2: ['starter', 53, 103, 5, 9], sprig_t3: ['starter', 0, 102, 7, 10],
  sprig_o1: ['starter', 5, 121, 5, 7], sprig_o2: ['starter', 53, 135, 5, 9], sprig_o3: ['starter', 0, 134, 7, 10],
  grass_t: ['starter', 32, 88, 32, 8], grass_o: ['starter', 32, 120, 32, 8],
  // rock mounds (mineable)
  rock_a: ['starter', 118, 153, 25, 7], rock_b: ['starter', 82, 155, 13, 5],
  rock_c: ['starter', 0, 155, 14, 5], rock_d: ['starter', 53, 155, 10, 5],
  // foreground silhouettes
  sil_a: ['starter', 0, 165, 75, 27], sil_b: ['starter', 79, 168, 24, 24], sil_c: ['starter', 102, 168, 47, 24],
  sil_d: ['starter', 151, 167, 7, 25],
  moon: ['starter', 49, 17, 14, 14],
  // old kingdom decor
  k_lamptower: ['starter', 2, 27, 12, 37], k_keep: ['starter', 19, 29, 26, 35], k_temple: ['starter', 98, 22, 26, 42],
  k_house: ['starter', 64, 16, 16, 16], k_houses: ['starter', 64, 35, 32, 13], k_tower: ['starter', 50, 48, 11, 16],
  k_cottage: ['starter', 80, 49, 16, 15], k_shed: ['starter', 67, 56, 11, 8],
  k_shop_med: ['starter', 133, 17, 24, 15], k_shop_magic: ['starter', 132, 33, 24, 15],
  k_shop_plant: ['starter', 132, 50, 24, 14], k_shop_arms: ['starter', 133, 65, 24, 15],
  k_spire: ['starter', 160, 27, 16, 53], k_spire2: ['starter', 176, 27, 16, 53],
  k_arch: ['starter', 160, 117, 31, 11], k_arch2: ['starter', 160, 129, 32, 15],
  k_fence: ['starter', 0, 76, 24, 4], k_pergola: ['starter', 65, 72, 14, 8], k_vines: ['starter', 81, 70, 15, 10],
  // goblin decor
  g_totems: ['goblinTiles', 38, 19, 19, 13], g_hut: ['goblinTiles', 67, 23, 10, 9], g_hut2: ['goblinTiles', 82, 23, 11, 9],
  g_spire: ['goblinTiles', 101, 21, 7, 43], g_tower: ['goblinTiles', 148, 22, 9, 26], g_platform: ['goblinTiles', 164, 28, 24, 20],
  g_fort: ['goblinTiles', 5, 36, 24, 28], g_fort2: ['goblinTiles', 49, 72, 30, 24], g_ruin: ['goblinTiles', 5, 73, 23, 23],
  g_wall: ['goblinTiles', 48, 48, 32, 16], g_tent: ['goblinTiles', 80, 53, 16, 11], g_ladder: ['goblinTiles', 148, 59, 9, 21],
  g_scaffold: ['goblinTiles', 164, 60, 24, 20], g_longwall: ['goblinTiles', 98, 68, 43, 12],
  g_skull: ['goblinTiles', 70, 99, 19, 13], g_skull2: ['goblinTiles', 70, 115, 19, 13], g_bonearch: ['goblinTiles', 37, 117, 21, 11],
  g_ribs: ['goblinTiles', 99, 118, 26, 10], g_ribs2: ['goblinTiles', 131, 118, 26, 10], g_ribs3: ['goblinTiles', 111, 102, 14, 10],
  g_tusk: ['goblinTiles', 37, 101, 5, 11], g_tusk2: ['goblinTiles', 53, 101, 5, 11],
  // elvish decor
  e_temple: ['elvishTiles', 3, 27, 27, 37], e_ped1: ['elvishTiles', 33, 35, 14, 13], e_ped2: ['elvishTiles', 33, 49, 14, 15],
  e_ped3: ['elvishTiles', 33, 66, 14, 14], e_totem: ['elvishTiles', 50, 22, 11, 26], e_totem2: ['elvishTiles', 49, 49, 14, 31],
  e_arcade: ['elvishTiles', 64, 29, 64, 51], e_crystaltower: ['elvishTiles', 165, 22, 20, 74], e_pillar: ['elvishTiles', 138, 33, 12, 63],
  e_house: ['elvishTiles', 6, 73, 20, 23], e_crystalhouse: ['elvishTiles', 37, 82, 21, 30], e_portal: ['elvishTiles', 5, 98, 21, 14],
  e_hedge: ['elvishTiles', 64, 89, 64, 7], e_arches: ['elvishTiles', 64, 103, 48, 9],
};

TA.TREE_SETS = {
  teal: ['tree_t_small', 'tree_t_mid', 'tree_t_big', 'tree_t_round', 'tree_t_tall', 'tree_t_pine', 'tree_t_group'],
  olive: ['tree_o_small', 'tree_o_mid', 'tree_o_big', 'tree_o_round', 'tree_o_tall', 'tree_o_pine', 'tree_o_group'],
};

// ---------------------------------------------------------------- animated unit sheets
// anims: name -> [row, frames, fps, loop]
const CLAN = { idle: [0, 8, 8, 1], walk: [1, 8, 10, 1], attack: [2, 5, 12, 0], block: [3, 4, 8, 0], hit: [4, 3, 10, 0], death: [5, 8, 10, 0] };
TA.SHEETS = {
  player: { img: 'u_worker1', fw: 32, fh: 16, anims: { idle: [0, 8, 7, 1], walk: [1, 8, 11, 1], hit: [2, 3, 10, 0], death: [3, 8, 9, 0] } },
  trader: { img: 'u_worker2', fw: 32, fh: 16, anims: { idle: [0, 8, 7, 1], walk: [1, 8, 9, 1], hit: [2, 3, 10, 0], death: [3, 8, 9, 0] } },
  farmer: { img: 'u_farmer1', fw: 32, fh: 16, anims: { till: [0, 6, 14, 0], water: [1, 6, 12, 0], sow: [2, 6, 14, 0], scythe: [3, 6, 18, 0] } },
  lumber: { img: 'u_lumberjack1', fw: 32, fh: 16, anims: { chop: [0, 8, 16, 0] } },
  miner: { img: 'u_miner1', fw: 32, fh: 16, anims: { mine: [0, 6, 13, 0] } },
  skeleton: { img: 'u_skeleton', fw: 16, fh: 16, anims: CLAN },
  zombie: { img: 'u_zombie', fw: 16, fh: 16, anims: CLAN },
  goblin: { img: 'u_goblin', fw: 16, fh: 16, anims: CLAN },
  goblin_chief: { img: 'u_goblin_chief', fw: 16, fh: 16, anims: CLAN },
  guard: { img: 'u_guard', fw: 16, fh: 16, anims: CLAN },
  archer: { img: 'u_archer', fw: 16, fh: 16, anims: { ...CLAN, hit: [5, 3, 10, 0], death: [6, 8, 10, 0] } },
  kobold: { img: 'u_kobold', fw: 32, fh: 16, anims: CLAN },
  ratfolk: { img: 'u_ratfolk', fw: 32, fh: 16, anims: CLAN },
  elf: { img: 'u_elf', fw: 32, fh: 16, anims: CLAN },
  dwarf: { img: 'u_dwarf', fw: 32, fh: 16, anims: CLAN },
  demon: { img: 'u_demon', fw: 32, fh: 16, anims: { ...CLAN, block: [4, 4, 8, 0], hit: [5, 3, 10, 0], death: [6, 8, 10, 0] } },
  bandit: { img: 'u_bandit', fw: 32, fh: 16, anims: { ...CLAN, block: [5, 4, 8, 0], hit: [6, 3, 10, 0], death: [7, 8, 10, 0] } },
};
const DOG = { move: [0, 4, 10, 1], idle: [1, 3, 5, 1], interact: [2, 2, 6, 1], bark: [5, 2, 6, 0], stretch: [6, 6, 8, 0],
  sit: [7, 2, 6, 0], sitidle: [8, 9, 5, 1], sitbark: [9, 2, 6, 0], sleep: [12, 3, 4, 0], sleepidle: [13, 1, 2, 1] };
['beagle', 'black', 'white', 'shepherd'].forEach(c => TA.SHEETS['dog_' + c] = { img: 'u_dog_' + c, fw: 16, fh: 16, anims: DOG });

// ---------------------------------------------------------------- buildings (18 frame spawn sheets)
TA.BSHEET = {
  hut: ['b_hut', 32, 32], market: ['b_market', 32, 32], armory: ['b_armory', 32, 32], defense: ['b_defense', 32, 32],
  lighttower: ['b_lighttower', 32, 48], watchtower: ['b_watchtower', 32, 32], barracks: ['b_barracks', 64, 48],
  manor: ['b_manor', 64, 48], spire: ['b_spire', 16, 64], wall: ['b_wall', 32, 32], wall2: ['b_wall2', 32, 32],
  ruin1: ['b_ruin1', 16, 32], ruin2: ['b_ruin2', 32, 32], ruingate: ['b_ruingate', 32, 32], ruintower: ['b_ruintower', 16, 48],
  elf1: ['b_elf1', 32, 32], elf2: ['b_elf2', 32, 32], elf4: ['b_elf4', 32, 80], elf6: ['b_elf6', 32, 32], elf7: ['b_elf7', 16, 32],
};

// What the player can build. `need` = what must already stand in the claim.
TA.BUILDABLE = {
  banner: { name: 'Banner', desc: 'Claim the land around you. Your homestead starts here.', cost: { wood: 6 }, width: 18 },
  hut: { name: 'Hut', desc: 'Sleep through the night, save, and wake here if you fall.', cost: { wood: 12, stone: 4 }, width: 32 },
  market: { name: 'Market', desc: 'Sell your harvest any time.', cost: { wood: 14, stone: 6 }, width: 32, need: 'hut' },
  lighttower: { name: 'Light Tower', desc: 'Lights the homestead. Night creatures will not enter its glow.', cost: { wood: 10, stone: 14 }, width: 24, need: 'hut' },
  watchtower: { name: 'Watchtower', desc: 'An archer keeps watch and shoots creatures that come close.', cost: { wood: 18, stone: 10, coin: 20 }, width: 26, need: 'hut' },
  armory: { name: 'Armory', desc: 'Upgrade your scythe, axe and pickaxe.', cost: { wood: 20, stone: 16, coin: 30 }, width: 32, need: 'market' },
  wall: { name: 'Wall', desc: 'Built at the edge of your land. Blocks creatures until broken.', cost: { stone: 10 }, width: 32, need: 'hut', edge: true },
  barracks: { name: 'Barracks', desc: 'A guard patrols your land day and night.', cost: { wood: 30, stone: 24, coin: 80 }, width: 60, need: 'armory' },
  manor: { name: 'Manor', desc: 'Widens your claim and marks you as lord of these lands.', cost: { wood: 50, stone: 40, coin: 150, gem: 2 }, width: 60, need: 'barracks' },
};
TA.BUILD_ORDER = ['banner', 'hut', 'market', 'lighttower', 'watchtower', 'wall', 'armory', 'barracks', 'manor'];

// ---------------------------------------------------------------- crops & items
// days = in-game days to ripen when watered every day
TA.CROPS = {
  wheat: { name: 'Wheat', row: 0, days: 1.5, sell: 5, seedCost: 2, seedsBack: [1, 2] },
  carrot: { name: 'Carrot', row: 1, days: 2, sell: 9, seedCost: 3, seedsBack: [1, 2] },
  pumpkin: { name: 'Pumpkin', row: 2, days: 3.5, sell: 22, seedCost: 6, seedsBack: [0, 2] },
  berry: { name: 'Starberry', row: 3, days: 2.5, sell: 14, seedCost: 5, seedsBack: [1, 1], regrow: 3 },
  moonflower: { name: 'Moonflower', row: 4, days: 4, sell: 45, seedCost: 18, seedsBack: [0, 1], glow: true },
};
TA.CROP_ORDER = ['wheat', 'carrot', 'pumpkin', 'berry', 'moonflower'];

// icon: ['icons', index] in the generated sheet or a standalone image key
TA.ICON_NAMES = ['wood', 'stone', 'fiber', 'wheat', 'carrot', 'pumpkin', 'berry', 'moonflower', 'heart', 'heart_empty',
  'hoe', 'scythe', 'axe', 'pick', 'can', 'banner', 'sun', 'moon',
  'seed_wheat', 'seed_carrot', 'seed_pumpkin', 'seed_berry', 'seed_moonflower'];
TA.ITEMS = {
  coin: { name: 'Coins', img: 'coin' },
  wood: { name: 'Wood', icon: 'wood', sell: 1 },
  stone: { name: 'Stone', icon: 'stone', sell: 1 },
  fiber: { name: 'Fiber', icon: 'fiber', sell: 1 },
  gem: { name: 'Gem', img: 'gem', sell: 30 },
  mushroom: { name: 'Mushroom', img: 'mushroom', sell: 4 },
  meat: { name: 'Jerky', img: 'meat', sell: 6, heal: 2 },
  potion: { name: 'Tonic', img: 'potion', sell: 10, heal: 5 },
};
for (const [k, c] of Object.entries(TA.CROPS)) {
  TA.ITEMS[k] = { name: c.name, icon: k, sell: c.sell, heal: k === 'berry' ? 1 : 0, produce: true };
  TA.ITEMS['seed_' + k] = { name: c.name + ' seeds', icon: 'seed_' + k, seed: k };
}

// ---------------------------------------------------------------- biomes
// tileset: which sheet's row-0 ground tiles to use. parallax: base set name (day/dusk/night variants if present)
TA.BIOMES = {
  meadow: {
    name: 'Greenmeadow', tiles: 'starter', parallax: 'mountains', color: '#4bb0a5', fertility: 1.0,
    trees: { teal: 0.75, olive: 0.25 }, treeDensity: 0.55, rockDensity: 0.2, bushDensity: 0.25,
    night: ['zombie', 'skeleton'], day: [], danger: 1, pois: ['camp', 'village', 'ruin', 'dog'],
  },
  woods: {
    name: 'Amberwood', tiles: 'starter', parallax: 'mountains', color: '#a2a947', fertility: 0.9,
    trees: { teal: 0.25, olive: 0.75 }, treeDensity: 1.0, rockDensity: 0.25, bushDensity: 0.45, mushrooms: true,
    night: ['kobold', 'ratfolk', 'skeleton'], day: [], danger: 2, pois: ['ruin', 'dwarves', 'camp', 'dog'],
  },
  kingdom: {
    name: 'Fallen Kingdom', tiles: 'starter', parallax: 'city', color: '#c8ac99', fertility: 0.8,
    trees: { teal: 0.5, olive: 0.5 }, treeDensity: 0.3, rockDensity: 0.4, bushDensity: 0.15,
    night: ['skeleton', 'zombie', 'bandit'], day: ['bandit'], danger: 2, pois: ['town', 'ruin', 'village'],
  },
  elvish: {
    name: 'Elderglade', tiles: 'elvishTiles', parallax: 'spikes_teal', color: '#30e1b9', fertility: 1.35,
    trees: { teal: 0.85, olive: 0.15 }, treeDensity: 0.8, rockDensity: 0.15, bushDensity: 0.4,
    night: ['skeleton'], day: [], danger: 1, pois: ['grove', 'ruin'],
  },
  badlands: {
    name: 'Goblin Barrens', tiles: 'goblinTiles', parallax: 'spikes', color: '#cd683d', fertility: 0.5,
    trees: { teal: 0.1, olive: 0.9 }, treeDensity: 0.2, rockDensity: 0.8, bushDensity: 0.1, gems: true,
    night: ['goblin', 'demon', 'skeleton'], day: ['goblin'], danger: 3, pois: ['warcamp', 'camp', 'bones'],
  },
};

// ---------------------------------------------------------------- creatures
TA.MOBS = {
  zombie: { sheet: 'zombie', hp: 3, dmg: 1, speed: 14, reach: 9, aggro: 110, loot: { coin: [0, 2], fiber: [0, 1] }, undead: true },
  skeleton: { sheet: 'skeleton', hp: 4, dmg: 1, speed: 20, reach: 10, aggro: 130, loot: { coin: [1, 3], stone: [0, 1] }, undead: true },
  kobold: { sheet: 'kobold', hp: 3, dmg: 1, speed: 26, reach: 10, aggro: 120, loot: { coin: [1, 4] } },
  ratfolk: { sheet: 'ratfolk', hp: 3, dmg: 1, speed: 30, reach: 10, aggro: 120, loot: { coin: [1, 3], meat: [0, 1] } },
  goblin: { sheet: 'goblin', hp: 4, dmg: 1, speed: 24, reach: 13, aggro: 140, loot: { coin: [2, 5], meat: [0, 1] } },
  goblin_chief: { sheet: 'goblin_chief', hp: 9, dmg: 2, speed: 18, reach: 12, aggro: 150, loot: { coin: [10, 20], gem: [0, 1] } },
  bandit: { sheet: 'bandit', hp: 5, dmg: 1, speed: 28, reach: 11, aggro: 140, loot: { coin: [3, 8] } },
  demon: { sheet: 'demon', hp: 10, dmg: 2, speed: 22, reach: 13, aggro: 160, loot: { coin: [8, 16], gem: [0, 1] } },
};

// ---------------------------------------------------------------- traders
TA.SHOPS = {
  trader: { name: 'Wandering Trader', sells: ['seed_wheat', 'seed_carrot', 'seed_pumpkin', 'seed_berry', 'meat'],
    prices: { meat: 8 }, buys: true },
  elf: { name: 'Elder of the Glade', sells: ['seed_moonflower', 'seed_berry', 'potion'], prices: { potion: 15 }, buys: true },
  dwarf: { name: 'Dwarf Prospector', sells: ['potion', 'seed_carrot'], prices: { potion: 12 }, buys: true, stoneBonus: true },
};

TA.UPGRADES = {
  scythe: { name: 'Scythe', levels: [0, 25, 60], desc: 'More damage to creatures' },
  axe: { name: 'Axe', levels: [0, 20, 50], desc: 'Fell trees in fewer swings' },
  pick: { name: 'Pickaxe', levels: [0, 20, 50], desc: 'Break rocks in fewer swings' },
};
