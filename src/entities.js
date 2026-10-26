// ============================================================================
// Living things: player, creatures, folk, travellers, dogs, guards, arrows,
// particles. x is world px; y is world height: 0 is the surface, the caves are
// negative. layer ('s' surface, 'c' caves) follows from y.
// Every draw(ctx, sx, by) gets the screen x and the screen y of the feet.
// ============================================================================
window.TA = window.TA || {};

// Shared movement: walk dx (blocked by cliffs, cave walls and low ceilings),
// then gravity and landing on the ground, the cave floor or a one-way ledge.
// Below the surface (y < 0) the earth is solid except for cave air and shafts.
// Returns true if the horizontal move was blocked.
TA.stepBody = function (e, dx, dt, world) {
  let blocked = false;
  if (dx) {
    let nx = e.x + dx;
    if (e.y >= -1) { const c = world.surfaceClamp(e.x, nx); if (c !== nx) blocked = true; nx = c; }
    else {
      const f = world.floorAt(nx), cl = world.ceilAt(nx);
      if (f > e.y + (e.onGround ? TA.STEP_UP : 0) + 0.01 || cl < e.y + TA.PLAYER_H) { blocked = true; nx = e.x; }
      else if (e.onGround && f > e.y) e.y = f; // walk up a small step
    }
    e.x = nx;
  }
  e.dropT = Math.max(0, (e.dropT || 0) - dt);
  const ground = world.supportAt(e.x, e.y, e.noLedges || e.dropT > 0, e.dropHatch || e.dropT > 0);
  if (e.onGround && e.y - ground <= TA.STEP_UP && e.y >= ground) { e.y = ground; e.vy = 0; } // walk down small steps
  else {
    e.onGround = false;
    e.vy -= TA.GRAVITY * dt;
    let ny = e.y + e.vy * dt;
    if (e.y < -1) {
      const cl = world.ceilAt(e.x);
      if (ny + TA.PLAYER_H > cl) { ny = cl - TA.PLAYER_H; if (e.vy > 0) e.vy = 0; }
    }
    if (e.vy <= 0 && ny <= ground) { ny = ground; e.vy = 0; e.onGround = true; }
    e.y = ny;
  }
  e.layer = e.y < -8 ? 'c' : 's';
  return blocked;
};

