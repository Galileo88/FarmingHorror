// ============================================================================
// Living things: player, creatures, folk, dogs, guards, arrows, particles.
// x is world px, entities stand on the ground line.
// ============================================================================
window.TA = window.TA || {};

// ---------------------------------------------------------------- player
TA.Player = class {
  constructor(x) {
    this.x = x; this.dir = 1; this.vx = 0;
    this.maxHp = 5; this.hp = 5;
    this.anim = new TA.Anim('player', 'idle');
    this.state = 'free'; this.action = null;
    this.invuln = 0; this.knock = 0; this.idleTime = 0;
  }
  get alive() { return this.state !== 'dead'; }

  // Start a tool action. onHit fires at hitFrame, onDone at the end.
  act(sheet, anim, hitFrame, onHit, onDone) {
    if (this.state !== 'free') return false;
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
    game.fx.text(this.x, 22, `-${dmg}`, '#e83b3b');
    game.shake = 3;
    if (this.hp <= 0) { this.hp = 0; this.state = 'dead'; this.anim.set('player', 'death', true); this.deadTime = 0; game.onPlayerDeath(); }
    else { this.state = 'hurt'; this.anim.set('player', 'hit', true); this.action = null; }
  }

  update(dt, game) {
    const inp = game.input;
    this.invuln = Math.max(0, this.invuln - dt);
    if (this.knock) {
      this.x += this.knock * dt; this.knock *= Math.pow(0.002, dt);
      if (Math.abs(this.knock) < 2) this.knock = 0;
    }
    this.anim.update(dt);
    if (this.state === 'dead') { this.deadTime += dt; return; }
    if (this.state === 'hurt') { if (this.anim.done) { this.state = 'free'; this.anim.set('player', 'idle'); } return; }
    if (this.state === 'action') {
      const a = this.action;
      if (!a.applied && this.anim.frame >= a.hitFrame) { a.applied = true; a.onHit && a.onHit(); }
      if (this.anim.done) {
        this.state = 'free'; this.action = null; this.anim.set('player', 'idle');
        a.onDone && a.onDone();
      }
      return;
    }
    let move = 0;
    if (game.ui.modal) move = 0;
    else {
      if (inp.isDown('left')) move -= 1;
      if (inp.isDown('right')) move += 1;
    }
    const run = inp.isDown('run');
    const speed = run ? 74 : 48;
    if (move) {
      this.dir = move;
      this.x += move * speed * dt;
      this.anim.set('player', 'walk');
      this.anim.def = [...TA.SHEETS.player.anims.walk]; if (run) this.anim.def[2] = 15;
      this.idleTime = 0;
    } else { this.anim.set('player', 'idle'); this.idleTime += dt; }
    // walls stop the player too (except your own walls: there is a gate)
    this.vx = move * speed;
  }
  draw(ctx, sx, gy) {
    if (this.invuln > 0 && this.state !== 'dead' && Math.floor(this.invuln * 12) % 2) return;
    TA.drawUnit(ctx, this.anim.sheet, this.anim.name, this.anim.frame, sx, gy, this.dir < 0);
  }
};

