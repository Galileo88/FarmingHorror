// All the game art, drawn as text so it is easy to read and edit.
// Each letter is one pixel; see palette.js for which color each letter is.
// Swap any of these for a PNG later (e.g. from Sunnyside World) by loading
// an image with the same texture key in scenes/boot.js.

(function () {
  const mirror = (rows) => rows.map((r) => r.split('').reverse().join(''));
  const blank = (n) => Array.from({ length: n }, () => '................');

  // ---------- Farmer ----------
  const hatDown = [
    '................',
    '......kkkk......',
    '.....kmMMmk.....',
    '....kmmmmmmk....',
    '..kkkkkkkkkkkk..'
  ];
  const farmerDownA = hatDown.concat([
    '....kssssssk....',
    '....kskssksk....',
    '....kRssssRk....',
    '...krrkSSkrrk...',
    '..krrCccccCrrk..',
    '..kskccccccksk..',
    '....kccCCcck....',
    '....kcccccck....',
    '....kcckkcck....',
    '....kBBkkBBk....',
    '.....kk..kk.....'
  ]);
  const farmerDownB = farmerDownA.slice(0, 13).concat([
    '....kBBkkcck....',
    '.....kk.kBBk....',
    '.........kk.....'
  ]);
  const farmerUpA = hatDown.concat([
    '....knnnnnnk....',
    '....knnnnnnk....',
    '....kSnnnnSk....',
    '...krrkSSkrrk...',
    '..krrcrrrrcrrk..',
    '..kskcrrrrcksk..',
    '....kcccccck....',
    '....kcccccck....',
    '....kcckkcck....',
    '....kBBkkBBk....',
    '.....kk..kk.....'
  ]);
  const farmerUpB = farmerUpA.slice(0, 13).concat([
    '....kBBkkcck....',
    '.....kk.kBBk....',
    '.........kk.....'
  ]);
  const farmerSideA = [
    '................',
    '.......kkkk.....',
    '......kmMMmk....',
    '.....kmmmmmmk...',
    '...kkkkkkkkkkkk.',
    '.....knsssssk...',
    '.....knsssksk...',
    '.....ksssRsssk..',
    '......kSSSSk....',
    '.....kcrrrck....',
    '.....kcrsrck....',
    '.....kccscck....',
    '.....kccccck....',
    '.....kcckcck....',
    '.....kBBBkBBBk..',
    '.....kkkk.kkkk..'
  ];
  const farmerSideB = farmerSideA.slice(0, 13).concat([
    '....kcck.kcck...',
    '...kBBBk.kBBBk..',
    '...kkkk...kkkk..'
  ]);

  // ---------- Crops (4 stages: seed, sprout, growing, ripe) ----------
  const seedMound = blank(11).concat([
    '................',
    '.....kkkkkk.....',
    '....kbnBnbBk....',
    '................',
    '................'
  ]);
  const carrot1 = blank(10).concat([
    '................',
    '......L..L......',
    '......lL.l......',
    '.......ll.......',
    '.......hh.......',
    '................'
  ]);
  const carrot2 = blank(6).concat([
    '................',
    '.......L........',
    '.....L.lL.L.....',
    '.....lLlllL.....',
    '....L.lllll.L...',
    '....llLlllLll...',
    '.....lllhlll....',
    '......lhhhl.....',
    '.......hhh......',
    '................'
  ]);
  const carrot3 = blank(2).concat([
    '.......L........',
    '.....L.lL.L.....',
    '.....lLlllL.....',
    '....L.lllll.L...',
    '....llLlllLll...',
    '.....lllhlll....',
    '......lhhhl.....',
    '......khhhk.....',
    '.....kOOOook....',
    '.....kOoooook...',
    '.....koooook....',
    '......kooook....',
    '.......kook.....',
    '........kk......'
  ]);
  const pumpkin1 = blank(10).concat([
    '................',
    '.....ll..ll.....',
    '....lLLllLLl....',
    '......lhhl......',
    '.......hh.......',
    '................'
  ]);
  const pumpkin2 = blank(6).concat([
    '................',
    '......l.........',
    '.....lLl..ll....',
    '....lLLLllLLl...',
    '.....lll.lll....',
    '......kkkkk.....',
    '.....kGlGlGk....',
    '....klGlGlGlk...',
    '....klglglglk...',
    '.....kkkkkkk....'
  ]);
  const pumpkin3 = blank(3).concat([
    '........hk......',
    '.....lLhhk......',
    '...kkkkhkkkkk...',
    '..kOOdOOOdOOok..',
    '.kOOOdOOOdOOook.',
    '.kOOOdOOOdOOook.',
    '.koOOdOOOdOoodk.',
    '.kooodoooddoddk.',
    '..kddoodddoddk..',
    '...kkkkkkkkkk...',
    '................',
    '................',
    '................'
  ]);

  // ---------- Crow (side view, facing right) ----------
  const crowStand = blank(6).concat([
    '..........kkk...',
    '.........kuUuk..',
    '.........kuiuqq.',
    '...kkkkkkkuuuk..',
    '..kuuUUuuuuuk...',
    '.kuuuUUUuuuuk...',
    'kuukuuuuuuuk....',
    '.kk.kkuuuukk....',
    '......kq.kq.....',
    '......q..q......'
  ]);
  const crowPeck = blank(9).concat([
    '...kkkkkkkk.....',
    '..kuuUUuuuuk....',
    '.kuuuUUUuuuukkk.',
    'kuukuuuuuuuukuuk',
    '.kk.kkuuuukkuiuk',
    '......kq.kq...qq',
    '......q..q......'
  ]);
  const crowFlyUp = blank(3).concat([
    '.....kkk........',
    '.....kuUk.......',
    '......kuUk......',
    '.......kuuk.kkk.',
    '........kuukuUuk',
    '..kkkkkkkuuuuiuq',
    '.kuuuuuuuuuuuk..',
    'kuukuuuuuuuuk...',
    '.kk.kkkkkkkk....',
    '................',
    '................',
    '................',
    '................'
  ]);
  const crowFlyDown = blank(6).concat([
    '...........kkk..',
    '..........kuUuk.',
    '..kkkkkkkkkuuiuq',
    '.kuuuuuuuuuuuk..',
    'kuukuuuuuuuuk...',
    '.kk.kkuuuukkk...',
    '......kuuUk.....',
    '.......kuUk.....',
    '........kk......',
    '................'
  ]);

  // ---------- Zombie (side view, facing right) ----------
  const zombieHead = [
    '................',
    '................',
    '......kkkkk.....',
    '.....kxzxzzk....',
    '.....kzzzzzk....',
    '.....kzzzizk....',
    '.....kzZzzzk....',
    '......kzxzk.....'
  ];
  const zombieA = zombieHead.concat([
    '.....kvvvvkkkkk.',
    '.....kvVvvzzzzZk',
    '.....kvvvvkkkkk.',
    '.....kvvvvk.....',
    '.....kVvvvk.....',
    '.....kqqkqqk....',
    '.....kqqkqqk....',
    '.....kkk.kkk....'
  ]);
  const zombieB = zombieHead.concat([
    '.....kvvvvk.....',
    '.....kvvvvkkkkk.',
    '.....kvVvvzzzzZk',
    '.....kvvvvkkkkk.',
    '.....kVvvvk.....',
    '.....kqqkqqk....',
    '....kqqk.kqqk...',
    '....kkk...kkk...'
  ]);

  // ---------- Placeables & scenery ----------
  const scarecrow = [
    '......kkkk......',
    '.....kttttk.....',
    '...kkkkkkkkkk...',
    '.....kaaaak.....',
    '.....kkaakk.....',
    '.....kakkak.....',
    '.....kaaaak.....',
    '.kkkkkrrrrkkkkk.',
    'MkrRrRrRRrRrRrkM',
    'mkkkkkrRRrkkkkkm',
    '.....krRRrk.....',
    '.....krrrrk.....',
    '.....kmMmMk.....',
    '.......nn.......',
    '.......nn.......',
    '......knnk......'
  ];
  const lantern = [
    '................',
    '................',
    '................',
    '.......kk.......',
    '......k..k......',
    '.....kkkkkk.....',
    '.....kfYYfk.....',
    '.....kYyyYk.....',
    '.....kYyyYk.....',
    '.....kfYYfk.....',
    '.....kkkkkk.....',
    '.......nn.......',
    '.......nn.......',
    '.......nn.......',
    '......knnk......',
    '.....kkkkkk.....'
  ];
  const fence = [
    '................',
    '................',
    '................',
    '................',
    '..kk........kk..',
    '.kNnk......kNnk.',
    'kkNnkkkkkkkkNnkk',
    'NNNnNNNNNNNNNnNN',
    'nnNnnnnnnnnnNnnn',
    'kkNnkkkkkkkkNnkk',
    '.kNnk......kNnk.',
    'kkNnkkkkkkkkNnkk',
    'NNNnNNNNNNNNNnNN',
    'nnNnnnnnnnnnNnnn',
    'kkNnkkkkkkkkNnkk',
    '.kkkk......kkkk.'
  ];
  const tombstone = [
    '................',
    '................',
    '.....kkkkkk.....',
    '....kPPPPPpk....',
    '...kPPpppppqk...',
    '...kPpkkkppqk...',
    '...kPpppppqqk...',
    '...kPpkkkppqk...',
    '...kPpppppqqk...',
    '...kPppppppqk...',
    '...kPpppppqqk...',
    '...kpppppqqqk...',
    '..kkkkkkkkkkkk..',
    '..kbBbBbbBbBbk..',
    '...kkkkkkkkkk...',
    '................'
  ];
  const deadTree = [
    '..k.......k.....',
    '..kk.....kk..k..',
    '...kk...kk..kk..',
    '....kk.kk..kk...',
    '.k...kkk..kk....',
    '.kk...kkkkk.....',
    '..kk..kKk.......',
    '...kkkKk........',
    '.....kKk........',
    '.....kKKk.......',
    '.....kKKk.......',
    '....kKKKKk......',
    '...kKkKKkKk.....',
    '..kk.kKKk.kk....',
    '.....kkkk.......',
    '................'
  ];

  // ---------- Icons ----------
  const hoe = [
    '................',
    '...........kkkk.',
    '..........kFFfk.',
    '..........kkkfk.',
    '.........knk.kk.',
    '........knk.....',
    '.......knk......',
    '......knk.......',
    '.....knk........',
    '....knk.........',
    '...knk..........',
    '..knk...........',
    '..kk............',
    '................',
    '................',
    '................'
  ];
  const shovel = [
    '................',
    '...........kkkk.',
    '...........knnk.',
    '..........knk...',
    '.........knk....',
    '........knk.....',
    '.......knk......',
    '..kkk.knk.......',
    '.kFFfkkk........',
    '.kFFFfk.........',
    '.kFFffk.........',
    '..kffk..........',
    '...kk...........',
    '................',
    '................',
    '................'
  ];
  const can = [
    '................',
    '................',
    '................',
    '................',
    '....kkkk........',
    '...k....k.......',
    '..kkkkkkkk...kk.',
    '..kCCCCCCk..kCk.',
    '..kCccccckkkCk..',
    '..kCcccccCCk....',
    '..kCccccck......',
    '..kcccccck......',
    '..kkkkkkkk......',
    '................',
    '................',
    '................'
  ];
  const seedCarrot = [
    '................',
    '................',
    '...kkkkkkkkk....',
    '...kAAAAAAAk....',
    '...kAkkkkkAk....',
    '...kAAAlAAAk....',
    '...kAAlLlAAk....',
    '...kAAAoAAAk....',
    '...kAAOoAAAk....',
    '...kAAAoAAAk....',
    '...kAAAoAAAk....',
    '...kAAAAAAAk....',
    '...kkkkkkkkk....',
    '................',
    '................',
    '................'
  ];
  const seedPumpkin = [
    '................',
    '................',
    '...kkkkkkkkk....',
    '...kAAAAAAAk....',
    '...kAkkkkkAk....',
    '...kAAAhAAAk....',
    '...kAAkkkAAk....',
    '...kAkOoOkAk....',
    '...kAkoOokAk....',
    '...kAkdodkAk....',
    '...kAAkkkAAk....',
    '...kAAAAAAAk....',
    '...kkkkkkkkk....',
    '................',
    '................',
    '................'
  ];
  const coin = [
    '..kkkk..',
    '.kyYYyk.',
    'kyYyyyyk',
    'kyYyyyyk',
    'kyyyyyOk',
    'kyyyyOOk',
    '.kOOOOk.',
    '..kkkk..'
  ];
  const heart = [
    '.kk.kk..',
    'kRRkrrk.',
    'kRrrrrk.',
    'krrrrrk.',
    '.krrrk..',
    '..krk...',
    '...k....',
    '........'
  ];
  const heartEmpty = heart.map((r) => r.replace(/[rR]/g, 'K'));
  const sun = [
    '...y....',
    '.y.y.y..',
    '..yyy...',
    'yyyYyyy.',
    '..yyy...',
    '.y.y.y..',
    '...y....',
    '........'
  ];
  const moon = [
    '..PPP...',
    '.PPp....',
    'PPp.....',
    'PPp.....',
    'PPp.....',
    '.PPp..p.',
    '..PPPP..',
    '........'
  ];
  const feather = ['.u', 'uU'];

  FH.SPRITES = {
    farmer: { w: 16, h: 16, frames: [
      farmerDownA, farmerDownB, mirror(farmerDownB),   // 0-2 down
      farmerUpA, farmerUpB, mirror(farmerUpB),         // 3-5 up
      farmerSideA, farmerSideB                         // 6-7 side (faces right)
    ] },
    carrot: { w: 16, h: 16, frames: [seedMound, carrot1, carrot2, carrot3] },
    pumpkin: { w: 16, h: 16, frames: [seedMound, pumpkin1, pumpkin2, pumpkin3] },
    crow: { w: 16, h: 16, frames: [crowStand, crowPeck, crowFlyUp, crowFlyDown] },
    zombie: { w: 16, h: 16, frames: [zombieA, zombieB] },
    scarecrow: { w: 16, h: 16, frames: [scarecrow] },
    lantern: { w: 16, h: 16, frames: [lantern] },
    fence: { w: 16, h: 16, frames: [fence] },
    tombstone: { w: 16, h: 16, frames: [tombstone] },
    deadtree: { w: 16, h: 16, frames: [deadTree] },
    icon_hoe: { w: 16, h: 16, frames: [hoe] },
    icon_shovel: { w: 16, h: 16, frames: [shovel] },
    icon_can: { w: 16, h: 16, frames: [can] },
    icon_seed_carrot: { w: 16, h: 16, frames: [seedCarrot] },
    icon_seed_pumpkin: { w: 16, h: 16, frames: [seedPumpkin] },
    coin: { w: 8, h: 8, frames: [coin] },
    heart: { w: 8, h: 8, frames: [heart, heartEmpty] },
    sun: { w: 8, h: 8, frames: [sun] },
    moon: { w: 8, h: 8, frames: [moon] },
    feather: { w: 2, h: 2, frames: [feather] }
  };

  // ---------- Texture building ----------
  const hexCache = {};
  function rgb(hex) {
    if (!hexCache[hex]) {
      hexCache[hex] = [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
    }
    return hexCache[hex];
  }

  function paintRows(img, imgW, ox, oy, rows, w, h, name) {
    if (rows.length !== h) throw new Error(`Sprite ${name}: expected ${h} rows, got ${rows.length}`);
    rows.forEach((row, y) => {
      if (row.length > w) throw new Error(`Sprite ${name} row ${y} is ${row.length} wide (max ${w}): "${row}"`);
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (!(ch in FH.PAL)) throw new Error(`Sprite ${name}: unknown color "${ch}"`);
        const col = FH.PAL[ch];
        if (!col) continue;
        const [r, g, b] = rgb(col);
        const i = ((oy + y) * imgW + ox + x) * 4;
        img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
      }
    });
  }

  // Creates a canvas texture with frames laid out left to right.
  function canvasSheet(scene, key, w, h, count, painter) {
    const tex = scene.textures.createCanvas(key, w * count, h);
    const ctx = tex.getContext();
    const img = ctx.createImageData(w * count, h);
    for (let f = 0; f < count; f++) painter(img, f * w, f);
    ctx.putImageData(img, 0, 0);
    for (let f = 0; f < count; f++) tex.add(f, 0, f * w, 0, w, h);
    tex.refresh();
    return tex;
  }

  function setPx(img, imgW, x, y, hex, a = 255) {
    const [r, g, b] = rgb(hex);
    const i = (y * imgW + x) * 4;
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = a;
  }

  // Tiny deterministic random so tiles look the same every run
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  // Tileset: 0 grass, 1 grass+flowers, 2 grass+tuft, 3 soil, 4 wet soil,
  //          5 path, 6 graveyard grass, 7 graveyard grass 2
  function buildTiles(scene) {
    const T = 16, N = 8;
    canvasSheet(scene, 'tiles', T, T, N, (img, ox, f) => {
      const W = T * N;
      const r = rng(1234 + f * 97);
      const fill = (base, specks) => {
        for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
          let c = base;
          const v = r();
          for (const [chance, col] of specks) { if (v < chance) { c = col; break; } }
          setPx(img, W, ox + x, y, c);
        }
      };
      const P = FH.PAL;
      if (f <= 2) {
        fill(P.g, [[0.06, P.h], [0.14, P.G]]);
        if (f === 1) {
          [[3, 4, P.e], [11, 9, P.y], [6, 12, P.R], [13, 3, P.e]].forEach(([x, y, c]) => {
            setPx(img, W, ox + x, y, c);
            setPx(img, W, ox + x, y + 1, P.h);
          });
        }
        if (f === 2) {
          [[4, 6], [10, 11], [12, 4]].forEach(([x, y]) => {
            setPx(img, W, ox + x, y, P.G); setPx(img, W, ox + x - 1, y + 1, P.G); setPx(img, W, ox + x + 1, y + 1, P.G);
            setPx(img, W, ox + x, y + 1, P.h); setPx(img, W, ox + x, y + 2, P.h);
          });
        }
      } else if (f === 3 || f === 4) {
        const wet = f === 4;
        const base = wet ? '#4f3226' : P.b;
        const dark = wet ? '#2f1d16' : P.B;
        const light = wet ? '#6b4430' : P.n;
        for (let y = 0; y < T; y++) for (let x = 0; x < T; x++) {
          let c = base;
          const row = y % 4;
          if (row === 0) c = dark;          // furrow
          else if (row === 1) c = light;    // ridge highlight
          if (x === 0 || y === 0) c = light;
          if (x === T - 1 || y === T - 1) c = dark;
          if (row > 1 && r() < 0.08) c = dark;
          setPx(img, W, ox + x, y, c);
        }
        if (wet) [[5, 6], [11, 10], [3, 13]].forEach(([x, y]) => setPx(img, W, ox + x, y, '#5a7aa8'));
      } else if (f === 5) {
        fill('#9a7a52', [[0.1, '#7a5c3c'], [0.18, '#b4946a']]);
      } else {
        fill(P.w, [[0.08, P.K], [0.16, P.W]]);
        if (f === 7) [[5, 5], [10, 11]].forEach(([x, y]) => { setPx(img, W, ox + x, y, P.q); setPx(img, W, ox + x + 1, y, P.p); });
      }
    });
  }

  // 32x32 farmhouse drawn with rectangles
  function buildHouse(scene) {
    const W = 32, H = 32;
    canvasSheet(scene, 'house', W, H, 1, (img) => {
      const P = FH.PAL;
      const px = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) setPx(img, W, x, y, c); };
      const rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c); };
      // walls
      rect(3, 14, 26, 17, P.n);
      for (let y = 14; y < 31; y += 3) rect(3, y, 26, 1, P.B);
      rect(2, 14, 1, 17, P.k); rect(29, 14, 1, 17, P.k); rect(2, 31, 28, 1, P.k);
      // roof (stepped triangle)
      for (let y = 0; y < 15; y++) {
        const half = Math.min(15, 2 + y);
        const x0 = 16 - half, x1 = 15 + half;
        for (let x = x0; x <= x1; x++) {
          let c = (y % 3 === 2) ? P.r : P.R;
          if ((x + y) % 5 === 0 && y % 3 !== 2) c = P.r;
          px(x, y + 1, c);
        }
        px(x0 - 1, y + 1, P.k); px(x1 + 1, y + 1, P.k);
      }
      rect(0, 15, 32, 1, P.k);
      rect(15, 0, 2, 1, P.k);
      // door
      rect(13, 22, 6, 9, P.B); rect(13, 22, 6, 1, P.k); rect(12, 22, 1, 9, P.k); rect(19, 22, 1, 9, P.k);
      px(17, 26, P.y);
      // windows (they glow at night)
      [[5, 18], [22, 18]].forEach(([x, y]) => {
        rect(x - 1, y - 1, 7, 6, P.k);
        rect(x, y, 5, 4, P.y);
        rect(x + 2, y, 1, 4, P.k); rect(x, y + 2, 5, 1, P.k);
        px(x, y, P.Y);
      });
    });
  }

  function buildMisc(scene) {
    // 1x1 white pixel (particles, flashes)
    canvasSheet(scene, 'px', 1, 1, 1, (img) => setPx(img, 1, 0, 0, '#ffffff'));

    // Soft ground shadow
    canvasSheet(scene, 'shadow', 12, 5, 1, (img) => {
      for (let y = 0; y < 5; y++) for (let x = 0; x < 12; x++) {
        const dx = (x - 5.5) / 6, dy = (y - 2) / 2.5;
        if (dx * dx + dy * dy <= 1) setPx(img, 12, x, y, '#000000', 90);
      }
    });

    // Tile cursor (corner brackets)
    canvasSheet(scene, 'cursor', 16, 16, 2, (img, ox, f) => {
      const c = f === 0 ? '#fff3b0' : '#d95763';
      const pts = [];
      for (let i = 0; i < 4; i++) { pts.push([i, 0], [0, i], [15 - i, 0], [15, i], [i, 15], [0, 15 - i], [15 - i, 15], [15, 15 - i]); }
      pts.forEach(([x, y]) => setPx(img, 32, ox + x, y, c));
    });

    // Shovel slash, 4 directions (0 down, 1 up, 2 right, 3 left)
    canvasSheet(scene, 'slash', 16, 16, 4, (img, ox, f) => {
      const ang = [Math.PI / 2, -Math.PI / 2, 0, Math.PI][f];
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const dx = x - 7.5, dy = y - 7.5;
        const d = Math.sqrt(dx * dx + dy * dy);
        let a = Math.atan2(dy, dx) - ang;
        while (a > Math.PI) a -= Math.PI * 2;
        while (a < -Math.PI) a += Math.PI * 2;
        if (d > 5 && d < 7.6 && Math.abs(a) < 1.2) setPx(img, 64, ox + x, y, d > 6.6 ? '#ffffff' : '#c4c4cc');
      }
    });

    // Hotbar slot frames: 0 normal, 1 selected
    canvasSheet(scene, 'slot', 18, 18, 2, (img, ox, f) => {
      for (let y = 0; y < 18; y++) for (let x = 0; x < 18; x++) {
        const edge = x === 0 || y === 0 || x === 17 || y === 17;
        const inner = x === 1 || y === 1 || x === 16 || y === 16;
        let c = '#2d2438', a = 220;
        if (edge) { c = f ? '#fff3b0' : '#1a1423'; a = 255; }
        else if (inner) { c = f ? '#f4d35e' : '#4a3f5c'; a = 255; }
        setPx(img, 36, ox + x, y, c, a);
      }
    });

    // Glowing zombie eyes, drawn unlit on top of zombies so they show in the dark
    canvasSheet(scene, 'zombie_eyes', 16, 16, 1, (img) => {
      setPx(img, 16, 9, 5, '#ff5a40');
      [[8, 5], [10, 5], [9, 4], [9, 6]].forEach(([x, y]) => setPx(img, 16, x, y, '#ff2a20', 70));
    });

    // Drifting fog (tileable soft noise)
    canvasSheet(scene, 'fog', 64, 64, 1, (img) => {
      const r = rng(77);
      const blobs = Array.from({ length: 14 }, () => [r() * 64, r() * 64, 8 + r() * 14]);
      for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
        let v = 0;
        for (const [bx, by, br] of blobs) {
          for (const ox of [-64, 0, 64]) for (const oy of [-64, 0, 64]) {
            const dx = x - bx - ox, dy = y - by - oy;
            v += Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) / br);
          }
        }
        const a = Math.min(1, v) * 120;
        // dithered edge keeps it pixel-art friendly
        if (a > 20 && ((x + y) % 2 === 0 || a > 60)) setPx(img, 64, x, y, '#b8c0d8', Math.round(a));
      }
    });
  }

  function buildSprites(scene) {
    for (const [key, s] of Object.entries(FH.SPRITES)) {
      canvasSheet(scene, key, s.w, s.h, s.frames.length, (img, ox, f) => {
        paintRows(img, s.w * s.frames.length, ox, 0, s.frames[f], s.w, s.h, `${key}[${f}]`);
      });
    }
  }

  function buildAnims(scene) {
    const A = scene.anims;
    const fr = (key, list) => list.map((frame) => ({ key, frame }));
    A.create({ key: 'farmer-down', frames: fr('farmer', [1, 0, 2, 0]), frameRate: 8, repeat: -1 });
    A.create({ key: 'farmer-up', frames: fr('farmer', [4, 3, 5, 3]), frameRate: 8, repeat: -1 });
    A.create({ key: 'farmer-side', frames: fr('farmer', [7, 6]), frameRate: 6, repeat: -1 });
    A.create({ key: 'crow-fly', frames: fr('crow', [2, 3]), frameRate: 8, repeat: -1 });
    A.create({ key: 'crow-peck', frames: fr('crow', [0, 1, 0, 0, 1]), frameRate: 5, repeat: -1 });
    A.create({ key: 'zombie-walk', frames: fr('zombie', [0, 1]), frameRate: 3, repeat: -1 });
  }

  FH.Art = {
    build(scene) {
      buildTiles(scene);
      buildHouse(scene);
      buildMisc(scene);
      buildSprites(scene);
      buildAnims(scene);
    }
  };
})();
