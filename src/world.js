// ============================================================================
// Procedural world. The world is an endless strip along x. It is split into
// biome regions (TA.REGION wide) and generation chunks (TA.CHUNK wide).
// Under the whole strip lies a grid of blocks (dirt, stone, ore) with caverns and
// tunnels carved through it, down to bedrock. The player can dig and build in it.
// Shafts lead down from the surface. It is all one space: heights are world
// heights, 0 is the surface and the underground is negative. Where two biomes meet there is a thicket
// you travel through; the thickets around hidden biomes can't be crossed, so
// those can only be reached from below.
// Everything is derived from the seed; only changes (felled trees, opened
// chests, cleared camps) are stored in the save.
// ============================================================================
window.TA = window.TA || {};

// Width of a struct piece, for laying out streets
TA.objW = function (o) {
  if (o.spr) return TA.SPR[o.spr][3];
  if (o.bld) return (TA.BTRIM && TA.BTRIM[o.bld]) ? TA.BTRIM[o.bld].w : TA.BSHEET[o.bld][1];
  return 16;
};
TA.objH = function (o) {
  if (o.spr) return TA.SPR[o.spr][4];
  if (o.bld) return (TA.BTRIM && TA.BTRIM[o.bld]) ? TA.BTRIM[o.bld].h : TA.BSHEET[o.bld][2];
  if (o.kind === 'tree') return TA.SPR[o.spr][4];
  return 10;
};