// ---------------------------------------------------------------- hostile creatures
TA.Mob = class {
  constructor(type, x, opts = {}) {
    this.type = type; this.def = TA.MOBS[type];
    this.sheet = this.def.sheet;
    this.x = x; this.home = opts.home ?? x; this.poi = opts.poi || null; this.nightSpawn = !!opts.night;
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
    game.fx.text(this.x, 20, `${dmg}`, '#fbb954');
    game.fx.burst(this.x, 8, this.def.undead ? '#c7dcd0' : '#b33831', 4);
    if (this.hp <= 0) this.die(game, true);
    else { this.state = 'hurt'; this.anim.set(this.sheet, 'hit', true); }
  }
  die(game, loot) {
    this.dead = true; this.hp = 0; this.state = 'dead';
    this.anim.set(this.sheet, 'death', true); this.deadT = 0;
    if (loot) {
      for (const [item, [lo, hi]] of Object.entries(this.def.loot)) {
        const n = lo + Math.floor(Math.random() * (hi - lo + 1));
        if (n > 0) game.dropItem(this.x, item, n);
      }
      game.stats.kills = (game.stats.kills || 0) + 1;
    }
  }
  // Is x protected from this creature (light, walls handled separately)?
  repelled(x, game) {
    for (const L of game.repelZones) if (Math.abs(x - L.x) < L.r && (L.all || this.def.undead)) return L;
    return null;
  }
  update(dt, game) {
    this.anim.update(dt);
    this.flash = Math.max(0, this.flash - dt);
    this.cool = Math.max(0, this.cool - dt);
    if (this.knock) { this.x += this.knock * dt; this.knock *= Math.pow(0.001, dt); if (Math.abs(this.knock) < 2) this.knock = 0; }
    if (this.dead) { this.deadT += dt; if (this.deadT > 2.2) this.removeMe = true; return; }
    if (this.state === 'hurt') { if (this.anim.done) this.state = 'chase'; return; }

    // choose a target: player, or a guard/dog that's closer
    const p = game.player;
    let target = p.alive ? p : null, tdist = target ? Math.abs(p.x - this.x) : 1e9;
    for (const g of game.guards) { const d = Math.abs(g.x - this.x); if (!g.dead && d < tdist) { target = g; tdist = d; } }
    const aggro = this.def.aggro;

    if (this.state === 'attack') {
      if (!this.atkApplied && this.anim.frame >= 3) {
        this.atkApplied = true;
        if (this.atkTarget && Math.abs(this.atkTarget.x - this.x) <= this.def.reach + 4) {
          if (this.atkTarget.isWall) this.atkTarget.damage(this.dmg, game);
          else this.atkTarget.hurt(this.dmg, this.x, game);
        }
      }
      if (this.anim.done) { this.state = 'chase'; this.cool = 0.9 + Math.random() * 0.5; }
      return;
    }

    let goal = null;
    if (target && tdist < aggro) goal = target.x;
    else if (this.nightSpawn && p.alive) goal = p.x; // night hunters wander toward the player
    let move = 0;
    if (goal !== null) {
      const dx = goal - this.x;
      this.dir = Math.sign(dx) || this.dir;
      if (Math.abs(dx) > this.def.reach) move = this.dir;
      else if (this.cool <= 0) { this.startAttack(target); return; }
    } else {
      // idle wander around home
      this.timer -= dt;
      if (this.timer <= 0) { this.timer = 1 + Math.random() * 3; this.wander = Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? -1 : 1); }
      if (this.wander) { move = this.wander; this.dir = move; if (Math.abs(this.x + move * 10 - this.home) > 60) this.wander = -this.wander; }
    }
    if (move) {
      const nx = this.x + move * this.speed * (goal !== null ? 1 : 0.5) * dt;
      // walls
      const wall = game.wallBetween(this.x, nx);
      if (wall) { this.dir = Math.sign(wall.x - this.x); if (this.cool <= 0) this.startAttack(wall); return; }
      // light keeps creatures out
      const L = this.repelled(nx, game);
      if (L && !this.repelled(this.x, game)) { this.anim.set(this.sheet, 'idle'); return; }
      this.x = nx;
      this.anim.set(this.sheet, 'walk');
    } else this.anim.set(this.sheet, 'idle');
    // creatures caught inside light slowly back away
    const L = this.repelled(this.x, game);
    if (L) { const s = Math.sign(this.x - L.x) || 1; this.x += s * 18 * dt; this.dir = s; }
  }
  startAttack(target) {
    this.state = 'attack'; this.atkTarget = target; this.atkApplied = false;
    this.anim.set(this.sheet, 'attack', true);
  }
  draw(ctx, sx, gy) {
    const a = this.dead ? Math.max(0, 1 - Math.max(0, this.deadT - 1.4) / 0.8) : 1;
    TA.drawUnit(ctx, this.sheet, this.anim.name, this.anim.frame, sx, gy, this.dir < 0, a);
    if (this.flash > 0) {
      ctx.globalCompositeOperation = 'lighter';
      TA.drawUnit(ctx, this.sheet, this.anim.name, this.anim.frame, sx, gy, this.dir < 0, 0.6);
      ctx.globalCompositeOperation = 'source-over';
    }
    if (!this.dead && this.hp < this.maxHp) {
      ctx.fillStyle = '#2e222f'; ctx.fillRect(Math.round(sx - 5), gy - 15, 10, 2);
      ctx.fillStyle = '#e83b3b'; ctx.fillRect(Math.round(sx - 5), gy - 15, Math.ceil(10 * this.hp / this.maxHp), 2);
    }
  }
};

