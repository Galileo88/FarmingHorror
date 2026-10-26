// The farm: ground tiles, crops, and things you place (scarecrows, lanterns, fences).
(function () {
  const C = FH.CFG;
  const TILE = { GRASS: 0, FLOWERS: 1, TUFT: 2, SOIL: 3, WET: 4, PATH: 5, GRAVE: 6, GRAVE2: 7 };
  FH.TILE = TILE;

  class Field {
    constructor(scene) {
      this.scene = scene;
      // The ground is one canvas we paint tiles onto. A single lit image is much
      // cheaper to draw than a lit tilemap layer, which keeps slow laptops smooth.
      if (scene.textures.exists('ground')) scene.textures.remove('ground');
      this.groundTex = scene.textures.createCanvas('ground', C.cols * C.tile, C.rows * C.tile);
      this.groundCtx = this.groundTex.getContext();
      this.tileSrc = scene.textures.get('tiles').getSourceImage();
      this.ground = scene.add.image(0, 0, 'ground').setOrigin(0, 0).setDepth(-1000).setLighting(true);

      // Physics groups
      this.solids = scene.physics.add.staticGroup();        // blocks the player
      this.breakables = scene.physics.add.staticGroup();    // blocks zombies (they chew through)
      this.walls = scene.physics.add.staticGroup();         // blocks zombies, can't be broken

      this.tiles = [];
      this.lanterns = [];
      this.scarecrows = [];
      this.tombstones = [];

      let seed = 42;
      const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

      for (let y = 0; y < C.rows; y++) {
        this.tiles.push([]);
        for (let x = 0; x < C.cols; x++) {
          let kind = 'grass';
          let idx = rand() < 0.08 ? TILE.FLOWERS : (rand() < 0.12 ? TILE.TUFT : TILE.GRASS);
          if (x >= 16) { kind = 'grave'; idx = rand() < 0.2 ? TILE.GRAVE2 : TILE.GRAVE; }
          if (y === 3 && x >= 1 && x <= 3) { kind = 'path'; idx = TILE.PATH; }
          this.paint(idx, x, y, false);
          this.tiles[y].push({ x, y, kind, wet: false, crop: null, obj: null });
        }
      }
      this.groundTex.refresh();

      // Farmhouse (tiles 1-2, rows 1-2)
      this.house = scene.add.image(16, 16, 'house').setOrigin(0, 0).setLighting(true).setDepth(48);
      this.addBlocker(32, 41, 26, 14, true);
      for (let y = 1; y <= 2; y++) for (let x = 1; x <= 2; x++) this.tiles[y][x].obj = { type: 'house' };
      // The house window glows at night
      this.windowLight = scene.lights.addLight(32, 40, 40, 0xffc070, 0);

      // Graveyard
      [[17, 2], [19, 3], [18, 5], [17, 7], [19, 8]].forEach(([tx, ty]) => {
        const s = scene.add.image(tx * 16 + 8, ty * 16 + 8, 'tombstone').setLighting(true).setDepth(ty * 16 + 14);
        this.addBlocker(tx * 16 + 8, ty * 16 + 12, 10, 6, false);
        this.tiles[ty][tx].obj = { type: 'tombstone', sprite: s };
        this.tombstones.push({ x: tx * 16 + 8, y: ty * 16 + 22, tx, ty });
      });
      [[16, 1], [19, 1], [16, 10], [19, 10], [0, 7], [0, 10]].forEach(([tx, ty]) => {
        const s = scene.add.image(tx * 16 + 8, ty * 16 + 8, 'deadtree').setLighting(true).setDepth(ty * 16 + 14);
        this.addBlocker(tx * 16 + 8, ty * 16 + 13, 6, 4, true);
        this.tiles[ty][tx].obj = { type: 'tree', sprite: s };
      });
    }

    paint(idx, x, y, refresh = true) {
      const T = C.tile;
      this.groundCtx.clearRect(x * T, y * T, T, T);
      this.groundCtx.drawImage(this.tileSrc, idx * T, 0, T, T, x * T, y * T, T, T);
      if (refresh) this.groundTex.refresh();
    }

    addBlocker(cx, cy, w, h, blocksZombies) {
      const z = this.scene.add.zone(cx, cy, w, h);
      this.scene.physics.add.existing(z, true);
      this.solids.add(z);
      if (blocksZombies) this.walls.add(z);
      return z;
    }

    // ---------- Queries ----------
    tile(tx, ty) { return (this.tiles[ty] && this.tiles[ty][tx]) || null; }
    tileAtPx(px, py) { return this.tile(Math.floor(px / C.tile), Math.floor(py / C.tile)); }
    center(t) { return { x: t.x * C.tile + 8, y: t.y * C.tile + 8 }; }
    inFarm(t) { return t.x >= C.farm.x1 && t.x <= C.farm.x2 && t.y >= C.farm.y1 && t.y <= C.farm.y2; }

    crops() {
      const out = [];
      for (const row of this.tiles) for (const t of row) if (t.crop && !t.crop.dead) out.push(t);
      return out;
    }

    scarecrowNear(x, y) {
      return this.scarecrows.some((s) => Phaser.Math.Distance.Between(x, y, s.x, s.y) < C.scarecrowRadius);
    }

    lanternNear(x, y, extra = 0) {
      return this.lanterns.some((l) => Phaser.Math.Distance.Between(x, y, l.x, l.y) < C.lanternRadius + extra);
    }

    // ---------- Actions (return a string reason on failure, or true) ----------
    till(t) {
      if (!t) return 'nothing there';
      if (t.kind === 'soil') return 'already tilled';
      if (t.obj) return 'something is in the way';
      if (!this.inFarm(t)) return "can't till here";
      if (t.kind !== 'grass') return "can't till here";
      t.kind = 'soil'; t.wet = false;
      this.paint(TILE.SOIL, t.x, t.y);
      return true;
    }

    water(t) {
      if (!t || t.kind !== 'soil') return 'only tilled soil needs water';
      if (t.wet) return 'already watered';
      t.wet = true;
      this.paint(TILE.WET, t.x, t.y);
      return true;
    }

    plant(t, kind) {
      if (!t || t.kind !== 'soil') return 'till the soil first';
      if (t.crop) return 'already planted';
      if (t.obj) return 'something is in the way';
      const { x, y } = this.center(t);
      const sprite = this.scene.add.sprite(x, y, kind, 0).setLighting(true).setDepth(t.y * 16 + 12);
      t.crop = { kind, stage: 0, growth: 0, sprite, dead: false };
      return true;
    }

    harvest(t) {
      if (!t || !t.crop || t.crop.stage < 3) return null;
      const kind = t.crop.kind;
      t.crop.sprite.destroy();
      t.crop = null;
      return kind;
    }

    destroyCrop(t) {
      if (!t || !t.crop) return;
      t.crop.dead = true;
      const s = t.crop.sprite;
      this.scene.tweens.add({ targets: s, alpha: 0, y: s.y + 3, duration: 300, onComplete: () => s.destroy() });
      t.crop = null;
    }

    place(t, type) {
      if (!t) return 'nothing there';
      if (t.obj) return 'something is in the way';
      if (t.crop) return 'a crop is growing there';
      if (t.kind === 'path' && type === 'fence') return 'keep the path clear';
      const { x, y } = this.center(t);
      const sprite = this.scene.add.image(x, y, type).setLighting(true).setDepth(t.y * 16 + 14);
      let body;
      if (type === 'fence') body = this.addZombieBlocker(x, y + 3, 16, 8);
      else body = this.addZombieBlocker(x, y + 6, 6, 4);
      const obj = { type, sprite, body, hp: type === 'fence' ? C.items.fence.hp : 3, tile: t };
      body.setData('obj', obj);
      t.obj = obj;
      if (type === 'scarecrow') this.scarecrows.push({ x, y, obj });
      if (type === 'lantern') {
        obj.light = this.scene.lights.addLight(x, y - 2, C.lanternLightRadius, 0xffb860, 0);
        this.lanterns.push({ x, y, obj });
      }
      return true;
    }

    addZombieBlocker(cx, cy, w, h) {
      const z = this.scene.add.zone(cx, cy, w, h);
      this.scene.physics.add.existing(z, true);
      this.solids.add(z);
      this.breakables.add(z);
      return z;
    }

    removeObj(t) {
      const obj = t && t.obj;
      if (!obj || !obj.body) return null;
      obj.sprite.destroy();
      this.solids.remove(obj.body); this.breakables.remove(obj.body);
      obj.body.destroy();
      if (obj.light) this.scene.lights.removeLight(obj.light);
      this.scarecrows = this.scarecrows.filter((s) => s.obj !== obj);
      this.lanterns = this.lanterns.filter((l) => l.obj !== obj);
      t.obj = null;
      return obj.type;
    }

    // Zombies chew on placed things
    damageObj(obj, amount = 1) {
      if (!obj || !obj.tile || obj.tile.obj !== obj) return false;
      obj.hp -= amount;
      this.scene.tweens.add({ targets: obj.sprite, x: obj.sprite.x + 1, duration: 40, yoyo: true, repeat: 1 });
      obj.sprite.setTint(0xff9090);
      this.scene.time.delayedCall(120, () => obj.sprite.active && obj.sprite.clearTint());
      if (obj.hp <= 0) {
        this.scene.fx.debris(obj.sprite.x, obj.sprite.y, 0x8a5a3c);
        this.removeObj(obj.tile);
        return true;
      }
      return false;
    }

    // ---------- Simulation ----------
    update(dt) {
      for (const row of this.tiles) for (const t of row) {
        const c = t.crop;
        if (!c || c.stage >= 3 || !t.wet) continue;
        c.growth += dt;
        const need = C.crops[c.kind].stageTime;
        if (c.growth >= need) {
          c.growth -= need;
          c.stage++;
          c.sprite.setFrame(c.stage);
          this.scene.tweens.add({ targets: c.sprite, scaleY: 1.15, duration: 90, yoyo: true });
          if (c.stage === 3) this.scene.fx.sparkle(c.sprite.x, c.sprite.y - 4);
        }
      }
    }

    dryAll() {
      for (const row of this.tiles) for (const t of row) {
        if (t.kind === 'soil' && t.wet) { t.wet = false; this.paint(TILE.SOIL, t.x, t.y, false); }
      }
      this.groundTex.refresh();
    }

    setNightLights(level) {
      // level 0 = day, 1 = full night
      this.windowLight.intensity = 1.6 * level;
      for (const l of this.lanterns) l.obj.light.intensity = 2.0 * level;
    }
  }

  FH.Field = Field;
})();
