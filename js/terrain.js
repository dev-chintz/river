'use strict';
// Rzeka (geometria: rozlewiska, kaniony, wyspy) i renderer terenu: kafle liczone
// per piksel z oświetleniem i klifami, biomy sektorów, animowana woda, chmury.
(function (G) {
  const W = G.W, H = G.H, TAU = Math.PI * 2;

  // ===================== BIOMY =====================
  // Kolory terenu dla poszczególnych krajobrazów; mieszane płynnie na granicach sektorów.
  const BIOMES = [
    { // 0: łąki delty
      grassL: [128, 168, 72], grassD: [70, 118, 44], forest: [48, 86, 36], dry: [176, 170, 92], stone: [142, 135, 122],
      sand: [212, 192, 140], wet: [150, 132, 92], cliffL: [176, 164, 140], cliffD: [96, 86, 72], shallow: [70, 182, 172],
      water: [13, 74, 102], trees: 1,
    },
    { // 1: bujne rozlewiska
      grassL: [112, 164, 66], grassD: [56, 110, 40], forest: [36, 78, 32], dry: [150, 160, 84], stone: [128, 130, 118],
      sand: [204, 192, 138], wet: [132, 124, 86], cliffL: [156, 154, 130], cliffD: [80, 82, 66], shallow: [60, 172, 150],
      water: [11, 68, 88], trees: 1.25,
    },
    { // 2: piaskowiec
      grassL: [160, 160, 86], grassD: [118, 124, 60], forest: [70, 96, 46], dry: [204, 170, 110], stone: [178, 120, 82],
      sand: [226, 190, 136], wet: [170, 128, 88], cliffL: [214, 138, 86], cliffD: [116, 58, 38], shallow: [64, 190, 186],
      water: [10, 82, 100], trees: 0.45,
    },
    { // 3: mokradła
      grassL: [104, 134, 74], grassD: [62, 94, 50], forest: [42, 70, 40], dry: [128, 126, 84], stone: [112, 112, 100],
      sand: [132, 122, 88], wet: [96, 92, 66], cliffL: [128, 124, 104], cliffD: [66, 64, 52], shallow: [86, 146, 112],
      water: [24, 62, 62], trees: 0.9,
    },
    { // 4: granit
      grassL: [118, 146, 84], grassD: [72, 104, 56], forest: [44, 78, 46], dry: [150, 150, 118], stone: [150, 150, 148],
      sand: [176, 172, 158], wet: [120, 118, 108], cliffL: [184, 184, 182], cliffD: [74, 78, 88], shallow: [74, 170, 180],
      water: [16, 62, 86], trees: 0.7,
    },
  ];
  G.BIOMES = BIOMES;

  // Mieszanie dwóch obiektów o polach liczbowych lub tablicach liczb.
  G.mixObj = (a, b, t) => {
    if (t <= 0) return a;
    if (t >= 1) return b;
    const o = {};
    for (const k in a) {
      const va = a[k], vb = b[k];
      if (Array.isArray(va)) o[k] = va.map((v, i) => v + (vb[i] - v) * t);
      else if (typeof va === 'number') o[k] = va + (vb - va) * t;
      else o[k] = t < 0.5 ? va : vb;
    }
    return o;
  };

  // ===================== RZEKA =====================
  class River {
    constructor(seed) {
      this.seed = seed;
      const r = G.rng(seed);
      this.p = [r() * 100, r() * 100, r() * 100];
      // {type:'gate',y} | {type:'arena',y0,y1} | {type:'island',y0,y1,w} | {type:'calm',y0,y1} | {type:'canyon',...}
      this.features = [];
      this.zones = []; // sektory: {y0,y1,biome,look,wk}
    }
    addFeature(f) {
      this.features.push(f);
    }
    addZone(z) {
      this.zones.push(z);
    }
    prune(minY) {
      this.features = this.features.filter((f) => (f.y1 !== undefined ? f.y1 : f.y) > minY - 1500);
      while (this.zones.length > 2 && this.zones[1].y1 < minY - 2000) this.zones.shift();
    }
    zoneAt(y) {
      const zs = this.zones;
      for (let i = 0; i < zs.length; i++) if (y < zs[i].y1) return i;
      return zs.length - 1;
    }
    // Płynne przejście między sektorami: {a, b, t}
    zoneBlend(y) {
      const zs = this.zones;
      if (!zs.length) return null;
      const i = Math.max(0, this.zoneAt(y));
      const z = zs[i];
      const B = 480;
      if (i > 0 && y < z.y0 + B) return { a: zs[i - 1], b: z, t: G.smoothstep(z.y0 - B, z.y0 + B, y) };
      if (i < zs.length - 1 && y > z.y1 - B) return { a: z, b: zs[i + 1], t: G.smoothstep(z.y1 - B, z.y1 + B, y) };
      return { a: z, b: z, t: 0 };
    }
    paletteAt(y) {
      const zb = this.zoneBlend(y);
      if (!zb) return BIOMES[0];
      return G.mixObj(BIOMES[zb.a.biome], BIOMES[zb.b.biome], zb.t);
    }

    // Krawędzie wody na wysokości y: l, r, wyspa il/ir (il = -1 gdy brak), rock: 0..1 (kanion)
    at(y) {
      const s0 = this.seed;
      let hw = 200 + 52 * (G.noise2(y * 0.0008, 3.3, s0) * 2 - 1);
      let s = 0.62 * Math.sin(y * 0.0011 + this.p[0]) + 0.38 * (G.noise2(y * 0.0019, 7.7, s0) * 2 - 1);
      let ih = 0, wob = 1, rock = 0, cOff = 0;
      const zs = this.zones;
      for (let i = 0; i < zs.length; i++) {
        if (y >= zs[i].y0 && y < zs[i].y1) { hw *= zs[i].wk; break; }
      }
      const fs = this.features;
      for (let i = 0; i < fs.length; i++) {
        const f = fs[i];
        if (f.type === 'gate') {
          const k = 1 - G.smoothstep(260, 700, Math.abs(y - f.y));
          if (k > 0) {
            hw = G.lerp(hw, 172, k);
            s = G.lerp(s, 0, k);
            cOff *= 1 - k;
            rock *= 1 - k;
            wob = Math.min(wob, 1 - k * 0.8);
          }
        } else if (f.type === 'canyon') {
          const k = G.smoothstep(f.y0 - 380, f.y0, y) * (1 - G.smoothstep(f.y1, f.y1 + 380, y));
          if (k > 0) {
            // przesunięcie nurtu narasta łagodniej niż zwężenie, żeby wejście w kanion nie było ścianą
            const kc = G.smoothstep(f.y0 - 380, f.y0 + 500, y) * (1 - G.smoothstep(f.y1 - 500, f.y1 + 380, y));
            const w = f.w * (1 + 0.1 * (G.noise2(y * 0.004, 5.1, s0) * 2 - 1));
            hw = G.lerp(hw, w, k);
            s = G.lerp(s, f.s, kc * 0.7);
            cOff += kc * f.amp * Math.sin((y - f.y0) * f.fr + f.ph);
            rock = Math.max(rock, k);
          }
        } else if (f.type === 'arena' || f.type === 'calm') {
          const k = G.smoothstep(f.y0 - 800, f.y0, y) * (1 - G.smoothstep(f.y1, f.y1 + 800, y));
          if (k > 0) {
            hw = G.lerp(hw, f.type === 'arena' ? 262 : 215, k);
            s = G.lerp(s, 0, k * (f.type === 'arena' ? 1 : 0.6));
            cOff *= 1 - k;
            rock *= 1 - k;
          }
        } else if (f.type === 'island') {
          if (y > f.y0 && y < f.y1) {
            const t = (y - f.y0) / (f.y1 - f.y0);
            const k = Math.pow(Math.sin(Math.PI * t), 0.55);
            ih = Math.max(ih, k * f.w * (1 + 0.25 * (G.noise2(y * 0.012, 1.7, s0) - 0.5)));
          }
        }
      }
      if (ih > 0) hw += ih * 0.85;
      hw = Math.min(hw, W / 2 - 34);
      const maxOff = Math.max(0, W / 2 - 52 - hw);
      let c = W / 2 + maxOff * G.clamp(s, -1, 1) + cOff;
      c = G.clamp(c, hw + 30, W - hw - 30);
      // poszarpanie brzegu: łagodne na rozlewiskach, skaliste w kanionach
      const lw = 1 - rock * 0.6;
      const wl = ((G.noise2(y * 0.011, 11.1, s0) - 0.5) * 22 * lw + (G.noise2(y * 0.04, 12.3, s0) - 0.5) * 6 + (G.noise2(y * 0.09, 13.7, s0) - 0.5) * 7 * rock) * wob;
      const wr = ((G.noise2(y * 0.011, 21.7, s0) - 0.5) * 22 * lw + (G.noise2(y * 0.04, 22.9, s0) - 0.5) * 6 + (G.noise2(y * 0.09, 23.3, s0) - 0.5) * 7 * rock) * wob;
      const out = { l: c - hw + wl, r: c + hw + wr, il: -1, ir: -1, c, rock };
      ih = Math.min(ih, hw - 95);
      if (ih > 6) {
        out.il = c - ih + (G.noise2(y * 0.02, 31.3, s0) - 0.5) * 10;
        out.ir = c + ih + (G.noise2(y * 0.02, 41.9, s0) - 0.5) * 10;
      }
      return out;
    }
    isWater(x, y) {
      const e = this.at(y);
      if (x <= e.l || x >= e.r) return false;
      if (e.il >= 0 && x >= e.il && x <= e.ir) return false;
      return true;
    }
    spans(y) {
      const e = this.at(y);
      if (e.il >= 0) return [[e.l, e.il], [e.ir, e.r]];
      return [[e.l, e.r]];
    }
    // Przedział wody zawierający x (lub najbliższy)
    spanAt(x, y) {
      const sp = this.spans(y);
      let best = sp[0], bd = 1e9;
      for (const s of sp) {
        if (x >= s[0] && x <= s[1]) return s;
        const d = Math.min(Math.abs(x - s[0]), Math.abs(x - s[1]));
        if (d < bd) { bd = d; best = s; }
      }
      return best;
    }
    widestSpan(y) {
      return this.spans(y).sort((a, b) => b[1] - b[0] - (a[1] - a[0]))[0];
    }
    randomWaterX(y, margin) {
      const sp = this.spans(y).filter((s) => s[1] - s[0] > margin * 2 + 4);
      if (!sp.length) return null;
      const s = G.pick(sp);
      return G.rand(s[0] + margin, s[1] - margin);
    }
  }
  G.River = River;

  // ===================== TEREN =====================
  const CH = 128;

  class Terrain {
    constructor(river, seed) {
      this.river = river;
      this.seed = seed;
      this.TS = G.terrainScale || 1; // rozdzielczość kafli (piksele na jednostkę świata)
      this.chunks = new Map();
      this.t = 0;
      this.waterLight = makeWaterTex(77, 'rgba(210,245,255,', 230, 0.07, 0.28);
      this.waterDark = makeWaterTex(91, 'rgba(4,30,50,', 160, 0.1, 0.3);
      this.patterns = null;
      this.glints = [];
      this.clouds = [];
      this.shadows = [];
      this.cloudT = 2;
      this.shadowT = 0;
      for (let i = 0; i < 3; i++) this.spawnShadow(G.rand(-100, H));
    }

    spawnShadow(sy) {
      this.shadows.push({ x: G.rand(-60, W + 60), sy: sy, k: Math.floor(Math.random() * 4), s: G.rand(1.1, 1.8), a: G.rand(0.14, 0.24), rot: G.rand(-0.5, 0.5) });
    }

    ensure(camY, budget) {
      const k0 = Math.floor(camY / CH) - 1;
      const k1 = Math.floor((camY + H) / CH) + 1;
      if (!this.jobs) this.jobs = new Map();
      for (let k = k0; k <= k1; k++) {
        if (!this.chunks.has(k)) {
          // potrzebny natychmiast: dokończ (lub policz) synchronicznie
          const it = this.jobs.get(k) || this.genJob(k);
          let r = it.next();
          while (!r.done) r = it.next();
          this.chunks.set(k, r.value);
          this.jobs.delete(k);
        }
      }
      // pre-generacja w przód, z budżetem czasu na klatkę
      const ahead = budget === undefined ? 1 : budget;
      if (ahead > 1) {
        for (let k = k1 + 1; k <= k1 + ahead; k++) if (!this.chunks.has(k)) this.chunks.set(k, this.gen(k));
      } else {
        const t0 = performance.now();
        for (let k = k1 + 1; k <= k1 + 6; k++) {
          if (this.chunks.has(k)) continue;
          let it = this.jobs.get(k);
          if (!it) { it = this.genJob(k); this.jobs.set(k, it); }
          let r;
          do { r = it.next(); } while (!r.done && performance.now() - t0 < 3);
          if (r.done) { this.chunks.set(k, r.value); this.jobs.delete(k); }
          if (performance.now() - t0 >= 3) break;
        }
      }
      for (const k of this.chunks.keys()) if (k < k0 - 1) this.chunks.delete(k);
      for (const k of this.jobs.keys()) if (k < k0 - 1) this.jobs.delete(k);
    }

    gen(k) {
      const it = this.genJob(k);
      let r = it.next();
      while (!r.done) r = it.next();
      return r.value;
    }

    // Generator: kafel liczony partiami wierszy, by nie gubić klatek.
    *genJob(k) {
      const R = this.river, seed = this.seed, TS = this.TS;
      const PW = Math.round(W * TS), PH = Math.round(CH * TS);
      const c = G.makeCanvas(PW, PH);
      const ctx = c.getContext('2d');
      const img = ctx.createImageData(PW, PH);
      const d = img.data;
      const rows = PH + 2;
      const N = rows * PW;
      const hm = new Float32Array(N);
      const info = new Float32Array(N); // >0 ląd (odległość), <=0 woda (-głębokość)
      const lEdge = new Float32Array(N);
      const nArr = new Float32Array(N);
      const fArr = new Float32Array(N);
      const rowRock = new Float32Array(rows);
      const rowPal = new Array(rows);
      const top = k * CH + CH; // świat y górnej krawędzi kafla
      for (let ri = 0; ri < rows; ri++) {
        const wy = top - (ri - 0.5) / TS;
        const e = R.at(wy);
        const { l, r, il, ir } = e;
        const rk = e.rock;
        rowRock[ri] = rk;
        rowPal[ri] = R.paletteAt(wy);
        for (let px = 0; px < PW; px++) {
          const x = (px + 0.5) / TS;
          const idx = ri * PW + px;
          let land, dist = 0, depth = 0, le = 99;
          if (x <= l) { land = 1; dist = l - x; }
          else if (x >= r) { land = 1; dist = x - r; }
          else if (il >= 0 && x >= il && x <= ir) { land = 1; dist = Math.min(x - il, ir - x); }
          else {
            land = 0;
            if (il >= 0) {
              if (x < il) { depth = Math.min(x - l, il - x); le = x - l; }
              else { depth = Math.min(x - ir, r - x); le = x - ir; }
            } else { depth = Math.min(x - l, r - x); le = x - l; }
          }
          let h = 0;
          if (land) {
            const n = G.fbm(x * 0.011, wy * 0.011, seed, 3);
            nArr[idx] = n;
            fArr[idx] = G.noise2(x * 0.0065, wy * 0.0065, seed + 50) * 0.72 + G.noise2(x * 0.024, wy * 0.024, seed + 51) * 0.28;
            h = 1.25 * G.smoothstep(0, 24, dist) + 2.4 * n * G.smoothstep(6, 90, dist) + 0.22 * G.noise2(x * 0.09, wy * 0.09, seed + 9);
            if (rk > 0) {
              // klif kanionu: stroma ściana tuż przy wodzie, skalisty płaskowyż dalej
              const cl = G.smoothstep(0, 9 + 14 * n, dist);
              h += rk * (3.8 * cl + 1.4 * n * G.smoothstep(12, 80, dist) + 0.55 * G.noise2(x * 0.06, wy * 0.06, seed + 13) * cl);
            }
            info[idx] = dist + 0.001;
          } else {
            h = -0.15 * G.smoothstep(0, 30, depth);
            info[idx] = -depth;
            lEdge[idx] = le;
            fArr[idx] = G.noise2(x * 0.15, wy * 0.05, seed + 77);
          }
          hm[idx] = h;
        }
        if ((ri & 7) === 7) yield;
      }
      for (let row = 0; row < PH; row++) {
        const ri = row + 1;
        const wy = top - (ri - 0.5) / TS;
        const rk = rowRock[ri];
        const P = rowPal[ri];
        for (let px = 0; px < PW; px++) {
          const idx = ri * PW + px;
          const o = (row * PW + px) * 4;
          const inf = info[idx];
          if (inf > 0) {
            const dist = inf;
            const xl = px > 0 ? idx - 1 : idx, xr = px < PW - 1 ? idx + 1 : idx;
            const dx = (hm[xr] - hm[xl]) * TS;
            const dy = (hm[idx + PW] - hm[idx - PW]) * TS;
            let shade = 1 + 4.2 * (dx + dy);
            shade = G.clamp(shade, 0.42 - rk * 0.1, 1.45 + rk * 0.15);
            const n = nArr[idx], f = fArr[idx];
            let cr, cg, cb;
            // trawa: jasna -> ciemna
            const gt = G.smoothstep(0.32, 0.68, f);
            cr = G.lerp(P.grassL[0], P.grassD[0], gt); cg = G.lerp(P.grassL[1], P.grassD[1], gt); cb = G.lerp(P.grassL[2], P.grassD[2], gt);
            // las
            const ft = G.smoothstep(0.56, 0.66, f);
            cr = G.lerp(cr, P.forest[0], ft); cg = G.lerp(cg, P.forest[1], ft); cb = G.lerp(cb, P.forest[2], ft);
            // sucha trawa
            const dt = G.smoothstep(0.62, 0.7, 1 - f) * 0.6;
            cr = G.lerp(cr, P.dry[0], dt); cg = G.lerp(cg, P.dry[1], dt); cb = G.lerp(cb, P.dry[2], dt);
            // skały
            const rt = G.smoothstep(0.6, 0.7, n);
            cr = G.lerp(cr, P.stone[0], rt); cg = G.lerp(cg, P.stone[1], rt); cb = G.lerp(cb, P.stone[2], rt);
            // piasek przy brzegu (na rozlewiskach)
            const st = (1 - G.smoothstep(9, 20, dist + (n - 0.5) * 14)) * (1 - rk);
            cr = G.lerp(cr, P.sand[0], st); cg = G.lerp(cg, P.sand[1], st); cb = G.lerp(cb, P.sand[2], st);
            const wt = (1 - G.smoothstep(0, 5, dist)) * (1 - rk);
            cr = G.lerp(cr, P.wet[0], wt); cg = G.lerp(cg, P.wet[1], wt); cb = G.lerp(cb, P.wet[2], wt);
            // ściany kanionu: warstwy skalne (strata) i płaskowyż
            if (rk > 0) {
              const rockT = rk * (1 - G.smoothstep(24, 30 + 90 * (0.35 + n), dist));
              if (rockT > 0) {
                const band = 0.5 + 0.5 * Math.sin(hm[idx] * 6.5 + n * 5 + G.noise2(x0(px, TS) * 0.05, wy * 0.012, seed + 21) * 3);
                const rr = G.lerp(P.cliffD[0], P.cliffL[0], band), rg = G.lerp(P.cliffD[1], P.cliffL[1], band), rb = G.lerp(P.cliffD[2], P.cliffL[2], band);
                cr = G.lerp(cr, rr, rockT); cg = G.lerp(cg, rg, rockT); cb = G.lerp(cb, rb, rockT);
              }
              // ciemna podstawa klifu tuż nad wodą
              const base = rk * (1 - G.smoothstep(0, 4, dist)) * 0.45;
              cr *= 1 - base; cg *= 1 - base; cb *= 1 - base;
            }
            const sp = 1 + (G.hash2(px, ri + k * 977, seed + 3) - 0.5) * 0.12;
            const m = shade * sp;
            d[o] = G.clamp(cr * m, 0, 255);
            d[o + 1] = G.clamp(cg * m, 0, 255);
            d[o + 2] = G.clamp(cb * m, 0, 255);
            d[o + 3] = 255;
          } else {
            const depth = -inf;
            let r = 0, g = 0, b = 0, a = 0;
            const blend = (cr, cg, cb, ca) => {
              const na = ca + a * (1 - ca);
              if (na <= 0) return;
              r = (cr * ca + r * a * (1 - ca)) / na;
              g = (cg * ca + g * a * (1 - ca)) / na;
              b = (cb * ca + b * a * (1 - ca)) / na;
              a = na;
            };
            // głębina: ciemniejszy nurt pośrodku
            const deep = G.smoothstep(40, 150, depth) * (0.2 + rk * 0.12);
            if (deep > 0) blend(2, 18, 34, deep);
            // płycizna
            const sh = Math.pow(1 - G.clamp(depth / 58, 0, 1), 2) * 0.72 * (1 - 0.65 * rk);
            if (sh > 0) blend(P.shallow[0], P.shallow[1], P.shallow[2], sh);
            // cień od brzegu (światło z lewej-góry); klify rzucają dłuższy cień
            const le = lEdge[idx];
            const sw = 18 + rk * 38;
            if (le < sw) blend(0, 10, 18, (0.38 + rk * 0.22) * Math.pow(1 - le / sw, 1.2));
            // odbicie jasnej ściany przy prawym brzegu kanionu
            if (rk > 0 && le > depth && depth < 14) blend(P.cliffL[0], P.cliffL[1], P.cliffL[2], 0.28 * rk * (1 - depth / 14));
            // piana na styku z brzegiem
            const thr = 2 + 3 * fArr[idx] + rk * 2.5;
            if (depth < thr) blend(255, 255, 255, (0.8 + rk * 0.15) * (1 - depth / thr));
            d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = a * 255;
          }
        }
        if ((row & 15) === 15) yield;
      }
      ctx.putImageData(img, 0, 0);
      // obiekty: drzewa, skały, domy (także z sąsiednich kafli, by nie ucinać)
      ctx.scale(TS, TS);
      const objs = [];
      for (let kk = k - 1; kk <= k + 1; kk++) objs.push(...this.objects(kk));
      const S = G.S;
      for (const o of objs) {
        const ry = top - o.y;
        if (ry < -40 || ry > CH + 40) continue;
        const sh = o.kind === 'tree' ? S.treeShadows[o.v] : o.kind === 'pine' ? S.pineShadows[o.v] : o.kind === 'house' ? S.houseShadow : o.kind === 'rock' ? S.rockShadows[o.v] : null;
        if (sh) G.draw(ctx, sh, o.x + o.s * 0.45, ry + o.s * 0.55, o.rot, o.s / 20, o.s / 20, o.kind === 'rock' ? 0.4 : 0.32);
      }
      for (const o of objs) {
        const ry = top - o.y;
        if (ry < -40 || ry > CH + 40) continue;
        let spr;
        if (o.kind === 'tree') spr = S.trees[o.v];
        else if (o.kind === 'pine') spr = S.pines[o.v];
        else if (o.kind === 'rock') spr = S.rocks[o.v];
        else spr = S.houses[o.v];
        G.draw(ctx, spr, o.x, ry, o.rot, o.s / 20, o.s / 20);
      }
      return c;
    }

    objects(k) {
      if (!this._objCache) this._objCache = new Map();
      if (this._objCache.has(k)) return this._objCache.get(k);
      const r = G.rng((this.seed * 7919 + k * 104729) >>> 0);
      const out = [];
      const R = this.river;
      const N = 150;
      const P = R.paletteAt(k * CH + CH / 2);
      for (let i = 0; i < N; i++) {
        const x = r() * W, y = k * CH + r() * CH;
        const e = R.at(y);
        let dist;
        if (x <= e.l) dist = e.l - x;
        else if (x >= e.r) dist = x - e.r;
        else if (e.il >= 0 && x >= e.il && x <= e.ir) dist = Math.min(x - e.il, e.ir - x);
        else continue;
        const f = G.noise2(x * 0.0065, y * 0.0065, this.seed + 50) * 0.72 + G.noise2(x * 0.024, y * 0.024, this.seed + 51) * 0.28;
        const n = G.fbm(x * 0.011, y * 0.011, this.seed, 3);
        const rr = r(), rv = r(), rs = r(), rot = r() * Math.PI * 2;
        const rk = e.rock;
        if (dist < 16) {
          if (dist > 8 && rr < 0.04 * (1 - rk)) out.push({ kind: 'rock', x, y, v: Math.floor(rv * 4), s: 10 + rs * 8, rot });
          continue;
        }
        // skalny płaskowyż kanionu: głazy zamiast drzew
        if (rk > 0.3 && dist < 30 + 90 * (0.35 + n) * rk) {
          if (rr < 0.07 * rk) out.push({ kind: 'rock', x, y, v: Math.floor(rv * 4), s: 12 + rs * 16, rot });
          continue;
        }
        if (n > 0.64) {
          if (rr < 0.18) out.push({ kind: 'rock', x, y, v: Math.floor(rv * 4), s: 12 + rs * 14, rot });
          continue;
        }
        let p = (f > 0.6 ? 0.95 : f > 0.5 ? 0.35 : 0.05) * P.trees;
        if (rr < p) {
          const pine = f > 0.58 ? rv < 0.45 : rv < 0.12;
          out.push({ kind: pine ? 'pine' : 'tree', x, y, v: pine ? Math.floor(rs * 4) : Math.floor(rs * 8), s: (f > 0.58 ? 16 : 12) + rs * 10, rot });
        } else if (f < 0.36 && dist > 45 && rr > 0.985 && rk < 0.2) {
          // mała zagroda
          const a = Math.round(rot / (Math.PI / 2)) * (Math.PI / 2) + (rv - 0.5) * 0.3;
          out.push({ kind: 'house', x, y, v: Math.floor(rs * 3), s: 20, rot: a });
          out.push({ kind: 'house', x: x + Math.cos(a) * 30, y: y - Math.sin(a) * 30, v: Math.floor(rv * 3), s: 17, rot: a + Math.PI / 2 });
        }
      }
      // obiekty o mniejszym y rysowane później -> lekko nachodzą (wygląda naturalnie)
      out.sort((a, b) => b.y - a.y);
      this._objCache.set(k, out);
      if (this._objCache.size > 40) {
        const first = this._objCache.keys().next().value;
        this._objCache.delete(first);
      }
      return out;
    }

    update(dt, camY, speed) {
      this.t += dt;
      // błyski słońca na wodzie
      for (let i = 0; i < 2; i++) {
        if (Math.random() < 0.6) {
          const y = camY + Math.random() * H;
          const x = this.river.randomWaterX(y, 20);
          if (x !== null) this.glints.push({ x, y, life: 0, max: G.rand(0.3, 0.7), s: G.rand(0.4, 1) });
        }
      }
      for (const g of this.glints) g.life += dt;
      this.glints = this.glints.filter((g) => g.life < g.max);
      // cienie chmur
      this.shadowT -= dt;
      if (this.shadowT <= 0) {
        this.spawnShadow(-260);
        this.shadowT = G.rand(2.5, 6) * (160 / Math.max(60, speed));
      }
      for (const s of this.shadows) s.sy += (speed + 14) * dt;
      this.shadows = this.shadows.filter((s) => s.sy < H + 300);
      // chmury nad samolotem
      this.cloudT -= dt;
      if (this.cloudT <= 0) {
        this.clouds.push({ x: G.rand(-40, W + 40), sy: -240, k: Math.floor(Math.random() * 4), s: G.rand(1, 1.7), a: G.rand(0.35, 0.7), rot: G.rand(-0.4, 0.4) });
        this.cloudT = G.rand(5, 11) * (160 / Math.max(60, speed));
      }
      for (const c of this.clouds) c.sy += speed * 1.75 * dt;
      this.clouds = this.clouds.filter((c) => c.sy < H + 300);
    }

    drawGround(ctx, camY) {
      const sc = G.renderScale || 1;
      // woda: kolor biomu + dwie animowane warstwy fal
      const P = this.river.paletteAt(camY + H / 2);
      const wc = P.water;
      ctx.fillStyle = `rgb(${wc[0] | 0},${wc[1] | 0},${wc[2] | 0})`;
      ctx.fillRect(-40, -40, W + 80, H + 80);
      if (!this.patterns) {
        this.patterns = [ctx.createPattern(this.waterDark, 'repeat'), ctx.createPattern(this.waterLight, 'repeat')];
      }
      const t = this.t;
      ctx.save();
      ctx.globalAlpha = 0.7;
      const ty1 = ((camY + t * 22) % 256) - 256;
      ctx.translate(Math.sin(t * 0.35) * 18 - 40, ty1);
      ctx.fillStyle = this.patterns[0];
      ctx.fillRect(0, 0, W + 120, H + 300);
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = 0.55;
      const ty2 = ((camY + t * 46) % 256) - 256;
      ctx.translate(Math.cos(t * 0.27) * 24 - 60, ty2);
      ctx.fillStyle = this.patterns[1];
      ctx.fillRect(0, 0, W + 120, H + 300);
      ctx.restore();
      // błyski
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const g of this.glints) {
        const sy = H - (g.y - camY);
        const a = Math.sin((g.life / g.max) * Math.PI);
        G.draw(ctx, G.S.star, g.x, sy, 0, g.s * a, g.s * a, a * 0.85);
      }
      ctx.restore();
      // kafle terenu (krawędzie wyrównane do pikseli ekranu, bez szwów)
      for (const [k, c] of this.chunks) {
        const top = H - (k * CH + CH - camY);
        if (top > H + 2 || top + CH < -2) continue;
        const y0 = Math.round(top * sc) / sc, y1 = Math.round((top + CH) * sc) / sc;
        ctx.drawImage(c, 0, y0, W, y1 - y0);
      }
      // cienie chmur
      for (const s of this.shadows) {
        const spr = G.S.cloudShadows[s.k];
        G.draw(ctx, spr, s.x, s.sy, s.rot, s.s, s.s, s.a);
      }
    }

    drawClouds(ctx, extra) {
      for (const c of this.clouds) {
        G.draw(ctx, G.S.clouds[c.k], c.x, c.sy, c.rot, c.s, c.s, Math.min(1, c.a * (1 + (extra || 0))));
      }
    }
  }
  G.Terrain = Terrain;
  G.CHUNK = CH;

  function x0(px, TS) {
    return (px + 0.5) / TS;
  }

  function makeWaterTex(seed, rgbaPrefix, count, a0, a1) {
    const S = 256;
    const c = G.makeCanvas(S, S);
    const x = c.getContext('2d');
    const r = G.rng(seed);
    x.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const px = r() * S, py = r() * S;
      const len = 8 + r() * 30;
      const a = a0 + r() * (a1 - a0);
      const w = 0.8 + r() * 1.8;
      const curv = (r() - 0.3) * 5;
      x.strokeStyle = rgbaPrefix + a + ')';
      x.lineWidth = w;
      for (const ox of [-S, 0, S]) {
        for (const oy of [-S, 0, S]) {
          x.beginPath();
          x.moveTo(px + ox - len / 2, py + oy);
          x.quadraticCurveTo(px + ox, py + oy - curv, px + ox + len / 2, py + oy);
          x.stroke();
        }
      }
    }
    return c;
  }
})(window.G);
