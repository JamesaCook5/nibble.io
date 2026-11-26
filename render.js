// Pixel-art renderer for the cozy desk scene.
// The layout is planned on a 480x270 grid of "units". Each unit is Q canvas pixels (usually 2),
// so outlines, highlights, leaves and text get a finer pixel than the big shapes. The canvas is
// then scaled up with image-rendering: pixelated, giving a soft pixel look that stays readable.
(() => {
'use strict';
const RW = 480, RH = 270;
const cvs = document.getElementById('rig');
const ctx = cvs.getContext('2d', { alpha: false });
ctx.imageSmoothingEnabled = false;
const smallQ = matchMedia('(max-width: 760px), (max-height: 520px)');
const portraitQ = matchMedia('(max-width: 760px) and (orientation: portrait)');
const UI_FONT = "'VT323', monospace";
const SHADOW = 'rgba(48,26,12,.30)';

let STAGES = [], ROWS = [];
let P = 1, Q = 2, CW = 0, CH = 0, OX = 0, OY = 0, vignette = null;

const S = {
  stage: 0, prev: 0, t0: -1e9, dur: 900, zapT: -1e9, enterT: -1e9,
  keys: new Map(), particles: [], keyRects: [], shift: false,
  mouse: { tx: 0, ty: 0, x: 0, y: 0, l: false, r: false },
  layoutCb: null, born: []
};

/* ---------- small helpers ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const gx = v => v * RW / 100, gy = v => v * RH / 100;
const rp = (g, extra = {}) => ({ x: gx(g.x), y: gy(g.y), w: gx(g.w), h: gy(g.h), stand: g.stand || 0, ...extra });
const lerp = (a, b, t) => a + (b - a) * t;
const lerpR = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t), stand: lerp(a.stand || 0, b.stand || 0, t) });
const snap = v => Math.round(v * Q) / Q;                  // to the canvas pixel grid, in units
function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }

const X = x => OX + Math.round(x * Q), Y = y => OY + Math.round(y * Q);
// Rect in units (relative to the rig origin). Always at least one canvas pixel.
function R(x, y, w, h, c) {
  if (w <= 0 || h <= 0) return;
  const x0 = X(x), y0 = Y(y); let x1 = X(x + w), y1 = Y(y + h);
  if (x1 <= x0) x1 = x0 + 1; if (y1 <= y0) y1 = y0 + 1;
  ctx.fillStyle = c; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
}
// Rect in absolute canvas pixels.
function A(x, y, w, h, c) { if (w <= 0 || h <= 0) return; ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
const patCache = new Map();
function dither(c1, c2) {
  const k = c1 + c2; if (patCache.has(k)) return patCache.get(k);
  const c = document.createElement('canvas'); c.width = c.height = 2; const g = c.getContext('2d');
  g.fillStyle = c2; g.fillRect(0, 0, 2, 2); g.fillStyle = c1; g.fillRect(0, 0, 1, 1); g.fillRect(1, 1, 1, 1);
  const p = ctx.createPattern(c, 'repeat'); patCache.set(k, p); return p;
}
function line(x0, y0, x1, y1, c, t = .5) {
  const T = Math.max(1, Math.round(t * Q)), o = T >> 1;
  let a = Math.round(OX + x0 * Q), b = Math.round(OY + y0 * Q);
  const e1 = Math.round(OX + x1 * Q), f1 = Math.round(OY + y1 * Q);
  const dx = Math.abs(e1 - a), dy = -Math.abs(f1 - b), sx = a < e1 ? 1 : -1, sy = b < f1 ? 1 : -1; let e = dx + dy;
  ctx.fillStyle = c;
  for (;;) { ctx.fillRect(a - o, b - o, T, T); if (a === e1 && b === f1) break; const e2 = 2 * e; if (e2 >= dy) { e += dy; a += sx; } if (e2 <= dx) { e += dx; b += sy; } }
}
function ellipse(cx, cy, rx, ry, c) {
  const CX = OX + cx * Q, CY = OY + cy * Q, RX = rx * Q, RY = ry * Q; if (RY < .5) return;
  ctx.fillStyle = c;
  for (let y = Math.ceil(-RY + .5); y <= Math.floor(RY - .5); y++) {
    const w = RX * Math.sqrt(Math.max(0, 1 - (y * y) / (RY * RY)));
    const a = Math.round(CX - w), b = Math.round(CX + w); if (b > a) ctx.fillRect(a, Math.round(CY + y), b - a, 1);
  }
}
// Rotated ellipse, filled pixel by pixel (used for leaves and controller grips).
function blob(cx, cy, rx, ry, ang, c) {
  const CX = OX + cx * Q, CY = OY + cy * Q, RX = rx * Q, RY = ry * Q, co = Math.cos(ang), si = Math.sin(ang);
  const B = Math.ceil(Math.max(RX, RY)); ctx.fillStyle = c;
  for (let y = -B; y <= B; y++) {
    let s = null;
    for (let x = -B; x <= B + 1; x++) {
      const u = (x * co + y * si) / RX, v = (-x * si + y * co) / RY, inside = x <= B && u * u + v * v <= 1;
      if (inside && s === null) s = x; else if (!inside && s !== null) { ctx.fillRect(Math.round(CX + s), Math.round(CY + y), x - s, 1); s = null; }
    }
  }
}
function arc(cx, cy, rx, ry, a0, a1, c, t = 1) {
  const n = Math.max(8, Math.round((a1 - a0) * Math.max(rx, ry) * Q / 2));
  let px = cx + Math.cos(a0) * rx, py = cy + Math.sin(a0) * ry;
  for (let i = 1; i <= n; i++) { const a = a0 + (a1 - a0) * i / n, nx = cx + Math.cos(a) * rx, ny = cy + Math.sin(a) * ry; line(px, py, nx, ny, c, t); px = nx; py = ny; }
}
// Keycaps use the 8-bit VT323 font on every rig.
const eraFont = () => ["'VT323', monospace", 1.4, 400];
function txt(s, x, y, size, c, align = 'center', weight = 800, family = UI_FONT) {
  ctx.font = `${weight} ${Math.max(5, Math.round(size * Q))}px ${family}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = c;
  ctx.fillText(s, OX + x * Q, OY + y * Q + size * Q * .06);
}
function diamond(cx, cy, r, c) {
  const d = Math.max(1, Math.round(r * Q)), X0 = Math.round(OX + cx * Q), Y0 = Math.round(OY + cy * Q);
  ctx.fillStyle = c; for (let i = -d; i <= d; i++) { const w = d - Math.abs(i); ctx.fillRect(X0 - w, Y0 + i, w * 2 + 1, 1); }
}

/* ---------- palettes ---------- */
const ROOM = {
  wallTop: '#5c7263', wall: '#687f6f', stripe: '#6f8676', dot: '#7c927f', wain: '#5a6e5f', wainHi: '#93a892', wainSh: '#4a5b4e', panel: '#526558',
  top: '#a87650', top2: '#9c6b47', plank: '#87583a', grain: '#94633f', hi: '#c69670', edge: '#7a4c2e', edge2: '#653d24'
};
const KBS = {
  beige:   { body: '#cfc2a0', bodyHi: '#e6dcc0', bodySh: '#ab9e7b', front: '#a29572', frontSh: '#7f7254', well: '#6c6250', cap: '#f2ebd7', capHi: '#fffaee', capSh: '#ddd3b8', capF: '#bcb092', capF2: '#a69a7c',
             mod: '#d3c7a6', modHi: '#e6dcc2', modF: '#a99c7b', acc: '#c98a5a', accHi: '#e0a77a', accF: '#9b6540', leg: '#5b5243', legMod: '#5b5243', legAcc: '#fff6e6', F: 4, spark: '#fff4cf' },
  black:   { body: '#2b2c31', bodyHi: '#42444c', bodySh: '#1b1c20', front: '#1b1c20', frontSh: '#101013', well: '#0c0c0e', cap: '#363840', capHi: '#4e515b', capSh: '#2d2f35', capF: '#22232a', capF2: '#18191d',
             leg: '#e4e7ec', F: 3, spark: '#9fd8ff' },
  mech:    { body: '#4c5059', bodyHi: '#666a74', bodySh: '#35383f', front: '#2f3238', frontSh: '#1f2125', well: '#111214', cap: '#3a3d45', capHi: '#50545e', capSh: '#2e3036', capF: '#25272c', capF2: '#1a1b1f',
             mod: '#5c606a', modHi: '#727681', modF: '#40434b', acc: '#ef8a4c', accHi: '#ffab78', accF: '#b4572d', leg: '#f1ebde', legAcc: '#2a170c', F: 4, spark: '#ffb27a' },
  rgb:     { body: '#1d1e23', bodyHi: '#30323a', bodySh: '#121316', front: '#121316', frontSh: '#08080a', well: '#000000', cap: '#26272e', capHi: '#383a45', capSh: '#202127', capF: '#17181c', capF2: '#101114',
             leg: null, F: 4, spark: null, rgb: true },
  premium: { body: '#d9dce1', bodyHi: '#f3f4f6', bodySh: '#aeb3bb', front: '#9ca1aa', frontSh: '#7b8088', well: '#4a4f58', cap: '#f6f1e6', capHi: '#fffdf8', capSh: '#e6dfcf', capF: '#d1c8b4', capF2: '#bbb29d',
             mod: '#3a4866', modHi: '#52638c', modF: '#222b42', acc: '#e7b858', accHi: '#f8d488', accF: '#a8802e', leg: '#2e3654', legMod: '#f2e9d5', legAcc: '#2c2312', F: 4, spark: '#ffe2a8', glow: '#ffd08a' }
};
const MICE = {
  ball:    { c: '#e2d9c1', hi: '#f6efdd', sh: '#bcb194', ln: '#958b70', cable: '#3a3430', box: true },
  optical: { c: '#c8ccd2', hi: '#e6e8ec', sh: '#9ea3ab', ln: '#7b8089', cable: '#2a2c30', glow: '#ff6a50' },
  gaming:  { c: '#2b2d33', hi: '#474a53', sh: '#17181c', ln: '#0d0e10', cable: '#111214', glow: 'hue', stripe: true },
  premium: { c: '#3e4350', hi: '#5f6576', sh: '#23262e', ln: '#191b20', glow: '#ffd08a', side: true }
};
const BEZ = {
  crt:   { c: '#dfd6bc', hi: '#f2ebd8', sh: '#c0b698', rim: '#9a9076', badge: '#a89e81' },
  s3:    { c: '#b4b9c0', hi: '#d4d7dc', sh: '#959aa2', rim: '#6c7179', badge: '#8f949c' },
  s4:    { c: '#26272c', hi: '#43454d', sh: '#18191c', rim: '#0d0d0f', badge: '#43454d' },
  thin:  { c: '#18191d', hi: '#33353d', sh: '#0e0e11', rim: '#070708', badge: '#33353d' }
};
const SCREEN_BG = { green: '#0a1d12', amber: '#1a1005', dos: '#1d2c7a', teal: '#123a44', modern: '#14161c', pro: '#121420' };

/* ---------- layout ---------- */
function resize() {
  const vw = innerWidth, vh = innerHeight, bar = smallQ.matches ? 84 : 26;
  const main = STAGES[S.stage]?.main || { x: 26.5, w: 47 };
  const mainWidth = portraitQ.matches ? RW * main.w / 100 : RW;
  const fit = Math.max(.4, Math.min((vw - (portraitQ.matches ? 24 : 0)) / mainWidth, (vh - bar) / RH));
  Q = Math.max(1, Math.round(fit / 1.6));                          // canvas px per unit
  P = fit / Q;                                                     // CSS px per canvas px
  CW = Math.ceil(vw / P); CH = Math.ceil(vh / P);
  cvs.width = CW; cvs.height = CH;
  cvs.style.width = CW * P + 'px'; cvs.style.height = CH * P + 'px';
  OX = portraitQ.matches
    ? Math.floor(CW / 2 - (main.x + main.w / 2) * RW / 100 * Q)
    : Math.floor((CW - RW * Q) / 2);
  OY = CH - Math.ceil(bar / P) - RH * Q;
  ctx.imageSmoothingEnabled = false;
  const g = ctx.createRadialGradient(CW / 2, CH * .55, Math.min(CW, CH) * .35, CW / 2, CH * .55, Math.max(CW, CH) * .8);
  g.addColorStop(0, 'rgba(40,18,6,0)'); g.addColorStop(1, 'rgba(40,18,6,.42)'); vignette = g;
  document.documentElement.style.setProperty('--px', Math.max(2, Math.round(fit * .75)) + 'px');
}

/* ---------- room ---------- */
function drawRoom() {
  const W = ROOM;
  const dY = Y(Math.round(RH * .62)), bot = Y(RH), wainY = dY - 24 * Q;
  A(0, 0, CW, dY, W.wall);
  A(0, 0, CW, Math.round(dY * .16), W.wallTop);
  ctx.fillStyle = dither(W.wallTop, W.wall); ctx.fillRect(0, Math.round(dY * .16), CW, 2 * Q);
  // wallpaper: soft stripes with little dots between them
  const sp = 16 * Q, x0 = ((OX % sp) + sp) % sp;
  for (let x = x0; x < CW; x += sp) {
    A(x, Math.round(dY * .16) + 2 * Q, Math.max(1, Q), wainY, W.stripe);
    for (let y = Math.round(dY * .16) + 8 * Q; y < wainY - 4 * Q; y += 16 * Q) { const off = ((y / (16 * Q)) | 0) % 2 ? sp / 2 : 0; A(x + sp / 2 - Q + off - (off ? sp / 2 : 0) + (off ? sp / 2 : 0), y, Q, Q, W.dot); }
  }
  // wainscot panelling
  A(0, wainY, CW, dY - wainY, W.wain);
  A(0, wainY, CW, Q, W.wainHi); A(0, wainY + Q, CW, Math.max(1, Q >> 1), W.wainSh);
  for (let x = x0; x < CW; x += 32 * Q) { A(x, wainY + 4 * Q, Math.max(1, Q >> 1), dY - wainY - 7 * Q, W.panel); A(x + 1, wainY + 4 * Q, 1, dY - wainY - 7 * Q, W.wainHi); }
  // desk top with planks and grain
  A(0, dY, CW, bot - dY, W.top);
  ctx.fillStyle = dither(W.top, W.top2); ctx.fillRect(0, dY + Math.round((bot - dY) * .55), CW, bot - dY);
  for (let y = dY + 13 * Q; y < bot; y += 14 * Q) A(0, y, CW, 1, W.plank);
  for (let y = dY + 3 * Q; y < bot; y += 2 * Q) for (let x = (y * 7) % (11 * Q); x < CW; x += 19 * Q) { const h = hash(x, y); if (h < .45) A(x, y, (3 + Math.floor(h * 14)) * Q, 1, W.grain); }
  A(0, dY, CW, Q, W.hi);
  A(0, dY + Q, CW, 2 * Q, 'rgba(40,24,12,.22)');
  // desk front edge
  A(0, bot, CW, CH - bot, W.edge);
  A(0, bot, CW, Q, W.hi);
  ctx.fillStyle = dither(W.edge, W.edge2); ctx.fillRect(0, bot + 3 * Q, CW, CH);
}

function drawWindow(t) {
  const x = gx(5), y = gy(10), w = gx(15), h = gy(38);
  // warm light spilling onto the wall
  ctx.globalAlpha = .08; ellipse(x + w / 2, y + h / 2, w * 1.1, h * .9, '#ffcf96'); ctx.globalAlpha = 1;
  // curtain rod
  R(x - 12, y - 8, w + 24, 1.5, '#6b4326'); ellipse(x - 12, y - 7.25, 1.8, 1.8, '#c9944c'); ellipse(x + w + 12, y - 7.25, 1.8, 1.8, '#c9944c');
  // frame and sky
  R(x - 3, y - 3, w + 6, h + 6, '#efe2c8'); R(x - 3, y - 3, w + 6, .5, '#fff4de'); R(x - 3, y + h + 2.5, w + 6, .5, '#c9b691');
  const bands = ['#6f5d9e', '#9367a6', '#c9759b', '#ec9a87', '#f7c38f'];
  bands.forEach((c, i) => { const by = y + h * i / bands.length; R(x, by, w, h / bands.length + .5, c); if (i) { ctx.fillStyle = dither(bands[i - 1], c); ctx.fillRect(X(x), Y(by) - Q, Math.round(w * Q), Q * 2); } });
  // stars in the top band, a sun, two soft clouds
  for (let i = 0; i < 7; i++) if (Math.sin(t / 700 + i * 2.1) > .1) R(x + 3 + hash(i, 4) * (w - 6), y + 2 + hash(i, 8) * h * .18, .5, .5, '#fff3dc');
  ellipse(x + w * .64, y + h * .7, 9, 9, '#ffe3a6'); ellipse(x + w * .64, y + h * .7, 6.5, 6.5, '#fff0c8');
  const drift = (t / 260) % (w + 30);
  for (const [cx, cy, s] of [[drift - 15, y + h * .3, 1], [((drift + w * .6) % (w + 30)) - 15, y + h * .48, .8]]) {
    if (cx < -10 || cx > w + 10) continue;
    const ax = x + cx; ellipse(ax, cy, 7 * s, 2 * s, '#f6b8b4'); ellipse(ax + 3 * s, cy - 1.5 * s, 4 * s, 2 * s, '#fbd0c4');
  }
  // hills drawn column by column at canvas resolution
  const L = X(x), Rr = X(x + w), base = Y(y + h);
  for (let cx = L; cx < Rr; cx++) {
    const u = (cx - L) / Q;
    const far = Y(y + h * .66 + Math.sin(u * .09 + 1) * 4 + Math.sin(u * .23) * 1.5);
    const near = Y(y + h * .8 + Math.sin(u * .06 + 3) * 5);
    A(cx, far, 1, base - far, '#8a6b9c'); A(cx, near, 1, base - near, '#5c7a62');
    if (((cx * 13) % 7) === 0) A(cx, near, 1, Q, '#71946f');
  }
  // tiny trees on the near hill
  for (const fx of [.18, .26, .82]) { const tx = x + w * fx, ty = y + h * .8 + Math.sin((w * fx) * .06 + 3) * 5; R(tx - .25, ty - 2, .5, 2, '#3d4f3c'); ellipse(tx, ty - 4, 2, 3, '#476b4b'); }
  // window bars, sill
  R(x + w / 2 - 1, y, 2, h, '#efe2c8'); R(x, y + h * .48, w, 2, '#efe2c8');
  R(x - 6, y + h + 3, w + 12, 3.5, '#f3e7cf'); R(x - 6, y + h + 3, w + 12, .5, '#fff6e4'); R(x - 6, y + h + 6.5, w + 12, 1.5, 'rgba(60,35,15,.25)');
  // succulent on the sill
  const sx = x + w - 14, sy = y + h + 3;
  R(sx - 4, sy - 6, 8, 6, '#e2896a'); R(sx - 4.5, sy - 7, 9, 1.5, '#ee9f80'); R(sx + 2.5, sy - 6, 1.5, 6, '#c86e50');
  for (const [a, l] of [[-2.4, 4], [-1.57, 5.5], [-.75, 4], [-1.95, 4.6], [-1.15, 4.6]]) blob(sx + Math.cos(a) * l * .55, sy - 7 + Math.sin(a) * l * .55, l * .55, 1.5, a, '#7fbf8a');
  ellipse(sx, sy - 7.5, 1.5, 1, '#9fd6a3');
  // curtains with folds, tied back
  const C = ['#d9a441', '#e9bb5c', '#b8862c'];
  for (const side of [-1, 1]) {
    const cx = side < 0 ? x - 10 : x + w - 2;
    for (let i = 0; i < 12; i++) {
      const yy = y - 7 + i * ((h + 12) / 12), pinch = Math.abs(i - 6.5) < 1.5 ? 3 : 0;
      const wd = 12 - pinch, xx = side < 0 ? cx : cx + pinch;
      R(xx, yy, wd, (h + 12) / 12 + .5, C[0]);
      for (let f = 2.5; f < wd - 1; f += 3) R(xx + f, yy, .5, (h + 12) / 12 + .5, C[2]);
      R(side < 0 ? xx : xx + wd - .5, yy, .5, (h + 12) / 12 + .5, C[1]);
    }
    R(side < 0 ? cx : cx + 3, y - 7 + (h + 12) * .5, 9, 2, '#a3442f');
  }
}

function drawShelf() {
  const x = gx(83.5), y = gy(21), w = gx(14);
  R(x + 6, y + 3, 1.5, 5, '#6b4326'); R(x + w - 7.5, y + 3, 1.5, 5, '#6b4326');
  // books
  const books = [['#c8685a', 4, 17], ['#e3b45c', 3.5, 15], ['#5f8fb0', 4.5, 19], ['#7fae84', 3, 14], ['#b98cc0', 4, 16]];
  let bx = x + 3;
  for (const [c, bw, bh] of books) { R(bx, y - bh, bw, bh, c); R(bx, y - bh, bw, .5, 'rgba(255,255,255,.25)'); R(bx + .5, y - bh + 3, bw - 1, .5, 'rgba(255,240,210,.55)'); R(bx + .5, y - 4, bw - 1, .5, 'rgba(255,240,210,.55)'); bx += bw + .5; }
  // leaning book
  for (let i = 0; i < 15; i++) R(bx + 1 + i * .28, y - 15 + i, 3.5, 1.1, '#d98a6b');
  // little puzzle cube
  const kx = x + w - 16, ky = y - 9;
  R(kx, ky, 9, 9, '#2a2b30'); const cc = ['#ff6b5a', '#ffd25a', '#5aa9ff', '#5fd38d', '#ffffff', '#ff9e4a'];
  for (let i = 0; i < 9; i++) R(kx + .5 + (i % 3) * 2.8, ky + .5 + ((i / 3) | 0) * 2.8, 2.3, 2.3, cc[(i * 5 + 1) % 6]);
  // tiny cactus
  const tx = x + w - 4; R(tx - 2.5, y - 4, 5, 4, '#e8a07e'); ellipse(tx, y - 7, 1.8, 3.2, '#6fb07a'); R(tx - .25, y - 9, .5, .5, '#ffd1e0');
  // the board
  R(x, y, w, 3, '#a8764c'); R(x, y, w, .5, '#c8966a'); R(x, y + 2.5, w, .5, '#7a4c2e'); R(x + 1, y + 3, w - 2, 1.5, 'rgba(40,24,12,.25)');
}

function drawFairyLights(t) {
  const span = 90 * Q, sag = 7 * Q, top = Math.max(2 * Q, Y(3)), cols = ['#ffd36b', '#ff9e7a', '#a8e6c4', '#ffc0d9', '#b7d0ff'];
  const yAt = cx => { const f = (((cx - OX) % span) + span) % span / span; return top + sag * (1 - Math.pow(2 * f - 1, 2)); };
  for (let cx = 0; cx < CW; cx++) A(cx, Math.round(yAt(cx)), 1, 1, '#3b2f28');
  const step = 15 * Q;
  for (let i = 0, cx = ((OX % step) + step) % step + step / 2; cx < CW; cx += step, i++) {
    const cy = Math.round(yAt(cx)), c = cols[(i + 50) % cols.length], tw = .55 + .45 * Math.sin(t / 500 + i * 1.9);
    ctx.globalAlpha = .12 * tw; ellipse((cx - OX) / Q, (cy - OY) / Q + 3, 6, 5, c);
    ctx.globalAlpha = .25 * tw; ellipse((cx - OX) / Q, (cy - OY) / Q + 3, 3, 2.6, c); ctx.globalAlpha = 1;
    A(cx - Q / 2, cy, Q, Q, '#4a3d33');
    A(cx - Q, cy + Q, 2 * Q, Math.round(2.5 * Q), c); A(cx - Q, cy + Q, Math.max(1, Q >> 1), Math.round(1.5 * Q), '#fff8e6');
  }
}

function drawLed(t) {
  const y = gy(52);
  for (let x = -60; x < RW + 60; x += 2) {
    const c = `hsl(${(x * .9 + t * .05) % 360} 85% 62%)`;
    ctx.globalAlpha = .16; R(x, y + 10, 2, 12, c);
    ctx.globalAlpha = .08; R(x, y, 2, 10, c); R(x, y + 22, 2, 8, c);
  }
  ctx.globalAlpha = 1;
}

/* ---------- desk items ---------- */
function drawLamp() {
  const bx = gx(12), by = gy(62);
  ctx.globalAlpha = .07; ellipse(gx(22), gy(56), 74, 40, '#ffc98a'); ellipse(gx(22), gy(58), 46, 24, '#ffc98a'); ctx.globalAlpha = 1;
  ellipse(bx + 11, by, 13, 2, SHADOW);
  R(bx, by - 4, 22, 4, '#c7553f'); R(bx + .5, by - 4.5, 21, .5, '#e47a5e'); R(bx, by - .5, 22, .5, '#933a29'); R(bx + 9, by - 7, 5, 3, '#a8432f');
  line(bx + 11.5, by - 7, bx + 20.5, gy(30), '#6b4a3a', 1.5); ellipse(bx + 20.5, gy(30), 2, 2, '#a8432f');
  const hx = bx + 20, hy = gy(30);
  for (let i = 0; i < 24; i++) { const k = i / 2; R(hx + k, hy + k * .5, 12 - k * .4, 3 + k * .5, i < 3 ? '#e47a5e' : '#c7553f'); }
  R(hx + 4, hy + 10, 14, 2, '#fff0c8');
  ctx.globalAlpha = .13; ctx.fillStyle = '#ffd9a0';
  ctx.beginPath(); ctx.moveTo(X(hx + 4), Y(hy + 12)); ctx.lineTo(X(hx + 18), Y(hy + 12)); ctx.lineTo(X(hx + 40), Y(gy(62))); ctx.lineTo(X(hx - 14), Y(gy(62))); ctx.fill();
  ctx.globalAlpha = 1;
}
function drawMug(t) {
  const x = gx(21), y = gy(63);
  ellipse(x + 7.5, y + 17, 9, 1.8, SHADOW);
  R(x + 13, y + 4, 4, 2, '#e9d6b6'); R(x + 16, y + 5, 2, 7, '#e9d6b6'); R(x + 13, y + 11, 4, 2, '#d6c09c');
  R(x, y, 13, 17, '#f3e6cf'); R(x, y, 1.5, 17, '#fff6e6'); R(x + 11, y, 2, 17, '#d9c6a6'); R(x, y, 13, 1.5, '#e0cda9'); R(x + .5, y + .5, 12, 1, '#6b4128');
  R(x + .5, y + 16.5, 12, .5, '#c9b48f');
  // face
  R(x + 3.5, y + 7, 1, 1.5, '#4f3426'); R(x + 8.5, y + 7, 1, 1.5, '#4f3426');
  R(x + 2.5, y + 9, 1.5, .5, '#f0a7a0'); R(x + 9, y + 9, 1.5, .5, '#f0a7a0');
  R(x + 5.5, y + 9.5, .5, .5, '#4f3426'); R(x + 6, y + 10, 1, .5, '#4f3426'); R(x + 7, y + 9.5, .5, .5, '#4f3426');
  ctx.globalAlpha = .4;
  for (let i = 0; i < 3; i++) { const ph = (t / 1100 + i / 3) % 1; R(x + 3.5 + i * 3 + Math.sin(ph * 6) * 1.5, y - 2 - ph * 13, .5, 1.5, '#ffffff'); }
  ctx.globalAlpha = 1;
}
function drawPad(st) {
  if (st >= 5) {
    const x = gx(24), y = gy(66), w = gx(62), h = gy(26), c = st >= 6 ? '#b98cff' : '#e0b25a';
    R(x + .5, y + h, w, 1.5, SHADOW);
    R(x, y, w, h, '#2a2c34'); R(x, y, w, .5, '#3a3d47');
    for (let i = x + 2; i < x + w - 2; i += 3) { R(i, y + 1.5, 1.5, .5, c); R(i, y + h - 2, 1.5, .5, c); }
    for (let j = y + 2; j < y + h - 2; j += 3) { R(x + 1.5, j, .5, 1.5, c); R(x + w - 2, j, .5, 1.5, c); }
  } else {
    const x = gx(71.5), y = gy(69.5), w = gx(11), h = gy(18);
    R(x + .5, y + h, w, 1, SHADOW);
    R(x + .5, y, w - 1, h, '#3d6b70'); R(x, y + .5, w, h - 1, '#3d6b70'); R(x + .5, y, w - 1, .5, '#5a8c8e'); R(x + .5, y + h - .5, w - 1, .5, '#2c5155');
    R(x + 2, y + h - 5, 6, 2.5, '#e8c56a'); R(x + 2.5, y + h - 4.5, 1, 1.5, '#fff1c4');
  }
}

function drawCase(kind, b, t) {
  if (!b) return;
  const { x, y, w, h } = b;
  R(x + 1, y + h, w, 2, SHADOW);
  if (kind === 'desktop') {
    R(x, y, w, h, '#dfd6bc'); R(x, y, w, 1, '#f2ebd8'); R(x, y + h - 2, w, 2, '#c0b698'); R(x + w - 1, y, 1, h, '#cbc1a4');
    for (const yy of [.3, .6]) { R(x + w * .6, y + h * yy, w * .32, 3, '#4a4337'); R(x + w * .6, y + h * yy + 3, w * .32, .5, '#f5efdc'); R(x + w * .6 + w * .13, y + h * yy + 1, w * .06, 1, '#8a8170'); }
    R(x + 6, y + h * .36, 10, 7, '#c7bc9d'); R(x + 6, y + h * .36, 10, .5, '#ddd3b6');
    R(x + 8, y + h * .36 + 2.5, 1.5, 1.5, '#ff6a50');
    txt('PC-8', x + 26, y + h * .52, 5, '#8a7f62', 'left', 400);
    return;
  }
  const pal = {
    'tower-beige': ['#dfd6bc', '#f2ebd8', '#c0b698', '#4a4337'], 'tower-grey': ['#b6bbc2', '#d4d7dc', '#959aa2', '#4a4e56'],
    'tower-black': ['#2a2c31', '#43454d', '#1b1c20', '#101013'], 'tower-led': ['#2a2c31', '#43454d', '#1b1c20', '#101013'], 'tower-rgb': ['#1f2025', '#383a42', '#131417', '#000']
  }[kind];
  R(x, y, w, h, pal[0]); R(x, y, w, 1, pal[1]); R(x, y, 1, h, pal[1]); R(x + w - 2, y, 2, h, pal[2]); R(x, y + h - 1.5, w, 1.5, pal[2]);
  if (kind === 'tower-rgb') {
    R(x + 2.5, y + 3.5, w - 6, h - 8, '#0b0c10'); R(x + 2.5, y + 3.5, w - 6, .5, '#2b2e38');
    for (const fy of [.3, .68]) {
      const cx = x + 2.5 + (w - 6) / 2, cy = y + h * fy, r = Math.min(w - 8, 26) / 2;
      for (let a = 0; a < 36; a++) { const ang = a / 36 * Math.PI * 2 + t / 300 * (fy < .5 ? 1 : -1); R(cx + Math.cos(ang) * r - .5, cy + Math.sin(ang) * r - .5, 1, 1, `hsl(${(a * 10 + t * .08) % 360} 90% 64%)`); }
      ellipse(cx, cy, 1.5, 1.5, '#2a2c33');
    }
    return;
  }
  R(x + 4, y + 6, w - 9, 3.5, pal[3]); R(x + 4, y + 9.5, w - 9, .5, pal[1]); R(x + 4, y + 13, w - 9, 3.5, pal[3]); R(x + 4, y + 16.5, w - 9, .5, pal[1]);
  const led = kind === 'tower-grey' ? '#5fe08a' : kind === 'tower-beige' ? '#ff6a50' : '#6ab8ff';
  ellipse(x + w / 2 - 1, y + h - 8, 2.2, 2.2, pal[2]); ellipse(x + w / 2 - 1, y + h - 8, 1, 1, led);
  for (let gy2 = y + 24; gy2 < y + h - 14; gy2 += 2) R(x + 3, gy2, w - 8, .5, pal[2]);
  if (kind === 'tower-led') { R(x + 3.5, y + 22, 1, h - 38, '#6ab8ff'); ctx.globalAlpha = .25; R(x + 2, y + 22, 4, h - 38, '#6ab8ff'); ctx.globalAlpha = 1; }
}

// Monitor: returns the screen rect (units, snapped to the canvas grid).
function drawMon(r, bez, crt, stl, arms, screenKind) {
  const standH = r.h * (r.stand || 0) / 100;
  const b = { x: snap(r.x), y: snap(r.y), w: snap(r.w), h: snap(r.h - standH) };
  const pads = crt ? [.085, .09, .17] : stl === 3 ? [.045, .06, .13] : stl === 4 ? [.03, .045, .1] : stl === 7 ? [.014, .025, .03] : [.018, .03, .075];
  const px = Math.max(2, b.w * pads[0]), pt = Math.max(2, b.h * pads[1]), pb = Math.max(2, b.h * pads[2]);
  if (standH > 0 && !arms) {
    const nx = b.x + b.w * (crt ? .34 : .45), nw = b.w * (crt ? .32 : .1);
    R(nx, b.y + b.h, nw, standH - 3, bez.sh); R(nx, b.y + b.h, .5, standH - 3, bez.hi);
    const fx = b.x + b.w * (crt ? .22 : .3), fw = b.w * (crt ? .56 : .4);
    ellipse(fx + fw / 2, r.y + r.h, fw / 2 + 3, 1.6, SHADOW);
    R(fx, r.y + r.h - 4, fw, 4, bez.c); R(fx, r.y + r.h - 4, fw, .5, bez.hi); R(fx, r.y + r.h - .5, fw, .5, bez.sh);
  } else if (!arms) R(b.x + 1, b.y + b.h, b.w, 2, SHADOW);
  if (crt) { R(b.x + 6, b.y - 3, b.w - 12, 3, '#c4ba9d'); R(b.x + 6, b.y - 3, b.w - 12, .5, '#d8cfb3'); }
  // body with softened corners
  R(b.x + 1, b.y, b.w - 2, b.h, bez.c); R(b.x, b.y + 1, b.w, b.h - 2, bez.c);
  R(b.x + 1, b.y, b.w - 2, crt ? 1 : .5, bez.hi); R(b.x, b.y + 1, crt ? 1 : .5, b.h - 2, bez.hi);
  R(b.x + b.w - (crt ? 1.5 : .5), b.y + 1, crt ? 1.5 : .5, b.h - 2, bez.sh); R(b.x + 1, b.y + b.h - (crt ? 1.5 : .5), b.w - 2, crt ? 1.5 : .5, bez.sh);
  const s = { x: snap(b.x + px), y: snap(b.y + pt), w: snap(b.w - px * 2), h: snap(b.h - pt - pb) };
  R(s.x - 1.5, s.y - 1.5, s.w + 3, s.h + 3, bez.rim); R(s.x - .5, s.y - .5, s.w + 1, s.h + 1, '#000');
  R(s.x, s.y, s.w, s.h, SCREEN_BG[screenKind] || '#14161c');
  const cy = b.y + b.h - pb / 2;
  if (pb >= 5) {
    if (crt) { R(b.x + px + 2, cy - 1, b.w * .14, 2.5, bez.badge); ellipse(b.x + b.w - px - 4, cy + .25, 1.3, 1.3, '#5fe08a'); }
    else { R(b.x + b.w / 2 - 3, cy - .25, 6, .5, bez.badge); R(b.x + b.w - px - 4, cy - .25, 1, .5, '#5fe08a'); }
  }
  return s;
}

/* ---------- desk toys by era ---------- */
function drawGear(st, t) {
  if (st <= 2) {
    // joystick
    const jx = 30, jy = 214;
    ellipse(jx + 12, jy + 10.5, 15, 2.2, SHADOW);
    R(jx, jy, 24, 10, '#3a3532'); R(jx, jy, 24, 3, '#4d4743'); R(jx, jy, 24, .5, '#625a55'); R(jx, jy + 9.5, 24, .5, '#24201e');
    ellipse(jx + 5, jy + 1.5, 2.4, 1.2, '#e0533f'); R(jx + 4, jy + 1, 1, .5, '#ff9a86');
    ellipse(jx + 15, jy + 1.6, 3, 1.3, '#1f1c1a');
    line(jx + 15, jy + 1, jx + 16.5, jy - 15, '#2a2624', 1.5);
    ellipse(jx + 16.5, jy - 17, 3.6, 3.6, '#d84a3a'); ellipse(jx + 15.5, jy - 18.2, 1.3, 1.1, '#f6a090');
    R(jx + 24, jy + 4, 3, .5, '#2a2624'); line(jx + 27, jy + 4.25, jx + 31, jy - 6, '#2a2624', .5);
    // floppy disks
    const fx = 70, fy = 224, cs = ['#c95c5c', '#3c3e46', '#4f78ad'];
    ellipse(fx + 10, fy + 18, 12, 2, SHADOW);
    cs.forEach((c, i) => {
      const ox = fx + i * 1.5, oy = fy - i * 2.5;
      R(ox, oy, 17, 17, c); R(ox, oy, 17, .5, 'rgba(255,255,255,.2)'); R(ox, oy + 16.5, 17, .5, 'rgba(0,0,0,.3)');
      if (i === cs.length - 1) {
        R(ox + 4, oy, 9, 6, '#c9ccd1'); R(ox + 9, oy + 1, 2, 4, '#5d6168'); R(ox + 4, oy + 5.5, 9, .5, '#9ea2a8');
        R(ox + 2, oy + 8.5, 13, 7.5, '#f6f0e0'); R(ox + 3, oy + 10.5, 8, .5, '#c95c5c'); R(ox + 3, oy + 12.5, 10, .5, '#b9b2a0'); R(ox + 3, oy + 14, 6, .5, '#b9b2a0');
      }
    });
    return;
  }
  if (st <= 4) {
    // retro pad, grey with soft purple buttons
    const cx = 60, cy = 228;
    ellipse(cx, cy + 8.5, 22, 2.2, SHADOW);
    line(cx, cy - 6, cx + 3, cy - 14, '#3b3b42', .5); line(cx + 3, cy - 14, cx - 2, cy - 28, '#3b3b42', .5);
    ellipse(cx - 12, cy, 8.5, 7.5, '#c9cad0'); ellipse(cx + 12, cy, 8.5, 7.5, '#c9cad0'); R(cx - 12, cy - 7, 24, 14, '#c9cad0');
    R(cx - 12, cy - 7, 24, .5, '#e5e6ea'); ellipse(cx - 13, cy - 4, 4, 1.5, '#e2e3e7');
    R(cx - 15, cy - 1, 7, 2.2, '#3b3b42'); R(cx - 12.6, cy - 3.4, 2.2, 7, '#3b3b42'); R(cx - 12.3, cy - 3.1, 1.6, .5, '#5a5a63');
    ellipse(cx + 10, cy + 1.5, 2.2, 2.2, '#8f6fc8'); ellipse(cx + 15, cy - 1.5, 2.2, 2.2, '#c86f9c');
    R(cx + 9.5, cy + .5, 1, .5, '#c7b3ec'); R(cx + 14.5, cy - 2.5, 1, .5, '#ecb3cf');
    R(cx - 4, cy + 1, 3, 1, '#6d6d76'); R(cx + 1, cy + 1, 3, 1, '#6d6d76');
    // cartridge
    const kx = 88, ky = 212;
    R(kx + 1, ky + 20, 16, 1.5, SHADOW);
    R(kx, ky, 16, 20, '#8e9097'); R(kx, ky, 16, .5, '#b0b2b8'); for (let i = 0; i < 5; i++) R(kx + 2 + i * 2.6, ky + 1.5, 1.2, 3, '#7a7c83');
    R(kx + 2, ky + 6, 12, 12, '#f0a26b'); R(kx + 2, ky + 6, 12, 4, '#f7c38f');
    ellipse(kx + 10.5, ky + 10, 2, 2, '#fff0c8'); for (let i = 0; i < 6; i++) R(kx + 3 + i, ky + 17 - i * 1.1, 6 - i * .5, 1, '#5c7a62');
    return;
  }
  // headphones on a stand
  const hx = 20, accent = st >= 6 ? `hsl(${(t * .08) % 360} 85% 62%)` : '#ef8a4c';
  ellipse(hx, 252, 11, 2.8, SHADOW);
  ellipse(hx, 251, 10, 2.6, '#4a423c'); ellipse(hx, 250.5, 8, 1.6, '#5d544d');
  R(hx - 1, 206, 2, 45, '#4a423c'); R(hx - 1, 206, .5, 45, '#655b53'); R(hx - 6, 204, 12, 2, '#4a423c'); R(hx - 6, 204, 12, .5, '#655b53');
  arc(hx, 214, 11, 11, Math.PI * 1.02, Math.PI * 1.98, st === 7 ? '#e9ebef' : '#2c2e35', 2);
  arc(hx, 214, 10, 10, Math.PI * 1.1, Math.PI * 1.9, st === 7 ? '#ffffff' : '#474a53', .5);
  for (const sx of [-1, 1]) {
    const cx = hx + sx * 10.5;
    blob(cx, 218, 3.6, 7, 0, st === 7 ? '#e9ebef' : '#2c2e35');
    blob(cx - sx * 1.6, 218, 1.6, 6, 0, st === 7 ? '#c9ccd3' : '#1b1c21');
    R(cx + sx * 2.6 - .25, 213, .5, 10, accent);
  }
  // modern controller
  const cx = 72, cy = 232, body = st === 7 ? '#eef0f3' : '#2c2e35', hi = st === 7 ? '#ffffff' : '#474a53', dark = st === 7 ? '#c7cbd2' : '#18191d';
  ellipse(cx, cy + 9, 22, 2.2, SHADOW);
  blob(cx - 13, cy + 3, 6.5, 9, -.55, body); blob(cx + 13, cy + 3, 6.5, 9, .55, body);
  ellipse(cx, cy - 1, 17, 7.5, body); ellipse(cx - 3, cy - 5, 9, 1.4, hi);
  if (st >= 6) R(cx - 5, cy - 7.5, 10, .5, accent);
  ellipse(cx - 5, cy + 2.5, 2.6, 2.6, dark); ellipse(cx - 5, cy + 2.2, 1.6, 1.6, '#3d4049');
  ellipse(cx + 5, cy + 2.5, 2.6, 2.6, dark); ellipse(cx + 5, cy + 2.2, 1.6, 1.6, '#3d4049');
  R(cx - 13, cy - 2.5, 5, 1.6, dark); R(cx - 11.3, cy - 4.2, 1.6, 5, dark);
  const bc = [['#5fd38d', 0, 2.2], ['#ff6b6b', 2.2, 0], ['#5aa9ff', -2.2, 0], ['#ffd25a', 0, -2.2]];
  for (const [c, dx, dy] of bc) ellipse(cx + 11 + dx, cy - 1.5 + dy, 1.1, 1.1, c);
}

function drawPlant(t) {
  const cx = gx(89), yb = gy(97), sway = Math.sin(t / 1400) * .04;
  ellipse(cx + 1, yb + .5, 17, 2.4, SHADOW);
  // leaves (behind pot rim)
  const base = { x: cx, y: yb - 23 };
  const leaves = [[-2.75, 17, 7, 3.2], [-2.35, 27, 9.5, 4.2], [-1.95, 35, 10, 4.6], [-1.57, 40, 10.5, 4.8], [-1.2, 33, 10, 4.6], [-.82, 25, 9, 4.2], [-.42, 16, 7, 3.2], [-2.1, 20, 7, 3.4], [-1.0, 19, 7, 3.4]];
  leaves.forEach(([a0, l, rx, ry], i) => {
    const a = a0 + sway * (1 + i % 3 * .4), ca = Math.cos(a), sa = Math.sin(a);
    const lx = base.x + ca * l, ly = base.y + sa * l;
    line(base.x + ca * 2, base.y + sa * 2, lx - ca * rx * .8, ly - sa * rx * .8, '#3f7f4a', .7);
    const c = i % 2 ? '#4f9e5c' : '#62b36c', hi = i % 2 ? '#6dbb76' : '#82cc86';
    blob(lx, ly, rx, ry, a, c);
    blob(lx - sa * ry * .35, ly + ca * ry * .35 - .4, rx * .7, ry * .38, a, hi);
    line(lx - ca * rx * .75, ly - sa * rx * .75, lx + ca * rx * .7, ly + sa * rx * .7, '#3f7f4a', .5);
  });
  // pot
  const top = yb - 22;
  for (let i = 0; i < 18; i++) {
    const yy = top + 4 + i, half = 13 - i * .22;
    R(cx - half, yy, half * 2, 1.05, '#d9825b'); R(cx - half, yy, 2, 1.05, '#eea47a'); R(cx + half - 3, yy, 3, 1.05, '#b9643f');
  }
  R(cx - 15.5, top, 31, 4.5, '#e6936a'); R(cx - 15.5, top, 31, .5, '#f6b48e'); R(cx - 15.5, top + 4, 31, .5, '#b9643f'); R(cx + 12.5, top + .5, 3, 3.5, '#c97752');
  ellipse(cx, top + .4, 13.5, 1.2, '#5a3a28');
  R(cx - 9, yb - .5, 18, .5, '#9f5333');
  // face
  const fy = top + 10;
  R(cx - 6, fy, 2, 2.5, '#4a2c20'); R(cx + 4, fy, 2, 2.5, '#4a2c20'); R(cx - 5.5, fy + .3, .5, .5, '#fff3e6'); R(cx + 4.5, fy + .3, .5, .5, '#fff3e6');
  R(cx - 9, fy + 3, 3, 1, '#f3a492'); R(cx + 6, fy + 3, 3, 1, '#f3a492');
  R(cx - 1.5, fy + 3, .5, .5, '#4a2c20'); R(cx - 1, fy + 3.5, 2, .5, '#4a2c20'); R(cx + 1, fy + 3, .5, .5, '#4a2c20');
}

/* ---------- keyboard ---------- */
function keyLegend(code, legend) {
  if (code === 'Space' || code.startsWith('Meta')) return '';
  if (code === 'Backspace') return 'back';
  return legend.length === 1 ? legend.toUpperCase() : legend.toLowerCase();
}
function drawKeyboard(kb, style, t, dt) {
  const K = KBS[style];
  const bump = clamp(1 - (t - S.enterT) / 140, 0, 1);
  const x = snap(kb.x), y = snap(kb.y + (bump > .5 ? .5 : 0)), w = snap(kb.w), h = snap(kb.h);
  const T = 6, topH = h - T;
  if (K.glow || K.rgb) {
    for (let i = 4; i >= 1; i--) { ctx.globalAlpha = .06 * (5 - i); R(x - i * 2, y + topH - 2 - i, w + i * 4, T + i * 3, K.rgb ? `hsl(${(t * .08) % 360} 85% 62%)` : K.glow); }
    ctx.globalAlpha = 1;
  }
  R(x + 2, y + h, w - 2, 2.5, SHADOW);
  // body: top face then front face, with soft corners
  R(x + 1, y, w - 2, topH, K.body); R(x, y + 1, w, topH - 1, K.body);
  R(x + 1, y, w - 2, .5, K.bodyHi); R(x, y + 1, .5, topH - 1.5, K.bodyHi); R(x + w - .5, y + 1, .5, topH - 1, K.bodySh);
  R(x + .5, y + topH, w - 1, T - .5, K.front); R(x + 1, y + h - .5, w - 2, .5, K.frontSh); R(x + .5, y + topH, w - 1, .5, K.bodySh);
  ctx.fillStyle = dither(K.front, K.frontSh); ctx.fillRect(X(x + 1), Y(y + topH + 3), Math.round((w - 2) * Q), Math.round((T - 3.5) * Q));
  if (style === 'premium') ellipse(x + 4, y + topH + 2.5, .8, .8, '#5fe08a');
  // keys
  const ix = x + 4.5, iw = w - 9, iy = y + 3.5, ih = topH - 7;
  const pitch = ih / 5, u = iw / 15, kh = snap(pitch) - 1;
  const F = K.F, capTop = kh - F;
  S.keyRects = [];
  ROWS.forEach((row, r) => {
    const ky = snap(iy + r * pitch);
    let acc = 0;
    for (const [code, legend, , wu = 1] of row) {
      const x0 = snap(ix + acc * u), x1 = snap(ix + (acc + wu) * u) - 1, kw = x1 - x0;
      acc += wu;
      S.keyRects.push({ code, x: x0, y: ky, w: kw, h: kh });
      const k = S.keys.get(code) || { d: 0, v: 0, down: false, flash: 0 };
      // spring: snap down fast, pop back up with a little overshoot
      if (k.down) { k.d = Math.min(1, k.d + dt * 28); k.v = 0; }
      else { const a = -700 * k.d - 24 * k.v; k.v += a * dt; k.d += k.v * dt; if (Math.abs(k.d) < .01 && Math.abs(k.v) < .05) { k.d = 0; k.v = 0; } k.d = clamp(k.d, -.6, 1); }
      k.flash = Math.max(0, k.flash - dt * 4);
      S.keys.set(code, k);
      const isMod = legend.length !== 1 || code.startsWith('Meta');
      const isAcc = code === 'Enter' || code === 'Backspace';
      let cap = K.cap, hi = K.capHi, f1 = K.capF, f2 = K.capF2, sh = K.capSh, lg = K.leg;
      if (isMod && K.mod) { cap = K.mod; hi = K.modHi; f1 = K.modF; f2 = K.modF; sh = K.mod; lg = K.legMod || K.leg; }
      if (isAcc && K.acc) { cap = K.acc; hi = K.accHi; f1 = K.accF; f2 = K.accF; sh = K.acc; lg = K.legAcc || lg; }
      if (style === 'premium' && code === 'Space') { cap = K.mod; hi = K.modHi; f1 = K.modF; f2 = K.modF; sh = K.mod; }
      const hue = (t * .09 + x0 * 1.6) % 360;
      if (K.rgb) { lg = `hsl(${hue} 90% 68%)`; R(x0 - .5, ky + kh, kw + 1, .5, `hsl(${hue} 85% 48%)`); }
      if (S.shift && code.startsWith('Shift')) hi = '#8fe3c4';
      const dpx = Math.round(k.d * F * Q) / Q;
      R(x0, ky, kw, kh, K.well);
      const topY = ky + dpx;
      R(x0, topY + capTop, kw, kh - capTop - dpx, f1);
      R(x0 + .5, ky + kh - .5, kw - 1, .5, f2);
      R(x0, topY, kw, capTop, k.d > .5 ? sh : cap);
      R(x0 + .5, topY, kw - 1, .5, k.flash > .4 ? '#ffffff' : hi);
      R(x0, topY + .5, .5, capTop - 1, hi);
      R(x0 + kw - .5, topY + .5, .5, capTop - .5, sh === cap ? f1 : sh);
      A(X(x0), Y(topY), 1, 1, K.well); A(X(x0 + kw) - 1, Y(topY), 1, 1, K.well);
      if (K.rgb && k.d > .3) { ctx.globalAlpha = .45; R(x0, topY, kw, capTop, `hsl(${hue} 90% 62%)`); ctx.globalAlpha = 1; }
      if (K.glow && k.flash > 0) { ctx.globalAlpha = k.flash * .55; R(x0 - .5, topY - .5, kw + 1, capTop + 1, K.glow); ctx.globalAlpha = 1; }
      // legend
      const cyL = topY + capTop / 2;
      if (code.startsWith('Meta')) { diamond(x0 + kw / 2, cyL, 1.2, lg); continue; }
      const s = keyLegend(code, legend); if (!s) continue;
      const single = s.length === 1;
      const [fam, fs, fw] = eraFont();
      let size = (single ? Math.min(capTop * .72, kw * .66) : Math.min(capTop * .6, 5.2)) * fs;
      ctx.font = `${fw} ${Math.max(5, Math.round(size * Q))}px ${fam}`;
      if (ctx.measureText(s).width / Q > kw - 2) { size *= (kw - 2) / (ctx.measureText(s).width / Q); if (size * Q < 5) continue; }
      txt(s, single ? x0 + kw / 2 : x0 + 1.6, cyL, size, lg, single ? 'center' : 'left', fw, fam);
    }
  });
}

/* ---------- mouse ---------- */
function drawMouse(ms, style, t) {
  const M = MICE[style];
  S.mouse.x += (S.mouse.tx - S.mouse.x) * .25; S.mouse.y += (S.mouse.ty - S.mouse.y) * .25;
  const x = ms.x + S.mouse.x, y = ms.y + S.mouse.y, w = ms.w, h = ms.h;
  if (M.cable) for (let i = .5; i < 16; i += .5) R(x + w / 2 + Math.sin(i / 3 + 1) * 1.5 - .5, y - i, 1, .5, M.cable);
  if (M.glow) {
    const c = M.glow === 'hue' ? `hsl(${(t * .1) % 360} 85% 62%)` : M.glow;
    ctx.globalAlpha = .16; ellipse(x + w / 2, y + h - 1, w / 2 + 5, 4, c); ctx.globalAlpha = .28; ellipse(x + w / 2, y + h, w / 2 + 1, 2, c); ctx.globalAlpha = 1;
  }
  ellipse(x + w / 2 + 1, y + h, w / 2 + 1.5, 1.8, SHADOW);
  // body, row by row at canvas resolution
  const mx = X(x), my = Y(y), mw = Math.round(w * Q), mh = Math.round(h * Q);
  const rt = M.box ? 1.6 * Q : mh * .32, rb = M.box ? 1.2 * Q : mh * .22;
  const inset = i => {
    if (i < rt) { const q = (rt - i) / rt; return Math.round((M.box ? rt : mw / 2) * (1 - Math.sqrt(1 - q * q))); }
    if (i > mh - rb) { const q = (i - (mh - rb)) / rb; return Math.round((M.box ? rb : mw / 2 * .8) * (1 - Math.sqrt(1 - q * q))); }
    return 0;
  };
  const split = Math.round(mh * .4), mid = mx + (mw >> 1), e = Math.max(1, Q);
  for (let i = 0; i < mh; i++) {
    const s = inset(i), rw = mw - s * 2; if (rw <= 0) continue;
    A(mx + s, my + i, rw, 1, M.c);
    A(mx + s, my + i, Math.min(e, rw), 1, M.hi);
    A(mx + s + rw - e, my + i, Math.min(e, rw), 1, M.sh);
    if (i < split) {
      if (S.mouse.l) A(mx + s + e, my + i, mid - mx - s - e, 1, M.sh);
      if (S.mouse.r) A(mid + 1, my + i, mx + mw - s - e - mid - 1, 1, M.sh);
    }
  }
  A(mx + e, my + split, mw - 2 * e, 1, M.ln);
  A(mid, my + 1, 1, split - 1, M.ln);
  if (style !== 'ball') { R(x + w / 2 - 1, y + 2.5, 2, 4.5, '#202226'); R(x + w / 2 - .5, y + 3, 1, 3.5, style === 'gaming' ? `hsl(${(t * .1) % 360} 85% 62%)` : '#8e949e'); }
  if (M.stripe) { R(x + .5, y + h * .4 + 3, .5, h * .6 - 8, `hsl(${(t * .1 + 120) % 360} 85% 62%)`); R(x + w - 1, y + h * .4 + 3, .5, h * .6 - 8, `hsl(${(t * .1 + 240) % 360} 85% 62%)`); }
  if (M.side) { R(x - .5, y + h * .4 + 2, 1, 3.5, '#a9afb8'); R(x - .5, y + h * .4 + 6.5, 1, 2.5, '#a9afb8'); }
}

/* ---------- particles ---------- */
function spawn(code, n, big) {
  const k = S.keyRects.find(r => r.code === code); if (!k) return;
  const K = KBS[STAGES[S.stage].kb];
  for (let i = 0; i < n; i++) {
    const c = K.rgb ? `hsl(${Math.random() * 360} 90% 66%)` : (K.spark || '#ffffff');
    S.particles.push({ x: k.x + Math.random() * k.w, y: k.y + 1, vx: (Math.random() - .5) * (big ? 90 : 40), vy: -(big ? 50 : 25) - Math.random() * (big ? 70 : 30), life: big ? .7 : .4, max: big ? .7 : .4, c, s: big && Math.random() < .4 ? 1.5 : 1 });
  }
}
function drawParticles(dt) {
  S.particles = S.particles.filter(p => (p.life -= dt) > 0);
  for (const p of S.particles) { p.vy += 260 * dt; p.x += p.vx * dt; p.y += p.vy * dt; ctx.globalAlpha = clamp(p.life / p.max * 1.5, 0, 1); A(X(p.x), Y(p.y), Math.max(1, Math.round(p.s * Q)), Math.max(1, Math.round(p.s * Q)), p.c); }
  ctx.globalAlpha = 1;
}

/* ---------- frame ---------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;
  const st = STAGES[S.stage], pv = STAGES[S.prev];
  const k = ease(clamp((now - S.t0) / S.dur, 0, 1));
  const main = lerpR(rp(pv.main), rp(st.main), k);
  const kb = lerpR(rp(pv.kbBox), rp(st.kbBox), k);
  const ms = lerpR(rp(pv.msBox), rp(st.msBox), k);

  drawRoom();
  drawWindow(now);
  drawShelf();
  drawFairyLights(now);
  if (st.extras.includes('led')) drawLed(now);
  if (st.arms) { R(gx(49.2), gy(5), 7, gy(57), '#4a4e57'); R(gx(49.2) + 3, gy(5), .5, gy(57), '#7a7f89'); R(gx(49.2) - 8, gy(61), 23, 3, '#2a2c31'); }
  drawCase(st.caseKind, st.box && rp(st.box), now);

  const screens = [];
  st.side.forEach((g, i) => {
    const born = S.born[i] ?? -1e9;
    const a = clamp((now - born) / 500, 0, 1);
    let r = rp(g);
    if (pv.side[i] && born < 0) r = lerpR(rp(pv.side[i]), r, k);
    r.y += (1 - ease(a)) * 30;
    ctx.globalAlpha = a < 1 ? Math.max(.15, a) : 1;
    screens.push({ i, r: drawMon(r, S.stage >= 5 ? BEZ.thin : BEZ.s4, false, S.stage, st.arms, st.screen), a });
    ctx.globalAlpha = 1;
  });
  const crt = st.mon === 'crt';
  const bez = crt ? BEZ.crt : S.stage === 3 ? BEZ.s3 : S.stage === 4 ? BEZ.s4 : BEZ.thin;
  const mainScreen = drawMon(main, bez, crt, S.stage, st.arms, st.screen);

  if (st.extras.includes('lamp')) drawLamp();
  if (st.extras.includes('pad') || st.extras.includes('deskmat')) drawPad(S.stage);
  if (st.extras.includes('mug') || S.stage >= 6) drawMug(now);
  drawGear(S.stage, now);
  drawKeyboard(kb, st.kb, now, dt);
  drawMouse(ms, st.mouse, now);
  drawPlant(now);
  drawParticles(dt);

  ctx.fillStyle = vignette; ctx.fillRect(0, 0, CW, CH);

  // upgrade flash
  const z = (now - S.zapT) / 650;
  if (z >= 0 && z < 1) {
    ctx.globalAlpha = (1 - z) * (1 - z) * .8; A(0, 0, CW, CH, '#fff6e4');
    ctx.globalAlpha = 1 - z;
    for (let i = 0; i < 40; i++) R(hash(i, 1) * RW, hash(i, 2) * RH - z * 30 * hash(i, 3), 1.5, 1.5, i % 2 ? '#ffffff' : '#ffd08a');
    ctx.globalAlpha = 1;
  }

  if (S.layoutCb) {
    const css = r => ({ left: (OX + r.x * Q) * P, top: (OY + r.y * Q) * P, width: r.w * Q * P, height: r.h * Q * P });
    S.layoutCb(css(mainScreen), screens.map(s => ({ ...css(s.r), a: s.a })), crt ? 3 * Q * P : Q * P * .5);
  }
  requestAnimationFrame(frame);
}

/* ---------- public API ---------- */
window.Rig = {
  init(stages, rows, layoutCb) { try { for (const f of ['Press Start 2P', 'VT323']) document.fonts.load(`16px '${f}'`); } catch {} STAGES = stages; ROWS = rows; S.layoutCb = layoutCb; resize(); addEventListener('resize', resize); smallQ.addEventListener?.('change', resize); portraitQ.addEventListener?.('change', resize); requestAnimationFrame(frame); },
  setStage(n, animate) {
    const prevSides = STAGES[S.stage].side.length;
    S.prev = animate ? S.stage : n; S.stage = n; S.t0 = animate ? performance.now() : -1e9;
    S.born = STAGES[n].side.map((_, i) => (animate && i >= prevSides) ? performance.now() : -1e9);
    if (portraitQ.matches) resize();
  },
  zap() { S.zapT = performance.now(); },
  press(code) {
    const k = S.keys.get(code) || { d: 0, v: 0, down: false, flash: 0 };
    if (k.down) return; k.down = true; k.flash = 1; S.keys.set(code, k);
    const big = code === 'Enter' || code === 'Space' || code === 'Backspace';
    spawn(code, code === 'Enter' ? 14 : big ? 6 : 3, code === 'Enter');
    if (code === 'Enter') S.enterT = performance.now();
  },
  release(code) { const k = S.keys.get(code); if (k) k.down = false; },
  hasKey(code) { return ROWS.some(r => r.some(k => k[0] === code)); },
  keyAt(cx, cy) { const x = (cx / P - OX) / Q, y = (cy / P - OY) / Q; const k = S.keyRects.find(r => x >= r.x && x < r.x + r.w && y >= r.y - 1 && y < r.y + r.h + 1); return k ? k.code : null; },
  setShift(on) { S.shift = on; },
  mouseMove(fx, fy) { S.mouse.tx = fx * 8; S.mouse.ty = fy * 5; },
  mouseBtn(l, r) { S.mouse.l = l; S.mouse.r = r; }
};
})();
