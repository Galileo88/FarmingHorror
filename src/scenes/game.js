// The main game scene: farming by day, surviving by night.
(function () {
  const C = FH.CFG;

  FH.TOOLS = [
    { id: 'hoe', icon: 'icon_hoe', name: 'Hoe', hint: 'Till grass in the field' },
    { id: 'can', icon: 'icon_can', name: 'Watering Can', hint: 'Watered crops grow' },
    { id: 'carrot', icon: 'icon_seed_carrot', name: 'Carrot Seeds', cost: C.crops.carrot.seedCost, hint: `Grows fast, sells for ${C.crops.carrot.sellPrice}` },
    { id: 'pumpkin', icon: 'icon_seed_pumpkin', name: 'Pumpkin Seeds', cost: C.crops.pumpkin.seedCost, hint: `Slow, sells for ${C.crops.pumpkin.sellPrice}` },
    { id: 'shovel', icon: 'icon_shovel', name: 'Shovel', hint: 'Whack monsters, dig up items' },
    { id: 'scarecrow', icon: 'scarecrow', name: 'Scarecrow', cost: C.items.scarecrow.cost, hint: 'Crows stay away' },
    { id: 'lantern', icon: 'lantern', name: 'Lantern', cost: C.items.lantern.cost, hint: 'Zombies avoid the light' },
    { id: 'fence', icon: 'fence', name: 'Fence', cost: C.items.fence.cost, hint: 'Blocks zombies for a while' }
  ];

  const lerpColor = (a, b, t) => {
    t = Phaser.Math.Clamp(t, 0, 1);
    const ch = (s) => Math.round(((a >> s) & 255) + ((((b >> s) & 255) - ((a >> s) & 255)) * t));
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
  };
  const AMBIENT = { day: 0xffffff, evening: 0xffd8a8, dusk: 0x8a6a90, night: 0x2a2d58 };

  class GameScene extends Phaser.Scene {
    constructor() { super('game'); }

    create() {
      this.lights.enable().setAmbientColor(AMBIENT.day);
      this.physics.world.setBounds(0, 8, C.width, C.height - 8);

      this.fx = this.makeFx();
      this.field = new FH.Field(this);
      this.player = new FH.Player(this, 40, 64);
      this.player.facing = 'down';

      this.crows = [];
      this.zombies = [];
      this.zombieGroup = this.physics.add.group();

      this.physics.add.collider(this.player.sprite, this.field.solids);
      this.physics.add.collider(this.zombieGroup, this.field.walls);
      this.physics.add.collider(this.zombieGroup, this.zombieGroup);
      this.physics.add.collider(this.zombieGroup, this.field.breakables, (zs, body) => {
        const z = zs.getData('zombie');
        const obj = body.getData('obj');
        if (z && obj) z.chewOn(obj, this.game.loop.delta / 1000);
      });
      this.physics.add.overlap(this.player.sprite, this.zombieGroup, (ps, zs) => {
        const z = zs.getData('zombie');
        if (z && !z.dead && this.player.hurt(zs.x, zs.y)) {
          FH.Audio.play('hurt');
          this.cameras.main.shake(120, 0.01);
        }
      });

      // State
      this.day = 1;
      this.coins = C.startCoins;
      this.phase = 'day';
      this.phaseTime = 0;
      this.nightLevel = 0;
      this.selected = 0;
      this.nextUse = 0;
      this.crowTimer = 8;
      this.paused = false;
      this.won = false;
      this.resetStats();

      // Tile cursor
      this.cursor = this.add.image(0, 0, 'cursor', 0).setDepth(1900).setAlpha(0.85);

      // Night fog
      this.fog = this.add.tileSprite(C.width / 2, C.height / 2, C.width, C.height, 'fog')
        .setDepth(2500).setAlpha(0).setLighting(true);

      this.setupInput();
      this.scene.launch('hud');
      this.scene.bringToTop('hud');
      FH.Audio.music('day');

      this.time.delayedCall(400, () => this.events.emit('banner', 'Day 1', 'Plant crops. Keep the crows off them.'));
    }

    resetStats() {
      this.stats = { harvested: 0, earned: 0, crowEaten: 0, zombieEaten: 0, zombiesKilled: 0, crowsKilled: 0 };
    }

    setupInput() {
      const kb = this.input.keyboard;
      this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,J,Q,E,M,P,ESC,ONE,TWO,THREE,FOUR,FIVE,SIX,SEVEN,EIGHT');
      kb.addCapture('SPACE,UP,DOWN,LEFT,RIGHT');
      const nums = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT'];
      nums.forEach((k, i) => this.keys[k].on('down', () => this.select(i)));
      this.keys.Q.on('down', () => this.select((this.selected + FH.TOOLS.length - 1) % FH.TOOLS.length));
      this.keys.E.on('down', () => this.select((this.selected + 1) % FH.TOOLS.length));
      this.keys.M.on('down', () => this.events.emit('toast', FH.Audio.toggleMute() ? 'Sound off' : 'Sound on'));
      const pause = () => { if (this.phase !== 'dawn' && this.phase !== 'gameover') this.togglePause(); };
      this.keys.P.on('down', pause);
      this.keys.ESC.on('down', pause);
      const act = () => this.onAction();
      this.keys.SPACE.on('down', act);
      this.keys.J.on('down', act);
      this.input.on('wheel', (p, objs, dx, dy) => {
        this.select((this.selected + (dy > 0 ? 1 : FH.TOOLS.length - 1)) % FH.TOOLS.length);
      });
    }

    select(i) {
      if (this.phase === 'gameover') return;
      this.selected = i;
      this.events.emit('tool', i);
    }

    togglePause() {
      this.paused = !this.paused;
      if (this.paused) { this.physics.pause(); this.anims.pauseAll(); this.tweens.pauseAll(); }
      else { this.physics.resume(); this.anims.resumeAll(); this.tweens.resumeAll(); }
      this.events.emit('pause', this.paused);
    }

    onAction() {
      FH.Audio.unlock();
      if (this.phase === 'dawn') { this.startDay(); return; }
      if (this.phase === 'gameover') { this.scene.stop('hud'); this.scene.restart(); return; }
      if (this.paused) return;
      this.useTool();
    }

    addCoins(n, x, y) {
      this.coins += n;
      if (n > 0) this.stats.earned += n;
      if (x !== undefined) this.fx.floatText(x, y, `+${n}`, FH.COLOR.gold);
      this.events.emit('coins', this.coins);
    }

    spend(cost) {
      if (this.coins < cost) {
        this.events.emit('toast', `Need ${cost} coins`, FH.COLOR.red);
        FH.Audio.play('error');
        return false;
      }
      this.coins -= cost;
      this.events.emit('coins', this.coins);
      return true;
    }

    // ---------- Using tools ----------
    useTool() {
      if (this.time.now < this.nextUse || this.player.dead) return;
      this.nextUse = this.time.now + 200;
      const tool = FH.TOOLS[this.selected];
      const t = this.player.targetTile(this.field);
      const fail = (msg) => { if (msg) this.events.emit('toast', msg); FH.Audio.play('error'); };

      // Shovel swings even with no tile
      if (tool.id === 'shovel') { this.swingShovel(t); return; }
      if (!t) return fail();

      // Any tool harvests a ripe crop
      if (t.crop && t.crop.stage >= 3) {
        const c = this.field.center(t);
        const kind = this.field.harvest(t);
        this.stats.harvested++;
        this.addCoins(C.crops[kind].sellPrice, c.x, c.y - 10);
        this.fx.leaves(c.x, c.y);
        FH.Audio.play('harvest');
        return;
      }

      const c = this.field.center(t);
      let r;
      switch (tool.id) {
        case 'hoe':
          r = this.field.till(t);
          if (r === true) { FH.Audio.play('till'); this.fx.dirt(c.x, c.y + 4, 5); this.toolPop(tool.icon, c); } else fail(r);
          break;
        case 'can':
          r = this.field.water(t);
          if (r === true) { FH.Audio.play('water'); this.fx.water(c.x, c.y); this.toolPop(tool.icon, c); } else fail(r);
          break;
        case 'carrot':
        case 'pumpkin': {
          if (t.kind !== 'soil') return fail('till the soil first');
          if (t.crop) return fail('already planted');
          if (t.obj) return fail('something is in the way');
          if (!this.spend(tool.cost)) return;
          r = this.field.plant(t, tool.id);
          if (r === true) { FH.Audio.play('plant'); this.fx.dirt(c.x, c.y + 4, 3); } else { this.coins += tool.cost; fail(r); }
          break;
        }
        case 'scarecrow':
        case 'lantern':
        case 'fence': {
          if (t.obj) return fail('something is in the way');
          if (t.crop) return fail('a crop is growing there');
          if (!this.spend(tool.cost)) return;
          r = this.field.place(t, tool.id);
          if (r === true) {
            FH.Audio.play('place');
            this.fx.dirt(c.x, c.y + 6, 4);
            if (tool.id === 'lantern') t.obj.light.intensity = 2.0 * this.nightLevel;
          } else { this.coins += tool.cost; this.events.emit('coins', this.coins); fail(r); }
          break;
        }
      }
    }

    toolPop(icon, c) {
      const img = this.add.image(c.x, c.y - 4, icon).setDepth(1950);
      this.tweens.add({ targets: img, y: c.y - 9, alpha: 0, duration: 260, onComplete: () => img.destroy() });
    }

    swingShovel(t) {
      FH.Audio.play('swing');
      const f = this.player.frontPoint(11);
      const dirIdx = { down: 0, up: 1, right: 2, left: 3 }[this.player.facing];
      const slash = this.add.image(Math.round(f.x), Math.round(f.y), 'slash', dirIdx).setDepth(2600);
      this.tweens.add({ targets: slash, alpha: 0, duration: 160, onComplete: () => slash.destroy() });

      let hit = false;
      for (const z of this.zombies) {
        if (!z.dead && z.state !== 'rise' && Phaser.Math.Distance.Between(f.x, f.y, z.sprite.x, z.sprite.y + 3) < 14) {
          z.hit(this.player.x, this.player.y); hit = true;
        }
      }
      for (const cr of this.crows) {
        if (cr.hittable && Phaser.Math.Distance.Between(f.x, f.y, cr.gx, cr.gy) < 14) {
          cr.kill(); this.stats.crowsKilled++; hit = true;
        }
      }
      if (hit) { this.cameras.main.shake(60, 0.006); return; }

      // Dig up something you placed (partial refund)
      if (t && t.obj && t.obj.body) {
        const type = this.field.removeObj(t);
        const c = this.field.center(t);
        const refund = Math.floor(C.items[type].cost * C.refundRate);
        this.fx.dirt(c.x, c.y + 4, 5);
        FH.Audio.play('place');
        if (refund > 0) this.addCoins(refund, c.x, c.y - 10);
      }
    }

    // ---------- Day / night ----------
    clockText() {
      let h;
      if (this.phase === 'day') h = 6 + 12 * (this.phaseTime / C.dayLength);
      else if (this.phase === 'dusk') h = 18 + this.phaseTime / C.duskLength;
      else if (this.phase === 'night') h = 19 + 10 * (this.phaseTime / C.nightLength);
      else if (this.phase === 'dawn') h = 5;
      else return this.lastClock || '6:00 AM';
      h %= 24;
      const hh = Math.floor(h), mm = Math.floor((h - hh) * 6) * 10;
      const ampm = hh < 12 ? 'AM' : 'PM';
      const h12 = ((hh + 11) % 12) + 1;
      this.lastClock = `${h12}:${mm === 0 ? '00' : mm} ${ampm}`;
      return this.lastClock;
    }

    updateCycle(dt) {
      this.phaseTime += dt;
      let amb = AMBIENT.day;
      if (this.phase === 'day') {
        const k = this.phaseTime / C.dayLength;
        amb = k < 0.75 ? AMBIENT.day : lerpColor(AMBIENT.day, AMBIENT.evening, (k - 0.75) / 0.25);
        this.nightLevel = 0;
        if (this.phaseTime >= C.dayLength) this.startDusk();
      } else if (this.phase === 'dusk') {
        const k = this.phaseTime / C.duskLength;
        amb = k < 0.5 ? lerpColor(AMBIENT.evening, AMBIENT.dusk, k * 2) : lerpColor(AMBIENT.dusk, AMBIENT.night, (k - 0.5) * 2);
        this.nightLevel = k;
        if (this.phaseTime >= C.duskLength) this.startNight();
      } else if (this.phase === 'night') {
        amb = AMBIENT.night;
        this.nightLevel = 1;
        const left = C.nightLength - this.phaseTime;
        if (left < 6) { amb = lerpColor(AMBIENT.night, AMBIENT.dusk, 1 - left / 6); this.nightLevel = Math.max(0.3, left / 6); }
        this.spawnZombies();
        if (this.phaseTime >= C.nightLength) { this.startDawn(); return; }
      }
      this.lights.setAmbientColor(amb);
      this.player.light.intensity = 1.5 * this.nightLevel;
      this.field.setNightLights(this.nightLevel);
      this.fog.setAlpha(0.55 * this.nightLevel);
      this.fog.tilePositionX += dt * 4;
      this.fog.tilePositionY += dt * 1.5;
    }

    startDusk() {
      this.phase = 'dusk'; this.phaseTime = 0;
      FH.Audio.play('bell');
      FH.Audio.music('night');
      this.events.emit('banner', 'Night is coming', 'Get ready. They rise from the graves.');
      this.crows.forEach((c) => c.leave());
    }

    startNight() {
      this.phase = 'night'; this.phaseTime = 0;
      const n = C.zombieBase + C.zombiePerNight * (this.day - 1);
      this.zombieHp = C.zombieHp + Math.floor((this.day - 1) / 3);
      this.zombieQueue = Array.from({ length: n }, (_, i) => (i / n) * C.nightLength * 0.6 + Phaser.Math.FloatBetween(0, 3)).sort((a, b) => a - b);
    }

    spawnZombies() {
      while (this.zombieQueue && this.zombieQueue.length && this.zombieQueue[0] <= this.phaseTime) {
        this.zombieQueue.shift();
        const g = Phaser.Utils.Array.GetRandom(this.field.tombstones);
        const z = new FH.Zombie(this, { x: g.x + Phaser.Math.Between(-3, 3), y: g.y }, this.zombieHp);
        this.zombies.push(z);
        this.zombieGroup.add(z.sprite);
        z.sprite.body.enable = false;
      }
    }

    startDawn() {
      this.phase = 'dawn'; this.phaseTime = 0;
      this.nightLevel = 0;
      this.lights.setAmbientColor(AMBIENT.day);
      this.player.light.intensity = 0;
      this.field.setNightLights(0);
      this.fog.setAlpha(0);
      this.zombies.forEach((z) => z.die(true));
      this.zombieQueue = [];
      this.physics.pause();
      this.player.sprite.anims.stop();
      FH.Audio.music('off');
      FH.Audio.play('dawn');
      if (this.day >= C.nightsToWin && !this.won) { this.won = true; this.events.emit('summary', { won: true }); }
      else this.events.emit('summary', { won: false });
    }

    startDay() {
      this.day++;
      this.phase = 'day'; this.phaseTime = 0;
      this.crowTimer = 6;
      this.field.dryAll();
      this.player.hearts = C.playerHearts;
      this.resetStats();
      this.physics.resume();
      FH.Audio.music('day');
      this.events.emit('summaryClose');
      this.events.emit('banner', `Day ${this.day}`, 'The soil dried overnight. Water your crops.');
    }

    // ---------- Crows ----------
    updateCrowSpawner(dt) {
      if (this.phase !== 'day' || this.phaseTime > C.dayLength - 8) return;
      this.crowTimer -= dt;
      if (this.crowTimer > 0) return;
      const interval = Math.max(C.crowSpawnMin, C.crowSpawnBase - (this.day - 1) * 1.5);
      this.crowTimer = interval * Phaser.Math.FloatBetween(0.7, 1.3);
      const active = this.crows.filter((c) => c.state === 'approach' || c.state === 'peck').length;
      if (active >= C.crowMaxBase + this.day - 1) return;
      const taken = new Set(this.crows.filter((c) => c.state === 'approach' || c.state === 'peck').map((c) => c.target));
      const options = this.field.crops().filter((t) => t.crop.stage >= 1 && !taken.has(t) &&
        !this.field.scarecrowNear(this.field.center(t).x, this.field.center(t).y));
      if (!options.length) return;
      // Crows love ripe crops
      const ripe = options.filter((t) => t.crop.stage >= 3);
      const target = Phaser.Utils.Array.GetRandom(ripe.length && Math.random() < 0.7 ? ripe : options);
      this.crows.push(new FH.Crow(this, target));
    }

    // ---------- Main loop ----------
    update(time, delta) {
      if (this.paused) return;
      const dt = Math.min(delta / 1000, 0.05);
      const k = this.keys;
      const input = {
        left: k.A.isDown || k.LEFT.isDown,
        right: k.D.isDown || k.RIGHT.isDown,
        up: k.W.isDown || k.UP.isDown,
        down: k.S.isDown || k.DOWN.isDown
      };
      if (this.phase === 'dawn' || this.phase === 'gameover') {
        this.player.sprite.setVelocity(0, 0);
        return;
      }

      this.updateCycle(dt);
      this.player.update(dt, input);
      this.field.update(dt);
      this.updateCrowSpawner(dt);
      this.crows.forEach((c) => c.update(dt));
      this.crows = this.crows.filter((c) => !c.gone);
      this.zombies.forEach((z) => z.update(dt));
      this.zombies = this.zombies.filter((z) => !z.gone);

      // Cursor on the target tile
      const t = this.player.targetTile(this.field);
      if (t && !this.player.dead) {
        const c = this.field.center(t);
        this.cursor.setVisible(true).setPosition(c.x, c.y);
        this.cursor.setFrame(this.canUseOn(t) ? 0 : 1);
      } else this.cursor.setVisible(false);

      if (this.player.dead && this.phase !== 'gameover') {
        this.phase = 'gameover';
        this.physics.pause();
        FH.Audio.music('off');
        FH.Audio.play('gameOver');
        this.player.sprite.setTint(0x806080).setFlipY(true);
        this.events.emit('gameover', { day: this.day });
      }
    }

    // Is the selected tool going to do something on this tile? (cursor color)
    canUseOn(t) {
      const tool = FH.TOOLS[this.selected].id;
      if (t.crop && t.crop.stage >= 3) return true;
      switch (tool) {
        case 'hoe': return t.kind === 'grass' && !t.obj && this.field.inFarm(t);
        case 'can': return t.kind === 'soil' && !t.wet;
        case 'carrot': case 'pumpkin': return t.kind === 'soil' && !t.crop && !t.obj;
        case 'shovel': return true;
        default: return !t.obj && !t.crop && !(tool === 'fence' && t.kind === 'path');
      }
    }

    // ---------- Particle effects ----------
    makeFx() {
      const mk = (tint, cfg) => {
        const e = this.add.particles(0, 0, 'px', Object.assign({
          emitting: false, lifespan: 400, speed: { min: 15, max: 45 }, gravityY: 120,
          alpha: { start: 1, end: 0 }, tint
        }, cfg));
        e.setDepth(2400);
        return e;
      };
      const dirt = mk([0x6b4430, 0x4a2e22, 0x8a5a3c], { angle: { min: 200, max: 340 } });
      const water = mk([0x5b82c4, 0x9ec4ff], { angle: { min: 220, max: 320 }, speed: { min: 20, max: 40 }, lifespan: 350 });
      const leaves = mk([0x7fbf5a, 0xa8d672], { angle: { min: 200, max: 340 }, lifespan: 500 });
      const sparkle = mk([0xfff3b0, 0xf4d35e], { speed: { min: 10, max: 30 }, gravityY: 0, lifespan: 500 });
      const debris = this.add.particles(0, 0, 'px', {
        emitting: false, lifespan: 600, speed: { min: 20, max: 70 }, gravityY: 160, angle: { min: 200, max: 340 },
        alpha: { start: 1, end: 0 }
      }).setDepth(2400);
      const feathers = this.add.particles(0, 0, 'feather', {
        emitting: false, lifespan: 1000, speed: { min: 10, max: 40 }, gravityY: 30, alpha: { start: 1, end: 0 }
      }).setDepth(2400);
      [dirt, water, leaves, debris, feathers].forEach((e) => e.setLighting(true));
      return {
        dirt: (x, y, n = 4) => dirt.explode(n, x, y),
        water: (x, y) => water.explode(8, x, y),
        leaves: (x, y) => leaves.explode(4, x, y),
        sparkle: (x, y) => sparkle.explode(6, x, y),
        debris: (x, y, tint) => { debris.setParticleTint(tint); debris.explode(12, x, y); },
        feathers: (x, y) => feathers.explode(8, x, y),
        floatText: (x, y, str, color) => {
          const t = FH.text(this, Math.round(x - str.length * 2), Math.round(y), str, color, { depth: 3000 });
          this.tweens.add({ targets: [t.main, t.shadow], y: '-=10', alpha: 0, duration: 900, onComplete: () => t.destroy() });
        }
      };
    }
  }

  FH.GameScene = GameScene;
})();
