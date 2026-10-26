// ============================================================================
// Game data: sprite rects, animations, biomes, crops, items, buildings, mobs.
// Everything tunable lives here.
// ============================================================================
window.TA = window.TA || {};

TA.DAY_SECONDS = 420;          // real seconds per in-game day
TA.START_HOUR = 7.5;
TA.CHUNK = 256;                // world chunk width (px)
TA.REGION = 2400;              // biome region width (px)
TA.BLEND = 300;                // half width of the band where two biomes mix
TA.CLAIM_RADIUS = 176;         // land claimed by a banner, each side
TA.CLIFF_W = 22;               // half width of the rock walls around hidden biomes
TA.STALL_PREMIUM = 1.25;       // travellers pay this much over market price at your stall

// Movement (px, px/s, px/s^2). Heights are measured up from the surface, or
// up from the bottom of the caves when underground.
TA.GRAVITY = 420;
TA.JUMP_V = 172;               // apex ~35px: clears a 24px ledge, not a 32px one
TA.STEP_UP = 8;                // ledges this low are walked onto
TA.PLAYER_H = 13;
// The caves lie this far below the surface, in the same space: the ground is a
// TA.CRUST thick crust over solid earth, and shafts are holes TA.HOLE either side
// of their centre, covered by a trapdoor you drop through.
TA.CAVE_DEPTH = 240;
TA.CRUST = 16;
TA.HOLE = 12;

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
  caveTiles: 'assets/art/cave_tiles.png',
  caveVeg: 'assets/cave/vegetation.png',
};
['hut', 'market', 'armory', 'defense', 'lighttower', 'watchtower', 'barracks', 'manor', 'spire',
  'wall', 'wall2', 'ruin1', 'ruin2', 'ruingate', 'ruintower', 'elf1', 'elf2', 'elf4', 'elf6', 'elf7']
  .forEach(n => TA.IMAGES['b_' + n] = `assets/buildings/${n}.png`);
