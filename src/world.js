// ============================================================================
// Procedural world. The world is an endless strip along x. It is split into
// biome regions (TA.REGION wide) and generation chunks (TA.CHUNK wide).
// Everything is derived from the seed; only changes (felled trees, opened
// chests, cleared camps) are stored in the save.
// ============================================================================
window.TA = window.TA || {};

TA.World = class {
  constructor(seed, saved) {
    this.seed = seed >>> 0;
    this.biomeMemo = new Map();
    this.poiMemo = new Map();
    this.chunks = new Map();          // c -> {objects:[]}
    this.removed = (saved && saved.removed) || {};     // objectId -> day removed (-1 = permanent)
    this.opened = (saved && saved.opened) || {};       // chestId -> true
    this.cleared = (saved && saved.cleared) || {};     // poiId -> day cleared
    this.discovered = (saved && saved.discovered) || {}; // poiId -> {x, type, biome}
    this.explored = (saved && saved.explored) || [0, 0];
  }
  serialize() {
    return { removed: this.removed, opened: this.opened, cleared: this.cleared, discovered: this.discovered, explored: this.explored };
  }

  // ------------------------------------------------------------ biomes
  regionOf(x) { return Math.floor((x + TA.REGION / 2) / TA.REGION); }
  regionStart(i) { return i * TA.REGION - TA.REGION / 2; }

  biomeOfRegion(i) {
    if (i === 0) return 'meadow';
    if (this.biomeMemo.has(i)) return this.biomeMemo.get(i);
    const d = Math.abs(i);
    const r = TA.rng(TA.hash(this.seed, i, 4111));
    const prev = this.biomeOfRegion(i - Math.sign(i));
    let b;
    if (r() < 0.28 && prev !== 'badlands') b = prev; // biomes form runs
    else {
      const w = { meadow: d <= 2 ? 3 : 1.2, woods: 2.6, kingdom: d >= 1 ? 2 : 0, elvish: d >= 2 ? 1.6 : 0, badlands: d >= 3 ? 1 + 0.25 * d : 0 };
      w[prev] *= 0.35;
      b = r.weighted(w);
    }
    this.biomeMemo.set(i, b);
    return b;
  }
  biomeAt(x) { return this.biomeOfRegion(this.regionOf(x)); }

  // For smooth parallax transitions: {a, b, t} where t is weight of b
  biomeBlend(x) {
    const i = this.regionOf(x);
    const a = this.biomeOfRegion(i);
    const start = this.regionStart(i), end = start + TA.REGION;
    const F = 220;
    if (x - start < F) {
      const b = this.biomeOfRegion(i - 1);
      return { a, b, t: b === a ? 0 : 0.5 * (1 - (x - start) / F) };
    }
    if (end - x < F) {
      const b = this.biomeOfRegion(i + 1);
      return { a, b, t: b === a ? 0 : 0.5 * (1 - (end - x) / F) };
    }
    return { a, b: a, t: 0 };
  }
  danger(x) {
    const i = Math.abs(this.regionOf(x));
    return TA.BIOMES[this.biomeAt(x)].danger + Math.floor(i / 3);
  }

  // ------------------------------------------------------------ points of interest
  poisOfRegion(i) {
    if (this.poiMemo.has(i)) return this.poiMemo.get(i);
    const biome = TA.BIOMES[this.biomeOfRegion(i)];
    const r = TA.rng(TA.hash(this.seed, i, 909));
    const start = this.regionStart(i);
    const out = [];
    let count = i === 0 ? 1 : r.int(1, 2);
    const slots = [0.3, 0.72];
    for (let k = 0; k < count; k++) {
      let type = i === 0 ? 'village' : r.pick(biome.pois);
      if (Math.abs(i) === 1 && (type === 'camp' || type === 'warcamp')) type = 'ruin';
      let x = start + TA.REGION * (slots[k] + (r() - 0.5) * 0.12);
      if (i === 0) x = (r() < 0.5 ? -1 : 1) * TA.REGION * 0.33; // a village near the start, never on it
      const def = TA.POI_DEFS[type];
      out.push({ id: `p${i}_${k}`, type, x: Math.round(x), w: def.w, biome: this.biomeOfRegion(i), region: i });
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

  // ------------------------------------------------------------ chunks
  getChunk(c) {
    let ch = this.chunks.get(c);
    if (!ch) { ch = this.genChunk(c); this.chunks.set(c, ch); }
    return ch;
  }
  // Objects in [x0, x1]
  objectsIn(x0, x1) {
    const out = [];
    // POI pieces can sit outside their own chunk, so look one chunk wider
    for (let c = Math.floor((x0 - 130) / TA.CHUNK); c <= Math.floor((x1 + 130) / TA.CHUNK); c++)
      for (const o of this.getChunk(c).objects) if (!o.gone && o.x >= x0 - 40 && o.x <= x1 + 40) out.push(o);
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
    const day = TA.game ? TA.game.day : 1;
    let n = 0;
    const add = (o) => {
      o.id = `${c}:${n++}`;
      o.gone = this.isRemoved(o.id, o.regrow, day);
      objects.push(o);
    };
    const blocked = (x, pad) => this.poiAt(x, pad) || Math.abs(x) < 34; // keep the start camp clear

    // ground grass and sprigs
    for (let x = x0; x < x1; x += 14) {
      const b = TA.BIOMES[this.biomeAt(x)];
      const v = r();
      const pal = b.trees.teal >= 0.5 ? 't' : 'o';
      if (v < 0.22) add({ kind: 'decor', x: x + r.int(0, 10), spr: 'grass_' + pal, flip: r() < 0.5, z: -1 });
      else if (v < 0.32 && !blocked(x, 6)) add({ kind: 'decor', x: x + r.int(0, 10), spr: `sprig_${pal}${r.int(1, 3)}`, flip: r() < 0.5, z: 1 });
    }
    // choppable trees
    for (let x = x0 + 8; x < x1; x += 18) {
      const b = TA.BIOMES[this.biomeAt(x)];
      if (r() < b.treeDensity * 0.55) {
        const xx = x + r.int(-4, 4);
        if (blocked(xx, 10)) continue;
        const set = TA.TREE_SETS[r.weighted(b.trees)];
        const spr = r.pick(set);
        const big = TA.SPR[spr][4] >= 18 || TA.SPR[spr][3] >= 16;
        add({ kind: 'tree', x: xx, spr, flip: r() < 0.5, hp: big ? 5 : 3, maxHp: big ? 5 : 3, yieldWood: big ? [3, 5] : [2, 3], regrow: 3, z: 0 });
      }
    }
    // rocks
    for (let x = x0 + 20; x < x1; x += 58) {
      const b = TA.BIOMES[this.biomeAt(x)];
      if (r() < b.rockDensity * 0.55) {
        const xx = x + r.int(-12, 12);
        if (blocked(xx, 14)) continue;
        const spr = r.pick(['rock_a', 'rock_b', 'rock_c', 'rock_d', 'rock_a']);
        const hp = spr === 'rock_a' ? 5 : 3;
        add({ kind: 'rock', x: xx, spr, hp, maxHp: hp, gems: !!b.gems, regrow: 4, z: 1 });
      }
    }
    // forage bushes & mushrooms
    for (let x = x0 + 12; x < x1; x += 40) {
      const b = TA.BIOMES[this.biomeAt(x)];
      const v = r();
      if (v < b.bushDensity * 0.45) {
        const xx = x + r.int(-8, 8);
        if (blocked(xx, 8)) continue;
        const pal = r.weighted(b.trees) === 'teal' ? 't' : 'o';
        add({ kind: 'bush', x: xx, spr: `bush_${pal}${r() < 0.5 ? '' : '2'}`, flip: r() < 0.5, regrow: 2, z: 1 });
      } else if (b.mushrooms && v < b.bushDensity * 0.45 + 0.12) {
        const xx = x + r.int(-8, 8);
        if (!blocked(xx, 8)) add({ kind: 'mushroom', x: xx, regrow: 2, z: 1 });
      }
    }
    // POI contents whose center falls in this chunk
    const i0 = this.regionOf(x0), i1 = this.regionOf(x1);
    for (let i = i0 - 1; i <= i1 + 1; i++) for (const p of this.poisOfRegion(i))
      if (p.x >= x0 && p.x < x1) TA.POI_DEFS[p.type].build(p, add, TA.rng(TA.hash(this.seed, i, p.x)), this);
    // start camp
    if (x0 <= 0 && x1 > 0) add({ kind: 'campfire', x: 0, z: 1, light: 48 });
    return { objects };
  }
};

// ---------------------------------------------------------------- POI recipes
// build(poi, add, rng, world) adds objects. Structure objects use either a static
// sprite (spr) or a building sheet (bld) drawn at its finished frame.
TA.POI_DEFS = {
  village: {
    w: 150, label: 'Village', icon: 'house',
    build(p, add, r) {
      const houses = ['k_cottage', 'k_house', 'k_shop_plant', 'k_houses', 'k_shed', 'k_tower'];
      add({ kind: 'struct', x: p.x - 52, spr: r.pick(houses), z: -1 });
      add({ kind: 'struct', x: p.x - 20, bld: 'market', z: -1 });
      add({ kind: 'struct', x: p.x + 30, spr: r.pick(houses), z: -1 });
      add({ kind: 'struct', x: p.x + 58, spr: 'k_fence', z: -1 });
      add({ kind: 'campfire', x: p.x + 6, z: 1, light: 56 });
      add({ kind: 'npc', x: p.x + 14, npc: 'trader', poi: p.id });
      if (r() < 0.5) add({ kind: 'dog', x: p.x - 36, dog: r.pick(['beagle', 'black', 'white', 'shepherd']), poi: p.id });
    },
  },
  town: {
    w: 230, label: 'Old Town', icon: 'house',
    build(p, add, r) {
      const big = ['k_keep', 'k_temple', 'k_lamptower', 'k_spire', 'k_spire2'];
      const small = ['k_shop_med', 'k_shop_magic', 'k_shop_arms', 'k_houses', 'k_cottage', 'k_house'];
      let x = p.x - 100;
      while (x < p.x + 100) {
        const s = r() < 0.4 ? r.pick(big) : r.pick(small);
        add({ kind: 'struct', x, spr: s, z: -1 });
        x += TA.SPR[s][3] + r.int(4, 14);
      }
      add({ kind: 'struct', x: p.x - 110, spr: 'k_arch2', z: -1 });
      add({ kind: 'npc', x: p.x + r.int(-30, 30), npc: 'trader', poi: p.id });
      add({ kind: 'chest', x: p.x + 70, poi: p.id, tier: 2 });
      if (r() < 0.35) add({ kind: 'dog', x: p.x - 60, dog: r.pick(['beagle', 'black', 'white', 'shepherd']), poi: p.id });
    },
  },
  ruin: {
    w: 110, label: 'Ruins', icon: 'ruin',
    build(p, add, r) {
      add({ kind: 'struct', x: p.x - 34, bld: r.pick(['ruin2', 'ruingate']), z: -1 });
      add({ kind: 'struct', x: p.x + 4, bld: r.pick(['ruintower', 'ruin1']), z: -1 });
      add({ kind: 'struct', x: p.x + 30, bld: 'ruin1', z: -1 });
      add({ kind: 'chest', x: p.x - 12, poi: p.id, tier: 1 });
      add({ kind: 'mobs', x: p.x, poi: p.id, mobs: r() < 0.5 ? ['skeleton'] : [], nightOnly: false });
    },
  },
  camp: {
    w: 120, label: 'Goblin Camp', icon: 'camp',
    build(p, add, r) {
      add({ kind: 'struct', x: p.x - 40, spr: 'g_tent', z: -1 });
      add({ kind: 'struct', x: p.x - 18, spr: 'g_totems', z: -1 });
      add({ kind: 'flag', x: p.x + 10, flag: 'flagGoblin', z: -1 });
      add({ kind: 'struct', x: p.x + 38, spr: r.pick(['g_hut', 'g_hut2', 'g_platform']), z: -1 });
      add({ kind: 'campfire', x: p.x - 2, z: 1, light: 50 });
      add({ kind: 'chest', x: p.x + 24, poi: p.id, tier: 2 });
      add({ kind: 'mobs', x: p.x, poi: p.id, mobs: ['goblin', 'goblin'] });
    },
  },
  warcamp: {
    w: 200, label: 'War Camp', icon: 'camp',
    build(p, add, r) {
      add({ kind: 'struct', x: p.x - 80, spr: 'g_fort', z: -1 });
      add({ kind: 'struct', x: p.x - 50, spr: 'g_spire', z: -1 });
      add({ kind: 'struct', x: p.x - 20, spr: 'g_fort2', z: -1 });
      add({ kind: 'flag', x: p.x + 8, flag: 'flagGoblin', z: -1 });
      add({ kind: 'struct', x: p.x + 40, spr: 'g_scaffold', z: -1 });
      add({ kind: 'struct', x: p.x + 76, spr: 'g_longwall', z: -1 });
      add({ kind: 'campfire', x: p.x + 20, z: 1, light: 56 });
      add({ kind: 'chest', x: p.x + 58, poi: p.id, tier: 3 });
      add({ kind: 'mobs', x: p.x, poi: p.id, mobs: ['goblin_chief', 'goblin', 'goblin', 'goblin'] });
    },
  },
  bones: {
    w: 120, label: 'Bone Field', icon: 'bones',
    build(p, add, r) {
      add({ kind: 'struct', x: p.x - 40, spr: 'g_ribs', z: -1 });
      add({ kind: 'struct', x: p.x - 4, spr: r.pick(['g_skull', 'g_skull2']), z: -1 });
      add({ kind: 'struct', x: p.x + 30, spr: 'g_bonearch', z: -1 });
      add({ kind: 'struct', x: p.x + 50, spr: 'g_tusk', z: -1 });
      add({ kind: 'rock', x: p.x + 14, spr: 'rock_a', hp: 6, maxHp: 6, gems: true, rich: true, regrow: 6, z: 1 });
      add({ kind: 'mobs', x: p.x, poi: p.id, mobs: ['skeleton', 'skeleton'], nightOnly: true });
    },
  },
  grove: {
    w: 200, label: 'Elder Grove', icon: 'grove',
    build(p, add, r) {
      add({ kind: 'struct', x: p.x - 76, spr: 'e_crystaltower', z: -1 });
      add({ kind: 'struct', x: p.x - 44, spr: 'e_temple', z: -1 });
      add({ kind: 'flag', x: p.x - 18, flag: 'flagElvish', z: -1 });
      add({ kind: 'struct', x: p.x + 22, bld: r.pick(['elf1', 'elf2', 'elf6']), z: -1 });
      add({ kind: 'struct', x: p.x + 56, spr: r.pick(['e_totem', 'e_totem2', 'e_pillar']), z: -1 });
      add({ kind: 'struct', x: p.x + 80, spr: 'e_portal', z: -1, light: 40 });
      add({ kind: 'npc', x: p.x, npc: 'elf', poi: p.id });
      add({ kind: 'wildcrop', x: p.x + 38, crop: 'moonflower', regrow: 3, z: 1 });
      add({ kind: 'wildcrop', x: p.x + 92, crop: 'moonflower', regrow: 3, z: 1 });
    },
  },
  dwarves: {
    w: 120, label: 'Dig Site', icon: 'pick',
    build(p, add, r) {
      add({ kind: 'struct', x: p.x - 36, spr: 'g_scaffold', z: -1 });
      add({ kind: 'struct', x: p.x + 40, spr: 'g_ladder', z: -1 });
      add({ kind: 'campfire', x: p.x - 8, z: 1, light: 50 });
      add({ kind: 'npc', x: p.x + 10, npc: 'dwarf', poi: p.id });
      add({ kind: 'rock', x: p.x + 24, spr: 'rock_a', hp: 6, maxHp: 6, gems: true, rich: true, regrow: 5, z: 1 });
      add({ kind: 'rock', x: p.x - 54, spr: 'rock_a', hp: 6, maxHp: 6, gems: true, rich: true, regrow: 5, z: 1 });
    },
  },
  dog: {
    w: 60, label: 'Stray', icon: 'dog',
    build(p, add, r) {
      add({ kind: 'dog', x: p.x, dog: r.pick(['beagle', 'black', 'white', 'shepherd']), poi: p.id });
      add({ kind: 'bush', x: p.x + 20, spr: 'bush_t', regrow: 2, z: 1 });
    },
  },
};