// ---------------------------------------------------------------- friendly folk
TA.NPC = class {
  constructor(kind, x, poi) {
    this.kind = kind; this.x = x; this.home = x; this.poi = poi;
    this.sheet = kind === 'trader' ? 'trader' : kind;
    this.anim = new TA.Anim(this.sheet, 'idle');
    this.dir = -1; this.timer = 2; this.wander = 0;
  }
  update(dt, game) {
    this.anim.update(dt);
    const p = game.player, d = p.x - this.x;
    if (Math.abs(d) < 70) { this.dir = Math.sign(d) || 1; this.anim.set(this.sheet, 'idle'); return; }
    this.timer -= dt;
    if (this.timer < 0) { this.timer = 2 + Math.random() * 4; this.wander = Math.random() < 0.4 ? 0 : (Math.random() < 0.5 ? -1 : 1); }
    if (this.wander) {
      if (Math.abs(this.x + this.wander * 5 - this.home) > 30) this.wander = -this.wander;
      this.x += this.wander * 12 * dt; this.dir = this.wander; this.anim.set(this.sheet, 'walk');
    } else this.anim.set(this.sheet, 'idle');
  }
  draw(ctx, sx, gy) { TA.drawUnit(ctx, this.sheet, this.anim.name, this.anim.frame, sx, gy, this.dir < 0); }
};