// ---------------------------------------------------------------- player
TA.Player = class {
  constructor(x, y = 0, layer = 's') {
    this.x = x; this.y = y; this.layer = layer; this.vy = 0; this.onGround = true;
    this.dir = 1; this.vx = 0;
    this.maxHp = 5; this.hp = 5;
    this.anim = new TA.Anim('player', 'idle');
    this.state = 'free'; this.action = null;
    this.invuln = 0; this.knock = 0; this.idleTime = 0;
    this.coyote = 0; this.jumpBuf = 0;
  }
  get alive() { return this.state !== 'dead'; }
  drop(game) {
    if (this.onGround && game.world.supportAt(this.x, this.y, true, true) < this.y - 0.5) { this.dropT = 0.4; this.onGround = false; } // long enough to clear the ledge under a trapdoor
  }

  // Start a tool action. onHit fires at hitFrame, onDone at the end.
  act(sheet, anim, hitFrame, onHit, onDone) {
    if (this.state !== 'free' || !this.onGround) return false;
    this.state = 'action';
    this.action = { onHit, onDone, hitFrame, applied: false };
    this.anim.set(sheet, anim, true);
    this.idleTime = 0;
    return true;
  }

  hurt(dmg, fromX, game) {
    if (this.invuln > 0 || !this.alive) return;
    this.hp -= dmg; this.invuln = 1.0;
    this.knock = Math.sign(this.x - fromX || 1) * 60;
    game.fx.text(this.x, this.y + 22, `-${dmg}`, '#e83b3b');
    game.shake = 3;
    if (this.hp <= 0) { this.hp = 0; this.state = 'dead'; this.anim.set('player', 'death', true); this.deadTime = 0; game.onPlayerDeath(); }
    else { this.state = 'hurt'; this.anim.set('player', 'hit', true); this.action = null; }
  }

  update(dt, game) {
    const inp = game.input;
    this.invuln = Math.max(0, this.invuln - dt);
    let dx = 0;
    if (this.knock) {
      dx += this.knock * dt; this.knock *= Math.pow(0.002, dt);
      if (Math.abs(this.knock) < 2) this.knock = 0;
    }
    this.anim.update(dt);
    if (this.state === 'dead') { this.deadTime += dt; TA.stepBody(this, 0, dt, game.world); return; }
    if (this.state === 'hurt') { if (this.anim.done) { this.state = 'free'; this.anim.set('player', 'idle'); } TA.stepBody(this, dx, dt, game.world); return; }
    if (this.state === 'action') {
      const a = this.action;
      if (!a.applied && this.anim.frame >= a.hitFrame) { a.applied = true; a.onHit && a.onHit(); }
      if (this.anim.done) {
        this.state = 'free'; this.action = null; this.anim.set('player', 'idle');
        a.onDone && a.onDone();
      }
      TA.stepBody(this, dx, dt, game.world);
      return;
    }
    let move = 0;
    if (!game.ui.modal) {
      if (inp.isDown('left')) move -= 1;
      if (inp.isDown('right')) move += 1;
    }
    const run = inp.isDown('run');
    const speed = run ? 74 : 48;
    // jumping: a short buffer before landing and a little grace after leaving an edge
    this.coyote = this.onGround ? 0.1 : Math.max(0, this.coyote - dt);
    this.jumpBuf = inp.hit('jump') ? 0.12 : Math.max(0, this.jumpBuf - dt);
    if (this.jumpBuf > 0 && this.coyote > 0) {
      this.vy = TA.JUMP_V; this.onGround = false; this.jumpBuf = 0; this.coyote = 0;
      game.fx.burst(this.x, this.y + 1, '#7f708a', 3, 30);
    }
    if (!this.onGround && this.vy > 0 && !inp.isDown('jump')) this.vy *= Math.pow(0.0005, dt); // let go early for a short hop
    // drop down through a ledge or a shaft's trapdoor
    if (inp.hit('down')) this.drop(game);
    if (move) this.dir = move;
    const landed = !this.onGround;
    TA.stepBody(this, dx + move * speed * dt, dt, game.world);
    if (landed && this.onGround) game.fx.burst(this.x, this.y + 1, '#7f708a', 3, 24);
    if (!this.onGround) { this.anim.set('player', 'walk'); this.anim.t = this.vy > 0 ? 2 / 11 : 5 / 11; this.idleTime = 0; }
    else if (move) {
      this.anim.set('player', 'walk');
      this.anim.def = [...TA.SHEETS.player.anims.walk]; if (run) this.anim.def[2] = 15;
      this.idleTime = 0;
    } else { this.anim.set('player', 'idle'); this.idleTime += dt; }
    this.vx = move * speed;
  }
  draw(ctx, sx, by) {
    if (this.invuln > 0 && this.state !== 'dead' && Math.floor(this.invuln * 12) % 2) return;
    TA.drawUnit(ctx, this.anim.sheet, this.anim.name, this.anim.frame, sx, by, this.dir < 0);
  }
};

