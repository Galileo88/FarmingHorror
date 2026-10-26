// Starts the game.
(function () {
  const C = FH.CFG;
  FH.game = new Phaser.Game({
    type: Phaser.WEBGL, // lighting needs WebGL
    parent: 'game',
    width: C.width,
    height: C.height,
    backgroundColor: '#0d0a12',
    render: { pixelArt: true, maxLights: 12 },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { debug: false } },
    scene: [FH.BootScene, FH.TitleScene, FH.GameScene, FH.HudScene]
  });
})();
