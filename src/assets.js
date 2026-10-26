// ============================================================================
// Image loading and sprite drawing helpers. All positions are bottom-center
// anchored world/screen pixels.
// ============================================================================
window.TA = window.TA || {};
TA.img = {};
// The world draws in world pixels on a canvas scaled up by TA.PX. Positions snap
// to screen pixels (1/TA.PX of a world pixel) rather than whole world pixels, so
// moving sprites glide instead of stepping a whole fat pixel at a time.
TA.PX = 1;
TA.px = v => Math.round(v * TA.PX) / TA.PX;

TA.loadImages = function (onProgress) {
  const entries = Object.entries(TA.IMAGES);
  let done = 0;
  const load = () => Promise.all(entries.map(([key, src]) => new Promise(res => {
    const im = new Image();
    im.onload = () => { TA.img[key] = im; onProgress && onProgress(++done / entries.length); res(); };
    im.onerror = () => { console.warn('missing image', src); onProgress && onProgress(++done / entries.length); res(); };
    im.src = (TA.IMAGE_DATA && TA.IMAGE_DATA[src]) || src;
  }))).then(TA.prepareImages);
  if (location.protocol !== 'file:') return load();
  // Opened from disk: every file:// image counts as cross-origin and would taint the
  // canvas, so take the images from assets/images.js as data URLs instead.
  return new Promise(res => {
    const s = document.createElement('script');
    s.src = 'assets/images.js';
    s.onload = s.onerror = res;
    document.head.appendChild(s);
  }).then(load);
};

// After loading: measure sprites and make darkened copies.
//  TA.FEET[sheet][row]  empty pixel rows under the feet, so units stand on the ground
//  TA.BTRIM[bld]        opaque size of a finished building frame (for street layout)
//  TA.imgDark[key]      hazed copy of a sheet, for buildings standing further back
TA.FEET = {}; TA.BTRIM = {}; TA.imgDark = {};
TA.prepareImages = function () {
  const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true });
  // Reading pixels fails on a tainted canvas: then everything counts as opaque (no trimming)
  const pixels = im => {
    cv.width = im.width; cv.height = im.height; cx.clearRect(0, 0, im.width, im.height); cx.drawImage(im, 0, 0);
    try { return cx.getImageData(0, 0, im.width, im.height).data; }
    catch (e) { console.warn('cannot read image pixels; serve the folder over http'); return new Uint8ClampedArray(im.width * im.height * 4).fill(255); }
  };
  for (const [key, sh] of Object.entries(TA.SHEETS)) {
    const im = TA.img[sh.img]; if (!im) continue;
    const d = pixels(im), feet = {};
    for (const [row, frames] of Object.values(sh.anims)) {
      if (feet[row] !== undefined) continue;
      let low = -1;
      for (let f = 0; f < frames; f++) for (let y = sh.fh - 1; y > low; y--) {
        let hit = false;
        for (let x = 0; x < sh.fw && !hit; x++) if (d[((row * sh.fh + y) * im.width + f * sh.fw + x) * 4 + 3] > 0) hit = true;
        if (hit) { low = y; break; }
      }
      feet[row] = low < 0 ? 0 : sh.fh - 1 - low;
    }
    TA.FEET[key] = feet;
  }
  for (const [key, [img, fw, fh]] of Object.entries(TA.BSHEET)) {
    const im = TA.img[img]; if (!im) continue;
    const d = pixels(im);
    let x0 = fw, x1 = -1, y0 = fh;
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) if (d[(y * im.width + 17 * fw + x) * 4 + 3] > 0) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); }
    TA.BTRIM[key] = x1 < 0 ? { w: fw, h: fh } : { w: x1 - x0 + 1, h: fh - y0 };
  }
  const darkKeys = new Set(['starter', 'goblinTiles', 'elvishTiles', ...Object.values(TA.BSHEET).map(b => b[0])]);
  for (const key of darkKeys) {
    const im = TA.img[key]; if (!im) continue;
    const c = document.createElement('canvas'); c.width = im.width; c.height = im.height;
    const g = c.getContext('2d');
    g.drawImage(im, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    // haze: further things take on the colour of the air (and night darkens them anyway)
    g.fillStyle = 'rgba(66,86,112,0.5)'; g.fillRect(0, 0, c.width, c.height);
    TA.imgDark[key] = c;
  }
};

// Clip drawing to the left or right of screen x (half = -1 left, 1 right) — used for archways
TA.clipHalf = function (ctx, half, sx, fn) {
  if (!half) return fn();
  ctx.save(); ctx.beginPath();
  if (half < 0) ctx.rect(-1e4, -1e4, 1e4 + TA.px(sx), 2e4); else ctx.rect(TA.px(sx), -1e4, 2e4, 2e4);
  ctx.clip(); fn(); ctx.restore();
};

