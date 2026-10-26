// The farmer.
(function () {
  const C = FH.CFG;
  const DIRS = { down: [0, 1], up: [0, -1], left: [-1, 0], right: [1, 0] };

  class Player {
    constructor(scene, x, y) {
      this.scene = scene;
      this.sprite = scene.physics.add.sprite(x, y, 'farmer', 0).setLighting(true);
      this.sprite.body.setSize(8, 5).setOffset(4, 11);
      this.sprite.setCollideWorldBounds(true);
      this.shadow = scene.add.image(x, y + 7, 'shadow').setDepth(-500);
      this.facing = 'down';
      this.hearts = C.playerHearts;
      this.invuln = 0;
      this.knock = 0;
      this.dead = false;
      this.light = scene.lights.addLight(x, y, C.playerLightRadius, 0xffd9a0, 0);
    }

    get x() { return this.sprite.x; }
    get y() { return this.sprite.y; }
    get feetY() { return this.sprite.y + 6; }

    // The tile right in front of the farmer
    targetTile(field) {
      const [dx, dy] = DIRS[this.facing];
      const fx = this.sprite.x + dx * 11;
      const fy = this.feetY + dy * 11 - (dy === 0 ? 2 : 0);
      return field.tileAtPx(fx, fy);
    }

    frontPoint(dist = 12) {
      const [dx, dy] = DIRS[this.facing];
      return { x: this.sprite.x + dx * dist, y: this.sprite.y + 3 + dy * dist };
    }

    update(dt, input) {
      const s = this.sprite;
      if (this.invuln > 0) {
        this.invuln -= dt;
        s.setAlpha(Math.floor(this.invuln * 12) % 2 ? 0.35 : 1);
        if (this.invuln <= 0) s.setAlpha(1);
      }
      if (this.knock > 0) {
        this.knock -= dt;
      } else if (this.dead) {
        s.setVelocity(0, 0);
      } else {
        let vx = 0, vy = 0;
        if (input.left) vx -= 1;
        if (input.right) vx += 1;
        if (input.up) vy -= 1;
        if (input.down) vy += 1;
        if (vx && vy) { vx *= 0.7071; vy *= 0.7071; }
        // Analog thumb stick (touch screens)
        if (!vx && !vy && input.stick) {
          const m = Math.hypot(input.stick.x, input.stick.y);
          if (m > 0.25) {
            const speed = Math.min(1, m * 1.3);
            vx = (input.stick.x / m) * speed;
            vy = (input.stick.y / m) * speed;
          }
        }
        s.setVelocity(vx * C.playerSpeed, vy * C.playerSpeed);

        if (vx || vy) {
          if (Math.abs(vx) > Math.abs(vy)) this.facing = vx > 0 ? 'right' : 'left';
          else this.facing = vy > 0 ? 'down' : 'up';
          const key = this.facing === 'left' || this.facing === 'right' ? 'farmer-side' : `farmer-${this.facing}`;
          s.anims.play(key, true);
        } else {
          s.anims.stop();
          s.setFrame({ down: 0, up: 3, left: 6, right: 6 }[this.facing]);
        }
        s.setFlipX(this.facing === 'left');
      }
      s.setDepth(s.y + 6);
      this.shadow.setPosition(Math.round(s.x), Math.round(s.y + 7));
      this.light.x = s.x; this.light.y = s.y;
    }

    hurt(fromX, fromY) {
      if (this.invuln > 0 || this.dead) return false;
      this.hearts--;
      this.invuln = C.invulnTime;
      const a = Phaser.Math.Angle.Between(fromX, fromY, this.sprite.x, this.sprite.y);
      this.sprite.setVelocity(Math.cos(a) * 140, Math.sin(a) * 140);
      this.knock = 0.18;
      this.sprite.setTint(0xff6060);
      this.scene.time.delayedCall(150, () => this.sprite.clearTint());
      if (this.hearts <= 0) this.dead = true;
      return true;
    }
  }

  FH.Player = Player;
})();