// ---------------------------------------------------------------- hostile creatures
TA.CORPSE_HOLD = 60;   // seconds a body lies on the ground
TA.CORPSE_SINK = 3;    // then it sinks one pixel every this many seconds
TA.Mob = class {
  constructor(type, x, opts = {}) {
    this.type = type; this.def = TA.MOBS[type];
    this.sheet = this.def.sheet;
    this.x = x; this.home = opts.home ?? x; this.poi = opts.poi || null; this.nightSpawn = !!opts.night;
    this.layer = opts.layer || 's'; this.y = opts.y ?? 0; this.vy = 0; this.onGround = true; this.noLedges = true;
    const lvl = opts.level || 0;
    this.maxHp = this.def.hp + Math.floor(lvl / 2); this.hp = this.maxHp;
    this.dmg = this.def.dmg + (lvl >= 4 ? 1 : 0);
    this.dir = Math.random() < 0.5 ? -1 : 1;
    this.anim = new TA.Anim(this.sheet, 'idle');
    this.state = 'idle'; this.timer = Math.random() * 2; this.cool = 0;
    this.dead = false; this.removeMe = false; this.flash = 0; this.knock = 0;
    this.speed = this.def.speed * (0.9 + Math.random() * 0.2);
  }
  hurt(dmg, fromX, game) {
    if (this.dead) return;
    this.hp -= dmg; this.flash = 0.15;
    this.knock = Math.sign(this.x - fromX || 1) * 50;
    game.fx.text(this.x, this.y + 20, `${dmg}`, '#fbb954');
    game.fx.burst(this.x, this.y + 8, this.def.undead ? '#c7dcd0' : '#b33831', 4);
    if (this.hp <= 0) this.die(game, true);
    else { this.state = 'hurt'; this.anim.set(this.sheet, 'hit', true); }
  }
  die(game, loot) {
    this.dead = true; this.hp = 0; this.state = 'dead';
    this.anim.set(this.sheet, 'death', true); this.deadT = 0;
    if (loot) {
      for (const [item, [lo, hi]] of Object.entries(this.def.loot)) {
        const n = lo + Math.floor(Math.random() * (hi - lo + 1));
        if (n > 0) game.dropItem(this.x, item, n, this.y, this.layer);
      }
      game.stats.kills = (game.stats.kills || 0) + 1;
    }
  }
  // Pixels the body has sunk into the ground
  get sink() { return this.dead ? Math.max(0, Math.floor((this.deadT - TA.CORPSE_HOLD) / TA.CORPSE_SINK)) : 0; }
  // Is x protected from this creature (light, walls handled separately)?
  repelled(x, game) {
    if (this.layer !== 's') return null;
    for (const L of game.repelZones) if (Math.abs(x - L.x) < L.r && (L.all || this.def.undead)) return L;
    return null;
  }
  update(dt, game) {
    this.anim.update(dt);
    this.flash = Math.max(0, this.flash - dt);
    this.cool = Math.max(0, this.cool - dt);
    let kdx = 0;
    if (this.knock) { kdx = this.knock * dt; this.knock *= Math.pow(0.001, dt); if (Math.abs(this.knock) < 2) this.knock = 0; }
    if (this.dead) {
      this.deadT += dt;
      if (this.sink >= 16) this.removeMe = true;
      if (this.deadT < 2) TA.stepBody(this, kdx, dt, game.world);
      return;
    }
    if (this.state === 'hurt') { if (this.anim.done) this.state = 'chase'; TA.stepBody(this, kdx, dt, game.world); return; }

    // choose a target: player, or a guard that's closer
    const p = game.player;
    const reachable = t => t.layer === undefined || t.layer === this.layer;
    let target = p.alive && reachable(p) ? p : null, tdist = target ? Math.abs(p.x - this.x) : 1e9;
    if (this.layer === 's') for (const g of game.guards) { const d = Math.abs(g.x - this.x); if (!g.dead && d < tdist) { target = g; tdist = d; } }
    const aggro = this.def.aggro;
    const level = t => Math.abs((t.y || 0) - this.y) < 12;

    if (this.state === 'attack') {
      if (!this.atkApplied && this.anim.frame >= 3) {
        this.atkApplied = true;
        const t = this.atkTarget;
        if (t && Math.abs(t.x - this.x) <= this.def.reach + 4) {
          if (t.isWall) t.damage(this.dmg, game);
          else if (level(t)) t.hurt(this.dmg, this.x, game);
        }
      }
      if (this.anim.done) { this.state = 'chase'; this.cool = 0.9 + Math.random() * 0.5; }
      TA.stepBody(this, kdx, dt, game.world);
      return;
    }

    let goal = null;
    if (target && tdist < aggro) goal = target.x;
    else if (this.nightSpawn && target === p) goal = p.x; // night hunters wander toward the player
    let move = 0;
    if (goal !== null) {
      const dx = goal - this.x;
      this.dir = Math.sign(dx) || this.dir;
      if (Math.abs(dx) > this.def.reach) move = this.dir;
      else if (this.cool <= 0 && level(target)) { this.startAttack(target); return; }
    } else {
      // idle wander around home
      this.timer -= dt;
      if (this.timer <= 0) { this.timer = 1 + Math.random() * 3; this.wander = Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? -1 : 1); }
      if (this.wander) { move = this.wander; this.dir = move; if (Math.abs(this.x + move * 10 - this.home) > 60) this.wander = -this.wander; }
    }
    let mdx = 0;
    if (move) {
      mdx = move * this.speed * (goal !== null ? 1 : 0.5) * dt;
      const nx = this.x + mdx;
      if (this.layer === 's') {
        // walls
        const wall = game.wallBetween(this.x, nx);
        if (wall) { this.dir = Math.sign(wall.x - this.x); if (this.cool <= 0) this.startAttack(wall); return; }
        // light keeps creatures out
        const L = this.repelled(nx, game);
        if (L && !this.repelled(this.x, game)) { this.anim.set(this.sheet, 'idle'); mdx = 0; }
      }
    }
    const blocked = TA.stepBody(this, mdx + kdx, dt, game.world);
    // in the caves, creatures hop up ledges they can't walk onto
    if (blocked && this.layer === 'c' && this.onGround && goal !== null) { this.vy = TA.JUMP_V * 0.95; this.onGround = false; }
    this.anim.set(this.sheet, mdx ? 'walk' : 'idle');
    // creatures caught inside light slowly back away
    const L = this.repelled(this.x, game);
    if (L) { const s = Math.sign(this.x - L.x) || 1; this.x += s * 18 * dt; this.dir = s; }
  }
  startAttack(target) {
    this.state = 'attack'; this.atkTarget = target; this.atkApplied = false;
    this.anim.set(this.sheet, 'attack', true);
  }
  draw(ctx, sx, by) {
    if (this.dead) {
      // bodies stay a minute, then sink into the ground a pixel at a time
      const sink = this.sink;
      ctx.save(); ctx.beginPath(); ctx.rect(TA.px(sx) - 24, by - 40, 48, 40); ctx.clip();
      TA.drawUnit(ctx, this.sheet, this.anim.name, this.anim.frame, sx, by + sink, this.dir < 0);
      ctx.restore();
      return;
    }
    TA.drawUnit(ctx, this.sheet, this.anim.name, this.anim.frame, sx, by, this.dir < 0);
    if (this.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      TA.drawUnit(ctx, this.sheet, this.anim.name, this.anim.frame, sx, by, this.dir < 0, 0.6);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (this.hp < this.maxHp) {
      ctx.fillStyle = '#2e222f'; ctx.fillRect(TA.px(sx - 5), TA.px(by - 15), 10, 2);
      ctx.fillStyle = '#e83b3b'; ctx.fillRect(TA.px(sx - 5), TA.px(by - 15), Math.ceil(10 * this.hp / this.maxHp), 2);
    }
  }
};