// Static sprite from TA.SPR, bottom-center at (x, y)
TA.drawSpr = function (ctx, key, x, y, flip = false, alpha = 1, dark = false) {
  const s = TA.SPR[key]; if (!s) return;
  const im = (dark && TA.imgDark[s[0]]) || TA.img[s[0]]; if (!im) return;
  const [, sx, sy, w, h] = s;
  const dx = TA.px(x - w / 2), dy = TA.px(y - h);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (flip) {
    ctx.save(); ctx.translate(dx + w, dy); ctx.scale(-1, 1);
    ctx.drawImage(im, sx, sy, w, h, 0, 0, w, h); ctx.restore();
  } else ctx.drawImage(im, sx, sy, w, h, dx, dy, w, h);
  if (alpha !== 1) ctx.globalAlpha = 1;
};

// Frame of an animated unit sheet, bottom-center at (x, y)
TA.drawUnit = function (ctx, sheetKey, anim, frame, x, y, flip = false, alpha = 1) {
  const sh = TA.SHEETS[sheetKey]; if (!sh) return;
  const im = TA.img[sh.img]; if (!im) return;
  const a = sh.anims[anim] || sh.anims.idle || Object.values(sh.anims)[0];
  const f = Math.min(frame, a[1] - 1);
  const sx = f * sh.fw, sy = a[0] * sh.fh;
  const feet = (TA.FEET[sheetKey] && TA.FEET[sheetKey][a[0]]) || 0;
  const dx = TA.px(x - sh.fw / 2), dy = TA.px(y - sh.fh + feet);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (flip) {
    ctx.save(); ctx.translate(dx + sh.fw, dy); ctx.scale(-1, 1);
    ctx.drawImage(im, sx, sy, sh.fw, sh.fh, 0, 0, sh.fw, sh.fh); ctx.restore();
  } else ctx.drawImage(im, sx, sy, sh.fw, sh.fh, dx, dy, sh.fw, sh.fh);
  if (alpha !== 1) ctx.globalAlpha = 1;
};

// Building sheet frame. frame 17 = finished, 1..17 = construction animation
TA.drawBuilding = function (ctx, type, frame, x, y, alpha = 1, flip = false, dark = false) {
  const b = TA.BSHEET[type]; if (!b) return;
  const im = (dark && TA.imgDark[b[0]]) || TA.img[b[0]]; if (!im) return;
  const [, fw, fh] = b;
  const dx = TA.px(x - fw / 2), dy = TA.px(y - fh);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (flip) {
    ctx.save(); ctx.translate(dx + fw, dy); ctx.scale(-1, 1);
    ctx.drawImage(im, frame * fw, 0, fw, fh, 0, 0, fw, fh); ctx.restore();
  } else ctx.drawImage(im, frame * fw, 0, fw, fh, dx, dy, fw, fh);
  if (alpha !== 1) ctx.globalAlpha = 1;
};

TA.drawFlag = function (ctx, imgKey, t, x, y) {
  const im = TA.img[imgKey]; if (!im) return;
  const frames = Math.floor(im.width / 18), f = Math.floor(t * 10) % frames;
  ctx.drawImage(im, f * 18, 0, 18, 16, TA.px(x - 2), TA.px(y - 16), 18, 16);
};

TA.drawCrop = function (ctx, crop, stage, x, y) {
  const im = TA.img.crops; if (!im) return;
  ctx.drawImage(im, stage * 16, TA.CROPS[crop].row * 16, 16, 16, TA.px(x - 8), TA.px(y - 16), 16, 16);
};

TA.drawIcon = function (ctx, name, x, y) {
  const i = TA.ICON_NAMES.indexOf(name);
  if (i >= 0 && TA.img.icons) { ctx.drawImage(TA.img.icons, i * 8, 0, 8, 8, TA.px(x - 4), TA.px(y - 8), 8, 8); return; }
  const it = TA.ITEMS[name];
  if (it && it.img && TA.img[it.img]) ctx.drawImage(TA.img[it.img], TA.px(x - 4), TA.px(y - 8), 8, 8);
};

// Animation player
TA.Anim = class {
  constructor(sheet, name) { this.set(sheet, name); }
  set(sheet, name, force = false) {
    if (!force && this.sheet === sheet && this.name === name && !this.done) return;
    this.sheet = sheet; this.name = name; this.t = 0; this.done = false;
    const a = TA.SHEETS[sheet].anims[name] || TA.SHEETS[sheet].anims.idle;
    this.def = a;
  }
  update(dt) {
    this.t += dt;
    const [, n, fps, loop] = this.def;
    if (!loop && this.t * fps >= n) this.done = true;
  }
  get frame() {
    const [, n, fps, loop] = this.def;
    const f = Math.floor(this.t * fps);
    return loop ? f % n : Math.min(f, n - 1);
  }
};

// HTML for an icon in the DOM UI (background-position into the sheet, pixelated)
TA.iconHTML = function (name, px = 24) {
  const i = TA.ICON_NAMES.indexOf(name);
  const s = px / 8;
  if (i >= 0) {
    return `<span class="ico" style="width:${px}px;height:${px}px;background-image:url(${TA.IMAGES.icons});` +
      `background-size:${TA.ICON_NAMES.length * px}px ${px}px;background-position:-${i * px}px 0"></span>`;
  }
  const it = TA.ITEMS[name];
  if (it && it.img) return `<span class="ico" style="width:${px}px;height:${px}px;background-image:url(${TA.IMAGES[it.img]});background-size:${px}px ${px}px"></span>`;
  return '';
};
