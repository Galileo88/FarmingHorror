// ============================================================================
// Utilities: seeded randomness, noise, math, input, storage.
// ============================================================================
window.TA = window.TA || {};

TA.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
TA.lerp = (a, b, t) => a + (b - a) * t;
TA.smooth = t => t * t * (3 - 2 * t);

// Integer hash of any number of ints -> [0, 2^32)
TA.hash = function (...nums) {
  let h = 2166136261 >>> 0;
  for (const n of nums) {
    let k = (n | 0) >>> 0;
    k = Math.imul(k ^ (k >>> 16), 2246822507) >>> 0;
    k = Math.imul(k ^ (k >>> 13), 3266489909) >>> 0;
    k ^= k >>> 16;
    h = Math.imul(h ^ k, 16777619) >>> 0;
  }
  h ^= h >>> 15; h = Math.imul(h, 2246822507) >>> 0; h ^= h >>> 13;
  return h >>> 0;
};
TA.hash01 = (...n) => TA.hash(...n) / 4294967296;

// Small deterministic PRNG
TA.rng = function (seed) {
  let a = seed >>> 0;
  const r = function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  r.int = (lo, hi) => lo + Math.floor(r() * (hi - lo + 1));
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  r.chance = p => r() < p;
  r.weighted = obj => { // {key: weight}
    let tot = 0; for (const k in obj) tot += obj[k];
    let x = r() * tot;
    for (const k in obj) { x -= obj[k]; if (x <= 0) return k; }
    return Object.keys(obj)[0];
  };
  return r;
};

TA.strSeed = function (s) {
  s = String(s); let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = h << 13 | h >>> 19; }
  return TA.hash(h);
};

// 1D value noise in [0,1]
TA.noise1 = function (seed, x) {
  const i = Math.floor(x), f = x - i;
  const a = TA.hash01(seed, i), b = TA.hash01(seed, i + 1);
  return TA.lerp(a, b, TA.smooth(f));
};

// Hash of three ints -> [0,1), without hash()'s argument array (noise2 calls it a lot)
TA.hash3 = function (a, b, c) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b ^ 0x7f4a7c15, 0xc2b2ae35) ^ Math.imul(c ^ 0x165667b1, 0x27d4eb2f);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12; h = Math.imul(h, 0x297a2d39); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
};
// 2D value noise in [0,1]
TA.noise2 = function (seed, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), fx = TA.smooth(x - xi), fy = TA.smooth(y - yi);
  const a = TA.hash3(seed, xi, yi), b = TA.hash3(seed, xi + 1, yi);
  const c = TA.hash3(seed, xi, yi + 1), d = TA.hash3(seed, xi + 1, yi + 1);
  return TA.lerp(TA.lerp(a, b, fx), TA.lerp(c, d, fx), fy);
};

TA.fmtTime = function (hours) {
  const h = Math.floor(hours) % 24, m = Math.floor((hours % 1) * 60 / 10) * 10;
  const ap = h < 12 ? 'am' : 'pm'; const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, '0')}${ap}`;
};

// ---------------------------------------------------------------- storage (never throws)
TA.store = {
  get(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } },
  del(key) { try { localStorage.removeItem(key); } catch (e) { } },
};

// ---------------------------------------------------------------- input
TA.Input = class {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();   // edge-triggered this frame
    this.touch = { left: false, right: false, run: false, jump: false, down: false, action: false };
    // mouse / touch on the canvas, in CSS pixels: aims digging and building
    this.pointer = { x: 0, y: 0, down: false, button: 0, seen: -1e9, touch: false, hit: false };
    const cv = document.getElementById('game');
    if (cv) {
      const at = e => { const p = this.pointer; p.x = e.clientX; p.y = e.clientY; p.seen = performance.now(); p.touch = e.pointerType === 'touch'; };
      cv.addEventListener('pointermove', at);
      cv.addEventListener('pointerdown', e => { e.preventDefault(); at(e); this.pointer.down = true; this.pointer.button = e.button; this.pointer.hit = true; });
      const up = e => { at(e); this.pointer.down = false; if (this.pointer.touch) this.pointer.seen = -1e9; };
      cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
      cv.addEventListener('pointerleave', () => { this.pointer.down = false; this.pointer.seen = -1e9; });
      cv.addEventListener('contextmenu', e => e.preventDefault());
    }
    addEventListener('keydown', e => {
      const k = this.norm(e);
      if (!k) return;
      if (['left', 'right', 'action', 'build', 'seed', 'menu', 'eat', 'jump', 'down', 'up', 'place'].includes(k)) e.preventDefault();
      if (!this.down.has(k)) this.pressed.add(k);
      this.down.add(k);
    });
    addEventListener('keyup', e => { const k = this.norm(e); if (k) this.down.delete(k); });
    addEventListener('blur', () => { this.down.clear(); for (const k in this.touch) this.touch[k] = false; });
  }
  norm(e) {
    switch (e.code) {
      case 'ArrowLeft': case 'KeyA': return 'left';
      case 'ArrowRight': case 'KeyD': return 'right';
      case 'ShiftLeft': case 'ShiftRight': return 'run';
      case 'Space': case 'KeyW': return 'jump';
      case 'ArrowUp': return 'up';
      case 'KeyR': return 'place';
      case 'KeyS': case 'ArrowDown': return 'down';
      case 'KeyE': case 'Enter': return 'action';
      case 'KeyB': return 'build';
      case 'KeyQ': case 'Tab': return 'seed';
      case 'KeyF': return 'eat';
      case 'Escape': return 'menu';
      case 'KeyM': return 'map';
      case 'Digit1': return 'n1'; case 'Digit2': return 'n2'; case 'Digit3': return 'n3';
      case 'Digit4': return 'n4'; case 'Digit5': return 'n5'; case 'Digit6': return 'n6';
      case 'Digit7': return 'n7'; case 'Digit8': return 'n8'; case 'Digit9': return 'n9';
    }
    return null;
  }
  isDown(k) { return this.down.has(k) || !!this.touch[k]; }
  hit(k) { return this.pressed.has(k); }
  press(k) { this.pressed.add(k); }
  endFrame() { this.pressed.clear(); this.pointer.hit = false; }
  // Is the pointer in use (a mouse moved over the canvas lately, or a finger down)?
  get aiming() { const p = this.pointer; return p.touch ? p.down : performance.now() - p.seen < 4000; }
};