['worker1', 'worker2', 'farmer1', 'lumberjack1', 'miner1', 'skeleton', 'zombie', 'goblin', 'goblin_chief',
  'kobold', 'ratfolk', 'bandit', 'demon', 'elf', 'dwarf', 'guard', 'archer',
  'dog_beagle', 'dog_black', 'dog_white', 'dog_shepherd', 'spearman', 'wizard', 'smith', 'farmer2', 'lumber2', 'miner2',
  'folk_blue', 'folk_green', 'folk_red', 'folk_plum']
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
  // cave vegetation: roots hanging from the roof, tufts, glowing blooms
  root_a: ['caveVeg', 0, 0, 15, 19], root_b: ['caveVeg', 21, 0, 21, 21], root_c: ['caveVeg', 48, 0, 16, 22],
  root_d: ['caveVeg', 96, 0, 14, 21], root_e: ['caveVeg', 68, 16, 6, 11], root_f: ['caveVeg', 67, 0, 26, 5],
  tuft_a: ['caveVeg', 1, 42, 14, 6], tuft_b: ['caveVeg', 18, 39, 12, 9], tuft_c: ['caveVeg', 1, 59, 14, 5], tuft_d: ['caveVeg', 18, 55, 12, 9],
  bloom_a: ['caveVeg', 34, 35, 14, 13], bloom_b: ['caveVeg', 51, 37, 11, 11], bloom_c: ['caveVeg', 101, 37, 11, 11], bloom_d: ['caveVeg', 112, 37, 11, 11],
  bloom_e: ['caveVeg', 48, 49, 15, 15], bloom_f: ['caveVeg', 113, 49, 15, 15], bloom_g: ['caveVeg', 83, 50, 27, 14],
  vmush: ['caveVeg', 37, 58, 6, 6],
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
const FOLK = { idle: [0, 8, 7, 1], walk: [1, 8, 9, 1], hit: [2, 3, 10, 0], death: [3, 8, 9, 0] };
for (const c of ['blue', 'green', 'red', 'plum']) TA.SHEETS['folk_' + c] = { img: 'u_folk_' + c, fw: 32, fh: 16, anims: FOLK };
TA.SHEETS.spearman = { img: 'u_spearman', fw: 16, fh: 16, anims: { ...CLAN, hit: [4, 3, 10, 0], death: [5, 8, 10, 0] } };
TA.SHEETS.wizard = { img: 'u_wizard', fw: 16, fh: 16, anims: { ...CLAN, hit: [4, 3, 10, 0], death: [5, 8, 10, 0] } };
// townsfolk at work: one looping anim each
TA.SHEETS.smith = { img: 'u_smith', fw: 32, fh: 16, anims: { idle: [0, 4, 7, 1], work: [0, 4, 7, 1] } };
TA.SHEETS.farmer2 = { img: 'u_farmer2', fw: 32, fh: 16, anims: { idle: [0, 6, 8, 1], work: [0, 6, 8, 1], water: [1, 6, 8, 1] } };
TA.SHEETS.lumber2 = { img: 'u_lumber2', fw: 32, fh: 16, anims: { idle: [0, 8, 10, 1], work: [0, 8, 10, 1] } };
TA.SHEETS.miner2 = { img: 'u_miner2', fw: 32, fh: 16, anims: { idle: [0, 6, 9, 1], work: [0, 6, 9, 1] } };
// who walks the streets
TA.WALKERS = ['folk_blue', 'folk_green', 'folk_red', 'folk_plum', 'trader', 'wizard'];
TA.TRAVELLERS = ['trader', 'folk_blue', 'folk_green', 'folk_plum', 'elf', 'dwarf', 'wizard'];
TA.FOLK_LINES = [
  'Lovely weather for it.', 'Mind the dark, friend. Things walk at night.', 'The old caves run under everything, they say.',
  'My gran swore she saw a portal humming in some ruins.', 'Travellers pay well for fresh produce.',
  'There is a valley past the cliffs that no road reaches.', 'Fresh bread! ...oh, sold out.', 'Have you tried jumping? Builds character.',
  'Watchtowers hold more archers once you build them up.', 'The market stalls fill up on fair days.',
];

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
  watchtower: { name: 'Watchtower', desc: 'Archers shoot from its windows at creatures that come close. Upgrade it for more archers.', cost: { wood: 18, stone: 10, coin: 20 }, width: 26, need: 'hut' },
  armory: { name: 'Armory', desc: 'Upgrade your scythe, axe and pickaxe.', cost: { wood: 20, stone: 16, coin: 30 }, width: 32, need: 'market' },
  wall: { name: 'Wall', desc: 'Built at the edge of your land. Blocks creatures until broken.', cost: { stone: 10 }, width: 32, need: 'hut', edge: true },
  barracks: { name: 'Barracks', desc: 'A guard patrols your land day and night.', cost: { wood: 30, stone: 24, coin: 80 }, width: 60, need: 'armory' },
  manor: { name: 'Manor', desc: 'Widens your claim and marks you as lord of these lands.', cost: { wood: 50, stone: 40, coin: 150, gem: 2 }, width: 60, need: 'barracks' },
};
// Watchtower levels: archers stationed (one per window) and the cost to reach that level
TA.TOWER_LEVELS = [null,
  { archers: 1 },
  { archers: 2, cost: { wood: 14, stone: 12, coin: 40 } },
  { archers: 3, cost: { wood: 20, stone: 18, coin: 90, gem: 1 } },
];
// Window positions on the tower sprite: [x offset from centre, height above ground]
TA.TOWER_WINDOWS = [[-2, 8], [3, 8], [-2, 5]];
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
    name: 'Greenmeadow', tiles: 'starter', parallax: 'mountains', color: '#4bb0a5', fertility: 1.0, grade: ['#000000', 0],
    trees: { teal: 0.75, olive: 0.25 }, treeDensity: 0.55, rockDensity: 0.2, bushDensity: 0.25,
    night: ['zombie', 'skeleton'], day: [], danger: 1, pois: ['village', 'village', 'camp', 'ruin', 'dog', 'town'], cave: { caverns: 3, fungal: 1 },
  },
  woods: {
    name: 'Amberwood', tiles: 'starter', parallax: 'mountains', color: '#a2a947', fertility: 0.9, grade: ['#d9a44a', 0.14],
    trees: { teal: 0.25, olive: 0.75 }, treeDensity: 1.0, rockDensity: 0.25, bushDensity: 0.45, mushrooms: true,
    night: ['kobold', 'ratfolk', 'skeleton'], day: [], danger: 2, pois: ['ruin', 'dwarves', 'camp', 'dog', 'village'], cave: { fungal: 3, caverns: 2 },
  },
  kingdom: {
    name: 'Fallen Kingdom', tiles: 'starter', parallax: 'city', color: '#c8ac99', fertility: 0.8, grade: ['#c8ac99', 0.12],
    trees: { teal: 0.5, olive: 0.5 }, treeDensity: 0.3, rockDensity: 0.4, bushDensity: 0.15,
    night: ['skeleton', 'zombie', 'bandit'], day: ['bandit'], danger: 2, pois: ['city', 'town', 'ruin', 'village'], cave: { bones: 2, caverns: 2 },
  },
  elvish: {
    name: 'Elderglade', tiles: 'elvishTiles', parallax: 'spikes_teal', color: '#30e1b9', fertility: 1.35, grade: ['#30e1b9', 0.12],
    trees: { teal: 0.85, olive: 0.15 }, treeDensity: 0.8, rockDensity: 0.15, bushDensity: 0.4,
    night: ['skeleton'], day: [], danger: 1, pois: ['grove', 'ruin', 'village'], cave: { crystal: 3, fungal: 2 },
  },
  badlands: {
    name: 'Goblin Barrens', tiles: 'goblinTiles', parallax: 'spikes', color: '#cd683d', fertility: 0.5, grade: ['#e6904e', 0.2],
    trees: { teal: 0.1, olive: 0.9 }, treeDensity: 0.2, rockDensity: 0.8, bushDensity: 0.1, gems: true,
    night: ['goblin', 'demon', 'skeleton'], day: ['goblin'], danger: 3, pois: ['warcamp', 'camp', 'bones', 'ruin'], cave: { bones: 3, caverns: 1 },
  },
  // Hidden biomes: walled in by cliffs, reached only through the caves (or a lucky portal)
  vale: {
    name: 'Lost Vale', tiles: 'elvishTiles', parallax: 'spikes_teal', color: '#a884f3', fertility: 1.7, grade: ['#a884f3', 0.18], hidden: true,
    trees: { teal: 0.9, olive: 0.1 }, treeDensity: 0.9, rockDensity: 0.3, bushDensity: 0.6, mushrooms: true, gems: true,
    night: [], day: [], danger: 0, pois: ['shrine', 'grove'], cave: { crystal: 1 },
  },
  crater: {
    name: 'Ember Crater', tiles: 'goblinTiles', parallax: 'spikes', color: '#f68181', fertility: 0.7, grade: ['#e83b3b', 0.2], hidden: true,
    trees: { teal: 0, olive: 1 }, treeDensity: 0.15, rockDensity: 1.2, bushDensity: 0.1, gems: true, richRocks: true,
    night: ['demon', 'skeleton'], day: ['skeleton'], danger: 4, pois: ['shrine', 'bones'], cave: { crystal: 1 },
  },
};

