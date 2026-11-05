'use strict';
// Wspólne narzędzia: matematyka, szum, losowość, sprite'y.
window.G = window.G || {};
(function (G) {
  G.W = 640;
  G.H = 960;
  G.FONT = '"Bahnschrift","Segoe UI","Roboto Condensed",system-ui,sans-serif';

  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.smoothstep = (a, b, v) => {
    const t = G.clamp((v - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  G.rand = (a, b) => a + Math.random() * (b - a);
  G.randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  G.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  G.dist2 = (ax, ay, bx, by) => (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
  G.angleWrap = (a) => {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };

  // Deterministyczny generator (mulberry32)
  G.rng = function (seed) {
    let s = seed >>> 0 || 1;
    return function () {
      s = (s + 0x6d2b79f5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  G.hash2 = (x, y, seed) => {
    let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };

  G.noise2 = (x, y, seed) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = G.hash2(xi, yi, seed), b = G.hash2(xi + 1, yi, seed);
    const c = G.hash2(xi, yi + 1, seed), d = G.hash2(xi + 1, yi + 1, seed);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };

  G.fbm = (x, y, seed, oct) => {
    let s = 0, amp = 0.5, f = 1, n = 0;
    for (let i = 0; i < oct; i++) {
      s += amp * G.noise2(x * f, y * f, seed + i * 17);
      n += amp;
      amp *= 0.5;
      f *= 2.03;
    }
    return s / n;
  };

  G.makeCanvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  };

  // Sprite rysowany w 2x rozdzielczości, z początkiem układu w środku.
  G.SPR = 2;
  G.sprite = (w, h, fn) => {
    const c = G.makeCanvas(w * G.SPR, h * G.SPR);
    const x = c.getContext('2d');
    x.scale(G.SPR, G.SPR);
    x.translate(w / 2, h / 2);
    fn(x, w, h);
    c.w = w;
    c.h = h;
    return c;
  };

  // Sylwetka (np. cień) z dowolnego sprite'a.
  G.silhouette = (s, color) => {
    const c = G.makeCanvas(s.width, s.height);
    const x = c.getContext('2d');
    x.drawImage(s, 0, 0);
    x.globalCompositeOperation = 'source-in';
    x.fillStyle = color || '#000';
    x.fillRect(0, 0, c.width, c.height);
    c.w = s.w;
    c.h = s.h;
    return c;
  };

  G.draw = (ctx, s, x, y, rot, sx, sy, alpha) => {
    ctx.save();
    ctx.translate(x, y);
    if (rot) ctx.rotate(rot);
    if (sx !== undefined && (sx !== 1 || (sy !== undefined && sy !== 1))) ctx.scale(sx, sy === undefined ? sx : sy);
    if (alpha !== undefined) ctx.globalAlpha *= alpha;
    ctx.drawImage(s, -s.w / 2, -s.h / 2, s.w, s.h);
    ctx.restore();
  };

  G.hexRgb = (hex) => {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };

  // Miękka poświata w danym kolorze (cache).
  const glowCache = {};
  G.glow = (hex) => {
    if (glowCache[hex]) return glowCache[hex];
    const [r, g, b] = G.hexRgb(hex);
    const S = 64;
    const c = G.makeCanvas(S, S);
    const x = c.getContext('2d');
    const gr = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, `rgba(${Math.min(255, r + 120)},${Math.min(255, g + 120)},${Math.min(255, b + 120)},1)`);
    gr.addColorStop(0.18, `rgba(${r},${g},${b},0.85)`);
    gr.addColorStop(0.45, `rgba(${r},${g},${b},0.28)`);
    gr.addColorStop(1, `rgba(${r},${g},${b},0)`);
    x.fillStyle = gr;
    x.fillRect(0, 0, S, S);
    c.w = S;
    c.h = S;
    glowCache[hex] = c;
    return c;
  };

  G.roundRect = (ctx, x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  };
})(window.G);