// ---------------------------------------------------------------- friendly folk you can trade with
TA.NPC_SHEET = { trader: 'trader', elf: 'elf', dwarf: 'dwarf', hermit: 'wizard' };
TA.NPC = class {
  constructor(kind, x, poi) {
    this.kind = kind; this.x = x; this.home = x; this.poi = poi; this.y = 0;
    this.sheet = TA.NPC_SHEET[kind] || kind;
    this.anim = new TA.Anim(this.sheet, 'idle');
    this.dir = -1; this.timer = 2; this.wander = 0;
  }
  update(dt, game) {
    this.anim.update(dt);
    const p = game.player, d = p.x - this.x;
    if (Math.abs(d) < 70 && p.layer === 's') { this.dir = Math.sign(d) || 1; this.anim.set(this.sheet, 'idle'); return; }
    this.timer -= dt;
    if (this.timer < 0) { this.timer = 2 + Math.random() * 4; this.wander = Math.random() < 0.4 ? 0 : (Math.random() < 0.5 ? -1 : 1); }
    if (this.wander) {
      if (Math.abs(this.x + this.wander * 5 - this.home) > 30) this.wander = -this.wander;
      this.x += this.wander * 12 * dt; this.dir = this.wander; this.anim.set(this.sheet, 'walk');
    } else this.anim.set(this.sheet, 'idle');
  }
  draw(ctx, sx, by) { TA.drawUnit(ctx, this.sheet, this.anim.name, this.anim.frame, sx, by, this.dir < 0); }
};

