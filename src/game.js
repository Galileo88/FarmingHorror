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
    this.side = d.side || 0;
    if (d.type === 'watchtower') { this.level = d.level || 1; this.archers = []; this.syncArchers(); }
    if (d.type === 'market') { this.stock = d.stock || {}; this.till = d.till || 0; }
  }
  get frame() { return Math.min(17, 1 + Math.floor(this.t * 10)); }
  get built() { return this.t * 10 >= 16; }
  // one archer per window, each with their own cooldown
  syncArchers() {
    while (this.archers.length < TA.TOWER_LEVELS[this.level].archers)
      this.archers.push({ cool: 0.5 + this.archers.length * 0.55, win: TA.TOWER_WINDOWS[this.archers.length], shot: 9, dir: 1 });
  }
  damage(dmg, game) {
    this.hp -= dmg; game.fx.burst(this.x, 10, '#ad8266', 4); game.shake = 1.5;
    if (this.hp <= 0) {
      game.buildings = game.buildings.filter(b => b !== this);
      game.ui.toast('A wall has fallen!', 'warn');
      game.fx.burst(this.x, 10, '#c8ac99', 14, 80);
    }
  }
  serialize() {
    const o = { type: this.type, x: this.x, hp: this.hp, side: this.side };
    if (this.level) o.level = this.level;
    if (this.stock) { o.stock = this.stock; o.till = this.till; }
    return o;
  }
};