// ---------------------------------------------------------------- dogs
TA.Dog = class {
  constructor(color, x, adopted = false) {
    this.color = color; this.sheet = 'dog_' + color; this.x = x; this.dir = -1;
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
    // fight: nearest living mob close to the player
    let foe = null, fd = 70;
    for (const m of game.mobs) { if (m.dead) continue; const d = Math.abs(m.x - this.x); if (d < fd && Math.abs(m.x - p.x) < 90) { foe = m; fd = d; } }
    if (foe) {
      this.dir = Math.sign(foe.x - this.x) || 1;
      if (fd > 10) { this.x += this.dir * 70 * dt; this.anim.set(this.sheet, 'move'); }
      else if (this.bite <= 0) { this.bite = 1.3; foe.hurt(1, this.x, game); this.anim.set(this.sheet, 'bark', true); }
      return;
    }
    const want = p.x - p.dir * 16, dx = want - this.x;
    if (Math.abs(dx) > 6) {
      const sp = Math.abs(dx) > 50 ? 80 : 50;
      this.dir = Math.sign(dx); this.x += this.dir * Math.min(sp * dt, Math.abs(dx));
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
    if (Math.abs(p.x - this.x) > 400) this.x = p.x - p.dir * 30; // keep up after sleeping/teleports
  }
  draw(ctx, sx, gy) { TA.drawUnit(ctx, this.sheet, this.anim.name, this.anim.frame, sx, gy + 2, this.dir < 0); }
};

// ---------------------------------------------------------------- guard (from barracks)
TA.Guard = class {
  constructor(x, home) {
    this.x = x; this.home = home; this.dir = 1; this.hp = 8; this.maxHp = 8;
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
    for (const m of game.mobs) { if (m.dead) continue; const d = Math.abs(m.x - this.x); if (d < fd && Math.abs(m.x - this.home) < r) { foe = m; fd = d; } }
    let goal = foe ? foe.x : this.home + Math.sin(game.time * 0.4) * (r - 50);
    const dx = goal - this.x;
    if (foe && Math.abs(dx) < 12) {
      this.dir = Math.sign(dx) || this.dir;
      if (this.cool <= 0) { this.state = 'attack'; this.target = foe; this.applied = false; this.anim.set('guard', 'attack', true); }
      else this.anim.set('guard', 'idle');
    } else if (Math.abs(dx) > 3) { this.dir = Math.sign(dx); this.x += this.dir * (foe ? 34 : 14) * dt; this.anim.set('guard', 'walk'); }
    else this.anim.set('guard', 'idle');
  }
  draw(ctx, sx, gy) { TA.drawUnit(ctx, 'guard', this.anim.name, this.anim.frame, sx, gy, this.dir < 0, this.dead ? Math.max(0, this.respawn / 30) : 1); }
};

// ---------------------------------------------------------------- arrows
TA.Arrow = class {
  constructor(x, y, target, dmg) {
    this.x = x; this.y = y; this.target = target; this.dmg = dmg; this.t = 0; this.done = false;
    this.sx = x; this.sy = y;
  }
  update(dt, game) {
    this.t += dt * 2.2;
    const tx = this.target.x, ty = 6;
    const t = Math.min(1, this.t);
    this.px = this.x; this.py = this.y;
    this.x = TA.lerp(this.sx, tx, t);
    this.y = TA.lerp(this.sy, ty, t) + Math.sin(t * Math.PI) * 14;
    if (t >= 1) { this.done = true; if (!this.target.dead) this.target.hurt(this.dmg, this.sx, game); }
  }
  draw(ctx, camX, gy) {
    ctx.strokeStyle = '#c8ac99'; ctx.lineWidth = 1; ctx.beginPath();
    const dx = this.x - (this.px ?? this.x), dy = this.y - (this.py ?? this.y);
    const len = Math.hypot(dx, dy) || 1;
    ctx.moveTo(Math.round(this.x - camX) + 0.5, Math.round(gy - this.y) + 0.5);
    ctx.lineTo(Math.round(this.x - camX - dx / len * 4) + 0.5, Math.round(gy - this.y + dy / len * 4) + 0.5);
    ctx.stroke();
  }
};

// ---------------------------------------------------------------- effects
TA.FX = class {
  constructor() { this.parts = []; this.texts = []; }
  burst(x, y, color, n = 6, spread = 40) {
    for (let i = 0; i < n; i++) this.parts.push({ x, y, vx: (Math.random() - 0.5) * spread, vy: 20 + Math.random() * 30, color, t: 0, life: 0.5 + Math.random() * 0.4 });
  }
  drops(x, y, color, n = 5) {
    for (let i = 0; i < n; i++) this.parts.push({ x: x + (Math.random() - 0.5) * 8, y: y + Math.random() * 4, vx: (Math.random() - 0.5) * 10, vy: 5, color, t: 0, life: 0.4 });
  }
  text(x, y, text, color = '#fff') { this.texts.push({ x, y, text, color, t: 0 }); }
  update(dt) {
    for (const p of this.parts) { p.t += dt; p.vy -= 120 * dt; p.x += p.vx * dt; p.y = Math.max(0, p.y + p.vy * dt); }
    this.parts = this.parts.filter(p => p.t < p.life);
    for (const t of this.texts) t.t += dt;
    this.texts = this.texts.filter(t => t.t < 1.1);
  }
  draw(ctx, camX, gy) {
    for (const p of this.parts) { ctx.fillStyle = p.color; ctx.fillRect(Math.round(p.x - camX), Math.round(gy - p.y), 1, 1); }
  }
};