// ---------------------------------------------------------------- townsfolk
// walk: strolls between spots, stops to chat, heads indoors at night
// work: loops a job animation at its station (smith, farmer, woodcutter, miner)
// guard: paces the street day and night
TA.Folk = class {
  constructor(o) {
    this.x = o.x; this.y = 0; this.sheet = o.sheet; this.role = o.role; this.range = o.range; this.doors = o.doors || [];
    this.workAnim = o.anim || 'work'; this.dir = o.face || (Math.random() < 0.5 ? -1 : 1);
    this.anim = new TA.Anim(this.sheet, o.role === 'work' ? this.workAnim : 'idle');
    this.anim.t = Math.random() * 3;
    this.state = 'idle'; this.timer = Math.random() * 3; this.goal = null; this.alpha = 1; this.inside = false;
    this.speed = o.role === 'guard' ? 9 : 10 + Math.random() * 7;
    this.chatT = 0; this.bubble = 0;
    if (o.role === 'work') this.home = o.x;
  }
  homeTime(game) { const h = game.time; return h >= 20.5 || h < 5.5; }
  update(dt, game) {
    this.anim.update(dt);
    this.bubble = Math.max(0, this.bubble - dt);
    const night = this.homeTime(game);
    // fade in and out of doorways
    const wantInside = night && this.role !== 'guard';
    if (this.inside && !wantInside) { this.inside = false; this.state = 'idle'; this.timer = 1; }
    this.alpha = TA.clamp(this.alpha + (this.inside ? -dt : dt) * 2, 0, 1);
    if (this.inside) return;
    if (this.role === 'work') {
      if (wantInside) { this.inside = true; return; }
      this.anim.set(this.sheet, this.workAnim);
      return;
    }
    if (wantInside && this.state !== 'home') {
      const door = this.doors.length ? this.doors.reduce((a, b) => Math.abs(b - this.x) < Math.abs(a - this.x) ? b : a) : this.x;
      this.state = 'home'; this.goal = door;
    }
    if (this.state === 'home') {
      if (this.walkTo(dt)) this.inside = true;
      return;
    }
    if (this.state === 'chat') {
      this.chatT -= dt; this.anim.set(this.sheet, 'idle');
      if (this.chatT <= 0) { this.state = 'idle'; this.timer = 1 + Math.random() * 2; }
      return;
    }
    if (this.state === 'walk') { if (this.walkTo(dt)) { this.state = 'idle'; this.timer = 1.5 + Math.random() * 4; } return; }
    // idle
    this.anim.set(this.sheet, 'idle');
    this.timer -= dt;
    if (this.timer > 0) return;
    const [x0, x1] = this.range;
    if (this.role === 'guard') { this.goal = this.x < (x0 + x1) / 2 ? x1 - Math.random() * 30 : x0 + Math.random() * 30; this.state = 'walk'; return; }
    // maybe strike up a chat with someone nearby
    const buddy = this.role === 'walk' && Math.random() < 0.35 && game.folk.find(f => f !== this && f.role === 'walk' && !f.inside && f.state === 'idle' && Math.abs(f.x - this.x) < 40 && Math.abs(f.x - this.x) > 8);
    if (buddy) {
      const t = 3 + Math.random() * 3;
      this.state = buddy.state = 'chat'; this.chatT = buddy.chatT = t;
      this.dir = Math.sign(buddy.x - this.x); buddy.dir = -this.dir;
      (Math.random() < 0.5 ? this : buddy).bubble = 1.6;
      return;
    }
    this.goal = TA.clamp(this.x + (Math.random() - 0.5) * 160, x0, x1);
    this.state = 'walk';
  }
  walkTo(dt) {
    const dx = this.goal - this.x;
    if (Math.abs(dx) < 1.5) { this.anim.set(this.sheet, 'idle'); return true; }
    this.dir = Math.sign(dx);
    this.x += this.dir * Math.min(Math.abs(dx), this.speed * dt);
    this.anim.set(this.sheet, 'walk');
    return false;
  }
  talk(game) {
    this.bubble = 2.2; this.dir = Math.sign(game.player.x - this.x) || 1;
    if (this.state === 'walk') { this.state = 'idle'; this.timer = 3; }
    return TA.FOLK_LINES[Math.floor(Math.random() * TA.FOLK_LINES.length)];
  }
  draw(ctx, sx, by) {
    if (this.alpha <= 0) return;
    TA.drawUnit(ctx, this.sheet, this.anim.name, this.anim.frame, sx, by, this.dir < 0, this.alpha);
    if (this.bubble > 0) TA.drawBubble(ctx, sx + this.dir * 3, by - 14);
  }
};
// A tiny "..." speech bubble
TA.drawBubble = function (ctx, x, y) {
  x = TA.px(x); y = TA.px(y);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 4, y - 4, 9, 5); ctx.fillRect(x - 1, y + 1, 2, 1);
  ctx.fillStyle = '#2e222f'; ctx.fillRect(x - 3, y - 2, 1, 1); ctx.fillRect(x, y - 2, 1, 1); ctx.fillRect(x + 3, y - 2, 1, 1);
};