TA.World = class {
  constructor(seed, saved, opts = {}) {
    this.seed = seed >>> 0;
    this.avoidX = opts.avoidX ?? null;   // the player's claim: never generate a town on top of it
    this.biomeMemo = new Map(); this.poiMemo = new Map(); this.pieceMemo = new Map();
    this.shaftMemo = new Map(); this.portalMemo = new Map(); this.originMemo = new Map();
    this.chunks = new Map();          // c -> {objects:[], cells: Uint8Array}
    this.edits = (saved && saved.edits) || {};          // "c,r" -> block, dug or built by the player
    this.sky = new Map();                                // blocks built above the ground
    for (const [key, t] of Object.entries(this.edits)) { const [c, r] = key.split(',').map(Number); if (r >= 0 && t) this.sky.set(c * 4096 + r, t); }
    this.removed = (saved && saved.removed) || {};     // objectId -> day removed (-1 = permanent)
    this.opened = (saved && saved.opened) || {};       // chestId -> true
    this.cleared = (saved && saved.cleared) || {};     // poiId -> day cleared
    this.discovered = (saved && saved.discovered) || {}; // poiId -> {x, type, biome}
    this.explored = (saved && saved.explored) || [0, 0];
  }
  serialize() {
    return { removed: this.removed, opened: this.opened, cleared: this.cleared, discovered: this.discovered, explored: this.explored, edits: this.edits };
  }

  // ------------------------------------------------------------ biomes
  regionOf(x) { return Math.floor((x + TA.REGION / 2) / TA.REGION); }
  regionStart(i) { return i * TA.REGION - TA.REGION / 2; }

  biomeOfRegion(i) {
    if (i === 0) return 'meadow';
    if (this.biomeMemo.has(i)) return this.biomeMemo.get(i);
    const d = Math.abs(i), s = Math.sign(i);
    const r = TA.rng(TA.hash(this.seed, i, 4111));
    const prev = this.biomeOfRegion(i - s);
    const prevHidden = TA.BIOMES[prev].hidden;
    const holdsClaim = this.avoidX !== null && this.regionOf(this.avoidX) === i;
    let b;
    if (d >= 3 && r() < 0.12 && !prevHidden && !holdsClaim) b = d >= 5 && r() < 0.5 ? 'crater' : 'vale';
    else {
      const p = prevHidden ? this.biomeOfRegion(i - 2 * s) : prev;
      if (r() < 0.28 && p !== 'badlands') b = p; // biomes form runs
      else {
        const w = { meadow: d <= 2 ? 3 : 1.2, woods: 2.6, kingdom: d >= 1 ? 2 : 0, elvish: d >= 2 ? 1.6 : 0, badlands: d >= 3 ? 1 + 0.25 * d : 0 };
        w[p] *= 0.35;
        b = r.weighted(w);
      }
    }
    this.biomeMemo.set(i, b);
    return b;
  }
  biomeAt(x) { return this.biomeOfRegion(this.regionOf(x)); }
  isHidden(i) { return !!TA.BIOMES[this.biomeOfRegion(i)].hidden; }

  danger(x) {
    const i = Math.abs(this.regionOf(x));
    return TA.BIOMES[this.biomeAt(x)].danger + Math.floor(i / 2);
  }

  // ------------------------------------------------------------ borders
  // Where two different biomes meet stands a thicket. Nothing walks through it:
  // the player is asked whether to travel on (Game.update). The thickets around
  // hidden biomes (blocked) can't be crossed at all.
  bordersIn(x0, x1) {
    const out = [];
    for (let i = this.regionOf(x0 - TA.BORDER); i <= this.regionOf(x1 + TA.BORDER) + 1; i++) {
      const x = this.regionStart(i);
      if (x < x0 - TA.BORDER - 40 || x > x1 + TA.BORDER + 40) continue;
      const a = this.biomeOfRegion(i - 1), b = this.biomeOfRegion(i);
      if (a !== b) out.push({ x, a, b, blocked: !!TA.BIOMES[a].hidden !== !!TA.BIOMES[b].hidden });
    }
    return out;
  }
  // Clamp a surface move from x to nx so nothing walks through a thicket
  surfaceClamp(x, nx) {
    for (const bd of this.bordersIn(Math.min(x, nx) - 30, Math.max(x, nx) + 30)) {
      const lo = bd.x - TA.BORDER, hi = bd.x + TA.BORDER;
      if (x <= lo && nx > lo) return lo;
      if (x >= hi && nx < hi) return hi;
    }
    return nx;
  }

  // ------------------------------------------------------------ points of interest
  poisOfRegion(i) {
    if (this.poiMemo.has(i)) return this.poiMemo.get(i);
    const bname = this.biomeOfRegion(i), biome = TA.BIOMES[bname];
    const r = TA.rng(TA.hash(this.seed, i, 909));
    const start = this.regionStart(i), end = start + TA.REGION;
    const out = [];
    const push = (type, x) => {
      const def = TA.POI_DEFS[type];
      if (this.avoidX !== null && Math.abs(this.avoidX - x) < def.w / 2 + TA.CLAIM_RADIUS + 20) return false;
      out.push({ id: `p${i}_${out.length}`, type, x: Math.round(x), w: def.w, biome: bname, region: i });
      return true;
    };
    if (i === 0) push('village', (r() < 0.5 ? -1 : 1) * r.int(560, 640)); // a village near the start, never on it
    else {
      let cursor = start + TA.BORDER_CLEAR - 40 + r.int(0, 160);
      const want = r.int(1, 3);
      const hidden = biome.hidden;
      for (let k = 0; k < 6 && out.length < want; k++) {
        let type = hidden && k === 0 ? 'shrine' : r.pick(biome.pois);
        if (Math.abs(i) === 1 && (type === 'camp' || type === 'warcamp' || type === 'city')) type = 'ruin';
        const w = TA.POI_DEFS[type].w;
        if (cursor + w > end - TA.BORDER_CLEAR + 40) { if (w > 400) continue; else break; }
        if (push(type, cursor + w / 2)) cursor += w;
        cursor += r.int(160, 420);
      }
    }
    this.poiMemo.set(i, out);
    return out;
  }
  poiAt(x, pad = 0) {
    const i = this.regionOf(x);
    for (const j of [i - 1, i, i + 1]) for (const p of this.poisOfRegion(j))
      if (Math.abs(x - p.x) < p.w / 2 + pad) return p;
    return null;
  }
  // All the objects a POI is made of (built once, then handed out per chunk)
  poiPieces(p) {
    if (this.pieceMemo.has(p.id)) return this.pieceMemo.get(p.id);
    const pieces = [];
    let n = 0;
    const add = o => { o.id = `${p.id}:${n++}`; if (!o.poi && ['chest', 'mobs', 'npc', 'dog', 'folk'].includes(o.kind)) o.poi = p.id; pieces.push(o); return o; };
    TA.POI_DEFS[p.type].build(p, add, TA.rng(TA.hash(this.seed, p.region, p.x)), this);
    this.pieceMemo.set(p.id, pieces);
    return pieces;
  }

  // ------------------------------------------------------------ the block grid
  // See TA.CELL. Every chunk keeps its blocks in a Uint8Array (rows -1 down to
  // bedrock); blocks above the ground only exist where the player built them.
  // What the player digs or builds is kept in `edits` ("c,r" -> block) and saved.
  baseCell(c, r, rooms, dirtDepth) {
    const C = TA.CELL;
    if (r >= 0) return C.AIR;
    if (r <= TA.BEDROCK_ROW) return C.BEDROCK;
    for (const room of rooms) { const t = room(c, r); if (t !== undefined) return t; }
    if (r >= -2) return C.GROUND;
    const d = -r;
    if (d > 6) {
      // caverns, opening up with depth, and long winding tunnels between them
      const n = TA.noise2(this.seed ^ 0x3c1, c / 14, r / 7) * 0.6 + TA.noise2(this.seed ^ 0x77b, c / 5, r / 4) * 0.4;
      if (n > (d < 16 ? 0.7 - (d - 6) * 0.008 : 0.62)) return C.AIR;
      if (d > 9 && Math.abs(TA.noise2(this.seed ^ 0x1d9, c / 36, r / 10) - 0.5) < 0.02) return C.AIR;
    }
    if (d < dirtDepth) return C.DIRT;
    const o = TA.noise2(this.seed ^ 0x5e3, c / 3, r / 3);
    if (d > 30 && o > 0.85) return C.GEM;
    if (d > 12 && o > 0.79) return C.ORE;
    return C.STONE;
  }
  // Hand-carved spaces near chunk c: each a function (col, row) -> block or undefined
  roomsNear(c0, c1) {
    const C = TA.CELL, rooms = [];
    for (let i = this.regionOf(c0 * 8) - 1; i <= this.regionOf(c1 * 8) + 1; i++) {
      for (const s of this.shaftsOfRegion(i)) {
        const sc = Math.floor(s.x / 8);
        if (sc < c0 - 8 || sc > c1 + 8) continue;
        // the shaft: a trapdoor in the top row of the ground, a ledge every 3
        // rows, a room at the bottom with a solid floor
        const R = TA.SHAFT_ROOM, ledge = r => (-1 - r) % 3 === 0;
        rooms.push((c, r) => {
          const dc = Math.abs(c - sc);
          if (dc <= 1 && r <= -1 && r >= R - 4) return ledge(r) ? C.LEDGE : C.AIR;
          if (dc <= 5 && r <= R && r >= R - 4) return C.AIR;
          if (dc <= 5 && r === R - 5) return C.STONE;
        });
      }
      for (const pt of this.portalsOfRegion(i)) {
        if (pt.layer !== 'c') continue;
        const pc = Math.floor(pt.x / 8), F = TA.PORTAL_FLOOR;
        if (pc < c0 - 8 || pc > c1 + 8) continue;
        rooms.push((c, r) => {
          if (Math.abs(c - pc) > 4) return;
          if (r === F) return C.STONE;
          if (r > F && r <= F + 4) return C.AIR;
        });
      }
    }
    return rooms;
  }
  genCells(ch) {
    const cols = TA.CHUNK / 8, rows = -TA.BEDROCK_ROW, c0 = ch * cols;
    const cells = new Uint8Array(cols * rows), rooms = this.roomsNear(c0, c0 + cols - 1);
    for (let k = 0; k < cols; k++) {
      const c = c0 + k, dirtDepth = 9 + TA.noise2(this.seed ^ 0x2a4, c / 10, 0) * 5;
      for (let j = 0; j < rows; j++) cells[k * rows + j] = this.baseCell(c, -1 - j, rooms, dirtDepth);
    }
    for (const [key, t] of Object.entries(this.edits)) {
      const [c, r] = key.split(',').map(Number);
      if (r < 0 && Math.floor(c / cols) === ch) cells[(c - c0) * rows + (-1 - r)] = t;
    }
    return cells;
  }
  cell(c, r) {
    if (r >= 0) return this.sky.get(c * 4096 + r) || TA.CELL.AIR;
    if (r < TA.BEDROCK_ROW) return TA.CELL.BEDROCK;
    const cols = TA.CHUNK / 8, ch = Math.floor(c / cols);
    return this.getChunk(ch).cells[(c - ch * cols) * -TA.BEDROCK_ROW + (-1 - r)];
  }
  setCell(c, r, t) {
    this.edits[`${c},${r}`] = t;
    if (r >= 0) { if (t) this.sky.set(c * 4096 + r, t); else this.sky.delete(c * 4096 + r); return; }
    const cols = TA.CHUNK / 8, ch = Math.floor(c / cols);
    this.getChunk(ch).cells[(c - ch * cols) * -TA.BEDROCK_ROW + (-1 - r)] = t;
  }
  solidAt(x, y) { return TA.SOLID[this.cell(Math.floor(x / 8), Math.floor(y / 8))]; }
  // Top of the first block or ledge at or below height y at x
  floorBelow(x, y) {
    const c = Math.floor(x / 8);
    for (let r = Math.floor((y - 0.01) / 8); r >= TA.BEDROCK_ROW; r--) {
      const t = this.cell(c, r);
      if (TA.SOLID[t] || t === TA.CELL.LEDGE) return (r + 1) * 8;
    }
    return (TA.BEDROCK_ROW + 1) * 8;
  }
  // A cave floor near height y at x (an open spot with headroom), or null
  caveFloorNear(x, y) {
    const c = Math.floor(x / 8), r0 = Math.floor(y / 8), A = TA.CELL.AIR;
    for (let d = 0; d < 40; d++) for (const r of [r0 - d, r0 + d]) {
      if (r > -4 || r <= TA.BEDROCK_ROW + 1) continue;
      if (this.cell(c, r) === A && this.cell(c, r + 1) === A && TA.SOLID[this.cell(c, r - 1)]) return r * 8;
    }
    return null;
  }
  caveBiomeOfRegion(i) {
    const b = TA.BIOMES[this.biomeOfRegion(i)];
    return TA.rng(TA.hash(this.seed, i, 8080)).weighted(b.cave);
  }
  caveBiomeAt(x) { return this.caveBiomeOfRegion(this.regionOf(x)); }
  caveBiomeVis(x) {
    const i = this.regionOf(x), start = this.regionStart(i), end = start + TA.REGION, B = 140;
    let o = 0;
    if (x - start < B) o = -1; else if (end - x < B) o = 1;
    if (!o) return this.caveBiomeOfRegion(i);
    const edge = o < 0 ? start : end;
    const w = TA.clamp((x - edge + B) / (2 * B), 0, 1);
    const left = this.caveBiomeOfRegion(o < 0 ? i - 1 : i), right = this.caveBiomeOfRegion(o < 0 ? i : i + 1);
    return TA.hash01(this.seed, Math.floor(x / 8), 61) < w ? right : left;
  }

  // Cave mouths. Each is a shaft: a hole in the ground with a trapdoor, a
  // ledge every 3 blocks down to a room at the bottom (see roomsNear). Regions next to a hidden biome always get one close to its thicket,
  // and hidden biomes get one just inside each of theirs.
  shaftsOfRegion(i) {
    if (this.shaftMemo.has(i)) return this.shaftMemo.get(i);
    const out = [];
    this.shaftMemo.set(i, out); // guards against recursion through poiAt
    const r = TA.rng(TA.hash(this.seed, i, 5150));
    const start = this.regionStart(i), end = start + TA.REGION;
    const want = [];
    if (this.isHidden(i)) want.push(start + 260, end - 260);
    else {
      if (this.isHidden(i + 1)) want.push(end - 190);
      if (this.isHidden(i - 1)) want.push(start + 190);
      if (i === 0) {
        const v = this.poisOfRegion(0)[0];
        want.push((v && v.x > 0 ? -1 : 1) * r.int(820, 980));
      } else for (let k = r.int(0, 2); k > 0; k--) want.push(start + r.int(320, TA.REGION - 320));
    }
    for (let x of want) {
      x = Math.round(x);
      let tries = 0;
      while (tries++ < 8 && (this.poiAt(x, 40) || (this.avoidX !== null && Math.abs(x - this.avoidX) < TA.CLAIM_RADIUS + 40) || out.some(s => Math.abs(s.x - x) < 200)))
        x += (x - start < TA.REGION / 2 ? 1 : -1) * 90;
      if (tries >= 8) continue;
      x = Math.floor(x / 8) * 8 + 4; // centre the hole on a tile column, so it is exactly 3 columns wide
      out.push(this.buildShaft(`s${i}_${out.length}`, x));
    }
    return out;
  }
  buildShaft(id, x) {
    // the shaft itself is carved into the block grid (roomsNear); bottom = its room's floor
    return { id, x, bottom: (TA.SHAFT_ROOM - 4) * 8 };
  }
  shaftAt(x, pad = 16) {
    const i = this.regionOf(x);
    for (const j of [i - 1, i, i + 1]) for (const s of this.shaftsOfRegion(j)) if (Math.abs(s.x - x) < pad) return s;
    return null;
  }

  // ------------------------------------------------------------ portals
  // A rare region holds one end of a portal pair; the other end lands 3 to 7
  // regions away (sometimes inside a hidden biome).
  portalOrigin(i) {
    if (this.originMemo.has(i)) return this.originMemo.get(i);
    let o = null;
    const r = TA.rng(TA.hash(this.seed, i, 6060));
    if (Math.abs(i) >= 2 && r() < 0.15) {
      const j = i + r.int(3, 7) * (r() < 0.5 ? -1 : 1);
      if (j !== 0) {
        const a = this.placePortal(i, TA.rng(TA.hash(this.seed, i, 6061)), `pt${i}a`);
        const b = this.placePortal(j, TA.rng(TA.hash(this.seed, i, 6062)), `pt${i}b`);
        if (a && b) { a.to = b; b.to = a; o = { a, b, j }; }
      }
    }
    this.originMemo.set(i, o);
    return o;
  }
  placePortal(i, r, id) {
    const start = this.regionStart(i);
    const ruin = this.poisOfRegion(i).find(p => p.type === 'ruin');
    const roll = r();
    if (ruin && roll < 0.5) return { id, x: ruin.x + 64, layer: 's', y: 0, where: 'ruin' };
    const free = x => !this.poiAt(x, 30) && !this.shaftAt(x, 70) && (this.avoidX === null || Math.abs(x - this.avoidX) > TA.CLAIM_RADIUS + 30);
    for (let k = 0; k < 10; k++) {
      const x = start + r.int(TA.BORDER_CLEAR + 40, TA.REGION - TA.BORDER_CLEAR - 40);
      if (!free(x)) continue;
      if (roll < 0.78) return { id, x, layer: 'c', y: (TA.PORTAL_FLOOR + 1) * 8, where: 'cave' }; // in a carved room
      return { id, x, layer: 's', y: 0, where: 'wild' };
    }
    return null;
  }
  portalsOfRegion(i) {
    if (this.portalMemo.has(i)) return this.portalMemo.get(i);
    const out = [];
    const o = this.portalOrigin(i);
    if (o) out.push(o.a);
    for (let k = i - 7; k <= i + 7; k++) { const ok = this.portalOrigin(k); if (ok && ok.j === i) out.push(ok.b); }
    this.portalMemo.set(i, out);
    return out;
  }

  // ------------------------------------------------------------ chunks
  getChunk(c) {
    let ch = this.chunks.get(c);
    if (!ch) { ch = this.genChunk(c); this.chunks.set(c, ch); }
    return ch;
  }
  // Objects in [x0, x1] on a layer ('s' surface, 'c' caves, null both)
  objectsIn(x0, x1, layer = 's') {
    const out = [];
    for (let c = Math.floor((x0 - 40) / TA.CHUNK); c <= Math.floor((x1 + 40) / TA.CHUNK); c++)
      for (const o of this.getChunk(c).objects) if (!o.gone && (!layer || (o.layer || 's') === layer) && o.x >= x0 - 40 && o.x <= x1 + 40) out.push(o);
    return out;
  }
  isRemoved(id, regrowDays, day) {
    const d = this.removed[id];
    if (d === undefined) return false;
    if (d === -1) return true;
    if (regrowDays && day - d >= regrowDays) { delete this.removed[id]; return false; }
    return true;
  }
  remove(o, day, permanent = false) {
    o.gone = true;
    this.removed[o.id] = permanent ? -1 : day;
  }
  // Re-check regrowth for loaded chunks (called each new day)
  refreshDay(day) {
    for (const ch of this.chunks.values()) for (const o of ch.objects)
      if (o.gone && o.regrow && !this.isRemoved(o.id, o.regrow, day)) { o.gone = false; o.hp = o.maxHp; }
  }

  genChunk(c) {
    const x0 = c * TA.CHUNK, x1 = x0 + TA.CHUNK;
    const r = TA.rng(TA.hash(this.seed, c, 1234));
    const objects = [];
    const cells = this.genCells(c);
    const day = TA.game ? TA.game.day : 1;
    let n = 0;
    const take = (o) => { o.gone = this.isRemoved(o.id, o.regrow, day); objects.push(o); };
    const add = (o) => { o.id = `${c}:${n++}`; take(o); return o; };
    const thicket = x => this.bordersIn(x - 70, x + 70).some(b => Math.abs(b.x - x) < 64);
    const blocked = (x, pad) => this.poiAt(x, pad) || Math.abs(x) < 34 || this.shaftAt(x, 26 + pad) || thicket(x); // keep the start camp clear
    const pal = b => b.trees.teal >= 0.5 ? 't' : 'o';

    // ---------------- surface
    // ground grass and sprigs, some of them in front of the actors for depth
    for (let x = x0; x < x1; x += 14) {
      const b = TA.BIOMES[this.biomeAt(x)];
      const v = r(), p = pal(b), xx = x + r.int(0, 10);
      if (v < 0.2) add({ kind: 'decor', x: xx, spr: 'grass_' + p, flip: r() < 0.5, z: -1 });
      else if (v < 0.3 && !blocked(x, 6)) add({ kind: 'decor', x: xx, spr: `sprig_${p}${r.int(1, 3)}`, flip: r() < 0.5, z: 1 });
      else if (v < 0.4 && !this.poiAt(x, 0)) add({ kind: 'decor', x: xx, spr: r() < 0.6 ? 'grass_' + p : `sprig_${p}${r.int(1, 3)}`, flip: r() < 0.5, front: true });
    }
    // choppable trees, and now and then a tall one standing in front
    for (let x = x0 + 8; x < x1; x += 18) {
      const b = TA.BIOMES[this.biomeAt(x)];
      const v = r();
      if (v < b.treeDensity * 0.55) {
        const xx = x + r.int(-4, 4);
        if (blocked(xx, 10)) continue;
        const spr = r.pick(TA.TREE_SETS[r.weighted(b.trees)]);
        const big = TA.SPR[spr][4] >= 18 || TA.SPR[spr][3] >= 16;
        add({ kind: 'tree', x: xx, spr, flip: r() < 0.5, hp: big ? 5 : 3, maxHp: big ? 5 : 3, yieldWood: big ? [3, 5] : [2, 3], regrow: 3, z: 0 });
      } else if (v > 1 - b.treeDensity * 0.07 && !this.poiAt(x, 10)) {
        add({ kind: 'decor', x: x + r.int(-4, 4), spr: r.pick(TA.TREE_SETS[r.weighted(b.trees)]), flip: r() < 0.5, front: true });
      }
    }
    // rocks (a few small ones sit in front)
    for (let x = x0 + 20; x < x1; x += 58) {
      const b = TA.BIOMES[this.biomeAt(x)];
      const v = r();
      if (v < b.rockDensity * 0.55) {
        const xx = x + r.int(-12, 12);
        if (blocked(xx, 14)) continue;
        const spr = r.pick(['rock_a', 'rock_b', 'rock_c', 'rock_d', 'rock_a']);
        const hp = spr === 'rock_a' ? 5 : 3;
        add({ kind: 'rock', x: xx, spr, hp, maxHp: hp, gems: !!b.gems, rich: !!b.richRocks, regrow: 4, z: 1 });
      } else if (v > 0.93) add({ kind: 'decor', x: x + r.int(-12, 12), spr: r.pick(['rock_b', 'rock_c', 'rock_d']), front: true });
    }
    // forage bushes & mushrooms
    for (let x = x0 + 12; x < x1; x += 40) {
      const b = TA.BIOMES[this.biomeAt(x)];
      const v = r();
      if (v < b.bushDensity * 0.45) {
        const xx = x + r.int(-8, 8);
        if (blocked(xx, 8)) continue;
        const p = r.weighted(b.trees) === 'teal' ? 't' : 'o';
        add({ kind: 'bush', x: xx, spr: `bush_${p}${r() < 0.5 ? '' : '2'}`, flip: r() < 0.5, regrow: 2, z: 1 });
      } else if (b.mushrooms && v < b.bushDensity * 0.45 + 0.12) {
        const xx = x + r.int(-8, 8);
        if (!blocked(xx, 8)) add({ kind: 'mushroom', x: xx, regrow: 2, z: 1 });
      }
    }
    // borders: a thicket three rows deep that hides whoever walks into it (the
    // front row never turns see-through); a denser, brambly one around hidden biomes
    for (const bd of this.bordersIn(x0 - 60, x1 + 60)) {
      const vr = TA.rng(TA.hash(this.seed, bd.x, 3131)), n = bd.blocked ? 14 : 10;
      for (let k = 0; k < n; k++) {
        const x = bd.x - 54 + Math.round(k * 108 / (n - 1)) + vr.int(-3, 3);
        const set = TA.TREE_SETS[vr.weighted(TA.BIOMES[x < bd.x ? bd.a : bd.b].trees)];
        const pieces = [
          { kind: 'decor', x, spr: vr.pick([set[1], set[2], set[2], set[6]]), flip: vr() < 0.5, front: true, screen: true },
          { kind: 'decor', x: x + vr.int(-6, 6), spr: vr.pick([set[2], set[3], set[4]]), flip: vr() < 0.5, z: 2 },
          { kind: 'decor', x: x + 6, spr: vr.pick([set[2], set[6]]), flip: vr() < 0.5, back: true, z: -2 },
        ];
        if (bd.blocked) pieces.push({ kind: 'decor', x: x + 4, spr: vr.pick(['bush_t', 'bush_o', 'bush_t2', 'bush_o2']), flip: vr() < 0.5, front: true, screen: true });
        pieces.forEach((o, j) => { if (o.x >= x0 && o.x < x1) { o.id = `t${bd.x}:${k}:${j}`; take(o); } });
      }
    }
    // POI pieces that stand in this chunk
    for (let i = this.regionOf(x0) - 1; i <= this.regionOf(x1) + 1; i++) for (const p of this.poisOfRegion(i)) {
      if (p.x + p.w / 2 + 80 < x0 || p.x - p.w / 2 - 80 > x1) continue;
      for (const o of this.poiPieces(p)) if (o.x >= x0 && o.x < x1) take(o);
    }
    // cave mouths
    for (let i = this.regionOf(x0) - 1; i <= this.regionOf(x1) + 1; i++) for (const s of this.shaftsOfRegion(i)) {
      if (s.x >= x0 && s.x < x1) {
        take({ kind: 'mouth', id: s.id + ':m', x: s.x, shaft: s, z: -1 });
      }
    }
    // portals
    for (let i = this.regionOf(x0) - 1; i <= this.regionOf(x1) + 1; i++) for (const pt of this.portalsOfRegion(i))
      if (pt.x >= x0 && pt.x < x1) take({ kind: 'portal', id: pt.id, x: pt.x, y: pt.y, layer: pt.layer, portal: pt, z: 1 });
    // start camp
    if (x0 <= 0 && x1 > 0) add({ kind: 'campfire', x: 0, z: 1, light: 48 });

    // ---------------- caves
    this.genCave(c, cells, add);
    return { objects, cells };
  }

  // Dress the caverns: blooms, mushrooms and tufts on their floors, roots from
  // their roofs, now and then a chest or a lair
  genCave(c, cells, add) {
    const C = TA.CELL, cols = TA.CHUNK / 8, rows = -TA.BEDROCK_ROW, r = TA.rng(TA.hash(this.seed, c, 4321));
    const at = (k, row) => row >= 0 ? C.AIR : cells[k * rows + (-1 - row)];
    const tufts = ['tuft_a', 'tuft_b', 'tuft_c', 'tuft_d', 'vmush'];
    const floors = [];
    for (let k = 0; k < cols; k++) {
      const x = (c * cols + k) * 8 + 4;
      if (this.shaftAt(x, 48)) continue;
      const cb = TA.CAVE_BIOMES[this.caveBiomeVis(x)];
      for (let row = -4; row > TA.BEDROCK_ROW + 1; row--) {
        if (at(k, row) !== C.AIR) continue;
        if (TA.SOLID[at(k, row - 1)] && at(k, row + 1) === C.AIR) {
          const y = row * 8;
          floors.push({ x, y });
          const v = r();
          if (v < cb.blooms * 0.12) add({ kind: 'glow', x, y, layer: 'c', spr: r.pick(['bloom_a', 'bloom_b', 'bloom_c', 'bloom_d', 'bloom_e', 'bloom_f']), flip: r() < 0.5, regrow: 2, light: 14 });
          else if (v < (cb.blooms + cb.shrooms) * 0.12) add({ kind: 'mushroom', x, y, layer: 'c', regrow: 2 });
          else if (v < 0.22) add({ kind: 'decor', x, y, layer: 'c', spr: r.pick(tufts), flip: r() < 0.5, back: true });
          else if (v < 0.26) add({ kind: 'decor', x, y, layer: 'c', spr: r.pick(tufts.concat(['bloom_g'])), flip: r() < 0.5, front: true });
          else if (v < 0.28 && cb === TA.CAVE_BIOMES.bones) add({ kind: 'decor', x, y, layer: 'c', spr: r.pick(['g_ribs3', 'g_tusk', 'g_tusk2']) });
        }
        if (TA.SOLID[at(k, row + 1)] && r() < 0.07)
          add({ kind: 'decor', hang: true, x, y: (row + 1) * 8, layer: 'c', spr: r.pick(['root_a', 'root_b', 'root_c', 'root_d', 'root_e', 'root_e', 'root_f']), flip: r() < 0.5 });
      }
    }
    if (!floors.length) return;
    if (r() < 0.55) {
      const f = r.pick(floors), cb = TA.CAVE_BIOMES[this.caveBiomeAt(f.x)];
      add({ kind: 'mobs', x: f.x, y: f.y, layer: 'c', poi: `l${c}`, mobs: Array.from({ length: r.int(1, 2) }, () => r.pick(cb.mobs)) });
    }
    if (r() < 0.35) { const f = r.pick(floors); add({ kind: 'chest', x: f.x, y: f.y, layer: 'c', tier: f.y < -320 ? 3 : 2 }); }
  }
};

