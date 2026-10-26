// ============================================================================
// Rendering. The canvas is screen sized; everything is drawn in world pixels
// through an integer scale transform, with positions snapped to screen pixels
// (TA.px) so motion is smooth while the art stays crisp.
// The world is one space: sky above the ground, solid earth below it, and the
// caves carved out of the earth TA.CAVE_DEPTH down. It is drawn back to front:
// sky, cave air, back row, earth, ground, street, actors, foreground, light,
// weather. The camera follows the player down a shaft and back up.
// ============================================================================
window.TA = window.TA || {};

TA.Renderer = class {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.setC = document.createElement('canvas');    // one parallax set, opaque
    this.skyA = document.createElement('canvas');    // a biome's sky (time-of-day sets mixed)
    this.light = document.createElement('canvas');   // darkness mask (world resolution, upscaled smooth)
    this.glow = document.createElement('canvas');    // warm light added on top
    this.camX = 0; this.camY = 0;
    this.resize();
    addEventListener('resize', () => this.resize());
    TA.renderer = this;
  }
  resize() {
    const W = innerWidth, H = innerHeight;
    // about 92 world pixels tall, always a whole-number zoom
    this.scale = Math.max(2, Math.round(H / 92));
    TA.PX = this.scale;
    this.w = Math.ceil(W / this.scale); this.h = Math.ceil(H / this.scale);
    // Offscreen layers don't need full resolution: the sky moves slowly (half
    // pixels are plenty) and the light masks are nothing but soft gradients.
    this.skyRes = Math.min(this.scale, 2);
    this.canvas.width = this.w * this.scale; this.canvas.height = this.h * this.scale;
    for (const c of [this.setC, this.skyA]) { c.width = this.w * this.skyRes; c.height = this.h * this.skyRes; c.res = this.skyRes; }
    for (const c of [this.light, this.glow]) { c.width = this.w; c.height = this.h; c.res = 1; }
    this.canvas.style.width = this.w * this.scale + 'px';
    this.canvas.style.height = this.h * this.scale + 'px';
    this.groundY = this.h - 22;
  }
  // world-pixel transform on any of our canvases
  begin(ctx) { ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0); ctx.imageSmoothingEnabled = false; return ctx; }
  ctxOf(c) { const x = c.getContext('2d'); x.setTransform(c.res, 0, 0, c.res, 0, 0); x.imageSmoothingEnabled = false; return x; }
  // screen y of a world height
  Y(y) { return this.baseY - y; }

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
    const top = this.baseY - 128; // the art's tree line sits on the ground
    for (let i = 0; i < n; i++) {
      const im = TA.img[`px_${set}_${i}`]; if (!im) continue;
      const f = i === 0 ? 0 : 0.04 + 0.42 * Math.pow(i / (n - 1), 1.6);
      if (i === 0 && top > 0) ctx.drawImage(im, 0, 0, im.width, 1, 0, 0, this.w, top + 1); // extend sky upward
      let ox = TA.px(-(camX * f) % im.width); if (ox > 0) ox -= im.width;
      for (let x = ox; x < this.w; x += im.width) ctx.drawImage(im, x, top);
    }
  }
  // A biome's sky into `out`. Each time-of-day set is composited opaque on its
  // own and only then cross-faded, so the layers of two sets never interleave.
  drawBiomeSky(out, biome, camX, hour) {
    const oc = this.ctxOf(out);
    const sets = this.timeSets(TA.BIOMES[biome].parallax, hour).filter(([, a]) => a > 0);
    oc.globalAlpha = 1;
    this.drawSet(oc, sets[0][0], camX);
    for (const [set, a] of sets.slice(1)) {
      const sc = this.ctxOf(this.setC);
      this.drawSet(sc, set, camX);
      oc.setTransform(1, 0, 0, 1, 0, 0); oc.globalAlpha = a; oc.drawImage(this.setC, 0, 0); oc.globalAlpha = 1;
      this.ctxOf(out);
    }
  }
  // Stretch an offscreen layer over the whole screen
  blit(src, alpha = 1, smooth = false) {
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = smooth; ctx.globalAlpha = alpha;
    ctx.drawImage(src, 0, 0, src.width, src.height, 0, 0, this.canvas.width, this.canvas.height);
    ctx.globalAlpha = 1;
    this.begin(ctx);
  }
  drawSky(game, camX) {
    const ctx = this.ctx, hour = game.time;
    // the sky of the land you are in (borders are crossed in a cut, never seen)
    this.drawBiomeSky(this.skyA, game.world.biomeAt(game.player.x), camX, hour);
    this.blit(this.skyA);
    // weather greys the sky out
    const w = game.weatherNow();
    if (w.def.sky) { ctx.fillStyle = `rgba(104,112,128,${w.def.sky * w.k})`; ctx.fillRect(0, 0, this.w, this.baseY); }
    // stars & moon at night
    const dark = game.darkness();
    if (dark > 0.3 && !w.def.sky) {
      ctx.globalAlpha = (dark - 0.3) * 2.5;
      for (let i = 0; i < 40; i++) {
        const sx = (TA.hash(game.seed, i, 5) % 600) - (camX * 0.01) % 600;
        const sy = TA.hash(game.seed, i, 6) % Math.max(1, this.groundY - 40) + this.baseY - this.groundY;
        ctx.fillStyle = i % 7 === 0 ? '#c7dcd0' : '#7f708a';
        ctx.fillRect(Math.round(((sx % this.w) + this.w) % this.w), sy, 1, 1);
      }
      TA.drawSpr(ctx, 'moon', this.w * 0.78, Math.max(16, this.groundY - 50) + this.baseY - this.groundY);
      ctx.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------ camera
  // Eased with the same dt the player moves by, and left unsnapped: positions
  // snap only after the camera is subtracted, so a steady walk is steady on screen.
  updateCamera(game, dt) {
    const p = game.player;
    const k = 1 - Math.exp(-dt * 4.5); // frame-rate independent easing
    game.camX += (p.x + p.dir * 20 - game.camX) * k;
    // On the surface the ground sits near the bottom of the screen. Below it, the
    // view sinks with the player (a little above centre); it follows falls quickly
    // and climbs lazily, so jumps don't bob the screen.
    const target = p.y < -4 ? Math.min(0, p.y - 12) : 0;
    game.camY += (target - game.camY) * (1 - Math.exp(-dt * (target < game.camY ? 7 : 3)));
    const shake = game.shake > 0 ? (Math.random() - 0.5) * game.shake : 0;
    this.camX = game.camX - this.w / 2 + shake;
    this.camY = game.camY;
    this.baseY = TA.px(this.groundY + this.camY);
  }

  // ------------------------------------------------------------ main draw
  draw(game, dt = 1 / 60) {
    const ctx = this.begin(this.ctx), p = game.player, W = this.w;
    this.updateCamera(game, dt);
    const camX = this.camX;
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    ctx.fillStyle = '#2e222f'; ctx.fillRect(0, 0, W, this.h);
    const objs = game.world.objectsIn(camX - 40, camX + W + 40, null);
    const t = performance.now() / 1000;
    const sx = x => x - camX;
    // is any sky / any earth on screen?
    const skyVis = this.baseY > 0, earthVis = this.baseY + TA.CRUST < this.h;

    if (skyVis) this.drawSky(game, camX);
    if (earthVis) this.drawCaveBack(game, camX);

    // back row: buildings and trees further off, hazed, and sinking into the dark at night
    const backA = 1 - game.darkness() * 0.8;
    for (const o of objs) if (o.back) {
      const cave = o.layer === 'c';
      this.drawObj(ctx, game, o, sx(o.x), this.Y(o.y || 0) - (cave ? 0 : 1), t, { dark: true, alpha: cave ? 1 : backA });
    }

    if (earthVis) this.drawCaveRock(game, camX);
    if (skyVis || this.baseY + TA.CRUST > 0) this.drawGround(ctx, game, camX);

    // claim edge posts
    if (game.claim) for (const s of [-1, 1]) {
      const ex = game.claim.x + s * game.claim.r;
      if (!game.buildings.some(b => b.type === 'wall' && b.side === s)) TA.drawSpr(ctx, 'k_fence', sx(ex), this.baseY);
    }

    // the street: structures, nature, props (archways: left half only)
    const mid = objs.filter(o => !o.back && !o.front).sort((a, b) => (a.z || 0) - (b.z || 0));
    for (const o of mid) this.drawObj(ctx, game, o, sx(o.x), this.Y(o.y || 0), t, { half: o.arch ? -1 : 0 });

    // player buildings
    for (const b of game.buildings) this.drawBuilding(ctx, game, b, sx(b.x), t, -1);

    // fields
    for (const pl of game.plots) {
      const x = sx(pl.x); if (x < -16 || x > W + 16) continue;
      if (TA.img.soil) ctx.drawImage(TA.img.soil, pl.wet ? 16 : 0, 0, 16, 6, TA.px(x - 8), this.baseY - 1, 16, 6);
      const st = game.cropStage(pl);
      if (st >= 0) TA.drawCrop(ctx, pl.crop, st, x, this.baseY + 1);
    }

    // target highlight
    const tgt = game.ui.target;
    if (tgt && tgt.slot !== undefined) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      const x = TA.px(tgt.slot - camX), gy = this.baseY;
      ctx.fillRect(x - 8, gy + 5, 3, 1); ctx.fillRect(x + 5, gy + 5, 3, 1);
      ctx.fillRect(x - 8, gy + 4, 1, 1); ctx.fillRect(x + 7, gy + 4, 1, 1);
    }

    // actors (bodies first, so the living walk over them)
    const at = e => [sx(e.x), this.Y(e.y || 0)];
    for (const m of game.mobs) if (m.dead) m.draw(ctx, ...at(m));
    for (const n of game.npcs) n.draw(ctx, ...at(n));
    for (const f of game.folk) f.draw(ctx, ...at(f));
    for (const tr of game.travellers) tr.draw(ctx, ...at(tr));
    for (const d of game.strays) d.draw(ctx, ...at(d));
    for (const g of game.guards) g.draw(ctx, ...at(g));
    for (const m of game.mobs) if (!m.dead) m.draw(ctx, ...at(m));
    if (game.dog) game.dog.draw(ctx, ...at(game.dog));
    p.draw(ctx, ...at(p));

    // drops
    for (const d of game.drops) {
      const bob = d.y === 0 ? Math.sin(d.t * 5 + d.x) * 0.6 : 0;
      TA.drawIcon(ctx, d.item, sx(d.x), this.Y(d.base + d.y + bob));
    }
    for (const a of game.arrows) a.draw(ctx, camX, this.baseY);
    game.fx.draw(ctx, camX, this.baseY);

    // foreground: right halves of archways, then things standing nearer than the path
    for (const o of mid) if (o.arch) this.drawObj(ctx, game, o, sx(o.x), this.Y(o.y || 0), t, { half: 1 });
    for (const b of game.buildings) this.drawBuilding(ctx, game, b, sx(b.x), t, 1);
    const ps = sx(p.x), py = this.Y(p.y);
    for (const o of objs) if (o.front) {
      const x = sx(o.x), by = this.Y(o.y || 0) + (o.dy || 0), w = TA.objW(o), h = TA.objH(o);
      // see-through when it would hide the player (except a border thicket, whose job that is)
      const hides = !o.screen && h > 9 && Math.abs(x - ps) < w / 2 + 3 && py > by - h - 2;
      this.drawObj(ctx, game, o, x, by, t, { alpha: hides ? 0.45 : 1 });
    }

    // darkness & light
    this.drawLight(game, objs, camX);

    if (skyVis) {
      // weather and colour grading belong to the open air
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, this.baseY + TA.CRUST); ctx.clip();
      this.drawWeather(ctx, game, camX);
      ctx.restore();
      // foreground silhouettes (parallax faster than the world)
      const fgf = 1.35, seg = 220;
      const fx0 = Math.floor((camX * fgf) / seg) - 1, fx1 = Math.floor(((camX + W) * fgf) / seg) + 1;
      for (let i = fx0; i <= fx1; i++) {
        const h = TA.hash(game.seed, i, 31);
        if (h % 100 > 30) continue;
        const spr = ['sil_a', 'sil_b', 'sil_c', 'sil_d'][h % 4];
        TA.drawSpr(ctx, spr, i * seg + (h >>> 8) % 120 - camX * fgf, this.baseY + this.h - this.groundY + 12, (h >>> 4) % 2 === 0);
      }
    }
    if (game.flash > 0) { ctx.fillStyle = `rgba(230,240,255,${Math.min(0.75, game.flash)})`; ctx.fillRect(0, 0, W, this.h); }

    // floating numbers
    for (const ft of game.fx.texts) {
      const a = 1 - ft.t / 1.1;
      TA.pixelText(ctx, ft.text, ft.x - camX, this.Y(ft.y) - ft.t * 14, ft.color, a);
    }

    if (game.fade > 0) { ctx.fillStyle = `rgba(14,10,20,${game.fade})`; ctx.fillRect(0, 0, W, this.h); }
  }

  // One world object. opts: dark (back row), half (archway side), alpha
  drawObj(ctx, game, o, x, by, t, opts = {}) {
    const dark = !!opts.dark, alpha = opts.alpha ?? 1;
    const draw = () => {
      switch (o.kind) {
        case 'decor':
          // roots hang down from the roof: their top sits at the ceiling
          TA.drawSpr(ctx, o.spr, x, o.hang ? by + TA.SPR[o.spr][4] : by, o.flip, alpha, dark); break;
        case 'tree': case 'bush': case 'rock':
          TA.drawSpr(ctx, o.spr, x, by, o.flip, alpha, dark); break;
        case 'struct':
          if (o.bld) TA.drawBuilding(ctx, o.bld, 17, x, by, alpha, o.flip, dark); else TA.drawSpr(ctx, o.spr, x, by, o.flip, alpha, dark);
          break;
        case 'flag': ctx.fillStyle = '#4d3729'; ctx.fillRect(TA.px(x - 2), by - 22, 1, 23); TA.drawFlag(ctx, o.flag, t, x, by - 8); break;
        case 'mushroom': TA.drawIcon(ctx, 'mushroom', x, by); break;
        case 'glow': TA.drawSpr(ctx, o.spr, x, by, o.flip); break;
        case 'wildcrop': TA.drawCrop(ctx, o.crop, 4, x, by); break;
        case 'field':
          if (TA.img.soil) ctx.drawImage(TA.img.soil, 16, 0, 16, 6, TA.px(x - 8), by - 1, 16, 6);
          TA.drawCrop(ctx, o.crop, o.stage, x, by + 1);
          break;
        case 'campfire': {
          const im = TA.img.campfire; if (im) ctx.drawImage(im, (Math.floor(t * 8) % 4) * 16, 0, 16, 16, TA.px(x - 8), by - 16, 16, 16);
          break;
        }
        case 'chest': {
          const im = TA.img.chest; if (im) ctx.drawImage(im, game.world.opened[o.id] ? 16 : 0, 0, 16, 16, TA.px(x - 8), by - 16, 16, 16);
          break;
        }
        case 'mouth':
          // a ladder poking up out of the hole, boulders either side
          TA.drawSpr(ctx, 'rock_c', x - TA.HOLE - 6, by + 1);
          TA.drawSpr(ctx, 'rock_d', x + TA.HOLE + 5, by + 1, true);
          TA.drawSpr(ctx, 'g_ladder', x - 5, by + 8);
          break;
        case 'portal': {
          TA.drawSpr(ctx, 'e_portal', x, by);
          const pulse = 0.35 + 0.25 * Math.sin(t * 3 + o.x);
          ctx.globalCompositeOperation = 'lighter';
          const g = ctx.createRadialGradient(x, by - 6, 0, x, by - 6, 14);
          g.addColorStop(0, `rgba(143,248,226,${pulse})`); g.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = g; ctx.fillRect(x - 14, by - 20, 28, 20);
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = '#8ff8e2';
          for (let i = 0; i < 4; i++) { const a = t * 1.5 + i * 1.6 + o.x; ctx.fillRect(TA.px(x + Math.cos(a) * 7), TA.px(by - 6 + Math.sin(a * 1.3) * 5), 1, 1); }
          break;
        }
      }
    };
    TA.clipHalf(ctx, opts.half || 0, x, draw);
  }

  // A player building. half: -1 = back pass, 1 = front pass (only walls draw there)
  drawBuilding(ctx, game, b, x, t, half) {
    if (x < -80 || x > this.w + 80) return;
    const gy = this.baseY;
    if (b.type === 'banner') {
      if (half > 0) return;
      ctx.fillStyle = '#4d3729'; ctx.fillRect(TA.px(x - 2), gy - 24, 1, 25);
      TA.drawFlag(ctx, 'flagBanner', t, x, gy - 10);
      return;
    }
    if (b.isWall) {
      // archway: you pass in front of the left half and behind the right half
      TA.clipHalf(ctx, half, x, () => TA.drawBuilding(ctx, b.side < 0 ? 'wall' : 'wall2', b.frame, x, gy));
      if (half > 0 && b.hp < b.maxHp) {
        ctx.fillStyle = '#2e222f'; ctx.fillRect(TA.px(x - 8), gy - 20, 16, 2);
        ctx.fillStyle = '#c8ac99'; ctx.fillRect(TA.px(x - 8), gy - 20, Math.ceil(16 * b.hp / b.maxHp), 2);
      }
      return;
    }
    if (half > 0) return;
    TA.drawBuilding(ctx, b.type, b.frame, x, gy);
    if (!b.built) return;
    if (b.type === 'watchtower') {
      // archers look out of the windows; a bright nock flashes as they loose
      for (const a of b.archers) {
        const [wx, wy] = a.win, X = TA.px(x + wx) - 1, Y = gy - wy - 1;
        ctx.fillStyle = '#2e222f'; ctx.fillRect(X, Y, 2, 2);
        ctx.fillStyle = '#d6b08a'; ctx.fillRect(X + (a.dir < 0 ? 0 : 1), Y, 1, 1);
        ctx.fillStyle = '#4d3729'; ctx.fillRect(X + (a.dir < 0 ? 1 : 0), Y + 1, 1, 1);
        if (a.shot < 0.2) { ctx.fillStyle = '#fbb954'; ctx.fillRect(X + (a.dir < 0 ? -1 : 2), Y, 1, 1); }
      }
      // pennants for each level above the first
      for (let l = 1; l < b.level; l++) {
        const px = TA.px(x + (l === 1 ? -4 : 4));
        ctx.fillStyle = '#4d3729'; ctx.fillRect(px, gy - 21, 1, 5);
        ctx.fillStyle = Math.floor(t * 4 + l) % 2 ? '#e83b3b' : '#b33831'; ctx.fillRect(px + 1, gy - 21, 2, 2);
      }
    }
    if (b.type === 'market') {
      // stocked goods on the counter, and a coin when the till has money in it
      const items = Object.keys(b.stock).filter(k => b.stock[k] > 0).slice(0, 3);
      items.forEach((k, i) => TA.drawIcon(ctx, k, x - 8 + i * 8, gy + 1));
      if (b.till > 0) TA.drawIcon(ctx, 'coin', x, gy - 26 + Math.sin(t * 3) * 1.5);
    }
  }

  // The ground: a crust of tiles over the earth, holed at every shaft
  drawGround(ctx, game, camX) {
    const gy = this.baseY, W = this.w;
    const t0 = Math.floor(camX / 16) - 1, t1 = Math.floor((camX + W) / 16) + 1;
    const holes = this.shaftsInView(game, camX);
    ctx.save(); ctx.beginPath(); ctx.rect(-8, gy - 2, W + 16, TA.CRUST + 4);
    for (const s of holes) ctx.rect(TA.px(s.x - TA.HOLE - camX), gy - 2, TA.HOLE * 2, TA.CRUST + 4);
    ctx.clip('evenodd');
    for (let t = t0; t <= t1; t++) {
      const x = t * 16;
      const im = TA.img[TA.BIOMES[game.world.biomeAt(x + 8)].tiles]; if (!im) continue;
      const v = TA.GROUND_VARIANTS[TA.hash(game.seed, t, 3) % TA.GROUND_VARIANTS.length];
      ctx.drawImage(im, v * 16, 0, 16, 16, TA.px(x - camX), gy, 16, 16);
    }
    ctx.restore();
    // hole rims, and the trapdoor planks you drop through
    for (const s of holes) {
      const L = TA.px(s.x - TA.HOLE - camX), R = L + TA.HOLE * 2;
      ctx.fillStyle = '#2e222f'; ctx.fillRect(L - 1, gy, 1, TA.CRUST); ctx.fillRect(R, gy, 1, TA.CRUST);
      for (let x = L; x < R; x += 4) {
        ctx.fillStyle = '#805c45'; ctx.fillRect(x, gy, 3, 2);
        ctx.fillStyle = '#4d3729'; ctx.fillRect(x, gy + 2, 3, 1);
      }
    }
  }

  // Which 8px piece of the tileset's 48px nine-slice a solid cell uses: by how far
  // it is (1, 2 or more cells) from open air above, below and to each side, so
  // exposed faces get the pale rim and its patterned edge and the inside is plain.
  // Returns [x, y] within the nine-slice.
  tilePiece(solid, c, r) {
    let vy, hx;
    if (!solid(c, r + 1)) vy = 0; else if (!solid(c, r + 2)) vy = 8;
    else if (!solid(c, r - 1)) vy = 40; else if (!solid(c, r - 2)) vy = 32;
    else vy = 16 + 8 * (r & 1);
    if (!solid(c - 1, r)) hx = 0; else if (!solid(c - 2, r)) hx = 8;
    else if (!solid(c + 1, r)) hx = 40; else if (!solid(c + 2, r)) hx = 32;
    else hx = 16 + 8 * (c & 1);
    return [hx, vy];
  }

  // ------------------------------------------------------------ caves
  // Cave air: what you see wherever the earth is hollow
  drawCaveBack(game, camX) {
    const ctx = this.ctx, W = this.w, top = Math.max(0, this.baseY + TA.CRUST);
    const cb = TA.CAVE_BIOMES[game.world.caveBiomeAt(camX + W / 2)];
    ctx.fillStyle = cb.bg; ctx.fillRect(0, top, W, this.h - top);
    // the tileset's carved ring, faint and far off (half-speed parallax)
    const im = TA.img.caveTiles;
    if (im) {
      const mod = (v, m) => ((v % m) + m) % m;
      const ox = TA.px(-mod(camX * 0.5, 32)), oy = TA.px(mod(this.baseY * 0.5, 32) - 32);
      ctx.globalAlpha = 0.1;
      for (let y = oy; y < this.h; y += 32) if (y + 32 > top) for (let x = ox; x < W; x += 32) ctx.drawImage(im, 0, cb.pal * 48, 32, 32, x, y, 32, 32);
      ctx.globalAlpha = 1;
    }
    // daylight falling down the shafts
    const day = 1 - game.darkness() / 0.62;
    for (const s of this.shaftsInView(game, camX)) {
      const x = s.x - camX, y0 = this.baseY, bottom = this.Y(game.world.floorAt(s.x));
      const g = ctx.createLinearGradient(0, y0, 0, bottom);
      g.addColorStop(0, `rgba(255,236,190,${0.08 + 0.2 * day})`); g.addColorStop(1, 'rgba(255,236,190,0)');
      ctx.fillStyle = g; ctx.fillRect(TA.px(x - 12), y0, 24, bottom - y0);
    }
  }
  shaftsInView(game, camX) {
    const out = [], w = game.world;
    for (let i = w.regionOf(camX - 60); i <= w.regionOf(camX + this.w + 60); i++)
      for (const s of w.shaftsOfRegion(i)) if (s.x > camX - 60 && s.x < camX + this.w + 60) out.push(s);
    return out;
  }
  // The earth, autotiled from the cave tileset (see tilePiece).
  drawCaveRock(game, camX) {
    const ctx = this.ctx, w = game.world, im = TA.img.caveTiles; if (!im) return;
    const c0 = Math.floor(camX / 8) - 1, c1 = Math.floor((camX + this.w) / 8) + 1;
    const F = {}, C = {};
    for (let c = c0 - 2; c <= c1 + 2; c++) { F[c] = w.floorCol(c); C[c] = w.ceilCol(c); }
    // the ground above counts as rock here, so only cave air puts a rim on a face
    const solid = (c, r) => { const y0 = r * 8; return y0 >= 0 || y0 + 8 <= F[c] || y0 >= C[c]; };
    // rows on screen, bottom to top; the ground tiles cover the crust (rows -1, -2)
    const rLo = Math.floor((this.baseY - this.h) / 8) - 1, rHi = Math.min(-2, Math.ceil(this.baseY / 8));
    for (let c = c0; c <= c1; c++) {
      const X = TA.px(c * 8 - camX);
      const pal = TA.CAVE_BIOMES[w.caveBiomeVis(c * 8 + 4)].pal * 48;
      for (let r = rLo; r <= rHi; r++) {
        if (!solid(c, r)) continue;
        // under the crust only draw where it overhangs a shaft
        if (r === -2 && solid(c, r - 1)) continue;
        const [hx, vy] = this.tilePiece(solid, c, r);
        ctx.drawImage(im, 32 + hx, pal + vy, 8, 8, X, this.Y(r * 8 + 8), 8, 8);
      }
    }
    // ledges: a thin slab cut from the top and bottom rims, capped at the ends
    for (const pl of w.platformsIn(camX - 8, camX + this.w + 8)) {
      const pal = TA.CAVE_BIOMES[w.caveBiomeVis((pl.x0 + pl.x1) / 2)].pal * 48, y = this.Y(pl.y);
      for (let x = pl.x0, k = 0; x < pl.x1; x += 8, k++) {
        const tw = Math.min(8, pl.x1 - x), last = x + 8 >= pl.x1;
        const hx = k === 0 ? 0 : last ? 48 - tw : 16 + 8 * (k & 1);
        ctx.drawImage(im, 32 + hx, pal, tw, 4, TA.px(x - camX), y, tw, 4);
        ctx.drawImage(im, 32 + hx, pal + 44, tw, 4, TA.px(x - camX), y + 4, tw, 4);
      }
    }
  }

  // ------------------------------------------------------------ weather & colour
  drawWeather(ctx, game, camX) {
    const W = this.w, H = this.h, w = game.weatherNow(), d = w.def, k = w.k;
    const tt = performance.now() / 1000;
    if (d.rain && k > 0) {
      const n = Math.round(d.rain * k), slant = d.lightning ? 70 : 30;
      ctx.fillStyle = 'rgba(143,211,255,0.55)';
      for (let i = 0; i < n; i++) {
        const rx = ((TA.hash(i, 1) % 1000) + tt * slant - camX * 0.2) % (W + 20);
        const ry = ((TA.hash(i, 2) % 1000) + tt * (220 + (i % 5) * 20)) % (this.baseY + 10);
        ctx.fillRect(Math.round(rx), Math.round(ry), 1, 3);
      }
      // splashes on the ground
      ctx.fillStyle = 'rgba(199,220,208,0.6)';
      for (let i = 0; i < n / 6; i++) if ((tt * 8 + i) % 3 < 0.4) ctx.fillRect((TA.hash(i, 9, Math.floor(tt * 3)) % W), this.baseY - 1, 1, 1);
    }
    if (d.fog && k > 0) {
      const g = ctx.createLinearGradient(0, 0, 0, this.baseY + 8);
      g.addColorStop(0, `rgba(170,178,190,${0.15 * k})`); g.addColorStop(1, `rgba(186,192,200,${d.fog * k})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      // drifting banks, soft at the ends
      for (let i = 0; i < 6; i++) {
        const len = 60 + (i % 3) * 24, span = W + len * 2;
        const fx = (((TA.hash(i, 4) % 400) + tt * (3 + i) - camX * 0.6) % span + span) % span - len;
        const fy = this.baseY - 9 - (i % 3) * 6;
        for (let j = 0; j < 4; j++) {
          ctx.fillStyle = `rgba(205,214,220,${0.07 * k})`;
          ctx.fillRect(TA.px(fx + j * 8), fy - j * 0.5, len - j * 16, 3 + j);
        }
      }
    }
    // colour grade: the biome's own tint, then the weather's
    const [col, s] = TA.BIOMES[game.world.biomeAt(game.player.x)].grade;
    ctx.globalCompositeOperation = 'soft-light';
    if (s > 0) { ctx.globalAlpha = s; ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); }
    if (d.warm && k > 0) { ctx.globalAlpha = d.warm * k; ctx.fillStyle = '#ffc070'; ctx.fillRect(0, 0, W, H); }
    ctx.globalAlpha = 1;
    if (d.tone && k > 0) {
      ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = d.tone[1] * k;
      ctx.fillStyle = d.tone[0]; ctx.fillRect(0, 0, W, H);
    }
    if (d.sat > 0 && k > 0) {
      ctx.globalCompositeOperation = 'saturation'; ctx.globalAlpha = d.sat * k;
      ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, W, H);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }

  // Darkness: the time of day above ground, always deep dark below it
  drawLight(game, objs, camX) {
    const W = this.w, H = this.h, sd = game.darkness(), cd = 0.76;
    const top = this.baseY + TA.CRUST; // where the earth starts
    if (sd <= 0.01 && top >= H) return;
    const lc = this.ctxOf(this.light);
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, W, H);
    if (top > 0) { lc.fillStyle = `rgba(12,8,32,${sd})`; lc.fillRect(0, 0, W, top); }
    if (top < H) {
      const g = lc.createLinearGradient(0, top, 0, top + 30);
      g.addColorStop(0, `rgba(10,6,24,${Math.max(sd, 0.35)})`); g.addColorStop(1, `rgba(8,5,16,${cd})`);
      lc.fillStyle = g; lc.fillRect(0, top, W, H - top);
    }
    lc.globalCompositeOperation = 'destination-out';
    const lights = [];
    const p = game.player;
    lights.push([p.x, this.Y(p.y + 8), p.layer === 'c' ? 58 : 34]);
    for (const o of objs) {
      const oy = this.Y(o.y || 0);
      if (o.kind === 'campfire') lights.push([o.x, oy - 6, o.light + Math.sin(performance.now() / 120 + o.x) * 2]);
      else if (o.kind === 'portal') lights.push([o.x, oy - 6, 34]);
      else if (o.light && (o.kind === 'struct' || o.kind === 'rock' || o.kind === 'glow' || o.kind === 'mushroom')) lights.push([o.x, oy - 6, o.light]);
      else if (o.kind === 'wildcrop') lights.push([o.x, oy - 6, 14]);
    }
    // daylight down the shafts
    for (const s of this.shaftsInView(game, camX))
      for (let y = Math.max(this.baseY, -24); y < Math.min(H, this.Y(game.world.floorAt(s.x))); y += 24) lights.push([s.x, y, 6 + 24 * (1 - sd)]);
    for (const b of game.buildings) {
      if (!b.built) continue;
      if (b.type === 'lighttower') lights.push([b.x, this.baseY - 40, 110]);
      else if (b.type === 'hut' || b.type === 'market' || b.type === 'manor') lights.push([b.x, this.baseY - 10, 34]);
      else if (b.type === 'banner') lights.push([b.x, this.baseY - 14, 22]);
    }
    for (const pl of game.plots) if (pl.crop === 'moonflower' && game.cropStage(pl) >= 3) lights.push([pl.x, this.baseY - 6, 16]);
    for (const [lx, ly, r] of lights) {
      const sx = lx - camX; if (r <= 1 || sx < -r || sx > W + r) continue;
      const g = lc.createRadialGradient(sx, ly, 0, sx, ly, r);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = g; lc.fillRect(sx - r, ly - r, r * 2, r * 2);
    }
    this.blit(this.light, 1, true);
    // warm glow
    const gc = this.ctxOf(this.glow);
    gc.clearRect(0, 0, W, H);
    for (const [lx, ly, r] of lights) {
      const sx = lx - camX; if (r <= 1 || sx < -r || sx > W + r) continue;
      const g = gc.createRadialGradient(sx, ly, 0, sx, ly, r * 0.6);
      g.addColorStop(0, `rgba(80,45,10,${0.35 * (ly > top ? cd : sd)})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      gc.fillStyle = g; gc.fillRect(sx - r, ly - r, r * 2, r * 2);
    }
    this.ctx.globalCompositeOperation = 'lighter';
    this.blit(this.glow, 1, true);
    this.ctx.globalCompositeOperation = 'source-over';
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
  let cx = TA.px(x - w / 2); y = TA.px(y);
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