// ---------------------------------------------------------------- travellers on the road
// They walk across the world, stop at your market stall to buy what you have stocked,
// and will trade with you if you stop them.
TA.Traveller = class {
  constructor(x, dir, sheet) {
    this.x = x; this.y = 0; this.dir = dir; this.sheet = sheet; this.kind = 'trader';
    this.anim = new TA.Anim(sheet, 'walk');
    this.state = 'walk'; this.timer = 0; this.visited = new Set(); this.removeMe = false;
    this.purse = 20 + Math.floor(Math.random() * 60);
    this.speed = 16 + Math.random() * 6;
  }
  update(dt, game) {
    this.anim.update(dt);
    const p = game.player;
    if (p.layer !== 's' || Math.abs(this.x - p.x) > 700) { this.removeMe = true; return; }
    if (this.state === 'browse') {
      this.anim.set(this.sheet, 'idle');
      this.timer -= dt;
      if (this.timer <= 0) { game.travellerBuys(this, this.market); this.state = 'walk'; }
      return;
    }
    // stop and chat when the player is right there
    if (Math.abs(p.x - this.x) < 22 && p.onGround) { this.anim.set(this.sheet, 'idle'); this.facing = Math.sign(p.x - this.x) || 1; return; }
    this.facing = null;
    const m = game.buildings.find(b => b.type === 'market' && b.built && !this.visited.has(b) && Math.abs(b.x - this.x) < 3);
    if (m) {
      this.visited.add(m);
      if (Object.values(m.stock).some(n => n > 0)) { this.state = 'browse'; this.timer = 2.5 + Math.random() * 2; this.market = m; return; }
    }
    const nx = game.world.surfaceClamp(this.x, this.x + this.dir * this.speed * dt);
    if (nx === this.x) { this.removeMe = true; return; }
    this.x = nx; this.anim.set(this.sheet, 'walk');
  }
  draw(ctx, sx, by) {
    const flip = (this.facing || this.dir) < 0;
    TA.drawUnit(ctx, this.sheet, this.anim.name, this.anim.frame, sx, by, flip);
    // a pack on their back
    ctx.fillStyle = '#805c45'; ctx.fillRect(TA.px(sx) + (flip ? 1 : -3), TA.px(by - 6), 2, 3);
  }
};

