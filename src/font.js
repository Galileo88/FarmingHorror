// A tiny 3x5 pixel font, built at startup so text stays crisp at 320x180.
(function () {
  const G = {
    A: '.#. #.# ### #.# #.#', B: '##. #.# ##. #.# ##.', C: '.## #.. #.. #.. .##', D: '##. #.# #.# #.# ##.',
    E: '### #.. ##. #.. ###', F: '### #.. ##. #.. #..', G: '.## #.. #.# #.# .##', H: '#.# #.# ### #.# #.#',
    I: '### .#. .#. .#. ###', J: '..# ..# ..# #.# .#.', K: '#.# #.# ##. #.# #.#', L: '#.. #.. #.. #.. ###',
    M: '#.# ### ### #.# #.#', N: '##. #.# #.# #.# #.#', O: '.#. #.# #.# #.# .#.', P: '##. #.# ##. #.. #..',
    Q: '.#. #.# #.# ##. .##', R: '##. #.# ##. #.# #.#', S: '.## #.. .#. ..# ##.', T: '### .#. .#. .#. .#.',
    U: '#.# #.# #.# #.# ###', V: '#.# #.# #.# .#. .#.', W: '#.# #.# ### ### #.#', X: '#.# #.# .#. #.# #.#',
    Y: '#.# #.# .#. .#. .#.', Z: '### ..# .#. #.. ###', 0: '### #.# #.# #.# ###', 1: '.#. ##. .#. .#. ###',
    2: '##. ..# .#. #.. ###', 3: '##. ..# .#. ..# ##.', 4: '#.# #.# ### ..# ..#', 5: '### #.. ##. ..# ##.',
    6: '.## #.. ### #.# ###', 7: '### ..# .#. .#. .#.', 8: '### #.# ### #.# ###', 9: '### #.# ### ..# ##.',
    '.': '... ... ... ... .#.', ',': '... ... ... .#. #..', '!': '.#. .#. .#. ... .#.', '?': '##. ..# .#. ... .#.',
    ':': '... .#. ... .#. ...', '-': '... ... ### ... ...', '+': '... .#. ### .#. ...', '/': '..# ..# .#. #.. #..',
    "'": '.#. .#. ... ... ...', '(': '..# .#. .#. .#. ..#', ')': '#.. .#. .#. .#. #..', '%': '#.# ..# .#. #.. #.#',
    '>': '#.. .#. ..# .#. #..', '<': '..# .#. #.. .#. ..#', '=': '... ### ... ### ...', ' ': '... ... ... ... ...',
    '#': '.#. ### .#. ### .#.'
  };
  const CHARS = Object.keys(G).join('');

  FH.Font = {
    chars: CHARS,
    build(scene) {
      const cw = 4, ch = 6;
      const n = CHARS.length;
      const tex = scene.textures.createCanvas('font-img', cw * n, ch);
      const ctx = tex.getContext();
      ctx.fillStyle = '#ffffff';
      CHARS.split('').forEach((c, i) => {
        const bits = G[c].replace(/ /g, '');
        for (let p = 0; p < 15; p++) {
          if (bits[p] === '#') ctx.fillRect(i * cw + (p % 3), Math.floor(p / 3), 1, 1);
        }
      });
      tex.refresh();
      const data = Phaser.GameObjects.RetroFont.Parse(scene, {
        image: 'font-img', width: cw, height: ch, chars: CHARS, charsPerRow: n,
        'offset.x': 0, 'offset.y': 0, 'spacing.x': 0, 'spacing.y': 0, lineSpacing: 2
      });
      scene.cache.bitmapFont.add('px', data);
    }
  };

  // Helper: crisp text with a 1px drop shadow. Returns a container-like object.
  FH.text = function (scene, x, y, str, color = FH.COLOR.text, opts = {}) {
    const s = String(str).toUpperCase();
    const shadow = scene.add.bitmapText(x + 1, y + 1, 'px', s).setTint(FH.COLOR.outline);
    const main = scene.add.bitmapText(x, y, 'px', s).setTint(color);
    const scale = opts.scale || 1;
    [shadow, main].forEach((t) => { t.setScale(scale); if (opts.origin !== undefined) t.setOrigin(opts.origin, 0); });
    shadow.x = x + scale; shadow.y = y + scale;
    const obj = {
      main, shadow,
      setText(v) { const u = String(v).toUpperCase(); main.setText(u); shadow.setText(u); return obj; },
      setColor(c) { main.setTint(c); return obj; },
      setVisible(v) { main.setVisible(v); shadow.setVisible(v); return obj; },
      setAlpha(a) { main.setAlpha(a); shadow.setAlpha(a); return obj; },
      setDepth(d) { main.setDepth(d + 0.01); shadow.setDepth(d); return obj; },
      setPosition(px, py) { main.setPosition(px, py); shadow.setPosition(px + scale, py + scale); return obj; },
      setScrollFactor(f) { main.setScrollFactor(f); shadow.setScrollFactor(f); return obj; },
      get width() { return main.width; },
      destroy() { main.destroy(); shadow.destroy(); }
    };
    if (opts.depth !== undefined) obj.setDepth(opts.depth);
    return obj;
  };
})();
