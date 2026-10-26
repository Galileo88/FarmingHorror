// ============================================================================
// Rendering. The world is drawn at low resolution into `canvas` and scaled up
// by CSS with image-rendering: pixelated.
// ============================================================================
window.TA = window.TA || {};

TA.Renderer = class {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.layer = document.createElement('canvas');   // parallax composition
    this.layer2 = document.createElement('canvas');
    this.light = document.createElement('canvas');   // darkness mask
    this.resize();
    addEventListener('resize', () => this.resize());
    TA.renderer = this;
  }
  resize() {
    const W = innerWidth, H = innerHeight;
    this.scale = Math.max(1, Math.round(H / 150));
    this.w = Math.ceil(W / this.scale); this.h = Math.ceil(H / this.scale);
    for (const c of [this.canvas, this.layer, this.layer2, this.light]) { c.width = this.w; c.height = this.h; }
    this.canvas.style.width = this.w * this.scale + 'px';
    this.canvas.style.height = this.h * this.scale + 'px';
    for (const c of [this.ctx, this.layer.getContext('2d'), this.layer2.getContext('2d'), this.light.getContext('2d')]) c.imageSmoothingEnabled = false;
    this.groundY = this.h - 30;
  }
  toScreenX(x) { return Math.round(x - this.camX); }

  // ------------------------------------------------------------ parallax
  timeSets(base, hour) {
    if (!TA.PARALLAX_SETS[base + '_day']) return [[base, 1]];
    const d = base + '_day', k = base + '_dusk', n = base + '_night';
    if (hour >= 7 && hour < 17.5) return [[d, 1]];
    if (hour >= 17.5 && hour < 19) return [[d, 1], [k, (hour - 17.5) / 1.5]];
    if (hour >= 19 && hour < 20.5) return [[k, 1], [n, (hour - 19) / 1.5]];
    if (hour >= 20.5 || hour < 5) return [[n, 1]];
    if (hour < 6) return [[n, 1], [k, hour - 5]];
    return [[k, 1], [d, hour - 6]];
  }
  drawSet(ctx, set, camX) {
    const n = TA.PARALLAX_SETS[set];
    const top = this.groundY - 150;
    for (let i = 0; i < n; i++) {
      const im = TA.img[`px_${set}_${i}`]; if (!im) continue;
      const f = i === 0 ? 0 : 0.04 + 0.42 * Math.pow(i / (n - 1), 1.6);
      if (i === 0 && top > 0) ctx.drawImage(im, 0, 0, im.width, 1, 0, 0, this.w, top + 1); // extend sky upward
      let ox = -Math.round(camX * f) % im.width; if (ox > 0) ox -= im.width;
      for (let x = ox; x < this.w; x += im.width) ctx.drawImage(im, x, top);
    }
  }
  drawBiomeSky(ctx, biome, camX, hour) {
    const sets = this.timeSets(TA.BIOMES[biome].parallax, hour);
    for (const [set, a] of sets) {
      if (a <= 0) continue;
      ctx.globalAlpha = a; this.drawSet(ctx, set, camX); ctx.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------ main draw
  draw(game) {
    const ctx = this.ctx, p = game.player;
    const lead = p.dir * 24;
    game.camX = TA.lerp(game.camX, p.x + lead, 0.08);
    const shake = game.shake > 0 ? (Math.random() - 0.5) * game.shake : 0;
    this.camX = Math.round(game.camX - this.w / 2 + shake);
    const camX = this.camX, gy = this.groundY, W = this.w;
    const hour = game.time;

    // sky + parallax, blended between neighbouring biomes
    const bl = game.world.biomeBlend(p.x);
    const lc = this.layer.getContext('2d');
    lc.clearRect(0, 0, W, this.h);
    this.drawBiomeSky(lc, bl.a, camX, hour);
    ctx.drawImage(this.layer, 0, 0);
    if (bl.t > 0) {
      lc.clearRect(0, 0, W, this.h);
      this.drawBiomeSky(lc, bl.b, camX, hour);
      ctx.globalAlpha = bl.t; ctx.drawImage(this.layer, 0, 0); ctx.globalAlpha = 1;
    }
    // stars & moon at night
    const dark = game.darkness();
    if (dark > 0.3) {
      ctx.globalAlpha = (dark - 0.3) * 2.5;
      for (let i = 0; i < 40; i++) {
        const sx = (TA.hash(game.seed, i, 5) % 600) - (camX * 0.01) % 600;
        const sy = TA.hash(game.seed, i, 6) % Math.max(1, gy - 90);
        ctx.fillStyle = i % 7 === 0 ? '#c7dcd0' : '#7f708a';
        ctx.fillRect(Math.round(((sx % W) + W) % W), sy, 1, 1);
      }
      TA.drawSpr(ctx, 'moon', W * 0.78, Math.max(18, gy - 118));
      ctx.globalAlpha = 1;
    }

    const x0 = camX - 40, x1 = camX + W + 40;
    const objs = game.world.objectsIn(x0, x1);


    // ground strip
    this.drawGround(ctx, game, camX);

    // claim edge posts
    if (game.claim) {
      for (const s of [-1, 1]) {
        const ex = game.claim.x + s * game.claim.r;
        if (!game.buildings.some(b => b.type === 'wall' && b.side === s)) TA.drawSpr(ctx, 'k_fence', ex - camX, gy);
      }
    }

    // structures / nature behind actors
    const t = performance.now() / 1000;
    objs.sort((a, b) => (a.z || 0) - (b.z || 0));
    for (const o of objs) {
      const sx = o.x - camX;
      switch (o.kind) {
        case 'decor': TA.drawSpr(ctx, o.spr, sx, gy, o.flip); break;
        case 'struct':
          if (o.bld) TA.drawBuilding(ctx, o.bld, 17, sx, gy); else TA.drawSpr(ctx, o.spr, sx, gy);
          break;
        case 'flag': ctx.fillStyle = '#4d3729'; ctx.fillRect(Math.round(sx - 2), gy - 22, 1, 23); TA.drawFlag(ctx, o.flag, t, sx, gy - 8); break;
        case 'tree': TA.drawSpr(ctx, o.spr, sx, gy, o.flip); break;
        case 'rock': TA.drawSpr(ctx, o.spr, sx, gy); break;
        case 'bush': TA.drawSpr(ctx, o.spr, sx, gy, o.flip); break;
        case 'mushroom': TA.drawIcon(ctx, 'mushroom', sx, gy); break;
        case 'wildcrop': TA.drawCrop(ctx, o.crop, 4, sx, gy); break;
        case 'campfire': {
          const im = TA.img.campfire; if (im) ctx.drawImage(im, (Math.floor(t * 8) % 4) * 16, 0, 16, 16, Math.round(sx - 8), gy - 16, 16, 16);
          break;
        }
        case 'chest': {
          const im = TA.img.chest; if (im) ctx.drawImage(im, game.world.opened[o.id] ? 16 : 0, 0, 16, 16, Math.round(sx - 8), gy - 16, 16, 16);
          break;
        }
      }
    }

    // player buildings
    for (const b of game.buildings) {
      const sx = b.x - camX;
      if (sx < -80 || sx > W + 80) continue;
      if (b.type === 'banner') {
        ctx.fillStyle = '#4d3729'; ctx.fillRect(Math.round(sx - 2), gy - 24, 1, 25);
        TA.drawFlag(ctx, 'flagBanner', t, sx, gy - 10);
        continue;
      }
      const sheet = b.type === 'wall' ? (b.side < 0 ? 'wall' : 'wall2') : b.type;
      TA.drawBuilding(ctx, sheet, b.frame, sx, gy);
      if (b.type === 'watchtower' && b.built) TA.drawUnit(ctx, 'archer', b.cool > 1.2 ? 'attack' : 'idle', b.cool > 1.2 ? Math.floor((1.6 - b.cool) * 12) : Math.floor(t * 7) % 8, sx, gy - 18, (b.aimDir || 1) < 0);
      if (b.isWall && b.hp < b.maxHp) {
        ctx.fillStyle = '#2e222f'; ctx.fillRect(Math.round(sx - 8), gy - 20, 16, 2);
        ctx.fillStyle = '#c8ac99'; ctx.fillRect(Math.round(sx - 8), gy - 20, Math.ceil(16 * b.hp / b.maxHp), 2);
      }
    }

    // fields
    for (const pl of game.plots) {
      const sx = pl.x - camX; if (sx < -16 || sx > W + 16) continue;
      if (TA.img.soil) ctx.drawImage(TA.img.soil, pl.wet ? 16 : 0, 0, 16, 6, Math.round(sx - 8), gy - 1, 16, 6);
      const st = game.cropStage(pl);
      if (st >= 0) TA.drawCrop(ctx, pl.crop, st, sx, gy + 1);
    }

    // target highlight
    const tgt = game.ui.target;
    if (tgt && tgt.slot !== undefined) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      const sx = Math.round(tgt.slot - camX);
      ctx.fillRect(sx - 8, gy + 5, 3, 1); ctx.fillRect(sx + 5, gy + 5, 3, 1);
      ctx.fillRect(sx - 8, gy + 4, 1, 1); ctx.fillRect(sx + 7, gy + 4, 1, 1);
    }

    // actors
    for (const n of game.npcs) n.draw(ctx, n.x - camX, gy);
    for (const d of game.strays) d.draw(ctx, d.x - camX, gy);
    for (const g of game.guards) g.draw(ctx, g.x - camX, gy);
    for (const m of game.mobs) m.draw(ctx, m.x - camX, gy);
    if (game.dog) game.dog.draw(ctx, game.dog.x - camX, gy);
    p.draw(ctx, p.x - camX, gy);

    // drops
    for (const d of game.drops) {
      const bob = d.y === 0 ? Math.round(Math.sin(d.t * 5 + d.x) * 0.6) : 0;
      TA.drawIcon(ctx, d.item, d.x - camX, gy - d.y - bob);
    }
    for (const a of game.arrows) a.draw(ctx, camX, gy);
    game.fx.draw(ctx, camX, gy);

    // darkness & light
    this.drawLight(game, objs, camX, dark);

    // rain
    if (game.isRaining()) {
      ctx.fillStyle = 'rgba(143,211,255,0.55)';
      const tt = performance.now() / 1000;
      for (let i = 0; i < 90; i++) {
        const rx = ((TA.hash(i, 1) % 1000) + tt * 40 - camX * 0.2) % (W + 20);
        const ry = ((TA.hash(i, 2) % 1000) + tt * 260) % (gy + 10);
        ctx.fillRect(Math.round(rx), Math.round(ry), 1, 3);
      }
      ctx.fillStyle = 'rgba(40,40,70,0.18)'; ctx.fillRect(0, 0, W, this.h);
    }

    // foreground silhouettes (parallax faster than the world)
    const fgf = 1.35, seg = 220;
    const fx0 = Math.floor((camX * fgf) / seg) - 1, fx1 = Math.floor(((camX + W) * fgf) / seg) + 1;
    for (let i = fx0; i <= fx1; i++) {
      const h = TA.hash(game.seed, i, 31);
      if (h % 100 > 38) continue;
      const spr = ['sil_a', 'sil_b', 'sil_c', 'sil_d'][h % 4];
      const sx = i * seg + (h >> 8) % 120 - camX * fgf;
      TA.drawSpr(ctx, spr, sx, this.h + 10, (h >> 4) % 2 === 0);
    }

    // floating numbers
    for (const ft of game.fx.texts) {
      const a = 1 - ft.t / 1.1;
      TA.pixelText(ctx, ft.text, ft.x - camX, gy - ft.y - ft.t * 14, ft.color, a);
    }

    if (game.fade > 0) { ctx.fillStyle = `rgba(14,10,20,${game.fade})`; ctx.fillRect(0, 0, W, this.h); }
  }

  drawGround(ctx, game, camX) {
    const gy = this.groundY, W = this.w;
    const t0 = Math.floor(camX / 16) - 1, t1 = Math.floor((camX + W) / 16) + 1;
    ctx.fillStyle = '#2e222f'; ctx.fillRect(0, gy + 15, W, this.h - gy);
    for (let t = t0; t <= t1; t++) {
      const x = t * 16;
      const key = TA.BIOMES[game.world.biomeAt(x + 8)].tiles;
      const im = TA.img[key]; if (!im) continue;
      const v = TA.GROUND_VARIANTS[TA.hash(game.seed, t, 3) % TA.GROUND_VARIANTS.length];
      ctx.drawImage(im, v * 16, 0, 16, 16, x - camX, gy, 16, 16);
    }
  }

  drawLight(game, objs, camX, dark) {
    if (dark <= 0.01) return;
    const lc = this.light.getContext('2d'), gy = this.groundY, W = this.w, H = this.h;
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, W, H);
    lc.fillStyle = `rgba(12,8,32,${dark})`;
    lc.fillRect(0, 0, W, H);
    lc.globalCompositeOperation = 'destination-out';
    const lights = [];
    const p = game.player;
    lights.push([p.x, gy - 8, 34]);
    for (const o of objs) {
      if (o.kind === 'campfire') lights.push([o.x, gy - 6, o.light + Math.sin(performance.now() / 120 + o.x) * 2]);
      if (o.light && o.kind === 'struct') lights.push([o.x, gy - 8, o.light]);
      if (o.kind === 'wildcrop') lights.push([o.x, gy - 6, 14]);
    }
    for (const b of game.buildings) {
      if (!b.built) continue;
      if (b.type === 'lighttower') lights.push([b.x, gy - 40, 110]);
      else if (b.type === 'hut' || b.type === 'market' || b.type === 'manor') lights.push([b.x, gy - 10, 34]);
      else if (b.type === 'banner') lights.push([b.x, gy - 14, 22]);
    }
    for (const pl of game.plots) if (pl.crop === 'moonflower' && game.cropStage(pl) >= 3) lights.push([pl.x, gy - 6, 16]);
    for (const [lx, ly, r] of lights) {
      const sx = lx - camX; if (sx < -r || sx > W + r) continue;
      const g = lc.createRadialGradient(sx, ly, 0, sx, ly, r);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = g; lc.fillRect(sx - r, ly - r, r * 2, r * 2);
    }
    this.ctx.drawImage(this.light, 0, 0);
    // warm glow
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    for (const [lx, ly, r] of lights) {
      const sx = lx - camX; if (sx < -r || sx > W + r) continue;
      const g = ctx.createRadialGradient(sx, ly, 0, sx, ly, r * 0.6);
      g.addColorStop(0, `rgba(80,45,10,${0.35 * dark})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(sx - r, ly - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
};

TA.GROUND_VARIANTS = [1, 2, 3, 4, 5, 6, 7, 10, 11];

// ---------------------------------------------------------------- tiny 3x5 pixel font for numbers
TA.GLYPHS = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001111001111', '4': '101101111001001',
  '5': '111100111001111', '6': '111100111101111', '7': '111001001010010', '8': '111101111101111', '9': '111101111001111',
  '+': '000010111010000', '-': '000000111000000', '♥': '000101111111010',
};
TA.pixelText = function (ctx, text, x, y, color, alpha = 1) {
  const chars = String(text).split('');
  const w = chars.length * 4 - 1;
  let cx = Math.round(x - w / 2); y = Math.round(y);
  ctx.globalAlpha = alpha;
  for (const ch of chars) {
    const g = TA.GLYPHS[ch];
    if (g) {
      ctx.fillStyle = '#2e222f';
      for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(cx + (i % 3) + 1, y + Math.floor(i / 3) + 1, 1, 1);
      ctx.fillStyle = color;
      for (let i = 0; i < 15; i++) if (g[i] === '1') ctx.fillRect(cx + (i % 3), y + Math.floor(i / 3), 1, 1);
    }
    cx += 4;
  }
  ctx.globalAlpha = 1;
};