// ---------------------------------------------------------------- dogs
TA.Dog = class {
  constructor(color, x, adopted = false) {
    this.color = color; this.sheet = 'dog_' + color; this.x = x; this.y = 0; this.layer = 's'; this.dir = -1;
    this.vy = 0; this.onGround = true; this.noLedges = false;
    this.adopted = adopted; this.anim = new TA.Anim(this.sheet, adopted ? 'idle' : 'sitidle');
    this.bite = 0; this.barkT = 0; this.state = adopted ? 'follow' : 'stray';
  }
  update(dt, game) {
    this.anim.update(dt);
    this.bite = Math.max(0, this.bite - dt);
    if (!this.adopted) {
      const d = Math.abs(game.player.x - this.x);
      if (d < 30 && this.anim.name === 'sitidle') this.anim.set(this.sheet, 'sitbark', true);
      if (this.anim.done) this.anim.set(this.sheet, 'sitidle');
      if (d < 50) this.dir = Math.sign(game.player.x - this.x) || 1;
      return;
    }
    const p = game.player;
    // keep up after sleeping, teleports and long climbs
    if (Math.abs(p.x - this.x) > 300 || (Math.abs(p.y - this.y) > 70 && p.onGround)) {
      this.layer = p.layer; this.x = p.x - p.dir * 12; this.y = p.y; this.vy = 0; this.onGround = true;
    }
    let mdx = 0;
    // fight: nearest living mob close to the player
    let foe = null, fd = 70;
    for (const m of game.mobs) { if (m.dead || m.layer !== this.layer) continue; const d = Math.abs(m.x - this.x); if (d < fd && Math.abs(m.x - p.x) < 90) { foe = m; fd = d; } }
    if (foe) {
      this.dir = Math.sign(foe.x - this.x) || 1;
      if (fd > 10) { mdx = this.dir * 70 * dt; this.anim.set(this.sheet, 'move'); }
      else if (this.bite <= 0 && Math.abs(foe.y - this.y) < 12) { this.bite = 1.3; foe.hurt(1, this.x, game); this.anim.set(this.sheet, 'bark', true); }
    } else {
      const want = p.x - p.dir * 16, dx = want - this.x;
      if (Math.abs(dx) > 6) {
        const sp = Math.abs(dx) > 50 ? 80 : 50;
        this.dir = Math.sign(dx); mdx = this.dir * Math.min(sp * dt, Math.abs(dx));
        this.anim.set(this.sheet, 'move'); this.sitT = 0;
      } else {
        this.sitT = (this.sitT || 0) + dt;
        if (game.isNight() && game.inClaim(this.x) && this.sitT > 4) {
          if (!['sleep', 'sleepidle'].includes(this.anim.name)) this.anim.set(this.sheet, 'sleep', true);
          else if (this.anim.done) this.anim.set(this.sheet, 'sleepidle');
        } else if (this.sitT > 2.5) {
          if (!['sit', 'sitidle', 'sitbark'].includes(this.anim.name)) this.anim.set(this.sheet, 'sit', true);
          else if (this.anim.done) this.anim.set(this.sheet, 'sitidle');
        } else this.anim.set(this.sheet, 'idle');
        if (Math.abs(p.x - this.x) > 1) this.dir = Math.sign(p.x - this.x);
      }
    }
    // follow the player down through ledges and trapdoors, hop up after them
    this.noLedges = this.dropHatch = p.y < this.y - 4;
    const blocked = TA.stepBody(this, mdx, dt, game.world);
    if (blocked && this.onGround) { this.vy = TA.JUMP_V; this.onGround = false; }
  }
  draw(ctx, sx, by) { TA.drawUnit(ctx, this.sheet, this.anim.name, this.anim.frame, sx, by, this.dir < 0); }
};

// ---------------------------------------------------------------- guard (from barracks)
TA.Guard = class {
  constructor(x, home) {
    this.x = x; this.y = 0; this.layer = 's'; this.home = home; this.dir = 1; this.hp = 8; this.maxHp = 8;
    this.anim = new TA.Anim('guard', 'idle'); this.state = 'patrol'; this.cool = 0; this.dead = false; this.target = null;
  }
  hurt(dmg, fromX, game) {
    if (this.dead) return;
    this.hp -= dmg; game.fx.text(this.x, 20, `-${dmg}`, '#e83b3b');
    if (this.hp <= 0) { this.dead = true; this.anim.set('guard', 'death', true); this.respawn = 30; }
  }
  update(dt, game) {
    this.anim.update(dt); this.cool = Math.max(0, this.cool - dt);
    if (this.dead) { this.respawn -= dt; if (this.respawn <= 0) { this.dead = false; this.hp = this.maxHp; this.x = this.home; this.anim.set('guard', 'idle'); } return; }
    if (this.state === 'attack') {
      if (!this.applied && this.anim.frame >= 3) { this.applied = true; if (this.target && !this.target.dead && Math.abs(this.target.x - this.x) < 16) this.target.hurt(2, this.x, game); }
      if (this.anim.done) { this.state = 'patrol'; this.cool = 0.8; }
      return;
    }
    const r = game.claim ? game.claim.r + 40 : 120;
    let foe = null, fd = 100;
    for (const m of game.mobs) { if (m.dead || m.layer !== 's') continue; const d = Math.abs(m.x - this.x); if (d < fd && Math.abs(m.x - this.home) < r) { foe = m; fd = d; } }
    let goal = foe ? foe.x : this.home + Math.sin(game.time * 0.4) * (r - 50);
    const dx = goal - this.x;
    if (foe && Math.abs(dx) < 12) {
      this.dir = Math.sign(dx) || this.dir;
      if (this.cool <= 0) { this.state = 'attack'; this.target = foe; this.applied = false; this.anim.set('guard', 'attack', true); }
      else this.anim.set('guard', 'idle');
    } else if (Math.abs(dx) > 3) { this.dir = Math.sign(dx); this.x += this.dir * (foe ? 34 : 14) * dt; this.anim.set('guard', 'walk'); }
    else this.anim.set('guard', 'idle');
  }
  draw(ctx, sx, by) { TA.drawUnit(ctx, 'guard', this.anim.name, this.anim.frame, sx, by, this.dir < 0, this.dead ? Math.max(0, this.respawn / 30) : 1); }
};

