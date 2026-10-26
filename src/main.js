// ============================================================================
// Boot: load art, show title screen, run the loop.
// ============================================================================
window.TA = window.TA || {};

(function () {
  const WORDS1 = ['amber', 'bramble', 'willow', 'thistle', 'hollow', 'barley', 'mossy', 'copper', 'raven', 'clover', 'misty', 'oaken'];
  const WORDS2 = ['ford', 'vale', 'reach', 'brook', 'field', 'march', 'stead', 'moor', 'glen', 'hearth'];
  const randomSeed = () => WORDS1[Math.floor(Math.random() * WORDS1.length)] + WORDS2[Math.floor(Math.random() * WORDS2.length)];

  TA.input = new TA.Input();
  const canvas = document.getElementById('game');
  const renderer = new TA.Renderer(canvas);
  const ui = new TA.UI(document.getElementById('ui'));
  let game = null;

  // title screen backdrop: a slowly scrolling world
  let titleT = 0;
  function drawTitle(dt) {
    titleT += dt;
    const fake = {
      player: { x: titleT * 18, y: 0, layer: 's', dir: 1, draw() { } }, time: 8, seed: 7,
      world: TA.titleWorld, buildings: [], plots: [], npcs: [], folk: [], travellers: [], strays: [], guards: [], mobs: [], drops: [], arrows: [],
      fx: { draw() { }, texts: [] }, claim: null, ui: { target: null }, shake: 0, fade: 0, flash: 0, camX: titleT * 18, camY: 0,
      darkness() { return 0; }, weatherNow() { return { type: 'clear', k: 0, def: TA.WEATHER.clear }; }, cropStage() { return -1; },
    };
    renderer.draw(fake, dt);
  }

  function start(save, seedStr) {
    document.getElementById('title').classList.add('gone');
    document.getElementById('ui').classList.remove('hidden');
    game = new TA.Game({ save, seedStr });
    game.input = TA.input;
    ui.attach(game);
    if (!save) {
      setTimeout(() => ui.toast('You wander into Greenmeadow with a few seeds and big plans.'), 400);
      game.save(true);
    } else ui.toast(`Welcome back. Day ${game.day}.`);
    game.lastRegion = game.world.regionOf(game.player.x);
  }

  function showTitle() {
    const save = TA.store.get(TA.SAVE_KEY);
    const t = document.getElementById('title');
    const seed = randomSeed();
    t.innerHTML = `
      <div class="card">
        <h1>Tiny Acres</h1>
        <p class="tag">Wander an endless land. Claim a patch of it. Grow something.</p>
        ${save ? `<button class="big" id="b-continue">Continue <small>${save.seedStr} · day ${save.day}</small></button>` : ''}
        <div class="newgame">
          <label>World seed <input id="seedin" value="${seed}" maxlength="24" spellcheck="false"></label>
          <button class="big ${save ? 'alt' : ''}" id="b-new">${save ? 'New world' : 'Begin'}</button>
        </div>
        <div class="help">
          <div><kbd>A</kbd><kbd>D</kbd> walk · <kbd>Shift</kbd> run · <kbd>W</kbd> jump · <kbd>E</kbd> act · <kbd>B</kbd> build · <kbd>Q</kbd> seed · <kbd>F</kbd> eat · <kbd>Esc</kbd> menu</div>
          <div class="touchonly">On a phone, turn sideways. The buttons appear on screen.</div>
        </div>
      </div>`;
    if (save) document.getElementById('b-continue').onclick = () => start(save);
    const bn = document.getElementById('b-new');
    bn.onclick = () => {
      if (save && !bn.dataset.armed) { bn.dataset.armed = '1'; bn.innerHTML = 'Replace my save? <small>Tap again to start a new world</small>'; return; }
      const s = (document.getElementById('seedin').value || seed).trim().toLowerCase();
      start(null, s);
    };
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (game) {
      game.update(dt);
      renderer.draw(game, dt);
      ui.update(dt);
    } else if (TA.titleWorld) drawTitle(dt);
    TA.input.endFrame();
    requestAnimationFrame(frame);
  }

  const bar = document.getElementById('loadbar');
  TA.loadImages(p => { bar.style.width = Math.round(p * 100) + '%'; }).then(() => {
    document.getElementById('loading').classList.add('gone');
    TA.titleWorld = new TA.World(TA.strSeed('title'), null);
    showTitle();
  });
  requestAnimationFrame(frame);

  // debug helpers in the console: TA.dbg.give('wood', 50), TA.dbg.time(21)
  TA.dbg = {
    give(item, n = 10) { game.give(item, n); },
    time(h) { game.time = h; },
    tp(x, layer) { const p = game.player; if (layer && layer !== p.layer) { p.layer = layer; game.clearLayer(); } p.x = p.layer === 'c' ? Math.floor(x / 8) * 8 + 4 : x; p.y = p.layer === 'c' ? (game.world.caveFloorNear(p.x, -120) ?? -120) : game.world.floorBelow(x, 1); game.camX = x; game.camY = Math.min(0, p.y - 12); },
    weather(type, from = game.time - 1, to = game.time + 3) { game.weather = { type, from, to }; },
    get game() { return game; },
  };
})();
