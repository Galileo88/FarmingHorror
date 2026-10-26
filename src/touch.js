// Touch controls for phones and tablets (landscape).
//  - Left half of the screen: a floating thumb stick appears where you touch.
//  - Right half: tap to use the selected tool (the round button shows which one).
//  - Tap the hotbar to pick a tool, tap II to pause.
(function () {
  const C = FH.CFG;
  const W = C.width, H = C.height;
  const STICK_R = 16;
  const REST = { x: 34, y: 136 };          // where the stick sits when idle
  const ACTION = { x: W - 30, y: 132, r: 17 };

  FH.isTouch = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
    ('ontouchstart' in window && navigator.maxTouchPoints > 0);

  // Current stick vector, read by the game scene every frame (-1..1 on each axis)
  FH.touch = { x: 0, y: 0 };

  // "Press space to X" on keyboards, "Tap to X" on touch screens
  FH.prompt = (action) => (FH.isTouch ? `Tap to ${action}` : `Press space to ${action}`);

  // Fullscreen + landscape lock where the browser allows it (Android Chrome).
  // iPhones don't support this; there, "Add to Home Screen" gives a fullscreen app.
  FH.goFullscreen = (scene) => {
    try {
      if (scene.scale.fullscreen.available && !scene.scale.isFullscreen) scene.scale.startFullscreen();
      const o = screen.orientation;
      if (o && o.lock) o.lock('landscape').catch(() => {});
    } catch (e) { /* not supported, that's fine */ }
  };

  FH.Touch = {
    attach(hud) {
      const game = hud.game$;
      hud.input.addPointer(2); // allow moving and tapping at the same time

      const ui = hud.add.container(0, 0).setDepth(50);
      const base = hud.add.circle(REST.x, REST.y, STICK_R, 0xffffff, 0.1).setStrokeStyle(1, 0xffffff, 0.35);
      const knob = hud.add.circle(REST.x, REST.y, 7, 0xffffff, 0.35);
      const btn = hud.add.circle(ACTION.x, ACTION.y, ACTION.r, 0xf4d35e, 0.18).setStrokeStyle(1, 0xfff3b0, 0.7);
      const btnIcon = hud.add.image(ACTION.x, ACTION.y, FH.TOOLS[game.selected].icon).setAlpha(0.85);

      const pauseBg = hud.add.rectangle(W - 50, 1, 11, 9, 0x4a3f5c, 0.9).setOrigin(0, 0)
        .setStrokeStyle(1, 0x8a8098).setInteractive();
      const pauseIcon = FH.text(hud, W - 47, 3, 'II', FH.COLOR.text);
      pauseBg.on('pointerdown', () => {
        if (game.phase !== 'dawn' && game.phase !== 'gameover') game.togglePause();
      });

      ui.add([base, knob, btn, btnIcon, pauseBg, pauseIcon.shadow, pauseIcon.main]);
      ui.setVisible(FH.isTouch);

      let stick = null; // pointer currently driving the stick
      let origin = { ...REST };

      const show = () => { if (!ui.visible) { FH.isTouch = true; ui.setVisible(true); } };
      const resetStick = () => {
        stick = null;
        origin = { ...REST };
        base.setPosition(REST.x, REST.y);
        knob.setPosition(REST.x, REST.y);
        FH.touch.x = 0; FH.touch.y = 0;
      };

      hud.input.on('pointerdown', (p, over) => {
        if (!p.wasTouch) return;      // mouse clicks keep desktop behaviour
        show();
        FH.Audio.unlock();
        if (over.length) return;      // hotbar slot or pause button handled it

        if (game.phase === 'dawn' || game.phase === 'gameover') { game.onAction(); return; }
        if (game.paused) { game.togglePause(); return; }

        if (p.x < W / 2) {
          if (stick) return;
          stick = p;
          origin = {
            x: Phaser.Math.Clamp(p.x, STICK_R + 2, W / 2 - STICK_R),
            y: Phaser.Math.Clamp(p.y, 14 + STICK_R, H - STICK_R - 2)
          };
          base.setPosition(origin.x, origin.y);
          knob.setPosition(p.x, p.y);
          moveStick(p);
        } else {
          game.onAction();
          btn.setFillStyle(0xf4d35e, 0.5);
          hud.time.delayedCall(90, () => btn.setFillStyle(0xf4d35e, 0.18));
        }
      });

      const moveStick = (p) => {
        let dx = p.x - origin.x, dy = p.y - origin.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d; }
        knob.setPosition(origin.x + dx, origin.y + dy);
        FH.touch.x = dx / STICK_R;
        FH.touch.y = dy / STICK_R;
      };

      hud.input.on('pointermove', (p) => { if (p === stick) moveStick(p); });
      const up = (p) => { if (p === stick) resetStick(); };
      hud.input.on('pointerup', up);
      hud.input.on('pointerupoutside', up);
      hud.game.events.on('blur', resetStick);
      hud.events.once('shutdown', () => { hud.game.events.off('blur', resetStick); FH.touch.x = 0; FH.touch.y = 0; });

      return {
        setTool(i) { btnIcon.setTexture(FH.TOOLS[i].icon); },
        get visible() { return ui.visible; }
      };
    }
  };
})();
