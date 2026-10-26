// Crows raid crops during the day. Walk close to shoo them, whack them with the
// shovel, or protect crops with scarecrows.
(function () {
  const C = FH.CFG;
  const FLY_ALT = 44;

  class Crow {
    constructor(scene, target) {
      this.scene = scene;
      this.field = scene.field;
      this.target = target;
      const tc = this.field.center(target);
      // Start off-screen at a random edge, above the ground
      const side = Phaser.Math.Between(0, 2);
      if (side === 0) { this.gx = Phaser.Math.Between(20, C.width - 20); this.gy = -10; }
      else if (side === 1) { this.gx = -20; this.gy = Phaser.Math.Between(20, 140); }
      else { this.gx = C.width + 20; this.gy = Phaser.Math.Between(20, 140); }
      this.alt = FLY_ALT;
      this.landX = tc.x + (this.gx < tc.x ? -6 : 6);
      this.landY = tc.y + 2;
      this.state = 'approach';
      this.timer = 0;
      this.eatTimer = 0;
      this.dead = false;
      this.cawed = false;

      this.shadow = scene.add.image(this.gx, this.gy, 'shadow').setDepth(-400).setScale(0.7);
      this.sprite = scene.add.sprite(this.gx, this.gy - this.alt, 'crow', 2).setLighting(true);
      this.sprite.anims.play('crow-fly');
    }

    pan() { return (this.gx / C.width) * 2 - 1; }

    get hittable() { return !this.dead && this.alt < 14 && (this.state === 'approach' || this.state === 'peck'); }

    flee(fromX, fromY) {
      if (this.state === 'flee' || this.state === 'leave' || this.dead) return;
      this.state = 'flee';
      const a = fromX === undefined ? -Math.PI / 2 : Phaser.Math.Angle.Between(fromX, fromY, this.gx, this.gy);
      this.vx = Math.cos(a) * 95; this.vy = Math.sin(a) * 95 - 20;
      this.sprite.anims.play('crow-fly', true);
      FH.Audio.play('flap', this.pan());
      if (Math.random() < 0.6) FH.Audio.play('caw', this.pan());
    }

    leave() {
      if (this.dead) return;
      this.state = 'leave';
      const a = Phaser.Math.Angle.Between(C.width / 2, C.height / 2, this.gx, this.gy);
      this.vx = Math.cos(a) * 70; this.vy = Math.sin(a) * 70 - 25;
      this.sprite.anims.play('crow-fly', true);
    }

    kill() {
      if (this.dead) return;
      this.dead = true;
      this.state = 'dead';
      this.scene.fx.feathers(this.sprite.x, this.sprite.y);
      FH.Audio.play('caw', this.pan());
      this.sprite.anims.stop();
      this.sprite.setFrame(0).setFlipY(true);
      this.scene.tweens.add({
        targets: this.sprite, alpha: 0, y: this.sprite.y + 4, duration: 600,
        onComplete: () => this.destroy()
      });
      this.shadow.setVisible(false);
    }

    destroy() {
      this.dead = true;
      this.gone = true;
      this.sprite.destroy();
      this.shadow.destroy();
    }

    update(dt) {
      if (this.gone || this.state === 'dead') return;
      const player = this.scene.player;
      const t = this.target;

      if (this.state === 'approach' || this.state === 'peck') {
        // Crop gone (harvested, eaten by someone else)?
        if (!t.crop || t.crop.dead) { this.leave(); }
        // Scarecrow nearby?
        else if (this.field.scarecrowNear(this.landX, this.landY)) { this.flee(this.landX, this.landY + 10); }
        // Farmer too close?
        else if (this.alt < 22 && !player.dead &&
          Phaser.Math.Distance.Between(player.x, player.feetY, this.gx, this.gy) < C.shooRadius) {
          this.flee(player.x, player.feetY);
        }
      }

      if (this.state === 'approach') {
        const d = Phaser.Math.Distance.Between(this.gx, this.gy, this.landX, this.landY);
        if (!this.cawed && this.gy > 0 && this.gx > 0 && this.gx < C.width) {
          this.cawed = true;
          FH.Audio.play('caw', this.pan());
        }
        if (d < 1.5) {
          this.gx = this.landX; this.gy = this.landY; this.alt = 0;
          this.state = 'peck';
          this.sprite.anims.play('crow-peck');
          FH.Audio.play('flap', this.pan());
        } else {
          const step = Math.min(d, C.crowSpeed * dt);
          this.gx += ((this.landX - this.gx) / d) * step;
          this.gy += ((this.landY - this.gy) / d) * step;
          this.alt = Math.min(FLY_ALT, d * 0.55);
          this.sprite.setFlipX(this.landX < this.gx);
        }
      } else if (this.state === 'peck') {
        this.eatTimer += dt;
        this.timer += dt;
        if (this.timer > 0.6) {
          this.timer = 0;
          FH.Audio.play('crunch', this.pan());
          if (t.crop) {
            this.scene.tweens.add({ targets: t.crop.sprite, x: t.crop.sprite.x + 1, duration: 50, yoyo: true });
            this.scene.fx.leaves(t.crop.sprite.x, t.crop.sprite.y);
          }
        }
        this.sprite.setFlipX(this.landX > this.field.center(t).x);
        if (this.eatTimer >= C.crowEatTime) {
          this.field.destroyCrop(t);
          this.scene.stats.crowEaten++;
          this.scene.events.emit('toast', 'A crow ate a crop!', FH.COLOR.red);
          FH.Audio.play('caw', this.pan());
          this.leave();
        }
      } else if (this.state === 'flee' || this.state === 'leave') {
        this.gx += this.vx * dt;
        this.gy += this.vy * dt;
        this.alt = Math.min(FLY_ALT, this.alt + 45 * dt);
        this.sprite.setFlipX(this.vx < 0);
        if (this.gx < -30 || this.gx > C.width + 30 || this.gy - this.alt < -30 || this.gy > C.height + 30) {
          this.destroy();
          return;
        }
      }

      const bob = this.alt > 2 ? Math.sin(this.scene.time.now / 120) * 1.5 : 0;
      this.sprite.setPosition(Math.round(this.gx), Math.round(this.gy - 6 - this.alt + bob));
      this.sprite.setDepth(this.alt > 4 ? 2000 + this.gy : this.gy + 4);
      this.shadow.setPosition(Math.round(this.gx), Math.round(this.gy + 2));
      this.shadow.setAlpha(Phaser.Math.Clamp(1 - this.alt / 60, 0.25, 1));
    }
  }

  FH.Crow = Crow;
})();
