// Builds all textures, animations and the font, then shows the title screen.
// To use PNG art instead, add this.load.spritesheet(...) calls in preload() with the
// same keys (e.g. 'farmer', 'zombie') and skip building those in art.js.
(function () {
  class BootScene extends Phaser.Scene {
    constructor() { super('boot'); }

    preload() {
      // Example for later:
      // this.load.spritesheet('farmer', 'assets/farmer.png', { frameWidth: 16, frameHeight: 16 });
    }

    create() {
      FH.Art.build(this);
      FH.Font.build(this);
      this.scene.start('title');
    }
  }

  FH.BootScene = BootScene;
})();
