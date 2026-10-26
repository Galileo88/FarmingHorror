// Heads-up display: clock, coins, hearts, hotbar, messages and the dawn summary.
(function () {
  const C = FH.CFG;
  const W = C.width, H = C.height;

  class HudScene extends Phaser.Scene {
    constructor() { super('hud'); }

    create() {
      this.game$ = this.scene.get('game');
      const g = this.game$;

      // Top bar
      this.add.rectangle(0, 0, W, 11, 0x1a1423, 0.75).setOrigin(0, 0);
      this.cycleIcon = this.add.image(6, 5, 'sun');
      this.clock = FH.text(this, 13, 3, '');
      this.hearts = [];
      for (let i = 0; i < C.playerHearts; i++) this.hearts.push(this.add.image(W / 2 - C.playerHearts * 4.5 + i * 9 + 4, 5, 'heart', 0));
      this.add.image(W - 30, 5, 'coin');
      this.coinText = FH.text(this, W - 24, 3, '0', FH.COLOR.gold);

      // Hotbar
      const n = FH.TOOLS.length;
      const x0 = Math.round((W - (n * 18 + (n - 1) * 2)) / 2);
      const y0 = H - 20;
      this.slots = FH.TOOLS.map((tool, i) => {
        const x = x0 + i * 20;
        const frame = this.add.image(x, y0, 'slot', 0).setOrigin(0, 0).setInteractive();
        frame.on('pointerdown', () => { FH.Audio.unlock(); g.select(i); });
        this.add.image(x + 9, y0 + 9, tool.icon, 0);
        FH.text(this, x + 2, y0 + 2, String(i + 1), 0x8a8098);
        if (tool.cost) FH.text(this, x + 17 - String(tool.cost).length * 4, y0 + 12, String(tool.cost), FH.COLOR.gold);
        return frame;
      });
      this.toolLabel = FH.text(this, W / 2, y0 - 9, '', FH.COLOR.text, { origin: 0.5 });
      this.toolLabelTimer = 0;

      // On-screen stick + action button for phones (hidden on desktop)
      this.touchUI = FH.Touch.attach(this);

      // Messages
      this.toastText = FH.text(this, W / 2, y0 - 19, '', FH.COLOR.text, { origin: 0.5 });
      this.toastTimer = 0;
      this.bannerTitle = FH.text(this, W / 2, 42, '', FH.COLOR.text, { origin: 0.5, scale: 2 });
      this.bannerSub = FH.text(this, W / 2, 58, '', 0xc8bcd8, { origin: 0.5 });
      this.bannerTimer = 0;

      // Overlays
      this.overlay = this.add.container(0, 0).setVisible(false).setDepth(100);
      this.pauseText = FH.text(this, W / 2, H / 2 - 4, FH.isTouch ? 'Paused - tap to resume' : 'Paused - press P to resume', FH.COLOR.text, { origin: 0.5 }).setVisible(false);

      g.events.on('tool', this.onTool, this);
      g.events.on('coins', this.onCoins, this);
      g.events.on('toast', this.toast, this);
      g.events.on('banner', this.banner, this);
      g.events.on('summary', this.showSummary, this);
      g.events.on('summaryClose', this.hideOverlay, this);
      g.events.on('gameover', this.showGameOver, this);
      g.events.on('pause', (p) => this.pauseText.setVisible(p), this);
      this.events.once('shutdown', () => {
        ['tool', 'coins', 'toast', 'banner', 'summary', 'summaryClose', 'gameover', 'pause'].forEach((e) => g.events.off(e, undefined, this));
      });

      this.onTool(g.selected, true);
      this.onCoins(g.coins);
    }

    onTool(i, quiet) {
      this.slots.forEach((s, j) => s.setFrame(j === i ? 1 : 0));
      if (this.touchUI) this.touchUI.setTool(i);
      const t = FH.TOOLS[i];
      this.toolLabel.setText(`${t.name}${t.cost ? ` (${t.cost})` : ''}: ${t.hint}`).setAlpha(1);
      this.toolLabelTimer = quiet ? 4 : 2.5;
    }

    onCoins(c) { this.coinText.setText(String(c)); }

    toast(msg, color = FH.COLOR.text) {
      this.toastText.setText(msg).setColor(color).setAlpha(1);
      this.toastTimer = 1.8;
    }

    banner(title, sub) {
      this.bannerTitle.setText(title).setAlpha(1);
      this.bannerSub.setText(sub || '').setAlpha(1);
      this.bannerTimer = 3.5;
    }

    panel(lines, footer) {
      this.overlay.removeAll(true);
      this.bannerTimer = 0;
      this.bannerTitle.setAlpha(0); this.bannerSub.setAlpha(0);
      const h = 26 + lines.length * 10;
      const bg = this.add.rectangle(W / 2, H / 2 - 8, 220, h, 0x1a1423, 0.92).setStrokeStyle(1, 0x4a3f5c);
      this.overlay.add(bg);
      let y = H / 2 - 8 - h / 2 + 8;
      lines.forEach(([str, color, scale]) => {
        const t = FH.text(this, W / 2, y, str, color || FH.COLOR.text, { origin: 0.5, scale: scale || 1 });
        this.overlay.add([t.shadow, t.main]);
        y += scale === 2 ? 16 : 10;
      });
      if (footer) {
        const f = FH.text(this, W / 2, y + 4, footer, FH.COLOR.gold, { origin: 0.5 });
        this.overlay.add([f.shadow, f.main]);
        this.tweens.add({ targets: [f.main, f.shadow], alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
      }
      this.overlay.setVisible(true);
    }

    showSummary({ won }) {
      const g = this.game$, s = g.stats;
      const lines = [];
      if (won) {
        lines.push(['You survived the harvest!', FH.COLOR.gold, 1]);
        lines.push([`${C.nightsToWin} nights. The graves are quiet... for now.`, 0xc8bcd8]);
      } else {
        lines.push([`Night ${g.day} survived`, FH.COLOR.green, 2]);
      }
      lines.push([`Crops harvested: ${s.harvested}`]);
      lines.push([`Coins earned: ${s.earned}`, FH.COLOR.gold]);
      lines.push([`Eaten by crows: ${s.crowEaten}`, s.crowEaten ? FH.COLOR.red : FH.COLOR.text]);
      lines.push([`Eaten by zombies: ${s.zombieEaten}`, s.zombieEaten ? FH.COLOR.red : FH.COLOR.text]);
      lines.push([`Zombies put down: ${s.zombiesKilled}   Crows: ${s.crowsKilled}`]);
      this.panel(lines, won ? FH.prompt('keep farming (endless)') : FH.prompt(`start day ${g.day + 1}`));
    }

    showGameOver({ day }) {
      this.time.delayedCall(700, () => {
        this.panel([
          ['The dead took the farm', FH.COLOR.red, 1],
          [`You lasted until night ${day}.`, 0xc8bcd8]
        ], FH.prompt('try again'));
      });
    }

    hideOverlay() { this.overlay.setVisible(false); }

    update(time, delta) {
      const dt = delta / 1000;
      const g = this.game$;
      if (!g || !g.player) return;

      const night = g.phase === 'night' || g.phase === 'dusk';
      this.cycleIcon.setTexture(night ? 'moon' : 'sun');
      const late = g.phase === 'day' && g.phaseTime > C.dayLength * 0.8;
      this.clock.setText(`Day ${g.day}  ${g.clockText()}`).setColor(late ? FH.COLOR.red : (night ? 0xc8bcd8 : FH.COLOR.text));
      this.hearts.forEach((h, i) => h.setFrame(i < g.player.hearts ? 0 : 1));

      const fade = (obj, key) => {
        if (this[key] > 0) {
          this[key] -= dt;
          if (this[key] < 0.5) obj.setAlpha(Math.max(0, this[key] / 0.5));
        }
      };
      fade(this.toastText, 'toastTimer');
      fade(this.toolLabel, 'toolLabelTimer');
      if (this.bannerTimer > 0) {
        this.bannerTimer -= dt;
        const a = Math.max(0, Math.min(1, this.bannerTimer / 0.6));
        this.bannerTitle.setAlpha(a); this.bannerSub.setAlpha(a);
      }
    }
  }

  FH.HudScene = HudScene;
})();
