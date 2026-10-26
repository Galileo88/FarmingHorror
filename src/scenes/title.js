// Title screen.
(function () {
  const C = FH.CFG;

  class TitleScene extends Phaser.Scene {
    constructor() { super('title'); }

    create() {
      const W = C.width, H = C.height;
      this.lights.enable().setAmbientColor(0x2a2d58);

      // A little moonlit farm
      for (let y = 0; y < C.rows; y++) for (let x = 0; x < C.cols; x++) {
        let f = (x * 7 + y * 13) % 11 === 0 ? 1 : 0;
        if (x >= 16) f = 6;
        if (y >= 7 && y <= 8 && x >= 5 && x <= 13) f = 4;
        this.add.image(x * 16 + 8, y * 16 + 8, 'tiles', f).setLighting(true);
      }
      [[6, 7], [8, 8], [11, 7], [13, 8]].forEach(([x, y]) => this.add.image(x * 16 + 8, y * 16 + 8, 'pumpkin', 3).setLighting(true));
      [[7, 8], [10, 7], [12, 8]].forEach(([x, y]) => this.add.image(x * 16 + 8, y * 16 + 8, 'carrot', 2).setLighting(true));
      [[17, 6], [19, 7], [18, 9]].forEach(([x, y]) => this.add.image(x * 16 + 8, y * 16 + 8, 'tombstone').setLighting(true));
      this.add.image(9 * 16 + 8, 6 * 16 + 8, 'scarecrow').setLighting(true);
      this.add.image(3 * 16 + 8, 8 * 16 + 8, 'lantern').setLighting(true);
      this.add.image(1 * 16 + 8, 6 * 16 + 8, 'deadtree').setLighting(true);
      const z = this.add.sprite(17 * 16, 7 * 16 + 8, 'zombie').setFlipX(true).setLighting(true);
      z.anims.play('zombie-walk');
      this.tweens.add({ targets: z, x: 14 * 16, duration: 9000, yoyo: true, repeat: -1, onYoyo: () => z.setFlipX(false), onRepeat: () => z.setFlipX(true) });
      const crow = this.add.sprite(9 * 16 + 9, 5 * 16 + 12, 'crow', 0).setLighting(true);

      this.lantern = this.lights.addLight(3 * 16 + 8, 8 * 16 + 4, 70, 0xffb860, 2);
      this.moon = this.lights.addLight(W / 2, 50, 200, 0x8090ff, 0.8);
      this.zEye = this.lights.addLight(0, 0, 16, 0xff2a20, 1);
      this.z = z;

      this.fog = this.add.tileSprite(W / 2, H / 2, W, H, 'fog').setAlpha(0.6).setLighting(true);

      FH.text(this, W / 2, 22, 'Farming', 0xf2a541, { origin: 0.5, scale: 3 });
      FH.text(this, W / 2, 42, 'Horror', 0xd95763, { origin: 0.5, scale: 3 });
      FH.text(this, W / 2, 64, 'Grow by day. Survive the night.', 0xc8bcd8, { origin: 0.5 });

      const lines = [
        'WASD / arrows: move      Space: use tool',
        '1-8 or Q/E: pick tool    M: mute   P: pause'
      ];
      lines.forEach((l, i) => FH.text(this, W / 2, 140 + i * 9, l, 0x9a90a8, { origin: 0.5 }));
      const start = FH.text(this, W / 2, 162, 'Press space to start', FH.COLOR.gold, { origin: 0.5 });
      this.tweens.add({ targets: [start.main, start.shadow], alpha: 0.25, duration: 600, yoyo: true, repeat: -1 });

      const go = () => {
        FH.Audio.unlock();
        FH.Audio.play('bell');
        this.cameras.main.fadeOut(400, 13, 10, 18);
        this.time.delayedCall(420, () => this.scene.start('game'));
      };
      this.input.keyboard.once('keydown-SPACE', go);
      this.input.keyboard.once('keydown-ENTER', go);
      this.input.once('pointerdown', go);
    }

    update(time) {
      this.lantern.intensity = 1.8 + Math.sin(time / 90) * 0.15 + Math.random() * 0.1;
      this.zEye.x = this.z.x + (this.z.flipX ? -2 : 2);
      this.zEye.y = this.z.y - 3;
      this.fog.tilePositionX = time / 250;
    }
  }

  FH.TitleScene = TitleScene;
})();
