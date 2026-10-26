// ============================================================================
// DOM interface layered over the canvas: HUD, prompts, menus, touch controls.
// ============================================================================
window.TA = window.TA || {};

TA.UI = class {
  constructor(root) {
    this.root = root;
    this.modal = null; this.target = null; this.refreshT = 0; this.mapT = 0;
    this.$ = id => document.getElementById(id);
    this.touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
    document.body.classList.toggle('touch', this.touch);
    this.bindTouch();
  }
  attach(game) { this.game = game; game.ui = this; }

  // ------------------------------------------------------------ toasts & banners
  toast(msg, kind = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind; el.textContent = msg;
    this.$('toasts').appendChild(el);
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 3200);
    while (this.$('toasts').children.length > 4) this.$('toasts').firstChild.remove();
  }
  biomeBanner(name, color, sub = 'entering') {
    const el = this.$('biome');
    el.innerHTML = `<small>${sub}</small>${name}`; el.style.setProperty('--c', color);
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  }
  flashItem(item) {
    const el = document.querySelector(`[data-item="${item}"]`);
    if (el) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
  }
  fadeOut(cb) {
    const g = this.game; let t = 0;
    const step = () => {
      t += 1 / 30; g.fade = Math.min(1, t * 2.5);
      if (t < 0.45) requestAnimationFrame(step);
      else { cb(); const back = () => { g.fade -= 1 / 30; if (g.fade > 0) requestAnimationFrame(back); else g.fade = 0; }; back(); }
    };
    step();
  }

  // ------------------------------------------------------------ per-frame HUD
  update(dt) {
    const g = this.game, p = g.player;
    this.target = g.ui.modal ? null : g.contextTarget();
    // prompt above the player
    const pr = this.$('prompt'), R = TA.renderer;
    if (this.target && !this.target.quiet) {
      const sx = (p.x - R.camX) * R.scale, sy = (R.Y(p.y) - 22) * R.scale;
      pr.style.transform = `translate(${Math.round(sx)}px, ${Math.round(sy)}px) translate(-50%, -100%)`;
      const key = this.touch ? '' : '<kbd>E</kbd>';
      const html = `${key}${TA.iconHTML(this.target.icon, 16)}<span>${this.target.label}</span>`;
      if (pr.innerHTML !== html) pr.innerHTML = html;
      pr.classList.toggle('dim', !this.target.run);
      pr.style.display = '';
    } else pr.style.display = 'none';
    const ab = this.$('t-action');
    if (ab) { const ic = this.target ? this.target.icon : 'scythe'; if (ab.dataset.icon !== ic) { ab.dataset.icon = ic; ab.innerHTML = TA.iconHTML(ic, 28); } }

    this.refreshT -= dt;
    if (this.refreshT <= 0) { this.refreshT = 0.15; this.refresh(); }
    this.mapT -= dt;
    if (this.mapT <= 0) { this.mapT = 0.25; this.drawMap(); }
  }
  refresh() {
    const g = this.game, p = g.player, inv = g.inv;
    let hearts = '';
    for (let i = 0; i < p.maxHp; i++) hearts += TA.iconHTML(i < p.hp ? 'heart' : 'heart_empty', 18);
    this.set('hearts', hearts);
    const night = g.isNight();
    const w = g.weatherNow();
    const wx = w.k > 0.2 && w.def.name ? `<span class="wx ${w.type}">${w.def.name}</span>` : '';
    this.set('clock', `${TA.iconHTML(night ? 'moon' : 'sun', 16)}<b>Day ${g.day}</b><span>${TA.fmtTime(g.time)}</span>${wx}`);
    this.set('coins', `${TA.iconHTML('coin', 16)}<b data-item="coin">${inv.coin || 0}</b>`);
    const res = ['wood', 'stone', 'fiber', 'gem'].map(k => `<span class="res" data-item="${k}" title="${TA.ITEMS[k].name}">${TA.iconHTML(k, 16)}${inv[k] || 0}</span>`).join('');
    const prod = [...TA.CROP_ORDER, 'mushroom', 'meat', 'potion'].filter(k => inv[k] > 0)
      .map(k => `<span class="res" data-item="${k}" title="${TA.ITEMS[k].name}">${TA.iconHTML(k, 16)}${inv[k]}</span>`).join('');
    this.set('res', res + (prod ? `<i class="sep"></i>${prod}` : ''));
    const s = g.selectedSeed, n = inv['seed_' + s] || 0;
    this.set('seed', `${TA.iconHTML('seed_' + s, 20)}<span><small>seed</small>${TA.CROPS[s].name} ×${n}</span>`);
    const b = p.layer === 'c' ? TA.CAVE_BIOMES[g.world.caveBiomeAt(p.x)] : TA.BIOMES[g.world.biomeAt(p.x)];
    const d = Math.round((p.x - (g.claim ? g.claim.x : 0)) / 16);
    const depth = p.layer === 'c' ? ' <span>(underground)</span>' : '';
    this.set('where', `<b style="color:${b.color}">${b.name}</b>${depth} <span>${g.claim ? (d === 0 ? 'home' : `${Math.abs(d)}m ${d < 0 ? 'west' : 'east'} of home`) : 'no home yet'}</span>`);
    this.set('hint', this.hintText());
  }
  set(id, html) { const el = this.$(id); if (el && el._h !== html) { el.innerHTML = html; el._h = html; } }

  hintText() {
    const g = this.game, inv = g.inv, k = this.touch ? '' : 'Press ';
    if (!g.claim) {
      if ((inv.wood || 0) < 6) return `Chop trees for wood. Stand by a tree and ${this.touch ? 'tap the action button' : 'press <kbd>E</kbd>'}.`;
      return `${k}${this.touch ? 'Tap <b>Build</b>' : '<kbd>B</kbd>'} to plant your banner and claim land for a farm.`;
    }
    if (!g.plots.length) return 'Stand on your land and till the soil.';
    if (!g.plots.some(p => p.crop)) return `Plant seeds in the tilled soil. ${this.touch ? 'Tap the seed' : '<kbd>Q</kbd>'} to switch seed type.`;
    if (g.plots.some(p => p.crop && !p.wet && p.prog < 1) && !g.tutorial.watered) return 'Crops only grow when watered. Water them each day, or wait for rain.';
    if (!g.has('hut')) return `Build a hut (${k}${this.touch ? 'Build' : '<kbd>B</kbd>'}) so you can sleep through the night.`;
    if (!g.has('market')) return 'Build a market to sell your harvest, or trade with travellers.';
    if (!g.has('lighttower')) return 'A light tower keeps night creatures away from your fields.';
    const m = g.buildings.find(b => b.type === 'market');
    if (m && !g.tutorial.stall && !Object.keys(m.stock).length) return 'Stock your market stall. Travellers passing by will buy from it.';
    if (g.underground && !g.tutorial.climbed) return `Jump (${this.touch ? 'the ▲ button' : '<kbd>W</kbd> / <kbd>Space</kbd>'}) up the ledges to the light to climb back out.`;
    return '';
  }

  // ------------------------------------------------------------ strip map
  drawMap() {
    const c = this.$('map'); if (!c) return;
    const g = this.game, w = c.width, h = c.height, ctx = c.getContext('2d');
    const ex = g.world.explored, p = g.player;
    const lo = Math.min(ex[0], p.x) - 300, hi = Math.max(ex[1], p.x) + 300;
    const span = Math.max(2400, hi - lo), mid = (lo + hi) / 2;
    const toX = x => Math.round((x - (mid - span / 2)) / span * w);
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(20,14,26,0.85)'; ctx.fillRect(0, 0, w, h);
    // explored biome bands
    for (let x = ex[0]; x < ex[1]; x += span / w * 2) {
      ctx.fillStyle = TA.BIOMES[g.world.biomeAt(x)].color;
      ctx.globalAlpha = 0.55; ctx.fillRect(toX(x), h - 7, 3, 4); ctx.globalAlpha = 1;
    }
    // thickets no one can cross, around hidden biomes
    ctx.fillStyle = '#c7dcd0';
    for (const bd of g.world.bordersIn(ex[0], ex[1])) if (bd.blocked) ctx.fillRect(toX(bd.x), 1, 1, h - 2);
    for (const d of Object.values(g.world.discovered)) {
      if (d.type === 'cave') { ctx.fillStyle = '#7f708a'; ctx.fillRect(toX(d.x) - 1, h - 4, 3, 3); continue; }
      if (d.type === 'portal') { ctx.fillStyle = '#8ff8e2'; ctx.fillRect(toX(d.x), h - 15, 1, 5); continue; }
      ctx.fillStyle = ['camp', 'warcamp', 'bones'].includes(d.type) ? '#e83b3b' : ['grove', 'shrine'].includes(d.type) ? '#30e1b9' : '#fbb954';
      ctx.fillRect(toX(d.x) - 1, h - 13, 3, 3);
    }
    if (g.claim) { ctx.fillStyle = '#f9c22b'; ctx.fillRect(toX(g.claim.x) - 1, 2, 3, 8); ctx.fillRect(toX(g.claim.x) - 1, 2, 6, 3); }
    ctx.fillStyle = '#ffffff'; ctx.fillRect(toX(p.x) - 1, h - 15, 2, 12);
  }

  // ------------------------------------------------------------ modals
  // keys: modal actions for the keyboard, e.g. { action: 'ok', menu: 'back' }
  openModal(title, bodyHTML, onClick, keys) {
    this.modal = { onClick, keys };
    const m = this.$('modal');
    m.innerHTML = `<div class="panel"><header><h2>${title}</h2><button class="x" data-act="close">✕</button></header><div class="body">${bodyHTML}</div></div>`;
    m.classList.add('open');
    m.onclick = e => {
      const btn = e.target.closest('[data-act]');
      if (e.target === m) return this.closeModal();
      if (!btn || btn.disabled) return;
      if (btn.dataset.act === 'close') return this.closeModal();
      onClick && onClick(btn.dataset.act, btn.dataset.arg);
    };
  }
  closeModal() { this.modal = null; this.$('modal').classList.remove('open'); this.$('modal').innerHTML = ''; }
  costHTML(cost) {
    return Object.entries(cost).map(([k, v]) => `<span class="cost ${(this.game.inv[k] || 0) >= v ? '' : 'short'}">${TA.iconHTML(k, 14)}${v}</span>`).join('');
  }

  openBuild() {
    const g = this.game;
    const opts = g.buildOptions();
    const rows = opts.map((o, i) => `
      <button class="row" data-act="build" data-arg="${o.type}" ${o.ok ? '' : 'disabled'}>
        <span class="thumb b-${o.type}"></span>
        <span class="info"><b>${o.def.name}</b><small>${o.def.desc}</small>${o.ok ? '' : `<em>${o.why}</em>`}</span>
        <span class="costs">${this.costHTML(o.def.cost)}</span>
      </button>`).join('');
    this.openModal('Build', `<p class="sub">${g.claim ? 'Builds where you stand.' : 'Find open ground you like. Your banner claims the land on both sides.'}</p>${rows}`, (act, arg) => {
      if (act === 'build') { this.closeModal(); g.build(arg); }
    });
    this.paintThumbs();
  }
  paintThumbs() {
    for (const el of document.querySelectorAll('.thumb')) {
      const type = [...el.classList].find(c => c.startsWith('b-')).slice(2);
      const cv = document.createElement('canvas'); cv.width = 64; cv.height = 64;
      const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
      if (type === 'banner') { ctx.fillStyle = '#4d3729'; ctx.fillRect(29, 20, 2, 44); ctx.save(); ctx.scale(2, 2); TA.drawFlag(ctx, 'flagBanner', 0, 16, 20); ctx.restore(); }
      else {
        const sheet = type === 'wall' ? 'wall' : type;
        const [, fw, fh] = TA.BSHEET[sheet];
        const s = Math.min(2, 64 / Math.max(fw, fh));
        ctx.save(); ctx.translate(32, 64); ctx.scale(s, s); TA.drawBuilding(ctx, sheet, 17, 0, 0); ctx.restore();
      }
      el.appendChild(cv);
    }
  }

  openShop(kind) {
    const g = this.game, shop = TA.SHOPS[kind];
    const isMarket = kind === 'market';
    const rate = isMarket ? 1 : 0.8;
    const render = () => {
      let html = '';
      if (!isMarket) {
        html += '<h3>Buy</h3>';
        html += shop.sells.map(it => {
          const price = shop.prices[it] || TA.CROPS[it.replace('seed_', '')].seedCost;
          const ok = (g.inv.coin || 0) >= price;
          return `<button class="row" data-act="buy" data-arg="${it}" ${ok ? '' : 'disabled'}>${TA.iconHTML(it, 24)}<span class="info"><b>${TA.ITEMS[it].name}</b>${it.startsWith('seed_') ? `<small>${TA.CROPS[it.slice(5)].days} days to grow · sells for ${TA.CROPS[it.slice(5)].sell}</small>` : `<small>Restores ${TA.ITEMS[it].heal} hearts</small>`}</span><span class="costs">${this.costHTML({ coin: price })}</span></button>`;
        }).join('');
      }
      const sellable = Object.keys(g.inv).filter(k => g.inv[k] > 0 && TA.ITEMS[k] && TA.ITEMS[k].sell && (isMarket ? TA.ITEMS[k].produce || ['mushroom', 'gem', 'meat'].includes(k) : true));
      html += `<h3>Sell ${isMarket ? '' : '<small>(travellers pay a little less than a market)</small>'}</h3>`;
      if (!sellable.length) html += '<p class="sub">Nothing to sell yet.</p>';
      html += sellable.map(k => {
        let price = Math.max(1, Math.floor(TA.ITEMS[k].sell * rate));
        if (shop && shop.stoneBonus && k === 'stone') price = 2;
        return `<div class="row">${TA.iconHTML(k, 24)}<span class="info"><b>${TA.ITEMS[k].name} ×${g.inv[k]}</b><small>${price} each</small></span>
          <span class="btns"><button data-act="sell" data-arg="${k}:1:${price}">Sell 1</button><button data-act="sell" data-arg="${k}:all:${price}">All</button></span></div>`;
      }).join('');
      if (sellable.length > 1 && isMarket) html = `<button class="wide" data-act="sellall">Sell all produce</button>` + html;
      html += `<p class="purse">You have ${TA.iconHTML('coin', 14)} ${g.inv.coin || 0}</p>`;
      return html;
    };
    const title = isMarket ? 'Market' : shop.name;
    const onClick = (act, arg) => {
      if (act === 'buy') {
        const price = shop.prices[arg] || TA.CROPS[arg.replace('seed_', '')].seedCost;
        if ((g.inv.coin || 0) >= price) { g.inv.coin -= price; g.give(arg, 1); }
      }
      if (act === 'sell') {
        const [k, n, price] = arg.split(':');
        const cnt = n === 'all' ? g.inv[k] : 1;
        g.inv[k] -= cnt; g.inv.coin = (g.inv.coin || 0) + cnt * +price;
      }
      if (act === 'sellall') {
        for (const k of Object.keys(g.inv)) if (TA.ITEMS[k] && (TA.ITEMS[k].produce || k === 'mushroom') && g.inv[k] > 0) { g.inv.coin += g.inv[k] * TA.ITEMS[k].sell; g.inv[k] = 0; }
      }
      this.openModal(title, render(), onClick);
    };
    this.openModal(title, render(), onClick);
  }

  // Your market: sell straight away, or stock the stall for travellers (they pay more)
  openMarket(b) {
    const g = this.game;
    const goods = k => TA.ITEMS[k] && TA.ITEMS[k].sell && (TA.ITEMS[k].produce || ['mushroom', 'gem', 'meat', 'potion'].includes(k));
    const render = () => {
      let html = '';
      if (b.till) html += `<button class="wide" data-act="till">Collect ${TA.iconHTML('coin', 14)} ${b.till} from the till</button>`;
      html += `<h3>Stall <small>(travellers pay ${TA.STALL_PREMIUM * 100 - 100}% more, when they pass by)</small></h3>`;
      const stocked = Object.keys(b.stock).filter(k => b.stock[k] > 0);
      if (!stocked.length) html += '<p class="sub">The stall is empty.</p>';
      html += stocked.map(k => `<div class="row">${TA.iconHTML(k, 24)}<span class="info"><b>${TA.ITEMS[k].name} ×${b.stock[k]}</b><small>${g.stallPrice(k)} each on the stall</small></span>
        <span class="btns"><button data-act="unstock" data-arg="${k}">Take back</button></span></div>`).join('');
      const own = Object.keys(g.inv).filter(k => g.inv[k] > 0 && goods(k));
      html += '<h3>Your goods</h3>';
      if (!own.length) html += '<p class="sub">Nothing to sell yet.</p>';
      html += own.map(k => `<div class="row">${TA.iconHTML(k, 24)}<span class="info"><b>${TA.ITEMS[k].name} ×${g.inv[k]}</b><small>sell now ${TA.ITEMS[k].sell} · stall ${g.stallPrice(k)}</small></span>
        <span class="btns"><button data-act="sell" data-arg="${k}">Sell all</button><button data-act="stock" data-arg="${k}">Stock all</button></span></div>`).join('');
      if (own.length > 1) html += `<button class="wide" data-act="stockall">Stock everything on the stall</button>`;
      html += `<p class="purse">You have ${TA.iconHTML('coin', 14)} ${g.inv.coin || 0}</p>`;
      return html;
    };
    const onClick = (act, arg) => {
      if (act === 'till') { g.inv.coin = (g.inv.coin || 0) + b.till; this.toast(`Collected ${b.till} coins`, 'good'); b.till = 0; }
      if (act === 'sell') { g.inv.coin = (g.inv.coin || 0) + g.inv[arg] * TA.ITEMS[arg].sell; g.inv[arg] = 0; }
      const stock = k => { b.stock[k] = (b.stock[k] || 0) + g.inv[k]; g.inv[k] = 0; g.tutorial.stall = true; };
      if (act === 'stock') stock(arg);
      if (act === 'stockall') for (const k of Object.keys(g.inv)) if (g.inv[k] > 0 && goods(k)) stock(k);
      if (act === 'unstock') { g.give(arg, b.stock[arg]); delete b.stock[arg]; }
      this.openModal('Market', render(), onClick);
    };
    this.openModal('Market', render(), onClick);
  }

  openTower(b) {
    const g = this.game;
    const render = () => {
      const next = TA.TOWER_LEVELS[b.level + 1];
      let html = `<p class="sub">Level ${b.level} · ${TA.TOWER_LEVELS[b.level].archers} archer${b.level > 1 ? 's' : ''} shooting from the windows.</p>`;
      if (next) html += `<button class="row" data-act="up" ${g.canAfford(next.cost) ? '' : 'disabled'}><span class="thumb b-watchtower"></span>
        <span class="info"><b>Upgrade to level ${b.level + 1}</b><small>Station ${next.archers} archers in the tower.</small></span><span class="costs">${this.costHTML(next.cost)}</span></button>`;
      else html += '<p class="sub">Every window is manned.</p>';
      return html;
    };
    const onClick = act => { if (act === 'up') { g.upgradeTower(b); this.closeModal(); } };
    this.openModal('Watchtower', render(), onClick);
    this.paintThumbs();
  }

  // Walking into a border thicket: travel on, or turn back
  openTravel(bd, dir) {
    const g = this.game, from = TA.BIOMES[dir > 0 ? bd.a : bd.b], to = TA.BIOMES[dir > 0 ? bd.b : bd.a];
    const onClick = act => {
      this.closeModal();
      if (act === 'ok') g.crossBorder(bd, dir); else g.turnBack(dir);
    };
    if (bd.blocked) {
      const why = from.hidden ? 'This valley is closed in on every side.' : 'Whatever lies beyond is hidden from the road.';
      this.openModal('The way is shut', `<p class="sub">The thicket here is too dense to push through. ${why} Perhaps there is a way beneath.</p>
        <button class="wide" data-act="back">Go back</button>`, onClick, { action: 'back', menu: 'back' });
      return;
    }
    this.openModal(`Travel to <span style="color:${to.color}">${to.name}</span>?`, `<p class="sub">The trees close in. Beyond them lies ${to.name}.</p>
      <button class="wide" data-act="ok">OK</button><button class="wide" data-act="back">Go back</button>`, onClick, { action: 'ok', menu: 'back' });
  }

  openArmory() {
    const g = this.game;
    const render = () => Object.entries(TA.UPGRADES).map(([k, u]) => {
      const lvl = g.tools[k], max = lvl >= u.levels.length - 1;
      const cost = max ? null : u.levels[lvl + 1];
      return `<button class="row" data-act="up" data-arg="${k}" ${!max && g.inv.coin >= cost ? '' : 'disabled'}>${TA.iconHTML(k, 24)}
        <span class="info"><b>${u.name} ${'★'.repeat(lvl + 1)}</b><small>${u.desc}</small>${max ? '<em>Fully upgraded</em>' : ''}</span>
        <span class="costs">${max ? '' : this.costHTML({ coin: cost })}</span></button>`;
    }).join('') + `<p class="purse">You have ${TA.iconHTML('coin', 14)} ${g.inv.coin || 0}</p>`;
    const onClick = (act, arg) => {
      if (act === 'up') { const u = TA.UPGRADES[arg], c = u.levels[g.tools[arg] + 1]; if (g.inv.coin >= c) { g.inv.coin -= c; g.tools[arg]++; this.toast(`${u.name} upgraded`, 'good'); } }
      this.openModal('Armory', render(), onClick);
    };
    this.openModal('Armory', render(), onClick);
  }

  openPause() {
    const g = this.game;
    this.openModal('Paused', `
      <p class="sub">World seed: <b>${g.seedStr}</b> · Day ${g.day} · ${g.stats.harvested} harvested · ${g.stats.kills} creatures felled</p>
      <div class="help">
        <div><kbd>A</kbd><kbd>D</kbd> / <kbd>←</kbd><kbd>→</kbd> walk &nbsp; <kbd>Shift</kbd> run</div>
        <div><kbd>W</kbd> / <kbd>Space</kbd> jump &nbsp; <kbd>S</kbd> drop through a ledge</div>
        <div><kbd>E</kbd> / <kbd>Enter</kbd> do the thing in front of you</div>
        <div><kbd>B</kbd> build &nbsp; <kbd>Q</kbd> switch seed &nbsp; <kbd>F</kbd> eat</div>
      </div>
      <button class="wide" data-act="resume">Resume</button>
      <button class="wide" data-act="save">Save game</button>
      <button class="wide danger" data-act="new">Start a new world…</button>`, act => {
      if (act === 'resume') this.closeModal();
      if (act === 'save') { g.save(); this.closeModal(); }
      if (act === 'new') {
        const b = document.querySelector('[data-act="new"]');
        if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap again to abandon this world'; return; }
        TA.store.del(TA.SAVE_KEY); location.reload();
      }
    });
  }

  // ------------------------------------------------------------ touch controls
  bindTouch() {
    const hold = (id, key) => {
      const el = this.$(id); if (!el) return;
      const on = e => { e.preventDefault(); TA.input.touch[key] = true; el.classList.add('on'); };
      const off = e => { e.preventDefault(); TA.input.touch[key] = false; el.classList.remove('on'); };
      el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
    };
    const tap = (id, key) => {
      const el = this.$(id); if (!el) return;
      el.addEventListener('pointerdown', e => { e.preventDefault(); TA.input.press(key); });
    };
    hold('t-left', 'left'); hold('t-right', 'right'); hold('t-run', 'run'); hold('t-down', 'down');
    // jump: a tap starts it, holding keeps it high
    const j = this.$('t-jump');
    if (j) {
      j.addEventListener('pointerdown', e => { e.preventDefault(); TA.input.press('jump'); TA.input.touch.jump = true; j.classList.add('on'); });
      const off = e => { e.preventDefault(); TA.input.touch.jump = false; j.classList.remove('on'); };
      j.addEventListener('pointerup', off); j.addEventListener('pointercancel', off); j.addEventListener('pointerleave', off);
    }
    // the down button also drops through ledges on a tap
    const dn = this.$('t-down'); if (dn) dn.addEventListener('pointerdown', () => TA.input.press('down'));
    tap('t-action', 'action'); tap('t-build', 'build'); tap('t-eat', 'eat'); tap('t-menu', 'menu');
    tap('seed', 'seed');
  }
};
