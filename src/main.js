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
      player: { x: titleT * 18, dir: 1, draw() { } }, time: 9 + titleT * 0.05 % 15, seed: 7,
      world: TA.titleWorld, buildings: [], plots: [], npcs: [], strays: [], guards: [], mobs: [], drops: [], arrows: [],
      fx: { draw() { }, texts: [] }, claim: null, ui: { target: null }, shake: 0, fade: 0, camX: titleT * 18,
      darkness() { return 0; }, isRaining() { return false; }, cropStage() { return -1; },
    };
    fake.time = 8;
    renderer.draw(fake);
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
          <label>World seed <input id="seed" value="${seed}" maxlength="24" spellcheck="false"></label>
          <button class="big ${save ? 'alt' : ''}" id="b-new">${save ? 'New world' : 'Begin'}</button>
        </div>
        <div class="help">
          <div><kbd>A</kbd><kbd>D</kbd> walk · <kbd>Shift</kbd> run · <kbd>E</kbd> act · <kbd>B</kbd> build · <kbd>Q</kbd> seed · <kbd>F</kbd> eat · <kbd>Esc</kbd> menu</div>
          <div class="touchonly">On a phone, turn sideways. The buttons appear on screen.</div>
        </div>
      </div>`;
    if (save) document.getElementById('b-continue').onclick = () => start(save);
    const bn = document.getElementById('b-new');
    bn.onclick = () => {
      if (save && !bn.dataset.armed) { bn.dataset.armed = '1'; bn.innerHTML = 'Replace my save? <small>Tap again to start a new world</small>'; return; }
      const s = (document.getElementById('seed').value || seed).trim().toLowerCase();
      start(null, s);
    };
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (game) {
      game.update(dt);
      renderer.draw(game);
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
    tp(x) { game.player.x = x; game.camX = x; },
    get game() { return game; },
  };
})();