// ---------------------------------------------------------------- POI recipes
// build(poi, add, rng, world) adds objects. Structure objects use either a static
// sprite (spr) or a building sheet (bld) drawn at its finished frame.
// back: drawn darker behind the main street. front: drawn over the actors.
// arch: a gateway the player walks through (left half behind, right half in front).

// Lay pieces left to right across [x0, x1]
TA.street = function (add, r, x0, x1, pick, extra = {}, gap = [3, 12]) {
  let x = x0;
  const out = [];
  for (let k = 0; k < 60; k++) {
    const item = pick();
    if (!item) { x += r.int(10, 30); continue; }
    const w = TA.objW(item);
    if (x + w > x1) break;
    out.push(add({ kind: 'struct', ...item, x: Math.round(x + w / 2), ...extra }));
    x += w + r.int(gap[0], gap[1]);
  }
  return out;
};
// Townsfolk: walkers wander the street, workers loop a job animation, guards pace
TA.addFolk = function (add, r, p, n, opts = {}) {
  const x0 = p.x - p.w / 2 + 20, x1 = p.x + p.w / 2 - 20;
  const doors = opts.doors || [];
  for (let k = 0; k < n; k++) {
    const sheet = r.pick(opts.sheets || TA.WALKERS);
    add({ kind: 'folk', x: r.int(x0, x1), sheet, role: 'walk', range: [x0, x1], doors });
  }
  for (let k = 0; k < (opts.guards || 0); k++)
    add({ kind: 'folk', x: r.int(x0, x1), sheet: r.pick(['guard', 'spearman']), role: 'guard', range: [x0, x1], doors: [] });
};
const pickKey = (r, list) => () => { const k = r.pick(list); return k.startsWith('b:') ? { bld: k.slice(2) } : { spr: k }; };