TA.Game = class {
  constructor(opts) {
    const s = opts.save;
    this.seedStr = s ? s.seedStr : opts.seedStr;
    this.seed = TA.strSeed(this.seedStr);
    TA.game = this;
    this.day = s ? s.day : 1;
    this.time = s ? s.time : TA.START_HOUR;        // hour of day 0..24
    this.claim = s ? s.claim : null;
    this.world = new TA.World(this.seed, s && s.world, { avoidX: this.claim ? this.claim.x : null });
    const sp = s ? s.player : null;
    this.player = new TA.Player(sp ? sp.x : 18, sp ? sp.y || 0 : 0, sp ? sp.layer || 's' : 's');
    if (sp) this.player.hp = sp.hp;
    this.inv = s ? s.inv : { coin: 8, seed_wheat: 4, seed_carrot: 2 };
    this.tools = s ? s.tools : { scythe: 0, axe: 0, pick: 0 };
    this.selectedSeed = s ? s.selectedSeed : 'wheat';
    this.buildings = s ? s.buildings.map(b => new TA.Building({ ...b, instant: true })) : [];
    this.plots = s ? s.plots : [];
    this.weather = s && s.weather && s.weather.type ? s.weather : { type: 'clear', from: -1, to: -1 };
    this.stats = s ? s.stats : { kills: 0, harvested: 0, days: 1 };
    this.dog = s && s.dog ? new TA.Dog(s.dog.color, this.player.x - 16, true) : null;
    if (this.dog) { this.dog.layer = this.player.layer; this.dog.y = this.player.y; }
    this.tutorial = s ? (s.tutorial || {}) : {};

    this.mobs = []; this.npcs = []; this.folk = []; this.travellers = []; this.strays = []; this.guards = []; this.arrows = []; this.drops = [];
    this.active = new Map();    // world object id -> live entity/spawner
    this.fx = new TA.FX();
    this.repelZones = [];
    this.spawnT = 8; this.saveT = 30; this.shake = 0; this.fade = 0; this.flash = 0; this.boltT = 6;
    this.travelT = 20;
    this.lastRegion = null; this.lastCave = null; this.wasNight = this.isNight();
    this.camX = this.player.x; this.camY = Math.min(0, this.player.y - 12);
    this.rebuildGuards();
  }

  serialize() {
    const p = this.player;
    return {
      v: 2, seedStr: this.seedStr, day: this.day, time: this.time,
      player: { x: Math.round(p.x), y: Math.round(p.y), layer: p.layer, hp: p.hp },
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

  // ------------------------------------------------------------ time & weather
  get hour() { return this.time; }
  get underground() { return this.player.layer === 'c'; }
  isNight() { return this.time >= 20 || this.time < 5; }
  // Current weather and how strongly it shows (it eases in and out over ~45 minutes)
  weatherNow() {
    const w = this.weather, h = this.time;
    if (w.type === 'clear' || h < w.from || h >= w.to) return { type: 'clear', k: 0, def: TA.WEATHER.clear };
    const k = TA.clamp(Math.min((h - w.from) / 0.75, (w.to - h) / 0.75), 0, 1);
    return { type: w.type, k: TA.smooth(k), def: TA.WEATHER[w.type] };
  }
  isRaining() { const w = this.weatherNow(); return !!w.def.rain && w.k > 0.3; }
  darkness() {
    const h = this.time;
    if (h >= 7 && h < 17.5) return 0;
    if (h >= 17.5 && h < 20.5) return TA.lerp(0, 0.62, (h - 17.5) / 3);
    if (h >= 20.5 || h < 4.5) return 0.62;
    return TA.lerp(0.62, 0, (h - 4.5) / 2.5);
  }
  rollWeather() {
    const r = TA.rng(TA.hash(this.seed, this.day, 77));
    const weights = {};
    for (const [k, w] of Object.entries(TA.WEATHER)) weights[k] = w.weight;
    const type = r.weighted(weights);
    if (type === 'clear') return { type, from: -1, to: -1 };
    if (TA.WEATHER[type].morning) { const f = r.int(3, 6); return { type, from: f, to: f + r.int(4, 6) }; }
    const f = r.int(6, 15);
    return { type, from: f, to: Math.min(24, f + r.int(3, 8)) };
  }
  newDay() {
    this.day++; this.stats.days = this.day;
    for (const p of this.plots) p.wet = false;
    this.weather = this.rollWeather();
    this.world.refreshDay(this.day);
    this.ui.toast(`Day ${this.day}`, 'day');
  }
  advanceTime(dh) {
    const before = this.time;
    this.time += dh;
    if (this.time >= 24) { this.time -= 24; this.newDay(); }
    // dawn: undead crumble
    if (before < 6 && this.time >= 6) for (const m of this.mobs) if (m.def.undead && m.nightSpawn && !m.dead && m.layer === 's') { m.die(this, false); this.fx.burst(m.x, 6, '#fbb954', 8); }
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
      if (this.underground) { ok = false; why = 'You can only build above ground'; }
      else if (type === 'banner') {
        if (this.claim) continue;
        if (this.world.poiAt(p.x, 40)) { ok = false; why = 'Too close to someone else\'s land'; }
        else if (this.world.shaftAt(p.x, 60)) { ok = false; why = 'The ground here is too rough'; }
        else if (this.world.bordersIn(p.x - 220, p.x + 220).length) { ok = false; why = 'Too close to the edge of these lands'; }
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
  upgradeTower(b) {
    const next = TA.TOWER_LEVELS[b.level + 1];
    if (!next || !this.canAfford(next.cost)) return;
    this.pay(next.cost);
    b.level++; b.syncArchers(); b.t = 0; // replays the build animation
    this.fx.burst(b.x, 10, '#c8ac99', 12, 60);
    this.ui.toast(`Watchtower level ${b.level}: ${next.archers} archers at the windows`, 'good');
    this.save(true);
  }

  // ------------------------------------------------------------ market stall
  stallPrice(item) { return Math.ceil(TA.ITEMS[item].sell * TA.STALL_PREMIUM); }
  // A traveller picks a few things off the stall and pays into the till
  travellerBuys(t, m) {
    const bought = {};
    let spent = 0;
    for (let k = 0; k < 6; k++) {
      const items = Object.keys(m.stock).filter(i => m.stock[i] > 0 && this.stallPrice(i) <= t.purse - spent);
      if (!items.length) break;
      const it = items[Math.floor(Math.random() * items.length)];
      const n = Math.min(m.stock[it], 1 + Math.floor(Math.random() * 3), Math.floor((t.purse - spent) / this.stallPrice(it)));
      m.stock[it] -= n; spent += n * this.stallPrice(it); bought[it] = (bought[it] || 0) + n;
      if (!m.stock[it]) delete m.stock[it];
      if (Math.random() < 0.4) break;
    }
    if (!spent) return 0;
    m.till += spent;
    const list = Object.entries(bought).map(([i, n]) => `${n} ${TA.ITEMS[i].name}`).join(', ');
    this.ui.toast(t.virtual ? `While you were away, a traveller bought ${list} (+${spent})` : `A traveller bought ${list} (+${spent} in the till)`, 'good');
    if (!t.virtual) { this.fx.text(m.x, 30, `+${spent}`, '#f9c22b'); this.fx.burst(m.x, 14, '#f9c22b', 6); }
    return spent;
  }
  spawnTravellers(dt) {
    const h = this.time;
    if (h < 7 || h > 18.5) return;
    this.travelT -= dt;
    if (this.travelT > 0) return;
    const market = this.buildings.find(b => b.type === 'market' && b.built);
    const stocked = market && Object.values(market.stock).some(n => n > 0);
    this.travelT = stocked ? 35 + Math.random() * 45 : 60 + Math.random() * 80;
    const p = this.player;
    const nearHome = market && p.layer === 's' && Math.abs(p.x - market.x) < 500;
    if (stocked && !nearHome) { if (Math.random() < 0.7) this.travellerBuys({ purse: 20 + Math.floor(Math.random() * 60), virtual: true }, market); return; }
    if (p.layer !== 's' || this.travellers.length >= 2) return;
    // walk in from one edge of the view; when home has a stall, head past it
    let side = Math.random() < 0.5 ? -1 : 1;
    if (nearHome) side = market.x < p.x ? 1 : -1;
    const x = p.x + side * ((TA.renderer ? TA.renderer.w / 2 : 120) + 24);
    if (this.world.surfaceClamp(p.x, x) !== x) return;
    this.travellers.push(new TA.Traveller(x, -side, TA.TRAVELLERS[Math.floor(Math.random() * TA.TRAVELLERS.length)]));
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
  give(item, n = 1) {
    this.inv[item] = (this.inv[item] || 0) + n;
    this.ui.flashItem(item);
  }
  dropItem(x, item, n, base = 0) {
    for (let i = 0; i < n; i++) this.drops.push({ x: x + (Math.random() - 0.5) * 6, base, y: 4, vx: (Math.random() - 0.5) * 50, vy: 40 + Math.random() * 30, item, t: 0 });
  }
  eat() {
    const p = this.player;
    if (p.hp >= p.maxHp) { this.ui.toast('You are not hungry'); return; }
    const foods = ['berry', 'mushroom', 'meat', 'potion'].filter(k => (this.inv[k] || 0) > 0);
    if (!foods.length) { this.ui.toast('Nothing to eat. Forage berries or buy food.'); return; }
    const k = foods[0];
    const heal = TA.ITEMS[k].heal || 1;
    this.inv[k]--; p.hp = Math.min(p.maxHp, p.hp + heal);
    this.fx.text(p.x, p.y + 22, `+${heal}`, '#91db69');
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
    const p = this.player;
    if (!p.alive || p.state !== 'free') return null;
    const fx = p.x + p.dir * 8;
    const sameLevel = (o, tol = 12) => Math.abs((o.y || 0) - p.y) < tol;
    const L = p.layer;
    // creatures
    const mob = this.mobs.find(m => !m.dead && m.layer === L && Math.abs(m.x - fx) < 14 && sameLevel(m, 14));
    if (mob) return { label: 'Attack', icon: 'scythe', run: () => this.swing() };
    const near = this.world.objectsIn(p.x - 30, p.x + 30, null).filter(o => sameLevel(o, 10));
    // the way down into the caves, portals
    const mouth = near.find(o => o.kind === 'mouth' && Math.abs(o.x - p.x) < TA.HOLE);
    if (mouth && p.onGround) return { label: 'Climb down', icon: 'pick', run: () => p.drop(this) };
    const portal = near.find(o => o.kind === 'portal' && Math.abs(o.x - p.x) < 10);
    if (portal) return { label: 'Step into the portal', icon: 'moon', run: () => this.usePortal(portal.portal) };
    if (L === 's' && p.onGround) {
      // folk
      const npc = this.npcs.find(n => Math.abs(n.x - p.x) < 24);
      if (npc) return { label: 'Trade', icon: 'coin', run: () => this.ui.openShop(npc.kind) };
      const trav = this.travellers.find(t => Math.abs(t.x - p.x) < 20 && t.state === 'walk');
      if (trav) return { label: 'Trade with traveller', icon: 'coin', run: () => this.ui.openShop('trader') };
      const stray = this.strays.find(d => Math.abs(d.x - p.x) < 16);
      if (stray) return { label: this.dog ? 'Pet' : 'Adopt dog', icon: 'heart', run: () => this.adopt(stray) };
      const folk = this.folk.find(f => !f.inside && f.alpha > 0.5 && Math.abs(f.x - fx) < 10);
      if (folk) return { label: 'Talk', icon: 'heart', run: () => this.ui.toast(`"${folk.talk(this)}"`) };
    }
    // world objects in front
    const chest = near.find(o => o.kind === 'chest' && !this.world.opened[o.id] && Math.abs(o.x - p.x) < 14);
    if (chest) return { label: 'Open chest', icon: 'key', run: () => this.openChest(chest) };
    // own buildings
    const b = L === 's' && this.inClaim(p.x) ? this.buildings.find(b => b.built && b.type !== 'banner' && b.type !== 'wall' && Math.abs(b.x - p.x) < Math.min(14, b.width / 2)) : null;
    if (b) {
      if (b.type === 'hut') return this.isNight() || this.time >= 18
        ? { label: 'Sleep', icon: 'moon', run: () => this.sleep() }
        : { label: 'Rest & save', icon: 'sun', run: () => { p.hp = Math.min(p.maxHp, p.hp + 1); this.save(); } };
      if (b.type === 'market') return { label: b.till ? `Market (${b.till} in the till)` : 'Market', icon: 'coin', run: () => this.ui.openMarket(b) };
      if (b.type === 'armory') return { label: 'Upgrade tools', icon: 'axe', run: () => this.ui.openArmory() };
      if (b.type === 'watchtower') return { label: b.level < 3 ? 'Upgrade watchtower' : 'Watchtower', icon: 'banner', run: () => this.ui.openTower(b) };
    }
    // fields
    const slot = this.slotFor(fx);
    const pl = L === 's' && p.onGround ? this.plotAt(slot) : null;
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
    const obj = near.filter(o => ['tree', 'rock', 'bush', 'mushroom', 'glow', 'wildcrop'].includes(o.kind) && Math.abs(o.x - fx) < (o.kind === 'rock' ? 14 : 10))
      .sort((a, b) => Math.abs(a.x - fx) - Math.abs(b.x - fx))[0];
    if (obj) {
      if (obj.kind === 'tree') return { label: 'Chop', icon: 'axe', run: () => this.chop(obj) };
      if (obj.kind === 'rock') return { label: 'Mine', icon: 'pick', run: () => this.mine(obj) };
      if (obj.kind === 'bush') return { label: 'Forage', icon: 'berry', run: () => this.forage(obj) };
      if (obj.kind === 'mushroom') return { label: 'Pick mushroom', icon: 'mushroom', run: () => this.forage(obj) };
      if (obj.kind === 'glow') return { label: 'Gather glowbloom', icon: 'berry', run: () => this.forage(obj) };
      if (obj.kind === 'wildcrop') return { label: 'Gather wild moonflower', icon: 'moonflower', run: () => this.forage(obj) };
    }
    // till new field on your land
    if (L === 's' && p.onGround && this.inClaim(fx)) {
      const blockB = this.buildingAt(slot, 4);
      const blockN = near.some(o => (['tree', 'rock'].includes(o.kind) && Math.abs(o.x - slot) < 10) || (['campfire', 'chest', 'struct', 'flag', 'mouth'].includes(o.kind) && Math.abs(o.x - slot) < 16));
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
      for (const m of this.mobs) if (!m.dead && m.layer === p.layer && Math.abs(m.x - (p.x + p.dir * 10)) < 15 && Math.abs(m.y - p.y) < 14) m.hurt(dmg, p.x, this);
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
    const p = this.player, oy = o.y || 0;
    p.act('miner', 'mine', 3, () => {
      o.hp -= 1 + this.tools.pick;
      this.fx.burst(o.x, oy + 4, '#9babb2', 5);
      if (o.hp <= 0) {
        this.dropItem(o.x, 'stone', 2 + Math.floor(Math.random() * (o.rich ? 4 : 3)), oy);
        if (o.gems && Math.random() < (o.rich ? 0.45 : 0.15)) this.dropItem(o.x, 'gem', 1, oy);
        this.world.remove(o, this.day);
        this.fx.burst(o.x, oy + 4, '#7f708a', 12, 60);
      }
    });
  }
  forage(o) {
    const p = this.player, oy = o.y || 0;
    p.act('farmer', 'sow', 3, () => {
      if (o.kind === 'mushroom') this.dropItem(o.x, 'mushroom', 1, oy);
      else if (o.kind === 'glow') { this.dropItem(o.x, 'berry', 1, oy); if (Math.random() < 0.25) this.dropItem(o.x, 'potion', 1, oy); }
      else if (o.kind === 'wildcrop') { this.dropItem(o.x, 'seed_moonflower', 1); if (Math.random() < 0.4) this.dropItem(o.x, 'moonflower', 1); }
      else {
        const r = Math.random();
        if (r < 0.55) this.dropItem(o.x, 'berry', 1 + (Math.random() < 0.3 ? 1 : 0));
        else this.dropItem(o.x, 'fiber', 1 + (Math.random() < 0.5 ? 1 : 0));
        if (Math.random() < 0.18) this.dropItem(o.x, 'seed_berry', 1);
        if (Math.random() < 0.12) this.dropItem(o.x, r < 0.5 ? 'seed_wheat' : 'seed_carrot', 1);
      }
      this.world.remove(o, this.day);
      this.fx.burst(o.x, oy + 6, '#1ebc73', 6);
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
    for (const [k, v] of Object.entries(loot)) this.dropItem(o.x, k, v, o.y || 0);
    this.fx.burst(o.x, (o.y || 0) + 6, '#f9c22b', 12);
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

  // ------------------------------------------------------------ borders
  // Walking into the thicket at a biome border asks whether to travel on. It
  // asks once; walk back out of the thicket and in again to be asked again.
  checkBorder() {
    const p = this.player;
    if (p.layer !== 's' || !p.alive || p.state !== 'free') return;
    const bd = this.world.bordersIn(p.x - 40, p.x + 40).find(b => Math.abs(p.x - b.x) <= TA.BORDER + 8);
    if (!bd) { this.borderAsked = null; return; }
    if (this.borderAsked === bd.x || Math.abs(Math.abs(p.x - bd.x) - TA.BORDER) > 0.5) return;
    this.borderAsked = bd.x;
    this.ui.openTravel(bd, p.x < bd.x ? 1 : -1);
  }
  // Through the thicket, in a fade, out the far side
  crossBorder(bd, dir) {
    this.player.dir = dir;
    this.travel('s', bd.x + dir * (TA.BORDER + 6), 0, null);
  }
  // Back out of the thicket
  turnBack(dir) {
    const p = this.player;
    p.x -= dir * 10; p.dir = -dir;
  }

  // ------------------------------------------------------------ portals
  // Fade out, move the player (and dog) to (x, y) far away, fade back in.
  travel(layer, x, y, msg) {
    const p = this.player;
    p.state = 'action'; p.action = { hitFrame: 99, applied: true }; p.anim.set('player', 'idle', true);
    this.ui.fadeOut(() => {
      p.layer = layer; p.x = x; p.y = y; p.vy = 0; p.onGround = true; p.state = 'free'; p.action = null; p.invuln = 1;
      this.clearLayer();
      if (this.dog) { this.dog.layer = layer; this.dog.x = x - p.dir * 10; this.dog.y = y; this.dog.vy = 0; }
      this.camX = x; this.camY = layer === 'c' ? Math.min(0, y - 12) : 0;
      this.lastCave = null; // the region check in update() announces where you arrived
      if (msg) this.ui.toast(msg);
    });
  }
  // Drop everything streamed in around the old spot
  clearLayer() {
    this.active.clear();
    this.mobs = []; this.npcs = []; this.folk = []; this.strays = []; this.travellers = []; this.arrows = []; this.drops = [];
  }
  usePortal(pt) {
    const to = pt.to;
    for (const e of [pt, to]) this.world.discovered[e.id] = { x: e.x, type: 'portal', biome: this.world.biomeAt(e.x), layer: e.layer };
    this.flash = 0.8;
    this.travel(to.layer, to.x + 14, to.y, 'The portal hums and the world folds. You step out somewhere far away.');
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
      const wasUnder = p.layer !== 's';
      p.x = hut ? hut.x : banner ? banner.x : 0; p.y = 0; p.vy = 0; p.layer = 's'; p.onGround = true;
      p.hp = p.maxHp; p.state = 'free'; p.anim.set('player', 'idle', true); p.invuln = 2;
      if (wasUnder) this.clearLayer();
      this.mobs = this.mobs.filter(m => !m.nightSpawn);
      for (const m of this.mobs) if (Math.abs(m.x - p.x) < 200) m.removeMe = true;
      const h = this.time >= 6 ? 24 - this.time + 6 : 6 - this.time;
      if (this.isNight()) this.advanceTime(h);
      if (this.dog) { this.dog.x = p.x - 12; this.dog.y = 0; this.dog.layer = 's'; }
      this.camX = p.x; this.camY = 0;
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
    const objs = this.world.objectsIn(p.x - 300, p.x + 300, null);
    for (const o of objs) {
      if (this.active.has(o.id)) continue;
      if (o.kind === 'npc') { const n = new TA.NPC(o.npc, o.x, o.poi); this.npcs.push(n); this.active.set(o.id, n); }
      else if (o.kind === 'folk') { const f = new TA.Folk(o); this.folk.push(f); this.active.set(o.id, f); }
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
        const sp = { mobs: [], poi: poiId, home: o.x, layer: o.layer || 's' };
        o.mobs.forEach((t, i) => {
          const x = o.x + (i - o.mobs.length / 2) * 14;
          const m = new TA.Mob(t, x, { poi: poiId, level: lvl, layer: sp.layer, y: this.world.groundAt(x, sp.layer) });
          sp.mobs.push(m); this.mobs.push(m);
        });
        this.active.set(o.id, sp);
      } else if (o.kind === 'mouth' || o.kind === 'portal') {
        const id = o.kind === 'mouth' ? o.shaft.id : o.id;
        if (!this.world.discovered[id] && Math.abs(o.x - p.x) < 90) {
          this.world.discovered[id] = { x: o.x, type: o.kind === 'mouth' ? 'cave' : 'portal', biome: this.world.biomeAt(o.x), layer: o.layer || 's' };
          this.ui.toast(o.kind === 'mouth' ? 'Discovered: Cave entrance' : 'Discovered: a humming portal', 'discover');
        }
      }
    }
    // despawn far things
    for (const [id, e] of this.active) {
      const x = e.mobs ? e.home : e.x;
      if (Math.abs(x - p.x) > 560) {
        this.active.delete(id);
        if (e.mobs) e.mobs.forEach(m => m.removeMe = true);
        else { this.npcs = this.npcs.filter(n => n !== e); this.strays = this.strays.filter(n => n !== e); this.folk = this.folk.filter(n => n !== e); }
      } else if (e.mobs && e.mobs.length && e.mobs.every(m => m.dead)) {
        this.world.cleared[e.poi] = this.day; e.mobs = [];
        if (e.layer === 's') this.ui.toast('The camp is cleared', 'good');
      }
    }
    // discovery
    if (p.layer === 's') {
      const i = this.world.regionOf(p.x);
      for (const j of [i - 1, i, i + 1]) for (const poi of this.world.poisOfRegion(j)) {
        if (!this.world.discovered[poi.id] && Math.abs(poi.x - p.x) < poi.w / 2 + 40) {
          this.world.discovered[poi.id] = { x: poi.x, type: poi.type, biome: poi.biome };
          this.ui.toast(`Discovered: ${TA.POI_DEFS[poi.type].label}`, 'discover');
        }
      }
    }
    const ex = this.world.explored;
    ex[0] = Math.min(ex[0], Math.round(p.x)); ex[1] = Math.max(ex[1], Math.round(p.x));
  }

  spawnHostiles(dt) {
    const p = this.player;
    if (!p.alive) return;
    const night = this.isNight(), under = p.layer === 'c';
    this.spawnT -= dt;
    if (this.spawnT > 0) return;
    const viewHalf = TA.renderer ? TA.renderer.w / 2 : 200;
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = p.x + side * (viewHalf + 30 + Math.random() * 60);
    const danger = this.world.danger(x);
    if (under) {
      // the caves are always dark
      this.spawnT = Math.max(9, 22 - danger * 2);
      if (this.mobs.filter(m => m.nightSpawn && !m.dead).length >= 1 + Math.ceil(danger / 2)) return;
      if (this.world.shaftAt(x, 60)) return;
      const list = TA.CAVE_BIOMES[this.world.caveBiomeAt(x)].mobs;
      this.mobs.push(new TA.Mob(list[Math.floor(Math.random() * list.length)], x, { night: true, level: danger, layer: 'c', y: this.world.floorAt(x) }));
      return;
    }
    const biome = TA.BIOMES[this.world.biomeAt(x)];
    const list = night ? biome.night : biome.day;
    this.spawnT = night ? Math.max(4, 14 - danger * 2) : 25;
    if (!list.length) return;
    const cap = night ? 2 + danger : 1 + Math.floor(danger / 2);
    if (this.mobs.filter(m => m.nightSpawn && !m.dead).length >= cap) return;
    if (this.inClaim(x) || this.repelZones.some(L => Math.abs(x - L.x) < L.r)) return;
    if (this.world.surfaceClamp(p.x, x) !== x) return; // nothing comes through the thickets
    let type = list[Math.floor(Math.random() * list.length)];
    if (type === 'demon' && danger < 4) type = 'goblin';
    this.mobs.push(new TA.Mob(type, x, { night: true, level: danger }));
  }

  update(dt) {
    const inp = this.input, p = this.player;
    // menus pause the world; some answer to the keyboard (E / Enter, Esc)
    if (this.ui.modal) {
      const keys = this.ui.modal.keys || {};
      if (inp.hit('menu')) { if (keys.menu) this.ui.modal.onClick(keys.menu); else this.ui.closeModal(); }
      else if (keys.action && inp.hit('action')) this.ui.modal.onClick(keys.action);
      return;
    }
    if (inp.hit('build')) this.ui.openBuild();
    if (inp.hit('seed')) this.cycleSeed();
    if (inp.hit('eat')) this.eat();
    if (inp.hit('menu')) this.ui.openPause();
    if (inp.hit('action')) this.doAction();

    this.advanceTime(dt * 24 / TA.DAY_SECONDS);
    this.growCrops(dt);
    p.update(dt, this);
    this.checkBorder();
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
    this.spawnTravellers(dt);
    for (const m of this.mobs) m.update(dt, this);
    this.mobs = this.mobs.filter(m => !m.removeMe && !(m.nightSpawn && Math.abs(m.x - p.x) > 700));
    for (const n of this.npcs) n.update(dt, this);
    for (const f of this.folk) f.update(dt, this);
    for (const t of this.travellers) t.update(dt, this);
    this.travellers = this.travellers.filter(t => !t.removeMe);
    for (const d of this.strays) d.update(dt, this);
    if (this.dog) this.dog.update(dt, this);
    for (const g of this.guards) g.update(dt, this);

    // buildings: construction + archers firing from the tower windows
    for (const b of this.buildings) {
      b.t += dt;
      if (b.type !== 'watchtower' || !b.built) continue;
      const foes = this.mobs.filter(m => !m.dead && m.layer === 's' && Math.abs(m.x - b.x) < 150).sort((a, c) => Math.abs(a.x - b.x) - Math.abs(c.x - b.x));
      b.archers.forEach((a, i) => {
        a.cool -= dt; a.shot += dt;
        const foe = foes[i % Math.max(1, foes.length)];
        if (a.cool > 0 || !foe) return;
        const [wx, wy] = a.win;
        this.arrows.push(new TA.Arrow(b.x + wx, wy, foe, 1 + Math.floor(this.tools.scythe / 2)));
        a.cool = 1.6 + Math.random() * 0.3; a.shot = 0; a.dir = Math.sign(foe.x - b.x) || 1;
      });
    }
    for (const a of this.arrows) a.update(dt, this);
    this.arrows = this.arrows.filter(a => !a.done);

    // drops: bounce then get vacuumed up
    for (const d of this.drops) {
      d.t += dt;
      if (d.y > 0 || d.vy > 0) { d.vy -= 220 * dt; d.x += d.vx * dt; d.y = Math.max(0, d.y + d.vy * dt); if (d.y === 0) { d.vy = 0; d.vx = 0; } }
      if (Math.abs(d.base - p.y) > 18) continue;
      const dx = p.x - d.x;
      if (d.t > 0.45 && p.alive && Math.abs(dx) < 34) d.x += Math.sign(dx) * Math.min(Math.abs(dx), 120 * dt);
      if (d.t > 0.45 && p.alive && Math.abs(dx) < 4) { d.taken = true; this.give(d.item, 1); }
    }
    this.drops = this.drops.filter(d => !d.taken && d.t < 120);

    // region change banners
    if (p.layer === 's') {
      if (this.lastCave) { this.lastCave = null; this.tutorial.climbed = true; }
      const reg = this.world.regionOf(p.x);
      if (reg !== this.lastRegion) {
        const b = this.world.biomeOfRegion(reg);
        if (this.lastRegion !== null && b !== this.world.biomeOfRegion(this.lastRegion)) this.ui.biomeBanner(TA.BIOMES[b].name, TA.BIOMES[b].color);
        this.lastRegion = reg;
      }
    } else {
      const cb = this.world.caveBiomeAt(p.x);
      if (cb !== this.lastCave) { this.ui.biomeBanner(TA.CAVE_BIOMES[cb].name, TA.CAVE_BIOMES[cb].color, 'underground'); this.lastCave = cb; this.tutorial.cave = true; }
    }
    const night = this.isNight();
    if (night && !this.wasNight && p.layer === 's') this.ui.toast('Night falls. Creatures stir in the dark.', 'warn');
    this.wasNight = night;

    // lightning in storms
    const w = this.weatherNow();
    if (w.def.lightning && w.k > 0.5 && p.layer === 's') {
      this.boltT -= dt;
      if (this.boltT <= 0) { this.flash = 0.7; this.boltT = 5 + Math.random() * 12; }
    }
    this.flash = Math.max(0, this.flash - dt * 1.8);

    this.fx.update(dt);
    this.shake = Math.max(0, this.shake - dt * 10);
    this.saveT -= dt;
    if (this.saveT <= 0) { this.saveT = 30; this.save(true); }
  }
};
