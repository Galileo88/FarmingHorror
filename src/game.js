// ============================================================================
// Game state & rules.
// ============================================================================
window.TA = window.TA || {};
TA.SAVE_KEY = 'tinyacres_save_v1';

// A player-built structure
TA.Building = class {
  constructor(d) {
    this.type = d.type; this.x = d.x; this.t = d.instant ? 99 : 0;
    const def = TA.BUILDABLE[d.type];
    this.width = def ? def.width : 32;
    this.isWall = d.type === 'wall';
    this.maxHp = this.isWall ? 30 : 0; this.hp = d.hp ?? this.maxHp;
    this.side = d.side || 0; this.cool = 0;
  }
  get frame() { return Math.min(17, 1 + Math.floor(this.t * 10)); }
  get built() { return this.t * 10 >= 16; }
  damage(dmg, game) {
    this.hp -= dmg; game.fx.burst(this.x, 10, '#ad8266', 4); game.shake = 1.5;
    if (this.hp <= 0) {
      game.buildings = game.buildings.filter(b => b !== this);
      game.ui.toast('A wall has fallen!', 'warn');
      game.fx.burst(this.x, 10, '#c8ac99', 14, 80);
    }
  }
  serialize() { return { type: this.type, x: this.x, hp: this.hp, side: this.side }; }
};