TA.POI_DEFS = {
  village: {
    w: 420, label: 'Village', icon: 'house',
    build(p, add, r) {
      const L = p.x - p.w / 2, R = p.x + p.w / 2;
      const homes = ['k_cottage', 'k_house', 'k_shop_plant', 'k_houses', 'k_shed', 'b:hut'];
      // back row
      TA.street(add, r, L + 30, R - 30, pickKey(r, ['k_houses', 'k_cottage', 'k_house', 'tree_t_big', 'k_shed', 'tree_o_mid']), { back: true, z: -3 }, [6, 30]);
      // fields on the west edge, with a farmer at work
      for (let k = 0; k < 5; k++) add({ kind: 'field', x: L + 24 + k * 16, crop: r.pick(['wheat', 'carrot', 'pumpkin']), stage: r.int(1, 4) });
      add({ kind: 'folk', x: L + 48, sheet: 'farmer2', role: 'work', anim: r() < 0.5 ? 'work' : 'water', range: [L + 24, L + 88] });
      for (let k = 0; k < 4; k++) add({ kind: 'struct', spr: 'k_fence', x: L + 28 + k * 24, front: true });
      // main street
      const main = TA.street(add, r, L + 112, R - 70, () => r() < 0.12 ? null : { ...pickKey(r, homes)() }, { z: -1 }, [6, 16]);
      // a market and a campfire at the heart of it
      const mid = main[Math.floor(main.length / 2)];
      if (mid) { mid.bld = 'market'; delete mid.spr; }
      add({ kind: 'campfire', x: p.x + 4, z: 1, light: 56 });
      add({ kind: 'npc', x: p.x + 16, npc: 'trader' });
      // woodlot on the east edge
      add({ kind: 'decor', x: R - 40, spr: 'tree_t_big', z: -1 });
      add({ kind: 'decor', x: R - 18, spr: 'tree_o_tall', z: -1 });
      add({ kind: 'folk', x: R - 54, sheet: 'lumber2', role: 'work', anim: 'work', range: [R - 60, R - 50], face: 1 });
      // fences, shrubs and a cottage close to the viewer
      for (let x = L + 120; x < R - 60; x += r.int(40, 90)) add({ kind: 'struct', spr: r.pick(['k_fence', 'bush_t', 'bush_o', 'k_fence']), x, front: true });
      if (r() < 0.6) add({ kind: 'struct', spr: r.pick(['k_shed', 'k_cottage']), x: p.x - 90, front: true });
      TA.addFolk(add, r, p, r.int(3, 5), { doors: main.map(o => o.x) });
      if (r() < 0.5) add({ kind: 'dog', x: p.x - 60, dog: r.pick(['beagle', 'black', 'white', 'shepherd']) });
    },
  },
  town: {
    w: 700, label: 'Town', icon: 'house',
    build(p, add, r) {
      const L = p.x - p.w / 2, R = p.x + p.w / 2;
      add({ kind: 'struct', bld: 'wall', x: L + 16, arch: true, z: 0 });
      add({ kind: 'struct', bld: 'wall2', x: R - 16, arch: true, z: 0 });
      TA.street(add, r, L + 40, R - 40, pickKey(r, ['k_keep', 'k_temple', 'k_houses', 'k_spire', 'k_houses', 'k_tower', 'b:spire', 'k_lamptower']), { back: true, z: -3 }, [2, 14]);
      const shops = ['k_shop_med', 'k_shop_magic', 'k_shop_arms', 'k_shop_plant', 'k_houses', 'k_cottage', 'k_house', 'b:hut', 'b:market', 'b:defense', 'b:armory'];
      const main = TA.street(add, r, L + 46, R - 46, () => r() < 0.08 ? null : pickKey(r, shops)(), { z: -1 }, [4, 12]);
      const smithy = main.find(o => o.bld === 'armory' || o.bld === 'defense' || o.spr === 'k_shop_arms');
      if (smithy) add({ kind: 'folk', x: smithy.x + 14, sheet: 'smith', role: 'work', anim: 'work', range: [smithy.x, smithy.x + 20], face: -1 });
      add({ kind: 'campfire', x: p.x, z: 1, light: 60 });
      add({ kind: 'npc', x: p.x + r.int(-40, 40), npc: 'trader' });
      add({ kind: 'chest', x: p.x + 150, tier: 2 });
      for (let x = L + 50; x < R - 50; x += r.int(50, 110)) { const spr = r.pick(['k_fence', 'bush_t', 'k_pergola', 'bush_o2', 'k_shed']); add({ kind: 'struct', spr, x, front: true }); }
      TA.addFolk(add, r, p, r.int(6, 9), { doors: main.map(o => o.x), guards: 2 });
      if (r() < 0.35) add({ kind: 'dog', x: p.x - 60, dog: r.pick(['beagle', 'black', 'white', 'shepherd']) });
    },
  },
  city: {
    w: 1100, label: 'City', icon: 'house',
    build(p, add, r) {
      const L = p.x - p.w / 2, R = p.x + p.w / 2;
      add({ kind: 'struct', bld: 'wall', x: L + 16, arch: true, z: 0 });
      add({ kind: 'struct', bld: 'ruintower', x: L + 40, z: -1 });
      add({ kind: 'struct', bld: 'wall2', x: R - 16, arch: true, z: 0 });
      add({ kind: 'struct', bld: 'spire', x: R - 40, z: -1 });
      TA.street(add, r, L + 50, R - 50, pickKey(r, ['k_keep', 'k_temple', 'k_spire', 'k_spire2', 'k_houses', 'b:spire', 'k_lamptower', 'b:manor', 'b:barracks']), { back: true, z: -3 }, [0, 8]);
      const quarter = ['k_shop_med', 'k_shop_magic', 'k_shop_arms', 'k_shop_plant', 'k_houses', 'k_house', 'b:hut', 'b:market', 'b:defense', 'b:armory', 'b:manor', 'b:barracks', 'b:lighttower', 'k_keep', 'k_temple'];
      // two quarters around a central plaza with a gate between them
      const west = TA.street(add, r, L + 60, p.x - 60, () => r() < 0.05 ? null : pickKey(r, quarter)(), { z: -1 }, [3, 10]);
      add({ kind: 'struct', spr: 'k_arch2', x: p.x, arch: true, z: 0 });
      const east = TA.street(add, r, p.x + 60, R - 60, () => r() < 0.05 ? null : pickKey(r, quarter)(), { z: -1 }, [3, 10]);
      const main = west.concat(east);
      for (const sm of main.filter(o => o.bld === 'armory' || o.bld === 'defense').slice(0, 2))
        add({ kind: 'folk', x: sm.x + 14, sheet: 'smith', role: 'work', anim: 'work', range: [sm.x, sm.x + 20], face: -1 });
      for (const lt of main.filter(o => o.bld === 'lighttower')) lt.light = 60;
      add({ kind: 'campfire', x: p.x - 30, z: 1, light: 60 });
      add({ kind: 'campfire', x: p.x + 30, z: 1, light: 60 });
      add({ kind: 'npc', x: p.x - 12, npc: 'trader' });
      add({ kind: 'npc', x: p.x + r.int(200, 300), npc: r() < 0.5 ? 'dwarf' : 'elf' });
      add({ kind: 'chest', x: p.x - 260, tier: 2 });
      add({ kind: 'chest', x: p.x + 380, tier: 3 });
      for (let x = L + 60; x < R - 60; x += r.int(40, 90)) { const spr = r.pick(['k_fence', 'bush_t', 'k_pergola', 'k_vines', 'k_shed', 'k_house']); add({ kind: 'struct', spr, x, front: true }); }
      TA.addFolk(add, r, p, r.int(12, 16), { doors: main.map(o => o.x), guards: r.int(3, 4) });
      if (r() < 0.5) add({ kind: 'dog', x: p.x + 90, dog: r.pick(['beagle', 'black', 'white', 'shepherd']) });
    },
  },
  ruin: {
    w: 280, label: 'Ruins', icon: 'ruin',
    build(p, add, r) {
      const L = p.x - p.w / 2, R = p.x + p.w / 2;
      TA.street(add, r, L + 10, R - 10, pickKey(r, ['g_ruin', 'k_tower', 'b:ruin1', 'g_fort2', 'b:ruintower']), { back: true, z: -3 }, [8, 40]);
      add({ kind: 'struct', bld: r.pick(['ruin2', 'ruin1']), x: L + 30, z: -1 });
      add({ kind: 'struct', bld: 'ruingate', x: p.x - 40, arch: true, z: 0 });
      add({ kind: 'struct', bld: r.pick(['ruintower', 'ruin1']), x: p.x + 4, z: -1 });
      add({ kind: 'struct', bld: 'ruin2', x: p.x + 34, z: -1 });
      add({ kind: 'struct', bld: 'ruin1', x: R - 30, z: -1 });
      add({ kind: 'struct', spr: 'k_arch', x: p.x + 100, z: -1 });
      for (let k = 0; k < 4; k++) add({ kind: 'decor', spr: r.pick(['rock_b', 'rock_c', 'rock_d']), x: L + 20 + r.int(0, p.w - 40), front: true });
      add({ kind: 'chest', x: p.x - 12, tier: 1 });
      if (r() < 0.5) add({ kind: 'chest', x: R - 50, tier: 2 });
      add({ kind: 'mobs', x: p.x, mobs: Array.from({ length: r.int(0, 3) }, () => 'skeleton') });
    },
  },
  camp: {
    w: 260, label: 'Goblin Camp', icon: 'camp',
    build(p, add, r) {
      const L = p.x - p.w / 2, R = p.x + p.w / 2;
      TA.street(add, r, L + 10, R - 10, pickKey(r, ['g_tower', 'g_tent', 'g_hut2', 'g_spire', 'g_ladder']), { back: true, z: -3 }, [10, 40]);
      add({ kind: 'struct', spr: 'g_tent', x: L + 30, z: -1 });
      add({ kind: 'struct', spr: 'g_tent', x: L + 52, z: -1, flip: true });
      add({ kind: 'struct', spr: 'g_totems', x: p.x - 22, z: -1 });
      add({ kind: 'flag', x: p.x + 10, flag: 'flagGoblin', z: -1 });
      add({ kind: 'struct', spr: r.pick(['g_hut', 'g_hut2', 'g_platform']), x: p.x + 46, z: -1 });
      add({ kind: 'struct', spr: 'g_platform', x: R - 34, z: -1 });
      add({ kind: 'campfire', x: p.x - 2, z: 1, light: 50 });
      add({ kind: 'chest', x: p.x + 24, tier: 2 });
      add({ kind: 'struct', spr: 'g_tusk', x: L + 14, front: true });
      add({ kind: 'struct', spr: 'g_tusk2', x: R - 12, front: true });
      add({ kind: 'mobs', x: p.x, mobs: Array.from({ length: r.int(2, 4) }, () => 'goblin') });
    },
  },
  warcamp: {
    w: 380, label: 'War Camp', icon: 'camp',
    build(p, add, r) {
      const L = p.x - p.w / 2, R = p.x + p.w / 2;
      TA.street(add, r, L + 10, R - 10, pickKey(r, ['g_tower', 'g_spire', 'g_fort', 'g_scaffold', 'g_longwall']), { back: true, z: -3 }, [4, 24]);
      add({ kind: 'struct', spr: 'g_fort', x: L + 30, z: -1 });
      add({ kind: 'struct', spr: 'g_spire', x: L + 58, z: -1 });
      add({ kind: 'struct', spr: 'g_fort2', x: p.x - 60, z: -1 });
      add({ kind: 'struct', spr: 'g_tent', x: p.x - 30, z: -1 });
      add({ kind: 'flag', x: p.x - 8, flag: 'flagGoblin', z: -1 });
      add({ kind: 'struct', spr: 'g_scaffold', x: p.x + 40, z: -1 });
      add({ kind: 'struct', spr: 'g_tent', x: p.x + 70, z: -1 });
      add({ kind: 'flag', x: p.x + 92, flag: 'flagGoblin', z: -1 });
      add({ kind: 'struct', spr: 'g_longwall', x: R - 40, z: -1 });
      add({ kind: 'campfire', x: p.x + 14, z: 1, light: 56 });
      add({ kind: 'campfire', x: R - 90, z: 1, light: 50 });
      add({ kind: 'chest', x: p.x + 58, tier: 3 });
      for (let k = 0; k < 3; k++) add({ kind: 'struct', spr: r.pick(['g_tusk', 'g_tusk2', 'g_ribs3']), x: L + 40 + k * 120 + r.int(0, 30), front: true });
      add({ kind: 'mobs', x: p.x, mobs: ['goblin_chief', ...Array.from({ length: r.int(3, 5) }, () => 'goblin')] });
    },
  },
  bones: {
    w: 200, label: 'Bone Field', icon: 'bones',
    build(p, add, r) {
      add({ kind: 'struct', spr: 'g_ribs', x: p.x - 70, z: -1 });
      add({ kind: 'struct', spr: 'g_ribs2', x: p.x - 40, z: -1, back: true });
      add({ kind: 'struct', spr: r.pick(['g_skull', 'g_skull2']), x: p.x - 4, z: -1 });
      add({ kind: 'struct', spr: 'g_bonearch', x: p.x + 30, z: -1 });
      add({ kind: 'struct', spr: 'g_tusk', x: p.x + 50, z: -1 });
      add({ kind: 'struct', spr: 'g_ribs3', x: p.x + 76, front: true });
      add({ kind: 'rock', x: p.x + 14, spr: 'rock_a', hp: 6, maxHp: 6, gems: true, rich: true, regrow: 6, z: 1 });
      add({ kind: 'mobs', x: p.x, mobs: ['skeleton', 'skeleton', ...(r() < 0.5 ? ['skeleton'] : [])], nightOnly: true });
    },
  },
  grove: {
    w: 340, label: 'Elder Grove', icon: 'grove',
    build(p, add, r) {
      const L = p.x - p.w / 2;
      add({ kind: 'struct', spr: 'e_arcade', x: p.x - 10, back: true, z: -3 });
      add({ kind: 'struct', spr: 'e_crystaltower', x: L + 30, z: -1, light: 30 });
      add({ kind: 'struct', spr: 'e_temple', x: L + 70, z: -1 });
      add({ kind: 'flag', x: L + 100, flag: 'flagElvish', z: -1 });
      add({ kind: 'struct', bld: r.pick(['elf1', 'elf2', 'elf6']), x: p.x + 30, z: -1 });
      add({ kind: 'struct', spr: r.pick(['e_totem', 'e_totem2', 'e_pillar']), x: p.x + 66, z: -1 });
      add({ kind: 'struct', spr: 'e_house', x: p.x + 100, z: -1 });
      add({ kind: 'struct', spr: r.pick(['e_ped1', 'e_ped2', 'e_ped3']), x: p.x + 130, z: -1, light: 20 });
      add({ kind: 'struct', spr: 'e_hedge', x: p.x - 40, front: true });
      add({ kind: 'npc', x: p.x, npc: 'elf' });
      TA.addFolk(add, r, p, r.int(2, 3), { sheets: ['elf', 'wizard'] });
      add({ kind: 'wildcrop', x: p.x + 48, crop: 'moonflower', regrow: 3, z: 1 });
      add({ kind: 'wildcrop', x: p.x + 146, crop: 'moonflower', regrow: 3, z: 1 });
    },
  },
  dwarves: {
    w: 220, label: 'Dig Site', icon: 'pick',
    build(p, add, r) {
      add({ kind: 'struct', spr: 'g_scaffold', x: p.x - 56, z: -1 });
      add({ kind: 'struct', spr: 'g_ladder', x: p.x + 60, z: -1 });
      add({ kind: 'struct', spr: 'g_platform', x: p.x + 84, back: true, z: -3 });
      add({ kind: 'campfire', x: p.x - 8, z: 1, light: 50 });
      add({ kind: 'npc', x: p.x + 10, npc: 'dwarf' });
      add({ kind: 'rock', x: p.x + 34, spr: 'rock_a', hp: 6, maxHp: 6, gems: true, rich: true, regrow: 5, z: 1 });
      add({ kind: 'rock', x: p.x - 84, spr: 'rock_a', hp: 6, maxHp: 6, gems: true, rich: true, regrow: 5, z: 1 });
      add({ kind: 'folk', x: p.x - 30, sheet: 'miner2', role: 'work', anim: 'work', range: [p.x - 34, p.x - 26], face: -1 });
      add({ kind: 'folk', x: p.x + 50, sheet: 'miner2', role: 'work', anim: 'work', range: [p.x + 46, p.x + 54], face: 1 });
      add({ kind: 'struct', spr: 'rock_a', x: p.x - 24, front: true });
    },
  },
  shrine: {
    w: 300, label: 'Hidden Shrine', icon: 'grove',
    build(p, add, r) {
      const L = p.x - p.w / 2, R = p.x + p.w / 2;
      add({ kind: 'struct', spr: 'e_arcade', x: p.x + 20, back: true, z: -3 });
      add({ kind: 'struct', spr: 'e_crystaltower', x: L + 26, z: -1, light: 36 });
      add({ kind: 'struct', spr: 'e_temple', x: p.x - 40, z: -1, light: 24 });
      add({ kind: 'struct', spr: 'e_crystalhouse', x: p.x + 40, z: -1, light: 24 });
      add({ kind: 'struct', spr: 'e_pillar', x: R - 30, z: -1 });
      add({ kind: 'struct', spr: 'e_arches', x: p.x - 90, front: true });
      add({ kind: 'npc', x: p.x, npc: 'hermit' });
      add({ kind: 'chest', x: p.x + 80, tier: 3 });
      for (let k = 0; k < 4; k++) add({ kind: 'wildcrop', x: L + 60 + k * 50, crop: 'moonflower', regrow: 3, z: 1 });
    },
  },
  dog: {
    w: 60, label: 'Stray', icon: 'dog',
    build(p, add, r) {
      add({ kind: 'dog', x: p.x, dog: r.pick(['beagle', 'black', 'white', 'shepherd']) });
      add({ kind: 'bush', x: p.x + 20, spr: 'bush_t', regrow: 2, z: 1 });
    },
  },
};