// Underground biomes. pal = which recolour of the cave tileset (rows of
// assets/art/cave_tiles.png); bg = the colour of open cave air.
// rocks / blooms / shrooms = how much of each is on the floor, rich = share of gem-rich ore
TA.CAVE_BIOMES = {
  caverns: { name: 'Echo Caverns', pal: 0, color: '#9babb2', bg: '#17172a', rocks: 0.5, rich: 0.1, blooms: 0.15, shrooms: 0.1, mobs: ['skeleton', 'ratfolk'] },
  crystal: { name: 'Crystal Depths', pal: 1, color: '#a884f3', bg: '#1b1229', rocks: 0.55, rich: 0.6, blooms: 0.2, shrooms: 0.05, mobs: ['skeleton', 'kobold'] },
  fungal: { name: 'Fungal Grotto', pal: 2, color: '#1ebc73', bg: '#0f1a1d', rocks: 0.25, rich: 0.05, blooms: 0.6, shrooms: 0.4, mobs: ['zombie', 'ratfolk'] },
  bones: { name: 'Bone Pits', pal: 3, color: '#c8ac99', bg: '#1d1418', rocks: 0.4, rich: 0.1, blooms: 0.05, shrooms: 0.1, mobs: ['skeleton', 'zombie', 'bandit'] },
};
TA.CLIFF_PAL = 4;

// Weather. tone: [multiply colour, strength], sat = how much colour drains away,
// sky = grey wash over the sky, warm = golden soft-light
TA.WEATHER = {
  clear: { name: '', weight: 34 },
  sunny: { name: 'sunny', weight: 14, warm: 0.3, sat: -0.15 },
  overcast: { name: 'overcast', weight: 16, tone: ['#b7bccb', 0.5], sat: 0.25, sky: 0.3 },
  rain: { name: 'rain', weight: 16, tone: ['#8f9ab5', 0.75], sat: 0.4, sky: 0.5, rain: 90 },
  storm: { name: 'storm', weight: 7, tone: ['#6b7591', 0.85], sat: 0.55, sky: 0.7, rain: 170, lightning: true },
  fog: { name: 'fog', weight: 13, fog: 0.42, sat: 0.35, sky: 0.2, morning: true },
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
  hermit: { name: 'Vale Hermit', sells: ['seed_moonflower', 'seed_pumpkin', 'potion'], prices: { potion: 10, seed_moonflower: 10 }, buys: true },
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