// ---------------------------------------------------------------- arrows
TA.Arrow = class {
  constructor(x, y, target, dmg) {
    this.x = x; this.y = y; this.target = target; this.dmg = dmg; this.t = 0; this.done = false;
    this.sx = x; this.sy = y;
  }
  update(dt, game) {
    this.t += dt * 2.2;
    const tx = this.target.x, ty = (this.target.y || 0) + 6;
    const t = Math.min(1, this.t);
    this.px = this.x; this.py = this.y;
    this.x = TA.lerp(this.sx, tx, t);
    this.y = TA.lerp(this.sy, ty, t) + Math.sin(t * Math.PI) * 14;
    if (t >= 1) { this.done = true; if (!this.target.dead) this.target.hurt(this.dmg, this.sx, game); }
  }
  draw(ctx, camX, baseY) {
    // a short shaft of pixels along the flight direction
    const dx = this.x - (this.px ?? this.x), dy = this.y - (this.py ?? this.y);
    const len = Math.hypot(dx, dy) || 1;
    ctx.fillStyle = '#c8ac99';
    for (let k = 0; k < 4; k++) ctx.fillRect(TA.px(this.x - camX - dx / len * k), TA.px(baseY - this.y + dy / len * k), 1, 1);
  }
};

// ---------------------------------------------------------------- effects
// Heights are world heights; particles settle on whatever is under them.
TA.FX = class {
  constructor() { this.parts = []; this.texts = []; }
  floor(x, y) { const g = TA.game; return g ? g.world.supportAt(x, y) : 0; }
  burst(x, y, color, n = 6, spread = 40) {
    const fl = this.floor(x, y);
    for (let i = 0; i < n; i++) this.parts.push({ x, y, fl, vx: (Math.random() - 0.5) * spread, vy: 20 + Math.random() * 30, color, t: 0, life: 0.5 + Math.random() * 0.4 });
  }
  drops(x, y, color, n = 5) {
    const fl = this.floor(x, y);
    for (let i = 0; i < n; i++) this.parts.push({ x: x + (Math.random() - 0.5) * 8, y: y + Math.random() * 4, fl, vx: (Math.random() - 0.5) * 10, vy: 5, color, t: 0, life: 0.4 });
  }
  text(x, y, text, color = '#fff') { this.texts.push({ x, y, text, color, t: 0 }); }
  update(dt) {
    for (const p of this.parts) { p.t += dt; p.vy -= 120 * dt; p.x += p.vx * dt; p.y = Math.max(p.fl, p.y + p.vy * dt); }
    this.parts = this.parts.filter(p => p.t < p.life);
    for (const t of this.texts) t.t += dt;
    this.texts = this.texts.filter(t => t.t < 1.1);
  }
  draw(ctx, camX, baseY) {
    for (const p of this.parts) { ctx.fillStyle = p.color; ctx.fillRect(TA.px(p.x - camX), TA.px(baseY - p.y), 1, 1); }
  }
};
