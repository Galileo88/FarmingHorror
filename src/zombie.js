// Zombies rise from the graves at night and shamble toward your crops (and you).
// Fences slow them down, lanterns keep them away, the shovel puts them back in the ground.
(function () {
  const C = FH.CFG;

  class Zombie {
    constructor(scene, grave, hp) {
      this.scene = scene;
      this.field = scene.field;
      this.feetY = grave.y;
      this.hp = hp;
      this.state = 'rise';
      this.rise = 0;
      this.think = 0;
      this.chew = 0;
      this.eat = 0;
      this.stun = 0;
      this.groanIn = Phaser.Math.FloatBetween(1, 4);
      this.target = null;
      this.dead = false;

      this.sprite = scene.physics.add.sprite(grave.x, grave.y, 'zombie', 0).setLighting(true);
      this.sprite.setFlipX(true); // graves are on the right, so face left
      this.sprite.body.setSize(8, 5).setOffset(4, 11);
      this.sprite.body.enable = false;
      this.sprite.setData('zombie', this);
      this.sprite.setCrop(0, 0, 16, 1).setVisible(false);
      this.shadow = scene.add.image(grave.x, grave.y, 'shadow').setDepth(-500).setAlpha(0);
      this.eyes = scene.add.image(grave.x, grave.y, 'zombie_eyes').setFlipX(true).setAlpha(0);

      scene.fx.dirt(grave.x, grave.y, 6);
      FH.Audio.play('rise', this.pan());
    }

    pan() { return (this.sprite.x / C.width) * 2 - 1; }

    hit(fromX, fromY, dmg = 1) {
      if (this.dead || this.state === 'rise') return false;
      this.hp -= dmg;
      const a = Phaser.Math.Angle.Between(fromX, fromY, this.sprite.x, this.sprite.y);
      this.sprite.setVelocity(Math.cos(a) * 110, Math.sin(a) * 110);
      this.stun = 0.25;
      this.sprite.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL);
      this.scene.time.delayedCall(90, () => {
        if (this.sprite.active) this.sprite.clearTint().setTintMode(Phaser.TintModes.MULTIPLY);
      });
      FH.Audio.play('hit', this.pan());
      if (this.hp <= 0) this.die(false);
      return true;
    }

    die(burned) {
      if (this.dead) return;
      this.dead = true;
      this.state = 'dead';
      this.sprite.body.enable = false;
      this.sprite.anims.stop();
      this.eyes.setVisible(false);
      FH.Audio.play('zombieDie', this.pan());
      if (burned) {
        this.sprite.setTint(0xffa040);
        this.scene.fx.debris(this.sprite.x, this.sprite.y, 0xff8030);
      } else {
        this.scene.fx.debris(this.sprite.x, this.sprite.y, 0x7e9a5a);
        this.scene.stats.zombiesKilled++;
        this.scene.addCoins(1, this.sprite.x, this.sprite.y - 8);
      }
      // Sink back into the ground
      let h = 16;
      this.scene.tweens.addCounter({
        from: 16, to: 0, duration: 700,
        onUpdate: (tw) => {
          h = Math.round(tw.getValue());
          this.sprite.setCrop(0, 0, 16, h);
          this.sprite.y = this.feetY - h + 8;
        },
        onComplete: () => this.destroy()
      });
      this.shadow.setVisible(false);
    }

    destroy() {
      this.gone = true;
      this.eyes.destroy();
      this.sprite.destroy();
      this.shadow.destroy();
    }

    chooseTarget() {
      const p = this.scene.player;
      const zx = this.sprite.x, zy = this.sprite.y + 6;
      if (!p.dead && Phaser.Math.Distance.Between(zx, zy, p.x, p.feetY) < C.zombieChaseRadius) {
        this.target = { type: 'player' };
        return;
      }
      let best = null, bestD = Infinity;
      for (const t of this.field.crops()) {
        const c = this.field.center(t);
        if (this.field.lanternNear(c.x, c.y)) continue;
        const d = Phaser.Math.Distance.Between(zx, zy, c.x, c.y);
        if (d < bestD) { bestD = d; best = t; }
      }
      this.target = best ? { type: 'crop', tile: best } : (p.dead ? null : { type: 'player' });
    }

    // Called by the physics collider when bumping into a fence/scarecrow/lantern
    chewOn(obj, dt) {
      this.chew += dt;
      if (this.chew > 0.9) {
        this.chew = 0;
        FH.Audio.play('crunch', this.pan());
        this.field.damageObj(obj, 1);
      }
    }

    syncEyes(on) {
      const s = this.sprite;
      this.eyes.setPosition(s.x, s.y).setFlipX(s.flipX).setDepth(s.depth + 0.5);
      this.eyes.setAlpha(on * this.scene.nightLevel);
    }

    update(dt) {
      if (this.gone || this.dead) return;
      const s = this.sprite;

      if (this.state === 'rise') {
        this.rise += dt;
        const k = Math.min(1, this.rise / C.zombieRiseTime);
        const h = Math.round(16 * k);
        s.setCrop(0, 0, 16, h);
        s.y = this.feetY - h + 8;
        s.setVisible(h > 0);
        s.setDepth(this.feetY);
        if (Math.random() < 0.3) this.scene.fx.dirt(s.x, this.feetY - 2, 1);
        this.syncEyes(h >= 7 ? 1 : 0);
        if (k >= 1) {
          this.state = 'walk';
          s.body.enable = true;
          s.body.reset(s.x, s.y);
          s.anims.play('zombie-walk');
          this.shadow.setAlpha(1);
          FH.Audio.play('groan', this.pan());
        }
        return;
      }

      this.groanIn -= dt;
      if (this.groanIn <= 0) {
        this.groanIn = Phaser.Math.FloatBetween(4, 9);
        FH.Audio.play('groan', this.pan());
      }

      if (this.stun > 0) {
        this.stun -= dt;
        s.setVelocity(s.body.velocity.x * 0.85, s.body.velocity.y * 0.85);
      } else {
        this.think -= dt;
        if (this.think <= 0 || !this.target || (this.target.type === 'crop' && !this.target.tile.crop)) {
          this.think = 0.5;
          this.chooseTarget();
          if (this.state === 'eat' && (!this.target || this.target.type !== 'crop')) this.state = 'walk';
        }

        const zx = s.x, zy = s.y + 6;
        let tx = zx, ty = zy;
        if (this.target && this.target.type === 'player') { tx = this.scene.player.x; ty = this.scene.player.feetY; }
        else if (this.target && this.target.type === 'crop') { const c = this.field.center(this.target.tile); tx = c.x; ty = c.y + 2; }

        const d = Phaser.Math.Distance.Between(zx, zy, tx, ty);
        if (this.target && this.target.type === 'crop' && d < 5) {
          // Munch
          if (this.state !== 'eat') { this.state = 'eat'; this.eat = 0; }
          s.setVelocity(0, 0);
          this.eat += dt;
          this.chew += dt;
          if (this.chew > 0.5) {
            this.chew = 0;
            FH.Audio.play('crunch', this.pan());
            const cs = this.target.tile.crop && this.target.tile.crop.sprite;
            if (cs) this.scene.fx.leaves(cs.x, cs.y);
          }
          if (this.eat >= C.zombieEatTime) {
            this.field.destroyCrop(this.target.tile);
            this.scene.stats.zombieEaten++;
            this.scene.events.emit('toast', 'A zombie ate a crop!', FH.COLOR.red);
            this.state = 'walk';
            this.target = null;
          }
        } else if (this.target) {
          this.state = 'walk';
          let speed = C.zombieSpeed + (this.scene.day - 1) * 1.5;
          if (this.field.lanternNear(zx, zy)) speed *= 0.45;
          const wob = Math.sin((this.scene.time.now + s.x * 37) / 260) * 0.35;
          const a = Phaser.Math.Angle.Between(zx, zy, tx, ty) + wob;
          s.setVelocity(Math.cos(a) * speed, Math.sin(a) * speed);
          if (Math.abs(tx - zx) > 2) s.setFlipX(tx < zx);
        } else {
          s.setVelocity(0, 0);
        }
      }

      s.setDepth(s.y + 6);
      this.shadow.setPosition(Math.round(s.x), Math.round(s.y + 7));
      this.syncEyes(1);
    }
  }

  FH.Zombie = Zombie;
})();