TA.Game = class {
  constructor(opts) {
    const s = opts.save;
    this.seedStr = s ? s.seedStr : opts.seedStr;
    this.seed = TA.strSeed(this.seedStr);
    TA.game = this;
    this.day = s ? s.day : 1;
    this.time = s ? s.time : TA.START_HOUR;        // hour of day 0..24
    this.world = new TA.World(this.seed, s && s.world);
    this.player = new TA.Player(s ? s.player.x : 18);
    if (s) this.player.hp = s.player.hp;
    this.inv = s ? s.inv : { coin: 8, seed_wheat: 4, seed_carrot: 2 };
    this.tools = s ? s.tools : { scythe: 0, axe: 0, pick: 0 };
    this.selectedSeed = s ? s.selectedSeed : 'wheat';
    this.claim = s ? s.claim : null;
    this.buildings = s ? s.buildings.map(b => new TA.Building({ ...b, instant: true })) : [];
    this.plots = s ? s.plots : [];
    this.weather = s ? s.weather : { rainFrom: -1, rainTo: -1 };
    this.stats = s ? s.stats : { kills: 0, harvested: 0, days: 1 };
    this.dog = s && s.dog ? new TA.Dog(s.dog.color, this.player.x - 16, true) : null;
    this.tutorial = s ? (s.tutorial || {}) : {};

    this.mobs = []; this.npcs = []; this.strays = []; this.guards = []; this.arrows = []; this.drops = [];
    this.active = new Map();    // world object id -> live entity/spawner
    this.fx = new TA.FX();
    this.repelZones = [];
    this.spawnT = 8; this.saveT = 30; this.shake = 0; this.fade = 0;
    this.lastRegion = null; this.wasNight = this.isNight();
    this.camX = this.player.x;
    this.rebuildGuards();
  }

  serialize() {
    return {
      v: 1, seedStr: this.seedStr, day: this.day, time: this.time,
      player: { x: Math.round(this.player.x), hp: this.player.hp },
      inv: this.inv, tools: this.tools, selectedSeed: this.selectedSeed,
      claim: this.claim, buildings: this.buildings.map(b => b.serialize()), plots: this.plots,
      weather: this.weather, stats: this.stats, dog: this.dog ? { color: this.dog.color } : null,
      world: this.world.serialize(), tutorial: this.tutorial, savedAt: Date.now(),
    };
  }
  save(quiet) {
    const ok = TA.store.set(TA.SAVE_KEY, this.serialize());
    if (!quiet) this.ui.toast(ok ? 'Game saved' : 'Could not save in this browser', ok ? '' : 'warn');
  }

  // ------------------------------------------------------------ time
  get hour() { return this.time; }
  isNight() { return this.time >= 20 || this.time < 5; }
  isRaining() { const h = this.time; return h >= this.weather.rainFrom && h < this.weather.rainTo; }
  darkness() {
    const h = this.time;
    if (h >= 7 && h < 17.5) return 0;
    if (h >= 17.5 && h < 20.5) return TA.lerp(0, 0.62, (h - 17.5) / 3);
    if (h >= 20.5 || h < 4.5) return 0.62;
    return TA.lerp(0.62, 0, (h - 4.5) / 2.5);
  }
  newDay() {
    this.day++; this.stats.days = this.day;
    for (const p of this.plots) p.wet = false;
    const r = TA.rng(TA.hash(this.seed, this.day, 77));
    this.weather = r() < 0.3 ? (() => { const f = r.int(6, 16); return { rainFrom: f, rainTo: f + r.int(2, 6) }; })() : { rainFrom: -1, rainTo: -1 };
    this.world.refreshDay(this.day);
    this.ui.toast(`Day ${this.day}`, 'day');
  }
  advanceTime(dh) {
    const before = this.time;
    this.time += dh;
    if (this.time >= 24) { this.time -= 24; this.newDay(); }
    // dawn: undead crumble
    if (before < 6 && this.time >= 6) for (const m of this.mobs) if (m.def.undead && m.nightSpawn && !m.dead) { m.die(this, false); this.fx.burst(m.x, 6, '#fbb954', 8); }
  }

  // ------------------------------------------------------------ claim / buildings
  inClaim(x) { return !!this.claim && Math.abs(x - this.claim.x) <= this.claim.r; }
  has(type) { return this.buildings.some(b => b.type === type); }
  buildingAt(x, pad = 0) { return this.buildings.find(b => b.type !== 'banner' && Math.abs(b.x - x) < b.width / 2 + pad); }
  wallBetween(x0, x1) {
    for (const b of this.buildings) if (b.isWall && b.hp > 0) {
      if ((x0 <= b.x - 10 && x1 > b.x - 10) || (x0 >= b.x + 10 && x1 < b.x + 10)) return b;
    }
    return null;
  }
  rebuildGuards() {
    const n = this.buildings.filter(b => b.type === 'barracks').length;
    while (this.guards.length < n) { const b = this.buildings.find(b => b.type === 'barracks'); this.guards.push(new TA.Guard(b.x, this.claim.x)); }
  }
  canAfford(cost) { return Object.entries(cost).every(([k, v]) => (this.inv[k] || 0) >= v); }
  pay(cost) { for (const [k, v] of Object.entries(cost)) this.inv[k] -= v; }

  buildOptions() {
    const p = this.player;
    const out = [];
    for (const type of TA.BUILD_ORDER) {
      const def = TA.BUILDABLE[type];
      let ok = true, why = '';
      if (type === 'banner') {
        if (this.claim) continue;
        if (this.world.poiAt(p.x, 40)) { ok = false; why = 'Too close to someone else\'s land'; }
      } else {
        if (!this.claim) { ok = false; why = 'Plant a banner first'; }
        else if (!this.inClaim(p.x)) { ok = false; why = 'Stand on your land'; }
        else if (def.need && !this.has(def.need)) { ok = false; why = `Needs ${TA.BUILDABLE[def.need].name}`; }
        else if (type === 'wall') {
          const side = p.x < this.claim.x ? -1 : 1;
          if (this.buildings.some(b => b.type === 'wall' && b.side === side)) { ok = false; why = 'This side already has a wall'; }
        } else if (['hut', 'market', 'armory', 'manor'].includes(type) && this.has(type)) continue;
        else if (this.buildingAt(p.x, def.width / 2 - 4)) { ok = false; why = 'Something is in the way'; }
        else if (this.plots.some(pl => Math.abs(pl.x - p.x) < def.width / 2 + 6)) { ok = false; why = 'Fields are in the way'; }
      }
      if (ok && !this.canAfford(def.cost)) { ok = false; why = 'Not enough materials'; }
      out.push({ type, def, ok, why });
    }
    return out;
  }
  build(type) {
    const def = TA.BUILDABLE[type], p = this.player;
    if (!this.canAfford(def.cost)) return;
    let x = Math.round(p.x / 4) * 4, side = 0;
    if (type === 'wall') { side = p.x < this.claim.x ? -1 : 1; x = this.claim.x + side * (this.claim.r - 12); }
    this.pay(def.cost);
    if (type === 'banner') {
      this.claim = { x, r: TA.CLAIM_RADIUS };
      this.ui.toast('Land claimed! This is your homestead.', 'good');
      this.tutorial.banner = true;
    }
    const b = new TA.Building({ type, x, side });
    this.buildings.push(b);
    // clear the footprint
    for (const o of this.world.objectsIn(x - def.width, x + def.width))
      if (['tree', 'rock', 'bush', 'mushroom', 'decor'].includes(o.kind) && Math.abs(o.x - x) < def.width / 2 + 4) this.world.remove(o, this.day, true);
    if (type === 'manor') { this.claim.r += 120; this.ui.toast('Your lands grow wider.', 'good'); }
    if (type === 'barracks') this.rebuildGuards();
    if (type !== 'banner') this.ui.toast(`${def.name} built`, 'good');
    this.fx.burst(x, 4, '#c8ac99', 12, 60);
    this.save(true);
  }

  // ------------------------------------------------------------ farming
  plotAt(slot) { return this.plots.find(p => p.x === slot); }
  slotFor(x) { return Math.round(x / 16) * 16; }
  cropStage(pl) {
    if (!pl.crop) return -1;
    if (pl.prog >= 1) return 4;
    return pl.prog < 0.08 ? 0 : pl.prog < 0.38 ? 1 : pl.prog < 0.7 ? 2 : 3;
  }
  fertility(x) { return TA.BIOMES[this.world.biomeAt(x)].fertility; }

  // ------------------------------------------------------------ items
  give(item, n = 1, x) {
    this.inv[item] = (this.inv[item] || 0) + n;
    this.ui.flashItem(item);
  }
  dropItem(x, item, n) {
    for (let i = 0; i < n; i++) this.drops.push({ x: x + (Math.random() - 0.5) * 6, y: 4, vx: (Math.random() - 0.5) * 50, vy: 40 + Math.random() * 30, item, t: 0 });
  }
  eat() {
    const p = this.player;
    if (p.hp >= p.maxHp) { this.ui.toast('You are not hungry'); return; }
    const foods = ['berry', 'mushroom', 'meat', 'potion'].filter(k => (this.inv[k] || 0) > 0);
    if (!foods.length) { this.ui.toast('Nothing to eat. Forage berries or buy food.'); return; }
    const k = foods[0];
    const heal = TA.ITEMS[k].heal || 1;
    this.inv[k]--; p.hp = Math.min(p.maxHp, p.hp + heal);
    this.fx.text(p.x, 22, `+${heal}`, '#91db69');
  }
  cycleSeed() {
    const owned = TA.CROP_ORDER.filter(c => (this.inv['seed_' + c] || 0) > 0);
    const list = owned.length ? owned : TA.CROP_ORDER;
    const i = list.indexOf(this.selectedSeed);
    this.selectedSeed = list[(i + 1) % list.length];
  }
  chestLoot(tier) {
    const r = Math.random;
    const loot = { coin: Math.floor((6 + r() * 10) * tier) };
    const seeds = ['seed_wheat', 'seed_carrot', 'seed_pumpkin', 'seed_berry'];
    loot[seeds[Math.floor(r() * seeds.length)]] = 2 + Math.floor(r() * 3);
    if (r() < 0.35 * tier) loot.gem = 1;
    if (r() < 0.4) loot.meat = 1;
    if (tier >= 2 && r() < 0.5) loot.potion = 1;
    if (tier >= 3) loot.seed_moonflower = 1;
    return loot;
  }

  // ------------------------------------------------------------ the one action button
  // Returns {label, icon, run} for whatever the player is facing.
  contextTarget() {
    const p = this.player, game = this;
    if (!p.alive || p.state !== 'free') return null;
    const fx = p.x + p.dir * 8;
    // creatures
    const mob = this.mobs.find(m => !m.dead && Math.abs(m.x - fx) < 14);
    if (mob) return { label: 'Attack', icon: 'scythe', run: () => this.swing() };
    // folk
    const npc = this.npcs.find(n => Math.abs(n.x - p.x) < 24);
    if (npc) return { label: 'Trade', icon: 'coin', run: () => this.ui.openShop(npc.kind) };
    const stray = this.strays.find(d => Math.abs(d.x - p.x) < 16);
    if (stray) return { label: this.dog ? 'Pet' : 'Adopt dog', icon: 'heart', run: () => this.adopt(stray) };
    // world objects in front
    const near = this.world.objectsIn(p.x - 30, p.x + 30);
    const chest = near.find(o => o.kind === 'chest' && !this.world.opened[o.id] && Math.abs(o.x - p.x) < 14);
    if (chest) return { label: 'Open chest', icon: 'key', run: () => this.openChest(chest) };
    // own buildings
    const b = this.inClaim(p.x) ? this.buildings.find(b => b.built && b.type !== 'banner' && b.type !== 'wall' && Math.abs(b.x - p.x) < Math.min(14, b.width / 2)) : null;
    if (b) {
      if (b.type === 'hut') return this.isNight() || this.time >= 18
        ? { label: 'Sleep', icon: 'moon', run: () => this.sleep() }
        : { label: 'Rest & save', icon: 'sun', run: () => { p.hp = Math.min(p.maxHp, p.hp + 1); this.save(); } };
      if (b.type === 'market') return { label: 'Sell harvest', icon: 'coin', run: () => this.ui.openShop('market') };
      if (b.type === 'armory') return { label: 'Upgrade tools', icon: 'axe', run: () => this.ui.openArmory() };
    }
    // fields
    const slot = this.slotFor(fx);
    const pl = this.plotAt(slot);
    if (pl && Math.abs(slot - fx) <= 10) {
      const st = this.cropStage(pl);
      if (st === 4) return { label: `Harvest ${TA.CROPS[pl.crop].name}`, icon: pl.crop, slot, run: () => this.harvest(pl) };
      if (pl.crop && !pl.wet) return { label: 'Water', icon: 'can', slot, run: () => this.water(pl) };
      if (pl.crop) return { label: 'Growing...', icon: 'seed_' + pl.crop, slot, run: null };
      const seed = 'seed_' + this.selectedSeed;
      if ((this.inv[seed] || 0) > 0) return { label: `Plant ${TA.CROPS[this.selectedSeed].name}`, icon: seed, slot, run: () => this.plant(pl) };
      return { label: 'No seeds of this kind', icon: seed, slot, run: null };
    }
    // nature
    const obj = near.filter(o => ['tree', 'rock', 'bush', 'mushroom', 'wildcrop'].includes(o.kind) && Math.abs(o.x - fx) < (o.kind === 'rock' ? 14 : 10))
      .sort((a, b) => Math.abs(a.x - fx) - Math.abs(b.x - fx))[0];
    if (obj) {
      if (obj.kind === 'tree') return { label: 'Chop', icon: 'axe', run: () => this.chop(obj) };
      if (obj.kind === 'rock') return { label: 'Mine', icon: 'pick', run: () => this.mine(obj) };
      if (obj.kind === 'bush') return { label: 'Forage', icon: 'berry', run: () => this.forage(obj) };
      if (obj.kind === 'mushroom') return { label: 'Pick mushroom', icon: 'mushroom', run: () => this.forage(obj) };
      if (obj.kind === 'wildcrop') return { label: 'Gather wild moonflower', icon: 'moonflower', run: () => this.forage(obj) };
    }
    // till new field on your land
    if (this.inClaim(fx)) {
      const blockB = this.buildingAt(slot, 4);
      const blockN = near.some(o => (['tree', 'rock'].includes(o.kind) && Math.abs(o.x - slot) < 10) || (['campfire', 'chest', 'struct', 'flag'].includes(o.kind) && Math.abs(o.x - slot) < 16));
      const flag = this.buildings.find(b => b.type === 'banner' && Math.abs(b.x - slot) < 12);
      if (!blockB && !blockN && !flag && Math.abs(slot - this.claim.x) < this.claim.r - 20)
        return { label: 'Till soil', icon: 'hoe', slot, run: () => this.till(slot) };
    }
    return { label: 'Swing', icon: 'scythe', run: () => this.swing(), quiet: true };
  }
  doAction() {
    const t = this.contextTarget();
    if (t && t.run) t.run();
  }

  swing() {
    const p = this.player;
    p.act('farmer', 'scythe', 3, () => {
      const dmg = 1 + this.tools.scythe;
      for (const m of this.mobs) if (!m.dead && Math.abs(m.x - (p.x + p.dir * 10)) < 15) m.hurt(dmg, p.x, this);
    });
  }
  chop(o) {
    const p = this.player;
    p.act('lumber', 'chop', 5, () => {
      o.hp -= 1 + this.tools.axe;
      this.fx.burst(o.x, 8, '#805c45', 5);
      if (Math.random() < 0.5) this.fx.burst(o.x, 14, '#374e4a', 3);
      if (o.hp <= 0) {
        const [lo, hi] = o.yieldWood;
        this.dropItem(o.x, 'wood', lo + Math.floor(Math.random() * (hi - lo + 1)));
        if (Math.random() < 0.25) this.dropItem(o.x, 'fiber', 1);
        this.world.remove(o, this.day);
        this.fx.burst(o.x, 12, '#239063', 14, 70);
        this.tutorial.wood = true;
      }
    });
  }
  mine(o) {
    const p = this.player;
    p.act('miner', 'mine', 3, () => {
      o.hp -= 1 + this.tools.pick;
      this.fx.burst(o.x, 4, '#9babb2', 5);
      if (o.hp <= 0) {
        this.dropItem(o.x, 'stone', 2 + Math.floor(Math.random() * (o.rich ? 4 : 3)));
        if (o.gems && Math.random() < (o.rich ? 0.45 : 0.15)) this.dropItem(o.x, 'gem', 1);
        this.world.remove(o, this.day);
        this.fx.burst(o.x, 4, '#7f708a', 12, 60);
      }
    });
  }
  forage(o) {
    const p = this.player;
    p.act('farmer', 'sow', 3, () => {
      if (o.kind === 'mushroom') this.dropItem(o.x, 'mushroom', 1);
      else if (o.kind === 'wildcrop') { this.dropItem(o.x, 'seed_moonflower', 1); if (Math.random() < 0.4) this.dropItem(o.x, 'moonflower', 1); }
      else {
        const r = Math.random();
        if (r < 0.55) this.dropItem(o.x, 'berry', 1 + (Math.random() < 0.3 ? 1 : 0));
        else this.dropItem(o.x, 'fiber', 1 + (Math.random() < 0.5 ? 1 : 0));
        if (Math.random() < 0.18) this.dropItem(o.x, 'seed_berry', 1);
        if (Math.random() < 0.12) this.dropItem(o.x, r < 0.5 ? 'seed_wheat' : 'seed_carrot', 1);
      }
      this.world.remove(o, this.day);
      this.fx.burst(o.x, 6, '#1ebc73', 6);
    });
  }
  till(slot) {
    this.player.act('farmer', 'till', 3, () => {
      if (!this.plotAt(slot)) this.plots.push({ x: slot, crop: null, prog: 0, wet: false });
      this.fx.burst(slot, 2, '#674937', 8);
      this.tutorial.till = true;
    });
  }
  plant(pl) {
    const seed = 'seed_' + this.selectedSeed;
    this.player.act('farmer', 'sow', 3, () => {
      if (pl.crop || !(this.inv[seed] > 0)) return;
      this.inv[seed]--; pl.crop = this.selectedSeed; pl.prog = 0; pl.wet = this.isRaining();
    });
  }
  water(pl) {
    this.player.act('farmer', 'water', 2, () => { pl.wet = true; this.tutorial.watered = true; this.fx.drops(pl.x, 10, '#4d9be6', 8); });
  }
  harvest(pl) {
    this.player.act('farmer', 'scythe', 3, () => {
      const c = TA.CROPS[pl.crop];
      this.dropItem(pl.x, pl.crop, pl.crop === 'berry' ? 2 : 1);
      const [lo, hi] = c.seedsBack, n = lo + Math.floor(Math.random() * (hi - lo + 1));
      if (n) this.dropItem(pl.x, 'seed_' + pl.crop, n);
      this.stats.harvested++;
      if (c.regrow) { pl.prog = 0.4; } else { pl.crop = null; pl.prog = 0; }
      this.fx.burst(pl.x, 6, '#fbb954', 8);
    });
  }
  openChest(o) {
    this.world.opened[o.id] = true;
    const loot = this.chestLoot(o.tier || 1);
    for (const [k, v] of Object.entries(loot)) this.dropItem(o.x, k, v);
    this.fx.burst(o.x, 6, '#f9c22b', 12);
    this.ui.toast('Found a stash!', 'good');
  }
  adopt(d) {
    if (this.dog) { d.anim.set(d.sheet, 'sitbark', true); this.fx.text(d.x, 16, '♥', '#e83b3b'); return; }
    this.strays = this.strays.filter(s => s !== d);
    for (const [k, v] of this.active) if (v === d) { this.world.opened[k] = true; this.active.delete(k); }
    d.adopted = true; d.state = 'follow';
    this.dog = d;
    this.ui.toast('A loyal friend joins you!', 'good');
  }
  sleep() {
    this.ui.fadeOut(() => {
      // sleep until 6am
      const h = this.time >= 6 ? 24 - this.time + 6 : 6 - this.time;
      // crops grow while you sleep
      this.growCrops(h / 24 * TA.DAY_SECONDS);
      this.advanceTime(h);
      this.player.hp = this.player.maxHp;
      for (const m of this.mobs) if (m.nightSpawn) m.removeMe = true;
      this.save(true);
      this.ui.toast('You wake rested. Game saved.', 'good');
    });
  }
  onPlayerDeath() {
    this.ui.toast('You fell...', 'warn');
    setTimeout(() => this.ui.fadeOut(() => {
      const hut = this.buildings.find(b => b.type === 'hut');
      const banner = this.buildings.find(b => b.type === 'banner');
      const lost = Math.floor((this.inv.coin || 0) * 0.3);
      this.inv.coin = (this.inv.coin || 0) - lost;
      const p = this.player;
      p.x = hut ? hut.x : banner ? banner.x : 0;
      p.hp = p.maxHp; p.state = 'free'; p.anim.set('player', 'idle', true); p.invuln = 2;
      this.mobs = this.mobs.filter(m => !m.nightSpawn);
      for (const m of this.mobs) if (Math.abs(m.x - p.x) < 200) m.removeMe = true;
      const h = this.time >= 6 ? 24 - this.time + 6 : 6 - this.time;
      if (this.isNight()) this.advanceTime(h);
      if (this.dog) this.dog.x = p.x - 12;
      this.camX = p.x;
      this.ui.toast(lost ? `You wake up at ${hut ? 'your hut' : banner ? 'your banner' : 'the old campfire'}. Lost ${lost} coins.` : 'You wake up, bruised.', 'warn');
    }), 1800);
  }

  // ------------------------------------------------------------ simulation
  growCrops(dtSec) {
    const rain = this.isRaining();
    for (const pl of this.plots) {
      if (!pl.crop || pl.prog >= 1) continue;
      if (rain) pl.wet = true;
      if (!pl.wet) continue;
      const c = TA.CROPS[pl.crop];
      pl.prog = Math.min(1, pl.prog + dtSec / TA.DAY_SECONDS / c.days * this.fertility(pl.x));
    }
  }

  stream() {
    const p = this.player;
    const objs = this.world.objectsIn(p.x - 300, p.x + 300);
    for (const o of objs) {
      if (this.active.has(o.id)) continue;
      if (o.kind === 'npc') { const n = new TA.NPC(o.npc, o.x, o.poi); this.npcs.push(n); this.active.set(o.id, n); }
      else if (o.kind === 'dog') {
        if (this.world.opened[o.id] || (this.dog && this.dog.color === o.dog)) continue;
        const d = new TA.Dog(o.dog, o.x); this.strays.push(d); this.active.set(o.id, d);
      } else if (o.kind === 'mobs') {
        const poiId = o.poi;
        const cl = this.world.cleared[poiId];
        if (cl !== undefined && this.day - cl < 3) continue;
        if (o.nightOnly && !this.isNight()) continue;
        if (!o.mobs.length) continue;
        const lvl = this.world.danger(o.x);
        const sp = { mobs: [], poi: poiId };
        o.mobs.forEach((t, i) => { const m = new TA.Mob(t, o.x + (i - o.mobs.length / 2) * 14, { poi: poiId, level: lvl }); sp.mobs.push(m); this.mobs.push(m); });
        this.active.set(o.id, sp);
      }
    }
    // despawn far things
    for (const [id, e] of this.active) {
      const x = e.mobs ? (e.mobs[0] ? e.mobs[0].home : p.x + 9999) : e.x;
      if (Math.abs(x - p.x) > 560) {
        this.active.delete(id);
        if (e.mobs) e.mobs.forEach(m => m.removeMe = true);
        else { this.npcs = this.npcs.filter(n => n !== e); this.strays = this.strays.filter(n => n !== e); }
      } else if (e.mobs && e.mobs.length && e.mobs.every(m => m.dead)) {
        this.world.cleared[e.poi] = this.day; e.mobs = [];
        this.ui.toast('The camp is cleared', 'good');
      }
    }
    // discovery
    const i = this.world.regionOf(p.x);
    for (const j of [i - 1, i, i + 1]) for (const poi of this.world.poisOfRegion(j)) {
      if (!this.world.discovered[poi.id] && Math.abs(poi.x - p.x) < 110) {
        this.world.discovered[poi.id] = { x: poi.x, type: poi.type, biome: poi.biome };
        this.ui.toast(`Discovered: ${TA.POI_DEFS[poi.type].label}`, 'discover');
      }
    }
    const ex = this.world.explored;
    ex[0] = Math.min(ex[0], Math.round(p.x)); ex[1] = Math.max(ex[1], Math.round(p.x));
  }

  spawnHostiles(dt) {
    const p = this.player;
    if (!p.alive) return;
    const night = this.isNight();
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    const viewHalf = TA.renderer ? TA.renderer.w / 2 : 200;
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = p.x + side * (viewHalf + 30 + Math.random() * 60);
    const biome = TA.BIOMES[this.world.biomeAt(x)];
    const list = night ? biome.night : biome.day;
    const danger = this.world.danger(x);
    this.spawnT = night ? Math.max(4, 14 - danger * 2) : 25;
    if (!list.length) return;
    const cap = night ? 2 + danger : 1 + Math.floor(danger / 2);
    if (this.mobs.filter(m => m.nightSpawn && !m.dead).length >= cap) return;
    if (this.inClaim(x) || this.repelZones.some(L => Math.abs(x - L.x) < L.r)) return;
    let type = list[Math.floor(Math.random() * list.length)];
    if (type === 'demon' && danger < 4) type = 'goblin';
    this.mobs.push(new TA.Mob(type, x, { night: true, level: danger }));
  }

  update(dt) {
    const inp = this.input, p = this.player;
    // menus pause the world
    if (this.ui.modal) { if (inp.hit('menu')) this.ui.closeModal(); return; }
    if (inp.hit('build')) this.ui.openBuild();
    if (inp.hit('seed')) this.cycleSeed();
    if (inp.hit('eat')) this.eat();
    if (inp.hit('menu')) this.ui.openPause();
    if (inp.hit('action')) this.doAction();

    this.advanceTime(dt * 24 / TA.DAY_SECONDS);
    this.growCrops(dt);
    p.update(dt, this);
    this.stream();

    // repel zones (light)
    this.repelZones = [];
    for (const b of this.buildings) {
      if (!b.built) continue;
      if (b.type === 'lighttower') this.repelZones.push({ x: b.x, r: 120, all: true });
      if (b.type === 'banner') this.repelZones.push({ x: b.x, r: 26, all: false });
    }
    for (const o of this.world.objectsIn(p.x - 400, p.x + 400)) if (o.kind === 'campfire') this.repelZones.push({ x: o.x, r: o.light, all: false });

    this.spawnHostiles(dt);
    for (const m of this.mobs) m.update(dt, this);
    this.mobs = this.mobs.filter(m => !m.removeMe && !(m.nightSpawn && Math.abs(m.x - p.x) > 700));
    for (const n of this.npcs) n.update(dt, this);
    for (const d of this.strays) d.update(dt, this);
    if (this.dog) this.dog.update(dt, this);
    for (const g of this.guards) g.update(dt, this);

    // buildings: construction + archers
    for (const b of this.buildings) {
      b.t += dt;
      if (b.type === 'watchtower' && b.built) {
        b.cool -= dt;
        if (b.cool <= 0) {
          const foe = this.mobs.filter(m => !m.dead && Math.abs(m.x - b.x) < 150).sort((a, c) => Math.abs(a.x - b.x) - Math.abs(c.x - b.x))[0];
          if (foe) { this.arrows.push(new TA.Arrow(b.x, 26, foe, 1 + Math.floor(this.tools.scythe / 2))); b.cool = 1.6; b.aimDir = Math.sign(foe.x - b.x); }
        }
      }
    }
    for (const a of this.arrows) a.update(dt, this);
    this.arrows = this.arrows.filter(a => !a.done);

    // drops: bounce then get vacuumed up
    for (const d of this.drops) {
      d.t += dt;
      if (d.y > 0 || d.vy > 0) { d.vy -= 220 * dt; d.x += d.vx * dt; d.y = Math.max(0, d.y + d.vy * dt); if (d.y === 0) { d.vy = 0; d.vx = 0; } }
      const dx = p.x - d.x;
      if (d.t > 0.45 && p.alive && Math.abs(dx) < 34) d.x += Math.sign(dx) * Math.min(Math.abs(dx), 120 * dt);
      if (d.t > 0.45 && p.alive && Math.abs(dx) < 4) { d.taken = true; this.give(d.item, 1); }
    }
    this.drops = this.drops.filter(d => !d.taken && d.t < 120);

    // region change banner
    const reg = this.world.regionOf(p.x);
    if (reg !== this.lastRegion) {
      const b = this.world.biomeOfRegion(reg);
      if (this.lastRegion !== null && b !== this.world.biomeOfRegion(this.lastRegion)) this.ui.biomeBanner(TA.BIOMES[b].name, TA.BIOMES[b].color);
      this.lastRegion = reg;
    }
    const night = this.isNight();
    if (night && !this.wasNight) this.ui.toast('Night falls. Creatures stir in the dark.', 'warn');
    this.wasNight = night;

    this.fx.update(dt);
    this.shake = Math.max(0, this.shake - dt * 10);
    this.saveT -= dt;
    if (this.saveT <= 0) { this.saveT = 30; this.save(true); }
  }
};
