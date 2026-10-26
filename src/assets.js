// ============================================================================
// Image loading and sprite drawing helpers. All positions are bottom-center
// anchored world/screen pixels.
// ============================================================================
window.TA = window.TA || {};
TA.img = {};

TA.loadImages = function (onProgress) {
  const entries = Object.entries(TA.IMAGES);
  let done = 0;
  return Promise.all(entries.map(([key, src]) => new Promise(res => {
    const im = new Image();
    im.onload = () => { TA.img[key] = im; onProgress && onProgress(++done / entries.length); res(); };
    im.onerror = () => { console.warn('missing image', src); onProgress && onProgress(++done / entries.length); res(); };
    im.src = src;
  })));
};

// Static sprite from TA.SPR, bottom-center at (x, y)
TA.drawSpr = function (ctx, key, x, y, flip = false, alpha = 1) {
  const s = TA.SPR[key]; if (!s) return;
  const im = TA.img[s[0]]; if (!im) return;
  const [, sx, sy, w, h] = s;
  const dx = Math.round(x - w / 2), dy = Math.round(y - h);
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
  const dx = Math.round(x - sh.fw / 2), dy = Math.round(y - sh.fh);
  if (alpha !== 1) ctx.globalAlpha = alpha;
  if (flip) {
    ctx.save(); ctx.translate(dx + sh.fw, dy); ctx.scale(-1, 1);
    ctx.drawImage(im, sx, sy, sh.fw, sh.fh, 0, 0, sh.fw, sh.fh); ctx.restore();
  } else ctx.drawImage(im, sx, sy, sh.fw, sh.fh, dx, dy, sh.fw, sh.fh);
  if (alpha !== 1) ctx.globalAlpha = 1;
};

// Building sheet frame. frame 17 = finished, 1..17 = construction animation
TA.drawBuilding = function (ctx, type, frame, x, y, alpha = 1, flip = false) {
  const b = TA.BSHEET[type]; if (!b) return;
  const im = TA.img[b[0]]; if (!im) return;
  const [, fw, fh] = b;
  const dx = Math.round(x - fw / 2), dy = Math.round(y - fh);
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
  ctx.drawImage(im, f * 18, 0, 18, 16, Math.round(x - 2), Math.round(y - 16), 18, 16);
};

TA.drawCrop = function (ctx, crop, stage, x, y) {
  const im = TA.img.crops; if (!im) return;
  ctx.drawImage(im, stage * 16, TA.CROPS[crop].row * 16, 16, 16, Math.round(x - 8), Math.round(y - 16), 16, 16);
};

TA.drawIcon = function (ctx, name, x, y) {
  const i = TA.ICON_NAMES.indexOf(name);
  if (i >= 0 && TA.img.icons) { ctx.drawImage(TA.img.icons, i * 8, 0, 8, 8, Math.round(x - 4), Math.round(y - 8), 8, 8); return; }
  const it = TA.ITEMS[name];
  if (it && it.img && TA.img[it.img]) ctx.drawImage(TA.img[it.img], Math.round(x - 4), Math.round(y - 8), 8, 8);
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
